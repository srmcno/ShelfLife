// The social migration against a real Postgres (PGlite), on top of 0001 and
// the same Supabase-shaped bootstrap as cloud_sql.test.mjs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const ACCOUNTS = readFileSync(new URL('../supabase/migrations/0001_accounts_and_saves.sql', import.meta.url), 'utf8');
const SOCIAL = readFileSync(new URL('../supabase/migrations/0002_social.sql', import.meta.url), 'utf8');
const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map(x => '00000000-0000-4000-8000-00000000000' + x);
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
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}');
`;
const TABLES = ['blocks', 'friendships', 'reports', 'scores', 'shelves', 'summons'];
const FUNCTIONS = ['add_friend', 'block_user', 'day_percentile', 'decline_summons', 'friends_board', 'get_shelf', 'inbox', 'list_friends',
  'mark_summons_seen', 'publish_shelf', 'remove_friend', 'report_user', 'respond_friend', 'rule_summons', 'send_summons', 'submit_score'];

let db, today;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); }
  today = (await db.query('select current_date::text as d')).rows[0].d;
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve']]) {
    code[id] = (await as(id, () => value("select public.ensure_profile($1)", [name]))).friend_code;
  }
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
const shelf = names => JSON.stringify({ v: 1, name: '', rank: 0, curios: 0, residents: names.map((name, i) => ({ id: 'p' + i, name, traits: [], mood: 'fine', bond: 0, art: { body: '', stamps: [] } })) });
async function friends(x, y) {
  await call(x, 'public.add_friend($1)', [code[y]]);
  const back = await call(y, 'public.add_friend($1)', [code[x]]);
  assert.equal(back.status, 'accepted');
}

test('the migration is idempotent and every new table is locked down', async () => {
  const rls = (await db.query(`select c.relname, c.relrowsecurity from pg_class c where c.relkind = 'r'
    and (c.relnamespace = 'public'::regnamespace or c.relnamespace = 'private'::regnamespace) order by c.relname`)).rows;
  assert.ok(rls.every(r => r.relrowsecurity), 'row level security on every table: ' + JSON.stringify(rls));
  assert.deepEqual(rls.map(r => r.relname).filter(n => TABLES.includes(n)), TABLES);
  const policies = (await db.query("select tablename, count(*)::int as n from pg_policies where schemaname = 'public' group by tablename order by tablename")).rows;
  assert.deepEqual(policies, [['blocks', 1], ['friendships', 1], ['profiles', 1], ['saves', 1], ['scores', 1], ['shelves', 1], ['summons', 1]].map(([tablename, n]) => ({ tablename, n })),
    'one policy each after two runs; reports has none, so nobody can read it');
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace order by p.proname")).rows;
  const names = functions.map(f => f.proname);
  for (const name of FUNCTIONS) assert.equal(names.filter(n => n === name).length, 1, name + ' exists once');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
  for (const table of TABLES) {
    for (const privilege of ['insert', 'update', 'delete']) {
      assert.equal(await value('select has_table_privilege($1, $2, $3)', ['authenticated', 'public.' + table, privilege]), false, privilege + ' ' + table);
    }
    assert.equal(await value('select has_table_privilege($1, $2, $3)', ['anon', 'public.' + table, 'select']), false, 'anon select ' + table);
  }
  assert.equal(await value('select has_table_privilege($1, $2, $3)', ['authenticated', 'public.reports', 'select']), false);
});

test('the anon role cannot call any social function, and helpers stay private', async () => {
  await as('', async () => {
    for (const sql of ["public.add_friend('ABCDEFGH')", 'public.list_friends()', 'public.inbox()', `public.get_shelf('${A}')`,
      "public.submit_score('stack', '2026-1-1', 1, '')", "public.day_percentile('stack', '2026-1-1')", `public.publish_shelf('{}'::jsonb)`]) {
      await rejects(db.query('select ' + sql), /permission denied/);
    }
  }, 'anon');
  await as(A, async () => {
    await rejects(db.query(`select private.are_friends('${A}', '${B}')`), /permission denied/);
    await rejects(db.query(`insert into public.shelves (user_id, snapshot) values ('${A}', '{}')`), /permission denied/);
    await rejects(db.query(`insert into public.friendships (requester, addressee, status) values ('${A}', '${B}', 'accepted')`), /permission denied/);
    await rejects(db.query(`update public.scores set score = 499`), /permission denied/);
  });
  await as('', () => rejects(db.query('select public.list_friends()'), /sign in first|28000/));
});

test('friendships: one row per pair, no self, no duplicates, accepted by asking back', async () => {
  assert.deepEqual(await call(A, 'public.add_friend($1)', [code[A]]), { ok: false, error: 'self' });
  assert.deepEqual(await call(A, 'public.add_friend($1)', ['ZZZZZZZZ']), { ok: false, error: 'not_found' });
  const asked = await call(A, 'public.add_friend($1)', [code[B].toLowerCase().slice(0, 4) + ' ' + code[B].slice(4)]);
  assert.deepEqual(asked, { ok: true, status: 'pending', user_id: B, friend_code: code[B], display_name: '' }, 'no name before they accept');
  assert.deepEqual(await call(A, 'public.add_friend($1)', [code[B]]), { ok: false, error: 'already_asked' });
  const outgoing = await call(A, 'public.list_friends()');
  assert.deepEqual(outgoing.map(f => [f.user_id, f.display_name, f.status, f.direction]), [[B, '', 'pending', 'outgoing']]);
  const incoming = await call(B, 'public.list_friends()');
  assert.deepEqual(incoming.map(f => [f.user_id, f.display_name, f.status, f.direction]), [[A, 'Ada', 'pending', 'incoming']]);
  const accepted = await call(B, 'public.add_friend($1)', [code[A]]);
  assert.deepEqual([accepted.status, accepted.display_name], ['accepted', 'Ada']);
  assert.deepEqual(await call(A, 'public.add_friend($1)', [code[B]]), { ok: false, error: 'already_friends' });
  assert.equal(await value(`select count(*)::int from public.friendships where least(requester, addressee) = '${A}' and greatest(requester, addressee) = '${B}'`), 1);
  // Even a direct write cannot make a second row the other way round.
  await rejects(db.query(`insert into public.friendships (requester, addressee) values ('${B}', '${A}')`), /duplicate key|friendships_pair/);
  await rejects(db.query(`insert into public.friendships (requester, addressee) values ('${C}', '${C}')`), /friendships_not_self|check constraint/);
  const list = await call(A, 'public.list_friends()');
  assert.deepEqual(list.map(f => [f.display_name, f.status]), [['Bea', 'accepted']]);
  // respond_friend works only for the player asked.
  await call(C, 'public.add_friend($1)', [code[A]]);
  await rejects(call(C, 'public.respond_friend($1, true)', [A]), /not_found/);
  assert.deepEqual(await call(A, 'public.respond_friend($1, false)', [C]), { ok: true, status: 'declined' });
  assert.deepEqual(await call(C, 'public.list_friends()'), []);
});

test('blocks: the blocked player cannot find you, and the blocker is told why', async () => {
  await friends(C, D);
  await call(D, `public.send_summons($1, 'tontine', '{"id":"p0"}'::jsonb, '{"id":"p1"}'::jsonb)`, [C]);
  assert.deepEqual(await call(C, 'public.block_user($1)', [D]), { ok: true });
  assert.deepEqual(await call(C, 'public.list_friends()'), []);
  assert.equal(await value(`select count(*)::int from public.summons where '${C}' in (from_user, to_user) and '${D}' in (from_user, to_user)`), 0, 'papers go with the friendship');
  assert.deepEqual(await call(D, 'public.add_friend($1)', [code[C]]), { ok: false, error: 'not_found' });
  assert.deepEqual(await call(C, 'public.add_friend($1)', [code[D]]), { ok: false, error: 'blocked' });
  await rejects(call(C, 'public.block_user($1)', [C]), /self/);
  assert.deepEqual(await as(C, async () => (await db.query('select blocked from public.blocks')).rows), [{ blocked: D }]);
  assert.deepEqual(await as(D, async () => (await db.query('select blocked from public.blocks')).rows), [], 'the blocked player cannot see the block');
});

test('reports are kept with what the reporter could see, and nobody can read them back', async () => {
  await call(B, 'public.publish_shelf($1::jsonb)', [shelf(['Pip'])]);
  assert.deepEqual(await call(A, 'public.report_user($1, $2)', [B, ' ' + 'x'.repeat(300) + '\n']), { ok: true });
  const r = await one(`select reason, evidence from public.reports where reporter = '${A}'`);
  assert.equal(r.reason.length, 200);
  assert.equal(r.evidence.display_name, 'Bea');
  assert.deepEqual(r.evidence.shelf.residents.map(x => x.name), ['Pip']);
  await as(A, () => rejects(db.query('select * from public.reports'), /permission denied/));
  for (let i = 0; i < 4; i++) await call(A, 'public.report_user($1, $2)', [B, 'again']);
  await rejects(call(A, 'public.report_user($1, $2)', [B, 'and again']), /rate_limited/);
});

test('add_friend allows 20 tries an hour, wrong codes included', async () => {
  const used = await value(`select count(*)::int from private.friend_attempts where user_id = '${E}'`);
  for (let i = used; i < 20; i++) assert.equal((await call(E, 'public.add_friend($1)', ['ZZZZZZZZ'])).error, 'not_found');
  assert.deepEqual(await call(E, 'public.add_friend($1)', [code[A]]), { ok: false, error: 'rate_limited' });
  await db.query(`update private.friend_attempts set at = now() - interval '2 hours' where user_id = '${E}'`);
  assert.equal((await call(E, 'public.add_friend($1)', [code[A]])).status, 'pending');
  await call(A, 'public.respond_friend($1, false)', [E]);
});

test('shelves: the owner and accepted friends only', async () => {
  await call(A, 'public.publish_shelf($1::jsonb)', [shelf(['Mabel', 'Gladys'])]);
  assert.deepEqual((await call(B, 'public.get_shelf($1)', [A])).snapshot.residents.map(r => r.name), ['Mabel', 'Gladys']);
  assert.equal((await call(B, 'public.get_shelf($1)', [A])).display_name, 'Ada');
  await rejects(call(C, 'public.get_shelf($1)', [A]), /not_friends/);
  // A pending request is not enough.
  await call(E, 'public.add_friend($1)', [code[A]]);
  await rejects(call(E, 'public.get_shelf($1)', [A]), /not_friends/);
  assert.deepEqual(await as(E, async () => (await db.query('select user_id from public.shelves')).rows), [], 'row level security agrees');
  assert.deepEqual(await as(B, async () => (await db.query('select user_id from public.shelves order by user_id')).rows), [{ user_id: A }, { user_id: B }]);
  await rejects(call(A, `public.publish_shelf('[1, 2]'::jsonb)`), /bad_shelf/);
  await rejects(call(A, 'public.publish_shelf($1::jsonb)', [shelf(Array.from({ length: 19 }, (_, i) => 'R' + i))]), /bad_shelf/);
  await rejects(call(A, 'public.publish_shelf($1::jsonb)', [JSON.stringify({ residents: [], blob: 'x'.repeat(400000) })]), /shelves_snapshot_size|23514/);
});

test('summonses: friends only, five open at a time, and only the recipient rules', async () => {
  const papers = (from, to, kase = 'borrowed-coffin', p = '{"id":"m1","name":"Mabel"}') =>
    call(from, `public.send_summons($1, $2, $3::jsonb, '{"id":"p0","name":"Pip"}'::jsonb)`, [to, kase, p]);
  await rejects(papers(C, A), /not_friends/);
  await rejects(papers(A, B, 'The Borrowed Coffin'), /bad_case/);
  await rejects(papers(A, B, 'borrowed-coffin', JSON.stringify({ id: 'm1', art: { body: 'x'.repeat(150000) } })), /too_large/);
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await papers(A, B)).id);
  await rejects(papers(A, B), /too_many_open/);
  assert.ok((await papers(B, A)).id, 'the limit is per sender');

  const box = await call(B, 'public.inbox()');
  assert.equal(box.cases.length, 5);
  assert.deepEqual([box.cases[0].from_name, box.cases[0].plaintiff.name, box.cases[0].case_id], ['Ada', 'Mabel', 'borrowed-coffin']);
  await rejects(call(C, `public.rule_summons($1, 'both', 3, 99)`, [ids[0]]), /not_found/);
  await rejects(call(A, `public.rule_summons($1, 'both', 3, 99)`, [ids[0]]), /not_found/);
  await rejects(call(B, `public.rule_summons($1, 'guilty', 3, 99)`, [ids[0]]), /bad_verdict/);
  await rejects(call(B, `public.rule_summons($1, 'both', 4, 99)`, [ids[0]]), /bad_verdict/);
  await rejects(call(B, `public.rule_summons($1, 'both', 3, 101)`, [ids[0]]), /bad_verdict/);
  assert.equal((await call(B, `public.rule_summons($1, 'defendant', 2, 74)`, [ids[0]])).status, 'ruled');
  await rejects(call(B, `public.rule_summons($1, 'both', 1, 1)`, [ids[0]]), /not_open/);
  await rejects(call(C, 'public.decline_summons($1)', [ids[1]]), /not_found/);
  assert.deepEqual(await call(B, 'public.decline_summons($1)', [ids[1]]), { ok: true });
  assert.equal((await call(B, 'public.inbox()')).cases.length, 3);
  assert.deepEqual(await as(C, async () => (await db.query('select id from public.summons')).rows), [], 'strangers cannot select them either');

  const results = (await call(A, 'public.inbox()')).results;
  assert.deepEqual(results.map(r => [r.to_name, r.verdict, r.stars, r.ratings, r.plaintiff.name, r.defendant.name]), [['Bea', 'defendant', 2, 74, 'Mabel', 'Pip']]);
  assert.equal(results[0].plaintiff.art, undefined, 'a verdict does not carry the art back');
  assert.deepEqual(await call(C, 'public.mark_summons_seen($1)', [ids[0]]), { ok: false });
  assert.deepEqual(await call(A, 'public.mark_summons_seen($1)', [ids[0]]), { ok: true });
  assert.deepEqual(await call(A, 'public.mark_summons_seen($1)', [ids[0]]), { ok: false });
  assert.deepEqual((await call(A, 'public.inbox()')).results, []);
});

test('scores: sanity caps, a two day window, and the best of the day', async () => {
  const submit = (who, score, game = 'stack', day = today) => call(who, "public.submit_score($1, $2, $3, 'slim')", [game, day, score]);
  assert.deepEqual(await submit(A, 12), { ok: true, best: 12 });
  assert.deepEqual(await submit(A, 7), { ok: true, best: 12 }, 'a worse run keeps the best');
  assert.deepEqual(await submit(A, 30), { ok: true, best: 30 });
  await rejects(submit(A, 501), /bad_score/);
  await rejects(submit(A, -1), /bad_score/);
  await rejects(submit(A, 3001, 'frenzy'), /bad_score/);
  await rejects(submit(A, 151, 'seance'), /bad_score/);
  await rejects(submit(A, 2501, 'whack'), /bad_score/);
  assert.deepEqual(await submit(A, 2500, 'whack'), { ok: true, best: 2500 });
  await rejects(submit(A, 5, 'poker'), /bad_game/);
  await rejects(submit(A, 5, 'stack', '2026-13-40'), /bad_day/);
  await rejects(submit(A, 5, 'stack', 'tomorrow'), /bad_day/);
  const far = (await db.query("select (current_date + 3)::text as d")).rows[0].d;
  await rejects(submit(A, 5, 'stack', far), /bad_day/);
  const near = (await db.query("select (current_date - 2)::text as d")).rows[0].d;
  assert.equal((await submit(A, 5, 'stack', near)).best, 5, 'a player a timezone away still counts');
  await rejects(call(A, "public.submit_score('stack', $1, 3, 'DROP TABLE')", [today]), /bad_mod/);
  assert.equal(await value(`select mod from public.scores where user_id = '${A}' and game = 'stack' and day = current_date`), 'slim');
});

test('the friends board names friends only; the percentile names nobody', async () => {
  const submit = (who, score) => call(who, "public.submit_score('seance', $1, $2, '')", [today, score]);
  await submit(A, 10); await submit(B, 20); await submit(C, 40); await submit(D, 5);
  const board = await call(A, "public.friends_board('seance', $1)", [today]);
  assert.deepEqual(board.map(r => [r.display_name, r.score, r.rank, r.me]), [['Bea', 20, 1, false], ['Ada', 10, 2, true]]);
  assert.ok(!JSON.stringify(board).includes(C) && !JSON.stringify(board).includes('Cat'), 'no stranger by id or name');
  const percentile = await call(A, "public.day_percentile('seance', $1)", [today]);
  assert.deepEqual(percentile, { players: 4, top_score: 40, beaten_percent: 33 });
  assert.deepEqual(Object.keys(percentile).sort(), ['beaten_percent', 'players', 'top_score']);
  assert.deepEqual(await call(E, "public.day_percentile('seance', $1)", [today]), { players: 4, top_score: 40, beaten_percent: null }, 'no score, no percentage');
  assert.deepEqual(await call(E, "public.friends_board('seance', $1)", [today]), [], 'a pending request does not put you on the board');
  assert.deepEqual(await as(A, async () => (await db.query("select user_id from public.scores where game = 'seance'")).rows), [{ user_id: A }]);
});

test('delete_my_account takes every social row with it', async () => {
  await call(A, "public.add_friend($1)", [code[D]]);
  await call(C, 'public.report_user($1, $2)', [A, 'rude']);
  await call(A, 'public.block_user($1)', [E]);
  const count = async () => Object.fromEntries(await Promise.all([
    ['shelves', `select count(*)::int from public.shelves where user_id = '${A}'`],
    ['friendships', `select count(*)::int from public.friendships where '${A}' in (requester, addressee)`],
    ['blocks', `select count(*)::int from public.blocks where '${A}' in (blocker, blocked)`],
    ['reports', `select count(*)::int from public.reports where '${A}' in (reporter, reported)`],
    ['summons', `select count(*)::int from public.summons where '${A}' in (from_user, to_user)`],
    ['scores', `select count(*)::int from public.scores where user_id = '${A}'`],
    ['attempts', `select count(*)::int from private.friend_attempts where user_id = '${A}'`]
  ].map(async ([k, sql]) => [k, await value(sql)])));
  const before = await count();
  for (const [table, n] of Object.entries(before)) assert.ok(n > 0, table + ' had rows to delete');
  await call(A, 'public.delete_my_account()');
  for (const [table, n] of Object.entries(await count())) assert.equal(n, 0, table);
  assert.equal(await value(`select count(*)::int from public.shelves where user_id = '${B}'`), 1, 'other players keep theirs');
  assert.ok(await value(`select count(*)::int from public.scores where user_id = '${B}'`) > 0);
});
