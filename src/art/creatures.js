/* =============================================================================
   creatures.js — the designed creature generator for Shelf Life
   =============================================================================

   Pure data + pure functions. NO DOM access, NO imports from the rest of the
   app, no side effects. Everything here is safe to `import` from a test, a
   worker, or a preview harness.

   -----------------------------------------------------------------------------
   COORDINATE CONVENTION  (read this before touching any path data)
   -----------------------------------------------------------------------------
   Every number in this file lives in ONE space: a centred 100x100 box drawn as

       <svg viewBox="-50 -50 100 100">

   which is the same "centred box" convention as art/stamps.js (`-30 -30 60 60`)
   and content/props.js (`0 0 60 60`), just roomier because a whole creature has
   to fit horns, wings and a tail inside it.

     - origin (0,0) is the middle of the creature's bounding box
     - x grows RIGHT, y grows DOWN (SVG native — a *smaller* y is *higher up*)
     - the shelf/ground line is BASELINE = +42. Feet and flat-bottomed bodies
       rest on it, so a row of creatures all stand on the same line.
     - the outer +-50 margin is deliberate slack for things that overhang the
       body: horns, antennae, wings, tails, a hat.

   Bodies are authored so their silhouette occupies roughly x in [-34, 34] and
   y in [-45, +42]. Nothing should ever exceed +-50 or it will clip.

   -----------------------------------------------------------------------------
   DATA SHAPES
   -----------------------------------------------------------------------------
   SHAPE   — one drawable primitive. `k` is the kind; colour fields hold a ROLE
             name ('body', 'accent', 'bone', ...) which `resolveColors()` turns
             into a hex string. Roles keep parts palette-agnostic.
               { k:'path',    d, fill, stroke, sw, cap, join, op }
               { k:'ellipse', cx, cy, rx, ry, fill, ... }
               { k:'circle',  cx, cy, r, fill, ... }
               { k:'line',    x1, y1, x2, y2, stroke, sw, cap }

   VARIANT — one designed part (an eye, a horn, a leg...).
               { id, name, mirror, shapes }          // mirror:true  -> drawn twice
               { id, name, mirror:false, shapes }    // single centred group
               { id, name, groups:[{id, shapes}] }   // explicitly asymmetric
             Mirrored variants are authored ONCE for the LEFT side (outward is
             -x) and the renderer emits the right side with scale(-1,1) unless
             the variant sets `flip:false` (eyes copy rather than mirror, so
             both catchlights land on the same side, like a real illustration).

   BODY    — a silhouette plus the ANCHORS that say where features belong.
             Anchors are the whole trick: they are what makes a composed
             creature look drawn rather than assembled.

   CREATURE — the serializable roll returned by generateCreature(). See the
             big comment above that function for the full field list, including
             the `anatomy` capability flags and the `rig` (per-limb pivots) that
             the shelf behaviour + animation systems consume.

   ============================================================================= */

export const VIEW_MIN = -50;
export const VIEW_SIZE = 100;
export const VIEWBOX = `${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`;
/** y of the shelf surface. Feet land here. */
export const BASELINE = 42;
/** Reference half-distance between a pair of eyes / horns. Centred (non-mirrored)
 *  variants are authored against this and scaled by anchor.spread / SPAN. */
export const SPAN = 9;

/* =============================================================================
   1. PALETTES
   -----------------------------------------------------------------------------
   Harmonised with css/style.css :root — pink #FF8FB8, mint #7FD8C0,
   amber #F2B441, blood #A32C3C, bone #F2E9DC, aubergine rooms.

   Roles:
     body      main silhouette fill
     bodyDark  underside / shadow / hair — always darker than body
     bodyLight belly, tail puff, wing membrane — always lighter than body
     accent    horns, limbs, ear insides, tail tips (the "second colour")
     detail    spots, stitches, patches (the "third colour", used sparingly)
     ink       pupils, open mouths, hooves — the darkest value
     line      line-art ON the body (mouth strokes, brows). Usually == ink, but
               flipped to a LIGHT value on a dark body so a face never vanishes.
     bone      eye whites + teeth, fixed off-white, matching stamps.js
   ============================================================================= */
const BONE = '#F2E9DC';

export const PALETTES = {
  bubblegum: { id:'bubblegum', name:'Bubblegum Cadaver',
    body:'#FF8FB8', bodyDark:'#D2618D', bodyLight:'#FFC0D8', accent:'#A32C3C', detail:'#6E2340', ink:'#2A0F1C', line:'#2A0F1C', bone:BONE },
  mint: { id:'mint', name:'Specimen Mint',
    body:'#7FD8C0', bodyDark:'#4FA891', bodyLight:'#B4EDDC', accent:'#F2B441', detail:'#2F5F55', ink:'#0F2E28', line:'#0F2E28', bone:BONE },
  amber: { id:'amber', name:'Lamplight Amber',
    body:'#F2B441', bodyDark:'#C0871F', bodyLight:'#FBD98D', accent:'#A32C3C', detail:'#5C3A18', ink:'#2E1D08', line:'#2E1D08', bone:BONE },
  bone: { id:'bone', name:'Bone Familiar',
    body:'#F2E9DC', bodyDark:'#C3B5A4', bodyLight:'#FFFBF2', accent:'#A32C3C', detail:'#6E5F53', ink:'#2B2028', line:'#2B2028', bone:BONE },
  aubergine: { id:'aubergine', name:'Aubergine Imp',
    body:'#6E4A82', bodyDark:'#4A2F5C', bodyLight:'#9772AB', accent:'#FF8FB8', detail:'#2C1B38', ink:'#150C1D', line:'#1F1229', bone:BONE },
  drowned: { id:'drowned', name:'Drowned Blue',
    body:'#7FA8D8', bodyDark:'#557CA9', bodyLight:'#B0CBEC', accent:'#F2E9DC', detail:'#2C4A6B', ink:'#122237', line:'#112034', bone:BONE },
  mould: { id:'mould', name:'Cellar Mould',
    body:'#9CB86A', bodyDark:'#6F8C46', bodyLight:'#C4DA97', accent:'#A32C3C', detail:'#3E5227', ink:'#1B2610', line:'#1B2610', bone:BONE },
  cherry: { id:'cherry', name:'Cherry Rot',
    body:'#A32C3C', bodyDark:'#75141F', bodyLight:'#C85567', accent:'#F2B441', detail:'#4A0E18', ink:'#26070D', line:'#3D0A12', bone:BONE },
  ash: { id:'ash', name:'Ash Ghost',
    body:'#C8C2D0', bodyDark:'#9A93A7', bodyLight:'#E8E4EE', accent:'#7FD8C0', detail:'#5A5266', ink:'#2B2430', line:'#2B2430', bone:BONE },
  tar: { id:'tar', name:'Tar Kitten',
    body:'#3A2F48', bodyDark:'#241C2E', bodyLight:'#584866', accent:'#F2B441', detail:'#FF8FB8', ink:'#120C1A', line:'#B9A8C6', bone:BONE },
  peach: { id:'peach', name:'Potted Peach',
    body:'#F0B79B', bodyDark:'#C68A6D', bodyLight:'#FBD8C4', accent:'#6E4A82', detail:'#8A4A32', ink:'#341C12', line:'#341C12', bone:BONE },
  lilac: { id:'lilac', name:'Séance Lilac',
    body:'#C7A6E0', bodyDark:'#9E7DBB', bodyLight:'#E2CDF2', accent:'#A32C3C', detail:'#5E3E78', ink:'#241833', line:'#241833', bone:BONE },
  slime: { id:'slime', name:'Pond Slime',
    body:'#B9D648', bodyDark:'#829C2A', bodyLight:'#DDEB8E', accent:'#6E4A82', detail:'#4E6112', ink:'#1C2408', line:'#1C2408', bone:BONE },
  bruise: { id:'bruise', name:'Fresh Bruise',
    body:'#8A6FB0', bodyDark:'#5C4680', bodyLight:'#B9A3D6', accent:'#E9C24B', detail:'#3A2A55', ink:'#1A1226', line:'#1A1226', bone:BONE },
  rust: { id:'rust', name:'Kettle Rust',
    body:'#C56A3A', bodyDark:'#8E4522', bodyLight:'#E39A6E', accent:'#7FD8C0', detail:'#4A2211', ink:'#22100A', line:'#22100A', bone:BONE },
  ecto: { id:'ecto', name:'Ectoplasm',
    body:'#9FE6D2', bodyDark:'#5FB8A0', bodyLight:'#D4F5EB', accent:'#FF8FB8', detail:'#2C6B5A', ink:'#0F2E28', line:'#0F2E28', bone:BONE }
};
export const PALETTE_IDS = Object.keys(PALETTES);

/* Roles a shape may reference. 'none' means literally fill="none". */
export const COLOR_ROLES = ['body','bodyDark','bodyLight','accent','detail','ink','line','bone','none'];

/* =============================================================================
   2. SMALL PATH HELPERS
   Run once at module load; still pure. Used where hand-typing 20 identical
   scallops would be worse than describing them.
   ============================================================================= */
const r2 = n => Math.round(n * 100) / 100;

/** A wavy hem: bumps hanging *down* while travelling from x0 to x1 at y. */
function hem(x0, x1, y, bumps, amp) {
  let d = '';
  const step = (x1 - x0) / bumps;
  for (let i = 0; i < bumps; i++) {
    const a = x0 + step * i;
    d += ` Q ${r2(a + step / 2)} ${r2(y + amp)} ${r2(a + step)} ${r2(y)}`;
  }
  return d;
}

/** A ring of soft fur spikes around an ellipse — drawn behind a body. */
function furRing(cx, cy, rx, ry, spikes, len) {
  let d = '';
  for (let i = 0; i < spikes; i++) {
    const a0 = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / spikes) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / spikes) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a1) * (rx + len), py = cy + Math.sin(a1) * (ry + len);
    const nx = cx + Math.cos(a2) * rx, ny = cy + Math.sin(a2) * ry;
    if (i === 0) d += `M ${r2(cx + Math.cos(a0) * rx)} ${r2(cy + Math.sin(a0) * ry)}`;
    d += ` Q ${r2(px)} ${r2(py)} ${r2(nx)} ${r2(ny)}`;
  }
  return d + ' Z';
}

/* =============================================================================
   3. BODIES
   -----------------------------------------------------------------------------
   Each body carries:
     path      main silhouette (role 'body')
     back      optional shape drawn BEHIND the body (fur, frill) — role bodyDark
     shade     optional shapes drawn OVER the body (belly, seam, segment lines)
     tags      coherence hints, see BODY_TAGS below
     base      y of the lowest point of the silhouette (where it meets legs/shelf)
     anchors   where features attach:
       eyes  {x,y,spread,scale}   spread = half the distance between the pair
       mouth {x,y,scale}
       top   {x,y,spread,scale}   horns / crown / crest, on the skull
       ears  {x,y,spread,scale}
       arms  [{x,y,angle}]        angle 0 = straight down, +ve swings toward +x
       legs  [{x,y,angle}]        hip joints, 2 of them
       manyLegs [{x,y,angle}]     optional 4-8 joints for scuttlers / tentacles
       tail  {x,y,angle,scale}    angle rotates the whole tail unit
       wings {x,y,spread,scale,angle}
       head  {x,y,r}              pivot + radius for head bob / nod
       detail{x,y,w,h}            region for spots / stitches / patches

   BODY_TAGS
     tall / medium / squat  – heightClass
     thin / round / lumpy / wide – buildClass hints
     topHeavy   big skull, small body: keep headwear light
     bigFace    the face has room; supports cluster/cyclops eyes
     smallFace  tiny head: keep eyes simple and small
     sits       flat-bottomed, legs read wrong -> legless or tentacled
     crawler    has manyLegs anchors
     noWings    wings look wrong on this silhouette
   ============================================================================= */

export const BODIES = {

  pear: {
    id: 'pear', name: 'Pear', tags: ['medium','round','bigFace'], base: 35,
    path: 'M 0 -33 C 10 -33 15 -26 14 -18 C 13 -10 25 -6 27 8 C 29 25 17 35 0 35 C -17 35 -29 25 -27 8 C -25 -6 -13 -10 -14 -18 C -15 -26 -10 -33 0 -33 Z',
    shade: [{ k:'path', d:'M -20 22 C -12 32 12 32 20 22 C 14 34 -14 34 -20 22 Z', fill:'bodyDark', op:.5 }],
    anchors: {
      eyes:{x:0,y:-6,spread:9.5,scale:1}, mouth:{x:0,y:9,scale:1},
      top:{x:0,y:-32,spread:8,scale:1}, ears:{x:0,y:-25,spread:12.5,scale:.95},
      head:{x:0,y:-18,r:15},
      arms:[{x:-25,y:5,angle:-24},{x:25,y:5,angle:24}],
      legs:[{x:-11,y:32,angle:-4},{x:11,y:32,angle:4}],
      tail:{x:25,y:22,angle:-10,scale:1},
      wings:{x:0,y:-4,spread:15,scale:1,angle:0},
      detail:{x:0,y:16,w:34,h:22}
    }
  },

  tower: {
    id: 'tower', name: 'Tower', tags: ['tall','thin','smallFace'], base: 36,
    path: 'M -10 -35 C -10 -44 12 -45 12 -35 C 12 -29 13 -24 15 -19 C 19 -10 19 2 16 12 C 14 20 15 29 13 35 C 5 36 -5 36 -13 35 C -15 29 -14 20 -16 12 C -19 2 -19 -10 -15 -19 C -13 -24 -11 -29 -10 -35 Z',
    shade: [{ k:'path', d:'M 0 -12 C 7 -12 11 -4 11 8 C 11 21 10 30 8 33 C 3 34 -3 34 -8 33 C -10 30 -11 21 -11 8 C -11 -4 -7 -12 0 -12 Z', fill:'bodyLight', op:.28 }],
    anchors: {
      eyes:{x:1,y:-26,spread:6.6,scale:.8}, mouth:{x:1,y:-15,scale:.75},
      top:{x:1,y:-42,spread:6,scale:.9}, ears:{x:1,y:-37,spread:10.5,scale:.85},
      head:{x:1,y:-31,r:12},
      arms:[{x:-17,y:0,angle:-14},{x:18,y:0,angle:14}],
      legs:[{x:-7,y:33,angle:-3},{x:7,y:33,angle:3}],
      tail:{x:14,y:26,angle:-14,scale:.9},
      wings:{x:0,y:-8,spread:12,scale:.95,angle:0},
      detail:{x:1,y:12,w:24,h:26}
    }
  },

  lump: {
    id: 'lump', name: 'Lump', tags: ['medium','lumpy','bigFace'], base: 34,
    path: 'M -5 -32 C 8 -37 20 -30 20 -19 C 20 -13 31 -14 32 -2 C 33 8 25 12 24 19 C 23 28 12 36 1 34 C -9 32 -13 25 -20 26 C -31 27 -34 13 -28 5 C -24 -1 -27 -7 -24 -14 C -21 -23 -15 -29 -5 -32 Z',
    shade: [{ k:'path', d:'M -25 14 C -20 25 -8 31 3 30 C 13 29 19 24 22 18 C 21 27 12 35 1 34 C -9 32 -13 26 -20 26 C -25 26 -27 20 -25 14 Z', fill:'bodyDark', op:.4 }],
    anchors: {
      eyes:{x:-1,y:-6,spread:10,scale:1.05}, mouth:{x:-1,y:10,scale:1},
      top:{x:3,y:-33,spread:9,scale:1}, ears:{x:1,y:-24,spread:16,scale:1},
      head:{x:0,y:-13,r:18},
      arms:[{x:-27,y:6,angle:-32},{x:30,y:0,angle:26}],
      legs:[{x:-12,y:31,angle:-6},{x:11,y:32,angle:5}],
      tail:{x:28,y:16,angle:-24,scale:1},
      wings:{x:0,y:-8,spread:17,scale:1,angle:0},
      detail:{x:-2,y:16,w:34,h:20}
    }
  },

  bulb: {
    id: 'bulb', name: 'Bulb', tags: ['medium','round','topHeavy','bigFace'], base: 36,
    path: 'M 0 -41 C 17 -41 27 -28 26 -13 C 25 1 17 9 10 12 C 11 22 12 31 12 35 C 4 37 -4 37 -12 35 C -12 31 -11 22 -10 12 C -17 9 -25 1 -26 -13 C -27 -28 -17 -41 0 -41 Z',
    shade: [{ k:'path', d:'M -22 -6 C -14 4 14 4 22 -6 C 20 6 12 11 8 12 C 2 14 -2 14 -8 12 C -12 11 -20 6 -22 -6 Z', fill:'bodyDark', op:.35 }],
    anchors: {
      eyes:{x:0,y:-18,spread:10.5,scale:1.15}, mouth:{x:0,y:-3,scale:1.05},
      top:{x:0,y:-40,spread:9,scale:1}, ears:{x:0,y:-31,spread:23,scale:1.05},
      head:{x:0,y:-16,r:22},
      arms:[{x:-10,y:20,angle:-18},{x:10,y:20,angle:18}],
      legs:[{x:-6,y:34,angle:-3},{x:6,y:34,angle:3}],
      tail:{x:11,y:30,angle:-12,scale:.85},
      wings:{x:0,y:0,spread:11,scale:.95,angle:0},
      detail:{x:0,y:-26,w:30,h:14}
    }
  },

  bean: {
    id: 'bean', name: 'Bean', tags: ['medium','lumpy','bigFace'], base: 36,
    path: 'M 5 -38 C 19 -36 25 -23 21 -11 C 18 -2 11 3 7 11 C 3 20 7 30 -4 35 C -16 40 -27 32 -27 19 C -27 8 -21 1 -17 -8 C -21 -23 -11 -40 5 -38 Z',
    shade: [{ k:'path', d:'M -24 18 C -23 28 -15 34 -6 33 C 1 32 5 28 6 23 C 6 30 3 34 -4 35 C -16 39 -26 31 -24 18 Z', fill:'bodyDark', op:.4 }],
    anchors: {
      eyes:{x:3,y:-21,spread:8.5,scale:.95}, mouth:{x:2,y:-7,scale:.9},
      top:{x:4,y:-37,spread:7.5,scale:.95}, ears:{x:3,y:-30,spread:14,scale:.95},
      head:{x:3,y:-23,r:15},
      arms:[{x:-20,y:2,angle:-30},{x:21,y:-8,angle:24}],
      legs:[{x:-16,y:31,angle:-9},{x:-1,y:34,angle:3}],
      tail:{x:5,y:30,angle:8,scale:.95},
      wings:{x:0,y:-16,spread:14,scale:.9,angle:0},
      detail:{x:-10,y:16,w:28,h:18}
    }
  },

  slug: {
    id: 'slug', name: 'Slug', tags: ['squat','wide','sits','bigFace','noWings'], base: 41,
    path: 'M -30 26 C -32 8 -22 -9 -5 -9 C 9 -9 19 -1 24 9 C 28 17 35 23 41 25 C 46 27 45 34 39 35 C 32 36 25 32 21 27 C 21 35 19 41 13 41 L -24 41 C -29 41 -30 34 -30 26 Z',
    shade: [{ k:'path', d:'M -28 32 C -14 38 16 38 34 33 C 38 36 36 41 30 41 L -24 41 C -28 41 -29 37 -28 32 Z', fill:'bodyDark', op:.45 }],
    anchors: {
      eyes:{x:-10,y:6,spread:9,scale:1}, mouth:{x:-10,y:21,scale:.95},
      top:{x:-8,y:-7,spread:7,scale:.95}, ears:{x:-8,y:0,spread:16,scale:.85},
      head:{x:-10,y:6,r:17},
      arms:[{x:-27,y:16,angle:-30},{x:12,y:14,angle:34}],
      legs:[], manyLegs:[{x:-22,y:38,angle:0},{x:-12,y:39,angle:0},{x:-1,y:39,angle:0},{x:10,y:39,angle:0},{x:21,y:38,angle:0}],
      tail:{x:38,y:30,angle:-40,scale:.8},
      wings:{x:-4,y:2,spread:14,scale:.8,angle:0},
      detail:{x:8,y:22,w:30,h:16}
    }
  },

  spindle: {
    id: 'spindle', name: 'Spindle', tags: ['tall','thin','smallFace'], base: 34,
    path: 'M 0 -42 C 8 -42 12 -36 11 -30 C 10 -25 8 -22 7 -18 C 7 -12 12 -8 14 0 C 17 9 18 24 14 32 C 11 35 -11 35 -14 32 C -18 24 -17 9 -14 0 C -12 -8 -7 -12 -7 -18 C -8 -22 -10 -25 -11 -30 C -12 -36 -8 -42 0 -42 Z',
    shade: [{ k:'path', d:'M -11 4 C -6 8 6 8 11 4 C 14 14 14 26 11 32 C 5 34 -5 34 -11 32 C -14 26 -14 14 -11 4 Z', fill:'bodyLight', op:.3 }],
    anchors: {
      eyes:{x:0,y:-33,spread:5.5,scale:.62}, mouth:{x:0,y:-26,scale:.52},
      top:{x:0,y:-41,spread:5.5,scale:.75}, ears:{x:0,y:-36,spread:9,scale:.7},
      head:{x:0,y:-32,r:10},
      arms:[{x:-15,y:2,angle:-16},{x:15,y:2,angle:16}],
      legs:[{x:-8,y:31,angle:-4},{x:8,y:31,angle:4}],
      tail:{x:15,y:24,angle:-16,scale:.85},
      wings:{x:0,y:-8,spread:11,scale:.95,angle:0},
      detail:{x:0,y:16,w:24,h:20}
    }
  },

  gown: {
    id: 'gown', name: 'Gown', tags: ['tall','round','sits','bigFace'], base: 41,
    path: 'M 0 -36 C 13 -36 20 -26 19 -14 C 18 -4 22 4 26 16 C 29 26 31 37 28 40'
      + hem(28, -28, 40, 6, 4)
      + ' C -31 37 -29 26 -26 16 C -22 4 -18 -4 -19 -14 C -20 -26 -13 -36 0 -36 Z',
    shade: [{ k:'path', d:'M -12 4 C -6 8 6 8 12 4 C 16 16 20 30 20 39 C 10 41 -10 41 -20 39 C -20 30 -16 16 -12 4 Z', fill:'bodyLight', op:.28 }],
    anchors: {
      eyes:{x:0,y:-20,spread:8.5,scale:.95}, mouth:{x:0,y:-7,scale:.9},
      top:{x:0,y:-35,spread:8,scale:.95}, ears:{x:0,y:-28,spread:14,scale:.95},
      head:{x:0,y:-22,r:15},
      arms:[{x:-19,y:-6,angle:-24},{x:19,y:-6,angle:24}],
      legs:[], manyLegs:[{x:-19,y:33,angle:-16},{x:-9.5,y:35,angle:-8},{x:0,y:36,angle:0},{x:9.5,y:35,angle:8},{x:19,y:33,angle:16}],
      tail:{x:24,y:16,angle:-20,scale:.85},
      wings:{x:0,y:-10,spread:15,scale:1,angle:0},
      detail:{x:0,y:22,w:36,h:16}
    }
  },

  tuft: {
    id: 'tuft', name: 'Tuft', tags: ['medium','round','bigFace'], base: 36,
    path: 'M 0 -28 C 17 -28 30 -15 30 3 C 30 21 18 36 0 36 C -18 36 -30 21 -30 3 C -30 -15 -17 -28 0 -28 Z',
    back: furRing(0, 4, 30, 32, 16, 5),
    shade: [{ k:'path', d:'M -22 20 C -14 30 14 30 22 20 C 18 32 6 36 0 36 C -6 36 -18 32 -22 20 Z', fill:'bodyDark', op:.4 }],
    anchors: {
      eyes:{x:0,y:-4,spread:11,scale:1.15}, mouth:{x:0,y:12,scale:1.05},
      top:{x:0,y:-27,spread:9,scale:1}, ears:{x:0,y:-19,spread:20,scale:1},
      head:{x:0,y:2,r:24},
      arms:[{x:-27,y:8,angle:-32},{x:27,y:8,angle:32}],
      legs:[{x:-11,y:33,angle:-5},{x:11,y:33,angle:5}],
      tail:{x:27,y:22,angle:-22,scale:1},
      wings:{x:0,y:-4,spread:18,scale:1,angle:0},
      detail:{x:0,y:18,w:32,h:16}
    }
  },

  stack: {
    id: 'stack', name: 'Stack', tags: ['tall','round','smallFace'], base: 36,
    path: 'M 0 -40 C 13 -40 21 -31 20 -22 C 19 -16 15 -12 12 -10 C 20 -7 28 2 28 13 C 28 27 16 36 0 36 C -16 36 -28 27 -28 13 C -28 2 -20 -7 -12 -10 C -15 -12 -19 -16 -20 -22 C -21 -31 -13 -40 0 -40 Z',
    shade: [{ k:'path', d:'M -12 -10 C -6 -7 6 -7 12 -10 C 8 -6 -8 -6 -12 -10 Z', fill:'bodyDark', op:.5 },
            { k:'path', d:'M -22 20 C -14 30 14 30 22 20 C 18 33 -18 33 -22 20 Z', fill:'bodyDark', op:.4 }],
    anchors: {
      eyes:{x:0,y:-27,spread:7,scale:.8}, mouth:{x:0,y:-18,scale:.68},
      top:{x:0,y:-39,spread:7,scale:.9}, ears:{x:0,y:-33,spread:13,scale:.85},
      head:{x:0,y:-26,r:14},
      arms:[{x:-27,y:12,angle:-28},{x:27,y:12,angle:28}],
      legs:[{x:-10,y:33,angle:-4},{x:10,y:33,angle:4}],
      tail:{x:27,y:22,angle:-20,scale:.95},
      wings:{x:0,y:-14,spread:15,scale:1,angle:0},
      detail:{x:0,y:14,w:32,h:18}
    }
  },

  carapace: {
    id: 'carapace', name: 'Carapace', tags: ['squat','wide','crawler','bigFace'], base: 33,
    path: 'M -34 18 C -36 2 -28 -11 -15 -15 C -13 -22 -7 -27 0 -27 C 7 -27 13 -22 15 -15 C 28 -11 36 2 34 18 C 33 28 26 33 16 33 L -16 33 C -26 33 -33 28 -34 18 Z',
    shade: [{ k:'path', d:'M -14 -14 C -6 -17 6 -17 14 -14 C 6 -11 -6 -11 -14 -14 Z', fill:'bodyDark', op:.45 },
            { k:'path', d:'M 0 -11 C 2 -2 2 8 1 16 L -1 16 C -2 8 -2 -2 0 -11 Z', fill:'bodyDark', op:.4 },
            { k:'path', d:'M -29 14 C -21 24 21 24 29 14 C 28 28 21 33 14 33 L -14 33 C -21 33 -28 28 -29 14 Z', fill:'bodyDark', op:.22 }],
    anchors: {
      eyes:{x:0,y:2,spread:11,scale:1.05}, mouth:{x:0,y:19,scale:1},
      top:{x:0,y:-26,spread:8,scale:.95}, ears:{x:0,y:-14,spread:22,scale:.9},
      head:{x:0,y:4,r:20},
      arms:[{x:-31,y:12,angle:-40},{x:31,y:12,angle:40}],
      legs:[{x:-16,y:30,angle:-10},{x:16,y:30,angle:10}],
      manyLegs:[{x:-28,y:22,angle:-34},{x:-19,y:29,angle:-16},{x:-8,y:32,angle:-5},{x:8,y:32,angle:5},{x:19,y:29,angle:16},{x:28,y:22,angle:34}],
      tail:{x:31,y:20,angle:-30,scale:.8},
      wings:{x:0,y:-8,spread:20,scale:1,angle:0},
      detail:{x:0,y:-2,w:40,h:22}
    }
  },

  grub: {
    id: 'grub', name: 'Grub', tags: ['tall','round','crawler','smallFace','noWings'], base: 39,
    path: 'M 0 -40 C 11 -40 16 -33 15 -27 C 20 -22 20 -14 15 -10 C 21 -5 21 4 15 8 C 21 13 21 22 15 26 C 21 31 20 37 13 39 C 5 40 -5 40 -13 39 C -20 37 -21 31 -15 26 C -21 22 -21 13 -15 8 C -21 4 -21 -5 -15 -10 C -20 -14 -20 -22 -15 -27 C -16 -33 -11 -40 0 -40 Z',
    shade: [{ k:'path', d:'M -16 -9 C -8 -6 8 -6 16 -9 C 8 -3 -8 -3 -16 -9 Z', fill:'bodyDark', op:.35 },
            { k:'path', d:'M -16 9 C -8 12 8 12 16 9 C 8 15 -8 15 -16 9 Z', fill:'bodyDark', op:.35 },
            { k:'path', d:'M -16 27 C -8 30 8 30 16 27 C 8 33 -8 33 -16 27 Z', fill:'bodyDark', op:.35 }],
    anchors: {
      eyes:{x:0,y:-31,spread:6,scale:.68}, mouth:{x:0,y:-23,scale:.58},
      top:{x:0,y:-39,spread:6,scale:.8}, ears:{x:0,y:-34,spread:10,scale:.7},
      head:{x:0,y:-30,r:12},
      arms:[{x:-18,y:-8,angle:-40},{x:18,y:-8,angle:40}],
      legs:[], manyLegs:[{x:-18,y:-6,angle:-70},{x:18,y:-6,angle:70},{x:-19,y:12,angle:-72},{x:19,y:12,angle:72},{x:-18,y:30,angle:-64},{x:18,y:30,angle:64}],
      tail:{x:16,y:34,angle:-8,scale:.7},
      wings:{x:0,y:-12,spread:14,scale:.85,angle:0},
      detail:{x:0,y:14,w:26,h:18}
    }
  },

  shard: {
    id: 'shard', name: 'Shard', tags: ['medium','thin','smallFace'], base: 34,
    path: 'M 0 -36 C 10 -36 16 -29 15 -21 C 15 -18 14 -16 13 -14 C 20 -13 26 -10 30 -5 C 24 -6 19 -5 16 -3 C 22 6 24 20 19 31 C 15 36 -15 36 -19 31 C -24 20 -22 6 -16 -3 C -19 -5 -24 -6 -30 -5 C -26 -10 -20 -13 -13 -14 C -14 -16 -15 -18 -15 -21 C -16 -29 -10 -36 0 -36 Z',
    shade: [{ k:'path', d:'M -15 6 C -7 10 7 10 15 6 C 18 17 17 28 13 34 C 4 35 -4 35 -13 34 C -17 28 -18 17 -15 6 Z', fill:'bodyDark', op:.28 }],
    anchors: {
      eyes:{x:0,y:-25,spread:6.6,scale:.74}, mouth:{x:0,y:-17.5,scale:.62},
      top:{x:0,y:-35,spread:6.5,scale:.85}, ears:{x:0,y:-29,spread:11.5,scale:.8},
      head:{x:0,y:-24,r:12},
      arms:[{x:-20,y:6,angle:-24},{x:20,y:6,angle:24}],
      legs:[{x:-9,y:32,angle:-5},{x:9,y:32,angle:5}],
      tail:{x:19,y:26,angle:-18,scale:.9},
      wings:{x:0,y:-6,spread:16,scale:1.05,angle:0},
      detail:{x:0,y:16,w:28,h:16}
    }
  },

  urn: {
    id: 'urn', name: 'Urn', tags: ['tall','round','sits','bigFace','noWings'], base: 41,
    path: 'M -15 -38 C -6 -41 6 -41 15 -38 C 16 -33 11 -31 9 -29 C 8 -24 9 -21 12 -18 C 22 -10 27 2 26 14 C 25 27 17 34 12 36 L 15 41 L -15 41 L -12 36 C -17 34 -25 27 -26 14 C -27 2 -22 -10 -12 -18 C -9 -21 -8 -24 -9 -29 C -11 -31 -16 -33 -15 -38 Z',
    shade: [{ k:'path', d:'M -13 -34 C -5 -31 5 -31 13 -34 C 5 -30 -5 -30 -13 -34 Z', fill:'bodyDark', op:.5 },
            { k:'path', d:'M -22 20 C -14 30 14 30 22 20 C 20 30 15 35 12 36 L 15 41 L -15 41 L -12 36 C -15 35 -20 30 -22 20 Z', fill:'bodyDark', op:.4 }],
    anchors: {
      eyes:{x:0,y:4,spread:9.5,scale:1}, mouth:{x:0,y:19,scale:.95},
      top:{x:0,y:-39,spread:8,scale:.85}, ears:{x:0,y:-2,spread:20,scale:.9},
      head:{x:0,y:6,r:19},
      arms:[{x:-25,y:12,angle:-34},{x:25,y:12,angle:34}],
      legs:[], manyLegs:[{x:-13,y:34,angle:-14},{x:-6.5,y:36,angle:-6},{x:0,y:37,angle:0},{x:6.5,y:36,angle:6},{x:13,y:34,angle:14}],
      tail:{x:25,y:22,angle:-24,scale:.8},
      wings:{x:0,y:-2,spread:18,scale:.9,angle:0},
      detail:{x:0,y:-24,w:20,h:16}
    }
  },

  sprout: {
    id: 'sprout', name: 'Sprout', tags: ['tall','round','bigFace'], base: 36,
    path: 'M 0 -42 C 6 -42 8 -36 7 -31 C 6 -25 5 -18 6 -12 C 16 -6 24 5 24 17 C 24 30 13 36 0 36 C -13 36 -24 30 -24 17 C -24 5 -16 -6 -6 -12 C -5 -18 -6 -25 -7 -31 C -8 -36 -6 -42 0 -42 Z',
    shade: [{ k:'path', d:'M -18 22 C -12 30 12 30 18 22 C 14 33 -14 33 -18 22 Z', fill:'bodyDark', op:.4 }],
    anchors: {
      eyes:{x:0,y:12,spread:9,scale:1}, mouth:{x:0,y:26,scale:.9},
      top:{x:0,y:-41,spread:5,scale:.8}, ears:{x:0,y:6,spread:19,scale:.9},
      head:{x:0,y:14,r:18},
      arms:[{x:-22,y:14,angle:-30},{x:22,y:14,angle:30}],
      legs:[{x:-9,y:33,angle:-4},{x:9,y:33,angle:4}],
      tail:{x:22,y:26,angle:-18,scale:.85},
      wings:{x:0,y:2,spread:16,scale:.9,angle:0},
      detail:{x:0,y:-1,w:26,h:13}
    }
  },

  owlet: {
    id: 'owlet', name: 'Owlet', tags: ['medium','round','bigFace'], base: 34,
    path: 'M -27 -33 L -19 -20 C -10 -25 10 -25 19 -20 L 27 -33 C 31 -22 32 -5 30 9 C 28 24 16 34 0 34 C -16 34 -28 24 -30 9 C -32 -5 -31 -22 -27 -33 Z',
    shade: [{ k:'path', d:'M 0 -10 C 9 -10 15 -2 15 8 C 15 20 8 30 0 32 C -8 30 -15 20 -15 8 C -15 -2 -9 -10 0 -10 Z', fill:'bodyLight', op:.32 }],
    anchors: {
      eyes:{x:0,y:-8,spread:11.5,scale:1.2}, mouth:{x:0,y:9,scale:.95},
      top:{x:0,y:-23,spread:10,scale:.95}, ears:{x:0,y:-24,spread:20,scale:.95},
      head:{x:0,y:-4,r:22},
      arms:[{x:-28,y:6,angle:-30},{x:28,y:6,angle:30}],
      legs:[{x:-10,y:31,angle:-5},{x:10,y:31,angle:5}],
      tail:{x:26,y:24,angle:-24,scale:.85},
      wings:{x:0,y:-6,spread:19,scale:1,angle:0},
      detail:{x:0,y:-20,w:30,h:12}
    }
  }
};
export const BODY_IDS = Object.keys(BODIES);

/* =============================================================================
   4. PART LIBRARIES
   Mirrored variants are authored for the LEFT side; outward is -x, up is -y.
   ============================================================================= */

/* ---- EYES -------------------------------------------------------------------
   mirror:true  -> one eye authored at the origin, drawn at +-spread.
   flip:false   -> the copy is translated, NOT mirrored, so both catchlights
                   stay on the same side (how an illustrator would draw it).
   mirror:false -> whole cluster authored across +-SPAN, scaled by spread/SPAN.
--------------------------------------------------------------------------- */
export const EYES = {
  pair: { id:'pair', name:'Pair', mirror:true, flip:false, tags:['plain'], shapes:[
    { k:'ellipse', cx:0, cy:0, rx:5.2, ry:6, fill:'bone' },
    { k:'ellipse', cx:0, cy:0, rx:5.2, ry:6, fill:'none', stroke:'ink', sw:.7, op:.35 },
    { k:'circle', cx:0.7, cy:1, r:2.7, fill:'ink', cls:'pupil' },
    { k:'circle', cx:1.6, cy:0.1, r:0.95, fill:'bone' }
  ]},
  beady: { id:'beady', name:'Beady', mirror:true, flip:false, tags:['small'], shapes:[
    { k:'path', d:'M -4.6 -5.8 Q 0 -8.2 4.4 -5.4', fill:'none', stroke:'line', sw:1.6, cap:'round' },
    { k:'circle', cx:0, cy:0, r:3.3, fill:'ink', cls:'pupil' },
    { k:'circle', cx:1.1, cy:-1.1, r:1.05, fill:'bone' }
  ]},
  sleepy: { id:'sleepy', name:'Sleepy', mirror:true, flip:false, tags:['calm'], shapes:[
    { k:'ellipse', cx:0, cy:0, rx:5.2, ry:5.8, fill:'bone' },
    { k:'circle', cx:0.4, cy:2.4, r:2.4, fill:'ink', cls:'pupil' },
    { k:'path', d:'M -5.4 0.4 A 5.3 5.9 0 0 1 5.4 0.4 Z', fill:'bodyDark' },
    { k:'path', d:'M -5.9 0.4 L 5.9 0.4', fill:'none', stroke:'ink', sw:1.3, cap:'round' }
  ]},
  slit: { id:'slit', name:'Slit', mirror:true, flip:false, tags:['sinister'], shapes:[
    { k:'path', d:'M -6 0 C -4.4 -5.6 4.4 -5.6 6 0 C 4.4 5.2 -4.4 5.2 -6 0 Z', fill:'bone' },
    { k:'ellipse', cx:0.3, cy:0, rx:1.5, ry:4.4, fill:'ink', cls:'pupil' },
    { k:'circle', cx:1.6, cy:-1.8, r:0.8, fill:'bone' }
  ]},
  shut: { id:'shut', name:'Shut', mirror:true, flip:true, tags:['calm','blind'], shapes:[
    { k:'path', d:'M -5.2 1.6 Q 0 -5.2 5.2 1.6', fill:'none', stroke:'line', sw:2, cap:'round' },
    { k:'path', d:'M -3.4 4 L -4.8 6 M 0 4.6 L 0 6.8 M 3.4 4 L 4.8 6', fill:'none', stroke:'line', sw:1.2, cap:'round', op:.65 }
  ]},
  dead: { id:'dead', name:'Dead', mirror:true, flip:true, tags:['sinister','blind'], shapes:[
    { k:'path', d:'M -5 -5 L 5 5 M 5 -5 L -5 5', fill:'none', stroke:'line', sw:2.2, cap:'round' }
  ]},
  stalks: { id:'stalks', name:'Stalks', mirror:true, flip:true, tags:['odd'], shapes:[
    { k:'path', d:'M 0.6 4.4 C 0 1 -1.2 -1.6 -2.4 -4.6', fill:'none', stroke:'bodyDark', sw:2.4, cap:'round' },
    { k:'circle', cx:-3.2, cy:-7.4, r:4.8, fill:'bone' },
    { k:'circle', cx:-2.7, cy:-6.8, r:2.3, fill:'ink', cls:'pupil' },
    { k:'circle', cx:-1.9, cy:-7.8, r:0.9, fill:'bone' }
  ]},
  manic: { id:'manic', name:'Manic', mirror:false, tags:['manic'], groups:[
    { id:'eye-left', shapes:[
      { k:'ellipse', cx:-9, cy:-0.4, rx:7.2, ry:7.6, fill:'bone' },
      { k:'circle', cx:-8, cy:0.4, r:2.1, fill:'ink', cls:'pupil' },
      { k:'path', d:'M -16 -8.6 Q -9 -11.8 -3 -9.2', fill:'none', stroke:'line', sw:1.7, cap:'round' }
    ]},
    { id:'eye-right', shapes:[
      { k:'ellipse', cx:8.4, cy:1.2, rx:5.2, ry:5.6, fill:'bone' },
      { k:'circle', cx:9, cy:1.8, r:2.6, fill:'ink', cls:'pupil' },
      { k:'path', d:'M 3.4 -5.4 Q 9 -8 14 -5', fill:'none', stroke:'line', sw:1.6, cap:'round' }
    ]}
  ]},
  cyclops: { id:'cyclops', name:'Cyclops', mirror:false, tags:['single','odd'], groups:[
    { id:'eye', shapes:[
      { k:'ellipse', cx:0, cy:0, rx:11, ry:10.2, fill:'bone' },
      { k:'ellipse', cx:0, cy:0, rx:11, ry:10.2, fill:'none', stroke:'ink', sw:.8, op:.35 },
      { k:'circle', cx:0.6, cy:0.9, r:4.8, fill:'ink', cls:'pupil' },
      { k:'circle', cx:2.4, cy:-1.6, r:1.7, fill:'bone' },
      { k:'path', d:'M -11.6 -4.6 Q 0 -13.6 11.6 -4.6', fill:'none', stroke:'line', sw:1.9, cap:'round' }
    ]}
  ]},
  cluster: { id:'cluster', name:'Cluster', mirror:false, tags:['odd','many'], groups:[
    { id:'eye-0', shapes:[{ k:'ellipse', cx:-9.4, cy:0.8, rx:4.4, ry:4.8, fill:'bone' }, { k:'circle', cx:-8.8, cy:1.4, r:2.1, fill:'ink', cls:'pupil' }] },
    { id:'eye-1', shapes:[{ k:'ellipse', cx:0.4, cy:-1.6, rx:4.8, ry:5.2, fill:'bone' }, { k:'circle', cx:1, cy:-1, r:2.3, fill:'ink', cls:'pupil' }] },
    { id:'eye-2', shapes:[{ k:'ellipse', cx:9.6, cy:1.4, rx:4, ry:4.4, fill:'bone' }, { k:'circle', cx:10.2, cy:2, r:1.9, fill:'ink', cls:'pupil' }] },
    { id:'eye-3', shapes:[{ k:'ellipse', cx:-4.4, cy:8, rx:3.2, ry:3.4, fill:'bone' }, { k:'circle', cx:-4, cy:8.4, r:1.5, fill:'ink', cls:'pupil' }] },
    { id:'eye-4', shapes:[{ k:'ellipse', cx:5.2, cy:8.6, rx:2.8, ry:3, fill:'bone' }, { k:'circle', cx:5.6, cy:9, r:1.3, fill:'ink', cls:'pupil' }] }
  ]},
  triple: { id:'triple', name:'Triple', mirror:false, tags:['odd','many'], groups:[
    { id:'eye-left', shapes:[{ k:'ellipse', cx:-8.6, cy:2.4, rx:4.8, ry:5.2, fill:'bone' }, { k:'circle', cx:-8, cy:3, r:2.3, fill:'ink', cls:'pupil' }] },
    { id:'eye-right', shapes:[{ k:'ellipse', cx:8.6, cy:2.4, rx:4.8, ry:5.2, fill:'bone' }, { k:'circle', cx:9.2, cy:3, r:2.3, fill:'ink', cls:'pupil' }] },
    { id:'eye-third', shapes:[
      { k:'ellipse', cx:0, cy:-7.2, rx:4.6, ry:6, fill:'bone' },
      { k:'ellipse', cx:0, cy:-7.2, rx:1.8, ry:4, fill:'ink', cls:'pupil' },
      { k:'path', d:'M -7.4 -13.6 L -9.6 -17 M 0 -14.6 L 0 -18.6 M 7.4 -13.6 L 9.6 -17', fill:'none', stroke:'accent', sw:1.2, cap:'round' }
    ]}
  ]},
  lashes: { id:'lashes', name:'Lashes', mirror:true, flip:true, tags:['plain','vain'], shapes:[
    { k:'ellipse', cx:0, cy:0, rx:5.4, ry:6.2, fill:'bone' },
    { k:'circle', cx:-0.6, cy:1, r:2.8, fill:'ink', cls:'pupil' },
    { k:'circle', cx:-1.6, cy:0, r:1, fill:'bone' },
    { k:'path', d:'M -4.6 -4.4 L -7.2 -7.2 M -2.2 -5.8 L -3.6 -9 M 0.6 -6 L 0.8 -9.4', fill:'none', stroke:'line', sw:1.4, cap:'round' }
  ]},
  goggle: { id:'goggle', name:'Goggle', mirror:true, flip:false, tags:['odd','big'], shapes:[
    { k:'circle', cx:0, cy:0, r:7.2, fill:'accent' },
    { k:'circle', cx:0, cy:0, r:5.6, fill:'bone' },
    { k:'circle', cx:0.8, cy:0.6, r:3.4, fill:'ink', cls:'pupil' },
    { k:'circle', cx:2, cy:-0.9, r:1.2, fill:'bone' }
  ]},
  weepy: { id:'weepy', name:'Weepy', mirror:true, flip:false, tags:['sad'], shapes:[
    { k:'ellipse', cx:0, cy:0, rx:5, ry:5.8, fill:'bone' },
    { k:'circle', cx:0.4, cy:1.6, r:2.6, fill:'ink', cls:'pupil' },
    { k:'path', d:'M -5.4 -2.2 Q 0 -6.2 5.4 -2.2', fill:'none', stroke:'line', sw:1.6, cap:'round' },
    { k:'path', d:'M -2.2 5.6 C -2.6 8.2 -3.4 10.4 -3.8 12.6 C -4 14.2 -1.6 14.2 -1.8 12.6 C -2 10.4 -2.4 8.2 -2.2 5.6 Z', fill:'bodyLight', op:.9 }
  ]},
  wink: { id:'wink', name:'Wink', mirror:false, tags:['smug'], groups:[
    { id:'eye-left', shapes:[
      { k:'ellipse', cx:-8.6, cy:0, rx:5.2, ry:6, fill:'bone' },
      { k:'circle', cx:-7.9, cy:1, r:2.7, fill:'ink', cls:'pupil' },
      { k:'circle', cx:-7, cy:0, r:0.9, fill:'bone' }
    ]},
    { id:'eye-right', shapes:[
      { k:'ellipse', cx:8.6, cy:0.8, rx:5.2, ry:2, fill:'none' },
      { k:'path', d:'M 3.6 1.4 Q 8.6 -3 13.6 1.4', fill:'none', stroke:'line', sw:2, cap:'round' },
      { k:'path', d:'M 6.6 3.6 L 6 5.4 M 8.8 4.2 L 8.8 6 M 11 3.6 L 11.6 5.4', fill:'none', stroke:'line', sw:1.2, cap:'round', op:.6 }
    ]}
  ]},
  hollow: { id:'hollow', name:'Hollow', mirror:true, flip:false, tags:['sinister','blind'], shapes:[
    { k:'ellipse', cx:0, cy:0, rx:5, ry:6, fill:'ink' },
    { k:'ellipse', cx:0.6, cy:-1.2, rx:1.4, ry:1.8, fill:'accent', op:.85, cls:'pupil' }
  ]}
};

/* ---- MOUTHS ---- authored around the origin, roughly +-9 wide -------------- */
export const MOUTHS = {
  grin: { id:'grin', name:'Toothy Grin', tags:['happy'], shapes:[
    { k:'path', d:'M -9.4 -1.6 A 9.6 9.6 0 0 0 9.4 -1.6', fill:'none', stroke:'line', sw:1.7, cap:'round' },
    { k:'path', d:'M -7.6 1.6 L -4.6 1.6 L -6.1 5.4 Z', fill:'bone' },
    { k:'path', d:'M -3.7 2.4 L -0.7 2.4 L -2.2 6.4 Z', fill:'bone' },
    { k:'path', d:'M 0.7 2.4 L 3.7 2.4 L 2.2 6.4 Z', fill:'bone' },
    { k:'path', d:'M 4.6 1.6 L 7.6 1.6 L 6.1 5.4 Z', fill:'bone' }
  ]},
  frown: { id:'frown', name:'Small Frown', tags:['sad'], shapes:[
    { k:'path', d:'M -4.6 3 Q 0 -1.4 4.6 3', fill:'none', stroke:'line', sw:1.9, cap:'round' }
  ]},
  gape: { id:'gape', name:'Gape', tags:['loud'], shapes:[
    { k:'path', d:'M -8.6 -2.6 C -6 -6.4 6 -6.4 8.6 -2.6 C 9.6 4.4 5 10.4 0 10.4 C -5 10.4 -9.6 4.4 -8.6 -2.6 Z', fill:'ink' },
    { k:'path', d:'M -7.4 -2.6 L -4.6 -2.6 L -6 1 Z', fill:'bone' },
    { k:'path', d:'M -2.2 -3 L 0.8 -3 L -0.7 0.8 Z', fill:'bone' },
    { k:'path', d:'M 3.4 -2.6 L 6.4 -2.6 L 5 1 Z', fill:'bone' },
    { k:'path', d:'M -3.6 10 C -3.6 6.4 3.6 6.4 3.6 10 C 2.4 10.4 -2.4 10.4 -3.6 10 Z', fill:'accent' }
  ]},
  stitched: { id:'stitched', name:'Stitched Shut', tags:['sinister'], shapes:[
    { k:'path', d:'M -9 1 Q 0 4.4 9 1', fill:'none', stroke:'line', sw:1.5, cap:'round' },
    { k:'path', d:'M -6.2 -1.4 L -5.4 4.4 M -2.2 -0.4 L -1.8 5.6 M 1.8 -0.4 L 2.2 5.6 M 5.4 -1.4 L 6.2 4.4', fill:'none', stroke:'line', sw:1.2, cap:'round' }
  ]},
  beak: { id:'beak', name:'Beak', tags:['bird'], shapes:[
    { k:'path', d:'M -6.6 -2.4 C -2.4 -4.4 2.4 -4.4 6.6 -2.4 C 4.4 4 2 8.4 0 8.4 C -2 8.4 -4.4 4 -6.6 -2.4 Z', fill:'accent' },
    { k:'path', d:'M -6 -1.4 C -2 0.4 2 0.4 6 -1.4', fill:'none', stroke:'ink', sw:1, op:.55 }
  ]},
  smirk: { id:'smirk', name:'Smirk', tags:['smug'], shapes:[
    { k:'path', d:'M -6.4 0.4 Q 0 4 7 -1.6', fill:'none', stroke:'line', sw:1.9, cap:'round' },
    { k:'path', d:'M 6.4 -1.4 L 8.6 -3.4', fill:'none', stroke:'line', sw:1.4, cap:'round' }
  ]},
  fangs: { id:'fangs', name:'Fangs', tags:['sinister'], shapes:[
    { k:'path', d:'M -7.4 0 Q 0 3.4 7.4 0', fill:'none', stroke:'line', sw:1.7, cap:'round' },
    { k:'path', d:'M -4.6 2 L -2.2 2 L -3.4 6.6 Z', fill:'bone' },
    { k:'path', d:'M 2.2 2 L 4.6 2 L 3.4 6.6 Z', fill:'bone' }
  ]},
  oh: { id:'oh', name:'Small O', tags:['surprised'], shapes:[
    { k:'ellipse', cx:0, cy:1, rx:3.2, ry:3.8, fill:'ink' },
    { k:'ellipse', cx:0, cy:3.2, rx:1.8, ry:1.4, fill:'accent' }
  ]},
  wavy: { id:'wavy', name:'Worried', tags:['sad'], shapes:[
    { k:'path', d:'M -7.4 1.4 Q -5 -1.6 -2.6 1.4 Q 0 4.4 2.6 1.4 Q 5 -1.6 7.4 1.4', fill:'none', stroke:'line', sw:1.6, cap:'round' }
  ]},
  tusks: { id:'tusks', name:'Tusks', tags:['brute'], shapes:[
    { k:'path', d:'M -8 0.4 Q 0 3.4 8 0.4', fill:'none', stroke:'line', sw:1.7, cap:'round' },
    { k:'path', d:'M -6.6 1.4 C -8.6 -0.6 -8.4 -4.4 -6.4 -6.4 C -6.4 -3.4 -5.4 -0.6 -4.2 1.4 Z', fill:'bone' },
    { k:'path', d:'M 6.6 1.4 C 8.6 -0.6 8.4 -4.4 6.4 -6.4 C 6.4 -3.4 5.4 -0.6 4.2 1.4 Z', fill:'bone' }
  ]},
  zip: { id:'zip', name:'Zipped', tags:['sinister'], shapes:[
    { k:'path', d:'M -9 0.6 L 9 0.6', fill:'none', stroke:'line', sw:2.2, cap:'round' },
    { k:'path', d:'M -7 -1 L -7 2.2 M -4.6 -1 L -4.6 2.2 M -2.2 -1 L -2.2 2.2 M 0.2 -1 L 0.2 2.2 M 2.6 -1 L 2.6 2.2 M 5 -1 L 5 2.2', fill:'none', stroke:'bone', sw:1, cap:'round' },
    { k:'path', d:'M 7.4 0.6 L 9.6 -2.4', fill:'none', stroke:'accent', sw:1.6, cap:'round' },
    { k:'circle', cx:9.8, cy:-2.8, r:1.1, fill:'accent' }
  ]},
  moustache: { id:'moustache', name:'Moustache', tags:['smug','hair'], shapes:[
    { k:'path', d:'M 0 1 C -3 -2.4 -7.6 -2.4 -10.4 0.4 C -8.4 2.4 -4 3 0 1 C 4 3 8.4 2.4 10.4 0.4 C 7.6 -2.4 3 -2.4 0 1 Z', fill:'bodyDark' },
    { k:'path', d:'M -3.4 4.2 Q 0 6.4 3.4 4.2', fill:'none', stroke:'line', sw:1.5, cap:'round' }
  ]},
  drool: { id:'drool', name:'Drooling', tags:['loud','damp'], shapes:[
    { k:'path', d:'M -6 -1.6 C -3 -3.4 3 -3.4 6 -1.6 C 6.4 3 3.6 6.6 0 6.6 C -3.6 6.6 -6.4 3 -6 -1.6 Z', fill:'ink' },
    { k:'path', d:'M -3.4 6 C -3.4 4 3.4 4 3.4 6 C 2.4 6.6 -2.4 6.6 -3.4 6 Z', fill:'accent' },
    { k:'path', d:'M 3.2 5.4 C 3.8 8.6 4.6 11 4.4 13.4 C 4.2 15.4 1.6 15.4 1.8 13.4 C 2 11 2.6 8.6 3.2 5.4 Z', fill:'bodyLight', op:.92 }
  ]},
  pout: { id:'pout', name:'Pout', tags:['sad','small'], shapes:[
    { k:'ellipse', cx:0, cy:1.2, rx:3, ry:2.2, fill:'accent' },
    { k:'path', d:'M -3 1 Q 0 -1 3 1', fill:'none', stroke:'line', sw:1.3, cap:'round' }
  ]},
  chatter: { id:'chatter', name:'Chattering', tags:['loud','teeth'], shapes:[
    { k:'path', d:'M -8.4 -2 L 8.4 -2 L 8.4 5.4 L -8.4 5.4 Z', fill:'ink' },
    { k:'path', d:'M -7.4 -2 L -7.4 0.6 L -4.6 0.6 L -4.6 -2 M -3.4 -2 L -3.4 0.6 L -0.6 0.6 L -0.6 -2 M 0.6 -2 L 0.6 0.6 L 3.4 0.6 L 3.4 -2 M 4.6 -2 L 4.6 0.6 L 7.4 0.6 L 7.4 -2', fill:'bone' },
    { k:'path', d:'M -7.4 5.4 L -7.4 3 L -4.6 3 L -4.6 5.4 M -3.4 5.4 L -3.4 3 L -0.6 3 L -0.6 5.4 M 0.6 5.4 L 0.6 3 L 3.4 3 L 3.4 5.4 M 4.6 5.4 L 4.6 3 L 7.4 3 L 7.4 5.4', fill:'bone' }
  ]}
};

/* ---- TOP (horns / crowns / crests) ------------------------------------------
   Mirrored variants attach at (top.x -+ top.spread, top.y) and grow up-and-out.
   Centred variants are authored across +-13 and scaled by spread/SPAN.
--------------------------------------------------------------------------- */
export const TOPS = {
  none: { id:'none', name:'Bare', mirror:false, tags:['none'], shapes:[] },
  curled: { id:'curled', name:'Curled Horns', mirror:true, tags:['horn','heavy'], shapes:[
    { k:'path', d:'M 2.4 6 C -12.6 6.4 -20 -4 -16.4 -14.6 C -13.4 -23.4 -3.4 -26.6 1.6 -20.4 C -3.4 -23 -10.4 -19.6 -12.4 -12.6 C -14.4 -5.6 -9.4 0.4 0 0.6 Z', fill:'accent' },
    { k:'path', d:'M -3.6 4.6 C -11.4 3 -15.6 -3.4 -13.6 -10.4 M -8.6 5 C -14.6 2.4 -17.6 -3.4 -16 -9.4', fill:'none', stroke:'ink', sw:.9, op:.28, cap:'round' }
  ]},
  spiky: { id:'spiky', name:'Spikes', mirror:true, tags:['horn'], shapes:[
    { k:'path', d:'M -5.6 5 C -7.6 -3.6 -8.6 -13.6 -6.4 -21.4 C -2 -14.4 1.4 -6 2 4 Z', fill:'accent' }
  ]},
  antlers: { id:'antlers', name:'Antlers', mirror:true, tags:['horn','light'], shapes:[
    { k:'path', d:'M -1 6 C -4 -3 -7 -11 -9.4 -20.4', fill:'none', stroke:'accent', sw:2.3, cap:'round' },
    { k:'path', d:'M -5.2 -6.6 C -9.6 -8.6 -13.6 -11.6 -16.6 -13', fill:'none', stroke:'accent', sw:2, cap:'round' },
    { k:'path', d:'M -7.6 -14.4 C -10.6 -17.4 -13.6 -21.4 -15.6 -24.4', fill:'none', stroke:'accent', sw:1.8, cap:'round' }
  ]},
  stub: { id:'stub', name:'Single Stub', mirror:false, tags:['horn','single'], shapes:[
    { k:'path', d:'M -4.6 5 C -5.6 -3 -1.6 -9.6 0.6 -13 C 3 -8 4.4 -1 4.4 5 Z', fill:'accent' },
    { k:'path', d:'M -3.6 -1 C -1 0 1.6 0 3.6 -1', fill:'none', stroke:'ink', sw:0.9, op:.35 }
  ]},
  antennae: { id:'antennae', name:'Antennae', mirror:true, tags:['bug','light'], shapes:[
    { k:'path', d:'M 0 5 C -2.6 -2 -5.6 -9 -8 -15', fill:'none', stroke:'bodyDark', sw:2, cap:'round' },
    { k:'circle', cx:-8.6, cy:-17.4, r:3.4, fill:'accent' }
  ]},
  nubs: { id:'nubs', name:'Nubs', mirror:true, tags:['horn','light'], shapes:[
    { k:'path', d:'M -8.4 5 C -9.4 -2.4 -4.4 -6.4 0.4 4 Z', fill:'accent' }
  ]},
  crown: { id:'crown', name:'Crown', mirror:false, tags:['hat'], shapes:[
    { k:'path', d:'M -13 6 L -13 -8 L -6.5 0.4 L 0 -12.4 L 6.5 0.4 L 13 -8 L 13 6 Z', fill:'accent' },
    { k:'circle', cx:0, cy:-13.4, r:1.9, fill:'detail' },
    { k:'circle', cx:-13, cy:-9, r:1.6, fill:'detail' },
    { k:'circle', cx:13, cy:-9, r:1.6, fill:'detail' },
    { k:'path', d:'M -13 1.4 L 13 1.4', fill:'none', stroke:'ink', sw:1.2, op:.3 }
  ]},
  tuft: { id:'tuft', name:'Hair Tuft', mirror:false, tags:['hair','light'], shapes:[
    { k:'path', d:'M -1 7 C -6.4 1.4 -10 -3.4 -12.4 -9.4 C -8 -6.4 -4 -1.4 -1 4 Z', fill:'bodyDark' },
    { k:'path', d:'M -3 7 C -4.4 -1.6 -3.4 -9.4 -0.4 -16.4 C 2 -9.4 2.6 -1.6 2.6 7 Z', fill:'bodyDark' },
    { k:'path', d:'M 1.4 7 C 4.6 1.4 8 -2.6 11.6 -6.4 C 9.6 -0.6 6.6 3.4 3.4 7 Z', fill:'bodyDark' }
  ]},
  crest: { id:'crest', name:'Crest', mirror:false, tags:['fin'], shapes:[
    { k:'path', d:'M -13 6 L -9 -6 L -5 4 L 0 -13.4 L 5 4 L 9 -6 L 13 6 Z', fill:'accent' }
  ]},
  halo: { id:'halo', name:'Halo', mirror:false, tags:['light','float'], shapes:[
    { k:'ellipse', cx:0, cy:-13.4, rx:11, ry:3.6, fill:'none', stroke:'accent', sw:2.6 }
  ]},
  tophat: { id:'tophat', name:'Top Hat', mirror:false, tags:['hat','heavy'], shapes:[
    { k:'path', d:'M -14 5 L 14 5 L 14 2 L -14 2 Z', fill:'ink' },
    { k:'path', d:'M -9 2 L -8 -16 L 8 -16 L 9 2 Z', fill:'ink' },
    { k:'path', d:'M -8.6 -2 L 8.6 -2 L 8.8 1 L -8.8 1 Z', fill:'accent' },
    { k:'path', d:'M -6 -13 L -5.6 -5', fill:'none', stroke:'bone', sw:1, op:.25, cap:'round' }
  ]},
  flame: { id:'flame', name:'Little Flame', mirror:false, tags:['light','float'], shapes:[
    { k:'path', d:'M 0 6 C -6 2 -7 -6 -2 -10 C -3 -6 0 -5 0.6 -8 C 3 -6 5 -2 4 2 C 3.4 5 2 6 0 6 Z', fill:'accent' },
    { k:'path', d:'M 0 5 C -2.6 3 -3 -1 -0.6 -3 C -1 -1 0.6 -0.4 1 -2 C 2.4 -0.6 2.6 2 1.6 4 C 1.2 4.8 0.6 5 0 5 Z', fill:'bone', op:.85 }
  ]},
  mushroom: { id:'mushroom', name:'Mushroom', mirror:false, tags:['grime','light'], shapes:[
    { k:'path', d:'M -2 5 L -1.6 -3 L 1.6 -3 L 2 5 Z', fill:'bone' },
    { k:'path', d:'M -8 -2.4 C -8 -8 -4 -12 0 -12 C 4 -12 8 -8 8 -2.4 Z', fill:'detail' },
    { k:'circle', cx:-3, cy:-7, r:1.3, fill:'bone', op:.8 },
    { k:'circle', cx:3.4, cy:-5.4, r:1, fill:'bone', op:.8 },
    { k:'path', d:'M 6 6 L 6.4 1 L 8.6 1 L 9 6 Z', fill:'bone' },
    { k:'path', d:'M 3.4 1.6 C 3.4 -2 5.4 -4.4 7.6 -4.4 C 9.8 -4.4 11.8 -2 11.8 1.6 Z', fill:'detail' }
  ]},
  bandage: { id:'bandage', name:'Bandage', mirror:false, tags:['hat','light','sewn'], shapes:[
    { k:'path', d:'M -13 -1 C -8 -5 8 -5 13 -1 L 13 4 C 8 0 -8 0 -13 4 Z', fill:'bone' },
    { k:'path', d:'M -11 1.4 L -9.6 2.6 M -6.2 -0.8 L -4.8 0.6 M -1 -1.8 L 0.4 -0.4 M 4.4 -1.4 L 5.8 0 M 9.4 0.6 L 10.8 2', fill:'none', stroke:'detail', sw:1, op:.55, cap:'round' },
    { k:'circle', cx:6, cy:1.4, r:1.6, fill:'accent', op:.55 }
  ]},
  bolt: { id:'bolt', name:'Lightning', mirror:false, tags:['horn','single','light'], shapes:[
    { k:'path', d:'M -1 5 L 3.4 -6 L 0.4 -6 L 4 -15 L -2.6 -3.4 L 0.4 -3.4 Z', fill:'accent' }
  ]}
};

/* ---- EARS ---- mirrored, attach at (ears.x -+ ears.spread, ears.y) --------- */
export const EARS = {
  none: { id:'none', name:'No Ears', mirror:false, tags:['none'], shapes:[] },
  pointy: { id:'pointy', name:'Pointy', mirror:true, tags:['sharp'], shapes:[
    { k:'path', d:'M 1 7 C -2 -1 -9 -8.6 -13.4 -12.4 C -13.6 -4 -10 3 -3.4 8 Z', fill:'body' },
    { k:'path', d:'M -1.4 4.6 C -4 -0.4 -8 -5 -10.4 -7.4 C -10.6 -2.4 -8 1.6 -4.4 4.6 Z', fill:'accent', op:.85 }
  ]},
  round: { id:'round', name:'Round', mirror:true, tags:['soft'], shapes:[
    { k:'circle', cx:-6.4, cy:-3.4, r:7.4, fill:'body' },
    { k:'circle', cx:-6.4, cy:-3, r:4, fill:'accent', op:.8 }
  ]},
  droopy: { id:'droopy', name:'Droopy', mirror:true, tags:['soft','long'], shapes:[
    { k:'path', d:'M -1 -5 C -8.6 -7.4 -15 -1.4 -15 8 C -15 16.4 -9.4 21.4 -4.4 19.4 C -1 18 0 11.4 0 3.4 Z', fill:'body' },
    { k:'path', d:'M -3.4 -1.4 C -8.4 -2.4 -12 2 -12 8.6 C -12 13.4 -9 16.4 -6 15.4', fill:'accent', op:.7 }
  ]},
  tufted: { id:'tufted', name:'Tufted', mirror:true, tags:['sharp','hair'], shapes:[
    { k:'path', d:'M 1.4 7 C -2 -1 -8.4 -8.4 -12.6 -12 C -13 -3.4 -9.6 3 -3.4 8 Z', fill:'body' },
    { k:'path', d:'M -8.4 -8 C -10.4 -12.4 -12 -15.4 -14 -18.4', fill:'none', stroke:'bodyDark', sw:1.8, cap:'round' },
    { k:'path', d:'M -6.4 -6.4 C -7.4 -11.4 -8 -14.4 -9 -18', fill:'none', stroke:'bodyDark', sw:1.6, cap:'round' },
    { k:'path', d:'M -10.4 -6.4 C -13.4 -9.4 -15.4 -11.4 -18 -13', fill:'none', stroke:'bodyDark', sw:1.5, cap:'round' }
  ]},
  frill: { id:'frill', name:'Frill', mirror:true, tags:['fin','odd'], shapes:[
    { k:'path', d:'M 0 5 C -6 0 -12.4 -3.4 -17 -1.4 C -14.4 2 -14 6 -15.4 10.4 C -10 9.4 -3.4 9.4 0 7.4 Z', fill:'body' },
    { k:'path', d:'M -3.4 3.4 C -7.4 1 -11.4 -0.6 -14 0.4 M -3 6.4 C -7 5.6 -11 5.6 -13.6 6.4', fill:'none', stroke:'accent', sw:1.2, op:.8 }
  ]},
  bolts: { id:'bolts', name:'Neck Bolts', mirror:true, tags:['odd','sewn'], shapes:[
    { k:'path', d:'M 0 2 L -9 2 L -9 8 L 0 8 Z', fill:'detail' },
    { k:'circle', cx:-10, cy:5, r:3.6, fill:'detail' },
    { k:'circle', cx:-10, cy:5, r:1.6, fill:'ink', op:.6 }
  ]},
  bat: { id:'bat', name:'Bat Ears', mirror:true, tags:['sharp','big'], shapes:[
    { k:'path', d:'M 2 8 C -4 -2 -12 -12 -20 -20 C -20 -8 -16 4 -6 10 Z', fill:'body' },
    { k:'path', d:'M -1 5 C -5 -1 -11 -8 -16 -14 C -16 -6 -13 2 -6 7 Z', fill:'accent', op:.8 }
  ]},
  antennae: { id:'antennae', name:'Feelers', mirror:true, tags:['bug','light'], shapes:[
    { k:'path', d:'M 0 4 C -6 2 -12 -4 -14 -12', fill:'none', stroke:'bodyDark', sw:1.8, cap:'round' },
    { k:'circle', cx:-14.6, cy:-13.6, r:2.6, fill:'accent' }
  ]}
};

/* ---- LEGS ---- one leg authored growing DOWN from the hip at (0,0) --------- */
export const LEGS = {
  none: { id:'none', name:'No Legs', mirror:false, tags:['none'], count:0, shapes:[] },
  stubby: { id:'stubby', name:'Stubby', mirror:true, tags:['short','walk'], count:2, length:9, shapes:[
    { k:'path', d:'M -3.8 -4 L -3.8 5 C -3.8 7.4 3.8 7.4 3.8 5 L 3.8 -4 Z', fill:'body' },
    { k:'ellipse', cx:-0.4, cy:6.6, rx:5.2, ry:3, fill:'accent' }
  ]},
  spindly: { id:'spindly', name:'Spindly', mirror:true, tags:['long','walk','sneak'], count:2, length:14, shapes:[
    { k:'path', d:'M 0 -3 C -0.6 3 -1.6 8 -2.6 12', fill:'none', stroke:'accent', sw:3.2, cap:'round' },
    { k:'path', d:'M -6.8 13.6 L 1.8 13.6', fill:'none', stroke:'accent', sw:3, cap:'round' }
  ]},
  bird: { id:'bird', name:'Bird', mirror:true, tags:['long','walk','sneak'], count:2, length:15, shapes:[
    { k:'path', d:'M 0 -3 C 0 3 -0.6 7.4 -1.6 11', fill:'none', stroke:'accent', sw:2.9, cap:'round' },
    { k:'path', d:'M -1.6 11 L -7 14.4 M -1.6 11 L -2.2 15.6 M -1.6 11 L 3.4 14', fill:'none', stroke:'accent', sw:2.3, cap:'round' }
  ]},
  hoof: { id:'hoof', name:'Hooves', mirror:true, tags:['short','walk','heavy'], count:2, length:12, shapes:[
    { k:'path', d:'M -4.4 -4 C -5 3 -5 7 -4.4 9 L 4.4 9 C 5 7 5 3 4.4 -4 Z', fill:'body' },
    { k:'path', d:'M -4.8 8 L 4.8 8 L 3.8 12.4 L -3.8 12.4 Z', fill:'ink' }
  ]},
  many: { id:'many', name:'Little Legs', mirror:true, tags:['many','scuttle','sneak'], count:6, length:8, shapes:[
    { k:'path', d:'M 0 -2 C 0.6 2 1 5 1.6 7.6', fill:'none', stroke:'accent', sw:2.5, cap:'round' },
    { k:'circle', cx:1.8, cy:8.6, r:2, fill:'accent' }
  ]},
  tentacles: { id:'tentacles', name:'Tentacles', mirror:true, tags:['many','ooze','sneak'], count:5, length:10, shapes:[
    { k:'path', d:'M 0 -3 C 2.6 2 -2.6 5.6 1.6 10', fill:'none', stroke:'accent', sw:3.4, cap:'round' },
    { k:'circle', cx:0.4, cy:2, r:0.9, fill:'bodyLight', op:.7 },
    { k:'circle', cx:-0.6, cy:6, r:0.9, fill:'bodyLight', op:.7 }
  ]},
  boots: { id:'boots', name:'Little Boots', mirror:true, tags:['short','walk','heavy'], count:2, length:11, shapes:[
    { k:'path', d:'M -3.4 -4 L -3.4 5 L 3.4 5 L 3.4 -4 Z', fill:'body' },
    { k:'path', d:'M -4.2 4 L -4.2 9 C -4.2 10.4 -2.8 11 -1 11 L 5.4 11 C 6.6 11 7 10 6.2 9 L 4.2 6.6 L 4.2 4 Z', fill:'ink' },
    { k:'path', d:'M -2.6 5.6 L 2.4 5.6', fill:'none', stroke:'accent', sw:1, cap:'round', op:.8 }
  ]},
  bony: { id:'bony', name:'Bony', mirror:true, tags:['long','walk','sneak','bone'], count:2, length:14, shapes:[
    { k:'path', d:'M 0 -3 L -0.6 5', fill:'none', stroke:'bone', sw:2.4, cap:'round' },
    { k:'circle', cx:-0.6, cy:5.6, r:1.6, fill:'bone' },
    { k:'path', d:'M -0.6 6 L -1.6 12.4', fill:'none', stroke:'bone', sw:2.2, cap:'round' },
    { k:'path', d:'M -5 13.6 L 2.4 13.6', fill:'none', stroke:'bone', sw:2.4, cap:'round' }
  ]}
};

/* ---- ARMS ---- mirrored, attach at the shoulder, reach out-and-down -------- */
export const ARMS = {
  none: { id:'none', name:'No Arms', mirror:false, tags:['none'], count:0, reach:0, shapes:[] },
  stubby: { id:'stubby', name:'Stubby', mirror:true, tags:['short'], count:2, reach:14, shapes:[
    { k:'path', d:'M 2 -4.4 C -6 -4.6 -12 -1.4 -12.4 3.4 C -12.8 7.4 -8 9.4 -3.4 6.6 C 0 4.6 2.4 1 2.4 -2.4 Z', fill:'bodyDark' },
    { k:'circle', cx:-10.6, cy:4.4, r:3.8, fill:'accent' }
  ]},
  noodle: { id:'noodle', name:'Noodle', mirror:true, tags:['long','hang','grab'], count:2, reach:22, shapes:[
    { k:'path', d:'M 0 0 C -8 2.4 -13.4 8.4 -12.4 15.4', fill:'none', stroke:'accent', sw:2.7, cap:'round' },
    { k:'circle', cx:-12.4, cy:17.6, r:3.4, fill:'accent' },
    { k:'path', d:'M -15 19.4 L -16.4 22.4 M -12.2 20.6 L -12.4 23.6 M -9.4 19.4 L -8.2 22.4', fill:'none', stroke:'accent', sw:1.5, cap:'round' }
  ]},
  claw: { id:'claw', name:'Claws', mirror:true, tags:['long','grab','hang'], count:2, reach:19, shapes:[
    { k:'path', d:'M 0 -2 C -6 -1.4 -10.4 1.4 -12.4 6', fill:'none', stroke:'accent', sw:2.5, cap:'round' },
    { k:'path', d:'M -12.4 6 L -17 9.4 M -12.4 6 L -13.4 11.4 M -12.4 6 L -9 10.4', fill:'none', stroke:'accent', sw:1.7, cap:'round' }
  ]},
  paddle: { id:'paddle', name:'Paddles', mirror:true, tags:['short','grab'], count:2, reach:16, shapes:[
    { k:'path', d:'M 1 -4 C -7 -2.6 -12 2 -13 8 C -14 14 -9 16.4 -5 12.4 C -1.4 9 1.4 2.6 1.4 -2.6 Z', fill:'bodyDark' },
    { k:'path', d:'M -9.4 5 C -10.4 8.4 -9.6 11.6 -7.4 13.4', fill:'none', stroke:'accent', sw:1.6 }
  ]},
  bones: { id:'bones', name:'Bones', mirror:true, tags:['long','grab','hang','bone'], count:2, reach:20, shapes:[
    { k:'path', d:'M 0 0 L -6.4 7', fill:'none', stroke:'bone', sw:2.4, cap:'round' },
    { k:'circle', cx:-6.6, cy:7.4, r:1.7, fill:'bone' },
    { k:'path', d:'M -6.6 7.4 L -11 15', fill:'none', stroke:'bone', sw:2.2, cap:'round' },
    { k:'path', d:'M -11 15 L -14.4 17.4 M -11 15 L -12 19 M -11 15 L -8 18', fill:'none', stroke:'bone', sw:1.5, cap:'round' }
  ]},
  mitts: { id:'mitts', name:'Mitts', mirror:true, tags:['short','grab'], count:2, reach:15, shapes:[
    { k:'path', d:'M 0 -2 C -5 -1 -9 2 -10.4 7', fill:'none', stroke:'accent', sw:2.6, cap:'round' },
    { k:'path', d:'M -7.4 5.6 C -12.4 5 -14.4 9.4 -12 12.4 C -10 14.6 -6.6 13.4 -6.2 10 C -4.4 9.4 -5 6.4 -7.4 5.6 Z', fill:'body' }
  ]}
};

/* ---- TAILS ---- single, attaches at the tail anchor and sweeps +x ---------- */
export const TAILS = {
  none: { id:'none', name:'No Tail', tags:['none'], length:0, shapes:[] },
  curl: { id:'curl', name:'Curl', tags:['thick'], length:20, shapes:[
    { k:'path', d:'M 0 -7 C 12.4 -9 22 -1.4 21.4 8.4 C 21 16 15 20.4 10.4 17.6 C 15.4 16.4 17.6 11.4 16.4 6.4 C 14.4 -1.6 7.4 -3.6 0 2 Z', fill:'body' },
    { k:'path', d:'M 4 -3.4 C 12 -4.6 18 0.6 18 7.4', fill:'none', stroke:'bodyDark', sw:1.2, op:.45, cap:'round' }
  ]},
  whip: { id:'whip', name:'Whip', tags:['thin'], length:24, shapes:[
    { k:'path', d:'M 0 0 C 10.4 -1.4 16.4 -8.4 15.4 -17.4', fill:'none', stroke:'accent', sw:2.4, cap:'round' },
    { k:'path', d:'M 15.4 -17.4 C 12.4 -21.4 17.4 -25.4 20 -21.4 C 21.4 -19 18.4 -16.4 15.4 -17.4 Z', fill:'accent' }
  ]},
  puff: { id:'puff', name:'Puff', tags:['soft'], length:16, shapes:[
    { k:'path', d:'M 0 0 C 5.4 0.4 8.4 -1.6 10.4 -4.4', fill:'none', stroke:'bodyDark', sw:3.4, cap:'round' },
    { k:'circle', cx:14.4, cy:-8.4, r:6.6, fill:'bodyLight' },
    { k:'circle', cx:11.4, cy:-4.4, r:3.4, fill:'bodyLight' }
  ]},
  spade: { id:'spade', name:'Spade', tags:['thin','sinister'], length:22, shapes:[
    { k:'path', d:'M 0 2 C 9.4 2.4 14.4 -4 14.4 -12.4', fill:'none', stroke:'accent', sw:2.1, cap:'round' },
    { k:'path', d:'M 14.4 -11.4 L 9.4 -19.4 L 19.4 -19.4 Z', fill:'accent' }
  ]},
  stub: { id:'stub', name:'Stub', tags:['soft','short'], length:8, shapes:[
    { k:'ellipse', cx:1.6, cy:-1, rx:5.8, ry:5, fill:'bodyLight' }
  ]},
  ringed: { id:'ringed', name:'Ringed', tags:['thick'], length:22, shapes:[
    { k:'path', d:'M 0 -5.4 C 9.4 -6.4 16.4 -2 19.4 6 C 20.6 9.6 17.4 12 15.4 9.4 C 17.4 5.4 14.4 0.6 9.4 -0.4 C 5 -1.4 2 0.6 0 4 Z', fill:'body' },
    { k:'path', d:'M 7.4 -4.6 C 6.4 -1 6.4 2 7.4 4.4', fill:'none', stroke:'detail', sw:2, op:.75 },
    { k:'path', d:'M 14.4 -1.4 C 13.4 1.4 13.4 4.4 14.6 7.4', fill:'none', stroke:'detail', sw:2, op:.75 }
  ]},
  vertebrae: { id:'vertebrae', name:'Vertebrae', tags:['thin','sinister','bone'], length:22, shapes:[
    { k:'path', d:'M 0 0 C 6 -1 11 -6 14 -12 C 15.6 -15.4 17.4 -17.4 19.4 -19', fill:'none', stroke:'bone', sw:1.6, cap:'round' },
    { k:'ellipse', cx:4, cy:-1.2, rx:2.2, ry:1.6, fill:'bone' },
    { k:'ellipse', cx:8.6, cy:-3.8, rx:2, ry:1.5, fill:'bone' },
    { k:'ellipse', cx:12.4, cy:-8, rx:1.8, ry:1.4, fill:'bone' },
    { k:'ellipse', cx:15.6, cy:-13, rx:1.6, ry:1.3, fill:'bone' },
    { k:'circle', cx:19.6, cy:-19.4, r:1.6, fill:'bone' }
  ]},
  fin: { id:'fin', name:'Fin', tags:['thin','damp'], length:18, shapes:[
    { k:'path', d:'M 0 -3 C 6 -3 10 -1 13 2 C 14.4 -4 17 -8 20 -10 C 19 -4 19 2 20 8 C 17 6 14 4 13 2 C 10 5 6 6 0 5 Z', fill:'accent' },
    { k:'path', d:'M 14 0 L 18.4 -6 M 14.4 3 L 18.6 6', fill:'none', stroke:'ink', sw:.8, op:.35, cap:'round' }
  ]}
};

/* ---- WINGS ---- mirrored, attach at (wings.x -+ wings.spread, wings.y) ----- */
export const WINGS = {
  none: { id:'none', name:'No Wings', mirror:false, tags:['none'], count:0, span:0, shapes:[] },
  bat: { id:'bat', name:'Bat', mirror:true, tags:['sharp'], count:2, span:30, shapes:[
    { k:'path', d:'M 0 -4 C -10 -20 -24 -24.4 -30 -20 C -27 -14.4 -24 -10.4 -22 -6.4 C -25 -6.4 -28 -4.4 -29 -1 C -24 -1.4 -20 0.4 -18 4 C -19 7.4 -18 11.4 -15 13.4 C -9 8.4 -3 2.4 0 -4 Z', fill:'bodyDark' },
    { k:'path', d:'M -1.4 -3.4 C -9 -11.4 -18 -17.4 -27.4 -19.4 M -3 0.4 C -9.4 -3 -15.4 -5 -21.4 -5.4 M -4.4 4.4 C -8.4 4 -13.4 4.4 -17 5.4', fill:'none', stroke:'ink', sw:0.9, op:.35 }
  ]},
  moth: { id:'moth', name:'Moth', mirror:true, tags:['soft'], count:2, span:28, shapes:[
    { k:'path', d:'M 0 -2 C -6 -18.4 -20 -24.4 -27 -18.4 C -32.4 -13 -28 -3 -18 0.4 C -10 2.4 -4 2 0 -2 Z', fill:'bodyLight' },
    { k:'path', d:'M -2 2 C -8.4 4 -16.4 8.4 -17.4 14.4 C -18.4 20.4 -11 22.4 -6 17.4 C -2 13.4 0 7.4 -2 2 Z', fill:'body' },
    { k:'circle', cx:-18.4, cy:-8.4, r:3.6, fill:'accent' },
    { k:'circle', cx:-18.4, cy:-8.4, r:1.5, fill:'detail' },
    { k:'path', d:'M -8.4 12.4 C -11.4 13.4 -13.4 15.4 -13.4 17.4', fill:'none', stroke:'detail', sw:1.2, op:.7 }
  ]},
  bug: { id:'bug', name:'Bug', mirror:true, tags:['thin'], count:2, span:26, shapes:[
    { k:'path', d:'M 0 -1.4 C -8.4 -12.4 -20.4 -16.4 -25.4 -12.4 C -29.4 -9 -24.4 -1 -14.4 2 C -7.4 4 -2.4 3 0 -1.4 Z', fill:'bone', op:.42 },
    { k:'path', d:'M -1.4 -1 C -8.4 -6.4 -16.4 -10.4 -23 -11.4 M -2.4 1.4 C -8.4 -0.6 -15.4 -2 -21 -1.4', fill:'none', stroke:'bodyDark', sw:0.9, op:.6 }
  ]},
  feather: { id:'feather', name:'Feathered', mirror:true, tags:['soft','bird'], count:2, span:29, shapes:[
    { k:'path', d:'M 0 -3.4 C -9 -14.4 -22 -18.4 -28.4 -13.4 C -24.4 -10.4 -22 -6.4 -21.4 -2.4 C -14.4 -3.4 -6.4 -1 0 -3.4 Z', fill:'bodyLight' },
    { k:'path', d:'M -2 0.4 C -10.4 1 -18.4 4.4 -22.4 9.4 C -16.4 10.4 -9.4 8 -4.4 4.4 Z', fill:'body' },
    { k:'path', d:'M -21.4 -2.4 L -24.4 3.4 M -15.4 -2.4 L -17.4 4.4 M -9.4 -2.4 L -10.4 4.4', fill:'none', stroke:'bodyDark', sw:1.1, op:.5 }
  ]},
  skeletal: { id:'skeletal', name:'Skeletal', mirror:true, tags:['sharp','bone'], count:2, span:30, shapes:[
    { k:'path', d:'M 0 -4 C -8 -12 -18 -20 -28 -22', fill:'none', stroke:'bone', sw:2, cap:'round' },
    { k:'path', d:'M -12 -14 L -22 -8 M -19 -18 L -27 -12 M -6 -9 L -15 0', fill:'none', stroke:'bone', sw:1.6, cap:'round' },
    { k:'path', d:'M -12 -14 L -6 -9 L -15 0 Z', fill:'bodyDark', op:.35 }
  ]}
};

/* ---- SURFACE DETAILS --------------------------------------------------------
   Authored in a local +-16 box; placed at anchors.detail and scaled uniformly
   by min(w,h)/30 so circles never distort.
--------------------------------------------------------------------------- */
export const DETAILS = {
  none: { id:'none', name:'Plain', tags:['none'], shapes:[] },
  spots: { id:'spots', name:'Spots', tags:['skin'], shapes:[
    { k:'circle', cx:-9.4, cy:-3.4, r:5.4, fill:'detail', op:.75 },
    { k:'circle', cx:4.4, cy:3.4, r:4.2, fill:'detail', op:.75 },
    { k:'circle', cx:10.4, cy:-7.4, r:3, fill:'detail', op:.75 },
    { k:'circle', cx:-2.4, cy:9.4, r:2.6, fill:'detail', op:.75 }
  ]},
  stitches: { id:'stitches', name:'Seam', tags:['sewn'], shapes:[
    { k:'path', d:'M -14 0 Q 0 4.4 14 0', fill:'none', stroke:'detail', sw:1.5, cap:'round' },
    { k:'path', d:'M -10.4 -3.4 L -9.4 4.4 M -5 -2.4 L -4.4 5.4 M 0.4 -1.6 L 0.4 6 M 5.6 -2.4 L 5 5.4 M 10.6 -3.4 L 9.6 4.4', fill:'none', stroke:'detail', sw:1.3, cap:'round' }
  ]},
  patch: { id:'patch', name:'Patch', tags:['sewn'], shapes:[
    { k:'path', d:'M -11 -8.4 L 9.4 -10.4 L 12 8.4 L -8.4 10.4 Z', fill:'detail', op:.42 },
    { k:'path', d:'M -11 -8.4 L 9.4 -10.4 L 12 8.4 L -8.4 10.4 Z', fill:'none', stroke:'detail', sw:1.2, op:.8 },
    { k:'path', d:'M -8.4 -8.4 L -10 -5.4 M -2.4 -9.4 L -4 -6.4 M 3.4 -9.6 L 2 -6.6 M 10.4 -3.4 L 7.4 -4.4 M 11 3.4 L 8 2.4 M 5.4 9.4 L 4 6.4 M -1.4 10 L -2.6 7 M -8.4 6.4 L -5.4 5.4 M -9.4 0.4 L -6.4 -0.4', fill:'none', stroke:'detail', sw:1.1, cap:'round' }
  ]},
  drips: { id:'drips', name:'Drips', tags:['grime'], shapes:[
    { k:'path', d:'M -15 -12 L -10.6 -12 C -10 -6 -10.4 -2 -11.4 0.6 C -13.6 3 -16.4 1 -15.6 -2.4 C -15 -5 -15.2 -8.4 -15 -12 Z', fill:'detail', op:.72 },
    { k:'path', d:'M -4.4 -12 L 0.4 -12 C 1 -4 0 2.4 -1 6.4 C -2.6 10.4 -6.4 8.6 -5.4 4.4 C -4.6 0.6 -4.8 -5.4 -4.4 -12 Z', fill:'detail', op:.72 },
    { k:'path', d:'M 8 -12 L 12.4 -12 C 13 -8 12.4 -4.4 11.4 -2.4 C 9.4 -0.4 7 -2 7.8 -4.6 C 8.2 -6.6 8 -9.4 8 -12 Z', fill:'detail', op:.72 },
    { k:'circle', cx:-2.4, cy:11.4, r:1.8, fill:'detail', op:.6 }
  ]},
  stripes: { id:'stripes', name:'Stripes', tags:['skin'], shapes:[
    { k:'path', d:'M -13 -7.4 Q -6 -2.4 -13 3.4', fill:'none', stroke:'detail', sw:2.6, cap:'round', op:.7 },
    { k:'path', d:'M -3.4 -9.4 Q 3.4 -3 -3.4 3.4', fill:'none', stroke:'detail', sw:2.6, cap:'round', op:.7 },
    { k:'path', d:'M 6.4 -8.4 Q 13 -2.4 6.4 3.4', fill:'none', stroke:'detail', sw:2.6, cap:'round', op:.7 }
  ]},
  freckles: { id:'freckles', name:'Freckles', tags:['skin','light'], shapes:[
    { k:'circle', cx:-11, cy:-2, r:1.5, fill:'detail', op:.65 },
    { k:'circle', cx:-6, cy:2.4, r:1.2, fill:'detail', op:.65 },
    { k:'circle', cx:-1, cy:-3.4, r:1.4, fill:'detail', op:.65 },
    { k:'circle', cx:4.4, cy:1.4, r:1.3, fill:'detail', op:.65 },
    { k:'circle', cx:9.4, cy:-2.4, r:1.5, fill:'detail', op:.65 },
    { k:'circle', cx:1.4, cy:6.4, r:1.1, fill:'detail', op:.65 }
  ]},
  scar: { id:'scar', name:'Scar', tags:['grime'], shapes:[
    { k:'path', d:'M -8.4 -8.4 L 8.4 8.4 M 8.4 -8.4 L -8.4 8.4', fill:'none', stroke:'detail', sw:2, cap:'round' },
    { k:'path', d:'M -5 -1.4 L -2.4 -4 M 3.4 2.4 L 6 -0.4', fill:'none', stroke:'detail', sw:1.2, cap:'round', op:.7 }
  ]},
  cracks: { id:'cracks', name:'Cracks', tags:['grime','fragile'], shapes:[
    { k:'path', d:'M -12 -10 L -6 -3 L -8 3 L -2 8 M -6 -3 L 0 -6 L 4 -1 M 4 -1 L 10 2 M 4 -1 L 6 6', fill:'none', stroke:'detail', sw:1.3, cap:'round', join:'round' }
  ]},
  moss: { id:'moss', name:'Moss', tags:['grime','soft'], shapes:[
    { k:'path', d:'M -12 4 C -12 -2 -6 -4 -2 0 C 2 -4 8 -2 8 4 C 8 8 2 9 -2 6 C -6 9 -12 8 -12 4 Z', fill:'detail', op:.6 },
    { k:'circle', cx:-6, cy:2, r:1.4, fill:'bodyLight', op:.6 },
    { k:'circle', cx:2, cy:1, r:1.1, fill:'bodyLight', op:.6 },
    { k:'path', d:'M 6 -8 L 7 -12 M 9 -6 L 12 -9', fill:'none', stroke:'detail', sw:1.2, cap:'round' },
    { k:'circle', cx:7.2, cy:-12.6, r:1.3, fill:'detail' },
    { k:'circle', cx:12.4, cy:-9.4, r:1.1, fill:'detail' }
  ]},
  ribs: { id:'ribs', name:'Ribs', tags:['bone','sinister'], shapes:[
    { k:'path', d:'M 0 -12 L 0 12', fill:'none', stroke:'bone', sw:1.6, cap:'round', op:.85 },
    { k:'path', d:'M 0 -8 C -5 -8 -9 -6 -11 -3 M 0 -8 C 5 -8 9 -6 11 -3 M 0 -3 C -5 -3 -9 -1 -11 2 M 0 -3 C 5 -3 9 -1 11 2 M 0 2 C -5 2 -8 4 -10 7 M 0 2 C 5 2 8 4 10 7 M 0 7 C -4 7 -7 9 -8 11 M 0 7 C 4 7 7 9 8 11', fill:'none', stroke:'bone', sw:1.4, cap:'round', op:.85 }
  ]},
  plaster: { id:'plaster', name:'Plaster', tags:['sewn','light'], shapes:[
    { k:'path', d:'M -10 -5 L 9 -9 L 11 3 L -8 7 Z', fill:'bone', op:.9 },
    { k:'path', d:'M -4 -3.4 L 5 -5.4 L 6 0 L -3 2 Z', fill:'accent', op:.5 },
    { k:'circle', cx:-7, cy:-1, r:.6, fill:'detail', op:.6 },
    { k:'circle', cx:-6.4, cy:3, r:.6, fill:'detail', op:.6 },
    { k:'circle', cx:8, cy:-5.6, r:.6, fill:'detail', op:.6 },
    { k:'circle', cx:8.8, cy:-1.6, r:.6, fill:'detail', op:.6 }
  ]}
};

/** Slot registry — everything a "re-roll just the horns" UI needs. */
export const SLOTS = {
  eyes:   { key:'eyes',   label:'Eyes',    lib:EYES },
  mouth:  { key:'mouth',  label:'Mouth',   lib:MOUTHS },
  top:    { key:'top',    label:'Horns',   lib:TOPS },
  ears:   { key:'ears',   label:'Ears',    lib:EARS },
  arms:   { key:'arms',   label:'Arms',    lib:ARMS },
  legs:   { key:'legs',   label:'Legs',    lib:LEGS },
  tail:   { key:'tail',   label:'Tail',    lib:TAILS },
  wings:  { key:'wings',  label:'Wings',   lib:WINGS },
  detail: { key:'detail', label:'Markings',lib:DETAILS }
};
export const SLOT_KEYS = Object.keys(SLOTS);

/** [{id,name}] for a slot — for building a variant picker. */
export function listVariants(slot) {
  const s = SLOTS[slot];
  if (!s) return [];
  return Object.keys(s.lib).map(id => ({ id, name: s.lib[id].name }));
}

/* =============================================================================
   5. SEEDED RANDOM
   xmur3 (string -> 32-bit seed) + mulberry32 (fast, decent, tiny).
   Math.random() is used ONLY to invent a fresh seed when the caller gives none;
   generation itself is always driven by the seed.
   ============================================================================= */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 0..1 generator for a seed string/number. */
export function makeRng(seed) {
  return mulberry32(typeof seed === 'number' ? (seed >>> 0) : xmur3(String(seed)));
}

/** A fresh short seed string, e.g. "k3f9q1z". */
export function makeSeed() {
  return Math.random().toString(36).slice(2, 10);
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const chance = (rng, p) => rng() < p;
function pickWeighted(rng, entries) { // entries: [[value, weight], ...]
  let total = 0;
  for (const e of entries) total += e[1];
  let roll = rng() * total;
  for (const e of entries) { roll -= e[1]; if (roll <= 0) return e[0]; }
  return entries[entries.length - 1][0];
}
const round2 = n => Math.round(n * 100) / 100;

/* =============================================================================
   6. GENERATION
   ============================================================================= */

const has = (body, tag) => body.tags.indexOf(tag) !== -1;

/** Eye variants that suit a body: small faces can't hold clusters. */
function eyeChoices(body) {
  const small = has(body, 'smallFace');
  const base = [['pair', 5], ['beady', 3], ['sleepy', 2.5], ['slit', 2], ['shut', 1.2], ['dead', 1.4], ['manic', 2],
    ['lashes', 1.6], ['weepy', 1.4], ['wink', 1.3], ['hollow', 1.1]];
  if (small) return base.concat([['stalks', 1.2]]);
  return base.concat([['cyclops', 2.2], ['cluster', 1.6], ['triple', 1.6], ['stalks', 1.4], ['goggle', 1.5]]);
}

/** Mouths that read at the available scale, and that don't fight the eyes. */
function mouthChoices(body, eyesId) {
  const eyes = EYES[eyesId];
  const busy = eyes.tags.indexOf('many') !== -1 || eyesId === 'cyclops';
  const small = has(body, 'smallFace');
  let list = [['grin', 4], ['frown', 3], ['smirk', 3], ['fangs', 3], ['oh', 2.4], ['wavy', 2.2], ['stitched', 2], ['tusks', 1.6], ['beak', 2], ['gape', 2.4],
    ['zip', 1.5], ['moustache', 1.4], ['drool', 1.4], ['pout', 1.6], ['chatter', 1.3]];
  // A cyclops or a five-eye cluster already owns the face — keep the mouth quiet.
  if (busy) list = list.filter(m => ['frown', 'smirk', 'oh', 'wavy', 'stitched', 'fangs', 'zip', 'pout'].indexOf(m[0]) !== -1);
  // A tiny head can't hold a gaping maw, a rack of tusks or a moustache.
  if (small) list = list.filter(m => ['gape', 'tusks', 'moustache', 'chatter'].indexOf(m[0]) === -1);
  // Blind eyes (X's, shut) pair well with an unbothered mouth.
  if (eyes.tags.indexOf('blind') !== -1) list = list.filter(m => m[0] !== 'gape');
  return list;
}

function topChoices(body) {
  const list = [['none', 3], ['curled', 2.6], ['spiky', 2.6], ['antlers', 2.2], ['stub', 2], ['antennae', 2], ['nubs', 2], ['crown', 1.4], ['tuft', 2], ['crest', 2], ['halo', 1.1],
    ['tophat', 1.3], ['flame', 1.1], ['mushroom', 1.3], ['bandage', 1.2], ['bolt', 1]];
  // Top-heavy bodies already have a huge skull; a heavy rack tips them over.
  if (has(body, 'topHeavy')) return list.filter(t => ['curled', 'crown', 'tophat'].indexOf(t[0]) === -1);
  // Very small skulls can't carry a wide crown, crest or hat.
  if (has(body, 'smallFace')) return list.filter(t => ['crown', 'crest', 'tophat', 'bandage'].indexOf(t[0]) === -1);
  return list;
}

function bodyPlan(rng, body) {
  const sits = has(body, 'sits');
  const crawler = has(body, 'crawler');
  const thin = has(body, 'thin');
  const squat = has(body, 'squat');

  // --- LEGS -----------------------------------------------------------------
  // The roll is deliberately spread so a shelf is not six bipeds: roughly a
  // fifth of creatures end up legless shufflers, and crawler-shaped bodies
  // reliably become scuttlers.
  let legs;
  if (sits && !crawler) {
    legs = pickWeighted(rng, [['none', 6], ['tentacles', 3]]);
  } else if (crawler) {
    legs = pickWeighted(rng, [['many', 6], ['tentacles', 2], ['none', 1], ['spindly', 1.5]]);
  } else if (thin) {
    legs = pickWeighted(rng, [['spindly', 5], ['bird', 4], ['stubby', 1], ['none', 1], ['bony', 1.6]]);
  } else if (squat) {
    legs = pickWeighted(rng, [['stubby', 5], ['many', 2], ['none', 2], ['hoof', 1.5], ['boots', 1.4]]);
  } else {
    legs = pickWeighted(rng, [['stubby', 4], ['hoof', 2.5], ['bird', 2], ['spindly', 2], ['none', 2], ['boots', 1.4], ['bony', 1.2]]);
  }
  if ((legs === 'many' || legs === 'tentacles') && (body.anchors.manyLegs || []).length < 4) {
    legs = squat || sits ? 'none' : 'stubby';
  }

  // --- ARMS -----------------------------------------------------------------
  // Long arms are what let a creature hang off the shelf edge, so they get a
  // real slice of the roll rather than being a rare novelty.
  const arms = pickWeighted(rng, [['none', 4], ['stubby', 3], ['noodle', 3], ['claw', 2.2], ['paddle', 1.8], ['bones', 1.6], ['mitts', 1.4]]);

  // --- WINGS ----------------------------------------------------------------
  let wings = 'none';
  if (!has(body, 'noWings') && chance(rng, 0.24)) {
    wings = pickWeighted(rng, [['bat', 3], ['moth', 3], ['bug', 2], ['feather', 2.4], ['skeletal', 1.6]]);
  }

  // --- TAIL -----------------------------------------------------------------
  const tail = pickWeighted(rng, [['none', 4], ['curl', 2.6], ['whip', 2], ['puff', 2.4], ['spade', 1.8], ['stub', 2], ['ringed', 1.6], ['vertebrae', 1.3], ['fin', 1.2]]);

  return { legs, arms, wings, tail };
}

/**
 * Roll a creature.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.seed]     any string/number; omit for a fresh random seed
 * @param {string}  [opts.body]     force a body id
 * @param {string}  [opts.palette]  force a palette id
 * @param {object}  [opts.parts]    force individual slots, e.g. { top:'antlers' }
 * @returns {object} CREATURE — plain, JSON-serializable:
 *
 *   {
 *     v: 1,
 *     seed: 'k3f9q1z',                     // reproduce with generateCreature({seed})
 *     body: 'pear',                        // key into BODIES
 *     palette: 'mint',                     // key into PALETTES
 *     parts: { eyes, mouth, top, ears, arms, legs, tail, wings, detail },
 *     tune:  { eyeScale, eyeSpread, mouthScale, lean },  // small per-creature jitter
 *     anatomy: { ... },                    // see ANATOMY below
 *     rig: { ... }                         // see RIG below
 *   }
 *
 * ANATOMY — capability flags for the shelf behaviour system. Read these; never
 * infer physicality from part names.
 *   hasLegs, legCount, legStyle       'stubby'|'spindly'|'bird'|'hoof'|'many'|'tentacles'|'none'
 *   hasArms, armCount, armStyle, armReach   (armReach in art units; >=18 is a long arm)
 *   hasWings, wingCount, wingStyle, wingSpan
 *   hasTail, tailStyle, tailLength
 *   hasTentacles                      legStyle === 'tentacles'
 *   isLimbless                        no legs AND no arms — it can only shuffle/hop
 *   heightClass  'tall'|'medium'|'squat'
 *   buildClass   'thin'|'round'|'lumpy'|'wide'
 *   gait   'walk' | 'scuttle' | 'ooze' | 'hop'   — the natural way it moves
 *   can: { walk, scuttle, hop, sneak, hang, climb, glide, wag }
 *
 * RIG — absolute art-space pivots (same -50..50 space as the SVG), so an
 * animator can drive each limb without re-deriving geometry:
 *   rig.legs  [{ id:'leg-0', index, side:'left'|'right', x, y, angle, length, style }]
 *   rig.arms  [{ id:'arm-0', index, side, x, y, angle, reach, style }]
 *   rig.wings [{ id:'wing-0', index, side, x, y, angle, span, style }]
 *   rig.tail  { id:'tail', x, y, angle, length, style } | null
 *   rig.head  { x, y, r }        pivot + radius for a head bob / nod
 *   rig.eyes  [{ id, x, y, r }]  blink pivots (one per rendered eye)
 *   rig.base  { y }              ground contact line (BASELINE)
 * `angle` is degrees; 0 = straight down for a limb, and it is exactly the
 * rotation the renderer bakes into the mount, so rotating the inner part group
 * by 0 reproduces the resting pose.
 */
export function generateCreature(opts = {}) {
  const seed = opts.seed == null ? makeSeed() : String(opts.seed);
  const rng = makeRng(seed);
  const forced = opts.parts || {};

  const bodyId = opts.body && BODIES[opts.body] ? opts.body : pick(rng, BODY_IDS);
  const body = BODIES[bodyId];
  const paletteId = opts.palette && PALETTES[opts.palette] ? opts.palette : pick(rng, PALETTE_IDS);

  const eyes = forced.eyes && EYES[forced.eyes] ? forced.eyes : pickWeighted(rng, eyeChoices(body));
  const mouth = forced.mouth && MOUTHS[forced.mouth] ? forced.mouth : pickWeighted(rng, mouthChoices(body, eyes));
  const top = forced.top && TOPS[forced.top] ? forced.top : pickWeighted(rng, topChoices(body));

  // Ears: skip when the head already carries a wide crown/crest, so the skull
  // does not turn into a pile of silhouettes fighting each other.
  const topBusy = ['crown', 'crest'].indexOf(top) !== -1;
  let ears = forced.ears && EARS[forced.ears] ? forced.ears
    : pickWeighted(rng, topBusy
        ? [['none', 6], ['round', 1.5], ['pointy', 1.5], ['bolts', 1]]
        : [['none', 2.6], ['pointy', 3], ['round', 3], ['droopy', 2.4], ['tufted', 2], ['frill', 1.6], ['bolts', 1.4], ['bat', 1.6], ['antennae', 1.2]]);

  const plan = bodyPlan(rng, body);
  const legs = forced.legs && LEGS[forced.legs] ? forced.legs : plan.legs;
  const arms = forced.arms && ARMS[forced.arms] ? forced.arms : plan.arms;
  const wings = forced.wings && WINGS[forced.wings] ? forced.wings : plan.wings;
  const tail = forced.tail && TAILS[forced.tail] ? forced.tail : plan.tail;

  // Markings: at most one, and rarer on an already-busy creature.
  const busyCount = (top !== 'none' ? 1 : 0) + (wings !== 'none' ? 1 : 0) + (ears !== 'none' ? 1 : 0);
  let detail = forced.detail && DETAILS[forced.detail] ? forced.detail
    : pickWeighted(rng, busyCount >= 2
        ? [['none', 6], ['spots', 1.6], ['freckles', 1.6], ['stitches', 1.2], ['cracks', 1], ['plaster', 1]]
        : [['none', 2.4], ['spots', 2.4], ['stitches', 2], ['patch', 1.8], ['drips', 1.6], ['stripes', 1.8], ['freckles', 1.6], ['scar', 1.2],
           ['cracks', 1.4], ['moss', 1.3], ['ribs', 1.1], ['plaster', 1.2]]);

  const tune = {
    eyeScale: round2(0.92 + rng() * 0.2),
    eyeSpread: round2(0.92 + rng() * 0.18),
    mouthScale: round2(0.92 + rng() * 0.18),
    lean: round2((rng() * 2 - 1) * 3.2)
  };

  const creature = { v: 1, seed, body: bodyId, palette: paletteId,
    parts: { eyes, mouth, top, ears, arms, legs, tail, wings, detail }, tune };
  creature.anatomy = describeAnatomy(creature);
  creature.rig = buildRig(creature);
  return creature;
}

/** Re-roll a single slot, keeping everything else. Returns a NEW creature. */
export function rerollPart(creature, slot, seed) {
  if (!SLOTS[slot]) throw new Error(`unknown slot: ${slot}`);
  const c = normalizeCreature(creature);
  const rng = makeRng(seed == null ? makeSeed() : seed);
  const ids = Object.keys(SLOTS[slot].lib).filter(id => id !== c.parts[slot]);
  const next = ids.length ? pick(rng, ids) : c.parts[slot];
  return generateCreature({
    seed: c.seed, body: c.body, palette: c.palette,
    parts: Object.assign({}, c.parts, { [slot]: next })
  });
}

/** Fill in defaults / repair an unknown id so rendering never throws. */
export function normalizeCreature(creature) {
  const c = creature && typeof creature === 'object' ? creature : {};
  const bodyId = BODIES[c.body] ? c.body : BODY_IDS[0];
  const paletteId = PALETTES[c.palette] ? c.palette : PALETTE_IDS[0];
  const p = c.parts || {};
  const parts = {
    eyes: EYES[p.eyes] ? p.eyes : 'pair',
    mouth: MOUTHS[p.mouth] ? p.mouth : 'grin',
    top: TOPS[p.top] ? p.top : 'none',
    ears: EARS[p.ears] ? p.ears : 'none',
    arms: ARMS[p.arms] ? p.arms : 'none',
    legs: LEGS[p.legs] ? p.legs : 'none',
    tail: TAILS[p.tail] ? p.tail : 'none',
    wings: WINGS[p.wings] ? p.wings : 'none',
    detail: DETAILS[p.detail] ? p.detail : 'none'
  };
  const t = c.tune || {};
  const tune = {
    eyeScale: typeof t.eyeScale === 'number' ? t.eyeScale : 1,
    eyeSpread: typeof t.eyeSpread === 'number' ? t.eyeSpread : 1,
    mouthScale: typeof t.mouthScale === 'number' ? t.mouthScale : 1,
    lean: typeof t.lean === 'number' ? t.lean : 0
  };
  const out = { v: 1, seed: c.seed == null ? '' : String(c.seed), body: bodyId, palette: paletteId, parts, tune };
  out.anatomy = c.anatomy && c.anatomy.legStyle === parts.legs ? c.anatomy : describeAnatomy(out);
  out.rig = c.rig && Array.isArray(c.rig.legs) && c.rig.legs.length === out.anatomy.legCount ? c.rig : buildRig(out);
  return out;
}

/** Resolve the palette (plus any per-creature overrides) into role -> hex. */
export function resolveColors(creature) {
  const c = creature && creature.parts ? creature : normalizeCreature(creature);
  const pal = PALETTES[c.palette] || PALETTES[PALETTE_IDS[0]];
  return Object.assign({
    body: pal.body, bodyDark: pal.bodyDark, bodyLight: pal.bodyLight,
    accent: pal.accent, detail: pal.detail, ink: pal.ink,
    line: pal.line || pal.ink, bone: pal.bone || BONE
  }, c.colors || {});
}

/* --- anatomy ---------------------------------------------------------------- */

/** How many limb mounts a leg style actually gets on this body. */
function legAnchorsFor(body, legStyle) {
  const def = LEGS[legStyle];
  if (!def || legStyle === 'none') return [];
  const many = def.tags.indexOf('many') !== -1;
  const list = many ? (body.anchors.manyLegs || []) : (body.anchors.legs || []);
  return list;
}

/**
 * Capability flags derived from the rolled parts. This is the contract the
 * behaviour/animation systems read — never re-derive it from part names.
 */
export function describeAnatomy(creature) {
  const c = creature.parts ? creature : normalizeCreature(creature);
  const body = BODIES[c.body];
  const legDef = LEGS[c.parts.legs], armDef = ARMS[c.parts.arms];
  const wingDef = WINGS[c.parts.wings], tailDef = TAILS[c.parts.tail];

  const legAnchors = legAnchorsFor(body, c.parts.legs);
  const legCount = legAnchors.length;
  const hasLegs = legCount > 0;
  const hasArms = c.parts.arms !== 'none' && (body.anchors.arms || []).length > 0;
  const armCount = hasArms ? body.anchors.arms.length : 0;
  const armReach = hasArms ? (armDef.reach || 0) : 0;
  const hasWings = c.parts.wings !== 'none';
  const hasTail = c.parts.tail !== 'none';
  const hasTentacles = c.parts.legs === 'tentacles';

  const heightClass = has(body, 'tall') ? 'tall' : has(body, 'squat') ? 'squat' : 'medium';
  const buildClass = has(body, 'thin') ? 'thin' : has(body, 'lumpy') ? 'lumpy' : has(body, 'wide') ? 'wide' : 'round';

  const scuttle = hasLegs && legCount >= 4 && !hasTentacles;
  const ooze = hasTentacles;
  const walk = hasLegs && legCount >= 2 && !ooze && !scuttle;
  const gait = ooze ? 'ooze' : scuttle ? 'scuttle' : walk ? 'walk' : 'hop';

  return {
    hasLegs, legCount, legStyle: c.parts.legs,
    hasArms, armCount, armStyle: c.parts.arms, armReach,
    hasWings, wingCount: hasWings ? 2 : 0, wingStyle: c.parts.wings, wingSpan: hasWings ? (wingDef.span || 0) : 0,
    hasTail, tailStyle: c.parts.tail, tailLength: hasTail ? (tailDef.length || 0) : 0,
    hasTentacles,
    isLimbless: !hasLegs && !hasArms,
    heightClass, buildClass, gait,
    can: {
      walk,                                    // alternating two-leg walk cycle
      scuttle,                                 // fast many-leg ripple
      hop: !hasLegs || c.parts.legs === 'stubby',   // legless shuffle-hop, or short-leg bounce
      sneak: (hasLegs && legDef.tags.indexOf('sneak') !== -1) || ooze,
      hang: hasArms && armReach >= 18,         // long enough to grip the shelf edge
      climb: hasArms && hasLegs && armReach >= 14,
      glide: hasWings,
      wag: hasTail && (tailDef.length || 0) >= 12
    }
  };
}

/* --- rig -------------------------------------------------------------------- */

/** Absolute per-limb pivots + resting angles. See generateCreature() docs. */
export function buildRig(creature) {
  const c = creature.parts ? creature : normalizeCreature(creature);
  const body = BODIES[c.body];
  const a = body.anchors;
  const legDef = LEGS[c.parts.legs], armDef = ARMS[c.parts.arms];
  const wingDef = WINGS[c.parts.wings], tailDef = TAILS[c.parts.tail];

  const legAnchors = legAnchorsFor(body, c.parts.legs);
  const legs = legAnchors.map((an, i) => ({
    id: `leg-${i}`, index: i, side: an.x < 0 ? 'left' : 'right',
    x: an.x, y: an.y, angle: an.angle || 0, length: legDef.length || 0, style: c.parts.legs
  }));

  const arms = (c.parts.arms === 'none' ? [] : (a.arms || [])).map((an, i) => ({
    id: `arm-${i}`, index: i, side: an.x < 0 ? 'left' : 'right',
    x: an.x, y: an.y, angle: an.angle || 0, reach: armDef.reach || 0, style: c.parts.arms
  }));

  const wings = c.parts.wings === 'none' ? [] : [-1, 1].map((side, i) => ({
    id: `wing-${i}`, index: i, side: side < 0 ? 'left' : 'right',
    x: round2(a.wings.x + side * a.wings.spread), y: a.wings.y,
    angle: a.wings.angle || 0, span: wingDef.span || 0, style: c.parts.wings
  }));

  const tail = c.parts.tail === 'none' ? null : {
    id: 'tail', x: a.tail.x, y: a.tail.y, angle: a.tail.angle || 0,
    length: tailDef.length || 0, style: c.parts.tail
  };

  return { legs, arms, wings, tail, head: Object.assign({}, a.head), eyes: eyeRig(c, body), base: { y: BASELINE } };
}

function eyeRig(c, body) {
  const def = EYES[c.parts.eyes];
  const an = body.anchors.eyes;
  const spread = an.spread * c.tune.eyeSpread;
  const scale = an.scale * c.tune.eyeScale;
  if (def.mirror) {
    return [
      { id: 'eye-0', x: round2(an.x - spread), y: an.y, r: round2(6 * scale) },
      { id: 'eye-1', x: round2(an.x + spread), y: an.y, r: round2(6 * scale) }
    ];
  }
  const s = (spread / SPAN) * scale;
  return (def.groups || []).map((g, i) => ({
    id: `eye-${i}`, x: round2(an.x + (g.shapes[0].cx || 0) * s), y: round2(an.y + (g.shapes[0].cy || 0) * s),
    r: round2((g.shapes[0].rx || g.shapes[0].r || 5) * s)
  }));
}

/** One-line, human-readable summary — handy for tooltips and debugging. */
export function describeCreature(creature) {
  const c = normalizeCreature(creature);
  const an = c.anatomy;
  const rng = makeRng('desc:' + c.seed + c.body + c.parts.legs + c.parts.wings);
  const options = an.hasWings ? ['Has wings. Is still expecting to be carried.', 'Has wings. Has never once been asked to use them.', 'Can fly. Prefers to be lifted, so you know it was your idea.']
    : an.hasTentacles ? ['More of it moves than seems necessary.', 'Pours rather than walks. Leaves a line.', 'Has never been the same shape twice.']
    : an.legCount > 2 ? ['Plenty of legs. Nowhere urgent to be.', 'Enough legs to leave. Uses them to get closer.', 'All those legs, and it still wants carrying.']
    : an.hasLegs ? ['Can walk away. Has chosen to stand here and judge.', 'Two legs. Both of them for standing in doorways.', 'Walks. Not far, and never towards anything good.']
    : ['No legs. Will make that your problem.', 'No legs. Still ends up where you least want it.', 'Legless, and somehow always on the good side of the shelf.'];
  const detail = options[Math.floor(rng() * options.length)];
  return `${PALETTES[c.palette].name} ${BODIES[c.body].name.toLowerCase()}. ${detail}`;
}

/* =============================================================================
   7. RENDERING
   -----------------------------------------------------------------------------
   renderCreatureSVG(creature) returns an SVG **string**.

   Markup contract for the animation system — every moving feature is its own
   addressable element, in a two-level structure:

       <g class="cr-mount" transform="translate(x,y) rotate(a) scale(s)">
         <g class="cr-part cr-leg" data-part="leg" data-index="0"
            data-side="left" data-variant="bird" data-pivot-x="-9" data-pivot-y="32">
            ...shapes...
         </g>
       </g>

   The OUTER mount carries the placement and is never animated. The INNER part
   group carries NO transform of its own, so:
     - its local origin (0,0) IS the joint/pivot,
     - an animator can set `transform` (attribute or CSS) on it freely without
       fighting a baked-in transform,
     - `data-pivot-x/y` repeat that joint in absolute art-space coordinates.

   data-part values: body, detail, eye, mouth, horn, crest, ear, arm, leg, tail,
   wing. Repeated features carry data-index (0-based) and data-side.

   Draw order (back to front): legs, wings, tail, arms, horns, ears, body,
   markings, eyes, mouth. Limbs sit behind the body so their joins are hidden.
   ============================================================================= */

const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const esc = s => String(s).replace(/[&<>"']/g, ch => XML_ESC[ch]);
const num = n => (Math.round(n * 1000) / 1000);

/* The ink line. Every shape filled with the body colour and carrying no stroke
   of its own gets a thin outline in the body's shadow colour, which is what
   turns a flat cut-out into something drawn. Parts that are strokes already
   (spindly legs, whips, antlers) are left alone. */
const OUTLINE_SW = 1.2;

/* Shading. Every shape filled with the body colour is painted with a radial
   gradient instead of a flat fill: lit toward the key light at the top left,
   the plain body colour through the middle, and the shadow colour at the far
   rim. The gradient is declared once per creature in <defs>; its id is derived
   from the two colours, so two creatures that share a palette share an id and
   the definitions are interchangeable wherever the browser resolves them. */
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + [16, 8, 0].map(sh => ch(sh).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function shadingId(colors) {
  return 'crg' + colors.body.slice(1) + colors.bodyDark.slice(1);
}
function shadingDefs(colors) {
  const id = shadingId(colors);
  return `<defs><radialGradient id="${id}" cx="0.38" cy="0.3" r="0.82" fx="0.34" fy="0.26">`
    + `<stop offset="0" stop-color="${mixHex(colors.body, colors.bodyLight, 0.5)}"/>`
    + `<stop offset="0.42" stop-color="${colors.body}"/>`
    + `<stop offset="1" stop-color="${mixHex(colors.body, colors.bodyDark, 0.62)}"/>`
    + `</radialGradient></defs>`;
}
// Set for the duration of one renderCreatureSVG call; paint() reads it.
let SHADE_ID = null;

function paint(shape, colors) {
  let out = '';
  if (shape.fill !== undefined) {
    const shaded = shape.fill === 'body' && SHADE_ID && shape.k !== 'line';
    out += ` fill="${shape.fill === 'none' ? 'none' : shaded ? `url(#${SHADE_ID})` : colors[shape.fill] || shape.fill}"`;
  }
  if (shape.stroke !== undefined) out += ` stroke="${shape.stroke === 'none' ? 'none' : colors[shape.stroke] || shape.stroke}"`;
  else if (shape.fill === 'body' && shape.k === 'path') out += ` stroke="${colors.bodyDark}" stroke-width="${OUTLINE_SW}" stroke-linejoin="round"`;
  if (shape.sw !== undefined) out += ` stroke-width="${num(shape.sw)}"`;
  if (shape.cap) out += ` stroke-linecap="${shape.cap}"`;
  if (shape.join) out += ` stroke-linejoin="${shape.join}"`;
  if (shape.op !== undefined) out += ` opacity="${num(shape.op)}"`;
  if (shape.cls) out += ` class="cr-${esc(shape.cls)}"`;
  return out;
}

function shapeMarkup(shape, colors) {
  const p = paint(shape, colors);
  switch (shape.k) {
    case 'path': return `<path d="${shape.d}"${p}/>`;
    case 'circle': return `<circle cx="${num(shape.cx)}" cy="${num(shape.cy)}" r="${num(shape.r)}"${p}/>`;
    case 'ellipse': return `<ellipse cx="${num(shape.cx)}" cy="${num(shape.cy)}" rx="${num(shape.rx)}" ry="${num(shape.ry)}"${p}/>`;
    case 'line': return `<line x1="${num(shape.x1)}" y1="${num(shape.y1)}" x2="${num(shape.x2)}" y2="${num(shape.y2)}"${p}/>`;
    default: return '';
  }
}

function shapesMarkup(shapes, colors) {
  let out = '';
  for (const s of shapes) out += shapeMarkup(s, colors);
  return out;
}

/** transform="..." for a mount, omitting identity components. */
function mountTransform(x, y, angle, scale, flipX) {
  const bits = [];
  if (x || y) bits.push(`translate(${num(x)} ${num(y)})`);
  if (angle) bits.push(`rotate(${num(angle)})`);
  if (flipX && scale !== 1) bits.push(`scale(${num(-scale)} ${num(scale)})`);
  else if (flipX) bits.push('scale(-1 1)');
  else if (scale !== 1) bits.push(`scale(${num(scale)})`);
  return bits.length ? ` transform="${bits.join(' ')}"` : '';
}

/**
 * @param {object} o  { part, index, side, variant, x, y, angle=0, scale=1, flipX=false }
 */
function mount(o, inner) {
  if (!inner) return '';
  const attrs = [`class="cr-part cr-${o.part}"`, `data-part="${o.part}"`];
  if (o.index !== undefined) attrs.push(`data-index="${o.index}"`);
  if (o.side) attrs.push(`data-side="${o.side}"`);
  if (o.variant) attrs.push(`data-variant="${esc(o.variant)}"`);
  attrs.push(`data-pivot-x="${num(o.x)}"`, `data-pivot-y="${num(o.y)}"`);
  return `<g class="cr-mount"${mountTransform(o.x, o.y, o.angle || 0, o.scale === undefined ? 1 : o.scale, !!o.flipX)}>`
    + `<g ${attrs.join(' ')}>${inner}</g></g>`;
}

/**
 * Render a creature to an SVG string.
 *
 * @param {object} creature  from generateCreature()
 * @param {object} [opts]
 * @param {number} [opts.size]        px width+height attribute (omit for fluid)
 * @param {string} [opts.className]   root class, default 'creature'
 * @param {string} [opts.title]       <title> for accessibility
 * @param {boolean}[opts.inner]       true -> return only the inner groups (no <svg>)
 * @returns {string}
 */
export function renderCreatureSVG(creature, opts = {}) {
  const c = normalizeCreature(creature);
  const colors = resolveColors(c);
  SHADE_ID = shadingId(colors);
  const body = BODIES[c.body];
  const a = body.anchors;
  const P = c.parts;

  /* --- legs (behind everything; NOT leaned, so feet stay planted) --------- */
  let legMarkup = '';
  const legDef = LEGS[P.legs];
  if (P.legs !== 'none') {
    const anchors = legAnchorsFor(body, P.legs);
    const inner = shapesMarkup(legDef.shapes, colors);
    anchors.forEach((an, i) => {
      legMarkup += mount({ part:'leg', index:i, side: an.x < 0 ? 'left' : 'right', variant:P.legs,
        x:an.x, y:an.y, angle:an.angle || 0, flipX: an.x > 0 && legDef.mirror }, inner);
    });
  }

  /* --- wings --------------------------------------------------------------- */
  let wingMarkup = '';
  if (P.wings !== 'none') {
    const def = WINGS[P.wings];
    const inner = shapesMarkup(def.shapes, colors);
    [-1, 1].forEach((side, i) => {
      wingMarkup += mount({ part:'wing', index:i, side: side < 0 ? 'left' : 'right', variant:P.wings,
        x: a.wings.x + side * a.wings.spread, y: a.wings.y, angle: a.wings.angle || 0,
        scale: a.wings.scale, flipX: side > 0 }, inner);
    });
  }

  /* --- tail ---------------------------------------------------------------- */
  let tailMarkup = '';
  if (P.tail !== 'none') {
    tailMarkup = mount({ part:'tail', variant:P.tail, x:a.tail.x, y:a.tail.y,
      angle:a.tail.angle || 0, scale:a.tail.scale }, shapesMarkup(TAILS[P.tail].shapes, colors));
  }

  /* --- arms ---------------------------------------------------------------- */
  let armMarkup = '';
  if (P.arms !== 'none') {
    const def = ARMS[P.arms];
    const inner = shapesMarkup(def.shapes, colors);
    (a.arms || []).forEach((an, i) => {
      armMarkup += mount({ part:'arm', index:i, side: an.x < 0 ? 'left' : 'right', variant:P.arms,
        x:an.x, y:an.y, angle:an.angle || 0, flipX: an.x > 0 }, inner);
    });
  }

  /* --- horns / crown / crest ---------------------------------------------- */
  let topMarkup = '';
  if (P.top !== 'none') {
    const def = TOPS[P.top];
    const inner = shapesMarkup(def.shapes, colors);
    if (def.mirror) {
      const hs = a.top.scale * Math.max(0.55, Math.min(1.15, a.top.spread / SPAN));
      [-1, 1].forEach((side, i) => {
        topMarkup += mount({ part:'horn', index:i, side: side < 0 ? 'left' : 'right', variant:P.top,
          x: a.top.x + side * a.top.spread, y: a.top.y, scale: hs, flipX: side > 0 }, inner);
      });
    } else {
      topMarkup = mount({ part:'crest', variant:P.top, x:a.top.x, y:a.top.y,
        scale: (a.top.spread / SPAN) * a.top.scale }, inner);
    }
  }

  /* --- ears ---------------------------------------------------------------- */
  let earMarkup = '';
  if (P.ears !== 'none') {
    const def = EARS[P.ears];
    const inner = shapesMarkup(def.shapes, colors);
    [-1, 1].forEach((side, i) => {
      earMarkup += mount({ part:'ear', index:i, side: side < 0 ? 'left' : 'right', variant:P.ears,
        x: a.ears.x + side * a.ears.spread, y: a.ears.y, scale: a.ears.scale, flipX: side > 0 }, inner);
    });
  }

  /* --- body ---------------------------------------------------------------- */
  /* Fill, shade, then a soft highlight where the key light lands (above and to
     the left of the face), a blush under the eyes, and the ink line last so it
     sits over everything. */
  const head = a.head;
  let bodyInner = '';
  if (body.back) bodyInner += `<path d="${body.back}" fill="${colors.bodyDark}"/>`;
  bodyInner += `<path d="${body.path}" fill="${colors.body}"/>`;
  if (body.shade) bodyInner += shapesMarkup(body.shade, colors);
  bodyInner += `<ellipse cx="${num(head.x - head.r * 0.34)}" cy="${num(head.y - head.r * 0.46)}" rx="${num(head.r * 0.4)}" ry="${num(head.r * 0.24)}" fill="${colors.bodyLight}" opacity="0.38"/>`;
  bodyInner += `<path d="${body.path}" fill="none" stroke="${colors.bodyDark}" stroke-width="${num(OUTLINE_SW * 1.25)}" stroke-linejoin="round"/>`;
  const bodyMarkup = mount({ part:'body', x:0, y:0 }, bodyInner);

  /* --- blush (only faces that have the room, and never on a blind stare) ----- */
  let blushMarkup = '';
  if (!has(body, 'smallFace') && EYES[P.eyes].tags.indexOf('blind') === -1) {
    const bx = a.eyes.spread * c.tune.eyeSpread * 1.28, by = a.eyes.y + 7.4 * a.eyes.scale, br = 2.4 * a.eyes.scale;
    blushMarkup = mount({ part:'blush', x:a.eyes.x, y:by },
      `<ellipse cx="${num(-bx)}" cy="0" rx="${num(br * 1.3)}" ry="${num(br * .8)}" fill="${colors.accent}" opacity="0.26"/>` +
      `<ellipse cx="${num(bx)}" cy="0" rx="${num(br * 1.3)}" ry="${num(br * .8)}" fill="${colors.accent}" opacity="0.26"/>`);
  }

  /* --- markings ------------------------------------------------------------ */
  let detailMarkup = '';
  if (P.detail !== 'none') {
    const d = a.detail;
    detailMarkup = mount({ part:'detail', variant:P.detail, x:d.x, y:d.y,
      scale: Math.min(d.w, d.h) / 30 }, shapesMarkup(DETAILS[P.detail].shapes, colors));
  }

  /* --- eyes ---------------------------------------------------------------- */
  const eyeDef = EYES[P.eyes];
  const eSpread = a.eyes.spread * c.tune.eyeSpread;
  const eScale = a.eyes.scale * c.tune.eyeScale;
  let eyeMarkup = '';
  if (eyeDef.mirror) {
    const inner = shapesMarkup(eyeDef.shapes, colors);
    [-1, 1].forEach((side, i) => {
      eyeMarkup += mount({ part:'eye', index:i, side: side < 0 ? 'left' : 'right', variant:P.eyes,
        x: a.eyes.x + side * eSpread, y: a.eyes.y, scale: eScale,
        flipX: side > 0 && eyeDef.flip !== false }, inner);
    });
  } else {
    const s = (eSpread / SPAN) * eScale;
    (eyeDef.groups || []).forEach((g, i) => {
      eyeMarkup += mount({ part:'eye', index:i, side: g.id.indexOf('right') !== -1 ? 'right' : (g.id.indexOf('left') !== -1 ? 'left' : ''),
        variant:P.eyes, x:a.eyes.x, y:a.eyes.y, scale:s }, shapesMarkup(g.shapes, colors));
    });
  }

  /* --- mouth --------------------------------------------------------------- */
  const mouthMarkup = mount({ part:'mouth', variant:P.mouth, x:a.mouth.x, y:a.mouth.y,
    scale: a.mouth.scale * c.tune.mouthScale }, shapesMarkup(MOUTHS[P.mouth].shapes, colors));

  const torso = `<g class="cr-torso" transform="rotate(${num(c.tune.lean)} 0 ${BASELINE})">`
    + wingMarkup + tailMarkup + armMarkup + topMarkup + earMarkup
    + bodyMarkup + detailMarkup + blushMarkup + eyeMarkup + mouthMarkup
    + `</g>`;
  const figure = `<g class="cr-figure">${shadingDefs(colors)}${legMarkup}${torso}</g>`;
  SHADE_ID = null;

  if (opts.inner) return figure;

  const attrs = [`viewBox="${VIEWBOX}"`, 'xmlns="http://www.w3.org/2000/svg"',
    `class="${esc(opts.className || 'creature')}"`, 'overflow="visible"'];
  if (opts.size) attrs.push(`width="${num(opts.size)}"`, `height="${num(opts.size)}"`);
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
  return `<svg ${attrs.join(' ')}>${title}${figure}</svg>`;
}

/**
 * Render ONE part variant in isolation, centred in the standard viewBox.
 * For variant pickers and previews. Colors default to the given palette.
 */
export function renderPartSVG(slot, variantId, opts = {}) {
  const s = SLOTS[slot];
  if (!s || !s.lib[variantId]) return '';
  const pal = PALETTES[opts.palette] || PALETTES.bubblegum;
  const colors = { body: pal.body, bodyDark: pal.bodyDark, bodyLight: pal.bodyLight,
    accent: pal.accent, detail: pal.detail, ink: pal.ink,
    line: pal.line || pal.ink, bone: pal.bone || BONE };
  const def = s.lib[variantId];
  const scale = opts.scale === undefined ? 2 : opts.scale;
  let inner = '';
  if (def.groups) {
    inner = def.groups.map(g => `<g data-part="${esc(slot)}" data-variant="${esc(variantId)}">${shapesMarkup(g.shapes, colors)}</g>`).join('');
  } else if (def.mirror) {
    const one = shapesMarkup(def.shapes, colors);
    inner = `<g transform="translate(-10 0)">${one}</g><g transform="translate(10 0) scale(-1 1)">${one}</g>`;
  } else {
    inner = `<g data-part="${esc(slot)}" data-variant="${esc(variantId)}">${shapesMarkup(def.shapes, colors)}</g>`;
  }
  const attrs = [`viewBox="${VIEWBOX}"`, 'xmlns="http://www.w3.org/2000/svg"', `class="${esc(opts.className || 'creature-part')}"`, 'overflow="visible"'];
  if (opts.size) attrs.push(`width="${num(opts.size)}"`, `height="${num(opts.size)}"`);
  return `<svg ${attrs.join(' ')}><g transform="scale(${num(scale)})">${inner}</g></svg>`;
}

/** Render just a body silhouette — for a body picker. */
export function renderBodySVG(bodyId, opts = {}) {
  const body = BODIES[bodyId];
  if (!body) return '';
  const pal = PALETTES[opts.palette] || PALETTES.bubblegum;
  const colors = { body: pal.body, bodyDark: pal.bodyDark, bodyLight: pal.bodyLight,
    accent: pal.accent, detail: pal.detail, ink: pal.ink,
    line: pal.line || pal.ink, bone: pal.bone || BONE };
  let inner = '';
  if (body.back) inner += `<path d="${body.back}" fill="${colors.bodyDark}"/>`;
  inner += `<path d="${body.path}" fill="${colors.body}"/>`;
  if (body.shade) inner += shapesMarkup(body.shade, colors);
  const attrs = [`viewBox="${VIEWBOX}"`, 'xmlns="http://www.w3.org/2000/svg"', `class="${esc(opts.className || 'creature-body')}"`, 'overflow="visible"'];
  if (opts.size) attrs.push(`width="${num(opts.size)}"`, `height="${num(opts.size)}"`);
  return `<svg ${attrs.join(' ')}><g data-part="body">${inner}</g></svg>`;
}
