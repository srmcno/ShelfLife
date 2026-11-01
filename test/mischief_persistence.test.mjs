import test from 'node:test';
import assert from 'node:assert/strict';
import { initMischief } from '../src/ui/mischief.js';
import { resetSocialRegistry } from '../src/ui/social-registry.js';
import { householdFixture } from './household-fixtures.mjs';

const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('neighbour help is not acknowledged until its shelf and pending acknowledgement are saved', async t => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  globalThis.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, hidden: false };
  t.mock.method(globalThis, 'setInterval', () => 0);
  t.mock.method(globalThis, 'setTimeout', () => 0);
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    resetSocialRegistry();
  });
  const state = householdFixture('established');
  state.pets[0].needs.food = 20;
  let canSave = false, acknowledged = 0;
  const cloud = { configured: true, userId: () => U(1), async rpc(name) {
    if (name === 'mischief_inbox') return { helps: acknowledged ? [] : [{ id: U(3), from_user: U(2), from_name: 'Bea', resident_id: 'qa0', resident_name: 'Agnes', need: 'food', amount: 25, created_at: new Date().toISOString() }] };
    if (name === 'ack_helps') { acknowledged++; return { count: 1 }; }
    throw new Error('Unexpected RPC: ' + name);
  } };
  const social = { signedIn: () => true, active: () => true, subscribe() {} };
  const mischief = initMischief({ state, cloud, social, persistPending: () => canSave });
  await mischief.sync();
  assert.equal(acknowledged, 0, 'a failed save leaves the server help available');
  assert.equal(state.pets[0].needs.food, 45);
  assert.equal(state.mischief.outbox.length, 1);
  canSave = true;
  await mischief.sync();
  assert.equal(acknowledged, 1, 'a later successful save allows acknowledgement');
  assert.equal(state.pets[0].needs.food, 45, 'retry does not apply the same help twice');
});
