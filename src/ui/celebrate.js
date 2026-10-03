/* =============================================================================
   celebrate.js: the moments that deserve a flourish, wired without touching the
   screens that cause them.

   Each hook below watches something that already exists (the mayhem engine's
   event stream, the sheet the coffin opens in, the shelf when a new resident
   lands on it) and answers with a small recipe from fx.js. Nothing here changes
   a rule, a reward or a save.

   Celebrations wired
     souls arriving        glyphs fly from where they were earned to the HUD and
                           the counter counts up instead of jumping
     rank-up               confetti over the HUD, the whole shelf looks proud
     first coffin          a banner, the first time a coffin ever opens
     new curio             a reveal: particles scaled to the rarity, a ring, a haptic
     cabinet set completed a banner and confetti when a rarity (or a season) fills
     streak milestone      a banner on nights 3, 5, 7, 14 and 30 of the omen streak
     new resident          sparkles, hearts and a startled little hop; the very
                           first resident gets a banner of their own

   Other modules can ask for any of them with
     window.dispatchEvent(new CustomEvent('shelflife:celebrate', { detail: { kind: 'streak', count: 7 } }))
   (see the list of kinds in ui/fx.js).
   ============================================================================= */
import { onMayhem } from '../engine/mayhem.js';
import { mayhemState } from '../mayhem-state.js';
import { CURIOS, RARITIES } from '../content/mayhem.js';
import { SEASONS } from '../content/seasons.js';
import { state } from '../state.js';
import { celebrate, countUp, flyTo, pulse, parseCount, motionLevel } from './fx.js';
import { emote, emoteShelf } from '../art/animator.js';

const hasDom = typeof document !== 'undefined';

/* ---------- copy ------------------------------------------------------------ */

export const STREAK_MILESTONES = {
  3: { title: 'Three nights running.', line: 'The candle has noticed. It will not mention it.' },
  5: { title: 'Five nights in a row.', line: 'The omen has started saving you a seat.' },
  7: { title: 'A full week of omens.', line: 'Something has been left on the step. It is not a threat. Probably.' },
  14: { title: 'A fortnight, unbroken.', line: 'The neighbours have started to say your name in the wrong tone.' },
  30: { title: 'Thirty nights.', line: 'At this point the omen is simply being polite.' }
};
export const SET_LINES = {
  common: 'The ordinary ones, all present. The cabinet expected nothing less, and had been quietly worried.',
  uncommon: 'Every uncommon object accounted for. Several are looking at you. One is humming.',
  rare: 'Every rare one. The lock on the cabinet has asked for a raise.',
  cursed: 'All the cursed ones, together. Please do not seat them near the unholy ones. You are about to.',
  unholy: 'The full set. Something has noticed. It is thrilled, and has sent a card.',
  season: 'The whole season, in one cabinet. It will be back next year, and so will the smell.'
};

/** The rarity (or season) group a freshly added curio just completed, or null. */
export function completedSet(owned, curioId) {
  const curio = CURIOS.find(c => c.id === curioId);
  if (curio) {
    const group = CURIOS.filter(c => c.rarity === curio.rarity);
    if (group.every(c => owned[c.id])) {
      const rarity = RARITIES.find(r => r.id === curio.rarity);
      return { id: curio.rarity, title: 'Every ' + (rarity?.label || curio.rarity) + ' curio.', line: SET_LINES[curio.rarity] || SET_LINES.common };
    }
    return null;
  }
  for (const season of SEASONS) {
    if (season.curios.some(c => c.id === curioId) && season.curios.every(c => owned[c.id])) {
      return { id: 'season', title: 'The whole of ' + season.name + '.', line: SET_LINES.season };
    }
  }
  return null;
}

/* ---------- souls: fly, then count ------------------------------------------- */

const hudNumber = () => document.querySelector('#soulsHud .souls-count b');
let lastFlight = 0;

function soulsSource() {
  // Where the souls were earned, if the screen says so.
  const row = document.querySelector('#mayhemSheet .mh-rewards .souls, #mayhemSheet .mh-outcome .souls');
  if (row && row.getClientRects().length) return row;
  const sheet = document.querySelector('.veil.open .sheet');
  if (sheet) { const r = sheet.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height * 0.45, 260) }; }
  return { x: innerWidth / 2, y: innerHeight * 0.62 };
}

function soulsArrived(amount) {
  if (!hasDom || motionLevel() === 'off') return;
  // The engine has already added them and the HUD re-renders in the same task.
  setTimeout(() => {
    const hud = document.getElementById('soulsHud');
    const number = hudNumber();
    if (!hud || hud.hidden || !number) return;
    const to = mayhemState(state).souls;
    const from = Math.max(0, to - amount);
    const now = Date.now();
    const fly = amount >= 5 && now - lastFlight > 450;
    if (fly) lastFlight = now;
    number.textContent = String(from);
    const landing = fly ? flyTo(soulsSource(), hud, 'soul', { count: Math.min(7, 2 + Math.round(amount / 12)) }) : Promise.resolve();
    landing.then(() => countUp(number, to, { from }));
  }, 0);
}

/* ---------- the sheet: curios, the first coffin, the omen --------------------- */

const seen = new WeakSet();
function watchSheet() {
  const sheet = document.getElementById('mayhemSheet');
  if (!sheet) return;
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        const cards = node.matches('.mh-curio-card') ? [node] : [...node.querySelectorAll('.mh-curio-card')];
        cards.forEach(revealCurio);
        // The rank ladder scrolls sideways: open it at the rung the house is on.
        const ladder = node.matches('.mh-ladder') ? node : node.querySelector('.mh-ladder');
        const rung = ladder?.querySelector('li.now');
        if (rung) requestAnimationFrame(() => { ladder.scrollLeft = Math.max(0, rung.offsetLeft - (ladder.clientWidth - rung.offsetWidth) / 2); });
        const tarot = node.matches('.mh-tarot.flipping') ? node : node.querySelector('.mh-tarot.flipping');
        if (tarot) streakNight(tarot);
      }
    }
  }).observe(sheet, { childList: true, subtree: true });
}

function revealCurio(card) {
  if (seen.has(card)) return;
  seen.add(card);
  const flag = card.querySelector('.mh-curio-flag')?.textContent || '';
  if (!/^(New curio|Delivered)/.test(flag)) return;   // an owned one being looked at, or a duplicate
  const rarity = (/rarity-(\w+)/.exec(card.className) || [])[1] || 'common';
  card.dataset.reveal = rarity;
  celebrate('curio', { at: card, rarity });
  const art = card.querySelector('.mh-curio-art');
  if (art && ['rare', 'cursed', 'unholy'].includes(rarity)) pulse(art, { scale: 1.2, ring: true, color: getComputedStyle(card).getPropertyValue('--rc').trim() || undefined });
  const owned = mayhemState(state).curios;
  const id = CURIOS.find(c => card.querySelector('b')?.textContent === c.name)?.id ||
    SEASONS.flatMap(s => s.curios).find(c => card.querySelector('b')?.textContent === c.name)?.id;
  const m = mayhemState(state);
  const inCoffin = !!card.closest('.mh-coffin');
  if (inCoffin && m.coffins === 1) setTimeout(() => celebrate('first-coffin', { at: null }), 1100);
  const done = id && completedSet(owned, id);
  if (done) setTimeout(() => celebrate('set-complete', { title: done.title, line: done.line, at: card }), inCoffin && m.coffins === 1 ? 4800 : 1400);
}

function streakNight(tarot) {
  if (seen.has(tarot)) return;
  seen.add(tarot);
  const n = mayhemState(state).omen.streak;
  const mark = STREAK_MILESTONES[n];
  if (mark) setTimeout(() => celebrate('streak', { count: n, title: mark.title, line: mark.line, at: tarot }), 900);
}

/* ---------- a resident arrives -------------------------------------------------- */

let arrivals = null;
function watchShelf() {
  const cabinet = document.getElementById('cabinet');
  if (!cabinet) return;
  new MutationObserver(() => {
    const fresh = [...cabinet.querySelectorAll('.pet-arrival')].filter(el => !seen.has(el));
    if (!fresh.length) return;
    fresh.forEach(el => seen.add(el));
    clearTimeout(arrivals);
    // One arrival is an adoption. Several at once is a restore or a cloud copy.
    arrivals = setTimeout(() => {
      if (fresh.length !== 1 || document.querySelector('.veil.open')) return;
      const el = fresh[0];
      const id = el.dataset.id;
      const pet = state.pets.find(p => p.id === id);
      celebrate('resident', { at: el.querySelector('.sprite') || el });
      emote(id, 'startled', { burst: false });
      setTimeout(() => emote(id, 'happy', { burst: false }), 1000);
      if (pet && state.pets.length === 1) celebrate('moved-in', { name: pet.name });
    }, 420);
  }).observe(cabinet, { childList: true, subtree: true });
}

/* ---------- boot ------------------------------------------------------------------ */

export function initCelebrations() {
  if (!hasDom) return;
  onMayhem(event => {
    if (event.type === 'souls') soulsArrived(event.amount);
    else if (event.type === 'rank') {
      // A rank-up replaces the plain souls event, so count the gain from the HUD.
      soulsArrived(Math.max(0, mayhemState(state).souls - parseCount(hudNumber()?.textContent)));
      celebrate('rank-up', {});
      emoteShelf(state.slots.filter(id => state.pets.some(p => p.id === id)), 'proud');
    }
  });
  watchSheet();
  watchShelf();
}
if (hasDom) initCelebrations();
