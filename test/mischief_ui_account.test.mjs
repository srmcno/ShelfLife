import test from 'node:test';
import assert from 'node:assert/strict';
import { initMischief } from '../src/ui/mischief.js';
import { resetSocialRegistry, socialView } from '../src/ui/social-registry.js';
import { householdFixture } from './household-fixtures.mjs';

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
