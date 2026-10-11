import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedback, FEEDBACK_KEY } from '../src/cloud/feedback.js';
import { CloudError } from '../src/cloud/client.js';

// A labelled mock RPC boundary isolates client sequencing and stale completion.
function mockConsent(initial = {}) {
  const items = new Map([[FEEDBACK_KEY, JSON.stringify(initial)]]), calls = [], replies = {};
  let user = 'account-one';
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
  const cloud = { configured: true, signedIn: () => !!user, userId: () => user,
    rpc: async (name, args) => { calls.push([name, args]); return replies[name] ? replies[name](args) : { ok: true }; } };
  return { feedback: createFeedback({ cloud, storage }), storage, calls, replies, setUser(value) { user = value; } };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('passive marks respect server opt-out without caching a counted day', async () => {
  const { feedback, replies } = mockConsent();
  replies.mark_play_day = () => ({ ok: true, counted: false, opted_out: true });
  const events = []; feedback.subscribe(change => events.push(change));
  assert.equal(await feedback.markPlayDay(), false);
  assert.equal(feedback.meta().playDay, undefined);
  assert.equal(events.at(-1)?.optedOut, 'account-one');
});

test('only an acknowledged explicit resume clears the pending opt-out', async () => {
  const { feedback, replies, calls } = mockConsent({ forget: 'account-one' });
  const gate = deferred(); replies.resume_play_days = () => gate.promise;
  const work = feedback.resumePlayDays();
  assert.equal(typeof work?.then, 'function');
  assert.equal(feedback.meta().forget, 'account-one');
  assert.equal(calls[0]?.[0], 'resume_play_days');
  gate.resolve({ ok: true, opted_out: false }); assert.equal(await work, true);
  assert.equal(feedback.meta().forget, undefined);
});

test('a failed explicit resume remains off and never queues an automatic opt-in', async () => {
  const { feedback, replies, calls } = mockConsent({ forget: 'account-one' });
  replies.resume_play_days = () => { throw new CloudError('offline', { code: 'offline' }); };
  await assert.rejects(feedback.resumePlayDays(), error => error.code === 'offline');
  assert.equal(feedback.meta().forget, 'account-one');
  assert.equal(calls.length, 1);
});

for (const change of ['account', 'shelf']) test(`resume acknowledgement is fenced after a replacement ${change}`, async () => {
  const { feedback, replies, setUser } = mockConsent({ forget: 'account-one' });
  let current = true; const gate = deferred(); replies.resume_play_days = () => gate.promise;
  const work = feedback.resumePlayDays({ current: () => current });
  assert.equal(typeof work?.then, 'function');
  if (change === 'account') setUser('account-two'); else current = false;
  gate.resolve({ ok: true, opted_out: false });
  await assert.rejects(work, error => error.code === 'signed_out');
  assert.equal(feedback.meta().forget, 'account-one');
});

test('explicit resume waits for an earlier in-flight forget before enabling counting', async () => {
  const { feedback, replies, calls } = mockConsent();
  const gate = deferred(); replies.forget_play_days = () => gate.promise;
  replies.resume_play_days = () => ({ ok: true, opted_out: false });
  const off = feedback.forgetPlayDays(), on = feedback.resumePlayDays();
  assert.equal(typeof on?.then, 'function');
  assert.deepEqual(calls.map(c => c[0]), ['forget_play_days']);
  gate.resolve({ ok: true }); await off; assert.equal(await on, true);
  assert.deepEqual(calls.map(c => c[0]), ['forget_play_days', 'resume_play_days']);
});


test('resume does not claim a durable opt-in if clearing the pending opt-out fails', async () => {
  const { feedback, storage, replies } = mockConsent({ forget: 'account-one' });
  replies.resume_play_days = () => ({ ok: true, opted_out: false });
  storage.setItem = () => { throw Error('storage full'); };
  await assert.rejects(feedback.resumePlayDays(), error => error.code === 'storage_failed');
  assert.equal(feedback.meta().forget, 'account-one');
});

test('opting in another account preserves the previous account’s pending opt-out', async () => {
  const { feedback, replies, setUser } = mockConsent({ forget: 'account-one' });
  setUser('account-two'); replies.resume_play_days = () => ({ ok: true, opted_out: false });
  assert.equal(await feedback.resumePlayDays(), true);
  assert.equal(feedback.meta().forget, 'account-one');
});

test('two offline owners retain independent opt-outs and retry only while each is authenticated', async () => {
  const { feedback, replies, calls, setUser } = mockConsent();
  replies.forget_play_days = () => { throw new CloudError('offline', { code: 'offline' }); };
  assert.equal(await feedback.forgetPlayDays(), false);
  setUser('account-two'); assert.equal(await feedback.forgetPlayDays(), false);
  assert.deepEqual(feedback.meta().forgetUsers, ['account-one', 'account-two']);
  setUser('unrelated-account'); const before = calls.length;
  assert.equal(await feedback.retryForget(), false); assert.equal(calls.length, before);
  replies.forget_play_days = () => ({ ok: true });
  setUser('account-one'); assert.equal(await feedback.retryForget(), true);
  assert.deepEqual(feedback.meta().forgetUsers, ['account-two']);
  setUser('account-two'); assert.equal(await feedback.retryForget(), true);
  assert.equal(feedback.meta().forgetUsers, undefined);
  assert.equal(calls.some(c => c[0] === 'resume_play_days'), false, 'retry never opts in');
});

test('resuming B removes only B from a migrated multi-owner pending-off queue', async () => {
  const { feedback, replies, setUser } = mockConsent({ forget: 'account-one', forgetUsers: ['account-two'] });
  setUser('account-two'); replies.resume_play_days = () => ({ ok: true, opted_out: false });
  assert.equal(await feedback.resumePlayDays(), true);
  assert.deepEqual(feedback.meta().forgetUsers, ['account-one']);
});

test('background retry cannot enqueue an off behind an explicit pending on', async () => {
  const { feedback, replies, calls } = mockConsent();
  const gate = deferred(); replies.forget_play_days = () => gate.promise;
  replies.resume_play_days = () => ({ ok: true, opted_out: false });
  const off = feedback.forgetPlayDays(), on = feedback.resumePlayDays();
  assert.equal(await feedback.retryForget(), false);
  gate.resolve({ ok: true }); await off; await on;
  assert.deepEqual(calls.map(c => c[0]), ['forget_play_days', 'resume_play_days']);
});

test('a queued explicit opt-in is cancelled after account replacement while the new owner can opt in independently', async () => {
  const { feedback, replies, calls, setUser } = mockConsent();
  const gate = deferred(); replies.forget_play_days = () => gate.promise;
  replies.resume_play_days = () => ({ ok: true, opted_out: false });
  const off = feedback.forgetPlayDays(), oldOn = feedback.resumePlayDays();
  const oldRejected = assert.rejects(oldOn, error => error.code === 'signed_out');
  setUser('account-two'); assert.equal(await feedback.resumePlayDays(), true);
  assert.deepEqual(calls.map(c => c[0]), ['forget_play_days', 'resume_play_days']);
  gate.resolve({ ok: true }); await off; await oldRejected;
  assert.equal(feedback.meta().forget, 'account-one');
  assert.equal(calls.filter(c => c[0] === 'resume_play_days').length, 1, 'only the new owner resume reaches the server');
});

test('pending privacy requests are not capped by the ten-report feedback limit', async () => {
  const owners = Array.from({ length: 12 }, (_, i) => 'previous-' + i);
  const { feedback, replies } = mockConsent({ forgetUsers: owners });
  replies.forget_play_days = () => { throw new CloudError('offline', { code: 'offline' }); };
  assert.equal(await feedback.forgetPlayDays(), false);
  assert.deepEqual(feedback.meta().forgetUsers, [...owners, 'account-one']);
});
