/* =============================================================================
   fx.js: the page-level effects toolkit.

   One small, stable API for the moments that deserve a flourish. Everything
   here is decoration layered on top of state that has already changed, so a
   missing element, a hidden tab, reduced motion or a slow phone simply means
   "do nothing", never an error and never a delay.

   Calling it
     import { burst, flyTo, countUp, shake, pulse, celebrate, haptic } from './fx.js';
   or, from a module that cannot import this one, through the page:
     window.shelfFx.burst(el, 'confetti')
     window.dispatchEvent(new CustomEvent('shelflife:celebrate', { detail: { kind: 'rank-up', title: 'Mildly Damp' } }))

   The API
     burst(target, kind?, opts?)    Particles from an element (or {x, y}).
                                    kind: 'souls' | 'sparkles' | 'confetti' | 'hearts' | 'puff'
     flyTo(from, to, glyph?, opts?) Glyphs arc from one element to another, then
                                    the destination pulses. Resolves on landing.
                                    glyph: 'soul' | 'spark' | 'heart' | any mayhem glyph name
     countUp(el, to, opts?)         A number that counts instead of jumping.
     shake(el, opts?)               A short, firm refusal.
     pulse(el, opts?)               A ring and a small swell: "look here".
     celebrate(kind, ctx?)          A staged moment. kinds: 'first-coffin',
                                    'curio', 'rank-up', 'resident', 'streak',
                                    'set-complete', 'souls'. See CELEBRATIONS.
     haptic(kind?)                  navigator.vibrate, only on touch screens, only
                                    after a tap, and only if settings.haptics is
                                    not false. kinds: 'tick' | 'tap' | 'thud' |
                                    'success' | 'warn' | 'reveal'
     emptyState(opts), loadingState(line)
                                    Markup for illustrated empty and loading
                                    states (art in ../art/empty-art.js).
     motionLevel()                  'off' (reduced motion, hidden tab), 'light'
                                    (Light effects) or 'full'. Everything above
                                    honours it: off draws nothing, light draws
                                    about a third of the particles.

   Performance rules this file keeps: transform and opacity only, one layer
   (#fxLayer) for every particle, a single rect read per call, nothing runs
   unless it was asked to, and everything is removed when it ends.
   ============================================================================= */
import { glyph } from '../art/mayhem-glyphs.js';
import { emptyArt } from '../art/empty-art.js';

const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
const reducedQuery = hasDom && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const coarseQuery = hasDom && typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;

export function motionLevel() {
  if (!hasDom || document.hidden || reducedQuery?.matches) return 'off';
  return document.body?.dataset.effects === 'light' ? 'light' : 'full';
}

/* ---------- pure planning (unit tested) ------------------------------------ */

const PALETTE = {
  soul: ['#F6C768', '#FFE39A', '#FFB07A'],
  spark: ['#FFF3C4', '#F2C083', '#BFEFE3'],
  confetti: ['#FF8FB8', '#7FD8C0', '#F2B441', '#F2E9DC', '#B98BFF'],
  heart: ['#FF8FB8', '#FF6F9D', '#FFC2D8'],
  puff: ['#A6E36B', '#8FBF63', '#C9E8A0']
};

// Every kind is a recipe: how many, where they go (arc is an angle range in
// radians, y down, so -PI..0 is upwards), how fast, and what gravity does.
export const BURSTS = {
  souls:    { n: 14, shape: 'ember',  colors: PALETTE.soul,     arc: [-Math.PI * 0.95, -Math.PI * 0.05], speed: [50, 118], size: [5, 9],  life: [760, 1250], lift: 16, fall: -34, spin: 40,  stagger: 120 },
  sparkles: { n: 16, shape: 'star',   colors: PALETTE.spark,    arc: [0, Math.PI * 2],                   speed: [38, 110], size: [6, 12], life: [620, 1050], lift: 6,  fall: 10,  spin: 220, stagger: 160 },
  confetti: { n: 30, shape: 'chip',   colors: PALETTE.confetti, arc: [-Math.PI * 0.92, -Math.PI * 0.08], speed: [90, 230], size: [5, 9],  life: [1100, 1800], lift: 22, fall: 190, spin: 720, stagger: 90 },
  hearts:   { n: 9,  shape: 'heart',  colors: PALETTE.heart,    arc: [-Math.PI * 0.85, -Math.PI * 0.15], speed: [34, 84],  size: [9, 15], life: [900, 1400], lift: 10, fall: -40, spin: 50,  stagger: 220 },
  puff:     { n: 9,  shape: 'puff',   colors: PALETTE.puff,     arc: [-Math.PI * 0.9, -Math.PI * 0.1],   speed: [20, 54],  size: [10, 18], life: [800, 1250], lift: 4, fall: -26, spin: 30,  stagger: 140 }
};

/** The particles of one burst as plain numbers. Deterministic given `rnd`. */
export function planBurst(kind, level = 'full', rnd = Math.random) {
  if (level === 'off') return [];
  const recipe = BURSTS[kind] || BURSTS.sparkles;
  const n = level === 'light' ? Math.max(4, Math.round(recipe.n / 3)) : recipe.n;
  const calm = level === 'light' ? 0.7 : 1;
  const between = (a, b) => a + (b - a) * rnd();
  const out = [];
  for (let i = 0; i < n; i++) {
    const angle = recipe.arc[0] + (recipe.arc[1] - recipe.arc[0]) * ((i + rnd() * 0.85) / n);
    const speed = between(recipe.speed[0], recipe.speed[1]);
    out.push({
      shape: recipe.shape,
      x: Math.round(Math.cos(angle) * speed),
      y: Math.round(Math.sin(angle) * speed),
      lift: recipe.lift,
      fall: recipe.fall,
      spin: Math.round((rnd() - 0.5) * recipe.spin),
      size: Math.round(between(recipe.size[0], recipe.size[1]) * 10) / 10,
      color: recipe.colors[i % recipe.colors.length],
      life: Math.round(between(recipe.life[0], recipe.life[1]) * calm),
      delay: Math.round(rnd() * recipe.stagger)
    });
  }
  return out;
}

export const easeOutCubic = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The number to show `t` (0..1) of the way through a count. */
export function countAt(from, to, t) {
  return Math.round(from + (to - from) * easeOutCubic(t));
}

export function parseCount(text) {
  const n = parseInt(String(text ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** A quadratic arc from a to b that bows `bow` px to one side, as keyframe offsets. */
export function arcPoint(a, b, bow, t) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bow, cy = my + (dx / len) * bow;
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
}

export const HAPTICS = { tick: 6, tap: 10, thud: 16, success: [10, 40, 18], warn: [24, 50, 24], reveal: [8, 30, 8, 30, 24] };

/* ---------- the layer ------------------------------------------------------- */

let layerEl = null, liveEl = null;
function layer() {
  if (layerEl?.isConnected) return layerEl;
  layerEl = document.createElement('div');
  layerEl.id = 'fxLayer';
  layerEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layerEl);
  return layerEl;
}
function announce(text) {
  if (!liveEl?.isConnected) {
    liveEl = document.createElement('div');
    liveEl.id = 'fxLive';
    liveEl.className = 'sr-only';
    liveEl.setAttribute('role', 'status');
    liveEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(liveEl);
  }
  liveEl.textContent = '';
  setTimeout(() => { if (liveEl) liveEl.textContent = text; }, 40);
}

function centreOf(target) {
  if (!target) return null;
  if (typeof target.x === 'number' && typeof target.y === 'number') return { x: target.x, y: target.y };
  if (typeof target.getBoundingClientRect !== 'function') return null;
  const r = target.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

const later = (fn, ms) => setTimeout(fn, ms);

/* ---------- burst ----------------------------------------------------------- */

export function burst(target, kind = 'sparkles', opts = {}) {
  if (!hasDom) return Promise.resolve();
  const level = motionLevel();
  const at = centreOf(target);
  if (level === 'off' || !at) return Promise.resolve();
  const plan = planBurst(kind, level, opts.rnd);
  if (!plan.length) return Promise.resolve();
  const host = document.createElement('div');
  host.className = 'fx-burst fx-' + (BURSTS[kind] ? kind : 'sparkles');
  host.style.left = Math.round(at.x) + 'px';
  host.style.top = Math.round(at.y + (opts.dy || 0)) + 'px';
  let longest = 0;
  for (const p of plan) {
    const el = document.createElement('i');
    el.className = 'fx-p fx-s-' + p.shape;
    el.style.cssText = '--x:' + p.x + 'px;--y:' + p.y + 'px;--lift:' + p.lift + 'px;--fall:' + p.fall + 'px;--r:' + p.spin + 'deg;--s:' + p.size +
      ';--c:' + p.color + ';--t:' + p.life + 'ms;--d:' + p.delay + 'ms';
    host.appendChild(el);
    longest = Math.max(longest, p.life + p.delay);
  }
  layer().appendChild(host);
  return new Promise(resolve => later(() => { host.remove(); resolve(); }, longest + 120));
}

/* ---------- pulse and shake -------------------------------------------------- */

export function pulse(el, opts = {}) {
  if (!hasDom || !el || motionLevel() === 'off') return Promise.resolve();
  const at = centreOf(el);
  if (!at) return Promise.resolve();
  const swell = opts.scale || 1.12;
  if (typeof el.animate === 'function') {
    el.animate([{ scale: '1' }, { scale: String(swell), offset: 0.35 }, { scale: '1' }], { duration: opts.ms || 460, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  }
  if (motionLevel() === 'full' || opts.ring) {
    const ring = document.createElement('i');
    ring.className = 'fx-ring';
    ring.style.cssText = 'left:' + Math.round(at.x) + 'px;top:' + Math.round(at.y) + 'px;--w:' + Math.round(Math.max(at.w || 40, 40)) + ';--c:' + (opts.color || '#F6C768');
    layer().appendChild(ring);
    return new Promise(resolve => later(() => { ring.remove(); resolve(); }, 760));
  }
  return Promise.resolve();
}

export function shake(el, opts = {}) {
  if (!hasDom || !el || motionLevel() === 'off' || typeof el.animate !== 'function') return Promise.resolve();
  const px = opts.px || 6, ms = opts.ms || 380;
  const anim = el.animate([
    { translate: '0 0' }, { translate: -px + 'px 0', offset: 0.14 }, { translate: px + 'px 0', offset: 0.3 },
    { translate: -px * 0.7 + 'px 0', offset: 0.46 }, { translate: px * 0.5 + 'px 0', offset: 0.62 },
    { translate: -px * 0.25 + 'px 0', offset: 0.8 }, { translate: '0 0' }
  ], { duration: ms, easing: 'ease-out' });
  return anim.finished?.then(() => {}, () => {}) || Promise.resolve();
}

/* ---------- flyTo ------------------------------------------------------------ */

const FLYERS = {
  soul: () => glyph('soul'),
  heart: () => glyph('heart'),
  spark: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9-7.9-2.6 7.9-2.6z" fill="currentColor"/></svg>'
};

export function flyTo(fromTarget, toEl, kind = 'soul', opts = {}) {
  if (!hasDom) return Promise.resolve();
  const level = motionLevel();
  const a = centreOf(fromTarget), b = centreOf(toEl);
  if (level === 'off' || !a || !b) return Promise.resolve();
  const count = Math.max(1, Math.min(opts.count || (level === 'light' ? 2 : 5), 9));
  const host = layer();
  const art = (FLYERS[kind] || (() => glyph(kind)))();
  const flights = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    el.className = 'fx-flyer';
    el.innerHTML = art;
    el.style.left = Math.round(a.x) + 'px';
    el.style.top = Math.round(a.y) + 'px';
    host.appendChild(el);
    if (typeof el.animate !== 'function') { el.remove(); continue; }
    const bow = (i % 2 ? 1 : -1) * (30 + i * 9);
    const jitter = { x: (Math.random() - 0.5) * 26, y: (Math.random() - 0.5) * 18 };
    const start = { x: 0, y: 0 }, end = { x: b.x - a.x + (Math.random() - 0.5) * 8, y: b.y - a.y };
    const frames = [];
    const steps = 8;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, p = arcPoint(start, end, bow, t);
      const scale = t < 0.15 ? 0.4 + t * 4 : 1 - 0.45 * Math.pow(t, 2);
      frames.push({ transform: 'translate(' + (p.x + jitter.x * (1 - t)).toFixed(1) + 'px,' + (p.y + jitter.y * (1 - t)).toFixed(1) + 'px) scale(' + scale.toFixed(2) + ')', opacity: t > 0.92 ? 0.2 : 1, offset: t });
    }
    const anim = el.animate(frames, { duration: (opts.ms || 760) + i * 60, delay: i * 70, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
    flights.push(anim.finished.then(() => {}, () => {}).then(() => el.remove()));
  }
  if (!flights.length) return Promise.resolve();
  return Promise.all(flights).then(() => {
    if (toEl?.isConnected) pulse(toEl, { scale: 1.1, color: opts.color });
    haptic('tick');
  });
}

/* ---------- countUp ---------------------------------------------------------- */

const counters = new WeakMap();
export function countUp(el, to, opts = {}) {
  const target = Math.round(Number(to));
  if (!el || !Number.isFinite(target)) return Promise.resolve();
  const fmt = opts.format || (n => String(n));
  const from = Number.isFinite(opts.from) ? Math.round(opts.from) : parseCount(el.textContent);
  counters.get(el)?.();
  const write = n => {
    const text = fmt(n);
    if (el.firstChild && el.firstChild.nodeType === 3) { if (el.firstChild.nodeValue !== text) el.firstChild.nodeValue = text; }
    else el.textContent = text;
  };
  const level = motionLevel();
  if (level === 'off' || from === target || typeof requestAnimationFrame !== 'function') { write(target); return Promise.resolve(); }
  const ms = opts.ms || Math.round((380 + Math.min(Math.abs(target - from), 120) * 6) * (level === 'light' ? 0.6 : 1));
  return new Promise(resolve => {
    let raf = 0, start = 0, ended = false;
    const end = (final = true) => {
      if (ended) return;
      ended = true; cancelAnimationFrame(raf); counters.delete(el);
      if (final && el.isConnected) write(target);
      resolve();
    };
    counters.set(el, () => end(false));
    const step = now => {
      if (ended) return;
      if (!el.isConnected) { end(false); return; }
      if (!start) start = now;
      const t = (now - start) / ms;
      if (t >= 1) { end(true); return; }
      write(countAt(from, target, t));
      raf = requestAnimationFrame(step);
    };
    write(from);
    raf = requestAnimationFrame(step);
  });
}

/* ---------- haptics ---------------------------------------------------------- */

function hapticsAllowed() {
  if (!hasDom || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  // Never on a pointer that is not a finger, never before the first tap (the
  // browser logs an error for that), never if the player turned them off.
  if (!coarseQuery?.matches) return false;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
  if (reducedQuery?.matches) return false;
  return settingsHaptics() !== false;
}
let settingsSource = null;
export function useSettings(fn) { settingsSource = typeof fn === 'function' ? fn : null; }
function settingsHaptics() {
  try { return (settingsSource ? settingsSource() : null)?.haptics; } catch { return undefined; }
}
export function haptic(kind = 'tick') {
  if (!hapticsAllowed()) return false;
  try { return navigator.vibrate(HAPTICS[kind] || HAPTICS.tick); } catch { return false; }
}

/* ---------- banners and celebrations ----------------------------------------- */

const bannerQueue = [];
let bannerBusy = false;
function showBanner(spec) {
  bannerQueue.push(spec);
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  const spec = bannerQueue.shift();
  if (!spec) { bannerBusy = false; return; }
  bannerBusy = true;
  const el = document.createElement('div');
  // On a wide screen a sheet sits at the top of the page, so the banner takes the
  // empty space below it instead of covering the thing being celebrated.
  const low = innerWidth > 720 && !!document.querySelector('.veil.open');
  el.className = 'fx-banner tone-' + (spec.tone || 'candle') + (low ? ' low' : '');
  el.innerHTML = '<span class="fx-banner-kicker"></span><b></b><p></p>';
  el.firstChild.textContent = spec.kicker || '';
  el.querySelector('b').textContent = spec.title || '';
  el.querySelector('p').textContent = spec.line || '';
  if (!spec.line) el.querySelector('p').remove();
  layer().appendChild(el);
  announce([spec.kicker, spec.title, spec.line].filter(Boolean).join('. '));
  const hold = motionLevel() === 'off' ? 3200 : 3600;
  later(() => el.classList.add('out'), hold);
  later(() => { el.remove(); nextBanner(); }, hold + 320);
}

// Each celebration is a small recipe built from the toolkit. `ctx` carries
// whatever the caller knows (an element to burst from, a title to print).
export const CELEBRATIONS = {
  'first-coffin'(ctx) {
    showBanner({ kicker: 'First coffin', title: 'Something was in there.', line: 'The collection has begun. It will not be the last thing you regret.', tone: 'candle' });
    if (ctx.at) burst(ctx.at, 'souls');
    haptic('success');
  },
  curio(ctx) {
    // The reveal: the card is the moment, so the burst scales with the rarity.
    const rarity = ctx.rarity || 'common';
    const big = ['rare', 'cursed', 'unholy'].includes(rarity);
    if (ctx.at) {
      burst(ctx.at, rarity === 'unholy' ? 'confetti' : 'sparkles');
      if (big) later(() => burst(ctx.at, 'souls'), 220);
    }
    haptic(big ? 'reveal' : 'success');
  },
  'rank-up'(ctx) {
    const at = ctx.at || document.getElementById('soulsHud');
    burst(at, 'confetti', { dy: 70 });
    const hud = document.getElementById('soulsHud');
    if (hud) pulse(hud, { scale: 1.14 });
    haptic('success');
  },
  resident(ctx) {
    if (ctx.at) { burst(ctx.at, 'sparkles'); later(() => burst(ctx.at, 'hearts'), 260); }
    haptic('success');
  },
  streak(ctx) {
    const n = ctx.count || 0;
    showBanner({ kicker: ctx.kicker || 'Still here', title: ctx.title || (n + ' nights running'), line: ctx.line || 'The candle has noticed. It will not say so.', tone: 'candle' });
    if (ctx.at) burst(ctx.at, 'souls');
    haptic('success');
  },
  'moved-in'(ctx) {
    showBanner({ kicker: 'Moved in', title: (ctx.name || 'Someone') + ' has the shelf.', line: 'Nobody else has been told yet.', tone: 'mint' });
  },
  'set-complete'(ctx) {
    showBanner({ kicker: 'Set complete', title: ctx.title || 'Every last one.', line: ctx.line || 'The cabinet is, for once, entirely satisfied.', tone: 'mint' });
    if (ctx.at) burst(ctx.at, 'confetti');
    haptic('reveal');
  },
  souls(ctx) {
    const hud = document.getElementById('soulsHud');
    if (hud && !hud.hidden) flyTo(ctx.from || { x: innerWidth / 2, y: innerHeight * 0.55 }, hud, 'soul', { count: ctx.count });
  }
};

export function celebrate(kind, ctx = {}) {
  const recipe = CELEBRATIONS[kind];
  if (!recipe || !hasDom) return false;
  try { recipe(ctx); return true; } catch { return false; }
}

/* ---------- empty and loading states ------------------------------------------ */

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Markup for an illustrated empty state.
 * @param {{kind:string, title:string, line?:string, action?:{label:string, attrs?:string}, compact?:boolean}} o
 */
export function emptyState(o) {
  const action = o.action ? '<button class="btn fx-empty-action" type="button"' + (o.action.attrs ? ' ' + o.action.attrs : '') + '>' + escapeText(o.action.label) + '</button>' : '';
  return '<div class="fx-empty' + (o.compact ? ' compact' : '') + ' fx-empty-' + escapeText(o.kind) + '">' +
    '<div class="fx-empty-art" aria-hidden="true">' + emptyArt(o.kind) + '</div>' +
    '<div class="fx-empty-copy"><b>' + escapeText(o.title) + '</b>' + (o.line ? '<p>' + escapeText(o.line) + '</p>' : '') + action + '</div></div>';
}

export function loadingState(line = 'One moment.') {
  return '<p class="fx-loading" role="status"><span class="fx-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>' + escapeText(line) + '</span></p>';
}

/* ---------- sheets that leave properly ---------------------------------------- */
// A sheet used to vanish the instant its class changed. This keeps the veil on
// screen for the length of one short exit animation, purely visually: `.open`
// is long gone by then, so focus, inertness and history are untouched.

function watchSheets() {
  const veils = [...document.querySelectorAll('.veil')];
  const leaving = new WeakMap();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const veil = record.target;
      const was = (record.oldValue || '').split(/\s+/).includes('open');
      const is = veil.classList.contains('open');
      // classList.remove on an absent token still writes the attribute, which
      // would queue another record for this very observer: only touch it if set.
      if (is) { if (veil.classList.contains('fx-leaving')) veil.classList.remove('fx-leaving'); clearTimeout(leaving.get(veil)); continue; }
      if (!was || motionLevel() === 'off' || document.querySelector('.veil.open')) continue;
      veil.classList.add('fx-leaving');
      clearTimeout(leaving.get(veil));
      leaving.set(veil, setTimeout(() => veil.classList.remove('fx-leaving'), 240));
    }
  });
  veils.forEach(veil => observer.observe(veil, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
}

/* ---------- boot ---------------------------------------------------------------- */

let started = false;
export function initFx({ getSettings } = {}) {
  if (!hasDom || started) return;
  started = true;
  if (getSettings) useSettings(getSettings);
  watchSheets();
  // A light tick under a finger on the things that matter. Touch only.
  const TICKS = '.tab,.btn-primary,[data-care],.mh-choice,.mh-coffin-box,.mh-tarot,.arrival-resident,.mh-tile,.souls-hud,.activity-card';
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    const hit = event.target.closest?.(TICKS);
    if (hit && !hit.disabled && hit.getAttribute('aria-disabled') !== 'true') haptic('tick');
  }, { passive: true, capture: true });
}

const api = { burst, flyTo, countUp, shake, pulse, celebrate, haptic, emptyState, loadingState, motionLevel, planBurst };
if (hasDom) {
  window.shelfFx = api;
  window.addEventListener('shelflife:celebrate', event => { const d = event.detail || {}; celebrate(d.kind, d); });
}
export default api;
