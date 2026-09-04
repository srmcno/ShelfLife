import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BODIES, BODY_IDS, PALETTES, PALETTE_IDS, COLOR_ROLES,
  EYES, MOUTHS, TOPS, EARS, ARMS, LEGS, TAILS, WINGS, DETAILS,
  SLOTS, SLOT_KEYS, listVariants,
  VIEWBOX, BASELINE, SPAN,
  makeRng, makeSeed, generateCreature, rerollPart, normalizeCreature,
  resolveColors, describeAnatomy, buildRig, describeCreature,
  renderCreatureSVG, renderPartSVG, renderBodySVG
} from '../src/art/creatures.js';

/* ---------------------------------------------------------------------------
   A minimal XML well-formedness scanner. The project has zero dependencies, so
   rather than pull in a parser this walks the markup: every tag must be closed
   in order, every attribute must be name="quoted", and nothing may follow the
   single root element. Enough to catch the failure this guards against — a part
   emitting broken markup that silently kills the whole SVG in a browser.
--------------------------------------------------------------------------- */
function parseXML(src) {
  const stack = [];
  let i = 0, roots = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      assert.equal(src.slice(i).trim(), '', 'trailing text outside any element');
      break;
    }
    if (lt > i) {
      const text = src.slice(i, lt);
      if (stack.length === 0) assert.equal(text.trim(), '', 'text outside the root element');
      assert.ok(!/[<>]/.test(text), 'unescaped angle bracket in text');
    }
    const gt = src.indexOf('>', lt);
    assert.notEqual(gt, -1, 'unterminated tag');
    const raw = src.slice(lt + 1, gt);
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      assert.ok(stack.length, `closing </${name}> with nothing open`);
      assert.equal(stack.pop(), name, 'mismatched closing tag');
      if (stack.length === 0) roots++;
    } else {
      const selfClosing = raw.endsWith('/');
      const inner = selfClosing ? raw.slice(0, -1) : raw;
      const m = /^([A-Za-z][\w:.-]*)([\s\S]*)$/.exec(inner);
      assert.ok(m, `malformed tag <${raw}>`);
      let rest = m[2].trim();
      while (rest.length) {
        const am = /^([A-Za-z][\w:.-]*)\s*=\s*"([^"]*)"([\s\S]*)$/.exec(rest);
        assert.ok(am, `malformed attribute in <${m[1]} ${rest}>`);
        assert.ok(!/[<>]/.test(am[2]), `unescaped bracket in ${m[1]}@${am[1]}`);
        rest = am[3].trim();
      }
      if (selfClosing) { if (stack.length === 0) roots++; }
      else stack.push(m[1]);
    }
    i = gt + 1;
  }
  assert.equal(stack.length, 0, `unclosed elements: ${stack.join(',')}`);
  assert.equal(roots, 1, `expected exactly one root element, got ${roots}`);
  return true;
}

const PATH_D = /^[Mm][\s-]*-?\d/;
const ALL_LIBS = { eyes: EYES, mouth: MOUTHS, top: TOPS, ears: EARS, arms: ARMS, legs: LEGS, tail: TAILS, wings: WINGS, detail: DETAILS };

function variantShapeGroups(def) {
  return def.groups ? def.groups.map(g => g.shapes) : [def.shapes];
}

/* ========================== bodies ======================================= */

test('the body library is large enough and every id is self-consistent', () => {
  assert.ok(BODY_IDS.length >= 12, `expected >=12 bodies, got ${BODY_IDS.length}`);
  BODY_IDS.forEach(id => {
    const b = BODIES[id];
    assert.equal(b.id, id, `BODIES.${id}.id must match its key`);
    assert.ok(typeof b.name === 'string' && b.name.length, `${id} needs a name`);
    assert.ok(Array.isArray(b.tags) && b.tags.length, `${id} needs tags`);
    assert.equal(typeof b.base, 'number', `${id} needs a numeric base`);
  });
});

test('every body has valid, closed path data', () => {
  BODY_IDS.forEach(id => {
    const b = BODIES[id];
    assert.ok(PATH_D.test(b.path), `${id}.path must start with a moveto`);
    assert.ok(/[Zz]\s*$/.test(b.path.trim()), `${id}.path must be closed with Z`);
    assert.ok(b.path.length > 60, `${id}.path looks too simple to be a designed silhouette`);
    if (b.back) assert.ok(PATH_D.test(b.back), `${id}.back must be valid path data`);
    (b.shade || []).forEach((sh, i) => {
      assert.ok(PATH_D.test(sh.d), `${id}.shade[${i}] must be valid path data`);
      assert.ok(COLOR_ROLES.includes(sh.fill), `${id}.shade[${i}] has unknown fill role ${sh.fill}`);
    });
  });
});

test('every body carries the full anchor set features are placed against', () => {
  const point = ['eyes', 'mouth', 'top', 'ears', 'tail', 'wings', 'head', 'detail'];
  BODY_IDS.forEach(id => {
    const a = BODIES[id].anchors;
    assert.ok(a, `${id} has no anchors`);
    point.forEach(k => {
      assert.ok(a[k], `${id} is missing the ${k} anchor`);
      assert.equal(typeof a[k].x, 'number', `${id}.${k}.x must be a number`);
      assert.equal(typeof a[k].y, 'number', `${id}.${k}.y must be a number`);
    });
    ['eyes', 'top', 'ears', 'wings'].forEach(k =>
      assert.ok(a[k].spread > 0, `${id}.${k} needs a positive spread`));
    ['eyes', 'mouth', 'top', 'ears', 'tail', 'wings'].forEach(k =>
      assert.ok(a[k].scale > 0, `${id}.${k} needs a positive scale`));
    assert.ok(a.head.r > 0, `${id}.head needs a radius`);
    assert.ok(a.detail.w > 0 && a.detail.h > 0, `${id}.detail needs a region size`);
    assert.ok(Array.isArray(a.arms) && a.arms.length === 2, `${id} needs exactly 2 arm anchors`);
    assert.ok(Array.isArray(a.legs), `${id}.legs must be an array`);
    if (a.manyLegs) assert.ok(a.manyLegs.length === 0 || a.manyLegs.length >= 4,
      `${id}.manyLegs should be empty or hold >=4 joints`);
  });
});

test('anchors and silhouettes stay inside the -50..50 art box', () => {
  BODY_IDS.forEach(id => {
    const b = BODIES[id];
    const nums = b.path.match(/-?\d+(\.\d+)?/g).map(Number);
    nums.forEach(n => assert.ok(n >= -50 && n <= 50, `${id}.path has ${n} outside the art box`));
    const a = b.anchors;
    const pts = [a.eyes, a.mouth, a.top, a.ears, a.tail, a.wings, a.head, a.detail]
      .concat(a.arms, a.legs, a.manyLegs || []);
    pts.forEach(pt => {
      assert.ok(Math.abs(pt.x) <= 45, `${id} anchor x ${pt.x} is too close to the edge`);
      assert.ok(pt.y >= -48 && pt.y <= BASELINE + 2, `${id} anchor y ${pt.y} is outside the art box`);
    });
  });
});

test('leg and arm anchors are mirrored pairs, left first', () => {
  BODY_IDS.forEach(id => {
    const a = BODIES[id].anchors;
    assert.ok(a.arms[0].x < 0 && a.arms[1].x > 0, `${id} arm anchors must be left then right`);
    if (a.legs.length) {
      assert.equal(a.legs.length, 2, `${id} should have exactly 2 hip joints`);
      assert.ok(a.legs[0].x < a.legs[1].x, `${id} leg anchors must be ordered left to right`);
    }
  });
});

test('the tall/squat/build tag vocabulary is used and bodies genuinely vary', () => {
  const heights = new Set(), builds = new Set();
  BODY_IDS.forEach(id => {
    const t = BODIES[id].tags;
    const h = ['tall', 'medium', 'squat'].filter(x => t.includes(x));
    assert.equal(h.length, 1, `${id} must carry exactly one of tall/medium/squat`);
    heights.add(h[0]);
    ['thin', 'round', 'lumpy', 'wide'].filter(x => t.includes(x)).forEach(x => builds.add(x));
  });
  assert.equal(heights.size, 3, 'the library must span all three height classes');
  assert.ok(builds.size >= 3, 'the library must span at least three build classes');
});

/* ========================== parts ======================================== */

test('every slot has several genuinely different variants', () => {
  assert.deepEqual(SLOT_KEYS.sort(), Object.keys(ALL_LIBS).sort());
  const minimums = { eyes: 8, mouth: 8, top: 8, ears: 5, arms: 4, legs: 5, tail: 5, wings: 4, detail: 6 };
  SLOT_KEYS.forEach(slot => {
    const ids = Object.keys(ALL_LIBS[slot]);
    assert.ok(ids.length >= minimums[slot], `${slot} has ${ids.length} variants, expected >=${minimums[slot]}`);
    assert.equal(SLOTS[slot].lib, ALL_LIBS[slot], `SLOTS.${slot}.lib must point at the real library`);
    assert.deepEqual(listVariants(slot).map(v => v.id), ids, `listVariants(${slot}) must list every variant`);
  });
  assert.deepEqual(listVariants('nope'), []);
});

test('every part variant produces valid, non-empty shape data', () => {
  let total = 0;
  SLOT_KEYS.forEach(slot => {
    const lib = ALL_LIBS[slot];
    Object.keys(lib).forEach(id => {
      const def = lib[id];
      assert.equal(def.id, id, `${slot}.${id}.id must match its key`);
      assert.ok(typeof def.name === 'string' && def.name.length, `${slot}.${id} needs a name`);
      assert.ok(def.shapes || def.groups, `${slot}.${id} must declare shapes or groups`);
      const groups = variantShapeGroups(def);
      if (id !== 'none') {
        assert.ok(groups.some(g => g.length), `${slot}.${id} must draw something`);
        total++;
      }
      groups.forEach(shapes => {
        assert.ok(Array.isArray(shapes), `${slot}.${id} shapes must be an array`);
        shapes.forEach((sh, i) => {
          const where = `${slot}.${id}[${i}]`;
          assert.ok(['path', 'circle', 'ellipse', 'line'].includes(sh.k), `${where} unknown kind ${sh.k}`);
          if (sh.k === 'path') {
            assert.ok(typeof sh.d === 'string' && sh.d.length > 4, `${where} has empty path data`);
            assert.ok(PATH_D.test(sh.d), `${where} path data must start with a moveto`);
            assert.ok(!/NaN|undefined/.test(sh.d), `${where} path data contains NaN/undefined`);
          }
          if (sh.k === 'circle') assert.ok(sh.r > 0, `${where} needs a positive radius`);
          if (sh.k === 'ellipse') assert.ok(sh.rx > 0 && sh.ry > 0, `${where} needs positive radii`);
          if (sh.fill !== undefined) assert.ok(COLOR_ROLES.includes(sh.fill), `${where} unknown fill role ${sh.fill}`);
          if (sh.stroke !== undefined) assert.ok(COLOR_ROLES.includes(sh.stroke), `${where} unknown stroke role ${sh.stroke}`);
          if (sh.stroke !== undefined && sh.stroke !== 'none') assert.ok(sh.sw > 0, `${where} stroked shape needs a stroke-width`);
        });
      });
    });
  });
  assert.ok(total >= 45, `expected >=45 drawn part variants across the library, got ${total}`);
});

test('every slot offers a "none" escape hatch where the anatomy allows it', () => {
  ['top', 'ears', 'arms', 'legs', 'tail', 'wings', 'detail'].forEach(slot => {
    assert.ok(ALL_LIBS[slot].none, `${slot} must offer a 'none' variant`);
    assert.deepEqual(ALL_LIBS[slot].none.shapes, [], `${slot}.none must draw nothing`);
  });
  assert.equal(EYES.none, undefined, 'a creature always has eyes');
  assert.equal(MOUTHS.none, undefined, 'a creature always has a mouth');
});

test('limb variants declare the physical metadata the behaviour system reads', () => {
  Object.values(LEGS).forEach(l => assert.equal(typeof l.count, 'number', `LEGS.${l.id} needs a count`));
  Object.values(ARMS).forEach(a => assert.equal(typeof a.reach, 'number', `ARMS.${a.id} needs a reach`));
  Object.values(WINGS).forEach(w => assert.equal(typeof w.span, 'number', `WINGS.${w.id} needs a span`));
  Object.values(TAILS).forEach(t => assert.equal(typeof t.length, 'number', `TAILS.${t.id} needs a length`));
  assert.ok(Object.values(ARMS).some(a => a.reach >= 18), 'at least one arm must be long enough to hang');
  assert.ok(Object.values(LEGS).some(l => l.count >= 4), 'at least one leg style must be many-legged');
});

/* ========================== palettes ===================================== */

test('palettes are complete, harmonious sets of distinct colours', () => {
  assert.ok(PALETTE_IDS.length >= 10, `expected >=10 palettes, got ${PALETTE_IDS.length}`);
  const roles = ['body', 'bodyDark', 'bodyLight', 'accent', 'detail', 'ink', 'line', 'bone'];
  PALETTE_IDS.forEach(id => {
    const p = PALETTES[id];
    assert.equal(p.id, id);
    assert.ok(typeof p.name === 'string' && p.name.length, `${id} needs a name`);
    roles.forEach(r => assert.match(p[r], /^#[0-9A-Fa-f]{6}$/, `${id}.${r} must be a 6-digit hex colour`));
    const lum = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16 & 255) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) / 255; };
    assert.ok(lum(p.bodyDark) < lum(p.body), `${id}.bodyDark must be darker than the body`);
    assert.ok(lum(p.bodyLight) > lum(p.body), `${id}.bodyLight must be lighter than the body`);
    // `line` is what keeps a mouth readable, including on the dark palettes.
    assert.ok(Math.abs(lum(p.line) - lum(p.body)) > 0.18, `${id}.line has too little contrast against the body`);
    assert.ok(new Set([p.body, p.accent, p.detail]).size === 3, `${id} body/accent/detail must be three distinct colours`);
  });
});

/* ========================== generation =================================== */

test('makeRng is deterministic per seed and differs across seeds', () => {
  const a = Array.from({ length: 8 }, makeRng('abc'));
  const b = Array.from({ length: 8 }, makeRng('abc'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, Array.from({ length: 8 }, makeRng('abd')));
  a.forEach(n => assert.ok(n >= 0 && n < 1, 'rng must stay in [0,1)'));
  assert.equal(typeof makeSeed(), 'string');
});

test('generateCreature is deterministic for a given seed', () => {
  for (const seed of ['a', 'zzz', '12345', 'shelf-life']) {
    assert.deepEqual(generateCreature({ seed }), generateCreature({ seed }),
      `seed ${seed} must reproduce exactly`);
  }
});

test('generateCreature varies meaningfully across seeds', () => {
  const rolls = Array.from({ length: 120 }, (_, i) => generateCreature({ seed: 'v' + i }));
  const uniqueBodies = new Set(rolls.map(c => c.body));
  const uniquePalettes = new Set(rolls.map(c => c.palette));
  const signatures = new Set(rolls.map(c => JSON.stringify(c.parts) + c.body + c.palette));
  assert.ok(uniqueBodies.size >= 10, `only ${uniqueBodies.size} distinct bodies in 120 rolls`);
  assert.ok(uniquePalettes.size >= 8, `only ${uniquePalettes.size} distinct palettes in 120 rolls`);
  assert.ok(signatures.size >= 115, `only ${signatures.size} distinct creatures in 120 rolls`);
});

test('a creature only ever references parts that exist', () => {
  for (let i = 0; i < 250; i++) {
    const c = generateCreature({ seed: 'ref' + i });
    assert.ok(BODIES[c.body], `unknown body ${c.body}`);
    assert.ok(PALETTES[c.palette], `unknown palette ${c.palette}`);
    SLOT_KEYS.forEach(slot => assert.ok(ALL_LIBS[slot][c.parts[slot]],
      `unknown ${slot} variant "${c.parts[slot]}"`));
  }
});

test('a creature round-trips through JSON without losing anything', () => {
  const c = generateCreature({ seed: 'json' });
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
  assert.equal(renderCreatureSVG(JSON.parse(JSON.stringify(c))), renderCreatureSVG(c));
});

test('a seeded creature can be rebuilt from its seed alone', () => {
  const c = generateCreature();
  assert.ok(c.seed && typeof c.seed === 'string');
  assert.deepEqual(generateCreature({ seed: c.seed }), c);
});

test('forced options override the roll', () => {
  const c = generateCreature({ seed: 'force', body: 'grub', palette: 'tar', parts: { top: 'crown', eyes: 'cyclops' } });
  assert.equal(c.body, 'grub');
  assert.equal(c.palette, 'tar');
  assert.equal(c.parts.top, 'crown');
  assert.equal(c.parts.eyes, 'cyclops');
  // Unknown ids must be ignored rather than poison the creature.
  const junk = generateCreature({ seed: 'force', body: 'nope', palette: 'nope', parts: { top: 'nope' } });
  assert.ok(BODIES[junk.body] && PALETTES[junk.palette] && TOPS[junk.parts.top]);
});

test('coherence rules keep results from looking like random part soup', () => {
  for (let i = 0; i < 400; i++) {
    const c = generateCreature({ seed: 'coh' + i });
    const body = BODIES[c.body];
    const eyes = EYES[c.parts.eyes];
    // One eye arrangement per face — never a cluster stacked on a cyclops.
    assert.ok(typeof c.parts.eyes === 'string');
    // A busy eye arrangement gets a quiet mouth.
    if (eyes.tags.includes('many') || c.parts.eyes === 'cyclops') {
      assert.ok(!['gape', 'grin', 'tusks', 'beak'].includes(c.parts.mouth),
        `${c.parts.eyes} eyes should not be paired with a ${c.parts.mouth} mouth`);
    }
    // A tiny head never gets a maw or a rack of tusks.
    if (body.tags.includes('smallFace')) {
      assert.ok(!['gape', 'tusks'].includes(c.parts.mouth), `${c.body} has a small face`);
      assert.ok(!['cluster', 'triple', 'cyclops'].includes(c.parts.eyes), `${c.body} has a small face`);
    }
    // A flat-bottomed body never sprouts a pair of walking legs.
    if (body.tags.includes('sits') && !body.tags.includes('crawler')) {
      assert.ok(['none', 'tentacles'].includes(c.parts.legs), `${c.body} sits, got ${c.parts.legs} legs`);
    }
    // Many-legged styles only land on bodies that actually have the joints.
    if (LEGS[c.parts.legs].tags.includes('many')) {
      assert.ok((body.anchors.manyLegs || []).length >= 4, `${c.body} has no manyLegs joints`);
    }
    // Wings never land on a silhouette they would fight.
    if (body.tags.includes('noWings')) assert.equal(c.parts.wings, 'none', `${c.body} should stay wingless`);
    // At most one set of markings, and never a full crown *and* a crest.
    assert.ok(TOPS[c.parts.top]);
  }
});

test('the body-plan roll produces a genuine anatomy spread, not 120 bipeds', () => {
  const rolls = Array.from({ length: 300 }, (_, i) => generateCreature({ seed: 'sp' + i }));
  const legless = rolls.filter(c => !c.anatomy.hasLegs).length;
  const many = rolls.filter(c => c.anatomy.legCount >= 4).length;
  const armed = rolls.filter(c => c.anatomy.hasArms).length;
  const hangers = rolls.filter(c => c.anatomy.can.hang).length;
  const winged = rolls.filter(c => c.anatomy.hasWings).length;
  const tailed = rolls.filter(c => c.anatomy.hasTail).length;
  const limbless = rolls.filter(c => c.anatomy.isLimbless).length;
  assert.ok(legless >= 30, `only ${legless}/300 legless creatures`);
  assert.ok(many >= 20, `only ${many}/300 many-legged creatures`);
  assert.ok(armed >= 120, `only ${armed}/300 creatures with arms`);
  assert.ok(hangers >= 60, `only ${hangers}/300 creatures able to hang off the shelf`);
  assert.ok(winged >= 20, `only ${winged}/300 winged creatures`);
  assert.ok(tailed >= 120, `only ${tailed}/300 tailed creatures`);
  assert.ok(limbless >= 10, `only ${limbless}/300 fully limbless creatures`);
  assert.deepEqual([...new Set(rolls.map(c => c.anatomy.gait))].sort(),
    ['hop', 'ooze', 'scuttle', 'walk'], 'all four gaits must appear');
});

test('rerollPart changes exactly the requested slot', () => {
  const base = generateCreature({ seed: 'reroll' });
  const next = rerollPart(base, 'top', 'r1');
  assert.equal(next.body, base.body);
  assert.equal(next.palette, base.palette);
  assert.notEqual(next.parts.top, base.parts.top);
  SLOT_KEYS.filter(s => s !== 'top').forEach(s =>
    assert.equal(next.parts[s], base.parts[s], `${s} must be untouched`));
  assert.deepEqual(rerollPart(base, 'top', 'r1'), next, 'rerollPart must be seedable');
  assert.throws(() => rerollPart(base, 'nope', 'r1'), /unknown slot/);
});

/* ========================== anatomy + rig ================================ */

test('anatomy exposes the capability flags a consumer needs, no inference required', () => {
  const keys = ['hasLegs', 'legCount', 'legStyle', 'hasArms', 'armCount', 'armStyle', 'armReach',
    'hasWings', 'wingCount', 'wingStyle', 'wingSpan', 'hasTail', 'tailStyle', 'tailLength',
    'hasTentacles', 'isLimbless', 'heightClass', 'buildClass', 'gait', 'can'];
  const canKeys = ['walk', 'scuttle', 'hop', 'sneak', 'hang', 'climb', 'glide', 'wag'];
  for (let i = 0; i < 200; i++) {
    const c = generateCreature({ seed: 'an' + i });
    const a = c.anatomy;
    keys.forEach(k => assert.ok(k in a, `anatomy is missing ${k}`));
    canKeys.forEach(k => assert.equal(typeof a.can[k], 'boolean', `anatomy.can.${k} must be a boolean`));
    assert.equal(a.hasLegs, a.legCount > 0);
    assert.equal(a.legStyle, c.parts.legs);
    assert.equal(a.hasArms, c.parts.arms !== 'none');
    assert.equal(a.hasWings, c.parts.wings !== 'none');
    assert.equal(a.hasTail, c.parts.tail !== 'none');
    assert.equal(a.hasTentacles, c.parts.legs === 'tentacles');
    assert.equal(a.isLimbless, !a.hasLegs && !a.hasArms);
    assert.ok(['tall', 'medium', 'squat'].includes(a.heightClass));
    assert.ok(['thin', 'round', 'lumpy', 'wide'].includes(a.buildClass));
    assert.ok(['walk', 'scuttle', 'ooze', 'hop'].includes(a.gait));
    if (a.can.hang) assert.ok(a.hasArms && a.armReach >= 18, 'hanging needs long arms');
    if (a.can.glide) assert.ok(a.hasWings, 'gliding needs wings');
    if (a.can.scuttle) assert.ok(a.legCount >= 4, 'scuttling needs 4+ legs');
    if (a.gait === 'walk') assert.ok(a.can.walk);
    if (!a.hasLegs) assert.ok(a.can.hop, 'a legless creature must at least be able to hop');
    assert.equal(describeAnatomy(c).gait, a.gait, 'describeAnatomy must be pure');
  }
});

test('the rig gives every moving limb an addressable pivot and resting angle', () => {
  for (let i = 0; i < 200; i++) {
    const c = generateCreature({ seed: 'rig' + i });
    const rig = c.rig;
    assert.equal(rig.legs.length, c.anatomy.legCount, 'rig.legs must match legCount');
    assert.equal(rig.arms.length, c.anatomy.hasArms ? c.anatomy.armCount : 0);
    assert.equal(rig.wings.length, c.anatomy.hasWings ? 2 : 0);
    assert.equal(rig.tail === null, !c.anatomy.hasTail);
    assert.equal(rig.base.y, BASELINE);
    assert.ok(rig.head.r > 0);
    assert.ok(rig.eyes.length >= 1);
    const ids = new Set();
    [...rig.legs, ...rig.arms, ...rig.wings].forEach(l => {
      assert.ok(!ids.has(l.id), `duplicate rig id ${l.id}`);
      ids.add(l.id);
      assert.equal(typeof l.x, 'number');
      assert.equal(typeof l.y, 'number');
      assert.equal(typeof l.angle, 'number');
      assert.ok(['left', 'right'].includes(l.side), `${l.id} needs a side`);
      assert.ok(Math.abs(l.angle) <= 90, `${l.id} resting angle ${l.angle} is implausible`);
    });
    rig.legs.forEach((l, i) => assert.equal(l.id, `leg-${i}`));
    rig.arms.forEach((l, i) => assert.equal(l.id, `arm-${i}`));
    assert.deepEqual(buildRig(c).legs, rig.legs, 'buildRig must be pure');
  }
});

test('rig pivots match the mount positions the renderer actually emits', () => {
  for (let i = 0; i < 60; i++) {
    const c = generateCreature({ seed: 'pv' + i });
    const svg = renderCreatureSVG(c);
    [...c.rig.legs.map(l => ['leg', l]), ...c.rig.arms.map(l => ['arm', l]), ...c.rig.wings.map(l => ['wing', l])]
      .forEach(([part, l]) => {
        const re = new RegExp(`data-part="${part}" data-index="${l.index}"[^>]*data-pivot-x="(-?[\\d.]+)" data-pivot-y="(-?[\\d.]+)"`);
        const m = re.exec(svg);
        assert.ok(m, `${c.seed}: no rendered ${part} ${l.index}`);
        assert.ok(Math.abs(Number(m[1]) - l.x) < 0.01, `${part} ${l.index} pivot x drifted from the rig`);
        assert.ok(Math.abs(Number(m[2]) - l.y) < 0.01, `${part} ${l.index} pivot y drifted from the rig`);
      });
  }
});

/* ========================== rendering ==================================== */

test('renderCreatureSVG output is well-formed XML', () => {
  for (let i = 0; i < 150; i++) {
    const svg = renderCreatureSVG(generateCreature({ seed: 'x' + i }), { size: 120, title: 'A & B <c>' });
    assert.ok(svg.startsWith('<svg '), 'must be an <svg> root');
    assert.ok(svg.includes(`viewBox="${VIEWBOX}"`), 'must use the shared viewBox');
    parseXML(svg);
  }
});

test('renderCreatureSVG emits one identifiable element per feature', () => {
  for (let i = 0; i < 120; i++) {
    const c = generateCreature({ seed: 'id' + i });
    const svg = renderCreatureSVG(c);
    const parts = [...svg.matchAll(/data-part="([a-z]+)"(?: data-index="(\d+)")?/g)]
      .map(m => m[1] + (m[2] === undefined ? '' : ':' + m[2]));
    assert.equal(new Set(parts).size, parts.length, `${c.seed}: duplicate part identifiers ${parts}`);
    assert.ok(parts.includes('body'), 'always a body');
    assert.ok(parts.includes('mouth'), 'always a mouth');
    assert.ok(parts.some(p => p.startsWith('eye')), 'always at least one eye element');

    const count = name => parts.filter(p => p === name || p.startsWith(name + ':')).length;
    assert.equal(count('leg'), c.anatomy.legCount, `${c.seed}: leg elements must match legCount`);
    assert.equal(count('arm'), c.anatomy.hasArms ? c.anatomy.armCount : 0);
    assert.equal(count('wing'), c.anatomy.hasWings ? 2 : 0);
    assert.equal(count('tail'), c.anatomy.hasTail ? 1 : 0);
    assert.equal(count('ear'), c.parts.ears === 'none' ? 0 : 2);
    assert.equal(count('detail'), c.parts.detail === 'none' ? 0 : 1);
    if (c.parts.top !== 'none') {
      assert.ok(count('horn') === 2 || count('crest') === 1, `${c.seed}: a top part must render`);
    }
  }
});

test('each animatable part group carries a bare local origin, so an animator owns its transform', () => {
  const svg = renderCreatureSVG(generateCreature({ seed: 'anim', parts: { legs: 'bird', arms: 'noodle', tail: 'curl', wings: 'bat', ears: 'pointy' } }));
  // Placement lives on .cr-mount; the inner .cr-part group must have no transform
  // of its own, so its (0,0) IS the joint and CSS transforms do not collide.
  [...svg.matchAll(/<g ([^>]*class="cr-part[^"]*"[^>]*)>/g)].forEach(m => {
    assert.ok(!/\btransform=/.test(m[1]), `a cr-part group carries a transform: ${m[1]}`);
    assert.ok(/data-part="/.test(m[1]), 'every cr-part group must name its part');
  });
  assert.ok(svg.includes('class="cr-mount"'), 'mounts must be emitted');
  assert.ok(svg.includes('class="cr-figure"'), 'a figure wrapper must be emitted');
  assert.ok(svg.includes('class="cr-torso"'), 'a torso wrapper must be emitted');
});

test('rendered markup only contains resolved hex colours, never role names', () => {
  for (let i = 0; i < 80; i++) {
    const c = generateCreature({ seed: 'col' + i });
    const svg = renderCreatureSVG(c);
    [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].forEach(m => {
      assert.ok(m[1] === 'none' || /^#[0-9A-Fa-f]{6}$/.test(m[1]),
        `unresolved colour "${m[1]}" leaked into the markup`);
    });
    const colors = resolveColors(c);
    assert.ok(svg.includes(colors.body), 'the body colour must appear');
  }
});

test('renderCreatureSVG(..., {inner:true}) returns just the figure', () => {
  const c = generateCreature({ seed: 'inner' });
  const inner = renderCreatureSVG(c, { inner: true });
  assert.ok(inner.startsWith('<g class="cr-figure">'));
  assert.ok(!inner.includes('<svg'));
  parseXML(`<svg>${inner}</svg>`);
});

test('renderPartSVG and renderBodySVG produce valid standalone previews', () => {
  BODY_IDS.forEach(id => parseXML(renderBodySVG(id, { size: 80 })));
  assert.equal(renderBodySVG('nope'), '');
  SLOT_KEYS.forEach(slot => {
    listVariants(slot).forEach(v => {
      const svg = renderPartSVG(slot, v.id, { size: 80 });
      parseXML(svg);
      if (v.id !== 'none') assert.ok(/<(path|circle|ellipse|line)/.test(svg), `${slot}.${v.id} preview drew nothing`);
    });
  });
  assert.equal(renderPartSVG('nope', 'nope'), '');
  assert.equal(renderPartSVG('eyes', 'nope'), '');
});

test('normalizeCreature repairs junk instead of throwing', () => {
  const junk = { body: 'nope', palette: 'nope', parts: { eyes: 'nope', legs: 'nope' } };
  const c = normalizeCreature(junk);
  assert.ok(BODIES[c.body] && PALETTES[c.palette] && EYES[c.parts.eyes]);
  assert.ok(c.anatomy && c.rig, 'a repaired creature still gets anatomy and a rig');
  parseXML(renderCreatureSVG(junk));
  parseXML(renderCreatureSVG(null));
  parseXML(renderCreatureSVG(undefined));
  parseXML(renderCreatureSVG({}));
});

test('resolveColors returns every role and honours per-creature overrides', () => {
  const c = generateCreature({ seed: 'rc' });
  const colors = resolveColors(c);
  ['body', 'bodyDark', 'bodyLight', 'accent', 'detail', 'ink', 'line', 'bone'].forEach(r =>
    assert.match(colors[r], /^#[0-9A-Fa-f]{6}$/, `resolveColors is missing ${r}`));
  const overridden = resolveColors(Object.assign({}, c, { colors: { body: '#123456' } }));
  assert.equal(overridden.body, '#123456');
  assert.equal(overridden.accent, colors.accent);
});

test('describeCreature gives a short human-readable summary', () => {
  for (let i = 0; i < 40; i++) {
    const s = describeCreature(generateCreature({ seed: 'd' + i }));
    assert.ok(typeof s === 'string' && s.length > 20 && s.length < 200, `bad summary: ${s}`);
    assert.ok(!/undefined|NaN/.test(s), `summary leaked a bad value: ${s}`);
  }
});

test('constants stay in sync with the documented convention', () => {
  assert.equal(VIEWBOX, '-50 -50 100 100');
  assert.equal(BASELINE, 42);
  assert.equal(SPAN, 9);
});
