import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { OMENS_EXTRA } from '../../src/content/omens-extra.js';
import { CHORES_EXTRA } from '../../src/content/chores-extra.js';
import { QUIET_LINES } from '../../src/content/mayhem.js';

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

// The page runs in the timezone set in playwright.config.mjs, not the machine's.
function todayKey(when = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(when).map(x => [x.type, x.value]));
  return parts.year + '-' + (Number(parts.month) - 1) + '-' + Number(parts.day);
}
async function openHousehold(page, omenId, choreIds, caseKind, when = new Date()) {
  const snapshot = householdFixture('established');
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = Date.now();
  const day = todayKey(when);
  snapshot.mayhem = { souls: 200, lifetime: 200, nextAt: Date.now() + 4 * 3600000, serial: 1, queue: [],
    omen: { day, id: omenId, streak: 2, lastDay: day, grace: 1 },
    chores: { day, list: choreIds.map(id => ({ id, have: 0, done: false })), bonus: false } };
  if (caseKind) snapshot.stories = { ...(snapshot.stories || {}), case: { kind: caseKind, week: Math.floor(Date.now() / 604800000), beat: 5, cast: snapshot.pets.slice(0, 2).map(p => ({ id: p.id, name: p.name })), careStart: 0, careClue: 0, playStart: 0, choices: [] } };
  await page.addInitScript(({ snapshot, key }) => {
    if (!sessionStorage.getItem('shelflife.browser.fixture')) {
      localStorage.setItem(key, JSON.stringify(snapshot));
      sessionStorage.setItem('shelflife.browser.fixture', '1');
    }
  }, { snapshot, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}
async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('.veil.open .sheet')].map(el => ({ width: el.clientWidth, content: el.scrollWidth })) }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
  for (const dialog of sizes.dialogs) expect(dialog.content).toBeLessThanOrEqual(dialog.width + 1);
}

test('the longest new omen and chores fit a 320px phone, and a new omen shows its own picture', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const longest = OMENS_EXTRA.reduce((a, b) => (b.line.length > a.line.length ? b : a));
  const chores = CHORES_EXTRA.filter(c => ['feed2', 'wash3', 'check2'].includes(c.id));
  await openHousehold(page, longest.id, chores.map(c => c.id));
  // The desk tile shows the effect sentence and the day's chores by label and line.
  await expect(page.locator('#mayhemDesk .mh-omen-tile b')).toHaveText(longest.name);
  await expect(page.locator('#mayhemDesk .mh-omen-tile small')).toHaveText(longest.line.split('.')[0] + '.');
  for (const c of chores) await expect(page.locator('#mayhemDesk .mh-chores li', { hasText: c.label })).toContainText(c.line);
  await noHorizontalOverflow(page);
  await page.locator('#mayhemDesk [data-mh="omen-view"]').click();
  await expect(page.locator('#mayhemSheet .mh-tarot-face b')).toHaveText(longest.name);
  await expect(page.locator('#mayhemSheet .mh-omen-line')).toHaveText(longest.line);
  await noHorizontalOverflow(page);
  // A new omen must not fall back to the skull every omen without a picture gets.
  const art = await page.locator('#mayhemSheet .mh-tarot-art').innerHTML();
  // Serialise both through the DOM so attribute and self-closing differences cannot matter.
  const render = name => page.evaluate(async glyphName => {
    const holder = document.createElement('div');
    holder.innerHTML = (await import('/src/art/mayhem-glyphs.js')).glyph(glyphName);
    return holder.innerHTML;
  }, name);
  const skull = await render('skull'), own = await render(longest.glyph);
  expect(art).toBe(own);
  expect(art).not.toBe(skull);
});

test('the calm strip carries the longest ambient line without leaving the screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const longest = QUIET_LINES.reduce((a, b) => (b.length > a.length ? b : a));
  const index = QUIET_LINES.indexOf(longest);
  // The strip picks a line by the minute, so pin the clock to a minute that picks the longest.
  let at = Date.now();
  while (Math.floor(at / 60000) % QUIET_LINES.length !== index) at += 60000;
  await page.clock.install({ time: new Date(at) });
  await openHousehold(page, 'wet-hand', ['feed', 'fuss', 'wash'], null, new Date(at));
  await expect(page.locator('#mayhemAlert .mh-alert.calm b').first()).toHaveText(longest);
  await noHorizontalOverflow(page);
});

test('a new case file reads cleanly in the case card at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openHousehold(page, 'wet-hand', ['feed', 'fuss', 'wash'], 'slippers');
  await page.locator('button.tab[data-tab="plots"]').click();
  await page.locator('#correspondenceFolder summary').click();
  const card = page.locator('#caseCard');
  await expect(card.locator('h2')).toHaveText('The footprints too big to be real');
  await expect(card).toContainText('The giant is you.');
  // Names are filled in; no placeholder reaches the player.
  await expect(card).not.toContainText(/\{[pq]\}/);
  await noHorizontalOverflow(page);
});
