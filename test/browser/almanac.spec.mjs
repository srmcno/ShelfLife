import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { weekNumber, weeklyChallenges } from '../../src/engine/almanac.js';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

const KEY = 'shelflife.v4';
const IN_CHAPTER = new Date('2026-10-20T20:00:00Z');     // 15:00 in America/Chicago, inside The Thin Season
const JANUARY = new Date('2027-01-15T20:00:00Z');       // three chapters have finished
const DAY = 86400000;
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);

async function open(page, when, tweak, kind = 'veteran') {
  const s = householdFixture(kind, when.getTime());
  s.settings.theatreOn = false; s.lastBackup = when.getTime(); s.life.introDone = true;
  tweak?.(s, when.getTime());
  await page.clock.setFixedTime(when);
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('almanac-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('almanac-fixture', '1'); } }, s);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
const wide = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1));

test('the desk shows the running chapter and its sheet opens, claims and survives a reload', async ({ page }) => {
  await open(page, IN_CHAPTER);
  const tile = page.locator('#mayhemDesk .alm-tile');
  await expect(tile).toContainText('The Thin Season');
  await expect(tile).toContainText('days left');
  await expect(tile).toContainText('ready to claim');
  await tile.click();
  await expect(page.locator('#almanacVeil')).toHaveClass(/open/);
  await expect(page.locator('#almanacSheet h2')).toContainText('The Thin Season');
  await expect(page.locator('#almanacSheet .alm-countdown')).toContainText('days left');
  await expect(page.locator('#almanacSheet .alm-curios li')).toHaveCount(4);
  const before = (await saved(page)).mayhem.souls;
  await page.locator('#almanacSheet .alm-row.ready [data-alm="claim"]').first().click();
  await expect(page.locator('#almanacSheet .alm-result')).toContainText('Tier 6');
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 35);
  expect((await saved(page)).almanac.chapters['thin-2026'].claimed).toBe(31 + 32);
  await page.locator('#almanacSheet [data-alm="claim-all"]').click();
  await expect(page.locator('#almanacSheet .alm-result')).toContainText('Just collected');
  await expect(page.locator('#almanacSheet [data-alm="claim"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#almanacVeil')).not.toHaveClass(/open/);
  await page.reload();
  await expect(page.locator('#mayhemDesk .alm-tile')).toContainText('Next: 45 souls');
  await expect(page.locator('#mayhemDesk .alm-tile')).not.toContainText('ready to claim');
  const after = await saved(page);
  expect(after.almanac.stats.tiers).toBeGreaterThanOrEqual(10);
  expect(after.mayhem.curios['al1-wall-swatch']).toBe(1);
});

test('the Almanac sheet fits a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, IN_CHAPTER);
  expect(await wide(page)).toBe(false);
  await page.locator('#mayhemDesk .alm-tile').click();
  await expect(page.locator('#almanacVeil')).toHaveClass(/open/);
  expect(await wide(page)).toBe(false);
  await page.locator('#almanacSheet .alm-all summary').click();
  expect(await wide(page)).toBe(false);
  for (const button of await page.locator('#almanacSheet .btn').all()) {
    const box = await button.boundingBox();
    if (box) expect(box.height, 'tap target').toBeGreaterThanOrEqual(43);
  }
});

test('coming back after days away brings a card and a chest, opened once', async ({ page }) => {
  await open(page, IN_CHAPTER, (s, now) => { s.returns.seenAt = now - 3 * DAY; s.returns.claimedDay = ''; });
  const card = page.locator('#mayhemDesk .alm-return');
  await expect(card).toBeVisible();
  await expect(card).toContainText('While you were away');
  await expect(card).toContainText('140 souls');
  const before = (await saved(page)).mayhem.souls;
  await card.locator('[data-ret="claim"]').click();
  await expect(page.locator('#mayhemDesk .alm-return')).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 140);
  await page.reload();
  await expect(page.locator('#mayhemDesk .alm-return')).toHaveCount(0);
  expect((await saved(page)).returns.claimed).toBe(4);
});

test('a household that has been here all along sees no return card', async ({ page }) => {
  await open(page, IN_CHAPTER, null, 'established');
  await expect(page.locator('#mayhemDesk .alm-return')).toHaveCount(0);
  await expect(page.locator('#mayhemDesk .alm-tile')).toContainText('The Thin Season');
  const s = await saved(page);
  expect(s.decor.owned).toContain('room:aubergine');
  expect(s.almanac.init).toBe(1);
});

test('the cabinet shows the collections and a finished set pays once', async ({ page }) => {
  await open(page, IN_CHAPTER, s => {
    for (const id of ['tooth-not-yours', 'suspicious-mushroom', 'moth-wing', 'formal-mouse']) s.mayhem.curios[id] = 1;
  });
  await page.locator('#soulsHud').click();
  await expect(page.locator('#mayhemSheet.mh-cabinet')).toBeVisible();
  await expect(page.locator('#mayhemSheet.fr-tin')).toHaveCount(1);
  const sets = page.locator('#colSets');
  await expect(sets).toContainText('Collections');
  const specimens = sets.locator('.col-set', { hasText: 'Specimens' });
  await expect(specimens).toHaveClass(/complete/);
  const before = (await saved(page)).mayhem.souls;
  await specimens.locator('[data-col="claim"]').click();
  await expect.poll(async () => (await saved(page)).collections.claimed).toContain('specimens');
  expect((await saved(page)).mayhem.souls).toBe(before + 120);
  await expect(sets.locator('.col-set', { hasText: 'Specimens' })).toHaveClass(/claimed/);
  expect(await wide(page)).toBe(false);
  await expect(page.locator('#mayhemSheet .col-legacy')).toContainText('Legacy 2');
});

test('the Exchange sells a Back Issue, asks twice for a big purchase and survives a reload', async ({ page }) => {
  await open(page, JANUARY, s => { s.mayhem.souls = 5000; s.mayhem.lifetime = 9000; });
  await page.locator('#tabMore').click();
  await page.locator('#exchangeBtn').click();
  await expect(page.locator('#exchangeVeil')).toHaveClass(/open/);
  await expect(page.locator('#exchangeSheet .ex-bargain')).toContainText('This week');
  const row = page.locator('#exchangeSheet .ex-row', { hasText: 'Candle That Burns Cold' });
  await row.locator('[data-ex="back"]').click();
  await expect(page.locator('#exchangeSheet .ex-notice')).toContainText('back in the cabinet');
  await expect.poll(async () => (await saved(page)).mayhem.curios['al1-cold-candle']).toBe(1);
  expect((await saved(page)).mayhem.souls).toBe(5000 - 450);
  // A frame costing 1,800 asks again before it buys.
  await page.locator('[data-ex="tab"][data-id="frames"]').click();
  const gilt = page.locator('#exchangeSheet .ex-row', { hasText: 'Gilt by Association' });
  await gilt.locator('[data-ex="frame"]').click();
  expect((await saved(page)).exchange.frames).not.toContain('gilt');
  await expect(gilt.locator('[data-ex="frame"]')).toContainText('Tap again');
  await gilt.locator('[data-ex="frame"]').click();
  await expect.poll(async () => (await saved(page)).exchange.frame).toBe('gilt');
  expect(await wide(page)).toBe(false);
  await page.reload();
  expect((await saved(page)).exchange.frames).toContain('gilt');
});

test('bought rooms appear under Decorate and everything free is still there', async ({ page }) => {
  await open(page, JANUARY, s => { s.mayhem.souls = 3000; });
  await page.locator('#tabMore').click();
  await page.locator('#decorBtn').click();
  await expect(page.locator('#roomOpts button')).toHaveCount(7);    // six free rooms and the Pumpkin Hollow this veteran earned
  await expect(page.locator('#roomOpts [data-decor-value="catacomb-chic"]')).toHaveCount(0);
  await page.locator('#decorShop').click();
  await expect(page.locator('#exchangeVeil')).toHaveClass(/open/);
  await page.locator('#exchangeSheet .ex-row', { hasText: 'Catacomb Chic' }).locator('[data-ex="decor"]').click();
  await expect(page.locator('#exchangeSheet .ex-notice')).toContainText('Catacomb Chic');
  await page.locator('#exchangeSheet [data-ex="decorate"]').click();
  await expect(page.locator('#roomOpts [data-decor-value="catacomb-chic"]')).toHaveCount(1);
  await page.locator('#roomOpts [data-decor-value="catacomb-chic"]').click();
  await expect(page.locator('#roomOpts [data-decor-value="catacomb-chic"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).decor.room).toBe('catacomb-chic');
});

test('weekly challenges can be collected and the chest opens once all three are done', async ({ page }) => {
  await open(page, IN_CHAPTER, (s, now) => {
    s.almanac.week = { no: weekNumber(now), counts: {}, done: weeklyChallenges(weekNumber(now)).map(c => c.id), claimed: [], chest: 0 };
  });
  await page.locator('#mayhemDesk .alm-tile').click();
  const collect = page.locator('#almanacSheet [data-alm="weekly"]');
  await expect(collect).toHaveCount(3);
  const before = (await saved(page)).mayhem.souls;
  await collect.first().click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 30);
  await page.locator('#almanacSheet [data-alm="chest"]').click();
  await expect.poll(async () => (await saved(page)).almanac.stats.chests).toBe(2);
  await expect(page.locator('#almanacSheet .alm-chest.done')).toBeVisible();
});

test('before the first chapter opens the Almanac says so and nothing breaks', async ({ page }) => {
  await open(page, new Date('2026-09-10T20:00:00Z'));
  await expect(page.locator('#mayhemDesk .alm-tile')).toContainText('Opens in');
  await page.locator('#mayhemDesk .alm-tile').click();
  await expect(page.locator('#almanacSheet')).toContainText('1 October 2026');
  expect(await wide(page)).toBe(false);
});

test('a freeze that saved a streak is told once, even if the Almanac is never opened', async ({ page }) => {
  await open(page, IN_CHAPTER, s => { s.streaks.notices = [{ kind: 'omen', type: 'saved', day: '2026-10-19', seen: 0 }]; });
  await expect.poll(async () => (await saved(page)).streaks.notices[0]?.seen).toBe(1);
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
  expect((await saved(page)).streaks.notices[0].seen).toBe(1);
});
