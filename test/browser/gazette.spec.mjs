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

test('reopening Friends fetches news published after an empty paper was loaded', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers feed refresh.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'Beatrice',shelf);
  await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true);
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  await page.goto('/'); await page.locator('#tabFriends').click();
  const paper=page.locator('[data-fr-section="gazette"]');
  await expect(paper).toContainText('No news.');
  await expect.poll(()=>fake.calls('gazette_feed').length).toBeGreaterThan(0);
  await page.locator('#friendsSheet [data-fr="close"]').click();
  await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000009',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
  await page.locator('#tabFriends').click();
  await expect(paper).toContainText('Beatrice');
});

test('new unread news refreshes an open paper on the next check', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers polling.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'Beatrice',shelf);
  await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true);
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  await page.goto('/'); await page.locator('#tabFriends').click();
  const paper=page.locator('[data-fr-section="gazette"]');
  await expect(paper).toContainText('No news.');
  await expect.poll(()=>fake.calls('gazette_seen').length).toBeGreaterThan(0);
  await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000011',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(paper).toContainText('Beatrice');
});

for (const destination of ['postbox', 'directory', 'profile']) {
  test(`news stays unread while the ${destination} is open`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers unread state.');
    const fake=createFakeSupabase(), shelf=householdFixture('established');
    shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
    const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'Beatrice',shelf);
    await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true);
    await page.addInitScript(({config,shelf,session,id})=>{
      globalThis.SHELFLIFE_CLOUD_CONFIG=config;
      localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
      localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
    },{config:fake.config,shelf,session:reader.session,id:reader.id});
    await page.route(fake.url+'/**',route=>fake.route(route));
    await page.goto('/'); await page.locator('#tabFriends').click();
    await expect(page.locator('[data-fr-section="gazette"]')).toContainText('No news.');
    await expect.poll(()=>fake.calls('gazette_seen').length).toBeGreaterThan(0);
    await page.waitForTimeout(30);
    if (destination === 'postbox') await page.locator('#friendsSheet [data-fr="postbox"]').click();
    else if (destination === 'directory') await page.locator('#friendsSheet [data-sx="discovery-open"]').click();
    else await page.locator('#friendsSheet [data-fr="profile"]').click();
    const back=page.locator(destination === 'directory' ? '#friendsSheet [data-fr="custom-back"]' : '#friendsSheet [data-fr="back"]');
    await expect(back).toBeVisible();
    await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000012',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
    const seen=fake.calls('gazette_seen').length, checks=fake.calls('gazette_unread').length;
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(()=>fake.calls('gazette_unread').length).toBeGreaterThan(checks);
    await page.waitForTimeout(250);
    await expect.poll(()=>reader.cloud.rpc('gazette_unread')).toBe(1);
    expect(fake.calls('gazette_seen')).toHaveLength(seen);
    await back.click();
    await expect(page.locator('[data-fr-section="gazette"]')).toContainText('Beatrice');
    await expect.poll(()=>reader.cloud.rpc('gazette_unread')).toBe(0);
  });
}

test('a backgrounded Friends home does not repeatedly request the paper', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers background polling.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf);
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
    globalThis.__gazetteHidden=true;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>globalThis.__gazetteHidden});
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  await page.goto('/'); await page.locator('#tabFriends').click();
  await expect(page.locator('[data-fr-section="gazette"]')).toBeAttached();
  await page.waitForTimeout(400);
  expect(fake.calls('gazette_feed').length).toBeLessThanOrEqual(1);
  expect(fake.calls('gazette_seen')).toHaveLength(0);
  await page.evaluate(()=>{globalThis.__gazetteHidden=false; document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>fake.calls('gazette_seen').length).toBeGreaterThan(0);
  await expect(page.locator('[data-fr-section="gazette"]')).toContainText('No news.');
});

test('reacting on a profile keeps its news visible without marking the whole feed read', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers profile reactions.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'Beatrice',shelf);
  await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true);
  await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000014',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  await page.goto('/'); await page.locator('#tabFriends').click();
  await expect(page.locator('[data-fr-section="gazette"]')).toContainText('Beatrice');
  await expect.poll(()=>fake.calls('gazette_seen').length).toBeGreaterThan(0);
  await page.locator('#friendsSheet [data-fr="profile"]').click();
  const paper=page.locator('[data-fr-section="gazette-profile"]');
  await expect(paper).toContainText('Beatrice');
  const seen=fake.calls('gazette_seen').length;
  await paper.locator('[data-sticker="skull"]').click();
  await expect(paper.locator('[data-sticker="skull"]')).toHaveAttribute('aria-pressed','true');
  await expect(paper).toContainText('Beatrice');
  expect(fake.calls('gazette_seen')).toHaveLength(seen);
});

test('leaving the paper while news is loading keeps that news unread', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers the in-flight navigation race.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'Beatrice',shelf);
  await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true);
  await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000013',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  let release, firstRequest;
  const waiting=new Promise(resolve=>{firstRequest=resolve;}), gate=new Promise(resolve=>{release=resolve;});
  let feeds=0;
  await page.route(fake.url+'/rest/v1/rpc/gazette_feed',async route=>{
    if (++feeds===1) { firstRequest(); await gate; }
    await fake.route(route);
  });
  try {
    await page.goto('/'); await page.locator('#tabFriends').click(); await waiting;
    await page.locator('#friendsSheet [data-fr="postbox"]').click();
    await expect(page.locator('#friendsSheet [data-fr="back"]')).toBeVisible();
    release();
    await expect.poll(()=>fake.calls('gazette_feed').length).toBeGreaterThan(0);
    await page.waitForTimeout(250);
    expect(fake.calls('gazette_seen')).toHaveLength(0);
    expect(await reader.cloud.rpc('gazette_unread')).toBe(1);
    await page.locator('#friendsSheet [data-fr="back"]').click();
    await expect(page.locator('[data-fr-section="gazette"]')).toContainText('Beatrice');
    await expect.poll(()=>reader.cloud.rpc('gazette_unread')).toBe(0);
  } finally { release(); }
});

test('replacing a shelf while a feed request is pending starts a fresh request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers shelf replacement.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  const reader=await socialPlayer(fake,'Reader',shelf), writer=await socialPlayer(fake,'Beatrice',shelf);
  await reader.social.addFriend(writer.code); await writer.social.respond(reader.id,true);
  await writer.cloud.rpc('gazette_post',{p_events:[{key:'10000000-0000-4000-8000-000000000010',kind:'adopted',data:{resident:shelf.pets[0].id},generation:0}]});
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:reader.session,id:reader.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  let release, firstRequest;
  const waiting=new Promise(resolve=>{firstRequest=resolve;}), gate=new Promise(resolve=>{release=resolve;});
  let feeds=0;
  await page.route(fake.url+'/rest/v1/rpc/gazette_feed',async route=>{
    if (++feeds===1) { firstRequest(); await gate; }
    await fake.route(route);
  });
  try {
    await page.goto('/'); await page.locator('#tabFriends').click(); await waiting;
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('shelflife:state-replaced')));
    await expect.poll(()=>feeds).toBeGreaterThan(1);
    await expect(page.locator('[data-fr-section="gazette"]')).toContainText('Beatrice');
  } finally { release(); }
});
