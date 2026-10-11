// Co-op in the save: who this shelf has put up for hire, trip reports waiting
// to be sent, memories of trips taken on other shelves, stakes held for duels,
// duel runs started, rounds already revealed and a copy of the records per
// friend. Small, capped and rebuilt from blank on every load; a field this
// build does not know is dropped. Nothing here imports the cloud or the DOM.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PET = /^[A-Za-z0-9_-]{1,100}$/;
const TRAIT = /^[a-z0-9-]{1,24}$/;
const DUEL_GAMES = ['frenzy', 'stack', 'seance', 'whack'];
export const COOP_LIMITS = { listed: 2, outbox: 8, memories: 24, perPet: 3, done: 80, stakes: 20, attempts: 20, seen: 60, records: 50 };
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x, max = 1e14) => Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0;
const text = (x, max) => typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, max) : '';
const uuid = x => typeof x === 'string' && UUID.test(x) ? x.toLowerCase() : '';
const petId = x => typeof x === 'string' && PET.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x) ? x : '';
const intIn = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;

export function blankCoop() {
  return { v: 2, listed: [], listedOwner: '', outbox: [], memories: [], done: [], stakes: [], attempts: [], seen: [], records: {}, recordsOwner: '', ledger: {}, money: { checkpoint: null, openings: {}, pending: [], rewards: {} } };
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
  return { hireId: uuid(g.hireId), ...(uuid(g.owner) ? { owner: uuid(g.owner) } : {}), from: { userId: uuid(g.from.userId), name: text(g.from.name, 24) }, id: petId(g.id), name: text(g.name, 22) || 'Someone',
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
  s.listedOwner = uuid(r.listedOwner); s.recordsOwner = uuid(r.recordsOwner);
  s.listed = [...new Set((Array.isArray(r.listed) ? r.listed : []).map(petId).filter(Boolean))].slice(0, COOP_LIMITS.listed);
  const seenHires = new Set();
  s.outbox = (Array.isArray(r.outbox) ? r.outbox : []).map(x => {
    const report = normalizeTripReport(x?.report), hireId = uuid(x?.hireId);
    if (!report || !hireId || seenHires.has(hireId)) return null;
    seenHires.add(hireId);
    return { hireId, ...(uuid(x.owner) ? { owner: uuid(x.owner) } : {}), report, at: num(x.at), tries: num(x.tries, 99) };
  }).filter(Boolean).slice(-COOP_LIMITS.outbox);
  // The newest few per resident survive, then the newest overall.
  const perPet = {};
  s.memories = (Array.isArray(r.memories) ? r.memories : []).map(memory).reverse()
    .filter(m => m && (perPet[m.petId] = (perPet[m.petId] || 0) + 1) <= COOP_LIMITS.perPet).reverse()
    .slice(-COOP_LIMITS.memories);
  s.done = [...new Set((Array.isArray(r.done) ? r.done : []).filter(x => typeof x === 'string' && /^(?:[0-9a-f-]{36}:)?[hd]:[0-9a-f-]{36}$/i.test(x)))].slice(-COOP_LIMITS.done);
  // Cursors are financial bookkeeping, not a recent-activity cache. Never prune
  // an owner's cursor: losing it would replay already paid receipts.
  s.ledger = Object.fromEntries(Object.entries(obj(r.ledger) ? r.ledger : {}).filter(([owner, v]) => uuid(owner) && obj(v))
    .map(([owner, v]) => [uuid(owner), { seq: num(v.seq, Number.MAX_SAFE_INTEGER), debt: num(v.debt) }]));
  const money = obj(r.money) ? r.money : {}, checkpoint = money.checkpoint;
  const balance = n => Number.isInteger(n) && n >= 0 && n <= 100000000;
  if (uuid(checkpoint?.owner) && balance(checkpoint.souls) && balance(checkpoint.lifetime))
    s.money.checkpoint = { owner: uuid(checkpoint.owner), souls: checkpoint.souls, lifetime: checkpoint.lifetime };
  s.money.openings = Object.fromEntries(Object.entries(obj(money.openings) ? money.openings : {}).filter(([owner, o]) =>
    uuid(owner) && obj(o) && balance(o.souls) && Number.isSafeInteger(o.after) && o.after >= 0)
    .map(([owner, o]) => [uuid(owner), { souls: o.souls, after: o.after }]));
  s.money.rewards = Object.fromEntries(Object.entries(obj(money.rewards) ? money.rewards : {}).filter(([owner, ids]) => uuid(owner) && Array.isArray(ids))
    .map(([owner, ids]) => [uuid(owner), [...new Set(ids.map(uuid).filter(Boolean))]]));
  const operations = new Set();
  // Unacknowledged money operations are never pruned by an activity limit.
  s.money.pending = (Array.isArray(money.pending) ? money.pending : []).filter(p => {
    if (!uuid(p?.id) || !uuid(p?.owner) || operations.has(p.owner + ':' + p.id) || !Number.isInteger(p.delta)
      || Math.abs(p.delta) > 100000000 || !balance(p.earned)) return false;
    operations.add(p.owner + ':' + p.id); return true;
  }).map(p => ({ id: uuid(p.id), owner: uuid(p.owner), delta: p.delta, earned: p.earned,
    ...(obj(p.detail) && JSON.stringify(p.detail).length < 4000 ? { detail: JSON.parse(JSON.stringify(p.detail)) } : {}) }));
  // Unowned v1 prototype records remain quarantined. An owner is never
  // guessed from whichever account happens to be signed in on load.
  const stakes = new Set();
  s.stakes = (Array.isArray(r.stakes) ? r.stakes : []).map(x => {
    const duelId = uuid(x?.duelId), owner = uuid(x?.owner);
    const key = owner + ':' + duelId;
    if (!duelId || stakes.has(key) || !intIn(x.amount, 1, 25)) return null;
    stakes.add(key);
    return { duelId, ...(owner ? { owner } : {}), amount: x.amount, at: num(x.at) };
  }).filter(Boolean).slice(-COOP_LIMITS.stakes);
  // A duel run started, played (its score kept until the server has it, with
  // the first player's log while it fits) or sent. Two logs at most.
  const attempts = new Set();
  let logs = 0;
  s.attempts = (Array.isArray(r.attempts) ? r.attempts : []).map(x => {
    const duelId = uuid(x?.duelId), owner = uuid(x?.owner);
    const key = owner + ':' + duelId + ':' + x?.round;
    if (!duelId || !intIn(x.round, 1, 3) || attempts.has(key) || !['started', 'played', 'sent'].includes(x.state)) return null;
    attempts.add(key);
    const out = { duelId, ...(owner ? { owner } : {}), round: x.round, state: x.state, score: num(x.score, 3000), at: num(x.at) };
    if (DUEL_GAMES.includes(x.game)) out.game = x.game;
    if (intIn(x.seed, 1, 2147483647)) out.seed = x.seed;
    if (x.state === 'played' && obj(x.log) && JSON.stringify(x.log).length <= 30000) out.log = x.log;
    return out;
  }).filter(Boolean).slice(-COOP_LIMITS.attempts).reverse().map(a => { if (a.log && ++logs > 2) delete a.log; return a; }).reverse();
  s.seen = [...new Set((Array.isArray(r.seen) ? r.seen : []).filter(x => typeof x === 'string' && /^(?:[0-9a-f-]{36}:)?[0-9a-f-]{36}:[1-3]$/i.test(x)))].slice(-COOP_LIMITS.seen);
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
