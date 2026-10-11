// Keeps this shelf in step with the trades the server knows about, and makes
// the player's own moves (offer, accept, decline, cancel, counter) with the
// save updated around them.
//
// One look at the server (`sync`) does all of this, and doing it twice changes
// nothing the second time:
//   * a sealed trade not yet in `applied` is fetched in full and applied, in
//     the order the trades were sealed (so a resident received and later
//     passed on arrives and then leaves);
//   * an open offer this player made that this copy of the shelf does not hold
//     (made on another device, or before a restored backup) is put on hold;
//   * an offer this copy holds that was declined, cancelled, countered or has
//     expired comes off hold, and so does one the server no longer has (the
//     other player deleted their account);
//   * holds belonging to another account signed in on this device are left alone;
//   * residents waiting on the doorstep move in if a slot is free;
//   * the trading book (wishlist and spares) is published when it changed.
// Offline, nothing changes. The next look catches up.
import { tradesState } from '../trade-state.js';
import {
  applyTrade, isApplied, holdOffer, releaseOffer, releaseWithNotice, seatWaiting, pruneApplied, tradeBook,
  offerBlock, acceptBlock, mySide
} from '../engine/trades.js';
import { CloudError } from './client.js';
import { tradeCode } from './trades.js';

export const SYNC_GAP_MS = 15000;

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

  async function run() {
    const uid = me();
    if (!uid) return null;
    const state = getState();
    const t = tradesState(state);
    const ids = Object.entries(t.escrow).filter(([, e]) => !e.user || e.user === uid).map(([id]) => id).slice(0, 50);
    const list = await trades.list(ids);
    if (me() !== uid) return null;
    const results = [];
    let changed = false;
    // Sealed trades, oldest first.
    const sealed = list.trades.filter(x => x.status === 'accepted' && !isApplied(state, x.id)).sort((a, b) => a.closedAt - b.closedAt);
    for (const summary of sealed) {
      let full = summary;
      try { if (summary.kind === 'resident') full = await trades.payload(summary.id); }
      catch { continue; /* tried again on the next look */ }
      if (me() !== uid) return null;
      const r = applyTrade(state, full, { me: uid, now: now() });
      if (r) { results.push(r); changed = true; }
    }
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
    }
    if (seatWaiting(state, now()).length) changed = true;
    pruneApplied(state, list.now);
    if (changed) save();
    cache = { user: uid, now: list.now, count: list.count, trades: list.trades, at: now() };
    try { await publishBook(state, uid); } catch { /* published on a later look */ }
    const info = { results, changed, count: list.count };
    emit(info);
    return info;
  }

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
    const uid = me(), state = getState();
    if (!uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    const why = offerBlock(state, draft, now());
    if (why) throw blocked(why);
    const pet = draft.mode === 'resident' ? state.pets.find(p => p.id === draft.giveResident) : null;
    const trade = await trades.propose({ to, line,
      give: draft.mode === 'resident' ? { resident: pet } : { curios: draft.give },
      want: draft.mode === 'resident' ? { resident: draft.wantResident || null } : { curios: draft.want } });
    if (me() !== uid) return trade;
    holdOffer(state, { ...trade, toName: trade.toName || toName }, { me: uid, side: trade.give });
    save();
    remember(trade);
    publishBook(state, uid).catch(() => {});
    emit({ results: [], changed: true, count: cache.count });
    return trade;
  }

  async function counter(original, { draft, line = 'counter' }) {
    const uid = me(), state = getState();
    if (!uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    const why = offerBlock(state, draft, now());
    if (why) throw blocked(why);
    const pet = draft.mode === 'resident' ? state.pets.find(p => p.id === draft.giveResident) : null;
    const trade = await trades.counter(original.id, { line,
      give: draft.mode === 'resident' ? { resident: pet } : { curios: draft.give },
      want: draft.mode === 'resident' ? { resident: draft.wantResident || null } : { curios: draft.want } });
    if (me() !== uid) return trade;
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
    const uid = me(), state = getState();
    if (!uid) throw new CloudError('Sign in to cloud save first.', { code: 'signed_out' });
    const why = acceptBlock(state, trade, uid, now());
    if (why) throw blocked(why);
    const side = mySide(trade, uid);
    const pet = side.resident ? state.pets.find(p => p.id === side.resident.id) : null;
    holdOffer(state, trade, { me: uid, side, accepting: true });
    save();
    let sealed;
    try { sealed = await trades.accept(trade.id, { resident: pet }); }
    catch (error) {
      if (!NETWORK.has(tradeCode(error)) && !error.offline) { releaseOffer(state, trade.id); save(); }
      throw error;
    }
    if (me() !== uid) return { trade: sealed, result: null };
    const result = applyTrade(state, sealed, { me: uid, now: now(), fresh: true });
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
    const state = getState();
    try { await trades.cancel(trade.id); }
    catch (error) { if (tradeCode(error) === 'not_open') sync({ force: true }).catch(() => {}); throw error; }
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
