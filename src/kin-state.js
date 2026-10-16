// What a household remembers about Kin: which residents are foundlings and
// whose, the letters its residents have kept, a foundling waiting on the step
// for room, and birth notices not yet seen. Small, capped and additive; a
// save from before Kin loads with all of it empty, and normalizing twice
// changes nothing. Unknown fields are dropped.

export const KIN_FOUNDLINGS_MAX = 60;
export const KIN_LETTERS_PER_PAL = 10;
export const KIN_LETTERS_MAX = 240;
export const KIN_STEP_MAX = 3;
export const KIN_NOTICES_MAX = 10;
export const KIN_COLLECTED_MAX = 80;
export const KIN_TEXT_MAX = 720;
const STEP_PET_CHARS = 160000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && UUID.test(value) ? value : '';
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value) ? value : '';
const text = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').slice(0, max) : '';
const line = (value, max) => text(value, max).replace(/\s+/g, ' ').trim();
const time = (value, now) => Number.isFinite(value) && value > 0 ? Math.min(value, now) : 0;

export function blankKin() { return { foundlings: [], letters: [], step: [], notices: [], collected: [] }; }

function parent(raw) {
  if (!record(raw)) return null;
  const id = petId(raw.id);
  if (!id) return null;
  return { id, name: line(raw.name, 22) || 'Someone', home: raw.home === true, friend: raw.home === true ? '' : uuid(raw.friend), shelf: raw.home === true ? '' : line(raw.shelf, 24) };
}
function foundling(raw, now) {
  if (!record(raw)) return null;
  const pet = petId(raw.pet), basket = uuid(raw.basket);
  const parents = Array.isArray(raw.parents) ? raw.parents.slice(0, 2).map(parent) : [];
  if (!pet || !basket || parents.length !== 2 || parents.some(p => !p)) return null;
  const twin = record(raw.twin) ? { friend: uuid(raw.twin.friend), shelf: line(raw.twin.shelf, 24) } : { friend: '', shelf: '' };
  return { pet, basket, born: time(raw.born, now), name: line(raw.name, 22) || 'Foundling', parents, twin };
}
function letter(raw, now) {
  if (!record(raw)) return null;
  const id = uuid(raw.id), pal = uuid(raw.pal), mine = petId(raw.mine);
  if (!id || !pal || !mine || !['in', 'out'].includes(raw.dir) || !['weekly', 'reply'].includes(raw.kind)) return null;
  const body = text(raw.text, KIN_TEXT_MAX).trim();
  if (!body) return null;
  const out = { id, pal, week: Number.isInteger(raw.week) && raw.week >= 0 && raw.week <= 100000 ? raw.week : 0, at: time(raw.at, now), dir: raw.dir, kind: raw.kind,
    mine, theirs: line(raw.theirs, 22) || 'Someone', friend: uuid(raw.friend), shelf: line(raw.shelf, 24), text: body, read: raw.read === true,
    replied: raw.replied === true };
  const cards = replyCards(raw.cards);
  if (cards && out.dir === 'in' && out.kind === 'weekly') out.cards = cards;
  return out;
}
// What a reply to a weekly letter is written from: the pair's seed and the two residents.
function replyCards(raw) {
  if (!record(raw) || !Number.isInteger(raw.seed) || raw.seed < 0 || raw.seed > 2147483647) return null;
  const card = c => record(c) ? { name: line(c.name, 22) || 'Someone', traits: Array.isArray(c.traits) ? c.traits.filter(t => typeof t === 'string' && /^[a-z]{1,24}$/.test(t)).slice(0, 6) : [] } : null;
  const writer = card(raw.writer), reader = card(raw.reader);
  return writer && reader ? { seed: raw.seed, writer, reader } : null;
}
function stepPet(raw) {
  if (!record(raw) || !petId(raw.id) || typeof raw.name !== 'string') return null;
  let size;
  try { size = JSON.stringify(raw).length; } catch { return null; }
  if (size > STEP_PET_CHARS) return null;
  const pet = JSON.parse(JSON.stringify(raw));
  pet.name = line(pet.name, 22) || 'Foundling';
  const art = record(pet.art) ? pet.art : {};
  pet.art = { body: typeof art.body === 'string' ? art.body : '', stamps: Array.isArray(art.stamps) ? art.stamps.filter(record).slice(0, 48) : [],
    ...(record(art.creature) ? { creature: art.creature } : {}), ...(record(art.bounds) ? { bounds: art.bounds } : {}) };
  pet.traits = Array.isArray(pet.traits) ? pet.traits.filter(t => typeof t === 'string' && /^[a-z]{1,24}$/.test(t)).slice(0, 3) : [];
  return pet;
}

export function normalizeKin(raw, state = null, now = Date.now()) {
  const k = record(raw) ? raw : {};
  const out = blankKin();
  const seenPets = new Set(), seenBaskets = new Set();
  for (const item of Array.isArray(k.foundlings) ? k.foundlings : []) {
    const f = foundling(item, now);
    if (!f || seenPets.has(f.pet) || seenBaskets.has(f.basket)) continue;
    seenPets.add(f.pet); seenBaskets.add(f.basket);
    out.foundlings.push(f);
  }
  out.foundlings = out.foundlings.slice(-KIN_FOUNDLINGS_MAX);
  // Newest last; at most ten kept per pair of pen pals.
  const seenLetters = new Set(), perPal = new Map();
  const letters = (Array.isArray(k.letters) ? k.letters : []).map(item => letter(item, now)).filter(l => l && !seenLetters.has(l.id) && seenLetters.add(l.id));
  for (let i = letters.length - 1; i >= 0; i--) {
    const n = perPal.get(letters[i].pal) || 0;
    if (n >= KIN_LETTERS_PER_PAL) { letters.splice(i, 1); continue; }
    perPal.set(letters[i].pal, n + 1);
  }
  out.letters = letters.slice(-KIN_LETTERS_MAX);
  const ids = new Set((Array.isArray(state?.pets) ? state.pets : []).map(p => p?.id));
  for (const item of Array.isArray(k.step) ? k.step : []) {
    if (!record(item)) continue;
    const basket = uuid(item.basket), pet = stepPet(item.pet), kept = foundling(item.record, now);
    if (!basket || !pet || !kept || kept.pet !== pet.id || kept.basket !== basket || ids.has(pet.id) || out.step.some(s => s.basket === basket || s.pet.id === pet.id)) continue;
    out.step.push({ basket, at: time(item.at, now), pet, record: kept, note: line(item.note, 400) });
  }
  out.step = out.step.slice(0, KIN_STEP_MAX);
  for (const item of Array.isArray(k.notices) ? k.notices : []) {
    if (!record(item)) continue;
    const basket = uuid(item.basket), pet = petId(item.pet);
    if (!basket || !pet || out.notices.some(n => n.basket === basket)) continue;
    out.notices.push({ basket, pet, at: time(item.at, now), text: line(item.text, 400) });
  }
  out.notices = out.notices.slice(-KIN_NOTICES_MAX);
  out.collected = [...new Set((Array.isArray(k.collected) ? k.collected : []).map(uuid).filter(Boolean))].slice(-KIN_COLLECTED_MAX);
  return out;
}

// The live record, made on first use for a save that has never needed one.
export function kinState(state) {
  if (!record(state.kin)) state.kin = blankKin();
  for (const key of Object.keys(blankKin())) if (!Array.isArray(state.kin[key])) state.kin[key] = [];
  return state.kin;
}
