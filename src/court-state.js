import { COURT_CASES } from './content/court.js';
import { BENCH_MAX } from './content/court-career.js';

// Shelf Court records: episodes aired, correct rulings, and the best star
// rating per case. Bounded and validated. The summons fields count today's
// rewarded summonses, remember which ones have already paid and which are
// owed (a reward past the daily cap waits for a day with room).
//
// `versions` is the Case Notebook: for each case, the best stars on every
// telling seen ('base' is the original). `recent` is the last cases aired,
// oldest first, so the next episode is not one just seen. `seats` remembers
// the episode number each resident last sat at a podium, so the cast rotates.
// `stars` is the lifetime total that feeds the bench career, `rank` the highest
// rank already paid for, and `flawless` the run of three-star episodes.
const CASE_IDS = new Set(COURT_CASES.map(c => c.id));
export const SUMMONS_REMEMBERED = 40;
export const RECENT_KEPT = 24;
export const SEATS_KEPT = 40;
export const OWED_KEPT = 20;
const SUMMONS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VERSION_KEY = /^[a-z0-9-]{1,40}$/;
const PET_KEY = /^[\w-]{1,64}$/;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
export function blankCourtroom() {
  return {
    episodes: 0, justice: 0, best: {}, last: '', docketDay: '', docketStreak: 0, docketLastDay: '', summonsDay: '', summonsHeard: 0, summonsVerdicts: 0, summonsPaid: [],
    versions: {}, recent: [], seats: {}, stars: 0, rank: 0, flawless: 0, flawlessBest: 0, summonsOwed: []
  };
}
export function courtroomState(state) {
  const c = isRecord(state.courtroom) ? state.courtroom : blankCourtroom();
  c.best = isRecord(c.best) ? c.best : {};
  c.episodes = Number.isFinite(c.episodes) ? c.episodes : 0;
  c.justice = Number.isFinite(c.justice) ? c.justice : 0;
  if (typeof c.docketDay !== 'string') c.docketDay = '';
  if (!Number.isFinite(c.docketStreak)) c.docketStreak = 0;
  if (typeof c.docketLastDay !== 'string') c.docketLastDay = '';
  if (typeof c.summonsDay !== 'string') c.summonsDay = '';
  if (!Number.isFinite(c.summonsHeard)) c.summonsHeard = 0;
  if (!Number.isFinite(c.summonsVerdicts)) c.summonsVerdicts = 0;
  if (!Array.isArray(c.summonsPaid)) c.summonsPaid = [];
  if (!isRecord(c.versions)) c.versions = {};
  if (!Array.isArray(c.recent)) c.recent = [];
  if (!isRecord(c.seats)) c.seats = {};
  if (typeof c.last !== 'string') c.last = '';
  for (const key of ['stars', 'rank', 'flawless', 'flawlessBest']) if (!Number.isFinite(c[key])) c[key] = 0;
  if (!Array.isArray(c.summonsOwed)) c.summonsOwed = [];
  state.courtroom = c;
  return c;
}
export function normalizeCourtroom(raw) {
  const out = blankCourtroom();
  if (!isRecord(raw)) return out;
  const count = value => Number.isFinite(value) && value > 0 ? Math.floor(Math.min(value, 1e7)) : 0;
  out.episodes = count(raw.episodes);
  out.justice = Math.min(count(raw.justice), out.episodes);
  if (raw.best && typeof raw.best === 'object') for (const id of CASE_IDS) {
    const stars = raw.best[id];
    if (Number.isFinite(stars) && stars >= 0) out.best[id] = Math.min(3, Math.floor(stars));
  }
  if (CASE_IDS.has(raw.last)) out.last = raw.last;
  const dayKey = value => typeof value === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(value) ? value : '';
  out.docketDay = dayKey(raw.docketDay);
  out.docketLastDay = dayKey(raw.docketLastDay);
  out.docketStreak = count(raw.docketStreak);
  out.summonsDay = dayKey(raw.summonsDay);
  out.summonsHeard = Math.min(count(raw.summonsHeard), 99);
  out.summonsVerdicts = Math.min(count(raw.summonsVerdicts), 99);
  if (Array.isArray(raw.summonsPaid)) out.summonsPaid = [...new Set(raw.summonsPaid.filter(id => typeof id === 'string' && SUMMONS_ID.test(id)))].slice(-SUMMONS_REMEMBERED);
  if (Array.isArray(raw.summonsOwed)) {
    const seen = new Set(out.summonsPaid);
    for (const item of raw.summonsOwed) {
      if (!isRecord(item) || typeof item.id !== 'string' || !SUMMONS_ID.test(item.id) || seen.has(item.id) || !['heard', 'verdict'].includes(item.kind)) continue;
      seen.add(item.id);
      out.summonsOwed.push({ id: item.id, kind: item.kind });
    }
    out.summonsOwed = out.summonsOwed.slice(-OWED_KEPT);
  }
  if (isRecord(raw.versions)) for (const id of CASE_IDS) {
    const rec = raw.versions[id];
    if (!isRecord(rec)) continue;
    const kept = {};
    for (const [key, stars] of Object.entries(rec)) {
      if (Object.keys(kept).length >= 12) break;
      if (VERSION_KEY.test(key) && Number.isFinite(stars) && stars >= 0) kept[key] = Math.min(3, Math.floor(stars));
    }
    if (Object.keys(kept).length) out.versions[id] = kept;
  }
  if (Array.isArray(raw.recent)) {
    // Oldest first, each case once (its latest place), and no more than are kept.
    const ids = raw.recent.filter(id => CASE_IDS.has(id));
    out.recent = ids.filter((id, i) => ids.lastIndexOf(id) === i).slice(-RECENT_KEPT);
  }
  if (isRecord(raw.seats)) {
    const entries = Object.entries(raw.seats).filter(([id, n]) => PET_KEY.test(id) && Number.isFinite(n) && n >= 0).map(([id, n]) => [id, count(n)]);
    entries.sort((a, b) => b[1] - a[1]);
    out.seats = Object.fromEntries(entries.slice(0, SEATS_KEPT));
  }
  out.stars = Math.min(count(raw.stars), 1e6);
  out.rank = Math.min(count(raw.rank), BENCH_MAX);
  out.flawless = Math.min(count(raw.flawless), 9999);
  out.flawlessBest = Math.max(out.flawless, Math.min(count(raw.flawlessBest), 9999));
  return out;
}
