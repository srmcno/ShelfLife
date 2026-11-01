// Render a link preview using the game's own icon and bundled fonts.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { renameSync, statSync } from 'node:fs';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const icon = pathToFileURL(path.join(root, 'icons/icon.svg')).href;
const font = pathToFileURL(path.join(root, 'assets/fonts/gloock-400-normal.woff2')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.setContent(`<!doctype html><style>
@font-face{font-family:gloock;src:url('${font}')}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 75% 40%,#55335c,#211628 48%,#100b18);color:#f6e8d6;font-family:Georgia,serif}main{height:630px;display:flex;align-items:center;justify-content:space-between;padding:64px 100px}section{width:620px}.eyebrow{font:700 16px Arial;letter-spacing:.18em;text-transform:uppercase;color:#f1c471}h1{font:110px/1 gloock,Georgia;margin:24px 0}h1 em{color:#e6a36c;font-style:normal}p{font:27px/1.4 Georgia;margin:0;color:#dbcdbd}img{width:390px;height:390px;filter:drop-shadow(0 20px 25px #0009);border-radius:72px}
</style><main><section><div class="eyebrow">A creature care game</div><h1>Shelf<em>Life</em></h1><p>Small creatures. Long memories.<br>Make a home for the peculiar.</p></section><img src="${icon}" alt=""></main>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'icons/og-card.png') });
await browser.close();
const output = path.join(root, 'icons/og-card.png');
if (statSync(output).size > 250_000) {
  const compact = path.join(root, 'icons/og-card-compact.png');
  execFileSync('magick', [output, '-colors', '256', '-define', 'png:compression-level=9', 'PNG8:' + compact]);
  renameSync(compact, output);
}
if (statSync(output).size > 250_000) throw new Error('The link preview exceeds 250 KB.');
