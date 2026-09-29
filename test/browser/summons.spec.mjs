import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { dailyChallenge } from '../../src/engine/daily.js';
import { SUMMONS_SOULS, VERDICT_SOULS } from '../../src/engine/court.js';

// Two players, one browser context: the page is Ada, then Bea, then Ada
// again, each with their own shelf and session, against one fake server.
// Ada serves papers, Bea hears the case in Shelf Court, Ada reads the
// verdict; then Ada plays the daily challenge and sees friends' scores.
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 240000 });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The social layer is checked once, with phone widths set explicitly');
});

const DAY = 86400000;
// The page runs in America/Chicago, and day keys count months from zero.
function chicagoKey(time) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(time)).map(x => [x.type, x.value]));
  return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day);
}
// Coffin Stack is the challenge that a test can play to the end with the
// space bar, so the page lives on the next day it comes round.
const SHIFT = [0, 1, 2, 3].map(n => n * DAY).find(ms => dailyChallenge(chicagoKey(Date.now() + ms)).game === 'stack');
const shifted = () => Date.now() + SHIFT;

function shelf(names, now) {
  const s = householdFixture('established', now);
  s.settings.theatreOn = false;
  s.lastBackup = now;
  s.pets.forEach((p, i) => { p.name = names[i]; p.names = [{ name: names[i], at: s.started }]; });
  return s;
}
const read = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
async function arrive(context, fake, { shelf: saved, cloud }, errors) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: shifted() });
  await page.addInitScript(({ saved, cloud, config }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('summons.fixture')) {
      localStorage.setItem('shelflife.v4', saved);
      localStorage.setItem('shelflife.cloud', cloud);
      sessionStorage.setItem('summons.fixture', '1');
    }
  }, { saved, cloud, config: fake.config });
  await page.route(fake.url + '/**', route => fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  return page;
}
async function leave(page) {
  const kept = { shelf: await read(page, 'shelflife.v4'), cloud: await read(page, 'shelflife.cloud') };
  await page.close();
  return kept;
}
const souls = async page => JSON.parse(await read(page, 'shelflife.v4')).mayhem.souls;
async function noOverflow(page, width = 320) {
  await page.setViewportSize({ width, height: 760 });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 ||
    [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1));
  expect(wide, 'nothing overflows at ' + width).toBe(false);
  await page.setViewportSize({ width: 1440, height: 900 });
}
// Coffin Stack to the end with the space bar. Under "Slim coffins" the first
// coffin only overlaps after a moment, so the first drop waits for it; a run
// that still scores nothing is played again.
async function stackRun(page, { tries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
    await page.waitForTimeout(400);
    for (let i = 0; i < 80 && !(await page.locator('#arcadeSheet .ar-over').count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(170); }
    await expect(page.locator('#arcadeSheet .ar-over')).toBeVisible();
    const score = Number(await page.locator('#arcadeSheet .ar-final b').textContent());
    if (score > 0 || attempt + 1 >= tries) return score;
    await expect(page.locator('#arcadeSheet .ar-again')).toBeEnabled();
    await page.locator('#arcadeSheet .ar-again').click();
  }
}
// As in court.spec.mjs: dialogue is advanced from inside the page; every
// choice is a real click. Questions: the first on offer. Chaos: the gavel.
async function playEpisode(page, ruling) {
  for (let turn = 0; turn < 40; turn++) {
    const state = await page.evaluate(async () => {
      const sheet = document.getElementById('courtSheet');
      for (let n = 0; n < 600; n++) {
        if (sheet.querySelector('.sc-wrap')) return { wrap: true };
        const controls = sheet.querySelector('[data-sc-controls]:not([hidden])');
        const choices = controls ? [...controls.querySelectorAll('[data-sc-choice]')].map(b => b.dataset.scChoice) : [];
        if (choices.length) return { choices };
        sheet.querySelector('[data-sc-box]')?.click();
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return {};
    });
    if (state.wrap) return;
    if (!state.choices) continue;
    const value = state.choices.includes(ruling) ? ruling : state.choices.includes('gavel') ? 'gavel' : state.choices[0];
    await page.locator('#courtSheet [data-sc-choice="' + value + '"]').click();
  }
  await expect(page.locator('#courtSheet .sc-wrap')).toBeVisible();
}

test('papers served, the case heard in Shelf Court, the verdict read, and friends on the daily board', async ({ context }) => {
  expect(SHIFT, 'Coffin Stack comes round within four days').not.toBeUndefined();
  const errors = [];
  const fake = createFakeSupabase({ now: shifted });
  const adaShelf = shelf(['Agnes', 'Lord Dampington III', 'Pip'], shifted());
  const beaShelf = shelf(['Gladys', 'Snag', 'Wanda'], shifted());
  const ada = await socialPlayer(fake, 'Ada', adaShelf, { now: shifted });
  const bea = await socialPlayer(fake, 'Bea', beaShelf, { now: shifted });
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  await bea.social.publish({ force: true });
  let adaHere = { shelf: JSON.stringify(adaShelf), cloud: JSON.stringify({ session: ada.session }) };
  let beaHere = { shelf: JSON.stringify(beaShelf), cloud: JSON.stringify({ session: bea.session }) };

  // ---- Ada serves papers on Bea's Snag, with Agnes suing ----
  let page = await arrive(context, fake, adaHere, errors);
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  const beaRow = page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' });
  await beaRow.locator('[data-fr="menu"]').click();
  await beaRow.locator('[data-fr="serve"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Choose whom to sue.');
  await expect(page.locator('#friendsSheet .fr-res [data-fr="papers"]').first()).toBeFocused();
  await page.locator('#friendsSheet .fr-res').filter({ hasText: 'Snag' }).locator('[data-fr="papers"]').click();
  await page.locator('#frCase').selectOption('borrowed-coffin');
  await page.locator('#frPlaintiff').selectOption('qa0');
  await page.locator('#friendsSheet [data-fr-form="serve"] button[type="submit"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Papers served. Bea will find them in Shelf Court.');
  const [papers] = [...fake.social.summons.values()];
  expect([papers.case_id, papers.plaintiff.name, papers.defendant.id, papers.status]).toEqual(['borrowed-coffin', 'Agnes', 'qa1', 'open']);
  adaHere = await leave(page);

  // ---- Bea finds them, takes the case and rules ----
  page = await arrive(context, fake, beaHere, errors);
  const beaBefore = await souls(page);
  await page.locator('#tabMore').click();
  await expect(page.locator('#friendsBtnSub')).toHaveText('Shelves, papers and scores');
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsSheet .fr-inbox')).toContainText('1 set of papers waits for you in Shelf Court.');
  await expect(page.locator('#friendsBadge')).toHaveText('1');
  await page.locator('#friendsSheet [data-fr="court"]').click();
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
  const summons = page.locator('#courtSheet .sc-summons-case');
  await expect(summons).toHaveText(/Agnes, from Ada, is suing Snag over The Borrowed Coffin\./);
  await noOverflow(page);
  await summons.locator('[data-sc-take]').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  await expect(page.locator('#courtSheet .sc-podium.p .sc-lectern span')).toHaveText('Agnes');
  await expect(page.locator('#courtSheet .sc-podium.d .sc-lectern span')).toHaveText('Snag');
  await expect(page.locator('#courtSheet .sc-podium.p .sprite')).toHaveCount(1);
  await expect(page.locator('#courtSheet .sc-seat[title="Gladys"]'), 'our Gladys shares an id with their Agnes and still gets her seat').toHaveCount(1);
  await playEpisode(page, 'plaintiff');
  await expect(page.locator('#courtSheet [data-sc-verdict]')).toContainText('+' + SUMMONS_SOULS + ' for hearing Ada’s summons. The verdict is on its way.');
  await expect.poll(() => fake.social.summons.get(papers.id).status).toBe('ruled');
  const ruled = fake.social.summons.get(papers.id);
  expect(ruled.verdict).toBe('plaintiff');
  expect(ruled.stars).toBeGreaterThanOrEqual(1);
  const beaAfter = JSON.parse(await read(page, 'shelflife.v4'));
  expect(beaAfter.courtroom.summonsPaid).toEqual([papers.id]);
  expect(beaAfter.courtroom.episodes, 'a friend’s case is not one of ours').toBe(0);
  expect(beaAfter.pets.map(p => p.courtCases)).toEqual([0, 0, 0]);
  expect(beaAfter.mayhem.souls - beaBefore).toBeGreaterThanOrEqual(SUMMONS_SOULS);
  await page.locator('#courtSheet [data-sc="lobby"]').click();
  await expect(page.locator('#courtSheet .sc-summons-case')).toHaveCount(0);
  beaHere = await leave(page);

  // ---- Ada reads the verdict in Shelf Court ----
  page = await arrive(context, fake, adaHere, errors);
  const adaBefore = await souls(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  const verdict = page.locator('#courtSheet .sc-verdict');
  await expect(verdict).toContainText('Bea found for Agnes in The Borrowed Coffin. ' + ruled.stars + (ruled.stars === 1 ? ' star' : ' stars') + ', ratings ' + ruled.ratings + '.');
  await expect(verdict).toContainText('+' + VERDICT_SOULS + ' souls for the news.');
  await expect.poll(() => fake.social.summons.get(papers.id).sender_seen_at).not.toBeNull();
  await expect.poll(() => souls(page)).toBe(adaBefore + VERDICT_SOULS);
  await page.keyboard.press('Escape');

  // ---- The daily board: friends by name, strangers as a number ----
  const day = chicagoKey(shifted()), challenge = dailyChallenge(day);
  await bea.social.submitScore({ game: 'stack', day, score: 3, mod: challenge.mod.id });
  for (const [name, score] of [['Cat', 1], ['Dan', 40]]) {
    const stranger = await socialPlayer(fake, name, { pets: [] }, { now: shifted });
    await stranger.social.submitScore({ game: 'stack', day, score, mod: challenge.mod.id });
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: 'stack' } })));
  const board = page.locator('#arcadeSheet .ar-board');
  await expect(board).toContainText('Friends today');
  await expect(board.locator('.ar-board-list li')).toHaveText(['1Bea3']);
  await expect(board).toContainText('3 players so far today. The best scored 40.');
  await page.locator('#arcadeSheet [data-ar="challenge"]').click();
  const score = await stackRun(page);
  expect(score).toBeGreaterThan(0);
  await expect(page.locator('#arcadeSheet .ar-board')).toContainText(/You beat \d+% of players today\./);
  await expect(page.locator('#arcadeSheet .ar-board .ar-board-list li.me span')).toHaveText('You');
  const names = await page.locator('#arcadeSheet .ar-board .ar-board-list li span').allTextContents();
  expect(names.sort()).toEqual(['Bea', 'You']);
  await expect(page.locator('#arcadeSheet .ar-board')).not.toContainText(/Cat|Dan/);
  const kept = [...fake.social.scores.values()].find(s => s.user_id === ada.id);
  expect([kept.game, kept.score, kept.mod]).toEqual(['stack', score, challenge.mod.id]);
  await noOverflow(page);
  await page.close();
  expect(errors, 'browser errors').toEqual([]);
});

test('an unreachable server leaves the challenge playable with a small note', async ({ context }) => {
  const errors = [];
  const fake = createFakeSupabase({ now: shifted });
  const ada = await socialPlayer(fake, 'Ada', null, { now: shifted });
  const cloud = JSON.stringify({ session: ada.session, socialUser: ada.id });
  const page = await arrive(context, fake, { shelf: JSON.stringify(shelf(['Agnes', 'Mort', 'Pip'], shifted())), cloud }, errors);
  fake.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: 'stack' } })));
  await expect(page.locator('#arcadeSheet .ar-board')).toHaveText('Offline. The scores will keep.');
  await page.locator('#arcadeSheet [data-ar="challenge"]').click();
  await stackRun(page, { tries: 1 });
  await expect(page.locator('#arcadeSheet .ar-over .ar-board')).toHaveText('Offline. The scores will keep.');
  await expect(page.locator('#arcadeSheet .ar-again')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  await expect(page.locator('#courtSheet .sc-summons-note')).toHaveText('Offline. Any papers will keep.');
  await expect(page.locator('#courtSheet .sc-roll')).toBeEnabled();
  await page.close();
  expect(errors).toEqual([]);
});
