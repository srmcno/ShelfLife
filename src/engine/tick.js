import { artPersonality } from './personality.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS } from '../content/props.js';
import { DECAY } from '../content/copy.js';
import { propById, petById, clamp, HOUR, MAX_OFFLINE_HOURS, NIGHT_DECAY_FACTOR } from '../state.js';

export const MOOD_WORD = { content: 'Content', fine: 'Fine', annoyed: 'Annoyed', furious: 'Furious' };

export function hasTrait(pet, key) {
  return pet.traits.some(id => TRAIT_BY_ID[id] && TRAIT_BY_ID[id][key]);
}

export function isNight(date = new Date()) {
  const h = date.getHours();
  return h >= 20 || h < 7;
}

export function isAsleep(pet, date = new Date()) {
  return hasTrait(pet, 'nocturnal') && !isNight(date);
}

export function neighborSlots(index, slotCount) {
  const out = [];
  if (index % 6 > 0) out.push(index - 1);
  if (index % 6 < 5) out.push(index + 1);
  return out.filter(x => x >= 0 && x < slotCount);
}

export function neighborProps(state, index) {
  return neighborSlots(index, state.slots.length)
    .map(x => state.slots[x])
    .filter(Boolean)
    .map(id => propById(state, id))
    .filter(Boolean);
}

export function neighborPets(state, index) {
  return neighborSlots(index, state.slots.length)
    .map(x => state.slots[x])
    .filter(Boolean)
    .map(id => petById(state, id))
    .filter(Boolean);
}

export function decayRate(pet, need, state) {
  let r = DECAY[need];
  pet.traits.forEach(id => {
    const c = (TRAIT_BY_ID[id] && TRAIT_BY_ID[id].care) || {};
    if (c[need]) r *= c[need];
  });
  const i = state.slots.indexOf(pet.id);
  if (i >= 0) {
    if (need === 'fuss' && neighborPets(state, i).some(p => artPersonality(p).halo)) r *= .9;
    const nbrs = neighborProps(state, i);
    nbrs.forEach(pr => {
      const a = (PROPS[pr.kind] && PROPS[pr.kind].aura) || {};
      if (a[need]) r *= a[need];
    });
    if (hasTrait(pet, 'nocturnal') && nbrs.some(pr => pr.kind === 'lamp') && need === 'fuss') r *= 1.5;
  }
  // Particulars, finally doing something: a damp resident attracts grime.
  const damp = pet.stats && typeof pet.stats.damp === 'number' ? pet.stats.damp : null;
  if (need === 'clean' && damp !== null) r *= 1 + (damp - 5) * 0.04;
  return r;
}

// Elapsed hours between two instants, with the night hours counted at
// NIGHT_DECAY_FACTOR. Walks the span an hour at a time (it is capped at
// MAX_OFFLINE_HOURS, so this is at most a couple of dozen steps).
export function effectiveHours(from, to) {
  let hours = (to - from) / HOUR;
  if (hours <= 0) return 0;
  hours = Math.min(hours, MAX_OFFLINE_HOURS);
  let out = 0;
  let cursor = to - hours * HOUR;
  while (cursor < to) {
    const step = Math.min(HOUR, to - cursor);
    out += (step / HOUR) * (isNight(new Date(cursor)) ? NIGHT_DECAY_FACTOR : 1);
    cursor += step;
  }
  return out;
}

export function tick(state, now = Date.now()) {
  if (now - state.lastTick <= 0) { state.lastTick = now; return false; }
  const hours = effectiveHours(state.lastTick, now);
  state.pets.forEach(pet => {
    ['food', 'fuss', 'clean'].forEach(k => {
      pet.needs[k] = clamp(pet.needs[k] - decayRate(pet, k, state) * hours, 0, 100);
    });
  });
  state.lastTick = now;
  return true;
}

export function moodOf(pet) {
  const avg = (pet.needs.food + pet.needs.fuss + pet.needs.clean) / 3;
  if (avg >= 76) return 'content';
  if (avg >= 50) return 'fine';
  if (avg >= 26) return 'annoyed';
  return 'furious';
}

export function worstNeed(pet) {
  let k = 'food';
  ['fuss', 'clean'].forEach(n => { if (pet.needs[n] < pet.needs[k]) k = n; });
  return k;
}
