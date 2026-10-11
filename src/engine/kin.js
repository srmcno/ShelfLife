// Foundlings: a new resident blended from two friends' residents.
//
// Pure and deterministic. Both households run planFoundling() on the same two
// parent snapshots (as src/cloud/social.js readResident() returns them), the
// same server-issued seed and the same name roll, so both get the same child.
// Parent `a` is always the one whose owner left the basket out.
//
// Generated (vector) parents swap body, parts and colours. A drawn parent
// lends its ink colour and a few of its stamps to a generated one. Two drawn
// parents become a "patchwork": the left half of one drawing stitched to the
// right half of the other. Stitching needs a canvas, so it happens in
// src/art/kin-art.js; the plan here also carries a fallback (one body, both
// sets of stamps) for when that is not possible.
import { TRAITS, TRAIT_BY_ID } from '../content/traits.js';
import {
  BODIES, PALETTES, PALETTE_IDS, EYES, MOUTHS, TOPS, EARS, ARMS, LEGS, TAILS, WINGS, DETAILS, SLOT_KEYS,
  makeRng, normalizeCreature, customizeCreature, generateCreature, resolveColors
} from '../art/creatures.js';
import { CANVAS_SIZE } from '../art/stamps.js';
import { resolvePersonality } from './creation.js';
import { NAME_TITLES, NAME_DRESSINGS, BIRTH_OPENINGS, BIRTH_FEATURES, BIRTH_INHERITANCES } from '../content/kin.js';

export const NAME_ROLLS = 50;
export const MAX_NAME = 22;
const LIBS = { eyes: EYES, mouth: MOUTHS, top: TOPS, ears: EARS, arms: ARMS, legs: LEGS, tail: TAILS, wings: WINGS, detail: DETAILS };
const HEX6 = /^#[0-9a-f]{6}$/i;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

// The pet id both households give the child: the twins' pen pal pair on the
// server uses the same one.
export function foundlingId(basketId) {
  return 'kin' + String(basketId || '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 12).padEnd(12, '0');
}

// A rng per purpose, so changing how a name is chosen never changes the look.
function rngFor(seed, salt) { return makeRng('kin:' + (Number(seed) >>> 0) + ':' + salt); }
const pickFrom = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
const possessive = name => name + '’s';

/* ---------------- names ---------------- */
const VOWEL = /[aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿœ]/i;
const LETTER = /\p{L}/u;
// The part of a name its children would use: the longest word that is not a
// title or a numeral, letters only.
export function nameCore(name) {
  const words = String(name || '').normalize('NFC').split(/\s+/).map(w => [...w].filter(ch => LETTER.test(ch) || ch === '’' || ch === "'").join(''))
    .filter(Boolean);
  const real = words.filter(w => !NAME_TITLES.includes(w.toLowerCase().replace(/[’']/g, '')) && !/^[ivxlcdm]+$/i.test(w));
  const pool = real.length ? real : words;
  const best = pool.reduce((a, b) => ([...b].length > [...a].length ? b : a), pool[0] || '');
  return [...best].filter(ch => LETTER.test(ch)).join('');
}
const title = word => { const chars = [...word.toLowerCase()]; return chars.length ? chars[0].toUpperCase() + chars.slice(1).join('') : ''; };
function cuts(word) {
  const chars = [...word], out = [];
  for (let i = 1; i < chars.length; i++) if (VOWEL.test(chars[i - 1]) !== VOWEL.test(chars[i])) out.push(i);
  return out;
}
// Every pronounceable way to join the front of one name to the back of the other.
export function nameCandidates(nameA, nameB) {
  const a = nameCore(nameA), b = nameCore(nameB);
  const parents = new Set([a.toLowerCase(), b.toLowerCase()]);
  const found = new Set();
  for (const [x, y] of [[a, b], [b, a]]) {
    const xs = [...x], ys = [...y];
    for (const i of cuts(x)) for (const j of cuts(y)) {
      const front = xs.slice(0, i), back = ys.slice(j);
      if (!front.length || !back.length) continue;
      const joinV = VOWEL.test(front[front.length - 1]), nextV = VOWEL.test(back[0]);
      if (joinV === nextV) continue;
      const word = title(front.concat(back).join(''));
      const length = [...word].length;
      if (length < 3 || length > 10 || parents.has(word.toLowerCase())) continue;
      if (/[^aeiouy]{4}/i.test(word) || /(.)\1\1/i.test(word)) continue;
      found.add(word);
    }
  }
  return [...found].sort();
}
// Half of one, half of the other, for names the syllable rule cannot split.
function fallbackName(a, b) {
  const xs = [...nameCore(a)], ys = [...nameCore(b)];
  const word = xs.slice(0, Math.max(1, Math.ceil(xs.length / 2))).concat(ys.slice(Math.floor(ys.length / 2))).join('');
  return title(word) || 'Foundling';
}
// The name for roll 0, 1, 2... Each roll gives a different name while there
// are names to give; dressings ("the Second") vary the rest.
export function foundlingName(nameA, nameB, seed, roll = 0) {
  const r = Math.max(0, Math.floor(Number(roll) || 0)) % NAME_ROLLS;
  const list = nameCandidates(nameA, nameB);
  const rng = rngFor(seed, 'name');
  const order = list.slice();
  for (let i = order.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; }
  if (!order.length) order.push(fallbackName(nameA, nameB));
  const base = order[r % order.length];
  const cycle = Math.floor(r / order.length);
  const dress = rngFor(seed, 'dress:' + r);
  let name = base;
  if (dress() < .14 || cycle > 0) {
    const dressing = NAME_DRESSINGS[(Math.floor(dress() * NAME_DRESSINGS.length) + cycle) % NAME_DRESSINGS.length];
    const full = dressing.replace('{n}', base);
    name = [...full].length <= MAX_NAME ? full : base;
  }
  return [...name].slice(0, MAX_NAME).join('').trim() || 'Foundling';
}

export function birthLine(nameA, nameB, seed) {
  const rng = rngFor(seed, 'birth');
  return pickFrom(rng, BIRTH_OPENINGS) + ' It has ' + possessive(nameA) + ' ' + pickFrom(rng, BIRTH_FEATURES) + ' and ' + possessive(nameB) + ' ' + pickFrom(rng, BIRTH_INHERITANCES) + '.';
}

/* ---------------- traits ---------------- */
// One from each parent, then one from nowhere in particular.
export function blendTraits(traitsA, traitsB, seed) {
  const rng = rngFor(seed, 'traits');
  const valid = list => [...new Set((Array.isArray(list) ? list : []).filter(t => typeof t === 'string' && Object.hasOwn(TRAIT_BY_ID, t)))];
  const a = valid(traitsA), b = valid(traitsB), out = [];
  if (a.length) out.push(pickFrom(rng, a));
  const fromB = b.filter(t => !out.includes(t));
  if (fromB.length) out.push(pickFrom(rng, fromB));
  const wild = TRAITS.map(t => t.id).filter(t => !a.includes(t) && !b.includes(t) && !out.includes(t));
  while (out.length < 3 && wild.length) out.push(wild.splice(Math.floor(rng() * wild.length), 1)[0]);
  return out;
}

/* ---------------- looks ---------------- */
const has = (bodyId, tag) => (BODIES[bodyId]?.tags || []).includes(tag);
// The same limits the generator rolls within, so a blend never puts a crown
// on a skull too small to hold one.
export function partFits(bodyId, slot, part, parts = {}) {
  if (!Object.hasOwn(LIBS[slot] || {}, part)) return false;
  const small = has(bodyId, 'smallFace');
  if (slot === 'wings') return part === 'none' || !has(bodyId, 'noWings');
  if (slot === 'legs') {
    if ((part === 'many' || part === 'tentacles') && (BODIES[bodyId]?.anchors?.manyLegs || []).length < 4) return false;
    if (has(bodyId, 'sits') && !has(bodyId, 'crawler')) return part === 'none' || part === 'tentacles';
    return true;
  }
  if (slot === 'top') {
    if (has(bodyId, 'topHeavy') && ['curled', 'crown', 'tophat'].includes(part)) return false;
    if (small && ['crown', 'crest', 'tophat', 'bandage'].includes(part)) return false;
    return true;
  }
  if (slot === 'eyes') return !(small && ['cyclops', 'cluster', 'triple', 'goggle'].includes(part));
  if (slot === 'mouth') {
    const eyes = EYES[parts.eyes];
    if (small && ['gape', 'tusks', 'moustache', 'chatter'].includes(part)) return false;
    if (eyes && (eyes.tags.includes('many') || parts.eyes === 'cyclops') && !['frown', 'smirk', 'oh', 'wavy', 'stitched', 'fangs', 'zip', 'pout'].includes(part)) return false;
    if (eyes && eyes.tags.includes('blind') && part === 'gape') return false;
    return true;
  }
  if (slot === 'ears') return !['crown', 'crest'].includes(parts.top) || ['none', 'round', 'pointy', 'bolts'].includes(part);
  return true;
}
const SAFE = { eyes: 'pair', mouth: 'smirk', top: 'none', ears: 'none', arms: 'none', legs: 'none', tail: 'none', wings: 'none', detail: 'none' };
// Eyes first, so the mouth and ears can be checked against what is already chosen.
const SLOT_ORDER = ['eyes', 'mouth', 'top', 'ears', 'arms', 'legs', 'tail', 'wings', 'detail'];
function choose(bodyId, slot, first, second, parts) {
  for (const part of [first, second, SAFE[slot]]) if (partFits(bodyId, slot, part, parts)) return part;
  return SAFE[slot];
}
const mean = (x, y) => Math.round((x + y) * 50) / 100;

export function blendCreatures(creatureA, creatureB, seed) {
  const rng = rngFor(seed, 'look');
  const A = normalizeCreature(creatureA), B = normalizeCreature(creatureB);
  const bodyFrom = rng() < .5 ? A : B, paletteFrom = rng() < .5 ? A : B;
  const body = bodyFrom.body, parts = {}, from = {};
  for (const slot of SLOT_ORDER) {
    const first = rng() < .5 ? A : B, second = first === A ? B : A;
    parts[slot] = choose(body, slot, first.parts[slot], second.parts[slot], parts);
    from[slot] = parts[slot] === first.parts[slot] ? first === A ? 'a' : 'b' : parts[slot] === second.parts[slot] ? second === A ? 'a' : 'b' : '';
  }
  const jitter = () => Math.round((rng() * 2 - 1) * 6) / 100;
  const tune = { eyeScale: mean(A.tune.eyeScale, B.tune.eyeScale) + jitter(), eyeSpread: mean(A.tune.eyeSpread, B.tune.eyeSpread) + jitter(),
    mouthScale: mean(A.tune.mouthScale, B.tune.mouthScale) + jitter(), lean: mean(A.tune.lean, B.tune.lean) };
  // Colours: one parent's palette (and its own colours), sometimes with the
  // other parent's accent or markings.
  const colors = { ...(paletteFrom.colors || {}) };
  const other = resolveColors(paletteFrom === A ? B : A);
  if (rng() < .4) colors.accent = other.accent;
  if (rng() < .25) colors.detail = other.detail;
  const creature = normalizeCreature({ seed: 'kin' + (Number(seed) >>> 0).toString(36), body, palette: paletteFrom.palette, parts, tune, colors });
  return { creature, from: { body: bodyFrom === A ? 'a' : 'b', palette: paletteFrom === A ? 'a' : 'b', parts: from } };
}

// What a drawn parent's stamps become on a generated child.
export const STAMP_PARTS = {
  horns: ['top', 'curled'], antlers: ['top', 'antlers'], halo: ['top', 'halo'], crown: ['top', 'crown'], wing: ['wings', 'bat'],
  tail: ['tail', 'curl'], ears: ['ears', 'pointy'], eyes: ['eyes', 'pair'], bigeye: ['eyes', 'cyclops'], deadeyes: ['eyes', 'dead'],
  thirdeye: ['eyes', 'triple'], grin: ['mouth', 'fangs'], tentacles: ['legs', 'tentacles'], stitches: ['detail', 'stitches'],
  spots: ['detail', 'spots'], arms: ['arms', 'noodle'], legs: ['legs', 'stubby']
};
const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
export function luminance(hex) {
  if (!HEX6.test(hex || '')) return .5;
  const [r, g, b] = [0, 1, 2].map(i => channel(hex, i) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
const distance = (x, y) => [0, 1, 2].reduce((sum, i) => sum + (channel(x, i) - channel(y, i)) ** 2, 0);
export function nearestPalette(hex) {
  return PALETTE_IDS.reduce((best, id) => distance(PALETTES[id].body, hex) < distance(PALETTES[best].body, hex) ? id : best, PALETTE_IDS[0]);
}
// The colour a drawing is mostly made of, from its stamps when its ink is unknown.
function stampColour(stamps) {
  const counts = new Map();
  for (const s of stamps || []) if (HEX6.test(s?.color || '') && s.color.toUpperCase() !== '#F2E9DC') counts.set(s.color.toLowerCase(), (counts.get(s.color.toLowerCase()) || 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]?.[0] || null;
}

// A generated parent's body, coloured with the drawing's ink and wearing up to
// two of the drawing's features.
export function inkCreature(creature, drawnArt, ink, seed) {
  const rng = rngFor(seed, 'ink');
  const base = normalizeCreature(creature);
  const colour = HEX6.test(ink || '') ? ink.toLowerCase() : stampColour(drawnArt?.stamps);
  const parts = { ...base.parts }, borrowed = [];
  const offers = [...new Set((drawnArt?.stamps || []).map(s => s?.kind).filter(kind => Object.hasOwn(STAMP_PARTS, kind)))].sort();
  for (let i = offers.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [offers[i], offers[k]] = [offers[k], offers[i]]; }
  for (const kind of offers) {
    if (borrowed.length >= 2) break;
    const [slot, part] = STAMP_PARTS[kind];
    if (borrowed.some(b => b.slot === slot) || !partFits(base.body, slot, part, parts)) continue;
    parts[slot] = part; borrowed.push({ slot, part, kind });
  }
  if (!partFits(base.body, 'mouth', parts.mouth, parts)) parts.mouth = SAFE.mouth;
  if (!partFits(base.body, 'ears', parts.ears, parts)) parts.ears = 'none';
  let next = normalizeCreature({ ...base, seed: 'kin' + (Number(seed) >>> 0).toString(36), parts, colors: {} });
  if (colour) {
    next = normalizeCreature({ ...next, palette: luminance(colour) < .045 ? 'tar' : nearestPalette(colour) });
    next = customizeCreature(next, { colors: { body: colour } });
    // A face must never vanish into a dark body.
    if (luminance(colour) < .09) next = normalizeCreature({ ...next, colors: { ...next.colors, line: '#B9A8C6' } });
  } else next = normalizeCreature({ ...next, palette: pickFrom(rng, PALETTE_IDS) });
  return { creature: next, borrowed, colour };
}

/* ---------------- drawings ---------------- */
const finite = n => Number.isFinite(n);
function boundsOf(art) {
  const b = art?.bounds;
  if (record(b) && [b.x, b.y, b.width, b.height].every(finite) && b.width > 0 && b.height > 0) return { x: b.x, y: b.y, width: b.width, height: b.height };
  return { x: .1, y: .1, width: .8, height: .8 };
}
// Where each drawing goes in the stitched canvas: same height, left half of
// one meeting the right half of the other at the middle, feet on one line.
export const PATCH_FOOT = .95, PATCH_HEIGHT = .8;
export function patchLayout(boundsL, boundsR) {
  const place = (b, side) => {
    const s = Math.min(PATCH_HEIGHT / b.height, .94 / b.width, 6);
    const cx = b.x + b.width / 2, bottom = b.y + b.height;
    return { side, scale: s, cx, bottom,
      map: (u, v) => ({ x: .5 + (u - cx) * s, y: PATCH_FOOT - (bottom - v) * s }),
      box: { x: side === 'left' ? .5 - b.width / 2 * s : .5, y: PATCH_FOOT - b.height * s, width: b.width / 2 * s, height: b.height * s } };
  };
  const left = place(boundsL, 'left'), right = place(boundsR, 'right');
  const x = left.box.x, y = Math.min(left.box.y, right.box.y);
  return { left, right, bounds: { x, y, width: right.box.x + right.box.width - x, height: PATCH_FOOT - y } };
}
// A stamp from one drawing, moved to where its half now sits. null if it sits
// on the half that was cut away.
export function moveStamp(stamp, half) {
  if (!record(stamp) || ![stamp.x, stamp.y, stamp.size].every(finite)) return null;
  const at = half.map(stamp.x / CANVAS_SIZE, stamp.y / CANVAS_SIZE);
  if (half.side === 'left' ? at.x > .5 : at.x < .5) return null;
  const clamp = n => Math.max(0, Math.min(CANVAS_SIZE, n));
  return { ...stamp, x: Math.round(clamp(at.x * CANVAS_SIZE) * 10) / 10, y: Math.round(clamp(at.y * CANVAS_SIZE) * 10) / 10,
    size: Math.max(4, Math.min(400, Math.round(stamp.size * half.scale * 10) / 10)) };
}
// Which drawing is the left half. The stitching itself is src/art/kin-art.js.
export function patchworkPlan(artA, artB, seed) {
  const rng = rngFor(seed, 'patch');
  const leftIsA = rng() < .5;
  const L = leftIsA ? artA : artB, R = leftIsA ? artB : artA;
  const layout = patchLayout(boundsOf(L), boundsOf(R));
  const stamps = [...(L?.stamps || []).map(s => moveStamp(s, layout.left)), ...(R?.stamps || []).map(s => moveStamp(s, layout.right))].filter(Boolean).slice(0, 48);
  return { left: leftIsA ? 'a' : 'b', right: leftIsA ? 'b' : 'a', layout, stamps, bounds: layout.bounds };
}
// Without a canvas: the left parent's drawing whole, wearing a few of the
// right parent's stamps where they would have been.
export function patchworkFallback(artA, artB, seed) {
  const plan = patchworkPlan(artA, artB, seed);
  const L = plan.left === 'a' ? artA : artB, R = plan.left === 'a' ? artB : artA;
  const lb = boundsOf(L), rb = boundsOf(R);
  const borrowed = (R?.stamps || []).filter(s => record(s) && [s.x, s.y, s.size].every(finite)).slice(0, 6).map(s => {
    const u = (s.x / CANVAS_SIZE - rb.x) / rb.width, v = (s.y / CANVAS_SIZE - rb.y) / rb.height;
    const k = Math.min(lb.width / rb.width, lb.height / rb.height);
    return { ...s, x: Math.round((lb.x + u * lb.width) * CANVAS_SIZE * 10) / 10, y: Math.round((lb.y + v * lb.height) * CANVAS_SIZE * 10) / 10,
      size: Math.max(4, Math.min(400, Math.round(s.size * k * 10) / 10)) };
  });
  const art = { body: typeof L?.body === 'string' ? L.body : '', stamps: [...(L?.stamps || []), ...borrowed].slice(0, 48) };
  if (record(L?.bounds)) art.bounds = { ...L.bounds };
  return art;
}

/* ---------------- the whole child ---------------- */
const isDrawn = art => record(art) && !art.creature && (!!art.body || (Array.isArray(art.stamps) && art.stamps.length > 0));
const isMade = art => record(art) && record(art.creature);
// Everything about the child that does not need a canvas. `inks` are the
// drawn parents' ink colours (src/art/kin-art.js reads them from the PNGs).
export function planFoundling({ a, b, seed, roll = 0, inks = {} }) {
  const nameA = a?.name || 'Someone', nameB = b?.name || 'Someone';
  const s = Number(seed) >>> 0;
  const traits = blendTraits(a?.traits, b?.traits, s);
  const personality = resolvePersonality({ seed: (s ^ 0x5bd1e995) >>> 0, traits, origin: '' });
  const birth = birthLine(nameA, nameB, s);
  const plan = { name: foundlingName(nameA, nameB, s, roll), traits: personality.traits, stats: personality.stats,
    bio: (birth + ' ' + personality.bio).slice(0, 3000), birth, look: 'made', art: null, patch: null };
  const artA = a?.art, artB = b?.art;
  if (isMade(artA) && isMade(artB)) {
    const blended = blendCreatures(artA.creature, artB.creature, s);
    plan.art = { body: '', stamps: [], creature: blended.creature };
    plan.from = blended.from;
  } else if (isMade(artA) || isMade(artB)) {
    const made = isMade(artA) ? artA : artB, drawn = made === artA ? artB : artA;
    const ink = made === artA ? inks.b : inks.a;
    const coloured = inkCreature(made.creature, isDrawn(drawn) ? drawn : null, ink, s);
    plan.look = isDrawn(drawn) ? 'inked' : 'made';
    plan.art = { body: '', stamps: [], creature: coloured.creature };
    plan.borrowed = coloured.borrowed;
  } else if (isDrawn(artA) && isDrawn(artB)) {
    plan.look = 'patchwork';
    plan.patch = patchworkPlan(artA, artB, s);
    plan.art = patchworkFallback(artA, artB, s);
  } else if (isDrawn(artA) || isDrawn(artB)) {
    plan.look = 'drawn';
    const only = isDrawn(artA) ? artA : artB;
    plan.art = { body: only.body || '', stamps: (only.stamps || []).slice(0, 48), ...(record(only.bounds) ? { bounds: { ...only.bounds } } : {}) };
  } else {
    plan.art = { body: '', stamps: [], creature: normalizeCreature(generateCreature({ seed: 'kin' + s.toString(36) })) };
  }
  return plan;
}

// The resident itself, as main.js makes one from the studio.
export function foundlingPet(plan, { basketId, born = Date.now(), art = plan.art } = {}) {
  return {
    id: foundlingId(basketId), name: plan.name, art: { body: art.body || '', stamps: Array.isArray(art.stamps) ? art.stamps : [],
      ...(art.creature ? { creature: art.creature } : {}), ...(record(art.bounds) ? { bounds: { ...art.bounds } } : {}) },
    traits: plan.traits.slice(), stats: { ...plan.stats }, bio: plan.bio, born,
    needs: { food: 70, fuss: 58, clean: 74 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0, names: [{ name: plan.name, at: born }]
  };
}

export function hasRoom(state) { return Array.isArray(state?.slots) && state.slots.indexOf(null) >= 0; }
export const FULL_SHELF = 'Your shelf is full: eighteen spaces, eighteen occupants. Rehome someone or put furniture away first.';
