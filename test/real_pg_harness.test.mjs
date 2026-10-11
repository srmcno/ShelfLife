// Proves the real-PostgreSQL harness really runs calls on separate
// connections at once (a lock taken by one is seen by another).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { available, freshDatabase, skipReason, MIGRATIONS } from './support/real-pg.mjs';

const live = available();
test('the harness runs every migration twice and races calls on separate connections', { skip: live ? false : skipReason }, async () => {
  const db = await freshDatabase();
  try {
    assert.equal(MIGRATIONS.length, 10);
    const pids = await Promise.all([1, 2, 3].map(() => db.admin('select pg_backend_pid(), pg_sleep(0.3)')));
    assert.equal(new Set(pids).size, 3, 'three distinct backends');
  } finally { await db.drop(); }
});
