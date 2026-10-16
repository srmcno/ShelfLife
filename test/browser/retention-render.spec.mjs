import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

const NOW = new Date('2026-10-11T20:00:00Z');
const KEY = 'shelflife.v4';
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);

async function settledShelf(page) {
  const snapshot = householdFixture('established', NOW.getTime());
  snapshot.settings.theatreOn = false;
  snapshot.lastBackup = NOW.getTime();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(snapshot => {
    if (!sessionStorage.getItem('retention-render-fixture')) {
      localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
      sessionStorage.setItem('retention-render-fixture', '1');
    }
  }, snapshot);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
  await page.evaluate(async () => {
    const { state, localDayKey } = await import('/src/state.js');
    const { challengeToday } = await import('/src/engine/arcade.js');
    const { syncAlmanac } = await import('/src/engine/almanac.js');
    const { ensureChores } = await import('/src/engine/mayhem.js');
    const { renderAll } = await import('/src/ui/render.js');
    const now = Date.now(), day = localDayKey(now);
    state.pets.forEach(pet => { pet.needs = { food: 65, fuss: 90, clean: 90 }; });
    state.mayhem.queue = [];
    state.mayhem.nextAt = now + 600000;
    state.mayhem.souls = 0;
    state.mayhem.omen.day = day;
    ensureChores(state, now);
    state.mayhem.chores.list.forEach(chore => { chore.done = true; });
    state.mayhem.chores.bonus = true;
    state.courtroom.docketDay = day;
    const challenge = challengeToday(state, now);
    state.arcade.daily = { day, game: challenge.game, mod: challenge.mod.id, best: 0, plays: 0, claimed: true };
    state.returns.pending = null;
    state.returns.seenAt = now;
    state.almanac.init = 0;
    state.almanac.xp = 0;
    state.almanac.by = {};
    syncAlmanac(state, now);
    renderAll(state);
  });
  await expect(page.locator('#nextStep')).toHaveAttribute('data-step', 'play');
}

test('a care action puts its newly earned Almanac reward on the next-step card in the same render', async ({ page }) => {
  await settledShelf(page);
  // Capture synchronously: polling would allow a later timer/render to hide the ordering bug.
  const result = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { chapterAt, tierThresholds, rewardOf } = await import('/src/engine/almanac.js');
    const { careFor } = await import('/src/engine/care.js');
    const { renderAll } = await import('/src/ui/render.js');
    const chapter = chapterAt(), threshold = tierThresholds(chapter.days)[0];
    state.almanac.chapters[chapter.key] = { xp: threshold - 1, claimed: 0, badge: 0, spot: 0 };
    careFor(state, state.pets[0], 'food');
    renderAll(state);
    return { step: document.getElementById('nextStep').dataset.step, xp: state.almanac.chapters[chapter.key].xp, threshold, souls: rewardOf(chapter, 1).amount };
  });
  expect(result.xp).toBe(result.threshold);
  expect(result.step).toBe('extra:almanac-tier');
  await page.locator('#nextStep [data-ns-go]').click();
  await expect(page.locator('#almanacVeil')).toHaveClass(/open/);
  const before = (await saved(page)).mayhem.souls;
  // The track repeats every tier inside the collapsed All tiers details; use Next up.
  await page.locator('#almanacSheet .alm-section > .alm-track [data-alm="claim"][data-tier="1"]').click();
  expect((await saved(page)).almanac.chapters['thin-2026'].claimed).toBe(1);
  expect((await saved(page)).mayhem.souls).toBe(before + result.souls);
  await page.keyboard.press('Escape');
  await page.reload();
  expect((await saved(page)).almanac.chapters['thin-2026']).toMatchObject({ claimed: 1, xp: result.threshold });
  await expect(page.locator('#nextStep')).not.toHaveAttribute('data-step', 'extra:almanac-tier');
});

test('a return chest is recommended on the first render that notices the absence', async ({ page }) => {
  await settledShelf(page);
  const result = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { renderAll } = await import('/src/ui/render.js');
    state.returns.seenAt = Date.now() - 3 * 86400000;
    state.returns.claimedDay = '';
    renderAll(state);
    return { step: document.getElementById('nextStep').dataset.step, pending: state.returns.pending, saved: JSON.parse(localStorage.getItem('shelflife.v4')).returns.pending };
  });
  expect(result.step).toBe('extra:return-chest');
  expect(result.pending.days).toBe(3);
  expect(result.saved).toEqual(result.pending);
  await page.reload();
  await expect(page.locator('#nextStep')).toHaveAttribute('data-step', 'extra:return-chest');
  await expect(page.locator('#mayhemDesk .alm-return')).toContainText('140 souls');
});
