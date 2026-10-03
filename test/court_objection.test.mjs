import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { alt, QUESTIONS_PER_EPISODE } from '../src/content/court.js';
import { TWISTS } from '../src/content/court-twists.js';
import { castEpisode, episodeAsk, episodeRule, episodeCase, episodeQuestions, episodeReceipts, courtFinish } from '../src/engine/court.js';
import {
  objectionsLeft, checkable, canPress, objectionOptions, checkNote, pressWitness, STRIKE_RESPECT, CONFIRM_RESPECT, PRESS_RATINGS
} from '../src/engine/court-objection.js';
import { OBJECTIONS_PER_EPISODE, standingNotes, needsCheck } from '../src/engine/court-notes.js';
import { seededRandom } from '../src/engine/arcade.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
function shelf(...residents) {
  const s = blankState();
  s.pets = residents.map(([name, traits = ['damp'], bond = 2], i) => ({ id: 'g' + i, name, traits, needs: { food: 50, fuss: 40, clean: 50 }, bond, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const lead = () => ({
  id: 'red-herring', title: 'The Wrong Keith', truth: 'defendant',
  questions: {
    0: { clue: '{p} sold the coffin to Keith last spring for forty souls.', lines: alt([['d', 'It was sold to Keith.'], ['d', 'By the plaintiff.']], [['d', 'Sold.'], ['p', 'Fine.'], ['d', 'Thank you.']]) },
    1: { clue: 'The older name under the lid says Keith.', lines: alt([['bailiff', 'Keith.']], [['narrator', '(Keith.)']]) },
    3: { herring: '{d} was seen carrying a second coffin out of the sock drawer.', lines: alt([['d', 'My own coffin.']], [['p', 'I saw it.']]) },
    4: { clue: 'There is a receipt on the raisin shelf.', lines: alt([['p', 'A receipt.']], [['narrator', '(A receipt.)']]) }
  },
  rulings: { plaintiff: alt([['judge', 'For {p}.']], [['judge', 'For {p}, again.']]), defendant: alt([['judge', 'For {d}.']], [['judge', 'For {d}, again.']]), both: alt([['judge', 'Both.']], [['judge', 'Both, again.']]) },
  hallway: { p: ['a', 'b', 'c'], d: ['a', 'b', 'c'] }
});
const installed = [];
afterEach(() => { for (const id of installed.splice(0)) delete TWISTS[id]; });
function twisted(rest = []) {
  TWISTS['borrowed-coffin'] = [lead()]; installed.push('borrowed-coffin');
  const ep = castEpisode(shelf(['Agnes'], ['Mort', rest.length ? rest : ['damp']], ['Pip'], ['Dot']), { caseId: 'borrowed-coffin', twist: 'red-herring', plaintiffId: 'g0', defendantId: 'g1', now: NOW }, seededRandom(6));
  ep.plan.order = [0, 1, 2, 3, 4, 5];
  return ep;
}

test('one Objection per episode, and an untouched episode has nothing to check', () => {
  const ep = castEpisode(shelf(['Agnes'], ['Mort'], ['Pip']), { caseId: 'borrowed-coffin', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  assert.equal(OBJECTIONS_PER_EPISODE, 1);
  assert.equal(ep.objections, 1);
  assert.equal(objectionsLeft(ep), 1);
  assert.deepEqual(checkable(ep), []);
  assert.equal(canPress(ep), false, 'there is no testimony to press yet');
  assert.deepEqual(objectionOptions(ep), { left: 1, notes: [], press: false });
  assert.equal(checkNote(ep, 0), null, 'there is no such note');
  assert.equal(pressWitness(ep), null);
});

test('a lead is a note too, marked unconfirmed, and an Objection strikes it from the record', () => {
  const ep = twisted();
  const respect = ep.respect;
  episodeAsk(ep, 0, seededRandom(1));
  const r = episodeAsk(ep, 3, seededRandom(1));
  assert.equal(r.note.kind, 'lead'); assert.equal(r.note.shaky, true);
  assert.equal(r.clue, r.note.text, 'the screen notes a lead like a clue; it is not labelled by the engine');
  assert.equal(ep.respect, respect + 6, 'only the real clue earned respect; the lead earned none');
  assert.deepEqual(ep.clues, ep.notes.map(n => n.text));
  assert.deepEqual(needsCheck(ep).map(n => n.id), [1]);
  assert.deepEqual(checkable(ep).map(n => n.id), [1]);
  const done = checkNote(ep, 1, seededRandom(2));
  assert.equal(done.outcome, 'struck');
  assert.ok(done.lines.length >= 2 && done.lines.every(l => !/\{[a-z]+\}/.test(l.t)));
  assert.equal(ep.respect, respect + 6 + STRIKE_RESPECT);
  assert.equal(ep.notes[1].state, 'struck');
  assert.deepEqual(ep.clues, [ep.notes[0].text], 'a struck note leaves the board');
  assert.deepEqual(standingNotes(ep).map(n => n.id), [0]);
  assert.equal(objectionsLeft(ep), 0);
  assert.deepEqual(checkable(ep), []);
  assert.equal(checkNote(ep, 1), null, 'one per episode');
  assert.equal(canPress(ep), false);
});

test('a clue from an exaggerator is confirmed, and only then earns the respect it was withheld', () => {
  const ep = twisted(['terminal']);
  assert.equal(episodeCase(ep).questions[0].clue.includes('sold'), true);
  const respect = ep.respect;
  const a = episodeAsk(ep, 0, seededRandom(1));
  assert.equal(a.note.shaky, true, 'the defendant’s answers are the exaggerator’s');
  assert.equal(ep.respect, respect);
  const ok = checkNote(ep, a.note.id, seededRandom(3));
  assert.equal(ok.outcome, 'confirmed');
  assert.equal(ep.respect, respect + CONFIRM_RESPECT, 'the same as an unquestioned clue');
  assert.equal(ep.notes[0].state, 'confirmed');
  assert.deepEqual(ep.clues, [ep.notes[0].text], 'a confirmed note stands');
  assert.deepEqual(needsCheck(ep), []);
  assert.equal(objectionsLeft(ep), 0);
});

test('unchecked notes are not an obstacle to ruling, and the Objection cannot be used after the ruling', () => {
  const ep = twisted();
  episodeAsk(ep, 3, seededRandom(1));
  assert.equal(needsCheck(ep).length, 1);
  const result = episodeRule(ep, 'defendant', seededRandom(1));
  assert.equal(result.correct, true);
  assert.equal(objectionsLeft(ep), 0, 'an episode that is over has no Objection left');
  assert.equal(checkNote(ep, 0), null);
  assert.deepEqual(checkable(ep), []);
  assert.equal(pressWitness(ep), null);
});

test('pressing a witness forces a second clue from the next clue question, spends that question, and costs a little patience', () => {
  const ep = twisted();
  assert.equal(canPress(ep), false, 'nothing has been asked');
  episodeAsk(ep, 2, seededRandom(1));
  assert.equal(canPress(ep), true);
  assert.deepEqual(objectionOptions(ep), { left: 1, notes: [], press: true });
  const ratings = ep.ratings, respect = ep.respect;
  const pressed = pressWitness(ep, seededRandom(4));
  assert.equal(pressed.index, 0, 'the first clue question in the order offered');
  assert.equal(ep.spent.includes(0), true);
  assert.equal(ep.asked.length, 1, 'it is not one of the three questions');
  assert.equal(ep.ratings, ratings + PRESS_RATINGS);
  assert.equal(ep.respect, respect + 3);
  assert.deepEqual(ep.clues, [pressed.clue]);
  assert.equal(ep.notes[0].shaky, false);
  assert.ok(pressed.lines.length >= 3 && pressed.lines.every(l => !/\{[a-z]+\}/.test(l.t)));
  assert.equal(objectionsLeft(ep), 0);
  assert.equal(pressWitness(ep), null);
  assert.equal(episodeAsk(ep, 0, seededRandom(1)), null, 'the spent question is gone');
  assert.equal(episodeQuestions(ep).find(q => q.index === 0).asked, true);
  assert.equal(episodeAsk(ep, 1, seededRandom(1)).clue.includes('Keith'), true);
  assert.equal(ep.asked.length, 2);
});

test('pressing needs a clue left to give and a question left to have been spent on', () => {
  const ep = twisted();
  for (const i of [0, 1, 4]) ep.spent.push(i);   // every clue question is already spoken for
  episodeAsk(ep, 2, seededRandom(1));
  assert.equal(canPress(ep), false, 'no clue left behind the testimony');
  const full = twisted();
  for (const i of [2, 3, 5]) episodeAsk(full, i, seededRandom(1));
  assert.equal(full.asked.length, QUESTIONS_PER_EPISODE);
  assert.equal(canPress(full), false, 'questioning is over');
  assert.deepEqual(objectionOptions(full).notes.map(n => n.id), [0], 'but the lead can still be checked before the ruling');
});

test('the Objection and a free clue from receipts use different resources', () => {
  const ep = twisted();
  ep.cast.p.traits = ['witness'];
  const given = episodeReceipts(ep, seededRandom(1));
  assert.equal(given.length, 1);
  assert.equal(objectionsLeft(ep), 1, 'a gift costs no Objection');
  episodeAsk(ep, 2, seededRandom(1));
  assert.equal(pressWitness(ep, seededRandom(1)).index, 1, 'the question the gift spent is skipped');
  assert.deepEqual(ep.spent, [0, 1]);
});

test('the Objection is per episode: a fresh episode has its own', () => {
  const a = twisted(), b = twisted();
  episodeAsk(a, 3, seededRandom(1));
  checkNote(a, 0, seededRandom(1));
  assert.equal(objectionsLeft(a), 0);
  assert.equal(objectionsLeft(b), 1);
  const s = shelf(['Agnes'], ['Mort'], ['Pip']);
  const finished = castEpisode(s, { caseId: 'snoring-wall', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  episodeRule(finished, 'defendant', seededRandom(1));
  courtFinish(s, finished, NOW);
  assert.equal(castEpisode(s, { caseId: 'snoring-wall', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1)).objections, 1);
});
