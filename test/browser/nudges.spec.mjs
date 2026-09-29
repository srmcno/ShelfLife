import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

// A stand-in for Capacitor's LocalNotifications plugin that records what the game asks of it.
const fakePlugin = answer => ({ answer }) => {
  window.__nudge = { cancels: 0, schedules: [], asked: 0 };
  window.Capacitor = { Plugins: { LocalNotifications: {
    checkPermissions: async () => ({ display: 'prompt' }),
    requestPermissions: async () => { window.__nudge.asked++; return { display: answer }; },
    cancel: async () => { window.__nudge.cancels++; },
    schedule: async arg => { window.__nudge.schedules.push(arg.notifications.map(n => ({ id: n.id, title: n.title }))); }
  } } };
};

async function open(page, { plugin, answer = 'granted', queue = false } = {}) {
  const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now();
  // The omen is already read, so the alert strip shows the emergency.
  if (queue) { const day = todayKey(); s.mayhem = { souls: 10, lifetime: 10, nextAt: Date.now() + 600000, serial: 1, queue: [{ uid: 1, id: 'ouija', a: s.pets[0].id, at: Date.now() }], omen: { day, id: 'wet-hand', streak: 1, lastDay: day, grace: 1 } }; }
  if (plugin) await page.addInitScript(fakePlugin(answer), { answer });
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('nudge-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('nudge-fixture', '1'); } }, s);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
// The page runs in America/Chicago, so "today" is read in that zone.
function todayKey() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day);
}

test('on the web there is no nudge button and no offer', async ({ page }) => {
  await open(page, { queue: true });
  await page.locator('#tabMore').click();
  await expect(page.locator('#nudgeBtn')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('#mayhemAlert [data-mh="emergency"]').click();
  await page.locator('#mayhemSheet [data-choice="0"]').click();
  await expect(page.locator('#mayhemSheet .mh-outcome')).toBeVisible();
  await expect(page.locator('#mayhemSheet .mh-nudge')).toHaveCount(0);
});

test('in the app the first resolved emergency offers nudges once, and yes schedules them', async ({ page }) => {
  await open(page, { plugin: true, queue: true });
  await page.locator('#mayhemAlert [data-mh="emergency"]').click();
  await page.locator('#mayhemSheet [data-choice="0"]').click();
  await expect(page.locator('#mayhemSheet .mh-nudge')).toBeVisible();
  await page.locator('#mayhemSheet [data-mh="nudge"]').click();
  await expect(page.locator('#mayhemSheet .mh-nudge')).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).settings.nudges).toBe(true);
  expect((await saved(page)).settings.nudgeAsked).toBe(true);
  expect(await page.evaluate(() => window.__nudge.asked)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__nudge.schedules.length)).toBeGreaterThan(0);
  const titles = await page.evaluate(() => window.__nudge.schedules.at(-1).map(n => n.title));
  expect(titles).toContain('A new day on the shelf');
});

test('the tray toggle turns nudges off and clears what was scheduled; a refusal leaves them off', async ({ page }) => {
  await open(page, { plugin: true });
  await page.locator('#tabMore').click();
  await expect(page.locator('#nudgeBtn')).toBeVisible();
  await expect(page.locator('#nudgeBtn span')).toHaveText('Nudges off');
  await page.locator('#nudgeBtn').click();
  await expect(page.locator('#nudgeBtn span')).toHaveText('Nudges on');
  await expect.poll(async () => (await saved(page)).settings.nudges).toBe(true);
  const cancelsBefore = await page.evaluate(() => window.__nudge.cancels);
  await page.locator('#nudgeBtn').click();
  await expect(page.locator('#nudgeBtn span')).toHaveText('Nudges off');
  await expect.poll(() => page.evaluate(() => window.__nudge.cancels)).toBeGreaterThan(cancelsBefore);
  expect((await saved(page)).settings.nudges).toBe(false);
});

test('a refused permission keeps nudges off and says so', async ({ page }) => {
  await open(page, { plugin: true, answer: 'denied' });
  await page.locator('#tabMore').click();
  await page.locator('#nudgeBtn').click();
  await expect(page.locator('#toast')).toContainText('phone said no');
  await expect(page.locator('#nudgeBtn span')).toHaveText('Nudges off');
  expect((await saved(page)).settings.nudges).toBe(false);
});

test('“Not now” asks once and never again', async ({ page }) => {
  await open(page, { plugin: true, queue: true });
  await page.locator('#mayhemAlert [data-mh="emergency"]').click();
  await page.locator('#mayhemSheet [data-choice="0"]').click();
  await page.locator('#mayhemSheet [data-mh="nudge-no"]').click();
  await expect(page.locator('#mayhemSheet .mh-nudge')).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).settings.nudgeAsked).toBe(true);
  expect((await saved(page)).settings.nudges).toBe(false);
});
