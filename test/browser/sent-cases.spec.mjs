import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase, FAKE_CODE } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { VERDICT_SOULS } from '../../src/engine/court.js';

// The other player and email delivery are mocked. Browser controls and the
// persisted game state use the same application code as ordinary play.
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
const NOW = Date.UTC(2026, 9, 3, 17);
function shelf(names = ['Agnes', 'Lord Dampington III', 'Pip']) {
  const state = householdFixture('established', NOW);
  state.settings.theatreOn = false;
  state.lastBackup = NOW;
  state.pets.forEach((pet, i) => { pet.name = names[i]; pet.names = [{ name: names[i], at: state.started }]; });
  return state;
}
async function world() {
  const fake = createFakeSupabase({ now: () => NOW });
  const ada = await socialPlayer(fake, 'Ada', shelf(), { now: () => NOW });
  const bea = await socialPlayer(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda']), { now: () => NOW });
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  await bea.social.publish({ force: true });
  return { fake, ada, bea };
}
const serve = (ada, bea, side = 'p') => ada.social.serve({ to: bea.id, caseId: 'borrowed-coffin',
  plaintiff: ada.shelf.pets[0], defendant: bea.shelf.pets[1], side });
async function open(page, fake, player) {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW + 1000);
  await page.addInitScript(({ config, state, meta }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('sent.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(state));
      localStorage.setItem('shelflife.cloud', JSON.stringify(meta));
      sessionStorage.setItem('sent.fixture', '1');
    }
  }, { config: fake.config, state: player.shelf, meta: { session: player.session, socialUser: player.id } });
  await page.route(fake.url + '/**', route => fake.route(route));
  fake.requests.length = 0;
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
}
async function openFriends(page) {
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toBeVisible();
  await expect(page.locator('#friendsSheet [data-fr-sent]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#friendsSheet .fr-code')).not.toContainText('Fetching');
}
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
const history = page => page.locator('#friendsSheet [data-fr-sent]');
const rows = page => page.locator('#friendsSheet [data-fr-sent-case]');

test('serving papers immediately adds a waiting case and offers View my cases', async ({ page }) => {
  const { fake, ada } = await world();
  await open(page, fake, ada);
  await openFriends(page);
  await expect(history(page)).toContainText('No cases sent yet.');
  const bea = page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' });
  await bea.locator('[data-fr="menu"]').click();
  await bea.locator('[data-fr="serve"]').click();
  await page.locator('#friendsSheet .fr-res').filter({ hasText: 'Snag' }).locator('[data-fr="papers"]').click();
  await page.locator('#frCase').selectOption('borrowed-coffin');
  await page.locator('#frPlaintiff').selectOption('qa0');
  await page.locator('#friendsSheet [data-fr-form="serve"] button[type="submit"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toContainText('Papers served.');
  await page.locator('#friendsSheet [data-fr="sent-view"]').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Agnes is suing Snag');
  await expect(rows(page).first()).toContainText('Bea’s shelf.');
  await expect(rows(page).first()).toContainText('Waiting for a hearing');
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
});

test('a reversed-side verdict keeps its canonical winner after acknowledgement, reopening and reload', async ({ page }) => {
  const { fake, ada, bea } = await world();
  const papers = await serve(ada, bea, 'd');
  await bea.social.rule(papers.id, { verdict: 'plaintiff', stars: 2, ratings: 64 });
  await open(page, fake, ada);
  const before = (await state(page)).mayhem.souls;
  await openFriends(page);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Snag is suing Agnes');
  await expect(rows(page).first()).toContainText('Found for Agnes. 2 stars, ratings 64.');
  await expect.poll(() => fake.social.summons.get(papers.id).sender_seen_at).not.toBeNull();
  await expect.poll(async () => (await state(page)).mayhem.souls).toBe(before + VERDICT_SOULS);
  const acknowledgements = fake.calls('/rest/v1/rpc/mark_summons_seen').length;
  await page.keyboard.press('Escape');
  await openFriends(page);
  await expect(rows(page).first()).toContainText('Found for Agnes. 2 stars, ratings 64.');
  await page.reload();
  await openFriends(page);
  await expect(rows(page).first()).toContainText('Found for Agnes. 2 stars, ratings 64.');
  await page.locator('#friendsSheet [data-fr="sent-refresh"]').click();
  await expect(history(page)).toHaveAttribute('aria-busy', 'false');
  expect((await state(page)).mayhem.souls).toBe(before + VERDICT_SOULS);
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toHaveLength(acknowledgements);
});

test('declined and expired papers remain visible without a verdict or reward', async ({ page }, testInfo) => {
  const { fake, ada, bea } = await world();
  const declined = await serve(ada, bea);
  await bea.social.decline(declined.id);
  const expired = await serve(ada, bea);
  fake.social.summons.get(expired.id).created_at = new Date(NOW - 31 * 86400000).toISOString();
  await open(page, fake, ada);
  const before = (await state(page)).mayhem.souls;
  await openFriends(page);
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('[data-fr-sent-case="' + declined.id + '"]')).toContainText('Declined. No verdict was issued.');
  await expect(page.locator('[data-fr-sent-case="' + expired.id + '"]')).toContainText('Expired after 30 days');
  expect((await state(page)).mayhem.souls).toBe(before);
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
  await history(page).scrollIntoViewIfNeeded();
  const desktop = testInfo.outputPath('sent-cases-desktop.png');
  await page.screenshot({ path: desktop });
  await testInfo.attach('Mocked sent-case history at initial viewport', { path: desktop, contentType: 'image/png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await history(page).scrollIntoViewIfNeeded();
  const mobile = testInfo.outputPath('sent-cases-mobile.png');
  await page.screenshot({ path: mobile });
  await testInfo.attach('Mocked sent-case history at phone width', { path: mobile, contentType: 'image/png' });
});

test('older cases paginate and a failed background refresh preserves history, drafts and input focus', async ({ page }) => {
  const { fake, ada, bea } = await world();
  for (let i = 0; i < 22; i++) {
    const papers = await serve(ada, bea);
    await bea.social.decline(papers.id);
    fake.social.summons.get(papers.id).created_at = new Date(NOW - i * 60000).toISOString();
  }
  await open(page, fake, ada);
  let fail = false;
  await page.route(fake.url + '/rest/v1/summons**', route => {
    if (!fail || route.request().method() !== 'GET') return fake.route(route);
    return route.fulfill({ status: 503, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'fake_failure', message: 'Injected history outage' }) });
  });
  await openFriends(page);
  await expect(rows(page)).toHaveCount(20);
  await page.locator('#friendsSheet [data-fr="sent-older"]').click();
  await expect(rows(page)).toHaveCount(22);
  const ids = await rows(page).evaluateAll(elements => elements.map(el => el.dataset.frSentCase));
  expect(new Set(ids).size).toBe(22);
  await expect(page.locator('#friendsSheet [data-fr="sent-older"]')).toHaveCount(0);
  await page.locator('#frName').fill('Unsaved nickname');
  await page.locator('#frName').evaluate(el => { el.focus(); el.setSelectionRange(3, 3); });
  fail = true;
  await page.clock.fastForward(30001);
  await expect(history(page)).toContainText('Could not update your cases.');
  await expect(rows(page)).toHaveCount(22);
  await expect(page.locator('#frName')).toHaveValue('Unsaved nickname');
  await expect(page.locator('#frName')).toBeFocused();
  expect(await page.locator('#frName').evaluate(el => el.selectionStart)).toBe(3);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const box = await history(page).evaluate(el => ({ content: el.scrollWidth, width: el.clientWidth }));
    expect(box.content).toBeLessThanOrEqual(box.width + 1);
  }
  fail = false;
  await page.locator('#friendsSheet [data-fr="sent-retry"]').click();
  await expect(history(page)).not.toContainText('Could not update your cases.');
  await expect(rows(page)).toHaveCount(20);
  await expect(page.locator('#frName')).toHaveValue('Unsaved nickname');
});

test('switching accounts clears sent-case history before the next account opens Friends', async ({ page }) => {
  const { fake, ada, bea } = await world();
  const papers = await serve(ada, bea);
  await bea.social.decline(papers.id);
  Object.assign(fake.users.get(bea.id), { email: 'bea@example.com', is_anonymous: false });
  await open(page, fake, ada);
  await openFriends(page);
  await expect(rows(page)).toHaveCount(1);
  await page.evaluate(async code => {
    const { cloud } = await import('/src/cloud/index.js');
    await cloud.requestEmailCode('bea@example.com', { mode: 'signin' });
    await cloud.verifyEmailCode('bea@example.com', code);
  }, FAKE_CODE);
  await page.clock.fastForward(250);
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await openFriends(page);
  await expect(history(page)).toContainText('No cases sent yet.');
  await expect(rows(page)).toHaveCount(0);
});

test('a delayed previous-account friend list cannot publish its verdict or pay it after an account switch', async ({ page }) => {
  const { fake, ada, bea } = await world();
  const papers = await serve(ada, bea);
  await bea.social.rule(papers.id, { verdict: 'plaintiff', stars: 2, ratings: 64 });
  Object.assign(fake.users.get(bea.id), { email: 'bea@example.com', is_anonymous: false });
  await open(page, fake, ada);
  let release, held = false;
  await page.route(fake.url + '/rest/v1/rpc/list_friends', async route => {
    if (!held && route.request().headers().authorization === 'Bearer ' + ada.session.access_token) {
      held = true;
      await new Promise(resolve => { release = resolve; });
    }
    return fake.route(route);
  });
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  await expect.poll(() => held).toBe(true);
  const before = (await state(page)).mayhem.souls;
  await page.evaluate(async code => {
    const { cloud } = await import('/src/cloud/index.js');
    await cloud.requestEmailCode('bea@example.com', { mode: 'signin' });
    await cloud.verifyEmailCode('bea@example.com', code);
  }, FAKE_CODE);
  await page.clock.fastForward(250);
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await openFriends(page);
  await expect(history(page)).toContainText('No cases sent yet.');
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/rest/v1/rpc/list_friends') &&
    response.request().headers().authorization === 'Bearer ' + ada.session.access_token);
  release();
  await (await oldResponse).finished();
  await expect.poll(() => fake.calls('/rest/v1/rpc/list_friends').filter(r => r.auth === 'Bearer ' + ada.session.access_token).length).toBe(1);
  await page.clock.runFor(100);
  await expect(page.locator('#friendsSheet')).not.toContainText('Bea found for Agnes');
  await expect(rows(page)).toHaveCount(0);
  expect((await state(page)).mayhem.souls).toBe(before);
  expect(fake.social.summons.get(papers.id).sender_seen_at).toBeNull();
  expect(fake.calls('/rest/v1/rpc/mark_summons_seen')).toEqual([]);
});
