// The Joint Bench over the cloud session: two friends judge the same Shelf
// Court hearing blind, then compare. The schema is
// supabase/migrations/0005_joint_court.sql.
//
// As in src/cloud/social.js, the server decides who may see what, and is never
// trusted for the shape of what it sends: every reply goes through a reader
// here, so a hearing, its cast, its rulings and its reactions are rebuilt from
// known parts before the Court touches them. Nothing is sent unless the social
// layer is on (social.active()).
import { COURT_CAST } from '../content/court.js';
import { CloudError } from './client.js';
import { cleanText, cleanUuid, readResident, socialCode, socialText, MAX_SUMMONS_CHARS } from './social.js';

export const RULINGS = ['plaintiff', 'defendant', 'both'];
export const REACTIONS = ['laugh', 'gasp', 'gavel'];
export const MAX_MARKS = 40;
export const MAX_JURY = 6;
export const MAX_WITNESSES = 3;
export const HEARING_STATUSES = ['open', 'revealed', 'declined', 'withdrawn', 'expired'];
export const MAX_CAST_CHARS = MAX_SUMMONS_CHARS;
const CASE_ID = /^[a-z0-9-]{1,40}$/;
const MARK_AT = /^[a-z0-9:-]{1,24}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;
function cleanTime(value) {
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(t) && t > 0 ? t : 0;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

export function readRuling(raw) {
  if (!record(raw) || !RULINGS.includes(raw.ruling) || !RULINGS.includes(raw.truth)) return null;
  if (!whole(raw.stars, 0, 3) || !whole(raw.ratings, 0, 100) || !whole(raw.agree, 0, 6) || !whole(raw.dissent, 0, 6) || raw.agree + raw.dissent > 6) return null;
  return { ruling: raw.ruling, truth: raw.truth, stars: raw.stars, ratings: raw.ratings, agree: raw.agree, dissent: raw.dissent };
}
export function readMarks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_MARKS * 2).filter(m => record(m) && typeof m.at === 'string' && MARK_AT.test(m.at) && REACTIONS.includes(m.r) && whole(m.ms, 0, 20000))
    .slice(0, MAX_MARKS).map(m => ({ at: m.at, r: m.r, ms: m.ms }));
}
// One person in the cast. A neighbour is named by the court's own cast list;
// a resident (ours, theirs or a visitor) is rebuilt as social.js rebuilds
// any resident a friend sends.
export function readMember(raw) {
  if (!record(raw)) return null;
  if (raw.kind === 'npc') return typeof raw.id === 'string' && Object.hasOwn(COURT_CAST, raw.id) ? { kind: 'npc', id: raw.id, name: COURT_CAST[raw.id].name } : null;
  if (!['pet', 'visitor'].includes(raw.kind)) return null;
  const r = readResident(raw);
  if (!r) return null;
  return { kind: raw.kind, id: r.id, name: r.name, owner: ['from', 'to'].includes(raw.owner) ? raw.owner : '', from: cleanText(raw.from, 24),
    traits: r.traits, mood: r.mood, bond: r.bond, art: r.art };
}
function readSeat(raw) {
  const r = record(raw) ? raw : {};
  return { traits: readResident({ id: 'x', traits: r.traits }).traits, bond: whole(r.bond, 0, 25) ? r.bond : 0,
    dislikes: Array.isArray(r.dislikes) ? [...new Set(r.dislikes.filter(x => x === 'p' || x === 'd'))] : [] };
}
export function readCast(raw) {
  if (!record(raw)) return null;
  const p = readMember(raw.p), d = readMember(raw.d);
  if (!p || !d) return null;
  const list = (rows, max) => (Array.isArray(rows) ? rows.slice(0, max) : []).map(readMember).filter(Boolean);
  const jury = list(raw.jury, MAX_JURY), witnesses = list(raw.witnesses, MAX_WITNESSES);
  const seats = record(raw.seats) ? raw.seats : {};
  return { v: 1, p, d, jury, witnesses,
    seats: { p: readSeat(seats.p), d: readSeat(seats.d), jury: jury.map((_, i) => readSeat(Array.isArray(seats.jury) ? seats.jury[i] : null)) } };
}
export function readHearing(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), other = cleanUuid(raw.other_user);
  if (!id || !other || !['served', 'invite'].includes(raw.kind) || !['first', 'second'].includes(raw.role) ||
    typeof raw.case_id !== 'string' || !CASE_ID.test(raw.case_id) || !HEARING_STATUSES.includes(raw.status) || !whole(raw.seed, 1, 2147483647)) return null;
  const out = {
    id, kind: raw.kind, role: raw.role, otherUser: other, otherName: cleanText(raw.other_name, 24), caseId: raw.case_id,
    twist: typeof raw.twist === 'string' && CASE_ID.test(raw.twist) ? raw.twist : null, seed: raw.seed, status: raw.status,
    createdAt: cleanTime(raw.created_at), expiresAt: cleanTime(raw.expires_at), ruledAt: cleanTime(raw.ruled_at),
    mine: readRuling(raw.mine), theirs: raw.status === 'revealed' ? readRuling(raw.theirs) : null,
    alone: raw.alone === true && raw.role === 'first', seen: raw.seen === true
  };
  if (raw.cast !== undefined) {
    out.cast = readCast(raw.cast);
    out.theirMarks = readMarks(raw.their_marks);
    out.myMarks = readMarks(raw.my_marks);
  }
  return out;
}
export function readHearings(raw) {
  const r = record(raw) ? raw : {};
  const seen = new Set();
  const hearings = (Array.isArray(r.hearings) ? r.hearings.slice(0, 40) : []).map(readHearing).filter(h => h && !seen.has(h.id) && seen.add(h.id));
  const people = new Set();
  const records = (Array.isArray(r.records) ? r.records.slice(0, 50) : []).map(readRecord).filter(x => x && !people.has(x.userId) && people.add(x.userId));
  return { hearings, records };
}
export function readRecord(raw) {
  if (!record(raw)) return null;
  const userId = cleanUuid(raw.user_id);
  if (!userId) return null;
  const n = value => whole(value, 0, 1e6) ? value : 0;
  const out = { userId, name: cleanText(raw.display_name, 24), hearings: n(raw.hearings), fullBenches: n(raw.full_benches), mine: n(raw.mine_right), theirs: n(raw.theirs_right) };
  if (raw.recent !== undefined) {
    const seen = new Set();
    out.recent = (Array.isArray(raw.recent) ? raw.recent.slice(0, 10) : []).map(readHearing).filter(h => h && h.status === 'revealed' && !seen.has(h.id) && seen.add(h.id));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Refusals, as the player reads them
// ---------------------------------------------------------------------------

const TEXT = {
  sealed: 'Still sealed. The other judge has not ruled yet.',
  bad_ruling: 'That ruling was refused. Nothing was sent.',
  bad_cast: 'That cast would not fit in the courtroom. Nothing was sent.',
  bad_hearing: 'That hearing was refused. Nothing was sent.',
  too_many_open: 'Five hearings are already waiting between you two. Let the bench catch up.',
  not_open: 'That hearing is closed. It was answered, declined or left too long.',
  not_found: 'That hearing has gone. It may have been withdrawn.'
};
const TOKENS = new Set(Object.keys(TEXT));
export function hearingCode(error) {
  if (error?.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  if (TOKENS.has(error?.code)) return error.code;
  return socialCode(error);
}
const textFor = code => TEXT[code] || socialText(code === 'offline' ? { offline: true } : { code });
export const hearingText = error => textFor(hearingCode(error));
const refuse = (code, status = 0) => new CloudError(textFor(code), { code, status });

// ---------------------------------------------------------------------------
// The wrappers
// ---------------------------------------------------------------------------

export function createHearings({ cloud, social } = {}) {
  const listeners = new Set();
  let cache = { user: null, hearings: [], records: [], at: 0 }, request = null;
  const signedIn = () => !!cloud?.configured && cloud.signedIn();
  const active = () => !!social?.active?.() && signedIn();
  const userId = () => (signedIn() ? cloud.userId() : null);
  const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* the UI's problem */ } });

  async function call(name, args) {
    if (!active()) throw refuse('signed_out', 401);
    try { return await cloud.rpc(name, args); }
    catch (error) {
      const code = hearingCode(error);
      throw Object.assign(refuse(code, error?.status || 0), { offline: code === 'offline' });
    }
  }
  const uuid = value => { const id = cleanUuid(value); if (!id) throw refuse('not_found'); return id; };
  // Ours, from this account: an older account's reply never reaches the page.
  const same = uid => { if (userId() !== uid) throw refuse('signed_out', 401); };
  function patch(id, change) {
    if (cache.user !== userId()) return;
    cache = { ...cache, hearings: cache.hearings.map(h => (h.id === id ? { ...h, ...change } : h)) };
    emit();
  }

  function payload(ruling) {
    const r = readRuling(ruling);
    if (!r) throw refuse('bad_ruling');
    return r;
  }
  async function open({ to, kind, caseId, twist = null, seed, cast, ruling, marks = [] }) {
    if (!['served', 'invite'].includes(kind) || typeof caseId !== 'string' || !CASE_ID.test(caseId) || !whole(seed, 1, 2147483647)) throw refuse('bad_hearing');
    if (!readCast(cast)) throw refuse('bad_cast');
    if (JSON.stringify(cast).length > MAX_CAST_CHARS) throw refuse('too_large');
    const uid = userId();
    const r = await call('open_hearing', { p_to: uuid(to), p_kind: kind, p_case: caseId, p_twist: twist || '', p_seed: seed, p_cast: cast,
      p_ruling: payload(ruling), p_marks: readMarks(marks) });
    same(uid);
    const id = cleanUuid(r?.id);
    if (!id) throw refuse('unexpected');
    list().catch(() => {});
    return { id, expiresAt: cleanTime(r?.expires_at) };
  }
  async function rule(id, ruling, marks = []) {
    const uid = userId();
    const raw = await call('rule_hearing', { p_id: uuid(id), p_ruling: payload(ruling), p_marks: readMarks(marks) });
    same(uid);
    const h = readHearing(raw);
    if (!h || h.status !== 'revealed') throw refuse('unexpected');
    patch(h.id, { status: 'revealed', mine: h.mine, theirs: h.theirs, seen: true, ruledAt: h.ruledAt });
    return h;
  }
  async function get(id) {
    const uid = userId();
    const h = readHearing(await call('get_hearing', { p_id: uuid(id) }));
    same(uid);
    if (!h || !h.cast) throw refuse('unexpected');
    return h;
  }
  async function reveal(id) {
    const uid = userId();
    const h = readHearing(await call('reveal_hearing', { p_id: uuid(id) }));
    same(uid);
    if (!h || !h.cast) throw refuse('unexpected');
    patch(h.id, { seen: true });
    return h;
  }
  async function decline(id) {
    const uid = userId();
    const r = await call('decline_hearing', { p_id: uuid(id) });
    same(uid);
    const status = ['declined', 'withdrawn'].includes(r?.status) ? r.status : 'declined';
    patch(id, { status, seen: true });
    return status;
  }
  async function benchRecord(friendId) {
    const uid = userId();
    const r = readRecord(await call('bench_record', { p_friend: uuid(friendId) }));
    same(uid);
    if (!r) throw refuse('unexpected');
    return r;
  }
  // One request at a time per account; the answer is kept for count().
  function list() {
    const uid = userId();
    if (request?.user === uid) return request.promise;
    const mineNow = { user: uid };
    mineNow.promise = call('hearings', {}).then(raw => {
      if (userId() !== uid) return { hearings: [], records: [] };
      const box = readHearings(raw);
      cache = { user: uid, ...box, at: Date.now() };
      emit();
      return box;
    }).finally(() => { if (request === mineNow) request = null; });
    request = mineNow;
    return mineNow.promise;
  }
  const cached = () => (cache.user && cache.user === userId() && active() ? { hearings: cache.hearings, records: cache.records, at: cache.at } : { hearings: [], records: [], at: 0 });
  // What needs this player: a hearing to answer, or a reveal not yet read.
  const needsMe = h => (h.role === 'second' && h.status === 'open') || (h.status === 'revealed' && !h.seen) || (h.alone && !h.seen);
  const count = () => cached().hearings.filter(needsMe).length;

  return { active, userId, open, rule, get, reveal, decline, benchRecord, list, cached, count, needsMe,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}
