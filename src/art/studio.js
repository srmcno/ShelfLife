// Drawing studio: freehand body canvas (unchanged mechanics from the original prototype)
// plus stamps recorded as positional data instead of being baked into canvas pixels.
// Everything here takes `state` as an explicit argument or reads the live `state`
// import — never a hidden closure over a duplicated copy of the save data.
import { CANVAS_SIZE, BASE_STAMPS, UNLOCK_STAMPS, STAMP_SVG, STAMP_LABELS } from './stamps.js';
import { state } from '../state.js';

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

  const ctx = pad.getContext('2d');
  pad.width = CANVAS_SIZE;
  pad.height = CANVAS_SIZE;

  const brush = { color: BASE_COLORS[0], size: 16, erase: false, stamp: null };

  // Single linear undo history covering both freehand strokes and stamp placements,
  // oldest-to-newest, matching the original's single-stack single-button UX.
  //   { type: 'stroke', dataURL }  – canvas snapshot taken *before* the stroke started
  //   { type: 'stamp' }            – undoing just pops the last placed stamp
  let undoStack = [];

  // Placed stamps: plain data objects, never drawn onto the canvas. `stamps` is the
  // data (this is what becomes art.stamps on save); `stampEls` is the parallel array of
  // live preview DOM nodes in #stampLayer, kept in lockstep so undo can remove the right one.
  let stamps = [];
  let stampEls = [];

  let drawing = false;
  let lastPt = null;

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
    try { undoStack.push({ type: 'stroke', dataURL: pad.toDataURL() }); } catch (e) {}
    if (undoStack.length > 12) undoStack.shift();
  }

  // Same left/top/width/height/transform math art/sprite.js uses to place a stamp on the
  // shelf, so a stamp previewed here lands in the same relative spot once rendered small.
  function renderStampEl(s) {
    const el = document.createElement('div');
    el.className = 'sprite-stamp';
    el.style.left = (s.x / CANVAS_SIZE * 100) + '%';
    el.style.top = (s.y / CANVAS_SIZE * 100) + '%';
    const wh = (s.size * 2 / CANVAS_SIZE * 100) + '%';
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
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { drawing = false; lastPt = null; }));

  sizeWrap.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
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
      return;
    }
    if (!entry.dataURL) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, pad.width, pad.height);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, pad.width, pad.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = entry.dataURL;
  });

  // "Start over" clears the freehand canvas only, exactly like the original prototype's
  // clearBtn — it does not remove already-placed stamps. See report/judgment-call notes.
  clearBtn.addEventListener('click', () => {
    pushStrokeUndo();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
  });

  function isEmpty() {
    const d = ctx.getImageData(0, 0, pad.width, pad.height).data;
    for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) return false;
    return true;
  }

  function padThumb() {
    const out = document.createElement('canvas');
    out.width = 320;
    out.height = 320;
    out.getContext('2d').drawImage(pad, 0, 0, 320, 320);
    return out.toDataURL('image/png');
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
    studioVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    studioVeil.classList.remove('open');
    document.body.style.overflow = '';
  }

  function isOpen() {
    return studioVeil.classList.contains('open');
  }

  studioClose.addEventListener('click', close);
  cancelPet.addEventListener('click', close);
  savePet.addEventListener('click', () => {
    if (isEmpty()) return;
    const art = { body: padThumb(), stamps: stamps.map(s => ({ ...s })) };
    const name = (petName.value || '').trim();
    onSave(art, name);
    close();
  });

  return { open, close, rebuildPalette, rebuildStamps, isOpen, isEmpty };
}
