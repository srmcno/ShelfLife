import { dayKeyOffset, localDayKey } from '../state.js';
import { streaksState, FREEZE_MAX } from '../almanac-state.js';

/* ================= STREAK FREEZES =================
   Three streaks reward coming back every day: the omen, the Shelf Court docket
   and the arcade daily challenge. A freeze is how the game forgives a missed day.

     * Every seventh day of a streak earns one freeze. The shelf holds two.
     * Miss exactly one day and, if a freeze is held, it is spent on its own
       and the streak carries on as though the day had been kept.
     * Nothing else changes: with no freeze held, the streaks behave exactly as
       they always did, and the omen’s older candle grace still goes first.

   The rules are here so the three streak calculations (engine/mayhem.js,
   engine/court.js and engine/arcade.js) share them rather than each keeping
   its own. This module reads and writes only `state.streaks`. */

export const FREEZE_EVERY = 7;
// A streak of one has nothing worth protecting.
export const FREEZE_MIN_STREAK = 2;
export const STREAK_NAMES = { omen: 'omen', docket: 'docket', challenge: 'daily challenge' };

export function freezeCount(state) { return streaksState(state).freezes; }

// Would a freeze bridge this gap? Exactly one missed day: the streak was last
// kept the day before yesterday. Pure, so a screen can promise it before it happens.
export function canBridge(state, lastDay, streak, now = Date.now()) {
  return streaksState(state).freezes > 0 && streak >= FREEZE_MIN_STREAK && !!lastDay && lastDay === dayKeyOffset(now, -2);
}

function note(state, kind, type, now) {
  const s = streaksState(state);
  s.notices.push({ kind, type, day: localDayKey(now), seen: 0 });
  if (s.notices.length > 4) s.notices.splice(0, s.notices.length - 4);
}

// Spend one freeze to keep a streak alive. Returns true if it was spent.
export function spendFreeze(state, kind, now = Date.now()) {
  const s = streaksState(state);
  if (s.freezes <= 0) return false;
  s.freezes -= 1; s.used += 1;
  note(state, kind, 'saved', now);
  return true;
}

// Call after a streak has gone up. Every seventh day earns a freeze, up to the limit.
export function earnFreeze(state, kind, streak, now = Date.now()) {
  const s = streaksState(state);
  if (!(streak > 0) || streak % FREEZE_EVERY !== 0 || s.freezes >= FREEZE_MAX) return false;
  s.freezes += 1; s.earned += 1;
  note(state, kind, 'earned', now);
  return true;
}

/* What the player has not been told yet. The Almanac screen shows these once, in
   plain words, and marks them seen. */
export function unseenNotices(state) { return streaksState(state).notices.filter(n => !n.seen); }
export function markNoticesSeen(state) { for (const n of streaksState(state).notices) n.seen = 1; }

export function noticeText(notice) {
  const name = STREAK_NAMES[notice.kind] || notice.kind;
  return notice.type === 'saved'
    ? 'A freeze saved your ' + name + ' streak. You missed a day. The shelf is pretending not to have noticed.'
    : 'You earned a streak freeze for seven days of the ' + name + '. It will cover one missed day, without being asked.';
}
