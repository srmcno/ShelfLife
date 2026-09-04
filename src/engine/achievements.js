import { FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../content/feuds.js';
import { GRUDGE_LINES, STREAK_LINES } from '../content/copy.js';
import { neighborPets, neighborSlots } from './tick.js';
import { totalBond } from './unlocks.js';
import { pick, addNote, clamp, petById } from '../state.js';

export function activeFeuds(state) {
  const found = [];
  state.slots.forEach((id, i) => {
    if (!id) return;
    const a = petById(state, id);
    if (!a) return;
    neighborPets(state, i).forEach(b => {
      if (b.id <= a.id) return;
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
export function stepFeudArc(state, pairKey, a, b) {
  const arc = state.feudArcs[pairKey] || (state.feudArcs[pairKey] = { level: 0, truce: false });
  if (arc.truce) return null;
  const roll = Math.random();
  if (arc.level >= 2 && roll < 0.12) {
    arc.truce = true;
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
  const lines = GRUDGE_LINES[newStage] || [];
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

export const ACHIEVEMENTS = [
  { id: 'first-arrival', label: 'Move-In Day', desc: 'Made your first pet.', toastLine: 'First one. There will be more.', check: state => state.pets.length >= 1 },
  { id: 'full-shelf', label: 'No Vacancy', desc: 'Filled every slot on the shelf.', toastLine: 'The shelf is full. So are your obligations.', check: state => state.slots.every(s => s !== null) },
  { id: 'first-feud', label: 'Drama', desc: 'Witnessed your first feud.', toastLine: 'Someone is not speaking to someone else. Achievement unlocked.', check: state => activeFeuds(state).length >= 1 },
  { id: 'first-grudge', label: 'On The List', desc: 'A pet started keeping score.', toastLine: 'It is counting now. It will not stop.', check: state => state.pets.some(p => p.grudges >= 1) },
  { id: 'first-reckoning', label: 'The Reckoning', desc: 'A grudge finally escalated.', toastLine: 'That was a mistake. That was definitely a mistake.', check: state => state.pets.some(p => p.grudgeStage >= 1) },
  { id: 'terminal-grudge', label: 'It Has A Folder Now', desc: 'A grudge reached its final stage.', toastLine: 'This is no longer about the sock.', check: state => state.pets.some(p => p.grudgeStage >= 3) },
  { id: 'max-bond', label: 'Chosen', desc: 'A pet reached maximum bond.', toastLine: 'It has decided to keep you. Permanently, probably.', check: state => state.pets.some(p => p.bond >= 25) },
  { id: 'bond-10', label: 'Trusted, Barely', desc: 'Reached 10 total bond.', toastLine: 'They trust you slightly more than the furniture.', check: state => totalBond(state) >= 10 },
  { id: 'bond-30', label: 'Household Name', desc: 'Reached 30 total bond.', toastLine: 'You are, against all odds, beloved.', check: state => totalBond(state) >= 30 },
  { id: 'bond-60', label: 'Cult Leader', desc: 'Reached 60 total bond.', toastLine: 'This is either love or a hostage situation.', check: state => totalBond(state) >= 60 },
  { id: 'streak-3', label: 'Creature Of Habit', desc: 'Checked in three days running.', toastLine: 'Three days. They have noticed the pattern.', check: state => state.streak.count >= 3 },
  { id: 'streak-7', label: 'They Expect You Now', desc: 'Checked in seven days running.', toastLine: 'A full week. This is a relationship now.', check: state => state.streak.count >= 7 },
  { id: 'first-truce', label: 'Unlikely Peace', desc: 'A feud resolved into a truce.', toastLine: 'Nobody knows what changed. It is, somehow, fine now.', check: state => Object.values(state.feudArcs).some(a => a.truce) },
  { id: 'menagerie', label: 'A Real Collection', desc: 'Ten or more pets living on the shelf at once.', toastLine: 'This is either a menagerie or a liability.', check: state => state.pets.length >= 10 },
  { id: 'decorator', label: 'Furnished', desc: 'Placed five or more things on the shelf.', toastLine: 'The shelf has a personality now. It is not yours.', check: state => state.props.length >= 5 }
];

export function checkAchievements(state) {
  const unlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (state.achievements.includes(a.id)) return;
    if (a.check(state)) {
      state.achievements.push(a.id);
      addNote(state, a.toastLine, 'the shelf', 'arrival');
      unlocked.push(a);
    }
  });
  return unlocked;
}
