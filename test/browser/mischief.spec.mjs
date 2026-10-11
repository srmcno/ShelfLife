import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { mischiefRoll } from '../support/fake-mischief.mjs';
import { HEX_BY_ID, BOWLS } from '../../src/content/mischief.js';

test.use({ actionTimeout: 15000, serviceWorkers: 'block', viewport: { width: 360, height: 640 } });
test.describe.configure({ timeout: 120000 });
const NOW = Date.UTC(2026, 9, 20, 18);
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
async function world({ knock = null } = {}) {
  let at = NOW;
  const now = () => at;
  const fake = createFakeSupabase({ now, tokenLifetime: 60 * 86400 });
  const shelf = names => {
    const s = householdFixture('established', NOW);
    s.settings.theatreOn = false; s.settings.calm = true; s.lastBackup = NOW;
    s.pets.forEach((p, i) => { p.name = names[i]; });
    s.mayhem.queue = []; s.mayhem.nextAt = NOW + 600000;
    return s;
  };
  const ada = await socialPlayer(fake, 'Ada', shelf(['Agnes', 'Grubbs', 'Pip']), { now });
  const bea = await socialPlayer(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda']), { now });
  if (knock === 'trick') {
    // A completely occupied shelf must keep its resident and furniture controls
    // available while the visitor has a separate, clickable space.
    bea.shelf.slots.forEach((id, slot) => {
      if (id) return;
      const prop = { id: 'guest-fixture-' + slot, kind: 'bowl' };
      bea.shelf.props.push(prop); bea.shelf.slots[slot] = prop.id;
    });
  }
  bea.shelf.pets[1].needs = { food: 20, fuss: 90, clean: 90 };
  bea.shelf.returns = { seenAt: NOW - 20 * 3600000, claimedDay: '', claimed: 0, serial: 0, pending: null };
  await ada.social.addFriend(bea.code); await bea.social.respond(ada.id, true);
  if (knock) {
    const odds = BOWLS.find(b => b.id === 'apples').treat;
    const date = Array.from({ length: 12 }, (_, i) => Date.UTC(2026, 9, 20 + i, 18)).find(t => {
      const seed = ada.id + ':' + bea.id + ':' + new Date(t).toISOString().slice(0, 10);
      return (mischiefRoll(seed + ':door') % 100 < odds ? 'treat' : 'trick') === knock;
    });
    expect(date, 'a real in-season date with the requested server roll').toBeTruthy();
    at = date;
    for (const p of [ada, bea]) { p.shelf.lastTick = at; p.shelf.lastBackup = at; p.shelf.mayhem.nextAt = at + 600000; }
  }
  await ada.social.publish({ force: true }); await bea.social.publish({ force: true });
  return { fake, ada, bea, now };
}
async function arrive(context, w, player, errors, kept) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: w.now() });
  await page.addInitScript(({ config, state, cloud }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('mischief.fixture')) {
      localStorage.setItem('shelflife.v4', state);
      localStorage.setItem('shelflife.cloud', cloud);
      sessionStorage.setItem('mischief.fixture', '1');
    }
  }, { config: w.fake.config, state: kept?.state || JSON.stringify(player.shelf), cloud: kept?.cloud || JSON.stringify({ session: player.session, socialUser: player.id, socialName: player.name }) });
  await page.route(w.fake.url + '/**', route => w.fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  return page;
}
async function leave(page) {
  const kept = await page.evaluate(() => ({ state: localStorage.getItem('shelflife.v4'), cloud: localStorage.getItem('shelflife.cloud') }));
  await page.close(); return kept;
}
async function friends(page) {
  await page.locator('#tabMore').click(); await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsSheet .fr-friend')).toHaveCount(1);
}
async function profile(page, name) {
  await page.locator('#friendsSheet [data-fr="profile"]').click();
  await expect(page.locator('#friendsSheet h2')).toHaveText(name);
}
async function postbox(page) {
  await page.locator('#friendsSheet [data-fr="postbox"]').click();
  await expect(page.locator('#friendsSheet h2')).toHaveText('Postbox');
}
async function fits(page) {
  const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth,
    sheets: [...document.querySelectorAll('.veil.open .sheet')].map(el => [el.scrollWidth, el.clientWidth]) }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
  for (const [content, width] of widths.sheets) expect(content).toBeLessThanOrEqual(width + 1);
}
async function capture(page, testInfo, name) {
  const path = testInfo.outputPath(name + '-360x640.png');
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}
const mail = (page, source) => page.locator('#friendsSheet [data-fr-mail="mischief-' + source + '"]');

test('a hex retries without losing the choices, arrives as an emergency, and rebounds through the Postbox', async ({ context }, testInfo) => {
  const w = await world(), errors = [];
  let page = await arrive(context, w, w.ada, errors);
  await friends(page); await profile(page, 'Bea');
  await page.locator('[data-fr-action="mischief-hex"]').click();
  await expect(page.locator('.mx-hand')).toBeVisible();
  const cards = await page.locator('input[name="mxCard"]').evaluateAll(inputs => inputs.map(el => el.value));
  const card = cards.find(id => HEX_BY_ID[id]?.choices.some(c => c.outcomes.at(-1).rebound));
  expect(card).toBeTruthy();
  await page.locator('input[name="mxCard"][value="' + card + '"]').locator('..').click();
  await page.locator('input[name="mxCulprit"][value="qa1"]').locator('..').click();
  let offline = true;
  await page.route('**/rest/v1/rpc/send_hex', route => offline ? route.abort('internetdisconnected') : w.fake.route(route));
  await page.locator('.mx-view [data-sx="send"]').click();
  await expect(page.locator('.mx-status')).toContainText('No connection');
  await expect(page.locator('input[name="mxCard"]:checked')).toHaveValue(card);
  await expect(page.locator('input[name="mxCulprit"]:checked')).toHaveValue('qa1');
  expect(w.fake.mischief.hexes.size).toBe(0);
  offline = false;
  await page.locator('.mx-view [data-sx="send"]').click();
  await expect(page.locator('#friendsSheet h2')).toHaveText('Hex sent');
  await fits(page);
  await capture(page, testInfo, 'hex-sent');
  const [hex] = [...w.fake.mischief.hexes.values()];
  expect([hex.from_user, hex.to_user, hex.card, hex.culprit.name]).toEqual([w.ada.id, w.bea.id, card, 'Grubbs']);
  const adaKept = await leave(page);
  page = await arrive(context, w, w.bea, errors);
  await friends(page); await postbox(page);
  await expect(mail(page, 'incoming')).toContainText(HEX_BY_ID[card].name);
  await mail(page, 'incoming').locator('[data-sx="play"]').click();
  await expect(page.locator('#mayhemSheet .mx-from')).toContainText('Ada');
  await expect(page.locator('#mayhemSheet .mh-card')).toContainText('Grubbs');
  await fits(page);
  await capture(page, testInfo, 'hex-emergency');
  const before = (await saved(page)).mayhem.souls;
  const choice = HEX_BY_ID[card].choices.findIndex(c => c.outcomes.at(-1).rebound);
  // Control the random draw, rather than manufacturing a result or changing the card.
  await page.evaluate(() => { globalThis.mischiefRealRandom = Math.random; Math.random = () => .999999; });
  await page.locator('#mayhemSheet [data-choice="' + choice + '"]').click();
  await page.evaluate(() => { Math.random = globalThis.mischiefRealRandom; delete globalThis.mischiefRealRandom; });
  await expect.poll(() => w.fake.mischief.hexes.get(hex.id).status).toBe('resolved');
  expect(w.fake.mischief.hexes.get(hex.id).rebound).toBe(true);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBeGreaterThan(before);
  await page.locator('#mayhemSheet .sheet-head [data-mh="close"]').click();
  const beaKept = await leave(page);
  page = await arrive(context, w, w.ada, errors, adaKept);
  await friends(page); await postbox(page);
  await expect(mail(page, 'news')).toContainText('Bea resolved your ' + HEX_BY_ID[card].name);
  await leave(page);
  page = await arrive(context, w, w.bea, errors, beaKept);
  await friends(page); await postbox(page);
  await expect(mail(page, 'news').filter({ hasText: 'Rebound ready' })).toBeVisible();
  await mail(page, 'news').locator('[data-sx="rebound"]').click();
  await expect(page.locator('.mx-rebound')).toContainText('free');
  await page.locator('.mx-view [data-sx="send"]').click();
  await expect(page.locator('#friendsSheet h2')).toHaveText('Hex sent');
  expect([...w.fake.mischief.hexes.values()].filter(h => h.from_user === w.bea.id && h.to_user === w.ada.id && h.free && h.rebound_of === hex.id).length).toBe(1);
  await page.reload(); await friends(page); await postbox(page);
  await expect(mail(page, 'news').locator('[data-sx="rebound"]')).toHaveCount(0);
  await page.close(); expect(errors).toEqual([]);
});

test('help changes the resident once, appears in their care and return cards, and survives reload', async ({ context }, testInfo) => {
  const w = await world(), errors = [];
  let page = await arrive(context, w, w.ada, errors);
  await friends(page); await profile(page, 'Bea');
  await page.locator('[data-fr-action="mischief-help"]').click();
  await page.locator('[data-sx="help"][data-mx-res="qa1"][data-mx-need="food"]').click();
  await expect(page.locator('.mx-sent')).toContainText('Snag');
  await fits(page);
  await page.locator('[data-fr="custom-back"]').click();
  await expect(page.locator('[data-fr-action="mischief-help"]')).toBeDisabled();
  await leave(page);
  page = await arrive(context, w, w.bea, errors);
  await expect.poll(async () => (await saved(page)).mischief?.helps?.length).toBe(1);
  const food = (await saved(page)).pets.find(p => p.id === 'qa1').needs.food;
  expect(food).toBeGreaterThan(20);
  await expect(page.locator('.alm-return')).toContainText('Ada fed Snag');
  await page.locator('#cabinet .piece.pet[data-id="qa1"]').click();
  await expect(page.locator('#cardSheet')).toContainText('Ada fed Snag while you were out.');
  await fits(page);
  await capture(page, testInfo, 'help-care-card');
  await page.locator('#cardClose').click();
  await page.reload();
  await expect.poll(async () => (await saved(page)).mischief?.helps?.length).toBe(1);
  await friends(page); await postbox(page);
  await expect(mail(page, 'helps')).toContainText('Ada fed Snag');
  expect((await saved(page)).pets.find(p => p.id === 'qa1').needs.food).toBeCloseTo(food, 0);
  await page.close(); expect(errors).toEqual([]);
});

for (const result of ['trick', 'treat']) test('seasonal ' + result + ' uses the server roll and bowl, and a visiting ghost can be shooed once', async ({ context }, testInfo) => {
  const w = await world({ knock: result }), errors = [];
  let page = await arrive(context, w, w.bea, errors);
  await friends(page);
  await page.locator('input[name="mxBowl"][value="apples"]').locator('..').click();
  await page.locator('.mx-doorstep [data-sx="bowl"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toContainText('The bowl is out');
  const beaKept = await leave(page);
  page = await arrive(context, w, w.ada, errors);
  await friends(page); await profile(page, 'Bea');
  await page.locator('[data-fr-action="mischief-knock"]').click();
  await page.locator('.mx-view [data-sx="knock"]').click();
  await expect(page.locator('.mx-knock-result')).toBeVisible();
  const [knock] = [...w.fake.mischief.knocks.values()];
  expect(knock.result).toBe(result);
  if (result === 'trick') expect((await saved(page)).mischief.hexes.some(h => h.trick && h.ref === 'trick-' + knock.id)).toBe(true);
  await expect(page.locator('.mx-knock-result b')).toHaveText(knock.result === 'trick' ? 'Trick.' : 'Treat.');
  await expect(page.locator('.mx-knock-view')).toContainText('They left out:');
  await fits(page);
  await capture(page, testInfo, 'seasonal-' + result);
  await page.locator('[data-fr="custom-back"]').click();
  await expect(page.locator('[data-fr-action="mischief-knock"]')).toBeDisabled();
  await page.locator('[data-fr-action="mischief-hex"]').click();
  await page.locator('input[name="mxCard"][value="haunt"]').locator('..').click();
  await page.locator('input[name="mxCulprit"][value="qa2"]').locator('..').click();
  await page.locator('.mx-view [data-sx="send"]').click();
  await expect(page.locator('#friendsSheet h2')).toHaveText('Haunting sent');
  const adaKept = await leave(page);
  page = await arrive(context, w, w.bea, errors, beaKept);
  await friends(page); await postbox(page);
  await expect(mail(page, 'doorstep')).toContainText('Ada knocked');
  await expect(mail(page, 'incoming')).toContainText('Pip’s ghost');
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await page.locator('.tab[data-tab="shelf"]').click();
  const before = (await saved(page)).mayhem.souls;
  const ghost = page.locator('.mx-ghost');
  await expect(ghost).toHaveAttribute('aria-label', /Pip.*Ada/);
  await ghost.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'visiting-ghost');
  const assertVisitorSpace = async () => {
    const layout = await page.evaluate(() => {
      const ghost = document.querySelector('.mx-ghost').getBoundingClientRect();
      const overlaps = [...document.querySelectorAll('#cabinet .piece')].filter(el => {
        const piece = el.getBoundingClientRect();
        return ghost.left < piece.right && ghost.right > piece.left && ghost.top < piece.bottom && ghost.bottom > piece.top;
      });
      const host = document.querySelector('.mx-haunt').getBoundingClientRect();
      return { overlaps: overlaps.length, contained: ghost.left >= host.left && ghost.right <= host.right && ghost.top >= host.top && ghost.bottom <= host.bottom };
    });
    expect(layout).toEqual({ overlaps: 0, contained: true }); await fits(page);
  };
  let disconnected = result === 'trick';
  if (disconnected) await page.route('**/rest/v1/rpc/**', route => disconnected ? route.abort('internetdisconnected') : w.fake.route(route));
  await assertVisitorSpace();
  for (let tap = 0; tap < 5; tap++) { await ghost.click(); if (tap < 4) await assertVisitorSpace(); }
  await expect.poll(async () => (await saved(page)).mischief?.haunt?.shooed).toBe(true);
  if (disconnected) {
    expect((await saved(page)).mayhem.souls).toBe(before);
    expect((await saved(page)).coop.money.pending.filter(op => op.detail?.reward === 'mischief_shoo' && op.preApplied === false)).toHaveLength(1);
    await expect(page.locator('#toast')).toContainText('collect when you are online');
    await page.reload();
    await expect(page.locator('.mx-ghost')).toHaveCount(0);
    expect((await saved(page)).mayhem.souls).toBe(before);
    expect((await saved(page)).mischief.outbox.filter(op => op.op === 'shoo')).toHaveLength(1);
    disconnected = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => [...w.fake.mischief.hauntings.values()][0].status).toBe('shooed');
  }
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 15);
  await expect.poll(async () => (await saved(page)).coop.money.pending.filter(op => op.detail?.reward === 'mischief_shoo').length).toBe(0);
  const paid = (await saved(page)).mayhem.souls;
  await page.reload(); await friends(page); await postbox(page);
  await expect(mail(page, 'incoming')).toHaveCount(0);
  expect((await saved(page)).mayhem.souls).toBe(paid);
  await leave(page);
  page = await arrive(context, w, w.ada, errors, adaKept);
  await friends(page); await postbox(page);
  await expect(mail(page, 'news')).toContainText('Your ghost was shooed');
  await page.close(); expect(errors).toEqual([]);
});
