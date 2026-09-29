import { COURT_CASES } from './content/court.js';

// Shelf Court records: episodes aired, correct rulings, and the best star
// rating per case. Bounded and validated. The summons fields count today's
// rewarded summonses and remember which ones have already paid.
const CASE_IDS = new Set(COURT_CASES.map(c => c.id));
export const SUMMONS_REMEMBERED = 40;
const SUMMONS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function blankCourtroom() {
  return { episodes: 0, justice: 0, best: {}, last: '', docketDay: '', docketStreak: 0, docketLastDay: '', summonsDay: '', summonsHeard: 0, summonsVerdicts: 0, summonsPaid: [] };
}
export function courtroomState(state) {
  const c = state.courtroom && typeof state.courtroom === 'object' && !Array.isArray(state.courtroom) ? state.courtroom : blankCourtroom();
  c.best = c.best && typeof c.best === 'object' && !Array.isArray(c.best) ? c.best : {};
  c.episodes = Number.isFinite(c.episodes) ? c.episodes : 0;
  c.justice = Number.isFinite(c.justice) ? c.justice : 0;
  if (typeof c.docketDay !== 'string') c.docketDay = '';
  if (!Number.isFinite(c.docketStreak)) c.docketStreak = 0;
  if (typeof c.docketLastDay !== 'string') c.docketLastDay = '';
  if (typeof c.summonsDay !== 'string') c.summonsDay = '';
  if (!Number.isFinite(c.summonsHeard)) c.summonsHeard = 0;
  if (!Number.isFinite(c.summonsVerdicts)) c.summonsVerdicts = 0;
  if (!Array.isArray(c.summonsPaid)) c.summonsPaid = [];
  state.courtroom = c;
  return c;
}
export function normalizeCourtroom(raw) {
  const out = blankCourtroom();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
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
  return out;
}
