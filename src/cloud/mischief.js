// Mischief over the one cloud session: hexes, hauntings, neighbourly help and
// trick-or-treat. The schema is supabase/migrations/0007_mischief.sql.
//
// As in social.js, the server decides who may do what and every reply goes
// through a reader before the game touches it: ids are checked, text is
// clamped, cards must be ones this edition knows, and a resident is rebuilt
// from known parts and kept small enough to sit in the save.
//
// Nothing here runs by itself, and nothing is sent until the player has opened
// Friends on this account (social.active()).
import { cleanText, cleanUuid, readResident, residentSnapshot, socialCode, socialText } from './social.js';
import { CloudError } from './client.js';
import { HEX_BY_ID, TRICK_BY_ID, BOWL_BY_ID, HELP_NEEDS } from '../content/mischief.js';

// A friend's resident kept in the save (a culprit or a ghost) stays under this.
export const MAX_GUEST_CHARS = 64 * 1024;
const HOUR = 3600000;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const int = (value, lo, hi, fallback = lo) => Number.isInteger(value) ? Math.max(lo, Math.min(hi, value)) : fallback;
const time = value => { const t = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(t) && t > 0 ? t : 0; };
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const list = (rows, max, read) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows.slice(0, max) : []).map(read).filter(x => x && !seen.has(x.id) && seen.add(x.id));
};

/* ---------------- readers ---------------- */

// A friend's resident, small: its choices of art rather than the derived rig,
// and a drawing only while it fits under MAX_GUEST_CHARS.
export function compactGuest(raw) {
  const r = readResident(raw);
  if (!r) return null;
  const pet = { id: r.id, name: r.name, traits: r.traits, bond: r.bond, art: r.art || {} };
  let snap = residentSnapshot(pet);
  if (JSON.stringify(snap).length > MAX_GUEST_CHARS) snap = residentSnapshot(pet, { image: false });
  return { ...snap, mood: r.mood };
}

export function readHex(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user), culprit = compactGuest(raw.culprit);
  const createdAt = time(raw.created_at);
  if (!id || !fromUser || !HEX_BY_ID[raw.card] || !culprit || !createdAt) return null;
  // Never longer than the 48 hours the server allows, whatever it says.
  const expiresAt = Math.min(time(raw.expires_at) || createdAt + 48 * HOUR, createdAt + 48 * HOUR);
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), card: raw.card, culprit, createdAt, expiresAt, rebound: raw.rebound === true };
}
export function readHaunt(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user), ghost = compactGuest(raw.ghost), createdAt = time(raw.created_at);
  if (!id || !fromUser || !ghost || !createdAt) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), ghost, createdAt, endsAt: Math.min(time(raw.ends_at) || createdAt + 24 * HOUR, createdAt + 24 * HOUR) };
}
export function readHelp(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user);
  if (!id || !fromUser || !petId(raw.resident_id) || !HELP_NEEDS.includes(raw.need)) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), residentId: raw.resident_id, residentName: cleanText(raw.resident_name, 22),
    need: raw.need, amount: int(raw.amount, 1, 30, 25), createdAt: time(raw.created_at) };
}
export function readHexResult(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), toUser = cleanUuid(raw.to_user);
  if (!id || !toUser || !['resolved', 'declined', 'expired'].includes(raw.status)) return null;
  return { id, toUser, toName: cleanText(raw.to_name, 24), card: HEX_BY_ID[raw.card] ? raw.card : '', culpritId: petId(raw.culprit_id) ? raw.culprit_id : '',
    culpritName: cleanText(raw.culprit_name, 22) || 'Your resident', status: raw.status,
    choice: Number.isInteger(raw.choice) && raw.choice >= 0 && raw.choice <= 3 ? raw.choice : null,
    outcome: Number.isInteger(raw.outcome) && raw.outcome >= 0 && raw.outcome <= 3 ? raw.outcome : null,
    rebound: raw.rebound === true, at: time(raw.at) };
}
export function readHauntResult(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), toUser = cleanUuid(raw.to_user);
  if (!id || !toUser || !['shooed', 'ended'].includes(raw.status)) return null;
  return { id, toUser, toName: cleanText(raw.to_name, 24), ghostName: cleanText(raw.ghost_name, 22) || 'Your resident', status: raw.status,
    taps: int(raw.taps, 0, 99, 0), at: time(raw.at) };
}
function readKnockRow(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user);
  if (!id || !fromUser || !['treat', 'trick'].includes(raw.result)) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), result: raw.result, at: time(raw.created_at) };
}
const uuids = rows => [...new Set((Array.isArray(rows) ? rows.slice(0, 200) : []).map(cleanUuid).filter(Boolean))];
export function readStatus(raw) {
  const r = record(raw) ? raw : {};
  return {
    day: typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : '', now: time(r.now),
    hand: [...new Set((Array.isArray(r.hand) ? r.hand.slice(0, 3) : []).filter(c => typeof c === 'string' && HEX_BY_ID[c]))],
    hexedToday: r.hexed_today === true, hauntReady: r.haunt_ready === true, hauntNextAt: time(r.haunt_next_at),
    helped: uuids(r.helped), helpsGiven: int(r.helps_given, 0, 99, 0), knocked: uuids(r.knocked), season: r.season === true,
    rebounds: list(r.rebounds, 20, x => {
      if (!record(x)) return null;
      const id = cleanUuid(x.id), toUser = cleanUuid(x.to_user);
      return id && toUser ? { id, toUser, card: HEX_BY_ID[x.card] ? x.card : '' } : null;
    })
  };
}
export function readMischiefInbox(raw) {
  const r = record(raw) ? raw : {};
  const door = record(r.doorstep) ? r.doorstep : {};
  return {
    status: readStatus(r.status),
    hexes: list(r.hexes, 5, readHex), hauntings: list(r.hauntings, 3, readHaunt), helps: list(r.helps, 10, readHelp),
    results: list(r.results, 20, readHexResult), hauntResults: list(r.haunt_results, 10, readHauntResult),
    doorstep: { bowl: BOWL_BY_ID[door.bowl] ? door.bowl : 'none', count: int(door.count, 0, 999, 0), knocks: list(door.knocks, 30, readKnockRow) }
  };
}
export function readKnockResult(raw) {
  if (!record(raw) || !['treat', 'trick'].includes(raw.result)) return null;
  const prize = raw.result === 'trick' ? (TRICK_BY_ID[raw.prize] ? raw.prize : '') : (['souls', 'curio'].includes(raw.prize) ? raw.prize : '');
  if (!prize) return null;
  return { id: cleanUuid(raw.id), result: raw.result, prize, souls: raw.result === 'treat' && prize === 'souls' ? int(raw.souls, 0, 30, 0) : 0,
    bowl: BOWL_BY_ID[raw.bowl] ? raw.bowl : 'none', culprit: raw.result === 'trick' && raw.culprit ? compactGuest(raw.culprit) : null };
}

/* ---------------- refusals, as the player reads them ---------------- */

const TEXT = {
  dnd: 'They have Do not disturb on. Mischief can wait.',
  bad_card: 'That card is not in this edition’s deck. Nothing was sent.',
  bad_culprit: 'That resident is not on your shelf as friends see it. Open Friends again, then try.',
  not_in_hand: 'That card is not in today’s hand. The deck noticed.',
  hexed_today: 'One hex a day, and today’s has gone. A fresh hand comes tomorrow.',
  no_rebound: 'That rebound has been used, or has gone stale.',
  shelf_full: 'Their shelf already has two hexes waiting. Let them suffer at their own pace.',
  not_found: 'That has gone. Someone dealt with it already.',
  not_open: 'That has already been dealt with.',
  expired: 'Too late. It expired.',
  bad_hex: 'That did not go through. Nothing was changed.',
  haunted_this_week: 'One haunting a week. Your ghosts are resting. They say they are not.',
  already_haunted: 'Their shelf is already haunted. Ghosts do not share.',
  bad_need: 'That did not go through. Nothing was changed.',
  not_needed: 'That resident does not need it any more. It says so, firmly.',
  helped_today: 'You have already helped on their shelf today.',
  resident_helped: 'Someone has already helped that resident today.',
  helps_full: 'Their shelf has had three helpers today. It is starting to feel watched.',
  helped_enough: 'You have helped five shelves today. Go home.',
  bad_help: 'That did not go through. Nothing was changed.',
  out_of_season: 'Knocking is for the Thin Season only. The street is closed.',
  knocked_tonight: 'You have knocked there tonight. Twice is a siege.',
  rate_limited: 'That is a lot of mischief. Try again later.',
  bad_bowl: 'That bowl is not one this edition knows.',
  bad_kind: 'That did not go through. Nothing was changed.',
  too_large: 'That resident is too large to send. Drawn residents take the most room.'
};
const TOKENS = new Set(Object.keys(TEXT));
export function mischiefCode(error) {
  if (!error) return 'unexpected';
  if (error.offline) return 'offline';
  if (TOKENS.has(error.code)) return error.code;
  if (error.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  return socialCode(error);
}
const words = code => TEXT[code] || socialText({ code, offline: code === 'offline' });
export const mischiefText = error => words(mischiefCode(error));
const refuse = (code, status = 0) => new CloudError(words(code), { code, status, offline: code === 'offline' });
// Refusals that mean "this will never go through", so an outbox can drop it.
export const FINAL = new Set(['not_found', 'not_open', 'expired', 'bad_hex', 'not_friends', 'bad_kind', 'bad_help']);

/* ---------------- the wrappers ---------------- */

export function createMischief({ cloud, social, now = Date.now } = {}) {
  const listeners = new Set();
  let cache = null, cacheUser = null, inflight = null;
  const signedIn = () => !!social?.signedIn?.();
  const active = () => !!social?.active?.();
  function emit() { listeners.forEach(fn => { try { fn(); } catch { /* the UI's problem */ } }); }

  async function call(name, args) {
    if (!signedIn()) throw refuse('signed_out', 401);
    try { return await cloud.rpc(name, args); }
    catch (error) {
      const code = mischiefCode(error);
      throw refuse(code, error?.status || 0);
    }
  }
  const user = value => { const id = cleanUuid(value); if (!id) throw refuse('not_found'); return id; };
  const uid = () => (signedIn() ? cloud.userId() : null);

  // One read for everything. Concurrent callers share it; an old account's
  // reply never lands on a new one.
  function inbox() {
    const who = uid();
    if (inflight?.user === who) return inflight.promise;
    const request = { user: who };
    request.promise = call('mischief_inbox', {}).then(raw => {
      if (uid() !== who) return null;
      cache = readMischiefInbox(raw); cacheUser = who; cache.at = now();
      emit();
      return cache;
    }).finally(() => { if (inflight === request) inflight = null; });
    inflight = request;
    return request.promise;
  }
  const cached = () => (cacheUser && cacheUser === uid() ? cache : null);
  // Small local corrections after a write, until the next read says otherwise.
  function patch(fn) { const c = cached(); if (c) { try { fn(c); } catch { /* next read fixes it */ } emit(); } }

  // The culprit is read from the shelf friends see, so show them the shelf as it is now first.
  async function freshShelf() { try { await social.publish({ force: true }); } catch { /* the server says if it is missing */ } }

  async function sendHex({ to, card, culprit, rebound = null }) {
    if (!HEX_BY_ID[card]) throw refuse('bad_card');
    if (!petId(culprit)) throw refuse('bad_culprit');
    const target = user(to), free = rebound ? user(rebound) : null;
    await freshShelf();
    const r = await call('send_hex', { p_to: target, p_card: card, p_culprit: culprit, p_rebound: free });
    patch(c => {
      if (free) c.status.rebounds = c.status.rebounds.filter(x => x.id !== free);
      else c.status.hexedToday = true;
    });
    return { id: cleanUuid(r?.id), expiresAt: time(r?.expires_at) };
  }
  async function sendHaunt({ to, resident }) {
    if (!petId(resident)) throw refuse('bad_culprit');
    const target = user(to);
    await freshShelf();
    const r = await call('send_haunt', { p_to: target, p_resident: resident });
    patch(c => { c.status.hauntReady = false; });
    return { id: cleanUuid(r?.id), endsAt: time(r?.ends_at) };
  }
  async function help({ to, resident, need }) {
    if (!HELP_NEEDS.includes(need)) throw refuse('bad_need');
    if (!petId(resident)) throw refuse('not_needed');
    const target = user(to);
    const r = await call('help_out', { p_to: target, p_resident: resident, p_need: need });
    patch(c => { if (!c.status.helped.includes(target)) c.status.helped.push(target); c.status.helpsGiven++; });
    return { id: cleanUuid(r?.id), amount: int(r?.amount, 1, 30, 25) };
  }
  async function knock(to) {
    const target = user(to);
    const out = readKnockResult(await call('knock', { p_to: target }));
    if (!out) throw refuse('unexpected');
    patch(c => { if (!c.status.knocked.includes(target)) c.status.knocked.push(target); });
    return out;
  }
  async function setBowl(bowl) {
    if (!BOWL_BY_ID[bowl]) throw refuse('bad_bowl');
    const r = await call('set_bowl', { p_bowl: bowl });
    const kept = BOWL_BY_ID[r?.bowl] ? r.bowl : bowl;
    patch(c => { c.doorstep.bowl = kept; });
    return kept;
  }
  const resolveHex = async (id, { choice, outcome, rebound = false }) => {
    await call('resolve_hex', { p_id: user(id), p_choice: int(choice, 0, 3), p_outcome: int(outcome, 0, 3), p_rebound: rebound === true });
    return true;
  };
  const declineHex = async id => { await call('decline_hex', { p_id: user(id) }); return true; };
  const shoo = async (id, taps) => { await call('shoo_haunt', { p_id: user(id), p_taps: int(taps, 1, 99, 1) }); return true; };
  async function ackHelps(ids) {
    const clean = [...new Set((ids || []).map(cleanUuid).filter(Boolean))].slice(0, 20);
    if (!clean.length) return 0;
    const r = await call('ack_helps', { p_ids: clean });
    return int(r?.count, 0, 20, 0);
  }
  async function seen(kind, id) {
    if (!['hex', 'haunt'].includes(kind)) throw refuse('bad_kind');
    const r = await call('mark_mischief_seen', { p_kind: kind, p_id: user(id) });
    patch(c => { if (kind === 'hex') c.results = c.results.filter(x => x.id !== id); else c.hauntResults = c.hauntResults.filter(x => x.id !== id); });
    return r?.ok === true;
  }

  return {
    signedIn, active, userId: uid, inbox, cached, patch, sendHex, sendHaunt, help, knock, setBowl, resolveHex, declineHex, shoo, ackHelps, seen,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
