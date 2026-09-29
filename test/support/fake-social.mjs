// The social functions of supabase/migrations/0002_social.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers, same refusals
// (errcode P0001 with a token as the message), so the client cannot tell the
// difference. test/social_sql.test.mjs checks the real SQL against the same
// rules.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE = /^[a-z0-9-]{1,40}$/;
export const SCORE_CAPS = { frenzy: 3000, stack: 500, seance: 150, whack: 2500 };
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export function createFakeSocial({ users, profiles, ensureProfile, now, json, rest, uuid }) {
  const shelves = new Map(), summons = new Map(), scores = new Map();
  const friendships = [], blocks = [], reports = [], attempts = [];
  const iso = () => new Date(now()).toISOString();
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const pairOf = (a, b) => friendships.find(f => (f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)) || null;
  const areFriends = (a, b) => pairOf(a, b)?.status === 'accepted';
  const blocked = (blocker, target) => blocks.some(b => b.blocker === blocker && b.blocked === target);
  const nameOf = id => profiles.get(id)?.display_name || '';
  const drop = (list, test) => { for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) list.splice(i, 1); };
  const between = (s, a, b) => (s.from_user === a && s.to_user === b) || (s.from_user === b && s.to_user === a);

  // Mirrors private.score_day: YYYY-M-D, a real date.
  function scoreDay(value) {
    const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const [y, mo, d] = m.slice(1).map(Number), t = Date.UTC(y, mo - 1, d), date = new Date(t);
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date.toISOString().slice(0, 10);
  }
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const dayGap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

  const RPC = {
    add_friend(user, { p_code }) {
      const recent = attempts.filter(a => a.user_id === user.id && a.at > now() - 3600000).length;
      if (recent >= 20) return json(200, { ok: false, error: 'rate_limited' });
      attempts.push({ user_id: user.id, at: now() });
      ensureProfile(user);
      const code = String(p_code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const other = /^[A-HJKMNP-Z2-9]{8}$/.test(code) ? [...profiles].find(([, p]) => p.friend_code === code)?.[0] : null;
      const refused = !other ? 'not_found' : other === user.id ? 'self' : blocked(user.id, other) ? 'blocked' : blocked(other, user.id) ? 'not_found' : null;
      if (refused) return json(200, { ok: false, error: refused });
      const f = pairOf(user.id, other);
      if (f) {
        if (f.status === 'accepted') return json(200, { ok: false, error: 'already_friends' });
        if (f.requester === user.id) return json(200, { ok: false, error: 'already_asked' });
        f.status = 'accepted';
        const p = profiles.get(other);
        return json(200, { ok: true, status: 'accepted', user_id: other, friend_code: p.friend_code, display_name: p.display_name });
      }
      friendships.push({ requester: user.id, addressee: other, status: 'pending', created_at: iso() });
      return json(200, { ok: true, status: 'pending', user_id: other, friend_code: code, display_name: '' });
    },
    respond_friend(user, { p_user, p_accept }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      const f = friendships.find(x => x.requester === p_user && x.addressee === user.id && x.status === 'pending');
      if (!f) return refuse('not_found');
      if (p_accept) f.status = 'accepted';
      else friendships.splice(friendships.indexOf(f), 1);
      return json(200, { ok: true, status: p_accept ? 'accepted' : 'declined' });
    },
    remove_friend(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      drop(friendships, f => (f.requester === user.id && f.addressee === p_user) || (f.requester === p_user && f.addressee === user.id));
      for (const [id, s] of summons) if (s.status === 'open' && between(s, user.id, p_user)) summons.delete(id);
      return json(200, { ok: true });
    },
    block_user(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      if (p_user === user.id) return refuse('self');
      if (!users.has(p_user)) return refuse('not_found');
      if (!blocked(user.id, p_user)) blocks.push({ blocker: user.id, blocked: p_user, created_at: iso() });
      drop(friendships, f => (f.requester === user.id && f.addressee === p_user) || (f.requester === p_user && f.addressee === user.id));
      for (const [id, s] of summons) if (between(s, user.id, p_user)) summons.delete(id);
      return json(200, { ok: true });
    },
    report_user(user, { p_user, p_reason }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      if (p_user === user.id) return refuse('self');
      if (!users.has(p_user)) return refuse('not_found');
      if (reports.filter(r => r.reporter === user.id && r.at > now() - 3600000).length >= 5) return refuse('rate_limited');
      reports.push({ reporter: user.id, reported: p_user, reason: clean(p_reason, 200), at: now(),
        evidence: { display_name: profiles.get(p_user)?.display_name ?? null, shelf: shelves.get(p_user)?.snapshot ?? null } });
      return json(200, { ok: true });
    },
    list_friends(user) {
      const rows = friendships.filter(f => f.requester === user.id || f.addressee === user.id).map(f => {
        const other = f.requester === user.id ? f.addressee : f.requester, direction = f.requester === user.id ? 'outgoing' : 'incoming';
        const p = profiles.get(other);
        return { user_id: other, display_name: f.status === 'accepted' || direction === 'incoming' ? p?.display_name || '' : '',
          friend_code: p?.friend_code || '', status: f.status, direction,
          shelf_updated_at: f.status === 'accepted' ? shelves.get(other)?.updated_at || null : null, created_at: f.created_at };
      });
      rows.sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1) ||
        (a.display_name.toLowerCase() < b.display_name.toLowerCase() ? -1 : a.display_name.toLowerCase() > b.display_name.toLowerCase() ? 1 : 0) ||
        (a.created_at < b.created_at ? -1 : 1));
      return json(200, rows.map(({ created_at, ...row }) => row));
    },
    publish_shelf(user, { p_snapshot }) {
      if (!record(p_snapshot) || (p_snapshot.residents !== undefined && !Array.isArray(p_snapshot.residents))) return refuse('bad_shelf');
      if ((p_snapshot.residents || []).length > 18) return refuse('bad_shelf');
      if (size(p_snapshot) >= 400000) return rest(400, '23514', 'new row for relation "shelves" violates check constraint "shelves_snapshot_size"');
      const row = { snapshot: JSON.parse(JSON.stringify(p_snapshot)), updated_at: iso() };
      shelves.set(user.id, row);
      return json(200, { ok: true, updated_at: row.updated_at });
    },
    get_shelf(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      if (p_user !== user.id && !areFriends(user.id, p_user)) return refuse('not_friends');
      const row = shelves.get(p_user);
      return json(200, { user_id: p_user, display_name: nameOf(p_user), snapshot: row?.snapshot ?? null, updated_at: row?.updated_at ?? null });
    },
    send_summons(user, { p_to, p_case, p_plaintiff, p_defendant }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      if (!areFriends(user.id, p_to)) return refuse('not_friends');
      if (typeof p_case !== 'string' || !CASE.test(p_case)) return refuse('bad_case');
      if (!record(p_plaintiff) || !record(p_defendant)) return refuse('bad_summons');
      if (size(p_plaintiff) >= 150000 || size(p_defendant) >= 150000) return refuse('too_large');
      if ([...summons.values()].filter(s => s.from_user === user.id && s.to_user === p_to && s.status === 'open').length >= 5) return refuse('too_many_open');
      const row = { id: uuid(), from_user: user.id, to_user: p_to, case_id: p_case, plaintiff: JSON.parse(JSON.stringify(p_plaintiff)),
        defendant: JSON.parse(JSON.stringify(p_defendant)), status: 'open', verdict: null, stars: null, ratings: null,
        created_at: iso(), ruled_at: null, sender_seen_at: null };
      summons.set(row.id, row);
      return json(200, { ok: true, id: row.id, created_at: row.created_at });
    },
    rule_summons(user, { p_id, p_verdict, p_stars, p_ratings }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      if (![p_stars, p_ratings].every(n => n === null || n === undefined || Number.isInteger(n))) return badType('integer');
      if (!['plaintiff', 'defendant', 'both'].includes(p_verdict)) return refuse('bad_verdict');
      if (!(p_stars >= 0 && p_stars <= 3 && p_ratings >= 0 && p_ratings <= 100)) return refuse('bad_verdict');
      const s = summons.get(p_id);
      if (!s || s.to_user !== user.id) return refuse('not_found');
      if (s.status !== 'open') return refuse('not_open');
      Object.assign(s, { status: 'ruled', verdict: p_verdict, stars: p_stars, ratings: p_ratings, ruled_at: iso() });
      return json(200, { ok: true, id: s.id, status: s.status, ruled_at: s.ruled_at });
    },
    decline_summons(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const s = summons.get(p_id);
      if (!s || s.to_user !== user.id || s.status !== 'open') return refuse('not_found');
      Object.assign(s, { status: 'declined', ruled_at: iso() });
      return json(200, { ok: true });
    },
    inbox(user) {
      const all = [...summons.values()];
      const cases = all.filter(s => s.to_user === user.id && s.status === 'open' && Date.parse(s.created_at) > now() - 30 * 86400000 && !blocked(user.id, s.from_user))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20)
        .map(s => ({ id: s.id, from_user: s.from_user, from_name: nameOf(s.from_user), case_id: s.case_id, plaintiff: s.plaintiff, defendant: s.defendant, created_at: s.created_at }));
      const pick = r => ({ id: r?.id ?? null, name: r?.name ?? null });
      const results = all.filter(s => s.from_user === user.id && s.status === 'ruled' && !s.sender_seen_at && !blocked(user.id, s.to_user))
        .sort((a, b) => b.ruled_at.localeCompare(a.ruled_at)).slice(0, 20)
        .map(s => ({ id: s.id, to_user: s.to_user, to_name: nameOf(s.to_user), case_id: s.case_id, plaintiff: pick(s.plaintiff), defendant: pick(s.defendant),
          verdict: s.verdict, stars: s.stars, ratings: s.ratings, ruled_at: s.ruled_at }));
      return json(200, { cases, results });
    },
    mark_summons_seen(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const s = summons.get(p_id);
      const ok = !!s && s.from_user === user.id && s.status === 'ruled' && !s.sender_seen_at;
      if (ok) s.sender_seen_at = iso();
      return json(200, { ok });
    },
    submit_score(user, { p_game, p_day, p_score, p_mod = '' }) {
      if (p_score !== null && p_score !== undefined && !Number.isInteger(p_score)) return badType('integer');
      const day = scoreDay(p_day);
      if (!day) return refuse('bad_day');
      if (!SCORE_CAPS[p_game]) return refuse('bad_game');
      if (Math.abs(dayGap(day, today())) > 2) return refuse('bad_day');
      if (!(p_score >= 0 && p_score <= SCORE_CAPS[p_game])) return refuse('bad_score');
      const mod = String(p_mod ?? '').toLowerCase();
      if (!/^[a-z0-9-]{0,24}$/.test(mod)) return refuse('bad_mod');
      const key = user.id + '|' + p_game + '|' + day, row = scores.get(key);
      if (!row || p_score > row.score) scores.set(key, { user_id: user.id, game: p_game, day, score: p_score, mod, updated_at: iso() });
      return json(200, { ok: true, best: scores.get(key).score });
    },
    friends_board(user, { p_game, p_day }) {
      const day = scoreDay(p_day);
      if (!day) return refuse('bad_day');
      if (!SCORE_CAPS[p_game]) return refuse('bad_game');
      const circle = new Set([user.id, ...friendships.filter(f => f.status === 'accepted' && (f.requester === user.id || f.addressee === user.id))
        .map(f => f.requester === user.id ? f.addressee : f.requester)]);
      const rows = [...scores.values()].filter(s => s.game === p_game && s.day === day && circle.has(s.user_id)).sort((a, b) => b.score - a.score);
      return json(200, rows.slice(0, 50).map(s => ({ user_id: s.user_id, display_name: nameOf(s.user_id), score: s.score,
        rank: rows.filter(o => o.score > s.score).length + 1, me: s.user_id === user.id })));
    },
    day_percentile(user, { p_game, p_day }) {
      const day = scoreDay(p_day);
      if (!day) return refuse('bad_day');
      if (!SCORE_CAPS[p_game]) return refuse('bad_game');
      const rows = [...scores.values()].filter(s => s.game === p_game && s.day === day);
      const mine = rows.find(s => s.user_id === user.id)?.score;
      const players = rows.length, beaten = mine === undefined ? 0 : rows.filter(s => s.score < mine).length;
      return json(200, { players, top_score: players ? Math.max(...rows.map(s => s.score)) : null,
        beaten_percent: mine === undefined || players <= 1 ? null : Math.floor(100 * beaten / (players - 1)) });
    }
  };

  const TABLES = {
    shelves: user => [...shelves].filter(([id]) => id === user.id || areFriends(user.id, id)).map(([user_id, r]) => ({ user_id, ...r })),
    friendships: user => friendships.filter(f => f.requester === user.id || f.addressee === user.id).map(f => ({ ...f })),
    blocks: user => blocks.filter(b => b.blocker === user.id).map(b => ({ ...b })),
    summons: user => [...summons.values()].filter(s => s.from_user === user.id || s.to_user === user.id).map(s => ({ ...s })),
    scores: user => [...scores.values()].filter(s => s.user_id === user.id).map(s => ({ ...s }))
  };

  // What delete_my_account cascades to.
  function forget(userId) {
    shelves.delete(userId);
    drop(friendships, f => f.requester === userId || f.addressee === userId);
    drop(blocks, b => b.blocker === userId || b.blocked === userId);
    drop(reports, r => r.reporter === userId || r.reported === userId);
    drop(attempts, a => a.user_id === userId);
    for (const [id, s] of summons) if (s.from_user === userId || s.to_user === userId) summons.delete(id);
    for (const [key, s] of scores) if (s.user_id === userId) scores.delete(key);
  }

  return { RPC, TABLES, forget, shelves, summons, scores, friendships, blocks, reports, attempts };
}
