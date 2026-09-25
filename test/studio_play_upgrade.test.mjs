import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreature, customizeCreature, SLOT_KEYS } from '../src/art/creatures.js';
import { remixCreature } from '../src/art/studio-model.js';
import { blankState, normalizeState } from '../src/state.js';

const pet = () => ({ id: 'p', name: 'Pip', traits: [], bond: 1, needs: {food:70,fuss:70,clean:70}, art: { body: '', stamps: [] } });

test('remixing preserves locked anatomy, custom colours and tuned face without mutating its source', () => {
  const source = customizeCreature(generateCreature({seed: 'original'}), { tune: {eyeScale:1.3,lean:6}, colors:{body:'#993355',accent:'#228855'} });
  const before = JSON.stringify(source);
  const locks = ['body', 'eyes', 'legs', 'palette'];
  const remixes = Array.from({length:10}, (_, i) => remixCreature(source, locks, 'remix-' + i));
  for (const result of remixes) {
    assert.equal(result.body, source.body);
    assert.equal(result.parts.eyes, source.parts.eyes);
    assert.equal(result.parts.legs, source.parts.legs);
    assert.equal(result.palette, source.palette);
    assert.deepEqual(result.colors, source.colors);
    assert.deepEqual(result.tune, source.tune);
    assert.notEqual(result.rig, source.rig, 'rig is rebuilt, not shared with undo history');
  }
  assert.ok(remixes.some(result => SLOT_KEYS.some(key => !locks.includes(key) && result.parts[key] !== source.parts[key])));
  assert.equal(JSON.stringify(source), before);
  assert.equal(remixCreature(source, ['body'], 'new-colours').colors, undefined, 'unlocked palette clears custom overrides');
});

test('keeping every feature survives remixing, including explicit absent body parts', () => {
  const source = generateCreature({seed:'none',parts:{wings:'none',tail:'none',arms:'none'}});
  const result = remixCreature(source, new Set(['body','palette',...SLOT_KEYS]), 'fully-pinned');
  assert.equal(result.body, source.body);
  assert.deepEqual(result.parts, source.parts);
  assert.equal(result.palette, source.palette);
});
