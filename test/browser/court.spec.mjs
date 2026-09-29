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
async function playEpisode(page, ruling, seen = {}, { stopAtHall = false } = {}) {
  for (let turn = 0; turn < 40; turn++) {
    const state = await page.evaluate(async stopAtHall => {
      const sheet = document.getElementById('courtSheet');
      let hall = null;
      for (let n = 0; n < 600; n++) {
        // The hall cam: its own set over the studio, with the loser in front.
        const set = sheet.querySelector('.sc-stage.sc-hallway .sc-hall');
        if (set) {
          hall ||= { losers: set.querySelectorAll('.sc-hall-loser').length, hidden: set.getAttribute('aria-hidden'), name: '', reporter: false, overflow: 0, studioHidden: getComputedStyle(sheet.querySelector('.sc-bench')).visibility === 'hidden' };
          hall.name ||= set.querySelector('[data-sc-hall-name]')?.textContent || '';
          hall.reporter ||= sheet.querySelector('[data-sc-name]')?.textContent === 'Hall cam reporter';
          hall.overflow = Math.max(hall.overflow, sheet.scrollWidth - sheet.clientWidth);
          if (stopAtHall) return { atHall: true };
        }
        if (sheet.querySelector('.sc-wrap')) return { wrap: true, hall, back: !sheet.querySelector('.sc-hall, .sc-hallway') };
        const controls = sheet.querySelector('[data-sc-controls]:not([hidden])');
        const choices = controls ? [...controls.querySelectorAll('[data-sc-choice]')].map(b => b.dataset.scChoice) : [];
        if (choices.length) return { choices };
        sheet.querySelector('[data-sc-box]')?.click();
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return {};
    }, stopAtHall);
    if (state.atHall) return;
    if (state.wrap) { seen.hall = state.hall; seen.backInStudio = state.back; return; }
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
  // After the ruling the show cut to the hallway set and back again.
  expect(seen.hall).toMatchObject({ losers: 1, hidden: 'true', reporter: true, studioHidden: true });
  expect(snapshot.pets.map(p => p.name)).toContain(seen.hall.name);
  expect(seen.hall.overflow).toBeLessThanOrEqual(1);
  expect(seen.backInStudio).toBe(true);
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
  await playEpisode(page, 'defendant', {}, { stopAtHall: true });
  // The hallway advances from the keyboard like the rest of the show.
  await expect(page.locator('#courtSheet .sc-stage.sc-hallway .sc-hall-loser.p')).toHaveCount(1);
  for (let i = 0; i < 12 && !(await page.locator('#courtSheet .sc-wrap').count()); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  await expect(page.locator('#courtSheet .sc-wrap')).toBeVisible();
  await expect(page.locator('#courtSheet .sc-hall')).toHaveCount(0);
  await expect(page.locator('#courtSheet .sc-wrap h3')).toHaveText('You got it wrong, live on air');
  await expect(page.locator('#courtSheet .sc-wrap .bad')).toContainText('will remember this');
  const after = await saved(page);
  const plaintiff = after.pets.find(p => p.id === snapshot.pets[0].id);
  expect(plaintiff.grudges).toBe((snapshot.pets[0].grudges || 0) + 1);
  expect(after.courtroom.justice).toBe(0);
  await page.locator('#courtSheet [data-sc="lobby"]').click();
  await expect(page.locator('#courtSheet .sc-ep .sc-ep-stars .on, #courtSheet .sc-ep .sc-ep-stars i')).not.toHaveCount(0);
});
