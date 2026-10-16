// The Joint Bench functions of supabase/migrations/0005_joint_court.sql, in
// memory, for test/support/fake-supabase.mjs. Same arguments, same answers,
// same refusals (errcode P0001 with a token as the message). The triggers on
// blocks and friendships are mirrored by wrapping block_user and
// remove_friend. test/hearings_sql.test.mjs checks the real SQL against the
// same rules.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE = /^[a-z0-9-]{1,40}$/;
const RULINGS = ['plaintiff', 'defendant', 'both'];
const DAY = 86400000;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const copy = value => JSON.parse(JSON.stringify(value));
const isNumber = value => typeof value === 'number' && Number.isFinite(value);

export function attachFakeHearings({ RPC, social, profiles, now, json, rest, uuid }) {
  const rows = new Map(), records = new Map();
  const iso = (t = now()) => new Date(t).toISOString();
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const areFriends = (a, b) => social.friendships.some(f => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const blockedEither = (a, b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const nameOf = id => profiles.get(id)?.display_name || '';
  const between = (h, a, b) => (h.from_user === a && h.to_user === b) || (h.from_user === b && h.to_user === a);
  const statusOf = h => (h.status === 'open' && Date.parse(h.expires_at) <= now() ? 'expired' : h.status);
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

  function cleanRuling(p) {
    if (!record(p) || !RULINGS.includes(p.ruling) || !RULINGS.includes(p.truth)) return null;
    if (![p.stars, p.ratings, p.agree, p.dissent].every(isNumber)) return null;
    if (![0, 1, 2, 3].includes(p.stars) || !(p.ratings >= 0 && p.ratings <= 100) || p.ratings !== Math.floor(p.ratings)) return null;
    if (![0, 1, 2, 3, 4, 5, 6].includes(p.agree) || ![0, 1, 2, 3, 4, 5, 6].includes(p.dissent) || p.agree + p.dissent > 6) return null;
    return { ruling: p.ruling, truth: p.truth, stars: p.stars, ratings: p.ratings, agree: p.agree, dissent: p.dissent };
  }
  function cleanMarks(p) {
    if (!Array.isArray(p)) return [];
    return p.filter(m => record(m) && typeof m.at === 'string' && /^[a-z0-9:-]{1,24}$/.test(m.at) && ['laugh', 'gasp', 'gavel'].includes(m.r) &&
      Number.isInteger(m.ms) && m.ms >= 0 && m.ms <= 20000).slice(0, 40).map(m => ({ at: m.at, r: m.r, ms: m.ms }));
  }
  function castProblem(p) {
    if (!record(p) || !record(p.p) || !record(p.d) || !Array.isArray(p.jury) || (p.witnesses !== undefined && !Array.isArray(p.witnesses))) return 'bad_cast';
    if (p.jury.length > 6 || (p.witnesses || []).length > 3) return 'bad_cast';
    if (size(p) >= 150000) return 'too_large';
    return null;
  }
  // private.hearing_json: the one place that decides what a judge sees.
  function view(h, uid, full) {
    const role = h.from_user === uid ? 'first' : 'second', status = statusOf(h);
    const other = role === 'first' ? h.to_user : h.from_user;
    const out = {
      id: h.id, kind: h.kind, role, other_user: other, other_name: nameOf(other), case_id: h.case_id, twist: h.twist, seed: h.seed, status,
      created_at: h.created_at, expires_at: h.expires_at, ruled_at: h.ruled_at,
      mine: copy(role === 'first' ? h.first_ruling : h.second_ruling),
      theirs: status === 'revealed' ? copy(role === 'first' ? h.second_ruling : h.first_ruling) : null,
      alone: role === 'first' && status === 'expired',
      seen: role === 'first' ? !!h.first_seen_at : !!h.second_seen_at
    };
    if (full) Object.assign(out, {
      cast: copy(h.cast_snapshot),
      their_marks: copy(role === 'second' ? h.first_marks : status === 'revealed' ? h.second_marks : []),
      my_marks: copy(role === 'first' ? h.first_marks : h.second_marks)
    });
    return out;
  }
  const at = h => h.ruled_at || h.created_at;

  const HEARING_RPC = {
    open_hearing(user, { p_to, p_kind, p_case, p_twist, p_seed, p_cast, p_ruling, p_marks }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      if (p_seed !== null && p_seed !== undefined && !Number.isInteger(p_seed)) return badType('integer');
      if (p_to === user.id || !areFriends(user.id, p_to) || blockedEither(user.id, p_to)) return refuse('not_friends');
      if (!['served', 'invite'].includes(p_kind)) return refuse('bad_hearing');
      if (typeof p_case !== 'string' || !CASE.test(p_case)) return refuse('bad_case');
      if (p_twist && (typeof p_twist !== 'string' || !CASE.test(p_twist))) return refuse('bad_hearing');
      if (!(p_seed >= 1 && p_seed <= 2147483647)) return refuse('bad_hearing');
      const problem = castProblem(p_cast);
      if (problem) return refuse(problem);
      const ruling = cleanRuling(p_ruling);
      if (!ruling) return refuse('bad_ruling');
      const all = [...rows.values()];
      if (all.filter(h => h.from_user === user.id && Date.parse(h.created_at) > now() - DAY).length >= 20) return refuse('rate_limited');
      if (all.filter(h => between(h, user.id, p_to) && h.status === 'open' && Date.parse(h.expires_at) > now()).length >= 5) return refuse('too_many_open');
      for (const [id, h] of rows) if ((h.from_user === user.id || h.to_user === user.id) && Date.parse(h.created_at) < now() - 90 * DAY) rows.delete(id);
      const h = { id: uuid(), from_user: user.id, to_user: p_to, kind: p_kind, case_id: p_case, twist: p_twist || null, seed: p_seed,
        cast_snapshot: copy(p_cast), status: 'open', first_ruling: ruling, first_marks: cleanMarks(p_marks), second_ruling: null, second_marks: [],
        created_at: iso(), expires_at: iso(now() + 14 * DAY), ruled_at: null, first_seen_at: null, second_seen_at: null };
      rows.set(h.id, h);
      return json(200, { ok: true, id: h.id, created_at: h.created_at, expires_at: h.expires_at });
    },
    rule_hearing(user, { p_id, p_ruling, p_marks }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const ruling = cleanRuling(p_ruling);
      if (!ruling) return refuse('bad_ruling');
      const h = rows.get(p_id);
      if (!h || h.to_user !== user.id || blockedEither(h.from_user, h.to_user)) return refuse('not_found');
      if (statusOf(h) !== 'open') return refuse('not_open');
      if (!areFriends(h.from_user, h.to_user)) return refuse('not_friends');
      Object.assign(h, { second_ruling: ruling, second_marks: cleanMarks(p_marks), status: 'revealed', ruled_at: iso(), second_seen_at: iso() });
      const agreed = h.first_ruling.truth === h.second_ruling.truth;
      const firstRight = agreed && h.first_ruling.ruling === h.first_ruling.truth, secondRight = agreed && h.second_ruling.ruling === h.second_ruling.truth;
      const key = pairKey(h.from_user, h.to_user), [a] = key.split('|');
      const r = records.get(key) || { hearings: 0, full_benches: 0, a_right: 0, b_right: 0, updated_at: iso() };
      r.hearings++;
      if (firstRight && secondRight) r.full_benches++;
      if ((h.from_user === a && firstRight) || (h.to_user === a && secondRight)) r.a_right++;
      if ((h.from_user !== a && firstRight) || (h.to_user !== a && secondRight)) r.b_right++;
      r.updated_at = iso();
      records.set(key, r);
      return json(200, view(h, user.id, true));
    },
    hearings(user) {
      const uid = user.id;
      const list = [...rows.values()].filter(h => (h.from_user === uid || h.to_user === uid) && !blockedEither(h.from_user, h.to_user) &&
        (h.status !== 'open' || areFriends(h.from_user, h.to_user)) && Date.parse(at(h)) > now() - 30 * DAY &&
        !(h.status === 'withdrawn' && h.to_user === uid) && !(h.to_user === uid && statusOf(h) === 'expired'))
        .sort((x, y) => at(y).localeCompare(at(x))).slice(0, 40).map(h => view(h, uid, false));
      const recs = [...records].filter(([key]) => key.split('|').includes(uid))
        .sort((x, y) => y[1].updated_at.localeCompare(x[1].updated_at)).slice(0, 50)
        .map(([key, r]) => {
          const [a, b] = key.split('|'), other = a === uid ? b : a;
          return { other, row: { user_id: other, display_name: nameOf(other), hearings: r.hearings, full_benches: r.full_benches,
            mine_right: a === uid ? r.a_right : r.b_right, theirs_right: a === uid ? r.b_right : r.a_right } };
        }).filter(x => areFriends(uid, x.other) && !blockedEither(uid, x.other)).map(x => x.row);
      return json(200, { hearings: list, records: recs });
    },
    get_hearing(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const h = rows.get(p_id);
      if (!h || (h.from_user !== user.id && h.to_user !== user.id) || blockedEither(h.from_user, h.to_user) ||
        (h.status === 'withdrawn' && h.to_user === user.id)) return refuse('not_found');
      if (h.status === 'open' && !areFriends(h.from_user, h.to_user)) return refuse('not_friends');
      return json(200, view(h, user.id, true));
    },
    decline_hearing(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const h = rows.get(p_id);
      if (!h || (h.from_user !== user.id && h.to_user !== user.id) || statusOf(h) !== 'open') return refuse('not_found');
      const second = h.to_user === user.id;
      Object.assign(h, { status: second ? 'declined' : 'withdrawn', ruled_at: iso() });
      if (second) h.second_seen_at = iso(); else h.first_seen_at = iso();
      return json(200, { ok: true, status: h.status });
    },
    reveal_hearing(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const h = rows.get(p_id);
      if (!h || (h.from_user !== user.id && h.to_user !== user.id) || blockedEither(h.from_user, h.to_user)) return refuse('not_found');
      const status = statusOf(h);
      if (!(status === 'revealed' || (['expired', 'declined'].includes(status) && h.from_user === user.id))) return refuse('sealed');
      if (h.from_user === user.id) h.first_seen_at ||= iso(); else h.second_seen_at ||= iso();
      return json(200, view(h, user.id, true));
    },
    bench_record(user, { p_friend }) {
      if (!UUID.test(p_friend || '')) return badType('uuid');
      const uid = user.id;
      if (p_friend === uid || !areFriends(uid, p_friend) || blockedEither(uid, p_friend)) return refuse('not_friends');
      const key = pairKey(uid, p_friend), r = records.get(key), mineA = key.split('|')[0] === uid;
      const recent = [...rows.values()].filter(h => h.status === 'revealed' && between(h, uid, p_friend))
        .sort((x, y) => y.ruled_at.localeCompare(x.ruled_at)).slice(0, 10).map(h => view(h, uid, false));
      return json(200, { user_id: p_friend, display_name: nameOf(p_friend), hearings: r?.hearings || 0, full_benches: r?.full_benches || 0,
        mine_right: r ? (mineA ? r.a_right : r.b_right) : 0, theirs_right: r ? (mineA ? r.b_right : r.a_right) : 0, recent });
    }
  };

  // The triggers: a block tears up everything between the two and their
  // record; ending a friendship withdraws the open hearings.
  const block = RPC.block_user, unfriend = RPC.remove_friend, forget = social.forget;
  RPC.block_user = (user, args) => {
    const out = block(user, args);
    if (out.status === 200) {
      for (const [id, h] of rows) if (between(h, user.id, args.p_user)) rows.delete(id);
      records.delete(pairKey(user.id, args.p_user));
    }
    return out;
  };
  RPC.remove_friend = (user, args) => {
    const out = unfriend(user, args);
    if (out.status === 200) for (const [id, h] of rows) if (h.status === 'open' && between(h, user.id, args.p_user)) rows.delete(id);
    return out;
  };
  social.forget = userId => {
    forget(userId);
    for (const [id, h] of rows) if (h.from_user === userId || h.to_user === userId) rows.delete(id);
    for (const key of [...records.keys()]) if (key.split('|').includes(userId)) records.delete(key);
  };
  Object.assign(RPC, HEARING_RPC);
  return { rows, records, RPC: HEARING_RPC };
}
