import {
  COURT_CASES, COURT_CAST, JURY_EXTRAS, STAND_INS, QUESTIONS_PER_EPISODE, RULINGS, HAPPENINGS, RANDOM_HAPPENINGS,
  OPENERS, ALL_RISE, JUDGE_ENTRANCES, PLAINTIFF_CUE, DEFENDANT_CUE, ADS, BREAK_IN, BREAK_OUT,
  JURY_AGREE, JURY_DISAGREE, AUDIENCE_REACTIONS, HALLWAY_IN
} from '../content/court.js';
import { courtroomState } from '../court-state.js';
import { grantBonusTrust, petById } from '../state.js';
import { payGameSouls, deed } from './mayhem.js';
import { recordGameLife, recordScene } from './life.js';
import { recordEscapadeEvent } from '../escapade-state.js';
import { fileGrudge } from './achievements.js';

/* Shelf Court as a pure state machine. The UI owns an `episode` and feeds it
   choices; every call returns the lines to play next and nudges two meters:
   ratings (the audience) and respect (the jury). Nothing here touches the
   DOM, so a whole episode can be played in a test. */

export const COURT_BY_ID = Object.fromEntries(COURT_CASES.map(c => [c.id, c]));
export const JURY_SEATS = 6;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pick = (list, rnd) => list[Math.floor(rnd() * list.length) % list.length];
const DELTA = { clue: { respect: 6, ratings: 1 }, sass: { ratings: 8, respect: -2 }, plain: { ratings: 3 }, gavel: { respect: 8, ratings: -2 }, let: { ratings: 10, respect: -6 } };

function nudge(ep, change = {}) {
  ep.ratings = clamp(ep.ratings + (change.ratings || 0), 0, 100);
  ep.respect = clamp(ep.respect + (change.respect || 0), 0, 100);
}
const person = pet => ({ kind: 'pet', id: pet.id, name: pet.name });
const extra = id => ({ kind: 'npc', id, name: COURT_CAST[id].name, art: COURT_CAST[id].art });
export const episodeCase = ep => COURT_BY_ID[ep.caseId];

// Replace {p}, {d} and {j} with the people in this episode.
export function fill(ep, text, x = null) {
  return String(text || '')
    .replace(/\{p\}/g, ep.p.name).replace(/\{d\}/g, ep.d.name)
    .replace(/\{j\}/g, ep.juror?.name || 'A juror').replace(/\{x\}/g, x ? ep[x].name : ep.p.name);
}
function lines(ep, list, x = null) {
  return (list || []).map(([s, t, who]) => ({ s: s === 'x' ? x || 'p' : s, t: fill(ep, t, x), who: who || null }));
}

export function courtCases(state) {
  const c = courtroomState(state);
  return COURT_CASES.map((k, i) => ({ id: k.id, number: i + 1, title: k.title, claim: k.claim, asking: k.asking, stars: c.best[k.id] || 0, aired: k.id in c.best }));
}
// Unaired cases first, then the least recently seen.
export function nextCaseId(state, rnd = Math.random, not = '') {
  const c = courtroomState(state);
  const fresh = COURT_CASES.filter(k => !(k.id in c.best) && k.id !== not);
  const pool = fresh.length ? fresh : COURT_CASES.filter(k => k.id !== not && k.id !== c.last);
  return pick(pool.length ? pool : COURT_CASES, rnd).id;
}

// Cast the episode. The chosen resident sues; another resident is sued (or,
// in a household of one, a neighbour stands in). Everyone else is the jury.
export function castEpisode(state, { caseId, plaintiffId, defendantId } = {}, rnd = Math.random) {
  const k = COURT_BY_ID[caseId] || COURT_BY_ID[nextCaseId(state, rnd)];
  const pets = state.pets || [];
  const plaintiff = petById(state, plaintiffId) || pets[0];
  if (!plaintiff) return null;
  const others = pets.filter(p => p.id !== plaintiff.id);
  const defendantPet = petById(state, defendantId) && defendantId !== plaintiff.id ? petById(state, defendantId) : others.length ? pick(others, rnd) : null;
  const witnesses = new Set(k.questions.flatMap(q => q.lines.filter(l => l[0] === 'npc').map(l => l[2])));
  const d = defendantPet ? person(defendantPet) : extra(pick(STAND_INS.filter(id => !witnesses.has(id)), rnd));
  const jury = pets.filter(p => p.id !== plaintiff.id && p.id !== d.id).slice(0, JURY_SEATS).map(person);
  for (const id of JURY_EXTRAS) {
    if (jury.length >= JURY_SEATS) break;
    if (!witnesses.has(id) && id !== d.id) jury.push(extra(id));
  }
  const ep = {
    caseId: k.id, p: person(plaintiff), d, jury, juror: null,
    ratings: 50, respect: 50, asked: [], clues: [], happened: [], hadBreak: false,
    ruling: null, done: false, settled: false
  };
  ep.juror = pick(jury, rnd);
  return ep;
}

export function episodeOpening(ep, rnd = Math.random) {
  const k = episodeCase(ep);
  return [
    { s: 'announcer', t: pick(OPENERS, rnd) },
    { s: 'bailiff', t: pick(ALL_RISE, rnd) },
    { s: 'judge', t: pick(JUDGE_ENTRANCES, rnd) },
    { s: 'announcer', t: fill(ep, k.claim) + ' Asking: ' + fill(ep, k.asking) + '.' },
    { s: 'judge', t: fill(ep, pick(PLAINTIFF_CUE, rnd)) },
    ...lines(ep, k.plaintiff),
    { s: 'judge', t: fill(ep, pick(DEFENDANT_CUE, rnd)) },
    ...lines(ep, k.defendant)
  ];
}

export const questionsLeft = ep => QUESTIONS_PER_EPISODE - ep.asked.length;
export function episodeQuestions(ep) {
  return episodeCase(ep).questions.map((q, index) => ({ index, text: fill(ep, q.ask), sass: !!q.sass, asked: ep.asked.includes(index) }));
}

// Ask one question. Returns its lines, any clue for the notes, and a scene
// if the question sets one off.
export function episodeAsk(ep, index, rnd = Math.random) {
  const q = episodeCase(ep).questions[index];
  if (!q || ep.done || ep.asked.includes(index) || questionsLeft(ep) <= 0) return null;
  ep.asked.push(index);
  ep.juror = pick(ep.jury, rnd);
  const clue = q.clue ? fill(ep, q.clue) : null;
  if (clue) ep.clues.push(clue);
  nudge(ep, DELTA[clue ? 'clue' : q.sass ? 'sass' : 'plain']);
  if (clue && q.sass) nudge(ep, { ratings: DELTA.sass.ratings });
  const out = { lines: lines(ep, q.lines), clue, happening: null };
  if (q.happen && !ep.happened.includes(q.happen)) out.happening = startHappening(ep, q.happen, rnd, q.party);
  return out;
}

// A scene breaks out. Scenes with a choice wait for resolveHappening.
export function startHappening(ep, id, rnd = Math.random, party = null) {
  const h = HAPPENINGS[id];
  if (!h) return null;
  ep.happened.push(id);
  ep.juror = pick(ep.jury, rnd);
  const x = party || (rnd() < 0.5 ? 'p' : 'd');
  const intro = lines(ep, h.intro, x);
  if (h.rants) intro.push({ s: x, t: pick(h.rants, rnd), who: null });
  if (!h.choice) nudge(ep, { ratings: h.ratings || 0 });
  return { id, anim: h.anim, choice: !!h.choice, x, juror: ep.juror, lines: intro };
}
export function resolveHappening(ep, happening, choice) {
  const h = HAPPENINGS[happening?.id];
  if (!h?.choice) return [];
  const way = choice === 'gavel' ? 'gavel' : 'let';
  nudge(ep, DELTA[way]);
  ep.juror = happening.juror || ep.juror;
  return lines(ep, h[way], happening.x);
}
export function randomHappening(ep, rnd = Math.random) {
  const pool = RANDOM_HAPPENINGS.filter(id => !ep.happened.includes(id));
  return pool.length ? startHappening(ep, pick(pool, rnd), rnd) : null;
}

// The commercial break, halfway through questioning.
export function episodeBreak(ep, rnd = Math.random) {
  ep.hadBreak = true;
  const ad = pick(ADS, rnd);
  return { ad, into: { s: 'announcer', t: pick(BREAK_IN, rnd) }, back: { s: 'announcer', t: pick(BREAK_OUT, rnd) } };
}

// Rule. The jury votes, the audience reacts, and the loser gives an interview
// in the hallway.
export function episodeRule(ep, ruling, rnd = Math.random) {
  if (ep.done || !RULINGS.includes(ruling)) return null;
  const k = episodeCase(ep);
  ep.ruling = ruling; ep.done = true;
  const correct = ruling === k.truth;
  nudge(ep, { ratings: correct ? 10 : -4 });
  const chance = correct ? 0.5 + ep.respect / 200 : 0.12 + ep.respect / 500;
  const votes = ep.jury.map(() => rnd() < chance);
  const agree = votes.filter(Boolean).length;
  if (agree >= 5) nudge(ep, { ratings: 5 });
  const stars = (correct ? 1 : 0) + (ep.ratings >= 70 ? 1 : 0) + (agree >= 5 ? 1 : 0);
  ep.agree = agree; ep.stars = stars;
  const voice = (list, agrees) => {
    const who = ep.jury.filter((_, i) => votes[i] === agrees);
    if (!who.length) return null;
    const j = pick(who, rnd);
    return { s: 'jury', t: pick(list, rnd).replace(/\{j\}/g, j.name), who: null };
  };
  const juryLines = [voice(JURY_AGREE, true), voice(JURY_DISAGREE, false)].filter(Boolean);
  juryLines.push({ s: 'jury', t: agree === ep.jury.length ? 'The jury agrees with you. All of them. Even the one that was asleep.' : agree === 0 ? 'The jury disagrees with you. Unanimously. One of them is writing to its MP.' : 'The jury agrees, ' + agree + ' to ' + (ep.jury.length - agree) + '.', who: null });
  const losers = ruling === 'plaintiff' ? ['d'] : ruling === 'defendant' ? ['p'] : ['p', 'd'];
  const hallway = [{ s: 'announcer', t: pick(HALLWAY_IN, rnd) }, ...losers.map(side => ({ s: side, t: fill(ep, k.hallway[side]), who: null }))];
  return {
    correct, truth: k.truth, votes, agree, stars,
    ruling: lines(ep, k.rulings[ruling]),
    jury: juryLines,
    audience: { s: 'audience', t: pick(AUDIENCE_REACTIONS[Math.min(3, Math.floor(ep.ratings / 25))], rnd), who: null },
    hallway
  };
}

// Settle the episode once: souls, trust for whoever you rightly sided with,
// a grudge for whoever you wrongly ruled against, and a scene for the
// household's memory.
export function courtFinish(state, ep, now = Date.now()) {
  if (!ep?.done || ep.settled) return null;
  ep.settled = true;
  const c = courtroomState(state), k = episodeCase(ep);
  const correct = ep.ruling === k.truth;
  const agree = ep.agree ?? 0;
  const stars = ep.stars ?? ((correct ? 1 : 0) + (ep.ratings >= 70 ? 1 : 0));
  c.episodes++; c.last = k.id;
  if (correct) c.justice++;
  const firstAir = !(k.id in c.best);
  c.best[k.id] = Math.max(c.best[k.id] || 0, stars);
  const souls = payGameSouls(state, 10 + stars * 12 + Math.floor(ep.ratings / 10) + (firstAir ? 10 : 0), now);
  deed(state, 'game', 1, now);
  const pet = side => ep[side].kind === 'pet' ? petById(state, ep[side].id) : null;
  const P = pet('p'), D = pet('d');
  let trust = null, grudge = null;
  if (correct && ep.ruling !== 'both') {
    const winner = ep.ruling === 'plaintiff' ? P : D;
    if (winner && grantBonusTrust(winner, 1, now)) trust = winner.name;
  }
  if (!correct && k.truth !== 'both') {
    const wronged = k.truth === 'plaintiff' ? P : D;
    if (wronged && fileGrudge(state, wronged, 'Robbed on Shelf Court: ' + k.title, now)) grudge = wronged.name;
  }
  const residents = [P, D].filter(Boolean);
  for (const r of residents) r.courtCases = (r.courtCases || 0) + 1;
  if (P) recordGameLife(state, P, 'court', now, false);
  if (residents.length) {
    recordEscapadeEvent(state, { kind: 'play', petIds: residents.map(r => r.id), activity: 'court' }, now);
    const loser = ep.ruling === 'plaintiff' ? D : ep.ruling === 'defendant' ? P : null;
    const cast = loser ? [loser, ...residents.filter(r => r !== loser)] : residents;
    const verdict = ep.ruling === 'both' ? 'Both parties were declared idiots.' : 'Judgment went to ' + (ep.ruling === 'plaintiff' ? ep.p.name : ep.d.name) + '.';
    recordScene(state, 'court', 'Shelf Court: ' + k.title, ep.p.name + ' v. ' + ep.d.name + '. ' + verdict + (correct ? ' Justice, allegedly, was served.' : ' The jury is still talking about it.'),
      cast.map(r => r.id), now, { key: 'court', branch: loser ? 'convicted' : 'witness' });
  }
  return { correct, stars, agree, ratings: ep.ratings, souls, trust, grudge, firstAir, truth: k.truth, aired: Object.keys(c.best).length, total: COURT_CASES.length };
}
