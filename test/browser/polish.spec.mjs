import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

// The polish pass: the things a picky stranger notices in the first minute.
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
test.describe.configure({ timeout: 60000 });

async function openHousehold(page, customize = () => {}, kind = 'established') {
  const snapshot = householdFixture(kind);
  snapshot.settings.theatreOn = false;
  snapshot.settings.muted = true;
  snapshot.lastBackup = Date.now();
  customize(snapshot);
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
const openMore = page => page.locator('#tabMore:visible, #moreBtn:visible').first().click();

// Every piece of text a player reads inside `scope`, with its size. Artwork
// (SVG, sprites, the painted stage signs) and anything hidden is left out.
const smallPrint = (page, scope) => page.evaluate(scope => {
  const root = document.querySelector(scope);
  const found = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg,[aria-hidden="true"],.sprite,.expedition-stage,.project-drawing,[hidden]')) continue;
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (text.length < 2) continue;
    const box = el.getBoundingClientRect(), style = getComputedStyle(el);
    if (!box.width || !box.height || style.visibility === 'hidden') continue;
    const size = parseFloat(style.fontSize);
    if (size < 11) found.push(size + 'px "' + text.slice(0, 30) + '"');
  }
  return found;
}, scope);

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the More tray never leaves a tile beside a hole', async ({ page }) => {
    await openHousehold(page);
    await openMore(page);
    await expect(page.locator('#moreTray')).toHaveClass(/open/);
    const lonely = await page.evaluate(() => [...document.querySelectorAll('#moreTray .tray-grid')].flatMap(grid => {
      const gridBox = grid.getBoundingClientRect();
      const items = [...grid.children].filter(el => el.getBoundingClientRect().height > 0);
      const rows = new Map();
      for (const el of items) { const top = Math.round(el.getBoundingClientRect().top); rows.set(top, [...(rows.get(top) || []), el]); }
      return [...rows.values()].filter(row => row.length === 1 && row[0].getBoundingClientRect().width < gridBox.width - 4)
        .map(row => row[0].textContent.trim().slice(0, 30));
    }));
    expect(lonely).toEqual([]);
    // Back up and Restore sit side by side; the longer job takes the row below.
    const [backup, restore, move] = await Promise.all(['#exportBtn', '#importBtn', '#transferBtn'].map(id => page.locator(id).boundingBox()));
    expect(Math.abs(backup.y - restore.y)).toBeLessThan(2);
    expect(move.y).toBeGreaterThan(backup.y + backup.height - 1);
    expect(await smallPrint(page, '#moreTray')).toEqual([]);
  });

  test('the resident card and the note board keep their small print readable and their chips tappable', async ({ page }) => {
    await openHousehold(page);
    await page.locator('#cabinet .piece[data-id="qa0"]').click();
    await expect(page.locator('#cardVeil')).toHaveClass(/open/);
    expect(await smallPrint(page, '#cardSheet')).toEqual([]);
    // The card's fold-outs are one kind of fold-out.
    const summaries = await page.locator('#cardSheet details > summary').evaluateAll(list => list.filter(el => el.getBoundingClientRect().height)
      .map(el => { const s = getComputedStyle(el); return [s.fontSize, s.color, Math.round(el.getBoundingClientRect().height) >= 44]; }));
    expect(summaries.length).toBeGreaterThan(1);
    for (const summary of summaries) expect(summary).toEqual(summaries[0]);
    await page.keyboard.press('Escape');
    await page.locator('.tab[data-tab="notes"]').click();
    for (const chip of await page.locator('#noteFilters .filter-chip').all()) expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(44);
    // The two tools above the board are the same height.
    const heights = await Promise.all(['#checkBtn', '#clearNotes'].map(id => page.locator(id).evaluate(el => Math.round(el.getBoundingClientRect().height))));
    expect(heights[0]).toBe(heights[1]);
    expect(await smallPrint(page, '#paneNotes')).toEqual([]);
  });

  test('three restore choices stack, the one you came for on top', async ({ page }) => {
    const snapshot = await openHousehold(page);
    await page.locator('#importFile').setInputFiles({ name: 'shelf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
    await expect(page.locator('#restoreVeil')).toHaveClass(/open/);
    const boxes = await Promise.all(['#restoreConfirm', '#restoreBackup', '#restoreCancel'].map(id => page.locator(id).boundingBox()));
    expect(boxes[0].y).toBeLessThan(boxes[1].y);
    expect(boxes[1].y).toBeLessThan(boxes[2].y);
    for (const box of boxes) expect(Math.round(box.width)).toBe(Math.round(boxes[0].width));
    await page.locator('#restoreCancel').click();
  });

  test('the cabinet does not open on three lines of capitals', async ({ page }) => {
    await openHousehold(page, s => { s.mayhem = { souls: 2600, lifetime: 12000, resolved: 140, coffins: 60, rank: 12, curios: {} }; });
    await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
    const head = page.locator('#mayhemSheet .sheet-head');
    await expect(head.locator('h2')).toHaveText('Cabinet of Curiosities');
    // The climb to the next rank is in the rank card below, in full.
    await expect(head.locator('.eyebrow')).toBeHidden();
    await expect(page.locator('#mayhemSheet .mh-rank-card small').first()).toContainText('more souls until');
    expect((await head.boundingBox()).height).toBeLessThan(120);
  });

  test('the expedition planner leads with its title, and its labels meet the floor', async ({ page }) => {
    await openHousehold(page, s => { s.mastery = { expedition: { tier: 1 } }; });
    await page.locator('#tabPlay').click();
    await page.locator('#playroomVeil [data-activity="outing"]').click();
    await expect(page.locator('#lifeVeil.outing-mode')).toBeVisible();
    const order = await page.evaluate(() => {
      const pane = document.querySelector('.expedition-reading-pane');
      const title = pane.querySelector('.expedition-heading').getBoundingClientRect().top;
      const rules = pane.querySelector(':scope > p').getBoundingClientRect().top;
      return { titleFirst: title < rules };
    });
    expect(order.titleFirst).toBe(true);
    expect(await smallPrint(page, '#lifeVeil .expedition-view')).toEqual([]);
  });

  test('a visitor whose host was never written down is not hosted by undefined', async ({ page }) => {
    await openHousehold(page);
    await openMore(page);
    await page.locator('#museumBtn').click();
    await expect(page.locator('#museumVeil')).toHaveClass(/open/);
    await expect(page.locator('#museumContent')).toContainText('host not recorded');
    await expect(page.locator('#museumContent')).not.toContainText('undefined');
  });
});

test('before the game wakes, the shelf shows no buttons that cannot work yet', async ({ page }) => {
  await page.route('**/src/main.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  await expect(page.locator('#actions')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#cabinet')).toBeVisible();
  await page.unroute('**/src/main.js');
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/booted/);
  await expect(page.locator('#actions')).toHaveCSS('visibility', 'visible');
});

test('a select with no styles of its own takes the house look', async ({ page }) => {
  await openHousehold(page);
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await page.locator('#playroomVeil [data-court]').click();
  const look = await page.locator('#courtSheet .sc-cast select').first().evaluate(el => { const s = getComputedStyle(el); return { radius: parseFloat(s.borderTopLeftRadius), appearance: s.appearance }; });
  expect(look.radius).toBeGreaterThan(0);
  expect(look.appearance).toBe('none');
});

test('on a touch screen a tapped tile does not stay lifted', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'hover only sticks on a touch screen');
  await openHousehold(page, s => { s.mayhem = { souls: 420, lifetime: 420, curios: {} }; });
  expect(await page.evaluate(() => matchMedia('(hover:none)').matches)).toBe(true);
  const tile = page.locator('#mayhemDesk [data-mh="cabinet"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.hover();
  await expect(tile).toHaveCSS('transform', 'none');
});
