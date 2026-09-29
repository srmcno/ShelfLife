import { DAILY_GAME_ORDER, DAILY_MODS } from '../content/daily.js';

/* The daily challenge is a pure function of the date, so it is the same for
   everyone on that day and needs no server to agree on it. */

export function dayNumber(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const n = Math.floor(Date.UTC(y, m, d) / 86400000);
  return Number.isFinite(n) ? n : null;
}

// { day, game, mod } where mod carries the multipliers the game reads. The game
// rotates every day and each game steps through its own modifiers in turn.
export function dailyChallenge(dayKey) {
  const n = dayNumber(dayKey);
  if (n === null) return null;
  const count = DAILY_GAME_ORDER.length;
  const game = DAILY_GAME_ORDER[((n % count) + count) % count];
  const mods = DAILY_MODS[game];
  const mod = mods[Math.floor(n / count) % mods.length];
  return { day: String(dayKey), game, mod };
}
