import { CURIOS } from './content/mayhem.js';
import { SEASONAL_CURIOS } from './content/seasons.js';
import { ALMANAC_CURIOS } from './content/almanac.js';
import { TRAIT_BY_ID } from './content/traits.js';

/* Save data for trading with friends (engine/trades.js, ui/trades.js).
   Everything is additive: a save from before trading loads with an empty
   book, and a save written by this build loads unchanged into an older one
   (the field is ignored there). Everything is bounded, so nothing a friend
   sends can bloat the save.

     wishlist   curio ids the player would like (12 at most)
     escrow     { tradeId: { user, to, toName, curios: { id: n }, residentId, at } }
                what this player has promised in an open offer; held aside
     applied    [{ id, at }] trades already applied to this shelf, by id, with
                the server's time of sealing. A replay, a second device or a
                restored backup checks here before applying anything twice.
     ledger     { userId: seq } how far this copy has read each account's
                settlement ledger (0004 trade_ledger). Everything up to seq is
                applied or deliberately skipped; anything after is read again
                and applied once, by trade id. Saved with the shelf, so a
                restored backup carries the cursor it had and catches up.
     floor      ms. Settlements before this were settled by an older build of
                the game (which forgot its records after 75 days), so they are
                taken as applied. 0 for a save written by this build.
     portraits  framed portraits of residents who left by trade (24 at most)
     waiting    residents who arrived when the shelf was full, every one of
                them, until there is room (nothing ever pushes one out)
     notices    news for the postbox until the player has seen it (20 at most)

   Pets that arrived by trade carry `arrivedByTrade: { id, at, from }`. */
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const safeId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);

export const TRADE_CURIO_IDS = new Set([...CURIOS, ...SEASONAL_CURIOS, ...ALMANAC_CURIOS].map(c => c.id));
export const WISHLIST_MAX = 12;
export const ESCROW_MAX = 50;
export const APPLIED_MAX = 400;
export const PORTRAIT_MAX = 24;
export const NOTICE_MAX = 20;
export const NOTICE_KINDS = ['sealed', 'declined', 'expired', 'cancelled', 'countered', 'restored', 'arrived-waiting'];
export const MAX_ART_CHARS = 120 * 1024;

export function blankTrades() {
  return { v: 1, wishlist: [], escrow: {}, applied: [], ledger: {}, floor: 0, portraits: [], waiting: [], notices: [] };
}

function curioMap(raw, perItem = 3) {
  const out = {};
  if (!object(raw)) return out;
  for (const [id, n] of Object.entries(raw)) {
    if (TRADE_CURIO_IDS.has(id) && Number.isInteger(n) && n >= 1) out[id] = Math.min(n, perItem);
  }
  return out;
}

// Art a portrait or a waiting resident can keep: a generated creature, or a
// PNG drawing under the friends limit, with its stamps.
export function tradeArt(raw) {
  if (!object(raw)) return { body: '', stamps: [] };
  const out = { body: typeof raw.body === 'string' && raw.body.length <= MAX_ART_CHARS && PNG.test(raw.body) ? raw.body : '',
    stamps: Array.isArray(raw.stamps) ? raw.stamps.filter(s => object(s) && typeof s.kind === 'string' && [s.x, s.y, s.size].every(Number.isFinite)).slice(0, 48) : [] };
  if (object(raw.creature)) out.creature = raw.creature;
  if (object(raw.bounds) && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(raw.bounds[k]))) out.bounds = { ...raw.bounds };
  return out;
}

function normalizePortrait(p, now) {
  if (!object(p) || !UUID.test(p.id || '') || typeof p.name !== 'string') return null;
  return {
    id: p.id, petId: safeId(p.petId) ? p.petId : '', name: p.name.slice(0, 22) || 'Someone', to: text(p.to, 24),
    at: finite(p.at, now, 0, now + 86400000), art: tradeArt(p.art), lastLine: text(p.lastLine, 300),
    lines: (Array.isArray(p.lines) ? p.lines : []).filter(l => typeof l === 'string').slice(0, 6).map(l => l.slice(0, 240))
  };
}

function normalizeWaiting(w, now) {
  if (!object(w) || !UUID.test(w.trade || '') || !object(w.pet) || w.pet.id !== 'tr-' + w.trade) return null;
  const pet = { ...w.pet, name: text(w.pet.name, 22) || 'Someone', art: tradeArt(w.pet.art),
    traits: (Array.isArray(w.pet.traits) ? w.pet.traits : []).filter(t => Object.hasOwn(TRAIT_BY_ID, t)).slice(0, 6) };
  return { trade: w.trade, pet, at: finite(w.at, now, 0, now + 86400000) };
}

export function normalizeTrades(raw, state = {}, now = Date.now()) {
  const out = blankTrades();
  const pets = Array.isArray(state.pets) ? state.pets : [];
  // A resident that arrived by trade remembers it; a malformed record is dropped, never the resident.
  for (const p of pets) {
    if (!object(p) || p.arrivedByTrade === undefined) continue;
    const a = p.arrivedByTrade;
    if (object(a) && UUID.test(a.id || '')) p.arrivedByTrade = { id: a.id, at: finite(a.at, 0, 0, now + 86400000), from: text(a.from, 24) };
    else delete p.arrivedByTrade;
  }
  if (!object(raw)) return out;
  out.wishlist = [...new Set((Array.isArray(raw.wishlist) ? raw.wishlist : []).filter(id => TRADE_CURIO_IDS.has(id)))].slice(0, WISHLIST_MAX);
  if (object(raw.escrow)) {
    for (const [id, e] of Object.entries(raw.escrow).slice(0, ESCROW_MAX)) {
      if (!UUID.test(id) || !object(e)) continue;
      const curios = curioMap(e.curios), residentId = safeId(e.residentId) ? e.residentId : '';
      if (!residentId && !Object.keys(curios).length) continue;
      out.escrow[id] = { user: UUID.test(e.user || '') ? e.user : '', to: UUID.test(e.to || '') ? e.to : '', toName: text(e.toName, 24),
        curios, residentId, at: finite(e.at, now, 0, now + 86400000), ...(e.accepting === true ? { accepting: true } : {}) };
    }
  }
  const applied = new Map();
  for (const a of Array.isArray(raw.applied) ? raw.applied : []) {
    if (object(a) && UUID.test(a.id || '') && !applied.has(a.id)) applied.set(a.id, { id: a.id, at: finite(a.at, 0, 0, now + 86400000) });
  }
  out.applied = [...applied.values()].sort((a, b) => b.at - a.at).slice(0, APPLIED_MAX);
  if (object(raw.ledger)) {
    for (const [user, seq] of Object.entries(raw.ledger)) {
      if (UUID.test(user) && Number.isSafeInteger(seq) && seq >= 0) out.ledger[user] = seq;
    }
    out.floor = finite(raw.floor, 0, 0, now);
  } else {
    // Written before the ledger: an older build applied trades from a 60 day
    // window and forgot its records after 75 days, so anything settled more
    // than 75 days before this copy was last played is already in it.
    const last = finite(state.lastTick, now, 0, now);
    out.floor = Math.max(0, last - 75 * 86400000);
  }
  out.portraits = (Array.isArray(raw.portraits) ? raw.portraits : []).map(p => normalizePortrait(p, now)).filter(Boolean)
    .filter((p, i, list) => list.findIndex(q => q.id === p.id) === i).slice(0, PORTRAIT_MAX);
  const seated = new Set(pets.map(p => p && p.id));
  out.waiting = (Array.isArray(raw.waiting) ? raw.waiting : []).map(w => normalizeWaiting(w, now)).filter(w => w && !seated.has(w.pet.id))
    .filter((w, i, list) => list.findIndex(x => x.trade === w.trade) === i);
  out.notices = (Array.isArray(raw.notices) ? raw.notices : []).filter(n => object(n) && UUID.test(n.id || '') && NOTICE_KINDS.includes(n.kind))
    .slice(0, NOTICE_MAX).map(n => ({ id: n.id, kind: n.kind, at: finite(n.at, now, 0, now + 86400000), title: text(n.title, 120), text: text(n.text, 600),
      ...(typeof n.last === 'string' ? { last: n.last.slice(0, 300) } : {}), ...(typeof n.first === 'string' ? { first: n.first.slice(0, 300) } : {}) }));
  return out;
}

export function tradesState(state) {
  if (!object(state.trades) || state.trades.v !== 1) state.trades = normalizeTrades(state.trades, state);
  return state.trades;
}
