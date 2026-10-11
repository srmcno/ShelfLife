// Kin in the Friends sheet: "Leave a basket out" on a friend's profile, a Kin
// section there, three kinds of postbox mail (baskets, births, letters) and
// the views behind them. Everything plugs in through social-registry.js;
// nothing here edits the sheet itself.
//
// Selectors for tests and the hub: the friend action is "kin-basket", the
// friend section "kin", postbox sources "kin-baskets", "kin-births" and
// "kin-letters", views "kin-basket", "kin-offer", "kin-letter",
// "kin-introduce" and "kin-pal". Buttons inside carry data-sx.
import { registerFriendAction, registerPostboxSource, registerFriendsSection, registerSocialView } from './social-registry.js';
import { createKin, kinText, parentSnapshot, BASKET_HOURS } from '../cloud/kin.js';
import { readResident } from '../cloud/social.js';
import { kinState, KIN_STEP_MAX, KIN_COLLECTED_MAX } from '../kin-state.js';
import { realizeFoundling, portraitHTML, envelopeSVG } from '../art/kin-art.js';
import { foundlingPet, foundlingId, foundlingName, hasRoom, FULL_SHELF, NAME_ROLLS } from '../engine/kin.js';
import { writeLetter, replyOptions } from '../engine/kin-letters.js';
import { HISTORY_LABELS, TONE_LABELS } from '../content/kin.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { addNote } from '../state.js';
import { letterHTML, foundOnStep } from './kin-card.js';

const REPORT_REASONS = ['A rude name', 'A rude drawing', 'Bothering me', 'Something else'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const friendLabel = f => f?.name || 'A friend';
const shelfLabel = name => (name ? name + '’s shelf' : 'a friend’s shelf');
const traitList = traits => (traits || []).map(t => TRAIT_BY_ID[t]?.name).filter(Boolean).join(', ');
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const button = (action, label, { id = '', cls = '', disabled = false, extra = '' } = {}) =>
  '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" data-sx="' + action + '"' + (id ? ' data-sx-id="' + esc(id) + '"' : '') + (disabled ? ' disabled' : '') + extra + '>' + label + '</button>';

/* ---------------- the cloud and the cache ---------------- */
const clients = new WeakMap();
function kinFor(ctx) {
  const cloud = ctx?.cloud;
  if (!cloud) return null;
  let k = clients.get(cloud);
  if (!k) { k = createKin({ cloud }); clients.set(cloud, k); }
  return k;
}
// `loading` is one request per signed-in owner, so a look for one account is
// never served to, or held up for, another.
const cache = { user: null, mail: null, offset: 0, loading: new Map() };
function mailFor(ctx) {
  const uid = kinFor(ctx)?.userId();
  return uid && cache.user === uid ? cache.mail : null;
}
const serverNow = () => Date.now() + cache.offset;
const nameFor = (ctx, userId, fallback = '') => friendLabel(ctx?.friend?.(userId)) !== 'A friend' ? ctx.friend(userId).name : fallback;

/* ---------------- fences ----------------
   Everything that waits on the cloud and then writes to the save checks, after
   each wait, that it is still talking about the same account and the same
   household. A restore (a backup, or a chosen cloud copy) swaps the contents of
   the live state in place, under the same account, so the household is told
   apart by its Kin record: normalizeState makes a new one every time, and the
   window events below say so too. */
let epoch = 0;
export function noteStateReplaced() { epoch++; cache.mail = null; }
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('shelflife:state-replaced', noteStateReplaced);
  window.addEventListener('shelflife:restored', noteStateReplaced);
}
export function stateFence(state, client, user) {
  const kin = kinState(state), at = epoch;
  return () => state.kin === kin && epoch === at && (!client?.userId || client.userId() === user);
}
const saved = ctx => ctx?.save?.() !== false;

// One look at the server, then whatever it brought is kept in the save:
// letters are written down, and foundlings born of our baskets move in. A
// look is only ever for one account and one household; if either changes
// while it waits, what it found is dropped and the next look starts again.
export function refreshKin(ctx) {
  const k = kinFor(ctx);
  if (!k || !k.signedIn()) { cache.mail = null; cache.user = null; return Promise.resolve(null); }
  const uid = k.userId(), state = ctx.state;
  const running = cache.loading.get(uid);
  if (running && running.state === state && running.current()) return running.promise;
  const current = stateFence(state, k, uid);
  const entry = { state, current, promise: null };
  entry.promise = (async () => {
    let last = null;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let mail;
      try { mail = await k.mail(); }
      catch (error) { if (!current()) return null; throw error; }
      if (!current()) return null;
      cache.user = mail.user; cache.mail = mail;
      if (mail.now) cache.offset = mail.now - Date.now();
      const result = await absorbMail({ state, mail, kin: k, shelfName: id => nameFor(ctx, id), save: () => saved(ctx), current });
      if (result.stale || !current()) return null;
      mail.waiting = result.waiting + (mail.birthsMore ? 1 : 0);
      last = mail;
      announce(ctx, result);
      if (!(mail.birthsMore && result.claimed.length)) break;
    }
    // Once per household and account: any foundling this save has never heard of.
    try {
      const found = await recoverBirths({ state, kin: k, user: uid, shelfName: id => nameFor(ctx, id), save: () => saved(ctx), current });
      if (found.stale || !current()) return null;
      if (last) last.waiting = Math.max(last.waiting || 0, found.waiting);
      announce(ctx, found);
    } catch { /* tried again on the next look; nothing is lost */ }
    return last;
  })().finally(() => { if (cache.loading.get(uid) === entry) cache.loading.delete(uid); });
  cache.loading.set(uid, entry);
  return entry.promise;
}
const MAX_ROUNDS = 6;
function announce(ctx, result) {
  if (result.changed) ctx.renderAll?.();
  if (result.adopted.length) ctx.toast?.(result.adopted.length === 1 ? result.adopted[0].name + ' was found on the step.' : result.adopted.length + ' foundlings were found on the step.');
}

/* ---------------- keeping what arrives ---------------- */
function childName(state, pal) {
  if (pal.history !== 'foundling' || !pal.basket) return '';
  const id = foundlingId(pal.basket);
  return state.pets.find(p => p.id === id)?.name || kinState(state).foundlings.find(f => f.basket === pal.basket)?.name || '';
}
// A letter as the household keeps it: written out once, with what a reply needs.
export function keepLetter(state, mail, letter, shelf = '') {
  const pal = mail.pals.find(p => p.id === letter.pal);
  if (!pal) return null;
  let text = '';
  if (letter.kind === 'weekly') {
    text = writeLetter({ seed: pal.seed, week: letter.week, history: pal.history, writer: letter.writer, reader: letter.reader, caseId: pal.caseId, child: childName(state, pal) }).text;
  } else {
    text = replyOptions({ seed: pal.seed, week: letter.week, writer: letter.writer, reader: letter.reader })[letter.choice]?.text || '';
  }
  if (!text) return null;
  const kept = { id: letter.id, pal: pal.id, week: letter.week, at: letter.createdAt || Date.now(), dir: 'in', kind: letter.kind, mine: letter.reader.id,
    theirs: letter.writer.name, friend: pal.friend, shelf, text, read: false, replied: false };
  if (letter.kind === 'weekly') kept.cards = { seed: pal.seed, writer: { name: letter.writer.name, traits: letter.writer.traits }, reader: { name: letter.reader.name, traits: letter.reader.traits } };
  return kept;
}
export function foundlingRecord(basket, pet, side, shelf = '') {
  const a = { id: basket.fromParent.id, name: basket.fromParent.name }, b = { id: basket.toParentId, name: basket.toParent?.name || basket.toParentName };
  const friend = side === 'out' ? basket.toUser : basket.fromUser;
  const friendShelf = shelf || (side === 'out' ? basket.toName : basket.fromName);
  const away = p => ({ ...p, home: false, friend, shelf: friendShelf });
  const home = p => ({ ...p, home: true, friend: '', shelf: '' });
  return { pet: pet.id, basket: basket.id, born: pet.born, name: pet.name,
    parents: side === 'out' ? [home(a), away(b)] : [away(a), home(b)], twin: { friend, shelf: friendShelf } };
}
// Into a free space, with a note on the board. 'full' leaves it for the step.
export function adopt(state, pet, record, note) {
  const kin = kinState(state);
  if (state.pets.some(p => p.id === pet.id)) {
    if (!kin.foundlings.some(f => f.basket === record.basket)) kin.foundlings.push(record);
    return 'here';
  }
  if (!hasRoom(state)) return 'full';
  state.pets.push(pet);
  state.slots[state.slots.indexOf(null)] = pet.id;
  if (!kin.foundlings.some(f => f.basket === record.basket)) kin.foundlings.push(record);
  addNote(state, note, 'the step', 'arrival');
  return 'adopted';
}
const KEEP_PER_PAL = 10;
function trimLetters(kin) {
  const count = new Map();
  for (let i = kin.letters.length - 1; i >= 0; i--) {
    const n = (count.get(kin.letters[i].pal) || 0) + 1;
    count.set(kin.letters[i].pal, n);
    if (n > KEEP_PER_PAL) kin.letters.splice(i, 1);
  }
}
// Has this household already dealt with this birth? Here, waiting on the step,
// written in its record, rehomed since (state.gone is never pruned) or already
// taken in once. A save from before the birth knows none of these.
export function knownBirth(state, basketId) {
  const kin = kinState(state), pet = foundlingId(basketId);
  return state.pets.some(p => p.id === pet) || kin.foundlings.some(f => f.basket === basketId) || kin.step.some(s => s.basket === basketId) ||
    kin.collected.includes(basketId) || (Array.isArray(state.gone) && state.gone.some(g => g?.id === pet));
}
// Room on the step. A foundling goes straight to the shelf only when nobody is
// already waiting; otherwise it queues behind them, so older arrivals get the
// first free space. With the step full, a birth stays on the server, unclaimed,
// until there is room.
export const canKeep = state => kinState(state).step.length < KIN_STEP_MAX;

// Marks births as taken in on this device and saves. If the save fails the
// marks come off again: nothing counts as collected until it is durable.
function commit(state, ids, save) {
  const kin = kinState(state), added = ids.filter(id => !kin.collected.includes(id));
  kin.collected.push(...added);
  let ok = false;
  try { ok = save() !== false; } catch { ok = false; }
  if (!ok) kin.collected = kin.collected.filter(id => !added.includes(id));
  else if (kin.collected.length > KIN_COLLECTED_MAX) kin.collected.splice(0, kin.collected.length - KIN_COLLECTED_MAX);
  return ok;
}
async function takeBirths({ state, births, shelfName, realize, now, current, result }) {
  const kin = kinState(state), take = [];
  for (const b of births) {
    if (!current()) { result.stale = true; return take; }
    if (!knownBirth(state, b.id)) {
      if (!canKeep(state)) { result.waiting++; continue; }
      const plan = await realize({ a: b.fromParent, b: b.toParent, seed: b.seed });
      if (!current()) { result.stale = true; return take; }
      // Taken in by someone else while the drawing was being made, or no room after all.
      if (!knownBirth(state, b.id)) {
        if (!canKeep(state)) { result.waiting++; continue; }
        plan.name = foundlingName(b.fromParent.name, b.toParent.name, b.seed, b.nameRoll);
        const side = b.direction === 'out' ? 'out' : 'in';
        const pet = foundlingPet(plan, { basketId: b.id, born: b.answeredAt || now });
        const record = foundlingRecord(b, pet, side, shelfName(side === 'out' ? b.toUser : b.fromUser) || (side === 'out' ? b.toName : b.fromName));
        const where = kin.step.length ? 'full' : adopt(state, pet, record, plan.birth);
        if (where === 'full') { kin.step.push({ basket: b.id, at: now, pet, record, note: plan.birth }); result.stepped.push(pet); }
        if (where === 'adopted') { kin.notices.push({ basket: b.id, pet: pet.id, at: now, text: plan.birth }); result.adopted.push(pet); }
        result.changed = true;
      }
    }
    take.push(b);
  }
  return take;
}
// Letters are written down; births are taken in, saved, and only then claimed
// on the server. `current` says whether the account and household this mail was
// fetched for are still the live ones; it is asked before anything is written
// and again after every wait.
export async function absorbMail({ state, mail, kin: client, shelfName = () => '', realize = realizeFoundling, now = Date.now(), save = () => true, current = null }) {
  const result = { changed: false, adopted: [], stepped: [], claimed: [], waiting: 0, saved: true, stale: false };
  const alive = current || stateFence(state, client, mail.user);
  if (!alive()) { result.stale = true; return result; }
  const kin = kinState(state);
  let letters = false;
  for (const letter of mail.letters || []) {
    if (kin.letters.some(l => l.id === letter.id)) continue;
    const pal = mail.pals.find(p => p.id === letter.pal);
    const kept = keepLetter(state, mail, letter, shelfName(pal?.friend) || '');
    if (kept) { kin.letters.push(kept); result.changed = letters = true; }
  }
  if (letters) trimLetters(kin);
  // A letter kept before the friends list was in hand (a background check) has no shelf name yet; the name is filled in once it is known.
  for (const l of kin.letters) if (!l.shelf && l.friend) { const name = shelfName(l.friend); if (name) { l.shelf = name.slice(0, 24); result.changed = true; } }
  const taken = await takeBirths({ state, births: mail.births || [], shelfName, realize, now, current: alive, result });
  if (result.stale) return result;
  if (result.changed || taken.length) {
    result.saved = commit(state, taken.map(b => b.id), save);
    // Nothing is claimed until the save is safe. The next look finds the same births and reaches the same shelf.
    if (!result.saved) return result;
  }
  for (const b of taken) {
    if (!alive()) { result.stale = true; return result; }
    if (b.collected) { result.claimed.push(b.id); continue; }
    try { await client?.collect?.(b.id); result.claimed.push(b.id); }
    catch { /* asked again on the next look; the receipt is still there */ }
  }
  return result;
}
// Every birth this account has ever had, listed by the server and checked against
// this household: a save restored from before a birth, or lost with a device,
// is given its foundlings back, as many as there is room for, each once.
const scanned = new WeakMap(); // a household's Kin record -> accounts already checked
export async function recoverBirths({ state, kin: client, user, shelfName = () => '', realize = realizeFoundling, now = Date.now(), save = () => true, current = null }) {
  const result = { changed: false, adopted: [], stepped: [], claimed: [], waiting: 0, saved: true, stale: false, scanned: false };
  const alive = current || stateFence(state, client, user);
  const kin = kinState(state);
  if (scanned.get(kin)?.has(user)) return result;
  const missing = [];
  let cursor = null;
  for (let page = 0; page < MAX_INDEX_PAGES; page++) {
    const index = await client.recover(cursor);
    if (!alive()) { result.stale = true; return result; }
    for (const item of index.items) if (!knownBirth(state, item.id)) missing.push(item.id);
    cursor = index.next;
    if (!cursor) break;
  }
  while (missing.length && canKeep(state)) {
    const births = await client.receipts(missing.splice(0, 4));
    if (!alive()) { result.stale = true; return result; }
    const part = await absorbMail({ state, mail: { user, letters: [], pals: [], baskets: [], births }, kin: client, shelfName, realize, now, save, current: alive });
    for (const key of ['adopted', 'stepped', 'claimed']) result[key].push(...part[key]);
    result.changed ||= part.changed; result.waiting += part.waiting;
    if (part.stale) { result.stale = true; return result; }
    if (!part.saved) { result.saved = false; return result; }
  }
  result.waiting += missing.length;
  if (!cursor && !missing.length && !result.waiting) {
    const mine = scanned.get(kin) || new Set();
    scanned.set(kin, mine.add(user));
    result.scanned = true;
  }
  return result;
}
const MAX_INDEX_PAGES = 50;
export function takeInFromStep(state, basketId) {
  const kin = kinState(state);
  const i = kin.step.findIndex(s => s.basket === basketId);
  if (i < 0) return 'gone';
  const item = kin.step[i];
  const where = adopt(state, item.pet, item.record, item.note);
  if (where !== 'full') kin.step.splice(i, 1);
  if (where === 'adopted') kin.notices.push({ basket: item.basket, pet: item.pet.id, at: Date.now(), text: item.note });
  return where;
}

/* ---------------- shared bits of markup ---------------- */
function timeLeft(ms) {
  const hours = Math.max(0, Math.round((ms - serverNow()) / 3600000));
  return hours >= 2 ? 'It keeps for another ' + hours + ' hours.' : 'It will be taken in within the hour.';
}
function guardHTML(confirm, friend) {
  if (!confirm || !friend) return '';
  const who = esc(friendLabel(friend));
  if (confirm === 'block') return '<div class="fr-confirm kin-guard" role="group" aria-label="Block ' + who + '"><p><b>Block ' + who + '?</b> They are removed, baskets and letters between you stop, and your code stops working for them. They are not told.</p>' +
    '<div class="fr-actions">' + button('block-yes', 'Block', { cls: 'fr-warn' }) + button('guard-cancel', 'Cancel', { cls: 'btn-ghost' }) + '</div></div>';
  return '<div class="fr-confirm kin-guard" role="group" aria-label="Report ' + who + '"><p><b>Report ' + who + '?</b> A person reads every report. They are not told who sent it.</p>' +
    '<fieldset class="fr-reasons"><legend class="sr-only">What is wrong</legend>' + REPORT_REASONS.map((r, i) => '<label><input type="radio" name="kinReason" value="' + esc(r) + '"' + (i ? '' : ' checked') + '> ' + esc(r) + '</label>').join('') + '</fieldset>' +
    '<div class="fr-actions">' + button('report-yes', 'Send report', { cls: 'fr-warn' }) + button('guard-cancel', 'Cancel', { cls: 'btn-ghost' }) + '</div></div>';
}
const guardButtons = friend => '<div class="kin-guard-row">' + button('block', 'Block ' + esc(friendLabel(friend)), { cls: 'btn-sm btn-ghost fr-warn' }) +
  button('report', 'Report', { cls: 'btn-sm btn-ghost fr-warn' }) + '</div>';
async function guard(action, ctx, friend, after) {
  if (!friend) return false;
  if (action === 'block-yes') {
    await ctx.social.block(friend.userId);
    cache.mail = null;
    after?.();
    ctx.say?.('Blocked. They will not find you again.');
    return true;
  }
  if (action === 'report-yes') {
    const reason = document.querySelector('input[name="kinReason"]:checked')?.value || REPORT_REASONS[3];
    await ctx.social.report(friend.userId, reason + ': kin');
    after?.();
    ctx.say?.('Reported. Block them too if you would rather not hear from them.');
    return true;
  }
  return false;
}
function picker(list, chosen, action, label) {
  if (!list.length) return '<p class="kin-empty">' + esc(label) + '</p>';
  return '<div class="kin-picker" role="group">' + list.map(r => '<button class="kin-pick" type="button" data-sx="' + action + '" data-sx-id="' + esc(r.id) + '" aria-pressed="' + (r.id === chosen) + '">' +
    portraitHTML(r.art) + '<span>' + esc(r.name) + '</span></button>').join('') + '</div>';
}

/* ---------------- Leave a basket out ---------------- */
let basket = null; // { friend, theirs: [residents] | null, mine, their, error, confirm, busy }
function basketHistory(ctx) {
  const info = mailFor(ctx)?.friends.find(f => f.userId === basket.friend.userId);
  if (!basket.mine || !basket.their) return '';
  if (info?.hearings.some(([m, t]) => m === basket.mine && t === basket.their)) return HISTORY_LABELS.hearing + '. That counts as history.';
  if (mailFor(ctx)?.pals.some(p => p.friend === basket.friend.userId && p.mine.id === basket.mine && p.theirs.id === basket.their)) return 'Pen pals already. That counts as history.';
  if (info?.weekOld) return 'You have been friends for a week, which counts as history.';
  if (info) return 'These two have no history yet. A hearing in Shelf Court counts, or a week of being friends.';
  return '';
}
function basketView(ctx) {
  const f = basket.friend, who = esc(friendLabel(f));
  const mine = ctx.state.pets.map(p => ({ id: p.id, name: p.name, art: p.art }));
  const ready = basket.mine && basket.their && !basket.busy;
  const html = '<div class="kin-view kin-basket-view" data-kin-view="basket">' +
    '<p class="kin-lede">Choose one of yours and one of theirs. If ' + who + ' takes the basket in within ' + BASKET_HOURS + ' hours, a foundling turns up on both shelves. Each of you keeps your own.</p>' +
    (hasRoom(ctx.state) ? '' : '<p class="kin-warn" role="note">Your shelf is full, so your copy will wait on the step until there is room.</p>') +
    '<h3 class="kin-h">Yours</h3>' + picker(mine, basket.mine, 'pick-mine', 'Nobody on your shelf yet.') +
    '<h3 class="kin-h">' + who + '’s</h3>' + (basket.theirs === null ? '<p class="kin-empty">Wiping their doormat.</p>' : picker(basket.theirs, basket.their, 'pick-theirs', 'Nothing on show on their shelf yet.')) +
    (basketHistory(ctx) ? '<p class="kin-hint" data-kin-history>' + esc(basketHistory(ctx)) + '</p>' : '') +
    (basket.error ? '<p class="kin-error" role="alert">' + esc(basket.error) + '</p>' : '') +
    '<div class="fr-actions">' + button('leave', 'Leave the basket out', { cls: 'btn-primary', disabled: !ready }) + '</div></div>';
  ctx.show({ id: 'kin-basket', kicker: f.name ? f.name + '’s step' : 'A friend’s step', title: 'Leave a basket out', html, back: 'friend:' + f.userId });
}
async function openBasket(friend, ctx) {
  basket = { friend, theirs: null, mine: ctx.state.pets[0]?.id || '', their: '', error: '', busy: false };
  basketView(ctx);
  const token = basket;
  const [shelf] = await Promise.all([ctx.social.shelf(friend.userId).catch(error => ({ error })), refreshKin(ctx).catch(() => null)]);
  if (basket !== token) return;
  if (shelf?.error) basket.error = kinText(shelf.error);
  basket.theirs = shelf?.shelf?.residents || [];
  if (basket.theirs.length === 1) basket.their = basket.theirs[0].id;
  basketView(ctx);
}
registerSocialView('kin-basket', {
  async onClick(action, el, ctx) {
    if (!basket) return;
    if (action === 'pick-mine') { basket.mine = el.dataset.sxId; basket.error = ''; basketView(ctx); return; }
    if (action === 'pick-theirs') { basket.their = el.dataset.sxId; basket.error = ''; basketView(ctx); return; }
    if (action !== 'leave' || basket.busy) return;
    const pet = ctx.state.pets.find(p => p.id === basket.mine);
    if (!pet || !basket.their) return;
    basket.busy = true; basket.error = ''; basketView(ctx);
    try {
      await kinFor(ctx).leaveBasket({ to: basket.friend.userId, pet, theirs: basket.their });
      const theirs = basket.theirs.find(r => r.id === basket.their);
      const said = 'A basket is on ' + friendLabel(basket.friend) + '’s step, with ' + pet.name + ' and ' + (theirs?.name || 'theirs') + ' in mind. It keeps for ' + BASKET_HOURS + ' hours.';
      basket = null;
      cache.mail = null;
      refreshKin(ctx).catch(() => {});
      ctx.back?.();
      ctx.say?.(said);
    } catch (error) {
      basket.busy = false; basket.error = kinText(error); basketView(ctx);
    }
  }
});

registerFriendAction({
  id: 'kin-basket', label: 'Leave a basket out', order: 40, icon: 'basket',
  available(friend, ctx) {
    const info = mailFor(ctx)?.friends.find(f => f.userId === friend.userId);
    if (!ctx?.state?.pets?.length) return 'You need a resident of your own first.';
    if (!info) return true;
    if (info.openBasket) return 'A basket is already out between you.';
    if (info.nextBasketAt > serverNow()) {
      const days = Math.max(1, Math.ceil((info.nextBasketAt - serverNow()) / 86400000));
      return 'The next basket can go out in ' + plural(days, 'day', 'days') + '.';
    }
    if (!info.weekOld && !info.hearings.length && !mailFor(ctx).pals.some(p => p.friend === friend.userId)) return 'Your residents need some history first: a hearing in Shelf Court, or a week of friendship.';
    return true;
  },
  run(friend, ctx) { return openBasket(friend, ctx); }
});

/* ---------------- A basket on our step ---------------- */
let offer = null; // { basket, parent, plan, roll, busy, error, confirm }
function offerName() {
  return foundlingName(offer.basket.fromParent.name, offer.parent.name, offer.basket.seed, offer.roll);
}
function offerView(ctx) {
  const b = offer.basket, friend = ctx.friend?.(b.fromUser) || { userId: b.fromUser, name: b.fromName };
  const full = !hasRoom(ctx.state);
  const plan = offer.plan;
  const html = '<div class="kin-view kin-offer" data-kin-view="offer">' +
    '<p class="kin-lede">' + esc(friendLabel(friend)) + ' left a basket out for ' + esc(offer.parent.name) + ' and ' + esc(b.fromParent.name) + '. ' + esc(timeLeft(b.expiresAt)) + '</p>' +
    (plan ? '<div class="kin-preview"><div class="kin-preview-art">' + portraitHTML(plan.art, { label: 'The foundling' }) + '</div><div class="kin-preview-text">' +
      '<p class="kin-name" data-kin-name>' + esc(offerName()) + '</p>' + button('reroll', 'Another name', { cls: 'btn-sm btn-ghost', disabled: offer.busy }) +
      '<p class="kin-traits">' + esc(traitList(plan.traits)) + '</p></div></div><p class="kin-birth">' + esc(plan.birth) + '</p>' +
      '<p class="kin-parents">' + esc('Parents: ' + b.fromParent.name + ' (' + shelfLabel(friend.name || b.fromName) + ') and ' + offer.parent.name + ' (yours).') + '</p>'
      : '<p class="kin-empty">Peering into the basket.</p>') +
    (full ? '<p class="kin-warn" role="note" data-kin-full>' + esc(FULL_SHELF) + '</p>' : '') +
    (offer.error ? '<p class="kin-error" role="alert">' + esc(offer.error) + '</p>' : '') +
    '<div class="fr-actions">' + button('accept', 'Take it in', { cls: 'btn-primary', disabled: !plan || full || offer.busy }) + button('decline', 'Leave it on the step', { disabled: offer.busy }) + '</div>' +
    guardButtons(friend) + guardHTML(offer.confirm, friend) + '</div>';
  ctx.show({ id: 'kin-offer', kicker: 'From ' + friendLabel(friend), title: 'A basket on the step', html, back: 'postbox' });
}
async function openOffer(basketId, ctx) {
  const b = mailFor(ctx)?.baskets.find(x => x.id === basketId && x.direction === 'in' && x.status === 'offered');
  if (!b) { ctx.say?.('That basket has gone.'); return; }
  const pet = ctx.state.pets.find(p => p.id === b.toParentId);
  if (!pet) { ctx.say?.('The resident this basket was left for no longer lives here.'); return; }
  // The snapshot the other shelf will blend from, read the way it will read it.
  const snapshot = parentSnapshot(pet), parent = readResident(snapshot);
  offer = { basket: b, snapshot, parent, plan: null, roll: 0, busy: false, error: '', confirm: '' };
  offerView(ctx);
  const token = offer;
  const plan = await realizeFoundling({ a: b.fromParent, b: parent, seed: b.seed });
  if (offer !== token) return;
  offer.plan = plan;
  offerView(ctx);
}
async function answer(ctx, accept) {
  const b = offer.basket, k = kinFor(ctx), state = ctx.state;
  const current = stateFence(state, k, k.userId());
  let said = '';
  offer.busy = true; offer.error = ''; offerView(ctx);
  try {
    if (accept && !hasRoom(state)) throw Object.assign(new Error(FULL_SHELF), { code: 'shelf_full' });
    const r = await k.answerBasket(b.id, { accept, parent: offer.snapshot, nameRoll: offer.roll });
    // The account or the household changed while the cloud was answering. The
    // birth is on the server as a receipt and finds its way to whichever shelf is live.
    if (!current()) { offer = null; cache.mail = null; refreshKin(ctx).catch(() => {}); ctx.back?.(); return; }
    if (accept && r.status === 'born') {
      const plan = { ...offer.plan, name: offerName() };
      const pet = foundlingPet(plan, { basketId: b.id, born: r.answeredAt || Date.now() });
      const friend = ctx.friend?.(b.fromUser);
      const record = foundlingRecord({ ...b, toParent: offer.parent }, pet, 'in', friend?.name || b.fromName);
      const where = adopt(state, pet, record, plan.birth);
      if (where === 'full') kinState(state).step.push({ basket: b.id, at: Date.now(), pet, record, note: plan.birth });
      // Saved first, claimed after: if the save fails nothing is claimed, and the next look at the mail finishes the job.
      const durable = commit(state, [b.id], () => saved(ctx));
      ctx.renderAll?.();
      if (durable) k.collect(b.id).catch(() => { /* claimed on the next look */ });
      said = durable ? pet.name + ' has moved in. ' + shelfLabel(friend?.name || b.fromName).replace(/^./, c => c.toUpperCase()) + ' has one too, which will live its own life.'
        : pet.name + ' has moved in, but the shelf could not be saved just now. It will be saved with the next change.';
    } else said = 'The basket stays on the step until it is taken back in. ' + friendLabel(ctx.friend?.(b.fromUser)) + ' is not told why.';
    offer = null; cache.mail = null;
    refreshKin(ctx).catch(() => {});
    ctx.back?.();
    ctx.say?.(said);
  } catch (error) {
    // A reply that never came back may still have been a birth; the mail knows.
    if (accept && error.code !== 'shelf_full') { cache.mail = null; refreshKin(ctx).catch(() => {}); }
    if (offer) { offer.busy = false; offer.error = error.code === 'shelf_full' ? FULL_SHELF : kinText(error); offerView(ctx); }
  }
}
registerSocialView('kin-offer', {
  async onClick(action, el, ctx) {
    if (!offer || offer.busy) return;
    const friend = ctx.friend?.(offer.basket.fromUser) || { userId: offer.basket.fromUser, name: offer.basket.fromName };
    if (action === 'reroll') { offer.roll = (offer.roll + 1) % NAME_ROLLS; offerView(ctx); return; }
    if (action === 'accept') return answer(ctx, true);
    if (action === 'decline') return answer(ctx, false);
    if (action === 'block' || action === 'report') { offer.confirm = action; offerView(ctx); return; }
    if (action === 'guard-cancel') { offer.confirm = ''; offerView(ctx); return; }
    try { await guard(action, ctx, friend, () => { offer = null; ctx.back?.(); }); }
    catch (error) { if (offer) { offer.error = kinText(error); offerView(ctx); } }
  }
});

/* ---------------- Letters ---------------- */
let reading = null; // { id, confirm, busy, error }
function keptLetter(ctx, id) { return kinState(ctx.state).letters.find(l => l.id === id) || null; }
function letterView(ctx) {
  const l = keptLetter(ctx, reading.id);
  if (!l) { ctx.back?.(); return; }
  const friend = ctx.friend?.(l.friend) || { userId: l.friend, name: l.shelf };
  const mine = ctx.state.pets.find(p => p.id === l.mine);
  const options = l.dir === 'in' && l.kind === 'weekly' && !l.replied && l.cards
    ? replyOptions({ seed: l.cards.seed, week: l.week, writer: l.cards.reader, reader: l.cards.writer }) : [];
  const html = '<div class="kin-view kin-letter-view" data-kin-view="letter">' +
    '<div class="kin-envelope-wrap">' + envelopeSVG({ seed: l.cards?.seed || 0, traits: l.cards?.writer.traits || [], to: mine?.name || '', open: true }) + '</div>' +
    letterHTML(l) +
    (options.length ? '<h3 class="kin-h">Reply as ' + esc(mine?.name || l.cards.reader.name) + '</h3><div class="kin-replies">' + options.map((o, i) =>
      '<button class="kin-reply" type="button" data-sx="reply" data-sx-id="' + i + '"' + (reading.busy ? ' disabled' : '') + '><small>' + esc(TONE_LABELS[o.tone]) + '</small><span>' + esc(o.line) + '</span></button>').join('') + '</div>'
      : l.replied ? '<p class="kin-hint">Answered. The next letter comes next week.</p>' : '') +
    (reading.error ? '<p class="kin-error" role="alert">' + esc(reading.error) + '</p>' : '') +
    '<div class="fr-actions">' + button('drawer', 'Put it in a drawer', { disabled: reading.busy }) + button('stop', 'Stop these letters', { cls: 'btn-ghost', disabled: reading.busy }) + '</div>' +
    (reading.confirm === 'stop' ? '<div class="fr-confirm kin-guard" role="group" aria-label="Stop these letters"><p><b>Stop these letters?</b> ' + esc(l.theirs) + ' stops writing to ' + esc(mine?.name || 'yours') +
      ', and yours to them. Letters already kept stay on the resident card.</p><div class="fr-actions">' + button('stop-yes', 'Stop the letters', { cls: 'fr-warn' }) + button('guard-cancel', 'Cancel', { cls: 'btn-ghost' }) + '</div></div>' : '') +
    guardButtons(friend) + (reading.confirm !== 'stop' ? guardHTML(reading.confirm, friend) : '') + '</div>';
  ctx.show({ id: 'kin-letter', kicker: 'From ' + l.theirs + ', of ' + shelfLabel(friend.name || l.shelf), title: 'A letter for ' + (mine?.name || 'one of yours'), html, back: reading.back || 'postbox' });
}
export function openLetter(id, ctx, back = 'postbox') {
  const l = keptLetter(ctx, id);
  if (!l) { ctx.say?.('That letter has gone astray.'); return; }
  reading = { id, confirm: '', busy: false, error: '', back };
  if (!l.read) {
    l.read = true;
    ctx.save?.();
    kinFor(ctx)?.read(id).catch(() => { /* read again next time; nothing is lost */ });
  }
  letterView(ctx);
  ctx.refresh?.();
}
registerSocialView('kin-letter', {
  async onClick(action, el, ctx) {
    if (!reading || reading.busy) return;
    const l = keptLetter(ctx, reading.id);
    if (!l) return;
    const friend = ctx.friend?.(l.friend) || { userId: l.friend, name: l.shelf };
    if (action === 'drawer') { reading = null; ctx.back?.(); ctx.say?.('Put away. It is on the resident card, under Correspondence.'); return; }
    if (action === 'stop' || action === 'block' || action === 'report') { reading.confirm = action; letterView(ctx); return; }
    if (action === 'guard-cancel') { reading.confirm = ''; letterView(ctx); return; }
    reading.busy = true; reading.error = ''; letterView(ctx);
    try {
      if (action === 'reply') {
        const choice = Number(el.dataset.sxId);
        const option = replyOptions({ seed: l.cards.seed, week: l.week, writer: l.cards.reader, reader: l.cards.writer })[choice];
        const sent = await kinFor(ctx).reply(l.id, choice);
        l.replied = true;
        kinState(ctx.state).letters.push({ id: sent.id, pal: l.pal, week: l.week, at: Date.now(), dir: 'out', kind: 'reply', mine: l.mine, theirs: l.theirs,
          friend: l.friend, shelf: l.shelf, text: option.text, read: true, replied: false });
        trimLetters(kinState(ctx.state));
        ctx.save?.();
        reading = null; ctx.back?.();
        ctx.say?.('Sent. ' + l.theirs + ' will have it by the next post.');
        return;
      }
      if (action === 'stop-yes') {
        await kinFor(ctx).end(l.pal);
        cache.mail = null;
        reading = null; ctx.back?.();
        ctx.say?.('Stopped. The letters already kept stay on the resident card.');
        return;
      }
      if (!(await guard(action, ctx, friend, () => { reading = null; ctx.back?.(); }))) { reading.busy = false; letterView(ctx); }
    } catch (error) {
      if (reading) { reading.busy = false; reading.error = kinText(error); letterView(ctx); }
    }
  }
});

/* ---------------- A correspondence, and introductions ---------------- */
let palView = null; // { palId, friend }
function palMarkup(ctx) {
  const pal = mailFor(ctx)?.pals.find(p => p.id === palView.palId);
  const letters = kinState(ctx.state).letters.filter(l => l.pal === palView.palId).slice().reverse();
  const mine = ctx.state.pets.find(p => p.id === pal?.mine.id);
  const html = '<div class="kin-view" data-kin-view="pal">' +
    (pal ? '<p class="kin-lede">' + esc((mine?.name || pal.mine.name) + ' and ' + (pal.theirs.name || 'theirs') + '. ' + (HISTORY_LABELS[pal.history] || '') + '.') + '</p>' : '') +
    (letters.length ? '<ol class="kin-kept-list">' + letters.map(l => '<li class="kin-kept" data-dir="' + l.dir + '"><p class="kin-kept-meta">' + esc((l.dir === 'in' ? 'From ' : 'To ') + l.theirs) + '</p>' +
      letterHTML(l, { compact: true }) + (l.dir === 'in' && l.kind === 'weekly' && !l.replied && l.cards ? button('open-letter', 'Reply', { id: l.id, cls: 'btn-sm' }) : '') + '</li>').join('') + '</ol>'
      : '<p class="kin-empty">No letters yet. The first arrives with the next post.</p>') + '</div>';
  ctx.show({ id: 'kin-pal', kicker: 'Pen pals', title: pal ? (mine?.name || pal.mine.name) + ' and ' + (pal.theirs.name || 'theirs') : 'Correspondence', html, back: 'friend:' + palView.friend.userId });
}
registerSocialView('kin-pal', {
  onClick(action, el, ctx) { if (action === 'open-letter') openLetter(el.dataset.sxId, ctx, 'friend:' + palView.friend.userId); }
});

let intro = null; // { friend, theirs, mine, their, error, busy }
function introView(ctx) {
  const f = intro.friend, who = esc(friendLabel(f));
  const mine = ctx.state.pets.map(p => ({ id: p.id, name: p.name, art: p.art }));
  const html = '<div class="kin-view" data-kin-view="introduce"><p class="kin-lede">Two residents with history write to each other once a week. A hearing in Shelf Court counts, and so does a week of being friends.</p>' +
    '<h3 class="kin-h">Yours</h3>' + picker(mine, intro.mine, 'pick-mine', 'Nobody on your shelf yet.') +
    '<h3 class="kin-h">' + who + '’s</h3>' + (intro.theirs === null ? '<p class="kin-empty">Wiping their doormat.</p>' : picker(intro.theirs, intro.their, 'pick-theirs', 'Nothing on show on their shelf yet.')) +
    (intro.error ? '<p class="kin-error" role="alert">' + esc(intro.error) + '</p>' : '') +
    '<div class="fr-actions">' + button('introduce', 'Introduce them', { cls: 'btn-primary', disabled: !intro.mine || !intro.their || intro.busy }) + '</div></div>';
  ctx.show({ id: 'kin-introduce', kicker: 'Pen pals', title: 'Introduce two residents', html, back: 'friend:' + f.userId });
}
async function openIntro(friend, ctx) {
  intro = { friend, theirs: null, mine: ctx.state.pets[0]?.id || '', their: '', error: '', busy: false };
  introView(ctx);
  const token = intro;
  const shelf = await ctx.social.shelf(friend.userId).catch(error => ({ error }));
  if (intro !== token) return;
  if (shelf?.error) intro.error = kinText(shelf.error);
  intro.theirs = shelf?.shelf?.residents || [];
  introView(ctx);
}
registerSocialView('kin-introduce', {
  async onClick(action, el, ctx) {
    if (!intro || intro.busy) return;
    if (action === 'pick-mine') { intro.mine = el.dataset.sxId; introView(ctx); return; }
    if (action === 'pick-theirs') { intro.their = el.dataset.sxId; introView(ctx); return; }
    if (action !== 'introduce') return;
    intro.busy = true; intro.error = ''; introView(ctx);
    try {
      await kinFor(ctx).introduce({ to: intro.friend.userId, mine: intro.mine, theirs: intro.their });
      intro = null; cache.mail = null;
      refreshKin(ctx).catch(() => {});
      ctx.back?.();
      ctx.say?.('Introduced. The first letters go out with the next post.');
    } catch (error) { intro.busy = false; intro.error = kinText(error); introView(ctx); }
  }
});

/* ---------------- the Kin section on a friend's profile ---------------- */
registerFriendsSection({
  id: 'kin', where: 'friend', order: 40,
  render(ctx, friend) {
    const state = ctx.state, kin = kinState(state);
    const shared = kin.foundlings.filter(f => f.parents.some(p => !p.home && p.friend === friend.userId));
    const pals = (mailFor(ctx)?.pals || []).filter(p => p.friend === friend.userId);
    const foundlings = shared.map(f => {
      const pet = state.pets.find(p => p.id === f.pet);
      return '<li class="kin-line"><span class="kin-line-art">' + portraitHTML(pet?.art || null) + '</span><span><b>' + esc(pet?.name || f.name) + '</b><small>' +
        esc(foundOnStep(state, f)) + '</small></span>' + (pet ? button('meet', 'Meet', { id: pet.id, cls: 'btn-sm' }) : '') + '</li>';
    }).join('');
    const letters = pals.map(p => {
      const mine = state.pets.find(x => x.id === p.mine.id);
      const unread = kin.letters.filter(l => l.pal === p.id && l.dir === 'in' && !l.read).length;
      return '<li class="kin-line"><span><b>' + esc((mine?.name || p.mine.name || 'Yours') + ' writes to ' + (p.theirs.name || 'theirs')) + '</b><small>' + esc(HISTORY_LABELS[p.history] || '') +
        (unread ? ', ' + plural(unread, 'letter unopened', 'letters unopened') : '') + '</small></span>' + button('pal', 'Letters', { id: p.id, cls: 'btn-sm' }) + '</li>';
    }).join('');
    return '<section class="kin-section" data-kin-section aria-labelledby="kinTitle-' + esc(friend.userId) + '"><h3 id="kinTitle-' + esc(friend.userId) + '">Kin</h3>' +
      (foundlings ? '<h4 class="kin-h">Foundlings</h4><ul class="kin-lines">' + foundlings + '</ul>' : '') +
      (letters ? '<h4 class="kin-h">Pen pals</h4><ul class="kin-lines">' + letters + '</ul>' : '') +
      (!foundlings && !letters ? '<p class="kin-empty">No kin between your shelves yet. Leave a basket out, or introduce two residents to each other.</p>' : '') +
      '<div class="fr-actions">' + button('kin-basket', 'Leave a basket out', { cls: 'btn-sm' }) + button('kin-introduce', 'Introduce two residents', { cls: 'btn-sm' }) + '</div></section>';
  },
  onClick(action, el, ctx, friend) {
    if (action === 'meet') { window.dispatchEvent(new CustomEvent('shelflife:care', { detail: { petId: el.dataset.sxId } })); return; }
    if (action === 'pal') { palView = { palId: el.dataset.sxId, friend }; palMarkup(ctx); return; }
    if (action === 'kin-basket') return openBasket(friend, ctx);
    if (action === 'kin-introduce') return openIntro(friend, ctx);
  }
});

/* ---------------- the postbox ---------------- */
registerPostboxSource({
  id: 'kin-baskets', order: 30, label: 'Baskets', poll: true,
  count(ctx) { return (mailFor(ctx)?.baskets || []).filter(b => b.direction === 'in' && b.status === 'offered').length; },
  async load(ctx) {
    const mail = await refreshKin(ctx);
    return (mail?.baskets || []).filter(b => b.status !== 'born').map(b => ({ id: b.id, at: b.createdAt,
      title: b.direction === 'in' ? friendLabel(ctx.friend?.(b.fromUser) || { name: b.fromName }) + ' left a basket on your step' : 'A basket on ' + shelfLabel(b.toName).replace(' shelf', ' step'),
      line: '', basket: b }));
  },
  render(item, ctx) {
    const b = item.basket;
    if (b.direction === 'in') {
      return '<div class="kin-row" data-kin-basket="' + esc(b.id) + '"><span class="kin-row-art">' + portraitHTML(b.fromParent.art) + '</span><div class="kin-row-text"><b>' + esc(item.title) + '.</b><p>' +
        esc(b.fromParent.name + ', of ' + shelfLabel(ctx.friend?.(b.fromUser)?.name || b.fromName) + ', and your ' + b.toParentName + '. ' + timeLeft(b.expiresAt)) + '</p></div>' +
        '<div class="kin-row-actions">' + button('open', 'Look inside', { id: b.id, cls: 'btn-sm btn-primary' }) + button('decline', 'Leave it', { id: b.id, cls: 'btn-sm' }) +
        button('block', 'Block', { id: b.id, cls: 'btn-sm btn-ghost fr-warn' }) + button('report', 'Report', { id: b.id, cls: 'btn-sm btn-ghost fr-warn' }) + '</div></div>';
    }
    const waiting = b.status === 'offered';
    return '<div class="kin-row kin-row-quiet" data-kin-basket="' + esc(b.id) + '"><div class="kin-row-text"><b>' + esc(waiting ? 'Your basket is on ' + shelfLabel(b.toName).replace(' shelf', ' step') + '.' : 'Your basket was brought back in.') + '</b><p>' +
      esc(waiting ? b.fromParent.name + ' and ' + b.toParentName + '. ' + timeLeft(b.expiresAt) : 'Nobody has said anything. Nobody ever does.') + '</p></div>' +
      (waiting ? '<div class="kin-row-actions">' + button('withdraw', 'Take it back', { id: b.id, cls: 'btn-sm' }) + '</div>' : '') + '</div>';
  },
  async onClick(action, id, ctx) {
    const b = mailFor(ctx)?.baskets.find(x => x.id === id);
    if (!b) return;
    const friend = ctx.friend?.(b.fromUser) || { userId: b.fromUser, name: b.fromName };
    try {
      if (action === 'open') return openOffer(id, ctx);
      if (action === 'decline') { await kinFor(ctx).answerBasket(id, { accept: false }); ctx.say?.('Left on the step. ' + friendLabel(friend) + ' is not told why.'); }
      if (action === 'withdraw') { await kinFor(ctx).withdraw(id); ctx.say?.('Taken back in. Nobody saw.'); }
      if (action === 'block' || action === 'report') {
        offer = { basket: b, snapshot: null, parent: { name: b.toParentName }, plan: null, roll: 0, busy: false, error: '', confirm: action };
        const pet = ctx.state.pets.find(p => p.id === b.toParentId);
        if (pet) { offer.snapshot = parentSnapshot(pet); offer.parent = readResident(offer.snapshot); }
        offerView(ctx);
        if (pet) realizeFoundling({ a: b.fromParent, b: offer.parent, seed: b.seed }).then(plan => { if (offer?.basket === b) { offer.plan = plan; offerView(ctx); } });
        return;
      }
      cache.mail = null;
      await refreshKin(ctx);
      ctx.refresh?.();
    } catch (error) { ctx.say?.(kinText(error)); }
  }
});

registerPostboxSource({
  id: 'kin-births', order: 31, label: 'Births', poll: true,
  count(ctx) { const kin = kinState(ctx.state); return kin.notices.length + kin.step.length + (mailFor(ctx)?.waiting ? 1 : 0); },
  async load(ctx) {
    await refreshKin(ctx).catch(() => null);
    const kin = kinState(ctx.state), waiting = mailFor(ctx)?.waiting || 0;
    return [
      ...(waiting ? [{ id: 'kin-waiting', at: Date.now(), title: 'More foundlings are waiting', line: '', waiting }] : []),
      ...kin.step.map(s => ({ id: s.basket, at: s.at, title: 'A foundling is waiting on the step', line: s.note, step: s })),
      ...kin.notices.map(n => ({ id: n.basket, at: n.at, title: 'Found on the step', line: n.text, notice: n }))
    ];
  },
  render(item, ctx) {
    if (item.waiting) {
      return '<div class="kin-row kin-row-quiet" data-kin-waiting><div class="kin-row-text"><b>' + esc(plural(item.waiting, 'more foundling is', 'more foundlings are') + ' waiting at the door.') + '</b><p>' +
        esc('There is no room on the shelf or the step. Take one in, or make some room, and the next comes in.') + '</p></div></div>';
    }
    if (item.step) {
      const room = hasRoom(ctx.state);
      return '<div class="kin-row" data-kin-step="' + esc(item.id) + '"><span class="kin-row-art">' + portraitHTML(item.step.pet.art) + '</span><div class="kin-row-text"><b>' + esc(item.step.pet.name + ' is waiting on the step.') + '</b><p>' +
        esc(room ? 'There is room on the shelf now.' : 'There is no room on the shelf. It will wait, wrapped in a tea towel, for as long as it takes.') + '</p></div>' +
        '<div class="kin-row-actions">' + button('take', 'Take it in', { id: item.id, cls: 'btn-sm btn-primary', disabled: !room }) + '</div></div>';
    }
    const pet = ctx.state.pets.find(p => p.id === item.notice.pet);
    return '<div class="kin-row" data-kin-notice="' + esc(item.id) + '"><span class="kin-row-art">' + portraitHTML(pet?.art || null) + '</span><div class="kin-row-text"><b>' + esc((pet?.name || 'A foundling') + ' was found on the step.') + '</b><p>' +
      esc(item.line) + '</p></div><div class="kin-row-actions">' + (pet ? button('meet', 'Meet ' + esc(pet.name), { id: item.id, cls: 'btn-sm btn-primary' }) : '') + button('dismiss', 'Dismiss', { id: item.id, cls: 'btn-sm' }) + '</div></div>';
  },
  onClick(action, id, ctx) {
    const kin = kinState(ctx.state);
    if (action === 'take') {
      const where = takeInFromStep(ctx.state, id);
      ctx.say?.(where === 'full' ? FULL_SHELF : where === 'adopted' ? 'Taken in. It went straight for the warm spot.' : 'Already in.');
      ctx.save?.(); ctx.renderAll?.(); ctx.refresh?.();
      return;
    }
    const notice = kin.notices.find(n => n.basket === id);
    kin.notices = kin.notices.filter(n => n.basket !== id);
    ctx.save?.(); ctx.refresh?.();
    if (action === 'meet' && notice) window.dispatchEvent(new CustomEvent('shelflife:care', { detail: { petId: notice.pet } }));
  }
});

registerPostboxSource({
  id: 'kin-letters', order: 32, label: 'Letters', poll: true,
  count(ctx) { return kinState(ctx.state).letters.filter(l => l.dir === 'in' && !l.read).length; },
  async load(ctx) {
    await refreshKin(ctx).catch(() => null);
    return kinState(ctx.state).letters.filter(l => l.dir === 'in' && !l.read).map(l => ({ id: l.id, at: l.at, title: 'A letter from ' + l.theirs, line: '', letter: l }));
  },
  render(item, ctx) {
    const l = item.letter, mine = ctx.state.pets.find(p => p.id === l.mine);
    return '<div class="kin-row kin-row-letter" data-kin-letter-row="' + esc(l.id) + '"><span class="kin-row-art kin-row-envelope">' + envelopeSVG({ seed: l.cards?.seed || 0, traits: l.cards?.writer.traits || [] }) + '</span>' +
      '<div class="kin-row-text"><b>' + esc((l.kind === 'reply' ? 'A reply for ' : 'A letter for ') + (mine?.name || 'one of yours') + '.') + '</b><p>' + esc('From ' + l.theirs + ', of ' + shelfLabel(ctx.friend?.(l.friend)?.name || l.shelf) + '.') + '</p></div>' +
      '<div class="kin-row-actions">' + button('open', 'Open', { id: l.id, cls: 'btn-sm btn-primary' }) + '</div></div>';
  },
  onClick(action, id, ctx) { if (action === 'open') openLetter(id, ctx); }
});

// For tests and the hub's own checks.
export const kinDebug = { cache, kinFor, mailFor };
