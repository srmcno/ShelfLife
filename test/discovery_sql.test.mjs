import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ids = ['a','b','c','d'].map(x => '00000000-0000-4000-8000-00000000000' + x);
const [a,b,c,d] = ids;
let db;
async function as(id, sql, params=[]) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try { return (await db.query('select ' + sql + ' as result',params)).rows[0].result; }
  finally { await db.exec('reset role'); }
}
before(async () => {
  db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
    insert into auth.users(id) values ${ids.map(id=>`('${id}')`).join(',')};`);
  for (let i=0;i<2;i++) for (const name of ['0001_accounts_and_saves.sql','0002_social.sql','0003_postbox_visits.sql','0013_discovery.sql']) await db.exec(read(name));
  for (const [id,name] of [[a,'Ada'],[b,'<img src=x onerror=y>'],[c,'Cam'],[d,'']]) await as(id,'public.ensure_profile($1)',[name]);
});
after(async()=>db?.close());

test('private by default, authenticated functions only, and names require opt-in',async()=>{
  assert.deepEqual(await as(b,'public.discovery_status()'),{listed:false,nearby:false});
  assert.deepEqual((await as(a,'public.discovery_find()')).players,[]);
  for (const table of ['discovery_preferences','discovery_attempts','discovery_requests']) {
    const row=(await db.query("select relrowsecurity, has_table_privilege('authenticated',oid,'select') access from pg_class where oid=$1::regclass",['private.'+table])).rows[0];
    assert.equal(row.relrowsecurity,true); assert.equal(row.access,false);
  }
  assert.equal((await db.query("select has_function_privilege('anon','public.discovery_find(text,integer)','execute') allowed")).rows[0].allowed,false);
  await assert.rejects(as(d,'public.discovery_set($1)',[true]),/name_required/);
  assert.deepEqual(await as(b,'public.discovery_set($1)',[true]),{listed:true});
  const players=(await as(a,'public.discovery_find()')).players;
  assert.deepEqual(players,[{user_id:b,display_name:'<img src=x onerror=y>'}]);
  assert.deepEqual(Object.keys(players[0]).sort(),['display_name','user_id']);
});

test('opt-out and blocks immediately prevent lookup and requests',async()=>{
  await as(b,'public.discovery_set($1)',[false]);
  const changed=(await db.query('select changed_at from private.discovery_preferences where user_id=$1',[b])).rows[0].changed_at;
  await as(b,'public.discovery_set($1)',[false]);
  assert.deepEqual((await db.query('select changed_at from private.discovery_preferences where user_id=$1',[b])).rows[0].changed_at,changed);
  await as(d,'public.discovery_set($1)',[false]);
  assert.equal((await db.query('select count(*)::int n from private.discovery_preferences where user_id=$1',[d])).rows[0].n,0);
  assert.deepEqual((await as(a,'public.discovery_find()')).players,[]);
  assert.deepEqual(await as(a,'public.discovery_request($1)',[b]),{ok:false,error:'not_found'});
  await as(b,'public.discovery_set($1)',[true]);
  await db.query('insert into public.blocks(blocker,blocked) values($1,$2)',[b,a]);
  assert.deepEqual((await as(a,'public.discovery_find()')).players,[]);
  assert.deepEqual(await as(a,'public.discovery_request($1)',[b]),{ok:false,error:'not_found'});
  await db.query('delete from public.blocks');
});

test('a directory request uses the existing friend acceptance flow without disclosing codes',async()=>{
  assert.deepEqual(await as(a,'public.discovery_request($1)',[b]),{ok:true,status:'pending',error:null});
  assert.deepEqual((await as(a,'public.discovery_find()')).players,[]);
  assert.equal((await db.query('select status from public.friendships where requester=$1 and addressee=$2',[a,b])).rows[0].status,'pending');
  const outgoing=(await as(a,'public.list_friends()'))[0], incoming=(await as(b,'public.list_friends()'))[0];
  assert.equal(outgoing.friend_code,''); assert.equal(incoming.friend_code,'');
  assert.equal(outgoing.display_name,'<img src=x onerror=y>'); assert.equal(outgoing.directory_request,true);
  assert.equal((await as(b,'public.respond_friend($1,$2)',[a,true])).status,'accepted');
  assert.ok((await as(a,'public.list_friends()'))[0].friend_code, 'accepting releases the friend code');
  assert.deepEqual(await as(a,'public.discovery_request($1)',[b]),{ok:false,status:null,error:'already_friends'});
});

test('blocking removes requests and prevents code and directory requests in either direction',async()=>{
  await as(a,'public.remove_friend($1)',[b]);
  const codeA=(await db.query('select friend_code from public.profiles where user_id=$1',[a])).rows[0].friend_code;
  const codeB=(await db.query('select friend_code from public.profiles where user_id=$1',[b])).rows[0].friend_code;
  assert.equal((await as(a,'public.add_friend($1)',[codeB])).status,'pending');
  assert.equal((await as(b,'public.block_user($1)',[a])).ok,true);
  assert.equal((await db.query('select count(*)::int n from public.friendships')).rows[0].n,0);
  assert.equal((await as(a,'public.add_friend($1)',[codeB])).error,'not_found');
  assert.equal((await as(b,'public.add_friend($1)',[codeA])).error,'blocked');
  assert.deepEqual(await as(a,'public.discovery_request($1)',[b]),{ok:false,error:'not_found'});
  await db.query('delete from public.blocks where blocker=$1 and blocked=$2',[b,a]);
  assert.equal((await as(a,'public.discovery_request($1)',[b])).status,'pending');
  await as(a,'public.block_user($1)',[b]);
  assert.equal((await db.query('select count(*)::int n from public.friendships')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from private.discovery_requests')).rows[0].n,0);
  assert.equal((await as(b,'public.add_friend($1)',[codeA])).error,'not_found');
  await db.query('delete from public.blocks where blocker=$1 and blocked=$2',[a,b]);
  assert.equal((await db.query("select has_function_privilege('authenticated','private.friend_pair_lock(uuid,uuid)','execute') allowed")).rows[0].allowed,false);
});

test('nearby areas are optional, private, validated, and removed with listing',async()=>{
  for (const args of [[-1,0],[180,0],[90,-1],[90,360],[90,null],[null,1]]) {
    await assert.rejects(as(a,'public.discovery_location_set($1,$2)',args),/bad_discovery/);
  }
  await assert.rejects(as(a,'public.discovery_location_set($1,$2)',[131,140]),/listing_required/);
  await as(a,'public.discovery_set($1)',[true]);
  await as(c,'public.discovery_set($1)',[true]);
  await as(a,'public.discovery_location_set($1,$2)',[131,140]);
  await as(b,'public.discovery_location_set($1,$2)',[131,140]);
  await as(c,'public.discovery_location_set($1,$2)',[131,141]);
  const players=(await as(a,'public.discovery_nearby()')).players;
  assert.deepEqual(players.map(x=>x.display_name),['<img src=x onerror=y>','Cam']);
  assert.deepEqual(Object.keys(players[0]).sort(),['display_name','distance_band','user_id']);
  assert.equal(players[0].distance_band,'local');
  await as(b,'public.set_display_name($1)',['Zulu']);
  await as(c,'public.set_display_name($1)',['Alpha']);
  const sorted=(await as(a,'public.discovery_nearby()')).players;
  assert.deepEqual(sorted.map(x=>x.display_name),['Alpha','Zulu'], 'results within a band are alphabetical, not ordered by exact distance');
  assert.deepEqual(sorted.map(x=>x.distance_band),['local','local']);
  await as(b,'public.set_display_name($1)',['<img src=x onerror=y>']);
  await as(c,'public.set_display_name($1)',['Cam']);
  assert.equal((await db.query("select has_table_privilege('authenticated','private.discovery_areas','select') allowed")).rows[0].allowed,false);
  await as(c,'public.block_user($1)',[a]);
  assert.equal((await as(a,'public.discovery_nearby()')).players.some(x=>x.user_id===c),false);
  await db.query('delete from public.blocks where blocker=$1 and blocked=$2',[c,a]);
  await as(b,'public.discovery_location_set($1,$2)',[null,null]);
  assert.equal((await as(a,'public.discovery_nearby()')).players.some(x=>x.user_id===b),false);
  await as(a,'public.discovery_set($1)',[false]);
  assert.deepEqual(await as(a,'public.discovery_status()'),{listed:false,nearby:false});
  assert.equal((await db.query('select count(*)::int n from private.discovery_areas where user_id=$1',[a])).rows[0].n,0);
  await assert.rejects(as(a,'public.discovery_nearby()'),/location_required/);
  await as(c,'public.discovery_set($1)',[false]);
});

test('area changes have a persistent cooldown, but removal is always immediate',async()=>{
  const id='20000000-0000-4000-8000-000000000001';
  await db.query('insert into auth.users(id) values($1)',[id]);
  await as(id,'public.ensure_profile($1)',['Drew']);
  await as(id,'public.discovery_set($1)',[true]);
  await as(id,'public.discovery_location_set($1,$2)',[131,140]);
  assert.deepEqual(await as(id,'public.discovery_location_set($1,$2)',[131,140]),{nearby:true});
  for (let i=0;i<3;i++) await assert.rejects(as(id,'public.discovery_location_set($1,$2)',[131,141]),/location_cooldown/);
  assert.deepEqual(await as(id,'public.discovery_location_set($1,$2)',[null,null]),{nearby:false});
  assert.equal((await db.query('select count(*)::int n from private.discovery_areas where user_id=$1',[id])).rows[0].n,0);
  await assert.rejects(as(id,'public.discovery_location_set($1,$2)',[131,140]),/location_cooldown/);
  await as(id,'public.discovery_set($1)',[false]);
  await as(id,'public.discovery_set($1)',[true]);
  await assert.rejects(as(id,'public.discovery_location_set($1,$2)',[131,141]),/location_cooldown/);
  assert.equal((await db.query("select has_table_privilege('authenticated','private.discovery_area_changes','select') allowed")).rows[0].allowed,false);
  assert.deepEqual((await db.query("select column_name from information_schema.columns where table_schema='private' and table_name='discovery_area_changes' order by ordinal_position")).rows.map(x=>x.column_name),['user_id','last_shared_at']);
  await db.query("update private.discovery_area_changes set last_shared_at=now()-interval '24 hours' where user_id=$1",[id]);
  assert.deepEqual(await as(id,'public.discovery_location_set($1,$2)',[131,141]),{nearby:true});
  await db.query("insert into private.discovery_attempts(user_id,kind) select $1,'setting' from generate_series(1,30)",[id]);
  assert.deepEqual(await as(id,'public.discovery_location_set($1,$2)',[null,null]),{nearby:false});
  assert.deepEqual(await as(id,'public.discovery_set($1)',[false]),{listed:false});
  await db.query('delete from auth.users where id=$1',[id]);
  assert.equal((await db.query('select count(*)::int n from private.discovery_area_changes where user_id=$1',[id])).rows[0].n,0);
});

test('search is bounded, paged, validated and rate-limited',async()=>{
  for(let i=0;i<25;i++) {
    const id='10000000-0000-4000-8000-'+String(i).padStart(12,'0');
    await db.query('insert into auth.users(id) values($1)',[id]);
    await as(id,'public.ensure_profile($1)',['Neighbour '+String(i).padStart(2,'0')]);
    await as(id,'public.discovery_set($1)',[true]);
  }
  const first=(await as(c,'public.discovery_find($1,$2)',['Neighbour',0])).players;
  const second=(await as(c,'public.discovery_find($1,$2)',['Neighbour',20])).players;
  assert.equal(first.length,21); assert.equal(second.length,5);
  assert.equal(new Set([...first.slice(0,20),...second].map(x=>x.user_id)).size,25);
  assert.equal((await as(c,'public.discovery_find($1,$2)',['bour 03',0])).players.length,1);
  for(const args of [['x'.repeat(25),0],['',-1],['',1001],['bad\nname',0]]) await assert.rejects(as(c,'public.discovery_find($1,$2)',args),/bad_discovery/);
  await db.query("insert into private.discovery_attempts(user_id,kind) select $1,'search' from generate_series(1,120)",[d]);
  await assert.rejects(as(d,'public.discovery_find()'),/rate_limited/);
});
