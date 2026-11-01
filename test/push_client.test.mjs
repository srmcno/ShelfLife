import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPush, isAppleMobile, PUSH_CLEANUP_KEY } from '../src/cloud/push.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';

function browser() {
  let subscription = null, prompts = 0;
  const item = { endpoint: 'https://fcm.googleapis.com/test', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'a'.repeat(22) } }; }, async unsubscribe() { subscription = null; return true; } };
  const manager = { async getSubscription() { return subscription; }, async subscribe() { subscription = item; return item; } };
  return { nav: { userAgent: 'test', platform: 'test', serviceWorker: { ready: Promise.resolve({ pushManager: manager }) } }, notification: { async requestPermission() { prompts++; return 'granted'; } }, pushManager: function PushManager() {}, native: () => false, match: () => ({ matches: false }), get prompts() { return prompts; }, item };
}
test('permission is requested only on subscription, and sign-out cleanup removes both copies', async () => {
  const fake = createFakeSupabase(), player = await socialPlayer(fake, 'Ada'), device = browser();
  const push = createPush({ cloud: player.cloud, publicKey: 'AQ', ...device });
  assert.equal(push.available(), true); assert.equal(device.prompts, 0); assert.equal(await push.current(), null);
  await push.subscribe(); assert.equal(device.prompts, 1); assert.equal(fake.push.subscriptions.size, 1);
  assert.equal((await push.settings()).court, true);
  assert.equal((await push.set('court', false)).court, false);
  await push.unsubscribe(); assert.equal(fake.push.subscriptions.size, 0); assert.equal(await push.current(), null);
});
test('iPad desktop agents are told to install, unsupported and native devices hide the control', () => {
  assert.equal(isAppleMobile({ platform: 'MacIntel', maxTouchPoints: 5, userAgent: 'Macintosh' }), true);
  const cloud = { configured: true }, nav = { platform: 'MacIntel', maxTouchPoints: 5, userAgent: 'Macintosh' };
  const push = createPush({ cloud, nav, publicKey: 'AQ', native: () => false, match: () => ({ matches: false }) });
  assert.equal(push.available(), true); assert.equal(push.appleNeedsInstall(), true);
  assert.equal(createPush({ cloud, publicKey: '', native: () => false }).available(), false);
  assert.equal(createPush({ cloud, nav, publicKey: 'AQ', native: () => true }).available(), false);
});
test('a failed server registration removes a newly created browser subscription', async () => {
  const device = browser();
  const cloud = { configured: true, userId: () => 'one', async rpc() { throw new Error('offline'); } };
  const push = createPush({ cloud, publicKey: 'AQ', ...device });
  await assert.rejects(push.subscribe(), /offline/);
  assert.equal(await push.current(), null);
});
test('an account switch during registration never leaves a subscription on the new account', async () => {
  const device = browser(); let user = 'one';
  const cloud = { configured: true, userId: () => user, async rpc() { user = 'two'; } };
  const push = createPush({ cloud, publicKey: 'AQ', ...device });
  await assert.rejects(push.subscribe(), /account changed/i);
  assert.equal(await push.current(), null);
});
test('offline account exit revokes the browser endpoint and does not strand the user', async () => {
  const fake = createFakeSupabase(), player = await socialPlayer(fake, 'Ada'), device = browser();
  const push = createPush({ cloud: player.cloud, publicKey: 'AQ', ...device });
  await push.subscribe();
  fake.setOffline(true);
  const result = await push.unsubscribe();
  assert.deepEqual(result, { removedFromServer: false, removedLocally: true });
  assert.equal(await push.current(), null);
  assert.equal(fake.push.subscriptions.size, 1, 'stale server row awaits 404/410 cleanup');
});
test('unavailable service worker never hangs account exit', async () => {
  const cloud = { configured: true, userId: () => 'one' };
  const nav = { serviceWorker: { ready: new Promise(() => {}), getRegistration() { return new Promise(() => {}); } }, userAgent: 'test' };
  const push = createPush({ cloud, nav, publicKey: 'AQ', notification: {}, pushManager: function PushManager() {}, native: () => false, registrationTimeoutMs: 20 });
  const started = Date.now();
  assert.deepEqual(await push.unsubscribe(), { cleanupPending: true });
  assert.ok(Date.now() - started < 1000);
});

test('uncertain exit persists cleanup and a new account cannot register until the old endpoint is revoked', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let blocked = true, active = true, user = 'old', prompts = 0, registered = 0;
  const old = { endpoint: 'https://fcm.googleapis.com/old', async unsubscribe() { active = false; return true; } };
  const next = { endpoint: 'https://fcm.googleapis.com/new', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'a'.repeat(22) } }; }, async unsubscribe() { return true; } };
  const manager = { async getSubscription() { return active ? old : null; }, async subscribe() { return next; } };
  const nav = { userAgent: 'test', serviceWorker: { getRegistration() { return blocked ? new Promise(() => {}) : Promise.resolve({ pushManager: manager }); }, ready: Promise.resolve({ pushManager: manager }) } };
  const cloud = { configured: true, userId: () => user, async rpc(name) { if (name === 'push_subscribe') registered++; } };
  const options = { cloud, storage, nav, publicKey: 'AQ', notification: { async requestPermission() { prompts++; return 'granted'; } }, pushManager: function PushManager() {}, native: () => false, registrationTimeoutMs: 20 };
  assert.deepEqual(await createPush(options).unsubscribe(), { cleanupPending: true });
  assert.ok(storage.getItem(PUSH_CLEANUP_KEY));
  user = 'new';
  const reloaded = createPush(options);
  await assert.rejects(reloaded.subscribe(), /earlier notification/);
  assert.equal(prompts, 0); assert.equal(registered, 0); assert.equal(active, true);
  blocked = false;
  await reloaded.subscribe();
  assert.equal(active, false); assert.equal(storage.getItem(PUSH_CLEANUP_KEY), null);
  assert.equal(prompts, 1); assert.equal(registered, 1);
});

test('confirmed empty worker clears a pending marker without attempting revocation', async () => {
  const values = new Map([[PUSH_CLEANUP_KEY, '1']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const nav = { userAgent: 'test', serviceWorker: { async getRegistration() { return null; }, ready: new Promise(() => {}) } };
  const push = createPush({ cloud: { configured: true, userId: () => 'new' }, storage, nav, publicKey: 'AQ', notification: {}, pushManager: function PushManager() {}, native: () => false });
  assert.equal(await push.current(), null);
  assert.equal(storage.getItem(PUSH_CLEANUP_KEY), null);
});

test('pending cleanup runs on startup, online, and account changes without cloud requests', async () => {
  const values = new Map([[PUSH_CLEANUP_KEY, 'first']]), listeners = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const events = { addEventListener(type, cb) { listeners.set(type, cb); }, removeEventListener(type) { listeners.delete(type); } };
  let cloudListener, rpcCalls = 0, revocations = 0, active = true, blocked = false;
  const cloud = { configured: false, subscribe(fn) { cloudListener = fn; return () => { cloudListener = null; }; }, async rpc() { rpcCalls++; throw new Error('must not call'); } };
  const old = { async unsubscribe() { active = false; revocations++; return true; } };
  const nav = { userAgent: 'test', serviceWorker: { async getRegistration() { if (blocked) throw new Error('worker unavailable'); return { pushManager: { async getSubscription() { return active ? old : null; } } }; } } };
  const push = createPush({ cloud, storage, events, nav, native: () => false, registrationTimeoutMs: 20 });
  assert.equal(await push.start(), true); assert.equal(revocations, 1); assert.equal(values.has(PUSH_CLEANUP_KEY), false);
  active = true; blocked = true; values.set(PUSH_CLEANUP_KEY, 'second');
  listeners.get('online')();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(values.get(PUSH_CLEANUP_KEY), 'second'); assert.equal(revocations, 1);
  blocked = false; cloudListener({ type: 'session', userChanged: true });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(values.has(PUSH_CLEANUP_KEY), false); assert.equal(revocations, 2);
  active = true; values.set(PUSH_CLEANUP_KEY, 'third'); listeners.get('online')();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(values.has(PUSH_CLEANUP_KEY), false); assert.equal(revocations, 3);
  assert.equal(rpcCalls, 0);
  push.stop(); assert.equal(listeners.size, 0); assert.equal(cloudListener, null);
});

test('an older cleanup cannot clear a newer account exit marker', async () => {
  const values = new Map([[PUSH_CLEANUP_KEY, 'old']]); let finish;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const old = { unsubscribe: () => new Promise(resolve => { finish = resolve; }) };
  const nav = { userAgent: 'test', serviceWorker: { async getRegistration() { return { pushManager: { async getSubscription() { return old; } } }; } } };
  const push = createPush({ cloud: { configured: false }, storage, nav, native: () => false });
  const attempt = push.start();
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  values.set(PUSH_CLEANUP_KEY, 'new'); finish(true);
  assert.equal(await attempt, false); assert.equal(values.get(PUSH_CLEANUP_KEY), 'new');
});
