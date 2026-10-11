// All ten migrations together, as the live project will run them: loaded in
// order, twice, against a real Postgres (PGlite). The per-feature tests load
// their own file alone; this one checks what only shows up in combination.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const DIR = new URL('../supabase/migrations/', import.meta.url);
const MIGRATIONS = readdirSync(DIR).filter(name => /^\d{4}_.*\.sql$/.test(name)).sort();
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
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');
`;

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) for (const name of MIGRATIONS) await db.exec(readFileSync(new URL(name, DIR), 'utf8'));
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat']]) code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  await call(A, 'public.add_friend($1)', [code[B]]);
  await call(B, 'public.add_friend($1)', [code[A]]);
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
const attempt = async promise => { try { return { ok: true, value: await promise }; } catch (error) { return { ok: false, message: error.message }; } };
const resident = (id, name) => ({ id, name, traits: ['spiteful', 'damp'], mood: 'fine', bond: 3, art: { creature: { body: 'pear', palette: 'mint', parts: {} } } });
const CAST = { v: 1, p: { kind: 'pet', id: 'a0', name: 'Mabel', owner: 'from' }, d: { kind: 'pet', id: 'b0', name: 'Grubbs', owner: 'to' },
  jury: [{ kind: 'stock', id: 'j1', name: 'A Juror' }], witnesses: [] };
const SEALED = { ruling: 'defendant', truth: 'plaintiff', stars: 2, ratings: 87, agree: 4, dissent: 1 };

const tryTrade = () => attempt(call(A, 'public.propose_trade($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)', [B, JSON.stringify({ curios: [{ id: 'moth-wing', n: 1 }] }), '{}', 'fair',
  JSON.stringify({ seq: 0, curios: { 'moth-wing': 2 } })]));
const tryBasket = () => attempt(call(A, 'public.kin_leave_basket($1, $2::jsonb, $3)', [B, JSON.stringify(resident('a0', 'Mabel')), 'b0']));
const tryHearing = () => attempt(call(A, 'public.open_hearing($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)',
  [B, 'served', 'borrowed-coffin', '', 4242, JSON.stringify(CAST), JSON.stringify(SEALED), '[]']));
const QUIET = /\bdnd\b|do_not_disturb/;

test('every migration loads twice in order on top of the others', () => {
  assert.equal(MIGRATIONS.length, 10, MIGRATIONS.join(', '));
  assert.equal(MIGRATIONS[0], '0001_accounts_and_saves.sql');
  assert.equal(MIGRATIONS.at(-1), '0010_kin.sql');
});

test('Do not disturb from the postbox stops trades, baskets and new hearings, and lifts when switched off', async () => {
  await call(A, 'public.publish_shelf($1::jsonb)', [JSON.stringify({ v: 1, name: '', rank: 0, curios: 0, residents: [resident('a0', 'Mabel')] })]);
  await call(B, 'public.publish_shelf($1::jsonb)', [JSON.stringify({ v: 1, name: '', rank: 0, curios: 0, residents: [resident('b0', 'Grubbs')] })]);
  // A hearing between the two residents is the history a basket needs.
  await call(A, `public.send_summons($1, 'borrowed-coffin', $2::jsonb, $3::jsonb)`, [B, JSON.stringify({ id: 'a0', name: 'Mabel' }), JSON.stringify({ id: 'b0', name: 'Grubbs' })]);

  await call(B, 'public.set_dnd($1)', [true]);
  assert.equal(await value('select private.dnd_on($1)', [B]), true);
  assert.equal(await value('select private.trade_dnd($1)', [B]), true, 'trades read the postbox switch');
  assert.equal(await value('select private.kin_dnd($1)', [B]), true, 'kin reads the postbox switch');
  assert.equal(await value('select private.hearing_dnd($1)', [B]), true, 'the Joint Bench reads the postbox switch');
  for (const [what, run] of [['trade', tryTrade], ['basket', tryBasket], ['hearing', tryHearing]]) {
    const r = await run();
    assert.equal(r.ok, false, what + ' got through Do not disturb');
    assert.match(r.message, QUIET, what + ': ' + r.message);
  }

  await call(B, 'public.set_dnd($1)', [false]);
  assert.equal(await value('select private.trade_dnd($1)', [B]), false);
  assert.equal(await value('select private.kin_dnd($1)', [B]), false);
  assert.equal(await value('select private.hearing_dnd($1)', [B]), false);
  for (const [what, run] of [['trade', tryTrade], ['basket', tryBasket], ['hearing', tryHearing]]) {
    const r = await run();
    assert.equal(r.ok, true, what + ' still refused after Do not disturb was switched off: ' + r.message);
  }
});

test('the private helpers cannot be called by players or by anonymous callers', async () => {
  for (const fn of ['private.dnd_on(uuid)', 'private.trade_dnd(uuid)', 'private.kin_dnd(uuid)', 'private.hearing_dnd(uuid)', 'private.lock_account(uuid)', 'private.lock_accounts(uuid,uuid)']) {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await value('select has_function_privilege($1, $2, $3)', [role, fn, 'execute']), false, role + ' can execute ' + fn);
    }
  }
});

test('no public table is open to direct reads or writes by players after all ten migrations', async () => {
  const tables = (await db.query(`select c.relname, c.relrowsecurity from pg_class c
    where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace order by c.relname`)).rows;
  assert.ok(tables.length > 10);
  for (const { relname, relrowsecurity } of tables) {
    assert.equal(relrowsecurity, true, relname + ' has row level security off');
    for (const privilege of ['insert', 'update', 'delete']) {
      for (const role of ['anon', 'authenticated']) {
        assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + relname, privilege]), false, role + ' can ' + privilege + ' ' + relname);
      }
    }
    assert.equal(await value('select has_table_privilege($1, $2, $3)', ['anon', 'public.' + relname, 'select']), false, 'anon can read ' + relname);
  }
});
