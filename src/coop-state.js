// Co-op in the save: who this shelf has put up for hire, trip reports waiting
// to be sent, memories of trips taken on other shelves, stakes held for duels,
// duel runs started, rounds already revealed and a copy of the records per
// friend. Small, capped and rebuilt from blank on every load; a field this
// build does not know is dropped. Nothing here imports the cloud or the DOM.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PET = /^[A-Za-z0-9_-]{1,100}$/;
const TRAIT = /^[a-z0-9-]{1,24}$/;
export const COOP_LIMITS = { listed: 2, outbox: 8, memories: 24, perPet: 3, done: 80, stakes: 20, attempts: 20, seen: 60, records: 50 };
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x, max = 1e14) => Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0;
const text = (x, max) => typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, max) : '';
const uuid = x => typeof x === 'string' && UUID.test(x) ? x.toLowerCase() : '';
const petId = x => typeof x === 'string' && PET.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x) ? x : '';
const intIn = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;

export function blankCoop() {
  return { v: 1, listed: [], outbox: [], memories: [], done: [], stakes: [], attempts: [], seen: [], records: {} };
}

// The trip report a hirer sends: ids and numbers only (see 0009_coop.sql).
export function normalizeTripReport(r) {
  if (!obj(r) || !['drawer', 'fridge', 'cupboard'].includes(r.route) || !['thread', 'lantern', 'biscuit'].includes(r.gear)) return null;
  if (!intIn(r.edition, 0, 7) || !intIn(r.rev, 1, 2) || !intIn(r.score, 0, 12) || !intIn(r.tier, 0, 2) || !intIn(r.returned, 0, 2)) return null;
  const choices = Array.isArray(r.choices) ? r.choices.filter(c => intIn(c, 0, 2)).slice(0, 3) : [];
  if (!choices.length) return null;
  return { route: r.route, gear: r.gear, edition: r.edition, rev: r.rev, score: r.score, tier: r.tier, returned: r.returned, built: r.built === true,
    choices, helped: [...new Set((Array.isArray(r.helped) ? r.helped : []).filter(h => intIn(h, 0, 2)))].sort().slice(0, 3),
    crew: (Array.isArray(r.crew) ? r.crew : []).map(c => text(c, 22)).filter(Boolean).slice(0, 2) };
}

// A friend's resident on this shelf's expedition: a copy for one trip. Only a
// generated creature's choices are kept (a few hundred bytes); a drawing stays
// out of the save and the trip shows its silhouette after a reload.
export function normalizeOutingGuest(g) {
  if (!obj(g) || !uuid(g.hireId) || !obj(g.from) || !uuid(g.from.userId) || !petId(g.id)) return null;
  const stats = {};
  for (const k of ['cute', 'menace', 'damp', 'mystique']) stats[k] = intIn(g.stats?.[k], 1, 10) ? g.stats[k] : 5;
  const creature = obj(g.art?.creature) && JSON.stringify(g.art.creature).length <= 4000 ? JSON.parse(JSON.stringify(g.art.creature)) : null;
  return { hireId: uuid(g.hireId), from: { userId: uuid(g.from.userId), name: text(g.from.name, 24) }, id: petId(g.id), name: text(g.name, 22) || 'Someone',
    traits: [...new Set((Array.isArray(g.traits) ? g.traits : []).filter(t => typeof t === 'string' && TRAIT.test(t)))].slice(0, 6), stats,
    art: creature ? { creature } : null };
}

function memory(m) {
  if (!obj(m) || !petId(m.petId) || typeof m.key !== 'string' || !/^coop:[a-z0-9:-]{1,80}$/i.test(m.key)) return null;
  const said = text(m.text, 400), evidence = text(m.evidence, 200);
  return said ? { petId: m.petId, key: m.key, text: said, evidence, at: num(m.at) } : null;
}

function record(r) {
  const out = {};
  for (const k of ['won', 'lost', 'tied', 'roundsWon', 'roundsLost', 'streak', 'best', 'trips']) out[k] = num(r?.[k], 1e6);
  out.at = num(r?.at);
  return out;
}

export function normalizeCoop(raw) {
  const s = blankCoop(), r = obj(raw) ? raw : {};
  s.listed = [...new Set((Array.isArray(r.listed) ? r.listed : []).map(petId).filter(Boolean))].slice(0, COOP_LIMITS.listed);
  const seenHires = new Set();
  s.outbox = (Array.isArray(r.outbox) ? r.outbox : []).map(x => {
    const report = normalizeTripReport(x?.report), hireId = uuid(x?.hireId);
    if (!report || !hireId || seenHires.has(hireId)) return null;
    seenHires.add(hireId);
    return { hireId, report, at: num(x.at), tries: num(x.tries, 99) };
  }).filter(Boolean).slice(-COOP_LIMITS.outbox);
  // The newest few per resident survive, then the newest overall.
  const perPet = {};
  s.memories = (Array.isArray(r.memories) ? r.memories : []).map(memory).reverse()
    .filter(m => m && (perPet[m.petId] = (perPet[m.petId] || 0) + 1) <= COOP_LIMITS.perPet).reverse()
    .slice(-COOP_LIMITS.memories);
  s.done = [...new Set((Array.isArray(r.done) ? r.done : []).filter(x => typeof x === 'string' && /^[hd]:[0-9a-f-]{36}$/i.test(x)))].slice(-COOP_LIMITS.done);
  const stakes = new Set();
  s.stakes = (Array.isArray(r.stakes) ? r.stakes : []).map(x => {
    const duelId = uuid(x?.duelId);
    if (!duelId || stakes.has(duelId) || !intIn(x.amount, 1, 25)) return null;
    stakes.add(duelId);
    return { duelId, amount: x.amount, at: num(x.at) };
  }).filter(Boolean).slice(-COOP_LIMITS.stakes);
  const attempts = new Set();
  s.attempts = (Array.isArray(r.attempts) ? r.attempts : []).map(x => {
    const duelId = uuid(x?.duelId);
    if (!duelId || !intIn(x.round, 1, 3) || attempts.has(duelId + ':' + x.round) || !['started', 'sent'].includes(x.state)) return null;
    attempts.add(duelId + ':' + x.round);
    return { duelId, round: x.round, state: x.state, score: num(x.score, 3000), at: num(x.at) };
  }).filter(Boolean).slice(-COOP_LIMITS.attempts);
  s.seen = [...new Set((Array.isArray(r.seen) ? r.seen : []).filter(x => typeof x === 'string' && /^[0-9a-f-]{36}:[1-3]$/i.test(x)))].slice(-COOP_LIMITS.seen);
  s.records = Object.fromEntries(Object.entries(obj(r.records) ? r.records : {}).filter(([k, v]) => uuid(k) && obj(v))
    .sort(([, a], [, b]) => num(b.at) - num(a.at)).slice(0, COOP_LIMITS.records).map(([k, v]) => [k.toLowerCase(), record(v)]));
  return s;
}

const checked = new WeakSet();
export function coopState(state) {
  if (!obj(state.coop) || !checked.has(state.coop)) { state.coop = normalizeCoop(state.coop); checked.add(state.coop); }
  return state.coop;
}

// What a resident remembers from trips on other shelves, newest first, for
// engine/resident-memory.js. Only residents still on this shelf.
export function coopMemories(state, pet) {
  if (!pet || !obj(state?.coop) || !Array.isArray(state.coop.memories)) return [];
  return state.coop.memories.filter(m => m?.petId === pet.id && typeof m.text === 'string').slice(-2).reverse()
    .map(m => ({ key: m.key, text: m.text, evidence: m.evidence || 'A field report from a friend’s expedition.' }));
}
