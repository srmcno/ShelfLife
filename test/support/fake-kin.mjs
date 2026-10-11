// The Kin functions of supabase/migrations/0010_kin.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers, same refusals
// (errcode P0001 with a token as the message), checked in the same order, so
// the client cannot tell the difference. test/kin_sql.test.mjs checks the
// real SQL against the same rules.
//
// It reads the social fake's shelves, friendships, blocks and summonses, and
// wraps remove_friend, block_user and delete_my_account the way the SQL's
// trigger and foreign keys do. Do not disturb is a `dnd_until` (ISO time) or
// `dnd` (boolean) on a profile, as a later migration may add.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RID = /^[a-zA-Z0-9_-]{1,100}$/;
const DAY = 86400000, HOUR = 3600000;
const WEEK_ZERO = Date.UTC(2024, 0, 1);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const copy = value => value === undefined || value === null ? null : JSON.parse(JSON.stringify(value));

export function kinWeek(ms) {
  const d = new Date(ms);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - WEEK_ZERO) / DAY / 7);
}

export function createFakeKin({ social, users, profiles, now, json, rest, uuid, rpc }) {
  const baskets = new Map(), pals = new Map(), letters = new Map();
  let seeds = 0;
  const t = () => now();
  const iso = (ms = t()) => new Date(ms).toISOString();
  const ms = value => value ? Date.parse(value) : 0;
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const seed = () => (Math.imul(++seeds, 2654435761) >>> 1) % 2147483647;
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const samePair = (x1, x2, a, b) => pairKey(x1, x2) === pairKey(a, b);
  const friendship = (a, b) => social.friendships.find(f => samePair(f.requester, f.addressee, a, b)) || null;
  const areFriends = (a, b) => friendship(a, b)?.status === 'accepted';
  const blocked = (a, b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const nameOf = id => profiles.get(id)?.display_name || '';
  function dnd(id) {
    const p = profiles.get(id);
    if (!p) return false;
    if ('dnd_until' in p) return !!p.dnd_until && ms(p.dnd_until) > t();
    if ('dnd' in p) return p.dnd === true;
    return false;
  }
  function card(r) {
    if (!record(r) || typeof r.id !== 'string' || !RID.test(r.id)) return null;
    const traits = (Array.isArray(r.traits) ? r.traits : []).map(x => typeof x === 'string' ? x : JSON.stringify(x)).filter(x => /^[a-z]{1,24}$/.test(x)).slice(0, 6);
    return { id: r.id, name: clean(r.name, 22) || 'Someone', traits, mood: ['content', 'fine', 'annoyed', 'furious'].includes(r.mood) ? r.mood : 'fine' };
  }
  function shelfCard(owner, rid) {
    const residents = social.shelves.get(owner)?.snapshot?.residents;
    return Array.isArray(residents) ? card(residents.find(r => record(r) && r.id === rid)) : null;
  }
  const open = b => b.status === 'offered' && ms(b.created_at) > t() - 48 * HOUR;
  function history(a, ra, b, rb) {
    if ([...social.summons.values()].some(s => (s.from_user === a && s.to_user === b && s.plaintiff?.id === ra && s.defendant?.id === rb) ||
      (s.from_user === b && s.to_user === a && s.plaintiff?.id === rb && s.defendant?.id === ra))) return 'hearing';
    if ([...pals.values()].some(p => !p.ended_at && ((p.user_a === a && p.res_a === ra && p.user_b === b && p.res_b === rb) ||
      (p.user_a === b && p.res_a === rb && p.user_b === a && p.res_b === ra)))) return 'letters';
    if ([...baskets.values()].some(k => k.status === 'born' && ((k.from_user === a && k.to_user === b && k.from_parent.id === ra && k.to_parent_id === rb) ||
      (k.from_user === b && k.to_user === a && k.from_parent.id === rb && k.to_parent_id === ra)))) return 'foundling';
    const f = friendship(a, b);
    if (f?.status === 'accepted' && ms(f.created_at) <= t() - 7 * DAY) return 'friends';
    return null;
  }
  const pairBaskets = (a, b) => [...baskets.values()].filter(k => samePair(k.from_user, k.to_user, a, b));
  const bornRecently = (a, b) => pairBaskets(a, b).some(k => k.status === 'born' && ms(k.answered_at) > t() - 14 * DAY);
  const palsOf = id => [...pals.values()].filter(p => p.user_a === id || p.user_b === id);

  function makePal(u1, r1, n1, u2, r2, n2, kind, caseId, basketId) {
    if (u1 === u2 || typeof r1 !== 'string' || !RID.test(r1) || typeof r2 !== 'string' || !RID.test(r2)) return null;
    const flip = !(u1 < u2);
    const [ua, ra, na, ub, rb, nb] = flip ? [u2, r2, n2, u1, r1, n1] : [u1, r1, n1, u2, r2, n2];
    const existing = [...pals.values()].find(p => p.user_a === ua && p.res_a === ra && p.user_b === ub && p.res_b === rb);
    if (existing) return existing.id;
    if ([...pals.values()].filter(p => p.user_a === ua && p.user_b === ub).length >= 12) return null;
    if (palsOf(u1).length >= 40 || palsOf(u2).length >= 40) return null;
    const row = { id: uuid(), user_a: ua, user_b: ub, res_a: ra, res_b: rb, name_a: clean(na, 22), name_b: clean(nb, 22), history: kind,
      case_id: typeof caseId === 'string' && /^[a-z0-9-]{1,40}$/.test(caseId) ? caseId : null, basket_id: basketId || null,
      seed: seed(), created_at: iso(), ended_at: null, ended_by: null };
    pals.set(row.id, row);
    return row.id;
  }
  function deliver(user, week) {
    if (!user || dnd(user)) return 0;
    let made = 0;
    const mine = palsOf(user).filter(p => !p.ended_at).sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id)).slice(0, 40);
    for (const p of mine) {
      const other = p.user_a === user ? p.user_b : p.user_a;
      if (!areFriends(user, other) || blocked(user, other)) continue;
      const w = shelfCard(other, p.user_a === user ? p.res_b : p.res_a), r = shelfCard(user, p.user_a === user ? p.res_a : p.res_b);
      if (!w || !r) continue;
      if ([...letters.values()].some(l => l.kind === 'weekly' && l.pal_id === p.id && l.to_user === user && l.week === week)) continue;
      const row = { id: uuid(), pal_id: p.id, from_user: other, to_user: user, kind: 'weekly', week, reply_to: null, choice: null, writer: w, reader: r, created_at: iso(), read_at: null };
      letters.set(row.id, row);
      made++;
    }
    return made;
  }
  // The trigger on public.friendships, and the foreign keys.
  function unfriended(a, b) {
    for (const [id, p] of pals) if (samePair(p.user_a, p.user_b, a, b)) { pals.delete(id); dropLetters(l => l.pal_id === id); }
    for (const [id, k] of baskets) if (k.status !== 'born' && samePair(k.from_user, k.to_user, a, b)) baskets.delete(id);
  }
  function dropLetters(test) { for (const [id, l] of letters) if (test(l)) letters.delete(id); }
  function forget(userId) {
    for (const [id, k] of baskets) if (k.from_user === userId || k.to_user === userId) baskets.delete(id);
    for (const [id, p] of pals) {
      if (p.user_a === userId || p.user_b === userId) { pals.delete(id); dropLetters(l => l.pal_id === id); }
      else if (p.ended_by === userId) p.ended_by = null;
    }
    dropLetters(l => l.from_user === userId || l.to_user === userId);
  }

  const RPC = {
    kin_leave_basket(user, { p_to, p_parent, p_theirs }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      if (p_to === user.id || !areFriends(user.id, p_to) || blocked(user.id, p_to)) return refuse('not_friends');
      if (dnd(p_to)) return refuse('do_not_disturb');
      if (!record(p_parent) || typeof p_parent.id !== 'string' || !RID.test(p_parent.id) || typeof p_theirs !== 'string' || !RID.test(p_theirs)) return refuse('bad_basket');
      if (size(p_parent) >= 150000) return refuse('too_large');
      const theirs = shelfCard(p_to, p_theirs);
      if (!theirs) return refuse('not_found');
      const why = history(user.id, p_parent.id, p_to, p_theirs);
      if (!why) return refuse('no_history');
      if (pairBaskets(user.id, p_to).some(open)) return refuse('basket_waiting');
      if (bornRecently(user.id, p_to)) return refuse('too_soon');
      if ([...baskets.values()].filter(k => k.from_user === user.id && ms(k.created_at) > t() - DAY).length >= 6) return refuse('rate_limited');
      const row = { id: uuid(), from_user: user.id, to_user: p_to, from_parent: copy(p_parent), to_parent_id: p_theirs, to_parent_name: theirs.name,
        to_parent: null, seed: seed(), name_roll: 0, history: why, status: 'offered', created_at: iso(), answered_at: null, from_collected_at: null, to_collected_at: null };
      baskets.set(row.id, row);
      return json(200, { ok: true, id: row.id, expires_at: iso(ms(row.created_at) + 48 * HOUR) });
    },
    kin_answer_basket(user, { p_id, p_accept, p_parent = null, p_name_roll = 0 }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      if (p_name_roll !== null && p_name_roll !== undefined && !Number.isInteger(p_name_roll)) return badType('integer');
      const b = baskets.get(p_id);
      if (!b || b.to_user !== user.id) return refuse('not_found');
      if (b.status !== 'offered') return refuse('not_open');
      if (ms(b.created_at) <= t() - 48 * HOUR) return refuse('expired');
      if (!p_accept) { Object.assign(b, { status: 'declined', answered_at: iso() }); return json(200, { ok: true, id: b.id, status: 'declined' }); }
      if (!areFriends(user.id, b.from_user) || blocked(user.id, b.from_user)) return refuse('not_friends');
      if (!record(p_parent) || p_parent.id !== b.to_parent_id || !Number.isInteger(p_name_roll) || p_name_roll < 0 || p_name_roll > 49) return refuse('bad_basket');
      if (size(p_parent) >= 150000) return refuse('too_large');
      const shown = social.shelves.get(user.id)?.snapshot?.residents;
      if ((Array.isArray(shown) ? shown.length : 0) >= 18) return refuse('shelf_full');
      if (bornRecently(user.id, b.from_user)) return refuse('too_soon');
      Object.assign(b, { status: 'born', to_parent: copy(p_parent), name_roll: p_name_roll, answered_at: iso(), to_collected_at: iso() });
      makePal(b.from_user, b.from_parent.id, b.from_parent.name, user.id, b.to_parent_id, p_parent.name, 'foundling', null, b.id);
      const twin = 'kin' + b.id.replace(/-/g, '').slice(0, 12);
      makePal(b.from_user, twin, '', user.id, twin, '', 'twin', null, b.id);
      return json(200, { ok: true, id: b.id, status: 'born', seed: b.seed, name_roll: b.name_roll, answered_at: b.answered_at });
    },
    kin_withdraw_basket(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const b = baskets.get(p_id);
      if (!b || b.from_user !== user.id || b.status !== 'offered') return refuse('not_found');
      Object.assign(b, { status: 'withdrawn', answered_at: iso() });
      return json(200, { ok: true });
    },
    kin_collect(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const b = baskets.get(p_id);
      if (!b || b.from_user !== user.id || b.status !== 'born') return refuse('not_found');
      b.from_collected_at ||= iso();
      return json(200, { ok: true });
    },
    kin_introduce(user, { p_friend, p_mine, p_theirs }) {
      if (!UUID.test(p_friend || '')) return badType('uuid');
      if (p_friend === user.id || !areFriends(user.id, p_friend) || blocked(user.id, p_friend)) return refuse('not_friends');
      if (dnd(p_friend)) return refuse('do_not_disturb');
      const mine = shelfCard(user.id, p_mine), theirs = shelfCard(p_friend, p_theirs);
      if (!mine || !theirs) return refuse('not_found');
      const flip = !(user.id < p_friend);
      const existing = [...pals.values()].find(p => p.user_a === (flip ? p_friend : user.id) && p.user_b === (flip ? user.id : p_friend) &&
        p.res_a === (flip ? p_theirs : p_mine) && p.res_b === (flip ? p_mine : p_theirs));
      if (existing) {
        if (!existing.ended_at) return json(200, { ok: true, id: existing.id });
        if (existing.ended_by !== user.id) return refuse('stopped');
        Object.assign(existing, { ended_at: null, ended_by: null });
        return json(200, { ok: true, id: existing.id });
      }
      if (!history(user.id, p_mine, p_friend, p_theirs)) return refuse('no_history');
      if (palsOf(user.id).filter(p => p.history === 'introduced' && ms(p.created_at) > t() - DAY).length >= 10) return refuse('rate_limited');
      const made = makePal(user.id, p_mine, mine.name, p_friend, p_theirs, theirs.name, 'introduced', null, null);
      if (!made) return refuse('too_many_pals');
      return json(200, { ok: true, id: made });
    },
    kin_end(user, { p_pal }) {
      if (!UUID.test(p_pal || '')) return badType('uuid');
      const p = pals.get(p_pal);
      if (!p || (p.user_a !== user.id && p.user_b !== user.id) || p.ended_at) return refuse('not_found');
      Object.assign(p, { ended_at: iso(), ended_by: user.id });
      dropLetters(l => l.pal_id === p_pal);
      return json(200, { ok: true });
    },
    kin_reply(user, { p_letter, p_choice }) {
      if (!UUID.test(p_letter || '')) return badType('uuid');
      if (p_choice !== null && p_choice !== undefined && !Number.isInteger(p_choice)) return badType('integer');
      if (!Number.isInteger(p_choice) || p_choice < 0 || p_choice > 2) return refuse('bad_reply');
      const l = letters.get(p_letter);
      if (!l || l.to_user !== user.id) return refuse('not_found');
      if (l.kind !== 'weekly') return refuse('bad_reply');
      if ([...letters.values()].some(x => x.reply_to === l.id)) return refuse('already_replied');
      if (!areFriends(user.id, l.from_user) || blocked(user.id, l.from_user)) return refuse('not_friends');
      if (dnd(l.from_user)) return refuse('do_not_disturb');
      if ([...letters.values()].filter(x => x.from_user === user.id && x.kind === 'reply' && ms(x.created_at) > t() - DAY).length >= 20) return refuse('rate_limited');
      const row = { id: uuid(), pal_id: l.pal_id, from_user: user.id, to_user: l.from_user, kind: 'reply', week: l.week, reply_to: l.id, choice: p_choice,
        writer: copy(l.reader), reader: copy(l.writer), created_at: iso(), read_at: null };
      letters.set(row.id, row);
      l.read_at ||= iso();
      return json(200, { ok: true, id: row.id });
    },
    kin_read(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const l = letters.get(p_id);
      const ok = !!l && l.to_user === user.id;
      if (ok) l.read_at ||= iso();
      return json(200, { ok });
    },
    kin_mail(user) {
      const uid = user.id, at = t();
      dropLetters(l => (l.from_user === uid || l.to_user === uid) && ms(l.created_at) < at - 60 * DAY);
      for (const [id, k] of baskets) {
        if (k.from_user !== uid && k.to_user !== uid) continue;
        if ((k.status !== 'born' && ms(k.created_at) < at - 30 * DAY) || (k.status === 'born' && ms(k.answered_at) < at - 90 * DAY)) baskets.delete(id);
      }
      const ruled = [...social.summons.values()].filter(s => s.status === 'ruled' && (s.from_user === uid || s.to_user === uid) && ms(s.ruled_at) > at - 60 * DAY &&
        areFriends(s.from_user, s.to_user) && !blocked(s.from_user, s.to_user)).sort((a, b) => b.ruled_at.localeCompare(a.ruled_at)).slice(0, 6);
      for (const s of ruled) makePal(s.from_user, s.plaintiff?.id, s.plaintiff?.name, s.to_user, s.defendant?.id, s.defendant?.name, 'hearing', s.case_id, null);
      const week = kinWeek(at);
      deliver(uid, week);
      const visible = [...baskets.values()].filter(k =>
        (k.to_user === uid && open(k) && areFriends(k.from_user, uid) && !blocked(k.from_user, uid)) ||
        (k.from_user === uid && open(k)) ||
        (k.from_user === uid && k.status === 'born' && !k.from_collected_at) ||
        (k.from_user === uid && k.status !== 'born' && (k.answered_at ? ms(k.answered_at) : ms(k.created_at) + 48 * HOUR) > at - 3 * DAY &&
          (k.status !== 'offered' || ms(k.created_at) <= at - 48 * HOUR)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);
      const out = visible.map(k => {
        const hidden = blocked(k.from_user, k.to_user);
        return {
          id: k.id, direction: k.from_user === uid ? 'out' : 'in',
          status: ['declined', 'withdrawn'].includes(k.status) || (k.status === 'offered' && !open(k)) ? 'returned' : k.status,
          from_user: k.from_user, to_user: k.to_user, from_name: hidden ? '' : nameOf(k.from_user), to_name: hidden ? '' : nameOf(k.to_user),
          from_parent: (k.to_user === uid && k.status === 'offered') || k.status === 'born' ? copy(k.from_parent) : { id: k.from_parent.id ?? null, name: k.from_parent.name ?? null },
          to_parent_id: k.to_parent_id, to_parent_name: k.to_parent_name, to_parent: k.status === 'born' ? copy(k.to_parent) : null,
          seed: k.status === 'born' || (k.to_user === uid && k.status === 'offered') ? k.seed : null, name_roll: k.name_roll, history: k.history,
          created_at: k.created_at, expires_at: iso(ms(k.created_at) + 48 * HOUR), answered_at: k.answered_at,
          collected: k.from_user === uid ? !!k.from_collected_at : !!k.to_collected_at
        };
      });
      const shownPals = palsOf(uid).filter(p => !p.ended_at && areFriends(p.user_a, p.user_b) && !blocked(p.user_a, p.user_b))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).map(p => {
          const meA = p.user_a === uid, friend = meA ? p.user_b : p.user_a;
          const mine = meA ? p.res_a : p.res_b, theirs = meA ? p.res_b : p.res_a;
          return { id: p.id, friend, mine: { id: mine, name: shelfCard(uid, mine)?.name ?? (meA ? p.name_a : p.name_b) },
            theirs: { id: theirs, name: shelfCard(friend, theirs)?.name ?? (meA ? p.name_b : p.name_a) },
            history: p.history, case_id: p.case_id, basket_id: p.basket_id, seed: p.seed, created_at: p.created_at };
        });
      const unread = [...letters.values()].filter(l => l.to_user === uid && !l.read_at && !blocked(l.from_user, uid))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30).reverse()
        .map(l => ({ id: l.id, pal_id: l.pal_id, from_user: l.from_user, kind: l.kind, week: l.week, reply_to: l.reply_to, choice: l.choice,
          writer: copy(l.writer), reader: copy(l.reader), created_at: l.created_at }));
      const friends = social.friendships.filter(f => f.status === 'accepted' && (f.requester === uid || f.addressee === uid)).slice(0, 200).map(f => {
        const other = f.requester === uid ? f.addressee : f.requester;
        const born = pairBaskets(uid, other).filter(k => k.status === 'born' && ms(k.answered_at) > at - 14 * DAY).map(k => ms(k.answered_at));
        const hearings = [];
        for (const s of social.summons.values()) {
          if (!((s.from_user === uid && s.to_user === other) || (s.from_user === other && s.to_user === uid))) continue;
          const pair = s.from_user === uid ? [s.plaintiff?.id ?? null, s.defendant?.id ?? null] : [s.defendant?.id ?? null, s.plaintiff?.id ?? null];
          if (!hearings.some(h => h[0] === pair[0] && h[1] === pair[1]) && hearings.length < 12) hearings.push(pair);
        }
        return { user_id: other, since: f.created_at, week_old: ms(f.created_at) <= at - 7 * DAY, open_basket: pairBaskets(uid, other).some(open),
          next_basket_at: born.length ? iso(Math.max(...born) + 14 * DAY) : null, hearings };
      });
      return json(200, { now: iso(at), week, baskets: out, pals: shownPals, letters: unread, friends });
    }
  };
  // What 0010's trigger does when 0002 deletes a friendship, and what the
  // foreign keys do when an account goes.
  if (rpc) {
    for (const name of ['remove_friend', 'block_user']) {
      const original = rpc[name];
      RPC[name] = (user, args) => {
        const result = original(user, args);
        if (result.status === 200 && UUID.test(args?.p_user || '') && !areFriends(user.id, args.p_user)) unfriended(user.id, args.p_user);
        return result;
      };
    }
    const leaving = rpc.delete_my_account;
    RPC.delete_my_account = (user, args) => { forget(user.id); return leaving(user, args); };
  }

  return { RPC, baskets, pals, letters, deliver, forget, week: () => kinWeek(t()) };
}
