import { OBSERVATIONS, CARE_CONTEXT, CONTEXT_EXCHANGES } from '../content/observations.js';
import { neighborPets } from './tick.js';
import { FEUDS } from '../content/feuds.js';
import { VISITORS } from '../content/stories.js';
const TWELVE_HOURS = 12 * 3600000;
const promised = (state, pet, now) => {
  const r = state.stories?.requests?.[pet.id];
  return r?.status === 'accepted' && now >= r.at && now < r.at + TWELVE_HOURS ? r : null;
};
const fill = (text, names) => text.replace(/\{(\w+)\}/g, (token, key) => names[key] ?? token);

// Only text backed by the current save reaches the existing shuffle bags and
// note-form budget. No extra simulation, invented counts, or render-time rolls.
export function observationLines(state, pet, now = Date.now()) {
  const topics = [], names = { p: pet.name };
  if (pet.needs.food < 35) topics.push(['hungry']);
  if (pet.needs.fuss < 35) topics.push(['lonely']);
  if (pet.needs.clean < 35) topics.push(['dirty']);
  if (pet.needs.food >= 90) topics.push(['full']);
  if (pet.needs.clean >= 90) topics.push(['spotless']);
  if (pet.bond >= 8) topics.push(['trust']);
  if (pet.grudges >= 2) topics.push(['grudge', { count: pet.grudges }]);
  const former = pet.names?.length > 1 ? pet.names.at(-2)?.name : null;
  if (former) topics.push(['renamed', { old: former }]);
  if (promised(state, pet, now)) topics.push(['promise']);
  if (pet.fulfilledRequests >= 2) topics.push(['kept', { count: pet.fulfilledRequests }]);
  if (pet.chases > 0) topics.push(['chase']);
  if (pet.handshakes > 0) topics.push(['handshake']);
  if (pet.alibiWins > 0) topics.push(['alibi']);
  if (pet.arcadeRuns > 0) topics.push(['arcade']);
  const v = state.stories?.visitor;
  if (v?.welcomed && v.hostId === pet.id && now < v.at + 6 * 3600000) {
    const visitor = VISITORS.find(d => d.id === v.kind)?.name;
    if (visitor) topics.push(['guest', { visitor }]);
  }
  const rival = neighborPets(state, state.slots.indexOf(pet.id)).find(other => {
    if (state.feudArcs?.[[pet.id, other.id].sort().join('|')]?.truce) return false;
    return FEUDS.some(([a,b]) => pet.traits.includes(a) && other.traits.includes(b) || pet.traits.includes(b) && other.traits.includes(a));
  });
  if (rival) topics.push(['rival', { n: rival.name }]);
  return topics.flatMap(([topic, extra]) => OBSERVATIONS[topic].map(line => fill(line, { ...names, ...extra })));
}
export function contextualCare(state, pet, need, now = Date.now()) {
  const bank = CARE_CONTEXT[need];
  if (!bank) return [];
  if (promised(state, pet, now)?.kind === need) return bank.promised;
  if (pet.needs[need] < 35) return bank.urgent;
  return pet.bond >= 8 ? bank.trusted : [];
}
export function contextualExchanges(state, a, now = Date.now()) {
  const keys = [];
  if (a.needs.food < 35) keys.push('hungry');
  if (a.needs.food >= 90) keys.push('full');
  if (a.needs.fuss < 35) keys.push('lonely');
  if (a.needs.clean < 35) keys.push('dirty');
  if ((a.grudges || 0) >= 2) keys.push('grudge');
  const previousName = a.names?.length > 1 ? a.names.at(-2)?.name : null;
  if (previousName && previousName !== a.name) keys.push('renamed');
  if (promised(state, a, now)) keys.push('promise');
  if (a.bond >= 8) keys.push('trusted');
  return keys.flatMap(key => CONTEXT_EXCHANGES[key].map(entry => key === 'renamed'
    ? { ...entry, turns: entry.turns.map(([who, line]) => [who, line.replaceAll('{old}', previousName.replace(/[{}]/g, ''))]) }
    : entry));
}
