import { generateCreature, normalizeCreature, SLOT_KEYS } from './creatures.js';

// Locks belong to the editor session, never to the resident's saved anatomy.
// Feed preserved parts into the generator so new features can be composed
// around them, then retain the player's explicit face adjustments.
export function remixCreature(creature, locks = [], seed) {
  const current = normalizeCreature(creature), kept = new Set(locks);
  const parts = Object.fromEntries(SLOT_KEYS.filter(key => kept.has(key)).map(key => [key, current.parts[key]]));
  const next = generateCreature({ seed, parts,
    body: kept.has('body') ? current.body : undefined,
    palette: kept.has('palette') ? current.palette : undefined });
  next.tune = { ...current.tune };
  if (kept.has('palette') && current.colors) next.colors = { ...current.colors };
  return normalizeCreature(next);
}
