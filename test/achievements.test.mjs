import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFeuds, feudingIds, feudPairKey, stepFeudArc,
  GRUDGE_STAGE_AT, grudgeStageFor, checkGrudgeEscalation,
  checkinStreak, ACHIEVEMENTS, checkAchievements
} from '../src/engine/achievements.js';
import { FEUDS } from '../src/content/feuds.js';
import { blankState, defaultNeeds } from '../src/state.js';

function makePet(id, traits, overrides = {}) {
  return { id, name: id, traits, needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...overrides };
}
function localHour(h, day = 1) { return new Date(2024, 0, day, h, 0, 0).getTime(); }

test('activeFeuds detects a feuding pair sitting next to each other', () => {
  const [x, y] = FEUDS[0];
  const s = blankState();
  s.pets.push(makePet('a', [x]), makePet('b', [y]));
  s.slots[0] = 'a'; s.slots[1] = 'b';
  assert.equal(activeFeuds(s).length, 1);
  assert.equal(feudingIds(s).has('a'), true);
  assert.equal(feudingIds(s).has('b'), true);
});

test('activeFeuds finds nothing for non-adjacent pets', () => {
  const [x, y] = FEUDS[0];
  const s = blankState();
  s.pets.push(makePet('a', [x]), makePet('b', [y]));
  s.slots[0] = 'a'; s.slots[2] = 'b';
  assert.equal(activeFeuds(s).length, 0);
});

test('feudPairKey is order-independent', () => {
  assert.equal(feudPairKey('a', 'b'), feudPairKey('b', 'a'));
});

test('stepFeudArc always adds exactly one note per call, level never regresses, truce only after level 2', () => {
  const s = blankState();
  const a = makePet('a', []); const b = makePet('b', []);
  const key = feudPairKey('a', 'b');
  for (let i = 0; i < 150; i++) {
    const before = s.feudArcs[key] ? s.feudArcs[key].level : 0;
    const notesBefore = s.notes.length;
    const outcome = stepFeudArc(s, key, a, b);
    if (outcome === null) continue;
    assert.equal(s.notes.length, notesBefore + 1);
    const after = s.feudArcs[key].level;
    assert.ok(after >= before);
    if (s.feudArcs[key].truce) assert.ok(after >= 2);
  }
});

test('grudgeStageFor buckets at the documented thresholds', () => {
  assert.equal(grudgeStageFor(0), 0);
  assert.equal(grudgeStageFor(4), 0);
  assert.equal(grudgeStageFor(GRUDGE_STAGE_AT[0]), 1);
  assert.equal(grudgeStageFor(GRUDGE_STAGE_AT[1]), 2);
  assert.equal(grudgeStageFor(GRUDGE_STAGE_AT[2]), 3);
});

test('checkGrudgeEscalation only fires once per stage and reduces bond', () => {
  const s = blankState();
  const pet = makePet('a', [], { grudges: GRUDGE_STAGE_AT[0], bond: 10 });
  s.pets.push(pet);
  assert.equal(checkGrudgeEscalation(s, pet), true);
  assert.equal(pet.grudgeStage, 1);
  assert.equal(pet.bond, 9);
  assert.equal(checkGrudgeEscalation(s, pet), false);
  assert.equal(pet.bond, 9);
});

test('checkinStreak: first check-in is 1, same day is a no-op, next day increments, a gap resets to 1', () => {
  const s = blankState();
  assert.deepEqual(checkinStreak(s, localHour(10, 1)), { streak: 1, isNewDay: true });
  assert.deepEqual(checkinStreak(s, localHour(20, 1)), { streak: 1, isNewDay: false });
  assert.equal(checkinStreak(s, localHour(9, 2)).streak, 2);
  assert.equal(checkinStreak(s, localHour(9, 5)).streak, 1);
});

test('checkAchievements unlocks first-arrival exactly once', () => {
  const s = blankState();
  s.pets.push(makePet('a', []));
  const unlocked = checkAchievements(s);
  assert.ok(unlocked.some(a => a.id === 'first-arrival'));
  assert.ok(s.achievements.includes('first-arrival'));
  assert.equal(checkAchievements(s).some(a => a.id === 'first-arrival'), false);
});

test('every achievement has a unique id and a check function', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  ACHIEVEMENTS.forEach(a => assert.equal(typeof a.check, 'function'));
});
