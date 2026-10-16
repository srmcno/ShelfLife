import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { dailyChallenge } from '../../src/engine/daily.js';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });
test.use({ serviceWorkers: 'block' });
const KEY = 'shelflife.v4';
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
function challengeDate(game, mod) {
  for (let day = 1; day <= 48; day++) {
    const time = Date.UTC(2026, 9, day, 18), d = new Date(time);
    const challenge = dailyChallenge(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
    if (challenge.game === game && (!mod || challenge.mod.id === mod)) return time;
  }
  throw new Error('No challenge date for ' + game + ':' + mod);
}
async function household(page, time = Date.UTC(2026, 9, 11, 18), fake = null, player = null) {
  await page.clock.install({ time });
  const fixture = householdFixture('established', time);
  fixture.settings.theatreOn = false;
  fixture.lastBackup = time;
  await page.addInitScript(({ fixture, config, session, user }) => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
    if (config) globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('qa-arcade-edges-fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(fixture));
      if (session) localStorage.setItem('shelflife.cloud', JSON.stringify({ session, socialUser: user }));
      sessionStorage.setItem('qa-arcade-edges-fixture', '1');
    }
  }, { fixture, config: fake?.config, session: player?.session, user: player?.id });
  if (fake) await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(fixture.pets.length);
  return fixture;
}
async function startDaily(page, game) {
  await page.evaluate(game => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game, petId: 'qa0' } })), game);
  await page.locator('#arcadeSheet [data-ar="challenge"]').click();
  await page.evaluate(() => { const run = document.getElementById('arcadeSheet').arcadeRun; run.readyLen = .01; run.gov.push = () => null; });
  await expect.poll(() => page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun?.phase)).toBe('play');
}

test('restoring a backup repaints haptics before the next toggle and saves the new value', async ({ page }) => {
  const fixture = await household(page);
  await expect(page.locator('#hapticsBtn')).toHaveAttribute('aria-pressed', 'true');
  fixture.settings.haptics = false;
  await page.locator('#importFile').setInputFiles({ name: 'haptics-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.locator('#restoreVeil')).toBeVisible();
  await page.locator('#restoreConfirm').click();
  await expect(page.locator('#hapticsBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#hapticsBtn span')).toHaveText('Haptics off');
  expect((await saved(page)).settings.haptics).toBe(false);
  await page.locator('#tabMore').click();
  await page.locator('#hapticsBtn').click();
  await expect(page.locator('#hapticsBtn')).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).settings.haptics).toBe(true);
  await page.reload();
  await expect(page.locator('#hapticsBtn')).toHaveAttribute('aria-pressed', 'true');
});

test('flooded Grave Whack corners ignore number keys without breaking a scored combo', async ({ page }) => {
  await household(page, challengeDate('whack', 'flooded'));
  await startDaily(page, 'whack');
  // A labelled late-game fixture keeps actual keyboard and pointer handlers under test.
  await page.evaluate(() => {
    const g = document.getElementById('arcadeSheet').arcadeRun.game;
    g.holes.fill(null); g.spawnIn = 1000; g.combo = 4; g.score = 4;
    g.holes[4] = { kind: 'hand', age: 0, life: 1000, serial: ++g.serial };
  });
  await expect(page.locator('#arcadeSheet [data-hole="0"]')).toHaveAttribute('aria-disabled', 'true');
  for (const key of ['1', '3', '7', '9']) await page.keyboard.press(key);
  const corner = await page.locator('#arcadeSheet [data-hole="0"]').boundingBox();
  await page.mouse.click(corner.x + corner.width / 2, corner.y + corner.height / 2);
  expect(await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; return [g.combo, g.score, g.hits]; })).toEqual([4, 4, 0]);
  await page.keyboard.press('5');
  expect(await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; return [g.combo, g.hits]; })).toEqual([5, 1]);
  // Empty available graves still break a combo, as intended.
  await page.keyboard.press('2');
  expect(await page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun.game.combo)).toBe(0);
});

async function socialGame(page) {
  const time = challengeDate('stack'), fake = createFakeSupabase({ now: () => time });
  const player = await socialPlayer(fake, 'Ada', { pets: [] }, { now: () => time });
  await household(page, time, fake, player);
  await startDaily(page, 'stack');
  return { fake, player };
}
async function closeDuringDeath(page, score) {
  // Set up a finalized late game; the actual frame starts death and the real
  // Close handler must settle it before its result-card timer can fire.
  await page.evaluate(score => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.score = score; g.over = true; }, score);
  await page.waitForFunction(() => {
    const run = document.getElementById('arcadeSheet').arcadeRun;
    if (run?.phase !== 'dying') return false;
    document.querySelector('#arcadeSheet [data-ar="close"]').click();
    return true;
  }, null, { polling: 'raf' });
  await expect(page.locator('#arcadeVeil')).not.toBeVisible();
}
const submissions = fake => fake.requests.filter(request => request.path === '/rest/v1/rpc/submit_score');

test('closing during death persists and submits a scoring daily run exactly once', async ({ page }) => {
  const { fake, player } = await socialGame(page);
  await closeDuringDeath(page, 5);
  await expect.poll(() => [...fake.social.scores.values()].find(row => row.user_id === player.id)?.score).toBe(5);
  const state = await saved(page);
  expect(state.arcade.daily.best).toBe(5);
  expect(state.arcade.daily.plays).toBe(1);
  expect(state.pets[0].arcadeRuns).toBe(1);
  await page.waitForTimeout(1100);
  expect(submissions(fake)).toHaveLength(1);
  expect((await saved(page)).arcade.daily.plays).toBe(1);
});

test('closing a zero-score death submits no score and advances no lifetime runs', async ({ page }) => {
  const { fake } = await socialGame(page);
  await closeDuringDeath(page, 0);
  await page.waitForTimeout(1100);
  expect(submissions(fake)).toHaveLength(0);
  expect((await saved(page)).arcade.runs).toBe(0);
});

test('a run started on one social account cannot submit for a replacement account', async ({ page }) => {
  const { fake, player } = await socialGame(page);
  const replacement = await page.evaluate(async () => {
    const { cloud, social } = await import('/src/cloud/index.js');
    await cloud.signOut(); await cloud.signInAnonymously(); social.optIn();
    return cloud.userId();
  });
  expect(replacement).not.toBe(player.id);
  await closeDuringDeath(page, 5);
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: 'stack' } })));
  await expect(page.locator('#arcadeSheet [data-ar-board]')).not.toContainText('Asking the neighbours.');
  expect(submissions(fake)).toHaveLength(0);
  expect([...fake.social.scores.values()]).toHaveLength(0);
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await startDaily(page, 'stack'); await closeDuringDeath(page, 3);
  await expect.poll(() => [...fake.social.scores.values()].find(row => row.user_id === replacement)?.score).toBe(3);
  expect((await saved(page)).arcade.daily.best).toBe(5, 'the shared shelf best is not submission authority for the new account');
});

base('a failed daily score submission retries only for its owner after reload', async ({ page, browserName }) => {
  // One deliberately failed transport request is expected in this regression.
  // Assert it explicitly rather than treating its browser diagnostic as an app error.
  const appErrors = [], failedRequests = [], consoleErrors = [];
  page.on('pageerror', error => appErrors.push(error.message));
  // A request still in flight when the page reloads is cancelled by the browser
  // (net::ERR_ABORTED) and simply made again; only real transport failures count.
  page.on('requestfailed', request => { if (!/ERR_ABORTED|cancelled/i.test(request.failure()?.errorText || '')) failedRequests.push(request.url()); });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const { fake, player } = await socialGame(page); let failed = false;
  await page.route(fake.url + '/rest/v1/rpc/submit_score', route => {
    if (!failed) { failed = true; return route.abort('failed'); }
    return fake.route(route);
  });
  await closeDuringDeath(page, 5);
  await expect.poll(() => failedRequests.length).toBe(1);
  expect(fake.social.scores.size).toBe(0);
  expect((await saved(page)).arcade.daily.submission).toEqual({ user: player.id, score: 5, pending: true });
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: 'stack' } })));
  await expect.poll(() => [...fake.social.scores.values()].find(row => row.user_id === player.id)?.score).toBe(5);
  await expect.poll(async () => (await saved(page)).arcade.daily.submission.pending).toBe(false);
  expect(failedRequests).toEqual([fake.url + '/rest/v1/rpc/submit_score']);
  // Chromium logs an aborted fetch; WebKit reports it through requestfailed only.
  expect(consoleErrors).toEqual(browserName === 'webkit' ? [] : [expect.stringMatching(/Failed to load resource|Load failed/)]);
  expect(appErrors).toEqual([]);
});
