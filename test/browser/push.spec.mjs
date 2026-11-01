import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer, pageSession } from '../support/social-world.mjs';

test.use({ serviceWorkers: 'block' });
test('Friends asks permission on click, saves group preferences and revokes on sign-out', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium');
  test.setTimeout(90000);
  const fake = createFakeSupabase(), player = await socialPlayer(fake, 'Ada');
  const fixture = householdFixture('established'); fixture.settings.theatreOn = false; fixture.lastBackup = Date.now();
  await page.addInitScript(({ fixture, config, session }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    localStorage.setItem('shelflife.v4', JSON.stringify(fixture));
    localStorage.setItem('shelflife.cloud', session);
    let current = null;
    globalThis.pushPrompts = 0;
    globalThis.PushManager = class PushManager {};
    globalThis.Notification = class Notification { static async requestPermission() { globalThis.pushPrompts++; return 'granted'; } };
    const subscription = { endpoint: 'https://fcm.googleapis.com/browser-test',
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'a'.repeat(22) } }; },
      async unsubscribe() { current = null; return true; } };
    const registration = { async update() {}, pushManager: { async getSubscription() { return current; }, async subscribe() { current = subscription; return subscription; } } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration), addEventListener() {}, async register() { return registration; } } });
  }, { fixture, config: fake.config, session: pageSession(player) });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.route('**/src/cloud/deployment-config.js', route => route.fulfill({ contentType: 'text/javascript', body: "export const DEPLOYED_CLOUD_CONFIG = null; export const DEPLOYED_PUBLIC_URL = null; export const DEPLOYED_VAPID_PUBLIC_KEY = 'AQ';" }));
  await page.goto('/');
  await page.locator('#cabinet .piece.pet').first().waitFor();
  if (await page.locator('#tabFriends').isVisible()) await page.locator('#tabFriends').click();
  else { await page.locator('#tabMore').click(); await page.locator('#friendsBtn').click(); }
  const section = page.locator('[data-fr-section="push"]');
  await expect(section.getByRole('button', { name: 'Turn on notifications' })).toBeVisible();
  expect(await page.evaluate(() => globalThis.pushPrompts)).toBe(0);
  await section.getByRole('button', { name: 'Turn on notifications' }).click();
  await expect(section.getByRole('button', { name: 'Turn off notifications' })).toBeVisible();
  expect(await page.evaluate(() => globalThis.pushPrompts)).toBe(1);
  expect(fake.push.subscriptions.size).toBe(1);
  await section.getByRole('button', { name: 'Shelf Court: On' }).click();
  await expect(section.getByRole('button', { name: 'Shelf Court: Off' })).toBeVisible();
  expect(fake.push.prefs.get(player.id).court).toBe(false);
  await page.keyboard.press('Escape');
  await page.locator('#tabMore').click(); await page.locator('#cloudBtn').click();
  await page.locator('#cloudSignOut').click();
  if (await page.locator('#cloudSignOut').textContent() === 'Sign out and lose access') await page.locator('#cloudSignOut').click();
  await expect.poll(() => fake.push.subscriptions.size).toBe(0);
});

test('boot revokes pending notification cleanup without opening Friends or contacting cloud', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium');
  test.setTimeout(90000);
  const outside = [];
  page.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:4175') outside.push(request.url()); });
  const fixture = householdFixture('established'); fixture.settings.theatreOn = false; fixture.lastBackup = Date.now();
  await page.addInitScript(fixture => {
    localStorage.setItem('shelflife.v4', JSON.stringify(fixture));
    localStorage.setItem('shelflife.push.cleanup', 'previous-account');
    let oldSubscription = true;
    globalThis.cleanupRevocations = 0;
    const subscription = { async unsubscribe() { oldSubscription = false; globalThis.cleanupRevocations++; return true; } };
    const registration = { async update() {}, pushManager: { async getSubscription() { return oldSubscription ? subscription : null; } } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration), async getRegistration() { return registration; }, addEventListener() {}, async register() { return registration; } } });
  }, fixture);
  await page.goto('/');
  await page.locator('#cabinet .piece.pet').first().waitFor();
  await expect.poll(() => page.evaluate(() => globalThis.cleanupRevocations)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('shelflife.push.cleanup'))).toBeNull();
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await page.waitForTimeout(300);
  expect(outside).toEqual([]);
});
