import { ARCADE_BY_ID } from './content/arcade.js';

// Arcade records: best score and play count per game. Bounded and validated.
export function blankArcade() { return { best: {}, plays: {}, lastGame: '', daily: null, dailyStreak: 0, dailyLastDay: '' }; }
export function arcadeState(state) {
  const a = state.arcade && typeof state.arcade === 'object' && !Array.isArray(state.arcade) ? state.arcade : blankArcade();
  a.best = a.best && typeof a.best === 'object' ? a.best : {};
  a.plays = a.plays && typeof a.plays === 'object' ? a.plays : {};
  if (!Number.isFinite(a.dailyStreak)) a.dailyStreak = 0;
  if (typeof a.dailyLastDay !== 'string') a.dailyLastDay = '';
  state.arcade = a;
  return a;
}
export function normalizeArcade(raw) {
  const out = blankArcade();
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(ARCADE_BY_ID)) {
    const best = raw.best?.[id], plays = raw.plays?.[id];
    if (Number.isFinite(best) && best > 0) out.best[id] = Math.floor(Math.min(best, 1e6));
    if (Number.isFinite(plays) && plays > 0) out.plays[id] = Math.floor(Math.min(plays, 1e7));
  }
  if (ARCADE_BY_ID[raw.lastGame]) out.lastGame = raw.lastGame;
  const d = raw.daily;
  if (d && typeof d === 'object' && typeof d.day === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(d.day) && ARCADE_BY_ID[d.game]) {
    out.daily = { day: d.day, game: d.game, mod: typeof d.mod === 'string' ? d.mod.slice(0, 24) : '',
      best: Number.isFinite(d.best) && d.best > 0 ? Math.floor(Math.min(d.best, 1e6)) : 0,
      plays: Number.isFinite(d.plays) && d.plays > 0 ? Math.floor(Math.min(d.plays, 1e5)) : 0, claimed: d.claimed === true };
  }
  out.dailyStreak = Number.isFinite(raw.dailyStreak) && raw.dailyStreak > 0 ? Math.floor(Math.min(raw.dailyStreak, 1e5)) : 0;
  out.dailyLastDay = typeof raw.dailyLastDay === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(raw.dailyLastDay) ? raw.dailyLastDay : '';
  return out;
}
