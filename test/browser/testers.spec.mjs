import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { VERSION } from '../../src/version.js';

// Tools for testers: Report a problem (signed in, and queued while signed
// out), the broken-shelf notice, What's new, the check-in card and the tester
// panel. The cloud is the in-memory fake; nothing reaches a network.
const DELIBERATE = 'A deliberate breakage for the tester spec';
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => { if (!error.message.includes(DELIBERATE)) errors.push(error.message); });
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes(DELIBERATE)) errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 60_000 });

const DAY = 86400000;
function household(customize = () => {}) {
  const s = householdFixture('established');
  s.settings.theatreOn = false;
  s.lastBackup = Date.now();
  // Nothing unprompted unless a test asks for it.
  s.testing = { seenVersion: VERSION, pulse: { done: [{ id: 'day2', outcome: 'sent' }, { id: 'day7', outcome: 'sent' }, { id: 'court', outcome: 'sent' }], notNow: 0 }, countDays: true };
  customize(s);
  return s;
}
async function open(page, { snapshot = household(), fake = null, meta = null, prompts = false, path = '/' } = {}) {
  await page.addInitScript(({ snapshot, config, meta, prompts }) => {
    if (config) globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (prompts) globalThis.SHELFLIFE_PROMPTS = true;
    if (!sessionStorage.getItem('testers.fixture')) {
      if (snapshot) localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      if (meta) localStorage.setItem('shelflife.cloud', JSON.stringify(meta));
      sessionStorage.setItem('testers.fixture', '1');
    }
  }, { snapshot, config: fake?.config || null, meta, prompts });
  if (fake) await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto(path);
  if (snapshot?.pets.length) await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}
async function signedIn(page, opts = {}) {
  const fake = createFakeSupabase();
  const player = await socialPlayer(fake, '', { pets: [] }, { social: false });
  await open(page, { fake, meta: { session: player.session }, ...opts });
  return { fake, player };
}
async function openReport(page) {
  await page.locator('#tabMore').click();
  await page.locator('#feedbackBtn').click();
  await expect(page.locator('#feedbackVeil')).toBeVisible();
}
async function write(page, { kind = 'Bug', body = 'The raisin funeral never ended. It is day three.', doing = 'court' } = {}) {
  await page.locator('#feedbackSheet .fb-kind').filter({ hasText: kind }).click();
  await page.locator('#fbBody').fill(body);
  if (doing) await page.locator('#fbDoing').selectOption(doing);
  await page.locator('[data-fb-review]').click();
  await expect(page.locator('#feedbackSheet .fb-h')).toHaveText('This is everything that will be sent');
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
async function fits(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    sheets: [...document.querySelectorAll('.veil.open .sheet')].map(el => [el.scrollWidth, el.clientWidth]) }));
  expect(sizes.document, 'no horizontal page scroll').toBeLessThanOrEqual(sizes.viewport + 1);
  for (const [content, box] of sizes.sheets) expect(content, 'the sheet does not clip').toBeLessThanOrEqual(box + 1);
}

test.describe('with the fake cloud', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop-chromium', 'The network paths are checked once; layouts below run on phones'));

  test('a signed-in player sees exactly what will be sent, then sends it in one go', async ({ page }) => {
    const { fake } = await signedIn(page);
    // Something breaks first, so the report carries it.
    await page.evaluate(msg => setTimeout(() => { throw new Error(msg); }), DELIBERATE);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.errors') || '[]').length)).toBe(1);
    await openReport(page);
    await page.locator('[data-fb-review]').click();
    await expect(page.locator('#fbWhy')).toHaveText('Choose what kind of thing it is first.');
    await write(page);
    const review = page.locator('#feedbackSheet .fb-review');
    await expect(page.locator('#feedbackSheet .fb-where')).toContainText('from your cloud save account');
    await expect(review).toContainText('The raisin funeral never ended.');
    await expect(review).toContainText('Shelf Court');
    await expect(review).toContainText('Version' + VERSION + ' (build');
    await expect(review).toContainText('Cloud saveguest');
    await expect(review).toContainText(DELIBERATE);
    // The raw view is the same thing, field for field.
    await page.locator('#feedbackSheet .fb-raw summary').click();
    const raw = JSON.parse(await page.locator('#feedbackSheet .fb-raw pre').textContent());
    expect(Object.keys(raw)).toEqual(['client_id', 'kind', 'body', 'doing', 'rating', 'moment', 'version', 'platform', 'diagnostics']);
    expect(fake.calls('submit_feedback')).toHaveLength(0);
    await page.locator('[data-fb-send]').click();
    await expect(page.locator('#feedbackSheet .fb-done')).toContainText('Sent.');
    expect(fake.feedback.feedback).toHaveLength(1);
    const row = fake.feedback.feedback[0];
    expect(row).toMatchObject({ kind: 'bug', body: 'The raisin funeral never ended. It is day three.', doing: 'court', app_version: VERSION, platform: 'web' });
    expect(row.client_id).toBe(raw.client_id);
    expect(row.diagnostics).toEqual(raw.diagnostics);
    expect(row.diagnostics.errors.map(e => e.message)).toEqual(['Uncaught Error: ' + DELIBERATE]);
    expect(row.diagnostics).toMatchObject({ residents: 3, cloud: 'guest', online: true, calm: false, tester: false });
    expect(JSON.stringify(row)).not.toContain('Agnes');
    await page.locator('[data-fb-finish]').click();
    await expect(page.locator('#feedbackVeil')).toBeHidden();
    // A fresh form next time.
    await openReport(page);
    await expect(page.locator('#fbBody')).toHaveValue('');
  });

  test('signed out, a report waits on the device, can be copied, and goes when the player signs in', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const fake = createFakeSupabase();
    await open(page, { fake });
    await openReport(page);
    await write(page, { kind: 'Confusing', body: 'What is a soul worth in raisins?', doing: '' });
    await expect(page.locator('#feedbackSheet .fb-where')).toContainText('You are not signed in to cloud save');
    await page.locator('[data-fb-copy]').click();
    await expect(page.locator('#fbStatus')).toContainText('Copied.');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Kind: Confusing');
    expect(copied).toContain('What is a soul worth in raisins?');
    await page.locator('[data-fb-send]').click();
    await expect(page.locator('#feedbackSheet .fb-done')).toContainText('Kept on this device');
    expect(fake.requests).toHaveLength(0);
    await page.locator('[data-fb-finish]').click();
    await page.locator('#tabMore').click();
    await expect(page.locator('#feedbackBtnSub')).toHaveText('One report waiting to send');
    // Signing in is the player's own choice, in Cloud save.
    await page.locator('#cloudBtn').click();
    await page.locator('#cloudEnable').click();
    await expect.poll(() => fake.feedback.feedback.length).toBe(1);
    expect(fake.feedback.feedback[0]).toMatchObject({ kind: 'confusing', body: 'What is a soul worth in raisins?' });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.feedback')).queue.length)).toBe(0);
    // And today counts as a play day, once.
    await expect.poll(() => fake.feedback.playDays.length).toBe(1);
  });

  test('switching off the play-day count forgets the days already counted', async ({ page }) => {
    const { fake, player } = await signedIn(page);
    await expect.poll(() => fake.feedback.playDays.filter(d => d.user_id === player.id).length).toBe(1);
    await page.locator('#tabMore').click();
    const toggle = page.locator('#playDaysBtn');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('Help improve the game');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#moreTray')).toHaveClass(/open/);
    await expect.poll(() => fake.feedback.playDays.length).toBe(0);
    expect((await saved(page)).testing.countDays).toBe(false);
    await page.reload();
    await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
    await page.waitForTimeout(500);
    expect(fake.calls('mark_play_day')).toHaveLength(1);
  });

  test('a check-in is one tap, goes as a pulse, and never comes back for that moment', async ({ page }) => {
    const { fake } = await signedIn(page, { prompts: true, snapshot: household(s => { s.started = Date.now() - 3 * DAY; s.testing.pulse.done = []; s.courtroom.episodes = 0; }) });
    const card = page.locator('#pulseCard');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Two days in.');
    await card.locator('[data-pulse="4"]').click();
    await card.locator('#pulseLine').fill('The omen made me laugh.');
    await card.locator('[data-pulse-send]').click();
    await expect(card).toContainText('Thank you.');
    await expect.poll(() => fake.feedback.feedback.length).toBe(1);
    expect(fake.feedback.feedback[0]).toMatchObject({ kind: 'pulse', rating: 4, moment: 'day2', body: 'The omen made me laugh.' });
    expect(Object.keys(fake.feedback.feedback[0].diagnostics).sort()).toEqual(['build', 'days', 'platform', 'residents', 'version']);
    expect((await saved(page)).testing.pulse.done).toEqual([{ id: 'day2', outcome: 'sent' }]);
    await page.reload();
    await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
    await page.waitForTimeout(5000);
    await expect(card).toBeHidden();
  });
});

test('the broken-shelf notice appears once a session and opens the report with the error', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Checked once');
  await open(page, { prompts: true });
  await page.evaluate(msg => setTimeout(() => { throw new Error(msg); }), DELIBERATE);
  const notice = page.locator('#brokeNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Something on the shelf broke. Tell us?');
  await notice.locator('[data-broke-tell]').click();
  await expect(page.locator('#feedbackVeil')).toBeVisible();
  await expect(page.locator('#feedbackSheet .fb-kind input[value="bug"]')).toBeChecked();
  await expect(page.locator('#feedbackSheet .fb-error-note')).toContainText(DELIBERATE);
  await page.locator('[data-fb-close]').click();
  await page.evaluate(msg => setTimeout(() => { throw new Error(msg + ' again'); }), DELIBERATE);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.errors')).length)).toBe(2);
  await expect(notice).toBeHidden();
});

test('What’s new shows once after an update, never again, and never on a brand-new install', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-webkit', 'Chromium only');
  await open(page, { prompts: true, snapshot: household(s => { delete s.testing; }) });
  const veil = page.locator('#whatsNewVeil');
  await expect(veil).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#whatsNewSheet h2')).toHaveText('What’s new');
  await expect(page.locator('#whatsNewSheet .wn-version')).toContainText('Shelf Life ' + VERSION + ' · build');
  await expect(page.locator('#whatsNewSheet .wn-list li').first()).toBeVisible();
  await fits(page);
  expect((await saved(page)).testing.seenVersion).toBe(VERSION);
  await page.locator('#whatsNewSheet .wn-actions [data-wn-close]').click();
  await expect(veil).toBeHidden();
  await page.reload();
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  await page.waitForTimeout(2500);
  await expect(veil).toBeHidden();
  // Still there to read on purpose.
  await page.locator('#tabMore').click();
  await page.locator('#whatsNewBtn').click();
  await expect(veil).toBeVisible();
});

test('a brand-new install is not told what is new', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Checked once');
  await open(page, { prompts: true, snapshot: null });
  await page.waitForTimeout(2500);
  await expect(page.locator('#whatsNewVeil')).toBeHidden();
});

test('seven taps on the version line open the tester panel, and its tools mark the save', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-webkit', 'Chromium only');
  await open(page);
  await page.locator('#tabMore').click();
  const line = page.locator('#versionLine');
  await expect(line).toHaveText(new RegExp('^Shelf Life ' + VERSION.replace(/\./g, '\\.') + ' · build \\d{4}-\\d{2}-\\d{2}$'));
  for (let i = 0; i < 6; i++) await line.click();
  await expect(page.locator('#moreTray')).toHaveClass(/open/);
  await expect(page.locator('#testerVeil')).toBeHidden();
  await line.click();
  const panel = page.locator('#testerVeil');
  await expect(panel).toBeVisible();
  await expect(page.locator('#testerSheet .tp-status')).toContainText('This is an ordinary save, for now.');
  await expect(page.locator('#testerSheet .tp-status')).toContainText('never sends daily challenge scores or Shelf Court verdict stars');
  await fits(page);
  // Looking costs nothing.
  await page.locator('[data-tp="offline"]').click();
  await expect(page.locator('[data-tp="offline"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.locator('[data-tp="offline"]').click();
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  expect((await saved(page)).tester).toBe(false);
  // Bending time does not.
  const before = (await saved(page)).mayhem.queue.length;
  await page.locator('[data-tp="emergency"]').click();
  await expect(page.locator('[data-tp-note="time"]')).toContainText('Something has gone wrong. On purpose, this time. This is now a tester save.');
  await expect(page.locator('#testerSheet .tp-status')).toContainText('This is a tester save. It stays one.');
  const after = await saved(page);
  expect(after.tester).toBe(true);
  expect(after.mayhem.queue.length).toBe(before + 1);
  await page.locator('[data-tp="omen"]').click();
  await expect(page.locator('[data-tp-note="time"]')).toContainText(/omen/);
  await page.locator('[data-tp="waits"]').click();
  await expect(page.locator('[data-tp-note="time"]')).toContainText('the next visitor');
  expect((await saved(page)).lastRounds).toBe(0);
  await page.locator('[data-tp-close]').click();
  await expect(panel).toBeHidden();
});

test('?tester=1 opens the panel, and the clock moves a day on and back', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Checked once');
  await open(page, { path: '/?tester=1' });
  await expect(page.locator('#testerVeil')).toBeVisible();
  await expect(page.locator('#testerSheet .tp-clock')).toContainText('Clock: real time');
  await page.locator('[data-tp="dayOn"]').click();
  await page.waitForLoadState('load');
  await expect(page.locator('#testerVeil')).toBeVisible();
  await expect(page.locator('#testerSheet .tp-clock')).toContainText('Clock: 1 day ahead of this device');
  const drift = await page.evaluate(() => Date.now() - performance.timeOrigin - performance.now());
  expect(Math.abs(drift - DAY)).toBeLessThan(60_000);
  expect((await saved(page)).tester).toBe(true);
  await page.locator('[data-tp="realTime"]').click();
  await page.waitForLoadState('load');
  await expect(page.locator('#testerSheet .tp-clock')).toContainText('Clock: real time');
  expect(Math.abs(await page.evaluate(() => Date.now() - performance.timeOrigin - performance.now()))).toBeLessThan(60_000);
});

test('the report sheet, the panel and help fit a small phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Phone widths');
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, { fake: createFakeSupabase() });
  await openReport(page);
  await fits(page);
  await write(page);
  await fits(page);
  const close = await page.locator('[data-fb-close]').boundingBox();
  expect(close.height).toBeGreaterThanOrEqual(36);
  for (const selector of ['[data-fb-send]', '[data-fb-copy]', '[data-fb-back]']) expect((await page.locator(selector).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator('[data-fb-close]').click();
  await page.goto('/?tester=1');
  await expect(page.locator('#testerVeil')).toBeVisible();
  await fits(page);
  await page.locator('[data-tp-close]').click();
  await page.locator('#quickHelp').click();
  await page.locator('#helpTabTesters').click();
  await expect(page.locator('#helpPanelTesters')).toBeVisible();
  await expect(page.locator('#helpTesters')).toContainText('What to try this week');
  await fits(page);
  await page.locator('#helpTesters [data-tn-report]').click();
  await expect(page.locator('#feedbackVeil')).toBeVisible();
});
