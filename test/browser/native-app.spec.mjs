import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';

// The installed Android app, as far as a browser can pretend: a stand-in for
// the window.Capacitor that the native bridge injects, recording every plugin
// call. It proves the web code takes its native paths; it is not a device test.
const test = base.extend({ runtimeErrors: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(errors);
  expect(errors, 'browser errors').toEqual([]);
}, { auto: true }] });

function fakeBridge() {
  const log = window.__native = { calls: [], listeners: {} };
  const brief = arg => {
    if (!arg || typeof arg !== 'object') return arg ?? null;
    const copy = { ...arg };
    // A postcard is a megabyte of base64; the head and the length say enough.
    if (typeof copy.data === 'string' && !copy.encoding) { copy.dataLength = copy.data.length; copy.data = copy.data.slice(0, 12); }
    return JSON.parse(JSON.stringify(copy));
  };
  const record = (plugin, method, result) => async arg => {
    log.calls.push({ plugin, method, arg: brief(arg) });
    return typeof result === 'function' ? result(arg) : result;
  };
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: {
      App: { addListener: (event, fn) => { log.listeners[event] = fn; return { remove: async () => {} }; }, minimizeApp: record('App', 'minimizeApp') },
      Filesystem: { writeFile: record('Filesystem', 'writeFile', arg => ({ uri: 'file:///data/user/0/io.github.srmcno.shelflife/cache/' + arg.path })) },
      Share: { share: record('Share', 'share', { activityType: 'com.google.android.apps.docs' }) },
      Browser: { open: record('Browser', 'open') },
      SplashScreen: { hide: record('SplashScreen', 'hide') },
      TextToSpeech: {
        getSupportedVoices: record('TextToSpeech', 'getSupportedVoices', { voices: [
          { voiceURI: 'en-gb-x-rjs-local', name: 'English United Kingdom', lang: 'en-GB', localService: true },
          { voiceURI: 'fr-fr-x-frd-local', name: 'French France', lang: 'fr-FR', localService: true }
        ] }),
        speak: record('TextToSpeech', 'speak'),
        stop: record('TextToSpeech', 'stop')
      }
    }
  };
}

async function open(page) {
  const s = householdFixture('established'); s.settings.theatreOn = false; s.lastBackup = Date.now() - 86400000;
  await page.addInitScript(fakeBridge);
  await page.addInitScript(snapshot => { if (!sessionStorage.getItem('native-fixture')) { localStorage.setItem('shelflife.v4', JSON.stringify(snapshot)); sessionStorage.setItem('native-fixture', '1'); } }, s);
  await page.goto('/');
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
}
const calls = (page, plugin, method) => page.evaluate(([p, m]) => window.__native.calls.filter(c => c.plugin === p && (!m || c.method === m)).map(c => c.arg), [plugin, method]);
const moreButton = page => page.locator('#tabMore:visible, #moreBtn:visible').first();
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shelflife.v4')));

test('the app registers no service worker and never offers Save & refresh', async ({ page }) => {
  await open(page);
  await page.waitForLoadState('load');
  await page.waitForTimeout(300);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  await expect(page.locator('#updateBanner')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.classList.contains('native-app'))).toBe(true);
  expect((await calls(page, 'SplashScreen', 'hide')).length).toBeGreaterThan(0);
});

test('Back up and Move to another device write to the cache and open the share sheet', async ({ page }) => {
  await open(page);
  const before = (await saved(page)).lastBackup;
  await moreButton(page).click();
  await expect(page.locator('#exportBtn small')).toHaveText('Save or send a copy');
  await page.locator('#exportBtn').click();
  await expect.poll(async () => (await calls(page, 'Share', 'share')).length).toBe(1);
  const [write] = await calls(page, 'Filesystem', 'writeFile');
  expect(write.directory).toBe('CACHE');
  expect(write.encoding).toBe('utf8');
  expect(write.path).toMatch(/^shelf-life\/shelf-life-backup-.+\.json$/);
  expect(JSON.parse(write.data).pets.length).toBe((await saved(page)).pets.length);
  const [share] = await calls(page, 'Share', 'share');
  expect(share.files).toEqual(['file:///data/user/0/io.github.srmcno.shelflife/cache/' + write.path]);
  await expect.poll(async () => (await saved(page)).lastBackup).toBeGreaterThan(before);

  // The transfer sheet: the share sheet can attach the file to an email, so the download route is gone.
  await page.evaluate(() => document.getElementById('transferBtn').click());
  await expect(page.locator('#transferVeil')).toBeVisible();
  await expect(page.locator('#transferVeil .transfer-email')).toBeHidden();
  await page.locator('#transferShare').click();
  await expect(page.locator('#transferStatus')).toContainText('handed to the share menu');
  const shares = await calls(page, 'Share', 'share');
  expect(shares).toHaveLength(2);
  expect(shares[1].dialogTitle).toBe('Send your shelf');
  expect(shares[1].text).toContain('More → Restore');
});

test('a postcard is saved and shared through the share sheet', async ({ page }) => {
  await open(page);
  await page.locator('#snapBtn').click();
  await expect(page.locator('#postcardVeil')).toBeVisible();
  await expect(page.locator('#postcardSave')).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('#postcardShare')).toBeVisible();
  await page.locator('#postcardSave').click();
  await expect(page.locator('#toast')).toContainText('Handed over');
  await page.locator('#postcardShare').click();
  await expect.poll(async () => (await calls(page, 'Share', 'share')).length).toBe(2);
  const writes = await calls(page, 'Filesystem', 'writeFile');
  for (const write of writes) {
    expect(write.path).toMatch(/^shelf-life\/shelf-life-day-\d+\.png$/);
    expect(write.encoding).toBeUndefined();
    expect(write.data).toBe('iVBORw0KGgoA'); // the PNG signature, in base64
    expect(write.dataLength).toBeGreaterThan(10_000);
  }
  const shares = await calls(page, 'Share', 'share');
  expect(shares.map(s => s.dialogTitle)).toEqual(['Keep the postcard', 'Send the postcard']);
});

test('the narrator speaks through the phone engine, in British English', async ({ page }) => {
  await open(page);
  await moreButton(page).click();
  await expect(page.locator('#narratorBtn')).toBeVisible();
  await page.locator('#voiceBtn').click();
  await expect(page.locator('#voiceVeil')).toBeVisible();
  await expect(page.locator('#voiceSelect option[value="device:en-gb-x-rjs-local"]')).toHaveText(/English United Kingdom rjs \(en-GB, British\)/);
  await expect(page.locator('#voiceSelect option', { hasText: 'French' })).toHaveCount(0);
  await page.locator('#voicePreview').click();
  await expect.poll(async () => (await calls(page, 'TextToSpeech', 'speak')).length).toBe(1);
  const [line] = await calls(page, 'TextToSpeech', 'speak');
  expect(line).toMatchObject({ lang: 'en-GB', voice: 0, queueStrategy: 0 });
  expect(line.text).toContain('The shelf remembers');
  expect(line.rate).toBeLessThan(1);
  await expect(page.locator('#voiceMeta')).toContainText('This phone');
});

test('Back closes an open sheet first, then minimises and keeps the shelf saved', async ({ page }) => {
  await open(page);
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await expect(page.locator('#playroomVeil')).toBeVisible();
  await page.evaluate(() => window.__native.listeners.backButton({ canGoBack: true }));
  await expect(page.locator('.veil.open')).toHaveCount(0);
  expect(await calls(page, 'App', 'minimizeApp')).toHaveLength(0);
  expect(await page.evaluate(() => history.state?.shelflifeDialog ?? null)).toBe(null);

  await moreButton(page).click();
  await expect(page.locator('#moreTray')).toHaveClass(/open/);
  await page.evaluate(() => window.__native.listeners.backButton({ canGoBack: false }));
  await expect(page.locator('#moreTray')).not.toHaveClass(/open/);
  expect(await calls(page, 'App', 'minimizeApp')).toHaveLength(0);

  const before = (await saved(page)).life?.lastSeen || 0;
  await page.waitForTimeout(20);
  await page.evaluate(() => window.__native.listeners.backButton({ canGoBack: false }));
  await expect.poll(async () => (await calls(page, 'App', 'minimizeApp')).length).toBe(1);
  expect((await saved(page)).life.lastSeen).toBeGreaterThan(before);
  await expect(page.locator('#cabinet .piece.pet').first()).toBeVisible();
});

test('pausing the app pauses an arcade run and saves', async ({ page }) => {
  await open(page);
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await page.locator('[data-game="stack"]').click();
  await page.locator('#arcadeSheet [data-ar="play"]').click();
  await expect(page.locator('#arcadeSheet [data-ar-field]')).toBeVisible();
  const before = (await saved(page)).life?.lastSeen || 0;
  await page.waitForTimeout(20);
  await page.evaluate(() => window.__native.listeners.pause());
  await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
  expect((await saved(page)).life.lastSeen).toBeGreaterThan(before);
  await page.evaluate(() => window.__native.listeners.resume());
  await expect(page.locator('#arcadeSheet .ar-paused')).toBeVisible();
});

test('pages outside the game open in the browser tab, not over the game', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://github.com/srmcno/ShelfLife/issues/new/choose'; a.id = 'outside'; a.textContent = 'Report a problem';
    document.body.appendChild(a);
  });
  await page.locator('#outside').click();
  await expect.poll(async () => (await calls(page, 'Browser', 'open')).map(c => c.url)).toEqual(['https://github.com/srmcno/ShelfLife/issues/new/choose']);
  expect(page.url()).toMatch(/localhost:\d+\/$/);
});
