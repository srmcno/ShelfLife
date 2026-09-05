import { TRAIT_CARE } from '../content/care.js';
import { tick, isAsleep } from './tick.js';
import { ASLEEP_LINES, OVERFED, CARE_LINES, ROUNDS_NOTES, ROUNDS_NAMED, ROUNDS_TOASTS } from '../content/copy.js';
import { clamp, pick, addNote, recordCare } from '../state.js';

export const CARE_GAIN = { food: 34, fuss: 38, clean: 42 };

export function careFor(state, pet, need, now = Date.now()) {
  tick(state, now);
  const before = pet.needs[need];
  let gain = CARE_GAIN[need];
  let line;
  if (isAsleep(pet, new Date(now))) {
    gain = Math.round(gain * 0.5);
    line = pick(ASLEEP_LINES);
  } else if (before > 78) {
    gain = Math.round(gain * 0.25);
    line = pick(OVERFED[need]);
  } else {
    const specific = (pet.traits || []).flatMap(t => TRAIT_CARE[t]?.[need] || []);
    line = pick(specific.length && Math.random() < .5 ? specific : CARE_LINES[need]);
  }
  pet.needs[need] = clamp(before + gain, 0, 100);
  // The only choke point where the game learns who you went to, in what order,
  // and how long you kept fussing. Read back by the state-aware notes in loop.js.
  recordCare(state, pet, need, now);
  let bondGained = false;
  if (before < 72) {
    pet.cared++;
    if (pet.cared % 3 === 0) {
      pet.bond = clamp(pet.bond + 1, 0, 25);
      bondGained = true;
    }
  }
  return { message: pet.name + ': ' + line, bondGained };
}

export function doRounds(state, now = Date.now()) {
  tick(state, now);
  if (!state.pets.length) return null;
  state.pets.forEach(pet => {
    ['food', 'fuss', 'clean'].forEach(k => { pet.needs[k] = clamp(pet.needs[k] + 13, 0, 100); });
  });
  // Who was first and who was last is read off the shelf order, so the note can
  // hold it against you by name.
  const inOrder = state.slots.map(id => state.pets.find(p => p.id === id)).filter(Boolean);
  const first = inOrder[0], last = inOrder[inOrder.length - 1];
  const named = inOrder.length >= 2 && first !== last && Math.random() < 0.4;
  const text = named
    ? pick(ROUNDS_NAMED).replace(/\{first\}/g, first.name).replace(/\{last\}/g, last.name).replace(/\{n\}/g, String(inOrder.length))
    : pick(ROUNDS_NOTES);
  addNote(state, text, 'the shelf', 'note');
  return { message: pick(ROUNDS_TOASTS) };
}
