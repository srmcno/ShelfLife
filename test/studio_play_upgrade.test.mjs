import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreature, customizeCreature, SLOT_KEYS } from '../src/art/creatures.js';
import { remixCreature } from '../src/art/studio-model.js';
import { newChase, updateChase, jumpChase, chaseStarTarget, chaseCoaching, recordChase } from '../src/engine/chase.js';
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

test('repeating a chase seed reproduces the course and score for the same player inputs', () => {
  const first = newChase(pet(), {seed:40123,objective:'air'}), second = newChase(pet(), {seed:40123,objective:'air'});
  for (let frame = 0; !first.finished; frame++) {
    const axis = Math.floor(frame / 80) % 2 ? -1 : 1;
    if (frame % 65 === 0) { jumpChase(first); jumpChase(second); }
    const a = updateChase(first, {axis}, 1/60), b = updateChase(second, {axis}, 1/60);
    assert.deepEqual(a, b);
  }
  assert.equal(first.score, second.score);
  assert.equal(first.caught, second.caught);
  assert.equal(first.objective.id, 'air');
  const different = newChase(pet(), {seed:40124});
  updateChase(different,{},.2);
  const same = newChase(pet(), {seed:40123}); updateChase(same,{},.2);
  assert.notEqual(different.items[0].x, same.items[0].x);
});

test('star guidance names both remaining requirements and matches the real three-star threshold', () => {
  const game = newChase(pet());
  assert.deepEqual(chaseStarTarget(game), {stars:2,crumbs:8,points:0});
  game.caught=8; game.score=200;
  assert.deepEqual(chaseStarTarget(game), {stars:3,crumbs:5,points:160});
  game.caught=13; game.score=360;
  assert.deepEqual(chaseStarTarget(game), {stars:3,crumbs:0,points:0});
  game.bestCombo=8;
  assert.match(chaseCoaching(game), /Three stars earned/);
  const gentle = newChase(pet(), {gentle:true}); gentle.caught=11; gentle.score=270;
  assert.deepEqual(chaseStarTarget(gentle), {stars:3,crumbs:0,points:0});
});

test('a higher star rating is retained independently of a higher course score and survives reloading', () => {
  const p = pet(), first = newChase(p);
  first.finished=true; first.caught=8; first.score=900;
  recordChase(p,first,1000);
  const second = newChase(p); second.finished=true; second.caught=13; second.score=400;
  recordChase(p,second,1001);
  assert.equal(p.chaseRecords.standard.score,900);
  assert.equal(p.chaseRecords.standard.stars,3);
  assert.equal(p.chaseRecords.standard.at,1000);
  const third = newChase(p); third.finished=true; third.caught=8; third.score=1000;
  recordChase(p,third,1002);
  assert.equal(p.chaseRecords.standard.score,1000);
  assert.equal(p.chaseRecords.standard.stars,3);
  const state=blankState(); state.pets=[p]; state.slots[0]=p.id;
  assert.deepEqual(normalizeState(state).pets[0].chaseRecords.standard, p.chaseRecords.standard);
});
