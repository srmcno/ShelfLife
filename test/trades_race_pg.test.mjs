// Trades under real concurrency: every call runs on its own PostgreSQL
// connection and they all start together (test/support/real-pg.mjs). Two
// honest devices of one account must not be able to promise the same curios
// twice, a sealed trade lands in each ledger exactly once with no gaps, and a
// block racing an acceptance either seals or cancels, never both.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';

const live = available();
const opts = { skip: live ? false : skipReason };
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const USERS = Array.from({ length: 12 }, (_, i) => id(i + 1));
const [A, B, C, D, E, F, G, H, I, J, K, L] = USERS;
let db;

before(async () => {
  if (!live) return;
  db = await freshDatabase(USERS);
  for (const [i, u] of USERS.entries()) await db.as(u, `select public.ensure_profile('P${i}');`);
  for (const [x, y] of [[A, B], [A, C], [D, E], [D, F], [E, F], [G, H], [I, J], [K, L]]) await friends(x, y);
});
after(async () => { if (db) await db.drop(); });

const ok = results => results.filter(r => r.ok).length;
const refusals = results => results.filter(r => !r.ok).map(r => r.error);
const friends = (x, y) => db.admin(`insert into public.friendships (requester, addressee, status) values ('${x}', '${y}', 'accepted') on conflict do nothing;`);
const j = value => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const curios = (...list) => ({ curios: list.map(([cid, n = 1]) => ({ id: cid, n })) });
const have = (seq, map) => ({ seq, curios: map });
const proposeSql = (to, give, h, want = {}) => `select public.propose_trade('${to}', ${j(give)}, ${j(want)}, 'fair', ${j(h)});`;
const acceptSql = (tid, h = null) => `select public.accept_trade('${tid}', '{}'::jsonb, ${h ? j(h) : 'null'});`;
const count = sql => db.admin(sql).then(Number);

test('two devices offer 2 of the same 3 moth wings at once: exactly one offer stands', opts, async () => {
  const offer = proposeSql(B, curios(['moth-wing', 2]), have(0, { 'moth-wing': 3 }));
  const results = await db.race([[A, offer], [A, offer.replace(`'${B}'`, `'${C}'`)]]);
  assert.equal(ok(results), 1, JSON.stringify(results));
  assert.ok(refusals(results).every(e => /not_enough/.test(e)), JSON.stringify(refusals(results)));
  assert.equal(await count(`select coalesce(sum(i.qty), 0) from public.trades t join public.trade_items i on i.trade_id = t.id
    where t.from_user = '${A}' and t.status = 'open' and i.ref = 'moth-wing';`), 2, 'Ada has promised two, and has two to spare');
});

test('eight devices offer one glass eye each from a 4 copy shelf: three stand', opts, async () => {
  const calls = Array.from({ length: 8 }, (_, i) => [D, proposeSql(i % 2 ? E : F, curios(['glass-eye']), have(0, { 'glass-eye': 4 }))]);
  const results = await db.race(calls);
  assert.equal(ok(results), 3, JSON.stringify(refusals(results)));
  assert.ok(refusals(results).every(e => /not_enough|too_many_open/.test(e)), JSON.stringify(refusals(results)));
});

test('an acceptance racing a stale device: the sealed curios are never promised again', opts, async () => {
  const open = await db.as(G, proposeSql(H, curios(['tiny-coffin', 2]), have(0, { 'tiny-coffin': 3 })));
  assert.equal(open.ok, true, open.error);
  // Hal accepts while Gil's other device, which still thinks it has 3 at cursor 0, offers one more.
  const results = await db.race([[H, acceptSql(open.value.id)], [G, proposeSql(H, curios(['tiny-coffin']), have(0, { 'tiny-coffin': 3 }))]]);
  assert.equal(results[0].ok, true, results[0].error);
  assert.equal(results[1].ok, false, 'seen as open or as settled, it is spent either way');
  assert.match(results[1].error, /not_enough/);
});

test('an acceptance that gives curios racing the receiver’s own offer: only one spends the spare', opts, async () => {
  // Fay has 2 half candles: one spare. Dan asks for it; at the same time Fay offers it to Eve.
  const ask = await db.as(D, proposeSql(F, curios(['moth-wing']), have(0, { 'moth-wing': 9 }), curios(['half-candle'])));
  assert.equal(ask.ok, true, ask.error);
  const results = await db.race([[F, acceptSql(ask.value.id, have(0, { 'half-candle': 2 }))], [F, proposeSql(E, curios(['half-candle']), have(0, { 'half-candle': 2 }))]]);
  assert.equal(ok(results), 1, JSON.stringify(results));
  assert.match(refusals(results)[0], /not_enough/);
});

test('five acceptances at once write five ledger rows each side, numbered without gaps', opts, async () => {
  const offers = [];
  for (let i = 0; i < 5; i++) {
    const r = await db.as(K, proposeSql(L, curios(['coffin-nail']), have(0, { 'coffin-nail': 99 })));
    assert.equal(r.ok, true, r.error);
    offers.push(r.value.id);
  }
  const results = await db.race(offers.map(t => [L, acceptSql(t)]));
  assert.equal(ok(results), 5, JSON.stringify(refusals(results)));
  for (const who of [K, L]) {
    const seqs = (await db.admin(`select string_agg(seq::text, ',' order by seq) from public.trade_ledger where owner = '${who}';`)).split(',').map(Number);
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1), who + ' ledger: ' + seqs);
    assert.equal(await count(`select count(*) from public.trade_ledger where owner = '${who}' and trade_id in (${offers.map(t => `'${t}'`).join(',')});`), 5);
  }
});

test('the same offer accepted twice at once: sealed once, settled once', opts, async () => {
  const r = await db.as(I, proposeSql(J, curios(['lake-ring']), have(0, { 'lake-ring': 3 })));
  const results = await db.race([[J, acceptSql(r.value.id)], [J, acceptSql(r.value.id)], [J, acceptSql(r.value.id)]]);
  assert.equal(ok(results), 1, JSON.stringify(results));
  assert.ok(refusals(results).every(e => /not_open/.test(e)));
  assert.equal(await count(`select count(*) from public.trade_ledger where trade_id = '${r.value.id}';`), 2);
});

test('a block racing an acceptance: sealed with both ledger rows, or cancelled with none', opts, async () => {
  for (let round = 0; round < 3; round++) {
    await friends(I, J);
    await db.admin(`delete from public.blocks where blocker = '${J}' or blocker = '${I}';`);
    await friends(I, J);
    const r = await db.as(I, proposeSql(J, curios(['jar-teeth']), have(0, { 'jar-teeth': 9 })));
    assert.equal(r.ok, true, r.error);
    await db.race([[J, acceptSql(r.value.id)], [I, `select public.block_user('${J}');`]]);
    const status = await db.admin(`select status from public.trades where id = '${r.value.id}';`);
    const rows = await count(`select count(*) from public.trade_ledger where trade_id = '${r.value.id}';`);
    assert.ok((status === 'accepted' && rows === 2) || (status === 'cancelled' && rows === 0), status + ' with ' + rows + ' ledger rows');
    await db.admin(`delete from public.blocks where blocker = '${I}';`);
  }
});

test('a burst of answers stops at the daily cap', opts, async () => {
  await db.admin(`insert into private.trade_answers (user_id) select '${C}' from generate_series(1, 97);`);
  const offers = [];
  for (let i = 0; i < 4; i++) offers.push((await db.as(A, proposeSql(C, curios(['button-eye']), have(0, { 'button-eye': 99 })))).value.id);
  const results = await db.race(offers.map(t => [C, `select public.decline_trade('${t}');`]));
  assert.equal(ok(results), 3, JSON.stringify(refusals(results)));
  assert.ok(refusals(results).every(e => /rate_limited/.test(e)));
});
