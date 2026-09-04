import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petLine, autonomy, checkShelf } from '../src/engine/loop.js';
import { blankState, defaultNeeds } from '../src/state.js';

function makePet(id, traits, needs) {
  return { id, name: id, traits, needs: needs || defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0 };
}

test('petLine returns an angry complaint for a furious pet', () => {
  const s = blankState();
  const pet = makePet('a', ['spiteful'], { food: 5, fuss: 5, clean: 5 });
  const line = petLine(s, pet);
  assert.equal(line.kind, 'angry');
  assert.ok(line.text.length > 0);
});

test('petLine does not throw with matureMode on, across many draws', () => {
  const s = blankState();
  s.settings.matureMode = true;
  const pet = makePet('a', ['spiteful'], { food: 5, fuss: 90, clean: 90 });
  for (let i = 0; i < 20; i++) assert.doesNotThrow(() => petLine(s, pet));
});

test('checkShelf on an empty shelf adds exactly one note', () => {
  const s = blankState();
  checkShelf(s, Date.now());
  assert.equal(s.notes.length, 1);
});

test('checkShelf on a populated shelf ticks and never throws', () => {
  const s = blankState();
  const pet = makePet('a', ['spiteful'], { food: 50, fuss: 50, clean: 50 });
  s.pets.push(pet); s.slots[0] = pet.id;
  s.lastTick = Date.now() - 3600000;
  assert.doesNotThrow(() => checkShelf(s, Date.now()));
});

test('autonomy never throws across many randomized trials', () => {
  for (let i = 0; i < 30; i++) {
    const s = blankState();
    s.pets.push(makePet('a', [], { food: 0, fuss: 0, clean: 0 }), makePet('b', [], { food: 90, fuss: 90, clean: 90 }));
    s.slots[0] = 'a'; s.slots[1] = 'b';
    assert.doesNotThrow(() => autonomy(s));
  }
});
