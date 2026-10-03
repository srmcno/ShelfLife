import { kit, registerSfx, playSfx, onMuteChange, audioAllowed, isMuted } from './sound.js';

/* ---------------------------------------------------------------------------
   Sound for the arcade. All of it is synthesised, none of it is a file.

   Every sound is registered with the shared engine in sound.js, so it runs
   through the same master chain (compressor, room, short delay) as the rest
   of the game and counts against the same voice cap. Each ambient bed is a
   handful of oscillators and filtered noise behind one gain node, so it can be
   ducked while paused, stopped when the page is hidden and brought back.

   Nothing here may throw into a game: every entry point is wrapped.
--------------------------------------------------------------------------- */

const { osc, gain, filter, noise, env, sweep, route, chain, rnd, vary, graphFor, getCtx } = kit;

const PENTA = [0, 2, 4, 7, 9];
// The combo ladder: a major pentatonic climbing two octaves from C5. Every
// catch, hit or clean drop in a row is one rung higher, and nothing on it clashes.
export function ladderFreq(step) {
  const n = Math.max(0, Math.min(14, Math.floor(step || 0)));
  return 523.25 * Math.pow(2, (PENTA[n % 5] + 12 * Math.floor(n / 5)) / 12);
}
// One note per candle, a major triad with the octave on top.
export const CANDLE_NOTES = [261.63, 329.63, 392, 523.25];

const bell = (c, G, t0, f, peak, ring, verb = 0.35) => {
  const g = gain(c, 1);
  env(g.gain, t0, { peak, a: 0.003, d: ring * 0.45, sus: 0.16, r: ring * 0.55 });
  [[1, 0.7], [2.76, 0.22], [5.4, 0.08]].forEach(([m, l]) => {
    const o = osc(c, 'sine', vary(f * m, 4), t0), og = gain(c, l);
    o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + ring + 0.1);
  });
  route(c, G, g, 0.8, verb, 0.14);
};

const ARCADE_SFX = {
  // A rung of the combo ladder.
  combo(c, G, t0, step) {
    const f = ladderFreq(step), g = gain(c, 1);
    env(g.gain, t0, { peak: 0.1, a: 0.003, d: 0.17 });
    [[1, 0.8], [2, 0.18]].forEach(([m, l]) => { const o = osc(c, 'sine', vary(f * m, 4), t0), og = gain(c, l); o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + 0.26); });
    route(c, G, g, 0.85, 0.16, 0.05);
    return 0.24;
  },
  // A coffin lands: a low knock with a click of wood on top.
  thunk(c, G, t0) {
    const k = rnd(0.95, 1.06);
    const body = osc(c, 'sine', 130 * k, t0);
    sweep(body.frequency, t0, 130 * k, 52, 0.11);
    const bg = gain(c, 1);
    env(bg.gain, t0, { peak: 0.26, a: 0.003, d: 0.16 });
    route(c, G, chain([body, bg]), 0.95, 0.06, 0);
    body.start(t0); body.stop(t0 + 0.2);
    const click = noise(c, G, t0, 0.07, 1), cf = filter(c, 'lowpass', 1400, t0, 0.8);
    sweep(cf.frequency, t0, 1400, 260, 0.06);
    const cg = gain(c, 1);
    env(cg.gain, t0, { peak: 0.12, a: 0.002, d: 0.06 });
    route(c, G, chain([click, cf, cg]), 0.9, 0.05, 0);
    return 0.22;
  },
  // A clean drop: a bell on the combo ladder with a glint above it.
  perfect(c, G, t0, step) {
    bell(c, G, t0, ladderFreq(2 + (step || 0)), 0.12, 0.7);
    const gl = noise(c, G, t0, 0.18, 1.5), gf = filter(c, 'highpass', 5200, t0, 0.8), gg = gain(c, 1);
    env(gg.gain, t0, { peak: 0.035, a: 0.01, d: 0.15 });
    route(c, G, chain([gl, gf, gg]), 0.5, 0.3, 0);
    return 0.8;
  },
  // Old wood complaining: a rough saw through a narrow band, bending down.
  creak(c, G, t0) {
    const base = rnd(150, 200), o = osc(c, 'sawtooth', base, t0);
    o.frequency.linearRampToValueAtTime(base * rnd(0.7, 0.85), t0 + 0.3);
    const bp = filter(c, 'bandpass', 520, t0, 6);
    sweep(bp.frequency, t0, 520, 330, 0.3);
    const trem = gain(c, 1), lfo = osc(c, 'square', rnd(28, 36), t0), depth = gain(c, 0.5);
    lfo.connect(depth); depth.connect(trem.gain);
    const g = gain(c, 1);
    env(g.gain, t0, { peak: 0.07, a: 0.05, d: 0.26 });
    chain([o, bp, trem, g]);
    route(c, G, g, 0.9, 0.2, 0);
    o.start(t0); o.stop(t0 + 0.36); lfo.start(t0); lfo.stop(t0 + 0.36);
    return 0.36;
  },
  // Something wet and holy passing close enough to feel.
  near(c, G, t0) {
    const n = noise(c, G, t0, 0.24, 1.2), bp = filter(c, 'bandpass', 2600, t0, 1.4), g = gain(c, 1);
    sweep(bp.frequency, t0, 2600, 500, 0.22);
    env(g.gain, t0, { peak: 0.1, a: 0.05, d: 0.18 });
    route(c, G, chain([n, bp, g]), 0.8, 0.1, 0);
    return 0.26;
  },
  // A hand pushed back down: a short square blip, higher the longer the streak.
  pop(c, G, t0, step) {
    const f = ladderFreq(step) * 0.5, o = osc(c, 'square', f, t0), lp = filter(c, 'lowpass', 1800, t0, 0.8), g = gain(c, 1);
    env(g.gain, t0, { peak: 0.07, a: 0.002, d: 0.09 });
    route(c, G, chain([o, lp, g]), 0.9, 0.08, 0);
    o.start(t0); o.stop(t0 + 0.12);
    const tk = noise(c, G, t0, 0.04, 1.4), tg = gain(c, 1);
    env(tg.gain, t0, { peak: 0.05, a: 0.001, d: 0.035 });
    route(c, G, chain([tk, tg]), 0.8, 0, 0);
    return 0.14;
  },
  // Gold: five glassy steps up and away.
  gold(c, G, t0) {
    [5, 6, 7, 8, 10].forEach((rung, i) => {
      const t = t0 + i * 0.05, f = ladderFreq(rung), g = gain(c, 1), o = osc(c, 'triangle', f, t), o2 = osc(c, 'sine', f * 2, t), g2 = gain(c, 0.3);
      env(g.gain, t, { peak: 0.1 - i * 0.008, a: 0.003, d: i === 4 ? 0.4 : 0.12 });
      o.connect(g); o2.connect(g2); g2.connect(g);
      o.start(t); o.stop(t + 0.5); o2.start(t); o2.stop(t + 0.5);
      route(c, G, g, 0.8, 0.3, i === 4 ? 0.3 : 0.08);
    });
    return 0.6;
  },
  // A life lost: a sagging saw and a thump.
  hurt(c, G, t0) {
    const o = osc(c, 'sawtooth', 300, t0), lp = filter(c, 'lowpass', 1200, t0, 1), g = gain(c, 1);
    sweep(o.frequency, t0, 300, 96, 0.3);
    sweep(lp.frequency, t0, 1600, 240, 0.3);
    env(g.gain, t0, { peak: 0.13, a: 0.004, d: 0.3 });
    route(c, G, chain([o, lp, g]), 0.9, 0.15, 0);
    o.start(t0); o.stop(t0 + 0.34);
    const th = osc(c, 'sine', 90, t0), tg = gain(c, 1);
    sweep(th.frequency, t0, 90, 45, 0.18);
    env(tg.gain, t0, { peak: 0.2, a: 0.003, d: 0.18 });
    route(c, G, chain([th, tg]), 0.95, 0.05, 0);
    th.start(t0); th.stop(t0 + 0.22);
    return 0.36;
  },
  // The widow, struck: a low gong with a sour partial.
  widow(c, G, t0) {
    const g = gain(c, 1);
    env(g.gain, t0, { peak: 0.2, a: 0.004, d: 0.5, sus: 0.2, r: 0.5 });
    [[1, 0.7], [2.41, 0.28], [3.9, 0.12]].forEach(([m, l]) => { const o = osc(c, 'sine', 196 * m, t0), og = gain(c, l); o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + 1.2); });
    route(c, G, g, 0.85, 0.4, 0.1);
    return 1.0;
  },
  // Countdown: a wooden tick, then a bright chord for the start.
  tick(c, G, t0, step) {
    const f = 880 * Math.pow(2, (step || 0) / 12 * 2), o = osc(c, 'sine', f, t0), g = gain(c, 1);
    env(g.gain, t0, { peak: 0.1, a: 0.002, d: 0.07 });
    route(c, G, chain([o, g]), 0.9, 0.12, 0);
    o.start(t0); o.stop(t0 + 0.1);
    return 0.12;
  },
  go(c, G, t0) {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const g = gain(c, 1), o = osc(c, 'triangle', f, t0 + i * 0.02);
      env(g.gain, t0 + i * 0.02, { peak: 0.09, a: 0.004, d: 0.3 });
      route(c, G, chain([o, g]), 0.85, 0.25, 0.1);
      o.start(t0 + i * 0.02); o.stop(t0 + 0.5);
    });
    const sw = noise(c, G, t0, 0.2, 1.4), sf = filter(c, 'highpass', 3000, t0, 0.8), sg = gain(c, 1);
    sweep(sf.frequency, t0, 3000, 8000, 0.18);
    env(sg.gain, t0, { peak: 0.04, a: 0.03, d: 0.15 });
    route(c, G, chain([sw, sf, sg]), 0.5, 0.2, 0);
    return 0.5;
  },
  // A skull earned: one clear bell and a shimmer.
  tier(c, G, t0, step) {
    bell(c, G, t0, ladderFreq(4 + (step || 1) * 2), 0.14, 0.9, 0.4);
    const sh = noise(c, G, t0 + 0.05, 0.35, 1.4), sf = filter(c, 'bandpass', 6500, t0, 2.5), sg = gain(c, 1);
    env(sg.gain, t0 + 0.05, { peak: 0.04, a: 0.05, d: 0.28 });
    route(c, G, chain([sh, sf, sg]), 0.5, 0.3, 0);
    return 1.0;
  },
  // A new wave: a swell of air under a low horn.
  wave(c, G, t0) {
    const o = osc(c, 'sawtooth', 110, t0), lp = filter(c, 'lowpass', 300, t0, 1.2), g = gain(c, 1);
    lp.frequency.exponentialRampToValueAtTime(900, t0 + 0.45);
    env(g.gain, t0, { peak: 0.09, a: 0.25, d: 0.3, sus: 0.3, r: 0.1 });
    route(c, G, chain([o, lp, g]), 0.9, 0.3, 0);
    o.start(t0); o.stop(t0 + 0.8);
    const n = noise(c, G, t0, 0.6, 1), bp = filter(c, 'bandpass', 700, t0, 0.9), ng = gain(c, 1);
    sweep(bp.frequency, t0, 400, 1800, 0.5);
    env(ng.gain, t0, { peak: 0.05, a: 0.3, d: 0.25 });
    route(c, G, chain([n, bp, ng]), 0.6, 0.3, 0);
    return 0.8;
  },
  // Brother Aldous arrives: two low notes, then a bell tolling.
  boss(c, G, t0) {
    [[82.41, 0], [98, 0.32]].forEach(([f, d]) => {
      const t = t0 + d, o = osc(c, 'sawtooth', f, t), o2 = osc(c, 'sawtooth', f * 1.005, t), lp = filter(c, 'lowpass', 420, t, 1.4), g = gain(c, 1);
      env(g.gain, t, { peak: 0.1, a: 0.06, d: 0.45, sus: 0.3, r: 0.2 });
      o.connect(lp); o2.connect(lp); chain([lp, g]);
      route(c, G, g, 0.9, 0.35, 0);
      o.start(t); o.stop(t + 1); o2.start(t); o2.stop(t + 1);
    });
    bell(c, G, t0 + 0.7, 196, 0.11, 1.1, 0.5);
    return 1.8;
  },
  // A coffin goes over the edge: a crash and three knocks going down.
  fell(c, G, t0) {
    const n = noise(c, G, t0, 0.5, 0.9), lp = filter(c, 'lowpass', 2400, t0, 0.8), ng = gain(c, 1);
    sweep(lp.frequency, t0, 2400, 200, 0.45);
    env(ng.gain, t0, { peak: 0.2, a: 0.004, d: 0.4 });
    route(c, G, chain([n, lp, ng]), 0.9, 0.2, 0);
    [90, 70, 55].forEach((f, i) => {
      const t = t0 + 0.12 + i * 0.16, o = osc(c, 'sine', f, t), g = gain(c, 1);
      env(g.gain, t, { peak: 0.22 - i * 0.04, a: 0.003, d: 0.14 });
      route(c, G, chain([o, g]), 0.95, 0.1, 0);
      o.start(t); o.stop(t + 0.2);
    });
    return 0.8;
  },
  // The end of a run: the lights going out.
  fatal(c, G, t0) {
    const o = osc(c, 'sine', 170, t0), g = gain(c, 1);
    sweep(o.frequency, t0, 170, 38, 0.9);
    env(g.gain, t0, { peak: 0.22, a: 0.01, d: 0.85 });
    route(c, G, chain([o, g]), 0.95, 0.3, 0);
    o.start(t0); o.stop(t0 + 1);
    const n = noise(c, G, t0, 0.9, 0.7), lp = filter(c, 'lowpass', 1400, t0, 0.9), ng = gain(c, 1);
    sweep(lp.frequency, t0, 1400, 110, 0.85);
    env(ng.gain, t0, { peak: 0.1, a: 0.01, d: 0.8 });
    route(c, G, chain([n, lp, ng]), 0.7, 0.3, 0);
    return 1.0;
  },
  // A candle speaking: a glassy note, one per candle. `hold` is how long it rings.
  candle(c, G, t0, step, o) {
    const f = CANDLE_NOTES[(step || 0) & 3], hold = o?.hold ?? 0.5, g = gain(c, 1);
    env(g.gain, t0, { peak: 0.12, a: 0.012, d: hold * 0.5, sus: 0.2, r: hold * 0.6 });
    [[1, 0.62], [2, 0.24], [3.01, 0.08]].forEach(([m, l]) => { const s = osc(c, 'sine', vary(f * m, 3), t0), sg = gain(c, l); s.connect(sg); sg.connect(g); s.start(t0); s.stop(t0 + hold * 1.2 + 0.1); });
    route(c, G, g, 0.7, 0.45, 0.2);
    return hold * 1.2;
  },
  // The wrong candle: two neighbouring notes that disagree.
  wrong(c, G, t0) {
    const lp = filter(c, 'lowpass', 900, t0, 1), g = gain(c, 1);
    [233.08, 246.94].forEach(f => { const o = osc(c, 'sawtooth', f, t0); o.connect(lp); o.start(t0); o.stop(t0 + 0.4); });
    env(g.gain, t0, { peak: 0.1, a: 0.01, d: 0.34 });
    chain([lp, g]);
    route(c, G, g, 0.9, 0.2, 0);
    return 0.4;
  },
  // Kept the rhythm: a small high chime.
  chime(c, G, t0, step) {
    bell(c, G, t0, ladderFreq(7 + Math.min(4, step || 0)), 0.08, 0.5, 0.3);
    return 0.55;
  }
};
registerSfx(ARCADE_SFX);

// Fire one of the sounds above. Never throws.
export function sfx(name, step, opts) {
  try { return playSfx(name, { ...opts, step }); } catch { return null; }
}
export function arcadeSoundNames() { return Object.keys(ARCADE_SFX); }

/* ---------- ambient beds ---------- */

const BED_LEVEL = 0.11, DUCKED = 0.2;
let bed = null, wanted = null;

function lfo(c, rate, depth, target, shape = 'sine') {
  const o = osc(c, shape, rate, c.currentTime), d = gain(c, depth);
  o.connect(d); d.connect(target);
  o.start();
  return o;
}
const BEDS = {
  // A warm kitchen hum: two slightly out of tune saws behind a slow filter.
  frenzy(c, G, out) {
    const lp = filter(c, 'lowpass', 240, c.currentTime, 0.7), hum = gain(c, 0.5), srcs = [];
    [55, 55.45, 82.5].forEach((f, i) => { const o = osc(c, i === 2 ? 'triangle' : 'sawtooth', f, c.currentTime), og = gain(c, i === 2 ? 0.5 : 0.7); o.connect(og); og.connect(lp); o.start(); srcs.push(o); });
    chain([lp, hum, out]);
    srcs.push(lfo(c, 0.11, 70, lp.frequency));
    const air = noise(c, G, c.currentTime, 600, 1), af = filter(c, 'bandpass', 3200, c.currentTime, 0.6), ag = gain(c, 0.05);
    chain([air, af, ag, out]); srcs.push(air);
    srcs.push(lfo(c, 0.23, 0.03, ag.gain));
    return srcs;
  },
  // Wind over a hill: gusting noise and a low note a long way down.
  stack(c, G, out) {
    const n = noise(c, G, c.currentTime, 600, 0.8), bp = filter(c, 'bandpass', 420, c.currentTime, 0.8), wg = gain(c, 0.55), srcs = [];
    chain([n, bp, wg, out]); srcs.push(n);
    srcs.push(lfo(c, 0.09, 260, bp.frequency));
    srcs.push(lfo(c, 0.06, 0.28, wg.gain));
    const low = osc(c, 'triangle', 41.2, c.currentTime), lg = gain(c, 0.35);
    chain([low, lg, out]); low.start(); srcs.push(low);
    return srcs;
  },
  // A parlour with something in it: a quiet minor chord and breath above it.
  seance(c, G, out) {
    const lp = filter(c, 'lowpass', 520, c.currentTime, 0.6), pad = gain(c, 0.5), srcs = [];
    [[130.81, 0], [155.56, 3], [196, -2], [261.63, 5]].forEach(([f, det], i) => { const o = osc(c, 'sine', f * Math.pow(2, det / 1200), c.currentTime), og = gain(c, i === 3 ? 0.18 : 0.5); o.connect(og); og.connect(lp); o.start(); srcs.push(o); });
    chain([lp, pad, out]);
    srcs.push(lfo(c, 0.13, 0.25, pad.gain));
    const w = noise(c, G, c.currentTime, 600, 1.1), wf = filter(c, 'bandpass', 5200, c.currentTime, 4), wg = gain(c, 0.04);
    chain([w, wf, wg, out]); srcs.push(w);
    srcs.push(lfo(c, 0.31, 0.035, wg.gain));
    return srcs;
  },
  // A cemetery at night: crickets in bursts, wind, a held low note.
  whack(c, G, out) {
    const srcs = [], t = c.currentTime;
    // The chirp is a fast gate and the burst a slow one, both swinging between 0 and their depth.
    const cr = osc(c, 'sine', 4300, t), chirp = gain(c, 0.25), burst = gain(c, 0.5), cm = gain(c, 0.05);
    chain([cr, chirp, burst, cm, out]); cr.start(); srcs.push(cr);
    srcs.push(lfo(c, 13, 0.25, chirp.gain, 'square'), lfo(c, 0.42, 0.5, burst.gain, 'square'));
    const n = noise(c, G, t, 600, 0.7), bp = filter(c, 'bandpass', 300, t, 0.7), wg = gain(c, 0.3);
    chain([n, bp, wg, out]); srcs.push(n);
    srcs.push(lfo(c, 0.07, 120, bp.frequency));
    const low = osc(c, 'sine', 49, t), lg = gain(c, 0.35);
    chain([low, lg, out]); low.start(); srcs.push(low);
    return srcs;
  }
};

function build(kind) {
  if (isMuted() || !audioAllowed() || !BEDS[kind]) return;
  const c = getCtx();
  if (!c) return;
  const G = graphFor(c), t = c.currentTime;
  const out = gain(c, 0.0001);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(BED_LEVEL, t + 1.4);
  const verb = gain(c, 0.25);
  out.connect(G.master); out.connect(verb); verb.connect(G.verb);
  const sources = BEDS[kind](c, G, out);
  bed = { kind, c, out, sources, ducked: false };
}
function silence(fade = 0.35) {
  if (!bed) return;
  const b = bed;
  bed = null;
  try {
    const t = b.c.currentTime;
    b.out.gain.cancelScheduledValues(t);
    b.out.gain.setValueAtTime(Math.max(b.out.gain.value, 0.0001), t);
    b.out.gain.linearRampToValueAtTime(0.0001, t + fade);
    for (const s of b.sources) { try { s.stop(t + fade + 0.05); } catch { /* already stopped */ } }
    setTimeout(() => { try { b.out.disconnect(); } catch { /* gone */ } }, (fade + 0.2) * 1000);
  } catch { /* a bed must never break a game */ }
}

// Start the bed for a game. It stays wanted until stopBed, so a hidden page or
// a mute toggle can silence it and bring it back.
export function startBed(kind) {
  try {
    if (bed && bed.kind === kind) return true;
    silence(0.2);
    wanted = kind;
    build(kind);
    return !!bed;
  } catch { return false; }
}
export function stopBed(fade = 0.4) { wanted = null; silence(fade); }
// Pause quietens the bed to a murmur; resuming brings it back (and rebuilds it
// if the page was hidden in between).
export function duckBed(on) {
  try {
    if (!on && !bed && wanted && !document.hidden) { build(wanted); return; }
    if (!bed) return;
    const t = bed.c.currentTime;
    bed.ducked = !!on;
    bed.out.gain.cancelScheduledValues(t);
    bed.out.gain.setValueAtTime(Math.max(bed.out.gain.value, 0.0001), t);
    bed.out.gain.linearRampToValueAtTime(on ? BED_LEVEL * DUCKED : BED_LEVEL, t + 0.3);
  } catch { /* quiet failure */ }
}
export function bedState() { return { playing: !!bed, kind: bed?.kind || null, wanted, ducked: !!bed?.ducked }; }

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) silence(0.05); });
}
onMuteChange(muted => { if (muted) silence(0.1); else if (wanted && !bed) build(wanted); });
