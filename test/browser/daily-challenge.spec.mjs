import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { dailyChallenge } from '../../src/engine/daily.js';
import { ARCADE_BY_ID } from '../../src/content/arcade.js';
import { DAILY_SOULS } from '../../src/content/daily.js';
import { docketCaseId, DOCKET_SOULS } from '../../src/engine/court.js';
import { COURT_BY_ID } from '../../src/engine/court.js';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

// The page runs in America/Chicago (playwright.config.mjs), so "today" is read in that zone.
function todayKey() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day);
}
const launcher = page => page.locator('#playroomBtn:visible, #tabPlay:visible').first();

async function open(page) {
  const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now();
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('daily-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('daily-fixture', '1'); } }, s);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
async function arcadeMenu(page) {
  await launcher(page).click();
  await page.locator('#activityCards [data-game]').first().click();
  await page.locator('#arcadeSheet [data-ar="menu"]').click();
}

test('the arcade menu names today’s challenge and its modifier, and the intro offers it', async ({ page }) => {
  const c = dailyChallenge(todayKey()), game = ARCADE_BY_ID[c.game];
  await open(page);
  await arcadeMenu(page);
  const banner = page.locator('#arcadeSheet .ar-daily-banner');
  await expect(banner).toContainText(game.title);
  await expect(banner).toContainText(c.mod.title);
  await expect(banner).toContainText('+' + DAILY_SOULS + ' souls');
  await expect(page.locator('#arcadeSheet .ar-menu-card.is-today')).toHaveCount(1);
  await expect(page.locator('#arcadeSheet .ar-menu-card.is-today .ar-today')).toHaveText('Today');
  await banner.click();
  await expect(page.locator('#arcadeVeil .sheet-head h2')).toHaveText(game.title);
  await expect(page.locator('#arcadeSheet .ar-daily')).toContainText(c.mod.line);
  await expect(page.locator('#arcadeSheet [data-ar="challenge"]')).toBeVisible();
  await expect(page.locator('#arcadeSheet [data-ar="play"]')).toBeVisible();
  // A game that is not today's has no challenge card.
  await page.locator('#arcadeSheet [data-ar="menu"]').click();
  const other = page.locator('#arcadeSheet .ar-menu-card:not(.is-today)').first();
  await other.click();
  await expect(page.locator('#arcadeSheet .ar-daily')).toHaveCount(0);
  await expect(page.locator('#arcadeSheet [data-ar="challenge"]')).toHaveCount(0);
});

test('starting the challenge shows the modifier and its own best, then closes cleanly', async ({ page }) => {
  const c = dailyChallenge(todayKey());
  await open(page);
  await arcadeMenu(page);
  await page.locator('#arcadeSheet .ar-daily-banner').click();
  await page.locator('#arcadeSheet [data-ar="challenge"]').click();
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-best small')).toHaveText('Today');
  await expect(page.locator('#arcadeSheet [data-ar-status]')).toContainText(c.mod.title);
  await expect(page.locator('#arcadeSheet .sheet-head .eyebrow')).toContainText('Today’s challenge');
  await page.locator('#arcadeSheet [data-ar="pause"]').click();
  await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#arcadeVeil')).not.toBeVisible();
});

test('the challenge menu and intro fit a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page);
  await arcadeMenu(page);
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1));
  expect(await wide()).toBe(false);
  await page.locator('#arcadeSheet .ar-daily-banner').click();
  expect(await wide()).toBe(false);
});

test('Shelf Court opens on today’s docket case and says what airing it pays', async ({ page }) => {
  const docketCase = COURT_BY_ID[docketCaseId(todayKey())];
  await open(page);
  await launcher(page).click();
  await page.locator('#activityCards [data-court]').click();
  await expect(page.locator('#courtVeil .sc-docket')).toContainText(docketCase.title);
  await expect(page.locator('#courtVeil .sc-docket')).toContainText('+' + DOCKET_SOULS + ' souls');
  await expect(page.locator('#courtVeil .sc-tonight h3')).toHaveText(docketCase.title);
  // Choosing another case offers a way back to the docket.
  await page.locator('#courtVeil [data-sc="another"]').click();
  await expect(page.locator('#courtVeil .sc-docket button[data-sc-case="' + docketCase.id + '"]')).toBeVisible();
  await page.locator('#courtVeil .sc-docket button[data-sc-case]').click();
  await expect(page.locator('#courtVeil .sc-tonight h3')).toHaveText(docketCase.title);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1))).toBe(false);
});

test('the shelf desk lists today’s docket and challenge and opens each one', async ({ page }) => {
  const c = dailyChallenge(todayKey()), docketCase = COURT_BY_ID[docketCaseId(todayKey())];
  await open(page);
  const tile = page.locator('#mayhemDesk .mh-today');
  await expect(tile).toContainText(docketCase.title);
  await expect(tile).toContainText(ARCADE_BY_ID[c.game].title);
  await expect(tile).toContainText(c.mod.title);
  await tile.locator('[data-mh-today="arcade"]').click();
  await expect(page.locator('#arcadeVeil .sheet-head h2')).toHaveText(ARCADE_BY_ID[c.game].title);
  await expect(page.locator('#arcadeSheet .ar-daily')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#arcadeVeil')).not.toBeVisible();
  await tile.locator('[data-mh-today="court"]').click();
  await expect(page.locator('#courtVeil .sc-tonight h3')).toHaveText(docketCase.title);
});
