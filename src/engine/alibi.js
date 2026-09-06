/* ================= THE ALIBI =================
   The third game, and deliberately the third GENRE. Crumb Chase is reflexes and
   Secret Handshake is recall, so this one is deduction: the resident makes three
   sworn statements about the shelf and exactly one of them is false. Find the lie.

   The important part is where the statements come from. Nothing here is written in
   advance — every claim is generated from the live save file, so the lie is a lie
   about YOUR shelf: who is actually standing on its left, whether there really is a
   bowl within reach, how many of them there are, whether you have ever once cleaned
   it. A player who has been paying attention to the shelf wins. A player who has
   been clicking Care and reading nothing does not.

   That is also why it fits this particular game rather than being a quiz bolted on:
   these creatures keep records about you, and this is the one place the record gets
   read back with something at stake.

   House rules it inherits from engine/play.js:
     - untimed, and a wrong answer costs nothing but the round;
     - rewards are rate limited per resident (PLAY_COOLDOWN) and capped per day
       (grantBonusTrust), so it is a treat and never a trust farm;
     - a sleeping resident will play, but only for practice. */
import { tick, isAsleep, neighborSlots } from './tick.js';
import { PROPS } from '../content/props.js';
import { clamp, addNote, grantBonusTrust, petById, propById, ROW_WIDTH } from '../state.js';
import { playWait } from './play.js';

export const ALIBI_ROUNDS = 3;
export const ALIBI_CHOICES = 3;
export const ALIBI_FUSS = 20;

const ROW_NAME = ['top', 'middle', 'bottom'];
const rowOf = slot => Math.floor(slot / ROW_WIDTH);
const other = (list, not) => list.filter(x => x && x.id !== (not && not.id));

function propNameOf(kind) { return (PROPS[kind] || {}).name || 'something'; }

/* Every generator returns { text, key }, where `key` groups claims about the same
   fact so a round never offers two statements the player would have to weigh
   against each other. Truths must be verifiable from the shelf or the card; lies
   must be verifiably false from exactly the same place. A lie the player cannot
   check is not a puzzle, it is a coin toss. */
export function statementsFor(state, pet, now = Date.now()) {
  const truths = [], lies = [];
  const slot = (state.slots || []).indexOf(pet.id);
  const pets = (state.pets || []).filter(p => p && p.id !== pet.id);
  const near = slot >= 0 ? neighborSlots(slot, state.slots.length) : [];
  const leftSlot = slot >= 0 && slot % ROW_WIDTH > 0 ? slot - 1 : -1;
  const rightSlot = slot >= 0 && slot % ROW_WIDTH < ROW_WIDTH - 1 ? slot + 1 : -1;
  const at = i => (i >= 0 && state.slots[i] ? (petById(state, state.slots[i]) || propById(state, state.slots[i])) : null);
  const push = (list, key, text) => list.push({ key, text });

  // --- who is beside it -----------------------------------------------------
  const left = at(leftSlot), right = at(rightSlot);
  if (left) push(truths, 'left', 'I have ' + left.name + ' on my left.');
  else if (leftSlot >= 0) push(truths, 'left', 'There is nobody at all on my left.');
  if (right) push(truths, 'right', 'I have ' + right.name + ' on my right.');
  else if (rightSlot >= 0) push(truths, 'right', 'My right-hand side is empty and I prefer it.');
  const notLeft = pets.filter(p => !left || p.id !== left.id);
  if (notLeft.length) push(lies, 'left', 'I have ' + notLeft[0].name + ' on my left.');
  if (left) push(lies, 'left', 'There is nobody at all on my left.');
  const notRight = pets.filter(p => !right || p.id !== right.id);
  if (notRight.length) push(lies, 'right', 'I have ' + notRight[notRight.length - 1].name + ' on my right.');
  if (right) push(lies, 'right', 'My right-hand side is empty and I prefer it.');

  // --- the furniture within reach -------------------------------------------
  const nearProps = near.map(i => state.slots[i]).filter(Boolean).map(id => propById(state, id)).filter(Boolean);
  const allProps = (state.props || []);
  const farProps = allProps.filter(p => !nearProps.some(q => q.id === p.id));
  if (nearProps.length) push(truths, 'prop', 'There is a ' + propNameOf(nearProps[0].kind) + ' within reach of me.');
  else if (allProps.length) push(truths, 'prop', 'There is no furniture within reach of me whatsoever.');
  if (farProps.length) push(lies, 'prop', 'There is a ' + propNameOf(farProps[0].kind) + ' within reach of me.');
  else if (nearProps.length) push(lies, 'prop', 'There is no furniture within reach of me whatsoever.');

  // --- the shelf at large ---------------------------------------------------
  const n = (state.pets || []).length;
  push(truths, 'count', 'Counting me, there are ' + n + ' of us living here.');
  push(lies, 'count', 'Counting me, there are ' + (n + 1 + Math.min(2, n)) + ' of us living here.');
  if (slot >= 0) {
    push(truths, 'row', 'I am on the ' + ROW_NAME[rowOf(slot)] + ' row.');
    const wrongRow = ROW_NAME.filter((_, i) => i !== rowOf(slot));
    push(lies, 'row', 'I am on the ' + wrongRow[0] + ' row.');
  }

  // --- what it has on you ---------------------------------------------------
  const grudges = pet.grudges || 0;
  push(truths, 'grudge', grudges ? 'I have ' + grudges + ' grievance' + (grudges === 1 ? '' : 's') + ' on file about you.' : 'I have nothing at all on file about you. Yet.');
  push(lies, 'grudge', grudges ? 'I have nothing at all on file about you. Yet.' : 'I have four grievances on file about you.');

  const log = pet.careLog || {};
  [['food', 'fed'], ['fuss', 'fussed over'], ['clean', 'cleaned']].forEach(([need, word]) => {
    const done = log[need] || 0;
    push(truths, 'care-' + need, done ? 'You have ' + word + ' me ' + done + ' time' + (done === 1 ? '' : 's') + '.' : 'You have never once ' + word + ' me.');
    push(lies, 'care-' + need, done ? 'You have never once ' + word + ' me.' : 'You have ' + word + ' me eleven times.');
  });

  const bond = pet.bond || 0;
  push(truths, 'trust', bond ? 'I trust you exactly ' + bond + ' out of twenty-five.' : 'I do not trust you at all. Nothing personal.');
  push(lies, 'trust', bond ? 'I do not trust you at all. Nothing personal.' : 'I trust you nine out of twenty-five.');

  // --- its own history ------------------------------------------------------
  const names = Array.isArray(pet.names) ? pet.names : [];
  if (names.length > 1) {
    push(truths, 'name', 'I have been called something else before. ' + names[0].name + ', in fact.');
    push(lies, 'name', 'I have only ever had the one name.');
  } else {
    push(truths, 'name', 'I have only ever had the one name.');
    push(lies, 'name', 'I have been called something else before, and you know which.');
  }

  const older = pets.filter(p => (p.born || 0) > (pet.born || 0));
  const younger = pets.filter(p => (p.born || 0) < (pet.born || 0));
  if (older.length) push(truths, 'age', 'I was living here before ' + older[0].name + ' ever arrived.');
  if (younger.length) push(lies, 'age', 'I was living here before ' + younger[0].name + ' ever arrived.');

  const shakes = pet.handshakes || 0;
  push(truths, 'shake', shakes ? 'You have learned my handshake ' + shakes + ' time' + (shakes === 1 ? '' : 's') + '.' : 'You have never learned my handshake.');
  push(lies, 'shake', shakes ? 'You have never learned my handshake.' : 'You have learned my handshake twice.');

  void now;
  return { truths, lies };
}

/* Builds three rounds. Each is two truths and a lie, all about different facts,
   and no statement is reused across the whole game. */
export function newAlibi(state, pet, rng = Math.random) {
  const { truths, lies } = statementsFor(state, pet);
  const shuffle = list => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const truthBag = shuffle(truths), lieBag = shuffle(lies);
  const usedKeys = new Set(), rounds = [];
  for (let r = 0; r < ALIBI_ROUNDS; r++) {
    const lie = lieBag.find(l => !usedKeys.has(l.key));
    if (!lie) break;
    usedKeys.add(lie.key);
    const picked = [];
    for (const t of truthBag) {
      if (picked.length >= ALIBI_CHOICES - 1) break;
      if (usedKeys.has(t.key)) continue;
      usedKeys.add(t.key);
      picked.push(t);
    }
    if (picked.length < ALIBI_CHOICES - 1) break;
    const cards = shuffle(picked.concat([lie]));
    rounds.push({ statements: cards.map(c => c.text), lie: cards.indexOf(lie), answered: null });
  }
  return { kind: 'alibi', petId: pet.id, rounds, round: 0, correct: 0, complete: !rounds.length, claimed: false };
}

export function currentRound(game) {
  return game && game.rounds ? game.rounds[game.round] || null : null;
}

/* Untimed and unpunished, exactly like the handshake: a wrong answer tells you
   which one it was and the game moves on. The score is how many you caught, not
   whether you were allowed to keep going.

   Answering does NOT advance the round — advanceAlibi() does, once the caller has
   finished showing which statement was false. Keeping those separate is what makes
   a second, faster tap land on 'ignored' instead of silently spending the next
   round's answer on a click the player never saw a question for. */
export function answerAlibi(game, index) {
  if (!game || game.complete) return 'ignored';
  const round = currentRound(game);
  if (!round || round.answered !== null || !Number.isInteger(index) || index < 0 || index >= round.statements.length) return 'ignored';
  round.answered = index;
  const right = index === round.lie;
  if (right) game.correct++;
  if (game.round >= game.rounds.length - 1) game.complete = true;
  return right ? 'right' : 'wrong';
}

// Moves on to the next statement once the current one has been answered.
export function advanceAlibi(game) {
  if (!game || game.complete) return false;
  const round = currentRound(game);
  if (!round || round.answered === null) return false;
  game.round++;
  return true;
}

export function rewardAlibi(state, game, now = Date.now()) {
  const pet = state.pets.find(p => p.id === game.petId);
  if (!pet || !game.complete || game.claimed) return null;
  game.claimed = true;
  tick(state, now);
  const clean = game.correct === game.rounds.length && game.rounds.length > 0;
  if (playWait(pet, now) || isAsleep(pet, new Date(now))) return { practice: true, fuss: 0, bond: 0, clean };
  // Attention scales with how much of its testimony you actually caught; trust is
  // only for a clean sweep, and still goes through the daily bonus cap.
  const share = game.rounds.length ? game.correct / game.rounds.length : 0;
  const fuss = Math.min(Math.round(ALIBI_FUSS * share), 100 - pet.needs.fuss);
  pet.needs.fuss = clamp(pet.needs.fuss + Math.max(0, fuss), 0, 100);
  const bond = clean ? grantBonusTrust(pet, 1, now) : 0;
  pet.lastPlayed = now;
  pet.alibis = (pet.alibis || 0) + 1;
  if (state.stories) state.stories.alibis = (Number(state.stories.alibis) || 0) + 1;
  addNote(state, clean
    ? pet.name + ' gave three statements and you found every lie. It has asked who told you.'
    : pet.name + ' gave its statements. You believed ' + (game.rounds.length - game.correct) + ' of the false ones. It is not going to correct the record.',
    pet.name, 'note');
  return { practice: false, fuss: Math.max(0, fuss), bond, clean };
}
