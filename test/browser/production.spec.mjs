import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { ARRIVALS, arrivalDraft } from '../../src/content/arrivals.js';

const SAVE_KEY = 'shelflife.v4';
const test = base.extend({
  // Every scenario checks the actual browser runtime, including asynchronous
  // failures during teardown. Screenshots and traces are retained on failure.
  runtimeErrors: [async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
      await testInfo.attach('browser-state', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => ({
        activeId: document.activeElement?.id, activeTag: document.activeElement?.tagName,
        focused: document.hasFocus(), dialog: document.body.dataset.activeDialog,
        activeHTML: document.activeElement?.outerHTML.slice(0, 800)
      })), null, 2) });
    }
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});

async function openHousehold(page, kind = 'established', customize = () => {}) {
  const snapshot = householdFixture(kind);
  customize(snapshot);
  // Keep automatic scenery from moving the test's resident between the
  // pointer press and release. This is the supported player preference.
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = Date.now();
  await page.addInitScript(({ snapshot, key }) => {
    // Init scripts also run on reload: restoring only once is essential for
    // persistence assertions to test the app's save, rather than reseeding it.
    if (!sessionStorage.getItem('shelflife.browser.fixture')) {
      localStorage.setItem(key, JSON.stringify(snapshot));
      sessionStorage.setItem('shelflife.browser.fixture', '1');
    }
  }, { snapshot, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
  return snapshot;
}

async function savedShelf(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
}

async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    dialogs: [...document.querySelectorAll('.veil.open .sheet')].map(el => ({
      name: el.closest('.veil').id, width: el.clientWidth, content: el.scrollWidth
    }))
  }));
  expect(sizes.document, 'document stays within the viewport').toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.body, 'body stays within the viewport').toBeLessThanOrEqual(sizes.viewport + 1);
  for (const dialog of sizes.dialogs) expect(dialog.content, dialog.name + ' does not clip horizontal content').toBeLessThanOrEqual(dialog.width + 1);
}

async function expectDialogFocus(page, selector) {
  await expect(page.locator(selector)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(selector => document.querySelector(selector)?.contains(document.activeElement), selector)).toBe(true);
  await noHorizontalOverflow(page);
}

const playroomLauncher = page => page.locator('#playroomBtn:visible, #tabPlay:visible').first();

test('fresh boot shows three playable arrivals and a responsive shelf', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.arrival-resident')).toHaveCount(3);
  await expect(page.locator('.arrival-copy h1')).toHaveText('Small creatures.Long memories.');
  for (const arrival of ARRIVALS) await expect(page.locator('[data-arrival="' + arrival.id + '"]')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.locator('#quickHelp').click();
  await expectDialogFocus(page, '#helpVeil');
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpVeil')).not.toBeVisible();
  await expect(page.locator('#quickHelp')).toBeFocused();
});

test('fresh mobile navigation opens populated notes and stories, then returns to arrivals', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'desktop presents these panels together');
  await page.goto('/');
  await expect(page.locator('.arrival-resident')).toHaveCount(3);
  for (const tab of ['notes', 'plots']) {
    await page.locator('.tab[data-tab="' + tab + '"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-tab', tab);
    await expect(page.locator(tab === 'notes' ? '#paneNotes' : '#panePlots')).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.locator('.tab[data-tab="shelf"]').click();
  await expect(page.locator('.arrival-resident').first()).toBeVisible();
});

for (const arrival of ARRIVALS) {
  test('adopting ' + arrival.name + ' preserves the selected portrait, personality and name through reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-arrival="' + arrival.id + '"]').click();
    await expect(page.locator('#studioVeil')).toBeVisible();
    await expect(page.locator('#quickAdopt')).toHaveText('Meet ' + arrival.name);
    await expect(page.locator('#petName')).toHaveValue(arrival.name);
    await noHorizontalOverflow(page);
    await page.locator('#quickAdopt').click();
    await expect(page.locator('#studioVeil')).not.toBeVisible();
    await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
    const draft = arrivalDraft(arrival.id);
    await expect.poll(async () => (await savedShelf(page))?.pets?.[0]?.name).toBe(arrival.name);
    const before = (await savedShelf(page)).pets[0];
    expect(before.art.creature).toEqual(draft.creature);
    expect(before.traits).toEqual(draft.personality.traits);
    await page.reload();
    await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
    const after = (await savedShelf(page)).pets[0];
    expect(after.id).toBe(before.id);
    expect(after.name).toBe(arrival.name);
    expect(after.art.creature).toEqual(draft.creature);
    await noHorizontalOverflow(page);
  });
}

test('care updates the resident, persists on reload and restores keyboard focus', async ({ page }) => {
  const fixture = await openHousehold(page);
  const resident = page.locator('#cabinet .piece[data-id="qa0"]');
  await resident.click();
  await expectDialogFocus(page, '#cardVeil');
  await page.locator('#cardVeil [data-care="food"]').click();
  await expect.poll(async () => (await savedShelf(page)).pets.find(p => p.id === 'qa0').careLog.food).toBe(fixture.pets[0].careLog.food + 1);
  const fed = (await savedShelf(page)).pets.find(p => p.id === 'qa0');
  expect(fed.needs.food).toBeGreaterThan(fixture.pets[0].needs.food);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cardVeil')).not.toBeVisible();
  await expect(resident).toBeFocused();
  await page.reload();
  await expect(resident).toBeVisible();
  const restored = (await savedShelf(page)).pets.find(p => p.id === 'qa0');
  expect(restored.careLog.food).toBe(fed.careLog.food);
  expect(restored.needs.food).toBeGreaterThan(fixture.pets[0].needs.food);
  await noHorizontalOverflow(page);
});

test('a shelf with retained furniture can welcome another resident without losing its objects', async ({ page }) => {
  const fixture = await openHousehold(page, 'established', snapshot => {
    snapshot.pets = [];
    snapshot.slots = snapshot.slots.map(id => snapshot.props.some(prop => prop.id === id) ? id : null);
  });
  for (const prop of fixture.props) await expect(page.locator('#cabinet .piece[data-id="' + prop.id + '"]')).toBeVisible();
  await expect(page.locator('.arrival-invitation')).toHaveCount(0);
  await page.locator('#newPetBtn').click();
  await expect(page.locator('#studioVeil')).toBeVisible();
  await page.locator('#quickAdopt').click();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
  const saved = await savedShelf(page);
  expect(saved.props).toEqual(fixture.props);
  for (const prop of fixture.props) expect(saved.slots).toContain(prop.id);
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
  for (const prop of fixture.props) await expect(page.locator('#cabinet .piece[data-id="' + prop.id + '"]')).toBeVisible();
  await noHorizontalOverflow(page);
});

const activities = [
  { id: 'chase', dialog: '#playVeil', title: 'Crumb Chase' },
  { id: 'memory', dialog: '#playVeil', title: 'Secret handshake' },
  { id: 'alibi', dialog: '#playVeil', title: 'The Alibi' },
  { id: 'outing', dialog: '#lifeVeil', title: 'Beyond the shelf' },
  { id: 'court', dialog: '#lifeVeil', title: 'Shelf Court' },
  { id: 'market', dialog: '#lifeVeil', title: 'The Unlicensed Night Market' }
];
for (const activity of activities) {
  test(activity.id + ' opens, starts real play and closes cleanly at this viewport', async ({ page }) => {
    await openHousehold(page);
    await playroomLauncher(page).click();
    await expect(page.locator('#activityCards [data-activity]')).toHaveCount(6);
    await noHorizontalOverflow(page);
    await page.locator('[data-activity="' + activity.id + '"]').click();
    await expect(page.locator(activity.dialog + ' .sheet-head h2')).toHaveText(activity.title);
    await expectDialogFocus(page, activity.dialog);
    if (activity.id === 'chase') {
      await page.locator('#chaseGo').click();
      await expect(page.locator('#chasePause')).toBeVisible();
      await page.locator('#chaseHop').click();
      await page.locator('#chasePause').click();
      await expect(page.locator('#chaseGo')).toHaveText('Resume chase');
      await expect(page.locator('#chaseDescription')).toContainText('Paused at');
    } else if (activity.id === 'memory') {
      await page.locator('#playStart').click();
      await expect(page.locator('#playReplay')).toBeVisible();
    } else if (activity.id === 'alibi') {
      await page.locator('#playStart').click();
      await expect(page.locator('#alibiStatements button')).toHaveCount(3);
      await page.locator('#alibiStatements button').first().click();
      await expect(page.locator('.alibi-exhibits button')).toHaveCount(3);
    } else if (activity.id === 'outing') {
      await page.locator('[data-life="set-out"]').click();
      await expect(page.locator('[data-life="outing-choice"]')).toHaveCount(3);
      await page.locator('[data-life="outing-choice"][data-choice="0"]').click();
      await expect(page.locator('[data-life="continue-outing"]')).toBeVisible();
      expect((await savedShelf(page)).life.outing.step).toBe(1);
    } else if (activity.id === 'court') {
      await expect(page.locator('#courtCaseTitle')).toBeVisible();
      await expect.poll(async () => (await savedShelf(page)).life.court?.moves?.length).toBe(0);
      await page.locator('[data-life="court-clue"]').first().click();
      await expect.poll(async () => (await savedShelf(page)).life.court.moves[0]?.type).toBe('inspect');
    } else if (activity.id === 'market') {
      await page.locator('[data-life="market-start"]').click();
      await expect(page.locator('[data-life="market-select"]')).toHaveCount(2);
      expect((await savedShelf(page)).life.market.version).toBe(4);
    }
    await noHorizontalOverflow(page);
    const close = page.locator(activity.dialog + ' .sheet-head button');
    await close.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator(activity.dialog)).not.toBeVisible();
    await expect(page.locator('#playroomVeil')).toBeVisible();
    await expect(page.locator('[data-activity="' + activity.id + '"]')).toBeFocused();
    await page.locator('#playroomClose').click();
    await expect(page.locator('.veil.open')).toHaveCount(0);
    await expect(playroomLauncher(page)).toBeFocused();
  });
}

test('installed shell reloads offline with the saved household and usable care', async ({ page, context, browserName }) => {
  // Playwright documents service-worker tooling for Chromium only. WebKit's
  // emulated offline navigation fails internally before the cached page loads.
  // Keep its UI/save coverage above; do not report this as an iOS offline check.
  // https://playwright.dev/docs/service-workers
  test.skip(browserName !== 'chromium', 'Service-worker offline emulation is supported by Playwright on Chromium only');
  await openHousehold(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    const resident = page.locator('#cabinet .piece[data-id="qa0"]');
    await expect(resident).toBeVisible();
    await resident.click();
    await page.locator('#cardVeil [data-care="fuss"]').click();
    await expect.poll(async () => (await savedShelf(page)).pets[0].careLog.fuss).toBe(6);
    await noHorizontalOverflow(page);
  } finally {
    await context.setOffline(false);
  }
});
