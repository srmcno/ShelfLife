import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

async function open(page) {
  const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now();
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('back-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('back-fixture', '1'); } }, s);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
const launcher = page => page.locator('#playroomBtn:visible, #tabPlay:visible').first();
const openSheets = page => page.locator('.veil.open');

test('Back closes the open sheet and the game stays on the page', async ({ page }) => {
  await open(page);
  const url = page.url();
  await launcher(page).click();
  await expect(page.locator('#playroomVeil')).toBeVisible();
  expect(await page.evaluate(() => history.state?.shelflifeDialog)).toBe(true);
  await page.goBack();
  await expect(openSheets(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
  expect(await page.evaluate(() => history.state?.shelflifeDialog ?? null)).toBe(null);
});

test('Back unwinds sheets one at a time when one opens from another', async ({ page }) => {
  await open(page);
  await launcher(page).click();
  await page.locator('#activityCards [data-game]').first().click();
  await expect(page.locator('#arcadeVeil')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#arcadeVeil')).not.toBeVisible();
  // Whatever is left open is still backed by an entry, so Back keeps closing rather than leaving.
  for (let i = 0; i < 3 && await openSheets(page).count(); i++) await page.goBack();
  await expect(openSheets(page)).toHaveCount(0);
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
});

test('closing with the button or Escape leaves no stale history entry', async ({ page }) => {
  await open(page);
  await launcher(page).click();
  await expect(page.locator('#playroomVeil')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(openSheets(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => history.state?.shelflifeDialog ?? null)).toBe(null);
  // A second open and close behaves the same, so entries do not pile up.
  await launcher(page).click();
  await expect(page.locator('#playroomVeil')).toBeVisible();
  await page.locator('#playroomClose').click();
  await expect(openSheets(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => history.state?.shelflifeDialog ?? null)).toBe(null);
});

test('a reload while a sheet is open starts clean', async ({ page }) => {
  await open(page);
  await launcher(page).click();
  await expect(page.locator('#playroomVeil')).toBeVisible();
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
  expect(await page.evaluate(() => history.state?.shelflifeDialog ?? null)).toBe(null);
  await expect(openSheets(page)).toHaveCount(0);
});
