// Run with SHELF_PG to check the subscription cap under real concurrent connections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, skipReason, freshDatabase } from './support/real-pg.mjs';
const user = '00000000-0000-4000-8000-000000000001';
test('parallel subscriptions cannot exceed five per account', { skip: !available() && skipReason, timeout: 120000 }, async () => {
  const db = await freshDatabase([user]);
  try {
    const key = 'B' + 'a'.repeat(86), auth = 'a'.repeat(22);
    const calls = Array.from({ length: 10 }, (_, i) => [user, `select public.push_subscribe('https://fcm.googleapis.com/test-${i}','${key}','${auth}');`]);
    const outcomes = await db.race(calls);
    assert.equal(outcomes.filter(r => r.ok).length, 5);
    assert.ok(outcomes.filter(r => !r.ok).every(r => /too_many_subscriptions/.test(r.error)));
    assert.equal(await db.admin('select count(*) from public.push_subscriptions;'), '5');
  } finally { await db.drop(); }
});

test('one endpoint cannot be claimed by two accounts concurrently', { skip: !available() && skipReason, timeout: 120000 }, async () => {
  const other = '00000000-0000-4000-8000-000000000002';
  const db = await freshDatabase([user, other]);
  try {
    const key = 'B' + 'a'.repeat(86), auth = 'a'.repeat(22);
    const statement = `select public.push_subscribe('https://fcm.googleapis.com/shared','${key}','${auth}');`;
    const outcomes = await db.race([[user, statement], [other, statement]]);
    assert.equal(outcomes.filter(r => r.ok).length, 1);
    assert.match(outcomes.find(r => !r.ok).error, /subscription_in_use/);
    assert.equal(await db.admin('select count(*) from public.push_subscriptions;'), '1');
  } finally { await db.drop(); }
});
