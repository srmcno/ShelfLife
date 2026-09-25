// One set of destinations at every width, a More drawer, sheets you can pull
// shut on a phone, and badges for things that happened elsewhere in the room.
//
// The three panes and every button keep the ids the rest of src/ queries.
// Dialog modules still own closing, saving and game cleanup.
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
const storyCards = ['schemeCard', 'caseCard', 'visitorCard', 'welcomePanel', 'needsYou'].map(id => document.getElementById(id)).filter(Boolean);
const playTab = document.getElementById('tabPlay');
const playroomButton = document.getElementById('playroomBtn');
playTab?.setAttribute('aria-controls', 'playroomVeil');

function isPhone() { return PHONE.matches; }

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

let unseenNotes = 0;
const tabScroll = new Map(TABS.map(name => [name, 0]));

export function currentTab() {
  return document.body.dataset.tab || 'shelf';
}

export function setTab(name, opts = {}) {
  if (TABS.indexOf(name) < 0) name = 'shelf';
  const changed = currentTab() !== name;
  if (changed) tabScroll.set(currentTab(), window.scrollY || 0);
  document.body.dataset.tab = name;
  tabs.forEach(t => { if (t.dataset.tab === name) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* storage is optional */ }
  if (name === 'notes') unseenNotes = 0;
  syncBadges();
  if (!opts.keepScroll && (changed || opts.top)) window.scrollTo({ top: opts.top ? 0 : tabScroll.get(name) || 0, behavior: 'auto' });
  if (opts.focus) {
    const pane = document.getElementById('pane' + name.charAt(0).toUpperCase() + name.slice(1));
    if (pane) { pane.tabIndex = -1; pane.focus({ preventScroll: true }); }
  }
}

function syncBadges() {
  if (notesBadge) {
    const show = unseenNotes > 0 && currentTab() !== 'notes';
    notesBadge.hidden = !show;
    notesBadge.textContent = unseenNotes > 9 ? '9+' : String(unseenNotes);
    tabs.find(tab => tab.dataset.tab === 'notes')?.setAttribute('aria-label', show ? 'Notes, ' + unseenNotes + ' unread' : 'Notes');
  }
  if (plotsDot) {
    const ready = storyCards.some(card => !card.hidden && [...card.querySelectorAll('.scheme-choice, [data-case-choice], [data-case-next], [data-visitor], [data-life="visitor"], [data-welcome], .need-chip')].some(button => !button.disabled && !button.closest('[hidden]')));
    const show = currentTab() !== 'plots' && ready;
    plotsDot.hidden = !show;
    tabs.find(tab => tab.dataset.tab === 'plots')?.setAttribute('aria-label', show ? 'Stories, a choice is ready' : 'Stories');
  }
}

tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab, { top: currentTab() === t.dataset.tab })));
document.querySelectorAll('.wordmark').forEach(link => link.addEventListener('click', e => {
  e.preventDefault(); setTab('shelf', { top: true });
}));
document.querySelector('.skip-link')?.addEventListener('click', e => {
  e.preventDefault();
  setTab('shelf', { top: true });
  document.getElementById('cabinet')?.focus({ preventScroll: true });
});
document.getElementById('shelfTeaser')?.addEventListener('click', () => setTab('notes', { focus: true }));

// Notes written while another tab is showing count toward the badge. A batch
// from "Check the shelf" also opens the notes tab, which is where
// the player was heading anyway.
onNote(() => {
  if (currentTab() === 'notes') return;
  unseenNotes++;
  syncBadges();
});
window.addEventListener('shelflife:checked', e => {
  const added = e.detail && e.detail.added;
  if (added > 0) setTab('notes');
});
storyCards.forEach(card => new MutationObserver(syncBadges).observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden'] }));

// Restore the player's last destination on either device.
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
  if (target && target !== proxy && !target.disabled) target.click();
});

// A game opened from Play returns to the same game catalogue. The existing
// Close handler runs first, so timers, rewards and pending input are cleaned up.
// Dialogs.js remains the single owner of focus trapping and background inertness.
let gameReturn = null;
const gameVeils = [...document.querySelectorAll('#lifeVeil')];
const closeLabels = new Map(gameVeils.map(veil => {
  const button = veil.querySelector('.sheet-head button');
  return [veil.id, { button, text: button?.textContent || 'Close', label: button?.getAttribute('aria-label') }];
}));
function resetGameReturn() {
  for (const { button, text, label } of closeLabels.values()) {
    if (!button) continue;
    button.textContent = text;
    if (label == null) button.removeAttribute('aria-label'); else button.setAttribute('aria-label', label);
  }
  gameReturn = null;
}
document.addEventListener('click', e => {
  const activity = e.target.closest('[data-activity]');
  if (!activity || activity.disabled || !activity.closest('#playroomVeil.open')) return;
  resetGameReturn();
  gameReturn = { id: 'lifeVeil', entered: false };
}, true);
function syncGameReturn() {
  if (!gameReturn) return;
  const veil = gameVeils.find(item => item.id === gameReturn.id);
  if (veil?.classList.contains('open')) {
    gameReturn.entered = true;
    const button = closeLabels.get(veil.id)?.button;
    if (button) { button.textContent = 'Back to games'; button.setAttribute('aria-label', 'Back to games'); }
    return;
  }
  if (!gameReturn.entered) return;
  const returnToGames = !document.querySelectorAll('.veil.open').length;
  resetGameReturn();
  if (returnToGames) playroomButton?.click();
}
gameVeils.forEach(veil => new MutationObserver(syncGameReturn).observe(veil, { attributes: true, attributeFilter: ['class'] }));

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
  document.body.style.overflow = open || document.querySelectorAll('.veil.open').length ? 'hidden' : '';
  if (open) tray.scrollTop = 0;
}

[moreBtn, tabMore].forEach(b => b && b.addEventListener('click', () => setTray(!trayOpen)));
if (moreClose) moreClose.addEventListener('click', () => setTray(false));
if (scrim) scrim.addEventListener('click', () => setTray(false));
if (tray) {
  tray.addEventListener('click', e => {
    if (!trayOpen) return;
    const b = e.target.closest('button');
    // Toggles (Sound, Narrator) show their new state in place; anything
    // that opens a sheet closes the tray first.
    if (b && b.id !== 'moreClose' && !b.hasAttribute('aria-pressed')) setTray(false);
  }, true);
}

// Somewhere else in the app wants a pane and a card in it on screen: the needs
// strip, for one. The target's actual pane wins over older callers' tab hints,
// and closed folders open before focus moves into them.
let destinationGeneration = 0;
window.addEventListener('shelflife:goto', e => {
  // An explicit destination (such as a newly built workshop project) wins
  // over the catalogue fallback when the game closes in this same turn.
  resetGameReturn();
  const generation = ++destinationGeneration;
  const d = e.detail || {};
  const target = d.target ? document.querySelector(d.target) : null;
  const owner = target?.closest?.('.pane');
  const destination = ({ paneShelf: 'shelf', panePlots: 'plots', paneNotes: 'notes' })[owner?.id] || d.tab;
  if (destination) setTab(destination, { keepScroll: true });
  if (target) {
    // Dialog cleanup first releases the shelf's inert boundary and restores
    // its opener. Move focus to the requested destination after that cleanup.
    requestAnimationFrame(() => {
      if (generation !== destinationGeneration || !target.isConnected || document.querySelector('.veil.open,#moreTray.open')) return;
      for (let ancestor = target; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      }
      target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (typeof target.focus === 'function') {
        // Existing buttons/links retain their place in keyboard navigation.
        if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    });
  }
});
// Dialogs.js sends Escape through More's own Close button, just like sheets.

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
  if (!isPhone() || e.pointerType === 'mouse' || e.isPrimary === false || pull) return;
  const head = e.target.closest('.sheet-head');
  if (!head || e.target.closest('button, input, select, textarea, summary, a, [contenteditable="true"]')) return;
  const sheet = head.closest('.sheet');
  const veil = head.closest('.veil');
  if (!sheet || !veil || ['arcadeVeil','courtVeil','playroomVeil'].includes(veil.id) || veil.classList?.contains('life-game-mode') || sheet.scrollTop > 2) return;
  pull = { sheet, veil, x0: e.clientX, y0: e.clientY, dy: 0, id: e.pointerId, dragging: false };
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!pull || e.pointerId !== pull.id) return;
  const dx = Math.abs(e.clientX - pull.x0);
  pull.dy = Math.max(0, e.clientY - pull.y0);
  if (!pull.dragging) {
    // A horizontal edge gesture must not dismiss the current game or form.
    if (dx > 12 && dx > pull.dy) { endPull(e, true); return; }
    if (pull.dy < 8 || pull.dy < dx * 1.2) return;
    pull.dragging = true;
    pull.sheet.classList.add('sheet-dragging');
  }
  pull.sheet.style.transform = 'translateY(' + pull.dy + 'px)';
}, { passive: true });
function endPull(e, cancelled = false) {
  if (!pull || (e && e.pointerId !== pull.id)) return;
  const p = pull;
  pull = null;
  p.sheet.classList.remove('sheet-dragging');
  p.sheet.style.transform = '';
  if (!cancelled && p.dragging && p.dy > 110) closeSheet(p.veil);
}
document.addEventListener('pointerup', e => endPull(e), { passive: true });
// OS interruptions and browser gesture cancellation should leave a sheet open.
document.addEventListener('pointercancel', e => endPull(e, true), { passive: true });

// Tapping the dimmed room behind a sheet closes it. Every veil already does
// this for itself in its own module, so nothing to add; but a veil that lost
// its overflow lock on rotate should not strand the page.
function onBreakpoint() {
  endPull(null, true);
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
