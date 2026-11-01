import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';
const user='00000000-0000-4000-8000-000000000001';
test('concurrent Gazette retries with one key create exactly one event', {skip:available() ? false : skipReason}, async () => {
  const db=await freshDatabase([user]);
  try {
    const sql="select public.gazette_post('[{\"key\":\"10000000-0000-4000-8000-000000000001\",\"kind\":\"adopted\",\"data\":{\"resident\":\"mabel\"},\"generation\":0}]'::jsonb);";
    const results=await db.race(Array.from({length:6},()=>[user,sql]));
    assert.ok(results.every(r=>r.ok));
    assert.equal(results.reduce((n,r)=>n+r.value.posted,0),1);
    assert.equal(await db.admin('select count(*) from public.gazette_events;'),'1');
  } finally { await db.drop(); }
});
test('sharing changes and queued posts serialize across real connections', {skip:available() ? false : skipReason}, async () => {
  const db=await freshDatabase([user]);
  try {
    const old="select public.gazette_post('[{\"key\":\"10000000-0000-4000-8000-000000000002\",\"kind\":\"adopted\",\"data\":{\"resident\":\"offline\"},\"generation\":0}]'::jsonb);";
    const raced=await db.race([[user,old],[user,'select public.gazette_set_sharing(false);']]);
    assert.ok(raced.every(r=>r.ok));
    assert.equal((await db.as(user,'select public.gazette_set_sharing(true);')).value.generation,2);
    const before=await db.admin('select count(*) from public.gazette_events;');
    const retry=await db.as(user,old);
    assert.equal(retry.value.stale,true);
    assert.equal(await db.admin('select count(*) from public.gazette_events;'),before);
  } finally { await db.drop(); }
});
