import { createDuelClock, createGhost } from '../engine/duel.js';
import { GHOST_LINES, DUEL_SEALED, fill, pickBy } from '../content/coop.js';
import { STACK_ROW } from './arcade-games.js';

/* A duel run inside the arcade shell (ui/arcade.js). The shell builds the
   run as usual; this takes over its clock, so the game steps in the fixed
   ticks of engine/duel.js, and draws the first player's ghost beside the
   second player's run. The ghost is its own game replayed from the log: the
   player's game never reads it. Nothing here touches the network; when the
   run ends it says so with a `shelflife:duel-done` event and ui/coop.js
   files the score.

   `duel` is { id, round, seed, role: 'first' | 'second', game, against, ghost } */

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const VISIBLE_ROWS = 7;   // the Coffin Stack camera, as stackView keeps it
const GHOST_SVG = '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M5 44V19a15 15 0 0 1 30 0v25l-5-4-5 4-5-4-5 4-5-4z" fill="currentColor" fill-opacity=".28" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="20" r="2.6" fill="currentColor"/><circle cx="25" cy="20" r="2.6" fill="currentColor"/></svg>';

export const duelName = duel => duel?.against || 'your friend';
export function duelKicker(duel) { return 'Duel with ' + duelName(duel) + ' · round ' + duel.round + (duel.role === 'first' ? ' · you go first' : ''); }

export function createDuelRun(run, duel) {
  const g = run.game, A = run.A, name = duelName(duel);
  const ghost = duel.role === 'second' && duel.ghost ? createGhost(duel.game, duel.seed, duel.ghost) : null;
  const clock = createDuelClock({ game: duel.game, g, step: dt => run.view.frame(A, dt), ghost });
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  let sent = false, chipState = '', chipCheckedAt = -1;

  // The ghost's pieces live in the playfield. They only ever get transforms and classes.
  const chip = document.createElement('p');
  chip.className = 'ar-ghost-chip';
  chip.setAttribute('aria-live', 'polite');
  run.field.appendChild(chip);
  let figure = null;
  if (ghost && duel.game === 'frenzy') {
    figure = document.createElement('div');
    figure.className = 'ar-ghost-catcher';
    figure.innerHTML = GHOST_SVG + '<small>' + esc(name) + '</small>';
    run.world.appendChild(figure);
  } else if (ghost && duel.game === 'stack') {
    figure = document.createElement('div');
    figure.className = 'ar-ghost-coffin';
    figure.innerHTML = '<small>' + esc(name) + '</small>';
    run.world.appendChild(figure);
  }
  setChip(ghost ? (ghost.diverged ? 'ticker' : 'level') : 'first');

  function setChip(state) {
    if (state === chipState) return;
    chipState = state;
    chip.dataset.state = state;
    chip.textContent = state === 'first'
      ? 'You play first. ' + name + ' will play this seed against your ghost.'
      : fill(pickBy(GHOST_LINES[state], duel.id + ':' + duel.round + ':' + state), { friend: name });
  }
  // Two identical animations, alternated, restart the flash without a reflow.
  function flash(selector, cls) {
    const el = run.world.querySelector(selector);
    if (!el) return;
    const next = el.dataset.ghostFlash === 'a' ? 'b' : 'a';
    el.classList.remove(cls + '-a', cls + '-b'); el.classList.add(cls + '-' + next);
    el.dataset.ghostFlash = next;
    later(() => el.classList.remove(cls + '-' + next), 420);
  }
  function paintGhost() {
    if (!ghost) return;
    const gg = ghost.sim.g, { w } = run.size;
    const hide = ghost.diverged || ghost.over;
    if (figure) figure.hidden = hide;
    if (!hide && duel.game === 'frenzy') figure.style.transform = 'translate3d(' + (gg.x * w).toFixed(1) + 'px,0,0) translateX(-50%)';
    if (!hide && duel.game === 'stack') {
      const top = gg.stack[gg.stack.length - 1], lift = Math.max(0, g.stack.length - VISIBLE_ROWS);
      const row = gg.stack.length - 1 - lift, shown = Math.max(0, Math.min(11, row));
      figure.style.left = (top.x * 100).toFixed(2) + '%';
      figure.style.width = (top.w * 100).toFixed(2) + '%';
      figure.style.bottom = (shown * STACK_ROW * 100).toFixed(2) + '%';
      figure.dataset.off = row > 11 ? 'up' : row < 0 ? 'down' : '';
    }
    if (!ghost.diverged) for (const code of ghost.applied()) {
      if (duel.game === 'seance') flash('.ar-candle.c' + code, 'ghost-touch');
      if (duel.game === 'whack') flash('[data-hole="' + code + '"]', 'ghost-bonk');
    }
    // Ahead or behind, never by how much: both scores reveal together.
    if (clock.tick - chipCheckedAt < 20) return;
    chipCheckedAt = clock.tick;
    if (ghost.over) { setChip('gone'); return; }
    const theirs = ghost.scoreAt(clock.tick);
    setChip(ghost.diverged && chipState === 'ticker' && clock.tick < 120 ? 'ticker' : g.score > theirs ? 'ahead' : g.score < theirs ? 'behind' : 'level');
  }

  paintGhost();

  function done(abandoned) {
    if (sent) return;
    sent = true;
    window.removeEventListener('pagehide', onHide);
    timers.forEach(clearTimeout); timers.clear();
    window.dispatchEvent(new CustomEvent('shelflife:duel-done', { detail: {
      id: duel.id, round: duel.round, role: duel.role, game: duel.game, seed: duel.seed, against: name, score: g.score,
      log: duel.role === 'first' ? clock.log() : null, abandoned } }));
  }
  // Closing the app in the middle of a duel files the run as it stood.
  const onHide = () => done(true);
  window.addEventListener('pagehide', onHide);

  return {
    clock, ghost,
    frame(_, dt) { clock.advance(dt); paintGhost(); },
    press(pad) { return clock.input(pad, at => run.view.press(A, pad, at)); },
    drop() { return clock.input(1, () => run.view.drop(A)); },
    hit(i) { return clock.input(i, () => run.view.hit(A, i)); },
    abandon(early = true) { done(early); },
    // The result card: the run counted as usual, and this says what happens to the duel.
    over(sheet) {
      done(false);
      const card = sheet.querySelector('.ar-over');
      if (!card) return;
      sheet.querySelector('.ar-again')?.remove();
      const panel = document.createElement('section');
      panel.className = 'ar-duel';
      panel.dataset.duelPanel = duel.id + ':' + duel.round;
      panel.setAttribute('aria-live', 'polite');
      panel.innerHTML = '<span class="ar-daily-kicker">' + esc(duelKicker(duel)) + '</span>' +
        (duel.role === 'first' ? '<p>' + esc(fill(pickBy(DUEL_SEALED, duel.id + ':sealed:' + duel.round), { friend: name })) + '</p>' : '<p>Both scores are going in together.</p>') +
        '<p class="ar-duel-status" data-duel-status>Filing your run.</p><div class="ar-duel-actions" data-duel-actions></div>';
      card.insertBefore(panel, card.firstChild);
    }
  };
}

// ui/coop.js reports back once the score is filed (or could not be).
export function paintDuelPanel(id, round, { status = '', html = '', actions = '' } = {}) {
  const panel = document.querySelector('[data-duel-panel="' + id + ':' + round + '"]');
  if (!panel) return false;
  const line = panel.querySelector('[data-duel-status]');
  if (html) line.innerHTML = html; else line.textContent = status;
  panel.querySelector('[data-duel-actions]').innerHTML = actions;
  return true;
}
