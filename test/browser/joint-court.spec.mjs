import { test as base, expect } from 'playwright/test';
import { householdFixture, visitingGuestsFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { createHearings } from '../../src/cloud/hearings.js';
import { COURT_BY_ID, docketCaseId, SUMMONS_SOULS } from '../../src/engine/court.js';
import { effectiveCase, twistById, docketTwist } from '../../src/engine/court-twists.js';
import { JOINT_BENCH_SOULS } from '../../src/engine/court-joint.js';

// The Joint Bench with two simulated players against one fake server. The
// page is Ada, then Bea, then Ada again, each with their own shelf and session
// (as in summons.spec.mjs). Ada serves papers and judges first, in secret; Bea
// hears the identical episode with Ada's reactions as the gallery; then both
// open the envelopes.
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 300000 });

const NOW = Date.UTC(2026, 9, 3, 17);
// The page runs in America/Chicago; day keys count months from zero.
function chicagoKey(time) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(time)).map(x => [x.type, x.value]));
  return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day);
}
// Today's docket case airs one fixed version, so the test knows its truth.
const DAY = chicagoKey(NOW), DOCKET = docketCaseId(DAY);
const TRUTH = effectiveCase(COURT_BY_ID[DOCKET], twistById(DOCKET, docketTwist(DAY, DOCKET))).truth;
const WRONG = ['plaintiff', 'defendant', 'both'].find(r => r !== TRUTH);

function shelf(names) {
  const s = householdFixture('established', NOW);
  s.settings.theatreOn = false;
  s.lastBackup = NOW;
  s.pets.forEach((p, i) => { p.name = names[i]; p.names = [{ name: names[i], at: s.started }]; });
  return s;
}
async function world() {
  const fake = createFakeSupabase({ now: () => NOW });
  const ada = await socialPlayer(fake, 'Ada', shelf(['Agnes', 'Lord Dampington III', 'Pip']), { now: () => NOW });
  const bea = await socialPlayer(fake, 'Bea', shelf(['Gladys', 'Snag', 'Wanda']), { now: () => NOW });
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  await bea.social.publish({ force: true });
  await ada.social.publish({ force: true });
  const here = p => ({ shelf: JSON.stringify(p.shelf), cloud: JSON.stringify({ session: p.session, socialUser: p.id, socialName: p.name }) });
  return { fake, ada, bea, here };
}
const read = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
async function arrive(context, fake, saved, errors) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: NOW });
  await page.addInitScript(({ saved, config }) => {
    globalThis.SHELFLIFE_CLOUD_CONFIG = config;
    if (!sessionStorage.getItem('joint.fixture')) {
      localStorage.setItem('shelflife.v4', saved.shelf);
      localStorage.setItem('shelflife.cloud', saved.cloud);
      sessionStorage.setItem('joint.fixture', '1');
    }
  }, { saved, config: fake.config });
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
async function openCourt(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court')));
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
  await expect(page.locator('#courtSheet .jc-bench')).toBeVisible();
}
// The cast as the studio shows it: names only (a guest's seat adds where it is from).
const castOf = page => page.evaluate(() => {
  const sheet = document.getElementById('courtSheet');
  const name = el => (el?.getAttribute('title') || el?.textContent || '').split(', ')[0];
  return { title: sheet.querySelector('h2')?.textContent, p: name(sheet.querySelector('.sc-podium.p .sc-lectern span')), d: name(sheet.querySelector('.sc-podium.d .sc-lectern span')),
    jury: [...sheet.querySelectorAll('.sc-seat')].map(name), guests: [...sheet.querySelectorAll('.sc-seat.sc-visiting')].map(el => el.getAttribute('title')) };
});
// Click through the show and keep a transcript of every line, in order.
// Dialogue is advanced from inside the page; every choice is a real click.
// Questions: the first on offer. Chaos: the gavel. `react` taps the bench's
// reaction buttons on the first lines.
async function playEpisode(page, ruling, { react = [] } = {}) {
  const said = [];
  if (react.length) {
    await expect(page.locator('#courtSheet .jc-react')).toBeVisible();
    for (const r of react) {
      await expect(page.locator('#courtSheet .sc-box.ready')).toBeVisible();
      await page.locator('#courtSheet [data-jc-react="' + r + '"]').click();
      said.push(await page.locator('#courtSheet [data-sc-text]').textContent());
      await page.locator('#courtSheet [data-sc-box]').click();
    }
  }
  for (let turn = 0; turn < 40; turn++) {
    const state = await page.evaluate(async () => {
      const sheet = document.getElementById('courtSheet'), lines = [];
      for (let n = 0; n < 900; n++) {
        const box = sheet.querySelector('.sc-box.ready');
        const text = box?.querySelector('[data-sc-text]')?.textContent;
        if (text && lines[lines.length - 1] !== text) lines.push(text);
        if (sheet.querySelector('.sc-wrap')) return { wrap: true, lines };
        const controls = sheet.querySelector('[data-sc-controls]:not([hidden])');
        const choices = controls ? [...controls.querySelectorAll('[data-sc-choice]')].map(b => b.dataset.scChoice) : [];
        if (choices.length) return { choices, lines };
        sheet.querySelector('[data-sc-box]')?.click();
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return { lines };
    });
    for (const line of state.lines) if (said[said.length - 1] !== line) said.push(line);
    if (state.wrap) return said;
    if (!state.choices) continue;
    const value = state.choices.includes(ruling) ? ruling : state.choices.includes('gavel') ? 'gavel' : state.choices.includes('open') ? 'open' : state.choices.find(c => /^\d+$/.test(c)) ?? state.choices[0];
    await page.locator('#courtSheet [data-sc-choice="' + value + '"]').click();
  }
  await expect(page.locator('#courtSheet .sc-wrap')).toBeVisible();
  return said;
}
// The reveal is read out a line at a time, like the rest of the show.
async function tapThrough(page, selector = '.jc-reveal') {
  await page.evaluate(async selector => {
    const sheet = document.getElementById('courtSheet');
    for (let n = 0; n < 1200 && !sheet.querySelector(selector); n++) {
      sheet.querySelector('[data-sc-box]')?.click();
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }, selector);
  await expect(page.locator('#courtSheet ' + selector)).toBeVisible();
}
async function shoot(page, testInfo, name) {
  for (const [width, height] of [[360, 640], [375, 667], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#courtSheet .sc-wrap').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 &&
      [...document.querySelectorAll('.veil.open .sheet')].every(el => el.scrollWidth <= el.clientWidth + 1)), 'no sideways scroll at ' + width).toBe(true);
    const path = testInfo.outputPath(name + '-' + width + 'x' + height + '.png');
    await page.screenshot({ path });
    await testInfo.attach(name + ' at ' + width + 'x' + height, { path, contentType: 'image/png' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('serve papers and judge: a sealed ruling, the identical episode, the gallery, a full bench and the record', async ({ context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Two players are played once; phone widths are set explicitly');
  const errors = [];
  const { fake, ada, bea, here } = await world();
  let adaHere = here(ada), beaHere = here(bea);

  // ---- Ada serves papers on Bea's Snag and judges first ----
  let page = await arrive(context, fake, adaHere, errors);
  await openCourt(page);
  await expect(page.locator('#courtSheet .jc-bench')).toContainText('Judge a case with a friend.');
  await page.locator('#courtSheet [data-jc="serve"]').click();
  await page.locator('#courtSheet [data-jc="friend"]').filter({ hasText: 'Bea' }).click();
  await expect(page.locator('#courtSheet [data-jc-field="theirId"]')).toBeVisible();
  await page.locator('#courtSheet [data-jc-field="theirId"]').selectOption({ label: 'Snag' });
  await page.locator('#courtSheet [data-jc-field="mineId"]').selectOption({ label: 'Agnes' });
  await page.locator('#courtSheet [data-jc-field="caseId"]').selectOption(DOCKET);
  await expect(page.locator('#courtSheet [data-jc="serve-plain"]')).toHaveText('Serve without judging');
  await page.locator('#courtSheet [data-jc="serve-go"]').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  const adaCast = await castOf(page);
  expect([adaCast.title, adaCast.p, adaCast.d]).toEqual([COURT_BY_ID[DOCKET].title, 'Agnes', 'Snag']);
  expect(adaCast.jury).toEqual(expect.arrayContaining(['Lord Dampington III', 'Pip', 'Gladys', 'Wanda']));
  expect(adaCast.guests.some(t => t.endsWith('from Bea’s shelf')), 'Bea’s residents sit as guests on Ada’s side').toBe(true);
  expect(fake.social.hearings.rows.size, 'nothing is sent before the ruling').toBe(0);
  const adaSaid = await playEpisode(page, TRUTH, { react: ['laugh', 'gasp'] });
  await expect(page.locator('#courtSheet [data-jc-seal]')).toContainText('Sealed. Bea hears it next');
  await expect(page.locator('#courtSheet .sc-next')).toHaveCount(0);
  const [row] = [...fake.social.hearings.rows.values()];
  expect([row.kind, row.case_id, row.twist, row.status, row.first_ruling.ruling, row.first_ruling.truth]).toEqual(['served', DOCKET, docketTwist(DAY, DOCKET), 'open', TRUTH, TRUTH]);
  // The two taps, then a gavel for every time Ada banged one in a scene.
  expect(row.first_marks.slice(0, 2).map(m => m.r)).toEqual(['laugh', 'gasp']);
  expect(row.first_marks.slice(2).every(m => m.r === 'gavel')).toBe(true);
  expect(JSON.parse(await read(page, 'shelflife.v4')).courtroom.episodes, 'a joint hearing is not one of our own episodes').toBe(0);
  await page.locator('#courtSheet [data-sc="lobby"]').click();
  await expect(page.locator('#courtSheet .jc-row')).toContainText('Waiting for Bea');
  adaHere = await leave(page);

  // ---- Bea hears the identical episode, with Ada as the gallery ----
  page = await arrive(context, fake, beaHere, errors);
  const beaBefore = await souls(page);
  await openCourt(page);
  const waiting = page.locator('#courtSheet .jc-row').filter({ hasText: 'Ada heard' });
  await expect(waiting).toContainText('Sealed. Your turn.');
  await expect(waiting.locator('[data-jc="block"]')).toBeVisible();
  await waiting.locator('[data-jc="hear"]').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  const beaCast = await castOf(page);
  expect({ ...beaCast, guests: [] }).toEqual({ ...adaCast, guests: [] });
  expect(beaCast.guests.some(t => t.endsWith('from Ada’s shelf'))).toBe(true);
  await expect(page.locator('#courtSheet .jc-react-label')).toContainText('The gallery is Ada');
  const beaSaid = await playEpisode(page, TRUTH);
  expect(beaSaid, 'every line the same, in the same order').toEqual(adaSaid);
  await expect.poll(() => page.locator('#courtSheet [data-sc-stage]').getAttribute('data-jc-heard'), 'every reaction of Ada’s played in the gallery').toBe(String(row.first_marks.length));
  await expect(page.locator('#courtSheet [data-jc-seal]')).toContainText('+' + SUMMONS_SOULS + ' for hearing Ada’s case. Both envelopes are in.');
  expect(fake.social.hearings.rows.get(row.id).status).toBe('revealed');
  await page.locator('#courtSheet [data-jc="open-reveal"]').click();
  await tapThrough(page);
  await expect(page.locator('#courtSheet .jc-reveal')).toHaveAttribute('data-jc-outcome', 'full');
  await expect(page.locator('#courtSheet .jc-reveal h3')).toHaveText('Full bench');
  await expect(page.locator('#courtSheet .jc-reveal')).toContainText('+' + JOINT_BENCH_SOULS + ' souls each for a full bench.');
  await expect(page.locator('#courtSheet [data-jc-record]')).toContainText('You and Ada: 1 hearing, 1 full bench.');
  await expect.poll(() => souls(page)).toBeGreaterThanOrEqual(beaBefore + SUMMONS_SOULS + JOINT_BENCH_SOULS);
  await shoot(page, testInfo, 'reveal-full-bench');
  beaHere = await leave(page);

  // ---- Ada opens the envelopes, then replays the hearing ----
  page = await arrive(context, fake, adaHere, errors);
  const adaBefore = await souls(page);
  await openCourt(page);
  await page.waitForTimeout(2000);
  console.log('DEBUG', JSON.stringify(await page.evaluate(async () => { const m = await import('/src/cloud/index.js'); return { active: m.social.active(), uid: m.cloud.userId() }; })),
    fake.calls().slice(-6).map(r => r.path + ' ' + r.status).join(' | '), JSON.stringify([...fake.social.hearings.rows.values()].map(h => [h.from_user, h.to_user, h.status, h.created_at, h.ruled_at])));
  console.log('LOBBY', await page.locator('#courtSheet [data-jc-lobby]').innerHTML());
  await expect(page.locator('#courtSheet .jc-record').first()).toHaveText(/^You and Bea: 1 hearing, 1 full bench\. (Dead level|Level)/);
  const ready = page.locator('#courtSheet .jc-row.jc-due');
  await expect(ready).toContainText('The envelopes are in');
  await ready.locator('[data-jc="reveal"]').click();
  await tapThrough(page);
  await expect(page.locator('#courtSheet .jc-reveal')).toHaveAttribute('data-jc-outcome', 'full');
  await expect(page.locator('#courtSheet .jc-envelopes')).toContainText('Bea');
  await expect.poll(() => souls(page)).toBe(adaBefore + JOINT_BENCH_SOULS);
  await page.locator('#courtSheet .jc-reveal [data-jc="replay"]').click();
  await expect(page.locator('#courtSheet .jc-gallery-note')).toContainText('A replay. The gallery is Bea.');
  expect(await castOf(page)).toEqual(adaCast);
  const replaySaid = await playEpisode(page, 'open');
  expect(replaySaid.slice(0, 10)).toEqual(adaSaid.slice(0, 10));
  await expect(page.locator('#courtSheet .jc-reveal')).toHaveAttribute('data-jc-outcome', 'full');
  expect(await souls(page), 'a replay pays nothing').toBe(adaBefore + JOINT_BENCH_SOULS);
  await page.close();
  expect(errors).toEqual([]);
});

test('hear a case together: an invitation from Friends, witnesses from their shelf, and a divided bench', async ({ context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Two players are played once; phone widths are set explicitly');
  const errors = [];
  const { fake, ada, bea, here } = await world();
  const page = await arrive(context, fake, here(ada), errors);
  // From a friend's profile: the hub renders registered actions as [data-fr-action];
  // without the hub, the registered action is run the way the hub runs it.
  await page.evaluate(async ({ id, name }) => {
    const { friendActions } = await import('/src/ui/social-registry.js');
    const friend = { userId: id, name };
    const actions = friendActions(friend, {});
    if (!actions.some(a => a.id === 'serve-sealed') || !actions.some(a => a.id === 'serve') || !actions.some(a => a.id === 'hear-together')) throw new Error('actions missing');
    actions.find(a => a.id === 'hear-together').run(friend, {});
  }, { id: bea.id, name: 'Bea' });
  await expect(page.locator('#courtSheet.jc-invite')).toBeVisible();
  await expect(page.locator('#courtSheet [data-jc-field="caseId"]')).toHaveValue(DOCKET);
  await expect(page.locator('#courtSheet .jc-how').first()).toContainText('Bea hears the identical episode');
  await expect(page.locator('#courtSheet .jc-how')).toHaveCount(2);
  await page.locator('#courtSheet [data-jc-field="plaintiffId"]').selectOption({ label: 'Pip' });
  await page.locator('#courtSheet [data-jc="invite-go"]').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  expect((await castOf(page)).p).toBe('Pip');
  await expect(page.locator('#courtSheet .sc-castnotes')).toContainText('from Bea’s shelf, is a character witness.');
  const said = await playEpisode(page, TRUTH, { react: ['gavel'] });
  expect(said.some(line => /biscuit|spoon|rota|minor key|folder|visiting|on the record|this shelf/.test(line)), 'a witness from Bea’s shelf said something').toBe(true);
  await expect(page.locator('#courtSheet [data-jc-seal]')).toContainText('Sealed.');
  const [row] = [...fake.social.hearings.rows.values()];
  expect([row.kind, row.cast_snapshot.p.name, row.cast_snapshot.witnesses.map(w => w.from)]).toEqual(['invite', 'Pip', ['Bea', 'Bea']]);
  // Bea, in the test process, hears it and rules the other way.
  const beaBench = createHearings({ cloud: bea.cloud, social: bea.social });
  const heard = await beaBench.get(row.id);
  expect([heard.mine, heard.theirs]).toEqual([null, null]);
  await beaBench.rule(row.id, { ruling: WRONG, truth: TRUTH, stars: 0, ratings: 40, agree: 2, dissent: 4 });
  await page.locator('#courtSheet [data-sc="lobby"]').click();
  await expect.poll(async () => { await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:court'))); return page.locator('#courtSheet .jc-row.jc-due').count(); }).toBe(1);
  await page.locator('#courtSheet .jc-row.jc-due [data-jc="reveal"]').click();
  await tapThrough(page);
  await expect(page.locator('#courtSheet .jc-reveal')).toHaveAttribute('data-jc-outcome', 'divided');
  await expect(page.locator('#courtSheet .jc-reveal h3')).toHaveText('The bench is divided');
  await expect(page.locator('#courtSheet [data-sc-text]')).toHaveText(/^The bench is divided\. One of you is competent\..* It was you\.$/);
  await expect(page.locator('#courtSheet [data-jc-record]')).toContainText('You and Bea: 1 hearing, 0 full benches. You are ahead by one');
  await shoot(page, testInfo, 'reveal-divided');
  await page.close();
  expect(errors).toEqual([]);
});

test('the bench record on a friend’s profile and the postbox rows, through the registry', async ({ context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Checked once');
  const errors = [];
  const { fake, ada, bea, here } = await world();
  // Two earlier hearings: one waiting for Ada, one revealed.
  const beaBench = createHearings({ cloud: bea.cloud, social: bea.social });
  const adaBench = createHearings({ cloud: ada.cloud, social: ada.social });
  const cast = { v: 1, p: { kind: 'npc', id: 'cat' }, d: { kind: 'npc', id: 'susan' }, jury: [{ kind: 'npc', id: 'raven' }], witnesses: [] };
  const sealed = { ruling: WRONG, truth: TRUTH, stars: 1, ratings: 50, agree: 1, dissent: 0 };
  const done = await adaBench.open({ to: bea.id, kind: 'invite', caseId: DOCKET, twist: docketTwist(DAY, DOCKET), seed: 5, cast, ruling: sealed });
  await beaBench.rule(done.id, { ...sealed, ruling: TRUTH });
  const waiting = await beaBench.open({ to: ada.id, kind: 'invite', caseId: DOCKET, twist: docketTwist(DAY, DOCKET), seed: 6, cast, ruling: sealed });
  const page = await arrive(context, fake, here(ada), errors);
  const out = await page.evaluate(async ({ friend }) => {
    const reg = await import('/src/ui/social-registry.js');
    const said = [];
    const ctx = { say: text => said.push(text), refresh() {} };
    const source = reg.postboxSources().find(s => s.id === 'joint-bench');
    const items = await source.load(ctx);
    const section = reg.friendsSections('friend').find(s => s.id === 'bench-record');
    section.render(ctx, friend);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { count: source.count(ctx), poll: source.poll, items: items.map(i => [i.id, i.line, source.render(i, ctx)]), section: section.render(ctx, friend), said };
  }, { friend: { userId: bea.id, name: 'Bea' } });
  expect(out.poll).toBe(true);
  expect(out.count, 'a hearing to answer and a reveal to read').toBe(2);
  const [, line, html] = out.items.find(i => i[0] === waiting.id);
  expect(line).toBe('Bea heard ' + COURT_BY_ID[DOCKET].title + ' and ruled. Sealed. Your turn.');
  expect(html).toContain('data-sx="hear" data-sx-id="' + waiting.id + '"');
  for (const action of ['decline', 'block', 'report']) expect(html).toContain('data-sx="' + action + '"');
  const [, ready, readyHtml] = out.items.find(i => i[0] === done.id);
  expect(ready).toBe('The envelopes are in: ' + COURT_BY_ID[DOCKET].title + ', with Bea.');
  expect(readyHtml).toContain('data-sx="reveal" data-sx-id="' + done.id + '"');
  expect(out.section).toContain('You and Bea: 1 hearing, 0 full benches. Bea is ahead by one');
  expect(out.section).toContain('data-sx="replay" data-sx-id="' + done.id + '"');
  // Declining from the postbox, then replaying from the profile section.
  await page.evaluate(async id => {
    const reg = await import('/src/ui/social-registry.js');
    await reg.postboxSources().find(s => s.id === 'joint-bench').onClick('decline', id, { say() {}, refresh() {} });
  }, waiting.id);
  expect(fake.social.hearings.rows.get(waiting.id).status).toBe('declined');
  await page.evaluate(async id => {
    const reg = await import('/src/ui/social-registry.js');
    const el = document.createElement('button'); el.dataset.sxId = id;
    reg.friendsSections('friend').find(s => s.id === 'bench-record').onClick('replay', el, {}, {});
  }, done.id);
  await expect(page.locator('#courtSheet .jc-gallery-note')).toContainText('A replay. The gallery is Bea.');
  await expect(page.locator('#courtSheet .sc-podium.p .sc-lectern span')).toHaveText('Susan');
  await page.close();
  expect(errors).toEqual([]);
});

test('a guest visiting the shelf is seated on the jury with where it came from', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const s = shelf(['Agnes', 'Lord Dampington III', 'Pip']);
  await page.addInitScript(saved => { if (!sessionStorage.getItem('guest.fixture')) { localStorage.setItem('shelflife.v4', saved); sessionStorage.setItem('guest.fixture', '1'); } }, JSON.stringify(s));
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  // The Friends postbox keeps guests in state.friendVisits.guests; here they are put there directly.
  await page.evaluate(async guests => {
    const { state } = await import('/src/state.js');
    state.friendVisits.guests = guests;
    window.dispatchEvent(new CustomEvent('shelflife:court'));
  }, visitingGuestsFixture(Date.now()));
  await expect(page.locator('#courtVeil')).toHaveClass(/open/);
  await page.locator('#courtSheet [data-sc="roll"]').click();
  await expect(page.locator('#courtSheet .sc-stage')).toBeVisible();
  const mabel = page.locator('#courtSheet .sc-seat.sc-visiting[title="Mabel, visiting from Bea"]');
  await expect(mabel).toHaveCount(1);
  await expect(mabel.locator('.sc-seat-from svg')).toHaveCount(1);
  await expect(mabel.locator('.sprite')).toHaveCount(1);
  await expect(page.locator('#courtSheet .sc-seat.sc-visiting[title="Crumb, visiting from Cat"]')).toHaveCount(1);
  await expect(page.locator('#courtSheet .sc-castnotes')).toContainText('Mabel, visiting from Bea, sits on the jury.');
  await playEpisode(page, 'both');
  await expect(page.locator('#courtSheet .sc-wrap')).toBeVisible();
  const shot = test.info().outputPath('guest-juror.png');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.locator('#courtSheet .sc-jury').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot });
  await test.info().attach('A guest juror at 360x640', { path: shot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});
