import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { statementsFor, newAlibi, answerAlibi, currentRound, advanceAlibi, rewardAlibi } from '../src/engine/alibi.js';
import { generateCreature, selectCreaturePart, BODIES, SLOTS, describeAnatomy, buildRig } from '../src/art/creatures.js';

function shelf() {
  const s = blankState();
  s.pets = [{ id: 'a', name: 'Pip', born: 10, bond: 0, traits: [], needs: { food: 50, fuss: 50, clean: 50 } }];
  s.slots[1] = 'a';
  return s;
}
test('testimony names furniture and never calls an adjacent duplicate kind absent', () => {
  const s = shelf();
  s.props = [{ id: 'near', kind: 'bowl' }, { id: 'far', kind: 'bowl' }];
  s.slots[0] = 'near'; s.slots[5] = 'far';
  const { truths, lies } = statementsFor(s, s.pets[0]);
  assert.ok(truths.find(t => t.key === 'left').text.includes('Bowl'));
  assert.ok(!JSON.stringify({ truths, lies }).includes('undefined'));
  const texts = new Set(truths.map(t => t.text));
  assert.ok(lies.every(l => !texts.has(l.text)));
  assert.ok(lies.filter(l => l.key === 'prop').every(l => !l.text.includes('There is a')));
});
test('same-name residents cannot turn a neighbour lie into a true statement', () => {
  const s = shelf();
  s.pets.push({ id: 'b', name: 'Twin', born: 5 }, { id: 'c', name: 'Twin', born: 15 });
  s.slots[0] = 'b'; s.slots[5] = 'c';
  const { truths, lies } = statementsFor(s, s.pets[0]);
  const texts = new Set(truths.map(t => t.text));
  assert.ok(lies.every(l => !texts.has(l.text)));
});
test('alibi evidence is frozen with each statement and answers cannot spill into another round', () => {
  const s = shelf(), game = newAlibi(s, s.pets[0], () => .4);
  const original = JSON.stringify(game.rounds);
  s.pets[0].bond = 20; s.pets[0].careLog = { food: 100 };
  assert.equal(JSON.stringify(game.rounds), original);
  for (let i = 0; i < game.rounds.length; i++) {
    const round = currentRound(game);
    assert.ok(round.evidence.length > 0);
    assert.equal(answerAlibi(game, round.lie), 'right');
    assert.equal(answerAlibi(game, round.lie), 'ignored');
    assert.equal(game.correct, i + 1);
    if (!game.complete) assert.equal(advanceAlibi(game), true);
  }
  assert.equal(game.correct, game.rounds.length);
});
test('an empty alibi cannot consume a reward cooldown', () => {
  const s = shelf();
  assert.equal(rewardAlibi(s, null), null);
  assert.equal(rewardAlibi(s, { petId: 'a', rounds: [], complete: true }), null);
  assert.equal(s.pets[0].lastPlayed, undefined);
});
test('every catalog option is selectable without rerolling unrelated choices', () => {
  const original = generateCreature({ seed: 'catalog-regression' });
  for (const [slot, library] of [['body', BODIES], ...Object.entries(SLOTS).map(([key, value]) => [key, value.lib])]) {
    for (const id of Object.keys(library)) {
      const selected = selectCreaturePart(original, slot, id);
      assert.equal(slot === 'body' ? selected.body : selected.parts[slot], id);
      assert.equal(selected.palette, original.palette);
      assert.deepEqual(selected.tune, original.tune);
      for (const key of Object.keys(SLOTS)) if (key !== slot) assert.equal(selected.parts[key], original.parts[key]);
      if (slot !== 'body') assert.equal(selected.body, original.body);
      assert.deepEqual(selected.anatomy, describeAnatomy(selected));
      assert.deepEqual(selected.rig, buildRig(selected));
      const restored = selectCreaturePart(selected, slot, slot === 'body' ? original.body : original.parts[slot]);
      assert.deepEqual(restored, original);
    }
  }
});
test('invalid catalog selections preserve the creature', () => {
  const c = generateCreature({ seed: 'invalid-catalog' });
  assert.deepEqual(selectCreaturePart(c, 'wings', 'not-a-wing'), c);
  assert.deepEqual(selectCreaturePart(c, 'not-a-slot', 'none'), c);
});
