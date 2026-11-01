import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const read = n => readFileSync(new URL('../supabase/migrations/' + n, import.meta.url), 'utf8');
const ids = ['a','b','c'].map(x => '00000000-0000-4000-8000-00000000000' + x);
const [a,b,c] = ids;
let db;
async function as(id, sql, params = []) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('set role authenticated');
  try { return (await db.query('select ' + sql + ' as result', params)).rows[0].result; }
  finally { await db.exec('reset role'); }
}
const event = (key, kind = 'adopted', data = { resident: 'mabel' }, generation = 0) => ({ key, kind, data, generation });
const key = n => '10000000-0000-4000-8000-' + String(n).padStart(12,'0');
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
    insert into auth.users(id) values ${ids.map(id => `('${id}')`).join(',')};`);
  for (let i=0;i<2;i++) for (const n of ['0001_accounts_and_saves.sql','0002_social.sql','0011_gazette.sql']) await db.exec(read(n));
  for (const id of ids) await as(id,'public.ensure_profile($1)',[id === a ? '<hostile>' : 'Player']);
  await db.query("insert into public.friendships(requester,addressee,status) values($1,$2,'accepted')",[a,b]);
});
after(async () => db?.close());
test('tables are private, migrations repeat, and strangers cannot see or react', async () => {
  for (const table of ['gazette_events','gazette_reactions']) {
    const row = (await db.query("select relrowsecurity, has_table_privilege('authenticated',oid,'select') as can_read from pg_class where oid = $1::regclass",['public.' + table])).rows[0];
    assert.equal(row.relrowsecurity,true); assert.equal(row.can_read,false);
  }
  assert.deepEqual(await as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([event(key(1))])]),{ posted:1, sharing:true, generation:0, stale:false });
  const feed = await as(b,'public.gazette_feed()'); assert.equal(feed.events.length,1); assert.equal(feed.events[0].name,'<hostile>');
  assert.deepEqual((await as(c,'public.gazette_feed()')).events,[]);
  await assert.rejects(as(c,'public.gazette_react($1,$2)',[feed.events[0].id,'skull']),/not_found/);
});
test('idempotency, validation, reactions and sharing', async () => {
  assert.equal((await as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([event(key(1))])])).posted,0);
  for (const e of [event(key(2),'arcade_best',{game:'stack',score:501}),event(key(3),'adopted',{resident:'<script>'}),event(key(4),'unknown',{}),event(key(5),'adopted',{resident:'mabel',extra:'x'})])
    await assert.rejects(as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([e])]),/bad_events/);
  const id = (await as(b,'public.gazette_feed()')).events[0].id;
  await as(b,'public.gazette_react($1,$2)',[id,'skull']);
  assert.equal((await as(a,'public.gazette_feed()')).events[0].counts.skull,1);
  await as(b,'public.gazette_react($1,$2)',[id,'moth']);
  assert.equal((await as(b,'public.gazette_feed()')).events[0].my_reaction,'moth');
  await as(b,'public.gazette_react($1,$2)',[id,null]);
  assert.equal((await as(b,'public.gazette_feed()')).events[0].my_reaction,null);
  await as(a,'public.gazette_set_sharing($1)',[false]);
  assert.deepEqual(await as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([event(key(6))])]),{posted:0,sharing:false,generation:1,stale:true});
  assert.deepEqual((await as(b,'public.gazette_feed()')).events,[], 'switching sharing off hides earlier news from friends');
  assert.equal((await as(a,'public.gazette_feed()')).events.length,1, 'the owner retains their own news');
  await assert.rejects(as(b,'public.gazette_react($1,$2)',[id,'moth']),/not_found/);
  await as(a,'public.gazette_set_sharing($1)',[true]);
});
test('an offline device cannot upload events from before a sharing change', async () => {
  assert.deepEqual(await as(a,'public.gazette_status()'),{sharing:true,generation:2});
  const stale=event(key(7),'adopted',{resident:'private-during-offline'},0);
  assert.deepEqual(await as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([stale])]),{posted:0,sharing:true,generation:2,stale:true});
  const fresh=event(key(8),'adopted',{resident:'after-reconnect'},2);
  assert.equal((await as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([fresh,stale])])).stale,true,'mixed generations are rejected atomically');
  assert.equal((await as(a,'public.gazette_feed()')).events.length,1);
  assert.equal((await as(a,'public.gazette_post($1::jsonb)',[JSON.stringify([fresh])])).posted,1);
  await db.query('delete from public.gazette_events where event_key=$1',[key(8)]);
});
test('unread, block, retention and rate limit', async () => {
  assert.equal(await as(b,'public.gazette_unread()'),1);
  await as(b,'public.gazette_seen()'); assert.equal(await as(b,'public.gazette_unread()'),0);
  await db.query("insert into public.blocks(blocker,blocked) values($1,$2)",[b,a]);
  assert.deepEqual((await as(b,'public.gazette_feed()')).events,[]);
  await db.query('delete from public.blocks');
  await db.exec("update public.gazette_events set created_at=now()-interval '31 days'");
  assert.deepEqual((await as(a,'public.gazette_feed()')).events,[]);
  assert.equal((await db.query('select count(*)::int n from public.gazette_events')).rows[0].n,0);
  await db.query('insert into private.gazette_requests(user_id) select $1 from generate_series(1,300)',[c]);
  await assert.rejects(as(c,'public.gazette_set_sharing($1)',[false]),/rate_limited/);
});
