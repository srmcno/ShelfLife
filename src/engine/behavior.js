import { artPersonality } from './personality.js';
import { relationship } from './stories.js';
/* ================= BEHAVIOUR =================
   The simulation-depth layer: what the pets do when nobody is telling them to.

   Motive answers "why did it move", anatomy answers "how could it possibly".

   MOTIVE. Three things pull a pet around the shelf:
     1. Props it loves or cannot stand (TRAIT_PROP_AFFINITY).
     2. Neighbors it is bonded to, or feuding with.
     3. Whether it wants company at all (SOCIAL_PULL).
   Those feed one number — slotScore() — computed for the slot a pet is standing
   in and for every slot it could reach. A pet only moves when some other slot
   beats its current one by MOVE_THRESHOLD, so movement is always explainable,
   and a pet that has reached a good spot stops moving.

   ANATOMY. capabilitiesOf(pet) turns the creature generator's anatomy block
   into what the pet is physically able to do: legs decide how far it walks,
   arms let it climb between shelf rows and reach over a neighbor, wings let it
   fly to a free slot, no limbs at all means it oozes one slot at a time and
   makes its mischief in place. See capabilitiesOf() for the full contract and
   the fallback used by every pet drawn before the generator existed.

   All data lives in this file on purpose: src/content/* is owned elsewhere and
   is being rewritten. Every lookup here degrades to "skip it" when a trait id
   or prop kind is not in the current content, and never throws.

   No DOM. Every function takes `state` first and mutates only `state`. */

import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS } from '../content/props.js';
import { FEUDS } from '../content/feuds.js';
import { hasTrait, isAsleep, isNight, moodOf, neighborSlots } from './tick.js';
import { feudPairKey, fileGrudge } from './achievements.js';
import { pick, clamp, addNote, petById, propById } from '../state.js';

/* ---------------- tuning ---------------- */

export const ROW_WIDTH = 6;             // matches neighborSlots() in tick.js
export const MOVE_THRESHOLD = 2.2;      // how much better a slot must be before a pet bothers
export const BASE_INERTIA = 1.5;        // ... on top of simply not wanting to get up
export const PROP_WEIGHT = 1.5;         // affinity points -> slot points
export const STEP_COST = 0.8;           // per extra slot travelled
export const CLIMB_COST = 1.2;          // hauling yourself to another shelf
export const FLY_COST = 1;
export const CLAIM_AFFINITY = 2;        // affinity at which a pet stops sharing
export const MOVE_COOLDOWN_MS = 5 * 60 * 1000;
export const PASS_INTERVAL_MS = 4 * 60 * 1000;
export const CLAIM_MS = 6 * 60 * 60 * 1000;
export const USE_COOLDOWN_MS = 45 * 60 * 1000;   // the same pet, the same prop, twice: nobody needs the note
export const REFILL_MS = 40 * 60 * 1000;
export const DEPLETE_AT = 2;            // uses before a bowl / ball of yarn is spent
export const MISCHIEF_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const CATCHUP_AFTER_MS = 90 * 60 * 1000;
export const MAX_CATCHUP_PASSES = 3;

/* ---------------- anatomy ----------------

   The creature generator (src/art/creatures.js, built elsewhere) will hang an
   anatomy block off generated pets. This layer reads it through anatomyOf()
   and never imports the generator, so it works before, during and after that
   file lands. Recognised keys, all optional:

     hasLegs, legCount, legStyle ('stubby'|'spindly'|'bird'|'many'|'tentacles'|...),
     hasArms, armCount, armReach, hasWings, hasTail, hasTentacles, isLimbless,
     heightClass, gait ('walk'|'scuttle'|'ooze'|'hop'),
     can: { walk, scuttle, hop, sneak, hang, climb, glide, wag }

   Where the generator states a capability outright (the `can` block, `gait`),
   that wins; everything else is inferred from the limbs, and anything missing
   falls back to DEFAULT_ANATOMY — a plain two-stubby-legged creature, which is
   what every freehand-drawn pet on an existing save gets.
   The generator's block is read from pet.art.creature.anatomy; anatomyOf()
   also accepts pet.art.anatomy and pet.anatomy. */

export const DEFAULT_ANATOMY = {
  hasLegs: true, legCount: 2, legStyle: 'stubby',
  hasArms: false, armCount: 0,
  hasWings: false, hasTail: false, hasTentacles: false,
  isLimbless: false, heightClass: 'medium'
};

const LONG_LEGS = /long|spindly|stilt|spider|bird|many|thin/i;

function num(v, fallback) {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

export function anatomyOf(pet) {
  const art = pet && pet.art;
  let raw = (art && (art.anatomy || (art.creature && art.creature.anatomy))) || (pet && pet.anatomy);
  if (!raw && art && Array.isArray(art.stamps)) {
    const kinds = new Set(art.stamps.map(s => s.kind));
    if (['arms', 'legs', 'wing', 'tentacles'].some(k => kinds.has(k))) raw = {
      hasArms: kinds.has('arms'), armCount: kinds.has('arms') ? 2 : 0,
      hasLegs: kinds.has('legs') || kinds.has('tentacles'), legCount: kinds.has('tentacles') ? 6 : kinds.has('legs') ? 2 : 0,
      hasWings: kinds.has('wing'), hasTail: kinds.has('tail'), hasTentacles: kinds.has('tentacles')
    };
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ANATOMY };
  const a = { ...DEFAULT_ANATOMY, ...raw };
  // A generator may describe a limb with the flag, the count, or both. Reconcile
  // here so everything downstream can trust the flags.
  if (raw.hasLegs === undefined && num(raw.legCount, 0) > 0) a.hasLegs = true;
  if (raw.hasArms === undefined && num(raw.armCount, 0) > 0) a.hasArms = true;
  if (raw.hasLegs === false && raw.legCount === undefined) a.legCount = 0;
  if (raw.hasArms === true && raw.armCount === undefined) a.armCount = 2;
  return a;
}

/* What this body can actually do. Everything downstream asks this, never the
   raw anatomy, so new anatomy keys only ever need wiring here.

     walk   can shift under its own power at all
     range  how many slots along its row one move may cover
     stride covers more than one slot at a time, and it shows
     climb  can move vertically between shelf rows (arms or tentacles)
     reach  can act on a slot two along, over the top of a neighbor
     fly    can cross to a free slot anywhere
     ooze   no limbs: one slot at a time, slowly, and mischief in place
     sneak  can move without being seen doing it
     hang   can hang off the front edge of the shelf
     tail   has something to knock things over with */
export function capabilitiesOf(pet) {
  const a = anatomyOf(pet);
  const can = (a.can && typeof a.can === 'object') ? a.can : {};
  const stated = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
  const tentacles = !!a.hasTentacles;
  const limbless = !!a.isLimbless || (!a.hasLegs && !a.hasArms && !a.hasWings && !tentacles);
  const legCount = num(a.legCount, 2);
  const legs = !!a.hasLegs && !limbless;
  const arms = !!a.hasArms || tentacles;
  const wings = !!a.hasWings;
  const long = LONG_LEGS.test(String(a.legStyle || ''));
  const armReach = num(a.armReach, 20);
  const oozes = stated(a.gait === 'ooze' ? true : undefined, limbless);
  let range = 1;
  if (can.scuttle === true) range = 5;
  else if (legs) range = (legCount >= 4 || long) ? 5 : 2;
  else if (tentacles || wings) range = 2;
  if (oozes || limbless) range = 1;
  return {
    anatomy: a,
    walk: true,
    range,
    stride: range >= 3,
    climb: stated(can.climb, arms),
    reach: arms && armReach >= 12,
    fly: stated(can.glide, wings),
    ooze: oozes,
    sneak: stated(can.sneak, tentacles || limbless || long || legCount >= 6),
    hang: stated(can.hang, arms),
    tail: !!a.hasTail
  };
}

/* ---------------- personality data ----------------

   TRAIT_PROP_AFFINITY[traitId][propKind] = pull, roughly -3..+3.
   Positive: the pet gravitates to it and will eventually try to own it.
   Negative: the pet resents it and will move away from it.
   Ids that no longer exist in content are skipped, not an error. */

export const TRAIT_PROP_AFFINITY = {
  spiteful:    { box: 3, mirror: 1, musicbox: -1, mousetrap: 2 },
  damp:        { tub: 3, plant: 2, fern: 1, mat: 1, bell: -2, cauldron: 2, mousetrap: -1, teacup: 1 },
  management:  { box: 2, trophy: 1, board: -1, hourglass: 2, teacup: 2 },
  loadbearing: { bell: 2, yarn: -1, globe: -1, coffinbed: -2, mousetrap: -2 },
  haunted:     { mirror: 3, board: 3, urn: 3, candle: 2, skull: 2, clock: 2, phone: 2, lamp: -2, lantern: 2, cauldron: 2, hourglass: 1, headstone: 2 },
  theatrical:  { mirror: 3, musicbox: 2, trophy: 1, box: -1 },
  nocturnal:   { lamp: -3, candle: 2, coffinbed: 2, globe: 1, lantern: -2, hourglass: 1, teacup: -1 },
  magpie:      { globe: 3, mirror: 2, bell: 2, birdcage: 2, trophy: 1, clock: 1, fern: -1, lantern: 1, jar: 2, mousetrap: 2 },
  unblinking:  { mirror: 3, skull: 2, globe: 1, bell: 1, jar: 1 },
  sugar:       { bowl: 3, fern: -1, plant: -1, cauldron: 1, jar: -1, headstone: -1, mousetrap: 2 },
  complaints:  { box: 3, lamp: 1, mirror: -1, teacup: 1 },
  terminal:    { coffinbed: 3, urn: 3, candle: 2, skull: 1, clock: 1, trophy: -1, jar: 1, hourglass: 3, headstone: 3 },
  clean:       { tub: 3, bell: 2, bowl: -1, fern: -2, plant: -2, cauldron: -2, jar: -3, mousetrap: -1 },
  feral:       { yarn: 3, bowl: 2, mat: 2, fern: 1, tub: -3, bell: -3, birdcage: -3, cauldron: 1, hourglass: -1, mousetrap: 2, teacup: -3 },
  cult:        { candle: 3, board: 3, skull: 2, urn: 2, mirror: 1, lantern: 2, cauldron: 3, headstone: 1 },
  doom:        { board: 2, clock: 2, mirror: 1, candle: 1, urn: 1, globe: -1, lantern: 1, cauldron: 2, hourglass: 3 },
  clingy:      { coffinbed: 2, lamp: 2, phone: 2, musicbox: 1, mat: 1, bell: -2, lantern: 2, mousetrap: -2, teacup: 2 },
  taxidermy:   { skull: 3, trophy: 3, urn: 2, birdcage: 2, fern: 1, plant: 1, jar: 3, headstone: 1 },
  amnesiac:    { globe: 2, mirror: 2, board: 1, box: -1, hourglass: -2 },
  gossip:      { phone: 3, board: 2, box: 2, mirror: 1, clock: 1, bell: -1, teacup: 2 },
  ancient:     { skull: 3, urn: 3, board: 2, clock: 2, musicbox: 1, candle: 1, globe: -1, phone: -2, cauldron: 1, jar: 2, hourglass: 2, headstone: 2, teacup: 1 },
  glitter:     { globe: 3, mirror: 2, tub: -2, jar: -1, headstone: -2 },
  litigious:   { box: 3, board: 1, mirror: -1, hourglass: 1 },
  narcissist:  { mirror: 3, trophy: 2, globe: 1, box: -1, headstone: 2 },
  paranoid:    { bell: 2, skull: 1, clock: 1, board: -2, mirror: -2, phone: -3, lantern: 2, jar: 1, mousetrap: 3 },
  influencer:  { mirror: 3, lamp: 2, globe: 2, skull: -1, lantern: 1, jar: -2, headstone: -1 },
  landlord:    { mat: 3, trophy: 2, coffinbed: 1, box: 1, bowl: 1, clock: 1, headstone: 1, mousetrap: 2, teacup: 2 },
  hoarder:     { box: 3, fern: 2, globe: 2, yarn: 2, plant: 1, cauldron: 1, jar: 2, mousetrap: 1 },
  martyr:      { coffinbed: 2, candle: 2, mirror: 1, musicbox: -1, hourglass: 1, headstone: 3, teacup: 2 },
  revisionist: { board: 1, box: 1, mirror: -2 },
  cryptid:     { fern: 3, plant: 2, birdcage: 2, globe: 1, mirror: -2, phone: -2, lamp: -3, lantern: -3, mousetrap: 1, teacup: -2 },
  closer:      { box: 2, trophy: 2, board: 1, hourglass: 1 },
  doomscroll:  { mirror: 2, globe: 2, board: 1, lamp: -1, lantern: -1 },
  freegan:     { bowl: 3, fern: 2, plant: 1, tub: -1, cauldron: 2, mousetrap: 3 },
  astrology:   { candle: 3, board: 2, globe: 2, mirror: 1, lantern: 2, cauldron: 3 },
  witness:     { board: 2, box: 2, mirror: 2, bell: 1, lantern: 2 },
  steward:     { box: 3, bowl: 2, trophy: -1 },
  critic:      { bowl: 3, box: 2, plant: -1, cauldron: -1, mousetrap: 1, teacup: 2 },
  napoleon:    { trophy: 3, coffinbed: 2, board: 1, bell: -1 },
  prophet:     { board: 3, candle: 3, skull: 2, globe: 1, lantern: 2, cauldron: 2 },
  cursed:      { mirror: 2, board: 2, candle: 1, bell: -2, cauldron: 2 },
  socialite:   { musicbox: 3, phone: 3, mirror: 2, mat: 2, bowl: 1, coffinbed: -1, jar: -1, headstone: -2, teacup: 2 },
  minimalist:  { bell: 2, skull: 1, birdcage: 1, mat: -1, clock: -2, fern: -2, yarn: -2, trophy: -2, box: -3, globe: -3, cauldron: -2, jar: -3, hourglass: -1, mousetrap: -1 },
  timeshare:   { coffinbed: 2, trophy: 1, box: 1, board: -1, mousetrap: -1 },
  nihilist:    { candle: 2, coffinbed: 2, globe: 1, board: -2, box: -2, hourglass: 2, headstone: 2 },
  method:      { mirror: 3, trophy: 2, skull: 2, board: 1, headstone: 2 },
  undertaker:  { jar: 3, headstone: 3, urn: 2, coffinbed: 2, skull: 1 },
  mourner:     { headstone: 3, hourglass: 2, urn: 2, candle: 2, musicbox: -1 },
  bones:       { jar: 3, skull: 3, headstone: 2, trophy: 2 },
  executor:    { hourglass: 2, headstone: 1, box: 2, urn: 1 },
  heirloom:    { teacup: 3, headstone: 2, clock: 2, mirror: 1, globe: -1 },
  auditor:     { jar: 2, hourglass: 2, box: 3, clock: 1 },
  insomniac:   { hourglass: 2, lantern: 1, clock: 2, coffinbed: -3 },
  etiquette:   { teacup: 3, mat: 2, jar: -2, mousetrap: -2, bowl: -1 },
  swarm:       { mousetrap: 2, fern: 2, jar: 1, bell: -2 },
  fullname:    { teacup: 2, box: 2, board: 1 },
  lifecoach:   { trophy: 3, mirror: 2, teacup: 1, hourglass: 1, coffinbed: -2 },
  understudy:  { mirror: 2, trophy: 2, musicbox: 1, board: 1, box: -1 },
  reflection:  { mirror: 3, globe: 2, bell: 1, lamp: -1, jar: 1 },
  hummer:      { musicbox: 3, bell: 2, phone: 1, clock: 1, mousetrap: -1 },
  bitey:       { yarn: 2, bowl: 2, trophy: 1, mousetrap: -2, teacup: -1, birdcage: 1 },
  fungal:      { fern: 3, plant: 2, cauldron: 2, jar: 1, tub: -2, lamp: -1, lantern: -1 },
  porcelain:   { teacup: 3, bell: 2, mat: 1, mirror: 1, mousetrap: -3, yarn: -1, cauldron: -1 },
  physician:   { jar: 2, hourglass: 2, box: 1, skull: 1, teacup: 1, cauldron: -1 },
  sleepwalker: { coffinbed: 3, mat: 2, candle: 1, hourglass: 1, bell: -2, mousetrap: -2 }
};

// Wanting to be near others (positive) or emphatically not (negative).
export const SOCIAL_PULL = {
  clingy: 2.5, socialite: 2, gossip: 1.5, influencer: 1.5, closer: 1.5,
  steward: 1, martyr: 1, damp: 1, sugar: 0.5,
  minimalist: -2, cryptid: -2, unblinking: -1.5, method: -1.5, paranoid: -1.5,
  nihilist: -1, ancient: -1, spiteful: -1, loadbearing: -0.5
};

// How hard a pet is to shift out of a spot it already occupies.
export const ROOTEDNESS = {
  loadbearing: 4, landlord: 2, hoarder: 2, method: 1.5, ancient: 1, napoleon: 1,
  cryptid: -2, cult: -1.5, clingy: -1.5, feral: -1.5, socialite: -1.5, magpie: -1
};

// What using a prop actually does. Negative gain = the prop makes it worse,
// which is exactly why some of them keep going back to it.
const DEFAULT_USE = { need: 'fuss', gain: 6 };
export const PROP_USE = {
  bowl:      { need: 'food',  gain: 15, deplete: true },
  tub:       { need: 'clean', gain: 16 },
  lamp:      { need: 'fuss',  gain: 8 },
  yarn:      { need: 'fuss',  gain: 11, deplete: true },
  musicbox:  { need: 'fuss',  gain: 12 },
  candle:    { need: 'fuss',  gain: 8 },
  fern:      { need: 'clean', gain: -8 },
  mirror:    { need: 'fuss',  gain: -7 },
  skull:     { need: 'fuss',  gain: 7 },
  coffinbed: { need: 'fuss',  gain: 13 },
  bell:      { need: 'clean', gain: 11 },
  globe:     { need: 'fuss',  gain: 9 },
  trophy:    { need: 'fuss',  gain: 7 },
  board:     { need: 'fuss',  gain: 8 },
  box:       { need: 'fuss',  gain: 12 },
  plant:     { need: 'clean', gain: 7 },
  mat:       { need: 'fuss',  gain: 7 },
  clock:     { need: 'fuss',  gain: 5 },
  phone:     { need: 'fuss',  gain: 13 },
  birdcage:  { need: 'fuss',  gain: -6 },
  urn:       { need: 'fuss',  gain: 7 },
  lantern:   { need: 'fuss',  gain: 9 },
  cauldron:  { need: 'food',  gain: 10, deplete: true },
  jar:       { need: 'fuss',  gain: 5 },
  hourglass: { need: 'fuss',  gain: -5 },
  headstone: { need: 'fuss',  gain: 7 },
  mousetrap: { need: 'fuss',  gain: -6 },
  teacup:    { need: 'fuss',  gain: 10 }
};

/* ---------------- lines ----------------
   {p} the pet, {n} the other pet, {m} whoever got reached over, {q} a prop. */

const MOVE_LINES = {
  'prop-love': [
    'Moved to be nearer the {q}. Denies moving.',
    'Has relocated toward the {q}. Says it was always going to end up here.',
    'Took the spot beside the {q}. Waited until nobody was looking, then took it anyway.'
  ],
  'prop-need': [
    'Has moved in on the {q}. It is not subtle and it is not sorry.',
    'Relocated to within reach of the {q}. Hunger has made it honest.',
    'Crossed two slots to reach the {q}. It took most of the afternoon.',
    'Has stationed itself an inch from the {q} and stopped pretending otherwise.'
  ],
  'prop-hate': [
    'Moved away from the {q}. Four inches. Facing it the whole time.',
    'Has put a slot between itself and the {q}. Calls this "boundaries."',
    'Relocated. The {q} was the reason. It insists the {q} was not the reason.'
  ],
  flee: [
    'Has moved away from {n}. Says the light was better over here.',
    'Put a slot between itself and {n}. Neither will be discussing it.',
    'Relocated rather than continue the conversation with {n}.'
  ],
  ally: [
    'Moved next to {n}. Neither of them acknowledged it.',
    'Has taken the spot beside {n}. It was available. That is the official reason.',
    'Sat down next to {n} and stayed there. This is apparently a friendship now.'
  ],
  solitude: [
    'Has moved to the empty end of the shelf. Wanted, it says, "a moment."',
    'Relocated somewhere with nobody on either side. It looks relieved.',
    'Removed itself from the group. The group has not noticed.'
  ],
  company: [
    'Moved into the busy end. Nobody invited it. Nobody stopped it.',
    'Has relocated closer to everyone else and is being very casual about it.',
    'Has moved two slots toward the noise and settled at the edge of it.'
  ],
  storm: [
    'Moved itself. Loudly. The move took four seconds and made a point.',
    'Changed spots out of pure spite. It looks better over there anyway.',
    'Left its slot at speed. Four inches at speed is not very fast.'
  ],
  restless: [
    'Is somewhere else now. There was no announcement.',
    'Has moved one slot along, for no reason it has offered.',
    'Is in a different square. The dust in the old one has not settled.'
  ]
};

// Appended to a move note when how it got there is worth a sentence.
const MEANS_LINES = {
  climb: [
    'It climbed. Hand over hand, up the side, in full view of everyone.',
    'Used the arms for that. It has arms. This is what they are for.',
    'Climbed down from the shelf above without using the front. Nobody asked it to explain.'
  ],
  fly: [
    'It flew. Briefly, badly, but it flew.',
    'There was a short flight involved. Nobody is comfortable discussing it.'
  ],
  ooze: [
    'It took the long way, having no legs to speak of.',
    'The trip took most of the afternoon. There were no legs involved.'
  ],
  stride: [
    'Covered the distance far too quickly. Too many legs.',
    'Crossed the shelf without appearing to hurry. The legs did that.'
  ]
};

// Used instead of a move line when the move was not witnessed.
const SNEAK_LINES = {
  prop: [
    'It is not where you left it. It is beside the {q} now. Nobody saw it move.',
    'Was over there last night. Is next to the {q} this morning. There is no footage.'
  ],
  pet: [
    'It is not where you left it. It is next to {n} now. {n} has no comment.',
    'Nobody saw it move. It is beside {n} and behaving as though it always was.'
  ],
  plain: [
    'It is not where you left it. Nobody saw it move.',
    'Somewhere between last night and this morning it changed places. Quietly.'
  ]
};

const USE_LINES = {
  food: [
    'Ate from the {q}. Stopped well after it was reasonable to stop.',
    'Has been at the {q} again. Maintains it found it that way.',
    'Worked its way through the {q} without pausing or making eye contact.',
    'Was at the {q} for some time. Came away heavier and no more pleasant.'
  ],
  clean: [
    'Used the {q}. Came back cleaner and considerably more smug.',
    'Spent a while at the {q}. Wants this noted somewhere permanent.',
    'Submitted to the {q}. Complained throughout. Went back an hour later.',
    'Emerged from the {q} presentable. None of the others have mentioned it.'
  ],
  fuss: [
    'Spent an hour with the {q}. Seems steadier. Will not credit the {q}.',
    'Has been sitting with the {q}. Nothing was achieved. It was enough.',
    'Passed the afternoon at the {q}. Reports that it is "fine, actually."',
    'Went quiet next to the {q} for a long time. Came back almost cheerful.'
  ],
  worse: [
    'Spent time with the {q} and came back worse. It will do this again tomorrow.',
    'Went to the {q} for comfort. The {q} does not do comfort. It stayed anyway.',
    'Sat with the {q} until it felt considerably worse. Called the visit useful.'
  ]
};

const REACH_LINES = [
  'Reached right over {m} to do it. {m} allowed this.',
  'Did not get up. Simply reached past {m}. The arms are longer than they look.',
  'Got at it without leaving its slot. {m} was in the way and is now underneath.',
  'Extended over {m} by about four inches and helped itself.',
  'Leaned across {m} rather than walk two slots. {m} has not moved since.'
];

const CLAIM_LINES = [
  'Has claimed the {q}. There was no vote.',
  'Is on the {q} and will not be moved. This is its {q} now.',
  'Has annexed the {q}. Others may look at it.',
  'Has been sitting on the {q} for six hours and has left a mark on it.',
  'Is four inches tall and has taken the whole {q}.',
  'Has slept on the {q} two nights running. That is how this starts.',
  'Will not come off the {q}. You can lift it off. It goes back.',
  'Has arranged itself across the {q} so that no part of it is free.'
];

const DRAG_LINES = [
  'Dragged the {q} round to its own side. {n} watched the entire operation and said nothing.',
  'Has moved the {q} out of {n}\'s reach. It took some doing. Apparently it was worth it.',
  'Relocated the {q}. {n} now has an excellent view of {p}\'s back.'
];

const BLOCKED_LINES = [
  'Went to the {q}. {n} was already on it. Came back.',
  'Waited near the {q} for its turn. {n} does not believe in turns.',
  'Stood one inch from the {q} until {n} looked up. {n} did not look up.',
  'Could not get on the {q}. Sat where it would be seen not getting on the {q}.',
  'Has been queueing for the {q}. The queue is one thing long and it is {n}.'
];

const CONTEST_LINES = [
  '{p} and {n} both reached the {q}. Only {p} is still at the {q}.',
  '{p} and {n} had a disagreement about the {q}. {p} won it. {n} is keeping the receipt.',
  'There was an incident at the {q}. {p} is not discussing it. {n} is discussing it constantly.'
];

const EMPTY_LINES = [
  'Empty again. {p} was the last one near it and has no comment.',
  'Cleaned out. {p} was the nearest thing to it and is four inches tall.',
  'Nothing left. There are prints in it and they are {p}-sized.',
  'Empty, and warm on the inside, and {p} is nearby looking elsewhere.'
];

const THEFT_LINES = [
  'Took food from {n}. {n} is aware.',
  'Helped itself to {n}\'s share. There is a witness. The witness is {n}.',
  'Ate something that was accounted for. {n} was doing the accounting.',
  'Carried a crumb the size of its own head away from {n}.',
  'Took one crumb from {n}, waited, then took the rest.',
  'Ate {n}\'s and then stood in {n}\'s slot to finish it.',
  'Has {n}\'s dinner. Has had it for some time. {n} is still looking.',
  'Robbed {n} at four inches and did not hurry once.'
];

const REACH_THEFT_LINES = [
  'Reached over {m} to get at {n}\'s food. {m} said nothing. {m} is complicit now.',
  'Did not need to get up to rob {n}. Simply extended, over {m}, and took it.',
  'Reached over {m} rather than walk round it. {n} is one crumb down.',
  'Extended across {m} and took {n}\'s. {m} has been very still since.'
];

const AVERSION_LINES = [
  'Has been glaring at the {q} for an hour. The {q} is winning.',
  'Would like the {q} moved. It has mentioned this. Repeatedly.',
  'Has put half an inch between itself and the {q}. That is all the room there is.',
  'Sits with its back to the {q} and checks on it.',
  'Has been leaning away from the {q} so long it has set that way.'
];

// Anatomy-flavoured mischief: things to do without going anywhere.
const MISCHIEF_LINES = {
  hang: [
    'Is hanging off the front edge of the shelf by both arms. Says this is fine.',
    'Spent the afternoon dangling from the shelf lip by both arms. Hours.',
    'Hung upside down over the drop for a while. It looks better from there, apparently.'
  ],
  nudge: [
    'Rolled into the {q}. The {q} is now where {p} was. Nobody is claiming responsibility.',
    'Leaned on the {q} until the {q} was somewhere else. No legs were required.',
    'Moved the {q} four inches by lying against it for an afternoon.',
    'Put its whole weight into the {q}. Its whole weight is not very much.'
  ],
  knock: [
    'Knocked the {q} over with the tail. Insists the tail acted alone.',
    'The {q} went over. The tail was in the area. The tail has no comment.',
    'The {q} is on its side. There is one small print on the upper surface.',
    'Took the {q} over the edge with it and came back up without it.'
  ],
  lurk: [
    'Is closer than you left it. It has not moved. It is closer.',
    'Has not moved all day and is nonetheless in a slightly different place.',
    'Was facing the wall this morning. Is facing you now. Nothing happened in between.',
    'Has rotated ninety degrees since breakfast. Denies the existence of breakfast.',
    'Practised looking innocent. Pulled a muscle it refuses to identify.',
    'Drew a chalk outline around a crumb. The crumb got up and left.',
    'Is stalking a dust bunny. Both parties have stopped for lunch.',
    'Has hidden behind something smaller than itself. Confidence is doing most of the work.',
    'Held a minute of silence for a biscuit. Could only manage twelve seconds.',
    'Has a getaway route. It ends at the other end of the shelf.',
    'Made a little grave for its last good idea. Left room beside it.',
    'Tried to tiptoe without lifting anything. Somehow looked more suspicious.'
  ]
};

const CATCHUP_LINES = [
  'The shelf is not arranged the way you left it. Everything is an inch off.',
  'Two things have swapped slots. The dust under both has been swept.',
  'Something was dragged the length of the shelf and dragged back.',
  'The gaps between them are all the same width now. They were not before.',
  'Everything is facing the door. It was facing the room when you left.'
];

/* ---------------- safe content lookups ---------------- */

export function propName(kind) {
  const p = PROPS && PROPS[kind];
  return (p && p.name) || String(kind || 'thing');
}

function knownTrait(id) {
  return !!(TRAIT_BY_ID && TRAIT_BY_ID[id]);
}

function knownProp(kind) {
  return !!(PROPS && PROPS[kind]);
}

function traitSum(pet, table) {
  if (!pet || !Array.isArray(pet.traits)) return 0;
  let n = 0;
  pet.traits.forEach(id => {
    if (!knownTrait(id)) return;               // content dropped this trait: skip
    const w = table[id];
    if (typeof w === 'number') n += w;
  });
  return n;
}

function flag(pet, key) {
  return Array.isArray(pet && pet.traits) ? hasTrait(pet, key) : false;
}

function safeAsleep(pet, now) {
  return Array.isArray(pet && pet.traits) ? isAsleep(pet, new Date(now)) : false;
}

function safeMood(pet) {
  return pet && pet.needs ? moodOf(pet) : 'fine';
}

function nameOf(x) { return (x && x.name) || null; }

function fill(text, subs = {}) {
  return String(text)
    .replace(/\{p\}/g, nameOf(subs.p) || 'It')
    .replace(/\{n\}/g, nameOf(subs.n) || 'somebody')
    .replace(/\{m\}/g, nameOf(subs.m) || 'somebody')
    .replace(/\{q\}/g, propName(subs.q));
}

function rowOf(index) { return Math.floor(index / ROW_WIDTH); }

/* ---------------- personality readouts ---------------- */

// How much this pet is drawn to (or repelled by) a kind of prop.
export function affinityFor(pet, kind) {
  if (!kind || !knownProp(kind)) return 0;     // content dropped this prop: skip
  if (!pet || !Array.isArray(pet.traits)) return 0;
  let n = 0;
  pet.traits.forEach(id => {
    if (!knownTrait(id)) return;
    const m = TRAIT_PROP_AFFINITY[id];
    if (!m) return;
    const w = m[kind];
    if (typeof w === 'number') n += w;
  });
  return n;
}

// Positive: wants neighbors. Negative: wants the empty end of the shelf.
export function socialPull(pet) {
  return clamp(traitSum(pet, SOCIAL_PULL), -3, 3);
}

// How much better somewhere else has to be before this pet will get up.
export function inertiaOf(pet) {
  let n = BASE_INERTIA + traitSum(pet, ROOTEDNESS);
  if (flag(pet, 'wanderer')) n -= 1.5;
  if (safeMood(pet) === 'furious') n -= 3;
  if (capabilitiesOf(pet).ooze) n += 2;        // nothing to walk on: moving is a whole thing
  return Math.max(0, n);
}

// Spindly, many-legged things are up and about far more often than blobs.
export function moveCooldownFor(pet) {
  const caps = capabilitiesOf(pet);
  if (caps.ooze) return MOVE_COOLDOWN_MS * 2;
  if (caps.stride || caps.fly) return MOVE_COOLDOWN_MS * 0.6;
  return MOVE_COOLDOWN_MS;
}

export function petsFeud(a, b) {
  if (!a || !b || !Array.isArray(a.traits) || !Array.isArray(b.traits)) return false;
  return (Array.isArray(FEUDS) ? FEUDS : []).some(pair => {
    if (!Array.isArray(pair) || pair.length < 2) return false;
    return (a.traits.includes(pair[0]) && b.traits.includes(pair[1])) ||
           (a.traits.includes(pair[1]) && b.traits.includes(pair[0]));
  });
}

/* ---------------- behaviour bookkeeping ----------------
   Lives on state.behavior so old saves need no migration: it is created on
   first read and serialises with the rest of the save. */

export function behaviorState(state) {
  if (!state.behavior || typeof state.behavior !== 'object') state.behavior = {};
  const b = state.behavior;
  if (typeof b.lastRun !== 'number') b.lastRun = 0;
  if (!b.claims || typeof b.claims !== 'object') b.claims = {};
  if (!b.props || typeof b.props !== 'object') b.props = {};
  return b;
}

function propRecord(state, propId) {
  const b = behaviorState(state);
  const rec = b.props[propId];
  if (!rec || typeof rec !== 'object') b.props[propId] = { uses: 0, emptyUntil: 0, touched: {} };
  else if (!rec.touched || typeof rec.touched !== 'object') rec.touched = {};
  return b.props[propId];
}

// Records that this pet has had its go at this prop — successful, blocked or
// disappointed. Either way it should not be back within the hour.
function touchProp(state, pet, propId, now) {
  propRecord(state, propId).touched[pet.id] = now;
}

export function isSpent(state, propId, now = Date.now()) {
  const rec = behaviorState(state).props[propId];
  return !!(rec && rec.emptyUntil > now);
}

// True while this pet has recently had its turn with this prop — stops one
// pet narrating the same bowl every pass.
export function usedRecently(state, pet, propId, now = Date.now()) {
  const rec = behaviorState(state).props[propId];
  const at = rec && rec.touched && rec.touched[pet.id];
  return !!(at && now - at < USE_COOLDOWN_MS);
}

export function depleteProp(state, propId, now = Date.now()) {
  const rec = propRecord(state, propId);
  rec.uses = 0;
  rec.emptyUntil = now + REFILL_MS;
}

// The pet currently hogging a prop, or null. Claims lapse on their own, and
// the moment the claimant stops being adjacent to the prop.
export function claimantOf(state, propId, now = Date.now()) {
  const b = behaviorState(state);
  const c = b.claims[propId];
  if (!c) return null;
  const pet = petById(state, c.by);
  const pi = pet ? state.slots.indexOf(pet.id) : -1;
  const qi = state.slots.indexOf(propId);
  const adjacent = pi >= 0 && qi >= 0 && neighborSlots(pi, state.slots.length).indexOf(qi) >= 0;
  if (!pet || !adjacent || now - (c.at || 0) > CLAIM_MS) {
    delete b.claims[propId];
    return null;
  }
  return pet;
}

export function claimProp(state, pet, propId, now = Date.now()) {
  behaviorState(state).claims[propId] = { by: pet.id, at: now };
}

// Drops claims and prop records that no longer refer to anything real.
export function pruneBehavior(state, now = Date.now()) {
  const b = behaviorState(state);
  Object.keys(b.claims).forEach(id => { claimantOf(state, id, now); });
  Object.keys(b.props).forEach(id => {
    if (!propById(state, id)) { delete b.props[id]; return; }
    const rec = b.props[id];
    if (rec.emptyUntil && rec.emptyUntil <= now) rec.emptyUntil = 0;
    Object.keys(rec.touched || {}).forEach(petId => {
      if (!petById(state, petId) || now - rec.touched[petId] > USE_COOLDOWN_MS) delete rec.touched[petId];
    });
  });
}

/* ---------------- slot scoring ---------------- */

function occupantsAt(state, index, slots) {
  const out = { pets: [], props: [] };
  if (index < 0) return out;
  neighborSlots(index, slots.length).forEach(x => {
    const id = slots[x];
    if (!id) return;
    const pet = petById(state, id);
    if (pet) { out.pets.push(pet); return; }
    const prop = propById(state, id);
    if (prop) out.props.push(prop);
  });
  return out;
}

// A low need pulls a pet toward whatever fixes it, whatever its taste.
function needPull(state, pet, prop, now) {
  const use = PROP_USE[prop.kind];
  if (!use || use.gain <= 0 || !pet.needs) return 0;
  if (isSpent(state, prop.id, now)) return 0;
  const level = pet.needs[use.need];
  if (typeof level !== 'number' || level >= 55) return 0;
  return ((55 - level) / 55) * 6;      // only real desperation is worth crossing the shelf for
}

export function pairScore(state, pet, other) {
  let s = 0;
  if (artPersonality(other).horns && (pet.stats?.menace || 0) < 5) s -= 1.5;
  const relation = relationship(state, pet, other);
  if (relation.appeal > 0) s += relation.appeal;
  if (petsFeud(pet, other)) {
    const arc = state.feudArcs && state.feudArcs[feudPairKey(pet.id, other.id)];
    if (arc && arc.truce) s += 1;
    else s -= 5 + (arc ? Math.min(arc.level || 0, 3) : 0);
  }
  // Only a real, mutual bond counts as a reason to stay put next to somebody.
  const mutual = Math.min(pet.bond || 0, other.bond || 0);
  s += Math.min(Math.max(mutual - 2, 0) * 0.35, 1.5);
  if ((pet.grudgeStage || 0) >= 2) s -= 1.5;
  return s;
}

// What this slot is worth to this pet. `slots` lets callers score a
// hypothetical arrangement without touching state.
export function slotScore(state, pet, index, now = Date.now(), slots = state.slots) {
  if (!pet || index < 0 || index >= slots.length) return -Infinity;
  let score = 0;
  const request = state.stories?.requests?.[pet.id];
  let petNeighbors = 0;
  neighborSlots(index, slots.length).forEach(x => {
    const id = slots[x];
    if (!id || id === pet.id) return;
    const other = petById(state, id);
    if (other) {
      if (!petsFeud(pet, other)) petNeighbors++;    // an enemy does not count as company
      score += pairScore(state, pet, other);
      if (request?.status === 'accepted' && request.kind === 'neighbor' && request.target === other.id) score += 4;
      return;
    }
    const prop = propById(state, id);
    if (!prop) return;
    let w = affinityFor(pet, prop.kind) * PROP_WEIGHT;
    if (request?.status === 'accepted' && request.kind === 'prop' && request.target === prop.kind) w += 4;
    const holder = claimantOf(state, prop.id, now);
    if (w > 0 && holder && holder.id !== pet.id) w *= 0.35;   // hogged: much less appealing
    score += w + needPull(state, pet, prop, now);
  });
  score += socialPull(pet) * Math.min(petNeighbors, 2);
  return score;
}

/* ---------------- movement ---------------- */

function simulate(state, from, to) {
  const slots = state.slots.slice();
  slots[from] = state.slots[to];
  slots[to] = state.slots[from];
  return slots;
}

/* Every slot this body could get to, and what it would cost. Anatomy decides
   the shape of this list: legs give you your own row, arms give you the shelf
   above and below, wings give you anywhere with a gap to land in. */
export function reachableSlots(state, pet, from, caps = capabilitiesOf(pet)) {
  const out = [];
  const total = state.slots.length;
  const seen = new Set();
  const add = (to, cost, means) => {
    if (to < 0 || to >= total || to === from || seen.has(to)) return;
    seen.add(to);
    out.push({ to, cost, means });
  };
  for (let d = 1; d <= caps.range; d++) {
    [from - d, from + d].forEach(to => {
      if (to < 0 || to >= total || rowOf(to) !== rowOf(from)) return;
      add(to, (d - 1) * STEP_COST, caps.ooze ? 'ooze' : (d > 1 && caps.stride ? 'stride' : 'walk'));
    });
  }
  if (caps.climb) {
    [from - ROW_WIDTH, from + ROW_WIDTH].forEach(to => add(to, CLIMB_COST, 'climb'));
    state.slots.forEach((id, to) => {
      if (id || Math.abs(rowOf(to) - rowOf(from)) !== 1) return;
      add(to, CLIMB_COST * 2, 'climb');
    });
  }
  if (caps.fly) {
    state.slots.forEach((id, to) => { if (!id) add(to, FLY_COST, 'fly'); });
  }
  return out;
}

// Deterministic: given a shelf, a pet either has a reason to move or it does
// not. All the randomness in this module is in the wording, not the decision.
export function decideMove(state, pet, now = Date.now()) {
  if (!pet || !Array.isArray(state.slots)) return null;
  const from = state.slots.indexOf(pet.id);
  if (from < 0) return null;
  if (safeAsleep(pet, now)) return null;                            // nocturnal pets rearrange at night
  if (now - (pet.lastMoveAt || 0) < moveCooldownFor(pet)) return null;

  const caps = capabilitiesOf(pet);
  const stay = slotScore(state, pet, from, now) + inertiaOf(pet);
  let best = null;
  reachableSlots(state, pet, from, caps).forEach(c => {
    const score = slotScore(state, pet, c.to, now, simulate(state, from, c.to)) - c.cost;
    if (!best || score > best.score) best = { to: c.to, score, means: c.means };
  });
  if (!best || best.score - stay < MOVE_THRESHOLD) return null;
  return {
    pet, from, to: best.to, means: best.means,
    gain: best.score - stay,
    sneaky: !!caps.sneak && (isNight(new Date(now)) || flag(pet, 'nocturnal'))
  };
}

// Why the move happened, in the order a player would read it off the shelf.
export function moveReason(state, pet, before, after, now = Date.now()) {
  const gainedProps = after.props.filter(p => !before.props.some(q => q.id === p.id));
  const lostProps = before.props.filter(p => !after.props.some(q => q.id === p.id));
  const loved = gainedProps.map(p => ({ p, w: affinityFor(pet, p.kind) })).sort((a, b) => b.w - a.w)[0];
  const hated = lostProps.map(p => ({ p, w: affinityFor(pet, p.kind) })).sort((a, b) => a.w - b.w)[0];
  const hungry = gainedProps.find(p => needPull(state, pet, p, now) > 1);
  if (loved && loved.w >= 2) return { kind: 'prop-love', prop: loved.p };
  if (hungry) return { kind: 'prop-need', prop: hungry };
  if (hated && hated.w <= -2) return { kind: 'prop-hate', prop: hated.p };
  const fled = before.pets.find(o => petsFeud(pet, o) && !after.pets.some(x => x.id === o.id));
  if (fled) return { kind: 'flee', other: fled };
  const ally = after.pets.find(o => !before.pets.some(x => x.id === o.id) &&
    Math.min(pet.bond || 0, o.bond || 0) >= 3);
  if (ally) return { kind: 'ally', other: ally };
  if (!after.pets.length && before.pets.length && socialPull(pet) < 0) return { kind: 'solitude' };
  if (after.pets.length > before.pets.length && socialPull(pet) > 0) return { kind: 'company', other: after.pets[0] };
  if (loved && loved.w > 0) return { kind: 'prop-love', prop: loved.p };
  if (safeMood(pet) === 'furious') return { kind: 'storm' };
  return { kind: 'restless' };
}

// Swaps two slots and stamps the cooldown on whoever was involved.
export function applyMove(state, from, to, now = Date.now()) {
  const moving = state.slots[from];
  const displaced = state.slots[to];
  state.slots[from] = displaced;
  state.slots[to] = moving;
  [moving, displaced].forEach(id => {
    const p = id ? petById(state, id) : null;
    if (p) p.lastMoveAt = now;
  });
}

// Motive, then means. "Moved to be nearer the Black Candle. It climbed."
export function moveNoteFor(state, pet, move, reason) {
  const subs = { p: pet, n: reason.other, q: reason.prop && reason.prop.kind };
  let text;
  if (move.sneaky) {
    const pool = reason.prop ? SNEAK_LINES.prop : (reason.other ? SNEAK_LINES.pet : SNEAK_LINES.plain);
    text = fill(pick(pool), subs);
  } else {
    text = fill(pick(MOVE_LINES[reason.kind] || MOVE_LINES.restless), subs);
  }
  const means = MEANS_LINES[move.means];
  if (means) text += ' ' + fill(pick(means), subs);
  return text;
}

export function performMove(state, move, now = Date.now()) {
  const pet = move.pet;
  const before = occupantsAt(state, move.from, state.slots);
  applyMove(state, move.from, move.to, now);
  const after = occupantsAt(state, move.to, state.slots);
  const reason = moveReason(state, pet, before, after, now);
  const kind = reason.kind === 'flee' ? 'feud' : (reason.kind === 'storm' ? 'angry' : 'note');
  addNote(state, moveNoteFor(state, pet, move, reason), pet.name, kind);
  return { ...move, reason: reason.kind };
}

/* ---------------- prop interaction ---------------- */

/* Props this pet can act on from where it stands: the two beside it, plus —
   if it has arms — the ones a slot further along, over a neighbor's head.
   `over` is whoever got reached across. */
export function reachableProps(state, pet, now = Date.now(), caps = capabilitiesOf(pet)) {
  const i = state.slots.indexOf(pet.id);
  if (i < 0) return [];
  const out = [];
  neighborSlots(i, state.slots.length).forEach(x => {
    const prop = state.slots[x] ? propById(state, state.slots[x]) : null;
    if (prop) out.push({ prop, at: x, distance: 1, over: null });
  });
  if (caps.reach) {
    [i - 2, i + 2].forEach(x => {
      if (x < 0 || x >= state.slots.length || rowOf(x) !== rowOf(i)) return;
      const prop = state.slots[x] ? propById(state, state.slots[x]) : null;
      if (!prop) return;
      const midId = state.slots[(i + x) / 2];
      out.push({ prop, at: x, distance: 2, over: midId ? petById(state, midId) : null });
    });
  }
  return out;
}

// One pet, one prop, one visible consequence.
export function useProp(state, pet, prop, now = Date.now(), opts = {}) {
  const use = PROP_USE[prop.kind] || DEFAULT_USE;
  const holder = claimantOf(state, prop.id, now);
  touchProp(state, pet, prop.id, now);
  if (holder && holder.id !== pet.id) {
    addNote(state, fill(pick(BLOCKED_LINES), { p: pet, n: holder, q: prop.kind }), pet.name, 'angry');
    fileGrudge(state, pet, 'kept off the ' + propName(prop.kind) + ' by ' + holder.name, now);
    return { outcome: 'blocked', by: holder.id };
  }
  if (isSpent(state, prop.id, now)) {
    addNote(state, fill(pick(EMPTY_LINES), { p: pet, q: prop.kind }), propName(prop.kind), 'note');
    return { outcome: 'spent' };
  }
  if (pet.needs && typeof pet.needs[use.need] === 'number') {
    pet.needs[use.need] = clamp(pet.needs[use.need] + use.gain, 0, 100);
  }
  const rec = propRecord(state, prop.id);
  rec.uses = (rec.uses || 0) + 1;
  const bucket = use.gain < 0 ? 'worse' : (USE_LINES[use.need] ? use.need : 'fuss');
  let text = fill(pick(USE_LINES[bucket]), { p: pet, q: prop.kind });
  if (opts.over) text += ' ' + fill(pick(REACH_LINES), { p: pet, m: opts.over, q: prop.kind });
  addNote(state, text, pet.name, 'note');
  if (use.deplete && rec.uses >= DEPLETE_AT) {
    depleteProp(state, prop.id, now);
    addNote(state, fill(pick(EMPTY_LINES), { p: pet, q: prop.kind }), propName(prop.kind), 'note');
  }
  return { outcome: 'used', need: use.need, gain: use.gain, reached: !!opts.over };
}

// A pet that loves a prop enough stops sharing it — and, if there is room,
// physically drags it round to its own side so the neighbor loses the aura.
export function claimAndHoard(state, pet, prop, now = Date.now()) {
  const pi = state.slots.indexOf(pet.id);
  const qi = state.slots.indexOf(prop.id);
  if (pi < 0 || qi < 0) return null;
  claimProp(state, pet, prop.id, now);
  touchProp(state, pet, prop.id, now);
  const far = 2 * qi - pi;                                   // the prop's other neighbor
  const behind = 2 * pi - qi;                                // the slot on the pet's far side
  const rival = neighborSlots(qi, state.slots.length).indexOf(far) >= 0 && state.slots[far]
    ? petById(state, state.slots[far]) : null;
  const canDrag = rival && neighborSlots(pi, state.slots.length).indexOf(behind) >= 0 && !state.slots[behind];
  if (canDrag) {
    state.slots[behind] = prop.id;
    state.slots[qi] = null;
    addNote(state, fill(pick(DRAG_LINES), { p: pet, n: rival, q: prop.kind }), pet.name, 'note');
    return { outcome: 'hoarded', from: qi, to: behind, rival: rival.id };
  }
  addNote(state, fill(pick(CLAIM_LINES), { p: pet, q: prop.kind }), pet.name, 'note');
  return { outcome: 'claimed' };
}

// Two pets beside the same unclaimed prop, both wanting it. The winner keeps
// it; the loser takes a grudge and the pair's feud arc deepens.
export function contestProp(state, prop, now = Date.now()) {
  const qi = state.slots.indexOf(prop.id);
  if (qi < 0) return null;
  if (claimantOf(state, prop.id, now)) return null;
  const rivals = neighborSlots(qi, state.slots.length)
    .map(x => state.slots[x])
    .filter(Boolean)
    .map(id => petById(state, id))
    .filter(p => p && !safeAsleep(p, now) && affinityFor(p, prop.kind) >= CLAIM_AFFINITY);
  if (rivals.length < 2) return null;
  // Wanting it most wins; then menace (the Particulars earn their keep here);
  // then whoever the player trusts more.
  const menace = p => (p.stats && typeof p.stats.menace === 'number') ? p.stats.menace : 5;
  rivals.sort((a, b) => (affinityFor(b, prop.kind) - affinityFor(a, prop.kind)) || (menace(b) - menace(a)) || ((b.bond || 0) - (a.bond || 0)));
  const [winner, loser] = rivals;
  claimProp(state, winner, prop.id, now);
  // Only a pair that actually feud deepen their arc over furniture; a squabble
  // between residents who otherwise get on stays a squabble.
  if (petsFeud(winner, loser)) {
    const key = feudPairKey(winner.id, loser.id);
    if (!state.feudArcs) state.feudArcs = {};
    const arc = state.feudArcs[key] || (state.feudArcs[key] = { level: 0, truce: false });
    if (!arc.truce) arc.level += 1;
  }
  addNote(state, fill(pick(CONTEST_LINES), { p: winner, n: loser, q: prop.kind }), 'observed', 'feud');
  fileGrudge(state, loser, 'lost the ' + propName(prop.kind) + ' to ' + winner.name, now);
  return { winner: winner.id, loser: loser.id, prop: prop.id };
}

/* ---------------- the pass ---------------- */

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function awakePets(state, now) {
  return state.pets.filter(p => state.slots.indexOf(p.id) >= 0 && !safeAsleep(p, now));
}

// The thief flag, with a motive: it robs whichever neighbor has the most left.
// Arms let it rob somebody a slot further away, over the top of a witness.
export function stealPhase(state, now = Date.now()) {
  const candidates = awakePets(state, now).filter(p => flag(p, 'thief') && p.needs && p.needs.food < 45);
  if (!candidates.length) return null;
  const thief = pick(candidates);
  const caps = capabilitiesOf(thief);
  const i = state.slots.indexOf(thief.id);
  const marks = [];
  neighborSlots(i, state.slots.length).forEach(x => {
    const p = state.slots[x] ? petById(state, state.slots[x]) : null;
    if (p && p.needs) marks.push({ pet: p, over: null });
  });
  if (caps.reach) {
    [i - 2, i + 2].forEach(x => {
      if (x < 0 || x >= state.slots.length || rowOf(x) !== rowOf(i)) return;
      const p = state.slots[x] ? petById(state, state.slots[x]) : null;
      if (!p || !p.needs) return;
      const midId = state.slots[(i + x) / 2];
      marks.push({ pet: p, over: midId ? petById(state, midId) : null });
    });
  }
  if (!marks.length) return null;
  marks.sort((a, b) => b.pet.needs.food - a.pet.needs.food);
  const { pet: victim, over } = marks[0];
  victim.needs.food = clamp(victim.needs.food - 14, 0, 100);
  thief.needs.food = clamp(thief.needs.food + 12, 0, 100);
  const line = over ? pick(REACH_THEFT_LINES) : pick(THEFT_LINES);
  addNote(state, fill(line, { p: thief, n: victim, m: over }), thief.name, 'feud');
  fileGrudge(state, victim, 'robbed by ' + thief.name, now, { force: true });
  return { thief: thief.id, victim: victim.id, reached: !!over };
}

// A pet stuck beside something it cannot stand and unable to get away from it.
export function aversionPhase(state, now = Date.now()) {
  const stuck = [];
  awakePets(state, now).forEach(pet => {
    const i = state.slots.indexOf(pet.id);
    occupantsAt(state, i, state.slots).props.forEach(prop => {
      if (affinityFor(pet, prop.kind) <= -2) stuck.push({ pet, prop });
    });
  });
  if (!stuck.length) return null;
  const { pet, prop } = pick(stuck);
  if (pet.needs && typeof pet.needs.fuss === 'number') pet.needs.fuss = clamp(pet.needs.fuss - 4, 0, 100);
  addNote(state, fill(pick(AVERSION_LINES), { p: pet, q: prop.kind }), pet.name, 'angry');
  return { pet: pet.id, prop: prop.id };
}

/* Mischief that needs no journey — this is where anatomy shows up even when a
   pet is perfectly happy where it is. Arms hang off the shelf, tails knock
   things over, limbless things roll into the furniture, and anything else is
   simply closer than you left it. One per pass. */
export function mischiefPhase(state, now = Date.now()) {
  const options = [];
  awakePets(state, now).forEach(pet => {
    const caps = capabilitiesOf(pet);
    const i = state.slots.indexOf(pet.id);
    const props = occupantsAt(state, i, state.slots).props;
    if (caps.hang) options.push({ act: 'hang', pet });
    if (caps.ooze && props.length) options.push({ act: 'nudge', pet, prop: pick(props) });
    if (caps.tail && props.length) options.push({ act: 'knock', pet, prop: pick(props) });
    options.push({ act: 'lurk', pet });
  });
  if (!options.length) return null;
  // Spread it around: prefer somebody who has not just done something.
  const fresh = options.filter(o => now - (o.pet.lastMischiefAt || 0) > MISCHIEF_COOLDOWN_MS);
  const choice = pick(fresh.length ? fresh : options);
  const { act, pet, prop } = choice;
  if (act === 'hang' && pet.needs && typeof pet.needs.fuss === 'number') {
    pet.needs.fuss = clamp(pet.needs.fuss + 5, 0, 100);
  }
  if (act === 'nudge') {
    const pi = state.slots.indexOf(pet.id);
    const qi = state.slots.indexOf(prop.id);
    if (pi < 0 || qi < 0) return null;
    state.slots[pi] = prop.id;
    state.slots[qi] = pet.id;
    pet.lastMoveAt = now;
  }
  if (act === 'knock') depleteProp(state, prop.id, now);
  pet.lastMischiefAt = now;
  const subs = { p: pet, q: prop && prop.kind };
  const unseen = MISCHIEF_LINES[act].filter(line => !state.notes.some(note => note.text === fill(line, subs)));
  // Lurking changes no needs or furniture. Once every observation is already
  // on the board, let the resident carry on quietly instead of repeating it.
  if (unseen.length || act !== 'lurk') {
    addNote(state, fill(pick(unseen.length ? unseen : MISCHIEF_LINES[act]), subs), pet.name, 'note');
  }
  return { act, pet: pet.id, prop: prop ? prop.id : null };
}

/* One pass of shelf life. Movement first (so a pet can arrive at the thing it
   wanted), then what it does with whatever is now beside it.

   opts: { force } skips the interval gate; { maxMoves, maxUses } are budgets.
   Returns null when the interval gate declined to run. */
export function runBehavior(state, now = Date.now(), opts = {}) {
  const b = behaviorState(state);
  if (!opts.force && now - b.lastRun < PASS_INTERVAL_MS) return null;
  b.lastRun = now;
  const result = { moves: [], uses: [], claims: [], contests: [], theft: null, aversion: null, mischief: null };
  if (!Array.isArray(state.pets) || !state.pets.length) return result;
  pruneBehavior(state, now);

  const maxMoves = typeof opts.maxMoves === 'number' ? opts.maxMoves : 2;
  const maxUses = typeof opts.maxUses === 'number' ? opts.maxUses : 2;

  // 1. Movement. Everyone who wants to move is ranked by how badly, and only
  //    the most motivated few actually get up — the shelf stays readable.
  if (maxMoves > 0) {
    const wants = [];
    shuffled(state.pets).forEach(pet => {
      const m = decideMove(state, pet, now);
      if (m) wants.push(m);
    });
    wants.sort((x, y) => y.gain - x.gain);
    wants.forEach(m => {
      if (result.moves.length >= maxMoves) return;
      const fresh = decideMove(state, m.pet, now);        // the shelf may have shifted since
      if (!fresh) return;
      result.moves.push(performMove(state, fresh, now));
    });
  }

  // 2. Interaction: use it, claim it, or drag it out of everyone else's reach.
  const movedIds = new Set(result.moves.map(m => m.pet.id));
  let uses = 0;
  shuffled(awakePets(state, now)).forEach(pet => {
    if (uses >= maxUses || movedIds.has(pet.id)) return;
    const caps = capabilitiesOf(pet);
    const options = reachableProps(state, pet, now, caps)
      .filter(r => !usedRecently(state, pet, r.prop.id, now))
      .map(r => ({ ...r, w: affinityFor(pet, r.prop.kind), pull: needPull(state, pet, r.prop, now) }))
      .filter(r => r.w >= 1 || r.pull > 0.6)
      .sort((a, c) => (c.w + c.pull - c.distance) - (a.w + a.pull - a.distance));
    if (!options.length || Math.random() > 0.6) return;
    const target = options[0];
    const claimed = claimantOf(state, target.prop.id, now);
    if (target.distance === 1 && target.w >= CLAIM_AFFINITY && !claimed) {
      const out = claimAndHoard(state, pet, target.prop, now);
      if (out) result.claims.push(out);
    } else {
      result.uses.push(useProp(state, pet, target.prop, now, { over: target.over }));
    }
    uses++;
  });

  // 3. Two pets, one prop.
  for (const prop of shuffled(state.props || [])) {
    const out = contestProp(state, prop, now);
    if (out) { result.contests.push(out); break; }
  }

  // 4. Things that are done rather than gone to.
  if (Math.random() < 0.7) result.theft = stealPhase(state, now);
  if (!result.moves.length && Math.random() < 0.35) result.aversion = aversionPhase(state, now);
  if (!result.moves.length && !result.aversion && Math.random() < 0.4) result.mischief = mischiefPhase(state, now);
  return result;
}

/* Time passed while nobody was watching. Runs a few restrained passes and says
   so once, rather than dumping a session's worth of notes into the feed.
   Returns the number of notes added. */
export function catchUpBehavior(state, now = Date.now()) {
  const b = behaviorState(state);
  const away = now - (b.lastRun || 0);
  if (!b.lastRun) { b.lastRun = now; return 0; }
  if (away < CATCHUP_AFTER_MS || !Array.isArray(state.pets) || !state.pets.length) return 0;
  const passes = Math.min(MAX_CATCHUP_PASSES, Math.floor(away / CATCHUP_AFTER_MS));
  const before = state.notes.length;
  for (let i = 0; i < passes; i++) {
    // Space the simulated passes out so per-pet move cooldowns actually clear.
    const at = now - (passes - 1 - i) * MOVE_COOLDOWN_MS * 4;
    runBehavior(state, at, { force: true, maxMoves: 1, maxUses: 1 });
  }
  b.lastRun = now;
  const added = state.notes.length - before;
  if (added) addNote(state, pick(CATCHUP_LINES), 'the shelf', 'note');
  return added ? added + 1 : 0;
}
