// A fresh browser proves that the published revision boots, saves and serves
// its illustrated room offline. It never reads or modifies a player's shelf.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from 'playwright/test';

const base = new URL(process.env.PAGES_URL || 'https://srmcno.github.io/ShelfLife/');
const revision = process.env.EXPECTED_REVISION || process.argv[2];
assert.match(revision || '', /^[a-f0-9]{40}$/, 'Supply the exact expected release revision');
assert.equal(base.protocol, 'https:');
let deployed;
for (let attempt = 0; attempt < 10; attempt++) {
  const url = new URL('release.json', base); url.searchParams.set('verify', revision + '-' + attempt);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (response.ok) deployed = await response.json();
  } catch (error) { console.log('Release edge not ready:', error.message); }
  if (deployed?.revision === revision) break;
  if (attempt < 9) await new Promise(resolve => setTimeout(resolve, 12000));
}
assert.equal(deployed?.revision, revision, 'Pages must serve the revision this workflow deployed');
await mkdir('live-check-results', { recursive: true });
const browser = await chromium.launch();
try {
  for (const mobile of [false, true]) {
    const label = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1440,height:1000}, isMobile:mobile,hasTouch:mobile,timezoneId:'America/Chicago' });
    const page = await context.newPage(), errors=[];
    page.setDefaultTimeout(15000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    const saved = () => page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')));
    try {
      const url=new URL(base);url.searchParams.set('verify',revision);
      await page.goto(url.href);await page.locator('[data-arrival="mabel"]').click();await page.locator('#quickAdopt').click();
      await expect(page.locator('#cabinet .pet')).toHaveCount(1);
      await page.locator('#tabPlay').click();await page.locator('[data-game="stack"]').click();
      await expect(page.locator('#toast')).not.toHaveClass(/show/);
      await page.locator('#arcadeSheet [data-ar="play"]').click();await page.keyboard.press('Space');
      await expect(page.locator('#arcadeSheet [data-ar-score]')).toHaveText('1');
      await page.screenshot({path:'live-check-results/'+label+'-arcade.png'});
      await page.locator('#arcadeSheet [data-ar="close"]').click();await expect(page.locator('#arcadeVeil')).not.toBeVisible();
      await page.locator('#tabPlay').click();await expect(page.locator('#playroomVeil')).toBeVisible();await page.locator('#playroomVeil [data-activity="outing"]').click();
      await page.locator('[data-life="set-out"]').click();await page.locator('[data-life="outing-choice"][data-choice="0"]').click();
      await expect(page.locator('.expedition-cast')).toHaveCSS('opacity','1');
      await page.screenshot({path:'live-check-results/'+label+'-expedition.png'});
      await expect(page.locator('[data-life="continue-outing"]')).toBeVisible();assert.equal((await saved()).life.outing.step,1);
      await page.locator('#lifeClose').click();await expect(page.locator('#playroomVeil')).toBeVisible();await page.locator('#playroomClose').click();
      await page.locator('.tabbar .tab[data-tab="notes"]').click();await page.locator('[data-filter="papers"]').click();
      await page.locator('[data-file-report]').click();await expect(page.locator('.document-title')).toHaveText('The household register');
      await expect(page.locator('#notes .note').first()).toHaveCSS('opacity','1');
      await page.screenshot({path:'live-check-results/'+label+'-paperwork.png',fullPage:true});
      await page.reload();await expect(page.locator('#cabinet .pet')).toHaveCount(1);
      assert.equal((await saved()).paperwork.entries.length,1);assert.equal((await saved()).life.outing.step,1);
      await page.locator('.tabbar .tab[data-tab="shelf"]').click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.evaluate(()=>navigator.serviceWorker.ready);
      await expect.poll(()=>page.evaluate(()=>caches.keys())).toContain('shelflife-'+revision.slice(0,12));
      await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
      await context.setOffline(true);await page.reload();await expect(page.locator('#cabinet .pet')).toHaveCount(1);
      assert.equal((await saved()).paperwork.entries.length,1);
      const font = await page.evaluate(async()=>{const response=await fetch(new URL('assets/fonts/gloock-400-normal.woff2',document.baseURI));return response.ok&&(await response.arrayBuffer()).byteLength>1000;});
      assert.ok(font,'The installed fonts must be readable offline');assert.deepEqual(errors,[]);
      console.log(JSON.stringify({viewport:label,revision,arcade:'real drop',expedition:'saved first stop',paperwork:'persisted',offline:'saved game and fonts',errors}));
    } catch(error) {
      await page.screenshot({path:'live-check-results/'+label+'-failure.png',fullPage:true}).catch(()=>{});
      throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
