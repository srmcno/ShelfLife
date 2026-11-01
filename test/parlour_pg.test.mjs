import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, skipReason, freshDatabase } from './support/real-pg.mjs';
const [a,b]=['1','2'].map(x=>'00000000-0000-4000-8000-00000000000'+x);
const id='10000000-0000-4000-8000-000000000001';
async function setup() {
 const db=await freshDatabase([a,b]);
 await db.admin(`insert into public.friendships(requester,addressee,status) values('${a}','${b}','accepted');`);
 const k='B'+'a'.repeat(86), auth='a'.repeat(22);
 for(const u of [a,b]) { const r=await db.as(u,`select public.push_subscribe('https://fcm.googleapis.com/test-${u}','${k}','${auth}');`); assert.equal(r.ok,true); }
 return db;
}
test('concurrent retries create one invitation and one reply notification',{skip:!available()&&skipReason,timeout:120000},async()=>{
 const db=await setup(); try {
  let calls=Array.from({length:8},()=>[a,`select public.parlour_send('${id}','${b}',2,1);`]);
  let result=await db.race(calls); assert.equal(result.filter(x=>x.ok).length,8);
  assert.equal(await db.admin('select count(*) from public.parlour_rounds;'),'1');
  calls=Array.from({length:8},()=>[b,`select public.parlour_reply('${id}',2);`]);
  result=await db.race(calls); assert.equal(result.filter(x=>x.ok).length,8);
  const rows=JSON.parse(await db.admin("select json_agg(json_build_object('actor',actor,'recipient',recipient,'group',event_group) order by id) from private.push_queue;"));
  assert.deepEqual(rows,[{actor:a,recipient:b,group:'games'},{actor:b,recipient:a,group:'games'}]);
 } finally { await db.drop(); }
});
test('blocking or unfriending racing a game never leaks a queued alert',{skip:!available()&&skipReason,timeout:120000},async()=>{
 for(const action of ['block_user','remove_friend']) {
  const db=await setup(); try {
   if(action==='remove_friend') assert.equal((await db.as(a,`select public.parlour_send('${id}','${b}',2,1);`)).ok,true);
   const play=action==='remove_friend'?[b,`select public.parlour_reply('${id}',2);`]:[a,`select public.parlour_send('${id}','${b}',2,1);`];
   const outcomes=await db.race([play,[a,`select public.${action}('${b}');`]]);
   assert.ok(outcomes.every(x=>x.ok || /not_friends|not_found|dnd/.test(x.error)),JSON.stringify(outcomes));
   assert.equal(await db.admin('select count(*) from public.parlour_rounds;'),'0');
   assert.deepEqual(JSON.parse(await db.admin('select private.push_take();')),[]);
  } finally {await db.drop();}
 }
});
