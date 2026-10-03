import { pendingReturn, claimReturn, chestLine } from '../engine/returns.js';
import { checkAchievements } from '../engine/achievements.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { save } from '../state.js';
import { esc, plural, say, celebrate, chime } from './retention-kit.js';

/* ================= WHILE YOU WERE AWAY: THE CARD =================
   Sits at the top of the Today desk after six hours or more away, until its chest
   is opened. It is not a sheet and does not take over the screen: you can ignore
   it, and it will still be there. Nothing here scolds. */

let S = null, refresh = () => {};

export function returnCardHTML(state) {
  const p = pendingReturn(state);
  if (!p) return '';
  const [headline, ...rest] = p.lines;
  return '<section class="mh-tile alm-return" aria-label="While you were away"><span class="mh-tile-kicker">While you were away' + (p.days ? ' · ' + plural(p.days, 'day') : '') + '</span>' +
    '<p class="alm-return-head">' + esc(headline) + '</p>' +
    '<ul class="alm-return-lines">' + rest.map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>' +
    '<div class="alm-return-chest"><span class="alm-chest-art" aria-hidden="true">' + glyph('box') + '</span><p>' + esc(chestLine(p)) + '</p>' +
    '<button class="btn btn-primary" type="button" data-ret="claim">Open the chest</button></div></section>';
}

export function initReturns(state, onRefresh) {
  S = state;
  refresh = onRefresh || refresh;
  document.addEventListener('click', event => {
    const control = event.target.closest?.('[data-ret]');
    if (!control || !S || control.dataset.ret !== 'claim') return;
    const r = claimReturn(S);
    if (!r) return;
    checkAchievements(S);
    save();
    chime('chest'); celebrate('chest', { souls: r.souls, xp: r.xp });
    say('The chest was opened: +' + r.souls + ' souls and +' + r.xp + ' Almanac XP. The residents pretend they did not watch.');
    refresh();
  });
  return {};
}
