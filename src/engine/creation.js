import { TRAITS, TRAIT_BY_ID } from '../content/traits.js';
import { ORIGINS, HABITS, CLOSERS, DECAY } from '../content/copy.js';

export const ORIGIN_LIMIT = 160;
export const CREATION_STATS = ['cute', 'menace', 'damp', 'mystique'];
const DEFAULT_SEED = 0x51e1f1fe;

// Independent streams keep the base stats stable when the player changes quirks.
// Resolving a draft never rolls again, including when Main finally saves it.
function randomFor(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let x = Math.imul(value ^ value >>> 15, 1 | value);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function normalizedSeed(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value >>> 0 : DEFAULT_SEED;
}

function rolledTraits(seed) {
  const random = randomFor(seed ^ 0x6A09E667);
  const pool = TRAITS.map(trait => trait.id);
  const count = random() < .45 ? 3 : 2;
  return Array.from({ length: count }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
}

export function createPersonalityDraft(seed = Math.floor(Math.random() * 4294967296)) {
  seed = normalizedSeed(seed);
  return { seed, traits: rolledTraits(seed), origin: '' };
}

export function normalizePersonalityDraft(raw) {
  const seed = normalizedSeed(raw?.seed);
  const traits = [];
  for (const id of Array.isArray(raw?.traits) ? raw.traits : []) {
    if (typeof id === 'string' && Object.hasOwn(TRAIT_BY_ID, id) && !traits.includes(id)) traits.push(id);
    if (traits.length === 3) break;
  }
  // Two quirks are required. Missing/invalid values are repaired deterministically.
  for (const id of [...rolledTraits(seed), ...TRAITS.map(trait => trait.id)]) {
    if (traits.length >= 2) break;
    if (!traits.includes(id)) traits.push(id);
  }
  const origin = typeof raw?.origin === 'string'
    ? raw.origin.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, ORIGIN_LIMIT).trimEnd() : '';
  return { seed, traits, origin };
}

export function resolvePersonality(raw) {
  const draft = normalizePersonalityDraft(raw);
  const random = randomFor(draft.seed ^ 0xBB67AE85);
  const stats = { cute: 3 + Math.floor(random() * 5), menace: 2 + Math.floor(random() * 5),
    damp: 1 + Math.floor(random() * 4), mystique: 2 + Math.floor(random() * 5) };
  for (const id of draft.traits) {
    for (const [key, amount] of Object.entries(TRAIT_BY_ID[id].stats || {})) stats[key] += amount;
  }
  for (const key of CREATION_STATS) stats[key] = Math.max(1, Math.min(10, stats[key]));
  const bioRandom = randomFor(draft.seed ^ 0x3C6EF372);
  const pick = pool => pool[Math.floor(bioRandom() * pool.length)];
  const bio = draft.origin || [pick(ORIGINS), pick(HABITS), TRAIT_BY_ID[draft.traits[0]].blurb, pick(CLOSERS)].join(' ');
  return { traits: draft.traits, stats, bio };
}

// The ordinary daytime rates, before shelf neighbours/furniture and night-time
// slowing. Include Damp's cleanliness effect, just as tick.decayRate does.
export function creationCareRates(raw) {
  const pet = resolvePersonality(raw);
  const rates = { ...DECAY };
  for (const id of pet.traits) {
    for (const [need, multiplier] of Object.entries(TRAIT_BY_ID[id].care || {})) rates[need] *= multiplier;
  }
  rates.clean *= 1 + (pet.stats.damp - 5) * .04;
  return rates;
}
