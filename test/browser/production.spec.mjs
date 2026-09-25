import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { ARRIVALS, arrivalDraft } from '../../src/content/arrivals.js';
import { ESCAPADES } from '../../src/content/escapades.js';
import { startEscapade } from '../../src/engine/escapades.js';

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
  expect(sizes.viewport, 'long content must not enlarge the mobile layout viewport').toBeLessThanOrEqual(page.viewportSize().width + 1);
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

test('navigation opens populated notes and stories, then returns to arrivals at every size', async ({ page }) => {
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

const arcadeGames = [
  { id: 'frenzy', title: 'Feeding Frenzy' },
  { id: 'stack', title: 'Coffin Stack' },
  { id: 'seance', title: 'The Séance' },
  { id: 'whack', title: 'Grave Whack' }
];
test('the playroom offers four arcade games and expeditions, one tap from playing', async ({ page }) => {
  await openHousehold(page);
  await playroomLauncher(page).click();
  await expect(page.locator('#activityCards [data-game]')).toHaveCount(4);
  await expect(page.locator('#activityCards [data-activity="outing"]')).toHaveCount(1);
  await noHorizontalOverflow(page);
  await page.locator('[data-activity="outing"]').click();
  await expect(page.locator('#lifeVeil .sheet-head h2')).toHaveText('Beyond the shelf');
  await page.locator('[data-life="set-out"]').click();
  await expect(page.locator('[data-life="outing-choice"]')).toHaveCount(3);
  await page.locator('[data-life="outing-choice"][data-choice="0"]').click();
  await expect(page.locator('[data-life="continue-outing"]')).toBeVisible();
  expect((await savedShelf(page)).life.outing.step).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lifeVeil')).not.toBeVisible();
});
for (const game of arcadeGames) {
  test(game.id + ' opens, plays for real, pauses and closes cleanly at this viewport', async ({ page }) => {
    await openHousehold(page);
    await playroomLauncher(page).click();
    await page.locator('[data-game="' + game.id + '"]').click();
    await expect(page.locator('#arcadeVeil .sheet-head h2')).toHaveText(game.title);
    await expectDialogFocus(page, '#arcadeVeil');
    await page.locator('#arcadeSheet [data-ar="play"]').click();
    await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
    if (game.id === 'stack') { await page.keyboard.press('Space'); await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('1'); }
    if (game.id === 'frenzy') { await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft'); }
    if (game.id === 'seance') await expect(page.locator('#arcadeSheet .ar-candle')).toHaveCount(4);
    if (game.id === 'whack') await expect(page.locator('#arcadeSheet .ar-grave')).toHaveCount(9);
    await page.locator('#arcadeSheet [data-ar="pause"]').click();
    await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
    await page.locator('#arcadeSheet .ar-paused').click();
    await expect(page.locator('#arcadeSheet .ar-paused')).toHaveCount(0);
    await noHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#arcadeVeil')).not.toBeVisible();
    await expect(page.locator('.veil.open')).toHaveCount(0);
  });
}

async function finishStack(page) {
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('1');
  for (let i = 0; i < 80 && !(await page.locator('#arcadeSheet .ar-over').count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(170); }
  await expect(page.locator('#arcadeSheet .ar-over')).toBeVisible();
}

test('a finished arcade run saves its best, pays souls and offers another go', async ({ page }) => {
  await openHousehold(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: 'stack', petId: 'qa0' } })));
  await finishStack(page);
  const shelf = await savedShelf(page);
  expect(shelf.arcade.plays.stack).toBe(1);
  expect(shelf.arcade.best.stack).toBeGreaterThanOrEqual(1);
  expect(shelf.mayhem.souls).toBeGreaterThan(0);
  expect(shelf.pets[0].arcadeRuns).toBe(1);
  await expect(page.locator('#arcadeSheet .ar-again')).toBeFocused();
  await noHorizontalOverflow(page);
  await page.reload();
  expect((await savedShelf(page)).arcade.best.stack).toBe(shelf.arcade.best.stack);
});

test('installed shell reloads offline with saved adventure progress, usable care and the illustrated play rug', async ({ page, context, browserName }) => {
  // Playwright documents service-worker tooling for Chromium only. WebKit's
  // emulated offline navigation fails internally before the cached page loads.
  // Keep its UI/save coverage above; do not report this as an iOS offline check.
  // https://playwright.dev/docs/service-workers
  test.skip(browserName !== 'chromium', 'Service-worker offline emulation is supported by Playwright on Chromium only');
  await openHousehold(page, 'established', snapshot => {
    startEscapade(snapshot, { episodeId:'crumb-observatory', approachId:'orbit', petId:'qa0' });
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    const resident = page.locator('#cabinet .piece[data-id="qa0"]');
    await expect(resident).toBeVisible();
    await resident.click();
    await page.locator('#cardVeil [data-care="fuss"]').click();
    await expect.poll(async () => (await savedShelf(page)).pets[0].careLog.fuss).toBe(6);
    expect((await savedShelf(page)).escapades.active.careAt).toBeNull();
    await page.locator('#cardVeil [data-care="food"]').click();
    await expect.poll(async () => (await savedShelf(page)).escapades.active.careAt).not.toBeNull();
    await page.reload();
    await page.locator('.tab[data-tab="plots"]').click();
    await page.locator('#escapadeOpen').click();
    await expect(page.locator('#escapadeContent .escapade-steps .done')).toHaveCount(1);
    await noHorizontalOverflow(page);
    await page.keyboard.press('Escape');await page.locator('.tab[data-tab="shelf"]').click();
    await page.locator('#hangoutBtn').click();
    const illustration=await page.evaluate(async()=>{const result=await fetch('assets/rooms/play-rug.webp');const bytes=await result.blob();return{ok:result.ok,type:bytes.type,size:bytes.size};});
    expect(illustration.ok).toBe(true);expect(illustration.type).toContain('image/webp');expect(illustration.size).toBeGreaterThan(100_000);
    await page.locator('[data-rug-toy="bubbles"]').click();await page.locator('#rugAction').click();await page.locator('#rugPop').click();
    await expect(page.locator('#rugTally')).toHaveText('1 / 6');
    await page.reload();await page.locator('#hangoutBtn').click();await expect(page.locator('#rugTally')).toHaveText('1 / 6');
  } finally {
    await context.setOffline(false);
  }
});

async function beginObservatory(page, approach = 'orbit', petId = 'qa0') {
  await page.locator('.tab[data-tab="plots"]').click();
  await page.locator('#escapadeOpen').click();
  await expect(page.locator('#escapadeTitle')).toHaveText('The Crumb Observatory');
  const effects = await page.evaluate(() => ({ mode:document.body.dataset.effects, blur:getComputedStyle(document.getElementById('escapadeVeil')).backdropFilter }));
  if (effects.mode === 'light') expect(effects.blur, 'adventure dialog honors light effects').toBe('none');
  await page.locator('#escapadeResident').selectOption(petId);
  await page.locator('[data-escapade="start"][data-approach="' + approach + '"]').click();
  await expect.poll(async () => (await savedShelf(page)).escapades.active?.petId).toBe(petId);
}

async function adventureSnack(page) {
  await page.locator('#escapadeContent [data-escapade="care"]').click();
  await expect(page.locator('#cardVeil')).toBeVisible();
  await page.locator('#cardVeil [data-care="food"]').click();
  await expect.poll(async () => (await savedShelf(page)).escapades.active.careAt).not.toBeNull();
  await page.locator('#cardVeil [data-escapade="open"]').click();
}

test('a real arcade adventure earns a chosen keepsake that survives reload', async ({ page }) => {
  test.setTimeout(90_000);
  await openHousehold(page);
  await beginObservatory(page, 'equipment');
  await adventureSnack(page);
  await page.reload();
  await page.locator('.tab[data-tab="plots"]').click();
  await page.locator('#escapadeOpen').click();
  await expect(page.locator('#escapadeContent .escapade-steps .done')).toHaveCount(1);
  await page.locator('#escapadeContent [data-escapade="play"]').click();
  await expect(page.locator('#arcadeVeil .sheet-head h2')).toHaveText('Coffin Stack');
  await finishStack(page);
  await expect.poll(async () => (await savedShelf(page)).escapades.active.playAt).not.toBeNull();
  await page.locator('#arcadeSheet [data-escapade="open"]').click();
  await expect(page.locator('#escapadeContent [data-escapade="finish"]')).toHaveCount(2);
  const before = (await savedShelf(page)).life.xp;
  await page.locator('[data-escapade="finish"][data-ending="supper"]').click();
  await expect(page.locator('.escapade-receipt')).toContainText('Kept with Agnes');
  await expect(page.locator('#escapadeTitle')).toHaveText('A Saucer for a Comet');
  const finished = await savedShelf(page);
  expect(finished.life.xp).toBe(before + 2);
  expect(finished.escapades.active).toBeNull();
  expect(finished.escapades.album[0]).toMatchObject({ petId:'qa0', endingId:'supper', episodeId:'crumb-observatory' });
  await noHorizontalOverflow(page);
  await page.reload();
  await page.locator('.tab[data-tab="plots"]').click();
  await page.locator('#escapadeAlbum').click();
  await expect(page.locator('.escapade-album-item')).toHaveCount(1);
});

test('full needs permit a story moment while abandoning a run never completes it', async ({ page }) => {
  await openHousehold(page, 'capped');
  await beginObservatory(page, 'equipment');
  await adventureSnack(page);
  await page.locator('#escapadeContent [data-escapade="play"]').click();
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await page.keyboard.press('Space');
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await page.reload();
  const active = (await savedShelf(page)).escapades.active;
  expect(active.careAt).not.toBeNull();
  expect(active.playAt).toBeNull();
  await page.locator('.tab[data-tab="plots"]').click();
  await page.locator('#escapadeOpen').click();
  await expect(page.locator('[data-escapade="finish"]')).toHaveCount(0);
  await expectDialogFocus(page, '#escapadeVeil');
});

test('a fourth resident leads their own arcade adventure', async ({ page }) => {
  test.setTimeout(60_000);
  await openHousehold(page, 'conflicting');
  await beginObservatory(page, 'equipment', 'qa3');
  await page.locator('#escapadeContent [data-escapade="play"]').click();
  await expect(page.locator('#arcadeVeil .eyebrow')).toContainText('Bitey');
  await finishStack(page);
  await expect.poll(async () => (await savedShelf(page)).escapades.active.playAt).not.toBeNull();
  expect((await savedShelf(page)).pets.find(p => p.id === 'qa3').arcadeRuns).toBe(1);
  await noHorizontalOverflow(page);
});

test('replayed ending celebrates the current resident while the album preserves its first maker', async ({ page }) => {
  await openHousehold(page, 'established', snapshot => {
    const at = Date.now() - 60_000;
    snapshot.escapades = { version:1, completions:1, album:[{ key:'crumb-observatory:discovery', episodeId:'crumb-observatory', endingId:'discovery', approachId:'orbit', petId:'qa0', petName:'Agnes', at }], active:{ episodeId:'crumb-observatory', approachId:'orbit', petId:'qa2', petName:'Pip', startedAt:at+1000, careAt:at+2000, playAt:at+3000 } };
  });
  const before = (await savedShelf(page)).life.xp;
  await page.locator('.tab[data-tab="plots"]').click();
  await page.locator('#escapadeOpen').click();
  await page.locator('[data-escapade="finish"][data-ending="discovery"]').click();
  await expect(page.locator('.escapade-receipt')).toContainText('Kept with Pip');
  await expect(page.locator('.escapade-receipt')).toContainText('A familiar keepsake');
  const after = await savedShelf(page);
  expect(after.life.xp).toBe(before);
  expect(after.escapades.album).toHaveLength(1);
  expect(after.escapades.album[0].petId).toBe('qa0');
  expect(after.life.scenes[0].cast).toEqual(['qa2']);
  await page.locator('#escapadeContent [data-escapade="album"]').click();
  await page.locator('.escapade-album-item').click();
  await expect(page.locator('.escapade-receipt')).toContainText('Kept with Agnes');
});

test('the complete keepsake album and long resident names fit a 320px screen', async ({ page }) => {
  // Opening all 16 receipts means 34 pointer actions plus acceptance of a story.
  test.setTimeout(60_000);
  await page.setViewportSize({ width:320, height:740 });
  await openHousehold(page, 'nearly-full', snapshot => {
    const petName = 'W'.repeat(22), at = Date.now() - 60_000;
    snapshot.pets[0].name = petName;
    snapshot.escapades = { version:1, active:null, completions:16, album:ESCAPADES.flatMap((episode, i) => episode.endings.map((ending, j) => ({ key:episode.id+':'+ending.id, episodeId:episode.id, endingId:ending.id, approachId:episode.approaches[0].id, petId:'qa0', petName, at:at+i*100+j }))) };
  });
  await noHorizontalOverflow(page);
  await page.locator('.tab[data-tab="plots"]').click();
  await page.locator('#escapadeAlbum').click();
  await expect(page.locator('.escapade-album-item')).toHaveCount(16);
  await noHorizontalOverflow(page);
  for (let i = 0; i < 16; i++) {
    await page.locator('.escapade-album-item').nth(i).click();
    await expect(page.locator('.escapade-receipt-art svg')).toHaveCount(1);
    await expect(page.locator('.escapade-receipt')).toContainText('W'.repeat(22));
    await noHorizontalOverflow(page);
    await page.locator('#escapadeContent [data-escapade="album"]').click();
  }
  await page.locator('#escapadeClose').click();
  await beginObservatory(page);
  await noHorizontalOverflow(page);
  await page.locator('#escapadeClose').click();
  await noHorizontalOverflow(page);
});

test('a long browser stall pauses an arcade run instead of skipping ahead', async ({ page }) => {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => request(time => {
      if (window.shelfTestFrameDelay) window.setTimeout(() => callback(performance.now()), window.shelfTestFrameDelay);
      else callback(time);
    });
  });
  await openHousehold(page);
  await playroomLauncher(page).click();
  await page.locator('[data-game="frenzy"]').click();
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await page.evaluate(() => { window.shelfTestFrameDelay = 2400; });
  await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
  await page.evaluate(() => { window.shelfTestFrameDelay = 0; });
  await page.locator('#arcadeSheet .ar-paused').click();
  await expect(page.locator('#arcadeSheet .ar-paused')).toHaveCount(0);
  await expect(page.locator('#arcadeSheet .ar-over')).toHaveCount(0);
});


