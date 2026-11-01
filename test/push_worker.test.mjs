import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
function worker(windows = []) {
  const handlers = {}, shown = [], opened = [], calls = [];
  const self = { registration: { scope: 'https://example.test/game/', async showNotification(title, options) { shown.push({ title, options }); } },
    clients: { async matchAll(options) { calls.push(options); return windows; }, async openWindow(url) { opened.push(url); } },
    addEventListener(type, fn) { handlers[type] = fn; }, location: { origin: 'https://example.test' } };
  runInNewContext(readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'), { self, URL, Set, Request, Response, AbortController, setTimeout, clearTimeout });
  const dispatch = async (type, fields = {}) => { let promise; handlers[type]({ ...fields, waitUntil(value) { promise = value; } }); await promise; };
  return { handlers, shown, opened, calls, dispatch };
}
test('push presents a bounded notification and survives missing or malformed payloads', async () => {
  const sw = worker();
  await sw.dispatch('push', { data: { json: () => ({ title: '<script>', body: 'x'.repeat(200) }) } });
  assert.equal(sw.shown[0].title, 'Shelf Life');
  assert.equal(sw.shown[0].options.body.length, 160);
  assert.equal(sw.shown[0].options.tag, 'shelflife-postbox');
  await sw.dispatch('push', { data: { json: () => { throw new Error('invalid'); } } });
  assert.equal(sw.shown[1].options.body, 'Something arrived in your postbox.');
  await sw.dispatch('push');
  assert.equal(sw.shown[2].options.body, 'Something arrived in your postbox.');
});
test('notification click closes it, navigates and focuses an existing app window', async () => {
  const steps = [], target = 'https://example.test/game/?open=postbox';
  const sw = worker([{ url: 'https://other.test/', navigate: () => { throw Error('wrong window'); } }, { url: 'https://example.test/game/index.html', async navigate(url) { steps.push(['navigate',url]); }, async focus() { steps.push(['focus']); } }]);
  let closed = false;
  await sw.dispatch('notificationclick', { notification: { close() { closed = true; } } });
  assert.equal(closed, true); assert.deepEqual(steps, [['navigate', target], ['focus']]); assert.deepEqual(sw.opened, []);
});
test('notification click opens the scoped postbox when no app window exists', async () => {
  const sw = worker(); let closed = false;
  await sw.dispatch('notificationclick', { notification: { close() { closed = true; } } });
  assert.equal(closed, true); assert.deepEqual(sw.opened, ['https://example.test/game/?open=postbox']);
});
