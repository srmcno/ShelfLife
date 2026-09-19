import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { blankRug, normalizeRug } from '../src/play-rug-state.js';
import { RUG_WORLD, RUG_LIMITS, RUG_STEP, RUG_TRICKS, createRug, tossBall, tossPreset,
  spawnBubbles, popBubble, updateRug, pauseRug, rugProgress, recordRugEvents } from '../src/engine/play-rug.js';

const now = new Date(2026, 8, 1, 12).getTime();
const resident = (id = 'Mabel') => ({ id, name: id, traits: [], art: {}, needs: { food: 80, fuss: 90, clean: 100 }, bond: 0, cared: 0 });
function fixture(count = 1) {
  const state = blankState(); state.lastTick = now;
  state.pets = Array.from({ length: count }, (_, index) => resident('pet-' + index));
  state.pets.forEach((pet, index) => { state.slots[index] = pet.id; });
  return state;
}
function advance(game, seconds) {
  const events = [];
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) events.push(...updateRug(game, RUG_STEP));
  return events;
}
function allTricks(pet) {
  const game = createRug(pet), events = [];
  for (const kind of ['high', 'bounce', 'soft', 'soft', 'soft']) {
    tossPreset(game, kind); events.push(...advance(game, 3));
  }
  const party = spawnBubbles(game, { x: 500, y: 120, count: 5 });
  for (const bubble of party.slice(0, 3)) events.push(...popBubble(game, bubble.id));
  return { game, events };
}
const tricksIn = events => events.filter(event => event.type === 'trick').map(event => event.trickId);
function physicalSnapshot(game) {
  return { time: game.time, pet: game.pet, catches: game.catches, pops: game.pops,
    balls: game.balls.map(({ id, ...ball }) => ball), bubbles: game.bubbles.map(({ id, ...bubble }) => bubble) };
}
function comparableEvents(events) {
  return events.map(({ id, sessionId, ballId, bubbleId, ...event }) => event);
}

test('a rug starts with the actual resident and no mutations, invented achievements, or toys', () => {
  const pet = resident(), before = structuredClone(pet), game = createRug(pet);
  assert.deepEqual(pet, before);
  assert.equal(game.pet.id, pet.id);
  assert.equal(game.pet.y, RUG_WORLD.ground);
  assert.equal(game.pet.pose, 'idle');
  assert.deepEqual(game.balls, []); assert.deepEqual(game.bubbles, []);
  assert.equal(game.catches, 0); assert.equal(game.pops, 0);
  for (const bad of [null, {}, { id: '' }, { id: '__proto__' }, { id: 'x'.repeat(101) }]) assert.equal(createRug(bad), null);
});

test('toy IDs remain unique across removals and different live sessions', () => {
  const game = createRug(resident()), other = createRug(resident()), ids = new Set();
  for (let index = 0; index < 40; index++) {
    advance(game, 6);
    const ball = tossPreset(game), bubble = spawnBubbles(game, { count: 1 })[0];
    assert.equal(ids.has(ball.id), false); assert.equal(ids.has(bubble.id), false);
    ids.add(ball.id); ids.add(bubble.id); popBubble(game, bubble.id);
  }
  assert.notEqual(game.sessionId, other.sessionId);
  assert.equal(ids.has(tossPreset(other).id), false);
});

test('the same commands produce identical physics and outcomes at different foreground frame rates', () => {
  const games = Array.from({ length: 3 }, () => createRug(resident()));
  games.forEach(game => { tossPreset(game, 'high'); spawnBubbles(game, { x: 170, y: 240, count: 5 }); });
  const once = updateRug(games[0], 2), sixty = advance(games[1], 2), fast = [];
  for (let index = 0; index < 240; index++) fast.push(...updateRug(games[2], 1 / 120));
  assert.deepEqual(physicalSnapshot(games[0]), physicalSnapshot(games[1]));
  assert.deepEqual(physicalSnapshot(games[0]), physicalSnapshot(games[2]));
  assert.deepEqual(comparableEvents(once), comparableEvents(sixty));
  assert.deepEqual(comparableEvents(once), comparableEvents(fast));
});

test('fractional frames accumulate without making faster screens faster', () => {
  const game = createRug(resident()); tossPreset(game, 'high');
  const before = physicalSnapshot(game);
  assert.deepEqual(updateRug(game, 1 / 120), []); assert.deepEqual(physicalSnapshot(game), before);
  updateRug(game, 1 / 120);
  assert.equal(game.time, 1 / 60); assert.notEqual(game.balls[0].y, before.balls[0].y);
});

test('foreground gaps freeze toys, discard fractions and interrupt a bubble burst', () => {
  const game = createRug(resident()); tossPreset(game, 'high');
  const bubbles = spawnBubbles(game, { x: 200, y: 90, count: 3 });
  popBubble(game, bubbles[0].id); updateRug(game, 1 / 120);
  const before = structuredClone(game);
  assert.deepEqual(updateRug(game, 2.001), []); assert.deepEqual(game, before);
  assert.deepEqual(updateRug(game, 1 / 120), []); assert.equal(game.time, 0);
  const events = [...popBubble(game, bubbles[1].id), ...popBubble(game, bubbles[2].id)];
  assert.equal(tricksIn(events).includes('group-burst'), false);
});

test('an explicit pause preserves the scene and ends a quick-pop gesture without waiting for a frame', () => {
  const game = createRug(resident()), bubbles = spawnBubbles(game, { y: 90, count: 3 });
  popBubble(game, bubbles[0].id); updateRug(game, 1 / 120);
  const before = structuredClone(game);
  assert.equal(pauseRug(game), true); assert.deepEqual(game, before);
  assert.equal(pauseRug(structuredClone(game)), false);
  const after = [...popBubble(game, bubbles[1].id), ...popBubble(game, bubbles[2].id)];
  assert.equal(tricksIn(after).includes('group-burst'), false);
  updateRug(game, 1 / 120); assert.equal(game.time, 0);
});

test('invalid commands and unissued simulation objects do nothing', () => {
  const game = createRug(resident()), before = structuredClone(game);
  for (const bad of [null, [], { x: NaN }, { y: Infinity }, { vx: '2' }, { vy: -Infinity }]) assert.equal(tossBall(game, bad), null);
  for (const bad of [null, [], { x: NaN }, { count: Infinity }, { count: 0 }, { y: '320' }]) assert.deepEqual(spawnBubbles(game, bad), []);
  for (const dt of [-1, NaN, Infinity, '1']) assert.deepEqual(updateRug(game, dt), []);
  assert.equal(tossPreset(game, 'unknown'), null);
  assert.deepEqual(popBubble(game, 'not-a-bubble'), []);
  const copy = structuredClone(game);
  assert.deepEqual(updateRug(copy, 1), []); assert.equal(tossBall(copy), null);
  assert.deepEqual(spawnBubbles(copy), []); assert.deepEqual(popBubble(copy, 'fake'), []);
  assert.deepEqual(game, before);
});

test('input clipping and entity budgets keep enthusiastic play inside the room', () => {
  const game = createRug(resident());
  for (let index = 0; index < 200; index++) {
    tossBall(game, { x: index % 2 ? -1e9 : 1e9, y: -1e9, vx: 1e9, vy: -1e9 });
    spawnBubbles(game, { x: index % 2 ? -1e9 : 1e9, y: 1e9, count: 100 });
    assert.ok(game.balls.length <= RUG_LIMITS.balls); assert.ok(game.bubbles.length <= RUG_LIMITS.bubbles);
  }
  for (let frame = 0; frame < 1800; frame++) {
    updateRug(game, RUG_STEP);
    for (const ball of game.balls) {
      assert.ok(ball.x >= ball.r && ball.x <= RUG_WORLD.width - ball.r);
      assert.ok(ball.y >= ball.r && ball.y <= RUG_WORLD.ground - ball.r);
      assert.ok([ball.x, ball.y, ball.vx, ball.vy, ball.rotation].every(Number.isFinite));
    }
    assert.ok(game.pet.x >= 65 && game.pet.x <= 935); assert.ok(game.pet.y <= RUG_WORLD.ground);
    assert.ok(game.balls.length <= 3 && game.bubbles.length <= 12);
  }
  assert.equal(game.balls.length, 0); assert.equal(game.bubbles.length, 0);
});

for (const kind of ['soft', 'high', 'bounce']) test('the accessible ' + kind + ' preset achieves its advertised catch through real play', () => {
  const game = createRug(resident()); tossPreset(game, kind);
  const events = advance(game, 4), caught = events.find(event => event.type === 'catch');
  assert.equal(game.catches, 1); assert.ok(caught);
  assert.ok(tricksIn(events).includes('first-catch'));
  assert.equal(tricksIn(events).includes('high-catch'), kind === 'high');
  assert.equal(tricksIn(events).includes('bounce-catch'), kind === 'bounce');
  if (kind === 'high') {
    assert.ok(events.findIndex(event => event.type === 'jump') < events.indexOf(caught));
    assert.ok(caught.y < RUG_WORLD.ground - 170); assert.equal(caught.high, true);
  }
  if (kind === 'bounce') {
    const bounce = events.find(event => event.type === 'bounce');
    assert.ok(bounce); assert.ok(events.indexOf(bounce) < events.indexOf(caught));
    assert.ok(caught.bounces > 0);
  }
});

test('a grounded unreachable ball produces a visible miss instead of a saved catch', () => {
  const game = createRug(resident()); tossBall(game, { x: 65, y: 470, vx: 0, vy: 0 });
  const events = advance(game, 4);
  assert.equal(game.catches, 0);
  assert.ok(events.some(event => event.type === 'miss'));
  assert.equal(tricksIn(events).includes('first-catch'), false);
});

test('the closest reachable toy directs the resident', () => {
  const game = createRug(resident());
  tossBall(game, { x: 90, y: 470, vx: 0, vy: 0 });
  tossBall(game, { x: 730, y: 470, vx: 0, vy: 0 });
  advance(game, .5);
  assert.ok(game.pet.x > 500); assert.equal(game.pet.facing, 1);
});

test('a resident pops a real low bubble, allowing quiet free play to discover it', () => {
  const game = createRug(resident()); spawnBubbles(game, { x: 500, y: 380, count: 1 });
  const events = advance(game, 3);
  assert.ok(events.some(event => event.type === 'pop' && event.actor === 'resident'));
  assert.ok(tricksIn(events).includes('first-bubble'));
  assert.equal(game.bubbles.length, 0);
});

test('the resident leaves time for a player to join a new bubble party', () => {
  const game = createRug(resident()); spawnBubbles(game);
  const early = advance(game, .3);
  assert.equal(early.some(event => event.type === 'pop'), false);
  assert.equal(game.bubbles.length, 5);
});

test('three distinct player pops can earn a group burst, with no credit for duplicate taps', () => {
  const game = createRug(resident()), bubbles = spawnBubbles(game, { y: 90, count: 5 });
  const events = [];
  for (const bubble of bubbles.slice(0, 3)) {
    events.push(...popBubble(game, bubble.id));
    assert.deepEqual(popBubble(game, bubble.id), []);
    events.push(...advance(game, .4));
  }
  assert.equal(game.pops, 3);
  assert.deepEqual(tricksIn(events), ['first-bubble', 'group-burst']);
});

test('three leisurely pops do not claim a quick group burst', () => {
  const game = createRug(resident()), bubbles = spawnBubbles(game, { y: 90, count: 3 }), events = [];
  for (const bubble of bubbles) { events.push(...popBubble(game, bubble.id)); events.push(...advance(game, .8)); }
  assert.equal(game.pops, 3); assert.equal(tricksIn(events).includes('group-burst'), false);
});

test('all six lasting tricks are reachable using only real public toy commands', () => {
  const { game, events } = allTricks(resident());
  assert.equal(game.catches, 5); assert.equal(game.pops, 3);
  assert.deepEqual(new Set(tricksIn(events)), new Set(RUG_TRICKS.map(trick => trick.id)));
  assert.equal(tricksIn(events).length, RUG_TRICKS.length);
  tossPreset(game); assert.equal(tricksIn(advance(game, 3)).length, 0);
  const nextVisit = createRug(resident()); tossPreset(nextVisit);
  assert.equal(tricksIn(advance(nextVisit, 3)).includes('five-catches'), false);
});

test('six verified moments earn six discoveries and scenes, preserving care and other game progress', () => {
  const state = fixture(), pet = state.pets[0], { events } = allTricks(pet);
  const before = structuredClone(pet), daily = [...state.life.daily];
  const result = recordRugEvents(state, pet.id, events, now);
  assert.equal(result.length, 6); assert.ok(result.every(trick => trick.discoveryGained));
  assert.equal(state.life.xp, 6); assert.equal(state.life.scenes.length, 6);
  assert.ok(state.life.scenes.every(scene => scene.kind === 'play-rug' && scene.cast[0] === pet.id));
  assert.deepEqual(pet, before); assert.deepEqual(state.life.daily, daily);
  assert.equal(state.life.introDone, false); assert.equal(state.life.outings, 0); assert.equal(state.life.marketRuns, 0);
  assert.equal(rugProgress(state, pet.id, now).earned, 6); assert.equal(rugProgress(state, pet.id, now).next, null);
});

test('fabricated, serialized, and modified receipts cannot award a trick', () => {
  const state = fixture(), pet = state.pets[0], { events } = allTricks(pet);
  assert.deepEqual(recordRugEvents(state, pet.id, JSON.parse(JSON.stringify(events)), now), []);
  assert.deepEqual(recordRugEvents(state, pet.id, [{ type: 'trick', petId: pet.id, sessionId: 'rug-1', trickId: 'first-catch' }], now), []);
  const original = events.find(event => event.type === 'trick');
  assert.equal(Object.isFrozen(original), true);
  assert.throws(() => { original.trickId = 'five-catches'; }, TypeError);
  assert.equal(state.life.xp, 0);
  assert.equal(recordRugEvents(state, pet.id, events, now).length, 6);
});

test('wrong-resident callbacks do not consume the real resident receipt', () => {
  const state = fixture(2), { events } = allTricks(state.pets[0]);
  assert.deepEqual(recordRugEvents(state, state.pets[1].id, events, now), []);
  assert.equal(rugProgress(state, state.pets[1].id, now).earned, 0);
  assert.equal(recordRugEvents(state, state.pets[0].id, events, now).length, 6);
});

test('duplicate callbacks and repeat sessions cannot grind XP or scene history', () => {
  const state = fixture(), pet = state.pets[0], { events } = allTricks(pet);
  recordRugEvents(state, pet.id, events, now);
  const before = structuredClone(state);
  assert.deepEqual(recordRugEvents(state, pet.id, events, now), []);
  assert.deepEqual(recordRugEvents(state, pet.id, allTricks(pet).events, now), []);
  assert.deepEqual(state, before);
});

test('each resident can make its own moments without sharing another resident credit', () => {
  const state = fixture(2);
  for (const pet of state.pets) assert.equal(recordRugEvents(state, pet.id, allTricks(pet).events, now).length, 6);
  assert.equal(state.life.xp, 12);
  for (const pet of state.pets) assert.equal(rugProgress(state, pet.id, now).earned, 6);
});

test('old saves normalize to an empty rug with no reconstructed rewards', () => {
  const state = fixture(); delete state.rug;
  const history = shelf => ({ xp: shelf.life.xp, awards: shelf.life.awards, scenes: shelf.life.scenes, daily: shelf.life.daily, introDone: shelf.life.introDone });
  const before = structuredClone(history(state)), loaded = normalizeState(state);
  assert.deepEqual(loaded.rug, blankRug()); assert.deepEqual(history(loaded), before);
  assert.equal(rugProgress(loaded, loaded.pets[0].id, now).earned, 0);
});

test('reloading retains earned moments without saving toy physics or replaying rewards', () => {
  const state = fixture(), pet = state.pets[0], { events } = allTricks(pet);
  recordRugEvents(state, pet.id, events, now);
  const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(rugProgress(loaded, pet.id, now).earned, 6);
  assert.equal(loaded.life.xp, 6); assert.equal(loaded.life.scenes.length, 6);
  assert.deepEqual(recordRugEvents(loaded, pet.id, events, now), []);
  assert.deepEqual(recordRugEvents(loaded, pet.id, allTricks(pet).events, now), []);
  assert.equal(loaded.life.xp, 6);
  assert.deepEqual(Object.keys(loaded.rug), ['version', 'residents']);
});

test('rehome rejects delayed receipts and prunes saved rug residents', () => {
  const state = fixture(2), original = state.pets[0], { events } = allTricks(original);
  recordRugEvents(state, original.id, events.slice(0, 3), now);
  state.pets.shift(); state.slots[0] = null;
  assert.deepEqual(recordRugEvents(state, original.id, events, now), []);
  const loaded = normalizeState(state);
  assert.deepEqual(loaded.rug, blankRug());
  assert.equal(rugProgress(loaded, loaded.pets[0].id, now).earned, 0);
});

test('progress is read-only and rename retains identity-based moments', () => {
  const state = fixture(), pet = state.pets[0], { events } = allTricks(pet);
  recordRugEvents(state, pet.id, events, now); pet.name = 'Renamed';
  const before = JSON.stringify(state), progress = rugProgress(state, pet.id, now);
  assert.equal(progress.earned, 6); assert.equal(JSON.stringify(state), before);
  progress.tricks[0].label = 'changed view';
  assert.notEqual(RUG_TRICKS[0].label, 'changed view');
});

test('malformed rug saves are bounded, deduplicated, and restricted to current residents', () => {
  const state = fixture(18), tricks = RUG_TRICKS.map(trick => ({ id: trick.id, at: now }));
  const residents = state.pets.map(pet => ({ petId: pet.id, tricks: [...tricks, ...tricks] }));
  residents.push({ petId: 'gone', tricks }, { petId: '__proto__', tricks });
  const raw = { version: 800, sessions: Array(1000).fill('junk'), residents: [...residents, ...residents, ...residents] };
  const normalized = normalizeRug(raw, state, now);
  assert.equal(normalized.residents.length, 18);
  assert.ok(normalized.residents.every(entry => entry.tricks.length === 6));
  assert.deepEqual(Object.keys(normalized), ['version', 'residents']);
  assert.ok(JSON.stringify(normalized).length < 6000);
  const invalid = normalizeRug({ residents: [{ petId: state.pets[0].id, tricks: [
    { id: 'unknown', at: now }, { id: 'high-catch', at: now + 1 }, { id: 'bounce-catch', at: -1 },
    { id: 'first-bubble', at: NaN }, { id: 'first-catch', at: now }, { id: 'first-catch', at: 0 }
  ] }] }, state, now);
  assert.deepEqual(invalid.residents[0].tricks, [{ id: 'first-catch', at: 0 }]);
});

test('invalid reward timestamps and missing residents cannot consume receipts', () => {
  const state = fixture(), pet = state.pets[0], { events } = allTricks(pet);
  for (const time of [NaN, Infinity, -1]) assert.deepEqual(recordRugEvents(state, pet.id, events, time), []);
  assert.deepEqual(recordRugEvents(state, 'missing', events, now), []);
  assert.equal(recordRugEvents(state, pet.id, events, now).length, 6);
});
