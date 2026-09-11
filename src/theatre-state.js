import { SHELF_SCENE_BY_KIND, SHELF_SCENE_VARIANTS } from './content/shelf-theatre.js';

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
const text = (value, length) => typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, length) : '';
const time = (value, now) => Number.isFinite(value) ? Math.max(0, Math.min(value, now)) : 0;

export function blankTheatre() {
  return { serial: 0, lastAt: 0, lastNoteAt: 0, seen: [], recent: [], careAt: {}, lamps: {}, pairs: {} };
}

// Import-safe: no state/engine imports. Keep only live actor/prop references;
// observed variants survive rehoming, while their actor-specific records do not.
export function normalizeTheatre(raw, state = {}, now = Date.now()) {
  const source = record(raw) ? raw : {};
  now = Number.isFinite(now) && now >= 0 ? now : Date.now();
  const pets = new Set((Array.isArray(state.pets) ? state.pets : []).map(p => p?.id).filter(safeId));
  const props = new Map((Array.isArray(state.props) ? state.props : []).filter(p => safeId(p?.id)).map(p => [p.id, p.kind]));
  const out = blankTheatre();
  out.serial = Number.isFinite(source.serial) ? Math.floor(Math.max(0, Math.min(source.serial, 1e12))) : 0;
  out.lastAt = time(source.lastAt, now); out.lastNoteAt = time(source.lastNoteAt, now);
  out.seen = [...new Set((Array.isArray(source.seen) ? source.seen : []).filter(id => typeof id === 'string' && Object.hasOwn(SHELF_SCENE_VARIANTS, id)))];
  out.careAt = Object.fromEntries(Object.entries(record(source.careAt) ? source.careAt : {}).filter(([id]) => pets.has(id)).map(([id, at]) => [id, time(at, now)]));
  out.lamps = Object.fromEntries(Object.entries(record(source.lamps) ? source.lamps : {}).filter(([id, value]) => props.get(id) === 'lamp' && typeof value === 'boolean'));
  for (const item of Object.values(record(source.pairs) ? source.pairs : {}).slice(0, 153)) {
    if (!record(item) || !Array.isArray(item.actorIds)) continue;
    const actorIds = [...new Set(item.actorIds.filter(id => pets.has(id)))].sort();
    if (actorIds.length !== 2 || !['argument', 'makeup', 'comfort'].includes(item.last)) continue;
    out.pairs[actorIds.join('|')] = { actorIds, last: item.last, at: time(item.at, now) };
  }
  for (const item of (Array.isArray(source.recent) ? source.recent : []).slice(0, 12)) {
    if (!record(item) || typeof item.variant !== 'string' || !Object.hasOwn(SHELF_SCENE_VARIANTS, item.variant)) continue;
    const definition = SHELF_SCENE_VARIANTS[item.variant], family = SHELF_SCENE_BY_KIND[definition.kind];
    const actorIds = [...new Set((Array.isArray(item.actorIds) ? item.actorIds : []).filter(id => pets.has(id)))].slice(0, 2);
    const requiredActors = Math.max(family.minActors, ...definition.lines.map(line => line.actor + 1));
    if (actorIds.length < requiredActors) continue;
    const propId = family.propKind ? item.propId : null;
    if (family.propKind && props.get(propId) !== family.propKind) continue;
    out.recent.push({ id: Math.floor(time(item.id, out.serial)), kind: definition.kind, action: definition.action,
      variant: item.variant, title: definition.title, actorIds, propId, at: time(item.at, now), summary: text(item.summary, 420) });
  }
  return out;
}
