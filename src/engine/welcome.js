import { rememberEcho } from '../household-echoes.js';
import { lifeState, awardDiscovery, recordScene } from './life.js';
import { addNote, clamp } from '../state.js';
import { depleteProp, isSpent } from './behavior.js';
import { isAsleep } from './tick.js';

// A small, optional housewarming. The guest is a scene actor, never a resident.
// Old households receive no furniture or invented memories on upgrade.
export function welcomeView(state, now = Date.now()) {
  const l = lifeState(state), w = l.welcome;
  const pet = w?.petId ? state.pets.find(p => p.id === w.petId) : state.pets[0];
  if (!pet || w?.dismissed || (l.introDone && !w)) return null;
  const bowl = state.props.find(p => p.id === w?.bowlId && p.kind === 'bowl');
  const from = state.slots.indexOf(pet.id);
  const spaces = state.slots.map((id, i) => id === null && Math.floor(i / 6) === Math.floor(from / 6) && Math.abs(i - from) <= 2 ? i : -1).filter(i => i >= 0);
  const bowlSlot = bowl ? state.slots.indexOf(bowl.id) : -1;
  const near = bowlSlot >= 0 && from >= 0 && Math.floor(bowlSlot / 6) === Math.floor(from / 6) && Math.abs(bowlSlot - from) <= 2;
  const stage = w?.choice ? 'finished' : bowl ? 'ready' : 'offered';
  const reason = stage === 'ready' ? !near ? 'Move the bowl within two spaces of this resident on the same shelf.' : isSpent(state, bowl.id, now) ? 'The bowl is empty. It refills in ' + Math.ceil((state.behavior.props[bowl.id].emptyUntil - now) / 60000) + ' min; then you can offer a serving.' : '' : stage === 'offered' && !spaces.length ? 'Make a free space beside this resident for the bowl.' : '';
  // Replays retain the state of the actual incident, including after dusk or a
  // trait edit. isAsleep expects a Date, not the numeric engine timestamp.
  const asleep = stage === 'finished' ? w.asleep === true : isAsleep(pet, new Date(now));
  const territorial = pet.traits?.some(t => ['feral', 'bitey', 'landlord', 'hoarder'].includes(t));
  const affectionate = pet.traits?.some(t => ['clingy', 'socialite', 'sugar'].includes(t));
  const line = asleep ? 'It is asleep. Madam Moth lowers her voice, then complains about having to.' : territorial ? 'It puts its whole body between the bowl and the visitor. The bowl is winning on width.' : affectionate ? 'It leaves space for company, then pats that space with worrying insistence.' : 'It checks whether Madam Moth has brought food. She checks whether it has.';
  const scale = asleep ? .5 : 1;
  const rewards = Object.fromEntries(['share', 'keep'].map(choice => [choice, {
    food: Math.max(0, Math.min(100 - pet.needs.food, (choice === 'share' ? 6 : 15) * scale)),
    fuss: Math.max(0, Math.min(100 - pet.needs.fuss, (choice === 'share' ? 8 : 0) * scale)),
    discovery: l.awards.includes('welcome:first-bite') ? 0 : 1
  }]));
  return { pet, bowl, stage, reason, slot: spaces[0], line, choice: w?.choice, text: w?.text || '', asleep, rewards };
}

export function unpackWelcome(state, now = Date.now()) {
  const v = welcomeView(state, now);
  if (!v || v.stage !== 'offered' || v.reason) return false;
  const bowl = { id: 'd' + state.seq++ + '_' + now.toString(36), kind: 'bowl' };
  state.props.push(bowl); state.slots[v.slot] = bowl.id;
  lifeState(state).welcome = { petId: v.pet.id, bowlId: bowl.id, at: now, choice: '', text: '' };
  addNote(state, 'A Snack Bowl has arrived beside ' + v.pet.name + '. Madam Moth arrives empty-handed and opens her mouth anyway.', 'housewarming', 'arrival');
  return true;
}

export function chooseWelcome(state, choice, now = Date.now()) {
  const v = welcomeView(state, now);
  if (!v || v.stage !== 'ready' || v.reason || !['share', 'keep'].includes(choice)) return null;
  const pet = v.pet, { food, fuss } = v.rewards[choice];
  pet.needs.food = clamp(pet.needs.food + food, 0, 100);
  pet.needs.fuss = clamp(pet.needs.fuss + fuss, 0, 100);
  state.behavior ||= {}; state.behavior.props ||= {};
  const servings = state.behavior.props[v.bowl.id] ||= { uses: 0, emptyUntil: 0, touched: {} };
  servings.uses = (Number.isFinite(servings.uses) ? servings.uses : 0) + 1;
  if (servings.uses >= 2) depleteProp(state, v.bowl.id, now);
  const text = v.asleep ? pet.name + ' accepts a sleepy feeding. Madam Moth ' + (choice === 'share' ? 'lays her half in the empty spoon and hums a funeral march. The corpse is then eaten.' : 'stares at the empty spoon, then quietly eats a loose thread from her sleeve.') : choice === 'share' ? pet.name + ' offers half a crumb. Madam Moth lays it out like a body, folds its imaginary arms, then eats the mourners first.' : pet.name + ' eats the first serving while maintaining eye contact. Madam Moth measures the bowl for a coffin. It spits one crumb back. She doubles the quote.';
  rememberEcho(state,'welcome',pet.id,'welcome:'+pet.id,now,(v.asleep?'sleep-':'')+choice);
  const l = lifeState(state);
  Object.assign(l.welcome, { choice, text, asleep: v.asleep }); l.introDone = true;
  const discovery = awardDiscovery(state, 'welcome:first-bite', 1, now) ? 1 : 0;
  const scene = recordScene(state, 'housewarming', 'The first bite', text, [pet.id], now, { key: 'welcome', branch: choice, guest: 'moth', object: v.asleep ? 'sleepy' : 'bowl' });
  addNote(state, text, 'housewarming', 'note');
  return { food, fuss, discovery, scene };
}

export function welcomeScene(state, now = Date.now()) {
  const v = welcomeView(state, now); if (!v) return null;
  return { title: 'The first bite', text: v.text || v.line, cast: [v.pet.id], stage: { key: 'welcome', branch: v.choice || 'setup', guest: 'moth', object: v.asleep ? 'sleepy' : 'bowl' } };
}
