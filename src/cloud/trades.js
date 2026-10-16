// Trading with friends over the one cloud session. The schema is
// supabase/migrations/0004_trades.sql; the save side is src/engine/trades.js.
//
// As in social.js, the server is trusted for decisions (who may trade, whether
// an offer was accepted) and never for shapes: every reply is read through the
// functions below before the game touches it. Residents are rebuilt from known
// parts, drawings are PNGs under 120 KB, curios are ids this build knows, and
// text is clamped. Nothing here runs by itself.
import { CloudError } from './client.js';
import { cleanText, cleanUuid, readResident, residentSnapshot, socialCode, socialText, MAX_SUMMONS_CHARS } from './social.js';
import { TRADE_CURIO_IDS } from '../trade-state.js';
import { TRADE_LINE_BY_ID } from '../content/trades.js';

export const TRADE_STATUSES = ['open', 'accepted', 'declined', 'cancelled', 'countered', 'expired'];
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const cleanTime = value => { const t = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(t) && t > 0 ? t : 0; };

// ---------------------------------------------------------------------------
// Refusals, as the player reads them
// ---------------------------------------------------------------------------
const TEXT = {
  dnd: 'They have asked not to be disturbed. Try again another day.',
  bad_trade: 'The undertaker could not read that offer. Nothing was sent.',
  too_large: 'That resident is too large to post. Drawn residents take the most room.',
  too_many_open: 'There are already five offers open between you. Let some of them settle first.',
  rate_limited: 'That is enough paperwork for one day. The undertaker has put his pen down until tomorrow.',
  not_enough: 'You do not have that many spares any more. Another of your devices may have promised them already, which the undertaker considers greedy.',
  resident_limit: 'Two residents a week is the limit. Moving house is hard on everyone, especially the house.',
  in_escrow: 'That resident is already packed for another offer.',
  already_traded: 'That resident has already been traded away. The paperwork says so, and the paperwork is never wrong.',
  too_soon: 'That resident only just arrived by trade. Let it unpack for a week first.',
  not_found: 'That offer is no longer on file.',
  not_open: 'That offer has already been settled.',
  expired: 'That offer expired. The ink has gone brown.',
  no_counter: 'A counter-offer cannot be countered. Accept it or decline it.',
  not_friends: 'You are not friends with them any more, so there is nobody to trade with.'
};
const TOKENS = new Set(Object.keys(TEXT));
export function tradeCode(error) {
  if (!error) return 'unexpected';
  if (TOKENS.has(error.code)) return error.code;
  if (error.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  return socialCode(error);
}
export function tradeText(error) {
  const code = tradeCode(error);
  return TEXT[code] || socialText(error);
}
const refuse = (code, status = 0) => new CloudError(TEXT[code] || socialText({ code }), { code, status });

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------
// A traded resident: what readResident keeps, plus the personality it travels with.
export function readTradeResident(raw, { art = true } = {}) {
  const r = readResident(raw, { art });
  if (!r) return null;
  const stats = {};
  if (record(raw.stats)) for (const k of ['cute', 'menace', 'damp', 'mystique']) if (Number.isFinite(raw.stats[k])) stats[k] = Math.max(1, Math.min(10, Math.round(raw.stats[k])));
  const out = { id: r.id, name: r.name, traits: r.traits, stats, bio: typeof raw.bio === 'string' ? cleanText(raw.bio, 600) : '' };
  if (art) out.art = r.art;
  return out;
}

/* { id, from, to, fromName, toName, kind, status, parent, line, createdAt,
     expiresAt, closedAt, give, want, unknown }
   give is what the sender hands over, want what the receiver would hand over:
   { curios: [{ id, n }], resident: { id, name, traits, stats, bio, art? } | null }.
   `unknown` is true when the server named a curio this build does not know:
   such an offer can be looked at but not accepted. */
export function readTrade(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), from = cleanUuid(raw.from_user), to = cleanUuid(raw.to_user);
  if (!id || !from || !to || !['curio', 'resident'].includes(raw.kind) || !TRADE_STATUSES.includes(raw.status)) return null;
  const side = () => ({ curios: [], resident: null });
  const give = side(), want = side();
  let unknown = false;
  for (const item of Array.isArray(raw.items) ? raw.items.slice(0, 8) : []) {
    if (!record(item) || !['from', 'to'].includes(item.side) || typeof item.ref !== 'string' || !PET_ID.test(item.ref)) continue;
    const target = item.side === 'from' ? give : want;
    if (item.kind === 'curio') {
      const n = Number.isInteger(item.qty) ? Math.max(1, Math.min(3, item.qty)) : 1;
      if (!TRADE_CURIO_IDS.has(item.ref)) { unknown = true; continue; }
      if (!target.curios.some(c => c.id === item.ref) && target.curios.length < 3) target.curios.push({ id: item.ref, n });
    } else if (item.kind === 'resident' && !target.resident) {
      const snap = record(item.snapshot) ? item.snapshot : { id: item.ref, name: 'Someone' };
      const art = record(snap.art);
      const r = readTradeResident({ ...snap, id: item.ref }, { art });
      if (r) {
        // A light snapshot came without its drawing; say so rather than drawing a blank.
        if (art && snap.art.creature === undefined && typeof snap.art.body !== 'string') r.artPending = true;
        // Only an id and a name: a resident asked for but not yet given, or one whose snapshot has expired.
        if (!art) r.placeholder = true;
        target.resident = r;
      }
    }
  }
  const line = typeof raw.line === 'string' && TRADE_LINE_BY_ID[raw.line] ? raw.line : '';
  return {
    id, from, to, fromName: cleanText(raw.from_name, 24), toName: cleanText(raw.to_name, 24), kind: raw.kind, status: raw.status,
    parent: cleanUuid(raw.parent) || null, line, createdAt: cleanTime(raw.created_at), expiresAt: cleanTime(raw.expires_at),
    closedAt: cleanTime(raw.closed_at), give, want, unknown
  };
}
export function readTradeList(raw) {
  const r = record(raw) ? raw : {};
  const seen = new Set();
  const trades = (Array.isArray(r.trades) ? r.trades.slice(0, 160) : []).map(readTrade).filter(t => t && !seen.has(t.id) && seen.add(t.id));
  return { now: cleanTime(r.now), count: Number.isInteger(r.count) ? Math.max(0, Math.min(99, r.count)) : 0, trades };
}
// One entry of the caller's settlement ledger, from their side:
// { seq, tradeId, kind, role, partnerName, settledAt, curiosOut, curiosIn,
//   residentOut: { id, name } | null, residentIn: resident | null }.
// A residentIn without its drawing is a placeholder (only a name survived).
const ledgerCurios = list => {
  const out = [];
  for (const c of Array.isArray(list) ? list.slice(0, 3) : []) {
    if (!record(c) || typeof c.id !== 'string' || !TRADE_CURIO_IDS.has(c.id) || out.some(x => x.id === c.id)) continue;
    out.push({ id: c.id, n: Number.isInteger(c.n) ? Math.max(1, Math.min(3, c.n)) : 1 });
  }
  return out;
};
export function readLedgerEntry(raw) {
  if (!record(raw) || !Number.isSafeInteger(raw.seq) || raw.seq < 1) return null;
  const tradeId = cleanUuid(raw.trade_id);
  if (!tradeId || !['curio', 'resident'].includes(raw.kind) || !['from', 'to'].includes(raw.role)) return null;
  let residentOut = null, residentIn = null;
  if (record(raw.resident_out) && typeof raw.resident_out.id === 'string' && PET_ID.test(raw.resident_out.id)) {
    residentOut = { id: raw.resident_out.id, name: cleanText(raw.resident_out.name, 22) || 'Someone' };
  }
  if (record(raw.resident_in) && typeof raw.resident_in.id === 'string' && PET_ID.test(raw.resident_in.id)) {
    const art = record(raw.resident_in.art);
    residentIn = readTradeResident(raw.resident_in, { art });
    if (residentIn && !art) residentIn.placeholder = true;
  }
  return { seq: raw.seq, tradeId, kind: raw.kind, role: raw.role, partnerName: cleanText(raw.partner_name, 24), settledAt: cleanTime(raw.settled_at),
    curiosOut: ledgerCurios(raw.curios_out), curiosIn: ledgerCurios(raw.curios_in), residentOut, residentIn };
}
// { now, head, next, more, entries } with entries in seq order, after `after`.
export function readLedger(raw, after = 0) {
  const r = record(raw) ? raw : {};
  const entries = (Array.isArray(r.effects) ? r.effects.slice(0, 50) : []).map(readLedgerEntry)
    .filter(e => e && e.seq > after).sort((a, b) => a.seq - b.seq).filter((e, i, list) => i === 0 || list[i - 1].seq !== e.seq);
  const head = Number.isSafeInteger(r.head) && r.head >= 0 ? r.head : 0;
  const last = entries.length ? entries.at(-1).seq : after;
  const next = Number.isSafeInteger(r.next) && r.next >= after && r.next <= Math.max(head, last) ? Math.max(r.next, last) : last;
  return { now: cleanTime(r.now), head, next, more: r.more === true && next < head, entries };
}
export function readTradeBook(raw) {
  if (!record(raw)) return null;
  const wishlist = [...new Set((Array.isArray(raw.wishlist) ? raw.wishlist : []).filter(id => typeof id === 'string' && TRADE_CURIO_IDS.has(id)))].slice(0, 12);
  const spares = {};
  if (record(raw.spares)) for (const [id, n] of Object.entries(raw.spares).slice(0, 60)) if (TRADE_CURIO_IDS.has(id) && Number.isInteger(n) && n > 0) spares[id] = Math.min(n, 99);
  return { wishlist, spares, updatedAt: cleanTime(raw.updated_at) };
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------
// A resident as it travels: its look (a drawing must fit, it is never
// dropped), name, traits, stats and biography. Null when it cannot travel.
export function tradeSnapshot(pet) {
  if (!record(pet) || typeof pet.id !== 'string' || !PET_ID.test(pet.id)) return null;
  const snap = residentSnapshot(pet);
  if (!pet.art?.creature && pet.art?.body && !snap.art.body) return null;
  const stats = {};
  for (const k of ['cute', 'menace', 'damp', 'mystique']) stats[k] = Number.isFinite(pet.stats?.[k]) ? Math.max(1, Math.min(10, Math.round(pet.stats[k]))) : 5;
  const out = { id: snap.id, name: snap.name, traits: snap.traits, stats, bio: cleanText(pet.bio || '', 600), art: snap.art };
  return JSON.stringify(out).length > MAX_SUMMONS_CHARS ? null : out;
}
const curioItems = map => Object.entries(map || {}).filter(([id, n]) => TRADE_CURIO_IDS.has(id) && n > 0).slice(0, 3).map(([id, n]) => ({ id, n: Math.min(3, Math.floor(n)) }));

// ---------------------------------------------------------------------------
// The wrappers
// ---------------------------------------------------------------------------
export function createTrades({ cloud }) {
  const signedIn = () => !!cloud?.configured && cloud.signedIn();
  async function call(name, args) {
    if (!signedIn()) throw refuse('signed_out', 401);
    try { return await cloud.rpc(name, args); }
    catch (error) {
      const code = tradeCode(error);
      throw Object.assign(new CloudError(TEXT[code] || socialText(error), { code, status: error?.status || 0 }), { offline: code === 'offline' });
    }
  }
  const id = value => { const v = cleanUuid(value); if (!v) throw refuse('not_found'); return v; };
  // { seq, curios: { id: n } } as the save holds them (engine declaredHoldings).
  function haveArg(have) {
    const curios = {};
    for (const [cid, n] of Object.entries(have?.curios || {})) if (TRADE_CURIO_IDS.has(cid) && Number.isInteger(n) && n >= 0) curios[cid] = Math.min(9999, n);
    return { seq: Number.isSafeInteger(have?.seq) && have.seq >= 0 ? have.seq : 0, curios };
  }
  function offerArgs({ give = {}, want = {}, line = '' }) {
    const giveResident = give.resident ? tradeSnapshot(give.resident) : null;
    if (give.resident && !giveResident) throw refuse('too_large');
    const wantResident = want.resident ? { id: String(want.resident.id), name: cleanText(want.resident.name, 22) || 'Someone' } : null;
    return {
      p_give: { curios: curioItems(give.curios), resident: giveResident },
      p_want: { curios: curioItems(want.curios), resident: wantResident },
      p_line: TRADE_LINE_BY_ID[line] ? line : ''
    };
  }
  const trade = raw => { const t = readTrade(raw); if (!t) throw refuse('unexpected'); return t; };
  return {
    signedIn,
    // give: { curios: { id: n }, resident: pet | null }; want: { curios: { id: n }, resident: { id, name } | null }
    // `have` declares the offered curios as the save holds them, with its ledger cursor.
    async propose({ to, give, want, line, have }) { return trade(await call('propose_trade', { p_to: id(to), ...offerArgs({ give, want, line }), p_have: haveArg(have) })); },
    async counter(tradeId, { give, want, line, have }) { return trade(await call('counter_trade', { p_id: id(tradeId), ...offerArgs({ give, want, line }), p_have: haveArg(have) })); },
    // `resident` is the receiver's own pet when the offer asks for one; `have`
    // declares the curios it asks for. Answers the sealed trade, with `ledgerSeq`.
    async accept(tradeId, { resident = null, have = null } = {}) {
      const mine = resident ? tradeSnapshot(resident) : null;
      if (resident && !mine) throw refuse('too_large');
      const raw = await call('accept_trade', { p_id: id(tradeId), p_give: mine ? { resident: mine } : {}, p_have: have ? haveArg(have) : null });
      return { ...trade(raw), ledgerSeq: Number.isSafeInteger(raw?.ledger_seq) ? raw.ledger_seq : 0 };
    },
    // The account's settled trades after `after`, oldest first.
    async ledger(after = 0, limit = 25) {
      const from = Number.isSafeInteger(after) && after >= 0 ? after : 0;
      return readLedger(await call('trade_ledger', { p_after: from, p_limit: Math.max(1, Math.min(50, limit)) }), from);
    },
    async decline(tradeId) { await call('decline_trade', { p_id: id(tradeId) }); return true; },
    async cancel(tradeId) { await call('cancel_trade', { p_id: id(tradeId) }); return true; },
    async list(ids = []) { return readTradeList(await call('list_trades', { p_ids: ids.map(cleanUuid).filter(Boolean).slice(0, 50) })); },
    async payload(tradeId) { return trade(await call('trade_payload', { p_id: id(tradeId) })); },
    async publishBook({ wishlist, spares }) { return call('publish_trade_book', { p_wishlist: wishlist, p_spares: spares }); },
    async book(userId) { return readTradeBook(await call('get_trade_book', { p_user: id(userId) })); }
  };
}
