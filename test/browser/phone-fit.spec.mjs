import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

// iPhone SE with Safari's toolbars showing: the smallest screen people
// actually play on. Every sheet must let a finger reach its last line, and a
// game's controls must never sit below the fold.
const SAVE_KEY = 'shelflife.v4';
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ viewport: { width: 375, height: 548 } });

async function openHousehold(page) {
  const snapshot = householdFixture('established');
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = Date.now();
  snapshot.mayhem = { souls: 400, lifetime: 400 };
  await page.addInitScript(({ snapshot, key }) => {
    if (!sessionStorage.getItem('shelflife.browser.fixture')) {
      localStorage.setItem(key, JSON.stringify(snapshot));
      sessionStorage.setItem('shelflife.browser.fixture', '1');
    }
  }, { snapshot, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}
// Scroll the open sheet the way a finger would, then check its lowest
// visible content is on screen.
async function bottomReachable(page, label) {
  const centre = await page.evaluate(() => {
    const veil = document.querySelector('.veil.open');
    const sheet = veil.querySelector('.sheet') || veil;
    const box = sheet.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: Math.min(innerHeight - 60, box.top + box.height / 2) };
  });
  await page.mouse.move(centre.x, centre.y);
  for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 500);
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const sheet = document.querySelector('.veil.open .sheet');
    let lowest = 0, text = '';
    for (const el of sheet.querySelectorAll('button,a,p,li,h3,select,label')) {
      if (el.closest('[hidden],details:not([open]) > :not(summary)')) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (box.bottom > lowest) { lowest = box.bottom; text = el.textContent.trim().slice(0, 40); }
    }
    return { lowest: Math.round(lowest), height: innerHeight, text };
  });
  expect(result.lowest, label + ': "' + result.text + '" is below the fold').toBeLessThanOrEqual(result.height);
}
const close = async page => { await page.keyboard.press('Escape'); await expect(page.locator('.veil.open')).toHaveCount(0); };

test('on a small phone every sheet scrolls to its last line and game controls stay on screen', async ({ page }) => {
  await openHousehold(page);
  const playroom = page.locator('#playroomBtn:visible, #tabPlay:visible').first();

  await playroom.click();
  await bottomReachable(page, 'playroom');
  await close(page);

  await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
  await bottomReachable(page, 'curio cabinet');
  await close(page);

  await page.locator('#mayhemDesk [data-mh="coffin"]').click();
  await bottomReachable(page, 'coffin');
  await close(page);

  await playroom.click();
  await page.locator('#playroomVeil [data-court]').click();
  await bottomReachable(page, 'shelf court');
  await close(page);

  for (const game of ['frenzy', 'stack']) {
    await playroom.click();
    await page.locator('#playroomVeil [data-game="' + game + '"]').click();
    await page.locator('#arcadeSheet [data-ar="play"]').click();
    await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
    const lowest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#arcadeSheet button, #arcadeSheet [data-ar-field]')].map(el => el.getBoundingClientRect().bottom)));
    expect(lowest, game + ' controls below the fold').toBeLessThanOrEqual(548);
    await close(page);
  }
});
