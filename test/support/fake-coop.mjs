// The co-op functions of supabase/migrations/0009_coop.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers and the same
// refusals (errcode P0001 with a token as the message); test/coop_sql.test.mjs
// checks the real SQL against the same rules.
//
// Knobs for tests: setDnd(userId, on), age(ms) to move every co-op clock
// back, and the raw maps (listings, hires, duels, records).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PET = /^[A-Za-z0-9_-]{1,100}$/;
const TRAIT = /^[a-z0-9-]{1,24}$/;
export const COOP_CAPS = { frenzy: 3000, stack: 500, seance: 150, whack: 2500 };
const HOUR = 3600000, DAY = 24 * HOUR;
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, max);
const int = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi ? value : null;
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function createFakeCoop({ profiles, now, json, rest, uuid, friendships, blocks }) {
  const listings = new Map(), hires = new Map(), duels = new Map(), records = new Map(), receipts = [], attempts = [], dnd = new Set();
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

  // Labelled in-memory model of the durable owner ledger. Receipt rows survive
  // activity pruning and are immutable: retries return the original event.
  function receipt(owner, kind, source_id, delta, earned = 0) {
    const existing = receipts.find(r => r.owner === owner && r.kind === kind && r.source_id === source_id);
    if (existing) return existing;
    const seq = receipts.filter(r => r.owner === owner).length + 1;
    const r = { id: uuid(), owner, seq, kind, source_id, delta, earned };
    receipts.push(r); return r;
  }

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

  function settle(d, isVoid) {
    if (d.status !== 'open') return;
    for (const r of d.rounds) if (r.status === 'first' || r.status === 'second') r.status = 'void';
    const outcome = isVoid || !d.opponent_staked || !d.rounds.some(r => r.status === 'done') ? 'void'
      : d.wins_challenger > d.wins_opponent ? 'challenger' : d.wins_opponent > d.wins_challenger ? 'opponent' : 'tie';
    Object.assign(d, { status: 'settled', outcome, settled_at: now(), updated_at: now(),
      pay_challenger: outcome === 'challenger' ? 2 * d.stake : outcome === 'opponent' ? 0 : d.stake,
      pay_opponent: !d.opponent_staked ? 0 : outcome === 'opponent' ? 2 * d.stake : outcome === 'challenger' ? 0 : d.stake });
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
    for (const [id, d] of duels) if (d.status === 'settled' && d.settled_at < now() - 60 * DAY && (d.challenger === uid || d.opponent === uid)) duels.delete(id);
    for (const [id, h] of hires) if (h.created_at < now() - 60 * DAY && (h.owner === uid || h.hirer === uid)) hires.delete(id);
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
      h.collected_at ||= now();
      return { ok: true, wages: h.wages, receipt: copy(receipt(user.id, 'hire', h.id, h.wages, h.wages)) };
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
      limit(user.id, 'duel', 10, DAY);
      const d = { id: uuid(), challenger: user.id, opponent: p_to, game: p_game, stake: p_stake, opponent_staked: false, status: 'open', outcome: null,
        wins_challenger: 0, wins_opponent: 0, pay_challenger: 0, pay_opponent: 0, claimed_challenger: false, claimed_opponent: false,
        created_at: now(), updated_at: now(), settled_at: null, rounds: [] };
      d.rounds.push({ n: 1, first_player: user.id, seed: seed(), status: 'first', first_score: null, first_log: null, first_at: null,
        second_started_at: null, second_score: null, second_at: null, created_at: now() });
      duels.set(d.id, d);
      if (d.stake) receipt(user.id, 'stake', d.id, -d.stake);
      return { ok: true, id: d.id, game: d.game, stake: d.stake, round: 1, seed: d.rounds[0].seed };
    },
    coop_duel_play(user, { p_duel }) {
      if (!UUID.test(p_duel || '')) return badType('uuid');
      tidy(user.id);
      const d = duels.get(p_duel);
      if (!d || !(d.challenger === user.id || d.opponent === user.id)) stop('not_found');
      if (d.status !== 'open') stop('not_open');
      if (!friendly(user.id, user.id === d.challenger ? d.opponent : d.challenger)) stop('not_friends');
      const r = latest(d);
      if (r.status === 'first' && r.first_player === user.id) return { ok: true, round: r.n, seed: r.seed, role: 'first', game: d.game, stake: d.stake, ghost: null, against: '' };
      if (r.status !== 'second' || r.first_player === user.id) stop('not_your_turn');
      if (user.id === d.opponent && !d.opponent_staked) {
        if (d.stake) receipt(user.id, 'stake', d.id, -d.stake);
        d.opponent_staked = true;
      }
      if (!r.second_started_at) r.second_started_at = now();
      return { ok: true, round: r.n, seed: r.seed, role: 'second', game: d.game, stake: d.stake, ghost: copy(r.first_log), against: nameOf(r.first_player) };
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
      let owed;
      if (user.id === d.challenger) { owed = d.pay_challenger; d.claimed_challenger = true; }
      else { owed = d.pay_opponent; d.claimed_opponent = true; }
      return { ok: true, souls: owed, receipt: copy(receipt(user.id, 'duel', d.id, owed, Math.max(0, owed - d.stake))) };
    },
    coop_receipts(user, { p_after = 0 } = {}) {
      if (!Number.isSafeInteger(p_after) || p_after < 0) stop('bad_receipt');
      const rows = receipts.filter(r => r.owner === user.id && r.seq > p_after);
      return { receipts: copy(rows.slice(0, 100)), more: rows.length > 100 };
    },
    coop_records(user) {
      return [...records.values()].filter(r => r.user_id === user.id && areFriends(r.user_id, r.friend)).sort((a, b) => b.updated_at - a.updated_at)
        .map(({ user_id, updated_at, ...r }) => ({ ...r }));
    }
  };

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

  return { RPC: wrapped, forget, age, listings, hires, duels, records, receipts, attempts, setDnd(userId, on = true) { if (on) dnd.add(userId); else dnd.delete(userId); } };
}
