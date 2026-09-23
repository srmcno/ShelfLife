import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { recordResidentTenure, residentTenureDays } from '../src/engine/life.js';
import { residentMemories } from '../src/engine/resident-memory.js';
import { contextualExchanges } from '../src/engine/observations.js';
import { CONTEXT_EXCHANGES } from '../src/content/observations.js';

const DAY = 86400000;
const now = new Date(2026, 8, 22, 12).getTime();
function resident(id, born, lifeMilestones = []) {
  return { id, name: id === 'a' ? 'Mabel' : 'Agnes', born, lifeMilestones, traits: [],
    needs: { food: 60, fuss: 60, clean: 60 }, careLog: { food: 0, fuss: 0, clean: 0 },
    bond: 0, grudges: 0, stats: {} };
}
function shelf(pets) {
  const state = blankState();
  state.started = state.lastTick = now;
  state.pets = pets;
  pets.forEach((pet, i) => { state.slots[i] = pet.id; });
  return state;
}

test('residency days are elapsed full days and never become negative', () => {
  assert.equal(residentTenureDays({ born: now + DAY }, now), 0);
  assert.equal(residentTenureDays({ born: now - DAY + 1 }, now), 0);
  assert.equal(residentTenureDays({ born: now - DAY }, now), 1);
  assert.equal(residentTenureDays({}, now), 0);
});

test('older saves receive only their latest overdue marker, once', () => {
  const legacy = shelf([resident('a', now - 50 * DAY)]);
  delete legacy.pets[0].lifeMilestones;
  const state = normalizeState(legacy);
  assert.deepEqual(state.pets[0].lifeMilestones, [1, 7]);
  assert.deepEqual(recordResidentTenure(state, now), { petId: 'a', days: 30, title: 'A month in residence' });
  assert.deepEqual(state.pets[0].lifeMilestones, [1, 7, 30]);
  assert.deepEqual(state.pets[0].lifeKeepsakes, [30]);
  assert.equal(recordResidentTenure(state, now), null);
  assert.equal(state.life.scenes[0].stage.key, 'resident-tenure');
  assert.equal(state.life.scenes[0].stage.branch, '30');
  assert.equal(state.paperwork.entries[0].title, 'Resident milestone · A month in residence');
  assert.match(state.notes[0].text, /a month on the shelf/);
});

test('very overdue residents are filed one at a time without flooding the life journal', () => {
  const state = shelf([
    resident('a', now - 410 * DAY, [1, 7, 30, 100]),
    resident('b', now - 500 * DAY, [1, 7, 30, 100])
  ]);
  assert.equal(recordResidentTenure(state, now).petId, 'a');
  assert.equal(state.life.scenes.length, 1);
  assert.equal(recordResidentTenure(state, now).petId, 'b');
  assert.equal(recordResidentTenure(state, now), null);
  assert.deepEqual(state.life.scenes.map(scene => scene.stage.branch), ['365', '365']);
  assert.deepEqual(state.pets.map(pet => pet.lifeKeepsakes), [[365], [365]]);
  assert.equal(state.paperwork.entries.filter(entry => entry.title.startsWith('Resident milestone')).length, 2);
});

test('tenure enters resident memories and remains available after the scene journal rolls over', () => {
  const state = shelf([resident('a', now - 9 * DAY, [1])]);
  const pet = state.pets[0];
  recordResidentTenure(state, now);
  assert.ok(residentMemories(state, pet, now).some(memory => memory.key === 'tenure:7' && /week/i.test(memory.text)));
  state.life.scenes = [];
  state.paperwork.entries = [];
  assert.ok(residentMemories(state, pet, now).some(memory => memory.key === 'tenure:7' && /week/i.test(memory.text)));
});

test('condition-based dialogue reflects loneliness, fullness, grudges and a sanitized former name', () => {
  const state = shelf([resident('a', now), resident('b', now)]);
  const pet = state.pets[0];
  assert.deepEqual(contextualExchanges(state, pet, now), []);
  pet.needs.fuss = 20;
  assert.deepEqual(contextualExchanges(state, pet, now), CONTEXT_EXCHANGES.lonely);
  pet.needs.fuss = 60;
  pet.needs.food = 95;
  assert.deepEqual(contextualExchanges(state, pet, now), CONTEXT_EXCHANGES.full);
  pet.needs.food = 60;
  pet.grudges = 2;
  assert.deepEqual(contextualExchanges(state, pet, now), CONTEXT_EXCHANGES.grudge);
  pet.grudges = 0;
  pet.names = [{ name: 'Old {Name}' }, { name: pet.name }];
  const renamed = contextualExchanges(state, pet, now);
  assert.equal(renamed.length, CONTEXT_EXCHANGES.renamed.length);
  assert.ok(renamed.some(exchange => exchange.turns.some(([, line]) => line.includes('Old Name'))));
  assert.ok(renamed.every(exchange => exchange.turns.every(([, line]) => !/\{old\}|\{Name\}/.test(line))));
});
