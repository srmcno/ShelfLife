import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase, FAKE_CODE } from '../support/fake-supabase.mjs';
import { createCloud } from '../../src/cloud/client.js';
import { generateCreature } from '../../src/art/creatures.js';

// Cloud save against an in-memory Supabase served through page.route. The
// fake lives in this Node process, so the test can read and change "the cloud"
// directly, including writing as another device.
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
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The account layer is checked once, with phone widths set explicitly');
});

function memory() {
  const items = new Map();
  return { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k) };
}
function household(customize = () => {}) {
  const snapshot = householdFixture('established');
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = Date.now();
  customize(snapshot);
  return snapshot;
}
function otherShelf(names) {
  return household(s => {
    s.pets = s.pets.slice(0, names.length).map((p, i) => ({ ...p, id: 'other' + i, name: names[i], names: [{ name: names[i], at: s.started }],
      art: { body: '', stamps: [], creature: generateCreature({ seed: 'other-' + names[i] }) } }));
    s.slots = Array(18).fill(null);
    s.pets.forEach((p, i) => { s.slots[i] = p.id; });
    s.props.forEach((p, i) => { s.slots[names.length + i] = p.id; });
    s.mayhem.souls = 13;
  });
}

async function open(page, { fake, snapshot = household() } = {}) {
  await page.addInitScript(({ snapshot, config }) => {
    if (config) globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (snapshot && !sessionStorage.getItem('cloud.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      sessionStorage.setItem('cloud.fixture', '1');
    }
  }, { snapshot, config: fake?.config || null });
  if (fake) await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  if (snapshot?.pets.length) await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
  return snapshot;
}
async function openCloud(page) {
  await page.locator('#tabMore').click();
  await page.locator('#cloudBtn').click();
  await expect(page.locator('#cloudVeil')).toBeVisible();
}
const residents = page => page.locator('#cabinet .piece.pet .nameplate').allTextContents();
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
async function fits(page, widths = [320, 390]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
      sheet: [...document.querySelectorAll('.veil.open .sheet')].map(el => [el.scrollWidth, el.clientWidth]) }));
    expect(sizes.document, 'no horizontal page scroll at ' + width).toBeLessThanOrEqual(sizes.viewport + 1);
    for (const [content, box] of sizes.sheet) expect(content, 'the sheet does not clip at ' + width).toBeLessThanOrEqual(box + 1);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('without config there is no Cloud save anywhere and not a single outside request', async ({ page }) => {
  const outside = [];
  page.on('request', request => { if (!request.url().startsWith('http://localhost')) outside.push(request.url()); });
  let routed = 0;
  await page.route(url => !url.href.startsWith('http://localhost'), route => { routed++; return route.abort(); });
  await open(page);
  await page.locator('#tabMore').click();
  await expect(page.locator('#exportBtn')).toBeVisible();
  await expect(page.locator('#cloudBtn')).toBeHidden();
  await expect(page.locator('#cloudNudge')).toBeHidden();
  await page.locator('#moreClose').click();
  await page.locator('#cabinet .piece[data-id="qa0"]').click();
  await page.locator('#cardVeil [data-care="food"]').click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
  await page.waitForTimeout(300);
  expect(routed).toBe(0);
  expect(outside).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('shelflife.cloud'))).toBeNull();
});

test('an email already attached on the server recovers from an old guest session', async ({ page }) => {
  const fake = createFakeSupabase();
  const snapshot = await open(page, { fake });
  await openCloud(page);
  await page.locator('#cloudEnable').click();
  await expect(page.locator('#cloudStatus')).toContainText('Cloud save is on.');
  const [userId] = fake.users.keys();
  Object.assign(fake.users.get(userId), { email: 'mabel@example.com', is_anonymous: false });
  await page.locator('#cloudEmail').fill('mabel@example.com');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudSignIn')).toBeVisible();
  await expect(page.locator('#cloudCodeForm')).toBeVisible();
  expect(fake.sent.map(item => item.type)).toEqual(['email']);
  await page.locator('#cloudCode').fill(FAKE_CODE);
  await page.locator('#cloudCode').press('Enter');
  await expect(page.locator('#cloudStatus')).toContainText('Signed in as mabel@example.com.');
  await expect(page.locator('#cloudEmailShown')).toHaveText('mabel@example.com');
  expect(fake.users.size).toBe(1);
  expect((await saved(page)).pets.map(p => p.name)).toEqual(snapshot.pets.map(p => p.name));
  await page.reload();
  await openCloud(page);
  await expect(page.locator('#cloudEmailShown')).toHaveText('mabel@example.com');
  await expect(page.locator('#cloudAnon')).toBeHidden();
});

test('turn it on, add an email, and settle a conflict both ways', async ({ page }) => {
  test.setTimeout(60_000);
  const fake = createFakeSupabase();
  await open(page, { fake });
  expect(fake.requests).toEqual([]);
  await page.locator('#tabMore').click();
  await expect(page.locator('#cloudBtnSub')).toHaveText('Off');
  await page.locator('#cloudBtn').click();
  await expect(page.locator('#cloudEnable')).toBeVisible();
  expect(fake.requests, 'opening the sheet sends nothing').toEqual([]);
  await fits(page);

  await page.locator('#cloudEnable').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Cloud save is on. The shelf has been copied.');
  await expect(page.locator('#cloudAnon')).toContainText('This browser holds the only key.');
  const [userId] = [...fake.users.keys()];
  expect(fake.saves.get(userId).data.pets.map(p => p.name)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  expect(fake.saves.get(userId).rev).toBe(1);

  await page.locator('#cloudEmail').fill('mabel@example.com');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudStatus')).toContainText('Code requested. Check your email');
  await expect(page.locator('#cloudCodeDestination')).toHaveText('Code requested for mabel@example.com.');
  await expect(page.locator('#cloudCode')).toBeFocused();
  await page.locator('#cloudCode').fill(FAKE_CODE);
  await page.keyboard.press('Enter');
  await expect(page.locator('#cloudStatus')).toContainText('Email added.');
  await expect(page.locator('#cloudEmailShown')).toHaveText('mabel@example.com');
  await expect(page.locator('#cloudSignOut')).toBeVisible();
  await expect(page.locator('#cloudDeleteStart')).toHaveText('Delete my cloud data and account');
  expect(fake.users.get(userId).email).toBe('mabel@example.com');
  await fits(page);

  // Another device writes while this one has also been used.
  fake.setRemote(userId, otherShelf(['Gladys', 'Snag']), { device: 'android-otherphone1' });
  await page.locator('#cloudSyncNow').click();
  await expect(page.locator('#cloudConflict')).toBeVisible();
  await expect(page.locator('#cloudLocalSummary')).toContainText('3 residents: Agnes, Lord Dampington III and Pip.');
  await expect(page.locator('#cloudRemoteSummary')).toContainText('2 residents: Gladys and Snag. 13 souls. Saved from an Android phone');
  await expect(page.locator('#cloudAccount')).toBeHidden();
  await fits(page, [320, 390]);

  await page.locator('#cloudUseRemote').click();
  await expect(page.locator('#cloudStatus')).toContainText('Now using the cloud copy.');
  await expect.poll(() => residents(page)).toEqual(['Gladys', 'Snag']);
  expect((await saved(page)).pets.map(p => p.name)).toEqual(['Gladys', 'Snag']);
  const spare = await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4.beforecloud')));
  expect(spare.pets.map(p => p.name)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  await expect(page.locator('#cloudUndoText')).toContainText('The other shelf (Agnes, Lord Dampington III and Pip) is kept on this device until');
  expect(fake.saves.get(userId).rev, 'taking the cloud copy does not write to the cloud').toBe(2);

  await page.locator('#cloudUndoBtn').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Swapped back.');
  await expect.poll(() => residents(page)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  await expect.poll(() => fake.saves.get(userId).data.pets.map(p => p.name)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);

  // And the other way: keep this device.
  fake.setRemote(userId, otherShelf(['Wanda']), { device: 'iphone-otherphone2' });
  await page.locator('#cloudSyncNow').click();
  await expect(page.locator('#cloudRemoteSummary')).toContainText('1 resident: Wanda. 13 souls. Saved from an iPhone');
  await page.locator('#cloudKeepLocal').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Kept this device. The cloud copy now matches it.');
  expect(fake.saves.get(userId).data.pets.map(p => p.name)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  expect(fake.saves.get(userId).rev).toBe(5);
  expect(await residents(page)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4.beforecloud')));
  expect(kept.pets.map(p => p.name)).toEqual(['Wanda']);

  // Escape closes the sheet and returns focus to More.
  await page.keyboard.press('Escape');
  await expect(page.locator('#cloudVeil')).toBeHidden();
  await expect(page.locator('#tabMore')).toBeFocused();
  await page.locator('#tabMore').click();
  await expect(page.locator('#cloudBtnSub')).toHaveText(/^Saved (just now|a minute ago)$/);
});

test('signing in on a fresh device brings the shelf over, and deleting leaves it in place', async ({ page }) => {
  const fake = createFakeSupabase();
  // The player's phone already made an account and saved there.
  const phone = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory() });
  await phone.requestEmailCode('pip@example.com', { mode: 'signin' });
  await phone.verifyEmailCode('pip@example.com', FAKE_CODE);
  await phone.rpc('push_save', { p_base_rev: 0, p_data: household(), p_device: 'android-phonephone' });
  fake.requests.length = 0;

  await open(page, { fake, snapshot: null });
  await expect(page.locator('.arrival-resident')).toHaveCount(3);
  await openCloud(page);
  await page.locator('#cloudSignInOpen').click();
  await expect(page.locator('#cloudSignIn')).toBeVisible();
  await expect(page.locator('#cloudEmail')).toBeFocused();
  await page.locator('#cloudEmail').fill('pip@example.com');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cloudCode')).toBeFocused();
  // Off to find the email and back again: the code step is still waiting.
  await page.keyboard.press('Escape');
  await expect(page.locator('#cloudVeil')).toBeHidden();
  await openCloud(page);
  await expect(page.locator('#cloudSignIn')).toBeVisible();
  await expect(page.locator('#cloudEmail')).toHaveValue('pip@example.com');
  await page.locator('#cloudCode').fill(FAKE_CODE);
  await page.locator('#cloudConfirm').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Signed in as pip@example.com.');
  await expect.poll(() => fake.calls('/rest/v1/rpc/pull_save').length).toBeGreaterThan(0);
  await expect(page.locator('#toast')).toContainText('Your shelf has arrived from the cloud.');
  await expect.poll(() => residents(page)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  expect(fake.calls('/rest/v1/rpc/push_save')).toEqual([]);

  // Two steps, and the shelf stays.
  await page.locator('#cloudDeleteStart').click();
  await expect(page.locator('#cloudDeleteCancel')).toBeFocused();
  await expect(page.locator('#cloudDeleteQuestion')).toContainText('The shelf on this device stays exactly as it is.');
  await fits(page, [320]);
  await page.locator('#cloudDeleteConfirmBtn').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Deleted. The cloud copy and the account are gone. This shelf is still here.');
  await expect(page.locator('#cloudOff')).toBeVisible();
  expect(fake.users.size).toBe(0);
  expect(fake.saves.size).toBe(0);
  expect(await residents(page)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).session)).toBeUndefined();
});

test('the nudge appears once for an established shelf, and Not now lasts past a reload', async ({ page }) => {
  const fake = createFakeSupabase();
  await open(page, { fake });
  await expect(page.locator('#cloudNudge')).toBeVisible();
  await expect(page.locator('#cloudNudgeText')).toHaveText('These residents live in one browser. Cloud save can keep a spare copy elsewhere.');
  await fits(page);
  await page.locator('#cloudNudgeLater').click();
  await expect(page.locator('#cloudNudge')).toBeHidden();
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  await expect(page.locator('#cloudNudge')).toBeHidden();
  expect(fake.requests, 'the nudge and its dismissal are local').toEqual([]);
});

test('email instructions explain the code, preserve invalid input, and let the player change the destination', async ({ page }) => {
  const fake = createFakeSupabase();
  await open(page, { fake });
  await openCloud(page);
  await expect(page.locator('#cloudVeil')).toContainText('The game saves automatically in this browser.');
  await page.locator('#cloudSignInOpen').click();
  await expect(page.locator('#cloudEmailSteps li')).toHaveCount(3);
  await expect(page.locator('#cloudEmailHelp')).toContainText('you do not choose one yourself');
  await page.locator('#cloudEmail').fill('not an email');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudStatus')).toHaveText('That does not look like an email address.');
  await expect(page.locator('#cloudEmail')).toHaveValue('not an email');
  expect(fake.requests, 'invalid input never asks the server for a code').toEqual([]);
  await expect(page.locator('#cloudCodeForm')).toBeHidden();

  const address = 'long-email-destination-for-small-screen@example.com';
  await page.locator('#cloudEmail').fill(address);
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudCodeDestination')).toHaveText('Code requested for ' + address + '.');
  await expect(page.locator('#cloudEmail')).toHaveAttribute('readonly', '');
  await expect(page.locator('#cloudCodeHelp')).toContainText('Wait at least a minute');
  await fits(page);
  await page.locator('#cloudCode').fill('123');
  await page.locator('#cloudConfirm').click();
  await expect(page.locator('#cloudStatus')).toContainText('You do not create this code yourself.');
  await expect(page.locator('#cloudCode')).toHaveValue('123');
  await page.locator('#cloudChangeEmail').click();
  await expect(page.locator('#cloudCodeForm')).toBeHidden();
  await expect(page.locator('#cloudEmail')).toBeEditable();
  await expect(page.locator('#cloudEmail')).toHaveValue(address);
  await expect(page.locator('#cloudEmail')).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.cloud')).pending)).toBeUndefined();
  await page.reload();
  await openCloud(page);
  await page.locator('#cloudSignInOpen').click();
  await expect(page.locator('#cloudCodeForm')).toBeHidden();
  await page.locator('#cloudEmail').fill('new-inbox@example.com');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudCodeDestination')).toHaveText('Code requested for new-inbox@example.com.');
  expect(fake.sent.map(sent => sent.email)).toEqual([address, 'new-inbox@example.com']);
});

test('a server that cannot email confirmation never pretends to send a code or changes the account email', async ({ page }, testInfo) => {
  const fake = createFakeSupabase({ emailAutoconfirm: true });
  await open(page, { fake });
  await openCloud(page);
  await page.locator('#cloudEnable').click();
  await expect(page.locator('#cloudAnon')).toBeVisible();
  await page.locator('#cloudEmail').fill('my-inbox@example.com');
  await page.locator('#cloudSendCode').click();
  await expect(page.locator('#cloudStatus')).toHaveText('Email sign-in is not available right now. Your shelf is still saved on this device.');
  await expect(page.locator('#cloudEmail')).toHaveValue('my-inbox@example.com');
  await expect(page.locator('#cloudCodeForm')).toBeHidden();
  expect(fake.calls('/auth/v1/user')).toEqual([]);
  expect(fake.sent).toEqual([]);
  expect([...fake.users.values()].every(user => user.is_anonymous && !user.email)).toBe(true);
  expect((await saved(page)).pets.map(pet => pet.name)).toEqual(['Agnes', 'Lord Dampington III', 'Pip']);
  const desktop = testInfo.outputPath('cloud-help-desktop.png');
  await page.locator('#cloudVeil').screenshot({ path: desktop });
  await testInfo.attach('Cloud email help at desktop width', { path: desktop, contentType: 'image/png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = testInfo.outputPath('cloud-help-mobile.png');
  await page.locator('#cloudVeil').screenshot({ path: mobile });
  await testInfo.attach('Cloud email help at phone width', { path: mobile, contentType: 'image/png' });
  await fits(page);
});

test('a new shelf is not nagged', async ({ page }) => {
  const fake = createFakeSupabase();
  await open(page, { fake, snapshot: household(s => { s.started = Date.now() - 3600000; }) });
  await expect(page.locator('#cloudBtn')).toBeAttached();
  await page.waitForTimeout(200);
  await expect(page.locator('#cloudNudge')).toBeHidden();
});
