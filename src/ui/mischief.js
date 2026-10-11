// Mischief on screen: the friend actions (Send a hex, Help out, Knock), their
// views, the postbox rows, the doorstep on the Friends home, the extras on a
// friend's hex in the emergency sheet, and the loop that keeps the shelf and
// the server in step. Everything plugs into Friends through
// ui/social-registry.js; ui/friends.js is never edited.
//
// Selectors other code and tests can rely on: friend actions are
// mischief-hex, mischief-help and mischief-knock; views are mischief-hex,
// mischief-help, mischief-knock and mischief-confirm; the home section is
// mischief-doorstep; postbox sources are mischief-incoming, mischief-news,
// mischief-helps and mischief-doorstep. Buttons inside carry data-sx.
import { registerFriendAction, registerPostboxSource, registerFriendsSection, registerSocialView } from './social-registry.js';
import { coopCode } from '../cloud/coop.js';
import { createMischief, mischiefText, mischiefCode, FINAL } from '../cloud/mischief.js';
import {
  receiveInbox, settleMischief, declineHex, dropFriend, outboxFor, clearOutbox, helped, takeKnock, activeHaunt,
  planShoo, dismissHaunt, hexResultLine, hauntResultLine, doorstepLine, helpLineText, inTray, fromLabel
} from '../engine/mischief.js';
import { HEX_BY_ID, HAUNT_CARD, BOWLS, BOWL_BY_ID, HELP_BUTTONS, HELP_NOTHING_LINES, HELP_NEEDS } from '../content/mischief.js';
import { mischiefState } from '../mischief-state.js';
import { currencyRewardId, queueCoopReward } from '../engine/coop-money.js';
import { mayhemState } from '../mayhem-state.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { renderPetSprite } from '../art/sprite.js';
import { guestPet } from '../cloud/social.js';
import { activeSeason } from '../engine/seasons.js';
import { save, Store } from '../state.js';
import { toast } from './toast.js';
import { initGhost } from './mischief-ghost.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const REPORT_REASONS = ['A rude name', 'A rude drawing', 'Bothering me', 'Something else'];
const NEED_WORDS = { food: 'hungry', fuss: 'ignored', clean: 'grubby' };
const who = f => f?.name || 'Your friend';
const clockTime = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const inThinSeason = (now = Date.now()) => activeSeason(now)?.id === 'thin-season';

/* ---------------- markup (pure, so it can be checked without a page) ---------------- */

const cardHTML = (value, art, name, blurb, checked, extra = '') =>
  '<label class="mx-card' + extra + '"><input type="radio" name="mxCard" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '>' +
  '<span class="mx-card-art" aria-hidden="true">' + glyph(art) + '</span><span class="mx-card-words"><b>' + esc(name) + '</b><small>' + esc(blurb) + '</small></span></label>';

// The hand for one friend: today's three cards, the weekly haunting when it is
// ready, and a culprit from your own shelf.
export function hexViewHTML({ friend, status, pets = [], pick = {} }) {
  if (!status) return '<div class="mx-view"><p class="mx-wait" role="status">Shuffling the deck.</p></div>';
  const rebound = status.rebounds.find(r => r.toUser === friend.userId);
  const canHex = !status.hexedToday || !!rebound, canHaunt = status.hauntReady;
  const name = esc(who(friend));
  if (!pets.length) return '<div class="mx-view"><p class="mx-note">A hex needs a culprit. Make a resident first.</p></div>';
  if (!canHex && !canHaunt) {
    return '<div class="mx-view"><p class="mx-note">One hex a day, and today’s has gone. A fresh hand is dealt tomorrow.</p>' +
      (status.hauntNextAt ? '<p class="mx-note">Your ghosts are resting until ' + esc(new Date(status.hauntNextAt).toLocaleDateString(undefined, { weekday: 'long' })) + '.</p>' : '') + '</div>';
  }
  const first = canHex ? (status.hand.includes(pick.card) ? pick.card : status.hand[0]) : 'haunt';
  const cards = (canHex ? status.hand : []).map(id => cardHTML(id, HEX_BY_ID[id].art, HEX_BY_ID[id].name, HEX_BY_ID[id].blurb, id === first)).join('') +
    (canHaunt ? cardHTML('haunt', HAUNT_CARD.art, HAUNT_CARD.name, HAUNT_CARD.blurb, first === 'haunt' || pick.card === 'haunt', ' mx-card-haunt') : '');
  const culprit = pets.some(p => p.id === pick.culprit) ? pick.culprit : pets[0].id;
  return '<div class="mx-view mx-hex-view" data-mx-friend="' + esc(friend.userId) + '">' +
    '<p class="mx-lede">It lands in ' + name + '’s emergency tray as a real emergency, starring one of your residents. It always pays them souls, never costs them anything, and you hear how it went.</p>' +
    (rebound ? '<p class="mx-rebound">' + glyph('soul') + '<span><b>Rebound ready.</b> Your last hex from ' + name + ' came back on them. This one is free.</span></p>' : '') +
    (!canHex ? '<p class="mx-note">Today’s hex has gone. The haunting is still yours to send.</p>' : '') +
    '<fieldset class="mx-hand"><legend>' + (canHex ? 'Today’s hand' : 'This week') + '</legend>' + cards + '</fieldset>' +
    '<fieldset class="mx-culprits"><legend>The culprit</legend><div class="mx-chips">' +
    pets.slice(0, 18).map(p => '<label class="mx-chip"><input type="radio" name="mxCulprit" value="' + esc(p.id) + '"' + (p.id === culprit ? ' checked' : '') + '><span>' + esc(p.name) + '</span></label>').join('') +
    '</div></fieldset>' +
    '<div class="fr-actions mx-actions"><button class="btn btn-primary" type="button" data-sx="send">' + (rebound ? 'Send it, free' : 'Send it') + '</button></div>' +
    '<p class="mx-small">One hex a day and one haunting a week. A hex waits up to two days. They can always send it back unopened.</p>' +
    '<p class="mx-status" role="status" aria-live="polite"></p></div>';
}

export function helpViewHTML({ friend, residents, status, loading = false, error = '' }) {
  const name = esc(who(friend));
  if (error) return '<div class="mx-view"><p class="mx-note" role="status">' + esc(error) + '</p></div>';
  if (loading || !residents) return '<div class="mx-view"><p class="mx-wait" role="status">Wiping your feet.</p></div>';
  if (status?.helped.includes(friend.userId)) return '<div class="mx-view"><p class="mx-note">You have helped on ' + name + '’s shelf today. Come back tomorrow. They are fine. Probably.</p></div>';
  const known = residents.filter(r => r.needs);
  if (!known.length) return '<div class="mx-view"><p class="mx-note">' + name + '’s shelf has not said how anyone is. It will once they next open the game.</p></div>';
  const needy = known.filter(r => HELP_NEEDS.some(n => r.needs[n] < 50));
  if (!needy.length) return '<div class="mx-view"><p class="mx-note">' + esc(HELP_NOTHING_LINES[known.length % HELP_NOTHING_LINES.length]) + '</p></div>';
  return '<div class="mx-view mx-help-view" data-mx-friend="' + esc(friend.userId) + '">' +
    '<p class="mx-lede">Once a day you can help on ' + name + '’s shelf. They see who did it when they next open the game, and you are paid a few souls for your trouble.</p>' +
    '<ul class="mx-help-list">' + needy.slice(0, 18).map(r => '<li class="mx-help-row"><span class="mx-help-art" data-mx-guest="' + esc(r.id) + '"></span><div class="mx-help-who"><b>' + esc(r.name) + '</b><small>' +
      esc(HELP_NEEDS.filter(n => r.needs[n] < 50).map(n => NEED_WORDS[n]).join(', ')) + '</small></div><div class="mx-help-buttons">' +
      HELP_NEEDS.filter(n => r.needs[n] < 50).map(n => '<button class="btn btn-sm" type="button" data-sx="help" data-mx-res="' + esc(r.id) + '" data-mx-need="' + n + '">' + HELP_BUTTONS[n] + '<span class="sr-only"> ' + esc(r.name) + '</span></button>').join('') +
      '</div></li>').join('') + '</ul><p class="mx-status" role="status" aria-live="polite"></p></div>';
}

const DOOR = '<svg class="mx-door-art" viewBox="0 0 120 150" aria-hidden="true"><path d="M20 146V40a40 40 0 0 1 80 0v106z" fill="#2A1830" stroke="#7A4C5B" stroke-width="4"/>' +
  '<path d="M34 146V48a26 26 0 0 1 52 0v98" fill="#3A2440"/><circle cx="76" cy="98" r="4" fill="#F2C083"/><path d="M52 66h16v12H52z" fill="#F2B441" opacity=".7"/>' +
  '<path d="M8 146h104" stroke="#5C3A47" stroke-width="6" stroke-linecap="round"/><path d="M92 128c6-10 18-10 22 0z" fill="#E07B2E"/><path d="M103 122v-5" stroke="#7FD8C0" stroke-width="3"/></svg>';
export function knockViewHTML({ friend, status, result = null, season = true }) {
  const name = esc(who(friend));
  if (!season) return '<div class="mx-view"><p class="mx-note">Knocking is for the Thin Season only. The street is closed until the fifteenth of October.</p></div>';
  if (result) {
    return '<div class="mx-view mx-knock-view"><div class="mx-door mx-door-' + esc(result.kind) + '">' + DOOR + '</div>' +
      '<p class="mx-knock-result"><b>' + (result.kind === 'trick' ? 'Trick.' : 'Treat.') + '</b> ' + esc(result.line.replace(/^(Trick|Treat|A treat)[.,]?\s*/, '')) + '</p>' +
      (result.souls ? '<p class="mx-paid">' + glyph('soul') + '+' + result.souls + ' souls</p>' : '') +
      (result.curio ? '<p class="mx-paid">' + glyph(result.curio.curio.glyph) + esc(result.curio.curio.name) + (result.curio.duplicate ? ' (a duplicate, +' + result.curio.refund + ' souls)' : '') + '</p>' : '') +
      (result.bowl ? '<p class="mx-small">They left out: ' + esc(BOWL_BY_ID[result.bowl]?.name || 'nothing') + '.</p>' : '') + '</div>';
  }
  if (!status) return '<div class="mx-view"><p class="mx-wait" role="status">Finding the right door.</p></div>';
  if (status.knocked.includes(friend.userId)) return '<div class="mx-view mx-knock-view"><div class="mx-door">' + DOOR + '</div><p class="mx-note">You have knocked on ' + name + '’s door tonight. Twice is a siege. Try again tomorrow night.</p></div>';
  return '<div class="mx-view mx-knock-view" data-mx-friend="' + esc(friend.userId) + '"><div class="mx-door">' + DOOR + '</div>' +
    '<p class="mx-lede">Once a night, knock on ' + name + '’s door. The street decides: a treat for you, or a trick that follows you home. What they leave in their bowl changes the odds.</p>' +
    '<div class="fr-actions mx-actions"><button class="btn btn-primary" type="button" data-sx="knock">Knock on ' + name + '’s door</button></div>' +
    '<p class="mx-status" role="status" aria-live="polite"></p></div>';
}

export function doorstepHTML({ doorstep, season = true, now = Date.now() }) {
  if (!season) return '';
  const d = doorstep || { bowl: 'none', count: 0, knocks: [] };
  const names = d.knocks.slice(0, 6).map(k => '<li>' + esc(k.fromName || 'A friend') + ' <small>' + (k.result === 'treat' ? 'got a treat' : 'got a trick') + '</small></li>').join('');
  return '<section class="mx-doorstep" aria-labelledby="mxDoorTitle"><h3 id="mxDoorTitle">Your doorstep <small>The Thin Season</small></h3>' +
    '<p class="mx-door-line">' + esc(doorstepLine(d.count, new Date(now).toDateString())) + '</p>' + (names ? '<ul class="mx-knockers">' + names + '</ul>' : '') +
    '<fieldset class="mx-bowls"><legend>What you leave out</legend>' + BOWLS.map(b => '<label class="mx-bowl"><input type="radio" name="mxBowl" value="' + b.id + '"' + (b.id === d.bowl ? ' checked' : '') + '>' +
      '<span><b>' + esc(b.name) + '</b><small>' + esc(b.line) + '</small></span></label>').join('') + '</fieldset>' +
    '<div class="fr-actions mx-actions"><button class="btn" type="button" data-sx="bowl">Leave it out</button></div><p class="mx-status" role="status" aria-live="polite"></p></section>';
}

// One postbox row. Buttons carry data-sx and data-sx-id, as the registry asks.
export function rowHTML(item) {
  const id = esc(item.id), b = (act, label, warn = false) => '<button class="btn btn-sm' + (warn ? ' fr-warn' : '') + '" type="button" data-sx="' + act + '" data-sx-id="' + id + '">' + label + '</button>';
  const buttons = {
    hex: [b('play', 'Deal with it'), b('decline', 'Return to sender'), b('block', 'Block', true), b('report', 'Report', true)],
    haunt: [b('find', 'Find it'), b('block', 'Block', true), b('report', 'Report', true)],
    result: [b('seen', 'Got it')],
    rebound: [b('rebound', 'Send one back')],
    help: [b('block', 'Block', true), b('report', 'Report', true)],
    knock: [b('block', 'Block', true), b('report', 'Report', true)]
  }[item.kind] || [];
  // The Postbox owns the surrounding list item. A nested <li> would make the
  // browser move our buttons outside that item and lose the delegated route.
  return '<div class="mx-row mx-row-' + esc(item.kind) + '" data-mx-item="' + id + '"><p><b>' + esc(item.title) + '</b> ' + esc(item.line) + '</p>' +
    (buttons.length ? '<div class="fr-menu">' + buttons.join('') + '</div>' : '') + '</div>';
}

function confirmHTML(kind, friend) {
  const name = esc(who(friend));
  if (kind === 'block') {
    return '<div class="mx-view fr-confirm"><p><b>Block ' + name + '?</b> Their hexes, ghosts and helps leave your shelf, they are removed as a friend, and they cannot reach you again. They are not told.</p>' +
      '<div class="fr-actions"><button class="btn fr-warn" type="button" data-sx="block-yes">Block</button><button class="btn btn-ghost" type="button" data-sx="cancel">Cancel</button></div><p class="mx-status" role="status" aria-live="polite"></p></div>';
  }
  return '<div class="mx-view fr-confirm"><p><b>Report ' + name + '?</b> A person reads every report. They are not told who sent it.</p>' +
    '<fieldset class="fr-reasons"><legend class="sr-only">What is wrong</legend>' + REPORT_REASONS.map((r, i) => '<label><input type="radio" name="mxReason" value="' + esc(r) + '"' + (i ? '' : ' checked') + '> ' + esc(r) + '</label>').join('') + '</fieldset>' +
    '<div class="fr-actions"><button class="btn fr-warn" type="button" data-sx="report-yes">Send report</button><button class="btn btn-ghost" type="button" data-sx="cancel">Cancel</button></div><p class="mx-status" role="status" aria-live="polite"></p></div>';
}

function hexBarHTML(ext) {
  const name = esc(who(ext.from));
  return '<div class="mx-hexbar" data-mx-ref="' + esc(ext.ref) + '" data-mx-user="' + esc(ext.from?.userId || '') + '">' +
    '<button class="btn btn-sm" type="button" data-mx="decline">Return to sender</button>' +
    (ext.from?.userId ? '<button class="btn btn-sm fr-warn" type="button" data-mx="block">Block ' + name + '</button><button class="btn btn-sm fr-warn" type="button" data-mx="report">Report</button>' : '') + '</div>';
}

/* ---------------- the controller ---------------- */

export function initMischief({ state, cloud, social, refresh = () => {} }) {
  if (!cloud?.configured || !social) return null;
  const mx = createMischief({ cloud, social });
  const ghost = initGhost({ state, shoo: finishShoo, onShoo: () => { refresh(); sync(); } });
  let syncing = null, view = null, viewToken = 0;
  const now = () => Date.now();
  const repaint = () => { refresh(); ghost.render(); };
  const current = (user, ctx, domain) => !!user && mx.userId() === user && mx.active() && ctx?.isCurrent?.() !== false
    && (!domain || state.mischief === domain);

  async function finishShoo(taps) {
    const owner = mx.userId(), domain = mischiefState(state), h = activeHaunt(state), purse = state.coop;
    if (!h || !current(owner, null, domain)) return null;
    const id = await currencyRewardId(owner, 'mischief_shoo:' + h.ref);
    if (!current(owner, null, domain) || state.coop !== purse || activeHaunt(state) !== h) return null;
    const plan = planShoo(state, taps, owner);
    const before = structuredClone(domain);
    const alreadyPending = state.coop?.money?.pending?.some(op => op.owner === owner && op.id === id);
    if (plan) queueCoopReward(state, { ...plan, owner, id });
    const result = dismissHaunt(state, taps);
    if (!result) return null;
    if (!save() || !Store.persistent) {
      Object.keys(domain).forEach(key => delete domain[key]); Object.assign(domain, before);
      if (!alreadyPending) state.coop.money.pending = state.coop.money.pending.filter(op => op.owner !== owner || op.id !== id);
      throw new Error('Could not save the shoo. Free some device space and try again.');
    }
    return { ...result, pending: !!plan?.detail.paid };
  }

  /* ---- keeping the shelf and the server in step ---- */
  async function flush() {
    const uid = mx.userId(), domain = state.mischief;
    if (!uid || !mx.active()) return;
    const items = outboxFor(state, uid);
    const acks = items.filter(o => o.op === 'ack');
    if (acks.length) {
      try { await mx.ackHelps(acks.map(o => o.ref)); if (!current(uid, null, domain)) return; clearOutbox(state, acks); }
      catch (error) { if (!current(uid, null, domain)) return; if (FINAL.has(mischiefCode(error))) clearOutbox(state, acks); else return; }
    }
    for (const item of items.filter(o => o.op !== 'ack')) {
      if (!current(uid, null, domain)) return;
      try {
        if (item.op === 'resolve') await mx.resolveHex(item.ref, item);
        else if (item.op === 'decline') await mx.declineHex(item.ref);
        else if (item.op === 'shoo') await mx.shoo(item.ref, item.taps);
        else if (item.op === 'seen') await mx.seen(item.kind, item.ref);
        if (!current(uid, null, domain)) return;
        clearOutbox(state, [item]);
      } catch (error) {
        if (!current(uid, null, domain)) return;
        if (FINAL.has(mischiefCode(error))) clearOutbox(state, [item]);
        else return;
      }
    }
  }
  function announce(news, added) {
    for (const h of news.hexes) toast('A hex has arrived ' + fromLabel(h) + ': ' + (HEX_BY_ID[h.card]?.name || 'something unpleasant') + '. ' + (added.some(e => e.ext.ref === h.ref) ? 'It is in your emergency tray.' : 'It will take the next free place in your emergency tray.'));
    if (news.haunt) toast('Something ' + fromLabel(news.haunt) + ' is haunting yours. Look at the shelf.');
    for (const h of news.helps) toast(helpLineText(h));
  }
  function sync() {
    if (!mx.active()) return Promise.resolve(null);
    const user = mx.userId();
    const domain = state.mischief;
    if (syncing?.user === user && syncing.domain === domain) return syncing.promise;
    const request = { user, domain };
    request.promise = (async () => {
      await flush();
      if (!current(user, null, domain)) return null;
      const box = await mx.inbox();
      if (!box || !current(user, null, domain)) return null;
      const news = receiveInbox(state, box, user, now());
      const added = settleMischief(state, now());
      await flush();
      if (!current(user, null, domain)) return null;
      if (!save()) return null;
      if ((state.coop?.money?.pending || []).some(op => op.owner === user && op.detail?.reward === 'mischief_shoo')) {
        const purse = state.coop;
        try { await (await import('./coop.js')).reconcileCoopWallet(user); }
        catch (error) {
          if (current(user, null, domain)) {
            const code = coopCode(error);
            toast(code === 'save_unavailable' ? 'The ghost reward is saved. Free some device storage before collecting it.'
              : ['cloud_copy_required', 'household_sync_required'].includes(code) ? 'The ghost reward is saved. Open Cloud save to choose your matching household or finish syncing.'
              : code === 'reward_legacy' ? 'The saved ghost reward needs recovery before it can be collected.'
              : 'The ghost reward is saved and waiting for a connection.');
          }
        }
        if (!current(user, null, domain) || state.coop !== purse) return null;
      }
      announce(news, added);
      repaint();
      return box;
    })().catch(() => null).finally(() => { if (syncing === request) syncing = null; });
    syncing = request;
    return request.promise;
  }
  // A place in the tray opened up, or a hex expired: no network needed.
  function settle() {
    const added = settleMischief(state, now());
    if (added.length) {
      save();
      for (const e of added) toast('A hex ' + fromLabel(e.ext) + ' has taken its place in your emergency tray.');
      refresh();
    }
    ghost.render();
  }

  /* ---- the views ---- */
  const friendOf = (ctx, userId) => { try { return ctx.friend(userId); } catch { return null; } };
  function show(ctx, v) {
    if (ctx?.isCurrent?.() === false) return null;
    view = { id: v.id, friend: v.friend?.userId || '', token: ++viewToken };
    try { ctx.show({ id: v.id, kicker: v.kicker, title: v.title, html: v.html, back: v.back }); } catch (error) { console.error('[mischief]', error); }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => paintGuests(v.guests || []));
    return view.token;
  }
  const still = token => view?.token === token;
  function paintGuests(guests) {
    for (const g of guests) {
      const slot = document.querySelector('[data-mx-guest="' + CSS.escape(g.id) + '"]');
      if (!slot || slot.childElementCount) continue;
      const pet = guestPet(g);
      if (pet) slot.appendChild(renderPetSprite(pet));
    }
  }
  const hexView = (friend, pick) => ({ id: 'mischief-hex', friend, kicker: 'Mischief', title: 'Hex ' + who(friend) + '’s shelf', back: 'friend:' + friend.userId,
    html: hexViewHTML({ friend, status: mx.cached()?.status || null, pets: state.pets, pick }) });
  function openHex(friend, ctx, pick = {}) {
    const token = show(ctx, hexView(friend, pick));
    const c = mx.cached();
    if (!c || now() - c.at > 60000) sync().then(() => { if (still(token)) show(ctx, hexView(friend, pick)); });
  }
  async function openHelp(friend, ctx) {
    const base = { id: 'mischief-help', friend, kicker: 'Neighbourly', title: 'Help out at ' + who(friend) + '’s', back: 'friend:' + friend.userId };
    const token = show(ctx, { ...base, html: helpViewHTML({ friend, loading: true }) });
    try {
      const [shelf] = await Promise.all([social.shelf(friend.userId), sync()]);
      if (!still(token) || ctx?.isCurrent?.() === false) return;
      const residents = shelf?.shelf?.residents || [];
      show(ctx, { ...base, html: helpViewHTML({ friend, residents, status: mx.cached()?.status }), guests: residents.filter(r => r.needs) });
    } catch (error) {
      if (still(token)) show(ctx, { ...base, html: helpViewHTML({ friend, error: mischiefText(error) }) });
    }
  }
  const knockView = (friend, result = null) => ({ id: 'mischief-knock', friend, kicker: 'The Thin Season', title: who(friend) + '’s door', back: 'friend:' + friend.userId,
    html: knockViewHTML({ friend, status: mx.cached()?.status || null, result, season: inThinSeason() }) });
  function openKnock(friend, ctx) {
    const token = show(ctx, knockView(friend));
    const c = mx.cached();
    if (!c || now() - c.at > 60000) sync().then(() => { if (still(token)) show(ctx, knockView(friend)); });
  }
  function openConfirm(kind, friend, ctx, back) {
    if (ctx?.isCurrent?.() === false) return;
    show(ctx, { id: 'mischief-confirm', friend, kicker: 'Mischief', title: (kind === 'block' ? 'Block ' : 'Report ') + who(friend), back: back || 'friend:' + friend.userId, html: confirmHTML(kind, friend) });
    view.kind = kind;
  }
  const statusLine = (el, text) => { const s = el?.closest('.mx-view, .mx-doorstep')?.querySelector('.mx-status'); if (s) s.textContent = text; };
  const busy = (el, on) => el?.closest('.mx-view, .mx-doorstep')?.querySelectorAll('button').forEach(b => { b.disabled = on; });

  registerSocialView('mischief-hex', {
    async onClick(action, el, ctx) {
      if (action !== 'send') return;
      const root = el.closest('.mx-view'), friend = friendOf(ctx, root?.dataset.mxFriend);
      const card = root?.querySelector('input[name="mxCard"]:checked')?.value, culprit = root?.querySelector('input[name="mxCulprit"]:checked')?.value;
      if (!friend || !card || !culprit) return;
      const status = mx.cached()?.status, rebound = status?.rebounds.find(r => r.toUser === friend.userId);
      const pet = state.pets.find(p => p.id === culprit);
      busy(el, true); statusLine(el, 'Sending.');
      const user = mx.userId();
      try {
        if (card === 'haunt') {
          await mx.sendHaunt({ to: friend.userId, resident: culprit });
          if (!current(user, ctx)) return;
          show(ctx, { id: 'mischief-hex', friend, kicker: 'Mischief', title: 'Haunting sent', back: 'friend:' + friend.userId,
            html: '<div class="mx-view mx-sent"><p class="mx-lede">' + esc(pet?.name || 'Your resident') + '’s ghost is drifting over to ' + esc(who(friend)) + '’s shelf. It stays a day unless they shoo it. You will hear which.</p></div>' });
        } else {
          await mx.sendHex({ to: friend.userId, card, culprit, rebound: rebound ? rebound.id : null });
          if (!current(user, ctx)) return;
          show(ctx, { id: 'mischief-hex', friend, kicker: 'Mischief', title: 'Hex sent', back: 'friend:' + friend.userId,
            html: '<div class="mx-view mx-sent"><p class="mx-sent-card">' + glyph(HEX_BY_ID[card].art) + '<b>' + esc(HEX_BY_ID[card].name) + '</b></p><p class="mx-lede">On its way to ' + esc(who(friend)) +
              '’s shelf, with ' + esc(pet?.name || 'your resident') + ' as the culprit. It waits up to two days. You will hear how it went.</p></div>' });
        }
        try { ctx.toast(card === 'haunt' ? 'Haunting sent.' : 'Hex sent.'); } catch { /* the hub's toast is optional */ }
      } catch (error) {
        busy(el, false); statusLine(el, mischiefText(error));
        if (['hexed_today', 'no_rebound', 'haunted_this_week'].includes(mischiefCode(error))) sync();
      }
    }
  });
  registerSocialView('mischief-help', {
    async onClick(action, el, ctx) {
      if (action !== 'help') return;
      const root = el.closest('.mx-view'), friend = friendOf(ctx, root?.dataset.mxFriend), need = el.dataset.mxNeed, resident = el.dataset.mxRes;
      if (!friend || !HELP_NEEDS.includes(need) || !resident) return;
      const petName = el.closest('.mx-help-row')?.querySelector('b')?.textContent || 'them';
      busy(el, true); statusLine(el, 'On your way.');
      const user = mx.userId();
      try {
        await mx.help({ to: friend.userId, resident, need });
        if (!current(user, ctx)) return;
        const done = helped(state, { need, petName, friend: who(friend) });
        save(); refresh();
        show(ctx, { id: 'mischief-help', friend, kicker: 'Neighbourly', title: 'Helped at ' + who(friend) + '’s', back: 'friend:' + friend.userId,
          html: '<div class="mx-view mx-sent"><p class="mx-lede">' + esc(done.line) + '</p>' + (done.souls ? '<p class="mx-paid">' + glyph('soul') + '+' + done.souls + ' souls</p>' : '') +
            '<p class="mx-small">' + esc(who(friend)) + ' sees it next time they open the game.</p></div>' });
      } catch (error) { busy(el, false); statusLine(el, mischiefText(error)); }
    }
  });
  registerSocialView('mischief-knock', {
    async onClick(action, el, ctx) {
      if (action !== 'knock') return;
      const friend = friendOf(ctx, el.closest('.mx-view')?.dataset.mxFriend);
      if (!friend) return;
      busy(el, true); statusLine(el, 'Knock knock.');
      const user = mx.userId();
      try {
        const knock = await mx.knock(friend.userId);
        if (!current(user, ctx)) return;
        const out = takeKnock(state, friend, knock);
        settleMischief(state, now());
        save(); refresh();
        show(ctx, knockView(friend, { ...out, bowl: knock.bowl }));
      } catch (error) { busy(el, false); statusLine(el, mischiefText(error)); if (mischiefCode(error) === 'knocked_tonight') sync(); }
    }
  });
  registerSocialView('mischief-confirm', {
    async onClick(action, el, ctx) {
      const friend = friendOf(ctx, view?.friend) || { userId: view?.friend, name: '' };
      if (action === 'cancel') { try { ctx.back(); } catch { /* nothing to go back to */ } return; }
      if (!friend.userId || !['block-yes', 'report-yes'].includes(action)) return;
      busy(el, true);
      const user = mx.userId();
      try {
        if (action === 'block-yes') {
          await social.block(friend.userId);
          if (!current(user, ctx)) return;
          dropFriend(state, friend.userId, now());
          save(); repaint();
          try { ctx.toast('Blocked. Their mischief went with them.'); ctx.refresh(); } catch { /* optional */ }
        } else {
          const reason = el.closest('.mx-view')?.querySelector('input[name="mxReason"]:checked')?.value || 'Something else';
          await social.report(friend.userId, 'Mischief: ' + reason);
          if (!current(user, ctx)) return;
          try { ctx.toast('Reported. Block them too if you would rather not hear from them.'); } catch { /* optional */ }
        }
        try { ctx.back(); } catch { /* nothing to go back to */ }
      } catch (error) { busy(el, false); statusLine(el, mischiefText(error)); }
    }
  });

  /* ---- friend actions ---- */
  registerFriendAction({ id: 'mischief-knock', order: 28, label: 'Knock', icon: 'door',
    available: friend => (!inThinSeason() ? false : mx.cached()?.status.knocked.includes(friend.userId) ? 'You have knocked there tonight.' : true),
    run: (friend, ctx) => openKnock(friend, ctx) });
  registerFriendAction({ id: 'mischief-hex', order: 30, label: 'Send a hex', icon: 'eye',
    available: friend => {
      if (!state.pets.length) return 'A hex needs a culprit. Make a resident first.';
      const st = mx.cached()?.status;
      if (st && st.hexedToday && !st.hauntReady && !st.rebounds.some(r => r.toUser === friend.userId)) return 'One hex a day, and today’s has gone.';
      return true;
    },
    run: (friend, ctx) => openHex(friend, ctx) });
  registerFriendAction({ id: 'mischief-help', order: 32, label: 'Help out', icon: 'heart',
    available: friend => (mx.cached()?.status.helped.includes(friend.userId) ? 'You have helped on their shelf today.' : true),
    run: (friend, ctx) => openHelp(friend, ctx) });

  /* ---- the postbox ---- */
  const ms = () => state.mischief || { hexes: [], helps: [], haunt: null };
  function incomingItems() {
    const items = ms().hexes.filter(h => !h.trick).map(h => ({ id: 'hex:' + h.ref, kind: 'hex', ref: h.ref, user: h.from.userId, name: h.from.name, at: h.arrived,
      title: 'A hex ' + fromLabel(h) + '.', line: (HEX_BY_ID[h.card]?.name || 'A hex') + '. ' + (inTray(state, h.ref) ? 'It is in your emergency tray.' : 'It takes the next free place in your emergency tray.') }));
    const g = activeHaunt(state, now());
    if (g) items.push({ id: 'haunt:' + g.ref, kind: 'haunt', ref: g.ref, user: g.from.userId, name: g.from.name, at: g.arrived,
      title: g.ghost.name + '’s ghost ' + fromLabel(g) + ' is haunting you.', line: 'It leaves at ' + clockTime(g.ends) + '. Tap it on the shelf to shoo it, for souls.' });
    return items.sort((a, b) => b.at - a.at);
  }
  function newsItems() {
    const c = mx.cached();
    if (!c) return [];
    const name = id => { const r = c.results.find(x => x.toUser === id); return r?.toName || 'your friend'; };
    return [
      ...c.results.map(r => ({ id: 'res:' + r.id, kind: 'result', ref: r.id, at: r.at, title: r.status === 'resolved' ? 'Your hex was dealt with.' : r.status === 'declined' ? 'Returned to sender.' : 'Your hex expired.', line: hexResultLine(r) })),
      ...c.hauntResults.map(r => ({ id: 'haunted:' + r.id, kind: 'result', ref: r.id, haunt: true, at: r.at, title: r.status === 'shooed' ? 'Your ghost was shooed.' : 'Your ghost is home.', line: hauntResultLine(r) })),
      ...c.status.rebounds.map(r => ({ id: 'reb:' + r.id, kind: 'rebound', ref: r.id, user: r.toUser, at: c.at, title: 'Rebound ready.', line: 'One of your hexes came back on its sender. You may send ' + name(r.toUser) + ' one back, free, once.' }))
    ].sort((a, b) => b.at - a.at);
  }
  const helpItems = () => ms().helps.slice(0, 10).map(h => ({ id: 'help:' + h.id, kind: 'help', ref: h.id, user: h.from.userId, name: h.from.name, at: h.applied, title: 'A neighbour called.', line: helpLineText(h) }));
  const knockItems = () => (inThinSeason() ? (mx.cached()?.doorstep.knocks || []).map(k => ({ id: 'knock:' + k.id, kind: 'knock', ref: k.id, user: k.fromUser, name: k.fromName, at: k.at,
    title: (k.fromName || 'A friend') + ' knocked.', line: k.result === 'treat' ? 'They went home with a treat.' : 'They went home with a trick.' })) : []);
  const LISTS = { 'mischief-incoming': incomingItems, 'mischief-news': newsItems, 'mischief-helps': helpItems, 'mischief-doorstep': knockItems };
  async function postboxClick(source, action, itemId, ctx) {
    const user = mx.userId();
    if (!current(user, ctx)) return;
    const item = LISTS[source]().find(x => x.id === itemId);
    if (!item) return;
    const friend = (item.user && friendOf(ctx, item.user)) || { userId: item.user, name: item.name };
    if (action === 'play') { closeHub(); window.dispatchEvent(new CustomEvent('shelflife:mayhem', { detail: { open: 'emergency' } })); }
    else if (action === 'find') { closeHub(); document.getElementById('cabinetWrap')?.scrollIntoView({ block: 'center' }); }
    else if (action === 'decline') { declineHex(state, item.ref, now()); save(); refresh(); await flush(); if (!current(user, ctx)) return; save(); safe(() => ctx.refresh()); safe(() => ctx.say('Returned to sender. They will be told it came back unopened.')); }
    else if (action === 'seen') {
      try { await mx.seen(item.haunt ? 'haunt' : 'hex', item.ref); } catch (error) { if (!current(user, ctx)) return; safe(() => ctx.say(mischiefText(error))); }
      if (!current(user, ctx)) return;
      safe(() => ctx.refresh());
    }
    else if (action === 'rebound' && friend.userId) openHex(friend, ctx);
    else if ((action === 'block' || action === 'report') && friend.userId) openConfirm(action, friend, ctx, 'postbox');
  }
  const safe = fn => { try { return fn(); } catch { return undefined; } };
  // The hub's own Close button, so it tidies up after itself.
  const closeHub = () => { const close = document.querySelector('#friendsSheet [data-fr="close"]'); if (close) close.click(); else document.getElementById('friendsVeil')?.classList.remove('open'); };
  const source = (id, order, label, count, poll = true) => registerPostboxSource({ id, order, label, poll, count,
    load: async () => { await sync(); return LISTS[id](); },
    render: item => rowHTML(item),
    onClick: (action, itemId, ctx) => postboxClick(id, action, itemId, ctx) });
  source('mischief-incoming', 40, 'Hexes and hauntings', () => incomingItems().length);
  source('mischief-news', 41, 'How your mischief went', () => newsItems().length);
  source('mischief-helps', 42, 'Neighbours', () => 0, false);
  source('mischief-doorstep', 43, 'Your doorstep', () => 0, false);

  /* ---- the doorstep, on the Friends home, in season ---- */
  registerFriendsSection({ id: 'mischief-doorstep', where: 'home', order: 45,
    render: () => doorstepHTML({ doorstep: mx.cached()?.doorstep, season: inThinSeason() && mx.active() }),
    async onClick(action, el, ctx) {
      if (action !== 'bowl') return;
      const bowl = el.closest('.mx-doorstep')?.querySelector('input[name="mxBowl"]:checked')?.value;
      if (!BOWL_BY_ID[bowl]) return;
      busy(el, true);
      const user = mx.userId();
      try {
        await mx.setBowl(bowl);
        if (!current(user, ctx)) return;
        const text = 'The bowl is out: ' + BOWL_BY_ID[bowl].name + '.';
        statusLine(el, text); safe(() => ctx.say(text)); safe(() => ctx.toast('The bowl is out.'));
      }
      catch (error) { if (!current(user, ctx)) return; statusLine(el, mischiefText(error)); safe(() => ctx.say(mischiefText(error))); }
      finally { busy(el, false); }
    } });

  /* ---- a friend's hex in the emergency sheet ---- */
  window.addEventListener('shelflife:emergency', event => {
    const { info, sheet } = event.detail || {};
    if (info?.external !== 'hex' || !sheet) return;
    const ext = info.entry.ext, card = sheet.querySelector('.mh-card');
    card?.classList.add('mx-hexed');
    // On the scene, not the sprite: the culprit is drawn mirrored.
    sheet.querySelector('.mh-scene')?.insertAdjacentHTML('beforeend', '<span class="mx-from">' + esc(info.from) + '</span>');
    const fine = sheet.querySelector('.mh-fineprint');
    if (fine) fine.textContent = (ext.trick ? 'A trick ' : 'A hex ') + info.from + '. Every choice pays souls and nothing is taken.' + (ext.trick ? '' : ' ' + who(ext.from) + ' hears how it went.');
    card?.insertAdjacentHTML('beforeend', hexBarHTML(ext));
  });
  window.addEventListener('shelflife:emergency-result', event => {
    const { result, card } = event.detail || {};
    if (!card) return;
    card.querySelector('.mx-hexbar')?.remove();
    if (!result?.external) return;
    if (result.note) {
      let list = card.querySelector('.mh-rewards');
      if (!list) { list = document.createElement('ul'); list.className = 'mh-rewards'; (card.querySelector('.alm-hook') || card.querySelector('.mh-text'))?.after(list); }
      list.insertAdjacentHTML('beforeend', '<li class="good">' + esc(result.note) + '</li>');
    }
    setTimeout(() => { settle(); sync(); }, 0);
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('#mayhemSheet [data-mx]');
    if (!button || button.disabled) return;
    const bar = button.closest('.mx-hexbar'), ref = bar?.dataset.mxRef, userId = bar?.dataset.mxUser;
    const reopen = () => window.dispatchEvent(new CustomEvent('shelflife:mayhem', { detail: { open: mayhemState(state).queue.length ? 'emergency' : 'quiet' } }));
    const act = button.dataset.mx;
    if (act === 'decline' && ref) {
      const h = declineHex(state, ref, now());
      save(); refresh(); reopen();
      toast(h?.trick ? 'Left on the step. The trick will find someone else.' : 'Returned to sender. ' + who(h?.from) + ' will be told it came back unopened.');
      sync();
    } else if (act === 'cancel') reopen();
    else if (act === 'block' && userId) {
      bar.innerHTML = '<p class="mx-bar-note"><b>Block ' + esc(who(mayhemState(state).queue.find(q => q.ext?.ref === ref)?.ext.from)) + '?</b> Their hexes, ghosts and helps leave your shelf and they cannot reach you again. They are not told.</p>' +
        '<button class="btn btn-sm fr-warn" type="button" data-mx="block-yes">Block</button><button class="btn btn-sm btn-ghost" type="button" data-mx="cancel">Cancel</button>';
      bar.querySelector('[data-mx="block-yes"]')?.focus();
    } else if (act === 'report' && userId) {
      bar.innerHTML = '<fieldset class="fr-reasons"><legend>What is wrong?</legend>' + REPORT_REASONS.map((r, i) => '<label><input type="radio" name="mxBarReason" value="' + esc(r) + '"' + (i ? '' : ' checked') + '> ' + esc(r) + '</label>').join('') + '</fieldset>' +
        '<button class="btn btn-sm fr-warn" type="button" data-mx="report-yes">Send report</button><button class="btn btn-sm btn-ghost" type="button" data-mx="cancel">Cancel</button>';
      bar.querySelector('input')?.focus();
    } else if ((act === 'block-yes' || act === 'report-yes') && userId) {
      const user = mx.userId();
      bar.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        if (act === 'block-yes') {
          await social.block(userId);
          if (!current(user)) return;
          dropFriend(state, userId, now());
          save(); refresh(); reopen(); ghost.render();
          toast('Blocked. Their mischief went with them.');
        } else {
          await social.report(userId, 'Mischief: ' + (bar.querySelector('input[name="mxBarReason"]:checked')?.value || 'Something else'));
          if (!current(user)) return;
          reopen();
          toast('Reported. A person reads every report.');
        }
      } catch (error) {
        if (!current(user)) return;
        bar.querySelectorAll('button').forEach(b => { b.disabled = false; });
        toast(mischiefText(error));
      }
    }
  });

  /* ---- the loop ---- */
  const visible = () => typeof document === 'undefined' || !document.hidden;
  setInterval(() => { if (visible() && !document.querySelector('.veil.open')) settle(); }, 3000);
  setInterval(() => { if (visible()) sync(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (visible()) sync(); });
  window.addEventListener('online', () => sync());
  window.addEventListener('pageshow', () => sync());
  social.subscribe(() => sync());
  setTimeout(() => { settle(); sync(); }, 1500);
  ghost.render();
  return { sync, settle, client: mx, ghost };
}

