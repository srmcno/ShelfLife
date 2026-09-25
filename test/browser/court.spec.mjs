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
// A whole episode is a lot of television; give it room.
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
async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.veil.open .sheet')].map(el => ({ width: el.clientWidth, content: el.scrollWidth })));
  for (const dialog of sizes) expect(dialog.content).toBeLessThanOrEqual(dialog.width + 1);
}
// Click through the show. Dialogue is advanced from inside the page, which
// is quick and never lands on the wrong button; every choice is a real
// click. Questions: always the first on offer. Chaos: the gavel. The
// ruling: whatever `ruling` says.
async function playEpisode(page, ruling, seen = {}) {
  for (let turn = 0; turn < 40; turn++) {
    const state = await page.evaluate(async () => {
      const sheet = document.getElementById('courtSheet');
      for (let n = 0; n < 600; n++) {
        if (sheet.querySelector('.sc-wrap')) return { wrap: true };
        const controls = sheet.querySelector('[data-sc-controls]:not([hidden])');
        const choices = controls ? [...controls.querySelectorAll('[data-sc-choice]')].map(b => b.dataset.scChoice) : [];
        if (choices.length) return { choices };
        sheet.querySelector('[data-sc-box]')?.click();
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return {};
    });
    if (state.wrap) return;
    if (!state.choices) continue;
    let value;
    if (state.choices.includes(ruling)) { value = ruling; seen.ruling = true; await noHorizontalOverflow(page); }
    else if (state.choices.includes('gavel')) { value = 'gavel'; seen.chaos = true; }
    else { value = state.choices[0]; seen.questions = (seen.questions || 0) + 1; }
    await page.locator('#courtSheet [data-sc-choice="' + value + '"]').click();
  }
  await expect(page.locator('#courtSheet .sc-wrap')).toBeVisible();
}

test('a whole episode of Shelf Court: questions, a ruling, a jury vote and a wrap', async ({ page }) => {
  const snapshot = await openHousehold(page);
  await openCourt(page);
  await expect(page.locator('#courtSheet .sc-logo')).toContainText('SHELF COURT');
  await expect(page.locator('#courtSheet .sc-ep')).toHaveCount(COURT_CASES.length);
  const k = COURT_CASES[0];
  await page.locator('#courtSheet [data-sc-case="' + k.id + '"]').click();
  await expect(page.locator('#courtSheet .sc-tonight h3')).toHaveText(k.title);
  await noHorizontalOverflow(page);
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  await expect(page.locator('#courtSheet .sc-seat')).toHaveCount(6);
  const seen = {};
  await playEpisode(page, k.truth, seen);
  expect(seen.questions).toBe(3);
  expect(seen.ruling).toBe(true);
  await expect(page.locator('#courtSheet .sc-seat.agree, #courtSheet .sc-seat.disagree')).toHaveCount(6);
  await expect(page.locator('#courtSheet .sc-wrap h3')).toHaveText('Justice, allegedly, was served');
  await expect(page.locator('#courtSheet .sc-wrap')).toContainText('souls');
  await noHorizontalOverflow(page);
  const after = await saved(page);
  expect(after.courtroom.episodes).toBe(1);
  expect(after.courtroom.justice).toBe(1);
  expect(after.courtroom.best[k.id]).toBeGreaterThanOrEqual(1);
  expect(after.pets.find(p => p.id === snapshot.pets[0].id).courtCases).toBe(1);

  // Straight into the next episode, then walk out mid-show.
  await expect(page.locator('#courtSheet .sc-next')).toBeEnabled();
  await page.locator('#courtSheet .sc-next').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#courtVeil')).not.toHaveClass(/open/);
  expect((await saved(page)).courtroom.episodes).toBe(1);
});

test('the wrong ruling goes out live and the wronged resident holds a grudge', async ({ page }) => {
  const snapshot = await openHousehold(page);
  await openCourt(page);
  const k = COURT_CASES.find(c => c.truth === 'plaintiff');
  await page.locator('#courtSheet [data-sc-case="' + k.id + '"]').click();
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await playEpisode(page, 'defendant');
  await expect(page.locator('#courtSheet .sc-wrap h3')).toHaveText('You got it wrong, live on air');
  await expect(page.locator('#courtSheet .sc-wrap .bad')).toContainText('will remember this');
  const after = await saved(page);
  const plaintiff = after.pets.find(p => p.id === snapshot.pets[0].id);
  expect(plaintiff.grudges).toBe((snapshot.pets[0].grudges || 0) + 1);
  expect(after.courtroom.justice).toBe(0);
  await page.locator('#courtSheet [data-sc="lobby"]').click();
  await expect(page.locator('#courtSheet .sc-ep .sc-ep-stars .on, #courtSheet .sc-ep .sc-ep-stars i')).not.toHaveCount(0);
});
