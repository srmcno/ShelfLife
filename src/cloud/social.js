// Friends, shelves on show, Shelf Court summonses and daily scores, over the
// one cloud session. The schema is supabase/migrations/0002_social.sql.
//
// The server decides who may see what (row level security). It is never
// trusted for the shape of what it sends back: every reply goes through a
// reader below before the game touches it, so text is clamped and stripped of
// control characters, art is rebuilt from known parts, and a drawing is only
// ever a PNG data URL under 120 KB. The UI still escapes everything it prints.
//
// Nothing here runs by itself, and nothing is sent until the player has opened
// the Friends sheet once on this account (optIn). Until then `active()` is
// false and the Court, the arcade and the sync hook leave the network alone.
import { normalizePetArt, localDayKey } from '../state.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { RANKS } from '../content/mayhem.js';
import { STAMP_SVG, CANVAS_SIZE } from '../art/stamps.js';
import {
  normalizeCreature, BODIES, PALETTES, EYES, MOUTHS, TOPS, EARS, ARMS, LEGS, TAILS, WINGS, DETAILS, COLOR_ROLES
} from '../art/creatures.js';
import { moodOf } from '../engine/tick.js';
import { rankIndexFor } from '../engine/mayhem.js';
import { CloudError } from './client.js';

export const MAX_RESIDENTS = 18;
export const MAX_IMAGE_CHARS = 120 * 1024;
// The server refuses 400,000 bytes of shelf and 150,000 per summonsed
// resident. jsonb adds spaces, so the client stops short of both.
export const MAX_SHELF_CHARS = 380000;
export const MAX_SUMMONS_CHARS = 140000;
export const PUBLISH_GAP_MS = 10 * 60000;
export const SCORE_CAPS = { frenzy: 3000, stack: 500, seance: 150, whack: 2500 };
export const VERDICTS = ['plaintiff', 'defendant', 'both'];
export const MOODS = ['content', 'fine', 'annoyed', 'furious'];
const MAX_STAMPS = 48, MAX_TRAITS = 6, MAX_LIST = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-HJKMNP-Z2-9]{8}$/;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const CASE_ID = /^[a-z0-9-]{1,40}$/;
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
// Control characters, bidi overrides and zero-width marks: nothing a name
// needs. Listed as code points so no invisible character sits in this file.
const INVISIBLE = [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x61c, 0x61c], [0x115f, 0x1160], [0x17b4, 0x17b5], [0x180e, 0x180e],
  [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0x3164, 0x3164], [0xfeff, 0xfeff], [0xfff9, 0xfffb]];
const visible = ch => { const c = ch.codePointAt(0); return !INVISIBLE.some(([lo, hi]) => c >= lo && c <= hi); };

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const own = (lib, key) => typeof key === 'string' && Object.hasOwn(lib, key);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const count = (value, hi) => Number.isFinite(value) ? clamp(Math.floor(value), 0, hi) : 0;
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

// ---------------------------------------------------------------------------
// Readers: server data in, plain safe data out. Each returns null (or an
// empty value) for anything it does not recognise.
// ---------------------------------------------------------------------------

export function cleanText(value, max = 24) {
  if (typeof value !== 'string') return '';
  const text = [...value.slice(0, max * 8)].map(ch => visible(ch) ? ch : ' ').join('').replace(/\s+/g, ' ').trim();
  return [...text].slice(0, max).join('').trim();
}
export const cleanUuid = value => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : '';
export function cleanCode(value) {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CODE.test(code) ? code : '';
}
export const formatCode = code => CODE.test(code) ? code.slice(0, 4) + ' ' + code.slice(4) : '';
function cleanTime(value) {
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(t) && t > 0 ? t : 0;
}

const PART_LIBS = { eyes: EYES, mouth: MOUTHS, top: TOPS, ears: EARS, arms: ARMS, legs: LEGS, tail: TAILS, wings: WINGS, detail: DETAILS };
// A creature is rebuilt from ids this build knows. Anything else is dropped
// and normalizeCreature fills in a default.
export function cleanCreature(raw) {
  if (!record(raw)) return null;
  const parts = {}, tune = {}, colors = {};
  const p = record(raw.parts) ? raw.parts : {};
  for (const [slot, lib] of Object.entries(PART_LIBS)) if (own(lib, p[slot])) parts[slot] = p[slot];
  const t = record(raw.tune) ? raw.tune : {};
  for (const key of ['eyeScale', 'eyeSpread', 'mouthScale', 'lean']) if (Number.isFinite(t[key])) tune[key] = t[key];
  if (record(raw.colors)) for (const role of COLOR_ROLES) {
    const value = Object.hasOwn(raw.colors, role) ? raw.colors[role] : null;
    if (role !== 'none' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) colors[role] = value;
  }
  return normalizeCreature({
    seed: typeof raw.seed === 'string' ? raw.seed.replace(/[^a-z0-9]/gi, '').slice(0, 24) : '',
    body: own(BODIES, raw.body) ? raw.body : '', palette: own(PALETTES, raw.palette) ? raw.palette : '', parts, tune, colors
  });
}
// What a snapshot stores: the choices, not the derived anatomy and rig.
function compactCreature(creature) {
  const c = cleanCreature(creature);
  const out = { v: 1, seed: c.seed, body: c.body, palette: c.palette, parts: c.parts, tune: c.tune };
  if (c.colors) out.colors = c.colors;
  return out;
}
export const cleanImage = value => typeof value === 'string' && value.length <= MAX_IMAGE_CHARS && PNG.test(value) ? value : '';
function cleanStamps(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_STAMPS)
    .filter(s => record(s) && own(STAMP_SVG, s.kind) && [s.x, s.y, s.size].every(Number.isFinite))
    .map(s => ({ kind: s.kind, x: clamp(s.x, 0, CANVAS_SIZE), y: clamp(s.y, 0, CANVAS_SIZE), size: clamp(s.size, 1, 400),
      rotation: Number.isFinite(s.rotation) ? clamp(s.rotation, -360, 360) : 0, color: typeof s.color === 'string' && HEX.test(s.color) ? s.color : '#F2E9DC' }));
}
function cleanBounds(b) {
  if (!record(b) || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k]))) return null;
  if (b.width <= 0 || b.height <= 0) return null;
  return { x: clamp(b.x, 0, 1), y: clamp(b.y, 0, 1), width: clamp(b.width, 0.001, 1), height: clamp(b.height, 0.001, 1) };
}
// A generated creature, or a drawing with its stamps. null when neither is usable.
export function cleanArt(raw) {
  if (!record(raw)) return null;
  if (raw.creature !== undefined) {
    const creature = cleanCreature(raw.creature);
    return creature ? normalizePetArt({ body: '', stamps: [], creature }) : null;
  }
  const body = cleanImage(raw.body), stamps = cleanStamps(raw.stamps);
  if (!body && !stamps.length) return null;
  const art = normalizePetArt({ body, stamps });
  const bounds = cleanBounds(raw.bounds);
  if (bounds) art.bounds = bounds;
  return art;
}

const cleanTraits = list => Array.isArray(list)
  ? [...new Set(list.filter(t => own(TRAIT_BY_ID, t)))].slice(0, MAX_TRAITS) : [];

export function readResident(raw, { art = true } = {}) {
  if (!record(raw) || !petId(raw.id)) return null;
  return {
    id: raw.id, name: cleanText(raw.name, 22) || 'Someone', traits: cleanTraits(raw.traits),
    mood: MOODS.includes(raw.mood) ? raw.mood : 'fine', bond: count(raw.bond, 25), art: art ? cleanArt(raw.art) : null
  };
}

export function readShelf(raw) {
  if (!record(raw)) return null;
  const seen = new Set(), residents = [];
  for (const item of Array.isArray(raw.residents) ? raw.residents.slice(0, MAX_RESIDENTS * 2) : []) {
    const r = readResident(item);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    residents.push(r);
    if (residents.length >= MAX_RESIDENTS) break;
  }
  return { name: cleanText(raw.name, 24), rank: Number.isInteger(raw.rank) ? clamp(raw.rank, 0, RANKS.length - 1) : 0,
    curios: count(raw.curios, 999), residents };
}

export function readFriend(raw) {
  if (!record(raw)) return null;
  const userId = cleanUuid(raw.user_id);
  if (!userId || !['pending', 'accepted'].includes(raw.status) || !['incoming', 'outgoing'].includes(raw.direction)) return null;
  const code = cleanCode(raw.friend_code);
  // A request we sent does not get to show the other player's name yet.
  const named = raw.status === 'accepted' || raw.direction === 'incoming';
  return { userId, name: named ? cleanText(raw.display_name, 24) : '', code, status: raw.status, direction: raw.direction,
    shelfAt: raw.status === 'accepted' ? cleanTime(raw.shelf_updated_at) : 0 };
}
export function readFriends(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows.slice(0, MAX_LIST) : []).map(readFriend)
    .filter(f => f && !seen.has(f.userId) && seen.add(f.userId));
}

export function readCase(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user);
  const plaintiff = readResident(raw.plaintiff), defendant = readResident(raw.defendant, { art: false });
  if (!id || !fromUser || typeof raw.case_id !== 'string' || !CASE_ID.test(raw.case_id) || !plaintiff || !defendant) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), caseId: raw.case_id, plaintiff, defendant, createdAt: cleanTime(raw.created_at) };
}
export function readResult(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), toUser = cleanUuid(raw.to_user);
  if (!id || !toUser || typeof raw.case_id !== 'string' || !CASE_ID.test(raw.case_id) || !VERDICTS.includes(raw.verdict)) return null;
  const side = value => ({ id: record(value) && petId(value.id) ? value.id : '',
    name: record(value) ? cleanText(value.name, 22) || 'Someone' : 'Someone' });
  return { id, toUser, toName: cleanText(raw.to_name, 24), caseId: raw.case_id, plaintiff: side(raw.plaintiff), defendant: side(raw.defendant),
    verdict: raw.verdict, stars: count(raw.stars, 3), ratings: count(raw.ratings, 100), ruledAt: cleanTime(raw.ruled_at) };
}
export function readInbox(raw) {
  const r = record(raw) ? raw : {};
  const list = (rows, read) => {
    const seen = new Set();
    return (Array.isArray(rows) ? rows.slice(0, 40) : []).map(read).filter(x => x && !seen.has(x.id) && seen.add(x.id));
  };
  return { cases: list(r.cases, readCase), results: list(r.results, readResult) };
}

export function readBoard(rows, game) {
  const cap = SCORE_CAPS[game] ?? 0;
  return (Array.isArray(rows) ? rows.slice(0, 50) : []).map(row => {
    if (!record(row) || !cleanUuid(row.user_id) || !Number.isFinite(row.score) || row.score < 0 || row.score > cap) return null;
    return { userId: cleanUuid(row.user_id), name: cleanText(row.display_name, 24), score: Math.floor(row.score),
      rank: Number.isFinite(row.rank) && row.rank >= 1 ? Math.floor(Math.min(row.rank, 1e6)) : 1, me: row.me === true };
  }).filter(Boolean);
}
export function readPercentile(raw, game) {
  const r = record(raw) ? raw : {};
  const cap = SCORE_CAPS[game] ?? 0;
  return {
    players: count(r.players, 1e9),
    beaten: Number.isFinite(r.beaten_percent) ? count(r.beaten_percent, 100) : null,
    top: Number.isFinite(r.top_score) && r.top_score >= 0 && r.top_score <= cap ? Math.floor(r.top_score) : null
  };
}

// ---------------------------------------------------------------------------
// Writers: the local shelf out, as small as it can be.
// ---------------------------------------------------------------------------

export function residentSnapshot(pet, { image = true } = {}) {
  const art = record(pet?.art) ? pet.art : {};
  let out;
  if (art.creature) out = { creature: compactCreature(art.creature) };
  else {
    out = { body: image ? cleanImage(art.body) : '', stamps: cleanStamps(art.stamps) };
    const bounds = cleanBounds(art.bounds);
    if (bounds) out.bounds = bounds;
  }
  const needs = record(pet?.needs) && ['food', 'fuss', 'clean'].every(k => Number.isFinite(pet.needs[k]));
  return { id: String(pet.id), name: cleanText(pet.name, 22) || 'Someone', traits: cleanTraits(pet.traits),
    mood: needs ? moodOf(pet) : 'fine', bond: count(pet.bond, 25), art: out };
}

// Every resident's name, traits and mood; drawings while they fit, first
// come first served. A resident whose drawing did not fit keeps its stamps.
export function shelfSnapshot(state, { name = '' } = {}) {
  const pets = (Array.isArray(state?.pets) ? state.pets : []).filter(p => record(p) && petId(p.id)).slice(0, MAX_RESIDENTS);
  const m = record(state?.mayhem) ? state.mayhem : {};
  const residents = pets.map(p => residentSnapshot(p, { image: false }));
  const snapshot = { v: 1, name: cleanText(name, 24), rank: rankIndexFor(Number(m.lifetime) || 0),
    curios: record(m.curios) ? Object.values(m.curios).filter(n => Number.isFinite(n) && n > 0).length : 0, residents };
  let size = JSON.stringify(snapshot).length;
  pets.forEach((pet, i) => {
    const body = pet.art?.creature ? '' : cleanImage(pet.art?.body);
    if (body && size + body.length <= MAX_SHELF_CHARS) { residents[i].art.body = body; size += body.length; }
  });
  return snapshot;
}

// A friend's resident, shaped enough like a pet for renderPetSprite and the
// Court to seat it. It never joins state.pets and never gets saved.
const MOOD_NEEDS = { content: 88, fine: 62, annoyed: 38, furious: 14 };
export function guestPet(resident) {
  const r = readResident(resident);
  if (!r) return null;
  const level = MOOD_NEEDS[r.mood];
  return {
    id: 'guest-' + r.id.slice(0, 90), sourceId: r.id, name: r.name, traits: r.traits, mood: r.mood, bond: r.bond,
    art: r.art || normalizePetArt(null), artMissing: !r.art,
    needs: { food: level, fuss: level, clean: level }, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, guest: true
  };
}

// Day keys in this game count months from 0 (see localDayKey in state.js).
// The server wants a calendar date.
export function isoDay(dayKey = localDayKey()) {
  const m = String(dayKey).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]), Number(m[3])));
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}

// ---------------------------------------------------------------------------
// Refusals, as the player reads them
// ---------------------------------------------------------------------------

const TEXT = {
  bad_code: 'A friend code is 8 letters and numbers.',
  not_found: 'Nobody has that code. Check it and try again.',
  self: 'That is your own code. You are already acquainted.',
  blocked: 'You have blocked that player.',
  already_friends: 'You are already friends.',
  already_asked: 'Already asked. The next move is theirs.',
  rate_limited: 'That is a lot of asking. Try again in an hour.',
  not_friends: 'You are not friends with them any more.',
  too_many_open: 'They already have five sets of papers from you. Let them catch up.',
  not_open: 'That case has already been heard.',
  too_large: 'Too large to send. Drawn residents take the most room.',
  bad_score: 'That score was refused.',
  refused: 'That did not go through. Nothing was changed.',
  signed_out: 'Sign in to cloud save first.',
  offline: 'No connection. Try again once you are back online.',
  unexpected: 'The cloud did not answer properly. Try again in a moment.'
};
const TOKENS = new Set(['bad_code', 'not_found', 'self', 'blocked', 'already_friends', 'already_asked', 'rate_limited', 'not_friends',
  'too_many_open', 'not_open', 'too_large', 'bad_score', 'bad_day', 'bad_game', 'bad_mod', 'bad_case', 'bad_summons', 'bad_verdict', 'bad_shelf', 'signed_out']);
const ALIAS = { bad_day: 'bad_score', bad_game: 'bad_score', bad_mod: 'bad_score', bad_case: 'refused', bad_summons: 'refused', bad_verdict: 'refused', bad_shelf: 'refused' };

export function socialCode(error) {
  if (!error) return 'unexpected';
  if (error.offline) return 'offline';
  if (TOKENS.has(error.code)) return error.code;
  if (error.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  if (error.code === '23514') return 'too_large';
  if (['no_session', 'session_expired', '28000', 'not_configured'].includes(error.code) || error.status === 401) return 'signed_out';
  return 'unexpected';
}
export function socialText(error) {
  const code = socialCode(error);
  return TEXT[ALIAS[code] || code] || TEXT.unexpected;
}
const refuse = (code, status = 0) => new CloudError(TEXT[ALIAS[code] || code] || TEXT.unexpected, { code, status });

// ---------------------------------------------------------------------------
// The wrappers
// ---------------------------------------------------------------------------

export function createSocial({ cloud, getState = () => null, now = Date.now } = {}) {
  const listeners = new Set();
  let lastStatus = '', publishing = null;

  const signedIn = () => !!cloud?.configured && cloud.signedIn();
  const active = () => signedIn() && cloud.meta().socialUser === cloud.userId();
  function emit() { const info = { inbox: inboxCount() }; listeners.forEach(fn => { try { fn(info); } catch { /* the UI's problem */ } }); }
  function inboxCount() { const m = signedIn() ? cloud.meta() : {}; return m.socialUser === cloud?.userId?.() ? count(m.inboxCount, 99) : 0; }

  async function call(name, args) {
    if (!signedIn()) throw refuse('signed_out', 401);
    try { return await cloud.rpc(name, args); }
    catch (error) {
      const code = socialCode(error);
      throw Object.assign(refuse(code, error?.status || 0), { offline: code === 'offline' });
    }
  }
  const user = value => { const id = cleanUuid(value); if (!id) throw refuse('not_found'); return id; };

  // ---- you ----
  async function profile() {
    const p = await call('ensure_profile', { p_name: '' });
    const out = { code: cleanCode(p?.friend_code), name: cleanText(p?.display_name, 24) };
    cloud.setMeta({ socialName: out.name });
    return out;
  }
  async function setName(value) {
    const p = await call('set_display_name', { p_name: cleanText(value, 24) });
    const out = { code: cleanCode(p?.friend_code), name: cleanText(p?.display_name, 24) };
    cloud.setMeta({ socialName: out.name, shelfHash: '' });
    return out;
  }
  // Opening the Friends sheet is what switches the social layer on for this account.
  function optIn() { if (signedIn()) cloud.setMeta({ socialUser: cloud.userId() }); return active(); }

  // ---- friends ----
  async function addFriend(value) {
    const code = cleanCode(value);
    if (!code) throw refuse('bad_code');
    const r = await call('add_friend', { p_code: code });
    if (!record(r) || r.ok !== true) throw refuse(TOKENS.has(r?.error) ? r.error : 'unexpected');
    const status = r.status === 'accepted' ? 'accepted' : 'pending';
    return { status, userId: cleanUuid(r.user_id), code: cleanCode(r.friend_code) || code, name: status === 'accepted' ? cleanText(r.display_name, 24) : '' };
  }
  const friends = async () => readFriends(await call('list_friends', {}));
  const respond = async (userId, accept) => { await call('respond_friend', { p_user: user(userId), p_accept: !!accept }); return true; };
  const remove = async userId => { await call('remove_friend', { p_user: user(userId) }); return true; };
  const block = async userId => { await call('block_user', { p_user: user(userId) }); return true; };
  const report = async (userId, reason) => { await call('report_user', { p_user: user(userId), p_reason: cleanText(reason, 200) }); return true; };

  // ---- shelves ----
  // `force` skips only the ten minute gap: an unchanged shelf is never sent twice.
  function publish({ force = false } = {}) {
    if (!active()) return Promise.resolve(false);
    if (publishing) return publishing;
    const state = getState();
    if (!state) return Promise.resolve(false);
    const m = cloud.meta();
    const snapshot = shelfSnapshot(state, { name: m.socialName || '' });
    const text = JSON.stringify(snapshot), hash = text.length + ':' + hashText(text);
    if (hash === m.shelfHash && m.shelfUser === cloud.userId()) return Promise.resolve(false);
    if (!force && m.shelfUser === cloud.userId() && now() - (Number(m.shelfPublishedAt) || 0) < PUBLISH_GAP_MS) return Promise.resolve(false);
    publishing = call('publish_shelf', { p_snapshot: snapshot })
      .then(() => { cloud.setMeta({ shelfHash: hash, shelfPublishedAt: now(), shelfUser: cloud.userId() }); return true; })
      .finally(() => { publishing = null; });
    return publishing;
  }
  async function shelf(userId) {
    const r = await call('get_shelf', { p_user: user(userId) });
    if (!record(r)) return null;
    return { userId: cleanUuid(r.user_id), name: cleanText(r.display_name, 24), updatedAt: cleanTime(r.updated_at), shelf: readShelf(r.snapshot) };
  }

  // ---- summonses ----
  // The plaintiff travels with its art; the defendant lives on the other
  // shelf already, so only its id and name go back there.
  async function serve({ to, caseId, plaintiff, defendant }) {
    if (typeof caseId !== 'string' || !CASE_ID.test(caseId)) throw refuse('bad_case');
    const d = readResident(defendant, { art: false });
    if (!plaintiff || !petId(plaintiff.id) || !d) throw refuse('bad_summons');
    let p = residentSnapshot(plaintiff);
    if (JSON.stringify(p).length > MAX_SUMMONS_CHARS) p = residentSnapshot(plaintiff, { image: false });
    const { art, ...defendantOnly } = d;
    const r = await call('send_summons', { p_to: user(to), p_case: caseId, p_plaintiff: p, p_defendant: defendantOnly });
    return { id: cleanUuid(r?.id) };
  }
  async function rule(id, { verdict, stars, ratings }) {
    if (!VERDICTS.includes(verdict)) throw refuse('bad_verdict');
    await call('rule_summons', { p_id: user(id), p_verdict: verdict, p_stars: count(stars, 3), p_ratings: count(ratings, 100) });
    return handled();
  }
  const decline = async id => { await call('decline_summons', { p_id: user(id) }); return handled(); };
  const seen = async id => { const r = await call('mark_summons_seen', { p_id: user(id) }); handled(); return r?.ok === true; };
  // One fewer thing waiting, until the next look at the inbox says otherwise.
  function handled() { cloud.setMeta({ inboxCount: Math.max(0, inboxCount() - 1) }); emit(); return true; }
  async function inbox() {
    const box = readInbox(await call('inbox', {}));
    cloud.setMeta({ inboxCount: box.cases.length + box.results.length });
    emit();
    return box;
  }

  // ---- daily scores ----
  function gameDay(game, dayKey) {
    const day = isoDay(dayKey);
    if (!Object.hasOwn(SCORE_CAPS, game) || !day) throw refuse('bad_score');
    return day;
  }
  async function submitScore({ game, day, score, mod = '' }) {
    const d = gameDay(game, day);
    if (!Number.isFinite(score) || score < 0 || score > SCORE_CAPS[game]) throw refuse('bad_score');
    const r = await call('submit_score', { p_game: game, p_day: d, p_score: Math.floor(score), p_mod: String(mod).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) });
    return { best: Number.isFinite(r?.best) ? count(r.best, SCORE_CAPS[game]) : 0 };
  }
  async function board(game, day) { const d = gameDay(game, day); return readBoard(await call('friends_board', { p_game: game, p_day: d }), game); }
  async function percentile(game, day) { const d = gameDay(game, day); return readPercentile(await call('day_percentile', { p_game: game, p_day: d }), game); }

  // After a cloud push settles, show friends the shelf as it now is. The
  // sync engine reports 'syncing' then 'idle'; only that step counts.
  function syncStatus(info) {
    const status = info?.status || '';
    const settled = lastStatus === 'syncing' && status === 'idle';
    lastStatus = status;
    if (settled && active()) publish().catch(() => { /* the next push tries again */ });
  }

  return {
    active, optIn, signedIn, profile, setName, addFriend, friends, respond, remove, block, report,
    publish, shelf, serve, rule, decline, seen, inbox, inboxCount, submitScore, board, percentile, syncStatus,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
