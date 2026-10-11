// Real connections contend on the shared account/save locks. No live service:
// freshDatabase creates and drops an isolated local PostgreSQL database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason } from './support/real-pg.mjs';
const live = available(), opts = { skip: live ? false : skipReason };
const users = Array.from({ length: 8 }, (_, i) => '52000000-0000-4000-8000-' + String(i).padStart(12, '0'));
let db;
before(async () => { if (live) db = await freshDatabase(users); });
after(async () => { if (db) await db.drop(); });
const operation = i => ({ id: '53000000-0000-4000-8000-' + String(i).padStart(12, '0'), delta: -80, earned: 0 });
const household = (owner, op) => ({ fixture: 'already-applied race purchase', mayhem: { souls: op ? 20 : 100, curios: op ? { purchased: 1 } : {} },
  coop: { ledger: { [owner]: { seq: 0 } }, money: { openings: { [owner]: { souls: 100, after: 0 } }, pending: op ? [{ ...op, owner }] : [] } } });
const push = (rev, data) => `select public.push_save(${rev}, '${JSON.stringify(data)}'::jsonb);`;
const adjust = op => `select public.coop_adjust('${JSON.stringify([op])}'::jsonb);`;
const value = async (owner, sql) => { const r = await db.as(owner, sql); assert.ok(r.ok, JSON.stringify(r)); return r.value; };

test('a stale tab racing settlement never leaves a debit without its complete household', opts, async () => {
  for (let i = 0; i < 6; i++) {
    const owner = users[i], op = operation(i);
    await value(owner, 'select public.coop_open(100,0);');
    await value(owner, push(0, household(owner, op)));
    const results = await db.race([[owner, adjust(op)], [owner, push(1, household(owner))]]);
    assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
    assert.ok(results.filter(r => !r.ok).every(r => /household_sync_required|cloud_copy_required/.test(r.error)), JSON.stringify(results));
    const wallet = await value(owner, 'select public.coop_wallet();'), remote = await value(owner, 'select public.pull_save();');
    if (wallet.balance === 20) {
      assert.equal(remote.data.mayhem.curios.purchased, 1);
      assert.equal(remote.data.coop.money.pending[0].id, op.id);
      assert.equal(remote.rev, 1);
    } else { assert.equal(wallet.balance, 100); assert.equal(remote.rev, 2); }
  }
});

test('confirmed settlement rejects stale and pre-opening saves; exact retries remain immutable', opts, async () => {
  const owner = users[6], op = operation(6);
  await value(owner, 'select public.coop_open(100,0);');
  await value(owner, push(0, household(owner, op)));
  const first = await value(owner, adjust(op));
  const results = await db.race([[owner, push(1, household(owner))], [owner, push(1, { fixture: 'backup before wallet opening' })], [owner, adjust(op)]]);
  assert.equal(results[0].ok, false); assert.match(results[0].error, /cloud_copy_required/);
  assert.equal(results[1].ok, false); assert.match(results[1].error, /cloud_copy_required/);
  assert.deepEqual(results[2].value.receipts, first.receipts);
  assert.equal((await value(owner, 'select public.pull_save();')).data.mayhem.curios.purchased, 1);
  assert.equal((await value(owner, 'select public.coop_wallet();')).balance, 20);
});
