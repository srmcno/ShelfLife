// Kin on the real host page: the actual Friends sheet (#friendsBtn, #friendsSheet),
// its real postbox and the real Restore flow, not the stand-in hub that
// kin.spec.mjs uses. The page is Ada; Bea and the others live in the test
// process on the same in-memory Supabase.
import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer, pageSession } from '../support/social-world.mjs';
import { createKin, parentSnapshot } from '../../src/cloud/kin.js';
import { foundlingId } from '../../src/engine/kin.js';
import { absorbMail } from '../../src/ui/kin.js';
import { createBackup } from '../../src/backup.js';

const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });
const DAY = 86400000;

function shelf(names, kind = 'established') {
  const state = householdFixture(kind, Date.now());
  state.settings.theatreOn = false;
  state.lastBackup = Date.now();
  state.pets.forEach((pet, i) => { if (names[i]) { pet.name = names[i]; pet.names = [{ name: names[i], at: state.started }]; } });
  return state;
}
async function player(fake, name, state) {
  const p = await socialPlayer(fake, name, state);
  p.kin = createKin({ cloud: p.cloud });
  return p;
}
async function befriend(fake, a, b) {
  await a.social.addFriend(b.code);
  await b.social.respond(a.id, true);
  fake.social.friendships.forEach(f => { f.created_at = new Date(Date.now() - 8 * DAY).toISOString(); });
  await a.social.publish({ force: true });
  await b.social.publish({ force: true });
}
async function open(page, fake, ada) {
  await page.addInitScript(({ config, state, session }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('kin-host.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(state));
      localStorage.setItem('shelflife.cloud', session);
      sessionStorage.setItem('kin-host.fixture', '1');
    }
  }, { config: fake.config, state: ada.shelf, session: JSON.stringify({ session: ada.session, socialUser: ada.id }) });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(ada.shelf.pets.length);
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
async function openFriends(page) {
  // The tray may already be open (a restore leaves it so).
  if ((await page.locator('#tabMore').getAttribute('aria-expanded')) !== 'true') await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toBeVisible();
}
const openFriend = (page, name) => page.locator('#friendsSheet .fr-friend').filter({ hasText: name }).locator('[data-fr="profile"]').click();
async function openPostbox(page) {
  await page.locator('#friendsSheet [data-fr="postbox"]').click();
  await expect(page.locator('#friendsSheet [data-fr-mail]').first()).toBeVisible();
}
async function fits(page) {
  const original = page.viewportSize();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no overflow at ' + width).toBe(true);
  }
  await page.setViewportSize(original);
}

test('through the real Friends sheet: a basket, a lost reply, and the foundling arrives once, claimed after it is saved', async ({ page }) => {
  const fake = createFakeSupabase();
  const ada = await player(fake, 'Ada', shelf(['Agnes', 'Lord Dampington III', 'Pip']));
  const bea = await player(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda']));
  await befriend(fake, ada, bea);
  await open(page, fake, ada);
  await openFriends(page);
  await openFriend(page, 'Bea');
  await expect(page.locator('#friendsSheet [data-fr-section="kin"]')).toContainText('No kin between your shelves yet.');
  const action = page.locator('#friendsSheet [data-fr-action="kin-basket"]');
  await expect(action).toBeEnabled();
  await action.click();
  const view = page.locator('#friendsSheet [data-kin-view="basket"]');
  await expect(view.locator('[data-sx="pick-theirs"]')).toHaveCount(3);
  await view.locator('[data-sx="pick-mine"][data-sx-id="qa0"]').click();
  await view.locator('[data-sx="pick-theirs"][data-sx-id="qa1"]').click();
  await fits(page);
  await page.locator('#friendsSheet [data-kin-view="basket"] [data-sx="leave"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toContainText('A basket is on Bea’s step, with Agnes and Snag in mind.');
  // Bea takes it in on the server, and her device never hears back.
  const [basket] = (await bea.kin.mail()).baskets;
  await bea.kin.answerBasket(basket.id, { accept: true, parent: parentSnapshot(bea.shelf.pets.find(p => p.id === basket.toParentId)), nameRoll: 3 });
  const bornId = foundlingId(basket.id);
  expect([...fake.kin.receipts.values()].filter(r => !r.claimed_at).map(r => r.owner).sort()).toEqual([ada.id, bea.id].sort());
  // Ada opens her postbox on the real sheet: the foundling moves in, and only then does the server hear it was taken in.
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await openPostbox(page);
  const notice = page.locator('#friendsSheet [data-fr-mail="kin-births"] [data-kin-notice]');
  await expect(notice).toContainText('was found on the step.');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  const state = await saved(page);
  const child = state.pets.find(p => p.id === bornId);
  expect(child, 'saved on the device').toBeTruthy();
  expect(state.kin.collected).toContain(basket.id);
  expect(state.kin.foundlings[0].parents.map(p => [p.name, p.home, p.shelf])).toEqual([['Agnes', true, ''], ['Snag', false, 'Bea']]);
  await expect.poll(() => fake.kin.receipts.get(ada.id + '|' + basket.id).claimed_at, 'claimed on the server').toBeTruthy();
  expect(fake.kin.receipts.get(bea.id + '|' + basket.id).claimed_at, 'Bea’s is hers to claim').toBeNull();
  // Bea's device finds hers in the mail and makes the same child.
  const mail = await bea.kin.mail();
  expect(mail.births.map(b => b.id)).toEqual([basket.id]);
  await absorbMail({ state: bea.shelf, mail, kin: bea.kin, shelfName: () => 'Ada', now: Date.now() });
  const theirs = bea.shelf.pets.find(p => p.id === bornId);
  expect([theirs.name, theirs.traits, theirs.art]).toEqual([child.name, child.traits, child.art]);
  expect(fake.kin.receipts.get(bea.id + '|' + basket.id).claimed_at).toBeTruthy();
  // A reload never brings a second copy.
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  await openFriends(page);
  await openFriend(page, 'Bea');
  await expect(page.locator('#friendsSheet [data-fr-section="kin"]')).toContainText(child.name);
  await fits(page);
  expect((await saved(page)).pets.filter(p => p.id === bornId)).toHaveLength(1);
});

test('more foundlings than the step holds wait at the door instead of being lost, and come in as room is made', async ({ page }) => {
  const fake = createFakeSupabase();
  const full = shelf(['Agnes'], 'nearly-full');
  full.props.push({ id: 'qad9', kind: 'bowl' });
  full.slots[full.slots.indexOf(null)] = 'qad9';
  const ada = await player(fake, 'Ada', full);
  const others = [];
  for (const name of ['Bea', 'Cat', 'Dan', 'Eve']) {
    const other = await player(fake, name, shelf([name + 'ie']));
    await befriend(fake, ada, other);
    others.push(other);
  }
  const babies = [];
  for (const [i, other] of others.entries()) {
    const left = await ada.kin.leaveBasket({ to: other.id, pet: ada.shelf.pets[i], theirs: 'qa0' });
    await other.kin.answerBasket(left.id, { accept: true, parent: parentSnapshot(other.shelf.pets[0]) });
    babies.push(foundlingId(left.id));
  }
  await open(page, fake, ada);
  await openFriends(page);
  await openPostbox(page);
  const rows = page.locator('#friendsSheet [data-fr-mail="kin-births"]');
  await expect(rows.locator('[data-kin-step]')).toHaveCount(3);
  await expect(rows.locator('[data-kin-waiting]')).toContainText('1 more foundling is waiting at the door.');
  await expect.poll(async () => (await saved(page)).kin.step.length).toBe(3);
  expect([...fake.kin.receipts.values()].filter(r => r.owner === ada.id && !r.claimed_at)).toHaveLength(1);
  expect((await saved(page)).pets.some(p => p.id.startsWith('kin'))).toBe(false);
  await fits(page);
  // Rehome someone: the step can be taken in, and the one at the door follows.
  await page.evaluate(async () => {
    const { state, save } = await import('/src/state.js');
    const pet = state.pets.find(p => !p.id.startsWith('kin'));
    state.pets = state.pets.filter(p => p !== pet);
    state.slots[state.slots.indexOf(pet.id)] = null;
    save();
  });
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await openPostbox(page);
  await rows.locator('[data-kin-step] [data-sx="take"]').first().click();
  await expect.poll(async () => (await saved(page)).pets.filter(p => p.id.startsWith('kin')).length).toBe(1);
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await openPostbox(page);
  await expect(rows.locator('[data-kin-waiting]')).toHaveCount(0);
  await expect.poll(() => [...fake.kin.receipts.values()].filter(r => r.owner === ada.id && !r.claimed_at).length).toBe(0);
  const done = await saved(page);
  const present = [...done.pets.filter(p => p.id.startsWith('kin')).map(p => p.id), ...done.kin.step.map(s => s.pet.id)].sort();
  expect(present, 'all four, each once').toEqual([...babies].sort());
});

test('restoring an older backup over the same account gets the foundling back from its receipt', async ({ page }, testInfo) => {
  const fake = createFakeSupabase();
  const ada = await player(fake, 'Ada', shelf(['Agnes', 'Lord Dampington III', 'Pip']));
  const bea = await player(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda']));
  await befriend(fake, ada, bea);
  const backup = createBackup(JSON.parse(JSON.stringify(ada.shelf)), Date.now()).text;
  const left = await bea.kin.leaveBasket({ to: ada.id, pet: bea.shelf.pets[0], theirs: 'qa1' });
  await open(page, fake, ada);
  await openFriends(page);
  await openPostbox(page);
  await page.locator('#friendsSheet [data-fr-mail="kin-baskets"] [data-sx="open"]').click();
  await expect(page.locator('#friendsSheet [data-kin-view="offer"] [data-kin-name]')).toBeVisible();
  await page.locator('#friendsSheet [data-kin-view="offer"] [data-sx="accept"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toContainText('has moved in.');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  await expect.poll(() => fake.kin.receipts.get(ada.id + '|' + left.id).claimed_at, 'claimed after the save').toBeTruthy();
  const baby = (await saved(page)).pets.find(p => p.id === foundlingId(left.id));
  // Months later the basket row is long gone; the receipt is not.
  fake.kin.baskets.delete(left.id);
  await page.keyboard.press('Escape');
  // The older backup goes back on, through the real Restore.
  if ((await page.locator('#tabMore').getAttribute('aria-expanded')) !== 'true') await page.locator('#tabMore').click();
  await page.locator('#importFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.locator('#restoreConfirm').click();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  expect((await saved(page)).pets.some(p => p.id === foundlingId(left.id))).toBe(false);
  // The next look at the mail finds the receipt and the foundling comes back, once, beside the residents the backup had.
  await openFriends(page);
  await openPostbox(page);
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  const after = await saved(page);
  const back = after.pets.find(p => p.id === foundlingId(left.id));
  expect([back.name, back.traits, back.art]).toEqual([baby.name, baby.traits, baby.art]);
  expect(after.pets.filter(p => !p.id.startsWith('kin')).map(p => p.id)).toEqual(['qa0', 'qa1', 'qa2']);
  expect(after.kin.foundlings.map(f => f.parents.map(p => [p.name, p.home]))).toEqual([[['Gladys', false], ['Lord Dampington III', true]]]);
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  expect((await saved(page)).pets.filter(p => p.id === foundlingId(left.id))).toHaveLength(1);
  void testInfo;
});
