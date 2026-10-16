import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';

// These deliberately labelled fake plugins exercise the production extension
// hooks. They do not represent shipped visits, gifts or trade integrations.
const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await use(errors); expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });
test.use({ serviceWorkers: 'block' });
const NOW = Date.UTC(2026, 9, 11, 17);
async function setup(page) {
  const fake = createFakeSupabase({ now: () => NOW });
  const state = householdFixture('established', NOW);
  state.settings.theatreOn = false; state.lastBackup = NOW;
  const ada = await socialPlayer(fake, 'Ada', state, { now: () => NOW });
  const bea = await socialPlayer(fake, 'Bea', state, { now: () => NOW });
  await ada.social.addFriend(bea.code); await bea.social.respond(ada.id, true);
  await bea.social.publish({ force: true });
  await page.clock.install({ time: NOW }); await page.clock.pauseAt(NOW + 1000);
  await page.addInitScript(({ config, state, session, user }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    localStorage.setItem('shelflife.v4', JSON.stringify(state));
    localStorage.setItem('shelflife.cloud', JSON.stringify({ session, socialUser: user }));
  }, { config: fake.config, state, session: ada.session, user: ada.id });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/'); await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  await page.evaluate(async () => {
    const registry = await import('/src/ui/social-registry.js');
    const plugin = globalThis.fakeSocialPlugin = { loads: [], clicks: [], pending: [], delayed: false, fail: false, count: 2 };
    registry.registerFriendsSection({ id: 'fake-home', render: ctx => '<p>Fake plugin home for ' + ctx.me.userId + '</p><button data-sx="home">Fake home action</button>', onClick: (_, __, ctx) => ctx.say('Fake home handled') });
    registry.registerFriendsSection({ id: 'fake-friend', where: 'friend', render: (_, f) => '<button data-sx="friend">Fake section for ' + f.name + '</button>', onClick: (_, __, ctx, f) => ctx.say('Fake friend handled: ' + f.name) });
    registry.registerFriendAction({ id: 'fake-unavailable', label: 'Fake unavailable', available: () => 'Fake cooldown until tomorrow', run: () => { throw Error('Disabled action ran'); } });
    registry.registerFriendAction({ id: 'fake-hidden', label: 'Fake hidden', available: () => false, run() {} });
    registry.registerFriendAction({ id: 'fake-open', label: 'Fake open view', run: (f, ctx) => ctx.show({ id: 'fake-view', title: 'Fake view for ' + f.name, kicker: 'Fake plugin', html: '<button data-sx="delay">Fake delayed action</button><button data-sx="missing">Fake unhandled action</button><form id="fakeForm"><label>Fake message<input name="message"></label><button>Fake submit</button></form>', back: 'friend:' + f.userId }) });
    registry.registerSocialView('fake-view', { onClick: async (action, _, ctx) => {
      if (action === 'delay') { await new Promise(resolve => plugin.pending.push(resolve)); ctx.say('OLD fake action'); ctx.show({ id: 'fake-view', title: 'OLD fake view', html: '<p>Old account</p>' }); plugin.blockedClients = await Promise.allSettled([Promise.resolve().then(() => ctx.cloud.rpc('mark_play_day', { p_day: '2026-10-12' })), Promise.resolve().then(() => ctx.postbox.setDnd(true))]); ctx.state.fakeOldWrite = true; ctx.save(); }
    }, onSubmit: (form, ctx) => { ctx.state.fakeSocialMessage = new FormData(form).get('message'); ctx.save(); ctx.renderAll(); ctx.say('Fake message saved'); } });
    registry.registerPostboxSource({ id: 'fake-mail', label: 'Fake mail', poll: true, count: () => plugin.count,
      load: async ctx => { plugin.loads.push(ctx.me.userId); if (plugin.delayed) await new Promise(resolve => plugin.pending.push(resolve)); if (plugin.fail) throw Error('Fake source unavailable'); return [{ id: 'old', at: 1, title: 'Fake older mail', line: 'For ' + ctx.me.userId }, { id: 'new', at: 2, title: 'Fake newer mail', line: 'For ' + ctx.me.userId }]; },
      onClick: (_, id, ctx) => { plugin.clicks.push(id); plugin.count = 0; ctx.say('Fake mail handled'); ctx.refresh(); } });
    registry.registerPostboxSource({ id: 'fake-render', label: 'Fake rendered mail', count: () => 1, load: async () => [{ id: 'button', at: 3 }], render: () => '<p>Fake rendered row</p><button data-sx="take" data-sx-id="button">Fake mail action</button>', onClick: (_, id, ctx) => { plugin.clicks.push(id); ctx.say('Fake mail handled'); } });
  });
  return { fake, ada, bea };
}
async function openFriends(page) { await page.locator('#tabMore').click(); await page.locator('#friendsBtn').click(); await expect(page.locator('#frAdd')).toBeVisible(); }
async function visit(page, bea) { await page.locator('[data-fr="profile"][data-user="' + bea.id + '"]').click(); }

test('registered fake actions, sections, views and mail affect the actual Friends UI', async ({ page }) => {
  const { ada, bea } = await setup(page); await openFriends(page);
  await expect(page.locator('#friendsSheet')).toContainText('Fake plugin home for ' + ada.id);
  await expect(page.locator('#friendsBadge')).toHaveText('3');
  await page.getByRole('button', { name: 'Fake home action' }).click(); await expect(page.locator('.fr-status')).toHaveText('Fake home handled');
  await visit(page, bea);
  await expect(page.getByRole('button', { name: 'Fake unavailable' })).toBeDisabled();
  await expect(page.locator('#friendsSheet')).toContainText('Fake cooldown until tomorrow');
  await expect(page.getByRole('button', { name: 'Fake hidden', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fake section for Bea' }).click(); await expect(page.locator('.fr-status')).toHaveText('Fake friend handled: Bea');
  await page.getByRole('button', { name: 'Fake open view' }).click(); await expect(page.locator('#friendsSheet h2')).toHaveText('Fake view for Bea');
  await page.getByRole('button', { name: 'Fake unhandled action' }).click(); await expect(page.locator('#friendsSheet h2')).toHaveText('Fake view for Bea');
  await page.locator('#fakeForm input').fill('A saved fake message'); await page.getByRole('button', { name: 'Fake submit' }).click();
  await expect(page.locator('.fr-status')).toHaveText('Fake message saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')).fakeSocialMessage)).toBe('A saved fake message');
  await page.locator('[data-fr="custom-back"]').click(); await expect(page.locator('#friendsSheet h2')).toHaveText('Bea');
  await page.locator('[data-fr="back"]').click(); await page.locator('[data-fr="postbox"]').click();
  await expect(page.locator('[data-fr-mail="fake-mail"]')).toHaveCount(2);
  expect(await page.locator('[data-fr-mail="fake-mail"] b').allTextContents()).toEqual(['Fake newer mail', 'Fake older mail']);
  await page.getByRole('button', { name: 'Fake mail action' }).click(); await expect(page.locator('.fr-status')).toHaveText('Fake mail handled');
  expect(await page.evaluate(() => fakeSocialPlugin.clicks)).toEqual(['button']);
});

test('custom form errors preserve values and focus for retry, while a fresh view resets deliberately', async ({ page }) => {
  const { bea } = await setup(page);
  await page.evaluate(async () => {
    const registry = await import('/src/ui/social-registry.js');
    const plugin = globalThis.fakeSocialPlugin;
    plugin.formAttempts = []; plugin.formFail = true;
    const html = '<form id="fakeRetryForm"><label>Fake retry message<input name="message" value="Initial"></label><label>Fake detail<textarea name="detail">Initial detail</textarea></label><label>Fake choices<select name="choice" multiple><option value="a">A</option><option value="b">B</option></select></label><label><input type="checkbox" name="approve" value="yes">Fake approval</label><label><input type="radio" name="side" value="left" checked>Left</label><label><input type="radio" name="side" value="right">Right</label><button id="fakeRetrySubmit">Submit fake retry</button><button type="button" data-sx="reset">Reset fake view</button><button type="button" id="fakeAlwaysDisabled" disabled>Fake always disabled</button></form>';
    const show = ctx => ctx.show({ id: 'fake-retry', title: 'Fake retry form', html });
    registry.registerFriendAction({ id: 'fake-retry', label: 'Open fake retry', run: (_, ctx) => show(ctx) });
    registry.registerSocialView('fake-retry', { onSubmit: async (form, ctx) => {
      const values = Object.fromEntries(new FormData(form));
      values.choice = new FormData(form).getAll('choice'); plugin.formAttempts.push(values);
      const button = form.querySelector('#fakeRetrySubmit');
      button.disabled = true;
      try { await new Promise(resolve => plugin.pending.push(resolve)); }
      finally { button.disabled = false; }
      if (plugin.formFail) throw Error('Deliberately failed fake form');
      ctx.state.fakeRetryValues = values; ctx.save(); ctx.renderAll(); ctx.say('Fake retry saved');
    }, onClick: (_, __, ctx) => show(ctx) });
  });
  await openFriends(page); await visit(page, bea); await page.getByRole('button', { name: 'Open fake retry' }).click();
  const input = page.locator('#fakeRetryForm input[name="message"]'), detail = page.locator('#fakeRetryForm textarea');
  await input.fill('Keep my message'); await detail.fill('Keep my detail');
  await page.locator('#fakeRetryForm select').selectOption(['a', 'b']);
  await page.locator('#fakeRetryForm input[name="approve"]').check(); await page.locator('#fakeRetryForm input[value="right"]').check();
  await input.focus(); await input.press('Enter');
  await expect(page.locator('#fakeRetrySubmit')).toBeDisabled();
  await expect(input).toHaveValue('Keep my message'); await expect(input).toBeFocused();
  await page.evaluate(() => fakeSocialPlugin.pending.splice(0).forEach(resolve => resolve()));
  await expect(page.locator('.fr-status')).not.toBeEmpty(); await expect(page.locator('#fakeRetrySubmit')).toBeEnabled();
  await expect(input).toHaveValue('Keep my message'); await expect(input).toBeFocused(); await expect(detail).toHaveValue('Keep my detail');
  await expect(page.locator('#fakeRetryForm select')).toHaveValues(['a', 'b']);
  await expect(page.locator('#fakeRetryForm input[name="approve"]')).toBeChecked(); await expect(page.locator('#fakeRetryForm input[value="right"]')).toBeChecked();
  await expect(page.locator('#fakeAlwaysDisabled')).toBeDisabled();
  await page.evaluate(() => { fakeSocialPlugin.formFail = false; }); await input.press('Enter');
  await expect.poll(() => page.evaluate(() => fakeSocialPlugin.formAttempts.length)).toBe(2);
  await page.evaluate(() => fakeSocialPlugin.pending.splice(0).forEach(resolve => resolve()));
  await expect(page.locator('.fr-status')).toHaveText('Fake retry saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')).fakeRetryValues)).toEqual({ message: 'Keep my message', detail: 'Keep my detail', choice: ['a', 'b'], approve: 'yes', side: 'right' });
  expect(await page.evaluate(() => fakeSocialPlugin.formAttempts[0])).toEqual(await page.evaluate(() => fakeSocialPlugin.formAttempts[1]));
  await page.getByRole('button', { name: 'Reset fake view' }).click(); await expect(input).toHaveValue('Initial'); await expect(detail).toHaveValue('Initial detail');
  await expect(page.locator('#fakeRetryForm input[name="approve"]')).not.toBeChecked(); await expect(page.locator('#fakeAlwaysDisabled')).toBeDisabled();
});

test('registered mail polls only in the foreground and shows recoverable source errors', async ({ page }) => {
  await setup(page); await openFriends(page);
  const loads = () => page.evaluate(() => fakeSocialPlugin.loads.length);
  const before = await loads(); await page.clock.fastForward(30001); await expect.poll(loads).toBeGreaterThan(before);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  const hidden = await loads(); await page.clock.fastForward(30001); expect(await loads()).toBe(hidden);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(loads).toBeGreaterThan(hidden);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:pause')));
  const paused = await loads(); await page.clock.fastForward(60001); expect(await loads()).toBe(paused);
  await page.evaluate(() => { fakeSocialPlugin.fail = true; window.dispatchEvent(new CustomEvent('shelflife:resume')); });
  await page.locator('[data-fr="postbox"]').click(); await expect(page.locator('#friendsSheet')).toContainText('Could not load Fake mail');
  await page.evaluate(() => { fakeSocialPlugin.fail = false; }); await page.locator('[data-fr="postbox-refresh"]').click();
  await expect(page.locator('[data-fr-mail="fake-mail"]')).toHaveCount(2);
  await expect(page.locator('#friendsSheet')).not.toContainText('Could not load Fake mail');
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  const offline = await loads(); await page.clock.fastForward(30001); expect(await loads()).toBe(offline);
  await page.getByRole('button', { name: 'Fake mail action' }).click();
  await expect(page.locator('.fr-status')).toContainText('online'); expect(await page.evaluate(() => fakeSocialPlugin.clicks)).toEqual([]);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
  await expect.poll(loads).toBeGreaterThan(offline);
});

test('delayed fake mail and custom view callbacks cannot paint or save into a replacement account', async ({ page }) => {
  const { ada, bea } = await setup(page); await openFriends(page); await visit(page, bea);
  await page.getByRole('button', { name: 'Fake open view' }).click(); await page.getByRole('button', { name: 'Fake delayed action' }).click();
  await page.evaluate(() => { fakeSocialPlugin.delayed = true; }); await page.clock.fastForward(30001);
  await expect.poll(() => page.evaluate(() => fakeSocialPlugin.pending.length)).toBeGreaterThan(1);
  const replacement = await page.evaluate(async () => {
    const { cloud, social } = await import('/src/cloud/index.js'); await cloud.signOut(); await cloud.signInAnonymously(); social.optIn();
    fakeSocialPlugin.delayed = false; return cloud.userId();
  });
  expect(replacement).not.toBe(ada.id); await expect(page.locator('#friendsVeil')).not.toHaveClass(/\bopen\b/);
  // The exit animation uses a timer; this spec intentionally pauses the clock.
  await page.clock.fastForward(250); await expect(page.locator('#friendsVeil')).toBeHidden();
  await openFriends(page); await expect(page.locator('#friendsSheet')).toContainText('Fake plugin home for ' + replacement);
  await page.evaluate(() => { fakeSocialPlugin.pending.splice(0).forEach(resolve => resolve()); });
  await expect(page.locator('#friendsSheet h2')).toHaveText('Friends');
  await expect(page.locator('.fr-status')).not.toContainText('OLD');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')).fakeOldWrite)).toBeUndefined();
  expect(await page.evaluate(() => fakeSocialPlugin.blockedClients.map(r => [r.status, r.reason?.code]))).toEqual([['rejected', 'signed_out'], ['rejected', 'signed_out']]);
  await page.locator('[data-fr="postbox"]').click(); await expect(page.locator('[data-fr-mail="fake-mail"]')).toHaveCount(2);
  await expect(page.locator('#friendsSheet')).toContainText('For ' + replacement); await expect(page.locator('#friendsSheet')).not.toContainText('For ' + ada.id);
});

test('broken fake renderers and missing custom handlers leave the Friends sheet usable', async ({ page }) => {
  const { bea } = await setup(page);
  await page.evaluate(async () => {
    const registry = await import('/src/ui/social-registry.js');
    registry.registerFriendsSection({ id: 'fake-broken', render: () => { throw Error('Deliberately broken fake section'); } });
    const hostileRow = { id: 'safe', at: 4, title: '<img src=x onerror="throw Error(1)">', line: '<b>Fake text</b>', html: '<img src=x onerror="globalThis.fakeMarkupExecuted = true">' };
    registry.registerPostboxSource({ id: 'fake-fallback', label: 'Fake fallback', load: async () => [hostileRow], render: () => { throw Error('Deliberately broken fake renderer'); } });
    registry.registerPostboxSource({ id: 'fake-raw', label: 'Fake raw mail', load: async () => [hostileRow] });
    registry.registerFriendAction({ id: 'fake-no-owner', label: 'Fake missing owner', run: (_, ctx) => ctx.show({ id: 'fake-unregistered-view', title: 'Fake unregistered view', html: '<button data-sx="unknown">Fake unknown click</button><form><button>Fake unknown submit</button></form>' }) });
    registry.registerFriendAction({ id: 'fake-error', label: 'Fake failing action', run: async () => { throw Error('Deliberately failed fake action'); } });
  });
  await openFriends(page); await expect(page.locator('#friendsSheet')).toContainText('This Friends section is unavailable.');
  await page.locator('[data-fr="postbox"]').click(); await expect(page.locator('[data-fr-mail="fake-fallback"]')).toContainText('<b>Fake text</b>');
  await expect(page.locator('[data-fr-mail="fake-fallback"] img')).toHaveCount(0);
  await expect(page.locator('[data-fr-mail="fake-raw"] img')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.fakeMarkupExecuted)).toBeUndefined();
  await page.locator('[data-fr="back"]').click(); await visit(page, bea);
  await page.getByRole('button', { name: 'Fake failing action' }).click(); await expect(page.locator('.fr-status')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Fake missing owner' }).click(); await page.getByRole('button', { name: 'Fake unknown click' }).click();
  await page.getByRole('button', { name: 'Fake unknown submit' }).click(); await expect(page.locator('#friendsSheet h2')).toHaveText('Fake unregistered view');
  await page.locator('[data-fr="custom-back"]').click(); await expect(page.locator('#frAdd')).toBeVisible();
  await page.evaluate(async () => { const registry = await import('/src/ui/social-registry.js'); registry.resetSocialRegistry(); registry.registerPostboxSource({ id: 'fake-empty', load: async () => [] }); });
  await page.locator('[data-fr="postbox"]').click(); await expect(page.locator('#friendsSheet')).toContainText('Empty. Not even a bill.');
});

test('the host renderAll callback repaints the wallet and ignores an obsolete account context', async ({ page }) => {
  const { bea } = await setup(page);
  await page.evaluate(async () => {
    const registry = await import('/src/ui/social-registry.js');
    registry.registerFriendAction({ id: 'fake-wallet', label: 'Fake wallet reward', run: (_, ctx) => {
      globalThis.fakeWalletContext = ctx;
      ctx.state.mayhem.souls += 30; ctx.save(); ctx.renderAll();
    } });
  });
  await openFriends(page); await visit(page, bea);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')).mayhem.souls);
  await page.getByRole('button', { name: 'Fake wallet reward' }).click();
  await expect(page.locator('#soulsHud .souls-count b')).toHaveText(String(before + 30));
  await expect(page.locator('#soulsHud')).toHaveAttribute('aria-label', before + 30 + ' souls. Open the Cabinet of Curiosities.');
  await page.evaluate(async () => { const { cloud, social } = await import('/src/cloud/index.js'); await cloud.signOut(); await cloud.signInAnonymously(); social.optIn(); });
  const displayed = await page.locator('#soulsHud .souls-count b').textContent();
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js'); state.mayhem.souls += 71;
    // A paused test clock isolates this callback from ordinary scheduled renders.
    fakeWalletContext.renderAll();
  });
  await expect(page.locator('#soulsHud .souls-count b')).toHaveText(displayed);
});
