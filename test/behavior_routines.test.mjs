import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  behaviorProfile, routinePhase, mischiefPhase, runBehavior, capabilitiesOf,
  addFriction, MISCHIEF_COOLDOWN_MS, ROUTINE_GAIN
} from '../src/engine/behavior.js';
import { blankState, normalizeState } from '../src/state.js';
import { feudPairKey } from '../src/engine/achievements.js';

const NOW = new Date(2026, 8, 10, 12).getTime();
const pet = (id, traits = [], needs = {}) => ({
  id, name: id, traits, needs: { food: 70, fuss: 70, clean: 70, ...needs },
  art: { body: '', stamps: [] }, bond: 3, cared: 2, grudges: 0
});
function shelf(...residents) {
  const state = blankState();
  state.pets = residents;
  residents.forEach((p, index) => { state.slots[index] = p.id; });
  return state;
}

test('a personality profile explains the actual furniture and routine rules without mutation', () => {
  const resident = pet('Neat', ['clean', 'socialite']), before = structuredClone(resident);
  const profile = behaviorProfile(resident);
  assert.equal(profile.social.label, 'Seeks company');
  assert.ok(profile.favorites.some(prop => prop.kind === 'tub' && prop.affinity === 3));
  assert.ok(profile.dislikes.some(prop => prop.kind === 'jar' && prop.affinity === -4));
  assert.deepEqual(profile.routines.map(routine => routine.id), ['preen', 'company']);
  assert.deepEqual(resident, before);
  assert.equal(behaviorProfile(pet('Alone', ['cryptid'])).social.label, 'Values personal space');
  assert.deepEqual(behaviorProfile(pet('Old', ['retired-trait'])).routines, []);
  assert.deepEqual(behaviorProfile(null).favorites, []);
});

test('tidy personalities preen only when dirty and the action reports its real gain', () => {
  for (const trait of ['clean', 'etiquette', 'porcelain']) {
    const resident = pet(trait, [trait], { clean: 40 }), state = shelf(resident);
    const result = routinePhase(state, NOW);
    assert.equal(result.act, 'preen'); assert.equal(result.gain, ROUTINE_GAIN.preen);
    assert.equal(resident.needs.clean, 48); assert.equal(resident.bond, 3); assert.equal(resident.cared, 2);
    assert.match(state.notes[0].text, /\+8 cleanliness/);
    assert.equal(routinePhase(state, NOW + 1000), null);
    resident.needs.clean = 55;
    assert.equal(routinePhase(state, NOW + MISCHIEF_COOLDOWN_MS), null, 'no cosmetic routine when already presentable');
  }
  assert.equal(routinePhase(shelf(pet('Ordinary', [], { clean: 10 })), NOW), null, 'the trait changes the behavior');
});

test('companion personalities help an actual neighbour and both residents keep a real cooldown', () => {
  for (const trait of ['socialite', 'clingy', 'theatrical', 'hummer', 'physician', 'steward']) {
    const host = pet('Host', [trait]), guest = pet('Guest', [], { fuss: 35 }), state = shelf(host, guest);
    const result = routinePhase(state, NOW);
    assert.equal(result.act, 'company', trait); assert.equal(result.target, guest.id);
    assert.equal(guest.needs.fuss, 43); assert.equal(host.needs.fuss, 72);
    assert.equal(host.bond, 3); assert.equal(guest.bond, 3); assert.equal(guest.cared, 2);
    assert.match(state.notes[0].text, /Guest/); assert.match(state.notes[0].text, /\+8 attention/);
    assert.equal(host.lastMischiefAt, NOW); assert.equal(guest.lastMischiefAt, NOW);
    assert.equal(routinePhase(state, NOW + 1000), null);
    assert.equal(mischiefPhase(state, NOW + 1000), null, 'routine rest cannot be bypassed by generic antics');
  }
});

test('company respects sleep, solitude, attention and physical shelf adjacency', () => {
  const cases = [
    [pet('Host', ['socialite', 'nocturnal']), pet('Guest', [], { fuss: 20 })],
    [pet('Host', ['socialite']), pet('Guest', ['nocturnal'], { fuss: 20 })],
    [pet('Host', ['socialite']), pet('Guest', ['cryptid'], { fuss: 20 })],
    [pet('Host', ['socialite'], { fuss: 54 }), pet('Guest', [], { fuss: 20 })],
    [pet('Host', ['socialite']), pet('Guest', [], { fuss: 50 })]
  ];
  for (const residents of cases) assert.equal(routinePhase(shelf(...residents), NOW), null);
  const separated = shelf(pet('Host', ['socialite']), pet('Guest', [], { fuss: 20 }));
  separated.slots[1] = null; separated.slots[2] = 'Guest';
  assert.equal(routinePhase(separated, NOW), null, 'an empty slot is not an adjacent listener');
  separated.slots[0] = null; separated.slots[2] = null; separated.slots[5] = 'Host'; separated.slots[6] = 'Guest';
  assert.equal(routinePhase(separated, NOW), null, 'company never wraps across shelf rows');
});

test('company does not erase feuds or remembered incidents, while a truce permits an offer', () => {
  const host = pet('Actor', ['theatrical']), guest = pet('Manager', ['management'], { fuss: 25 });
  const state = shelf(host, guest);
  assert.equal(routinePhase(state, NOW), null, 'incompatible traits do not suddenly become friendly');
  state.feudArcs[feudPairKey(host.id, guest.id)] = { level: 2, truce: true };
  addFriction(state, host.id, guest.id, NOW, 2);
  assert.equal(routinePhase(state, NOW), null, 'a real recent incident still matters after a truce');
  state.friction = {};
  assert.equal(routinePhase(state, NOW).act, 'company');
  assert.equal(state.feudArcs[feudPairKey(host.id, guest.id)].level, 2, 'help is not a free feud reset');
});

test('one recipient cannot collect a routine from every neighbour and saturated helpers do not claim zero gains', () => {
  const first = pet('First', ['socialite'], { fuss: 100 });
  const guest = pet('Guest', [], { fuss: 20 }), second = pet('Second', ['hummer']);
  const state = shelf(first, guest, second);
  const result = routinePhase(state, NOW);
  assert.equal(result.hostGain, 0); assert.equal(first.needs.fuss, 100); assert.equal(guest.needs.fuss, 28);
  assert.doesNotMatch(state.notes[0].text, /\+0 attention/);
  assert.equal(routinePhase(state, NOW + 1), null);
});

test('routine cooldowns survive a save round-trip without extra saved structures', () => {
  const state = shelf(pet('Host', ['socialite']), pet('Guest', [], { fuss: 20 }));
  routinePhase(state, NOW);
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.ok(restored); assert.equal(restored.pets[0].lastMischiefAt, NOW);
  assert.equal(routinePhase(restored, NOW + MISCHIEF_COOLDOWN_MS - 1), null);
  assert.equal(routinePhase(restored, NOW + MISCHIEF_COOLDOWN_MS).act, 'company');
  assert.equal(restored.routines, undefined);
});

test('familiar routines still help without reprinting a report already on the notes board', () => {
  const resident = pet('Neat', ['clean'], { clean: 40 }), state = shelf(resident);
  routinePhase(state, NOW); resident.needs.clean = 40;
  const next = routinePhase(state, NOW + MISCHIEF_COOLDOWN_MS);
  assert.equal(next.gain, 8); assert.equal(resident.needs.clean, 48);
  assert.equal(state.notes.length, 1);
});

test('normal behavior passes use the same meaningful routine and generic mischief now respects its rest', t => {
  t.mock.method(Math, 'random', () => 0);
  const state = shelf(pet('Neat', ['clean'], { clean: 35 }));
  const result = runBehavior(state, NOW, { force: true, maxMoves: 0, maxUses: 0 });
  assert.equal(result.mischief.act, 'preen'); assert.equal(state.pets[0].needs.clean, 43);
  const plain = shelf(pet('Quiet'));
  assert.equal(mischiefPhase(plain, NOW).act, 'lurk');
  assert.equal(mischiefPhase(plain, NOW + MISCHIEF_COOLDOWN_MS - 1), null);
  assert.ok(mischiefPhase(plain, NOW + MISCHIEF_COOLDOWN_MS));
});

test('a tail-only drawing keeps its visible tail in shelf behavior', () => {
  const resident = pet('Tail'); resident.art.stamps = [{ kind: 'tail' }];
  const caps = capabilitiesOf(resident);
  assert.equal(caps.tail, true); assert.equal(caps.fly, false); assert.equal(caps.climb, false);
  assert.equal(caps.anatomy.hasLegs, false, 'a tail does not invent a pair of walking legs');
});
