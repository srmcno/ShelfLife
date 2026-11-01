import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PARLOUR_CARDS } from '../src/content/parlour.js';
const ids=['a','b','c'].map(x=>'00000000-0000-4000-8000-00000000000'+x), [a,b,c]=ids;
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
let db;
async function as(user,sql,args=[]) { await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); await db.exec('set role authenticated'); try {return (await db.query('select '+sql+' as result',args)).rows[0].result;} finally {await db.exec('reset role');} }
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(),email text,is_anonymous boolean not null default false,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 insert into auth.users(id) values ${ids.map(i=>`('${i}')`).join(',')};`);
 const dir=new URL('../supabase/migrations/',import.meta.url); const files=readdirSync(dir).filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort();
 for(let pass=0;pass<2;pass++) for(const file of files) await db.exec(readFileSync(new URL(file,dir),'utf8'));
 for(const u of ids) await as(u,'public.ensure_profile($1)',[u===a?'<img src=x>':'Neighbour']);
 await db.query("insert into public.friendships(requester,addressee,status) values($1,$2,'accepted')",[a,b]);
});
after(async()=>db?.close());
test('all 18 prompts and three choices are valid and content stays bounded',()=>{
 assert.equal(PARLOUR_CARDS.length,18);
 for(const card of PARLOUR_CARDS) { assert.equal(card.choices.length,3); for(const line of [card.question,...card.choices,card.same,card.different]) { assert.ok(line.length>0&&line.length<160); assert.doesNotMatch(line,/[\u2014<>]/); } }
});
test('questions stay sealed, then both players can see and dismiss the result',async()=>{
 const sent=await as(a,'public.parlour_send($1,$2,$3,$4)',[id(1),b,17,2]); assert.equal(sent.sent,true);
 assert.deepEqual(await as(a,'public.parlour_send($1,$2,$3,$4)',[id(1),b,17,2]),sent);
 await assert.rejects(as(a,'public.parlour_send($1,$2,$3,$4)',[id(1),b,17,1]),/bad_parlour/);
 const incoming=await as(b,'public.parlour_inbox()'); assert.equal(incoming.length,1); assert.equal(incoming[0].first,null); assert.equal(incoming[0].second,null);
 assert.deepEqual(await as(c,'public.parlour_inbox()'),[]); await assert.rejects(as(c,'public.parlour_reply($1,$2)',[id(1),1]),/not_found/);
 const result=await as(b,'public.parlour_reply($1,$2)',[id(1),1]); assert.deepEqual(result,{id:id(1),prompt:17,first:2,second:1});
 assert.deepEqual(await as(b,'public.parlour_reply($1,$2)',[id(1),1]),result);
 await assert.rejects(as(b,'public.parlour_reply($1,$2)',[id(1),2]),/already_answered/);
 assert.equal((await as(a,'public.parlour_inbox()'))[0].first,2); assert.equal((await as(b,'public.parlour_inbox()'))[0].second,1);
 assert.equal(await as(a,'public.parlour_seen($1)',[id(1)]),true); assert.equal(await as(b,'public.parlour_seen($1)',[id(1)]),true);
 assert.deepEqual(await as(a,'public.parlour_inbox()'),[]); assert.deepEqual(await as(b,'public.parlour_inbox()'),[]);
});
test('a committed send can be confirmed after DND and rate limit changes',async()=>{
 await db.exec('delete from private.parlour_attempts; delete from private.push_queue; delete from public.parlour_rounds');
 const sent=await as(a,'public.parlour_send($1,$2,$3,$4)',[id(900),b,3,1]);
 await db.query('insert into public.social_prefs(user_id,dnd) values($1,true) on conflict(user_id) do update set dnd=true',[b]);
 await db.query('insert into private.parlour_attempts(user_id) select $1 from generate_series(1,100)',[a]);
 assert.deepEqual(await as(a,'public.parlour_send($1,$2,$3,$4)',[id(900),b,3,1]),sent);
 await assert.rejects(as(a,'public.parlour_send($1,$2,$3,$4)',[id(900),b,3,2]),/bad_parlour/);
 await assert.rejects(as(b,'public.parlour_send($1,$2,$3,$4)',[id(900),a,3,1]),/bad_parlour/);
 assert.equal((await db.query('select count(*)::int n from public.parlour_rounds')).rows[0].n,1);
 await db.exec('delete from private.parlour_attempts; delete from public.parlour_rounds');
 await db.query('update public.social_prefs set dnd=false where user_id=$1',[b]);
});
test('validation, privacy, DND and unfriend remove the round',async()=>{
 await assert.rejects(as(a,'public.parlour_send($1,$2,$3,$4)',[id(2),b,18,0]),/bad_parlour/);
 await assert.rejects(as(a,'public.parlour_send($1,$2,$3,$4)',[id(2),c,0,0]),/not_friends/);
 await db.query('insert into public.social_prefs(user_id,dnd) values($1,true) on conflict(user_id) do update set dnd=true',[b]);
 await assert.rejects(as(a,'public.parlour_send($1,$2,$3,$4)',[id(2),b,0,0]),/dnd/);
 await db.query('update public.social_prefs set dnd=false where user_id=$1',[b]);
 await db.query('update public.parlour_rounds set created_at=now()-interval \'2 days\' where id=$1',[id(1)]);
 await as(a,'public.parlour_send($1,$2,$3,$4)',[id(2),b,0,0]);
 await as(b,'public.block_user($1)',[a]); assert.deepEqual(await as(b,'public.parlour_inbox()'),[]);
 assert.equal((await db.query('select count(*)::int n from public.parlour_rounds')).rows[0].n,0);
});
test('all cards and choices pass server validation and no table reads are granted',async()=>{
 await db.exec('delete from public.blocks; delete from private.parlour_attempts; delete from public.parlour_rounds;');
 await db.query("insert into public.friendships(requester,addressee,status) values($1,$2,'accepted') on conflict do nothing",[a,b]);
 for(let n=0;n<18;n++) for(let pick=0;pick<3;pick++) {
   assert.equal((await as(a,'public.parlour_send($1,$2,$3,$4)',[id(100+n*3+pick),b,n,pick])).sent,true);
   await db.exec('delete from public.parlour_rounds');
 }
 const perm=(await db.query("select relrowsecurity,has_table_privilege('authenticated',oid,'select') as readable from pg_class where oid='public.parlour_rounds'::regclass")).rows[0];
 assert.equal(perm.relrowsecurity,true); assert.equal(perm.readable,false);
});
test('push alerts go to the player receiving each step, in the games group',async()=>{
 await db.exec('delete from private.parlour_attempts; delete from private.push_queue; delete from public.parlour_rounds;');
 for(const u of [a,b]) await as(u,'public.push_subscribe($1,$2,$3)',['https://fcm.googleapis.com/test-'+u,'B'+'a'.repeat(86),'a'.repeat(22)]);
 await as(a,'public.parlour_send($1,$2,$3,$4)',[id(200),b,1,2]);
 await as(b,'public.parlour_reply($1,$2)',[id(200),0]);
 const q=(await db.query('select actor,recipient,event_group from private.push_queue order by id')).rows;
 assert.deepEqual(q,[{actor:a,recipient:b,event_group:'games'},{actor:b,recipient:a,event_group:'games'}]);
});
test('the per-friend wait lifts, expired questions stay hidden, and calls are rate limited',async()=>{
 await db.exec('delete from private.push_queue; delete from private.parlour_attempts; delete from public.parlour_rounds;');
 await as(a,'public.parlour_send($1,$2,$3,$4)',[id(300),b,0,0]);
 await assert.rejects(as(a,'public.parlour_send($1,$2,$3,$4)',[id(301),b,1,1]),/parlour_wait/);
 await db.query("update public.parlour_rounds set created_at=now()-interval '15 days' where id=$1",[id(300)]);
 assert.deepEqual(await as(b,'public.parlour_inbox()'),[]);
 await assert.rejects(as(b,'public.parlour_reply($1,$2)',[id(300),0]),/not_found/);
 await db.query("update public.parlour_rounds set created_at=now()-interval '31 days' where id=$1",[id(300)]);
 await as(a,'public.parlour_send($1,$2,$3,$4)',[id(301),b,1,1]);
 assert.equal((await db.query('select count(*)::int n from public.parlour_rounds where id=$1',[id(300)])).rows[0].n,0);
 await db.exec('delete from private.parlour_attempts;');
 await db.query('insert into private.parlour_attempts(user_id) select $1 from generate_series(1,100)',[c]);
 await assert.rejects(as(c,'public.parlour_seen($1)',[id(301)]),/rate_limited/);
});
test('a player can decline and the sender gets an acknowledgement without revealing a choice',async()=>{
 await db.exec('delete from private.parlour_attempts; delete from private.push_queue; delete from public.parlour_rounds;');
 await as(a,'public.parlour_send($1,$2,$3,$4)',[id(400),b,8,1]);
 assert.equal(await as(b,'public.parlour_decline($1)',[id(400)]),true);
 assert.equal(await as(b,'public.parlour_decline($1)',[id(400)]),true);
 assert.deepEqual(await as(b,'public.parlour_inbox()'),[]);
 const sender=await as(a,'public.parlour_inbox()'); assert.equal(sender.length,1); assert.equal(sender[0].declined,true); assert.equal(sender[0].first,null);
 await assert.rejects(as(b,'public.parlour_reply($1,$2)',[id(400),1]),/already_answered/);
 assert.equal(await as(a,'public.parlour_seen($1)',[id(400)]),true); assert.deepEqual(await as(a,'public.parlour_inbox()'),[]);
 assert.equal((await db.query('select count(*)::int n from private.push_queue where recipient=$1 and event_group=\'games\'',[a])).rows[0].n,1);
});
