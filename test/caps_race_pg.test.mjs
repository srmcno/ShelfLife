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
