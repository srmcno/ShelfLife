// Co-op over the one cloud session: hired help and arcade duels. The schema
// is supabase/migrations/0009_coop.sql.
//
// Like src/cloud/social.js, the server decides who may see what and nothing
// it sends is trusted for shape: every reply goes through a reader here, so
// names are clamped, residents are rebuilt by readResident (art from known
// parts, a drawing only as a PNG under 120 KB), stats and scores are bounded
// and an input log is checked move by move before a ghost replays it. Errors
// come back as CloudErrors whose message is already the player's copy.
import { readResident, residentSnapshot, cleanText, cleanUuid, socialCode, socialText, SCORE_CAPS } from './social.js';
import { CloudError } from './client.js';
import { readDuelLog, DUEL_GAMES } from '../engine/duel.js';
import { readCoopRewardDetail } from '../engine/coop-money.js';
import { normalizeTripReport } from '../coop-state.js';
import { listingFor, STAT_KEYS } from '../engine/coop.js';

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value, hi) => Number.isFinite(value) ? Math.max(0, Math.min(hi, Math.floor(value))) : 0;
const time = value => { const t = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(t) && t > 0 ? t : 0; };
const PET_ID = /^[A-Za-z0-9_-]{1,100}$/;
export const MAX_LISTING_CHARS = 130000;

const TEXT = {
  not_for_hire: 'That resident is no longer for hire. Its owner has had second thoughts, or a better offer.',
  hired_today: 'You have had your hire for today. The agency reopens at midnight, UTC, which is its own kind of midnight.',
  fully_booked: 'Three trips today already. It has asked to lie down somewhere cool.',
  dnd: 'They have Do not disturb on. Try another day.',
  bad_resident: 'That resident could not be listed. Nothing was changed.',
  bad_report: 'The trip report was refused. Nothing was changed.',
  bad_stake: 'A stake is 0 to 25 souls.',
  cloud_copy_required: 'Open Cloud save to choose your shelf. For Co-op, use the cloud copy with this account’s souls.',
  state_changed: 'Your shelf or account changed. Open it again to continue.',
  save_unavailable: 'Your device could not save the wager. Free some storage and try again.',
  needs_opening: 'Connect once to prepare your souls for a duel.',
  insufficient_souls: 'You need more souls to match that stake. Play or take care of your residents first.',
  bad_balance: 'Your souls could not be checked. Nothing was changed.',
  bad_seq: 'Your souls need to finish syncing. Try again.',
  bad_log: 'The duel run could not be sent. Nothing was changed.',
  not_your_turn: 'It is not your move in that duel.',
  not_open: 'That duel has already been settled.',
  too_many_open: 'You already have three duels open with them. Finish one first.',
  not_found: 'That has gone. It lapsed, or was settled while you were out.'
};
const TOKENS = new Set(Object.keys(TEXT));

export function coopCode(error) {
  if (error?.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  if (TOKENS.has(error?.code)) return error.code;
  return socialCode(error);
}
// The player's copy for any refusal: ours first, then the social layer's.
const copyFor = code => TEXT[code] || socialText(code === 'offline' ? { offline: true } : { code });
export const coopText = error => copyFor(coopCode(error));
const refuse = (code, status = 0) => new CloudError(copyFor(code), { code, status });

/* ---------------- readers ---------------- */

export function readStats(raw) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = Number.isInteger(raw?.[k]) && raw[k] >= 1 && raw[k] <= 10 ? raw[k] : 5;
  return out;
}
export function readListing(raw) {
  if (!record(raw)) return null;
  const ownerId = cleanUuid(raw.owner), resident = readResident(raw.resident);
  if (!ownerId || !resident || raw.pet_id !== resident.id) return null;
  return { ownerId, ownerName: cleanText(raw.owner_name, 24), petId: resident.id, resident: { ...resident, stats: readStats(raw.resident.stats) },
    tripsToday: count(raw.trips_today, 99), available: raw.available === true };
}
export function readBoard(raw) {
  const r = record(raw) ? raw : {}, seen = new Set();
  return { hiredToday: r.hired_today === true,
    listings: (Array.isArray(r.listings) ? r.listings.slice(0, 40) : []).map(readListing).filter(l => l && !seen.has(l.ownerId + '|' + l.petId) && seen.add(l.ownerId + '|' + l.petId)) };
}
export function readHire(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), ownerId = cleanUuid(raw.owner), resident = readResident(raw.resident);
  if (!id || !ownerId || !resident) return null;
  return { id, ownerId, ownerName: cleanText(raw.owner_name, 24), resident: { ...resident, stats: readStats(raw.resident.stats) } };
}
export function readReport(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), hirer = cleanUuid(raw.hirer);
  if (!id || !hirer || typeof raw.pet_id !== 'string' || !PET_ID.test(raw.pet_id)) return null;
  const report = raw.report === null ? null : normalizeTripReport(raw.report);
  if (raw.report !== null && !report) return null;
  return { id, hirer, hirerName: cleanText(raw.hirer_name, 24), petId: raw.pet_id, name: cleanText(raw.name, 22) || 'Someone', report,
    wages: count(raw.wages, 30), finishedAt: time(raw.finished_at) };
}
export function readReports(raw) {
  const r = record(raw) ? raw : {}, ids = new Set();
  const uniq = (list, read, n) => (Array.isArray(list) ? list.slice(0, n) : []).map(read).filter(x => x && !ids.has(x.id || x.petId) && ids.add(x.id || x.petId));
  return {
    listed: uniq(r.listed, x => record(x) && typeof x.pet_id === 'string' && PET_ID.test(x.pet_id)
      ? { petId: x.pet_id, name: cleanText(x.name, 22) || 'Someone', tripsToday: count(x.trips_today, 99) } : null, 2),
    away: uniq(r.away, x => record(x) && cleanUuid(x.id) && typeof x.pet_id === 'string' && PET_ID.test(x.pet_id)
      ? { id: cleanUuid(x.id), petId: x.pet_id, name: cleanText(x.name, 22) || 'Someone', hirer: cleanUuid(x.hirer), hirerName: cleanText(x.hirer_name, 24), since: time(x.since) } : null, 20),
    reports: uniq(r.reports, readReport, 20)
  };
}
function readRound(raw, cap) {
  if (!record(raw) || !Number.isInteger(raw.n) || raw.n < 1 || raw.n > 3 || !['first', 'second', 'done', 'void'].includes(raw.status)) return null;
  const score = v => Number.isInteger(v) && v >= 0 && v <= cap ? v : null;
  return { n: raw.n, firstPlayer: cleanUuid(raw.first_player), status: raw.status, firstScore: score(raw.first_score), secondScore: score(raw.second_score),
    started: raw.started === true, createdAt: time(raw.created_at), firstAt: time(raw.first_at), secondAt: time(raw.second_at) };
}
export function readDuel(raw) {
  if (!record(raw) || !DUEL_GAMES.includes(raw.game)) return null;
  const id = cleanUuid(raw.id), challenger = cleanUuid(raw.challenger), opponent = cleanUuid(raw.opponent);
  if (!id || !challenger || !opponent || !['open', 'settled'].includes(raw.status)) return null;
  const cap = SCORE_CAPS[raw.game], rounds = (Array.isArray(raw.rounds) ? raw.rounds.slice(0, 3) : []).map(r => readRound(r, cap));
  if (!rounds.length || rounds.some(r => !r || !r.firstPlayer) || rounds.some((r, i) => r.n !== i + 1)) return null;
  return { id, challenger, opponent, challengerName: cleanText(raw.challenger_name, 24), opponentName: cleanText(raw.opponent_name, 24), game: raw.game,
    stake: count(raw.stake, 25), opponentStaked: raw.opponent_staked === true, status: raw.status,
    outcome: ['challenger', 'opponent', 'tie', 'void'].includes(raw.outcome) ? raw.outcome : null,
    winsChallenger: count(raw.wins_challenger, 3), winsOpponent: count(raw.wins_opponent, 3), payout: count(raw.payout, 50), claimed: raw.claimed === true,
    createdAt: time(raw.created_at), updatedAt: time(raw.updated_at), settledAt: time(raw.settled_at), rounds };
}
export function readDuels(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw.slice(0, 30) : []).map(readDuel).filter(d => d && !seen.has(d.id) && seen.add(d.id));
}
export function readTurn(raw, game) {
  if (!record(raw) || !['first', 'second'].includes(raw.role) || raw.game !== game) return null;
  if (!Number.isInteger(raw.round) || raw.round < 1 || raw.round > 3 || !Number.isInteger(raw.seed) || raw.seed < 1 || raw.seed > 2147483647) return null;
  return { round: raw.round, seed: raw.seed, role: raw.role, game, stake: count(raw.stake, 25), against: cleanText(raw.against, 24),
    ghost: raw.role === 'second' ? readDuelLog(raw.ghost, game, SCORE_CAPS[game]) : null };
}
export function readRecords(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw.slice(0, 200) : []).map(r => {
    const friend = cleanUuid(r?.friend);
    if (!friend || seen.has(friend)) return null;
    seen.add(friend);
    return { friend, duelsWon: count(r.duels_won, 1e6), duelsLost: count(r.duels_lost, 1e6), duelsTied: count(r.duels_tied, 1e6), roundsWon: count(r.rounds_won, 1e6),
      roundsLost: count(r.rounds_lost, 1e6), streak: count(r.streak, 1e6), bestStreak: count(r.best_streak, 1e6), trips: count(r.trips, 1e6) };
  }).filter(Boolean);
}

// Unlike recent activity, financial receipts may never be silently dropped.
// One malformed or missing sequence leaves the save's cursor untouched.
export function readCoopReceipts(raw, owner) {
  if (!record(raw) || !Array.isArray(raw.receipts) || raw.receipts.length > 100 || typeof raw.has_more !== 'boolean' || !Number.isSafeInteger(raw.last_seq) || raw.last_seq < 0) throw refuse('unexpected');
  const receipts = raw.receipts.map(r => {
    const id = cleanUuid(r?.id), sourceId = cleanUuid(r?.source_id), who = cleanUuid(r?.owner);
    if (!id || !sourceId || who !== owner || !Number.isSafeInteger(r.seq) || r.seq < 1 || !['stake', 'duel', 'hire', 'game'].includes(r.kind)
      || !Number.isInteger(r.delta) || (r.kind === 'game' ? Math.abs(r.delta) > 100000000 : r.delta < -25 || r.delta > 50) || !Number.isInteger(r.earned) || r.earned < 0
      || (r.kind === 'game' ? r.earned > 100000000 : r.earned > Math.max(0, r.delta))
      || (r.kind === 'stake' ? r.delta >= 0 || r.earned !== 0 : r.kind !== 'game' && r.delta < 0)) throw refuse('unexpected');
    let detail = null;
    if (r.detail != null) {
      if (!record(r.detail)) throw refuse('unexpected');
      if (r.kind === 'hire') {
        if (cleanUuid(r.detail.hire_id) !== sourceId) throw refuse('unexpected');
        detail = readReport({ ...r.detail, id: sourceId });
        if (!detail || detail.wages !== r.delta) throw refuse('unexpected');
      } else if (r.kind === 'game') {
        detail = readCoopRewardDetail(r.detail);
        if (!detail) throw refuse('unexpected');
      } else {
        const d = r.detail, against = cleanUuid(d.against);
        if (cleanUuid(d.duel_id) !== sourceId || !DUEL_GAMES.includes(d.game) || !against || against === owner
          || !Number.isInteger(d.stake) || d.stake < 0 || d.stake > 25 || ![null, 'challenger', 'opponent', 'tie', 'void'].includes(d.outcome)
          || !Number.isInteger(d.wins_mine) || d.wins_mine < 0 || d.wins_mine > 3 || !Number.isInteger(d.wins_theirs) || d.wins_theirs < 0 || d.wins_theirs > 3) throw refuse('unexpected');
        detail = { game: d.game, stake: d.stake, against, againstName: cleanText(d.against_name, 24), outcome: d.outcome,
          winsMine: d.wins_mine, winsTheirs: d.wins_theirs };
      }
    }
    return { id, owner: who, sourceId, seq: r.seq, kind: r.kind, delta: r.delta, earned: r.earned, ...(detail ? { detail } : {}) };
  });
  if (raw.has_more && !receipts.length) throw refuse('unexpected');
  if (receipts.some(r => r.seq > raw.last_seq)) throw refuse('unexpected');
  return { receipts, more: raw.has_more, lastSeq: raw.last_seq };
}

export function readCoopWallet(raw) {
  if (!record(raw) || ![raw.opening, raw.balance].every(v => v === null || Number.isSafeInteger(v))
    || (raw.opening !== null && (raw.opening < 0 || raw.opening > 100000000))
    || !Number.isSafeInteger(raw.opening_seq) || raw.opening_seq < 0 || !Number.isSafeInteger(raw.last_seq) || raw.last_seq < raw.opening_seq) throw refuse('unexpected');
  return { opening: raw.opening, openingSeq: raw.opening_seq, balance: raw.balance, lastSeq: raw.last_seq, accepted: raw.accepted === true };
}

/* ---------------- the wrappers ---------------- */

export function createCoop({ cloud, social }) {
  const signedIn = () => !!cloud?.configured && cloud.signedIn();
  const active = () => !!social?.active?.();
  async function call(name, args) {
    if (!signedIn()) throw refuse('signed_out', 401);
    const owner = cloud.userId();
    try {
      const reply = await cloud.rpc(name, args);
      if (!signedIn() || cloud.userId() !== owner) throw refuse('session_changed', 401);
      return reply;
    }
    catch (error) {
      const code = coopCode(error);
      throw Object.assign(refuse(code, error?.status || 0), { offline: code === 'offline' });
    }
  }
  const uuid = value => { const id = cleanUuid(value); if (!id) throw refuse('not_found'); return id; };

  // Up to two of this shelf's residents, as friends will see them.
  async function setHires(pets) {
    const residents = pets.slice(0, 2).map(pet => {
      let snap = residentSnapshot(pet);
      if (JSON.stringify(snap).length > MAX_LISTING_CHARS) snap = residentSnapshot(pet, { image: false });
      const { mood, bond, ...shown } = snap;
      return listingFor(pet, shown);
    });
    const r = await call('coop_set_hires', { p_residents: residents });
    return (Array.isArray(r?.listed) ? r.listed : []).filter(id => typeof id === 'string' && PET_ID.test(id));
  }
  const hireBoard = async () => readBoard(await call('coop_hire_board', {}));
  async function hire(ownerId, petId) {
    const hirerId = cloud.userId();
    if (typeof petId !== 'string' || !PET_ID.test(petId)) throw refuse('not_for_hire');
    const h = readHire(await call('coop_hire', { p_owner: uuid(ownerId), p_pet: petId }));
    if (!h) throw refuse('unexpected');
    if (cloud.userId() !== hirerId) throw refuse('session_changed', 401);
    return { ...h, hirerId };
  }
  async function finishHire(hireId, report) {
    const clean = normalizeTripReport(report);
    if (!clean) throw refuse('bad_report');
    const r = await call('coop_finish_hire', { p_hire: uuid(hireId), p_report: clean });
    return { wages: count(r?.wages, 30) };
  }
  const reports = async () => readReports(await call('coop_reports', {}));
  async function collect(hireId) { const r = await call('coop_collect', { p_hire: uuid(hireId) }); return { wages: count(r?.wages, 30) }; }

  async function duelCreate(to, game, stake) {
    if (!DUEL_GAMES.includes(game)) throw refuse('bad_score');
    if (!Number.isInteger(stake) || stake < 0 || stake > 25) throw refuse('bad_stake');
    const r = await call('coop_duel_create', { p_to: uuid(to), p_game: game, p_stake: stake });
    const id = cleanUuid(r?.id);
    if (!id || !Number.isInteger(r?.seed) || r.seed < 1 || r.seed > 2147483647) throw refuse('unexpected');
    return { id, round: 1, seed: r.seed, game, stake };
  }
  async function duelPlay(id, game) {
    const turn = readTurn(await call('coop_duel_play', { p_duel: uuid(id) }), game);
    if (!turn) throw refuse('unexpected');
    return turn;
  }
  async function duelSubmit(id, round, score, game, log = null) {
    if (!Number.isInteger(score) || score < 0 || score > SCORE_CAPS[game]) throw refuse('bad_score');
    const r = await call('coop_duel_submit', { p_duel: uuid(id), p_round: round, p_score: score, p_log: log });
    if (!record(r)) throw refuse('unexpected');
    const cap = SCORE_CAPS[game], sc = v => Number.isInteger(v) && v >= 0 && v <= cap ? v : null;
    return { round: count(r.round, 3), status: r.status === 'done' ? 'done' : 'second', firstScore: sc(r.first_score), secondScore: sc(r.second_score),
      winsChallenger: count(r.wins_challenger, 3), winsOpponent: count(r.wins_opponent, 3), settled: r.settled === true,
      outcome: ['challenger', 'opponent', 'tie', 'void'].includes(r.outcome) ? r.outcome : null };
  }
  const duelDecline = async id => { await call('coop_duel_decline', { p_duel: uuid(id) }); return true; };
  async function duelRematch(id) {
    const r = await call('coop_duel_rematch', { p_duel: uuid(id) });
    if (!Number.isInteger(r?.seed) || !Number.isInteger(r?.round)) throw refuse('unexpected');
    return { round: count(r.round, 3), seed: r.seed };
  }
  const duels = async () => readDuels(await call('coop_duels', {}));
  async function duelClaim(id) { const r = await call('coop_duel_claim', { p_duel: uuid(id) }); return { souls: count(r?.souls, 50) }; }
  const records = async () => readRecords(await call('coop_records', {}));
  async function adjustMoney(operations) {
    if (!Array.isArray(operations) || !operations.length || operations.length > 100) throw refuse('bad_balance');
    const owner = cloud.userId(), ids = new Set();
    const clean = operations.map(p => {
      const id = cleanUuid(p?.id);
      if (!id || p.owner !== owner || ids.has(id) || !Number.isInteger(p.delta) || Math.abs(p.delta) > 100000000
        || !Number.isInteger(p.earned) || p.earned < 0 || p.earned > 100000000) throw refuse('bad_balance');
      const detail = p.detail == null ? null : readCoopRewardDetail(p.detail);
      if (p.detail != null && !detail) throw refuse('bad_balance');
      ids.add(id); return { id, delta: p.delta, earned: p.earned, ...(detail ? { detail } : {}) };
    });
    await call('coop_adjust', { p_ops: clean });
  }
  const wallet = async () => readCoopWallet(await call('coop_wallet', {}));
  async function openWallet(souls, after = 0) {
    if (!Number.isInteger(souls) || souls < 0 || souls > 100000000 || !Number.isSafeInteger(after) || after < 0) throw refuse('bad_balance');
    return readCoopWallet(await call('coop_open', { p_souls: souls, p_after: after }));
  }
  async function receipts(after = 0) {
    if (!Number.isSafeInteger(after) || after < 0) throw refuse('unexpected');
    const owner = cloud.userId();
    return readCoopReceipts(await call('coop_receipts', { p_after: after }), owner);
  }

  return { active, signedIn, userId: () => signedIn() ? cloud.userId() : null, setHires, hireBoard, hire, finishHire, reports, collect,
    duelCreate, duelPlay, duelSubmit, duelDecline, duelRematch, duels, duelClaim, records, receipts, wallet, openWallet, adjustMoney, block: id => social.block(id), report: (id, why) => social.report(id, why) };
}
