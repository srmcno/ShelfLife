import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, setState, state, save, Store, onBeforeSave } from '../src/state.js';
import { coopState } from '../src/coop-state.js';
import { mayhemState } from '../src/mayhem-state.js';
import { addSouls } from '../src/engine/mayhem.js';
import { spendSouls } from '../src/engine/almanac.js';
import { bindCoopMoney, captureCoopMoney, currencyRewardId, hasCoopReward } from '../src/engine/coop-money.js';
import { applyCoopReceipts } from '../src/engine/coop.js';
import { createCoop, readCoopReceipts } from '../src/cloud/coop.js';
const A = '00000000-0000-4000-8000-000000000001', B = A.replace(/1$/, '2');
let serial = 100;
const id = () => A.slice(0, -12) + String(++serial).padStart(12, '0');
const wallet = amount => { const s = blankState(); mayhemState(s).souls = amount; mayhemState(s).lifetime = amount; return s; };
const rows = operations => operations.map((p, i) => ({ id: id(), sourceId: p.id, owner: p.owner, kind: 'game', delta: p.delta, earned: p.earned, ...(p.detail ? { detail: p.detail } : {}), seq: i + 1 }));

test('a failed initial opening keeps its original funding snapshot while ordinary play earns and spends', () => {
  const s = wallet(10); bindCoopMoney(s, A);
  addSouls(s, 100); const earned = captureCoopMoney(s, A, id);
  assert.deepEqual(bindCoopMoney(s, A), { souls: 10, after: 0 }, 'retry does not declare110 and then credit100 again');
  assert.equal(spendSouls(s, 80), true); const spent = captureCoopMoney(s, A, id);
  assert.deepEqual([earned.delta, earned.earned, spent.delta, spent.earned], [100, 100, -80, 0]);
  assert.equal(mayhemState(s).souls, 30);
  const reload = normalizeState(structuredClone(s));
  assert.deepEqual(reload.coop.money.openings[A], { souls: 10, after: 0 });
  assert.deepEqual(reload.coop.money.pending, [earned, spent]);
});

test('local pre-applied currency operations are acknowledged once; an older backup replays the same real changes', () => {
  const local = wallet(10), old = wallet(10); bindCoopMoney(local, A); bindCoopMoney(old, A);
  addSouls(local, 100); captureCoopMoney(local, A, id);
  spendSouls(local, 80); captureCoopMoney(local, A, id);
  const receipts = rows(coopState(local).money.pending);
  applyCoopReceipts(local, A, receipts); applyCoopReceipts(local, A, receipts);
  applyCoopReceipts(old, A, receipts);
  assert.deepEqual([mayhemState(local).souls, mayhemState(local).lifetime], [30, 110]);
  assert.deepEqual([mayhemState(old).souls, mayhemState(old).lifetime], [30, 110]);
  assert.deepEqual(coopState(local).money.pending, []);
  assert.equal(captureCoopMoney(local, A, id), null, 'reconciliation is not journaled as another game reward');
});

test('earned lifetime can exceed net wallet change when rewards and purchases share one save', () => {
  const s = wallet(10); bindCoopMoney(s, A);
  addSouls(s, 100); spendSouls(s, 100);
  const op = captureCoopMoney(s, A, id); assert.deepEqual([op.delta, op.earned], [0, 100]);
  const old = wallet(10); bindCoopMoney(old, A); applyCoopReceipts(old, A, rows([op]));
  assert.deepEqual([mayhemState(old).souls, mayhemState(old).lifetime], [10, 110]);
});

test('restore and imported balances rebase the checkpoint rather than manufacture earnings', () => {
  const s = wallet(100); bindCoopMoney(s, A); spendSouls(s, 25); captureCoopMoney(s, A, id);
  const imported = structuredClone(s); imported.mayhem.souls = 200; imported.mayhem.lifetime = 200;
  const restored = normalizeState(imported);
  assert.equal(captureCoopMoney(restored, A, id), null);
  assert.equal(restored.coop.money.pending.length, 1, 'only the original real25-soul purchase remains');
  const origin = coopState(s); Object.keys(s).forEach(k => delete s[k]); Object.assign(s, restored);
  assert.notEqual(coopState(s), origin, 'in-place same-UID replacement invalidates pending work on the old financial domain');
  assert.equal(captureCoopMoney(s, A, id), null);
});

test('offline signed-out earnings keep their existing owner; signing into B cannot send A operations', async () => {
  const s = wallet(10); bindCoopMoney(s, A); addSouls(s, 10);
  const a = captureCoopMoney(s, null, id); assert.equal(a.owner, A);
  assert.equal(captureCoopMoney(s, B, id), null);
  addSouls(s, 5); const b = captureCoopMoney(s, B, id); assert.equal(b.owner, B);
  let requests = 0;
  const coop = createCoop({ cloud: { configured: true, signedIn: () => true, userId: () => B, rpc: async () => { requests++; } }, social: { active: () => true } });
  await assert.rejects(coop.adjustMoney([a])); assert.equal(requests, 0);
  assert.deepEqual(coopState(s).money.pending.map(p => p.owner), [A, B]);
});

test('a conflicting receipt cannot consume a saved operation or alter the purse', () => {
  const s = wallet(10); bindCoopMoney(s, A); addSouls(s, 100);
  const op = captureCoopMoney(s, A, id), [receipt] = rows([op]); receipt.delta = 99;
  assert.throws(() => applyCoopReceipts(s, A, [receipt]), /does not match/);
  assert.equal(mayhemState(s).souls, 110); assert.equal(coopState(s).money.pending.length, 1);
  assert.equal(coopState(s).ledger[A], undefined);
});

test('offline purchases that overtake another device stake preserve debt through a refund', () => {
  const s = wallet(100); bindCoopMoney(s, A); spendSouls(s, 90);
  const op = captureCoopMoney(s, A, id), duel = id();
  applyCoopReceipts(s, A, [{ id: id(), sourceId: duel, owner: A, kind: 'stake', delta: -25, earned: 0, seq: 1 },
    { ...rows([op])[0], seq: 2 }]);
  assert.deepEqual([mayhemState(s).souls, coopState(s).ledger[A].debt], [0, 15]);
  applyCoopReceipts(s, A, [{ id: id(), sourceId: duel, owner: A, kind: 'duel', delta: 25, earned: 0, seq: 3 }]);
  assert.deepEqual([mayhemState(s).souls, coopState(s).ledger[A].debt], [10, 0]);
  assert.equal(captureCoopMoney(s, A, id), null, 'receipt debt/refund is not an ordinary game purchase');
});

test('the actual save boundary writes the journal and wallet together and reports failed persistence', () => {
  const oldState = state, oldStorage = globalThis.localStorage, stored = new Map(); let fail = false;
  globalThis.localStorage = { setItem(k, v) { if (fail) throw new Error('quota'); stored.set(k, v); }, getItem: k => stored.get(k) || null, removeItem: k => stored.delete(k) };
  const unsubscribe = onBeforeSave(s => captureCoopMoney(s, A, id));
  try {
    const s = wallet(10); bindCoopMoney(s, A); setState(s); assert.equal(save(), true);
    addSouls(s, 100); fail = true; assert.equal(save(), false); assert.equal(Store.persistent, false);
    assert.equal(JSON.parse(stored.get('shelflife.v4')).mayhem.souls, 10, 'failed operation never reached durable storage');
    assert.equal(s.coop.money.pending.length, 1);
    const operation = s.coop.money.pending[0].id;
    fail = false; assert.equal(save(), true);
    const durable = JSON.parse(stored.get('shelflife.v4'));
    assert.equal(durable.mayhem.souls, 110); assert.equal(durable.coop.money.pending[0].id, operation, 'retry preserves the operation ID');
    assert.equal(durable.coop.money.checkpoint.souls, 110);
  } finally { unsubscribe(); setState(oldState); globalThis.localStorage = oldStorage; }
});

test('actual server pagination/detail recovers a report and resident memory after response loss, without double credit', () => {
  const s = wallet(100); s.pets = [{ id: 'resident', name: 'Agnes' }]; bindCoopMoney(s, A);
  const hire = id(), receiptId = id();
  const page = readCoopReceipts({ receipts: [{ id: receiptId, source_id: hire, owner: A, kind: 'hire', delta: 12, earned: 12, seq: 1,
    detail: { hire_id: hire, pet_id: 'resident', name: 'Agnes', hirer: B, hirer_name: 'Bea', wages: 12, finished_at: new Date().toISOString(),
      report: { route: 'drawer', gear: 'thread', edition: 0, rev: 2, score: 8, tier: 2, returned: 0, built: false, choices: [1, 0, 1], helped: [0], crew: ['Bea'] } } }], has_more: false, last_seq: 1 }, A);
  applyCoopReceipts(s, A, page.receipts); applyCoopReceipts(s, A, page.receipts);
  assert.equal(mayhemState(s).souls, 112); assert.equal(s.coop.memories.length, 1);
  assert.match(s.coop.memories[0].text, /Bea/); assert.equal(s.coop.memories[0].key, 'coop:hire:' + hire);
  assert.equal(s.notes.filter(n => n.from === 'a field report').length, 1);
  assert.match(s.notes[0].text, /Wages: 12 souls/);
  assert.equal(captureCoopMoney(s, A, id), null);
});


test('semantic reward IDs match the independently specified SHA-256 UUIDv8 vector', async () => {
  assert.equal(await currencyRewardId(A, 'coven_chest:42:1'), 'fe25c6f7-6082-81c7-b76b-e46285558523');
  assert.equal(await currencyRewardId(A.toUpperCase(), 'coven_chest:42:1'), await currencyRewardId(A, 'coven_chest:42:1'));
  assert.notEqual(await currencyRewardId(B, 'coven_chest:42:1'), await currencyRewardId(A, 'coven_chest:42:1'));
  await assert.rejects(currencyRewardId(A, 'invalid key'));
});

test('pending typed reward metadata survives reload before its controller registers a reader', () => {
  const s = wallet(10); bindCoopMoney(s, A);
  const detail = { reward: 'not_loaded_yet', source: 42, frames: ['one'] };
  s.coop.money.pending.push({ id: id(), owner: A, delta: 0, earned: 0, detail });
  const restored = normalizeState(structuredClone(s));
  assert.deepEqual(restored.coop.money.pending[0].detail, detail);
  detail.frames.push('two');
  assert.deepEqual(restored.coop.money.pending[0].detail.frames, ['one'], 'reload does not retain a mutable source reference');
});

test('Coven reward receipts rebuild paid marks and cosmetics with money, preventing a restored chest from paying twice', async () => {
  const { payChest, chestPaid } = await import('../src/engine/coven.js');
  const local = wallet(10), old = wallet(10); bindCoopMoney(local, A); bindCoopMoney(old, A);
  const operation = await currencyRewardId(A, 'coven_chest:42:2');
  const reward = payChest(local, 42, 2, A, operation);
  assert.ok(reward.curio); assert.equal(local.coop.money.pending.length, 1);
  assert.equal(captureCoopMoney(local, A, id), null, 'the semantic award is not duplicated by the general save observer');
  const receipts = rows(local.coop.money.pending);
  const restoredLocal = normalizeState(structuredClone(local));
  applyCoopReceipts(restoredLocal, A, receipts); applyCoopReceipts(restoredLocal, A, receipts);
  applyCoopReceipts(old, A, receipts); applyCoopReceipts(old, A, receipts);
  for (const s of [restoredLocal, old]) {
    assert.equal(s.mayhem.souls, 10 + reward.souls + reward.extra);
    assert.equal(s.mayhem.lifetime, 10 + reward.souls + reward.extra);
    assert.equal(chestPaid(s, 42, 2, A), true); assert.equal(hasCoopReward(s, A, operation), true);
    assert.equal(s.coven.curios[reward.curio.id], 1, 'already applied pending effects are not applied twice');
    assert.equal(payChest(s, 42, 2, A, operation), null, 'a server fresh:false recovery cannot create another payment');
    assert.equal(captureCoopMoney(s, A, id), null);
  }
});

test('the adjustment wrapper uses the deployed argument name and preserves earned independently of net delta', async () => {
  let request;
  const coop = createCoop({ cloud: { configured: true, signedIn: () => true, userId: () => A,
    rpc: async (name, args) => { request = { name, args }; return { ok: true }; } }, social: { active: () => true } });
  const operation = { id: id(), owner: A, delta: 0, earned: 100 };
  await coop.adjustMoney([operation]);
  assert.deepEqual(request, { name: 'coop_adjust', args: { p_ops: [{ id: operation.id, delta: 0, earned: 100 }] } });
});

test('the labelled strict server budget tracks ordinary spend after opening and preserves a competing-device stake debt', async () => {
  const { createFakeSupabase } = await import('./support/fake-supabase.mjs');
  const { socialPlayer } = await import('./support/social-world.mjs');
  const fake = createFakeSupabase(), s = wallet(100), twin = wallet(100);
  const ada = await socialPlayer(fake, 'Ada', s), bea = await socialPlayer(fake, 'Bea', wallet(100));
  await ada.social.addFriend(bea.code); await bea.social.respond(ada.id, true);
  const server = createCoop({ cloud: ada.cloud, social: ada.social });
  bindCoopMoney(s, ada.id); bindCoopMoney(twin, ada.id); await server.openWallet(100);
  const duel = await server.duelCreate(bea.id, 'stack', 25);
  spendSouls(s, 90); const operation = captureCoopMoney(s, ada.id, id);
  await server.adjustMoney([operation]); await server.adjustMoney([operation]);
  assert.equal((await server.wallet()).balance, -15, 'the spend is retained rather than ignored or clamped');
  await assert.rejects(server.duelCreate(bea.id, 'stack', 25), { code: 'insufficient_souls' });
  await assert.rejects(server.adjustMoney([{ ...operation, delta: -89 }]), { code: 'bad_op' });
  assert.equal((await server.wallet()).balance, -15, 'changing an operation cannot change the budget');
  await server.duelDecline(duel.id); await server.duelClaim(duel.id);
  const page = await server.receipts();
  applyCoopReceipts(s, ada.id, page.receipts); applyCoopReceipts(twin, ada.id, page.receipts);
  for (const household of [s, twin]) {
    assert.equal(household.mayhem.souls, 10); assert.equal(household.mayhem.lifetime, 100);
    assert.equal(household.coop.ledger[ada.id].debt, 0);
    assert.equal(captureCoopMoney(household, ada.id, id), null);
  }
  assert.equal((await server.wallet()).balance, 10);
  assert.equal(fake.coop.receipts.filter(r => r.owner === ada.id && r.kind === 'game').length, 1);
  addSouls(s, 100); const earned = captureCoopMoney(s, ada.id, id); await server.adjustMoney([earned]);
  const next = await server.receipts(s.coop.ledger[ada.id].seq);
  applyCoopReceipts(s, ada.id, next.receipts); applyCoopReceipts(twin, ada.id, next.receipts);
  assert.equal((await server.wallet()).balance, 110, 'ordinary play after opening replenishes the shared wager budget');
  assert.deepEqual([s.mayhem.souls, twin.mayhem.souls, s.mayhem.lifetime, twin.mayhem.lifetime], [110, 110, 200, 200]);
  await server.duelCreate(bea.id, 'stack', 25);
  assert.equal((await server.wallet()).balance, 85, 'newly earned souls can fund a later stake');
});
