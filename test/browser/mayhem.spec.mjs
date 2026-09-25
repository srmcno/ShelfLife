import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

const SAVE_KEY = 'shelflife.v4';
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});

async function openHousehold(page, customize = () => {}) {
  const snapshot = householdFixture('established');
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = Date.now();
  customize(snapshot);
  await page.addInitScript(({ snapshot, key }) => {
    if (!sessionStorage.getItem('shelflife.browser.fixture')) {
      localStorage.setItem(key, JSON.stringify(snapshot));
      sessionStorage.setItem('shelflife.browser.fixture', '1');
    }
  }, { snapshot, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
  return snapshot;
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('.veil.open .sheet')].map(el => ({ width: el.clientWidth, content: el.scrollWidth })) }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
  for (const dialog of sizes.dialogs) expect(dialog.content).toBeLessThanOrEqual(dialog.width + 1);
}

test('the omen, an emergency and a coffin pay souls, fill the cabinet and survive reload', async ({ page }) => {
  await openHousehold(page);
  // A household with no mayhem history starts with the omen face down and two emergencies.
  await expect(page.locator('#mayhemAlert .mh-alert.omen')).toBeVisible();
  await expect(page.locator('#shelfBadge')).toHaveText('2');
  await expect(page).toHaveTitle(/^\(2\) /);
  await page.locator('#mayhemAlert [data-mh="omen"]').click();
  await page.locator('#mayhemSheet [data-mh="flip"]').click();
  await expect(page.locator('#mayhemSheet .mh-tarot.face')).toBeVisible();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBeGreaterThanOrEqual(15);
  await noHorizontalOverflow(page);

  await page.locator('#mayhemSheet .mh-next [data-mh="emergency"]').click();
  await expect(page.locator('#mayhemSheet .mh-title')).toBeVisible();
  await expect(page.locator('#mayhemSheet .mh-actor .sprite').first()).toBeVisible();
  const before = (await saved(page)).mayhem.souls;
  await page.locator('#mayhemSheet [data-choice="0"]').click();
  await expect(page.locator('#mayhemSheet .mh-stamp')).toBeVisible();
  await expect(page.locator('#mayhemSheet .mh-rewards .souls').first()).toContainText('souls');
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBeGreaterThan(before);
  const shelf = await saved(page);
  expect(shelf.mayhem.resolved).toBe(1);
  expect(shelf.mayhem.queue).toHaveLength(1);
  expect(shelf.notes[0].from).toBe('the incident report');
  await noHorizontalOverflow(page);

  // Escape closes the sheet and the badge follows the tray.
  await page.keyboard.press('Escape');
  await expect(page.locator('#mayhemVeil')).not.toHaveClass(/open/);
  await expect(page.locator('#shelfBadge')).toHaveText('1');

  await page.reload();
  await expect(page.locator('#soulsHud')).toContainText(String((await saved(page)).mayhem.souls));
  await expect(page.locator('#mayhemAlert .mh-alert.hot')).toBeVisible();
});

test('a coffin holds a curio that lands in the cabinet', async ({ page }) => {
  await openHousehold(page, snapshot => { snapshot.mayhem = { souls: 200, lifetime: 200, nextAt: Date.now() + 600000 }; });
  await page.locator('#mayhemDesk [data-mh="coffin"]').click();
  await page.locator('#mayhemSheet [data-mh="pry"]').click();
  await expect(page.locator('#mayhemSheet .mh-curio-card')).toBeVisible();
  await expect.poll(async () => Object.keys((await saved(page)).mayhem.curios).length).toBe(1);
  expect((await saved(page)).mayhem.souls).toBe(160);
  await page.locator('#mayhemSheet [data-mh="cabinet"]').first().click();
  await expect(page.locator('#mayhemSheet .mh-rank-card h3')).toBeVisible();
  await expect(page.locator('#mayhemSheet button.mh-shelf-item')).toHaveCount(1);
  await noHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mayhemVeil')).not.toHaveClass(/open/);
});

test('care pays souls and advances the day’s chores', async ({ page }) => {
  await openHousehold(page, snapshot => {
    const d = new Date();
    snapshot.mayhem = { souls: 0, lifetime: 0, nextAt: Date.now() + 600000, omen: { day: d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(), id: 'wet-hand', streak: 1, lastDay: '' },
      chores: { day: d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(), list: [{ id: 'fuss', have: 0, done: false }, { id: 'rounds', have: 0, done: false }, { id: 'check', have: 0, done: false }], bonus: false } };
    snapshot.pets.forEach(p => { p.needs = { food: 40, fuss: 30, clean: 40 }; });
  });
  await expect(page.locator('#mayhemAlert .mh-alert.calm')).toBeVisible();
  await page.locator('#cabinet .piece[data-id="qa0"]').click();
  await page.locator('#cardVeil [data-care="fuss"]').click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBeGreaterThan(0);
  await expect.poll(async () => (await saved(page)).mayhem.chores.list[0].have).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mayhemDesk .mh-chores li').first()).toContainText('1/3');
});

test('the new surfaces fit a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openHousehold(page);
  await expect(page.locator('#mayhemAlert')).toBeVisible();
  await expect(page.locator('#soulsHud')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
  await expect(page.locator('#mayhemSheet .mh-rank-card')).toBeVisible();
  await noHorizontalOverflow(page);
});
