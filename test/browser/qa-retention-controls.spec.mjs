import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { CURIOS } from '../../src/content/mayhem.js';
import { ALMANAC_CURIOS } from '../../src/content/almanac.js';
import { SEASONAL_CURIOS } from '../../src/content/seasons.js';
import { weekNumber, weeklyChallenges } from '../../src/engine/almanac.js';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });
const NOW = new Date('2026-10-19T20:00:00Z');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));

async function open(page, customize = () => {}, native = false) {
  const snapshot = householdFixture('established', NOW.getTime());
  snapshot.settings.theatreOn = false; snapshot.lastBackup = NOW.getTime();
  customize(snapshot);
  await page.clock.setFixedTime(NOW);
  if (native) await page.addInitScript(() => {
    // Simulated Capacitor notification plugin: tests never schedule real phone notifications.
    window.Capacitor = { Plugins: { LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }),
      requestPermissions: async () => ({ display: 'granted' }),
      cancel: async () => {}, schedule: async () => {}
    } } };
  });
  await page.addInitScript(snapshot => {
    if (!sessionStorage.getItem('qa-retention-fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      sessionStorage.setItem('qa-retention-fixture', '1');
    }
  }, snapshot);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}

for (const [kind, curio] of [['seasonal', SEASONAL_CURIOS[0]], ['edition', ALMANAC_CURIOS[0]]]) {
  test('the cabinet recognizes an inventory containing only a ' + kind + ' curio', async ({ page }) => {
    await open(page, snapshot => { snapshot.mayhem.curios = { [curio.id]: 1 }; });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:mayhem', { detail: { open: 'cabinet' } })));
    await expect(page.locator('#mayhemSheet')).toContainText(curio.name);
    await expect(page.locator('#mayhemSheet')).not.toContainText('Not one curio.');
  });
}

test('the cabinet still explains a genuinely empty inventory', async ({ page }) => {
  await open(page, snapshot => { snapshot.mayhem.curios = {}; });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:mayhem', { detail: { open: 'cabinet' } })));
  await expect(page.locator('#mayhemSheet')).toContainText('Not one curio.');
});

test('restoring a backup repaints nudge switches and the next tap changes the visible value', async ({ page }) => {
  await open(page, snapshot => { snapshot.settings.nudges = true; }, true);
  const more = () => page.locator('#tabMore, #moreBtn').filter({ visible: true }).first().click();
  await more();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  const restored = await saved(page);
  restored.settings.nudgeCats = { emergency: false, away: false, almanac: false, chest: true };
  await page.locator('#importFile').setInputFiles({ name: 'restored-shelf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) });
  await expect(page.locator('#restoreVeil')).toHaveClass(/open/);
  await page.locator('#restoreConfirm').click();
  await more();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#nudgeCats [data-nudge-cat="almanac"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#nudgeCats [data-nudge-cat="away"]').click();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).settings.nudgeCats.away).toBe(true);
  await page.keyboard.press('Escape');
  await page.reload();
  await more();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#nudgeCats [data-nudge-cat="almanac"]')).toHaveAttribute('aria-pressed', 'false');
});

for (const action of ['claim', 'claim-all']) {
  test(action + ' immediately shows a weekly challenge completed by the edition curio', async ({ page }) => {
    const challenge = weeklyChallenges(weekNumber(NOW.getTime())).find(item => item.kind === 'curio');
    await open(page, snapshot => { snapshot.mayhem.curios = Object.fromEntries(CURIOS.slice(0, challenge.need - 1).map(curio => [curio.id, 1])); });
    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      const { chapterAt, syncAlmanac, tierThresholds, weeklyChallenges, weekNumber } = await import('/src/engine/almanac.js');
      const chapter = chapterAt(), challenge = weeklyChallenges(weekNumber(Date.now())).find(item => item.kind === 'curio');
      state.almanac.init = 0; syncAlmanac(state);
      state.almanac.week.counts.curio = challenge.need - 1;
      state.almanac.chapters[chapter.key] = { xp: tierThresholds(chapter.days)[4], claimed: 15, badge: 0, spot: 0 };
      window.dispatchEvent(new CustomEvent('shelflife:almanac', { detail: { view: 'almanac' } }));
    });
    const selector = action === 'claim' ? '#almanacSheet .alm-section > .alm-track [data-alm="claim"][data-tier="5"]' : '#almanacSheet [data-alm="claim-all"]';
    const immediate = await page.locator(selector).evaluate((button, id) => {
      button.click();
      return !!document.querySelector('#almanacSheet [data-alm="weekly"][data-id="' + id + '"]');
    }, challenge.id);
    expect(immediate, 'the open sheet offers the weekly reward during the claim action').toBe(true);
    expect((await saved(page)).almanac.week.done).toContain(challenge.id);
    const before = (await saved(page)).almanac.stats.weekly;
    await page.locator('#almanacSheet [data-alm="weekly"][data-id="' + challenge.id + '"]').click();
    expect((await saved(page)).almanac.week.claimed).toContain(challenge.id);
    expect((await saved(page)).almanac.stats.weekly).toBe(before + 1);
    await page.keyboard.press('Escape');
    await page.reload();
    expect((await saved(page)).almanac.week.claimed).toContain(challenge.id);
  });
}
