// A postcard: the shelf, drawn to a canvas with a note and a caption, so a
// player can send the residents somewhere they cannot follow. Everything is
// drawn from the same sources the shelf uses (the creature renderer, the
// stamp art, the prop art), so the picture matches what is on screen.
import { storyState } from '../engine/stories.js';
import { state, save } from '../state.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { POSTCARD_CAPTIONS } from '../content/postcards.js';
import { MOOD_BUBBLES } from '../content/bubbles.js';
import { renderCreatureSVG, normalizeCreature } from '../art/creatures.js';
import { footY } from '../art/sprite.js';
import { drawingFrame } from '../art/drawing.js';
import { STAMP_SVG, CANVAS_SIZE, STAMP_SCALE } from '../art/stamps.js';
import { moodOf, isAsleep } from '../engine/tick.js';
import { totalBond } from '../engine/unlocks.js';
import { toast } from './toast.js';

const W = 1080, H = 1350;
const COLS = 6;

const veil = document.getElementById('postcardVeil');
const img = document.getElementById('postcardImg');
const frame = document.getElementById('postcardFrame');
const meta = document.getElementById('postcardMeta');
const shareBtn = document.getElementById('postcardShare');
const saveBtn = document.getElementById('postcardSave');
const againBtn = document.getElementById('postcardAgain');
const closeBtn = document.getElementById('postcardClose');
const hint = document.getElementById('postcardHint');

let lastBlob = null;
let lastUrl = null;
let lastCaption = '';
let lastThumb = null;
let rendering = false;

const pick = a => a[Math.floor(Math.random() * a.length)];
const cssVar = (name, fallback) => (getComputedStyle(document.body).getPropertyValue(name) || '').trim() || fallback;
const XMLNS = 'http://www.w3.org/2000/svg';

function withNs(svg) {
  return svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="' + XMLNS + '"');
}

function loadSvg(svg) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function loadUrl(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// Prop art is themed with CSS variables the image loader cannot see; resolve
// them against the current room first.
const PROP_FALLBACK = { wood: '#5C3A47', 'wood-lip': '#7A4C5B', pink: '#FF8FB8', amber: '#F2B441', mint: '#7FD8C0', blood: '#A32C3C', 'bone-dim': '#C9BCAE', bone: '#F2E9DC' };
function propSvg(kind) {
  const raw = PROP_ART[kind];
  if (!raw) return null;
  return withNs(raw.replace(/var\(--([a-z-]+)\)/g, (m, name) => cssVar('--' + name, PROP_FALLBACK[name] || '#888888')));
}

function creatureSvg(creature, size) {
  const c = normalizeCreature(creature);
  return { svg: '<svg xmlns="' + XMLNS + '" viewBox="-72 -72 144 144" width="' + size + '" height="' + size + '">' + renderCreatureSVG(c, { inner: true }) + '</svg>', foot: footY(c) };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function wrap(ctx, text, maxWidth, maxLines) {
  const out = [];
  text.split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(word => {
      const t = line ? line + ' ' + word : word;
      if (ctx.measureText(t).width > maxWidth && line) { out.push(line); line = word; } else line = t;
    });
    out.push(line);
  });
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s+\S*$/, '') + '…'; }
  return out;
}

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  await Promise.all(['600 34px Caveat', '400 72px Gloock', '700 15px Karla', 'italic 400 22px Karla', '600 24px Karla']
    .map(f => document.fonts.load(f).catch(() => null)));
}

async function drawPet(ctx, pet, cx, plankY, size) {
  if (pet.art && pet.art.creature) {
    const { svg, foot } = creatureSvg(pet.art.creature, size);
    const image = await loadSvg(svg);
    if (!image) return;
    const unit = size / 144;
    ctx.drawImage(image, cx - size / 2, plankY - (foot + 72) * unit, size, size);
    return;
  }
  // A drawing: the raster body fitted the way the shelf fits it, then the
  // stamps in canvas space on top.
  const box = size * 0.86;
  const fx = cx - box / 2, fy = plankY - box;
  const fr = drawingFrame(pet.art && pet.art.bounds) || { scale: 1, left: 0, top: 0 };
  const dw = fr.scale * box, dx = fx + fr.left * box, dy = fy + fr.top * box;
  const body = await loadUrl(pet.art && pet.art.body);
  if (body) ctx.drawImage(body, dx, dy, dw, dw);
  for (const stamp of (pet.art && pet.art.stamps) || []) {
    const raw = STAMP_SVG[stamp.kind];
    if (!raw) continue;
    const px = stamp.size * STAMP_SCALE / CANVAS_SIZE * dw;
    const svg = withNs(raw).replace('<svg', '<svg style="color:' + (stamp.color || '#2B2028') + '" width="' + Math.ceil(px) + '" height="' + Math.ceil(px) + '"');
    const image = await loadSvg(svg);
    if (!image) continue;
    ctx.save();
    ctx.translate(dx + stamp.x / CANVAS_SIZE * dw, dy + stamp.y / CANVAS_SIZE * dw);
    ctx.rotate((stamp.rotation || 0) * Math.PI / 180);
    ctx.drawImage(image, -px / 2, -px / 2, px, px);
    ctx.restore();
  }
}

function bubbleAt(ctx, text, cx, topY) {
  ctx.font = '600 25px Caveat';
  const pad = 12;
  const w = Math.min(230, ctx.measureText(text).width + pad * 2);
  const lines = wrap(ctx, text, w - pad * 2, 3);
  const h = lines.length * 28 + pad * 2 - 6;
  const x = Math.max(12, Math.min(W - w - 12, cx - w / 2));
  const y = topY - h - 14;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  ctx.fillStyle = cssVar('--paper-lit', '#F0E3CD');
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 7, y + h); ctx.lineTo(cx + 7, y + h); ctx.lineTo(cx, y + h + 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#221826'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + pad + 20 + i * 28));
}

export async function renderPostcard(caption) {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const ink = cssVar('--ink', '#F2E9DC'), ink2 = cssVar('--ink-2', '#B8AB9D'), ink3 = cssVar('--ink-3', '#8F857A');
  const key = cssVar('--key', '#F2C083'), roomA = cssVar('--room-a', '#33203D'), roomB = cssVar('--room-b', '#1A1220');
  const wood = cssVar('--wood', '#5C3A47'), lip = cssVar('--wood-lip', '#7A4C5B');

  // the room
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, roomA); bg.addColorStop(1, roomB);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.5, 0, 40, W * 0.5, 0, 700);
  glow.addColorStop(0, 'rgba(242,192,131,.22)'); glow.addColorStop(1, 'rgba(242,192,131,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H * 0.45, 300, W / 2, H * 0.45, 1000);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

  // the wordmark and the figures
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 74px Gloock';
  ctx.fillStyle = ink; ctx.textAlign = 'left';
  ctx.fillText('Shelf', 70, 128);
  const shelfW = ctx.measureText('Shelf').width;
  ctx.fillStyle = key; ctx.fillText('Life', 70 + shelfW + 10, 128);
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  ctx.font = '600 20px Karla'; ctx.fillStyle = ink2; ctx.textAlign = 'right';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
  ctx.fillText(('DAY ' + days + '   ·   ' + state.pets.length + ' LIVING HERE   ·   TRUST ' + totalBond(state)).toUpperCase(), W - 70, 122);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

  // the case: only the rows with anything on them
  const rowsAll = Math.ceil(state.slots.length / COLS);
  const rows = [];
  for (let r = 0; r < rowsAll; r++) if (state.slots.slice(r * COLS, r * COLS + COLS).some(Boolean)) rows.push(r);
  const caseX = 60, caseW = W - 120, innerX = caseX + 30, innerW = caseW - 60;
  const pitch = innerW / COLS, petSize = pitch * 1.3, rowH = petSize + 62;
  const caseY = 190;
  const caseH = rows.length ? rows.length * rowH + 40 : 260;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
  ctx.fillStyle = wood; roundRect(ctx, caseX - 14, caseY - 14, caseW + 28, caseH + 40, 16); ctx.fill();
  ctx.restore();
  const caseBg = ctx.createLinearGradient(0, caseY, 0, caseY + caseH);
  caseBg.addColorStop(0, cssVar('--case-lit', '#170F22')); caseBg.addColorStop(0.5, cssVar('--case-mid', '#0C0914')); caseBg.addColorStop(1, cssVar('--case-deep', '#06040A'));
  ctx.fillStyle = caseBg; ctx.fillRect(caseX, caseY, caseW, caseH);
  const spot = ctx.createRadialGradient(caseX + caseW * 0.32, caseY, 20, caseX + caseW * 0.32, caseY, caseW * 0.8);
  spot.addColorStop(0, 'rgba(242,192,131,.26)'); spot.addColorStop(1, 'rgba(242,192,131,0)');
  ctx.fillStyle = spot; ctx.fillRect(caseX, caseY, caseW, caseH);

  let speaker = null;
  if (!rows.length) {
    ctx.fillStyle = ink3; ctx.textAlign = 'center'; ctx.font = '600 40px Caveat';
    ctx.fillText('Vacancy. Eighteen small rooms.', W / 2, caseY + caseH / 2 + 12);
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const plankY = caseY + 30 + (i + 1) * rowH - 46;
    // the shadow on the plank, then the occupants, then the plank front
    for (let c = 0; c < COLS; c++) {
      const id = state.slots[r * COLS + c];
      if (!id) continue;
      const cx = innerX + c * pitch + pitch / 2;
      const pet = state.pets.find(p => p.id === id);
      const grd = ctx.createRadialGradient(cx + 8, plankY, 4, cx + 8, plankY, pitch * 0.34);
      grd.addColorStop(0, 'rgba(0,0,0,.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(cx - pitch / 2, plankY - 14, pitch, 28);
      if (pet) {
        await drawPet(ctx, pet, cx, plankY + 2, petSize);
        if (!speaker && !isAsleep(pet) && Math.random() < 0.5) speaker = { pet, cx, top: plankY - petSize * 0.62 };
      } else {
        const pr = (state.props || []).find(x => x.id === id);
        const svg = pr && propSvg(pr.kind);
        const image = svg && await loadSvg(svg);
        if (image) { const s = pitch * 0.62; ctx.drawImage(image, cx - s / 2, plankY - s * 0.86, s, s); }
      }
    }
    const plankGrad = ctx.createLinearGradient(0, plankY, 0, plankY + 24);
    plankGrad.addColorStop(0, lip); plankGrad.addColorStop(0.3, wood); plankGrad.addColorStop(1, '#0A0508');
    ctx.fillStyle = plankGrad; ctx.fillRect(caseX + 8, plankY, caseW - 16, 24);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(caseX + 8, plankY + 24, caseW - 16, 10);
    // nameplates
    ctx.font = '700 15px Karla'; ctx.textAlign = 'center';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '2px';
    for (let c = 0; c < COLS; c++) {
      const id = state.slots[r * COLS + c];
      if (!id) continue;
      const pet = state.pets.find(p => p.id === id);
      const pr = pet ? null : (state.props || []).find(x => x.id === id);
      const name = pet ? pet.name : (pr && PROPS[pr.kind] ? PROPS[pr.kind].name : '');
      ctx.fillStyle = pet ? (moodOf(pet) === 'furious' ? '#FF9AA6' : '#EFE2CE') : '#C4B7A4';
      ctx.fillText(name.toUpperCase().slice(0, 16), innerX + c * pitch + pitch / 2, plankY + 50);
    }
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  }
  if (speaker) bubbleAt(ctx, pick(MOOD_BUBBLES[moodOf(speaker.pet)] || MOOD_BUBBLES.fine), speaker.cx, speaker.top);

  // a note, pinned under the case
  // A short note reads on a postcard; a filled-in document does not.
  const recent = state.notes.slice(0, 8);
  const short = recent.filter(n => n.form !== 'doc' && n.form !== 'list' && n.text.length <= 170);
  const pool = short.length ? short : recent;
  const note = pool.length ? pool[Math.floor(Math.random() * Math.min(4, pool.length))] : null;
  const noteTop = caseY + caseH + 70;
  if (note && noteTop < H - 220) {
    ctx.font = '600 33px Caveat';
    const maxLines = Math.max(2, Math.min(6, Math.floor((H - 150 - noteTop - 90) / 40)));
    const lines = wrap(ctx, note.text, W - 260, maxLines);
    const nh = lines.length * 40 + 96;
    ctx.save();
    ctx.translate(W / 2, noteTop + nh / 2); ctx.rotate(-0.014);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 14;
    ctx.fillStyle = cssVar('--paper-lit', '#F0E3CD');
    ctx.fillRect(-(W - 200) / 2, -nh / 2, W - 200, nh);
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2, noteTop + nh / 2); ctx.rotate(-0.014);
    ctx.strokeStyle = 'rgba(43,32,40,.1)'; ctx.lineWidth = 1;
    for (let i = 0; i < lines.length; i++) { const ly = -nh / 2 + 62 + i * 40; ctx.beginPath(); ctx.moveTo(-(W - 200) / 2 + 30, ly + 8); ctx.lineTo((W - 200) / 2 - 30, ly + 8); ctx.stroke(); }
    ctx.fillStyle = '#2B2028'; ctx.textAlign = 'left'; ctx.font = '600 33px Caveat';
    lines.forEach((l, i) => ctx.fillText(l, -(W - 200) / 2 + 40, -nh / 2 + 62 + i * 40));
    ctx.font = 'italic 400 18px Karla'; ctx.fillStyle = '#7A6A72'; ctx.textAlign = 'right';
    ctx.fillText(note.from, (W - 200) / 2 - 40, nh / 2 - 26);
    // the pin
    ctx.fillStyle = '#B8414F'; ctx.beginPath(); ctx.arc(0, -nh / 2 + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-3, -nh / 2 - 1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // the caption and the postmark
  ctx.textAlign = 'center';
  ctx.font = 'italic 400 24px Karla'; ctx.fillStyle = ink2;
  ctx.fillText(caption, W / 2, H - 78);
  ctx.font = '600 15px Karla'; ctx.fillStyle = ink3;
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
  ctx.fillText('SRMCNO.GITHUB.IO/SHELFLIFE', W / 2, H - 42);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  return canvas;
}

async function present() {
  if (rendering) return;
  rendering = true;
  lastThumb = null; lastBlob = null;
  saveBtn.disabled = true;
  document.getElementById('postcardKeep').disabled = true;
  lastCaption = pick(POSTCARD_CAPTIONS);
  meta.textContent = lastCaption;
  frame.classList.add('busy');
  img.removeAttribute('src');
  try {
    const canvas = await renderPostcard(lastCaption);
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 324; thumbnail.height = 405;
    thumbnail.getContext('2d').drawImage(canvas, 0, 0, 324, 405);
    lastThumb = thumbnail.toDataURL('image/jpeg', .72);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastBlob = blob;
    lastUrl = URL.createObjectURL(blob);
    img.src = lastUrl;
  } catch (e) {
    toast('The postcard would not develop. Try again in a moment.');
  } finally {
    frame.classList.remove('busy');
    rendering = false;
    saveBtn.disabled = !lastBlob;
    document.getElementById('postcardKeep').disabled = !lastThumb;
  }
}

function fileName() {
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  return 'shelf-life-day-' + days + '.png';
}

function canShareFiles() {
  try {
    if (!navigator.share || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] });
  } catch (e) { return false; }
}

export function openPostcard() {
  if (!veil) return;
  veil.classList.add('open');
  veil.scrollTop = 0;
  shareBtn.hidden = !canShareFiles();
  hint.textContent = shareBtn.hidden
    ? 'Save the picture, or press and hold it to copy it. It is 1080 by 1350, which fits a phone screen and most feeds.'
    : 'Share sends the picture straight to another app. Save keeps a copy. Another deals a new caption and a new note.';
  present();
  closeBtn.focus({ preventScroll: true });
}

export function closePostcard() {
  if (!veil) return;
  veil.classList.remove('open');
}

export function initPostcard() {
  if (!veil) return;
  document.getElementById('snapBtn')?.addEventListener('click', openPostcard);
  document.getElementById('postcardBtn')?.addEventListener('click', openPostcard);
  document.getElementById('postcardKeep').addEventListener('click', () => {
    if (!lastThumb) return;
    const album = storyState(state).postcards;
    if (!album.some(p => p.image === lastThumb)) album.unshift({ image: lastThumb, caption: lastCaption, at: Date.now() });
    state.stories.postcards = album.slice(0, 6);
    save(); toast('Kept in the museum. The residents dispute the likeness.');
  });
  closeBtn.addEventListener('click', closePostcard);
  veil.addEventListener('click', e => { if (e.target === veil) closePostcard(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && veil.classList.contains('open')) closePostcard(); });
  againBtn.addEventListener('click', present);
  saveBtn.addEventListener('click', () => {
    if (!lastBlob) return;
    const a = document.createElement('a');
    a.href = lastUrl; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    toast('Saved. They will want to see it.');
  });
  shareBtn.addEventListener('click', async () => {
    if (!lastBlob) return;
    try {
      const file = new File([lastBlob], fileName(), { type: 'image/png' });
      await navigator.share({ files: [file], title: 'Shelf Life', text: lastCaption });
    } catch (e) {
      if (!e || e.name !== 'AbortError') toast('Sharing did not go through. Save it instead.');
    }
  });
}
