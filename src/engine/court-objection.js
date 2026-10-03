import { QUESTIONS_PER_EPISODE } from '../content/court.js';
import { OBJECTION_STRIKE, OBJECTION_CONFIRM, OBJECTION_PRESS } from '../content/court-bonus.js';
import { episodeCase, questionOrder, scriptLines, pickOf, nudge, lineSets, fill } from './court.js';
import { needsCheck, settle, addNote } from './court-notes.js';

/* The Objection: one per episode, one real decision. It can do one of two
   things, and the player chooses when.

     CHECK a note. Any note marked unconfirmed (a lead, or a clue from someone
       who exaggerates) can be checked. A lead is struck from the record; a
       clue is confirmed, and a confirmed clue earns the jury's respect that it
       was withheld until then.
     PRESS the witness. When no note needs checking, or you would rather have
       another clue than a certainty, press the last testimony: the next clue
       question you have not asked gives up its clue now, at the cost of a
       little of the audience's patience. That question is spent.

   Nothing here is random except which of three takes is played. */
export const STRIKE_RESPECT = 4;       // striking a lead: the jury likes a tidy record
export const CONFIRM_RESPECT = 6;      // what a clue earns once it is confirmed (the same as an unquestioned one)
export const PRESS_RATINGS = -4;       // pressing a witness bores the audience a little

export const objectionsLeft = ep => (ep && !ep.done ? ep.objections || 0 : 0);
export const checkable = ep => (objectionsLeft(ep) > 0 ? needsCheck(ep) : []);

// The next clue question that has not been asked, in the order it is offered.
function pressTarget(ep) {
  const k = episodeCase(ep);
  return questionOrder(ep).find(i => k.questions[i].clue && !ep.asked.includes(i) && !ep.spent.includes(i));
}
// Pressing needs a testimony to press (something has been asked), an unspent
// clue behind it, and a turn left to have been spent on it.
export function canPress(ep) {
  return objectionsLeft(ep) > 0 && ep.asked.length > 0 && ep.asked.length < QUESTIONS_PER_EPISODE && pressTarget(ep) !== undefined;
}
export const objectionOptions = ep => ({ left: objectionsLeft(ep), notes: checkable(ep), press: canPress(ep) });

export function checkNote(ep, noteId, rnd = Math.random) {
  const note = (ep.notes || [])[noteId];
  if (!note || !note.shaky || note.state || objectionsLeft(ep) <= 0) return null;
  ep.objections--;
  const struck = note.kind === 'lead';
  settle(ep, note, struck ? 'struck' : 'confirmed');
  nudge(ep, { respect: struck ? STRIKE_RESPECT : CONFIRM_RESPECT });
  const take = pickOf(struck ? OBJECTION_STRIKE : OBJECTION_CONFIRM, rnd);
  return { outcome: struck ? 'struck' : 'confirmed', note, lines: scriptLines(ep, take) };
}

export function pressWitness(ep, rnd = Math.random) {
  if (!canPress(ep)) return null;
  const index = pressTarget(ep), q = episodeCase(ep).questions[index];
  ep.objections--;
  ep.spent.push(index);
  const note = addNote(ep, { text: fill(ep, q.clue), kind: 'clue', index });
  nudge(ep, { ratings: PRESS_RATINGS, respect: 3 });
  const answer = pickOf(lineSets(q.lines), rnd);
  return { index, note, clue: note.text, lines: [...scriptLines(ep, pickOf(OBJECTION_PRESS, rnd)), ...scriptLines(ep, answer)] };
}
