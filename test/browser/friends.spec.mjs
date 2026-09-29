import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer, pageSession, socialCalls } from '../support/social-world.mjs';
import { generateCreature } from '../../src/art/creatures.js';
import { docketCaseId } from '../../src/engine/court.js';
import { COURT_BY_ID } from '../../src/engine/court.js';

// The Friends sheet against the in-memory Supabase. The page is one player;
// the others live in this process and share the same fake server.
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The social layer is checked once, with phone widths set explicitly');
});

function todayKey() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day);
}
function household() {
  const s = householdFixture('established');
  s.settings.theatreOn = false;
  s.lastBackup = Date.now();
  return s;
}
const beaShelf = () => ({ pets: [
  { id: 'bea0', name: 'Gladys', traits: ['damp', 'spiteful'], needs: { food: 90, fuss: 90, clean: 90 }, bond: 4, art: { body: '', stamps: [], creature: generateCreature({ seed: 'gladys' }) } },
  { id: 'bea1', name: 'Snag', traits: ['nocturnal'], needs: { food: 20, fuss: 20, clean: 20 }, bond: 1, art: { body: '', stamps: [], creature: generateCreature({ seed: 'snag' }) } }
] });

async function open(page, { fake, session } = {}) {
  await page.addInitScript(({ snapshot, config, session }) => {
    if (config) globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('friends.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      if (session) localStorage.setItem('shelflife.cloud', session);
      sessionStorage.setItem('friends.fixture', '1');
    }
  }, { snapshot: household(), config: fake?.config || null, session: session || null });
  if (fake) await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
}
async function openFriends(page) {
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toBeVisible();
}
async function fits(page, widths = [320, 390]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
      sheet: [...document.querySelectorAll('.veil.open .sheet')].map(el => [el.scrollWidth, el.clientWidth]),
      wide: [...document.querySelectorAll('.veil.open .sheet *')].filter(el => !el.closest('.sprite, svg') && el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1).map(el => el.className || el.tagName).slice(0, 5) }));
    expect(sizes.document, 'no horizontal page scroll at ' + width).toBeLessThanOrEqual(sizes.viewport + 1);
    for (const [content, box] of sizes.sheet) expect(content, 'the sheet does not clip at ' + width).toBeLessThanOrEqual(box + 1);
    expect(sizes.wide, 'nothing pokes out at ' + width).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('without config there is no Friends button and not a single outside request', async ({ page }) => {
  const outside = [];
  page.on('request', request => { if (!request.url().startsWith('http://localhost')) outside.push(request.url()); });
  await open(page);
  await page.locator('#tabMore').click();
  await expect(page.locator('#exportBtn')).toBeVisible();
  await expect(page.locator('#friendsBtn')).toHaveCount(0);
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await page.locator('#moreClose').click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
  await expect(page.locator('#courtSheet [data-sc-summons]')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(outside).toEqual([]);
});

test('a guest is sent to Cloud save first, and nothing is asked of the server', async ({ page }) => {
  const fake = createFakeSupabase();
  await open(page, { fake });
  await page.locator('#tabMore').click();
  await expect(page.locator('#friendsBtnSub')).toHaveText('Needs cloud save first');
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#cloudVeil')).toBeVisible();
  await expect(page.locator('#cloudEnable')).toBeVisible();
  await expect(page.locator('#friendsVeil')).toBeHidden();
  expect(fake.requests).toEqual([]);
});

test('add a friend by code, accept one, visit a shelf and serve papers', async ({ page }) => {
  test.setTimeout(90_000);
  const fake = createFakeSupabase();
  const ada = await socialPlayer(fake, null, null, { social: false });
  const bea = await socialPlayer(fake, 'Bea', beaShelf());
  await bea.social.publish({ force: true });
  const cat = await socialPlayer(fake, '<img src=x onerror=y>');
  fake.requests.length = 0;
  await open(page, { fake, session: pageSession(ada) });
  await expect.poll(() => fake.calls('push_save').length, 'cloud save carries on as before').toBe(1);
  expect(socialCalls(fake), 'nothing social before Friends is opened').toEqual([]);

  await page.locator('#tabMore').click();
  await expect(page.locator('#friendsBtnSub')).toHaveText('Shelves, papers and scores');
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toBeVisible();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Friends');
  const code = await expect.poll(() => fake.profiles.get(ada.id)?.friend_code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/).then(() => fake.profiles.get(ada.id).friend_code);
  await expect(page.locator('#friendsSheet [data-fr-code]')).toHaveText(code.slice(0, 4) + ' ' + code.slice(4));
  await expect(page.locator('#friendsSheet .fr-empty')).toHaveText('Nobody yet. Swap codes with someone you know.');
  await expect.poll(() => fake.social.shelves.get(ada.id)?.snapshot.residents.map(r => r.name), 'opening Friends shows friends the shelf').toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  await fits(page);

  // Name, then a friend by code.
  await page.locator('#frName').fill('Ada');
  await page.locator('#frName').press('Enter');
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Friends now see you as Ada.');
  await page.locator('#frAdd').fill('zzzz zzzz');
  await page.locator('#frAdd').press('Enter');
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Nobody has that code. Check it and try again.');
  await expect(page.locator('#frAdd')).toHaveValue('zzzz zzzz');
  await page.locator('#frAdd').fill(bea.code.toLowerCase());
  await page.locator('#friendsSheet .fr-add button[type="submit"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Asked. They appear here once they add you back.');
  await expect(page.locator('#frAdd')).toHaveValue('');
  await expect(page.locator('#friendsSheet .fr-pending')).toContainText('Waiting for them to add you back.');
  await expect(page.locator('#friendsSheet .fr-pending')).not.toContainText('Bea');

  // Bea says yes; Cat, with a name that is trying something, asks too.
  await bea.social.respond(ada.id, true);
  await cat.social.addFriend(code);
  await page.keyboard.press('Escape');
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await expect(page.locator('#tabMore')).toBeFocused();
  await openFriends(page);
  const request = page.locator('#friendsSheet .fr-pending');
  await expect(request).toContainText('<img src=x onerror=y>');
  await expect(page.locator('#friendsSheet img')).toHaveCount(0);
  await request.locator('[data-fr="accept"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Friends now. Their shelf is open to you, and yours to them.');
  await expect(page.locator('#friendsSheet .fr-friend .fr-who b')).toHaveText(['<img src=x onerror=y>', 'Bea']);

  // Report and block the one with the name.
  const catRow = page.locator('#friendsSheet .fr-friend').filter({ hasText: '<img' });
  await catRow.locator('[data-fr="menu"]').click();
  await expect(catRow.locator('[data-fr="visit"]')).toBeFocused();
  await expect(catRow.locator('[data-fr="menu"]')).toHaveAttribute('aria-expanded', 'true');
  await catRow.locator('[data-fr="report"]').click();
  await expect(page.locator('#frReportMore')).toBeFocused();
  await page.locator('#friendsSheet input[name="frReason"][value="A rude name"]').check();
  await fits(page, [320]);
  await page.locator('#friendsSheet [data-fr="report-yes"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Reported. Block them too if you would rather not hear from them.');
  expect(fake.social.reports.map(r => [r.reported, r.reason])).toEqual([[cat.id, 'A rude name']]);
  await catRow.locator('[data-fr="menu"]').click();
  await catRow.locator('[data-fr="block"]').click();
  await expect(page.locator('#friendsSheet [data-fr="block-yes"]')).toBeFocused();
  await page.locator('#friendsSheet [data-fr="block-yes"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Blocked. They will not find you again.');
  await expect(page.locator('#friendsSheet .fr-friend .fr-who b')).toHaveText(['Bea']);

  // Visit Bea: read only, drawn from the snapshot.
  const beaRow = page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' });
  await beaRow.locator('[data-fr="menu"]').click();
  await beaRow.locator('[data-fr="visit"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Bea’s shelf');
  await expect(page.locator('#friendsSheet .fr-res h4')).toHaveText(['Gladys', 'Snag']);
  await expect(page.locator('#friendsSheet .fr-res .sprite')).toHaveCount(2);
  await expect(page.locator('#friendsSheet .fr-res').first()).toContainText('Content. Suspiciously so.');
  await expect(page.locator('#friendsSheet .fr-res').first()).toContainText('Perpetually Damp');
  await expect(page.locator('#friendsSheet .fr-res').nth(1)).toContainText('Furious. Do not knock.');
  await fits(page);

  // Serve papers on Snag: today's docket by default, one of ours as plaintiff.
  const docket = COURT_BY_ID[docketCaseId(todayKey())];
  await page.locator('#friendsSheet .fr-res').nth(1).locator('[data-fr="papers"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Serve papers');
  await expect(page.locator('#frCase')).toBeFocused();
  await expect(page.locator('#frCase option:checked')).toHaveText(docket.title + ' (today’s docket)');
  await page.locator('#frPlaintiff').selectOption('qa2');
  await fits(page);
  await page.locator('#friendsSheet [data-fr-form="serve"] button[type="submit"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Papers served. Bea will find them in Shelf Court.');
  await expect(page.locator('#friendsVeil h2')).toHaveText('Bea’s shelf');
  const [summons] = [...fake.social.summons.values()];
  expect([summons.from_user, summons.to_user, summons.case_id, summons.plaintiff.name, summons.defendant.name, summons.defendant.id])
    .toEqual([ada.id, bea.id, docket.id, 'Pip', 'Snag', 'bea1']);
  const box = await bea.social.inbox();
  expect(box.cases.map(c => [c.fromName, c.plaintiff.name, c.defendant.name])).toEqual([['Ada', 'Pip', 'Snag']]);

  await page.locator('#friendsSheet [data-fr="back"]').click();
  await expect(page.locator('#frAdd')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#friendsVeil')).toBeHidden();
});
