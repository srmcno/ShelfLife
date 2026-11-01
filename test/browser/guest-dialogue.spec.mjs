import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { generateCreature } from '../../src/art/creatures.js';

test('a visiting resident speaks safely even when cloud is unavailable', async ({ page }) => {
  const now = Date.now();
  const shelf = householdFixture('established', now);
  shelf.lastBackup = now;
  shelf.friendVisits = {
    guests: [{ visitId: '10000000-0000-4000-8000-000000000001', from: { userId: '10000000-0000-4000-8000-000000000002', name: '<b>Bea</b>' },
      resident: { id: 'guest', name: '<img src=x>', traits: ['critic'], mood: 'fine', bond: 1, art: { creature: generateCreature({ seed: 'guest' }) } },
      arrived: now - 1000, leaves: now + 86400000 }],
    away: [], care: {}, postcards: [], souvenirs: [], paid: []
  };
  await page.addInitScript(value => localStorage.setItem('shelflife.v4', JSON.stringify(value)), shelf);
  await page.goto('/');
  await page.locator('#guestPlank [data-guest]').click();
  await expect(page.locator('#guestSheet h2')).toHaveText('<img src=x>');
  await expect(page.locator('#guestSheet .gc-reaction')).toContainText('<img src=x>');
  await expect(page.locator('#guestSheet img')).toHaveCount(0);
  await expect(page.locator('#guestSheet [data-gc="food"]')).toBeDisabled();
});

test('a delayed care reply belongs to its guest and cannot overwrite a restored shelf', async ({ page }) => {
  await page.goto('/privacy.html');
  await page.evaluate(async () => {
    document.body.innerHTML = '<main id="paneShelf"><div class="stage"></div></main><div class="veil" id="guestVeil"><div class="sheet" id="guestSheet"></div></div>';
    const now = Date.now();
    const make = (visitId, name) => ({ visitId, from: { userId: '10000000-0000-4000-8000-000000000009', name: 'Bea' },
      resident: { id: name, name, traits: [], mood: 'fine', bond: 0, art: null }, arrived: now - 1000, leaves: now + 86400000 });
    window.guestFixture = { pets: [{ id: 'home', name: 'Mabel' }], friendVisits: { guests: [
      make('10000000-0000-4000-8000-000000000001', 'Gladys'), make('10000000-0000-4000-8000-000000000002', 'Snag')
    ], care: {}, away: [], postcards: [], souvenirs: [], paid: [] } };
    window.mockOwner = 'owner-one';
    const postbox = { care: () => new Promise(resolve => { window.finishCare = resolve; }), subscribe: () => {} };
    const social = { active: () => true, userId: () => window.mockOwner };
    const { initGuests } = await import('/src/ui/guests.js');
    initGuests({ state: window.guestFixture, social, postbox, save: () => {} });
  });
  const first = '10000000-0000-4000-8000-000000000001', second = '10000000-0000-4000-8000-000000000002';
  await page.locator(`[data-guest="${first}"]`).click();
  await page.locator('#guestSheet [data-gc="food"]').click();
  await page.locator('#guestSheet [data-gc="close"]').click();
  await page.locator(`[data-guest="${second}"]`).click();
  const before = await page.locator('#guestSheet .gc-reaction').textContent();
  await page.evaluate(() => window.finishCare({ fed: 1, fussed: 0, washed: 0 }));
  await expect.poll(() => page.evaluate(id => window.guestFixture.friendVisits.care[id]?.food, first)).toBe(1);
  await expect(page.locator('#guestSheet .gc-reaction')).toHaveText(before);
  await expect(page.locator('#guestSheet .gc-reaction')).not.toContainText('Gladys');

  await page.locator('#guestSheet [data-gc="food"]').click();
  await page.evaluate(id => {
    window.guestFixture.friendVisits.care[id] = { food: 7, fuss: 0, clean: 0 };
    window.dispatchEvent(new CustomEvent('shelflife:state-replaced'));
    window.finishCare({ fed: 1, fussed: 0, washed: 0 });
  }, second);
  await expect(page.locator('#guestSheet [data-gc="food"]')).toBeEnabled();
  expect(await page.evaluate(id => window.guestFixture.friendVisits.care[id].food, second)).toBe(7);

  await page.locator('#guestSheet [data-gc="food"]').click();
  await page.evaluate(() => {
    window.mockOwner = 'owner-two';
    window.finishCare({ fed: 9, fussed: 0, washed: 0 });
  });
  await expect(page.locator('#guestSheet [data-gc="food"]')).toBeEnabled();
  expect(await page.evaluate(id => window.guestFixture.friendVisits.care[id].food, second)).toBe(7);
});
