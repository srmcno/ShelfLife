import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestGreeting, reactionLine } from '../src/engine/visits.js';
import { GUEST_HELLOS, GUEST_CARE_COMPANY, GUEST_CARE_REPEAT } from '../src/content/postbox.js';
import { blankState } from '../src/state.js';
import { contextualExchanges, observationLines } from '../src/engine/observations.js';
import { pickDialogue, dialogueText } from '../src/engine/dialogue.js';

const guest = { id: 'visitor', name: 'Gladys', traits: ['critic'], mood: 'fine' };
const neighbour = { id: 'home', name: 'Mabel' };
const context = { visitId: 'a-visit', neighbour, counts: { food: 1, fuss: 0, clean: 0 } };

test('a guest greeting uses real visit state, traits and the household', () => {
  assert.match(guestGreeting(guest, { visitId: 'one', now: 10 }), /Gladys.*reviewing/);
  assert.match(guestGreeting({ ...guest, mood: 'furious' }, { ...context, now: 10 }), /moment alone/);
  const familiar = guestGreeting(guest, { ...context, now: 10 });
  assert.match(familiar, /Gladys/);
  assert.notEqual(familiar, guestGreeting(guest, { visitId: 'one', now: 10 }));
  assert.match(guestGreeting(guest, { ...context, now: 10, leaves: 100 }), /Gladys/);
  const names = new Set(Array.from({ length: 12 }, (_, n) => guestGreeting({ name: 'Gladys', traits: [] }, { visitId: String(n), neighbour, now: 10 })));
  assert.ok(names.size >= 2, 'different visits can receive different conversations');
  for (const line of names) { assert.match(line, /Gladys/); assert.match(line, /Mabel/); }
  const solo = guestGreeting({ name: 'Gladys', traits: [], mood: 'content' }, { now: 10 });
  assert.match(solo, /Gladys/);
  assert.doesNotMatch(solo, /Mabel|\{\w+\}/);
});

test('care conversations use an actual neighbour and count the specific care', () => {
  for (const kind of ['food', 'fuss', 'clean']) {
    const line = reactionLine(guest, kind, 1, { ...context, counts: { [kind]: 1 } });
    assert.match(line, /Gladys/); assert.match(line, /Mabel/);
    const repeat = reactionLine(guest, kind, 3, { visitId: 'a-visit', counts: { [kind]: 3 } });
    assert.match(repeat, /Gladys/); assert.match(repeat, /3 times/);
    assert.doesNotMatch(repeat, /Mabel|\{\w+\}/);
  }
  assert.match(reactionLine(guest, 'food', 0), /two skulls/, 'the original trait reaction stays available');
  assert.doesNotMatch(reactionLine(guest, 'food', 1, { counts: { food: 1 } }), /Mabel/);
  assert.doesNotMatch(reactionLine(guest, 'food', 3, { counts: { food: -10 } }), /-10|NaN|undefined/);
});

test('reading dialogue does not alter visit data or require valid optional fields', () => {
  const sample = structuredClone({ guest, context });
  const before = JSON.stringify(sample);
  guestGreeting(sample.guest, sample.context);
  reactionLine(sample.guest, 'food', 1, sample.context);
  assert.equal(JSON.stringify(sample), before);
  assert.doesNotThrow(() => guestGreeting(null, { neighbour: null, counts: null, now: 10 }));
  assert.doesNotThrow(() => reactionLine(null, 'unknown', -2, { counts: null }));
  assert.doesNotMatch(JSON.stringify([GUEST_HELLOS, GUEST_CARE_COMPANY, GUEST_CARE_REPEAT]), /[\u2013\u2014]/);
});

test('household dialogue notices a real visiting friend only while the visit is active', () => {
  const now = new Date(2026, 9, 1, 12).getTime(), shelf = blankState();
  shelf.pets = ['Mabel', 'Agnes'].map((name, i) => ({ id: 'p' + i, name, traits: [], needs: { food: 60, fuss: 60, clean: 60 }, bond: 0, grudges: 0, stats: {} }));
  shelf.slots[0] = 'p0'; shelf.slots[1] = 'p1';
  const visitor = { resident: { name: 'Gladys' }, arrived: now - 1000, leaves: now + 1000 };
  shelf.friendVisits.guests = [visitor];
  const before = JSON.stringify(shelf);
  assert.ok(observationLines(shelf, shelf.pets[0], now).some(line => line.includes('Gladys')));
  const exchanges = contextualExchanges(shelf, shelf.pets[0], now);
  assert.ok(exchanges.length >= 4);
  assert.ok(exchanges.every(entry => entry.turns.some(([, line]) => line.includes('Gladys'))));
  assert.match(dialogueText(pickDialogue(shelf, { kind: 'generic', now, rng: () => 0 })), /Gladys is visiting/);
  assert.equal(JSON.stringify(shelf), before, 'the dialogue does not change the save');
  assert.deepEqual(contextualExchanges(shelf, shelf.pets[0], now + 1000), [], 'a departed guest is never mentioned');
  visitor.arrived = now + 1000; visitor.leaves = now + 2000;
  assert.deepEqual(contextualExchanges(shelf, shelf.pets[0], now), [], 'a future guest is never mentioned');
  visitor.arrived = now - 1000; visitor.resident.name = '<img>{a}';
  const line = dialogueText(pickDialogue(shelf, { kind: 'generic', now, rng: () => 0 }));
  assert.match(line, /<img>a is visiting/);
  assert.doesNotMatch(line, /\{a\}/, 'a name cannot inject a later template placeholder');
  visitor.resident.name = '$&';
  assert.match(dialogueText(pickDialogue(shelf, { kind: 'generic', now, rng: () => 0 })), /\$& is visiting/);
});
