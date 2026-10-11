// The coven functions of supabase/migrations/0008_covens.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers, same refusals
// (errcode P0001 with a token as the message), so the client cannot tell the
// difference. test/coven_sql.test.mjs checks the real SQL against the same rules.
//
// It reads friendships and blocks from the social fake, and wraps its
// forget() so delete_my_account cascades here too. Tests reach it as
// fake.social.coven. Knobs: forceGoal (the goal id every new week gets) and
// the tables themselves.
import { GOALS, DAILY_CAPS } from '../../src/content/coven.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-z0-9-]{1,24}$/;
const TILE = /^[a-z0-9-]{1,20}$/;
const DAY = 86400000;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function createFakeCoven({ users, profiles, social, now, json, rest, uuid }) {
  const covens = new Map(), members = new Map(), invites = new Map(), weeks = new Map(), tallies = new Map(), claims = new Map();
  const notes = [], activeDays = new Set(), referrals = new Map(), actions = [];
  let noteSerial = 0;
  const api = { forceGoal: '' };
  const iso = (t = now()) => new Date(t).toISOString();
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const today = () => iso().slice(0, 10);
  const dayNo = day => Math.floor(Date.parse(day + 'T00:00:00Z') / DAY);
  const dayOf = no => new Date(no * DAY).toISOString().slice(0, 10);
  const weekOf = day => Math.floor((dayNo(day) + 3) / 7);
  const weekStart = week => dayOf(week * 7 - 3);
  const inWeek = (day, week) => weekOf(day) === week;
  const nameOf = id => profiles.get(id)?.display_name || '';
  const areFriends = (a, b) => social.friendships.some(f => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const blockedEither = (a, b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const covenOf = id => members.get(id)?.coven_id || null;
  const membersOf = c => [...members].filter(([, m]) => m.coven_id === c).map(([user_id, m]) => ({ user_id, ...m }))
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id));
  const founderOf = c => membersOf(c).find(m => m.role === 'founder')?.user_id || null;
  const blockedWithCoven = (u, c) => membersOf(c).some(m => m.user_id !== u && blockedEither(u, m.user_id));
  const threshold = (target, tier) => tier === 1 ? Math.ceil(target / 3) : tier === 2 ? Math.ceil(target * 2 / 3) : target;
  function hash(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

  function rate(user, kind, max, windowMs) {
    for (let i = actions.length - 1; i >= 0; i--) if (actions[i].user_id === user && actions[i].at < now() - DAY) actions.splice(i, 1);
    if (actions.filter(a => a.user_id === user && a.kind === kind && a.at > now() - windowMs).length >= max) return false;
    actions.push({ user_id: user, kind, at: now() });
    return true;
  }
  function card(c) {
    const row = covens.get(c);
    return row && { id: c, name_a: row.name_a, name_b: row.name_b, name_form: row.name_form, shape: row.shape, symbol: row.symbol, colour: row.colour,
      created_at: row.created_at, members: membersOf(c).length };
  }
  function weekRow(c, week) {
    const key = c + '|' + week;
    if (weeks.has(key)) return weeks.get(key);
    const prev = weeks.get(c + '|' + (week - 1))?.goal;
    let pick = hash(c + ':' + week) % GOALS.length;
    if (GOALS[pick].id === prev) pick = (pick + 1) % GOALS.length;
    const g = GOALS.find(x => x.id === api.forceGoal) || GOALS[pick];
    const row = { coven_id: c, week, goal: g.id, counter: g.counter, target: g.per * Math.max(2, Math.min(6, membersOf(c).length)) };
    weeks.set(key, row);
    return row;
  }
  const tallyRows = filter => [...tallies.values()].filter(filter);
  const progress = (c, week, counter) => tallyRows(t => t.coven_id === c && t.counter === counter && inWeek(t.day, week)).reduce((n, t) => n + t.amount, 0);
  // The trigger: a departing founder hands the candle on; an empty coven goes.
  function gone(userId) {
    const m = members.get(userId);
    if (!m) return false;
    members.delete(userId);
    for (const [k, i] of invites) if (i.coven_id === m.coven_id && i.from_user === userId) invites.delete(k);
    const left = membersOf(m.coven_id);
    if (m.role === 'founder' && left.length && !left.some(x => x.role === 'founder')) members.get(left[0].user_id).role = 'founder';
    if (!left.length) dissolve(m.coven_id);
    return true;
  }
  function dissolve(c) {
    covens.delete(c);
    for (const [k, i] of invites) if (i.coven_id === c) invites.delete(k);
    for (const k of [...weeks.keys()]) if (k.startsWith(c + '|')) weeks.delete(k);
    for (const [k, t] of tallies) if (t.coven_id === c) tallies.delete(k);
    for (let i = notes.length - 1; i >= 0; i--) if (notes[i].coven_id === c) notes.splice(i, 1);
  }
  const look = a => [a.p_name_a, a.p_name_b, a.p_shape, a.p_symbol, a.p_colour].every(x => typeof x === 'string' && ID.test(x))
    && Number.isInteger(a.p_form) && a.p_form >= 0 && a.p_form <= 3;
  const liveInvite = i => Date.parse(i.created_at) > now() - 7 * DAY;

  const RPC = {
    coven_found(user, a) {
      if (covenOf(user.id)) return refuse('already_in_coven');
      if (!look(a)) return refuse('bad_coven');
      if (!rate(user.id, 'found', 3, DAY)) return refuse('rate_limited');
      const id = uuid();
      covens.set(id, { name_a: a.p_name_a, name_b: a.p_name_b, name_form: a.p_form, shape: a.p_shape, symbol: a.p_symbol, colour: a.p_colour, created_at: iso() });
      members.set(user.id, { coven_id: id, role: 'founder', frame: '', joined_at: iso() });
      return json(200, { ok: true, id });
    },
    coven_restyle(user, a) {
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      if (founderOf(c) !== user.id) return refuse('not_founder');
      if (!look(a)) return refuse('bad_coven');
      if (!rate(user.id, 'restyle', 6, DAY)) return refuse('rate_limited');
      Object.assign(covens.get(c), { name_a: a.p_name_a, name_b: a.p_name_b, name_form: a.p_form, shape: a.p_shape, symbol: a.p_symbol, colour: a.p_colour });
      return json(200, { ok: true });
    },
    coven_invite(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      if (founderOf(c) !== user.id) return refuse('not_founder');
      if (p_user === user.id) return refuse('self');
      if (!areFriends(user.id, p_user)) return refuse('not_friends');
      if (blockedWithCoven(p_user, c)) return refuse('not_found');
      if (typeof social.dndOn === 'function' && social.dndOn(p_user)) return refuse('dnd');
      if (covenOf(p_user)) return refuse('in_a_coven');
      if (membersOf(c).length >= 6) return refuse('coven_full');
      for (const [k, i] of invites) if (i.coven_id === c && !liveInvite(i)) invites.delete(k);
      const existing = [...invites.values()].find(i => i.coven_id === c && i.to_user === p_user);
      if (!existing && [...invites.values()].filter(i => i.coven_id === c).length >= 6) return refuse('too_many_open');
      if (!rate(user.id, 'invite', 20, 3600000)) return refuse('rate_limited');
      if (existing) { Object.assign(existing, { from_user: user.id, created_at: iso() }); return json(200, { ok: true, id: existing.id }); }
      const row = { id: uuid(), coven_id: c, from_user: user.id, to_user: p_user, created_at: iso() };
      invites.set(row.id, row);
      return json(200, { ok: true, id: row.id });
    },
    coven_cancel_invite(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      if (founderOf(c) !== user.id) return refuse('not_founder');
      let found = false;
      for (const [k, i] of invites) if (i.coven_id === c && i.to_user === p_user) { invites.delete(k); found = true; }
      return json(200, { ok: found });
    },
    coven_respond(user, { p_id, p_accept }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const i = invites.get(p_id);
      if (!i || i.to_user !== user.id || !liveInvite(i)) return refuse('not_found');
      if (!p_accept) { invites.delete(p_id); return json(200, { ok: true, status: 'declined' }); }
      if (covenOf(user.id)) return refuse('already_in_coven');
      if (covenOf(i.from_user) !== i.coven_id || !areFriends(user.id, i.from_user) || blockedWithCoven(user.id, i.coven_id)) {
        invites.delete(p_id);
        return json(200, { ok: false, error: 'not_found' });
      }
      if (membersOf(i.coven_id).length >= 6) return refuse('coven_full');
      members.set(user.id, { coven_id: i.coven_id, role: 'member', frame: '', joined_at: iso() });
      for (const [k, x] of invites) if (x.to_user === user.id) invites.delete(k);
      return json(200, { ok: true, status: 'joined', coven_id: i.coven_id });
    },
    coven_leave(user) {
      if (!gone(user.id)) return refuse('no_coven');
      return json(200, { ok: true });
    },
    coven_pass_candle(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      if (founderOf(c) !== user.id) return refuse('not_founder');
      if (p_user === user.id || covenOf(p_user) !== c) return refuse('not_member');
      members.get(user.id).role = 'member'; members.get(p_user).role = 'founder';
      return json(200, { ok: true });
    },
    coven_remove(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      if (founderOf(c) !== user.id) return refuse('not_founder');
      if (p_user === user.id || covenOf(p_user) !== c) return refuse('not_member');
      gone(p_user);
      return json(200, { ok: true });
    },
    coven_set_frame(user, { p_frame }) {
      if (typeof p_frame !== 'string' || !/^[a-z0-9-]{0,24}$/.test(p_frame)) return refuse('bad_coven');
      if (!covenOf(user.id)) return refuse('no_coven');
      if (!rate(user.id, 'frame', 30, 3600000)) return refuse('rate_limited');
      members.get(user.id).frame = p_frame;
      return json(200, { ok: true });
    },
    coven_contribute(user, { p_day, p_counts }) {
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      const m = typeof p_day === 'string' && p_day.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return refuse('bad_day');
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (d.getUTCMonth() !== +m[2] - 1) return refuse('bad_day');
      const day = d.toISOString().slice(0, 10), gap = dayNo(today()) - dayNo(day);
      if (gap < 0 || gap > 1) return refuse('bad_day');
      if (!record(p_counts) || Object.keys(p_counts).length > 11) return refuse('bad_counts');
      for (const [k, v] of Object.entries(p_counts)) if (!DAILY_CAPS[k] || !Number.isInteger(v) || v < 0 || v > 999999999) return refuse('bad_counts');
      if (!rate(user.id, 'contribute', 120, 3600000)) return refuse('rate_limited');
      const w = weekRow(c, weekOf(day));
      for (const [k, v] of Object.entries(p_counts)) {
        const other = tallyRows(t => t.user_id === user.id && t.day === day && t.counter === k && t.coven_id !== c).reduce((n, t) => n + t.amount, 0);
        const amount = Math.min(v, Math.max(0, DAILY_CAPS[k] - other));
        const key = [c, user.id, day, k].join('|'), kept = tallies.get(key);
        if (amount > 0 && (!kept || amount > kept.amount)) tallies.set(key, { coven_id: c, user_id: user.id, day, counter: k, amount });
      }
      const mine = tallyRows(t => t.coven_id === c && t.user_id === user.id && t.counter === w.counter && inWeek(t.day, w.week)).reduce((n, t) => n + t.amount, 0);
      return json(200, { ok: true, week: w.week, progress: progress(c, w.week, w.counter), mine });
    },
    coven_claim(user, { p_week, p_tier }) {
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      const wk = weekOf(today());
      if (!Number.isInteger(p_week) || (p_week !== wk && p_week !== wk - 1)) return refuse('bad_week');
      if (![1, 2, 3].includes(p_tier)) return refuse('bad_tier');
      const w = weeks.get(c + '|' + p_week);
      if (!w || progress(c, p_week, w.counter) < threshold(w.target, p_tier)) return refuse('not_reached');
      if (!tallyRows(t => t.coven_id === c && t.user_id === user.id && t.counter === w.counter && t.amount > 0 && inWeek(t.day, p_week)).length) return refuse('not_eligible');
      const key = user.id + '|' + p_week + '|' + p_tier, fresh = !claims.has(key);
      if (fresh) claims.set(key, { user_id: user.id, week: p_week, tier: p_tier, coven_id: c });
      return json(200, { ok: true, fresh, week: p_week, tier: p_tier, goal: w.goal });
    },
    coven_status(user) {
      const c = covenOf(user.id), wk = weekOf(today());
      const inbox = [...invites.values()].filter(i => i.to_user === user.id && liveInvite(i) && !blockedEither(user.id, i.from_user))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10)
        .map(i => ({ id: i.id, coven: card(i.coven_id), from_user: i.from_user, from_name: nameOf(i.from_user), created_at: i.created_at }));
      if (!c) return json(200, { coven: null, members: [], week: null, last: null, invites: inbox, sent: [], board: null });
      const w = weekRow(c, wk), l = weeks.get(c + '|' + (wk - 1)) || null, me = members.get(user.id);
      const weekBegins = Date.parse(weekStart(wk) + 'T00:00:00Z');
      const shares = {};
      for (const t of tallyRows(t => t.coven_id === c && t.counter === w.counter && inWeek(t.day, wk))) shares[t.user_id] = (shares[t.user_id] || 0) + t.amount;
      const claimed = week => [1, 2, 3].filter(t => claims.has(user.id + '|' + week + '|' + t));
      const visible = n => !blockedEither(user.id, n.author);
      return json(200, {
        coven: { ...card(c), role: me.role, frame: me.frame },
        members: membersOf(c).map(m => ({ user_id: m.user_id, display_name: nameOf(m.user_id), role: m.role, frame: m.frame, joined_at: m.joined_at })),
        week: { no: w.week, goal: w.goal, counter: w.counter, target: w.target, progress: progress(c, wk, w.counter), starts: weekStart(wk),
          members: Object.entries(shares).sort().map(([user_id, amount]) => ({ user_id, amount })), claimed: claimed(wk) },
        last: l && { no: l.week, goal: l.goal, counter: l.counter, target: l.target, progress: progress(c, l.week, l.counter), claimed: claimed(l.week),
          members: membersOf(c).filter(m => Date.parse(m.joined_at) < weekBegins).map(m => {
            const rows = tallyRows(t => t.coven_id === c && t.user_id === m.user_id && inWeek(t.day, l.week));
            const counts = {};
            for (const t of rows) counts[t.counter] = (counts[t.counter] || 0) + t.amount;
            return { user_id: m.user_id, display_name: nameOf(m.user_id), counts, days: new Set(rows.filter(t => t.amount > 0).map(t => t.day)).size,
              late: rows.filter(t => t.day === dayOf(dayNo(weekStart(l.week)) + 6)).reduce((n, t) => n + t.amount, 0),
              notes: notes.filter(n => n.coven_id === c && n.author === m.user_id && inWeek(n.created_at.slice(0, 10), l.week)).length };
          }) },
        invites: inbox,
        sent: founderOf(c) === user.id ? [...invites.values()].filter(i => i.coven_id === c && liveInvite(i))
          .map(i => ({ to_user: i.to_user, display_name: nameOf(i.to_user), created_at: i.created_at })) : [],
        board: { latest: Math.max(0, ...notes.filter(n => n.coven_id === c && visible(n)).map(n => n.id)), count: notes.filter(n => n.coven_id === c && visible(n)).length }
      });
    },
    coven_board(user) {
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      return json(200, notes.filter(n => n.coven_id === c && Date.parse(n.created_at) > now() - 45 * DAY && !blockedEither(user.id, n.author))
        .sort((a, b) => b.id - a.id).slice(0, 20)
        .map(n => ({ id: n.id, author: n.author, author_name: nameOf(n.author), tiles: [...n.tiles], mentions: [...n.mentions],
          mention_names: n.mentions.map(u => covenOf(u) === c ? nameOf(u) : ''), created_at: n.created_at })));
    },
    coven_post(user, { p_tiles }) {
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      if (!Array.isArray(p_tiles) || p_tiles.length < 1 || p_tiles.length > 12) return refuse('bad_note');
      const mentions = [];
      for (const tile of p_tiles) {
        if (typeof tile !== 'string') return refuse('bad_note');
        if (tile.startsWith('@')) {
          const who = tile.slice(1);
          if (!UUID.test(who) || who !== who.toLowerCase() || covenOf(who) !== c) return refuse('bad_note');
          if (!mentions.includes(who)) mentions.push(who);
        } else if (!TILE.test(tile)) return refuse('bad_note');
      }
      if (mentions.length > 3) return refuse('bad_note');
      if (!rate(user.id, 'post-day', 40, DAY)) return refuse('rate_limited');
      if (!rate(user.id, 'post', 12, 3600000)) { actions.pop(); return refuse('rate_limited'); }
      const note = { id: ++noteSerial, coven_id: c, author: user.id, tiles: [...p_tiles], mentions, created_at: iso() };
      notes.push(note);
      const mine = notes.filter(n => n.coven_id === c).sort((a, b) => b.id - a.id);
      for (const n of mine.slice(20)) notes.splice(notes.indexOf(n), 1);
      return json(200, { ok: true, id: note.id });
    },
    coven_unpost(user, { p_id }) {
      if (!Number.isInteger(p_id)) return badType('bigint');
      const c = covenOf(user.id);
      if (!c) return refuse('no_coven');
      const n = notes.find(x => x.id === p_id && x.coven_id === c);
      if (!n) return refuse('not_found');
      if (n.author !== user.id && !n.mentions.includes(user.id) && founderOf(c) !== user.id) return refuse('not_allowed');
      notes.splice(notes.indexOf(n), 1);
      return json(200, { ok: true });
    },
    mark_active_day(user) {
      activeDays.add(user.id + '|' + today());
      const recent = [...activeDays].filter(k => k.startsWith(user.id + '|') && dayNo(k.split('|')[1]) > dayNo(today()) - 30).length;
      return json(200, { ok: true, days: recent });
    },
    register_referral(user, { p_code }) {
      if (!rate(user.id, 'referral', 10, 3600000)) return refuse('rate_limited');
      const code = String(p_code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const other = /^[A-HJKMNP-Z2-9]{8}$/.test(code) ? [...profiles].find(([, p]) => p.friend_code === code)?.[0] : null;
      const u = users.get(user.id);
      const refused = !other ? 'not_found' : other === user.id ? 'self' : blockedEither(user.id, other) ? 'not_found'
        : referrals.has(user.id) ? 'already_referred' : !(Date.parse(u.created_at) > now() - 14 * DAY) ? 'not_new'
        : [...referrals.values()].filter(r => r.inviter === other).length >= 50 ? 'too_many' : null;
      if (refused) return json(200, { ok: false, error: refused });
      referrals.set(user.id, { invitee: user.id, inviter: other, created_at: iso(), inviter_claimed_at: null, invitee_claimed_at: null });
      return json(200, { ok: true, inviter: other });
    },
    referral_status(user) {
      const days = r => [...activeDays].filter(k => k.startsWith(r.invitee + '|') && k.split('|')[1] >= r.created_at.slice(0, 10)).length;
      const by = referrals.get(user.id);
      const u = users.get(user.id);
      return json(200, {
        invited_by: by ? { user_id: by.inviter, name: areFriends(user.id, by.inviter) ? nameOf(by.inviter) : '', friends: areFriends(user.id, by.inviter),
          days: days(by), claimed: !!by.invitee_claimed_at } : null,
        invited: [...referrals.values()].filter(r => r.inviter === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20)
          .map(r => ({ user_id: r.invitee, name: areFriends(user.id, r.invitee) ? nameOf(r.invitee) : '', friends: areFriends(user.id, r.invitee), days: days(r), claimed: !!r.inviter_claimed_at })),
        rewarded: [...referrals.values()].filter(r => r.inviter === user.id && r.inviter_claimed_at).length,
        can_register: !referrals.has(user.id) && Date.parse(u.created_at) > now() - 14 * DAY
      });
    },
    claim_referral(user, { p_user }) {
      if (!UUID.test(p_user || '')) return badType('uuid');
      const r = [...referrals.values()].find(x => (x.invitee === user.id && x.inviter === p_user) || (x.inviter === user.id && x.invitee === p_user));
      if (!r) return refuse('not_found');
      if (!areFriends(r.inviter, r.invitee)) return refuse('not_friends');
      const days = [...activeDays].filter(k => k.startsWith(r.invitee + '|') && k.split('|')[1] >= r.created_at.slice(0, 10)).length;
      if (days < 3) return refuse('not_ready');
      if (r.invitee === user.id) {
        if (r.invitee_claimed_at) return json(200, { ok: true, fresh: false, side: 'invitee' });
        r.invitee_claimed_at = iso();
        return json(200, { ok: true, fresh: true, side: 'invitee' });
      }
      if (r.inviter_claimed_at) return json(200, { ok: true, fresh: false, side: 'inviter' });
      if ([...referrals.values()].filter(x => x.inviter === user.id && x.inviter_claimed_at).length >= 10) return refuse('cap_reached');
      r.inviter_claimed_at = iso();
      return json(200, { ok: true, fresh: true, side: 'inviter' });
    }
  };

  // delete_my_account cascades.
  const forgetSocial = social.forget;
  social.forget = userId => {
    forgetSocial(userId);
    gone(userId);
    for (const [k, i] of invites) if (i.from_user === userId || i.to_user === userId) invites.delete(k);
    for (const [k, t] of tallies) if (t.user_id === userId) tallies.delete(k);
    for (const [k, x] of claims) if (x.user_id === userId) claims.delete(k);
    for (let i = notes.length - 1; i >= 0; i--) if (notes[i].author === userId) notes.splice(i, 1);
    for (const k of [...activeDays]) if (k.startsWith(userId + '|')) activeDays.delete(k);
    for (const [k, r] of referrals) if (r.invitee === userId || r.inviter === userId) referrals.delete(k);
    for (let i = actions.length - 1; i >= 0; i--) if (actions[i].user_id === userId) actions.splice(i, 1);
  };
  // Test helpers: a played day for a player, as if they had opened the game then.
  api.addActiveDay = (userId, day) => activeDays.add(userId + '|' + day);
  api.ageReferral = (invitee, days) => { const r = referrals.get(invitee); if (r) r.created_at = iso(now() - days * DAY); };
  Object.assign(api, { RPC, covens, members, invites, weeks, tallies, claims, notes, activeDays, referrals, actions, weekRow, weekOf, today });
  social.coven = api;
  return api;
}
