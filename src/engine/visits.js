// Visits between friends' shelves, the postcards they come home with, and the
// friendship levels: the rules, without the network or the page. The server
// (supabase/migrations/0003_postbox_visits.sql) decides who may send what and
// what it pays; this file turns its answers into the save and into words.
import { addSouls } from './mayhem.js';
import {
  GUEST_REACTIONS, TRAIT_REACTIONS, POSTCARD_COMPLAINTS, POSTCARD_DECLINED, POSTCARD_LAPSED, THANK_YOU_NOTES,
  SOUVENIRS, SOUVENIR_BY_ID, FRIEND_LEVELS, DAY_WORDS
} from '../content/postbox.js';
import { blankFriendVisits, storedResident, MAX_POSTCARDS, MAX_SOUVENIRS, MAX_PAID } from '../visits-state.js';

const visits = state => {
  if (!state.friendVisits || typeof state.friendVisits !== 'object') state.friendVisits = blankFriendVisits();
  return state.friendVisits;
};

// FNV-1a: the same visit always gets the same complaint and the same souvenir.
export function seedOf(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const pick = (list, seed) => list[seed % list.length];
export const fill = (template, vars) => String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
export const timesWord = n => n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times';

/* ---- guests on this shelf ---- */

// The friends' residents on this shelf right now, oldest arrival first, each
// exactly { visitId, from: { userId, name }, resident, arrived, leaves }.
// The Court reads these to seat guests; nothing else about the household does.
export function activeGuests(state, now = Date.now()) {
  const list = Array.isArray(state?.friendVisits?.guests) ? state.friendVisits.guests : [];
  return list.filter(g => g && g.arrived <= now && g.leaves > now)
    .sort((a, b) => a.arrived - b.arrived)
    .map(g => ({ visitId: g.visitId, from: { userId: g.from.userId, name: g.from.name }, resident: g.resident, arrived: g.arrived, leaves: g.leaves }));
}
// Where one of our residents is staying, if anywhere: { host, status, leaves }.
export function awayFor(state, residentId, now = Date.now()) {
  const list = Array.isArray(state?.friendVisits?.away) ? state.friendVisits.away : [];
  return list.find(a => a.residentId === residentId && (a.status === 'pending' || a.leaves > now)) || null;
}
export function careCounts(state, visitId) {
  const c = state?.friendVisits?.care?.[visitId];
  return { food: c?.food || 0, fuss: c?.fuss || 0, clean: c?.clean || 0 };
}
export function recordCare(state, visitId, { fed = 0, fussed = 0, washed = 0 } = {}) {
  const v = visits(state);
  if (!v.guests.some(g => g.visitId === visitId)) return false;
  v.care[visitId] = { food: fed, fuss: fussed, clean: washed };
  return true;
}

// The postbox reply (already through src/cloud/postbox.js) becomes who is
// staying here and who of ours is away. Returns true when the save changed.
export function applyPostbox(state, box, now = Date.now()) {
  if (!state || !box) return false;
  const v = visits(state);
  const before = JSON.stringify([v.guests, v.away, v.care]);
  v.guests = (box.guests || []).slice(0, 2).map(g => ({
    visitId: g.id, from: { userId: g.fromUser, name: g.fromName }, resident: storedResident(g.resident), arrived: g.arrived, leaves: g.leaves
  })).filter(g => g.resident && g.leaves > now);
  const care = {};
  for (const g of box.guests || []) if (v.guests.some(x => x.visitId === g.id)) care[g.id] = { food: g.fed, fuss: g.fussed, clean: g.washed };
  v.care = care;
  v.away = (box.away || []).slice(0, 20).map(a => ({
    visitId: a.id, residentId: a.residentId, host: { userId: a.toUser, name: a.toName }, status: a.status, leaves: a.leaves
  }));
  return before !== JSON.stringify([v.guests, v.away, v.care]);
}
// Guests whose time is up leave on their own, even offline.
export function dropDepartedGuests(state, now = Date.now()) {
  const v = visits(state), keep = v.guests.filter(g => g.leaves > now);
  if (keep.length === v.guests.length) return false;
  v.guests = keep;
  for (const id of Object.keys(v.care)) if (!keep.some(g => g.visitId === id)) delete v.care[id];
  return true;
}

// The guest answers in its own manner: a trait first, if it has one that
// fits, otherwise a line for that kind of care.
export function reactionLine(resident, kind, seed = 0) {
  const name = resident?.name || 'The guest';
  const traits = (resident?.traits || []).filter(t => TRAIT_REACTIONS[t] && ['any', kind].includes(TRAIT_REACTIONS[t].need));
  const own = traits.length && seed % 3 !== 2 ? TRAIT_REACTIONS[pick(traits, seed)].line : '';
  return fill(own || pick(GUEST_REACTIONS[kind] || GUEST_REACTIONS.fuss, seed), { pet: name });
}

/* ---- the end of a visit ---- */

export const souvenirFor = visitId => pick(SOUVENIRS, seedOf('souvenir:' + visitId));

// What the host did, then the guest's view of it. Ending:
// { id, status: ended | declined | lapsed, otherName, residentName, fed, fussed, washed, days }
export function postcardText(e) {
  const host = e.otherName || 'Your friend', pet = e.residentName || 'Your resident', seed = seedOf(e.id || pet);
  if (e.status === 'declined') return fill(pick(POSTCARD_DECLINED, seed), { host, pet });
  if (e.status === 'lapsed') return fill(pick(POSTCARD_LAPSED, seed), { host, pet });
  const acts = [['fed', e.fed], ['fussed over', e.fussed], ['washed', e.washed]].filter(([, n]) => n > 0);
  const total = (e.fed || 0) + (e.fussed || 0) + (e.washed || 0);
  let facts;
  if (!acts.length) facts = pet + ' stayed ' + (DAY_WORDS[e.days] || 'a while') + ' at ' + host + '’s.';
  else {
    const parts = acts.map(([verb, n], i) => verb + ' ' + (i ? 'them' : pet) + ' ' + timesWord(n));
    facts = host + ' ' + (parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1)) + '.';
  }
  const most = !total ? 'none' : total >= 12 ? 'lots' : [['clean', e.washed], ['food', e.fed], ['fuss', e.fussed]].sort((a, b) => b[1] - a[1])[0][0];
  return facts + ' ' + fill(pick(POSTCARD_COMPLAINTS[most], seed), { pet });
}
export function thankYouText(e) {
  const pet = e.residentName || 'Your guest', owner = e.otherName || 'its shelf';
  return pet + ' has gone home to ' + owner + '. It left a note: “' + pick(THANK_YOU_NOTES, seedOf('thanks:' + e.id)) + '”';
}

// Reading the end of a visit, once. `souls` is what the server decided to pay.
// The sender keeps the postcard and the souvenir; the host keeps nothing but
// the souls and the memory. Returns what was added.
export function collectEnding(state, e, souls = 0, now = Date.now()) {
  const v = visits(state);
  if (!e?.id || v.paid.includes(e.id)) return { souls: 0, postcard: v.postcards.find(p => p.visitId === e?.id) || null, souvenir: null, again: true };
  const paid = Math.max(0, Math.min(20, Math.floor(Number(souls) || 0)));
  if (paid) addSouls(state, paid);
  v.paid = [...v.paid, e.id].slice(-MAX_PAID);
  if (e.role === 'host') return { souls: paid, postcard: null, souvenir: null, text: thankYouText(e) };
  const souvenir = e.status === 'ended' ? souvenirFor(e.id) : null;
  const postcard = { visitId: e.id, host: e.otherName || '', pet: e.residentName || '', text: postcardText(e), souvenir: souvenir?.id || '', souls: paid, at: now };
  v.postcards = [postcard, ...v.postcards.filter(p => p.visitId !== e.id)].slice(0, MAX_POSTCARDS);
  if (souvenir) v.souvenirs = [{ id: souvenir.id, visitId: e.id, host: postcard.host, pet: postcard.pet, at: now }, ...v.souvenirs].slice(0, MAX_SOUVENIRS);
  v.away = v.away.filter(a => a.visitId !== e.id);
  return { souls: paid, postcard, souvenir, text: postcard.text };
}
// A gift's souls, once.
export function collectGift(state, giftId, souls = 0) {
  const v = visits(state);
  if (!giftId || v.paid.includes(giftId)) return 0;
  const paid = Math.max(0, Math.min(20, Math.floor(Number(souls) || 0)));
  if (paid) addSouls(state, paid);
  v.paid = [...v.paid, giftId].slice(-MAX_PAID);
  return paid;
}
export const souvenirInfo = id => SOUVENIR_BY_ID[id] || null;

/* ---- friendship levels ---- */

// { index, name, line, total, at, next (points for the next level, or null), progress 0..1 }
export function friendLevel(total = 0) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  let index = 0;
  FRIEND_LEVELS.forEach((level, i) => { if (t >= level.at) index = i; });
  const level = FRIEND_LEVELS[index], next = FRIEND_LEVELS[index + 1] || null;
  return { index, name: level.name, line: level.line, total: t, at: level.at, next: next ? next.at : null, nextName: next?.name || '',
    progress: next ? (t - level.at) / (next.at - level.at) : 1 };
}
