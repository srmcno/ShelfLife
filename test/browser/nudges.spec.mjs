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
    cancel: async arg => { window.__nudge.cancels++; (window.__nudge.cancelled ||= []).push((arg?.notifications || []).map(n => n.id)); },
    schedule: async arg => { window.__nudge.schedules.push(arg.notifications.map(n => ({ id: n.id, title: n.title }))); }
  } } };
};

async function open(page, { plugin, answer = 'granted', queue = false, on = false } = {}) {
  const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now(); if (on) { s.settings.nudges = true; s.settings.nudgeAsked = true; }
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
  await expect(page.locator('#nudgeCats')).toBeHidden();
  await page.locator('#nudgeBtn').click();
  await expect(page.locator('#nudgeBtn span')).toHaveText('Nudges on');
  await expect.poll(async () => (await saved(page)).settings.nudges).toBe(true);
  await expect(page.locator('#nudgeCats [data-nudge-cat]')).toHaveCount(4);   // without a reload
  const cancelsBefore = await page.evaluate(() => window.__nudge.cancels);
  await page.locator('#nudgeBtn').click();
  await expect(page.locator('#nudgeBtn span')).toHaveText('Nudges off');
  await expect.poll(() => page.evaluate(() => window.__nudge.cancels)).toBeGreaterThan(cancelsBefore);
  expect((await saved(page)).settings.nudges).toBe(false);
  await expect(page.locator('#nudgeCats')).toBeHidden();   // and the switches go away again
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

test('the way-back ladder is scheduled with the rest, and opening the game cancels it', async ({ page }) => {
  await open(page, { plugin: true, on: true });
  // Opening cancelled the five way-back notes and only those.
  await expect.poll(() => page.evaluate(() => (window.__nudge.cancelled || []).some(ids => ids.length === 5 && ids.every(id => id >= 9111 && id <= 9115)))).toBe(true);
  // Going away schedules everything, ladder included: a day, three, seven, fourteen and thirty days.
  await page.evaluate(() => window.dispatchEvent(new Event('shelflife:pause')));
  await expect.poll(() => page.evaluate(() => window.__nudge.schedules.length)).toBeGreaterThan(0);
  const ids = await page.evaluate(() => window.__nudge.schedules.at(-1).map(n => n.id));
  for (const id of [9111, 9112, 9113, 9114, 9115]) expect(ids).toContain(id);
  const away = await page.evaluate(() => window.__nudge.schedules.at(-1).filter(n => n.id >= 9111 && n.id <= 9115));
  for (const n of away) expect(n.title.length).toBeGreaterThan(3);
});

test('each kind of nudge can be switched off on its own, and the choice sticks', async ({ page }) => {
  await open(page, { plugin: true, on: true });
  await page.locator('#tabMore').click();
  const cats = page.locator('#nudgeCats [data-nudge-cat]');
  await expect(cats).toHaveCount(4);
  for (const button of await cats.all()) await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#nudgeCats [data-nudge-cat="away"]').click();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await saved(page)).settings.nudgeCats.away).toBe(false);
  await expect.poll(async () => (await page.evaluate(() => window.__nudge.schedules.at(-1)?.map(n => n.id) || [])).some(id => id >= 9111 && id <= 9115)).toBe(false);
  expect((await saved(page)).settings.nudgeCats.emergency).toBe(true);
  await page.reload();
  await page.locator('#tabMore').click();
  await expect(page.locator('#nudgeCats [data-nudge-cat="away"]')).toHaveAttribute('aria-pressed', 'false');
});

test('on the web there are no nudge categories to show', async ({ page }) => {
  await open(page, { on: true });
  await page.locator('#tabMore').click();
  await expect(page.locator('#nudgeCats')).toBeHidden();
});
