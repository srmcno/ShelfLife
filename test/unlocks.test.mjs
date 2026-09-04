import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalBond, unlockedStampKinds, checkUnlocks } from '../src/engine/unlocks.js';
import { BASE_STAMPS, UNLOCK_STAMPS } from '../src/art/stamps.js';
import { blankState, defaultNeeds } from '../src/state.js';

function makePet(bond) {
  return { id: 'p' + Math.random(), name: 'T', traits: [], needs: defaultNeeds(), bond, cared: 0, grudges: 0, grudgeStage: 0 };
}

test('totalBond sums bond across all pets', () => {
  const s = blankState();
  s.pets.push(makePet(3), makePet(7));
  assert.equal(totalBond(s), 10);
});

test('unlockedStampKinds only includes base stamps below the first threshold', () => {
  const s = blankState();
  s.pets.push(makePet(5));
  const kinds = unlockedStampKinds(s);
  BASE_STAMPS.forEach(k => assert.ok(kinds.includes(k)));
  UNLOCK_STAMPS.forEach(u => u.stamps.forEach(k => assert.ok(!kinds.includes(k))));
});

test('unlockedStampKinds includes a tier once bond meets its threshold', () => {
  const s = blankState();
  const firstTier = UNLOCK_STAMPS[0];
  s.pets.push(makePet(firstTier.at));
  const kinds = unlockedStampKinds(s);
  firstTier.stamps.forEach(k => assert.ok(kinds.includes(k)));
});

test('checkUnlocks fires once per threshold and is idempotent after that', () => {
  const s = blankState();
  const firstTier = UNLOCK_STAMPS[0];
  s.pets.push(makePet(firstTier.at));
  const first = checkUnlocks(s);
  assert.equal(first.length, 1);
  assert.equal(s.notes.length, 1);
  const second = checkUnlocks(s);
  assert.equal(second.length, 0);
  assert.equal(s.notes.length, 1);
});
