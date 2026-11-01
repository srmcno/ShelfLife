import test from 'node:test';
import assert from 'node:assert/strict';
import { initMischief } from '../src/ui/mischief.js';
import { resetSocialRegistry, socialView } from '../src/ui/social-registry.js';
import { householdFixture } from './household-fixtures.mjs';
import { createSocial } from '../src/cloud/social.js';
import { state as originalState, setState, SAVE_KEY } from '../src/state.js';
import { receiveInbox } from '../src/engine/mischief.js';

const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('late help and knock responses cannot award a replaced account context with the same user ID', async t => {
  // Minimal view stubs isolate the controller's identity boundary; actual DOM routes
  // and saved payouts are covered by browser/mischief.spec.mjs.
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = { addEventListener() {} };
  globalThis.document = { addEventListener() {}, getElementById: () => null };
  t.mock.method(globalThis, 'setInterval', () => 0);
  t.mock.method(globalThis, 'setTimeout', () => 0);
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    resetSocialRegistry();
  });
  for (const action of ['help', 'knock']) {
    resetSocialRegistry();
    const state = householdFixture('established'), before = structuredClone(state);
    let finish, current = true, refreshes = 0, shows = 0;
    const cloud = { configured: true, userId: () => U(1), rpc: () => new Promise(resolve => { finish = resolve; }) };
    const social = { signedIn: () => true, active: () => true, subscribe() {} };
    initMischief({ state, cloud, social, refresh: () => { refreshes++; } });
    const status = { textContent: '' };
    const root = { dataset: { mxFriend: U(2) }, querySelector: () => status, querySelectorAll: () => [] };
    const el = { dataset: { mxNeed: 'food', mxRes: 'qa0' }, closest: selector => selector === '.mx-help-row' ? { querySelector: () => ({ textContent: 'Snag' }) } : root };
    const ctx = { friend: () => ({ userId: U(2), name: 'Bea' }), isCurrent: () => current, show: () => { shows++; } };
    const pending = socialView('mischief-' + action).onClick(action, el, ctx);
    current = false;
    finish(action === 'help' ? { id: U(3), amount: 25 } : { id: U(3), result: 'treat', prize: 'souls', souls: 10 });
    await pending;
    assert.deepEqual(state, before, action + ' cannot change the replacement save');
    assert.equal(refreshes, 0);
    assert.equal(shows, 0);
  }
});

test('all social block entry points clean and save the matching shelf, but not a replacement context', async t => {
  const priorState = originalState;
  const previousWindow = globalThis.window, previousDocument = globalThis.document, previousStorage = globalThis.localStorage;
  const disk = new Map();
  globalThis.localStorage = { getItem: k => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, String(v)), removeItem: k => disk.delete(k) };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  globalThis.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, hidden: false };
  t.mock.method(globalThis, 'setInterval', () => 0);
  t.mock.method(globalThis, 'setTimeout', () => 0);
  t.after(() => {
    setState(priorState); resetSocialRegistry();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  });
  for (const scenario of ['success', 'restore', 'account', 'new-account-before-sync']) {
    resetSocialRegistry();
    const shelf = householdFixture('established'); setState(shelf);
    let owner = U(1), finish;
    receiveInbox(shelf, { hexes: [], hauntings: [], helps: [{ id: U(3), fromUser: U(2), fromName: 'Bea', residentId: 'qa0', need: 'food', amount: 25, createdAt: Date.now() }] }, owner);
    const cloud = { configured: true, signedIn: () => true, userId: () => owner, meta: () => ({ socialUser: owner }), rpc: () => new Promise(resolve => { finish = resolve; }) };
    const social = createSocial({ cloud, getState: () => shelf });
    initMischief({ state: shelf, cloud, social });
    if (scenario === 'new-account-before-sync') owner = U(4);
    const pending = social.block(U(2));
    if (scenario === 'restore') shelf.mischief = structuredClone(shelf.mischief);
    if (scenario === 'account') owner = U(4);
    finish({ ok: true });
    if (scenario === 'account') await assert.rejects(pending);
    else await pending;
    if (scenario === 'success') {
      assert.equal(shelf.mischief.helps[0].hidden, true);
      assert.equal(JSON.parse(disk.get(SAVE_KEY)).mischief.helps[0].hidden, true, 'cleanup is saved');
    } else assert.equal(shelf.mischief.helps[0].hidden, undefined, scenario + ' leaves the replacement context intact');
  }
});
