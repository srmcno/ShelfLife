import { test, expect } from 'playwright/test';
import { createFakeSupabase, FAKE_CODE } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { createCloud } from '../../src/cloud/client.js';
import { householdFixture } from '../household-fixtures.mjs';

function memory() {
  const data = new Map();
  return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}
async function boot(page, fake, path = '/') {
  const snapshot = householdFixture('established');
  snapshot.settings.theatreOn = false;
  await page.addInitScript(({ config, snapshot }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('signin.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      sessionStorage.setItem('signin.fixture', '1');
    }
  }, { config: fake.config, snapshot });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto(path);
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}

test.use({ serviceWorkers: 'block' });

test('an existing email falls back automatically and a pasted code signs in', async ({ page, context }) => {
  const fake = createFakeSupabase();
  const existing = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory() });
  await existing.requestEmailCode('mabel@gmail.com', { mode: 'signin' });
  await existing.verifyEmailCode('mabel@gmail.com', FAKE_CODE);
  const oldUser = existing.userId();
  await boot(page, fake);
  await page.locator('#tabMore').click(); await page.locator('#cloudBtn').click();
  await page.locator('#cloudEnable').click();
  await expect(page.locator('#cloudAnon')).toBeVisible();
  await page.locator('#cloudEmail').fill('mabel@gmail.com');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudStatus')).toContainText('choose which shelf');
  await expect(page.locator('#cloudCodeDestination')).toHaveText('Sent to mabel@gmail.com');
  await expect(page.locator('#cloudMail')).toHaveText('Open Gmail');
  await expect(page.locator('#cloudMail')).toHaveAttribute('href', 'https://mail.google.com/');
  await expect(page.locator('#cloudResend')).toBeDisabled();
  await expect(page.locator('#cloudResend')).toContainText(/in [1-9][0-9]?s/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(code => navigator.clipboard.writeText(code), FAKE_CODE);
  await page.locator('#cloudCode').focus();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
  await expect.poll(() => fake.calls('/auth/v1/verify').length).toBe(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).session.user.id)).toBe(oldUser);
});

test('an invitation signs in anonymously and sends one request and referral', async ({ page }) => {
  const fake = createFakeSupabase();
  const inviter = await socialPlayer(fake, 'Ada');
  await boot(page, fake, '/?invite=' + inviter.code);
  await expect(page.locator('#friendsVeil')).toBeVisible();
  await expect(page.locator('#friendsSheet')).toContainText('A friend invited you');
  await page.locator('#friendsEnable').click();
  await expect(page.locator('#frAdd')).toBeVisible();
  await expect.poll(() => fake.calls('register_referral').length).toBe(1);
  await expect.poll(() => fake.calls('add_friend').length).toBe(1);
  await expect.poll(() => fake.social.coven.referrals.size).toBe(1);
  await page.reload();
  await page.locator('#tabFriends').click();
  await expect(page.locator('#frAdd')).toBeVisible();
  expect(fake.calls('register_referral')).toHaveLength(1);
  expect(fake.calls('add_friend')).toHaveLength(1);
});

test('Google is only shown when the provider is enabled', async ({ page }) => {
  const fake = createFakeSupabase({ googleEnabled: true });
  await boot(page, fake);
  await page.locator('#tabFriends').click();
  await expect(page.locator('#friendsGoogle')).toBeVisible();
});

test('resend becomes available after a minute and the code survives closing the sheet', async ({ page }) => {
  const fake = createFakeSupabase();
  await boot(page, fake);
  await page.locator('#tabFriends').click();
  await page.locator('#friendsEmail').fill('mabel@outlook.com');
  await page.locator('#friendsSendCode').click();
  await expect(page.locator('#friendsResend')).toBeDisabled();
  await expect(page.locator('#friendsMail')).toHaveText('Open Outlook');
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await page.evaluate(() => {
    const key = 'shelflife.cloud', data = JSON.parse(localStorage.getItem(key));
    data.pending.at -= 61000; localStorage.setItem(key, JSON.stringify(data));
  });
  await page.locator('#tabFriends').click();
  await expect(page.locator('#friendsCodeDestination')).toHaveText('Sent to mabel@outlook.com');
  await expect(page.locator('#friendsResend')).toBeEnabled();
  await page.locator('#friendsResend').click();
  await expect.poll(() => fake.sent.length).toBe(2);
  await expect(page.locator('#friendsResend')).toBeDisabled();
});

test('switching from a guest to an existing account offers both shelves', async ({ page }) => {
  const fake = createFakeSupabase();
  const existing = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory() });
  await existing.requestEmailCode('existing@example.com', { mode: 'signin' });
  await existing.verifyEmailCode('existing@example.com', FAKE_CODE);
  const remote = householdFixture('established');
  remote.pets[0].name = 'Remote Mabel';
  fake.setRemote(existing.userId(), remote);
  await boot(page, fake);
  await page.locator('#tabFriends').click();
  await page.locator('#friendsEnable').click();
  await expect(page.locator('#frAdd')).toBeVisible();
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await page.locator('#tabMore').click(); await page.locator('#cloudBtn').click();
  await page.locator('#cloudEmail').fill('existing@example.com');
  await page.locator('#cloudSendCode').click();
  await page.locator('#cloudCode').fill(FAKE_CODE);
  await page.locator('#cloudConfirm').click();
  await expect(page.locator('#cloudConflict')).toBeVisible();
  await expect(page.locator('#cloudRemoteSummary')).toContainText('Remote Mabel');
  await page.locator('#cloudKeepLocal').click();
  await expect(page.locator('#cloudUndo')).toBeVisible();
  await expect.poll(() => fake.saves.get(existing.userId()).data.pets[0].name).not.toBe('Remote Mabel');
});

test('a postbox notification opens Friends and resumes the postbox after guest sign-in', async ({ page }) => {
  const fake = createFakeSupabase();
  await boot(page, fake, '/?open=postbox');
  await expect(page.locator('#friendsVeil')).toBeVisible();
  await expect(page.locator('#friendsEnable')).toBeVisible();
  expect(new URL(page.url()).searchParams.has('open')).toBe(false);
  await page.locator('#friendsEnable').click();
  await expect(page.locator('#friendsSheet [data-fr-title]')).toHaveText('Postbox');
});

test('the game boots without cloud when session storage is blocked', async ({ page }) => {
  const outside = [];
  page.on('request', request => { if (new URL(request.url()).hostname !== 'localhost') outside.push(request.url()); });
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.locator('.arrival-resident')).toHaveCount(3);
  await expect(page.locator('#tabFriends')).toBeHidden();
  expect(outside).toEqual([]);
});
