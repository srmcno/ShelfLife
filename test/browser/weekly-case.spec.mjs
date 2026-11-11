import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer, pageSession } from '../support/social-world.mjs';
import { weekNumber, weeklyCaseId } from '../../src/engine/weekly.js';
import { COURT_BY_ID } from '../../src/engine/court.js';

test.use({ serviceWorkers: 'block' });
function shelf() { const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now(); return s; }
async function lobby(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
}

test('the case of the week is offered to everyone, and its count opens once you rule', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'The weekly case is checked once, with a phone width set explicitly.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const week = weekNumber(), caseId = weeklyCaseId(week), title = COURT_BY_ID[caseId].title;
  const fake = createFakeSupabase(), ada = await socialPlayer(fake, 'Ada');
  for (const [n, verdict] of [['Bea', 'plaintiff'], ['Cat', 'plaintiff'], ['Dot', 'both']]) {
    const other = await socialPlayer(fake, n);
    await other.cloud.rpc('weekly_rule', { p_week: week, p_case: caseId, p_verdict: verdict });
  }
  await page.addInitScript(({ snapshot, config, session }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); localStorage.setItem('shelflife.cloud', session);
  }, { snapshot: shelf(), config: fake.config, session: pageSession(ada) });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await lobby(page);
  const card = page.locator('#courtSheet .wk-case');
  await expect(card).toContainText(title);
  await expect(card).toContainText('Rule on it and be counted.');
  await expect(card.locator('.wk-bars')).toHaveCount(0);
  const hear = card.locator('[data-sc="weekly"]');
  if (await hear.count()) { await hear.click(); }
  await expect(card).toContainText('The count is sealed until you rule.');
  await expect(page.locator('#courtSheet .sc-tonight h3')).toHaveText(title);

  // The episode itself is covered elsewhere; here the ruling is filed directly.
  await page.evaluate(async id => { const m = await import('/src/ui/weekly-case.js'); await m.weeklyRuled({ caseId: id, ruling: 'both' }); }, caseId);
  await expect(card).toContainText('You declared them both idiots.');
  await expect(card.locator('.wk-bars li')).toHaveCount(3);
  await expect(card).toContainText('The neighbourhood is split down the middle. 4 households ruled.');
  expect(fake.weekly.rulings.filter(r => r.user === ada.id).map(r => r.verdict)).toEqual(['both']);
  // A rerun cannot change the record.
  await page.evaluate(async id => { const m = await import('/src/ui/weekly-case.js'); await m.weeklyRuled({ caseId: id, ruling: 'plaintiff' }); }, caseId);
  expect(fake.weekly.rulings.filter(r => r.user === ada.id).map(r => r.verdict)).toEqual(['both']);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const box = await card.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(321);
  expect(errors).toEqual([]);
});

test('signed out, the week still has its case and nothing is sent', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Checked once.');
  const outside = [];
  page.on('request', request => { if (new URL(request.url()).hostname !== 'localhost') outside.push(request.url()); });
  await page.addInitScript(snapshot => localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)), shelf());
  await page.goto('/');
  await lobby(page);
  await expect(page.locator('#courtSheet .wk-case')).toContainText(COURT_BY_ID[weeklyCaseId(weekNumber())].title);
  await page.evaluate(async id => { const m = await import('/src/ui/weekly-case.js'); await m.weeklyRuled({ caseId: id, ruling: 'defendant' }); }, weeklyCaseId(weekNumber()));
  await expect(page.locator('#courtSheet .wk-case')).toContainText('You found for the defendant.');
  await expect(page.locator('#courtSheet .wk-case')).toContainText('Sign in under Friends');
  expect(outside).toEqual([]);
});
