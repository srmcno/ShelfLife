import test from 'node:test';
import assert from 'node:assert/strict';
import { state, blankState, normalizeState } from '../src/state.js';
import { bindCoopMoney, queueCoopReward, registerCoopReward, coopRewardReceipt, captureCoopMoney } from '../src/engine/coop-money.js';
import { saveHash } from '../src/cloud/sync.js';
import { addSouls } from '../src/engine/mayhem.js';
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
  const { reconcileCoopWallet, coopWalletView, coopWalletCloud } = await import('../src/ui/coop.js');
  t.mock.method(coop, 'userId', () => A);
  let cloudMeta = {};
  t.mock.method(coopWalletCloud, 'info', () => ({ status: 'idle' }));
  t.mock.method(coopWalletCloud, 'meta', () => cloudMeta);
  t.mock.method(coopWalletCloud, 'push', async () => { cloudMeta = { syncUser: A, baseRev: 1, lastPushHash: saveHash(JSON.stringify(state)) }; return { status: 'idle' }; });

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

  registerCoopReward('qa_reward', {
    normalize: d => typeof d.source === 'string' && typeof d.gift === 'string' ? { source: d.source, gift: d.gift } : null,
    key: d => d.source,
    apply: (s, owner, d) => s.notes.push({ text: d.gift, from: 'labelled reward fixture', at: Date.now(), icon: 'note' })
  });
  t.mock.method(coopWalletView, 'refresh', () => {});
  const ID = n => A.slice(0, -12) + String(n).padStart(12, '0');
  const fixture = () => { saved.clear(); replace(blankState()); state.mayhem.souls = 100; state.mayhem.lifetime = 100; };
  const propose = (id, amount = 25) => queueCoopReward(state, { id, owner: A, delta: amount, earned: amount, detail: { reward: 'qa_reward', source: 'same-source', gift: 'proposed mug' } });
  const receipt = (id, amount, gift) => ({ id: ID(900), sourceId: id, owner: A, kind: 'game', delta: amount, earned: amount, seq: 1,
    detail: { reward: 'qa_reward', source: 'same-source', gift } });
  t.mock.method(coop, 'wallet', async () => ({ opening: null, openingSeq: 0, balance: null, lastSeq: 0 }));
  t.mock.method(coop, 'openWallet', async () => ({ opening: 100, openingSeq: 0, balance: 100, lastSeq: 0 }));

  await t.test('a first-server award racing the proposal pays the canonical amount and gift once', async st => {
    fixture(); const operation = ID(700); propose(operation);
    let ledger = [], uploads = 0;
    st.mock.method(coop, 'receipts', async after => ({ receipts: ledger.filter(r => r.seq > after), more: false, lastSeq: ledger.length }));
    st.mock.method(coop, 'adjustMoney', async operations => {
      uploads++; assert.equal(state.mayhem.souls, 100, 'no provisional cash may be spent');
      const durable = JSON.parse(saved.get('shelflife.v4'));
      assert.equal(durable.coop.money.pending[0].preApplied, false); assert.equal(durable.mayhem.souls, 100);
      assert.equal(operations[0].id, operation);
      ledger = [receipt(operation, 40, 'first server candle')];
      throw Object.assign(new Error('Concurrent canonical award'), { code: 'bad_op' });
    });
    await reconcileCoopWallet(A);
    assert.equal(uploads, 1); assert.equal(state.mayhem.souls, 140); assert.equal(state.mayhem.lifetime, 140);
    assert.deepEqual(state.notes.map(n => n.text), ['first server candle']);
    assert.equal(coopRewardReceipt(state, A, operation).detail.gift, 'first server candle');
    assert.deepEqual(state.coop.money.pending, []); assert.equal(captureCoopMoney(state, A), null);
  });

  await t.test('a lost adjustment reply leaves an un-applied durable proposal; reload reads its canonical receipt before uploading', async st => {
    fixture(); const operation = ID(701); propose(operation);
    let ledger = [], uploads = 0;
    st.mock.method(coop, 'receipts', async after => ({ receipts: ledger.filter(r => r.seq > after), more: false, lastSeq: ledger.length }));
    st.mock.method(coop, 'adjustMoney', async () => { uploads++; ledger = [receipt(operation, 25, 'original gift')]; throw Object.assign(new Error('Lost reply after commit'), { code: 'offline' }); });
    await assert.rejects(reconcileCoopWallet(A), { code: 'offline' });
    assert.equal(state.mayhem.souls, 100); assert.equal(state.notes.length, 0);
    replace(normalizeState(JSON.parse(saved.get('shelflife.v4'))));
    assert.equal(state.coop.money.pending[0].preApplied, false);
    await reconcileCoopWallet(A); await reconcileCoopWallet(A);
    assert.equal(uploads, 1); assert.equal(state.mayhem.souls, 125); assert.equal(state.mayhem.lifetime, 125);
    assert.deepEqual(state.notes.map(n => n.text), ['original gift']);
  });

  await t.test('a semantic proposal cannot be sent after its persistent write fails', async st => {
    fixture(); propose(ID(702)); fail = true;
    st.mock.method(coop, 'adjustMoney', () => assert.fail('an undurable proposal cannot be sent'));
    try { await assert.rejects(reconcileCoopWallet(A), { code: 'save_unavailable' }); }
    finally { fail = false; }
    assert.equal(state.mayhem.souls, 100); assert.equal(state.notes.length, 0); assert.equal(saved.size, 0);
  });

  await t.test('generic changed payloads remain refused before money or cursor mutation', async st => {
    fixture(); bindCoopMoney(state, A); addSouls(state, 100);
    const op = captureCoopMoney(state, A, () => ID(703));
    st.mock.method(coop, 'receipts', async () => ({ receipts: [{ ...receipt(op.id, 99, ''), detail: undefined }], more: false, lastSeq: 1 }));
    st.mock.method(coop, 'adjustMoney', () => assert.fail('a corrupt generic receipt must not be masked'));
    await assert.rejects(reconcileCoopWallet(A), /does not match/);
    assert.equal(state.mayhem.souls, 200); assert.equal(state.coop.ledger[A], undefined); assert.equal(state.coop.money.pending.length, 1);
  });


  await t.test('actual cloud save acknowledges the first opening and a full purchased-item snapshot before money transmission', async st => {
    const { createFakeSupabase } = await import('./support/fake-supabase.mjs');
    const { socialPlayer } = await import('./support/social-world.mjs');
    const { createCoop } = await import('../src/cloud/coop.js');
    const { createSync } = await import('../src/cloud/sync.js');
    const { CloudError } = await import('../src/cloud/client.js');
    const { commissionCurio } = await import('../src/engine/mayhem.js');
    fixture(); const fake = createFakeSupabase(), ada = await socialPlayer(fake, 'Ada', state);
    assert.equal(ada.id, A);
    const server = createCoop({ cloud: ada.cloud, social: ada.social });
    const realSync = createSync({ cloud: ada.cloud, getState: () => state, applyRemote: () => false, events: new EventTarget(), storage: globalThis.localStorage });
    realSync.start(); st.after(() => realSync.stop()); await realSync.check();
    for (const name of ['wallet', 'openWallet', 'adjustMoney', 'receipts']) st.mock.method(coop, name, server[name]);
    st.mock.method(coopWalletCloud, 'push', options => realSync.push(options));
    st.mock.method(coopWalletCloud, 'info', () => realSync.info());
    st.mock.method(coopWalletCloud, 'meta', () => ada.cloud.meta());
    st.mock.method(coopWalletCloud, 'markDirty', () => realSync.markDirty());
    await reconcileCoopWallet(A);
    const openIndex = fake.requests.findIndex(r => r.path.endsWith('/coop_open'));
    const openingPush = fake.requests.findIndex(r => r.path.endsWith('/push_save') && JSON.parse(r.body).p_data.coop?.money?.openings?.[A]?.souls === 100);
    assert.ok(openingPush >= 0 && openingPush < openIndex, 'the acknowledged full opening snapshot precedes server opening creation');
    assert.equal(commissionCurio(state, 'tooth-not-yours').cost, 80);
    const originalRPC = ada.cloud.rpc.bind(ada.cloud); let failUpload = true, earnDuringUpload = false;
    st.mock.method(ada.cloud, 'rpc', async (name, ...args) => {
      if (name === 'push_save' && failUpload) throw new CloudError('Fixture upload failure', { code: 'offline', offline: true });
      const result = await originalRPC(name, ...args);
      if (name === 'push_save' && earnDuringUpload) { earnDuringUpload = false; addSouls(state, 7); }
      return result;
    });
    await assert.rejects(reconcileCoopWallet(A), { code: 'household_sync_required' });
    assert.equal(fake.calls('coop_adjust').length, 0, 'a failed complete-household upload cannot send money');
    assert.equal(state.mayhem.souls, 20); assert.equal(state.mayhem.curios['tooth-not-yours'], 1);
    assert.equal(state.coop.money.pending.length, 1);
    failUpload = false;
    await reconcileCoopWallet(A);
    const adjustIndex = fake.requests.findIndex(r => r.path.endsWith('/coop_adjust'));
    const transmitted = JSON.parse(fake.requests[adjustIndex].body).p_ops[0];
    const backup = fake.requests.slice(0, adjustIndex).filter(r => r.path.endsWith('/push_save')).at(-1);
    const body = JSON.parse(backup.body).p_data;
    assert.equal(body.mayhem.souls, 20); assert.equal(body.mayhem.curios['tooth-not-yours'], 1);
    assert.ok(body.coop.money.pending.some(p => p.id === transmitted.id && p.delta === transmitted.delta && p.earned === transmitted.earned));
    assert.equal(state.coop.money.pending.length, 0); assert.equal((await server.wallet()).balance, 20);
    addSouls(state, 10); earnDuringUpload = true;
    await reconcileCoopWallet(A);
    assert.equal(state.mayhem.souls, 37); assert.equal((await server.wallet()).balance, 37);
    assert.equal(state.mayhem.lifetime, 117);
    const adjusted = fake.requests.map((r, index) => ({ r, index })).filter(({ r }) => r.path.endsWith('/coop_adjust'));
    assert.equal(adjusted.length, 3, 'new gameplay during the first upload gets its own acknowledged batch');
    for (const { r, index } of adjusted.slice(1)) {
      const transmitted = JSON.parse(r.body).p_ops[0];
      const checkpoint = JSON.parse(fake.requests.slice(0, index).filter(q => q.path.endsWith('/push_save')).at(-1).body).p_data;
      assert.ok(checkpoint.coop.money.pending.some(p => p.id === transmitted.id && p.delta === transmitted.delta));
      assert.equal(checkpoint.mayhem.curios['tooth-not-yours'], 1);
    }
    const { householdFixture } = await import('./household-fixtures.mjs');
    replace(normalizeState({ ...structuredClone(state), pets: householdFixture('established').pets }));
    const otherDevice = structuredClone(state); otherDevice.pets[0].name = 'Other phone';
    fake.setRemote(A, otherDevice, { device: 'android-other' });
    addSouls(state, 10);
    await assert.rejects(reconcileCoopWallet(A), { code: 'cloud_copy_required' });
    assert.ok(realSync.info().conflict); assert.equal(fake.calls('coop_adjust').length, 3);
    assert.equal(state.mayhem.souls, 47); assert.equal(state.coop.money.pending.length, 1);
    await realSync.resolve('local');
    await reconcileCoopWallet(A);
    assert.equal((await server.wallet()).balance, 47); assert.equal(state.mayhem.souls, 47);
    assert.equal(state.coop.money.pending.length, 0);
    assert.equal(fake.calls('coop_adjust').length, 4, 'a real explicit copy choice clears the CAS conflict before financial transmission');

  });


  for (const replacement of ['same-account household', 'account']) await t.test('a delayed full-household upload cannot continue after replacing the ' + replacement, async st => {
    fixture(); propose(ID(710));
    let owner = A, finish;
    st.mock.method(coop, 'userId', () => owner);
    st.mock.method(coopWalletCloud, 'meta', () => ({}));
    st.mock.method(coopWalletCloud, 'push', () => new Promise(resolve => { finish = resolve; }));
    st.mock.method(coop, 'openWallet', () => assert.fail('old uploaded work cannot establish an opening on a replacement shelf/account'));
    const waiting = reconcileCoopWallet(A);
    const outcome = Promise.allSettled([waiting]);
    await new Promise(resolve => setImmediate(resolve)); assert.ok(finish);
    if (replacement === 'account') owner = ID(711);
    else { const changed = structuredClone(state); changed.mayhem.souls = 777; replace(normalizeState(changed)); }
    finish({ status: 'idle' });
    const [result] = await outcome;
    assert.equal(result.status, 'rejected'); assert.equal(result.reason.code, 'state_changed');
    assert.equal(state.mayhem.souls, replacement === 'account' ? 100 : 777);
  });

  await t.test('a resolved cloud upload with a fresh timestamp but wrong body hash cannot authorize an opening', async st => {
    fixture(); propose(ID(712)); let uploads = 0;
    st.mock.method(coopWalletCloud, 'meta', () => ({ syncUser: A, baseRev: 9, lastSyncedAt: Date.now(), lastPushHash: 'wrong-body' }));
    st.mock.method(coopWalletCloud, 'push', async () => { uploads++; return { status: 'idle' }; });
    st.mock.method(coop, 'openWallet', () => assert.fail('timestamp-only acknowledgement is not a recoverable household'));
    await assert.rejects(reconcileCoopWallet(A), { code: 'household_sync_required' });
    assert.equal(uploads, 2, 'unchanged unacknowledged bodies stop without an infinite retry loop');
    assert.equal(state.mayhem.souls, 100); assert.equal(state.coop.money.pending.length, 1);
  });

});
