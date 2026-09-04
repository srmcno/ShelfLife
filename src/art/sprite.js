import { STAMP_SVG, STAMP_ANIM_CLASS, CANVAS_SIZE } from './stamps.js';

// Renders a Pet's layered sprite: the freehand-painted body image as the base
// layer, plus one absolutely-positioned inline-SVG layer per placed stamp.
// Stamp x/y/size are stored in the studio's 640x640 canvas pixel space (see
// stamps.js's CANVAS_SIZE); converting to percentages here means the sprite
// scales correctly no matter how small/large it's finally rendered on the shelf.
// Handles migrated pre-v4 pets (art.stamps empty/undefined) gracefully — they
// just render as a body with no stamp layers.
export function renderPetSprite(pet) {
  const wrap = document.createElement('div');
  wrap.className = 'sprite';

  const img = document.createElement('img');
  img.className = 'sprite-body';
  img.src = pet.art.body;
  img.alt = '';
  wrap.appendChild(img);

  (pet.art.stamps || []).forEach(stamp => {
    const layer = document.createElement('div');
    const animClass = STAMP_ANIM_CLASS[stamp.kind] || '';
    layer.className = 'sprite-stamp' + (animClass ? ' ' + animClass : '');
    const wPct = (stamp.size * 2 / CANVAS_SIZE) * 100;
    layer.style.left = (stamp.x / CANVAS_SIZE * 100) + '%';
    layer.style.top = (stamp.y / CANVAS_SIZE * 100) + '%';
    layer.style.width = wPct + '%';
    layer.style.height = wPct + '%';
    layer.style.color = stamp.color;
    layer.style.transform = `translate(-50%,-50%) rotate(${stamp.rotation || 0}deg)`;
    // Negative random delay so stamps animating the same keyframes (e.g. every
    // pet's blinking eyes) don't all move in visual lockstep across the shelf.
    layer.style.animationDelay = '-' + (Math.random() * 6).toFixed(2) + 's';
    layer.innerHTML = STAMP_SVG[stamp.kind] || '';
    wrap.appendChild(layer);
  });

  // Same lockstep-avoidance trick applied to the whole-sprite motion class the
  // caller adds later (moodMotionClasses) — the wrapper animation is present
  // from creation even though the class enabling it may be added afterward.
  wrap.style.animationDelay = '-' + (Math.random() * 6).toFixed(2) + 's';
  return wrap;
}

// Picks exactly one whole-sprite motion class for renderPetSprite's wrapper
// element, by priority. CSS `animation` is a non-additive shorthand — stacking
// two animation-setting classes on one element means only one wins (whichever
// rule is later in the stylesheet), they don't combine — so this deliberately
// returns a single-element array rather than accumulating multiple matches.
// Still returns an array (not a bare string) so every call site can use the
// same `classList.add(...moodMotionClasses(...))` spread shape.
//
// sprite.js has no knowledge of mood/sleep/feud state itself — the caller
// (ui/render.js) computes those and passes them in, including which side
// (`'left'` | `'right'` | null) a feuding neighbor sits on.
export function moodMotionClasses(pet, { mood, asleep, feudDirection } = {}) {
  if (asleep) return ['motion-asleep'];
  if (mood === 'furious') return ['motion-furious'];
  if (feudDirection === 'left') return ['motion-lean-left'];
  if (feudDirection === 'right') return ['motion-lean-right'];
  if (mood === 'annoyed') return ['motion-jitter'];
  return ['motion-bob'];
}
