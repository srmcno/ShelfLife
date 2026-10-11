// The functions of supabase/migrations/0003_postbox_visits.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers, same refusals
// (errcode P0001 with a token as the message). test/postbox_sql.test.mjs
// checks the real SQL against the same rules.
//
// It sits beside fake-social.mjs and reads its friendships, blocks, shelves and
// summonses. `wrap(RPC)` adds what 0003's triggers add to 0002: Do not
// disturb on new summonses, a friendship point for a heard case, and the
// tidying when one player blocks or unfriends another.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const TREAT = /^[a-z0-9-]{1,24}$/;
export const STAMPS = ['skull', 'candle', 'moth', 'teeth', 'coffin', 'eye'];
export const BUMP_CAPS = { case: 3, visit: 2, gift: 1, signature: 1, trade: 3, hearing: 3, wave: 1 };
const DAY = 86400000, HOUR = 3600000;
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export function createFakePostbox({ social, users, profiles, now, json, rest, uuid }) {
  const prefs = new Map(), points = new Map();
  const visits = [], gifts = [], guestbook = [], waves = [];
  const iso = (t = now()) => new Date(t).toISOString();
  const ms = value => value ? Date.parse(value) : 0;
  const day = (t = now()) => new Date(t).toISOString().slice(0, 10);
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const ok = body => json(200, body);
  const nameOf = id => profiles.get(id)?.display_name || '';
  const friends = (a, b) => social.friendships.some(f => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const blockedEither = (a, b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const dnd = id => prefs.get(id)?.dnd === true;
  const drop = (list, test) => { for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) list.splice(i, 1); };
  const pair = (row, a, b) => (row.from_user === a && row.to_user === b) || (row.from_user === b && row.to_user === a);
  // null when the caller may write to `other`, otherwise the refusal.
  function friendCheck(uid, other, respectDnd) {
    if (!other || other === uid || !friends(uid, other) || blockedEither(uid, other)) return refuse('not_friends');
    if (respectDnd && dnd(other)) return refuse('dnd');
    return null;
  }

  function bump(a, b, kind) {
    const cap = BUMP_CAPS[kind];
    if (!a || !b || a === b || !cap || !friends(a, b)) return 0;
    const key = [a, b].sort().join('|') + '|' + kind;
    const row = points.get(key) || { total: 0, day: day(), today: 0 };
    if (row.day !== day()) { row.day = day(); row.today = 0; }
    points.set(key, row);
    if (row.today >= cap) return row.total;
    row.total++; row.today++;
    return row.total;
  }

  function tidy(uid) {
    const t = now();
    for (const v of visits) {
      if (v.from_user !== uid && v.to_user !== uid) continue;
      if (v.status === 'pending' && ms(v.created_at) <= t - 48 * HOUR) Object.assign(v, { status: 'lapsed', ended_at: iso(ms(v.created_at) + 48 * HOUR) });
      if (v.status === 'accepted' && ms(v.ends_at) <= t) Object.assign(v, { status: 'ended', ended_at: v.ends_at });
    }
    const old = row => ms(row.created_at) < t - 60 * DAY;
    drop(visits, v => (v.from_user === uid || v.to_user === uid) && old(v));
    drop(gifts, g => (g.from_user === uid || g.to_user === uid) && old(g));
    drop(guestbook, s => (s.owner === uid || s.signer === uid) && old(s));
    drop(waves, w => (w.from_user === uid || w.to_user === uid) && old(w));
  }

  const RPC = {
    set_dnd(user, { p_on }) {
      const p = prefs.get(user.id) || { dnd: false, toggled_at: now(), toggles: 0 };
      if (p.toggled_at < now() - HOUR) p.toggles = 0;
      if (p.toggles >= 20) return refuse('rate_limited');
      if (p.toggles === 0) p.toggled_at = now();
      p.toggles++; p.dnd = p_on === true;
      prefs.set(user.id, p);
      return ok({ ok: true, dnd: p.dnd });
    },

    send_visit(user, { p_to, p_resident, p_days }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      const uid = user.id;
      const no = friendCheck(uid, p_to, true);
      if (no) return no;
      if (!Number.isInteger(p_days) || p_days < 1 || p_days > 3) return refuse('bad_visit');
      if (!record(p_resident) || typeof p_resident.id !== 'string' || !PET_ID.test(p_resident.id)) return refuse('bad_visit');
      if (size(p_resident) >= 150000) return refuse('too_large');
      tidy(uid); tidy(p_to);
      const rid = p_resident.id, open = v => v.status === 'pending' || v.status === 'accepted';
      if (visits.filter(v => v.from_user === uid && ms(v.created_at) > now() - DAY).length >= 6) return refuse('rate_limited');
      if (visits.some(v => v.from_user === uid && v.to_user === p_to && open(v))) return refuse('already_visiting');
      if (visits.some(v => v.from_user === uid && v.resident_id === rid && open(v))) return refuse('already_away');
      if (visits.filter(v => v.to_user === p_to && v.status === 'pending').length >= 5) return refuse('too_many_open');
      if (visits.filter(v => v.to_user === p_to && v.status === 'accepted').length >= 2) return refuse('shelf_full');
      const v = { id: uuid(), from_user: uid, to_user: p_to, resident_id: rid, resident_name: clean(p_resident.name, 22),
        resident: JSON.parse(JSON.stringify(p_resident)), days: p_days, status: 'pending', created_at: iso(), accepted_at: null, ends_at: null,
        ended_at: null, fed: 0, fussed: 0, washed: 0, last_care_at: 0, sender_seen_at: null, host_seen_at: null, sender_souls: 0, host_souls: 0 };
      visits.push(v);
      return ok({ ok: true, id: v.id, created_at: v.created_at });
    },
    withdraw_visit(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      tidy(user.id);
      const v = visits.find(x => x.id === p_id && x.from_user === user.id && x.status === 'pending');
      if (!v) return refuse('not_open');
      Object.assign(v, { status: 'withdrawn', ended_at: iso(), sender_seen_at: iso() });
      return ok({ ok: true });
    },
    respond_visit(user, { p_id, p_accept }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      tidy(user.id);
      const v = visits.find(x => x.id === p_id && x.to_user === user.id);
      if (!v || blockedEither(user.id, v.from_user)) return refuse('not_found');
      if (v.status === 'lapsed') return refuse('expired');
      if (v.status !== 'pending') return refuse('not_open');
      if (p_accept === true) {
        if (!friends(user.id, v.from_user)) return refuse('not_friends');
        if (visits.filter(x => x.to_user === user.id && x.status === 'accepted').length >= 2) return refuse('shelf_full');
        Object.assign(v, { status: 'accepted', accepted_at: iso(), ends_at: iso(now() + v.days * DAY) });
        bump(user.id, v.from_user, 'visit');
      } else Object.assign(v, { status: 'declined', ended_at: iso() });
      return ok({ ok: true, status: v.status, accepted_at: v.accepted_at, ends_at: v.ends_at });
    },
    care_visit(user, { p_id, p_kind }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const field = { food: 'fed', fuss: 'fussed', clean: 'washed' }[p_kind];
      if (!field) return refuse('bad_visit');
      tidy(user.id);
      const v = visits.find(x => x.id === p_id && x.to_user === user.id);
      if (!v || blockedEither(user.id, v.from_user)) return refuse('not_found');
      if (v.status !== 'accepted') return refuse('not_open');
      if (v.last_care_at && v.last_care_at > now() - 3000) return refuse('too_soon');
      if (v[field] >= 30) return refuse('care_full');
      v[field]++; v.last_care_at = now();
      return ok({ ok: true, fed: v.fed, fussed: v.fussed, washed: v.washed });
    },
    collect_visit(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const uid = user.id;
      tidy(uid);
      const v = visits.find(x => x.id === p_id && (x.from_user === uid || x.to_user === uid));
      if (!v || blockedEither(v.from_user, v.to_user)) return refuse('not_found');
      const role = v.from_user === uid ? 'sender' : 'host';
      if ((role === 'sender' && (!['ended', 'declined', 'lapsed'].includes(v.status) || v.sender_seen_at)) ||
          (role === 'host' && (v.status !== 'ended' || v.host_seen_at))) return refuse('not_open');
      let souls = 0;
      if (v.status === 'ended') {
        const today = day();
        const paid = visits.filter(x => (x.from_user === uid && x.sender_souls > 0 && day(ms(x.sender_seen_at)) === today) ||
          (x.to_user === uid && x.host_souls > 0 && day(ms(x.host_seen_at)) === today)).length;
        if (paid < 3) souls = role === 'sender' ? 8 : 6;
      }
      if (role === 'sender') Object.assign(v, { sender_seen_at: iso(), sender_souls: souls });
      else Object.assign(v, { host_seen_at: iso(), host_souls: souls });
      const other = role === 'sender' ? v.to_user : v.from_user;
      return ok({ ok: true, id: v.id, role, status: v.status, souls, fed: v.fed, fussed: v.fussed, washed: v.washed, days: v.days,
        resident_id: v.resident_id, resident_name: v.resident_name, other_user: other, other_name: nameOf(other) });
    },

    send_gift(user, { p_to, p_treat }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      const no = friendCheck(user.id, p_to, true);
      if (no) return no;
      if (typeof p_treat !== 'string' || !TREAT.test(p_treat)) return refuse('bad_treat');
      const today = day();
      if (gifts.some(g => g.from_user === user.id && g.to_user === p_to && g.day === today)) return refuse('already_sent');
      if (gifts.filter(g => g.from_user === user.id && g.day === today).length >= 20) return refuse('rate_limited');
      const g = { id: uuid(), from_user: user.id, to_user: p_to, treat: p_treat, day: today, status: 'sent', souls: 0, created_at: iso(), opened_at: null, cleared_at: null };
      gifts.push(g);
      return ok({ ok: true, id: g.id, created_at: g.created_at });
    },
    open_gift(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const g = gifts.find(x => x.id === p_id && x.to_user === user.id);
      if (!g || blockedEither(user.id, g.from_user)) return refuse('not_found');
      if (g.status !== 'sent') return refuse('not_open');
      if (ms(g.created_at) <= now() - 7 * DAY) return refuse('expired');
      const today = day();
      const paid = gifts.filter(x => x.to_user === user.id && x.souls > 0 && day(ms(x.opened_at)) === today).length;
      Object.assign(g, { status: 'opened', opened_at: iso(), souls: paid < 5 ? 4 : 0 });
      bump(user.id, g.from_user, 'gift');
      return ok({ ok: true, id: g.id, treat: g.treat, souls: g.souls });
    },
    decline_gift(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const g = gifts.find(x => x.id === p_id && x.to_user === user.id && x.status === 'sent');
      if (!g) return refuse('not_found');
      Object.assign(g, { status: 'declined', opened_at: iso() });
      return ok({ ok: true });
    },

    sign_guestbook(user, { p_owner, p_line, p_stamp }) {
      if (!UUID.test(p_owner || '')) return badType('uuid');
      const no = friendCheck(user.id, p_owner, false);
      if (no) return no;
      if (!Number.isInteger(p_line) || p_line < 0 || p_line > 23) return refuse('bad_line');
      if (!STAMPS.includes(p_stamp)) return refuse('bad_stamp');
      const today = day();
      if (guestbook.some(s => s.owner === p_owner && s.signer === user.id && s.day === today)) return refuse('already_signed');
      if (guestbook.filter(s => s.signer === user.id && s.day === today).length >= 20) return refuse('rate_limited');
      const s = { id: uuid(), owner: p_owner, signer: user.id, line: p_line, stamp: p_stamp, day: today, created_at: iso(), seen_at: null, cleared_at: null };
      guestbook.push(s);
      const book = guestbook.filter(x => x.owner === p_owner).sort((a, b) => b.created_at.localeCompare(a.created_at));
      for (const extra of book.slice(60)) guestbook.splice(guestbook.indexOf(extra), 1);
      bump(user.id, p_owner, 'signature');
      return ok({ ok: true, id: s.id, created_at: s.created_at });
    },
    remove_signature(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const i = guestbook.findIndex(s => s.id === p_id && (s.owner === user.id || s.signer === user.id));
      if (i < 0) return refuse('not_found');
      guestbook.splice(i, 1);
      return ok({ ok: true });
    },
    guestbook(user, { p_owner }) {
      if (!UUID.test(p_owner || '')) return badType('uuid');
      const uid = user.id;
      if (p_owner !== uid && (!friends(uid, p_owner) || blockedEither(uid, p_owner))) return refuse('not_friends');
      tidy(uid);
      const entries = guestbook.filter(s => s.owner === p_owner && (p_owner === uid || s.signer === uid) && !blockedEither(s.owner, s.signer))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
        .map(s => ({ id: s.id, signer: s.signer, signer_name: nameOf(s.signer), line: s.line, stamp: s.stamp, created_at: s.created_at }));
      return ok({ owner: p_owner, signed_today: guestbook.some(s => s.owner === p_owner && s.signer === uid && s.day === day()), entries });
    },

    send_wave(user, { p_to, p_resident, p_kind, p_line }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      const no = friendCheck(user.id, p_to, true);
      if (no) return no;
      if (!['wave', 'poke'].includes(p_kind) || !Number.isInteger(p_line) || p_line < 0 || p_line > 15 || typeof p_resident !== 'string' || !PET_ID.test(p_resident)) return refuse('bad_wave');
      const list = social.shelves.get(p_to)?.snapshot?.residents;
      const who = Array.isArray(list) ? list.find(r => record(r) && r.id === p_resident)?.name : undefined;
      if (typeof who !== 'string') return refuse('not_found');
      const today = day();
      if (waves.filter(w => w.from_user === user.id && w.to_user === p_to && w.day === today).length >= 3) return refuse('rate_limited');
      if (waves.filter(w => w.from_user === user.id && w.day === today).length >= 30) return refuse('rate_limited');
      const w = { id: uuid(), from_user: user.id, to_user: p_to, resident_id: p_resident, resident_name: clean(who, 22), kind: p_kind, line: p_line,
        day: today, created_at: iso(), seen_at: null, cleared_at: null };
      waves.push(w);
      bump(user.id, p_to, 'wave');
      return ok({ ok: true, id: w.id, resident_name: w.resident_name });
    },

    postbox(user) {
      const uid = user.id, t = now(), today = day();
      tidy(uid);
      const newest = (a, b) => (b.created_at || '').localeCompare(a.created_at || '');
      const open = row => !blockedEither(row.from_user, row.to_user);
      const requests = visits.filter(v => v.to_user === uid && v.status === 'pending' && open(v)).sort(newest).slice(0, 10)
        .map(v => ({ id: v.id, from_user: v.from_user, from_name: nameOf(v.from_user), resident: v.resident, days: v.days, created_at: v.created_at }));
      const guests = visits.filter(v => v.to_user === uid && v.status === 'accepted' && open(v)).sort((a, b) => a.accepted_at.localeCompare(b.accepted_at)).slice(0, 2)
        .map(v => ({ id: v.id, from_user: v.from_user, from_name: nameOf(v.from_user), resident: v.resident, days: v.days, accepted_at: v.accepted_at,
          ends_at: v.ends_at, fed: v.fed, fussed: v.fussed, washed: v.washed }));
      const away = visits.filter(v => v.from_user === uid && ['pending', 'accepted'].includes(v.status) && open(v)).sort(newest).slice(0, 50)
        .map(v => ({ id: v.id, to_user: v.to_user, to_name: nameOf(v.to_user), resident_id: v.resident_id, resident_name: v.resident_name,
          status: v.status, days: v.days, created_at: v.created_at, ends_at: v.ends_at }));
      const endings = visits.filter(v => open(v) && ((v.from_user === uid && !v.sender_seen_at && ['ended', 'declined', 'lapsed'].includes(v.status)) ||
        (v.to_user === uid && !v.host_seen_at && v.status === 'ended')))
        .sort((a, b) => (b.ended_at || '').localeCompare(a.ended_at || '')).slice(0, 20)
        .map(v => {
          const role = v.from_user === uid ? 'sender' : 'host', other = role === 'sender' ? v.to_user : v.from_user;
          return { id: v.id, role, other_user: other, other_name: nameOf(other), resident_id: v.resident_id, resident_name: v.resident_name,
            status: v.status, days: v.days, fed: v.fed, fussed: v.fussed, washed: v.washed, ended_at: v.ended_at };
        });
      const giftRows = gifts.filter(g => g.to_user === uid && !g.cleared_at && (g.status !== 'sent' || ms(g.created_at) > t - 7 * DAY) && open(g)).sort(newest).slice(0, 30)
        .map(g => ({ id: g.id, from_user: g.from_user, from_name: nameOf(g.from_user), treat: g.treat, status: g.status, souls: g.souls, created_at: g.created_at }));
      const signatures = guestbook.filter(s => s.owner === uid && !s.cleared_at && !blockedEither(s.owner, s.signer)).sort(newest).slice(0, 30)
        .map(s => ({ id: s.id, signer: s.signer, signer_name: nameOf(s.signer), line: s.line, stamp: s.stamp, created_at: s.created_at, seen: !!s.seen_at }));
      const waveRows = waves.filter(w => w.to_user === uid && !w.cleared_at && open(w)).sort(newest).slice(0, 30)
        .map(w => ({ id: w.id, from_user: w.from_user, from_name: nameOf(w.from_user), resident_id: w.resident_id, resident_name: w.resident_name,
          kind: w.kind, line: w.line, created_at: w.created_at, seen: !!w.seen_at }));
      const levels = new Map();
      for (const [key, row] of points) {
        const [a, b, kind] = key.split('|');
        if (a !== uid && b !== uid) continue;
        if (!friends(a, b)) continue;
        const other = a === uid ? b : a;
        const entry = levels.get(other) || { user_id: other, kinds: {}, total: 0 };
        entry.kinds[kind] = row.total; entry.total += row.total;
        levels.set(other, entry);
      }
      return ok({ dnd: dnd(uid), requests, guests, away, endings, gifts: giftRows, signatures, waves: waveRows, levels: [...levels.values()],
        gifted_today: [...new Set(gifts.filter(g => g.from_user === uid && g.day === today).map(g => g.to_user))],
        signed_today: [...new Set(guestbook.filter(s => s.signer === uid && s.day === today).map(s => s.owner))] });
    },
    friend_strips(user) {
      const others = social.friendships.filter(f => f.status === 'accepted' && (f.requester === user.id || f.addressee === user.id))
        .map(f => f.requester === user.id ? f.addressee : f.requester);
      return ok(others.filter(id => social.shelves.has(id)).map(id => {
        const raw = social.shelves.get(id).snapshot?.residents, list = Array.isArray(raw) ? raw : [];
        return { user_id: id, count: list.length, residents: list.slice(0, 5).filter(record).map(r => ({ id: r.id ?? null, name: r.name ?? null, mood: r.mood ?? null,
          art: record(r.art) && Object.hasOwn(r.art, 'creature') ? { creature: r.art.creature } : null })) };
      }));
    },
    postbox_seen(user) {
      for (const w of waves) if (w.to_user === user.id && !w.seen_at) w.seen_at = iso();
      for (const s of guestbook) if (s.owner === user.id && !s.seen_at) s.seen_at = iso();
      return ok({ ok: true });
    },
    postbox_clear(user) {
      for (const w of waves) if (w.to_user === user.id && w.seen_at && !w.cleared_at) w.cleared_at = iso();
      for (const s of guestbook) if (s.owner === user.id && s.seen_at && !s.cleared_at) s.cleared_at = iso();
      for (const g of gifts) if (g.to_user === user.id && g.status !== 'sent' && !g.cleared_at) g.cleared_at = iso();
      return ok({ ok: true });
    }
  };

  // What 0003's triggers do to 0002's tables.
  function onBlock(a, b) {
    drop(visits, v => pair(v, a, b));
    drop(gifts, g => pair(g, a, b));
    drop(guestbook, s => (s.owner === a && s.signer === b) || (s.owner === b && s.signer === a));
    drop(waves, w => pair(w, a, b));
    for (const key of [...points.keys()]) if (key.startsWith([a, b].sort().join('|') + '|')) points.delete(key);
  }
  function onUnfriend(a, b) {
    for (const v of visits) if (['pending', 'accepted'].includes(v.status) && pair(v, a, b)) {
      Object.assign(v, { status: v.status === 'pending' ? 'withdrawn' : 'ended', ended_at: iso(), sender_seen_at: v.sender_seen_at || iso(), host_seen_at: v.host_seen_at || iso() });
    }
    drop(gifts, g => g.status === 'sent' && pair(g, a, b));
    drop(waves, w => pair(w, a, b));
  }
  function wrap(base) {
    const { send_summons, rule_summons, block_user, remove_friend } = base;
    return {
      send_summons(user, args) {
        if (UUID.test(args?.p_to || '') && friends(user.id, args.p_to) && dnd(args.p_to)) return refuse('dnd');
        return send_summons(user, args);
      },
      rule_summons(user, args) {
        const s = social.summons.get(args?.p_id), was = s?.status;
        const out = rule_summons(user, args);
        if (s && was === 'open' && s.status === 'ruled') bump(s.from_user, s.to_user, 'case');
        return out;
      },
      block_user(user, args) {
        const wasFriend = UUID.test(args?.p_user || '') && friends(user.id, args.p_user);
        const out = block_user(user, args);
        if (out.status === 200) { if (wasFriend) onUnfriend(user.id, args.p_user); onBlock(user.id, args.p_user); }
        return out;
      },
      remove_friend(user, args) {
        const out = remove_friend(user, args);
        if (out.status === 200) onUnfriend(user.id, args.p_user);
        return out;
      }
    };
  }

  function forget(userId) {
    prefs.delete(userId);
    for (const key of [...points.keys()]) if (key.split('|').slice(0, 2).includes(userId)) points.delete(key);
    drop(visits, v => v.from_user === userId || v.to_user === userId);
    drop(gifts, g => g.from_user === userId || g.to_user === userId);
    drop(guestbook, s => s.owner === userId || s.signer === userId);
    drop(waves, w => w.from_user === userId || w.to_user === userId);
  }

  return { RPC, wrap, forget, bump, prefs, points, visits, gifts, guestbook, waves };
}
