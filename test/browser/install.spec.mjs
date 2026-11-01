import { test, expect } from 'playwright/test';

test('a browser install request is offered only after the browser provides it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tabMore').click();
  const button = page.locator('#installBtn');
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
