import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { DAILY_MODS } from '../../src/content/daily.js';
import { dailyChallenge } from '../../src/engine/daily.js';
import { dropAlignedCoffin } from './support/stack.mjs';
import { resumeArcadeIfPaused, waitForArcadePlay } from './support/arcade.mjs';

const dates = Array.from({ length: 48 }, (_, n) => Date.UTC(2026, 9, 1 + n, 18));
function dateFor(mod) {
  return dates.find(time => {
    const d = new Date(time), ch = dailyChallenge(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
    return ch.game === 'stack' && ch.mod.id === mod;
  });
}
async function start(page, mod = null) {
  const time = mod ? dateFor(mod) : dates[0];
  await page.clock.install({ time });
  const state = householdFixture('established', time);
  state.settings.theatreOn = false;
  state.lastBackup = time;
  await page.addInitScript(s => localStorage.setItem('shelflife.v4', JSON.stringify(s)), state);
  await page.goto('/');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: 'stack', petId: 'qa0' } })));
  await page.locator(`#arcadeSheet [data-ar="${mod ? 'challenge' : 'play'}"]`).click();
  // Hold the count-in until the tested input; leave gameplay time untouched.
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.readyLen = 60; });
}
const snapshot = page => page.evaluate(() => {
  const r = document.getElementById('arcadeSheet').arcadeRun;
  return { phase: r.phase, score: r.game.score, drops: r.game.drops, coffins: r.game.stack.length, over: r.game.over, mod: r.mod?.id ?? null };
});
async function checkStart(page, input, mod) {
  await resumeArcadeIfPaused(page);
  expect(await snapshot(page)).toEqual({ phase: 'ready', score: 0, drops: 0, coffins: 1, over: false, mod });
  await input();
  expect(await snapshot(page)).toEqual({ phase: 'play', score: 0, drops: 0, coffins: 1, over: false, mod });
  await dropAlignedCoffin(page);
  const after = await snapshot(page);
  expect(after.drops).toBe(1);
  expect(after.coffins).toBe(2);
  expect(after.score).toBeGreaterThan(0);
  expect(after.over).toBe(false);
}

for (const mod of DAILY_MODS.stack) {
  test(`Space starts without dropping under ${mod.title}`, async ({ page }) => {
    await start(page, mod.id);
    await checkStart(page, () => page.keyboard.press('Space'), mod.id);
  });
}
for (const [name, input] of [
  ['Enter', page => page.keyboard.press('Enter')],
  ['playfield tap', page => page.locator('#arcadeSheet [data-ar-field]').click()],
  ['Drop button', page => page.locator('#arcadeSheet [data-ar="drop"]').click()]
]) {
  test(`${name} starts Slim coffins without dropping`, async ({ page }) => {
    await start(page, 'slim');
    await checkStart(page, () => input(page), 'slim');
  });
}
test('ordinary play starts without dropping and still drops on the next input', async ({ page }) => {
  await start(page);
  await checkStart(page, () => page.keyboard.press('Space'), null);
});

test('the natural count-in leaves Slim coffins undropped until the player acts', async ({ page }) => {
  await start(page, 'slim');
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.readyLen = 0.01; });
  await waitForArcadePlay(page);
  expect(await snapshot(page)).toEqual({ phase: 'play', score: 0, drops: 0, coffins: 1, over: false, mod: 'slim' });
  await dropAlignedCoffin(page);
  expect((await snapshot(page)).drops).toBe(1);
});

test('a paused count-in ignores drops and resumes without placing a coffin', async ({ page }) => {
  await start(page, 'slim');
  await page.evaluate(() => window.dispatchEvent(new Event('shelflife:pause')));
  await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
  await page.keyboard.press('Space');
  expect(await snapshot(page)).toEqual({ phase: 'ready', score: 0, drops: 0, coffins: 1, over: false, mod: 'slim' });
  await checkStart(page, () => page.keyboard.press('Space'), 'slim');
});

test('Again keeps starting and dropping separate during its shorter count-in', async ({ page }) => {
  await start(page, 'slim');
  await checkStart(page, () => page.keyboard.press('Space'), 'slim');
  // Time a genuine miss in the same frame. A slower browser may have already
  // moved the next coffin away from the wall by the time assertions finish.
  await page.waitForFunction(() => {
    const r = document.getElementById('arcadeSheet').arcadeRun, g = r.game, top = g.stack.at(-1);
    const overlap = Math.min(g.mover.x + g.mover.w, top.x + top.w) - Math.max(g.mover.x, top.x);
    if (r.phase !== 'play' || r.paused || overlap >= 0) return false;
    r.field.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    return true;
  }, null, { polling: 'raf' });
  await expect(page.locator('#arcadeSheet .ar-over')).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-again')).toBeEnabled();
  await page.locator('#arcadeSheet .ar-again').click();
  expect(await page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun.readyLen)).toBe(0.3);
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.readyLen = 60; });
  await checkStart(page, () => page.keyboard.press('Space'), 'slim');
});
