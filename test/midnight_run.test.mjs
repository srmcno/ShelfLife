import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChase, updateChase, advanceChaseWave, jumpChase, dashChase, recordChase, chaseStars, chaseStarTarget, chaseDuration } from '../src/engine/chase.js';
import { rewardHandshake } from '../src/engine/play.js';
import { blankState, normalizeState } from '../src/state.js';

const now = new Date(2026, 8, 5, 12).getTime();
const pet = (kind = '') => ({ id: 'runner', name: 'Crumb', bond: 1, traits: [], art: { body: '', stamps: kind ? [{ kind }] : [] }, needs: { food: 70, fuss: 50, clean: 70 } });
function play(game, active = true, step = 1 / 60) {
  let frames = 0, maxItems = 0;
  while (!game.finished && frames++ < 5000) {
    if (game.awaitingChoice) assert.equal(advanceChaseWave(game, game.wave === 0 ? 'salvage' : 'boots'), true);
    const low = active ? game.items.filter(i => i.kind === 'crumb' || i.kind === 'biscuit').sort((a, b) => a.z - b.z)[0] : null;
    if (active && game.items.some(i => i.kind === 'bunny' && Math.abs(i.x - game.player.x) < 65 || i.kind === 'broom' && i.warning < .3 && Math.abs(i.x - game.player.x) < 80)) jumpChase(game);
    updateChase(game, { targetX: low?.x }, step);
    maxItems = Math.max(maxItems, game.items.length);
  }
  assert.equal(game.finished, true, 'a run reaches a finite result');
  return { game, maxItems };
}
function quiet() {
  const game = newChase(pet(), { format: 'run', seed: 17 });
  for (const name of ['nextCrumb', 'nextBunny', 'nextMoth', 'nextBiscuit', 'nextSugar', 'nextBroom']) game[name] = 100;
  return game;
}
const crumb = (z = 27, x = 160) => ({ id: 1, kind: 'crumb', x, z, vy: 0, age: 0, floorTime: 0 });

test('intermissions stop simulation and cannot be skipped, double-purchased or used for partial rewards', () => {
  const resident = pet(), game = newChase(resident, { format: 'run', seed: 2 });
  const state = blankState(); state.pets = [resident]; state.slots[0] = resident.id;
  assert.equal(advanceChaseWave(game, 'boots'), false);
  while (!game.awaitingChoice) updateChase(game, {}, .25);
  assert.equal(game.time, 18); assert.equal(game.finished, false);
  const frozen = JSON.stringify(game);
  assert.deepEqual(updateChase(game, { axis: 1 }, 10), []);
  assert.equal(jumpChase(game), false); assert.equal(dashChase(game), false);
  assert.equal(JSON.stringify(game), frozen);
  assert.equal(rewardHandshake(state, game, now), null);
  assert.equal(advanceChaseWave(game, 'made-up'), false);
  assert.equal(advanceChaseWave(game, 'boots'), true);
  assert.equal(advanceChaseWave(game, 'salvage'), false);
  assert.equal(game.venue, 'pantry'); assert.equal(game.time, 18);
  while (!game.awaitingChoice) updateChase(game, {}, .25);
  assert.equal(advanceChaseWave(game, 'boots'), false, 'owned upgrades cannot be bought twice');
  assert.equal(advanceChaseWave(game, 'spring'), true);
  assert.equal(game.venue, 'moon'); assert.equal(game.time, 36);
  while (!game.finished) updateChase(game, {}, .25);
  assert.equal(game.time, chaseDuration(game)); assert.equal(game.waveResults.length, 3);
  const end = JSON.stringify(game);
  updateChase(game, {}, 1); assert.equal(advanceChaseWave(game, 'salvage'), false);
  assert.equal(JSON.stringify(game), end);
});

test('midnight upgrades alter distinct player tactics instead of granting free completion', () => {
  const ordinary = quiet(), boots = quiet(); boots.upgrades = ['boots'];
  dashChase(ordinary); dashChase(boots);
  for (let n = 0; n < 8; n++) { updateChase(ordinary, {}, .2); updateChase(boots, {}, .2); }
  assert.equal(dashChase(ordinary), false); assert.equal(dashChase(boots), true);
  const jumping = quiet(), spring = quiet(); spring.upgrades = ['spring'];
  jumpChase(jumping); jumpChase(spring);
  updateChase(jumping, {}, .2); updateChase(spring, {}, .2);
  assert.ok(spring.player.z > jumping.player.z + 7, 'borrowed kneecaps change reach');
  const air = quiet(); air.upgrades = ['spring']; air.player.z = 50; air.items = [crumb(77)];
  updateChase(air, {}, 1 / 60); assert.equal(air.score, 30, 'air score requires actually catching in the air');
  const salvage = quiet(), lost = quiet(); salvage.upgrades = ['salvage'];
  salvage.items = [{ ...crumb(10, 70), floorTime: 1.5 }]; lost.items = [{ ...crumb(10, 70), floorTime: 1.5 }];
  updateChase(salvage, {}, .1); updateChase(lost, {}, .1);
  assert.equal(salvage.items.length, 1); assert.equal(lost.items.length, 0);
  updateChase(salvage, { targetX: 70 }, .25); updateChase(salvage, { targetX: 70 }, .25);
  assert.equal(salvage.caught, 1); assert.equal(salvage.score, 18, 'salvage bonus requires returning to the floor crumb');
});

test('broom warnings allow three counterplays and an ignored sweep hits only once', () => {
  const broom = () => ({ id: 1, kind: 'broom', x: 86, z: 10, vx: 1, warning: 1.2, active: .3, age: 0, resolved: false });
  for (const tactic of ['cross', 'hop', 'dash', 'ignore']) {
    const game = quiet(); game.player.x = 86; game.score = 50; game.items = [broom()];
    for (let n = 0; n < (tactic === 'cross' ? 2 : 4); n++) updateChase(game, {}, .25);
    assert.equal(game.bumps, 0, 'the warning itself is harmless');
    if (tactic === 'hop') jumpChase(game);
    const events = [];
    for (let n = 0; n < 65; n++) {
      if (tactic === 'dash' && n === 10) dashChase(game, 1);
      events.push(...updateChase(game, tactic === 'cross' ? { axis: 1 } : {}, 1 / 60));
    }
    assert.equal(game.bumps, tactic === 'ignore' ? 1 : 0, tactic);
    assert.equal(game.items.length, 0);
    if (tactic === 'hop') assert.equal(game.dodged, 1);
    if (tactic === 'dash') assert.equal(game.dashSmashes, 1);
    if (tactic === 'ignore') assert.equal(events.filter(e => e.type === 'bump').length, 1);
  }
});

test('all three contracts matter to the top rating, even when raw score is high', () => {
  const game = play(newChase(pet(), { format: 'run', seed: 1 })).game;
  assert.equal(game.stars, 3); assert.equal(game.waveResults.filter(x => x.bonus).length, 3);
  game.waveResults[1].bonus = 0;
  assert.equal(chaseStars(game), 2);
  assert.equal(chaseStarTarget(game).contracts, 1);
  assert.ok(game.score > game.goal * 60);
});

test('active steering can win across bodies and seeded runs, while idle play cannot; item count stays bounded', () => {
  for (let seed = 1; seed <= 5; seed++) {
    assert.equal(play(newChase(pet(), { format: 'run', seed }), false).game.complete, false);
    for (const kind of ['', 'wing', 'horns', 'halo']) {
      const resident = pet(kind), before = JSON.stringify(resident);
      const { game, maxItems } = play(newChase(resident, { format: 'run', seed }));
      assert.equal(game.complete, true, 'active win for seed ' + seed + ', body ' + kind);
      assert.ok(maxItems <= 18, 'the 54-second run does not accumulate old waves');
      assert.equal(JSON.stringify(resident), before);
    }
  }
});

test('midnight records survive reload without replacing quick records and a completed run rewards once', () => {
  const resident = pet(); resident.chaseBest = { score: 400, caught: 13, dodged: 2, at: now, bestStreak: 8, stars: 3 };
  resident.chaseRecords = { standard: { score: 400, stars: 3, at: now } };
  const quick = JSON.stringify(resident.chaseBest), game = play(newChase(resident, { format: 'run', seed: 2 })).game;
  assert.equal(recordChase(resident, game, now), true);
  assert.equal(JSON.stringify(resident.chaseBest), quick);
  assert.equal(resident.chaseRecords.standard.score, 400);
  const state = blankState(); state.pets = [resident]; state.slots[0] = resident.id; state.lastTick = now;
  assert.ok(rewardHandshake(state, game, now));
  assert.equal(rewardHandshake(state, game, now), null);
  assert.equal(resident.chases, 1);
  const restored = normalizeState(state).pets[0];
  assert.deepEqual(restored.chaseRecords['run:standard'], resident.chaseRecords['run:standard']);
});
