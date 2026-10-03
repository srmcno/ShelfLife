import {
  CHAPTERS, CHAPTER_BY_ID, TRACK, TIERS, TRACK_XP_PER_DAY, XP_RULES, DAILY_XP_CAP, SPOTLIGHT_XP, WEEKLY_XP, CHEST_XP,
  WEEKLY_POOL, WEEKLY_FAMILIES, WEEKLY_SOULS, CHEST_SOULS, EDITION_RARITY, ALMANAC_CURIO_BY_ID
} from '../content/almanac.js';
import { BACK_ISSUE_COST, BACK_ISSUE_DECOR_COST, BACK_ISSUE_BARGAIN } from '../content/collections.js';
import { almanacState, exchangeState, blankWeek, COUNTERS } from '../almanac-state.js';
import { mayhemState } from '../mayhem-state.js';
import { addSouls, rollCurio } from './mayhem.js';
import { dayNumber } from './daily.js';
import { localDayKey } from '../state.js';

/* ================= THE ALMANAC: PROGRESS =================
   A chapter has a 30-tier free track. XP comes from the things the game already
   has, and none of it asks the rest of the game to know the Almanac exists:
   once a render, syncAlmanac() reads counters the game already keeps (emergencies
   resolved, coffins opened, care given, court cases aired, arcade runs, outings)
   and pays XP for whatever has gone up since it last looked. Each source has a
   daily cap and the whole day has a cap, so nothing here can be farmed.

   Everything runs on the local calendar day, like the omen and the docket. Nothing
   competitive or paid reads this. All of it is soul-sized and local. */

const sum = list => list.reduce((n, x) => n + x, 0);
const isoParts = iso => iso.split('-').map(Number);
export const isoDayNumber = iso => { const [y, m, d] = isoParts(iso); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
const daysInMonth = (y, m1) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
const dayNo = ts => dayNumber(localDayKey(ts));
export const weekNumber = ts => Math.floor((dayNo(ts) + 3) / 7);   // weeks run Monday to Sunday; day 0 was a Thursday

/* ---------- chapters ---------- */
const BASE = CHAPTERS.map(c => ({ ...c, key: c.id, fromNo: isoDayNumber(c.from), toNo: isoDayNumber(c.to) }));
BASE.forEach(c => { c.days = c.toNo - c.fromNo + 1; });
export const LAST_YEAR = Number(CHAPTERS[CHAPTERS.length - 1].to.slice(0, 4));

function shifted(c, years, y) {
  const [fy, fm, fd] = isoParts(c.from), [ty, tm, td] = isoParts(c.to);
  const toDay = tm === 2 && td === 28 && daysInMonth(ty + years, 2) === 29 ? 29 : td;
  const fromNo = Math.floor(Date.UTC(fy + years, fm - 1, fd) / 86400000), toNo = Math.floor(Date.UTC(ty + years, tm - 1, toDay) / 86400000);
  return { ...c, key: c.id + '~' + y, encore: true, fromNo, toNo, days: toNo - fromNo + 1 };
}

// The chapter running on this date. Before the first chapter there is none. After
// the last one the calendar comes round again: the same month of the final year,
// as an "encore" whose prizes pay souls for anything already owned. So the Almanac
// never goes quiet, and nothing needs an update to keep it going.
export function chapterAt(now = Date.now()) {
  const n = dayNo(now);
  if (n < BASE[0].fromNo) return null;
  const direct = BASE.find(c => n >= c.fromNo && n <= c.toNo);
  if (direct) return direct;
  const d = new Date(now), y = d.getFullYear(), years = y - LAST_YEAR;
  if (years < 1) return null;
  const month = d.getMonth() + 1, day = Math.min(d.getDate(), daysInMonth(LAST_YEAR, month));
  const ref = Math.floor(Date.UTC(LAST_YEAR, month - 1, day) / 86400000);
  const source = BASE.slice().reverse().find(c => ref >= c.fromNo && ref <= c.toNo && c.from >= LAST_YEAR + '-01-01');
  return source ? shifted(source, years, y) : null;
}
const noonOf = no => { const d = new Date(no * 86400000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12).getTime(); };
// The chapter that opens after the running one (or the first, before the Almanac begins).
export function nextChapter(now = Date.now()) {
  const cur = chapterAt(now);
  if (!cur) return BASE.find(c => c.fromNo > dayNo(now)) || null;
  return chapterAt(noonOf(cur.toNo + 1));
}
export const daysLeft = (chapter, now = Date.now()) => Math.max(0, chapter.toNo - dayNo(now) + 1);
// Chapters that have already finished: the source of Back Issues.
export const pastChapters = (now = Date.now()) => BASE.filter(c => c.toNo < dayNo(now));

/* ---------- tiers ---------- */
const tierCache = new Map();
// XP each tier costs, summing to TRACK_XP_PER_DAY a day over the chapter, with later tiers a little dearer.
export function tierCosts(days) {
  if (tierCache.has(days)) return tierCache.get(days);
  const total = Math.round(days * TRACK_XP_PER_DAY);
  const weights = Array.from({ length: TIERS }, (_, i) => 0.85 + 0.3 * (i / (TIERS - 1)));
  const wsum = sum(weights);
  const costs = weights.map(w => Math.max(5, Math.round(total * w / wsum)));
  costs[TIERS - 1] += total - sum(costs);
  tierCache.set(days, costs);
  return costs;
}
export function tierThresholds(days) { let acc = 0; return tierCosts(days).map(c => (acc += c)); }
export const tierFor = (xp, days) => tierThresholds(days).filter(t => xp >= t).length;

const bit = tier => 2 ** (tier - 1);
export const isClaimed = (rec, tier) => !!rec && Math.floor(rec.claimed / bit(tier)) % 2 === 1;

export function chapterRecord(state, chapter) {
  const a = almanacState(state);
  return a.chapters[chapter.key] || { xp: 0, claimed: 0, badge: 0, spot: 0 };
}
function ensureRecord(state, chapter) {
  const a = almanacState(state);
  if (!a.chapters[chapter.key]) {
    a.chapters[chapter.key] = { xp: 0, claimed: 0, badge: 0, spot: 0 };
    // Keep the newest 60 records. Insertion order is age, and the record just made is never the one to go.
    const older = Object.keys(a.chapters).filter(k => k !== chapter.key);
    for (const k of older.slice(0, Math.max(0, older.length - 59))) delete a.chapters[k];
  }
  return a.chapters[chapter.key];
}

/* What a tier pays, as words and as numbers. */
export function rewardOf(chapter, tier) {
  const t = TRACK[tier - 1];
  if (t.kind === 'souls') return { tier, kind: 'souls', amount: t.amount, label: t.amount + ' souls', short: '+' + t.amount };
  if (t.kind === 'curio') { const c = chapter.curios[t.index]; return { tier, kind: 'curio', curio: c, label: c.name, short: 'Curio' }; }
  if (t.kind === 'decor') return { tier, kind: 'decor', label: chapter.decor.room.name + ' room set', short: 'Room set' };
  if (t.kind === 'title') return { tier, kind: 'title', label: 'Title: ' + chapter.title, short: 'Title' };
  return { tier, kind: 'badge', amount: t.amount, label: 'Badge: ' + chapter.badge + ' + ' + t.amount + ' souls', short: 'Badge' };
}

export function chapterView(state, now = Date.now()) {
  const chapter = chapterAt(now);
  if (!chapter) {
    const next = nextChapter(now);
    return { chapter: null, next, opensIn: next ? Math.max(0, next.fromNo - dayNo(now)) : 0, ready: [] };
  }
  const rec = chapterRecord(state, chapter), costs = tierCosts(chapter.days), marks = tierThresholds(chapter.days);
  const tier = tierFor(rec.xp, chapter.days);
  const rewards = TRACK.map((t, i) => {
    const claimed = isClaimed(rec, t.tier), reached = t.tier <= tier;
    return { ...rewardOf(chapter, t.tier), state: claimed ? 'claimed' : reached ? 'ready' : 'locked', xpAt: marks[i] };
  });
  const ready = rewards.filter(r => r.state === 'ready');
  const nextTier = tier < TIERS ? tier + 1 : 0;
  const base = tier ? marks[tier - 1] : 0;
  const a = almanacState(state);
  return {
    chapter, rec, xp: rec.xp, tier, rewards, ready, left: daysLeft(chapter, now),
    next: nextTier ? { tier: nextTier, have: rec.xp - base, need: costs[nextTier - 1], reward: rewards[nextTier - 1] } : null,
    done: tier >= TIERS, badge: rec.badge === 1,
    today: { xp: a.day === localDayKey(now) ? a.xp : 0, cap: DAILY_XP_CAP }
  };
}

/* ---------- paying XP ---------- */
// Straight into the running chapter, outside the daily cap: for things that happen
// at most once (a spotlight case, a weekly challenge, a return chest).
export function grantXp(state, amount, now = Date.now()) {
  const chapter = chapterAt(now), n = Math.max(0, Math.floor(amount || 0));
  if (!chapter || !n) return 0;
  const rec = ensureRecord(state, chapter);
  rec.xp = Math.min(1e6, rec.xp + n);
  return n;
}
function dailyXp(state, a, chapter, source, raw) {
  const rule = XP_RULES[source];
  if (!rule || !chapter || !(raw > 0)) return 0;
  const room = Math.min(rule.cap - (a.by[source] || 0), DAILY_XP_CAP - a.xp);
  const pay = Math.max(0, Math.min(raw, room));
  if (!pay) return 0;
  a.by[source] = (a.by[source] || 0) + pay;
  a.xp += pay;
  ensureRecord(state, chapter).xp += pay;
  return pay;
}

/* ---------- weekly challenges ---------- */
function hash(n) { let h = Math.imul(n ^ 0x9e3779b9, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); return (h ^ (h >>> 16)) >>> 0; }
// Three challenges from three different families, chosen by the week number alone.
export function weeklyChallenges(weekNo) {
  const order = WEEKLY_FAMILIES.map((family, i) => ({ family, key: hash(weekNo * 31 + i) })).sort((x, y) => x.key - y.key).slice(0, 3);
  return order.map(({ family }, i) => {
    const kinds = family;
    const kind = kinds[hash(weekNo * 17 + i * 5 + 1) % kinds.length];
    const options = WEEKLY_POOL.filter(c => c.kind === kind);
    return options[hash(weekNo * 13 + i * 3 + 2) % options.length];
  });
}

function readCounters(state, now) {
  const m = mayhemState(state), pets = state.pets || [], today = localDayKey(now), arcade = state.arcade || {}, court = state.courtroom || {};
  const chores = m.chores?.day === today ? m.chores : null;
  return {
    abs: {
      care: sum(pets.map(p => (p.careLog?.food || 0) + (p.careLog?.fuss || 0) + (p.careLog?.clean || 0))),
      resolved: m.resolved || 0, coffins: m.coffins || 0, outings: state.life?.outings || 0, episodes: court.episodes || 0,
      arcade: sum(Object.values(arcade.plays || {}).map(v => Number(v) || 0)),
      dplays: arcade.daily?.day === today ? arcade.daily.plays || 0 : 0,
      curios: Object.keys(m.curios || {}).length
    },
    flags: {
      omen: m.omen?.day === today ? 1 : 0,
      chores: chores ? chores.list.filter(c => c.done).length : 0,
      choresAll: chores?.bonus ? 1 : 0,
      docket: court.docketDay === today ? 1 : 0,
      daily: arcade.dailyLastDay === today ? 1 : 0
    }
  };
}

/* ---------- the sync ---------- */
export function syncAlmanac(state, now = Date.now()) {
  const a = almanacState(state), events = [];
  if (!(state.pets || []).length) return events;
  const today = localDayKey(now), cur = readCounters(state, now);
  if (!a.init) {
    // An older save has history but no Almanac. Start from where it is: no windfall for the past.
    a.seen = { ...a.seen, ...cur.abs }; a.flags = { ...cur.flags }; a.day = today; a.week.no = weekNumber(now); a.init = 1;
    return events;
  }
  // A new day (never an earlier one: winding the clock back must not refill the day).
  if (!a.day || dayNumber(today) > dayNumber(a.day)) { a.day = today; a.xp = 0; a.by = {}; a.flags = {}; a.seen.dplays = 0; }
  const wk = weekNumber(now);
  if (!a.week.no) a.week.no = wk;
  else if (wk > a.week.no) settleWeek(state, wk, now, events);

  const delta = {};
  for (const k of COUNTERS) {
    const d = cur.abs[k] - a.seen[k];
    delta[k] = d > 0 ? d : 0;      // a count that fell (a restore, a rehoming) is re-based, never paid
    a.seen[k] = cur.abs[k];
  }
  const flagged = {};
  for (const k of Object.keys(cur.flags)) { flagged[k] = Math.max(0, cur.flags[k] - (a.flags[k] || 0)); a.flags[k] = Math.max(a.flags[k] || 0, cur.flags[k]); }

  const chapter = chapterAt(now), before = chapter ? tierFor(chapterRecord(state, chapter).xp, chapter.days) : 0;
  let gained = 0;
  const pay = (source, count) => { gained += dailyXp(state, a, chapter, source, count * XP_RULES[source].per); };
  pay('omen', flagged.omen);
  pay('chore', flagged.chores);
  pay('choresAll', flagged.choresAll);
  pay('emergency', delta.resolved);
  pay('care', delta.care);
  pay('coffin', delta.coffins);
  pay('court', delta.episodes);
  pay('docket', flagged.docket);
  pay('arcade', delta.arcade + delta.dplays);
  pay('daily', flagged.daily);
  pay('expedition', delta.outings);

  // The chapter’s Court spotlight: airing it pays once, whatever else the day has paid.
  if (chapter && delta.episodes > 0) {
    const last = state.courtroom?.last, at = chapter.spotlight.indexOf(last);
    if (at >= 0) {
      const rec = ensureRecord(state, chapter);
      if (Math.floor(rec.spot / 2 ** at) % 2 === 0) {
        rec.spot += 2 ** at;
        grantXp(state, SPOTLIGHT_XP, now); gained += SPOTLIGHT_XP;
        addSouls(state, SPOTLIGHT_SOULS);
        events.push({ type: 'spotlight', caseId: last, souls: SPOTLIGHT_SOULS, xp: SPOTLIGHT_XP });
      }
    }
  }

  // Weekly counts, from the same deltas.
  const w = a.week, bump = (kind, n) => { if (n > 0) w.counts[kind] = Math.min(99999, (w.counts[kind] || 0) + n); };
  bump('emergency', delta.resolved); bump('care', delta.care); bump('coffin', delta.coffins); bump('court', delta.episodes);
  bump('arcade', delta.arcade + delta.dplays); bump('expedition', delta.outings); bump('curio', delta.curios);
  bump('omen', flagged.omen); bump('chore', flagged.chores); bump('docket', flagged.docket); bump('daily', flagged.daily);
  for (const c of weeklyChallenges(w.no)) {
    if (!w.done.includes(c.id) && (w.counts[c.kind] || 0) >= c.need) { w.done.push(c.id); events.push({ type: 'weekly', id: c.id, label: c.label }); }
  }

  if (gained) events.unshift({ type: 'xp', amount: gained });
  if (chapter) {
    const after = tierFor(chapterRecord(state, chapter).xp, chapter.days);
    if (after > before) events.push({ type: 'tier', tier: after, from: before });
  }
  return events;
}
export const SPOTLIGHT_SOULS = 40;

/* ---------- claiming ---------- */
function ownedDecorKeys(state) { return new Set(state.decor?.owned || []); }
function grantDecor(state, keys) {
  const owned = ownedDecorKeys(state);
  const fresh = keys.filter(k => !owned.has(k));
  if (fresh.length) state.decor.owned = [...(state.decor.owned || []), ...fresh];
  return fresh;
}
export function decorKeys(chapter) {
  const { room, wood, wall } = chapter.decor;
  return ['room:' + room.id, 'wood:' + wood.id, 'wall:' + wall];
}
function grantTitle(state, id) {
  const ex = exchangeState(state);
  if (ex.titles.includes(id)) return false;
  ex.titles.push(id);
  return true;
}

/* Pay a reward that is the same whoever claims it. Returns what happened so a
   screen can say so. A prize already owned (an encore year, or a Back Issue
   bought earlier) pays souls instead, so no claim is ever empty. */
export function payReward(state, chapter, tier, now = Date.now()) {
  const r = rewardOf(chapter, tier), m = mayhemState(state);
  const out = { tier, kind: r.kind, label: r.label, souls: 0, rankUp: null };
  const souls = amount => { out.souls += amount; const up = addSouls(state, amount); if (up) out.rankUp = up; };
  if (r.kind === 'souls') souls(r.amount);
  else if (r.kind === 'curio') {
    const duplicate = !!m.curios[r.curio.id];
    m.curios[r.curio.id] = (m.curios[r.curio.id] || 0) + 1;
    out.curio = ALMANAC_CURIO_BY_ID[r.curio.id]; out.duplicate = duplicate;
    if (duplicate) souls(EDITION_RARITY.refund);
  } else if (r.kind === 'decor') {
    const fresh = grantDecor(state, decorKeys(chapter));
    out.decor = fresh; out.duplicate = !fresh.length;
    if (!fresh.length) souls(100);
  } else if (r.kind === 'title') {
    out.title = chapter.title; out.duplicate = !grantTitle(state, 'ch:' + chapter.id);
    if (out.duplicate) souls(80);
  } else if (r.kind === 'badge') {
    out.badge = chapter.badge;
    souls(r.amount);
  }
  return out;
}

export function claimTier(state, chapter, tier, now = Date.now()) {
  if (!chapter || !(tier >= 1 && tier <= TIERS)) return null;
  const rec = ensureRecord(state, chapter);
  if (tierFor(rec.xp, chapter.days) < tier || isClaimed(rec, tier)) return null;
  rec.claimed += bit(tier);
  const a = almanacState(state);
  a.stats.tiers += 1;
  const result = payReward(state, chapter, tier, now);
  if (result.kind === 'badge') { rec.badge = 1; a.stats.badges += 1; }
  return result;
}
export function claimReady(state, now = Date.now()) {
  const chapter = chapterAt(now);
  if (!chapter) return [];
  const rec = chapterRecord(state, chapter), reached = tierFor(rec.xp, chapter.days), out = [];
  for (let t = 1; t <= reached; t++) { const r = claimTier(state, chapter, t, now); if (r) out.push(r); }
  return out;
}
export function readyCount(state, now = Date.now()) {
  const chapter = chapterAt(now);
  if (!chapter) return 0;
  const rec = chapterRecord(state, chapter), reached = tierFor(rec.xp, chapter.days);
  let n = 0;
  for (let t = 1; t <= reached; t++) if (!isClaimed(rec, t)) n++;
  return n;
}

/* ---------- the week ---------- */
export function weeklyView(state, now = Date.now()) {
  const a = almanacState(state), w = a.week.no === weekNumber(now) ? a.week : { ...blankWeek(), no: weekNumber(now) };
  const items = weeklyChallenges(weekNumber(now)).map(c => ({
    ...c, have: Math.min(c.need, w.counts[c.kind] || 0), done: w.done.includes(c.id), claimed: w.claimed.includes(c.id)
  }));
  const all = items.every(c => c.done);
  const endsIn = ((weekNumber(now) + 1) * 7 - 3) - dayNo(now);
  return { week: w.no, items, chest: { ready: all && !w.chest, claimed: w.chest === 1, souls: CHEST_SOULS }, endsIn };
}
export function claimWeekly(state, id, now = Date.now()) {
  const a = almanacState(state), w = a.week;
  if (w.no !== weekNumber(now) || !w.done.includes(id) || w.claimed.includes(id)) return null;
  w.claimed.push(id);
  const up = addSouls(state, WEEKLY_SOULS);
  grantXp(state, WEEKLY_XP, now);
  a.stats.weekly += 1;
  return { id, souls: WEEKLY_SOULS, xp: WEEKLY_XP, rankUp: up };
}
export function claimChest(state, now = Date.now(), rnd = Math.random) {
  const a = almanacState(state), w = a.week;
  if (w.no !== weekNumber(now) || w.chest || weeklyChallenges(w.no).some(c => !w.done.includes(c.id))) return null;
  w.chest = 1;
  const up = addSouls(state, CHEST_SOULS);
  grantXp(state, CHEST_XP, now);
  const curio = rollCurio(state, rnd, false, now);
  a.stats.chests += 1;
  return { souls: CHEST_SOULS, xp: CHEST_XP, curio, rankUp: up || curio.rankUp || null };
}
// When a week ends, whatever was earned and not claimed is paid at once. Nothing is lost for being away.
function settleWeek(state, wk, now, events) {
  const a = almanacState(state), w = a.week;
  const done = w.done.filter(id => !w.claimed.includes(id)).length;
  const all = weeklyChallenges(w.no).every(c => w.done.includes(c.id));
  let souls = 0, xp = 0, text = '';
  if (done) { souls += done * WEEKLY_SOULS; xp += done * WEEKLY_XP; a.stats.weekly += done; }
  let curio = null;
  if (all && !w.chest) { souls += CHEST_SOULS; xp += CHEST_XP; a.stats.chests += 1; curio = rollCurio(state, Math.random, false, now); }
  if (souls) {
    addSouls(state, souls); grantXp(state, xp, now);
    text = 'Last week’s unclaimed prizes were paid out on the way past: ' + souls + ' souls' + (xp ? ' and ' + xp + ' XP' : '') + (curio ? ', and the chest was opened for you (' + curio.curio.name + ')' : '') + '.';
    a.settled = { text, souls, xp };
    events.push({ type: 'settled', souls, xp });
  }
  a.week = { ...blankWeek(), no: wk };
}
export function dismissSettled(state) { almanacState(state).settled = null; }

/* ---------- Back Issues ---------- */
export function spendSouls(state, amount) {
  const m = mayhemState(state);
  if (!(amount > 0) || m.souls < amount) return false;
  m.souls -= amount;
  return true;
}
const BARGAIN_PICK = 7;
export function backIssues(state, now = Date.now()) {
  const m = mayhemState(state), owned = ownedDecorKeys(state);
  const curios = [], decor = [];
  for (const c of pastChapters(now)) {
    for (const k of c.curios) if (!m.curios[k.id]) curios.push({ kind: 'curio', id: k.id, chapter: c.id, chapterName: c.name, name: k.name, curio: ALMANAC_CURIO_BY_ID[k.id], cost: BACK_ISSUE_COST });
    if (decorKeys(c).some(key => !owned.has(key))) decor.push({ kind: 'decor', id: 'set:' + c.id, chapter: c.id, chapterName: c.name, name: c.decor.room.name + ' room set', cost: BACK_ISSUE_DECOR_COST });
  }
  // One curio a week is marked down. It is chosen from every past curio, owned or not, so buying it
  // does not move the markdown onto the next one: once it is yours, the week has no bargain left.
  const every = pastChapters(now).flatMap(c => c.curios.map(k => k.id));
  const pickId = every.length ? every[(weekNumber(now) * BARGAIN_PICK + 3) % every.length] : '';
  const pick = curios.find(item => item.id === pickId) || null;
  if (pick) { pick.bargain = true; pick.was = pick.cost; pick.cost = Math.round(pick.cost * (1 - BACK_ISSUE_BARGAIN)); }
  return { curios, decor, bargain: pick };
}
export function buyBackIssue(state, id, now = Date.now()) {
  const list = backIssues(state, now), a = almanacState(state), m = mayhemState(state);
  const item = id.startsWith('set:') ? list.decor.find(d => d.id === id) : list.curios.find(c => c.id === id);
  if (!item || !spendSouls(state, item.cost)) return null;
  if (item.kind === 'curio') m.curios[item.id] = 1;
  else grantDecor(state, decorKeys(CHAPTER_BY_ID[item.chapter]));
  a.stats.bought += 1;
  return { item, cost: item.cost };
}

/* A short line of flavour for the end of an emergency, from the running chapter.
   The same emergency always gets the same line, and flagship chapters always have one. */
export function chapterHook(chapter, seed, a, b) {
  if (!chapter || !chapter.hooks.length) return '';
  if (!chapter.flagship && Math.abs(Math.floor(seed)) % 2) return '';
  const line = chapter.hooks[Math.abs(Math.floor(seed)) % chapter.hooks.length];
  return line.replace(/\{a\}/g, a || 'Someone').replace(/\{b\}/g, b || 'someone else');
}
