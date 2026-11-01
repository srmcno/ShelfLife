import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';

test.use({ serviceWorkers:'block', viewport:{width:320,height:740} });
test('friends see the paper, react, and hostile names remain text', async ({ page }, testInfo) => {
  test.skip(!['desktop-chromium','desktop-firefox'].includes(testInfo.project.name), 'One browser project covers the phone-sized paper.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'<img src=x onerror=y>',shelf);
  await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true); await writer.social.publish({force:true});
  await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000001',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#tabMore').click(); await page.locator('#friendsBtn').click();
  const paper=page.locator('[data-fr-section="gazette"]');
  await expect(paper).toContainText('<img src=x onerror=y>');
  await expect(paper.locator('img')).toHaveCount(0);
  await expect(paper.locator('.gz-portrait')).toHaveCount(1);
  await paper.locator('[data-sticker="moth"]').click();
  await expect(paper.locator('[data-sticker="moth"]')).toHaveAttribute('aria-pressed','true');
  await expect(paper.locator('[data-sticker="moth"]')).toContainText('1');
  const feed=await writer.cloud.rpc('gazette_feed'); expect(feed.events[0].counts.moth).toBe(1);
  await paper.locator('[data-sx="gazette-sharing"]').click();
  await expect(paper.locator('[data-sx="gazette-sharing"]')).toHaveAttribute('aria-checked','false');
  await paper.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('gazette-320.png') });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('news starts after sign-in, while replacing a shelf is baselined', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers save event integration.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const player=await socialPlayer(fake,'',shelf,{social:false});
  await page.addInitScript(({config,shelf,session})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session}));
  },{config:fake.config,shelf,session:player.session});
  await page.route(fake.url+'/**',route=>fake.route(route));
  await page.goto('/'); await expect(page.locator('#cabinet .piece.pet')).toHaveCount(3);
  await page.evaluate(async()=>{ const game=await import('/src/state.js'); game.state.pets.push({...structuredClone(game.state.pets[0]),id:'new-guest'}); game.save(); });
  await expect.poll(()=>fake.calls('gazette_post').length).toBe(1);
  expect(fake.calls('gazette_post')[0].body).toContain('new-guest');
  await page.evaluate(async()=>{ const game=await import('/src/state.js'); game.state.pets.push({...structuredClone(game.state.pets[0]),id:'from-backup'}); window.dispatchEvent(new CustomEvent('shelflife:state-replaced')); game.save(); });
  await page.waitForTimeout(500);
  expect(fake.calls('gazette_post').length).toBe(1);
});
