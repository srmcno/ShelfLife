// Trusted household checkpoints, using all migrations twice on isolated
// PGlite. JSON below is a labelled financial-only fixture, not a playable UI.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { currencyId } from './support/fake-coop.mjs';

const DIR = new URL('../supabase/migrations/', import.meta.url);
const [A, B] = ['00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2'];
const OP = '51000000-0000-4000-8000-000000000001';
const op = { id: OP, delta: -80, earned: 0 };
const body = (owner, pending = [], seq = 0) => ({ fixture: 'already-applied purchase', mayhem: { souls: pending.length ? 20 : 100, curios: pending.length ? { purchased: 1 } : {} },
  coop: { ledger: { [owner]: { seq } }, money: { openings: { [owner]: { souls: 100, after: 0 } }, pending: pending.map(p => ({ ...p, owner })) } } });
let db;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, is_anonymous boolean default false, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    insert into auth.users(id) values('${A}'),('${B}');`);
  for (let i = 0; i < 2; i++) for (const file of readdirSync(DIR).filter(f => /^\d{4}.*\.sql$/.test(f)).sort()) await db.exec(readFileSync(new URL(file, DIR), 'utf8'));
});
after(async () => { if (db) await db.close(); });
async function call(owner, sql, params = []) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]); await db.exec('set role authenticated');
  try { return Object.values((await db.query('select ' + sql, params)).rows[0])[0]; }
  finally { await db.exec('reset role'); }
}
const push = (owner, rev, data) => call(owner, 'public.push_save($1,$2::jsonb)', [rev, JSON.stringify(data)]);
const adjust = (owner, ops) => call(owner, 'public.coop_adjust($1::jsonb)', [JSON.stringify(ops)]);
const rejects = (promise, token) => assert.rejects(promise, e => e.code === 'P0001' && e.message === token);

test('a checkpoint overwritten before money settlement cannot settle; restoring its exact source recovers once', async () => {
  await call(A, 'public.coop_open(100,0)');
  await rejects(adjust(A, [op]), 'household_sync_required');
  await push(A, 0, body(A, [op]));
  // Another tab sees the latest rev, but still holds the preceding household.
  await push(A, 1, body(A));
  await rejects(adjust(A, [op]), 'household_sync_required');
  assert.equal((await call(A, 'public.coop_wallet()')).balance, 100);
  assert.equal((await call(A, 'public.coop_receipts(0)')).receipts.length, 0);
  await push(A, 2, body(A, [op]));
  const settled = await adjust(A, [op]);
  assert.equal(settled.balance, 20);
  assert.equal(settled.receipts.length, 1);
  await rejects(push(A, 3, body(A)), 'cloud_copy_required');
  assert.equal((await call(A, 'public.pull_save()')).rev, 3);
  assert.equal((await call(A, 'public.pull_save()')).data.mayhem.curios.purchased, 1);
  const acknowledged = body(A, [], 1); acknowledged.mayhem = { souls: 20, curios: { purchased: 1 } };
  await push(A, 3, acknowledged);
  assert.deepEqual((await adjust(A, [op])).receipts, settled.receipts, 'lost-response retry does not require an uncleared pending op');
  await rejects(adjust(A, [{ ...op, delta: -79 }]), 'bad_op');
});

test('pre-opening backups and changed opening/cursor/pending provenance cannot erase the source, even after base migration re-runs', async () => {
  await db.exec(readFileSync(new URL('0001_accounts_and_saves.sql', DIR), 'utf8'));
  const current = await call(A, 'public.pull_save()');
  for (const data of [{ fixture: 'backup before co-op' }, { ...body(A), coop: { ...body(A).coop, money: { openings: { [A]: { souls: 99, after: 0 } }, pending: [] } } }, body(A, [], 999)]) {
    await rejects(push(A, current.rev, data), 'cloud_copy_required');
  }
  assert.deepEqual(await call(A, 'public.pull_save()'), current);
  await call(B, 'public.coop_open(100,0)');
  const bad = body(B, [{ ...op, preApplied: false }]);
  await push(B, 0, bad);
  await rejects(adjust(B, [op]), 'household_sync_required');
  bad.coop.money.pending[0].owner = A;
  await push(B, 1, bad);
  await rejects(adjust(B, [op]), 'household_sync_required');
});

test('canonical typed rewards need no generic checkpoint and private helpers remain unavailable', async () => {
  const detail = { reward: 'coven_invite', userId: A, curio: null, frame: null };
  const reward = { id: currencyId(B, 'coven_invite:' + A), delta: 5, earned: 5, detail };
  assert.equal((await adjust(B, [reward])).receipts[0].delta, 5);
  for (const helper of ['private.financial_save_ok(uuid,jsonb)', 'private.coop_saved_op(jsonb,uuid,uuid,integer,integer,jsonb)', 'private.coop_typed_reward(jsonb)', 'private.lock_account(uuid)']) {
    for (const role of ['anon', 'authenticated']) assert.equal((await db.query('select has_function_privilege($1,$2,$3) ok', [role, helper, 'execute'])).rows[0].ok, false);
  }
});

test('actual clients on two labelled fake tabs cannot settle an overwritten checkpoint or erase a confirmed purchase', async () => {
  const { normalizeState } = await import('../src/state.js');
  const { householdFixture } = await import('./household-fixtures.mjs');
  const { createFakeSupabase } = await import('./support/fake-supabase.mjs');
  const { socialPlayer } = await import('./support/social-world.mjs');
  const { createCoop } = await import('../src/cloud/coop.js');
  const { createSync } = await import('../src/cloud/sync.js');
  const { bindCoopMoney, captureCoopMoney } = await import('../src/engine/coop-money.js');
  const { commissionCurio } = await import('../src/engine/mayhem.js');
  const fake = createFakeSupabase(), a = normalizeState(householdFixture('established'));
  a.mayhem.souls = 100; a.mayhem.lifetime = 100; delete a.mayhem.curios['tooth-not-yours'];
  const old = normalizeState(structuredClone(a));
  const player = await socialPlayer(fake, 'Ada', a), owner = player.id;
  bindCoopMoney(a, owner); const b = normalizeState(structuredClone(a));
  const server = createCoop({ cloud: player.cloud, social: player.social }); await server.openWallet(100,0);
  const values = new Map(), storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k) };
  // Separate real sync controllers share browser authentication/metadata here.
  const sa = createSync({ cloud: player.cloud, storage, events: new EventTarget(), getState: () => a, applyRemote: () => false });
  const sb = createSync({ cloud: player.cloud, storage, events: new EventTarget(), getState: () => b, applyRemote: () => false });
  await sa.check(); await sb.check();
  commissionCurio(a, 'tooth-not-yours'); captureCoopMoney(a, owner);
  const operations = structuredClone(a.coop.money.pending);
  sa.markDirty(); await sa.push({ force: true });
  sb.markDirty(); assert.equal((await sb.push({ force: true })).status, 'idle');
  await assert.rejects(server.adjustMoney(operations), { code: 'household_sync_required' });
  assert.equal((await server.wallet()).balance, 100);
  sa.markDirty(); await sa.push({ force: true }); await server.adjustMoney(operations);
  const current = fake.saves.get(owner), revision = current.rev;
  for (const stale of [b, old]) {
    await assert.rejects(player.cloud.rpc('push_save', { p_base_rev: revision, p_data: stale }), e => e.code === 'P0001' && e.message === 'cloud_copy_required');
  }
  assert.equal(fake.saves.get(owner).rev, revision);
  assert.equal(fake.saves.get(owner).data.mayhem.curios['tooth-not-yours'], 1);
  await server.adjustMoney(operations);
  assert.equal((await server.wallet()).balance, 20);
  assert.equal(fake.coop.receipts.filter(r => r.owner === owner && r.kind === 'game').length, 1);
});
