import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState } from '../src/state.js';
import { bindCoopMoney, captureCoopMoney, assertCoopOpening } from '../src/engine/coop-money.js';
import { addSouls } from '../src/engine/mayhem.js';
import { createCloud, CloudError } from '../src/cloud/client.js';
import { createSync, SAFETY_KEY, saveHash } from '../src/cloud/sync.js';
import { createCoop } from '../src/cloud/coop.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { householdFixture } from './household-fixtures.mjs';
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
function household(souls, name = 'Agnes') {
  const raw = householdFixture('established'); raw.pets[0].name = name;
  raw.mayhem.souls = souls; raw.mayhem.lifetime = souls; return normalizeState(raw);
}
async function setup(local, effect = s => addSouls(s, 20)) {
  // Labelled in-memory Supabase; authentication, copy decisions and wallet
  // readers use the actual clients and sync engine, without a live account.
  const fake = createFakeSupabase(), owned = household(100), player = await socialPlayer(fake, 'Ada', owned);
  bindCoopMoney(owned, player.id);
  const server = createCoop({ cloud: player.cloud, social: player.social }); await server.openWallet(100);
  effect(owned, player.id); captureCoopMoney(owned, player.id);
  fake.setRemote(player.id, owned, { device: 'android-original' });
  const saved = storage(); saved.setItem('shelflife.cloud', JSON.stringify({ session: player.session }));
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: saved });
  const events = new EventTarget(), callbacks = new Map(); let timerId = 0;
  const timers = { setTimeout(fn, ms) { const id = ++timerId; callbacks.set(id, { fn, ms }); return id; }, clearTimeout: id => callbacks.delete(id) };
  const sync = createSync({ cloud, storage: saved, getState: () => local, applyRemote(next) { local = next; return true; }, events, timers });
  return { fake, player, server, owned, cloud, sync, saved, events, scheduledCount: () => callbacks.size, async runScheduled() { const next = [...callbacks].sort((a, b) => a[1].ms - b[1].ms)[0]; assert.ok(next); callbacks.delete(next[0]); next[1].fn(); for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve)); }, replaceLocal(next) { local = next; }, get local() { return local; } };
}

test('a new populated device must choose its existing cloud household before using that account wallet', async () => {
  const d = await setup(household(0, 'Different shelf'));
  const wallet = await d.server.wallet();
  assert.throws(() => assertCoopOpening(d.local, d.player.id, wallet), { code: 'cloud_copy_required' });
  assert.equal((await d.sync.check()).status, 'conflict');
  assert.equal(d.local.mayhem.souls, 0, 'reading the server purse never silently adopts funds');
  assert.equal((await d.sync.resolve('cloud')).status, 'idle');
  assert.equal(d.local.mayhem.souls, 120);
  assert.equal(d.local.pets[0].name, 'Agnes');
  assert.doesNotThrow(() => assertCoopOpening(d.local, d.player.id, wallet));
  assert.equal(captureCoopMoney(d.local, d.player.id), null, 'copy restoration is not a new reward');
  assert.equal(d.local.coop.money.pending.length, 1, 'the original unsynced20-soul operation survives');
  const safety = JSON.parse(d.saved.getItem(SAFETY_KEY));
  assert.equal(safety.mayhem.souls, 0); assert.equal(safety.pets[0].name, 'Different shelf');
});

test('the trusted boundary refuses keeping an unrelated local shelf over an existing account wallet household', async () => {
  const d = await setup(household(50, 'Local choice'));
  assert.equal((await d.sync.check()).status, 'conflict');
  const refused = await d.sync.resolve('local');
  assert.equal(refused.status, 'conflict'); assert.equal(refused.error.code, 'cloud_copy_required');
  assert.equal(d.local.mayhem.souls, 50); assert.equal(d.local.pets[0].name, 'Local choice');
  assert.equal(d.local.coop.money.pending.length, 0);
  assert.equal(d.fake.saves.get(d.player.id).data.mayhem.souls, 120, 'the complete account copy survives the refused overwrite');
  const wallet = await d.server.wallet();
  assert.throws(() => assertCoopOpening(d.local, d.player.id, wallet), { code: 'cloud_copy_required' });
  const safety = JSON.parse(d.saved.getItem(SAFETY_KEY)); assert.equal(safety.mayhem.souls, 120);
  assert.equal((await d.server.wallet()).balance, 100, 'the cloud-copy choice is not a currency adjustment');
  assert.equal((await d.sync.resolve('cloud')).status, 'idle');
  assert.equal(d.local.mayhem.souls, 120); assert.equal(JSON.parse(d.saved.getItem(SAFETY_KEY)).mayhem.souls, 50);
});

test('keeping a matching household preserves its genuine unsynced earnings but blocks during the unresolved conflict', async t => {
  const d = await setup(household(0));
  assert.equal((await d.sync.check()).status, 'conflict'); await d.sync.resolve('cloud');
  d.sync.start(); t.after(() => d.sync.stop()); await d.sync.check();
  addSouls(d.local, 40); const op = captureCoopMoney(d.local, d.player.id);
  d.sync.markDirty();
  const remote = structuredClone(d.owned); remote.pets[0].name = 'Another device';
  d.fake.setRemote(d.player.id, remote, { device: 'iphone-other' });
  assert.equal((await d.sync.check()).status, 'conflict');
  const wallet = await d.server.wallet();
  assert.throws(() => assertCoopOpening(d.local, d.player.id, wallet, { conflict: !!d.sync.info().conflict }), { code: 'cloud_copy_required' });
  await d.sync.resolve('local');
  assert.doesNotThrow(() => assertCoopOpening(d.local, d.player.id, wallet, { conflict: !!d.sync.info().conflict }));
  assert.equal(d.local.mayhem.souls, 160); assert.ok(d.local.coop.money.pending.some(p => p.id === op.id));
  assert.equal(captureCoopMoney(d.local, d.player.id), null);
});

test('a genuinely pre-opening import cannot overwrite its current owned cloud household through autosave or Sync now', async t => {
  const d = await setup(household(0, 'Before Co-op'));
  await d.sync.check(); await d.sync.resolve('cloud');
  d.sync.start(); t.after(() => d.sync.stop()); await d.sync.check();
  const writes = d.fake.calls('push_save').length;
  for (const automatic of [true, false]) {
    d.replaceLocal(household(0, 'Before Co-op')); d.sync.markDirty();
    assert.equal(d.local.coop.money.openings[d.player.id], undefined);
    if (automatic) {
      d.events.dispatchEvent(new Event('shelflife:storage')); await d.runScheduled();
    } else await d.sync.syncNow();
    assert.ok(d.sync.info().conflict, 'missing local provenance requires an explicit copy choice');
    assert.equal(d.fake.calls('push_save').length, writes);
    assert.equal(d.fake.saves.get(d.player.id).data.mayhem.souls, 120);
    assert.equal(d.local.mayhem.souls, 0, 'reading the opening does not adopt the server purse');
    await d.sync.resolve('cloud');
    assert.equal(d.local.mayhem.souls, 120);
    assert.ok(d.local.coop.money.openings[d.player.id]);
    assert.equal(JSON.parse(d.saved.getItem(SAFETY_KEY)).mayhem.souls, 0);
  }
});

for (const change of ['account', 'household']) test('a delayed missing-opening provenance read cannot overwrite a replacement ' + change, async () => {
  const d = await setup(household(0));
  await d.sync.check(); await d.sync.resolve('cloud');
  d.replaceLocal(household(0)); d.sync.markDirty();
  const rpc = d.cloud.rpc.bind(d.cloud), writes = d.fake.calls('push_save').length;
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  d.cloud.rpc = async (name, ...args) => {
    const result = await rpc(name, ...args);
    if (name === 'pull_save') { entered(); await new Promise(resolve => { release = resolve; }); }
    return result;
  };
  const attempt = d.sync.push({ force: true }); await waiting;
  if (change === 'account') { await d.cloud.signOut(); await d.cloud.signInAnonymously(); }
  else d.replaceLocal(household(90, 'New import'));
  release(); await attempt;
  assert.equal(d.fake.calls('push_save').length, writes);
  assert.equal(d.fake.saves.get(d.player.id).data.mayhem.souls, 120);
  assert.equal(d.sync.info().conflict, null, 'an old account/household never creates a new recovery card');
  assert.equal(d.local.mayhem.souls, change === 'account' ? 0 : 90);
});

test('a trusted push refusal after preflight opens read-only recovery and does not retry the blocked upload', async t => {
  const d = await setup(household(0));
  await d.sync.check(); await d.sync.resolve('cloud');
  d.sync.start(); t.after(() => d.sync.stop()); await d.sync.check();
  const rpc = d.cloud.rpc.bind(d.cloud), writes = d.fake.calls('push_save').length;
  let refused = 0;
  d.cloud.rpc = (name, ...args) => {
    if (name === 'push_save') { refused++; throw new CloudError('cloud_copy_required', { code: 'P0001', status: 400 }); }
    return rpc(name, ...args);
  };
  d.sync.markDirty();
  const result = await d.sync.push({ force: true });
  assert.equal(result.status, 'conflict'); assert.equal(result.error.code, 'cloud_copy_required');
  assert.ok(result.conflict); assert.equal(refused, 1); assert.equal(d.scheduledCount(), 0);
  assert.equal(d.fake.calls('push_save').length, writes);
  assert.equal(d.fake.saves.get(d.player.id).data.mayhem.souls, 120);
  assert.equal(d.local.mayhem.souls, 120); assert.equal(d.local.coop.money.pending.length, 1);
  d.cloud.rpc = rpc; await d.sync.resolve('cloud');
  assert.equal(d.local.mayhem.souls, 120);
});


for (const action of ['weekly reward', 'curio purchase']) test('an old backup cannot replay a ' + action + ' without its complete cloud business state', async t => {
  const { almanacState } = await import('../src/almanac-state.js');
  const { weekNumber, weeklyChallenges, claimWeekly } = await import('../src/engine/almanac.js');
  const { commissionCurio } = await import('../src/engine/mayhem.js');
  const { applyCoopReceipts } = await import('../src/engine/coop.js');
  const now = Date.now(), task = weeklyChallenges(weekNumber(now))[0], curio = 'tooth-not-yours';
  let old;
  const d = await setup(household(100), s => {
    if (action === 'weekly reward') {
      const a = almanacState(s); a.week.no = weekNumber(now); a.week.done = [task.id]; a.week.claimed = [];
      old = normalizeState(structuredClone(s));
      assert.equal(claimWeekly(s, task.id, now).souls, 30);
    } else {
      delete s.mayhem.curios[curio]; old = normalizeState(structuredClone(s));
      assert.equal(commissionCurio(s, curio).cost, 80);
    }
  });
  // A real CAS push acknowledges the complete source household before the
  // ordinary money operation. The fixture's source device never vanishes with
  // only a wallet delta left behind on the server.
  const sourceSync = createSync({ cloud: d.player.cloud, storage: storage(), events: new EventTarget(), getState: () => d.owned, applyRemote: () => false });
  assert.equal((await sourceSync.check()).status, 'idle');
  assert.equal((await sourceSync.push({ force: true })).status, 'idle');
  assert.equal(d.player.cloud.meta().lastPushHash, saveHash(JSON.stringify(d.owned)));
  await d.server.adjustMoney(d.owned.coop.money.pending);
  const receipts = (await d.server.receipts()).receipts, before = structuredClone(old);
  assert.throws(() => applyCoopReceipts(old, d.player.id, receipts), { code: 'cloud_copy_required' });
  assert.deepEqual(old, before, 'no partial debit, credit, paid marker or cursor may change');
  assert.equal((await d.sync.check()).status, 'conflict');
  assert.equal((await d.sync.resolve('cloud')).status, 'idle');
  applyCoopReceipts(d.local, d.player.id, receipts);
  d.sync.start(); t.after(() => d.sync.stop()); await d.sync.check();
  // This is the same browser, with a current known baseRev. Restoring an old
  // backup must not let the usual autosave or manual Sync now overwrite the
  // needed source household just because its cloud revision is unchanged.
  const writes = d.fake.calls('push_save').length;
  d.replaceLocal(normalizeState(structuredClone(old))); d.sync.markDirty();
  d.events.dispatchEvent(new Event('shelflife:storage')); await d.runScheduled();
  assert.ok(d.sync.info().conflict); assert.equal(d.fake.calls('push_save').length, writes);
  assert.equal(d.fake.saves.get(d.player.id).data.mayhem.souls, action === 'weekly reward' ? 130 : 20);
  assert.equal(d.local.mayhem.souls, 100);
  await d.sync.resolve('cloud'); applyCoopReceipts(d.local, d.player.id, receipts);
  d.replaceLocal(normalizeState(structuredClone(old))); d.sync.markDirty();
  await d.sync.syncNow();
  assert.ok(d.sync.info().conflict); assert.equal(d.fake.calls('push_save').length, writes);
  assert.equal(d.local.mayhem.souls, 100);
  assert.equal((await d.sync.requestCopyChoice()).status, 'conflict');
  assert.equal(d.fake.calls('push_save').length, writes, 'the recovery button is read-only even with the known current cloud revision');
  assert.equal((await d.sync.resolve('cloud')).status, 'idle');
  applyCoopReceipts(d.local, d.player.id, receipts); applyCoopReceipts(d.local, d.player.id, receipts);
  if (action === 'weekly reward') {
    assert.equal(d.local.mayhem.souls, 130); assert.ok(d.local.almanac.week.claimed.includes(task.id));
    assert.equal(claimWeekly(d.local, task.id, now), null); assert.equal(d.local.mayhem.souls, 130);
  } else {
    assert.equal(d.local.mayhem.souls, 20); assert.equal(d.local.mayhem.curios[curio], 1);
    assert.equal(commissionCurio(d.local, curio), null, 'the price is not paid twice and the bought item is present');
  }
  assert.equal(d.local.coop.money.pending.length, 0); assert.equal(d.local.coop.ledger[d.player.id].seq, 1);
  const safety = JSON.parse(d.saved.getItem(SAFETY_KEY)); assert.equal(safety.mayhem.souls, 100);
  assert.equal(captureCoopMoney(d.local, d.player.id), null, 'restoring the whole shelf never becomes new income');
});
