// Moving house for real: two builds on two addresses, the old one naming the
// new as its home (SHELFLIFE_MOVE_TO), the new one naming the old as where
// shelves come from (SHELFLIFE_MOVE_FROM). The player only opens the old link.
import { test, expect } from 'playwright/test';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { householdFixture } from '../household-fixtures.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const OLD_PORT = 4301, NEW_PORT = 4302;
const OLD = `http://localhost:${OLD_PORT}/ShelfLife/`, NEW = `http://127.0.0.1:${NEW_PORT}/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const servers = [];

function build(dir, env) {
  execFileSync('python3', ['-c', `import sys; sys.path.insert(0, 'scripts'); import build_site; build_site.build(${JSON.stringify(dir)})`],
    { cwd: ROOT, env: { ...process.env, SHELFLIFE_MOVE_TO: '', SHELFLIFE_MOVE_FROM: '', ...env }, stdio: 'ignore' });
}
function serve(dir, port, prefix) {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!pathname.startsWith(prefix)) { res.writeHead(404); return res.end(); }
      pathname = pathname.slice(prefix.length - 1);
      const file = path.resolve(dir, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      if (!file.startsWith(dir) || !(await stat(file)).isFile()) { res.writeHead(404); return res.end(); }
      let body = await readFile(file);
      // Never the real cloud project from a test.
      if (file.endsWith(path.join('src', 'cloud', 'config.js'))) body = Buffer.from(String(body).replace(/export const CLOUD_CONFIG = \{[^}]*\};/, "export const CLOUD_CONFIG = { url: '', anonKey: '' };"));
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise(resolve => server.listen(port, () => { servers.push(server); resolve(); }));
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  const oldDir = path.join(ROOT, 'test-results', 'move-old'), newDir = path.join(ROOT, 'test-results', 'move-new');
  build(oldDir, { SHELFLIFE_MOVE_TO: NEW });
  build(newDir, { SHELFLIFE_MOVE_FROM: OLD });
  await serve(oldDir, OLD_PORT, '/ShelfLife/');
  await serve(newDir, NEW_PORT, '/');
});
test.afterAll(async () => { await Promise.all(servers.map(s => new Promise(r => s.close(r)))); });

const seed = async (page, base, entries) => {
  await page.goto(base + 'privacy.html');
  await page.evaluate(e => { for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v); }, entries);
};
const read = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
// The game ticks and saves as soon as it opens, so compare who lives there.
const residents = async (page, key = 'shelflife.v4') => (JSON.parse(await read(page, key) || 'null')?.pets || []).map(p => p.name);
const household = (names, now) => {
  const s = householdFixture('established', now);
  s.pets = s.pets.slice(0, names.length).map((p, i) => ({ ...p, name: names[i] }));
  s.slots = s.slots.map(id => s.pets.some(p => p.id === id) ? id : null);
  return JSON.stringify(s);
};

test('opening the old link carries the whole household to the new address by itself, then always redirects', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-chromium' && info.project.name !== 'mobile-chromium', 'Chromium projects');
  const context = await browser.newContext();
  const page = await context.newPage();
  const now = Date.now();
  const save = household(['Mabel', 'Grubbs', 'Pip'], now);
  // A drawing-sized extra that does not compress, so the move takes several hops.
  const recovery = randomBytes(700000).toString('base64');
  await seed(page, OLD, { 'shelflife.v4': save, 'shelflife.v4.recovery': recovery, 'shelflife.tab': 'court' });

  await page.goto(OLD + '?invite=ABC123');
  await page.waitForURL(NEW + '?invite=ABC123', { timeout: 20000 });
  expect(await residents(page)).toEqual(['Mabel', 'Grubbs', 'Pip']);
  expect(await read(page, 'shelflife.v4.recovery')).toBe(recovery);
  await expect(page.locator('#toast')).toContainText('Your shelf moved to its new address', { timeout: 8000 });
  // Nothing left half-written, and the old address still holds its copy.
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('shelflife-move.in.')))).toEqual([]);

  // From now on the old link goes straight there.
  await page.goto(OLD + 'privacy.html');
  expect(await residents(page)).toEqual(['Mabel', 'Grubbs', 'Pip']);
  await page.goto(OLD);
  await page.waitForURL(NEW, { timeout: 8000 });
  await context.close();
});

test('a shelf already started at the new address is kept as a spare, never overwritten', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'once');
  const context = await browser.newContext();
  const page = await context.newPage();
  const now = Date.now();
  const real = household(['Mabel', 'Grubbs', 'Pip'], now - 86400000);
  const startedHere = household(['Newbie'], now);
  await seed(page, NEW, { 'shelflife.v4': startedHere });
  await seed(page, OLD, { 'shelflife.v4': real });
  await page.goto(OLD);
  await page.waitForURL(NEW, { timeout: 20000 });
  expect(await residents(page)).toEqual(['Mabel', 'Grubbs', 'Pip']);
  expect(await residents(page, 'shelflife.v4.beforemove')).toEqual(['Newbie']);
  expect(await residents(page, 'shelflife.v4.beforecloud')).toEqual(['Newbie']);
  await expect(page.locator('#toast')).toContainText('kept as a spare', { timeout: 8000 });
  await context.close();
});

test('the new address ignores a move that does not come from the old address', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'once');
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(NEW + 'move.html#m=1&sha=' + 'a'.repeat(64) + '&i=0&n=1&d=rAAAA');
  await page.waitForURL(NEW, { timeout: 8000 });
  expect(await residents(page)).toEqual([], 'only the empty shelf the game makes on a first visit');
  expect(await read(page, 'shelflife-move.applied')).toBe(null);
  await context.close();
});

test('offline, the old address just plays; a broken new address leaves the old one playable', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'once');
  const context = await browser.newContext();
  const page = await context.newPage();
  const save = household(['Mabel'], Date.now());
  await seed(page, OLD, { 'shelflife.v4': save });
  await context.route(NEW + '**', route => route.abort());
  await page.goto(OLD);
  // The hop fails; the next visits stop trying for the hour and the game plays where it is.
  for (let i = 0; i < 4; i++) { await page.goto(OLD + '?stay=1').catch(() => {}); }
  await page.goto(OLD + '?stay=1');
  await expect(page).toHaveURL(OLD + '?stay=1');
  expect(await read(page, 'shelflife.v4')).toBeTruthy();
  await context.close();
});
