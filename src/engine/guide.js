import { lifeState } from './life.js';
import { mayhemState } from '../mayhem-state.js';
import { addSouls, coffinCost } from './mayhem.js';

/* ================= THE FIRST-SESSION GUIDE =================
   Six steps, one real action each, that walk a brand new household through the
   whole loop in about ten minutes: meet your resident, feed them, clear the
   first emergency, flip the omen, read a note, open the first coffin. It is
   an additive step machine stored under life state (life.guide):

     null                 not a new household when the guide shipped, or no
                          resident yet. Nothing here ever writes to an
                          established save.
     { status: 'on' }     in progress. Resumable across reloads.
     { status: 'skipped'} the player skipped the tour. It can be resumed.
     { status: 'done' }   all six steps finished.

   A step is finished by the real action, never by a "Next" button. Most are
   read straight off the save (a care was logged, an emergency was resolved);
   two are things only the screen can see (the resident's card was opened, the
   note board was visited) and arrive through markGuideSeen(). Each step pays a
   small immediate reward, once. The order is only the order they are offered in:
   doing a later step early still counts. */

export const DAY_MS = 86400000;
// A household counts as "new" only for this long after its first resident moved in.
export const FRESH_WINDOW_MS = 6 * 3600000;

export const GUIDE_STEPS = [
  { id: 'meet', reward: 4, verb: 'Say hello', reaction: 'meet' },
  { id: 'feed', reward: 6, verb: 'Feed', reaction: 'food' },
  { id: 'emergency', reward: 6, verb: 'Deal with it', reaction: 'emergency' },
  { id: 'omen', reward: 6, verb: 'Turn it over', reaction: 'omen' },
  { id: 'note', reward: 6, verb: 'Read the notes', reaction: 'note' },
  { id: 'coffin', reward: 0, verb: 'Open it', reaction: 'coffin' }
];
const STEP_BY_ID = Object.fromEntries(GUIDE_STEPS.map(step => [step.id, step]));
export const GUIDE_TOTAL = GUIDE_STEPS.length;

// The words for a step. The line is the imperative; the hint is the joke and
// the reason. Both name the resident so the tour is about somebody.
export function guideCopy(id, name = 'your resident') {
  const who = String(name || 'your resident');
  return ({
    meet: { line: 'Say hello to ' + who + '.', hint: 'Tap ' + who + '. ' + who + ' wrote down the time you arrived and has not forgiven it.' },
    feed: { line: 'Feed ' + who + '.', hint: 'Tap Feed it. Whatever you serve, ' + who + ' will describe it in writing.' },
    emergency: { line: 'Deal with the emergency.', hint: 'Something on the shelf has gone wrong. Every choice pays souls. None of them is guaranteed to be wise.' },
    omen: { line: 'Turn over tonight’s omen.', hint: 'Once a night, free souls, from a card that has been watching you all day.' },
    note: { line: 'Read the note board.', hint: 'The residents write things down. Mostly complaints. Mostly about you.' },
    coffin: { line: 'Open your first coffin.', hint: 'Souls buy coffins. Coffins hold cursed curios. Nobody will say where the coffins come from.' }
  })[id] || { line: '', hint: '' };
}

/* ---------------- who gets a tour ---------------- */

// A household is new when nothing has happened in it yet: one or two residents
// who moved in within the last few hours, no discoveries, no emergencies solved,
// no souls ever earned, and the housewarming not yet settled. Anything else is
// an established household and counts as "already done".
export function householdIsFresh(state, now = Date.now()) {
  const pets = state?.pets || [];
  if (!pets.length || pets.length > 2) return false;
  const l = lifeState(state), m = mayhemState(state);
  if (l.introDone || l.xp > 0 || l.outings > 0) return false;
  if (m.lifetime > 0 || m.resolved > 0 || m.coffins > 0) return false;
  const oldest = Math.min(...pets.map(p => (Number.isFinite(p.born) ? p.born : now)));
  return now - oldest <= FRESH_WINDOW_MS;
}

export function guideOf(state) { return lifeState(state).guide || null; }

// Starts the tour for a new household, once. Returns the guide record, or null
// for an established one. Idempotent.
export function ensureGuide(state, now = Date.now()) {
  const l = lifeState(state);
  if (l.guide) return l.guide;
  if (!householdIsFresh(state, now)) return null;
  l.guide = { v: 1, status: 'on', at: now, seen: [], done: [], finishedAt: 0, celebrated: false };
  return l.guide;
}

export function guideActive(state) { return guideOf(state)?.status === 'on'; }

/* ---------------- progress ---------------- */

// Things only the screen can observe. 'meet' (the resident's card was opened)
// and 'note' (the note board was visited) count whenever the tour is on, even
// before they are the current step.
export function markGuideSeen(state, id) {
  const g = guideOf(state);
  if (!g || g.status !== 'on' || !['meet', 'note'].includes(id) || g.seen.includes(id)) return false;
  g.seen.push(id);
  return true;
}

const careTotal = state => (state.pets || []).reduce((n, p) => n + (p.careLog?.food || 0) + (p.careLog?.fuss || 0) + (p.careLog?.clean || 0), 0);
function stepDone(step, state, g) {
  const m = mayhemState(state), base = g.replay || null;
  switch (step.id) {
    case 'meet': return g.seen.includes('meet');
    case 'feed': return base ? careTotal(state) > base.care : (state.pets || []).some(p => (p.careLog?.food || 0) + (p.careLog?.fuss || 0) + (p.careLog?.clean || 0) > 0);
    case 'emergency': return m.resolved >= 1 + (base ? base.resolved : 0);
    case 'omen': return m.omen.streak >= 1 && m.omen.lastDay !== '' && (!base || m.omen.lastDay !== base.omen);
    case 'note': return g.seen.includes('note');
    case 'coffin': return m.coffins >= 1 + (base ? base.coffins : 0);
    default: return false;
  }
}

// Notices finished steps and pays each one's reward, once. Returns null when
// nothing changed, otherwise { steps: [{ id, souls }], finished }.
export function advanceGuide(state, now = Date.now()) {
  const g = guideOf(state);
  if (!g || g.status !== 'on') return null;
  const steps = [];
  for (const step of GUIDE_STEPS) {
    if (g.done.includes(step.id) || !stepDone(step, state, g)) continue;
    g.done.push(step.id);
    if (step.reward) addSouls(state, step.reward);
    steps.push({ id: step.id, souls: step.reward });
  }
  let finished = false;
  if (GUIDE_STEPS.every(step => g.done.includes(step.id))) { g.status = 'done'; g.finishedAt = now; finished = true; }
  return steps.length ? { steps, finished } : null;
}

export function skipGuide(state) {
  const g = guideOf(state);
  if (!g || g.status !== 'on') return false;
  g.status = 'skipped';
  return true;
}
// The tester panel's "Replay the first-day tour" (src/ui/tester-panel.js): the
// same six steps from the start for any household, counting only what happens
// from now on. Its rewards are paid again, which is why the panel marks the
// save as a tester save first. The desk stays as it was.
export function replayGuide(state, now = Date.now()) {
  if (!(state.pets || []).length) return null;
  const m = mayhemState(state);
  lifeState(state).guide = { v: 1, status: 'on', at: now, seen: [], done: [], finishedAt: 0, celebrated: false,
    replay: { care: careTotal(state), resolved: m.resolved, coffins: m.coffins, omen: m.omen.lastDay || '' } };
  return lifeState(state).guide;
}
export function resumeGuide(state) {
  const g = guideOf(state);
  if (!g || g.status !== 'skipped') return false;
  g.status = 'on';
  return true;
}
export function celebrateGuide(state) {
  const g = guideOf(state);
  if (!g || g.status !== 'done' || g.celebrated) return false;
  g.celebrated = true;
  return true;
}

// What the screen needs: the current step, how far along, and the copy.
export function guideView(state) {
  const g = guideOf(state);
  if (!g) return null;
  const pet = (state.pets || [])[0] || null;
  const done = GUIDE_STEPS.filter(step => g.done.includes(step.id)).map(step => step.id);
  const current = g.status === 'on' ? GUIDE_STEPS.find(step => !g.done.includes(step.id)) || null : null;
  return {
    status: g.status, total: GUIDE_TOTAL, done, count: done.length,
    step: current ? { ...current, index: GUIDE_STEPS.indexOf(current), number: GUIDE_STEPS.indexOf(current) + 1, petId: pet?.id || '', petName: pet?.name || '', ...guideCopy(current.id, pet?.name) } : null
  };
}

/* ---------------- staging the desk over the first days ---------------- */

const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
// Calendar days since the tour began: day 1 is the day the first resident moved in.
export function guideDay(g, now = Date.now()) {
  if (!g || !Number.isFinite(g.at) || g.at <= 0) return 1;
  return Math.max(1, Math.round((startOfDay(now) - startOfDay(g.at)) / DAY_MS) + 1);
}

// 3 for everyone who is not a brand new household. For a new one: 1 on the first
// day, 2 once it is a later day AND the first emergency was solved (or the tour
// finished), 3 once it is the third day AND the tour is finished or a coffin
// opened. Milestones plus the calendar, never the calendar alone.
export function deskStage(state, now = Date.now()) {
  const g = guideOf(state);
  if (!g) return householdIsFresh(state, now) ? 1 : 3;
  if (g.status === 'skipped' || g.replay) return 3;
  const m = mayhemState(state), day = guideDay(g, now);
  const learned = g.status === 'done' || m.resolved >= 1;
  if (day >= 3 && learned && (g.status === 'done' || m.coffins >= 1)) return 3;
  if (day >= 2 && learned) return 2;
  return 1;
}

// Which desk pieces to draw. Established households see all of them.
export function deskReveal(state, now = Date.now()) {
  const stage = deskStage(state, now), m = mayhemState(state), g = guideOf(state);
  const atCoffinStep = g?.status === 'on' && guideView(state)?.step?.id === 'coffin';
  return {
    stage,
    omen: stage >= 2,
    chores: stage >= 2,
    // The coffin is where souls go. It appears as soon as there is something to spend,
    // and always once the player has opened one.
    coffin: stage >= 2 || m.coffins > 0 || m.souls >= coffinCost(state, now) || atCoffinStep,
    today: stage >= 3,
    cabinet: stage >= 3,
    season: stage >= 3,
    // A line about what the next day brings, shown while the desk is still sparse.
    teaser: stage < 3 ? (stage === 1 ? 'More turns up on this desk as you settle in: the daily chores, tonight’s omen and the Cabinet.' : 'Still to come on this desk: the Playroom board and the Cabinet.') : ''
  };
}
