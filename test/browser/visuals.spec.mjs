import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

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

async function openHousehold(page, customize = () => {}, { kind = 'established', init = null } = {}) {
  const snapshot = householdFixture(kind);
  snapshot.settings.theatreOn = false;
  snapshot.settings.muted = true;
  snapshot.lastBackup = Date.now();
  customize(snapshot);
  await page.addInitScript(({ snapshot, key, init }) => {
    if (init) { try { new Function(init)(); } catch { /* a bad init is the test's problem */ } }
    if (!sessionStorage.getItem('shelflife.browser.fixture')) {
      localStorage.setItem(key, JSON.stringify(snapshot));
      sessionStorage.setItem('shelflife.browser.fixture', '1');
    }
  }, { snapshot, key: SAVE_KEY, init });
  await page.goto('/');
  if (snapshot.pets.length) await expect(page.locator('#cabinet .piece.pet')).toHaveCount(snapshot.pets.length);
  return snapshot;
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
}
const fxCount = (page, selector = '#fxLayer .fx-p') => page.locator(selector).count();
// Remember that particles were drawn even if they are gone again by the time we look.
const watchFx = page => page.addInitScript(() => {
  window.__fxSeen = 0;
  new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) window.__fxSeen += (n.matches?.('.fx-p') ? 1 : 0) + (n.querySelectorAll?.('.fx-p').length || 0); })
    .observe(document, { childList: true, subtree: true });
});
const fxSeen = page => page.evaluate(() => window.__fxSeen);

test.describe('the effects toolkit', () => {
  test('bursts, flights, counts, shakes and pulses draw something and clean up after themselves', async ({ page }) => {
    await openHousehold(page, s => { s.settings.effects = 'full'; });
    await page.evaluate(() => { window.__target = document.querySelector('#cabinet .piece.pet'); });
    // Count in the same breath as the call, so a slow machine cannot miss the burst.
    const drawn = await page.evaluate(() => { window.shelfFx.burst(window.__target, 'confetti'); return document.querySelectorAll('#fxLayer .fx-p').length; });
    expect(drawn).toBeGreaterThan(10);
    await expect.poll(() => fxCount(page), { timeout: 8000 }).toBe(0);
    const kinds = await page.evaluate(() => { for (const k of ['souls', 'hearts', 'puff', 'sparkles']) window.shelfFx.burst(window.__target, k); return document.querySelectorAll('#fxLayer .fx-p').length; });
    expect(kinds).toBeGreaterThan(30);
    // A flight resolves on landing and leaves nothing behind.
    const landed = await page.evaluate(async () => {
      const hud = document.getElementById('soulsHud');
      const start = performance.now();
      await window.shelfFx.flyTo(window.__target, hud, 'soul', { count: 3 });
      return { ms: performance.now() - start, flyers: document.querySelectorAll('#fxLayer .fx-flyer').length };
    });
    expect(landed.flyers).toBe(0);
    expect(landed.ms).toBeGreaterThan(300);
    // Counting ends exactly on the target and writes into the same text node.
    const counted = await page.evaluate(async () => {
      const el = document.createElement('b'); el.textContent = '10'; document.body.appendChild(el);
      const seen = [];
      const watch = setInterval(() => seen.push(Number(el.textContent)), 30);
      await window.shelfFx.countUp(el, 240);
      clearInterval(watch);
      const result = { final: el.textContent, monotonic: seen.every((n, i) => i === 0 || n >= seen[i - 1]), steps: new Set(seen).size };
      el.remove();
      return result;
    });
    expect(counted.final).toBe('240');
    expect(counted.monotonic).toBe(true);
    expect(counted.steps).toBeGreaterThan(3);
    // Shake and pulse return and leave the element's own transform alone.
    const after = await page.evaluate(async () => {
      const el = window.__target;
      const before = getComputedStyle(el).transform;
      await window.shelfFx.shake(el);
      await window.shelfFx.pulse(el);
      return { before, after: getComputedStyle(el).transform, rings: document.querySelectorAll('#fxLayer .fx-ring').length };
    });
    expect(after.after).toBe(after.before);
    expect(after.rings).toBe(0);
  });

  test('reduced motion draws nothing but still lands on the right number', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openHousehold(page);
    const result = await page.evaluate(async () => {
      const target = document.querySelector('#cabinet .piece.pet');
      window.shelfFx.burst(target, 'confetti');
      window.shelfFx.celebrate('moved-in', { name: 'Test' });
      const el = document.createElement('b'); el.textContent = '3'; document.body.appendChild(el);
      await window.shelfFx.countUp(el, 99);
      return { particles: document.querySelectorAll('#fxLayer .fx-p').length, text: el.textContent, level: window.shelfFx.motionLevel() };
    });
    expect(result).toEqual({ particles: 0, text: '99', level: 'off' });
    expect(errors).toEqual([]);
    await context.close();
  });

  test('Light effects draw a third of the particles', async ({ page }) => {
    await openHousehold(page, s => { s.settings.effects = 'light'; });
    await expect(page.locator('body')).toHaveAttribute('data-effects', 'light');
    const n = await page.evaluate(() => { window.shelfFx.burst(document.querySelector('#cabinet .piece.pet'), 'confetti'); return document.querySelectorAll('#fxLayer .fx-p').length; });
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThan(15);
  });

  test('a sheet leaves with a short exit and the page is usable straight away', async ({ page }) => {
    await openHousehold(page);
    await page.evaluate(() => document.getElementById('quickHelp').click());
    const veil = page.locator('#helpVeil');
    await expect(veil).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(veil).not.toHaveClass(/open/);
    await expect(veil).toBeHidden({ timeout: 2000 });
    await expect(veil).not.toHaveClass(/fx-leaving/);
    await noHorizontalOverflow(page);
  });
});

test.describe('automatic effects', () => {
  test('a remembered slow verdict makes Automatic Light, and the manual choice always wins', async ({ page }) => {
    await openHousehold(page, s => { delete s.settings.effects; }, { init: "localStorage.setItem('shelflife.perf', JSON.stringify({tier:'light',up:0}))" });
    await expect(page.locator('body')).toHaveAttribute('data-effects', 'light');
    await page.locator('#tabMore:visible, #moreBtn:visible').first().click();
    await page.locator('#effectsMode').selectOption('full');
    await expect(page.locator('body')).toHaveAttribute('data-effects', 'full');
    await expect.poll(async () => (await saved(page)).settings.effects).toBe('full');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-effects', 'full');
    await expect(page.locator('#effectsHint')).toContainText('Full effects active');
  });

  test('a remembered fast verdict makes Automatic Full even on a touch screen', async ({ page }) => {
    await openHousehold(page, s => { delete s.settings.effects; }, { init: "localStorage.setItem('shelflife.perf', JSON.stringify({tier:'full',up:0}))" });
    await expect(page.locator('body')).toHaveAttribute('data-effects', 'full');
    await expect(page.locator('#effectsHint')).toContainText('Automatic chose Full');
  });

  test('the benchmark measures frames at startup and remembers a verdict outside the save', async ({ page }) => {
    await openHousehold(page, s => { delete s.settings.effects; });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('shelflife.perf')), { timeout: 15000 }).not.toBeNull();
    const verdict = await page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.perf')));
    expect(['full', 'light']).toContain(verdict.tier);
    expect(verdict.median).toBeGreaterThan(0);
    const shelf = await saved(page);
    expect(JSON.stringify(shelf)).not.toContain('shelflife.perf');
    expect(shelf.settings.effects).toBe('auto');
  });
});

test.describe('the lit shelf', () => {
  for (const effects of ['light', 'full']) {
    test(effects + ' effects keep the rim light and the shadow, without filters on the sprites', async ({ page }) => {
      await openHousehold(page, s => { s.settings.effects = effects; });
      const lit = await page.evaluate(() => {
        const sprite = document.querySelector('#cabinet .piece.pet .sprite.sl2');
        const rim = sprite.querySelector('.cr-rim');
        const cast = getComputedStyle(sprite, '::before');
        return {
          mode: document.body.dataset.effects,
          rim: !!rim, rimStroke: rim && getComputedStyle(rim).stroke,
          castContent: cast.content, castBackground: cast.backgroundImage,
          figureFilter: getComputedStyle(sprite.querySelector('.sprite-figure')).filter,
          haze: getComputedStyle(document.querySelector('#haze'), '::after').display
        };
      });
      expect(lit.mode).toBe(effects);
      expect(lit.rim).toBe(true);
      expect(lit.rimStroke).toContain('url(');
      expect(lit.castContent).not.toBe('none');
      expect(lit.castBackground).toContain('radial-gradient');
      expect(lit.figureFilter).toBe('none');
      expect(lit.haze).not.toBe('none');
    });
  }
});

test.describe('life on the shelf', () => {
  test('a resident reacts to an event, a touch turns pupils, and a sleeping one only startles', async ({ page }) => {
    await openHousehold(page);
    // Dispatch and read in one breath: the clip clears itself when it ends.
    const play = kind => page.evaluate(kind => {
      window.dispatchEvent(new CustomEvent('shelflife:react', { detail: { id: 'qa0', kind } }));
      return document.querySelector('#cabinet .sprite.sl2[data-pet="qa0"] .sprite-act').style.animation;
    }, kind);
    await page.locator('#cabinet .sprite.sl2[data-pet="qa0"]').scrollIntoViewIfNeeded();
    for (const [kind, name] of [['happy', 'sl2-hop'], ['startled', 'sl2-startle'], ['proud', 'sl2-celebrate'], ['grossed', 'sl2-recoil']]) {
      expect(await play(kind), kind).toContain(name);
    }
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('shelflife:react', { detail: { id: 'qa0', kind: 'startled' } })));
    await expect(page.locator('#cabinet .sprite.sl2[data-pet="qa0"] .react-mark')).toHaveText('!');
    // Pupils follow a touch on the room.
    await page.evaluate(() => {
      const target = document.querySelector('#paneShelf .shelf-framing');
      const r = target.getBoundingClientRect();
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.right - 4, clientY: r.top + 6, pointerType: 'touch', isPrimary: true }));
    });
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#cabinet .sprite.sl2')].filter(el => el.style.getPropertyValue('--sl-gaze-x') !== '').length)).toBeGreaterThan(0);
  });

  test('after dark an awake resident gets drowsy and a night owl does not', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-13T04:30:00Z'));
    await openHousehold(page, s => { s.pets[0].traits = ['nocturnal']; s.pets[1].traits = ['spiteful']; });
    await expect(page.locator('body')).toHaveClass(/night/);
    await expect(page.locator('#cabinet .sprite.sl2[data-pet="qa1"]')).toHaveClass(/sl-drowsy/, { timeout: 5000 });
    await expect(page.locator('#cabinet .sprite.sl2[data-pet="qa0"]')).not.toHaveClass(/sl-drowsy/);
  });
});

// The day key the page uses (America/Chicago, see playwright.config.mjs).
function dayKey(offsetDays = 0) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(Date.now() + offsetDays * 86400000)).map(x => [x.type, x.value]));
  return parts.year + '-' + (Number(parts.month) - 1) + '-' + Number(parts.day);
}
const turnedOver = () => ({ day: dayKey(0), id: 'wet-hand', streak: 1, lastDay: dayKey(0), grace: 1 });
const mayhem = (over = {}) => ({ souls: 120, lifetime: 120, resolved: 3, coffins: 0, serial: 4, nextAt: Date.now() + 600000, curios: {}, queue: [], ...over });

test.describe('celebrations', () => {
  test('the first coffin ever opened gets a banner and a curio that arrives with a flourish', async ({ page }) => {
    await watchFx(page);
    await openHousehold(page, s => { s.settings.effects = 'full'; s.mayhem = mayhem(); });
    await page.locator('#mayhemDesk [data-mh="coffin"]').click();
    await page.locator('#mayhemSheet [data-mh="pry"]').click();
    const card = page.locator('#mayhemSheet .mh-curio-card[data-reveal]');
    await expect(card).toBeVisible();
    expect(await fxSeen(page)).toBeGreaterThan(0);
    await expect(page.locator('.fx-banner')).toContainText('First coffin');
    await expect(page.locator('#fxLive')).toContainText('First coffin');
    await noHorizontalOverflow(page);
    // The second coffin is just a coffin.
    await page.locator('#mayhemSheet [data-mh="coffin"]').click();
    await page.locator('#mayhemSheet [data-mh="pry"]').click();
    await expect(page.locator('#mayhemSheet .mh-curio-card')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('.fx-banner:not(.out)')).toHaveCount(await page.locator('.fx-banner:not(.out)').count());
    expect((await saved(page)).mayhem.coffins).toBe(2);
  });

  test('finishing a rarity set announces it once', async ({ page }) => {
    const { CURIOS } = await import('../../src/content/mayhem.js');
    const commons = CURIOS.filter(c => c.rarity === 'common');
    const missing = commons[0];
    await openHousehold(page, s => {
      s.settings.effects = 'full';
      s.mayhem = mayhem({ souls: 900, lifetime: 900, coffins: 5, curios: Object.fromEntries(commons.slice(1).map(c => [c.id, 1])) });
    });
    await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
    await page.locator('#mayhemSheet [data-order="' + missing.id + '"]').click();
    await page.locator('#mayhemSheet [data-order-buy]').click();
    await expect(page.locator('.fx-banner')).toContainText('Every Common curio.');
    await expect(page.locator('#mayhemSheet .mh-curio-card[data-reveal="common"]')).toBeVisible();
    await expect.poll(async () => (await saved(page)).mayhem.curios[missing.id]).toBe(1);
  });

  test('a rank-up throws confetti and the souls counter ends on the real total', async ({ page }) => {
    await watchFx(page);
    await openHousehold(page, s => {
      s.settings.effects = 'full';
      s.mayhem = mayhem({ souls: 58, lifetime: 58, omen: turnedOver(), queue: [{ uid: 1, id: 'ouija', a: 'qa0', at: Date.now() - 1000 }] });
    });
    await page.locator('#mayhemAlert [data-mh="emergency"]').click();
    await page.locator('#mayhemSheet [data-choice="0"]').click();
    await expect(page.locator('#mayhemRankUp')).toBeVisible();
    expect(await fxSeen(page)).toBeGreaterThan(10);
    const total = (await saved(page)).mayhem.souls;
    expect(total).toBeGreaterThan(58);
    await expect(page.locator('#soulsHud .souls-count b')).toHaveText(String(total), { timeout: 4000 });
  });

  test('souls earned fly to the counter and it counts up to the new total', async ({ page }) => {
    await openHousehold(page, s => {
      s.settings.effects = 'full';
      s.mayhem = mayhem({ souls: 10, lifetime: 10, omen: turnedOver(), queue: [{ uid: 1, id: 'ouija', a: 'qa0', at: Date.now() - 1000 }] });
    });
    await page.locator('#mayhemAlert [data-mh="emergency"]').click();
    await page.locator('#mayhemSheet [data-choice="0"]').click();
    await expect(page.locator('#fxLayer .fx-flyer').first()).toBeAttached({ timeout: 2000 });
    const total = (await saved(page)).mayhem.souls;
    await expect(page.locator('#soulsHud .souls-count b')).toHaveText(String(total), { timeout: 5000 });
    await expect(page.locator('#fxLayer .fx-flyer')).toHaveCount(0, { timeout: 4000 });
  });

  test('the third night of the omen is marked', async ({ page }) => {
    await openHousehold(page, s => {
      s.settings.effects = 'full';
      s.mayhem = mayhem({ omen: { day: '', id: '', streak: 2, lastDay: dayKey(-1), grace: 1 } });
    });
    await page.locator('#mayhemAlert [data-mh="omen"]').click();
    await page.locator('#mayhemSheet [data-mh="flip"]').click();
    await expect(page.locator('#mayhemSheet .mh-tarot.face')).toBeVisible();
    await expect(page.locator('.fx-banner')).toContainText('Three nights running', { timeout: 4000 });
  });

  test('adopting the very first resident welcomes them with a banner and a flourish', async ({ page }) => {
    await watchFx(page);
    await page.addInitScript(() => localStorage.setItem('shelflife.perf', JSON.stringify({ tier: 'full', up: 0 })));
    await page.goto('/');
    await page.locator('[data-arrival="mabel"]').click();
    await page.locator('#quickAdopt').click();
    await expect(page.locator('#cabinet .piece.pet')).toHaveCount(1);
    await expect(page.locator('.fx-banner')).toContainText('Mabel has the shelf.', { timeout: 4000 });
    expect(await fxSeen(page)).toBeGreaterThan(0);
    await noHorizontalOverflow(page);
  });

  test('a restored shelf with many residents does not set off a party', async ({ page }) => {
    await openHousehold(page, s => { s.settings.effects = 'full'; });
    await page.waitForTimeout(800);
    expect(await page.locator('.fx-banner').count()).toBe(0);
    expect(await fxCount(page)).toBe(0);
  });
});

test.describe('empty states and transitions', () => {
  test('a house with nobody in it explains its notes and stories and offers a way in', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.arrival-resident')).toHaveCount(3);
    await page.locator('.tab[data-tab="notes"]').click();
    const notes = page.locator('#notes .fx-empty-notes');
    await expect(notes).toBeVisible();
    await expect(notes.locator('svg.empty-art')).toBeVisible();
    await expect(notes).toContainText('First, a creature. Then, the complaints.');
    await noHorizontalOverflow(page);
    await page.locator('.tab[data-tab="plots"]').click();
    const stories = page.locator('.stories-vacant .fx-empty-stories');
    await expect(stories).toBeVisible();
    await noHorizontalOverflow(page);
    await stories.getByRole('button', { name: 'Make someone' }).click();
    await expect(page.locator('#studioVeil')).toBeVisible();
  });

  test('an empty filter on the note board says so in the house voice', async ({ page }) => {
    await openHousehold(page);
    await page.locator('.tab[data-tab="notes"]').click();
    await page.locator('#noteFilters [data-filter="papers"]').click();
    const empty = page.locator('#notes .fx-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Nothing filed. Suspicious.');
    await expect(empty).toContainText('filing desk is ready');
    await expect(empty.locator('button')).toHaveCount(0);
  });

  test('the cabinet is illustrated while it is empty and plain once it has something in it', async ({ page }) => {
    await openHousehold(page, s => { s.mayhem = mayhem({ curios: {} }); });
    await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
    await expect(page.locator('#mayhemSheet .fx-empty-cabinet')).toBeVisible();
    await expect(page.locator('#mayhemSheet .fx-empty-cabinet')).toContainText('Not one curio.');
    await noHorizontalOverflow(page);
    await page.locator('#mayhemSheet [data-mh="close"]').click();
    await page.context().clearCookies();
  });

  test('the cabinet carries no empty state once there is a curio', async ({ page }) => {
    const { CURIOS } = await import('../../src/content/mayhem.js');
    await openHousehold(page, s => { s.mayhem = mayhem({ curios: { [CURIOS[0].id]: 1 } }); });
    await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
    await expect(page.locator('#mayhemSheet .mh-rank-card')).toBeVisible();
    await expect(page.locator('#mayhemSheet .fx-empty-cabinet')).toHaveCount(0);
  });

  test('moving between tabs remembers which way you went', async ({ page }) => {
    await openHousehold(page);
    await page.locator('.tab[data-tab="notes"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-tab-dir', 'forward');
    await page.locator('.tab[data-tab="shelf"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-tab-dir', 'back');
  });

  test('empty states fit a 320px phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    for (const tab of ['notes', 'plots']) {
      await page.locator('.tab[data-tab="' + tab + '"]').click();
      await noHorizontalOverflow(page);
    }
  });
});

test.describe('the first ten seconds', () => {
  test('on a small phone the three residents and the way in all fit above the tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await expect(page.locator('.arrival-resident')).toHaveCount(3);
    await page.waitForTimeout(1800);
    const fit = await page.evaluate(() => {
      const bar = document.querySelector('.tabbar').getBoundingClientRect().top;
      const bottoms = [...document.querySelectorAll('.arrival-action'), document.querySelector('.arrival-footer .btn')].map(el => el.getBoundingClientRect().bottom);
      const tops = [...document.querySelectorAll('.arrival-action')].map(el => Math.round(el.getBoundingClientRect().top));
      return { bar, lowest: Math.max(...bottoms), tops };
    });
    expect(fit.lowest, 'every button clears the tab bar').toBeLessThanOrEqual(fit.bar);
    expect(new Set(fit.tops).size, 'the three Meet buttons share a baseline').toBe(1);
    await noHorizontalOverflow(page);
  });

  test('choosing a resident sparkles and still opens the creator with that resident', async ({ page }) => {
    await watchFx(page);
    await page.addInitScript(() => localStorage.setItem('shelflife.perf', JSON.stringify({ tier: 'full', up: 0 })));
    await page.goto('/');
    await page.locator('[data-arrival="pip"]').click();
    await expect(page.locator('#studioVeil')).toBeVisible();
    await expect(page.locator('#quickAdopt')).toHaveText('Meet Pip');
    expect(await fxSeen(page)).toBeGreaterThan(0);
  });

  test('the first frame is dark, the manifest and the splash agree with it, and a bare cabinet shows a candle', async ({ page }) => {
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest.background_color.toLowerCase()).toBe('#0b0812');
    expect(manifest.theme_color.toLowerCase()).toBe('#0b0812');
    await page.goto('/');
    const first = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(first).toBe('rgb(11, 8, 18)');
    const waiting = await page.evaluate(() => { document.getElementById('cabinet').replaceChildren(); return getComputedStyle(document.getElementById('cabinet'), '::after').content; });
    expect(waiting).toContain('Waking the creatures.');
  });

  test('the rank ladder opens on the rung the house is on', async ({ page }) => {
    await openHousehold(page, s => { s.mayhem = mayhem({ lifetime: 2200, souls: 40 }); });
    await page.locator('#mayhemDesk [data-mh="cabinet"]').click();
    const visible = await page.evaluate(async () => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const ladder = document.querySelector('.mh-ladder'), now = ladder.querySelector('li.now');
      const l = ladder.getBoundingClientRect(), n = now.getBoundingClientRect();
      return { inside: n.left >= l.left - 1 && n.right <= l.right + 1, scrolled: ladder.scrollLeft };
    });
    expect(visible.inside).toBe(true);
  });
});

test.describe('haptics', () => {
  const stub = "window.__vibrations = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vibrations.push(p); return true; } });";
  test('a touch gives a tick, unless the player turned haptics off', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'haptics are for touch screens');
    await openHousehold(page, () => {}, { init: stub });
    await page.locator('.tab[data-tab="notes"]').tap();
    await expect.poll(() => page.evaluate(() => window.__vibrations.length)).toBeGreaterThan(0);
    const patterns = await page.evaluate(() => window.__vibrations);
    expect(patterns.flat().every(n => n > 0 && n < 60), 'short, tasteful pulses').toBe(true);
  });

  test('settings.haptics set to false silences every pulse', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'haptics are for touch screens');
    await openHousehold(page, s => { s.settings.haptics = false; }, { init: stub });
    await page.locator('.tab[data-tab="notes"]').tap();
    await page.locator('.tab[data-tab="shelf"]').tap();
    await page.evaluate(() => window.shelfFx.celebrate('moved-in', { name: 'X' }));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__vibrations)).toEqual([]);
  });

  test('a mouse never vibrates anything', async ({ page, isMobile }) => {
    test.skip(isMobile, 'this is the desktop case');
    await openHousehold(page, () => {}, { init: stub });
    await page.locator('.tab[data-tab="notes"]').click();
    await page.evaluate(() => window.shelfFx.celebrate('moved-in', { name: 'X' }));
    expect(await page.evaluate(() => window.__vibrations)).toEqual([]);
  });
});

test.describe('consistency', () => {
  test('a sheet title takes focus without wearing a ring', async ({ page }) => {
    await openHousehold(page);
    await page.evaluate(() => document.getElementById('decorBtn').click());
    await expect(page.locator('#decorVeil')).toBeVisible();
    const outline = await page.evaluate(() => { const h = document.querySelector('#decorVeil h2'); return { focused: document.activeElement === h, style: getComputedStyle(h).outlineStyle }; });
    expect(outline.focused).toBe(true);
    expect(outline.style).toBe('none');
  });

  test('the three rows of the Stories list start their titles in the same place', async ({ page }) => {
    await openHousehold(page);
    await page.locator('.tab[data-tab="plots"]').click();
    const xs = await page.evaluate(() => ['#correspondenceFolder summary b', '#workshopFolder summary b', '.museum-door b'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().left)));
    expect(new Set(xs).size, 'titles at ' + xs).toBe(1);
  });

  test('the More drawer top-aligns its items and its links are a full tap target', async ({ page }) => {
    await openHousehold(page);
    await page.locator('#tabMore:visible, #moreBtn:visible').first().click();
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.tray-legal a')].map(a => Math.round(a.getBoundingClientRect().height)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
    const tops = await page.evaluate(() => ['#helpBtn', '#decorBtn', '#museumBtn'].map(s => { const b = document.querySelector(s), r = b.getBoundingClientRect(), t = b.querySelector('span').getBoundingClientRect(); return Math.round(t.top - r.top); }));
    expect(new Set(tops).size, 'item labels start at ' + tops).toBe(1);
  });

  test('the note board toolbar no longer ends in a stray rule', async ({ page }) => {
    await openHousehold(page);
    await page.locator('.tab[data-tab="notes"]').click();
    const display = await page.evaluate(() => getComputedStyle(document.querySelector('.notes-tools'), '::after').display);
    expect(display).toBe('none');
  });
});
