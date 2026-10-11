import {
  NAME_A, NAME_B, NAME_FORMS, NAME_A_BY_ID, NAME_B_BY_ID, SIGIL_SHAPES, SIGIL_SYMBOLS, SIGIL_COLOURS, SHAPE_BY_ID, SYMBOL_BY_ID, COLOUR_BY_ID,
  COUNTERS, DAILY_CAPS, COUNTER_WORDS, GOAL_BY_ID, CHEST_TIERS, DUPLICATE_SOULS, COVEN_CURIOS, COVEN_CURIO_BY_ID, SIGIL_FRAMES, SIGIL_FRAME_BY_ID,
  INVITE_FRAMES, INVITE_REPEAT_SOULS, AWARDS, AWARD_BY_ID, CEREMONY
} from '../content/coven.js';
import { MAGNET_BY_ID } from '../content/magnets.js';
import { covenState, SEEN_KEYS, FLAG_KEYS, CLAIMED_MAX, TROPHY_MAX, PAID_MAX, HIDDEN_MAX } from '../coven-state.js';
import { exchangeState } from '../almanac-state.js';
import { readCounters } from './almanac.js';
import { addSouls } from './mayhem.js';
import { localDayKey } from '../state.js';
import { bindCoopMoney, hasCoopReward, recordCoopReward, registerCoopReward } from './coop-money.js';

/* ================= COVENS: THE RULES THAT RUN ON THIS SHELF =================
   The server owns the coven (members, the week's goal, progress, who may claim
   what). This module is the local half: it watches the counters the Almanac
   already reads and turns their changes into the day's running totals the
   server is told about; it pays chests and invite rewards into this save
   once each; and it works out the Monday awards from last week's numbers,
   identically on every member's phone. Pure functions of state and time. */

export const DAY_MS = 86400000;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const sum = list => list.reduce((n, x) => n + x, 0);
function hash(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

/* ---------- the week: Monday to Sunday, UTC, as the server counts it ---------- */
export const utcDay = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);
export const covenWeek = (ts = Date.now()) => Math.floor((Math.floor(ts / DAY_MS) + 3) / 7);
export const weekStart = week => (week * 7 - 3) * DAY_MS;
// Whole days left including today, for "ends in" lines.
export const daysLeft = (week, now = Date.now()) => Math.max(0, Math.ceil((weekStart(week + 1) - now) / DAY_MS));
export const thresholds = target => [Math.ceil(target / 3), Math.ceil(target * 2 / 3), target];
export const tierReached = (progress, target) => thresholds(target).filter(t => progress >= t).length;
export const counterWord = (counter, n) => (COUNTER_WORDS[counter] || ['thing', 'things'])[n === 1 ? 0 : 1];
export function goalLine(goal, target) {
  const g = GOAL_BY_ID[goal];
  return g ? g.line.replace('{n}', String(target)) : 'Do ' + target + ' ' + counterWord('', target) + ' between you.';
}

/* ---------- counting ----------
   The Almanac's counters, mapped to the coven's. Absolute counts are compared
   with what was last seen; the day flags (the omen, chores, the docket, the
   daily challenge) are compared within the local day they belong to. A count
   that went down (a restore, a rehoming) is re-based, never paid. Nothing is
   counted while the shelf is not in a coven, and joining starts from zero. */
const SEEN_TO_COUNTER = { resolved: 'emergency', coffins: 'coffin', care: 'care', episodes: 'court', arcade: 'arcade', outings: 'expedition', curios: 'curio' };
const FLAG_TO_COUNTER = { omen: 'omen', chores: 'chore', docket: 'docket', daily: 'daily' };

function rollDay(c, now) {
  const today = utcDay(now);
  if (c.day === today) return;
  const unsent = c.covenId && Object.keys(c.tally).some(k => c.tally[k] > (c.sent[k] || 0));
  // Yesterday's totals are kept for one more report: the server takes yesterday too.
  c.prev = unsent && c.day && Date.parse(today) - Date.parse(c.day) === DAY_MS ? { day: c.day, tally: { ...c.tally } } : null;
  c.day = today; c.tally = {}; c.sent = {};
}

export function syncCoven(state, now = Date.now()) {
  const c = covenState(state);
  if (!(state.pets || []).length) return {};
  const cur = readCounters(state, now), localDay = localDayKey(now);
  if (!c.init) {
    // No windfall for the past: start from where the shelf is.
    for (const k of SEEN_KEYS) c.seen[k] = cur.abs[k] || 0;
    c.flags = Object.fromEntries(FLAG_KEYS.map(k => [k, cur.flags[k] || 0]));
    c.flagDay = localDay; c.day = utcDay(now); c.init = 1;
    return {};
  }
  rollDay(c, now);
  if (c.flagDay !== localDay) { c.flagDay = localDay; c.flags = {}; }
  const added = {};
  const add = (counter, n) => { if (n > 0) added[counter] = (added[counter] || 0) + n; };
  for (const [k, counter] of Object.entries(SEEN_TO_COUNTER)) {
    add(counter, (cur.abs[k] || 0) - (c.seen[k] || 0));
    c.seen[k] = cur.abs[k] || 0;
  }
  for (const [k, counter] of Object.entries(FLAG_TO_COUNTER)) {
    const v = cur.flags[k] || 0;
    add(counter, v - (c.flags[k] || 0));
    c.flags[k] = Math.max(c.flags[k] || 0, v);
  }
  if (!c.covenId) return {};
  for (const [k, n] of Object.entries(added)) c.tally[k] = Math.min(DAILY_CAPS[k], (c.tally[k] || 0) + n);
  return added;
}

// The coven this shelf now counts for. Changing it (founding, joining,
// leaving, or finding out on another device) starts today's totals from zero.
export function setCoven(state, covenId, now = Date.now()) {
  const c = covenState(state), id = typeof covenId === 'string' ? covenId : '';
  if (c.covenId === id) return false;
  syncCoven(state, now);
  c.covenId = id; c.day = utcDay(now); c.tally = {}; c.sent = {}; c.prev = null;
  return true;
}

// What to tell the server: yesterday's leftovers first, then today, each only
// if something has not been acknowledged yet.
export function pendingReports(state, now = Date.now()) {
  const c = covenState(state);
  rollDay(c, now);
  if (!c.covenId) return [];
  const out = [];
  if (c.prev && Object.keys(c.prev.tally).length) out.push({ day: c.prev.day, counts: { ...c.prev.tally }, prev: true });
  if (Object.keys(c.tally).some(k => c.tally[k] > (c.sent[k] || 0))) out.push({ day: c.day, counts: { ...c.tally }, prev: false });
  return out;
}
export function markReported(state, report) {
  const c = covenState(state);
  if (report.prev) { if (c.prev?.day === report.day) c.prev = null; return; }
  if (c.day !== report.day) return;
  for (const k of COUNTERS) if (report.counts[k] > (c.sent[k] || 0)) c.sent[k] = report.counts[k];
}

/* ---------- the chest ---------- */
const REWARD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const chestKey = (week, tier) => week + ':' + tier;
export function bindCovenRewards(state, owner) {
  if (!REWARD_UUID.test(owner || '')) return false;
  const c = covenState(state);
  if (c.rewardOwner === owner) return false;
  c.rewards ||= {};
  if (c.rewardOwner) {
    const old = c.rewards[c.rewardOwner] || { claimed: [], paid: [] };
    c.rewards[c.rewardOwner] = { claimed: [...new Set([...old.claimed, ...c.claimed])], paid: [...new Set([...old.paid, ...c.invite.paid])] };
  } else {
    // Prototype saves did not record who was paid. Retain that history without
    // guessing its owner; authenticated server receipts determine eligibility.
    const old = c.unownedRewards || { claimed: [], paid: [] };
    c.unownedRewards = { claimed: [...new Set([...old.claimed, ...c.claimed])], paid: [...new Set([...old.paid, ...c.invite.paid])] };
  }
  c.rewardOwner = owner;
  c.rewards[owner] ||= { claimed: [], paid: [] };
  c.claimed = c.rewards[owner].claimed.slice(-CLAIMED_MAX);
  c.invite.paid = c.rewards[owner].paid.slice(-PAID_MAX);
  return true;
}
export function chestPaid(state, week, tier, owner = '') {
  const c = covenState(state), marks = owner ? c.rewards?.[owner]?.claimed || [] : c.claimed;
  return marks.includes(chestKey(week, tier));
}
export function invitePaid(state, userId, owner = '') {
  const c = covenState(state);
  return (owner ? c.rewards?.[owner]?.paid || [] : c.invite.paid).includes(userId);
}
// The next curio or frame the shelf does not own, starting from one picked by
// the week, so the coven's members tend to collect them in different orders.
function nextUnowned(list, owned, week) {
  for (let i = 0; i < list.length; i++) { const id = list[(week + i) % list.length].id; if (!owned(id)) return id; }
  return null;
}
// Pays one tier into this save, once. The server has already said yes.
export function payChest(state, week, tier, owner = '', operation = '') {
  if (!Number.isInteger(week) || week < 0 || week >= 1e7 || !Number.isInteger(tier) || owner && !REWARD_UUID.test(owner)) return null;
  if (operation && (!REWARD_UUID.test(operation) || !owner)) throw new Error('Invalid coven reward operation');
  if (owner) bindCovenRewards(state, owner);
  const c = covenState(state), def = CHEST_TIERS[tier - 1], key = chestKey(week, tier);
  if (!def || chestPaid(state, week, tier, owner)) return null;
  if (operation && hasCoopReward(state, owner, operation)) {
    c.claimed = [...c.claimed, key].slice(-CLAIMED_MAX); c.rewards[owner].claimed.push(key);
    return null;
  }
  if (operation) bindCoopMoney(state, owner);
  c.claimed = [...c.claimed, key].slice(-CLAIMED_MAX);
  if (owner) c.rewards[owner].claimed.push(key);
  const out = { week, tier, name: def.name, souls: def.souls, curio: null, frame: null, extra: 0, rankUp: null };
  const giveCurio = () => {
    const id = nextUnowned(COVEN_CURIOS, x => c.curios[x] > 0, week);
    if (!id) return false;
    c.curios[id] = (c.curios[id] || 0) + 1; out.curio = COVEN_CURIO_BY_ID[id];
    return true;
  };
  if (def.curio && !giveCurio()) out.extra += DUPLICATE_SOULS;
  if (def.frame) {
    const id = nextUnowned(SIGIL_FRAMES, x => c.frames.includes(x), week);
    if (id) { c.frames.push(id); out.frame = SIGIL_FRAME_BY_ID[id]; }
    else if (!giveCurio()) out.extra += DUPLICATE_SOULS;
  }
  out.rankUp = addSouls(state, out.souls + out.extra);
  if (operation) recordCoopReward(state, { id: operation, owner, delta: out.souls + out.extra, earned: out.souls + out.extra,
    detail: { reward: 'coven_chest', week, tier, curio: out.curio?.id || null, frame: out.frame?.id || null } });
  return out;
}
export function wearFrame(state, id) {
  const c = covenState(state);
  if (id !== '' && !c.frames.includes(id)) return false;
  c.frame = id;
  return true;
}

/* ---------- invite rewards ----------
   The pair of portrait frames, once. Every later reward (the server allows
   ten as an inviter and one as a new player) pays souls instead. */
export function payInvite(state, userId, owner = '', operation = '') {
  if (!REWARD_UUID.test(userId || '') || owner && !REWARD_UUID.test(owner)) return null;
  if (operation && (!REWARD_UUID.test(operation) || !owner)) throw new Error('Invalid coven reward operation');
  if (owner) bindCovenRewards(state, owner);
  const c = covenState(state);
  if (typeof userId !== 'string' || invitePaid(state, userId, owner)) return null;
  if (operation && hasCoopReward(state, owner, operation)) {
    c.invite.paid = [...c.invite.paid, userId].slice(-PAID_MAX); c.rewards[owner].paid.push(userId);
    return null;
  }
  if (operation) bindCoopMoney(state, owner);
  c.invite.paid = [...c.invite.paid, userId].slice(-PAID_MAX);
  if (owner) c.rewards[owner].paid.push(userId);
  const ex = exchangeState(state), fresh = INVITE_FRAMES.filter(id => !ex.portraits.includes(id));
  const out = fresh.length ? { frames: fresh, souls: 0, rankUp: null } : { frames: [], souls: INVITE_REPEAT_SOULS, rankUp: addSouls(state, INVITE_REPEAT_SOULS) };
  if (fresh.length) ex.portraits = [...ex.portraits, ...fresh];
  if (operation) recordCoopReward(state, { id: operation, owner, delta: out.souls, earned: out.souls,
    detail: { reward: 'coven_invite', userId: userId, frames: fresh } });
  return out;
}

// Currency receipts restore the associated paid mark and cosmetic effects.
// The wallet owns money; these handlers must never add souls a second time.
registerCoopReward('coven_chest', {
  normalize(raw) {
    if (!Number.isInteger(raw.week) || raw.week < 0 || raw.week >= 1e7 || !CHEST_TIERS[raw.tier - 1] || !Number.isInteger(raw.tier)) return null;
    const curio = raw.curio ?? null, frame = raw.frame ?? null;
    if (curio !== null && (typeof curio !== 'string' || !Object.hasOwn(COVEN_CURIO_BY_ID, curio))
      || frame !== null && (typeof frame !== 'string' || !Object.hasOwn(SIGIL_FRAME_BY_ID, frame))) return null;
    if (raw.tier === 1 && (curio || frame) || raw.tier === 2 && frame || curio && frame) return null;
    return { week: raw.week, tier: raw.tier, curio, frame };
  },
  apply(state, owner, detail) {
    bindCovenRewards(state, owner);
    const c = covenState(state), key = chestKey(detail.week, detail.tier);
    if (!c.rewards[owner].claimed.includes(key)) c.rewards[owner].claimed.push(key);
    if (!c.claimed.includes(key)) c.claimed = [...c.claimed, key].slice(-CLAIMED_MAX);
    if (detail.curio) c.curios[detail.curio] = Math.max(1, c.curios[detail.curio] || 0);
    if (detail.frame && !c.frames.includes(detail.frame)) c.frames.push(detail.frame);
  }
});
registerCoopReward('coven_invite', {
  normalize(raw) {
    if (typeof raw.userId !== 'string' || !REWARD_UUID.test(raw.userId)
      || !Array.isArray(raw.frames) || raw.frames.length > 2 || raw.frames.some(frame => !INVITE_FRAMES.includes(frame))) return null;
    return { userId: raw.userId, frames: [...new Set(raw.frames)] };
  },
  apply(state, owner, detail) {
    bindCovenRewards(state, owner);
    const c = covenState(state), ex = exchangeState(state);
    if (!c.rewards[owner].paid.includes(detail.userId)) c.rewards[owner].paid.push(detail.userId);
    if (!c.invite.paid.includes(detail.userId)) c.invite.paid = [...c.invite.paid, detail.userId].slice(-PAID_MAX);
    ex.portraits = [...new Set([...ex.portraits, ...detail.frames])];
  }
});

/* ---------- names and sigils ---------- */
const pickFrom = (list, rnd) => list[Math.floor(rnd() * list.length) % list.length];
export function randomName(rnd = Math.random) {
  return { a: pickFrom(NAME_A, rnd)[0], b: pickFrom(NAME_B, rnd)[0], form: Math.floor(rnd() * NAME_FORMS.length) % NAME_FORMS.length };
}
export function randomSigil(rnd = Math.random) {
  return { shape: pickFrom(SIGIL_SHAPES, rnd).id, symbol: pickFrom(SIGIL_SYMBOLS, rnd).id, colour: pickFrom(SIGIL_COLOURS, rnd).id };
}
// Words from this build's banks only. An id this build does not know (a newer
// edition's word) reads as a placeholder rather than as text from the server.
export function covenName(name) {
  const a = NAME_A_BY_ID[name?.a] || 'Unrecorded', b = NAME_B_BY_ID[name?.b] || 'Society';
  const form = NAME_FORMS[Number.isInteger(name?.form) ? name.form : 0] || NAME_FORMS[0];
  return form.replace('{a}', a).replace('{b}', b);
}
export function cleanSigil(s) {
  return { shape: SHAPE_BY_ID[s?.shape] ? s.shape : 'shield', symbol: SYMBOL_BY_ID[s?.symbol] ? s.symbol : 'candle', colour: COLOUR_BY_ID[s?.colour] ? s.colour : 'ash' };
}
// One colour per member for the progress bar: the coven's own first, then the rest of the palette.
export function memberColours(colour, n) {
  const start = Math.max(0, SIGIL_COLOURS.findIndex(c => c.id === colour));
  return Array.from({ length: n }, (_, i) => SIGIL_COLOURS[(start + i) % SIGIL_COLOURS.length].hex);
}

/* ---------- the notice board ---------- */
// A note's tiles as words to draw, from this build's bank. Unknown tiles are
// dropped; names come from the server's list for mentions, or a placeholder.
export function noteParts(tiles, names = {}) {
  const out = [];
  for (const tile of Array.isArray(tiles) ? tiles.slice(0, 12) : []) {
    if (typeof tile !== 'string') continue;
    if (tile.startsWith('@')) { out.push({ kind: 'name', id: tile.slice(1), text: names[tile.slice(1)] || 'someone who left' }); continue; }
    const m = MAGNET_BY_ID[tile];
    if (m) out.push({ kind: m.group === 'punct' ? 'punct' : 'word', id: tile, text: m.text });
  }
  return out;
}
export function noteText(parts) {
  return parts.reduce((text, p) => p.kind === 'punct' || !text ? text + p.text : text + ' ' + p.text, '').trim();
}
export function hideNote(state, id) {
  const c = covenState(state);
  if (!Number.isSafeInteger(id) || id <= 0 || c.hidden.includes(id)) return false;
  c.hidden = [...c.hidden, id].slice(-HIDDEN_MAX);
  return true;
}

/* ---------- the Shelfies ----------
   Every member wins exactly one thing, the same on every phone. The lowest
   contributor (in a coven of two or more where somebody did more) is given
   Least Help. Everybody else, busiest first, is given the unclaimed award
   where they stand out most against the coven. Anyone who did something but
   was outshone everywhere gets a supporting award; anyone who did nothing
   gets one of the awards for being present. Least Help is read out last. */
const POSITIVE = AWARDS.filter(a => !['least', 'zero', 'support'].includes(a.stat));
const SUPPORT = AWARDS.filter(a => a.stat === 'support');
const ZERO = AWARDS.filter(a => a.stat === 'zero');
const ORDER = Object.fromEntries(AWARDS.map((a, i) => [a.id, i]));

export function citation(award, week, name, n) {
  const line = award.lines[hash(week + ':' + award.id) % award.lines.length];
  return line.replace(/\{name\}/g, name).replace(/\{n\}/g, String(n));
}
export function computeAwards({ week, counter, members }) {
  const list = (Array.isArray(members) ? members : []).filter(m => record(m) && typeof m.userId === 'string').map(m => {
    const counts = Object.fromEntries(COUNTERS.map(k => [k, Number(m.counts?.[k]) || 0]));
    const total = sum(Object.values(counts));
    return { userId: m.userId, name: m.name || 'A member', total,
      stats: { ...counts, goal: counts[counter] || 0, days: Number(m.days) || 0, late: Number(m.late) || 0, notes: Number(m.notes) || 0, support: total } };
  });
  if (!list.length) return [];
  const tie = id => hash(week + '|' + id);
  const out = [], held = new Set(), used = new Set();
  const give = (m, award, n) => {
    held.add(m.userId); used.add(award.id);
    out.push({ userId: m.userId, name: m.name, award: award.id, title: award.title, n, line: citation(award, week, m.name, n) });
  };
  if (list.length >= 2) {
    const max = Math.max(...list.map(m => m.total));
    const lowest = [...list].sort((a, b) => a.total - b.total || tie(a.userId) - tie(b.userId))[0];
    if (lowest.total < max) give(lowest, AWARD_BY_ID.least, lowest.total);
  }
  const top = Object.fromEntries(POSITIVE.map(a => [a.stat, Math.max(0, ...list.map(m => m.stats[a.stat] || 0))]));
  const busiest = list.filter(m => !held.has(m.userId)).sort((a, b) => b.total - a.total || tie(a.userId) - tie(b.userId));
  let support = 0, zero = 0;
  for (const m of busiest) {
    if (m.total === 0) { give(m, ZERO[(week + zero++) % ZERO.length], 0); continue; }
    const options = POSITIVE.filter(a => !used.has(a.id) && (m.stats[a.stat] || 0) > 0)
      .map(a => ({ a, score: m.stats[a.stat] / top[a.stat] }))
      .sort((x, y) => y.score - x.score || ORDER[x.a.id] - ORDER[y.a.id]);
    if (options.length) give(m, options[0].a, m.stats[options[0].a.stat]);
    else give(m, SUPPORT[support++ % SUPPORT.length], m.total);
  }
  const rank = a => a.award === 'least' ? 3 : ZERO.some(z => z.id === a.award) ? 2 : SUPPORT.some(s => s.id === a.award) ? 1 : 0;
  return out.sort((x, y) => rank(x) - rank(y) || ORDER[x.award] - ORDER[y.award]);
}
// The running order, the same for everyone in the coven that week.
export function ceremonyScript(week, awards) {
  const at = (list, i) => list[((i % list.length) + list.length) % list.length];
  return {
    opening: at(CEREMONY.openings, week), closing: at(CEREMONY.closings, week),
    steps: awards.map((a, i) => ({ ...a, envelope: at(CEREMONY.envelopes, week + i), reaction: at(CEREMONY.reactions, week * 3 + i) }))
  };
}
// Watching a ceremony puts this player's own award on their trophy shelf, once.
export function recordCeremony(state, week, awards, myId, covenTitle = '') {
  const c = covenState(state);
  if (!(week > c.seenAwards)) return false;
  c.seenAwards = week;
  const mine = awards.filter(a => a.userId === myId).map(a => ({ week, award: a.award, n: a.n, coven: String(covenTitle).slice(0, 80) }));
  c.trophies = [...mine, ...c.trophies].slice(0, TROPHY_MAX);
  return true;
}
