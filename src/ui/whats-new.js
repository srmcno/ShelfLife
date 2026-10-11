// What's new: a short sheet (#whatsNewVeil) after an update, once per version
// and never on a brand-new install, and from More at any time. The words live
// in src/version.js (CHANGES); the gating in src/tester-state.js.

import { VERSION, CHANGES, changesSince, versionLine } from '../version.js';
import { whatsNewCheck, markVersionSeen, testingState } from '../tester-state.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function markup(releases) {
  const list = releases.length ? releases : CHANGES.slice(0, 1);
  return '<div class="sheet-head"><div><span class="eyebrow">Since you were last here</span><h2 id="whatsNewTitle">What’s new</h2></div><button class="btn btn-ghost btn-sm" type="button" data-wn-close>Close</button></div>' +
    '<p class="wn-version">' + esc(versionLine()) + '</p>' +
    list.map(release => (list.length > 1 ? '<h3 class="wn-release">In ' + esc(release.version) + '</h3>' : '') +
      '<ul class="wn-list">' + release.items.map(item => '<li><b>' + esc(item.title) + '</b><p>' + esc(item.text) + '</p></li>').join('') + '</ul>').join('') +
    '<div class="wn-actions"><button class="btn btn-primary" type="button" data-wn-close>Back to the shelf</button></div>';
}

// `seen` is the version the household last saw (blank shows this version's notes).
export function openWhatsNew(seen = '') {
  const veil = $('whatsNewVeil'), sheet = $('whatsNewSheet');
  if (!veil || !sheet) return false;
  sheet.innerHTML = markup(changesSince(seen));
  veil.classList.add('open');
  return true;
}
export function closeWhatsNew() { $('whatsNewVeil')?.classList.remove('open'); }

// At startup: 'show' opens the sheet once nothing else is on screen; 'quiet'
// (a brand-new install) just records the version. `allowed` is false in
// automated browsers so other tests are not ambushed by it.
export function checkWhatsNew(state, { save = () => {}, allowed = () => true, wait = 1500, tries = 40 } = {}) {
  const check = whatsNewCheck(state, VERSION);
  if (check === 'quiet') { markVersionSeen(state, VERSION); return 'quiet'; }
  if (check !== 'show' || !allowed()) return check === 'show' ? 'held' : check;
  const seen = testingState(state).seenVersion;
  let left = tries;
  const attempt = () => {
    if (whatsNewCheck(state, VERSION) !== 'show') return;
    if (document.querySelector('.veil.open,#moreTray.open') || document.body.dataset.guide === 'on') {
      if (--left > 0) setTimeout(attempt, wait);
      return;
    }
    markVersionSeen(state, VERSION);
    save();
    openWhatsNew(seen);
  };
  setTimeout(attempt, wait);
  return 'show';
}

export function initWhatsNew() {
  const veil = $('whatsNewVeil');
  if (!veil) return;
  veil.addEventListener('click', event => {
    if (event.target === veil || event.target.closest('[data-wn-close]')) closeWhatsNew();
  });
}
