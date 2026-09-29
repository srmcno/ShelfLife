// Renders the Google Play feature graphic (1024x500, JPEG, no alpha) with the
// game's own renderer, so Mabel, Pip and Oswald look exactly as they do on the
// invitation screen.
//
//   node scripts/render_store_art.mjs
//
// It starts the local preview server on SHELF_PREVIEW_PORT (default 4191).
// Set CHROMIUM_PATH to use a specific browser.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SHELF_PREVIEW_PORT || 4191);
const ORIGIN = `http://localhost:${PORT}`;
const OUT = path.join(ROOT, 'store', 'feature-graphic.jpg');

const drop = (x, y, s) => `<path d="M${x} ${y}c${14 * s} ${22 * s} ${22 * s} ${38 * s} ${22 * s} ${52 * s}a${22 * s} ${22 * s} 0 0 1-${44 * s} 0c0-${14 * s} ${8 * s}-${30 * s} ${22 * s}-${52 * s}Z"/>`;
const wallpaper = Array.from({ length: 9 }, (_, col) => Array.from({ length: 4 }, (_, row) =>
  drop(60 + col * 120 + (row % 2) * 60, 10 + row * 118, 1))).flat().join('');
const candle = (x, h) => `<div class="candle" style="left:${x}px;height:${h}px"><i></i></div>`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/fonts.css"><link rel="stylesheet" href="/css/style.css">
<style>
  html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#140c1a}
  .art{position:relative;width:1024px;height:500px;overflow:hidden;
    background:radial-gradient(60% 90% at 70% 30%,#4a2b54 0,#2a1834 55%,#120a18 100%)}
  .paper{position:absolute;inset:0;fill:#fff;opacity:.04}
  .glow{position:absolute;border-radius:50%;pointer-events:none}
  .shelf{position:absolute;left:0;right:0;top:392px;height:18px;background:linear-gradient(#b98292,#8d566b)}
  .lip{position:absolute;left:0;right:0;top:408px;height:3px;background:#d6a3ae;opacity:.55}
  .front{position:absolute;left:0;right:0;top:411px;height:40px;background:linear-gradient(#6f3d55,#4a2539)}
  .under{position:absolute;left:0;right:0;top:451px;bottom:0;background:linear-gradient(#07040a,#120a18)}
  .candle{position:absolute;bottom:108px;width:26px;border-radius:5px 5px 2px 2px;
    background:linear-gradient(90deg,#fff6e2,#e2cfae);box-shadow:inset 0 -3px 0 #0002}
  .candle i{position:absolute;left:50%;top:-38px;width:20px;height:32px;margin-left:-10px;
    border-radius:50% 50% 50% 50%/62% 62% 38% 38%;
    background:radial-gradient(circle at 50% 72%,#fffbe6 0 22%,#ffd978 48%,#f08a3c 100%);
    box-shadow:0 0 26px 10px #ffc87766,0 0 90px 40px #f2a35e22}
  .cast{position:absolute;right:40px;bottom:88px;display:flex;align-items:flex-end;gap:6px}
  .cast .who{width:172px;height:230px;display:flex;align-items:flex-end;justify-content:center}
  .cast .sprite{--pet-h:212px;width:172px}
  .cast .who:nth-child(2){margin-bottom:10px}
  .shadow{position:absolute;bottom:98px;height:14px;width:136px;border-radius:50%;background:#07040a;opacity:.45;filter:blur(3px)}
  .copy{position:absolute;left:62px;top:84px;width:430px;color:#f2e9dc}
  .copy h1{margin:0;font:400 104px/0.95 Gloock,serif;letter-spacing:-.035em}
  .copy h1 em{font-style:normal;color:#F6C768;text-shadow:0 0 22px #f6c76855}
  .copy p{margin:22px 0 0;font:400 34px/1.15 Gloock,serif;letter-spacing:-.02em}
  .copy small{display:block;margin-top:14px;font:500 30px/1.15 Caveat,cursive;color:#eab0bf}
  *{animation-play-state:paused!important;transition:none!important}
</style></head><body>
<div class="art">
  <svg class="paper" viewBox="0 0 1024 500" width="1024" height="500">${wallpaper}</svg>
  <div class="glow" style="left:470px;top:40px;width:520px;height:420px;background:radial-gradient(closest-side,#ffc87733,transparent)"></div>
  <div class="shelf"></div><div class="lip"></div><div class="front"></div><div class="under"></div>
  ${candle(420, 74)}${candle(450, 52)}${candle(988, 66)}
  ${[2, 1, 0].map(i => `<div class="shadow" style="right:${40 + 18 + i * 178}px"></div>`).join('')}
  <div class="cast" id="cast"></div>
  <div class="copy"><h1>Shelf <em>Life</em></h1><p>Small creatures.<br>Long memories.</p><small>Immortal. Unwashed. In arrears.</small></div>
</div>
<script type="module">
  import { ARRIVALS, arrivalDraft } from '/src/content/arrivals.js';
  import { renderPetSprite } from '/src/art/sprite.js';
  const cast = document.getElementById('cast');
  for (const arrival of ARRIVALS) {
    const who = document.createElement('div'); who.className = 'who';
    who.append(renderPetSprite({ id: 'store-' + arrival.id, art: { creature: arrivalDraft(arrival.id).creature } }));
    cast.append(who);
  }
  await document.fonts.ready;
  document.body.dataset.ready = '1';
</script></body></html>`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(ORIGIN + '/manifest.webmanifest')).ok) return; } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('The preview server did not start on port ' + PORT);
}

const server = spawn(process.execPath, ['test/serve.mjs'], { cwd: ROOT, env: { ...process.env, SHELF_PREVIEW_PORT: String(PORT) }, stdio: 'ignore' });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  await waitForServer();
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.route(ORIGIN + '/store-art.html', route => route.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.goto(ORIGIN + '/store-art.html');
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(300);
  await mkdir(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
  console.log(path.relative(ROOT, OUT) + '  1024x500');
} finally {
  await browser.close();
  server.kill();
}
