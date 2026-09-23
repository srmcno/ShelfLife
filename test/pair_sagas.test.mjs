import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { advanceStories, brokerTruce, pairKey, recordSharedPlot, storyState } from '../src/engine/stories.js';
import { FEUDS } from '../src/content/feuds.js';
import { pairSagaView } from '../src/engine/pair-sagas.js';
import { blankTheatre } from '../src/theatre-state.js';
import { chooseOuting, finishOuting, startOuting } from '../src/engine/life.js';

const MINUTE = 60000;
const now = Date.now() - 2 * 3600000;

function household(rivals = false) {
  const state = blankState();
  state.lastTick = now;
  state.pets = ['Mora', 'Pip'].map((name, index) => ({
    id: 'pair-' + index, name,
    traits: rivals ? [FEUDS[0][index]] : [],
    stats: { cute: 3, menace: 7, damp: 2, mystique: 4 },
    needs: { food: 75, fuss: 75, clean: 75 },
    bond: 3, careLog: { food: 0, fuss: 0, clean: 0 },
    born: now, names: [{ name, at: now }]
  }));
  state.slots[0] = state.pets[0].id;
  state.slots[1] = state.pets[1].id;
  state.theatre = blankTheatre();
  storyState(state);
  return state;
}

const saga = state => storyState(state).relationships[pairKey(...state.pets.map(p => p.id))]?.saga;

test('friends earn a three-act subplot from time, two shared plots and a later calm scene', () => {
  const state = household();
  advanceStories(state, now, () => 0);
  assert.equal(saga(state), undefined);
  advanceStories(state, now + 15 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 1);
  assert.match(saga(state).beats[0].text, /Mora and Pip/);
  const first = saga(state).beats[0].text;
  advanceStories(state, now + 16 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 1, 'ordinary redraws cannot repeat the chapter');

  recordSharedPlot(state, state.pets[0].id, now + 16 * MINUTE);
  state.slots[1] = null;
  state.slots[7] = state.pets[1].id;
  recordSharedPlot(state, state.pets[0].id, now + 17 * MINUTE);
  advanceStories(state, now + 17 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 1, 'a separated pair cannot file a joint scene');
  state.slots[7] = null;
  state.slots[1] = state.pets[1].id;
  recordSharedPlot(state, state.pets[0].id, now + 18 * MINUTE);
  advanceStories(state, now + 18 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2);

  const key = pairKey(...state.pets.map(p => p.id));
  state.theatre.pairs[key] = { actorIds: state.pets.map(p => p.id), last: 'comfort', at: now + 17 * MINUTE };
  advanceStories(state, now + 19 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2, 'an earlier performance cannot finish the new chapter');
  state.theatre.pairs[key].at = now + 20 * MINUTE;
  state.slots[1] = null;
  state.slots[2] = state.pets[1].id;
  advanceStories(state, now + 21 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 3, 'a staged pair scene can finish the story over a one-slot gap');
  assert.equal(pairSagaView(state, ...state.pets).count, 3);
  assert.equal(state.stories.archive.filter(entry => ['The department opens', 'The inquest', 'The pardon'].includes(entry.title)).length, 3);

  const restored = normalizeState(state);
  restored.life.scenes = [];
  restored.stories.archive = [];
  assert.equal(pairSagaView(restored, ...restored.pets).chapters[0].text, first,
    'the dossier outlives both rolling scene journals');
  advanceStories(restored, now + 22 * MINUTE, () => 0);
  assert.equal(saga(restored).beats.length, 3);
});

test('rivals need a real feud and truce before their shared payoff', () => {
  const state = household(true), key = pairKey(...state.pets.map(p => p.id));
  advanceStories(state, now, () => 0);
  advanceStories(state, now + 15 * MINUTE, () => 0);
  assert.equal(saga(state), undefined);
  state.feudArcs[key] = { level: 1, truce: false };
  advanceStories(state, now + 16 * MINUTE, () => 0);
  assert.equal(saga(state).style, 'feud');
  assert.equal(saga(state).beats.length, 1);
  assert.equal(brokerTruce(state, ...state.pets.map(p => p.id), now + 17 * MINUTE), true);
  advanceStories(state, now + 17 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2);
  assert.equal(pairSagaView(state, ...state.pets).canStage, false, 'the scene button waits for shared plots');
  advanceStories(state, now + 18 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2);
  state.theatre.pairs[key] = { actorIds: state.pets.map(p => p.id), last: 'makeup', at: now + 18 * MINUTE };
  recordSharedPlot(state, state.pets[0].id, now + 19 * MINUTE);
  recordSharedPlot(state, state.pets[0].id, now + 20 * MINUTE);
  assert.equal(pairSagaView(state, ...state.pets).canStage, true);
  advanceStories(state, now + 21 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2, 'a calm scene before the second plot does not count as the finale');
  state.theatre.pairs[key].at = now + 22 * MINUTE;
  advanceStories(state, now + 23 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 3);
  assert.match(saga(state).beats[2].text, /joint complaint/);
});

test('old shared-plot history cannot flood the note board on consecutive renders', () => {
  const state = household(), key = pairKey(...state.pets.map(p => p.id));
  state.stories.relationships[key] = { time: 20 * MINUTE, plots: 2 };
  advanceStories(state, now, () => 0);
  assert.equal(saga(state).beats.length, 1);
  advanceStories(state, now, () => 0);
  assert.equal(saga(state).beats.length, 1);
  advanceStories(state, now + MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2);
});

test('bad imported subplot data is discarded without blocking ordinary relationships', () => {
  const state = household(), key = pairKey(...state.pets.map(p => p.id));
  state.stories.relationships[key] = { time: 15 * MINUTE, plots: 0, saga: { style: 'bureau', beats: [{ at: now, text: 'x'.repeat(700) }] } };
  storyState(state);
  assert.equal(saga(state), undefined);
  advanceStories(state, now + MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 1);
});

test('future and out-of-order imported chapter dates cannot stall or scramble a subplot', () => {
  const state = household(), key = pairKey(...state.pets.map(p => p.id));
  state.stories.relationships[key] = { time: 15 * MINUTE, plots: 2,
    saga: { style: 'bureau', beats: [{ at: Date.now() + 86400000, text: 'An early chapter.' }] } };
  storyState(state);
  assert.ok(saga(state).beats[0].at <= Date.now());
  state.stories.relationships[key].saga.beats.push({ at: now - MINUTE, text: 'An impossible second chapter.' });
  storyState(state);
  assert.equal(saga(state), undefined);
});

test('shared outings timestamp their plot credit so an earlier scene cannot become the finale', () => {
  const state = household(true), ids = state.pets.map(p => p.id), key = pairKey(...ids);
  state.feudArcs[key] = { level: 1, truce: false };
  advanceStories(state, now, () => 0);
  assert.equal(saga(state).beats.length, 1);
  brokerTruce(state, ...ids, now + MINUTE);
  advanceStories(state, now + MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2);
  state.theatre.pairs[key] = { actorIds: ids, last: 'comfort', at: now + 2 * MINUTE };
  for (const outingTime of [now + 3 * MINUTE, now + 4 * MINUTE]) {
    assert.equal(startOuting(state, 'drawer', 'thread', ids), true);
    for (const choice of [0, 0, 0]) assert.ok(chooseOuting(state, choice, outingTime));
    assert.equal(finishOuting(state), true);
  }
  assert.equal(storyState(state).relationships[key].lastPlotAt, now + 4 * MINUTE);
  advanceStories(state, now + 5 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 2);
  state.theatre.pairs[key].at = now + 6 * MINUTE;
  advanceStories(state, now + 7 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 3);
});

test('a direct truce opens with the treaty rather than inventing an earlier war', () => {
  const state = household(true), ids = state.pets.map(p => p.id);
  assert.equal(brokerTruce(state, ...ids, now), true);
  advanceStories(state, now, () => 0);
  assert.match(saga(state).beats[0].text, /border promised in their truce/);
});

test('future imported plot credit dates are clamped so a later performance can finish the story', () => {
  const state = household(), key = pairKey(...state.pets.map(p => p.id));
  state.stories.relationships[key] = { time: 20 * MINUTE, plots: 2,
    lastPlotAt: Date.now() + 86400000,
    saga: { style: 'bureau', beats: [{ at: now - MINUTE, text: 'Opening.' }, { at: now, text: 'Middle.' }] } };
  storyState(state);
  assert.ok(state.stories.relationships[key].lastPlotAt <= Date.now());
  state.theatre.pairs[key] = { actorIds: state.pets.map(p => p.id), last: 'comfort', at: Date.now() + MINUTE };
  advanceStories(state, Date.now() + 2 * MINUTE, () => 0);
  assert.equal(saga(state).beats.length, 3);
});
