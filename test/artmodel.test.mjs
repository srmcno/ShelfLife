// The art model: one pet shape, two kinds of artwork.
//
// A pet stores { body, stamps } (freehand raster) and MAY additionally store
// `creature` (a generated vector creature). These tests pin the two things that
// break silently if the branch is wrong: an existing raster pet must survive
// every code path byte-for-byte, and a generated pet must resolve its anatomy —
// gait and capabilities — from the creature rather than falling back to the
// legless-blob profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePetArt, migratePet, normalizeState, SLOT_COUNT } from '../src/state.js';
import { resolveMotion } from '../src/art/anatomy.js';
import { footY, creatureFootDrop } from '../src/art/sprite.js';
import { generateCreature, BODIES, BASELINE, BODY_IDS } from '../src/art/creatures.js';

const RASTER = 'data:image/png;base64,iVBORw0KGgo=';

function rasterPet(over = {}) {
  return {
    id: 'p1', name: 'Old Blob', art: { body: RASTER, stamps: [{ kind: 'wing', x: 10, y: 10, size: 20 }] },
    traits: ['thief'], needs: { food: 50, fuss: 50, clean: 50 },
    bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...over
  };
}

function creaturePet(creature, over = {}) {
  return {
    id: 'p2', name: 'Legs McGee', art: { body: '', stamps: [], creature },
    traits: ['wanderer'], needs: { food: 50, fuss: 50, clean: 50 },
    bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...over
  };
}

/* ---------------- normalizePetArt ---------------- */

test('normalizePetArt keeps a freehand pet exactly as it was, and adds no creature key', () => {
  const art = normalizePetArt({ body: RASTER, stamps: [{ kind: 'tail', x: 1, y: 2, size: 3 }] });
  assert.equal(art.body, RASTER);
  assert.equal(art.stamps.length, 1);
  assert.equal('creature' in art, false);
});

test('normalizePetArt turns the studio\'s { creature } into the stored shape', () => {
  const c = generateCreature({ seed: 'store-1' });
  const art = normalizePetArt({ creature: c });
  // A generated pet stores no raster fallback — vector is the point — but the
  // {body,stamps} keys stay present so every existing reader keeps its shape.
  assert.equal(art.body, '');
  assert.deepEqual(art.stamps, []);
  assert.equal(art.creature, c);
});

test('normalizePetArt survives junk without throwing', () => {
  for (const junk of [undefined, null, 'nope', 42, {}, { body: 7, stamps: 'x', creature: 'x' }]) {
    const art = normalizePetArt(junk);
    assert.equal(typeof art.body, 'string');
    assert.ok(Array.isArray(art.stamps));
    assert.equal('creature' in art, false);
  }
});

/* ---------------- migration safety ---------------- */

test('migratePet returns an existing v4 raster pet untouched (same object identity)', () => {
  const pet = rasterPet();
  assert.equal(migratePet(pet), pet);
});

test('migratePet still upgrades a pre-v4 pet (flat img, no art)', () => {
  const old = { id: 'p0', name: 'Ancient', img: RASTER, needs: { food: 1, fuss: 1, clean: 1 } };
  const p = migratePet(old);
  assert.equal(p.art.body, RASTER);
  assert.deepEqual(p.art.stamps, []);
  assert.equal('img' in p, false);
  assert.equal(p.grudgeStage, 0);
  assert.equal('creature' in p.art, false);
});

test('migratePet leaves a canonical generated pet untouched (same object identity)', () => {
  const pet = creaturePet(generateCreature({ seed: 'mig-1' }));
  assert.equal(migratePet(pet), pet);
});

test('migratePet repairs a generated pet whose save lost body/stamps', () => {
  const c = generateCreature({ seed: 'mig-2' });
  const p = migratePet({ id: 'p3', name: 'Half Saved', art: { creature: c } });
  assert.equal(p.art.creature, c);
  assert.equal(p.art.body, '');
  assert.deepEqual(p.art.stamps, []);
  assert.equal(p.grudgeStage, 0);
});

test('normalizeState loads a mixed shelf of raster and generated pets', () => {
  const c = generateCreature({ seed: 'mixed-1' });
  const raw = { pets: [rasterPet(), creaturePet(c), { id: 'p0', name: 'Ancient', img: RASTER }] };
  const s = normalizeState(raw);
  assert.equal(s.pets.length, 3);
  assert.equal(s.slots.length, SLOT_COUNT);
  // raster survives
  assert.equal(s.pets[0].art.body, RASTER);
  assert.equal(s.pets[0].art.stamps.length, 1);
  assert.equal('creature' in s.pets[0].art, false);
  // generated survives, creature intact
  assert.equal(s.pets[1].art.creature.body, c.body);
  assert.deepEqual(s.pets[1].art.creature.parts, c.parts);
  // pre-v4 still upgrades
  assert.equal(s.pets[2].art.body, RASTER);
  // and everyone got the defaults they need to tick
  s.pets.forEach(p => {
    assert.equal(typeof p.needs.food, 'number');
    assert.equal(typeof p.grudgeStage, 'number');
  });
});

test('a generated pet round-trips through JSON without losing its creature', () => {
  const c = generateCreature({ seed: 'json-1' });
  const before = creaturePet(c);
  const after = normalizeState(JSON.parse(JSON.stringify({ pets: [before] }))).pets[0];
  assert.deepEqual(after.art.creature, JSON.parse(JSON.stringify(c)));
  assert.equal(after.art.body, '');
});

/* ---------------- anatomy resolution ---------------- */

test('resolveMotion reads a generated pet\'s anatomy from art.creature', () => {
  // Cover every gait the generator can produce, not one lucky seed.
  const byGait = {};
  for (let i = 0; i < 600 && Object.keys(byGait).length < 4; i++) {
    const c = generateCreature({ seed: 'gait-' + i });
    if (!byGait[c.anatomy.gait]) byGait[c.anatomy.gait] = c;
  }
  assert.ok(Object.keys(byGait).length >= 3, 'expected several gaits in 600 rolls');

  for (const [gait, c] of Object.entries(byGait)) {
    const m = resolveMotion(creaturePet(c));
    assert.equal(m.source, 'anatomy', gait + ': should resolve from the creature, not from stamps');
    assert.equal(m.gait, gait);
    assert.equal(m.legs, c.anatomy.legCount);
    assert.equal(m.arms, c.anatomy.armCount);
    assert.equal(m.canWalk, c.anatomy.legCount >= 1);
    assert.equal(m.canFlap, c.anatomy.hasWings);
  }
});

test('resolveMotion still reads a freehand pet from its stamps, and a bare blob hops', () => {
  const winged = resolveMotion(rasterPet());
  assert.equal(winged.source, 'stamps');
  assert.equal(winged.canFlap, true);
  assert.equal(winged.gait, 'flap');

  const blob = resolveMotion(rasterPet({ art: { body: RASTER, stamps: [] } }));
  assert.equal(blob.source, 'none');
  assert.equal(blob.gait, 'hop');
  assert.equal(blob.canWalk, false);
});

test('an explicit pet.art.anatomy still outranks a creature (the older contract wins)', () => {
  const c = generateCreature({ seed: 'override-1' });
  const pet = creaturePet(c);
  pet.art.anatomy = { hasLegs: true, legCount: 6, hasWings: false, gait: 'scuttle' };
  const m = resolveMotion(pet);
  assert.equal(m.gait, 'scuttle');
  assert.equal(m.legs, 6);
});

/* ---------------- footing ---------------- */

test('footY puts a legged creature on BASELINE and a legless one on its own base', () => {
  let checkedLegged = false, checkedLegless = false;
  for (let i = 0; i < 400 && !(checkedLegged && checkedLegless); i++) {
    const c = generateCreature({ seed: 'foot-' + i });
    if (c.anatomy.hasLegs) {
      assert.equal(footY(c), BASELINE);
      checkedLegged = true;
    } else {
      // A legless creature has no feet; it rests on its belly, which is the
      // body's own `base`. Aligning it to BASELINE would leave it hovering.
      assert.equal(footY(c), BODIES[c.body].base);
      checkedLegless = true;
    }
  }
  assert.ok(checkedLegged && checkedLegless, 'expected both legged and legless rolls');
});

test('creatureFootDrop stays a small, sane fraction of the sprite box for every body', () => {
  BODY_IDS.forEach(body => {
    const c = generateCreature({ seed: 'drop-' + body, body });
    const drop = creatureFootDrop(c);
    assert.ok(drop >= 0.05 && drop <= 0.2, body + ' drop out of range: ' + drop);
  });
});

test('footY falls back to BASELINE rather than throwing on a broken creature', () => {
  assert.equal(footY(null), BASELINE);
  assert.equal(footY({}), BASELINE);
  assert.equal(footY({ body: 'not-a-body' }), BASELINE);
});
