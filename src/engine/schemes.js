import { recordSharedPlot } from './stories.js';
import { SCHEMES } from '../content/schemes.js';
import { addNote, clamp } from '../state.js';
import { tick, isAsleep } from './tick.js';

export const SCHEME_WAIT = 5 * 60000;
export const SCHEME_DEADLINE = 3 * 60000;
export function schemeState(state) {
  if (!state.schemes || typeof state.schemes !== 'object' || Array.isArray(state.schemes)) state.schemes = {};
  const s = state.schemes;
  if (!Number.isFinite(s.completed) || s.completed < 0) s.completed = 0;
  s.completed = Math.floor(s.completed);
  if (!Number.isFinite(s.lastAt) || s.lastAt < 0) s.lastAt = 0;
  if (!Array.isArray(s.history)) s.history = [];
  if (s.active && (!SCHEMES.some(p => p.id === s.active.kind) || typeof s.active.petId !== 'string' || !Number.isFinite(s.active.at))) s.active = null;
  return s;
}
export function currentScheme(state) {
  const active = schemeState(state).active;
  if (!active) return null;
  const pet = state.pets.find(p => p.id === active.petId);
  const definition = SCHEMES.find(p => p.id === active.kind);
  return pet && definition ? { ...active, pet, definition } : null;
}
export function resolveScheme(state, option, now = Date.now()) {
  const plan = currentScheme(state);
  if (!plan || ![0, 1, 'alone'].includes(option)) return null;
  const s = schemeState(state);
  tick(state, now);
  const choice = option === 'alone' ? null : plan.definition.choices[option];
  const changes = choice ? choice.changes : { food: -6, clean: -6, fuss: 8 };
  for (const [need, delta] of Object.entries(changes)) plan.pet.needs[need] = clamp(plan.pet.needs[need] + delta, 0, 100);
  if (choice) recordSharedPlot(state, plan.petId);
  if (choice) plan.pet.bond = clamp(plan.pet.bond + choice.bond, 0, 25);
  const text = (choice ? choice.outcome : plan.definition.autonomous).replaceAll('{p}', plan.pet.name);
  addNote(state, text, 'a small conspiracy', 'scheme');
  s.lastResult = { title: plan.definition.title, text, at: now };
  s.completed += 1;
  s.lastAt = now;
  s.history.unshift(plan.kind);
  s.history = s.history.slice(0, SCHEMES.length - 1);
  s.active = null;
  return { text, petId: plan.petId, choice: option };
}
export function advanceSchemes(state, now = Date.now()) {
  const s = schemeState(state);
  if (s.active && !currentScheme(state)) { s.active = null; s.lastAt = now; return true; }
  if (s.active) {
    if (now >= s.active.at + SCHEME_DEADLINE) { resolveScheme(state, 'alone', now); return true; }
    return false;
  }
  if (s.lastAt && now - s.lastAt < SCHEME_WAIT) return false;
  const awake = state.pets.filter(p => !isAsleep(p, new Date(now)));
  if (!awake.length) return false;
  const available = SCHEMES.filter(p => !s.history.includes(p.id));
  const definition = available[s.completed % available.length] || SCHEMES[0];
  const pet = awake[s.completed % awake.length];
  s.active = { kind: definition.id, petId: pet.id, at: now };
  return true;
}
