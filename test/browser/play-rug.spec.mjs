import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { startEscapade } from '../../src/engine/escapades.js';

const test = base.extend({
  runtimeErrors: [async ({page},use)=>{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await use(errors);expect(errors,'actual browser errors').toEqual([]);
  },{auto:true}]
});
const saved = page => page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')));
const tricks = async(page,id='qa0')=>(await saved(page)).rug?.residents.find(p=>p.petId===id)?.tricks.map(t=>t.id)||[];
async function household(page,kind='established',customize=()=>{}){
  const snapshot=householdFixture(kind);snapshot.settings.theatreOn=false;snapshot.lastBackup=Date.now();customize(snapshot);
  await page.addInitScript(snapshot=>{
    if(!sessionStorage.getItem('rug-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(snapshot));sessionStorage.setItem('rug-fixture','1');}
  },snapshot);
  await page.goto('/');await expect(page.locator('#cabinet .pet')).toHaveCount(snapshot.pets.length);
  return snapshot;
}
async function fits(page){
  const widths=await page.evaluate(()=>({viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,sheet:document.querySelector('#hangoutVeil.open .sheet')?.clientWidth,content:document.querySelector('#hangoutVeil.open .sheet')?.scrollWidth}));
  expect(widths.viewport).toBeLessThanOrEqual(page.viewportSize().width+1);
  expect(widths.doc).toBeLessThanOrEqual(widths.viewport+1);expect(widths.body).toBeLessThanOrEqual(widths.viewport+1);
  if(widths.sheet)expect(widths.content).toBeLessThanOrEqual(widths.sheet+1);
}
async function rug(page){await page.locator('#hangoutBtn').click();await expect(page.locator('#hangoutVeil')).toBeVisible();await expect(page.locator('#rugPet .sprite')).toHaveCount(1);}

test('real soft, high and bouncing throws persist three distinct tricks without replay payout',async({page})=>{
  test.setTimeout(60_000);
  await household(page);const before=await saved(page);await rug(page);
  for(const [style,trick] of [['soft','first-catch'],['high','high-catch'],['bounce','bounce-catch']]){
    await page.locator('#rugThrow').selectOption(style);await page.locator('#rugAction').click();
    await expect.poll(()=>tricks(page)).toContain(trick);
  }
  expect((await saved(page)).life.xp).toBe(before.life.xp+3);
  await page.keyboard.press('Escape');await expect(page.locator('#hangoutVeil')).not.toBeVisible();
  await expect(page.locator('#hangoutBtn')).toBeFocused();
  await page.reload();await rug(page);await expect(page.locator('#rugTally')).toHaveText('3 / 6');
  await page.locator('#rugThrow').selectOption('soft');await page.locator('#rugAction').click();
  await expect(page.locator('#rugCaption')).not.toContainText('absolutely no responsibilities');
  // Let the actual catch finish; opening/replaying never mints the award again.
  await expect(page.locator('.rug-ball')).toHaveCount(0);
  expect((await saved(page)).life.xp).toBe(before.life.xp+3);await fits(page);
});

test('bubble play uses accessible controls and each resident owns their own discoveries',async({page})=>{
  test.setTimeout(60_000);
  await household(page);const before=await saved(page);await rug(page);
  await page.locator('[data-rug-toy="bubbles"]').click();await page.locator('#rugAction').click();
  await page.locator('#rugPop').focus();
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await expect.poll(()=>tricks(page)).toEqual(['first-bubble','group-burst']);
  expect((await saved(page)).life.xp).toBe(before.life.xp+2);
  await page.locator('#rugResident').selectOption('qa2');await expect(page.locator('#rugTally')).toHaveText('0 / 6');
  await page.locator('#rugAction').click();await page.locator('#rugPop').click();
  await expect.poll(()=>tricks(page,'qa2')).toContain('first-bubble');
  expect(await tricks(page,'qa0')).toEqual(['first-bubble','group-burst']);
  await page.locator('#rugClose').click();await page.reload();await rug(page);await page.locator('#rugResident').selectOption('qa2');
  await expect(page.locator('#rugTally')).toHaveText('1 / 6');await fits(page);
});

test('the resident card hands its own creature to the rug and personal care advances only its adventure',async({page})=>{
  await household(page,'established',s=>startEscapade(s,{episodeId:'crumb-observatory',approachId:'orbit',petId:'qa2'}));
  await page.locator('#cabinet .pet[data-id="qa2"]').click();await page.locator('#rugPetInvite').click();
  await expect(page.locator('#cardVeil')).not.toBeVisible();await expect(page.locator('#rugResident')).toHaveValue('qa2');
  const before=await saved(page);await page.locator('[data-rug-care="food"]').click();
  await expect.poll(async()=>(await saved(page)).escapades.active.careAt).not.toBeNull();
  const after=await saved(page);
  expect(after.pets[2].careLog.food).toBe(before.pets[2].careLog.food+1);expect(after.pets[0].careLog.food).toBe(before.pets[0].careLog.food);
  expect(after.escapades.active.playAt).toBeNull();
  await page.keyboard.press('Escape');await expect(page.locator('#cabinet .pet[data-id="qa2"]')).toBeFocused();
});

test('drawn residents and long names remain playable at 320px with reduced motion',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce'});
  await household(page,'drawing-heavy',s=>{s.pets[0].name='W'.repeat(22);});await rug(page);
  await expect(page.locator('#rugPet .sprite-drawing img')).toHaveCount(1);await fits(page);
  await page.locator('#rugAction').focus();await page.keyboard.press('Enter');await expect.poll(()=>tricks(page)).toContain('first-catch');
  await fits(page);await page.locator('#rugTricks summary').click();await fits(page);
  await page.locator('#rugClose').click();await expect(page.locator('#hangoutVeil')).not.toBeVisible();
});

test('a stalled frame pauses the rug, then a fresh gesture resumes real play',async({page})=>{
  await page.addInitScript(()=>{
    const request=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>request(time=>{if(window.rugFrameDelay)window.setTimeout(()=>callback(performance.now()),window.rugFrameDelay);else callback(time);});
  });
  await household(page);await rug(page);
  await page.evaluate(()=>{window.rugFrameDelay=2400;});await page.locator('#rugAction').click();
  await expect(page.locator('#rugPause')).toBeVisible();
  await expect(page.locator('#rugResume')).toBeFocused();
  const held=await page.locator('#rugEntities').innerHTML();
  expect(await page.locator('.rug-tools').evaluate(el=>el.inert)).toBe(true);
  // The household routine must not animate the reserved rug puppet, especially
  // while its own simulation is paused. Exercise the real animator entry point.
  const interrupted=await page.evaluate(async()=>{
    const {reactTo}=await import('/src/art/animator.js');reactTo('qa0','food');
    return !!document.querySelector('#rugPet .sl-care-food, #rugPet .care-motes');
  });
  expect(interrupted).toBe(false);
  await page.evaluate(()=>{window.rugFrameDelay=0;});await page.locator('#rugResume').click();
  await expect(page.locator('#rugPause')).not.toBeVisible();
  await expect(page.locator('#rugAction')).toBeFocused();
  await expect.poll(()=>tricks(page)).toContain('first-catch');
  expect(held).toContain('rug-ball');await fits(page);
});

test('drag cancellation, a fresh throw and direct bubble taps use the real stage',async({page,isMobile})=>{
  await household(page);await rug(page);
  const box=await page.locator('#rugStage').boundingBox();
  const from={x:box.x+box.width*.22,y:box.y+box.height*.75};
  const to={x:box.x+box.width*.68,y:box.y+box.height*.3};
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});
  await expect(page.locator('#rugAim')).toBeVisible();
  await page.locator('#rugStage').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',isPrimary:true});
  await page.mouse.up();await expect(page.locator('#rugAim')).not.toBeVisible();await expect(page.locator('.rug-ball')).toHaveCount(0);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
  await expect(page.locator('#rugAim')).not.toBeVisible();await expect(page.locator('.rug-ball')).toHaveCount(1);
  // Use a different resident to start with a clear rug, then the actual touch
  // coordinates on phone projects instead of invoking a DOM click handler.
  await page.locator('#rugResident').selectOption('qa2');await page.locator('[data-rug-toy="bubbles"]').click();
  const stage=page.locator('#rugStage'),position={x:box.width*.25,y:box.height*.3};
  if(isMobile)await stage.tap({position});else await stage.click({position});
  await expect(page.locator('.rug-bubble')).toHaveCount(5);
  const bubble=await page.locator('.rug-bubble').first().boundingBox();
  if(isMobile)await page.touchscreen.tap(bubble.x+bubble.width/2,bubble.y+bubble.height/2);
  else await page.mouse.click(bubble.x+bubble.width/2,bubble.y+bubble.height/2);
  await expect.poll(()=>tricks(page,'qa2')).toContain('first-bubble');
});

test('a failed save keeps the earned trick in memory and gives an honest recovery message',async({page})=>{
  await household(page);await rug(page);
  await page.evaluate(()=>{
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='shelflife.v4')throw new DOMException('Storage is full','QuotaExceededError');
      return write.call(this,key,value);
    };
  });
  await page.locator('[data-rug-toy="bubbles"]').click();await page.locator('#rugAction').click();await page.locator('#rugPop').click();
  await expect(page.locator('#rugDiscovery')).toContainText('kept for this visit');
  await expect(page.locator('#rugDiscovery')).toContainText('Back up from More');
  await expect(page.locator('#rugTally')).toHaveText('1 / 6');
  expect(await tricks(page)).toEqual([]);
  const current=await page.evaluate(async()=>{const {state}=await import('/src/state.js');return state.rug.residents[0].tricks[0].id;});
  expect(current).toBe('first-bubble');
});

test('the new story folders and notes stay reachable with explicit destination focus',async({page})=>{
  await household(page);
  await page.locator('.tab[data-tab="plots"]').click();await expect(page.locator('#panePlots')).toBeVisible();
  await expect(page.locator('#paneShelf')).not.toBeVisible();await expect(page.locator('#escapadeOpen')).toBeVisible();
  await page.locator('#correspondenceFolder summary').first().click();await expect(page.locator('#caseCard')).toBeVisible();
  await page.locator('#workshopFolder summary').first().click();await expect(page.locator('#lifeHub')).toBeVisible();
  await page.locator('.tab[data-tab="notes"]').click();await expect(page.locator('#checkBtn')).toBeVisible();await page.locator('#checkBtn').click();
  await expect(page.locator('#notes .note').first()).toBeVisible();await fits(page);
  await page.locator('.tab[data-tab="shelf"]').click();await expect(page.locator('#cabinet')).toBeVisible();
  expect(await page.locator('#cabinet .slots').first().locator('.slot').count()).toBe(6);
});
