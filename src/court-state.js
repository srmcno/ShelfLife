import { COURT_CASES } from './content/court.js';

// Shelf Court records: episodes aired, correct rulings, and the best star
// rating per case. Bounded and validated.
const CASE_IDS = new Set(COURT_CASES.map(c => c.id));
export function blankCourtroom() { return { episodes: 0, justice: 0, best: {}, last: '', docketDay: '', docketStreak: 0, docketLastDay: '' }; }
export function courtroomState(state) {
  const c = state.courtroom && typeof state.courtroom === 'object' && !Array.isArray(state.courtroom) ? state.courtroom : blankCourtroom();
  c.best = c.best && typeof c.best === 'object' && !Array.isArray(c.best) ? c.best : {};
  c.episodes = Number.isFinite(c.episodes) ? c.episodes : 0;
  c.justice = Number.isFinite(c.justice) ? c.justice : 0;
  if (typeof c.docketDay !== 'string') c.docketDay = '';
  if (!Number.isFinite(c.docketStreak)) c.docketStreak = 0;
  if (typeof c.docketLastDay !== 'string') c.docketLastDay = '';
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
  return out;
}
