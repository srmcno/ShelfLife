import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloud } from '../src/cloud/client.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
const memory=()=>{const map=new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const id='10000000-0000-4000-8000-000000000001';
test('successful friend and joint court calls report their stable hearing IDs once to listeners',async()=>{
  const fake=createFakeSupabase();
  const cloud=createCloud({config:fake.config,storage:memory(),fetch:async(url,options)=>url.includes('/rpc/rule_summons') || url.includes('/rpc/rule_hearing') || url.includes('/rpc/open_hearing')
    ? new Response(JSON.stringify({id,ok:true}),{status:200,headers:{'content-type':'application/json'}}) : fake.fetch(url,options)});
  await cloud.signInAnonymously(); const events=[]; const unsubscribe=cloud.subscribeRpc(e=>events.push(e));
  await cloud.rpc('rule_summons',{p_id:id}); await cloud.rpc('rule_hearing',{p_id:id}); await cloud.rpc('open_hearing',{});
  assert.deepEqual(events.map(e=>[e.name,e.id,e.userId]),['rule_summons','rule_hearing','open_hearing'].map(name=>[name,id,cloud.userId()]));
  unsubscribe(); await cloud.rpc('rule_summons',{p_id:id}); assert.equal(events.length,3);
});
test('a court response from a replaced account cannot create Gazette news',async()=>{
  const fake=createFakeSupabase(); let release, entered;
  const gate=new Promise(resolve=>{release=resolve;}), started=new Promise(resolve=>{entered=resolve;});
  const cloud=createCloud({config:fake.config,storage:memory(),fetch:async(url,options)=>{
    if(url.endsWith('/rule_summons')){entered(); await gate; return new Response(JSON.stringify({id,ok:true}),{status:200,headers:{'content-type':'application/json'}});}
    return fake.fetch(url,options);
  }});
  await cloud.signInAnonymously(); const events=[]; cloud.subscribeRpc(e=>events.push(e));
  const pending=cloud.rpc('rule_summons',{p_id:id}).catch(e=>e); await started; await cloud.signOut(); await cloud.signInAnonymously(); release();
  assert.equal((await pending).code,'session_changed'); assert.deepEqual(events,[]);
});
