import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityPassport } from '../src/content/activities.js';
import { blankState, normalizeState } from '../src/state.js';

test('the household passport recognises completed practice and legacy history without changing saves', () => {
  const state = blankState();
  state.stories = {};
  state.stories.chases = 2;
  state.stories.handshakes = 1;
  state.stories.alibis = 1; // A verdict can be wrong and still count as trying.
  state.life.courtPlays = 1;
  state.life.outings = 2;
  state.life.marketRuns = 1;
  const loaded = normalizeState(state), before = structuredClone(loaded);
  assert.equal(activityPassport(loaded).completed, 6);
  assert.deepEqual(loaded, before, 'reading a passport must not create rewards or mutate history');
  loaded.stories = {}; loaded.life = { awards:['game:chase', 'game:memory', 'game:alibi', 'game:court'] };
  assert.equal(activityPassport(loaded).completed, 4, 'old discoveries survive resident rehoming');
});

test('suggestions prioritise saved trips and otherwise suggest an untried activity', () => {
  const state = { pets:[{ chases:1 }], life:{} };
  assert.equal(activityPassport(state).next, 'memory');
  state.life.market = { claimed:false };
  assert.equal(activityPassport(state).next, 'market');
  assert.equal(activityPassport(state).resume, true);
  state.life.market.claimed = true;
  assert.equal(activityPassport(state).resume, false);
  state.life.outing = { route:'drawer' };
  assert.equal(activityPassport(state).next, 'outing');
});

test('household and resident counters are not added twice', () => {
  const p = activityPassport({ stories:{ chases:4 }, pets:[{ chases:2 },{ chases:2 }], life:{} });
  assert.equal(p.stamps.find(s => s.id === 'chase').count, 4);
});

test('a full losing chase still earns the tried stamp through its saved result', () => {
  const p = activityPassport({ pets:[{ chaseRecords:{ standard:{ score:85, stars:1 } } }], life:{} });
  assert.equal(p.stamps.find(s => s.id === 'chase').earned, true);
  assert.equal(p.next, 'memory');
});
