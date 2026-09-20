import { test, expect } from 'playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf' };

test('first install stays silent, a later real worker update offers refresh and preserves the household', async ({ page, browserName }) => {
  // Keep the same Chromium-only service-worker coverage boundary as the offline
  // regression. This is not a claim about installed Safari/iOS update behavior.
  test.skip(browserName !== 'chromium', 'Playwright service-worker tooling is supported on Chromium only');
  test.setTimeout(60_000);
  let edition = 1;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // An ephemeral origin isolates actual browser registrations/caches. Serve the
  // real app and worker; change only its release token in the HTTP response.
  // No repository assets, worker APIs, or application state are mocked/mutated.
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const filename = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      if (!filename.startsWith(root)) { response.writeHead(403); response.end(); return; }
      let bytes = await readFile(filename);
      if (pathname === '/service-worker.js') {
        bytes = Buffer.from(bytes.toString().replace(/const CACHE_VERSION = '[^']+';/, `const CACHE_VERSION = 'shelflife-update-test-${edition}';`));
      }
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await page.goto(`http://localhost:${server.address().port}/`);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('#updateBanner')).toBeHidden();
    expect(await page.evaluate(() => caches.keys())).toContain('shelflife-update-test-1');

    await page.locator('[data-arrival]').first().click();
    await page.locator('#quickAdopt').click();
    await page.locator('#tabMore').click();
    await page.locator('#decorBtn').click();
    await page.locator('#roomOpts').getByRole('button', { name: 'Bone Parlor', exact: true }).click();
    await page.locator('#woodOpts').getByRole('button', { name: 'Moss', exact: true }).click();
    await page.locator('#decorClose').click();
    const saved = () => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shelflife.v4'));
      return { resident: { id: state.pets[0].id, name: state.pets[0].name, art: state.pets[0].art }, decor: state.decor, slots: state.slots };
    });
    const before = await saved();

    edition = 2;
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 20_000 }).toEqual(['shelflife-update-test-2']);
    await expect(page.locator('#updateBanner')).toBeVisible();
    await Promise.all([page.waitForEvent('load'), page.locator('#refreshGame').click()]);
    await expect(page.locator('#cabinet .pet')).toHaveCount(1);
    await expect(page.locator('#updateBanner')).toBeHidden();
    expect(await saved()).toEqual(before);
    expect(errors).toEqual([]);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
