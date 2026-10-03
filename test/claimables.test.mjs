import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { claimables, CLAIMABLE_SHAPE, CLAIMABLE_TABS } from '../src/engine/claimables.js';
import { syncAlmanac, grantXp, weeklyChallenges, weekNumber, chapterAt } from '../src/engine/almanac.js';
import { checkReturn } from '../src/engine/returns.js';
import { addSouls } from '../src/engine/mayhem.js';
import { earnFreeze, markNoticesSeen } from '../src/engine/streaks.js';
import { legacyAt } from '../src/content/legacy.js';
import { SET_BY_ID } from '../src/content/collections.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const DAY = 86400000, NOW = at(2026, 10, 5);
function household() {
  const s = blankState();
  s.pets = [{ id: 'q0', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0 }];
  s.slots[0] = 'q0';
  syncAlmanac(s, NOW);
  return s;
}
const ids = list => list.map(c => c.id);

test('the claimable shape is documented and every entry has it', () => {
  assert.deepEqual(CLAIMABLE_SHAPE, ['id', 'label', 'hint', 'tab', 'priority']);
  const s = household();
  grantXp(s, 100, NOW); checkReturn(s, NOW); checkReturn(s, NOW + 2 * DAY);
  const list = claimables(s, NOW + 2 * DAY);
  assert.ok(list.length >= 2);
  for (const c of list) {
    assert.deepEqual(Object.keys(c).sort(), [...CLAIMABLE_SHAPE].sort());
    assert.ok(typeof c.id === 'string' && c.label.length > 3 && c.hint.length > 3 && CLAIMABLE_TABS.includes(c.tab) && Number.isFinite(c.priority), JSON.stringify(c));
    assert.ok(!/[–—]/.test(c.label + c.hint));
  }
  assert.deepEqual(list.map(c => c.priority), list.map(c => c.priority).sort((a, b) => b - a), 'highest first');
});

test('nothing is claimable on an empty shelf or a quiet one', () => {
  assert.deepEqual(claimables(blankState(), NOW), []);
  assert.deepEqual(claimables(household(), NOW), []);
});

test('each kind of thing waiting shows up, under a stable id', () => {
  const s = household();
  grantXp(s, 120, NOW);
  assert.ok(ids(claimables(s, NOW)).includes('almanac-tier'));
  // A finished set.
  for (const ref of SET_BY_ID.paper.members) s.mayhem.curios[ref.slice(2)] = 1;
  assert.ok(ids(claimables(s, NOW)).includes('set-complete'));
  // A freeze earned and not yet seen, then seen.
  earnFreeze(s, 'omen', 7, NOW);
  assert.ok(ids(claimables(s, NOW)).includes('freeze-earned'));
  markNoticesSeen(s);
  assert.ok(!ids(claimables(s, NOW)).includes('freeze-earned'));
  // A return chest outranks everything.
  checkReturn(s, NOW); checkReturn(s, NOW + DAY);
  assert.equal(claimables(s, NOW + DAY)[0].id, 'return-chest');
  // The chapter closing.
  const late = at(2026, 11, 2);
  assert.ok(ids(claimables(s, late)).includes('chapter-ends'));
  assert.equal(claimables(s, late).find(c => c.id === 'chapter-ends').label, 'The Thin Season ends today');
  // A Legacy Token with something to buy.
  s.mayhem.lifetime = legacyAt(1);
  assert.ok(ids(claimables(s, NOW)).includes('legacy-token'), 'one token buys the cheapest thing');
});

test('a weekly challenge that is done and a chest that is ready are separate prompts', () => {
  const s = household();
  const wk = weekNumber(NOW), list = weeklyChallenges(wk);
  s.almanac.week.no = wk;
  s.almanac.week.done = [list[0].id];
  assert.ok(ids(claimables(s, NOW)).includes('weekly-claim'));
  assert.ok(!ids(claimables(s, NOW)).includes('weekly-chest'));
  s.almanac.week.done = list.map(c => c.id);
  assert.ok(ids(claimables(s, NOW)).includes('weekly-chest'));
});

test('a Back Issues bargain shows only when it can be afforded', () => {
  const s = household();
  const later = at(2027, 1, 15);
  assert.ok(!ids(claimables(s, later)).includes('backissue-bargain'));
  addSouls(s, 500);
  assert.ok(ids(claimables(s, later)).includes('backissue-bargain'));
  assert.equal(chapterAt(later).id, 'resolve-2027');
});

test('asking changes nothing', () => {
  const s = household();
  grantXp(s, 300, NOW); checkReturn(s, NOW); checkReturn(s, NOW + DAY);
  const before = JSON.stringify(s);
  claimables(s, NOW + DAY); claimables(s, NOW + 40 * DAY);
  assert.equal(JSON.stringify(s), before);
});
