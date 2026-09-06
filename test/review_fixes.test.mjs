import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, grantBonusTrust, bonusTrustLeft, BONUS_TRUST_PER_DAY, MAX_OFFLINE_HOURS, NIGHT_DECAY_FACTOR, HOUR } from '../src/state.js';
import { fileGrudge, GRUDGE_COOLDOWN_MS, stepFeudArc, feudPairKey, FEUD_STEP_MS } from '../src/engine/achievements.js';
import { effectiveHours, tick, decayRate } from '../src/engine/tick.js';
import { previewCare } from '../src/engine/care.js';
import { checkShelf, checkWait, CHECK_COOLDOWN_MS } from '../src/engine/loop.js';
import { advanceStories, storyState, currentCase, caseText, caseNames, acceptRequest, REQUEST_LENGTH, REFLECTION } from '../src/engine/stories.js';
import { contestProp, TRAIT_PROP_AFFINITY } from '../src/engine/behavior.js';
import { rewardHandshake, newHandshake } from '../src/engine/play.js';
import { TRAITS } from '../src/content/traits.js';

function localHour(h, day = 1) { return new Date(2026, 8, day, h, 0, 0).getTime(); }
function makePet(id, over = {}) {
  return { id, name: id, traits: [], needs: { food: 60, fuss: 60, clean: 60 }, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 },
    bond: 0, cared: 0, grudges: 0, grudgeStage: 0, careLog: { food: 0, fuss: 0, clean: 0 }, ...over };
}
function shelf(pets) {
  const s = blankState();
  pets.forEach((p, i) => { s.pets.push(p); s.slots[i] = p.id; });
  s.lastTick = localHour(12);
  return s;
}

test('a resident files at most one grievance an hour, unless the slight is forced', () => {
  const s = shelf([makePet('a')]);
  const pet = s.pets[0];
  const t0 = localHour(12);
  assert.equal(fileGrudge(s, pet, 'left hungry', t0), true);
  assert.equal(fileGrudge(s, pet, 'left hungry', t0 + 60000), false);
  assert.equal(pet.grudges, 1);
  assert.equal(fileGrudge(s, pet, 'robbed', t0 + 60000, { force: true }), true);
  assert.equal(fileGrudge(s, pet, 'left hungry', t0 + GRUDGE_COOLDOWN_MS + 1), true);
  assert.equal(pet.grudges, 3);
  assert.deepEqual(pet.grudgeLog.map(g => g.why), ['left hungry', 'robbed', 'left hungry']);
  assert.ok(normalizeState(s).pets[0].grudgeLog.length === 3, 'the log survives a save round trip');
});

test('spam-checking the shelf cannot pile up grudges, and the check restocks', () => {
  const s = shelf([makePet('a', { needs: { food: 20, fuss: 20, clean: 20 }, art: { body: '', stamps: [] } })]);
  const t0 = localHour(12);
  for (let i = 0; i < 12; i++) checkShelf(s, t0 + i * 1000);
  assert.ok(s.pets[0].grudges <= 1, 'twelve checks in twelve seconds filed ' + s.pets[0].grudges + ' grudges');
  assert.ok(checkWait(s, t0 + 11000) > 0);
  assert.equal(checkWait(s, t0 + 11000 + CHECK_COOLDOWN_MS), 0);
});

test('a feud escalates or settles at most once per FEUD_STEP_MS, but always has a line', () => {
  const s = blankState();
  const a = makePet('a'), b = makePet('b');
  const key = feudPairKey('a', 'b');
  const t0 = localHour(12);
  const outcomes = new Set();
  for (let i = 0; i < 40; i++) outcomes.add(stepFeudArc(s, key, a, b, t0 + i * 1000));
  assert.equal(s.feudArcs[key].level, s.feudArcs[key].level <= 1 ? s.feudArcs[key].level : 1, 'one roll only inside the window');
  assert.ok(s.feudArcs[key].level <= 1);
  assert.equal(s.notes.length, 40, 'every step still adds a line');
  stepFeudArc(s, key, a, b, t0 + FEUD_STEP_MS + 5000);
  assert.equal(s.feudArcs[key].steppedAt, t0 + FEUD_STEP_MS + 5000);
});

test('night hours drain at half speed and the offline cap really binds', () => {
  const dayHours = effectiveHours(localHour(9), localHour(13));
  assert.ok(Math.abs(dayHours - 4) < 1e-9);
  const nightHours = effectiveHours(localHour(22), localHour(2, 2));
  assert.ok(Math.abs(nightHours - 4 * NIGHT_DECAY_FACTOR) < 1e-9);
  const away = effectiveHours(localHour(9), localHour(9, 3));   // two days
  assert.ok(away <= MAX_OFFLINE_HOURS);
  const s = shelf([makePet('a', { needs: { food: 100, fuss: 100, clean: 100 } })]);
  s.lastTick = localHour(9);
  tick(s, localHour(9, 3));
  assert.ok(s.pets[0].needs.food > 10, 'two days away leaves food at ' + s.pets[0].needs.food + ', not an empty bowl');
});

test('the particulars act: damp attracts grime, cute sweetens fussing, menace wins contests', () => {
  const dry = shelf([makePet('a', { stats: { cute: 5, menace: 5, damp: 1, mystique: 5 } })]);
  const wet = shelf([makePet('b', { stats: { cute: 5, menace: 5, damp: 10, mystique: 5 } })]);
  assert.ok(decayRate(wet.pets[0], 'clean', wet) > decayRate(dry.pets[0], 'clean', dry));
  const plain = makePet('c', { needs: { food: 40, fuss: 40, clean: 40 }, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 } });
  const cute = makePet('d', { needs: { food: 40, fuss: 40, clean: 40 }, stats: { cute: 10, menace: 5, damp: 5, mystique: 5 } });
  assert.ok(previewCare(cute, 'fuss', localHour(12)).gain > previewCare(plain, 'fuss', localHour(12)).gain);
  assert.equal(previewCare(cute, 'food', localHour(12)).gain, previewCare(plain, 'food', localHour(12)).gain);
  const mild = makePet('e', { traits: ['cult'], stats: { cute: 5, menace: 2, damp: 5, mystique: 5 } });
  const fierce = makePet('f', { traits: ['cult'], stats: { cute: 5, menace: 9, damp: 5, mystique: 5 } });
  const s = blankState();
  const candle = { id: 'q1', kind: 'candle' };
  s.pets.push(mild, fierce); s.props.push(candle);
  s.slots[0] = 'e'; s.slots[1] = 'q1'; s.slots[2] = 'f';
  s.lastTick = localHour(12);
  assert.equal(contestProp(s, candle, localHour(12)).winner, 'f');
});

test('games and conspiracies grant at most BONUS_TRUST_PER_DAY trust per resident per day', () => {
  const pet = makePet('a');
  const t0 = localHour(12);
  assert.equal(grantBonusTrust(pet, 2, t0), 2);
  assert.equal(grantBonusTrust(pet, 2, t0 + 60000), 1);
  assert.equal(grantBonusTrust(pet, 1, t0 + 120000), 0);
  assert.equal(pet.bond, BONUS_TRUST_PER_DAY);
  assert.equal(bonusTrustLeft(pet, t0), 0);
  assert.equal(grantBonusTrust(pet, 1, localHour(12, 2)), 1, 'a new day opens the tap again');
  const s = shelf([makePet('b', { needs: { food: 50, fuss: 50, clean: 50 } })]);
  const game = newHandshake(s.pets[0]); game.complete = true;
  s.pets[0].bonusTrust = { day: null, n: 0 };
  const now = localHour(12);
  s.lastTick = now;
  assert.equal(rewardHandshake(s, game, now).bond, 1);
  const stuffed = makePet('c', { bond: 25 });
  assert.equal(grantBonusTrust(stuffed, 1, t0), 0, 'full trust stays full');
});

test('a case opened on a shelf of one seats a second witness later, reads names live, and never says its own reflection', () => {
  const s = shelf([makePet('solo')]);
  const now = localHour(12);
  advanceStories(s, now);
  assert.equal(caseNames(s).q, REFLECTION);
  assert.ok(!/its own reflection/.test(caseText(s)));
  const late = makePet('late', { stats: { cute: 5, menace: 5, damp: 5, mystique: 9 } });
  s.pets.push(late); s.slots[1] = 'late';
  assert.equal(caseNames(s).q, 'late');
  assert.equal(currentCase(s).cast.length, 2);
  s.pets[0].name = 'Renamed';
  assert.equal(caseNames(s).p, 'Renamed');
  assert.ok(caseText(s).includes('Renamed'));
});

test('a request deadline runs from acceptance, and refusing files a grievance that can escalate', () => {
  const s = shelf([makePet('a')]);
  const t0 = localHour(12);
  advanceStories(s, t0);
  const late = t0 + REQUEST_LENGTH - 3600000;
  assert.equal(acceptRequest(s, 'a', true, late), true);
  const r = storyState(s).requests.a;
  assert.equal(r.at, late);
  assert.equal(r.offeredAt, t0);
  advanceStories(s, late + REQUEST_LENGTH - 1000);
  assert.ok(storyState(s).requests.a, 'still open eleven hours after accepting');
  const t = shelf([makePet('b', { grudges: 4 })]);
  advanceStories(t, t0);
  acceptRequest(t, 'b', false, t0);
  assert.equal(t.pets[0].grudges, 5);
  assert.equal(t.pets[0].grudgeStage, 1, 'the reckoning fires on the refusal itself');
});

test('a neighbour request never names a rival and prefers a friend', () => {
  const s = shelf([makePet('a', { traits: ['cult'] }), makePet('b', { traits: ['doom'] }), makePet('c', { traits: [] })]);
  const t0 = localHour(12);
  advanceStories(s, t0);
  const st = storyState(s);
  st.requests = {}; st.requestAt = {};
  s.pets[0].fulfilledRequests = 4;             // the fifth request kind is 'neighbor'
  advanceStories(s, t0 + 7 * 3600000);
  assert.equal(st.requests.a.kind, 'neighbor');
  assert.equal(st.requests.a.target, 'c', 'not the rival, even though the rival was made first');
});

test('every trait pulls toward or away from some furniture', () => {
  const inert = TRAITS.filter(t => !TRAIT_PROP_AFFINITY[t.id] || !Object.keys(TRAIT_PROP_AFFINITY[t.id]).length).map(t => t.id);
  assert.deepEqual(inert, []);
});
