import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

const DAY = 86400000;
const SAVE_KEY = 'shelflife.v4';

test('residency keepsakes and callbacks read clearly on desktop and small phones', async ({ page }, info) => {
  const state = householdFixture('established');
  const movedIn = Date.now() - 50 * DAY;
  state.settings.theatreOn = false;
  state.lastCheck = 0;
  state.lastBackup = Date.now();
  state.pets.forEach(pet => { pet.born = movedIn; delete pet.lifeMilestones; });
  await page.addInitScript(({ save, key }) => {
    if (!sessionStorage.getItem('resident-tenure-fixture')) {
      localStorage.setItem(key, JSON.stringify(save));
      sessionStorage.setItem('resident-tenure-fixture', '1');
    }
  }, { save: state, key: SAVE_KEY });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(state.pets.length);
  await page.locator('.tab[data-tab="notes"]').click();
  await page.locator('#checkBtn').click();
  await expect.poll(() => page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved.life.scenes.some(scene => scene.kind === 'residency' && scene.stage?.branch === '30');
  }, SAVE_KEY)).toBe(true);

  await page.locator('.tab[data-tab="shelf"]').click();
  await page.locator('#cabinet .piece.pet').first().click();
  await expect(page.locator('#cardVeil')).toBeVisible();
  const life = page.locator('.resident-habits');
  await life.locator('summary').click();
  await expect(life).toContainText('50 days on the shelf');
  await expect(life).toContainText('1 life keepsake');
  const memories = page.locator('#residentMemories');
  await memories.locator('summary').click();
  await expect(memories).toContainText(/month/i);

  await page.reload();
  await page.locator('#cabinet .piece.pet').first().click();
  await expect(page.locator('#cardVeil')).toBeVisible();
  await page.locator('.resident-habits summary').click();
  await expect(page.locator('.resident-habits')).toContainText('1 life keepsake');
  await page.locator('#residentMemories summary').click();
  await expect(page.locator('#residentMemories')).toContainText(/month/i);

  if (info.project.name !== 'desktop-chromium') await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/resident-tenure-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
