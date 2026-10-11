// Report a problem: the sheet (#feedbackVeil), the "How is it going?" card and
// the "Something on the shelf broke" notice. The sending and the queue live in
// src/cloud/feedback.js; what goes in a report lives in src/diagnostics.js.
//
// The sheet has three steps: write it, check exactly what will be sent, done.
// Nothing leaves the device before the player presses Send on the second step.

import { collectDiagnostics, browserEnv, buildReport, reportText, diagnosticRows, KINDS, DOINGS, MAX_BODY } from '../diagnostics.js';
import { readErrors, onError } from '../errors.js';
import { feedbackText } from '../cloud/feedback.js';
import { duePulse, recordPulse, PULSE_QUESTIONS } from '../tester-state.js';
import { clockOffset, DAY_MS } from '../clock.js';
import { isNative } from '../native.js';
import { toast } from './toast.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND_HINTS = {
  bug: 'What you did, what you expected, and what the shelf did instead.',
  confusing: 'What you were looking at, and what you thought it meant.',
  idea: 'What the shelf should have, and why it would be worse without it.',
  love: 'What you liked. We will pretend to be calm about it.'
};
// Sheets that say nothing about where the trouble was: the More tray and Help
// are usually how a player got to this sheet.
const PASSING = new Set(['', 'moreTray', 'helpVeil', 'feedbackVeil', 'testerVeil', 'whatsNewVeil']);

let S = null, cloud = null, feedback = null, save = () => {}, prompts = () => false;
let draft = null, report = null, step = 'write', lastSheet = { id: '', at: 0 };

/* ---------------- what was open ---------------- */

function watchSheets() {
  new MutationObserver(() => {
    const id = document.body.dataset.activeDialog || '';
    if (!PASSING.has(id)) lastSheet = { id, at: Date.now() };
  }).observe(document.body, { attributes: true, attributeFilter: ['data-active-dialog'] });
}
// The sheet open when the player decided to report, or the one they closed in the last two minutes.
function sheetAtTheTime() {
  const id = document.body.dataset.activeDialog || '';
  if (!PASSING.has(id)) return id;
  return lastSheet.id && Date.now() - lastSheet.at < 120000 ? lastSheet.id : '';
}

function diagnostics({ sheet = '', minimal = false } = {}) {
  return collectDiagnostics({
    state: S, cloud, errors: readErrors(), minimal,
    env: browserEnv({ state: S, sheet, native: isNative(), clockDays: Math.round(clockOffset() / DAY_MS) })
  });
}

/* ---------------- the sheet ---------------- */

function where() {
  if (!feedback.configured()) return { mode: 'copy', text: 'This edition has no server to send to. Copy the report and paste it into an email, or into the issue form linked from the Privacy page.' };
  if (feedback.signedIn()) return { mode: 'send', text: 'It goes to the people who make Shelf Life, from your cloud save account. They can see the account id, never the email.' };
  return { mode: 'keep', text: 'You are not signed in to cloud save, so this waits on this device and goes the next time you sign in. Nothing is sent before then. Or copy it into an email now.' };
}

function writeMarkup() {
  const d = draft;
  return '<div class="fb-step" data-fb-step="write">' +
    '<fieldset class="fb-kinds"><legend>What kind of thing is it?</legend><div class="fb-kind-row">' +
    KINDS.map(k => '<label class="fb-kind"><input type="radio" name="fbKind" value="' + k.id + '"' + (d.kind === k.id ? ' checked' : '') + '><span><b>' + esc(k.label) + '</b><small>' + esc(k.hint) + '</small></span></label>').join('') +
    '</div></fieldset>' +
    (d.error ? '<p class="fb-error-note"><b>The error that just happened is included:</b> ' + esc(d.error.message) + (d.error.source ? ' <span>(' + esc(d.error.source) + ')</span>' : '') + '</p>' : '') +
    '<label class="fb-label" for="fbBody">What happened?</label>' +
    '<textarea id="fbBody" maxlength="' + MAX_BODY + '" rows="5" aria-describedby="fbCount" placeholder="' + esc(KIND_HINTS[d.kind] || 'Say what happened, in as much or as little detail as you like.') + '">' + esc(d.body) + '</textarea>' +
    '<p class="fb-count" id="fbCount">' + d.body.length + ' of ' + MAX_BODY + '</p>' +
    '<label class="fb-label" for="fbDoing">What were you doing? <span>(optional)</span></label>' +
    '<select id="fbDoing">' + DOINGS.map(([id, label]) => '<option value="' + id + '"' + (d.doing === id ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select>' +
    '<label class="fb-attach"><input type="checkbox" id="fbAttach"' + (d.attach ? ' checked' : '') + '><span><b>Attach diagnostics</b><small>The version, this device and its settings, and the last errors the game caught. Never your email, never your shelf.</small></span></label>' +
    '<div class="fb-actions"><button class="btn btn-primary" type="button" data-fb-review>Check what will be sent</button></div>' +
    '<p class="hint fb-why" id="fbWhy" role="status"></p>' +
    queuedLine() + '</div>';
}
function queuedLine() {
  const n = feedback.queued().length;
  return n ? '<p class="hint fb-queued">' + (n === 1 ? 'One report is' : n + ' reports are') + ' waiting on this device for cloud save.</p>' : '';
}

function reviewMarkup() {
  const w = where();
  const rows = diagnosticRows(report.diagnostics);
  return '<div class="fb-step" data-fb-step="review">' +
    '<h3 class="fb-h">This is everything that will be sent</h3>' +
    '<p class="fb-where">' + esc(w.text) + '</p>' +
    '<dl class="fb-review">' +
    '<div><dt>Kind</dt><dd>' + esc(KINDS.find(k => k.id === report.kind)?.label || report.kind) + '</dd></div>' +
    '<div class="fb-wide"><dt>What happened</dt><dd class="fb-body">' + (report.body ? esc(report.body) : '<i>Nothing written</i>') + '</dd></div>' +
    '<div><dt>Doing</dt><dd>' + esc(DOINGS.find(([id]) => id === report.doing)?.[1] || 'Not said') + '</dd></div>' +
    (report.diagnostics
      ? rows.map(([label, value]) => '<div' + (value.length > 40 ? ' class="fb-wide"' : '') + '><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>').join('') +
        (report.diagnostics.errors?.length ? '<div class="fb-wide"><dt>The errors</dt><dd><ol class="fb-errors">' + report.diagnostics.errors.map(e =>
          '<li><span>' + esc(e.message) + (e.count > 1 ? ' (' + e.count + ' times)' : '') + '</span><small>' + esc(e.source || 'unknown file') + (e.at ? ' · ' + esc(e.at.slice(0, 16).replace('T', ' ')) : '') + '</small></li>').join('') + '</ol></dd></div>' : '')
      : '<div class="fb-wide"><dt>Diagnostics</dt><dd>Not attached</dd></div>') +
    '<div class="fb-wide"><dt>Report id</dt><dd>' + esc(report.client_id) + '</dd></div>' +
    '</dl>' +
    '<details class="fb-raw"><summary>As the server receives it</summary><pre tabindex="0">' + esc(JSON.stringify(serverFields(report), null, 2)) + '</pre></details>' +
    '<div class="fb-actions">' +
    (w.mode === 'copy' ? '' : '<button class="btn btn-primary" type="button" data-fb-send>' + (w.mode === 'send' ? 'Send' : 'Keep it to send later') + '</button>') +
    '<button class="btn' + (w.mode === 'copy' ? ' btn-primary' : '') + '" type="button" data-fb-copy>Copy report</button>' +
    '<button class="btn btn-ghost" type="button" data-fb-back>Back</button></div>' +
    '<p class="fb-status" id="fbStatus" role="status" aria-live="polite"></p></div>';
}
// Exactly the fields src/cloud/feedback.js passes to submit_feedback.
function serverFields(r) {
  return { client_id: r.client_id, kind: r.kind, body: r.body, doing: r.doing, rating: r.rating, moment: r.moment, version: r.version, platform: r.platform, diagnostics: r.diagnostics };
}

function doneMarkup(outcome) {
  const text = outcome === 'sent' ? 'Sent. Somebody will read every word, then possibly read it out loud to somebody else.'
    : outcome === 'kept' ? 'Kept on this device. It goes the next time you sign in to cloud save, and not a moment before.'
    : 'No connection, so it is kept on this device. It goes as soon as the shelf is back online.';
  return '<div class="fb-step" data-fb-step="done"><p class="fb-done" role="status">' + esc(text) + '</p>' +
    '<div class="fb-actions"><button class="btn btn-primary" type="button" data-fb-finish>Back to the shelf</button></div></div>';
}

function render(outcome) {
  const sheet = $('feedbackSheet');
  if (!sheet) return;
  let body = sheet.querySelector('.fb-body-host');
  if (!body) {
    sheet.innerHTML = '<div class="sheet-head"><div><span class="eyebrow">Straight to the people responsible</span><h2 id="feedbackTitle">Report a problem</h2></div><button class="btn btn-ghost btn-sm" type="button" data-fb-close>Close</button></div><div class="fb-body-host"></div>';
    body = sheet.querySelector('.fb-body-host');
  }
  body.innerHTML = step === 'review' ? reviewMarkup() : step === 'done' ? doneMarkup(outcome) : writeMarkup();
  syncReviewButton();
}

function readForm() {
  const sheet = $('feedbackSheet');
  if (!sheet || step !== 'write') return;
  draft.kind = sheet.querySelector('input[name="fbKind"]:checked')?.value || draft.kind;
  draft.body = $('fbBody')?.value.slice(0, MAX_BODY) ?? draft.body;
  draft.doing = $('fbDoing')?.value ?? draft.doing;
  draft.attach = $('fbAttach')?.checked ?? draft.attach;
}
function why() {
  if (!draft.kind) return 'Choose what kind of thing it is first.';
  if (!draft.body.trim() && !draft.error) return 'Say a few words about it first.';
  return '';
}
function syncReviewButton() {
  const button = $('feedbackSheet')?.querySelector('[data-fb-review]');
  if (!button) return;
  button.setAttribute('aria-describedby', 'fbWhy');
  button.dataset.ready = why() ? '' : '1';
}

function freshDraft({ kind = '', error = null, sheet = '' } = {}) {
  return { kind, body: '', doing: '', attach: true, error, sheet };
}

export function openFeedback({ kind = '', error = null } = {}) {
  const veil = $('feedbackVeil');
  if (!veil || !S) return;
  const sheet = sheetAtTheTime();
  // A fresh start unless an unsent draft is waiting, or a new error asks for its own report.
  if (!draft || error || step === 'done') draft = freshDraft({ kind, error, sheet });
  else { if (kind && !draft.kind) draft.kind = kind; draft.sheet = sheet || draft.sheet; }
  step = 'write'; report = null;
  // Another sheet underneath would keep the focus boundary; close it first.
  document.querySelectorAll('.veil.open').forEach(other => { if (other !== veil) other.querySelector('.sheet-head button')?.click(); });
  render();
  veil.classList.add('open');
}
export function closeFeedback() { $('feedbackVeil')?.classList.remove('open'); }

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back to a selection */ }
  try {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    $('feedbackSheet').appendChild(area); area.select();
    const ok = document.execCommand('copy'); area.remove(); return ok;
  } catch { return false; }
}

async function send() {
  const status = $('fbStatus'), button = $('feedbackSheet').querySelector('[data-fb-send]');
  if (button) button.disabled = true;
  if (status) status.textContent = 'Sending…';
  try {
    const outcome = await feedback.submit(report);
    const signed = feedback.signedIn();
    draft = null; step = 'done';
    render(outcome === 'sent' ? 'sent' : signed ? 'offline' : 'kept');
    $('feedbackSheet').querySelector('[data-fb-finish]')?.focus({ preventScroll: true });
  } catch (error) {
    if (button) button.disabled = false;
    if (status) status.textContent = feedbackText(error);
  }
}

function wireSheet() {
  const sheet = $('feedbackSheet'), veil = $('feedbackVeil');
  veil.addEventListener('click', event => { if (event.target === veil) closeFeedback(); });
  sheet.addEventListener('input', event => {
    if (event.target.id === 'fbBody') {
      readForm();
      $('fbCount').textContent = draft.body.length + ' of ' + MAX_BODY;
      syncReviewButton();
    }
  });
  sheet.addEventListener('change', event => {
    readForm();
    if (event.target.name === 'fbKind') $('fbBody')?.setAttribute('placeholder', KIND_HINTS[draft.kind]);
    syncReviewButton();
    const reason = $('fbWhy');
    if (reason && reason.textContent && !why()) reason.textContent = '';
  });
  sheet.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-fb-close') || target.hasAttribute('data-fb-finish')) { closeFeedback(); return; }
    if (target.hasAttribute('data-fb-review')) {
      readForm();
      const reason = why();
      if (reason) { $('fbWhy').textContent = reason; (draft.kind ? $('fbBody') : sheet.querySelector('input[name="fbKind"]'))?.focus(); return; }
      const d = draft.attach ? diagnostics({ sheet: draft.sheet }) : null;
      // An error reported from its own notice is at the end of the list; keep it there even if the list is long.
      report = buildReport({ kind: draft.kind, body: draft.body, doing: draft.doing, diagnostics: d });
      step = 'review'; render();
      sheet.querySelector('.fb-h')?.focus?.({ preventScroll: true });
      sheet.closest('.veil')?.scrollTo?.({ top: 0 });
      sheet.scrollTop = 0;
      return;
    }
    if (target.hasAttribute('data-fb-back')) { step = 'write'; render(); $('fbBody')?.focus(); return; }
    if (target.hasAttribute('data-fb-copy')) {
      const ok = await copy(reportText(report));
      const status = $('fbStatus');
      if (status) status.textContent = ok ? 'Copied. Paste it into an email, and attach a screenshot if you have one.' : 'Could not copy here. Open “As the server receives it” and copy the text by hand.';
      return;
    }
    if (target.hasAttribute('data-fb-send')) send();
  });
}

/* ---------------- "How is it going?" ---------------- */

let pulseShown = false, pulse = null;
const RATING_WORDS = ['', 'grim', 'not great', 'all right', 'good', 'delightful'];

function pulseCard() {
  let card = $('pulseCard');
  if (card) return card;
  card = document.createElement('section');
  card.id = 'pulseCard';
  card.className = 'pulse-card';
  card.hidden = true;
  card.setAttribute('aria-labelledby', 'pulseQuestion');
  const after = $('cloudNudge') || $('backupBanner') || $('updateBanner');
  if (after) after.after(card); else document.body.prepend(card);
  card.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !pulse) return;
    if (button.dataset.pulse) chooseRating(Number(button.dataset.pulse));
    else if (button.hasAttribute('data-pulse-later')) pulseLater();
    else if (button.hasAttribute('data-pulse-send')) sendPulse();
  });
  card.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.id === 'pulseLine') { event.preventDefault(); sendPulse(); } });
  return card;
}

export function showPulse(moment) {
  if (!S || !moment) return false;
  const card = pulseCard();
  pulse = { moment, rating: 0, timer: 0 };
  card.innerHTML = '<p class="pulse-q" id="pulseQuestion">' + esc(PULSE_QUESTIONS[moment]) + '</p>' +
    '<div class="pulse-scale" role="group" aria-labelledby="pulseQuestion pulseRange">' +
    [1, 2, 3, 4, 5].map(n => '<button type="button" class="pulse-n" data-pulse="' + n + '" aria-pressed="false" aria-label="' + n + ' out of 5, ' + RATING_WORDS[n] + '">' + n + '</button>').join('') +
    '</div><p class="pulse-ends" id="pulseRange"><span>1 is grim</span><span>5 is delightful</span></p>' +
    '<div class="pulse-more" hidden><label for="pulseLine">Anything to add? <span>(optional)</span></label>' +
    '<div class="pulse-row"><input id="pulseLine" type="text" maxlength="200" autocomplete="off" placeholder="One line is plenty"><button class="btn btn-primary" type="button" data-pulse-send>Send</button></div></div>' +
    '<div class="pulse-foot"><button class="btn btn-ghost btn-sm" type="button" data-pulse-later>Not now</button></div>' +
    '<p class="pulse-status" role="status" aria-live="polite"></p>';
  card.hidden = false;
  pulseShown = true;
  return true;
}
function chooseRating(n) {
  const card = $('pulseCard');
  pulse.rating = n;
  card.querySelectorAll('[data-pulse]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.pulse) === n)));
  card.querySelector('.pulse-more').hidden = false;
  card.querySelector('[data-pulse-later]').hidden = true;
  // One tap is an answer: it goes by itself in a minute, or when the game is put away.
  clearTimeout(pulse.timer);
  pulse.timer = setTimeout(sendPulse, 60000);
}
async function sendPulse() {
  if (!pulse?.rating) return;
  const { moment, rating } = pulse;
  clearTimeout(pulse.timer);
  const line = ($('pulseLine')?.value || '').trim().slice(0, 200);
  pulse = null;
  recordPulse(S, moment, 'sent'); save();
  const card = $('pulseCard');
  card.innerHTML = '<p class="pulse-thanks" role="status">Thank you. Noted, filed, and only slightly judged.</p>';
  setTimeout(() => { card.hidden = true; }, 3500);
  try { await feedback.submit(buildReport({ kind: 'pulse', rating, moment, body: line, diagnostics: diagnostics({ minimal: true }) })); }
  catch { /* a refused check-in is not worth interrupting anyone over */ }
}
function pulseLater() {
  const { moment } = pulse;
  clearTimeout(pulse.timer);
  pulse = null;
  recordPulse(S, moment, 'notnow'); save();
  $('pulseCard').hidden = true;
  toast('Fair enough. It will keep.');
}
// Put away mid-answer: the rating already given still counts.
function flushPulse() { if (pulse?.rating) sendPulse(); }

export function maybePulse(now = Date.now()) {
  if (pulseShown || !S || !prompts() || document.querySelector('.veil.open') || document.body.dataset.guide === 'on') return false;
  return showPulse(duePulse(S, now));
}

/* ---------------- "Something on the shelf broke" ---------------- */

const BROKE_KEY = 'shelflife.broke';
let brokeShown = false;
function brokeThisSession() {
  if (brokeShown) return true;
  try { return sessionStorage.getItem(BROKE_KEY) === '1'; } catch { return false; }
}
export function showBroke(entry) {
  if (brokeThisSession()) return false;
  brokeShown = true;
  try { sessionStorage.setItem(BROKE_KEY, '1'); } catch { /* once per page then */ }
  let notice = $('brokeNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'brokeNotice';
    notice.className = 'broke-notice';
    notice.setAttribute('role', 'status');
    document.body.appendChild(notice);
    notice.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      notice.hidden = true;
      if (button.hasAttribute('data-broke-tell')) openFeedback({ kind: 'bug', error: notice.__entry });
    });
  }
  notice.__entry = entry;
  notice.innerHTML = '<span>Something on the shelf broke. Tell us?</span><button class="btn btn-sm btn-primary" type="button" data-broke-tell>Tell us</button><button class="btn btn-sm btn-ghost broke-x" type="button" data-broke-dismiss aria-label="Dismiss">Not now</button>';
  notice.hidden = false;
  setTimeout(() => { notice.hidden = true; }, 15000);
  return true;
}

/* ---------------- wiring ---------------- */

export function initFeedback({ state, cloud: c, feedback: f, save: s, prompts: p }) {
  S = state; cloud = c; feedback = f; save = s || save; prompts = p || prompts;
  if (!$('feedbackVeil')) return;
  wireSheet();
  watchSheets();
  onError(entry => { if (prompts()) showBroke(entry); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushPulse(); });
  window.addEventListener('pagehide', flushPulse);
}
