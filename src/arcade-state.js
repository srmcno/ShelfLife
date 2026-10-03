import { ARCADE_BY_ID, ARCADE_THEMES, THEME_BY_ID, DEFAULT_THEME, LEGACY_TIERS } from './content/arcade.js';

// Arcade records: best score, play count and best skull (medal) per game, the
// lifetime run count that unlocks arenas, the chosen arena, today's challenge
// and the last fortnight of challenge days. Everything is bounded and
// validated; fields this build does not know are dropped.
const DAY_KEY = /^\d{4}-\d{1,2}-\d{1,2}$/;
export const HISTORY_DAYS = 14;

export function blankArcade() {
  return { best: {}, plays: {}, lastGame: '', daily: null, dailyStreak: 0, dailyLastDay: '', medals: {}, runs: 0, theme: DEFAULT_THEME, history: [] };
}
export function arcadeState(state) {
  const a = state.arcade && typeof state.arcade === 'object' && !Array.isArray(state.arcade) ? state.arcade : blankArcade();
  a.best = a.best && typeof a.best === 'object' ? a.best : {};
  a.plays = a.plays && typeof a.plays === 'object' ? a.plays : {};
  a.medals = a.medals && typeof a.medals === 'object' ? a.medals : {};
  a.history = Array.isArray(a.history) ? a.history : [];
  if (!Number.isFinite(a.dailyStreak)) a.dailyStreak = 0;
  if (!Number.isFinite(a.runs)) a.runs = 0;
  if (typeof a.dailyLastDay !== 'string') a.dailyLastDay = '';
  if (typeof a.theme !== 'string' || !THEME_BY_ID[a.theme]) a.theme = DEFAULT_THEME;
  state.arcade = a;
  return a;
}

// The skull a score earns against a list of thresholds.
function skulls(thresholds, score) { return thresholds.filter(t => score >= t).length; }

export function medalTotal(a) { return Object.keys(ARCADE_BY_ID).reduce((n, id) => n + (Number(a.medals?.[id]) || 0), 0); }
export function lifetimeRuns(a) {
  const plays = Object.values(a.plays || {}).reduce((n, v) => n + (Number(v) || 0), 0);
  return Math.max(Number(a.runs) || 0, plays);
}

// An arena is open once the player has the runs or the medals it asks for.
export function themeUnlocked(a, theme) {
  if (!theme || !theme.need) return true;
  if (theme.need.runs) return lifetimeRuns(a) >= theme.need.runs;
  if (theme.need.medals) return medalTotal(a) >= theme.need.medals;
  return true;
}
export function unlockedThemes(a) { return ARCADE_THEMES.filter(t => themeUnlocked(a, t)); }
// The next arena still locked, easiest first, with how far away it is.
export function nextUnlock(a) {
  const theme = ARCADE_THEMES.find(t => !themeUnlocked(a, t));
  if (!theme) return null;
  const runs = !!theme.need.runs, have = runs ? lifetimeRuns(a) : medalTotal(a), need = theme.need.runs || theme.need.medals;
  return { theme, kind: runs ? 'runs' : 'medals', have, need, left: Math.max(0, need - have) };
}

export function normalizeArcade(raw) {
  const out = blankArcade();
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(ARCADE_BY_ID)) {
    const best = raw.best?.[id], plays = raw.plays?.[id];
    if (Number.isFinite(best) && best > 0) out.best[id] = Math.floor(Math.min(best, 1e6));
    if (Number.isFinite(plays) && plays > 0) out.plays[id] = Math.floor(Math.min(plays, 1e7));
    // Medals only ever go up. An older save has none, so they are seeded from
    // the best score against the thresholds that applied when it was set.
    const medal = Number(raw.medals?.[id]);
    const seeded = out.best[id] ? skulls(LEGACY_TIERS[id], out.best[id]) : 0;
    const have = Number.isFinite(medal) ? Math.max(0, Math.min(3, Math.floor(medal))) : 0;
    if (Math.max(have, seeded) > 0) out.medals[id] = Math.max(have, seeded);
  }
  if (ARCADE_BY_ID[raw.lastGame]) out.lastGame = raw.lastGame;
  const d = raw.daily;
  if (d && typeof d === 'object' && typeof d.day === 'string' && DAY_KEY.test(d.day) && ARCADE_BY_ID[d.game]) {
    out.daily = { day: d.day, game: d.game, mod: typeof d.mod === 'string' ? d.mod.slice(0, 24) : '',
      best: Number.isFinite(d.best) && d.best > 0 ? Math.floor(Math.min(d.best, 1e6)) : 0,
      plays: Number.isFinite(d.plays) && d.plays > 0 ? Math.floor(Math.min(d.plays, 1e5)) : 0, claimed: d.claimed === true };
  }
  out.dailyStreak = Number.isFinite(raw.dailyStreak) && raw.dailyStreak > 0 ? Math.floor(Math.min(raw.dailyStreak, 1e5)) : 0;
  out.dailyLastDay = typeof raw.dailyLastDay === 'string' && DAY_KEY.test(raw.dailyLastDay) ? raw.dailyLastDay : '';
  // Lifetime runs: never fewer than the plays already on record.
  const runs = Number.isFinite(raw.runs) && raw.runs > 0 ? Math.floor(Math.min(raw.runs, 1e8)) : 0;
  out.runs = Math.max(runs, Object.values(out.plays).reduce((n, v) => n + v, 0));
  // The fortnight of challenge days: one entry per day, newest last.
  if (Array.isArray(raw.history)) {
    const seen = new Map();
    for (const h of raw.history.slice(0, 64)) {
      if (!h || typeof h !== 'object' || typeof h.day !== 'string' || !DAY_KEY.test(h.day) || !ARCADE_BY_ID[h.game]) continue;
      const best = Number.isFinite(h.best) && h.best > 0 ? Math.floor(Math.min(h.best, 1e6)) : 0;
      if (best > 0) seen.set(h.day, { day: h.day, game: h.game, mod: typeof h.mod === 'string' ? h.mod.slice(0, 24) : '', best });
    }
    out.history = [...seen.values()].sort((x, y) => dayOrder(x.day) - dayOrder(y.day)).slice(-HISTORY_DAYS);
  }
  const theme = THEME_BY_ID[raw.theme];
  out.theme = theme && themeUnlocked(out, theme) ? theme.id : DEFAULT_THEME;
  return out;
}
function dayOrder(key) { const [y, m, d] = key.split('-').map(Number); return y * 10000 + m * 100 + d; }
