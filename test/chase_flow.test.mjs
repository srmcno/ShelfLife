import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newChase, updateChase, jumpChase, dashChase,
  DASH_COOLDOWN, FINALE_AT, FINALE_BONUS, FINALE_WARNING_SECONDS, CHASE_CEILING
} from '../src/engine/chase.js';

const pet = () => ({ id: 'flow', traits: [], art: { body: '', stamps: [] }, bond: 1 });
function scene() {
  const game = newChase(pet(), { seed: 47 });
  for (const key of ['nextCrumb', 'nextBunny', 'nextMoth', 'nextBiscuit', 'nextSugar']) game[key] = 100;
  return game;
}
const crumb = (id, x = 160) => ({ id, kind: 'crumb', x, z: 27, vy: 0, age: 0, floorTime: 0 });
const bunny = (id, x = 160) => ({ id, kind: 'bunny', x, z: 10, vx: 90, age: 0, dodged: false });

test('dash commits to a direction, crosses dust safely, and cannot be spammed', () => {
  const game = scene(); game.player.x = 80;
  game.items = [bunny(1, 110), bunny(2, 140)];
  assert.equal(dashChase(game, 1), true);
  assert.equal(dashChase(game, -1), false);
  assert.equal(game.player.dashCooldown, DASH_COOLDOWN);
  const events = updateChase(game, { axis: -1 }, .18);
  assert.ok(game.player.x > 160, 'steering cannot reverse a burst midway');
  assert.equal(game.bumps, 0);
  assert.equal(game.dashSmashes, 2);
  assert.equal(events.filter(e => e.type === 'dashSmash').length, 2);
  assert.equal(game.dashes, 1);
  for (let n = 0; n < 12; n++) updateChase(game, {}, .2);
  assert.equal(dashChase(game, -1), true);
  updateChase(game, {}, .2);
  assert.ok(game.player.x < 90, 'a second deliberate burst goes left');
  game.finished = true;
  assert.equal(dashChase(game), false);
});

test('catching during cooldown earns a quicker dash without changing catch points', () => {
  const active = scene(), waiting = scene();
  dashChase(active); dashChase(waiting);
  updateChase(active, {}, .2); updateChase(waiting, {}, .2);
  active.items = [crumb(1, active.player.x)];
  updateChase(active, {}, 1 / 60); updateChase(waiting, {}, 1 / 60);
  assert.equal(active.caught, 1);
  assert.equal(active.score, 10);
  assert.ok(waiting.player.dashCooldown - active.player.dashCooldown > .15);
});

test('a near-landing hop press is buffered once, while an early midair press is not', () => {
  const game = scene(); game.player.z = 10; game.player.vy = -140;
  assert.equal(jumpChase(game, { buffer: true }), false);
  const events = updateChase(game, {}, .1);
  assert.equal(events.filter(e => e.type === 'bufferedJump').length, 1);
  assert.ok(game.player.vy > 0);
  assert.equal(game.player.jumpBuffer, 0);
  const later = [];
  for (let n = 0; n < 10; n++) later.push(...updateChase(game, {}, .1));
  assert.equal(later.some(e => e.type === 'bufferedJump'), false);
  assert.equal(game.player.z, 0);
  game.player.z = 90; game.player.vy = -20;
  jumpChase(game, { buffer: true });
  assert.equal(game.player.jumpBuffer, 0);
});

test('one missed crumb trims a streak, while colliding with dust still breaks it', () => {
  const game = scene(); game.combo = 9; game.bestCombo = 9;
  game.items = [{ ...crumb(1, 40), z: 10, floorTime: 1.5 }];
  updateChase(game, {}, 1 / 60);
  assert.equal(game.combo, 7);
  assert.equal(game.bestCombo, 9);
  game.items = [bunny(2)];
  updateChase(game, {}, 1 / 60);
  assert.equal(game.combo, 0);
});

test('new dust bunnies give an actionable warning before moving or colliding', () => {
  const game = scene(); game.nextBunny = 0;
  updateChase(game, {}, 1 / 60);
  const dust = game.items.find(item => item.kind === 'bunny');
  const entry = dust.x; game.player.x = dust.vx > 0 ? 26 : 294;
  updateChase(game, {}, .25);
  assert.equal(dust.x, entry);
  assert.ok(dust.warning > 0);
  assert.equal(game.bumps, 0);
  updateChase(game, {}, .25);
  assert.notEqual(dust.x, entry);
});

function finaleRun(useDash, dt = 1 / 60) {
  const game = scene(); game.time = FINALE_AT - .01; game.player.x = 52;
  const events = updateChase(game, {}, 1 / 60);
  jumpChase(game);
  let elapsed = 0, dashed = false;
  while (elapsed < 1.5) {
    if (useDash && !dashed && elapsed >= .16) { dashChase(game, 1); dashed = true; }
    events.push(...updateChase(game, { axis: 1 }, dt)); elapsed += dt;
  }
  return { game, events };
}

test('a deliberate hop and dash can sweep all five gold and earns its bonus once', () => {
  const { game, events } = finaleRun(true);
  assert.equal(events.filter(e => e.type === 'finale').length, 1);
  assert.equal(game.finaleCaught, 5);
  assert.equal(game.finaleComplete, true);
  const bonuses = events.filter(e => e.type === 'finaleComplete');
  assert.equal(bonuses.length, 1);
  assert.equal(bonuses[0].points, FINALE_BONUS);
  assert.equal(game.score, events.filter(e => e.type === 'catch').reduce((sum, e) => sum + e.points, 0) + FINALE_BONUS);
  const plain = finaleRun(false).game;
  assert.ok(plain.finaleCaught < game.finaleCaught, 'the burst changes which targets can be reached during this hop');
  const fasterFrames = finaleRun(true, 1 / 30).game;
  assert.equal(fasterFrames.finaleCaught, game.finaleCaught);
  assert.equal(fasterFrames.score, game.score);
});

test('ignoring the optional final sweep neither resets a streak nor grants idle catches', () => {
  const game = scene(); game.time = FINALE_AT - .01; game.combo = 8;
  const events = [];
  while (!game.finished) events.push(...updateChase(game, {}, .25));
  assert.equal(game.caught, 0);
  assert.equal(game.combo, 8);
  assert.equal(game.finaleComplete, false);
  assert.equal(events.some(e => e.type === 'miss'), false);
  assert.equal(game.items.some(item => item.finale), false);
});

test('the final sweep gives advance notice and remains catchable until the buzzer', () => {
  const game = scene(); game.time = FINALE_AT - FINALE_WARNING_SECONDS - .01;
  assert.equal(updateChase(game, {}, 1 / 60).filter(e => e.type === 'finaleWarning').length, 1);
  const events = [];
  while (game.time < 21.2) events.push(...updateChase(game, {}, .1));
  assert.equal(events.some(e => e.type === 'finaleWarning'), false, 'the warning only fires once');
  assert.equal(game.items.filter(item => item.finale).length, 5, 'the targets no longer vanish before the clock expires');
  game.player.x = 52;
  assert.ok(updateChase(game, {}, 1 / 60).some(e => e.type === 'catch' && e.finale));
  assert.equal(game.finaleCaught, 1, 'turning back late can rescue a missed final crumb');
  while (!game.finished) updateChase(game, {}, .1);
  assert.equal(game.items.some(item => item.finale), false);
});

test('a biscuit reaching the floor crumbles rather than counting as a whole catch', () => {
  const game = scene();
  game.items = [{ id: 1, kind: 'biscuit', x: 160, z: 10.1, vy: -42, age: 0 }];
  const events = updateChase(game, {}, 1 / 60);
  assert.equal(events.filter(e => e.type === 'crumble').length, 1);
  assert.equal(events.some(e => e.type === 'catch'), false);
  assert.equal(game.biscuits, 0); assert.equal(game.score, 0);
});

test('winged moon jumps with upgrades keep the whole resident in view and still land', () => {
  for (const venue of ['shelf', 'pantry', 'moon']) for (const upgraded of [false, true]) {
    const resident = pet(); resident.art.stamps = [{ kind: 'wing' }];
    const game = newChase(resident, { venue, seed: 3 });
    for (const key of ['nextCrumb', 'nextBunny', 'nextMoth', 'nextBiscuit', 'nextSugar']) game[key] = 100;
    if (upgraded) game.upgrades.push('spring');
    jumpChase(game);
    let peak = 0, flapped = false;
    for (let frame = 0; frame < 240; frame++) {
      if (!flapped && game.player.z > 30 && game.player.vy < 140) flapped = jumpChase(game);
      updateChase(game, { axis: 1 }, 1 / 60); peak = Math.max(peak, game.player.z);
      assert.ok(game.player.z <= CHASE_CEILING, venue + ' keeps the whole sprite on screen');
    }
    assert.equal(flapped, true); assert.ok(peak > 70, 'wings still have useful reach');
    assert.equal(game.player.z, 0); assert.equal(game.player.x, 294, 'the ceiling never stops horizontal steering');
  }
});
