import { PAIR_SAGAS } from '../content/pair-sagas.js';
import { FEUDS } from '../content/feuds.js';

const MINUTE = 60000;
const keyFor = (a, b) => [a.id, b.id].sort().join('|');
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const stats = ['menace', 'mystique', 'damp', 'cute'];
const styles = { menace: 'bureau', mystique: 'seance', damp: 'garden', cute: 'pageant' };

export function areRivals(a, b) {
  return FEUDS.some(([x, y]) => a.traits?.includes(x) && b.traits?.includes(y) || a.traits?.includes(y) && b.traits?.includes(x));
}

export function pairSagaStyle(a, b) {
  if (areRivals(a, b)) return 'feud';
  const weight = stat => (Number(a.stats?.[stat]) || 0) + (Number(b.stats?.[stat]) || 0);
  const best = Math.max(...stats.map(weight));
  const tied = stats.filter(stat => weight(stat) === best);
  // Equal stat sheets still get a stable story, without assigning a secret
  // random identity that can change on reload.
  const hash = keyFor(a, b).split('').reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 0);
  return styles[tied[hash % tied.length]];
}

export function normalizePairSaga(raw, now = Date.now()) {
  if (!record(raw) || !Object.hasOwn(PAIR_SAGAS, raw.style)) return null;
  const beats = (Array.isArray(raw.beats) ? raw.beats : []).slice(0, 3);
  if (!beats.length || !beats.every(beat => record(beat) && Number.isFinite(beat.at) && beat.at >= 0 && typeof beat.text === 'string' && beat.text.length <= 600)) return null;
  if (beats.some((beat, index) => index > 0 && beat.at < beats[index - 1].at)) return null;
  return { style: raw.style, beats: beats.map(beat => ({ at: Math.min(beat.at, now), text: beat.text })) };
}

export function pairSagaView(state, a, b) {
  const relation = state.stories?.relationships?.[keyFor(a, b)], saga = relation?.saga;
  if (!saga?.beats?.length || !Object.hasOwn(PAIR_SAGAS, saga.style)) return null;
  const definition = PAIR_SAGAS[saga.style], count = Math.min(3, saga.beats.length);
  return {
    name: definition.name,
    count,
    canStage: count === 2 && relation.plots >= 2,
    chapters: saga.beats.slice(0, count).map((beat, index) => ({ title: definition.chapters[index].title, text: beat.text, at: beat.at })),
    next: count === 3 ? 'The whole sorry history is on file.' : saga.style === 'feud'
      ? count === 1 ? 'Next: broker a truce when both residents have 3 trust.' : relation.plots < 2
        ? 'Next: share two plots as neighbours. Then stage a pair scene.'
        : 'Next: stage a calm or apologetic pair scene. An argument may need an encore.'
      : count === 1 ? 'Next: make two shared plots while they stand together.'
        : 'Next: stage a calm or apologetic pair scene. An argument may need an encore.'
  };
}

function ready(state, a, b, relation, saga, now) {
  const count = saga?.beats.length || 0, key = keyFor(a, b);
  const hostile = saga?.style === 'feud' || !saga && areRivals(a, b);
  const feud = state.feudArcs?.[key];
  if (count === 0) return hostile
    ? !!(feud?.truce || feud?.level >= 1)
    : relation.time >= 15 * MINUTE && Math.min(a.bond || 0, b.bond || 0) >= 1;
  // Returning households may already qualify for several chapters. Give the
  // opening a minute to land before the next report replaces it on the board.
  if (count === 1 && now < saga.beats[0].at + MINUTE) return false;
  if (count === 1) return hostile ? feud?.truce === true : relation.plots >= 2;
  if (count === 2) {
    const scene = state.theatre?.pairs?.[key];
    return relation.plots >= 2 && scene?.at > Math.max(saga.beats[1].at, relation.lastPlotAt || 0)
      && scene.at <= now && ['makeup', 'comfort'].includes(scene.last);
  }
  return false;
}

// One chapter at most per household update. Old saves may already have the
// evidence for several chapters; their opening gets its own moment on the board.
export function advancePairSaga(state, neighboringPairs, now = Date.now()) {
  for (const [first, second] of neighboringPairs) {
    const [a, b] = first.id < second.id ? [first, second] : [second, first];
    const relation = state.stories?.relationships?.[keyFor(a, b)];
    if (!relation) continue;
    const saga = relation.saga;
    if (!ready(state, a, b, relation, saga, now)) continue;
    const style = saga?.style || pairSagaStyle(a, b), index = saga?.beats.length || 0;
    const definition = PAIR_SAGAS[style], chapter = definition.chapters[index];
    const feud = state.feudArcs?.[keyFor(a, b)];
    const copy = index === 0 && style === 'feud' && feud?.truce && !feud.level
      ? definition.openingAfterTruce : chapter.text;
    const text = copy.replaceAll('{a}', a.name).replaceAll('{b}', b.name);
    relation.saga ||= { style, beats: [] };
    relation.saga.beats.push({ at: now, text });
    return { title: chapter.title, text, cast: [a.id, b.id], style, chapter: index + 1 };
  }
  return null;
}
