import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { dailyChallenge } from '../../src/engine/daily.js';
import { weekNumber, weeklyChallenges } from '../../src/engine/almanac.js';
import { ALMANAC_CURIOS } from '../../src/content/almanac.js';

/* Regressions for the open review findings on the last pull request: each one
   is driven the way a player (or a restore) would reach it. */

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 90_000 });

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
function household(kind = 'established', now = Date.now()) {
  const s = householdFixture(kind, now);
  s.settings.theatreOn = false; s.lastBackup = now;
  return s;
}
async function open(page, s, { init = null, config = null, cloud = null } = {}) {
  if (init) await page.addInitScript(init);
  await page.addInitScript(({ snapshot, config, cloud }) => {
    if (config) globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('qa-fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      if (cloud) localStorage.setItem('shelflife.cloud', cloud);
      sessionStorage.setItem('qa-fixture', '1');
    }
  }, { snapshot: s, config, cloud });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
const more = page => page.locator('#tabMore:visible, #moreBtn:visible').first();
// Restore a backup through the real file picker and the confirm sheet.
async function restore(page, snapshot) {
  await page.locator('#importFile').setInputFiles({ name: 'shelf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  await expect(page.locator('#restoreVeil')).toHaveClass(/open/);
  await page.locator('#restoreConfirm').click();
  await expect(page.locator('#restoreVeil')).not.toHaveClass(/open/);
}
const run = page => page.evaluate(() => { const r = document.getElementById('arcadeSheet').arcadeRun; return r ? { phase: r.phase, combo: r.game.combo, score: r.game.score } : null; });
async function startRun(page, game, { daily = false } = {}) {
  await page.evaluate(g => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: g, petId: 'qa0' } })), game);
  await page.locator('#arcadeSheet [data-ar="' + (daily ? 'challenge' : 'play') + '"]').click();
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  await page.evaluate(() => { const r = document.getElementById('arcadeSheet').arcadeRun; r.gov.push = () => null; r.readyLen = 0.01; });
  await expect.poll(async () => (await run(page))?.phase, { timeout: 20000 }).toBe('play');
}
function todayKey() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day);
}

test('a cabinet holding only an Almanac curio does not claim to be empty', async ({ page }) => {
  const s = household();
  s.mayhem = { souls: 10, lifetime: 10, nextAt: Date.now() + 600000, curios: { [ALMANAC_CURIOS[0].id]: 1 } };
  await open(page, s);
  await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
  await expect(page.locator('#mayhemSheet .col-edition-item')).toHaveCount(1);
  await expect(page.locator('#mayhemSheet .fx-empty-cabinet')).toHaveCount(0);
});

test('restoring a backup repaints the nudge switches and the haptics switch', async ({ page }) => {
  const s = household();
  s.settings.nudges = true; s.settings.nudgeAsked = true; s.settings.haptics = true;
  s.settings.nudgeCats = { emergency: true, away: true, almanac: true, chest: true };
  await open(page, s, { init: () => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
    window.Capacitor = { Plugins: { LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
      cancel: async () => {}, schedule: async () => {} } } };
  } });
  await more(page).click();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hapticsBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  const backup = household();
  backup.settings.nudges = true; backup.settings.nudgeAsked = true; backup.settings.haptics = false;
  backup.settings.nudgeCats = { emergency: true, away: false, almanac: false, chest: true };
  await restore(page, backup);
  await more(page).click();
  // The switches show the restored save, so a tap does what it says.
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#nudgeCats [data-nudge-cat="almanac"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#hapticsBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#hapticsBtn span')).toHaveText('Haptics off');
  await page.locator('#nudgeCats [data-nudge-cat="away"]').click();
  await expect.poll(async () => (await saved(page)).settings.nudgeCats.away).toBe(true);
  expect((await saved(page)).settings.nudgeCats.almanac).toBe(false);
  await page.locator('#hapticsBtn').click();
  await expect.poll(async () => (await saved(page)).settings.haptics).toBe(true);
});

test('number keys skip a flooded grave just as taps do, so the combo survives', async ({ page }) => {
  await open(page, household());
  await startRun(page, 'whack');
  await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.mod = { ...(g.mod || {}), blocked: [0, 2, 6, 8] }; g.combo = 6; g.holes = g.holes.map(() => null); });
  for (const key of ['1', '3', '7', '9']) await page.keyboard.press(key);
  expect((await run(page)).combo).toBe(6);
  // An open grave with nothing in it is still a miss (emptied and pressed in one go, before a hand can rise).
  const combo = await page.evaluate(() => {
    const g = document.getElementById('arcadeSheet').arcadeRun.game; g.holes[4] = null;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
    return g.combo;
  });
  expect(combo).toBe(0);
  await page.locator('#arcadeSheet [data-ar="close"]').click();
});

test('the effects canvas drops to the lower resolution when the governor lowers the level', async ({ page }) => {
  await open(page, household());
  const sizes = await page.evaluate(async () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => 3 });
    const { createFx, FX_CAPS } = await import('./src/ui/arcade-fx.js');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:100px'; document.body.appendChild(host);
    const fx = createFx(host, { level: 0 });
    fx.resize(200, 100);
    const canvas = host.querySelector('canvas'), out = { caps: FX_CAPS.map(c => c.dpr), before: canvas.width };
    fx.setLevel(1);
    out.after = canvas.width; out.afterH = canvas.height;
    fx.destroy(); host.remove();
    return out;
  });
  expect(sizes.before).toBe(200 * Math.min(3, sizes.caps[0]));
  expect(sizes.after).toBe(200 * Math.min(3, sizes.caps[1]));
  expect(sizes.afterH).toBe(100 * Math.min(3, sizes.caps[1]));
});

test('closing the arcade during the death beat still posts today’s challenge score', async ({ page }) => {
  const fake = createFakeSupabase();
  const me = await socialPlayer(fake, 'Ada');
  await page.route(fake.url + '/**', route => fake.route(route));
  const ch = dailyChallenge(todayKey());
  await open(page, household(), { config: fake.config, cloud: JSON.stringify({ session: me.session, socialUser: me.id }) });
  await startRun(page, ch.game, { daily: true });
  fake.requests.length = 0;
  // The run ends and the player closes the sheet before the result card appears.
  const closedIn = await page.evaluate(() => new Promise(done => {
    const sheet = document.getElementById('arcadeSheet'), r = sheet.arcadeRun;
    r.game.score = 17; r.game.over = true;
    const wait = () => {
      const now = sheet.arcadeRun;
      if (now?.phase === 'dying') { sheet.querySelector('[data-ar="close"]').click(); done('dying'); }
      else if (!now) done('gone'); else requestAnimationFrame(wait);
    };
    wait();
  }));
  expect(closedIn).toBe('dying');
  await expect(page.locator('#arcadeVeil')).not.toHaveClass(/open/);
  await expect.poll(() => fake.requests.filter(r => r.path === '/rest/v1/rpc/submit_score').length).toBe(1);
  const body = JSON.parse(fake.requests.find(r => r.path === '/rest/v1/rpc/submit_score').body);
  expect(body.p_game).toBe(ch.game);
  expect(body.p_score).toBe(17);
  expect((await saved(page)).arcade.daily.best).toBe(17);
});

test('claiming an Almanac curio that finishes a weekly curio challenge shows it done at once', async ({ page }) => {
  const when = new Date('2026-10-20T20:00:00Z');   // inside The Thin Season, a week that asks for new curios
  const wk = weekNumber(when.getTime()), challenge = weeklyChallenges(wk).find(c => c.kind === 'curio');
  expect(challenge, 'this week has a curio challenge').toBeTruthy();
  const s = household('veteran', when.getTime()); s.life.introDone = true;
  s.almanac.week = { no: wk, counts: { curio: challenge.need - 1 }, done: [], claimed: [], chest: 0 };
  await page.clock.setFixedTime(when);
  await open(page, s);
  await page.locator('#mayhemDesk .alm-tile').click();
  await expect(page.locator('#almanacVeil')).toHaveClass(/open/);
  await expect(page.locator('#almanacSheet .alm-weekly-row', { hasText: challenge.label })).toContainText((challenge.need - 1) + '/' + challenge.need);
  await page.locator('#almanacSheet [data-alm="claim-all"]').click();
  await expect(page.locator('#almanacSheet .alm-result')).toContainText('Just collected');
  // No reopen: the row is ready to collect on the sheet that is already showing.
  await expect(page.locator('#almanacSheet .alm-weekly-row', { hasText: challenge.label }).locator('[data-alm="weekly"]')).toBeVisible();
});
