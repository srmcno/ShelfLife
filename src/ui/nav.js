// The chrome that is not the game: tabs on a phone, the More tray at every
// width, sheets you can pull shut, and the little badges that say something
// happened while you were looking elsewhere.
//
// Nothing here moves a DOM node. The three panes and every button keep the ids
// the rest of src/ queries; this module only toggles classes and attributes.
// On a desktop the panes are laid out together and the tab bar does not exist,
// so most of this simply no-ops there.
import { state, onNote } from '../state.js';

const PHONE = window.matchMedia('(max-width:720px)');
const TAB_KEY = 'shelflife.tab';
const TABS = ['shelf', 'notes', 'plots'];

const tray = document.getElementById('moreTray');
const scrim = document.getElementById('trayScrim');
const moreBtn = document.getElementById('moreBtn');
const tabMore = document.getElementById('tabMore');
const moreClose = document.getElementById('moreClose');
const tabs = [...document.querySelectorAll('.tabbar .tab[data-tab]')];
const notesBadge = document.getElementById('notesBadge');
const plotsDot = document.getElementById('plotsDot');
const schemeCard = document.getElementById('schemeCard');

function isPhone() { return PHONE.matches; }

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

let unseenNotes = 0;

export function currentTab() {
  return document.body.dataset.tab || 'shelf';
}

export function setTab(name, opts = {}) {
  if (TABS.indexOf(name) < 0) name = 'shelf';
  const changed = currentTab() !== name;
  document.body.dataset.tab = name;
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* storage is optional */ }
  if (name === 'notes') { unseenNotes = 0; syncBadges(); }
  if (changed && !opts.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });
  if (opts.focus) {
    const pane = document.getElementById('pane' + name.charAt(0).toUpperCase() + name.slice(1));
    if (pane) { pane.tabIndex = -1; pane.focus({ preventScroll: true }); }
  }
}

function syncBadges() {
  if (notesBadge) {
    const show = isPhone() && unseenNotes > 0 && currentTab() !== 'notes';
    notesBadge.hidden = !show;
    notesBadge.textContent = unseenNotes > 9 ? '9+' : String(unseenNotes);
  }
  if (plotsDot && schemeCard) {
    plotsDot.hidden = !(isPhone() && currentTab() !== 'plots' && schemeCard.querySelector('.scheme-choice'));
  }
}

tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
document.getElementById('shelfTeaser')?.addEventListener('click', () => setTab('notes', { focus: true }));

// Notes written while another tab is showing count toward the badge. A batch
// from "Check the shelf" also flips the phone to the notes tab, which is where
// the player was heading anyway.
onNote(() => {
  if (!isPhone() || currentTab() === 'notes') return;
  unseenNotes++;
  syncBadges();
});
window.addEventListener('shelflife:checked', e => {
  const added = e.detail && e.detail.added;
  if (isPhone() && added > 0) setTab('notes');
});
if (schemeCard) new MutationObserver(syncBadges).observe(schemeCard, { childList: true });

// Restore the last tab a phone was on. A desktop ignores this entirely.
(function restoreTab() {
  let saved = null;
  try { saved = localStorage.getItem(TAB_KEY); } catch (e) { /* ignore */ }
  setTab(saved && TABS.indexOf(saved) >= 0 ? saved : 'shelf', { keepScroll: true });
})();

// ---------------------------------------------------------------------------
// Proxies: a button elsewhere that opens something bound to a single id.
// ---------------------------------------------------------------------------
document.addEventListener('click', e => {
  const proxy = e.target.closest('[data-proxy]');
  if (!proxy) return;
  const target = document.getElementById(proxy.dataset.proxy);
  if (target) target.click();
});

// ---------------------------------------------------------------------------
// The More tray
// ---------------------------------------------------------------------------

let trayOpen = false;

function setTray(open) {
  if (!tray) return;
  trayOpen = open;
  tray.classList.toggle('open', open);
  [moreBtn, tabMore].forEach(b => b && b.setAttribute('aria-expanded', String(open)));
  if (scrim) scrim.hidden = !open;
  // A sheet sets this too. The tray always closes BEFORE a sheet opens (see
  // the capture-phase listener below), so the sheet's own lock lands after
  // this restore rather than being wiped by it.
  document.body.style.overflow = open ? 'hidden' : '';
}

[moreBtn, tabMore].forEach(b => b && b.addEventListener('click', () => setTray(!trayOpen)));
if (moreClose) moreClose.addEventListener('click', () => setTray(false));
if (scrim) scrim.addEventListener('click', () => setTray(false));
if (tray) {
  tray.addEventListener('click', e => {
    if (!trayOpen) return;
    const b = e.target.closest('button');
    if (b && b.id !== 'moreClose') setTray(false);
  }, true);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && trayOpen) setTray(false); });

// ---------------------------------------------------------------------------
// Sheets you can pull shut. On a phone every .veil is a bottom sheet with a
// handle in its sticky head; dragging the head down past a threshold closes
// it through the sheet's own Close button, so whichever module owns the sheet
// gets to tidy up (card.js clears its open pet, studio.js drops its preview).
// ---------------------------------------------------------------------------

function closeSheet(veil) {
  const btn = veil.querySelector('.sheet-head .btn, .sheet-head button');
  if (btn) { btn.click(); return; }
  veil.classList.remove('open');
  document.body.style.overflow = '';
}

let pull = null;
document.addEventListener('pointerdown', e => {
  if (!isPhone() || e.pointerType === 'mouse') return;
  const head = e.target.closest('.sheet-head');
  if (!head || e.target.closest('button, input, select, a')) return;
  const sheet = head.closest('.sheet');
  const veil = head.closest('.veil');
  if (!sheet || !veil || sheet.scrollTop > 2) return;
  pull = { sheet, veil, y0: e.clientY, dy: 0, id: e.pointerId };
  sheet.classList.add('sheet-dragging');
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!pull || e.pointerId !== pull.id) return;
  pull.dy = Math.max(0, e.clientY - pull.y0);
  pull.sheet.style.transform = 'translateY(' + pull.dy + 'px)';
}, { passive: true });
function endPull(e) {
  if (!pull || (e && e.pointerId !== pull.id)) return;
  const p = pull;
  pull = null;
  p.sheet.classList.remove('sheet-dragging');
  p.sheet.style.transform = '';
  if (p.dy > 110) closeSheet(p.veil);
}
document.addEventListener('pointerup', endPull, { passive: true });
document.addEventListener('pointercancel', endPull, { passive: true });

// Tapping the dimmed room behind a sheet closes it. Every veil already does
// this for itself in its own module, so nothing to add; but a veil that lost
// its overflow lock on rotate should not strand the page.
function onBreakpoint() {
  if (!isPhone() && trayOpen) setTray(false);
  syncBadges();
}
if (PHONE.addEventListener) PHONE.addEventListener('change', onBreakpoint);
else if (PHONE.addListener) PHONE.addListener(onBreakpoint);

// Keep the incidents door's subtitle honest without importing the whole
// achievements module: the tray button's neighbour text is the count.
export function setIncidentsSummary(text) {
  const el = document.getElementById('incidentsSub');
  if (el) el.textContent = text;
}
window.addEventListener('shelflife:incidents', e => setIncidentsSummary(e.detail && e.detail.text || ''));

void state;
