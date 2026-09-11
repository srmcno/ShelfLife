import { SHELF_SCENES, SHELF_SCENE_BY_KIND } from '../content/shelf-theatre.js';
import { normalizeTheatre } from '../theatre-state.js';
import { affinityFor, socialPull, petsFeud, frictionBetween, depleteProp } from './behavior.js';
import { isAsleep } from './tick.js';
import { feudPairKey } from './achievements.js';
import { addNote } from '../state.js';

export const SHELF_SCENE_INTERVAL = 24000;
export const SHELF_ENCORE_INTERVAL = 8000;
export const SHELF_SCENE_CARE_INTERVAL = 20 * 60000;
const NOTE_INTERVAL = 60000;
const ROW_WIDTH = 6;
const has = (pet, traits) => traits.some(id => pet.traits?.includes(id));
const need = (pet, key) => Number.isFinite(pet.needs?.[key]) ? pet.needs[key] : 70;
const cross = (a, b) => Math.floor(a / ROW_WIDTH) === Math.floor(b / ROW_WIDTH) && Math.abs(a - b) <= 2;
const pairKey = ids => [...ids].sort().join('|');
const grumpy = pet => (need(pet, 'food') + need(pet, 'fuss') + need(pet, 'clean')) / 3 < 50;
const reading = (state, now) => normalizeTheatre(state.theatre, state, now);
const residentName = pet => typeof pet?.name === 'string' ? pet.name : 'The resident';
const knownKind = kind => kind == null || typeof kind === 'string' && Object.hasOwn(SHELF_SCENE_BY_KIND, kind);

export function lampIsOn(state, propId) {
  return state?.theatre?.lamps?.[propId] !== false;
}

function lightPreference(pet) {
  // The same light preferences that drive furniture affinity. Neutral residents
  // prefer enough light to see their own grievances.
  const preference = affinityFor(pet, 'lamp');
  return preference >= 0;
}

function compatible(state, a, b, now) {
  const truce = state.feudArcs?.[feudPairKey(a.id, b.id)]?.truce;
  return (!petsFeud(a, b) || truce) && frictionBetween(state, a.id, b.id, now) < 1;
}

function pairAction(state, actors, theatre, now) {
  const [a, b] = actors;
  if (!compatible(state, a, b, now) || grumpy(a) || grumpy(b)) return 'argument';
  if (theatre.pairs[pairKey(actors.map(p => p.id))]?.last === 'argument') return 'makeup';
  return 'comfort';
}

function awakeResidents(state, now) {
  return (state.pets || []).filter(pet => Array.isArray(pet.traits) && state.slots?.includes(pet.id) && !isAsleep(pet, new Date(now)));
}

// Read-only candidates. A cast never wraps from the end of one row to the next,
// and a scenery object that has been put away cannot host a performance.
export function availableShelfScenes(state, now = Date.now(), { propId, petId } = {}) {
  const awake = awakeResidents(state, now), theatre = reading(state, now), candidates = [];
  const position = id => state.slots.indexOf(id);
  const add = (kind, prop, actors, weight) => {
    const actorIds = actors.map(pet => pet.id);
    if (petId && !actorIds.includes(petId)) return;
    const recentCount = theatre.recent.slice(0, 4).filter(scene => scene.kind === kind && scene.actorIds.some(id => actorIds.includes(id))).length;
    candidates.push({ kind, propId: prop?.id || null, actorIds, weight: Math.max(.2, weight / (1 + recentCount * 2)) });
  };
  for (const prop of state.props || []) {
    if (propId && prop.id !== propId || position(prop.id) < 0) continue;
    const family = SHELF_SCENES.find(scene => scene.propKind === prop.kind);
    if (!family) continue;
    const nearby = awake.filter(pet => cross(position(pet.id), position(prop.id)));
    for (const lead of nearby) {
      const affinity = affinityFor(lead, prop.kind);
      if (prop.kind === 'tub' && affinity < 0 && need(lead, 'clean') >= 55) continue;
      if (['musicbox', 'mirror', 'phone'].includes(prop.kind) && affinity <= 0) continue;
      if (prop.kind === 'yarn' && affinity <= 0 && !has(lead, ['feral', 'bitey', 'swarm'])) continue;
      let partners = nearby.filter(other => other.id !== lead.id && cross(position(lead.id), position(other.id)));
      if (['musicbox', 'yarn'].includes(prop.kind)) partners = partners.filter(other => affinityFor(other, prop.kind) >= 0 && compatible(state, lead, other, now));
      if (prop.kind === 'bowl') partners = partners.filter(other => compatible(state, lead, other, now));
      if (prop.kind === 'lamp') partners = partners.filter(other => lightPreference(lead) !== lightPreference(other));
      partners.sort((a, b) => need(a, prop.kind === 'tub' ? 'clean' : 'fuss') - need(b, prop.kind === 'tub' ? 'clean' : 'fuss') || a.id.localeCompare(b.id));
      const actors = [lead, ...partners.slice(0, 1)];
      if (actors.length < family.minActors) continue;
      if (prop.kind === 'lamp' && actors.length === 1 && lightPreference(lead) === lampIsOn(state, prop.id)) continue;
      const urgency = prop.kind === 'tub' ? (100 - need(lead, 'clean')) / 25 : prop.kind === 'bowl' ? (100 - need(lead, 'food')) / 25 : (100 - need(lead, 'fuss')) / 50;
      add(family.kind, prop, actors, 2 + Math.max(0, affinity) + urgency);
    }
  }
  if (!propId) for (let i = 0; i < awake.length; i++) for (let j = i + 1; j < awake.length; j++) {
    const a = awake[i], b = awake[j];
    if (!cross(position(a.id), position(b.id))) continue;
    // The steadier neighbour makes the offer; the other gets the small benefit.
    const actors = need(a, 'fuss') >= need(b, 'fuss') ? [a, b] : [b, a];
    const action = pairAction(state, actors, theatre, now);
    if (action === 'comfort' && actors.some(pet => socialPull(pet) < -1) && Math.min(a.bond || 0, b.bond || 0) < 6) continue;
    add('pair', null, actors, action === 'makeup' ? 7 : action === 'argument' ? 2 : 2 + Math.max(0, socialPull(actors[0])) + (100 - need(actors[1], 'fuss')) / 35);
  }
  return candidates;
}

function waitRemaining(theatre, options, now) {
  return theatre.lastAt > 0 ? Math.max(0, (options.manual ? SHELF_ENCORE_INTERVAL : SHELF_SCENE_INTERVAL) - (now - theatre.lastAt)) : 0;
}

export function sceneAvailability(state, options = {}, now = Date.now()) {
  const wait = waitRemaining(reading(state, now), options, now);
  if (wait) return 'Give them ' + Math.ceil(wait / 1000) + ' seconds to finish their last bit.';
  if (!(state.pets || []).length) return 'Make a resident first. Every little performance needs someone in it.';
  if (!awakeResidents(state, now).length) return 'The residents are asleep. Their performances resume when they wake.';
  if (!knownKind(options.kind)) return 'That performance is not in this collection.';
  const choices = availableShelfScenes(state, now, options).filter(scene => !options.kind || scene.kind === options.kind);
  if (choices.length) return '';
  if (options.petId && !awakeResidents(state, now).some(pet => pet.id === options.petId)) return 'That resident is asleep or away from the shelf.';
  const targetProp = (state.props || []).find(prop => prop.id === options.propId);
  const family = SHELF_SCENE_BY_KIND[options.kind] || SHELF_SCENES.find(scene => scene.propKind === targetProp?.kind);
  if (family?.propKind) {
    const props = (state.props || []).filter(prop => prop.kind === family.propKind && (!options.propId || prop.id === options.propId) && state.slots.includes(prop.id));
    const nearby = awakeResidents(state, now).filter(pet => (!options.petId || pet.id === options.petId) && props.some(prop => cross(state.slots.indexOf(pet.id), state.slots.indexOf(prop.id))));
    if (nearby.length && family.kind === 'bath') return 'The nearby residents dislike baths and are still clean enough to refuse. Try a resident who enjoys water, or come back when cleanliness falls below 55.';
    if (nearby.length && family.kind === 'lamp') return 'Nearby residents already have the light as they like it. Try the switch or place a neighbour with different tastes nearby.';
  }
  return family?.requirements || 'Place awake residents within two spaces of furniture or one another, on the same row. Their quirks decide which performances suit them.';
}

function choose(items, random, weight = () => 1) {
  const weights = items.map(weight), sum = weights.reduce((n, value) => n + value, 0);
  let roll = Math.max(0, Math.min(.999999999, Number(random()) || 0)) * sum;
  for (let i = 0; i < items.length; i++) { roll -= weights[i]; if (roll < 0) return items[i]; }
  return items.at(-1);
}

function care(theatre, pet, key, amount, now, rewards) {
  if (!Number.isFinite(pet?.needs?.[key]) || theatre.careAt[pet.id] > 0 && now - theatre.careAt[pet.id] < SHELF_SCENE_CARE_INTERVAL) return;
  const before = pet.needs[key], after = Math.min(100, Math.max(0, before + amount));
  if (after <= before) return;
  pet.needs[key] = after;
  theatre.careAt[pet.id] = now;
  rewards.push({ petId: pet.id, need: key, gain: after - before });
}

export function performShelfScene(state, options = {}, now = Date.now(), random = Math.random) {
  if (!Number.isFinite(now) || now < 0 || !knownKind(options.kind)) return null;
  const exactCast = options.actorIds;
  if (exactCast !== undefined && (!Array.isArray(exactCast) || exactCast.length < 1 || exactCast.length > 2 ||
    new Set(exactCast).size !== exactCast.length || !exactCast.every(id => typeof id === 'string' && state.pets?.some(pet => pet.id === id)))) return null;
  const theatre = reading(state, now);
  if (waitRemaining(theatre, options, now)) return null;
  const candidates = availableShelfScenes(state, now, options).filter(scene => (!options.kind || scene.kind === options.kind) &&
    (exactCast === undefined || scene.actorIds.length === exactCast.length && scene.actorIds.every((id, index) => id === exactCast[index])));
  if (!candidates.length) return null;
  const choice = choose(candidates, random, scene => scene.weight), family = SHELF_SCENE_BY_KIND[choice.kind];
  const actors = choice.actorIds.map(id => state.pets.find(pet => pet.id === id));
  const [a, b] = actors, before = {}, after = {};
  let mode = b ? 'pair' : 'solo';
  if (choice.kind === 'lamp') {
    before.lit = lampIsOn(state, choice.propId);
    after.lit = lightPreference(b || a);
    mode = (b ? 'dispute-' : '') + (after.lit ? 'on' : 'off');
  } else if (choice.kind === 'pair') mode = pairAction(state, actors, theatre, now);
  else if (choice.kind === 'bowl' && state.behavior?.props?.[choice.propId]?.emptyUntil > now) mode = 'empty';
  const eligible = family.variants.filter(variant => variant.mode === mode);
  if (!eligible.length) return null;
  const unseen = eligible.filter(variant => !theatre.seen.includes(variant.id));
  const nonrepeat = eligible.filter(variant => variant.id !== theatre.recent.find(scene => scene.kind === choice.kind)?.variant);
  const variant = choose(unseen.length ? unseen : nonrepeat.length ? nonrepeat : eligible, random);
  const fill = text => text.replace(/\{a\}|\{b\}/g, key => residentName(key === '{a}' ? a : b));
  const fresh = !theatre.seen.includes(variant.id), rewards = [];
  state.theatre = theatre;
  if (choice.kind === 'lamp') theatre.lamps[choice.propId] = after.lit;
  if (choice.kind === 'pair') theatre.pairs[pairKey(choice.actorIds)] = { actorIds: [...choice.actorIds].sort(), last: variant.action, at: now };
  if (choice.kind === 'bath') { care(theatre, a, 'clean', 6, now, rewards); if (b) care(theatre, b, 'clean', 2, now, rewards); }
  else if (['musicbox', 'yarn'].includes(choice.kind)) { care(theatre, a, 'fuss', 3, now, rewards); care(theatre, b, 'fuss', 3, now, rewards); }
  else if (choice.kind === 'mirror') care(theatre, a, 'fuss', 2, now, rewards);
  else if (choice.kind === 'bowl' && mode !== 'empty') {
    care(theatre, a, 'food', 5, now, rewards); if (b) care(theatre, b, 'food', 2, now, rewards);
    if (rewards.length) {
      // Share the real bowl's two-serving/refill rules with ordinary behaviour.
      state.behavior ||= {}; state.behavior.props ||= {};
      const serving = state.behavior.props[choice.propId] ||= { uses: 0, emptyUntil: 0, touched: {} };
      serving.uses = (Number.isFinite(serving.uses) ? serving.uses : 0) + 1;
      if (serving.uses >= 2) depleteProp(state, choice.propId, now);
    }
  } else if (choice.kind === 'phone') {
    care(theatre, a, 'fuss', 3, now, rewards);
    if (b && compatible(state, a, b, now)) care(theatre, b, 'fuss', 1, now, rewards);
  } else if (choice.kind === 'lamp') {
    for (const pet of actors) if (lightPreference(pet) === after.lit) care(theatre, pet, 'fuss', 1, now, rewards);
  } else if (variant.action === 'comfort') { care(theatre, a, 'fuss', 1, now, rewards); care(theatre, b, 'fuss', 5, now, rewards); }
  else if (variant.action === 'makeup') { care(theatre, a, 'fuss', 3, now, rewards); care(theatre, b, 'fuss', 3, now, rewards); }
  const summary = fill(variant.summary);
  const event = { id: ++theatre.serial, kind: choice.kind, action: variant.action, variant: variant.id, title: variant.title,
    actorIds: choice.actorIds, propId: choice.propId, lines: variant.lines.map(line => ({ actorId: actors[line.actor].id, text: fill(line.text) })),
    before, after, fresh, summary, rewards };
  theatre.lastAt = now;
  if (fresh) theatre.seen.push(variant.id);
  theatre.recent.unshift({ id: event.id, kind: event.kind, action: event.action, variant: event.variant, title: event.title,
    actorIds: event.actorIds.slice(), propId: event.propId, at: now, summary });
  theatre.recent.length = Math.min(12, theatre.recent.length);
  const meaningful = rewards.length > 0 || choice.kind === 'lamp' && before.lit !== after.lit || variant.action === 'makeup';
  if ((fresh || meaningful) && (!theatre.lastNoteAt || now - theatre.lastNoteAt >= NOTE_INTERVAL)) {
    addNote(state, summary, 'the little theatre', 'note'); theatre.lastNoteAt = now;
  }
  return event;
}

export function toggleLamp(state, propId, now = Date.now()) {
  if (!Number.isFinite(now) || now < 0 || !(state.props || []).some(prop => prop.id === propId && prop.kind === 'lamp') || !state.slots?.includes(propId)) return null;
  const theatre = reading(state, now);
  const lit = !lampIsOn(state, propId);
  state.theatre = theatre; theatre.lamps[propId] = lit; theatre.lastAt = now;
  return lit;
}
