// The Friends sheet: your code, adding by code, requests, the friend list and
// its row menu, a friend's shelf (read only) and serving papers for Shelf
// Court. Only built when cloud save is configured; the tray button reads
// "Needs cloud save first" and opens the Cloud save sheet until the player is
// signed in.
//
// Everything a friend wrote arrives through the readers in src/cloud/social.js
// and is printed through esc(). Nothing from the server is ever markup.
import { formatCode, socialText, guestPet } from '../cloud/social.js';
import { PLAY_URL } from '../backup.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { RANKS } from '../content/mayhem.js';
import { COURT_CASES } from '../content/court.js';
import { COURT_BY_ID, docketToday, summonsReward } from '../engine/court.js';
import { renderPetSprite } from '../art/sprite.js';
import { save } from '../state.js';
import { timeAgo } from './cloud.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const MOOD_LINES = { content: 'Content. Suspiciously so.', fine: 'Fine, it says.', annoyed: 'Annoyed at someone.', furious: 'Furious. Do not knock.' };
export const REPORT_REASONS = ['A rude name', 'A rude drawing', 'Bothering me', 'Something else'];
const MISSING_ART = '<svg class="fr-missing" viewBox="0 0 60 60" aria-hidden="true"><path d="M14 52V27a16 16 0 0 1 32 0v25l-5-4-5 4-5-4-5 4-5-4z" fill="currentColor" opacity=".3"/><circle cx="24" cy="27" r="3" fill="currentColor" opacity=".7"/><circle cx="36" cy="27" r="3" fill="currentColor" opacity=".7"/></svg>';

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
export function collectVerdicts(state, social, results, now = Date.now()) {
  const out = results.map(r => ({ ...r, souls: summonsReward(state, r.id, 'verdict', now) }));
  if (out.some(r => r.souls)) save();
  for (const r of results) social.seen(r.id).catch(() => { /* shown again next time, never paid twice */ });
  return out;
}

/* ---------------- markup (pure, so it can be checked without a page) ---------------- */
export function friendRow(f, { menu = false, confirm = '' } = {}) {
  const who = esc(friendName(f)), id = esc(f.userId);
  const when = f.shelfAt ? 'Shelf updated ' + timeAgo(f.shelfAt) : 'No shelf on show yet';
  const items = [['visit', 'Visit shelf'], ['serve', 'Serve papers'], ['remove', 'Remove'], ['block', 'Block'], ['report', 'Report']];
  return '<li class="fr-friend" data-user="' + id + '"><div class="fr-line"><div class="fr-who"><b>' + who + '</b><small>' + esc(when) + '</small></div>' +
    '<button class="btn btn-ghost btn-sm fr-more" type="button" data-fr="menu" data-user="' + id + '" aria-expanded="' + menu + '" aria-controls="frMenu-' + id + '">Options<span class="sr-only"> for ' + who + '</span></button></div>' +
    '<div class="fr-menu" id="frMenu-' + id + '"' + (menu ? '' : ' hidden') + '>' + items.map(([act, label]) => '<button class="btn btn-sm' + (act === 'block' || act === 'report' ? ' fr-warn' : '') + '" type="button" data-fr="' + act + '" data-user="' + id + '">' + label + '</button>').join('') + '</div>' +
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
function confirmBox(kind, f) {
  const who = esc(friendName(f)), id = esc(f.userId);
  const yes = (act, label) => '<div class="fr-actions"><button class="btn fr-warn" type="button" data-fr="' + act + '" data-user="' + id + '">' + label + '</button><button class="btn btn-ghost" type="button" data-fr="cancel">Cancel</button></div>';
  if (kind === 'remove') return '<div class="fr-confirm" role="group" aria-label="Remove ' + who + '"><p><b>Remove ' + who + '?</b> You stop seeing each other’s shelves. Either of you can ask again later.</p>' + yes('remove-yes', 'Remove') + '</div>';
  if (kind === 'block') return '<div class="fr-confirm" role="group" aria-label="Block ' + who + '"><p><b>Block ' + who + '?</b> They are removed, any papers between you are torn up, and your code stops working for them. They are not told.</p>' + yes('block-yes', 'Block') + '</div>';
  return '<div class="fr-confirm" role="group" aria-label="Report ' + who + '"><p><b>Report ' + who + '?</b> A person reads every report. They are not told who sent it.</p>' +
    '<fieldset class="fr-reasons"><legend class="sr-only">What is wrong</legend>' + REPORT_REASONS.map((r, i) => '<label><input type="radio" name="frReason" value="' + esc(r) + '"' + (i ? '' : ' checked') + '> ' + esc(r) + '</label>').join('') + '</fieldset>' +
    '<label class="fr-label" for="frReportMore">Anything to add (optional)</label><input class="fr-input" id="frReportMore" maxlength="150" autocomplete="off">' + yes('report-yes', 'Send report') + '</div>';
}
export function residentCard(r) {
  return '<article class="fr-res" data-res="' + esc(r.id) + '"><span class="fr-res-art" data-res-art="' + esc(r.id) + '"></span><h4>' + esc(r.name) + '</h4>' +
    '<p class="fr-mood">' + esc(MOOD_LINES[r.mood] || MOOD_LINES.fine) + '</p>' + (r.traits.length ? '<p class="fr-traits">' + esc(traitNames(r.traits)) + '</p>' : '') +
    '<button class="btn btn-sm" type="button" data-fr="papers" data-res="' + esc(r.id) + '">Serve papers<span class="sr-only"> on ' + esc(r.name) + '</span></button></article>';
}

/* ---------------- the sheet ---------------- */
export function initFriends({ state, cloud, sync, social, openCloud = () => {}, onRefresh = () => {} }) {
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

  let view = 'main', message = '', busy = false, menuFor = '', confirm = null;
  let me = { code: '', name: '' }, friends = [], loaded = false, waiting = 0;
  let visiting = null, serving = null, title = ['Friends', ''], drafts = {}, verdicts = [];
  // Built once: the head stays a direct child of the sheet (it sticks on
  // phones) and the status line stays put, so screen readers hear each change.
  sheet.innerHTML = '<div class="sheet-head"><div><span class="eyebrow" data-fr-kicker></span><h2 data-fr-title tabindex="-1">Friends</h2></div><button class="btn btn-ghost btn-sm" type="button" data-fr="close">Close</button></div>' +
    '<p class="fr-status" role="status" aria-live="polite"></p><div class="fr-body"></div>';
  const body = sheet.querySelector('.fr-body'), status = sheet.querySelector('.fr-status');
  const isOpen = () => veil.classList.contains('open');
  const accepted = () => friends.filter(f => f.status === 'accepted');
  const byId = id => friends.find(f => f.userId === id) || null;

  function syncTray() {
    const signedIn = social.signedIn(), count = signedIn ? social.inboxCount() : 0;
    $('friendsBtnSub').textContent = !signedIn ? 'Needs cloud save first' : count ? count + ' waiting for you' : 'Shelves, papers and scores';
    const badge = $('friendsBadge');
    badge.hidden = !count;
    badge.textContent = count > 9 ? '9+' : String(count);
    button.setAttribute('aria-label', !signedIn ? 'Friends: needs cloud save first' : count ? 'Friends, ' + count + ' waiting' : 'Friends');
  }

  function mainMarkup() {
    const incoming = friends.filter(f => f.status === 'pending');
    const list = accepted();
    const share = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    title = ['Friends', 'Seen by friends. Nobody else.'];
    return '<section class="fr-me" aria-labelledby="frCodeTitle"><h3 id="frCodeTitle">Your friend code</h3>' +
      '<p class="fr-code" data-fr-code>' + (me.code ? esc(formatCode(me.code)) : '<span class="fr-wait">Fetching</span>') + '</p>' +
      '<div class="fr-actions"><button class="btn" type="button" data-fr="copy"' + (me.code ? '' : ' disabled') + '>Copy code</button>' +
      (share ? '<button class="btn" type="button" data-fr="share"' + (me.code ? '' : ' disabled') + '>Share</button>' : '') + '</div>' +
      '<form class="fr-form" data-fr-form="name"><label class="fr-label" for="frName">Your name, as friends see it</label><div class="fr-row"><input class="fr-input" id="frName" maxlength="24" autocomplete="nickname" value="' + esc(drafts.frName ?? me.name) + '" placeholder="Leave blank to go by your code"><button class="btn" type="submit">Save name</button></div></form></section>' +
      '<form class="fr-form fr-add" data-fr-form="add"><label class="fr-label" for="frAdd">Add a friend by code</label><div class="fr-row"><input class="fr-input fr-code-input" id="frAdd" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD EFGH" value="' + esc(drafts.frAdd || '') + '"><button class="btn btn-primary" type="submit">Add</button></div></form>' +
      (verdicts.length ? '<section aria-labelledby="frVerdictsTitle"><h3 id="frVerdictsTitle">Verdicts</h3><ul class="fr-verdicts">' + verdicts.map(v => '<li>' + esc(verdictLine(v)) + '</li>').join('') + '</ul></section>' : '') +
      (waiting ? '<p class="fr-inbox"><b>' + waiting + (waiting === 1 ? ' set of papers waits' : ' sets of papers wait') + ' for you in Shelf Court.</b> <button class="btn btn-sm" type="button" data-fr="court">Open Shelf Court</button></p>' : '') +
      (incoming.length ? '<section aria-labelledby="frRequestsTitle"><h3 id="frRequestsTitle">Requests</h3><ul class="fr-list">' + incoming.map(f => requestRow(f, { confirm: confirm?.userId === f.userId ? confirm.kind : '' })).join('') + '</ul></section>' : '') +
      '<section aria-labelledby="frListTitle"><h3 id="frListTitle">Friends' + (list.length ? ' <small>' + list.length + '</small>' : '') + '</h3>' +
      (list.length ? '<ul class="fr-list">' + list.map(f => friendRow(f, { menu: menuFor === f.userId, confirm: confirm?.userId === f.userId ? confirm.kind : '' })).join('') + '</ul>'
        : '<p class="fr-empty">' + (loaded ? 'Nobody yet. Swap codes with someone you know.' : 'Knocking on doors.') + '</p>') + '</section>' +
      '<p class="hint fr-small">Your name, residents and drawings are shown to accepted friends only. Daily scores reach everyone else as a percentage, never a name.</p>';
  }
  function shelfMarkup() {
    const v = visiting, f = v.friend, s = v.shelf;
    const facts = s ? [RANKS[s.rank]?.title, s.curios + (s.curios === 1 ? ' curio' : ' curios'), v.updatedAt ? 'Updated ' + timeAgo(v.updatedAt) : ''].filter(Boolean).join(' · ') : '';
    title = [friendName(f) + '’s shelf', 'Visiting · look, do not touch'];
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="back">Back to friends</button></div>' +
      (v.loading ? '<p class="fr-empty">Wiping their doormat.</p>'
        : !s || !s.residents.length ? '<p class="fr-empty">Nothing on show yet. Their shelf appears here once they open Friends.</p>'
        : '<p class="fr-facts">' + esc(facts) + '</p><div class="fr-shelf">' + s.residents.map(residentCard).join('') + '</div>');
  }
  function serveMarkup() {
    const v = serving, docket = docketToday(state);
    const caseId = COURT_BY_ID[v.caseId] ? v.caseId : docket.caseId;
    title = ['Serve papers', 'Shelf Court'];
    return '<div class="fr-actions fr-back"><button class="btn btn-ghost" type="button" data-fr="back-shelf">Back to ' + esc(friendName(v.friend)) + '’s shelf</button></div>' +
      '<div class="fr-serve"><span class="fr-res-art" data-serve-art></span><p>On <b>' + esc(v.resident.name) + '</b>, of ' + esc(friendName(v.friend)) + '’s shelf. They hear it in Shelf Court, and you hear the verdict.</p></div>' +
      '<form class="fr-form" data-fr-form="serve"><label class="fr-label" for="frCase">The case</label><select class="fr-input" id="frCase">' +
      COURT_CASES.map(k => '<option value="' + k.id + '"' + (k.id === caseId ? ' selected' : '') + '>' + esc(k.title) + (k.id === docket.caseId ? ' (today’s docket)' : '') + '</option>').join('') + '</select>' +
      '<label class="fr-label" for="frPlaintiff">Your plaintiff</label><select class="fr-input" id="frPlaintiff">' +
      state.pets.map(p => '<option value="' + esc(p.id) + '"' + (p.id === v.plaintiffId ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' +
      '<div class="fr-actions"><button class="btn btn-primary" type="submit"' + (state.pets.length ? '' : ' disabled') + '>Serve the papers</button></div></form>';
  }

  // Redraws keep the focus on the same control where it still exists.
  function render(focus = null) {
    if (!isOpen()) { syncTray(); return; }
    const active = document.activeElement, key = focus || (active && body.contains(active) ? focusKey(active) : null);
    body.innerHTML = view === 'shelf' ? shelfMarkup() : view === 'serve' ? serveMarkup() : mainMarkup();
    sheet.querySelector('[data-fr-title]').textContent = title[0];
    sheet.querySelector('[data-fr-kicker]').textContent = title[1];
    if (status.textContent !== message) status.textContent = message;
    if (view === 'shelf' && visiting?.shelf) for (const r of visiting.shelf.residents) body.querySelector('[data-res-art="' + CSS.escape(r.id) + '"]')?.appendChild(guestSprite(r));
    if (view === 'serve') body.querySelector('[data-serve-art]')?.appendChild(guestSprite(serving.resident));
    body.querySelectorAll('button').forEach(b => { if (busy) b.disabled = true; });
    const target = key && sheet.querySelector(key);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (key) sheet.querySelector('h2')?.focus({ preventScroll: true });
    syncTray();
  }
  function focusKey(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.dataset.fr) return '[data-fr="' + el.dataset.fr + '"]' + (el.dataset.user ? '[data-user="' + CSS.escape(el.dataset.user) + '"]' : '') + (el.dataset.res ? '[data-res="' + CSS.escape(el.dataset.res) + '"]' : '');
    return null;
  }

  async function act(work, focus = null) {
    if (busy) return;
    busy = true; message = ''; render();
    try { await work(); }
    catch (error) { message = socialText(error); }
    finally { busy = false; render(focus); }
  }
  async function reload() {
    const [list, box] = await Promise.all([social.friends(), social.inbox()]);
    friends = list; waiting = box.cases.length; loaded = true;
    const fresh = collectVerdicts(state, social, box.results).filter(v => !verdicts.some(x => x.id === v.id));
    if (fresh.length) { verdicts = [...fresh, ...verdicts]; onRefresh(); }
    return box;
  }

  async function open() {
    if (!social.signedIn()) { openCloud(); return; }
    social.optIn();
    view = 'main'; message = ''; menuFor = ''; confirm = null; visiting = serving = null; verdicts = [];
    veil.classList.add('open');
    render();
    await act(async () => {
      me = await social.profile();
      await reload();
    });
    // Friends see the shelf as it is now. Quietly: a failure here changes nothing.
    social.publish({ force: true }).catch(() => {});
  }
  function close() { veil.classList.remove('open'); view = 'main'; visiting = serving = null; menuFor = ''; confirm = null; drafts = {}; syncTray(); }

  async function visit(friend, { serve = false } = {}) {
    view = 'shelf'; visiting = { friend, shelf: null, loading: true, updatedAt: 0 }; menuFor = ''; confirm = null; message = '';
    render('[data-fr="back"]');
    await act(async () => {
      try {
        const r = await social.shelf(friend.userId);
        visiting = { friend, shelf: r?.shelf || null, loading: false, updatedAt: r?.updatedAt || 0 };
        if (serve && visiting.shelf?.residents.length) message = 'Choose whom to sue.';
      } catch (error) { visiting.loading = false; throw error; }
    }, serve ? '[data-fr="papers"]' : '[data-fr="back"]');
  }
  function papers(resident) {
    view = 'serve';
    serving = { friend: visiting.friend, resident, caseId: '', plaintiffId: serving?.plaintiffId || state.pets[0]?.id || '' };
    message = '';
    render('#frCase');
  }

  sheet.addEventListener('input', e => { if (['frAdd', 'frName'].includes(e.target.id)) drafts[e.target.id] = e.target.value; });
  button.addEventListener('click', open);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  sheet.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target.dataset.frForm;
    if (form === 'add') {
      const input = $('frAdd');
      act(async () => {
        const r = await social.addFriend(input.value);
        drafts.frAdd = '';
        await reload();
        message = r.status !== 'accepted' ? 'Asked. They appear here once they add you back.'
          : (r.name ? 'You and ' + r.name + ' are friends now.' : 'Friends now.') + ' They had already asked.';
      }, '#frAdd');
    } else if (form === 'name') {
      const name = $('frName').value;
      act(async () => { me = await social.setName(name); drafts.frName = undefined; message = me.name ? 'Friends now see you as ' + me.name + '.' : 'Friends now see your code instead of a name.'; social.publish({ force: true }).catch(() => {}); }, '#frName');
    } else if (form === 'serve') {
      const caseId = $('frCase').value, plaintiff = state.pets.find(p => p.id === $('frPlaintiff').value);
      serving.caseId = caseId; serving.plaintiffId = plaintiff?.id || '';
      act(async () => {
        await social.serve({ to: serving.friend.userId, caseId, plaintiff, defendant: serving.resident });
        const who = friendName(serving.friend);
        view = 'shelf';
        message = 'Papers served. ' + who + ' will find them in Shelf Court.';
      }, '[data-fr="back"]');
    }
  });
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-fr]');
    if (!b || b.disabled) return;
    const act_ = b.dataset.fr, user = b.dataset.user, friend = user ? byId(user) : null;
    switch (act_) {
      case 'close': close(); break;
      case 'copy': copy(); break;
      case 'share': shareCode(); break;
      case 'court': close(); window.dispatchEvent(new CustomEvent('shelflife:court')); break;
      case 'menu': menuFor = menuFor === user ? '' : user; confirm = null; render(menuFor ? '[data-fr="visit"][data-user="' + CSS.escape(user) + '"]' : null); break;
      case 'visit': if (friend) visit(friend); break;
      case 'serve': if (friend) visit(friend, { serve: true }); break;
      case 'back': view = 'main'; visiting = null; message = ''; render('#frAdd'); break;
      case 'back-shelf': view = 'shelf'; message = ''; render('[data-fr="back"]'); break;
      case 'papers': { const r = visiting?.shelf?.residents.find(x => x.id === b.dataset.res); if (r) papers(r); break; }
      case 'remove': case 'block': case 'report': confirm = { kind: act_, userId: user }; menuFor = ''; render(act_ === 'report' ? '#frReportMore' : '[data-fr="' + act_ + '-yes"]'); break;
      case 'cancel': confirm = null; render(); break;
      case 'accept': act(async () => { await social.respond(user, true); await reload(); message = 'Friends now. Their shelf is open to you, and yours to them.'; }, '#frAdd'); break;
      case 'decline': act(async () => { await social.respond(user, false); await reload(); message = 'Declined. They are not told.'; }, '#frAdd'); break;
      case 'withdraw': act(async () => { await social.remove(user); await reload(); message = 'Request withdrawn.'; }, '#frAdd'); break;
      case 'remove-yes': act(async () => { await social.remove(user); confirm = null; await reload(); message = 'Removed.'; }, '#frAdd'); break;
      case 'block-yes': act(async () => { await social.block(user); confirm = null; await reload(); message = 'Blocked. They will not find you again.'; }, '#frAdd'); break;
      case 'report-yes': {
        const reason = [sheet.querySelector('input[name="frReason"]:checked')?.value, $('frReportMore')?.value].filter(Boolean).join(': ');
        act(async () => { await social.report(user, reason); confirm = null; message = 'Reported. Block them too if you would rather not hear from them.'; }, '#frAdd');
        break;
      }
    }
  });

  async function copy() {
    const text = me.code;
    try { await navigator.clipboard.writeText(text); message = 'Copied. Send it to someone you know.'; }
    catch { message = 'Your code is ' + formatCode(text) + '. Copying was not allowed here.'; }
    render('[data-fr="copy"]');
  }
  async function shareCode() {
    try {
      await navigator.share({ title: 'Shelf Life', text: 'Add me on Shelf Life. My friend code is ' + formatCode(me.code) + '.', url: PLAY_URL });
    } catch { /* the player changed their mind */ }
  }

  social.subscribe(syncTray);
  sync.subscribe(() => { syncTray(); if (isOpen() && !social.signedIn()) close(); });
  syncTray();
  return { open, close, refresh: render };
}
