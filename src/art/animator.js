import { TRAIT_BY_ID } from '../content/traits.js';
import { resolveMotion, PART_ORIGIN, limbPhase } from './anatomy.js';

// ---------------------------------------------------------------------------
// Animation director
// ---------------------------------------------------------------------------
// CSS loops alone read as "a picture that wobbles": every pet runs the same
// curve forever, so nothing ever *decides* to do anything. This module owns the
// decisions. It keeps a personality clock per pet — two clocks, actually, one
// for blinking and one for larger idle behaviours — and fires short one-shot
// animations at randomised intervals weighted by mood and traits.
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
//   * prefers-reduced-motion stops the director entirely (and is watched live).

const TICK_MS = 220;
const GONE_MS = 90000;          // drop a clock this long after its pet vanished
const BUBBLE_MAX = 2;           // concurrent thought bubbles across the shelf
const BUBBLE_GAP_MS = 9500;     // global cooldown between bubbles
const BUBBLE_LIFE_MS = 3600;

// --- behaviour library -----------------------------------------------------
// `w` is the pick weight per mood; `t` adds weight for MOTION_TRAIT_FLAGS the
// pet carries. `kind:'still'` is the odd one out: instead of playing an
// animation it *pauses* the idle loop, which reads as an unsettling dead stare.
const ACTS = [
  { id: 'look',     name: 'sl2-look',     ms: 1150, ease: 'cubic-bezier(.4,0,.2,1)',
    dir: true,  w: { content: 3, fine: 4, annoyed: 3, furious: 2, asleep: 0 }, t: { thief: 3, wanderer: 1 } },
  { id: 'hop',      name: 'sl2-hop',      ms: 760,  ease: 'cubic-bezier(.3,.75,.4,1)',
    w: { content: 4, fine: 2, annoyed: 0, furious: 0, asleep: 0 }, t: { wanderer: 2 } },
  { id: 'stretch',  name: 'sl2-stretch',  ms: 1500, ease: 'cubic-bezier(.45,0,.3,1)',
    w: { content: 3, fine: 2, annoyed: 1, furious: 0, asleep: 1 } },
  { id: 'shiver',   name: 'sl2-shiver',   ms: 620,  ease: 'linear',
    w: { content: 0, fine: 1, annoyed: 3, furious: 5, asleep: 0 } },
  { id: 'sigh',     name: 'sl2-sigh',     ms: 1700, ease: 'cubic-bezier(.4,0,.5,1)',
    w: { content: 1, fine: 2, annoyed: 4, furious: 2, asleep: 2 } },
  { id: 'perk',     name: 'sl2-perk',     ms: 640,  ease: 'cubic-bezier(.2,1.4,.4,1)',
    w: { content: 3, fine: 2, annoyed: 1, furious: 1, asleep: 0 }, t: { nocturnal: 2 } },
  { id: 'sway',     name: 'sl2-sway',     ms: 2100, ease: 'ease-in-out',
    dir: true,  w: { content: 3, fine: 3, annoyed: 1, furious: 0, asleep: 1 }, t: { wanderer: 2 } },
  { id: 'wobble',   name: 'sl2-wobble',   ms: 1000, ease: 'cubic-bezier(.3,1.25,.5,1)',
    w: { content: 2, fine: 2, annoyed: 2, furious: 1, asleep: 0 } },
  { id: 'skitter',  name: 'sl2-skitter',  ms: 900,  ease: 'cubic-bezier(.3,0,.2,1)',
    dir: true,  w: { content: 1, fine: 1, annoyed: 1, furious: 1, asleep: 0 }, t: { wanderer: 6 } },
  { id: 'snatch',   name: 'sl2-snatch',   ms: 840,  ease: 'cubic-bezier(.2,0,.15,1)',
    dir: true,  w: { content: 1, fine: 1, annoyed: 1, furious: 1, asleep: 0 }, t: { thief: 6 } },
  { id: 'leanin',   name: 'sl2-leanin',   ms: 1700, ease: 'cubic-bezier(.4,0,.3,1)',
    feud: true, w: { content: 0, fine: 2, annoyed: 4, furious: 6, asleep: 0 } },
  { id: 'leanaway', name: 'sl2-leanaway', ms: 1600, ease: 'cubic-bezier(.4,0,.3,1)',
    dir: true,  w: { content: 2, fine: 2, annoyed: 2, furious: 1, asleep: 0 } },
  { id: 'stare',    kind: 'still',        ms: 2200,
    w: { content: 0, fine: 1, annoyed: 2, furious: 3, asleep: 0 }, t: { nocturnal: 4 } },

  // Anatomy-gated. `req` names a capability from art/anatomy.js; a pet that
  // hasn't got the body for it is simply never offered the behaviour, so
  // today's freehand blobs degrade to the list above without any special-casing.
  // `body` is a class held on the sprite root for the clip's duration, which is
  // what drives the limbs (arms up while hanging, high-stepping while sneaking).
  { id: 'sneak',    name: 'sl2-sneak',    ms: 2900, ease: 'cubic-bezier(.55,0,.2,1)',
    req: 'sneak', body: 'sl-sneaking', dir: true,
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

// Care reactions. `fuss` splits: a content pet wiggles, a fed-up one recoils.
const REACTIONS = {
  food:    { name: 'sl2-chomp',    ms: 860, ease: 'cubic-bezier(.3,1.15,.4,1)' },
  fuss:    { name: 'sl2-wiggle',   ms: 950, ease: 'cubic-bezier(.35,.85,.4,1)' },
  fussbad: { name: 'sl2-recoil',   ms: 860, ease: 'cubic-bezier(.3,0,.2,1)', dir: true },
  clean:   { name: 'sl2-shakeoff', ms: 780, ease: 'linear' },
  rounds:  { name: 'sl2-perk',     ms: 640, ease: 'cubic-bezier(.2,1.4,.4,1)' }
};

const MOODS = ['content', 'fine', 'annoyed', 'furious'];
const FALLBACK_EMOTES = {
  content: ['hm.', 'oh.', 'fine.', '…'],
  fine:    ['hm.', '…', 'mm.'],
  annoyed: ['tsk.', 'no.', '…', 'hm.'],
  furious: ['no.', 'tsk.', '!', '…'],
  asleep:  ['zzz', '…']
};

// --- module state ----------------------------------------------------------

const clocks = new Map();       // petId -> { act, blink, seen }
let timer = null;
let started = false;
let getPet = () => null;
let lastBubble = 0;
let reduced = null;

function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

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

// --- applying motion -------------------------------------------------------

function playAnim(el, name, ms, ease, dir) {
  const act = el.querySelector('.sprite-act');
  if (!act) return;
  // A pet mid-feud has its facing pinned by a CSS class; everyone else picks a
  // side per behaviour so they don't always turn the same way.
  if (dir && !el.classList.contains('sl-feud-left') && !el.classList.contains('sl-feud-right')) {
    el.style.setProperty('--sl-dir', Math.random() < 0.5 ? '-1' : '1');
  }
  act.style.animation = 'none';
  void act.offsetWidth;                       // force a reflow so it restarts
  act.style.animation = name + ' ' + ms + 'ms ' + ease + ' 1';
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

function runAct(el, act) {
  if (act.kind === 'still') { holdClass(el, 'sl-still', act.ms); return; }
  playAnim(el, act.name, act.ms, act.ease, act.dir);
  if (act.body) holdClass(el, act.body, act.ms);
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
// glance, then a quick characterful scurry — mischief, not a smooth glide.

const GAIT_STEP = { walk: 300, scuttle: 170, flap: 240, hop: 380 };

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

function travel(el, dx, dy) {
  if (typeof el.animate !== 'function') return;
  const sprite = el.querySelector('.sprite.sl2');
  // The director's own pass may not have reached this freshly-built element
  // yet, and travel needs its gait, so prep it now if nobody has.
  if (sprite && !sprite.dataset.slPrep) prepSprite(sprite);
  const dist = Math.hypot(dx, dy);
  const dur = Math.min(1800, Math.max(560, 430 + dist * 2.1));
  const gait = (sprite && sprite.dataset.slGait) || 'hop';
  const arc = gait === 'flap' ? Math.min(38, dist * 0.3) : Math.min(15, dist * 0.11);
  const gaitCls = 'sl-gait-' + gait;

  if (sprite) {
    // Face the way you're going. dx is old-minus-new, so a negative dx means
    // the pet ended up further right than it started.
    sprite.style.setProperty('--sl-dir', dx < 0 ? '1' : '-1');
    const step = Math.min(430, Math.max(150, dur / Math.max(3, Math.round(dist / 26))));
    sprite.style.setProperty('--sl-gait-dur', Math.round(gait === 'scuttle' ? step * 0.55 : step) + 'ms');
    sprite.style.setProperty('--sl-travel-dur', Math.round(dur) + 'ms');
    const act = sprite.querySelector('.sprite-act');
    if (act) act.style.animation = '';     // let the travel class rule take over
    sprite.classList.add('sl-travel', gaitCls);
  }
  el.style.zIndex = '5';

  const anim = el.animate([
    { transform: 'translate(' + dx + 'px,' + dy + 'px)', offset: 0, easing: 'ease-out' },
    { transform: 'translate(' + dx + 'px,' + dy + 'px)', offset: 0.17, easing: 'cubic-bezier(.5,0,.25,1)' },
    { transform: 'translate(' + (dx * 0.5) + 'px,' + (dy * 0.5 - arc) + 'px)', offset: 0.56, easing: 'cubic-bezier(.4,0,.35,1)' },
    { transform: 'translate(0,0)', offset: 0.9, easing: 'cubic-bezier(.3,1.35,.5,1)' },
    { transform: 'translate(0,0)', offset: 1 }
  ], { duration: dur, fill: 'none' });

  const done = () => {
    el.style.zIndex = '';
    if (sprite) {
      sprite.classList.remove('sl-travel', gaitCls);
      const act = sprite.querySelector('.sprite-act');
      if (act) act.style.animation = '';
    }
  };
  anim.onfinish = done;
  anim.oncancel = done;

  const c = clocks.get(el.dataset.id);
  if (c) { c.act = Date.now() + dur + rand(500, 1600); }
}

// --- picking what to do ----------------------------------------------------

function chooseAct(el, mood) {
  const feuding = el.classList.contains('sl-feud-left') || el.classList.contains('sl-feud-right');
  let total = 0;
  const pool = [];
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i];
    if (a.feud && !feuding) continue;
    if (a.req && !el.classList.contains('sl-can-' + a.req)) continue;
    let w = a.w[mood] || 0;
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

// --- thought bubbles -------------------------------------------------------
// The pets already have a great deal of written personality; a bubble borrows a
// short fragment of it. Deliberately rationed: at most two on screen, a global
// cooldown, and only ever a short clause — "clarity over clutter".

function shortLine(pet, mood) {
  if (pet && pet.traits && mood !== 'asleep') {
    for (let attempt = 0; attempt < 4; attempt++) {
      const t = TRAIT_BY_ID[pickOne(pet.traits)];
      const src = t && (Math.random() < 0.65 ? t.notes : t.social);
      if (!src || !src.length) continue;
      const raw = pickOne(src);
      if (typeof raw !== 'string' || raw.indexOf('{n}') !== -1) continue;
      // First sentence only, and only if it is short enough to read at a glance
      // on a 140px-wide shelf slot. (Plain split rather than a lookbehind
      // regex — those are still missing on some older mobile Safari builds.)
      const head = raw.split('. ')[0].trim();
      const clause = head.length && head.charAt(head.length - 1) !== '.' ? head + '.' : head;
      if (clause.length >= 4 && clause.length <= 40) return clause;
    }
  }
  return pickOne(FALLBACK_EMOTES[mood] || FALLBACK_EMOTES.fine);
}

function maybeBubble(el, id, mood, now) {
  if (now - lastBubble < BUBBLE_GAP_MS) return;
  if (document.querySelectorAll('.sl-bubble').length >= BUBBLE_MAX) return;
  const slot = el.closest('.slot');
  if (!slot) return;                          // card portrait: never bubbles
  lastBubble = now;
  const b = document.createElement('div');
  b.className = 'sl-bubble';
  b.setAttribute('aria-hidden', 'true');
  b.textContent = shortLine(getPet(id), mood);
  slot.appendChild(b);
  setTimeout(() => { b.classList.add('out'); }, BUBBLE_LIFE_MS - 400);
  setTimeout(() => { b.remove(); }, BUBBLE_LIFE_MS);
}

// --- the shared loop -------------------------------------------------------

function pass() {
  if (document.hidden) return;
  const now = Date.now();
  const els = document.querySelectorAll('.sprite.sl2[data-pet]');

  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const id = el.dataset.pet;
    // Cheap, and only ever runs on elements this pass has not seen before —
    // which after a renderShelf is every element, exactly once.
    if (!el.dataset.slPrep) prepSprite(el);
    const mood = moodOfEl(el);

    let c = clocks.get(id);
    if (!c) {
      // Stagger first behaviours so a freshly-rendered shelf doesn't all fire
      // on the same pass.
      c = { act: now + rand(400, 3800), blink: now + rand(200, 4200), seen: now };
      clocks.set(id, c);
    }
    c.seen = now;

    if (now >= c.blink) {
      const g = BLINK_GAP[mood] || BLINK_GAP.fine;
      c.blink = now + rand(g[0], g[1]);
      if (mood !== 'asleep' || Math.random() < 0.4) blink(el, Math.random() < 0.16);
    }

    if (now >= c.act) {
      const g = ACT_GAP[mood] || ACT_GAP.fine;
      c.act = now + rand(g[0], g[1]);
      const choice = chooseAct(el, mood);
      if (choice) {
        runAct(el, choice);
        c.act += choice.ms;
        if (Math.random() < 0.3) maybeBubble(el, id, mood, now);
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
  document.querySelectorAll('.sl-bubble').forEach(b => b.remove());
}

function start() {
  if (timer !== null || (reduced && reduced.matches)) return;
  timer = setInterval(pass, TICK_MS);
}

// Call once at boot. `getPet(id)` lets the director read a pet's traits for
// thought-bubble copy without animator.js importing state.js — the caller owns
// where state lives.
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
// 'food' | 'fuss' | 'clean' | 'rounds'. Safe to call before the shelf has
// re-rendered — it simply finds nothing and does nothing.
export function reactTo(id, need, delay) {
  if (!id || (reduced && reduced.matches)) return;
  const fire = () => {
    const els = spritesFor(id);
    if (!els.length) return;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      let r = REACTIONS[need];
      if (need === 'fuss') {
        const mood = moodOfEl(el);
        if (mood === 'annoyed' || mood === 'furious') r = REACTIONS.fussbad;
      }
      if (!r) return;
      playAnim(el, r.name, r.ms, r.ease, r.dir);
      const c = clocks.get(id);
      if (c) c.act = Date.now() + r.ms + rand(600, 1800);
    }
  };
  if (delay) setTimeout(fire, delay);
  else fire();
}

// A whole-shelf ripple, used by "Do the rounds" — staggered left to right so it
// reads as you going down the line rather than everyone twitching at once.
export function reactShelf(ids, need) {
  if (reduced && reduced.matches) return;
  (ids || []).forEach((id, i) => reactTo(id, need, i * 110));
}
