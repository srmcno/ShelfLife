// Duel runs are deterministic: a seed and an input log reproduce the run.
// The live half is driven through the real playfield views (ui/arcade-games.js)
// on a stub DOM, exactly as the arcade shell steps them in a duel, and the
// replay half is the headless ghost. If the two ever drift, the ghost would
// draw a run that did not happen, so these tests compare every tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUEL_TICK, createDuelClock, createGhost, replayLog, readDuelLog, sealLog, duelSim, simStep, simInput, frenzyCode, frenzyDecode,
  MAX_LOG_CHARS, MAX_INPUTS, decodeInputs, createRecorder
} from '../src/engine/duel.js';
import { startGame, seededRandom, seanceWanted } from '../src/engine/arcade.js';

// A stub element: enough of the DOM for the playfields to build, draw and
// animate without a page. Nothing here is read back.
function el() {
  const node = {
    style: { setProperty() {} }, dataset: {}, hidden: false, children: [], innerHTML: '', textContent: '', offsetWidth: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(child) { node.children.push(child); return child; }, remove() {}, setAttribute() {}, getAttribute: () => null,
    querySelector: () => el(), querySelectorAll: () => Array.from({ length: 9 }, el), animate: () => ({ cancel() {} }), getAnimations: () => []
  };
  return node;
}
globalThis.document ??= { createElement: () => el() };
const { VIEWS } = await import('../src/ui/arcade-games.js');

const fx = new Proxy({}, { get: () => () => {} });
function shell(game, seed) {
  const g = startGame(game, seededRandom(seed), null);
  const A = { g, run: { drawn: 0 }, field: el(), world: el(), fx, size: { w: 320, h: 420 }, puppet: null,
    sfx() {}, haptic() {}, say() {}, react() {}, mkPet: () => null, pet: null };
  const view = VIEWS[game]();
  view.build(A);
  return { g, A, view };
}

// A plain bot for each game, deciding from the live game what to do this tick.
// It plays well enough to score and badly enough to lose eventually.
const BOTS = {
  frenzy(g, tick) {
    if (tick % 7) return null;
    const good = g.items.filter(i => ['crumb', 'raisin', 'tooth', 'heart'].includes(i.kind) && i.y > 0.4).sort((a, b) => b.y - a.y)[0];
    if (tick % 140 < 20) return { steer: [tick % 280 < 140 ? -1 : 1, null] };
    return { steer: [0, good ? good.x : 0.5 + Math.sin(tick / 50) * 0.3] };
  },
  stack(g, tick) {
    // Waits for a near-perfect drop, but every eighth coffin goes early.
    const top = g.stack.at(-1), sloppy = g.drops % 8 === 7;
    return tick > 20 && Math.abs(g.mover.x - top.x) < (sloppy ? 0.12 : 0.012) ? { code: 1 } : null;
  },
  seance(g, tick) {
    if (g.phase !== 'input' || tick % 13) return null;
    return { code: tick % 97 === 0 ? (seanceWanted(g) + 1) % 4 : seanceWanted(g) };
  },
  whack(g, tick) {
    if (tick % 9) return null;
    const hole = g.holes.findIndex(h => h && (h.kind === 'hand' || h.kind === 'landlord' || h.kind === 'gold'));
    if (hole >= 0 && tick % 300 > 40) return { code: hole };
    return { code: tick % 9 === 0 ? (tick / 9) % 9 : 0 };
  }
};
const apply = (game, view, A) => (code, at) => game === 'stack' ? view.drop(A) : game === 'seance' ? view.press(A, code, at) : view.hit(A, code);

function liveRun(game, seed, limit = 60 * 120) {
  const { g, A, view } = shell(game, seed);
  // The score after every tick, before any input that lands between frames.
  const scores = [];
  const clock = createDuelClock({ game, g, step: dt => { view.frame(A, dt); scores.push(g.score); } });
  // Frames of uneven length, like a real phone, including the occasional stall.
  const frames = [1 / 60, 1 / 60, 1 / 30, 1 / 144, 1 / 50, 1 / 20, 1 / 75];
  let f = 0;
  while (!g.over && clock.tick < limit) {
    const move = BOTS[game](g, clock.tick);
    if (move?.steer) { g.dir = move.steer[0]; g.target = move.steer[1]; }
    else if (move) clock.input(move.code, at => apply(game, view, A)(move.code, at));
    clock.advance(frames[f++ % frames.length]);
  }
  view.destroy?.();
  return { g, log: clock.log(), scores, ticks: clock.tick };
}

for (const game of ['frenzy', 'stack', 'seance', 'whack']) {
  test(game + ': the same seed and inputs make the same run, and the ghost replays the recorded score from the log', () => {
    const seed = 20261011 + game.length;
    const live = liveRun(game, seed);
    assert.ok(live.g.score > 0, game + ' bot scored something');
    assert.equal(live.log.game, game);
    assert.equal(live.log.score, live.g.score);
    assert.ok(live.log.inputs.length >= 2, 'inputs were recorded');
    const replay = replayLog(game, seed, live.log);
    assert.equal(replay.score, live.g.score, 'headless replay reaches the recorded score');
    assert.equal(replay.over, live.g.over);
    // Tick for tick, the ghost stays with the run it is replaying.
    const ghost = createGhost(game, seed, live.log);
    for (let t = 1; t <= live.ticks; t++) {
      ghost.advanceTo(t);
      assert.equal(ghost.diverged, false, 'no drift at tick ' + t);
      if (t < live.ticks) assert.equal(ghost.sim.g.score, live.scores[t - 1], 'same score at tick ' + t);
    }
    assert.equal(ghost.scoreAt(live.ticks), live.g.score);
    assert.equal(ghost.over, true);
    // A second live run on the same seed with the same bot is the same run.
    assert.deepEqual(liveRun(game, seed).log, live.log);
    // A different seed is a different run, except in Coffin Stack, which
    // throws nothing random at you without a daily modifier.
    if (game !== 'stack') assert.notDeepEqual(liveRun(game, seed + 1).log, live.log);
    // The log survives the round trip through the reader and the seal.
    assert.deepEqual(readDuelLog(JSON.parse(JSON.stringify(live.log)), game, 5000), live.log);
    assert.equal(sealLog(live.log, seed).mode, 'ghost');
    assert.ok(JSON.stringify(live.log).length <= MAX_LOG_CHARS);
  });
}

test('the ghost notices a log that does not match its seed and falls back to the recorded scores', () => {
  const live = liveRun('whack', 77);
  const ghost = createGhost('whack', 78, live.log);
  for (let t = 1; t <= live.ticks && !ghost.diverged; t++) ghost.advanceTo(t);
  assert.equal(ghost.diverged, true);
  assert.equal(ghost.scoreAt(60 * 3), live.log.timeline[3]);
  assert.equal(ghost.scoreAt(live.ticks + 10), live.log.score);
  // A log that does not reproduce its own score is sent as scores only.
  assert.equal(sealLog({ ...live.log, score: live.log.score + 1 }, 77).mode, 'ticker');
  const ticker = createGhost('whack', 77, { ...live.log, mode: 'ticker' });
  ticker.advanceTo(120);
  assert.equal(ticker.diverged, true);
});

test('duel ticks are fixed: uneven frames add up to whole ticks and the same game', () => {
  const a = duelSim('whack', 5), b = duelSim('whack', 5);
  const clock = createDuelClock({ game: 'whack', g: b.g, step: () => simStep(b) });
  const frames = [0.05, 0.001, 0.033, 0.016, 0.0071, 0.049];
  let elapsed = 0, f = 0;
  while (clock.tick < 900 && !b.g.over) { const dt = frames[f++ % frames.length]; elapsed += dt; clock.advance(dt); }
  for (let i = 0; i < clock.tick; i++) simStep(a);
  assert.ok(clock.tick > 120, 'the run lasted a while');
  assert.ok(Math.abs(clock.tick - elapsed / DUEL_TICK) < 4, 'about one tick per sixtieth of a second');
  assert.equal(a.g.over, b.g.over);
  assert.equal(b.g.score, a.g.score);
  assert.deepEqual(b.g.holes, a.g.holes);
  assert.equal(b.g.lives, a.g.lives);
  assert.equal(DUEL_TICK, 1 / 60);
});

test('frenzy steering codes are exact and cover every direction and target', () => {
  for (const dir of [-1, 0, 1]) for (const target of [null, 0, 0.004, 0.5, 0.996, 1]) {
    const s = frenzyDecode(frenzyCode(dir, target));
    assert.equal(s.dir, dir);
    assert.equal(s.target, target === null ? null : Math.round(target * 100) / 100);
    assert.equal(frenzyCode(s.dir, s.target), frenzyCode(dir, target));
  }
  assert.equal(frenzyCode(0, NaN), frenzyCode(0, null));
});

test('logs stay bounded: long runs are cut and the ghost stops where the log stops', () => {
  const rec = createRecorder('whack');
  for (let i = 0; i < MAX_INPUTS + 500; i++) rec.input(i * 3, i % 9);
  for (let t = 0; t < 60 * 900; t += 60) rec.sample(t, t);
  const log = rec.log(99999, 10);
  assert.ok(JSON.stringify(log).length <= MAX_LOG_CHARS);
  assert.ok(log.cut > 0);
  assert.equal(decodeInputs(log.inputs).length <= MAX_INPUTS, true);
  assert.ok(log.timeline.length <= 600);
});

test('a log from the other player is checked before anything replays it', () => {
  const good = { v: 1, game: 'stack', mode: 'ghost', ticks: 600, score: 9, cut: 0, inputs: [30, 1, 40, 1], timeline: [0, 1] };
  assert.deepEqual(readDuelLog(good, 'stack', 500), good);
  for (const bad of [null, [], { ...good, v: 2 }, { ...good, game: 'whack' }, { ...good, score: 501 }, { ...good, inputs: [1] },
    { ...good, inputs: [1, 2] }, { ...good, inputs: [-1, 1] }, { ...good, inputs: [1.5, 1] }, { ...good, timeline: ['x'] },
    { ...good, ticks: 1e12 }, { ...good, inputs: Array(MAX_INPUTS * 2 + 2).fill(1) }]) {
    assert.equal(readDuelLog(bad, 'stack', 500), null, JSON.stringify(bad)?.slice(0, 60));
  }
  assert.equal(readDuelLog({ ...good, mode: 'weird' }, 'stack', 500).mode, 'ticker');
  assert.equal(readDuelLog({ ...good, cut: -4 }, 'stack', 500).cut, 0);
});
