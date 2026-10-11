import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { createTrades } from '../../src/cloud/trades.js';
import { createTradeSync } from '../../src/cloud/trade-sync.js';
import { toggleWish } from '../../src/engine/trades.js';

// Two players: the page is Ada; Bea lives in this process on the same fake
// Supabase, with the game's own trade client and sync. Until the Friends hub
// is merged, the page mounts test/support/social-host.mjs, which renders the
// registry with the hub's selectors ([data-fr-action], [data-fr-section]).
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
// Each test plays both sides of a trade through several screens: allow for a busy machine.
test.describe.configure({ timeout: 90_000 });
const NOW = Date.UTC(2026, 9, 3, 17);
const DAY = 86400000;

function shelf(names, curios = {}) {
  const state = householdFixture('established', NOW);
  state.settings.theatreOn = false;
  state.lastBackup = NOW;
  state.pets.forEach((pet, i) => { pet.name = names[i] || pet.name; pet.names = [{ name: pet.name, at: state.started }]; });
  state.pets = state.pets.slice(0, names.length);
  state.slots = state.slots.map(id => !id || state.pets.some(p => p.id === id) || state.props.some(p => p.id === id) ? id : null);
  state.mayhem.curios = { ...curios };
  return state;
}
async function world({ ada = ['Agnes', 'Mabel', 'Pip'], adaCurios = { 'moth-wing': 3, 'glass-eye': 2 }, beaCurios = { 'half-candle': 2, 'button-eye': 2 }, beaWish = [] } = {}) {
  const fake = createFakeSupabase({ now: () => NOW });
  const a = await socialPlayer(fake, 'Ada', shelf(ada, adaCurios), { now: () => NOW });
  const b = await socialPlayer(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda'], beaCurios), { now: () => NOW });
  await a.social.addFriend(b.code);
  await b.social.respond(a.id, true);
  await b.social.publish({ force: true });
  const box = { state: b.shelf };
  const trades = createTrades({ cloud: b.cloud });
  const sync = createTradeSync({ cloud: b.cloud, social: b.social, trades, getState: () => box.state, now: () => NOW });
  beaWish.forEach(id => toggleWish(box.state, id));
  await sync.publishBook();
  return { fake, ada: a, bea: { ...b, box, trades, sync } };
}
async function open(page, fake, player) {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW + 1000);
  await page.addInitScript(({ config, state, meta }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('trades.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(state));
      localStorage.setItem('shelflife.cloud', JSON.stringify(meta));
      sessionStorage.setItem('trades.fixture', '1');
    }
  }, { config: fake.config, state: player.shelf, meta: { session: player.session, socialUser: player.id } });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(player.shelf.pets.length);
}
// The Friends sheet. The hub is not on this branch yet, so the test host stands in for it.
async function friends(page) {
  await page.evaluate(() => import('/test/support/social-host.mjs').then(m => m.mountHost()));
  await expect(page.locator('#tradeHost')).toBeVisible();
}
const host = page => page.locator('#tradeHost');
const view = (page, id) => page.locator('#tradeHost [data-fr-view="' + id + '"]');
async function profile(page, name) {
  await host(page).locator('[data-h="friend"]').filter({ hasText: name }).click();
  await expect(host(page).locator('[data-fr-section="trade-book"]')).toBeVisible();
}
async function postbox(page) {
  await page.evaluate(() => window.__tradeHost.openPostbox());
  await expect(host(page).locator('[data-postbox-loading]')).toHaveCount(0);
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
const row = (page, text) => host(page).locator('[data-postbox-source="trades"]').filter({ hasText: text });

test('a curio gift: Bea’s wishlist is marked, the gift is held, then sealed on both shelves', async ({ page }) => {
  const { fake, ada, bea } = await world({ beaWish: ['moth-wing'] });
  await open(page, fake, ada);
  await friends(page);
  await profile(page, 'Bea');
  const section = host(page).locator('[data-fr-section="trade-book"]');
  await expect(section).toContainText('Bea’s wishlist');
  await expect(section.locator('.tr-chip').filter({ hasText: 'Moth Wing' })).toContainText('You have a spare');
  await expect(section.locator('.tr-chip').filter({ hasText: 'Half a Candle' })).toContainText('New to you');
  await host(page).locator('[data-fr-action="trade"]').click();
  const compose = view(page, 'trade-compose');
  await expect(compose).toContainText('On Bea’s wishlist');
  await compose.locator('[data-sx="tr-give"][data-sx-id="moth-wing"][data-delta="1"]').click();
  await expect(compose.locator('.tr-pick.is-picked output')).toHaveText('1');
  await compose.locator('[data-sx="tr-line"][data-sx-id="wishlist"]').click();
  await compose.locator('[data-sx="tr-review"]').click();
  const review = view(page, 'trade-review');
  await expect(review.locator('.tr-bill')).toContainText('Moth Wing');
  await expect(review.locator('.tr-bill')).toContainText('Nothing. A gift, and so recorded.');
  await expect(review.locator('.tr-bill-line')).toContainText('It was on your wishlist.');
  await review.locator('[data-sx="tr-send"]').click();
  const offer = view(page, 'trade-offer');
  await expect(offer).toContainText('Waiting for Bea');
  await expect(offer.locator('.tr-note')).toContainText('seven days to answer');
  const held = await saved(page);
  const id = Object.keys(held.trades.escrow)[0];
  expect(held.trades.escrow[id].curios).toEqual({ 'moth-wing': 1 });
  expect(held.mayhem.curios['moth-wing']).toBe(3);

  await bea.sync.sync({ force: true });
  await bea.sync.accept(bea.sync.cache().trades.find(t => t.id === id));
  expect(bea.box.state.mayhem.curios['moth-wing']).toBe(1);
  await postbox(page);
  await expect(row(page, 'Sealed with Bea')).toContainText('Moth Wing went to Bea.');
  const after = await saved(page);
  expect(after.mayhem.curios['moth-wing']).toBe(2);
  expect(after.trades.escrow).toEqual({});
  expect(after.trades.applied.map(a => a.id)).toEqual([id]);
  await row(page, 'Sealed with Bea').locator('[data-sx="tr-dismiss"]').click();
  await expect(row(page, 'Sealed with Bea')).toHaveCount(0);
});

test('a curio swap with a counter-offer, accepted by Bea, balances both cabinets', async ({ page }) => {
  const { fake, ada, bea } = await world();
  const first = await bea.sync.propose({ to: ada.id, toName: 'Ada', draft: { mode: 'curio', give: { 'half-candle': 1 }, want: { 'moth-wing': 2 } }, line: 'fair' });
  await open(page, fake, ada);
  await friends(page);
  await postbox(page);
  await row(page, 'Bea proposes a trade').locator('[data-sx="tr-open"]').click();
  const offer = view(page, 'trade-offer');
  await expect(offer.locator('.tr-bill')).toContainText('Half a Candle');
  await expect(offer.locator('.tr-bill')).toContainText('2 copies');
  await offer.locator('[data-sx="tr-counter"]').click();
  const compose = view(page, 'trade-compose');
  await expect(compose).toContainText('A counter-offer replaces Bea’s offer');
  await expect(compose.locator('[data-sx="tr-give"][data-sx-id="moth-wing"][data-delta="1"]')).toBeVisible();
  await compose.locator('[data-sx="tr-give"][data-sx-id="moth-wing"][data-delta="-1"]').click();
  await expect(compose.locator('.tr-pick').filter({ hasText: 'Moth Wing' }).locator('output')).toHaveText('1');
  await compose.locator('[data-sx="tr-review"]').click();
  await view(page, 'trade-review').locator('[data-sx="tr-send"]').click();
  await expect(view(page, 'trade-offer')).toContainText('Waiting for Bea');

  await bea.sync.sync({ force: true });
  const counter = bea.sync.cache().trades.find(t => t.parent === first.id);
  expect(counter.give.curios).toEqual([{ id: 'moth-wing', n: 1 }]);
  expect(bea.box.state.trades.escrow[first.id]).toBeUndefined();
  await bea.sync.accept(counter);
  await postbox(page);
  await expect(row(page, 'Sealed with Bea')).toBeVisible();
  const after = await saved(page);
  expect([after.mayhem.curios['moth-wing'], after.mayhem.curios['half-candle']]).toEqual([2, 1]);
  expect([bea.box.state.mayhem.curios['moth-wing'], bea.box.state.mayhem.curios['half-candle']]).toEqual([1, 1]);
});

test('a resident swap: two steps, packing on the shelf, sealed, and a framed portrait in the museum', async ({ page }) => {
  const { fake, ada, bea } = await world();
  await open(page, fake, ada);
  await friends(page);
  await profile(page, 'Bea');
  await host(page).locator('[data-fr-action="trade"]').click();
  const compose = view(page, 'trade-compose');
  await compose.locator('[data-sx="tr-mode"][data-mode="resident"]').click();
  await compose.locator('[data-sx="tr-give-res"][data-sx-id="qa0"]').click();
  await compose.locator('[data-sx="tr-want-res"]').filter({ hasText: 'Gladys' }).click();
  await compose.locator('[data-sx="tr-review"]').click();
  const review = view(page, 'trade-review');
  await expect(review.locator('.tr-bill')).toContainText('Agnes');
  await expect(review.locator('.tr-bill')).toContainText('Gladys');
  await review.locator('[data-sx="tr-send"]').click();
  await expect(review.locator('.tr-confirm')).toContainText('Agnes will live on Bea’s shelf. You will not get Agnes back unless Bea trades it back. Gladys will move onto your shelf, if Bea accepts.');
  await review.locator('[data-sx="tr-send"]').filter({ hasText: 'Yes, send Agnes' }).click();
  await expect(view(page, 'trade-offer')).toContainText('Agnes is packed and waiting by the door.');
  await expect(page.locator('#cabinet .piece.pet[data-id="qa0"]')).toHaveClass(/packing/);
  const id = Object.keys((await saved(page)).trades.escrow)[0];

  await bea.sync.sync({ force: true });
  await bea.sync.accept(bea.sync.cache().trades.find(t => t.id === id));
  await postbox(page);
  const sealed = row(page, 'Sealed with Bea');
  await expect(sealed).toContainText('Agnes went to Bea.');
  await expect(sealed).toContainText('Gladys came from Bea.');
  await sealed.locator('[data-sx="tr-read-sealed"]').click();
  const bill = view(page, 'trade-offer').locator('.tr-bill.is-accepted');
  await expect(bill.locator('.tr-stamp')).toHaveText('Sealed');
  await expect(bill).toContainText('Last words on leaving');
  await expect(bill).toContainText('First words on arriving');
  const after = await saved(page);
  expect(after.pets.map(p => p.name)).toEqual(['Mabel', 'Pip', 'Gladys']);
  const gladys = after.pets.find(p => p.id === 'tr-' + id);
  expect(gladys.needs).toEqual({ food: 78, fuss: 78, clean: 82 });
  expect(gladys.arrivedByTrade.from).toBe('Bea');
  await expect(page.locator('#cabinet .piece.pet[data-id="tr-' + id + '"]')).toBeVisible();
  expect(bea.box.state.pets.find(p => p.id === 'tr-' + id).name).toBe('Agnes');

  await page.locator('#tradeHost [data-h="close"]').click();
  await page.evaluate(() => document.getElementById('museumBtn').click());
  const frames = page.locator('#museumContent .tr-portraits');
  await expect(frames).toContainText('Agnes');
  await expect(frames).toContainText('Lives on Bea’s shelf since');
  await expect(frames.locator('.tr-frame-art .sprite')).toHaveCount(1);
});

test('accepting a resident offer asks twice and names who leaves; the sender can be reported from the mail', async ({ page }) => {
  const { fake, ada, bea } = await world();
  const gladys = bea.box.state.pets.find(p => p.name === 'Gladys');
  await bea.sync.propose({ to: ada.id, toName: 'Ada', draft: { mode: 'resident', giveResident: gladys.id, wantResident: { id: 'qa2', name: 'Pip' } }, line: 'swap' });
  await open(page, fake, ada);
  await friends(page);
  await postbox(page);
  await row(page, 'Bea proposes a trade').locator('[data-sx="tr-open"]').click();
  const offer = view(page, 'trade-offer');
  await expect(offer.locator('.tr-bill')).toContainText('Gladys');
  await offer.locator('[data-sx="tr-report"]').click();
  await offer.locator('[data-sx="tr-reason"][data-sx-id="Bothering me"]').click();
  await offer.locator('[data-sx="tr-report-yes"]').click();
  await expect(offer.locator('.tr-note')).toContainText('Reported.');
  expect(fake.social.reports.at(-1).reason).toContain('Bothering me');
  await offer.locator('[data-sx="tr-accept"]').click();
  await expect(offer.locator('.tr-confirm')).toContainText('Pip will live on Bea’s shelf. You will not get Pip back unless Bea trades it back. Gladys will move onto your shelf');
  expect((await saved(page)).pets.some(p => p.name === 'Pip')).toBe(true);
  await offer.locator('[data-sx="tr-accept"]').filter({ hasText: 'Yes, swap Pip for Gladys' }).click();
  await expect(view(page, 'trade-offer').locator('.tr-bill.is-accepted .tr-stamp')).toHaveText('Sealed');
  const after = await saved(page);
  expect(after.pets.map(p => p.name)).toEqual(['Agnes', 'Mabel', 'Gladys']);
  expect(after.trades.portraits[0].name).toBe('Pip');
  await bea.sync.sync({ force: true });
  expect(bea.box.state.pets.map(p => p.name)).toEqual(['Snag', 'Wanda', 'Pip']);
});

test('a declined offer and an expired one both come off hold, with a word in the postbox', async ({ page }) => {
  const { fake, ada, bea } = await world();
  await open(page, fake, ada);
  await friends(page);
  await profile(page, 'Bea');
  await host(page).locator('[data-fr-action="trade"]').click();
  const compose = view(page, 'trade-compose');
  await compose.locator('[data-sx="tr-give"][data-sx-id="moth-wing"][data-delta="1"]').click();
  await compose.locator('[data-sx="tr-give"][data-sx-id="moth-wing"][data-delta="1"]').click();
  await compose.locator('[data-sx="tr-review"]').click();
  await view(page, 'trade-review').locator('[data-sx="tr-send"]').click();
  await expect(view(page, 'trade-offer')).toContainText('Waiting for Bea');
  const second = await page.evaluate(to => import('/src/ui/trades.js').then(m => m.tradeRuntime().sync.propose({ to, toName: 'Bea', draft: { mode: 'curio', give: { 'glass-eye': 1 }, want: {} } })), bea.id);
  const held = await saved(page);
  expect(Object.keys(held.trades.escrow)).toHaveLength(2);
  const first = Object.keys(held.trades.escrow).find(id => id !== second.id);

  await bea.sync.sync({ force: true });
  await bea.sync.decline(bea.sync.cache().trades.find(t => t.id === first));
  fake.social.trades.age(second.id, 8 * DAY);
  await postbox(page);
  await expect(row(page, 'Declined: Bea')).toContainText('Everything you offered is back where it was.');
  await expect(row(page, 'Expired: Bea')).toContainText('went unanswered for seven days');
  const after = await saved(page);
  expect(after.trades.escrow).toEqual({});
  expect([after.mayhem.curios['moth-wing'], after.mayhem.curios['glass-eye']]).toEqual([3, 2]);
  await page.evaluate(() => window.__tradeHost.go('friend:' + window.__tradeHost.friends()[0].userId));
  await host(page).locator('[data-fr-action="trade"]').click();
  await expect(view(page, 'trade-compose').locator('.tr-pick').filter({ hasText: 'Moth Wing' })).toContainText('2 spare');
});

test('the last resident cannot be offered, and says why', async ({ page }) => {
  const { fake, ada } = await world({ ada: ['Agnes'] });
  await open(page, fake, ada);
  await friends(page);
  await profile(page, 'Bea');
  await host(page).locator('[data-fr-action="trade"]').click();
  const compose = view(page, 'trade-compose');
  await compose.locator('[data-sx="tr-mode"][data-mode="resident"]').click();
  const agnes = compose.locator('[data-sx="tr-give-res"][data-sx-id="qa0"]');
  await expect(agnes).toContainText('The last one here');
  await expect(agnes).toHaveAttribute('aria-disabled', 'true');
  await agnes.dispatchEvent('click');
  await expect(compose.locator('.tr-note')).toContainText('Agnes is the last resident here. Someone has to stay and complain.');
  await compose.locator('[data-sx="tr-review"]').click();
  await expect(view(page, 'trade-compose').locator('.tr-why')).toContainText('Choose which of your residents would go.');
  expect((await saved(page)).trades.escrow).toEqual({});
  expect(fake.calls('propose_trade')).toHaveLength(0);
});
