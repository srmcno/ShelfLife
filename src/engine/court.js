import {
  COURT_CASES, COURT_CAST, JURY_EXTRAS, STAND_INS, QUESTIONS_PER_EPISODE, RULINGS, HAPPENINGS, RANDOM_HAPPENINGS,
  OPENERS, ALL_RISE, JUDGE_ENTRANCES, PLAINTIFF_CUE, DEFENDANT_CUE, ADS, BREAK_IN, BREAK_OUT,
  JURY_AGREE, JURY_DISAGREE, JURY_ALL_AGREE, JURY_ALL_DISAGREE, AUDIENCE_REACTIONS, HALLWAY_IN, HALLWAY_ASKS
} from '../content/court.js';
import { courtroomState, SUMMONS_REMEMBERED, RECENT_KEPT, SEATS_KEPT, OWED_KEPT } from '../court-state.js';
import { grantBonusTrust, petById, localDayKey, dayKeyOffset } from '../state.js';
import { payGameSouls, addSouls, deed } from './mayhem.js';
import { dayNumber } from './daily.js';
import { recordGameLife, recordScene } from './life.js';
import { recordEscapadeEvent } from '../escapade-state.js';
import { fileGrudge } from './achievements.js';
import { petsFeud, frictionBetween } from './behavior.js';
import { twistsFor } from '../content/court-twists.js';
import { BONUS_QUESTIONS, RECEIPT_TAKES } from '../content/court-bonus.js';
import {
  BASE, effectiveCase, pickTwist, docketTwist, twistById, witnessesOf, witnessesAnywhere, versionRecord, versionView, versionTitle
} from './court-twists.js';
import { startNotes, addNote } from './court-notes.js';
import { seatOf, partyRoles, exaggerated, questionSource, showmanBonus, startingRatings, voteJury } from './court-traits.js';
import { careerStars, rankIndexFor, benchPromotion } from './court-career.js';

/* Shelf Court as a pure state machine. The UI owns an `episode` and feeds it
   choices; every call returns the lines to play next and nudges two meters:
   ratings (the audience) and respect (the jury). Nothing here touches the
   DOM, so a whole episode can be played in a test. */

export const COURT_BY_ID = Object.fromEntries(COURT_CASES.map(c => [c.id, c]));
export const JURY_SEATS = 6;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pick = (list, rnd) => list[Math.floor(rnd() * list.length) % list.length];
// A beat of script can come in several takes, written alt(take, take); each
// episode plays one, so a rerun of a case does not replay word for word.
export const lineSets = v => (v && Array.isArray(v.alt) ? v.alt : [v || []]);
const take = (v, rnd) => pick(lineSets(v), rnd);
const oneOf = (v, rnd) => (Array.isArray(v) ? pick(v, rnd) : v);
// Neighbours who give evidence in a case never sit on its jury or stand in.
export const caseWitnesses = k => witnessesOf(k);
// A clue nobody has checked earns the jury's respect only once somebody has;
// until then it is only something the audience heard.
export const DELTA = { clue: { respect: 6, ratings: 1 }, shaky: { ratings: 1 }, sass: { ratings: 8, respect: -2 }, plain: { ratings: 3 }, gavel: { respect: 8, ratings: -2 }, let: { ratings: 10, respect: -6 } };
const BONUS_BY_ID = Object.fromEntries(BONUS_QUESTIONS.map(b => [b.id, b]));
export const BONUS_CHANCE = 0.65;
export const RECENT_AVOID = 6;       // a case is not offered again within this many episodes
export const shuffled = (list, rnd) => {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

export function nudge(ep, change = {}) {
  ep.ratings = clamp(ep.ratings + (change.ratings || 0), 0, 100);
  ep.respect = clamp(ep.respect + (change.respect || 0), 0, 100);
}
const person = pet => ({ kind: 'pet', id: pet.id, name: pet.name });
const extra = id => ({ kind: 'npc', id, name: COURT_CAST[id].name, art: COURT_CAST[id].art });
// The case as this episode plays it: the version drawn, with the bonus question
// swapped in. Built once per episode.
const PLAYED = new WeakMap();
export function episodeCase(ep) {
  let k = PLAYED.get(ep);
  if (!k) {
    k = effectiveCase(COURT_BY_ID[ep.caseId], twistById(ep.caseId, ep.twist));
    const swap = ep.plan && ep.plan.bonus, b = swap && BONUS_BY_ID[swap.id];
    if (b) k = { ...k, questions: k.questions.map((q, i) => (i === swap.index ? { ask: b.ask, lines: b.lines, sass: !!b.sass, bonus: true } : q)) };
    PLAYED.set(ep, k);
  }
  return k;
}
export const questionOrder = ep => (ep.plan && Array.isArray(ep.plan.order) ? ep.plan.order : [0, 1, 2, 3, 4, 5]);
// Which telling of the case this is: the original is number 1.
export function episodeVersion(ep) {
  const keys = [BASE, ...twistsFor(ep.caseId).map(t => t.id)], key = ep.twist || BASE;
  return { key, number: Math.max(1, keys.indexOf(key) + 1), of: keys.length, title: versionTitle(ep.caseId, key) };
}

// Replace {p}, {d} and {j} with the people in this episode.
export function fill(ep, text, x = null) {
  return String(text || '')
    .replace(/\{p\}/g, ep.p.name).replace(/\{d\}/g, ep.d.name)
    .replace(/\{j\}/g, ep.juror?.name || 'A juror').replace(/\{x\}/g, x ? ep[x].name : ep.p.name);
}
function lines(ep, list, x = null) {
  return (list || []).map(([s, t, who]) => ({ s: s === 'x' ? x || 'p' : s, t: fill(ep, t, x), who: who || null }));
}
export { lines as scriptLines, pick as pickOf };

export function courtCases(state) {
  const c = courtroomState(state);
  return COURT_CASES.map((k, i) => ({ id: k.id, number: i + 1, title: k.title, claim: k.claim, asking: k.asking, stars: c.best[k.id] || 0, aired: k.id in c.best, versions: versionView(c, k.id) }));
}
// Today's docket: one case a day that pays a small bonus for airing it. The
// case is a pure function of the date, so it needs no server. The stride is the
// smallest number of at least five that shares no factor with the case count,
// which visits every case before repeating and avoids running in book order.
export const DOCKET_SOULS = 20;
export const DOCKET_STREAK_SOULS = 5;
export const DOCKET_STREAK_CAP = 4;
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
export function docketCaseId(dayKey) {
  const n = dayNumber(dayKey), count = COURT_CASES.length;
  if (n === null || !count) return '';
  let stride = 5;
  while (gcd(stride, count) !== 1) stride++;
  return COURT_CASES[(((n * stride) % count) + count) % count].id;
}
export function docketToday(state, now = Date.now()) {
  const c = courtroomState(state), day = localDayKey(now);
  const streak = c.docketLastDay === day || c.docketLastDay === dayKeyOffset(now, -1) ? c.docketStreak : 0;
  return { day, caseId: docketCaseId(day), done: c.docketDay === day, streak };
}

// Unaired cases first. After that, the case seen longest ago, and never one
// from the last few episodes: the choice is made among the oldest third of what
// is left, so the order is not a treadmill either.
export function nextCaseId(state, rnd = Math.random, not = '') {
  const c = courtroomState(state);
  const fresh = COURT_CASES.filter(k => !(k.id in c.best) && k.id !== not);
  if (fresh.length) return pick(fresh, rnd).id;
  const recent = c.last && !c.recent.includes(c.last) ? [c.last, ...c.recent] : c.recent;
  const lately = new Set(recent.slice(-RECENT_AVOID));
  let pool = COURT_CASES.filter(k => k.id !== not && !lately.has(k.id));
  if (!pool.length) pool = COURT_CASES.filter(k => k.id !== not && k.id !== c.last);
  if (!pool.length) pool = COURT_CASES.slice();
  const seenAt = id => recent.lastIndexOf(id);   // -1: not among the recent, so the oldest
  pool = shuffled(pool, rnd).sort((a, b) => seenAt(a.id) - seenAt(b.id));
  return pick(pool.slice(0, Math.max(3, Math.ceil(pool.length / 3))), rnd).id;
}

// Who sits at the podiums next: the residents who have been there least
// recently, never-seated ones first. A plaintiff can be named (the resident
// the player picked in the Playroom); the defendant is then whoever else has
// waited longest.
export function rotateCast(state, rnd = Math.random, { plaintiffId = '' } = {}) {
  const pets = state.pets || [];
  if (!pets.length) return { plaintiffId: '', defendantId: '' };
  const c = courtroomState(state);
  const seat = pet => (Object.hasOwn(c.seats, pet.id) ? c.seats[pet.id] : -1);
  const order = shuffled(pets, rnd).sort((a, b) => seat(a) - seat(b));
  const plaintiff = pets.find(p => p.id === plaintiffId) || order[0];
  const defendant = order.find(p => p.id !== plaintiff.id) || null;
  return { plaintiffId: plaintiff.id, defendantId: defendant ? defendant.id : '' };
}

// Cast the episode. The chosen resident sues; another resident is sued (or,
// in a household of one, a neighbour stands in). Everyone else is the jury.
// The neighbour who stands in when a household has no second resident. The
// same salt always names the same neighbour, so the lobby can promise one and
// the episode can deliver it. It is never a witness in any telling of the case.
export function standInFor(caseId, salt = 0) {
  const witnesses = witnessesAnywhere(COURT_BY_ID[caseId]);
  const eligible = STAND_INS.filter(id => !witnesses.has(id));
  return eligible[Math.abs(Math.floor(salt)) % eligible.length];
}

/* Which telling of the case to air. `requested` is a twist id, 'base' for the
   original, or nothing for the game to decide: today's docket has a fixed
   version (so friends compare the same puzzle), anything else is drawn with
   the unseen versions favoured. A summons is drawn on the hearer's side. */
function chooseVersion(state, caseId, requested, guest, now, rnd) {
  if (!twistsFor(caseId).length || requested === BASE) return { twist: null, docket: false };
  if (requested && twistById(caseId, requested)) return { twist: requested, docket: false };
  if (!guest) {
    const today = docketToday(state, now);
    if (caseId === today.caseId && !today.done) return { twist: docketTwist(today.day, caseId), docket: true };
  }
  return { twist: pickTwist(caseId, rnd, '', Object.keys(versionRecord(courtroomState(state), caseId))), docket: false };
}

/* How the episode is laid out: where the ad break falls (before question 2 or
   3), whether a second random scene breaks out, the order the six questions
   are offered in, and whether a bonus question takes the place of one plain
   question. A pure function of the dice, so a test can play any layout. */
export function episodePlan(k, rnd) {
  const breakBefore = rnd() < 0.5 ? 1 : 2;
  const extraScene = rnd() < 0.5;
  const order = shuffled(k.questions.map((_, i) => i), rnd);
  let bonus = null;
  if (rnd() < BONUS_CHANCE) {
    const plain = k.questions.map((q, i) => (!q.clue && !q.herring && !q.sass && !q.happen ? i : -1)).filter(i => i >= 0);
    if (plain.length) bonus = { index: pick(plain, rnd), id: pick(BONUS_QUESTIONS, rnd).id };
  }
  return { breakBefore, extraAfter: extraScene ? (breakBefore === 2 ? 0 : 1) : -1, order, bonus };
}

// The residents' own lives, as the podium and the jury box need them. A juror
// has a quarrel with a party when their traits feud or they have recently fallen out.
function castSeats(state, parties, jury, now) {
  const quarrel = (juror, side) => !!(juror && parties[side] && (petsFeud(juror, parties[side]) || frictionBetween(state, juror.id, parties[side].id, now) >= 0.5));
  return {
    p: seatOf(parties.p), d: seatOf(parties.d),
    jury: jury.map(j => {
      const pet = j.kind === 'pet' ? petById(state, j.id) : null;
      return seatOf(pet, pet ? ['p', 'd'].filter(side => quarrel(pet, side)) : []);
    })
  };
}

// The rest of casting, shared by an episode of ours and a friend's summons:
// the version drawn, the neighbours who fill the jury box, the cast's traits
// and the layout.
function seatEpisode(state, base, { p, d, jury, parties, requested, guest, now }, rnd) {
  const version = chooseVersion(state, base.id, requested, !!guest, now, rnd);
  const k = effectiveCase(base, twistById(base.id, version.twist));
  const witnesses = witnessesOf(k);
  for (const id of JURY_EXTRAS) {
    if (jury.length >= JURY_SEATS) break;
    if (!witnesses.has(id) && id !== d.id && id !== p.id) jury.push(extra(id));
  }
  const ep = {
    caseId: base.id, twist: version.twist, docket: version.docket, recap: base.id in courtroomState(state).best,
    p, d, jury, juror: null, ratings: 50, respect: 50, asked: [], happened: [], hadBreak: false, ruling: null, done: false, settled: false
  };
  if (guest) ep.guest = guest.side;
  startNotes(ep);
  ep.cast = castSeats(state, parties, jury, now);
  ep.ratings = startingRatings(ep);
  ep.juror = pick(jury, rnd);
  ep.plan = episodePlan(k, rnd);
  return ep;
}

export function castEpisode(state, { caseId, plaintiffId, defendantId, standInSalt, guest, twist, now } = {}, rnd = Math.random) {
  const k = COURT_BY_ID[caseId] || COURT_BY_ID[nextCaseId(state, rnd)];
  const when = Number.isFinite(now) ? now : Date.now();
  if (guest) return castGuestEpisode(state, k, guest, guest.side === 'd' ? plaintiffId : defendantId, rnd, twist, when);
  const pets = state.pets || [];
  const plaintiff = petById(state, plaintiffId) || pets[0];
  if (!plaintiff) return null;
  const others = pets.filter(p => p.id !== plaintiff.id);
  const defendantPet = petById(state, defendantId) && defendantId !== plaintiff.id ? petById(state, defendantId) : others.length ? pick(others, rnd) : null;
  const anywhere = witnessesAnywhere(k);
  const d = defendantPet ? person(defendantPet) : extra(Number.isFinite(standInSalt) ? standInFor(k.id, standInSalt) : pick(STAND_INS.filter(id => !anywhere.has(id)), rnd));
  const jury = pets.filter(p => p.id !== plaintiff.id && p.id !== d.id).slice(0, JURY_SEATS).map(person);
  return seatEpisode(state, k, { p: person(plaintiff), d, jury, parties: { p: plaintiff, d: defendantPet }, requested: twist, guest: null, now: when }, rnd);
}

// A summons from a friend: their resident (guest.pet, from cloud/social.js
// guestPet) takes one side and one of ours the other. The guest is seated as
// kind 'guest', so nothing below mistakes it for a resident of this shelf.
function castGuestEpisode(state, k, guest, residentId, rnd, twist, now) {
  const home = petById(state, residentId);
  if (!home || !guest.pet || typeof guest.pet.name !== 'string' || typeof guest.pet.id !== 'string') return null;
  const side = guest.side === 'd' ? 'd' : 'p';
  const visitor = { kind: 'guest', id: guest.pet.id, name: guest.pet.name };
  const jury = (state.pets || []).filter(p => p.id !== home.id).slice(0, JURY_SEATS).map(person);
  const ours = person(home);
  return seatEpisode(state, k, {
    p: side === 'p' ? visitor : ours, d: side === 'p' ? ours : visitor, jury,
    parties: side === 'p' ? { p: guest.pet, d: home } : { p: home, d: guest.pet }, requested: twist, guest: { side }, now
  }, rnd);
}

export function episodeOpening(ep, rnd = Math.random) {
  const k = episodeCase(ep);
  return [
    { s: 'announcer', t: pick(OPENERS, rnd) },
    { s: 'bailiff', t: pick(ALL_RISE, rnd) },
    { s: 'judge', t: pick(JUDGE_ENTRANCES, rnd) },
    { s: 'announcer', t: fill(ep, k.claim) + ' Asking: ' + fill(ep, k.asking) + '.' },
    { s: 'judge', t: fill(ep, pick(PLAINTIFF_CUE, rnd)) },
    ...lines(ep, take(k.plaintiff, rnd)),
    { s: 'judge', t: fill(ep, pick(DEFENDANT_CUE, rnd)) },
    ...lines(ep, take(k.defendant, rnd)),
    // A twist gives itself away here: a note, a noise or a new witness. These
    // lines are marked so a replay can skip the statements and never the hint.
    ...(k.turn ? lines(ep, take(k.turn, rnd)).map(line => ({ ...line, turn: true })) : [])
  ];
}

// A party who keeps receipts hands over a free clue before the questions begin.
// The question it came from is spent: you keep the note and lose the question.
export function episodeReceipts(ep, rnd = Math.random) {
  const k = episodeCase(ep), out = [];
  for (const side of partyRoles(ep).receipts) {
    const index = questionOrder(ep).find(i => k.questions[i].clue && !ep.asked.includes(i) && !ep.spent.includes(i));
    if (index === undefined) break;
    ep.spent.push(index);
    const note = addNote(ep, { text: fill(ep, k.questions[index].clue), kind: 'clue', index });
    nudge(ep, DELTA.clue);
    out.push({ side, lines: lines(ep, pick(RECEIPT_TAKES, rnd), side), clue: note.text, note });
  }
  return out;
}

export const questionsLeft = ep => QUESTIONS_PER_EPISODE - ep.asked.length;
// The six questions in the order this episode offers them. One spent on a free
// clue (receipts, or an Objection) reads as asked but does not use up a turn.
export function episodeQuestions(ep) {
  const k = episodeCase(ep);
  return questionOrder(ep).map(index => {
    const q = k.questions[index];
    return { index, text: fill(ep, q.ask), sass: !!q.sass, bonus: !!q.bonus, asked: ep.asked.includes(index) || ep.spent.includes(index) };
  });
}

// Ask one question. Returns its lines, any note for the case notes (a clue, or
// a lead that points the wrong way), the perks it set off, and a scene if the
// question sets one off.
export function episodeAsk(ep, index, rnd = Math.random) {
  const q = episodeCase(ep).questions[index];
  if (!q || ep.done || ep.asked.includes(index) || ep.spent.includes(index) || questionsLeft(ep) <= 0) return null;
  ep.asked.push(index);
  ep.juror = pick(ep.jury, rnd);
  const perks = [];
  let note = null;
  if (q.clue) {
    const shaky = exaggerated(ep, q), side = questionSource(q);
    note = addNote(ep, { text: fill(ep, q.clue), kind: 'clue', shaky, from: side, index });
    if (shaky) perks.push({ id: 'exaggerates', side, text: ep[side].name + ' exaggerates. That note is unconfirmed.' });
  } else if (q.herring) note = addNote(ep, { text: fill(ep, q.herring), kind: 'lead', shaky: true, index });
  nudge(ep, DELTA[note ? (note.shaky ? 'shaky' : 'clue') : q.sass ? 'sass' : 'plain']);
  if (note && q.sass) nudge(ep, { ratings: DELTA.sass.ratings });
  if (q.sass && showmanBonus(ep)) {
    nudge(ep, { ratings: DELTA.sass.ratings });
    const side = partyRoles(ep).showman[0];
    perks.push({ id: 'showman', side, text: ep[side].name + ' plays to the room. The zinger lands twice.' });
  }
  const out = { lines: lines(ep, take(q.lines, rnd)), clue: note ? note.text : null, note, perks, happening: null };
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
  // A scene plays one take start to finish, so the response fits the setup.
  const t = h.takes ? Math.floor(rnd() * h.takes.length) % h.takes.length : null;
  const intro = lines(ep, take((t === null ? h : h.takes[t]).intro, rnd), x);
  if (h.rants) intro.push({ s: x, t: pick(h.rants, rnd), who: null });
  if (!h.choice) nudge(ep, { ratings: h.ratings || 0 });
  return { id, anim: h.anim, choice: !!h.choice, x, juror: ep.juror, take: t, lines: intro };
}
export function resolveHappening(ep, happening, choice, rnd = Math.random) {
  const h = HAPPENINGS[happening?.id];
  if (!h?.choice) return [];
  const way = choice === 'gavel' ? 'gavel' : 'let';
  nudge(ep, DELTA[way]);
  ep.juror = happening.juror || ep.juror;
  const script = h.takes ? h.takes[happening.take] || h.takes[0] : h;
  return lines(ep, take(script[way], rnd), happening.x);
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
// in the hallway: the announcer cuts to it, then a reporter asks each loser a
// question (reporter lines carry the side they are asking in `who`). Every
// juror rolls once against the base chance, as ever; a juror with a role in
// engine/court-traits.js may then lean, decide or doze.
export function episodeRule(ep, ruling, rnd = Math.random) {
  if (ep.done || !RULINGS.includes(ruling)) return null;
  const k = episodeCase(ep);
  ep.ruling = ruling; ep.done = true;
  const correct = ruling === k.truth;
  nudge(ep, { ratings: correct ? 10 : -4 });
  const chance = correct ? 0.5 + ep.respect / 200 : 0.12 + ep.respect / 500;
  const { votes, notes, absent } = voteJury(ep, ruling, chance, rnd);
  const agree = votes.filter(Boolean).length;
  if (agree >= 5) nudge(ep, { ratings: 5 });
  const stars = (correct ? 1 : 0) + (ep.ratings >= 70 ? 1 : 0) + (agree >= 5 ? 1 : 0);
  ep.agree = agree; ep.stars = stars;
  const voice = (list, agrees) => {
    const who = ep.jury.filter((_, i) => votes[i] === agrees && !absent.includes(i));
    if (!who.length) return null;
    const j = pick(who, rnd);
    return { s: 'jury', t: pick(list, rnd).replace(/\{j\}/g, j.name), who: null };
  };
  const juryLines = [voice(JURY_AGREE, true), voice(JURY_DISAGREE, false)].filter(Boolean);
  for (const note of notes.slice(0, 2)) juryLines.push({ s: 'jury', t: note.text, who: null });
  const slept = absent.length ? ' ' + (absent.length === 1 ? 'One juror' : absent.length + ' jurors') + ' slept through it.' : '';
  juryLines.push({ s: 'jury', t: agree === ep.jury.length ? pick(JURY_ALL_AGREE, rnd) : agree === 0 ? pick(JURY_ALL_DISAGREE, rnd) : 'The jury agrees, ' + agree + ' to ' + (ep.jury.length - agree) + '.' + slept, who: null });
  const losers = ruling === 'plaintiff' ? ['d'] : ruling === 'defendant' ? ['p'] : ['p', 'd'];
  const hallway = [{ s: 'announcer', t: pick(HALLWAY_IN, rnd) }, ...losers.map(side => ({ s: side, t: fill(ep, oneOf(k.hallway[side], rnd)), who: null }))];
  const out = {
    correct, truth: k.truth, votes, absent, voteNotes: notes, agree, stars, losers, winner: losers.length === 1 ? (losers[0] === 'p' ? 'd' : 'p') : null,
    ruling: lines(ep, take(k.rulings[ruling], rnd)),
    jury: juryLines,
    audience: { s: 'audience', t: pick(AUDIENCE_REACTIONS[Math.min(3, Math.floor(ep.ratings / 25))], rnd), who: null },
    hallway
  };
  // The reporter's question before each answer is drawn last, so everything
  // above rolls out exactly as it would without the reporter.
  const first = Math.floor(rnd() * HALLWAY_ASKS.length);
  out.hallway = [hallway[0], ...losers.flatMap((side, i) => [
    { s: 'reporter', t: fill(ep, HALLWAY_ASKS[(first + i * 5) % HALLWAY_ASKS.length], side), who: side },
    hallway[i + 1]
  ])];
  return out;
}

// Settle the episode once: souls, trust for whoever you rightly sided with,
// a grudge for whoever you wrongly ruled against, a scene for the household's
// memory, and the court's own records: the version seen, the recent list, who
// sat where, the lifetime stars and any promotion on the bench.
export function courtFinish(state, ep, now = Date.now()) {
  if (!ep?.done || ep.settled) return null;
  if (ep.guest) return guestFinish(state, ep, now);
  ep.settled = true;
  const c = courtroomState(state), k = episodeCase(ep);
  const correct = ep.ruling === k.truth;
  const agree = ep.agree ?? 0;
  const stars = ep.stars ?? ((correct ? 1 : 0) + (ep.ratings >= 70 ? 1 : 0));
  c.episodes++; c.last = k.id;
  if (correct) c.justice++;
  const firstAir = !(k.id in c.best);
  const carried = careerStars(c);   // read before the best stars move: older saves are credited with them
  const version = recordVersion(c, k.id, ep.twist || BASE, stars);
  c.best[k.id] = Math.max(c.best[k.id] || 0, stars);
  c.recent = [...c.recent.filter(id => id !== k.id), k.id].slice(-RECENT_KEPT);
  for (const side of ['p', 'd']) if (ep[side].kind === 'pet') c.seats[ep[side].id] = c.episodes;
  const kept = Object.entries(c.seats).sort((a, b) => b[1] - a[1]).slice(0, SEATS_KEPT);
  c.seats = Object.fromEntries(kept);
  if (stars >= 3) { c.flawless++; c.flawlessBest = Math.max(c.flawlessBest, c.flawless); } else c.flawless = 0;
  c.stars = carried + stars;
  const souls = payGameSouls(state, 10 + stars * 12 + Math.floor(ep.ratings / 10) + (firstAir ? 10 : 0), now);
  deed(state, 'game', 1, now);
  // A promotion on the bench pays outside the purse, as the docket does.
  const promotion = benchPromotion(c.rank, rankIndexFor(c.stars));
  if (promotion) { addSouls(state, promotion.souls); c.rank = promotion.to; }
  // Airing today's docket case pays a flat bonus once a day, outside the purse.
  let docket = null;
  const today = docketToday(state, now);
  if (k.id === today.caseId && !today.done) {
    c.docketDay = today.day;
    c.docketStreak = today.streak + 1;
    c.docketLastDay = today.day;
    const bonus = DOCKET_SOULS + DOCKET_STREAK_SOULS * Math.min(c.docketStreak - 1, DOCKET_STREAK_CAP);
    addSouls(state, bonus);
    docket = { bonus, streak: c.docketStreak };
  }
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
  return { correct, stars, agree, ratings: ep.ratings, souls, docket, trust, grudge, firstAir, truth: k.truth, aired: Object.keys(c.best).length, total: COURT_CASES.length,
    version, promotion, career: { stars: c.stars, rank: rankIndexFor(c.stars) }, flawless: c.flawless };
}

// The record of one telling: its title, whether it was new, and how many are seen.
// A save from before versions were tracked has the original on record already,
// so it is written down before anything else is.
function recordVersion(c, caseId, key, stars) {
  if (!Object.hasOwn(c.versions, caseId)) c.versions[caseId] = caseId in c.best ? { [BASE]: c.best[caseId] } : {};
  const rec = c.versions[caseId], isNew = !Object.hasOwn(rec, key);
  rec[key] = Math.max(rec[key] || 0, stars);
  const view = versionView(c, caseId);
  return { key, title: versionTitle(caseId, key), isNew, number: Math.max(1, view.versions.findIndex(v => v.key === key) + 1), of: view.of, seen: view.seen };
}

// A friend's summons pays the usual souls and nothing else: it is their case,
// so the courtroom's records, the docket, trust, grudges and the household's
// memory are all left as they were. The summons reward is paid separately. The
// one thing it does write down is the telling you sat through, without stars,
// so a version heard from a friend is not offered to you as new.
function guestFinish(state, ep, now) {
  ep.settled = true;
  const k = episodeCase(ep), correct = ep.ruling === k.truth, c = courtroomState(state);
  const stars = ep.stars ?? ((correct ? 1 : 0) + (ep.ratings >= 70 ? 1 : 0));
  const souls = payGameSouls(state, 10 + stars * 12 + Math.floor(ep.ratings / 10), now);
  deed(state, 'game', 1, now);
  if (twistsFor(k.id).length) {
    if (!Object.hasOwn(c.versions, k.id)) c.versions[k.id] = k.id in c.best ? { [BASE]: c.best[k.id] } : {};
    if (!Object.hasOwn(c.versions[k.id], ep.twist || BASE)) c.versions[k.id][ep.twist || BASE] = 0;
  }
  return { correct, stars, agree: ep.agree ?? 0, ratings: ep.ratings, souls, docket: null, trust: null, grudge: null, firstAir: false,
    truth: k.truth, aired: Object.keys(c.best).length, total: COURT_CASES.length, guest: true, version: null, promotion: null };
}

// Summonses between friends pay a little on each side: the judge for hearing
// one, the sender for learning the verdict. Once per summons, and at most
// SUMMONS_DAILY_CAP of each kind per local day.
export const SUMMONS_SOULS = 15;
export const VERDICT_SOULS = 10;
export const SUMMONS_DAILY_CAP = 3;
export function summonsReward(state, id, kind = 'heard', now = Date.now()) {
  const c = courtroomState(state), day = localDayKey(now);
  if (typeof id !== 'string' || !id || c.summonsPaid.includes(id)) return 0;
  if (c.summonsDay !== day) { c.summonsDay = day; c.summonsHeard = 0; c.summonsVerdicts = 0; }
  const key = kind === 'verdict' ? 'summonsVerdicts' : 'summonsHeard';
  // A day's three are spoken for. The reward is not paid and not burned: it is
  // written down as owed and paid on the first day with room (payOwedSummons).
  if (c[key] >= SUMMONS_DAILY_CAP) {
    if (!c.summonsOwed.some(x => x.id === id)) c.summonsOwed = [...c.summonsOwed, { id, kind: kind === 'verdict' ? 'verdict' : 'heard' }].slice(-OWED_KEPT);
    return 0;
  }
  c.summonsOwed = c.summonsOwed.filter(x => x.id !== id);
  c.summonsPaid = [...c.summonsPaid, id].slice(-SUMMONS_REMEMBERED);
  c[key]++;
  const souls = kind === 'verdict' ? VERDICT_SOULS : SUMMONS_SOULS;
  addSouls(state, souls);
  return souls;
}
// Rewards that were over the daily cap, paid now if today has room.
export function payOwedSummons(state, now = Date.now()) {
  const c = courtroomState(state);
  let souls = 0, count = 0;
  for (const item of [...c.summonsOwed]) {
    const paid = summonsReward(state, item.id, item.kind, now);
    if (paid) { souls += paid; count++; }
  }
  return { souls, count };
}
export const summonsOwed = (state, id) => courtroomState(state).summonsOwed.some(x => x.id === id);
