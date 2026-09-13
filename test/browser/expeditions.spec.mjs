import {test as base,expect} from 'playwright/test';
import {householdFixture} from '../household-fixtures.mjs';
import {outingSnapshot,startOuting,chooseOuting} from '../../src/engine/life.js';

const test=base.extend({runtimeErrors:[async({page},use)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await use(errors);expect(errors,'browser runtime errors').toEqual([]);
},{auto:true}]});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')));
async function household(page,customize=()=>{}){
 const s=householdFixture();s.settings.theatreOn=false;s.settings.effects='light';s.lastBackup=Date.now();
 s.life.projects=[];s.life.projectParts={drawer:[],fridge:[],cupboard:[]};s.life.relics=[];s.life.displayed=[];s.life.trailPages=[];
 s.pets.forEach(p=>p.stats={cute:3,menace:3,damp:3,mystique:3});s.pets[0].stats.menace=8;s.pets[0].stats.mystique=8;customize(s);
 await page.addInitScript(snapshot=>{if(!sessionStorage.getItem('expedition-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(snapshot));sessionStorage.setItem('expedition-fixture','1');}},s);
 await page.goto('/');await expect(page.locator('#cabinet .pet')).toHaveCount(s.pets.length);return s;
}
async function open(page){
 // Back to games restores this launcher; the shelf's Play tab is then inert.
 const playroom=page.locator('#playroomVeil');
 if(!await playroom.isVisible())await page.locator('#tabPlay').click();
 await expect(playroom).toBeVisible();await playroom.locator('[data-activity="outing"]').click();
 await expect(page.locator('#lifeVeil.outing-mode')).toBeVisible();
}
async function fits(page,expectedCrew=1){
 let sizes,previous='',stableSamples=0;
 // A native select redraws the planning scene. WebKit can return the new DOM
 // while the sheet-up transform and crew arrival are still being composited.
 // Wait for that real entrance to finish, then measure the unchanged limits.
 await expect.poll(async()=>{
  sizes=await page.evaluate(()=>{
   const sheet=document.querySelector('#lifeVeil .sheet'),workspace=document.querySelector('.expedition-view'),dock=document.querySelector('.expedition-action-dock').getBoundingClientRect();
   const sheetBox=sheet.getBoundingClientRect(),stage=document.querySelector('.expedition-stage').getBoundingClientRect();
   const crew=[...document.querySelectorAll('[data-expedition-cast] .sprite-creature,[data-expedition-cast] .sprite-body')].map(art=>{
    const box=art.getBoundingClientRect();let opacity=1,visible=true;
    for(let node=art;node;node=node.parentElement){const style=getComputedStyle(node);opacity*=Number(style.opacity);visible&&=style.display!=='none'&&style.visibility!=='hidden';}
    return {width:box.width,height:box.height,opacity,visible,inside:box.left>=stage.left-1&&box.right<=stage.right+1&&box.top>=stage.top-1&&box.bottom<=stage.bottom+1};
   });
   return {width:innerWidth,height:innerHeight,doc:document.documentElement.scrollWidth,sheet:[sheet.clientWidth,sheet.scrollWidth],workspace:[workspace.clientWidth,workspace.scrollWidth],sheetBox:{top:sheetBox.top,bottom:sheetBox.bottom},dock:{top:dock.top,bottom:dock.bottom},entering:sheet.getAnimations().some(animation=>animation.pending||animation.playState==='running'),fontsReady:document.fonts.status==='loaded',crew};
  });
  const geometry=JSON.stringify([sizes.width,sizes.height,sizes.sheet,sizes.workspace,sizes.sheetBox,sizes.dock]);
  stableSamples=!sizes.entering&&geometry===previous?stableSamples+1:0;previous=geometry;
  return {entranceFinished:!sizes.entering&&sizes.fontsReady,geometryStable:stableSamples>=2,visibleCrew:sizes.crew.length===expectedCrew&&sizes.crew.every(art=>art.visible&&art.opacity>=.99&&art.width>=24&&art.height>=24&&art.inside)};
 },{message:'the expedition entrance settles with the actual crew visibly inside the stage',timeout:5000,intervals:[50,100,100,200]}).toEqual({entranceFinished:true,geometryStable:true,visibleCrew:true});
 expect(sizes.width).toBeLessThanOrEqual(page.viewportSize().width+1);expect(sizes.doc).toBeLessThanOrEqual(sizes.width+1);
 expect(sizes.sheet[1]).toBeLessThanOrEqual(sizes.sheet[0]+1);expect(sizes.workspace[1]).toBeLessThanOrEqual(sizes.workspace[0]+1);
 expect(sizes.dock.top).toBeGreaterThanOrEqual(0);expect(sizes.dock.bottom).toBeLessThanOrEqual(sizes.height+1);
}
async function choose(page,choice){
 const before=outingSnapshot(await saved(page)),preview=before.options[choice].preview;
 const button=page.locator('[data-life="outing-choice"][data-choice="'+choice+'"]');
 await expect(button).toBeEnabled();await expect(button).toContainText('Nerve '+before.nerve+' → '+preview.nerve+' · +'+preview.points+' points');
 await button.click();await expect.poll(async()=>(await saved(page)).life.outing.step).toBe(before.step+1);
 const after=outingSnapshot(await saved(page));expect(after.nerve).toBe(preview.nerve);expect(after.toolUsed).toBe(preview.toolUsed);expect(after.baseScore-before.baseScore).toBe(preview.points);
 await expect(page.locator('.expedition-heading h3')).toBeFocused();return after;
}

test('pack a real crew, finish all three choices, resume a save and reopen one earned homecoming',async({page})=>{
 test.setTimeout(60_000);const fixture=await household(page);await open(page);
 await page.locator('#outingLead').selectOption('qa2');await page.locator('#outingCompanion').selectOption('qa0');
 await expect(page.locator('.expedition-packed-resident').first()).toContainText('Pip');
 await expect(page.locator('.expedition-packed-resident').last()).toContainText('1-nerve detours at stops 1 & 3');
 await expect(page.locator('.expedition-packed-tool')).toContainText('at stop 2 without spending nerve');
 await fits(page,2);const before=await saved(page);await page.locator('[data-life="set-out"]').click();
 await expect(page.locator('[data-expedition-cast] .sprite')).toHaveCount(2);expect((await saved(page)).life.outing.cast).toEqual(['qa2','qa0']);
 await expect(page.locator('[data-choice="2"][data-life="outing-choice"]')).toBeDisabled();await expect(page.locator('[data-choice="2"][data-life="outing-choice"]')).toContainText('This stop needs Emergency biscuit');
 const first=await choose(page,1);await expect(page.locator('.expedition-field-report')).toContainText('Part safely in the bag');
 await expect(page.locator('.expedition-cast')).toHaveCSS('animation-name','expedition-travel');await fits(page,2);
 await page.locator('#lifeClose').click();await page.reload();await open(page);
 expect(outingSnapshot(await saved(page)).choices).toEqual(first.choices);await expect(page.locator('.expedition-last-event')).toBeVisible();
 await page.locator('.expedition-last-event summary').click();await expect(page.locator('.expedition-last-event p')).toHaveText(first.log.at(-1));
 await choose(page,2);await expect(page.locator('.expedition-tool-prop')).toHaveCount(1);await page.locator('[data-life="continue-outing"]').click();
 await choose(page,1);await expect(page.locator('.expedition-view')).toHaveClass(/phase-result/);
 await expect(page.locator('.expedition-rewards')).toContainText('Built and installed · +6 discoveries');
 await expect(page.locator('.expedition-rewards')).toContainText('New curiosity · +4 discoveries');await expect(page.locator('.expedition-rewards')).toContainText('New field note · +2 discoveries');
 const completed=await saved(page);expect(completed.life.xp).toBe(before.life.xp+13);expect(completed.life.projectParts.drawer).toEqual([0,1,2]);expect(completed.life.projects).toEqual(['drawer']);
 expect(completed.pets.find(p=>p.id==='qa2').expeditions).toBe((fixture.pets[2].expeditions||0)+1);expect(completed.pets.find(p=>p.id==='qa1').expeditions||0).toBe(fixture.pets[1].expeditions||0);
 expect(completed.paperwork.entries.filter(e=>e.title.startsWith('Expedition report'))).toHaveLength(1);await fits(page,2);
 const receipt=await page.locator('.expedition-rewards').textContent();await page.locator('#lifeClose').click();await open(page);
 await expect(page.locator('.expedition-rewards')).toHaveText(receipt);expect((await saved(page)).life.xp).toBe(completed.life.xp);
 await page.reload();await open(page);const restored=await saved(page);
 expect(restored.life.xp).toBe(completed.life.xp);expect(restored.life.outings).toBe(completed.life.outings);expect(restored.life.outing.result).toEqual(completed.life.outing.result);
 expect(restored.paperwork.entries.filter(e=>e.title.startsWith('Expedition report'))).toHaveLength(1);await fits(page,2);
 await page.locator('[data-life="project-home"]').click();await expect(page.locator('#lifeVeil')).not.toBeVisible();
 await expect(page.locator('#playroomVeil')).not.toBeVisible();await expect(page.locator('.household-workshop')).toBeFocused();
 await expect(page.locator('[data-life="use-project"][data-id="drawer"]')).toBeVisible();expect((await saved(page)).life.outing).toBeNull();
});

test('a 320px saved trip shows stored parts, blocked moves and a truthful early return',async({page})=>{
 test.setTimeout(60_000);await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce'});
 await household(page,s=>{
  s.pets[0].name='W'.repeat(22);s.pets[0].stats={cute:3,menace:3,damp:3,mystique:3};s.pets[0].needs.fuss=100;
  s.life.projectParts.drawer=[0];startOuting(s,'drawer','thread',['qa0'],{mission:true,edition:0});
 });await open(page);
 await expect(page.locator('.expedition-crew-names')).toHaveText('W'.repeat(22));await expect(page.locator('[data-life="outing-choice"][data-choice="1"]')).toContainText('Part already stored · trail points only');
 await expect(page.locator('[data-life="outing-choice"][data-choice="0"]')).toContainText('Nerve 2 → 3');await fits(page);
 await choose(page,1);await page.locator('[data-life="continue-outing"]').click();
 await expect(page.locator('[data-life="outing-choice"][data-choice="1"]')).toBeDisabled();await expect(page.locator('[data-life="outing-choice"][data-choice="1"]')).toContainText('Needs 2 nerve · you have 0');
 await expect(page.locator('.expedition-cast')).toHaveCSS('animation-name','none');await fits(page);
 await choose(page,2);await page.locator('[data-life="outing-return"]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('.expedition-view')).toHaveClass(/phase-result/);await expect(page.locator('.mission-field-note')).toContainText('Unvisited stops gave no nerve, points or field note');
 const result=await saved(page);expect(result.life.outing.returnedAt).toBe(2);expect(result.life.outing.nerve).toBe(0);expect(result.life.projectParts.drawer).toEqual([0,1]);expect(result.life.trailPages).toEqual([]);expect(result.pets[0].needs.fuss).toBeLessThanOrEqual(100);
 await expect(page.locator('.expedition-haul-parts')).not.toContainText('A length of bell cord');await expect(page.locator('.expedition-rewards')).not.toContainText('New field note');await fits(page);
});

test('an old two-choice expedition completes without changing its saved rules',async({page})=>{
 test.setTimeout(60_000);await household(page,s=>{s.life.outing={route:'fridge',gear:'lantern',cast:['qa1'],step:0,score:0,log:[],choices:[]};chooseOuting(s,0);});
 await open(page);await expect(page.locator('[data-life="outing-choice"]')).toHaveCount(2);await expect(page.locator('.expedition-last-event')).toBeVisible();
 await page.locator('[data-life="outing-choice"]').first().click();await page.locator('[data-life="continue-outing"]').click();await page.locator('[data-life="outing-choice"]').first().click();
 await expect(page.locator('.expedition-view')).toHaveClass(/phase-result/);await expect(page.locator('.expedition-result-score')).toContainText('situations supported by your equipment or crew');
 const complete=await saved(page);expect(complete.life.outing.version).toBeUndefined();expect(complete.life.outings).toBe(1);expect(complete.pets[1].expeditions).toBe(1);
 await fits(page);await page.reload();await open(page);expect((await saved(page)).life.xp).toBe(complete.life.xp);await expect(page.locator('[data-life="finish-outing"]')).toBeEnabled();
});
