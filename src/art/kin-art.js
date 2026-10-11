// Kin's pictures: envelopes with wax seals, small still portraits as markup
// (for postbox rows and previews), and the two jobs a foundling needs a canvas
// for: reading a drawing's ink colour, and stitching two drawings into one.
import { renderCreatureSVG, normalizeCreature, makeRng } from './creatures.js';
import { STAMP_SVG, CANVAS_SIZE, STAMP_SCALE } from './stamps.js';
import { drawingFrame } from './drawing.js';
import { planFoundling, PATCH_FOOT } from '../engine/kin.js';

export const MAX_FOUNDLING_IMAGE = 120 * 1024;
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = n => Math.round(n * 100) / 100;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

/* ---------------- envelopes ---------------- */
// Wax colour by temperament. The seal is pressed with a sigil the pair keeps.
const WAX = [
  [['doom', 'nihilist', 'undertaker', 'mourner', 'haunted', 'cryptid'], '#2E2433', '#5A4A63'],
  [['fungal', 'damp', 'feral', 'freegan', 'swarm'], '#3E5227', '#6F8C46'],
  [['heirloom', 'socialite', 'landlord', 'narcissist', 'napoleon', 'magpie'], '#9A6B16', '#D9A63A'],
  [['cult', 'prophet', 'astrology', 'cursed', 'theatrical'], '#4A2F5C', '#8A63A3']
];
const SIGILS = {
  skull: '<path d="M0-6.2c3.5 0 5.6 2.4 5.6 5.2 0 1.9-1 3.1-2.2 3.8v2.3H-2.6V2.8C-3.8 2.1-5.6.9-5.6-1c0-2.8 2.1-5.2 5.6-5.2z"/><circle cx="-2.1" cy="-1" r="1.3" fill="VAR"/><circle cx="2.1" cy="-1" r="1.3" fill="VAR"/>',
  moth: '<path d="M0-4.6c.8 0 1.2 1.2 1.2 4.6S.8 4.6 0 4.6-1.2 3.4-1.2 0-.8-4.6 0-4.6z"/><path d="M1-2C3.6-5.6 6.4-4.6 6.2-1.4 6 1.4 3.4 1.6 1 .6zM-1-2c-2.6-3.6-5.4-2.6-5.2.6.2 2.8 2.8 3 5.2 2z"/><path d="M1 1.2c2.6 0 4 1.4 3.2 3S1.6 4.4 1 2.4zM-1 1.2c-2.6 0-4 1.4-3.2 3S-1.6 4.4-1 2.4z"/>',
  key: '<circle cx="-2.6" cy="0" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M0-.7h6v1.4H4.8v1.8H3.4V.7H0z"/>',
  eye: '<path d="M-6 0c2-3 4-4.2 6-4.2S4 -3 6 0C4 3 2 4.2 0 4.2S-4 3-6 0z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle r="1.9"/>',
  candle: '<path d="M-1.8-1.5h3.6v6.5h-3.6z"/><path d="M0-6.2c1.4 1.4 1.6 2.6.4 3.6-1.2-.4-1.8-1.6-.4-3.6z"/>',
  moon: '<path d="M1.4-5.6A6 6 0 1 0 5.6 2.4 4.6 4.6 0 1 1 1.4-5.6z"/>',
  coffin: '<path d="M-2-6h4l2.6 3.4L2.4 6h-4.8L-4.6-2.6z"/><path d="M0-3.6v5M-1.6-1.6h3.2" stroke="VAR" stroke-width=".9"/>',
  spider: '<circle r="2.2"/><circle cy="-2.8" r="1.3"/><path d="M-2-.4l-4-2M-2 .6l-4.2.6M-1.8 1.4l-3.4 3M2-.4l4-2M2 .6l4.2.6M1.8 1.4l3.4 3" stroke="currentColor" stroke-width=".9" fill="none"/>'
};
export const SIGIL_IDS = Object.keys(SIGILS);
export function sealFor(seed, traits = []) {
  const rng = makeRng('seal:' + (Number(seed) >>> 0));
  const wax = WAX.find(([group]) => (traits || []).some(t => group.includes(t))) || [null, '#8E1F2E', '#C24A58'];
  return { sigil: SIGIL_IDS[Math.floor(rng() * SIGIL_IDS.length) % SIGIL_IDS.length], wax: wax[1], rim: wax[2], wobble: Array.from({ length: 9 }, () => .86 + rng() * .2) };
}
// The blob of wax, a pressed ring and the sigil, centred on 0,0 at radius ~11.
export function sealSVG(seal) {
  const points = seal.wobble.map((k, i) => {
    const angle = i / seal.wobble.length * Math.PI * 2;
    return [Math.cos(angle) * 11 * k, Math.sin(angle) * 11 * k];
  });
  const d = points.map(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return (i ? '' : 'M' + num(x) + ' ' + num(y)) + 'Q' + num(x * 1.12) + ' ' + num(y * 1.12) + ' ' + num((x + nx) / 2) + ' ' + num((y + ny) / 2);
  }).join('') + 'Z';
  const sigil = SIGILS[seal.sigil].replace(/VAR/g, seal.wax);
  return '<g class="kin-seal"><path d="' + d + '" fill="' + seal.wax + '"/><path d="M5 9.8q1 3.8-.4 5.2-1.6-1-.9-4.7z" fill="' + seal.wax + '"/>' +
    '<circle r="7.6" fill="none" stroke="' + seal.rim + '" stroke-width="1.1" opacity=".75"/><g fill="' + seal.rim + '" color="' + seal.rim + '">' + sigil + '</g>' +
    '<path d="M-6.5-6.8a9.4 9.4 0 0 1 6-2.6" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.4" stroke-linecap="round"/></g>';
}
// An envelope addressed in the game's own hand. `open` lifts the flap.
export function envelopeSVG({ seed = 0, traits = [], to = '', open = false, className = 'kin-envelope' } = {}) {
  const seal = sealFor(seed, traits);
  const flap = open ? 'M6 22 L60 2 L114 22' : 'M6 22 L60 58 L114 22';
  return '<svg class="' + esc(className) + '" viewBox="0 0 120 96" aria-hidden="true" focusable="false">' +
    '<rect x="6" y="22" width="108" height="68" rx="4" fill="#E8DBC2" stroke="#8E7A5E" stroke-width="1.4"/>' +
    '<path d="M6 90 L50 54 M114 90 L70 54" stroke="#BCA884" stroke-width="1.2" fill="none"/>' +
    (open ? '<rect x="18" y="8" width="84" height="44" rx="2" fill="#F6EEDD" stroke="#C9B89C"/><path d="M28 20h52M28 28h60M28 36h40" stroke="#9A8A74" stroke-width="1.4" stroke-linecap="round"/>' : '') +
    '<path d="' + flap + '" fill="#DCCBAE" stroke="#8E7A5E" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<g transform="translate(94 66)"><rect x="-8" y="-9" width="16" height="18" fill="#F6EEDD" stroke="#A8957A" stroke-dasharray="1.6 1.2"/><circle cy="-1" r="3.6" fill="#A32C3C" opacity=".75"/><path d="M-5 6h10" stroke="#A8957A"/></g>' +
    '<g transform="translate(26 74) rotate(-14)" fill="none" stroke="#6E5F53" stroke-opacity=".55"><circle r="8" stroke-dasharray="2 1.4"/><path d="M10-3q6-3 12 0t12 0M10 2q6-3 12 0t12 0"/></g>' +
    (to ? '<text x="60" y="84" text-anchor="middle" font-family="Caveat, Bradley Hand, cursive" font-size="9" fill="#3A2A47">' + esc(to) + '</text>' : '') +
    '<g transform="translate(60 ' + (open ? 22 : 56) + ')">' + sealSVG(seal) + '</g></svg>';
}

/* ---------------- still portraits, as markup ---------------- */
// Enough of the sprite's layout for a postbox row or a preview: the creature
// SVG, or the drawing in its frame with its stamps. Every value has already
// been read through social.js (PNG data URLs, hex colours, known stamps).
export function portraitHTML(art, { label = '' } = {}) {
  const a = record(art) ? art : {};
  const title = label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"';
  if (record(a.creature)) return '<span class="kin-portrait"' + title + '>' + renderCreatureSVG(normalizeCreature(a.creature), { className: 'kin-creature' }) + '</span>';
  const frame = drawingFrame(a.bounds) || { scale: 1, left: 0, top: 0 };
  const stamps = (Array.isArray(a.stamps) ? a.stamps : []).filter(s => record(s) && Object.hasOwn(STAMP_SVG, s.kind) && [s.x, s.y, s.size].every(Number.isFinite)).slice(0, 48).map(s => {
    const w = s.size * STAMP_SCALE / CANVAS_SIZE * 100;
    return '<span class="kin-stamp" style="left:' + num(s.x / CANVAS_SIZE * 100) + '%;top:' + num(s.y / CANVAS_SIZE * 100) + '%;width:' + num(w) + '%;height:' + num(w) +
      '%;color:' + (HEX.test(s.color || '') ? s.color : '#F2E9DC') + ';transform:translate(-50%,-50%) rotate(' + num(Number.isFinite(s.rotation) ? s.rotation : 0) + 'deg)">' + STAMP_SVG[s.kind] + '</span>';
  }).join('');
  const body = typeof a.body === 'string' && PNG.test(a.body) ? '<img src="' + esc(a.body) + '" alt="">' : '';
  return '<span class="kin-portrait kin-drawn"' + title + '><span class="kin-frame" style="left:' + num(frame.left * 100) + '%;top:' + num(frame.top * 100) +
    '%;width:' + num(frame.scale * 100) + '%;height:' + num(frame.scale * 100) + '%">' + body + stamps + '</span></span>';
}

/* ---------------- canvas work ---------------- */
export const canDraw = () => typeof document !== 'undefined' && typeof document.createElement === 'function' &&
  !!document.createElement('canvas').getContext?.('2d');
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}
const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
// The colour a drawing is mostly made of: the commonest opaque colour, by
// sixteenths, averaged. Read at the image's own size so it is the same on
// every device.
export function dominantInk(data, width, height) {
  const buckets = new Map();
  const stepX = Math.max(1, Math.floor(width / 160)), stepY = Math.max(1, Math.floor(height / 160));
  for (let y = 0; y < height; y += stepY) for (let x = 0; x < width; x += stepX) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 160) continue;
    const key = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | data[i + 2] >> 4;
    const b = buckets.get(key) || [0, 0, 0, 0];
    b[0] += data[i]; b[1] += data[i + 1]; b[2] += data[i + 2]; b[3]++;
    buckets.set(key, b);
  }
  let best = null;
  for (const [key, b] of buckets) if (!best || b[3] > best[1][3] || (b[3] === best[1][3] && key < best[0])) best = [key, b];
  if (!best) return null;
  const [, [r, g, b, n]] = best;
  return '#' + hex2(r / n) + hex2(g / n) + hex2(b / n);
}
export async function readInk(dataUrl) {
  if (!canDraw() || typeof dataUrl !== 'string' || !PNG.test(dataUrl)) return null;
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w * h > 4096 * 4096) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return dominantInk(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch { return null; }
}
function seam(ctx, size, top, bottom) {
  const x = size / 2, y0 = top * size, y1 = bottom * size;
  if (y1 - y0 < size * .08) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(43,32,40,.85)'; ctx.lineWidth = Math.max(2, size / 110);
  ctx.setLineDash([size / 40, size / 70]);
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  ctx.setLineDash([]);
  const gap = size / 16, arm = size / 46;
  for (let y = y0 + gap / 2; y < y1 - gap / 4; y += gap) {
    for (const [stroke, width] of [['rgba(43,32,40,.9)', Math.max(3, size / 70)], ['#F2E9DC', Math.max(1.5, size / 150)]]) {
      ctx.strokeStyle = stroke; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x - arm, y - arm * .6); ctx.lineTo(x + arm, y + arm * .6); ctx.stroke();
    }
  }
  ctx.restore();
}
// Left half of one drawing, right half of the other, a seam down the middle.
// Tries smaller canvases until the PNG fits the size every reader accepts.
export async function stitchPatchwork(plan, artA, artB) {
  if (!canDraw() || !plan?.patch) return null;
  const L = plan.patch.left === 'a' ? artA : artB, R = plan.patch.left === 'a' ? artB : artA;
  try {
    const [imgL, imgR] = await Promise.all([L?.body ? loadImage(L.body) : null, R?.body ? loadImage(R.body) : null]);
    if (!imgL && !imgR) return null;
    const { left, right } = plan.patch.layout;
    for (const size of [400, 320, 240, 180]) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      for (const [img, half] of [[imgL, left], [imgR, right]]) {
        if (!img) continue;
        ctx.save();
        ctx.beginPath(); ctx.rect(half.side === 'left' ? 0 : size / 2, 0, size / 2, size); ctx.clip();
        ctx.drawImage(img, (.5 - half.cx * half.scale) * size, (PATCH_FOOT - half.bottom * half.scale) * size, half.scale * size, half.scale * size);
        ctx.restore();
      }
      seam(ctx, size, Math.max(left.box.y, right.box.y) + .04, PATCH_FOOT - .02);
      const body = canvas.toDataURL('image/png');
      if (PNG.test(body) && body.length <= MAX_FOUNDLING_IMAGE) return { body, stamps: plan.patch.stamps.slice(0, 48), bounds: { ...plan.patch.bounds } };
    }
  } catch { /* the fallback stands */ }
  return null;
}

// The whole child, with the canvas work done where a canvas exists.
export async function realizeFoundling({ a, b, seed, roll = 0 }) {
  const drawn = art => record(art) && !art.creature && typeof art.body === 'string' && PNG.test(art.body);
  const made = art => record(art) && record(art.creature);
  const inks = {};
  if (made(a?.art) !== made(b?.art)) {
    if (drawn(a?.art)) inks.a = await readInk(a.art.body);
    if (drawn(b?.art)) inks.b = await readInk(b.art.body);
  }
  const plan = planFoundling({ a, b, seed, roll, inks });
  if (plan.look === 'patchwork') {
    const stitched = await stitchPatchwork(plan, a.art, b.art);
    if (stitched) { plan.art = stitched; plan.stitched = true; }
  }
  return plan;
}
