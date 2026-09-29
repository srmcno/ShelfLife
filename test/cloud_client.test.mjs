import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloud, CloudError, CLOUD_KEY } from '../src/cloud/client.js';
import { CLOUD_CONFIG, cloudConfig, cloudConfigured } from '../src/cloud/config.js';
import { createSync } from '../src/cloud/sync.js';
import { createFakeSupabase, FAKE_CODE } from './support/fake-supabase.mjs';

function memory() {
  const items = new Map();
  return { items, getItem: k => items.has(k) ? items.get(k) : null, setItem: (k, v) => { items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
}
function setup(options = {}) {
  let clock = Date.UTC(2026, 8, 29, 12);
  const fake = createFakeSupabase({ now: () => clock });
  const storage = memory();
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage, now: () => clock, ...options });
  return { fake, storage, cloud, tick: ms => { clock += ms; } };
}

test('an unconfigured client never calls fetch and refuses every network method', async () => {
  let calls = 0;
  const storage = memory();
  const cloud = createCloud({ config: { url: '', anonKey: '' }, fetch: () => { calls++; throw new Error('network'); }, storage });
  assert.equal(cloud.configured, false);
  assert.equal(cloud.signedIn(), false);
  for (const attempt of [() => cloud.signInAnonymously(), () => cloud.requestEmailCode('a@b.co', { mode: 'signin' }), () => cloud.verifyEmailCode('a@b.co', '123456'),
    () => cloud.rpc('pull_save'), () => cloud.select('profiles'), () => cloud.deleteAccount()]) {
    await assert.rejects(attempt(), err => err instanceof CloudError);
  }
  await cloud.signOut();
  // The sync engine does not even listen when there is nothing to talk to.
  const events = new EventTarget();
  const sync = createSync({ cloud, getState: () => ({ pets: [] }), applyRemote: () => true, events, storage, timers: { setTimeout: () => { calls++; }, clearTimeout() {} } });
  sync.start();
  for (const type of ['shelflife:storage', 'visibilitychange', 'pagehide', 'online', 'pointerdown']) events.dispatchEvent(new Event(type));
  assert.equal(calls, 0);
  assert.equal(sync.status(), 'off');
  assert.equal(storage.items.size, 0, 'nothing is written to storage either');
});

test('the shipped config is empty, and tests can inject one', () => {
  assert.deepEqual(CLOUD_CONFIG, { url: '', anonKey: '' });
  assert.equal(cloudConfigured(), false);
  globalThis.SHELFLIFE_CLOUD_CONFIG = { url: 'https://x.supabase.co', anonKey: 'k' };
  try {
    assert.equal(cloudConfig().url, 'https://x.supabase.co');
    assert.equal(cloudConfigured(), true);
  } finally { delete globalThis.SHELFLIFE_CLOUD_CONFIG; }
  assert.equal(cloudConfigured({ url: 'not a url', anonKey: 'k' }), false);
});

test('the app singleton stays inert without config: no fetch, no storage, no listeners', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; return Promise.reject(new Error('no')); };
  try {
    const { cloud, sync, connectCloud } = await import('../src/cloud/index.js');
    assert.equal(cloud.configured, false);
    connectCloud({ applyRemote: () => true });
    await sync.check();
    await sync.push();
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previous; }
});

test('anonymous sign-in keeps its session in its own key and sends apikey and bearer', async () => {
  const { fake, storage, cloud } = setup();
  const session = await cloud.signInAnonymously();
  assert.equal(cloud.signedIn(), true);
  assert.equal(cloud.isAnonymous(), true);
  assert.equal(JSON.parse(storage.getItem(CLOUD_KEY)).session.user.id, session.user.id);
  assert.equal(storage.getItem('shelflife.v4'), null);
  assert.deepEqual(fake.requests[0], { method: 'POST', path: '/auth/v1/signup', search: '', auth: '', body: '{}' });
  assert.equal(await cloud.rpc('pull_save'), null);
  assert.equal(fake.requests.at(-1).auth, 'Bearer ' + session.access_token);
  // A second tap does not make a second account.
  await cloud.signInAnonymously();
  assert.equal(fake.users.size, 1);
});

test('a token close to expiry is refreshed before the request, once, even for parallel calls', async () => {
  const { fake, cloud, tick } = setup();
  const first = await cloud.signInAnonymously();
  tick((3600 - 30) * 1000);
  await Promise.all([cloud.rpc('pull_save'), cloud.rpc('pull_save'), cloud.select('saves')]);
  assert.equal(fake.calls('/auth/v1/token').length, 1);
  assert.notEqual(cloud.session().access_token, first.access_token);
  assert.ok(fake.requests.filter(r => r.path.startsWith('/rest/')).every(r => r.auth === 'Bearer ' + cloud.session().access_token));
});

test('a 401 refreshes and retries exactly once', async () => {
  const { fake, cloud } = setup();
  await cloud.signInAnonymously();
  fake.expireTokens();
  assert.equal(await cloud.rpc('pull_save'), null);
  assert.deepEqual(fake.requests.slice(-3).map(r => r.path), ['/rest/v1/rpc/pull_save', '/auth/v1/token', '/rest/v1/rpc/pull_save']);
  // A dead refresh token signs this device out instead of looping.
  fake.expireTokens();
  fake.revokeRefreshTokens();
  const before = fake.requests.length;
  await assert.rejects(cloud.rpc('pull_save'), err => err.code === 'session_expired' && err.status === 401);
  assert.equal(fake.requests.length - before, 2);
  assert.equal(cloud.signedIn(), false);
});

test('network failures are CloudErrors marked offline, including timeouts', async () => {
  const { fake, cloud } = setup({ timeoutMs: 40 });
  await cloud.signInAnonymously();
  fake.setOffline(true);
  await assert.rejects(cloud.rpc('pull_save'), err => err instanceof CloudError && err.offline === true && err.status === 0 && err.code === 'offline');
  fake.setOffline(false);
  fake.hangNext();
  await assert.rejects(cloud.rpc('pull_save'), err => err.offline === true && err.code === 'timeout');
  fake.failNext(1, 500);
  await assert.rejects(cloud.rpc('pull_save'), err => err.offline === false && err.status === 500 && err.code === 'fake_failure');
  assert.equal(cloud.signedIn(), true, 'server trouble never signs anyone out');
});

test('an anonymous account links an email with an email_change code and keeps its id', async () => {
  const { fake, cloud } = setup();
  const { user } = await cloud.signInAnonymously();
  const sent = await cloud.requestEmailCode('  Mabel@Example.com ');
  assert.deepEqual(sent, { email: 'mabel@example.com', mode: 'link' });
  assert.equal(fake.requests.at(-1).method, 'PUT');
  assert.equal(fake.requests.at(-1).path, '/auth/v1/user');
  await assert.rejects(cloud.verifyEmailCode('mabel@example.com', '999999'), err => err.status === 403 && err.code === 'otp_expired');
  const result = await cloud.verifyEmailCode('mabel@example.com', FAKE_CODE);
  assert.equal(JSON.parse(fake.requests.at(-1).body).type, 'email_change');
  assert.deepEqual(result, { userId: user.id, email: 'mabel@example.com', switched: false });
  assert.equal(cloud.isAnonymous(), false);
  assert.equal(cloud.email(), 'mabel@example.com');
  assert.equal(cloud.pendingEmail(), null);
});

test('linking an email that already has an account says so', async () => {
  const { fake, cloud } = setup();
  await cloud.requestEmailCode('taken@example.com', { mode: 'signin' });
  await cloud.verifyEmailCode('taken@example.com', FAKE_CODE);
  await cloud.signOut();
  await cloud.signInAnonymously();
  await assert.rejects(cloud.requestEmailCode('taken@example.com'), err => err.code === 'email_exists' && err.status === 422);
  assert.equal(fake.users.size, 2);
});

test('the deletion page asks for a code without ever creating an account', async () => {
  const { fake, cloud } = setup();
  await assert.rejects(cloud.requestEmailCode('nobody@example.com', { mode: 'signin', create: false }), err => err.status === 422);
  assert.deepEqual(JSON.parse(fake.requests.at(-1).body), { email: 'nobody@example.com', create_user: false });
  assert.equal(fake.users.size, 0);
  assert.equal(cloud.pendingEmail(), null);
});

test('signing in by code uses otp with create_user and reports a switched account', async () => {
  const { fake, cloud } = setup();
  const anon = await cloud.signInAnonymously();
  await cloud.requestEmailCode('pip@example.com', { mode: 'signin' });
  assert.deepEqual(JSON.parse(fake.requests.at(-1).body), { email: 'pip@example.com', create_user: true });
  assert.equal(fake.requests.at(-1).auth, '', 'otp is not tied to the old session');
  const changes = [];
  cloud.subscribe(change => changes.push(change));
  const result = await cloud.verifyEmailCode('pip@example.com', FAKE_CODE);
  assert.equal(JSON.parse(fake.requests.at(-1).body).type, 'email');
  assert.equal(result.switched, true);
  assert.notEqual(result.userId, anon.user.id);
  assert.deepEqual(changes, [{ type: 'session', userChanged: true }]);
  await assert.rejects(cloud.verifyEmailCode('pip@example.com', 'abc'), err => err.code === 'invalid_code');
  await assert.rejects(cloud.requestEmailCode('not an email'), err => err.code === 'invalid_email');
});

test('sign out posts logout and clears the session even when offline', async () => {
  const { fake, cloud } = setup();
  await cloud.signInAnonymously();
  await cloud.signOut();
  assert.equal(fake.requests.at(-1).path, '/auth/v1/logout');
  assert.equal(fake.requests.at(-1).search, '?scope=local');
  assert.equal(cloud.signedIn(), false);
  await cloud.signInAnonymously();
  fake.setOffline(true);
  await cloud.signOut();
  assert.equal(cloud.signedIn(), false);
});

test('select reads only the caller rows, and delete_my_account ends the account', async () => {
  const { fake, cloud } = setup();
  await cloud.signInAnonymously();
  const profile = await cloud.rpc('ensure_profile', { p_name: '  Judge Mortis the Very Long Named Skeleton  ' });
  assert.match(profile.friend_code, /^[A-HJKMNP-Z2-9]{8}$/);
  assert.equal(profile.display_name, 'Judge Mortis the Very Lo');
  const rows = await cloud.select('profiles', 'select=friend_code,display_name&user_id=eq.' + cloud.userId());
  assert.deepEqual(rows, [profile]);
  await assert.rejects(cloud.select('Robert\'); drop table'), err => err.code === 'bad_name');
  const id = cloud.userId();
  await cloud.deleteAccount();
  assert.equal(cloud.signedIn(), false);
  assert.equal(fake.users.has(id), false);
  assert.equal(fake.profiles.has(id), false);
});
