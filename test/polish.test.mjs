import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { generateCreature, selectCreaturePart, BODIES, SLOTS, describeAnatomy, buildRig } from '../src/art/creatures.js';

function shelf() {
  const s = blankState();
  s.pets = [{ id: 'a', name: 'Pip', born: 10, bond: 0, traits: [], needs: { food: 50, fuss: 50, clean: 50 } }];
  s.slots[1] = 'a';
  return s;
}
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

// One star is participation, two means the crumb goal was reached.