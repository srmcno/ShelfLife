import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

const SAVE_KEY = 'shelflife.v4';

test('a pair subplot has a playable final scene and survives reload', async ({ page }, info) => {
  const state = householdFixture('established');
  const now = Date.now();
  state.settings.theatreOn = false;
  state.lastBackup = now;
  state.friction = {};
  state.theatre.lastAt = 0;
  state.theatre.pairs = {};
  state.stories.lastRelations = now;
  state.stories.relationships['qa0|qa1'].saga = {
    style: 'bureau',
    beats: [
      { at: now - 120000, text: 'Agnes and Lord Dampington III opened a missing-crumbs office.' },
      { at: now - 60000, text: 'Agnes and Lord Dampington III finished an inquest together.' }
    ]
  };
  await page.addInitScript(({ save, key }) => {
    if (!sessionStorage.getItem('pair-saga-fixture')) {
      localStorage.setItem(key, JSON.stringify(save));
      sessionStorage.setItem('pair-saga-fixture', '1');
    }
  }, { save: state, key: SAVE_KEY });
  const errors = [];
  const fonts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.url().endsWith('.woff2')) fonts.push(response.status()); });

  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(state.pets.length);
  await page.locator('#cabinet .piece.pet').first().click();
  const dossier = page.locator('.pair-saga').first();
  await expect(dossier).toContainText('The Department of Missing Crumbs');
  await expect(dossier).toContainText('2 / 3');
  await dossier.locator('[data-pair-scene]').click();
  await expect.poll(() => page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved.stories.relationships['qa0|qa1'].saga.beats.length;
  }, SAVE_KEY)).toBe(3);

  await page.reload();
  await page.locator('#cabinet .piece.pet').first().click();
  await expect(page.locator('.pair-saga').first()).toContainText('3 / 3');
  await expect(page.locator('.pair-saga').first()).toContainText('The pardon');
  if (info.project.name !== 'desktop-chromium') await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('.pair-saga').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/pair-sagas-${info.project.name}.png`, fullPage: true });
  await page.locator('.pair-saga').first().screenshot({ path: `test-results/pair-saga-card-${info.project.name}.png` });
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.some(status => status === 200)).toBe(true);
  expect(errors).toEqual([]);
});

test('a pair scene on cooldown keeps the dossier open with a useful message', async ({ page }) => {
  const state = householdFixture('established');
  const now = Date.now();
  state.settings.theatreOn = false;
  state.lastBackup = now;
  state.friction = {};
  state.theatre.lastAt = now;
  state.stories.lastRelations = now;
  state.stories.relationships['qa0|qa1'].saga = {
    style: 'bureau', beats: [
      { at: now - 120000, text: 'The department opened.' },
      { at: now - 60000, text: 'The inquest was filed.' }
    ]
  };
  await page.addInitScript(({ save, key }) => localStorage.setItem(key, JSON.stringify(save)), { save: state, key: SAVE_KEY });
  await page.goto('/');
  await page.locator('#cabinet .piece.pet').first().click();
  await page.locator('.pair-saga [data-pair-scene]').click();
  await expect(page.locator('#cardVeil')).toBeVisible();
  await expect(page.locator('#toast')).toContainText(/seconds to finish/i);
});
