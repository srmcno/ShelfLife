import test from 'node:test';
import assert from 'node:assert/strict';
import { state, blankState, normalizeState } from '../src/state.js';
import { coopState } from '../src/coop-state.js';
const A = '00000000-0000-4000-8000-000000000001';

test('actual wallet reconciliation refuses failed persistence and cancels every old-domain waiter on same-account restore', async t => {
  // Labelled DOM/network fakes isolate the real controller and durable save
  // boundary. Browser journeys exercise the actual Friends/game controls.
  const previous = { state: structuredClone(state), window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage, MutationObserver: globalThis.MutationObserver };
  const node = { querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} } };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  globalThis.document = { getElementById: () => node, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, documentElement: node };
  t.mock.method(globalThis, 'setTimeout', () => 0); t.mock.method(globalThis, 'setInterval', () => 0);
  let fail = false; const saved = new Map();
  globalThis.localStorage = { getItem: k => saved.get(k) || null, removeItem: k => saved.delete(k), setItem(k, v) { if (fail) throw new Error('quota'); saved.set(k, v); } };
  const replace = next => { Object.keys(state).forEach(k => delete state[k]); Object.assign(state, next); };
  replace(blankState()); state.mayhem.souls = 100; state.mayhem.lifetime = 100;
  t.after(() => { replace(previous.state); for (const key of ['window', 'document', 'localStorage', 'MutationObserver']) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; } });
  const { coop } = await import('../src/ui/coop-hire.js');
  const { reconcileCoopWallet } = await import('../src/ui/coop.js');
  t.mock.method(coop, 'userId', () => A);

  let requests = 0, release;
  t.mock.method(coop, 'openWallet', () => { requests++; return new Promise(resolve => { release = resolve; }); });
  t.mock.method(coop, 'adjustMoney', () => assert.fail('canceled work must not transmit operations'));
  t.mock.method(coop, 'receipts', () => assert.fail('canceled work must not read or apply a receipt'));
  replace(blankState());
  t.mock.method(coop, 'wallet', async () => ({ opening: 100, openingSeq: 0, balance: 100, lastSeq: 0 }));
  await assert.rejects(reconcileCoopWallet(A), { code: 'cloud_copy_required' });
  assert.equal(requests, 0); assert.equal(state.mayhem.souls, 0);
  assert.equal(state.coop.money.openings[A], undefined, 'reading a different household wallet cannot establish ownership');
  assert.equal(saved.size, 0, 'the unowned household remains untouched');
  replace(blankState()); state.mayhem.souls = 100; state.mayhem.lifetime = 100;
  t.mock.method(coop, 'wallet', async () => ({ opening: null, openingSeq: 0, balance: null, lastSeq: 0 }));
  fail = true;
  await assert.rejects(reconcileCoopWallet(A), { code: 'save_unavailable' });
  assert.equal(requests, 0, 'a failed durable save cannot send a wallet declaration');
  fail = false;
  const first = reconcileCoopWallet(A), waiter = reconcileCoopWallet(A);
  const outcomes = Promise.allSettled([first, waiter]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  const origin = coopState(state), restored = normalizeState(structuredClone(state)); restored.mayhem.souls = 777;
  replace(restored); assert.notEqual(coopState(state), origin);
  release({ opening: 100 });
  const result = await outcomes;
  assert.deepEqual(result.map(r => [r.status, r.reason?.code]), [['rejected', 'state_changed'], ['rejected', 'state_changed']]);
  assert.equal(state.mayhem.souls, 777, 'neither old call changes the replacement shelf or allows its caller to continue');
  assert.equal(requests, 1, 'the stale waiter cannot open a new transaction on the restored shelf');
});
