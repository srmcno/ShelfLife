// Covens over the one cloud session: founding, invitations, the weekly rite,
// chests, the notice board and invite rewards. The schema is
// supabase/migrations/0008_covens.sql.
//
// As in social.js, the server decides who may see and do what, and is never
// trusted for the shape of what it sends: every reply goes through a reader
// below. Names and notes arrive as ids from this build's word banks and are
// drawn only if this build knows them; display names are cleaned like any
// other name. Nothing is sent until the player has opened Friends once on
// this account (social.active()), and every call is safe offline.
import { cleanText, cleanUuid, cleanCode, socialCode, socialText } from './social.js';
import { CloudError } from './client.js';
import { COUNTERS, DAILY_CAPS, MAX_MEMBERS } from '../content/coven.js';

const ID = /^[a-z0-9-]{1,24}$/;
const TILE = /^(?:[a-z0-9-]{1,20}|@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const int = (value, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const id = value => typeof value === 'string' && ID.test(value) ? value : '';
const time = value => { const t = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(t) && t > 0 ? t : 0; };
const list = (value, max) => Array.isArray(value) ? value.slice(0, max) : [];
const uniqueBy = (items, key) => { const seen = new Set(); return items.filter(x => x && !seen.has(key(x)) && seen.add(key(x))); };

/* ---------- readers ---------- */
export function readCard(raw) {
  if (!record(raw)) return null;
  const covenId = cleanUuid(raw.id);
  if (!covenId) return null;
  return {
    id: covenId, name: { a: id(raw.name_a), b: id(raw.name_b), form: Number.isInteger(raw.name_form) ? Math.max(0, Math.min(3, raw.name_form)) : 0 },
    sigil: { shape: id(raw.shape), symbol: id(raw.symbol), colour: id(raw.colour) },
    members: int(raw.members, MAX_MEMBERS), createdAt: time(raw.created_at)
  };
}
function readCounts(raw) {
  const out = {};
  if (record(raw)) for (const k of COUNTERS) if (Number.isFinite(raw[k]) && raw[k] > 0) out[k] = int(raw[k], DAILY_CAPS[k] * 7);
  return out;
}
const tiers = raw => [...new Set(list(raw, 3).filter(t => [1, 2, 3].includes(t)))].sort();
function readWeek(raw, { last = false } = {}) {
  if (!record(raw) || !Number.isInteger(raw.no) || !COUNTERS.includes(raw.counter)) return null;
  const week = { no: raw.no, goal: id(raw.goal), counter: raw.counter, target: Math.max(1, int(raw.target, 10000)),
    progress: int(raw.progress, 1e6), claimed: tiers(raw.claimed) };
  if (!last) {
    week.starts = typeof raw.starts === 'string' && ISO_DAY.test(raw.starts) ? raw.starts : '';
    week.shares = uniqueBy(list(raw.members, MAX_MEMBERS * 2).map(m => record(m) && cleanUuid(m.user_id) ? { userId: cleanUuid(m.user_id), amount: int(m.amount, 1e6) } : null), m => m.userId);
  } else {
    week.members = uniqueBy(list(raw.members, MAX_MEMBERS).map(m => record(m) && cleanUuid(m.user_id) ? {
      userId: cleanUuid(m.user_id), name: cleanText(m.display_name, 24), counts: readCounts(m.counts),
      days: int(m.days, 7), late: int(m.late, 1e5), notes: int(m.notes, 20)
    } : null), m => m.userId);
  }
  return week;
}
export function readStatus(raw) {
  const r = record(raw) ? raw : {};
  const card = readCard(r.coven);
  const coven = card ? { ...card, role: r.coven.role === 'founder' ? 'founder' : 'member', frame: id(r.coven.frame) } : null;
  const members = coven ? uniqueBy(list(r.members, MAX_MEMBERS).map(m => record(m) && cleanUuid(m.user_id) ? {
    userId: cleanUuid(m.user_id), name: cleanText(m.display_name, 24), role: m.role === 'founder' ? 'founder' : 'member',
    frame: id(m.frame), joinedAt: time(m.joined_at)
  } : null), m => m.userId) : [];
  const invites = uniqueBy(list(r.invites, 10).map(i => {
    if (!record(i)) return null;
    const inviteId = cleanUuid(i.id), card2 = readCard(i.coven), from = cleanUuid(i.from_user);
    return inviteId && card2 && from ? { id: inviteId, coven: card2, fromUser: from, fromName: cleanText(i.from_name, 24), createdAt: time(i.created_at) } : null;
  }), i => i.id);
  const sent = coven ? uniqueBy(list(r.sent, MAX_MEMBERS * 2).map(s => record(s) && cleanUuid(s.to_user)
    ? { userId: cleanUuid(s.to_user), name: cleanText(s.display_name, 24), createdAt: time(s.created_at) } : null), s => s.userId) : [];
  const board = coven && record(r.board) ? { latest: Number.isSafeInteger(r.board.latest) && r.board.latest > 0 ? r.board.latest : 0, count: int(r.board.count, 20) } : { latest: 0, count: 0 };
  return { coven, members, week: coven ? readWeek(r.week) : null, last: coven ? readWeek(r.last, { last: true }) : null, invites, sent, board };
}
export function readNote(raw) {
  if (!record(raw) || !Number.isSafeInteger(raw.id) || raw.id <= 0) return null;
  const author = cleanUuid(raw.author);
  if (!author) return null;
  const tiles = list(raw.tiles, 12).filter(t => typeof t === 'string' && TILE.test(t)).map(t => t.toLowerCase());
  const mentions = list(raw.mentions, 3).map(cleanUuid);
  const names = {};
  list(raw.mention_names, 3).forEach((n, i) => { if (mentions[i]) names[mentions[i]] = cleanText(n, 24); });
  if (!tiles.length) return null;
  return { id: raw.id, author, authorName: cleanText(raw.author_name, 24), tiles, mentions: mentions.filter(Boolean), names, createdAt: time(raw.created_at) };
}
export const readBoard = raw => uniqueBy(list(raw, 20).map(readNote), n => n.id);
export function readReferrals(raw) {
  const r = record(raw) ? raw : {};
  const one = x => record(x) && cleanUuid(x.user_id) ? { userId: cleanUuid(x.user_id), name: cleanText(x.name, 24), friends: x.friends === true,
    days: int(x.days, 60), claimed: x.claimed === true } : null;
  return { invitedBy: one(r.invited_by), invited: uniqueBy(list(r.invited, 20).map(one), x => x.userId), rewarded: int(r.rewarded, 10),
    canRegister: r.can_register === true };
}

/* ---------- refusals, as the player reads them ---------- */
const TEXT = {
  no_coven: 'You are not in a coven any more.',
  already_in_coven: 'You are already in a coven. One at a time, like hats.',
  in_a_coven: 'They are in a coven already. Loyalty, or inertia.',
  not_founder: 'Only the candle holder can do that.',
  not_member: 'They are not in your coven.',
  not_friends: 'You are not friends with them any more.',
  not_found: 'That has gone. Invitations expire after a week.',
  coven_full: 'The coven is full. Six seats, all of them taken, one of them wobbly.',
  too_many_open: 'Six invitations are already out. Let somebody answer first.',
  dnd: 'They have asked not to be disturbed. Try again another day.',
  rate_limited: 'That is a lot, very quickly. Try again in a little while.',
  bad_coven: 'That name or sigil was refused. Try another roll.',
  bad_day: 'Your device’s clock is a day out. Nothing was lost; it will count once the clock is right.',
  bad_counts: 'That did not go through. Nothing was changed.',
  bad_week: 'That week has closed.',
  bad_tier: 'That did not go through. Nothing was changed.',
  not_reached: 'Not yet. The chest is still counting.',
  not_eligible: 'The chest is for members who did something towards the goal this week.',
  bad_note: 'That note was refused. Twelve magnets at most, and names only of members.',
  not_allowed: 'Only its author, someone it names or the candle holder can take that down.',
  self: 'That is your own code.',
  not_new: 'Invite rewards are for brand new players, in their first fortnight.',
  already_referred: 'Somebody has already been credited with bringing you in.',
  too_many: 'That code has brought in a lot of people already.',
  cap_reached: 'Ten invite rewards is the most anyone can collect. Very sociable of you.',
  not_ready: 'Not yet: they need to be friends with you and to have played on three different days.'
};
const TOKENS = new Set(Object.keys(TEXT));
export function covenCode(error) {
  if (TOKENS.has(error?.code)) return error.code;
  if (error?.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  return socialCode(error);
}
export function covenText(error) {
  const code = covenCode(error);
  return TEXT[code] || socialText(error);
}
const refuse = (code, status = 0, offline = false, cause = null) =>
  Object.assign(new CloudError(TEXT[code] || socialText(cause || { code, offline }), { code, status }), { offline });

/* ---------- the wrappers ---------- */
export function createCovenClient({ cloud, social, now = Date.now } = {}) {
  const listeners = new Set();
  let cache = null, cacheUser = null, request = null;
  const active = () => !!social?.active?.();
  const emit = () => listeners.forEach(fn => { try { fn(cached()); } catch { /* the UI's problem */ } });

  async function call(name, args = {}) {
    if (!social?.signedIn?.() || !active()) throw refuse('signed_out', 401);
    try { return await cloud.rpc(name, args); }
    catch (error) { const code = covenCode(error); throw refuse(code, error?.status || 0, code === 'offline', error); }
  }
  const user = value => { const u = cleanUuid(value); if (!u) throw refuse('not_found'); return u; };
  const ok = r => { if (record(r) && r.ok === false) throw refuse(TOKENS.has(r.error) ? r.error : 'unexpected'); return r; };

  function cached() { return cacheUser && cacheUser === cloud?.userId?.() && active() ? cache : null; }
  function status() {
    const uid = cloud?.userId?.();
    if (request?.user === uid) return request.promise;
    const r = { user: uid };
    r.promise = call('coven_status').then(raw => {
      if (cloud.userId() !== uid) return readStatus(null);
      cache = readStatus(raw); cacheUser = uid; emit();
      return cache;
    }).finally(() => { if (request === r) request = null; });
    request = r;
    return r.promise;
  }
  // After a write, the next look at the status is fresh.
  const forget = value => { request = null; return value; };

  const look = (name, sigil) => ({ p_name_a: id(name?.a), p_name_b: id(name?.b), p_form: Number.isInteger(name?.form) ? name.form : 0,
    p_shape: id(sigil?.shape), p_symbol: id(sigil?.symbol), p_colour: id(sigil?.colour) });
  async function found(name, sigil) { const r = await call('coven_found', look(name, sigil)); return forget({ id: cleanUuid(r?.id) }); }
  async function restyle(name, sigil) { await call('coven_restyle', look(name, sigil)); return forget(true); }
  async function invite(userId) { await call('coven_invite', { p_user: user(userId) }); return forget(true); }
  async function cancelInvite(userId) { await call('coven_cancel_invite', { p_user: user(userId) }); return forget(true); }
  async function respond(inviteId, accept) {
    const r = ok(await call('coven_respond', { p_id: user(inviteId), p_accept: !!accept }));
    return forget({ status: r?.status === 'joined' ? 'joined' : 'declined', covenId: cleanUuid(r?.coven_id) });
  }
  async function leave() { await call('coven_leave'); cache = null; return forget(true); }
  async function passCandle(userId) { await call('coven_pass_candle', { p_user: user(userId) }); return forget(true); }
  async function remove(userId) { await call('coven_remove', { p_user: user(userId) }); return forget(true); }
  async function setFrame(frame) { await call('coven_set_frame', { p_frame: id(frame) }); return forget(true); }

  async function contribute(day, counts) {
    if (typeof day !== 'string' || !ISO_DAY.test(day)) throw refuse('bad_day');
    const clean = {};
    for (const k of COUNTERS) if (Number.isFinite(counts?.[k]) && counts[k] > 0) clean[k] = Math.min(DAILY_CAPS[k], Math.floor(counts[k]));
    const r = await call('coven_contribute', { p_day: day, p_counts: clean });
    return { week: Number.isInteger(r?.week) ? r.week : 0, progress: int(r?.progress, 1e6), mine: int(r?.mine, 1e6) };
  }
  async function claim(week, tier) {
    if (!Number.isInteger(week) || ![1, 2, 3].includes(tier)) throw refuse('bad_tier');
    const r = await call('coven_claim', { p_week: week, p_tier: tier });
    return forget({ ok: r?.ok === true, fresh: r?.fresh === true, week, tier });
  }

  const board = async () => readBoard(await call('coven_board'));
  async function post(tiles) {
    const clean = list(tiles, 12).filter(t => typeof t === 'string' && TILE.test(t));
    if (!clean.length || clean.length !== (tiles || []).length) throw refuse('bad_note');
    const r = await call('coven_post', { p_tiles: clean });
    return forget({ id: Number.isSafeInteger(r?.id) ? r.id : 0 });
  }
  async function unpost(noteId) {
    if (!Number.isSafeInteger(noteId) || noteId <= 0) throw refuse('not_found');
    await call('coven_unpost', { p_id: noteId });
    return forget(true);
  }

  async function markActiveDay() { const r = await call('mark_active_day'); return { days: int(r?.days, 60) }; }
  async function registerReferral(code) {
    const c = cleanCode(code);
    if (!c) throw refuse('not_found');
    const r = ok(await call('register_referral', { p_code: c }));
    return { inviter: cleanUuid(r?.inviter) };
  }
  const referrals = async () => readReferrals(await call('referral_status'));
  async function claimReferral(userId) {
    const r = await call('claim_referral', { p_user: user(userId) });
    return { ok: r?.ok === true, fresh: r?.fresh === true, side: r?.side === 'inviter' ? 'inviter' : 'invitee' };
  }

  return {
    active, cached, status, found, restyle, invite, cancelInvite, respond, leave, passCandle, remove, setFrame,
    contribute, claim, board, post, unpost, markActiveDay, registerReferral, referrals, claimReferral, now,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
