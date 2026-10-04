import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase, FAKE_CODE } from '../support/fake-supabase.mjs';
import { socialPlayer, socialCalls } from '../support/social-world.mjs';
import { VERDICT_SOULS } from '../../src/engine/court.js';

// A shared in-memory server represents the other player's actual actions.
// The page receives notifications without opening Friends or the More tray.
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });

const NOW = Date.UTC(2026, 9, 3, 17);
function shelf() {
  const state = householdFixture('established', NOW);
  state.settings.theatreOn = false;
  state.lastBackup = NOW;
  return state;
}
async function friends(fake) {
  const ada = await socialPlayer(fake, 'Ada', shelf(), { now: () => NOW });
  const bea = await socialPlayer(fake, 'Bea', shelf(), { now: () => NOW });
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  return { ada, bea };
}
function serve(sender, recipient, index = 1) {
  return sender.social.serve({ to: recipient.id, caseId: 'borrowed-coffin',
    plaintiff: sender.shelf.pets[0], defendant: recipient.shelf.pets[index] });
}
async function open(page, fake, player, { optIn = true } = {}) {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW + 1000);
  await page.addInitScript(({ config, state, meta }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    localStorage.setItem('shelflife.v4', JSON.stringify(state));
    localStorage.setItem('shelflife.cloud', JSON.stringify(meta));
  }, { config: fake.config, state: player.shelf,
    meta: { session: player.session, ...(optIn ? { socialUser: player.id } : {}) } });
  await page.route(fake.url + '/**', route => fake.route(route));
  fake.requests.length = 0;
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(player.shelf.pets.length);
}
const localState = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
const inboxCalls = fake => fake.requests.filter(request => request.path === '/rest/v1/rpc/inbox');
async function fits(page, testInfo) {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no overflow at ' + width).toBe(true);
    const notice = await page.locator('#summonsNotice').evaluate(el => ({ content: el.scrollWidth, box: el.clientWidth }));
    expect(notice.content).toBeLessThanOrEqual(notice.box + 1);
    if (width === 320) {
      const image = testInfo.outputPath('summons-notice-mobile.png');
      await page.screenshot({ path: image });
      await testInfo.attach('Mocked summons notice at 320px', { path: image, contentType: 'image/png' });
    }
  }
}

test('received papers appear at startup and the keyboard notice opens Court without Friends', async ({ page }, testInfo) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const { ada, bea } = await friends(fake);
  const first = await serve(ada, bea);
  await serve(ada, bea, 2);
  await open(page, fake, bea);
  await expect(page.locator('#summonsNotice')).toBeVisible();
  await expect(page.locator('#summonsNoticeText')).toContainText('You’ve been served.');
  await expect(page.locator('#summonsNoticeText')).toContainText('2');
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await expect(page.locator('#moreTray')).toBeHidden();
  expect(inboxCalls(fake).length).toBeGreaterThan(0);
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
  const image = testInfo.outputPath('summons-notice-desktop.png');
  await page.screenshot({ path: image });
  await testInfo.attach('Mocked summons notice at initial viewport', { path: image, contentType: 'image/png' });
  await fits(page, testInfo);
  const button = page.locator('#summonsNoticeOpen');
  await expect(button).toHaveText('Open Shelf Court');
  await button.focus();
  // Safari uses Option-Tab to include buttons in keyboard navigation.
  const tab = testInfo.project.use.browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(tab);
  await page.keyboard.press('Shift+' + tab);
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#courtVeil')).toBeVisible();
  await expect(page.locator('#courtSheet .sc-summons-case')).toHaveCount(2);
  await page.locator('#courtSheet [data-sc-decline="' + first.id + '"]').click();
  await expect.poll(() => fake.social.summons.get(first.id).status).toBe('declined');
  await expect(page.locator('#summonsNoticeText')).toContainText('1');
});

test('a case arriving later appears on the 30-second inbox check', async ({ page }) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const { ada, bea } = await friends(fake);
  await open(page, fake, bea);
  await expect.poll(() => inboxCalls(fake).length).toBeGreaterThan(0);
  await expect(page.locator('#summonsNotice')).toBeHidden();
  const initial = inboxCalls(fake).length;
  await serve(ada, bea);
  await page.clock.fastForward(30001);
  await expect.poll(() => inboxCalls(fake).length).toBeGreaterThan(initial);
  await expect(page.locator('#summonsNoticeText')).toContainText('You’ve been served.');
  await expect(page.locator('#summonsNotice')).toBeVisible();
  await expect(page.locator('#friendsVeil')).toBeHidden();
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
});

test('a verdict notification leaves its reward and acknowledgement untouched until Court opens', async ({ page }) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const { ada, bea } = await friends(fake);
  const papers = await serve(ada, bea);
  await bea.social.rule(papers.id, { verdict: 'plaintiff', stars: 2, ratings: 60 });
  await open(page, fake, ada);
  await expect(page.locator('#summonsNotice')).toBeVisible();
  await expect(page.locator('#summonsNoticeText')).toContainText('verdict');
  const before = (await localState(page)).mayhem.souls;
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
  expect(fake.social.summons.get(papers.id).sender_seen_at).toBeNull();
  await page.clock.fastForward(60001);
  await expect.poll(() => inboxCalls(fake).length).toBeGreaterThan(1);
  expect((await localState(page)).mayhem.souls).toBe(before);
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
  await page.locator('#summonsNoticeOpen').click();
  await expect(page.locator('#courtSheet .sc-verdict')).toContainText('Bea found for Agnes');
  await expect.poll(() => fake.social.summons.get(papers.id).sender_seen_at).not.toBeNull();
  await expect.poll(async () => (await localState(page)).mayhem.souls).toBe(before + VERDICT_SOULS);
  await expect(page.locator('#summonsNotice')).toBeHidden();
});

test('an account that has not opted into Friends makes no social background requests', async ({ page }) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const player = await socialPlayer(fake, null, shelf(), { social: false, now: () => NOW });
  await open(page, fake, player, { optIn: false });
  await page.clock.fastForward(60001);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await page.clock.fastForward(30001);
  await expect(page.locator('#summonsNotice')).toBeHidden();
  expect(socialCalls(fake)).toEqual([]);
});

test('native pause suspends polling until resume, and online refreshes new papers immediately', async ({ page }) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const { ada, bea } = await friends(fake);
  await open(page, fake, bea);
  await expect.poll(() => inboxCalls(fake).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.hidden)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('shelflife:pause')));
  const beforePause = inboxCalls(fake).length;
  await serve(ada, bea);
  await page.clock.fastForward(30001);
  expect(inboxCalls(fake)).toHaveLength(beforePause);
  await expect(page.locator('#summonsNotice')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('shelflife:resume')));
  await expect.poll(() => inboxCalls(fake).length).toBeGreaterThan(beforePause);
  await expect(page.locator('#summonsNoticeText')).toContainText('1 case waits');
  const afterResume = inboxCalls(fake).length;
  await serve(ada, bea, 2);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => inboxCalls(fake).length).toBeGreaterThan(afterResume);
  await expect(page.locator('#summonsNoticeText')).toContainText('2 cases wait');
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
});

test('an empty shelf can collect its verdict and decline papers for a departed defendant', async ({ page }) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const { ada, bea } = await friends(fake);
  const verdict = await serve(ada, bea);
  await bea.social.rule(verdict.id, { verdict: 'plaintiff', stars: 2, ratings: 60 });
  const incoming = await serve(bea, ada);
  const empty = { ...ada, shelf: { ...ada.shelf, pets: [], slots: Array(18).fill(null) } };
  await open(page, fake, empty);
  await expect(page.locator('#summonsNoticeText')).toContainText('1 case waits');
  await expect(page.locator('#summonsNoticeText')).toContainText('verdict');
  const before = (await localState(page)).mayhem.souls;
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
  await page.locator('#summonsNoticeOpen').click();
  await expect(page.locator('#courtVeil')).toBeVisible();
  await expect(page.locator('#courtSheet .sc-verdict')).toContainText('Bea found for Agnes');
  await expect.poll(() => fake.social.summons.get(verdict.id).sender_seen_at).not.toBeNull();
  await expect.poll(async () => (await localState(page)).mayhem.souls).toBe(before + VERDICT_SOULS);
  await expect(page.locator('#courtSheet .sc-summons-case')).toHaveCount(1);
  await page.locator('#courtSheet [data-sc-decline="' + incoming.id + '"]').click();
  await expect.poll(() => fake.social.summons.get(incoming.id).status).toBe('declined');
  await expect(page.locator('#courtSheet .sc-summons-case')).toHaveCount(0);
  await expect(page.locator('#summonsNotice')).toBeHidden();
  expect((await localState(page)).pets).toEqual([]);
});

test('switching accounts in the same page clears the previous account’s Court verdict cache', async ({ page }) => {
  const fake = createFakeSupabase({ now: () => NOW });
  const { ada, bea } = await friends(fake);
  // Bea already owns this test inbox. The browser signs in through the real
  // Cloud email-code UI; the fake represents delivery with its fixed code.
  Object.assign(fake.users.get(bea.id), { email: 'bea@example.com', is_anonymous: false });
  const papers = await serve(ada, bea);
  await bea.social.rule(papers.id, { verdict: 'plaintiff', stars: 2, ratings: 60 });
  await open(page, fake, ada);
  await expect(page.locator('#summonsNotice')).toBeVisible();
  await page.locator('#summonsNoticeOpen').click();
  await expect(page.locator('#courtSheet .sc-verdict')).toContainText('Bea found for Agnes');
  await expect.poll(() => fake.social.summons.get(papers.id).sender_seen_at).not.toBeNull();
  await page.locator('#courtSheet [data-sc="close"]').click();
  await page.locator('#tabMore').click();
  await page.locator('#cloudBtn').click();
  await page.locator('#cloudSignInOpen').click();
  await page.locator('#cloudEmail').fill('bea@example.com');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudCodeForm')).toBeVisible();
  await page.locator('#cloudCode').fill(FAKE_CODE);
  await page.locator('#cloudConfirm').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Signed in as bea@example.com.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).session.user.id)).toBe(bea.id);
  await page.locator('#cloudClose').click();
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).socialUser)).toBe(bea.id);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  await expect(page.locator('#courtVeil')).toBeVisible();
  await expect(page.locator('#courtSheet .sc-verdict')).toHaveCount(0);
  await expect(page.locator('#courtSheet .sc-summons-case')).toHaveCount(0);
  await expect(page.locator('#courtSheet')).not.toContainText('Bea found for Agnes');
  await expect(page.locator('#summonsNotice')).toBeHidden();
});
