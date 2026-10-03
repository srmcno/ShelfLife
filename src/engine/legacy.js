import { LEGACY_RANKS, LEGACY_LEVELS, legacyAt } from '../content/legacy.js';
import { legacyState, legacyReached } from '../almanac-state.js';
import { mayhemState } from '../mayhem-state.js';

/* ================= LEGACY RANKS =================
   The twelve ranks end at Unspeakable. Past that, thirty Legacy ranks run on at
   ever wider gaps (content/legacy.js). Reaching one pays a cosmetic title and one
   Legacy Token, to spend in the Collector’s Exchange.

   Nothing is stored for what has been reached: the level is worked out from the
   lifetime souls the game already keeps, so a token can never be paid twice and
   a backup can never lose one. The only thing saved is how many tokens have been
   spent. No reset, no prestige, nothing taken away. */

export function legacyLevel(state) { return legacyReached(mayhemState(state).lifetime); }
export function tokenBalance(state) { return Math.max(0, legacyLevel(state) - legacyState(state).spent); }

export function legacyInfo(state) {
  const level = legacyLevel(state), life = mayhemState(state).lifetime;
  const next = level < LEGACY_LEVELS ? LEGACY_RANKS[level] : null;
  const from = level ? legacyAt(level) : legacyAt(0);
  return {
    level, rank: level ? LEGACY_RANKS[level - 1] : null, next,
    toNext: next ? next.at - life : 0,
    progress: next ? Math.min(1, Math.max(0, (life - from) / (next.at - from))) : 1,
    earned: level, spent: legacyState(state).spent, balance: tokenBalance(state)
  };
}
// The titles that Legacy ranks have already paid.
export function legacyTitleIds(state) { return Array.from({ length: legacyLevel(state) }, (_, i) => 'lg:' + (i + 1)); }

export function spendTokens(state, n) {
  if (!(n > 0) || tokenBalance(state) < n) return false;
  legacyState(state).spent += n;
  return true;
}
