import { normalizeRewardHistory } from './reward-state.js';
import { HEX_BY_ID, TRICK_BY_ID, HELP_NEEDS } from './content/mischief.js';

/* Save data for mischief (engine/mischief.js): friends' hexes waiting for a
   place in the tray, the one haunting on the shelf, helps received, and what
   still has to be told to the server. Everything is small, capped and
   rebuilt from blank, so a hand-edited backup or an odd reply from a friend
   can never break the shelf or bloat the save. A friend's resident is checked
   for shape and size here and read again in full (cloud/social.js) before it
   is ever drawn. Imports content only: state.js and mayhem-state.js load this. */

export const PENDING_MAX = 3;        // two friends' hexes (the server's limit) and a trick
export const OUTBOX_MAX = 24;
export const HELP_LOG_MAX = 20;
export const DONE_MAX = 80;
export const GUEST_MAX_CHARS = 64 * 1024;
export const HEX_LIFE_MS = 48 * 3600000;
export const HAUNT_LIFE_MS = 24 * 3600000;
const WEEK = 7 * 86400000;

const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback, lo, hi) => (Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REF = /^(?:trick-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const uuid = value => (typeof value === 'string' && UUID.test(value) ? value : '');
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
// Plain words only: control characters and invisible marks become spaces.
const text = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function blankMischief() {
  return { v: 1, user: '', hexes: [], outbox: [], helps: [], haunt: null, done: [], shooRewards: {}, paid: { day: '', help: 0, knock: 0, shoo: 0 } };
}

// A friend's resident as the save keeps it. Shape and size only.
export function normalizeGuest(raw) {
  if (!object(raw) || !petId(raw.id)) return null;
  const out = { id: raw.id, name: text(raw.name, 22) || 'Someone',
    traits: (Array.isArray(raw.traits) ? raw.traits : []).filter(t => typeof t === 'string' && /^[a-z0-9-]{1,30}$/.test(t)).slice(0, 6),
    mood: ['content', 'fine', 'annoyed', 'furious'].includes(raw.mood) ? raw.mood : 'fine', bond: Math.floor(finite(raw.bond, 0, 0, 25)), art: { body: '', stamps: [] } };
  const art = object(raw.art) ? raw.art : {};
  if (object(art.creature)) {
    const creature = JSON.stringify(art.creature);
    if (creature.length <= 4096) out.art = { creature: JSON.parse(creature) };
  } else {
    const stamps = (Array.isArray(art.stamps) ? art.stamps : []).filter(object).slice(0, 48);
    out.art = { body: typeof art.body === 'string' && PNG.test(art.body) ? art.body : '', stamps: JSON.parse(JSON.stringify(stamps)) };
    if (object(art.bounds)) out.art.bounds = JSON.parse(JSON.stringify(art.bounds));
  }
  if (JSON.stringify(out).length > GUEST_MAX_CHARS) out.art.body = '';
  if (JSON.stringify(out).length > GUEST_MAX_CHARS) out.art = { body: '', stamps: [] };
  return out;
}

const fromOf = raw => ({ userId: uuid(raw?.userId), name: text(raw?.name, 24) });

// A hex or a trick: the payload of a tray entry, and of one still waiting for room. null when expired.
export function normalizeHexPayload(raw, now = Date.now()) {
  if (!object(raw) || raw.kind !== 'hex' || typeof raw.ref !== 'string' || !REF.test(raw.ref)) return null;
  const trick = raw.trick === true;
  if (!(trick ? TRICK_BY_ID : HEX_BY_ID)[raw.card]) return null;
  const culprit = normalizeGuest(raw.culprit);
  if (!culprit && !trick) return null;
  const arrived = finite(raw.arrived, now, 0, now);
  const expires = finite(raw.expires, 0, 0, arrived + HEX_LIFE_MS);
  if (!(expires > now)) return null;
  return { kind: 'hex', ref: raw.ref, card: raw.card, from: fromOf(raw.from), culprit, arrived, expires, rebound: raw.rebound === true, trick };
}

// A queue entry from outside the house, for normalizeMayhem.
export function normalizeExternalEntry(item, now = Date.now()) {
  const ext = normalizeHexPayload(item?.ext, now);
  if (!ext || !petId(item.a)) return null;
  return { uid: Math.floor(finite(item.uid, 0, 0, 1e9)), id: 'x:' + ext.card, a: item.a, at: finite(item.at, now, 0, now), ext };
}

const OPS = new Set(['resolve', 'decline', 'shoo', 'ack', 'seen']);
function normalizeOutboxItem(raw, now) {
  if (!object(raw) || !OPS.has(raw.op) || !uuid(raw.ref)) return null;
  const at = finite(raw.at, now, 0, now);
  if (raw.op !== 'shoo' && uuid(raw.user) && at < now - WEEK) return null;
  const out = { op: raw.op, ref: raw.ref, user: uuid(raw.user), at };
  if (raw.op === 'resolve') Object.assign(out, { choice: Math.floor(finite(raw.choice, 0, 0, 3)), outcome: Math.floor(finite(raw.outcome, 0, 0, 3)), rebound: raw.rebound === true });
  if (raw.op === 'shoo') out.taps = Math.floor(finite(raw.taps, 1, 1, 99));
  if (raw.op === 'seen') out.kind = raw.kind === 'haunt' ? 'haunt' : 'hex';
  return out;
}

function normalizeHelp(raw, now) {
  if (!object(raw) || !uuid(raw.id) || !petId(raw.petId) || !HELP_NEEDS.includes(raw.need)) return null;
  const applied = finite(raw.applied, now, 0, now);
  if (applied < now - WEEK) return null;
  return { id: raw.id, from: fromOf(raw.from), petId: raw.petId, petName: text(raw.petName, 22), need: raw.need,
    amount: Math.floor(finite(raw.amount, 0, 0, 30)), at: finite(raw.at, applied, 0, now), applied };
}

function normalizeHaunt(raw, now) {
  if (!object(raw) || !uuid(raw.ref)) return null;
  const ghost = normalizeGuest(raw.ghost);
  if (!ghost) return null;
  const arrived = finite(raw.arrived, now, 0, now);
  const ends = finite(raw.ends, 0, 0, arrived + HAUNT_LIFE_MS);
  // A shooed ghost is remembered until it would have left anyway, so it is not let back in.
  if (!(ends > now)) return null;
  return { ref: raw.ref, from: fromOf(raw.from), ghost, arrived, ends, shooed: raw.shooed === true, paid: raw.paid === true };
}

export function normalizeMischief(raw, state = {}, now = Date.now()) {
  const out = blankMischief();
  if (!object(raw)) return out;
  out.user = uuid(raw.user);
  const refs = new Set();
  out.hexes = (Array.isArray(raw.hexes) ? raw.hexes : []).map(h => normalizeHexPayload(h, now))
    .filter(h => h && !refs.has(h.ref) && refs.add(h.ref)).slice(0, PENDING_MAX);
  const outbox = (Array.isArray(raw.outbox) ? raw.outbox : []).map(x => normalizeOutboxItem(x, now)).filter(Boolean);
  const activity = new Set(outbox.filter(item => item.op !== 'shoo' && item.user).slice(-OUTBOX_MAX));
  out.outbox = outbox.filter(item => item.op === 'shoo' || !item.user || activity.has(item));
  out.shooRewards = normalizeRewardHistory(raw.shooRewards);
  const seen = new Set();
  out.helps = (Array.isArray(raw.helps) ? raw.helps : []).map(x => normalizeHelp(x, now)).filter(h => h && !seen.has(h.id) && seen.add(h.id)).slice(0, HELP_LOG_MAX);
  out.haunt = normalizeHaunt(raw.haunt, now);
  out.done = [...new Set((Array.isArray(raw.done) ? raw.done : []).filter(r => typeof r === 'string' && REF.test(r)))].slice(-DONE_MAX);
  if (object(raw.paid)) {
    out.paid = { day: typeof raw.paid.day === 'string' ? raw.paid.day.slice(0, 20) : '', help: Math.floor(finite(raw.paid.help, 0, 0, 99)),
      knock: Math.floor(finite(raw.paid.knock, 0, 0, 99)), shoo: Math.floor(finite(raw.paid.shoo, 0, 0, 99)) };
  }
  return out;
}

export function mischiefState(state) {
  if (!object(state.mischief)) state.mischief = blankMischief();
  if (!object(state.mischief.shooRewards)) state.mischief.shooRewards = {};
  return state.mischief;
}
