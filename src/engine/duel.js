import { startGame, seededRandom, frenzyStep, stackStep, stackDrop, seanceInput, seanceShown, seanceSchedule, whackStep, whackHit } from './arcade.js';

/* ================= DUEL RUNS =================
   A duel is two players on the same seed. The four arcade games already take
   every random number from g.rnd, so the seed fixes what the game throws at
   you. What it does not fix is time: an ordinary run steps once per screen
   frame with whatever time has passed, so two runs with the same taps drift
   apart. A duel run instead steps in fixed ticks of 1/60 s, and every input
   is written down against the tick it landed on. Feed the same seed and the
   same (tick, input) list back through the same engine functions and the same
   game comes out, which is what draws the ghost. Ordinary play is unchanged.

   Inputs are small integers:
     frenzy  the steering held at the start of a tick (see frenzyCode)
     stack   1, a drop
     seance  the candle, 0 to 3
     whack   the grave, 0 to 8
   A log is { v: 1, game, mode, ticks, score, cut, inputs: [gap, code, gap, code, ...], timeline }
   where `gap` is ticks since the previous input, `timeline` is the score once a
   second, and `cut` is the tick a log too long to keep was cut at (0 if not). */

export const DUEL_TICK = 1 / 60;
export const DUEL_GAMES = ['frenzy', 'stack', 'seance', 'whack'];
export const TIMELINE_EVERY = 60;
export const MAX_INPUTS = 3000;      // input pairs kept
export const MAX_TIMELINE = 600;     // ten minutes of once-a-second scores
export const MAX_LOG_CHARS = 30000;  // the server refuses 38,000 bytes
export const MAX_TICKS = 60 * 60 * 30;
const CODE_MAX = { frenzy: 305, stack: 1, seance: 3, whack: 8 };

// Frenzy steering: a held direction (-1, 0, 1) and a pointer target in
// hundredths of the field, or none. The live run snaps to the same values,
// so the code is exact.
export function frenzyCode(dir, target) {
  const d = dir < 0 ? 0 : dir > 0 ? 2 : 1;
  const t = target == null || !Number.isFinite(target) ? 101 : Math.max(0, Math.min(100, Math.round(target * 100)));
  return d * 102 + t;
}
export function frenzyDecode(code) {
  const d = Math.floor(code / 102), t = code % 102;
  return { dir: d - 1, target: t === 101 ? null : t / 100 };
}

// The Séance's listening clock, exactly as the playfield runs it
// (ui/arcade-games.js seanceView.frame): the show starts on the first tick in
// the 'show' phase and ends once its schedule has passed.
export function seanceClock(c, g, dt) {
  if (g.phase !== 'show') { c.showing = false; return null; }
  if (!c.showing) { c.showing = true; c.at = 0; c.sched = seanceSchedule(g); }
  c.at += dt;
  if (c.at >= c.sched.end) { seanceShown(g); c.showing = false; return 'shown'; }
  return 'show';
}

/* ---------- a headless run: the ghost, and the tests ---------- */
export function duelSim(game, seed) {
  return { game, g: startGame(game, seededRandom(seed), null), tick: 0, clock: { showing: false, at: 0, sched: null } };
}
export function simStep(sim) {
  const g = sim.g;
  if (g.over) return;
  if (sim.game === 'frenzy') frenzyStep(g, DUEL_TICK);
  else if (sim.game === 'stack') stackStep(g, DUEL_TICK);
  else if (sim.game === 'whack') whackStep(g, DUEL_TICK);
  else seanceClock(sim.clock, g, DUEL_TICK);
  sim.tick += 1;
}
// Applies one recorded input. Returns false when the game would ignore it.
export function simInput(sim, code) {
  const g = sim.g;
  if (g.over) return false;
  if (sim.game === 'frenzy') { const s = frenzyDecode(code); g.dir = s.dir; g.target = s.target; return true; }
  if (sim.game === 'stack') { stackDrop(g); return true; }
  if (sim.game === 'seance') return !seanceInput(g, code, sim.tick * DUEL_TICK).ignored;
  if (sim.game === 'whack') return !whackHit(g, code).ignored;
  return false;
}

export function decodeInputs(flat) {
  const out = [];
  let t = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) { t += flat[i]; out.push({ t, code: flat[i + 1] }); }
  return out;
}

/* ---------- recording ---------- */
export function createRecorder(game) {
  const inputs = [], timeline = [0];
  let last = 0, cut = 0;
  return {
    input(tick, code) {
      if (cut) return;
      if (inputs.length >= MAX_INPUTS * 2) { cut = tick; return; }
      inputs.push(tick - last, code); last = tick;
    },
    sample(tick, score) { if (tick % TIMELINE_EVERY === 0 && timeline.length < MAX_TIMELINE) timeline.push(score); },
    log(ticks, score) {
      const log = { v: 1, game, mode: 'ghost', ticks, score, cut, inputs: inputs.slice(), timeline: timeline.slice() };
      // Long logs lose their last inputs, and the ghost stops where they stop.
      while (JSON.stringify(log).length > MAX_LOG_CHARS && log.inputs.length) {
        log.inputs.length = Math.max(0, log.inputs.length - 200);
        log.cut = decodeInputs(log.inputs).at(-1)?.t || 1;
      }
      while (JSON.stringify(log).length > MAX_LOG_CHARS && log.timeline.length > 1) log.timeline.length = Math.floor(log.timeline.length / 2);
      return log;
    }
  };
}

/* The fixed-step clock a live duel run steps through. `step(dt)` advances
   the live game by one tick (the arcade shell passes its playfield's frame,
   which draws as it goes). Inputs arrive between frames through input(), are
   applied at once and recorded at the current tick; Frenzy's steering is read
   at the start of every tick instead. */
export function createDuelClock({ game, g, step, ghost = null }) {
  const rec = createRecorder(game);
  let acc = 0, steering = frenzyCode(g.dir ?? 0, g.target ?? null);
  const clock = {
    tick: 0, ghost,
    advance(dt) {
      acc = Math.min(acc + Math.max(0, dt), DUEL_TICK * 4);
      let n = 0;
      while (acc >= DUEL_TICK - 1e-9 && !g.over && clock.tick < MAX_TICKS) {
        acc -= DUEL_TICK; n += 1;
        if (game === 'frenzy') steer();
        step(DUEL_TICK);
        clock.tick += 1;
        rec.sample(clock.tick, g.score);
        ghost?.advanceTo(clock.tick);
      }
      return n;
    },
    // `apply(at)` runs the input on the live game and returns the engine's
    // answer; null means it was ignored and is not recorded.
    input(code, apply) {
      if (g.over || !Number.isInteger(code)) return null;
      const r = apply(clock.tick * DUEL_TICK);
      if (r && !r.ignored) rec.input(clock.tick, code);
      return r;
    },
    log() { return rec.log(clock.tick, g.score); }
  };
  function steer() {
    const code = frenzyCode(g.dir, g.target), s = frenzyDecode(code);
    g.dir = s.dir; g.target = s.target;
    if (code !== steering) { rec.input(clock.tick, code); steering = code; }
  }
  return clock;
}

/* ---------- replay ---------- */
// The ghost: the first player's run, replayed tick for tick beside yours.
// It checks itself against the once-a-second scores; if it ever disagrees
// (a log from another kind of device, or one cut short) it says so, and the
// screen falls back to those scores instead of drawing the ghost.
export function createGhost(game, seed, log) {
  const sim = duelSim(game, seed), inputs = decodeInputs(log?.inputs || []);
  const stopAt = log?.cut || log?.ticks || 0;
  let next = 0, diverged = !log || log.mode !== 'ghost', applied = [];
  function due() {
    while (next < inputs.length && inputs[next].t === sim.tick) { const input = inputs[next++]; if (simInput(sim, input.code)) applied.push(input.code); }
  }
  function check() {
    if (sim.tick % TIMELINE_EVERY === 0) {
      const want = log.timeline[sim.tick / TIMELINE_EVERY];
      if (want !== undefined && want !== sim.g.score) diverged = true;
    }
  }
  const ghost = {
    sim,
    get diverged() { return diverged; },
    get over() { return sim.tick >= (log?.ticks || 0) || sim.g.over; },
    // Steps the ghost up to `tick`, answering the inputs it played on the way.
    advanceTo(tick) {
      applied = [];
      if (diverged) return applied;
      const target = Math.min(tick, stopAt);
      while (sim.tick < target && !sim.g.over) { due(); simStep(sim); check(); if (diverged) return applied; }
      if (sim.g.over && sim.tick < log.ticks) diverged = true;
      else if (sim.tick >= log.ticks) {
        due();
        if (sim.g.score !== log.score) diverged = true;
      } else if (log.cut && sim.tick >= log.cut) diverged = true;
      return applied;
    },
    applied: () => applied,
    // Their score at this point of the run: the ghost's own, or the recorded
    // once-a-second score when the ghost cannot be trusted.
    scoreAt(tick) {
      if (!log) return 0;
      if (tick >= log.ticks) return log.score;
      if (!diverged) return sim.g.score;
      const list = log.timeline || [];
      return list[Math.min(list.length - 1, Math.floor(tick / TIMELINE_EVERY))] ?? 0;
    }
  };
  return ghost;
}

// Plays a whole log back with nothing on screen: the score it reaches and
// whether it reached the end the log says it did.
export function replayLog(game, seed, log) {
  const sim = duelSim(game, seed), inputs = decodeInputs(log.inputs);
  let next = 0;
  const due = () => { while (next < inputs.length && inputs[next].t === sim.tick) simInput(sim, inputs[next++].code); };
  while (sim.tick < log.ticks && !sim.g.over) { due(); simStep(sim); }
  due();
  return { score: sim.g.score, over: sim.g.over, tick: sim.tick, sim };
}

/* ---------- reading a log from the other player ---------- */
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function readDuelLog(raw, game, cap = Infinity) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 1 || raw.game !== game || !DUEL_GAMES.includes(game)) return null;
  if (!int(raw.ticks, 0, MAX_TICKS) || !int(raw.score, 0, cap) || !Array.isArray(raw.inputs) || !Array.isArray(raw.timeline)) return null;
  if (raw.inputs.length > MAX_INPUTS * 2 || raw.inputs.length % 2 || raw.timeline.length > MAX_TIMELINE) return null;
  const max = CODE_MAX[game];
  for (let i = 0; i < raw.inputs.length; i += 2) if (!int(raw.inputs[i], 0, MAX_TICKS) || !int(raw.inputs[i + 1], 0, max)) return null;
  if (!raw.timeline.every(s => int(s, 0, cap))) return null;
  const cut = int(raw.cut, 0, MAX_TICKS) ? raw.cut : 0;
  return { v: 1, game, mode: raw.mode === 'ghost' ? 'ghost' : 'ticker', ticks: raw.ticks, score: raw.score, cut,
    inputs: raw.inputs.slice(), timeline: raw.timeline.slice() };
}

// Checks a fresh log by playing it back before it is sent. A log that does
// not reproduce its own score goes as scores only (the ticker), never as a
// ghost that would lie.
export function sealLog(log, seed) {
  if (!log) return null;
  const replay = replayLog(log.game, seed, log);
  if (!log.cut && replay.score !== log.score) return { ...log, mode: 'ticker', inputs: [], cut: 0 };
  return log;
}
