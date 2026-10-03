import { blankState, localDayKey } from '../../src/state.js';
import { accrueMayhem, resolveEmergency, openCoffin, drawOmen, coffinCost, ensureChores } from '../../src/engine/mayhem.js';
import { careFor, doRounds } from '../../src/engine/care.js';
import { castEpisode, episodeRule, courtFinish, docketToday } from '../../src/engine/court.js';
import { finishRun, seededRandom } from '../../src/engine/arcade.js';
import { dailyChallenge } from '../../src/engine/daily.js';
import {
  syncAlmanac, chapterAt, chapterView, claimReady, claimWeekly, claimChest, weeklyView, backIssues, buyBackIssue, readyCount
} from '../../src/engine/almanac.js';
import { checkReturn, claimReturn } from '../../src/engine/returns.js';
import { claimSet, claimableSets, exchangeCatalog, buyFrame, buyDecor, buyPortraitFrame, placeCommission, allSets } from '../../src/engine/collections.js';
import { legacyInfo } from '../../src/engine/legacy.js';
import { claimables } from '../../src/engine/claimables.js';
import { checkAchievements, ACHIEVEMENTS } from '../../src/engine/achievements.js';
import { COURT_CASES } from '../../src/content/court.js';

/* A scripted player, run against the real engines on a fake clock. It plays the
   game the way the screens do (the same functions, in the same order) and keeps a
   ledger of every soul that came from the long-term systems, so a test can show
   that content and goals last, and that no faucet is uncapped.

   Personas:
     daily      three short sessions a day: omen, emergencies, care, a coffin or two, the
                challenge, the docket, rounds. Claims what is ready each evening.
     diligent   the same, with an expedition and a spotlight case, and spends on the Exchange.
     farmer     does everything it can, over and over, all day, to find a faucet with no cap.
     lapsed     plays ten days, vanishes for a month, comes back.
*/
export const DAY = 86400000;
export const START = new Date(2026, 9, 3, 9, 0).getTime();       // 3 October 2026, the day this was written

export function household(count = 4, when = START) {
  const s = blankState();
  s.started = when - 3 * DAY; s.lastTick = when;
  const names = ['Agnes', 'Pip', 'Oswald', 'Gnasher'];
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 's' + i, name: names[i % 4], traits: [], needs: { food: 20, fuss: 20, clean: 20 }, bond: 3, cared: 0, grudges: 0, born: when - 3 * DAY, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  s.life.introDone = true;
  return s;
}

export function newLedger() {
  return { track: 0, weekly: 0, chest: 0, returns: 0, spotlight: 0, settled: 0, sets: 0, backIssues: 0, spent: 0, xpPaid: 0, claims: 0 };
}

function session(s, ledger, now, rnd, plan) {
  // What the render does on every redraw.
  const sync = at => { const events = syncAlmanac(s, at); for (const e of events) { if (e.type === 'spotlight') ledger.spotlight += e.souls; if (e.type === 'settled') ledger.settled += e.souls; } checkReturn(s, at); checkAchievements(s, at); };
  sync(now);
  accrueMayhem(s, now, rnd);
  if (plan.omen) drawOmen(s, now, rnd);
  ensureChores(s, now, rnd);
  for (let i = 0; i < plan.emergencies; i++) {
    const entry = s.mayhem.queue[0];
    if (!entry) break;
    resolveEmergency(s, entry.uid, Math.floor(rnd() * 2), now, rnd);
  }
  for (let i = 0; i < plan.care; i++) {
    const pet = s.pets[i % s.pets.length], need = ['food', 'fuss', 'clean'][i % 3];
    pet.needs[need] = 20;
    careFor(s, pet, need, now + i * 1000);
  }
  for (let i = 0; i < plan.coffins && s.mayhem.souls >= coffinCost(s, now) + plan.reserve; i++) openCoffin(s, now, rnd);
  if (plan.rounds) doRounds(s, now);
  if (plan.challenge) {
    const c = dailyChallenge(localDayKey(now));
    for (let i = 0; i < plan.arcadeRuns; i++) finishRun(s, c.game, 18 + i, s.pets[0].id, now + i * 61000, rnd, { daily: i === 0 });
  }
  if (plan.docket) {
    const id = plan.spotlight || docketToday(s, now).caseId;
    const ep = castEpisode(s, { caseId: id, plaintiffId: s.pets[0].id, defendantId: s.pets[1].id }, seededRandom(Math.floor(now / 1000)));
    episodeRule(ep, 'plaintiff', seededRandom(7));
    courtFinish(s, ep, now);
    for (let i = 1; i < plan.extraEpisodes; i++) {
      const e2 = castEpisode(s, { caseId: COURT_CASES[(i * 3) % COURT_CASES.length].id, plaintiffId: s.pets[1].id, defendantId: s.pets[0].id }, seededRandom(i));
      episodeRule(e2, 'both', seededRandom(i + 1)); courtFinish(s, e2, now + i * 1000);
    }
  }
  for (let i = 0; i < plan.expeditions; i++) s.life.outings = (s.life.outings || 0) + 1;     // the outing itself is its own tested system
  sync(now + 60000);
}

// The evening: take everything that is waiting, the way the screens let you.
function evening(s, ledger, now, plan) {
  if (plan.claim) {
    const r = claimReady(s, now);
    for (const x of r) { ledger.track += x.souls; ledger.claims++; }
    const w = weeklyView(s, now);
    for (const c of w.items) if (c.done && !c.claimed) { const x = claimWeekly(s, c.id, now); if (x) { ledger.weekly += x.souls; ledger.claims++; } }
    const chest = claimChest(s, now, Math.random);
    if (chest) { ledger.chest += chest.souls; ledger.claims++; }
    for (const p of claimableSets(s)) { const x = claimSet(s, p.set.id); if (x) { ledger.sets += x.souls; ledger.claims++; } }
    const back = claimReturn(s, now);
    if (back) { ledger.returns += back.souls; ledger.claims++; }
  }
  if (plan.spend) spend(s, ledger, now, plan.spend);
}

// A collector with spare souls: Back Issues first, then the Exchange, cheapest first.
function spend(s, ledger, now, reserve) {
  for (let guard = 0; guard < 40; guard++) {
    const before = s.mayhem.souls;
    const issues = backIssues(s, now);
    const pick = [...issues.curios, ...issues.decor].sort((a, b) => a.cost - b.cost).find(i => s.mayhem.souls - i.cost >= reserve);
    if (pick) { buyBackIssue(s, pick.id, now); ledger.backIssues += before - s.mayhem.souls; ledger.spent += before - s.mayhem.souls; continue; }
    const cat = exchangeCatalog(s);
    const want = [
      ...cat.frames.filter(f => !f.owned && !f.locked && f.cost).map(f => ['frame', f]),
      ...cat.portraits.filter(f => !f.owned && f.cost).map(f => ['portrait', f]),
      ...cat.decor.filter(f => !f.owned && f.cost).map(f => ['decor', f]),
      ...cat.commissions.filter(f => !f.owned).map(f => ['commission', f])
    ].sort((a, b) => a[1].cost - b[1].cost).find(([, i]) => s.mayhem.souls - i.cost >= reserve);
    if (!want) break;
    const [kind, item] = want;
    if (kind === 'frame') buyFrame(s, item.id); else if (kind === 'portrait') buyPortraitFrame(s, item.id);
    else if (kind === 'decor') buyDecor(s, item.key); else placeCommission(s, item.id, now);
    ledger.spent += before - s.mayhem.souls;
    if (before === s.mayhem.souls) break;
  }
}

export const PLANS = {
  daily: { omen: true, emergencies: 3, care: 6, coffins: 1, reserve: 60, rounds: true, challenge: true, arcadeRuns: 2, docket: true, extraEpisodes: 1, expeditions: 0, claim: true, spend: 0 },
  diligent: { omen: true, emergencies: 3, care: 9, coffins: 2, reserve: 100, rounds: true, challenge: true, arcadeRuns: 3, docket: true, extraEpisodes: 2, expeditions: 1, claim: true, spend: 800 },
  casual: { omen: true, emergencies: 3, care: 3, coffins: 0, reserve: 0, rounds: true, challenge: false, arcadeRuns: 0, docket: false, extraEpisodes: 0, expeditions: 0, claim: true, spend: 0, sessions: 1 },
  farmer: { omen: true, emergencies: 3, care: 60, coffins: 40, reserve: 0, rounds: true, challenge: true, arcadeRuns: 40, docket: true, extraEpisodes: 12, expeditions: 12, claim: true, spend: 0 }
};

/* Run `days` days. Returns a ledger and one record per day:
   { day, chapter, tier, xpToday, soulsEarned, newFaucet, goals, claimables } */
export function runPlayer({ persona = 'daily', days = 120, seed = 1, awayFrom = null, awayDays = 0 } = {}) {
  const s = household(), ledger = newLedger(), rows = [];
  const plan = { ...PLANS[persona === 'lapsed' ? 'daily' : persona] };
  let rnd = seededRandom(seed);
  syncAlmanac(s, START - 1000);
  const spotlightDone = new Set();
  for (let d = 0; d < days; d++) {
    const now = START + d * DAY;
    if (awayFrom !== null && d >= awayFrom && d < awayFrom + awayDays) continue;
    const lifetime0 = s.mayhem.lifetime, ledger0 = { ...ledger };
    const chapter = chapterAt(now);
    const spot = chapter && !spotlightDone.has(chapter.key) && persona !== 'daily' ? chapter.spotlight[0] : null;
    if (spot) spotlightDone.add(chapter.key);
    session(s, ledger, now, rnd, { ...plan, spotlight: spot });
    if ((plan.sessions || 2) > 1) session(s, ledger, now + 4 * 3600000, rnd, { ...plan, omen: false, rounds: false, challenge: false, docket: false, extraEpisodes: 0, expeditions: 0, care: Math.ceil(plan.care / 2), coffins: 0 });
    evening(s, ledger, now + 11 * 3600000, plan);
    const view = chapterView(s, now + 11 * 3600000);
    const earned = s.mayhem.lifetime - lifetime0;
    const newFaucet = ['track', 'weekly', 'chest', 'returns', 'spotlight', 'settled', 'sets'].reduce((n, k) => n + ledger[k] - ledger0[k], 0);
    const goals = goalsOf(s, now + 11 * 3600000);
    rows.push({ day: d, chapter: chapter ? chapter.key : null, tier: view.tier || 0, xpToday: s.almanac.xp, soulsEarned: earned, newFaucet, goals, claimables: claimables(s, now + 11 * 3600000).length, souls: s.mayhem.souls, lifetime: s.mayhem.lifetime });
  }
  return { state: s, ledger, rows };
}

/* Things the player can still be working toward, by kind. Content has run out
   only if this is ever empty. */
export function goalsOf(s, now) {
  const goals = [];
  const view = chapterView(s, now);
  if (view.chapter && (view.next || view.ready.length)) goals.push('track');
  const w = weeklyView(s, now);
  if (w.items.some(c => !c.claimed) || !w.chest.claimed) goals.push('weekly');
  if (allSets(s).some(p => !p.claimed)) goals.push('sets');
  const cat = exchangeCatalog(s);
  if ([...cat.frames, ...cat.portraits, ...cat.decor, ...cat.commissions].some(i => !i.owned && !i.locked)) goals.push('exchange');
  if (backIssues(s, now).curios.length || backIssues(s, now).decor.length) goals.push('backissues');
  if (legacyInfo(s).next) goals.push('legacy');
  if (checkAchievementsLeft(s)) goals.push('incidents');
  if (readyCount(s, now)) goals.push('ready');
  return goals;
}
function checkAchievementsLeft(s) { return ACHIEVEMENTS.some(a => !s.achievements.includes(a.id)); }
