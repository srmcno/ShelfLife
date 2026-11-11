// A verdict, as a picture to send: the case, the two parties as drawn, the
// ruling and the ratings. Drawn to a canvas like the postcard, and shared the
// same way (the share sheet where there is one, a saved file where not).
import { drawPet, loadFonts, wrap, roundRect, canShareFiles } from './postcard.js';
import { isNative, shareFile } from '../native.js';
import { PLAY_URL } from '../backup.js';
import { toast } from './toast.js';

const W = 1080, H = 1350;
const INK = '#F3E8D3', GOLD = '#F6C768', BLOOD = '#E0465B', DIM = '#B9A99A';

function centered(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

// card: { title, ruling, line, stars, ratings, plaintiff: { name, pet }, defendant: { name, pet } }
// A party without a pet (a visitor, a ghost) gets an empty stand and keeps its name.
export async function renderVerdictCard(card) {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2A1420'); sky.addColorStop(0.55, '#170F1D'); sky.addColorStop(1, '#0B0812');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 4; roundRect(ctx, 36, 36, W - 72, H - 72, 28); ctx.stroke();
  ctx.strokeStyle = '#F6C76855'; ctx.lineWidth = 2; roundRect(ctx, 52, 52, W - 104, H - 104, 20); ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BLOOD; ctx.font = '700 26px Karla, sans-serif';
  ctx.fillText('L I V E   F R O M   T H E   S H E L F', W / 2, 138);
  ctx.fillStyle = GOLD; ctx.font = '400 104px Gloock, Georgia, serif';
  ctx.fillText('SHELF COURT', W / 2, 242);
  ctx.fillStyle = INK; ctx.font = '400 54px Gloock, Georgia, serif';
  let y = centered(ctx, wrap(ctx, String(card.title || 'A case'), W - 220, 2), W / 2, 338, 62);

  // The dock: two stands and whoever stood on them.
  const plank = 650, size = 300;
  for (const [party, cx, label] of [[card.plaintiff, W * 0.28, 'PLAINTIFF'], [card.defendant, W * 0.72, 'DEFENDANT']]) {
    ctx.fillStyle = '#3A2532'; roundRect(ctx, cx - 190, plank, 380, 26, 8); ctx.fill();
    ctx.fillStyle = '#24161F'; ctx.fillRect(cx - 160, plank + 26, 320, 60);
    if (party?.pet) { try { await drawPet(ctx, party.pet, cx, plank, size); } catch { /* the stand stays empty */ } }
    ctx.fillStyle = DIM; ctx.font = '700 22px Karla, sans-serif'; ctx.fillText(label, cx, plank + 128);
    ctx.fillStyle = INK; ctx.font = '400 44px Gloock, Georgia, serif';
    centered(ctx, wrap(ctx, String(party?.name || 'Somebody'), 400, 2), cx, plank + 180, 48);
  }
  ctx.fillStyle = BLOOD; ctx.font = 'italic 400 64px Gloock, Georgia, serif'; ctx.fillText('v.', W / 2, plank - 120);

  y = plank + 330;
  ctx.fillStyle = GOLD; ctx.font = '400 52px Gloock, Georgia, serif';
  y = centered(ctx, wrap(ctx, String(card.ruling || ''), W - 200, 2), W / 2, y, 58);
  ctx.fillStyle = INK; ctx.font = '600 40px Caveat, cursive';
  y = centered(ctx, wrap(ctx, String(card.line || ''), W - 240, 2), W / 2, y + 6, 46);
  const stars = Math.max(0, Math.min(3, Math.floor(Number(card.stars) || 0)));
  ctx.font = '400 50px Karla, sans-serif'; ctx.fillStyle = GOLD;
  ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars) + '   Ratings ' + (Math.floor(Number(card.ratings)) || 0), W / 2, y + 30);
  ctx.fillStyle = DIM; ctx.font = '700 22px Karla, sans-serif';
  ctx.fillText(PLAY_URL.replace(/^https?:\/\//, '').replace(/\/$/, '').toUpperCase(), W / 2, H - 78);
  return canvas;
}

// An arcade score, as a picture: the game, who played, the score and the rank.
// card: { title, accent, score, rank, tier, newBest, daily, stats: [[label, value]], pet, name }
export async function renderScoreCard(card) {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const accent = /^#[0-9a-f]{6}$/i.test(card.accent || '') ? card.accent : GOLD;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1C1430'); sky.addColorStop(0.6, '#130E20'); sky.addColorStop(1, '#0A0711');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = accent; ctx.lineWidth = 4; roundRect(ctx, 36, 36, W - 72, H - 72, 28); ctx.stroke();
  ctx.strokeStyle = accent + '55'; ctx.lineWidth = 2; roundRect(ctx, 52, 52, W - 104, H - 104, 20); ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent; ctx.font = '700 26px Karla, sans-serif';
  ctx.fillText(card.daily ? 'T O D A Y \u2019 S   C H A L L E N G E' : 'T H E   A R C A D E', W / 2, 138);
  ctx.fillStyle = INK; ctx.font = '400 92px Gloock, Georgia, serif';
  let y = centered(ctx, wrap(ctx, String(card.title || 'The arcade'), W - 200, 2), W / 2, 240, 96);

  const floor = 690;
  ctx.fillStyle = '#2A1E3A'; roundRect(ctx, W / 2 - 230, floor, 460, 26, 8); ctx.fill();
  if (card.pet) { try { await drawPet(ctx, card.pet, W / 2, floor, 330); } catch { /* the stage stays empty */ } }
  ctx.fillStyle = DIM; ctx.font = '700 24px Karla, sans-serif';
  ctx.fillText(String(card.name ? 'PLAYED BY ' + card.name : 'PLAYED BY THE HOUSEHOLD').toUpperCase().slice(0, 44), W / 2, floor + 74);

  ctx.fillStyle = accent; ctx.font = '400 190px Gloock, Georgia, serif';
  ctx.fillText(String(Math.max(0, Math.floor(Number(card.score) || 0))), W / 2, floor + 270);
  ctx.fillStyle = INK; ctx.font = '600 48px Caveat, cursive';
  const tier = Math.max(0, Math.min(3, Math.floor(Number(card.tier) || 0)));
  ctx.fillText((card.newBest ? 'A new best. ' : '') + (tier ? String(card.rank || '') + ', skull ' + tier + ' of 3' : 'No skull this time'), W / 2, floor + 338);
  const stats = (card.stats || []).slice(0, 3), gap = 300, left = W / 2 - gap * (stats.length - 1) / 2;
  stats.forEach(([label, value], i) => {
    const cx = left + i * gap;
    ctx.fillStyle = INK; ctx.font = '400 60px Gloock, Georgia, serif'; ctx.fillText(String(value), cx, floor + 440);
    ctx.fillStyle = DIM; ctx.font = '700 22px Karla, sans-serif'; ctx.fillText(String(label).toUpperCase(), cx, floor + 476);
  });
  ctx.fillStyle = DIM; ctx.font = '700 22px Karla, sans-serif';
  ctx.fillText(PLAY_URL.replace(/^https?:\/\//, '').replace(/\/$/, '').toUpperCase(), W / 2, H - 78);
  return canvas;
}

// Send a drawn card: the share sheet where there is one, a saved file where not.
// Returns 'shared', 'saved', 'cancelled' or 'failed'.
async function sendCard(render, { name, title, text, dialogTitle, saved, failed }) {
  let blob;
  try {
    const canvas = await render();
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } catch { blob = null; }
  if (!blob) { toast(failed); return 'failed'; }
  if (isNative()) {
    const result = await shareFile({ name, blob, title, text, dialogTitle });
    if (result === 'failed') toast('Sharing did not go through.');
    return result === 'failed' ? 'failed' : 'shared';
  }
  if (canShareFiles()) {
    try { await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title, text }); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(saved);
  return 'saved';
}

export function shareVerdictCard(card) {
  return sendCard(() => renderVerdictCard(card), { name: 'shelf-court-verdict.png', title: 'Shelf Court', text: String(card.ruling || 'A verdict from Shelf Court'),
    dialogTitle: 'Send the verdict', saved: 'Verdict saved as a picture. Send it to the losing side.', failed: 'The court artist could not finish the picture.' });
}
export function shareScoreCard(card) {
  return sendCard(() => renderScoreCard(card), { name: 'shelf-life-score.png', title: String(card.title || 'The arcade'),
    text: String(card.score) + ' in ' + String(card.title || 'the arcade') + '. Beat it.', dialogTitle: 'Send the score',
    saved: 'Score saved as a picture. Send it to somebody who thinks they can beat it.', failed: 'The picture would not develop.' });
}
