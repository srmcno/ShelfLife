import { state, save, onNote } from '../state.js';

/* ---------------------------------------------------------------------------
   Shelf Life — procedural sound
   ---------------------------------------------------------------------------
   Every sound here is synthesised at play time: no audio files, no libraries.
   Each one is built from small layers (oscillator stacks, filtered noise,
   saturation) glued together by a shared master chain with a procedurally
   generated room reverb and a short delay, so the whole set sounds like it
   happens in the same room instead of like eight unrelated beeps.

   Shape of the module:
     getCtx()      lazy AudioContext, created/resumed inside a click handler
     graphFor(c)   per-context master chain (master -> compressor -> out,
                   plus a reverb bus and a delay bus), built once and cached
     SFX[name]     the actual sound design; pure scheduling against (ctx, graph,
                   startTime) so the same code can render into an
                   OfflineAudioContext for testing
     playX()       the exported triggers: mute check, context, dispatch
--------------------------------------------------------------------------- */

const MASTER_GAIN = 0.82;

let ctx = null;
const graphs = new WeakMap();

// Browsers refuse to start audio before the player has touched the page, and
// a context created early sits suspended with every scheduled sound piling up
// at t=0 until the first tap releases them all at once. So: no context, and
// no scheduling, until a real gesture has happened; nothing while the tab is
// hidden either, because a paper tick from a background tab is just noise.
let activated = false;
if (typeof document !== 'undefined') {
  const arm = () => { activated = true; };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, arm, { once: true, passive: true, capture: true }));
}
export function audioAllowed() {
  if (typeof document === 'undefined') return false;
  if (document.hidden) return false;
  if (typeof navigator !== 'undefined' && navigator.userActivation) return navigator.userActivation.hasBeenActive;
  return activated;
}

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // Autoplay policy: the context starts suspended until a gesture resumes it.
  // Every trigger in this game is a click, so resuming here is enough.
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---------- node helpers (all node creation goes through these so the debug
// ---------- trace below can count what each sound actually built) ----------

let trace = null;
function T(kind) { if (trace) trace.nodes.push(kind); }

function gain(c, v) { const n = c.createGain(); n.gain.value = v; T('gain'); return n; }

function osc(c, type, freq, t0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  T('osc:' + type);
  return o;
}

function filter(c, type, freq, t0, q) {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (q != null) f.Q.value = q;
  T('filter:' + type);
  return f;
}

function noise(c, G, t0, dur, rate) {
  const s = c.createBufferSource();
  s.buffer = G.noise;
  s.loop = true;
  s.playbackRate.value = rate || 1;
  // Start somewhere random in the buffer so repeated bursts aren't identical.
  s.start(t0, Math.random() * (NOISE_SECONDS - 0.4));
  s.stop(t0 + dur);
  T('noise');
  return s;
}

const SHAPER_CURVES = new Map();
function shaperCurve(amount) {
  if (SHAPER_CURVES.has(amount)) return SHAPER_CURVES.get(amount);
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x)); // soft saturation
  }
  SHAPER_CURVES.set(amount, curve);
  return curve;
}

function shaper(c, amount) {
  const w = c.createWaveShaper();
  w.curve = shaperCurve(amount);
  w.oversample = '2x';
  T('shaper');
  return w;
}

// Attack (linear, so transients stay punchy) then exponential decay/release.
// Exponential ramps can never reach 0, hence the 0.0001 floors.
function env(param, t0, o) {
  const peak = Math.max(o.peak, 0.0002);
  const a = o.a == null ? 0.004 : o.a;
  const d = o.d == null ? 0.08 : o.d;
  const sus = o.sus == null ? 0 : o.sus;
  const hold = o.hold || 0;
  const r = o.r || 0;
  const level = Math.max(peak * sus, 0.0001);
  param.setValueAtTime(0.0001, t0);
  param.linearRampToValueAtTime(peak, t0 + a);
  param.exponentialRampToValueAtTime(level, t0 + a + d);
  if (hold > 0) param.setValueAtTime(level, t0 + a + d + hold);
  if (r > 0) param.exponentialRampToValueAtTime(0.0001, t0 + a + d + hold + r);
  return t0 + a + d + hold + r;
}

function sweep(param, t0, from, to, dur) {
  param.setValueAtTime(Math.max(from, 1), t0);
  param.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
}

// dry / reverb-send / delay-send in one call.
function route(c, G, node, dry, verb, dly) {
  if (dry > 0) { const g = gain(c, dry); node.connect(g); g.connect(G.master); }
  if (verb > 0) { const g = gain(c, verb); node.connect(g); g.connect(G.verb); }
  if (dly > 0) { const g = gain(c, dly); node.connect(g); g.connect(G.delay); }
}

function chain(nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

const rnd = (a, b) => a + Math.random() * (b - a);
const cents = (f, c) => f * Math.pow(2, c / 1200);
const vary = (f, c) => cents(f, rnd(-c, c)); // slight per-play detune: nothing robotic

// ---------- the shared graph ----------

const NOISE_SECONDS = 2;

function makeNoiseBuffer(c) {
  const len = Math.floor(c.sampleRate * NOISE_SECONDS);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// A small, dark, slightly boxy room — a shelf in a flat, not a cathedral.
function makeImpulse(c, seconds, decay) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += 0.4 * (Math.random() * 2 - 1 - lp); // one-pole lowpass darkens the tail
      d[i] = lp * Math.pow(1 - i / len, decay);
    }
    // Discrete early reflections so it reads as walls rather than as a wash.
    [0.009, 0.017, 0.028, 0.043].forEach((t, k) => {
      const i = Math.floor(t * c.sampleRate) + (ch ? 11 : 0);
      if (i < len) d[i] += (0.46 - k * 0.09) * (ch ? -1 : 1);
    });
  }
  return buf;
}

function graphFor(c) {
  let G = graphs.get(c);
  if (G) return G;

  const master = c.createGain();
  master.gain.value = MASTER_GAIN;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -15;
  comp.knee.value = 14;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  master.connect(comp);
  comp.connect(c.destination);

  const verb = c.createConvolver();
  verb.buffer = makeImpulse(c, 1.0, 2.9);
  const verbTone = c.createBiquadFilter();
  verbTone.type = 'highpass';
  verbTone.frequency.value = 360; // keep the low end out of the tail
  const verbReturn = c.createGain();
  verbReturn.gain.value = 0.85;
  verb.connect(verbTone);
  verbTone.connect(verbReturn);
  verbReturn.connect(master);

  const delay = c.createDelay(0.6);
  delay.delayTime.value = 0.113;
  const dTone = c.createBiquadFilter();
  dTone.type = 'lowpass';
  dTone.frequency.value = 2200;
  const fb = c.createGain();
  fb.gain.value = 0.27;
  const delayReturn = c.createGain();
  delayReturn.gain.value = 0.5;
  delay.connect(dTone);
  dTone.connect(fb);
  fb.connect(delay);
  dTone.connect(delayReturn);
  delayReturn.connect(master);

  G = { master, verb, delay, comp, noise: makeNoiseBuffer(c) };
  graphs.set(c, G);
  return G;
}

/* ---------------------------------------------------------------------------
   The sounds. Each returns its total length in seconds.
--------------------------------------------------------------------------- */

const SFX = {
  // A wet chomp: teeth (bright noise crunch), flesh (resonant squelch),
  // jaw (falling sine thud), then a small gulp on the way down.
  feed(c, G, t0) {
    const k = rnd(0.94, 1.07);

    const crunch = noise(c, G, t0, 0.12, rnd(0.9, 1.15));
    const cf = filter(c, 'bandpass', 2600 * k, t0, 1.1);
    sweep(cf.frequency, t0, 2600 * k, 520 * k, 0.085);
    const cg = gain(c, 1);
    env(cg.gain, t0, { peak: 0.34, a: 0.002, d: 0.09 });
    route(c, G, chain([crunch, cf, shaper(c, 5), cg]), 0.9, 0.06, 0);

    const wet = noise(c, G, t0 + 0.006, 0.2, 0.55);
    const wf = filter(c, 'lowpass', 1500 * k, t0, 9);
    sweep(wf.frequency, t0 + 0.006, 1500 * k, 240 * k, 0.17);
    const wg = gain(c, 1);
    env(wg.gain, t0 + 0.006, { peak: 0.19, a: 0.018, d: 0.16 });
    route(c, G, chain([wet, wf, wg]), 0.85, 0.14, 0);

    const jaw = osc(c, 'sine', 138 * k, t0);
    sweep(jaw.frequency, t0, 138 * k, 52, 0.14);
    const jg = gain(c, 1);
    env(jg.gain, t0, { peak: 0.36, a: 0.005, d: 0.13 });
    route(c, G, chain([jaw, jg]), 1, 0.04, 0);
    jaw.start(t0); jaw.stop(t0 + 0.2);

    const tg = t0 + 0.135;
    const gulp = osc(c, 'triangle', 320 * k, tg);
    sweep(gulp.frequency, tg, 320 * k, 104 * k, 0.09);
    const gf = filter(c, 'lowpass', 950, tg, 4);
    const gg = gain(c, 1);
    env(gg.gain, tg, { peak: 0.13, a: 0.006, d: 0.1 });
    route(c, G, chain([gulp, gf, gg]), 0.9, 0.1, 0);
    gulp.start(tg); gulp.stop(tg + 0.16);

    return 0.45;
  },

  // Warm, but something is listening: a rising major-ish pair with a slow purr
  // tremolo, and a semitone-rub drone that swells in underneath at the end.
  fuss(c, G, t0) {
    const k = rnd(0.985, 1.015);
    const root = 196 * k;   // G3
    const fifth = 293.66 * k; // D4

    const trem = gain(c, 1);
    const lfo = osc(c, 'sine', rnd(6.8, 8.2), t0);
    const lfoAmt = gain(c, 0.2);
    lfo.connect(lfoAmt); lfoAmt.connect(trem.gain);
    lfo.start(t0); lfo.stop(t0 + 0.9);

    const tone = filter(c, 'lowpass', 1700, t0, 0.8);
    sweep(tone.frequency, t0, 1700, 2900, 0.3);
    const body = gain(c, 1);
    env(body.gain, t0, { peak: 0.16, a: 0.07, d: 0.14, sus: 0.55, hold: 0.1, r: 0.28 });

    [[root, -7], [root, 6], [fifth, -5], [fifth, 8]].forEach(([f, det], i) => {
      const o = osc(c, 'triangle', cents(f, det), t0);
      // the whole pair lifts a tone: reassurance that never quite settles
      o.frequency.exponentialRampToValueAtTime(cents(f * 1.122, det), t0 + 0.34);
      const g = gain(c, i < 2 ? 0.55 : 0.32);
      o.connect(g); g.connect(tone);
      o.start(t0); o.stop(t0 + 0.75);
    });
    tone.connect(trem); trem.connect(body);
    route(c, G, body, 0.95, 0.2, 0);

    // The wrong note, quiet and late: a semitone above the root, two octaves down.
    const td = t0 + 0.18;
    const drone = osc(c, 'sine', 103.8, td);
    const dg = gain(c, 1);
    env(dg.gain, td, { peak: 0.065, a: 0.22, d: 0.3, sus: 0.2, r: 0.12 });
    route(c, G, chain([drone, dg]), 0.8, 0.35, 0);
    drone.start(td); drone.stop(td + 0.9);

    return 0.95;
  },

  // Sparkle: four pentatonic glints with delay shimmer over a rising noise swish.
  clean(c, G, t0) {
    const scale = [1567.98, 2093, 2349.32, 3135.96, 4186.01];
    const start = Math.floor(rnd(0, 2));
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * rnd(0.05, 0.075);
      const f = vary(scale[Math.min(start + i, scale.length - 1)], 22);
      const o = osc(c, 'sine', f, t);
      const g = gain(c, 1);
      env(g.gain, t, { peak: 0.17 - i * 0.014, a: 0.003, d: 0.13 });
      route(c, G, chain([o, g]), 0.7, 0.26, 0.2);
      o.start(t); o.stop(t + 0.2);

      const o2 = osc(c, 'triangle', f * 2, t);
      const g2 = gain(c, 1);
      env(g2.gain, t, { peak: 0.035, a: 0.003, d: 0.09 });
      route(c, G, chain([o2, g2]), 0.6, 0.2, 0);
      o2.start(t); o2.stop(t + 0.14);
    }

    const swish = noise(c, G, t0, 0.3, 1);
    const sf = filter(c, 'bandpass', 1800, t0, 1.6);
    sweep(sf.frequency, t0, 1800, 7200, 0.26);
    const sg = gain(c, 1);
    env(sg.gain, t0, { peak: 0.09, a: 0.06, d: 0.22 });
    route(c, G, chain([swish, sf, sg]), 0.5, 0.22, 0);

    return 0.62;
  },

  // A note landing on the shelf: paper slip plus a small dry tick. Fires often,
  // so it stays quiet and short, and moves in pitch when several land at once.
  note(c, G, t0, step) {
    const s = step || 0;
    const paper = noise(c, G, t0, 0.08, rnd(0.9, 1.2));
    const pf = filter(c, 'highpass', 1700, t0, 0.7);
    const pg = gain(c, 1);
    env(pg.gain, t0, { peak: 0.14, a: 0.002, d: 0.055 });
    route(c, G, chain([paper, pf, pg]), 0.8, 0.08, 0);

    const f = vary(720 * Math.pow(1.09, s), 60);
    const tick = osc(c, 'triangle', f, t0);
    sweep(tick.frequency, t0, f, f * 0.86, 0.06);
    const tf = filter(c, 'bandpass', f * 1.6, t0, 2.2);
    const tg = gain(c, 1);
    env(tg.gain, t0, { peak: 0.16, a: 0.002, d: 0.075 });
    route(c, G, chain([tick, tf, tg]), 0.85, 0.12, 0);
    tick.start(t0); tick.stop(t0 + 0.12);

    return 0.14;
  },

  // A feud: a minor second in the bass, saturated and swept shut, with a
  // shivering high cluster and a sub that drops out from under it.
  feud(c, G, t0) {
    const k = rnd(0.99, 1.01);
    const lp = filter(c, 'lowpass', 2400, t0, 7);
    sweep(lp.frequency, t0, 2400, 280, 0.5);
    const body = gain(c, 1);
    env(body.gain, t0, { peak: 0.12, a: 0.006, d: 0.45, sus: 0.25, r: 0.14 });
    const grit = shaper(c, 8);

    [146.83 * k, 155.56 * k].forEach((f, i) => { // D3 against D#3
      const o = osc(c, 'sawtooth', cents(f, i ? 5 : -5), t0);
      const g = gain(c, 0.5);
      o.connect(g); g.connect(grit);
      o.start(t0); o.stop(t0 + 0.75);
    });
    grit.connect(lp); lp.connect(body);
    route(c, G, body, 0.95, 0.3, 0.15);

    const shiver = gain(c, 1);
    env(shiver.gain, t0 + 0.06, { peak: 0.035, a: 0.14, d: 0.34, sus: 0.3, r: 0.16 });
    const vib = osc(c, 'sine', 5.2, t0);
    const vibAmt = gain(c, 9);
    vib.connect(vibAmt);
    vib.start(t0); vib.stop(t0 + 0.8);
    [1244.51, 1318.51].forEach(f => { // D#6 against E6
      const o = osc(c, 'sine', f, t0);
      vibAmt.connect(o.detune);
      const g = gain(c, 0.5);
      o.connect(g); g.connect(shiver);
      o.start(t0); o.stop(t0 + 0.8);
    });
    route(c, G, shiver, 0.7, 0.45, 0);

    const sub = osc(c, 'sine', 92, t0);
    sweep(sub.frequency, t0, 92, 44, 0.5);
    const sg = gain(c, 1);
    env(sg.gain, t0, { peak: 0.13, a: 0.01, d: 0.5 });
    route(c, G, chain([sub, sg]), 1, 0, 0);
    sub.start(t0); sub.stop(t0 + 0.6);

    const breath = noise(c, G, t0 + 0.02, 0.45, 0.7);
    const bf = filter(c, 'bandpass', 820, t0, 1);
    sweep(bf.frequency, t0 + 0.02, 820, 300, 0.4);
    const bg = gain(c, 1);
    env(bg.gain, t0 + 0.02, { peak: 0.05, a: 0.1, d: 0.34 });
    route(c, G, chain([breath, bf, bg]), 0.5, 0.4, 0);

    return 0.95;
  },

  // Something new is available: a plucked A-minor arpeggio that opens up as it
  // climbs, the last note left ringing in the delay.
  unlock(c, G, t0) {
    const notes = [220, 261.63, 329.63, 440];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.085;
      const last = i === notes.length - 1;
      const lp = filter(c, 'lowpass', 1200, t, 1.1);
      sweep(lp.frequency, t, 1200, last ? 4200 : 3200, 0.12);
      const g = gain(c, 1);
      env(g.gain, t, { peak: 0.13, a: 0.006, d: last ? 0.42 : 0.22, sus: last ? 0.12 : 0, r: last ? 0.16 : 0 });
      [[-6, 'triangle', 0.6], [7, 'triangle', 0.5], [0, 'sine', 0.35]].forEach(([det, type, lvl], j) => {
        const o = osc(c, type, cents(vary(f, 8), det) * (j === 2 ? 2 : 1), t);
        const og = gain(c, lvl);
        o.connect(og); og.connect(lp);
        o.start(t); o.stop(t + (last ? 0.9 : 0.4));
      });
      lp.connect(g);
      route(c, G, g, 0.9, 0.24, last ? 0.3 : 0.1);
    });
    return 0.95;
  },

  // Triumphant, in the wrong key: a C-minor fanfare that lands on a held chord
  // with a flat ninth sliding in under it about a beat too late.
  achievement(c, G, t0) {
    const arp = [261.63, 311.13, 392, 523.25]; // C4 Eb4 G4 C5
    arp.forEach((f, i) => {
      const t = t0 + i * 0.1;
      const lp = filter(c, 'lowpass', 700, t, 1.2);
      sweep(lp.frequency, t, 700, 4000, 0.1);
      const g = gain(c, 1);
      env(g.gain, t, { peak: 0.1, a: 0.012, d: 0.1, sus: 0.55, hold: 0.05, r: 0.14 });
      const o1 = osc(c, 'sawtooth', vary(f, 6), t);
      const o2 = osc(c, 'square', cents(vary(f, 6), 6), t);
      const g2 = gain(c, 0.32);
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
      o1.start(t); o1.stop(t + 0.45);
      o2.start(t); o2.stop(t + 0.45);
      route(c, G, g, 0.85, 0.26, 0.12);
    });

    const tc = t0 + 0.34;
    [[523.25, 0.09], [622.25, 0.075], [783.99, 0.065]].forEach(([f, peak]) => { // C5 Eb5 G5
      const lp = filter(c, 'lowpass', 3200, tc, 0.9);
      const g = gain(c, 1);
      env(g.gain, tc, { peak, a: 0.03, d: 0.12, sus: 0.7, hold: 0.24, r: 0.34 });
      const o = osc(c, 'sawtooth', vary(f, 5), tc);
      const o2 = osc(c, 'triangle', cents(f, -6), tc);
      const og = gain(c, 0.45);
      o.connect(lp); o2.connect(og); og.connect(lp); lp.connect(g);
      o.start(tc); o.stop(tc + 0.85);
      o2.start(tc); o2.stop(tc + 0.85);
      route(c, G, g, 0.85, 0.3, 0.16);
    });

    const tw = tc + 0.16;
    const wrong = osc(c, 'triangle', 554.37, tw); // Db5 against the C: the itch
    const wg = gain(c, 1);
    env(wg.gain, tw, { peak: 0.038, a: 0.18, d: 0.24, sus: 0.4, r: 0.3 });
    route(c, G, chain([wrong, wg]), 0.7, 0.4, 0);
    wrong.start(tw); wrong.stop(tw + 1);

    return 1.45;
  },

  // No. Deadpan, low, slightly buzzing, over before it is interesting.
  error(c, G, t0) {
    const lp = filter(c, 'lowpass', 560, t0, 3.2);
    sweep(lp.frequency, t0, 560, 300, 0.2);
    const g = gain(c, 1);
    env(g.gain, t0, { peak: 0.2, a: 0.005, d: 0.19 });
    const grit = shaper(c, 3);
    [110, 116.54].forEach((f, i) => { // A2 against Bb2
      const o = osc(c, i ? 'square' : 'sawtooth', f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 0.93, t0 + 0.2);
      const og = gain(c, i ? 0.35 : 0.5);
      o.connect(og); og.connect(grit);
      o.start(t0); o.stop(t0 + 0.28);
    });
    grit.connect(lp); lp.connect(g);
    route(c, G, g, 1, 0.12, 0);

    const click = noise(c, G, t0, 0.03, 1);
    const cf = filter(c, 'highpass', 2200, t0, 0.7);
    const cg = gain(c, 1);
    env(cg.gain, t0, { peak: 0.05, a: 0.001, d: 0.025 });
    route(c, G, chain([click, cf, cg]), 0.7, 0, 0);

    return 0.28;
  }
};

// ---------- triggers ----------

let lastSound = null;

function play(name, opts) {
  if (state.settings.muted) return null;
  if (!audioAllowed()) return null;
  const c = getCtx();
  if (!c) return null;
  const G = graphFor(c);
  const o = opts || {};
  const t0 = c.currentTime + 0.004 + (o.delay || 0);
  trace = { name, nodes: [] };
  let duration = 0;
  try {
    duration = SFX[name](c, G, t0, o.step) || 0;
  } finally {
    lastSound = { name, at: t0, duration, nodes: trace.nodes, nodeCount: trace.nodes.length, ctxState: c.state };
    trace = null;
  }
  return lastSound;
}

export function playFeed(opts) { return play('feed', opts); }
export function playFuss(opts) { return play('fuss', opts); }
export function playClean(opts) { return play('clean', opts); }
export function playNoteArrive(opts) { return play('note', opts); }
export function playFeud(opts) { return play('feud', opts); }
export function playUnlock(opts) { return play('unlock', opts); }
export function playAchievement(opts) { return play('achievement', opts); }
export function playError(opts) { return play('error', opts); }

// What the last trigger actually built — used by the audio checks, since the
// only other way to know a sound is wired correctly is to hear it.
export function getLastSound() { return lastSound; }
export function soundNames() { return Object.keys(SFX); }

// Renders one sound offline and reports peak/RMS, so a headless check can prove
// a sound is audible, the right length, and not clipping.
export function renderSoundOffline(name, seconds) {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OC || !SFX[name]) return Promise.resolve(null);
  const secs = seconds || 2;
  const c = new OC(2, Math.ceil(44100 * secs), 44100);
  const G = graphFor(c);
  trace = { name, nodes: [] };
  const duration = SFX[name](c, G, 0.01) || 0;
  const nodes = trace.nodes;
  trace = null;
  return c.startRendering().then(buf => {
    let peak = 0, sum = 0, n = 0, lastAudible = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > peak) peak = v;
        if (v > 0.002) lastAudible = Math.max(lastAudible, i);
        sum += d[i] * d[i]; n++;
      }
    }
    return {
      name, declaredDuration: duration, nodeCount: nodes.length, nodes,
      peak: +peak.toFixed(4), rms: +Math.sqrt(sum / n).toFixed(4),
      audibleSeconds: +(lastAudible / buf.sampleRate).toFixed(3),
      clipped: peak > 0.999
    };
  });
}

export function isMuted() { return !!state.settings.muted; }
export function setMuted(v) { state.settings.muted = !!v; save(); }
export function toggleMuted() { setMuted(!isMuted()); return isMuted(); }

// Self-registers so every note gets a cue without note-producing code
// (engine/loop.js, engine/care.js, etc.) needing to know audio exists.
// One click can add several notes at once, so a burst is spread out into a
// little run of rising ticks instead of one mushy stack.
const BURST_WINDOW = 700;
const BURST_MAX = 4;
let burstAt = 0;
let burstCount = 0;

export function initSoundNoteHook() {
  onNote(note => {
    const now = Date.now();
    if (now - burstAt > BURST_WINDOW) burstCount = 0;
    burstAt = now;
    const i = burstCount++;
    if (i >= BURST_MAX) return;
    // 'arrival' is what checkUnlocks and checkAchievements use for their notes,
    // and it's how the unlock/achievement stings get played at all — they were
    // written, exported, and then never called by anything. Routing them through
    // the note hook keeps every caller of those engine functions ignorant of
    // audio, which is the point of this hook existing.
    if (note.kind === 'feud') playFeud({ delay: i * 0.09 });
    else if (note.kind === 'arrival') playAchievement({ delay: i * 0.085 });
    else playNoteArrive({ delay: i * 0.085, step: i });
  });
}
