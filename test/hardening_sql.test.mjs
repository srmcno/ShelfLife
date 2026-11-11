import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// supabase/migrations/0015_hardening.sql, run after every earlier migration, twice.
const dir = new URL('../supabase/migrations/', import.meta.url);
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const guest = id(1), ada = id(2), bea = id(3), cat = id(4);
let db;
const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
async function as(user, fn, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); await db.exec('set role ' + role);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    insert into auth.users(id, is_anonymous) values ('${guest}', true), ('${ada}', false), ('${bea}', false), ('${cat}', false);`);
  const migrations = readdirSync(dir).filter(n => /^\d{4}_.*\.sql$/.test(n)).sort();
  for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(readFileSync(new URL(migration, dir), 'utf8'));
  for (const [user, name] of [[guest, 'Guest'], [ada, 'Ada'], [bea, 'Bea'], [cat, 'Cat']]) {
    await as(user, () => value('select public.ensure_profile($1)', [name]));
  }
});
after(async () => db?.close());

test('Find players needs an email account, and a guest can still withdraw', async () => {
  await assert.rejects(as(guest, () => value('select public.discovery_set(true)')), /account_required/);
  await assert.rejects(as(guest, () => value("select public.discovery_find('', 0)")), /account_required/);
  await assert.rejects(as(guest, () => value('select public.discovery_location_set(10, 10)')), /account_required/);
  await assert.rejects(as(guest, () => value('select public.discovery_nearby(0)')), /account_required/);
  await assert.rejects(as(guest, () => value('select public.discovery_request($1)', [ada])), /account_required/);
  assert.equal((await as(guest, () => value('select public.discovery_set(false)'))).listed, false);
  assert.equal(await value('select count(*)::int from private.discovery_attempts where user_id = $1', [guest]), 0, 'a refused guest leaves no attempt rows');
  assert.equal((await as(ada, () => value('select public.discovery_set(true)'))).listed, true);
  assert.ok(Array.isArray((await as(bea, () => value("select public.discovery_find('', 0)"))).players));
});

test('a listed player holds at most 50 pending requests', async () => {
  await db.exec(`insert into auth.users(id) select ('00000000-0000-4000-8000-' || lpad((1000 + n)::text, 12, '0'))::uuid from generate_series(1, 50) n;
    insert into public.friendships(requester, addressee) select ('00000000-0000-4000-8000-' || lpad((1000 + n)::text, 12, '0'))::uuid, '${ada}' from generate_series(1, 50) n;`);
  assert.deepEqual(await as(bea, () => value('select public.discovery_request($1)', [ada])), { ok: false, error: 'not_found' });
  await db.query('delete from public.friendships where addressee = $1 and requester = $2', [ada, id(1001)]);
  const answer = await as(bea, () => value('select public.discovery_request($1)', [ada]));
  assert.equal(answer.ok, true); assert.equal(answer.status, 'pending');
  await db.query('delete from public.friendships where addressee = $1', [ada]);
});

test('the Gazette shows the circle only, and reading it is rate limited', async () => {
  await db.query("insert into public.friendships(requester, addressee, status) values ($1, $2, 'accepted')", [ada, bea]);
  const post = (user, key) => as(user, () => value('select public.gazette_post($1::jsonb)', [JSON.stringify([{ key, kind: 'adopted', data: { resident: 'mabel' }, generation: 0 }])]));
  assert.equal((await post(bea, id(9001))).posted, 1);
  assert.equal((await post(cat, id(9002))).posted, 1);
  const feed = await as(ada, () => value('select public.gazette_feed()'));
  assert.deepEqual(feed.events.map(e => e.actor), [bea], 'a stranger never appears');
  assert.equal(await as(ada, () => value('select public.gazette_unread()')), 1);
  assert.equal(await as(guest, () => value('select public.gazette_unread()')), 0);
  assert.deepEqual((await as(cat, () => value('select public.gazette_feed()'))).events.map(e => e.actor), [cat], 'your own news is yours to read');
  await db.query('insert into public.blocks(blocker, blocked) values ($1, $2)', [bea, ada]);
  assert.deepEqual((await as(ada, () => value('select public.gazette_feed()'))).events, []);
  await db.query('delete from public.blocks');
  await db.query('insert into private.gazette_requests(user_id) select $1 from generate_series(1, 300)', [ada]);
  await assert.rejects(as(ada, () => value('select public.gazette_feed()')), /rate_limited/);
  assert.equal(await as(ada, () => value('select public.gazette_unread()')), 1, 'the badge count still answers');
  await assert.rejects(as(guest, () => value('select private.gazette_circle($1)', [ada])), /permission denied/);
});

test('a push that keeps failing backs off and is dropped after five tries', async () => {
  const key = 'B' + 'a'.repeat(86), secret = 'a'.repeat(22);
  await assert.rejects(as(bea, () => value('select public.push_subscribe($1,$2,$3)', ['https://fcm.googleapis.com/x', 'A' + 'a'.repeat(86), secret])), /push_subscriptions_key_shape|bad_subscription/);
  assert.equal(await as(bea, () => value('select public.push_subscribe($1,$2,$3)', ['https://fcm.googleapis.com/x', key, secret])), true);
  await db.query('delete from private.push_queue');
  await db.query('insert into public.friendships(requester, addressee) values ($1, $2)', [cat, bea]);
  assert.equal(await value('select count(*)::int from private.push_queue'), 1);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await db.query('update private.push_queue set available_at = now()');
    const batches = await as('', () => value('select public.push_take()'), 'service_role');
    assert.equal(batches.length, 1, 'try ' + attempt + ' is offered');
    await as('', () => value('select public.push_result($1,$2,$3,$4,$5)', [batches[0].lease, bea, false, [], []]), 'service_role');
    if (attempt < 5) {
      const minutes = await value("select round(extract(epoch from (available_at - now())) / 60)::int from private.push_queue");
      assert.equal(minutes, 5 * 2 ** (attempt - 1));
    }
  }
  assert.equal(await value('select count(*)::int from private.push_queue'), 0);
  for (const table of ['push_queue', 'push_deliveries', 'push_config']) {
    assert.equal(await value("select relrowsecurity from pg_class where oid = ('private.' || $1)::regclass", [table]), true);
  }
});
