import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { SEASONS } from '../../src/content/seasons.js';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

const season = SEASONS[0];
const IN_SEASON = new Date('2026-10-20T20:00:00Z');   // 15:00 in America/Chicago
const OUT_OF_SEASON = new Date('2026-09-10T20:00:00Z');

async function open(page, when, owned = []) {
  const s = householdFixture('established', when.getTime());
  s.settings.theatreOn = false; s.lastBackup = when.getTime();
  s.mayhem = { souls: 200, lifetime: 200, nextAt: when.getTime() + 600000, curios: Object.fromEntries(owned.map(id => [id, 1])) };
  await page.clock.setFixedTime(when);
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('season-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('season-fixture', '1'); } }, s);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}

test('in season the desk says so and the cabinet shows the seasonal set', async ({ page }) => {
  await open(page, IN_SEASON, [season.curios[0].id, season.curios[1].id]);
  await expect(page.locator('#mayhemDesk .mh-season')).toContainText(season.name);
  await expect(page.locator('#mayhemDesk .mh-season')).toContainText('(2/' + season.curios.length + ')');
  await expect(page.locator('#mayhemDesk .mh-season')).toContainText('2 November');
  await page.locator('#soulsHud').click();
  const group = page.locator('#mayhemSheet .mh-shelf-group', { has: page.locator('h3.rarity-season') });
  await expect(group).toContainText('2/' + season.curios.length);
  await expect(group).toContainText('In season now');
  await expect(group.locator('button.mh-shelf-item')).toHaveCount(2);
  await expect(group.locator('.mh-shelf-item.missing')).toHaveCount(season.curios.length - 2);
  await group.locator('button.mh-shelf-item').first().click();
  await expect(page.locator('#mhCurioDetail')).toContainText(season.curios[0].name);
  await expect(page.locator('#mhCurioDetail')).toContainText('Seasonal');
  // The ordinary count is not inflated by seasonal curios.
  await expect(page.locator('#mayhemSheet .mh-rank-card')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mayhemVeil')).not.toHaveClass(/open/);
});

test('out of season the strip is gone and owned curios stay, marked as returning', async ({ page }) => {
  await open(page, OUT_OF_SEASON, [season.curios[2].id]);
  await expect(page.locator('#mayhemDesk .mh-season')).toHaveCount(0);
  await page.locator('#soulsHud').click();
  const group = page.locator('#mayhemSheet .mh-shelf-group', { has: page.locator('h3.rarity-season') });
  await expect(group).toContainText('Out of season');
  await expect(group.locator('button.mh-shelf-item')).toHaveCount(1);
});

test('with no seasonal curios and no season the cabinet has no seasonal group', async ({ page }) => {
  await open(page, OUT_OF_SEASON, []);
  await page.locator('#soulsHud').click();
  await expect(page.locator('#mayhemSheet h3.rarity-season')).toHaveCount(0);
  await expect(page.locator('#mayhemSheet .mh-rank-card')).toBeVisible();
});

test('the season strip and cabinet fit a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page, IN_SEASON, [season.curios[0].id]);
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1));
  expect(await wide()).toBe(false);
  await page.locator('#soulsHud').click();
  expect(await wide()).toBe(false);
});
