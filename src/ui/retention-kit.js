import { toast } from './toast.js';
import { playAchievement, playUnlock, playStar, playPowerUp } from '../audio/sound.js';

/* Small things the Almanac, Collections, Exchange and return card all need, so
   each screen does not carry its own copy. */

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
export const byId = id => document.getElementById(id);
export const num = n => Number(n).toLocaleString('en-GB');

/* The celebration toolkit (window.shelfFx, ui/fx.js) belongs to another part of the game and
   may not be there. Ask it, politely, and carry on if it says nothing. Tiers, chests and the
   rest pay souls, so their recipe is the souls flying to the counter; a finished set has its own. */
export const CELEBRATION_RECIPES = { tier: 'souls', chest: 'souls', souls: 'souls', set: 'set-complete', curio: 'curio' };
export function celebrate(kind, detail = {}) {
  try { window.shelfFx?.celebrate?.(CELEBRATION_RECIPES[kind] || kind, detail); } catch { /* decoration must never break a claim */ }
}
export function chime(kind) {
  try { ({ tier: playAchievement, curio: playUnlock, souls: playStar, chest: playPowerUp, set: playAchievement })[kind]?.(); } catch { /* sound is optional */ }
}

/* Toasts queue behind one another and wait for sheets to close, so a line about a
   freeze is not lost under an emergency, and nothing is said over a game. */
const queue = [];
let timer = null;
export function say(message) {
  if (!message || queue.includes(message)) return;
  queue.push(message);
  if (timer) return;
  const next = () => {
    const m = queue.shift();
    if (!m) { timer = null; return; }
    if (document.querySelector('.veil.open')) queue.unshift(m); else toast(m);
    timer = setTimeout(next, 3800);
  };
  timer = setTimeout(next, 600);
}

// A reward that has just been paid, as a card: used for tiers, sets, chests and returns.
export function rewardLine(parts) {
  return parts.filter(Boolean).map(esc).join(' · ');
}
export function openSheet(veilId) {
  const veil = byId(veilId);
  if (!veil) return;
  // Only one sheet at a time: the dialog manager keeps focus in whichever is open.
  document.querySelectorAll('.veil.open').forEach(v => { if (v !== veil) v.classList.remove('open'); });
  veil.classList.add('open');
}
export function closeSheet(veilId) { byId(veilId)?.classList.remove('open'); }
