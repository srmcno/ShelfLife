import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { docketCaseId } from '../../src/engine/court.js';
import { COURT_CASES } from '../../src/content/court.js';

/* The replay work in a real page: the career and the cast in the lobby, the Case
   Notebook, a twisted version played start to finish with the Objection, a
   rerun's skip controls, the docket entry points and a summons where the sender
   chose to be the defendant. The twisted version is injected into the page in
   place of the data file, so these pass with the stubs and with the writers' data. */
const SAVE_KEY = 'shelflife.v4';
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 150000 });

const TWIST = `
import { alt } from './court.js';
export const TWISTS_A = { 'borrowed-coffin': [{
  id: 'keith-owns-it', title: 'Keith’s Coffin', truth: 'defendant',
  turn: alt([['bailiff', 'Your Honour, there is a note on the lid. It is signed “Keith”.']], [['narrator', '(Something knocks inside the coffin. Once. Politely.)']]),
  questions: {
    0: { clue: '{p} sold the coffin to Keith last spring for forty souls and a promise.', lines: alt([['d', 'It was forty souls and a handshake.']], [['d', 'He paid in instalments.']]) },
    1: { clue: 'The name on the lid is painted over an older name. The older one says Keith.', lines: alt([['bailiff', 'It says Keith underneath.']], [['narrator', '(Under the paint, in gold: KEITH.)']]) },
    3: { herring: '{d} was seen carrying a second coffin out of the sock drawer.', lines: alt([['d', 'That was my own coffin.']], [['p', 'I saw it with my own eyes!']]) },
    4: { clue: 'There is a receipt on the little raisin shelf, dated before the nap.', lines: alt([['p', 'A receipt. I hoped nobody would look.']], [['narrator', '(The receipt is for one coffin, one owner.)']]) },
    5: { lines: alt([['narrator', '(Nothing is explained.)']], [['narrator', '(The bailiff nods at nobody.)']]) }
  },
  rulings: {
    plaintiff: alt([['judge', 'For {p}, which is nonsense.']], [['judge', 'For {p}. Keith disagrees.']]),
    defendant: alt([['judge', 'For {d}. Keith has his coffin.']], [['judge', 'For {d}. The receipt is the receipt.']]),
    both: alt([['judge', 'Both idiots.']], [['judge', 'Both idiots. Keith is the adult.']])
  },
  hallway: { p: ['I sold it. I did not sell the man.', 'I want a refund.', 'The sock drawer will do.'], d: ['Keith and I have an understanding.', 'It was a nap.', 'I keep the receipt in my teeth.'] }
}] };
`;
const injectTwist = page => page.route('**/src/content/court-twists-a.js', route => route.fulfill({ contentType: 'text/javascript', body: TWIST }));

// A shelf with known residents: Agnes keeps receipts, Mort is plain, Pip plays to the room.
function shelf({ courtroom, traits = [['witness'], ['damp'], ['theatrical'], ['damp']] } = {}) {
  const s = householdFixture('nearly-full');
  s.settings.theatreOn = false;
  s.lastBackup = Date.now();
  s.pets.forEach((p, i) => { p.traits = traits[i] || ['damp']; p.bond = 3; });
  s.courtroom = courtroom || {};
  return s;
}
async function arrive(page, snapshot) {
  await page.addInitScript(({ snapshot, key }) => {
    if (!sessionStorage.getItem('replay.fixture')) { localStorage.setItem(key, JSON.stringify(snapshot)); sessionStorage.setItem('replay.fixture', '1'); }
  }, { snapshot, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function openCourt(page) {
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await page.locator('#playroomVeil [data-court]').click();
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
}
const sheetOverflows = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1));
async function cast(page, plaintiff, defendant) {
  await page.locator('#courtSheet [data-sc-cast="plaintiffId"]').selectOption({ label: plaintiff });
  await page.locator('#courtSheet [data-sc-cast="defendantId"]').selectOption({ label: defendant });
}
// Click through dialogue, remembering every line, until a choice or the wrap shows.
async function advance(page, ms = 40000) {
  return page.evaluate(async ms => {
    const sheet = document.getElementById('courtSheet'), said = [];
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (sheet.querySelector('.sc-wrap')) return { wrap: true, said };
      const controls = sheet.querySelector('[data-sc-controls]:not([hidden])');
      if (controls && controls.querySelector('button')) return { choices: [...controls.querySelectorAll('[data-sc-choice]')].map(b => b.dataset.scChoice), said };
      const text = sheet.querySelector('[data-sc-text]')?.textContent;
      if (text && said.at(-1) !== text) said.push(text);
      sheet.querySelector('[data-sc-box]')?.click();
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return { timeout: true, said };
  }, ms);
}
// Chaos prompts can come back to back (a scene, then the ad break's scene): bang the gavel until questions or the ruling show.
async function settle(page, step) {
  while (step.choices?.includes('gavel')) { await page.locator('#courtSheet [data-sc-choice="gavel"]').click(); step = await advance(page); }
  return step;
}
// Ask the first three questions on offer; returns the step at the ruling.
async function askThree(page, first) {
  let step = await settle(page, first);
  for (let n = 0; n < 3; n++) {
    await page.locator('#courtSheet .sc-q').first().click();
    step = await settle(page, await advance(page));
  }
  return step;
}
async function chooseOriginal(page) {
  const picker = page.locator('#courtSheet [data-sc-version]');
  if (await picker.count()) await picker.selectOption('base');
}
// Click through the show until the hall cam is up.
const untilHall = page => page.evaluate(async () => {
  const sheet = document.getElementById('courtSheet');
  for (let n = 0; n < 4000; n++) {
    if (sheet.querySelector('.sc-stage.sc-hallway .sc-hall')) return true;
    if (sheet.querySelector('.sc-wrap')) return false;
    sheet.querySelector('[data-sc-box]')?.click();
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return false;
});
const questionButton = (page, text) => page.locator('#courtSheet .sc-q').filter({ hasText: text });

test('the lobby shows the career, why the cast matters, versions without spoilers, and the Case Notebook', async ({ page }) => {
  await injectTwist(page);
  await arrive(page, shelf({ courtroom: { stars: 12, best: { 'borrowed-coffin': 2 }, versions: { 'borrowed-coffin': { base: 2 } } } }));
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="borrowed-coffin"]').click();
  await cast(page, 'Agnes', 'Cricket');
  // The career: twelve stars is a Docket Clerk, six from an Usher.
  const career = page.locator('#courtSheet .sc-career');
  await expect(career).toContainText('Docket Clerk');
  await expect(career).toContainText('12 stars');
  await expect(career).toContainText('6 stars to Usher of Mild Order');
  await expect(career).toContainText('Unlocks the bench drape');
  await expect(career.locator('[role=progressbar]')).toHaveAttribute('aria-valuenow', '25');
  // Who is at the podiums, and what it means.
  await expect(page.locator('#courtSheet .sc-vs .sc-chip.receipts')).toHaveText('Receipts');
  const why = page.locator('#courtSheet .sc-why');
  await expect(why).toContainText('Why this cast matters');
  await expect(why).toContainText('Agnes keeps receipts: one free clue before you ask a thing.');
  // Versions: counted, never named. The twist’s title is nowhere on the page until it is seen.
  await expect(page.locator('#courtSheet .sc-versions')).toContainText('Versions seen: 1 of 2');
  await expect(page.locator('#courtSheet .sc-ep[data-sc-case="borrowed-coffin"] .sc-ep-ver')).toHaveText('Version 1 of 2');
  await expect(page.locator('#courtSheet .sc-ep[data-sc-case="snoring-wall"] .sc-ep-ver')).toHaveCount(0);
  await expect(page.locator('#courtSheet [data-sc-version] option')).toHaveText(['Surprise me', 'The original']);
  expect(await page.locator('#courtSheet').innerText()).not.toContain('Keith’s Coffin');
  // The Case Notebook: every case, the version seen with its stars, the other a blank.
  await page.locator('#courtSheet [data-sc="notebook"]').click();
  await expect(page.locator('#courtSheet .sc-nb-case')).toHaveCount(COURT_CASES.length);
  const entry = page.locator('#courtSheet .sc-nb-case').first();
  await expect(entry.locator('li.seen')).toHaveCount(1);
  await expect(entry.locator('li.seen')).toContainText('The original');
  await expect(entry.locator('li.unseen')).toHaveText('Version 2: not yet seen');
  expect(await page.locator('#courtSheet').innerText()).not.toContain('Keith’s Coffin');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await sheetOverflows(page)).toBe(false);
  await page.locator('#courtSheet [data-sc-replay]').first().click();
  await expect(page.locator('#courtSheet .sc-tonight h3')).toHaveText('The Borrowed Coffin');
  await expect(page.locator('#courtSheet [data-sc-version]')).toHaveValue('base');
  expect(await sheetOverflows(page)).toBe(false);
});

test('a twisted version: the hint after the statements, an unconfirmed lead, the Objection, and the twist’s truth', async ({ page }) => {
  await injectTwist(page);
  await arrive(page, shelf({ traits: [['damp'], ['damp'], ['damp'], ['damp']], courtroom: { best: { 'borrowed-coffin': 2 }, versions: { 'borrowed-coffin': { base: 2, 'keith-owns-it': 0 } } } }));
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="borrowed-coffin"]').click();
  await cast(page, 'Agnes', 'Lord Dampington III');
  await page.locator('#courtSheet [data-sc-version]').selectOption('keith-owns-it');
  await page.locator('#courtSheet [data-sc="roll"]').click();
  // A rerun: after the first line the opening can be skipped, and the hint still plays.
  const skip = page.locator('#courtSheet [data-sc="skip"]');
  await expect(skip).toBeVisible();
  await expect(skip).toHaveText('Skip the opening');
  await skip.click();
  const opening = await advance(page);
  const said = opening.said.join(' | ');
  expect(said).toMatch(/signed “Keith”|knocks inside the coffin/);
  expect(said).not.toContain('It is still a nap');
  expect(said).not.toContain('I am not a monster');
  // The lead (the family question) is marked as unconfirmed in the notes.
  await expect(page.locator('#courtSheet [data-sc="objection"]')).toBeDisabled();
  await questionButton(page, 'if Keith has any family').click();
  let step = await advance(page);
  expect(step.choices).toContain('gavel');
  await page.locator('#courtSheet [data-sc-choice="gavel"]').click();
  step = await settle(page, await advance(page));
  await page.locator('#courtSheet .sc-notes summary').click();
  await expect(page.locator('#courtSheet .sc-notes .sc-note.shaky .sc-note-flag')).toHaveText('Unconfirmed lead');
  // One Objection: strike it. The counter says it is spent.
  await expect(page.locator('#courtSheet [data-sc="objection"]')).toContainText('1 left');
  await page.locator('#courtSheet [data-sc="objection"]').click();
  await expect(page.locator('#courtSheet .sc-obj-opt')).toHaveCount(2);
  await page.locator('#courtSheet .sc-obj-opt[data-sc-choice^="note:"]').click();
  step = await advance(page);
  expect(step.said.join(' ')).toMatch(/Sustained|Struck|rumour|Strike/);
  await expect(page.locator('#courtSheet .sc-notes .sc-note.struck .sc-note-flag')).toHaveText('Struck');
  await expect(page.locator('#courtSheet .sc-obj-row .sc-obj')).toHaveText('Objection used');
  await expect(page.locator('#courtSheet .sc-obj-row .sc-obj')).toBeDisabled();
  // Ask two clue questions explicitly: their shuffled position varies by episode.
  for (const question of ['where Keith came from', 'prove the coffin is theirs']) {
    await questionButton(page, question).click();
    step = await settle(page, await advance(page));
  }
  expect(step.choices).toEqual(['plaintiff', 'defendant', 'both']);
  expect(await page.locator('#courtSheet .sc-clues li').count()).toBeGreaterThanOrEqual(2);
  await page.locator('#courtSheet [data-sc-choice="defendant"]').click();
  step = await advance(page, 90000);
  expect(step.wrap).toBe(true);
  await expect(page.locator('#courtSheet .sc-wrap h3')).toHaveText('Justice, allegedly, was served');
  await expect(page.locator('#courtSheet .sc-wrap')).toContainText('The twist: Keith’s Coffin.');
  await expect(page.locator('#courtSheet .sc-wrap')).toContainText('Versions seen: 2 of 2');
  const after = await saved(page);
  expect(after.courtroom.versions['borrowed-coffin']['keith-owns-it']).toBeGreaterThanOrEqual(1);
  expect(after.courtroom.recent).toEqual(['borrowed-coffin']);
  expect(after.courtroom.stars).toBeGreaterThanOrEqual(3);
  expect(await sheetOverflows(page)).toBe(false);
});

const originals = Object.fromEntries(COURT_CASES.map(k => [k.id, { base: 0 }]));

test('a party who keeps receipts hands over a free clue, and it costs no question', async ({ page }) => {
  await arrive(page, shelf({ traits: [['witness'], ['damp'], ['damp'], ['damp']], courtroom: { versions: originals } }));
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="borrowed-coffin"]').click();
  await chooseOriginal(page);
  await cast(page, 'Agnes', 'Lord Dampington III');
  await page.locator('#courtSheet [data-sc="roll"]').click();
  const step = await advance(page);
  expect(step.choices.length, 'five questions are left to choose from, not six').toBe(5);
  await page.locator('#courtSheet .sc-notes summary').click();
  await expect(page.locator('#courtSheet .sc-notes li')).toHaveCount(1);
  await expect(page.locator('#courtSheet .sc-notes .sc-note-flag')).toHaveCount(0);
  await expect(page.locator('#courtSheet .sc-q-head b')).toHaveText('Question 1 of 3');
  await expect(page.locator('#courtSheet .sc-castnotes summary')).toContainText('Agnes · Receipts');
  await page.locator('#courtSheet .sc-castnotes summary').click();
  await expect(page.locator('#courtSheet .sc-castnotes li').first()).toContainText('keeps receipts');
  expect(await sheetOverflows(page)).toBe(false);
});

test('an exaggerator’s clue is unconfirmed until the Objection confirms it', async ({ page }) => {
  await arrive(page, shelf({ traits: [['damp'], ['terminal'], ['damp'], ['damp']], courtroom: { versions: originals } }));
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="borrowed-coffin"]').click();
  await chooseOriginal(page);
  await cast(page, 'Agnes', 'Lord Dampington III');
  await expect(page.locator('#courtSheet .sc-why')).toContainText('Lord Dampington III exaggerates');
  await page.locator('#courtSheet [data-sc="roll"]').click();
  let step = await settle(page, await advance(page));
  // Keith came from the defendant’s answers, so the note that arrives is unconfirmed.
  await questionButton(page, 'Lord Dampington III where Keith came from').click();
  step = await settle(page, await advance(page));
  await page.locator('#courtSheet .sc-notes summary').click();
  await expect(page.locator('#courtSheet .sc-notes .sc-note-flag')).toHaveText('Unconfirmed');
  await page.locator('#courtSheet [data-sc="objection"]').click();
  await expect(page.locator('#courtSheet .sc-obj-opt[data-sc-choice^="note:"] small')).toHaveText('Check this note');
  await page.locator('#courtSheet .sc-obj-opt[data-sc-choice^="note:"]').click();
  step = await settle(page, await advance(page));
  await expect(page.locator('#courtSheet .sc-notes .sc-note-flag')).toHaveText('Confirmed');
  await expect(page.locator('#courtSheet .sc-obj-row .sc-obj')).toHaveText('Objection used');
  await page.keyboard.press('Escape');
  await expect(page.locator('#courtVeil')).not.toHaveClass(/open/);
});

test('a rerun can skip the interview in the hall, and a first airing offers no skip', async ({ page }) => {
  await arrive(page, shelf({ traits: [['damp'], ['damp'], ['damp'], ['damp']], courtroom: { best: { 'borrowed-coffin': 1 }, versions: { ...originals, 'borrowed-coffin': { base: 1 } } } }));
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="snoring-wall"]').click();
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await advance(page, 4000);
  await expect(page.locator('#courtSheet [data-sc="skip"]')).toBeHidden();
  await page.keyboard.press('Escape');
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="borrowed-coffin"]').click();
  await chooseOriginal(page);
  await page.locator('#courtSheet [data-sc="roll"]').click();
  const step = await askThree(page, await advance(page));
  expect(step.choices).toEqual(['plaintiff', 'defendant', 'both']);
  await page.locator('#courtSheet [data-sc-choice="both"]').click();
  expect(await untilHall(page)).toBe(true);
  const skip = page.locator('#courtSheet [data-sc="skip"]');
  await expect(skip).toBeVisible();
  await expect(skip).toHaveText('Skip the interview');
  await skip.click();
  await expect(page.locator('#courtSheet .sc-wrap')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#courtSheet .sc-hall')).toHaveCount(0);
});

test('a promotion is celebrated at the wrap, pays its souls once and the courtroom is dressed for the rank', async ({ page }) => {
  // Nine stars with the first promotion paid: a correct ruling is worth at least a star, which makes ten.
  await arrive(page, shelf({ traits: [['damp'], ['damp'], ['damp'], ['damp']], courtroom: { stars: 9, rank: 1, versions: originals } }));
  const before = (await saved(page)).mayhem.souls;
  await openCourt(page);
  await page.locator('#courtSheet [data-sc-case="borrowed-coffin"]').click();
  await chooseOriginal(page);
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await expect(page.locator('#courtSheet .sc-stage.sc-gavel-brass')).toHaveCount(1);
  await expect(page.locator('#courtSheet .sc-stage.has-banner, #courtSheet .sc-banner')).toHaveCount(0);
  let step = await askThree(page, await advance(page));
  await page.locator('#courtSheet [data-sc-choice="plaintiff"]').click();
  step = await advance(page, 90000);
  expect(step.wrap).toBe(true);
  await expect(page.locator('#courtSheet .sc-promo')).toContainText('Docket Clerk');
  await expect(page.locator('#courtSheet .sc-promo')).toContainText('+20 souls');
  await expect(page.locator('#courtSheet .sc-promo')).toContainText('Brass nameplate');
  const after = await saved(page);
  expect(after.courtroom.rank).toBe(2);
  expect(after.courtroom.stars).toBeGreaterThanOrEqual(10);
  expect(after.mayhem.souls - before).toBeGreaterThanOrEqual(20);
  expect(await sheetOverflows(page)).toBe(false);
  // The next episode wears the new nameplate, and the lobby shows the new rank.
  await page.locator('#courtSheet [data-sc="lobby"]').click();
  await expect(page.locator('#courtSheet .sc-career')).toContainText('Docket Clerk');
  await expect(page.locator('#courtSheet .sc-career')).toContainText('to Usher of Mild Order');
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await expect(page.locator('#courtSheet .sc-stage.sc-has-plate .sc-bench-plate')).toHaveCount(1);
});

test('the docket entry points open the lobby on the docket case, even after another case was open', async ({ page }) => {
  await arrive(page, shelf());
  const docketId = docketCaseId(await page.evaluate(() => { const n = new Date(); return n.getFullYear() + '-' + n.getMonth() + '-' + n.getDate(); }));
  const docket = COURT_CASES.find(k => k.id === docketId);
  await openCourt(page);
  const other = COURT_CASES.find(k => k.id !== docketId);
  await page.locator('#courtSheet [data-sc-case="' + other.id + '"]').click();
  await expect(page.locator('#courtSheet .sc-tonight h3')).toHaveText(other.title);
  await page.keyboard.press('Escape');
  // The Playroom card carries the docket case with it.
  await openCourt(page);
  await expect(page.locator('#courtSheet .sc-tonight h3')).toHaveText(docket.title);
  await expect(page.locator('#courtSheet .sc-docket')).toContainText('Today’s docket');
  await page.locator('#courtSheet [data-sc-case="' + other.id + '"]').click();
  await page.keyboard.press('Escape');
  // So does the tile on the shelf desk.
  await page.locator('#mayhemDesk .mh-today [data-mh-today="court"]').click();
  await expect(page.locator('#courtSheet .sc-tonight h3')).toHaveText(docket.title);
  expect(await sheetOverflows(page)).toBe(false);
});

test('a sender who chose to be the defendant is heard that way, and the verdict goes back in the server’s terms', async ({ context }) => {
  test.setTimeout(180000);
  const errors = [];
  const fake = createFakeSupabase();
  const named = (names, tag) => { const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now(); s.pets.forEach((p, i) => { p.name = names[i]; p.names = [{ name: names[i], at: s.started }]; p.traits = ['damp']; }); s.courtroom = { versions: Object.fromEntries(COURT_CASES.map(k => [k.id, { base: 0 }])) }; return s; };
  const adaShelf = named(['Agnes', 'Lord Dampington III', 'Pip']), beaShelf = named(['Gladys', 'Snag', 'Wanda']);
  const ada = await socialPlayer(fake, 'Ada', adaShelf);
  const bea = await socialPlayer(fake, 'Bea', beaShelf);
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  await bea.social.publish({ force: true });
  async function visit(shelfState, player) {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ saved, cloud, config }) => {
      globalThis.SHELFLIFE_CLOUD_CONFIG = config;
      if (!sessionStorage.getItem('side.fixture')) { localStorage.setItem('shelflife.v4', saved); localStorage.setItem('shelflife.cloud', cloud); sessionStorage.setItem('side.fixture', '1'); }
    }, { saved: JSON.stringify(shelfState), cloud: JSON.stringify({ session: player.session, socialUser: player.id }), config: fake.config });
    await page.route(fake.url + '/**', route => fake.route(route));
    await page.goto('/');
    await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
    return page;
  }
  // Ada serves papers: her Agnes is to be the defendant, sued by Bea’s Snag.
  let page = await visit(adaShelf, ada);
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  const row = page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' });
  await row.locator('[data-fr="menu"]').click();
  await row.locator('[data-fr="serve"]').click();
  await page.locator('#friendsSheet .fr-res').filter({ hasText: 'Snag' }).locator('[data-fr="papers"]').click();
  await page.locator('#frCase').selectOption('borrowed-coffin');
  await page.locator('#frPlaintiff').selectOption({ label: 'Agnes' });
  await expect(page.locator('#frSide option')).toHaveText(['The plaintiff (suing Snag)', 'The defendant (being sued by Snag)']);
  await page.locator('#frSide').selectOption('d');
  await page.locator('#friendsSheet [data-fr-form="serve"] button[type="submit"]').click();
  await expect(page.locator('#friendsSheet .fr-status')).toHaveText('Papers served. Bea will find them in Shelf Court.');
  const [papers] = [...fake.social.summons.values()];
  expect([papers.plaintiff.name, papers.plaintiff.side, papers.defendant.name]).toEqual(['Agnes', 'd', 'Snag']);
  await page.close();
  // Bea reads it as Snag suing Agnes, takes the case, and rules for Snag.
  page = await visit(beaShelf, bea);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  const summons = page.locator('#courtSheet .sc-summons-case');
  await expect(summons).toHaveText(/Snag is suing Agnes, from Ada, over The Borrowed Coffin\./);
  expect(await sheetOverflows(page)).toBe(false);
  await summons.locator('[data-sc-take]').click();
  await expect(page.locator('#courtSheet .sc-podium.p .sc-lectern span')).toHaveText('Snag');
  await expect(page.locator('#courtSheet .sc-podium.d .sc-lectern span')).toHaveText('Agnes');
  await expect(page.locator('#courtSheet .sc-podium.d .sprite')).toHaveCount(1);
  await askThree(page, await advance(page));
  await page.locator('#courtSheet [data-sc-choice="plaintiff"]').click();
  const done = await advance(page, 90000);
  expect(done.wrap).toBe(true);
  await expect(page.locator('#courtSheet [data-sc-verdict]')).toContainText('for hearing Ada’s summons');
  await expect.poll(() => fake.social.summons.get(papers.id).status).toBe('ruled');
  // Bea ruled for the plaintiff, Snag. In the server’s terms Agnes holds the plaintiff slot, so that is a ruling against her.
  expect(fake.social.summons.get(papers.id).verdict).toBe('defendant');
  await page.close();
  expect(errors).toEqual([]);
});
