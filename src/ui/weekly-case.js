// The Case of the Week in the Court lobby and in the Gazette: which case it
// is, how this household ruled, and how the whole neighbourhood has ruled so
// far. Works signed out too: the case is still the week's case, only the
// count needs the cloud.
import { COURT_BY_ID } from '../engine/court.js';
import { weekNumber, weeklyCaseId, daysLeftInWeek, readTally, tallyLine } from '../engine/weekly.js';

const KEY = 'shelflife.weekly';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let cloud = null, tally = null, loadingFor = '', onChange = () => {};

function mine(week) {
  try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); return m && m.week === week && ['plaintiff', 'defendant', 'both'].includes(m.verdict) ? m.verdict : ''; }
  catch { return ''; }
}
function remember(week, verdict) { try { localStorage.setItem(KEY, JSON.stringify({ week, verdict })); } catch { /* the count still has it */ } }

export function weeklyCase(now = Date.now()) {
  const week = weekNumber(now), caseId = weeklyCaseId(week), k = COURT_BY_ID[caseId];
  return k ? { week, caseId, title: k.title, daysLeft: daysLeftInWeek(now) } : null;
}
const signedIn = () => !!cloud?.configured && cloud.signedIn();
const current = info => tally && tally.week === info.week && tally.caseId === info.caseId ? tally : null;

export function initWeeklyCase({ cloud: client = null, changed = () => {} } = {}) { cloud = client; onChange = changed; tally = null; }

// Ask for the count, at most once at a time. Quiet on failure: the lobby simply shows no numbers.
export async function refreshWeekly() {
  const info = weeklyCase();
  if (!info || !signedIn()) { tally = null; return null; }
  const tag = cloud.userId() + ':' + info.week;
  if (loadingFor === tag) return current(info);
  loadingFor = tag;
  try {
    const read = readTally(await cloud.rpc('weekly_tally', { p_week: info.week, p_case: info.caseId }), info.week, info.caseId);
    if (read && cloud.userId() + ':' + info.week === tag) { tally = read; if (read.mine) remember(info.week, read.mine); onChange(); }
  } catch { /* numbers are a courtesy */ }
  finally { if (loadingFor === tag) loadingFor = ''; }
  return current(info);
}

// An aired episode of the week's case, ruled at home (not a friend's papers, not the joint bench).
export async function weeklyRuled(ep) {
  const info = weeklyCase();
  if (!info || !ep || ep.caseId !== info.caseId || ep.guest || ep.joint || !['plaintiff', 'defendant', 'both'].includes(ep.ruling)) return;
  if (mine(info.week)) return;           // the first ruling of the week is the one on record
  remember(info.week, ep.ruling);
  if (!signedIn()) { onChange(); return; }
  const user = cloud.userId();
  try {
    const read = readTally(await cloud.rpc('weekly_rule', { p_week: info.week, p_case: info.caseId, p_verdict: ep.ruling }), info.week, info.caseId);
    if (read && cloud.userId() === user) tally = read;
  } catch { /* it is counted the next time the lobby asks, if the server kept it */ }
  onChange();
}

const RULED = { plaintiff: 'You found for the plaintiff.', defendant: 'You found for the defendant.', both: 'You declared them both idiots.' };
function bars(t) {
  if (!t?.total) return '';
  const row = (key, label) => '<li><span>' + label + '</span><i><b style="width:' + t.share[key] + '%"></b></i><em>' + t.share[key] + '%</em></li>';
  return '<ul class="wk-bars" aria-label="How the neighbourhood ruled">' + row('plaintiff', 'Plaintiff') + row('defendant', 'Defendant') + row('both', 'Both idiots') + '</ul>';
}

// The lobby card. `selected` is the case the lobby currently shows.
export function weeklyLobbyMarkup(selected = '') {
  const info = weeklyCase();
  if (!info) return '';
  const t = current(info), ruled = t?.mine || mine(info.week);
  if (signedIn() && !t && !loadingFor) void refreshWeekly();
  const left = info.daysLeft === 1 ? 'Closes tonight.' : info.daysLeft + ' days left.';
  return '<section class="wk-case" aria-labelledby="wkTitle"><span class="sc-kicker">Case of the week</span><h3 id="wkTitle">' + esc(info.title) + '</h3>' +
    '<p>Every household hears this one. ' + (ruled ? esc(RULED[ruled]) + ' ' : 'Rule on it and be counted. ') + esc(left) + '</p>' +
    (ruled ? bars(t) + '<p class="wk-count">' + esc(t ? tallyLine(t) : signedIn() ? 'Counting the neighbourhood.' : 'Sign in under Friends to see how everyone else ruled.') + '</p>'
      : selected === info.caseId ? '<p class="wk-count">It is on the bench below. The count is sealed until you rule.</p>'
      : '<button class="btn btn-sm" type="button" data-sc="weekly">Hear the case of the week</button>') + '</section>';
}

// A boxed notice for the Gazette. Empty when signed out or when there is nothing to print.
export function weeklyGazetteMarkup() {
  const info = weeklyCase();
  if (!info || !signedIn()) return '';
  const t = current(info), ruled = t?.mine || mine(info.week);
  if (!t && !loadingFor) void refreshWeekly();
  return '<div class="wk-notice"><p class="gz-kicker">Case of the week</p><h4>' + esc(info.title) + '</h4><p>' +
    esc(ruled ? (t ? tallyLine(t) : 'The count is on its way.') : 'The whole neighbourhood is ruling on it. Shelf Court has the papers; the count is sealed until you rule.') + '</p>' + (ruled ? bars(t) : '') + '</div>';
}
