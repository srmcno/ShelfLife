import { COURT_CAST, JURY_EXTRAS } from '../content/court.js';
import {
  REACTIONS, REVEAL_OPEN, REVEAL_TRUTH, OUTCOMES, RECORD_AHEAD_THEM, RECORD_AHEAD_YOU, RECORD_LEVEL, RECORD_NONE
} from '../content/court-joint.js';
import { COURT_BY_ID, JURY_SEATS, episodePlan, castSeats, standInFor, docketToday, pickOf, shuffled } from './court.js';
import { effectiveCase, twistById, witnessesOf, pickTwist, docketTwist, hashText } from './court-twists.js';
import { startNotes } from './court-notes.js';
import { startingRatings } from './court-traits.js';
import { visitingGuests } from './court-guests.js';
import { courtroomState, JOINT_REMEMBERED } from '../court-state.js';
import { addSouls } from './mayhem.js';
import { localDayKey, petById } from '../state.js';
import { residentSnapshot } from '../cloud/social.js';
import { readCast, MAX_CAST_CHARS } from '../cloud/hearings.js';
import { postedStars } from '../tester-state.js';

/* The Joint Bench, as pure rules. Two friends hear the same hearing: the same
   case, the same version, the same cast and the same seed, so every line the
   show draws is the same for both. The first judge's game builds the cast
   snapshot (jointCast) and both games build the episode from it
   (castJointEpisode), so neither can drift from the other. The episode is
   then played by the ordinary state machine in engine/court.js, with each beat
   of script drawn from its own stream (beatRandom): the questions a judge asks
   in a different order still play the same takes. */

export const JOINT_BENCH_SOULS = 25;   // each, for a full bench
export const JOINT_BENCH_DAILY = 3;    // full benches that pay per local day
export const SERVED = 'served';
export const INVITE = 'invite';

// A small, fast generator (mulberry32), seeded from a 32 bit integer.
export function seededStream(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const newSeed = (rnd = Math.random) => 1 + Math.floor(rnd() * 2147483646);
// One beat of the show, from its own stream: a pure function of the seed and the label.
export const beatRandom = (seed, label) => seededStream(hashText(seed + '|' + label));
// The beats the stage draws, by name. ui/court.js plays a joint episode with
// these, and the tests replay one the same way.
export const BEATS = {
  opening: 'opening', receipts: 'receipts', witnesses: 'witnesses', break: 'break', jury: 'jury', hall: 'hall',
  ask: index => 'ask:' + index, scene: round => 'scene:' + round, resolve: (id, choice) => 'rs:' + id + ':' + choice,
  objection: 'objection', press: 'press', rule: ruling => 'rule:' + ruling
};

/* Which telling a joint hearing airs. Today's docket case keeps today's fixed
   version (the same one everybody airs); anything else is drawn from the seed.
   Returns a twist id, or null for the original. */
export function jointVersion(state, caseId, seed, now = Date.now()) {
  const docket = docketToday(state, now);
  if (caseId === docket.caseId) return docketTwist(docket.day, caseId);
  return pickTwist(caseId, Math.random, 'joint:' + seed);
}

// Cases a pair can hear together: any case the inviter has aired, and today's docket.
export function invitableCases(state, now = Date.now()) {
  const c = courtroomState(state), docket = docketToday(state, now);
  const ids = new Set(Object.keys(c.best).filter(id => COURT_BY_ID[id]));
  if (COURT_BY_ID[docket.caseId]) ids.add(docket.caseId);
  return [...ids].map(id => ({ id, title: COURT_BY_ID[id].title, docket: id === docket.caseId }));
}

/* ---- the cast snapshot ----
   { v: 1, p, d, jury: [...6 at most], witnesses: [...3 at most], seats }
   A member is a neighbour { kind: 'npc', id } or a resident
   { kind: 'pet' | 'visitor', owner: 'from' | 'to' | '', from, id, name, traits, mood, bond, art }.
   `owner` says whose shelf it lives on: the first judge's ('from') or the
   second's ('to'); a visitor is a guest staying on the first judge's shelf.
   `seats` are the traits each seat brings (engine/court-traits.js), worked out
   once on the first judge's side so both juries vote by the same rules. */
const npcMember = id => ({ kind: 'npc', id });
function residentMember(pet, owner, from, image) {
  const snap = residentSnapshot(pet, { image });
  return { kind: 'pet', owner, from: from || '', ...snap, mood: pet.mood && !pet.needs ? pet.mood : snap.mood };
}
const friendMember = (resident, from, image) => residentMember({ ...resident, art: resident.art || {} }, 'to', from, image);
const visitorMember = (guest, image) => ({ ...residentMember(guest.resident, '', guest.from, image), kind: 'visitor' });
const sameMember = (a, b) => a && b && a.kind === b.kind && a.id === b.id && (a.owner || '') === (b.owner || '');

export function jointCast(state, opts, now = Date.now()) {
  const built = buildCast(state, opts, now, true);
  if (!built) return null;
  return JSON.stringify(built).length <= MAX_CAST_CHARS ? built : buildCast(state, opts, now, false);
}
function buildCast(state, { kind, caseId, twist = null, seed, plaintiffId = '', defendantId = '', mineId = '', theirs = null, side = 'p', friendShelf = [], friendName = '', myName = '' }, now, images) {
  const base = COURT_BY_ID[caseId];
  if (!base || !Number.isInteger(seed)) return null;
  const k = effectiveCase(base, twistById(caseId, twist));
  const pets = state.pets || [];
  const shelf = (Array.isArray(friendShelf) ? friendShelf : []).filter(r => r && typeof r.id === 'string');
  let p, d, partyPets, used = [];
  if (kind === SERVED) {
    const mine = petById(state, mineId);
    if (!mine || !theirs || typeof theirs.id !== 'string') return null;
    const ours = residentMember(mine, 'from', myName, images), other = friendMember(theirs, friendName, images);
    [p, d] = side === 'd' ? [other, ours] : [ours, other];
    const otherParty = { id: 'friend-' + theirs.id, traits: theirs.traits || [], bond: theirs.bond || 0 };
    partyPets = side === 'd' ? { p: otherParty, d: mine } : { p: mine, d: otherParty };
    used = [mine.id];
  } else {
    const plaintiff = petById(state, plaintiffId) || pets[0];
    if (!plaintiff) return null;
    const defendant = (defendantId !== plaintiff.id && petById(state, defendantId)) || pets.find(x => x.id !== plaintiff.id) || null;
    p = residentMember(plaintiff, 'from', myName, images);
    d = defendant ? residentMember(defendant, 'from', myName, images) : npcMember(standInFor(caseId, seed));
    partyPets = { p: plaintiff, d: defendant };
    used = [plaintiff.id, defendant?.id].filter(Boolean);
  }
  // The jury: our residents (and on served papers, theirs too, turn about),
  // then any guest visiting our shelf, then the neighbours.
  const rnd = beatRandom(seed, 'casting');
  const ours = shuffled(pets.filter(x => !used.includes(x.id)), rnd).map(x => residentMember(x, 'from', myName, false));
  const theirsLeft = kind === SERVED ? shuffled(shelf.filter(r => r.id !== theirs.id), rnd).map(r => friendMember(r, friendName, false)) : [];
  const jury = [];
  for (let i = 0; jury.length < JURY_SEATS && (i < ours.length || i < theirsLeft.length); i++) {
    if (i < ours.length) jury.push(ours[i]);
    if (jury.length < JURY_SEATS && i < theirsLeft.length) jury.push(theirsLeft[i]);
  }
  const guests = visitingGuests(state, now).map(g => visitorMember(g, false));
  const seated = guests.slice(0, Math.max(0, JURY_SEATS - jury.length));
  jury.push(...seated);
  const witnessIds = witnessesOf(k);
  for (const id of JURY_EXTRAS) {
    if (jury.length >= JURY_SEATS) break;
    if (!witnessIds.has(id) && !(d.kind === 'npc' && d.id === id)) jury.push(npcMember(id));
  }
  // Character witnesses: guests with no seat, and on an invitation, the friend's residents.
  const witnesses = [...guests.slice(seated.length), ...(kind === INVITE ? shuffled(shelf, rnd).slice(0, 2).map(r => friendMember(r, friendName, false)) : [])].slice(0, 3);
  // Seats: our residents bring their quarrels; anybody else brings their traits.
  const seatJury = jury.map(m => (m.kind === 'pet' && m.owner === 'from' ? { kind: 'pet', id: m.id } : m.kind === 'npc' ? m : { kind: 'visitor', resident: { traits: m.traits } }));
  const seats = castSeats(state, partyPets, seatJury, now);
  return { v: 1, p, d, jury, witnesses, seats };
}

/* ---- the episode, from the snapshot ----
   `hearing` is { id, kind, caseId, twist, seed, cast } with the cast already
   read (cloud/hearings.js readCast). `role` is 'first' or 'second'. Members
   that are our own residents, still living here, are seated as ours (and drawn
   from our shelf); everybody else is a visitor, drawn from the snapshot.
   Returns null when this edition cannot stage it. */
export function castJointEpisode(state, hearing, role = 'first') {
  const base = COURT_BY_ID[hearing?.caseId], cast = hearing?.cast;
  if (!base || !cast || !Number.isInteger(hearing.seed)) return null;
  if (hearing.twist && !twistById(base.id, hearing.twist)) return null;
  const k = effectiveCase(base, twistById(base.id, hearing.twist));
  const home = role === 'first' ? 'from' : 'to';
  const seat = m => {
    if (m.kind === 'npc') return { kind: 'npc', id: m.id, name: COURT_CAST[m.id].name, art: COURT_CAST[m.id].art };
    if (m.kind === 'pet' && m.owner === home && petById(state, m.id)) return { kind: 'pet', id: m.id, name: m.name };
    return { kind: 'visitor', id: (m.owner || 'guest') + '-' + m.id, name: m.name, from: m.from, owner: m.owner || '',
      resident: { id: m.id, name: m.name, traits: m.traits, mood: m.mood, bond: m.bond, art: m.art } };
  };
  const jury = cast.jury.map(seat);
  if (!jury.length) return null;
  const ep = {
    caseId: base.id, twist: hearing.twist || null, docket: false, recap: false,
    p: seat(cast.p), d: seat(cast.d), jury, juror: null, ratings: 50, respect: 50, asked: [], happened: [], hadBreak: false, ruling: null, done: false, settled: false,
    joint: { id: hearing.id || '', kind: hearing.kind === INVITE ? INVITE : SERVED, role: role === 'second' ? 'second' : 'first' },
    seed: hearing.seed,
    witnesses: cast.witnesses.map(m => ({ ...seat(m), tag: m.kind === 'visitor' ? 'visitor' : 'friend' }))
  };
  startNotes(ep);
  ep.cast = { p: cast.seats.p, d: cast.seats.d, jury: jury.map((_, i) => cast.seats.jury[i] || { traits: [], bond: 0, dislikes: [] }) };
  ep.ratings = startingRatings(ep);
  const rnd = beatRandom(hearing.seed, 'cast');
  ep.juror = pickOf(jury, rnd);
  ep.plan = episodePlan(k, rnd);
  return ep;
}
// The snapshot as the other judge will read it, so both build from the same bytes.
export const castAsSent = cast => readCast(JSON.parse(JSON.stringify(cast)));

/* ---- what each judge saw, for the stage and the comparison ---- */
export function castNames(ep) {
  return { p: ep.p.name, d: ep.d.name, jury: ep.jury.map(j => j.name), witnesses: (ep.witnesses || []).map(w => w.name) };
}

/* ---- reactions ----
   A mark is { at, r, ms }: the line of script it was made on (a beat label
   and the line's place in it), the reaction, and how far into the line. */
export const MARK_LIMIT = 40;
export const markKey = (beat, index) => (String(beat).toLowerCase().replace(/[^a-z0-9:-]/g, '').slice(0, 20) + ':' + Math.max(0, Math.min(999, index | 0))).slice(0, 24);
export function addMark(marks, mark) {
  if (!Array.isArray(marks) || marks.length >= MARK_LIMIT || !mark || !Object.hasOwn(REACTIONS, mark.r) || typeof mark.at !== 'string') return false;
  marks.push({ at: mark.at, r: mark.r, ms: Math.max(0, Math.min(20000, Math.round(Number(mark.ms) || 0))) });
  return true;
}
export function marksByLine(marks) {
  const out = new Map();
  for (const m of Array.isArray(marks) ? marks : []) {
    if (!out.has(m.at)) out.set(m.at, []);
    out.get(m.at).push(m);
  }
  return out;
}
export const galleryLine = (r, rnd = Math.random) => (REACTIONS[r] ? pickOf(REACTIONS[r].gallery, rnd) : '');

/* ---- the reveal ---- */
export const sealedRuling = (ep, result, state) => ({ ruling: ep.ruling, truth: result.truth, stars: postedStars(state, result.stars), ratings: result.ratings,
  agree: Math.min(6, ep.agree ?? 0), dissent: Math.min(6 - Math.min(6, ep.agree ?? 0), ep.disagree ?? 0) });

// How the bench did, by this edition's truth.
export function benchOutcome(hearing, truth) {
  if (hearing.status === 'declined' || hearing.status === 'withdrawn') return 'declined';
  if (!hearing.mine || !hearing.theirs) return 'alone';
  const a = hearing.mine.ruling === truth, b = hearing.theirs.ruling === truth;
  if (a && b) return 'full';
  if (a || b) return 'divided';
  return hearing.mine.ruling === hearing.theirs.ruling ? 'wrong-together' : 'wrong-apart';
}
const ruled = (who, r, ep) => (r === 'both' ? who + ' declared ' + ep.p.name + ' and ' + ep.d.name + ' both idiots.' : who + ' found for ' + (r === 'plaintiff' ? ep.p.name : ep.d.name) + '.');
export const truthLine = (ep, truth) => (truth === 'plaintiff' ? ep.p.name + ' was right.' : truth === 'defendant' ? ep.d.name + ' was right.' : 'They were both idiots.');

/* The staged reveal: the announcer, two envelopes (each opened with a gavel),
   the jury's two votes, the truth and what it all means. `other` is the other
   judge's name. Lines carry `gavel: true` where the stage bangs one. */
export function revealScript(ep, hearing, truth, other = 'Your friend') {
  const rnd = beatRandom(hearing.seed, 'reveal:' + hearing.role);
  const outcome = benchOutcome(hearing, truth);
  const them = other || 'Your friend';
  const first = hearing.role === 'first' ? hearing.mine : hearing.theirs, second = hearing.role === 'first' ? hearing.theirs : hearing.mine;
  const firstName = hearing.role === 'first' ? 'You' : them, secondName = hearing.role === 'first' ? them : 'You';
  const fill = text => text.replace(/\{b\}/g, them);
  const lines = [{ s: 'announcer', t: pickOf(REVEAL_OPEN, rnd) }];
  if (first) lines.push({ s: 'bailiff', t: 'The first envelope. ' + ruled(firstName, first.ruling, ep), gavel: true });
  if (outcome === 'alone' || outcome === 'declined') {
    lines.push({ s: 'announcer', t: fill(pickOf(OUTCOMES[outcome].lines, rnd)) });
    return { outcome, title: OUTCOMES[outcome].title, lines };
  }
  lines.push({ s: 'bailiff', t: 'The second envelope. ' + ruled(secondName, second.ruling, ep), gavel: true });
  const lower = name => (name === 'You' ? 'you' : name);
  lines.push({ s: 'jury', t: 'The jury went ' + first.agree + ' to ' + first.dissent + ' with ' + lower(firstName) + ', and ' + second.agree + ' to ' + second.dissent + ' with ' + lower(secondName) + '.' });
  lines.push({ s: 'announcer', t: pickOf(REVEAL_TRUTH, rnd) + ' ' + truthLine(ep, truth) });
  let close = fill(pickOf(OUTCOMES[outcome].lines, rnd));
  if (outcome === 'divided') close += ' It was ' + (hearing.mine.ruling === truth ? 'you' : them) + '.';
  lines.push({ s: 'announcer', t: close });
  return { outcome, title: OUTCOMES[outcome].title, lines };
}

// A full bench pays each judge once per hearing, three a day. Returns the souls
// paid, or -1 when today's three are already spent; 0 when it is not owed.
export function payFullBench(state, id, outcome, now = Date.now()) {
  if (outcome !== 'full' || typeof id !== 'string' || !id) return 0;
  const c = courtroomState(state), j = c.joint, day = localDayKey(now);
  if (j.paid.includes(id)) return 0;
  if (j.day !== day) { j.day = day; j.benches = 0; }
  j.paid = [...j.paid, id].slice(-JOINT_REMEMBERED);
  if (j.benches >= JOINT_BENCH_DAILY) return -1;
  j.benches++;
  addSouls(state, JOINT_BENCH_SOULS);
  return JOINT_BENCH_SOULS;
}

/* ---- the record between two friends ---- */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
export function recordLine(rec) {
  if (!rec || !rec.hearings) return RECORD_NONE;
  const name = rec.name || 'Your friend';
  const lead = rec.theirs - rec.mine, n = Math.abs(lead), words = WORDS[n] || String(n);
  const pickBy = list => list[hashText(rec.userId + '|' + rec.hearings) % list.length];
  const tail = lead > 0 ? pickBy(RECORD_AHEAD_THEM) : lead < 0 ? pickBy(RECORD_AHEAD_YOU) : pickBy(RECORD_LEVEL);
  return 'You and ' + name + ': ' + plural(rec.hearings, 'hearing', 'hearings') + ', ' + plural(rec.fullBenches, 'full bench', 'full benches') + '. ' +
    tail.replace(/\{b\}/g, name).replace(/\{n\}/g, words);
}
// The better judge, in a word: 'you', 'them' or 'level'.
export const betterJudge = rec => (!rec || rec.mine === rec.theirs ? 'level' : rec.mine > rec.theirs ? 'you' : 'them');
