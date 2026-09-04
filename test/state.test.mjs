import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migratePet, blankState, clamp, defaultNeeds, SLOT_COUNT, petById, addNote, onNote } from '../src/state.js';

test('clamp bounds a value', () => {
  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(50, 0, 100), 50);
});

test('blankState has the v4 shape', () => {
  const s = blankState();
  assert.equal(s.v, 4);
  assert.equal(s.slots.length, SLOT_COUNT);
  assert.deepEqual(s.pets, []);
  assert.deepEqual(s.achievements, []);
  assert.deepEqual(s.feudArcs, {});
  assert.equal(s.streak.count, 0);
  assert.equal(s.settings.narratorOn, true);
  assert.equal(s.settings.matureMode, false);
});

test('migratePet upgrades a v3 flattened-image pet', () => {
  const old = { id: 'p1', name: 'Gnash', img: 'data:image/png;base64,AAA', traits: ['spiteful'], needs: defaultNeeds(), bond: 3, cared: 2, grudges: 1 };
  const migrated = migratePet(old);
  assert.equal(migrated.art.body, 'data:image/png;base64,AAA');
  assert.deepEqual(migrated.art.stamps, []);
  assert.equal(migrated.img, undefined);
  assert.equal(migrated.grudgeStage, 0);
});

test('migratePet is idempotent on a v4 pet', () => {
  const v4 = { id: 'p2', name: 'Doreen', art: { body: 'x', stamps: [{ kind: 'eyes', x: 10, y: 10, size: 20, rotation: 0, color: '#fff' }] } };
  assert.equal(migratePet(v4), v4);
});

test('petById finds by id in a given state, not a global', () => {
  const s = blankState();
  s.pets.push({ id: 'p9', name: 'Test' });
  assert.equal(petById(s, 'p9').name, 'Test');
  assert.equal(petById(blankState(), 'p9'), null);
});

test('addNote pushes to the front, caps at 40, and notifies listeners', () => {
  const s = blankState();
  let heard = null;
  onNote(n => { heard = n; });
  addNote(s, 'hello', 'someone', 'note');
  assert.equal(s.notes[0].text, 'hello');
  assert.equal(heard.text, 'hello');
  for (let i = 0; i < 45; i++) addNote(s, 'n' + i, 'x');
  assert.equal(s.notes.length, 40);
});
