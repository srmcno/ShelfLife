import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExtra } from '../src/engine/nextstep.js';
import { CLAIMABLE_TABS } from '../src/engine/claimables.js';

globalThis.window ??= { addEventListener() {}, dispatchEvent() {} };
globalThis.document ??= { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { dataset: {} } };
const { routeClaimable, claimableExtras } = await import('../src/ui/nextstep-extras.js');

test('every place a claimable can name is reachable from the next-step card', () => {
  for (const tab of CLAIMABLE_TABS) {
    const step = normalizeExtra(routeClaimable({ id: 'x-' + tab, label: 'Something for ' + tab, hint: 'h', tab, priority: 50 }));
    assert.ok(step, tab);
    if (['almanac', 'collections', 'exchange'].includes(tab)) {
      assert.equal(step.action.type, 'event', tab);
      assert.equal(step.action.name, 'shelflife:almanac');
      assert.equal(step.action.detail.view, tab);
    } else {
      assert.equal(step.action.type, 'goto', tab);
      assert.equal(step.action.tab, tab);
    }
  }
});

test('the return chest points at the chest on the desk', () => {
  const step = normalizeExtra(routeClaimable({ id: 'return-chest', label: 'A chest is waiting by the door', hint: 'h', tab: 'shelf', priority: 95 }));
  assert.equal(step.action.target, '.alm-return-chest');
  assert.equal(step.verb, 'Open it');
});

test('an empty shelf raises nothing', () => {
  assert.deepEqual(claimableExtras({ pets: [] }, Date.now()), []);
});

test('claimables outrank the fallback suggestion but not the daily docket', async () => {
  const { PRIORITY, nextSteps } = await import('../src/engine/nextstep.js');
  for (const p of [0, 30, 95, 100]) {
    const step = normalizeExtra(routeClaimable({ id: 'x', label: 'L', hint: 'h', tab: 'almanac', priority: p }));
    assert.ok(step.priority > PRIORITY.play, 'priority ' + p);
    assert.ok(step.priority < PRIORITY.docket, 'priority ' + p);
  }
  assert.equal(typeof nextSteps, 'function');
});
