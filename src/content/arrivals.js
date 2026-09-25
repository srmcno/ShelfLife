import { generateCreature } from '../art/creatures.js';
import { normalizePersonalityDraft } from '../engine/creation.js';

// These are creator drafts, never residents or rewards. The same draft supplies
// the invitation and studio, so choosing a face does not secretly reroll it.
export const ARRIVALS = [
  { id: 'mabel', name: 'Mabel', line: 'Keeps lying down in coffins that are not for her. Yet.',
    traits: ['theatrical', 'undertaker'], seed: 1203, body: 'pear', palette: 'bone',
    parts: { eyes: 'lashes', mouth: 'smirk', top: 'none', ears: 'round', legs: 'stubby', arms: 'mitts', wings: 'none', tail: 'none', detail: 'stitches' } },
  { id: 'pip', name: 'Pip', line: 'Eats the mourning clothes. Then attends the funeral naked.',
    traits: ['nocturnal', 'magpie'], seed: 7201, body: 'tuft', palette: 'mould',
    parts: { eyes: 'pair', mouth: 'oh', top: 'antennae', ears: 'none', legs: 'bird', arms: 'stubby', wings: 'moth', tail: 'none', detail: 'none' } },
  { id: 'oswald', name: 'Oswald', line: 'Hollow inside. Something knocks. Oswald says it is his uncle.',
    traits: ['spiteful', 'porcelain'], seed: 9034, body: 'urn', palette: 'amber',
    parts: { eyes: 'sleepy', mouth: 'frown', top: 'crown', ears: 'none', legs: 'boots', arms: 'noodle', wings: 'none', tail: 'none', detail: 'cracks' } }
];

export function arrivalDraft(id) {
  const arrival = ARRIVALS.find(item => item.id === id);
  if (!arrival) return null;
  return {
    name: arrival.name,
    creature: generateCreature(arrival),
    personality: normalizePersonalityDraft({ seed: arrival.seed, traits: arrival.traits, origin: arrival.line })
  };
}
