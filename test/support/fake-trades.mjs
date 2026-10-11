// The trading functions of supabase/migrations/0004_trades.sql, in memory,
// for test/support/fake-supabase.mjs. Same arguments, same answers, same
// refusals (errcode P0001 with a token as the message). test/trades_sql.test.mjs
// checks the real SQL against the same rules.
//
// The SQL tears up open offers in triggers when a block is added or a
// friendship removed, and cascades on account deletion. The fake does the same
// lazily: every call first sweeps offers whose players are no longer friends,
// are blocked, or no longer exist. Test knobs: `age(id, ms)` moves a trade into
// the past, `trades` and `books` are the rows.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURIO = /^[a-z0-9-]{1,40}$/;
const REF = /^[a-zA-Z0-9_-]{1,100}$/;
const LINE = /^[a-z0-9-]{0,40}$/;
const ARRIVAL = /^tr-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const DAY = 86400000, WEEK = 7 * DAY;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;

export function createFakeTrades({ social, users, profiles, now, json, rest, uuid }) {
  const trades = new Map(), books = new Map();
  const iso = t => t == null ? null : new Date(t).toISOString();
  const refuse = token => { throw Object.assign(new Error(token), { token }); };
  const nameOf = id => profiles.get(id)?.display_name || '';
  const areFriends = (a, b) => social.friendships.some(f => f.status === 'accepted' &&
    ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const blocked = (a, b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const party = (t, uid) => t.from_user === uid || t.to_user === uid;
  const pairOpen = (a, b) => [...trades.values()].filter(t => t.status === 'open' &&
    ((t.from_user === a && t.to_user === b) || (t.from_user === b && t.to_user === a))).length;

  // The triggers and cascades, applied before every call.
  function sweep(uid) {
    for (const [id, t] of trades) {
      if (!users.has(t.from_user) || !users.has(t.to_user)) { trades.delete(id); continue; }
      if (t.status === 'open' && (!areFriends(t.from_user, t.to_user) || blocked(t.from_user, t.to_user))) {
        t.status = 'cancelled'; t.closed_at = now();
      }
    }
    for (const id of books.keys()) if (!users.has(id)) books.delete(id);
    if (uid) for (const t of trades.values()) {
      if (t.status === 'open' && t.expires_at <= now() && party(t, uid)) { t.status = 'expired'; t.closed_at = t.expires_at; }
    }
  }

  function curios(p) {
    if (p === undefined || p === null) return [];
    if (!Array.isArray(p) || p.length > 3) refuse('bad_trade');
    const seen = new Set(), out = [];
    let total = 0;
    for (const item of p) {
      if (!record(item) || typeof item.id !== 'string' || !CURIO.test(item.id) || seen.has(item.id) || ![1, 2, 3].includes(item.n)) refuse('bad_trade');
      seen.add(item.id); total += item.n; out.push({ id: item.id, n: item.n });
    }
    if (total > 3) refuse('bad_trade');
    return out;
  }
  function resident(p) {
    if (p === undefined || p === null) return null;
    if (!record(p) || typeof p.id !== 'string' || !REF.test(p.id) || typeof p.name !== 'string') refuse('bad_trade');
    if (size(p) >= 150000) refuse('too_large');
    return p;
  }
  const items = (t, side, kind) => t.items.filter(i => i.side === side && (!kind || i.kind === kind));
  function residentOk(user, ref, except = null) {
    const all = [...trades.values()];
    if (all.some(t => t.status === 'open' && t.from_user === user && t.id !== except && items(t, 'from', 'resident').some(i => i.ref === ref))) refuse('in_escrow');
    if (all.some(t => t.status === 'accepted' && ((t.from_user === user && items(t, 'from', 'resident').some(i => i.ref === ref)) ||
      (t.to_user === user && items(t, 'to', 'resident').some(i => i.ref === ref))))) refuse('already_traded');
    const arrival = ref.match(ARRIVAL);
    if (arrival) {
      const t = trades.get(arrival[1]);
      if (t && t.status === 'accepted' && party(t, user) && t.closed_at > now() - WEEK) refuse('too_soon');
    }
  }
  const residentTrades = user => [...trades.values()].filter(t => t.kind === 'resident' &&
    ((t.status === 'accepted' && party(t, user) && t.closed_at > now() - WEEK) || (t.status === 'open' && t.from_user === user))).length;

  function light(snapshot) {
    if (!record(snapshot) || !record(snapshot.art) || snapshot.art.creature !== undefined) return snapshot;
    const { body, ...art } = snapshot.art;
    return { ...snapshot, art };
  }
  const copy = value => value === null || value === undefined ? null : JSON.parse(JSON.stringify(value));
  function view(t, full) {
    return { id: t.id, from_user: t.from_user, to_user: t.to_user, from_name: nameOf(t.from_user), to_name: nameOf(t.to_user),
      kind: t.kind, status: t.status, parent: t.parent, line: t.line,
      created_at: iso(t.created_at), expires_at: iso(t.expires_at), closed_at: iso(t.closed_at),
      items: [...items(t, 'from'), ...items(t, 'to')].map(i => ({ side: i.side, kind: i.kind, ref: i.ref, qty: i.qty,
        snapshot: i.snapshot === null ? null : copy(full ? i.snapshot : light(i.snapshot)) })) };
  }

  function insert(uid, to, give, want, line, parent, kind) {
    const w = want === null || want === undefined ? {} : want;
    if (!UUID.test(to || '') || to === uid || !areFriends(uid, to) || blocked(uid, to)) refuse('not_friends');
    if (profiles.get(to)?.dnd === true) refuse('dnd');
    if (!record(give) || !record(w) || !LINE.test(line ?? '')) refuse('bad_trade');
    const giveCurios = curios(give.curios), wantCurios = curios(w.curios);
    const giveResident = resident(give.resident);
    let wantResident = resident(w.resident);
    if (wantResident) wantResident = { id: wantResident.id, name: wantResident.name.slice(0, 22) };
    let v;
    if (giveResident || wantResident) {
      if (!giveResident || giveCurios.length || wantCurios.length) refuse('bad_trade');
      v = 'resident';
    } else {
      if (!giveCurios.length) refuse('bad_trade');
      v = 'curio';
    }
    if (kind && kind !== v) refuse('bad_trade');
    if ([...trades.values()].filter(t => t.from_user === uid && t.created_at > now() - DAY).length >= 20) refuse('rate_limited');
    if (pairOpen(uid, to) >= 5) refuse('too_many_open');
    if (v === 'resident') {
      residentOk(uid, giveResident.id);
      if (residentTrades(uid) >= 2) refuse('resident_limit');
    }
    const t = { id: uuid(), from_user: uid, to_user: to, kind: v, status: 'open', parent: parent || null, line: line || '',
      created_at: now(), expires_at: now() + WEEK, closed_at: null, items: [] };
    for (const c of giveCurios) t.items.push({ side: 'from', kind: 'curio', ref: c.id, qty: c.n, snapshot: null });
    for (const c of wantCurios) t.items.push({ side: 'to', kind: 'curio', ref: c.id, qty: c.n, snapshot: null });
    if (giveResident) t.items.push({ side: 'from', kind: 'resident', ref: giveResident.id, qty: 1, snapshot: copy(giveResident) });
    if (wantResident) t.items.push({ side: 'to', kind: 'resident', ref: wantResident.id, qty: 1, snapshot: wantResident });
    trades.set(t.id, t);
    return t;
  }

  function answer(uid, id, as = 'to_user') {
    const t = trades.get(id);
    if (!t || t[as] !== uid) refuse('not_found');
    return t;
  }

  const handlers = {
    propose_trade(uid, { p_to, p_give, p_want, p_line = '' }) {
      return view(insert(uid, p_to, p_give, p_want, p_line, null, null), false);
    },
    counter_trade(uid, { p_id, p_give, p_want, p_line = '' }) {
      const t = answer(uid, p_id);
      if (t.status === 'expired') refuse('expired');
      if (t.status !== 'open') refuse('not_open');
      if (t.parent) refuse('no_counter');
      const before = { status: t.status, closed_at: t.closed_at };
      t.status = 'countered'; t.closed_at = now();
      try { return view(insert(uid, t.from_user, p_give, p_want, p_line, t.id, t.kind), false); }
      catch (error) { Object.assign(t, before); throw error; }
    },
    accept_trade(uid, { p_id, p_give = {} }) {
      const t = answer(uid, p_id);
      if (t.status === 'expired') refuse('expired');
      if (t.status !== 'open') refuse('not_open');
      if (!areFriends(uid, t.from_user) || blocked(uid, t.from_user)) refuse('not_friends');
      if (t.kind === 'resident') {
        if (residentTrades(uid) >= 2) refuse('resident_limit');
        const wanted = items(t, 'to', 'resident')[0];
        if (wanted) {
          if (!record(p_give)) refuse('bad_trade');
          const mine = resident(p_give.resident);
          if (!mine || mine.id !== wanted.ref) refuse('bad_trade');
          residentOk(uid, wanted.ref);
          wanted.snapshot = copy(mine);
        }
      }
      t.status = 'accepted'; t.closed_at = now();
      return view(t, true);
    },
    decline_trade(uid, { p_id }) {
      const t = answer(uid, p_id);
      if (t.status !== 'open') refuse('not_open');
      t.status = 'declined'; t.closed_at = now();
      return { ok: true, id: t.id, status: 'declined' };
    },
    cancel_trade(uid, { p_id }) {
      const t = answer(uid, p_id, 'from_user');
      if (t.status !== 'open') refuse('not_open');
      t.status = 'cancelled'; t.closed_at = now();
      return { ok: true, id: t.id, status: 'cancelled' };
    },
    list_trades(uid, { p_ids = [] } = {}) {
      const wanted = Array.isArray(p_ids) ? p_ids : [];
      if (wanted.length > 50) refuse('bad_trade');
      for (const [id, t] of trades) {
        if (!party(t, uid) || t.closed_at === null) continue;
        if (t.status !== 'open' && t.status !== 'accepted' && t.closed_at < now() - 30 * DAY) trades.delete(id);
        else if (t.status === 'accepted' && t.closed_at < now() - 400 * DAY) trades.delete(id);
        else if (t.status === 'accepted' && t.closed_at < now() - 90 * DAY) t.items.forEach(i => { i.snapshot = null; });
      }
      const at = t => t.closed_at ?? t.created_at;
      const mine = [...trades.values()].filter(t => party(t, uid)).sort((a, b) => at(b) - at(a));
      const recent = new Set(mine.filter(t => t.status === 'open' || t.closed_at > now() - 60 * DAY).slice(0, 100).map(t => t.id));
      return { now: iso(now()), count: mine.filter(t => t.to_user === uid && t.status === 'open').length,
        trades: mine.filter(t => recent.has(t.id) || wanted.includes(t.id)).map(t => view(t, false)) };
    },
    trade_payload(uid, { p_id }) {
      const t = trades.get(p_id);
      if (!t || !party(t, uid) || !['open', 'accepted'].includes(t.status)) refuse('not_found');
      return view(t, true);
    },
    publish_trade_book(uid, { p_wishlist, p_spares }) {
      if (!Array.isArray(p_wishlist) || p_wishlist.length > 12 || p_wishlist.some(w => typeof w !== 'string' || !CURIO.test(w)) ||
        new Set(p_wishlist).size !== p_wishlist.length) refuse('bad_trade');
      if (!record(p_spares) || Object.keys(p_spares).length > 60 ||
        Object.entries(p_spares).some(([k, v]) => !CURIO.test(k) || !Number.isInteger(v) || v < 1 || v > 99)) refuse('bad_trade');
      const last = books.get(uid);
      if (last && last.updated_at > now() - 5000) return { ok: true, skipped: true };
      books.set(uid, { wishlist: [...p_wishlist], spares: { ...p_spares }, updated_at: now() });
      return { ok: true };
    },
    get_trade_book(uid, { p_user }) {
      if (!UUID.test(p_user || '') || (p_user !== uid && (!areFriends(uid, p_user) || blocked(uid, p_user)))) refuse('not_friends');
      const b = books.get(p_user);
      return b ? { user_id: p_user, wishlist: [...b.wishlist], spares: { ...b.spares }, updated_at: iso(b.updated_at) } : null;
    }
  };

  const RPC = Object.fromEntries(Object.entries(handlers).map(([name, fn]) => [name, (user, input = {}) => {
    for (const key of ['p_id', 'p_to', 'p_user']) if (key in input && !UUID.test(input[key] || '')) return rest(400, '22P02', 'invalid input syntax for type uuid');
    sweep(user.id);
    try { return json(200, fn(user.id, input)); }
    catch (error) { if (error.token) return rest(400, 'P0001', error.token); throw error; }
  }]));

  return { RPC, trades, books, age(id, ms) { const t = trades.get(id); for (const k of ['created_at', 'expires_at', 'closed_at']) if (t[k] !== null) t[k] -= ms; } };
}
