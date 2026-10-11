import { advanceCoopMoney, applyCoopReward, readCoopRewardDetail, sameCoopReward, assertCoopGameOwnership } from './coop-money.js';
import { coopState, normalizeOutingGuest, normalizeTripReport, COOP_LIMITS } from '../coop-state.js';
import { residentVoice } from './resident-memory.js';
import { addSouls } from './mayhem.js';
import { mayhemState } from '../mayhem-state.js';
import { addNote } from '../state.js';
import { missionStops } from '../content/project-encounters.js';
import { PROJECTS } from '../content/projects.js';
import { GEAR } from '../content/life.js';
import {
  HIRE_ARRIVALS, GUEST_LINES, GUEST_FAREWELLS, REPORT_OPENERS, REPORT_GEAR, REPORT_HELPED, REPORT_QUIET, REPORT_TIERS, REPORT_BUILT,
  REPORT_EARLY, REPORT_PAY, REPORT_UNPAID, REPORT_UNFINISHED, HIRE_MEMORIES, fill, pickBy
} from '../content/coop.js';

/* ================= CO-OP RULES =================
   Hired help and duels, as plain functions of the save. The network lives
   in src/cloud/coop.js and the screens in src/ui/coop.js; nothing here
   waits on either. */

export const STAT_KEYS = ['cute', 'menace', 'damp', 'mystique'];
export const SKILLED = 7;            // the stat a resident needs for a cheaper detour (engine/life.js)
export const WAGE_TIERS = [6, 9, 12]; // what the server pays a lender per trip (0009_coop.sql)
export const STAKES = [0, 5, 10, 25];

/* ---------------- hired help on this shelf's trip ---------------- */

// The guest a hire puts in the crew: a copy of the friend's resident for one
// trip, never added to state.pets.
export function hireGuest(hire) {
  const r = hire?.resident || {};
  return normalizeOutingGuest({ hireId: hire?.id, owner: hire?.hirerId, from: { userId: hire?.ownerId, name: hire?.ownerName }, id: r.id, name: r.name, traits: r.traits,
    stats: r.stats, art: r.art?.creature ? { creature: r.art.creature } : null });
}

// The guest as a crew member the expedition rules can read. It has stats and
// a name, and nothing else the engine might be tempted to change.
export function guestCrew(guest) {
  if (!guest || typeof guest !== 'object') return [];
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = Number.isInteger(guest.stats?.[k]) ? guest.stats[k] : 5;
  return [Object.freeze({ id: 'guest-' + guest.id, name: guest.name, traits: Object.freeze([...(guest.traits || [])]), stats: Object.freeze(stats), guest: true })];
}

// Stops on a route where the guest's own stats make a detour cheaper.
export function guestSkills(guest, stops) {
  const crew = guestCrew(guest)[0];
  return crew ? stops.map((stop, i) => (crew.stats[stop.stat] || 0) >= SKILLED ? i : -1).filter(i => i >= 0) : [];
}

const voiceOf = guest => residentVoice({ traits: guest?.traits || [] });
const gearName = id => (GEAR.find(g => g.id === id)?.name || 'packed tool').toLowerCase();

export function guestArrival(guest, lead = '') {
  return fill(pickBy(HIRE_ARRIVALS, guest.hireId + ':arrive'), { name: guest.name, host: guest.from.name || 'a friend', lead: lead || 'the lead' });
}
// What the guest says after a stop: stable for that trip and stop.
export function guestLine(guest, step, choice, { lead = '', gear = '' } = {}) {
  const pool = GUEST_LINES[[0, 1, 2].includes(choice) ? choice : 0];
  return fill(pickBy(pool, guest.hireId + ':' + step + ':' + voiceOf(guest)), { name: guest.name, host: guest.from.name || 'a friend', lead: lead || 'the lead', gear: gearName(gear) });
}
export function guestFarewell(guest, lead = '') {
  return fill(pickBy(GUEST_FAREWELLS, guest.hireId + ':bye'), { name: guest.name, host: guest.from.name || 'a friend', lead: lead || 'the lead' });
}

/* ---------------- the report the hirer sends ---------------- */

// Built from the finished trip: route, tool, choices and score, which stops
// the guest's stats helped at, and the names of this shelf's crew.
export function tripReport(outing, steps, tier, crewNames = []) {
  const guest = outing?.guest;
  if (!guest || !Array.isArray(steps)) return null;
  const choices = (outing.choices || []).slice(0, 3);
  const helped = choices.map((c, i) => c === 1 && steps[i] && (guest.stats?.[steps[i].stat] || 0) >= SKILLED ? i : -1).filter(i => i >= 0);
  return normalizeTripReport({ route: outing.route, gear: outing.gear, edition: outing.edition || 0, rev: outing.missionRevision === 2 ? 2 : 1,
    score: Math.min(12, outing.score || 0), tier, returned: outing.returnedAt || 0, built: outing.result?.built === true, choices, helped,
    crew: crewNames.slice(0, 2) });
}
// Called once, when a trip with a guest ends (engine/life.js chooseOuting).
export function queueHireReport(state, outing, steps, tier, crewNames, now = Date.now()) {
  const report = tripReport(outing, steps, tier, crewNames), c = coopState(state);
  if (!report || c.outbox.some(x => x.hireId === outing.guest.hireId)) return null;
  c.outbox.push({ hireId: outing.guest.hireId, ...(outing.guest.owner ? { owner: outing.guest.owner } : {}), report, at: now, tries: 0 });
  if (c.outbox.length > COOP_LIMITS.outbox) c.outbox.splice(0, c.outbox.length - COOP_LIMITS.outbox);
  return report;
}
export function reportSent(state, hireId, owner = '') {
  const c = coopState(state);
  c.outbox = c.outbox.filter(x => x.hireId !== hireId || (x.owner || '') !== owner);
}

/* ---------------- the report the lender reads ---------------- */

// The field report as prose, from the ids and numbers the server kept. The
// same report always reads the same way.
export function fieldReport(item) {
  const name = item.name || 'resident', hirer = item.hirerName || 'a friend you no longer see', r = item.report;
  const vars = { name, hirer, lead: r?.crew?.[0] || hirer + '’s lead resident' };
  const key = item.id || name;
  if (!r) return fill(pickBy(REPORT_UNFINISHED, key), vars);
  const stops = missionStops(r.route, r.edition, r.rev);
  const lines = [fill(pickBy(REPORT_OPENERS[r.route], key + ':open'), vars)];
  if (r.choices.includes(2)) lines.push(fill(pickBy(REPORT_GEAR[r.gear], key + ':gear'), vars));
  const helped = r.helped.find(i => stops[i]);
  if (helped !== undefined) lines.push(fill(pickBy(REPORT_HELPED[stops[helped].stat], key + ':help'), { ...vars, stop: stops[helped].title }));
  else if (r.choices.filter(c => c === 0).length >= 2) lines.push(fill(pickBy(REPORT_QUIET, key + ':quiet'), vars));
  if (r.returned) lines.push(fill(pickBy(REPORT_EARLY, key + ':early'), vars));
  lines.push(fill(pickBy(REPORT_TIERS[r.tier], key + ':tier'), vars));
  if (r.built) lines.push(fill(pickBy(REPORT_BUILT, key + ':built'), { ...vars, project: PROJECTS.find(p => p.id === r.route)?.name || 'something useful' }));
  lines.push(fill(item.wages > 0 ? pickBy(REPORT_PAY, key + ':pay') : pickBy(REPORT_UNPAID, key + ':unpaid'), vars));
  return lines.join(' ');
}

export function hireMemory(item) {
  const pool = item.report ? HIRE_MEMORIES[item.report.route] : HIRE_MEMORIES.lost;
  const friend = item.hirerName || 'a friend';
  return { key: 'coop:hire:' + item.id, text: fill(pickBy(pool, item.id + ':memory'), { friend }),
    evidence: 'Hired out to ' + friend + '’s expedition' + (item.report ? '.' : ', which did not come home.') };
}

// The lender reads the report: wages paid (once, by the server's say), a note
// on the board and a memory for the resident, if it still lives here.
export const receiptMark = (kind, id, owner = '') => (owner ? owner + ':' : '') + kind + ':' + id;

export function collectReport(state, item, wages, now = Date.now(), owner = '', { credit = true } = {}) {
  const c = coopState(state), mark = receiptMark('h', item.id, owner);
  if (c.done.includes(mark)) return { souls: 0, text: fieldReport(item), fresh: false };
  c.done.push(mark);
  if (c.done.length > COOP_LIMITS.done) c.done.splice(0, c.done.length - COOP_LIMITS.done);
  const souls = Math.max(0, Math.min(30, Math.floor(wages || 0)));
  if (souls && credit) addSouls(state, souls);
  const text = fieldReport(item);
  const pet = state.pets.find(p => p.id === item.petId);
  if (pet) {
    const m = hireMemory(item);
    c.memories = c.memories.filter(x => x.key !== m.key);
    c.memories.push({ petId: pet.id, key: m.key, text: m.text, evidence: m.evidence, at: now });
    const own = c.memories.filter(x => x.petId === pet.id);
    if (own.length > COOP_LIMITS.perPet) c.memories.splice(c.memories.indexOf(own[0]), 1);
    if (c.memories.length > COOP_LIMITS.memories) c.memories.splice(0, c.memories.length - COOP_LIMITS.memories);
  }
  addNote(state, text + (souls ? ' Wages: ' + souls + ' souls.' : ''), 'a field report', 'note');
  return { souls, text, fresh: true };
}

/* ---------------- residents up for hire ---------------- */

export function setListed(state, ids, owner = '') {
  const c = coopState(state);
  c.listedOwner = owner;
  c.listed = [...new Set(ids.filter(id => state.pets.some(p => p.id === id)))].slice(0, COOP_LIMITS.listed);
  return c.listed;
}
// What a listed resident shows a friend: look, traits and the four stats.
export function listingFor(pet, snapshot) {
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.min(10, Math.round(Number(pet.stats?.[k]) || 5)));
  return { ...snapshot, stats };
}

/* ---------------- duels: stakes, attempts, payouts ---------------- */

// The stake leaves the purse once per duel, whatever happens to the network.
export function holdStake(state, duelId, amount, owner = '') {
  if (!(amount > 0)) return true;
  const c = coopState(state);
  if (c.stakes.some(s => s.duelId === duelId && (s.owner || '') === owner)) return true;
  const m = mayhemState(state);
  if (m.souls < amount) return false;
  m.souls -= amount;
  c.stakes.push({ duelId, ...(owner ? { owner } : {}), amount, at: Date.now() });
  if (c.stakes.length > COOP_LIMITS.stakes) c.stakes.splice(0, c.stakes.length - COOP_LIMITS.stakes);
  return true;
}
export const stakeHeld = (state, duelId, owner = '') => coopState(state).stakes.find(s => s.duelId === duelId && (s.owner || '') === owner)?.amount || 0;

// What the server says a settled duel owes. Your own stake comes back as it
// went; only the other player's counts as souls earned.
export function payDuel(state, duelId, souls, owner = '') {
  const c = coopState(state), mark = receiptMark('d', duelId, owner);
  if (c.done.includes(mark)) return 0;
  c.done.push(mark);
  if (c.done.length > COOP_LIMITS.done) c.done.splice(0, c.done.length - COOP_LIMITS.done);
  const paid = Math.max(0, Math.min(50, Math.floor(souls || 0)));
  const own = Math.min(paid, stakeHeld(state, duelId, owner));
  if (own) mayhemState(state).souls += own;
  if (paid - own) addSouls(state, paid - own);
  c.stakes = c.stakes.filter(s => s.duelId !== duelId || (s.owner || '') !== owner);
  return paid;
}

export function attemptFor(state, duelId, round, owner = '') {
  return coopState(state).attempts.find(a => a.duelId === duelId && a.round === round && (a.owner || '') === owner) || null;
}
// `extra` carries { game, seed, log } for a run that still has to be filed.
export function markAttempt(state, duelId, round, status, score = 0, extra = {}, now = Date.now(), owner = '') {
  const c = coopState(state);
  const found = attemptFor(state, duelId, round, owner);
  const next = { state: status, score: Math.max(found?.score || 0, Math.floor(score || 0)), at: now };
  for (const k of ['game', 'seed']) if (extra[k] !== undefined) next[k] = extra[k];
  if (found) { Object.assign(found, next); if (status === 'played' && extra.log) found.log = extra.log; if (status !== 'played') delete found.log; }
  else c.attempts.push({ duelId, ...(owner ? { owner } : {}), round, ...next, ...(status === 'played' && extra.log ? { log: extra.log } : {}) });
  if (c.attempts.length > COOP_LIMITS.attempts) c.attempts.splice(0, c.attempts.length - COOP_LIMITS.attempts);
  return attemptFor(state, duelId, round, owner);
}
export function markSeen(state, duelId, round, owner = '') {
  const c = coopState(state), key = (owner ? owner + ':' : '') + duelId + ':' + round;
  if (!c.seen.includes(key)) c.seen.push(key);
  if (c.seen.length > COOP_LIMITS.seen) c.seen.splice(0, c.seen.length - COOP_LIMITS.seen);
}

// A duel from the player's side: whose move it is, the rounds as mine and
// theirs, and the series score.
export function duelSummary(d, me) {
  const iChallenge = d.challenger === me;
  const otherName = (iChallenge ? d.opponentName : d.challengerName) || '';
  const myWins = iChallenge ? d.winsChallenger : d.winsOpponent, theirWins = iChallenge ? d.winsOpponent : d.winsChallenger;
  const rounds = d.rounds.map(r => {
    const first = r.firstPlayer === me, mine = first ? r.firstScore : r.secondScore, theirs = first ? r.secondScore : r.firstScore;
    return { n: r.n, status: r.status, first, mine, theirs, started: r.started, at: r.secondAt || r.firstAt || r.createdAt,
      result: r.status === 'done' ? (mine > theirs ? 'won' : mine < theirs ? 'lost' : 'tied') : null };
  });
  const last = rounds.at(-1);
  let turn = 'wait';
  if (d.status === 'settled') turn = d.claimed ? 'done' : 'claim';
  else if (last?.status === 'first') turn = last.first ? 'play' : 'wait';
  else if (last?.status === 'second') turn = last.first ? 'wait' : 'answer';
  else if (last?.status === 'done') turn = last.n < 3 && Math.max(myWins, theirWins) < 2 ? 'rematch' : 'wait';
  return { other: iChallenge ? d.opponent : d.challenger, otherName, myWins, theirWins, rounds, last, turn, iChallenge,
    outcome: d.outcome === 'void' ? 'void' : d.outcome === 'tie' ? 'tie' : d.outcome ? ((d.outcome === 'challenger') === iChallenge ? 'won' : 'lost') : null };
}
// When the round waiting on somebody lapses (48 hours after its last move).
export function duelLapsesAt(d) {
  const r = d.rounds.at(-1);
  if (!r || d.status !== 'open') return 0;
  const from = r.status === 'first' ? r.createdAt : r.status === 'second' ? r.firstAt : r.status === 'done' ? r.secondAt : 0;
  return from ? from + 48 * 3600000 : 0;
}

export function rememberRecords(state, list, now = Date.now(), owner = '') {
  const c = coopState(state);
  if (c.recordsOwner !== owner) c.records = {};
  c.recordsOwner = owner;
  for (const r of list) c.records[r.friend] = { won: r.duelsWon, lost: r.duelsLost, tied: r.duelsTied, roundsWon: r.roundsWon, roundsLost: r.roundsLost,
    streak: r.streak, best: r.bestStreak, trips: r.trips, at: now };
  const keep = Object.entries(c.records).sort(([, a], [, b]) => b.at - a.at).slice(0, COOP_LIMITS.records);
  c.records = Object.fromEntries(keep);
  return c.records;
}

// A wallet and its per-owner cursor are saved together. Server receipts are
// immutable and replayable, so a lost response or an old backup can resume
// from the same cursor. Stake debits always precede their settlement credits.
export function applyCoopReceipts(state, owner, receipts) {
  if (!/^[0-9a-f-]{36}$/i.test(owner || '') || !Array.isArray(receipts)) throw new Error('Invalid Co-op receipts');
  const c = coopState(state), position = c.ledger[owner] || { seq: 0, debt: 0 };
  const fresh = receipts.filter(r => r.seq > position.seq);
  const local = new Map(c.money.pending.filter(p => p.owner === owner).map(p => [p.id, p]));
  let seq = position.seq;
  for (const r of fresh) {
    if (r.owner !== owner || r.seq !== ++seq || !['stake', 'duel', 'hire', 'game'].includes(r.kind)
      || !/^[0-9a-f-]{36}$/i.test(r.id || '') || !/^[0-9a-f-]{36}$/i.test(r.sourceId || '')
      || !Number.isInteger(r.delta) || (r.kind === 'game' ? Math.abs(r.delta) > 100000000 : r.delta < -25 || r.delta > 50) || !Number.isInteger(r.earned)
      || r.earned < 0 || (r.kind === 'game' ? r.earned > 100000000 : r.earned > Math.max(0, r.delta))
      || (r.kind === 'stake' ? r.delta >= 0 || r.earned !== 0 : r.kind !== 'game' && r.delta < 0)) {
      throw new Error('Invalid Co-op receipt sequence');
    }
    if (r.kind === 'game' && r.detail && !readCoopRewardDetail(r.detail)) throw new Error('Invalid currency reward detail');
    const pending = r.kind === 'game' && local.get(r.sourceId);
    const mismatch = pending && (pending.delta !== r.delta || pending.earned !== r.earned || JSON.stringify(pending.detail || null) !== JSON.stringify(r.detail || null));
    if (pending?.preApplied === false && !sameCoopReward(pending.detail, r.detail)) throw new Error('Currency receipt does not match reward source');
    if (mismatch && pending.preApplied !== false) {
      if (pending.detail && r.detail) throw Object.assign(new Error('This prototype reward differs from the account’s original receipt. Restore the matching cloud shelf or a backup from before that reward.'), { code: 'reward_legacy' });
      throw new Error('Currency receipt does not match saved operation');
    }
  }
  assertCoopGameOwnership(state, owner, fresh);
  const m = mayhemState(state), soulsBefore = m.souls, lifetimeBefore = m.lifetime;
  c.ledger[owner] = position;
  // Another local feature may have earned souls since a debit was deferred.
  const repayment = Math.min(m.souls, position.debt);
  m.souls -= repayment; position.debt -= repayment;
  let paid = 0;
  for (const r of fresh) {
    const pending = r.kind === 'game' && local.get(r.sourceId), preApplied = pending && pending.preApplied !== false;
    if (preApplied) {
      // This operation already changed the wallet before it was saved. Its
      // receipt advances the cursor, but never pays or charges it again.
      c.money.pending = c.money.pending.filter(p => p.owner !== owner || p.id !== r.sourceId);
    } else if (r.delta < 0) {
      const held = r.kind === 'stake' ? stakeHeld(state, r.sourceId, owner) : 0;
      const due = Math.max(0, -r.delta - held), debit = Math.min(m.souls, due);
      m.souls -= debit; position.debt += due - debit;
      if (r.earned) { addSouls(state, r.earned); m.souls -= r.earned; }
      if (r.kind === 'stake') {
        c.stakes = c.stakes.filter(s => s.duelId !== r.sourceId || s.owner !== owner);
        c.stakes.push({ owner, duelId: r.sourceId, amount: -r.delta, at: Date.now() });
      }
    } else {
      const repayment = Math.min(position.debt, r.delta);
      position.debt -= repayment;
      const credit = r.delta - repayment;
      // addSouls raises ranks from earned winnings, never from returned stakes.
      if (r.earned) { addSouls(state, r.earned); m.souls -= r.earned; }
      m.souls += credit; if (r.kind !== 'game') paid += credit;
      if (r.kind === 'duel') c.stakes = c.stakes.filter(s => s.duelId !== r.sourceId || s.owner !== owner);
      if (r.kind === 'hire' && r.detail) collectReport(state, r.detail, r.delta, Date.now(), owner, { credit: false });
    }
    if (r.kind === 'game' && r.detail) {
      if (!preApplied) applyCoopReward(state, owner, r.detail);
      const rewards = c.money.rewards[owner] ||= [];
      if (!rewards.includes(r.sourceId)) rewards.push(r.sourceId);
      (c.money.received[owner] ||= {})[r.sourceId] = { delta: r.delta, earned: r.earned, detail: readCoopRewardDetail(r.detail) };
    }
    if (pending) c.money.pending = c.money.pending.filter(p => p.owner !== owner || p.id !== r.sourceId);
    position.seq = r.seq;
  }
  advanceCoopMoney(state, owner, soulsBefore, lifetimeBefore);
  return { paid, applied: fresh.length, seq: position.seq, debt: position.debt };
}
