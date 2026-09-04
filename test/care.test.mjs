import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careFor, doRounds, CARE_GAIN } from '../src/engine/care.js';
import { blankState, defaultNeeds } from '../src/state.js';

function localHour(h) { return new Date(2024, 0, 1, h, 0, 0).getTime(); }

function makePet(overrides = {}) {
  return { id: 'p1', name: 'Test', traits: [], needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...overrides };
}

test('careFor raises the targeted need and returns a message prefixed with the pet name', () => {
  const s = blankState();
  const pet = makePet({ needs: { food: 40, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  const result = careFor(s, pet, 'food', localHour(12));
  assert.equal(pet.needs.food, 40 + CARE_GAIN.food);
  assert.ok(result.message.startsWith('Test: '));
});

test('careFor grants reduced gain when the need is already high (overfed path)', () => {
  const s = blankState();
  const pet = makePet({ needs: { food: 85, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  careFor(s, pet, 'food', localHour(12));
  assert.equal(pet.needs.food, 85 + Math.round(CARE_GAIN.food * 0.25));
});

test('careFor grants reduced gain for a sleeping nocturnal pet', () => {
  const s = blankState();
  const pet = makePet({ traits: ['nocturnal'], needs: { food: 40, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  careFor(s, pet, 'food', localHour(12)); // daytime -> nocturnal pet is asleep
  assert.equal(pet.needs.food, 40 + Math.round(CARE_GAIN.food * 0.5));
});

test('careFor awards bond exactly every third care below the 72 threshold', () => {
  const s = blankState();
  const pet = makePet({ needs: { food: 10, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  let gains = [];
  for (let i = 0; i < 3; i++) {
    pet.needs.food = 10;
    gains.push(careFor(s, pet, 'food', localHour(12)).bondGained);
  }
  assert.deepEqual(gains, [false, false, true]);
  assert.equal(pet.bond, 1);
});

test('doRounds returns null with no pets, otherwise bumps every need and adds a note', () => {
  const empty = blankState();
  assert.equal(doRounds(empty, localHour(12)), null);

  const s = blankState();
  const pet = makePet({ needs: { food: 50, fuss: 50, clean: 50 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  const result = doRounds(s, localHour(12));
  assert.equal(pet.needs.food, 63);
  assert.ok(typeof result.message === 'string' && result.message.length > 0);
  assert.equal(s.notes.length, 1);
});
