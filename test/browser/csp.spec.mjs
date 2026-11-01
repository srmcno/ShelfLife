import { test, expect } from 'playwright/test';

test('the game and account pages run under their content security policy', async ({ page }) => {
  const violations = [];
  await page.exposeFunction('recordCspViolation', violation => violations.push(violation));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => {
    globalThis.recordCspViolation({ directive: event.effectiveDirective, blocked: event.blockedURI });
  }));
  await page.goto('/');
  await expect(page.locator('#tabMore')).toBeVisible();
  await page.locator('#tabMore').click();
  await page.locator('#helpBtn').click();
  await expect(page.locator('#helpVeil')).toHaveClass(/open/);
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
  await page.goto('/delete-account.html');
  await expect(page.locator('#unconfigured')).toBeVisible();
  expect(violations).toEqual([]);
});
