import { COURT_CASES } from '../content/court.js';
import { BENCH_RANKS } from '../content/court-career.js';
import { careerStars, rankIndexFor } from './court-career.js';
import { versionTotals } from './court-twists.js';

/* Shelf Court's own incidents: the bench career, runs of three-star episodes
   and the twists. They sit in their own file so engine/achievements.js needs
   only a spread to carry them. All of them read the courtroom record, and none
   can be earned by a shelf that has never been to court. */
const court = state => state.courtroom || {};
const rank = state => rankIndexFor(careerStars(court(state)));
const twists = state => versionTotals(court(state), COURT_CASES.map(k => k.id));

export const COURT_ACHIEVEMENTS = [
  { id: 'bench-5', hint: 'Climb to the fifth rank on the Shelf Court bench.', label: 'Unpaid, Officially', desc: 'Reached the fifth rank on the bench.', toastLine: 'You are a magistrate now. The title is real. The pay is the exposure.', check: state => rank(state) >= 4 },
  { id: 'bench-10', hint: 'Reach the top rank on the Shelf Court bench.', label: 'Lord Chief Gavel', desc: 'Reached the top of the bench.', toastLine: 'There is nothing above you now but the ceiling, and the ceiling has been consulted.', check: state => rank(state) >= BENCH_RANKS.length - 1 },
  { id: 'court-streak-3', hint: 'Earn three stars on three Shelf Court episodes in a row.', label: 'Hat Trick, Wig Trick', desc: 'Three flawless episodes running.', toastLine: 'Three perfect shows in a row. The ghosts have started leaving you notes. Nice ones.', check: state => (court(state).flawlessBest || 0) >= 3 },
  { id: 'court-streak-5', hint: 'Earn three stars on five Shelf Court episodes in a row.', label: 'Appointment Viewing', desc: 'Five flawless episodes running.', toastLine: 'Five in a row. Somewhere, a schedule is being rearranged around you.', check: state => (court(state).flawlessBest || 0) >= 5 },
  { id: 'twist-1', hint: 'Air a Shelf Court case in a version you have not seen. It happens.', label: 'Not Who You Thought', desc: 'Met a case that was not the case you remembered.', toastLine: 'The case you knew was a different case. The bailiff says he did try to tell you.', check: state => twists(state).twistsSeen >= 1 },
  { id: 'twist-12', hint: 'See twelve twisted versions of Shelf Court cases.', label: 'Unreliable Narrators', desc: 'Twelve twisted versions seen.', toastLine: 'Twelve times the truth was somewhere else. You are starting to check the lid.', check: state => twists(state).twistsSeen >= 12 },
  { id: 'twist-all', hint: 'See every twisted version of every Shelf Court case.', label: 'Case Closed, Properly', desc: 'Every twisted version seen.', toastLine: 'Every version of every case. The Case Notebook is full. The judge has asked to borrow it.', check: state => twists(state).twists > 0 && twists(state).twistsSeen >= twists(state).twists }
];

export const COURT_INCIDENT_PROGRESS = {
  'bench-5': state => ({ have: careerStars(court(state)), need: BENCH_RANKS[4].stars }),
  'bench-10': state => ({ have: careerStars(court(state)), need: BENCH_RANKS[BENCH_RANKS.length - 1].stars }),
  'court-streak-3': state => ({ have: court(state).flawlessBest || 0, need: 3 }),
  'court-streak-5': state => ({ have: court(state).flawlessBest || 0, need: 5 }),
  'twist-12': state => ({ have: twists(state).twistsSeen, need: 12 }),
  'twist-all': state => ({ have: twists(state).twistsSeen, need: Math.max(1, twists(state).twists) })
};
export const COURT_INCIDENT_GROUP = { id: 'bench', title: 'On the bench', ids: COURT_ACHIEVEMENTS.map(a => a.id) };
