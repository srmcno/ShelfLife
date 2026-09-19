import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { claimChaseCampaign } from '../content/chase-campaign.js';
import { recordGameLife, recordScene } from './life.js';
// A short, untimed memory game. Wrong taps cost nothing; rewards are per pet,
// rate limited, and only awarded after all three sequences are completed.
import { tick, isAsleep } from './tick.js';
import { clamp, addNote, grantBonusTrust } from '../state.js';
import { recordEscapadeEvent } from '../escapade-state.js';
// Losing chases have no win receipt, but their real finished attempt still
// belongs to the adventure. Remember callbacks without altering win counts.
const reportedChases = new WeakSet();
export const PLAY_COOLDOWN = 5 * 60000;
export const GESTURES = ['Knock', 'Wiggle', 'Blink', 'Boop'];

/* Every resident used to teach you the same four gestures under the same four
   names, which made the handshake the one interaction on the shelf where it did
   not matter who you were playing with. The moves are still the same four (the
   pads, the icons and the puppet animations are shared), but what a creature
   CALLS them is its own. A Spiteful thing does not boop. */
export const GESTURE_STYLES = {
  formal:   ['Announce', 'Flourish', 'Acknowledge', 'Seal'],
  menace:   ['Rap', 'Twitch', 'Stare', 'Jab'],
  gothic:   ['Toll', 'Waver', 'Shutter', 'Anoint'],
  clerical: ['Log', 'Initial', 'Witness', 'Stamp'],
  theatre:  ['Cue', 'Sweep', 'Beat', 'Button'],
  damp:     ['Drip', 'Slosh', 'Film Over', 'Blot'],
  feral:    ['Thump', 'Thrash', 'Squint', 'Nip'],
  tender:   ['Knock', 'Wave', 'Blink', 'Boop'],
  clinical: ['Percuss', 'Tremor', 'Dilate', 'Palpate'],
  ancient:  ['Knock Thrice', 'Sway', 'Close One Eye', 'Bestow']
};
// Trait -> style. Anything unlisted keeps the house names, so a new archetype
// never lands without a working handshake.
export const TRAIT_GESTURES = {
  management: 'formal', etiquette: 'formal', landlord: 'formal', closer: 'formal', timeshare: 'formal',
  spiteful: 'menace', bitey: 'menace', napoleon: 'menace', feral: 'feral', swarm: 'feral', magpie: 'feral',
  haunted: 'gothic', cult: 'gothic', undertaker: 'gothic', mourner: 'gothic', bones: 'gothic',
  cryptid: 'gothic', prophet: 'gothic', taxidermy: 'gothic', cursed: 'gothic',
  complaints: 'clerical', auditor: 'clerical', witness: 'clerical', steward: 'clerical',
  executor: 'clerical', litigious: 'clerical', revisionist: 'clerical',
  theatrical: 'theatre', narcissist: 'theatre', method: 'theatre', understudy: 'theatre',
  influencer: 'theatre', socialite: 'theatre', terminal: 'theatre',
  damp: 'damp', fungal: 'damp', glitter: 'damp',
  clingy: 'tender', lifecoach: 'tender', sugar: 'tender', hummer: 'tender', porcelain: 'tender',
  physician: 'clinical', insomniac: 'clinical', doomscroll: 'clinical', minimalist: 'clinical',
  ancient: 'ancient', heirloom: 'ancient', amnesiac: 'ancient', reflection: 'ancient', unblinking: 'ancient'
};

export function gesturesFor(pet) {
  const style = ((pet && pet.traits) || []).map(id => TRAIT_GESTURES[id]).find(Boolean);
  return (style && GESTURE_STYLES[style]) || GESTURES;
}

export function handshakeMemory(pet, ritual = 'echo') {
  const memory = pet?.handshakeRituals?.[ritual], length = ritual === 'duet' ? 4 : 2;
  return memory && memory.completions > 0 && Array.isArray(memory.opening) && memory.opening.length === length
    && memory.opening.every(move => Number.isInteger(move) && move >= 0 && move <= 3) ? memory : null;
}

// These are present-tense reactions. Only handshakeMemory supplies callbacks
// about earlier play, so imported residents never inherit invented memories.
export function handshakeReaction(pet, phase = 'watch') {
  const style = (pet?.traits || []).map(id => TRAIT_GESTURES[id]).find(Boolean) || 'tender';
  const lines = {
    menace: ['It moves its teeth out of the way. This is an intimate concession.', '“Wrong. Again. I moved my teeth for this.”', 'It offers one very careful touch, then counts your fingers. It remembers a different number.'],
    feral: ['It pats the floor for you, then bites the floor for listening.', 'It patiently demonstrates. The floor receives another bite.', 'It leans against you without asking. You appear to belong to it now.'],
    tender: ['It leaves a space beside itself that is exactly your finger wide.', '“We can do it again. I had not finished being near you.”', 'It holds the last touch slightly too long. You are both pretending this is required.'],
    gothic: ['It closes one eye. Something behind it closes the other.', '“Again. Whatever is under the shelf was watching.”', 'It makes room for you in its shadow. The shadow objects; it insists.'],
    theatre: ['It checks your eyeline, moves its good side into view, then begins.', '“A rehearsal. Obviously. The actual moment is still coming.”', 'It bows so low something falls out. It kicks it under the rug before accepting applause.'],
    damp: ['It wipes a small dry place for you. It is immediately damp again.', '“Slipped. Entirely the moisture. Let us try the less wet finger.”', 'It leaves a wet print against you and looks absurdly pleased that it stuck.'],
    formal: ['It straightens your imaginary cuff before allowing the first move.', '“Nearly. You may retain the finger and try again.”', 'It offers a precise little nod, then follows you for one unnecessary step.'],
    clerical: ['It tests the distance between you twice. The third time is just touching.', '“That version is still between us. We can improve it.”', 'It tidies the place where your hand was. Then untidies it to keep the shape.'],
    clinical: ['It examines your finger, decides to overlook your construction, and begins.', '“Both subjects remain intact. Repeat the experiment.”', 'It checks your pulse and looks disappointed. It had already priced the jar.'],
    ancient: ['It makes the first move very slowly. For once, it wants company in the present.', '“We have time. An embarrassing amount. Again?”', 'It stays close after the last move. Some things are worth remembering on purpose.']
  };
  return (lines[style] || lines.tender)[phase === 'retry' ? 1 : phase === 'complete' ? 2 : 0];
}

// Mastery length is explicit; legacy trust and accessibility never set it.
export const LONG_HANDSHAKE_AT = 12;
export function handshakeRounds(pet) {
  return mastery(pet || {}, 'handshake').tier >= 1 ? 4 : 3;
}
export function playWait(pet, now = Date.now(), kind = null) {
  const last = kind ? pet.playedAt?.[kind] || 0 : pet.lastPlayed;
  return Number.isFinite(last) && last > 0 ? Math.max(0, last + PLAY_COOLDOWN - now) : 0;
}
export const HANDSHAKE_RITUALS = {
  echo: { name: 'Echo', rule: 'Repeat every move in the same order.' },
  mirror: { name: 'Mirror', rule: 'Repeat every move backwards, starting with the last.' },
  duet: { name: 'Duet', rule: 'Remember only the moves marked YOUR BEAT. Skip their beats.' }
};
export function handshakeRecordKey(game) {
  return !game.ritual || game.ritual === 'echo' ? (game.encore ? 'encore' : 'standard') : game.ritual + (game.encore ? '-encore' : '');
}
export function handshakeDemonstration(game) {
  const count = game.round + 2;
  return game.sequence.slice(0, count * (game.ritual === 'duet' ? 2 : 1));
}
export function handshakePattern(game) {
  const moves = handshakeDemonstration(game);
  if (game.ritual === 'mirror') return moves.reverse();
  if (game.ritual === 'duet') return moves.filter((_, i) => i % 2 === 1);
  return moves;
}
export function restartHandshake(game) {
  return { ...game, receipt:null, sequence: game.sequence.slice(), names: game.names.slice(), round: 0, cursor: 0, mistakes: 0, replays: 0, complete: false, claimed: false };
}
export function replayHandshake(game) {
  if (!game || game.complete) return false;
  game.cursor = 0;
  game.replays = (game.replays || 0) + 1;
  return true;
}
export function newHandshake(pet, rng = Math.random, { encore = false, ritual = null, practice = false } = {}) {
  const tier = practice ? 0 : mastery(pet, 'handshake').tier;
  ritual ||= ['echo','echo','mirror','duet'][tier];
  const rounds = encore ? 5 : practice ? 3 : handshakeRounds(pet);
  ritual = Object.hasOwn(HANDSHAKE_RITUALS, ritual) ? ritual : 'echo';
  const sequence = Array.from({ length: (rounds + 1) * (ritual === 'duet' ? 2 : 1) }, () => Math.min(3, Math.max(0, Math.floor(rng() * 4))));
  const memory = handshakeMemory(pet, ritual);
  if (memory) sequence.splice(0, memory.opening.length, ...memory.opening);
  return {
    practice, masteryTier: ritual==='duet'?3:ritual==='mirror'?2:rounds>=4?1:0, receipt: masteryTicket(pet, 'handshake'), petId: pet.id, rounds, encore, ritual: Object.hasOwn(HANDSHAKE_RITUALS, ritual) ? ritual : 'echo', mistakes: 0, replays: 0,
    names: gesturesFor(pet),
    // One more gesture than there are rounds: round 1 asks for two, and the last
    // round asks for the lot.
    sequence, familiar: !!memory,
    round: 0, cursor: 0, complete: false, claimed: false
  };
}
export function tapHandshake(game, gesture) {
  if (game.complete || !Number.isInteger(gesture) || gesture < 0 || gesture > 3) return 'ignored';
  if (gesture !== handshakePattern(game)[game.cursor]) { game.cursor = 0; game.mistakes = (game.mistakes || 0) + 1; return 'retry'; }
  game.cursor++;
  if (game.cursor < game.round + 2) return 'correct';
  game.round++;
  game.cursor = 0;
  if (game.round >= (game.rounds || 3)) { game.complete = true; return 'complete'; }
  return 'round';
}
export function rewardHandshake(state, game, now = Date.now()) {
  const pet = state.pets.find(p => p.id === game.petId);
  if (pet && game.kind === 'chase' && game.finished && !game.claimed && !reportedChases.has(game)) {
    reportedChases.add(game);
    recordEscapadeEvent(state, { kind: 'play', petIds: [pet.id], activity: 'chase' }, now);
  }
  if (!pet || !game.complete || game.claimed) return null;
  if (game.format === 'campaign' && !claimChaseCampaign(pet, game, now, {consume:false})) { game.claimed = true; return {practice:true,fuss:0,bond:0}; }
  game.claimed = true;
  if (game.kind !== 'chase' && !game.practice && game.receipt && !completeMastery(pet, 'handshake', game.masteryTier, game.receipt)) return {practice:true,fuss:0,bond:0};
  if (game.kind !== 'chase') recordEscapadeEvent(state, { kind: 'play', petIds: [pet.id], activity: 'memory' }, now);
  if (game.kind !== 'chase') {
    const ritual = Object.hasOwn(HANDSHAKE_RITUALS, game.ritual) ? game.ritual : 'echo';
    const previousMemory = handshakeMemory(pet, ritual);
    pet.handshakeRituals ||= {};
    pet.handshakeRituals[ritual] = { opening: previousMemory ? previousMemory.opening.slice() : game.sequence.slice(0, ritual === 'duet' ? 4 : 2), completions: Math.min(100000, (previousMemory?.completions || 0) + 1), clean: Math.min(100000, (previousMemory?.clean || 0) + (game.mistakes ? 0 : 1)), at: now };
    if (!previousMemory) recordScene(state, 'celebration', 'Something only you two know', pet.name + ' chose a shared ' + HANDSHAKE_RITUALS[ritual].name + ' opening: ' + pet.handshakeRituals[ritual].opening.map(move => GESTURES[move]).join(', ') + '. ' + handshakeReaction(pet, 'complete'), [pet.id], now);
    const key = handshakeRecordKey(game);
    pet.handshakeBest ||= {};
    const previous = pet.handshakeBest[key];
    const mistakes = game.mistakes || 0, replays = game.replays || 0;
    if (!previous || game.rounds > previous.rounds || game.rounds === previous.rounds && (mistakes < previous.mistakes || mistakes === previous.mistakes && replays < previous.replays)) {
      pet.handshakeBest[key] = { rounds:game.rounds, mistakes, replays, at:now };
    }
  }
  const kind = game.kind === 'chase' ? 'chase' : 'memory';
  const count = kind === 'chase' ? 'chases' : 'handshakes';
  pet[count] = (pet[count] || 0) + 1;
  if (state.stories) state.stories[count] = (Number(state.stories[count]) || 0) + 1;
  recordGameLife(state, pet, kind, now);
  tick(state, now);
  if (playWait(pet, now, kind) || isAsleep(pet, new Date(now))) return { practice: true, fuss: 0, bond: 0 };
  const need = 'fuss';
  const fuss = Math.min(24, 100 - pet.needs[need]);
  pet.needs[need] = clamp(pet.needs[need] + fuss, 0, 100);
  const bond = grantBonusTrust(pet, 1, now);
  if(game.format==='campaign' && (fuss>0 || bond>0)) claimChaseCampaign(pet,game,now);
  pet.lastPlayed = now;
  pet.playedAt ||= {}; pet.playedAt[kind] = now;
  addNote(state, pet.name + (game.kind === 'chase' ? ' chased down ' + game.caught + ' crumbs and dodged ' + game.dodged + (game.dodged === 1 ? ' dust bunny.' : ' dust bunnies.') + ' It insists this was serious work.' : ' finished a ' + HANDSHAKE_RITUALS[game.ritual || 'echo'].name + ' handshake with you. ' + handshakeReaction(pet, 'complete')), pet.name, 'note');
  return { practice: false, fuss, bond };
}
