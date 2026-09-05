// The studio: two equal ways to make a pet, sharing one name field and one
// "Move it in" button.
//
//   GROW ONE  — art/creatures.js rolls a designed vector creature; the player
//               re-rolls the whole thing, or nudges one feature at a time, and
//               watches a live animated preview of exactly what will stand on
//               the shelf. Saves `{ creature }`.
//   DRAW ONE  — the original freehand pad: a raster body canvas plus stamps
//               recorded as positional data rather than baked into pixels.
//               Saves `{ body, stamps }`. Mechanics unchanged.
//
// Neither is the "real" one. They are two tabs of the same size in the same
// place, and the only asymmetry is which opens first — Grow, because a brand
// new player should meet a creature that already looks like something.
//
// Everything here takes `state` as an explicit argument or reads the live `state`
// import — never a hidden closure over a duplicated copy of the save data.
import { CANVAS_SIZE, STAMP_SCALE, BASE_STAMPS, UNLOCK_STAMPS, STAMP_SVG, STAMP_LABELS } from './stamps.js';
import {
  generateCreature, rerollPart, normalizeCreature, describeCreature,
  SLOTS, SLOT_KEYS, PALETTES, PALETTE_IDS, BODY_IDS
} from './creatures.js';
import { renderPetSprite } from './sprite.js';
import { state } from '../state.js';
import { drawingBounds, measureStampInk } from './drawing.js';
import { reactTo } from './animator.js';
import { toast } from '../ui/toast.js';

// Ported verbatim from ~/Documents/shelf-life.html (lines ~475-480). Studio-only concern:
// which brush colors are available at the shelf's current total bond.
export const BASE_COLORS = ['#1A1220', '#F2E9DC', '#FF8FB8', '#C94F7C', '#7FD8C0', '#3E9E86', '#F2B441', '#E0672F', '#A32C3C', '#8E6BD1', '#4A7FD1', '#6FBF4A', '#8A5A3B', '#9AA5AD'];
export const UNLOCK_COLORS = [
  { at: 10, colors: ['#39D6C0', '#FF5FA2', '#FFE066'], label: 'three loud colors' },
  { at: 30, colors: ['#B8FF5A', '#8C1BE0', '#00E5FF'], label: 'three colors that should not exist' },
  { at: 60, colors: ['#FF3B1F', '#0B0F45', '#E8D7FF'], label: 'the last three colors' }
];

// Pure function per the project's "state is an explicit first argument" rule. Computes
// total bond inline rather than importing engine/unlocks.js's totalBond(state) — that
// module is a parallel, not-yet-built task, and this is one line of harmless duplicated
// arithmetic rather than a backwards/circular dependency.
export function unlockedColors(state) {
  const bond = state.pets.reduce((n, p) => n + p.bond, 0);
  let out = BASE_COLORS.slice();
  UNLOCK_COLORS.forEach(u => { if (bond >= u.at) out = out.concat(u.colors); });
  return out;
}

// Mirrors unlockedColors' shape for stamp kinds. Not part of the module's export
// contract (only art/studio.js itself needs it to build the stamp picker), so it stays
// local rather than exported.
function unlockedStampKinds() {
  const bond = state.pets.reduce((n, p) => n + p.bond, 0);
  let out = BASE_STAMPS.slice();
  UNLOCK_STAMPS.forEach(u => { if (bond >= u.at) out = out.concat(u.stamps); });
  return out;
}

// The preview sprite is a real sprite, with a real `data-pet`, so art/animator.js
// picks it up on its next pass and breathes/blinks/steps it exactly as it will on
// the shelf. The id is not a valid pet id (those are `p<seq>_<base36>`), so it can
// never collide with a resident.
const PREVIEW_ID = 'studio-preview';

const BLURB = {
  generate: 'Roll one until it looks like trouble, then change whatever bothers you.',
  draw: 'Draw it, stamp it, name it. It takes over from there.'
};

export function initStudio({ onSave }) {
  const studioVeil = document.getElementById('studioVeil');
  const pad = document.getElementById('pad');
  const stampLayer = document.getElementById('stampLayer');
  const swatchesWrap = document.getElementById('swatches');
  const sizeWrap = document.getElementById('sizes');
  const eraserChip = document.getElementById('eraserChip');
  const stampPickerWrap = document.getElementById('stamps');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const petName = document.getElementById('petName');
  const studioClose = document.getElementById('studioClose');
  const cancelPet = document.getElementById('cancelPet');
  const savePet = document.getElementById('savePet');

  const studioBlurb = document.getElementById('studioBlurb');
  const tabGenerate = document.getElementById('tabGenerate');
  const tabDraw = document.getElementById('tabDraw');
  const genPanel = document.getElementById('genPanel');
  const drawPanel = document.getElementById('drawPanel');
  const genMount = document.getElementById('genMount');
  const genDesc = document.getElementById('genDesc');
  const genSurprise = document.getElementById('genSurprise');
  const genParts = document.getElementById('genParts');
  const genPalette = document.getElementById('genPalette');

  const ctx = pad.getContext('2d');
  pad.width = CANVAS_SIZE;
  pad.height = CANVAS_SIZE;

  const brush = { color: BASE_COLORS[0], size: 16, erase: false, stamp: null };

  // Single linear undo history covering both freehand strokes and stamp placements,
  // oldest-to-newest, matching the original's single-stack single-button UX.
  //   { type: 'stroke', pixels }   – canvas snapshot taken before a stroke
  //   { type: 'stamp' }            – undoing just pops the last placed stamp
  let undoStack = [];

  // Placed stamps: plain data objects, never drawn onto the canvas. `stamps` is the
  // data (this is what becomes art.stamps on save); `stampEls` is the parallel array of
  // live preview DOM nodes in #stampLayer, kept in lockstep so undo can remove the right one.
  let stamps = [];
  let stampEls = [];
  const drawPreview = document.getElementById('drawPreview');
  function drawingArt() {
    return { body: padThumb(), stamps: stamps.map(s => ({ ...s })),
      bounds: drawingBounds(ctx.getImageData(0, 0, pad.width, pad.height).data, pad.width, pad.height, stamps, measureStampInk(stamps)) };
  }
  function previewDrawing() {
    if (isEmpty() && !stamps.length) {
      drawPreview.innerHTML = '<span>Your drawing comes to life here.</span>';
      return;
    }
    const sprite = renderPetSprite({ id: 'drawing-preview', art: drawingArt() });
    sprite.classList.add('sl-mood-content');
    drawPreview.replaceChildren(sprite);
  }
  document.getElementById('drawWiggle').addEventListener('click', () => reactTo('drawing-preview', 'fuss'));


  let drawing = false;
  let lastPt = null;

  // ---- generate mode ------------------------------------------------------
  // `mode` is the single source of truth for which tab is live; it decides only
  // two things — which panel is visible, and which art shape Save hands back.

  let mode = 'generate';
  let creature = null;

  // Slot chips, in the order the SLOTS registry declares them, plus body. Body is
  // deliberately first: it is the one change that alters the silhouette, and the
  // labels come from the library so a new part slot appears here for free.
  const PART_CHIPS = [{ key: 'body', label: 'Body' }]
    .concat(SLOT_KEYS.map(k => ({ key: k, label: SLOTS[k].label })));

  function renderPreview() {
    genMount.innerHTML = '';
    // A real sprite element, not a bare <svg>: the preview then inherits every
    // shelf behaviour (breathing, blinking, limb idles, gait) from the same
    // director, so what you approve here is what moves in.
    const sprite = renderPetSprite({ id: PREVIEW_ID, art: { body: '', stamps: [], creature } });
    sprite.classList.add('sl-mood-content');
    genMount.appendChild(sprite);
    genDesc.textContent = describeCreature(creature);
  }

  function setCreature(next) {
    creature = normalizeCreature(next);
    renderPreview();
    syncPalette();
  }

  function syncPalette() {
    genPalette.querySelectorAll('.sw').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.palette === creature.palette));
    });
  }

  function buildPartChips() {
    genParts.innerHTML = '';
    PART_CHIPS.forEach(({ key, label }) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => {
        if (key === 'body') {
          // A new body moves every anchor, so anatomy and rig have to be rebuilt
          // from scratch — generateCreature does that; a shallow field swap would
          // leave a rig pointing at the old skeleton.
          const others = BODY_IDS.filter(id => id !== creature.body);
          const nextBody = others[Math.floor(Math.random() * others.length)];
          setCreature(generateCreature({
            seed: creature.seed, body: nextBody, palette: creature.palette, parts: creature.parts
          }));
        } else {
          setCreature(rerollPart(creature, key));
        }
      });
      genParts.appendChild(b);
    });
  }

  function buildPalette() {
    genPalette.innerHTML = '';
    PALETTE_IDS.forEach(id => {
      const p = PALETTES[id];
      const b = document.createElement('button');
      b.className = 'sw';
      b.type = 'button';
      b.dataset.palette = id;
      // Body over accent: the two colours that actually change the read of a
      // creature, so the swatch is a preview rather than a label.
      b.style.background = `linear-gradient(135deg, ${p.body} 0 58%, ${p.accent} 58% 100%)`;
      b.setAttribute('aria-label', p.name);
      b.title = p.name;
      b.addEventListener('click', () => {
        // Palette is pure colour: keep every rolled part, seed and tune exactly
        // as they are rather than regenerating and drifting the creature.
        setCreature(Object.assign({}, creature, { palette: id }));
      });
      genPalette.appendChild(b);
    });
  }

  genSurprise.addEventListener('click', () => setCreature(generateCreature()));

  // ---- tabs ---------------------------------------------------------------

  function setMode(next) {
    mode = next === 'draw' ? 'draw' : 'generate';
    const gen = mode === 'generate';
    tabGenerate.setAttribute('aria-selected', String(gen));
    tabDraw.setAttribute('aria-selected', String(!gen));
    tabGenerate.tabIndex = gen ? 0 : -1;
    tabDraw.tabIndex = gen ? -1 : 0;
    genPanel.hidden = !gen;
    drawPanel.hidden = gen;
    studioBlurb.textContent = BLURB[mode];
    if (!gen) previewDrawing();
  }

  tabGenerate.addEventListener('click', () => setMode('generate'));
  tabDraw.addEventListener('click', () => setMode('draw'));
  [tabGenerate, tabDraw].forEach(tab => {
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = mode === 'generate' ? 'draw' : 'generate';
      setMode(next);
      (next === 'generate' ? tabGenerate : tabDraw).focus();
    });
  });

  function padPos(e) {
    const r = pad.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (pad.width / r.width), y: (e.clientY - r.top) * (pad.height / r.height) };
  }

  function strokeTo(a, b) {
    ctx.globalCompositeOperation = brush.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brush.color;
    ctx.lineWidth = brush.size * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function pushStrokeUndo() {
    undoStack.push({ type: 'stroke', pixels: ctx.getImageData(0, 0, pad.width, pad.height) });
    if (undoStack.length > 12) undoStack.shift();
  }

  // Same left/top/width/height/transform math art/sprite.js uses to place a stamp on the
  // shelf, so a stamp previewed here lands in the same relative spot once rendered small.
  function renderStampEl(s) {
    const el = document.createElement('div');
    el.className = 'sprite-stamp';
    el.style.left = (s.x / CANVAS_SIZE * 100) + '%';
    el.style.top = (s.y / CANVAS_SIZE * 100) + '%';
    const wh = (s.size * STAMP_SCALE / CANVAS_SIZE * 100) + '%';
    el.style.width = wh;
    el.style.height = wh;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.color = s.color;
    el.innerHTML = STAMP_SVG[s.kind] || '';
    return el;
  }

  function placeStamp(p) {
    const s = { kind: brush.stamp, x: p.x, y: p.y, size: brush.size * 1.7, rotation: 0, color: brush.color };
    stamps.push(s);
    undoStack.push({ type: 'stamp' });
    if (undoStack.length > 12) undoStack.shift();
    const el = renderStampEl(s);
    stampEls.push(el);
    stampLayer.appendChild(el);
    previewDrawing();
  }

  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const p = padPos(e);
    if (brush.stamp) { placeStamp(p); return; }
    pushStrokeUndo();
    drawing = true;
    lastPt = p;
    strokeTo(p, p);
  });
  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = padPos(e);
    strokeTo(lastPt, p);
    lastPt = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { if (drawing) { drawing = false; lastPt = null; previewDrawing(); } }));

  sizeWrap.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    brush.stamp = null;
    stampPickerWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    sizeWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    if (chip.dataset.erase) brush.erase = true;
    else { brush.erase = false; brush.size = Number(chip.dataset.size); }
  });

  undoBtn.addEventListener('click', () => {
    if (!undoStack.length) return;
    const entry = undoStack.pop();
    if (entry.type === 'stamp') {
      stamps.pop();
      const el = stampEls.pop();
      if (el && el.parentNode) el.parentNode.removeChild(el);
      previewDrawing();
      return;
    }
    if (entry.stamps) {
      stamps = entry.stamps;
      stampEls = stamps.map(renderStampEl);
      stampLayer.replaceChildren(...stampEls);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (entry.pixels) ctx.putImageData(entry.pixels, 0, 0);
    previewDrawing();
  });

  // Clear the entire drawing, with a single undo restoring body and stamps.
  clearBtn.addEventListener('click', () => {
    pushStrokeUndo();
    undoStack[undoStack.length - 1].stamps = stamps.map(s => ({ ...s }));
    stamps = [];
    stampEls = [];
    stampLayer.replaceChildren();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
    previewDrawing();
  });

  function isEmpty() {
    const d = ctx.getImageData(0, 0, pad.width, pad.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  }

  function padThumb() {
    // Keep the original resolution for crisp ink on high-density displays.
    return pad.toDataURL('image/png');
  }

  // `unlockedBond` is accepted for contract-shape parity with the caller (main.js may
  // already have a fresh totalBond(state) on hand), but since `state` is imported live
  // here, rebuilding straight from `state` is always correct and avoids a second,
  // possibly-stale source of truth. See report for this judgment call.
  function rebuildPalette(unlockedBond) {
    swatchesWrap.innerHTML = '';
    unlockedColors(state).forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw';
      b.style.background = c;
      b.setAttribute('aria-pressed', c === brush.color ? 'true' : 'false');
      b.setAttribute('aria-label', 'Color ' + c);
      b.addEventListener('click', () => {
        brush.color = c;
        brush.erase = false;
        swatchesWrap.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        eraserChip.setAttribute('aria-pressed', 'false');
        const m = sizeWrap.querySelector('.chip[data-size="' + brush.size + '"]');
        if (m) m.setAttribute('aria-pressed', 'true');
      });
      swatchesWrap.appendChild(b);
    });
  }

  function rebuildStamps(unlockedBond) {
    stampPickerWrap.innerHTML = '';
    unlockedStampKinds().forEach(key => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = STAMP_LABELS[key];
      b.setAttribute('aria-pressed', brush.stamp === key ? 'true' : 'false');
      b.addEventListener('click', () => {
        const on = brush.stamp === key;
        stampPickerWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        brush.stamp = on ? null : key;
        b.setAttribute('aria-pressed', on ? 'false' : 'true');
      });
      stampPickerWrap.appendChild(b);
    });
  }

  function open(unlockedBond) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
    undoStack = [];
    stamps = [];
    stampEls = [];
    stampLayer.innerHTML = '';
    petName.value = '';
    brush.stamp = null;
    rebuildPalette(unlockedBond);
    rebuildStamps(unlockedBond);
    // A fresh roll every time the studio opens: the first thing a player sees is
    // a finished creature, not an empty box asking them to be an artist.
    setMode('generate');
    setCreature(generateCreature());
    studioVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    studioVeil.classList.remove('open');
    document.body.style.overflow = '';
    // Drop the preview sprite. art/animator.js scans the whole document each
    // pass, and a closed studio should not leave a pet it has to keep animating.
    // open() rolls a fresh one anyway.
    genMount.innerHTML = '';
    drawPreview.replaceChildren();
  }

  function isOpen() {
    return studioVeil.classList.contains('open');
  }

  studioClose.addEventListener('click', close);
  cancelPet.addEventListener('click', close);
  savePet.addEventListener('click', () => {
    const name = (petName.value || '').trim();
    if (mode === 'generate') {
      if (!creature) return;
      onSave({ creature }, name);
      close();
      return;
    }
    if (isEmpty() && !stamps.length) { toast('Draw a body or place a stamp first. It needs something to inhabit.'); return; }
    const art = drawingArt();
    onSave(art, name);
    close();
  });

  buildPartChips();
  buildPalette();

  return { open, close, rebuildPalette, rebuildStamps, isOpen, isEmpty };
}
