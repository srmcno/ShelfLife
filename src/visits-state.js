// Residents staying between friends' shelves, kept in the save as
// state.friendVisits. (state.visits was already taken: it is the log of the
// player's own sessions, read by the note templates.)
//
//   guests:    residents staying on this shelf, at most two, each exactly
//              { visitId, from: { userId, name }, resident, arrived, leaves }
//              where resident is the readResident() shape (art allowed).
//              Read them through activeGuests() in src/engine/visits.js.
//   away:      this shelf's residents waiting at or staying with a friend:
//              { visitId, residentId, host: { userId, name }, status, leaves }
//   care:      what the host has done for each guest: { visitId: { food, fuss, clean } }
//   postcards: the newest twenty postcards home
//   souvenirs: keepsakes brought back, the newest sixty
//   paid:      visit and gift ids already paid, so nothing pays twice
//
// Guests never join state.pets, so they never count towards the household,
// achievements, rank or the arcade. Everything a friend sent is clamped here
// as well as on the way in, so a hand-edited save cannot bloat or break it.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const SLUG = /^[a-z0-9-]{1,40}$/;
const MOODS = ['content', 'fine', 'annoyed', 'furious'];
export const MAX_GUESTS = 2, MAX_AWAY = 20, MAX_POSTCARDS = 20, MAX_SOUVENIRS = 60, MAX_PAID = 120;
const MAX_ART_CHARS = 130 * 1024;

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : '';
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const text = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const time = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const int = (value, hi) => Number.isFinite(value) ? Math.max(0, Math.min(hi, Math.floor(value))) : 0;

export function blankFriendVisits() {
  return { guests: [], away: [], care: {}, postcards: [], souvenirs: [], paid: [] };
}

// The resident a friend sent, in the readResident() shape. Art is kept only
// while it is small and shaped like art; src/cloud/social.js cleans it again
// before anything draws it.
export function storedResident(raw) {
  if (!record(raw) || !petId(raw.id)) return null;
  let art = null;
  if (record(raw.art)) {
    try { if (JSON.stringify(raw.art).length <= MAX_ART_CHARS) art = JSON.parse(JSON.stringify(raw.art)); } catch { art = null; }
  }
  return {
    id: raw.id, name: text(raw.name, 22) || 'Someone',
    traits: Array.isArray(raw.traits) ? [...new Set(raw.traits.filter(t => typeof t === 'string' && SLUG.test(t)))].slice(0, 6) : [],
    mood: MOODS.includes(raw.mood) ? raw.mood : 'fine', bond: int(raw.bond, 25), art
  };
}

function guest(raw) {
  if (!record(raw)) return null;
  const visitId = uuid(raw.visitId), userId = uuid(raw.from?.userId), resident = storedResident(raw.resident);
  const arrived = time(raw.arrived), leaves = time(raw.leaves);
  if (!visitId || !userId || !resident || !arrived || leaves <= arrived) return null;
  return { visitId, from: { userId, name: text(raw.from.name, 24) }, resident, arrived, leaves };
}
function away(raw) {
  if (!record(raw)) return null;
  const visitId = uuid(raw.visitId), userId = uuid(raw.host?.userId);
  if (!visitId || !userId || !petId(raw.residentId)) return null;
  return { visitId, residentId: raw.residentId, host: { userId, name: text(raw.host.name, 24) },
    status: raw.status === 'accepted' ? 'accepted' : 'pending', leaves: time(raw.leaves) };
}
function postcard(raw) {
  if (!record(raw) || !uuid(raw.visitId)) return null;
  return { visitId: uuid(raw.visitId), host: text(raw.host, 24), pet: text(raw.pet, 22), text: text(raw.text, 400),
    souvenir: typeof raw.souvenir === 'string' && SLUG.test(raw.souvenir) ? raw.souvenir : '', souls: int(raw.souls, 99), at: time(raw.at) };
}
function souvenir(raw) {
  if (!record(raw) || typeof raw.id !== 'string' || !SLUG.test(raw.id) || !uuid(raw.visitId)) return null;
  return { id: raw.id, visitId: uuid(raw.visitId), host: text(raw.host, 24), pet: text(raw.pet, 22), at: time(raw.at) };
}
const unique = (list, key) => { const seen = new Set(); return list.filter(x => x && !seen.has(x[key]) && seen.add(x[key])); };

// Idempotent, additive and never throws: an old save gets the blank shape.
export function normalizeFriendVisits(raw) {
  const v = record(raw) ? raw : {};
  const out = blankFriendVisits();
  out.guests = unique((Array.isArray(v.guests) ? v.guests : []).slice(0, 10).map(guest), 'visitId').slice(0, MAX_GUESTS);
  out.away = unique((Array.isArray(v.away) ? v.away : []).slice(0, 60).map(away), 'visitId').slice(0, MAX_AWAY);
  if (record(v.care)) {
    for (const g of out.guests) {
      const c = v.care[g.visitId];
      if (record(c)) out.care[g.visitId] = { food: int(c.food, 30), fuss: int(c.fuss, 30), clean: int(c.clean, 30) };
    }
  }
  out.postcards = unique((Array.isArray(v.postcards) ? v.postcards : []).slice(0, 60).map(postcard), 'visitId').slice(0, MAX_POSTCARDS);
  out.souvenirs = unique((Array.isArray(v.souvenirs) ? v.souvenirs : []).slice(0, 200).map(souvenir), 'visitId').slice(0, MAX_SOUVENIRS);
  out.paid = [...new Set((Array.isArray(v.paid) ? v.paid : []).map(uuid).filter(Boolean))].slice(-MAX_PAID);
  return out;
}
