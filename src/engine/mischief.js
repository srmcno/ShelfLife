import { registerExternalCards, injectEmergency, addSouls, EMERGENCY_EVERY_MS } from './mayhem.js';
import { mayhemState } from '../mayhem-state.js';
import { mischiefState, normalizeHexPayload, normalizeGuest, PENDING_MAX, OUTBOX_MAX, HELP_LOG_MAX, DONE_MAX, HEX_LIFE_MS, HAUNT_LIFE_MS } from '../mischief-state.js';
import {
  HEX_BY_ID, TRICK_BY_ID, HEX_DECLINED_LINES, HEX_EXPIRED_LINES, REBOUND_LINE, HAUNT_LINES, SHOO_WIN_LINES, SHOO_MISS_LINES,
  HAUNT_SHOOED_LINES, HAUNT_ENDED_LINES, HELP_VERBS, HELP_NOTE_TAILS, HELP_DONE_LINES, DOORSTEP_LINES, KNOCK_TREAT_LINES,
  KNOCK_CURIO_LINES, KNOCK_TRICK_LINES, KNOCK_TRICK_FULL, NUMBER_WORDS
} from '../content/mischief.js';
import { SEASONS, SEASON_RARITY } from '../content/seasons.js';
import { guestPet } from '../cloud/social.js';
import { addNote, clamp, localDayKey, petById } from '../state.js';
import { registerCoopReward } from './coop-money.js';
import { REWARD_UUID, rewardDay, rewardCount, pendingRewardCount } from '../reward-state.js';
import { registerAwayExtra } from './returns.js';

/* ================= MISCHIEF =================
   The rules on this side of the network. src/cloud/mischief.js talks to the
   server; this file decides what a reply does to the shelf, and is the only
   thing that changes state.mischief.

     a friend's hex    waits in state.mischief.hexes, then takes a place in the
                       emergency tray when there is room (engine/mayhem.js
                       injectEmergency). It plays like any emergency, pays souls,
                       and never takes anything. Playing or returning it is
                       written to the outbox for the server.
     a haunting        one ghost at a time on the shelf; shooing it pays once.
     a help            raises one need, once, by at most 30, at most three a day.
     a knock           the server's roll, turned into souls, a seasonal curio or
                       a small seasonal hex in your own tray.
   Nothing here trusts the device clock with anything another player can see. */

export const HELP_SOULS = 5;
export const HELP_PAID_PER_DAY = 3;
export const HELPS_APPLIED_PER_DAY = 3;
export const SHOO_SOULS = 15;
export const SHOO_PAID_PER_DAY = 2;
export const SHOO_TAPS = 5;
export const SHOO_WINDOW_MS = 12000;
export const KNOCK_PAID_PER_DAY = 12;
const DAY = 86400000;

export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const pickBy = (list, seed) => list[hash(seed) % list.length];
const fillAll = (line, vars) => String(line).replace(/\{(\w+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all));
const friendName = from => from?.name || 'A friend';
const STRANGER = { id: 'neighbour', name: 'A neighbour', traits: [], mood: 'fine', bond: 0, art: { body: '', stamps: [] } };

/* ---------------- the card provider ---------------- */

// The card with the sender's name written in. Victim-facing text only.
const filled = new Map();
function cardFor(ext) {
  const base = (ext?.trick ? TRICK_BY_ID : HEX_BY_ID)[ext?.card];
  if (!base) return null;
  const name = friendName(ext.from), key = (ext.trick ? 't:' : 'h:') + ext.card + '|' + name;
  if (!filled.has(key)) {
    if (filled.size > 48) filled.clear();
    filled.set(key, JSON.parse(JSON.stringify(base), (k, v) => (['title', 'label', 'text'].includes(k) && typeof v === 'string' ? v.replace(/\{f\}/g, name) : v)));
  }
  return filled.get(key);
}
export const fromLabel = ext => 'from ' + friendName(ext?.from) + (ext?.trick ? '’s doorstep' : '’s shelf');

const provider = {
  template: entry => cardFor(entry.ext),
  partner: entry => guestPet(entry.ext.culprit || STRANGER) || guestPet(STRANGER),
  from: entry => fromLabel(entry.ext),
  live: (entry, now) => entry.ext.expires > now,
  resolved(state, entry, { choice, outcome, rebound }, now) {
    const ms = mischiefState(state), ext = entry.ext;
    forgetHex(ms, ext.ref);
    if (ext.trick) return { note: '' };
    queueOutbox(ms, { op: 'resolve', ref: ext.ref, choice, outcome, rebound }, now);
    const name = friendName(ext.from);
    return { note: rebound ? 'It rebounded. You may send ' + name + ' a hex back, free, once.' : name + ' will hear how it went.' };
  }
};
registerExternalCards('hex', provider);

/* ---------------- bookkeeping ---------------- */

function markDone(ms, ref) {
  if (!ms.done.includes(ref)) ms.done.push(ref);
  if (ms.done.length > DONE_MAX) ms.done.splice(0, ms.done.length - DONE_MAX);
}
function forgetHex(ms, ref) {
  ms.hexes = ms.hexes.filter(h => h.ref !== ref);
  markDone(ms, ref);
}
function queueOutbox(ms, item, now) {
  if (ms.outbox.some(o => o.op === item.op && o.ref === item.ref && o.user === ms.user)) return;
  ms.outbox.push({ ...item, user: ms.user, at: now });
  const ordinary = ms.outbox.filter(item => item.op !== 'shoo' && item.user);
  const trimmed = new Set(ordinary.slice(0, Math.max(0, ordinary.length - OUTBOX_MAX)));
  ms.outbox = ms.outbox.filter(item => !trimmed.has(item));
}
function rollDay(ms, now) {
  const day = localDayKey(now);
  if (ms.paid.day !== day) ms.paid = { day, help: 0, knock: 0, shoo: 0 };
}
// What still has to reach the server for this account, oldest first.
export function outboxFor(state, userId) {
  // Ownerless prototype reports stay in the save for recovery. They must not
  // become authenticated writes from whichever account signs in next.
  return mischiefState(state).outbox.filter(o => !!userId && o.user === userId);
}
export function clearOutbox(state, items) {
  const ms = mischiefState(state), gone = new Set(items);
  ms.outbox = ms.outbox.filter(o => !gone.has(o));
}

// Removes a tray card from outside the house, as resolving would.
function dropFromTray(state, ref, now) {
  const m = mayhemState(state), before = m.queue.length;
  m.queue = m.queue.filter(q => q.ext?.ref !== ref);
  if (m.queue.length !== before && m.nextAt < now) m.nextAt = now + EMERGENCY_EVERY_MS;
}

/* ---------------- receiving ---------------- */

// A different account on this device: what the old one received stays with it.
function changeAccount(state, userId, now) {
  const ms = mischiefState(state);
  for (const h of ms.hexes.slice()) dropFromTray(state, h.ref, now);
  ms.hexes = []; ms.outbox = ms.outbox.filter(item => item.op === 'shoo' || !item.user); ms.haunt = null;
  ms.done = []; ms.paid = { day: '', help: 0, knock: 0, shoo: 0 };
  ms.user = userId;
}

/* Takes a fresh read (cloud/mischief.js readMischiefInbox) and brings the
   shelf up to date. Returns what is new, for the UI to announce. */
export function receiveInbox(state, box, userId, now = Date.now()) {
  const ms = mischiefState(state), out = { hexes: [], helps: [], haunt: null };
  if (!box || !userId) return out;
  if (ms.user && ms.user !== userId) changeAccount(state, userId, now);
  ms.user = userId;
  const owed = new Set(ms.outbox.filter(o => o.op === 'resolve' || o.op === 'decline').map(o => o.ref));
  const waiting = new Set(box.hexes.map(h => h.id));
  // Played on another device, expired, withdrawn or blocked: the server no longer has it waiting.
  for (const h of ms.hexes.slice()) if (!h.trick && !waiting.has(h.ref) && !owed.has(h.ref)) { dropFromTray(state, h.ref, now); forgetHex(ms, h.ref); }
  for (const m of mayhemState(state).queue.slice()) {
    const ref = m.ext?.ref;
    if (ref && !m.ext.trick && !waiting.has(ref) && !owed.has(ref)) { dropFromTray(state, ref, now); forgetHex(ms, ref); }
  }
  for (const h of box.hexes) {
    if (ms.done.includes(h.id) || ms.hexes.some(x => x.ref === h.id)) continue;
    if (ms.hexes.filter(x => !x.trick).length >= PENDING_MAX - 1) break;
    const payload = normalizeHexPayload({ kind: 'hex', ref: h.id, card: h.card, from: { userId: h.fromUser, name: h.fromName }, culprit: h.culprit,
      arrived: Math.min(h.createdAt, now), expires: h.expiresAt, rebound: h.rebound }, now);
    if (payload) { ms.hexes.push(payload); out.hexes.push(payload); }
  }
  // One ghost at a time. One that has gone from the server (it ended, or the friend was blocked) leaves.
  if (ms.haunt && !ms.haunt.shooed && !box.hauntings.some(g => g.id === ms.haunt.ref)) ms.haunt = null;
  if (!ms.haunt || ms.haunt.shooed) {
    const g = box.hauntings.find(x => !ms.shooRewards[userId]?.[x.id] && !(state.coop?.money?.pending || []).some(op => op.owner === userId && op.detail?.reward === 'mischief_shoo' && op.detail.haunt_id === x.id) && !ms.done.includes(x.id) && x.id !== ms.haunt?.ref && x.endsAt > now);
    const ghost = g && normalizeGuest(g.ghost);
    if (ghost) {
      ms.haunt = { ref: g.id, from: { userId: g.fromUser, name: g.fromName }, ghost, arrived: Math.min(g.createdAt, now),
        ends: Math.min(g.endsAt, Math.min(g.createdAt, now) + HAUNT_LIFE_MS), shooed: false, paid: false };
      out.haunt = ms.haunt;
    }
  }
  for (const help of box.helps) {
    if (!ms.done.includes(help.id)) {
      const applied = applyHelp(state, help, now);
      markDone(ms, help.id);
      if (applied) out.helps.push(applied);
    }
    // Told to the server either way, so it stops sending it.
    queueOutbox(ms, { op: 'ack', ref: help.id }, now);
  }
  return out;
}

/* ---------------- hexes into the tray ---------------- */

// Every waiting hex that fits goes into the tray, starring an idle resident.
// Expired ones go. Call it whenever the shelf is drawn: it is cheap.
export function settleMischief(state, now = Date.now()) {
  const ms = mischiefState(state), m = mayhemState(state), pets = state.pets || [];
  ms.hexes = ms.hexes.filter(h => h.expires > now);
  if (ms.haunt && ms.haunt.ends <= now) ms.haunt = null;
  const added = [];
  for (const h of ms.hexes) {
    if (!pets.length) break;
    if (m.queue.some(q => q.ext?.ref === h.ref)) continue;
    const busy = new Set(m.queue.flatMap(q => [q.a, q.b]));
    const idle = pets.filter(p => !busy.has(p.id)), pool = idle.length ? idle : pets;
    const entry = injectEmergency(state, { ...h }, pool[hash(h.ref) % pool.length].id, now);
    if (!entry) break;
    added.push(entry);
  }
  return added;
}
export function pendingHexes(state) { return mischiefState(state).hexes.slice(); }
export function inTray(state, ref) { return mayhemState(state).queue.some(q => q.ext?.ref === ref); }

// Sent back unopened: out of the tray, and the sender is told.
export function declineHex(state, ref, now = Date.now()) {
  const ms = mischiefState(state);
  const h = ms.hexes.find(x => x.ref === ref) || mayhemState(state).queue.find(q => q.ext?.ref === ref)?.ext;
  if (!h) return null;
  dropFromTray(state, ref, now);
  forgetHex(ms, ref);
  if (!h.trick) queueOutbox(ms, { op: 'decline', ref }, now);
  return h;
}
// Blocked or removed: everything of theirs leaves the shelf, untold.
export function dropFriend(state, userId, now = Date.now()) {
  const ms = mischiefState(state);
  const refs = [...ms.hexes, ...mayhemState(state).queue.map(q => q.ext).filter(Boolean)].filter(h => h.from?.userId === userId).map(h => h.ref);
  for (const ref of new Set(refs)) { dropFromTray(state, ref, now); forgetHex(ms, ref); }
  if (ms.haunt?.from.userId === userId) { markDone(ms, ms.haunt.ref); ms.haunt = null; }
  ms.outbox = ms.outbox.filter(o => !refs.includes(o.ref));
}

/* ---------------- neighbourly help ---------------- */

export const helpLineText = h => friendName(h.from) + ' ' + HELP_VERBS[h.need] + ' ' + (h.petName || 'someone') + ' while you were out.';
function helpsToday(ms, now) { const day = localDayKey(now); return ms.helps.filter(h => localDayKey(h.applied) === day).length; }

export function applyHelp(state, help, now = Date.now()) {
  const pet = petById(state, help.residentId), ms = mischiefState(state);
  if (!pet || !pet.needs || !Number.isFinite(pet.needs[help.need]) || helpsToday(ms, now) >= HELPS_APPLIED_PER_DAY) return null;
  pet.needs[help.need] = clamp(pet.needs[help.need] + clamp(Math.floor(help.amount) || 0, 0, 30), 0, 100);
  const entry = { id: help.id, from: { userId: help.fromUser, name: help.fromName }, petId: pet.id, petName: pet.name, need: help.need,
    amount: clamp(Math.floor(help.amount) || 0, 0, 30), at: Math.min(help.createdAt || now, now), applied: now };
  ms.helps.unshift(entry);
  if (ms.helps.length > HELP_LOG_MAX) ms.helps.length = HELP_LOG_MAX;
  addNote(state, helpLineText(entry) + ' ' + fillAll(pickBy(HELP_NOTE_TAILS, entry.id), { a: pet.name, f: friendName(entry.from) }), 'a neighbour', 'note');
  return entry;
}
// For the resident's card: the latest help in the last two days.
export function helpLineFor(state, pet, now = Date.now()) {
  const h = (state?.mischief?.helps || []).find(x => x.petId === pet?.id && x.applied > now - 2 * DAY);
  return h ? helpLineText({ ...h, petName: pet.name }) : '';
}
// For the "while you were away" card: helps that arrived since the player left.
export function awayHelpLines(state, pending) {
  if (!pending) return [];
  const helps = (state?.mischief?.helps || []).filter(h => h.applied >= pending.from).slice(0, 3);
  if (!helps.length) return [];
  const lines = helps.slice(0, 2).map(h => 'While you were out, ' + helpLineText(h).replace(/ while you were out\.$/, '.'));
  if (helps.length > 2) lines[1] = lines[1].replace(/\.$/, ', and someone else helped too.');
  return lines;
}
registerAwayExtra(awayHelpLines);
// What the helper reads, and what it pays them: a few souls, three times a day.
export function helped(state, { need, petName, friend }, now = Date.now()) {
  const ms = mischiefState(state);
  rollDay(ms, now);
  let souls = 0;
  if (ms.paid.help < HELP_PAID_PER_DAY) { ms.paid.help++; souls = HELP_SOULS; addSouls(state, souls); }
  const line = fillAll(pickBy(HELP_DONE_LINES[need] || HELP_DONE_LINES.food, petName + now), { a: petName, f: friend || 'your friend' });
  return { souls, line };
}

/* ---------------- hauntings ---------------- */

export function activeHaunt(state, now = Date.now()) {
  const h = state?.mischief?.haunt;
  return h && !h.shooed && h.ends > now ? h : null;
}
export function hauntLine(state, haunt, n = 0) {
  const pets = state.pets || [];
  const r = pets.length ? pets[hash(haunt.ref + ':r' + n) % pets.length].name : 'the lamp';
  return fillAll(pickBy(HAUNT_LINES, haunt.ref + ':' + n), { g: haunt.ghost.name, r, f: friendName(haunt.from) });
}
export function shooMissLine(haunt, n = 0) { return fillAll(pickBy(SHOO_MISS_LINES, haunt.ref + ':miss' + n), { g: haunt.ghost.name, f: friendName(haunt.from) }); }
// Dismissal remains a local game. Its durable outbox reaches the server before
// the proposed reward; a connection failure never makes the player shoo twice.
export function planShoo(state, taps, owner, now = Date.now()) {
  const h = activeHaunt(state, now), ms = mischiefState(state), day = localDayKey(now);
  if (!h || !REWARD_UUID.test(owner || '') || !REWARD_UUID.test(h.ref) || !Number.isInteger(taps) || taps < SHOO_TAPS || taps > 99) return null;
  if (ms.shooRewards[owner]?.[h.ref]) return null;
  const paid = rewardCount(ms.shooRewards, owner, day) + pendingRewardCount(state, owner, 'mischief_shoo', day) < SHOO_PAID_PER_DAY;
  return { delta: paid ? SHOO_SOULS : 0, earned: paid ? SHOO_SOULS : 0,
    detail: { reward: 'mischief_shoo', haunt_id: h.ref, day, paid, taps } };
}
export function dismissHaunt(state, taps, now = Date.now()) {
  const ms = mischiefState(state), h = activeHaunt(state, now);
  if (!h || !Number.isInteger(taps) || taps < SHOO_TAPS || taps > 99) return null;
  h.shooed = true; markDone(ms, h.ref);
  queueOutbox(ms, { op: 'shoo', ref: h.ref, taps }, now);
  return { souls: 0, line: fillAll(pickBy(SHOO_WIN_LINES, h.ref), { g: h.ghost.name, f: friendName(h.from) }) };
}
registerCoopReward('mischief_shoo', {
  key: detail => detail.haunt_id,
  normalize(raw) {
    const day = rewardDay(raw.day);
    return typeof raw.haunt_id === 'string' && REWARD_UUID.test(raw.haunt_id) && day && typeof raw.paid === 'boolean' && Number.isInteger(raw.taps) && raw.taps >= SHOO_TAPS && raw.taps <= 99
      ? { haunt_id: raw.haunt_id, day, paid: raw.paid, taps: raw.taps } : null;
  },
  apply(state, owner, detail) {
    const ms = mischiefState(state);
    ms.shooRewards[owner] ||= {};
    ms.shooRewards[owner][detail.haunt_id] ||= { day: detail.day, paid: detail.paid };
    // An inactive account's receipt retains its proof but cannot dismiss the
    // replacement account's visitor or borrow its daily activity counters.
    if (ms.user !== owner) return;
    markDone(ms, detail.haunt_id);
    if (ms.haunt?.ref === detail.haunt_id) { ms.haunt.shooed = true; ms.haunt.paid = detail.paid; }
    if (ms.paid.day === detail.day) ms.paid.shoo = rewardCount(ms.shooRewards, owner, detail.day);
  }
});

export function shooHaunt(state, taps, now = Date.now()) {
  const ms = mischiefState(state), h = activeHaunt(state, now);
  if (!h) return null;
  h.shooed = true;
  markDone(ms, h.ref);
  rollDay(ms, now);
  let souls = 0;
  if (!h.paid && ms.paid.shoo < SHOO_PAID_PER_DAY) { h.paid = true; ms.paid.shoo++; souls = SHOO_SOULS; addSouls(state, souls); }
  queueOutbox(ms, { op: 'shoo', ref: h.ref, taps: clamp(Math.floor(taps) || 1, 1, 99) }, now);
  return { souls, line: fillAll(pickBy(SHOO_WIN_LINES, h.ref), { g: h.ghost.name, f: friendName(h.from) }) };
}

/* ---------------- trick-or-treat ---------------- */

// A seasonal curio from a friend's bowl, preferring one the cabinet lacks.
export function grantSeasonCurio(state, rnd = Math.random, now = Date.now()) {
  const season = SEASONS.find(s => s.id === 'thin-season') || SEASONS[0], m = mayhemState(state);
  const fresh = season.curios.filter(c => !m.curios[c.id]), pool = fresh.length ? fresh : season.curios;
  const curio = pool[Math.floor(rnd() * pool.length) % pool.length];
  const duplicate = !!m.curios[curio.id];
  m.curios[curio.id] = (m.curios[curio.id] || 0) + 1;
  const refund = duplicate ? SEASON_RARITY.refund : 0;
  if (refund) addSouls(state, refund);
  return { curio, rarity: SEASON_RARITY, duplicate, refund, seasonal: season.id };
}
// The server's answer to a knock (cloud/mischief.js readKnockResult), paid out.
export function takeKnock(state, friend, knock, now = Date.now(), rnd = Math.random) {
  const ms = mischiefState(state), name = friend?.name || 'your friend', seed = (knock.id || '') + name;
  rollDay(ms, now);
  if (knock.result === 'treat') {
    const paying = ms.paid.knock < KNOCK_PAID_PER_DAY;
    if (paying) ms.paid.knock++;
    if (knock.prize === 'curio' && paying) return { kind: 'curio', curio: grantSeasonCurio(state, rnd, now), souls: 0, line: fillAll(pickBy(KNOCK_CURIO_LINES, seed), { f: name }) };
    const souls = paying ? clamp(Math.floor(knock.souls) || 0, 0, 30) || 6 : 0;
    if (souls) addSouls(state, souls);
    return { kind: 'souls', souls, line: fillAll(pickBy(KNOCK_TREAT_LINES, seed), { f: name, s: souls }) };
  }
  const payload = normalizeHexPayload({ kind: 'hex', ref: 'trick-' + knock.id, card: knock.prize, trick: true, from: { userId: friend?.userId || '', name: friend?.name || '' },
    culprit: knock.culprit, arrived: now, expires: now + HEX_LIFE_MS }, now);
  const queued = !!payload && ms.hexes.length < PENDING_MAX && !ms.done.includes(payload.ref) && !ms.hexes.some(h => h.ref === payload.ref);
  if (queued) ms.hexes.push(payload);
  return { kind: 'trick', queued, souls: 0, card: TRICK_BY_ID[knock.prize] || null, line: queued ? fillAll(pickBy(KNOCK_TRICK_LINES, seed), { f: name }) : KNOCK_TRICK_FULL };
}
export function doorstepLine(count, seed = '') {
  const bucket = count <= 0 ? 'none' : count === 1 ? 'one' : count < 6 ? 'some' : 'many';
  return fillAll(pickBy(DOORSTEP_LINES[bucket], seed + ':' + count), { n: NUMBER_WORDS[count] || String(count) });
}

/* ---------------- what the sender reads ---------------- */

export function hexResultLine(r) {
  const card = HEX_BY_ID[r.card], hex = card?.name || 'hex';
  const vars = { f: r.toName || 'Your friend', c: r.culpritName || 'your resident', hex };
  if (r.status === 'declined') return fillAll(pickBy(HEX_DECLINED_LINES, r.id), vars);
  if (r.status === 'expired') return fillAll(pickBy(HEX_EXPIRED_LINES, r.id), vars);
  const choice = card?.choices[r.choice], outcome = choice?.outcomes[r.outcome];
  return vars.f + ' resolved your ' + hex + (choice ? ' ' + choice.how : '') + '.' + (outcome?.report ? ' ' + fillAll(outcome.report, vars) : '') +
    (r.rebound ? ' ' + fillAll(REBOUND_LINE, vars) : '');
}
export function hauntResultLine(r) {
  const vars = { f: r.toName || 'Your friend', g: r.ghostName || 'your resident', taps: r.taps || 1 };
  return fillAll(pickBy(r.status === 'shooed' ? HAUNT_SHOOED_LINES : HAUNT_ENDED_LINES, r.id), vars);
}
