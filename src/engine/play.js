// A short, untimed memory game. Wrong taps cost nothing; rewards are per pet,
// rate limited, and only awarded after all three sequences are completed.
import { tick, isAsleep } from './tick.js';
import { clamp, addNote, grantBonusTrust } from '../state.js';
export const PLAY_COOLDOWN = 5 * 60000;
export const GESTURES = ['Knock', 'Wiggle', 'Blink', 'Boop'];
export function playWait(pet, now = Date.now()) {
  return Number.isFinite(pet.lastPlayed) && pet.lastPlayed > 0 ? Math.max(0, pet.lastPlayed + PLAY_COOLDOWN - now) : 0;
}
export function newHandshake(pet, rng = Math.random) {
  return { petId: pet.id, sequence: Array.from({ length: 4 }, () => Math.min(3, Math.max(0, Math.floor(rng() * 4)))), round: 0, cursor: 0, complete: false, claimed: false };
}
export function tapHandshake(game, gesture) {
  if (game.complete || !Number.isInteger(gesture) || gesture < 0 || gesture > 3) return 'ignored';
  if (gesture !== game.sequence[game.cursor]) { game.cursor = 0; return 'retry'; }
  game.cursor++;
  if (game.cursor < game.round + 2) return 'correct';
  game.round++;
  game.cursor = 0;
  if (game.round === 3) { game.complete = true; return 'complete'; }
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
