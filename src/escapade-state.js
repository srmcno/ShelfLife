import { ESCAPADES, escapadeById } from './content/escapades.js';
import { ESCAPADE_CONTENT_VERSION } from './content/escapades-legacy.js';

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);
const name = value => typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 22) : '';
const timestamp = (value, now) => Number.isFinite(value) && value >= 0 && value <= now ? value : null;
const endingCount = () => ESCAPADES.reduce((sum, episode) => sum + episode.endings.length, 0);

export function blankEscapades() {
  return { version: 1, active: null, album: [], completions: 0 };
}

// Save data contains only decisions and observed progress. Definitions and art
// are authored content; loading a receipt never runs a reward or scene hook.
export function normalizeEscapades(raw, state = {}, now = Date.now()) {
  const source = record(raw) ? raw : {}, out = blankEscapades();
  now = Number.isFinite(now) && now >= 0 ? now : Date.now();
  const pets = new Map((Array.isArray(state.pets) ? state.pets : []).filter(p => safeId(p?.id)).map(p => [p.id, p]));
  const seen = new Set();
  for (const item of (Array.isArray(source.album) ? source.album : []).slice(0, 256)) {
    if (!record(item)) continue;
    const episode = escapadeById(item.episodeId), ending = episode?.endings.find(end => end.id === item.endingId);
    const approach = episode?.approaches.find(path => path.id === item.approachId);
    const at = timestamp(item.at, now), petName = name(item.petName);
    if (!ending || !approach || !safeId(item.petId) || !petName || at === null) continue;
    const key = episode.id + ':' + ending.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.album.push({ key, episodeId: episode.id, endingId: ending.id, approachId: approach.id,
      petId: item.petId, petName, at, ...(item.contentVersion === ESCAPADE_CONTENT_VERSION ? { contentVersion: ESCAPADE_CONTENT_VERSION } : {}) });
    if (out.album.length === endingCount()) break;
  }
  out.album.sort((a, b) => a.at - b.at);
  out.completions = Number.isFinite(source.completions)
    ? Math.floor(Math.max(out.album.length, Math.min(100000, source.completions))) : out.album.length;
  const active = source.active;
  if (record(active)) {
    const episode = escapadeById(active.episodeId), approach = episode?.approaches.find(path => path.id === active.approachId);
    const pet = pets.get(active.petId), startedAt = timestamp(active.startedAt, now);
    if (episode && approach && pet && startedAt !== null) {
      const afterStart = value => {
        const at = timestamp(value, now);
        return at !== null && at >= startedAt ? at : null;
      };
      out.active = { episodeId: episode.id, approachId: approach.id, petId: pet.id,
        petName: name(active.petName) || name(pet.name) || 'Someone', startedAt,
        careAt: afterStart(active.careAt), playAt: afterStart(active.playAt) };
    }
  }
  return out;
}

// Engines report actual personal actions and their existing completion seams.
// This reducer has no engine imports, so care/play/life can all depend on it.
// Rounds, activity launch, cancelled play and save reconstruction never call it.
export function recordEscapadeEvent(state, event, now = Date.now()) {
  if (!state || !record(event) || !['care', 'play'].includes(event.kind) || !Array.isArray(event.petIds)
    || !Number.isFinite(now) || now < 0 || now < state.escapades?.active?.startedAt) return false;
  const journal = normalizeEscapades(state.escapades, state, now), active = journal.active;
  state.escapades = journal;
  if (!active || !event.petIds.includes(active.petId)) return false;
  const episode = escapadeById(active.episodeId), approach = episode.approaches.find(path => path.id === active.approachId);
  const field = event.kind === 'care' && event.need === episode.care.need ? 'careAt'
    : event.kind === 'play' && event.activity === approach.activity ? 'playAt' : null;
  if (!field || active[field] !== null) return false;
  active[field] = now;
  return true;
}
