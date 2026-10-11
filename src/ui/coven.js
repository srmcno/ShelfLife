// Covens in the Friends sheet: a home section, a friend action, postbox mail
// and the coven's own views (the coven, founding, inviting, the notice board
// and its magnet composer, the Monday Shelfies, and invite rewards). Plugged in
// only through ui/social-registry.js; never edits friends.js.
//
// Also the quiet work: every time the game saves, the Almanac's counters are
// read again and today's running totals go up (engine/coven.js), and every
// couple of minutes, or when the page is hidden, they are reported to the
// server. Nothing at all is sent until the player has opened Friends once on
// this account.
//
// Everything a friend can make appear here is from a word bank, a part list or
// a cleaned display name, and goes through esc().
import { registerFriendAction, registerPostboxSource, registerFriendsSection, registerSocialView } from './social-registry.js';
import { cloud, social } from '../cloud/index.js';
import { createCovenClient, covenText } from '../cloud/coven.js';
import { coopText } from '../cloud/coop.js';
import { CloudError } from '../cloud/client.js';
import { formatCode, cleanCode } from '../cloud/social.js';
import { state as liveState, save, Store } from '../state.js';
import {
  syncCoven, setCoven, pendingReports, markReported, covenWeek, daysLeft, thresholds, tierReached, goalLine, counterWord, planChest, chestPaid,
  wearFrame, planInvite, invitePaid, bindCovenRewards, randomName, randomSigil, covenName, cleanSigil, memberColours, noteParts, noteText, hideNote, computeAwards, ceremonyScript,
  recordCeremony, utcDay
} from '../engine/coven.js';
import { covenState } from '../coven-state.js';
import {
  MAX_MEMBERS, NAME_FORMS, SIGIL_SHAPES, SIGIL_SYMBOLS, SIGIL_COLOURS, GOAL_BY_ID, CHEST_TIERS, COVEN_CURIOS, SIGIL_FRAMES, SIGIL_FRAME_BY_ID,
  AWARD_BY_ID, COVEN_LINES, EMPTY_BOARD, INVITE_DAYS, INVITE_FRAMES
} from '../content/coven.js';
import { PORTRAIT_BY_ID } from '../content/collections.js';
import { sigilSVG, covenCurioSVG, trophySVG, STAGE_SVG } from '../art/coven-art.js';
import { castSvg, COURT_PROPS } from '../art/court-cast.js';
import { createMagnets } from './magnets.js';
import { toast } from './toast.js';
import { loadingState } from './fx.js';
import { celebrate, chime } from './retention-kit.js';
import { timeAgo } from './cloud.js';
import { PLAY_URL } from '../backup.js';
import { isNative, shareText } from '../native.js';
import { currencyRewardId, queueCoopReward, coopRewardReceipt } from '../engine/coop-money.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const coven = createCovenClient({ cloud, social });
const rewardWallet = { reconcile: async owner => (await import('./coop.js')).reconcileCoopWallet(owner), operationId: currencyRewardId };
const STATUS_FRESH = 60000, REPORT_GAP = 120000, VIEW = { main: 'coven', found: 'coven-found', pick: 'coven-invite-pick', board: 'coven-board',
  compose: 'coven-compose', ceremony: 'coven-ceremony', recruit: 'coven-recruit' };
const S = () => liveState;
const me = () => social.signedIn() ? cloud.userId() : null;
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const lineOf = (list, seed = 0) => list[Math.abs(seed) % list.length];

/* ---------- what this page knows ---------- */
let status = null, statusAt = 0, statusError = '', loading = null;
let board = null, boardError = '', referrals = null;
let draft = null, pendingInvite = null, confirm = '', notice = '', busy = false, ceremony = null, composer = null, recruitDraft = '';
// Backup restores replace the nested coven while keeping the exported shelf
// object and account. Pending rewards belong to that original nested state.
let accountOwner = me(), shelfOwner = covenState(S()), accountVersion = 0;
const identity = (user, version) => !!user && me() === user && version === accountVersion && covenState(S()) === shelfOwner;
const contextVersions = new WeakMap();
function currentCtx(ctx) {
  if (ctx?.isCurrent?.() === false) return false;
  if (!ctx) return true;
  if (!contextVersions.has(ctx)) contextVersions.set(ctx, accountVersion);
  return contextVersions.get(ctx) === accountVersion;
}
async function owned(ctx, promise) {
  const user = me(), version = accountVersion;
  const value = await promise;
  if (!identity(user, version) || !currentCtx(ctx)) throw new CloudError('The account changed.', { code: 'signed_out', status: 401 });
  return value;
}
async function reconcileRewardWallet(ctx, owner) {
  const purse = S().coop;
  await owned(ctx, rewardWallet.reconcile(owner));
  if (S().coop !== purse) throw new CloudError('The shelf changed.', { code: 'signed_out', status: 401 });
}

async function refreshStatus({ force = false } = {}) {
  if (!coven.active()) return null;
  if (!force && status && Date.now() - statusAt < STATUS_FRESH && status.user === me()) return status;
  const user = me();
  const version = accountVersion;
  if (loading?.user === user && loading.version === version) return loading.promise;
  const request = { user, version };
  request.promise = coven.status().then(s => {
    if (!identity(user, version)) return null;
    status = { ...s, user }; statusAt = Date.now(); statusError = '';
    const membershipChanged = setCoven(S(), s.coven?.id || '', Date.now());
    if (bindCovenRewards(S(), user) || membershipChanged) save();
    return status;
  }).catch(error => { if (identity(user, version)) statusError = covenText(error); throw error; }).finally(() => { if (loading === request) loading = null; });
  loading = request;
  return request.promise;
}
const current = () => status && status.user === me() && coven.active() ? status : null;
const myShare = s => s?.week?.shares.find(x => x.userId === me())?.amount || 0;

/* ---------- counting and reporting ---------- */
let reporting = null, lastReport = 0, syncTimer = null;
export function reportNow({ force = false } = {}) {
  const user = me(), version = accountVersion;
  if (!coven.active()) return Promise.resolve(false);
  if (reporting?.user === user && reporting.version === version) return reporting.promise;
  const st = S();
  try { syncCoven(st); } catch { return Promise.resolve(false); }
  const reports = pendingReports(st);
  if (!reports.length || (!force && Date.now() - lastReport < REPORT_GAP)) return Promise.resolve(false);
  lastReport = Date.now();
  const request = { user, version };
  request.promise = (async () => {
    for (const r of reports) {
      if (!identity(user, version)) return false;
      try {
        const res = await coven.contribute(r.day, r.counts);
        if (!identity(user, version)) return false;
        markReported(st, r);
        const s = current();
        if (s?.week && res.week === s.week.no) {
          s.week.progress = res.progress;
          const mine = s.week.shares.find(x => x.userId === me());
          if (mine) mine.amount = res.mine; else if (res.mine) s.week.shares.push({ userId: me(), amount: res.mine });
        }
      } catch (error) {
        if (!identity(user, version)) return false;
        // A day the server will not take (a clock far out) is let go; the counts are not lost, only that day's report.
        if (error.code === 'bad_day' || error.code === 'bad_counts') markReported(st, r);
        else if (error.code === 'no_coven') { setCoven(st, '', Date.now()); status = null; }
        else break;
      }
    }
    if (!identity(user, version)) return false;
    save();
    return true;
  })().finally(() => { if (reporting === request) reporting = null; });
  reporting = request;
  return request.promise;
}
function scheduleSync() {
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    try { if (Object.keys(syncCoven(S())).length) reportNow(); } catch { /* counting must never stop the shelf */ }
  }, 1500);
}
// One play day a day, for invite rewards. Remembered beside the session, never in the save.
function markDay() {
  const uid = me();
  const version = accountVersion;
  if (!uid || !coven.active() || S().testing?.countDays === false) return;
  const key = uid + '|' + utcDay();
  if (cloud.meta().covenDay === key) return;
  coven.markActiveDay().then(result => {
    if (identity(uid, version) && result.counted && S().testing?.countDays !== false) cloud.setMeta({ covenDay: key });
  }).catch(() => { /* tomorrow, then */ });
}
async function wake() {
  if (!coven.active()) return;
  markDay();
  try { await refreshStatus(); } catch { /* the sheet says so when it is opened */ }
  reportNow();
}
// A shared link: ?invite=CODE. Kept with the shelf until it has been used.
function readInviteLink() {
  try {
    const url = new URL(globalThis.location.href), code = cleanCode(url.searchParams.get('invite'));
    if (!url.searchParams.has('invite')) return;
    if (code) { covenState(S()).invite.code = code; save(); }
    url.searchParams.delete('invite');
    globalThis.history?.replaceState?.(globalThis.history.state, '', url.pathname + url.search + url.hash);
  } catch { /* a link we cannot read is a link we ignore */ }
}

/* ---------- small pieces of markup ---------- */
const name = card => covenName(card?.name);
function sigil(card, opts = {}) { return sigilSVG(cleanSigil(card?.sigil), opts); }
function colours(s) { return memberColours(cleanSigil(s.coven.sigil).colour, Math.max(1, s.members.length)); }
function memberName(s, userId) {
  if (userId === me()) return 'You';
  const m = s.members.find(x => x.userId === userId);
  return m ? m.name || 'A member' : 'A former member';
}
function progressBar(s, { compact = false } = {}) {
  const w = s.week, cs = colours(s), total = Math.max(w.target, w.progress);
  const segs = s.members.map((m, i) => ({ m, colour: cs[i], amount: w.shares.find(x => x.userId === m.userId)?.amount || 0 })).filter(x => x.amount);
  const others = w.progress - segs.reduce((n, x) => n + x.amount, 0);
  const pct = n => Math.max(0, Math.min(100, (n / total) * 100)).toFixed(2);
  const ticks = thresholds(w.target).slice(0, 2).map(t => '<i class="cv-tick" style="left:' + pct(t) + '%"></i>').join('');
  const label = w.progress + ' of ' + w.target + ' ' + counterWord(w.counter, w.target);
  return '<div class="cv-bar' + (compact ? ' compact' : '') + '" role="img" aria-label="' + esc(label + '. ' + segs.map(x => memberName(s, x.m.userId) + ' ' + x.amount).join(', ')) + '">' +
    segs.map(x => '<span style="width:' + pct(x.amount) + '%;background:' + x.colour + '"></span>').join('') +
    (others > 0 ? '<span class="cv-bar-gone" style="width:' + pct(others) + '%"></span>' : '') + ticks + '</div>' +
    (compact ? '' : '<ul class="cv-legend">' + s.members.map((m, i) => '<li><i style="background:' + cs[i] + '"></i>' + esc(memberName(s, m.userId)) + ' <b>' +
      (w.shares.find(x => x.userId === m.userId)?.amount || 0) + '</b></li>').join('') + '</ul>');
}
function noteHTML(note, s, { actions = true } = {}) {
  const parts = noteParts(note.tiles, note.names);
  if (!parts.length) return '';
  const author = note.author === me() ? 'You' : note.authorName || memberName(s, note.author);
  const mine = note.author === me(), named = note.mentions.includes(me()), founder = s.coven.role === 'founder';
  const buttons = actions ? '<div class="cv-note-actions">' +
    (mine || named || founder ? '<button class="btn btn-sm" type="button" data-sx="note-down" data-id="' + note.id + '">Take down</button>' : '') +
    (!mine ? '<button class="btn btn-sm btn-ghost" type="button" data-sx="note-hide" data-id="' + note.id + '">Hide</button>' +
      '<button class="btn btn-sm btn-ghost fr-warn" type="button" data-sx="note-report" data-id="' + note.id + '" data-user="' + esc(note.author) + '">Report</button>' : '') + '</div>' : '';
  const confirmBox = confirm === 'report:' + note.id
    ? '<div class="fr-confirm" role="group" aria-label="Report this note"><p><b>Report this note?</b> A person reads it. ' + esc(author) + ' is not told who sent it. You can block them too.</p><div class="fr-actions">' +
      '<button class="btn fr-warn" type="button" data-sx="note-report-yes" data-id="' + note.id + '" data-user="' + esc(note.author) + '">Send report</button>' +
      '<button class="btn fr-warn" type="button" data-sx="note-block-yes" data-id="' + note.id + '" data-user="' + esc(note.author) + '">Report and block</button>' +
      '<button class="btn btn-ghost" type="button" data-sx="cancel">Cancel</button></div></div>' : '';
  return '<li class="cv-note" data-cv-note="' + note.id + '"><div class="cv-magnets" aria-label="' + esc(noteText(parts)) + '">' +
    parts.map(p => '<span class="mg-tile mg-static' + (p.kind === 'punct' ? ' mg-punct' : p.kind === 'name' ? ' mg-name' : '') + '" aria-hidden="true">' + esc(p.text) + '</span>').join('') +
    '</div><p class="cv-note-meta">' + esc(author + ', ' + timeAgo(note.createdAt)) + '</p>' + buttons + confirmBox + '</li>';
}
const visibleNotes = () => (board || []).filter(n => !covenState(S()).hidden.includes(n.id) && noteParts(n.tiles, n.names).length);

/* ---------- the home section ---------- */
function homeHTML() {
  if (!social.signedIn() || !coven.active()) return '';
  const s = current();
  if (!s) {
    if (!loading && !statusError) refreshStatus().then(() => repaint(), () => repaint());
    return '<section class="cv-home" aria-labelledby="cvHomeTitle"><h3 id="cvHomeTitle">Coven</h3>' +
      (statusError ? '<p class="cv-error">' + esc(statusError) + ' <button class="btn btn-sm" type="button" data-sx="coven-retry">Try again</button></p>' : loadingState('Checking the coven register.')) + '</section>';
  }
  if (s.coven && !s.week) return '<section class="cv-home"><h3>Coven</h3><p class="cv-error">The rite could not be read. <button class="btn btn-sm" type="button" data-sx="coven-retry">Try again</button></p></section>';
  if (s.coven) {
    const g = GOAL_BY_ID[s.week?.goal];
    return '<section class="cv-home" aria-labelledby="cvHomeTitle"><h3 id="cvHomeTitle">Coven</h3>' +
      '<button class="cv-home-card" type="button" data-sx="coven-open"><span class="cv-home-sigil">' + sigil(s.coven, { frame: s.coven.frame }) + '</span>' +
      '<span class="cv-home-text"><b>' + esc(name(s.coven)) + '</b><small>' + esc((g?.title || 'This week') + ': ' + s.week.progress + ' of ' + s.week.target + ', ' + plural(daysLeft(s.week.no), 'day') + ' left') + '</small>' +
      progressBar(s, { compact: true }) + '</span></button>' + homeExtras(s) + '</section>';
  }
  return '<section class="cv-home" aria-labelledby="cvHomeTitle"><h3 id="cvHomeTitle">Coven</h3>' +
    '<p class="cv-pitch">' + esc(lineOf(COVEN_LINES.pitch, new Date().getUTCDate())) + '</p>' + invitesHTML(s) +
    '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="coven-found">Found a coven</button>' +
    '<button class="btn" type="button" data-sx="coven-recruit">Invite a new player</button></div>' + homeExtras(s) + '</section>';
}
function homeExtras(s) {
  const n = chestsReady(s).length;
  return (s.coven && n ? '<p class="cv-flag">' + esc(plural(n, 'chest') + ' ready to open.') + ' <button class="btn btn-sm" type="button" data-sx="coven-open">Open the coven</button></p>' : '') +
    (s.coven && awardsWaiting(s) ? '<p class="cv-flag">The Shelfies are on. <button class="btn btn-sm" type="button" data-sx="ceremony">Watch</button></p>' : '');
}
function invitesHTML(s) {
  if (!s.invites.length) return '';
  return '<ul class="cv-invites">' + s.invites.map(inviteRow).join('') + '</ul>';
}
function inviteRow(i) {
  const confirmBox = confirm === 'block-invite:' + i.id
    ? '<div class="fr-confirm" role="group"><p><b>Block ' + esc(i.fromName || 'them') + '?</b> The invitation is torn up, they are removed as a friend and your code stops working for them. They are not told.</p><div class="fr-actions"><button class="btn fr-warn" type="button" data-sx="invite-block-yes" data-id="' + esc(i.id) + '" data-user="' + esc(i.fromUser) + '">Block</button><button class="btn btn-ghost" type="button" data-sx="cancel">Cancel</button></div></div>' : '';
  return '<li class="cv-invite" data-cv-invite="' + esc(i.id) + '"><span class="cv-invite-sigil">' + sigil(i.coven) + '</span><div><p><b>' + esc(name(i.coven)) + '</b></p>' +
    '<p class="cv-small">' + esc((i.fromName || 'A friend') + ' invites you. ' + plural(i.coven.members, 'member') + ', ' + (MAX_MEMBERS - i.coven.members) + ' seats left.') + '</p>' +
    '<p class="cv-small cv-quiet">' + esc(lineOf(COVEN_LINES.inviteLine, i.createdAt)) + '</p></div>' +
    '<div class="fr-actions cv-invite-actions"><button class="btn btn-sm btn-primary" type="button" data-sx="accept" data-sx-id="' + esc(i.id) + '" data-id="' + esc(i.id) + '">Join</button>' +
    '<button class="btn btn-sm" type="button" data-sx="decline" data-sx-id="' + esc(i.id) + '" data-id="' + esc(i.id) + '">Decline</button>' +
    '<button class="btn btn-sm btn-ghost fr-warn" type="button" data-sx="invite-block" data-sx-id="' + esc(i.id) + '" data-id="' + esc(i.id) + '">Block</button>' +
    '<button class="btn btn-sm btn-ghost fr-warn" type="button" data-sx="invite-report" data-sx-id="' + esc(i.id) + '" data-id="' + esc(i.id) + '" data-user="' + esc(i.fromUser) + '">Report</button></div>' + confirmBox + '</li>';
}

/* ---------- chests and awards ---------- */
function chestsReady(s) {
  if (!s?.coven || !s.week) return [];
  const out = [];
  const weekly = (w, mine) => { if (!w || !(mine > 0)) return; for (let t = 1; t <= tierReached(w.progress, w.target); t++) if (!chestPaid(S(), w.no, t, me())) out.push({ week: w.no, tier: t }); };
  weekly(s.week, myShare(s));
  if (s.last) weekly(s.last, s.last.members.find(m => m.userId === me())?.counts[s.last.counter] || 0);
  return out;
}
const awardsWaiting = s => !!(s?.last && s.last.members.some(m => m.userId === me()) && s.last.no > covenState(S()).seenAwards);
function chestHTML(s, w, mine) {
  const reached = tierReached(w.progress, w.target), marks = thresholds(w.target);
  return '<ul class="cv-chests">' + CHEST_TIERS.map((c, i) => {
    const t = i + 1, opened = chestPaid(S(), w.no, t, me());
    const state = opened ? 'opened' : reached >= t ? (mine > 0 ? 'ready' : 'closed') : 'locked';
    const side = state === 'ready' ? '<button class="btn btn-sm btn-primary" type="button" data-sx="claim" data-week="' + w.no + '" data-tier="' + t + '">' + (w.claimed.includes(t) ? 'Collect on this shelf' : 'Open') + '</button>'
      : '<span class="cv-chest-state">' + (state === 'opened' ? 'Opened' : state === 'closed' ? 'For those who helped' : 'At ' + marks[i]) + '</span>';
    return '<li class="cv-chest ' + state + '"><div><b>' + esc(c.name) + '</b><small>' + esc(c.souls + ' souls' + (c.curio ? ' and a cupboard curio' : c.frame ? ' and a sigil frame' : '')) + '</small></div>' + side + '</li>';
  }).join('') + '</ul>';
}

/* ---------- the coven view ---------- */
function covenHTML() {
  const s = current();
  if (!s) return loadingState('Unlocking the meeting room.');
  if (!s.coven) return '<p>' + esc('You are not in a coven any more.') + '</p><div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="coven-found">Found a coven</button></div>';
  if (!s.week) return '<p class="cv-error">The rite could not be read. <button class="btn btn-sm" type="button" data-sx="coven-retry">Try again</button></p>';
  const c = s.coven, w = s.week, g = GOAL_BY_ID[w.goal], founder = c.role === 'founder', cs = colours(s);
  const st = covenState(S());
  const notes = visibleNotes();
  return (notice ? '<p class="cv-notice" role="status">' + esc(notice) + '</p>' : '') +
    '<header class="cv-head"><span class="cv-head-sigil">' + sigil(c, { frame: c.frame, label: 'The sigil of ' + name(c) }) + '</span><div><h3>' + esc(name(c)) + '</h3>' +
    '<p class="cv-small">' + esc(plural(s.members.length, 'member') + ' of ' + MAX_MEMBERS + (founder ? '. You hold the candle.' : '. ' + memberName(s, s.members.find(m => m.role === 'founder')?.userId) + ' holds the candle.')) + '</p></div></header>' +
    (awardsWaiting(s) ? '<div class="cv-banner"><p><b>The Shelfies are on.</b> ' + esc(lineOf(COVEN_LINES.awardsReady, s.last.no)) + '</p><button class="btn btn-primary" type="button" data-sx="ceremony">Watch the Shelfies</button></div>' : '') +
    '<section class="cv-rite" aria-labelledby="cvRiteTitle"><p class="cv-kicker">This week’s rite, ' + esc(plural(daysLeft(w.no), 'day')) + ' left</p><h3 id="cvRiteTitle">' + esc(g?.title || 'The rite') + '</h3>' +
    '<p class="cv-goal">' + esc(goalLine(w.goal, w.target)) + '</p>' + (g ? '<p class="cv-small cv-quiet">' + esc(g.aside) + '</p>' : '') +
    progressBar(s) + chestHTML(s, w, myShare(s)) +
    '<p class="cv-small">' + esc('You have put in ' + myShare(s) + ' this week. It counts as you play, and goes in every few minutes.') + '</p></section>' +
    (s.last && chestsReady(s).some(x => x.week === s.last.no) ? '<section class="cv-last" aria-labelledby="cvLastTitle"><h3 id="cvLastTitle">Last week</h3><p class="cv-small">' +
      esc(s.last.progress + ' of ' + s.last.target + ' for ' + (GOAL_BY_ID[s.last.goal]?.title || 'the rite') + '. Its chests stay open until Sunday.') + '</p>' +
      chestHTML(s, s.last, s.last.members.find(m => m.userId === me())?.counts[s.last.counter] || 0) + '</section>' : '') +
    '<section class="cv-board-peek" aria-labelledby="cvBoardTitle"><h3 id="cvBoardTitle">The notice board</h3>' +
    (boardError ? '<p class="cv-error">' + esc(boardError) + '</p>' : board === null ? loadingState('Reading the fridge.')
      : notes.length ? '<ul class="cv-notes">' + notes.slice(0, 2).map(n => noteHTML(n, s, { actions: false })).join('') + '</ul>' : '<p class="cv-small cv-quiet">' + esc(EMPTY_BOARD) + '</p>') +
    '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="compose">Write a note</button><button class="btn" type="button" data-sx="board">Read the board' + (notes.length ? ' (' + notes.length + ')' : '') + '</button></div></section>' +
    '<section aria-labelledby="cvCupboardTitle"><h3 id="cvCupboardTitle">The coven cupboard</h3><ul class="cv-cupboard">' +
    COVEN_CURIOS.map(k => { const have = st.curios[k.id] > 0; return '<li class="' + (have ? '' : 'missing') + '"><span>' + covenCurioSVG(k.id, { locked: !have }) + '</span><b>' + esc(have ? k.name : 'Not yet') + '</b>' + (have ? '<small>' + esc(k.line) + '</small>' : '') + '</li>'; }).join('') +
    '</ul><p class="cv-small cv-quiet">Cupboard curios come out of the Cauldron, the second chest.</p>' +
    (st.frames.length ? '<h4 class="cv-sub">Sigil frames</h4><ul class="cv-frames">' + ['', ...st.frames].map(f => '<li><button class="cv-frame-pick" type="button" data-sx="frame" data-frame="' + esc(f) + '" aria-pressed="' + (st.frame === f) + '">' +
      sigil(c, { frame: f }) + '<span>' + esc(f ? SIGIL_FRAME_BY_ID[f].name : 'No frame') + '</span></button></li>').join('') + '</ul>' : '<p class="cv-small cv-quiet">Sigil frames come from the Whole Chest.</p>') + '</section>' +
    '<section aria-labelledby="cvTrophyTitle"><h3 id="cvTrophyTitle">Trophy shelf</h3>' + (st.trophies.length ? '<ul class="cv-trophies">' + st.trophies.map(t =>
      '<li>' + trophySVG(t.award) + '<b>' + esc(AWARD_BY_ID[t.award]?.title || 'An award') + '</b><small>' + esc((t.coven ? t.coven + ', ' : '') + 'week of ' + weekLabel(t.week)) + '</small></li>').join('') + '</ul>'
      : '<p class="cv-small cv-quiet">Empty. The Shelfies are every Monday, for the week before. Everybody wins something.</p>') + '</section>' +
    '<section aria-labelledby="cvMembersTitle"><h3 id="cvMembersTitle">Members</h3><ul class="cv-members">' + s.members.map((m, i) => memberRow(s, m, cs[i], founder)).join('') + '</ul>' +
    (founder && s.sent.length ? '<h4 class="cv-sub">Invitations out</h4><ul class="cv-members">' + s.sent.map(x => '<li><span class="cv-dot"></span><div><b>' + esc(x.name || 'A friend') + '</b><small>' + esc('Invited ' + timeAgo(x.createdAt)) + '</small></div>' +
      '<button class="btn btn-sm btn-ghost" type="button" data-sx="uninvite" data-user="' + esc(x.userId) + '">Withdraw</button></li>').join('') + '</ul>' : '') +
    '<div class="fr-actions">' + (founder && s.members.length < MAX_MEMBERS ? '<button class="btn btn-primary" type="button" data-sx="invite-pick">Invite friends</button>' : '') +
    '<button class="btn" type="button" data-sx="coven-recruit">Invite a new player</button>' + (founder ? '<button class="btn" type="button" data-sx="restyle">Change the name or sigil</button>' : '') + '</div></section>' +
    '<section class="cv-leave">' + (confirm === 'leave'
      ? '<div class="fr-confirm" role="group" aria-label="Leave the coven"><p><b>Leave ' + esc(name(c)) + '?</b> ' + esc(lineOf(COVEN_LINES.left, w.no).replace('{coven}', name(c))) +
        (founder && s.members.length > 1 ? ' The candle passes to whoever has been here longest.' : s.members.length === 1 ? ' You are the last one: the coven is dissolved.' : '') + '</p>' +
        '<div class="fr-actions"><button class="btn fr-warn" type="button" data-sx="leave-yes">Leave</button><button class="btn btn-ghost" type="button" data-sx="cancel">Stay</button></div></div>'
      : '<button class="btn btn-ghost fr-warn" type="button" data-sx="leave">Leave the coven</button>') + '</section>';
}
function weekLabel(week) { const d = new Date((week * 7 - 3) * 86400000); return d.getUTCDate() + ' ' + d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }); }
function memberRow(s, m, colour, founder) {
  const self = m.userId === me(), amount = s.week.shares.find(x => x.userId === m.userId)?.amount || 0;
  const frame = SIGIL_FRAME_BY_ID[m.frame];
  const ask = confirm === 'pass:' + m.userId ? ['Pass the candle to ' + (m.name || 'them') + '? They will hold it until they pass it on.', 'pass-yes', 'Pass it']
    : confirm === 'remove:' + m.userId ? ['Remove ' + (m.name || 'them') + ' from the coven? What they did this week still counts.', 'remove-yes', 'Remove'] : null;
  return '<li data-cv-member="' + esc(m.userId) + '"><span class="cv-dot" style="background:' + colour + '"></span><div><b>' + esc(self ? 'You' : m.name || 'A member') + '</b><small>' +
    esc((m.role === 'founder' ? 'Holds the candle. ' : '') + amount + ' this week' + (frame ? '. Wears ' + frame.name : '')) + '</small></div>' +
    (founder && !self && !ask ? '<div class="cv-member-actions"><button class="btn btn-sm btn-ghost" type="button" data-sx="pass" data-user="' + esc(m.userId) + '">Pass the candle</button>' +
      '<button class="btn btn-sm btn-ghost fr-warn" type="button" data-sx="remove" data-user="' + esc(m.userId) + '">Remove</button></div>' : '') +
    (ask ? '<div class="fr-confirm" role="group"><p>' + esc(ask[0]) + '</p><div class="fr-actions"><button class="btn fr-warn" type="button" data-sx="' + ask[1] + '" data-user="' + esc(m.userId) + '">' + ask[2] + '</button><button class="btn btn-ghost" type="button" data-sx="cancel">Cancel</button></div></div>' : '') + '</li>';
}

/* ---------- founding (and restyling) ---------- */
function foundHTML() {
  const d = draft, restyle = d.restyle, sg = cleanSigil(d.sigil);
  const choice = (list, key, art) => '<div class="cv-choices" role="group" aria-label="' + key + '">' + list.map(x =>
    '<button class="cv-choice" type="button" data-sx="pick" data-key="' + key + '" data-value="' + x.id + '" aria-pressed="' + (sg[key] === x.id) + '" title="' + esc(x.name) + '">' + art(x) + '<span class="sr-only">' + esc(x.name) + '</span></button>').join('') + '</div>';
  return (notice ? '<p class="cv-notice" role="status">' + esc(notice) + '</p>' : '') +
    (pendingInvite ? '<p class="cv-small">' + esc('Found a coven first. ' + (pendingInvite.name || 'Your friend') + ' gets the first invitation.') + '</p>' : '') +
    '<div class="cv-found-preview"><span class="cv-found-sigil">' + sigilSVG(sg) + '</span><p class="cv-found-name" aria-live="polite">' + esc(covenName(d.name)) + '</p></div>' +
    '<div class="fr-actions"><button class="btn" type="button" data-sx="reroll">Another name</button><button class="btn" type="button" data-sx="reform">Say it differently</button></div>' +
    '<h4 class="cv-sub">Shape</h4>' + choice(SIGIL_SHAPES, 'shape', x => sigilSVG({ ...sg, shape: x.id })) +
    '<h4 class="cv-sub">Symbol</h4>' + choice(SIGIL_SYMBOLS, 'symbol', x => sigilSVG({ ...sg, symbol: x.id })) +
    '<h4 class="cv-sub">Colour</h4>' + choice(SIGIL_COLOURS, 'colour', x => '<i class="cv-swatch" style="background:' + x.hex + '"></i>') +
    '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="found-yes">' + (restyle ? 'Save the new look' : 'Found the coven') + '</button>' +
    '<button class="btn btn-ghost" type="button" data-sx="' + (restyle ? 'coven-open' : 'home') + '">Cancel</button></div>' +
    (restyle ? '' : '<p class="cv-small cv-quiet">Up to six friends. A weekly rite. A notice board. Everyone wins something on Mondays, whether they like it or not.</p>');
}

/* ---------- inviting friends ---------- */
function pickHTML(ctx) {
  const s = current();
  if (!s?.coven) return loadingState('Finding the guest list.');
  const friends = (ctx.friends?.() || []).filter(f => f && f.userId);
  if (!friends.length) return '<p class="cv-small">' + esc('No friends to invite yet. Add someone by code first, or invite a new player.') + '</p><div class="fr-actions"><button class="btn" type="button" data-sx="coven-recruit">Invite a new player</button></div>';
  return (notice ? '<p class="cv-notice" role="status">' + esc(notice) + '</p>' : '') + '<ul class="cv-members">' + friends.map(f => {
    const why = inviteBlocker(s, f);
    return '<li><span class="cv-dot"></span><div><b>' + esc(f.name || 'A friend') + '</b>' + (why ? '<small>' + esc(why) + '</small>' : '') + '</div>' +
      (why ? '' : '<button class="btn btn-sm btn-primary" type="button" data-sx="invite" data-user="' + esc(f.userId) + '">Invite</button>') + '</li>';
  }).join('') + '</ul><div class="fr-actions"><button class="btn btn-ghost" type="button" data-sx="coven-open">Back to the coven</button></div>';
}
function inviteBlocker(s, friend) {
  if (s.members.some(m => m.userId === friend.userId)) return 'Already in your coven';
  if (s.coven.role !== 'founder') return 'Only the candle holder invites';
  if (s.sent.some(x => x.userId === friend.userId)) return 'Invitation sent';
  if (s.members.length >= MAX_MEMBERS) return 'The coven is full';
  return '';
}

/* ---------- the notice board ---------- */
function boardHTML() {
  const s = current();
  if (!s?.coven) return loadingState('Reading the fridge.');
  const notes = visibleNotes();
  return (notice ? '<p class="cv-notice" role="status">' + esc(notice) + '</p>' : '') +
    '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="compose">Write a note</button><button class="btn btn-ghost" type="button" data-sx="coven-open">Back to the coven</button></div>' +
    (boardError ? '<p class="cv-error">' + esc(boardError) + ' <button class="btn btn-sm" type="button" data-sx="board">Try again</button></p>' : board === null ? loadingState('Reading the fridge.')
      : notes.length ? '<ul class="cv-notes">' + notes.map(n => noteHTML(n, s)).join('') + '</ul>' : '<p class="cv-small cv-quiet">' + esc(EMPTY_BOARD) + '</p>') +
    '<p class="cv-small cv-quiet">The board keeps the last twenty notes. Anyone a note names can take it down, and so can the candle holder.</p>';
}
function composeHTML() {
  return (notice ? '<p class="cv-notice" role="status">' + esc(notice) + '</p>' : '') + composer.html() +
    '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="post"' + (composer.count() ? '' : ' disabled') + '>Pin it to the board</button>' +
    '<button class="btn btn-ghost" type="button" data-sx="board">Back to the board</button></div>';
}
function startComposer(s) {
  const cs = colours(s);
  const names = s.members.filter(m => m.userId !== me()).map(m => ({ id: '@' + m.userId, text: m.name || 'A member', colour: cs[s.members.indexOf(m)] }));
  if (!composer) composer = createMagnets({ id: 'coven-note', names, label: 'Your note for the board', onChange: () => {
    const b = document.querySelector('[data-sx="post"]'); if (b) b.disabled = !composer.count();
  } });
  else composer.setNames(names);
}

/* ---------- the Shelfies ---------- */
function ceremonyHTML() {
  const s = current();
  if (!s?.last || !ceremony) return '<p>No ceremony this week. The audience has gone home.</p>';
  const { script, step } = ceremony, total = script.steps.length;
  const ghosts = Array.from({ length: 7 }, (_, i) => '<span class="cv-ghost" style="--i:' + i + '">' + COURT_PROPS.galleryGhost + '</span>').join('');
  const award = step >= 0 && step < total ? script.steps[step] : null;
  const body = step < 0 ? '<p class="cv-line">' + esc(script.opening) + '</p>'
    : award ? '<p class="cv-line cv-quiet">' + esc(award.envelope) + '</p><div class="cv-envelope" data-cv-award="' + esc(award.award) + '"><span class="cv-trophy-big">' + trophySVG(award.award) + '</span>' +
      '<p class="cv-award-title">' + esc(award.title) + '</p><p class="cv-award-winner">' + esc(award.userId === me() ? 'You' : award.name) + '</p><p class="cv-award-line">' + esc(award.line) + '</p></div>' +
      '<p class="cv-line cv-quiet">' + esc(award.reaction) + '</p>'
    : '<p class="cv-line">' + esc(script.closing) + '</p>' + (script.steps.some(a => a.userId === me()) ? '<p class="cv-small">Your trophy is on the shelf in the coven.</p>' : '');
  return '<div class="cv-stage" aria-hidden="true">' + STAGE_SVG + '<span class="cv-applause' + (award ? ' on' : '') + '">APPLAUSE</span><span class="cv-host">' + castSvg('judge') + '</span><div class="cv-gallery">' + ghosts + '</div></div>' +
    '<div class="cv-ceremony" aria-live="polite"><p class="cv-kicker">' + esc('The Shelfies, week of ' + weekLabel(s.last.no) + (award ? ', award ' + (step + 1) + ' of ' + total : '')) + '</p>' + body + '</div>' +
    '<div class="fr-actions">' + (step < total ? '<button class="btn btn-primary" type="button" data-sx="ceremony-next">' + (step < 0 ? 'Open the first envelope' : step === total - 1 ? 'And finally' : 'Next envelope') + '</button>' +
      '<button class="btn btn-ghost" type="button" data-sx="ceremony-skip">Skip to the end</button>' : '<button class="btn btn-primary" type="button" data-sx="coven-open">Back to the coven</button>') + '</div>';
}
function startCeremony() {
  const s = current();
  if (!s?.last) return false;
  const awards = computeAwards({ week: s.last.no, counter: s.last.counter, members: s.last.members.map(m => ({ ...m, name: m.userId === me() ? 'You' : m.name || 'A member' })) });
  ceremony = { script: ceremonyScript(s.last.no, awards), awards, step: -1 };
  return true;
}
function finishCeremony() {
  const s = current();
  if (!s?.last || !ceremony) return;
  if (recordCeremony(S(), s.last.no, ceremony.awards, me(), name(s.coven))) save();
}

/* ---------- invite rewards ---------- */
function recruitHTML(ctx) {
  const code = ctx?.me?.code || '';
  const r = referrals, st = covenState(S());
  const pair = INVITE_FRAMES.map(id => PORTRAIT_BY_ID[id]?.name).filter(Boolean).join(' and ');
  return (notice ? '<p class="cv-notice" role="status">' + esc(notice) + '</p>' : '') +
    '<section class="cv-recruit"><div class="cv-pair"><span class="pf-sample pf-accomplice-l"></span><span class="pf-sample pf-accomplice-r"></span></div>' +
    '<p>' + esc('Bring in somebody new. When they add you as a friend and play on ' + INVITE_DAYS + ' different days, you both get a matching pair of portrait frames: ' + pair + '.') + '</p>' +
    '<p class="cv-code">' + (code ? esc(formatCode(code)) : '<span class="cv-quiet">Your code appears once Friends has loaded.</span>') + '</p>' +
    '<div class="fr-actions"><button class="btn btn-primary" type="button" data-sx="recruit-share"' + (code ? '' : ' disabled') + '>Share an invitation</button></div>' +
    '<p class="cv-small cv-quiet">The link opens Shelf Life with your code ready. Ten rewards at most, which is a lot of friends.</p></section>' +
    (r === null ? loadingState('Counting your recruits.') : (r.invited.length ? '<section><h3>Brought in so far</h3><ul class="cv-members">' + r.invited.map(x => {
      const ready = x.friends && x.days >= INVITE_DAYS, paid = x.claimed && invitePaid(S(), x.userId, me());
      return '<li><span class="cv-dot"></span><div><b>' + esc(x.name || 'A new player') + '</b><small>' + esc(!x.friends ? 'Not friends yet: they add your code.' : paid ? 'Rewarded.' : Math.min(x.days, INVITE_DAYS) + ' of ' + INVITE_DAYS + ' days played.') + '</small></div>' +
        (ready && !paid ? '<button class="btn btn-sm btn-primary" type="button" data-sx="recruit-claim" data-user="' + esc(x.userId) + '">Collect</button>' : '') + '</li>';
    }).join('') + '</ul><p class="cv-small">' + esc(r.rewarded + ' of 10 rewards collected.') + '</p></section>' : '') +
    (r.invitedBy ? invitedByHTML(r.invitedBy) : r.canRegister ? '<section><h3>Were you invited?</h3><p class="cv-small">Enter the friend code of whoever brought you. You become friends, and after three days of play you both get the frames.</p>' +
      '<form class="fr-form" data-cv-form="referral"><label class="fr-label" for="cvReferral">Their friend code</label><div class="fr-row"><input class="fr-input fr-code-input" id="cvReferral" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD EFGH" value="' + esc(recruitDraft || (st.invite.code ? formatCode(st.invite.code) : '')) + '">' +
      '<button class="btn" type="button" data-sx="recruit-register">That is who</button></div></form></section>' : '')) +
    '<div class="fr-actions"><button class="btn btn-ghost" type="button" data-sx="back-home">Back</button></div>';
}
function invitedByHTML(x) {
  const st = covenState(S()), ready = x.friends && x.days >= INVITE_DAYS, paid = x.claimed && invitePaid(S(), x.userId, me());
  return '<section><h3>Who brought you</h3><ul class="cv-members"><li><span class="cv-dot"></span><div><b>' + esc(x.name || 'Your inviter') + '</b><small>' +
    esc(!x.friends ? 'Waiting for them to accept your friend request.' : paid ? 'Rewarded. The frames are in the Exchange, ready to wear.' : Math.min(x.days, INVITE_DAYS) + ' of ' + INVITE_DAYS + ' days played.') + '</small></div>' +
    (ready && !paid ? '<button class="btn btn-sm btn-primary" type="button" data-sx="recruit-claim" data-user="' + esc(x.userId) + '">Collect</button>' : '') + '</li></ul></section>';
}

/* ---------- painting views into the sheet ---------- */
let lastCtx = null, open = '';
const VIEWS = {
  [VIEW.main]: { kicker: 'Coven', title: () => current()?.coven ? name(current().coven) : 'Coven', html: covenHTML },
  [VIEW.found]: { kicker: 'Coven', title: () => draft?.restyle ? 'A new look' : 'Found a coven', html: foundHTML },
  [VIEW.pick]: { kicker: 'Coven', title: () => 'Invite friends', html: pickHTML },
  [VIEW.board]: { kicker: 'Coven', title: () => 'The notice board', html: boardHTML },
  [VIEW.compose]: { kicker: 'The notice board', title: () => 'Write a note', html: composeHTML },
  [VIEW.ceremony]: { kicker: 'Coven', title: () => 'The Shelfies', html: ceremonyHTML },
  [VIEW.recruit]: { kicker: 'Invite rewards', title: () => 'Invite a new player', html: recruitHTML }
};
function show(ctx, id, focus = null) {
  if (!currentCtx(ctx)) return;
  lastCtx = ctx; open = id;
  const v = VIEWS[id];
  ctx.show({ id, kicker: v.kicker, title: v.title(), html: '<div class="cv-view" data-cv-view="' + id + '">' + v.html(ctx) + '</div>', back: 'main' });
  if (focus) queueMicrotask(() => { if (!currentCtx(ctx)) return; const el = document.querySelector('[data-cv-view] ' + focus); if (el && !el.disabled) el.focus({ preventScroll: true }); });
}
// Repaint whatever is open: one of our views, or the home section through the sheet.
function repaint(focus = null) {
  if (!lastCtx || !currentCtx(lastCtx)) return;
  const viewEl = document.querySelector('[data-cv-view="' + open + '"]');
  if (open && viewEl) show(lastCtx, open, focus);
  else lastCtx.refresh?.();
}
function say(ctx, text) { if (!currentCtx(ctx)) return; notice = text; if (ctx?.say) ctx.say(text); }
function toastOf(ctx, text) { if (currentCtx(ctx)) (ctx?.toast || toast)(text); }

async function busyRun(ctx, work, focus) {
  if (busy || !currentCtx(ctx)) return;
  const user = me(), version = accountVersion;
  busy = true; notice = '';
  try { await work(); }
  catch (error) { if (identity(user, version)) say(ctx, ['save_unavailable', 'reward_legacy'].includes(error.code) ? coopText(error) : covenText(error)); }
  finally { if (identity(user, version)) { busy = false; if (currentCtx(ctx)) repaint(focus); } }
}

/* ---------- opening things ---------- */
async function openCoven(ctx, focus = null) {
  notice = notice || ''; confirm = '';
  show(ctx, VIEW.main, focus);
  try { await owned(ctx, refreshStatus()); } catch { /* shown below */ }
  if (!currentCtx(ctx)) return;
  reportNow({ force: true }).then(ok => { if (ok) refreshStatus({ force: true }).then(() => repaint(), () => {}); });
  loadBoard();
  show(ctx, VIEW.main, focus);
}
function loadBoard() {
  const user = me(), version = accountVersion;
  return coven.board().then(list => {
    if (!identity(user, version)) return [];
    board = list; boardError = '';
    const st = covenState(S()), latest = Math.max(0, ...list.map(n => n.id));
    if (latest > st.seenNote && (open === VIEW.board || open === VIEW.main)) { st.seenNote = latest; save(); }
    repaint();
  }, error => { if (!identity(user, version)) return []; boardError = covenText(error); repaint(); });
}
function openFound(ctx, { restyle = false } = {}) {
  const s = current();
  draft = restyle && s?.coven ? { name: { ...s.coven.name }, sigil: { ...cleanSigil(s.coven.sigil) }, restyle: true } : { name: randomName(), sigil: randomSigil(), restyle: false };
  notice = '';
  show(ctx, VIEW.found, '[data-sx="reroll"]');
}
async function openRecruit(ctx) {
  notice = ''; referrals = null;
  show(ctx, VIEW.recruit);
  try { referrals = await owned(ctx, coven.referrals()); } catch (error) { if (!currentCtx(ctx)) return; notice = covenText(error); referrals = { invitedBy: null, invited: [], rewarded: 0, canRegister: false }; }
  repaint();
}

/* ---------- clicks ---------- */
async function handle(action, el, ctx) {
  if (!currentCtx(ctx)) return;
  lastCtx = ctx;
  const data = el?.dataset || {};
  const s = current();
  switch (action) {
    case 'coven-open': notice = ''; return openCoven(ctx, '[data-sx="compose"]');
    case 'coven-retry': statusError = ''; return refreshStatus({ force: true }).then(() => repaint(), () => repaint());
    case 'coven-found': pendingInvite = null; return openFound(ctx);
    case 'coven-recruit': return openRecruit(ctx);
    case 'home': case 'back-home': draft = null; notice = ''; open = ''; return ctx.back ? ctx.back() : ctx.refresh?.();
    case 'cancel': confirm = ''; return repaint();
    case 'restyle': return openFound(ctx, { restyle: true });
    case 'reroll': draft.name = randomName(); return repaint('[data-sx="reroll"]');
    case 'reform': draft.name = { ...draft.name, form: (draft.name.form + 1) % NAME_FORMS.length }; return repaint('[data-sx="reform"]');
    case 'pick': draft.sigil = { ...draft.sigil, [data.key]: data.value }; return repaint('[data-sx="pick"][data-key="' + data.key + '"][data-value="' + data.value + '"]');
    case 'found-yes': return busyRun(ctx, async () => {
      if (draft.restyle) { await owned(ctx, coven.restyle(draft.name, draft.sigil)); await owned(ctx, refreshStatus({ force: true })); draft = null; notice = 'The coven has a new look. Nobody was consulted.'; open = VIEW.main; show(ctx, VIEW.main); return; }
      await owned(ctx, coven.found(draft.name, draft.sigil));
      const title = covenName(draft.name);
      draft = null;
      await owned(ctx, refreshStatus({ force: true }));
      notice = lineOf(COVEN_LINES.founded, title.length).replace('{coven}', title);
      if (pendingInvite) {
        const f = pendingInvite; pendingInvite = null;
        try { await owned(ctx, coven.invite(f.userId)); await owned(ctx, refreshStatus({ force: true })); notice += ' ' + lineOf(COVEN_LINES.inviteSent).replace('{name}', f.name || 'Your friend'); }
        catch (error) { if (!currentCtx(ctx)) throw error; notice += ' ' + covenText(error); }
      }
      toastOf(ctx, notice);
      board = []; open = VIEW.main;
      show(ctx, VIEW.main);
    }, '[data-sx="compose"]');
    case 'invite-pick': notice = ''; show(ctx, VIEW.pick); return;
    case 'invite': return busyRun(ctx, async () => {
      await owned(ctx, coven.invite(data.user));
      await owned(ctx, refreshStatus({ force: true }));
      const f = (ctx.friends?.() || []).find(x => x.userId === data.user);
      notice = lineOf(COVEN_LINES.inviteSent, Date.now()).replace('{name}', f?.name || 'Your friend');
    }, '[data-sx="coven-open"]');
    case 'uninvite': return busyRun(ctx, async () => { await owned(ctx, coven.cancelInvite(data.user)); await owned(ctx, refreshStatus({ force: true })); notice = 'Invitation withdrawn. The good paper goes back in the drawer.'; }, '[data-sx="invite-pick"]');
    case 'accept': case 'decline': return answerInvite(ctx, data.id || el?.dataset?.sxId, action === 'accept');
    case 'invite-block': confirm = 'block-invite:' + data.id; return repaint('[data-sx="invite-block-yes"]');
    case 'invite-block-yes': return busyRun(ctx, async () => {
      await owned(ctx, social.block(data.user));
      try { await owned(ctx, coven.respond(data.id, false)); } catch (error) { if (!currentCtx(ctx)) throw error; /* blocking already hid it */ }
      confirm = ''; await owned(ctx, refreshStatus({ force: true })); notice = 'Blocked. They will not find you again.';
    });
    case 'invite-report': return busyRun(ctx, async () => {
      const i = s?.invites.find(x => x.id === data.id);
      await owned(ctx, social.report(data.user, 'Coven invitation: ' + (i ? name(i.coven) : 'unknown')));
      notice = 'Reported. Block them too if you would rather not hear from them.';
    });
    case 'claim': return claimChest(ctx, Number(data.week), Number(data.tier));
    case 'frame': {
      const f = data.frame || '';
      if (!wearFrame(S(), f)) return;
      save();
      return busyRun(ctx, async () => { await owned(ctx, coven.setFrame(f)); await owned(ctx, refreshStatus({ force: true })); notice = f ? SIGIL_FRAME_BY_ID[f].name + ' it is. The whole coven will see.' : 'No frame. Austere. Some will say brave.'; }, '[data-sx="frame"][data-frame="' + f + '"]');
    }
    case 'pass': case 'remove': confirm = action + ':' + data.user; return repaint('[data-sx="' + action + '-yes"]');
    case 'pass-yes': return busyRun(ctx, async () => { await owned(ctx, coven.passCandle(data.user)); confirm = ''; await owned(ctx, refreshStatus({ force: true })); notice = 'The candle has been passed. Mind the wax.'; });
    case 'remove-yes': return busyRun(ctx, async () => { await owned(ctx, coven.remove(data.user)); confirm = ''; await owned(ctx, refreshStatus({ force: true })); notice = 'Removed. Their mug stays.'; });
    case 'leave': confirm = 'leave'; return repaint('[data-sx="leave-yes"]');
    case 'leave-yes': return busyRun(ctx, async () => {
      await owned(ctx, reportNow({ force: true }));
      const title = s?.coven ? name(s.coven) : 'the coven';
      await owned(ctx, coven.leave());
      confirm = ''; board = null; composer = null;
      if (setCoven(S(), '', Date.now())) save();
      await owned(ctx, refreshStatus({ force: true }));
      toastOf(ctx, lineOf(COVEN_LINES.left, title.length).replace('{coven}', title));
      open = ''; notice = '';
      ctx.back ? ctx.back() : ctx.refresh?.();
    });
    case 'board': notice = ''; confirm = ''; show(ctx, VIEW.board, '[data-sx="compose"]'); return loadBoard();
    case 'compose': if (!s?.coven) return; notice = ''; startComposer(s); show(ctx, VIEW.compose, '.mg-tray [data-mg="add"]'); return;
    case 'post': return busyRun(ctx, async () => {
      const tiles = composer.tiles();
      if (!tiles.length) return;
      const r = await owned(ctx, coven.post(tiles));
      composer.clear();
      covenState(S()).seenNote = Math.max(covenState(S()).seenNote, r.id); save();
      notice = 'Pinned. Somebody will read it, and then pretend they did not.';
      open = VIEW.board; show(ctx, VIEW.board); await owned(ctx, loadBoard());
    }, '[data-sx="compose"]');
    case 'note-down': return busyRun(ctx, async () => { await owned(ctx, coven.unpost(Number(data.id))); notice = 'Taken down. The magnets go back on the fridge.'; await owned(ctx, loadBoard()); });
    case 'note-hide': if (hideNote(S(), Number(data.id))) save(); notice = 'Hidden from your board. Nobody else is told.'; return repaint('[data-sx="compose"]');
    case 'note-report': confirm = 'report:' + data.id; return repaint('[data-sx="note-report-yes"]');
    case 'note-report-yes': case 'note-block-yes': return busyRun(ctx, async () => {
      const n = (board || []).find(x => x.id === Number(data.id));
      const text = n ? noteText(noteParts(n.tiles, n.names)) : '';
      await owned(ctx, social.report(data.user, ('Notice board: ' + text).slice(0, 200)));
      hideNote(S(), Number(data.id)); save();
      if (action === 'note-block-yes') await owned(ctx, social.block(data.user));
      confirm = '';
      notice = action === 'note-block-yes' ? 'Reported and blocked. Their notes are gone from your board.' : 'Reported. The note is hidden from your board.';
      await owned(ctx, loadBoard());
    }, '[data-sx="compose"]');
    case 'ceremony': if (!startCeremony()) return; show(ctx, VIEW.ceremony, '[data-sx="ceremony-next"]'); return;
    case 'ceremony-next': if (!ceremony) return; ceremony.step++; if (ceremony.step >= ceremony.script.steps.length) finishCeremony(); return show(ctx, VIEW.ceremony, '[data-sx="ceremony-next"], [data-sx="coven-open"]');
    case 'ceremony-skip': if (!ceremony) return; ceremony.step = ceremony.script.steps.length; finishCeremony(); return show(ctx, VIEW.ceremony, '[data-sx="coven-open"]');
    case 'recruit-share': return shareInvite(ctx);
    case 'recruit-register': {
      const input = document.getElementById('cvReferral');
      recruitDraft = input?.value || '';
      return busyRun(ctx, async () => {
        const code = cleanCode(recruitDraft);
        try { await owned(ctx, coven.registerReferral(code)); }
        catch (error) { if (error.code !== 'not_found') throw error; say(ctx, 'Nobody has that code. Check it and try again.'); return; }
        try { await owned(ctx, social.addFriend(code)); } catch (error) { if (error.code !== 'already_friends' && error.code !== 'already_asked') throw error; }
        covenState(S()).invite.code = ''; save(); recruitDraft = '';
        referrals = await owned(ctx, coven.referrals());
        notice = 'Noted, and a friend request is on its way. Play on three different days and you both get the frames.';
      }, '[data-sx="back-home"]');
    }
    case 'recruit-claim': return busyRun(ctx, async () => {
      const owner = me();
      await reconcileRewardWallet(ctx, owner);
      const operation = await owned(ctx, rewardWallet.operationId(owner, 'coven_invite:' + data.user));
      const r = await owned(ctx, coven.claimReferral(data.user));
      if (!r.ok) return;
      const plan = planInvite(S(), data.user, owner);
      if (plan) queueCoopReward(S(), { ...plan, id: operation, owner });
      if (!save() || !Store.persistent) throw new CloudError('The reward could not be saved. Free some device space and try again.', { code: 'save_unavailable' });
      await reconcileRewardWallet(ctx, owner);
      const paid = coopRewardReceipt(S(), owner, operation);
      ctx.renderAll?.();
      referrals = await owned(ctx, coven.referrals());
      notice = !paid ? 'Already collected.' : paid.detail.frames.length ? 'A matching pair of portrait frames. Wear them in the Collector’s Exchange, on any resident’s card.' : '+' + paid.delta + ' souls. You already own the frames.';
      if (paid) { celebrate('chest'); chime('curio'); toastOf(ctx, notice); }
    });
  }
}
async function answerInvite(ctx, inviteId, accept) {
  return busyRun(ctx, async () => {
    const s = current(), i = s?.invites.find(x => x.id === inviteId);
    const r = await owned(ctx, coven.respond(inviteId, accept));
    await owned(ctx, refreshStatus({ force: true }));
    if (accept && r.status === 'joined') {
      const title = i ? name(i.coven) : 'the coven';
      notice = lineOf(COVEN_LINES.joined, title.length).replace('{coven}', title);
      toastOf(ctx, notice);
      board = null; loadBoard();
      open = VIEW.main; show(ctx, VIEW.main);
    } else notice = accept ? 'That invitation has gone.' : 'Declined. They are not told, though they may work it out.';
  });
}
async function claimChest(ctx, week, tier) {
  return busyRun(ctx, async () => {
    const owner = me();
    await owned(ctx, reportNow({ force: true }));
    await reconcileRewardWallet(ctx, owner);
    const operation = await owned(ctx, rewardWallet.operationId(owner, 'coven_chest:' + week + ':' + tier));
    const r = await owned(ctx, coven.claim(week, tier));
    if (!r.ok) return;
    const plan = planChest(S(), week, tier, owner);
    if (plan) queueCoopReward(S(), { ...plan, id: operation, owner });
    if (!save() || !Store.persistent) throw new CloudError('The reward could not be saved. Free some device space and try again.', { code: 'save_unavailable' });
    await reconcileRewardWallet(ctx, owner);
    const paid = coopRewardReceipt(S(), owner, operation);
    await owned(ctx, refreshStatus({ force: true }));
    if (!paid) { notice = 'Already opened on this shelf.'; return; }
    const curio = COVEN_CURIOS.find(item => item.id === paid.detail.curio), frame = SIGIL_FRAME_BY_ID[paid.detail.frame];
    const bits = [paid.delta + ' souls', curio && curio.name + ' for the cupboard', frame && frame.name + ', a sigil frame'].filter(Boolean);
    notice = CHEST_TIERS[tier - 1].name + ': ' + bits.join(', ') + '.';
    toastOf(ctx, notice);
    celebrate('chest'); chime(curio || frame ? 'curio' : 'chest');
    ctx.renderAll?.();
  }, '[data-sx="compose"]');
}
async function shareInvite(ctx) {
  const code = ctx?.me?.code || '';
  if (!code) return;
  const url = PLAY_URL + '?invite=' + code;
  const text = 'Join me on Shelf Life. Add my friend code ' + formatCode(code) + ', play on three different days, and we both get a matching pair of portrait frames.';
  try {
    if (isNative()) await shareText({ title: 'Shelf Life', text, url, dialogTitle: 'Send an invitation' });
    else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') await navigator.share({ title: 'Shelf Life', text, url });
    else { await navigator.clipboard.writeText(text + ' ' + url); say(ctx, 'Copied. Paste it to someone who needs a hobby.'); repaint(); }
  } catch { /* they changed their mind */ }
}

/* ---------- registering with the Friends sheet ---------- */
registerFriendsSection({
  id: 'coven', order: 30, where: 'home',
  render(ctx) { lastCtx = ctx; return homeHTML(); },
  onClick(action, el, ctx) { return handle(action, el, ctx); }
});
for (const id of Object.values(VIEW)) registerSocialView(id, { onClick: (action, el, ctx) => handle(action, el, ctx) });

registerFriendAction({
  id: 'coven-invite', label: 'Invite to your coven', order: 40,
  available(friend) {
    const s = current();
    if (!s || !s.coven) return true;
    return inviteBlocker(s, friend) || true;
  },
  async run(friend, ctx) {
    lastCtx = ctx;
    try { await owned(ctx, refreshStatus()); } catch (error) { say(ctx, ['save_unavailable', 'reward_legacy'].includes(error.code) ? coopText(error) : covenText(error)); return; }
    const s = current();
    if (!s?.coven) { pendingInvite = friend; draft = null; return openFound(ctx); }
    const why = inviteBlocker(s, friend);
    if (why) { say(ctx, why + '.'); return; }
    try {
      await owned(ctx, coven.invite(friend.userId));
      await owned(ctx, refreshStatus({ force: true }));
      const line = lineOf(COVEN_LINES.inviteSent, Date.now()).replace('{name}', friend.name || 'Your friend');
      say(ctx, line); if (currentCtx(ctx)) ctx.refresh?.();
    } catch (error) { say(ctx, ['save_unavailable', 'reward_legacy'].includes(error.code) ? coopText(error) : covenText(error)); }
  }
});

// Postbox: invitations, chests, the Shelfies, new notes and invite rewards.
const at = ms => ms || Date.now();
registerPostboxSource({
  id: 'coven-invites', order: 40, label: 'Coven invitations', poll: true,
  count() { return current()?.invites.length || 0; },
  async load() { const s = await refreshStatus(); return (s?.invites || []).map(i => ({ id: i.id, at: at(i.createdAt), title: 'Invitation to ' + name(i.coven), line: (i.fromName || 'A friend') + ' invites you.' })); },
  render(item) { const i = current()?.invites.find(x => x.id === item.id); return i ? '<ul class="cv-invites">' + inviteRow(i) + '</ul>' : ''; },
  onClick(action, itemId, ctx) { const i = current()?.invites.find(x => x.id === itemId); return handle(action, { dataset: { id: itemId, user: i?.fromUser, sxId: itemId } }, ctx); }
});
registerPostboxSource({
  id: 'coven-chest', order: 41, label: 'Coven chests',
  count() { return chestsReady(current()).length; },
  async load() { const s = await refreshStatus(); return chestsReady(s).map(c => ({ id: c.week + ':' + c.tier, at: Date.now(), title: CHEST_TIERS[c.tier - 1].name + ' is ready', line: lineOf(COVEN_LINES.chestReady, c.tier).replace('{chest}', CHEST_TIERS[c.tier - 1].name) })); },
  render(item) {
    const [week, tier] = item.id.split(':').map(Number), c = CHEST_TIERS[tier - 1];
    return '<div class="cv-mail"><p><b>' + esc(c.name) + '</b> ' + esc(lineOf(COVEN_LINES.chestReady, tier).replace('{chest}', c.name)) + '</p><div class="fr-actions"><button class="btn btn-sm btn-primary" type="button" data-sx="claim" data-sx-id="' + esc(item.id) + '" data-week="' + week + '" data-tier="' + tier + '">Open it</button></div></div>';
  },
  onClick(action, itemId, ctx) { const [week, tier] = String(itemId).split(':').map(Number); return action === 'claim' ? claimChest(ctx, week, tier) : null; }
});
registerPostboxSource({
  id: 'coven-awards', order: 42, label: 'The Shelfies',
  count() { return awardsWaiting(current()) ? 1 : 0; },
  async load() { const s = await refreshStatus(); return awardsWaiting(s) ? [{ id: 'shelfies-' + s.last.no, at: Date.now(), title: 'The Shelfies are on', line: lineOf(COVEN_LINES.awardsReady, s.last.no) }] : []; },
  render(item) { return '<div class="cv-mail"><p><b>The Shelfies are on.</b> ' + esc(item.line) + '</p><div class="fr-actions"><button class="btn btn-sm btn-primary" type="button" data-sx="ceremony" data-sx-id="' + esc(item.id) + '">Watch</button></div></div>'; },
  onClick(action, itemId, ctx) { return handle('ceremony', null, ctx); }
});
registerPostboxSource({
  id: 'coven-notes', order: 43, label: 'The notice board',
  count() { const s = current(); return s?.coven && s.board.latest > covenState(S()).seenNote ? 1 : 0; },
  async load() { const s = await refreshStatus(); return s?.coven && s.board.latest > covenState(S()).seenNote ? [{ id: 'notes-' + s.board.latest, at: Date.now(), title: 'New notes on the board', line: lineOf(COVEN_LINES.newNotes, s.board.latest) }] : []; },
  render(item) { return '<div class="cv-mail"><p><b>' + esc(item.title) + '.</b> ' + esc(item.line) + '</p><div class="fr-actions"><button class="btn btn-sm btn-primary" type="button" data-sx="board" data-sx-id="' + esc(item.id) + '">Read the board</button></div></div>'; },
  onClick(action, itemId, ctx) { return handle('board', null, ctx); }
});
registerPostboxSource({
  id: 'coven-rewards', order: 44, label: 'Invite rewards',
  count() { return readyRewards().length; },
  async load(ctx) { referrals = await owned(ctx, coven.referrals()); return readyRewards().map(x => ({ id: x.userId, at: Date.now(), title: 'Invite reward ready', line: (x.name || 'Your recruit') + ' has played three days.' })); },
  render(item) { return '<div class="cv-mail"><p><b>Invite reward ready.</b> ' + esc(item.line) + '</p><div class="fr-actions"><button class="btn btn-sm btn-primary" type="button" data-sx="recruit-claim" data-sx-id="' + esc(item.id) + '" data-user="' + esc(item.id) + '">Collect</button></div></div>'; },
  onClick(action, itemId, ctx) { return handle('recruit-claim', { dataset: { user: itemId } }, ctx); }
});
function readyRewards() {
  if (!referrals || !coven.active()) return [];
  return [referrals.invitedBy, ...referrals.invited].filter(x => x && x.friends && x.days >= INVITE_DAYS && !(x.claimed && invitePaid(S(), x.userId, me())));
}

/* ---------- the quiet work ---------- */
if (typeof window !== 'undefined') {
  readInviteLink();
  // Store.set in state.js announces every save; that is the moment the counters may have moved.
  let countDays = S().testing?.countDays !== false;
  window.addEventListener('shelflife:storage', () => {
    accountChanged();
    const next = S().testing?.countDays !== false;
    if (next !== countDays) {
      countDays = next;
      cloud.setMeta({ covenDay: undefined });
      if (next) markDay();
    }
    scheduleSync();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reportNow({ force: true }); else wake(); });
  window.addEventListener('online', wake);
  const accountChanged = () => {
    const user = me(), shelf = covenState(S());
    if (accountOwner === user && shelfOwner === shelf) return;
    accountOwner = user; shelfOwner = shelf; accountVersion++;
    status = null; statusAt = 0; statusError = ''; loading = null;
    board = null; boardError = ''; referrals = null; composer = null; ceremony = null;
    draft = null; pendingInvite = null; confirm = ''; notice = ''; busy = false; recruitDraft = '';
    reporting = null; lastReport = 0; lastCtx = null; open = '';
    const membershipChanged = setCoven(S(), '', Date.now());
    if (bindCovenRewards(S(), user) || membershipChanged) save();
  };
  social.subscribe(accountChanged);
  cloud.subscribe(accountChanged);
  window.addEventListener('shelflife:state-replaced', accountChanged);
  setInterval(() => { if (!document.hidden) reportNow(); }, 60000);
  setTimeout(wake, 4000);
}

// For tests: the module's private view of the world.
export const covenDebug = { current, refreshStatus, reportNow, handle, chestsReady, awardsWaiting, rewardWallet, reset() { status = null; board = null; referrals = null; composer = null; ceremony = null; notice = ''; confirm = ''; } };
