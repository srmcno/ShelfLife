import { TRAIT_CARE } from '../content/care.js';
import { tick, isAsleep } from './tick.js';
import { ASLEEP_LINES, OVERFED, CARE_LINES, ROUNDS_NOTES, ROUNDS_NAMED, ROUNDS_TOASTS } from '../content/copy.js';
import { clamp, pick, addNote, recordCare } from '../state.js';

export const CARE_GAIN = { food: 34, fuss: 38, clean: 42 };

export const ROUNDS_COOLDOWN = 60000;
export function roundsWait(state, now = Date.now()) {
  return Number.isFinite(state.lastRounds) && state.lastRounds > 0 ? Math.max(0, state.lastRounds + ROUNDS_COOLDOWN - now) : 0;
}
// Shared by the UI and execution so the preview includes sleep, saturation,
// and the 100-point cap rather than promising the nominal base gain.
export function previewCare(pet, need, now = Date.now()) {
  const before = pet.needs[need];
  const asleep = isAsleep(pet, new Date(now));
  const factor = asleep ? .5 : before > 78 ? .25 : 1;
  // A cute resident gets a little more out of being fussed over. Particulars
  // are shown on every card; this is one of the four places they act.
  const cute = pet.stats && typeof pet.stats.cute === 'number' ? pet.stats.cute : 5;
  const charm = need === 'fuss' ? 1 + (cute - 5) * 0.03 : 1;
  return { gain: Math.min(100 - before, Math.round(CARE_GAIN[need] * factor * charm)), useful: before < 72,
    reason: asleep ? 'Sleepy · half effect' : before > 78 ? 'Already comfortable' : 'Builds trust' };
}

export function careFor(state, pet, need, now = Date.now()) {
  tick(state, now);
  const before = pet.needs[need];
  const preview = previewCare(pet, need, now);
  const gain = preview.gain;
  let line;
  if (isAsleep(pet, new Date(now))) {
    line = pick(ASLEEP_LINES);
  } else if (before > 78) {
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
    if (state.stories) state.stories.careActions = (Number(state.stories.careActions) || 0) + 1;
    if (pet.cared % 3 === 0) {
      pet.bond = clamp(pet.bond + 1, 0, 25);
      bondGained = true;
    }
  }
  return { message: pet.name + ': ' + line, bondGained, gain: pet.needs[need] - before };
}

export function doRounds(state, now = Date.now()) {
  tick(state, now);
  if (!state.pets.length) return null;
  const remaining = roundsWait(state, now);
  if (remaining) return { cooling: true, message: 'The trolley is being restocked. Try again in ' + Math.ceil(remaining / 1000) + ' seconds.' };
  state.lastRounds = now;
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
