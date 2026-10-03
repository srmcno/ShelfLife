import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { blankReturns, normalizeReturns } from '../src/almanac-state.js';
import { HEADLINES, QUEUE_LINES, RESIDENT_LINES, BOARD_LINES } from '../src/content/returns.js';
import { RETURN_XP_PER_DAY } from '../src/content/almanac.js';
import { checkReturn, claimReturn, pendingReturn, chestFor, daysAway, awayLines, RETURN_AFTER_MS, RETURN_MAX_DAYS } from '../src/engine/returns.js';
import { syncAlmanac, chapterView } from '../src/engine/almanac.js';

const at = (m, d, h = 12) => new Date(2026, m - 1, d, h).getTime();
const HOUR = 3600000, DAY = 24 * HOUR;
const NOW = at(10, 5);
function household(count = 3) {
  const s = blankState();
  s.started = NOW - 5 * DAY; s.lastTick = NOW;
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 'r' + i, name: ['Agnes', 'Pip', 'Oswald'][i], traits: [], needs: { food: 30 + i * 20, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0, born: NOW - 5 * DAY }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const NODASH = /[\u2013\u2014]/;

test('a household with no recorded visit has nothing to be welcomed back from, then it does', () => {
  const s = household();
  assert.equal(checkReturn(s, NOW), null);
  assert.equal(s.returns.seenAt, NOW);
  assert.equal(checkReturn(s, NOW + 5 * HOUR), null, 'five hours is not a return');
  assert.equal(s.returns.seenAt, NOW + 5 * HOUR, 'but it was a visit');
  // Staying put never counts as being away, however long the page is open.
  for (let t = NOW + 5 * HOUR; t < NOW + 24 * HOUR; t += HOUR) assert.equal(checkReturn(s, t), null);
});

test('six hours away or more brings the card and a chest scaled by the days, capped at a week', () => {
  const s = household();
  checkReturn(s, NOW);
  const card = checkReturn(s, NOW + RETURN_AFTER_MS);
  assert.ok(card && card.days === 0 && card.souls === chestFor(0).souls);
  assert.ok(card.lines.length >= 4 && card.lines.every(l => typeof l === 'string' && l.length > 10 && !l.includes('{')), JSON.stringify(card.lines));
  const sizes = [0, 1, 2, 3, 7, 8, 30].map(d => chestFor(daysAway(d * DAY)).souls);
  assert.deepEqual(sizes, [20, 60, 100, 140, 300, 300, 300]);
  assert.equal(RETURN_MAX_DAYS, 7);
  assert.ok(chestFor(7).xp === 7 * RETURN_XP_PER_DAY);
});

test('claiming pays souls and XP once, and a second return the same day brings no second chest', () => {
  const s = household();
  syncAlmanac(s, NOW);
  checkReturn(s, NOW);
  checkReturn(s, NOW + 2 * DAY);
  const souls = s.mayhem.souls, xp = chapterView(s, NOW).xp;
  const got = claimReturn(s, NOW + 2 * DAY);
  assert.equal(got.days, 2);
  assert.equal(s.mayhem.souls, souls + got.souls);
  assert.equal(chapterView(s, NOW + 2 * DAY).xp, xp + got.xp);
  assert.equal(pendingReturn(s), null);
  assert.equal(claimReturn(s, NOW + 2 * DAY), null, 'claimed once');
  // Away again six hours later the same day: no second chest.
  assert.equal(checkReturn(s, NOW + 2 * DAY + 7 * HOUR), null);
  // The next day it works again.
  assert.ok(checkReturn(s, NOW + 4 * DAY));
});

test('leaving again before opening the chest keeps the longer absence rather than stacking', () => {
  const s = household();
  checkReturn(s, NOW);
  const first = checkReturn(s, NOW + 20 * HOUR);
  assert.equal(first.days, 0);
  const second = checkReturn(s, NOW + 20 * HOUR + 3 * DAY);
  assert.equal(second.id, first.id, 'the same card');
  assert.equal(second.days, 3); assert.equal(second.souls, chestFor(3).souls);
  const when = NOW + 20 * HOUR + 3 * DAY;
  assert.deepEqual(second.lines, awayLines(s, second.from, when, 3, second.id, when), 'the words are rewritten for the longer absence');
  assert.notDeepEqual(second.lines, first.lines, 'and no longer describe the short one');
  assert.equal(claimReturn(s, NOW + 11 * DAY).souls, chestFor(3).souls);
});

test('the card is written from the shelf: a queue, a resident, a scene, the chapter', () => {
  const s = household();
  s.mayhem.queue = [{ uid: 1, id: 'ouija', a: 'r0', at: NOW }, { uid: 2, id: 'rat-poison', a: 'r1', at: NOW }];
  s.life = { ...s.life, scenes: [{ id: 1, at: NOW + HOUR, title: 'The Great Biscuit Inquest', text: 'x', cast: [] }] };
  const lines = awayLines(s, NOW, NOW + 2 * DAY, 2, 1, NOW + 2 * DAY);
  assert.ok(lines.some(l => l.includes('2 ')), 'the queue is counted');
  assert.ok(lines.some(l => l.includes('The Great Biscuit Inquest')), 'a scene since you left');
  assert.ok(lines.some(l => /Agnes|Pip|Oswald/.test(l)), 'a resident by name');
  assert.ok(lines.some(l => l.includes('The Thin Season')), 'the running chapter');
  // A one-resident household never gets a line that needs a second resident.
  const solo = household(1);
  for (let n = 0; n < 60; n++) assert.ok(!awayLines(solo, NOW, NOW + DAY, 1, n).join(' ').includes('{b}'));
  for (let n = 0; n < 60; n++) assert.ok(!awayLines(solo, NOW, NOW + DAY, 1, n).join(' ').includes('undefined'));
});

test('no guilt: nothing here scolds, counts the hours against you or takes anything away', () => {
  const all = [...Object.values(HEADLINES).flat(), ...Object.values(QUEUE_LINES).flat(), ...RESIDENT_LINES, ...Object.values(BOARD_LINES)];
  for (const line of all) {
    assert.ok(!NODASH.test(line), line);
    assert.ok(!/abandon|neglect|ashamed|disappoint|punish|guilt|you left us|should have|how could you|forgot/i.test(line), 'guilt in: ' + line);
  }
  assert.ok(all.length >= 40);
});

test('return state is bounded and survives a reload', () => {
  assert.deepEqual(normalizeReturns(blankReturns()), blankReturns());
  const odd = normalizeReturns({ seenAt: 'x', claimedDay: 5, claimed: -1, serial: 1e99, pending: { id: 3, days: 99, souls: 1e9, xp: -5, lines: ['ok', 7, '', 'x'.repeat(999)] } }, NOW);
  assert.equal(odd.seenAt, 0); assert.equal(odd.claimedDay, ''); assert.equal(odd.claimed, 0);
  assert.equal(odd.pending.days, 7); assert.ok(odd.pending.souls <= 1000); assert.equal(odd.pending.xp, 0);
  assert.equal(odd.pending.lines.length, 2); assert.ok(odd.pending.lines[1].length <= 240);
  assert.equal(normalizeReturns({ pending: { id: 1 } }, NOW).pending, null);
  const s = household();
  checkReturn(s, NOW); checkReturn(s, NOW + 3 * DAY);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.returns.pending.lines, s.returns.pending.lines);
  assert.equal(back.returns.pending.souls, s.returns.pending.souls);
});

test('an empty shelf never has a card', () => {
  const s = blankState();
  assert.equal(checkReturn(s, NOW), null);
  assert.equal(checkReturn(s, NOW + 3 * DAY), null);
});
