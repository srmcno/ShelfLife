import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey, dayKeyOffset } from '../src/state.js';
import { blankStreaks, normalizeStreaks, FREEZE_MAX } from '../src/almanac-state.js';
import { drawOmen } from '../src/engine/mayhem.js';
import { castEpisode, episodeRule, courtFinish, docketToday } from '../src/engine/court.js';
import { finishRun, challengeToday, seededRandom } from '../src/engine/arcade.js';
import { dailyChallenge } from '../src/engine/daily.js';
import { freezeCount, canBridge, spendFreeze, earnFreeze, unseenNotices, markNoticesSeen, noticeText, FREEZE_EVERY } from '../src/engine/streaks.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
function household() {
  const s = blankState();
  s.started = NOW - DAY; s.lastTick = NOW;
  s.pets = ['g0', 'g1', 'g2'].map((id, i) => ({ id, name: ['Agnes', 'Pip', 'Oswald'][i], traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0, born: NOW - DAY }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
function air(s, caseId, now) {
  const ep = castEpisode(s, { caseId, plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(3));
  episodeRule(ep, 'plaintiff', seededRandom(4));
  return courtFinish(s, ep, now);
}
const NODASH = /[\u2013\u2014]/;

test('every seventh day of a streak earns a freeze and the shelf holds two', () => {
  const s = household();
  let earned = 0;
  for (let i = 0; i < 21; i++) {
    const r = drawOmen(s, NOW + i * DAY, () => 0.3);
    if (r.streak % FREEZE_EVERY === 0 && freezeCount(s) <= FREEZE_MAX) earned++;
    if (i === 6) assert.equal(freezeCount(s), 1, 'the seventh night earns one');
    if (i === 13) assert.equal(freezeCount(s), 2);
  }
  assert.equal(freezeCount(s), FREEZE_MAX, 'a third is not stored');
  assert.equal(s.streaks.earned, 2);
  assert.equal(earnFreeze(s, 'omen', 21, NOW), false, 'full');
  assert.equal(earnFreeze(blankState(), 'omen', 6, NOW), false, 'not a multiple of seven');
});

test('a freeze bridges exactly one missed night, after the older candle grace', () => {
  const s = household();
  for (let i = 0; i < 4; i++) drawOmen(s, NOW + i * DAY, () => 0.3);
  assert.equal(s.mayhem.omen.streak, 4);
  s.streaks.freezes = 1;
  // Grace is spent first, for free.
  const graced = drawOmen(s, NOW + 5 * DAY, () => 0.4);
  assert.equal(graced.graceUsed, true); assert.equal(graced.freezeUsed, false); assert.equal(graced.streak, 5);
  assert.equal(freezeCount(s), 1);
  // With the grace gone, the freeze covers the next missed night.
  const frozen = drawOmen(s, NOW + 7 * DAY, () => 0.5);
  assert.equal(frozen.freezeUsed, true); assert.equal(frozen.graceUsed, false); assert.equal(frozen.streak, 6);
  assert.equal(freezeCount(s), 0);
  assert.equal(s.streaks.used, 1);
  assert.equal(unseenNotices(s).filter(n => n.type === 'saved').length, 1);
  // Two missed nights is a gap a freeze does not cover, and without one the streak restarts as it always did.
  s.streaks.freezes = 2;
  assert.equal(drawOmen(s, NOW + 10 * DAY, () => 0.6).streak, 1);
  assert.equal(freezeCount(s), 2, 'unspent');
});

test('with no freeze held, nothing changes for the omen', () => {
  const s = household();
  drawOmen(s, NOW, () => 0.3); drawOmen(s, NOW + DAY, () => 0.3);
  s.mayhem.omen.grace = 0;
  const r = drawOmen(s, NOW + 3 * DAY, () => 0.3);
  assert.equal(r.streak, 1); assert.equal(r.freezeUsed, false);
});

test('a streak of one has nothing to protect', () => {
  const s = household();
  s.streaks.freezes = 2;
  drawOmen(s, NOW, () => 0.3);
  assert.equal(drawOmen(s, NOW + 2 * DAY, () => 0.3).streak, 1);
  assert.equal(freezeCount(s), 2);
  assert.equal(canBridge(s, dayKeyOffset(NOW, -2), 1, NOW), false);
  assert.equal(canBridge(s, dayKeyOffset(NOW, -2), 2, NOW), true);
  assert.equal(canBridge(s, dayKeyOffset(NOW, -3), 5, NOW), false);
  assert.equal(canBridge(s, '', 5, NOW), false);
});

test('the docket streak is bridged by a freeze, spent when the docket is next aired', () => {
  const s = household();
  for (let i = 0; i < 3; i++) { const d = NOW + i * DAY; air(s, docketToday(s, d).caseId, d); }
  assert.equal(s.courtroom.docketStreak, 3);
  s.streaks.freezes = 1;
  const skip = NOW + 4 * DAY;     // one day missed
  const today = docketToday(s, skip);
  assert.equal(today.bridged, true); assert.equal(today.streak, 3, 'it still reads as alive');
  assert.equal(freezeCount(s), 1, 'looking does not spend it');
  const result = air(s, today.caseId, skip);
  assert.equal(result.docket.streak, 4); assert.equal(result.docket.freeze, true);
  assert.equal(freezeCount(s), 0);
  // Two days missed: no bridge, even with freezes in hand.
  s.streaks.freezes = 2;
  const late = NOW + 7 * DAY;
  assert.equal(docketToday(s, late).bridged, false); assert.equal(docketToday(s, late).streak, 0);
  assert.equal(air(s, docketToday(s, late).caseId, late).docket.streak, 1);
  assert.equal(freezeCount(s), 2);
});

test('airing the docket seven days running earns a freeze', () => {
  const s = household();
  for (let i = 0; i < 7; i++) { const d = NOW + i * DAY; air(s, docketToday(s, d).caseId, d); }
  assert.equal(freezeCount(s), 1);
  assert.ok(unseenNotices(s).some(n => n.kind === 'docket' && n.type === 'earned'));
});

test('the daily challenge streak is bridged the same way', () => {
  const s = household();
  for (let i = 0; i < 3; i++) { const d = NOW + i * DAY; finishRun(s, dailyChallenge(localDayKey(d)).game, 10, 'g0', d, seededRandom(i + 1), { daily: true }); }
  assert.equal(s.arcade.dailyStreak, 3);
  s.streaks.freezes = 1;
  const skip = NOW + 4 * DAY, c = dailyChallenge(localDayKey(skip));
  const before = challengeToday(s, skip);
  assert.equal(before.bridged, true); assert.equal(before.streak, 3);
  const r = finishRun(s, c.game, 10, 'g0', skip, seededRandom(9), { daily: true });
  assert.equal(r.daily.streak, 4); assert.equal(r.daily.freeze, true);
  assert.equal(freezeCount(s), 0);
  // A challenge run of nothing claims nothing and spends nothing.
  s.streaks.freezes = 1;
  const next = NOW + 6 * DAY, c2 = dailyChallenge(localDayKey(next));
  const warm = finishRun(s, c2.game, 0, 'g0', next, seededRandom(2), { daily: true });
  assert.equal(warm.daily.freeze, false); assert.equal(freezeCount(s), 1);
});

test('freeze state is bounded, survives a reload and never leaks unknown fields', () => {
  assert.deepEqual(normalizeStreaks(blankStreaks()), blankStreaks());
  const odd = normalizeStreaks({ freezes: 99, earned: -3, used: 'x', notices: [{ kind: 'omen', type: 'saved', day: '2026-8-2', seen: 1 }, { kind: 'bad', type: 'saved' }, null, { kind: 'docket', type: 'earned', day: 'later' }], extra: 1 });
  assert.equal(odd.freezes, FREEZE_MAX); assert.equal(odd.earned, 0); assert.equal(odd.used, 0);
  assert.equal(odd.notices.length, 2); assert.equal(odd.notices[1].day, ''); assert.equal(odd.extra, undefined);
  assert.deepEqual(normalizeStreaks(odd), odd);
  const s = household();
  spendFreeze(s, 'omen', NOW);              // none held: a no-op
  assert.equal(s.streaks.used, 0);
  s.streaks.freezes = 1; spendFreeze(s, 'omen', NOW);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.streaks, s.streaks);
  for (let i = 0; i < 9; i++) { s.streaks.freezes = 1; spendFreeze(s, 'omen', NOW); }
  assert.ok(s.streaks.notices.length <= 4, 'the notice list stays short');
});

test('the notices say it plainly, once, and without a dash', () => {
  const s = household();
  s.streaks.freezes = 1;
  spendFreeze(s, 'docket', NOW);
  earnFreeze(s, 'challenge', 7, NOW);
  const notices = unseenNotices(s);
  assert.equal(notices.length, 2);
  assert.ok(noticeText(notices[0]).startsWith('A freeze saved your docket streak'));
  assert.ok(noticeText(notices[1]).includes('earned a streak freeze'));
  for (const n of notices) assert.ok(!NODASH.test(noticeText(n)));
  markNoticesSeen(s);
  assert.equal(unseenNotices(s).length, 0);
});
