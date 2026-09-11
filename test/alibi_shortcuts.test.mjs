import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alibiShortcut } from '../src/ui/play.js';
import { newAlibi, currentRound, answerAlibi, advanceAlibi } from '../src/engine/alibi.js';
import { blankState } from '../src/state.js';

function game(mode = 'prove') {
  const state = blankState();
  const pet = { id: 'p1', name: 'Dot', traits: [], bond: 1, needs: { food: 70, fuss: 60, clean: 80 } };
  state.pets = [pet]; state.slots[0] = pet.id;
  return newAlibi(state, pet, () => .3, { mode });
}

test('Alibi statements use numbers and evidence uses letters without changing the current round', () => {
  const live = game(), before = structuredClone(live);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(alibiShortcut({ key: String(i + 1) }, live), { type: 'statement', index: i });
    for (const key of [String.fromCharCode(65 + i), String.fromCharCode(97 + i)]) {
      assert.deepEqual(alibiShortcut({ key }, live), { type: 'evidence', index: i });
    }
  }
  assert.deepEqual(live, before, 'selection shortcuts never submit testimony');
  assert.equal(alibiShortcut({ key: 'a' }, game('quick')), null);
  assert.deepEqual(alibiShortcut({ key: '2' }, game('quick')), { type: 'statement', index: 1 });
});

test('shortcuts respect text entry, browser commands, key repeats and completed testimony', () => {
  const live = game();
  for (const values of [
    { repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true },
    { target: { closest: () => ({}) } }
  ]) {
    assert.equal(alibiShortcut({ key: '2', ...values }, live), null);
    assert.equal(alibiShortcut({ key: 'B', ...values }, live), null);
  }
  for (const key of ['0', '4', 'd', 'Enter', 'Escape']) assert.equal(alibiShortcut({ key }, live), null);
  assert.equal(alibiShortcut({ key: '1' }, null), null);
  let round = currentRound(live);
  answerAlibi(live, round.lie, round.proof);
  assert.equal(alibiShortcut({ key: '1' }, live), null);
  assert.equal(alibiShortcut({ key: 'A' }, live), null);
  assert.equal(advanceAlibi(live), true);
  assert.deepEqual(alibiShortcut({ key: 'A' }, live), { type: 'evidence', index: 0 });
  while (!live.complete) { round = currentRound(live); answerAlibi(live, round.lie, round.proof); advanceAlibi(live); }
  assert.equal(alibiShortcut({ key: '1' }, live), null);
});
