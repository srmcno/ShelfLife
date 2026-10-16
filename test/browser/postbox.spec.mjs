import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { createPostbox } from '../../src/cloud/postbox.js';
import { generateCreature } from '../../src/art/creatures.js';

// Visits, treats, guestbooks, waves, Do not disturb and blocking, with two
// players. The page is Ada; Bea (and sometimes Cat) live in this process and
// share the in-memory server, each with the same client the game uses. Time
// on the server is moved with `world.later(ms)`.
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // A refusal is a 400 from the server, which the browser logs; the game words it on screen.
    page.on('console', message => { if (message.type() === 'error' && !/status of 400/.test(message.text())) errors.push(message.text()); });
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 240000 });

const DAY = 86400000;
const read = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
function adaShelf() {
  const s = householdFixture('established', Date.now());
  s.settings.theatreOn = false;
  s.lastBackup = Date.now();
  return s;
}
const beaShelf = () => ({ pets: [
  { id: 'bea0', name: 'Gladys', traits: ['critic'], needs: { food: 90, fuss: 90, clean: 90 }, bond: 4, art: { body: '', stamps: [], creature: generateCreature({ seed: 'gladys' }) } },
  { id: 'bea1', name: 'Snag', traits: ['nocturnal'], needs: { food: 40, fuss: 40, clean: 40 }, bond: 1, art: { body: '', stamps: [], creature: generateCreature({ seed: 'snag' }) } }
] });
async function world({ cat = false } = {}) {
  let shift = 0;
  const now = () => Date.now() + shift;
  const fake = createFakeSupabase({ now, tokenLifetime: 30 * 86400 });
  const ada = await socialPlayer(fake, 'Ada', adaShelf(), { now });
  const bea = await socialPlayer(fake, 'Bea', beaShelf(), { now });
  const players = [ada, bea];
  if (cat) players.push(await socialPlayer(fake, 'Cat', { pets: [] }, { now }));
  for (const p of players.slice(1)) { await ada.social.addFriend(p.code); await p.social.respond(ada.id, true); }
  for (const p of players) { p.postbox = createPostbox({ cloud: p.cloud, social: p.social, now }); await p.social.publish({ force: true }); }
  return { fake, ada, bea, cat: players[2], later: ms => { shift += ms; }, now };
}
async function open(page, w) {
  await page.addInitScript(({ config, state, meta }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('postbox.fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(state));
      localStorage.setItem('shelflife.cloud', JSON.stringify(meta));
      sessionStorage.setItem('postbox.fixture', '1');
    }
  }, { config: w.fake.config, state: w.ada.shelf, meta: { session: w.ada.session, socialUser: w.ada.id } });
  await page.route(w.fake.url + '/**', route => w.fake.route(route));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
}
async function openFriends(page) {
  await page.locator('#tabMore').click();
  await page.locator('#friendsBtn').click();
  await expect(page.locator('#friendsVeil')).toBeVisible();
  await expect(page.locator('#friendsSheet .fr-friend').first()).toBeVisible();
}
const status = page => page.locator('#friendsSheet .fr-status');
const mail = (page, source) => page.locator('#friendsSheet [data-fr-mail="' + source + '"]');
async function openProfile(page, name) {
  await page.locator('#friendsSheet .fr-friend').filter({ hasText: name }).locator('[data-fr="profile"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText(name);
}
async function openPostbox(page) {
  await page.locator('#friendsSheet [data-fr="postbox"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Postbox');
  await expect(page.locator('#friendsSheet [data-fr="clear-read"]')).toBeVisible();
}
async function fits(page, widths = [320, 360]) {
  const before = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 740 });
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
      sheet: [...document.querySelectorAll('.veil.open .sheet')].map(el => [el.scrollWidth, el.clientWidth]),
      wide: [...document.querySelectorAll('.veil.open .sheet *')].filter(el => !el.closest('.sprite, svg, .sr-only') && el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1).map(el => el.className || el.tagName).slice(0, 5),
      small: [...document.querySelectorAll('.veil.open .sheet button:not(.fr-scene-pet, .sheet-head button)')].filter(el => el.getClientRects().length && el.getBoundingClientRect().height < 43.5).map(el => el.textContent.trim()).slice(0, 5) }));
    expect(sizes.document, 'no horizontal page scroll at ' + width).toBeLessThanOrEqual(sizes.viewport + 1);
    for (const [content, box] of sizes.sheet) expect(content, 'the sheet does not clip at ' + width).toBeLessThanOrEqual(box + 1);
    expect(sizes.wide, 'nothing pokes out at ' + width).toEqual([]);
    expect(sizes.small, '44px tap targets at ' + width).toEqual([]);
  }
  await page.setViewportSize(before);
}

test('a visit to Ada: request, accept, the guest on the shelf, care, and the thank-you note', async ({ page }) => {
  const w = await world();
  await w.bea.postbox.sendVisit({ to: w.ada.id, pet: w.bea.shelf.pets[0], days: 1 });
  await open(page, w);
  // The notice and the tray count everything in the postbox, not just the Court.
  await expect(page.locator('#summonsNoticeText')).toHaveText('1 thing waits in your postbox.');
  await expect(page.locator('#summonsNoticeOpen')).toHaveText('Open the postbox');
  await page.locator('#summonsNoticeOpen').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Postbox');
  const request = mail(page, 'visits');
  await expect(request).toContainText('Bea would like to send Gladys to stay');
  await expect(request).toContainText('For a day.');
  await expect(request.locator('.sprite')).toHaveCount(1);
  await fits(page);
  await request.locator('[data-sx="accept"]').click();
  await expect(status(page)).toContainText('Gladys has moved onto your shelf');
  await expect(mail(page, 'visits')).toHaveCount(0);
  expect(w.fake.postbox.visits[0].status).toBe('accepted');
  await page.keyboard.press('Escape');

  // The spare plank: a guest, not a resident.
  const plank = page.locator('#guestPlank');
  await expect(plank).toBeVisible();
  await expect(plank.locator('.gp-name')).toHaveText('Gladys');
  await expect(plank.locator('.gp-tag')).toHaveText('visiting from Bea');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  const saved = await read(page, 'shelflife.v4');
  expect(saved.pets.map(p => p.name)).not.toContain('Gladys');
  expect(saved.friendVisits.guests.map(g => [g.from.name, g.resident.name])).toEqual([['Bea', 'Gladys']]);

  await plank.locator('.gp-guest').click();
  await expect(page.locator('#guestVeil')).toBeVisible();
  await expect(page.locator('#guestSheet h2')).toHaveText('Gladys');
  await expect(page.locator('#guestSheet h2')).toBeFocused();
  await page.locator('#guestSheet [data-gc="food"]').click();
  await expect(page.locator('#guestSheet .gc-reaction')).toContainText('Gladys');
  await expect(page.locator('#guestSheet .gc-count')).toContainText('fed it once');
  await expect.poll(() => w.fake.postbox.visits[0].fed).toBe(1);
  await page.locator('#guestSheet [data-gc="clean"]').click();
  await expect(page.locator('#guestSheet .gc-reaction')).toHaveText('Give the guest a moment. It is still recovering from the last one.');
  w.later(4000);
  await page.locator('#guestSheet [data-gc="clean"]').click();
  await expect(page.locator('#guestSheet .gc-count')).toContainText('fed it once and washed it once');
  await fits(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#guestVeil')).toBeHidden();
  await expect(plank.locator('.gp-guest')).toBeFocused();

  // The day passes. Bea reads the postcard; Ada reads the note.
  w.later(DAY + 60000);
  const ending = (await w.bea.postbox.load()).endings[0];
  const card = await w.bea.postbox.collect(ending.id);
  expect([card.souls, card.ending.fed, card.ending.washed]).toEqual([8, 1, 1]);
  const before = saved.mayhem.souls;
  await openFriends(page);
  await openPostbox(page);
  await mail(page, 'visits').locator('[data-sx="read"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('A note on the pillow');
  await expect(page.locator('#friendsSheet .pb-note')).toContainText('Gladys has gone home to Bea. It left a note: “');
  await expect.poll(async () => (await read(page, 'shelflife.v4')).mayhem.souls).toBe(before + 6);
  await page.keyboard.press('Escape');
  await expect(plank).toBeHidden();
});

test('Ada sends Pip to stay; it comes home with a postcard and a souvenir', async ({ page }) => {
  const w = await world();
  await open(page, w);
  await openFriends(page);
  await openProfile(page, 'Bea');
  await expect(page.locator('#friendsSheet [data-fr-section="pb-their-book"]')).toContainText('You have never signed it.');
  await page.locator('#friendsSheet [data-fr-action="invite"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Send someone to stay');
  await expect(page.locator('#friendsSheet .pb-pet .sprite')).toHaveCount(3);
  await fits(page);
  await page.locator('#friendsSheet .pb-pet').filter({ hasText: 'Pip' }).click();
  await page.locator('#friendsSheet .pb-days .pb-choice').filter({ hasText: 'Three days' }).click();
  await page.locator('#friendsSheet [data-fr-form="invite"] button[type="submit"]').click();
  await expect(status(page)).toHaveText('Pip has packed for Bea’s. They have 48 hours to answer the door.');
  await expect(page.locator('#friendsVeil h2')).toHaveText('Bea');
  await expect(page.locator('#friendsSheet [data-fr-action="invite"]')).toBeDisabled();
  await expect(page.locator('#friendsSheet .fr-big').filter({ hasText: 'Send someone to stay' })).toContainText('Pip is already waiting at their door.');
  const [sent] = w.fake.postbox.visits;
  expect([sent.resident.name, sent.days, sent.from_user, sent.to_user]).toEqual(['Pip', 3, w.ada.id, w.bea.id]);
  expect(sent.resident.art.creature, 'a copy with its art').toBeTruthy();
  await page.keyboard.press('Escape');
  const pip = page.locator('#cabinet .piece.pet').filter({ hasText: 'Pip' });
  await expect(pip.locator('.away-tag')).toHaveText('packed for Bea’s');

  // Bea takes Pip in and looks after it.
  const box = await w.bea.postbox.load();
  await w.bea.postbox.respondVisit(box.requests[0].id, true);
  for (const kind of ['food', 'food', 'clean']) { await w.bea.postbox.care(sent.id, kind); w.later(4000); }
  await openFriends(page);
  await expect(pip.locator('.away-tag')).toHaveText('away at Bea’s');
  expect((await read(page, 'shelflife.v4')).pets.map(p => p.name), 'Pip still lives at home').toContain('Pip');
  await page.keyboard.press('Escape');

  // Three days later: a postcard home, a souvenir, souls.
  w.later(3 * DAY + 60000);
  const before = (await read(page, 'shelflife.v4')).mayhem.souls;
  await openFriends(page);
  await expect(page.locator('#friendsSheet [data-fr="postbox"]')).toContainText('1 waiting for you');
  await openPostbox(page);
  await expect(mail(page, 'visits')).toContainText('A postcard from Bea’s');
  await mail(page, 'visits').locator('[data-sx="read"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('A postcard home');
  const postcard = page.locator('#friendsSheet .pb-postcard');
  await expect(postcard).toContainText('Bea fed Pip twice and washed them once.');
  await expect(postcard.locator('.pb-souvenir')).toContainText('Souvenir');
  await expect(postcard).toContainText('+8 souls');
  await fits(page);
  const after = await read(page, 'shelflife.v4');
  expect(after.mayhem.souls).toBe(before + 8);
  expect(after.friendVisits.postcards[0].text).toMatch(/^Bea fed Pip twice and washed them once\./);
  expect(after.friendVisits.souvenirs).toHaveLength(1);
  await page.locator('#friendsSheet [data-fr="custom-back"]').click();
  await expect(mail(page, 'visits')).toHaveCount(0);
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await expect(page.locator('#friendsSheet [data-fr-section="pb-keepsakes"]')).toContainText('Souvenirs 1');
  await page.keyboard.press('Escape');
  await expect(pip.locator('.away-tag')).toHaveCount(0);
});

test('treats: send one a day, open one for souls, and the sixth of the day pays nothing', async ({ page }) => {
  const w = await world();
  await open(page, w);
  await openFriends(page);
  await openProfile(page, 'Bea');
  await page.locator('#friendsSheet [data-fr-action="treat"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Send a treat');
  await fits(page);
  await page.locator('#friendsSheet .pb-choice').filter({ hasText: 'Moth Pie' }).click();
  await page.locator('#friendsSheet [data-fr-form="treat"] button[type="submit"]').click();
  await expect(status(page)).toHaveText('Moth Pie is on its way to Bea. It may arrive slightly different.');
  await expect(page.locator('#friendsSheet [data-fr-action="treat"]')).toBeDisabled();
  await expect(page.locator('#friendsSheet .fr-big').filter({ hasText: 'Send a treat' })).toContainText('Treat sent today. Tomorrow, another.');
  const opened = await w.bea.postbox.openGift((await w.bea.postbox.load()).gifts[0].id);
  expect(opened.souls).toBe(4);

  // Bea sends one back. Five have already paid today, so this one is just nice.
  for (let i = 0; i < 5; i++) w.fake.postbox.gifts.push({ id: '00000000-0000-4000-8000-00000000f00' + i, from_user: w.bea.id, to_user: w.ada.id, treat: 'moth-pie',
    day: '2000-01-0' + (i + 1), status: 'opened', souls: 4, created_at: new Date(w.now()).toISOString(), opened_at: new Date(w.now()).toISOString(), cleared_at: new Date(w.now()).toISOString() });
  await w.bea.postbox.sendGift(w.ada.id, 'jar-of-teeth');
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await page.keyboard.press('Escape');
  await openFriends(page);
  await openPostbox(page);
  const gift = mail(page, 'gifts');
  await expect(gift).toContainText('Bea sent you a Jar of Teeth');
  const before = (await read(page, 'shelflife.v4')).mayhem.souls;
  await gift.locator('[data-sx="open"]').click();
  await expect(status(page)).toContainText('No souls today: five treats is the limit.');
  expect((await read(page, 'shelflife.v4')).mayhem.souls).toBe(before);
  await expect(gift).toContainText('Opened.');
  await expect(gift).toHaveClass(/pb-read/);
  await page.locator('#friendsSheet [data-fr="clear-read"]').click();
  await expect(status(page)).toHaveText('Read post cleared. The rest is still glaring at you.');
  await expect(mail(page, 'gifts')).toHaveCount(0);
});

test('guestbooks: sign one, find yours signed, tear a page out', async ({ page }) => {
  const w = await world();
  await w.bea.postbox.sign(w.ada.id, 18, 'teeth');
  await open(page, w);
  await openFriends(page);
  const book = page.locator('#friendsSheet [data-fr-section="pb-book"]');
  await expect(book).toContainText('The damp one sneezed on my coat.');
  await expect(book).toContainText('Bea');
  await openProfile(page, 'Bea');
  await page.locator('#friendsSheet [data-fr-action="sign"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Sign the guestbook');
  await fits(page);
  await page.locator('#friendsSheet .pb-stamp-pick').filter({ hasText: 'Moth' }).click();
  await page.locator('#friendsSheet .pb-lines .pb-choice').filter({ hasText: 'Ten out of ten. Would be haunted again.' }).click();
  await page.locator('#friendsSheet [data-fr-form="sign"] button[type="submit"]').click();
  await expect(status(page)).toHaveText('Signed. Bea will see it in their postbox, and judge your handwriting.');
  await expect(page.locator('#friendsSheet [data-fr-section="pb-their-book"]')).toContainText('Ten out of ten. Would be haunted again.');
  await expect(page.locator('#friendsSheet [data-fr-action="sign"]')).toBeDisabled();
  expect(w.fake.postbox.guestbook.find(s => s.signer === w.ada.id)).toMatchObject({ owner: w.bea.id, line: 3, stamp: 'moth' });
  const theirs = await w.bea.postbox.load();
  expect(theirs.signatures.map(s => s.signerName)).toEqual(['Ada']);

  await page.locator('#friendsSheet [data-fr="back"]').click();
  await openPostbox(page);
  const page18 = mail(page, 'signatures');
  await expect(page18).toContainText('Bea signed your guestbook');
  await page18.locator('[data-sx="remove"]').click();
  await expect(status(page)).toHaveText('Torn out. The book is a page lighter and none the wiser.');
  expect(w.fake.postbox.guestbook.filter(s => s.owner === w.ada.id)).toEqual([]);
});

test('waves: wave at their resident, hear about theirs, three a day', async ({ page }) => {
  const w = await world();
  await w.bea.postbox.wave({ to: w.ada.id, residentId: 'qa0', kind: 'wave', line: 0 });
  await open(page, w);
  await expect(page.locator('#summonsNoticeText')).toHaveText('1 thing waits in your postbox.');
  await openFriends(page);
  await openProfile(page, 'Bea');
  await page.locator('#friendsSheet [data-fr-action="visit-shelf"]').click();
  await expect(page.locator('#friendsVeil h2')).toHaveText('Bea’s shelf');
  await expect(page.locator('#friendsSheet .fr-scene .sprite')).toHaveCount(2);
  await fits(page);
  const snag = page.locator('#friendsSheet .fr-res').filter({ hasText: 'Snag' });
  await snag.locator('[data-fr="wave"]').click();
  await expect(status(page)).toHaveText('Waved. Snag has been informed.');
  await snag.locator('[data-fr="poke"]').click();
  await expect(status(page)).toHaveText('Poked. Snag noticed. Snag always notices.');
  await snag.locator('[data-fr="wave"]').click();
  await expect(status(page)).toHaveText('Waved. Snag has been informed.');
  await snag.locator('[data-fr="wave"]').click();
  await expect(status(page)).toHaveText('That is a lot for one day. Try again tomorrow.');
  const got = await w.bea.postbox.load();
  expect(got.waves.map(x => [x.fromName, x.residentName, x.kind])).toEqual([['Ada', 'Snag', 'wave'], ['Ada', 'Snag', 'poke'], ['Ada', 'Snag', 'wave']]);

  await page.locator('#friendsSheet [data-fr="back"]').click();
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await openPostbox(page);
  await expect(mail(page, 'waves')).toHaveText(/Bea waved at Agnes\. Agnes has not recovered\./);
  await expect(mail(page, 'waves')).toHaveClass(/pb-unread/);
  await expect.poll(() => w.fake.postbox.waves.find(x => x.to_user === w.ada.id).seen_at, 'opening the postbox reads it').not.toBeNull();
  await expect(page.locator('#friendsBadge')).toBeHidden();
});

test('Do not disturb: Ada switches it on and nothing new reaches her; Bea’s sign stops Ada politely', async ({ page }) => {
  const w = await world();
  await w.bea.postbox.sendGift(w.ada.id, 'moth-pie');
  await open(page, w);
  await openFriends(page);
  const dnd = page.locator('#friendsSheet [data-fr="dnd"]');
  await expect(dnd).toHaveAttribute('aria-checked', 'false');
  await dnd.click();
  await expect(dnd).toHaveAttribute('aria-checked', 'true');
  await expect(status(page)).toHaveText('Do not disturb is on. The doormat now says “Go away”.');
  await expect(page.locator('#frDndLine')).toContainText('What has already arrived stays.');
  await expect.poll(() => w.fake.postbox.prefs.get(w.ada.id)?.dnd).toBe(true);
  await expect(w.bea.postbox.sendVisit({ to: w.ada.id, pet: w.bea.shelf.pets[0], days: 1 })).rejects.toMatchObject({ code: 'dnd' });
  await expect(w.bea.postbox.wave({ to: w.ada.id, residentId: 'qa0', kind: 'poke', line: 9 })).rejects.toMatchObject({ code: 'dnd' });
  await expect(w.bea.social.serve({ to: w.ada.id, caseId: 'borrowed-coffin', plaintiff: w.bea.shelf.pets[0], defendant: w.ada.shelf.pets[0] })).rejects.toMatchObject({ code: 'dnd' });
  await openPostbox(page);
  await expect(mail(page, 'gifts'), 'what had arrived stays').toContainText('Moth Pie');
  await page.locator('#friendsSheet [data-fr="back"]').click();

  await w.bea.postbox.setDnd(true);
  await openProfile(page, 'Bea');
  await page.locator('#friendsSheet [data-fr-action="treat"]').click();
  await page.locator('#friendsSheet [data-fr-form="treat"] button[type="submit"]').click();
  await expect(status(page)).toHaveText('They have hung a Do not disturb sign on the door. It is not personal. It might be a little personal.');
  await page.locator('#friendsSheet [data-fr="custom-back"]').click();
  await page.locator('#friendsSheet [data-fr-action="serve"]').click();
  await page.locator('#friendsSheet .fr-res').first().locator('[data-fr="papers"]').click();
  await page.locator('#friendsSheet [data-fr-form="serve"] button[type="submit"]').click();
  await expect(status(page)).toHaveText('They have hung a Do not disturb sign on the door. It is not personal. It might be a little personal.');
});

test('blocking from the postbox tears up everything they sent, and leaves Cat’s', async ({ page }) => {
  const w = await world({ cat: true });
  await w.bea.postbox.sendVisit({ to: w.ada.id, pet: w.bea.shelf.pets[1], days: 2 });
  await w.bea.postbox.sendGift(w.ada.id, 'cursed-raisin');
  await w.bea.postbox.sign(w.ada.id, 9, 'skull');
  await w.bea.postbox.wave({ to: w.ada.id, residentId: 'qa1', kind: 'poke', line: 10 });
  await w.cat.postbox.sendGift(w.ada.id, 'moth-pie');
  await open(page, w);
  await openFriends(page);
  await expect(page.locator('#friendsSheet .fr-friend').filter({ hasText: 'Bea' }).locator('.fr-dot')).toHaveCount(1);
  await expect(page.locator('#friendsBadge')).toHaveText('5');
  await openPostbox(page);
  await expect(page.locator('#friendsSheet .pb-item')).toHaveCount(5);
  await fits(page);
  const row = mail(page, 'gifts').filter({ hasText: 'Cursed Raisin' });
  await row.locator('[data-fr="mail-safety"]').click();
  await row.locator('[data-fr="block"]').click();
  await expect(page.locator('#friendsSheet [data-fr="block-yes"]')).toBeFocused();
  await page.locator('#friendsSheet [data-fr="block-yes"]').click();
  await expect(status(page)).toHaveText('Blocked. They will not find you again.');
  await expect(page.locator('#friendsSheet .pb-item')).toHaveCount(1);
  await expect(page.locator('#friendsSheet .pb-item')).toContainText('Cat sent you Moth Pie');
  expect([w.fake.postbox.visits, w.fake.postbox.guestbook, w.fake.postbox.waves].map(list => list.length)).toEqual([0, 0, 0]);
  expect(w.fake.postbox.gifts.map(g => g.from_user)).toEqual([w.cat.id]);
  await page.locator('#friendsSheet [data-fr="back"]').click();
  await expect(page.locator('#friendsSheet .fr-friend .fr-who b')).toHaveText(['Cat']);
  await expect(w.bea.postbox.sendGift(w.ada.id, 'moth-pie')).rejects.toMatchObject({ code: 'not_friends' });
});

test('thirty friends and fifty letters stay usable on a phone', async ({ page }) => {
  const w = await world();
  // Twenty-nine more friends, each with a shelf, and a pile of mail.
  for (let i = 0; i < 29; i++) {
    const p = await socialPlayer(w.fake, 'Friend ' + (i + 1), beaShelf());
    await p.social.addFriend(w.ada.code); await w.ada.social.respond(p.id, true);
    await p.social.publish({ force: true });
    const box = createPostbox({ cloud: p.cloud, social: p.social, now: w.now });
    await box.sendGift(w.ada.id, 'moth-pie');
    if (i < 21) await box.wave({ to: w.ada.id, residentId: 'qa0', kind: 'wave', line: i % 8 });
  }
  await open(page, w);
  await page.setViewportSize({ width: 360, height: 640 });
  await openFriends(page);
  await expect(page.locator('#friendsSheet .fr-friend')).toHaveCount(12);
  await expect(page.locator('#friendsSheet .fr-mini .sprite').first()).toBeVisible();
  await page.locator('#friendsSheet [data-fr="show-all"]').click();
  await expect(page.locator('#friendsSheet .fr-friend')).toHaveCount(30);
  await fits(page, [320, 360]);
  await openPostbox(page);
  await expect(page.locator('#friendsSheet .pb-item')).toHaveCount(20);
  await page.locator('#friendsSheet [data-fr="mail-more"]').click();
  await expect(page.locator('#friendsSheet .pb-item')).toHaveCount(40);
  await page.locator('#friendsSheet [data-fr="mail-more"]').click();
  await expect(page.locator('#friendsSheet .pb-item')).toHaveCount(50);
  await expect(page.locator('#friendsSheet [data-fr="mail-more"]')).toHaveCount(0);
  await fits(page, [320]);
});
