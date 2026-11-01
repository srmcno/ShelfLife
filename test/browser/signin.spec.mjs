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

test('an existing email falls back automatically and a pasted code signs in', async ({ page, context, browserName }) => {
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
  if (browserName === 'webkit') {
    // Playwright WebKit does not expose clipboard permissions. Exercise the
    // resulting paste input event; Chromium covers the actual clipboard path.
    await page.locator('#cloudCode').evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: value }));
    }, FAKE_CODE);
  } else {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(code => navigator.clipboard.writeText(code), FAKE_CODE);
    await page.locator('#cloudCode').focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
  }
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

test('a signed-in player chooses whether to accept an invitation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const fake = createFakeSupabase();
  const inviter = await socialPlayer(fake, 'Ada');
  const recipient = await socialPlayer(fake, 'Bea');
  await inviter.social.addFriend(recipient.code);
  const before = fake.calls('add_friend').length;
  await page.addInitScript(session => {
    if (!sessionStorage.getItem('signin.fixture')) localStorage.setItem('shelflife.cloud', JSON.stringify({ session }));
  }, recipient.session);
  await boot(page, fake, '/?invite=' + inviter.code);
  const sheet = page.locator('#friendsSheet');
  await expect(page.locator('#friendsVeil')).toBeVisible();
  await expect(sheet).toContainText('A friend invited you');
  expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(fake.calls('add_friend')).toHaveLength(before);
  await sheet.locator('[data-fr="invite-accept"]').click();
  await expect.poll(() => fake.calls('add_friend').length).toBe(before + 1);
  await expect(sheet).toContainText('You are now friends.');
  await expect.poll(async () => (await inviter.social.friends())[0]?.status).toBe('accepted');
  await page.reload();
  await page.locator('#tabFriends').click();
  await expect(page.locator('#frAdd')).toBeVisible();
  expect(fake.calls('add_friend')).toHaveLength(before + 1);
});

test('a signed-in player can dismiss an invitation without sending a request', async ({ page }) => {
  const fake = createFakeSupabase();
  const inviter = await socialPlayer(fake, 'Ada');
  const recipient = await socialPlayer(fake, 'Bea');
  await page.addInitScript(session => {
    if (!sessionStorage.getItem('signin.fixture')) localStorage.setItem('shelflife.cloud', JSON.stringify({ session }));
  }, recipient.session);
  await boot(page, fake, '/?invite=' + inviter.code);
  await page.locator('#friendsSheet [data-fr="invite-dismiss"]').click();
  await expect(page.locator('#frInviteTitle')).toHaveCount(0);
  expect(fake.calls('add_friend')).toHaveLength(0);
  await page.reload();
  await page.locator('#tabFriends').click();
  await expect(page.locator('#frInviteTitle')).toHaveCount(0);
  expect(fake.calls('add_friend')).toHaveLength(0);
});

test('a signed-in player sends one request to an inviter who has not sent one yet', async ({ page }) => {
  const fake = createFakeSupabase();
  const inviter = await socialPlayer(fake, 'Ada');
  const recipient = await socialPlayer(fake, 'Bea');
  await page.addInitScript(session => {
    if (!sessionStorage.getItem('signin.fixture')) localStorage.setItem('shelflife.cloud', JSON.stringify({ session }));
  }, recipient.session);
  await boot(page, fake, '/?invite=' + inviter.code);
  await page.locator('#friendsSheet [data-fr="invite-accept"]').click();
  await expect(page.locator('#friendsSheet')).toContainText('Friend request sent.');
  await expect.poll(async () => (await inviter.social.friends())[0]?.status).toBe('pending');
  expect(fake.calls('add_friend')).toHaveLength(1);
});

test('an invitation awaiting consent is not transferred to another account', async ({ page }) => {
  const fake = createFakeSupabase();
  const inviter = await socialPlayer(fake, 'Ada');
  const recipient = await socialPlayer(fake, 'Bea');
  const other = await socialPlayer(fake, 'Cam');
  await page.addInitScript(session => {
    if (!sessionStorage.getItem('signin.fixture')) localStorage.setItem('shelflife.cloud', JSON.stringify({ session }));
  }, recipient.session);
  await boot(page, fake, '/?invite=' + inviter.code);
  await expect(page.locator('#frInviteTitle')).toBeVisible();
  await page.evaluate(session => {
    const cloud = JSON.parse(localStorage.getItem('shelflife.cloud'));
    cloud.session = session;
    localStorage.setItem('shelflife.cloud', JSON.stringify(cloud));
  }, other.session);
  await page.reload();
  await page.locator('#tabFriends').click();
  await expect(page.locator('#frInviteTitle')).toHaveCount(0);
  expect(fake.calls('add_friend')).toHaveLength(0);
});

test('a delayed invitation cannot clear a newer invitation', async ({ page }) => {
  const fake = createFakeSupabase();
  const first = await socialPlayer(fake, 'Ada');
  const second = await socialPlayer(fake, 'Cam');
  const recipient = await socialPlayer(fake, 'Bea');
  await page.addInitScript(session => {
    if (!sessionStorage.getItem('signin.fixture')) localStorage.setItem('shelflife.cloud', JSON.stringify({ session }));
  }, recipient.session);
  await boot(page, fake, '/?invite=' + first.code);
  let signal, release;
  const started = new Promise(resolve => { signal = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/rest/v1/rpc/register_referral', async route => {
    signal(); await held; await fake.route(route);
  });
  await page.locator('#friendsSheet [data-fr="invite-accept"]').click();
  await started;
  await page.evaluate(({ code, owner }) => {
    const cloud = JSON.parse(localStorage.getItem('shelflife.cloud'));
    cloud.inviteArrival = { code, owner, needsConsent: true };
    localStorage.setItem('shelflife.cloud', JSON.stringify(cloud));
  }, { code: second.code, owner: recipient.id });
  const response = page.waitForResponse(res => res.url().endsWith('/rpc/register_referral'));
  release();
  await response;
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).inviteArrival?.code)).toBe(second.code);
});

for (const ineligible of ['not_new', 'too_many']) {
  test(`an invitation sends a friend request when the referral is ${ineligible}`, async ({ page }) => {
    const fake = createFakeSupabase();
    const inviter = await socialPlayer(fake, 'Ada');
    if (ineligible === 'too_many') {
      for (let i = 0; i < 50; i++) fake.social.coven.referrals.set('previous-' + i, { inviter: inviter.id });
    }
    await boot(page, fake, '/?invite=' + inviter.code);
    if (ineligible === 'not_new') {
      await page.route('**/rest/v1/rpc/register_referral', async route => {
        const invitee = [...fake.users.values()].find(user => user.id !== inviter.id);
        invitee.created_at = new Date(Date.now() - 15 * 86400000).toISOString();
        await fake.route(route);
      });
    }
    await page.locator('#friendsEnable').click();
    await expect.poll(() => fake.calls('add_friend').length).toBe(1);
    await expect.poll(() => fake.calls('register_referral').length).toBe(1);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).inviteArrival ?? null)).toBeNull();
    await page.reload();
    await page.locator('#tabFriends').click();
    await expect(page.locator('#frAdd')).toBeVisible();
    expect(fake.calls('add_friend')).toHaveLength(1);
    expect(fake.calls('register_referral')).toHaveLength(1);
  });
}

test('a temporary referral failure does not resend the friend request', async ({ page }) => {
  const fake = createFakeSupabase();
  const inviter = await socialPlayer(fake, 'Ada');
  await boot(page, fake, '/?invite=' + inviter.code);
  let attempts = 0;
  await page.route('**/rest/v1/rpc/register_referral', async route => {
    if (++attempts === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"unavailable"}' });
    else await fake.route(route);
  });
  await page.locator('#friendsEnable').click();
  await expect(page.locator('#friendsSheet')).toContainText('Open Friends to retry the referral.');
  expect(fake.calls('add_friend')).toHaveLength(1);
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await page.locator('#tabFriends').click();
  await expect.poll(() => fake.social.coven.referrals.size).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).inviteArrival ?? null)).toBeNull();
  expect(attempts).toBe(2);
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
