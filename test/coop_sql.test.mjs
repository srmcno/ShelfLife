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
const [A, B, C, D, E, F, G, H, K, L, M] = ['a', 'b', 'c', 'd', 'e', 'f', '1', '2', '3', '4', '5'].map(x => '00000000-0000-4000-8000-00000000000' + x);
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
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}'), ('${F}'), ('${G}'), ('${H}'), ('${K}'), ('${L}'), ('${M}');
`;
const TABLES = ['coop_duels', 'coop_hires', 'coop_holds', 'coop_listings', 'coop_receipts', 'coop_records', 'coop_rounds', 'coop_wallets'];
const PRIVATE_TABLES = ['coop_attempts', 'coop_wage_days'];
const FUNCTIONS = ['coop_adjust', 'coop_collect', 'coop_duel_claim', 'coop_duel_create', 'coop_duel_decline', 'coop_duel_play', 'coop_duel_rematch',
  'coop_duel_submit', 'coop_duels', 'coop_finish_hire', 'coop_hire', 'coop_hire_board', 'coop_open', 'coop_receipts', 'coop_records',
  'coop_reports', 'coop_set_hires', 'coop_wallet'];

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(COOP); }
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay'], [G, 'Gus'], [H, 'Hal'], [K, 'Kit'], [L, 'Lou'], [M, 'Mab']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
  for (const [x, y] of [[A, B], [A, C], [A, D], [A, E], [B, C]]) await friends(x, y);
  // Every player but Fay declares a co-op opening balance, so stakes can leave it.
  for (const id of [A, B, C, D, E]) await call(id, 'public.coop_open($1, $2)', [1000, 0]);
});

// A settlement with nothing owed still leaves a durable zero receipt (so the history replays
// from the ledger after the duel rows prune), and a retry answers the same one.
const zero = r => {
  assert.equal(r.ok, true);
  assert.equal(r.souls, 0);
  assert.deepEqual([r.receipt.kind, r.receipt.delta, r.receipt.earned], ['duel', 0, 0]);
  assert.ok(r.receipt.id && r.receipt.seq > 0 && r.receipt.detail && r.receipt.detail.duel_id, 'with its final detail');
  return r.receipt;
};

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
  assert.deepEqual(rls.map(r => r.relname), [...TABLES, ...PRIVATE_TABLES].sort());
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
  const paid = await call(A, 'public.coop_collect($1)', [fromBea.id]);
  assert.deepEqual([paid.wages, paid.receipt.kind, paid.receipt.delta, paid.receipt.earned, paid.receipt.source_id, paid.receipt.owner],
    [12, 'hire', 12, 12, fromBea.id, A]);
  const again = await call(A, 'public.coop_collect($1)', [fromBea.id]);
  assert.equal(again.wages, 0, 'never paid twice');
  assert.deepEqual(again.receipt, paid.receipt, 'a retry answers the same receipt');
  // The receipt keeps the report as the postbox showed it, for a device that lost the answer.
  const { id: hireId, ...shown } = fromBea;
  assert.deepEqual(paid.receipt.detail, { hire_id: hireId, ...shown });
  assert.equal((await call(A, 'public.coop_reports()')).reports.length, 2);
  const records = await call(A, 'public.coop_records()');
  assert.deepEqual(records.filter(r => r.trips).map(r => r.trips), [1, 1, 1]);
  assert.equal((await call(B, 'public.coop_records()')).find(r => r.friend === A).trips, 1, 'both sides count the trip');
  // A blocked hirer's name and crew stay out of the lender's postbox; the wages still pay.
  await call(A, 'public.block_user($1)', [D]);
  const dan = (await call(A, 'public.coop_reports()')).reports.find(r => r.hirer === D);
  assert.equal(dan.hirer_name, '');
  assert.equal(dan.report.crew, undefined);
  assert.equal((await call(A, 'public.coop_collect($1)', [dan.id])).wages, 9);
  await db.query(`delete from public.blocks where blocker = '${A}' and blocked = '${D}'`);
  await friends(A, D);
});

test('a hire nobody finishes comes home after 72 hours with the smallest wage, and old hires are cleared', async () => {
  const hire = await call(E, 'public.coop_hire($1, $2)', [A, 'a2']);
  await db.query(`update public.coop_hires set day = day - 4, created_at = created_at - interval '73 hours' where id = '${hire.id}'`);
  await db.query(`update public.coop_hires set wage_day = wage_day - 4 where owner = '${A}' and id <> '${hire.id}'`);
  await db.query(`update private.coop_wage_days set day = day - 4 where owner = '${A}'`);
  const reports = await call(A, 'public.coop_reports()');
  const back = reports.reports.find(r => r.id === hire.id);
  assert.equal(back.report, null);
  assert.equal(back.wages, 6);
  await rejects(call(E, 'public.coop_finish_hire($1, $2)', [hire.id, json(report())]), /not_open/);
  // Sixty days on, an uncollected wage keeps its hire; once collected it goes.
  await age('coop_hires', `id = '${hire.id}'`, 'created_at', 61 * 24);
  await call(A, 'public.coop_reports()');
  assert.equal(await value(`select count(*)::int from public.coop_hires where id = '${hire.id}'`), 1, 'still owed, still kept');
  assert.equal((await call(A, 'public.coop_collect($1)', [hire.id])).receipt.delta, 6);
  await call(A, 'public.coop_reports()');
  assert.equal(await value(`select count(*)::int from public.coop_hires where id = '${hire.id}'`), 0);
  assert.equal(await value(`select count(*)::int from public.coop_receipts where source_id = '${hire.id}'`), 1, 'the receipt outlives the hire');
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
  const prize = await call(B, 'public.coop_duel_claim($1)', [made.id]);
  assert.deepEqual([prize.souls, prize.receipt.kind, prize.receipt.delta, prize.receipt.earned], [20, 'duel', 20, 10], 'only the 10 won is earned');
  const retry = await call(B, 'public.coop_duel_claim($1)', [made.id]);
  assert.deepEqual([retry.souls, retry.receipt], [0, prize.receipt], 'a retry answers the same receipt');
  const loser = zero(await call(A, 'public.coop_duel_claim($1)', [made.id]));
  assert.deepEqual(zero(await call(A, 'public.coop_duel_claim($1)', [made.id])), loser, 'a retry answers the same zero receipt');
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
  const refund = await call(A, 'public.coop_duel_claim($1)', [made.id]);
  assert.deepEqual([refund.souls, refund.receipt.delta, refund.receipt.earned], [25, 25, 0], 'a refund earns nothing');
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

// ---------------------------------------------------------------------------
// The money ledger
// ---------------------------------------------------------------------------

const wallet = who => call(who, 'public.coop_wallet()');
const receipts = (who, after = 0) => call(who, 'public.coop_receipts($1)', [after]);
const claim = (who, id) => call(who, 'public.coop_duel_claim($1)', [id]);
// What a save holding `souls` that already includes every receipt up to
// `seq` holds once it applies the rest.
async function replay(who, souls, seq) {
  let after = seq, page;
  do {
    page = await receipts(who, after);
    for (const r of page.receipts) { souls += r.delta; after = r.seq; }
  } while (page.has_more);
  return souls;
}

test('the opening balance is declared once, clamped downwards only, and no stake leaves before it', async () => {
  await friends(G, H); await friends(G, K); await friends(H, K);
  assert.deepEqual(await wallet(G), { ok: true, opening: null, opening_seq: 0, balance: null, last_seq: 0 });
  await rejects(create(G, H, 'stack', 5), /needs_opening/);
  assert.equal(await value(`select count(*)::int from public.coop_duels where challenger = '${G}'`), 0, 'the refused challenge left nothing behind');
  assert.equal((await create(G, H, 'stack', 0)).receipt, null, 'a free challenge needs no opening and writes no receipt');
  await rejects(call(G, 'public.coop_open($1, $2)', [null, 0]), /bad_balance/);
  await rejects(call(G, 'public.coop_open($1, $2)', [100, -1]), /bad_seq/);
  await rejects(call(G, 'public.coop_open($1, $2)', [100, null]), /bad_seq/);
  assert.deepEqual(await call(G, 'public.coop_open($1, $2)', [100, 7]),
    { ok: true, opening: 100, opening_seq: 0, balance: 100, last_seq: 0, accepted: true }, 'a seq past the last one clamps down to it');
  assert.deepEqual(await call(G, 'public.coop_open($1, $2)', [125, 0]),
    { ok: true, opening: 100, opening_seq: 0, balance: 100, last_seq: 0, accepted: false }, 'a second opening changes nothing');
  assert.equal((await call(K, 'public.coop_open($1, $2)', [-50, 0])).opening, 0, 'a negative opening clamps to 0');
  assert.equal((await call(H, 'public.coop_open($1, $2)', [2000000000, 0])).opening, 100000000);
  await rejects(create(K, H, 'stack', 1), /insufficient_souls/);
});

test('a stake leaves the balance in the same call that holds it, and a retry of claim answers the same receipt', async () => {
  const before = await wallet(G);
  const made = await create(G, H, 'stack', 25);
  assert.deepEqual([made.receipt.kind, made.receipt.delta, made.receipt.earned, made.receipt.source_id, made.receipt.owner, made.receipt.seq],
    ['stake', -25, 0, made.id, G, before.last_seq + 1]);
  assert.deepEqual(await one(`select amount, stake_receipt from public.coop_holds where duel_id = '${made.id}' and owner = '${G}'`),
    { amount: 25, stake_receipt: made.receipt.id });
  assert.equal((await wallet(G)).balance, 75);
  assert.deepEqual((await play(G, made.id)).receipt, made.receipt, 'play answers the stake receipt again');
  await submit(G, made.id, 1, 9, ghost());
  // The opponent's stake leaves when they first play, and only then.
  assert.equal((await wallet(H)).last_seq, 0);
  const turn = await play(H, made.id);
  assert.deepEqual([turn.receipt.kind, turn.receipt.delta, turn.receipt.owner, turn.receipt.seq], ['stake', -25, H, 1]);
  assert.deepEqual((await play(H, made.id)).receipt, turn.receipt, 'playing again holds nothing more');
  assert.equal(await value(`select count(*)::int from public.coop_receipts where source_id = '${made.id}' and kind = 'stake'`), 2);
  await submit(H, made.id, 1, 3);
  await call(G, 'public.coop_duel_rematch($1)', [made.id]);
  await submit(G, made.id, 2, 9, ghost());
  await play(H, made.id);
  assert.equal((await submit(H, made.id, 2, 3)).outcome, 'challenger');
  // The answer to the first claim is lost; every retry gets the same receipt.
  const first = await claim(G, made.id);
  assert.deepEqual([first.souls, first.receipt.delta, first.receipt.earned], [50, 50, 25]);
  assert.deepEqual(first.receipt.detail, { duel_id: made.id, game: 'stack', stake: 25, against: H, against_name: 'Hal', outcome: 'challenger',
    wins_mine: 2, wins_theirs: 0 });
  assert.deepEqual(made.receipt.detail, { ...first.receipt.detail, outcome: null, wins_mine: 0 }, 'the stake receipt keeps the series as it began');
  for (let i = 0; i < 3; i++) assert.deepEqual((await claim(G, made.id)).receipt, first.receipt);
  assert.deepEqual((await receipts(G, made.receipt.seq)).receipts, [first.receipt], 'and the feed has it once');
  assert.equal((await wallet(G)).balance, 125);
  const lost = zero(await claim(H, made.id));
  assert.deepEqual(zero(await claim(H, made.id)), lost, 'the loser is owed nothing, and a retry answers the same zero receipt');
  // Lost reply, pruned activity: the feed still has it once the duel rows are gone.
  await db.query(`delete from public.coop_duels where id = '${made.id}'`);
  assert.deepEqual((await receipts(H, lost.seq - 1)).receipts.map(r => [r.id, r.delta]), [[lost.id, 0]]);
});

test('a restored backup replays the receipts it missed: a refunded 25 stays 100, never 125', async () => {
  // Fay's save holds 100 souls and has seen no receipts; that is her backup.
  await friends(F, K);
  assert.equal((await call(F, 'public.coop_open($1, $2)', [100, 0])).balance, 100);
  const backup = { souls: 100, seq: 0 };
  const made = await create(F, K, 'stack', 25);
  assert.equal((await wallet(F)).balance, 75);
  await call(F, 'public.coop_duel_decline($1)', [made.id]);
  const refund = await claim(F, made.id);
  assert.deepEqual([refund.receipt.delta, refund.receipt.earned, refund.receipt.seq], [25, 0, made.receipt.seq + 1]);
  // The device restores the old save, claims again (answered by the same receipt) and replays.
  const retry = await claim(F, made.id);
  assert.deepEqual([retry.souls, retry.receipt], [0, refund.receipt]);
  assert.equal(await replay(F, backup.souls, backup.seq), 100, 'the debit and the refund cancel out: 100, not 125');
  // A save from between the stake and the refund comes out the same.
  assert.equal(await replay(F, 75, made.receipt.seq), 100);
  assert.equal((await call(F, 'public.coop_open($1, $2)', [125, 0])).accepted, false, 'the restored save cannot re-declare');
  assert.equal((await wallet(F)).balance, 100);
  assert.equal(await value(`select 100 + sum(delta)::int from public.coop_receipts where owner = '${F}'`), 100);
});

test('every hold, receipt and claim belongs to one account: nobody consumes or sees another player’s', async () => {
  const tie = await create(G, H, 'stack', 10);
  await submit(G, tie.id, 1, 5, ghost());
  await play(H, tie.id);
  await submit(H, tie.id, 1, 5);
  await call(H, 'public.coop_duel_rematch($1)', [tie.id]);
  await call(H, 'public.coop_duel_decline($1)', [tie.id]);
  assert.equal((await duel(G, tie.id)).outcome, 'tie');
  await rejects(claim(K, tie.id), /not_found/, 'a stranger to the series cannot claim it');
  // Hal claims first, twice; Gus's refund is untouched and comes from his own hold.
  const hal = await claim(H, tie.id);
  assert.deepEqual([hal.receipt.owner, hal.receipt.delta], [H, 10]);
  assert.equal((await claim(H, tie.id)).receipt.id, hal.receipt.id);
  const gus = await claim(G, tie.id);
  assert.deepEqual([gus.receipt.owner, gus.receipt.delta, gus.receipt.source_id], [G, 10, tie.id]);
  assert.notEqual(gus.receipt.id, hal.receipt.id);
  const holds = (await db.query(`select owner, released_to from public.coop_holds where duel_id = '${tie.id}' order by owner`)).rows;
  assert.deepEqual(holds.map(h => h.owner === h.released_to), [true, true], 'each hold went back to its own owner');
  // Each feed holds only its owner's receipts.
  assert.ok((await receipts(H)).receipts.every(r => r.owner === H));
  assert.ok((await receipts(G)).receipts.every(r => r.owner === G));
  await as(H, async () => {
    await rejects(db.query('select * from public.coop_receipts'), /permission denied/);
    await rejects(db.query('select * from public.coop_holds'), /permission denied/);
    await rejects(db.query(`update public.coop_wallets set opening = 999 where owner = '${H}'`), /permission denied/);
  });
  // Seqs run 1, 2, 3... per owner with no gaps.
  for (const who of [G, H]) {
    const seqs = (await receipts(who)).receipts.map(r => Number(r.seq));
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1));
  }
});

test('a block or an unfriending refunds each held stake once, and an absent or paid hold refunds nothing', async () => {
  const made = await create(G, H, 'frenzy', 20);
  await submit(G, made.id, 1, 30, ghost({ game: 'frenzy' }));
  await play(H, made.id);
  await call(H, 'public.block_user($1)', [G]);
  for (const who of [G, H]) {
    const one = await claim(who, made.id);
    assert.deepEqual([one.receipt.delta, one.receipt.earned], [20, 0]);
    assert.deepEqual((await claim(who, made.id)).receipt, one.receipt);
  }
  assert.equal(await value(`select count(*)::int from public.coop_receipts where source_id = '${made.id}' and kind = 'duel'`), 2);
  await db.query(`delete from public.blocks where blocker = '${H}' and blocked = '${G}'`);
  await friends(G, H);
  const parted = await create(G, H, 'stack', 15);
  await call(G, 'public.remove_friend($1)', [H]);
  assert.deepEqual([(await duel(G, parted.id)).outcome, (await claim(G, parted.id)).souls, (await claim(G, parted.id)).souls], ['void', 15, 0]);
  await friends(G, H);
  // A series whose holds are gone (or were paid) pays nothing, whatever pay_* says.
  const forged = await create(G, H, 'stack', 5);
  await db.query(`delete from public.coop_holds where duel_id = '${forged.id}'`);
  await call(G, 'public.coop_duel_decline($1)', [forged.id]);
  await db.query(`update public.coop_duels set pay_challenger = 50 where id = '${forged.id}'`);
  zero(await claim(G, forged.id));
});

test('rows from before the ledger: held stakes become holds once, already-paid ones stay paid', async () => {
  const legacy = async (extra) => (await one(`insert into public.coop_duels (challenger, opponent, game, stake, opponent_staked, status, outcome,
      wins_challenger, wins_opponent, pay_challenger, pay_opponent, claimed_challenger, claimed_opponent, settled_at)
    values ('${K}', '${H}', 'stack', ${extra.stake}, ${extra.staked}, '${extra.status}', ${extra.outcome ? `'${extra.outcome}'` : 'null'},
      0, 0, ${extra.payC || 0}, ${extra.payO || 0}, ${!!extra.claimedC}, ${!!extra.claimedO}, ${extra.status === 'settled' ? 'now()' : 'null'}) returning id`)).id;
  const open = await legacy({ stake: 25, staked: false, status: 'open' });
  await db.query(`insert into public.coop_rounds (duel_id, n, first_player, seed) values ('${open}', 1, '${K}', 42)`);
  const paidWin = await legacy({ stake: 10, staked: true, status: 'settled', outcome: 'opponent', payO: 20, claimedO: true });
  const unpaidVoid = await legacy({ stake: 7, staked: true, status: 'settled', outcome: 'void', payC: 7, payO: 7, claimedC: true });
  await db.exec(COOP);
  await db.exec(COOP);
  const holds = async id => (await db.query(`select owner, amount, stake_receipt, released_to from public.coop_holds where duel_id = '${id}' order by owner`)).rows;
  assert.deepEqual(await holds(open), [{ owner: K, amount: 25, stake_receipt: null, released_to: null }], 'the challenger’s stake, held by the old save');
  assert.deepEqual((await holds(paidWin)).map(h => h.released_to), [H, H], 'the winner already took both');
  assert.deepEqual((await holds(unpaidVoid)).map(h => [h.owner, h.released_to]), [[H, null], [K, K]].sort());
  zero(await claim(H, paidWin));  // never paid twice across the upgrade: nothing owed, a zero receipt
  const late = await claim(H, unpaidVoid);
  assert.deepEqual([late.souls, late.receipt.delta, late.receipt.earned], [7, 7, 0], 'a stake the old save took comes back once');
  assert.equal((await claim(K, unpaidVoid)).souls, 0);
  await call(K, 'public.coop_duel_decline($1)', [open]);
  assert.equal((await claim(K, open)).receipt.delta, 25);
  assert.equal(await value(`select count(*)::int from public.coop_holds where duel_id in ('${open}', '${paidWin}', '${unpaidVoid}')`), 5, 'a third load adds nothing');
});

test('the receipt feed pages 100 at a time in seq order and says when there is more', async () => {
  // Dan has no receipts yet.
  assert.equal((await wallet(D)).last_seq, 0);
  await db.query(`select private.coop_append('${D}', 'hire', gen_random_uuid(), 1, 1, null) from generate_series(1, 230)`);
  const first = await receipts(D, 0);
  assert.equal(first.receipts.length, 100);
  assert.equal(first.has_more, true);
  assert.equal(first.last_seq, 230);
  const all = [];
  let after = 0, page;
  do { page = await receipts(D, after); all.push(...page.receipts); after = page.receipts.at(-1)?.seq ?? after; } while (page.has_more);
  assert.deepEqual(all.map(r => Number(r.seq)), Array.from({ length: 230 }, (_, i) => i + 1));
  assert.deepEqual(await receipts(D, 230), { ok: true, receipts: [], has_more: false, last_seq: 230 });
  assert.equal((await receipts(D, -5)).receipts[0].seq, 1, 'a negative cursor reads from the start');
});

test('a report collected with no wages left that day still gets a receipt, with the report in it', async () => {
  await friends(G, K);
  await call(G, 'public.coop_set_hires($1)', [json([resident('g1', 'Gertie')])]);
  const hire = await call(K, 'public.coop_hire($1, $2)', [G, 'g1']);
  await db.query(`insert into private.coop_wage_days (owner, day, paid) values ('${G}', (now() at time zone 'utc')::date, 30)
    on conflict (owner, day) do update set paid = 30`);
  assert.equal((await call(K, 'public.coop_finish_hire($1, $2)', [hire.id, json(report())])).wages, 0);
  const got = await call(G, 'public.coop_collect($1)', [hire.id]);
  assert.deepEqual([got.wages, got.receipt.kind, got.receipt.delta, got.receipt.earned], [0, 'hire', 0, 0]);
  assert.deepEqual([got.receipt.detail.name, got.receipt.detail.hirer, got.receipt.detail.hirer_name, got.receipt.detail.report.route],
    ['Gertie', K, 'Kit', 'drawer']);
  assert.deepEqual((await call(G, 'public.coop_collect($1)', [hire.id])).receipt, got.receipt);
  const feed = (await receipts(G, got.receipt.seq - 1)).receipts;
  assert.deepEqual(feed, [got.receipt], 'and the feed carries it');
});

test('the fake in test/support/fake-coop.mjs keeps the same ledger: one receipt per claim, no stake past the balance', async () => {
  const { createFakeCoop } = await import('./support/fake-coop.mjs');
  let n = 0, t = Date.parse('2026-10-11T12:00:00Z');
  const fake = createFakeCoop({ profiles: new Map([[A, { display_name: 'Ada' }], [B, { display_name: 'Bea' }]]), now: () => t,
    json: (status, body) => ({ status, body }), rest: (status, code, message) => ({ status, body: { code, message } }),
    uuid: () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0'),
    friendships: [{ requester: A, addressee: B, status: 'accepted' }], blocks: [] });
  fake.setStrictFunds(true);
  const rpc = (who, name, args) => fake.RPC[name]({ id: who }, args).body;
  assert.equal(rpc(A, 'coop_duel_create', { p_to: B, p_game: 'stack', p_stake: 25 }).message, 'needs_opening');
  assert.equal(rpc(A, 'coop_open', { p_souls: 100, p_after: 0 }).accepted, true);
  const made = rpc(A, 'coop_duel_create', { p_to: B, p_game: 'stack', p_stake: 25 });
  assert.deepEqual([made.receipt.kind, made.receipt.delta, made.receipt.seq], ['stake', -25, 1]);
  rpc(A, 'coop_duel_decline', { p_duel: made.id });
  const first = rpc(A, 'coop_duel_claim', { p_duel: made.id }), again = rpc(A, 'coop_duel_claim', { p_duel: made.id });
  assert.deepEqual([first.souls, again.souls, again.receipt], [25, 0, first.receipt]);
  const zeroFake = rpc(B, 'coop_duel_claim', { p_duel: made.id });
  assert.deepEqual([zeroFake.ok, zeroFake.souls, zeroFake.receipt?.delta], [true, 0, 0]);
  assert.equal(100 + rpc(A, 'coop_receipts', { p_after: 0 }).receipts.reduce((s, r) => s + r.delta, 0), 100);
  assert.equal(rpc(A, 'coop_open', { p_souls: 125, p_after: 0 }).opening, 100);
  rpc(A, 'coop_open', { p_souls: 100, p_after: 0 });
  assert.equal(rpc(B, 'coop_open', { p_souls: 10, p_after: 0 }).balance, 10);
  assert.equal(rpc(B, 'coop_duel_create', { p_to: A, p_game: 'stack', p_stake: 11 }).message, 'insufficient_souls');
  assert.deepEqual(rpc(A, 'coop_wallet'), { ok: true, opening: 100, opening_seq: 0, balance: 100, last_seq: 2 });
});

// ---------------------------------------------------------------------------
// The shared purse: souls earned and spent outside Co-op reach the balance
// ---------------------------------------------------------------------------

const OPS = Array.from({ length: 12 }, (_, i) => '20000000-0000-4000-8000-0000000000' + String(10 + i));
const game = (id, delta, earned, detail) => detail === undefined ? { id, delta, earned } : { id, delta, earned, detail };
const adjust = (who, ops) => call(who, 'public.coop_adjust($1::jsonb)', [JSON.stringify(ops)]);
const { currencyId } = await import('./support/fake-coop.mjs');

test('an adjustment needs an opening, is idempotent per id and payload, and a bad batch changes nothing', async () => {
  await friends(L, M);
  await rejects(adjust(L, [game(OPS[0], 5, 5)]), /needs_opening/);
  await call(L, 'public.coop_open($1, $2)', [10, 0]);
  await call(M, 'public.coop_open($1, $2)', [500, 0]);
  const first = await adjust(L, [game(OPS[0], 100, 100, { reason: 'income' })]);
  assert.equal(first.balance, 110);
  const r = first.receipts[0];
  assert.deepEqual([r.kind, r.delta, r.earned, r.source_id, r.detail], ['game', 100, 100, OPS[0], { reason: 'income' }]);
  // A lost reply, retried: the same immutable receipt, and the balance does not move twice.
  const again = await adjust(L, [game(OPS[0], 100, 100, { reason: 'income' })]);
  assert.deepEqual(again.receipts, first.receipts);
  assert.equal(again.balance, 110);
  // A changed delta, earned or detail is refused, and nothing rewrites the receipt.
  await rejects(adjust(L, [game(OPS[0], 99, 100, { reason: 'income' })]), /bad_op/);
  await rejects(adjust(L, [game(OPS[0], 100, 99, { reason: 'income' })]), /bad_op/);
  await rejects(adjust(L, [game(OPS[0], 100, 100, { reason: 'other' })]), /bad_op/);
  await rejects(adjust(L, [game(OPS[0], 100, 100)]), /bad_op/);
  assert.deepEqual((await adjust(L, [game(OPS[0], 100, 100, { reason: 'income' })])).receipts, first.receipts);
  // A batch is atomic: the second op is bad, so the first is not written either.
  await rejects(adjust(L, [game(OPS[1], -7, 0), { id: OPS[2], delta: 1 }]), /bad_op/);
  assert.equal((await wallet(L)).balance, 110);
  const bad = [[], 'x', [{ id: 'nope', delta: 1, earned: 0 }], [game(OPS[3], 'many', 0)], [game(OPS[3], 1.5, 0)], [game(OPS[3], 100000001, 0)], [game(OPS[3], -100000001, 0)],
    [game(OPS[3], 1, -1)], [game(OPS[3], 1, 100000001)], [{ ...game(OPS[3], 1, 1), extra: true }], [game(OPS[3], 1, 1, 'text')], [game(OPS[3], 1, 1, { pad: 'x'.repeat(5000) })],
    Array.from({ length: 101 }, (_, i) => game('21000000-0000-4000-8000-' + String(i).padStart(12, '0'), 1, 1))];
  for (const b of bad) await rejects(adjust(L, b), /bad_op|22P02/, JSON.stringify(b).slice(0, 80));
  assert.equal((await wallet(L)).balance, 110);
  // A hundred ops are fine; the same id twice in one batch with one payload is one receipt.
  const hundred = await adjust(L, Array.from({ length: 100 }, (_, i) => game('22000000-0000-4000-8000-' + String(i).padStart(12, '0'), 0, 0)));
  assert.equal(hundred.receipts.length, 100);
  const dup = await adjust(L, [game(OPS[8], 3, 3), game(OPS[8], 3, 3)]);
  assert.equal(dup.receipts[0].id, dup.receipts[1].id);
  assert.equal(dup.balance, 113 + 0);
  await rejects(adjust(L, [game(OPS[9], 3, 3), game(OPS[9], 4, 3)]), /bad_op/);
  assert.equal((await wallet(L)).balance, 113);
  // Opened at 10, earned 103 elsewhere in the game: a 25 stake is fine.
  const made = await create(L, M, 'stack', 25);
  assert.equal(made.receipt.delta, -25);
  assert.equal((await wallet(L)).balance, 88);
});

test('delta 0 is valid and earned is not tied to delta: earn 100 and spend 100 before one save', async () => {
  const before = await wallet(L);
  const net0 = await adjust(L, [game(OPS[4], 0, 100, { reason: 'earn-and-spend' })]);
  assert.deepEqual([net0.receipts[0].delta, net0.receipts[0].earned], [0, 100]);
  assert.equal(net0.balance, before.balance);
  const spendOnly = await adjust(L, [game(OPS[5], -30, 0), game(OPS[6], 20, 50)]);
  assert.deepEqual(spendOnly.receipts.map(x => [x.delta, x.earned]), [[-30, 0], [20, 50]]);
  assert.equal(spendOnly.balance, before.balance - 10);
  // A big real-economy earning is not capped: there are no invented limits.
  const big = await adjust(M, [game(OPS[7], 50000000, 50000000), game(OPS[10], 50000000, 50000000)]);
  assert.equal(big.balance, 100000500);
  const back = await adjust(M, [game(OPS[11], -100000000, 0)]);
  assert.equal(back.balance, 500);
});

test('a spend may leave debt: debt blocks new stakes but never a payout', async () => {
  const have = (await wallet(L)).balance;
  const spent = await adjust(L, [game('23000000-0000-4000-8000-000000000001', -(have + 5), 0, { reason: 'spend' })]);
  assert.equal(spent.balance, -5, 'debt is allowed');
  await rejects(create(L, M, 'stack', 1), /insufficient_souls/);
  // Winning the open duel still pays out, and lifts the debt.
  const open = await value(`select id from public.coop_duels where challenger = '${L}' order by created_at desc limit 1`);
  await db.query(`update public.coop_duels set status = 'settled', outcome = 'challenger', opponent_staked = true where id = '${open}'`);
  await db.query(`insert into public.coop_holds (duel_id, owner, amount) values ('${open}', '${M}', 25)`);
  const paid = await claim(L, open);
  assert.equal(paid.receipt.delta, 50, 'both stakes, to the winner, whatever the debt');
  assert.equal((await wallet(L)).balance, 45);
  const recovered = await create(L, M, 'stack', 25);
  assert.equal(recovered.receipt.delta, -25, 'recovered, staking again');
});

test('an older backup or a second device replays the feed: receipts it never applied are all there, in order, once', async () => {
  const feed = [];
  for (let page = await receipts(L, 0); ; page = await receipts(L, feed.at(-1).seq)) {
    feed.push(...page.receipts);
    if (!page.has_more) break;
  }
  const games = feed.filter(x => x.kind === 'game');
  assert.ok(games.length > 100);
  // The feed is the whole story: a device with a stale save sums it from its opening.
  const total = feed.reduce((n, x) => n + x.delta, 0);
  assert.equal((await wallet(L)).balance, 10 + total);
  assert.deepEqual(feed.map(x => x.seq), feed.map((_, i) => i + 1));
  const reopen = await call(L, 'public.coop_open($1, $2)', [5000, 0]);
  assert.deepEqual([reopen.accepted, reopen.opening], [false, 10], 'a stale opening never moves');
  // The restored device resends what it once sent: every receipt comes back as it was, nothing counts twice.
  const sent = games.slice(0, 5).map(x => game(x.source_id, x.delta, x.earned, x.detail ?? undefined));
  const before = (await wallet(L)).balance;
  const resend = await adjust(L, sent);
  assert.deepEqual(resend.receipts.map(x => x.id), games.slice(0, 5).map(x => x.id));
  assert.equal(resend.balance, before);
});

test('a known reward has one canonical semantic id: derived from sha256, validated, retried, and restored without a second credit', async () => {
  const OWNER = '00000000-0000-4000-8000-000000000001';
  assert.equal(currencyId(OWNER, 'coven_chest:42:1'), 'fe25c6f7-6082-81c7-b76b-e46285558523', 'the golden id');
  // The SQL derives the same id from native sha256, no extension.
  assert.equal(await value(`select private.currency_id('${OWNER}', 'coven_chest:42:1')`), 'fe25c6f7-6082-81c7-b76b-e46285558523');
  assert.equal(await value(`select private.currency_id('${OWNER.toUpperCase()}'::uuid, 'coven_chest:42:1')`), 'fe25c6f7-6082-81c7-b76b-e46285558523');
  const chest = { reward: 'coven_chest', week: 42, tier: 1, curio: 'moth-wing', frame: null };
  const id = currencyId(L, 'coven_chest:42:1');
  const first = await adjust(L, [game(id, 15, 15, chest)]);
  assert.deepEqual(first.receipts[0].detail, chest);
  // The same reward under a fresh random id is refused: that is the second credit a restore would make.
  await rejects(adjust(L, [game(OPS[0].replace('2000', '2999'), 15, 15, chest)]), /bad_op/);
  // A lost reply: the retry is the same receipt. A changed award is refused and the original detail stands.
  assert.deepEqual((await adjust(L, [game(id, 15, 15, chest)])).receipts, first.receipts);
  await rejects(adjust(L, [game(id, 15, 15, { ...chest, curio: 'other' })]), /bad_op/);
  assert.deepEqual((await adjust(L, [game(id, 15, 15, chest)])).receipts[0].detail, chest);
  // Another week or tier is another id; the id of one owner does not fit another.
  await rejects(adjust(L, [game(currencyId(L, 'coven_chest:42:2'), 15, 15, chest)]), /bad_op/);
  await rejects(adjust(M, [game(id, 15, 15, chest)]), /bad_op/);
  await adjust(L, [game(currencyId(L, 'coven_chest:43:1'), 15, 15, { ...chest, week: 43 })]);
  // Invites key on the referred player; joint benches on the hearing.
  const friend = M;
  const invite = { reward: 'coven_invite', userId: friend, curio: null };
  await adjust(L, [game(currencyId(L, 'coven_invite:' + friend), 5, 5, invite)]);
  await rejects(adjust(L, [game(currencyId(L, 'coven_invite:' + A), 5, 5, invite)]), /bad_op/);
  await rejects(adjust(L, [game(currencyId(L, 'coven_invite:' + friend), 5, 5, { ...invite, userId: 'nope' })]), /bad_op/);
  const hearing = '24000000-0000-4000-8000-000000000001';
  const joint = { reward: 'joint_bench', hearing, curio: null, frame: 'gilt', fame: 2, paid: true };
  const jr = await adjust(L, [game(currencyId(L, 'joint_bench:' + hearing), 20, 20, joint)]);
  assert.deepEqual(jr.receipts[0].detail, joint, 'the effects ride in the immutable detail');
  await rejects(adjust(L, [game(currencyId(L, 'joint_bench:' + hearing), 20, 20, { ...joint, hearing: '24000000-0000-4000-8000-000000000002' })]), /bad_op/);
  await rejects(adjust(L, [game(currencyId(L, 'coven_chest:50:1'), 1, 1, { reward: 'coven_chest', week: 'x', tier: 1 })]), /bad_op/);
  await rejects(adjust(L, [game(currencyId(L, 'coven_chest:50:1'), 1, 1, { reward: 'coven_chest', week: 50, tier: 1, curio: 7 })]), /bad_op/);
  // Other details are kept as sent, with any reward name the client invents for itself.
  const free = await adjust(L, [game('25000000-0000-4000-8000-000000000001', 1, 1, { reward: 'something-else', n: 3 })]);
  assert.deepEqual(free.receipts[0].detail, { reward: 'something-else', n: 3 });
});

test('the fake mirrors the game receipts: idempotent, atomic, semantic ids, debt blocks stakes', async () => {
  const { createFakeCoop } = await import('./support/fake-coop.mjs');
  let n = 0;
  const fake = createFakeCoop({ profiles: new Map([[A, { display_name: 'Ada' }], [B, { display_name: 'Bea' }]]), now: () => Date.parse('2026-10-11T12:00:00Z'),
    json: (status, body) => ({ status, body }), rest: (status, code, message) => ({ status, body: { code, message } }),
    uuid: () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0'),
    friendships: [{ requester: A, addressee: B, status: 'accepted' }], blocks: [] });
  const rpc = (who, name, args) => { const r = fake.RPC[name]({ id: who }, args); return r.status === 200 ? r.body : r.body?.message ?? r; };
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[0], 1, 1)] }), 'needs_opening');
  rpc(A, 'coop_open', { p_souls: 10, p_after: 0 });
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[0], 100, 100, { reason: 'income' })] }).balance, 110);
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[0], 100, 100, { reason: 'income' })] }).balance, 110);
  for (const changed of [game(OPS[0], 5, 100, { reason: 'income' }), game(OPS[0], 100, 5, { reason: 'income' }), game(OPS[0], 100, 100, { reason: 'x' }), game(OPS[0], 100, 100)]) {
    assert.equal(rpc(A, 'coop_adjust', { p_ops: [changed] }), 'bad_op');
  }
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[1], -200, 0), { id: OPS[2], delta: 1 }] }), 'bad_op');
  assert.equal(rpc(A, 'coop_wallet', {}).balance, 110, 'a bad batch left nothing behind');
  const zero = rpc(A, 'coop_adjust', { p_ops: [game(OPS[3], 0, 100)] });
  assert.deepEqual([zero.receipts[0].delta, zero.receipts[0].earned, zero.balance], [0, 100, 110]);
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[4], -200, 0)] }).balance, -90);
  assert.equal(rpc(A, 'coop_duel_create', { p_to: B, p_game: 'stack', p_stake: 1 }), 'insufficient_souls');
  const chest = { reward: 'coven_chest', week: 42, tier: 1, curio: null, frame: null };
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[5], 5, 5, chest)] }), 'bad_op');
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(currencyId(A, 'coven_chest:42:1'), 5, 5, chest)] }).balance, -85);
  assert.equal(rpc(A, 'coop_adjust', { p_ops: [game(OPS[6], 3, 3), game(OPS[6], 3, 3)] }).receipts.length, 2);
});
