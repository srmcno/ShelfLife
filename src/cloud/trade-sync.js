// Keeps this shelf in step with the trades the server knows about, and makes
// the player's own moves (offer, accept, decline, cancel, counter) with the
// save updated around them.
//
// One look at the server (`sync`) does all of this, and doing it twice changes
// nothing the second time:
//   * the account's settlement ledger is read from the cursor this copy saved,
//     page by page, and each sealed trade not yet in `applied` is applied in
//     the order it was sealed (so a resident received and later passed on
//     arrives and then leaves). The cursor moves past each entry as it is
//     applied or skipped, and is saved with the shelf, so a restored backup,
//     however old, reads everything it missed;
//   * an open offer this player made that this copy of the shelf does not hold
//     (made on another device, or before a restored backup) is put on hold;
//   * an offer this copy holds that was declined, cancelled, countered or has
//     expired comes off hold, and so does one the server no longer has (the
//     other player deleted their account);
//   * holds belonging to another account signed in on this device are left alone;
//   * residents waiting on the doorstep move in if a slot is free;
//   * the trading book (wishlist and spares) is published when it changed.
// Offline, nothing changes. The next look catches up.
//
// The shelf can be replaced while a request is out: a restored backup, a cloud
// copy chosen over this one, an account switch. main.js swaps the contents of
// the one state object, so object identity alone does not show it; the
// `trades` record inside it is always a new object after a swap. A fence
// (the account, the state object and its trades record) is taken before each
// await and checked after; an answer that comes back to a different shelf is
// never written into it. The ledger read starts again from the new shelf's own
// cursor, and anything else is left for the next look to settle.
import { tradesState } from '../trade-state.js';
import {
  applyTrade, isApplied, holdOffer, releaseOffer, releaseWithNotice, seatWaiting, pruneApplied, tradeBook,
  offerBlock, acceptBlock, mySide, declaredHoldings, ledgerCursor, setLedgerCursor, ledgerFloor, effectAsTrade
} from '../engine/trades.js';
import { CloudError } from './client.js';
import { tradeCode } from './trades.js';

export const SYNC_GAP_MS = 15000;
const LEDGER_PAGES = 40;

function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return text.length + ':' + (h >>> 0).toString(36);
}
const blocked = text => new CloudError(text, { code: 'blocked_locally' });
const NETWORK = new Set(['offline', 'timeout', 'unexpected']);

export function createTradeSync({ cloud, social, trades, getState, save = () => true, now = Date.now }) {
  const listeners = new Set();
  let running = null, last = 0;
  let cache = { user: null, now: 0, count: 0, trades: [], at: 0 };

  const me = () => (social.active() ? cloud.userId() : null);
  const fence = uid => { const state = getState(); return { uid, state, trades: state?.trades }; };
  const holds = f => me() === f.uid && getState() === f.state && f.state?.trades === f.trades;
  const emit = info => listeners.forEach(fn => { try { fn(info); } catch { /* the UI's problem */ } });
  function current() { return cache.user && cache.user === me() ? cache : { user: me(), now: 0, count: 0, trades: [], at: 0 }; }
  function remember(trade) {
    if (!trade || cache.user !== me()) return;
    cache = { ...cache, trades: [trade, ...cache.trades.filter(t => t.id !== trade.id)] };
  }
  function forget(id, status) {
    if (cache.user !== me()) return;
    cache = { ...cache, trades: cache.trades.map(t => t.id === id ? { ...t, status, closedAt: now() } : t),
      count: Math.max(0, cache.count - (cache.trades.some(t => t.id === id && t.status === 'open' && t.to === cache.user) ? 1 : 0)) };
  }

  async function publishBook(state, uid) {
    const book = tradeBook(state), hash = hashText(JSON.stringify(book));
    const m = cloud.meta();
    if (m.tradeBookUser === uid && m.tradeBookHash === hash) return false;
    const r = await trades.publishBook(book);
    if (r?.skipped || cloud.userId() !== uid) return false;
    cloud.setMeta({ tradeBookUser: uid, tradeBookHash: hash });
    return true;
  }

  /* Reads the ledger from this copy's cursor to the head and applies what is
     new. Each entry is applied (or skipped: already applied by id, or older
     than this copy's history) and then the cursor moves past it, so a lost
     connection halfway resumes where it stopped. Answers { results, changed,
     caughtUp } or null when the account changed underneath. */
  async function catchUp(uid) {
    const results = [];
    let changed = false, caughtUp = false;
    for (let page = 0; page < LEDGER_PAGES; page++) {
      tradesState(getState());
      const f = fence(uid);
      const from = ledgerCursor(f.state, uid);
      const r = await trades.ledger(from, 25);
      if (me() !== uid) return null;
      // Another shelf now: this page was read for the old cursor. Read again for the new one.
      if (!holds(f)) { results.length = 0; changed = false; continue; }
      const live = f.state, floor = ledgerFloor(live);
      for (const entry of r.entries) {
        if (entry.seq <= ledgerCursor(live, uid)) continue;
        if (!isApplied(live, entry.tradeId) && !(entry.settledAt && entry.settledAt < floor)) {
          const applied = applyTrade(live, effectAsTrade(entry, uid), { me: uid, now: now() });
          if (applied) results.push(applied);
        }
        if (setLedgerCursor(live, uid, entry.seq)) changed = true;
      }
      if (!r.entries.length && r.next > from && setLedgerCursor(live, uid, Math.min(r.next, r.head))) changed = true;
      if (results.length) changed = true;
      if (changed) save();
      if (!r.more) { caughtUp = true; break; }
    }
    return { results, changed, caughtUp };
  }

  // Before giving curios: settle anything sealed elsewhere, so this copy's
  // count and cursor are current. If the ledger cannot be read, the server
  // still checks the offer against the cursor this copy has.
  async function settleFirst(uid) {
    try {
      const r = await catchUp(uid);
      if (r?.results.length) emit({ results: r.results, changed: true, count: cache.count });
    } catch { /* checked by the server all the same */ }
    if (me() !== uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    return getState();
  }

  async function run(again = 1) {
    const uid = me();
    if (!uid) return null;
    const ledger = await catchUp(uid);
    if (!ledger) return null;
    const state = getState();
    const t = tradesState(state);
    const f = fence(uid);
    const ids = Object.entries(t.escrow).filter(([, e]) => !e.user || e.user === uid).map(([id]) => id).slice(0, 50);
    const list = await trades.list(ids);
    if (me() !== uid) return null;
    // The shelf was replaced while the list was out: its holds were not asked about. Look again.
    if (!holds(f)) return again > 0 ? run(again - 1) : null;
    const results = [...ledger.results];
    let changed = ledger.changed;
    // Offers this player has open, held here too.
    for (const x of list.trades) {
      if (x.status === 'open' && x.from === uid && !t.escrow[x.id]) { holdOffer(state, x, { me: uid, side: x.give }); changed = true; }
    }
    // Holds that no longer stand.
    const byId = new Map(list.trades.map(x => [x.id, x]));
    for (const id of ids) {
      const x = byId.get(id), e = t.escrow[id];
      if (!e) continue;
      if (!x) { changed = releaseWithNotice(state, id, 'cancelled', now()) || changed; continue; }
      if (x.status === 'open') { if (e.accepting) { releaseOffer(state, id); changed = true; } continue; }
      if (x.status !== 'accepted') changed = releaseWithNotice(state, id, x.status, now()) || changed;
      // Sealed and already applied here: the hold is spent.
      else if (isApplied(state, id)) changed = releaseOffer(state, id) || changed;
    }
    if (seatWaiting(state, now()).length) changed = true;
    if (ledger.caughtUp) pruneApplied(state, list.now);
    if (changed) save();
    cache = { user: uid, now: list.now, count: list.count, trades: list.trades, at: now() };
    try { await publishBook(getState(), uid); } catch { /* published on a later look */ }
    const info = { results, changed, count: list.count };
    emit(info);
    return info;
  }

  // After an answer that arrived for a shelf that has since been replaced.
  function settleLater() { Promise.resolve().then(() => sync({ force: true })).catch(() => {}); }

  // `force` skips the 15 second gap between looks.
  function sync({ force = false } = {}) {
    if (!me()) return Promise.resolve(null);
    if (running) return running;
    if (!force && cache.user === me() && now() - last < SYNC_GAP_MS) return Promise.resolve({ results: [], changed: false, count: cache.count, cached: true });
    running = run().finally(() => { running = null; last = now(); });
    return running;
  }

  // ---- the player's own moves ----
  async function propose({ to, toName = '', draft, line = '' }) {
    const uid = me();
    if (!uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    const state = await settleFirst(uid);
    const f = fence(uid);
    const why = offerBlock(state, draft, now());
    if (why) throw blocked(why);
    const pet = draft.mode === 'resident' ? state.pets.find(p => p.id === draft.giveResident) : null;
    const have = declaredHoldings(state, uid, draft.mode === 'resident' ? [] : Object.keys(draft.give || {}));
    const trade = await trades.propose({ to, line, have,
      give: draft.mode === 'resident' ? { resident: pet } : { curios: draft.give },
      want: draft.mode === 'resident' ? { resident: draft.wantResident || null } : { curios: draft.want } });
    if (!holds(f)) { settleLater(); return trade; }
    holdOffer(state, { ...trade, toName: trade.toName || toName }, { me: uid, side: trade.give });
    save();
    remember(trade);
    publishBook(state, uid).catch(() => {});
    emit({ results: [], changed: true, count: cache.count });
    return trade;
  }

  async function counter(original, { draft, line = 'counter' }) {
    const uid = me();
    if (!uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    const state = await settleFirst(uid);
    const f = fence(uid);
    const why = offerBlock(state, draft, now());
    if (why) throw blocked(why);
    const pet = draft.mode === 'resident' ? state.pets.find(p => p.id === draft.giveResident) : null;
    const have = declaredHoldings(state, uid, draft.mode === 'resident' ? [] : Object.keys(draft.give || {}));
    const trade = await trades.counter(original.id, { line, have,
      give: draft.mode === 'resident' ? { resident: pet } : { curios: draft.give },
      want: draft.mode === 'resident' ? { resident: draft.wantResident || null } : { curios: draft.want } });
    if (!holds(f)) { settleLater(); return trade; }
    holdOffer(state, { ...trade, toName: trade.toName || original.fromName }, { me: uid, side: trade.give });
    save();
    forget(original.id, 'countered');
    remember(trade);
    publishBook(state, uid).catch(() => {});
    emit({ results: [], changed: true, count: cache.count });
    return trade;
  }

  // Holds this player's half while the request is out. If the answer is lost
  // on the way back, the hold stays until the next look settles it.
  async function accept(trade) {
    const uid = me();
    if (!uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    const state = trade?.want?.curios?.length ? await settleFirst(uid) : getState();
    const f = fence(uid);
    const why = acceptBlock(state, trade, uid, now());
    if (why) throw blocked(why);
    const side = mySide(trade, uid);
    const pet = side.resident ? state.pets.find(p => p.id === side.resident.id) : null;
    const have = side.curios.length ? declaredHoldings(state, uid, side.curios.map(c => c.id)) : null;
    holdOffer(state, trade, { me: uid, side, accepting: true });
    save();
    let sealed;
    try { sealed = await trades.accept(trade.id, { resident: pet, have }); }
    catch (error) {
      const code = tradeCode(error);
      if (!holds(f)) { settleLater(); throw error; }
      if (code === 'not_open') {
        // Perhaps sealed by an earlier try whose answer was lost: the ledger
        // settles it, and the list releases the hold if it was not.
        try { await sync({ force: true }); } catch { /* the next look */ }
        if (holds(f) && tradesState(state).escrow[trade.id]?.accepting) { releaseOffer(state, trade.id); save(); }
      } else if (!NETWORK.has(code) && !error.offline) { releaseOffer(state, trade.id); save(); }
      throw error;
    }
    // Sealed, but this is another shelf now: its ledger cursor brings the trade in, once.
    if (!holds(f)) { settleLater(); return { trade: sealed, result: null }; }
    const result = applyTrade(state, sealed, { me: uid, now: now(), fresh: true });
    // The cursor moves on the next read of the ledger, which finds this one applied.
    save();
    remember(sealed);
    if (cache.user === uid) cache = { ...cache, count: Math.max(0, cache.count - 1) };
    publishBook(state, uid).catch(() => {});
    emit({ results: result ? [result] : [], changed: true, count: cache.count });
    return { trade: sealed, result };
  }

  async function decline(trade) {
    await trades.decline(trade.id);
    forget(trade.id, 'declined');
    emit({ results: [], changed: false, count: cache.count });
    return true;
  }
  async function cancel(trade) {
    try { await trades.cancel(trade.id); }
    catch (error) { if (tradeCode(error) === 'not_open') sync({ force: true }).catch(() => {}); throw error; }
    // Whichever shelf is here now, the offer is withdrawn: take it off hold there.
    const state = getState();
    if (releaseOffer(state, trade.id)) save();
    forget(trade.id, 'cancelled');
    publishBook(state, cloud.userId()).catch(() => {});
    emit({ results: [], changed: true, count: cache.count });
    return true;
  }

  return {
    sync, propose, counter, accept, decline, cancel, publishBook: () => { const uid = me(); return uid ? publishBook(getState(), uid) : Promise.resolve(false); },
    cache: current, payload: id => trades.payload(id), book: userId => trades.book(userId),
    // Offers waiting for this player, from the last look.
    waiting: () => current().trades.filter(x => x.status === 'open' && x.to === current().user).length,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
