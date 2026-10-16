import test from 'node:test';
import assert from 'node:assert/strict';
import { sync } from '../src/cloud/index.js';
import { initJointBench } from '../src/ui/court-joint.js';
import { friendsSections, resetSocialRegistry } from '../src/ui/social-registry.js';

const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  resetSocialRegistry();
  let user = U(1), count = 1, hold = false, release;
  const calls = [], listeners = new Set();
  const friend = { userId: U(3), name: 'Bea' };
  const cloud = { configured: true, signedIn: () => !!user, userId: () => user, subscribe: fn => { listeners.add(fn); }, rpc: async name => {
    calls.push(name);
    if (name !== 'bench_record') return { hearings: [], records: [] };
    const result = { user_id: friend.userId, display_name: 'Bea', hearings: count, full_benches: 0, mine_right: 0, theirs_right: count, recent: [] };
    if (hold) await new Promise(resolve => { release = resolve; });
    return result;
  } };
  const social = { active: () => true };
  const stage = { sheet: {}, isOpen: () => false };
  const bench = initJointBench({ state: { pets: [] }, cloud, social, stage });
  const section = friendsSections('friend').find(s => s.id === 'bench-record');
  let refreshed = 0;
  const ctx = { refresh: () => { refreshed++; }, isCurrent: () => true };
  return { bench, stage, section, friend, ctx, calls, refreshes: () => refreshed,
    changeUser: value => { user = value; listeners.forEach(fn => fn()); }, count: value => { count = value; }, hold: () => { hold = true; }, release: () => release() };
}

test('a fresh hearing list invalidates a previously successful profile record', async () => {
  const w = setup();
  w.section.render(w.ctx, w.friend); await tick();
  assert.match(w.section.render(w.ctx, w.friend), /1 hearing/);
  w.count(2);
  await w.bench.hearings.list();
  w.section.render(w.ctx, w.friend); await tick();
  assert.match(w.section.render(w.ctx, w.friend), /2 hearings/);
  assert.equal(w.calls.filter(c => c === 'bench_record').length, 2);
});

test('a successful record is isolated when two accounts share the same friend', async () => {
  const w = setup();
  w.section.render(w.ctx, w.friend); await tick();
  assert.match(w.section.render(w.ctx, w.friend), /1 hearing/);
  w.changeUser(U(2)); w.count(7);
  assert.doesNotMatch(w.section.render(w.ctx, w.friend), /1 hearing/);
  await tick();
  assert.match(w.section.render(w.ctx, w.friend), /7 hearings/);
});

test('an expired account context cannot install or repaint a delayed profile record', async () => {
  const w = setup(); w.hold();
  let current = true;
  w.ctx.isCurrent = () => current;
  w.section.render(w.ctx, w.friend);
  current = false;
  w.release(); await tick();
  assert.equal(w.refreshes(), 0);
  assert.equal(w.section.render(w.ctx, w.friend), '');
});

test('an account change clears records even while the Friends profile is closed', async () => {
  const w = setup();
  w.section.render(w.ctx, w.friend); await tick();
  w.changeUser(U(2)); w.changeUser(U(1)); w.count(4);
  assert.doesNotMatch(w.section.render(w.ctx, w.friend), /1 hearing/);
  await tick();
  assert.match(w.section.render(w.ctx, w.friend), /4 hearings/);
});


test('the Joint reward recovery control closes Court and reads real Cloud save choices without adopting a shelf', async t => {
  // Minimal host controls; the primary Cloud save journey is exercised through
  // actual import/choice controls in browser/covens.spec.mjs.
  const previous = globalThis.document, calls = [], w = setup();
  globalThis.document = { getElementById: id => id === 'cloudBtn' ? { click: () => calls.push('cloud') } : null };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  w.stage.context = () => null; w.stage.sheet.querySelector = () => ({ click: () => calls.push('close') });
  t.mock.method(sync, 'requestCopyChoice', async () => { calls.push('choices'); return { status: 'conflict' }; });
  t.mock.method(sync, 'resolve', () => assert.fail('the recovery launcher never chooses a copy for the player'));
  const button = { disabled: false, dataset: { jc: 'reward-copy' } };
  assert.equal(w.bench.onClick({ target: { closest: selector => selector === '[data-jc]' ? button : null } }), true);
  await tick(); assert.deepEqual(calls, ['close','cloud','choices']);
});
