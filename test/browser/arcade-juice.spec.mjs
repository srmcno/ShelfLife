import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

/* The arcade as a player meets it: the count-in, the ladder, the banners, the
   reactions, the way a run ends, the hub, the haptics switch, the effects
   levels, the frame governor and the sound. Runs are steered through the
   read-only `arcadeRun` handle on the sheet so a late game can be set up
   without playing for a minute. Nothing here reaches the network. */

// These drive a live game, and a busy machine runs game time slowly (a frame is never allowed to
// advance the clock by more than a twentieth of a second), so each test gets room.
const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

test.describe.configure({ timeout: 120_000 });

async function open(page, { arcade = null, settings = {}, size = null, init = null } = {}) {
  const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now(); Object.assign(s.settings, settings);
  if (arcade) s.arcade = arcade;
  if (init) await page.addInitScript(init);
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('juice-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('juice-fixture', '1'); } }, s);
  if (size) await page.setViewportSize(size);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
const show = (page, game) => page.evaluate(g => window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: g, petId: 'qa0' } })), game);
// The frame governor is real and a busy machine trips it, which would make level
// assertions depend on the machine; so by default it is held still after a start.
async function start(page, game, { wait = true, govern = false, count = false } = {}) {
  await show(page, game);
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  // A long count-in would only make the tests slow; the count has its own test.
  await page.evaluate(([hold, quick]) => { const r = document.getElementById('arcadeSheet').arcadeRun; if (!r) return; if (hold) r.gov.push = () => null; if (quick) r.readyLen = 0.01; }, [!govern, !count && wait]);
  if (wait) await expect.poll(() => phase(page), { timeout: 20000 }).toBe('play');
}
const phase = page => page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun?.phase || '');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));
const field = page => page.locator('#arcadeSheet [data-ar-field]');
const fxLevel = page => field(page).getAttribute('data-fx');
// A reaction is a class that is held for a third of a second; on a busy machine a poll can miss
// it, so watch for it instead and ask afterwards whether it ever appeared.
const watch = (page, selector, names) => page.evaluate(([sel, list]) => {
  const el = document.querySelector(sel); window.__seen = new Set();
  const note = () => list.forEach(n => { if (el.classList.contains(n)) window.__seen.add(n); });
  note(); new MutationObserver(note).observe(el, { attributes: true, attributeFilter: ['class'] });
}, [selector, names]);
const seen = (page, name) => page.waitForFunction(n => window.__seen.has(n), name, { timeout: 15000 });

test('a run counts in from three, shows the count, and plays when it ends or is skipped', async ({ page }) => {
  await open(page);
  await start(page, 'frenzy', { wait: false, count: true });
  await expect(page.locator('#arcadeSheet .ar-count')).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-count b')).toHaveText(/^[321]$/);
  expect(await phase(page)).toBe('ready');
  await expect.poll(() => phase(page), { timeout: 20000 }).toBe('play');
  await expect(page.locator('#arcadeSheet .ar-count')).toBeHidden();
  // Starting again, any key ends the count at once and is the first move.
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await start(page, 'frenzy', { wait: false, count: true });
  expect(await phase(page)).toBe('ready');
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => phase(page)).toBe('play');
  expect(await page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun.game.dir)).toBe(1);
  await page.keyboard.up('ArrowRight');
});

test('the skull ladder shows what is left, and the field announces skulls and records', async ({ page }) => {
  await open(page, { arcade: { best: { frenzy: 20 }, plays: { frenzy: 3 } } });
  await start(page, 'frenzy');
  await expect(page.locator('#arcadeSheet [data-ar-next]')).toHaveText(/30 to Peckish|30 to go/);
  await expect(page.locator('#arcadeSheet .ar-notch')).toHaveCount(3);
  // Past the old best but short of a skull: a record, not a skull.
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.game.score = 24; });
  await expect(page.locator('#arcadeSheet .ar-banner')).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-banner b')).toHaveText('New best');
  await expect(page.locator('#arcadeSheet [data-ar-next]')).toContainText('6');
  // The first skull.
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.game.score = 31; });
  await expect(page.locator('#arcadeSheet .ar-banner b')).toContainText('Skull 1: Peckish');
  await expect(page.locator('#arcadeSheet .ar-notch.n1')).toHaveClass(/on/);
  await expect(page.locator('#arcadeSheet [data-ar-next]')).toContainText('49');
  const fill = await page.locator('#arcadeSheet .ar-ladder-track > i').evaluate(el => el.style.transform);
  expect(fill).toMatch(/scaleX\(0\.3\d*\)/);
});

test('the last skull on the shelf raises a vignette, and the combo meter appears with a streak', async ({ page }) => {
  await open(page);
  await start(page, 'frenzy');
  await expect(page.locator('#arcadeSheet .ar-vignette.low')).toHaveCount(0);
  await page.evaluate(() => { const r = document.getElementById('arcadeSheet').arcadeRun; r.game.lives = 1; r.game.combo = 8; r.game.items = []; });
  await expect(page.locator('#arcadeSheet .ar-vignette.low')).toHaveCount(1);
  await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.items.push({ id: 801, kind: 'tooth', x: g.x, y: 0.84, vy: 0, spin: 0 }); });
  await expect(page.locator('#arcadeSheet .ar-combo')).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-combo b')).toHaveText(/^×\d$/);
});

test('the resident answers a catch and a hit on the field, and Whack has a resident of its own', async ({ page }) => {
  await open(page);
  await start(page, 'frenzy');
  await expect(page.locator('#arcadeSheet .ar-catcher .sprite')).toHaveCount(1);
  await expect(page.locator('#arcadeSheet .ar-catcher .sprite')).toHaveClass(/sl-controlled/);
  await watch(page, '#arcadeSheet .ar-catcher .sprite', ['sl-catching', 'sl-care-clean']);
  await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.items.push({ id: 802, kind: 'crumb', x: g.x, y: 0.84, vy: 0, spin: 0 }); });
  await seen(page, 'sl-catching');
  await page.waitForTimeout(400);
  await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.items.push({ id: 803, kind: 'holy', x: g.x, y: 0.84, vy: 0, spin: 0 }); });
  await seen(page, 'sl-care-clean');
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await start(page, 'whack');
  await expect(page.locator('#arcadeSheet .ar-overseer-pet .sprite')).toHaveCount(1);
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.game.holes[4] = { id: 811, kind: 'hand', age: 0, life: 9 }; });
  await expect(page.locator('#arcadeSheet .ar-grave[data-hole="4"]')).toHaveAttribute('data-kind', 'hand');
  await watch(page, '#arcadeSheet .ar-overseer-pet .sprite', ['sl-reaching']);
  await page.keyboard.press('5');
  await seen(page, 'sl-reaching');
  await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('1');
});

test('Whack has gloves and gold, flooded corners and hands that warn before they escape', async ({ page }) => {
  await open(page);
  await start(page, 'whack');
  await page.evaluate(() => {
    const g = document.getElementById('arcadeSheet').arcadeRun.game;
    g.lives = 2; g.combo = 9;
    g.holes[1] = { id: 821, kind: 'glove', age: 0, life: 9 }; g.holes[4] = { id: 822, kind: 'gold', age: 0, life: 9 }; g.holes[6] = { id: 823, kind: 'hand', age: 8, life: 9 };
  });
  await expect(page.locator('#arcadeSheet .ar-grave[data-hole="1"]')).toHaveAttribute('aria-label', /stuffed glove/);
  await expect(page.locator('#arcadeSheet .ar-grave[data-hole="4"]')).toHaveAttribute('aria-label', /gold tooth/);
  await expect(page.locator('#arcadeSheet .ar-grave[data-hole="6"]')).toHaveClass(/urgent/);
  await page.keyboard.press('2');
  await expect(page.locator('#arcadeSheet .ar-pop', { hasText: 'Just a glove.' })).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById('arcadeSheet').arcadeRun.game.combo)).toBe(0);
  await page.keyboard.press('5');
  await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('8');
  await expect(page.locator('#arcadeSheet .ar-lives i.on')).toHaveCount(3);
  // The flooded corners of a daily challenge cannot be tapped and say so.
  await page.locator('#arcadeSheet [data-ar="close"]').click();
});

test('Coffin Stack scores clean drops in a row, shows the streak, and draws the coffin that fell', async ({ page }) => {
  await open(page);
  await start(page, 'stack');
  // Hold the mover still so a slow machine cannot drift it off the mark.
  await page.evaluate(() => { document.getElementById('arcadeSheet').arcadeRun.game.mod = { speed: 0 }; });
  const align = () => page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.mover.x = g.stack.at(-1).x; });
  await align(); await page.keyboard.press('Space');
  await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('2');
  await align(); await page.keyboard.press('Space');
  await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('5');
  await expect(page.locator('#arcadeSheet .ar-coffin.perfect')).toHaveCount(2);
  await expect(page.locator('#arcadeSheet .ar-combo')).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-combo small')).toHaveText('Streak');
  // A miss: the whole coffin goes over the edge and the tower topples.
  await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.stack.at(-1).x = 0.02; g.stack.at(-1).w = 0.2; g.mover.w = 0.2; g.mover.x = 0.7; });
  await page.keyboard.press('Space');
  await expect(page.locator('#arcadeSheet .ar-coffin.falling.whole')).toHaveCount(1);
  await expect(page.locator('#arcadeSheet .ar-rider')).toHaveClass(/tumble/);
  await expect(page.locator('#arcadeSheet .ar-coffin.tumble').first()).toBeVisible();
  await expect(page.locator('#arcadeSheet .ar-over')).toBeVisible();
});

test('the sky above the tower changes with its height', async ({ page }) => {
  await open(page);
  await start(page, 'stack');
  const stage = () => page.locator('#arcadeSheet .ar-sky').getAttribute('data-stage');
  expect(await stage()).toBe('0');
  for (const [coffins, want] of [[9, '1'], [17, '2'], [30, '3']]) {
    await page.evaluate(n => { const g = document.getElementById('arcadeSheet').arcadeRun.game; while (g.stack.length <= n) g.stack.push({ x: 0.3, w: 0.4 }); g.mover.x = g.stack.at(-1).x; g.mover.w = g.stack.at(-1).w; }, coffins);
    await page.keyboard.press('Space');
    await expect.poll(stage).toBe(want);
  }
  // Rows far below the bottom edge are dropped, so a long tower stays small.
  expect(await page.locator('#arcadeSheet .ar-tower .ar-coffin').count()).toBeLessThan(20);
});

test('The Séance speaks, waits for its turn, and forgives the first wrong candle', async ({ page }) => {
  await open(page);
  await start(page, 'seance');
  await expect(page.locator('#arcadeSheet [data-ar-status]')).toContainText('The spirits are speaking');
  await expect(page.locator('#arcadeSheet .ar-candle')).toHaveCount(4);
  await page.waitForFunction(() => document.querySelector('#arcadeSheet .ar-candle.lit'), null, { polling: 'raf', timeout: 30000 });
  await expect(page.locator('#arcadeSheet [data-ar-status]')).toContainText('Your turn. 3 candles.', { timeout: 40000 });
  const wanted = await page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; return g.seq[0]; });
  await page.keyboard.press(String(((wanted + 1) % 4) + 1));
  await expect(page.locator('#arcadeSheet [data-ar-status]')).toContainText('forgive');
  await expect(page.locator('#arcadeSheet .ar-lives i.on')).toHaveCount(1);
});

test('a run ends in a beat of slow motion, then the card: the real score, a resident, a medal, and Again', async ({ page }) => {
  await open(page);
  await start(page, 'frenzy');
  await page.evaluate(() => { const r = document.getElementById('arcadeSheet').arcadeRun; r.game.score = 47; r.game.bestCombo = 12; r.game.lives = 0; r.game.over = true; });
  await expect(page.locator('#arcadeSheet [data-ar-field].dying')).toHaveCount(1);
  // Again is held off for a beat so the key-mashing that ended the run cannot start another.
  await page.waitForFunction(() => document.querySelector('#arcadeSheet .ar-again')?.disabled === true, null, { polling: 'raf', timeout: 15000 });
  await expect(page.locator('#arcadeSheet .ar-over')).toBeVisible();
  // The number is there for anything that reads it, however the count-up is going.
  expect(await page.locator('#arcadeSheet .ar-final b').textContent()).toBe('47');
  await expect(page.locator('#arcadeSheet .ar-newbest')).toHaveText('New best');
  await expect(page.locator('#arcadeSheet .ar-over-pet .sprite')).toHaveCount(1);
  await expect(page.locator('#arcadeSheet .ar-rank')).toContainText('Peckish');
  await expect(page.locator('#arcadeSheet .ar-stats li')).toHaveCount(3);
  await expect(page.locator('#arcadeSheet .ar-stats li').first()).toContainText('12');
  await expect(page.locator('#arcadeSheet .ar-tier i.on')).toHaveCount(1);
  await expect(page.locator('#arcadeSheet .ar-again')).toBeFocused({ timeout: 10000 });
  await expect(page.locator('#arcadeSheet .ar-final-num.counting')).toHaveCount(0, { timeout: 4000 });
  expect(await page.locator('#arcadeSheet .ar-final b').textContent()).toBe('47');
  const shelf = await saved(page);
  expect(shelf.arcade.best.frenzy).toBe(47);
  expect(shelf.arcade.medals.frenzy).toBe(1);
  expect(shelf.arcade.runs).toBe(1);
  // Again is a short count and straight back in.
  await page.locator('#arcadeSheet .ar-again').click();
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  await expect.poll(() => phase(page), { timeout: 20000 }).toBe('play');
});

test('closing the sheet in the middle of the slow-motion death still counts the run', async ({ page }) => {
  await open(page);
  await start(page, 'frenzy');
  await page.evaluate(() => { const r = document.getElementById('arcadeSheet').arcadeRun; r.game.score = 18; r.game.lives = 0; r.game.over = true; });
  await expect(page.locator('#arcadeSheet [data-ar-field].dying')).toHaveCount(1);
  await page.locator('#arcadeSheet .sheet-head [data-ar="close"]').click();
  await expect(page.locator('#arcadeVeil')).not.toBeVisible();
  await expect.poll(async () => (await saved(page)).arcade.plays?.frenzy).toBe(1);
  expect((await saved(page)).arcade.best.frenzy).toBe(18);
});

test('the hub shows skull medals, the last fortnight and the arena to unlock, and an unlocked arena can be chosen', async ({ page }) => {
  const day = d => { const t = new Date(Date.now() - d * 86400000); const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(t).map(x => [x.type, x.value])); return p.year + '-' + (Number(p.month) - 1) + '-' + Number(p.day); };
  await open(page, { arcade: { best: { frenzy: 50, stack: 12 }, plays: { frenzy: 8, stack: 4 }, medals: { frenzy: 2, stack: 1 }, runs: 12,
    history: [{ day: day(1), game: 'stack', mod: 'slim', best: 20 }, { day: day(3), game: 'frenzy', mod: 'storm', best: 50 }, { day: day(5), game: 'whack', mod: 'funeral', best: 40 }] } });
  await show(page, null);
  await expect(page.locator('#arcadeSheet .ar-menu-card')).toHaveCount(4);
  await expect(page.locator('#arcadeSheet .ar-menu-card[data-ar-game="frenzy"] .ar-medals')).toHaveAttribute('aria-label', 'Best medal: 2 of 3 skulls');
  await expect(page.locator('#arcadeSheet .ar-menu-card[data-ar-game="frenzy"] .ar-medals i.on')).toHaveCount(2);
  await expect(page.locator('#arcadeSheet .ar-menu-card[data-ar-game="seance"] .ar-medals i.on')).toHaveCount(0);
  await expect(page.locator('#arcadeSheet .ar-menu-card svg.hub-art')).toHaveCount(4);
  await expect(page.locator('#arcadeSheet .ar-fortnight li')).toHaveCount(14);
  await expect(page.locator('#arcadeSheet .ar-fortnight li.played')).toHaveCount(3);
  await expect(page.locator('#arcadeSheet .ar-fortnight li.today')).toHaveCount(1);
  await expect(page.locator('#arcadeSheet .ar-fortnight')).toContainText('3 of 14 played');
  await expect(page.locator('#arcadeSheet .ar-arena')).toContainText('Next arena: Embers. 18 more runs to open it.');
  await expect(page.locator('#arcadeSheet .ar-chip.is-on')).toContainText('Dusk');
  await expect(page.locator('#arcadeSheet .ar-chip[data-ar-theme="moonlit"]')).toBeEnabled();
  await expect(page.locator('#arcadeSheet .ar-chip[data-ar-theme="embers"]')).toBeDisabled();
  await expect(page.locator('#arcadeSheet .ar-chip[data-ar-theme="gilded"]')).toContainText('12 skulls');
  await page.locator('#arcadeSheet .ar-chip[data-ar-theme="moonlit"]').click();
  await expect(page.locator('#arcadeSheet .ar-chip.is-on')).toContainText('Moonlit');
  expect((await saved(page)).arcade.theme).toBe('moonlit');
  // The arena paints the field.
  await page.locator('#arcadeSheet .ar-menu-card[data-ar-game="whack"]').click();
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  expect(await field(page).evaluate(el => getComputedStyle(el).getPropertyValue('--ar-sky-a').trim())).toBe('#1b2748');
  await page.reload();
  await show(page, null);
  await expect(page.locator('#arcadeSheet .ar-chip.is-on')).toContainText('Moonlit');
});

test('the haptics switch lives in More, buzzes on hits, and stays silent when off', async ({ page }) => {
  await open(page, { init: () => { window.__buzz = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__buzz.push(p); return true; } }); } });
  await page.locator('#tabMore:visible, #moreBtn:visible').first().click();
  const toggle = page.locator('#hapticsBtn');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await start(page, 'frenzy');
  const hit = () => page.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.lives = 3; g.items.push({ id: 900 + Math.floor(Math.random() * 1e6), kind: 'holy', x: g.x, y: 0.84, vy: 0, spin: 0 }); });
  await hit();
  await expect.poll(() => page.evaluate(() => window.__buzz.length)).toBeGreaterThan(0);
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await page.locator('#tabMore:visible, #moreBtn:visible').first().click();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await saved(page)).settings.haptics).toBe(false);
  await page.keyboard.press('Escape');
  const before = await page.evaluate(() => window.__buzz.length);
  await start(page, 'frenzy');
  await hit();
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__buzz.length)).toBe(before);
});

test('Full effects start at level 0, Light effects at 1, and reduced motion at the minimum', async ({ page, browser }) => {
  await open(page, { settings: { effects: 'full' } });
  await start(page, 'frenzy');
  expect(await fxLevel(page)).toBe('0');
  await expect(page.locator('#arcadeSheet canvas.ar-fx')).toBeVisible();
  const light = await browser.newPage();
  await light.emulateMedia({ reducedMotion: 'no-preference' });
  await open(light, { settings: { effects: 'light' } });
  await start(light, 'frenzy');
  expect(await fxLevel(light)).toBe('1');
  await light.close();
  const calm = await browser.newPage();
  await calm.emulateMedia({ reducedMotion: 'reduce' });
  await open(calm, { settings: { effects: 'full' } });
  await start(calm, 'frenzy');
  expect(await fxLevel(calm)).toBe('2');
  await expect(calm.locator('#arcadeSheet canvas.ar-fx')).toBeHidden();
  // Pops fade in place rather than travelling.
  await calm.evaluate(() => { const g = document.getElementById('arcadeSheet').arcadeRun.game; g.items.push({ id: 950, kind: 'tooth', x: g.x, y: 0.84, vy: 0, spin: 0 }); });
  await expect(calm.locator('#arcadeSheet .ar-pop').first()).toBeAttached();
  await calm.close();
});

test('a device that cannot keep up loses effects after about two seconds, and the next run starts lighter', async ({ page }) => {
  await open(page, { settings: { effects: 'full' }, init: () => {
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => real(t => { if (window.__burn) { const end = performance.now() + 40; while (performance.now() < end) { /* a slow phone */ } } cb(t); });
  } });
  await start(page, 'frenzy', { govern: true });
  await page.evaluate(() => { window.__burn = false; });
  expect(await fxLevel(page)).toBe('0');
  await page.evaluate(() => { window.__burn = true; });
  await expect.poll(async () => { if (await page.locator('#arcadeSheet .ar-paused').count()) await page.locator('#arcadeSheet .ar-paused').click(); return fxLevel(page); }, { timeout: 40000 }).not.toBe('0');
  await page.evaluate(() => { window.__burn = false; });
  const reached = await fxLevel(page);
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await start(page, 'stack');
  expect(Number(await fxLevel(page))).toBeGreaterThanOrEqual(Number(reached));
  expect(await fxLevel(page)).not.toBe('0');
});

test('every arcade sound renders audibly without clipping, and the three-skull sting shimmers', async ({ page }) => {
  await open(page, { settings: { muted: false } });
  await start(page, 'frenzy');
  const report = await page.evaluate(async () => {
    const { renderSoundOffline, playStar, getLastSound } = await import('/src/audio/sound.js');
    const { arcadeSoundNames } = await import('/src/audio/arcade-audio.js');
    const out = [];
    for (const name of arcadeSoundNames()) out.push(await renderSoundOffline(name, 2.4));
    playStar({ step: 1 }); const one = getLastSound();
    playStar({ step: 3 }); const three = getLastSound();
    return { out, one: one && one.nodes, three: three && three.nodes };
  });
  expect(report.out.length).toBeGreaterThanOrEqual(19);
  for (const r of report.out) {
    expect(r.peak, r.name + ' is audible').toBeGreaterThan(0.01);
    expect(r.clipped, r.name + ' clips').toBe(false);
    expect(r.audibleSeconds, r.name + ' lasts').toBeGreaterThan(0.05);
    expect(r.audibleSeconds, r.name + ' is not endless').toBeLessThan(2.3);
    expect(r.nodeCount, r.name + ' stays small').toBeLessThan(70);
  }
  expect(report.three.filter(n => n === 'noise').length).toBeGreaterThan(report.one.filter(n => n === 'noise').length);
});

test('each game has a quiet bed that ducks on pause, stops when the page is hidden and returns, and ends with the sheet', async ({ page }) => {
  await open(page, { settings: { muted: false } });
  const bed = () => page.evaluate(async () => (await import('/src/audio/arcade-audio.js')).bedState());
  await start(page, 'seance', { wait: false });
  await expect.poll(async () => (await bed()).playing, { timeout: 5000 }).toBe(true);
  expect((await bed()).kind).toBe('seance');
  await page.locator('#arcadeSheet [data-ar="pause"]').click();
  await expect.poll(async () => (await bed()).ducked).toBe(true);
  await page.locator('#arcadeSheet .ar-paused').click();
  await expect.poll(async () => (await bed()).ducked).toBe(false);
  // A hidden page stops the bed and pauses the run.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await bed()).playing).toBe(false);
  expect((await bed()).wanted).toBe('seance');
  await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#arcadeSheet .ar-paused').click();
  await expect.poll(async () => (await bed()).playing).toBe(true);
  await page.locator('#arcadeSheet [data-ar="close"]').click();
  await expect.poll(async () => (await bed()).wanted).toBe(null);
  await expect.poll(async () => (await bed()).playing).toBe(false);
  // Muted means no bed at all.
  await page.evaluate(async () => { (await import('/src/audio/sound.js')).setMuted(true); });
  await start(page, 'whack', { wait: false });
  await page.waitForTimeout(500);
  expect((await bed()).playing).toBe(false);
});

test('Playroom cards show the new casket, not the old stand-in', async ({ page }) => {
  await open(page);
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  const card = page.locator('#activityCards [data-game="stack"] .play-card-glyph svg');
  await expect(card).toHaveCount(1);
  expect(await card.innerHTML()).toContain('M17 4h14l9 12-6 28H14L8 16z');
});

test('every screen of the arcade fits a 320px phone', async ({ page }) => {
  await open(page, { size: { width: 320, height: 640 }, arcade: { best: { frenzy: 90 }, plays: { frenzy: 8 }, medals: { frenzy: 2 }, runs: 40 } });
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.veil.open .sheet')].some(el => el.scrollWidth > el.clientWidth + 1));
  await show(page, null);
  await expect(page.locator('#arcadeSheet .ar-menu-card')).toHaveCount(4);
  expect(await wide(), 'hub').toBe(false);
  for (const game of ['frenzy', 'stack', 'seance', 'whack']) {
    await show(page, game);
    expect(await wide(), game + ' intro').toBe(false);
    await page.locator('#arcadeSheet [data-ar="play"]').click();
    await expect.poll(() => phase(page)).toBe('play');
    expect(await wide(), game + ' playing').toBe(false);
    const lowest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#arcadeSheet button, #arcadeSheet [data-ar-field]')].map(el => el.getBoundingClientRect().bottom)));
    expect(lowest, game + ' controls on screen').toBeLessThanOrEqual(640);
    await page.evaluate(() => { const r = document.getElementById('arcadeSheet').arcadeRun; r.game.score = 33; r.game.lives = 0; r.game.over = true; if (r.game.phase) r.game.phase = 'over'; });
    await expect(page.locator('#arcadeSheet .ar-over')).toBeVisible();
    expect(await wide(), game + ' result').toBe(false);
    await page.locator('#arcadeSheet [data-ar="close"]').first().click();
  }
});
