import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test as base, expect } from 'playwright/test';
import { FRENZY_ITEMS } from '../../src/content/arcade.js';
import { firstStackDrop } from './support/stack.mjs';
import { resumeArcadeIfPaused, waitForArcadePlay } from './support/arcade.mjs';

const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'the whole first session has no browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ viewport: { width: 360, height: 640 } });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
const go = page => page.locator('#nextStep [data-ns-go]');
async function capture(page, testInfo, label) {
  // Optional local inspection artifacts; CI keeps its normal failure trace.
  const root = process.env.SHELF_WALKTHROUGH_SCREENSHOTS;
  if (!root) return;
  const directory = path.join(root, testInfo.project.name);
  await mkdir(directory, { recursive: true });
  await page.evaluate(async () => {
    const sheets = [...document.querySelectorAll('.veil.open .sheet, #moreTray.open')];
    await Promise.all(sheets.flatMap(sheet => sheet.getAnimations())
      .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
  });
  await page.screenshot({ path: path.join(directory, label + '.png') });
}

async function fits(page) {
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('.veil.open .sheet, #moreTray.open')].map(el => ({ width: el.clientWidth, content: el.scrollWidth }))
  }));
  expect(sizes.document, 'the 360px page stays within the viewport').toBeLessThanOrEqual(sizes.viewport + 1);
  for (const dialog of sizes.dialogs) expect(dialog.content, 'the open dialog has no horizontal overflow').toBeLessThanOrEqual(dialog.width + 1);
}
async function close(page, returnSelector) {
  await fits(page);
  // A native select keeps Escape for its own menu. Use the sheet's close
  // control, as a phone player does, and verify the exact return destination.
  const closeButton = page.locator('.veil.open .sheet-head button, #moreTray.open #moreClose').first();
  await closeButton.click();
  await expect(page.locator('.veil.open, #moreTray.open')).toHaveCount(0);
  await expect(page.locator(returnSelector)).toBeFocused();
  await fits(page);
}
async function more(page) {
  await page.locator('#tabMore').click();
  await expect(page.locator('#moreTray')).toHaveClass(/open/);
  await fits(page);
}
async function playroom(page) {
  await page.locator('#tabPlay').click();
  await expect(page.locator('#playroomVeil')).toHaveClass(/open/);
  await fits(page);
}

async function finishArcade(page, id, testInfo) {
  await playroom(page);
  await capture(page, testInfo, 'playroom');
  await page.locator('#playroomVeil [data-game="' + id + '"]').click();
  await fits(page);
  const before = (await saved(page)).arcade.plays[id] || 0;
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await waitForArcadePlay(page);
  await capture(page, testInfo, id + '-play');
  if (id === 'stack') {
    await firstStackDrop(page);
    await page.waitForFunction(() => {
      const r = document.getElementById('arcadeSheet').arcadeRun;
      if (!r) return true;
      if (r.paused) { r.field.querySelector('.ar-paused')?.click(); return false; }
      r.field.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      return r.game.over;
    }, null, { polling: 250 });
  } else if (id === 'seance') {
    // Observe the real memory sequence, then play one correct round. Later
    // wrong candle inputs end the game through its ordinary failure path.
    await page.waitForFunction(() => {
      const r = document.getElementById('arcadeSheet').arcadeRun;
      if (!r) return true;
      if (r.paused) { r.field.querySelector('.ar-paused')?.click(); return false; }
      if (r.game.phase !== 'input') return false;
      const g = r.game;
      const pad = g.rounds ? (g.seq[g.pos] + 1) % 4 : g.seq[g.pos];
      r.field.dispatchEvent(new KeyboardEvent('keydown', { key: String(pad + 1), bubbles: true }));
      return g.over;
    }, null, { polling: 'raf' });
  } else if (id === 'whack') {
    await page.waitForFunction(() => {
      const r = document.getElementById('arcadeSheet').arcadeRun;
      if (!r) return false;
      if (r.paused) { r.field.querySelector('.ar-paused')?.click(); return false; }
      const hole = r.game.holes.findIndex(h => h && ['hand', 'landlord', 'gold'].includes(h.kind));
      if (hole < 0) return false;
      r.field.dispatchEvent(new KeyboardEvent('keydown', { key: String(hole + 1), bubbles: true }));
      return r.game.score > 0;
    }, null, { polling: 'raf' });
    // Let the remaining hands escape: a real lost run must still be saved.
  } else {
    const good = Object.entries(FRENZY_ITEMS).filter(([, item]) => item.good).map(([key]) => key);
    await page.waitForFunction(good => {
      const r = document.getElementById('arcadeSheet').arcadeRun;
      if (!r) return true;
      if (r.paused) { r.field.querySelector('.ar-paused')?.click(); return false; }
      const g = r.game;
      // Move with the same arrow controls players use. Catch food first,
      // then holy water to finish; no scores, lives or clocks are rewritten.
      const target = g.items.filter(item => (g.score > 0 ? !good.includes(item.kind) : good.includes(item.kind)))
        .sort((a, b) => b.y - a.y)[0];
      if (target) {
        const key = target.x < g.x ? 'ArrowLeft' : 'ArrowRight';
        if (Math.abs(target.x - g.x) > .025) r.field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        else r.field.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      }
      return g.over;
    }, good, { polling: 'raf', timeout: 90_000 });
  }
  await expect.poll(async () => {
    await resumeArcadeIfPaused(page);
    return page.locator('#arcadeSheet .ar-over').isVisible();
  }, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await saved(page)).arcade.plays[id]).toBe(before + 1);
  expect((await saved(page)).arcade.best[id], id + ' earned a real positive score').toBeGreaterThan(0);
  await capture(page, testInfo, id + '-result');
  await close(page, '#tabPlay');
}

async function hearDocket(page, testInfo) {
  await playroom(page);
  await page.locator('#playroomVeil [data-court]').click();
  await expect(page.locator('#courtSheet .sc-docket')).toContainText('Today’s docket:');
  const before = (await saved(page)).courtroom.episodes;
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await capture(page, testInfo, 'court-hearing');
  // Advance dialogue using its actual click-to-finish/continue control. Every
  // question, interruption and ruling remains a real UI choice.
  await page.waitForFunction(() => {
    const sheet = document.getElementById('courtSheet');
    if (sheet.querySelector('.sc-wrap')) return true;
    const choice = sheet.querySelector('[data-sc-controls]:not([hidden]) [data-sc-choice]:not([disabled])');
    if (choice) choice.click();
    else sheet.querySelector('[data-sc-box]')?.click();
    return false;
  }, null, { polling: 50, timeout: 90_000 });
  await expect(page.locator('#courtSheet .sc-wrap')).toContainText('today’s docket');
  const after = await saved(page);
  expect(after.courtroom.episodes).toBe(before + 1);
  expect(after.courtroom.docketDay).not.toBe('');
  expect(after.pets[0].courtCases).toBe(1);
  await capture(page, testInfo, 'court-wrap');
  await close(page, '#tabPlay');
}

test('returning from an expedition to games preserves the original shelf launcher', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-arrival="mabel"]').click();
  await page.locator('#quickAdopt').click();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
  await playroom(page);
  await page.locator('#playroomVeil [data-activity="outing"]').click();
  await expect(page.locator('#lifeVeil')).toHaveClass(/open/);
  await page.locator('#lifeClose').click();
  await expect(page.locator('#playroomVeil')).toHaveClass(/open/);
  await expect(page.locator('#playroomVeil h2')).toBeFocused();
  await close(page, '#tabPlay');
});

test('a fresh player completes a first session, plays every game and keeps a usable backup at 360px', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  // October 29 naturally rolls the rounds/check chores. The clock continues
  // in real time so the shelf tick, countdown and game rules run normally.
  await page.clock.install({ time: new Date('2026-10-29T17:00:00Z') });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(0);
  await page.locator('[data-arrival="mabel"]').click();
  await page.locator('#quickAdopt').click();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
  await expect(go(page)).toHaveText('Say hello');
  await fits(page);
  await capture(page, testInfo, 'guide-shelf');
  await go(page).click();
  await capture(page, testInfo, 'resident-care');
  await page.locator('#cardVeil [data-care="food"]').click();
  await expect.poll(async () => (await saved(page)).life.guide.done).toEqual(['meet', 'feed']);
  await close(page, '#nextStepGo');
  await go(page).click();
  await page.locator('#mayhemSheet [data-choice="0"]').click();
  await expect(page.locator('#mayhemSheet .mh-stamp')).toBeVisible();
  await expect.poll(async () => (await saved(page)).mayhem.resolved).toBe(1);
  await capture(page, testInfo, 'emergency-outcome');
  await close(page, '#nextStepGo');
  await go(page).click();
  await page.locator('#mayhemSheet [data-mh="flip"]').click();
  await expect(page.locator('#mayhemSheet .mh-tarot.face')).toBeVisible();
  await capture(page, testInfo, 'omen');
  await close(page, '#nextStepGo');
  await go(page).click();
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'notes');
  await page.locator('#checkBtn').click();
  await page.locator('.tab[data-tab="shelf"]').click();
  await go(page).click();
  await page.locator('#mayhemSheet [data-mh="pry"]').click();
  await expect(page.locator('#mayhemSheet .mh-curio-card')).toBeVisible();
  await close(page, '#nextStepGo');
  await expect.poll(async () => (await saved(page)).life.guide.status).toBe('done');
  await go(page).click();
  await page.locator('#roundsBtn').click();
  const tour = await saved(page);
  expect(tour.life.guide.done).toEqual(['meet', 'feed', 'emergency', 'omen', 'note', 'coffin']);
  expect(tour.mayhem.chores.list.find(c => c.id === 'rounds').done).toBe(true);
  expect(tour.mayhem.chores.list.find(c => c.id === 'check').done).toBe(true);
  expect(tour.mayhem.coffins).toBe(1);
  expect(tour.notes.some(note => note.from === 'the incident report')).toBe(true);

  await page.locator('#soulsHud').click();
  const owned = Object.entries((await saved(page)).mayhem.curios).filter(([, count]) => count > 0).map(([id]) => id).sort();
  expect(owned.length, 'opening the first coffin earned an owned curio').toBeGreaterThan(0);
  const displayed = await page.locator('#mayhemSheet [data-curio], #mayhemSheet [data-col="curio"]').evaluateAll(items => items.map(item => item.dataset.curio || item.dataset.id).sort());
  expect(displayed, 'the cabinet shows the complete persisted inventory, including additional earned rewards').toEqual(owned);
  await capture(page, testInfo, 'cabinet');
  await close(page, '#soulsHud');
  await more(page);
  await page.locator('#almanacBtn').click();
  await expect(page.locator('#almanacSheet .alm-weekly')).toBeVisible();
  await capture(page, testInfo, 'almanac');
  await close(page, '#tabMore');
  for (const game of ['stack', 'seance', 'whack', 'frenzy']) await finishArcade(page, game, testInfo);
  await hearDocket(page, testInfo);
  await playroom(page);
  await page.locator('#playroomVeil [data-activity="outing"]').click();
  await page.locator('[data-life="set-out"]').click();
  await expect(page.locator('[data-life="outing-choice"]')).toHaveCount(3);
  await page.locator('[data-life="outing-choice"]').first().click();
  await expect.poll(async () => (await saved(page)).life.outing.step).toBe(1);
  await capture(page, testInfo, 'expedition');
  await fits(page);
  await page.locator('#lifeClose').click();
  await expect(page.locator('#lifeVeil')).not.toHaveClass(/open/);
  // Expeditions deliberately return to the game chooser before the shelf.
  await expect(page.locator('#playroomVeil')).toHaveClass(/open/);
  expect(await page.evaluate(() => !!document.activeElement?.closest('#playroomVeil'))).toBe(true);
  await close(page, '#tabPlay');
  await more(page);
  await page.locator('#decorBtn').click();
  await page.locator('#roomOpts [data-decor-value="parlor"]').click();
  await expect.poll(async () => (await saved(page)).decor.room).toBe('parlor');
  await capture(page, testInfo, 'decor');
  await close(page, '#tabMore');
  await more(page);
  await page.locator('#effectsMode').selectOption('light');
  await page.locator('#calmBtn').click();
  await expect(page.locator('#calmBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveClass(/calm/);
  await fits(page);
  await capture(page, testInfo, 'more-calm');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadEvent;
  const path = testInfo.outputPath('first-session-backup.json');
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  const completed = await saved(page);
  expect(backup.pets).toEqual(completed.pets);
  expect(backup.life.guide).toEqual(completed.life.guide);
  expect(backup.arcade).toEqual(completed.arcade);
  expect(backup.courtroom).toEqual(completed.courtroom);
  expect(backup.life.outing).toEqual(completed.life.outing);
  expect(backup.settings.calm).toBe(true);
  expect(completed.lastBackup).toBe(backup.lastBackup);
  await expect(page.locator('.veil.open, #moreTray.open')).toHaveCount(0);
  await expect(page.locator('#tabMore')).toBeFocused();
  await page.reload();
  const restored = await saved(page);
  expect(restored.life.guide).toEqual(backup.life.guide);
  expect(restored.arcade).toEqual(backup.arcade);
  expect(restored.life.outing).toEqual(backup.life.outing);
  await expect(page.locator('body')).toHaveClass(/calm/);
  await fits(page);
});
