import { STAMP_SVG, STAMP_ANIM_CLASS, CANVAS_SIZE, STAMP_SCALE } from './stamps.js';

// ---------------------------------------------------------------------------
// Layered sprite DOM
// ---------------------------------------------------------------------------
// A pet is built as four nested boxes rather than one flat element, because CSS
// `animation` is a NON-ADDITIVE shorthand: two classes on the same element that
// both declare `animation:` do not compose, the later rule simply wins. Giving
// each simultaneous motion its own box is what lets a pet breathe, hop and lean
// at the same time:
//
//   div.sprite.sl2      posture  – static transform from mood/feud/trait classes
//     div.sprite-act    behaviour – one-shot animations the director assigns
//       div.sprite-figure idle    – continuous breathing loop (+ tremor)
//         img.sprite-body
//         div.sprite-stamp        – placement box (never animated)
//           div.stamp-art         – secondary motion (flap / wag / undulate…)
//             svg
//
// `.sprite-figure` is also the positioning context for stamps and is forced
// square (aspect-ratio:1). That matters: stamp x/y/size are stored in the
// studio's 640x640 pixel space, so the box they are measured against has to be
// square too. Before this, stamps were measured against the non-square sprite
// box, which stretched them horizontally and pushed off-centre features away
// from where they were drawn.
//
// Handles migrated pre-v4 pets (art.stamps empty/undefined) gracefully — they
// just render as a body with no stamp layers, and still breathe and behave.

// Trait flags (see engine/tick.js `hasTrait`) that bias which idle behaviours
// the animation director picks. Exported so ui/render.js knows what to compute
// and pass in, keeping art/ free of any engine/content imports.
export const MOTION_TRAIT_FLAGS = ['nocturnal', 'thief', 'wanderer'];

// Deterministic 0..1 from a string. Pets keep the same "personality constants"
// (breathing speed, phase, resting tilt) across re-renders and page loads,
// instead of being reshuffled every time renderShelf rebuilds the cabinet.
function hash01(str, salt) {
  let h = 2166136261 ^ salt;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function box(cls) {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

export function renderPetSprite(pet) {
  const id = (pet && pet.id) || 'anon';

  const wrap = box('sprite sl2');
  wrap.dataset.pet = id;

  // Per-pet personality constants. Stable for a given pet, different between
  // pets, so a shelf of six never breathes in lockstep.
  const breath = lerp(3.1, 4.9, hash01(id, 11));      // breathing cycle length
  const phase = lerp(0, 6, hash01(id, 23));           // negative delay = mid-cycle start
  const tilt = lerp(-2.4, 2.4, hash01(id, 37));       // resting lean, "not quite straight"
  wrap.style.setProperty('--sl-breath', breath.toFixed(2) + 's');
  wrap.style.setProperty('--sl-phase', '-' + phase.toFixed(2) + 's');
  wrap.style.setProperty('--sl-tilt0', tilt.toFixed(2) + 'deg');

  const act = box('sprite-act');
  const figure = box('sprite-figure');

  const img = document.createElement('img');
  img.className = 'sprite-body';
  img.src = pet.art.body;
  img.alt = '';
  img.draggable = false;
  figure.appendChild(img);

  (pet.art.stamps || []).forEach((stamp, i) => {
    const layer = box('sprite-stamp');
    layer.dataset.kind = stamp.kind;
    // STAMP_SCALE is 5, not 2: every stamp SVG is drawn at 12 units per canvas
    // unit of `size` on a `-30 -30 60 60` viewBox, so the box spans 60/12 = 5x
    // size. With 2 here, stamps rendered at 40% of their intended size and read
    // as specks on the shelf. studio.js uses the same constant so the studio
    // preview stays WYSIWYG with the shelf — change them together or not at all.
    const wPct = (stamp.size * STAMP_SCALE / CANVAS_SIZE) * 100;
    layer.style.left = (stamp.x / CANVAS_SIZE * 100) + '%';
    layer.style.top = (stamp.y / CANVAS_SIZE * 100) + '%';
    layer.style.width = wPct + '%';
    layer.style.height = wPct + '%';
    layer.style.color = stamp.color;
    // Placement only. This element is never animated, so the centring
    // translate can never be clobbered by a keyframe's own `transform`.
    layer.style.transform = `translate(-50%,-50%) rotate(${stamp.rotation || 0}deg)`;

    const art = box('stamp-art' + (STAMP_ANIM_CLASS[stamp.kind] ? ' ' + STAMP_ANIM_CLASS[stamp.kind] : ''));
    // Per-instance phase + speed jitter: two wings on two pets (or the same
    // pet) never beat together, and re-renders don't resync them.
    art.style.setProperty('--sl-sd', '-' + lerp(0, 5, hash01(id + ':' + i, 53)).toFixed(2) + 's');
    art.style.setProperty('--sl-sj', lerp(0.82, 1.28, hash01(id + ':' + i, 71)).toFixed(3));
    art.innerHTML = STAMP_SVG[stamp.kind] || '';
    layer.appendChild(art);
    figure.appendChild(layer);
  });

  act.appendChild(figure);
  wrap.appendChild(act);
  return wrap;
}

// Classes for renderPetSprite's wrapper element. Unlike the previous
// one-class-at-a-time version (a workaround for the non-additive `animation`
// shorthand), this returns several: the nested boxes above mean mood, sleep,
// feud and trait classes each drive a different layer and no longer collide.
//
// The legacy `motion-*` class is still returned first so any older caller keeps
// getting the shape it expects; under `.sprite.sl2` those legacy keyframes are
// switched off in CSS and the posture/idle rules take over.
//
// sprite.js has no knowledge of mood/sleep/feud/trait state itself — the caller
// (ui/render.js) computes those and passes them in, including which side
// (`'left'` | `'right'` | null) the pet should lean and which MOTION_TRAIT_FLAGS
// it carries.
export function moodMotionClasses(pet, { mood, asleep, feudDirection, traits } = {}) {
  const out = [];
  if (asleep) out.push('motion-asleep');
  else if (mood === 'furious') out.push('motion-furious');
  else if (feudDirection === 'left') out.push('motion-lean-left');
  else if (feudDirection === 'right') out.push('motion-lean-right');
  else if (mood === 'annoyed') out.push('motion-jitter');
  else out.push('motion-bob');

  out.push('sl-mood-' + (mood || 'fine'));
  if (asleep) out.push('sl-asleep');
  if (feudDirection === 'left') out.push('sl-feud-left');
  else if (feudDirection === 'right') out.push('sl-feud-right');
  (traits || []).forEach(t => { if (MOTION_TRAIT_FLAGS.includes(t)) out.push('sl-t-' + t); });
  return out;
}
