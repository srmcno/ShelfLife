// The tester clock: whole days added to every clock reading in the game, so a
// tester can see tomorrow's omen, chores and daily challenge without waiting.
//
// Set only from the tester panel (src/ui/tester-panel.js), kept in this
// browser under shelflife.clock (outside the save, so it never travels in a
// backup or to the cloud), and applied at the next load. main.js imports this
// module first, before anything reads the time. With no offset, nothing here
// touches Date at all, which is every ordinary player.
//
// A shelf that has used it is marked as a tester save (src/tester-state.js),
// and a tester save never sends scores or Court verdict stars to the server.

export const CLOCK_KEY = 'shelflife.clock';
export const DAY_MS = 86400000;
export const MAX_OFFSET_DAYS = 60;
const RealDate = globalThis.Date;
let offset = 0;

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// A whole number of days, 0 to 60, as milliseconds.
export function cleanOffset(value) {
  const days = Math.round(Number(value) / DAY_MS);
  return Number.isFinite(days) && days > 0 ? Math.min(days, MAX_OFFSET_DAYS) * DAY_MS : 0;
}

export function readOffset(store = storage()) {
  try { return cleanOffset(JSON.parse(store?.getItem(CLOCK_KEY) || '{}')?.offset); } catch { return 0; }
}

// Stored for the next load. Returns the offset that will apply.
export function setClockOffset(ms, store = storage()) {
  const next = cleanOffset(ms);
  try {
    if (next) store?.setItem(CLOCK_KEY, JSON.stringify({ offset: next }));
    else store?.removeItem(CLOCK_KEY);
  } catch { /* storage is optional; the panel says if it did not stick */ }
  return next;
}

export const clockOffset = () => offset;
export const offsetDays = () => Math.round(offset / DAY_MS);
export const realNow = () => RealDate.now();

// Date.now() and new Date() read `ms` later than the device says. Dates
// built from a value, Date.parse and Date.UTC are untouched.
export function installClock(ms) {
  offset = cleanOffset(ms);
  if (!offset || globalThis.Date !== RealDate) return offset > 0;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(RealDate.now() + offset);
    }
    static now() { return RealDate.now() + offset; }
  }
  globalThis.Date = ShiftedDate;
  return true;
}

installClock(readOffset());
