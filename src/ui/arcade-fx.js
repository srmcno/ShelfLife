/* ---------------------------------------------------------------------------
   Arcade juice: particles, shake, hit-stop, vignettes, floating text, banners,
   a combo meter, haptics, and a governor that backs off when frames are slow.

   Nothing here knows about any one game. A game builds an fx object over its
   playfield and tells it what happened.

   Cost control is the point of the structure:
   - particles live in a fixed pool and are drawn on one small canvas, and the
     canvas is only touched while something is alive;
   - shake moves one wrapper with a transform;
   - floating text and banners use a few recycled nodes and the Web
     Animations API, so there is no forced layout;
   - nothing here uses a CSS filter or reads layout inside the frame loop.

   Effects come in three levels. 0 is everything. 1 is Light effects (a phone's
   default): fewer particles, softer shake, no parallax drift. 2 is minimal
   (reduced motion, or a device that could not keep up): no particles, no
   shake, no hit-stop, no slow motion, text that fades instead of travelling.
--------------------------------------------------------------------------- */

export const FX_CAPS = [
  { level: 0, particles: 56, shake: 1, hitStop: 60, slowmo: true, dpr: 2, travel: true },
  { level: 1, particles: 16, shake: 0.5, hitStop: 60, slowmo: true, dpr: 1, travel: true },
  { level: 2, particles: 0, shake: 0, hitStop: 0, slowmo: false, dpr: 1, travel: false }
];

// The level a run starts at. Reduced motion always means minimal; Light effects
// means at least level 1; a device that already struggled keeps its lower level.
export function fxLevelFor({ mode = 'full', reduced = false, remembered = 0 } = {}) {
  if (reduced) return 2;
  return Math.max(mode === 'light' ? 1 : 0, Math.min(2, Math.max(0, remembered | 0)));
}

/* A frame-time governor. Feed it the gap between animation frames in
   milliseconds; once per window it returns the next level down if the mean
   frame was slow, and otherwise null. Gaps over `ignoreMs` are a pause or a
   hidden tab, not slowness, and are not counted. It only ever steps down. */
export function createGovernor({ windowMs = 2000, slowMs = 26, minFrames = 24, ignoreMs = 250, warmup = 6 } = {}) {
  let level = 0, sum = 0, frames = 0, span = 0, skipped = 0;
  return {
    get level() { return level; },
    set level(v) { level = v; },
    push(dtMs) {
      if (!(dtMs > 0) || dtMs > ignoreMs) return null;
      if (skipped < warmup) { skipped++; return null; }
      sum += dtMs; frames++; span += dtMs;
      if (span < windowMs) return null;
      const mean = sum / frames, enough = frames >= minFrames;
      sum = 0; frames = 0; span = 0;
      if (enough && mean > slowMs && level < 2) { level += 1; return level; }
      return null;
    },
    reset() { sum = 0; frames = 0; span = 0; skipped = 0; }
  };
}

// A run's most recent verdict on this device, so the next run starts where the
// last one had to settle instead of stuttering through the same lesson again.
let remembered = 0;
export function rememberedLevel() { return remembered; }
export function rememberLevel(level) { remembered = Math.max(remembered, level | 0); }

/* ---------- haptics ---------- */
export const HAPTICS = {
  catch: 6, tap: 8, perfect: [10, 24, 10], combo: [8, 36, 8], bad: [34, 40, 34], hurt: [50, 30, 80],
  fatal: [70, 50, 150], skull: [14, 40, 14], best: [20, 60, 20, 60, 70], tick: 5, go: 18, gold: [12, 30, 12, 30, 24]
};
export function buzz(name, enabled = true, now = Date.now(), state = buzz.state) {
  if (!enabled) return false;
  const pattern = HAPTICS[name];
  if (!pattern || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  // vibrate() replaces whatever is buzzing, so a flurry of tiny taps is thinned out.
  if (now - state.at < 55 && name !== 'fatal' && name !== 'best') return false;
  state.at = now;
  try { return navigator.vibrate(pattern); } catch { return false; }
}
buzz.state = { at: 0 };

/* ---------- particles ---------- */
const KINDS = {
  crumb: { n: 7, speed: [0.12, 0.34], up: 0.2, g: 0.9, life: [0.35, 0.65], size: [2.5, 5], colors: ['#e7c88a', '#c79a54', '#f4e3b8'], shape: 'chip' },
  tooth: { n: 8, speed: [0.14, 0.36], up: 0.22, g: 0.9, life: [0.4, 0.7], size: [2.5, 5], colors: ['#fff4e0', '#e9dcc4', '#ffffff'], shape: 'chip' },
  spark: { n: 9, speed: [0.16, 0.42], up: 0.1, g: 0.35, life: [0.3, 0.6], size: [2, 4.5], colors: ['#ffffff', '#f6c768', '#ffe9a8'], shape: 'dot' },
  gold: { n: 14, speed: [0.18, 0.5], up: 0.25, g: 0.5, life: [0.5, 0.95], size: [2.5, 5.5], colors: ['#ffd75e', '#fff2b0', '#ffb830'], shape: 'dot' },
  water: { n: 10, speed: [0.15, 0.4], up: 0.3, g: 1.1, life: [0.35, 0.7], size: [2.5, 5], colors: ['#7fd8ff', '#bfeaff', '#4fa8d8'], shape: 'dot' },
  blood: { n: 9, speed: [0.14, 0.4], up: 0.25, g: 1.1, life: [0.4, 0.75], size: [2.5, 5.5], colors: ['#c4243c', '#ff4d5e', '#8c1626'], shape: 'dot' },
  dust: { n: 8, speed: [0.06, 0.22], up: 0.06, g: -0.05, life: [0.5, 0.9], size: [4, 9], colors: ['#8d7a86', '#a8939f', '#6b5a66'], shape: 'puff' },
  bone: { n: 8, speed: [0.14, 0.36], up: 0.3, g: 1.0, life: [0.4, 0.75], size: [2.5, 5.5], colors: ['#efe6d4', '#cdbfa8', '#ffffff'], shape: 'chip' },
  soul: { n: 7, speed: [0.04, 0.14], up: 0.2, g: -0.28, life: [0.7, 1.2], size: [3, 6], colors: ['#7fd8c0', '#bff5e6', '#ffffff'], shape: 'puff' },
  confetti: { n: 26, speed: [0.2, 0.6], up: 0.55, g: 0.55, life: [0.9, 1.6], size: [3, 6], colors: ['#f6c768', '#ff6f7f', '#7fd8c0', '#c49bff', '#ffffff'], shape: 'chip' }
};

function createParticles(canvas, caps) {
  const CAP = Math.max(1, caps.particles || 1);
  const px = new Float32Array(CAP), py = new Float32Array(CAP), vx = new Float32Array(CAP), vy = new Float32Array(CAP);
  const life = new Float32Array(CAP), maxLife = new Float32Array(CAP), size = new Float32Array(CAP), rot = new Float32Array(CAP), spin = new Float32Array(CAP), grav = new Float32Array(CAP);
  const color = new Array(CAP), shape = new Array(CAP);
  let alive = 0, cursor = 0, ctx = null, w = 0, h = 0, dirty = false;
  const api = {
    resize(width, height, dpr = 1) {
      w = width; h = height;
      if (!canvas) return;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    },
    // x and y in pixels. Particles are reused oldest first when the pool is full.
    emit(kindName, x, y, scale = 1) {
      if (!caps.particles) return;
      const k = KINDS[kindName] || KINDS.spark;
      const limit = Math.min(CAP, caps.particles), n = Math.max(1, Math.round(k.n * scale * Math.min(1, limit / 40 + 0.2)));
      const unit = Math.max(w, h) || 300;
      for (let i = 0; i < n; i++) {
        const j = cursor % limit; cursor = (cursor + 1) % limit;
        if (life[j] <= 0) alive++;
        const a = Math.random() * Math.PI * 2, sp = (k.speed[0] + Math.random() * (k.speed[1] - k.speed[0])) * unit;
        px[j] = x; py[j] = y; vx[j] = Math.cos(a) * sp; vy[j] = Math.sin(a) * sp - k.up * unit;
        maxLife[j] = life[j] = k.life[0] + Math.random() * (k.life[1] - k.life[0]);
        size[j] = k.size[0] + Math.random() * (k.size[1] - k.size[0]); rot[j] = Math.random() * 6.28; spin[j] = (Math.random() - 0.5) * 12;
        grav[j] = k.g * unit; color[j] = k.colors[(Math.random() * k.colors.length) | 0]; shape[j] = k.shape;
      }
      dirty = true;
    },
    get alive() { return alive; },
    update(dt) {
      if (!alive && !dirty) return;
      if (ctx) ctx.clearRect(0, 0, w, h);
      dirty = false;
      for (let i = 0; i < CAP; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { alive--; continue; }
        vy[i] += grav[i] * dt;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt; rot[i] += spin[i] * dt;
        if (!ctx) continue;
        const t = life[i] / maxLife[i], s = size[i];
        ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;
        ctx.fillStyle = color[i];
        if (shape[i] === 'dot') { ctx.beginPath(); ctx.arc(px[i], py[i], s * 0.5, 0, 6.2832); ctx.fill(); }
        else if (shape[i] === 'puff') { ctx.beginPath(); ctx.arc(px[i], py[i], s * (1.3 - t * 0.5), 0, 6.2832); ctx.fill(); }
        else { ctx.save(); ctx.translate(px[i], py[i]); ctx.rotate(rot[i]); ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6); ctx.restore(); }
      }
      if (ctx) ctx.globalAlpha = 1;
    },
    clear() { life.fill(0); alive = 0; dirty = true; if (ctx) ctx.clearRect(0, 0, w, h); },
    setCaps(c) { caps = c; }
  };
  return api;
}

const canAnimate = el => el && typeof el.animate === 'function';
const reducedQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const prefersReducedMotion = () => !!reducedQuery?.matches;
export function currentEffectsMode() { return (typeof document !== 'undefined' && document.body?.dataset?.effects) || 'full'; }

/* ---------- the stage ---------- */
// `host` is a positioned element that clips. `opts.world` is the element to
// shake (default: none). `opts.haptics()` says whether buzzing is allowed.
export function createFx(host, { level = 0, world = null, haptics = () => true } = {}) {
  let caps = FX_CAPS[level] || FX_CAPS[0], lvl = level;
  host.dataset.fx = String(lvl);
  const canvas = document.createElement('canvas');
  canvas.className = 'ar-fx'; canvas.setAttribute('aria-hidden', 'true');
  const vignette = document.createElement('div'); vignette.className = 'ar-vignette'; vignette.setAttribute('aria-hidden', 'true');
  const meter = document.createElement('div'); meter.className = 'ar-combo'; meter.setAttribute('aria-hidden', 'true'); meter.hidden = true;
  meter.innerHTML = '<small></small><b></b><i><u></u></i>';
  const banner = document.createElement('div'); banner.className = 'ar-banner'; banner.setAttribute('aria-hidden', 'true'); banner.hidden = true;
  banner.innerHTML = '<b></b><span></span>';
  host.append(canvas, vignette, meter, banner);
  const particles = createParticles(caps.particles ? canvas : null, caps);
  if (!caps.particles) canvas.hidden = true;
  let w = 0, h = 0, dpr = 1;
  let amp = 0, frozenUntil = 0, shakeOn = false, dead = false;
  let lastMult = 0, lastCount = 0;
  const pops = [], bannerQueue = [];
  let bannerBusy = 0;

  const fx = {
    host, particles,
    get level() { return lvl; },
    get caps() { return caps; },
    get size() { return { w, h }; },
    // The field's size in pixels: called from a ResizeObserver, never per frame.
    resize(width, height) {
      w = width; h = height;
      dpr = Math.min(caps.dpr, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
      if (caps.particles) particles.resize(w, h, dpr);
    },
    setLevel(next) {
      next = Math.max(lvl, Math.min(2, next | 0));
      if (next === lvl) return;
      lvl = next; caps = FX_CAPS[lvl]; host.dataset.fx = String(lvl);
      particles.setCaps(caps);
      if (!caps.particles) { particles.clear(); canvas.hidden = true; }
      if (!caps.shake && world) world.style.transform = '';
    },
    // x, y are fractions of the field.
    burst(kind, x, y, scale = 1) { if (caps.particles) particles.emit(kind, x * w, y * h, scale); },
    burstPx(kind, x, y, scale = 1) { if (caps.particles) particles.emit(kind, x, y, scale); },
    shake(power = 1) {
      if (!caps.shake || !world) return;
      amp = Math.min(14, Math.max(amp, power * 7 * caps.shake));
      shakeOn = true;
    },
    // A beat of stillness on impact. The loop asks `frozen(now)` before it steps.
    hitStop(ms = 60) { if (caps.hitStop) frozenUntil = Math.max(frozenUntil, performance.now() + Math.min(ms, caps.hitStop * 2)); },
    frozen(now = performance.now()) { return now < frozenUntil; },
    flash(tone = 'hurt') {
      vignette.dataset.tone = tone;
      if (canAnimate(vignette) && lvl < 2) { vignette.getAnimations?.().forEach(a => a.cancel()); vignette.animate([{ opacity: tone === 'hurt' ? 0.95 : 0.7 }, { opacity: 0 }], { duration: tone === 'hurt' ? 420 : 520, easing: 'ease-out' }); }
      else { vignette.style.opacity = '0.6'; setTimeout(() => { if (!dead) vignette.style.opacity = ''; }, 160); }
    },
    low(on) { vignette.classList.toggle('low', !!on); },
    dim(on) { host.classList.toggle('dying', !!on); },
    // Floating text at a fraction of the field.
    pop(text, x, y, tone = 'good') {
      let el = pops.find(p => !p.busy);
      if (!el) {
        if (pops.length >= 8) el = pops[0];
        else { const node = document.createElement('span'); node.className = 'ar-pop'; node.setAttribute('aria-hidden', 'true'); host.appendChild(node); el = { node, busy: false }; pops.push(el); }
      }
      const node = el.node;
      node.textContent = text; node.className = 'ar-pop ' + tone;
      node.style.left = (Math.max(0.1, Math.min(0.9, x)) * 100) + '%'; node.style.top = (Math.max(0.05, y) * 100) + '%';
      node.hidden = false; el.busy = true;
      const done = () => { el.busy = false; node.hidden = true; };
      if (canAnimate(node)) {
        node.getAnimations?.().forEach(a => a.cancel());
        const rise = caps.travel ? -46 : 0;
        const anim = node.animate([
          { opacity: 0, transform: 'translate(-50%,-30%) scale(.8)' },
          { opacity: 1, transform: 'translate(-50%,-70%) scale(1.08)', offset: 0.2 },
          { opacity: 0, transform: 'translate(-50%,' + rise + 'px) scale(1)' }
        ], { duration: caps.travel ? 850 : 600, easing: 'ease-out', fill: 'forwards' });
        anim.onfinish = done;
      } else setTimeout(done, 700);
    },
    // A big line across the field: a wave, a skull, a record. Queued so none are lost.
    banner(text, sub = '', tone = 'good', ms = 1500) {
      bannerQueue.push({ text, sub, tone, ms });
      if (bannerQueue.length > 3) bannerQueue.splice(0, bannerQueue.length - 3);
      if (!bannerBusy) nextBanner();
    },
    // The streak meter in the corner: `mult` is the current multiplier, `progress` 0..1 to the next.
    combo({ label = 'Combo', count = 0, mult = 1, progress = 0, hot = false, min = 3 } = {}) {
      if (count < min) { if (!meter.hidden) { meter.hidden = true; if (lastCount >= min && canAnimate(meter) && lvl < 2) { /* the broken streak just disappears */ } } lastCount = count; lastMult = mult; return; }
      if (meter.hidden) meter.hidden = false;
      const text = mult > 1 ? '×' + mult : String(count);
      const b = meter.querySelector('b'), small = meter.querySelector('small'), bar = meter.querySelector('u');
      if (small.textContent !== label) small.textContent = label;
      if (b.textContent !== text) b.textContent = text;
      bar.style.transform = 'scaleX(' + Math.max(0.02, Math.min(1, progress)).toFixed(3) + ')';
      meter.classList.toggle('hot', !!hot);
      if ((mult > lastMult || count > lastCount) && canAnimate(b) && lvl < 2) b.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      lastMult = mult; lastCount = count;
    },
    haptic(name) { return buzz(name, haptics()); },
    // Called once a frame with the (already slowed) time step in seconds.
    update(dt) {
      if (dead) return;
      if (caps.particles) particles.update(dt);
      if (shakeOn && world) {
        amp *= Math.exp(-dt * 13);
        if (amp < 0.25) { amp = 0; shakeOn = false; world.style.transform = ''; }
        else world.style.transform = 'translate3d(' + ((Math.random() - 0.5) * 2 * amp).toFixed(1) + 'px,' + ((Math.random() - 0.5) * 2 * amp).toFixed(1) + 'px,0)';
      }
    },
    destroy() {
      dead = true;
      particles.clear();
      canvas.remove(); vignette.remove(); meter.remove(); banner.remove();
      pops.forEach(p => p.node.remove());
      if (world) world.style.transform = '';
      host.classList.remove('dying');
    }
  };

  function nextBanner() {
    const item = bannerQueue.shift();
    if (!item || dead) { bannerBusy = 0; return; }
    bannerBusy = 1;
    banner.dataset.tone = item.tone;
    banner.querySelector('b').textContent = item.text; banner.querySelector('span').textContent = item.sub;
    banner.hidden = false;
    const finish = () => { if (dead) return; banner.hidden = true; bannerBusy = 0; if (bannerQueue.length) nextBanner(); };
    if (canAnimate(banner)) {
      banner.getAnimations?.().forEach(a => a.cancel());
      const t = caps.travel;
      const anim = banner.animate([
        { opacity: 0, transform: t ? 'translate(-50%,-50%) scale(.82)' : 'translate(-50%,-50%)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.14 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.8 },
        { opacity: 0, transform: t ? 'translate(-50%,-62%) scale(1.04)' : 'translate(-50%,-50%)' }
      ], { duration: item.ms, easing: 'ease-out' });
      anim.onfinish = finish;
    } else setTimeout(finish, item.ms);
  }
  return fx;
}

/* ---------- count up ---------- */
// Counts `el` from 0 to `to`. Returns a function that finishes at once.
export function countUp(el, to, { ms = 900, onDone, instant = false } = {}) {
  if (instant || !(to > 0) || typeof requestAnimationFrame !== 'function') { el.textContent = String(to); onDone?.(); return () => {}; }
  const start = performance.now();
  let raf = 0, done = false;
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); el.textContent = String(to); onDone?.(); };
  const tick = now => {
    if (done) return;
    const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(to * e));
    if (t < 1) raf = requestAnimationFrame(tick); else finish();
  };
  raf = requestAnimationFrame(tick);
  return finish;
}
