import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverBatches } from '../supabase/functions/push/delivery.mjs';
const batch = (id, n) => ({ user_id: id, lease: 'lease-' + id, subscriptions: Array.from({ length: n }, (_, i) => ({ endpoint: id + '-' + i })) });
test('delivery bounds concurrent users and tracks partial success', async () => {
  let active = 0, peak = 0; const reports = [];
  await deliverBatches([batch('a', 3), batch('b', 3), batch('c', 3), batch('d', 3)], async (_, sub) => {
    active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return sub.endpoint.endsWith('-0') ? 'sent' : sub.endpoint.endsWith('-1') ? 'dead' : 'retry';
  }, async result => reports.push(result));
  assert.equal(peak, 4); assert.equal(reports.length, 4);
  for (const r of reports) { assert.equal(r.p_ok, false); assert.deepEqual(r.p_sent, [r.p_user + '-0']); assert.deepEqual(r.p_dead, [r.p_user + '-1']); }
  await assert.rejects(deliverBatches(Array.from({ length: 5 }, (_, i) => batch(String(i), 1)), () => {}, () => {}), /Invalid push batch/);
});
test('deadline marks unsent subscriptions for later retry', async () => {
  let time = 0, calls = 0, result;
  await deliverBatches([batch('a', 5)], async () => { calls++; time += 6000; return 'sent'; }, async r => { result = r; }, { now: () => time, deadline: 14000, minimumBudget: 7000 });
  assert.equal(calls, 2); assert.equal(result.p_ok, false); assert.equal(result.p_sent.length, 2);
});
