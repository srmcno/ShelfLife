import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { createCovenClient } from '../../src/cloud/coven.js';
import { VERSION } from '../../src/version.js';

// The labelled in-memory cloud represents the other players and persists the
// same RPC records as the SQL contract tests. All tested actions use real UI.
test.use({ serviceWorkers: 'block', viewport: { width: 360, height: 640 }, actionTimeout: 15000 });
test.describe.configure({ timeout: 150000 });
const NOW = Date.UTC(2026, 9, 14, 12), DAY = 86400000;
const NAME = { a: 'damp', b: 'sisterhood', form: 0 }, SIGIL = { shape: 'shield', symbol: 'spoon', colour: 'bruise' };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
async function world() {
  let at = NOW;
  const now = () => at, fake = createFakeSupabase({ now, tokenLifetime: 60 * 86400 });
  const players = [];
  for (const name of ['Ada', 'Bea', 'Cat']) {
    const shelf = householdFixture('established', NOW);
    shelf.settings.theatreOn = false; shelf.settings.calm = true; shelf.lastBackup = NOW;
    shelf.mayhem.souls = 300; shelf.mayhem.queue = []; shelf.mayhem.nextAt = NOW + 600000;
    shelf.testing = { seenVersion: VERSION, countDays: true, pulse: { done: ['day2', 'day7', 'court'].map(id => ({ id, outcome: 'sent' })), notNow: 0 } };
    const p = await socialPlayer(fake, name, shelf, { now });
    p.coven = createCovenClient({ cloud: p.cloud, social: p.social, now }); players.push(p);
  }
  const [ada, bea, cat] = players;
  for (const p of [bea, cat]) { await ada.social.addFriend(p.code); await p.social.respond(ada.id, true); }
  fake.social.coven.forceGoal = 'coffin-3';
  return { fake, ada, bea, cat, now, date(t) { at = t; } };
}
async function arrive(context, w, player, errors, kept) {
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  // Fix the calendar day while keeping native animations and timers real.
  await page.clock.setFixedTime(w.now());
  await page.addInitScript(({ config, state, cloud }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('coven.fixture')) {
      localStorage.setItem('shelflife.v4', state); localStorage.setItem('shelflife.cloud', cloud);
      sessionStorage.setItem('coven.fixture', '1');
    }
  }, { config: w.fake.config, state: kept?.state || JSON.stringify(player.shelf), cloud: kept?.cloud || JSON.stringify({ session: player.session, socialUser: player.id, socialName: player.name }) });
  await page.route(w.fake.url + '/**', route => w.fake.route(route));
  await page.goto('/'); await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  return page;
}
async function leave(page) {
  const kept = await page.evaluate(() => ({ state: localStorage.getItem('shelflife.v4'), cloud: localStorage.getItem('shelflife.cloud') }));
  await page.close(); return kept;
}
async function friends(page) { await page.locator('#tabMore').click(); await page.locator('#friendsBtn').click(); await expect(page.locator('.cv-home')).toBeVisible(); }
async function main(page) { await page.locator('.cv-home-card[data-sx="coven-open"]').click(); await expect(page.locator('[data-cv-view="coven"] .cv-head')).toBeVisible(); }
async function fits(page) {
  const dims = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth,
    sheets: [...document.querySelectorAll('.veil.open .sheet')].map(el => [el.scrollWidth, el.clientWidth]) }));
  expect(dims.page).toBeLessThanOrEqual(dims.viewport + 1);
  for (const [content, box] of dims.sheets) expect(content).toBeLessThanOrEqual(box + 1);
}
async function capture(page, info, label) {
  await expect(page.locator('#mayhemRankUp')).toBeHidden();
  await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);
  if (label === 'coven-rite-and-chest') await expect(page.locator('#soulsHud .souls-count b')).toHaveText(String((await saved(page)).mayhem.souls));
  await fits(page); const path = info.outputPath(label + '-360x640.png');
  await page.screenshot({ path }); await info.attach(label, { path, contentType: 'image/png' });
}
async function createJoined(w) {
  await w.ada.coven.found(NAME, SIGIL);
  for (const p of [w.bea, w.cat]) { await w.ada.coven.invite(p.id); await p.coven.respond((await p.coven.status()).invites[0].id, true); }
}

test('three players found, join through the Postbox, contribute, open a chest, pin magnets, and receive Monday trophies', async ({ context }, info) => {
  const w = await world(), errors = []; let page = await arrive(context, w, w.ada, errors);
  await friends(page); await page.locator('.cv-home [data-sx="coven-found"]').click();
  await page.locator('[data-sx="reroll"]').click();
  await page.locator('[data-sx="pick"][data-key="symbol"][data-value="spoon"]').click();
  const title = await page.locator('.cv-found-name').textContent();
  await capture(page, info, 'coven-founding');
  await page.locator('[data-sx="found-yes"]').click();
  await expect(page.locator('#friendsSheet h2')).toHaveText(title);
  const status = await w.ada.coven.status(), covenId = status.coven.id, oldWeek = status.week.no;
  expect(status.coven.sigil.symbol).toBe('spoon');
  await page.locator('[data-sx="invite-pick"]').click();
  for (const p of [w.bea, w.cat]) await page.locator('[data-sx="invite"][data-user="' + p.id + '"]').click();
  const kept = new Map([[w.ada.id, await leave(page)]]);
  for (const p of [w.bea, w.cat]) {
    page = await arrive(context, w, p, errors); await friends(page);
    await page.locator('[data-fr="postbox"]').click();
    const invite = page.locator('[data-fr-mail="coven-invites"]');
    await expect(invite).toContainText(title); await invite.locator('[data-sx="accept"]').click();
    await expect(page.locator('[data-cv-view="coven"] .cv-head')).toContainText(title);
    expect((await saved(page)).coven.covenId).toBe(covenId);
    kept.set(p.id, await leave(page));
  }
  expect((await w.ada.coven.status()).members.map(m => m.name)).toEqual(['Ada', 'Bea', 'Cat']);
  page = await arrive(context, w, w.ada, errors, kept.get(w.ada.id));
  // The browser player's contribution is earned by opening a real coffin.
  await page.locator('#mayhemDesk [data-mh="coffin"]').click();
  await page.locator('#mayhemSheet [data-mh="pry"]').click();
  await expect.poll(async () => (await saved(page)).mayhem.coffins).toBeGreaterThan(w.ada.shelf.mayhem.coffins);
  await page.locator('#mayhemSheet .sheet-head [data-mh="close"]').click();
  // The two simulated peer players use the same client RPC for their efforts.
  for (const p of [w.bea, w.cat]) await p.coven.contribute('2026-10-14', { coffin: 1 });
  await friends(page); await main(page);
  await expect.poll(async () => (await w.ada.coven.status()).week.progress).toBe(3);
  await expect(page.locator('.cv-legend')).toContainText('You 1');
  const souls = (await saved(page)).mayhem.souls;
  const chest = page.locator('[data-sx="claim"][data-tier="1"]');
  await expect(chest).toBeEnabled(); await chest.click();
  await expect.poll(async () => (await saved(page)).coven.claimed).toEqual([oldWeek + ':1']);
  expect((await saved(page)).mayhem.souls).toBeGreaterThan(souls);
  await expect(page.locator('#soulsHud')).toHaveAttribute('aria-label', (await saved(page)).mayhem.souls + ' souls. Open the Cabinet of Curiosities.');
  await capture(page, info, 'coven-rite-and-chest');
  await page.locator('[data-sx="compose"]').click();
  for (const tile of ['@' + w.bea.id, 'is', 'not', 'my']) await page.locator('[data-mg="add"][data-mg-tile="' + tile + '"]').click();
  await page.locator('[data-mg="pick"][data-mg-at="3"]').click(); await page.locator('[data-mg="off"]').click();
  await page.locator('[data-mg="undo"]').click();
  await capture(page, info, 'coven-magnets');
  let offline = true;
  await page.route('**/rest/v1/rpc/coven_post', route => offline ? route.abort('internetdisconnected') : w.fake.route(route));
  await page.locator('[data-sx="post"]').click(); await expect(page.locator('.cv-notice')).toContainText('No connection');
  await expect(page.locator('.mg-note [data-mg="pick"]')).toHaveCount(4);
  offline = false; await page.locator('[data-sx="post"]').click();
  await expect(page.locator('.cv-note')).toHaveCount(1);
  expect((await w.ada.coven.board())[0].tiles).toEqual(['@' + w.bea.id, 'is', 'not', 'my']);
  await capture(page, info, 'coven-board'); kept.set(w.ada.id, await leave(page));
  page = await arrive(context, w, w.bea, errors, kept.get(w.bea.id)); await friends(page); await main(page);
  await page.locator('[data-sx="board"]').click(); await expect(page.locator('.cv-note')).toContainText('Bea');
  await page.locator('.cv-note [data-sx="note-down"]').click(); await expect(page.locator('.cv-note')).toHaveCount(0);
  expect((await w.bea.coven.board()).length).toBe(0); kept.set(w.bea.id, await leave(page));
  w.date(Date.UTC(2026, 9, 19, 12));
  page = await arrive(context, w, w.ada, errors, kept.get(w.ada.id)); await friends(page); await main(page);
  await page.locator('[data-sx="ceremony"]').click();
  const awards = [];
  for (let i = 0; i < 3; i++) { await page.locator('[data-sx="ceremony-next"]').click(); awards.push(await page.locator('.cv-award-winner').textContent()); }
  expect(new Set(awards)).toEqual(new Set(['You', 'Bea', 'Cat']));
  await capture(page, info, 'coven-monday-shelfies'); await page.locator('[data-sx="ceremony-next"]').click();
  expect((await saved(page)).coven.trophies).toHaveLength(1);
  await page.reload(); await friends(page); await main(page);
  await expect(page.locator('.cv-trophies li')).toHaveCount(1); await expect(page.locator('[data-sx="claim"][data-week="' + oldWeek + '"][data-tier="1"]')).toHaveCount(0);
  await page.close(); expect(errors).toEqual([]);
});

test('referral days obey the shared privacy switch, resume explicitly, and pay matching frames once', async ({ context }, info) => {
  const w = await world(), errors = []; let page = await arrive(context, w, w.bea, errors);
  await friends(page); await page.locator('.cv-home [data-sx="coven-recruit"]').click();
  await page.locator('#cvReferral').fill('ZZZZZZZZ'); await page.locator('[data-sx="recruit-register"]').click();
  await expect(page.locator('.cv-notice')).toContainText('Nobody has that code');
  await expect(page.locator('#cvReferral')).toHaveValue('ZZZZZZZZ');
  expect(w.fake.social.coven.referrals.has(w.bea.id)).toBe(false);
  await page.locator('#cvReferral').fill(w.ada.code); await page.locator('[data-sx="recruit-register"]').click();
  await expect(page.locator('.cv-recruit').locator('..')).toContainText('Who brought you');
  expect(w.fake.social.coven.referrals.get(w.bea.id).inviter).toBe(w.ada.id);
  // Ada accepts the real friend request; existing friendship also remains valid.
  await expect.poll(() => w.fake.social.coven.activeDays.has(w.bea.id + '|2026-10-14')).toBe(true);
  await page.locator('[data-fr="close"]').click(); await expect(page.locator('#tabMore')).toBeFocused(); await page.locator('#tabMore').click(); await page.locator('#playDaysBtn').click();
  await expect(page.locator('#playDaysBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => w.fake.social.coven.activeDays.size).toBe(0);
  let kept = await leave(page); w.date(NOW + DAY);
  page = await arrive(context, w, w.bea, errors, kept); await friends(page);
  // Cover the real four-second startup wake while consent is off.
  await page.waitForTimeout(4100);
  expect(w.fake.social.coven.activeDays.size).toBe(0);
  await page.locator('[data-fr="close"]').click(); await expect(page.locator('#tabMore')).toBeFocused(); await page.locator('#tabMore').click(); await page.locator('#playDaysBtn').click();
  await expect(page.locator('#playDaysBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => w.fake.social.coven.activeDays.has(w.bea.id + '|2026-10-15')).toBe(true);
  kept = await leave(page);
  for (const delta of [2, 3]) {
    w.date(NOW + delta * DAY); page = await arrive(context, w, w.bea, errors, kept);
    await friends(page);
    await expect.poll(() => w.fake.social.coven.activeDays.has(w.bea.id + '|' + new Date(w.now()).toISOString().slice(0, 10))).toBe(true);
    kept = await leave(page);
  }
  expect((await w.bea.coven.referrals()).invitedBy.days).toBe(3);
  page = await arrive(context, w, w.bea, errors, kept); await friends(page); await page.locator('.cv-home [data-sx="coven-recruit"]').click();
  await page.locator('[data-sx="recruit-claim"][data-user="' + w.ada.id + '"]').click();
  await expect.poll(async () => (await saved(page)).coven.invite.paid).toEqual([w.ada.id]);
  expect((await saved(page)).exchange.portraits).toEqual(expect.arrayContaining(['accomplice-l', 'accomplice-r']));
  await capture(page, info, 'coven-referral-reward');
  await page.reload(); await friends(page); await page.locator('.cv-home [data-sx="coven-recruit"]').click();
  await expect(page.locator('[data-sx="recruit-claim"]')).toHaveCount(0); await leave(page);
  page = await arrive(context, w, w.ada, errors); await friends(page); await page.locator('.cv-home [data-sx="coven-recruit"]').click();
  await page.locator('[data-sx="recruit-claim"][data-user="' + w.bea.id + '"]').click();
  await expect.poll(async () => (await saved(page)).coven.invite.paid).toEqual([w.bea.id]);
  expect((await saved(page)).exchange.portraits).toEqual(expect.arrayContaining(['accomplice-l', 'accomplice-r']));
  await page.close(); expect(errors).toEqual([]);
});

test('leaving transfers the candle and a delayed chest cannot pay into a replacement account', async ({ context }) => {
  const w = await world(), errors = []; await createJoined(w);
  await w.ada.coven.contribute('2026-10-14', { coffin: 3 });
  let page = await arrive(context, w, w.ada, errors); await friends(page); await main(page);
  await page.locator('[data-sx="leave"]').click(); await page.locator('[data-sx="leave-yes"]').click();
  await expect(page.locator('.cv-home [data-sx="coven-found"]')).toBeVisible();
  expect((await w.bea.coven.status()).coven.role).toBe('founder');
  expect((await saved(page)).coven.covenId).toBe('');
  const kept = await leave(page);
  await w.bea.coven.invite(w.ada.id); await w.ada.coven.respond((await w.ada.coven.status()).invites[0].id, true);
  page = await arrive(context, w, w.ada, errors, kept); await friends(page); await main(page);
  await page.evaluate(async () => {
    const { coven } = await import('/src/ui/coven.js'); const claim = coven.claim;
    coven.claim = async (...args) => { try { const result = await claim(...args); globalThis.covenClaimResult = result; return result; } finally { globalThis.covenClaimSettled = true; } };
  });
  let pending;
  await page.route('**/rest/v1/rpc/coven_claim', route => {
    const request = route.request();
    const response = w.fake.handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() || '' });
    pending = { route, response };
  });
  await page.locator('[data-sx="claim"][data-tier="1"]').click(); await expect.poll(() => !!pending).toBe(true);
  expect(pending.response.status).toBe(200); expect(w.fake.social.coven.claims.size).toBe(1);
  const before = await saved(page);
  const replacement = await page.evaluate(async () => {
    const { cloud, social } = await import('/src/cloud/index.js'); await cloud.signOut(); await cloud.signInAnonymously(); social.optIn(); return cloud.userId();
  });
  expect(replacement).not.toBe(w.ada.id); await expect(page.locator('#friendsVeil')).toBeHidden(); await friends(page);
  await pending.route.fulfill({ status: pending.response.status, headers: { ...pending.response.headers, 'access-control-allow-origin': '*' }, body: pending.response.body });
  await expect.poll(() => page.evaluate(() => globalThis.covenClaimSettled)).toBe(true);
  await expect(page.locator('.cv-home [data-sx="coven-found"]')).toBeVisible();
  await expect(page.locator('#friendsSheet h2')).toHaveText('Friends');
  expect((await saved(page)).coven.claimed).toEqual(before.coven.claimed);
  expect((await saved(page)).mayhem.souls).toBe(before.mayhem.souls);
  expect((await saved(page)).coven.covenId).toBe(''); await leave(page);
  expect(errors).toEqual([]);
});


test('restoring a backup in place on the same account invalidates a pending chest payout', async ({ context }) => {
  const w = await world(), errors = []; await createJoined(w);
  await w.ada.coven.contribute('2026-10-14', { coffin: 3 });
  const page = await arrive(context, w, w.ada, errors); await friends(page); await main(page);
  await page.evaluate(async () => {
    const { coven } = await import('/src/ui/coven.js'); const claim = coven.claim;
    coven.claim = async (...args) => { try { const result = await claim(...args); globalThis.covenClaimResult = result; return result; } finally { globalThis.covenClaimSettled = true; } };
  });
  let pending;
  await page.route('**/rest/v1/rpc/coven_claim', route => {
    const request = route.request();
    const response = w.fake.handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() || '' });
    pending = { route, response };
  });
  await page.locator('[data-sx="claim"][data-tier="1"]').click(); await expect.poll(() => !!pending).toBe(true);
  expect(pending.response.status).toBe(200); expect(w.fake.social.coven.claims.size).toBe(1);
  await page.locator('[data-fr="close"]').click();
  const backup = await saved(page); backup.coven.claimed = [];
  await page.locator('#importFile').setInputFiles({ name: 'same-account-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#restoreVeil')).toBeVisible(); await page.locator('#restoreConfirm').click();
  await pending.route.fulfill({ status: pending.response.status, headers: { ...pending.response.headers, 'access-control-allow-origin': '*' }, body: pending.response.body });
  await expect.poll(() => page.evaluate(() => globalThis.covenClaimSettled)).toBe(true);
  expect(await page.evaluate(() => globalThis.covenClaimResult)).toMatchObject({ ok: true, fresh: true });
  const result = await page.evaluate(async () => { const { state } = await import('/src/state.js'); return { souls: state.mayhem.souls, claimed: state.coven.claimed }; });
  expect(result).toEqual({ souls: backup.mayhem.souls, claimed: [] });
  await page.unroute('**/rest/v1/rpc/coven_claim');
  await friends(page); await main(page);
  const collect = page.locator('[data-sx="claim"][data-tier="1"]');
  await expect(collect).toHaveText('Collect on this shelf'); await collect.click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(backup.mayhem.souls + 40);
  await page.reload(); await friends(page); await main(page);
  await expect(page.locator('.cv-chest.opened')).toHaveCount(1);
  const paid = await saved(page);
  await page.locator('[data-fr="close"]').click();
  await page.locator('#importFile').setInputFiles({ name: 'before-reward.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.locator('#restoreConfirm').click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(paid.mayhem.souls);
  await expect.poll(async () => (await saved(page)).coven.rewards[w.ada.id]?.claimed).toEqual(paid.coven.rewards[w.ada.id].claimed);
  await friends(page); await main(page); await expect(page.locator('[data-sx="claim"][data-tier="1"]')).toHaveCount(0);
  await page.close(); expect(errors).toEqual([]);
});


test('a lost chest reply stays collectible after reload and the money receipt pays once', async ({ context }) => {
  const w = await world(), errors = []; await createJoined(w);
  await w.ada.coven.contribute('2026-10-14', { coffin: 3 });
  const page = await arrive(context, w, w.ada, errors); await friends(page); await main(page);
  const before = (await saved(page)).mayhem.souls;
  let lose = true;
  await page.route('**/rest/v1/rpc/coven_claim', route => {
    if (!lose) return w.fake.route(route);
    const request = route.request();
    w.fake.handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() || '' });
    return route.abort('internetdisconnected');
  });
  await page.locator('[data-sx="claim"][data-tier="1"]').click();
  await expect(page.locator('.cv-notice')).toContainText('No connection');
  expect(w.fake.social.coven.claims.size).toBe(1); expect((await saved(page)).mayhem.souls).toBe(before);
  lose = false; await page.reload(); await friends(page); await main(page);
  const collect = page.locator('[data-sx="claim"][data-tier="1"]');
  await expect(collect).toHaveText('Collect on this shelf'); await collect.click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 40);
  await page.reload(); await friends(page); await main(page);
  await expect(page.locator('[data-sx="claim"][data-tier="1"]')).toHaveCount(0);
  expect((await saved(page)).mayhem.souls).toBe(before + 40); expect(w.fake.social.coven.claims.size).toBe(1);
  expect(w.fake.coop.receipts.filter(r => r.owner === w.ada.id && r.kind === 'game' && r.detail?.reward === 'coven_chest')).toHaveLength(1);
  await page.close(); expect(errors).toEqual([]);
});


test('a lost wallet reply leaves an unapplied chest proposal that recovers the canonical gift on reload', async ({ context }) => {
  const w = await world(), errors = []; await createJoined(w); await w.ada.coven.contribute('2026-10-14', { coffin: 3 });
  const page = await arrive(context, w, w.ada, errors); await friends(page); await main(page);
  const before = (await saved(page)).mayhem.souls;
  let blocked = true, committed = false;
  await page.route('**/rest/v1/rpc/coop_adjust', route => {
    const request = route.request(), payload = JSON.parse(request.postData() || '{}');
    const reward = payload.p_ops?.some(op => op.detail?.reward === 'coven_chest');
    if (!blocked || !reward) return w.fake.route(route);
    if (!committed) { w.fake.handle({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData() }); committed = true; }
    return route.abort('internetdisconnected');
  });
  // Receipt reads are also offline after the committed-but-lost response, so
  // the test observes the durable pending state rather than an immediate retry.
  await page.route('**/rest/v1/rpc/coop_receipts', route => committed && blocked ? route.abort('internetdisconnected') : w.fake.route(route));
  await page.locator('[data-sx="claim"][data-tier="1"]').click();
  await expect(page.locator('.cv-notice')).toContainText('No connection');
  expect(committed).toBe(true);
  const pending = (await saved(page)).coop.money.pending.filter(op => op.detail?.reward === 'coven_chest');
  expect(pending).toHaveLength(1); expect(pending[0].preApplied).toBe(false);
  expect((await saved(page)).mayhem.souls).toBe(before); expect((await saved(page)).coven.claimed).toEqual([]);
  await page.reload(); blocked = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await friends(page); await main(page);
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 40);
  await expect(page.locator('[data-sx="claim"][data-tier="1"]')).toHaveCount(0);
  expect(w.fake.coop.receipts.filter(r => r.owner === w.ada.id && r.detail?.reward === 'coven_chest')).toHaveLength(1);
  await page.reload(); await friends(page); await main(page); expect((await saved(page)).mayhem.souls).toBe(before + 40);
  await page.close(); expect(errors).toEqual([]);
});

test('device storage failure refuses a chest award and allows a saved retry after reload', async ({ context }) => {
  const w = await world(), errors = []; await createJoined(w); await w.ada.coven.contribute('2026-10-14', { coffin: 3 });
  const page = await arrive(context, w, w.ada, errors); await friends(page); await main(page);
  const before = (await saved(page)).mayhem.souls;
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'shelflife.v4') throw new DOMException('Test storage quota', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.locator('[data-sx="claim"][data-tier="1"]').click();
  await expect(page.locator('.cv-notice')).toContainText('could not save the reward. Free some storage');
  expect((await saved(page)).mayhem.souls).toBe(before);
  expect(w.fake.coop.receipts.filter(r => r.owner === w.ada.id && r.detail?.reward === 'coven_chest')).toHaveLength(0);
  await page.reload(); await friends(page); await main(page);
  await page.locator('[data-sx="claim"][data-tier="1"]').click();
  await expect.poll(async () => (await saved(page)).mayhem.souls).toBe(before + 40);
  await page.close(); expect(errors).toEqual([]);
});
