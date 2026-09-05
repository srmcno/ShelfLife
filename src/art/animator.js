import {
  MOOD_BUBBLES, SLEEP_TALK, PLOTTING_BUBBLES, NOTICE_BUBBLES, TRAVEL_BUBBLES,
  CARE_BUBBLES, DUET_BUBBLES, PROP_POKE_BUBBLES
} from '../content/bubbles.js';
import { resolveMotion, PART_ORIGIN, limbPhase } from './anatomy.js';

// ---------------------------------------------------------------------------
// Animation director
// ---------------------------------------------------------------------------
// CSS loops alone read as "a picture that wobbles": every pet runs the same
// curve forever, so nothing ever *decides* to do anything. This module owns the
// decisions. It keeps a few personality clocks per pet (blink, glance, act) and
// fires short one-shot animations at randomised intervals weighted by mood and
// traits. It also stages the things that make the shelf read as a room rather
// than a row: two neighbours whispering, one shoving another, a pet poking the
// furniture, somebody glaring across a feud line, a sleeper being woken.
//
// Design notes:
//   * ONE shared timer for the whole shelf (18 pets max), not one rAF loop per
//     pet. Each pass is a single querySelectorAll over <20 nodes plus a little
//     arithmetic, so cost is flat regardless of shelf size.
//   * ui/render.js throws away and rebuilds the entire cabinet on every
//     renderShelf, so the director must never hold references to elements. It
//     re-scans the DOM each pass and looks pets up by `data-pet`. Clocks live in
//     a Map keyed by pet id and are pruned once a pet has been missing for a
//     while, so the Map cannot grow without bound.
//   * One-shot animations are cleaned up by a `once` animationend listener, so
//     an element removed mid-behaviour takes its listener with it.
//   * Everything a duet needs about a neighbour is read off the DOM (which slot,
//     which side, awake or not, pet or prop), never from engine state, so the
//     director stays independent of the simulation.
//   * prefers-reduced-motion stops the director entirely (and is watched live).

const TICK_MS = 220;
const GONE_MS = 90000;          // drop a clock this long after its pet vanished
const BUBBLE_MAX = 2;           // concurrent solo thought bubbles across the shelf
const BUBBLE_HARD_MAX = 4;      // including duet replies
const BUBBLE_GAP_MS = 8500;     // global cooldown between solo bubbles
const BUBBLE_LIFE_MS = 3600;
const DUET_GAP_MS = 6500;       // global cooldown between neighbour scenes
const DUET_CHANCE = 0.34;       // when an act fires and a neighbour is available
const POKE_CHANCE = 0.42;       // ... and the neighbour is furniture
const POKE_GAP_MS = 2600;       // global cooldown between furniture pokes
const POKE_PET_GAP = [9000, 22000]; // one pet, the same habit: not more often than this
const ROW = 6;                  // slots per shelf row (matches ui/render.js)

// --- behaviour library -----------------------------------------------------
// `w` is the pick weight per mood; `t` adds weight for MOTION_TRAIT_FLAGS the
// pet carries. `kind:'still'` is the odd one out: instead of playing an
// animation it *pauses* the idle loop, which reads as an unsettling dead stare.
// `gaze` sends the pupils somewhere for the clip: 'dir' looks the way the clip
// leans, 'up' at the ceiling, 'you' straight out at the player.
const ACTS = [
  { id: 'look',     name: 'sl2-look',     ms: 1150, ease: 'cubic-bezier(.4,0,.2,1)', gaze: 'dir',
    dir: true,  w: { content: 3, fine: 4, annoyed: 3, furious: 2, asleep: 0 }, t: { thief: 3, wanderer: 1 } },
  { id: 'hop',      name: 'sl2-hop',      ms: 760,  ease: 'cubic-bezier(.3,.75,.4,1)',
    w: { content: 4, fine: 2, annoyed: 0, furious: 0, asleep: 0 }, t: { wanderer: 2 } },
  { id: 'stretch',  name: 'sl2-stretch',  ms: 1500, ease: 'cubic-bezier(.45,0,.3,1)', gaze: 'up',
    w: { content: 3, fine: 2, annoyed: 1, furious: 0, asleep: 1 } },
  { id: 'shiver',   name: 'sl2-shiver',   ms: 620,  ease: 'linear',
    w: { content: 0, fine: 1, annoyed: 3, furious: 5, asleep: 0 } },
  { id: 'sigh',     name: 'sl2-sigh',     ms: 1700, ease: 'cubic-bezier(.4,0,.5,1)', gaze: 'down',
    w: { content: 1, fine: 2, annoyed: 4, furious: 2, asleep: 2 } },
  { id: 'perk',     name: 'sl2-perk',     ms: 640,  ease: 'cubic-bezier(.2,1.4,.4,1)', gaze: 'you',
    w: { content: 3, fine: 2, annoyed: 1, furious: 1, asleep: 0 }, t: { nocturnal: 2 } },
  { id: 'sway',     name: 'sl2-sway',     ms: 2100, ease: 'ease-in-out',
    dir: true,  w: { content: 3, fine: 3, annoyed: 1, furious: 0, asleep: 1 }, t: { wanderer: 2 } },
  { id: 'wobble',   name: 'sl2-wobble',   ms: 1000, ease: 'cubic-bezier(.3,1.25,.5,1)',
    w: { content: 2, fine: 2, annoyed: 2, furious: 1, asleep: 0 } },
  { id: 'skitter',  name: 'sl2-skitter',  ms: 900,  ease: 'cubic-bezier(.3,0,.2,1)', face: true,
    dir: true,  w: { content: 1, fine: 1, annoyed: 1, furious: 1, asleep: 0 }, t: { wanderer: 6 } },
  { id: 'snatch',   name: 'sl2-snatch',   ms: 840,  ease: 'cubic-bezier(.2,0,.15,1)', gaze: 'dir', body: 'sl-reaching',
    dir: true,  w: { content: 1, fine: 1, annoyed: 1, furious: 1, asleep: 0 }, t: { thief: 6 } },
  { id: 'leanin',   name: 'sl2-leanin',   ms: 1700, ease: 'cubic-bezier(.4,0,.3,1)', gaze: 'dir', squint: true,
    feud: true, w: { content: 0, fine: 2, annoyed: 4, furious: 6, asleep: 0 } },
  { id: 'leanaway', name: 'sl2-leanaway', ms: 1600, ease: 'cubic-bezier(.4,0,.3,1)', gaze: 'dir',
    dir: true,  w: { content: 2, fine: 2, annoyed: 2, furious: 1, asleep: 0 } },
  { id: 'stare',    kind: 'still',        ms: 2200, gaze: 'you',
    w: { content: 0, fine: 1, annoyed: 2, furious: 3, asleep: 0 }, t: { nocturnal: 4 } },
  { id: 'wave',     name: 'sl2-perk',     ms: 900,  ease: 'cubic-bezier(.2,1.2,.4,1)', gaze: 'you',
    req: 'hang', body: 'sl-waving',
    w: { content: 3, fine: 1, annoyed: 0, furious: 0, asleep: 0 } },
  { id: 'thump',    name: 'sl2-wobble',   ms: 1000, ease: 'cubic-bezier(.3,1.25,.5,1)',
    req: 'walk', body: 'sl-tailthump',
    w: { content: 2, fine: 1, annoyed: 2, furious: 3, asleep: 0 } },

  // Anatomy-gated. `req` names a capability from art/anatomy.js; a pet that
  // hasn't got the body for it is simply never offered the behaviour, so
  // today's freehand blobs degrade to the list above without any special-casing.
  // `body` is a class held on the sprite root for the clip's duration, which is
  // what drives the limbs (arms up while hanging, high-stepping while sneaking).
  { id: 'sneak',    name: 'sl2-sneak',    ms: 2900, ease: 'cubic-bezier(.55,0,.2,1)', face: true,
    req: 'sneak', body: 'sl-sneaking', dir: true, gaze: 'dir',
    w: { content: 2, fine: 3, annoyed: 3, furious: 2, asleep: 0 }, t: { thief: 6, wanderer: 3, nocturnal: 2 } },
  { id: 'hang',     name: 'sl2-hang',     ms: 4200, ease: 'cubic-bezier(.4,0,.3,1)',
    req: 'hang', body: 'sl-hanging', dir: true,
    w: { content: 3, fine: 3, annoyed: 2, furious: 1, asleep: 0 }, t: { thief: 2, wanderer: 2 } },
  { id: 'flutter',  name: 'sl2-flutter',  ms: 1700, ease: 'ease-in-out',
    req: 'flap', body: 'sl-flapping', dir: true,
    w: { content: 4, fine: 3, annoyed: 2, furious: 2, asleep: 0 } },
  { id: 'stomp',    name: 'sl2-stomp',    ms: 1250, ease: 'cubic-bezier(.3,0,.2,1)',
    req: 'walk', body: 'sl-stepping', dir: true,
    w: { content: 1, fine: 1, annoyed: 3, furious: 5, asleep: 0 } },
  { id: 'stir',     name: 'sl2-stir',     ms: 1500, ease: 'ease-in-out',
    w: { content: 0, fine: 0, annoyed: 0, furious: 0, asleep: 5 } },
  { id: 'snore',    name: 'sl2-snore',    ms: 2300, ease: 'ease-in-out',
    w: { content: 0, fine: 0, annoyed: 0, furious: 0, asleep: 4 } }
];

// Two-pet scenes. `a` is the initiator's clip, `b` the neighbour's, played
// `delay` ms later. `bDir` says which way the neighbour's clip should point:
// toward the initiator (a listen, a glare back) or away (being shoved). `w` is
// the pick weight by the initiator's mood; `sleeper` scenes only target a
// neighbour that is asleep, `awake` ones only an awake neighbour.
const DUETS = [
  { id: 'whisper', a: { name: 'sl2-whisper', ms: 1700 }, b: { name: 'sl2-listen', ms: 1500, delay: 340 },
    bDir: 'toward', awake: true, w: { content: 3, fine: 3, annoyed: 2, furious: 1 }, plotting: 8, t: { thief: 2, nocturnal: 1 },
    reply: 0.85, dark: false },
  { id: 'nudge',   a: { name: 'sl2-nudge', ms: 1000 }, b: { name: 'sl2-shoved', ms: 900, delay: 380 },
    bDir: 'away', awake: true, w: { content: 2, fine: 2, annoyed: 3, furious: 3 }, t: { wanderer: 2 }, reply: 0.9 },
  { id: 'glare',   a: { name: 'sl2-glare', ms: 1600 }, b: { name: 'sl2-glare', ms: 1600, delay: 240 },
    bDir: 'toward', awake: true, squint: true, w: { content: 0, fine: 1, annoyed: 3, furious: 4 }, feud: 9, reply: 0.7, dark: true },
  { id: 'poke',    a: { name: 'sl2-poke', ms: 1100 }, b: { name: 'sl2-startle', ms: 900, delay: 520 },
    bDir: 'toward', sleeper: true, w: { content: 3, fine: 3, annoyed: 3, furious: 3 }, t: { thief: 2, nocturnal: 3 }, reply: 0.95 },
  { id: 'sniff',   a: { name: 'sl2-sniff', ms: 1500 }, b: { name: 'sl2-shuffle', ms: 1200, delay: 620 },
    bDir: 'toward', awake: true, w: { content: 2, fine: 2, annoyed: 1, furious: 0 }, reply: 0.8 },
  { id: 'mirror',  a: { name: 'sl2-mirror', ms: 900 }, b: { name: 'sl2-mirror', ms: 900, delay: 150 },
    bDir: 'toward', awake: true, w: { content: 4, fine: 1, annoyed: 0, furious: 0 }, reply: 0.6 }
];
const DUET_EASE = 'cubic-bezier(.4,0,.25,1)';

// How long a pet waits between idle behaviours, by mood. Furious creatures
// fidget constantly; sleeping ones barely move.
const ACT_GAP = {
  content: [1600, 4200],
  fine:    [2100, 5400],
  annoyed: [1300, 3600],
  furious: [900,  2600],
  asleep:  [4200, 11000]
};
const BLINK_GAP = {
  content: [1900, 5200],
  fine:    [2100, 6200],
  annoyed: [1200, 3800],
  furious: [900,  2800],
  asleep:  [9000, 20000]
};
// Pupils drift on their own between behaviours: a glance at the neighbour, at
// the ceiling, at you. Paused for sleepers.
const GLANCE_GAP = {
  content: [2400, 6800],
  fine:    [2000, 6000],
  annoyed: [1400, 4200],
  furious: [900,  3000],
  asleep:  [1e9, 1e9]
};

// Care reactions. `fuss` splits: a content pet wiggles, a fed-up one recoils.
// `notice` is the whole shelf clocking that you have looked at it.
const REACTIONS = {
  food:    { name: 'sl2-chomp',    ms: 860, ease: 'cubic-bezier(.3,1.15,.4,1)', gaze: 'down' },
  fuss:    { name: 'sl2-wiggle',   ms: 950, ease: 'cubic-bezier(.35,.85,.4,1)', gaze: 'up' },
  fussbad: { name: 'sl2-recoil',   ms: 860, ease: 'cubic-bezier(.3,0,.2,1)', dir: true, gaze: 'dir' },
  clean:   { name: 'sl2-shakeoff', ms: 780, ease: 'linear' },
  rounds:  { name: 'sl2-perk',     ms: 640, ease: 'cubic-bezier(.2,1.4,.4,1)', gaze: 'you' },
  notice:  { name: 'sl2-perk',     ms: 640, ease: 'cubic-bezier(.2,1.4,.4,1)', gaze: 'you' },
  noticebad: { name: 'sl2-look',   ms: 1000, ease: 'cubic-bezier(.4,0,.2,1)', dir: true, gaze: 'you', squint: true }
};

const MOODS = ['content', 'fine', 'annoyed', 'furious'];

// --- module state ----------------------------------------------------------

const clocks = new Map();       // petId -> { act, blink, glance, gazeUntil, busy, seen }
let timer = null;
let started = false;
let getPet = () => null;
let lastBubble = 0;
let lastDuet = 0;
let lastPoke = 0;
const recentBubbles = [];
let reduced = null;

function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
// A bubble line the shelf has not shown in the last little while.
function pickFresh(a) {
  let line = pickOne(a);
  for (let i = 0; i < 4 && recentBubbles.indexOf(line) !== -1; i++) line = pickOne(a);
  return line;
}
function chance(p) { return Math.random() < p; }

function spritesFor(id) {
  return document.querySelectorAll('.sprite.sl2[data-pet="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
}

function moodOfEl(el) {
  if (el.classList.contains('sl-asleep')) return 'asleep';
  for (let i = 0; i < MOODS.length; i++) {
    if (el.classList.contains('sl-mood-' + MOODS[i])) return MOODS[i];
  }
  return 'fine';
}

function isFeuding(el) {
  return el.classList.contains('sl-feud-left') || el.classList.contains('sl-feud-right');
}

// Which side the feud partner is on: css pins --sl-dir toward them.
function feudDir(el) {
  if (el.classList.contains('sl-feud-left')) return 1;
  if (el.classList.contains('sl-feud-right')) return -1;
  return 0;
}

function clockFor(id, now) {
  let c = clocks.get(id);
  if (!c) {
    // Stagger first behaviours so a freshly-rendered shelf doesn't all fire
    // on the same pass.
    c = { act: now + rand(400, 3800), blink: now + rand(200, 4200), glance: now + rand(600, 3000), gazeUntil: 0, busy: 0, poke: 0, seen: now };
    clocks.set(id, c);
  }
  return c;
}

// --- applying motion -------------------------------------------------------

function setDir(el, dir) {
  el.style.setProperty('--sl-dir', dir < 0 ? '-1' : '1');
}

function playAnim(el, name, ms, ease, dir) {
  const act = el.querySelector('.sprite-act');
  if (!act) return;
  // A pet mid-feud has its facing pinned by a CSS class; everyone else picks a
  // side per behaviour so they don't always turn the same way.
  if (dir === true && !isFeuding(el)) setDir(el, Math.random() < 0.5 ? -1 : 1);
  else if (typeof dir === 'number' && dir) setDir(el, dir);
  act.style.animation = 'none';
  void act.offsetWidth;                       // force a reflow so it restarts
  act.style.animation = name + ' ' + ms + 'ms ' + (ease || DUET_EASE) + ' 1';
  act.addEventListener('animationend', () => { act.style.animation = ''; }, { once: true });
}

function holdClass(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

function blink(el, deep) {
  holdClass(el, 'sl-blink', 165);
  if (deep) holdClass(el, 'sl-blink-deep', 240);
}

// Pupils. x is -1 (left) .. 1 (right), y is -1 (up) .. 1 (down). Only
// generated creatures have pupils to move; on a drawing this is a harmless
// no-op. The clock's gazeUntil resets it, so a rebuilt element never leaks a
// stale timer.
function gaze(el, x, y, ms) {
  el.style.setProperty('--sl-gaze-x', String(x));
  el.style.setProperty('--sl-gaze-y', String(y));
  const c = clocks.get(el.dataset.pet);
  if (c) c.gazeUntil = Date.now() + (ms || 1200);
}

function gazeFor(el, kind, dir) {
  if (!kind) return;
  const d = dir || Number(el.style.getPropertyValue('--sl-dir')) || feudDir(el) || 1;
  if (kind === 'dir') gaze(el, d, 0.1, 1400);
  else if (kind === 'up') gaze(el, rand(-0.4, 0.4), -1, 1300);
  else if (kind === 'down') gaze(el, rand(-0.3, 0.3), 0.9, 1100);
  else if (kind === 'you') gaze(el, 0, 0.35, 1600);
}

// Face the way you are going: the whole figure mirrors. Reset a beat after the
// clip so the pet visibly turns back to the room.
function face(el, dir, ms) {
  el.style.setProperty('--sl-face', dir < 0 ? '-1' : '1');
  setTimeout(() => el.style.removeProperty('--sl-face'), ms);
}

function runAct(el, act) {
  if (act.kind === 'still') { holdClass(el, 'sl-still', act.ms); gazeFor(el, act.gaze); return; }
  playAnim(el, act.name, act.ms, act.ease, act.dir);
  if (act.body) holdClass(el, act.body, act.ms);
  if (act.squint) holdClass(el, 'sl-squint', act.ms);
  if (act.face && !isFeuding(el)) face(el, Number(el.style.getPropertyValue('--sl-dir')) || 1, act.ms + 500);
  gazeFor(el, act.gaze);
}

// --- anatomy prep ----------------------------------------------------------
// Runs once per sprite element (elements are thrown away and rebuilt on every
// renderShelf, so "once per element" is also "once per render, per pet").
// Everything it writes is derived, never authored by hand: capability classes
// the behaviour picker reads, a gait name locomotion CSS keys off, and a phase
// offset per limb so a pair alternates and six legs ripple.

// Lets the resolver work off the DOM alone when no state lookup is available
// (a detached portrait, or a standalone fixture page).
function shimFromDom(el) {
  // Limb elements are the strongest DOM-only evidence: count them and hand the
  // resolver a real anatomy block. This is what makes a generated creature move
  // correctly even with no state lookup wired up at all.
  const n = { leg: 0, arm: 0, wing: 0, tail: 0, tentacle: 0 };
  el.querySelectorAll('[data-part]').forEach(p => {
    if (p.dataset.part in n) n[p.dataset.part]++;
  });
  const legs = n.leg + n.tentacle;
  if (legs || n.arm || n.wing || n.tail) {
    return { anatomy: {
      hasLegs: legs > 0, legCount: legs,
      hasArms: n.arm > 0, armCount: n.arm,
      hasWings: n.wing > 0, wingCount: n.wing,
      hasTail: n.tail > 0, tailCount: n.tail,
      hasTentacles: n.tentacle > 0
    } };
  }
  const stamps = [];
  el.querySelectorAll('.sprite-stamp[data-kind]').forEach(s => stamps.push({ kind: s.dataset.kind }));
  return { art: { stamps } };
}

function prepSprite(el) {
  const pet = getPet(el.dataset.pet);
  const mot = resolveMotion(pet || shimFromDom(el));
  el.dataset.slGait = mot.gait;
  if (mot.canWalk) el.classList.add('sl-can-walk');
  if (mot.canSneak) el.classList.add('sl-can-sneak');
  if (mot.canHang) el.classList.add('sl-can-hang');
  if (mot.canFlap) el.classList.add('sl-can-flap');

  const parts = el.querySelectorAll('[data-part]');
  if (parts.length) {
    const counts = {};
    parts.forEach(p => { const k = p.dataset.part; counts[k] = (counts[k] || 0) + 1; });
    const seen = {};
    parts.forEach(p => {
      const kind = p.dataset.part;
      const i = p.dataset.index != null && p.dataset.index !== ''
        ? Number(p.dataset.index) : (seen[kind] || 0);
      seen[kind] = (seen[kind] || 0) + 1;
      p.classList.add('sl-part');
      p.style.setProperty('--sl-ph', String(limbPhase(kind, i, counts[kind])));
      // data-pivot-x/y means the part's own origin already IS the joint (the
      // creature generator's convention); CSS handles those with
      // transform-box:view-box + transform-origin:0 0, so leave them alone.
      if (p.dataset.pivotX != null) {
        /* exact pivot, nothing to compute */
      } else if (p.dataset.pivot) {
        const xy = p.dataset.pivot.split(/[\s,]+/);
        if (xy.length === 2) p.style.transformOrigin = xy[0] + 'px ' + xy[1] + 'px';
      } else if (PART_ORIGIN[kind]) {
        p.style.transformOrigin = PART_ORIGIN[kind];
      }
    });
    el.classList.add('sl-has-limbs');
  }
  el.dataset.slPrep = '1';
}

// --- travel (FLIP) ---------------------------------------------------------
// ui/render.js rebuilds the cabinet wholesale, so a pet that changed slots is a
// brand-new element in a new place. Capture where every pet was before the
// rebuild, then play the difference back as movement: a beat of hesitation, a
// glance, then a characterful crossing that depends on the body doing it. A
// walker plods with a small bob, a hopper bounces the whole way in parabolas, a
// flyer lifts into a high arc and flaps, a scuttler darts flat and twitchy, and
// an ooze stretches forward and hauls the rest of itself after.

const GAIT_PACE = { walk: 2.1, scuttle: 1.4, flap: 1.9, hop: 2.4, ooze: 3.3 };

export function captureShelfPositions(root) {
  const map = new Map();
  if (!root || (reduced && reduced.matches)) return map;
  const base = root.getBoundingClientRect();
  root.querySelectorAll('.pet[data-id]').forEach(el => {
    const r = el.getBoundingClientRect();
    map.set(el.dataset.id, { x: r.left - base.left, y: r.top - base.top, slot: el.dataset.slot });
  });
  return map;
}

export function playShelfMoves(root, before) {
  if (!root || !before || !before.size || (reduced && reduced.matches)) return;
  const base = root.getBoundingClientRect();
  root.querySelectorAll('.pet[data-id]').forEach(el => {
    const prev = before.get(el.dataset.id);
    if (!prev) return;
    // Only a genuine change of slot counts as travel. Comparing pixels alone
    // would make the whole shelf "walk" whenever a row collapses or expands and
    // shifts everything below it.
    if (prev.slot === el.dataset.slot) return;
    const r = el.getBoundingClientRect();
    const dx = prev.x - (r.left - base.left);
    const dy = prev.y - (r.top - base.top);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    travel(el, dx, dy);
  });
}

// Keyframes from the old position (dx,dy) back to rest (0,0), shaped per gait.
// Offsets must be monotonic, so every gait fills the same 0.14 .. 0.9 window.
function travelKeyframes(gait, dx, dy, dist) {
  const kf = [];
  const T0 = 0.14, T1 = 0.9;
  const at = (t, f, lift, scale, easing) => kf.push({
    offset: Math.min(1, Math.max(0, t)),
    transform: 'translate(' + (dx * (1 - f)).toFixed(1) + 'px,' + (dy * (1 - f) - (lift || 0)).toFixed(1) + 'px)' + (scale ? ' scale(' + scale + ')' : ''),
    easing: easing || 'ease-in-out'
  });
  at(0, 0, 0, null, 'ease-out');
  at(T0, 0, 0, null, 'cubic-bezier(.5,0,.25,1)');
  if (gait === 'hop') {
    const n = Math.max(2, Math.min(5, Math.round(dist / 70)));
    const arc = Math.min(26, 12 + dist * 0.06);
    for (let i = 0; i < n; i++) {
      const a = T0 + (T1 - T0) * i / n, b = T0 + (T1 - T0) * (i + 1) / n, m = (a + b) / 2;
      at(m, (m - T0) / (T1 - T0), arc, '.94,1.06', 'ease-out');
      at(b, (b - T0) / (T1 - T0), 0, i === n - 1 ? null : '1.08,.92', 'ease-in');
    }
  } else if (gait === 'flap') {
    const arc = Math.min(64, 24 + dist * 0.28);
    at(0.3, 0.22, arc * 0.7, null, 'ease-in-out');
    at(0.56, 0.58, arc, null, 'ease-in-out');
    at(0.8, 0.9, arc * 0.3, null, 'ease-in');
    at(T1, 1, -2, '1.04,.96', 'ease-out');
  } else if (gait === 'ooze') {
    at(0.34, 0.3, 0, '1.26,.84', 'cubic-bezier(.6,0,.4,1)');
    at(0.5, 0.42, 0, '.92,1.1', 'ease-in-out');
    at(0.68, 0.74, 0, '1.22,.86', 'cubic-bezier(.6,0,.4,1)');
    at(T1, 1, 0, '.96,1.04', 'ease-out');
  } else if (gait === 'scuttle') {
    at(0.26, 0.38, 2, null, 'linear');
    at(0.34, 0.44, -1, null, 'linear');
    at(0.42, 0.6, 2, null, 'linear');
    at(0.5, 0.64, 0, null, 'ease-out');       // a freeze mid-crossing
    at(0.62, 0.64, 0, null, 'linear');
    at(0.78, 0.96, 1, null, 'linear');
    at(T1, 1, 0, null, 'ease-out');
  } else {
    at(0.34, 0.28, 3, '.98,1.02', 'ease-in-out');
    at(0.52, 0.52, 0, '1.03,.97', 'ease-in-out');
    at(0.7, 0.76, 3, '.98,1.02', 'ease-in-out');
    at(T1, 1, 0, null, 'cubic-bezier(.3,1.35,.5,1)');
  }
  at(1, 1, 0, null, 'ease-out');
  return kf;
}

function travel(el, dx, dy) {
  if (typeof el.animate !== 'function') return;
  const sprite = el.querySelector('.sprite.sl2');
  // The director's own pass may not have reached this freshly-built element
  // yet, and travel needs its gait, so prep it now if nobody has.
  if (sprite && !sprite.dataset.slPrep) prepSprite(sprite);
  const dist = Math.hypot(dx, dy);
  const gait = (sprite && sprite.dataset.slGait) || 'hop';
  const dur = Math.min(2400, Math.max(560, 430 + dist * (GAIT_PACE[gait] || 2.1)));
  const gaitCls = 'sl-gait-' + gait;
  // dx is old-minus-new, so a negative dx means the pet ended up further right.
  const dir = dx < 0 ? 1 : -1;

  if (sprite) {
    setDir(sprite, dir);
    if (Math.abs(dx) > 6) face(sprite, dir, dur + 700);
    const step = Math.min(430, Math.max(150, dur / Math.max(3, Math.round(dist / 26))));
    sprite.style.setProperty('--sl-gait-dur', Math.round(gait === 'scuttle' ? step * 0.55 : step) + 'ms');
    sprite.style.setProperty('--sl-travel-dur', Math.round(dur) + 'ms');
    const act = sprite.querySelector('.sprite-act');
    if (act) act.style.animation = '';     // let the travel class rule take over
    sprite.classList.add('sl-travel', gaitCls);
    gaze(sprite, dir, 0.2, dur);
  }
  el.style.zIndex = '5';
  el.style.transformOrigin = '50% 100%';

  const anim = el.animate(travelKeyframes(gait, dx, dy, dist), { duration: dur, fill: 'none' });

  const done = () => {
    el.style.zIndex = '';
    el.style.transformOrigin = '';
    if (sprite) {
      sprite.classList.remove('sl-travel', gaitCls);
      const act = sprite.querySelector('.sprite-act');
      if (act) act.style.animation = '';
    }
  };
  anim.onfinish = done;
  anim.oncancel = done;

  const c = clocks.get(el.dataset.id);
  if (c) { c.act = Date.now() + dur + rand(500, 1600); c.busy = Date.now() + dur; }
  if (sprite && chance(0.3)) setTimeout(() => solo(sprite, pickFresh(TRAVEL_BUBBLES)), Math.round(dur * 0.3));
}

// --- picking what to do ----------------------------------------------------

function chooseAct(el, mood) {
  const feuding = isFeuding(el);
  let total = 0;
  const pool = [];
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i];
    if (a.feud && !feuding) continue;
    if (a.req && !el.classList.contains('sl-can-' + a.req)) continue;
    let w = a.w[mood] || 0;
    if (mood === 'asleep' && !w) continue;
    if (mood !== 'asleep' && el.classList.contains('sl-plotting') && ['sneak', 'snatch', 'look'].includes(a.id)) w += 9;
    if (a.t) {
      for (const flag in a.t) if (el.classList.contains('sl-t-' + flag)) w += a.t[flag];
    }
    if (w <= 0) continue;
    total += w;
    pool.push([a, total]);
  }
  if (!pool.length) return null;
  const r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) if (r < pool[i][1]) return pool[i][0];
  return pool[pool.length - 1][0];
}

// --- neighbours ------------------------------------------------------------
// Everything about who is next door is read off the cabinet DOM: the slot
// index on the wrapper, whether the occupant is a pet or a prop, whether it is
// asleep. Same-row only; a pet does not whisper through a plank.

function neighboursOf(el) {
  const slot = el.closest('.slot');
  if (!slot) return [];
  const i = Number(slot.dataset.slot);
  if (!Number.isFinite(i)) return [];
  const row = slot.parentElement;
  if (!row) return [];
  const out = [];
  [[i - 1, -1], [i + 1, 1]].forEach(([j, dir]) => {
    if (j < 0 || Math.floor(j / ROW) !== Math.floor(i / ROW)) return;
    const s = row.querySelector('.slot[data-slot="' + j + '"]');
    if (!s) return;
    const pet = s.querySelector('.pet .sprite.sl2[data-pet]');
    if (pet) { out.push({ kind: 'pet', el: pet, slot: s, dir }); return; }
    const prop = s.querySelector('.prop[data-prop]');
    if (prop) out.push({ kind: 'prop', el: prop, slot: s, dir });
  });
  return out;
}

function chooseDuet(el, mood, nb, now) {
  const bMood = moodOfEl(nb.el);
  const bAsleep = bMood === 'asleep';
  const bc = clocks.get(nb.el.dataset.pet);
  if (bc && bc.busy > now) return null;
  const partner = feudDir(el) === nb.dir;
  let total = 0;
  const pool = [];
  for (let i = 0; i < DUETS.length; i++) {
    const d = DUETS[i];
    if (d.sleeper && !bAsleep) continue;
    if (d.awake && bAsleep) continue;
    let w = d.w[mood] || 0;
    if (partner && d.feud) w += d.feud;
    if (!partner && d.id === 'glare' && mood !== 'furious') w = Math.max(0, w - 1);
    if (d.plotting && el.classList.contains('sl-plotting')) w += d.plotting;
    if (d.t) for (const flag in d.t) if (el.classList.contains('sl-t-' + flag)) w += d.t[flag];
    if (w <= 0) continue;
    total += w;
    pool.push([d, total]);
  }
  if (!pool.length) return null;
  const r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) if (r < pool[i][1]) return pool[i][0];
  return pool[pool.length - 1][0];
}

function runDuet(el, id, mood, nb, duet, now) {
  const b = nb.el;
  const bId = b.dataset.pet;
  const dirA = nb.dir;
  const dirB = duet.bDir === 'away' ? dirA : -dirA;
  const pinnedA = isFeuding(el), pinnedB = isFeuding(b);

  playAnim(el, duet.a.name, duet.a.ms, DUET_EASE, dirA);
  gaze(el, dirA, 0.15, duet.a.ms + 300);
  if (duet.squint) holdClass(el, 'sl-squint', duet.a.ms);
  if (duet.id === 'nudge' || duet.id === 'poke') holdClass(el, 'sl-reaching', Math.min(900, duet.a.ms));
  if (pinnedA) setTimeout(() => el.style.removeProperty('--sl-dir'), duet.a.ms + 50);

  setTimeout(() => {
    if (!b.isConnected) return;
    playAnim(b, duet.b.name, duet.b.ms, DUET_EASE, dirB);
    if (moodOfEl(b) !== 'asleep') gaze(b, -dirA, 0.1, duet.b.ms + 400);
    if (duet.squint) holdClass(b, 'sl-squint', duet.b.ms);
    if (pinnedB) setTimeout(() => b.style.removeProperty('--sl-dir'), duet.b.ms + 50);
  }, duet.b.delay);

  // The two halves of the exchange. The reply is the joke, so it is the half
  // that almost always shows; the opener only sometimes.
  const lines = DUET_BUBBLES[duet.id];
  if (lines && document.querySelectorAll('.sl-bubble').length < BUBBLE_HARD_MAX - 1) {
    const opened = chance(0.62);
    if (opened) bubble(el.closest('.slot'), pickFresh(lines.a), duet.dark ? 'bubble-dark' : '');
    if (chance(opened ? duet.reply : duet.reply * 0.7)) {
      setTimeout(() => { if (b.isConnected) bubble(b.closest('.slot'), pickFresh(lines.b), 'bubble-reply' + (duet.dark ? ' bubble-dark' : '')); }, duet.b.delay + 420);
    }
    lastBubble = now;
  }

  const ca = clockFor(id, now), cb = clockFor(bId, now);
  ca.act = now + duet.a.ms + rand(1400, 3200); ca.busy = now + duet.a.ms;
  cb.act = Math.max(cb.act, now + duet.b.delay + duet.b.ms + rand(900, 2600)); cb.busy = now + duet.b.delay + duet.b.ms;
  lastDuet = now;
}

// Poking the furniture: the pet reaches toward the prop, the prop rocks (or,
// for a thief or a furious pet, gets properly knocked), and the pet thinks
// something short about it.
function runPoke(el, id, mood, nb, now) {
  const prop = nb.el;
  const kind = prop.dataset.prop;
  playAnim(el, 'sl2-poke', 1100, DUET_EASE, nb.dir);
  holdClass(el, 'sl-reaching', 900);
  gaze(el, nb.dir, 0.3, 1500);
  if (isFeuding(el)) setTimeout(() => el.style.removeProperty('--sl-dir'), 1150);
  const hard = (el.classList.contains('sl-t-thief') && chance(0.45)) || (mood === 'furious' && chance(0.55));
  setTimeout(() => {
    if (!prop.isConnected) return;
    holdClass(prop, hard ? 'sl-knocked' : 'sl-jostle', hard ? 1100 : 750);
  }, 480);
  if (chance(0.75)) {
    const pool = PROP_POKE_BUBBLES[kind] || PROP_POKE_BUBBLES._default;
    setTimeout(() => { if (el.isConnected) solo(el, pickFresh(pool), true); }, 700);
  }
  const c = clockFor(id, now);
  c.act = now + 1100 + rand(1200, 3000); c.busy = now + 1100;
  c.poke = now + rand(POKE_PET_GAP[0], POKE_PET_GAP[1]);
  lastPoke = now;
}

// --- thought bubbles -------------------------------------------------------
// The pets already have a great deal of written personality; a bubble borrows a
// short fragment of it, or one of the purpose-written thoughts in
// content/bubbles.js. Deliberately rationed: at most two solo bubbles on
// screen, a global cooldown, and only ever a short clause.

function bubble(slot, text, cls) {
  if (!slot || !text) return null;
  const b = document.createElement('div');
  b.className = 'sl-bubble' + (cls ? ' ' + cls : '');
  b.setAttribute('aria-hidden', 'true');
  b.textContent = text;
  recentBubbles.push(text);
  if (recentBubbles.length > 14) recentBubbles.shift();
  slot.appendChild(b);
  setTimeout(() => { b.classList.add('out'); }, BUBBLE_LIFE_MS - 400);
  setTimeout(() => { b.remove(); }, BUBBLE_LIFE_MS);
  return b;
}

// A solo bubble over one pet, subject to the ration. `force` skips the global
// cooldown (a reply to being cared for should not be lost to it) but never the
// hard cap or the card-portrait rule.
function solo(el, text, force, cls) {
  const now = Date.now();
  if (!force && now - lastBubble < BUBBLE_GAP_MS) return false;
  const open = document.querySelectorAll('.sl-bubble').length;
  if (open >= (force ? BUBBLE_HARD_MAX : BUBBLE_MAX)) return false;
  const slot = el.closest('.slot');
  if (!slot) return false;                    // card portrait: never bubbles
  if (slot.querySelector('.sl-bubble')) return false;
  lastBubble = now;
  bubble(slot, text, cls);
  return true;
}

// A thought is always first person and always short: a bubble is what the
// creature is thinking, not the shelf's report about it (that is the notes).
function thought(el, mood) {
  if (el.classList.contains('sl-plotting') && mood !== 'asleep') return pickFresh(PLOTTING_BUBBLES);
  if (mood === 'asleep') return pickFresh(SLEEP_TALK);
  return pickFresh(MOOD_BUBBLES[mood] || MOOD_BUBBLES.fine);
}

function zzz(el) {
  const slot = el.closest('.slot');
  if (!slot || slot.querySelector('.sl-zzz')) return;
  const z = document.createElement('span');
  z.className = 'sl-zzz';
  z.setAttribute('aria-hidden', 'true');
  z.textContent = pickOne(['z', 'zz', 'zzz', 'z z']);
  slot.appendChild(z);
  setTimeout(() => z.remove(), 2700);
}

// --- the shared loop -------------------------------------------------------

function pass() {
  if (document.hidden) return;
  const now = Date.now();
  const els = document.querySelectorAll('.sprite.sl2[data-pet]');

  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const id = el.dataset.pet;
    // Cheap, and only ever runs on elements this pass has not seen before,
    // which after a renderShelf is every element, exactly once.
    if (!el.dataset.slPrep) prepSprite(el);
    const mood = moodOfEl(el);
    const c = clockFor(id, now);
    c.seen = now;

    if (c.gazeUntil && now >= c.gazeUntil) {
      c.gazeUntil = 0;
      el.style.removeProperty('--sl-gaze-x');
      el.style.removeProperty('--sl-gaze-y');
    }

    if (now >= c.blink) {
      const g = BLINK_GAP[mood] || BLINK_GAP.fine;
      c.blink = now + rand(g[0], g[1]);
      if (mood !== 'asleep' || Math.random() < 0.4) blink(el, Math.random() < 0.16);
    }

    if (now >= c.glance && mood !== 'asleep' && !c.gazeUntil) {
      const g = GLANCE_GAP[mood] || GLANCE_GAP.fine;
      c.glance = now + rand(g[0], g[1]);
      // Mostly sideways (at a neighbour), sometimes up, occasionally straight
      // out at whoever is holding the phone.
      const r = Math.random();
      if (r < 0.55) gaze(el, pickOne([-1, -0.6, 0.6, 1]), rand(-0.2, 0.4), rand(900, 2200));
      else if (r < 0.8) gaze(el, rand(-0.5, 0.5), -0.9, rand(700, 1600));
      else gaze(el, 0, 0.3, rand(1200, 2600));
    }

    if (now >= c.act && c.busy <= now) {
      const g = ACT_GAP[mood] || ACT_GAP.fine;
      c.act = now + rand(g[0], g[1]);

      // Prefer a scene with the neighbour when one is on offer and the shelf
      // has been quiet for a moment.
      if (mood !== 'asleep') {
        const nbs = neighboursOf(el);
        if (nbs.length) {
          const nb = pickOne(nbs);
          if (nb.kind === 'pet' && now - lastDuet >= DUET_GAP_MS && chance(DUET_CHANCE)) {
            const duet = chooseDuet(el, mood, nb, now);
            if (duet) { runDuet(el, id, mood, nb, duet, now); continue; }
          } else if (nb.kind === 'prop' && now - lastPoke >= POKE_GAP_MS && now >= c.poke &&
                     chance(POKE_CHANCE + (el.classList.contains('sl-t-thief') ? 0.25 : 0))) {
            runPoke(el, id, mood, nb, now);
            continue;
          }
        }
      }

      const choice = chooseAct(el, mood);
      if (choice) {
        runAct(el, choice);
        c.act += choice.ms;
        c.busy = now + Math.min(choice.ms, 1600);
        if (mood === 'asleep') {
          if (chance(0.6)) zzz(el);
          else if (chance(0.15)) solo(el, thought(el, mood), false, 'bubble-dark');
        } else if (Math.random() < 0.3) {
          solo(el, thought(el, mood));
        }
      }
    }
  }

  // Prune clocks for pets that are gone (rehomed, or simply not rendered).
  // The Map only ever holds one small record per pet, and anything unseen for
  // GONE_MS is dropped, so repeated renderShelf calls cannot grow it.
  clocks.forEach((c, id) => { if (now - c.seen > GONE_MS) clocks.delete(id); });
}

// --- public API ------------------------------------------------------------

function stop() {
  if (timer !== null) { clearInterval(timer); timer = null; }
  document.querySelectorAll('.sl-bubble,.sl-zzz').forEach(b => b.remove());
}

function start() {
  if (timer !== null || (reduced && reduced.matches)) return;
  timer = setInterval(pass, TICK_MS);
}

// Call once at boot. `getPet(id)` lets the director resolve a pet's anatomy
// (gait, limbs) without animator.js importing state.js: the caller owns where
// state lives.
export function initAnimator(opts) {
  if (started) return;
  started = true;
  if (opts && typeof opts.getPet === 'function') getPet = opts.getPet;
  reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (reduced) {
    const onChange = () => { if (reduced.matches) stop(); else start(); };
    if (reduced.addEventListener) reduced.addEventListener('change', onChange);
    else if (reduced.addListener) reduced.addListener(onChange);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass(); });
  start();
}

// Make one specific pet visibly react to being cared for. `need` is
// 'food' | 'fuss' | 'clean' | 'rounds' | 'notice'. Safe to call before the
// shelf has re-rendered: it simply finds nothing and does nothing.
export function reactTo(id, need, delay) {
  if (!id || (reduced && reduced.matches)) return;
  const fire = () => {
    const els = spritesFor(id);
    if (!els.length) return;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const mood = moodOfEl(el);
      let r = REACTIONS[need];
      let key = need;
      if (need === 'fuss' && (mood === 'annoyed' || mood === 'furious')) { r = REACTIONS.fussbad; key = 'fussbad'; }
      if (need === 'notice') {
        if (mood === 'asleep') { if (chance(0.3)) { holdClass(el, 'sl-blink-deep', 240); zzz(el); } continue; }
        if (mood === 'annoyed' || mood === 'furious') r = REACTIONS.noticebad;
      }
      if (!r) return;
      playAnim(el, r.name, r.ms, r.ease, r.dir);
      if (r.squint) holdClass(el, 'sl-squint', r.ms);
      gazeFor(el, r.gaze);
      holdClass(el, 'sl-care-' + need, r.ms);
      if (need !== 'rounds' && need !== 'notice') {
        el.querySelectorAll('.care-motes').forEach(node => node.remove());
        const motes = document.createElement('span');
        motes.className = 'care-motes care-motes-' + need;
        motes.setAttribute('aria-hidden', 'true');
        for (let j = 0; j < 5; j++) {
          const mote = document.createElement('i');
          mote.style.setProperty('--mote-x', ((j - 2) * 19) + 'px');
          mote.style.setProperty('--mote-delay', (j * 55) + 'ms');
          motes.appendChild(mote);
        }
        el.appendChild(motes);
        setTimeout(() => motes.remove(), 1300);
      }
      const c = clocks.get(id);
      if (c) { c.act = Date.now() + r.ms + rand(600, 1800); c.busy = Date.now() + r.ms; }
      // Something short about it. Individual care nearly always earns a word;
      // the rounds and a glance at the shelf only from one or two of them.
      const pool = need === 'notice' ? NOTICE_BUBBLES : CARE_BUBBLES[key];
      const odds = need === 'notice' ? 0.22 : need === 'rounds' ? 0.18 : 0.7;
      if (pool && chance(odds)) setTimeout(() => { if (el.isConnected) solo(el, pickFresh(pool), need !== 'notice' && need !== 'rounds', key === 'fussbad' ? 'bubble-dark' : ''); }, Math.round(r.ms * 0.45));
    }
  };
  if (delay) setTimeout(fire, delay);
  else fire();
}

// A whole-shelf ripple, used by "Do the rounds" and by checking the shelf,
// staggered left to right so it reads as you going down the line rather than
// everyone twitching at once.
export function reactShelf(ids, need) {
  if (reduced && reduced.matches) return;
  (ids || []).forEach((id, i) => reactTo(id, need, i * 110));
}
