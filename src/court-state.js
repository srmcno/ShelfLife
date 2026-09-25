import { COURT_CASES } from './content/court.js';

// Shelf Court records: which cases were won, and which were won without
// losing any of the judge's patience. Bounded and validated.
const CASE_IDS = new Set(COURT_CASES.map(c => c.id));
export function blankCourtroom() { return { trials: 0, wins: 0, solved: [], flawless: [], last: '' }; }
export function courtroomState(state) {
  const c = state.courtroom && typeof state.courtroom === 'object' && !Array.isArray(state.courtroom) ? state.courtroom : blankCourtroom();
  c.solved = Array.isArray(c.solved) ? c.solved : [];
  c.flawless = Array.isArray(c.flawless) ? c.flawless : [];
  state.courtroom = c;
  return c;
}
export function normalizeCourtroom(raw) {
  const out = blankCourtroom();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const count = value => Number.isFinite(value) && value > 0 ? Math.floor(Math.min(value, 1e7)) : 0;
  out.trials = count(raw.trials);
  out.wins = Math.min(count(raw.wins), out.trials || count(raw.wins));
  const ids = list => [...new Set((Array.isArray(list) ? list : []).filter(id => CASE_IDS.has(id)))];
  out.solved = ids(raw.solved);
  out.flawless = ids(raw.flawless).filter(id => out.solved.includes(id));
  if (CASE_IDS.has(raw.last)) out.last = raw.last;
  return out;
}
