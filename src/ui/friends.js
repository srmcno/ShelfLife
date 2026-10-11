// The Friends sheet: one hub in three places.
//   Home       your postbox, requests, the friends list (portraits, level, a dot
//              for mail), your code and name, Do not disturb, and the sections
//              other features register.
//   A friend   their household, cabinet, guestbook, your history together and
//              every registered friend action, with the unavailable ones saying why.
//   Postbox    one list of everything every registered source sent you.
// Visiting a friend's shelf (read only, waves and papers) and serving papers
// live here too. Only built when cloud save is configured; the tray button
// reads "Needs cloud save first" and opens the Cloud save sheet until the
// player is signed in.
//
// Features plug in through src/ui/social-registry.js and never edit this file.
// Everything a friend wrote arrives through the readers in src/cloud/ and is
// printed through esc(). Nothing from the server is ever markup.
import { formatCode, socialText, guestPet } from '../cloud/social.js';
import { emptyState, loadingState } from './fx.js';
import { PLAY_URL } from '../backup.js';
import { isNative, shareText } from '../native.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { RANKS } from '../content/mayhem.js';
import { COURT_CASES } from '../content/court.js';
import { COURT_BY_ID, docketToday, summonsReward } from '../engine/court.js';
import { CURIO_BY_ID } from '../engine/mayhem.js';
import { renderPetSprite } from '../art/sprite.js';
import { curioSVG } from '../art/curios.js';
import { save } from '../state.js';
import { timeAgo } from './cloud.js';
import { toast } from './toast.js';
import { friendActions, friendsSections, postboxSources, postboxCount, socialView, renderSafely, setSocialContext } from './social-registry.js';
import { friendLevel } from '../engine/visits.js';
import { roomLook } from '../cloud/shelf-extras.js';
import { HISTORY_KINDS, DND, WAVE_LINES, POKE_LINES, WAVE_SENT } from '../content/postbox.js';
import { CloudError } from '../cloud/client.js';

// The wrappers in src/cloud/ already word their refusals; anything else is the cloud's fault.
const errorText = error => error instanceof CloudError && error.message ? error.message : socialText(error);

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const MOOD_LINES = { content: 'Content. Suspiciously so.', fine: 'Fine, it says.', annoyed: 'Annoyed at someone.', furious: 'Furious. Do not knock.' };
export const REPORT_REASONS = ['A rude name', 'A rude drawing', 'Bothering me', 'Something else'];
const MISSING_ART = '<svg class="fr-missing" viewBox="0 0 60 60" aria-hidden="true"><path d="M14 52V27a16 16 0 0 1 32 0v25l-5-4-5 4-5-4-5 4-5-4z" fill="currentColor" opacity=".3"/><circle cx="24" cy="27" r="3" fill="currentColor" opacity=".7"/><circle cx="36" cy="27" r="3" fill="currentColor" opacity=".7"/></svg>';
export const HOME_FRIENDS = 12, MAIL_PAGE = 20;

export const friendName = f => f?.name || (f?.code ? 'Code ' + formatCode(f.code) : 'A friend');
export const traitNames = traits => (traits || []).map(t => TRAIT_BY_ID[t]?.name).filter(Boolean).join(', ');
// A friend's resident as an element: its sprite, or a polite blank when its
// drawing was too large to send.
export function guestSprite(resident) {
  const pet = resident?.guest ? resident : guestPet(resident);
  const holder = document.createElement('span');
  if (!pet || pet.artMissing) holder.innerHTML = MISSING_ART;
  else holder.appendChild(renderPetSprite(pet));
  return holder;
}

export const guestPortrait = pet => guestSprite(pet).innerHTML;

// What became of papers we served, as one plain sentence. Callers escape it.
export function verdictLine(r) {
  const title = COURT_BY_ID[r.caseId]?.title || 'a case this edition does not know';
  const judge = r.toName || 'Your friend', p = r.plaintiff.name, d = r.defendant.name;
  const found = r.verdict === 'both' ? judge + ' declared ' + p + ' and ' + d + ' both idiots in ' + title + '.'
    : judge + ' found for ' + (r.verdict === 'plaintiff' ? p : d) + ' in ' + title + '.';
  return found + ' ' + r.stars + (r.stars === 1 ? ' star' : ' stars') + ', ratings ' + r.ratings + '.' + (r.souls ? ' +' + r.souls + ' souls for the news.' : '');
}
// Pays for each verdict once (engine/court.js keeps count) and tells the
// server it has been seen. Friends and the Court both show them this way.
export function collectVerdicts(state, social, results, now = Date.now(), persist = save) {
  const out = results.map(r => ({ ...r, souls: summonsReward(state, r.id, 'verdict', now) }));
  // A reward over the daily cap is written down as owed, not paid, and the server stops sending the
  // verdict once it is seen. So whatever was paid or owed is saved first, whether or not it paid today.
  if (out.length) persist();
  for (const r of results) social.seen(r.id).catch(() => { /* shown again next time, never paid twice */ });
  return out;
}
// A trait's blurb is the closest thing to a line about a friend's resident.
export const residentLine = r => TRAIT_BY_ID[r?.traits?.[0]]?.blurb || 'Keeps itself to itself. Mostly.';

/* ---------------- markup (pure, so it can be checked without a page) ---------------- */
// A friend in the list: the whole row opens their profile.
export function friendRow(f, { confirm = '', level = null, count = 0, mail = false, strip = '' } = {}) {
  const who = esc(friendName(f)), id = esc(f.userId);
  const when = f.shelfAt ? 'Shelf updated ' + timeAgo(f.shelfAt) : 'No shelf on show yet';
  const sub = [level?.name, count ? count + (count === 1 ? ' resident' : ' residents') : '', when].filter(Boolean).join(' · ');
  return '<li class="fr-friend" data-user="' + id + '"><button class="fr-row-open" type="button" data-fr="profile" data-user="' + id + '">' +
    '<span class="fr-who"><b>' + who + (mail ? '<i class="fr-dot" title="Mail from ' + who + '"></i>' : '') + '</b>' + (mail ? '<span class="sr-only">Has sent you something.</span>' : '') +
    '<small>' + esc(sub) + '</small></span><span class="fr-strip" data-fr-strip="' + id + '" aria-hidden="true">' + strip + '</span></button>' +
    (confirm ? confirmBox(confirm, f) : '') + '</li>';
}
export function requestRow(f, { confirm = '' } = {}) {
  const id = esc(f.userId);
  if (f.direction === 'outgoing') {
    return '<li class="fr-friend fr-pending" data-user="' + id + '"><div class="fr-line"><div class="fr-who"><b>' + esc('Code ' + formatCode(f.code)) + '</b><small>Waiting for them to add you back.</small></div>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-fr="withdraw" data-user="' + id + '">Withdraw</button></div></li>';
  }
  return '<li class="fr-friend fr-pending" data-user="' + id + '"><div class="fr-line"><div class="fr-who"><b>' + esc(friendName(f)) + '</b><small>Wants to be friends.</small></div></div>' +
    '<div class="fr-menu"><button class="btn btn-sm btn-primary" type="button" data-fr="accept" data-user="' + id + '">Accept</button><button class="btn btn-sm" type="button" data-fr="decline" data-user="' + id + '">Decline</button>' +
    '<button class="btn btn-sm fr-warn" type="button" data-fr="block" data-user="' + id + '">Block</button><button class="btn btn-sm fr-warn" type="button" data-fr="report" data-user="' + id + '">Report</button></div>' +
    (confirm ? confirmBox(confirm, f) : '') + '</li>';
}
export function confirmBox(kind, f) {
  const who = esc(friendName(f)), id = esc(f.userId);
  const yes = (act, label) => '<div class="fr-actions"><button class="btn fr-warn" type="button" data-fr="' + act + '" data-user="' + id + '">' + label + '</button><button class="btn btn-ghost" type="button" data-fr="cancel">Cancel</button></div>';
  if (kind === 'remove') return '<div class="fr-confirm" role="group" aria-label="Remove ' + who + '"><p><b>Remove ' + who + '?</b> You stop seeing each other’s shelves. Guests go home and waiting mail is withdrawn. Either of you can ask again later.</p>' + yes('remove-yes', 'Remove') + '</div>';
  if (kind === 'block') return '<div class="fr-confirm" role="group" aria-label="Block ' + who + '"><p><b>Block ' + who + '?</b> They are removed, everything between you is torn up, and your code stops working for them. They are not told.</p>' + yes('block-yes', 'Block') + '</div>';
  return '<div class="fr-confirm" role="group" aria-label="Report ' + who + '"><p><b>Report ' + who + '?</b> A person reads every report. They are not told who sent it.</p>' +
    '<fieldset class="fr-reasons"><legend class="sr-only">What is wrong</legend>' + REPORT_REASONS.map((r, i) => '<label><input type="radio" name="frReason" value="' + esc(r) + '"' + (i ? '' : ' checked') + '> ' + esc(r) + '</label>').join('') + '</fieldset>' +
    '<label class="fr-label" for="frReportMore">Anything to add (optional)</label><input class="fr-input" id="frReportMore" maxlength="150" autocomplete="off">' + yes('report-yes', 'Send report') + '</div>';
}
// A resident on a friend's shelf you are visiting: wave, poke or serve papers.
export function residentCard(r, { waves = true } = {}) {
  const name = esc(r.name);
  return '<article class="fr-res" data-res="' + esc(r.id) + '"><span class="fr-res-art" data-res-art="' + esc(r.id) + '"></span><h4>' + name + '</h4>' +
    '<p class="fr-mood">' + esc(MOOD_LINES[r.mood] || MOOD_LINES.fine) + '</p>' + (r.traits.length ? '<p class="fr-traits">' + esc(traitNames(r.traits)) + '</p>' : '') +
    (waves ? '<div class="fr-res-acts"><button class="btn btn-sm" type="button" data-fr="wave" data-res="' + esc(r.id) + '">Wave<span class="sr-only"> at ' + name + '</span></button>' +
      '<button class="btn btn-sm" type="button" data-fr="poke" data-res="' + esc(r.id) + '">Poke<span class="sr-only"> ' + name + '</span></button></div>' : '') +
    '<button class="btn btn-sm" type="button" data-fr="papers" data-res="' + esc(r.id) + '">Serve papers<span class="sr-only"> on ' + name + '</span></button></article>';
}
// The history together, from the server's counts, as one sentence.
export function historyLine(kinds = {}) {
  const parts = HISTORY_KINDS.filter(k => kinds[k.id] > 0).map(k => kinds[k.id] + ' ' + (kinds[k.id] === 1 ? k.one : k.many));
  return parts.length ? parts.join(', ') + '.' : 'Nothing yet. Every friendship starts with a small, regrettable gesture.';
}
export function levelMarkup(level) {
  const pct = Math.round(level.progress * 100);
  return '<div class="fr-level" data-fr-level><div class="fr-level-head"><b>' + esc(level.name) + '</b><small>' +
    (level.next === null ? 'As close as it gets.' : (level.next - level.total) + ' more to ' + esc(level.nextName)) + '</small></div>' +
    '<div class="fr-level-bar" role="progressbar" aria-label="Friendship" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
    '<p>' + esc(level.line) + '</p></div>';
}

/* ---------------- the sheet ---------------- */
export function initFriends({ state, cloud, sync, social, postbox = null, openCloud = () => {}, onRefresh = () => {} }) {
  if (!cloud?.configured || !social) return null;
  const $ = id => document.getElementById(id);
  const veil = $('friendsVeil'), sheet = $('friendsSheet');
  const tray = $('cloudBtn');
  // The tray button only exists when there is a cloud to talk to.
  const button = document.createElement('button');
  button.className = 'btn tray-item fr-tray';
  button.id = 'friendsBtn';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = '<span>Friends <i class="fr-badge" id="friendsBadge" hidden></i></span><small id="friendsBtnSub"></small>';
  tray.after(button);

  let view = 'main', message = '', busy = false, confirm = null;
  let me = { code: '', name: '' }, friends = [], loaded = false, showAll = false;
  let visiting = null, serving = null, profile = null, custom = null, title = ['Friends', ''], drafts = {};
  let mail = new Map(), mailLoading = false, mailLoaded = false, mailShown = MAIL_PAGE, mailSafety = '', strips = new Map(), shelves = new Map();
  let sent = [], sentNext = null, sentLoaded = false, sentLoading = false, sentError = '', sentRetryOlder = false, sentUser = cloud.userId(), sentToken = 0, accountEpoch = 0, justServed = false;
  const sprites = new Map(), buttonStates = new WeakMap();
  let renderedCustom = null, customFocus = null;
  let mailErrors = new Map();
  // Built once: the head stays a direct child of the sheet (it sticks on
  // phones) and the status line stays put, so screen readers hear each change.
  sheet.innerHTML = '<div class="sheet-head"><div><span class="eyebrow" data-fr-kicker></span><h2 data-fr-title tabindex="-1">Friends</h2></div><button class="btn btn-ghost btn-sm" type="button" data-fr="close">Close</button></div>' +
    '<p class="fr-status" role="status" aria-live="polite"></p><div class="fr-body"></div>';
  const body = sheet.querySelector('.fr-body'), status = sheet.querySelector('.fr-status');
  const isOpen = () => veil.classList.contains('open');
  const accepted = () => friends.filter(f => f.status === 'accepted');
  const byId = id => friends.find(f => f.userId === id) || null;
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
  const levelOf = userId => friendLevel(postbox?.state().levels.find(l => l.userId === userId)?.total || 0);

  /* ---- the ctx every registered feature gets ---- */
  function epochCtx() {
    const epoch = accountEpoch, user = cloud.userId();
    const current = () => !!user && epoch === accountEpoch && user === cloud.userId() && social.active();
    const requireCurrent = () => { if (!current()) throw new CloudError('This Friends session has ended.', { code: 'signed_out' }); };
    // A callback may retain its context across awaits. Do not let it use a new
    // account's clients or game state when the original session has ended.
    const bound = client => client && new Proxy(client, { get(target, key) {
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? (...args) => {
        requireCurrent();
        const result = value.apply(target, args);
        return result?.then ? Promise.resolve(result).then(data => { requireCurrent(); return data; }) : result;
      } : value;
    } });
    const local = {
      get state() { requireCurrent(); return state; },
      social: bound(social), cloud: bound(cloud), postbox: bound(postbox),
      get me() { requireCurrent(); return { userId: user, code: me.code, name: me.name }; },
      friends: () => current() ? accepted() : [],
      friend: id => current() ? accepted().find(f => f.userId === id) || null : null,
      show(v) {
        if (!current() || !v?.id) return;
        custom = { back: 'main', ...v }; view = 'custom'; message = v.message || '';
        render(v.focus || '[data-fr="custom-back"]');
      },
      back: () => { if (current()) goBack(custom?.back || 'main'); },
      refresh: () => { if (current()) render(); },
      say(text) { if (current()) { message = String(text || ''); render(); } },
      toast: (...args) => { if (current()) toast(...args); },
      save: () => { if (current()) save(); },
      renderAll: () => { if (current()) onRefresh(); },
      act: (work, focus) => current() ? act(() => work(current), focus) : Promise.resolve(),
      current, isCurrent: current,
      openFriend: userId => { const f = local.friend(userId); if (f) openProfile(f); },
      openPostbox: () => { if (current()) return openPostbox(); },
      close: () => { if (current()) close(); },
      visitShelf: (friend, options) => { if (current()) return visit(friend, options); },
      online,
      level: userId => { requireCurrent(); return levelOf(userId); },
      reloadMail: () => { if (current()) return loadMail(); }
    };
    return local;
  }
  let ctx = epochCtx();
  setSocialContext(ctx);

  // Existing features use ctx.act themselves; simple hooks may return a promise
  // directly. Give both one busy/error boundary without nesting ctx.act calls.
  function runExtension(work) {
    if (busy) return;
    const local = epochCtx();
    if (!local.current()) return;
    if (!online()) { message = 'Go online to use this Friends action.'; render(); return; }
    // Hooks may disable their own submit button immediately. Capture the
    // pre-action state before they do so, rather than locking Retry disabled.
    const buttons = [...body.querySelectorAll('button')];
    buttons.forEach(b => { if (!buttonStates.has(b)) buttonStates.set(b, b.disabled); });
    try {
      const pending = work(local);
      if (pending?.then) {
        if (!busy) return act(() => pending);
        return Promise.resolve(pending).catch(error => { if (local.current()) { message = errorText(error); render(); } });
      }
    } catch (error) { if (local.current()) { message = errorText(error); render(); } }
    finally { if (!busy) buttons.forEach(b => buttonStates.delete(b)); }
  }

  function goBack(where) {
    message = '';
    if (where.startsWith('friend:')) { const f = byId(where.slice(7)); if (f) { openProfile(f, { reload: false }); return; } }
    if (where === 'postbox') { view = 'postbox'; custom = null; render('[data-fr="back"]'); return; }
    view = 'main'; custom = null; visiting = null; profile = null; render('#frAdd');
  }

  /* ---- cases you've sent (unchanged behaviour, now on the home view) ---- */
  function sentMarkup() {
    const rows = sent.map(c => {
      const p = c.plaintiff.name || 'Your resident', d = c.defendant.name || 'Their resident';
      const from = c.side === 'd' ? d : p, against = c.side === 'd' ? p : d;
      const friend = accepted().find(f => f.userId === c.toUser);
      const who = friend ? friendName(friend) : 'A friend';
      const outcome = c.status === 'open' ? 'Waiting for a hearing in Shelf Court.' : c.status === 'declined' ? 'Declined. No verdict was issued.'
        : c.status === 'expired' ? 'Expired after 30 days without a hearing.'
        : (c.verdict === 'both' ? 'Declared both residents idiots.' : 'Found for ' + (c.verdict === 'plaintiff' ? p : d) + '.') +
          ' ' + c.stars + (c.stars === 1 ? ' star' : ' stars') + ', ratings ' + c.ratings + '.';
      return '<li class="fr-sent-case" data-fr-sent-case="' + esc(c.id) + '"><p><b>' + esc(from + ' is suing ' + against) + '</b> over ' +
        esc(COURT_BY_ID[c.caseId]?.title || 'a Shelf Court case') + '.</p><p class="fr-sent-meta">' + esc(who + '’s shelf. Sent ' + timeAgo(c.createdAt) + '.') +
        '</p><p class="fr-sent-outcome" data-status="' + esc(c.status) + '">' + esc(outcome) + '</p></li>';
    }).join('');
    return '<section class="fr-sent" data-fr-sent aria-labelledby="frSentTitle" aria-busy="' + sentLoading + '"><div class="fr-sent-head"><h3 id="frSentTitle">Cases you’ve sent</h3>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-fr="sent-refresh">Refresh</button></div>' +
      (sentError ? '<p class="fr-sent-error" role="status">Could not update your cases. ' + esc(sentError) + ' <button class="btn btn-sm" type="button" data-fr="sent-retry">Try again</button></p>' : '') +
      (rows ? '<ul class="fr-sent-list">' + rows + '</ul>' : sentLoading ? loadingState('Fetching the cases you sent.') : sentLoaded && !sentError ? '<p class="fr-sent-empty">No cases sent yet. Visit a friend’s shelf and choose Serve papers.</p>' : '') +
      (sentNext ? '<div class="fr-actions"><button class="btn" type="button" data-fr="sent-older">Show older cases</button></div>' : '') +
      (sentLoading && rows ? '<p class="hint" role="status">Updating your cases.</p>' : '') + '</section>';
  }
  // Updating only this section leaves players' drafts, caret and form focus alone.
  function renderSent() {
    if (!isOpen() || view !== 'main') return;
    const slot = body.querySelector('[data-fr-sent]');
    if (!slot) return;
    const focused = slot.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const scroll = sheet.scrollTop;
    slot.outerHTML = sentMarkup();
    if (focused) body.querySelector(focused)?.focus({ preventScroll: true });
    sheet.scrollTop = scroll;
  }
  function scopeSent() {
    const user = social.signedIn() ? cloud.userId() : null;
    if (user === sentUser) return false;
    sentUser = user; sentToken++; sent = []; sentNext = null; sentLoaded = sentLoading = false; sentError = ''; justServed = false;
    accountEpoch++; busy = false;
    ctx = epochCtx(); setSocialContext(ctx);
    friends = []; loaded = false; me = { code: '', name: '' }; drafts = {}; message = '';
    mail = new Map(); mailLoaded = false; mailLoading = false; strips = new Map(); shelves = new Map(); sprites.clear(); profile = custom = null; mailErrors = new Map();
    return true;
  }
  async function loadSent({ older = false } = {}) {
    scopeSent();
    if (!social.active() || sentLoading || (older && !sentNext)) return;
    const user = sentUser, token = ++sentToken, cursor = older ? sentNext : null;
    sentLoading = true; sentError = ''; sentRetryOlder = older; renderSent();
    try {
      const page = await social.sentCases({ before: cursor });
      if (user !== cloud.userId() || token !== sentToken) return;
      sent = older ? [...sent, ...page.cases.filter(c => !sent.some(old => old.id === c.id))]
        : page.cases;
      sentNext = page.next;
      sentLoaded = true;
    } catch (error) {
      if (user === cloud.userId() && token === sentToken) sentError = socialText(error);
    } finally {
      if (user === cloud.userId() && token === sentToken) { sentLoading = false; renderSent(); }
    }
  }

  /* ---- the tray badge counts everything in the postbox ---- */
  function syncTray() {
    const signedIn = social.signedIn(), count = signedIn && social.active() ? postboxCount(ctx) : 0;
    $('friendsBtnSub').textContent = !signedIn ? 'Needs cloud save first' : count ? count + ' waiting for you' : 'Shelves, papers and scores';
    const badge = $('friendsBadge');
    badge.hidden = !count;
    badge.textContent = count > 9 ? '9+' : String(count);
    button.setAttribute('aria-label', !signedIn ? 'Friends: needs cloud save first' : count ? 'Friends, ' + count + ' waiting' : 'Friends');
  }

  /* ---- sections and actions from the registry ---- */
  function sectionsMarkup(where, friend = null) {
    return friendsSections(where).map(s => {
      const html = renderSafely(() => s.render(ctx, friend), '<p class="hint">This Friends section is unavailable.</p>');
      return html ? '<section class="fr-section" data-fr-section="' + esc(s.id) + '">' + html + '</section>' : '';
    }).join('');
  }
  function actionsMarkup(friend) {
    const list = friendActions(friend, ctx);
    if (!list.length) return '';
    return '<div class="fr-big-actions" role="group" aria-label="Things to do with ' + esc(friendName(friend)) + '">' + list.map(a => {
      const why = !online() ? 'Go online to use this Friends action.' : typeof a.state === 'string' ? a.state : '';
      const reason = why ? ' aria-describedby="frWhy-' + esc(a.id) + '"' : '';
      return '<div class="fr-big"><button class="btn' + (a.primary ? ' btn-primary' : '') + '" type="button" data-fr-action="' + esc(a.id) + '" data-user="' + esc(friend.userId) + '"' + (why ? ' disabled' : '') + reason + '>' +
        (a.icon ? '<span class="fr-big-icon" aria-hidden="true">' + a.icon + '</span>' : '') + '<span>' + esc(a.label) + '</span></button>' +
        (why ? '<small id="frWhy-' + esc(a.id) + '">' + esc(why) + '</small>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ---- home ---- */
  function mailFrom() {
    const out = new Set();
    for (const items of mail.values()) for (const item of items) if (item.from && item.unread) out.add(item.from);
    return out;
  }
  function stripMarkup(userId) {
    const strip = strips.get(userId);
    if (!strip) return '';
    return strip.residents.map(r => '<span class="fr-mini" data-mini="' + esc(userId + '/' + r.id) + '"></span>').join('');
  }
  function mainMarkup() {
    const incoming = friends.filter(f => f.status === 'pending');
    const list = accepted();
    const share = isNative() || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    const count = postboxCount(ctx), dots = mailFrom(), dnd = !!postbox?.state().dnd;
    const shown = showAll ? list : list.slice(0, HOME_FRIENDS);
    title = ['Friends', 'Seen by friends. Nobody else.'];
    return '<button class="fr-postbox-entry" type="button" data-fr="postbox"><span class="fr-pb-icon" aria-hidden="true">' + POSTBOX_ICON + '</span>' +
      '<span class="fr-pb-text"><b>Postbox</b><small>' + (count ? count + ' waiting for you' : 'Nothing waiting. Suspicious.') + '</small></span>' +
      (count ? '<i class="fr-badge" aria-hidden="true">' + (count > 99 ? '99+' : count) + '</i>' : '') + '</button>' +
      (incoming.length ? '<section aria-labelledby="frRequestsTitle"><h3 id="frRequestsTitle">Requests</h3><ul class="fr-list">' + incoming.map(f => requestRow(f, { confirm: confirm?.userId === f.userId ? confirm.kind : '' })).join('') + '</ul></section>' : '') +
      '<section aria-labelledby="frListTitle"><h3 id="frListTitle">Friends' + (list.length ? ' <small>' + list.length + '</small>' : '') + '</h3>' +
      (list.length ? '<ul class="fr-list">' + shown.map(f => friendRow(f, { confirm: confirm?.userId === f.userId ? confirm.kind : '', level: levelOf(f.userId),
          count: strips.get(f.userId)?.count || 0, mail: dots.has(f.userId), strip: stripMarkup(f.userId) })).join('') + '</ul>' +
          (list.length > shown.length ? '<div class="fr-actions"><button class="btn" type="button" data-fr="show-all">Show all ' + list.length + ' friends</button></div>' : '')
        : loaded ? emptyState({ kind: 'friends', compact: true, line: 'Nobody yet. Swap codes with someone you know.', lineClass: 'fr-empty' }) : loadingState('Knocking on doors.')) + '</section>' +
      '<section class="fr-me" aria-labelledby="frCodeTitle"><h3 id="frCodeTitle">Your friend code</h3>' +
      '<p class="fr-code" data-fr-code>' + (me.code ? esc(formatCode(me.code)) : '<span class="fr-wait">Fetching</span>') + '</p>' +
      '<div class="fr-actions"><button class="btn" type="button" data-fr="copy"' + (me.code ? '' : ' disabled') + '>Copy code</button>' +
      (share ? '<button class="btn" type="button" data-fr="share"' + (me.code ? '' : ' disabled') + '>Share</button>' : '') + '</div>' +
      '<form class="fr-form fr-add" data-fr-form="add"><label class="fr-label" for="frAdd">Add a friend by code</label><div class="fr-row"><input class="fr-input fr-code-input" id="frAdd" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD EFGH" value="' + esc(drafts.frAdd || '') + '"><button class="btn btn-primary" type="submit">Add</button></div></form>' +
      '<form class="fr-form" data-fr-form="name"><label class="fr-label" for="frName">Your name, as friends see it</label><div class="fr-row"><input class="fr-input" id="frName" maxlength="24" autocomplete="nickname" value="' + esc(drafts.frName ?? me.name) + '" placeholder="Leave blank to go by your code"><button class="btn" type="submit">Save name</button></div></form></section>' +
      sectionsMarkup('home') +
      sentMarkup() +
      (postbox ? '<section class="fr-dnd" aria-labelledby="frDndTitle"><div class="fr-dnd-row"><div><h3 id="frDndTitle">' + esc(DND.label) + '</h3><p id="frDndLine">' + esc(dnd ? DND.on : DND.off) + '</p></div>' +
        '<button class="fr-switch" type="button" role="switch" data-fr="dnd" aria-checked="' + dnd + '" aria-labelledby="frDndTitle" aria-describedby="frDndLine"><i></i></button></div></section>' : '') +
      '<p class="hint fr-small">Your name, residents and drawings are shown to accepted friends only. Daily scores reach everyone else as a percentage, never a name.</p>';
  }

  /* ---- a friend's profile ---- */
  function profileMarkup() {
    const f = profile.friend, s = profile.shelf, who = friendName(f);
    title = [who, profile.loading ? 'Knocking' : 'A friend'];
    const level = levelOf(f.userId), kinds = postbox?.state().levels.find(l => l.userId === f.userId)?.kinds || {};
    const facts = s ? [RANKS[s.rank]?.title, s.title ? 'wears “' + s.title + '”' : '', s.curios + (s.curios === 1 ? ' curio' : ' curios'),
      f.shelfAt ? 'updated ' + timeAgo(f.shelfAt) : ''].filter(Boolean).join(' · ') : '';
    const selected = s?.residents.find(r => r.id === profile.resident) || null;
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="back">Back to friends</button></div>' +
      (facts ? '<p class="fr-facts">' + esc(facts) + '</p>' : '') +
      levelMarkup(level) +
      actionsMarkup(f) +
      '<section aria-labelledby="frRosterTitle"><h3 id="frRosterTitle">Their household' + (s ? ' <small>' + s.residents.length + '</small>' : '') + '</h3>' +
      (profile.loading ? loadingState('Counting heads.') : !s || !s.residents.length ? '<p class="fr-empty">Nothing on show yet. Their shelf appears once they open Friends.</p>'
        : '<div class="fr-roster">' + s.residents.map(r => '<button class="fr-portrait" type="button" data-fr="resident" data-res="' + esc(r.id) + '" aria-pressed="' + (r.id === profile.resident) + '">' +
            '<span class="fr-portrait-art" data-res-art="' + esc(r.id) + '"></span><span>' + esc(r.name) + '</span></button>').join('') + '</div>' +
          (selected ? '<article class="fr-res-card" data-fr-res-card="' + esc(selected.id) + '" tabindex="-1"><h4>' + esc(selected.name) + '</h4>' +
            '<p class="fr-mood">' + esc(MOOD_LINES[selected.mood] || MOOD_LINES.fine) + '</p>' + (selected.traits.length ? '<p class="fr-traits">' + esc(traitNames(selected.traits)) + '</p>' : '') +
            '<p class="fr-res-line">' + esc(residentLine(selected)) + '</p></article>' : '')) + '</section>' +
      (s?.highlights?.length ? '<section aria-labelledby="frCabTitle"><h3 id="frCabTitle">From their cabinet</h3><ul class="fr-cabinet">' + s.highlights.map(id =>
        '<li><span class="fr-curio">' + curioSVG(CURIO_BY_ID[id]?.glyph || id) + '</span><span>' + esc(CURIO_BY_ID[id]?.name || '') + '</span></li>').join('') + '</ul></section>' : '') +
      '<section aria-labelledby="frHistoryTitle"><h3 id="frHistoryTitle">Your history together</h3><p class="fr-history">' + esc(historyLine(kinds)) + '</p></section>' +
      sectionsMarkup('friend', f) +
      '<section class="fr-options" aria-labelledby="frOptionsTitle"><h3 id="frOptionsTitle">If it has come to this</h3><div class="fr-menu">' +
      [['remove', 'Remove'], ['block', 'Block'], ['report', 'Report']].map(([act, label]) => '<button class="btn btn-sm' + (act === 'remove' ? '' : ' fr-warn') + '" type="button" data-fr="' + act + '" data-user="' + esc(f.userId) + '">' + label + '</button>').join('') +
      '</div>' + (confirm?.userId === f.userId ? confirmBox(confirm.kind, f) : '') + '</section>';
  }

  /* ---- visiting their shelf ---- */
  function sceneMarkup(s) {
    const look = roomLook(s.decor), slots = s.slots || {};
    // Their own arrangement where the snapshot says; anyone unplaced fills the gaps.
    const cells = new Map(), taken = new Set(Object.values(slots));
    let next = 0;
    for (const r of s.residents) {
      let i = slots[r.id];
      if (!Number.isInteger(i)) { while (taken.has(next)) next++; i = next; taken.add(i); }
      cells.set(i, r);
    }
    const rows = Math.max(1, Math.ceil((Math.max(...cells.keys(), 0) + 1) / 6));
    const style = '--fs-a:' + look.a + ';--fs-b:' + look.b + ';--fs-wood:' + look.wood + ';--fs-lip:' + look.lip + ';--fs-ink:' + look.ink;
    let html = '<div class="fr-scene wall-' + esc(look.wall) + '" style="' + style + '" data-fr-scene>';
    for (let row = 0; row < rows; row++) {
      html += '<div class="fr-scene-row">';
      for (let c = 0; c < 6; c++) {
        const r = cells.get(row * 6 + c);
        html += r ? '<button class="fr-scene-pet" type="button" data-fr="scene-pet" data-res="' + esc(r.id) + '" aria-label="' + esc(r.name) + '"><span data-scene-art="' + esc(r.id) + '"></span><i>' + esc(r.name) + '</i></button>' : '<span class="fr-scene-gap"></span>';
      }
      html += '</div><div class="fr-scene-plank"></div>';
    }
    return html + '</div>';
  }
  function shelfMarkup() {
    const v = visiting, f = v.friend, s = v.shelf;
    const facts = s ? [RANKS[s.rank]?.title, s.curios + (s.curios === 1 ? ' curio' : ' curios'), v.updatedAt ? 'Updated ' + timeAgo(v.updatedAt) : ''].filter(Boolean).join(' · ') : '';
    title = [friendName(f) + '’s shelf', 'Visiting · look, do not touch'];
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="back">Back to ' + esc(v.from === 'profile' ? friendName(f) : 'friends') + '</button>' + (justServed ? '<button class="btn" type="button" data-fr="sent-view">View my cases</button>' : '') + '</div>' +
      (v.loading ? loadingState('Wiping their doormat.')
        : !s || !s.residents.length ? emptyState({ kind: 'friends', compact: true, line: 'Nothing on show yet. Their shelf appears here once they open Friends.', lineClass: 'fr-empty' })
        : '<p class="fr-facts">' + esc(facts) + '</p>' + sceneMarkup(s) + '<p class="hint fr-small">Wave or poke and they hear about it in their postbox. Three a day each, so make them count.</p>' +
          '<div class="fr-shelf">' + s.residents.map(r => residentCard(r, { waves: !!postbox })).join('') + '</div>');
  }
  function serveMarkup() {
    const v = serving, docket = docketToday(state);
    const caseId = COURT_BY_ID[v.caseId] ? v.caseId : docket.caseId;
    title = ['Serve papers', 'Shelf Court'];
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="back-shelf">Back to ' + esc(friendName(v.friend)) + '’s shelf</button></div>' +
      '<div class="fr-serve"><span class="fr-res-art" data-serve-art></span><p>On <b>' + esc(v.resident.name) + '</b>, of ' + esc(friendName(v.friend)) + '’s shelf. They hear it in Shelf Court, and you hear the verdict.</p></div>' +
      '<form class="fr-form" data-fr-form="serve"><label class="fr-label" for="frCase">The case</label><select class="fr-input" id="frCase">' +
      COURT_CASES.map(k => '<option value="' + k.id + '"' + (k.id === caseId ? ' selected' : '') + '>' + esc(k.title) + (k.id === docket.caseId ? ' (today’s docket)' : '') + '</option>').join('') + '</select>' +
      '<label class="fr-label" for="frPlaintiff">Your resident</label><select class="fr-input" id="frPlaintiff">' +
      state.pets.map(p => '<option value="' + esc(p.id) + '"' + (p.id === v.plaintiffId ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' +
      '<label class="fr-label" for="frSide">Takes the side of</label><select class="fr-input" id="frSide"><option value="p"' + (v.side === 'd' ? '' : ' selected') + '>The plaintiff (suing ' + esc(v.resident.name) + ')</option>' +
      '<option value="d"' + (v.side === 'd' ? ' selected' : '') + '>The defendant (being sued by ' + esc(v.resident.name) + ')</option></select>' +
      '<div class="fr-actions"><button class="btn btn-primary" type="submit"' + (state.pets.length ? '' : ' disabled') + '>Serve the papers</button></div></form>';
  }

  /* ---- the postbox ---- */
  function allMail() {
    const out = [];
    for (const source of postboxSources()) for (const item of mail.get(source.id) || []) out.push({ source, item });
    return out.sort((a, b) => (b.item.at || 0) - (a.item.at || 0));
  }
  function mailMarkup() {
    const items = allMail(), shown = items.slice(0, mailShown), read = items.filter(x => x.item.read).length;
    title = ['Postbox', 'Everything friends sent'];
    const rows = shown.map(({ source, item }) => {
      const key = source.id + ':' + item.id, from = item.from ? byId(item.from) : null;
      const inner = source.render ? renderSafely(() => source.render(item, ctx), '') : '';
      const safety = from && mailSafety === key;
      return '<li class="pb-item' + (item.unread ? ' pb-unread' : '') + (item.read ? ' pb-read' : '') + '" data-fr-mail="' + esc(source.id) + '" data-fr-item="' + esc(item.id) + '">' +
        (inner || '<p class="pb-title"><b>' + esc(item.title || source.label || 'Post') + '</b></p>' + (item.line ? '<p class="pb-line">' + esc(item.line) + '</p>' : '')) +
        '<div class="pb-foot"><small>' + (item.at ? esc(timeAgo(item.at)) : '') + (item.fromName || from ? ' · from ' + esc(item.fromName || friendName(from)) : '') + '</small>' +
        (from ? '<button class="btn btn-ghost btn-sm pb-safety" type="button" data-fr="mail-safety" data-key="' + esc(key) + '" aria-expanded="' + safety + '">Block or report<span class="sr-only"> ' + esc(friendName(from)) + '</span></button>' : '') + '</div>' +
        (safety ? '<div class="fr-menu"><button class="btn btn-sm fr-warn" type="button" data-fr="block" data-user="' + esc(from.userId) + '">Block ' + esc(friendName(from)) + '</button><button class="btn btn-sm fr-warn" type="button" data-fr="report" data-user="' + esc(from.userId) + '">Report</button></div>' +
          (confirm?.userId === from.userId ? confirmBox(confirm.kind, from) : '') : '') + '</li>';
    }).join('');
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="back">Back to friends</button>' +
      '<button class="btn" type="button" data-fr="postbox-refresh">Refresh</button>' +
      '<button class="btn" type="button" data-fr="clear-read"' + (read ? '' : ' disabled') + '>Clear read' + (read ? ' (' + read + ')' : '') + '</button></div>' +
      [...mailErrors].map(([id, line]) => '<p class="hint" role="status">Could not load ' + esc(postboxSources().find(s => s.id === id)?.label || id) + '. ' + esc(line) + '</p>').join('') +
      (mailLoading && !items.length ? loadingState('Shaking the postbox.') : !items.length
        ? emptyState({ kind: 'friends', compact: true, line: 'Empty. Not even a bill. Friends’ visitors, treats, waves and papers land here.', lineClass: 'fr-empty' })
        : '<ul class="pb-list" aria-label="Postbox, newest first">' + rows + '</ul>' +
          (items.length > shown.length ? '<div class="fr-actions"><button class="btn" type="button" data-fr="mail-more">Show ' + Math.min(MAIL_PAGE, items.length - shown.length) + ' older</button></div>' : '')) +
      (mailLoading && items.length ? '<p class="hint" role="status">Checking for more.</p>' : '');
  }
  function customMarkup() {
    const v = custom;
    title = [v.title || 'Friends', v.kicker || ''];
    const backLabel = v.back === 'postbox' ? 'Back to the postbox' : v.back?.startsWith('friend:') ? 'Back to ' + friendName(byId(v.back.slice(7))) : 'Back to friends';
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="custom-back">' + esc(backLabel) + '</button></div>' +
      '<div class="fr-custom" data-fr-view="' + esc(v.id) + '">' + (v.html || '') + '</div>';
  }

  // Redraws keep the focus on the same control where it still exists.
  function render(focus = null) {
    if (!isOpen()) { syncTray(); return; }
    const active = document.activeElement, key = focus || (active && body.contains(active) ? focusKey(active) : null);
    const retained = view === 'custom' && custom === renderedCustom;
    if (busy && view === 'custom' && !customFocus && body.contains(active)) customFocus = active;
    if (!retained) body.innerHTML = view === 'shelf' && visiting ? shelfMarkup() : view === 'serve' ? serveMarkup() : view === 'friend' && profile ? profileMarkup()
      : view === 'postbox' ? mailMarkup() : view === 'custom' && custom ? customMarkup() : mainMarkup();
    if (!retained) { renderedCustom = view === 'custom' ? custom : null; customFocus = null; }
    sheet.querySelector('[data-fr-title]').textContent = title[0];
    sheet.querySelector('[data-fr-kicker]').textContent = title[1];
    if (status.textContent !== message) status.textContent = message;
    if (!retained) paintSprites();
    body.querySelectorAll('button').forEach(b => {
      if (busy) { if (!buttonStates.has(b)) buttonStates.set(b, b.disabled); b.disabled = true; }
      else if (buttonStates.has(b)) { b.disabled = buttonStates.get(b); buttonStates.delete(b); }
    });
    const target = !busy && retained && body.contains(customFocus) ? customFocus : key && sheet.querySelector(key);
    if (!busy) customFocus = null;
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (key) sheet.querySelector('h2')?.focus({ preventScroll: true });
    syncTray();
  }
  // Sprites are drawn once per resident and moved into each fresh render.
  function sprite(key, resident) {
    let el = sprites.get(key);
    if (!el) { el = guestSprite(resident); sprites.set(key, el); }
    return el;
  }
  function paintSprites() {
    if (view === 'shelf' && visiting?.shelf) for (const r of visiting.shelf.residents) {
      const k = visiting.friend.userId + '/' + r.id;
      body.querySelector('[data-res-art="' + CSS.escape(r.id) + '"]')?.appendChild(sprite('card:' + k, r));
      body.querySelector('[data-scene-art="' + CSS.escape(r.id) + '"]')?.appendChild(sprite('scene:' + k, r));
    }
    if (view === 'friend' && profile?.shelf) for (const r of profile.shelf.residents) {
      body.querySelector('[data-res-art="' + CSS.escape(r.id) + '"]')?.appendChild(sprite('portrait:' + profile.friend.userId + '/' + r.id, r));
    }
    if (view === 'serve') body.querySelector('[data-serve-art]')?.appendChild(guestSprite(serving.resident));
    if (view === 'main') for (const slot of body.querySelectorAll('[data-mini]')) {
      const [userId, id] = slot.dataset.mini.split('/'), r = strips.get(userId)?.residents.find(x => x.id === id);
      if (r) slot.appendChild(sprite('mini:' + slot.dataset.mini, r));
    }
    // Custom views and postbox rows name residents as <span data-fr-pet="key"> and hand
    // them over as { pets: { key: resident } }; they are drawn fresh each time.
    const pets = view === 'custom' ? custom?.pets : view === 'postbox' ? Object.assign({}, ...allMail().map(x => x.item.pets || {})) : null;
    if (pets) body.querySelectorAll('[data-fr-pet]').forEach(slot => { const r = pets[slot.dataset.frPet]; if (r) slot.appendChild(guestSprite(r)); });
  }
  function focusKey(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.dataset.frAction) return '[data-fr-action="' + CSS.escape(el.dataset.frAction) + '"]';
    if (el.dataset.sx) return '[data-sx="' + CSS.escape(el.dataset.sx) + '"]' + (el.dataset.sxId ? '[data-sx-id="' + CSS.escape(el.dataset.sxId) + '"]' : '');
    if (el.dataset.fr) return '[data-fr="' + el.dataset.fr + '"]' + (el.dataset.user ? '[data-user="' + CSS.escape(el.dataset.user) + '"]' : '') + (el.dataset.res ? '[data-res="' + CSS.escape(el.dataset.res) + '"]' : '') + (el.dataset.key ? '[data-key="' + CSS.escape(el.dataset.key) + '"]' : '');
    return null;
  }

  async function act(work, focus = null) {
    if (busy) return;
    const epoch = accountEpoch, user = cloud.userId();
    const current = () => epoch === accountEpoch && user === cloud.userId();
    busy = true; message = ''; render();
    try { await work(current); }
    catch (error) { if (current()) message = errorText(error); }
    finally { if (current()) { busy = false; render(focus); } }
  }
  async function reload() {
    const epoch = accountEpoch, user = cloud.userId();
    const list = await social.friends();
    if (epoch !== accountEpoch || user !== cloud.userId()) return null;
    friends = list; loaded = true;
    await Promise.all([loadMail({ quiet: true }), loadStrips()]);
    return true;
  }
  async function loadStrips() {
    if (!postbox) return;
    const epoch = accountEpoch;
    try {
      const next = await postbox.strips();
      if (epoch === accountEpoch) strips = next;
    } catch { /* portraits are a nicety */ }
  }
  // Every source, fresh. A source that fails keeps what it had.
  async function loadMail({ quiet = false } = {}) {
    const local = epochCtx();
    mailLoading = true;
    if (!quiet && view === 'postbox') render();
    const sources = postboxSources();
    const results = await Promise.allSettled(sources.map(async source => [source.id, await source.load(local)]));
    if (!local.current()) return;
    results.forEach((r, i) => {
      const id = sources[i].id;
      if (r.status === 'fulfilled' && Array.isArray(r.value[1])) { mail.set(id, r.value[1].filter(item => item && item.id).slice(0, 50)); mailErrors.delete(id); }
      else mailErrors.set(id, errorText(r.status === 'rejected' ? r.reason : new Error('Invalid mail response')));
    });
    mailLoading = false; mailLoaded = true;
    render();
  }

  async function open() {
    if (!social.signedIn()) { openCloud(); return; }
    scopeSent();
    social.optIn();
    view = 'main'; message = ''; confirm = null; visiting = serving = profile = custom = null; showAll = false; mailSafety = '';
    veil.classList.add('open');
    render();
    const epoch = accountEpoch, user = cloud.userId();
    await act(async current => {
      const me_ = await social.profile();
      if (!current()) return;
      me = me_;
      await reload();
      if (!current()) return;
      await loadSent();
    });
    if (epoch !== accountEpoch || user !== cloud.userId()) return;
    // Friends see the shelf as it is now. Quietly: a failure here changes nothing.
    social.publish({ force: true }).catch(() => {});
  }
  function close() { veil.classList.remove('open'); view = 'main'; visiting = serving = profile = custom = null; confirm = null; drafts = {}; mailSafety = ''; syncTray(); }

  async function openPostbox() {
    if (!isOpen()) { await open(); if (!isOpen()) return; }
    view = 'postbox'; custom = null; confirm = null; mailSafety = ''; mailShown = MAIL_PAGE; message = '';
    render('[data-fr="back"]');
    const local = epochCtx();
    await loadMail();
    if (!local.current() || view !== 'postbox') return;
    for (const source of postboxSources()) if (source.seen) Promise.resolve().then(() => { if (local.current()) return source.seen(local); }).then(() => { if (local.current()) syncTray(); }, () => {});
  }
  async function openProfile(friend, { reload: fetch = true } = {}) {
    view = 'friend'; custom = null; confirm = null; message = '';
    profile = { friend, shelf: shelves.get(friend.userId)?.shelf || null, loading: !shelves.has(friend.userId), resident: profile?.friend.userId === friend.userId ? profile.resident : '' };
    render('[data-fr="back"]');
    if (!fetch && shelves.has(friend.userId)) return;
    const epoch = accountEpoch;
    try {
      const r = await social.shelf(friend.userId);
      if (epoch !== accountEpoch) return;
      shelves.set(friend.userId, { shelf: r?.shelf || null, updatedAt: r?.updatedAt || 0 });
      if (profile?.friend.userId === friend.userId) { profile.shelf = r?.shelf || null; profile.loading = false; render(); }
    } catch (error) {
      if (epoch === accountEpoch && profile?.friend.userId === friend.userId) { profile.loading = false; message = socialText(error); render(); }
    }
  }

  async function visit(friend, { serve = false } = {}) {
    const from = view === 'friend' ? 'profile' : 'main';
    const cached = shelves.get(friend.userId);
    view = 'shelf'; visiting = { friend, shelf: cached?.shelf || null, loading: !cached, updatedAt: cached?.updatedAt || 0, from }; confirm = null; message = '';
    render('[data-fr="back"]');
    await act(async current => {
      try {
        const r = await social.shelf(friend.userId);
        if (!current()) return;
        shelves.set(friend.userId, { shelf: r?.shelf || null, updatedAt: r?.updatedAt || 0 });
        visiting = { friend, shelf: r?.shelf || null, loading: false, updatedAt: r?.updatedAt || 0, from };
        if (serve && visiting.shelf?.residents.length) message = 'Choose whom to sue.';
      } catch (error) { if (current() && visiting) visiting.loading = false; throw error; }
    }, serve ? '[data-fr="papers"]' : '[data-fr="back"]');
  }
  function papers(resident) {
    view = 'serve';
    serving = { friend: visiting.friend, resident, caseId: '', plaintiffId: serving?.plaintiffId || state.pets[0]?.id || '', side: serving?.side || 'p' };
    message = '';
    render('#frCase');
  }
  function wave(resident, kind) {
    const friend = visiting?.friend;
    if (!friend || !postbox) return;
    const lines = kind === 'poke' ? POKE_LINES : WAVE_LINES;
    const line = Math.floor(Math.random() * lines.length) + (kind === 'poke' ? 8 : 0);
    act(async current => {
      await postbox.wave({ to: friend.userId, residentId: resident.id, kind, line: line % 16 });
      if (current()) message = WAVE_SENT[kind].replaceAll('{pet}', resident.name);
    }, '[data-fr="' + kind + '"][data-res="' + CSS.escape(resident.id) + '"]');
  }

  sheet.addEventListener('input', e => { if (['frAdd', 'frName'].includes(e.target.id)) drafts[e.target.id] = e.target.value; });
  button.addEventListener('click', open);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  window.addEventListener('shelflife:postbox', () => openPostbox());
  sheet.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target.dataset.frForm;
    if (view === 'custom' && custom && e.target.closest('[data-fr-view]')) {
      const owner = socialView(custom.id);
      if (owner?.onSubmit) runExtension(local => owner.onSubmit(e.target, local));
      return;
    }
    if (form === 'add') {
      const input = $('frAdd');
      act(async current => {
        const r = await social.addFriend(input.value);
        if (!current()) return;
        drafts.frAdd = '';
        await reload();
        if (!current()) return;
        message = r.status !== 'accepted' ? 'Asked. They appear here once they add you back.'
          : (r.name ? 'You and ' + r.name + ' are friends now.' : 'Friends now.') + ' They had already asked.';
      }, '#frAdd');
    } else if (form === 'name') {
      const name = $('frName').value;
      act(async current => { const p = await social.setName(name); if (!current()) return; me = p; drafts.frName = undefined; message = me.name ? 'Friends now see you as ' + me.name + '.' : 'Friends now see your code instead of a name.'; social.publish({ force: true }).catch(() => {}); }, '#frName');
    } else if (form === 'serve') {
      const caseId = $('frCase').value, plaintiff = state.pets.find(p => p.id === $('frPlaintiff').value), side = $('frSide').value === 'd' ? 'd' : 'p';
      serving.caseId = caseId; serving.plaintiffId = plaintiff?.id || ''; serving.side = side;
      act(async current => {
        await social.serve({ to: serving.friend.userId, caseId, plaintiff, defendant: serving.resident, side });
        if (!current()) return;
        const who = friendName(serving.friend);
        view = 'shelf';
        message = 'Papers served. ' + who + ' will find them in Shelf Court.';
        justServed = true;
        // A request started before the papers were served cannot contain them.
        sentToken++; sentLoading = false;
        await loadSent();
      }, '[data-fr="back"]');
    }
  });
  sheet.addEventListener('click', e => {
    const sx = e.target.closest('[data-sx]');
    if (sx && !sx.disabled && body.contains(sx)) { routeSx(sx); return; }
    const action = e.target.closest('[data-fr-action]');
    if (action && !action.disabled) {
      const friend = byId(action.dataset.user), a = friend && friendActions(friend, ctx).find(x => x.id === action.dataset.frAction);
      if (a && a.state === true) runExtension(local => a.run(friend, local));
      return;
    }
    const b = e.target.closest('[data-fr]');
    if (!b || b.disabled) return;
    const act_ = b.dataset.fr, user = b.dataset.user, friend = user ? byId(user) : null;
    switch (act_) {
      case 'close': close(); break;
      case 'copy': copy(); break;
      case 'share': shareCode(); break;
      case 'court': close(); window.dispatchEvent(new CustomEvent('shelflife:court')); break;
      case 'postbox': openPostbox(); break;
      case 'postbox-refresh': loadMail(); break;
      case 'show-all': { showAll = true; const next = accepted()[HOME_FRIENDS]; render(next ? '[data-fr="profile"][data-user="' + CSS.escape(next.userId) + '"]' : null); break; }
      case 'profile': if (friend) openProfile(friend); break;
      case 'resident': if (profile) { profile.resident = profile.resident === b.dataset.res ? '' : b.dataset.res; render('[data-fr="resident"][data-res="' + CSS.escape(b.dataset.res) + '"]'); } break;
      case 'sent-view': view = 'main'; visiting = null; message = ''; render('[data-fr="sent-refresh"]'); break;
      case 'sent-refresh': loadSent(); break;
      case 'sent-retry': loadSent({ older: sentRetryOlder }); break;
      case 'sent-older': loadSent({ older: true }); break;
      case 'back':
        if (view === 'shelf' && visiting?.from === 'profile' && byId(visiting.friend.userId)) { const f = visiting.friend; visiting = null; openProfile(f, { reload: false }); break; }
        view = 'main'; visiting = null; profile = null; message = ''; render('#frAdd'); break;
      case 'back-shelf': view = 'shelf'; message = ''; render('[data-fr="back"]'); break;
      case 'custom-back': goBack(custom?.back || 'main'); break;
      case 'papers': { const r = visiting?.shelf?.residents.find(x => x.id === b.dataset.res); if (r) papers(r); break; }
      case 'scene-pet': body.querySelector('.fr-res[data-res="' + CSS.escape(b.dataset.res) + '"] [data-fr="wave"], .fr-res[data-res="' + CSS.escape(b.dataset.res) + '"] [data-fr="papers"]')?.focus(); break;
      case 'wave': case 'poke': { const r = visiting?.shelf?.residents.find(x => x.id === b.dataset.res); if (r) wave(r, act_); break; }
      case 'mail-safety': mailSafety = mailSafety === b.dataset.key ? '' : b.dataset.key; confirm = null; render('[data-fr="mail-safety"][data-key="' + CSS.escape(b.dataset.key) + '"]'); break;
      case 'mail-more': mailShown += MAIL_PAGE; render('[data-fr="mail-more"]'); break;
      case 'clear-read': act(async current => {
        const local = epochCtx();
        for (const source of postboxSources()) if (source.clear && local.current()) await source.clear(local);
        if (!current()) return;
        await loadMail({ quiet: true });
        if (current()) message = 'Read post cleared. The rest is still glaring at you.';
      }, '[data-fr="back"]'); break;
      case 'dnd': {
        const on = b.getAttribute('aria-checked') !== 'true';
        act(async current => { await postbox.setDnd(on); if (current()) message = on ? 'Do not disturb is on. The doormat now says “Go away”.' : 'Do not disturb is off. The doormat is back to “Welcome”, reluctantly.'; }, '[data-fr="dnd"]');
        break;
      }
      case 'remove': case 'block': case 'report': confirm = { kind: act_, userId: user }; render(act_ === 'report' ? '#frReportMore' : '[data-fr="' + act_ + '-yes"]'); break;
      case 'cancel': confirm = null; render(); break;
      case 'accept': act(async current => { await social.respond(user, true); if (!current()) return; await reload(); if (current()) message = 'Friends now. Their shelf is open to you, and yours to them.'; }, '#frAdd'); break;
      case 'decline': act(async current => { await social.respond(user, false); if (!current()) return; await reload(); if (current()) message = 'Declined. They are not told.'; }, '#frAdd'); break;
      case 'withdraw': act(async current => { await social.remove(user); if (!current()) return; await reload(); if (current()) message = 'Request withdrawn.'; }, '#frAdd'); break;
      case 'remove-yes': act(async current => { await social.remove(user); if (!current()) return; confirm = null; leaveFriend(user); await reload(); if (current()) message = 'Removed.'; }, '#frAdd'); break;
      case 'block-yes': act(async current => { await social.block(user); if (!current()) return; confirm = null; leaveFriend(user); await reload(); if (current()) message = 'Blocked. They will not find you again.'; }, view === 'postbox' ? '[data-fr="back"]' : '#frAdd'); break;
      case 'report-yes': {
        const reason = [sheet.querySelector('input[name="frReason"]:checked')?.value, $('frReportMore')?.value].filter(Boolean).join(': ');
        act(async current => { await social.report(user, reason); if (!current()) return; confirm = null; mailSafety = ''; message = 'Reported. Block them too if you would rather not hear from them.'; }, view === 'postbox' ? '[data-fr="back"]' : '#frAdd');
        break;
      }
    }
  });
  // After a remove or block, nothing of theirs stays on screen.
  function leaveFriend(userId) {
    shelves.delete(userId); strips.delete(userId); mailSafety = '';
    for (const [id, items] of mail) mail.set(id, items.filter(i => i.from !== userId));
    if (profile?.friend.userId === userId || visiting?.friend.userId === userId) { view = 'main'; profile = null; visiting = null; }
  }
  // A [data-sx] button belongs to a postbox row, a section or a custom view.
  function routeSx(el) {
    const action = el.dataset.sx, row = el.closest('[data-fr-mail]'), section = el.closest('[data-fr-section]'), owned = el.closest('[data-fr-view]');
    if (row) {
      const source = postboxSources().find(s => s.id === row.dataset.frMail);
      if (source?.onClick) runExtension(local => source.onClick(action, el.dataset.sxId || row.dataset.frItem, local));
    } else if (section) {
      const s = [...friendsSections('home'), ...friendsSections('friend')].find(x => x.id === section.dataset.frSection);
      if (s?.onClick) runExtension(local => s.onClick(action, el, local, profile?.friend || null));
    } else if (owned && custom) {
      const owner = socialView(custom.id);
      if (owner?.onClick) runExtension(local => owner.onClick(action, el, local));
    }
  }

  async function copy() {
    const text = me.code;
    try { await navigator.clipboard.writeText(text); message = 'Copied. Send it to someone you know.'; }
    catch { message = 'Your code is ' + formatCode(text) + '. Copying was not allowed here.'; }
    render('[data-fr="copy"]');
  }
  async function shareCode() {
    const note = { title: 'Shelf Life', text: 'Add me on Shelf Life. My friend code is ' + formatCode(me.code) + '.', url: PLAY_URL };
    // The app's WebView has no Web Share; the Android share sheet does the same job.
    if (isNative()) { await shareText({ ...note, dialogTitle: 'Send your friend code' }); return; }
    try {
      await navigator.share(note);
    } catch { /* the player changed their mind */ }
  }

  social.subscribe(() => {
    const changed = scopeSent();
    syncTray();
    if (changed && isOpen()) { close(); return; }
    if (isOpen() && view === 'main') loadSent();
  });
  postbox?.subscribe(() => { syncTray(); if (isOpen() && (view === 'main' || view === 'friend')) render(); });
  cloud.subscribe(() => { if (scopeSent() && isOpen()) close(); });
  sync.subscribe(() => { syncTray(); if (isOpen() && !social.signedIn()) close(); });
  syncTray();
  return { open, close, refresh: render, openPostbox, get ctx() { return ctx; } };
}

const POSTBOX_ICON = '<svg viewBox="0 0 40 40"><path d="M9 34V18a11 11 0 0 1 22 0v16Z" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 20h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M20 34v4" stroke="currentColor" stroke-width="2"/><path d="M27 10h7v5h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
