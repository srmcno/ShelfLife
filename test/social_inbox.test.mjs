import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInboxMonitor, INBOX_CHECK_MS } from '../src/cloud/inbox.js';
import { createSocial } from '../src/cloud/social.js';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const ID = '00000000-0000-4000-8000-000000000003';
const raw = { cases: [{ id: ID, from_user: B, case_id: 'borrowed-coffin', plaintiff: { id: 'p1', name: 'Mabel' }, defendant: { id: 'p2', name: 'Pip' } }], results: [] };
function setup({ optIn = true } = {}) {
  let uid = A, metadata = { socialUser: optIn ? A : undefined }, visible = true;
  const listeners = new Set(), notices = [], requests = [], timers = new Map();
  const cloud = { configured: true, signedIn: () => !!uid, userId: () => uid,
    meta: () => metadata, setMeta: patch => { metadata = { ...metadata, ...patch }; },
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    rpc: async name => { requests.push(name); return name === 'inbox' ? raw : { ok: true }; }
  };
  const social = createSocial({ cloud });
  const monitor = createInboxMonitor({ cloud, social, visible: () => visible,
    onChange: box => notices.push(box), schedule: (fn, ms) => { assert.equal(ms, INBOX_CHECK_MS); timers.set(fn, ms); return fn; }, cancel: fn => timers.delete(fn) });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { cloud, social, monitor, notices, requests, timers, settle,
    setVisible: value => { visible = value; }, switchTo: id => { uid = id; listeners.forEach(fn => fn({ userChanged: true })); } };
}

test('foreground checks discover papers without acknowledging or paying them', async () => {
  const s = setup(); s.monitor.start(); await s.settle();
  assert.equal(s.notices.at(-1).cases[0].id, ID);
  assert.deepEqual(s.requests, ['inbox']);
  assert.equal(s.social.inboxCount(), 1);
  await s.social.decline(ID);
  assert.equal(s.notices.at(-1).cases.length, 0);
  s.monitor.stop(); assert.equal(s.timers.size, 0);
});

test('the monitor is inert before Friends opt-in and stops when signed out', async () => {
  const s = setup({ optIn: false }); s.monitor.start(); await s.monitor.refresh();
  assert.deepEqual(s.requests, []); assert.equal(s.timers.size, 0);
  s.social.optIn(); await s.settle(); assert.deepEqual(s.requests, ['inbox']);
  s.switchTo(null); assert.equal(s.timers.size, 0); assert.deepEqual(s.notices.at(-1), { cases: [], results: [] });
  await s.monitor.refresh(); assert.deepEqual(s.requests, ['inbox']);
  s.monitor.stop();
});

test('hidden pages do not poll and failed checks retain mail for the next retry', async () => {
  const s = setup(); s.monitor.start(); await s.settle();
  s.setVisible(false); await s.monitor.refresh(); assert.deepEqual(s.requests, ['inbox']);
  s.setVisible(true); s.cloud.rpc = async () => { throw new Error('offline'); };
  assert.equal(await s.monitor.refresh(), false); assert.equal(s.social.inboxState().cases.length, 1);
  s.cloud.rpc = async () => ({ cases: [], results: [] });
  assert.equal(await s.monitor.refresh(), true); assert.equal(s.notices.at(-1).cases.length, 0);
  s.monitor.stop();
});

test('overlapping checks share one request and discard a former account reply', async () => {
  const s = setup(); let resolve;
  s.cloud.rpc = () => new Promise(done => { resolve = done; });
  const first = s.social.inbox(); assert.equal(s.social.inbox(), first);
  s.switchTo(B); resolve(raw);
  assert.deepEqual(await first, { cases: [], results: [] });
  assert.deepEqual(s.social.inboxState(), { cases: [], results: [] });
  assert.equal(s.social.inboxCount(), 0);
});

test('late polling and acknowledgements cannot revive read mail or alter a different account', async () => {
  const s = setup(); await s.social.inbox(); let finishPoll;
  s.cloud.rpc = name => name === 'inbox' ? new Promise(done => { finishPoll = done; }) : Promise.resolve({ ok: true });
  const poll = s.social.inbox(); await s.social.decline(ID); finishPoll(raw);
  assert.deepEqual(await poll, { cases: [], results: [] });
  let finishSeen; s.cloud.rpc = () => new Promise(done => { finishSeen = done; });
  const seen = s.social.seen(ID); s.switchTo(B); s.cloud.setMeta({ socialUser: B, inboxCount: 7 }); finishSeen({ ok: true });
  await seen; assert.equal(s.social.inboxCount(), 7);
});
