import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS } from '../content/props.js';
import { DECAY } from '../content/copy.js';
import { propById, clamp, HOUR, MAX_OFFLINE_HOURS } from '../state.js';

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

export function decayRate(pet, need, state) {
  let r = DECAY[need];
  pet.traits.forEach(id => {
    const c = (TRAIT_BY_ID[id] && TRAIT_BY_ID[id].care) || {};
    if (c[need]) r *= c[need];
  });
  const i = state.slots.indexOf(pet.id);
  if (i >= 0) {
    const nbrs = neighborProps(state, i);
    nbrs.forEach(pr => {
      const a = (PROPS[pr.kind] && PROPS[pr.kind].aura) || {};
      if (a[need]) r *= a[need];
    });
    if (hasTrait(pet, 'nocturnal') && nbrs.some(pr => pr.kind === 'lamp') && need === 'fuss') r *= 1.5;
  }
  return r;
}

export function tick(state, now = Date.now()) {
  let hours = (now - state.lastTick) / HOUR;
  if (hours <= 0) { state.lastTick = now; return false; }
  hours = Math.min(hours, MAX_OFFLINE_HOURS);
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
