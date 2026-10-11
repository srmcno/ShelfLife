// The tester panel (#testerVeil): reached by tapping the version line in More
// seven times, or by opening the game with ?tester=1.
//
// Anything here that bends time or hands out souls marks the save as a tester
// save first (state.tester, for good). A tester save never sends daily
// challenge scores or Court verdict stars to the server; the panel says so.
// The rest (the benchmark, the save summary, the update check, pretending to
// be offline) changes nothing in the save.

import { save as saveState, dayKeyOffset, localDayKey } from '../state.js';
import { mayhemState } from '../mayhem-state.js';
import { accrueMayhem, queueCap } from '../engine/mayhem.js';
import { advanceSchemes } from '../engine/schemes.js';
import { replayGuide } from '../engine/guide.js';
import { markTester, isTesterSave } from '../tester-state.js';
import { clockOffset, setClockOffset, offsetDays, realNow, DAY_MS, MAX_OFFSET_DAYS } from '../clock.js';
import { readErrors, clearErrors } from '../errors.js';
import { BENCH_KEY, startBenchmark } from './effects.js';
import { isNative } from '../native.js';
import { versionLine } from '../version.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const EMERGENCY_EVERY_MS = 12 * 60000;

let S = null, save = saveState, refresh = () => {}, reload = () => globalThis.location.reload();
let offline = false, realFetch = null;
const notes = {};

/* ---------------- pretending to be offline ---------------- */

// Every request the game makes fails as if the connection had dropped, and
// navigator.onLine says false. This tab only, until it is switched off or the
// page reloads.
export function setFakeOffline(on) {
  const next = !!on;
  if (next === offline) return offline;
  offline = next;
  if (offline) {
    realFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch (the tester panel is pretending to be offline)'));
    try { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); } catch { /* read-only in this browser */ }
    window.dispatchEvent(new Event('offline'));
  } else {
    if (realFetch) globalThis.fetch = realFetch;
    try { delete navigator.onLine; } catch { /* nothing to undo */ }
    window.dispatchEvent(new Event('online'));
  }
  return offline;
}
export const fakeOffline = () => offline;

/* ---------------- what the panel does ---------------- */

function bend() {
  markTester(S);
  return true;
}

const ACTIONS = {
  emergency() {
    if (!S.pets.length) return 'Nobody lives here yet. Disasters need a cast.';
    const m = mayhemState(S), now = Date.now();
    if (m.queue.length >= queueCap(S, now)) return 'The tray is full. That is the legal limit for disasters.';
    bend();
    m.nextAt = now;
    accrueMayhem(S, now);
    return 'Something has gone wrong. On purpose, this time.';
  },
  omen() {
    if (!S.pets.length) return 'Omens need somebody to frighten. Move someone in first.';
    const m = mayhemState(S), now = Date.now(), today = localDayKey(now);
    if (m.omen.day !== today) return 'Tonight’s omen is already waiting on the shelf desk.';
    bend();
    const yesterday = dayKeyOffset(now, -1);
    // As if it had been turned over last night, so the run of nights carries on.
    m.omen.day = yesterday;
    if (m.omen.lastDay === today) m.omen.lastDay = yesterday;
    return 'Tonight’s omen is ready to turn over again.';
  },
  waits() {
    if (!S.pets.length) return 'There is nothing to wait for on an empty shelf.';
    bend();
    const now = Date.now(), m = mayhemState(S);
    S.lastRounds = 0;
    S.lastCheck = 0;
    if (m.nextAt > now) m.nextAt = now;
    accrueMayhem(S, now);
    if (S.schemes && typeof S.schemes === 'object' && !S.schemes.active) S.schemes.lastAt = 0;
    advanceSchemes(S, now);
    if (S.stories && typeof S.stories === 'object' && !S.stories.visitor) { S.stories.nextVisitAt = now; S.stories.lastInvitation = 0; }
    const props = S.behavior?.props;
    if (props && typeof props === 'object') Object.values(props).forEach(p => { if (p && typeof p === 'object') p.emptyUntil = 0; });
    return 'Done: the next emergency, the rounds, Check the shelf, the next conspiracy, the next visitor and the bowls are all ready now.';
  },
  tour() {
    if (!S.pets.length) return 'The tour needs a resident to be about. Move someone in first.';
    bend();
    replayGuide(S, Date.now());
    window.dispatchEvent(new CustomEvent('shelflife:guide-resumed'));
    close();
    return 'The first-day tour starts again from step one.';
  },
  dayOn() {
    if (offsetDays() >= MAX_OFFSET_DAYS) return 'That is as far ahead as the clock goes.';
    bend();
    save();
    setClockOffset(clockOffset() + DAY_MS);
    reload();
    return 'Moving the clock a day on…';
  },
  realTime() {
    if (!clockOffset()) return 'The clock is already on real time.';
    // Bring the obvious timers back from the future before the clock goes back.
    const now = realNow(), m = mayhemState(S);
    if (m.nextAt > now + EMERGENCY_EVERY_MS) m.nextAt = now + EMERGENCY_EVERY_MS;
    S.lastTick = Math.min(S.lastTick, now);
    if (S.life) S.life.lastSeen = Math.min(Number(S.life.lastSeen) || now, now);
    save();
    setClockOffset(0);
    reload();
    return 'Putting the clock back…';
  },
  bench() {
    try { localStorage.removeItem(BENCH_KEY); } catch { /* measured afresh either way */ }
    benchRuns = [];
    startBenchmark();
    return 'Measuring for about two seconds. Hold still and look natural.';
  },
  exportSave() {
    $('exportBtn')?.click();
    return isNative() ? 'The share sheet has the save.' : 'The save is downloading as a backup file.';
  },
  async update() {
    if (isNative()) return 'The app updates from Google Play, not from here.';
    const registration = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
    if (!registration) return 'No service worker here, so there is nothing to check. (The first visit and some previews have none.)';
    try { await registration.update(); } catch { return 'The check could not reach the server.'; }
    if (registration.installing || registration.waiting) return 'A new edition is on its way. “Save & refresh” appears at the top when it is ready.';
    return 'Checked. This is the newest edition the server has.';
  },
  offline() {
    setFakeOffline(!offline);
    return offline ? 'Pretending to be offline. Cloud save and Friends now behave as if the connection had gone.' : 'Back online, as far as the game knows.';
  },
  clearErrors() {
    clearErrors();
    return 'The error list is empty. The errors themselves are still out there.';
  }
};

let benchRuns = [];
window.addEventListener('shelflife:perf', event => {
  if (!$('testerVeil')?.classList.contains('open')) return;
  benchRuns.push(event.detail || {});
  notes.bench = 'Reading ' + benchRuns.length + ': ' + (event.detail?.reading || '?') + '. ' + benchLine();
  render();
});
function benchLine() {
  try {
    const v = JSON.parse(localStorage.getItem(BENCH_KEY) || 'null');
    if (!v?.tier) return 'No verdict yet.';
    return 'Verdict: ' + v.tier + (Number.isFinite(v.median) ? ', median ' + v.median + ' ms, 90th percentile ' + v.p90 + ' ms' : '') + '.';
  } catch { return 'No verdict yet.'; }
}

/* ---------------- the summary ---------------- */

function bytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB'; }
function storageUsed() {
  let total = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); total += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch { return 0; }
  return total;
}
export function stateSummary(state, now = Date.now()) {
  let size = 0;
  try { size = new Blob([JSON.stringify(state)]).size; } catch { size = JSON.stringify(state).length; }
  const m = state.mayhem || {};
  return [
    ['Save size', bytes(size)],
    ['All local storage', bytes(storageUsed())],
    ['Residents', String(state.pets.length)],
    ['Furniture', String((state.props || []).length)],
    ['Souls', (m.souls || 0) + ' held, ' + (m.lifetime || 0) + ' earned'],
    ['Emergencies', (m.queue?.length || 0) + ' waiting, ' + (m.resolved || 0) + ' dealt with'],
    ['Coffins opened', String(m.coffins || 0)],
    ['Curios', String(Object.values(m.curios || {}).filter(n => n > 0).length)],
    ['Notes', String(state.notes?.length || 0)],
    ['Paperwork', String(state.paperwork?.entries?.length || 0)],
    ['Incidents', String(state.achievements?.length || 0)],
    ['Court episodes', String(state.courtroom?.episodes || 0)],
    ['Days since the shelf started', String(Math.max(0, Math.floor((now - state.started) / DAY_MS)))]
  ];
}

/* ---------------- the sheet ---------------- */

function button(action, label, { primary = false, pressed = null } = {}) {
  return '<button class="btn' + (primary ? ' btn-primary' : '') + '" type="button" data-tp="' + action + '"' + (pressed === null ? '' : ' aria-pressed="' + pressed + '"') + '>' + esc(label) + '</button>';
}
function note(key) { return '<p class="tp-note" role="status" aria-live="polite" data-tp-note="' + key + '">' + esc(notes[key] || '') + '</p>'; }

function markup() {
  const tester = isTesterSave(S), days = offsetDays(), errors = readErrors();
  return '<div class="sheet-head"><div><span class="eyebrow">Not for polite company</span><h2 id="testerTitle">Tester panel</h2></div><button class="btn btn-ghost btn-sm" type="button" data-tp-close>Close</button></div>' +
    '<p class="tp-version">' + esc(versionLine()) + '</p>' +
    '<div class="tp-status' + (tester ? ' is-tester' : '') + '"><b>' + (tester ? 'This is a tester save. It stays one.' : 'This is an ordinary save, for now.') + '</b>' +
    '<p>Anything marked † below bends time or hands out souls, and marks this save as a tester save for good. A tester save never sends daily challenge scores or Shelf Court verdict stars to the server, so the boards stay honest. Everything else here changes nothing in the save.</p></div>' +

    '<section class="tp-section" aria-labelledby="tpTime"><h3 id="tpTime">Time and trouble</h3><div class="tp-grid">' +
    button('emergency', 'Start an emergency now †') + button('omen', 'Ready tonight’s omen †') + button('waits', 'Finish the waits †') + '</div>' +
    '<p class="hint">Finish the waits: the next emergency, the rounds, Check the shelf, the next conspiracy, the next visitor and the bowls. Expeditions move on your choices, not a clock.</p>' + note('time') +
    '<div class="tp-clock"><p><b>Clock:</b> ' + (days ? days + (days === 1 ? ' day' : ' days') + ' ahead of this device' : 'real time') + '</p><div class="tp-grid">' +
    button('dayOn', 'Add a day †') + (days ? button('realTime', 'Back to real time') : '') + '</div>' +
    '<p class="hint">For tomorrow’s omen, chores and daily challenge. The game reloads to apply it. Signed-in play days are not counted while the clock is moved.</p></div></section>' +

    '<section class="tp-section" aria-labelledby="tpTour"><h3 id="tpTour">The first day</h3><div class="tp-grid">' + button('tour', 'Replay the first-day tour †') + '</div>' +
    '<p class="hint">The six steps again, counting only what you do from now. Their rewards pay out again, hence the mark.</p>' + note('tour') + '</section>' +

    '<section class="tp-section" aria-labelledby="tpDevice"><h3 id="tpDevice">This device</h3><div class="tp-grid">' +
    button('bench', 'Rerun the effects benchmark') + button('update', 'Check for an update') + button('offline', offline ? 'Pretending to be offline' : 'Pretend to be offline', { pressed: offline }) + '</div>' +
    '<p class="hint">' + esc(benchLine()) + '</p>' + note('bench') + note('device') + '</section>' +

    '<section class="tp-section" aria-labelledby="tpSave"><h3 id="tpSave">The save</h3>' +
    '<dl class="tp-facts">' + stateSummary(S).map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>' +
    '<div class="tp-grid">' + button('exportSave', 'Export the save') + '</div>' + note('save') + '</section>' +

    '<section class="tp-section" aria-labelledby="tpErrors"><h3 id="tpErrors">Errors caught (' + errors.length + ')</h3>' +
    (errors.length ? '<ol class="tp-errors">' + errors.slice().reverse().map(e => '<li><span>' + esc(e.message) + (e.count > 1 ? ' (' + e.count + ' times)' : '') + '</span><small>' + esc(e.source || 'unknown file') + ' · ' + esc(new Date(e.at).toLocaleString()) + '</small></li>').join('') + '</ol>' +
      '<div class="tp-grid">' + button('clearErrors', 'Clear the list') + '</div>' : '<p class="hint">Nothing has broken that the game noticed. Suspicious, frankly.</p>') +
    note('errors') + '</section>';
}

const NOTE_FOR = { emergency: 'time', omen: 'time', waits: 'time', dayOn: 'time', realTime: 'time', tour: 'tour', bench: 'bench', update: 'device', offline: 'device', exportSave: 'save', clearErrors: 'errors' };

function render() {
  const sheet = $('testerSheet');
  if (!sheet || !$('testerVeil')?.classList.contains('open')) return;
  const focus = document.activeElement?.closest?.('#testerSheet [data-tp]')?.dataset.tp;
  const scroll = sheet.scrollTop;
  sheet.innerHTML = markup();
  sheet.scrollTop = scroll;
  if (focus) sheet.querySelector('[data-tp="' + focus + '"]')?.focus({ preventScroll: true });
}

export function openTesterPanel() {
  const veil = $('testerVeil');
  if (!veil || !S) return false;
  document.querySelectorAll('.veil.open').forEach(other => { if (other !== veil) other.querySelector('.sheet-head button')?.click(); });
  veil.classList.add('open');
  render();
  return true;
}
function close() { $('testerVeil')?.classList.remove('open'); }

async function act(name) {
  const run = ACTIONS[name];
  if (!run) return;
  const before = isTesterSave(S);
  const message = await run();
  notes[NOTE_FOR[name]] = message + (!before && isTesterSave(S) ? ' This is now a tester save.' : '');
  save();
  refresh();
  render();
}

export function initTesterPanel({ state, save: s, refresh: r, reload: l } = {}) {
  S = state; save = s || save; refresh = r || refresh; reload = l || reload;
  const veil = $('testerVeil');
  if (!veil) return;
  veil.addEventListener('click', event => {
    if (event.target === veil || event.target.closest('[data-tp-close]')) { close(); return; }
    const action = event.target.closest('[data-tp]')?.dataset.tp;
    if (action) act(action);
  });
}
