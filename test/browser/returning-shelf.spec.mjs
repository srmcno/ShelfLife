import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

test('opening an existing shelf does not cover the main controls with old incident notices', async ({ page }) => {
  const shelf = householdFixture('established');
  shelf.lastBackup = Date.now();
  await page.addInitScript(value => localStorage.setItem('shelflife.v4', JSON.stringify(value)), shelf);
  await page.goto('/');
  await expect(page.locator('#roundsBtn')).toBeVisible();
  await expect(page.locator('#toast')).not.toContainText('Incident on file:');
  await page.locator('#actions').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const clear = await page.evaluate(() => {
    const nav = document.querySelector('.tabbar').getBoundingClientRect();
    return ['roundsBtn', 'newPetBtn'].every(id => {
      const rect = document.getElementById(id).getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= nav.top;
    });
  });
  expect(clear).toBe(true);
  await page.locator('#roundsBtn').click();
  await expect(page.locator('#toast')).toHaveClass(/show/);
});
