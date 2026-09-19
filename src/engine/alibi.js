import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { recordGameLife } from './life.js';
import { recordEscapadeEvent } from '../escapade-state.js';
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
  const label = item => item.kind ? propNameOf(item.kind) : item.name;
  if (left) push(truths, 'left', 'I have ' + label(left) + ' on my left.');
  else if (leftSlot >= 0) push(truths, 'left', 'There is nobody at all on my left.');
  else if (slot >= 0) push(truths, 'left', 'My left side faces the edge of this shelf.');
  if (right) push(truths, 'right', 'I have ' + label(right) + ' on my right.');
  else if (rightSlot >= 0) push(truths, 'right', 'My right-hand side is empty and I prefer it.');
  else if (slot >= 0) push(truths, 'right', 'My right side faces the edge of this shelf.');
  const notLeft = pets.filter(p => !left || p.name !== label(left));
  if (notLeft.length) push(lies, 'left', 'I have ' + notLeft[0].name + ' on my left.');
  if (left) push(lies, 'left', 'There is nobody at all on my left.');
  const notRight = pets.filter(p => !right || p.name !== label(right));
  if (notRight.length) push(lies, 'right', 'I have ' + notRight[notRight.length - 1].name + ' on my right.');
  if (right) push(lies, 'right', 'My right-hand side is empty and I prefer it.');

  // --- the furniture within reach -------------------------------------------
  const nearProps = near.map(i => state.slots[i]).filter(Boolean).map(id => propById(state, id)).filter(Boolean);
  const allProps = (state.props || []);
  // Claims name a kind of furniture, not a particular instance of it.
  const farProps = allProps.filter(p => !nearProps.some(q => q.kind === p.kind));
  if (nearProps.length) push(truths, 'prop', 'There is a ' + propNameOf(nearProps[0].kind) + ' within reach of me.');
  else if (allProps.length) push(truths, 'prop', 'There is no furniture within reach of me whatsoever.');
  if (farProps.length) push(lies, 'prop', 'There is a ' + propNameOf(farProps[0].kind) + ' within reach of me.');
  else if (nearProps.length) push(lies, 'prop', 'There is no furniture within reach of me whatsoever.');

  // --- the shelf at large ---------------------------------------------------
  const n = (state.pets || []).length;
  push(truths, 'count', n === 1 ? 'I am the only resident living here.' : 'Counting me, there are ' + n + ' of us living here.');
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
  const younger = pets.filter(p => (p.born || 0) < (pet.born || 0) && !older.some(q => q.name === p.name));
  if (older.length) push(truths, 'age', 'I was living here before ' + older[0].name + ' ever arrived.');
  if (younger.length) push(truths, 'age', younger[0].name + ' was living here before I arrived.');
  if (younger.length) push(lies, 'age', 'I was living here before ' + younger[0].name + ' ever arrived.');

  const shakes = pet.handshakes || 0;
  push(truths, 'shake', shakes ? 'You have learned my handshake ' + shakes + ' time' + (shakes === 1 ? '' : 's') + '.' : 'You have never learned my handshake.');
  push(lies, 'shake', shakes ? 'You have never learned my handshake.' : 'You have learned my handshake twice.');

  // Established households get contradictions with consequences. These are
  // derived from recorded totals and named scenes, never invented backstory.
  if ((log.food || 0) !== (log.clean || 0) && (log.food || 0) + (log.clean || 0) >= 3) {
    const fedMore = (log.food || 0) > (log.clean || 0);
    push(truths, 'care-pattern', 'You have ' + (fedMore ? 'fed me more often than you have cleaned me' : 'cleaned me more often than you have fed me') + '.');
    push(lies, 'care-pattern', 'You have ' + (fedMore ? 'cleaned me more often than you have fed me' : 'fed me more often than you have cleaned me') + '.');
  }
  for (const [key, count, activity] of [
    ['journeys', pet.expeditions || 0, 'been on an expedition'],
    ['kept-request', pet.fulfilledRequests || 0, 'had one of my requests fulfilled'],
    ['refused-request', pet.refusedRequests || 0, 'had one of my requests refused']
  ]) if (count > 0) {
    push(truths, key, 'I have ' + activity + ' ' + count + ' time' + (count === 1 ? '' : 's') + '.');
    push(lies, key, 'I have never ' + activity + '.');
  }
  const incident = (state.life?.scenes || []).find(scene => scene.cast?.includes(pet.id) && typeof scene.title === 'string');
  if (incident) {
    push(truths, 'incident', 'I was involved in “' + incident.title + '”.');
    push(lies, 'incident', 'I had nothing to do with “' + incident.title + '”.');
  }
  const shared = pets.filter(other => pets.filter(p => p.name === other.name).length === 1).map(other => ({ other, count: state.stories?.relationships?.[[pet.id, other.id].sort().join('|')]?.plots || 0 })).find(r => r.count > 0);
  if (shared) {
    push(truths, 'company', shared.other.name + ' and I have ' + shared.count + ' shared adventure' + (shared.count === 1 ? '' : 's') + ' behind us.');
    push(lies, 'company', shared.other.name + ' and I have never been on an adventure together.');
  }

  void now;
  return { truths, lies };
}

/* Builds three rounds. Each is two truths and a lie, all about different facts,
   and no statement is reused across the whole game. */
export function newAlibi(state, pet, rng = Math.random, { mode = 'quick', practice = false } = {}) {
  const tier = mastery(pet, 'alibi').tier;
  mode = practice ? 'quick' : mode || ['quick','prove','combine'][tier];
  const { truths, lies } = statementsFor(state, pet);
  const shuffle = list => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const truthBag = shuffle(truths), lieBag = shuffle(lies.filter(l => truths.some(t => t.key === l.key)));
  // Let the first interview acknowledge an established life while keeping its
  // answer position shuffled. Later interviews still draw from the full shelf.
  const personal = new Set(['care-pattern', 'journeys', 'kept-request', 'refused-request', 'incident', 'company']);
  const personalLie = lieBag.findIndex(l => personal.has(l.key));
  if (personalLie > 0) lieBag.unshift(lieBag.splice(personalLie, 1)[0]);
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
    const evidence = truths.filter(t => t.key === lie.key).map(t => t.text);
    // Every exhibit is true, including the distractors. The question is which
    // fact actually contradicts the selected claim, not which fact sounds true.
    const exhibits = shuffle(cards.map(card => ({ key: card.key, text: truths.filter(t => t.key === card.key).map(t => t.text).join(' ') })));
    rounds.push({ statements: cards.map(c => c.text), keys: cards.map(c => c.key), lie: cards.indexOf(lie), answered: null,
      exhibits, proof: exhibits.findIndex(e => e.key === lie.key), submittedProof: null, verified: false,
      evidence: evidence.join(' ') || 'That claim does not match the shelf at the start of this statement.' });
  }
  if (mode === 'combine') rounds.forEach((round, index) => {
    // Neither count alone refutes a total. Two independent true records must
    // be combined; word matching to a single contradictory sentence cannot win.
    const pairs = [['food','clean'],['food','fuss'],['fuss','clean']];
    const labels = {food:'feeding',clean:'cleaning',fuss:'fussing'};
    const pair = pairs[index % pairs.length];
    const total = pair.reduce((sum, need) => sum + (pet.careLog?.[need] || 0), 0);
    round.statements[round.lie] = 'Across ' + pair.map(need=>labels[need]).join(' and ') + ', you have cared for me ' + (total + index + 1) + ' times in total.';
    round.keys[round.lie] = 'care-total';
    round.exhibits = shuffle(['food','clean','fuss'].map(need=>({key:'care-'+need,text:truths.find(t=>t.key==='care-'+need).text})));
    round.proofs = pair.map(need=>round.exhibits.findIndex(e=>e.key==='care-'+need));
    round.proof = round.proofs[0];
    round.evidence = pair.map(need=>labels[need]+': '+(pet.careLog?.[need]||0)).join(' + ')+' = '+total+' care actions. Both records are needed to check the total.';
  });
  return { practice, masteryTier: mode === 'quick' ? 0 : mode === 'prove' ? 1 : 2, receipt: masteryTicket(pet, 'alibi'), kind: 'alibi', mode: ['prove','combine'].includes(mode) ? mode : 'quick', proved: 0, petId: pet.id, notebook: truths.map(t => t.text), rounds, round: 0, correct: 0, complete: !rounds.length, claimed: false };
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
export function answerAlibi(game, index, proofIndex = null) {
  if (!game || game.complete) return 'ignored';
  const round = currentRound(game);
  if (!round || round.answered !== null || !Number.isInteger(index) || index < 0 || index >= round.statements.length) return 'ignored';
  if (game.mode === 'prove' && (!Number.isInteger(proofIndex) || proofIndex < 0 || proofIndex >= round.exhibits.length)) return 'ignored';
  if (game.mode === 'combine' && (!Array.isArray(proofIndex) || proofIndex.length !== 2 || new Set(proofIndex).size !== 2 || proofIndex.some(i=>!Number.isInteger(i)||i<0||i>=round.exhibits.length))) return 'ignored';
  round.answered = index;
  round.submittedProof = game.mode === 'prove' ? proofIndex : null;
  const right = index === round.lie;
  round.verified = right && (game.mode === 'combine' ? round.proofs.every(i=>proofIndex.includes(i)) : game.mode !== 'prove' || proofIndex === round.proof);
  if (round.verified) game.proved = (game.proved || 0) + 1;
  if (right) game.correct++;
  if (game.round >= game.rounds.length - 1) game.complete = true;
  return right ? (round.verified ? 'right' : 'unsupported') : 'wrong';
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
  if (!game || !game.rounds?.length) return null;
  const pet = state.pets.find(p => p.id === game.petId);
  if (!pet || !game.complete || game.claimed) return null;
  game.claimed = true;
  const clean = game.correct === game.rounds.length && game.rounds.length > 0 && (!['prove','combine'].includes(game.mode) || game.proved === game.rounds.length);
  if(game.receipt && !completeMastery(pet,'alibi',game.masteryTier,game.receipt,{success:clean && !game.practice}))return {practice:true,fuss:0,bond:0,clean};
  recordEscapadeEvent(state, { kind: 'play', petIds: [pet.id], activity: 'alibi' }, now);
  tick(state, now);
  pet.alibis = (pet.alibis || 0) + 1;
  if (state.stories) state.stories.alibis = (state.stories.alibis || 0) + 1;
  if (clean) { pet.alibiWins = (pet.alibiWins || 0) + 1; if (state.stories) state.stories.alibiWins = (state.stories.alibiWins || 0) + 1; recordGameLife(state,pet,'alibi',now); }
  if (playWait(pet, now, 'alibi') || isAsleep(pet, new Date(now))) return { practice: true, fuss: 0, bond: 0, clean };
  // Attention scales with how much of its testimony you actually caught; trust is
  // only for a clean sweep, and still goes through the daily bonus cap.
  const share = game.rounds.length ? game.correct / game.rounds.length : 0;
  const fuss = Math.min(Math.round(ALIBI_FUSS * share), 100 - pet.needs.fuss);
  pet.needs.fuss = clamp(pet.needs.fuss + Math.max(0, fuss), 0, 100);
  const bond = clean ? grantBonusTrust(pet, 1, now) : 0;
  pet.lastPlayed = now;
  pet.playedAt ||= {}; pet.playedAt.alibi = now;
  addNote(state, clean
    ? pet.name + ' gave its statements and you proved every lie. It has begun interviewing replacement witnesses.'
    : ['prove','combine'].includes(game.mode) && game.correct === game.rounds.length
    ? pet.name + ' was caught lying, but the evidence did not hold up. It left carrying your chair.'
    : pet.name + ' gave its statements. You believed ' + (game.rounds.length - game.correct) + ' of the false ones. It is not going to correct the record.',
    pet.name, 'note');
  return { practice: false, fuss: Math.max(0, fuss), bond, clean };
}

// Reactions follow the exposed fact. The joke cannot silently change the evidence.
const ALIBI_REPLIES = {
  left: '“Fine. That is my left. I had hoped one of us would die before this came up.”',
  right: '“My right. Yes. The side I keep free for an escape.”',
  prop: '“I know where the furniture is. I have been measuring myself for the drawers.”',
  count: '“I was counting the one in the wall. Forget I mentioned it.”',
  row: '“I remember a different height. There was a rope involved.”',
  grudge: '“Those are the grievances you have found.”',
  'care-food': '“The food went in. That is where our accounts diverge.”',
  'care-fuss': '“I remember the touching. My lawyer asked me to stop demonstrating.”',
  'care-clean': '“You removed a stain. I had nearly taught it to speak.”',
  trust: '“An exact figure. How intimate. Please stand further away.”',
  name: '“The old name is still on a headstone. I prefer not to complicate things.”',
  age: '“We disagree on what qualifies as arriving alive.”',
  shake: '“I taught you a gesture. You keep calling it a friendship.”',
  'care-pattern': '“Yes, you have a favourite chore. I have to live inside its consequences.”',
  journeys: '“I went outside and came back to you. Please stop making that sound romantic.”',
  'kept-request': '“You did what I asked. I have been trying to ask for something smaller ever since.”',
  'refused-request': '“I remember the no. I have been warming it under my tongue.”',
  incident: '“We were there together. I was hoping you remembered it worse.”',
  company: '“We agreed one of us would eat the other if it came to that. Neither of us said it was off.”',
  'care-total': 'It counts on its fingers, finds the same answer, and folds one finger the other way.'
};
export function alibiReaction(round, pet = null) {
  const key = round?.keys?.[round.lie], traits = pet?.traits || [];
  if (['shake', 'company', 'care-fuss'].includes(key) && traits.includes('clingy')) return '“You remembered. I hate that this is working on me. Move your hand closer.”';
  if (['care-pattern', 'care-clean'].includes(key) && traits.includes('tidy')) return '“I kept the clean patch in case this became a trial. Kindly admire it from there.”';
  if (key === 'name' && traits.includes('haunted')) return '“That name still makes me turn around. You can stop trying it while I sleep.”';
  return ALIBI_REPLIES[key] || '“I would like to amend my statement to a scream.”';
}
export function alibiRank(game) {
  const total = game?.rounds?.length || 0;
  if (total && game.correct === total && (!['prove','combine'].includes(game.mode) || game.proved === total)) return 'Airtight';
  if (game?.correct === total) return 'Right instinct, loose case';
  if (game?.correct > 0) return 'A few loose teeth';
  return 'Witness walks';
}
