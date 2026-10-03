import { test as base, expect } from 'playwright/test';
import { householdFixture, firstDayHousehold } from '../household-fixtures.mjs';

const SAVE_KEY = 'shelflife.v4';
const DAY = 86400000;
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});

// A busy CI runner needs room: the tour walks six real screens.
test.describe.configure({ timeout: 60_000 });

const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(page, snapshot) {
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = Date.now();
  await page.addInitScript(({ snapshot, key }) => {
    if (!sessionStorage.getItem('shelflife.browser.fixture')) {
      localStorage.setItem(key, JSON.stringify(snapshot));
      sessionStorage.setItem('shelflife.browser.fixture', '1');
    }
  }, { snapshot, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}
async function firstDay(page, customize = () => {}) {
  const snapshot = firstDayHousehold();
  customize(snapshot);
  await seed(page, snapshot);
  return snapshot;
}
async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(sizes.document, 'document stays within the viewport').toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.body, 'body stays within the viewport').toBeLessThanOrEqual(sizes.viewport + 1);
}
const card = page => page.locator('#nextStep');

test('a brand new household is walked through its first ten minutes by one card', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[data-arrival="mabel"]').click();
  await page.locator('#quickAdopt').click();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);

  // One card, one verb. The competing strips and badges stay out of the way.
  await expect(card(page)).toHaveAttribute('data-kind', 'guide');
  await expect(card(page).locator('.ns-title')).toHaveText('Say hello to Mabel.');
  await expect(card(page).locator('[data-ns-go]')).toHaveText('Say hello');
  await expect(page.locator('#mayhemAlert')).toBeHidden();
  await expect(page.locator('#shelfBadge')).toBeHidden();
  await expect(page.locator('#cabinet .pet.guide-ring')).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).mayhem.queue.length).toBe(2);

  // 1. say hello: the card opens, and the ring moves to the exact button for the next step.
  await card(page).locator('[data-ns-go]').click();
  await expect(page.locator('#cardVeil')).toHaveClass(/open/);
  await expect(page.locator('#cardVeil [data-care="food"]')).toHaveClass(/guide-ring/);
  await expect.poll(async () => (await saved(page)).life.guide.done).toEqual(['meet']);

  // 2. feed: a real care, a small reward, and the toast says so.
  await page.locator('#cardVeil [data-care="food"]').click();
  await expect.poll(async () => (await saved(page)).life.guide.done).toEqual(['meet', 'feed']);
  await expect(page.locator('#toast')).toContainText('souls', { timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(card(page).locator('.ns-title')).toHaveText('Deal with the emergency.');
  await expect(card(page).locator('.ns-dots .done')).toHaveCount(2);

  // 3. the first emergency: neither choice is recommended over the other.
  await card(page).locator('[data-ns-go]').click();
  await expect(page.locator('#mayhemVeil')).toHaveClass(/open/);
  await expect(page.locator('#mayhemSheet .mh-choice.guide-ring')).toHaveCount(2);
  await page.locator('#mayhemSheet [data-choice="0"]').click();
  await expect(page.locator('#mayhemSheet .mh-stamp')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card(page).locator('.ns-title')).toHaveText('Turn over tonight’s omen.');

  // 4. the omen.
  await card(page).locator('[data-ns-go]').click();
  await expect(page.locator('#mayhemSheet [data-mh="flip"]')).toHaveClass(/guide-ring/);
  await page.locator('#mayhemSheet [data-mh="flip"]').click();
  await expect(page.locator('#mayhemSheet .mh-tarot.face')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card(page).locator('.ns-title')).toHaveText('Read the note board.');

  // 5. a note: the ring is on the Notes tab until the player goes there.
  await expect(page.locator('.tabbar .tab[data-tab="notes"], .room-nav .tab[data-tab="notes"]').first()).toHaveClass(/guide-ring/);
  await card(page).locator('[data-ns-go]').click();
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'notes');
  await expect.poll(async () => (await saved(page)).life.guide.done).toContain('note');
  await page.locator('.tab[data-tab="shelf"]').click();
  await expect(card(page).locator('.ns-title')).toHaveText('Open your first coffin.');
  const rewarded = (await saved(page)).mayhem.souls;
  expect(rewarded, 'the tour paid enough for the first coffin').toBeGreaterThanOrEqual(40);

  // 6. the first coffin.
  await card(page).locator('[data-ns-go]').click();
  await expect(page.locator('#mayhemSheet [data-mh="pry"]')).toHaveClass(/guide-ring/);
  await page.locator('#mayhemSheet [data-mh="pry"]').click();
  await expect(page.locator('#mayhemSheet .mh-curio-card')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await saved(page)).life.guide.status).toBe('done');
  await expect(card(page).locator('.ns-title')).toHaveText('That is the tour.');
  await expect(card(page).locator('.ns-hint')).toContainText('next disaster is due in');
  await card(page).locator('[data-ns-go]').click();
  await expect(card(page)).not.toHaveAttribute('data-kind', 'guide-done');
  await expect(page.locator('#mayhemAlert')).toBeVisible();
  await expect.poll(async () => (await saved(page)).life.guide.celebrated).toBe(true);
  const guide = (await saved(page)).life.guide;
  expect(guide.done).toEqual(['meet', 'feed', 'emergency', 'omen', 'note', 'coffin']);
  await noHorizontalOverflow(page);
});

test('the tour survives a reload, can be skipped, and comes back from Help', async ({ page }) => {
  await firstDay(page);
  await card(page).locator('[data-ns-go]').click();
  await page.locator('#cardVeil [data-care="food"]').click();
  await page.keyboard.press('Escape');
  await expect(card(page).locator('.ns-title')).toHaveText('Deal with the emergency.');
  await page.reload();
  await expect(card(page).locator('.ns-title')).toHaveText('Deal with the emergency.');
  await expect(card(page).locator('.ns-dots .done')).toHaveCount(2);

  await card(page).locator('[data-ns-skip]').click();
  await expect(card(page)).not.toHaveAttribute('data-kind', 'guide');
  await expect(page.locator('body')).not.toHaveAttribute('data-guide', 'on');
  expect((await saved(page)).life.guide.status).toBe('skipped');
  await expect(page.locator('#mayhemDesk .mh-chores')).toBeVisible();

  await page.locator('#quickHelp').click();
  await expect(page.locator('#helpTour li.done')).toHaveCount(2);
  await page.locator('[data-help-resume]').click();
  await expect(page.locator('#helpVeil')).not.toHaveClass(/open/);
  await expect(card(page)).toHaveAttribute('data-kind', 'guide');
  await expect(card(page).locator('.ns-title')).toHaveText('Deal with the emergency.');
});

test('an established household never sees the tour and keeps the whole desk and the omen strip', async ({ page }) => {
  await seed(page, householdFixture('established'));
  await expect(page.locator('#mayhemAlert .mh-alert.omen')).toBeVisible();
  await expect(card(page)).not.toHaveAttribute('data-kind', 'guide');
  await expect(card(page).locator('[data-ns-skip]')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-guide', 'on');
  await expect(page.locator('#mayhemDesk .mh-chores')).toBeVisible();
  await expect(page.locator('#mayhemDesk [data-mh="cabinet"]')).toBeVisible();
  await expect(page.locator('#mayhemDesk .mh-teaser')).toHaveCount(0);
  await expect(page.locator('#shelfBadge')).toHaveText('2');
  // The card never repeats what the omen strip above it already says.
  await expect(card(page)).toHaveAttribute('data-kind', 'emergency');
  expect((await saved(page)).life.guide ?? null).toBeNull();
  await page.locator('.tab[data-tab="plots"]').click();
  await expect(page.locator('#lockedFolders')).toBeHidden();
  await expect(page.locator('#correspondenceFolder')).toBeVisible();
});

test('the desk grows over the first days, by the calendar and by what has been done', async ({ page }) => {
  await firstDay(page);
  // Day one: the alert and the souls, a line about what is coming, and nothing more.
  await expect(page.locator('#mayhemDesk .mh-teaser')).toBeVisible();
  for (const hidden of ['.mh-chores', '.mh-omen-tile', '.mh-today', '[data-mh="cabinet"]']) await expect(page.locator('#mayhemDesk ' + hidden)).toHaveCount(0);
});

test('on the second day, once something has been solved, the omen and chores arrive', async ({ page }) => {
  await firstDay(page, s => {
    s.started = Date.now() - 2 * DAY;
    s.life.guide = { v: 1, status: 'done', at: Date.now() - 1.5 * DAY, seen: ['meet', 'note'], done: ['meet', 'feed', 'emergency', 'omen', 'note', 'coffin'], finishedAt: Date.now() - 1.5 * DAY, celebrated: true };
    s.mayhem = { resolved: 3, coffins: 1, lifetime: 90, souls: 10, nextAt: Date.now() + 600000, omen: { day: 'old', id: 'wet-hand', streak: 1, lastDay: 'old', grace: 1 } };
    s.life.introDone = true;
  });
  await expect(page.locator('#mayhemDesk .mh-chores')).toBeVisible();
  await expect(page.locator('#mayhemDesk .mh-omen-tile')).toBeVisible();
  // Not yet the third day: the Playroom board and the Cabinet wait.
  const guide = (await saved(page)).life.guide;
  const day = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(guide.at).setHours(0, 0, 0, 0)) / DAY) + 1;
  if (day < 3) {
    await expect(page.locator('#mayhemDesk .mh-today')).toHaveCount(0);
    await expect(page.locator('#mayhemDesk .mh-teaser')).toContainText('Playroom board');
  }
});

test('Stories shows what is still locked, with a way to open it, instead of hiding it', async ({ page }) => {
  await firstDay(page);
  await page.locator('.tab[data-tab="plots"]').click();
  await expect(page.locator('#acquaintPanel')).toBeVisible();
  await expect(page.locator('#acquaintPanel .acq-dots')).toHaveAttribute('aria-label', 'Step 1 of 3');
  const locked = page.locator('#lockedFolders .folder-locked');
  await expect(locked).toHaveCount(2);
  await expect(locked.first()).toContainText('Visitors & conspiracies');
  await expect(locked.first()).toContainText('Opens after your first household memory');
  await expect(locked.first()).toHaveAttribute('aria-disabled', 'true');
  expect(await locked.first().evaluate(el => el.disabled), 'aria-disabled, not disabled, so it can explain itself').toBe(false);
  expect(await locked.first().evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await locked.first().click({ force: true });
  await expect(page.locator('#welcomePanel')).toBeFocused();
  // Any first memory opens the rest.
  await page.locator('#acquaintPanel [data-life="skip"]').click();
  await expect(page.locator('#lockedFolders')).toBeHidden();
  await expect(page.locator('#correspondenceFolder')).toBeVisible();
  await expect(page.locator('#acquaintPanel')).toBeHidden();
});

test('a need mark explains itself, and the glossary opens at the right entry', async ({ page }) => {
  await firstDay(page, s => { s.pets[0].needs.food = 20; s.pets[0].needs.clean = 30; });
  const marks = page.locator('#cabinet .pip[data-gloss="needs"]');
  await expect(marks).toHaveCount(2);
  await expect(marks.first()).toHaveAttribute('aria-label', 'Hungry');
  await expect(marks.first()).toContainText('F');
  await marks.first().click();
  const tip = page.locator('#glossCard');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Needs');
  await expect(page.locator('#cardVeil')).not.toHaveClass(/open/);
  await tip.locator('[data-gl-more]').click();
  await expect(page.locator('#helpVeil')).toHaveClass(/open/);
  await expect(page.locator('#helpTabGlossary')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#gl-needs')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpVeil')).not.toHaveClass(/open/);
});

test('Help is a labelled button with First day and Glossary, and focus comes back to it', async ({ page }) => {
  await firstDay(page);
  const help = page.locator('#quickHelp');
  await expect(help).toContainText('Help');
  expect(await help.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await help.click();
  await expect(page.locator('#helpVeil')).toHaveClass(/open/);
  await expect(page.locator('#helpTabFirst')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#helpTabGlossary').click();
  await expect(page.locator('#helpPanelGlossary')).toBeVisible();
  await expect(page.locator('#helpPanelFirst')).toBeHidden();
  for (const term of ['Souls', 'Bond', 'Household trust', 'Nerve', 'Trail points', 'Wager', 'Mastery', 'Stars']) await expect(page.locator('#helpGlossary dt', { hasText: new RegExp('^' + term) }).first()).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
});

test('the Cabinet carries the rank and its progress, and explains souls', async ({ page }) => {
  await firstDay(page);
  await page.locator('#soulsHud').click();
  await expect(page.locator('#mayhemSheet .sheet-head .eyebrow')).toContainText('Suspiciously Normal');
  await expect(page.locator('#mayhemSheet .sheet-head .eyebrow')).toContainText('souls to Mildly Damp');
  await page.locator('#mayhemSheet [data-gloss="souls"]').click();
  await expect(page.locator('#glossCard')).toBeVisible();
  await expect(page.locator('#glossCard')).toContainText('What the shelf pays you');
  await page.locator('#glossCard [data-gl-close]').click();
  await expect(page.locator('#glossCard')).toBeHidden();
  await expect(page.locator('#mayhemVeil')).toHaveClass(/open/);
});

test('Calm mode stills the room, forces light effects and is remembered', async ({ page }) => {
  await firstDay(page);
  await page.locator('#tabMore, #moreBtn').filter({ visible: true }).first().click();
  const calm = page.locator('#calmBtn');
  await expect(calm).toHaveAttribute('aria-pressed', 'false');
  await calm.click();
  await expect(calm).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveClass(/calm/);
  await expect(page.locator('body')).toHaveAttribute('data-effects', 'light');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.locator('.souls-icon').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect.poll(async () => (await saved(page)).settings.calm).toBe(true);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/calm/);
  await page.locator('#tabMore, #moreBtn').filter({ visible: true }).first().click();
  await expect(page.locator('#calmBtn')).toHaveAttribute('aria-pressed', 'true');
});

test('the first shelf screen on a small phone has one number, big targets and readable type', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await firstDay(page, s => { s.pets[0].needs.food = 20; });
  await expect(card(page)).toBeVisible();
  const report = await page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
    const fold = [...document.querySelectorAll('button, a[href], select, summary, input')].filter(visible).filter(el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    const small = fold.filter(el => !el.closest('.pip') && (el.getBoundingClientRect().height < 43.5 || el.getBoundingClientRect().width < 43.5)).map(el => (el.id || el.className) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
    const tiny = [...document.querySelectorAll('#cabinet .nameplate, .souls-count small, .ns-kicker, .tabbar .tab span, .pip b')].filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 11).map(el => el.className + ' ' + getComputedStyle(el).fontSize);
    return { count: fold.length, small, tiny, status: getComputedStyle(document.getElementById('statusBar')).display };
  });
  expect(report.small, 'every control on the first screen is at least 44px').toEqual([]);
  expect(report.tiny, 'nameplates, kickers and tab labels are at least 11px').toEqual([]);
  expect(report.status, 'phones show souls only in the top bar').toBe('none');
  expect(report.count, 'first screen taps').toBeLessThanOrEqual(11);
  await noHorizontalOverflow(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await noHorizontalOverflow(page);
});

test('another module can add to the one card, by priority', async ({ page }) => {
  await seed(page, householdFixture('established'));
  await page.evaluate(async () => {
    const { registerNextStepExtras } = await import('/src/ui/nextstep.js');
    registerNextStepExtras(() => [{ id: 'gift', label: 'Your daily gift is waiting', hint: 'It keeps until midnight.', tab: 'plots', priority: 950, verb: 'Collect' }]);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(card(page)).toHaveAttribute('data-step', 'extra:gift');
  await expect(card(page).locator('.ns-title')).toHaveText('Your daily gift is waiting');
  await expect(card(page).locator('[data-ns-go]')).toHaveText('Collect');
  await card(page).locator('[data-ns-go]').click();
  await expect(page.locator('body')).toHaveAttribute('data-tab', 'plots');
});

test('locked furniture and locked drawing colours stay focusable and say what opens them', async ({ page }) => {
  // The tour keeps the shelf buttons out of the way; a player who skipped it has them.
  await firstDay(page, s => { s.life.guide = { v: 1, status: 'skipped', at: Date.now(), seen: [], done: [], finishedAt: 0, celebrated: false }; });
  await page.locator('#tabMore, #moreBtn').filter({ visible: true }).first().click();
  await page.locator('#decorBtn').click();
  const lockedProp = page.locator('#propTray .prop-card.locked').first();
  await expect(lockedProp).toHaveAttribute('aria-disabled', 'true');
  expect(await lockedProp.evaluate(el => el.disabled), 'aria-disabled, not disabled').toBe(false);
  await expect(lockedProp).toContainText('Needs household trust');
  await lockedProp.click({ force: true }); // Playwright treats aria-disabled as not enabled; a finger would tap it
  await expect(lockedProp).toContainText('Household trust is 0 of');
  await page.locator('#decorClose').click();
  await page.locator('#newPetBtn').click();
  await page.locator('#tabDraw').click();
  await expect(page.locator('#swatches .sw-locked')).toHaveCount(9);
  await expect(page.locator('#swatchUnlock')).toContainText('Next: three loud colors at household trust 10');
  await page.locator('#swatches .sw-locked').nth(4).click({ force: true });
  await expect(page.locator('#swatchUnlock')).toContainText('Opens at household trust 30: three colors that should not exist');
  await expect(page.locator('#stamps .chip-locked')).toHaveCount(4);
  await expect(page.locator('#stampUnlock')).toContainText('a third eye and antlers');
});
