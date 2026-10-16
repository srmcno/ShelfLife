// Foundlings: the blend, the name generator, the birth line, the household
// record and taking a foundling in. Pure engine code, no page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  foundlingId, foundlingName, nameCandidates, nameCore, birthLine, blendTraits, planFoundling, foundlingPet, partFits,
  patchLayout, patchworkPlan, hasRoom, FULL_SHELF, NAME_ROLLS, MAX_NAME, inkCreature, luminance
} from '../src/engine/kin.js';
import { dominantInk, MAX_FOUNDLING_IMAGE, realizeFoundling, envelopeSVG, portraitHTML, sealFor } from '../src/art/kin-art.js';
import { normalizeKin, blankKin, kinState, KIN_LETTERS_PER_PAL } from '../src/kin-state.js';
import { adopt, takeInFromStep, foundlingRecord, absorbMail, keepLetter } from '../src/ui/kin.js';
import { kinCardHTML, foundOnStep } from '../src/ui/kin-card.js';
import { normalizeState } from '../src/state.js';
import { readResident, residentSnapshot, cleanImage } from '../src/cloud/social.js';
import { generateCreature, BODIES, PALETTES } from '../src/art/creatures.js';
import { TRAIT_BY_ID } from '../src/content/traits.js';
import { householdFixture } from './household-fixtures.mjs';

const NODASH = /[\u2013\u2014]/;
const NOW = Date.UTC(2026, 9, 11, 12);
const BASKET = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
// A small real PNG, as the fixtures build one.
const DRAWING = householdFixture('drawing-heavy', NOW).pets[0].art.body;
const made = (name, seed, traits = ['spiteful', 'damp']) => readResident(residentSnapshot({ id: 'm-' + seed, name, traits, bond: 2, art: { body: '', stamps: [], creature: generateCreature({ seed }) } }));
const drawn = (name, id, stamps = [{ kind: 'horns', x: 320, y: 200, size: 40, rotation: 0, color: '#A32C3C' }, { kind: 'eyes', x: 300, y: 300, size: 40, rotation: 0, color: '#F2E9DC' }]) =>
  readResident(residentSnapshot({ id, name, traits: ['litigious'], bond: 1, art: { body: DRAWING, stamps, bounds: { x: .12, y: .15, width: .7, height: .76 } } }));

test('a foundling id is the same on both shelves and a valid pet id', () => {
  assert.equal(foundlingId(BASKET), 'kin0a1b2c3d4e5f');
  assert.match(foundlingId(BASKET), /^[a-zA-Z0-9_-]{1,100}$/);
});

test('names come from both parents, change with each re-roll, and never run long', () => {
  assert.equal(nameCore('Lord Dampington III'), 'Dampington');
  assert.equal(nameCore('  Mrs   Widow '), 'Widow');
  const names = Array.from({ length: NAME_ROLLS }, (_, roll) => foundlingName('Mabel', 'Grubbs', 4242, roll));
  assert.deepEqual(names, Array.from({ length: NAME_ROLLS }, (_, roll) => foundlingName('Mabel', 'Grubbs', 4242, roll)), 'deterministic');
  assert.notEqual(names[0], names[1], 'a re-roll gives another name');
  assert.ok(new Set(names).size >= 30, 'fifty rolls give plenty of different names: ' + new Set(names).size);
  const candidates = nameCandidates('Mabel', 'Grubbs');
  assert.ok(candidates.length >= 4, candidates.join(','));
  assert.ok(candidates.every(n => !['mabel', 'grubbs'].includes(n.toLowerCase())), 'never just one parent’s name');
  for (const [a, b] of [['Mabel', 'Grubbs'], ['Lord Dampington III', 'Pip'], ['Zoë', 'Ægir'], ['名前', 'Bob'], ['X', 'Y'], ['', ''], ['Agnes'.repeat(5), 'Mothball'.repeat(3)]]) {
    for (let roll = 0; roll < 12; roll++) {
      const name = foundlingName(a, b, 9 + roll, roll);
      assert.ok(name && [...name].length <= MAX_NAME, a + '+' + b + ': ' + name);
      assert.ok(!NODASH.test(name) && !name.includes('-'), name);
      assert.ok(!/[{}]/.test(name), name);
    }
  }
  assert.ok(nameCandidates('Lord Dampington III', 'Pip').some(n => /amp|ip|ton/i.test(n)), 'titles and numerals are not the name');
});

test('the birth line names both parents in the house style', () => {
  const line = birthLine('Mabel', 'Grubbs', 77);
  assert.equal(line, birthLine('Mabel', 'Grubbs', 77));
  assert.match(line, /Mabel’s .+ and Grubbs’s /);
  assert.ok(!NODASH.test(line) && !/[{}'"]/.test(line), line);
  const lines = new Set(Array.from({ length: 200 }, (_, i) => birthLine('A', 'B', i)));
  assert.ok(lines.size > 150, 'birth lines vary: ' + lines.size);
});

test('one trait from each parent and one wild one', () => {
  for (let seed = 0; seed < 200; seed++) {
    const traits = blendTraits(['spiteful', 'damp'], ['litigious', 'sugar'], seed);
    assert.equal(traits.length, 3);
    assert.equal(new Set(traits).size, 3);
    assert.ok(['spiteful', 'damp'].includes(traits[0]));
    assert.ok(['litigious', 'sugar'].includes(traits[1]));
    assert.ok(!['spiteful', 'damp', 'litigious', 'sugar'].includes(traits[2]), 'the wild trait is neither parent’s');
    assert.ok(traits.every(t => TRAIT_BY_ID[t]));
  }
  assert.equal(blendTraits([], ['nope'], 3).length, 3, 'parents without known traits still make a full set');
  assert.deepEqual(blendTraits(['spiteful'], ['spiteful'], 1).filter(t => t === 'spiteful').length, 1);
});

test('two generated parents: the same seed always makes the same child, from parts either parent had', () => {
  const a = made('Mabel', 'kin-a'), b = made('Grubbs', 'kin-b', ['litigious', 'sugar']);
  const one = planFoundling({ a, b, seed: 1234 }), two = planFoundling({ a, b, seed: 1234 });
  assert.deepEqual(JSON.parse(JSON.stringify(one)), JSON.parse(JSON.stringify(two)));
  assert.equal(one.look, 'made');
  const looks = new Set();
  for (let seed = 0; seed < 120; seed++) {
    const plan = planFoundling({ a, b, seed });
    const c = plan.art.creature;
    looks.add(JSON.stringify([c.body, c.palette, c.parts]));
    assert.ok([a.art.creature.body, b.art.creature.body].includes(c.body), 'body from a parent');
    assert.ok([a.art.creature.palette, b.art.creature.palette].includes(c.palette), 'palette from a parent');
    for (const [slot, part] of Object.entries(c.parts)) {
      assert.ok(partFits(c.body, slot, part, c.parts), slot + ' ' + part + ' fits ' + c.body);
      assert.ok([a.art.creature.parts[slot], b.art.creature.parts[slot], 'none', 'pair', 'smirk'].includes(part), slot + ': ' + part);
    }
  }
  assert.ok(looks.size > 30, 'seeds make different children: ' + looks.size);
});

test('a drawn parent lends its ink and features to a generated one', () => {
  const a = made('Mabel', 'kin-ink'), b = drawn('Scribble', 'd1');
  const plan = planFoundling({ a, b, seed: 55, inks: { b: '#3366aa' } });
  assert.equal(plan.look, 'inked');
  assert.equal(plan.art.creature.colors.body, '#3366aa');
  assert.ok(plan.borrowed.length <= 2);
  for (const borrowed of plan.borrowed) assert.equal(plan.art.creature.parts[borrowed.slot], borrowed.part);
  // Black ink gets a pale line, so the face stays visible.
  const dark = inkCreature(a.art.creature, b.art, '#111111', 3).creature;
  assert.ok(luminance(dark.colors.line) > .3);
  // Without a canvas the stamps' colour stands in for the ink.
  const noInk = planFoundling({ a, b, seed: 55 });
  assert.equal(noInk.art.creature.colors.body, '#a32c3c');
});

test('two drawn parents make a patchwork, with a plain fallback until it is stitched', () => {
  const a = drawn('Scribble', 'd1'), b = drawn('Doodle', 'd2', [{ kind: 'wing', x: 420, y: 260, size: 50, rotation: 10, color: '#7FD8C0' }]);
  const plan = planFoundling({ a, b, seed: 8 });
  assert.equal(plan.look, 'patchwork');
  assert.ok(['a', 'b'].includes(plan.patch.left) && plan.patch.left !== plan.patch.right);
  assert.equal(plan.art.body, DRAWING, 'the fallback is one parent’s own drawing');
  assert.ok(plan.art.stamps.length >= 2 && plan.art.stamps.length <= 48);
  const layout = patchLayout({ x: .1, y: .1, width: .8, height: .8 }, { x: .3, y: .05, width: .3, height: .9 });
  assert.ok(Math.abs(layout.left.box.x + layout.left.box.width - .5) < 1e-9 && Math.abs(layout.right.box.x - .5) < 1e-9, 'the halves meet in the middle');
  for (const box of [layout.bounds, layout.left.box, layout.right.box]) for (const k of ['x', 'y']) assert.ok(box[k] >= 0 && box[k] + (k === 'x' ? box.width : box.height) <= 1.0001, JSON.stringify(box));
  const stitched = patchworkPlan(a.art, b.art, 8);
  for (const s of stitched.stamps) assert.ok(s.x >= 0 && s.x <= 640 && s.y >= 0 && s.y <= 640 && s.size > 0);
  assert.ok(stitched.stamps.length <= a.art.stamps.length + b.art.stamps.length, 'only stamps on the kept halves survive');
});

test('every kind of foundling is a valid resident, within the image caps, that survives a save', async () => {
  const pairs = [
    [made('Mabel', 'v1'), made('Grubbs', 'v2')],
    [made('Mabel', 'v3'), drawn('Scribble', 'd3')],
    [drawn('Scribble', 'd4'), made('Grubbs', 'v5')],
    [drawn('Scribble', 'd6'), drawn('Doodle', 'd7')],
    [readResident({ id: 'x', name: 'Nobody', traits: [], art: null }), readResident({ id: 'y', name: 'Else', traits: [], art: null })]
  ];
  for (const [i, [a, b]] of pairs.entries()) {
    const plan = await realizeFoundling({ a, b, seed: 900 + i });
    const pet = foundlingPet(plan, { basketId: BASKET.replace(/.$/, String(i)), born: NOW - 1000 });
    if (pet.art.body) assert.ok(cleanImage(pet.art.body) && pet.art.body.length <= MAX_FOUNDLING_IMAGE, 'image cap');
    assert.ok(JSON.stringify(pet).length < 150000);
    const state = householdFixture('established', NOW);
    state.pets.push(pet); state.slots[state.slots.indexOf(null)] = pet.id;
    const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
    assert.ok(loaded, 'normalizeState accepts it');
    const back = loaded.pets.find(p => p.id === pet.id);
    assert.equal(back.name, pet.name);
    assert.deepEqual(back.traits, pet.traits);
    assert.equal(back.traits.length, 3);
    if (pet.art.creature) assert.deepEqual(back.art.creature, pet.art.creature);
    else assert.equal(back.art.body, pet.art.body);
    assert.ok(back.bio.startsWith(plan.birth));
    // It can travel to a friend's shelf like anyone else.
    assert.ok(readResident(residentSnapshot(back)));
  }
});

test('the ink reader picks the commonest opaque colour', () => {
  const w = 20, h = 10, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, alpha] = i < 120 ? [200, 40, 60, 255] : i < 180 ? [20, 20, 20, 255] : [255, 255, 255, 0];
    data.set([r, g, b, alpha], i * 4);
  }
  assert.equal(dominantInk(data, w, h), '#c8283c');
  assert.equal(dominantInk(new Uint8ClampedArray(16), 2, 2), null);
});

test('envelopes, seals and portraits are plain markup that escapes names', () => {
  const svg = envelopeSVG({ seed: 5, traits: ['doom'], to: '<Mabel>', open: true });
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('&lt;Mabel&gt;') && !svg.includes('<Mabel>'));
  assert.equal(sealFor(5, ['doom']).wax, '#2E2433');
  assert.deepEqual(sealFor(5, []), sealFor(5, []));
  assert.match(portraitHTML(made('Mabel', 'p1').art), /<svg /);
  const drawing = portraitHTML(drawn('Scribble', 'd8').art);
  assert.match(drawing, /<img src="data:image\/png;base64,/);
  assert.ok(!portraitHTML({ body: 'javascript:alert(1)', stamps: [] }).includes('javascript'));
});

test('the household record is small, capped, additive and idempotent', () => {
  assert.deepEqual(normalizeKin(undefined), blankKin());
  const old = householdFixture('established', NOW);
  delete old.kin;
  assert.deepEqual(normalizeState(old).kin, blankKin(), 'an old save loads with nothing');
  const parent = (id, home) => home ? { id, name: id, home: true } : { id, name: id, home: false, friend: BASKET, shelf: 'Bea' };
  const letters = Array.from({ length: 14 }, (_, i) => ({ id: '00000000-0000-4000-8000-0000000000' + String(10 + i), pal: BASKET, week: 140 + i, at: NOW - i, dir: 'in', kind: 'weekly',
    mine: 'qa0', theirs: 'Grubbs', friend: BASKET, shelf: 'Bea', text: 'Dear Agnes,\n\nHello.', read: false, junk: 'x', cards: { seed: 5, writer: { name: 'G', traits: ['spiteful'] }, reader: { name: 'A', traits: [] } } }));
  const raw = { foundlings: [{ pet: 'qa2', basket: BASKET, born: NOW, name: 'Grubel', parents: [parent('qa0', true), parent('b0', false)], twin: { friend: BASKET, shelf: 'Bea' }, extra: 1 },
    { pet: 'bad', basket: 'nope', parents: [] }], letters, step: [{ basket: BASKET, at: NOW, pet: { id: 'qa1', name: 'Taken' } }], notices: [{ basket: BASKET, pet: 'qa2', at: NOW, text: 'Hi' }],
    collected: [BASKET, BASKET, 'nope'], surprise: { a: 1 } };
  const kin = normalizeKin(raw, { pets: [{ id: 'qa1' }] }, NOW);
  assert.deepEqual(Object.keys(kin), ['foundlings', 'letters', 'step', 'notices', 'collected']);
  assert.equal(kin.foundlings.length, 1);
  assert.equal(kin.foundlings[0].extra, undefined);
  assert.equal(kin.letters.length, KIN_LETTERS_PER_PAL, 'ten per pair');
  assert.equal(kin.letters[0].week, 144, 'the newest are kept');
  assert.equal(kin.letters[0].junk, undefined);
  assert.equal(kin.letters[0].cards.seed, 5);
  assert.equal(kin.step.length, 0, 'a step resident already on the shelf, or without a record, is dropped');
  assert.deepEqual(kin.collected, [BASKET]);
  assert.deepEqual(normalizeKin(JSON.parse(JSON.stringify(kin)), { pets: [] }, NOW), kin, 'idempotent');
  const state = householdFixture('established', NOW);
  state.kin = raw;
  const once = normalizeState(state), twice = normalizeState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice.kin, once.kin);
  assert.equal(foundOnStep(once, once.kin.foundlings[0]), 'Found on the step. Parents: Agnes (yours) and b0 (Bea’s shelf).');
});

test('a foundling moves into a free space, or waits on the step until there is one', () => {
  const state = householdFixture('nearly-full', NOW);
  const free = state.slots.filter(s => !s).length;
  assert.equal(free, 1);
  const basket = { id: BASKET, fromUser: '00000000-0000-4000-8000-00000000000a', toUser: '00000000-0000-4000-8000-00000000000b', fromName: 'Ada', toName: 'Bea',
    fromParent: { id: 'qa0', name: 'Agnes' }, toParentId: 'b0', toParentName: 'Grubbs', toParent: { id: 'b0', name: 'Grubbs' } };
  const plan = planFoundling({ a: made('Agnes', 's1'), b: made('Grubbs', 's2'), seed: 1 });
  const pet = foundlingPet(plan, { basketId: BASKET, born: NOW });
  const record = foundlingRecord(basket, pet, 'out');
  assert.deepEqual(record.parents.map(p => [p.id, p.home, p.shelf]), [['qa0', true, ''], ['b0', false, 'Bea']]);
  assert.equal(adopt(state, pet, record, plan.birth), 'adopted');
  assert.equal(adopt(state, pet, record, plan.birth), 'here', 'never twice');
  assert.equal(hasRoom(state), false);
  assert.match(kinCardHTML(state, pet), /Found on the step\. Parents: Agnes \(yours\) and Grubbs \(Bea’s shelf\)\./);
  assert.match(kinCardHTML(state, state.pets[0]), /Agnes’s foundlings/);
  const OTHER = 'f' + BASKET.slice(1);
  const second = foundlingPet(plan, { basketId: OTHER, born: NOW });
  assert.equal(adopt(state, second, { ...record, pet: second.id, basket: OTHER }, plan.birth), 'full');
  kinState(state).step.push({ basket: OTHER, at: NOW, pet: second, record: { ...record, pet: second.id, basket: OTHER }, note: plan.birth });
  assert.equal(takeInFromStep(state, OTHER), 'full');
  state.props.pop(); state.slots[state.slots.indexOf('qad2')] = null;
  assert.equal(takeInFromStep(state, OTHER), 'adopted');
  assert.equal(kinState(state).step.length, 0);
  assert.ok(normalizeState(JSON.parse(JSON.stringify(state))), 'still a valid save');
  assert.equal(FULL_SHELF.includes('full'), true);
});

test('absorbing mail keeps letters, adopts our foundling once and writes the same child as the other shelf', async () => {
  const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', PAL = '00000000-0000-4000-8000-0000000000aa';
  const a = made('Agnes', 'abs-a'), b = made('Grubbs', 'abs-b', ['litigious']);
  const basket = { id: BASKET, direction: 'out', status: 'born', fromUser: A, toUser: B, fromName: 'Ada', toName: 'Bea', fromParent: a, toParentId: b.id, toParentName: 'Grubbs',
    toParent: b, seed: 31337, nameRoll: 2, collected: false };
  const mail = { user: A, baskets: [], births: [basket], pals: [{ id: PAL, friend: B, mine: { id: 'qa0', name: 'Agnes' }, theirs: { id: b.id, name: 'Grubbs' }, history: 'foundling', basket: BASKET, seed: 99 }],
    letters: [{ id: '00000000-0000-4000-8000-0000000000bb', pal: PAL, from: B, kind: 'weekly', week: 150, writer: { id: b.id, name: 'Grubbs', traits: ['litigious'], mood: 'fine' },
      reader: { id: 'qa0', name: 'Agnes', traits: [], mood: 'fine' }, createdAt: NOW }] };
  const state = householdFixture('established', NOW);
  const collected = [];
  const result = await absorbMail({ state, mail, kin: { userId: () => A, collect: id => { collected.push(id); return Promise.resolve(true); } }, shelfName: () => 'Bea', now: NOW });
  assert.equal(result.adopted.length, 1);
  const child = state.pets.find(p => p.id === foundlingId(BASKET));
  // What the other shelf makes from the same basket.
  const theirs = await realizeFoundling({ a, b, seed: 31337 });
  assert.equal(child.name, foundlingName('Agnes', 'Grubbs', 31337, 2));
  assert.deepEqual(child.traits, theirs.traits);
  assert.deepEqual(child.art.creature, theirs.art.creature);
  assert.deepEqual(collected, [BASKET]);
  assert.deepEqual(state.kin.collected, [BASKET]);
  assert.equal(state.kin.letters.length, 1);
  assert.match(state.kin.letters[0].text, /^Dear Agnes,/);
  assert.ok(state.kin.letters[0].cards);
  assert.equal(state.kin.notices.length, 1);
  const again = await absorbMail({ state, mail, kin: { userId: () => A, collect: () => Promise.resolve(true) }, now: NOW });
  assert.equal(again.changed, false, 'nothing twice');
  assert.equal(state.pets.filter(p => p.id === child.id).length, 1);
  // A letter for a pair the server no longer sends is not kept.
  assert.equal(keepLetter(state, { ...mail, pals: [] }, mail.letters[0]), null);
});

test('a veteran household keeps its foundling, parents and letters through a backup and restore', async () => {
  const { createBackup } = await import('../src/backup.js');
  const source = householdFixture('veteran', NOW);
  const loaded = normalizeState(JSON.parse(createBackup(source, NOW).text));
  assert.deepEqual(loaded.kin, source.kin);
  assert.match(kinCardHTML(loaded, loaded.pets.find(p => p.id === 'qa2')), /Found on the step\. Parents: Agnes \(yours\) and Grubbs \(Bea’s shelf\)\./);
  const card = kinCardHTML(loaded, loaded.pets[0]);
  assert.match(card, /Correspondence <small>2<\/small>/);
  assert.match(card, /With Grubbs, of Bea’s shelf/);
  assert.match(card, /Agnes’s foundlings/);
});
