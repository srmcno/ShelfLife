/* ================= DIALOGUE SELECTION =================
   Pure selection logic for src/content/dialogue.js. No DOM, no note writing, no
   mutation of state — every function takes `state` explicitly so it can be unit
   tested against a fabricated shelf (project convention; see engine/tick.js).

   Entry point:  pickDialogue(state, opts) -> DialogueResult | null

   DialogueResult = {
     kind:    'trait' | 'generic' | 'feud' | 'reaction' | 'direct' | 'fragment' | 'chorus'
     form:    'two-hander' | 'reaction' | 'direct' | 'line' | 'chorus'   (docs/comedy-direction.md §2)
     from:    suggested addNote() byline
     tone:    suggested addNote() kind — 'note' | 'feud' | 'angry'
     setup:   unattributed narration, reaction shots only, else null
     turns:   [{ who, speaker, line }]        placeholders already substituted
     cast:    [pet, ...]                      the pets in the scene, in role order
     meta:    { pair?, level?, category?, trait?, mature }
   }

   Renderers get speaker attribution per turn and can lay it out however they like;
   formatDialogue()/dialogueText() are convenience joins for the existing note feed. */

import { neighborPets, moodOf, isAsleep, isNight, hasTrait } from './tick.js';
import { activeFeuds, feudPairKey } from './achievements.js';
import { petById } from '../state.js';
import {
  GENERIC_EXCHANGES, TRAIT_EXCHANGES, FEUD_EXCHANGES, FEUD_TRAIT_EXCHANGES,
  REACTION_SHOTS, DIRECT_ADDRESS, TRAIT_DIRECT, FRAGMENTS, NEIGHBOUR_FRAGMENTS,
  CHORUS_EXCHANGES
} from '../content/dialogue.js';
import {
  MATURE_GENERIC_EXCHANGES, MATURE_TRAIT_EXCHANGES, MATURE_FEUD_EXCHANGES,
  MATURE_FEUD_TRAIT_EXCHANGES, MATURE_REACTION_SHOTS, MATURE_DIRECT_ADDRESS,
  MATURE_TRAIT_DIRECT, MATURE_FRAGMENTS, MATURE_NEIGHBOUR_FRAGMENTS,
  MATURE_CHORUS_EXCHANGES
} from '../content/mature.js';

export const DIALOGUE_KINDS = ['feud', 'trait', 'generic', 'reaction', 'direct', 'fragment', 'chorus'];

export const DIRECT_CATEGORIES = ['bargain', 'guilt', 'lovebomb', 'threat', 'terms', 'confession', 'existential'];

// Relative frequency of each form. Two-handers (trait+generic) dominate deliberately:
// docs/comedy-direction.md puts them at 18% of ALL notes, which makes them the bulk of
// the dialogue budget. Direct address is rare on purpose — "rare and therefore devastating".
export const KIND_WEIGHT = {
  feud: 22, trait: 26, generic: 13, reaction: 12, direct: 12, fragment: 9, chorus: 6
};

const CHORUS_MIN_CAST = 3;

/* ---------------- pools ---------------- */

const BASE_POOLS = {
  generic: GENERIC_EXCHANGES,
  trait: TRAIT_EXCHANGES,
  feud: FEUD_EXCHANGES,
  feudTrait: FEUD_TRAIT_EXCHANGES,
  reaction: REACTION_SHOTS,
  direct: DIRECT_ADDRESS,
  traitDirect: TRAIT_DIRECT,
  fragment: FRAGMENTS,
  neighbourFragment: NEIGHBOUR_FRAGMENTS,
  chorus: CHORUS_EXCHANGES
};

const MATURE_POOLS = {
  generic: GENERIC_EXCHANGES.concat(MATURE_GENERIC_EXCHANGES),
  trait: TRAIT_EXCHANGES.concat(MATURE_TRAIT_EXCHANGES),
  feud: {
    1: FEUD_EXCHANGES[1].concat(MATURE_FEUD_EXCHANGES[1]),
    2: FEUD_EXCHANGES[2].concat(MATURE_FEUD_EXCHANGES[2]),
    3: FEUD_EXCHANGES[3].concat(MATURE_FEUD_EXCHANGES[3])
  },
  feudTrait: FEUD_TRAIT_EXCHANGES.concat(MATURE_FEUD_TRAIT_EXCHANGES),
  reaction: REACTION_SHOTS.concat(MATURE_REACTION_SHOTS),
  direct: DIRECT_ADDRESS.concat(MATURE_DIRECT_ADDRESS),
  traitDirect: TRAIT_DIRECT.concat(MATURE_TRAIT_DIRECT),
  fragment: FRAGMENTS.concat(MATURE_FRAGMENTS),
  neighbourFragment: NEIGHBOUR_FRAGMENTS.concat(MATURE_NEIGHBOUR_FRAGMENTS),
  chorus: CHORUS_EXCHANGES.concat(MATURE_CHORUS_EXCHANGES)
};

export function dialoguePools(state) {
  return isMature(state) ? MATURE_POOLS : BASE_POOLS;
}

function isMature(state) {
  return !!(state && state.settings && state.settings.matureMode);
}

/* ---------------- small helpers ---------------- */

function rnd(rng) { return typeof rng === 'function' ? rng() : Math.random(); }

function choose(arr, rng) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rnd(rng) * arr.length)];
}

// Weighted order without replacement, so a builder that returns null falls through to
// the next-best form instead of dropping the whole call on the floor.
function weightedOrder(pairs, rng) {
  const pool = pairs.slice();
  const out = [];
  while (pool.length) {
    const total = pool.reduce((s, p) => s + p[1], 0);
    let r = rnd(rng) * total;
    let i = 0;
    for (; i < pool.length; i++) {
      r -= pool[i][1];
      if (r < 0) break;
    }
    if (i >= pool.length) i = pool.length - 1;
    out.push(pool[i][0]);
    pool.splice(i, 1);
  }
  return out;
}

export const CHORUS_SPEAKER = 'all of them';

export function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return names[0] + ' and ' + names[1];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function fill(line, names) {
  return String(line)
    .replace(/\{a\}/g, names.a || '')
    .replace(/\{b\}/g, names.b || '')
    .replace(/\{c\}/g, names.c || '')
    .replace(/\{n\}/g, names.n || '')
    .replace(/\{p\}/g, names.p || '');
}

/* ---------------- shelf inspection ---------------- */

export function awakePets(state, now = Date.now()) {
  const date = new Date(now);
  return (state.pets || []).filter(p => state.slots.indexOf(p.id) >= 0 && !isAsleep(p, date));
}

// Unique unordered pairs of adjacent, awake pets. neighborSlots() already confines
// adjacency to a row of the 6-wide grid, so "adjacent" here means physically beside.
export function adjacentPairs(state, now = Date.now()) {
  const date = new Date(now);
  const seen = new Set();
  const out = [];
  (state.slots || []).forEach((id, i) => {
    if (!id) return;
    const a = petById(state, id);
    if (!a || isAsleep(a, date)) return;
    neighborPets(state, i).forEach(b => {
      if (!b || isAsleep(b, date)) return;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      out.push([a, b]);
    });
  });
  return out;
}

// Adjacent pairs that also hold a FEUDS trait collision, each tagged with its arc tier.
export function feudingPairs(state, now = Date.now()) {
  const date = new Date(now);
  return activeFeuds(state)
    .filter(([a, b]) => !isAsleep(a, date) && !isAsleep(b, date))
    .map(([a, b]) => {
      const arc = (state.feudArcs || {})[feudPairKey(a.id, b.id)];
      return { a, b, level: feudTier(arc && arc.level) };
    });
}

export function feudTier(level) {
  const n = Number(level) || 0;
  if (n >= 4) return 3;
  if (n >= 2) return 2;
  return 1;
}

function petsAdjacentTo(state, pet, now) {
  const date = new Date(now);
  const i = (state.slots || []).indexOf(pet.id);
  if (i < 0) return [];
  return neighborPets(state, i).filter(p => p && !isAsleep(p, date));
}

/* ---------------- entry filters ---------------- */

function moodList(entry) {
  if (!entry.mood) return null;
  return Array.isArray(entry.mood) ? entry.mood : [entry.mood];
}

function entryFits(entry, ctx, cast) {
  if (entry.night && !ctx.night) return false;
  const moods = moodList(entry);
  if (moods && !cast.some(p => moods.includes(moodOf(p)))) return false;
  return true;
}

function filterEntries(pool, ctx, cast) {
  const ok = pool.filter(e => entryFits(e, ctx, cast));
  // Never strand a slot: if the night/mood filters emptied the pool, drop the mood
  // constraint before dropping the whole form.
  if (ok.length) return ok;
  return pool.filter(e => !e.night || ctx.night);
}

// Mood-tagged scenes are the ones written for the high-frequency slots — hunger,
// neglect, filth, being fussed. Left unweighted they are a handful of entries in a
// pool of sixty and effectively never land on the shelf state they were written for,
// so a matching mood gets a coin-flip's worth of priority.
function pickEntry(pool, ctx, cast, rng) {
  const eligible = filterEntries(pool, ctx, cast);
  const tagged = eligible.filter(e => e.mood);
  if (tagged.length && rnd(rng) < 0.5) return choose(tagged, rng);
  const untagged = eligible.filter(e => !e.mood);
  return choose(untagged.length ? untagged : eligible, rng);
}

/* ---------------- turn building ---------------- */

function buildTurns(turns, roles, names) {
  return turns.map(([who, line]) => ({
    who,
    speaker: who === 'all' ? CHORUS_SPEAKER : (roles[who] ? roles[who].name : ''),
    line: fill(line, names)
  }));
}

/* ---------------- two-handers ---------------- */

// Every trait scene playable by this specific pair, already oriented so `a` is the pet
// holding pair[0]. Exported because it is also how the caller can ask "is there
// bespoke material for these two?" without drawing one.
export function traitExchangesFor(state, a, b, pool) {
  const entries = pool || dialoguePools(state).trait;
  const out = [];
  entries.forEach(e => {
    const [x, y] = e.pair;
    if (a.traits.includes(x) && b.traits.includes(y)) out.push({ entry: e, a, b });
    else if (b.traits.includes(x) && a.traits.includes(y)) out.push({ entry: e, a: b, b: a });
  });
  return out;
}

function feudTraitExchangesFor(state, a, b, tier, pool) {
  const out = [];
  pool.forEach(e => {
    if ((e.level || 1) > tier) return;
    const [x, y] = e.pair;
    if (a.traits.includes(x) && b.traits.includes(y)) out.push({ entry: e, a, b });
    else if (b.traits.includes(x) && a.traits.includes(y)) out.push({ entry: e, a: b, b: a });
  });
  return out;
}

function makeExchange(kind, entry, a, b, ctx, meta) {
  const names = { a: a.name, b: b.name };
  return {
    kind,
    form: 'two-hander',
    from: kind === 'feud' ? 'observed' : 'overheard',
    tone: kind === 'feud' ? 'feud' : 'note',
    setup: null,
    turns: buildTurns(entry.turns, { a, b }, names),
    cast: [a, b],
    meta: Object.assign({ mature: ctx.mature }, meta || {})
  };
}

/* ---------------- builders ---------------- */

// Gathers every playable scene across every adjacent pair before choosing, rather than
// picking a pair first: choosing the pair first makes a neighbour with one written
// scene repeat that scene as often as a neighbour with eight.
function buildTrait(state, ctx, rng) {
  const matches = [];
  ctx.pairs.forEach(([a, b]) => {
    traitExchangesFor(state, a, b, ctx.pools.trait)
      .filter(m => entryFits(m.entry, ctx, [m.a, m.b]))
      .forEach(m => matches.push(m));
  });
  if (!matches.length) return null;
  const tagged = matches.filter(m => m.entry.mood);
  const m = (tagged.length && rnd(rng) < 0.5) ? choose(tagged, rng) : choose(matches, rng);
  return makeExchange('trait', m.entry, m.a, m.b, ctx, { pair: m.entry.pair.slice() });
}

function buildGeneric(state, ctx, rng) {
  if (!ctx.pairs.length) return null;
  const [a, b] = choose(ctx.pairs, rng);
  const entry = pickEntry(ctx.pools.generic, ctx, [a, b], rng);
  if (!entry) return null;
  return makeExchange('generic', entry, a, b, ctx);
}

function buildFeud(state, ctx, rng) {
  if (!ctx.feuds.length) return null;
  const f = choose(ctx.feuds, rng);
  const bespoke = feudTraitExchangesFor(state, f.a, f.b, f.level, ctx.pools.feudTrait)
    .filter(m => entryFits(m.entry, ctx, [m.a, m.b]));
  if (bespoke.length && rnd(rng) < 0.7) {
    const m = choose(bespoke, rng);
    return makeExchange('feud', m.entry, m.a, m.b, ctx, { level: f.level, pair: m.entry.pair.slice() });
  }
  const tierPool = ctx.pools.feud[f.level] || ctx.pools.feud[1];
  const entry = pickEntry(tierPool, ctx, [f.a, f.b], rng);
  if (!entry) return null;
  return makeExchange('feud', entry, f.a, f.b, ctx, { level: f.level });
}

function buildReaction(state, ctx, rng) {
  if (!ctx.pairs.length || ctx.awake.length < 3) return null;
  const pairs = ctx.pairs.slice();
  shuffle(pairs, rng);
  for (const [a, b] of pairs) {
    // The bystander is preferably somebody physically beside the argument.
    const near = petsAdjacentTo(state, a, ctx.now)
      .concat(petsAdjacentTo(state, b, ctx.now))
      .filter(p => p.id !== a.id && p.id !== b.id);
    const others = near.length ? near : ctx.awake.filter(p => p.id !== a.id && p.id !== b.id);
    if (!others.length) continue;
    const c = choose(others, rng);
    const entry = pickEntry(ctx.pools.reaction, ctx, [a, b, c], rng);
    if (!entry) return null;
    const names = { a: a.name, b: b.name, c: c.name };
    return {
      kind: 'reaction',
      form: 'reaction',
      from: 'observed',
      tone: 'note',
      setup: fill(entry.setup, names),
      turns: buildTurns(entry.turns, { a, b, c }, names),
      cast: [a, b, c],
      meta: { mature: ctx.mature }
    };
  }
  return null;
}

/* ---------------- direct address ---------------- */

// Which registers this pet could plausibly turn round and use on you right now.
export function directCategoriesFor(state, pet, now = Date.now()) {
  const mood = moodOf(pet);
  const night = isNight(new Date(now));
  const out = [];
  if (mood === 'furious') out.push('threat', 'terms', 'guilt', 'guilt');
  else if (mood === 'annoyed') out.push('guilt', 'bargain', 'terms');
  else if (mood === 'content') out.push('lovebomb', 'confession', 'existential');
  else out.push('bargain', 'terms', 'confession', 'existential');
  if ((pet.grudges || 0) >= 5) out.push('threat');
  if ((pet.bond || 0) >= 12 && mood !== 'furious') out.push('lovebomb');
  if (hasTrait(pet, 'thief')) out.push('confession');
  if (night) out.push('confession', 'existential');
  return out;
}

function buildDirect(state, ctx, rng) {
  if (!ctx.awake.length) return null;
  const pet = choose(ctx.awake, rng);
  const neighbours = petsAdjacentTo(state, pet, ctx.now);
  const neighbour = neighbours.length ? choose(neighbours, rng) : null;

  const traitPool = ctx.pools.traitDirect.filter(e =>
    pet.traits.includes(e.trait) && entryFits(e, ctx, [pet]) && !e.needs);
  if (traitPool.length && rnd(rng) < 0.55) {
    const entry = choose(traitPool, rng);
    return makeDirect(entry, pet, null, ctx, { trait: entry.trait });
  }

  const cats = directCategoriesFor(state, pet, ctx.now);
  let pool = ctx.pools.direct.filter(e =>
    cats.includes(e.category) && entryFits(e, ctx, [pet]) && (!e.needs || neighbour));
  if (!pool.length) {
    pool = ctx.pools.direct.filter(e => entryFits(e, ctx, [pet]) && (!e.needs || neighbour));
  }
  const entry = choose(pool, rng);
  if (!entry) return null;
  return makeDirect(entry, pet, entry.needs ? neighbour : null, ctx, { category: entry.category });
}

function makeDirect(entry, pet, neighbour, ctx, meta) {
  const names = { p: pet.name, n: neighbour ? neighbour.name : '' };
  const roles = { p: pet, n: neighbour };
  const angry = meta && (meta.category === 'threat' || meta.category === 'guilt');
  return {
    kind: 'direct',
    form: 'direct',
    from: pet.name,
    tone: angry ? 'angry' : 'note',
    setup: null,
    turns: buildTurns(entry.turns, roles, names),
    cast: neighbour ? [pet, neighbour] : [pet],
    meta: Object.assign({ mature: ctx.mature }, meta || {})
  };
}

/* ---------------- fragments + chorus ---------------- */

function buildFragment(state, ctx, rng) {
  if (!ctx.awake.length) return null;
  const pet = choose(ctx.awake, rng);
  const neighbours = petsAdjacentTo(state, pet, ctx.now);
  const useNeighbour = neighbours.length && rnd(rng) < 0.4;
  const line = useNeighbour
    ? fill(choose(ctx.pools.neighbourFragment, rng), { n: choose(neighbours, rng).name })
    : choose(ctx.pools.fragment, rng);
  if (!line) return null;
  return {
    kind: 'fragment',
    form: 'line',
    from: 'overheard',
    tone: 'note',
    setup: null,
    turns: [{ who: 'p', speaker: pet.name, line }],
    cast: [pet],
    meta: { mature: ctx.mature }
  };
}

function buildChorus(state, ctx, rng) {
  if (ctx.awake.length < CHORUS_MIN_CAST) return null;
  const cast = ctx.awake.slice();
  shuffle(cast, rng);
  const [a, b, c] = cast;
  const entry = pickEntry(ctx.pools.chorus, ctx, [a, b, c], rng);
  if (!entry) return null;
  const names = { a: a.name, b: b.name, c: c.name, all: [a.name, b.name, c.name] };
  return {
    kind: 'chorus',
    form: 'chorus',
    from: 'the shelf',
    tone: 'note',
    setup: null,
    turns: buildTurns(entry.turns, { a, b, c }, names),
    cast: [a, b, c],
    meta: { mature: ctx.mature }
  };
}

const BUILDERS = {
  trait: buildTrait,
  generic: buildGeneric,
  feud: buildFeud,
  reaction: buildReaction,
  direct: buildDirect,
  fragment: buildFragment,
  chorus: buildChorus
};

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(rng) * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/* ---------------- context + entry point ---------------- */

export function dialogueContext(state, now = Date.now()) {
  const awake = awakePets(state, now);
  const pairs = adjacentPairs(state, now);
  return {
    now,
    night: isNight(new Date(now)),
    mature: isMature(state),
    pools: dialoguePools(state),
    awake,
    pairs,
    feuds: feudingPairs(state, now)
  };
}

/* The entry point. Returns a DialogueResult, or null when the shelf has nothing to
   say — an empty shelf, or every pet asleep. `opts`:
     now   ms timestamp (defaults to Date.now())
     kind  force one of DIALOGUE_KINDS; returns null if that form is unavailable
     rng   () => [0,1) for deterministic tests                                   */
export function pickDialogue(state, opts = {}) {
  if (!state || !Array.isArray(state.pets) || !state.pets.length) return null;
  const now = opts.now || Date.now();
  const rng = opts.rng;
  const ctx = dialogueContext(state, now);
  if (!ctx.awake.length) return null;

  if (opts.kind) {
    const build = BUILDERS[opts.kind];
    return build ? build(state, ctx, rng) : null;
  }

  const available = [];
  if (ctx.feuds.length) available.push(['feud', KIND_WEIGHT.feud]);
  if (ctx.pairs.length) {
    available.push(['generic', KIND_WEIGHT.generic]);
    if (ctx.pairs.some(([a, b]) => traitExchangesFor(state, a, b, ctx.pools.trait).length)) {
      available.push(['trait', KIND_WEIGHT.trait]);
    }
    if (ctx.awake.length >= 3) available.push(['reaction', KIND_WEIGHT.reaction]);
  }
  available.push(['direct', KIND_WEIGHT.direct]);
  available.push(['fragment', KIND_WEIGHT.fragment]);
  if (ctx.awake.length >= CHORUS_MIN_CAST) available.push(['chorus', KIND_WEIGHT.chorus]);

  for (const kind of weightedOrder(available, rng)) {
    const result = BUILDERS[kind](state, ctx, rng);
    if (result) return result;
  }
  return null;
}

/* Direct address for one named pet — for a tap-the-pet interaction, or an arrival. */
export function pickDirectAddress(state, pet, opts = {}) {
  if (!state || !pet) return null;
  const now = opts.now || Date.now();
  if (isAsleep(pet, new Date(now))) return null;
  const ctx = dialogueContext(state, now);
  ctx.awake = [pet];
  return buildDirect(state, ctx, opts.rng);
}

/* The scene between two specific pets — trait-specific if one exists, generic if not. */
export function pickExchange(state, a, b, opts = {}) {
  if (!state || !a || !b) return null;
  const now = opts.now || Date.now();
  const ctx = dialogueContext(state, now);
  ctx.pairs = [[a, b]];
  return buildTrait(state, ctx, opts.rng) || buildGeneric(state, ctx, opts.rng);
}

/* ---------------- rendering helpers (still no DOM) ---------------- */

// ['Doreen: I could go another day.', 'Gnash: You are four inches tall.']
export function formatDialogue(result) {
  if (!result) return [];
  const out = result.setup ? [result.setup] : [];
  result.turns.forEach(t => out.push(t.speaker ? t.speaker + ': ' + t.line : t.line));
  return out;
}

// One string for addNote(). Needs `.note { white-space: pre-line }` to lay out.
export function dialogueText(result, sep = '\n') {
  return formatDialogue(result).join(sep);
}
