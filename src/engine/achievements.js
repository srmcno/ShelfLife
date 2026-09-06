import { remember } from './stories.js';
import { FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../content/feuds.js';
import { GRUDGE_LINES, STREAK_LINES } from '../content/copy.js';
import { MATURE_GRUDGE_EXTRA } from '../content/mature.js';
import { neighborPets, neighborSlots } from './tick.js';
import { totalBond } from './unlocks.js';
import { pick, addNote, clamp, petById, GRUDGE_LOG_MAX } from '../state.js';

// A resident files at most one grievance an hour, however many times the
// player checks the shelf in that hour. Explicit slights (refusing a request,
// being robbed) bypass the limit with { force: true }: those are earned.
export const GRUDGE_COOLDOWN_MS = 60 * 60 * 1000;
// A feud can escalate or settle once per half hour; the rest of the time the
// pair only trade the ongoing lines.
export const FEUD_STEP_MS = 30 * 60 * 1000;

export function fileGrudge(state, pet, why, now = Date.now(), opts = {}) {
  if (!state || !pet) return false;
  if (!opts.force && now - (pet.lastGrudgeAt || 0) < GRUDGE_COOLDOWN_MS) return false;
  pet.grudges = (pet.grudges || 0) + 1;
  // A forced slight is its own matter; it does not use up the hour's neglect.
  if (!opts.force) pet.lastGrudgeAt = now;
  if (!Array.isArray(pet.grudgeLog)) pet.grudgeLog = [];
  pet.grudgeLog.push({ why: String(why || 'unspecified').slice(0, 80), at: now });
  if (pet.grudgeLog.length > GRUDGE_LOG_MAX) pet.grudgeLog.splice(0, pet.grudgeLog.length - GRUDGE_LOG_MAX);
  checkGrudgeEscalation(state, pet);
  return true;
}

export function activeFeuds(state) {
  const found = [];
  state.slots.forEach((id, i) => {
    if (!id) return;
    const a = petById(state, id);
    if (!a) return;
    neighborPets(state, i).forEach(b => {
      if (b.id <= a.id || state.feudArcs?.[feudPairKey(a.id, b.id)]?.truce) return;
      for (const [x, y] of FEUDS) {
        if ((a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x))) {
          found.push([a, b]);
          return;
        }
      }
    });
  });
  return found;
}

export function feudingIds(state) {
  const s = new Set();
  activeFeuds(state).forEach(([a, b]) => { s.add(a.id); s.add(b.id); });
  return s;
}

export function feudPairKey(a, b) {
  return [a, b].sort().join('|');
}

// Every active feud gets exactly one note per call: an ongoing flavor line by
// default, a chance to escalate (deepening the arc), or — only once the arc
// has escalated at least twice — a rare chance to resolve into a truce.
export function stepFeudArc(state, pairKey, a, b, now = Date.now()) {
  const arc = state.feudArcs[pairKey] || (state.feudArcs[pairKey] = { level: 0, truce: false });
  if (arc.truce) return null;
  // Inside the cooldown the feud is only ever ongoing: one line, no dice.
  const settled = now - (arc.steppedAt || 0) < FEUD_STEP_MS;
  const roll = settled ? 1 : Math.random();
  if (!settled) arc.steppedAt = now;
  if (arc.level >= 2 && roll < 0.12) {
    arc.truce = true;
    remember(state, 'An uneasy peace', a.name + ' and ' + b.name + ' have agreed to stop. Neither has agreed to explain.', Date.now(), 'relationship');
    addNote(state, pick(TRUCE_LINES).replace(/\{a\}/g, a.name).replace(/\{b\}/g, b.name), 'observed', 'note');
    return 'truce';
  }
  if (roll < 0.35) {
    arc.level += 1;
    addNote(state, pick(ESCALATION_LINES).replace(/\{a\}/g, a.name).replace(/\{b\}/g, b.name), 'observed', 'feud');
    return 'escalate';
  }
  addNote(state, pick(FEUD_LINES).replace(/\{a\}/g, a.name).replace(/\{b\}/g, b.name), 'observed', 'feud');
  return 'ongoing';
}

export const GRUDGE_STAGE_AT = [5, 12, 20];

export function grudgeStageFor(grudges) {
  let stage = 0;
  GRUDGE_STAGE_AT.forEach((t, i) => { if (grudges >= t) stage = i + 1; });
  return stage;
}

// Called after pet.grudges increments. Fires the escalating "reckoning" the
// first time a new stage is crossed: a note, a bond hit, and — at stage 2 —
// the pet relocates itself to a random neighboring slot.
export function checkGrudgeEscalation(state, pet) {
  const newStage = grudgeStageFor(pet.grudges);
  if (newStage <= pet.grudgeStage) return false;
  pet.grudgeStage = newStage;
  remember(state, 'A thicker file', pet.name + ' has reached grievance stage ' + newStage + ' with ' + pet.grudges + ' complaints on record.', Date.now(), 'grudge');
  // Mature mode has to be mixed in HERE too, not just in engine/loop.js. It was
  // missed originally, so all 18 MATURE_GRUDGE_EXTRA lines were unreachable: the
  // mode quietly upgraded complaints, happy notes and events but left grudge
  // escalation — its darkest beat — tame. A test asserting the pool merely
  // exists kept the suite green and hid it.
  let lines = GRUDGE_LINES[newStage] || [];
  if (state.settings && state.settings.matureMode) {
    lines = lines.concat(MATURE_GRUDGE_EXTRA[newStage] || []);
  }
  if (!lines.length) return false;
  addNote(state, pick(lines).replace(/\{n\}/g, pet.name), pet.name, 'angry');
  if (newStage === 1) {
    pet.bond = clamp(pet.bond - 1, 0, 25);
  } else if (newStage === 2) {
    pet.bond = clamp(pet.bond - 2, 0, 25);
    const i = state.slots.indexOf(pet.id);
    if (i >= 0) {
      const nbrs = neighborSlots(i, state.slots.length).filter(x => state.slots[x]);
      if (nbrs.length) {
        const j = pick(nbrs);
        const tmp = state.slots[i]; state.slots[i] = state.slots[j]; state.slots[j] = tmp;
      }
    }
  } else if (newStage === 3) {
    pet.bond = clamp(pet.bond - 3, 0, 25);
  }
  return true;
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

export function checkinStreak(state, now = Date.now()) {
  const today = dayKey(now);
  if (!state.streak.lastCheckin) {
    state.streak.count = 1;
    state.streak.lastCheckin = now;
    return { streak: 1, isNewDay: true };
  }
  const last = dayKey(state.streak.lastCheckin);
  if (last === today) return { streak: state.streak.count, isNewDay: false };
  const yesterday = dayKey(now - 86400000);
  state.streak.count = (last === yesterday) ? state.streak.count + 1 : 1;
  state.streak.lastCheckin = now;
  addNote(state, pick(STREAK_LINES).replace(/\{d\}/g, String(state.streak.count)), 'the shelf', 'note');
  return { streak: state.streak.count, isNewDay: true };
}

// A closed case is written into the museum archive by engine/stories.js with
// kind 'case'. Read from there rather than keeping a second counter that could
// disagree with the exhibits the player can actually see.
function closedCases(state) {
  return (((state.stories || {}).archive) || []).filter(x => x && x.kind === 'case').length;
}

export const ACHIEVEMENTS = [
  { id: 'first-arrival', hint: 'Make a pet. Any pet. It will not be grateful.', label: 'Move-In Day', desc: 'Made your first pet.', toastLine: 'First one. There will be more.', check: state => state.pets.length >= 1 },
  { id: 'full-shelf', hint: 'Fill all eighteen slots. Nobody will thank you.', label: 'No Vacancy', desc: 'Filled every slot on the shelf.', toastLine: 'The shelf is full. So are your obligations.', check: state => state.slots.every(s => s !== null) },
  { id: 'first-feud', hint: 'Put two creatures who cannot stand each other side by side.', label: 'Drama', desc: 'Witnessed your first feud.', toastLine: 'Someone is not speaking to someone else. Achievement unlocked.', check: state => activeFeuds(state).length >= 1 },
  { id: 'first-grudge', hint: 'Let a need slide until somebody files something.', label: 'On The List', desc: 'A pet started keeping score.', toastLine: 'It is counting now. It will not stop.', check: state => state.pets.some(p => p.grudges >= 1) },
  { id: 'first-reckoning', hint: 'Let a grudge climb to five. Consequences follow.', label: 'The Reckoning', desc: 'A grudge finally escalated.', toastLine: 'That was a mistake. That was definitely a mistake.', check: state => state.pets.some(p => p.grudgeStage >= 1) },
  { id: 'terminal-grudge', hint: 'Twenty grievances from one creature. It has a folder.', label: 'It Has A Folder Now', desc: 'A grudge reached its final stage.', toastLine: 'This is no longer about the sock.', check: state => state.pets.some(p => p.grudgeStage >= 3) },
  { id: 'max-bond', hint: 'Earn twenty-five trust from a single resident.', label: 'Chosen', desc: 'A pet reached maximum bond.', toastLine: 'It has decided to keep you. Permanently, probably.', check: state => state.pets.some(p => p.bond >= 25) },
  { id: 'bond-10', hint: 'Ten trust across the shelf.', label: 'Trusted, Barely', desc: 'Reached 10 total bond.', toastLine: 'They trust you slightly more than the furniture.', check: state => totalBond(state) >= 10 },
  { id: 'bond-30', hint: 'Thirty trust across the shelf.', label: 'Household Name', desc: 'Reached 30 total bond.', toastLine: 'You are, against all odds, beloved.', check: state => totalBond(state) >= 30 },
  { id: 'bond-60', hint: 'Sixty trust across the shelf. Concerning, frankly.', label: 'Cult Leader', desc: 'Reached 60 total bond.', toastLine: 'This is either love or a hostage situation.', check: state => totalBond(state) >= 60 },
  { id: 'streak-3', hint: 'Check the shelf three days running.', label: 'Creature Of Habit', desc: 'Checked in three days running.', toastLine: 'Three days. They have noticed the pattern.', check: state => state.streak.count >= 3 },
  { id: 'streak-7', hint: 'Check the shelf seven days running.', label: 'They Expect You Now', desc: 'Checked in seven days running.', toastLine: 'A full week. This is a relationship now.', check: state => state.streak.count >= 7 },
  { id: 'first-truce', hint: 'Wait a feud out. Very occasionally, it ends.', label: 'Unlikely Peace', desc: 'A feud resolved into a truce.', toastLine: 'Nobody knows what changed. It is, somehow, fine now.', check: state => Object.values(state.feudArcs).some(a => a.truce) },
  { id: 'menagerie', hint: 'Ten residents at once.', label: 'A Real Collection', desc: 'Ten or more pets living on the shelf at once.', toastLine: 'This is either a menagerie or a liability.', check: state => state.pets.length >= 10 },
  { id: 'decorator', hint: 'Five pieces of furniture on the shelf.', label: 'Furnished', desc: 'Placed five or more things on the shelf.', toastLine: 'The shelf has a personality now. It is not yours.', check: state => state.props.length >= 5 },

  /* The record used to stop at trust, grudges and streaks, which meant the case
     files, the visitors, the games and the promises — most of what there is to
     actually do here — left no trace in the one place the game keeps score. */
  { id: 'first-case', hint: 'See a weekly case file through to its sixth beat.', label: 'Closed, Not Solved', desc: 'Finished a household mystery.', toastLine: 'The case is closed. Nobody is satisfied. That is a closed case.', check: state => closedCases(state) >= 1 },
  { id: 'three-cases', hint: 'Close three household mysteries.', label: 'A Pattern Of Incidents', desc: 'Closed three case files.', toastLine: 'Three files. At this point the shelf is a jurisdiction.', check: state => closedCases(state) >= 3 },
  { id: 'first-visitor', hint: 'Welcome a temporary visitor before it leaves.', label: 'Hospitality', desc: 'Welcomed a visitor and kept its keepsake.', toastLine: 'It stayed six hours and left something behind. Everyone does.', check: state => ((state.stories || {}).collection || []).length >= 1 },
  { id: 'all-visitors', hint: 'Collect every visiting curiosity for the museum.', label: 'The Complete Set', desc: 'Every visitor souvenir is in the museum.', toastLine: 'Every curiosity accounted for. You are collecting guests now.', check: state => ((state.stories || {}).collection || []).length >= 3 },
  { id: 'first-handshake', hint: 'Learn one resident’s secret handshake.', label: 'Initiated', desc: 'Completed a secret handshake.', toastLine: 'You know the handshake. There is no undoing that.', check: state => state.pets.some(p => (p.handshakes || 0) >= 1) },
  { id: 'handshake-veteran', hint: 'Learn the same resident’s handshake ten times.', label: 'Fluent', desc: 'Ten handshakes with one resident.', toastLine: 'Ten. It has started adding flourishes you did not agree to.', check: state => state.pets.some(p => (p.handshakes || 0) >= 10) },
  { id: 'chase-win', hint: 'Catch every crumb in one Crumb Chase.', label: 'Crumb Bailiff', desc: 'Won a Crumb Chase outright.', toastLine: 'Every crumb accounted for. The dust bunnies have taken note.', check: state => state.pets.some(p => (p.chaseBest || {}).stars >= 1) },
  { id: 'chase-perfect', hint: 'Take three stars in a single Crumb Chase.', label: 'Unreasonably Good At This', desc: 'A three-star chase.', toastLine: 'Three stars. It is four inches tall and it is showing off.', check: state => state.pets.some(p => (p.chaseBest || {}).stars >= 3) },
  { id: 'promise-kept', hint: 'Accept a resident’s request and actually do it.', label: 'Good For It', desc: 'Kept a promise to a resident.', toastLine: 'You said you would and then you did. They are recalibrating.', check: state => state.pets.some(p => (p.fulfilledRequests || 0) >= 1) },
  { id: 'promise-broken', hint: 'Refuse a resident to its face.', label: 'On The Record', desc: 'Declined a resident’s request.', toastLine: 'Declined. Filed. It was very understanding, which is worse.', check: state => state.pets.some(p => (p.refusedRequests || 0) >= 1) },
  { id: 'promises-five', hint: 'Keep five promises across the shelf.', label: 'Dependable, Apparently', desc: 'Five requests fulfilled.', toastLine: 'Five kept promises. Somebody has started a different kind of list.', check: state => state.pets.reduce((n, p) => n + (p.fulfilledRequests || 0), 0) >= 5 },
  { id: 'archivist', hint: 'Keep a postcard in the memory museum.', label: 'Archivist', desc: 'Filed a postcard in the museum.', toastLine: 'A picture of the shelf, kept on purpose. They noticed you noticing.', check: state => ((state.stories || {}).postcards || []).length >= 1 },
  { id: 'dreamt-of', hint: 'Catch a sleeping resident mid-dream on the board.', label: 'Unsaid', desc: 'Read a resident’s inner voice.', toastLine: 'You were not supposed to see that one. It is on the board anyway.', check: state => (state.notes || []).some(n => n.form === 'thought') },
  { id: 'full-house', hint: 'Eighteen residents and no furniture. Somehow.', label: 'Standing Room Only', desc: 'Eighteen residents at once.', toastLine: 'Eighteen. Every slot is a resident and none of them can leave.', check: state => state.pets.length >= 18 }
];

/* ================= HOW AN INCIDENT PLAYS OUT =================
   An unlocked incident used to be a line on the corkboard and a tick in a flat
   list of fifteen. Three things make it a record instead of a checklist:

     GROUPS    the log reads in chapters, so a player can see which parts of the
               shelf they have never touched — the surest sign of a system they
               did not know existed.
     PROGRESS  a locked entry that is counting something says how far along it is.
               "Not yet" tells you nothing; "3 of 5 promises kept" is a plan.
     THE FILE  every incident is also written into the Memory museum, dated, so
               the museum holds the shelf's whole history rather than only its
               cases and its visitors. */
export const INCIDENT_GROUPS = [
  { id: 'shelf', title: 'The shelf itself',
    ids: ['first-arrival', 'menagerie', 'full-shelf', 'full-house', 'decorator'] },
  { id: 'trust', title: 'Being trusted',
    ids: ['bond-10', 'bond-30', 'bond-60', 'max-bond', 'streak-3', 'streak-7'] },
  { id: 'grief', title: 'Being resented',
    ids: ['first-grudge', 'first-reckoning', 'terminal-grudge', 'first-feud', 'first-truce'] },
  { id: 'games', title: 'Playing along',
    ids: ['first-handshake', 'handshake-veteran', 'chase-win', 'chase-perfect'] },
  { id: 'word', title: 'Your word',
    ids: ['promise-kept', 'promises-five', 'promise-broken'] },
  { id: 'record', title: 'The long record',
    ids: ['first-case', 'three-cases', 'first-visitor', 'all-visitors', 'archivist', 'dreamt-of'] }
];

export function groupOf(id) {
  const found = INCIDENT_GROUPS.find(g => g.ids.includes(id));
  return found ? found.id : 'record';
}

// How far along a locked, countable incident is. Anything not listed here is a
// one-off that either has happened or has not.
export const INCIDENT_PROGRESS = {
  'menagerie': state => ({ have: state.pets.length, need: 10 }),
  'full-shelf': state => ({ have: state.slots.filter(Boolean).length, need: state.slots.length }),
  'full-house': state => ({ have: state.pets.length, need: 18 }),
  'decorator': state => ({ have: (state.props || []).length, need: 5 }),
  'bond-10': state => ({ have: totalBond(state), need: 10 }),
  'bond-30': state => ({ have: totalBond(state), need: 30 }),
  'bond-60': state => ({ have: totalBond(state), need: 60 }),
  'max-bond': state => ({ have: Math.max(0, ...state.pets.map(p => p.bond || 0)), need: 25 }),
  'streak-3': state => ({ have: state.streak.count || 0, need: 3 }),
  'streak-7': state => ({ have: state.streak.count || 0, need: 7 }),
  'terminal-grudge': state => ({ have: Math.max(0, ...state.pets.map(p => p.grudges || 0)), need: 20 }),
  'handshake-veteran': state => ({ have: Math.max(0, ...state.pets.map(p => p.handshakes || 0)), need: 10 }),
  'chase-perfect': state => ({ have: Math.max(0, ...state.pets.map(p => (p.chaseBest || {}).stars || 0)), need: 3 }),
  'promises-five': state => ({ have: state.pets.reduce((n, p) => n + (p.fulfilledRequests || 0), 0), need: 5 }),
  'three-cases': state => ({ have: closedCases(state), need: 3 }),
  'all-visitors': state => ({ have: (((state.stories || {}).collection) || []).length, need: 3 })
};

export function incidentProgress(state, id) {
  const fn = INCIDENT_PROGRESS[id];
  if (!fn) return null;
  try {
    const p = fn(state);
    if (!p || !Number.isFinite(p.have) || !Number.isFinite(p.need) || p.need <= 0) return null;
    return { have: Math.max(0, Math.min(p.have, p.need)), need: p.need };
  } catch { return null; }
}

export function checkAchievements(state, now = Date.now()) {
  const unlocked = [];
  if (!state.achievementAt || typeof state.achievementAt !== 'object') state.achievementAt = {};
  ACHIEVEMENTS.forEach(a => {
    if (state.achievements.includes(a.id)) return;
    if (a.check(state)) {
      state.achievements.push(a.id);
      state.achievementAt[a.id] = now;
      addNote(state, a.toastLine, 'the shelf', 'arrival');
      // And it goes in the museum, dated, next to the cases and the curiosities.
      remember(state, a.label, a.desc + ' ' + a.toastLine, now, 'incident');
      unlocked.push(a);
    }
  });
  return unlocked;
}
