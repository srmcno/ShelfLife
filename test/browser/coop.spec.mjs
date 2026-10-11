import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { bindCoopMoney, captureCoopMoney } from '../../src/engine/coop-money.js';
import { addSouls } from '../../src/engine/mayhem.js';
import { createCoop } from '../../src/cloud/coop.js';
import { firstStackDrop } from './support/stack.mjs';
import { waitForArcadePlay } from './support/arcade.mjs';

// Labelled in-memory Supabase: both players use actual Friends/arcade controls.
// Only authentication and the passage of 49 server hours are fixtures.
test.use({ serviceWorkers: 'block' });
test.setTimeout(60_000);
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
function household() {
  const s = householdFixture('established');
  s.settings.theatreOn = false; s.lastBackup = Date.now();
  s.mayhem.souls = 100; s.mayhem.lifetime = 100;
  return s;
}
async function world() {
  const fake = createFakeSupabase(), aShelf = household(), bShelf = household();
  const a = await socialPlayer(fake, 'Ada', aShelf), b = await socialPlayer(fake, 'Bea', bShelf);
  await a.social.addFriend(b.code); await b.social.respond(a.id, true);
  return { fake, a, b, aShelf, bShelf };
}
async function open(page, fake, player, fixture) {
  await page.addInitScript(({ config, session, user, fixture }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('coop.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(fixture));
      localStorage.setItem('shelflife.cloud', JSON.stringify({ session, socialUser: user }));
      sessionStorage.setItem('coop.fixture', '1');
    }
  }, { config: fake.config, session: player.session, user: player.id, fixture });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
}
async function friends(page) {
  await page.bringToFront();
  await page.locator('#tabMore').click(); await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toHaveClass(/open/);
}
async function postbox(page) {
  await friends(page);
  await page.locator('#friendsSheet [data-fr="postbox"]').click();
}
async function challenge(page) {
  await friends(page);
  await page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' }).locator('[data-fr="profile"]').click();
  await page.locator('[data-fr-action="coop-duel"]').click();
  await page.locator('.co-game:has([value="stack"])').click();
  await expect(page.locator('[name="coGame"][value="stack"]')).toBeChecked();
  await page.locator('.co-stake:has([value="25"])').click();
  await expect(page.locator('[name="coStake"][value="25"]')).toBeChecked();
  const sizes = await page.evaluate(() => { const sheet = document.getElementById('friendsSheet');
    return { viewport: innerWidth, page: document.documentElement.scrollWidth, sheet: sheet.scrollWidth, width: sheet.clientWidth }; });
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.sheet).toBeLessThanOrEqual(sizes.width + 1);
  await page.locator('[data-sx="duel-go"]').click();
  await expect(page.locator('#arcadeVeil')).toHaveClass(/open/);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(75);
}
async function leaveRun(page, score) {
  await waitForArcadePlay(page);
  if (score) await firstStackDrop(page);
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await expect(page.locator('#arcadeVeil')).not.toHaveClass(/open/);
}
function errors(page, transportPath = '') {
  const runtime = [], consoleErrors = []; let interrupted = 0;
  page.on('pageerror', e => runtime.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', r => { if (transportPath && r.url().endsWith(transportPath) && r.status() === 503) interrupted++; });
  return () => {
    expect(runtime, 'uncaught browser errors').toEqual([]);
    expect(consoleErrors.filter(s => !transportPath || !/503/.test(s)), 'unexpected console errors').toEqual([]);
    if (transportPath) expect(interrupted, 'exactly one labelled transport failure').toBe(1);
  };
}

test('two players match a real 25-soul wager, play the same seed, and conserve the purse after settlement', async ({ page, browser }, info) => {
  const { fake, a, b, aShelf, bShelf } = await world();
  const otherContext = await browser.newContext({ viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch, deviceScaleFactor: info.project.use.deviceScaleFactor, timezoneId: 'America/Chicago', serviceWorkers: 'block' });
  const other = await otherContext.newPage(), pageErrors = errors(page), otherErrors = errors(other);
  try {
    await open(page, fake, a, aShelf); await open(other, fake, b, bShelf);
    await challenge(page); await leaveRun(page, true);
    await expect.poll(() => [...fake.coop.duels.values()][0]?.rounds[0].status).toBe('second');
    const d = [...fake.coop.duels.values()][0];
    expect(d.rounds[0].first_score).toBeGreaterThan(0);
    await postbox(other);
    await other.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="play"]').click();
    await expect(other.locator('#arcadeVeil')).toHaveClass(/open/);
    await expect.poll(async () => (await saved(other)).mayhem.souls).toBe(75);
    expect((await saved(other)).coop.attempts.find(x => x.owner === b.id && x.duelId === d.id).seed).toBe(d.rounds[0].seed);
    await leaveRun(other, false);
    await expect.poll(() => d.rounds[0].status).toBe('done');
    expect(d.rounds[0].second_score).toBe(0);
    // The fake clock expires the completed round without simulating gameplay.
    fake.coop.age(49 * 3600000);
    await page.reload(); await postbox(page);
    await page.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="claim"]').click();
    await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(125);
    await other.reload(); await postbox(other);
    await other.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="claim"]').click();
    await expect.poll(async () => (await saved(other)).coop.ledger[b.id]?.seq).toBe(2);
    const pa = await saved(page), pb = await saved(other);
    expect(pa.mayhem.souls + pb.mayhem.souls).toBe(200);
    expect([pa.mayhem.lifetime, pb.mayhem.lifetime]).toEqual([125, 100]);
    await page.reload(); await other.reload();
    await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(125);
    expect((await saved(other)).mayhem.souls).toBe(75);
    pageErrors(); otherErrors();
  } finally { await otherContext.close(); }
});

test('a committed refund survives a lost response, reload and restoring a backup before the wager', async ({ page }) => {
  const { fake, a, aShelf } = await world(), pageErrors = errors(page, '/coop_duel_claim');
  await open(page, fake, a, aShelf); await challenge(page); await leaveRun(page, false);
  const d = [...fake.coop.duels.values()][0];
  fake.coop.age(49 * 3600000);
  let lost = 0;
  // Commit on the labelled fake server, then lose the reply once in transport.
  await page.route(fake.url + '/rest/v1/rpc/coop_duel_claim', async route => {
    if (lost++) return fake.route(route);
    const request = route.request();
    fake.handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() || '' });
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Receipt transport interrupted' }) });
  });
  await page.reload(); await postbox(page);
  await page.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="claim"]').click();
  await expect.poll(() => d.claimed_challenger).toBe(true);
  expect((await saved(page)).mayhem.souls).toBe(75);
  await page.reload(); await postbox(page);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(100);
  expect(lost).toBe(1);
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await page.locator('#importFile').setInputFiles({ name: 'before-wager.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(aShelf)) });
  await expect(page.locator('#restoreVeil')).toBeVisible(); await page.locator('#restoreConfirm').click();
  await postbox(page);
  await expect.poll(async () => (await saved(page)).coop.ledger[a.id]?.seq).toBe(2);
  expect((await saved(page)).mayhem.souls).toBe(100);
  pageErrors();
});

test('a field report wage receipt remains payable after a lost collect response', async ({ page }) => {
  const { fake, a, b, aShelf } = await world(), pageErrors = errors(page, '/coop_collect');
  const owner = createCoop({ cloud: a.cloud, social: a.social }), hirer = createCoop({ cloud: b.cloud, social: b.social });
  // A labelled completed-trip fixture; collecting still uses the actual screen.
  await owner.setHires([aShelf.pets[0]]);
  const hire = await hirer.hire(a.id, aShelf.pets[0].id);
  await hirer.finishHire(hire.id, { route: 'drawer', gear: 'thread', edition: 0, rev: 2, score: 8, tier: 2, returned: 0, built: false, choices: [1, 0, 1], helped: [0], crew: ['Gladys'] });
  await open(page, fake, a, aShelf);
  let lost = false;
  await page.route(fake.url + '/rest/v1/rpc/coop_collect', async route => {
    const request = route.request();
    fake.handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() || '' });
    lost = true;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Receipt transport interrupted' }) });
  });
  await postbox(page); await page.locator('[data-co-mail="hire:' + hire.id + '"] [data-sx="read"]').click();
  await expect.poll(() => lost).toBe(true);
  expect((await saved(page)).mayhem.souls).toBe(100);
  await page.reload(); await postbox(page);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(112);
  await page.reload(); await postbox(page);
  expect((await saved(page)).mayhem.souls).toBe(112);
  pageErrors();
});

test('switching the signed-in player on one shelf keeps both players attempts and settlements separate', async ({ page }) => {
  const { fake, a, b, aShelf } = await world(), pageErrors = errors(page);
  await open(page, fake, a, aShelf); await challenge(page); await firstStackDrop(page);
  const d = [...fake.coop.duels.values()][0];
  // Finish A's live run while B is now signed in. It must stay queued for A.
  await page.evaluate(({ session, user }) => localStorage.setItem('shelflife.cloud', JSON.stringify({ session, socialUser: user })),
    { session: b.session, user: b.id });
  await leaveRun(page, false);
  expect(d.rounds[0].first_score).toBe(null);
  expect((await saved(page)).coop.attempts.find(x => x.owner === a.id && x.duelId === d.id).state).toBe('played');
  const replaceAccount = async player => {
    // Labelled authenticated-session fixture, equivalent to signing into the
    // other account on this same shelf. The game save is retained in full.
    await page.evaluate(({ session, user }) => localStorage.setItem('shelflife.cloud', JSON.stringify({ session, socialUser: user })),
      { session: player.session, user: player.id });
    await page.reload();
  };
  await replaceAccount(a); await postbox(page);
  await expect.poll(() => d.rounds[0].status).toBe('second');
  expect(d.rounds[0].first_score).toBeGreaterThan(0);
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await replaceAccount(b); await postbox(page);
  await page.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="play"]').click();
  await expect(page.locator('#arcadeVeil')).toHaveClass(/open/);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(50);
  await leaveRun(page, false); await expect.poll(() => d.rounds[0].status).toBe('done');
  const attempts = (await saved(page)).coop.attempts.filter(x => x.duelId === d.id);
  expect(attempts.map(x => x.owner).sort()).toEqual([a.id, b.id].sort());
  expect(attempts.every(x => x.state === 'sent')).toBe(true);
  fake.coop.age(49 * 3600000);
  await page.reload(); await postbox(page);
  await page.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="claim"]').click();
  await expect.poll(async () => (await saved(page)).coop.ledger[b.id]?.seq).toBe(2);
  expect((await saved(page)).mayhem.souls).toBe(50);
  await replaceAccount(a); await postbox(page);
  await page.locator('[data-co-mail="duel:' + d.id + '"] [data-sx="claim"]').click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(100);
  expect((await saved(page)).coop.ledger[a.id].seq).toBe(2);
  pageErrors();
});


test('a new device chooses its real cloud household before wagering and preserves that copy’s unsynced earnings', async ({ page }) => {
  const { fake, a, aShelf } = await world(), runtime = errors(page);
  const account = createCoop({ cloud: a.cloud, social: a.social });
  bindCoopMoney(aShelf, a.id); await account.openWallet(100);
  addSouls(aShelf, 20); const operation = captureCoopMoney(aShelf, a.id);
  fake.setRemote(a.id, aShelf, { device: 'android-original' });
  const local = household(); local.mayhem.souls = 0; local.mayhem.lifetime = 0; local.pets[0].name = 'Local shelf';
  const financeCalls = () => fake.requests.filter(r => /\/rpc\/coop_(open|adjust)$/.test(r.path)).length;
  const before = financeCalls();
  await open(page, fake, a, local); await friends(page);
  await expect(page.locator('[data-sx="cloud-copy"]')).toBeVisible();
  expect((await saved(page)).mayhem.souls).toBe(0);
  expect(financeCalls(), 'reading an existing account wallet cannot declare another opening').toBe(before);
  await page.locator('[data-sx="cloud-copy"]').click();
  await expect(page.locator('#cloudVeil')).toHaveClass(/open/);
  await expect(page.locator('#cloudConflict')).toBeVisible();
  await page.locator('#cloudUseRemote').click();
  await expect(page.locator('#cloudStatus')).toContainText('Now using the cloud copy.');
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(120);
  const spare = await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4.beforecloud')));
  expect(spare.mayhem.souls).toBe(0); expect(spare.pets[0].name).toBe('Local shelf');
  await expect.poll(async () => (await account.wallet()).balance).toBe(120);
  await expect.poll(async () => (await saved(page)).coop.money.pending.some(p => p.id === operation.id)).toBe(false);
  await page.locator('#cloudClose').click(); await friends(page);
  await expect(page.locator('[data-sx="cloud-copy"]')).toHaveCount(0);
  await page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' }).locator('[data-fr="profile"]').click();
  await page.locator('[data-fr-action="coop-duel"]').click();
  await page.locator('.co-game:has([value="stack"])').click();
  await page.locator('.co-stake:has([value="25"])').click();
  await page.locator('[data-sx="duel-go"]').click();
  await expect(page.locator('#arcadeVeil')).toHaveClass(/open/);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(95);
  expect((await account.wallet()).balance).toBe(95);
  await leaveRun(page, false); runtime();
});
