import { COUNTERS, COVEN_CURIO_BY_ID, SIGIL_FRAME_BY_ID, AWARD_BY_ID, DAILY_CAPS } from './content/coven.js';

/* What this shelf keeps about its coven. The coven itself (members, the week,
   the board) lives on the server; this is only the local half:

     seen, flagDay, flags   the counters the Almanac reads, as last seen, so a
                            change can be counted once (engine/coven.js)
     day, tally, sent       today's running totals per counter (UTC day) and
                            what the server has acknowledged
     prev                   yesterday's totals, if they were not all sent
     covenId                the coven this shelf counts for, or '' for none
     claimed                chests already paid here, as "week:tier"
     curios, frames, frame  the coven cupboard and the sigil frame worn
     trophies               this player's own Shelfies, newest first
     seenAwards, seenNote   what has been read, for the postbox
     hidden                 notes this player hid from their own board
     invite                 a pending invitation code from a shared link, and
                            the referral rewards already paid

   Small, bounded, rebuilt from blank, so an older save loads unchanged and a
   hand-edited one cannot break anything. Unknown fields are dropped. */
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const int = (value, max = 1e9) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOCAL_DAY = /^\d{4}-\d{1,2}-\d{1,2}$/;
const UTC_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-HJKMNP-Z2-9]{8}$/;
export const SEEN_KEYS = ['care', 'resolved', 'coffins', 'outings', 'episodes', 'arcade', 'curios'];
export const FLAG_KEYS = ['omen', 'chores', 'docket', 'daily'];
export const TROPHY_MAX = 12, CLAIMED_MAX = 24, HIDDEN_MAX = 40, PAID_MAX = 12;

export function blankCoven() {
  return {
    v: 1, init: 0, seen: Object.fromEntries(SEEN_KEYS.map(k => [k, 0])), flagDay: '', flags: {},
    day: '', tally: {}, sent: {}, prev: null, covenId: '',
    claimed: [], curios: {}, frames: [], frame: '', trophies: [], seenAwards: 0, seenNote: 0, hidden: [],
    invite: { code: '', paid: [] }
  };
}

function counts(raw) {
  const out = {};
  if (object(raw)) for (const k of COUNTERS) if (Number.isFinite(raw[k]) && raw[k] > 0) out[k] = int(raw[k], DAILY_CAPS[k]);
  return out;
}

export function normalizeCovenState(raw) {
  const out = blankCoven();
  if (!object(raw)) return out;
  out.init = raw.init === 1 ? 1 : 0;
  if (object(raw.seen)) for (const k of SEEN_KEYS) out.seen[k] = int(raw.seen[k]);
  out.flagDay = typeof raw.flagDay === 'string' && LOCAL_DAY.test(raw.flagDay) ? raw.flagDay : '';
  if (object(raw.flags)) for (const k of FLAG_KEYS) if (Number.isFinite(raw.flags[k])) out.flags[k] = int(raw.flags[k], 9);
  out.day = typeof raw.day === 'string' && UTC_DAY.test(raw.day) ? raw.day : '';
  out.tally = counts(raw.tally);
  out.sent = counts(raw.sent);
  if (object(raw.prev) && typeof raw.prev.day === 'string' && UTC_DAY.test(raw.prev.day)) {
    out.prev = { day: raw.prev.day, tally: counts(raw.prev.tally) };
  }
  out.covenId = typeof raw.covenId === 'string' && UUID.test(raw.covenId) ? raw.covenId : '';
  out.claimed = [...new Set((Array.isArray(raw.claimed) ? raw.claimed : []).filter(c => typeof c === 'string' && /^\d{1,7}:[1-3]$/.test(c)))].slice(-CLAIMED_MAX);
  if (object(raw.curios)) for (const [id, n] of Object.entries(raw.curios)) if (Object.hasOwn(COVEN_CURIO_BY_ID, id) && Number.isFinite(n) && n > 0) out.curios[id] = int(n, 999);
  out.frames = [...new Set((Array.isArray(raw.frames) ? raw.frames : []).filter(id => typeof id === 'string' && Object.hasOwn(SIGIL_FRAME_BY_ID, id)))];
  out.frame = out.frames.includes(raw.frame) ? raw.frame : '';
  out.trophies = (Array.isArray(raw.trophies) ? raw.trophies : [])
    .filter(t => object(t) && typeof t.award === 'string' && Object.hasOwn(AWARD_BY_ID, t.award) && Number.isFinite(t.week))
    .slice(0, TROPHY_MAX)
    .map(t => ({ week: int(t.week, 1e7), award: t.award, n: int(t.n, 1e6), coven: typeof t.coven === 'string' ? t.coven.slice(0, 80) : '' }));
  out.seenAwards = int(raw.seenAwards, 1e7);
  out.seenNote = int(raw.seenNote, Number.MAX_SAFE_INTEGER);
  out.hidden = [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter(id => Number.isSafeInteger(id) && id > 0))].slice(-HIDDEN_MAX);
  if (object(raw.invite)) {
    out.invite.code = typeof raw.invite.code === 'string' && CODE.test(raw.invite.code) ? raw.invite.code : '';
    out.invite.paid = [...new Set((Array.isArray(raw.invite.paid) ? raw.invite.paid : []).filter(id => typeof id === 'string' && UUID.test(id)))].slice(-PAID_MAX);
  }
  return out;
}

// For engines and tests that build a state by hand.
export function covenState(state) {
  if (!object(state.coven)) state.coven = blankCoven();
  return state.coven;
}
