// A short, untimed memory game. Wrong taps cost nothing; rewards are per pet,
// rate limited, and only awarded after all three sequences are completed.
import { tick, isAsleep } from './tick.js';
import { clamp, addNote, grantBonusTrust } from '../state.js';
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

// A handshake gets longer as a resident actually trusts you: three rounds to
// begin with, a fourth once it has decided you are worth the extra move.
export const LONG_HANDSHAKE_AT = 12;
export function handshakeRounds(pet) {
  return (pet && (pet.bond || 0) >= LONG_HANDSHAKE_AT) ? 4 : 3;
}
export function playWait(pet, now = Date.now()) {
  return Number.isFinite(pet.lastPlayed) && pet.lastPlayed > 0 ? Math.max(0, pet.lastPlayed + PLAY_COOLDOWN - now) : 0;
}
export function newHandshake(pet, rng = Math.random) {
  const rounds = handshakeRounds(pet);
  return {
    petId: pet.id, rounds,
    names: gesturesFor(pet),
    // One more gesture than there are rounds: round 1 asks for two, and the last
    // round asks for the lot.
    sequence: Array.from({ length: rounds + 1 }, () => Math.min(3, Math.max(0, Math.floor(rng() * 4)))),
    round: 0, cursor: 0, complete: false, claimed: false
  };
}
export function tapHandshake(game, gesture) {
  if (game.complete || !Number.isInteger(gesture) || gesture < 0 || gesture > 3) return 'ignored';
  if (gesture !== game.sequence[game.cursor]) { game.cursor = 0; return 'retry'; }
  game.cursor++;
  if (game.cursor < game.round + 2) return 'correct';
  game.round++;
  game.cursor = 0;
  if (game.round >= (game.rounds || 3)) { game.complete = true; return 'complete'; }
  return 'round';
}
export function rewardHandshake(state, game, now = Date.now()) {
  const pet = state.pets.find(p => p.id === game.petId);
  if (!pet || !game.complete || game.claimed) return null;
  game.claimed = true;
  tick(state, now);
  if (playWait(pet, now) || isAsleep(pet, new Date(now))) return { practice: true, fuss: 0, bond: 0 };
  const need = 'fuss';
  const fuss = Math.min(24, 100 - pet.needs[need]);
  pet.needs[need] = clamp(pet.needs[need] + fuss, 0, 100);
  const bond = grantBonusTrust(pet, 1, now);
  pet.lastPlayed = now;
  if (game.kind === 'chase') {
    pet.chases = (pet.chases || 0) + 1;
    if (state.stories) state.stories.chases = (Number(state.stories.chases) || 0) + 1;
  }
  else {
    pet.handshakes = (pet.handshakes || 0) + 1;
    if (state.stories) state.stories.handshakes = (Number(state.stories.handshakes) || 0) + 1;
  }
  addNote(state, pet.name + (game.kind === 'chase' ? ' chased down ' + game.caught + ' crumbs and dodged ' + game.dodged + ' dust bunnies. It insists this was serious work.' : ' has taught you the secret handshake. It works without hands. This is now your problem.'), pet.name, 'note');
  return { practice: false, fuss: Math.round(fuss), bond };
}
