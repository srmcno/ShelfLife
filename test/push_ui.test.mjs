import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendsSections } from '../src/ui/social-registry.js';
import { initPush } from '../src/ui/push.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('a stale notification lookup cannot restore state after the same account signs in again', async () => {
  let finishOld, calls = 0, listener;
  const cloud = { subscribe(fn) { listener = fn; return () => { listener = null; }; } };
  const client = {
    available: () => true,
    appleNeedsInstall: () => false,
    current() { return ++calls === 1 ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(null); },
    settings: async () => ({})
  };
  const ctx = { cloud, me: { userId: 'ada' }, isCurrent: () => true, refresh() {} };
  initPush(client);
  const section = friendsSections('home').find(item => item.id === 'push');
  assert.match(section.render(ctx), /Checking this device/);
  listener({ type: 'session', signedOut: true });
  listener({ type: 'session', userChanged: true });
  assert.match(section.render(ctx), /Checking this device/);
  await flush();
  assert.match(section.render(ctx), /Turn on notifications/);
  finishOld({ endpoint: 'stale' });
  await flush();
  assert.match(section.render(ctx), /Turn on notifications/);
  assert.doesNotMatch(section.render(ctx), /Turn off notifications/);
  initPush(null);
});
