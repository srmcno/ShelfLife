import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey, dayKeyOffset } from '../src/state.js';
import { normalizeCourtroom, courtroomState } from '../src/court-state.js';
import { COURT_CASES } from '../src/content/court.js';
import {
  castEpisode, docketCaseId, docketToday, courtFinish, episodeRule, DOCKET_SOULS, DOCKET_STREAK_SOULS, DOCKET_STREAK_CAP
} from '../src/engine/court.js';
import { seededRandom } from '../src/engine/arcade.js';

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
  episodeRule(ep, ep.p && 'plaintiff', seededRandom(4));
  return courtFinish(s, ep, now);
}

test('the docket is a pure function of the date and visits every case before repeating', () => {
  assert.equal(docketCaseId(localDayKey(NOW)), docketCaseId(localDayKey(NOW)));
  assert.equal(docketCaseId('nonsense'), '');
  const seen = new Set();
  for (let i = 0; i < COURT_CASES.length; i++) seen.add(docketCaseId(dayKeyOffset(NOW, i)));
  assert.equal(seen.size, COURT_CASES.length, 'a full cycle airs every case once');
  // It does not just run down the book in order.
  const order = Array.from({ length: 6 }, (_, i) => COURT_CASES.findIndex(c => c.id === docketCaseId(dayKeyOffset(NOW, i))));
  assert.ok(order.some((n, i) => i && n !== (order[i - 1] + 1) % COURT_CASES.length));
});

test('airing today’s docket pays once a day outside the purse and builds a streak', () => {
  const s = household();
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const day = NOW + i * DAY, docket = docketToday(s, day);
    assert.equal(docket.done, false);
    const first = air(s, docket.caseId, day);
    streak++;
    assert.equal(first.docket.streak, streak);
    assert.equal(first.docket.bonus, DOCKET_SOULS + DOCKET_STREAK_SOULS * Math.min(streak - 1, DOCKET_STREAK_CAP));
    assert.equal(s.mayhem.gameSouls, first.souls, 'the bonus does not come out of the daily purse');
    assert.equal(docketToday(s, day).done, true);
    // A second airing of the same case the same day pays no docket bonus.
    assert.equal(air(s, docket.caseId, day + 3600000).docket, null);
  }
});

test('other cases do not pay the bonus, and a missed day starts the streak again', () => {
  const s = household();
  const docket = docketToday(s, NOW);
  const other = COURT_CASES.find(c => c.id !== docket.caseId).id;
  assert.equal(air(s, other, NOW).docket, null);
  assert.equal(docketToday(s, NOW).done, false);
  assert.equal(air(s, docket.caseId, NOW).docket.streak, 1);
  const later = NOW + 4 * DAY;
  assert.equal(docketToday(s, later).streak, 0, 'a lapsed streak reads as zero');
  assert.equal(air(s, docketToday(s, later).caseId, later).docket.streak, 1);
});

test('the docket record survives reload and hostile data', () => {
  const s = household();
  air(s, docketToday(s, NOW).caseId, NOW);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(courtroomState(back).docketDay, localDayKey(NOW));
  assert.equal(courtroomState(back).docketStreak, 1);
  const bad = normalizeCourtroom({ docketDay: 'yesterday', docketLastDay: 5, docketStreak: -2 });
  assert.equal(bad.docketDay, ''); assert.equal(bad.docketLastDay, ''); assert.equal(bad.docketStreak, 0);
  assert.deepEqual(Object.keys(normalizeCourtroom(null)).sort(), ['best', 'docketDay', 'docketLastDay', 'docketStreak', 'episodes', 'justice', 'last', 'summonsDay', 'summonsHeard', 'summonsPaid', 'summonsVerdicts']);
});
