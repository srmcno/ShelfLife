import { chapterAt, daysLeft, readyCount, tierFor, weeklyView, backIssues, chapterRecord } from './almanac.js';
import { pendingReturn } from './returns.js';
import { claimableSets, exchangeCatalog } from './collections.js';
import { unseenNotices } from './streaks.js';
import { tokenBalance } from './legacy.js';
import { TIERS } from '../content/almanac.js';
import { mayhemState } from '../mayhem-state.js';

/* ================= EVERYTHING CLAIMABLE OR TIMELY =================
   One list of what is waiting for the player, so a "what next?" prompt (the
   onboarding engineer’s nextStep) and the Today desk can both say so without
   knowing how the Almanac, the return chest or the collections work.

   claimables(state, now) returns an array of

     { id, label, hint, tab, priority }

   id        a stable string, one per kind of thing: 'return-chest', 'almanac-tier',
             'weekly-claim', 'weekly-chest', 'set-complete', 'freeze-earned',
             'backissue-bargain', 'chapter-ends', 'legacy-token'
   label     a short sentence for a button or a row, already in the game’s voice
   hint      one line that says what is in it
   tab       where to take the player: 'shelf' | 'plots' | 'notes' for the room, or
             'almanac' | 'collections' | 'exchange' for the sheet that holds it
             (window event 'shelflife:almanac' with detail { view } opens them)
   priority  a number; higher is more urgent. The list is returned highest first,
             so the first entry is the one to suggest.

   Pure: it reads the state and the clock and changes nothing. */
export const CLAIMABLE_SHAPE = ['id', 'label', 'hint', 'tab', 'priority'];
export const CLAIMABLE_TABS = ['shelf', 'plots', 'notes', 'almanac', 'collections', 'exchange'];

const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);

export function claimables(state, now = Date.now()) {
  const out = [], push = (id, label, hint, tab, priority) => out.push({ id, label, hint, tab, priority });
  if (!(state?.pets || []).length) return out;

  const back = pendingReturn(state);
  if (back) push('return-chest', 'A chest is waiting by the door', back.souls + ' souls and ' + back.xp + ' Almanac XP for coming back.', 'shelf', 95);

  const chapter = chapterAt(now);
  const ready = readyCount(state, now);
  if (chapter && ready) push('almanac-tier', plural(ready, 'Almanac reward') + ' ready', chapter.name + ': claim ' + (ready === 1 ? 'it' : 'them') + ' before the month turns.', 'almanac', 80);

  const week = weeklyView(state, now);
  if (week.chest.ready) push('weekly-chest', 'The weekly chest is ready', 'Three challenges done. It opens this week or not at all, and it would like to open.', 'almanac', 75);
  const unclaimed = week.items.filter(c => c.done && !c.claimed).length;
  if (unclaimed) push('weekly-claim', plural(unclaimed, 'weekly challenge') + ' done', 'Souls and Almanac XP are waiting to be collected.', 'almanac', 70);

  const sets = claimableSets(state);
  if (sets.length) push('set-complete', sets.length === 1 ? 'A collection is complete' : plural(sets.length, 'collection') + ' complete', sets[0].set.name + ' has all its pieces. Take the prize.', 'collections', 65);

  if (chapter) {
    const left = daysLeft(chapter, now), tier = tierFor(chapterRecord(state, chapter).xp, chapter.days);
    if (left <= 3 && tier < TIERS) push('chapter-ends', chapter.name + (left <= 1 ? ' ends today' : ' ends in ' + left + ' days'), (TIERS - tier) + ' tiers to go. The limited curios do not wait, though they can be bought back later.', 'almanac', left <= 1 ? 85 : 55);
  }

  if (unseenNotices(state).some(n => n.type === 'earned')) push('freeze-earned', 'You earned a streak freeze', 'It will cover one missed day, without being asked.', 'almanac', 40);

  const issues = backIssues(state, now);
  if (issues.bargain && mayhemState(state).souls >= issues.bargain.cost) {
    push('backissue-bargain', 'A Back Issues bargain', issues.bargain.name + ' is marked down this week, to ' + issues.bargain.cost + ' souls.', 'exchange', 30);
  }

  const tokens = tokenBalance(state);
  if (tokens >= 1) {
    const cat = exchangeCatalog(state);
    const spendable = [...cat.frames, ...cat.portraits, ...cat.decor].some(i => i.tokens && !i.owned && !i.locked && i.tokens <= tokens);
    if (spendable) push('legacy-token', plural(tokens, 'Legacy Token') + ' to spend', 'The Collector’s Exchange has something with your name on the price.', 'exchange', 35);
  }
  return out.sort((x, y) => y.priority - x.priority);
}
