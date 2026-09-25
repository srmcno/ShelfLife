import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { COURT_CASES } from '../../src/content/court.js';

const SAVE_KEY = 'shelflife.v4';
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});

// A full trial is a lot of dialogue; give it room.
test.describe.configure({ timeout: 120000 });

async function openHousehold(page) {
  const snapshot = householdFixture('established');
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
  return snapshot;
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function openCourt(page) {
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await page.locator('#playroomVeil [data-court]').click();
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
}
// Click through dialogue until the cross-examination buttons (or the verdict) appear.
async function talkUntil(page, target) {
  const box = page.locator('#courtSheet [data-ct-box]');
  for (let i = 0; i < 80; i++) {
    if (await page.locator(target).isVisible()) return;
    await box.click({ force: true });
    await page.waitForTimeout(40);
  }
  await expect(page.locator(target)).toBeVisible();
}
async function object(page, evidenceId) {
  await page.locator('#courtSheet [data-ct="record"]').click();
  await page.locator('#courtSheet [data-ct-ev="' + evidenceId + '"]').click();
  await page.locator('#courtSheet .ct-objection-btn').click();
}
async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.veil.open .sheet')].map(el => ({ width: el.clientWidth, content: el.scrollWidth })));
  for (const dialog of sizes) expect(dialog.content).toBeLessThanOrEqual(dialog.width + 1);
}

test('a whole Shelf Court case: a wasted objection, a press, two breakdowns and an acquittal', async ({ page }) => {
  const snapshot = await openHousehold(page);
  await openCourt(page);
  const first = COURT_CASES[0];
  await expect(page.locator('#courtSheet .ct-case')).toHaveCount(COURT_CASES.length);
  await page.locator('#courtSheet .ct-case.next').click();
  await expect(page.locator('#courtSheet h2')).toHaveText(first.title);
  await talkUntil(page, '#courtSheet [data-ct="press"]');
  await noHorizontalOverflow(page);

  // Statement 1 is true, so objecting to it costs a skull of patience.
  await object(page, 'fork');
  await expect(page.locator('#courtSheet [data-ct-meter] i.on')).toHaveCount(2);
  await talkUntil(page, '#courtSheet [data-ct="press"]');

  for (const [index, witness] of first.witnesses.entries()) {
    const lie = witness.testimony.findIndex(s => s.lie);
    await expect(page.locator('#courtSheet .ct-count')).toHaveText('Statement 1 of ' + witness.testimony.length);
    for (let i = 0; i < lie; i++) await page.locator('#courtSheet [data-ct="next"]').click();
    await expect(page.locator('#courtSheet .ct-count')).toHaveText('Statement ' + (lie + 1) + ' of ' + witness.testimony.length);
    if (index === 0) {
      await page.locator('#courtSheet [data-ct="press"]').click();
      await expect(page.locator('#courtSheet .ct-stand')).toHaveClass(/sweating/);
      await talkUntil(page, '#courtSheet [data-ct="press"]');
    }
    await object(page, Object.keys(witness.testimony[lie].lie)[0]);
    await expect(page.locator('#courtSheet .ct-say-you')).toBeVisible();
    await talkUntil(page, index === 0 ? '#courtSheet [data-ct="press"]' : '#courtSheet .ct-result');
  }
  await expect(page.locator('#courtSheet .ct-result h3')).toHaveText('Not guilty');
  await expect(page.locator('#courtSheet .ct-result')).toContainText('souls');
  await noHorizontalOverflow(page);
  const after = await saved(page);
  expect(after.courtroom.solved).toEqual([first.id]);
  expect(after.courtroom.flawless).toEqual([]);
  expect(after.pets.find(p => p.id === snapshot.pets[0].id).courtCases).toBe(1);

  // Straight on to the next case from the verdict.
  await expect(page.locator('#courtSheet .ct-next-case')).toBeEnabled();
  await page.locator('#courtSheet .ct-next-case').click();
  await expect(page.locator('#courtSheet h2')).toHaveText(COURT_CASES[1].title);
  await page.keyboard.press('Escape');
  await expect(page.locator('#courtVeil')).not.toHaveClass(/open/);
});

test('three wrong objections lose the case and the docket remembers nothing was won', async ({ page }) => {
  await openHousehold(page);
  await openCourt(page);
  await page.locator('#courtSheet .ct-case').nth(2).click();
  await talkUntil(page, '#courtSheet [data-ct="press"]');
  for (let i = 0; i < 3; i++) {
    await object(page, 'forms');
    await talkUntil(page, i < 2 ? '#courtSheet [data-ct="press"]' : '#courtSheet .ct-result');
  }
  await expect(page.locator('#courtSheet .ct-result h3')).toContainText('Guilty');
  await expect(page.locator('#courtSheet .ct-dock')).toHaveClass(/dusted/);
  const after = await saved(page);
  expect(after.courtroom.solved).toEqual([]);
  expect(after.courtroom.trials).toBe(1);
  await page.locator('#courtSheet [data-ct="docket"]').click();
  await expect(page.locator('#courtSheet .ct-case.solved')).toHaveCount(0);
});
