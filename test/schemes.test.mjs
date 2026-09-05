import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { SCHEMES } from '../src/content/schemes.js';
import { advanceSchemes, currentScheme, resolveScheme, SCHEME_WAIT, SCHEME_DEADLINE } from '../src/engine/schemes.js';
import { resolveMotion } from '../src/art/anatomy.js';
import { capabilitiesOf } from '../src/engine/behavior.js';
import { BASE_STAMPS, STAMP_SVG } from '../src/art/stamps.js';
const now = new Date(2026, 8, 4, 12).getTime();
function shelf() {
  const s = blankState();
  s.lastTick = now;
  s.pets = [{ id: 'p1', name: 'Small Kevin', traits: [], needs: { food: 70, fuss: 70, clean: 70 }, bond: 0, cared: 0 }];
  s.slots[0] = 'p1';
  return s;
}
test('schemes start only when a resident is awake and persist through a save round trip', () => {
  assert.equal(advanceSchemes(blankState(), now), false);
  const s = shelf(); s.pets[0].traits = ['nocturnal'];
  assert.equal(advanceSchemes(s, now), false);
  s.pets[0].traits = [];
  assert.equal(advanceSchemes(s, now), true);
  const n = normalizeState(s);
  assert.equal(currentScheme(n).pet.id, 'p1');
  assert.equal(currentScheme(n).kind, currentScheme(s).kind);
});
test('a choice applies precisely the advertised tradeoff, awards trust once, and leaves a note', () => {
  const s = shelf(); advanceSchemes(s, now);
  const choice = currentScheme(s).definition.choices[0];
  const before = { ...s.pets[0].needs };
  const result = resolveScheme(s, 0, now);
  for (const key of Object.keys(before)) assert.equal(s.pets[0].needs[key], before[key] + (choice.changes[key] || 0));
  assert.equal(s.pets[0].bond, choice.bond);
  assert.equal(s.notes[0].text, result.text);
  assert.ok(result.text.includes('Small Kevin'));
  assert.equal(resolveScheme(s, 0, now), null);
  assert.equal(s.pets[0].bond, choice.bond);
});
test('unsupervised plots resolve once on return without cascading through missed plans', () => {
  const s = shelf(); advanceSchemes(s, now);
  assert.equal(advanceSchemes(s, now + SCHEME_DEADLINE - 1), false);
  assert.equal(advanceSchemes(s, now + 48 * 3600000), true);
  assert.equal(s.schemes.completed, 1);
  assert.equal(s.pets[0].bond, 0);
  assert.equal(currentScheme(s), null);
  assert.equal(advanceSchemes(s, now + 48 * 3600000 + 1), false);
  for (const need of Object.values(s.pets[0].needs)) assert.ok(need >= 0 && need <= 100);
});
test('plans rotate without repetition and respect the cooldown', () => {
  const s = shelf(), kinds = [];
  let t = now;
  for (let i = 0; i < SCHEMES.length; i++) {
    assert.equal(advanceSchemes(s, t), true);
    kinds.push(currentScheme(s).kind);
    resolveScheme(s, 1, t);
    assert.equal(advanceSchemes(s, t + SCHEME_WAIT - 1), false);
    t += SCHEME_WAIT;
  }
  assert.equal(new Set(kinds).size, SCHEMES.length);
});
test('removed residents and malformed plan data do not break the shelf', () => {
  const s = shelf(); advanceSchemes(s, now); s.pets = [];
  assert.equal(advanceSchemes(s, now), true);
  assert.equal(currentScheme(s), null);
  for (const malformed of [null, [], { active: { kind: 'absent' } }, { active: { kind: 'raisin', at: 'bad' } }]) {
    s.schemes = malformed;
    assert.doesNotThrow(() => advanceSchemes(s, now));
  }
});
test('scheme text uses only real cast placeholders and stays within a readable length', () => {
  assert.equal(new Set(SCHEMES.map(s => s.id)).size, SCHEMES.length);
  for (const s of SCHEMES) {
    assert.equal(s.choices.length, 2);
    for (const text of [s.intro, s.autonomous, ...s.choices.map(c => c.outcome)]) {
      assert.ok(text.length <= 200, text);
      assert.ok(text.includes('{p}'), text);
      assert.doesNotMatch(text.replaceAll('{p}', ''), /[{}]/);
    }
  }
});
test('hand-drawn arms and legs enable real limb animation and physical behaviour', () => {
  const pet = { art: { body: '', stamps: [{ kind: 'arms' }, { kind: 'legs' }] } };
  const motion = resolveMotion(pet);
  assert.equal(motion.arms, 2); assert.equal(motion.legs, 2);
  assert.equal(motion.canHang, true); assert.equal(motion.canSneak, true);
  assert.equal(capabilitiesOf(pet).hang, true);
  for (const [kind, part] of [['arms', 'arm'], ['legs', 'leg']]) {
    assert.ok(BASE_STAMPS.includes(kind));
    assert.equal((STAMP_SVG[kind].match(new RegExp('data-part="' + part + '"', 'g')) || []).length, 2);
    assert.ok(STAMP_SVG[kind].includes('data-pivot-x'));
  }
});
