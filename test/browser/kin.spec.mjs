// Kin with two players: the page is Ada, Bea lives in the test process on the
// same in-memory Supabase. Baskets, foundlings on both shelves, letters and a
// reply. The Friends hub is reached through test/support/hub-harness.js, which
// renders the social registry with the hub's own conventions; the clicks are
// on the registered buttons ([data-fr-action="kin-basket"], [data-sx] ...).
import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { createKin, parentSnapshot } from '../../src/cloud/kin.js';
import { readResident } from '../../src/cloud/social.js';
import { realizeFoundling } from '../../src/art/kin-art.js';
import { foundlingId, foundlingName, foundlingPet } from '../../src/engine/kin.js';
import { absorbMail, adopt, foundlingRecord, keepLetter } from '../../src/ui/kin.js';

const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    // WebKit reports a request to the stubbed cloud that is cut off by a page switch
    // as a page error ('... due to access control checks.'); the client already treats it
    // as offline. Everything else is a real error.
    page.on('pageerror', error => { if (!/due to access control checks\.?$/.test(error.message)) errors.push(error.message); });
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
// Two players, real postbox round trips and a reload: longer than one screen's worth of clicks.
test.describe.configure({ timeout: 90_000 });
const NOW = Date.UTC(2026, 9, 14, 17);
const DAY = 86400000;

function shelf(names, kind = 'established') {
  const state = householdFixture(kind, NOW);
  state.settings.theatreOn = false;
  state.lastBackup = NOW;
  state.pets.forEach((pet, i) => { if (names[i]) { pet.name = names[i]; pet.names = [{ name: names[i], at: state.started }]; } });
  return state;
}
async function world({ adaShelf = shelf(['Agnes', 'Lord Dampington III', 'Pip']) } = {}) {
  const fake = createFakeSupabase({ now: () => NOW });
  const ada = await socialPlayer(fake, 'Ada', adaShelf, { now: () => NOW });
  const bea = await socialPlayer(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda']), { now: () => NOW });
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  fake.social.friendships.forEach(f => { f.created_at = new Date(NOW - 8 * DAY).toISOString(); });
  await ada.social.publish({ force: true });
  await bea.social.publish({ force: true });
  bea.kin = createKin({ cloud: bea.cloud });
  return { fake, ada, bea };
}
async function open(page, fake, player) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(({ config, state, meta }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('kin.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(state));
      localStorage.setItem('shelflife.cloud', JSON.stringify(meta));
      sessionStorage.setItem('kin.fixture', '1');
    }
  }, { config: fake.config, state: player.shelf, meta: { session: player.session, socialUser: player.id } });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(player.shelf.pets.length);
}
const hub = (page, name, arg) => page.evaluate(async ([fn, value]) => { await (await import('/test/support/hub-harness.js'))[fn](value); }, [name, arg]);
const status = page => page.locator('#hubSheet [data-hub-status]');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
// What Bea's device does with a born basket: the same code the page runs.
async function beaTakesIn(bea, basket, roll = 0) {
  const snapshot = parentSnapshot(bea.shelf.pets.find(p => p.id === basket.toParentId));
  const parent = readResident(snapshot);
  const plan = await realizeFoundling({ a: basket.fromParent, b: parent, seed: basket.seed });
  await bea.kin.answerBasket(basket.id, { accept: true, parent: snapshot, nameRoll: roll });
  const pet = foundlingPet({ ...plan, name: foundlingName(basket.fromParent.name, parent.name, basket.seed, roll) }, { basketId: basket.id, born: NOW });
  adopt(bea.shelf, pet, foundlingRecord({ ...basket, toParent: parent }, pet, 'in', 'Ada'), plan.birth);
  return pet;
}

test('Ada leaves a basket out, Bea takes it in, and both shelves get the same foundling with the right parents', async ({ page }) => {
  const { fake, ada, bea } = await world();
  await open(page, fake, ada);
  await hub(page, 'openFriend', bea.id);
  const action = page.locator('#hubSheet [data-fr-action="kin-basket"]');
  await expect(action).toBeEnabled();
  await expect(page.locator('#hubSheet [data-fr-section="kin"]')).toContainText('No kin between your shelves yet.');
  await action.click();
  const view = page.locator('[data-kin-view="basket"]');
  await expect(view.locator('[data-sx="pick-theirs"]')).toHaveCount(3);
  await view.locator('[data-sx="pick-mine"][data-sx-id="qa0"]').click();
  await view.locator('[data-sx="pick-theirs"][data-sx-id="qa1"]').click();
  await expect(view.locator('[data-sx="pick-theirs"][data-sx-id="qa1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-kin-history]')).toContainText('friends for a week');
  await page.locator('[data-kin-view="basket"] [data-sx="leave"]').click();
  await expect(status(page)).toContainText('A basket is on Bea’s step, with Agnes and Snag in mind.');
  // Bea's device: the basket is on her step, and she takes it in.
  const [basket] = (await bea.kin.mail()).baskets;
  expect([basket.direction, basket.fromParent.name, basket.toParentName]).toEqual(['in', 'Agnes', 'Snag']);
  const beaChild = await beaTakesIn(bea, basket);
  // Ada's postbox finds the birth; the foundling moves in.
  await hub(page, 'openPostbox');
  const notice = page.locator('[data-fr-source="kin-births"] [data-kin-notice]');
  await expect(notice).toContainText(beaChild.name + ' was found on the step.');
  await expect(notice).toContainText('It has Agnes’s');
  const state = await saved(page);
  const child = state.pets.find(p => p.id === foundlingId(basket.id));
  expect(child.name).toBe(beaChild.name);
  expect(child.traits).toEqual(beaChild.traits);
  expect(child.art).toEqual(beaChild.art);
  expect(state.kin.foundlings[0].parents.map(p => [p.name, p.home, p.shelf])).toEqual([['Agnes', true, ''], ['Snag', false, 'Bea']]);
  expect(bea.shelf.kin.foundlings[0].parents.map(p => [p.name, p.home, p.shelf])).toEqual([['Agnes', false, 'Ada'], ['Snag', true, '']]);
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  expect(fake.kin.baskets.get(basket.id).from_collected_at).toBeTruthy();
  // Meeting it opens the resident card, which says where it came from.
  // (The stand-in hub repaints the whole postbox over and over, so the button is not clicked; the event it sends is.)
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('shelflife:care', { detail: { petId: id } })), foundlingId(basket.id));
  await expect(page.locator('#cardSheet .kin-found')).toHaveText('Found on the step. Parents: Agnes (yours) and Snag (Bea’s shelf).');
  await expect(page.locator('#cardSheet #kinTree')).toContainText('Its twin');
  // Reloading never brings a second copy.
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(4);
  await hub(page, 'openPostbox');
  await expect(page.locator('#hubSheet [data-hub-postbox]')).toBeVisible();
  await hub(page, 'openFriend', bea.id);
  await expect(page.locator('#hubSheet [data-fr-section="kin"]')).toContainText(beaChild.name);
  await expect(page.locator('#hubSheet [data-fr-action-reason="kin-basket"]')).toContainText('The next basket can go out in 14 days.');
});

test('Bea leaves a basket out, Ada looks inside, re-rolls the name and takes it in', async ({ page }) => {
  const { fake, ada, bea } = await world();
  await bea.kin.leaveBasket({ to: ada.id, pet: bea.shelf.pets[0], theirs: 'qa1' });
  await open(page, fake, ada);
  await hub(page, 'openPostbox');
  const row = page.locator('[data-fr-source="kin-baskets"] [data-kin-basket]');
  await expect(row).toContainText('Bea left a basket on your step.');
  await expect(row).toContainText('Gladys, of Bea’s shelf, and your Lord Dampington III.');
  await row.locator('[data-sx="open"]').click();
  const name = page.locator('[data-kin-view="offer"] [data-kin-name]');
  await expect(name).toBeVisible();
  const first = await name.textContent();
  await page.locator('[data-kin-view="offer"] [data-sx="reroll"]').click();
  await expect(name).not.toHaveText(first);
  const chosen = await name.textContent();
  await expect(page.locator('[data-kin-view="offer"] .kin-parents')).toHaveText('Parents: Gladys (Bea’s shelf) and Lord Dampington III (yours).');
  await page.locator('[data-kin-view="offer"] [data-sx="accept"]').click();
  await expect(status(page)).toContainText(chosen + ' has moved in.');
  const [mine] = (await saved(page)).pets.filter(p => p.id.startsWith('kin'));
  expect(mine.name).toBe(chosen);
  // Bea's device finds the birth and makes the same child.
  const mail = await bea.kin.mail();
  await absorbMail({ state: bea.shelf, mail, kin: bea.kin, shelfName: () => 'Ada', now: NOW });
  const theirs = bea.shelf.pets.find(p => p.id === mine.id);
  expect(theirs.name).toBe(chosen);
  expect(theirs.art).toEqual(mine.art);
  expect(theirs.traits).toEqual(mine.traits);
});

test('a letter arrives, Ada replies as her resident, and Bea reads exactly that reply', async ({ page }) => {
  const { fake, ada, bea } = await world();
  const pal = await bea.kin.introduce({ to: ada.id, mine: 'qa0', theirs: 'qa0' });
  await open(page, fake, ada);
  await hub(page, 'openPostbox');
  const row = page.locator('[data-fr-source="kin-letters"] [data-kin-letter-row]');
  await expect(row).toContainText('A letter for Agnes.');
  await expect(row).toContainText('From Gladys, of Bea’s shelf.');
  await expect(row.locator('svg.kin-envelope')).toBeVisible();
  await row.locator('[data-sx="open"]').click();
  const letter = page.locator('[data-kin-view="letter"] .kin-paper');
  await expect(letter).toContainText('Dear Agnes,');
  await expect(letter).toContainText('Gladys');
  await expect(letter).toContainText('P.S.');
  const replies = page.locator('[data-kin-view="letter"] [data-sx="reply"]');
  await expect(replies).toHaveCount(3);
  const line = await replies.nth(2).locator('span').textContent();
  await replies.nth(2).click();
  await expect(status(page)).toContainText('Sent. Gladys will have it by the next post.');
  // Bea's postbox has the reply, written out the same way.
  const box = await bea.kin.mail();
  const reply = box.letters.find(l => l.kind === 'reply');
  expect(reply.choice).toBe(2);
  expect(keepLetter(bea.shelf, box, reply, 'Ada').text).toContain(line);
  // The correspondence stays on the resident card.
  const state = await saved(page);
  expect(state.kin.letters.map(l => [l.dir, l.kind])).toEqual([['in', 'weekly'], ['out', 'reply']]);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:care', { detail: { petId: 'qa0' } })));
  await page.locator('#kinLettersSummary').click();
  await expect(page.locator('#cardSheet #kinLetters')).toContainText('With Gladys, of Bea’s shelf');
  await expect(page.locator('#cardSheet #kinLetters .kin-kept')).toHaveCount(2);
  const weekly = [...fake.kin.letters.values()].find(l => l.pal_id === pal.id && l.kind === 'weekly' && l.to_user === ada.id);
  expect(weekly.read_at).toBeTruthy();
});

test('a full shelf cannot take a basket in, and the sender can be blocked from the basket', async ({ page }) => {
  const full = shelf(['Agnes'], 'nearly-full');
  full.props.push({ id: 'qad9', kind: 'bowl' });
  full.slots[full.slots.indexOf(null)] = 'qad9';
  const { fake, ada, bea } = await world({ adaShelf: full });
  await bea.kin.leaveBasket({ to: ada.id, pet: bea.shelf.pets[0], theirs: 'qa0' });
  await open(page, fake, ada);
  await hub(page, 'openPostbox');
  await page.locator('[data-fr-source="kin-baskets"] [data-sx="open"]').click();
  await expect(page.locator('[data-kin-full]')).toContainText('Your shelf is full: eighteen spaces, eighteen occupants.');
  await expect(page.locator('[data-kin-view="offer"] [data-sx="accept"]')).toBeDisabled();
  await page.locator('[data-kin-view="offer"] [data-sx="block"]').click();
  await page.locator('[data-kin-view="offer"] [data-sx="block-yes"]').click();
  await expect(status(page)).toContainText('Blocked.');
  expect(fake.social.blocks.map(b => [b.blocker, b.blocked])).toEqual([[ada.id, bea.id]]);
  expect(fake.kin.baskets.size).toBe(0);
});
