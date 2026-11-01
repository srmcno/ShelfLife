import { test, expect } from 'playwright/test';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer } from '../support/social-world.mjs';
import { householdFixture } from '../household-fixtures.mjs';

test.use({ serviceWorkers: 'block', viewport: { width:320, height:740 } });
async function boot(page, fake, player) {
  const shelf=householdFixture('established'); shelf.settings.theatreOn=false; shelf.settings.calm=true; shelf.lastBackup=Date.now();
  await page.addInitScript(({config,shelf,session,id})=>{
    globalThis.SHELFLIFE_CLOUD_CONFIG=config;
    localStorage.setItem('shelflife.v4',JSON.stringify(shelf));
    localStorage.setItem('shelflife.cloud',JSON.stringify({session,socialUser:id}));
  },{config:fake.config,shelf,session:player.session,id:player.id});
  await page.route(fake.url+'/**',route=>fake.route(route));
  await page.goto('/'); await page.locator('#tabFriends').click();
  await expect(page.locator('[data-sx="discovery-open"]')).toBeVisible();
}

test('browse, search and request only opted-in players; listing remains optional',async({page},info)=>{
  test.skip(!['desktop-chromium','desktop-firefox'].includes(info.project.name),'One desktop project checks the phone layout.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  const publicPlayer=await socialPlayer(fake,'<img src=x onerror=y>'), hidden=await socialPlayer(fake,'Hidden Player');
  await publicPlayer.cloud.rpc('discovery_set',{p_on:true});
  await boot(page,fake,reader);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory).toContainText('<img src=x onerror=y>');
  await expect(directory).not.toContainText('Hidden Player');
  await expect(directory.locator('img')).toHaveCount(0);
  await directory.locator('.di-list').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('directory-results-320.png')});
  expect(await reader.cloud.rpc('discovery_status')).toEqual({listed:false,nearby:false});
  await directory.locator('#diQuery').fill('no match'); await directory.locator('button[type="submit"]').click();
  await expect(directory).toContainText('No players found');
  await directory.locator('#diQuery').fill(''); await directory.locator('button[type="submit"]').click();
  await expect(directory).toContainText('<img src=x onerror=y>');
  await directory.locator('[data-sx="discovery-request"]').click();
  await expect(directory).toContainText('Friend request sent.');
  const inbox=await publicPlayer.social.friends();
  expect(inbox.some(f=>f.userId===reader.id && f.status==='pending')).toBe(true);
  expect((await publicPlayer.cloud.rpc('list_friends'))[0].friend_code).toBe('');
  expect((await reader.cloud.rpc('list_friends'))[0].friend_code).toBe('');
  await directory.locator('[data-sx="discovery-toggle"]').click();
  await expect(directory).toContainText('Your display name is listed.');
  expect((await hidden.cloud.rpc('discovery_find')).players.map(p=>p.display_name)).toContain('Reader');
  await directory.locator('[data-sx="discovery-toggle"]').click();
  await expect(directory).toContainText('Your listing has been removed.');
  expect((await hidden.cloud.rpc('discovery_find')).players.map(p=>p.display_name)).not.toContain('Reader');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await directory.scrollIntoViewIfNeeded(); await page.screenshot({path:info.outputPath('directory-320.png')});
  await page.locator('[data-fr="custom-back"]').click();
  await expect(page.locator('#friendsSheet')).toContainText('<img src=x onerror=y>');
  await expect(page.locator('#friendsSheet img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a delayed result cannot reopen the directory after an account change',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers account switching.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader'), other=await socialPlayer(fake,'Neighbour');
  await other.cloud.rpc('discovery_set',{p_on:true});
  await boot(page,fake,reader);
  let release, started; const held=new Promise(resolve=>release=resolve), seen=new Promise(resolve=>started=resolve);
  await page.route(fake.url+'/rest/v1/rpc/discovery_find',async route=>{ started(); await held; await fake.route(route); });
  await page.locator('[data-sx="discovery-open"]').click(); await seen;
  await page.evaluate(async()=>{ const {cloud}=await import('/src/cloud/index.js'); await cloud.signOut(); await cloud.signInAnonymously(); });
  release(); await page.waitForTimeout(300);
  await expect(page.locator('#friendsVeil')).toBeHidden();
  await page.locator('#tabFriends').click();
  await expect(page.locator('[data-fr-view="discovery"]')).toHaveCount(0);
  await expect(page.locator('#friendsSheet')).not.toContainText('Neighbour');
});

test('browsing is paginated and blocks hide listed players in both directions',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers directory pagination.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  const players=[];
  for(let i=0;i<25;i++) {
    const player=await socialPlayer(fake,'Neighbour '+String(i).padStart(2,'0'));
    await player.cloud.rpc('discovery_set',{p_on:true}); players.push(player);
  }
  await players[0].social.block(reader.id);
  await boot(page,fake,reader); await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory).toContainText('Neighbour 01');
  await expect(directory).not.toContainText('Neighbour 00');
  await expect(directory.locator('.di-list li')).toHaveCount(20);
  await directory.locator('[data-sx="discovery-next"]').click();
  await expect(directory).toContainText('Neighbour 24');
  await expect(directory.locator('.di-list li')).toHaveCount(4);
  await directory.locator('[data-sx="discovery-prev"]').click();
  await expect(directory).toContainText('Neighbour 01');
  await reader.social.block(players[1].id);
  await directory.locator('button[type="submit"]').click();
  await expect(directory).not.toContainText('Neighbour 01');
});

for (const mode of ['all','nearby']) test(`sending a request in ${mode} discovery refills the page without skipping players`,async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser checks both directory pagination modes.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  if(mode==='nearby') {
    await reader.cloud.rpc('discovery_set',{p_on:true});
    await reader.cloud.rpc('discovery_location_set',{p_lat_band:131,p_lon_band:140});
  }
  const players=[];
  for(let i=0;i<22;i++) {
    const player=await socialPlayer(fake,'Neighbour '+String(i).padStart(2,'0'));
    await player.cloud.rpc('discovery_set',{p_on:true});
    if(mode==='nearby') await player.cloud.rpc('discovery_location_set',{p_lat_band:131,p_lon_band:140});
    players.push(player);
  }
  await boot(page,fake,reader); await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  if(mode==='nearby') await directory.locator('[data-sx="discovery-nearby"]').click();
  await expect(directory.locator('.di-list li')).toHaveCount(20);
  await directory.locator('[data-sx="discovery-request"]').first().click();
  await expect(directory).toContainText('Friend request sent.');
  await expect(directory.locator('.di-list li')).toHaveCount(20);
  await expect(directory).toContainText('Neighbour 20');
  const firstPage=await directory.locator('[data-sx="discovery-request"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.user));
  await directory.locator('[data-sx="discovery-next"]').click();
  await expect(directory.locator('.di-list li')).toHaveCount(1);
  await expect(directory).toContainText('Neighbour 21');
  const lastPage=await directory.locator('[data-sx="discovery-request"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.user));
  expect([...firstPage,...lastPage].sort()).toEqual(players.slice(1).map(player=>player.id).sort());
  expect((await players[0].social.friends()).some(friend=>friend.userId===reader.id&&friend.status==='pending')).toBe(true);
});

test('a failed directory refill can retry without skipping players or resending the request',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser checks failed pagination recovery.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  for(let i=0;i<22;i++) {
    const player=await socialPlayer(fake,'Neighbour '+String(i).padStart(2,'0'));
    await player.cloud.rpc('discovery_set',{p_on:true});
  }
  await boot(page,fake,reader); await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory.locator('.di-list li')).toHaveCount(20);
  let failNext=true;
  await page.route(fake.url+'/rest/v1/rpc/discovery_find',async route=>{
    if(failNext) { failNext=false; await route.fulfill({status:503,contentType:'application/json',body:'{}'}); }
    else await fake.route(route);
  });
  await directory.locator('[data-sx="discovery-request"]').first().click();
  await expect(directory).toContainText('Friend request sent.');
  await expect(directory).toContainText('The directory is unavailable.');
  await expect(directory.locator('[data-sx="discovery-next"]')).toHaveCount(0);
  await directory.locator('[data-sx="discovery-retry"]').click();
  await expect(directory.locator('.di-list li')).toHaveCount(20);
  await expect(directory).toContainText('Neighbour 20');
  await directory.locator('[data-sx="discovery-next"]').click();
  await expect(directory).toContainText('Neighbour 21');
  await expect(directory.locator('.di-list li')).toHaveCount(1);
  expect(fake.calls('discovery_request')).toHaveLength(1);
});

test('nearby sharing sends only a broad area and can be removed',async({page,context},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers the location workflow.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader'), nearby=await socialPlayer(fake,'<img src=x onerror=y>');
  await nearby.cloud.rpc('discovery_set',{p_on:true});
  const lat=41.8781, lon=-87.6298, latBand=Math.floor(lat+90), columns=Math.floor(360*Math.cos((latBand-89.5)*Math.PI/180));
  const lonBand=Math.floor((lon+180)/360*columns);
  await nearby.cloud.rpc('discovery_location_set',{p_lat_band:latBand,p_lon_band:lonBand});
  await context.grantPermissions(['geolocation']); await context.setGeolocation({latitude:lat,longitude:lon});
  await boot(page,fake,reader);
  const sent=[];
  await page.route(fake.url+'/rest/v1/rpc/discovery_location_set',async route=>{sent.push(route.request().postDataJSON()); await fake.route(route);});
  await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory.locator('[data-sx="discovery-location"]')).toBeDisabled();
  await directory.locator('[data-sx="discovery-toggle"]').click();
  await expect(directory).toContainText('may infer your broad area');
  await expect(directory).toContainText('wait 24 hours to change or share an area again, even after removal');
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Your approximate area is shared.');
  await expect(directory).toContainText('<img src=x onerror=y>');
  await expect(directory).toContainText('Same broad area');
  await expect(directory.locator('img')).toHaveCount(0);
  await directory.locator('.di-privacy').last().scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('nearby-320.png')});
  expect(sent).toEqual([{p_lat_band:latBand,p_lon_band:lonBand}]);
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Your shared area has been removed.');
  expect(sent[1]).toEqual({p_lat_band:null,p_lon_band:null});
  expect(await reader.cloud.rpc('discovery_status')).toEqual({listed:true,nearby:false});
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Wait 24 hours after your last shared area');
  await directory.locator('[data-sx="discovery-toggle"]').click();
  await directory.locator('[data-sx="discovery-toggle"]').click();
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Wait 24 hours after your last shared area');
  expect((await reader.cloud.rpc('discovery_status')).nearby).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a location permission callback after account change cannot share an area',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers location account switching.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  await reader.cloud.rpc('discovery_set',{p_on:true});
  await boot(page,fake,reader); await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory.locator('[data-sx="discovery-location"]')).toBeEnabled();
  let sent=0; await page.route(fake.url+'/rest/v1/rpc/discovery_location_set',async route=>{sent++; await fake.route(route);});
  await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){window.releaseLocation=()=>success({coords:{latitude:41.8781,longitude:-87.6298}});}}}));
  await directory.locator('[data-sx="discovery-location"]').click();
  await page.waitForFunction(()=>typeof window.releaseLocation==='function');
  await page.evaluate(async()=>{ const {cloud}=await import('/src/cloud/index.js'); await cloud.signOut(); await cloud.signInAnonymously(); window.releaseLocation(); });
  await page.waitForTimeout(200);
  expect(sent).toBe(0);
});

test('location denial is recoverable and Android requests only coarse permission',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers permission handling.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  await reader.cloud.rpc('discovery_set',{p_on:true});
  await boot(page,fake,reader); await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory.locator('[data-sx="discovery-location"]')).toBeEnabled();
  await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail){fail({code:1});}}}));
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Location permission was denied.');
  expect((await reader.cloud.rpc('discovery_status')).nearby).toBe(false);
  await page.evaluate(()=>{
    window.nativeLocationCalls=[];
    window.Capacitor={isNativePlatform:()=>true,Plugins:{Geolocation:{
      requestPermissions:async args=>{window.nativeLocationCalls.push(args); return {coarseLocation:'granted'};},
      getCurrentPosition:async args=>{window.nativeLocationCalls.push(args); return {coords:{latitude:41.8781,longitude:-87.6298}};}
    }}};
  });
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Your approximate area is shared.');
  const calls=await page.evaluate(()=>window.nativeLocationCalls);
  expect(calls[0]).toEqual({permissions:['coarseLocation']});
  expect(calls[1].enableHighAccuracy).toBe(false);
});

test('offline and unavailable location have clear recovery states',async({page,context},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers unavailable location.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  await reader.cloud.rpc('discovery_set',{p_on:true});
  await boot(page,fake,reader); await page.locator('[data-sx="discovery-open"]').click();
  const directory=page.locator('[data-fr-view="discovery"]');
  await expect(directory.locator('[data-sx="discovery-location"]')).toBeEnabled();
  await context.setOffline(true);
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(page.locator('#friendsSheet')).toContainText('Go online to use this Friends action.');
  await context.setOffline(false);
  await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined}));
  await directory.locator('[data-sx="discovery-location"]').click();
  await expect(directory).toContainText('Location is unavailable');
  expect((await reader.cloud.rpc('discovery_status')).nearby).toBe(false);
});

test('an Android permission result after account change does not read location',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','One browser covers the Android account fence.');
  const fake=createFakeSupabase(), reader=await socialPlayer(fake,'Reader');
  await reader.cloud.rpc('discovery_set',{p_on:true}); await boot(page,fake,reader);
  await page.locator('[data-sx="discovery-open"]').click();
  await expect(page.locator('[data-sx="discovery-location"]')).toBeEnabled();
  await page.evaluate(()=>{
    window.positionReads=0;
    window.Capacitor={isNativePlatform:()=>true,Plugins:{Geolocation:{
      requestPermissions:()=>new Promise(resolve=>{window.releasePermission=()=>resolve({coarseLocation:'granted'});}),
      getCurrentPosition:async()=>{window.positionReads++; return {coords:{latitude:0,longitude:0}};}
    }}};
  });
  await page.locator('[data-sx="discovery-location"]').click();
  await page.waitForFunction(()=>typeof window.releasePermission==='function');
  await page.evaluate(async()=>{const {cloud}=await import('/src/cloud/index.js'); await cloud.signOut(); await cloud.signInAnonymously(); window.releasePermission();});
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.positionReads)).toBe(0);
});
