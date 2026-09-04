import { tick, isAsleep } from './tick.js';
import { ASLEEP_LINES, OVERFED, CARE_LINES } from '../content/copy.js';
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
    line = pick(CARE_LINES[need]);
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

const ROUNDS_NOTES = [
  'You did the rounds. They can all tell it was the rounds.',
  'Everyone was seen to. Nobody was seen.',
  'You went down the line. They noticed the order.'
];
const ROUNDS_TOASTS = [
  'Rounds done. Nobody feels special.',
  'Everyone fed. Everyone unimpressed.',
  'Efficient. They hated it.'
];

export function doRounds(state, now = Date.now()) {
  tick(state, now);
  if (!state.pets.length) return null;
  state.pets.forEach(pet => {
    ['food', 'fuss', 'clean'].forEach(k => { pet.needs[k] = clamp(pet.needs[k] + 13, 0, 100); });
  });
  addNote(state, pick(ROUNDS_NOTES), 'the shelf', 'note');
  return { message: pick(ROUNDS_TOASTS) };
}
