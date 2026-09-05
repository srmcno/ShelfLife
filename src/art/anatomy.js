// ---------------------------------------------------------------------------
// Anatomy resolver
// ---------------------------------------------------------------------------
// Answers one question for the animation director: "what can this creature
// actually DO?" — so locomotion clips can be chosen from the body a pet has
// rather than hardcoded per creature.
//
// Three sources, in falling order of authority:
//
//  1. An explicit anatomy block — `pet.anatomy`, `pet.art.anatomy`, or
//     `pet.art.creature.anatomy` where a generated pet keeps it — as
//     produced by a parts-based creature generator:
//       { hasLegs, legCount, hasArms, armCount, hasWings, wingCount,
//         hasTail, hasHead, ... }
//     Only the counts/flags listed in FIELDS are read; anything else is
//     ignored, so the block can grow without touching this file.
//
//  2. The stamps a hand-drawn pet was decorated with. A creature wearing
//     tentacles plainly scuttles; one wearing a wing plainly flaps. This is
//     what keeps every pet already saved on a player's shelf interesting
//     without any migration.
//
//  3. Nothing at all — a legless painted blob. It still hops, and simply never
//     gets offered clips it has no body for.
//
// Nothing here imports the creature generator, so this file is safe to use
// before that generator exists: pets without anatomy data resolve to the
// legacy profile and everything keeps working.

// Stamp kinds that imply a limb, and what they imply.
const STAMP_ANATOMY = {
  arms:      { arms: 2 },
  legs:      { legs: 2 },
  tentacles: { legs: 6, gait: 'ooze' },   // it doesn't walk, it pours
  wing:      { wings: 1 },
  tail:      { tails: 1 },
  ears:      { ears: 2 },
  antlers:   { antlers: 2 }
};

// The gaits the CSS knows how to play. A generator may declare its own gait in
// its anatomy block; anything unrecognised falls back to being worked out from
// the limbs, so a new generator gait can never leave a creature unable to move.
export const GAITS = ['walk', 'scuttle', 'ooze', 'flap', 'hop'];

function num(v, fallbackFlag, fallbackCount) {
  if (typeof v === 'number' && isFinite(v) && v > 0) return Math.floor(v);
  return fallbackFlag ? fallbackCount : 0;
}

function anatomyBlock(pet) {
  if (!pet) return null;
  if (pet.anatomy && typeof pet.anatomy === 'object') return pet.anatomy;
  if (pet.art && pet.art.anatomy && typeof pet.art.anatomy === 'object') return pet.art.anatomy;
  // A generated pet keeps the whole creature at art.creature (see state.js's art
  // model) rather than copying its anatomy up a level, so the creature stays the
  // single source of truth. Same contract, one hop deeper. engine/behavior.js
  // reads it from the same place.
  const c = pet.art && pet.art.creature;
  if (c && c.anatomy && typeof c.anatomy === 'object') return c.anatomy;
  return null;
}

// Gait is picked from the legs a creature has, then falls through to wings, and
// finally to the legless hop every painted blob gets.
export function gaitFor(parts) {
  if (parts.legs >= 6) return 'scuttle';
  if (parts.legs >= 1) return 'walk';
  if (parts.wings >= 1) return 'flap';
  return 'hop';
}

// -> { legs, arms, wings, tails, gait, canWalk, canSneak, canHang, canFlap,
//      source: 'anatomy' | 'stamps' | 'none' }
export function resolveMotion(pet) {
  const parts = { legs: 0, arms: 0, wings: 0, tails: 0 };
  let source = 'none';
  let declared = null;

  const a = anatomyBlock(pet);
  if (a) {
    source = 'anatomy';
    parts.legs = num(a.legCount, a.hasLegs, 2);
    parts.arms = num(a.armCount, a.hasArms, 2);
    parts.wings = num(a.wingCount, a.hasWings, 2);
    parts.tails = num(a.tailCount, a.hasTail, 1);
    if (GAITS.indexOf(a.gait) !== -1) declared = a.gait;
    if (a.hasTentacles) declared = declared || 'ooze';
  } else {
    const stamps = (pet && pet.art && pet.art.stamps) || [];
    stamps.forEach(s => {
      const imp = STAMP_ANATOMY[s && s.kind];
      if (!imp) return;
      source = 'stamps';
      if (imp.legs) parts.legs = Math.max(parts.legs, imp.legs);
      if (imp.arms) parts.arms += imp.arms;
      if (imp.wings) parts.wings += imp.wings;
      if (imp.tails) parts.tails += imp.tails;
      if (imp.gait) declared = imp.gait;
    });
  }

  const gait = declared || gaitFor(parts);
  return {
    legs: parts.legs,
    arms: parts.arms,
    wings: parts.wings,
    tails: parts.tails,
    gait,
    canWalk: parts.legs >= 1,
    canSneak: parts.legs >= 1,
    canHang: parts.arms >= 1,
    canFlap: parts.wings >= 1,
    source
  };
}

// ---------------------------------------------------------------------------
// data-part contract
// ---------------------------------------------------------------------------
// Any element inside a sprite may declare itself an animatable limb:
//
//   data-part   required — 'leg' | 'arm' | 'wing' | 'tail' | 'head' | 'ear' |
//                          'antenna' | 'tentacle' | 'jaw' | 'eye'
//   data-index  optional — 0-based index within that part kind. Used to phase
//                          limbs against each other (left/right alternation for
//                          a pair, a travelling wave for six). Defaults to
//                          document order.
//   data-side   optional — 'l' | 'r'. Purely informational today.
//   data-pivot  optional — "x y" inside the element's OWN bounding box (px from
//                          its top-left), naming the joint the limb rotates
//                          around. Applied as transform-origin with
//                          transform-box:fill-box. Omit it and the sensible
//                          default for the part kind is used (see PART_ORIGIN).
//   data-pivot-x / data-pivot-y
//               optional — the better form, and the one src/art/creatures.js
//                          emits: the part group carries NO transform of its own
//                          and its local origin (0,0) IS the joint (an outer
//                          "mount" group does the placement). When these are
//                          present the animator rotates about 0 0 in the part's
//                          own coordinate system and ignores PART_ORIGIN — the
//                          pivot is already exact, so nothing has to be guessed
//                          from a bounding box.
//
// Everything else — which clip plays, how fast, in what phase — is decided by
// the director and applied through classes and custom properties, so a
// generator never has to know about animation.

export const PART_KINDS = ['leg', 'arm', 'wing', 'tail', 'head', 'ear', 'antenna', 'tentacle', 'jaw', 'eye'];

// Default joint per part kind, as a transform-origin (transform-box:fill-box,
// so these are percentages of the element's own bounding box).
export const PART_ORIGIN = {
  leg: '50% 0%',        // hip at the top of the limb
  arm: '50% 0%',        // shoulder
  wing: '10% 40%',      // where it meets the back
  tail: '0% 50%',       // base
  ear: '50% 100%',
  antenna: '50% 100%',
  tentacle: '50% 0%',
  head: '50% 100%',     // neck
  jaw: '50% 0%',
  eye: '50% 50%'
};

// Phase offset (in cycles, -1..0) for one limb of a set, so a pair alternates
// and a six-legged creature ripples instead of stomping in unison.
export function limbPhase(kind, index, count) {
  if (kind === 'wing') return 0;                   // wings beat together
  if (count <= 1) return 0;
  if (count === 2) return index % 2 ? -0.5 : 0;
  return -(index % count) / count;
}
