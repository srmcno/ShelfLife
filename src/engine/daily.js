import { DAILY_GAME_ORDER, DAILY_MODS } from '../content/daily.js';

/* The daily challenge is a pure function of the date, so it is the same for
   everyone on that day and needs no server to agree on it. */

export function dayNumber(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const n = Math.floor(Date.UTC(y, m, d) / 86400000);
  return Number.isFinite(n) ? n : null;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
// How far along its list a game moves between one of its days and the next.
// Coprime with the list length, so every modifier comes round once per cycle,
// and more than one, so neighbours on the list are not neighbours in time.
export function modStride(length) {
  let stride = 5;
  while (stride > 1 && gcd(stride, length) !== 1) stride++;
  return length > 1 ? stride % length || 1 : 1;
}
// Days before the whole set repeats: four games, each stepping through its own list.
export function dailyCycle() { return DAILY_GAME_ORDER.length * Math.max(...DAILY_GAME_ORDER.map(g => DAILY_MODS[g].length)); }

// { day, game, mod } where mod carries the multipliers the game reads. The game
// rotates every day and each game steps through its own modifiers in turn.
export function dailyChallenge(dayKey) {
  const n = dayNumber(dayKey);
  if (n === null) return null;
  const count = DAILY_GAME_ORDER.length;
  const game = DAILY_GAME_ORDER[((n % count) + count) % count];
  const mods = DAILY_MODS[game];
  const turn = Math.floor(n / count);
  const mod = mods[(((turn * modStride(mods.length)) % mods.length) + mods.length) % mods.length];
  return { day: String(dayKey), game, mod };
}
