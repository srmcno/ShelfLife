// The Case of the Week: one Shelf Court case that every household hears in the
// same week, so the neighbourhood's rulings can be counted (weekly_rule and
// weekly_tally in supabase/migrations/0016_weekly_case.sql). No DOM here.
import { COURT_CASES } from '../content/court.js';

const DAY = 86400000;
// Monday to Sunday in UTC, numbered from 1970: the same sum the server does.
export const weekNumber = (now = Date.now()) => Math.floor((Math.floor(now / DAY) + 3) / 7);
export const weekEnds = week => (week * 7 - 3 + 7) * DAY;
export function daysLeftInWeek(now = Date.now()) { return Math.max(1, Math.ceil((weekEnds(weekNumber(now)) - now) / DAY)); }

const gcd = (a, b) => b ? gcd(b, a % b) : a;
// A stride through the original cases, so consecutive weeks are never neighbours on the list.
export function weeklyCaseId(week, cases = COURT_CASES) {
  const count = cases.length;
  if (!Number.isInteger(week) || !count) return '';
  let stride = 7;
  while (gcd(stride, count) !== 1) stride++;
  return cases[(((week * stride) % count) + count) % count].id;
}

const whole = n => Number.isFinite(Number(n)) ? Math.max(0, Math.min(9999999, Math.floor(Number(n)))) : 0;
// What the server sent, made safe: counts, shares out of 100 that sum to 100, and the caller's own ruling.
export function readTally(raw, week, caseId) {
  if (!raw || raw.week !== week || raw.case !== caseId) return null;
  const counts = { plaintiff: whole(raw.plaintiff), defendant: whole(raw.defendant), both: whole(raw.both) };
  const total = counts.plaintiff + counts.defendant + counts.both;
  const share = { plaintiff: 0, defendant: 0, both: 0 };
  if (total) {
    share.plaintiff = Math.round(counts.plaintiff * 100 / total);
    share.defendant = Math.round(counts.defendant * 100 / total);
    share.both = Math.max(0, 100 - share.plaintiff - share.defendant);
  }
  return { week, caseId, counts, total, share, mine: ['plaintiff', 'defendant', 'both'].includes(raw.mine) ? raw.mine : '' };
}

// One line for the paper. Names are the two sides as the case calls them.
export function tallyLine(tally, { plaintiff = 'the plaintiff', defendant = 'the defendant' } = {}) {
  if (!tally?.total) return 'Nobody has ruled yet. The bench is cold.';
  const { share, total } = tally, households = total === 1 ? '1 household' : total + ' households';
  const top = Math.max(share.plaintiff, share.defendant, share.both);
  const leaders = ['plaintiff', 'defendant', 'both'].filter(key => share[key] === top);
  const lead = leaders.length > 1 ? 'The neighbourhood is split down the middle'
    : leaders[0] === 'both' ? top + '% declared them both idiots' : top + '% found for ' + (leaders[0] === 'plaintiff' ? plaintiff : defendant);
  return lead + '. ' + households + ' ruled.';
}
