import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState } from '../src/state.js';
import { bindCoopMoney, captureCoopMoney, assertCoopOpening } from '../src/engine/coop-money.js';
import { addSouls } from '../src/engine/mayhem.js';
import { createCloud } from '../src/cloud/client.js';
import { createSync, SAFETY_KEY } from '../src/cloud/sync.js';
import { createCoop } from '../src/cloud/coop.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { householdFixture } from './household-fixtures.mjs';
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
function household(souls, name = 'Agnes') {
  const raw = householdFixture('established'); raw.pets[0].name = name;
  raw.mayhem.souls = souls; raw.mayhem.lifetime = souls; return normalizeState(raw);
}
async function setup(local) {
  // Labelled in-memory Supabase; authentication, copy decisions and wallet
  // readers use the actual clients and sync engine, without a live account.
  const fake = createFakeSupabase(), owned = household(100), player = await socialPlayer(fake, 'Ada', owned);
  bindCoopMoney(owned, player.id);
  const server = createCoop({ cloud: player.cloud, social: player.social }); await server.openWallet(100);
  addSouls(owned, 20); captureCoopMoney(owned, player.id);
  fake.setRemote(player.id, owned, { device: 'android-original' });
  const saved = storage(); saved.setItem('shelflife.cloud', JSON.stringify({ session: player.session }));
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: saved });
  const sync = createSync({ cloud, storage: saved, getState: () => local, applyRemote(next) { local = next; return true; }, events: new EventTarget() });
  return { fake, player, server, owned, sync, saved, get local() { return local; } };
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

test('keeping an unrelated local shelf preserves both copies without declaring another opening grant', async () => {
  const d = await setup(household(50, 'Local choice'));
  assert.equal((await d.sync.check()).status, 'conflict');
  assert.equal((await d.sync.resolve('local')).status, 'idle');
  assert.equal(d.local.mayhem.souls, 50); assert.equal(d.local.pets[0].name, 'Local choice');
  assert.equal(d.local.coop.money.pending.length, 0);
  const wallet = await d.server.wallet();
  assert.throws(() => assertCoopOpening(d.local, d.player.id, wallet), { code: 'cloud_copy_required' });
  const safety = JSON.parse(d.saved.getItem(SAFETY_KEY)); assert.equal(safety.mayhem.souls, 120);
  assert.equal((await d.server.wallet()).balance, 100, 'the cloud-copy choice is not a currency adjustment');
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
