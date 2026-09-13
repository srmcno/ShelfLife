import { ESCAPADES, escapadeById } from '../content/escapades.js';
import { normalizeEscapades } from '../escapade-state.js';
import { addNote } from '../state.js';
import { awardDiscovery, recordScene } from './life.js';

const personalize = (text, petName) => String(text || '').replaceAll('{name}', () => petName);
const storyKey = (episodeId, endingId) => episodeId + ':' + endingId;

function albumView(record) {
  const episode = escapadeById(record.episodeId), ending = episode.endings.find(item => item.id === record.endingId);
  return { ...record, episode, ending, keepsake: ending.keepsake,
    text: personalize(ending.text, record.petName), callback: personalize(ending.callback, record.petName) };
}

// Rendering uses a normalized copy and cannot accept invitations, finish stories
// or mint discoveries. A rehomed actor retires naturally without losing its album.
export function escapadeView(state, now = Date.now()) {
  const journal = normalizeEscapades(state.escapades, state, now);
  let active = null;
  if (journal.active) {
    const saved = journal.active, episode = escapadeById(saved.episodeId);
    const approach = episode.approaches.find(item => item.id === saved.approachId);
    const careDone = saved.careAt !== null, playDone = saved.playAt !== null;
    active = { ...saved, episode, approach, pet: state.pets.find(pet => pet.id === saved.petId),
      careDone, playDone, ready: careDone && playDone, completedSteps: Number(careDone) + Number(playDone), totalSteps: 2 };
  }
  return { active, episodes: ESCAPADES.map(episode => {
    const completedEndings = journal.album.filter(item => item.episodeId === episode.id).map(item => item.endingId);
    return { episode, completedEndings, complete: completedEndings.length === episode.endings.length };
  }), album: journal.album.map(albumView), completed: journal.album.length,
  total: ESCAPADES.reduce((sum, episode) => sum + episode.endings.length, 0), completions: journal.completions };
}

export function startEscapade(state, { episodeId, approachId, petId } = {}, now = Date.now()) {
  if (!Number.isFinite(now) || now < 0) return false;
  const journal = normalizeEscapades(state.escapades, state, now);
  const episode = escapadeById(episodeId), approach = episode?.approaches.find(item => item.id === approachId);
  const pet = state.pets.find(item => item.id === petId);
  if (journal.active || !episode || !approach || !pet) return false;
  journal.active = { episodeId, approachId, petId, petName: pet.name, startedAt: now, careAt: null, playAt: null };
  state.escapades = journal;
  return true;
}

export function finishEscapade(state, endingId, now = Date.now()) {
  if (!Number.isFinite(now) || now < 0) return null;
  const journal = normalizeEscapades(state.escapades, state, now), active = journal.active;
  const episode = active && escapadeById(active.episodeId), ending = episode?.endings.find(item => item.id === endingId);
  if (!active || active.careAt === null || active.playAt === null || !ending) return null;
  const key = storyKey(episode.id, ending.id), previous = journal.album.find(item => item.key === key);
  const fresh = !previous;
  const receipt = previous || { key, episodeId: episode.id, endingId: ending.id, approachId: active.approachId,
    petId: active.petId, petName: active.petName, at: now };
  if (fresh) journal.album.push(receipt);
  journal.completions = Math.min(100000, journal.completions + 1);
  journal.active = null;
  state.escapades = journal;
  // The permanent album also guards old endings after life.awards' bounded
  // rolling ledger has moved on. Both rewards and notes happen only at finale.
  const discoveries = fresh && awardDiscovery(state, 'escapade:' + key, 2, now) ? 2 : 0;
  const text = personalize(ending.text, active.petName), callback = personalize(ending.callback, active.petName);
  recordScene(state, 'escapade', ending.title, text, [active.petId], now,
    { key: 'escapade', branch: episode.id, object: ending.keepsake });
  addNote(state, callback || text, active.petName, 'note');
  return { fresh, discoveries, record: albumView(receipt), episode, ending, text, callback };
}
