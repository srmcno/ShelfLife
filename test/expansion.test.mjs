/* Tests for the inner voice, the sharpened creature logic, the backup reminder,
   the third game, and the two enhanced ones. The house rules these hold the new
   content to are the same ones test/comedy.test.mjs holds the old content to. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankState, normalizeState, addNote, FORMS, FORM_SHARE, AMBIENT_FORMS,
  backupDue, BACKUP_MIN_PETS, BACKUP_STALE, BACKUP_SNOOZE, resetPickMemory, SLOT_COUNT
} from '../src/state.js';
import { TRAIT_INNER, INNER_LINES, DREAM_LINES } from '../src/content/inner.js';
import { SLEEPING_NOTES } from '../src/content/copy.js';
import { TRAITS } from '../src/content/traits.js';
import { petLine } from '../src/engine/loop.js';
import {
  addFriction, frictionBetween, frictionKey, pairScore, resolveOf, notePlayerMove,
  slotScore, decideMove, FRICTION_DECAY_MS, FRICTION_MAX, PATIENCE_MAX, PATIENCE_STEP
} from '../src/engine/behavior.js';
import { newAlibi, answerAlibi, advanceAlibi, rewardAlibi, statementsFor, currentRound, ALIBI_ROUNDS } from '../src/engine/alibi.js';
import { gesturesFor, handshakeRounds, newHandshake, tapHandshake, GESTURES, GESTURE_STYLES, TRAIT_GESTURES, LONG_HANDSHAKE_AT } from '../src/engine/play.js';
import { newChase, temperOf, TEMPER } from '../src/engine/chase.js';
import { ACHIEVEMENTS } from '../src/engine/achievements.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;

function makePet(id, over = {}) {
  return Object.assign({
    id, name: id, traits: [], art: { body: '', stamps: [] },
    stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, bio: '', born: Date.now() - 5 * DAY,
    needs: { food: 60, fuss: 60, clean: 60 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0
  }, over);
}
function shelf(pets, props = []) {
  const s = blankState();
  pets.forEach((p, i) => { s.pets.push(p); s.slots[i] = p.id; });
  props.forEach((q, i) => { s.props.push(q); s.slots[pets.length + i] = q.id; });
  return normalizeState(s);
}
function everyInnerLine() {
  return Object.values(TRAIT_INNER).flat()
    .concat(Object.values(INNER_LINES).flat(), DREAM_LINES, SLEEPING_NOTES);
}

/* ================= the inner voice ================= */

test('form 9 is registered, weighted, and deliberately not an ambient default', () => {
  assert.ok(FORMS.includes('thought'), 'thought must be a known form or notes carrying it get rewritten');
  assert.ok(FORM_SHARE.thought > 0, 'chooseForm skips any form with no share');
  assert.ok(FORM_SHARE.thought < FORM_SHARE.line, 'the inner voice must stay rarer than the one-liner');
  assert.ok(!AMBIENT_FORMS.includes('thought'),
    'an untagged block of prose must never be tagged as somebody thinking it');
});

test('every archetype has an inner voice, and no trait id has drifted', () => {
  const ids = new Set(TRAITS.map(t => t.id));
  TRAITS.forEach(t => {
    assert.ok(Array.isArray(TRAIT_INNER[t.id]) && TRAIT_INNER[t.id].length >= 2,
      `trait ${t.id} has no inner monologue`);
  });
  Object.keys(TRAIT_INNER).forEach(id =>
    assert.ok(ids.has(id), `TRAIT_INNER has ${id}, which is not a trait any more`));
});

test('the inner voice obeys the same kill list as everything else', () => {
  const withhold = /would not say|will not say|nobody will say|will not disclose|will not elaborate|will not explain|refuses to (say|explain)|will not discuss|not been shared|nobody knows what|will not repeat/i;
  everyInnerLine().forEach(line => {
    assert.ok(!withhold.test(line), `withheld ending in the inner voice: ${line}`);
    assert.ok(!/,\s*which\b[^.!?]*[.!?]?$/i.test(line.trim()), `explanatory final clause: ${line}`);
    assert.ok(line.length <= 280, `inner line runs to ${line.length} chars: ${line.slice(0, 50)}`);
    assert.ok(!/[{}]/.test(line.replace(/\{[pnghq]\}/g, '')), `unknown placeholder: ${line}`);
  });
});

test('the inner voice is written in the first person and never repeats itself', () => {
  const all = everyInnerLine();
  const seen = new Set();
  all.forEach(line => {
    assert.ok(!seen.has(line), `duplicated inner line: ${line}`);
    seen.add(line);
  });
  // Not every single line needs a pronoun — a few land better without one — but
  // the register as a whole has to be somebody talking to themselves.
  const spoken = Object.values(TRAIT_INNER).flat().concat(Object.values(INNER_LINES).flat(), DREAM_LINES);
  const firstPerson = spoken.filter(l => /\b(I|my|me|we|our|us)\b/i.test(l)).length;
  assert.ok(firstPerson / spoken.length >= 0.8,
    `only ${Math.round(firstPerson / spoken.length * 100)}% of the inner voice is first person`);
});

test('a waking pet can think, and the thought is its own archetype talking', () => {
  resetPickMemory();
  const s = shelf([makePet('p1', { traits: ['porcelain'], needs: { food: 70, fuss: 70, clean: 70 } })]);
  const pet = s.pets[0];
  const thoughts = [];
  for (let i = 0; i < 120; i++) {
    const line = petLine(s, pet, { now: Date.now() });
    if (line.form === 'thought') thoughts.push(line.text);
    addNote(s, line.text, 'x', line.kind, line.form);
  }
  assert.ok(thoughts.length > 0, 'the inner voice never reached the board');
  const own = TRAIT_INNER.porcelain;
  assert.ok(thoughts.some(t => own.includes(t)), 'none of its thoughts were its own trait');
});

test('a sleeping resident dreams instead of filing complaints', () => {
  resetPickMemory();
  // A nocturnal pet is asleep during the day, which is what isAsleep() keys on.
  const s = shelf([makePet('p1', { traits: ['nocturnal'], needs: { food: 8, fuss: 8, clean: 8 } })]);
  const pet = s.pets[0];
  const noon = new Date(2026, 8, 1, 12, 0, 0).getTime();
  const forms = new Set();
  let dreamt = false;
  for (let i = 0; i < 60; i++) {
    const line = petLine(s, pet, { now: noon });
    forms.add(line.form);
    if (DREAM_LINES.includes(line.text)) dreamt = true;
    assert.notEqual(line.kind, 'angry', 'a sleeping creature must not be filing grievances');
    addNote(s, line.text, 'x', line.kind, line.form);
  }
  assert.ok(dreamt, 'a sleeping resident never dreamt across sixty draws');
  assert.ok(!forms.has('doc') && !forms.has('direct'), 'a sleeper filed paperwork or turned round');
});

/* ================= the backup reminder ================= */

test('the backup reminder waits for a shelf worth losing, then asks weekly', () => {
  const now = Date.now();
  const base = () => Object.assign(blankState(), {
    pets: Array.from({ length: BACKUP_MIN_PETS }, (_, i) => makePet('p' + i)),
    started: now - 5 * DAY
  });
  assert.equal(backupDue(base(), now), true, 'an established, never-backed-up shelf should ask');
  assert.equal(backupDue(Object.assign(base(), { pets: [makePet('p0')] }), now), false, 'one resident is not worth a banner');
  assert.equal(backupDue(Object.assign(base(), { started: now - HOUR }), now), false, 'never nag on day one');
  assert.equal(backupDue(Object.assign(base(), { lastBackup: now - DAY }), now), false, 'a recent copy silences it');
  assert.equal(backupDue(Object.assign(base(), { lastBackup: now - BACKUP_STALE - HOUR }), now), true, 'a stale copy asks again');
  assert.equal(backupDue(Object.assign(base(), { backupSnooze: now - HOUR }), now), false, '"not now" must mean not now');
  assert.equal(backupDue(Object.assign(base(), { backupSnooze: now - BACKUP_SNOOZE - HOUR }), now), true, 'a snooze expires');
  assert.equal(backupDue(null, now), false);
});

test('the reminder fields survive a save written before they existed', () => {
  const s = normalizeState({ pets: [], notes: [], seq: 1, lastTick: 1, started: 1 });
  assert.equal(s.lastBackup, 0);
  assert.equal(s.backupSnooze, 0);
  assert.deepEqual(s.friction, {});
});

/* ================= friction: they remember each other ================= */

test('friction is symmetric, capped, and forgotten after about three days', () => {
  const s = shelf([makePet('a'), makePet('b')]);
  const now = Date.now();
  assert.equal(frictionBetween(s, 'a', 'b', now), 0);
  addFriction(s, 'a', 'b', now, 2);
  assert.equal(frictionBetween(s, 'a', 'b', now), 2);
  assert.equal(frictionBetween(s, 'b', 'a', now), 2, 'a grudge between two creatures is one grudge');
  assert.equal(frictionKey('b', 'a'), frictionKey('a', 'b'));
  for (let i = 0; i < 20; i++) addFriction(s, 'a', 'b', now, 2);
  assert.ok(frictionBetween(s, 'a', 'b', now) <= FRICTION_MAX, 'friction has to have a ceiling');
  assert.ok(frictionBetween(s, 'a', 'b', now + FRICTION_DECAY_MS / 2) < FRICTION_MAX);
  assert.equal(frictionBetween(s, 'a', 'b', now + FRICTION_DECAY_MS + 1), 0, 'it has to wear off');
  assert.equal(addFriction(s, 'a', 'a', now, 1), 0, 'nobody can fall out with themselves');
});

test('a robbed resident scores its robber lower, and stops when it has forgiven them', () => {
  const s = shelf([makePet('a'), makePet('b')]);
  const now = Date.now();
  const [a, b] = s.pets;
  const before = pairScore(s, a, b, now);
  addFriction(s, 'a', 'b', now, 2);
  const after = pairScore(s, a, b, now);
  assert.ok(after < before, 'being robbed must make a neighbour less appealing');
  const later = pairScore(s, a, b, now + FRICTION_DECAY_MS + 1);
  assert.ok(Math.abs(later - before) < 1e-9, 'once forgiven, the score returns to where it was');
});

test('friction is validated on load rather than trusted', () => {
  const s = normalizeState({
    pets: [], notes: [],
    friction: { 'a|b': { n: 99, at: Date.now() }, 'rubbish': { n: 1, at: 1 }, 'c|d': 'not a record' }
  });
  assert.ok(s.friction['a|b'].n <= 8, 'an absurd tally is clamped');
  assert.equal(s.friction.rubbish, undefined, 'a malformed key is dropped');
  assert.equal(s.friction['c|d'], undefined, 'a malformed record is dropped');
});

/* ================= patience and being carried ================= */

test('wanting the same slot repeatedly lowers the bar, but only so far', () => {
  const now = Date.now();
  const pet = makePet('a');
  assert.equal(resolveOf(pet, 5, now), 0, 'no history, no resolve');
  pet.wants = { slot: 5, since: now, at: now, tries: 1 };
  assert.ok(resolveOf(pet, 5, now) > 0);
  assert.equal(resolveOf(pet, 4, now), 0, 'resolve is about one particular square');
  pet.wants.tries = 2;
  assert.equal(resolveOf(pet, 5, now), 2 * PATIENCE_STEP);
  pet.wants.tries = 99;
  assert.equal(resolveOf(pet, 5, now), PATIENCE_MAX, 'patience cannot make a move free');
  assert.equal(resolveOf(pet, 5, now + 7 * HOUR), 0, 'an old want is dropped');
});

test('a creature carried somewhere worse objects, remembers, and files a note', () => {
  const now = Date.now();
  // A Sugar Fiend beside the Snack Bowl has a great deal to lose.
  const s = shelf([makePet('a', { traits: ['sugar'] })], [{ id: 'r1', kind: 'bowl' }]);
  const pet = s.pets[0];
  assert.ok(slotScore(s, pet, 0, now) > slotScore(s, pet, 4, now), 'fixture: slot 0 must be the better square');
  const notesBefore = s.notes.length;
  s.slots[0] = null; s.slots[4] = 'a';                       // as ui/drag.js would
  const verdict = notePlayerMove(s, 'a', 0, 4, now);
  assert.equal(verdict.objected, true);
  assert.ok(verdict.drop > 0);
  assert.equal(pet.displacedFrom, 0, 'it remembers the square you took it out of');
  assert.ok(pet.wants && pet.wants.slot === 0, 'and it starts trying to get back');
  assert.ok(s.notes.length > notesBefore, 'being carried off is worth a note');
});

test('a move it does not mind is not treated as a grievance', () => {
  const now = Date.now();
  const s = shelf([makePet('a', { traits: ['sugar'] })], [{ id: 'r1', kind: 'bowl' }]);
  s.slots[0] = null; s.slots[2] = 'a';                       // still beside the bowl
  const verdict = notePlayerMove(s, 'a', 0, 2, now);
  assert.equal(verdict.objected, false);
  assert.equal(s.pets[0].displacedFrom, null);
});

test('a displaced resident heads back toward the slot it was taken from', () => {
  const now = Date.now();
  const s = shelf([makePet('a', { traits: ['sugar'] })], [{ id: 'r1', kind: 'bowl' }]);
  const pet = s.pets[0];
  s.slots[0] = null; s.slots[4] = 'a';
  notePlayerMove(s, 'a', 0, 4, now);
  const move = decideMove(s, pet, now + 40 * 60000);
  assert.ok(move, 'it should want to do something about that');
  assert.ok(slotScore(s, pet, move.to, now) > slotScore(s, pet, 4, now),
    'whatever it does, it must be an improvement on where you put it');
});

test('the new per-pet fields are defaulted and clamped on load', () => {
  const s = normalizeState({
    pets: [{ id: 'p1', name: 'X', art: { body: '', stamps: [] }, wants: { slot: 999, tries: 900 }, displacedFrom: -7, alibis: 'lots' }],
    notes: []
  });
  const p = s.pets[0];
  assert.ok(!p.wants || p.wants.slot < SLOT_COUNT, 'a nonsense slot is clamped or dropped');
  assert.ok(p.displacedFrom === null || p.displacedFrom >= 0);
  assert.equal(p.alibis, 0, 'a non-number play count is reset');
});

/* ================= the alibi ================= */

function alibiShelf() {
  return shelf([
    makePet('a', { name: 'Gary', careLog: { food: 3, fuss: 0, clean: 1 }, grudges: 2, bond: 4, born: Date.now() - 9 * DAY }),
    makePet('b', { name: 'Doreen' }),
    makePet('c', { name: 'Mildew' })
  ], [{ id: 'r1', kind: 'bowl' }]);
}

test('every statement the alibi can offer is checkable, and the truths are true', () => {
  const s = alibiShelf();
  const pet = s.pets[0];
  const { truths, lies } = statementsFor(s, pet);
  assert.ok(truths.length >= ALIBI_ROUNDS * 2, 'not enough true statements to build a game');
  assert.ok(lies.length >= ALIBI_ROUNDS, 'not enough lies to build a game');
  // Spot-check the claims against the shelf they were generated from.
  const text = truths.map(t => t.text).join(' | ');
  assert.ok(text.includes('Doreen on my right'), 'it should know who is actually beside it');
  assert.ok(text.includes('there are 3 of us'), 'it should be able to count the shelf');
  assert.ok(text.includes('never once fussed over me'), 'it should know what you have never done');
  const lieText = lies.map(l => l.text).join(' | ');
  assert.ok(!lieText.includes('Doreen on my right'), 'a lie must not restate a truth');
});

test('an alibi is three rounds of three, with exactly one lie and no repeats', () => {
  let seed = 11;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const s = alibiShelf();
  const game = newAlibi(s, s.pets[0], rng);
  assert.equal(game.rounds.length, ALIBI_ROUNDS);
  const seen = new Set();
  game.rounds.forEach(round => {
    assert.equal(round.statements.length, 3);
    assert.ok(round.lie >= 0 && round.lie < 3, 'every round needs exactly one marked lie');
    round.statements.forEach(t => {
      assert.ok(!seen.has(t), `the same statement was offered twice: ${t}`);
      seen.add(t);
      assert.ok(!/[{}]/.test(t), `unsubstituted placeholder in a statement: ${t}`);
    });
  });
});

test('answering is untimed, unpunished, and closes the game exactly once', () => {
  const s = alibiShelf();
  const game = newAlibi(s, s.pets[0]);
  assert.equal(answerAlibi(game, 99), 'ignored', 'a nonsense index changes nothing');
  const first = currentRound(game);
  const wrong = (first.lie + 1) % 3;
  assert.equal(answerAlibi(game, wrong), 'wrong');
  assert.equal(answerAlibi(game, 0), 'ignored', 'a round only takes one answer');
  assert.equal(game.correct, 0);
  assert.equal(advanceAlibi(game), true);
  assert.equal(answerAlibi(game, currentRound(game).lie), 'right');
  assert.equal(advanceAlibi(game), true);
  assert.equal(answerAlibi(game, currentRound(game).lie), 'right');
  assert.equal(game.complete, true);
  assert.equal(game.correct, 2);
  assert.equal(answerAlibi(game, 0), 'ignored', 'a finished game is finished');
});

test('a clean sweep pays trust; a partial one pays attention only', () => {
  const now = Date.now();
  const s = alibiShelf();
  const pet = s.pets[0];
  pet.needs.fuss = 10;
  const game = newAlibi(s, pet);
  while (!game.complete) { answerAlibi(game, currentRound(game).lie); advanceAlibi(game); }
  const reward = rewardAlibi(s, game, now);
  assert.equal(reward.clean, true);
  assert.ok(reward.bond >= 1, 'finding every lie should be worth trust');
  assert.ok(reward.fuss > 0);
  assert.equal(rewardAlibi(s, game, now), null, 'a reward cannot be claimed twice');

  const s2 = alibiShelf();
  const pet2 = s2.pets[0];
  pet2.needs.fuss = 10;
  const partial = newAlibi(s2, pet2);
  while (!partial.complete) { answerAlibi(partial, (currentRound(partial).lie + 1) % 3); advanceAlibi(partial); }
  const meagre = rewardAlibi(s2, partial, now);
  assert.equal(meagre.clean, false);
  assert.equal(meagre.bond, 0, 'trust is for a clean sweep only');
});

test('a resident that has just played gets practice, not another reward', () => {
  const now = Date.now();
  const s = alibiShelf();
  const pet = s.pets[0];
  pet.lastPlayed = now - 1000;                       // inside PLAY_COOLDOWN
  const game = newAlibi(s, pet);
  while (!game.complete) { answerAlibi(game, currentRound(game).lie); advanceAlibi(game); }
  const reward = rewardAlibi(s, game, now);
  assert.equal(reward.practice, true);
  assert.equal(reward.bond, 0);
  assert.equal(reward.fuss, 0);
});

test('a shelf with nothing to swear to yields an empty game rather than throwing', () => {
  const s = shelf([makePet('a')]);
  const game = newAlibi(s, s.pets[0]);
  assert.ok(Array.isArray(game.rounds));
  assert.doesNotThrow(() => answerAlibi(game, 0));
});

/* ================= the two older games ================= */

test('each archetype teaches the handshake in its own words, and unknown traits still work', () => {
  assert.deepEqual(gesturesFor({ traits: [] }), GESTURES, 'a plain creature keeps the house names');
  assert.deepEqual(gesturesFor({ traits: ['nonsense'] }), GESTURES, 'an unmapped trait must not break the game');
  const damp = gesturesFor({ traits: ['damp'] });
  assert.notDeepEqual(damp, GESTURES);
  assert.equal(damp.length, 4, 'there are four pads, so there are four names');
  Object.values(GESTURE_STYLES).forEach(style => assert.equal(style.length, 4));
  Object.values(TRAIT_GESTURES).forEach(style =>
    assert.ok(GESTURE_STYLES[style], `TRAIT_GESTURES points at a style that does not exist: ${style}`));
  const ids = new Set(TRAITS.map(t => t.id));
  Object.keys(TRAIT_GESTURES).forEach(id => assert.ok(ids.has(id), `${id} is not a trait`));
});

test('the handshake grows a fourth round once a resident really trusts you', () => {
  assert.equal(handshakeRounds(makePet('a', { bond: 0 })), 3);
  assert.equal(handshakeRounds(makePet('a', { bond: LONG_HANDSHAKE_AT })), 4);
  const shy = newHandshake(makePet('a', { bond: 0 }));
  const close = newHandshake(makePet('b', { bond: 20 }));
  assert.equal(shy.sequence.length, 4);
  assert.equal(close.sequence.length, 5, 'a longer handshake needs a longer pattern');
  // Play the long one through: it must take four rounds, not three.
  let rounds = 0;
  for (let guard = 0; guard < 40 && !close.complete; guard++) {
    const result = tapHandshake(close, close.sequence[close.cursor]);
    if (result === 'round' || result === 'complete') rounds++;
  }
  assert.equal(close.complete, true);
  assert.equal(rounds, 4);
});

test('the chase reads the creature it is played with', () => {
  assert.ok(temperOf('furious').speed > temperOf('content').speed, 'a furious resident is quicker');
  assert.ok(temperOf('furious').grip < temperOf('content').grip, 'and harder to steer');
  assert.deepEqual(temperOf('nonsense'), TEMPER.fine, 'an unknown mood falls back rather than breaking');
  const calm = newChase(makePet('a'), { mood: 'content' });
  const cross = newChase(makePet('b'), { mood: 'furious' });
  assert.ok(cross.speedScale > calm.speedScale);
  assert.ok(cross.grip < calm.grip);
  const trusted = newChase(makePet('c', { bond: 20 }), {});
  const stranger = newChase(makePet('d', { bond: 0 }), {});
  assert.ok(trusted.shield > stranger.shield, 'a resident that trusts you takes a knock for you');
});

/* ================= the record ================= */

test('every incident is unique, safely checkable, and actually reachable', () => {
  const ids = new Set();
  ACHIEVEMENTS.forEach(a => {
    assert.ok(!ids.has(a.id), `duplicate achievement id: ${a.id}`);
    ids.add(a.id);
    ['label', 'desc', 'hint', 'toastLine'].forEach(k =>
      assert.equal(typeof a[k], 'string', `${a.id} is missing ${k}`));
    assert.equal(typeof a.check, 'function');
    // A blank shelf must not throw, and must not hand out anything but the ones
    // a blank shelf genuinely satisfies.
    assert.doesNotThrow(() => a.check(blankState()), `${a.id} throws on an empty shelf`);
  });
  assert.ok(ACHIEVEMENTS.length >= 25, 'the record should cover more than the early game');
  const covered = ACHIEVEMENTS.map(a => a.id).join(' ');
  ['case', 'visitor', 'handshake', 'chase', 'promise'].forEach(topic =>
    assert.ok(covered.includes(topic), `nothing in the record covers ${topic}`));
});

test('the new incidents fire off real save data', () => {
  const s = alibiShelf();
  const byId = id => ACHIEVEMENTS.find(a => a.id === id);
  assert.equal(byId('first-handshake').check(s), false);
  s.pets[0].handshakes = 1;
  assert.equal(byId('first-handshake').check(s), true);
  assert.equal(byId('first-case').check(s), false);
  s.stories = { archive: [{ kind: 'case', title: 'x', text: 'y', at: Date.now() }] };
  assert.equal(byId('first-case').check(s), true);
  assert.equal(byId('dreamt-of').check(s), false);
  addNote(s, 'I could blink.', 'Gary', 'note', 'thought');
  assert.equal(byId('dreamt-of').check(s), true);
});
