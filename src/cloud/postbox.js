// The postbox, visits, gifts, guestbooks, waves, friendship levels and Do not
// disturb, over the one cloud session. The schema is
// supabase/migrations/0003_postbox_visits.sql.
//
// Like src/cloud/social.js, every reply goes through a reader before the game
// touches it: ids are checked, text is clamped, lists are capped, and a friend's
// resident is rebuilt by readResident(). Nothing here runs by itself and
// nothing is queued: offline, a call fails at once and the button says why.
import { CloudError } from './client.js';
import { cleanText, cleanUuid, readResident, residentSnapshot, socialCode, socialText, MAX_SUMMONS_CHARS } from './social.js';
import { POSTBOX_TEXT, STAMP_IDS, TREAT_BY_ID } from '../content/postbox.js';

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const SLUG = /^[a-z0-9-]{1,24}$/;
const HOUR = 3600000, DAY = 86400000;
const time = value => { const t = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(t) && t > 0 ? t : 0; };
const int = (value, hi) => Number.isFinite(value) ? Math.max(0, Math.min(hi, Math.floor(value))) : 0;
const petId = value => typeof value === 'string' && PET_ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
export const LEVEL_KINDS = ['case', 'visit', 'gift', 'signature', 'trade', 'hearing', 'wave'];
export const REQUEST_LIFETIME = 48 * HOUR, GIFT_LIFETIME = 7 * DAY;

/* ---------------- readers ---------------- */

export function readRequest(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user), resident = readResident(raw.resident), createdAt = time(raw.created_at);
  if (!id || !fromUser || !resident || !createdAt || ![1, 2, 3].includes(raw.days)) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), resident, days: raw.days, createdAt, expiresAt: createdAt + REQUEST_LIFETIME };
}
export function readGuest(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user), resident = readResident(raw.resident);
  const arrived = time(raw.accepted_at), leaves = time(raw.ends_at);
  if (!id || !fromUser || !resident || !arrived || leaves <= arrived) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), resident, days: int(raw.days, 3) || 1, arrived, leaves,
    fed: int(raw.fed, 30), fussed: int(raw.fussed, 30), washed: int(raw.washed, 30) };
}
export function readAway(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), toUser = cleanUuid(raw.to_user);
  if (!id || !toUser || !petId(raw.resident_id) || !['pending', 'accepted'].includes(raw.status)) return null;
  return { id, toUser, toName: cleanText(raw.to_name, 24), residentId: raw.resident_id, residentName: cleanText(raw.resident_name, 22) || 'Someone',
    status: raw.status, days: int(raw.days, 3) || 1, createdAt: time(raw.created_at), leaves: time(raw.ends_at) };
}
export function readEnding(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), otherUser = cleanUuid(raw.other_user);
  if (!id || !otherUser || !['sender', 'host'].includes(raw.role) || !['ended', 'declined', 'lapsed'].includes(raw.status)) return null;
  if (raw.role === 'host' && raw.status !== 'ended') return null;
  return { id, role: raw.role, otherUser, otherName: cleanText(raw.other_name, 24), residentId: petId(raw.resident_id) ? raw.resident_id : '',
    residentName: cleanText(raw.resident_name, 22) || 'Someone', status: raw.status, days: int(raw.days, 3) || 1,
    fed: int(raw.fed, 30), fussed: int(raw.fussed, 30), washed: int(raw.washed, 30), endedAt: time(raw.ended_at) };
}
export function readGift(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user);
  if (!id || !fromUser || typeof raw.treat !== 'string' || !SLUG.test(raw.treat) || !['sent', 'opened', 'declined'].includes(raw.status)) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), treat: raw.treat, known: !!TREAT_BY_ID[raw.treat], status: raw.status,
    souls: int(raw.souls, 20), createdAt: time(raw.created_at) };
}
export function readSignature(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), signer = cleanUuid(raw.signer);
  if (!id || !signer || !Number.isInteger(raw.line) || raw.line < 0 || raw.line > 23 || !STAMP_IDS.includes(raw.stamp)) return null;
  return { id, signer, signerName: cleanText(raw.signer_name, 24), line: raw.line, stamp: raw.stamp, createdAt: time(raw.created_at), seen: raw.seen === true };
}
export function readWave(raw) {
  if (!record(raw)) return null;
  const id = cleanUuid(raw.id), fromUser = cleanUuid(raw.from_user);
  if (!id || !fromUser || !['wave', 'poke'].includes(raw.kind) || !Number.isInteger(raw.line) || raw.line < 0 || raw.line > 15) return null;
  return { id, fromUser, fromName: cleanText(raw.from_name, 24), residentId: petId(raw.resident_id) ? raw.resident_id : '',
    residentName: cleanText(raw.resident_name, 22) || 'Someone', kind: raw.kind, line: raw.line, createdAt: time(raw.created_at), seen: raw.seen === true };
}
export function readLevel(raw) {
  if (!record(raw)) return null;
  const userId = cleanUuid(raw.user_id);
  if (!userId) return null;
  const kinds = {};
  for (const kind of LEVEL_KINDS) kinds[kind] = int(record(raw.kinds) ? raw.kinds[kind] : 0, 100000);
  return { userId, kinds, total: Object.values(kinds).reduce((a, b) => a + b, 0) };
}
const list = (rows, read, cap) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows.slice(0, cap * 2) : []).map(read).filter(x => x && !seen.has(x.id || x.userId) && seen.add(x.id || x.userId)).slice(0, cap);
};
const users = rows => [...new Set((Array.isArray(rows) ? rows.slice(0, 400) : []).map(cleanUuid).filter(Boolean))];

export function blankBox() {
  return { dnd: false, requests: [], guests: [], away: [], endings: [], gifts: [], signatures: [], waves: [], levels: [], giftedToday: [], signedToday: [] };
}
export function readPostbox(raw, now = Date.now()) {
  const r = record(raw) ? raw : {};
  return {
    dnd: r.dnd === true,
    requests: list(r.requests, readRequest, 10).filter(x => x.expiresAt > now),
    guests: list(r.guests, readGuest, 2),
    away: list(r.away, readAway, 50),
    endings: list(r.endings, readEnding, 20),
    gifts: list(r.gifts, readGift, 30).filter(g => g.status !== 'sent' || g.createdAt > now - GIFT_LIFETIME),
    signatures: list(r.signatures, readSignature, 30),
    waves: list(r.waves, readWave, 30),
    levels: list(r.levels, readLevel, 200),
    giftedToday: users(r.gifted_today),
    signedToday: users(r.signed_today)
  };
}
export function readGuestbook(raw) {
  const r = record(raw) ? raw : {};
  return { owner: cleanUuid(r.owner), signedToday: r.signed_today === true, entries: list(r.entries, readSignature, 30) };
}
// The portraits in the friends list: { userId, count, residents: [readResident()] }.
export function readStrips(rows) {
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows.slice(0, 200) : []) {
    const userId = cleanUuid(row?.user_id);
    if (!userId || out.has(userId)) continue;
    const residents = (Array.isArray(row.residents) ? row.residents.slice(0, 5) : []).map(r => readResident(record(r) ? { ...r, art: r.art ?? undefined } : r)).filter(Boolean);
    out.set(userId, { userId, count: int(row.count, 99), residents });
  }
  return out;
}

// Waiting for the player: visit requests, endings to read, treats to open,
// and waves and signatures not yet seen.
export const boxCounts = box => ({
  visits: box.requests.length + box.endings.length,
  gifts: box.gifts.filter(g => g.status === 'sent').length,
  signatures: box.signatures.filter(s => !s.seen).length,
  waves: box.waves.filter(w => !w.seen).length
});
export const boxCount = box => Object.values(boxCounts(box)).reduce((a, b) => a + b, 0);

/* ---------------- refusals ---------------- */

const TOKENS = new Set(['dnd', 'shelf_full', 'already_visiting', 'already_away', 'already_sent', 'already_signed', 'too_soon', 'care_full',
  'expired', 'not_open', 'too_many_open', 'rate_limited', 'not_found', 'bad_visit', 'bad_treat', 'bad_line', 'bad_stamp', 'bad_wave']);
const ALIAS = { bad_visit: 'refused', bad_treat: 'refused', bad_line: 'refused', bad_stamp: 'refused', bad_wave: 'refused' };
export function postboxCode(error) {
  if (error?.code === 'P0001' && TOKENS.has(error.message)) return error.message;
  if (TOKENS.has(error?.code)) return error.code;
  return socialCode(error);
}
export function postboxText(error) {
  const code = postboxCode(error);
  return POSTBOX_TEXT[ALIAS[code] || code] || socialText(error);
}

/* ---------------- the wrappers ---------------- */

export function createPostbox({ cloud, social, now = Date.now } = {}) {
  const listeners = new Set();
  let box = blankBox(), boxUser = null, request = null, version = 0;
  const signedIn = () => !!cloud?.configured && cloud.signedIn();
  const active = () => !!social?.active?.();
  const uid = () => (signedIn() ? cloud.userId() : null);
  function emit() { const info = { count: count() }; listeners.forEach(fn => { try { fn(info); } catch { /* the UI's problem */ } }); }

  async function call(name, args = {}) {
    if (!signedIn()) throw new CloudError(socialText({ code: 'signed_out' }), { code: 'signed_out', status: 401 });
    try { return await cloud.rpc(name, args); }
    catch (error) {
      const code = postboxCode(error);
      throw Object.assign(new CloudError(POSTBOX_TEXT[ALIAS[code] || code] || socialText(error), { code, status: error?.status || 0, offline: code === 'offline' }), { offline: code === 'offline' });
    }
  }
  const user = value => { const id = cleanUuid(value); if (!id) throw new CloudError(POSTBOX_TEXT.not_found, { code: 'not_found' }); return id; };

  // The last postbox this account fetched, or a blank one.
  function state() { return boxUser && boxUser === uid() && active() ? box : blankBox(); }
  function count() {
    if (!active()) return 0;
    if (boxUser === uid()) return boxCount(box);
    const m = cloud.meta();
    return m.postboxUser === uid() ? int(m.postboxCount, 99) : 0;
  }
  function load() {
    const me = uid();
    if (!me || !active()) return Promise.resolve(blankBox());
    if (request?.user === me) return request.promise;
    const mine = { user: me, version };
    mine.promise = call('postbox').then(raw => {
      if (uid() !== me) return blankBox();
      if (mine.version !== version) return state();
      box = readPostbox(raw, now()); boxUser = me;
      cloud.setMeta({ postboxCount: boxCount(box), postboxUser: me });
      emit();
      return box;
    }).finally(() => { if (request === mine) request = null; });
    request = mine;
    return mine.promise;
  }
  // A change made here shows at once; the next load says what the server thinks.
  function edit(change) {
    if (boxUser !== uid()) return;
    version++;
    change(box);
    cloud.setMeta({ postboxCount: boxCount(box), postboxUser: boxUser });
    emit();
  }

  async function setDnd(on) {
    const r = await call('set_dnd', { p_on: !!on });
    edit(b => { b.dnd = r?.dnd === true; });
    return r?.dnd === true;
  }
  async function sendVisit({ to, pet, days }) {
    if (!pet || !petId(pet.id) || ![1, 2, 3].includes(days)) throw new CloudError(POSTBOX_TEXT.refused, { code: 'bad_visit' });
    let resident = residentSnapshot(pet);
    if (JSON.stringify(resident).length > MAX_SUMMONS_CHARS) resident = residentSnapshot(pet, { image: false });
    const r = await call('send_visit', { p_to: user(to), p_resident: resident, p_days: days });
    const id = cleanUuid(r?.id);
    edit(b => { b.away = [{ id, toUser: to, toName: '', residentId: pet.id, residentName: resident.name, status: 'pending', days, createdAt: now(), leaves: 0 }, ...b.away]; });
    return { id };
  }
  async function withdrawVisit(id) { await call('withdraw_visit', { p_id: user(id) }); edit(b => { b.away = b.away.filter(a => a.id !== id); }); return true; }
  async function respondVisit(id, accept) {
    const r = await call('respond_visit', { p_id: user(id), p_accept: !!accept });
    const status = r?.status === 'accepted' ? 'accepted' : 'declined';
    const req = box.requests.find(x => x.id === id);
    edit(b => {
      b.requests = b.requests.filter(x => x.id !== id);
      if (status === 'accepted' && req) {
        const arrived = time(r.accepted_at) || now(), leaves = time(r.ends_at) || arrived + req.days * DAY;
        b.guests = [...b.guests, { id, fromUser: req.fromUser, fromName: req.fromName, resident: req.resident, days: req.days, arrived, leaves, fed: 0, fussed: 0, washed: 0 }].slice(0, 2);
      }
    });
    return { status, request: req || null };
  }
  async function care(id, kind) {
    const r = await call('care_visit', { p_id: user(id), p_kind: kind });
    const counts = { fed: int(r?.fed, 30), fussed: int(r?.fussed, 30), washed: int(r?.washed, 30) };
    edit(b => { b.guests = b.guests.map(g => g.id === id ? { ...g, ...counts } : g); });
    return counts;
  }
  async function collect(id) {
    const r = await call('collect_visit', { p_id: user(id) });
    const ending = box.endings.find(e => e.id === id) || null;
    const read = readEnding({ ...r, ended_at: null });
    edit(b => { b.endings = b.endings.filter(e => e.id !== id); b.away = b.away.filter(a => a.id !== id); });
    return { ending: read || ending, souls: int(r?.souls, 20) };
  }
  async function sendGift(to, treat) {
    if (typeof treat !== 'string' || !SLUG.test(treat)) throw new CloudError(POSTBOX_TEXT.refused, { code: 'bad_treat' });
    const target = user(to);
    await call('send_gift', { p_to: target, p_treat: treat });
    edit(b => { b.giftedToday = [...new Set([...b.giftedToday, target])]; });
    return true;
  }
  async function openGift(id) {
    const r = await call('open_gift', { p_id: user(id) });
    const souls = int(r?.souls, 20);
    edit(b => { b.gifts = b.gifts.map(g => g.id === id ? { ...g, status: 'opened', souls } : g); });
    return { souls, treat: typeof r?.treat === 'string' && SLUG.test(r.treat) ? r.treat : '' };
  }
  async function declineGift(id) { await call('decline_gift', { p_id: user(id) }); edit(b => { b.gifts = b.gifts.map(g => g.id === id ? { ...g, status: 'declined' } : g); }); return true; }
  async function sign(owner, line, stamp) {
    if (!Number.isInteger(line) || line < 0 || line > 23 || !STAMP_IDS.includes(stamp)) throw new CloudError(POSTBOX_TEXT.refused, { code: 'bad_line' });
    const target = user(owner);
    await call('sign_guestbook', { p_owner: target, p_line: line, p_stamp: stamp });
    edit(b => { b.signedToday = [...new Set([...b.signedToday, target])]; });
    return true;
  }
  async function removeSignature(id) { await call('remove_signature', { p_id: user(id) }); edit(b => { b.signatures = b.signatures.filter(s => s.id !== id); }); return true; }
  const guestbook = async owner => readGuestbook(await call('guestbook', { p_owner: user(owner) }));
  async function wave({ to, residentId, kind = 'wave', line = 0 }) {
    if (!petId(residentId) || !['wave', 'poke'].includes(kind) || !Number.isInteger(line) || line < 0 || line > 15) throw new CloudError(POSTBOX_TEXT.refused, { code: 'bad_wave' });
    const r = await call('send_wave', { p_to: user(to), p_resident: residentId, p_kind: kind, p_line: line });
    return { residentName: cleanText(r?.resident_name, 22) };
  }
  async function seen() {
    if (!state().waves.some(w => !w.seen) && !state().signatures.some(s => !s.seen)) return false;
    await call('postbox_seen');
    edit(b => { b.waves = b.waves.map(w => ({ ...w, seen: true })); b.signatures = b.signatures.map(s => ({ ...s, seen: true })); });
    return true;
  }
  async function clear() {
    await call('postbox_clear');
    edit(b => { b.waves = b.waves.filter(w => !w.seen); b.signatures = b.signatures.filter(s => !s.seen); b.gifts = b.gifts.filter(g => g.status === 'sent'); });
    return true;
  }
  const strips = async () => readStrips(await call('friend_strips'));

  return {
    active, load, state, count, loaded: () => !!boxUser && boxUser === uid() && active(), setDnd, sendVisit, withdrawVisit, respondVisit, care, collect, sendGift, openGift, declineGift,
    sign, removeSignature, guestbook, wave, seen, clear, strips,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
