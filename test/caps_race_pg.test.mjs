// Daily and hourly caps under real concurrency: every call runs on its own
// PostgreSQL connection and they all start together. A cap that counts and
// then inserts without locking the account lets a burst straight past it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';

const live = available();
const opts = { skip: live ? false : skipReason };
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const USERS = Array.from({ length: 16 }, (_, i) => id(i + 1));
const [A, B, C, D, E, F] = USERS;
let db;

before(async () => {
  if (!live) return;
  db = await freshDatabase(USERS);
});
after(async () => { if (db) await db.drop(); });

const ok = results => results.filter(r => r.ok).length;
const refusals = results => results.filter(r => !r.ok).map(r => r.error);
const friends = (x, y) => db.admin(`insert into public.friendships (requester, addressee, status, created_at)
  values ('${x}', '${y}', 'accepted', now() - interval '30 days') on conflict do nothing;`);
const profile = (who, name) => db.as(who, `select public.ensure_profile('${name}');`);
const resident = (rid, name) => ({ id: rid, name, traits: ['damp'], mood: 'fine', bond: 3, art: { creature: { body: 'pear', palette: 'mint', parts: {} } } });
const shelf = (who, residents) => db.as(who, `select public.publish_shelf('${JSON.stringify({ v: 1, name: '', rank: 0, curios: 0, residents }).replace(/'/g, "''")}'::jsonb);`);

test('feedback: eleven reports at once from an account with no profile file ten', opts, async () => {
  const results = await db.race(Array.from({ length: 11 }, (_, i) =>
    [A, `select public.submit_feedback('race-report-${String(i).padStart(4, '0')}', 'bug', 'Burst ${i}');`]));
  assert.equal(ok(results), 10, JSON.stringify(refusals(results)));
  assert.ok(refusals(results).every(e => /rate_limited/.test(e)), JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.feedback where user_id = '${A}';`), '10');
});

test('Joint Bench: twenty-five hearings at once across five friends open twenty', opts, async () => {
  const cast = JSON.stringify({ v: 1, p: { kind: 'pet', id: 'a0', name: 'Mabel', owner: 'from' }, d: { kind: 'pet', id: 'b0', name: 'Grubbs', owner: 'to' },
    jury: [{ kind: 'stock', id: 'j1', name: 'A Juror' }], witnesses: [] });
  const ruling = JSON.stringify({ ruling: 'defendant', truth: 'plaintiff', stars: 2, ratings: 87, agree: 4, dissent: 1 });
  const targets = USERS.slice(1, 6);
  await profile(B, 'Bea');
  for (const t of targets) await friends(A, t);
  const calls = [];
  for (const t of targets) for (let i = 0; i < 5; i++) {
    calls.push([B === t ? A : A, `select public.open_hearing('${t}', 'served', 'borrowed-coffin', '', ${4000 + calls.length}, '${cast}'::jsonb, '${ruling}'::jsonb, '[]'::jsonb);`]);
  }
  const results = await db.race(calls);
  assert.equal(ok(results), 20, JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.hearings where from_user = '${A}';`), '20');
});

test('Covens: thirteen notes at once in an hour post twelve', opts, async () => {
  const coven = await db.admin(`insert into public.covens (name_a, name_b, sigil_shape, sigil_symbol, sigil_colour)
    values ('damp', 'sisterhood', 'circle', 'eye', 'moss') returning id;`);
  await db.admin(`insert into public.coven_members (user_id, coven_id, role) values ('${C}', '${coven}', 'founder');`);
  const results = await db.race(Array.from({ length: 13 }, (_, i) => [C, `select public.coven_post('["drawer", "regret", "again"]'::jsonb);`]));
  assert.equal(ok(results), 12, JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.coven_notes where author = '${C}';`), '12');
});

test('Kin: eleven introductions at once from one player make ten', opts, async () => {
  await profile(D, 'Dan'); await profile(E, 'Eve');
  await friends(D, E);
  await shelf(D, Array.from({ length: 12 }, (_, i) => resident('d' + i, 'Dee ' + i)));
  await shelf(E, [resident('e0', 'Ezra')]);
  const results = await db.race(Array.from({ length: 11 }, (_, i) => [D, `select public.kin_introduce('${E}', 'd${i}', 'e0');`]));
  assert.equal(ok(results), 10, JSON.stringify(refusals(results)));
});

test('Kin: introductions to one recipient from many senders at once stop at ten for the recipient too', opts, async () => {
  const recipient = F, senders = USERS.slice(6, 16);
  await profile(recipient, 'Fay');
  await shelf(recipient, [resident('f0', 'Fern')]);
  for (const s of senders) {
    await profile(s, 'S' + s.slice(-2));
    await friends(s, recipient);
    await shelf(s, [resident('s0', 'Sender'), resident('s1', 'Spare')]);
  }
  // Eleven introductions from ten different senders, all at once.
  const calls = senders.map(s => [s, `select public.kin_introduce('${recipient}', 's0', 'f0');`]);
  calls.push([senders[0], `select public.kin_introduce('${recipient}', 's1', 'f0');`]);
  const results = await db.race(calls);
  assert.equal(ok(results), 10, JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.kin_pals where (user_a = '${recipient}' or user_b = '${recipient}') and history = 'introduced';`), '10');
});

// ---------------------------------------------------------------------------
// Lock order. Every RPC takes the shared account locks (private.lock_account
// and private.lock_accounts) BEFORE any friendship, basket, pal, letter,
// hearing or coven row lock. A kin basket (friendship row, then account) and a
// hearing (account, then friendship row) between the same two players used to
// wait on each other, and Postgres aborted one with SQLSTATE 40P01.
// ---------------------------------------------------------------------------
test('mixed operations between one pair never deadlock: baskets, hearings, introductions and replies', opts, async () => {
  const [P, Q] = [USERS[12], USERS[13]];
  await profile(P, 'Pax'); await profile(Q, 'Quin');
  await friends(P, Q);
  await shelf(P, [resident('p0', 'Pip'), resident('p1', 'Pop')]);
  await shelf(Q, [resident('q0', 'Quill'), resident('q1', 'Quip')]);
  await db.admin(`insert into public.summons (from_user, to_user, case_id, plaintiff, defendant)
    values ('${P}', '${Q}', 'borrowed-coffin', '{"id":"p0","name":"Pip"}', '{"id":"q0","name":"Quill"}');`);
  const cast = JSON.stringify({ v: 1, p: { kind: 'pet', id: 'p0', name: 'Pip', owner: 'from' }, d: { kind: 'pet', id: 'q0', name: 'Quill', owner: 'to' },
    jury: [{ kind: 'stock', id: 'j1', name: 'A Juror' }], witnesses: [] });
  const ruling = JSON.stringify({ ruling: 'defendant', truth: 'plaintiff', stars: 2, ratings: 87, agree: 4, dissent: 1 });
  const parent = JSON.stringify(resident('p0', 'Pip'));
  let deadlocks = 0, total = 0;
  for (let round = 0; round < 4; round++) {
    const calls = [];
    for (let i = 0; i < 3; i++) {
      calls.push([P, `select public.kin_leave_basket('${Q}', '${parent}'::jsonb, 'q0');`]);
      calls.push([P, `select public.open_hearing('${Q}', 'served', 'borrowed-coffin', '', ${6000 + round * 10 + i}, '${cast}'::jsonb, '${ruling}'::jsonb, '[]'::jsonb);`]);
      calls.push([Q, `select public.open_hearing('${P}', 'invite', 'borrowed-coffin', '', ${7000 + round * 10 + i}, '${cast}'::jsonb, '${ruling}'::jsonb, '[]'::jsonb);`]);
      calls.push([Q, `select public.kin_introduce('${P}', 'q1', 'p1');`]);
      calls.push([P, `select public.kin_introduce('${Q}', 'p0', 'q0');`]);
    }
    const results = await db.race(calls);
    total += results.length;
    deadlocks += results.filter(r => !r.ok && /deadlock/i.test(r.error)).length;
    await db.admin(`delete from public.kin_baskets where from_user in ('${P}', '${Q}'); delete from public.hearings where from_user in ('${P}', '${Q}');`);
  }
  assert.ok(total >= 60);
  assert.equal(deadlocks, 0, 'a call was aborted by the deadlock detector');
});

test('the day-count switch serialises with passive marks: after a switch-off nothing is counted', opts, async () => {
  const U = USERS[14];
  const today = await db.admin(`select to_char(current_date, 'YYYY-MM-DD');`);
  await db.as(U, `select public.mark_play_day('${today}');`);
  const calls = [[U, `select public.forget_play_days();`]];
  for (let i = 0; i < 6; i++) calls.push([U, `select public.mark_play_day('${today}');`], [U, `select public.mark_active_day();`]);
  const results = await db.race(calls);
  assert.ok(results.every(r => r.ok), JSON.stringify(refusals(results)));
  const out = await db.admin(`select (select count(*) from private.play_day_optouts where user_id = '${U}'),
    (select count(*) from public.play_days where user_id = '${U}'), (select count(*) from public.active_days where user_id = '${U}');`);
  // However the marks were ordered against the switch-off, once it stands nothing remains counted.
  assert.equal(out, '1|0|0');
});

// ---------------------------------------------------------------------------
// Co-op shared purse: the same operation from many connections lands once, a
// known reward cannot be granted twice under any id, and a spend racing stakes
// never lets a stake through without funds. There are no earning caps.
// ---------------------------------------------------------------------------
test('Co-op: one game receipt sent from eight connections at once is one receipt', opts, async () => {
  const U = USERS[15];
  await profile(U, 'Uma');
  await db.as(U, `select public.coop_open(50, 0);`);
  const op = '40000000-0000-4000-8000-000000000001';
  const results = await db.race(Array.from({ length: 8 }, () => [U, `select public.coop_adjust('[{"id":"${op}","delta":0,"earned":120,"detail":{"reason":"income"}}]'::jsonb);`]));
  assert.equal(ok(results), 8, JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.coop_receipts where owner = '${U}' and kind = 'game';`), '1');
  assert.equal(await db.admin(`select delta || '/' || earned from public.coop_receipts where owner = '${U}' and kind = 'game';`), '0/120');
});

test('Co-op: a changed payload racing the original lands exactly one version, the other is refused', opts, async () => {
  const U = USERS[11];
  await profile(U, 'Val');
  await db.as(U, `select public.coop_open(0, 0);`);
  const op = '41000000-0000-4000-8000-000000000001';
  const calls = [10, 20, 10, 20].map(d => [U, `select public.coop_adjust('[{"id":"${op}","delta":${d},"earned":${d}}]'::jsonb);`]);
  const results = await db.race(calls);
  assert.ok(refusals(results).every(e => /bad_op/.test(e)), JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.coop_receipts where owner = '${U}' and kind = 'game';`), '1');
  const won = Number(await db.admin(`select delta from public.coop_receipts where owner = '${U}' and kind = 'game';`));
  assert.equal(ok(results), results.filter((_, i) => [10, 20, 10, 20][i] === won).length);
});

test('Co-op: the canonical reward id races from many devices and pays once; a random id for the same reward never lands', opts, async () => {
  const U = USERS[10];
  await profile(U, 'Wes');
  await db.as(U, `select public.coop_open(0, 0);`);
  const id = await db.admin(`select private.currency_id('${U}', 'coven_chest:7:2');`);
  const detail = '{"reward":"coven_chest","week":7,"tier":2,"curio":"moth-wing","frame":null}';
  const calls = Array.from({ length: 6 }, () => [U, `select public.coop_adjust('[{"id":"${id}","delta":15,"earned":15,"detail":${detail}}]'::jsonb);`]);
  calls.push([U, `select public.coop_adjust('[{"id":"42000000-0000-4000-8000-000000000001","delta":15,"earned":15,"detail":${detail}}]'::jsonb);`]);
  const results = await db.race(calls);
  assert.equal(ok(results), 6, JSON.stringify(refusals(results)));
  assert.equal(await db.admin(`select count(*) from public.coop_receipts where owner = '${U}' and kind = 'game';`), '1');
  assert.equal(await db.admin(`select coalesce(sum(delta), 0) from public.coop_receipts where owner = '${U}';`), '15');
});

test('Co-op: big real earnings land without a cap, and a spend racing stakes cannot fund a stake that is not there', opts, async () => {
  const U = USERS[9], targets = USERS.slice(0, 3);
  await profile(U, 'Xan');
  for (const t of targets) await friends(U, t);
  await db.as(U, `select public.coop_open(30, 0);`);
  const big = await db.as(U, `select public.coop_adjust('[{"id":"43000000-0000-4000-8000-000000000001","delta":9000000,"earned":9000000}]'::jsonb);`);
  assert.equal(big.value.balance, 9000030, JSON.stringify(big));
  await db.as(U, `select public.coop_adjust('[{"id":"43000000-0000-4000-8000-000000000002","delta":-9000000,"earned":0}]'::jsonb);`);
  const calls = targets.map(t => [U, `select public.coop_duel_create('${t}', 'stack', 25);`]);
  calls.push([U, `select public.coop_adjust('[{"id":"43000000-0000-4000-8000-000000000003","delta":-5,"earned":0}]'::jsonb);`]);
  const results = await db.race(calls);
  const staked = Number(await db.admin(`select count(*) from public.coop_receipts where owner = '${U}' and kind = 'stake';`));
  const balance = Number(await db.admin(`select (opening + total - opening_base) from public.coop_wallets where owner = '${U}';`));
  // 30 funds exactly one 25 stake whichever order the -5 spend lands in; the rest are refused.
  assert.equal(staked, 1, JSON.stringify(refusals(results)));
  assert.equal(balance, 30 - 5 - 25 + 9000000 - 9000000);
});
