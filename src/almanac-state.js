import { TIERS, WEEKLY_POOL, XP_RULES } from './content/almanac.js';
import { SET_BY_ID, CABINET_FRAMES, PORTRAIT_FRAMES, COMMISSION_BY_ID, TITLE_IDS } from './content/collections.js';
import { FREE_DECOR, NEW_DECOR, DECOR_KINDS } from './content/decor.js';
import { LEGACY_LEVELS, legacyAt } from './content/legacy.js';

/* Save data for the long-term systems: the Almanac, streak freezes, the return
   chest, Legacy ranks, collections and the Collector’s Exchange. Everything is
   additive, bounded and rebuilt from blank here, so an older save loads
   unchanged and a hand-edited one cannot break the shelf. Like the other
   normalizers, anything not registered in this file is dropped on load.

   Kept small on purpose: the cloud copy of a save is capped, and none of this
   needs more than a few hundred characters. */
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const int = (value, fallback = 0, min = 0, max = 1e9) => Math.floor(finite(value, fallback, min, max));
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
  && !['__proto__', 'prototype', 'constructor'].includes(value);
const DAY_KEY = /^\d{4}-\d{1,2}-\d{1,2}$/;
const dayKey = value => typeof value === 'string' && DAY_KEY.test(value) ? value : '';
const unique = list => [...new Set(list)];

// Absolute counts the Almanac watches. 'dplays' is today’s daily-challenge runs, which restart each day.
export const COUNTERS = ['care', 'resolved', 'coffins', 'outings', 'episodes', 'arcade', 'dplays', 'curios'];
export const WEEKLY_KINDS = unique(WEEKLY_POOL.map(c => c.kind));
const WEEKLY_IDS = new Set(WEEKLY_POOL.map(c => c.id));
const SOURCES = new Set([...Object.keys(XP_RULES), 'spotlight']);
const CHAPTER_KEY = /^[a-z0-9-]{1,40}(~\d{4})?$/;
export const FREEZE_MAX = 2;
export const NUDGE_CATEGORIES = ['emergency', 'away', 'almanac', 'chest'];

/* ---------- the Almanac ---------- */
export function blankAlmanac() {
  return {
    v: 1, init: 1, seen: Object.fromEntries(COUNTERS.map(k => [k, 0])),
    day: '', xp: 0, by: {}, flags: {},
    chapters: {}, week: blankWeek(), settled: null,
    stats: { tiers: 0, badges: 0, weekly: 0, chests: 0, bought: 0 }
  };
}
export function blankWeek() { return { no: 0, counts: {}, done: [], claimed: [], chest: 0 }; }

export function normalizeAlmanac(raw) {
  const out = blankAlmanac();
  if (!object(raw)) { out.init = 0; return out; }
  out.init = raw.init === 1 ? 1 : 0;
  if (object(raw.seen)) for (const k of COUNTERS) out.seen[k] = int(raw.seen[k], 0, 0, 1e9);
  out.day = dayKey(raw.day);
  out.xp = int(raw.xp, 0, 0, 1000);
  if (object(raw.by)) for (const [k, v] of Object.entries(raw.by)) if (SOURCES.has(k)) out.by[k] = int(v, 0, 0, 1000);
  if (object(raw.flags)) for (const k of ['omen', 'chores', 'choresAll', 'docket', 'daily']) if (Number.isFinite(raw.flags[k])) out.flags[k] = int(raw.flags[k], 0, 0, 9);
  if (object(raw.chapters)) {
    // Only the newest sixty are kept: a chapter older than that cannot be claimed any more anyway.
    const keys = Object.keys(raw.chapters).filter(k => CHAPTER_KEY.test(k)).sort().slice(-60);
    for (const k of keys) {
      const c = raw.chapters[k];
      if (!object(c)) continue;
      out.chapters[k] = { xp: int(c.xp, 0, 0, 1e6), claimed: int(c.claimed, 0, 0, 2 ** TIERS - 1), badge: c.badge === 1 ? 1 : 0, spot: int(c.spot, 0, 0, 7) };
    }
  }
  if (object(raw.week)) {
    out.week.no = int(raw.week.no, 0, 0, 1e6);
    if (object(raw.week.counts)) for (const k of WEEKLY_KINDS) if (Number.isFinite(raw.week.counts[k])) out.week.counts[k] = int(raw.week.counts[k], 0, 0, 99999);
    for (const key of ['done', 'claimed']) out.week[key] = unique((Array.isArray(raw.week[key]) ? raw.week[key] : []).filter(id => WEEKLY_IDS.has(id))).slice(0, 3);
    out.week.chest = raw.week.chest === 1 ? 1 : 0;
  }
  if (object(raw.settled) && typeof raw.settled.text === 'string') {
    out.settled = { text: raw.settled.text.slice(0, 300), souls: int(raw.settled.souls, 0, 0, 9999), xp: int(raw.settled.xp, 0, 0, 9999) };
  }
  if (object(raw.stats)) for (const k of Object.keys(out.stats)) out.stats[k] = int(raw.stats[k], 0, 0, 1e7);
  return out;
}

/* ---------- streak freezes ---------- */
export function blankStreaks() { return { freezes: 0, earned: 0, used: 0, notices: [] }; }
const STREAK_KINDS = new Set(['omen', 'docket', 'challenge']);
export function normalizeStreaks(raw) {
  const out = blankStreaks();
  if (!object(raw)) return out;
  out.freezes = int(raw.freezes, 0, 0, FREEZE_MAX);
  out.earned = int(raw.earned, 0, 0, 1e6);
  out.used = int(raw.used, 0, 0, 1e6);
  out.notices = (Array.isArray(raw.notices) ? raw.notices : []).filter(n => object(n) && STREAK_KINDS.has(n.kind) && (n.type === 'earned' || n.type === 'saved'))
    .slice(-4).map(n => ({ kind: n.kind, type: n.type, day: dayKey(n.day), seen: n.seen === 1 ? 1 : 0 }));
  return out;
}

/* ---------- the return chest ---------- */
export function blankReturns() { return { seenAt: 0, claimedDay: '', claimed: 0, serial: 0, pending: null }; }
export function normalizeReturns(raw, now = Date.now()) {
  const out = blankReturns();
  if (!object(raw)) return out;
  out.seenAt = finite(raw.seenAt, 0, 0, now + 86400000);
  out.claimedDay = dayKey(raw.claimedDay);
  out.claimed = int(raw.claimed, 0, 0, 1e6);
  out.serial = int(raw.serial, 0, 0, 1e9);
  const p = raw.pending;
  if (object(p) && Array.isArray(p.lines)) {
    out.pending = {
      id: int(p.id, 0, 0, 1e9), from: finite(p.from, 0, 0, now + 86400000), to: finite(p.to, 0, 0, now + 86400000),
      days: int(p.days, 0, 0, 7), souls: int(p.souls, 0, 0, 1000), xp: int(p.xp, 0, 0, 200),
      lines: p.lines.filter(l => typeof l === 'string' && l).slice(0, 5).map(l => l.slice(0, 240)), day: dayKey(p.day)
    };
  }
  return out;
}

/* ---------- Legacy ranks ---------- */
// Tokens are earned by reaching Legacy ranks and counted from lifetime souls, so they can never be paid twice.
export function legacyReached(lifetime) {
  let n = 0;
  while (n < LEGACY_LEVELS && lifetime >= legacyAt(n + 1)) n++;
  return n;
}
export function blankLegacy() { return { spent: 0 }; }
export function normalizeLegacy(raw, lifetime = 0) {
  const out = blankLegacy();
  if (!object(raw)) return out;
  out.spent = int(raw.spent, 0, 0, LEGACY_LEVELS);
  return out;
}

/* ---------- collections ---------- */
export function blankCollections() { return { claimed: [] }; }
export function normalizeCollections(raw) {
  const out = blankCollections();
  if (!object(raw)) return out;
  out.claimed = unique((Array.isArray(raw.claimed) ? raw.claimed : []).filter(id => typeof id === 'string' && Object.hasOwn(SET_BY_ID, id)));
  return out;
}

/* ---------- the Collector’s Exchange ---------- */
export function blankExchange() { return { frames: [], frame: 'plain', portraits: [], portrait: {}, commissions: [], titles: [], title: '' }; }
const FRAME_IDS = new Set(CABINET_FRAMES.map(f => f.id));
const PORTRAIT_IDS = new Set(PORTRAIT_FRAMES.map(f => f.id));
const TITLES = new Set(TITLE_IDS);
export function normalizeExchange(raw, pets = []) {
  const out = blankExchange();
  if (!object(raw)) return out;
  out.frames = unique((Array.isArray(raw.frames) ? raw.frames : []).filter(id => FRAME_IDS.has(id) && id !== 'plain'));
  out.frame = FRAME_IDS.has(raw.frame) && (raw.frame === 'plain' || out.frames.includes(raw.frame)) ? raw.frame : 'plain';
  out.portraits = unique((Array.isArray(raw.portraits) ? raw.portraits : []).filter(id => PORTRAIT_IDS.has(id) && id !== 'plain'));
  const petIds = new Set((Array.isArray(pets) ? pets : []).map(p => p && p.id).filter(safeId));
  if (object(raw.portrait)) for (const [pet, id] of Object.entries(raw.portrait)) if (petIds.has(pet) && out.portraits.includes(id)) out.portrait[pet] = id;
  out.commissions = unique((Array.isArray(raw.commissions) ? raw.commissions : []).filter(id => Object.hasOwn(COMMISSION_BY_ID, id)));
  out.titles = unique((Array.isArray(raw.titles) ? raw.titles : []).filter(id => TITLES.has(id)));
  out.title = out.titles.includes(raw.title) ? raw.title : '';
  return out;
}

/* ---------- what the room already owns ---------- */
const FREE_KEYS = DECOR_KINDS.flatMap(kind => FREE_DECOR[kind].map(id => kind + ':' + id));
export const FREE_DECOR_KEYS = FREE_KEYS;
// A save that never recorded what it owns keeps every room, wall, wood and accent the game ever offered for free.
export function normalizeOwned(raw) {
  const extra = (Array.isArray(raw) ? raw : []).filter(key => typeof key === 'string' && Object.hasOwn(NEW_DECOR, key));
  return unique([...FREE_KEYS, ...extra]);
}

export function normalizeNudgeCats(raw) {
  const out = Object.fromEntries(NUDGE_CATEGORIES.map(k => [k, true]));
  if (object(raw)) for (const k of NUDGE_CATEGORIES) if (raw[k] === false) out[k] = false;
  return out;
}

/* ---------- registering all of it ---------- */
export function blankRetention() {
  return { almanac: blankAlmanac(), streaks: blankStreaks(), returns: blankReturns(), legacy: blankLegacy(), collections: blankCollections(), exchange: blankExchange() };
}
// Called once from state.js normalizeState, after pets, mayhem and decor have been rebuilt.
export function normalizeRetention(s, now = Date.now()) {
  s.almanac = normalizeAlmanac(s.almanac);
  s.streaks = normalizeStreaks(s.streaks);
  s.returns = normalizeReturns(s.returns, now);
  s.legacy = normalizeLegacy(s.legacy, s.mayhem?.lifetime);
  s.legacy.spent = Math.min(s.legacy.spent, legacyReached(s.mayhem?.lifetime || 0));
  s.collections = normalizeCollections(s.collections);
  s.exchange = normalizeExchange(s.exchange, s.pets);
  if (object(s.decor)) s.decor.owned = normalizeOwned(s.decor.owned);
  if (object(s.settings)) s.settings.nudgeCats = normalizeNudgeCats(s.settings.nudgeCats);
  return s;
}

/* ---------- accessors that repair a state built by hand (tests, older callers) ---------- */
export function almanacState(state) { if (!object(state.almanac)) state.almanac = blankAlmanac(); return state.almanac; }
export function streaksState(state) { if (!object(state.streaks)) state.streaks = blankStreaks(); return state.streaks; }
export function returnsState(state) { if (!object(state.returns)) state.returns = blankReturns(); return state.returns; }
export function legacyState(state) { if (!object(state.legacy)) state.legacy = blankLegacy(); return state.legacy; }
export function collectionsState(state) { if (!object(state.collections)) state.collections = blankCollections(); return state.collections; }
export function exchangeState(state) { if (!object(state.exchange)) state.exchange = blankExchange(); return state.exchange; }
