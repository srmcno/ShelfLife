import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChase, updateChase, advanceChaseWave, CHASE_SECONDS } from '../src/engine/chase.js';

const pet = { id: 'clock', traits: [], art: { body: '', stamps: [] }, bond: 1 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' should equal ' + expected);

function quickRun(schedule) {
  const game = newChase(pet, { seed: 11 }), events = [];
  let wall = 0, frames = 0;
  while (wall < CHASE_SECONDS - 1e-8) {
    const elapsed = Math.min(schedule[frames++ % schedule.length], CHASE_SECONDS - wall);
    events.push(...updateChase(game, { axis: 1 }, elapsed));
    wall += elapsed;
    close(game.time, wall);
    if (wall < CHASE_SECONDS - 1e-8) assert.equal(game.finished, false);
  }
  assert.equal(game.finished, true); assert.equal(game.time, CHASE_SECONDS);
  return { game, events };
}

for (const schedule of [[.5], [1], [1.5], [.5, 1, 1.5]]) test('a 22-second chase keeps wall time at frame intervals ' + schedule.join(', '), () => {
  const reference = quickRun([1 / 60]), slow = quickRun(schedule);
  for (const field of ['time', 'score', 'caught', 'bumps', 'dodged', 'stolen', 'bestCombo', 'complete']) {
    assert.equal(slow.game[field], reference.game[field], field + ' remains independent of rendering cadence');
  }
  assert.deepEqual(slow.events, reference.events);
  assert.equal(slow.events.filter(event => event.type === 'finish').length, 1);
});

function collisionScene() {
  const game = newChase(pet, { seed: 1 }); game.player.x = 26;
  for (const key of ['nextCrumb', 'nextBunny', 'nextMoth', 'nextBiscuit', 'nextSugar']) game[key] = 100;
  // Moving right crosses the resting crumb and the oncoming dust bunny before
  // 1.5 seconds. A large single physics step would skip those intersections.
  game.items = [
    { id: 1, kind: 'crumb', x: 160, z: 27, vy: 0, age: 0, floorTime: 0 },
    { id: 2, kind: 'bunny', x: 280, z: 10, vx: -90, age: 0, dodged: false }
  ];
  return game;
}

test('catch-up still resolves collisions along the travelled path in small physics steps', () => {
  const reference = collisionScene(), slow = collisionScene(), events = [];
  for (let i = 0; i < 90; i++) events.push(...updateChase(reference, { axis: 1 }, 1 / 60));
  const catchup = updateChase(slow, { axis: 1 }, 1.5);
  assert.equal(slow.caught, 1); assert.equal(slow.bumps, 1); assert.equal(slow.score, 5);
  assert.deepEqual(catchup, events);
  close(slow.player.x, reference.player.x); close(slow.time, 1.5);
});

test('a frame that crosses an act boundary stops at the intermission without simulating the next act', () => {
  const game = newChase(pet, { seed: 9, format: 'run' });
  for (let i = 0; i < 71; i++) updateChase(game, {}, .25);
  close(game.time, 17.75);
  const events = updateChase(game, {}, 1.5);
  assert.equal(game.time, 18); assert.equal(game.wave, 0); assert.equal(game.awaitingChoice, true);
  assert.equal(game.waveResults.length, 1); assert.equal(game.finished, false);
  assert.equal(events.filter(event => event.type === 'intermission').length, 1);
  assert.deepEqual(updateChase(game, {}, 60), []);
  assert.equal(game.time, 18); assert.equal(game.waveResults.length, 1);
  assert.equal(advanceChaseWave(game, 'boots'), true);
  updateChase(game, {}, .5);
  close(game.time, 18.5);
});

test('a foreground freeze requests an explicit pause without consuming time, input, collisions or rewards', () => {
  for (const elapsed of [2.001, 3, 60, 3600]) {
    const game = collisionScene(), before = JSON.stringify(game);
    assert.deepEqual(updateChase(game, { axis: 1 }, elapsed), [{ type: 'pause', reason: 'frame-gap' }]);
    assert.equal(JSON.stringify(game), before);
    // Resuming uses a fresh frame origin; the frozen interval is never owed.
    updateChase(game, { axis: 1 }, 1 / 60);
    close(game.time, 1 / 60);
  }
});

test('the catch-up budget includes two seconds while invalid deltas never enter the simulation', () => {
  const game = newChase(pet, { seed: 3 });
  assert.equal(updateChase(game, {}, 2).some(event => event.type === 'pause'), false);
  close(game.time, 2);
  const before = JSON.stringify(game);
  for (const elapsed of [0, -1, NaN, Infinity, -Infinity]) assert.deepEqual(updateChase(game, {}, elapsed), []);
  assert.equal(JSON.stringify(game), before);
});

test('small frame fractions carry forward while malformed remainders cannot create unbounded work', () => {
  const game = newChase(pet, { seed: 3 });
  updateChase(game, {}, .007); updateChase(game, {}, .007);
  assert.equal(game.time, 0);
  updateChase(game, {}, .007);
  close(game.time, 1 / 60); close(game.frameRemainder, .021 - 1 / 60);
  for (const value of [undefined, NaN, Infinity, -1, 100000, '1']) {
    const malformed = newChase(pet, { seed: 3 }); malformed.frameRemainder = value;
    updateChase(malformed, {}, 1.5);
    close(malformed.time, 1.5);
    assert.ok(malformed.frameRemainder >= 0 && malformed.frameRemainder < 1 / 60);
  }
});
