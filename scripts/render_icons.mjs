// Renders every app icon from the three layered sources in icons/src.
//
//   node scripts/render_icons.mjs
//
// The sources are Android adaptive-icon layers on a 108dp canvas (432 units,
// 4 per dp). Launchers show the middle 72dp (units 72 to 360) through their
// own mask; the resident and candle stay inside the 66dp safe circle. Web,
// store and legacy icons are crops of the same two layers, so they cannot
// drift apart. When a Capacitor android/ project exists, its launcher
// resources are written too. Set CHROMIUM_PATH to use a specific browser.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'icons', 'src');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const VIEWPORT = { x: 72, y: 72, size: 288 };       // what a launcher shows
const MASKABLE = { x: 41, y: 41, size: 350 };       // ears stay inside the 80% maskable circle
const CANVAS = { x: 0, y: 0, size: 432 };
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const inner = svg => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const layers = Object.fromEntries(await Promise.all(['background', 'foreground', 'monochrome']
  .map(async name => [name, inner(await readFile(path.join(SRC, name + '.svg'), 'utf8'))])));

// shape: 'square' (full bleed), 'rounded' (transparent corners), 'circle'
function compose({ x, y, size }, shape = 'square', parts = ['background', 'foreground']) {
  const radius = shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.22 : 0;
  const clip = radius ? `<defs><clipPath id="icon-shape"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}"/></clipPath></defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}">${clip}` +
    `<g${radius ? ' clip-path="url(#icon-shape)"' : ''}>${parts.map(part => layers[part]).join('')}</g></svg>`;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
async function png(file, svg, pixels) {
  await page.setViewportSize({ width: pixels, height: pixels });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">` +
    svg.replace('<svg ', `<svg width="${pixels}" height="${pixels}" style="display:block" `) + '</body></html>');
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: pixels, height: pixels } });
  console.log(path.relative(ROOT, file) + '  ' + pixels + 'px');
}

try {
  // The web favicon and "any" icons: rounded square with transparent corners.
  await writeFile(path.join(ROOT, 'icons', 'icon.svg'), compose(VIEWPORT, 'rounded') + '\n');
  for (const pixels of [192, 512]) await png(path.join(ROOT, 'icons', `icon-${pixels}.png`), compose(VIEWPORT, 'rounded'), pixels);
  // PWA maskable: full bleed, with the resident inside the 80% safe circle.
  for (const pixels of [192, 512]) await png(path.join(ROOT, 'icons', `icon-maskable-${pixels}.png`), compose(MASKABLE), pixels);
  // Apple touch icon: iOS rounds the corners itself.
  await png(path.join(ROOT, 'icons', 'icon-180.png'), compose(VIEWPORT), 180);
  // Google Play listing icon: 512 square, Play applies its own mask.
  await png(path.join(ROOT, 'store', 'play-icon-512.png'), compose(VIEWPORT), 512);

  if (existsSync(RES)) {
    for (const [density, scale] of Object.entries(DENSITIES)) {
      const dir = path.join(RES, 'mipmap-' + density), layer = Math.round(108 * scale), legacy = Math.round(48 * scale);
      await png(path.join(dir, 'ic_launcher_background.png'), compose(CANVAS, 'square', ['background']), layer);
      await png(path.join(dir, 'ic_launcher_foreground.png'), compose(CANVAS, 'square', ['foreground']), layer);
      await png(path.join(dir, 'ic_launcher_monochrome.png'), compose(CANVAS, 'square', ['monochrome']), layer);
      await png(path.join(dir, 'ic_launcher.png'), compose(VIEWPORT, 'rounded'), legacy);
      await png(path.join(dir, 'ic_launcher_round.png'), compose(VIEWPORT, 'circle'), legacy);
    }
    const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
      '    <background android:drawable="@mipmap/ic_launcher_background"/>\n' +
      '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n' +
      '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n' +
      '</adaptive-icon>\n';
    await mkdir(path.join(RES, 'mipmap-anydpi-v26'), { recursive: true });
    for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      await writeFile(path.join(RES, 'mipmap-anydpi-v26', name), adaptive);
      console.log(path.relative(ROOT, path.join(RES, 'mipmap-anydpi-v26', name)));
    }
  } else {
    console.log('No android/ project yet: skipped launcher resources.');
  }
} finally {
  await browser.close();
}
