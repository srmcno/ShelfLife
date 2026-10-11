// The co-op functions of supabase/migrations/0009_coop.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers and the same
// refusals (errcode P0001 with a token as the message); test/coop_sql.test.mjs
// checks the real SQL against the same rules.
//
// Knobs for tests: setDnd(userId, on), age(ms) to move every co-op clock
// back, and the raw maps (listings, hires, duels, records).
//
// Labelled in-memory model of the production wallet and receipt API. Funding
// checks are strict by default. setStrictFunds(false) is only an explicit
// compatibility fixture for the unreleased prototype; live-path tests use
// the real opening/budget checks. Raw state: wallets, receipts, holds.

import { createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PET = /^[A-Za-z0-9_-]{1,100}$/;
const TRAIT = /^[a-z0-9-]{1,24}$/;
// UUIDv8 from sha256('shelflife.currency.v1:' + lowercase owner + ':' + key), mirroring private.currency_id.
export function currencyId(owner, key) {
  const h = createHash('sha256').update('shelflife.currency.v1:' + String(owner).toLowerCase() + ':' + key, 'utf8').digest().subarray(0, 16);
  h[6] = (h[6] & 0x0f) | 0x80;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const UINT = v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 999999999;
const LOCAL_DAY = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/;
function checkSemantic(owner, id, detail, delta, earned, stop) {
  const reward = detail?.reward;
  let key = null;
  if (reward === 'coven_chest') {
    if (!UINT(detail.week) || !UINT(detail.tier)) stop('bad_op');
    key = `coven_chest:${detail.week}:${detail.tier}`;
  } else if (reward === 'coven_invite') {
    if (typeof detail.userId !== 'string' || !UUID.test(detail.userId)) stop('bad_op');
    key = 'coven_invite:' + detail.userId.toLowerCase();
  } else if (reward === 'joint_bench') {
    if (typeof detail.hearing !== 'string' || !UUID.test(detail.hearing) || !LOCAL_DAY.test(detail.day) || typeof detail.paid !== 'boolean') stop('bad_op');
    if (delta !== (detail.paid ? 25 : 0) || earned !== delta) stop('bad_op');
    key = 'joint_bench:' + detail.hearing.toLowerCase();
  } else if (reward === 'mischief_shoo') {
    if (typeof detail.haunt_id !== 'string' || !UUID.test(detail.haunt_id) || !LOCAL_DAY.test(detail.day) || typeof detail.paid !== 'boolean') stop('bad_op');
    if (!Number.isInteger(detail.taps) || detail.taps < 5 || detail.taps > 99) stop('bad_op');
    if (delta !== (detail.paid ? 15 : 0) || earned !== delta) stop('bad_op');
    key = 'mischief_shoo:' + detail.haunt_id.toLowerCase();
  }
  if (key === null) return;
  if (id !== currencyId(owner, key)) stop('bad_op');
  for (const f of ['curio', 'frame']) {
    if (f in detail && detail[f] !== null && typeof detail[f] !== 'string') stop('bad_op');
    if (typeof detail[f] === 'string' && detail[f].length > 64) stop('bad_op');
  }
}

export const COOP_CAPS = { frenzy: 3000, stack: 500, seance: 150, whack: 2500 };
const HOUR = 3600000, DAY = 24 * HOUR;
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, max);
const int = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi ? value : null;
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function createFakeCoop({ profiles, now, json, rest, uuid, friendships, blocks }) {
  const listings = new Map(), hires = new Map(), duels = new Map(), records = new Map(), attempts = [], dnd = new Set();
  const wallets = new Map(), receipts = [], holds = new Map();
  let strictFunds = true;
  const iso = t => new Date(t).toISOString();
  const day = (t = now()) => new Date(t).toISOString().slice(0, 10);
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const areFriends = (a, b) => friendships.some(f => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const blocked = (a, b) => blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const nameOf = id => profiles.get(id)?.display_name || '';
  const friendly = (uid, other) => !!other && other !== uid && areFriends(uid, other) && !blocked(uid, other);
  class Refusal { constructor(token) { this.token = token; } }
  const stop = token => { throw new Refusal(token); };
  const requests = new Map();

  function limit(uid, kind, max, windowMs) {
    if (attempts.filter(a => a.user === uid && a.kind === kind && a.at > now() - windowMs).length >= max) stop('rate_limited');
    attempts.push({ user: uid, kind, at: now() });
  }

  function cleanResident(p) {
    if (!record(p) || typeof p.id !== 'string' || !PET.test(p.id)) stop('bad_resident');
    if (size(p) >= 140000) stop('too_large');
    const traits = p.traits === undefined || p.traits === null ? [] : p.traits;
    if (!Array.isArray(traits) || traits.length > 6 || traits.some(t => typeof t !== 'string' || !TRAIT.test(t))) stop('bad_resident');
    if (!record(p.stats)) stop('bad_resident');
    const stats = {};
    for (const k of ['cute', 'menace', 'damp', 'mystique']) { const n = int(p.stats[k], 1, 10); if (n === null) stop('bad_resident'); stats[k] = n; }
    if (!record(p.art)) stop('bad_resident');
    return { id: p.id, name: clean(p.name, 22) || 'Someone', traits: [...traits], stats, art: copy(p.art) };
  }

  function cleanReport(p) {
    const ok = record(p) && size(p) < 2000 && ['drawer', 'fridge', 'cupboard'].includes(p.route) && ['thread', 'lantern', 'biscuit'].includes(p.gear)
      && int(p.edition, 0, 7) !== null && int(p.rev, 1, 2) !== null && int(p.score, 0, 12) !== null && int(p.tier, 0, 2) !== null
      && int(p.returned, 0, 2) !== null && typeof p.built === 'boolean'
      && Array.isArray(p.choices) && p.choices.length >= 1 && p.choices.length <= 3 && p.choices.every(c => int(c, 0, 2) !== null)
      && (p.helped == null || (Array.isArray(p.helped) && p.helped.length <= 3 && p.helped.every(h => int(h, 0, 2) !== null)))
      && (p.crew == null || (Array.isArray(p.crew) && p.crew.length <= 2 && p.crew.every(c => typeof c === 'string')));
    if (!ok) stop('bad_report');
    return { v: 1, route: p.route, gear: p.gear, edition: p.edition, rev: p.rev, score: p.score, tier: p.tier, returned: p.returned, built: p.built,
      choices: [...p.choices], helped: [...new Set(p.helped || [])].sort((a, b) => a - b), crew: (p.crew || []).map(c => clean(c, 22) || 'Someone') };
  }

  const wages = (owner, tier) => Math.max(0, Math.min(6 + 3 * (tier || 0),
    30 - [...hires.values()].filter(h => h.owner === owner && h.wage_day === day()).reduce((n, h) => n + h.wages, 0)));

  const recordOf = (a, b) => { const key = a + '|' + b; if (!records.has(key)) records.set(key, { user_id: a, friend: b, duels_won: 0, duels_lost: 0, duels_tied: 0, rounds_won: 0, rounds_lost: 0, streak: 0, best_streak: 0, trips: 0, updated_at: now() }); return records.get(key); };
  function roundRecord(winner, loser) {
    const w = recordOf(winner, loser), l = recordOf(loser, winner);
    w.rounds_won++; w.streak++; w.best_streak = Math.max(w.best_streak, w.streak); w.updated_at = now();
    l.rounds_lost++; l.streak = 0; l.updated_at = now();
  }
  function seriesRecord(a, b, outcome) {
    const x = recordOf(a, b), y = recordOf(b, a);
    if (outcome === 'a') { x.duels_won++; y.duels_lost++; } else if (outcome === 'b') { x.duels_lost++; y.duels_won++; } else { x.duels_tied++; y.duels_tied++; }
    x.updated_at = y.updated_at = now();
  }

  // Labelled in-memory ledger, mirroring private.coop_append. Receipt rows
  // survive activity pruning and retries answer the same immutable event.
  const walletOf = owner => {
    if (!wallets.has(owner)) wallets.set(owner, { owner, opening: null, opening_seq: 0, opening_base: 0, last_seq: 0, total: 0, opened_at: null });
    return wallets.get(owner);
  };
  const available = owner => { const w = wallets.get(owner); return w && w.opening !== null ? w.opening + (w.total - w.opening_base) : null; };
  const receiptOf = (owner, kind, source) => receipts.find(r => r.owner === owner && r.kind === kind && r.source_id === source) || null;
  const receiptJson = r => r ? { id: r.id, owner: r.owner, seq: r.seq, kind: r.kind, source_id: r.source_id, delta: r.delta, earned: r.earned,
    created_at: iso(r.created_at), detail: copy(r.detail) } : null;
  function append(owner, kind, source, delta, earned, detail) {
    const had = receiptOf(owner, kind, source);
    if (had) return had;
    const w = walletOf(owner);
    w.last_seq++; w.total += delta;
    const r = { id: uuid(), owner, seq: w.last_seq, kind, source_id: source, delta, earned, created_at: now(), detail: copy(detail) };
    receipts.push(r);
    return r;
  }
  const holdsOf = d => [...holds.values()].filter(h => h.duel_id === d.id);
  const duelDetail = (owner, d) => {
    const other = d.challenger === owner ? d.opponent : d.challenger;
    return { duel_id: d.id, game: d.game, stake: d.stake, against: other, against_name: blocked(d.challenger, d.opponent) ? '' : nameOf(other),
      outcome: d.outcome, wins_mine: d.challenger === owner ? d.wins_challenger : d.wins_opponent,
      wins_theirs: d.challenger === owner ? d.wins_opponent : d.wins_challenger };
  };
  const hireDetail = h => {
    const hidden = blocked(h.owner, h.hirer), report = copy(h.report);
    if (hidden && report) delete report.crew;
    return { hire_id: h.id, pet_id: h.pet_id, name: h.resident.name, hirer: h.hirer, hirer_name: hidden ? '' : nameOf(h.hirer), report,
      wages: h.wages, finished_at: h.finished_at ? iso(h.finished_at) : null };
  };
  // Checks the funds and holds the stake; the caller adds the duel only if this does not refuse.
  function checkStake(owner, amount) {
    if (!(amount > 0)) return;
    const have = available(owner);
    if (have === null) { if (strictFunds) stop('needs_opening'); return; }
    if (have < amount) stop('insufficient_souls');
  }
  function stake(owner, d, amount) {
    if (!(amount > 0)) return null;
    const r = append(owner, 'stake', d.id, -amount, 0, duelDetail(owner, d));
    const key = d.id + '|' + owner;
    if (!holds.has(key)) holds.set(key, { duel_id: d.id, owner, amount, stake_receipt: r.id, released_at: null, released_to: null, release_receipt: null, created_at: now() });
    return r;
  }

  function settle(d, isVoid) {
    if (d.status !== 'open') return;
    for (const r of d.rounds) if (r.status === 'first' || r.status === 'second') r.status = 'void';
    const outcome = isVoid || !d.opponent_staked || !d.rounds.some(r => r.status === 'done') ? 'void'
      : d.wins_challenger > d.wins_opponent ? 'challenger' : d.wins_opponent > d.wins_challenger ? 'opponent' : 'tie';
    const held = holdsOf(d), hc = held.filter(h => h.owner === d.challenger).reduce((n, h) => n + h.amount, 0);
    const ho = held.filter(h => h.owner === d.opponent).reduce((n, h) => n + h.amount, 0);
    Object.assign(d, { status: 'settled', outcome, settled_at: now(), updated_at: now(),
      pay_challenger: outcome === 'challenger' ? hc + ho : outcome === 'opponent' ? 0 : hc,
      pay_opponent: outcome === 'opponent' ? hc + ho : outcome === 'challenger' ? 0 : ho });
    if (outcome !== 'void') seriesRecord(d.challenger, d.opponent, outcome === 'challenger' ? 'a' : outcome === 'opponent' ? 'b' : 'tie');
  }
  function finishRound(d, r, score) {
    if (r.status !== 'second') return;
    const second = r.first_player === d.challenger ? d.opponent : d.challenger;
    Object.assign(r, { status: 'done', second_score: score, second_at: now() });
    const win = who => { if (who === d.challenger) d.wins_challenger++; else d.wins_opponent++; };
    if (score > r.first_score) { roundRecord(second, r.first_player); win(second); }
    else if (score < r.first_score) { roundRecord(r.first_player, second); win(r.first_player); }
    d.updated_at = now();
    if (Math.max(d.wins_challenger, d.wins_opponent) >= 2 || r.n >= 3) settle(d, false);
  }

  function tidy(uid) {
    for (const h of hires.values()) {
      if (h.status === 'out' && h.created_at <= now() - 72 * HOUR && (h.owner === uid || h.hirer === uid)) {
        Object.assign(h, { status: 'back', finished_at: now(), wage_day: day(), wages: wages(h.owner, 0) });
      }
    }
    for (const d of duels.values()) {
      if (d.status !== 'open' || !(d.challenger === uid || d.opponent === uid)) continue;
      for (const r of d.rounds) {
        if (r.status === 'first' && r.created_at <= now() - 48 * HOUR) r.status = 'void';
        else if (r.status === 'second' && r.first_at <= now() - 48 * HOUR) {
          if (r.second_started_at) finishRound(d, r, 0); else r.status = 'void';
        }
      }
    }
    for (const d of duels.values()) {
      if (d.status !== 'open' || !(d.challenger === uid || d.opponent === uid)) continue;
      if (!areFriends(d.challenger, d.opponent) || blocked(d.challenger, d.opponent)) { settle(d, true); continue; }
      const last = d.rounds.at(-1);
      if (last.status === 'void' || (last.status === 'done' && last.second_at <= now() - 48 * HOUR)) settle(d, false);
    }
    for (const [id, d] of duels) {
      if (d.status === 'settled' && d.settled_at < now() - 60 * DAY && (d.challenger === uid || d.opponent === uid) && !holdsOf(d).some(h => !h.released_at)) {
        duels.delete(id);
        for (const h of holdsOf(d)) holds.delete(h.duel_id + '|' + h.owner);
      }
    }
    for (const [id, h] of hires) {
      if (h.created_at < now() - 60 * DAY && (h.owner === uid || h.hirer === uid) && h.status === 'back' && (h.collected_at || h.wages === 0)) hires.delete(id);
    }
    for (let i = attempts.length - 1; i >= 0; i--) if (attempts[i].user === uid && attempts[i].at < now() - DAY) attempts.splice(i, 1);
  }

  const seed = () => 1 + Math.floor(Math.random() * 2147483646);
  const latest = d => d.rounds.at(-1);
  const isDnd = id => dnd.has(id);

  const RPC = {
    coop_set_hires(user, { p_residents }) {
      if (!Array.isArray(p_residents) || p_residents.length > 2) stop('bad_resident');
      limit(user.id, 'list', 30, HOUR);
      for (const key of [...listings.keys()]) if (key.startsWith(user.id + '|')) listings.delete(key);
      const ids = [];
      for (const item of p_residents) {
        const r = cleanResident(item);
        if (ids.includes(r.id)) stop('bad_resident');
        ids.push(r.id);
        listings.set(user.id + '|' + r.id, { owner: user.id, pet_id: r.id, resident: r, updated_at: now() + ids.length });
      }
      return { ok: true, listed: ids };
    },
    coop_hire_board(user) {
      tidy(user.id);
      const today = day(), hired = [...hires.values()].some(h => h.hirer === user.id && h.day === today);
      const rows = [...listings.values()].filter(l => l.owner !== user.id && areFriends(user.id, l.owner) && !blocked(user.id, l.owner))
        .map(l => {
          const trips = [...hires.values()].filter(h => h.owner === l.owner && h.pet_id === l.pet_id && h.day === today).length;
          return { owner: l.owner, owner_name: nameOf(l.owner), pet_id: l.pet_id, resident: copy(l.resident), trips_today: trips,
            available: !hired && trips < 3 && !isDnd(l.owner) };
        })
        .sort((a, b) => a.owner_name.toLowerCase().localeCompare(b.owner_name.toLowerCase()) || a.owner.localeCompare(b.owner) || a.pet_id.localeCompare(b.pet_id))
        .slice(0, 40);
      return { hired_today: hired, listings: rows };
    },
    coop_hire(user, { p_owner, p_pet }) {
      if (!UUID.test(p_owner || '')) return badType('uuid');
      if (!friendly(user.id, p_owner)) stop('not_friends');
      if (isDnd(p_owner)) stop('dnd');
      const l = listings.get(p_owner + '|' + p_pet);
      if (!l) stop('not_for_hire');
      const today = day();
      if ([...hires.values()].some(h => h.hirer === user.id && h.day === today)) stop('hired_today');
      if ([...hires.values()].filter(h => h.owner === p_owner && h.pet_id === p_pet && h.day === today).length >= 3) stop('fully_booked');
      const h = { id: uuid(), owner: p_owner, hirer: user.id, pet_id: p_pet, resident: copy(l.resident), day: today, status: 'out', report: null,
        wages: 0, created_at: now(), finished_at: null, wage_day: null, collected_at: null };
      hires.set(h.id, h);
      return { ok: true, id: h.id, owner: p_owner, owner_name: nameOf(p_owner), resident: copy(h.resident) };
    },
    coop_finish_hire(user, { p_hire, p_report }) {
      if (!UUID.test(p_hire || '')) return badType('uuid');
      const report = cleanReport(p_report);
      tidy(user.id);
      const h = hires.get(p_hire);
      if (!h || h.hirer !== user.id) stop('not_found');
      if (h.status !== 'out') stop('not_open');
      const pay = wages(h.owner, report.tier);
      Object.assign(h, { status: 'back', report, wages: pay, finished_at: now(), wage_day: day() });
      recordOf(h.owner, user.id).trips++; recordOf(user.id, h.owner).trips++;
      return { ok: true, wages: pay };
    },
    coop_reports(user) {
      tidy(user.id);
      const today = day(), mine = [...hires.values()].filter(h => h.owner === user.id);
      return {
        listed: [...listings.values()].filter(l => l.owner === user.id).sort((a, b) => a.updated_at - b.updated_at)
          .map(l => ({ pet_id: l.pet_id, name: l.resident.name, trips_today: mine.filter(h => h.pet_id === l.pet_id && h.day === today).length })),
        away: mine.filter(h => h.status === 'out' && !blocked(user.id, h.hirer)).sort((a, b) => b.created_at - a.created_at)
          .map(h => ({ id: h.id, pet_id: h.pet_id, name: h.resident.name, hirer: h.hirer, hirer_name: nameOf(h.hirer), since: iso(h.created_at) })),
        reports: mine.filter(h => h.status === 'back' && !h.collected_at).sort((a, b) => b.finished_at - a.finished_at).slice(0, 20)
          .map(h => {
            const hidden = blocked(user.id, h.hirer), report = copy(h.report);
            if (hidden && report) delete report.crew;
            return { id: h.id, hirer: h.hirer, hirer_name: hidden ? '' : nameOf(h.hirer), pet_id: h.pet_id, name: h.resident.name, report,
              wages: h.wages, finished_at: iso(h.finished_at) };
          })
      };
    },
    coop_collect(user, { p_hire }) {
      if (!UUID.test(p_hire || '')) return badType('uuid');
      const h = hires.get(p_hire);
      if (!h || h.owner !== user.id) stop('not_found');
      if (h.status !== 'back') stop('not_open');
      const had = receiptOf(user.id, 'hire', h.id);
      if (had || h.collected_at) return { ok: true, wages: 0, receipt: receiptJson(had) };
      const r = append(user.id, 'hire', h.id, h.wages, h.wages, hireDetail(h));
      h.collected_at = now();
      return { ok: true, wages: h.wages, receipt: receiptJson(r) };
    },
    coop_duel_create(user, { p_to, p_game, p_stake }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      if (p_stake !== null && p_stake !== undefined && !Number.isInteger(p_stake)) return badType('integer');
      if (!friendly(user.id, p_to)) stop('not_friends');
      if (isDnd(p_to)) stop('dnd');
      if (!COOP_CAPS[p_game]) stop('bad_game');
      if (!(p_stake >= 0 && p_stake <= 25)) stop('bad_stake');
      tidy(user.id);
      const open = [...duels.values()].filter(d => d.status === 'open');
      if (open.filter(d => d.challenger === user.id && d.opponent === p_to).length >= 3 || open.filter(d => d.challenger === user.id || d.opponent === user.id).length >= 12) stop('too_many_open');
      checkStake(user.id, p_stake);
      limit(user.id, 'duel', 10, DAY);
      const d = { id: uuid(), challenger: user.id, opponent: p_to, game: p_game, stake: p_stake, opponent_staked: false, status: 'open', outcome: null,
        wins_challenger: 0, wins_opponent: 0, pay_challenger: 0, pay_opponent: 0, claimed_challenger: false, claimed_opponent: false,
        created_at: now(), updated_at: now(), settled_at: null, rounds: [] };
      d.rounds.push({ n: 1, first_player: user.id, seed: seed(), status: 'first', first_score: null, first_log: null, first_at: null,
        second_started_at: null, second_score: null, second_at: null, created_at: now() });
      duels.set(d.id, d);
      const r = stake(user.id, d, d.stake);
      return { ok: true, id: d.id, game: d.game, stake: d.stake, round: 1, seed: d.rounds[0].seed, receipt: receiptJson(r) };
    },
    coop_duel_play(user, { p_duel }) {
      if (!UUID.test(p_duel || '')) return badType('uuid');
      tidy(user.id);
      const d = duels.get(p_duel);
      if (!d || !(d.challenger === user.id || d.opponent === user.id)) stop('not_found');
      if (d.status !== 'open') stop('not_open');
      if (!friendly(user.id, user.id === d.challenger ? d.opponent : d.challenger)) stop('not_friends');
      const r = latest(d);
      if (r.status === 'first' && r.first_player === user.id) return { ok: true, round: r.n, seed: r.seed, role: 'first', game: d.game, stake: d.stake, ghost: null, against: '',
        receipt: receiptJson(receiptOf(user.id, 'stake', d.id)) };
      if (r.status !== 'second' || r.first_player === user.id) stop('not_your_turn');
      if (user.id === d.opponent && !d.opponent_staked) { checkStake(user.id, d.stake); stake(user.id, d, d.stake); d.opponent_staked = true; }
      if (!r.second_started_at) r.second_started_at = now();
      return { ok: true, round: r.n, seed: r.seed, role: 'second', game: d.game, stake: d.stake, ghost: copy(r.first_log), against: nameOf(r.first_player),
        receipt: receiptJson(receiptOf(user.id, 'stake', d.id)) };
    },
    coop_duel_submit(user, { p_duel, p_round, p_score, p_log = null }) {
      if (!UUID.test(p_duel || '')) return badType('uuid');
      if (![p_round, p_score].every(n => n === null || n === undefined || Number.isInteger(n))) return badType('integer');
      tidy(user.id);
      const d = duels.get(p_duel);
      if (!d || !(d.challenger === user.id || d.opponent === user.id)) stop('not_found');
      if (!(p_score >= 0 && p_score <= COOP_CAPS[d.game])) stop('bad_score');
      if (d.status !== 'open') stop('not_open');
      const r = d.rounds.find(x => x.n === p_round);
      if (!r) stop('not_found');
      if (r.status === 'first' && r.first_player === user.id) {
        if (p_log !== null && (!record(p_log) || size(p_log) >= 38000 || p_log.game !== d.game || !Array.isArray(p_log.inputs))) stop('bad_log');
        Object.assign(r, { status: 'second', first_score: p_score, first_log: copy(p_log), first_at: now() });
        d.updated_at = now();
        return { ok: true, round: p_round, status: 'second' };
      }
      if (r.status !== 'second' || r.first_player === user.id || !r.second_started_at) stop('not_your_turn');
      const first = r.first_score;
      finishRound(d, r, p_score);
      return { ok: true, round: p_round, status: 'done', first_score: first, second_score: p_score,
        wins_challenger: d.wins_challenger, wins_opponent: d.wins_opponent, settled: d.status === 'settled', outcome: d.outcome };
    },
    coop_duel_decline(user, { p_duel }) {
      if (!UUID.test(p_duel || '')) return badType('uuid');
      const d = duels.get(p_duel);
      if (!d || !(d.challenger === user.id || d.opponent === user.id)) stop('not_found');
      if (d.status !== 'open') stop('not_open');
      const r = latest(d);
      if (!((r.status === 'second' && r.first_player !== user.id && !r.second_started_at) || (r.status === 'first' && r.first_player === user.id))) stop('not_your_turn');
      r.status = 'void';
      settle(d, false);
      return { ok: true };
    },
    coop_duel_rematch(user, { p_duel }) {
      if (!UUID.test(p_duel || '')) return badType('uuid');
      tidy(user.id);
      const d = duels.get(p_duel);
      if (!d || !(d.challenger === user.id || d.opponent === user.id)) stop('not_found');
      if (!friendly(user.id, user.id === d.challenger ? d.opponent : d.challenger)) stop('not_friends');
      const r = latest(d);
      if (d.status !== 'open' || r.status !== 'done' || r.n >= 3) stop('not_open');
      const next = { n: r.n + 1, first_player: user.id, seed: seed(), status: 'first', first_score: null, first_log: null, first_at: null,
        second_started_at: null, second_score: null, second_at: null, created_at: now() };
      d.rounds.push(next); d.updated_at = now();
      return { ok: true, round: next.n, seed: next.seed };
    },
    coop_duels(user) {
      tidy(user.id);
      const uid = user.id;
      return [...duels.values()].filter(d => (d.challenger === uid || d.opponent === uid)
          && (d.status === 'open' || (d.settled_at > now() - 14 * DAY && !(uid === d.challenger ? d.claimed_challenger : d.claimed_opponent)))
          && (d.status !== 'open' || !blocked(d.challenger, d.opponent)))
        .sort((a, b) => b.updated_at - a.updated_at).slice(0, 30)
        .map(d => ({ id: d.id, challenger: d.challenger, opponent: d.opponent,
          challenger_name: blocked(uid, d.challenger) ? '' : nameOf(d.challenger), opponent_name: blocked(uid, d.opponent) ? '' : nameOf(d.opponent),
          game: d.game, stake: d.stake, opponent_staked: d.opponent_staked, status: d.status, outcome: d.outcome,
          wins_challenger: d.wins_challenger, wins_opponent: d.wins_opponent,
          payout: uid === d.challenger ? d.pay_challenger : d.pay_opponent, claimed: uid === d.challenger ? d.claimed_challenger : d.claimed_opponent,
          created_at: iso(d.created_at), updated_at: iso(d.updated_at), settled_at: d.settled_at ? iso(d.settled_at) : null,
          rounds: d.rounds.map(r => ({ n: r.n, first_player: r.first_player, status: r.status,
            first_score: r.status === 'done' || r.first_player === uid ? r.first_score : null, second_score: r.status === 'done' ? r.second_score : null,
            started: !!r.second_started_at, created_at: iso(r.created_at), first_at: r.first_at ? iso(r.first_at) : null, second_at: r.second_at ? iso(r.second_at) : null })) }));
    },
    coop_duel_claim(user, { p_duel }) {
      if (!UUID.test(p_duel || '')) return badType('uuid');
      tidy(user.id);
      const d = duels.get(p_duel);
      if (!d || !(d.challenger === user.id || d.opponent === user.id)) stop('not_found');
      if (d.status !== 'settled') stop('not_open');
      const had = receiptOf(user.id, 'duel', d.id);
      if (had) return { ok: true, souls: 0, receipt: receiptJson(had) };
      const won = d.outcome === (user.id === d.challenger ? 'challenger' : 'opponent');
      const mine = holdsOf(d).filter(h => !h.released_at && (won || (h.owner === user.id && (d.outcome === 'void' || d.outcome === 'tie'))));
      const owed = mine.reduce((n, h) => n + h.amount, 0), own = mine.filter(h => h.owner === user.id).reduce((n, h) => n + h.amount, 0);
      // Every settlement leaves a receipt, a zero one when nothing is owed.
      const r = append(user.id, 'duel', d.id, owed, owed > 0 ? owed - own : 0, duelDetail(user.id, d));
      if (owed > 0) for (const h of mine) Object.assign(h, { released_at: now(), released_to: user.id, release_receipt: r.id });
      if (user.id === d.challenger) d.claimed_challenger = true; else d.claimed_opponent = true;
      return { ok: true, souls: owed, receipt: receiptJson(r) };
    },
    coop_open(user, { p_souls, p_after }) {
      if (p_souls !== null && p_souls !== undefined && !Number.isInteger(p_souls)) return badType('integer');
      if (p_after !== null && p_after !== undefined && !Number.isInteger(p_after)) return badType('bigint');
      if (p_souls === null || p_souls === undefined) stop('bad_balance');
      if (p_after === null || p_after === undefined || p_after < 0) stop('bad_seq');
      const w = walletOf(user.id);
      let accepted = false;
      if (w.opening === null) {
        const seq = Math.min(p_after, w.last_seq);
        Object.assign(w, { opening: Math.min(Math.max(p_souls, 0), 100000000), opening_seq: seq,
          opening_base: receipts.filter(r => r.owner === user.id && r.seq <= seq).reduce((n, r) => n + r.delta, 0), opened_at: now() });
        accepted = true;
      }
      return { ...walletJson(user.id), accepted };
    },
    coop_wallet(user) { return walletJson(user.id); },
    // Mirrors souls earned or spent elsewhere (one shared purse). Idempotent per id and payload; a spend may leave debt.
    coop_adjust(user, { p_ops }) {
      if (!Array.isArray(p_ops) || p_ops.length < 1 || p_ops.length > 100) stop('bad_op');
      const w = walletOf(user.id);
      if (w.opening === null) stop('needs_opening');
      const staged = [];
      const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
      for (const item of p_ops) {
        if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(k => !['id', 'delta', 'earned', 'detail'].includes(k))) stop('bad_op');
        if (typeof item.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(item.id)) stop('bad_op');
        if (!Number.isInteger(item.delta) || Math.abs(item.delta) > 100000000) stop('bad_op');
        if (!Number.isInteger(item.earned) || item.earned < 0 || item.earned > 100000000) stop('bad_op');
        const detail = item.detail === undefined || item.detail === null ? null : item.detail;
        if (detail !== null && (typeof detail !== 'object' || Array.isArray(detail) || JSON.stringify(detail).length > 4096)) stop('bad_op');
        checkSemantic(user.id, item.id, detail, item.delta, item.earned, stop);
        const req = { delta: item.delta, earned: item.earned, detail };
        const had = receiptOf(user.id, 'game', item.id);
        const inBatch = staged.find(x => x.id === item.id);
        if (had || inBatch) {
          const asked = had ? (requests.get(had.id) ?? { delta: had.delta, earned: had.earned, detail: had.detail ?? null }) : inBatch.req;
          if (!same(asked, req)) stop('bad_op');
          staged.push({ id: item.id, same: true, req });
          continue;
        }
        staged.push({ id: item.id, delta: item.delta, earned: item.earned, detail, req });
      }
      const out = staged.map(x => {
        if (x.same) return receiptOf(user.id, 'game', x.id);
        let { delta, earned, detail } = x;
        // At most 3 paid Joint Bench rewards a local day: the rest are canonical unpaid.
        if (detail?.reward === 'joint_bench' && detail.paid === true) {
          const paid = receipts.filter(r => r.owner === user.id && r.kind === 'game' && r.detail?.reward === 'joint_bench' && r.detail.day === detail.day && r.detail.paid === true).length;
          if (paid >= 3) { detail = { ...detail, paid: false }; delta = 0; earned = 0; }
        }
        const r = append(user.id, 'game', x.id, delta, earned, detail);
        requests.set(r.id, x.req);
        return r;
      });
      return { ok: true, receipts: out.map(receiptJson), balance: available(user.id), last_seq: w.last_seq };
    },
    coop_receipts(user, { p_after = 0 } = {}) {
      if (p_after !== null && p_after !== undefined && !Number.isInteger(p_after)) return badType('bigint');
      const after = Math.max(p_after || 0, 0);
      const mine = receipts.filter(r => r.owner === user.id && r.seq > after).sort((a, b) => a.seq - b.seq);
      return { ok: true, receipts: mine.slice(0, 100).map(receiptJson), has_more: mine.length > 100, last_seq: wallets.get(user.id)?.last_seq || 0 };
    },
    coop_records(user) {
      return [...records.values()].filter(r => r.user_id === user.id && areFriends(r.user_id, r.friend)).sort((a, b) => b.updated_at - a.updated_at)
        .map(({ user_id, updated_at, ...r }) => ({ ...r }));
    }
  };

  function walletJson(owner) {
    const w = wallets.get(owner);
    return { ok: true, opening: w ? w.opening : null, opening_seq: w ? w.opening_seq : 0, balance: available(owner), last_seq: w ? w.last_seq : 0 };
  }

  // Every function answers through json(), and a refusal becomes the same
  // P0001 error the database raises.
  const wrapped = Object.fromEntries(Object.entries(RPC).map(([name, fn]) => [name, (user, input = {}) => {
    try {
      const out = fn(user, input);
      return out && typeof out.status === 'number' && 'body' in out ? out : json(200, out);
    } catch (error) {
      if (error instanceof Refusal) return refuse(error.token);
      throw error;
    }
  }]));

  function forget(userId) {
    for (const [key, l] of listings) if (l.owner === userId) listings.delete(key);
    for (const [id, h] of hires) if (h.owner === userId || h.hirer === userId) hires.delete(id);
    for (const [id, d] of duels) if (d.challenger === userId || d.opponent === userId) duels.delete(id);
    for (const [key, r] of records) if (r.user_id === userId || r.friend === userId) records.delete(key);
    for (let i = attempts.length - 1; i >= 0; i--) if (attempts[i].user === userId) attempts.splice(i, 1);
    wallets.delete(userId);
    for (let i = receipts.length - 1; i >= 0; i--) if (receipts[i].owner === userId) receipts.splice(i, 1);
    for (const [key, h] of holds) if (h.owner === userId || !duels.has(h.duel_id)) holds.delete(key);
  }
  // Moves every co-op clock back, as if `ms` had passed.
  function age(ms) {
    for (const h of hires.values()) for (const k of ['created_at', 'finished_at']) if (h[k]) h[k] -= ms;
    for (const h of hires.values()) if (h.day) h.day = new Date(Date.parse(h.day) - Math.floor(ms / DAY) * DAY).toISOString().slice(0, 10);
    for (const d of duels.values()) {
      for (const k of ['created_at', 'updated_at', 'settled_at']) if (d[k]) d[k] -= ms;
      for (const r of d.rounds) for (const k of ['created_at', 'first_at', 'second_started_at', 'second_at']) if (r[k]) r[k] -= ms;
    }
  }

  return { RPC: wrapped, forget, age, listings, hires, duels, records, attempts, wallets, receipts, holds,
    setDnd(userId, on = true) { if (on) dnd.add(userId); else dnd.delete(userId); },
    setStrictFunds(on = true) { strictFunds = !!on; } };
}
