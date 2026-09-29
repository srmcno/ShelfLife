import { test as base, expect } from 'playwright/test';
import { createFakeSupabase, FAKE_CODE } from '../support/fake-supabase.mjs';
import { createCloud } from '../../src/cloud/client.js';

// privacy.html and delete-account.html: readable at phone width, reachable from
// More, and the deletion page really deletes (against the in-memory Supabase).
const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // The unknown address (422) and the wrong code (403) are refused on purpose; Chrome logs both.
  page.on('console', m => { if (m.type() === 'error' && !/status of (403|422)\b/.test(m.text())) errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });
test.use({ serviceWorkers: 'block' });

const memory = () => { const items = new Map(); return { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k) }; };
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('More links to the privacy page and the deletion page', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tabMore:visible, #moreBtn:visible').first().click();
  const privacy = page.locator('#moreTray .tray-legal a', { hasText: 'Privacy' });
  const remove = page.locator('#moreTray .tray-legal a', { hasText: 'Delete account' });
  await expect(privacy).toHaveAttribute('href', 'privacy.html');
  await expect(remove).toHaveAttribute('href', 'delete-account.html');
  await expect(privacy).toHaveAttribute('target', '_blank');
  await remove.scrollIntoViewIfNeeded();
  await expect(remove).toBeVisible();
});

test('the privacy page covers the essentials and fits the screen', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.locator('h1')).toHaveText('Privacy');
  const text = await page.locator('main').innerText();
  for (const phrase of ['No ads', 'No analytics', 'Supabase', 'friend', 'local notifications', '13', 'delete your account', 'issue form']) {
    expect(text.toLowerCase()).toContain(phrase.toLowerCase());
  }
  expect(text).toMatch(/Last changed \d{1,2} \w+ 20\d\d/);
  expect(text).not.toContain('\u2014');
  expect(await noSideScroll(page)).toBe(true);
  await expect(page.locator('a[href="delete-account.html"]').first()).toBeVisible();
});

test('without cloud save the deletion page gives the steps and says there is nothing on a server', async ({ page }) => {
  await page.goto('/delete-account.html');
  await expect(page.locator('h1')).toHaveText('Delete your account');
  await expect(page.locator('ol li')).toHaveCount(4);
  await expect(page.locator('#direct')).toBeHidden();
  await expect(page.locator('#unconfigured')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test('the deletion page signs in with the emailed code and deletes the account', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The account layer is checked once');
  const fake = createFakeSupabase();
  const phone = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory() });
  await phone.requestEmailCode('mabel@example.com', { mode: 'signin' });
  await phone.verifyEmailCode('mabel@example.com', FAKE_CODE);
  await phone.rpc('push_save', { p_base_rev: 0, p_data: { pets: [] }, p_device: 'android-abcdefgh' });
  expect(fake.users.size).toBe(1);
  // The game's own sign-in in this browser must survive the page's.
  await page.addInitScript(config => { globalThis.SHELFLIFE_CLOUD_CONFIG = config; localStorage.setItem('shelflife.cloud', '{"deviceId":"mac-keepme12"}'); }, fake.config);
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/delete-account.html');
  await expect(page.locator('#unconfigured')).toBeHidden();

  // An address with no account gets the same answer and never becomes one.
  await page.locator('#email').fill('nobody@example.com');
  await page.locator('#sendCode').click();
  await expect(page.locator('#status')).toContainText('If an account uses nobody@example.com');
  expect(fake.users.size).toBe(1);

  await page.locator('#email').fill('Mabel@Example.com');
  await page.locator('#sendCode').click();
  await expect(page.locator('#status')).toContainText('mabel@example.com');
  await page.locator('#code').fill('000000');
  await page.locator('#confirmCode').click();
  await expect(page.locator('#status')).toContainText('did not work');
  await page.locator('#code').fill(FAKE_CODE);
  await page.locator('#confirmCode').click();
  await expect(page.locator('#who')).toHaveText('mabel@example.com');
  await expect(page.locator('#keepAccount')).toBeFocused();
  await page.locator('#deleteAccount').click();
  await expect(page.locator('#done')).toBeVisible();
  expect(fake.users.size).toBe(0);
  expect(fake.saves.size).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('shelflife.cloud'))).toBe('{"deviceId":"mac-keepme12"}');
});
