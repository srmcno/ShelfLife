import { test, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
async function openChase(page) {
  const snapshot=householdFixture('established');snapshot.settings.theatreOn=false;snapshot.lastBackup=Date.now();
  await page.addInitScript(snapshot=>{if(!sessionStorage.getItem('campaign-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(snapshot));sessionStorage.setItem('campaign-fixture','1');}},snapshot);
  await page.goto('/');
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await page.locator('[data-activity="chase"]').click();
}
test('campaign begins with an accessible gentle lesson and keeps optional setup collapsed',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openChase(page);
  await expect(page.locator('#chaseHeading')).toContainText('Chapter 1');
  await expect(page.locator('#chaseGo')).toHaveText('Begin lesson 1');
  await expect(page.getByLabel('Gentle catches & longer warnings')).toBeChecked();
  await expect(page.locator('.chase-settings')).not.toHaveAttribute('open','');
  await expect(page.locator('#chaseStage option:disabled')).toHaveCount(11);
  await expect(page.getByLabel('Mirror route on this replay')).toBeHidden();
  await page.locator('#chaseGo').click();await expect(page.locator('#chaseArea')).toHaveAttribute('data-running','true');
  await page.locator('#chaseHop').click();await page.locator('#chasePause').click();
  await expect(page.locator('#chaseGo')).toHaveText('Resume chase');
  const clock=await page.locator('#chaseTime').textContent();await page.waitForTimeout(300);await expect(page.locator('#chaseTime')).toHaveText(clock);
  await page.locator('#chaseGo').click();await page.locator('#chasePause').click();
  await expect(page.locator('#chaseRestart')).toBeVisible();
  expect(errors).toEqual([]);
});
test('320px campaign setup and its advanced free play have no horizontal clipping',async({page})=>{
  await page.setViewportSize({width:320,height:740});await openChase(page);
  await expect(page.locator('#chaseStage')).toBeVisible();
  const widths=await page.evaluate(()=>({window:innerWidth,doc:document.documentElement.scrollWidth,setup:document.querySelector('.chase-campaign-setup').getBoundingClientRect().width}));
  expect(widths.doc).toBeLessThanOrEqual(widths.window);expect(widths.setup).toBeLessThan(320);
  await page.locator('.chase-settings summary').click();await page.locator('[data-chase-format="quick"]').click();
  await expect(page.locator('#chaseDescription')).toContainText('22 seconds');
  await expect(page.locator('.chase-campaign-setup')).toBeHidden();
});

// Read only the same arena objects the player sees. Drive the actual keyboard
// handlers; never import the engine, access game objects, seed victories, change
// physics time, or write progression after the ordinary household fixture.
async function collectVisibleCrumbs(page, deadlineMs) {
  const deadline=Date.now()+deadlineMs;
  let held=null;
  try {
    while(Date.now()<deadline){
      const view=await page.evaluate(()=>{
        const area=document.querySelector('#chaseArea');
        const xOf=el=>Number(el?.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1]);
        const crumb=document.querySelector('#chaseItems .chase-item.crumb:not(.squashed)');
        return {screen:area.dataset.chaseScreen,x:xOf(document.querySelector('#chaseResident')),target:crumb?xOf(crumb):null};
      });
      if(view.screen==='result')return;
      if(view.screen!=='play')throw new Error('Unexpected Chase screen during keyboard play: '+view.screen);
      const delta=view.target===null?0:view.target-view.x;
      const next=Math.abs(delta)>8?(delta<0?'ArrowLeft':'ArrowRight'):null;
      if(next!==held){
        if(held)await page.keyboard.up(held);
        held=next;
        if(held)await page.keyboard.down(held);
      }
      await page.waitForTimeout(80);
    }
    throw new Error('Chase did not reach its result within the real-time deadline');
  } finally { if(held)await page.keyboard.up(held); }
}
async function storedCampaign(page) {
  return page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('shelflife.v4'));
    return state.pets.find(p=>p.chaseCampaign?.records?.['first-crumbs']?.won)?.chaseCampaign||null;
  });
}
test('real keyboard clears the first two lessons, advances through briefing and survives reload',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','Desktop keyboard progression slice; mobile controls have separate coverage.');
  test.setTimeout(90_000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openChase(page);
  await expect(page.locator('#chaseGo')).toHaveText('Begin lesson 1');
  await page.locator('#chaseGo').click();
  await collectVisibleCrumbs(page,25_000);
  await expect(page.locator('#chaseHeading')).toContainText('Lesson complete: The breakfast remains');
  await expect(page.locator('#chaseGo')).toHaveText('Next lesson');
  await expect.poll(async()=> (await storedCampaign(page))?.unlocked).toBe(2);
  const first=await storedCampaign(page);
  expect(first.records['first-crumbs'].won).toBe(true);
  expect(first.records['first-crumbs'].score).toBeGreaterThan(0);
  await page.locator('#chaseGo').click();
  await expect(page.locator('#chaseGo')).toHaveText('Begin lesson 2');
  await expect(page.locator('#chaseDescription')).toContainText('Both cupboards');
  await expect(page.locator('#chaseStage')).toHaveValue('both-cupboards');
  await expect(page.getByLabel('Mirror route on this replay')).toBeHidden();
  await page.locator('#chaseStage').selectOption('first-crumbs');
  const mirror=page.getByLabel('Mirror route on this replay');
  await expect(mirror).toBeVisible();
  await mirror.focus(); await page.keyboard.press('Space');
  await expect(mirror).toBeChecked();
  await expect(page.locator('#chaseDescription')).toContainText('Mirrored replay');
  await page.locator('#chaseStage').selectOption('both-cupboards');
  await expect(mirror).toBeHidden();
  await expect(page.locator('#chaseGo')).toHaveText('Begin lesson 2');
  // Reload uses the app's actual persistence. The fixture script only seeds once.
  await page.reload();
  await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
  await page.locator('[data-activity="chase"]').click();
  await expect(page.locator('#chaseGo')).toHaveText('Begin lesson 2');
  await expect(page.locator('#chaseStage option:disabled')).toHaveCount(10);
  await page.locator('#chaseGo').click();
  await collectVisibleCrumbs(page,30_000);
  await expect(page.locator('#chaseHeading')).toContainText('Lesson complete: Both cupboards');
  await expect.poll(async()=> (await storedCampaign(page))?.unlocked).toBe(3);
  const second=await storedCampaign(page);
  expect(second.records['both-cupboards'].won).toBe(true);
  expect(second.records['both-cupboards'].score).toBeGreaterThan(0);
  expect(second.records['first-crumbs']).toEqual(first.records['first-crumbs']);
  await page.locator('#chaseGo').click();
  await expect(page.locator('#chaseGo')).toHaveText('Begin lesson 3');
  await expect(page.locator('#chaseDescription')).toContainText('Borrowed knees');
  expect(errors).toEqual([]);
  await testInfo.attach('earned-campaign-records',{body:JSON.stringify(second,null,2),contentType:'application/json'});
});
