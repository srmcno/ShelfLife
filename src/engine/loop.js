import { tick, moodOf, worstNeed, isAsleep, hasTrait, neighborProps, neighborPets } from './tick.js';
import { activeFeuds, feudPairKey, stepFeudArc, checkGrudgeEscalation, checkinStreak } from './achievements.js';
import { checkUnlocks } from './unlocks.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS } from '../content/props.js';
import { COMPLAINTS, HAPPY_NOTES, EVENTS } from '../content/copy.js';
import { MATURE_COMPLAINTS_EXTRA, MATURE_HAPPY_EXTRA, MATURE_EVENTS_EXTRA } from '../content/mature.js';
import { pick, addNote, clamp, petById } from '../state.js';

export function petLine(state, pet) {
  const mood = moodOf(pet);
  const need = worstNeed(pet);
  if (mood === 'furious' || mood === 'annoyed') {
    let pool = COMPLAINTS[need][mood];
    if (state.settings.matureMode) pool = pool.concat(MATURE_COMPLAINTS_EXTRA[need] || []);
    return { text: pick(pool), kind: 'angry' };
  }
  const i = state.slots.indexOf(pet.id);
  const nbrs = i >= 0 ? neighborPets(state, i) : [];
  const trait = TRAIT_BY_ID[pick(pet.traits)];
  if (nbrs.length && trait.social && Math.random() < 0.45) {
    return { text: pick(trait.social).replace(/\{n\}/g, pick(nbrs).name), kind: 'note' };
  }
  if (mood === 'content' && Math.random() < 0.35) {
    let pool = HAPPY_NOTES;
    if (state.settings.matureMode) pool = pool.concat(MATURE_HAPPY_EXTRA);
    return { text: pick(pool), kind: 'note' };
  }
  return { text: pick(trait.notes), kind: 'note' };
}

export function autonomy(state) {
  state.pets.forEach(pet => {
    const mood = moodOf(pet);
    const i = state.slots.indexOf(pet.id);
    if (i < 0) return;
    if ((mood === 'furious' || hasTrait(pet, 'wanderer')) && Math.random() < (mood === 'furious' ? 0.45 : 0.2)) {
      const nbrs = neighborPets(state, i);
      if (nbrs.length) {
        const other = pick(nbrs);
        const j = state.slots.indexOf(other.id);
        state.slots[i] = other.id;
        state.slots[j] = pet.id;
        addNote(state, 'Moved itself next to ' + other.name + '. Nobody was consulted.', pet.name, 'angry');
      }
    }
    if (hasTrait(pet, 'thief') && pet.needs.food < 45) {
      const nbrs = neighborPets(state, i);
      if (nbrs.length) {
        const victim = pick(nbrs);
        victim.needs.food = clamp(victim.needs.food - 14, 0, 100);
        pet.needs.food = clamp(pet.needs.food + 12, 0, 100);
        addNote(state, 'Took food from ' + victim.name + '. ' + victim.name + ' is aware.', pet.name, 'feud');
      }
    }
  });
}

export function checkShelf(state, now = Date.now()) {
  tick(state, now);
  if (!state.pets.length) {
    addNote(state, pick([
      'The shelf is empty and somehow still judging you.',
      'Nothing lives here. The dust has opinions anyway.',
      'Empty. The wood creaked once, unprompted.'
    ]), 'the shelf', 'note');
    return;
  }
  activeFeuds(state).slice(0, 2).forEach(([a, b]) => {
    stepFeudArc(state, feudPairKey(a.id, b.id), a, b);
  });
  const occupied = state.slots.map((id, i) => id ? i : -1).filter(i => i >= 0);
  const chosen = occupied.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  chosen.forEach(i => {
    const pet = petById(state, state.slots[i]);
    if (!pet) return;
    if (isAsleep(pet, new Date(now)) && Math.random() < 0.5) {
      addNote(state, 'Asleep. Has left a note reading "later".', pet.name, 'note');
      return;
    }
    const near = neighborProps(state, i);
    if (near.length && moodOf(pet) !== 'furious' && Math.random() < 0.42) {
      const pr = pick(near);
      addNote(state, pick(PROPS[pr.kind].lines).replace(/\{p\}/g, pet.name), PROPS[pr.kind].name, 'note');
      return;
    }
    const line = petLine(state, pet);
    if (line.kind === 'angry') {
      pet.grudges = (pet.grudges || 0) + 1;
      checkGrudgeEscalation(state, pet);
    }
    addNote(state, line.text, pet.name, line.kind);
  });
  if (state.props.length && Math.random() < 0.35) {
    const pr = pick(state.props);
    addNote(state, pick(PROPS[pr.kind].ambient), PROPS[pr.kind].name, 'note');
  }
  let eventPool = EVENTS;
  if (state.settings.matureMode) eventPool = eventPool.concat(MATURE_EVENTS_EXTRA);
  if (Math.random() < 0.4) addNote(state, pick(eventPool), 'the shelf', 'note');
  autonomy(state);
  checkinStreak(state, now);
  checkUnlocks(state);
}
