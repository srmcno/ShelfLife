import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { newHandshake, tapHandshake, rewardHandshake, handshakePattern, handshakeMemory, handshakeReaction, restartHandshake, replayHandshake } from '../src/engine/play.js';
import { newChase, updateChase, jumpChase, chaseContractOptions, selectChaseContract, selectChaseUpgrade, advanceChaseWave, chaseWaveContract, chaseStars } from '../src/engine/chase.js';
import { createChaseInput, wireChaseAction } from '../src/ui/chase.js';

const now = new Date(2026, 8, 13, 12).getTime();
function fixture() {
  const state = blankState(); state.lastTick = now;
  const pet = { id: 'ritual-resident', name: 'Turnip', traits: ['clingy'], bond: 25, needs: { food: 100, fuss: 100, clean: 100 }, art: { body: '', stamps: [] } };
  state.pets = [pet]; state.slots[0] = pet.id;
  return { state, pet };
}
function finishHandshake(game) {
  while (!game.complete) for (const gesture of handshakePattern(game)) tapHandshake(game, gesture);
}
function intermission(game) { while (!game.awaitingChoice && !game.finished) updateChase(game, {}, .25); }

test('each ritual learns only after completion, keeps its actual opening after rename/reload, and changes later moves', () => {
  for (const ritual of ['echo', 'mirror', 'duet']) {
    const { state, pet } = fixture();
    const game = newHandshake(pet, () => .26, { ritual });
    assert.equal(handshakeMemory(pet, ritual), null);
    tapHandshake(game, handshakePattern(game)[0]);
    assert.equal(rewardHandshake(state, game, now), null);
    assert.equal(handshakeMemory(pet, ritual), null, 'an abandoned lesson cannot create a historical claim');
    game.cursor = 0; finishHandshake(game); rewardHandshake(state, game, now);
    const memory = handshakeMemory(pet, ritual), opening = memory.opening.slice();
    assert.deepEqual(opening, game.sequence.slice(0, ritual === 'duet' ? 4 : 2));
    pet.name = 'Turnip the Second';
    const restored = normalizeState(state).pets[0], lesson = newHandshake(restored, () => .99, { ritual, encore: true });
    assert.equal(lesson.familiar, true); assert.deepEqual(lesson.sequence.slice(0, opening.length), opening);
    assert.ok(lesson.sequence.slice(opening.length).every(move => move === 3), 'shared opening does not reveal the new later pattern');
    assert.equal(restored.name, 'Turnip the Second');
    assert.equal(handshakeMemory(restored, ritual).completions, 1);
    assert.deepEqual(restartHandshake(lesson).sequence, lesson.sequence, 'exact replay keeps the whole course');
  }
});

test('capped or sleeping practice still develops a personal ritual once without farming care', () => {
  const { state, pet } = fixture(); pet.traits = ['nocturnal'];
  const game = newHandshake(pet, () => .6, { ritual: 'duet', encore: true }); finishHandshake(game);
  const needs = { ...pet.needs }, result = rewardHandshake(state, game, now);
  assert.equal(result.practice, true); assert.equal(pet.bond, 25); assert.deepEqual(pet.needs, needs);
  assert.equal(handshakeMemory(pet, 'duet').completions, 1);
  assert.equal(rewardHandshake(state, game, now), null);
  assert.equal(handshakeMemory(pet, 'duet').completions, 1, 'repeat claim cannot manufacture shared lessons');
  const again = newHandshake(pet, () => .1, { ritual: 'duet' });
  tapHandshake(again, (handshakePattern(again)[0] + 1) % 4); replayHandshake(again); finishHandshake(again);
  rewardHandshake(state, again, now);
  assert.equal(handshakeMemory(pet, 'duet').completions, 2); assert.equal(handshakeMemory(pet, 'duet').clean, 1);
});

test('old saves never acquire an invented opening and malformed remembered moves are rejected', () => {
  const { state, pet } = fixture(); pet.handshakes = 25;
  assert.equal(handshakeMemory(normalizeState(state).pets[0]), null);
  pet.handshakeRituals = { echo: { opening: [9, 0], completions: 8 }, mirror: { opening: [0, 1], completions: 2, clean: 99, at: now }, duet: { opening: [0, 1], completions: 3 }, fake: { opening: [0, 1], completions: 1 } };
  const restored = normalizeState(state).pets[0];
  assert.deepEqual(Object.keys(restored.handshakeRituals), ['mirror']);
  assert.equal(restored.handshakeRituals.mirror.clean, 2);
  assert.equal(handshakeMemory(restored, 'echo'), null);
  assert.notEqual(handshakeReaction({ traits: ['spiteful'] }), handshakeReaction({ traits: ['clingy'] }));
});

test('contract choices are reversible while the clock is stopped, then lock for the act', () => {
  const { pet } = fixture(), game = newChase(pet, { format: 'run', seed: 22 });
  assert.equal(selectChaseContract(game, 'floor'), false); intermission(game);
  const options = chaseContractOptions(game, 1);
  assert.deepEqual(options.map(option => [option.id, option.stat, option.bonus]), [['house', 'biscuits', 75], ['floor', 'caught', 55]]);
  assert.equal(selectChaseContract(game, 'floor'), true); assert.equal(selectChaseContract(game, 'house'), true);
  assert.equal(selectChaseContract(game, 'floor'), true); assert.equal(selectChaseContract(game, 'air'), false);
  assert.equal(advanceChaseWave(game), false, 'a contract alone cannot skip the equipment choice');
  selectChaseUpgrade(game, 'salvage'); assert.equal(game.time, 18);
  assert.equal(advanceChaseWave(game), true); assert.equal(chaseWaveContract(game).id, 'floor');
  assert.equal(chaseWaveContract(game).progress, 0, 'the previous act cannot prepay the new contract');
  assert.equal(selectChaseContract(game, 'house'), false, 'cannot switch to an already-met objective during play');
});

test('alternate contract bonuses depend on this act, award once, and still satisfy three-star requirements', () => {
  const { pet } = fixture(), game = newChase(pet, { format: 'run', seed: 7 });
  intermission(game); selectChaseContract(game, 'floor'); advanceChaseWave(game, 'salvage');
  game.caught += chaseWaveContract(game).target;
  assert.equal(chaseWaveContract(game).done, true);
  intermission(game); assert.equal(game.waveResults[1].bonus, 55);
  const score = game.score; updateChase(game, {}, .25); assert.equal(game.score, score);
  game.airCatches = 19; selectChaseContract(game, 'air'); advanceChaseWave(game, 'spring');
  assert.equal(chaseWaveContract(game).progress, 0, 'earlier airborne catches are excluded');
  game.airCatches += chaseWaveContract(game).target;
  intermission(game); assert.equal(game.finished, true); assert.equal(game.waveResults[2].bonus, 70);
  game.waveResults[0].bonus = 50; game.caught = game.goal + 12; game.score = game.goal * 60;
  assert.equal(chaseStars(game), 3, 'choosing a smaller contract does not secretly disqualify the top rating');
});

test('older in-memory runs retain original contracts without touching existing score or setup', () => {
  const { pet } = fixture(), game = newChase(pet, { format: 'run', seed: 7 }); delete game.contracts; delete game.pendingContract;
  assert.equal(chaseWaveContract(game).stat, 'caught'); intermission(game); advanceChaseWave(game, 'boots');
  assert.equal(chaseWaveContract(game).stat, 'biscuits'); assert.equal(chaseWaveContract(game).bonus, 75);
  intermission(game); advanceChaseWave(game, 'spring');
  assert.equal(chaseWaveContract(game).stat, 'finaleCaught'); assert.equal(chaseWaveContract(game).bonus, 100);
});

test('touch Hop and a second held direction advance horizontal and vertical simulation together', () => {
  const { pet } = fixture(), game = newChase(pet, { seed: 7 }), input = createChaseInput(), hop = new EventTarget();
  input.hold('pointer:1', 'right'); wireChaseAction(hop, () => jumpChase(game, { buffer: true }), () => true);
  const press = new Event('pointerdown', { cancelable: true }); Object.assign(press, { button: 0, pointerId: 2 }); hop.dispatchEvent(press);
  updateChase(game, { axis: input.axis }, .1);
  assert.ok(game.player.x > 170); assert.ok(game.player.z > 20);
  hop.dispatchEvent(new Event('pointercancel')); assert.equal(input.axis, 1, 'cancelling the jump finger cannot release the movement finger');
  input.release('pointer:1'); assert.equal(input.axis, 0);
});
