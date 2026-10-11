// The co-op migration (hired help and duels) against a real Postgres
// (PGlite), on top of 0001 and 0002 only, with the same Supabase-shaped
// bootstrap as social_sql.test.mjs. Every rule and refusal is checked here and
// mirrored by test/support/fake-coop.mjs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), COOP = read('0009_coop.sql');
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
const TABLES = ['coop_duels', 'coop_hires', 'coop_listings', 'coop_records', 'coop_rounds'];
const FUNCTIONS = ['coop_collect', 'coop_duel_claim', 'coop_duel_create', 'coop_duel_decline', 'coop_duel_play', 'coop_duel_rematch',
  'coop_duel_submit', 'coop_duels', 'coop_finish_hire', 'coop_hire', 'coop_hire_board', 'coop_records', 'coop_reports', 'coop_set_hires'];

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(COOP); }
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
  for (const [x, y] of [[A, B], [A, C], [A, D], [A, E], [B, C]]) await friends(x, y);
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
  await call(y, 'public.add_friend($1)', [code[x]]);
}
const resident = (id, name = 'Mabel', extra = {}) => ({ id, name, traits: ['damp'], stats: { cute: 4, menace: 8, damp: 7, mystique: 2 },
  art: { creature: { v: 1, seed: 'abc', body: 'blob', palette: 'moss', parts: {}, tune: {} } }, ...extra });
const report = (extra = {}) => ({ route: 'drawer', gear: 'thread', edition: 2, rev: 2, score: 7, tier: 2, returned: 0, built: false,
  choices: [1, 2, 0], helped: [0], crew: ['Agnes'], ...extra });
const json = value => JSON.stringify(value);
// Moves a row's clock back, as the project owner would see time pass.
const age = (table, where, column, hours) => db.query(`update public.${table} set ${column} = ${column} - interval '${hours} hours' where ${where}`);

test('the migration is idempotent on top of 0001 and 0002, and every new table is locked down', async () => {
  const rls = (await db.query(`select c.relname, c.relrowsecurity from pg_class c where c.relkind = 'r'
    and c.relnamespace in ('public'::regnamespace, 'private'::regnamespace) and c.relname like 'coop_%' order by c.relname`)).rows;
  assert.deepEqual(rls.map(r => r.relname), ['coop_attempts', ...TABLES]);
  assert.ok(rls.every(r => r.relrowsecurity), 'row level security on every table');
  const policies = (await db.query("select tablename, count(*)::int as n from pg_policies where schemaname = 'public' and tablename like 'coop_%' group by tablename order by tablename")).rows;
  assert.deepEqual(policies, TABLES.map(tablename => ({ tablename, n: 1 })), 'one policy each after two runs');
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'coop_%' order by p.proname")).rows;
  assert.deepEqual(functions.map(f => f.proname), FUNCTIONS, 'each function exists once');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
  for (const table of TABLES) for (const role of ['anon', 'authenticated']) for (const privilege of ['select', 'insert', 'update', 'delete']) {
    assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
  }
});

test('the anon role cannot call any co-op function, and helpers and tables stay private', async () => {
  await as('', async () => {
    for (const sql of ['public.coop_hire_board()', 'public.coop_duels()', 'public.coop_reports()', 'public.coop_records()',
      `public.coop_duel_create('${A}', 'stack', 0)`, "public.coop_set_hires('[]'::jsonb)"]) {
      await rejects(db.query('select ' + sql), /permission denied/);
    }
  }, 'anon');
  await as(A, async () => {
    await rejects(db.query('select private.coop_day()'), /permission denied/);
    await rejects(db.query('select * from public.coop_rounds'), /permission denied/);
    await rejects(db.query(`insert into public.coop_listings (owner, pet_id, resident) values ('${A}', 'x', '{}')`), /permission denied/);
    await rejects(db.query('update public.coop_duels set pay_challenger = 50'), /permission denied/);
  });
  await as('', () => rejects(db.query('select public.coop_duels()'), /sign in first|28000/));
});

test('listings: two residents at most, checked and rebuilt, and rate limited', async () => {
  await rejects(call(A, 'public.coop_set_hires($1)', [json({})]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1'), resident('a2'), resident('a3')])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1'), resident('a1')])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('bad id!')])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1', 'M', { stats: { cute: 11, menace: 1, damp: 1, mystique: 1 } })])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1', 'M', { stats: { cute: 1.5, menace: 1, damp: 1, mystique: 1 } })])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1', 'M', { traits: ['<b>'] })])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1', 'M', { art: 'nope' })])]), /bad_resident/);
  await rejects(call(A, 'public.coop_set_hires($1)', [json([resident('a1', 'M', { art: { body: 'x'.repeat(150000) } })])]), /too_large/);
  const listed = await call(A, 'public.coop_set_hires($1)', [json([resident('a1', '  Mabel\u0007  ', { extra: 'dropped' }), resident('a2', 'Pip')])]);
  assert.deepEqual(listed, { ok: true, listed: ['a1', 'a2'] });
  const row = await one(`select resident from public.coop_listings where owner = '${A}' and pet_id = 'a1'`);
  assert.equal(row.resident.name, 'Mabel', 'control characters out, trimmed');
  assert.equal(row.resident.extra, undefined, 'unknown fields are dropped');
  assert.deepEqual(row.resident.stats, { cute: 4, menace: 8, damp: 7, mystique: 2 });
  // Thirty changes an hour, failed ones aside.
  const before = await value(`select count(*)::int from private.coop_attempts where user_id = '${F}' and kind = 'list'`);
  assert.equal(before, 0);
  for (let i = 0; i < 30; i++) await call(F, 'public.coop_set_hires($1)', [json([])]);
  await rejects(call(F, 'public.coop_set_hires($1)', [json([])]), /rate_limited/);
});

test('the hire board shows friends only, hides blocked players either way, and respects Do not disturb when it exists', async () => {
  await call(B, 'public.coop_set_hires($1)', [json([resident('b1', 'Gladys')])]);
  const board = await call(C, 'public.coop_hire_board()');
  assert.equal(board.hired_today, false);
  assert.deepEqual(board.listings.map(l => [l.owner_name, l.pet_id, l.trips_today, l.available]),
    [['Ada', 'a1', 0, true], ['Ada', 'a2', 0, true], ['Bea', 'b1', 0, true]]);
  assert.equal(board.listings[0].resident.stats.menace, 8);
  assert.deepEqual((await call(E, 'public.coop_hire_board()')).listings.map(l => l.owner_name), ['Ada', 'Ada'], 'Eve is friends with Ada only');
  assert.deepEqual((await call(F, 'public.coop_hire_board()')).listings, [], 'strangers see nothing');
  await rejects(call(F, 'public.coop_hire($1, $2)', [A, 'a1']), /not_friends/);
  // Do not disturb arrives with the postbox migration; until then it is never on.
  await db.exec('create table public.social_prefs (user_id uuid primary key, dnd boolean not null default false)');
  await db.query(`insert into public.social_prefs values ('${B}', true)`);
  const quiet = await call(C, 'public.coop_hire_board()');
  assert.equal(quiet.listings.find(l => l.pet_id === 'b1').available, false);
  await rejects(call(C, 'public.coop_hire($1, $2)', [B, 'b1']), /dnd/);
  await db.exec('drop table public.social_prefs');
  // Blocking either way takes the listings off the board and refuses the hire.
  await call(B, 'public.block_user($1)', [C]);
  assert.deepEqual((await call(C, 'public.coop_hire_board()')).listings.map(l => l.owner_name), ['Ada', 'Ada']);
  await rejects(call(C, 'public.coop_hire($1, $2)', [B, 'b1']), /not_friends/);
  await db.query(`delete from public.blocks where blocker = '${B}' and blocked = '${C}'`);
  await friends(B, C);
});

test('hires: one a day per hirer, three trips a day per resident, and the resident travels as a snapshot', async () => {
  await rejects(call(B, 'public.coop_hire($1, $2)', [A, 'nobody']), /not_for_hire/);
  const hire = await call(B, 'public.coop_hire($1, $2)', [A, 'a1']);
  assert.equal(hire.ok, true);
  assert.equal(hire.owner_name, 'Ada');
  assert.equal(hire.resident.name, 'Mabel');
  await rejects(call(B, 'public.coop_hire($1, $2)', [A, 'a2']), /hired_today/);
  assert.equal((await call(B, 'public.coop_hire_board()')).hired_today, true);
  await call(C, 'public.coop_hire($1, $2)', [A, 'a1']);
  await call(D, 'public.coop_hire($1, $2)', [A, 'a1']);
  const board = await call(E, 'public.coop_hire_board()');
  assert.deepEqual(board.listings.map(l => [l.pet_id, l.trips_today, l.available]), [['a1', 3, false], ['a2', 0, true]]);
  await rejects(call(E, 'public.coop_hire($1, $2)', [A, 'a1']), /fully_booked/);
  // Relisting changes later hires, never the one already out.
  await call(A, 'public.coop_set_hires($1)', [json([resident('a1', 'Mabel the Second'), resident('a2', 'Pip')])]);
  const out = await one(`select resident from public.coop_hires where id = '${hire.id}'`);
  assert.equal(out.resident.name, 'Mabel');
  const reports = await call(A, 'public.coop_reports()');
  assert.deepEqual(reports.listed.map(l => [l.pet_id, l.trips_today]), [['a1', 3], ['a2', 0]]);
  assert.deepEqual(reports.away.map(a => [a.name, a.hirer_name]).sort(), [['Mabel', 'Bea'], ['Mabel', 'Cat'], ['Mabel', 'Dan']]);
  assert.deepEqual(reports.reports, []);
});

test('a finished trip pays the lender wages the server decides, capped at 30 a day, collected once', async () => {
  const hires = (await db.query(`select id, hirer from public.coop_hires where owner = '${A}' order by created_at`)).rows;
  const byHirer = Object.fromEntries(hires.map(h => [h.hirer, h.id]));
  for (const bad of [report({ route: 'attic' }), report({ choices: [] }), report({ choices: [3] }), report({ score: 13 }), report({ tier: '2' }),
    report({ built: 'yes' }), report({ crew: ['a', 'b', 'c'] }), report({ helped: [5] }), report({ gear: 'axe' }), report({ edition: 8 })]) {
    await rejects(call(B, 'public.coop_finish_hire($1, $2)', [byHirer[B], json(bad)]), /bad_report/);
  }
  await rejects(call(C, 'public.coop_finish_hire($1, $2)', [byHirer[B], json(report())]), /not_found/);
  assert.deepEqual(await call(B, 'public.coop_finish_hire($1, $2)', [byHirer[B], json(report({ crew: ['Gladys\u0007', 'Snag'] }))]), { ok: true, wages: 12 });
  await rejects(call(B, 'public.coop_finish_hire($1, $2)', [byHirer[B], json(report())]), /not_open/);
  assert.deepEqual(await call(C, 'public.coop_finish_hire($1, $2)', [byHirer[C], json(report({ tier: 1 }))]), { ok: true, wages: 9 });
  assert.deepEqual(await call(D, 'public.coop_finish_hire($1, $2)', [byHirer[D], json(report())]), { ok: true, wages: 9 }, 'the last 9 of 30');
  const reports = await call(A, 'public.coop_reports()');
  assert.equal(reports.away.length, 0);
  assert.deepEqual(reports.reports.map(r => [r.hirer_name, r.name, r.wages]).sort(), [['Bea', 'Mabel', 12], ['Cat', 'Mabel', 9], ['Dan', 'Mabel', 9]]);
  const fromBea = reports.reports.find(r => r.hirer === B);
  assert.deepEqual(fromBea.report, { v: 1, route: 'drawer', gear: 'thread', edition: 2, rev: 2, score: 7, tier: 2, returned: 0, built: false,
    choices: [1, 2, 0], helped: [0], crew: ['Gladys', 'Snag'] });
  await rejects(call(B, 'public.coop_collect($1)', [fromBea.id]), /not_found/);
  assert.deepEqual(await call(A, 'public.coop_collect($1)', [fromBea.id]), { ok: true, wages: 12 });
  assert.deepEqual(await call(A, 'public.coop_collect($1)', [fromBea.id]), { ok: true, wages: 0 }, 'never paid twice');
  assert.equal((await call(A, 'public.coop_reports()')).reports.length, 2);
  const records = await call(A, 'public.coop_records()');
  assert.deepEqual(records.filter(r => r.trips).map(r => r.trips), [1, 1, 1]);
  assert.equal((await call(B, 'public.coop_records()')).find(r => r.friend === A).trips, 1, 'both sides count the trip');
  // A blocked hirer's name and crew stay out of the lender's postbox; the wages still pay.
  await call(A, 'public.block_user($1)', [D]);
  const dan = (await call(A, 'public.coop_reports()')).reports.find(r => r.hirer === D);
  assert.equal(dan.hirer_name, '');
  assert.equal(dan.report.crew, undefined);
  assert.deepEqual(await call(A, 'public.coop_collect($1)', [dan.id]), { ok: true, wages: 9 });
  await db.query(`delete from public.blocks where blocker = '${A}' and blocked = '${D}'`);
  await friends(A, D);
});

test('a hire nobody finishes comes home after 72 hours with the smallest wage, and old hires are cleared', async () => {
  const hire = await call(E, 'public.coop_hire($1, $2)', [A, 'a2']);
  await db.query(`update public.coop_hires set day = day - 4, created_at = created_at - interval '73 hours' where id = '${hire.id}'`);
  await db.query(`update public.coop_hires set wage_day = wage_day - 4 where owner = '${A}' and id <> '${hire.id}'`);
  const reports = await call(A, 'public.coop_reports()');
  const back = reports.reports.find(r => r.id === hire.id);
  assert.equal(back.report, null);
  assert.equal(back.wages, 6);
  await rejects(call(E, 'public.coop_finish_hire($1, $2)', [hire.id, json(report())]), /not_open/);
  await age('coop_hires', `id = '${hire.id}'`, 'created_at', 61 * 24);
  await call(A, 'public.coop_reports()');
  assert.equal(await value(`select count(*)::int from public.coop_hires where id = '${hire.id}'`), 0);
});

// ---------------------------------------------------------------------------
// Duels
// ---------------------------------------------------------------------------

const create = (who, to, game = 'stack', stake = 10) => call(who, 'public.coop_duel_create($1, $2, $3)', [to, game, stake]);
const play = (who, id) => call(who, 'public.coop_duel_play($1)', [id]);
const submit = (who, id, n, score, log = null) => call(who, 'public.coop_duel_submit($1, $2, $3, $4)', [id, n, score, log && json(log)]);
const duel = async (who, id) => (await call(who, 'public.coop_duels()')).find(d => d.id === id);
const ghost = (extra = {}) => ({ v: 1, game: 'stack', ticks: 600, inputs: [30, 1, 45, 1], timeline: [0, 1, 2], score: 7, ...extra });

test('a challenge: server seeds, sealed first score, a ghost for the second player and a joint reveal', async () => {
  await rejects(create(A, F), /not_friends/);
  await rejects(create(A, B, 'pinball'), /bad_game/);
  await rejects(create(A, B, 'stack', 26), /bad_stake/);
  await rejects(create(A, B, 'stack', -1), /bad_stake/);
  const made = await create(A, B);
  assert.equal(made.round, 1);
  assert.ok(Number.isInteger(made.seed) && made.seed >= 1 && made.seed <= 2147483647);
  const stored = await one(`select seed, first_player from public.coop_rounds where duel_id = '${made.id}' and n = 1`);
  assert.equal(Number(stored.seed), made.seed, 'the seed is the server’s and is kept');
  assert.equal(stored.first_player, A);
  // The opponent has nothing to play until the challenger has filed a score.
  await rejects(play(B, made.id), /not_your_turn/);
  await rejects(submit(B, made.id, 1, 5), /not_your_turn/);
  const again = await play(A, made.id);
  assert.deepEqual([again.role, again.seed, again.ghost], ['first', made.seed, null]);
  await rejects(submit(A, made.id, 1, 501), /bad_score/, 'above the 0002 cap for Stack');
  await rejects(submit(A, made.id, 1, 7, { game: 'whack', inputs: [] }), /bad_log/);
  await rejects(submit(A, made.id, 1, 7, ghost({ inputs: 'nope' })), /bad_log/);
  await rejects(submit(A, made.id, 1, 7, ghost({ inputs: Array(9000).fill(12345) })), /bad_log/);
  assert.deepEqual(await submit(A, made.id, 1, 7, ghost()), { ok: true, round: 1, status: 'second' });
  await rejects(submit(A, made.id, 1, 9), /not_your_turn/, 'one score per round');
  const sealed = await duel(B, made.id);
  assert.equal(sealed.rounds[0].first_score, null, 'sealed until both have played');
  assert.equal((await duel(A, made.id)).rounds[0].first_score, 7, 'the challenger sees their own');
  assert.equal(sealed.opponent_staked, false);
  await rejects(submit(B, made.id, 1, 9), /not_your_turn/, 'the second player must start their run first');
  const turn = await play(B, made.id);
  assert.deepEqual([turn.role, turn.seed, turn.against, turn.ghost], ['second', made.seed, 'Ada', ghost()]);
  assert.equal(turn.first_score, undefined);
  assert.equal((await duel(B, made.id)).opponent_staked, true, 'playing round one puts up the stake');
  await rejects(call(B, 'public.coop_duel_decline($1)', [made.id]), /not_your_turn/, 'a started run cannot be declined');
  const reveal = await submit(B, made.id, 1, 9);
  assert.deepEqual(reveal, { ok: true, round: 1, status: 'done', first_score: 7, second_score: 9, wins_challenger: 0, wins_opponent: 1, settled: false, outcome: null });
  assert.deepEqual((await duel(A, made.id)).rounds[0], { ...(await duel(A, made.id)).rounds[0], first_score: 7, second_score: 9, status: 'done' });
  // Rematches: whoever asks plays first, up to three rounds, first to two.
  await rejects(call(C, 'public.coop_duel_rematch($1)', [made.id]), /not_found/);
  const second = await call(A, 'public.coop_duel_rematch($1)', [made.id]);
  assert.equal(second.round, 2);
  assert.notEqual(second.seed, made.seed);
  await rejects(call(B, 'public.coop_duel_rematch($1)', [made.id]), /not_open/, 'one round at a time');
  await submit(A, made.id, 2, 12, ghost());
  await play(B, made.id);
  const two = await submit(B, made.id, 2, 4);
  assert.deepEqual([two.wins_challenger, two.wins_opponent, two.settled], [1, 1, false]);
  const third = await call(B, 'public.coop_duel_rematch($1)', [made.id]);
  assert.equal(third.round, 3);
  assert.equal((await play(B, made.id)).role, 'first');
  await submit(B, made.id, 3, 20, ghost());
  await play(A, made.id);
  const last = await submit(A, made.id, 3, 15);
  assert.deepEqual([last.wins_challenger, last.wins_opponent, last.settled, last.outcome], [1, 2, true, 'opponent']);
  await rejects(call(A, 'public.coop_duel_rematch($1)', [made.id]), /not_open/);
  // The winner collects both stakes, once; the loser collects nothing.
  const won = await duel(B, made.id);
  assert.deepEqual([won.status, won.payout, won.claimed], ['settled', 20, false]);
  assert.deepEqual(await call(B, 'public.coop_duel_claim($1)', [made.id]), { ok: true, souls: 20 });
  assert.deepEqual(await call(B, 'public.coop_duel_claim($1)', [made.id]), { ok: true, souls: 0 });
  assert.deepEqual(await call(A, 'public.coop_duel_claim($1)', [made.id]), { ok: true, souls: 0 });
  assert.equal(await duel(B, made.id), undefined, 'a collected series leaves the list');
  const records = (await call(B, 'public.coop_records()')).find(r => r.friend === A);
  assert.deepEqual([records.duels_won, records.duels_lost, records.rounds_won, records.rounds_lost, records.best_streak, records.streak], [1, 0, 2, 1, 1, 1]);
  const ada = (await call(A, 'public.coop_records()')).find(r => r.friend === B);
  assert.deepEqual([ada.duels_won, ada.duels_lost, ada.rounds_won, ada.rounds_lost, ada.best_streak, ada.streak], [0, 1, 1, 2, 1, 0]);
});

test('an unplayed challenge expires after 48 hours and the challenger wins the stake back', async () => {
  const made = await create(A, C, 'whack', 25);
  await submit(A, made.id, 1, 40, ghost({ game: 'whack' }));
  await age('coop_rounds', `duel_id = '${made.id}'`, 'first_at', 49);
  const gone = await duel(A, made.id);
  assert.deepEqual([gone.status, gone.outcome, gone.payout], ['settled', 'void', 25]);
  assert.equal((await duel(C, made.id)).payout, 0, 'the opponent never staked');
  await rejects(play(C, made.id), /not_open/);
  assert.deepEqual(await call(A, 'public.coop_duel_claim($1)', [made.id]), { ok: true, souls: 25 });
  // A challenge the challenger never played lapses the same way.
  const unplayed = await create(A, C, 'seance', 5);
  await age('coop_rounds', `duel_id = '${unplayed.id}'`, 'created_at', 49);
  assert.deepEqual([(await duel(A, unplayed.id)).outcome, (await duel(A, unplayed.id)).payout], ['void', 5]);
});

test('a started and abandoned round counts as 0; ties return both stakes; a decline closes the series', async () => {
  const made = await create(A, C, 'frenzy', 10);
  await submit(A, made.id, 1, 30, ghost({ game: 'frenzy' }));
  await play(C, made.id);
  await age('coop_rounds', `duel_id = '${made.id}'`, 'first_at', 49);
  const forfeit = await duel(C, made.id);
  assert.deepEqual([forfeit.rounds[0].second_score, forfeit.wins_challenger, forfeit.status], [0, 1, 'open'], 'the round is lost, the series waits for a rematch');
  await age('coop_rounds', `duel_id = '${made.id}'`, 'second_at', 49);
  const closed = await duel(A, made.id);
  assert.deepEqual([closed.status, closed.outcome, closed.payout], ['settled', 'challenger', 20], 'no rematch for 48 hours settles on the rounds won');

  const tie = await create(A, C, 'stack', 5);
  await submit(A, tie.id, 1, 11, ghost());
  await play(C, tie.id);
  const level = await submit(C, tie.id, 1, 11);
  assert.deepEqual([level.wins_challenger, level.wins_opponent], [0, 0]);
  await call(C, 'public.coop_duel_rematch($1)', [tie.id]);
  await call(C, 'public.coop_duel_decline($1)', [tie.id]);
  const tied = await duel(A, tie.id);
  assert.deepEqual([tied.status, tied.outcome, tied.payout, (await duel(C, tie.id)).payout], ['settled', 'tie', 5, 5]);

  const declined = await create(A, C, 'stack', 15);
  await submit(A, declined.id, 1, 3, ghost());
  await call(C, 'public.coop_duel_decline($1)', [declined.id]);
  const back = await duel(A, declined.id);
  assert.deepEqual([back.outcome, back.payout], ['void', 15]);
});

test('duel limits: Do not disturb, three open per friend, ten new a day, and a block voids the series', async () => {
  await db.exec('create table public.social_prefs (user_id uuid primary key, dnd boolean not null default false)');
  await db.query(`insert into public.social_prefs values ('${D}', true)`);
  await rejects(create(A, D), /dnd/);
  await db.exec('drop table public.social_prefs');
  const open = [];
  for (let i = 0; i < 3; i++) open.push(await create(A, D, 'stack', 0));
  await rejects(create(A, D), /too_many_open/);
  await submit(A, open[0].id, 1, 8, ghost());
  await play(D, open[0].id);
  // Blocking ends every open series between them, and returns the stakes held.
  const staked = await create(A, E, 'stack', 20);
  await submit(A, staked.id, 1, 8, ghost());
  await play(E, staked.id);
  await call(E, 'public.block_user($1)', [A]);
  const voided = await duel(A, staked.id);
  assert.deepEqual([voided.outcome, voided.payout], ['void', 20]);
  assert.deepEqual([(await duel(E, staked.id)).outcome, (await duel(E, staked.id)).payout], ['void', 20]);
  assert.equal((await duel(E, staked.id)).challenger_name, '', 'the blocked player’s name stays out of it');
  await rejects(create(A, E), /not_friends/);
  // Ten new challenges a day, whoever they go to.
  const made = await value(`select count(*)::int from private.coop_attempts where user_id = '${A}' and kind = 'duel'`);
  await db.query(`insert into private.coop_attempts (user_id, kind) select '${A}', 'duel' from generate_series(1, ${10 - made})`);
  await rejects(create(A, C, 'stack', 0), /rate_limited/);
});

test('friendship points are bumped only when the postbox migration provides them', async () => {
  await db.exec(`create table private.bumps (a uuid, b uuid, kind text);
    create function private.bump_friendship(a uuid, b uuid, p_kind text) returns int language sql security definer set search_path = public
      as $$ insert into private.bumps values (a, b, p_kind) returning 1 $$;`);
  await call(B, 'public.coop_set_hires($1)', [json([resident('b2', 'Wanda')])]);
  await db.query(`delete from public.coop_hires where hirer = '${C}'`);
  const hire = await call(C, 'public.coop_hire($1, $2)', [B, 'b2']);
  await call(C, 'public.coop_finish_hire($1, $2)', [hire.id, json(report())]);
  const made = await create(B, C, 'seance', 0);
  await submit(B, made.id, 1, 9, ghost({ game: 'seance' }));
  assert.deepEqual((await db.query('select kind from private.bumps order by kind')).rows.map(r => r.kind), ['duel', 'hire']);
  await db.exec('drop function private.bump_friendship(uuid, uuid, text); drop table private.bumps;');
});
