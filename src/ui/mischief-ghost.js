// A friend's ghost on the shelf for a day: a translucent figure that drifts
// across the case and now and then says something it should not. Tap it to
// start shooing; tap it five times in twelve seconds while it dodges and it
// goes home, and the shelf is paid for the trouble (once).
//
// It sits in #cabinetWrap, over the shelf, and only the ghost itself takes
// taps. It stops drifting for reduced motion, Light effects and Calm mode
// (css/mischief.css); the game still works, the ghost just jumps.
import { activeHaunt, hauntLine, shooHaunt, shooMissLine, fromLabel, SHOO_TAPS, SHOO_WINDOW_MS } from '../engine/mischief.js';
import { renderPetSprite } from '../art/sprite.js';
import { guestPet } from '../cloud/social.js';
import { toast } from './toast.js';

const SAY_FIRST_MS = 4000, SAY_EVERY_MS = 38000, SAY_FOR_MS = 6500, DODGE_MS = 1100;

export function initGhost({ state, onShoo = () => {}, rnd = Math.random }) {
  let el = null, ref = '', game = null, said = 0, sayTimer = null, hushTimer = null, dodgeTimer = null;

  function remove() {
    clearTimeout(sayTimer); clearTimeout(hushTimer); clearInterval(dodgeTimer);
    sayTimer = hushTimer = dodgeTimer = null; game = null;
    el?.remove(); el = null; ref = '';
  }
  function say(text, ms = SAY_FOR_MS) {
    if (!el) return;
    const bubble = el.querySelector('.mx-ghost-bubble'), live = el.querySelector('.mx-ghost-live');
    bubble.textContent = text;
    el.classList.add('mx-saying');
    if (live) live.textContent = text;
    clearTimeout(hushTimer);
    hushTimer = setTimeout(() => el?.classList.remove('mx-saying'), ms);
  }
  function chatter() {
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      const h = activeHaunt(state);
      if (!h || h.ref !== ref) { render(); return; }
      if (!document.hidden && !game) say(hauntLine(state, h, said++));
      chatter();
    }, said ? SAY_EVERY_MS : SAY_FIRST_MS);
  }
  function dodge() {
    if (!el) return;
    const ghost = el.querySelector('.mx-ghost');
    ghost.style.left = (4 + rnd() * 72).toFixed(1) + '%';
    ghost.style.top = (4 + rnd() * 62).toFixed(1) + '%';
  }
  function endGame() {
    clearInterval(dodgeTimer); dodgeTimer = null; game = null;
    el?.classList.remove('mx-dodging');
  }
  function tap() {
    const h = activeHaunt(state);
    if (!h || h.ref !== ref) { render(); return; }
    if (!game) {
      game = { taps: 0, until: Date.now() + SHOO_WINDOW_MS };
      el.classList.add('mx-dodging');
      dodgeTimer = setInterval(() => {
        if (!game) return;
        if (Date.now() > game.until) { const n = game.taps; endGame(); say(shooMissLine(h, n)); return; }
        dodge();
      }, DODGE_MS);
    }
    game.taps += 1;
    if (game.taps >= SHOO_TAPS) {
      const taps = game.taps;
      endGame();
      const result = shooHaunt(state, taps);
      if (!result) { render(); return; }
      el.classList.add('mx-shooed');
      el.querySelector('.mx-ghost').disabled = true;
      toast(result.line + (result.souls ? ' +' + result.souls + ' souls.' : ''));
      setTimeout(remove, matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 700);
      onShoo(result);
      return;
    }
    say('Shoo! ' + game.taps + ' of ' + SHOO_TAPS + '.', 1600);
    dodge();
  }
  function build(h) {
    el = document.createElement('div');
    el.className = 'mx-haunt';
    el.dataset.mxHaunt = h.ref;
    el.innerHTML = '<button class="mx-ghost" type="button"><span class="mx-ghost-body" aria-hidden="true"></span><span class="mx-ghost-from" aria-hidden="true"></span>' +
      '<span class="mx-ghost-bubble" aria-hidden="true"></span></button><p class="sr-only mx-ghost-live" role="status" aria-live="polite"></p>';
    const ghost = el.querySelector('.mx-ghost');
    ghost.setAttribute('aria-label', h.ghost.name + '’s ghost, ' + fromLabel(h) + ', is haunting your shelf. Tap it five times quickly to shoo it.');
    el.querySelector('.mx-ghost-from').textContent = fromLabel(h);
    const pet = guestPet(h.ghost);
    if (pet) el.querySelector('.mx-ghost-body').appendChild(renderPetSprite(pet));
    ghost.addEventListener('click', tap);
  }
  function render() {
    const h = typeof document === 'undefined' ? null : activeHaunt(state);
    if (!h) { if (el && !el.classList.contains('mx-shooed')) remove(); return; }
    if (el && ref === h.ref && el.isConnected) return;
    remove();
    const host = document.getElementById('cabinetWrap');
    if (!host) return;
    build(h);
    ref = h.ref; said = 0;
    host.appendChild(el);
    chatter();
  }
  return { render, remove, isShowing: () => !!el };
}
