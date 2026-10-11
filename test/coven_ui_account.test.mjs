import test from 'node:test';
import assert from 'node:assert/strict';
import { cloud, social } from '../src/cloud/index.js';
import { state, normalizeState, Store } from '../src/state.js';
import { householdFixture } from './household-fixtures.mjs';

const UID = '00000000-0000-4000-8000-000000000001', CID = '00000000-0000-4000-8000-000000000002';
test('an in-place backup restore with the same UID invalidates a delayed Coven chest', async t => {
  // Minimal controller context; the actual import/confirmation controls are
  // additionally exercised in browser/covens.spec.mjs.
  const previous = { window: globalThis.window, document: globalThis.document, state: structuredClone(state) };
  const listeners = new Map();
  globalThis.window = { addEventListener(name, fn) { listeners.set(name, fn); }, dispatchEvent() {} };
  globalThis.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null };
  t.mock.method(globalThis, 'setTimeout', () => 0); t.mock.method(globalThis, 'setInterval', () => 0);
  t.mock.method(cloud, 'userId', () => UID); t.mock.method(social, 'signedIn', () => true); t.mock.method(social, 'active', () => true);
  t.mock.method(cloud, 'rpc', async name => {
    assert.equal(name, 'coven_status');
    return { coven: { id: CID, name_a: 'damp', name_b: 'sisterhood', role: 'founder', shape: 'shield', symbol: 'spoon', colour: 'bruise', members: 1 },
      members: [{ user_id: UID, display_name: 'Ada', role: 'founder' }],
      week: { no: 2963, goal: 'coffin-3', counter: 'coffin', target: 6, progress: 3, members: [{ user_id: UID, amount: 3 }] } };
  });
  const snapshot = normalizeState(householdFixture('established'));
  Object.keys(state).forEach(k => delete state[k]); Object.assign(state, snapshot);
  const { coven, covenDebug } = await import('../src/ui/coven.js');
  t.after(() => {
    Object.keys(state).forEach(k => delete state[k]); Object.assign(state, previous.state);
    for (const key of ['window', 'document']) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; }
  });
  t.mock.method(covenDebug.rewardWallet, 'reconcile', async () => 0);
  t.mock.method(covenDebug.rewardWallet, 'operationId', async () => CID);
  await covenDebug.refreshStatus({ force: true });
  let finish;
  t.mock.method(coven, 'claim', () => new Promise(resolve => { finish = resolve; }));
  const ctx = { isCurrent: () => true, say: () => assert.fail('an old action must not paint into the restored context'), refresh() {} };
  const pending = covenDebug.handle('claim', { dataset: { week: '2963', tier: '1' } }, ctx);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(finish);
  const originalRoot = state, originalCoven = state.coven;
  const restored = normalizeState(snapshot); restored.mayhem.souls = 777; restored.coven.claimed = [];
  Object.keys(state).forEach(k => delete state[k]); Object.assign(state, restored);
  listeners.get('shelflife:state-replaced')();
  assert.equal(state, originalRoot); assert.notEqual(state.coven, originalCoven);
  finish({ ok: true, fresh: true, week: 2963, tier: 1 }); await pending;
  assert.equal(state.mayhem.souls, 777); assert.deepEqual(state.coven.claimed, []);

  // A saved proposal is the payment boundary. Failure preserves the purse and
  // owned marks, shows reward-specific recovery copy, and sends no award RPC.
  await covenDebug.refreshStatus({ force: true });
  t.mock.method(coven, 'claim', async () => ({ ok: true, fresh: true, week: 2963, tier: 1 }));
  t.mock.method(Store, 'set', () => false);
  let reconciles = 0; const messages = [];
  t.mock.method(covenDebug.rewardWallet, 'reconcile', async () => { reconciles++; });
  await covenDebug.handle('claim', { dataset: { week: '2963', tier: '1' } }, { isCurrent: () => true, say: text => messages.push(text), refresh() {} });
  assert.equal(reconciles, 1, 'only the read before claiming ran; unsaved proposal was never uploaded');
  assert.equal(state.mayhem.souls, 777); assert.deepEqual(state.coven.claimed, []);
  assert.match(messages[0], /could not save the reward.*Free some storage/);
  assert.doesNotMatch(messages[0], /wager/);
  assert.equal(state.coop.money.pending.find(op => op.detail?.reward === 'coven_chest')?.preApplied, false);
});
