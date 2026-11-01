import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const dir = new URL('../supabase/migrations/', import.meta.url);
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
const key = 'B' + 'a'.repeat(86), auth = 'a'.repeat(22);
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
    insert into auth.users(id) values ('${a}'),('${b}');`);
  const migrations = readdirSync(dir).filter(n => /^\d{4}_.*\.sql$/.test(n)).sort();
  for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(readFileSync(new URL(migration, dir), 'utf8'));
});
after(async () => db?.close());
test('endpoints are allowlisted, subscription count bounded, and service functions inaccessible to players', async () => {
  for (const bad of ['https://evil.example/path','https://fcm.googleapis.com.evil.example/path','https://fcm.googleapis.com@evil.example/path','http://fcm.googleapis.com/path','https://fcm.googleapis.com:8443/path']) {
    await assert.rejects(as(b, () => value('select public.push_subscribe($1,$2,$3)', [bad, key, auth])), /bad_subscription/);
  }
  for (let i = 0; i < 5; i++) assert.equal(await as(b, () => value('select public.push_subscribe($1,$2,$3)', ['https://fcm.googleapis.com/' + i, key, auth])), true);
  await assert.rejects(as(b, () => value('select public.push_subscribe($1,$2,$3)', ['https://fcm.googleapis.com/six', key, auth])), /too_many_subscriptions/);
  await assert.rejects(as(a, () => value('select public.push_take()')), /permission denied/);
  await assert.rejects(as(a, () => value('select count(*) from public.push_subscriptions')), /permission denied/);
});
test('friend request and acceptance enqueue once, leases are exclusive and dead subscriptions are removed', async () => {
  await db.query('insert into public.friendships(requester,addressee) values ($1,$2)', [a,b]);
  let queued = await value('select count(*)::int from private.push_queue'); assert.equal(queued, 1);
  const batches = await as('', () => value('select public.push_take()'), 'service_role');
  assert.equal(batches.length, 1); assert.equal(batches[0].user_id, b); assert.equal(batches[0].count, 1); assert.equal(batches[0].subscriptions.length, 5);
  assert.deepEqual(await as('', () => value('select public.push_take()'), 'service_role'), []);
  await as('', () => value('select public.push_result($1,$2,$3,$4,$5)', [batches[0].lease,b,true,['https://fcm.googleapis.com/0'],[]]), 'service_role');
  assert.equal(await value('select count(*)::int from private.push_queue'), 0);
  assert.equal(await value('select count(*)::int from public.push_subscriptions'), 4);
  await db.query('update public.friendships set status=$1 where requester=$2 and addressee=$3', ['accepted',a,b]);
  assert.equal(await value('select count(*)::int from private.push_queue'), 0, 'requester without subscriptions is not queued');
});
test('partial push failure retries only endpoints not already delivered', async () => {
  await db.query("insert into public.summons(from_user,to_user,case_id,plaintiff,defendant) values ($1,$2,'test','{}','{}')", [a,b]);
  const first = (await as('', () => value('select public.push_take()'), 'service_role'))[0];
  assert.equal(first.subscriptions.length, 4);
  const sent = first.subscriptions.slice(0, 2).map(s => s.endpoint);
  await as('', () => value('select public.push_result($1,$2,$3,$4,$5)', [first.lease,b,false,[],sent]), 'service_role');
  assert.deepEqual(await as('', () => value('select public.push_take()'), 'service_role'), [], 'failed delivery waits before retry');
  await db.exec('update private.push_queue set available_at=now()');
  const retry = (await as('', () => value('select public.push_take()'), 'service_role'))[0];
  assert.equal(retry.subscriptions.length, 2);
  assert.ok(retry.subscriptions.every(s => !sent.includes(s.endpoint)));
  await as('', () => value('select public.push_result($1,$2,$3,$4,$5)', [retry.lease,b,true,[],retry.subscriptions.map(s => s.endpoint)]), 'service_role');
  assert.equal(await value('select count(*)::int from private.push_queue'), 0);
});
test('the source table triggers enqueue each supported kind for the intended recipient', async () => {
  await db.query("insert into public.visits(from_user,to_user,resident_id,resident,days) values ($1,$2,'pet','{}',1)", [a,b]);
  await db.query("insert into public.gifts(from_user,to_user,treat,day) values ($1,$2,'cake',current_date)", [a,b]);
  await db.query("insert into public.trades(from_user,to_user,kind) values ($1,$2,'curio')", [a,b]);
  await db.query("insert into public.hearings(from_user,to_user,kind,case_id,seed,cast_snapshot,first_ruling) values ($1,$2,'served','test',1,'{}','{}')", [a,b]);
  await db.query("insert into public.coop_duels(challenger,opponent,game) values ($1,$2,'stack')", [a,b]);
  const coven = await value("insert into public.covens(name_a,name_b,sigil_shape,sigil_symbol,sigil_colour) values ('a','b','a','b','c') returning id");
  await db.query('insert into public.coven_invites(coven_id,from_user,to_user) values ($1,$2,$3)', [coven,a,b]);
  await db.query("insert into public.kin_baskets(from_user,to_user,from_parent,to_parent_id,seed,history) values ($1,$2,'{}','pet',1,'friends')", [a,b]);
  const pal = await value("insert into public.kin_pals(user_a,user_b,res_a,res_b,history,seed) values ($1,$2,'a','b','introduced',1) returning id", [a,b]);
  await db.query("insert into public.kin_letters(pal_id,from_user,to_user,kind,week,writer,reader) values ($1,$2,$3,'weekly',1,'{}','{}')", [pal,a,b]);
  const groups = (await db.query('select event_group,recipient from private.push_queue order by id')).rows;
  assert.deepEqual(groups.map(r => r.event_group), ['gifts','gifts','gifts','court','games','covens','kin','kin']);
  assert.ok(groups.every(row => row.recipient === b));
  await db.exec('delete from private.push_queue');
});
test('queue claims at most four and wakes a ready backlog without exposing the wake RPC', async () => {
  await db.exec(`create schema net;
    create table private.fake_wakes(id int generated always as identity, url text);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 2000) returns bigint language plpgsql as $f$
    begin insert into private.fake_wakes(url) values (url); return 1; end $f$;
    insert into private.push_config(key,value) values ('url','https://example.test/push'),('secret','private');`);
  for (let i=0; i<6; i++) await db.query("insert into public.summons(from_user,to_user,case_id,plaintiff,defendant) values ($1,$2,'test','{}','{}')", [a,b]);
  const first = await as('', () => value('select public.push_take()'), 'service_role');
  assert.equal(first.length, 1); assert.equal(first[0].count, 4);
  await assert.rejects(as(a, () => value('select public.push_wake()')), /permission denied/);
  assert.equal(await as('', () => value('select public.push_wake()'), 'service_role'), true);
  assert.equal(await value('select count(*)::int from private.fake_wakes'), 7);
  await db.exec('delete from private.push_queue');
});
test('opt out, do not disturb, and block prevent queue delivery', async () => {
  await as(b, () => value('select public.push_set($1,$2)', ['court',false]));
  await db.query("insert into public.summons(from_user,to_user,case_id,plaintiff,defendant) values ($1,$2,'test','{}','{}')", [a,b]);
  assert.equal(await value('select count(*)::int from private.push_queue'), 0);
  await as(b, () => value('select public.push_set($1,$2)', ['court',true]));
  await db.query("insert into public.summons(from_user,to_user,case_id,plaintiff,defendant) values ($1,$2,'test','{}','{}')", [a,b]);
  await as(b, () => value('select public.push_set($1,$2)', ['court',false]));
  assert.deepEqual(await as('', () => value('select public.push_take()'), 'service_role'), []);
  await as(b, () => value('select public.set_dnd(true)'));
  await db.query("insert into public.gifts(from_user,to_user,treat,day) values ($1,$2,'cake',current_date + 1)", [a,b]);
  assert.equal(await value('select count(*)::int from private.push_queue'), 0);
  await as(b, () => value('select public.set_dnd(false)'));
  await db.query('insert into public.blocks(blocker,blocked) values ($1,$2)', [b,a]);
  await db.query("insert into public.gifts(from_user,to_user,treat,day) values ($1,$2,'cake',current_date + 2)", [a,b]);
  assert.equal(await value('select count(*)::int from private.push_queue'), 0);
});
