import { mayhemState } from '../mayhem-state.js';
import { describeEmergency, coffinCost, omenPending, choreInfo, nextEmergencyIn, CHORE_SOULS } from './mayhem.js';
import { COURT_BY_ID, docketToday, DOCKET_SOULS } from './court.js';
import { challengeToday } from './arcade.js';
import { ARCADE_BY_ID } from '../content/arcade.js';
import { DAILY_SOULS } from '../content/daily.js';
import { welcomeView } from './welcome.js';
import { escapadeView } from './escapades.js';
import { roundsWait } from './care.js';
import { checkWait } from './loop.js';
import { worstNeed, isAsleep } from './tick.js';
import { guideOf, guideView } from './guide.js';
import { lifeState } from './life.js';
import { localDayKey } from '../state.js';

/* ================= ONE "DO THIS NEXT" =================
   The shelf used to ask for attention in four places at once: the omen strip,
   the emergency strip, the brief card and a desk of tiles. This is the one
   recommender behind the single card that replaces the brief. Pure: it reads
   the save and the clock and returns what to do, never touches the screen and
   never changes the save.

   Order, most urgent first:
     the next step of the first-session guide
     a pending emergency
     an affordable coffin
     a chore that is one action from done
     a resident who is properly in need
     tonight's omen, face down
     the housewarming, an adventure, a household recap
     today's Shelf Court docket
     today's arcade challenge
     anything passed in (the retention module supplies these)
     a little time together, when there is nothing else

   A step has the shape
     { id, kind, label, hint, verb, tab, priority, action }
   `priority` is a number, higher first. `action` says what a tap does:
     { type: 'guide', step }            the screen decides (it knows the buttons)
     { type: 'mh', mh }                 open the emergency / omen / coffin / quiet sheet
     { type: 'care', petId }            open a resident's card
     { type: 'click', selector }        press a button that already exists
     { type: 'goto', tab, target }      go to a tab, optionally to a card inside it
     { type: 'event', name, detail }    fire a window event the owning module hears
     { type: 'dom', attrs }             press a button carrying these data attributes

   Extras are how another module adds its own recommendation:
     { id, label, hint, tab, priority }   (plus optional verb, target, event) */

export const PRIORITY = {
  guide: 1000, emergency: 900, coffin: 800, chore: 700, need: 650, omen: 600,
  welcome: 550, adventure: 500, recap: 480, docket: 400, challenge: 300, extra: 200, play: 100
};
// Past this many coffins' worth of souls the player is probably saving for a special order.
const SAVING_FOR_ORDERS = 3;
const NEEDY_BELOW = 40;
const TABS = ['shelf', 'plots', 'notes', 'play'];

const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const clock = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const NEED_WORD = { food: 'hungry', fuss: 'lonely', clean: 'grubby' };
const CARE_VERB = { 'care:food': 'Feed', 'care:fuss': 'Fuss', 'care:clean': 'Wash' };

// A recommendation from another module, made safe. Anything malformed is dropped.
export function normalizeExtra(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && /^[a-zA-Z0-9:_-]{1,60}$/.test(raw.id) ? raw.id : '';
  const label = clip(raw.label, 80);
  if (!id || !label) return null;
  const tab = TABS.includes(raw.tab) ? raw.tab : 'shelf';
  const priority = Number.isFinite(raw.priority) ? Math.max(0, Math.min(2000, raw.priority)) : PRIORITY.extra;
  const step = { id: 'extra:' + id, kind: 'extra', label, hint: clip(raw.hint, 160), verb: clip(raw.verb, 24) || 'Go', tab, priority, action: { type: 'goto', tab } };
  if (typeof raw.target === 'string' && raw.target.length <= 80) step.action.target = raw.target;
  if (typeof raw.event === 'string' && /^shelflife:[a-z-]{1,30}$/.test(raw.event)) step.action = { type: 'event', name: raw.event, detail: raw.detail && typeof raw.detail === 'object' ? raw.detail : {} };
  return step;
}

function guideCandidate(state, now) {
  const g = guideOf(state);
  if (!g || g.status !== 'on') return null;
  const view = guideView(state), step = view?.step;
  if (!step) return null;
  const m = mayhemState(state), cost = coffinCost(state, now);
  const c = { id: 'guide:' + step.id, kind: 'guide', label: step.line, hint: step.hint, verb: step.verb, tab: 'shelf', priority: PRIORITY.guide,
    action: { type: 'guide', step: step.id }, guide: { number: step.number, total: view.total, count: view.count, step: step.id, petId: step.petId } };
  // The coffin step can be reached with too few souls (the player poked the drawer). Say what to do about it.
  if (step.id === 'coffin' && m.souls < cost) {
    c.hint = 'It costs ' + cost + ' souls and you have ' + m.souls + '. Deal with an emergency and come back.';
    c.verb = m.queue.length ? 'Deal with it' : 'See the drawer';
    c.action = { type: 'mh', mh: m.queue.length ? 'emergency' : 'quiet' };
  }
  if (step.id === 'emergency' && !m.queue.some(q => describeEmergency(state, q))) {
    c.hint = 'Nothing has gone wrong yet. The next disaster is due in ' + clock(nextEmergencyIn(state, now)) + '.';
    c.verb = 'See the drawer';
    c.action = { type: 'mh', mh: 'quiet' };
  }
  return c;
}

function emergencyCandidate(state) {
  const m = mayhemState(state);
  const first = m.queue.map(entry => describeEmergency(state, entry)).find(Boolean);
  if (!first) return null;
  const n = m.queue.length;
  return { id: 'emergency', kind: 'emergency', label: n > 1 ? plural(n, 'thing has', 'things have') + ' gone wrong.' : 'Something has gone wrong.', hint: first.title,
    verb: 'Deal with it', tab: 'shelf', priority: PRIORITY.emergency, action: { type: 'mh', mh: 'emergency' }, count: n };
}

function coffinCandidate(state, now) {
  const m = mayhemState(state), cost = coffinCost(state, now);
  if (m.souls < cost) return null;
  const saving = m.souls >= cost * SAVING_FOR_ORDERS;
  return { id: 'coffin', kind: 'coffin', label: 'You can afford a coffin.', hint: cost + ' souls. Something inside is knocking.', verb: 'Open it', tab: 'shelf',
    priority: saving ? PRIORITY.challenge - 50 : PRIORITY.coffin, action: { type: 'mh', mh: 'coffin' } };
}

// A chore with exactly one action left, and a way to do that action right now.
function choreCandidate(state, now) {
  const m = mayhemState(state);
  if (m.chores.day !== localDayKey(now)) return null;
  for (const entry of m.chores.list) {
    if (entry.done) continue;
    const chore = choreInfo(entry);
    if (!chore || chore.need - chore.have !== 1) continue;
    const base = { id: 'chore:' + chore.id, kind: 'chore', label: chore.label + '.', hint: chore.line + ' · +' + CHORE_SOULS + ' souls', tab: 'shelf', priority: PRIORITY.chore };
    if (chore.deed === 'rounds' && state.pets.length && !roundsWait(state, now)) return { ...base, verb: 'Do the rounds', action: { type: 'click', selector: '#roundsBtn' } };
    if (chore.deed === 'check' && state.pets.length && !checkWait(state, now)) return { ...base, verb: 'Check the shelf', action: { type: 'click', selector: '#checkBtn' } };
    if (chore.deed.startsWith('care:')) {
      const need = chore.deed.slice(5), pet = [...state.pets].filter(p => p.needs[need] < 99).sort((a, b) => a.needs[need] - b.needs[need])[0];
      if (pet) return { ...base, verb: CARE_VERB[chore.deed] + ' ' + pet.name, action: { type: 'care', petId: pet.id } };
    }
    if (chore.deed === 'care') {
      const pet = [...state.pets].sort((a, b) => a.needs[worstNeed(a)] - b.needs[worstNeed(b)])[0];
      if (pet && pet.needs[worstNeed(pet)] < 99) return { ...base, verb: 'Care for ' + pet.name, action: { type: 'care', petId: pet.id } };
    }
    if (chore.deed === 'game' && state.pets.length) return { ...base, verb: 'Play', action: { type: 'click', selector: '#playroomBtn' } };
  }
  return null;
}

function needCandidate(state) {
  const sore = [...state.pets].filter(p => p.needs[worstNeed(p)] < NEEDY_BELOW).sort((a, b) => a.needs[worstNeed(a)] - b.needs[worstNeed(b)])[0];
  if (!sore) return null;
  return { id: 'need:' + sore.id, kind: 'need', label: sore.name + ' is ' + NEED_WORD[worstNeed(sore)] + '.', hint: 'Tap to help. Care builds a bond, and a bond turns disasters aside.',
    verb: 'Help', tab: 'shelf', priority: PRIORITY.need, action: { type: 'care', petId: sore.id } };
}

function omenCandidate(state, now) {
  if (!omenPending(state, now)) return null;
  return { id: 'omen', kind: 'omen', label: 'Tonight’s omen is face down.', hint: 'Turn it over for free souls. The house has been waiting all day.', verb: 'Reveal', tab: 'shelf',
    priority: PRIORITY.omen, action: { type: 'mh', mh: 'omen' } };
}

function storyCandidates(state, now) {
  const out = [];
  const welcome = welcomeView(state, now);
  if (welcome && !lifeState(state).welcome?.dismissed && welcome.stage !== 'finished') {
    out.push({ id: 'welcome', kind: 'welcome', label: welcome.pet.name + ' has a housewarming invitation.', hint: 'Unpack a little bowl and make your first household memory.', verb: 'Come in',
      tab: 'plots', priority: PRIORITY.welcome, action: { type: 'goto', tab: 'plots', target: '#welcomePanel' } });
  }
  const adventure = escapadeView(state, now).active;
  if (adventure?.pet) {
    out.push({ id: 'adventure', kind: 'adventure', label: adventure.pet.name + ' saved you a place.',
      hint: adventure.ready ? 'The story is ready for its ending. You get to choose.' : 'Your place is saved. ' + adventure.completedSteps + ' of 2 moments shared.',
      verb: adventure.ready ? 'The ending' : 'Continue', tab: 'shelf', priority: PRIORITY.adventure, action: { type: 'event', name: 'shelflife:escapade', detail: {} } });
  }
  const l = lifeState(state);
  const latest = (l.recap || []).map(id => l.scenes.find(scene => scene.id === id)).filter(Boolean)[0];
  if (latest) {
    out.push({ id: 'recap', kind: 'recap', label: latest.title, hint: clip(latest.text, 150), verb: l.outing ? 'Continue' : 'See what happened', tab: 'shelf', priority: PRIORITY.recap,
      action: { type: 'dom', attrs: { 'data-life': l.outing ? 'outing' : 'scene-select', 'data-id': String(latest.id) } } });
  }
  return out;
}

function todayCandidates(state, now) {
  const out = [];
  const docket = docketToday(state, now), kase = COURT_BY_ID[docket.caseId];
  if (kase && !docket.done) out.push({ id: 'docket', kind: 'docket', label: 'Shelf Court has a case.', hint: kase.title + ' · +' + DOCKET_SOULS + ' souls', verb: 'Hear it', tab: 'play',
    priority: PRIORITY.docket, action: { type: 'event', name: 'shelflife:court', detail: {} } });
  const ch = challengeToday(state, now);
  if (ch && !ch.claimed) out.push({ id: 'challenge', kind: 'challenge', label: 'Today’s arcade challenge.', hint: ARCADE_BY_ID[ch.game].title + ': ' + ch.mod.title + ' · +' + DAILY_SOULS + ' souls', verb: 'Play it',
    tab: 'play', priority: PRIORITY.challenge, action: { type: 'event', name: 'shelflife:arcade', detail: { game: ch.game } } });
  return out;
}

function playCandidate(state, now) {
  const pet = state.pets.find(p => !isAsleep(p, new Date(now))) || state.pets[0];
  if (!pet) return null;
  return { id: 'play', kind: 'play', label: 'A little time together?', hint: 'Hold a séance with ' + pet.name + '. The dead are chatty tonight.', verb: 'Play', tab: 'play',
    priority: PRIORITY.play, action: { type: 'event', name: 'shelflife:arcade', detail: { petId: pet.id, game: 'seance' } } };
}

// Every recommendation that applies, most urgent first.
export function nextSteps(state, now = Date.now(), extra = []) {
  if (!state?.pets?.length) return [];
  const list = [guideCandidate(state, now), emergencyCandidate(state), coffinCandidate(state, now), choreCandidate(state, now), needCandidate(state), omenCandidate(state, now),
    ...storyCandidates(state, now), ...todayCandidates(state, now),
    ...(Array.isArray(extra) ? extra : []).map(normalizeExtra), playCandidate(state, now)].filter(Boolean);
  const seen = new Set();
  return list.filter(step => !seen.has(step.id) && seen.add(step.id)).map((step, order) => ({ step, order }))
    .sort((a, b) => b.step.priority - a.step.priority || a.order - b.order).map(item => item.step);
}

// The one thing to do next, or null when there is no resident to do it for.
export function nextStep(state, now = Date.now(), extra = []) {
  return nextSteps(state, now, extra)[0] || null;
}
