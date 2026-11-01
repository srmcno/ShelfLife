#!/usr/bin/env node
// Local, repeatable visual crawl. Results are evidence for review, not a substitute
// for the browser tests. The fake cloud never contacts the production service.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { householdFixture } from '../test/household-fixtures.mjs';
import { createFakeSupabase } from '../test/support/fake-supabase.mjs';
import { socialPlayer, pageSession } from '../test/support/social-world.mjs';
import { generateCreature } from '../src/art/creatures.js';

const port = Number(process.env.SHELF_PREVIEW_PORT || 4175);
const base = `http://localhost:${port}`;
const destination = process.env.QA_CRAWL_OUTPUT || join(tmpdir(), 'shelflife-qa-crawl');
await mkdir(destination, { recursive: true });
const server = spawn(process.execPath, ['test/serve.mjs'], { env: { ...process.env, SHELF_PREVIEW_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
for (let n = 0; n < 100; n++) {
  if (server.exitCode !== null) throw new Error('Preview server failed: ' + serverOutput);
  try { if ((await fetch(base)).ok) break; } catch {}
  if (n === 99) throw new Error('Preview server did not start: ' + serverOutput);
  await new Promise(resolve => setTimeout(resolve, 100));
}
const report = { generatedAt: new Date().toISOString(), base, runs: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768, 1440]) for (const mode of ['local', 'cloud', 'guest']) {
    const run = { width, mode, console: [], pageErrors: [], failedRequests: [], outsideRequests: [], httpErrors: [], policyViolations: [], navigationErrors: [], checks: [] };
    report.runs.push(run);
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 800 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type()) && !msg.text().includes('Service Worker registration blocked')) run.console.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', err => run.pageErrors.push(err.message));
    page.on('requestfailed', req => run.failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
    page.on('request', req => { if (!req.url().startsWith(base) && !req.url().startsWith('blob:' + base) && (!fake || !req.url().startsWith(fake.url))) run.outsideRequests.push(req.url()); });
    page.on('response', res => { if (res.status() >= 400) run.httpErrors.push({ url: res.url(), status: res.status() }); });
    await page.exposeFunction('qaPolicyViolation', event => run.policyViolations.push(event));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => globalThis.qaPolicyViolation({ directive: event.effectiveDirective, blocked: event.blockedURI })));
    const snapshot = householdFixture('established');
    snapshot.settings.theatreOn = false;
    snapshot.lastBackup = Date.now();
    let fake, session;
    if (mode !== 'local') {
      fake = createFakeSupabase();
      const ada = await socialPlayer(fake, 'Ada');
      const portrait = seed => ({ id: seed, name: seed, traits: ['damp'], needs: { food: 80, fuss: 80, clean: 80 }, bond: 4, art: { body: '', stamps: [], creature: generateCreature({ seed }) } });
      const bea = await socialPlayer(fake, 'Bea', { pets: [portrait('Gladys')] });
      const cat = await socialPlayer(fake, 'Cat', { pets: [portrait('Snag')] });
      await bea.social.publish({ force: true });
      await cat.social.publish({ force: true });
      await ada.social.addFriend(bea.code); await bea.social.respond(ada.id, true);
      await ada.social.addFriend(cat.code); await cat.social.respond(ada.id, true);
      if (mode === 'cloud') session = pageSession(ada);
      await page.route(fake.url + '/**', route => fake.route(route));
    }
    await page.addInitScript(({ snapshot, config, session }) => {
      if (config) globalThis.SHELFLIFE_CLOUD_CONFIG = config;
      if (!sessionStorage.getItem('qa-crawl-seeded')) {
        localStorage.setItem('shelflife.v4', JSON.stringify(snapshot));
        if (session) localStorage.setItem('shelflife.cloud', session);
        sessionStorage.setItem('qa-crawl-seeded', '1');
      }
    }, { snapshot, config: fake?.config || null, session: session || null });
    const click = async selector => {
      const el = page.locator(selector).first();
      if (!await el.isVisible().catch(() => false) || !await el.isEnabled().catch(() => false)) return false;
      await el.click({ timeout: 8000 });
      await page.waitForTimeout(120);
      return true;
    };
    const close = async () => {
      for (let i = 0; i < 6 && await page.locator('.veil.open, #moreTray.open').count(); i++) {
        await page.keyboard.press('Escape'); await page.waitForTimeout(100);
        const court = page.locator('#courtVeil.open');
        if (await court.count()) {
          const control = court.locator('[data-sc="close"], [data-jc="lobby"]').filter({ visible: true }).first();
          if (await control.count()) await control.click({ timeout: 2000 }).catch(() => {});
        }
      }
    };
    const capture = async name => {
      await page.waitForTimeout(120);
      const result = await page.evaluate(() => {
        const issues = { horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : null, pokes: [], clippedText: [], badText: [], brokenImages: [], smallTargets: [], overlaps: [] };
        const label = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '')) + ' ' + (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0 && !el.closest('[hidden], .sr-only, [aria-hidden="true"]'); };
        const scrolled = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX + ' ' + s.overflowY) && (p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1)) return true; } return false; };
        const openVeils = [...document.querySelectorAll('.veil.open')];
        const activeSurface = openVeils.at(-1) || document.querySelector('#moreTray.open');
        const els = [...(activeSurface || document.body).querySelectorAll('*')].filter(visible);
        for (const el of els) {
          const rect = el.getBoundingClientRect(), s = getComputedStyle(el);
          if ((rect.right > innerWidth + 1 || rect.left < -1) && !scrolled(el) && !el.closest('svg, canvas')) issues.pokes.push({ element: label(el), left: Math.round(rect.left), right: Math.round(rect.right) });
          if (el.tagName === 'IMG' && (!el.complete || !el.naturalWidth)) issues.brokenImages.push(label(el));
          if (innerWidth <= 390 && el.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button]') && (rect.width < 30 || rect.height < 30)) issues.smallTargets.push({ element: label(el), width: Math.round(rect.width), height: Math.round(rect.height) });
          for (const child of el.childNodes) if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            const text = child.textContent.trim();
            if (/(?:^|\s)(?:undefined|NaN|null)(?:\s|$)|\[object Object\]/.test(text)) issues.badText.push({ element: label(el), text: text.slice(0, 120) });
            if (/hidden|clip/.test(s.overflowX + ' ' + s.overflowY) && s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none') {
              const range = document.createRange(); range.selectNodeContents(child);
              for (const r of range.getClientRects()) if (r.left < rect.left - 1 || r.right > rect.right + 1 || r.bottom > rect.bottom + 1 || r.top < rect.top - 1) { issues.clippedText.push({ element: label(el), text: text.slice(0, 80) }); break; }
            }
          }
        }
        const buttons = els.filter(el => el.matches('button, [role=button]') && !el.disabled);
        for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
          const a = buttons[i], b = buttons[j]; if (a.contains(b) || b.contains(a) || a.closest('.sheet-foot, .sheet-footer') || b.closest('.sheet-foot, .sheet-footer')) continue;
          const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
          const w = Math.min(x.right, y.right, innerWidth) - Math.max(x.left, y.left, 0), h = Math.min(x.bottom, y.bottom, innerHeight) - Math.max(x.top, y.top, 0);
          if (w > 2 && h > 2) issues.overlaps.push({ a: label(a), b: label(b), width: Math.round(w), height: Math.round(h) });
        }
        return issues;
      });
      const screenshot = `${destination}/${width}-${mode}-${name.replace(/[^a-z0-9-]+/gi, '-')}.png`;
      await page.screenshot({ path: screenshot, animations: 'disabled' });
      run.checks.push({ name, screenshot, ...result });
    };
    const step = async (name, fn) => { try { await fn(); await capture(name); } catch (err) { run.navigationErrors.push({ name, error: err.message }); await close().catch(() => {}); } };
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#cabinet .piece.pet').first().waitFor({ timeout: 15000 });
      await step('shelf', async () => {});
      for (const tab of ['plots', 'notes', 'shelf']) await step('tab-' + tab, async () => { await close(); await click(`.tabbar [data-tab="${tab}"]`); });
      await step('more', async () => { await close(); await click('#tabMore'); });
      const moreItems = ['helpBtn','almanacBtn','collectionsBtn','exchangeBtn','decorBtn','incidentsBtn','museumBtn','postcardBtn','cloudBtn','feedbackBtn','transferBtn','voiceBtn','exportBtn','importBtn','recoveryBtn','installBtn'];
      for (const id of moreItems) { if (!await page.locator('#' + id).count()) continue; await close(); await click('#tabMore'); if (!await page.locator('#' + id).isVisible()) continue; await step('more-' + id, async () => { if (!await click('#' + id)) throw new Error('Unavailable'); }); }
      for (const id of ['calmBtn', 'muteBtn', 'narratorBtn', 'hapticsBtn', 'nudgeBtn']) await step('setting-' + id, async () => { await close(); await click('#tabMore'); if (!await page.locator('#' + id).isVisible()) return; await click('#' + id); await click('#' + id); });
      await step('playroom', async () => { await close(); await click('#tabPlay'); });
      for (const id of await page.locator('#playroomVeil [data-game]').evaluateAll(els => els.map(el => el.dataset.game))) {
        await step('game-' + id, async () => { await close(); await click('#tabPlay'); await click(`#playroomVeil [data-game="${id}"]`); await click('#arcadeSheet [data-ar="play"]'); });
      }
      for (const [name, selector] of [['court','#playroomVeil [data-court]'], ['expedition','#playroomVeil [data-activity="outing"]'], ['studio','#newPetBtn'], ['rounds','#roundsBtn']]) await step(name, async () => { await close(); if (name === 'court' || name === 'expedition') await click('#tabPlay'); if (!await click(selector)) throw new Error('Unavailable: ' + selector); });
      if (fake) {
        const openFriends = async () => { await close(); if (!await click('#tabFriends')) { await click('#tabMore'); await click('#friendsBtn'); } };
        await step('friends', async () => { await openFriends(); await page.waitForTimeout(500); });
        if (mode === 'cloud') {
          await step('postbox', async () => { await click('#friendsSheet [data-fr="postbox"]'); });
          await step('friend-profile', async () => { await openFriends(); await page.waitForTimeout(400); if (!await click('#friendsSheet [data-fr="profile"]')) throw new Error('Friend profile unavailable'); });
          const actions = await page.locator('#friendsSheet [data-fr-action]').evaluateAll(els => els.map(el => el.dataset.frAction));
          for (const action of actions) await step('friend-action-' + action, async () => { await openFriends(); await page.waitForTimeout(200); await click('#friendsSheet [data-fr="profile"]'); await page.waitForTimeout(100); await click(`#friendsSheet [data-fr-action="${action}"]`); });
        }
      }
    } catch (err) { run.navigationErrors.push({ name: 'setup', error: err.message }); }
    await context.close();
    await writeFile(`${destination}/report.json`, JSON.stringify(report, null, 2));
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${destination}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`Report: ${destination}/report.json`);
for (const run of report.runs) console.log(`${run.width} ${run.mode}: ${run.checks.length} views, ${run.console.length} console, ${run.pageErrors.length} page errors, ${run.failedRequests.length} failed requests, ${run.navigationErrors.length} unavailable views`);
