// Kin over the cloud session: baskets, foundlings, pen pals and letters. The
// schema is supabase/migrations/0010_kin.sql.
//
// Built on cloud.rpc the way social.js is: signed out or offline it refuses
// politely, and every reply goes through a reader before the game sees it.
// Parents are rebuilt by social.js readResident (known parts, PNGs under
// 120 KB), letter cards keep only a clamped name, known traits and a mood,
// and lists are capped. Letters carry no text: devices write them.
import { readResident, residentSnapshot, cleanText, cleanUuid, socialCode, socialText, MAX_SUMMONS_CHARS, MOODS } from './social.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { CloudError } from './client.js';
import { HISTORY_KINDS } from '../engine/kin-letters.js';

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const CASE_ID = /^[a-z0-9-]{1,40}$/;
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value) ? value : '';
const time = value => { const t = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(t) && t > 0 ? t : 0; };
const seedOf = value => Number.isInteger(value) && value >= 0 && value <= 2147483647 ? value : null;
const weekOf = value => Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null;
export const BASKET_HOURS = 48;
export const BASKET_GAP_DAYS = 14;

/* ---------------- refusals, as the player reads them ---------------- */
const TEXT = {
  do_not_disturb: 'They have asked not to be disturbed for now. Try again later.',
  bad_basket: 'That basket could not be left. Nothing was changed.',
  no_history: 'Those two have no history yet. A hearing in Shelf Court counts, or a week of being friends.',
  basket_waiting: 'There is already a basket on a step between you. It keeps for 48 hours.',
  too_soon: 'One foundling per pair of friends every 14 days. The last one is still settling in.',
  not_open: 'That basket has already been answered.',
  expired: 'That basket waited 48 hours and was taken back in.',
  shelf_full: 'Your shelf is full. Rehome someone or put furniture away first.',
  bad_reply: 'That reply could not be sent.',
  already_replied: 'You have already answered that letter.',
  too_many_pals: 'They have as many pen pals as they can manage.',
  stopped: 'Those two have stopped writing. It was mutual, officially.',
  not_found: 'That is no longer there.',
  not_friends: 'You are not friends with them any more.',
  rate_limited: 'That is a lot of baskets for one day. Try again tomorrow.'
};
const TOKENS = new Set(Object.keys(TEXT));
export function kinCode(error) {
  if (!error) return 'unexpected';
  if (error.offline) return 'offline';
  if (TOKENS.has(error.code)) return error.code;
  if (error.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  return socialCode(error);
}
const copyFor = code => TEXT[code] || socialText({ code, offline: code === 'offline' });
export const kinText = error => copyFor(kinCode(error));
const refuse = (code, status = 0) => new CloudError(copyFor(code), { code, status, offline: code === 'offline' });

/* ---------------- readers ---------------- */
export function readCard(raw) {
  if (!record(raw) || !petId(raw.id)) return null;
  const traits = Array.isArray(raw.traits) ? [...new Set(raw.traits.filter(t => typeof t === 'string' && Object.hasOwn(TRAIT_BY_ID, t)))].slice(0, 6) : [];
  return { id: raw.id, name: cleanText(raw.name, 22) || 'Someone', traits, mood: MOODS.includes(raw.mood) ? raw.mood : 'fine' };
}
const STATUSES = ['offered', 'born', 'returned'];
export function readBasket(raw, me) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user), toUser = cleanUuid(raw.to_user);
  if (!id || !fromUser || !toUser || fromUser === toUser || !STATUSES.includes(raw.status) || !['in', 'out'].includes(raw.direction)) return null;
  if ((raw.direction === 'in') !== (toUser === me)) return null;
  const toParentId = petId(raw.to_parent_id);
  if (!toParentId) return null;
  const full = raw.status === 'born' || (raw.direction === 'in' && raw.status === 'offered');
  const fromParent = readResident(raw.from_parent, { art: full });
  const toParent = raw.status === 'born' ? readResident(raw.to_parent) : null;
  if (!fromParent || (raw.status === 'born' && (!toParent || toParent.id !== toParentId))) return null;
  const seed = seedOf(raw.seed);
  if (full && seed === null) return null;
  return {
    id, direction: raw.direction, status: raw.status, fromUser, toUser, friend: raw.direction === 'in' ? fromUser : toUser,
    fromName: cleanText(raw.from_name, 24), toName: cleanText(raw.to_name, 24),
    fromParent, toParentId, toParentName: cleanText(raw.to_parent_name, 22) || 'Someone', toParent,
    seed: full ? seed : null, nameRoll: Number.isInteger(raw.name_roll) && raw.name_roll >= 0 && raw.name_roll < 50 ? raw.name_roll : 0,
    history: typeof raw.history === 'string' ? raw.history : '', createdAt: time(raw.created_at), expiresAt: time(raw.expires_at),
    answeredAt: time(raw.answered_at), collected: raw.collected === true
  };
}
export function readPal(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), friend = cleanUuid(raw.friend);
  const side = value => record(value) && petId(value.id) ? { id: value.id, name: cleanText(value.name, 22) || '' } : null;
  const mine = side(raw.mine), theirs = side(raw.theirs);
  const history = HISTORY_KINDS.includes(raw.history) ? raw.history : '';
  const seed = seedOf(raw.seed);
  if (!id || !friend || !mine || !theirs || !history || seed === null) return null;
  return { id, friend, mine, theirs, history, caseId: typeof raw.case_id === 'string' && CASE_ID.test(raw.case_id) ? raw.case_id : '',
    basket: cleanUuid(raw.basket_id), seed, createdAt: time(raw.created_at) };
}
export function readLetter(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), pal = cleanUuid(raw.pal_id), from = cleanUuid(raw.from_user), week = weekOf(raw.week);
  const writer = readCard(raw.writer), reader = readCard(raw.reader);
  if (!id || !pal || !from || week === null || !writer || !reader || !['weekly', 'reply'].includes(raw.kind)) return null;
  const reply = raw.kind === 'reply';
  if (reply && !(Number.isInteger(raw.choice) && raw.choice >= 0 && raw.choice <= 2 && cleanUuid(raw.reply_to))) return null;
  return { id, pal, from, kind: raw.kind, week, replyTo: reply ? cleanUuid(raw.reply_to) : '', choice: reply ? raw.choice : null, writer, reader, createdAt: time(raw.created_at) };
}
export function readKinFriend(raw) {
  if (!record(raw)) return null;
  const userId = cleanUuid(raw.user_id);
  if (!userId) return null;
  const hearings = (Array.isArray(raw.hearings) ? raw.hearings.slice(0, 12) : [])
    .filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(petId)).map(pair => [pair[0], pair[1]]);
  return { userId, since: time(raw.since), weekOld: raw.week_old === true, openBasket: raw.open_basket === true, nextBasketAt: time(raw.next_basket_at), hearings };
}
const list = (rows, read, max) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows.slice(0, max) : []).map(read).filter(x => x && !seen.has(x.id || x.userId) && seen.add(x.id || x.userId));
};
export function readKinMail(raw, me) {
  const r = record(raw) ? raw : {};
  return {
    now: time(r.now), week: weekOf(r.week),
    baskets: list(r.baskets, b => readBasket(b, me), 12),
    pals: list(r.pals, readPal, 60),
    letters: list(r.letters, readLetter, 30),
    friends: list(r.friends, readKinFriend, 200)
  };
}

// The resident that travels in a basket: with its drawing when that fits.
export function parentSnapshot(pet) {
  let snap = residentSnapshot(pet);
  if (JSON.stringify(snap).length > MAX_SUMMONS_CHARS) snap = residentSnapshot(pet, { image: false });
  return snap;
}

/* ---------------- the wrappers ---------------- */
export function createKin({ cloud }) {
  const signedIn = () => !!cloud?.configured && cloud.signedIn();
  async function call(name, args) {
    if (!signedIn()) throw refuse('signed_out', 401);
    try { return await cloud.rpc(name, args); }
    catch (error) { throw refuse(kinCode(error), error?.status || 0); }
  }
  const uuid = value => { const id = cleanUuid(value); if (!id) throw refuse('not_found'); return id; };
  const ok = r => { if (!record(r) || r.ok !== true) throw refuse('unexpected'); return r; };

  async function mail() {
    const uid = cloud?.userId?.();
    const raw = await call('kin_mail', {});
    if (!signedIn() || cloud.userId() !== uid) throw refuse('signed_out', 401);
    return { user: uid, ...readKinMail(raw, uid) };
  }
  async function leaveBasket({ to, pet, theirs }) {
    if (!pet || !petId(pet.id) || !petId(theirs)) throw refuse('bad_basket');
    const r = ok(await call('kin_leave_basket', { p_to: uuid(to), p_parent: parentSnapshot(pet), p_theirs: theirs }));
    return { id: uuid(r.id), expiresAt: time(r.expires_at) };
  }
  // `parent` is the snapshot the preview was made from, so both shelves blend the same thing.
  async function answerBasket(id, { accept, parent = null, nameRoll = 0 }) {
    if (accept && (!record(parent) || !petId(parent.id))) throw refuse('bad_basket');
    const r = ok(await call('kin_answer_basket', { p_id: uuid(id), p_accept: !!accept, p_parent: accept ? parent : null,
      p_name_roll: Math.max(0, Math.min(49, Math.floor(Number(nameRoll) || 0))) }));
    return { status: r.status === 'born' ? 'born' : 'declined', seed: seedOf(r.seed), nameRoll: Number.isInteger(r.name_roll) ? r.name_roll : 0, answeredAt: time(r.answered_at) };
  }
  const withdraw = async id => { ok(await call('kin_withdraw_basket', { p_id: uuid(id) })); return true; };
  const collect = async id => { ok(await call('kin_collect', { p_id: uuid(id) })); return true; };
  async function introduce({ to, mine, theirs }) {
    if (!petId(mine) || !petId(theirs)) throw refuse('not_found');
    const r = ok(await call('kin_introduce', { p_friend: uuid(to), p_mine: mine, p_theirs: theirs }));
    return { id: uuid(r.id) };
  }
  const end = async palId => { ok(await call('kin_end', { p_pal: uuid(palId) })); return true; };
  async function reply(letterId, choice) {
    if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw refuse('bad_reply');
    const r = ok(await call('kin_reply', { p_letter: uuid(letterId), p_choice: choice }));
    return { id: uuid(r.id) };
  }
  const read = async letterId => { const r = await call('kin_read', { p_id: uuid(letterId) }); return r?.ok === true; };

  return { signedIn, userId: () => signedIn() ? cloud.userId() : null, mail, leaveBasket, answerBasket, withdraw, collect, introduce, end, reply, read };
}
