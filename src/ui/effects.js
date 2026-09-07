import { save } from '../state.js';

export function effectsMode(settings, { coarse = false, memory = 8, residents = 0 } = {}) {
  const mode = settings?.effects || 'auto';
  if (mode === 'light' || mode === 'full') return mode;
  return coarse || memory <= 4 || residents >= 8 ? 'light' : 'full';
}
let currentState = null;
const preference = window.matchMedia('(pointer: coarse)');
export function syncEffects(state) {
  currentState = state;
  const mode = effectsMode(state.settings, { coarse: preference.matches, memory: navigator.deviceMemory || 8, residents: state.pets.length });
  if (document.body.dataset.effects !== mode) document.body.dataset.effects = mode;
  const picker = document.getElementById('effectsMode');
  if (picker && picker.value !== (state.settings.effects || 'auto')) picker.value = state.settings.effects || 'auto';
  const note = document.getElementById('effectsHint');
  const text = mode === 'light' ? 'Light effects active. Creature reactions and game controls stay animated.' : 'Full effects active. Choose Light if this device feels sluggish.';
  if (note && note.textContent !== text) note.textContent = text;
}
document.getElementById('effectsMode').addEventListener('change', e => {
  if (!currentState) return;
  currentState.settings.effects = e.target.value; syncEffects(currentState); save();
});
preference.addEventListener?.('change', () => { if (currentState) syncEffects(currentState); });

// Observe only inserted/removed sprites. Scrolling pauses CSS and the director
// without measuring every creature on every animation tick.
if ('IntersectionObserver' in window) {
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
