// Tools for testers, wired in one place: the "Feedback & version" part of the
// More tray, "For testers" in the help sheet, the seven taps on the version
// line, the play-day switch, and when the unprompted things (What's new, the
// check-in card, the broken-shelf notice) may appear.
//
// Automated browsers (navigator.webdriver) never get the unprompted things,
// so the rest of the browser suite is not ambushed by a sheet it did not
// open; a spec that tests them sets globalThis.SHELFLIFE_PROMPTS = true.

import { VERSION, versionLine } from '../version.js';
import { testingState } from '../tester-state.js';
import { clockOffset } from '../clock.js';
import { createFeedback } from '../cloud/feedback.js';
import { TESTER_NOTES } from '../content/tester-notes.js';
import { initFeedback, openFeedback, maybePulse } from './feedback.js';
import { initWhatsNew, openWhatsNew, checkWhatsNew } from './whats-new.js';
import { initTesterPanel, openTesterPanel, fakeOffline } from './tester-panel.js';
import { toast } from './toast.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TAPS = 7, TAP_GAP_MS = 2500;

export const promptsAllowed = () => globalThis.navigator?.webdriver !== true || globalThis.SHELFLIFE_PROMPTS === true;

let S = null, save = () => {}, feedback = null, cloud = null;

/* ---------------- More ---------------- */

function traySection() {
  const tray = $('moreTray');
  if (!tray || $('feedbackBtn')) return;
  const section = document.createElement('section');
  section.className = 'tray-section tray-feedback';
  section.setAttribute('aria-labelledby', 'trayFeedback');
  section.innerHTML = '<h3 id="trayFeedback">Feedback &amp; version</h3><div class="tray-grid">' +
    '<button class="btn tray-item" id="feedbackBtn" type="button" aria-haspopup="dialog"><span>Report a problem</span><small id="feedbackBtnSub">Bugs, confusion, ideas, love</small></button>' +
    '<button class="btn tray-item" id="whatsNewBtn" type="button" aria-haspopup="dialog"><span>What’s new</span><small>In ' + esc(VERSION) + '</small></button>' +
    '<button class="btn tray-item" id="playDaysBtn" type="button" aria-pressed="true" hidden><span>Help improve the game</span><small id="playDaysSub">Count which days I play</small></button>' +
    '</div><p class="tray-version"><span id="versionLine" role="button" tabindex="0" aria-label="' + esc(versionLine()) + '">' + esc(versionLine()) + '</span></p>';
  const legal = tray.querySelector('.tray-legal');
  if (legal) tray.insertBefore(section, legal); else tray.appendChild(section);
  $('feedbackBtn').addEventListener('click', () => openFeedback());
  $('whatsNewBtn').addEventListener('click', () => openWhatsNew());
  $('playDaysBtn').addEventListener('click', togglePlayDays);
  let taps = 0, last = 0;
  const tap = () => {
    const now = Date.now();
    taps = now - last > TAP_GAP_MS ? 1 : taps + 1;
    last = now;
    const left = TAPS - taps;
    if (left <= 0) { taps = 0; $('moreClose')?.click(); openTesterPanel(); return; }
    if (left <= 3) toast(['', 'One more tap and you are a tester.', 'Two more taps and you are a tester.', 'Three more taps and you are a tester.'][left]);
  };
  const line = $('versionLine');
  line.addEventListener('click', tap);
  line.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tap(); } });
}

function syncTray() {
  const n = feedback.queued().length;
  const sub = $('feedbackBtnSub');
  if (sub) sub.textContent = n ? (n === 1 ? 'One report waiting to send' : n + ' reports waiting to send') : 'Bugs, confusion, ideas, love';
  const days = $('playDaysBtn');
  if (!days) return;
  days.hidden = !feedback.configured();
  const on = testingState(S).countDays !== false;
  days.setAttribute('aria-pressed', String(on));
  $('playDaysSub').textContent = 'Count which days I play: ' + (on ? 'on' : 'off') + (feedback.signedIn() ? '' : ' (only with cloud save)');
}

async function togglePlayDays() {
  const t = testingState(S);
  t.countDays = t.countDays === false;
  save();
  syncTray();
  if (t.countDays) {
    feedback.resumePlayDays();
    markPlayDay();
    toast('Counting the days you play. Just the dates; nothing else.');
  } else {
    const done = await feedback.forgetPlayDays();
    toast(done || !feedback.signedIn() ? 'Not counting any more. The days already counted are forgotten.' : 'Not counting any more. The days already counted are forgotten as soon as you are back online.');
  }
}

/* ---------------- Help ---------------- */

function helpPanel() {
  const host = $('helpTesters');
  if (!host) return;
  const list = items => '<ul class="tn-list">' + items.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>';
  const n = TESTER_NOTES;
  host.innerHTML = '<p class="tn-intro">' + esc(n.intro) + '</p>' +
    '<h3 class="help-heading">What to try this week <small>' + esc(n.week) + '</small></h3>' + list(n.tryThisWeek) +
    '<h3 class="help-heading">How to report</h3>' + list(n.howToReport) +
    '<div class="tn-actions"><button class="btn btn-primary" type="button" data-tn-report>Report a problem</button></div>' +
    '<h3 class="help-heading">How to start again</h3>' + list(n.howToReset) +
    '<p class="hint">' + esc(versionLine()) + '</p>';
  host.addEventListener('click', event => { if (event.target.closest('[data-tn-report]')) openFeedback(); });
  // One clearly labelled way in from every part of the help sheet.
  const sheet = $('helpVeil')?.querySelector('.sheet');
  const foot = sheet?.querySelector('.guide-footnote');
  if (sheet && foot && !$('helpReport')) {
    const row = document.createElement('div');
    row.className = 'help-report';
    row.innerHTML = '<p>Something broken, confusing or lovely?</p><button class="btn" type="button" id="helpReport">Report a problem</button>';
    sheet.insertBefore(row, foot);
    $('helpReport').addEventListener('click', () => openFeedback());
  }
}

/* ---------------- the network side ---------------- */

function markPlayDay() {
  return feedback.markPlayDay({ allowed: testingState(S).countDays !== false && !clockOffset() && !fakeOffline() });
}
function catchUp() {
  if (!feedback.signedIn() || fakeOffline()) return;
  feedback.flush().then(syncTray, () => {});
  feedback.retryForget().catch(() => {});
  markPlayDay().catch(() => {});
}

/* ---------------- start ---------------- */

export function initTesters({ state, cloud: c, save: s, refresh = () => {}, feedback: f } = {}) {
  S = state; save = s || save; cloud = c;
  feedback = f || createFeedback({ cloud });
  testingState(S);
  traySection();
  helpPanel();
  initFeedback({ state, cloud, feedback, save, prompts: promptsAllowed });
  initWhatsNew();
  initTesterPanel({ state, save, refresh });
  syncTray();
  feedback.subscribe(syncTray);
  cloud?.subscribe?.(change => { if (change?.type === 'session') { syncTray(); catchUp(); } });
  window.addEventListener('online', catchUp);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    catchUp();
    setTimeout(() => maybePulse(), 2500);
  });
  $('moreBtn')?.addEventListener('click', syncTray);
  $('tabMore')?.addEventListener('click', syncTray);
  // After the page has settled: notes first, then at most one question.
  const wantsPanel = (() => { try { return new URLSearchParams(location.search).get('tester') === '1'; } catch { return false; } })();
  const news = checkWhatsNew(S, { save, allowed: () => promptsAllowed() && !wantsPanel });
  catchUp();
  if (wantsPanel) setTimeout(() => openTesterPanel(), 600);
  else if (news !== 'show') setTimeout(() => maybePulse(), 4000);
  return { feedback, openFeedback, openTesterPanel, openWhatsNew };
}
