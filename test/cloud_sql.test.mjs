// The cloud save migration against a real Postgres (PGlite, in-process WASM)
// with a small Supabase-shaped bootstrap: the auth schema, auth.users,
// auth.uid() from request.jwt.claim.sub, the anon and authenticated roles and
// Supabase's default grants, which the migration has to take back.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION = readFileSync(new URL('../supabase/migrations/0001_accounts_and_saves.sql', import.meta.url), 'utf8');
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
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
  insert into auth.users (id, is_anonymous) values ('${A}', true), ('${B}', false);
`;

let db;
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  await db.exec(MIGRATION);
  await db.exec(MIGRATION);   // idempotent: the second paste changes nothing and fails nothing
});

// Run as a PostgREST request would: a role, and a JWT subject.
async function as(role, sub, work) {
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
const rejects = (promise, pattern) => assert.rejects(promise, err => pattern.test(err.message) || pattern.test(err.code || ''));

test('the migration is idempotent: one set of policies and functions after two runs', async () => {
  const policies = (await db.query("select tablename, policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' order by tablename")).rows;
  assert.deepEqual(policies.map(p => [p.tablename, p.cmd]), [['profiles', 'ALL'], ['saves', 'ALL']]);
  for (const p of policies) {
    assert.deepEqual(p.roles, ['authenticated']);
    assert.match(p.qual, /auth\.uid\(\) = user_id/);
    assert.match(p.with_check, /auth\.uid\(\) = user_id/);
  }
  const rls = (await db.query("select relname, relrowsecurity from pg_class where relname in ('profiles', 'saves') and relnamespace = 'public'::regnamespace order by relname")).rows;
  assert.deepEqual(rls, [{ relname: 'profiles', relrowsecurity: true }, { relname: 'saves', relrowsecurity: true }]);
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace order by p.proname")).rows;
  assert.deepEqual(functions.map(f => f.proname), ['delete_my_account', 'ensure_profile', 'pull_save', 'push_save', 'set_display_name']);
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
});

test('push_save writes only on the latest rev; a stale base is reported and writes nothing', async () => {
  await as('authenticated', A, async () => {
    assert.equal(await value('select public.pull_save()'), null);
    // No row yet: only base 0 may create it.
    assert.deepEqual(await value(`select public.push_save(4, '{"pets": []}'::jsonb, 'x')`), { ok: false, conflict: true, rev: 0, updated_at: null, device: null });
    const first = await value(`select public.push_save(0, '{"pets": [], "v": 1}'::jsonb, 'linux-first')`);
    assert.equal(first.ok, true);
    assert.equal(first.rev, 1);
    assert.ok(first.updated_at);
    const again = await value(`select public.push_save(0, '{"pets": [], "v": 99}'::jsonb, 'android-late')`);
    assert.equal(again.ok, false);
    assert.equal(again.conflict, true);
    assert.equal(again.rev, 1);
    assert.equal(again.device, 'linux-first');
    const second = await value(`select public.push_save(1, '{"pets": [], "v": 2}'::jsonb, 'linux-first')`);
    assert.deepEqual([second.ok, second.rev], [true, 2]);
    const stale = await value(`select public.push_save(1, '{"pets": [], "v": 3}'::jsonb, 'android-late')`);
    assert.deepEqual([stale.ok, stale.conflict, stale.rev], [false, true, 2]);
    const pulled = await value('select public.pull_save()');
    assert.deepEqual(pulled.data, { pets: [], v: 2 });
    assert.equal(pulled.rev, 2);
    assert.equal(pulled.device, 'linux-first');
    await rejects(db.query(`select public.push_save(2, '[1, 2]'::jsonb, '')`), /json object|22023/);
  });
});

test('a save over the size limit is refused by the check constraint', async () => {
  await as('authenticated', B, async () => {
    const big = JSON.stringify({ pets: [], blob: 'x'.repeat(6000000) });
    await rejects(db.query('select public.push_save(0, $1::jsonb, $2)', [big, 'linux-big']), /saves_data_size|23514/);
    assert.equal(await value('select public.pull_save()'), null);
  });
});

test('row level security keeps each player to their own rows', async () => {
  await as('authenticated', B, async () => {
    assert.equal((await db.query('select * from public.saves')).rows.length, 0, 'B cannot see A');
    assert.equal(await value('select public.pull_save()'), null);
    await rejects(db.query(`insert into public.saves (user_id, data) values ('${A}', '{}')`), /permission denied/);
    await rejects(db.query(`update public.saves set data = '{}' where user_id = '${A}'`), /permission denied/);
    await rejects(db.query(`delete from public.saves where user_id = '${A}'`), /permission denied/);
    const own = await value(`select public.push_save(0, '{"pets": [], "who": "b"}'::jsonb, 'b')`);
    assert.equal(own.rev, 1, 'B has a separate row');
    assert.deepEqual((await db.query('select user_id from public.saves')).rows, [{ user_id: B }]);
  });
  // Even with a write grant, the owner-only policy stops B touching A's row.
  await db.exec('grant update, delete on public.saves to authenticated');
  try {
    await as('authenticated', B, async () => {
      assert.equal((await db.query(`update public.saves set data = '{"stolen": true}' where user_id = '${A}'`)).affectedRows, 0);
      assert.equal((await db.query(`delete from public.saves where user_id = '${A}'`)).affectedRows, 0);
    });
  } finally { await db.exec('revoke update, delete on public.saves from authenticated'); }
  assert.deepEqual((await one(`select data from public.saves where user_id = '${A}'`)).data, { pets: [], v: 2 });
});

test('the anon role has no table access and cannot call anything', async () => {
  for (const table of ['public.saves', 'public.profiles']) {
    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      assert.equal(await value('select has_table_privilege($1, $2, $3)', ['anon', table, privilege]), false, 'anon ' + privilege + ' ' + table);
    }
    assert.equal(await value('select has_table_privilege($1, $2, $3)', ['authenticated', table, 'insert']), false);
    assert.equal(await value('select has_table_privilege($1, $2, $3)', ['authenticated', table, 'select']), true);
  }
  await as('anon', '', async () => {
    await rejects(db.query('select * from public.saves'), /permission denied/);
    await rejects(db.query('select * from public.profiles'), /permission denied/);
    for (const call of ['public.pull_save()', "public.push_save(0, '{}'::jsonb, '')", "public.ensure_profile('')", "public.set_display_name('x')", 'public.delete_my_account()']) {
      await rejects(db.query('select ' + call), /permission denied/);
    }
  });
  await as('authenticated', A, async () => {
    await rejects(db.query('select private.new_friend_code()'), /permission denied/);
  });
  // Signed in as a role but with no subject: refused, not written as nobody.
  await as('authenticated', '', async () => {
    await rejects(db.query(`select public.push_save(0, '{}'::jsonb, '')`), /sign in first|28000/);
  });
});

test('profiles get an unambiguous friend code once, and names are trimmed to 24', async () => {
  await as('authenticated', A, async () => {
    const made = await value("select public.ensure_profile('  Judge Mortis, Esquire, of the Upper Shelf  ')");
    assert.match(made.friend_code, /^[A-HJKMNP-Z2-9]{8}$/);
    assert.equal(made.display_name, 'Judge Mortis, Esquire, o');
    assert.deepEqual(await value("select public.ensure_profile('Someone else')"), made, 'a second call returns the same profile');
    const renamed = await value(`select public.set_display_name(E'\\tPip\\n the Lesser                          ')`);
    assert.deepEqual(renamed, { friend_code: made.friend_code, display_name: 'Pip the Lesser' });
  });
  const codes = await db.query("select private.new_friend_code() as c from generate_series(1, 300)");
  for (const { c } of codes.rows) assert.match(c, /^[A-HJKMNP-Z2-9]{8}$/);
});

test('delete_my_account removes the caller and everything that hangs off them', async () => {
  await as('authenticated', B, () => db.query("select public.ensure_profile('B')"));
  await as('authenticated', A, () => db.query('select public.delete_my_account()'));
  assert.equal(await value(`select count(*)::int from auth.users where id = '${A}'`), 0);
  assert.equal(await value(`select count(*)::int from public.saves where user_id = '${A}'`), 0);
  assert.equal(await value(`select count(*)::int from public.profiles where user_id = '${A}'`), 0);
  assert.equal(await value(`select count(*)::int from public.saves where user_id = '${B}'`), 1, 'other players are untouched');
  assert.equal(await value(`select count(*)::int from public.profiles where user_id = '${B}'`), 1);
});
