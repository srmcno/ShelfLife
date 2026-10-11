// The trading migration against a real Postgres (PGlite), on top of 0001 and
// 0002 and the same Supabase-shaped bootstrap as social_sql.test.mjs. 0003
// (the postbox) is deliberately absent: 0004 must not need it.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), TRADES = read('0004_trades.sql');
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', '1', '2'];
const [A, B, C, D, E, F, G, H] = IDS.map(x => '00000000-0000-4000-8000-00000000000' + x);
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
  insert into auth.users (id) values ${[A, B, C, D, E, F, G, H].map(id => "('" + id + "')").join(', ')};
`;
const TABLES = ['trade_books', 'trade_items', 'trade_ledger', 'trades'];
const FUNCTIONS = ['accept_trade', 'cancel_trade', 'counter_trade', 'decline_trade', 'get_trade_book', 'list_trades', 'propose_trade', 'publish_trade_book', 'trade_ledger', 'trade_payload'];

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(TRADES); }
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay'], [G, 'Gil'], [H, 'Hal']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
  for (const [x, y] of [[A, B], [A, C], [B, C], [D, E], [E, F], [G, H]]) await friends(x, y);
});

async function as(sub, work, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub || '']);
  await db.exec('set role ' + role);
  try { return await work(); }
  finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const value = async (sql, params) => Object.values(await one(sql, params))[0];
const call = (who, sql, params) => as(who, () => value('select ' + sql, params));
const rejects = (promise, pattern) => assert.rejects(promise, err => pattern.test(err.message) || pattern.test(err.code || ''));
async function friends(x, y) {
  await call(x, 'public.add_friend($1)', [code[y]]);
  assert.equal((await call(y, 'public.add_friend($1)', [code[x]])).status, 'accepted');
}
const curios = (...list) => list.map(([id, n = 1]) => ({ id, n }));
const resident = (id, name = 'Mabel', extra = {}) => ({ id, name, traits: ['damp'], stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, bio: 'Arrived without references.', art: { body: 'data:image/png;base64,AAAA', stamps: [] }, ...extra });
// What a save declares it holds: plenty of everything offered, with every
// ledger entry applied, unless a test says otherwise.
const plenty = (...sides) => ({ seq: 1e9, curios: Object.fromEntries(sides.flatMap(s => s?.curios || []).map(c => [c.id, 99])) });
const propose = (from, to, give, want = {}, line = 'fair', have = plenty(give)) =>
  call(from, 'public.propose_trade($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)', [to, JSON.stringify(give), JSON.stringify(want), line, JSON.stringify(have)]);
const counter = (who, id, give, want = {}, line = '', have = plenty(give)) =>
  call(who, 'public.counter_trade($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)', [id, JSON.stringify(give), JSON.stringify(want), line, JSON.stringify(have)]);
const ALL = { seq: 1e9, curios: Object.fromEntries(['moth-wing', 'glass-eye', 'tiny-coffin', 'half-candle', 'button-eye', 'coffin-nail'].map(id => [id, 99])) };
const accept = (who, id, give = {}, have = ALL) => call(who, 'public.accept_trade($1, $2::jsonb, $3::jsonb)', [id, JSON.stringify(give), JSON.stringify(have)]);
const list = (who, ids = []) => call(who, 'public.list_trades($1::uuid[])', ['{' + ids.join(',') + '}']);
const status = id => value('select status from public.trades where id = $1', [id]);
const age = (id, interval) => db.query(`update public.trades set created_at = created_at - $2::interval, expires_at = expires_at - $2::interval,
  closed_at = closed_at - $2::interval where id = $1`, [id, interval]);

test('the migration is idempotent, locked down, and does not need 0003', async () => {
  const rls = (await db.query(`select c.relname, c.relrowsecurity from pg_class c where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
    and c.relname = any($1) order by c.relname`, [TABLES])).rows;
  assert.deepEqual(rls.map(r => [r.relname, r.relrowsecurity]), TABLES.map(t => [t, true]));
  const policies = (await db.query("select tablename, count(*)::int as n from pg_policies where schemaname = 'public' and tablename = any($1) group by tablename order by tablename", [TABLES])).rows;
  assert.deepEqual(policies, TABLES.map(tablename => ({ tablename, n: 1 })), 'one policy each after two runs');
  const triggers = (await db.query("select tgname from pg_trigger where tgname like 'trades_on_%' order by tgname")).rows.map(r => r.tgname);
  assert.deepEqual(triggers, ['trades_on_block', 'trades_on_unfriend'], 'each trigger exists once');
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1) order by p.proname", [FUNCTIONS])).rows;
  assert.deepEqual(functions.map(f => f.proname), FUNCTIONS, 'each function exists once');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
  for (const table of TABLES) {
    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      for (const role of ['anon', 'authenticated']) {
        assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
      }
    }
  }
  for (const fn of ['propose_trade(uuid,jsonb,jsonb,text,jsonb)', 'accept_trade(uuid,jsonb,jsonb)', 'list_trades(uuid[])', 'get_trade_book(uuid)', 'trade_ledger(bigint,integer)']) {
    assert.equal(await value('select has_function_privilege($1, $2, $3)', ['anon', 'public.' + fn, 'execute']), false, 'anon cannot run ' + fn);
    assert.equal(await value('select has_function_privilege($1, $2, $3)', ['authenticated', 'public.' + fn, 'execute']), true, 'players can run ' + fn);
  }
  assert.equal(await value("select to_regprocedure('private.bump_friendship(uuid,uuid,text)') is null"), true, '0003 is not loaded here');
});

test('the anon role cannot trade, and helpers stay private', async () => {
  await as('', async () => {
    for (const sql of [`public.list_trades('{}')`, `public.cancel_trade('${A}')`, `public.get_trade_book('${A}')`, `public.publish_trade_book('[]', '{}')`]) {
      await rejects(db.query('select ' + sql), /permission denied/);
    }
  }, 'anon');
  await as(A, async () => {
    await rejects(db.query(`select private.trade_blocked('${A}', '${B}')`), /permission denied/);
    await rejects(db.query(`select * from public.trades`), /permission denied/);
    await rejects(db.query(`insert into public.trades (from_user, to_user, kind) values ('${A}', '${B}', 'curio')`), /permission denied/);
    await rejects(db.query(`update public.trade_items set qty = 3`), /permission denied/);
  });
  await as('', () => rejects(db.query(`select public.list_trades('{}')`), /sign in first|28000/));
});

test('offers are checked for shape: curio ids, at most three, one kind per trade', async () => {
  const bad = [
    [{ curios: [] }, {}, 'nothing offered'],
    [{ curios: curios(['Bad Id']) }, {}, 'id pattern'],
    [{ curios: curios(['moth-wing', 4]) }, {}, 'n over 3'],
    [{ curios: curios(['moth-wing', 0]) }, {}, 'n under 1'],
    [{ curios: [{ id: 'moth-wing', n: 1.5 }] }, {}, 'n not whole'],
    [{ curios: curios(['moth-wing', 2], ['glass-eye', 2]) }, {}, 'four in all'],
    [{ curios: curios(['moth-wing'], ['moth-wing']) }, {}, 'a repeat'],
    [{ curios: curios(['a'], ['b'], ['c'], ['d']) }, {}, 'four entries'],
    [{ curios: curios(['moth-wing']) }, { curios: curios(['glass-eye', 2], ['tiny-coffin', 2]) }, 'four asked'],
    [{ curios: curios(['moth-wing']), resident: resident('p1') }, {}, 'a resident with curios'],
    [{ curios: curios(['moth-wing']) }, { resident: { id: 'q1', name: 'Snag' } }, 'asking for a resident without giving one'],
    [{ resident: resident('p1') }, { curios: curios(['glass-eye']) }, 'a resident for curios'],
    [{ resident: { id: 'bad id', name: 'Mabel' } }, {}, 'a bad resident id'],
    [{ resident: { id: 'p1' } }, {}, 'a resident without a name'],
    ['[1]', {}, 'not an object']
  ];
  for (const [give, want, why] of bad) {
    const g = typeof give === 'string' ? give : JSON.stringify(give);
    await rejects(call(A, 'public.propose_trade($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)', [B, g, JSON.stringify(want), '', JSON.stringify(ALL)]), /bad_trade/, why);
  }
  await rejects(propose(A, B, { curios: curios(['moth-wing']) }, {}, 'Not A Line'), /bad_trade/);
  await rejects(propose(A, B, { resident: resident('p1', 'Mabel', { art: { body: 'x'.repeat(150000) } }) }), /too_large/);
  assert.equal(await value(`select count(*)::int from public.trades where from_user = '${A}'`), 0, 'nothing was stored');
});

test('friends only, blocks both ways, and do not disturb when the column exists', async () => {
  await rejects(propose(A, D, { curios: curios(['moth-wing']) }), /not_friends/);
  await rejects(propose(A, A, { curios: curios(['moth-wing']) }), /not_friends/);
  await call(E, 'public.add_friend($1)', [code[A]]);
  await rejects(propose(A, E, { curios: curios(['moth-wing']) }), /not_friends/, 'a pending request is not enough');
  await call(A, 'public.respond_friend($1, false)', [E]);
  // A one-sided block, set behind the friendship's back, still stops both directions.
  await db.query(`insert into public.blocks (blocker, blocked) values ($1, $2)`, [F, E]);
  await rejects(propose(E, F, { curios: curios(['moth-wing']) }), /not_friends/);
  await rejects(propose(F, E, { curios: curios(['moth-wing']) }), /not_friends/);
  await rejects(call(E, 'public.get_trade_book($1)', [F]), /not_friends/);
  await db.query(`delete from public.blocks where blocker = $1`, [F]);

  await db.exec('alter table public.profiles add column if not exists dnd boolean not null default false');
  try {
    await db.query('update public.profiles set dnd = true where user_id = $1', [F]);
    await rejects(propose(E, F, { curios: curios(['moth-wing']) }), /dnd/);
    await db.query('update public.profiles set dnd = false where user_id = $1', [F]);
    const ok = await propose(E, F, { curios: curios(['moth-wing']) });
    assert.equal(ok.status, 'open');
    await call(E, 'public.cancel_trade($1)', [ok.id]);
  } finally { await db.exec('alter table public.profiles drop column if exists dnd'); }
});

test('a curio gift: proposed, listed for both, accepted once, and no one else can touch it', async () => {
  const offer = await propose(A, B, { curios: curios(['moth-wing', 2]) }, {}, 'with-regret');
  assert.deepEqual([offer.status, offer.kind, offer.from_name, offer.to_name, offer.line], ['open', 'curio', 'Ada', 'Bea', 'with-regret']);
  assert.deepEqual(offer.items.map(i => [i.side, i.kind, i.ref, i.qty]), [['from', 'curio', 'moth-wing', 2]]);
  const days = await value('select extract(day from expires_at - created_at)::int from public.trades where id = $1', [offer.id]);
  assert.equal(days, 7, 'offers expire after a week');
  const forB = await list(B);
  assert.equal(forB.count, 1, 'one offer waits for Bea');
  assert.deepEqual(forB.trades.map(t => t.id), [offer.id]);
  assert.equal((await list(A)).count, 0, 'the sender has nothing to answer');
  await rejects(accept(C, offer.id), /not_found/);
  await rejects(accept(A, offer.id), /not_found/, 'the sender cannot accept their own offer');
  await rejects(call(C, 'public.trade_payload($1)', [offer.id]), /not_found/);
  await rejects(call(B, 'public.cancel_trade($1)', [offer.id]), /not_found/, 'only the sender cancels');
  const sealed = await accept(B, offer.id);
  assert.equal(sealed.status, 'accepted');
  assert.ok(sealed.closed_at);
  // Two accepts: exactly one wins.
  await rejects(accept(B, offer.id), /not_open/);
  // A cancel arriving after the accept loses too, and so does a decline.
  await rejects(call(A, 'public.cancel_trade($1)', [offer.id]), /not_open/);
  await rejects(call(B, 'public.decline_trade($1)', [offer.id]), /not_open/);
  assert.equal(await status(offer.id), 'accepted');
  assert.equal((await list(A)).trades.find(t => t.id === offer.id).status, 'accepted', 'the sender sees it sealed and applies it');
});

test('a cancel that lands first wins over the accept, and declines release the offer', async () => {
  const first = await propose(A, B, { curios: curios(['glass-eye']) }, { curios: curios(['tiny-coffin']) });
  assert.deepEqual((await call(A, 'public.cancel_trade($1)', [first.id])), { ok: true, id: first.id, status: 'cancelled' });
  await rejects(accept(B, first.id), /not_open/);
  const second = await propose(A, B, { curios: curios(['glass-eye']) });
  assert.deepEqual(await call(B, 'public.decline_trade($1)', [second.id]), { ok: true, id: second.id, status: 'declined' });
  await rejects(accept(B, second.id), /not_open/);
  await rejects(call(A, 'public.decline_trade($1)', [second.id]), /not_found/, 'only the receiver declines');
  await rejects(call(B, 'public.trade_payload($1)', [second.id]), /not_found/, 'a declined offer has no payload');
});

test('row locks make concurrent answers queue: the accept holds the row until it commits', async () => {
  // PGlite is one connection, so a true race is simulated with an explicit
  // transaction: the accept commits first, and the cancel that queued behind it
  // reads the committed row and is refused.
  const offer = await propose(A, B, { curios: curios(['coffin-nail']) });
  await as(B, async () => {
    await db.exec('begin');
    try {
      await db.query('select public.accept_trade($1, $2::jsonb)', [offer.id, '{}']);
      await db.exec('commit');
    } catch (error) { await db.exec('rollback'); throw error; }
  });
  await rejects(call(A, 'public.cancel_trade($1)', [offer.id]), /not_open/);
  // A refusal inside accept rolls the whole thing back: nothing is half sealed.
  const swap = await propose(B, C, { resident: resident('bea-1', 'Gladys') }, { resident: { id: 'cat-1', name: 'Snag' } });
  await rejects(accept(C, swap.id, { resident: resident('cat-2', 'Wrong one') }), /bad_trade/);
  assert.equal(await status(swap.id), 'open');
  assert.equal(await value(`select snapshot->>'name' from public.trade_items where trade_id = $1 and side = 'to'`, [swap.id]), 'Snag', 'the wanted resident is still only a name');
  await call(B, 'public.cancel_trade($1)', [swap.id]);
});

test('a resident swap carries both snapshots, and a gift needs nothing back', async () => {
  const swap = await propose(G, H, { resident: resident('gil-1', 'Mabel') }, { resident: { id: 'hal-1', name: 'Snag', art: { body: 'x' } } });
  assert.equal(swap.kind, 'resident');
  const wanted = swap.items.find(i => i.side === 'to');
  assert.deepEqual(wanted.snapshot, { id: 'hal-1', name: 'Snag' }, 'only the id and the name of the wanted resident are kept');
  const light = (await list(H)).trades.find(t => t.id === swap.id).items.find(i => i.side === 'from').snapshot;
  assert.equal(light.art.body, undefined, 'lists leave the drawing at home');
  assert.deepEqual(light.art.stamps, []);
  assert.equal((await call(H, 'public.trade_payload($1)', [swap.id])).items.find(i => i.side === 'from').snapshot.art.body, 'data:image/png;base64,AAAA', 'the payload has it');
  await rejects(accept(H, swap.id), /bad_trade/, 'a swap needs the resident it asked for');
  await rejects(accept(H, swap.id, { resident: { id: 'hal-1' } }), /bad_trade/);
  const sealed = await accept(H, swap.id, { resident: resident('hal-1', 'Snag') });
  assert.deepEqual(sealed.items.map(i => [i.side, i.ref, i.snapshot.name]), [['from', 'gil-1', 'Mabel'], ['to', 'hal-1', 'Snag']]);
  assert.equal(sealed.items[0].snapshot.art.body, 'data:image/png;base64,AAAA', 'accept answers with the art');
  const forG = await call(G, 'public.trade_payload($1)', [swap.id]);
  assert.equal(forG.items.find(i => i.side === 'to').snapshot.name, 'Snag', 'the sender fetches what arrives');
});

test('escrow and history: a resident cannot be offered twice, traded twice, or passed on within a week', async () => {
  const first = await propose(D, E, { resident: resident('dan-1', 'Pip') });
  await rejects(propose(D, E, { resident: resident('dan-1', 'Pip') }), /in_escrow/);
  await call(D, 'public.cancel_trade($1)', [first.id]);
  const again = await propose(D, E, { resident: resident('dan-1', 'Pip') });
  await accept(E, again.id);
  await rejects(propose(D, E, { resident: resident('dan-1', 'Pip') }), /already_traded/, 'a restored backup cannot send Pip twice');
  // Eve now has Pip as tr-<trade id>, and may not pass Pip on for a week.
  const arrival = 'tr-' + again.id;
  await rejects(propose(E, F, { resident: resident(arrival, 'Pip') }), /too_soon/);
  await age(again.id, '8 days');
  // Eve's own resident trades this week: one (this one, now aged out), so she may trade again.
  const onward = await propose(E, F, { resident: resident(arrival, 'Pip') });
  assert.equal(onward.status, 'open');
  // The receiver's side is checked on accept too: Fay cannot give a resident she already gave away.
  await call(E, 'public.cancel_trade($1)', [onward.id]);
});

test('resident trades: at most two per player per week, counting offers still waiting', async () => {
  const one = await propose(A, C, { resident: resident('ada-1', 'Agnes') });
  const two = await propose(A, B, { resident: resident('ada-2', 'Velvet') });
  await rejects(propose(A, B, { resident: resident('ada-3', 'Nell') }), /resident_limit/);
  await accept(C, one.id);
  await call(A, 'public.cancel_trade($1)', [two.id]);
  assert.equal((await propose(A, B, { resident: resident('ada-3', 'Nell') })).status, 'open', 'a cancelled offer frees its place');
  await rejects(propose(A, B, { resident: resident('ada-4', 'Doreen') }), /resident_limit/);
  // The receiver has a limit too. Cat has one sealed resident trade (from Ada).
  const c1 = await propose(B, C, { resident: resident('bea-2', 'Wanda') });
  await accept(C, c1.id);
  const c2 = await propose(B, C, { resident: resident('bea-3', 'Crumb') });
  await rejects(accept(C, c2.id), /resident_limit/);
  assert.equal(await status(c2.id), 'open', 'the refused accept changed nothing');
  await db.query(`update public.trades set closed_at = now() - interval '8 days' where kind = 'resident' and status = 'accepted' and to_user = $1`, [C]);
  assert.equal((await accept(C, c2.id)).status, 'accepted', 'a week later there is room again');
});

test('five open offers per pair, either direction, and twenty offers a day', async () => {
  const pair = await value(`select count(*)::int from public.trades where status = 'open' and '${D}' in (from_user, to_user) and '${F}' in (from_user, to_user)`);
  assert.equal(pair, 0);
  await friends(D, F);
  for (let i = 0; i < 3; i++) await propose(D, F, { curios: curios(['moth-wing']) });
  for (let i = 0; i < 2; i++) await propose(F, D, { curios: curios(['glass-eye']) });
  await rejects(propose(D, F, { curios: curios(['moth-wing']) }), /too_many_open/);
  await rejects(propose(F, D, { curios: curios(['moth-wing']) }), /too_many_open/);
  for (const t of (await list(D)).trades.filter(t => t.status === 'open' && t.from_user === D)) await call(D, 'public.cancel_trade($1)', [t.id]);
  // Dan has made 3 offers today plus earlier ones; fill the day up to 20.
  const made = await value(`select count(*)::int from public.trades where from_user = $1 and created_at > now() - interval '1 day'`, [D]);
  for (let i = made; i < 20; i++) {
    const t = await propose(D, F, { curios: curios(['tiny-coffin']) });
    await call(D, 'public.cancel_trade($1)', [t.id]);
  }
  await rejects(propose(D, F, { curios: curios(['tiny-coffin']) }), /rate_limited/, 'cancelled offers still count');
  await db.query(`update public.trades set created_at = created_at - interval '2 days' where from_user = $1`, [D]);
  assert.equal((await propose(D, F, { curios: curios(['tiny-coffin']) })).status, 'open');
});

test('counter once: the original closes, the counter goes the other way, and cannot be countered', async () => {
  const offer = await propose(B, A, { curios: curios(['half-candle']) }, { curios: curios(['moth-wing']) });
  await rejects(counter(B, offer.id, { curios: curios(['moth-wing']) }), /not_found/, 'the sender cannot counter their own offer');
  await rejects(counter(A, offer.id, { resident: resident('ada-9') }), /bad_trade/, 'a counter keeps the kind');
  const back = await counter(A, offer.id, { curios: curios(['moth-wing']) }, { curios: curios(['half-candle'], ['glass-eye']) }, 'counter');
  assert.deepEqual([back.from_user, back.to_user, back.parent, back.status], [A, B, offer.id, 'open']);
  assert.equal(await status(offer.id), 'countered');
  await rejects(accept(A, offer.id), /not_open/);
  await rejects(counter(B, back.id, { curios: curios(['half-candle']) }), /no_counter/);
  assert.equal((await accept(B, back.id)).status, 'accepted');
});

test('offers expire after seven days, and an expired one cannot be answered', async () => {
  const offer = await propose(C, B, { curios: curios(['button-eye']) });
  await age(offer.id, '7 days 1 minute');
  await rejects(accept(B, offer.id), /expired/);
  await rejects(counter(B, offer.id, { curios: curios(['moth-wing']) }), /expired/);
  await rejects(call(C, 'public.cancel_trade($1)', [offer.id]), /not_open/);
  const seen = (await list(C)).trades.find(t => t.id === offer.id);
  assert.equal(seen.status, 'expired', 'the sender learns of it and releases escrow');
  assert.equal(await status(offer.id), 'expired', 'and looking at the list wrote it down');
  assert.equal(await value('select closed_at = expires_at from public.trades where id = $1', [offer.id]), true, 'closed when it expired, not when noticed');
});

test('blocking and unfriending tear up waiting offers but keep sealed trades', async () => {
  await friends(C, F);
  const waiting = await propose(C, F, { curios: curios(['moth-wing']) });
  const sealed = await propose(C, F, { curios: curios(['glass-eye']) });
  await accept(F, sealed.id);
  assert.deepEqual(await call(F, 'public.block_user($1)', [C]), { ok: true });
  assert.equal(await status(waiting.id), 'cancelled');
  const forC = await list(C);
  assert.equal(forC.trades.find(t => t.id === sealed.id).status, 'accepted', 'the sealed trade is still there to apply');
  assert.equal((await call(C, 'public.trade_payload($1)', [sealed.id])).status, 'accepted');
  await rejects(propose(C, F, { curios: curios(['moth-wing']) }), /not_friends/);
  await db.query(`delete from public.blocks where blocker = $1 and blocked = $2`, [F, C]);

  await friends(C, F);
  const another = await propose(F, C, { curios: curios(['moth-wing']) });
  await call(C, 'public.remove_friend($1)', [F]);
  assert.equal(await status(another.id), 'cancelled');
});

test('list_trades: the count, old rows housekept, and escrowed ids answered whatever their age', async () => {
  await friends(E, H);
  const old = await propose(E, H, { curios: curios(['moth-wing']) });
  await call(H, 'public.decline_trade($1)', [old.id]);
  await age(old.id, '40 days');
  assert.ok(!(await list(E)).trades.some(t => t.id === old.id), 'gone after 30 days');
  assert.equal(await value('select count(*)::int from public.trades where id = $1', [old.id]), 0, 'and deleted');
  const kept = await propose(E, H, { curios: curios(['glass-eye']) });
  await accept(H, kept.id);
  await age(kept.id, '70 days');
  assert.ok(!(await list(E)).trades.some(t => t.id === kept.id), 'out of the 60 day window');
  assert.equal((await list(E, [kept.id])).trades.find(t => t.id === kept.id).status, 'accepted', 'but answered when asked for by id');
  await age(kept.id, '30 days');
  await list(E);
  assert.equal(await value(`select count(*)::int from public.trade_items where trade_id = $1 and snapshot is not null`, [kept.id]), 0, 'snapshots go after 90 days');
  const missing = '00000000-0000-4000-8000-0000000000ff';
  assert.ok(!(await list(E, [missing])).trades.some(t => t.id === missing), 'an unknown id is simply absent');
  await rejects(list(E, Array.from({ length: 51 }, (_, i) => '00000000-0000-4000-8000-' + String(i).padStart(12, '0'))), /bad_trade/);
  const strangers = await list(E, [(await propose(A, B, { curios: curios(['moth-wing']) })).id]);
  assert.ok(strangers.trades.every(t => [t.from_user, t.to_user].includes(E)), 'other players’ trades never appear, even by id');
  assert.ok(Date.parse(strangers.now) > 0, 'the server clock comes with the list');
});

test('the trading book: validated, friends only, and written at most every five seconds', async () => {
  const book = (who, wish, spares) => call(who, 'public.publish_trade_book($1::jsonb, $2::jsonb)', [JSON.stringify(wish), JSON.stringify(spares)]);
  await rejects(book(A, Array.from({ length: 13 }, (_, i) => 'c' + i), {}), /bad_trade/);
  await rejects(book(A, ['moth-wing', 'moth-wing'], {}), /bad_trade/);
  await rejects(book(A, ['Moth Wing'], {}), /bad_trade/);
  await rejects(book(A, [1], {}), /bad_trade/);
  await rejects(book(A, [], { 'moth-wing': 0 }), /bad_trade/);
  await rejects(book(A, [], { 'moth-wing': 100 }), /bad_trade/);
  await rejects(book(A, [], { 'Moth': 1 }), /bad_trade/);
  await rejects(book(A, [], Object.fromEntries(Array.from({ length: 61 }, (_, i) => ['c' + i, 1]))), /bad_trade/);
  assert.deepEqual(await book(A, ['glass-eye', 'tiny-coffin'], { 'moth-wing': 2 }), { ok: true });
  assert.deepEqual(await book(A, ['glass-eye'], {}), { ok: true, skipped: true }, 'too soon: kept as it was');
  const seen = await call(B, 'public.get_trade_book($1)', [A]);
  assert.deepEqual([seen.wishlist, seen.spares], [['glass-eye', 'tiny-coffin'], { 'moth-wing': 2 }]);
  await db.query(`update public.trade_books set updated_at = now() - interval '1 minute' where user_id = $1`, [A]);
  assert.deepEqual(await book(A, ['glass-eye'], {}), { ok: true });
  assert.deepEqual((await call(A, 'public.get_trade_book($1)', [A])).wishlist, ['glass-eye']);
  await rejects(call(D, 'public.get_trade_book($1)', [A]), /not_friends/);
  assert.equal(await call(A, 'public.get_trade_book($1)', [C]), null, 'no book yet');
});

test('a sealed trade bumps the friendship when the postbox migration provides it', async () => {
  await db.exec(`create table if not exists private.bumps (a uuid, b uuid, kind text);
    create or replace function private.bump_friendship(a uuid, b uuid, kind text) returns void language sql security definer set search_path = public
      as $$ insert into private.bumps values (a, b, kind) $$;`);
  try {
    const offer = await propose(B, A, { curios: curios(['moth-wing']) });
    await accept(A, offer.id);
    assert.deepEqual((await db.query('select a, b, kind from private.bumps')).rows, [{ a: B, b: A, kind: 'trade' }]);
  } finally { await db.exec('drop function private.bump_friendship(uuid, uuid, text); drop table private.bumps;'); }
});

test('delete_my_account takes every trade row with it', async () => {
  await call(G, 'public.publish_trade_book($1::jsonb, $2::jsonb)', ['["moth-wing"]', '{}']);
  await propose(G, H, { curios: curios(['moth-wing']) });
  const count = async () => [
    await value(`select count(*)::int from public.trades where '${G}' in (from_user, to_user)`),
    await value(`select count(*)::int from public.trade_items i join public.trades t on t.id = i.trade_id where '${G}' in (t.from_user, t.to_user)`),
    await value(`select count(*)::int from public.trade_books where user_id = '${G}'`)
  ];
  assert.ok((await count()).every(n => n > 0));
  const orphans = await value('select count(*)::int from public.trade_items');
  await call(G, 'public.delete_my_account()');
  assert.deepEqual(await count(), [0, 0, 0]);
  assert.ok(await value('select count(*)::int from public.trade_items') < orphans);
});
