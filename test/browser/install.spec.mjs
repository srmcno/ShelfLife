import { test, expect } from 'playwright/test';

test('install guidance follows the browser and device', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tabMore').click();
  const button = page.locator('#installBtn');
  const apple = await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  if (apple) {
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('#installSteps')).toContainText('Add to Home Screen');
    return;
  }
  await expect(button).toBeHidden();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.installPromptCalled = true; };
    window.dispatchEvent(event);
  });
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => page.evaluate(() => window.installPromptCalled)).toBe(true);
  await expect(button).toBeHidden();
});
