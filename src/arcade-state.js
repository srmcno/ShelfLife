import { ARCADE_BY_ID } from './content/arcade.js';

// Arcade records: best score and play count per game. Bounded and validated.
export function blankArcade() { return { best: {}, plays: {}, lastGame: '' }; }
export function arcadeState(state) {
  const a = state.arcade && typeof state.arcade === 'object' && !Array.isArray(state.arcade) ? state.arcade : blankArcade();
  a.best = a.best && typeof a.best === 'object' ? a.best : {};
  a.plays = a.plays && typeof a.plays === 'object' ? a.plays : {};
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
  return out;
}
