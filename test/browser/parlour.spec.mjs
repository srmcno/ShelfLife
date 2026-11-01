import { test, expect } from 'playwright/test';
import { createFakeSupabase } from '../support/fake-supabase.mjs';
import { socialPlayer, pageSession } from '../support/social-world.mjs';
import { householdFixture } from '../household-fixtures.mjs';

test('a lost send response can be confirmed after the friend enables DND', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'The retry flow runs once.');
  const fake=createFakeSupabase(), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.lastBackup=Date.now();
  const a=await socialPlayer(fake,'Ada',shelf), b=await socialPlayer(fake,'Bea',shelf);
  await a.social.addFriend(b.code); await b.social.respond(a.id,true);
  const ctx=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block'}), p=await ctx.newPage();
  let phase=0;
  try {
    await p.addInitScript(({shelf,config,session})=>{window.SHELFLIFE_CLOUD_CONFIG=config;localStorage.setItem('shelflife.v4',JSON.stringify(shelf));localStorage.setItem('shelflife.cloud',session);},{shelf,config:fake.config,session:pageSession(a)});
    await p.route(fake.url+'/**',async route=>{
      const req=route.request();
      if(req.method()==='POST' && req.url().endsWith('/rest/v1/rpc/parlour_send') && phase===0) {
        phase=1;
        const result=fake.handle({method:req.method(),url:req.url(),headers:req.headers(),body:req.postData()||''});
        expect(result.status).toBe(200);
        fake.postbox.prefs.set(b.id,{...fake.postbox.prefs.get(b.id),dnd:true});
        return route.abort('connectionreset');
      }
      if(req.method()==='POST' && req.url().endsWith('/rest/v1/rpc/parlour_send') && phase===1) {
        phase=2;
        return route.fulfill({status:400,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({code:'P0001',message:'dnd'})});
      }
      return fake.route(route);
    });
    await p.goto('http://localhost:4175/'); await p.locator('#tabFriends').click();
    await p.locator('#friendsSheet [data-fr="profile"]').first().click();
    await p.locator('[data-fr-action="parlour"]').click();
    await p.locator('[data-sx="parlour-pick"]').first().click();
    const pendingKey='shelflife.parlour.pending.'+a.id+'.'+b.id;
    await p.locator('[data-sx="parlour-send"]').click();
    await expect.poll(()=>phase).toBe(1);
    await expect.poll(()=>p.evaluate(k=>localStorage.getItem(k),pendingKey)).not.toBeNull();
    await p.locator('[data-sx="parlour-send"]').click();
    await expect.poll(()=>phase).toBe(2);
    await expect(p.locator('#friendsSheet')).toContainText('could not be confirmed');
    await expect.poll(()=>p.evaluate(k=>localStorage.getItem(k),pendingKey)).not.toBeNull();
    await p.locator('[data-sx="parlour-send"]').click();
    await expect(p.locator('#friendsSheet')).toContainText('Question sent.');
    expect(await p.evaluate(k=>localStorage.getItem(k),pendingKey)).toBeNull();
    expect((await b.cloud.rpc('parlour_inbox')).length).toBe(1);
    expect(fake.calls('parlour_send')).toHaveLength(2);
  } finally { await ctx.close(); }
});

test('friends exchange sealed predictions, see both outcomes, and can play again', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'The full social round runs once at phone size.');
  test.setTimeout(90000);
  let time=Date.now(); const fake=createFakeSupabase({now:()=>time}), shelf=householdFixture('established');
  shelf.settings.theatreOn=false; shelf.lastBackup=Date.now();
  const a=await socialPlayer(fake,'Ada',shelf), b=await socialPlayer(fake,'<img src=x>',shelf);
  await a.social.addFriend(b.code); await b.social.respond(a.id,true);
  async function pageFor(player) {
    const ctx=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block'});
    const p=await ctx.newPage();
    await p.addInitScript(({shelf,config,session})=>{window.SHELFLIFE_CLOUD_CONFIG=config;localStorage.setItem('shelflife.v4',JSON.stringify(shelf));localStorage.setItem('shelflife.cloud',session);},{shelf,config:fake.config,session:pageSession(player)});
    await p.route(fake.url+'/**',route=>fake.route(route)); await p.goto('http://localhost:4175/');
    await p.locator('#tabFriends').click(); await expect(p.locator('#friendsVeil')).toBeVisible();
    return {ctx,p};
  }
  const pa=await pageFor(a), pb=await pageFor(b);
  try {
    await pa.p.locator('#friendsSheet [data-fr="profile"]').first().click();
    await pa.p.locator('[data-fr-action="parlour"]').click();
    await expect(pa.p.locator('[data-fr-view="parlour-send"]')).toContainText('Both answers stay sealed');
    await pa.p.locator('[data-sx="parlour-next"]').click();
    await pa.p.locator('[data-sx="parlour-pick"]').nth(0).click();
    await pa.p.screenshot({path:info.outputPath('question-320.png')});
    const first=await pa.p.locator('[data-sx="parlour-pick"]').nth(0).textContent();
    await pa.p.locator('[data-sx="parlour-send"]').click();
    await expect(pa.p.locator('#friendsSheet')).toContainText('Question sent.');
    await pb.p.locator('[data-fr="postbox"]').click();
    await expect(pb.p.locator('#friendsSheet')).toContainText('A question for your shelf');
    await pb.p.locator('[data-sx="parlour-answer"]').click();
    await expect(pb.p.locator('[data-fr-view="parlour-answer"] .pr-result')).toHaveCount(0);
    await pb.p.locator('[data-sx="parlour-answer-pick"]').nth(1).click();
    const second=await pb.p.locator('[data-sx="parlour-answer-pick"]').nth(1).textContent();
    await pb.p.locator('[data-sx="parlour-answer-send"]').click();
    await expect(pb.p.locator('[data-fr-view="parlour-result"]')).toContainText(first);
    await expect(pb.p.locator('[data-fr-view="parlour-result"]')).toContainText(second);
    await pb.p.screenshot({path:info.outputPath('result-320.png')});
    await pb.p.locator('[data-sx="parlour-result-done"]').click();
    await pa.p.locator('[data-fr="back"]').click();
    await pa.p.locator('[data-fr="postbox"]').click();
    await expect(pa.p.locator('#friendsSheet')).toContainText('Both answers are in');
    await expect(pa.p.locator('#friendsSheet')).toContainText('<img src=x>');
    await expect(pa.p.locator('#friendsSheet img')).toHaveCount(0);
    await pa.p.locator('[data-sx="parlour-seen"]').click();
    await expect(pa.p.locator('#friendsSheet')).not.toContainText('Both answers are in');
    time+=86400001;
    await pa.p.locator('[data-fr="back"]').click();
    await pa.p.locator('#friendsSheet [data-fr="profile"]').first().click();
    await pa.p.locator('[data-fr-action="parlour"]').click();
    await pa.p.locator('[data-sx="parlour-pick"]').nth(2).click();
    await pa.p.locator('[data-sx="parlour-send"]').click();
    await expect(pa.p.locator('#friendsSheet')).toContainText('Question sent.');
    expect(await pa.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await pa.p.screenshot({path:info.outputPath('parlour-320.png')});
    await pb.p.locator('[data-fr="back"]').click();
    await pb.p.locator('[data-fr="postbox"]').click();
    await expect(pb.p.locator('#friendsSheet')).toContainText('A question for your shelf');
    await pb.p.locator('[data-sx="parlour-decline"]').click();
    await expect(pb.p.locator('#friendsSheet')).toContainText('Question declined.');
    await pa.p.locator('[data-fr="back"]').click();
    await pa.p.locator('[data-fr="postbox"]').click();
    await expect(pa.p.locator('#friendsSheet')).toContainText('Question declined');
    await pa.p.locator('[data-sx="parlour-seen"]').click();
  } finally {await pa.ctx.close();await pb.ctx.close();}
});
