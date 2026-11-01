import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';
const live=available();
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';

test('listing removal and requests serialize across database connections', {skip:live?false:skipReason}, async()=>{
  const db=await freshDatabase([a,b]);
  try {
    await db.as(a,"select public.ensure_profile('Ada')");
    await db.as(b,"select public.ensure_profile('Bea')");
    assert.equal((await db.as(b,'select public.discovery_set(true)')).ok,true);
    const results=await db.race([[a,`select public.discovery_request('${b}')`],[b,'select public.discovery_set(false)']]);
    assert.ok(results.every(x=>x.ok));
    assert.equal(results[1].value.listed,false);
    const after=await db.as(a,`select public.discovery_request('${b}')`);
    assert.deepEqual(after.value,{ok:false,error:'not_found'});
    const count=Number(await db.admin(`select count(*) from public.friendships where requester='${a}' and addressee='${b}'`));
    assert.ok(count===0 || count===1);
  } finally { await db.drop(); }
});

test('parallel requests create at most one friendship', {skip:live?false:skipReason}, async()=>{
  const db=await freshDatabase([a,b]);
  try {
    await db.as(a,"select public.ensure_profile('Ada')"); await db.as(b,"select public.ensure_profile('Bea')");
    await db.as(b,'select public.discovery_set(true)');
    const results=await db.race(Array.from({length:5},()=>[a,`select public.discovery_request('${b}')`]));
    assert.ok(results.every(x=>x.ok)); assert.equal(results.filter(x=>x.value.ok).length,1);
    assert.equal(Number(await db.admin('select count(*) from public.friendships')),1);
  } finally { await db.drop(); }
});

test('parallel area changes allow only one new shared area', {skip:live?false:skipReason}, async()=>{
  const db=await freshDatabase([a]);
  try {
    await db.as(a,"select public.ensure_profile('Ada')");
    await db.as(a,'select public.discovery_set(true)');
    const results=await db.race([[a,'select public.discovery_location_set(131,140)'],[a,'select public.discovery_location_set(131,141)']]);
    assert.equal(results.filter(x=>x.ok && x.value.nearby).length,1);
    assert.equal(results.filter(x=>!x.ok && x.error.includes('location_cooldown')).length,1);
    assert.equal(Number(await db.admin('select count(*) from private.discovery_areas')),1);
    assert.equal(Number(await db.admin('select count(*) from private.discovery_area_changes')),1);
  } finally { await db.drop(); }
});

async function waitFor(db, sql) {
  for (let i=0;i<100;i++) {
    if (await db.admin(sql) === '1') return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error('Timed out waiting for the expected database lock state');
}

for (const method of ['code','directory']) for (const first of ['block','request']) {
  test(`${method} request and block serialize when ${first} starts first`, {skip:live?false:skipReason}, async()=>{
    const db=await freshDatabase([a,b]);
    try {
      await db.as(a,"select public.ensure_profile('Ada')");
      await db.as(b,"select public.ensure_profile('Bea')");
      await db.as(b,'select public.discovery_set(true)');
      const code=await db.admin(`select friend_code from public.profiles where user_id='${b}'`);
      const request=method==='code' ? `select public.add_friend('${code}')` : `select public.discovery_request('${b}')`;
      const block=`select public.block_user('${a}')`;
      const owner=first==='block' ? [b,block] : [a,request];
      const waiter=first==='block' ? [a,request] : [b,block];
      const holding=db.as(owner[0],`set application_name='pair_lock_holder'; begin; ${owner[1]}; select pg_sleep(3); commit;`);
      await waitFor(db,"select count(*) from pg_stat_activity where application_name='pair_lock_holder' and wait_event='PgSleep'");
      const waiting=db.as(waiter[0],`set application_name='pair_lock_waiter'; ${waiter[1]};`);
      await waitFor(db,"select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='pair_lock_waiter' and l.locktype='advisory' and not l.granted");
      const [held, waited]=await Promise.all([holding,waiting]);
      assert.ok(held.ok,held.error); assert.ok(waited.ok,waited.error);
      if (first==='block') assert.equal(waited.value.ok,false);
      else assert.equal(held.value.status,'pending');
      assert.equal(Number(await db.admin('select count(*) from public.blocks')),1);
      assert.equal(Number(await db.admin('select count(*) from public.friendships')),0);
      assert.equal(Number(await db.admin('select count(*) from private.discovery_requests')),0);
    } finally { await db.drop(); }
  });
}
