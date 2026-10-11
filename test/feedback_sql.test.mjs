// The feedback and play-day migration against a real Postgres (PGlite), on top
// of 0001 and 0002 and the same Supabase-shaped bootstrap as social_sql.test.mjs.
// It also runs the owner's README queries, so they are known to work.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), FEEDBACK = read('0006_feedback_and_play_days.sql');
const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const [A, B, C] = ['a', 'b', 'c'].map(x => '00000000-0000-4000-8000-00000000000' + x);
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
  insert into auth.users (id, email) values ('${A}', 'ada@example.com'), ('${B}', null), ('${C}', null);
`;
const FUNCTIONS = ['forget_play_days', 'mark_play_day', 'submit_feedback'];

let db, today;
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(FEEDBACK); }
  today = (await db.query('select current_date::text as d')).rows[0].d;
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
let serial = 0;
const cid = () => 'test-' + String(++serial).padStart(8, '0');
const send = (who, kind = 'bug', extra = {}) => call(who,
  'public.submit_feedback($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)',
  [extra.client || cid(), kind, extra.body ?? 'The raisin funeral never ended.', extra.doing ?? 'shelf', extra.rating ?? null, extra.moment ?? '',
    extra.version ?? '1.1.0', extra.platform ?? 'web', extra.diagnostics === undefined ? JSON.stringify({ version: '1.1.0', errors: [] }) : extra.diagnostics]);
const dayText = offset => one('select (current_date + $1::int)::text as d', [offset]).then(r => r.d);

test('the migration is idempotent, and both tables are sealed off from the API', async () => {
  const tables = (await db.query(`select c.relname, c.relrowsecurity from pg_class c
    where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and c.relname in ('feedback', 'play_days') order by c.relname`)).rows;
  assert.deepEqual(tables, [{ relname: 'feedback', relrowsecurity: true }, { relname: 'play_days', relrowsecurity: true }]);
  const policies = await value("select count(*)::int from pg_policies where tablename in ('feedback', 'play_days')");
  assert.equal(policies, 0, 'no policies: nothing is readable through the API, even by the player who wrote it');
  for (const table of ['feedback', 'play_days']) {
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['select', 'insert', 'update', 'delete']) {
        assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
      }
    }
  }
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1) order by p.proname", [FUNCTIONS])).rows;
  assert.deepEqual(functions.map(f => f.proname), FUNCTIONS, 'each exists once after two runs');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
    assert.equal(await value("select has_function_privilege('anon', p.oid, 'execute') from pg_proc p where p.proname = $1", [f.proname]), false, 'anon cannot call ' + f.proname);
    assert.equal(await value("select has_function_privilege('authenticated', p.oid, 'execute') from pg_proc p where p.proname = $1", [f.proname]), true, 'players can call ' + f.proname);
  }
  assert.equal(await value("select has_function_privilege('authenticated', 'private.clean_note(text, int)', 'execute')"), false);
});

test('nobody signed out can send anything, and nobody can read feedback back through the API', async () => {
  await as('', async () => {
    await rejects(db.query("select public.submit_feedback('anon-0001', 'bug')"), /permission denied/);
    await rejects(db.query(`select public.mark_play_day('${today}')`), /permission denied/);
  }, 'anon');
  await as('', () => rejects(db.query("select public.submit_feedback('nobody-001', 'bug')"), /sign in first|28000/));
  assert.deepEqual(await send(A, 'bug', { body: 'Line one\n\n\n\nLine two\u0007 rang a bell' }), { ok: true });
  await as(A, async () => {
    await rejects(db.query('select * from public.feedback'), /permission denied/);
    await rejects(db.query(`insert into public.feedback (user_id, client_id, kind) values ('${A}', 'sneaky-001', 'love')`), /permission denied/);
    await rejects(db.query("update public.feedback set kind = 'love'"), /permission denied/);
    await rejects(db.query('delete from public.feedback'), /permission denied/);
    await rejects(db.query('select * from public.play_days'), /permission denied/);
    await rejects(db.query("select private.clean_note('x', 5)"), /permission denied/);
  });
  const row = await one(`select * from public.feedback where user_id = '${A}' order by id desc limit 1`);
  assert.equal(row.body, 'Line one\n\nLine two  rang a bell', 'line breaks kept, control characters gone, blank runs shortened');
  assert.equal(row.kind, 'bug');
  assert.equal(row.doing, 'shelf');
  assert.equal(row.app_version, '1.1.0');
  assert.equal(row.platform, 'web');
  assert.deepEqual(row.diagnostics, { version: '1.1.0', errors: [] });
});

test('feedback is validated, clamped and capped in size', async () => {
  await rejects(send(B, 'rant'), /bad_kind/);
  await rejects(send(B, 'bug', { client: 'NO CAPS' }), /bad_feedback/);
  await rejects(send(B, 'bug', { client: 'short' }), /bad_feedback/);
  await rejects(send(B, 'bug', { body: 'x'.repeat(4001) }), /too_large/);
  await rejects(send(B, 'bug', { diagnostics: JSON.stringify({ errors: ['y'.repeat(16000)] }) }), /too_large/);
  await rejects(send(B, 'bug', { diagnostics: JSON.stringify(['a list']) }), /too_large/);
  await rejects(send(B, 'bug', { rating: 4 }), /bad_feedback/, 'only a check-in carries a rating');
  await rejects(send(B, 'pulse', { moment: 'day2' }), /bad_feedback/, 'a check-in needs a rating');
  await rejects(send(B, 'pulse', { rating: 6, moment: 'day2' }), /bad_feedback/);
  await rejects(send(B, 'pulse', { rating: 3, moment: 'day99' }), /bad_feedback/);
  assert.deepEqual(await send(B, 'idea', { body: 'z'.repeat(1500), doing: 'NOT A TOKEN!', platform: 'ios', version: 'v'.repeat(40), diagnostics: null }), { ok: true });
  const row = await one(`select * from public.feedback where user_id = '${B}' order by id desc limit 1`);
  assert.equal(row.body.length, 1000, 'the text is clamped to 1000 characters');
  assert.equal(row.doing, '');
  assert.equal(row.platform, '');
  assert.equal(row.app_version.length, 24);
  assert.equal(row.diagnostics, null);
  assert.deepEqual(await send(B, 'pulse', { rating: 4, moment: 'court', body: '' }), { ok: true });
  const pulse = await one(`select kind, rating, moment from public.feedback where user_id = '${B}' order by id desc limit 1`);
  assert.deepEqual(pulse, { kind: 'pulse', rating: 4, moment: 'court' });
});

test('ten reports a day per player, and a resend of the same report is not counted twice', async () => {
  const client = cid();
  assert.deepEqual(await send(C, 'love', { client }), { ok: true });
  assert.deepEqual(await send(C, 'love', { client }), { ok: true, duplicate: true });
  assert.equal(await value(`select count(*)::int from public.feedback where user_id = '${C}'`), 1);
  for (let i = 0; i < 9; i++) await send(C, 'confusing');
  await rejects(send(C, 'bug'), /rate_limited/);
  assert.deepEqual(await send(C, 'love', { client }), { ok: true, duplicate: true }, 'a retry is answered even at the limit');
  assert.ok(await send(A, 'bug'), 'the limit is per player');
  // A day later the allowance is back.
  await db.query(`update public.feedback set created_at = now() - interval '25 hours' where user_id = '${C}'`);
  assert.deepEqual(await send(C, 'bug'), { ok: true });
  // Reports older than a year are cleared as new ones arrive.
  await db.query(`update public.feedback set created_at = now() - interval '400 days' where user_id = '${C}'`);
  await send(A, 'idea');
  assert.equal(await value(`select count(*)::int from public.feedback where user_id = '${C}'`), 0);
});

test('play days: one row per player per day, only near today, and forgettable', async () => {
  assert.deepEqual(await call(A, 'public.mark_play_day($1)', [today]), { ok: true, counted: true });
  assert.deepEqual(await call(A, 'public.mark_play_day($1)', [today]), { ok: true, counted: false });
  assert.deepEqual(await call(A, 'public.mark_play_day($1)', [today.replace(/-0(\d)/g, '-$1')]), { ok: true, counted: false }, 'the game writes months and days without padding');
  assert.equal(await value(`select count(*)::int from public.play_days where user_id = '${A}'`), 1);
  assert.deepEqual(await call(A, 'public.mark_play_day($1)', [await dayText(-1)]), { ok: true, counted: true }, 'a time zone behind');
  assert.deepEqual(await call(A, 'public.mark_play_day($1)', [await dayText(1)]), { ok: true, counted: true }, 'a time zone ahead');
  await rejects(call(A, 'public.mark_play_day($1)', [await dayText(2)]), /bad_day/);
  await rejects(call(A, 'public.mark_play_day($1)', [await dayText(-30)]), /bad_day/);
  await rejects(call(A, 'public.mark_play_day($1)', ['yesterday']), /bad_day/);
  await rejects(call(A, 'public.mark_play_day($1)', ['2026-02-31']), /bad_day/);
  assert.equal(await value(`select count(*)::int from public.play_days where user_id = '${A}'`), 3);
  await call(B, 'public.mark_play_day($1)', [today]);
  assert.deepEqual(await call(A, 'public.forget_play_days()'), { ok: true, removed: 3 });
  assert.equal(await value(`select count(*)::int from public.play_days where user_id = '${A}'`), 0);
  assert.equal(await value(`select count(*)::int from public.play_days where user_id = '${B}'`), 1, 'only the caller is forgotten');
  // Very old days go as new ones arrive.
  await db.query(`insert into public.play_days (user_id, day) values ('${B}', current_date - 500)`);
  await call(B, 'public.mark_play_day($1)', [await dayText(-1)]);
  assert.equal(await value(`select count(*)::int from public.play_days where user_id = '${B}' and day < current_date - 400`), 0);
});

test('deleting the account takes its feedback and play days with it', async () => {
  await send(B, 'love');
  await call(B, 'public.mark_play_day($1)', [today]);
  await call(B, 'public.delete_my_account()');
  assert.equal(await value(`select count(*)::int from public.feedback where user_id = '${B}'`), 0);
  assert.equal(await value(`select count(*)::int from public.play_days where user_id = '${B}'`), 0);
});

test('the owner queries in the README run and count what they say', async () => {
  const blocks = [...README.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1]);
  const named = name => {
    const found = blocks.find(sql => sql.startsWith('-- ' + name));
    assert.ok(found, 'README has the query: ' + name);
    return found;
  };
  const people = Array.from({ length: 4 }, (_, i) => '10000000-0000-4000-8000-00000000000' + i);
  await db.query(`insert into auth.users (id) select unnest($1::uuid[])`, [people]);
  // Two started 40 days ago (one came back the next day, a week and a month
  // later), one started 3 days ago and came back the day after, and one today.
  const days = [[people[0], [-40, -39, -33, -10]], [people[1], [-40]], [people[2], [-3, -2]], [people[3], [0]]];
  for (const [id, list] of days) for (const d of list) await db.query('insert into public.play_days (user_id, day) values ($1, current_date + $2::int)', [id, d]);
  const cohorts = (await db.query(named('Retention'))).rows;
  const week = async offset => (await one("select date_trunc('week', current_date + $1::int)::date::text as w", [offset])).w;
  const cohort = async offset => { const w = await week(offset); return cohorts.find(r => new Date(r.signup_week).toISOString().slice(0, 10) === w || String(r.signup_week).startsWith(w)); };
  const old = await cohort(-40);
  assert.ok(old, 'the two players who started 40 days ago share a cohort: ' + JSON.stringify(cohorts));
  assert.deepEqual([Number(old.players), Number(old.d1_pct), Number(old.d7_pct), Number(old.d30_pct)], [2, 50, 50, 50]);
  const young = await cohort(-3);
  assert.equal(young.d30_pct, null, 'a cohort too young for D30 shows a blank rather than 0');
  assert.equal(young.d7_pct, null);
  assert.ok(cohorts.indexOf(young) < cohorts.indexOf(old), 'newest cohort first');
  const active = (await db.query(named('Daily active players'))).rows;
  assert.equal(active.length, 4, 'days within the last 30: ' + JSON.stringify(active));
  assert.ok(active.every(r => Number(r.players) === 1));
  const pulses = (await db.query(named('Check-ins'))).rows;
  assert.ok(pulses.every(r => ['day2', 'court', 'day7'].includes(r.moment)));
  await send(A, 'bug', { body: 'Newest of all' });
  const latest = (await db.query(named('Latest feedback'))).rows;
  assert.equal(latest[0].body, 'Newest of all');
  assert.ok(!('email' in latest[0]), 'the feedback query does not bring in the email');
});
