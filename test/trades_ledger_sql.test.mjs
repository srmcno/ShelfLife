// Reservations and the settlement ledger of 0004_trades.sql, on 0001 and 0002
// alone (PGlite, one connection). test/trades_race_pg.test.mjs runs the same
// rules on separate real connections at once.
//
//   * an account's open offers reserve curios across every device, against
//     what the offering save declares it holds;
//   * every sealed trade is written to each player's ledger, which outlives
//     the trades table's housekeeping and pages from any cursor.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), TRADES = read('0004_trades.sql');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const USERS = Array.from({ length: 12 }, (_, i) => id(i + 1));
const [A, B, C, D, E, F, G, H, I, J, K, L] = USERS;
const NAMES = ['Ada', 'Bea', 'Cat', 'Dan', 'Eve', 'Fay', 'Gil', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou'];
const BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  insert into auth.users (id) values ${USERS.map(u => "('" + u + "')").join(', ')};
`;

let db;
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(TRADES); }
  for (const [i, u] of USERS.entries()) await as(u, () => value('select public.ensure_profile($1)', [NAMES[i]]));
  for (const [x, y] of [[A, B], [A, C], [B, C], [D, E], [E, F], [G, H], [I, J], [I, K], [K, L]]) await friends(x, y);
});

async function as(sub, work) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub || '']);
  await db.exec('set role authenticated');
  try { return await work(); }
  finally { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
const value = async (sql, params) => Object.values((await db.query(sql, params)).rows[0])[0];
const call = (who, sql, params) => as(who, () => value('select ' + sql, params));
const rejects = (promise, pattern) => assert.rejects(promise, err => pattern.test(err.message));
const friends = (x, y) => db.query(`insert into public.friendships (requester, addressee, status) values ($1, $2, 'accepted') on conflict do nothing`, [x, y]);
const curios = (...list) => list.map(([cid, n = 1]) => ({ id: cid, n }));
const have = (seq, map) => ({ seq, curios: map });
const resident = (rid, name) => ({ id: rid, name, traits: ['damp'], stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, bio: 'Arrived without references.', art: { body: 'data:image/png;base64,AAAA', stamps: [] } });
const propose = (from, to, give, h, want = {}) =>
  call(from, 'public.propose_trade($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)', [to, JSON.stringify(give), JSON.stringify(want), 'fair', h === undefined ? null : JSON.stringify(h)]);
const accept = (who, tid, give = {}, h = null) => call(who, 'public.accept_trade($1, $2::jsonb, $3::jsonb)', [tid, JSON.stringify(give), h && JSON.stringify(h)]);
const counter = (who, tid, give, h, want = {}) =>
  call(who, 'public.counter_trade($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)', [tid, JSON.stringify(give), JSON.stringify(want), 'counter', JSON.stringify(h)]);
const ledger = (who, after = 0, limit = 25) => call(who, 'public.trade_ledger($1, $2)', [after, limit]);
const age = (tid, interval) => db.query(`update public.trades set created_at = created_at - $2::interval, expires_at = expires_at - $2::interval,
  closed_at = closed_at - $2::interval where id = $1`, [tid, interval]);

test('two devices of one account cannot promise the same three moth wings twice', async () => {
  // The reviewers' case: a 3-copy shelf, two honest devices, 2 offered on each.
  const tablet = await propose(A, B, { curios: curios(['moth-wing', 2]) }, have(0, { 'moth-wing': 3 }));
  assert.equal(tablet.status, 'open');
  await rejects(propose(A, C, { curios: curios(['moth-wing', 2]) }, have(0, { 'moth-wing': 3 })), /not_enough/);
  await rejects(propose(A, C, { curios: curios(['moth-wing', 1]) }, have(0, { 'moth-wing': 3 })), /not_enough/, 'the last copy stays in the cabinet');
  assert.equal(await value(`select count(*)::int from public.trades where from_user = $1 and status = 'open'`, [A]), 1);
  // Bea takes them. Ada now holds 1, wherever she looks from.
  const sealed = await accept(B, tablet.id);
  assert.equal(sealed.status, 'accepted');
  // A stale device that never applied the trade still declares 3 at cursor 0: the ledger says 2 left since.
  await rejects(propose(A, C, { curios: curios(['moth-wing', 1]) }, have(0, { 'moth-wing': 3 })), /not_enough/);
  const head = (await ledger(A)).head;
  await rejects(propose(A, C, { curios: curios(['moth-wing', 1]) }, have(head, { 'moth-wing': 1 })), /not_enough/, 'caught up, one copy, nothing spare');
  // Bea really has 2 more now, and may give one of them on.
  assert.equal((await propose(B, C, { curios: curios(['moth-wing', 1]) }, have((await ledger(B)).head, { 'moth-wing': 2 }))).status, 'open');
});

test('declining, cancelling, countering and expiry release the reservation', async () => {
  const h = have(0, { 'glass-eye': 3 });
  const a = await propose(D, E, { curios: curios(['glass-eye', 2]) }, h);
  await rejects(propose(D, E, { curios: curios(['glass-eye', 1]) }, h), /not_enough/);
  await call(E, 'public.decline_trade($1)', [a.id]);
  const b = await propose(D, E, { curios: curios(['glass-eye', 2]) }, h);
  await call(D, 'public.cancel_trade($1)', [b.id]);
  const c = await propose(D, E, { curios: curios(['glass-eye', 2]) }, h);
  await age(c.id, '7 days 1 minute');
  const d = await propose(D, E, { curios: curios(['glass-eye', 2]) }, h);
  assert.equal(d.status, 'open', 'an expired offer holds nothing');
  // Eve counters: Dan's offer closes and his reservation goes with it.
  const back = await counter(E, d.id, { curios: curios(['tiny-coffin']) }, have(0, { 'tiny-coffin': 2 }));
  assert.equal(back.parent, d.id);
  assert.equal((await propose(D, E, { curios: curios(['glass-eye', 2]) }, h)).status, 'open');
  // A counter is an offer too: Eve has promised her only spare coffin.
  const other = await propose(D, E, { curios: curios(['button-eye']) }, have(0, { 'button-eye': 2 }));
  await rejects(counter(E, other.id, { curios: curios(['tiny-coffin']) }, have(0, { 'tiny-coffin': 2 })), /not_enough/);
});

test('an acceptance that hands curios over is checked against the receiver’s own promises', async () => {
  // Fay has 2 half candles and has already offered one to Eve.
  await propose(F, E, { curios: curios(['half-candle']) }, have(0, { 'half-candle': 2 }));
  const ask = await propose(E, F, { curios: curios(['moth-wing']) }, have(0, { 'moth-wing': 2 }), { curios: curios(['half-candle']) });
  await rejects(accept(F, ask.id, {}, have(0, { 'half-candle': 2 })), /not_enough/);
  await rejects(accept(F, ask.id), /bad_trade/, 'no declaration, no acceptance');
  assert.equal(await value('select status from public.trades where id = $1', [ask.id]), 'open', 'a refusal changes nothing');
  assert.equal((await accept(F, ask.id, {}, have(0, { 'half-candle': 3 }))).status, 'accepted');
  // An acceptance that gives nothing needs no declaration.
  const gift = await propose(E, F, { curios: curios(['moth-wing']) }, have(0, { 'moth-wing': 5 }));
  assert.equal((await accept(F, gift.id)).status, 'accepted');
});

test('declarations are required and checked for shape', async () => {
  for (const h of [undefined, {}, { seq: -1, curios: { 'moth-wing': 3 } }, { seq: 0, curios: [] }, { seq: 0, curios: {} }, { seq: 0, curios: { 'moth-wing': '3' } }, { seq: 1.5, curios: { 'moth-wing': 3 } }]) {
    await rejects(propose(G, H, { curios: curios(['moth-wing']) }, h), /bad_trade/);
  }
  // A cursor from the future is read as "everything applied", never more.
  assert.equal((await propose(G, H, { curios: curios(['moth-wing']) }, have(1e12, { 'moth-wing': 2 }))).status, 'open');
  // A resident offer moves no curios and needs no declaration.
  assert.equal((await propose(G, H, { resident: resident('gil-1', 'Mabel') })).status, 'open');
});

test('blocking and unfriending release reservations, and the sealed trade stays in both ledgers', async () => {
  const waiting = await propose(I, J, { curios: curios(['coffin-nail', 2]) }, have(0, { 'coffin-nail': 3 }));
  const sealed = await propose(I, K, { curios: curios(['lake-ring']) }, have(0, { 'lake-ring': 2 }));
  await accept(K, sealed.id);
  await rejects(propose(I, K, { curios: curios(['coffin-nail']) }, have(0, { 'coffin-nail': 3 })), /not_enough/);
  await call(J, 'public.block_user($1)', [I]);
  assert.equal(await value('select status from public.trades where id = $1', [waiting.id]), 'cancelled');
  assert.equal((await propose(I, K, { curios: curios(['coffin-nail', 2]) }, have(0, { 'coffin-nail': 3 }))).status, 'open', 'the block gave the moth wings back to Ivy');
  await call(K, 'public.remove_friend($1)', [I]);
  assert.equal(await value(`select count(*)::int from public.trades where from_user = $1 and to_user = $2 and status = 'open'`, [I, K]), 0);
  assert.equal((await propose(K, L, { curios: curios(['lake-ring']) }, have((await ledger(K)).head, { 'lake-ring': 2 }))).status, 'open', 'Kit keeps what arrived');
  assert.equal((await ledger(I)).effects.find(e => e.trade_id === sealed.id).role, 'from');
  assert.equal((await ledger(K)).effects.find(e => e.trade_id === sealed.id).role, 'to');
});

test('the ledger: one row per player per sealed trade, in order, with what moved', async () => {
  const swap = await propose(B, C, { resident: resident('bea-1', 'Gladys') }, null, { resident: { id: 'cat-1', name: 'Snag' } });
  const sealed = await accept(C, swap.id, { resident: resident('cat-1', 'Snag') });
  const forC = await ledger(C);
  const mine = forC.effects.find(e => e.trade_id === swap.id);
  assert.equal(sealed.ledger_seq, mine.seq, 'accept answers with the caller’s ledger entry');
  assert.deepEqual([mine.kind, mine.role, mine.partner_name, mine.resident_out, mine.curios_out, mine.curios_in], ['resident', 'to', 'Bea', { id: 'cat-1', name: 'Snag' }, [], []]);
  assert.equal(mine.resident_in.name, 'Gladys');
  assert.equal(mine.resident_in.art.body, 'data:image/png;base64,AAAA', 'the arrival travels whole, drawing included');
  const forB = (await ledger(B)).effects.find(e => e.trade_id === swap.id);
  assert.deepEqual([forB.role, forB.partner_name, forB.resident_out, forB.resident_in.name], ['from', 'Cat', { id: 'bea-1', name: 'Gladys' }, 'Snag']);
  for (const who of USERS) {
    const seqs = (await ledger(who, 0, 50)).effects.map(e => e.seq);
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1), 'each owner counts 1, 2, 3 without gaps');
  }
  await rejects(call(B, 'public.trade_ledger($1, $2)', [0, 51]), /bad_trade/);
  await rejects(call(B, 'public.trade_ledger($1, $2)', [-1, 5]), /bad_trade/);
  await as(B, () => rejects(db.query('select * from public.trade_ledger'), /permission denied/));
});

test('a backup from before a trade, restored 61 days later, still finds the trade (and after 400 days)', async () => {
  await friends(G, L);
  const before = (await ledger(G)).head; // what the backup saved as its cursor
  const offer = await propose(G, L, { resident: resident('gil-2', 'Pip') });
  await accept(L, offer.id);
  await age(offer.id, '61 days');
  assert.ok(!(await call(G, 'public.list_trades($1::uuid[])', ['{}'])).trades.some(t => t.id === offer.id), 'gone from the list window, which was the bug');
  const caught = await ledger(G, before);
  assert.deepEqual(caught.effects.map(e => [e.trade_id, e.resident_out.name]), [[offer.id, 'Pip']]);
  assert.equal(caught.more, false);
  assert.equal(caught.next, caught.head);
  await age(offer.id, '400 days');
  await call(G, 'public.list_trades($1::uuid[])', ['{}']);
  assert.equal(await value('select count(*)::int from public.trades where id = $1', [offer.id]), 0, 'housekeeping took the trade row');
  assert.equal((await ledger(G, before)).effects[0].trade_id, offer.id, 'the ledger did not');
  assert.equal((await ledger(L)).effects.find(e => e.trade_id === offer.id).resident_in.name, 'Pip', 'the arrival’s snapshot is kept too');
  // The resident cannot be sent again from a restored copy, even with the trade row gone.
  await rejects(propose(G, L, { resident: resident('gil-2', 'Pip') }), /already_traded/);
});

test('paging: small pages, a cursor that only moves forward, nothing missed', async () => {
  await friends(D, H);
  for (let i = 0; i < 4; i++) {
    const t = await propose(D, H, { curios: curios(['moth-wing']) }, have(0, { 'moth-wing': 99 }));
    await accept(H, t.id);
  }
  const all = (await ledger(H, 0, 50)).effects;
  const seen = [];
  let cursor = 0, page;
  do {
    page = await ledger(H, cursor, 2);
    assert.ok(page.effects.length <= 2);
    seen.push(...page.effects.map(e => e.seq));
    assert.ok(page.next >= cursor);
    cursor = page.next;
  } while (page.more);
  assert.deepEqual(seen, all.map(e => e.seq));
  const past = await ledger(H, cursor + 10, 2);
  assert.deepEqual([past.effects, past.more, past.next], [[], false, cursor], 'past the head: empty, and the cursor comes back to the head');
});

test('answers are rate limited, with the account locked', async () => {
  const t = await propose(B, A, { curios: curios(['moth-wing']) }, have(0, { 'moth-wing': 99 }));
  await db.query(`insert into private.trade_answers (user_id) select $1 from generate_series(1, 100)`, [A]);
  await rejects(call(A, 'public.decline_trade($1)', [t.id]), /rate_limited/);
  await rejects(accept(A, t.id), /rate_limited/);
  await db.query(`update private.trade_answers set at = now() - interval '25 hours' where user_id = $1`, [A]);
  assert.equal((await call(A, 'public.decline_trade($1)', [t.id])).status, 'declined');
  assert.equal(await value('select count(*)::int from private.trade_answers where user_id = $1', [A]), 1, 'old answers are swept');
});

test('trades sealed before the ledger existed are written into it once when the migration runs', async () => {
  const t = await propose(E, F, { curios: curios(['glass-eye']) }, have(0, { 'glass-eye': 9 }));
  await accept(F, t.id);
  await db.query('delete from public.trade_ledger where trade_id = $1', [t.id]);
  await db.exec(TRADES);
  assert.equal(await value('select count(*)::int from public.trade_ledger where trade_id = $1', [t.id]), 2);
  await db.exec(TRADES);
  assert.equal(await value('select count(*)::int from public.trade_ledger where trade_id = $1', [t.id]), 2, 'a second run adds nothing');
});

test('delete_my_account takes the player’s ledger, and the other player keeps theirs', async () => {
  await db.query('delete from public.blocks where blocker = $1', [J]);
  await friends(I, J);
  const t2 = await propose(J, I, { curios: curios(['moth-wing']) }, have(0, { 'moth-wing': 9 }));
  await accept(I, t2.id);
  await call(J, 'public.delete_my_account()');
  assert.equal(await value('select count(*)::int from public.trade_ledger where owner = $1', [J]), 0);
  assert.equal((await ledger(I)).effects.find(e => e.trade_id === t2.id).partner_name, 'Jo');
});
