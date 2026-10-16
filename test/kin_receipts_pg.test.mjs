// Birth receipts under real concurrency: every call runs on its own PostgreSQL
// connection and they start together (test/support/real-pg.mjs). Skipped
// unless SHELF_PG is set. Covers what PGlite, one connection, cannot: the
// same basket answered by a dozen taps at once, the same receipt claimed by a
// dozen retries, and mail, accept, claim and recovery all running through each
// other without a deadlock or a second foundling.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';

const live = available();
const opts = { skip: live ? false : skipReason };
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const USERS = Array.from({ length: 8 }, (_, i) => id(i + 1));
const [A, B, C, D, E, F] = USERS;
let db;

const resident = (rid, name) => ({ id: rid, name, traits: ['damp'], mood: 'fine', bond: 3, art: { creature: { body: 'pear', palette: 'mint', parts: {} } } });
const json = value => JSON.stringify(value).replace(/'/g, "''");
const shelf = (who, residents) => db.as(who, `select public.publish_shelf('${json({ v: 1, name: '', rank: 0, curios: 0, residents })}'::jsonb);`);
const profile = (who, name) => db.as(who, `select public.ensure_profile('${name}');`);
const friends = (x, y) => db.admin(`insert into public.friendships (requester, addressee, status, created_at)
  values ('${x}', '${y}', 'accepted', now() - interval '30 days') on conflict do nothing;`);
const leave = async (from, to, mine, theirs) => {
  const r = await db.as(from, `select public.kin_leave_basket('${to}', '${json(resident(mine, 'Mine ' + mine))}'::jsonb, '${theirs}');`);
  assert.ok(r.ok, JSON.stringify(r));
  return r.value.id;
};
const accept = (who, basket, rid) => `select public.kin_answer_basket('${basket}', true, '${json(resident(rid, 'Theirs ' + rid))}'::jsonb, 4);`;
const receipts = basket => db.admin(`select count(*) from public.kin_receipts where basket_id = '${basket}';`);
const ok = results => results.filter(r => r.ok).length;
const errors = results => results.filter(r => !r.ok).map(r => r.error);

before(async () => {
  if (!live) return;
  db = await freshDatabase(USERS);
  for (const [who, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay']]) await profile(who, name);
  await friends(A, B); await friends(C, D); await friends(E, F);
  await shelf(A, [resident('a0', 'Mabel')]); await shelf(B, [resident('b0', 'Grubbs')]);
  await shelf(C, [resident('c0', 'Clod')]); await shelf(D, [resident('d0', 'Dweller')]);
  await shelf(E, [resident('e0', 'Eel')]); await shelf(F, [resident('f0', 'Fen')]);
});
after(async () => { if (db) await db.drop(); });

test('twelve taps on Accept at once make one foundling and exactly two receipts', opts, async () => {
  const basket = await leave(A, B, 'a0', 'b0');
  const results = await db.race(Array.from({ length: 12 }, () => [B, accept(B, basket, 'b0')]));
  assert.equal(ok(results), 1, JSON.stringify(errors(results)));
  assert.ok(errors(results).every(e => /not_open/.test(e)), JSON.stringify(errors(results)));
  assert.equal(await receipts(basket), '2');
  assert.equal(await db.admin(`select string_agg(side || ':' || (claimed_at is null)::text, ',' order by side) from public.kin_receipts where basket_id = '${basket}';`), 'from:true,to:true',
    'both start unclaimed: accepting does not claim for anyone');
  assert.equal(await db.admin(`select count(*) from public.kin_pals where basket_id = '${basket}';`), '2', 'one pair of parents, one pair of twins');
});

test('a dozen retries of the claim, from both players, leave one claim time each', opts, async () => {
  const [basket] = (await db.admin(`select basket_id from public.kin_receipts where owner = '${A}';`)).split('\n');
  const calls = Array.from({ length: 12 }, (_, i) => [i % 2 ? A : B, `select public.kin_collect('${basket}');`]);
  const results = await db.race(calls);
  assert.equal(ok(results), 12, JSON.stringify(errors(results)));
  for (const owner of [A, B]) {
    const times = new Set(results.filter((_, i) => (i % 2 ? A : B) === owner).map(r => r.value.claimed_at));
    assert.equal(times.size, 1, 'everyone who asked was told the same time');
    assert.equal(await db.admin(`select (extract(epoch from claimed_at) is not null)::text from public.kin_receipts where owner = '${owner}' and basket_id = '${basket}';`), 'true');
  }
  assert.equal(await receipts(basket), '2', 'a claim never adds or removes a receipt');
  const unclaimedMail = await db.as(A, `select jsonb_array_length((public.kin_mail() -> 'births'));`);
  assert.equal(unclaimedMail.value, 0);
});

test('mail, accept, claim, index and fetch all at once for two pairs: no deadlock, one birth each', opts, async () => {
  const c = await leave(C, D, 'c0', 'd0');
  const e = await leave(E, F, 'e0', 'f0');
  const calls = [
    [D, accept(D, c, 'd0')], [F, accept(F, e, 'f0')],
    [C, 'select public.kin_mail();'], [D, 'select public.kin_mail();'], [E, 'select public.kin_mail();'], [F, 'select public.kin_mail();'],
    [C, `select public.kin_collect('${c}');`], [E, `select public.kin_collect('${e}');`],
    [C, 'select public.kin_recover();'], [D, 'select public.kin_recover(null, null, 1);'],
    [C, `select public.kin_receipts_get(array['${c}']::uuid[]);`], [E, `select public.kin_receipts_get(array['${e}']::uuid[]);`],
    [C, 'select public.kin_mail();'], [E, 'select public.kin_mail();']
  ];
  const results = await db.race(calls);
  const bad = errors(results).filter(m => !/not_found/.test(m));
  assert.deepEqual(bad, [], 'only the claims that beat their own accept may be refused, and only as not_found: ' + JSON.stringify(bad));
  assert.ok(errors(results).length <= 2);
  assert.equal(await receipts(c), '2');
  assert.equal(await receipts(e), '2');
  assert.equal(await db.admin(`select count(*) from public.kin_baskets where status = 'born' and id in ('${c}', '${e}');`), '2');
  // Whatever the order, each player now sees their own birth, once: claimed if their claim got in, waiting if not.
  for (const [who, basket] of [[C, c], [D, c], [E, e], [F, e]]) {
    const index = await db.as(who, 'select public.kin_recover();');
    assert.deepEqual(index.value.items.map(i => i.id), [basket]);
  }
});

test('the index pages through receipts created while it is being read, without repeating or skipping any', opts, async () => {
  for (let i = 0; i < 9; i++) {
    await db.admin(`insert into public.kin_receipts (owner, basket_id, other, side, from_parent, to_parent, to_parent_id, seed, history, created_at, born_at)
      values ('${A}', '00000000-0000-4000-8000-0000000009${String(i).padStart(2, '0')}', '${B}', 'from', '{"id":"a0","name":"Mabel"}', '{"id":"b0","name":"Grubbs"}', 'b0', ${i}, 'friends',
        now() - interval '${100 - i} days', now() - interval '${100 - i} days');`);
  }
  const seen = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const args = after ? `'${after.born_at}'::timestamptz, '${after.id}'::uuid, 4` : 'null, null, 4';
    const r = await db.as(A, `select public.kin_recover(${args});`);
    assert.ok(r.ok, JSON.stringify(r));
    seen.push(...r.value.items.map(i => i.id));
    if (page === 1) await db.admin(`insert into public.kin_receipts (owner, basket_id, other, side, from_parent, to_parent, to_parent_id, seed, history, created_at, born_at)
      values ('${A}', '00000000-0000-4000-8000-000000000999', '${B}', 'from', '{"id":"a0"}', '{"id":"b0"}', 'b0', 1, 'friends', now(), now());`);
    after = r.value.next;
    if (!after) break;
  }
  assert.equal(new Set(seen).size, seen.length, 'no receipt twice');
  assert.equal(seen.length, 11, 'nine old ones, the first birth, and the one that arrived mid-read (newest, so it lands at the end)');
  assert.equal(seen.at(-1), '00000000-0000-4000-8000-000000000999');
});
