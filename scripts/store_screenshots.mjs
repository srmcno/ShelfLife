// Renders the Google Play phone screenshots into store/screenshots/.
//
//   node scripts/store_screenshots.mjs
//
// A synthetic household (test/household-fixtures.mjs), a fixed afternoon and
// a seeded Math.random, so the same commit gives the same pictures. Each is
// 1080 x 1920: 9:16 portrait, which Play accepts for phones (the long side
// may be at most twice the short one) and prefers for featured games.
// It starts the local preview server on SHELF_PREVIEW_PORT (default 4193).
// Set CHROMIUM_PATH to use a specific browser.
import { spawn } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { householdFixture } from '../test/household-fixtures.mjs';
import { CURIOS } from '../src/content/mayhem.js';
import { localDayKey } from '../src/state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'store', 'screenshots');
const PORT = Number(process.env.SHELF_PREVIEW_PORT || 4193);
const ORIGIN = `http://localhost:${PORT}`;
// 405 x 720 CSS pixels at 8/3 is exactly 1080 x 1920 device pixels.
const PHONE = { viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, isMobile: true, hasTouch: true };
// A Saturday afternoon outside the Thin Season, so nobody is asleep and the room is lit.
const NOW = Date.parse('2026-09-12T15:30:00+01:00');
const TIMEZONE = 'Europe/London';

function household({ omenRead = false } = {}) {
  const s = householdFixture('nearly-full', NOW);
  const keep = s.pets.slice(0, 9);
  s.pets = keep;
  s.slots = Array(18).fill(null);
  // Residents along the planks with furniture among them, as a lived-in shelf looks.
  const layout = [0, 1, 2, 4, 5, 6, 8, 9, 11];
  keep.forEach((p, i) => { s.slots[layout[i]] = p.id; p.needs = { food: 62 + i * 3, fuss: 48 + i * 4, clean: 70 - i * 2 }; });
  s.props.forEach((p, i) => { s.slots[[3, 7, 10][i]] = p.id; });
  s.settings.theatreOn = false;
  s.settings.muted = true;
  s.lastBackup = NOW;
  s.mayhem = {
    souls: 240, lifetime: 1180, resolved: 57, coffins: 14, nextAt: NOW + 600000, serial: 60,
    curios: Object.fromEntries(CURIOS.filter((_, i) => i % 2 === 0).slice(0, 15).map(c => [c.id, 1])),
    queue: [{ uid: 59, id: 'ouija', a: keep[1].id, at: NOW - 240000 }, { uid: 60, id: 'rat-poison', a: keep[3].id, at: NOW - 60000 }]
  };
  // With tonight's omen already turned over, the strip above the shelf leads to the emergency.
  if (omenRead) { const day = localDayKey(NOW); s.mayhem.omen = { day, id: 'wet-hand', streak: 3, lastDay: day, grace: 1 }; }
  return s;
}

function seededRandom() {
  // Mulberry32: the studio, the postcard and the notes all draw from Math.random.
  let seed = 0x5eed1e;
  Math.random = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const server = spawn(process.execPath, ['test/serve.mjs'], { cwd: ROOT, env: { ...process.env, SHELF_PREVIEW_PORT: String(PORT) }, stdio: 'ignore' });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const shots = [];

async function fresh(options) {
  const context = await browser.newContext({ ...PHONE, timezoneId: TIMEZONE, locale: 'en-GB', serviceWorkers: 'block', reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(seededRandom);
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('store.fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('store.fixture', '1'); } }, household(options));
  for (let tries = 0; ; tries++) {
    try { await page.goto(ORIGIN + '/'); break; } catch (error) { if (tries > 20) throw error; await page.waitForTimeout(250); }
  }
  await page.locator('#cabinet .piece.pet').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  return { page, close: () => context.close() };
}
// PNG (RGB, no alpha) unless that comes out over 1 MB, when a JPEG keeps the
// repository light. Play accepts either.
const LIMIT = 1024 * 1024;
async function shoot(page, name) {
  await page.waitForTimeout(700);
  let file = path.join(OUT, name + '.png');
  await rm(path.join(OUT, name + '.jpg'), { force: true });
  await page.screenshot({ path: file, animations: 'allow' });
  if ((await stat(file)).size > LIMIT) {
    await rm(file);
    file = path.join(OUT, name + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: 90, animations: 'allow' });
  }
  shots.push(file);
}
const playroom = page => page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();

try {
  await mkdir(OUT, { recursive: true });

  // 1. The shelf, with two things already gone wrong.
  let { page, close } = await fresh();
  await shoot(page, '01-shelf');
  await close();

  // 2. An emergency card.
  ({ page, close } = await fresh({ omenRead: true }));
  await page.locator('#mayhemAlert [data-mh="emergency"]').first().click();
  await page.locator('#mayhemSheet .mh-title').waitFor();
  await shoot(page, '02-emergency');
  await close();

  // 3. A coffin, prised open.
  ({ page, close } = await fresh());
  await page.locator('#mayhemDesk [data-mh="coffin"]').click();
  await page.locator('#mayhemSheet [data-mh="pry"]').click();
  await page.locator('#mayhemSheet .mh-curio-card').waitFor();
  await shoot(page, '03-coffin');

  // 4. The Cabinet of Curiosities.
  await page.locator('#mayhemSheet [data-mh="cabinet"]').first().click();
  await page.locator('#mayhemSheet .mh-rank-card').waitFor();
  await shoot(page, '04-cabinet');
  await close();

  // 5. Shelf Court opens on the day's docket.
  ({ page, close } = await fresh());
  await playroom(page);
  await page.locator('#playroomVeil [data-court]').click();
  await page.locator('#courtVeil .sc-docket').waitFor();
  await shoot(page, '05-docket');

  // 6. Shelf Court, mid-episode, with the jury in.
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await page.locator('#courtSheet .sc-stage').waitFor();
  await page.evaluate(async () => {
    const sheet = document.getElementById('courtSheet');
    for (let n = 0; n < 400; n++) {
      const controls = sheet.querySelector('[data-sc-controls]:not([hidden])');
      if (controls?.querySelector('[data-sc-choice]')) return;
      sheet.querySelector('[data-sc-box]')?.click();
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  });
  await page.locator('#courtSheet [data-sc-controls]:not([hidden]) [data-sc-choice]').first().click();
  await page.waitForTimeout(1600);
  await shoot(page, '06-court');
  await close();

  // 7. Grave Whack, a few seconds in, with hands coming up.
  ({ page, close } = await fresh());
  await playroom(page);
  await page.locator('[data-game="whack"]').click();
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await page.locator('#arcadeSheet .ar-grave').first().waitFor();
  await page.evaluate(async () => {
    // Push the dead back down for a while; never tap the widow.
    const until = performance.now() + 5000;
    while (performance.now() < until) {
      document.querySelector('#arcadeSheet .ar-grave.up[data-kind="hand"], #arcadeSheet .ar-grave.up[data-kind="landlord"]')
        ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 260));
    }
  });
  await page.locator('#arcadeSheet .ar-grave.up').first().waitFor();
  await shoot(page, '07-arcade');
  await close();

  // 8. The creature studio.
  ({ page, close } = await fresh());
  await page.locator('#newPetBtn').click();
  await page.locator('#studioVeil.open #genMount svg').first().waitFor();
  // Past the step header, so the creature and the parts to change fill the frame.
  await page.evaluate(() => {
    const sheet = document.querySelector('#studioVeil .sheet-studio');
    const head = sheet.querySelector('.sheet-head').getBoundingClientRect().bottom;
    sheet.scrollTop += document.querySelector('#studioVeil .gen-stage').getBoundingClientRect().top - head - 14;
  });
  await shoot(page, '08-studio');
  await close();

  for (const file of shots) console.log(path.relative(ROOT, file) + '  ' + Math.round((await stat(file)).size / 1024) + ' KB');
} finally {
  await browser.close();
  server.kill();
}
