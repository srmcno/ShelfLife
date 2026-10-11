// The functions of supabase/migrations/0007_mischief.sql, in memory, for
// test/support/fake-supabase.mjs. Same arguments, same answers, same refusals
// (errcode P0001 with a token as the message) and the same server rolls, so
// the client cannot tell the difference. test/mischief_sql.test.mjs checks
// the real SQL against the same rules; test/mischief_fake.test.mjs checks this.
import { createHash } from 'node:crypto';
import { HEX_IDS, TRICK_IDS, BOWLS } from '../../src/content/mischief.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESIDENT = /^[a-zA-Z0-9_-]{1,100}$/;
const HOUR = 3600000, DAY = 24 * HOUR;
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));
const md5 = text => createHash('md5').update(text).digest('hex');
export const mischiefRoll = seed => parseInt(md5(seed).slice(0, 7), 16);
export const hexHand = (userId, day) => HEX_IDS.map(card => ({ card, k: md5(userId + ':' + day + ':' + card) }))
  .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).slice(0, 3).map(x => x.card);
const ODDS = Object.fromEntries(BOWLS.map(b => [b.id, [b.treat, b.curio, b.lo, b.hi]]));

export function createFakeMischief({ social, users, profiles, now, json, rest, uuid, rpc = null }) {
  const hexes = new Map(), hauntings = new Map(), helps = new Map(), knocks = new Map(), doorsteps = new Map();
  const dnd = new Set(), bumps = [];
  const refuse = token => rest(400, 'P0001', token);
  const badType = type => rest(400, '22P02', 'invalid input syntax for type ' + type);
  const iso = t => new Date(t).toISOString();
  const today = () => iso(now()).slice(0, 10);
  const nameOf = id => profiles.get(id)?.display_name || '';
  const friendsWith = (a, b) => social.friendships.some(f => f.status === 'accepted' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)));
  const blocked = (a, b) => social.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const visible = (a, b) => friendsWith(a, b) && !blocked(a, b);
  const between = (row, a, b) => (row.from_user === a && row.to_user === b) || (row.from_user === b && row.to_user === a);
  const inSeason = () => { const md = iso(now()).slice(5, 10).replace('-', ''); return md >= '1014' && md <= '1103'; };
  function friendCheck(uid, other, respectDnd) {
    if (!other || other === uid || !visible(uid, other)) return refuse('not_friends');
    if (respectDnd && dnd.has(other)) return refuse('dnd');
    return null;
  }
  function shelfResident(owner, id) {
    const residents = social.shelves.get(owner)?.snapshot?.residents;
    const r = Array.isArray(residents) ? residents.find(x => record(x) && x.id === id) : null;
    return r ? copy(r) : null;
  }
  function tidy(uid) {
    const cutoff = now() - 30 * DAY;
    for (const table of [hexes, hauntings, helps, knocks]) for (const [id, row] of table) {
      if (Date.parse(row.created_at) < cutoff && (row.from_user === uid || row.to_user === uid)) table.delete(id);
    }
  }
  const bump = (a, b, kind) => bumps.push({ a, b, kind });

  const RPC = {
    mischief_inbox(user) {
      const uid = user.id, t = now(), d = today();
      tidy(uid);
      const all = table => [...table.values()];
      const mine = all(hauntings).filter(g => g.from_user === uid && Date.parse(g.created_at) > t - 7 * DAY);
      const status = {
        day: d, now: iso(t), hand: hexHand(uid, d),
        hexed_today: all(hexes).some(h => h.from_user === uid && h.day === d && !h.free),
        haunt_ready: !mine.length,
        haunt_next_at: mine.length ? iso(Math.max(...mine.map(g => Date.parse(g.created_at))) + 7 * DAY) : null,
        helped: [...new Set(all(helps).filter(p => p.from_user === uid && p.day === d).map(p => p.to_user))],
        helps_given: all(helps).filter(p => p.from_user === uid && p.day === d).length,
        knocked: [...new Set(all(knocks).filter(k => k.from_user === uid && k.night === d).map(k => k.to_user))],
        season: inSeason(),
        rebounds: all(hexes).filter(h => h.to_user === uid && h.status === 'resolved' && h.rebound && Date.parse(h.resolved_at) > t - 48 * HOUR
            && !all(hexes).some(r => r.rebound_of === h.id) && visible(uid, h.from_user))
          .sort((a, b) => b.resolved_at.localeCompare(a.resolved_at)).map(h => ({ id: h.id, to_user: h.from_user, card: h.card }))
      };
      const waiting = all(hexes).filter(h => h.to_user === uid && h.status === 'waiting' && Date.parse(h.expires_at) > t)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 5).filter(h => visible(uid, h.from_user))
        .map(h => ({ id: h.id, from_user: h.from_user, from_name: nameOf(h.from_user), card: h.card, culprit: copy(h.culprit), created_at: h.created_at, expires_at: h.expires_at, rebound: h.free }));
      const haunting = all(hauntings).filter(g => g.to_user === uid && g.status === 'haunting' && Date.parse(g.ends_at) > t)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 3).filter(g => visible(uid, g.from_user))
        .map(g => ({ id: g.id, from_user: g.from_user, from_name: nameOf(g.from_user), ghost: copy(g.ghost), created_at: g.created_at, ends_at: g.ends_at }));
      const pending = all(helps).filter(p => p.to_user === uid && !p.applied_at && Date.parse(p.created_at) > t - 7 * DAY)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 10).filter(p => visible(uid, p.from_user))
        .map(p => ({ id: p.id, from_user: p.from_user, from_name: nameOf(p.from_user), resident_id: p.resident_id, resident_name: p.resident_name, need: p.need, amount: p.amount, created_at: p.created_at }));
      const when = h => h.resolved_at || h.expires_at;
      const results = all(hexes).filter(h => h.from_user === uid && !h.sender_seen_at && (h.status !== 'waiting' || Date.parse(h.expires_at) <= t))
        .sort((a, b) => when(b).localeCompare(when(a))).slice(0, 20).filter(h => !blocked(uid, h.to_user))
        .map(h => ({ id: h.id, to_user: h.to_user, to_name: nameOf(h.to_user), card: h.card, culprit_id: h.culprit?.id ?? null, culprit_name: h.culprit?.name ?? null,
          status: h.status === 'waiting' ? 'expired' : h.status, choice: h.choice, outcome: h.outcome, rebound: h.rebound, at: when(h) }));
      const ended = g => g.shooed_at || g.ends_at;
      const hauntResults = all(hauntings).filter(g => g.from_user === uid && !g.sender_seen_at && (g.status === 'shooed' || Date.parse(g.ends_at) <= t))
        .sort((a, b) => ended(b).localeCompare(ended(a))).slice(0, 10).filter(g => !blocked(uid, g.to_user))
        .map(g => ({ id: g.id, to_user: g.to_user, to_name: nameOf(g.to_user), ghost_name: g.ghost?.name ?? null, status: g.status === 'shooed' ? 'shooed' : 'ended', taps: g.taps, at: ended(g) }));
      const door = all(knocks).filter(k => k.to_user === uid && k.night === d).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return json(200, { status, hexes: waiting, hauntings: haunting, helps: pending, results, haunt_results: hauntResults,
        doorstep: { bowl: doorsteps.get(uid)?.bowl || 'none', count: door.length,
          knocks: door.slice(0, 30).map(k => ({ id: k.id, from_user: k.from_user, from_name: nameOf(k.from_user), result: k.result, created_at: k.created_at })) } });
    },
    send_hex(user, { p_to, p_card, p_culprit, p_rebound = null }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      if (p_rebound !== null && p_rebound !== undefined && !UUID.test(p_rebound)) return badType('uuid');
      const uid = user.id, t = now(), d = today();
      const no = friendCheck(uid, p_to, true);
      if (no) return no;
      if (!HEX_IDS.includes(p_card)) return refuse('bad_card');
      if (typeof p_culprit !== 'string' || !RESIDENT.test(p_culprit)) return refuse('bad_culprit');
      const culprit = shelfResident(uid, p_culprit);
      if (!culprit) return refuse('bad_culprit');
      if (size(culprit) >= 150000) return refuse('too_large');
      if (p_rebound) {
        const orig = hexes.get(p_rebound);
        if (!orig || orig.to_user !== uid || orig.from_user !== p_to || orig.status !== 'resolved' || !orig.rebound
          || Date.parse(orig.resolved_at) <= t - 48 * HOUR || [...hexes.values()].some(h => h.rebound_of === p_rebound)) return refuse('no_rebound');
      } else {
        if (!hexHand(uid, d).includes(p_card)) return refuse('not_in_hand');
        if ([...hexes.values()].some(h => h.from_user === uid && h.day === d && !h.free)) return refuse('hexed_today');
      }
      if ([...hexes.values()].filter(h => h.to_user === p_to && h.status === 'waiting' && Date.parse(h.expires_at) > t).length >= 2) return refuse('shelf_full');
      const row = { id: uuid(), from_user: uid, to_user: p_to, card: p_card, culprit, rebound_of: p_rebound || null, free: !!p_rebound,
        status: 'waiting', choice: null, outcome: null, rebound: false, day: d, created_at: iso(t), expires_at: iso(t + 48 * HOUR), resolved_at: null, sender_seen_at: null };
      hexes.set(row.id, row);
      return json(200, { ok: true, id: row.id, expires_at: row.expires_at });
    },
    resolve_hex(user, { p_id, p_choice, p_outcome, p_rebound }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      if (![p_choice, p_outcome].every(n => n === null || n === undefined || Number.isInteger(n))) return badType('integer');
      if (!(p_choice >= 0 && p_choice <= 3 && p_outcome >= 0 && p_outcome <= 3)) return refuse('bad_hex');
      const h = hexes.get(p_id);
      if (!h || h.to_user !== user.id) return refuse('not_found');
      if (h.status !== 'waiting') return refuse('not_open');
      if (Date.parse(h.expires_at) <= now()) return refuse('expired');
      Object.assign(h, { status: 'resolved', choice: p_choice, outcome: p_outcome, rebound: p_rebound === true, resolved_at: iso(now()) });
      bump(user.id, h.from_user, 'hex');
      return json(200, { ok: true });
    },
    decline_hex(user, { p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const h = hexes.get(p_id);
      if (!h || h.to_user !== user.id) return refuse('not_found');
      if (h.status !== 'waiting') return refuse('not_open');
      if (Date.parse(h.expires_at) <= now()) return refuse('expired');
      Object.assign(h, { status: 'declined', resolved_at: iso(now()) });
      return json(200, { ok: true });
    },
    mark_mischief_seen(user, { p_kind, p_id }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      const t = now();
      let row = null;
      if (p_kind === 'hex') { const h = hexes.get(p_id); if (h && h.from_user === user.id && !h.sender_seen_at && (h.status !== 'waiting' || Date.parse(h.expires_at) <= t)) row = h; }
      else if (p_kind === 'haunt') { const g = hauntings.get(p_id); if (g && g.from_user === user.id && !g.sender_seen_at && (g.status === 'shooed' || Date.parse(g.ends_at) <= t)) row = g; }
      else return refuse('bad_kind');
      if (row) row.sender_seen_at = iso(t);
      return json(200, { ok: !!row });
    },
    send_haunt(user, { p_to, p_resident }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      const uid = user.id, t = now();
      const no = friendCheck(uid, p_to, true);
      if (no) return no;
      if (typeof p_resident !== 'string' || !RESIDENT.test(p_resident)) return refuse('bad_culprit');
      const ghost = shelfResident(uid, p_resident);
      if (!ghost) return refuse('bad_culprit');
      if (size(ghost) >= 150000) return refuse('too_large');
      if ([...hauntings.values()].some(g => g.from_user === uid && Date.parse(g.created_at) > t - 7 * DAY)) return refuse('haunted_this_week');
      if ([...hauntings.values()].some(g => g.to_user === p_to && g.status === 'haunting' && Date.parse(g.ends_at) > t)) return refuse('already_haunted');
      const row = { id: uuid(), from_user: uid, to_user: p_to, ghost, status: 'haunting', taps: null, created_at: iso(t), ends_at: iso(t + DAY), shooed_at: null, sender_seen_at: null };
      hauntings.set(row.id, row);
      return json(200, { ok: true, id: row.id, ends_at: row.ends_at });
    },
    shoo_haunt(user, { p_id, p_taps }) {
      if (!UUID.test(p_id || '')) return badType('uuid');
      if (p_taps !== null && p_taps !== undefined && !Number.isInteger(p_taps)) return badType('integer');
      const g = hauntings.get(p_id);
      if (!g || g.to_user !== user.id) return refuse('not_found');
      if (g.status !== 'haunting' || Date.parse(g.ends_at) <= now()) return refuse('not_open');
      Object.assign(g, { status: 'shooed', shooed_at: iso(now()), taps: Math.min(99, Math.max(1, p_taps ?? 1)) });
      return json(200, { ok: true });
    },
    help_out(user, { p_to, p_resident, p_need }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      const uid = user.id, t = now(), d = today();
      const no = friendCheck(uid, p_to, true);
      if (no) return no;
      if (!['food', 'fuss', 'clean'].includes(p_need)) return refuse('bad_need');
      if (typeof p_resident !== 'string' || !RESIDENT.test(p_resident)) return refuse('not_needed');
      const r = shelfResident(p_to, p_resident);
      const level = record(r?.needs) && typeof r.needs[p_need] === 'number' ? r.needs[p_need] : null;
      if (level === null || level >= 50) return refuse('not_needed');
      const all = [...helps.values()];
      if (all.some(p => p.from_user === uid && p.to_user === p_to && p.day === d)) return refuse('helped_today');
      if (all.some(p => p.to_user === p_to && p.resident_id === p_resident && p.day === d)) return refuse('resident_helped');
      if (all.filter(p => p.to_user === p_to && p.day === d).length >= 3) return refuse('helps_full');
      if (all.filter(p => p.from_user === uid && p.day === d).length >= 5) return refuse('helped_enough');
      const row = { id: uuid(), from_user: uid, to_user: p_to, resident_id: p_resident,
        resident_name: String(r.name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 22), need: p_need, amount: 25, day: d, created_at: iso(t), applied_at: null };
      helps.set(row.id, row);
      bump(uid, p_to, 'help');
      return json(200, { ok: true, id: row.id, amount: row.amount });
    },
    ack_helps(user, { p_ids }) {
      if (!Array.isArray(p_ids) || p_ids.length > 20) return refuse('bad_help');
      if (!p_ids.every(id => UUID.test(id || ''))) return badType('uuid');
      let count = 0;
      for (const id of new Set(p_ids)) { const p = helps.get(id); if (p && p.to_user === user.id && !p.applied_at) { p.applied_at = iso(now()); count++; } }
      return json(200, { ok: true, count });
    },
    knock(user, { p_to }) {
      if (!UUID.test(p_to || '')) return badType('uuid');
      const uid = user.id, t = now(), d = today();
      if (!inSeason()) return refuse('out_of_season');
      const no = friendCheck(uid, p_to, true);
      if (no) return no;
      const all = [...knocks.values()];
      if (all.some(k => k.from_user === uid && k.to_user === p_to && k.night === d)) return refuse('knocked_tonight');
      if (all.filter(k => k.from_user === uid && k.night === d).length >= 30) return refuse('rate_limited');
      const bowl = doorsteps.get(p_to)?.bowl || 'none', odds = ODDS[bowl] || ODDS.none;
      const seed = uid + ':' + p_to + ':' + d;
      let result, prize, souls = 0, culprit = null;
      if (mischiefRoll(seed + ':door') % 100 < odds[0]) {
        result = 'treat';
        if (mischiefRoll(seed + ':curio') % 100 < odds[1]) prize = 'curio';
        else { prize = 'souls'; souls = odds[2] + mischiefRoll(seed + ':souls') % (odds[3] - odds[2] + 1); }
      } else {
        result = 'trick';
        prize = TRICK_IDS[mischiefRoll(seed + ':trick') % TRICK_IDS.length];
        const residents = social.shelves.get(p_to)?.snapshot?.residents;
        if (Array.isArray(residents) && residents.length) {
          const r = residents[mischiefRoll(seed + ':who') % residents.length];
          culprit = record(r) && size(r) < 150000 ? copy(r) : null;
        }
      }
      const row = { id: uuid(), from_user: uid, to_user: p_to, night: d, result, prize, souls, bowl, created_at: iso(t) };
      knocks.set(row.id, row);
      bump(uid, p_to, 'knock');
      return json(200, { ok: true, id: row.id, result, prize, souls, bowl, culprit });
    },
    set_bowl(user, { p_bowl }) {
      if (!ODDS[p_bowl]) return refuse('bad_bowl');
      const d = today(), row = doorsteps.get(user.id);
      const changes = row && row.day === d ? row.changes + 1 : 1;
      if (changes > 20) return refuse('rate_limited');
      doorsteps.set(user.id, { bowl: p_bowl, day: d, changes, updated_at: iso(now()) });
      return json(200, { ok: true, bowl: p_bowl });
    }
  };

  // A block takes everything between the two with it, as the trigger does.
  const block = (rpc || social.RPC).block_user;
  RPC.block_user = (user, args) => {
    const out = block(user, args);
    if (out.status === 200) forgetPair(user.id, args.p_user);
    return out;
  };
  function forgetPair(a, b) {
    for (const table of [hexes, hauntings, helps, knocks]) for (const [id, row] of table) if (between(row, a, b)) table.delete(id);
  }
  // delete_my_account cascades here too.
  function forget(userId) {
    for (const table of [hexes, hauntings, helps, knocks]) for (const [id, row] of table) if (row.from_user === userId || row.to_user === userId) table.delete(id);
    doorsteps.delete(userId);
    dnd.delete(userId);
  }
  const forgetSocial = social.forget;
  social.forget = userId => { forgetSocial(userId); forget(userId); };

  return { RPC, hexes, hauntings, helps, knocks, doorsteps, bumps, forget,
    setDnd(userId, on = true) { if (on) dnd.add(userId); else dnd.delete(userId); } };
}
