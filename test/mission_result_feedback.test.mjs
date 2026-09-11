import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { startOuting, chooseOuting, outingSnapshot, finishOuting } from '../src/engine/life.js';
import { RELICS } from '../src/content/life.js';
import { missionPlan, missionResult } from '../src/ui/expeditions.js';

const now = new Date(2026, 8, 10, 12).getTime();
function completeMission(ownedRelic = null) {
  const state = blankState();
  state.lastTick = now;
  state.pets = [{ id: 'p', name: 'Pip', traits: [], art: {}, bond: 0,
    stats: { cute: 1, menace: 1, damp: 1, mystique: 1 }, needs: { food: 60, fuss: 60, clean: 60 } }];
  state.slots[0] = 'p';
  if (ownedRelic) state.life.relics.push(ownedRelic);
  assert.ok(startOuting(state, 'drawer', 'thread', ['p'], { mission: true, edition: 0 }));
  for (const choice of [1, 2, 0]) assert.ok(chooseOuting(state, choice, now));
  const outing = outingSnapshot(state);
  assert.equal(outing.step, 3);
  assert.equal(outing.result.built, true);
  return { state, outing, markup: missionResult(outing) };
}

test('mission results show actual earned and possible scores alongside the new bonus curiosity', () => {
  const { state, outing, markup } = completeMission();
  const relic = RELICS.find(item => item.id === outing.result.relic);
  assert.equal(outing.score, 5);
  assert.equal(outing.best, 7, 'the unskilled crew could earn more by choosing a different route');
  assert.ok(markup.includes('Trail score <b>' + outing.score + ' / ' + outing.best + '</b>'));
  assert.match(markup, /Possible with this crew and plan/);
  assert.ok(markup.includes('Bonus find: <strong>' + relic.name + '</strong>'));
  assert.match(markup, /New curiosity · \+4 discoveries/);
  assert.doesNotMatch(markup, /Already in your collection/);
  assert.equal(outing.result.fresh, true);
  assert.ok(state.life.relics.includes(relic.id));
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(missionResult(outingSnapshot(restored)), markup, 'restored results keep the actual reward receipt');
});

test('an already-owned bonus curiosity is named without promising another four discoveries', () => {
  const fresh = completeMission();
  const owned = completeMission(fresh.outing.result.relic);
  assert.equal(owned.outing.result.fresh, false);
  assert.equal(owned.outing.score, fresh.outing.score);
  assert.equal(owned.outing.best, fresh.outing.best);
  assert.equal(fresh.state.life.xp - owned.state.life.xp, 4, 'only the new curiosity pays the advertised extra discoveries');
  assert.match(owned.markup, /Bonus find: <strong>/);
  assert.match(owned.markup, /Already in your collection/);
  assert.doesNotMatch(owned.markup, /New curiosity|\+4 discoveries/);
  assert.equal(owned.state.life.relics.filter(id => id === fresh.outing.result.relic).length, 1);
});

test('built mission replay guidance describes exploration without promising a saved trail record', () => {
  const { state, markup } = completeMission();
  assert.ok(finishOuting(state));
  const plan = missionPlan(state, 'drawer', 'thread', 'p', '', '');
  assert.match(plan, /Built · explore again/);
  assert.match(plan, /Try different choices to discover more curiosities/);
  assert.match(plan, /Replay this mission/);
  assert.doesNotMatch(plan + markup, /trail record|record attempt|best record/i);
});
