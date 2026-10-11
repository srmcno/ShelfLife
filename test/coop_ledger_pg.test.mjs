// The co-op money ledger under real concurrency: every call runs on its own
// PostgreSQL connection (test/support/real-pg.mjs) and racers are released
// together. Claims, collects and stakes started at once must still write one
// receipt each, answer identically, and never take a balance below zero.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';

const live = available();
const opts = { skip: live ? false : skipReason };
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const USERS = Array.from({ length: 24 }, (_, i) => id(i + 1));
const [A, B, C, D, E, F, G, H] = USERS;
let db;

before(async () => {
  if (!live) return;
  db = await freshDatabase(USERS);
});
after(async () => { if (db) await db.drop(); });

const ok = results => results.filter(r => r.ok);
const errors = results => results.filter(r => !r.ok).map(r => r.error);
const friends = (x, y) => db.admin(`insert into public.friendships (requester, addressee, status, created_at)
  values ('${x}', '${y}', 'accepted', now() - interval '30 days') on conflict do nothing;`);
const sql = (who, text) => db.as(who, text).then(r => { if (!r.ok) throw new Error(r.error); return r.value; });
const open = (who, souls, after = 0) => sql(who, `select public.coop_open(${souls}, ${after});`);
const create = (who, to, stake) => sql(who, `select public.coop_duel_create('${to}', 'stack', ${stake});`);
const claimSql = duel => `select public.coop_duel_claim('${duel}');`;
const count = async text => Number(await db.admin(text));
const resident = (rid, name) => ({ id: rid, name, traits: ['damp'], stats: { cute: 4, menace: 8, damp: 7, mystique: 2 },
  art: { creature: { v: 1, seed: 'abc', body: 'blob', palette: 'moss', parts: {}, tune: {} } } });
const report = { route: 'drawer', gear: 'thread', edition: 2, rev: 2, score: 7, tier: 2, returned: 0, built: false, choices: [1, 2, 0], helped: [0], crew: [] };

test('two claims of one refund at once write one receipt and both answer it', opts, async () => {
  await friends(A, B);
  await open(A, 100);
  const made = await create(A, B, 25);
  await sql(A, `select public.coop_duel_decline('${made.id}');`);
  const results = await db.race([[A, claimSql(made.id)], [A, claimSql(made.id)], [A, claimSql(made.id)]]);
  assert.deepEqual(errors(results), []);
  const answers = results.map(r => r.value.receipt);
  assert.ok(answers.every(r => r && r.id === answers[0].id && r.seq === answers[0].seq && r.delta === 25), JSON.stringify(answers));
  assert.deepEqual(results.map(r => r.value.souls).sort(), [0, 0, 25], 'exactly one call newly paid');
  assert.equal(await count(`select count(*) from public.coop_receipts where source_id = '${made.id}' and kind = 'duel';`), 1);
  // A retry long after the commit (the first answer was lost) gets the same receipt.
  const retry = await sql(A, claimSql(made.id));
  assert.deepEqual(retry.receipt, answers[0]);
  assert.equal((await sql(A, 'select public.coop_wallet();')).balance, 100, 'the stake came back once');
});

test('a winner claiming on two devices at once gets one receipt; the loser racing them gets one zero receipt', opts, async () => {
  await friends(C, D);
  await open(C, 50); await open(D, 50);
  const made = await create(C, D, 20);
  await sql(C, `select public.coop_duel_submit('${made.id}', 1, 9, null);`);
  await sql(D, `select public.coop_duel_play('${made.id}');`);
  await sql(D, `select public.coop_duel_submit('${made.id}', 1, 3);`);
  await sql(C, `select public.coop_duel_rematch('${made.id}');`);
  await sql(C, `select public.coop_duel_submit('${made.id}', 2, 9, null);`);
  await sql(D, `select public.coop_duel_play('${made.id}');`);
  assert.equal((await sql(D, `select public.coop_duel_submit('${made.id}', 2, 3);`)).outcome, 'challenger');
  const results = await db.race([[C, claimSql(made.id)], [D, claimSql(made.id)], [C, claimSql(made.id)], [D, claimSql(made.id)]]);
  assert.deepEqual(errors(results), []);
  const won = results.filter((_, i) => i % 2 === 0).map(r => r.value.receipt);
  assert.deepEqual(won[0], won[1]);
  assert.deepEqual([won[0].delta, won[0].earned, won[0].owner], [40, 20, C]);
  const lost = results.filter((_, i) => i % 2 === 1).map(r => r.value.receipt);
  assert.deepEqual(lost[0], lost[1]);
  assert.deepEqual([lost[0].delta, lost[0].earned, lost[0].owner, lost[0].kind], [0, 0, D, 'duel']);
  assert.equal(await count(`select count(*) from public.coop_receipts where source_id = '${made.id}' and kind = 'duel';`), 2, 'one receipt per player');
  assert.equal(await count(`select sum(delta) from public.coop_receipts where source_id = '${made.id}';`), 0, 'the pot pays out exactly what went in');
});

test('stakes started at once cannot take the balance below zero', opts, async () => {
  const targets = USERS.slice(8, 14);
  for (const t of targets) await friends(E, t);
  await open(E, 60);
  const results = await db.race(targets.map(t => [E, `select public.coop_duel_create('${t}', 'stack', 25);`]));
  assert.equal(ok(results).length, 2, JSON.stringify(errors(results)));
  assert.ok(errors(results).every(e => /insufficient_souls/.test(e)), JSON.stringify(errors(results)));
  assert.equal((await sql(E, 'select public.coop_wallet();')).balance, 10);
  assert.equal(await count(`select count(*) from public.coop_holds where owner = '${E}';`), 2, 'a hold for each stake that left, and no other');
  const seqs = (await sql(E, 'select public.coop_receipts(0);')).receipts.map(r => r.seq);
  assert.deepEqual(seqs, [1, 2], 'no gaps from the refused ones');
  // The opponent's stake on first play is checked the same way: two at once with room for one.
  await friends(F, USERS[14]); await friends(F, USERS[15]);
  for (const from of [USERS[14], USERS[15]]) { await open(from, 100); }
  const duels = [];
  for (const from of [USERS[14], USERS[15]]) {
    const d = await create(from, F, 20);
    await sql(from, `select public.coop_duel_submit('${d.id}', 1, 5, null);`);
    duels.push(d.id);
  }
  await open(F, 30);
  const plays = await db.race(duels.map(d => [F, `select public.coop_duel_play('${d}');`]));
  assert.equal(ok(plays).length, 1, JSON.stringify(errors(plays)));
  assert.match(errors(plays)[0], /insufficient_souls/);
  assert.equal((await sql(F, 'select public.coop_wallet();')).balance, 10);
});

test('wages: four collects at once write one receipt; four trips finishing at once stay within 30', opts, async () => {
  const hirers = USERS.slice(16, 20);
  for (const h of hirers) await friends(G, h);
  await sql(G, `select public.coop_set_hires('${JSON.stringify([resident('g1', 'Mabel'), resident('g2', 'Pip')])}'::jsonb);`);
  // Four hirers at once for a resident that takes three trips a day.
  const hires = await db.race(hirers.map(h => [h, `select public.coop_hire('${G}', 'g1');`]));
  assert.equal(ok(hires).length, 3, JSON.stringify(errors(hires)));
  assert.match(errors(hires)[0], /fully_booked/);
  const fourth = hirers.find((h, i) => !hires[i].ok);
  const extra = await sql(fourth, `select public.coop_hire('${G}', 'g2');`);
  const trips = [...ok(hires).map(r => r.value), extra];
  const owner = await db.admin(`select string_agg(hirer::text || '=' || id::text, ',') from public.coop_hires where owner = '${G}';`);
  const byHirer = Object.fromEntries(owner.split(',').map(x => x.split('=')));
  const hired = Object.entries(byHirer);
  const finished = await db.race(hired.map(([h, hire]) => [h, `select public.coop_finish_hire('${hire}', '${JSON.stringify(report)}'::jsonb);`]));
  assert.deepEqual(errors(finished), []);
  assert.equal(finished.reduce((n, r) => n + r.value.wages, 0), 30, JSON.stringify(finished.map(r => r.value.wages)));
  assert.equal(trips.length, 4);
  // Booking order does not determine which concurrent finish earns wages.
  const first = hired[finished.findIndex(r => r.value.wages > 0)][1];
  const collects = await db.race(Array.from({ length: 4 }, () => [G, `select public.coop_collect('${first}');`]));
  assert.deepEqual(errors(collects), []);
  assert.ok(collects.every(r => r.value.receipt && r.value.receipt.id === collects[0].value.receipt.id));
  assert.equal(collects.filter(r => r.value.wages > 0).length, 1);
  assert.equal(await count(`select count(*) from public.coop_receipts where source_id = '${first}';`), 1);
  const unpaid = hired[finished.findIndex(r => r.value.wages === 0)][1];
  const zeroCollects = await db.race(Array.from({ length: 4 }, () => [G, `select public.coop_collect('${unpaid}');`]));
  assert.deepEqual(errors(zeroCollects), []);
  assert.ok(zeroCollects.every(r => r.value.wages === 0 && r.value.receipt?.delta === 0 && r.value.receipt.id === zeroCollects[0].value.receipt.id));
  assert.equal(await count(`select count(*) from public.coop_receipts where source_id = '${unpaid}';`), 1);
});

test('caps with no profile row: eleven challenges at once from one account open ten', opts, async () => {
  const targets = USERS.slice(20, 24).concat(USERS.slice(8, 14), [A]);
  for (const t of targets) await friends(H, t);
  const results = await db.race(targets.map(t => [H, `select public.coop_duel_create('${t}', 'stack', 0);`]));
  assert.equal(ok(results).length, 10, JSON.stringify(errors(results)));
  assert.match(errors(results)[0], /rate_limited/);
  assert.equal(await count(`select count(*) from public.profiles where user_id = '${H}';`), 0);
});

test('a restored backup over real connections: the refunded 25 replays to 100, never 125', opts, async () => {
  const [P, Q] = [USERS[22], USERS[23]];
  await friends(P, Q);
  await open(P, 100);
  const made = await create(P, Q, 25);
  await sql(P, `select public.coop_duel_decline('${made.id}');`);
  await db.race([[P, claimSql(made.id)], [P, claimSql(made.id)]]);
  // The old save: 100 souls, no receipts seen. It re-declares, claims again and replays.
  assert.equal((await open(P, 125)).accepted, false);
  assert.equal((await sql(P, claimSql(made.id))).souls, 0);
  const feed = await sql(P, 'select public.coop_receipts(0);');
  assert.equal(100 + feed.receipts.reduce((n, r) => n + r.delta, 0), 100);
  assert.deepEqual(feed.receipts.map(r => [r.kind, r.delta, r.earned]), [['stake', -25, 0], ['duel', 25, 0]]);
});
