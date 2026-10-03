import { save } from '../state.js';
import { initFx } from './fx.js';
import './celebrate.js';   // the celebration hooks start themselves
import { BENCH_KEY, BENCH_FRAMES, classifyFrames, nextVerdict, effectsMode } from './effects-model.js';
export { BENCH_KEY, FULL_MEDIAN_MS, FULL_P90_MS, BENCH_FRAMES, classifyFrames, nextVerdict, effectsMode } from './effects-model.js';

// ---------------------------------------------------------------------------
// Effects: Automatic, Light or Full.
//
// Light and Full differ in how much is *animated*, not in how the room is lit:
// the lit shelf (cast shadows, rim light, the candle pool) is drawn from plain
// gradients in both, see css/fx.css. Automatic used to decide from the pointer
// type alone, which put every phone on Light. It now decides from a short
// frame-rate benchmark on the device itself:
//
//   * ~30 requestAnimationFrame frames at startup, and the same again once the
//     first shelf has rendered with real, animated residents on it;
//   * median frame time <= 22 ms and 90th percentile <= 34 ms is Full;
//   * anything slower is Light;
//   * the verdict is remembered on this device (localStorage, outside the
//     save, so it never travels in a backup or to the cloud);
//   * a slow reading takes effect at once, a fast reading must be seen twice
//     before a Light device is promoted, so a busy launch cannot flip it back
//     and forth;
//   * the Light/Full choice in More always wins over all of this.
// ---------------------------------------------------------------------------

const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
let currentState = null;
let verdict = null;          // { tier, up } as remembered on this device
let sessionTier = null;      // what this session is using
const preference = hasDom && window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };

function readVerdict() {
  try {
    const raw = JSON.parse(localStorage.getItem(BENCH_KEY) || 'null');
    if (raw && (raw.tier === 'full' || raw.tier === 'light')) return { tier: raw.tier, up: Number(raw.up) || 0 };
  } catch { /* an unreadable verdict is just no verdict */ }
  return null;
}
function writeVerdict(next, stats) {
  try { localStorage.setItem(BENCH_KEY, JSON.stringify({ ...next, at: Date.now(), ...(stats || {}) })); } catch { /* storage is optional */ }
}

export function syncEffects(state) {
  currentState = state;
  const mode = effectsMode(state.settings, {
    coarse: preference.matches, memory: navigator.deviceMemory || 8, residents: state.pets.length, tier: sessionTier
  });
  if (document.body.dataset.effects !== mode) document.body.dataset.effects = mode;
  const picker = document.getElementById('effectsMode');
  if (picker && picker.value !== (state.settings.effects || 'auto')) picker.value = state.settings.effects || 'auto';
  const note = document.getElementById('effectsHint');
  const auto = (state.settings.effects || 'auto') === 'auto';
  const text = mode === 'light'
    ? (auto ? 'Automatic chose Light effects for this device. Creatures and controls stay animated.' : 'Light effects active. Creatures and controls stay animated.')
    : (auto ? 'Automatic chose Full effects for this device. Choose Light if it ever feels sluggish.' : 'Full effects active. Choose Light if this device feels sluggish.');
  if (note && note.textContent !== text) note.textContent = text;
}

// --- the benchmark -----------------------------------------------------------

function sampleFrames(count, skip = 4) {
  return new Promise(resolve => {
    const deltas = [];
    let last = 0, seen = 0, spoiled = false;
    const onHide = () => { spoiled = true; };
    document.addEventListener('visibilitychange', onHide, { once: true });
    const step = now => {
      if (spoiled || document.hidden) { document.removeEventListener('visibilitychange', onHide); resolve(null); return; }
      if (last && ++seen > skip) deltas.push(now - last);
      last = now;
      if (deltas.length >= count) { document.removeEventListener('visibilitychange', onHide); resolve(deltas); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function measure(label) {
  if (!hasDom || typeof requestAnimationFrame !== 'function') return;
  const deltas = await sampleFrames(BENCH_FRAMES);
  const reading = deltas && classifyFrames(deltas);
  if (!reading) return;
  // The second look (shelf drawn, residents breathing) exists to catch a device
  // that coped with the empty page and not with the real one. A fast second
  // reading adds nothing, so it must not count as a second sighting.
  if (label === 'shelf' && reading === 'full' && verdict) return;
  const next = nextVerdict(verdict, reading);
  verdict = next;
  const sorted = deltas.slice().sort((a, b) => a - b);
  writeVerdict(next, { median: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10, p90: Math.round(sorted[Math.floor(sorted.length * 0.9)] * 10) / 10, run: label });
  // A slow reading is believed at once. A fast one only counts once it has been
  // promoted in the stored verdict; until then this launch stays as it was.
  if (reading === 'light') sessionTier = 'light';
  else if (next.tier === 'full') sessionTier = 'full';
  if (currentState) syncEffects(currentState);
  window.dispatchEvent(new CustomEvent('shelflife:perf', { detail: { reading, tier: sessionTier, run: label } }));
}

export function startBenchmark() {
  if (!hasDom) return;
  verdict = readVerdict();
  sessionTier = verdict ? verdict.tier : null;
  // Startup frame budget first, then once more with the shelf drawn and breathing.
  const afterLoad = () => setTimeout(() => measure('startup').then(() => setTimeout(() => measure('shelf'), 1400)), 250);
  if (document.readyState === 'complete') afterLoad(); else window.addEventListener('load', afterLoad, { once: true });
}

if (hasDom) {
  document.getElementById('effectsMode')?.addEventListener('change', e => {
    if (!currentState) return;
    currentState.settings.effects = e.target.value; syncEffects(currentState); save();
  });
  preference.addEventListener?.('change', () => { if (currentState) syncEffects(currentState); });
  initFx({ getSettings: () => currentState?.settings });
  startBenchmark();
}

// Observe only inserted/removed sprites. Scrolling pauses CSS and the director
// without measuring every creature on every animation tick.
if (hasDom && 'IntersectionObserver' in window) {
  const visible = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('sl-offscreen', !entry.isIntersecting);
  }, { rootMargin: '60px' });
  const walk = (node, fn) => {
    if (node.nodeType !== 1) return;
    if (node.matches('.sprite.sl2')) fn(node);
    node.querySelectorAll('.sprite.sl2').forEach(fn);
  };
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.removedNodes) walk(node, el => { if (!el.isConnected) visible.unobserve(el); });
      for (const node of record.addedNodes) walk(node, el => { if (el.isConnected) visible.observe(el); });
    }
  }).observe(document.body, {childList:true, subtree:true});
  walk(document.body, el => visible.observe(el));
}
