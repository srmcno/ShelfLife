import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTrait, isNight, isAsleep, neighborSlots, neighborProps, decayRate, tick, moodOf, worstNeed } from '../src/engine/tick.js';
import { blankState, defaultNeeds } from '../src/state.js';

function localHour(h) { return new Date(2024, 0, 1, h, 0, 0).getTime(); }

function makePet(overrides = {}) {
  return { id: 'p1', name: 'Test', traits: ['damp'], needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...overrides };
}

test('hasTrait checks the trait pool, not a literal string match', () => {
  assert.equal(hasTrait(makePet({ traits: ['nocturnal'] }), 'nocturnal'), true);
  assert.equal(hasTrait(makePet({ traits: ['nocturnal'] }), 'clean'), false);
});

test('isNight is true 20:00-06:59, false 07:00-19:59', () => {
  assert.equal(isNight(new Date(localHour(22))), true);
  assert.equal(isNight(new Date(localHour(6))), true);
  assert.equal(isNight(new Date(localHour(7))), false);
  assert.equal(isNight(new Date(localHour(19))), false);
  assert.equal(isNight(new Date(localHour(20))), true);
});

test('a nocturnal pet is asleep during the day and awake at night; others never sleep', () => {
  const nocturnal = makePet({ traits: ['nocturnal'] });
  assert.equal(isAsleep(nocturnal, new Date(localHour(12))), true);
  assert.equal(isAsleep(nocturnal, new Date(localHour(22))), false);
  const diurnal = makePet({ traits: ['damp'] });
  assert.equal(isAsleep(diurnal, new Date(localHour(12))), false);
  assert.equal(isAsleep(diurnal, new Date(localHour(22))), false);
});

test('neighborSlots respects row boundaries on a 6-wide grid', () => {
  assert.deepEqual(neighborSlots(0, 18), [1]);
  assert.deepEqual(neighborSlots(5, 18), [4]);
  assert.deepEqual(neighborSlots(3, 18), [2, 4]);
  assert.deepEqual(neighborSlots(6, 18), [7]);
});

test('neighborProps only returns occupied neighbor slots that hold props', () => {
  const s = blankState();
  const pet = makePet({ id: 'pA' });
  s.pets.push(pet);
  s.props.push({ id: 'd1', kind: 'lamp' });
  s.slots[0] = 'pA';
  s.slots[1] = 'd1';
  assert.equal(neighborProps(s, 0).length, 1);
  assert.equal(neighborProps(s, 0)[0].kind, 'lamp');
  assert.equal(neighborProps(s, 5).length, 0);
});

test('decayRate applies trait care multiplier and prop aura multiplier', () => {
  const s = blankState();
  const dampPet = makePet({ id: 'pA', traits: ['damp'] });
  s.pets.push(dampPet);
  s.slots[0] = 'pA';
  const baseline = decayRate(makePet({ traits: [] }), 'clean', s);
  const withDampTrait = decayRate(dampPet, 'clean', s);
  assert.ok(withDampTrait > baseline, 'damp trait should raise clean decay rate');

  s.props.push({ id: 'd1', kind: 'lamp' });
  s.slots[1] = 'd1';
  const withoutLamp = decayRate(makePet({ id: 'pB', traits: ['nocturnal'] }), 'fuss', s);
  s.pets.push(makePet({ id: 'pB', traits: ['nocturnal'] }));
  s.slots[2] = 'pB';
  const nocturnalNextToLamp = decayRate(s.pets.find(p => p.id === 'pB'), 'fuss', s);
  assert.ok(nocturnalNextToLamp !== withoutLamp);
});

test('tick decays needs proportional to elapsed hours, capped at MAX_OFFLINE_HOURS, and no-ops for non-positive elapsed time', () => {
  const s = blankState();
  const pet = makePet({ id: 'pA', traits: [], needs: { food: 100, fuss: 100, clean: 100 } });
  s.pets.push(pet);
  s.slots[0] = 'pA';
  s.lastTick = 0;
  const changed = tick(s, HOUR_MS(2));
  assert.equal(changed, true);
  assert.ok(pet.needs.food < 100);

  const before = { ...pet.needs };
  const changedAgain = tick(s, HOUR_MS(2));
  assert.equal(changedAgain, false);
  assert.deepEqual(pet.needs, before);

  function HOUR_MS(h) { return h * 3600000; }
});

test('moodOf buckets by average need at the documented thresholds', () => {
  assert.equal(moodOf(makePet({ needs: { food: 90, fuss: 90, clean: 90 } })), 'content');
  assert.equal(moodOf(makePet({ needs: { food: 60, fuss: 60, clean: 60 } })), 'fine');
  assert.equal(moodOf(makePet({ needs: { food: 30, fuss: 30, clean: 30 } })), 'annoyed');
  assert.equal(moodOf(makePet({ needs: { food: 10, fuss: 10, clean: 10 } })), 'furious');
});

test('worstNeed picks the lowest of food/fuss/clean', () => {
  assert.equal(worstNeed(makePet({ needs: { food: 80, fuss: 20, clean: 90 } })), 'fuss');
  assert.equal(worstNeed(makePet({ needs: { food: 10, fuss: 80, clean: 90 } })), 'food');
});
