import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityPassport, activityRecord } from '../src/content/activities.js';
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

test('an unfinished hearing is resumable and a verdict returns the next suggestion to other activities', () => {
  const state={pets:[{id:'a'}],life:{court:{claimed:false},outing:{step:1}}};
  assert.equal(activityPassport(state).next,'court');
  assert.equal(activityPassport(state).resume,true);
  assert.match(activityRecord({id:'court'},state,state.pets[0]),/Case in progress/);
  state.life.court.claimed=true;
  assert.equal(activityPassport(state).next,'outing');
});

test('Midnight Run stars cannot inflate the eighteen Quick Chase venue stars', () => {
  const p={chaseRecords:{standard:{stars:2},'run:standard':{stars:3},'run:gentle':{stars:3}}};
  assert.match(activityRecord({id:'chase'},{life:{}},p),/^2\/18 venue stars/);
});

test('finishing only Midnight Run shows its score instead of an unplayed invitation', () => {
  const pet = {chases:1,chaseRecords:{'run:standard':{score:420,stars:2},'run:gentle':{score:650,stars:3}}};
  const state = {pets:[pet],life:{}};
  assert.match(activityRecord({id:'chase'},state,pet),/^Midnight best: 650 · 1 successful run$/);
  assert.equal(activityPassport(state).stamps.find(s => s.id === 'chase').earned,true);
});

test('legacy completed Chase results remain visible even with zero points and no wins', () => {
  const pet = {chaseBest:{score:0,stars:1}};
  const state = {pets:[pet],life:{}};
  assert.match(activityRecord({id:'chase'},state,pet),/^Quick Chase best: 0/);
  assert.equal(activityPassport(state).stamps.find(s => s.id === 'chase').earned,true);
  assert.equal(activityPassport(state).next,'memory');
});
