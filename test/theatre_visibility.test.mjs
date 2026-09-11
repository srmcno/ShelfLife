import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleSceneCandidates } from '../src/ui/theatre-visibility.js';
test('autoplay retains the exact visible cast and furniture, excluding clipped or missing participants', () => {
  const visible = { left: 20, right: 80, top: 100, bottom: 180, width: 60, height: 80 };
  const bounds = { a: visible, b: visible, prop: visible, lower: { ...visible, top: 800, bottom: 880 }, covered: { ...visible, top: 30 }, clipped: { ...visible, right: 420 }, hidden: { ...visible, width: 0 } };
  const pair = { kind: 'pair', actorIds: ['a','b'], propId: null, weight: 2 };
  const bath = { kind: 'bath', actorIds: ['b','a'], propId: 'prop', weight: 3 };
  const excluded = ['lower','covered','clipped','hidden','missing'].flatMap(id => [{ ...pair, actorIds: ['a',id] }, { ...bath, propId: id }]);
  assert.deepEqual(visibleSceneCandidates([pair,...excluded,bath], id => bounds[id], 390, 844), [pair,bath]);
});
