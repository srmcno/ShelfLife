// The Joint Bench migration (0005) against a real Postgres (PGlite), on top of
// 0001 and 0002, each run twice to prove it is idempotent. The heart of it:
// the first judge's ruling is sealed, so every call the second judge can make
// is checked before they rule.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), JOINT = read('0005_joint_court.sql');
const [A, B, C, D, E, F] = ['a', 'b', 'c', 'd', 'e', 'f'].map(x => '00000000-0000-4000-8000-00000000000' + x);
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
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}'), ('${F}');
`;
const RPCS = ['open_hearing', 'rule_hearing', 'hearings', 'get_hearing', 'decline_hearing', 'reveal_hearing', 'bench_record'];

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(JOINT); }
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
  await friends(A, B); await friends(A, D); await friends(A, E); await friends(B, F);
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

const CAST = { v: 1, p: { kind: 'pet', id: 'm1', name: 'Mabel', owner: 'from' }, d: { kind: 'pet', id: 'p0', name: 'Pip', owner: 'to' },
  jury: [{ kind: 'npc', id: 'woodlouse', name: 'Geoffrey the Woodlouse' }], witnesses: [] };
// A sealed ruling with numbers nothing else in a hearing would contain.
const SEALED = { ruling: 'defendant', truth: 'plaintiff', stars: 2, ratings: 87, agree: 4, dissent: 1 };
const MARKS = [{ at: 'opening:3', r: 'laugh', ms: 400 }, { at: 'ask:2:1', r: 'gavel', ms: 0 }];
function open(from, to, { kind = 'served', kase = 'borrowed-coffin', twist = '', seed = 4242, cast = CAST, ruling = SEALED, marks = MARKS } = {}) {
  return call(from, 'public.open_hearing($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)',
    [to, kind, kase, twist, seed, JSON.stringify(cast), JSON.stringify(ruling), JSON.stringify(marks)]);
}
const rule = (who, id, ruling, marks = []) => call(who, 'public.rule_hearing($1, $2::jsonb, $3::jsonb)', [id, JSON.stringify(ruling), JSON.stringify(marks)]);
const list = who => call(who, 'public.hearings()');
const clearPair = (x, y) => db.query(`delete from public.hearings where least(from_user, to_user) = least($1::uuid, $2::uuid) and greatest(from_user, to_user) = greatest($1::uuid, $2::uuid)`, [x, y]);

test('the migration is idempotent and its tables cannot be touched from the API', async () => {
  for (const table of ['hearings', 'bench_records']) {
    assert.equal(await value(`select relrowsecurity from pg_class where oid = 'public.${table}'::regclass`), true, table + ' has RLS');
    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      for (const role of ['anon', 'authenticated']) {
        assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
      }
    }
    assert.equal(await value(`select count(*)::int from pg_policies where tablename = '${table}'`), 0, 'no policy: nobody reads ' + table + ' directly');
  }
  const functions = (await db.query("select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1)", [RPCS])).rows;
  assert.deepEqual(functions.map(f => f.proname).sort(), [...RPCS].sort(), 'each RPC exists once after two runs');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
  assert.equal(await value("select count(*)::int from pg_trigger where tgname in ('hearings_on_block', 'hearings_on_unfriend')"), 2, 'one of each trigger');
  await as('', async () => {
    for (const sql of ['public.hearings()', `public.get_hearing('${A}')`, `public.bench_record('${A}')`]) await rejects(db.query('select ' + sql), /permission denied/);
  }, 'anon');
  await as(A, async () => {
    await rejects(db.query('select * from public.hearings'), /permission denied/);
    await rejects(db.query('select * from public.bench_records'), /permission denied/);
    await rejects(db.query(`select private.clean_marks('[]'::jsonb)`), /permission denied/);
    await rejects(db.query(`insert into public.hearings (from_user, to_user, kind, case_id, seed, cast_snapshot, first_ruling) values ('${A}', '${B}', 'served', 'x', 1, '{}', '{}')`), /permission denied/);
  });
  await as('', () => rejects(db.query('select public.hearings()'), /sign in first|28000/));
});

test('opening a hearing: friends only, a sound case, cast and ruling, or a refusal', async () => {
  await rejects(open(C, A), /not_friends/);
  await rejects(open(A, C), /not_friends/);
  await rejects(open(A, A), /not_friends/);
  await rejects(open(A, B, { kind: 'duel' }), /bad_hearing/);
  await rejects(open(A, B, { kase: 'The Borrowed Coffin' }), /bad_case/);
  await rejects(open(A, B, { twist: 'Keith!' }), /bad_hearing/);
  await rejects(open(A, B, { seed: 0 }), /bad_hearing/);
  await rejects(open(A, B, { cast: { p: {}, d: {} } }), /bad_cast/);
  await rejects(open(A, B, { cast: { ...CAST, jury: Array(7).fill(CAST.jury[0]) } }), /bad_cast/);
  await rejects(open(A, B, { cast: { ...CAST, witnesses: Array(4).fill(CAST.p) } }), /bad_cast/);
  await rejects(open(A, B, { cast: { ...CAST, p: { ...CAST.p, art: { body: 'x'.repeat(150000) } } } }), /too_large/);
  for (const bad of [null, {}, { ...SEALED, ruling: 'guilty' }, { ...SEALED, truth: '' }, { ...SEALED, stars: 4 }, { ...SEALED, stars: '2' },
    { ...SEALED, ratings: 101 }, { ...SEALED, ratings: 50.5 }, { ...SEALED, agree: 7 }, { ...SEALED, agree: 4, dissent: 3 }]) {
    await rejects(open(A, B, { ruling: bad }), /bad_ruling/);
  }
  const made = await open(A, B, { twist: '', ruling: { ...SEALED, extra: 'dropped' } });
  assert.equal(made.ok, true);
  const row = await one('select twist, first_ruling, status, extract(epoch from expires_at - created_at)::int as life from public.hearings where id = $1', [made.id]);
  assert.equal(row.twist, null, 'an empty twist is the original');
  assert.deepEqual(row.first_ruling, SEALED, 'only the six known fields are stored');
  assert.equal(row.status, 'open');
  assert.equal(row.life, 14 * 86400, 'fourteen days to answer');
  await clearPair(A, B);
});

test('reactions are cleaned, not refused: forty at most, each rebuilt', async () => {
  const marks = [...MARKS, { at: 'BAD KEY', r: 'laugh', ms: 1 }, { at: 'x', r: 'boo', ms: 1 }, { at: 'x', r: 'gasp', ms: 20001 },
    { at: 'x', r: 'gasp', ms: -1 }, { at: 'x', r: 'gasp', ms: '5' }, 'laugh', { at: 'x', r: 'gasp', ms: 5, extra: 'gone' },
    ...Array.from({ length: 45 }, (_, i) => ({ at: 'rule:' + i, r: 'gasp', ms: i }))];
  const made = await open(A, B, { marks });
  const kept = await value('select first_marks from public.hearings where id = $1', [made.id]);
  assert.equal(kept.length, 40);
  assert.deepEqual(kept.slice(0, 3), [...MARKS, { at: 'x', r: 'gasp', ms: 5 }]);
  const none = await open(A, B, { marks: { not: 'a list' } });
  assert.deepEqual(await value('select first_marks from public.hearings where id = $1', [none.id]), []);
  await clearPair(A, B);
});

test('the sealed ruling never reaches the second judge before they rule, through any call', async () => {
  const made = await open(A, B, { twist: 'keith-was-invited', seed: 77 });
  const leaks = (label, out) => {
    const text = JSON.stringify(out);
    assert.ok(!/"truth"|"agree"|"dissent"|"ratings"|"stars"|defendant/.test(text), label + ' leaks the sealed ruling: ' + text);
  };
  // The list.
  const box = await list(B);
  assert.equal(box.hearings.length, 1);
  const item = box.hearings[0];
  assert.deepEqual([item.role, item.status, item.case_id, item.twist, item.seed, item.other_name, item.mine, item.theirs, item.alone, item.cast],
    ['second', 'open', 'borrowed-coffin', 'keith-was-invited', 77, 'Ada', null, null, false, undefined]);
  leaks('hearings()', box);
  // The hearing itself: everything needed to hear the identical episode, and the gallery.
  const full = await call(B, 'public.get_hearing($1)', [made.id]);
  assert.deepEqual(full.cast, CAST);
  assert.deepEqual(full.their_marks, MARKS, 'the first judge’s reactions play as the gallery');
  assert.deepEqual([full.mine, full.theirs, full.my_marks], [null, null, []]);
  leaks('get_hearing()', full);
  // The reveal is refused, the record shows nothing, and declining is allowed later.
  await rejects(call(B, 'public.reveal_hearing($1)', [made.id]), /sealed/);
  await rejects(call(A, 'public.reveal_hearing($1)', [made.id]), /sealed/, 'not even the first judge reads a reveal early');
  const record = await call(B, 'public.bench_record($1)', [A]);
  assert.deepEqual([record.hearings, record.recent], [0, []]);
  leaks('bench_record()', record);
  // A wrong ruling attempt is refused without telling them anything either.
  await rejects(rule(B, made.id, { ...SEALED, ruling: 'nonsense' }), /bad_ruling/);
  leaks('hearings() again', await list(B));
  // The first judge sees their own ruling all along.
  const mine = (await list(A)).hearings[0];
  assert.deepEqual([mine.role, mine.mine, mine.theirs], ['first', SEALED, null]);
  // Strangers and outsiders get nothing.
  await rejects(call(C, 'public.get_hearing($1)', [made.id]), /not_found/);
  await rejects(call(D, 'public.get_hearing($1)', [made.id]), /not_found/);
  assert.deepEqual((await list(D)).hearings, []);
  await clearPair(A, B);
});

test('ruling reveals both, once, and only for the second judge', async () => {
  const made = await open(A, B);
  await rejects(rule(A, made.id, SEALED), /not_found/, 'the first judge cannot answer themselves');
  await rejects(rule(C, made.id, SEALED), /not_found/);
  const answer = { ruling: 'plaintiff', truth: 'plaintiff', stars: 3, ratings: 74, agree: 6, dissent: 0 };
  const reveal = await rule(B, made.id, answer, [{ at: 'rule:plaintiff:0', r: 'gavel', ms: 10 }]);
  assert.deepEqual([reveal.status, reveal.role, reveal.mine, reveal.theirs, reveal.seen], ['revealed', 'second', answer, SEALED, true]);
  await rejects(rule(B, made.id, answer), /not_open/);
  const first = await call(A, 'public.reveal_hearing($1)', [made.id]);
  assert.deepEqual([first.mine, first.theirs, first.their_marks], [SEALED, answer, [{ at: 'rule:plaintiff:0', r: 'gavel', ms: 10 }]]);
  assert.equal((await list(A)).hearings[0].seen, true, 'reading the reveal marks it seen');
  await rejects(call(B, 'public.decline_hearing($1)', [made.id]), /not_found/, 'too late to decline');
  await clearPair(A, B);
});

test('the bench record: full benches, a divided bench, and editions that disagree on the truth', async () => {
  await db.query('delete from public.bench_records');
  const r = (ruling, truth = 'both') => ({ ruling, truth, stars: 1, ratings: 50, agree: 3, dissent: 3 });
  const play = async (from, to, first, second) => { const h = await open(from, to, { ruling: first }); await rule(to, h.id, second); };
  await play(A, B, r('both'), r('both'));                 // full bench
  await play(B, A, r('both'), r('both'));                 // full bench, the other way round
  await play(A, B, r('plaintiff'), r('both'));            // Bea right
  await play(A, B, r('plaintiff'), r('plaintiff'));       // both wrong, agreeing
  await play(A, B, r('both'), r('both', 'plaintiff'));    // editions disagree: counted, nobody right
  const ada = await call(A, 'public.bench_record($1)', [B]);
  assert.deepEqual([ada.hearings, ada.full_benches, ada.mine_right, ada.theirs_right, ada.display_name], [5, 2, 2, 3, 'Bea']);
  const bea = await call(B, 'public.bench_record($1)', [A]);
  assert.deepEqual([bea.hearings, bea.full_benches, bea.mine_right, bea.theirs_right], [5, 2, 3, 2]);
  assert.equal(ada.recent.length, 5);
  assert.ok(ada.recent.every(h => h.status === 'revealed' && h.theirs && h.mine));
  assert.deepEqual((await list(A)).records.map(x => [x.display_name, x.hearings, x.full_benches, x.mine_right, x.theirs_right]), [['Bea', 5, 2, 2, 3]]);
  await rejects(call(C, 'public.bench_record($1)', [A]), /not_friends/);
  await rejects(call(A, 'public.bench_record($1)', [A]), /not_friends/);
  await clearPair(A, B);
});

test('five open hearings per pair, either way round, and twenty a day per player', async () => {
  await clearPair(A, D);
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await open(A, D)).id);
  for (let i = 0; i < 2; i++) ids.push((await open(D, A)).id);
  await rejects(open(A, D), /too_many_open/);
  await rejects(open(D, A), /too_many_open/);
  await call(D, 'public.decline_hearing($1)', [ids[0]]);
  ids.push((await open(A, D)).id);
  await rejects(open(A, D), /too_many_open/);
  await db.query(`update public.hearings set expires_at = now() - interval '1 second' where id = $1`, [ids[1]]);
  assert.ok((await open(A, D)).id, 'an expired hearing no longer counts');
  await clearPair(A, D);
  // The daily allowance counts hearings opened, whatever became of them.
  await db.query(`delete from public.hearings where from_user = '${A}'`);
  for (let i = 0; i < 20; i++) {
    const h = await open(A, i % 2 ? D : E);
    await call(i % 2 ? D : E, 'public.decline_hearing($1)', [h.id]);
  }
  await rejects(open(A, B), /rate_limited/);
  await db.query(`update public.hearings set created_at = now() - interval '25 hours' where from_user = '${A}'`);
  assert.ok((await open(A, B)).id);
  await db.query(`delete from public.hearings where from_user = '${A}' or to_user = '${A}'`);
});

test('declining, withdrawing and expiry', async () => {
  const declined = await open(A, B);
  await rejects(call(C, 'public.decline_hearing($1)', [declined.id]), /not_found/);
  assert.deepEqual(await call(B, 'public.decline_hearing($1)', [declined.id]), { ok: true, status: 'declined' });
  await rejects(rule(B, declined.id, SEALED), /not_open/);
  const ada = (await list(A)).hearings.find(h => h.id === declined.id);
  assert.deepEqual([ada.status, ada.theirs], ['declined', null]);
  const withdrawn = await open(A, B);
  assert.deepEqual(await call(A, 'public.decline_hearing($1)', [withdrawn.id]), { ok: true, status: 'withdrawn' });
  assert.ok(!(await list(B)).hearings.some(h => h.id === withdrawn.id), 'a withdrawn hearing vanishes for the second judge');
  await rejects(call(B, 'public.get_hearing($1)', [withdrawn.id]), /not_found/);

  const lapsed = await open(A, B);
  await db.query(`update public.hearings set expires_at = now() - interval '1 minute' where id = $1`, [lapsed.id]);
  await rejects(rule(B, lapsed.id, SEALED), /not_open/);
  await rejects(call(B, 'public.decline_hearing($1)', [lapsed.id]), /not_found/);
  assert.ok(!(await list(B)).hearings.some(h => h.id === lapsed.id), 'expired hearings leave the second judge’s list');
  await rejects(call(B, 'public.reveal_hearing($1)', [lapsed.id]), /sealed/);
  const alone = await call(A, 'public.reveal_hearing($1)', [lapsed.id]);
  assert.deepEqual([alone.status, alone.alone, alone.mine, alone.theirs, alone.seen], ['expired', true, SEALED, null, true]);
  await clearPair(A, B);
});

test('friendship levels are bumped when another migration provides them', async () => {
  const before = await open(A, B);
  await rule(B, before.id, SEALED);
  await db.exec(`
    create table private.bumps (a uuid, b uuid, kind text);
    create function private.bump_friendship(a uuid, b uuid, kind text) returns void language sql
      as $$ insert into private.bumps values (a, b, kind) $$;`);
  const after = await open(A, B);
  await rule(B, after.id, SEALED);
  assert.deepEqual((await db.query('select a, b, kind from private.bumps')).rows, [{ a: A, b: B, kind: 'hearing' }], 'one bump, for the reveal');
  await db.exec('drop function private.bump_friendship(uuid, uuid, text); drop table private.bumps;');
  await clearPair(A, B);
});

test('unfriending withdraws open hearings and keeps the record; blocking tears everything up', async () => {
  await friends(C, F);
  const done = await open(C, F);
  await rule(F, done.id, SEALED);
  const waiting = await open(F, C);
  await call(C, 'public.remove_friend($1)', [F]);
  assert.equal(await value('select count(*)::int from public.hearings where id = $1', [waiting.id]), 0, 'open papers go with the friendship');
  assert.equal(await value('select count(*)::int from public.hearings where id = $1', [done.id]), 1);
  await rejects(open(C, F), /not_friends/);
  await friends(C, F);
  assert.equal((await call(C, 'public.bench_record($1)', [F])).hearings, 1, 'old rivals find the record waiting');
  const open2 = await open(C, F);
  await call(F, 'public.block_user($1)', [C]);
  assert.equal(await value(`select count(*)::int from public.hearings where '${C}' in (from_user, to_user) and '${F}' in (from_user, to_user)`), 0);
  assert.equal(await value(`select count(*)::int from public.bench_records where '${C}' in (user_a, user_b) and '${F}' in (user_a, user_b)`), 0);
  await rejects(call(F, 'public.get_hearing($1)', [open2.id]), /not_found/);
  assert.deepEqual(await list(C), { hearings: [], records: [] });
});

test('delete_my_account takes every hearing and record with it', async () => {
  const h = await open(A, E);
  await rule(E, h.id, SEALED);
  await open(E, A);
  const count = () => value(`select (select count(*) from public.hearings where '${E}' in (from_user, to_user))
    + (select count(*) from public.bench_records where '${E}' in (user_a, user_b))`);
  assert.ok(Number(await count()) >= 3);
  await call(E, 'public.delete_my_account()');
  assert.equal(Number(await count()), 0);
});
