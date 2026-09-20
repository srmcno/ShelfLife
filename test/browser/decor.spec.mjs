import {test,expect} from 'playwright/test';
import {householdFixture} from '../household-fixtures.mjs';
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')));
const background=(page,selector)=>page.locator(selector).first().evaluate(el=>getComputedStyle(el).backgroundImage);
async function open(page){await page.locator('#tabMore').click();await page.locator('#decorBtn').click();await expect(page.locator('#decorVeil')).toBeVisible();}
async function household(page){
 const snapshot=householdFixture();snapshot.settings.theatreOn=false;snapshot.lastBackup=Date.now();
 await page.addInitScript(s=>{if(!sessionStorage.getItem('decor-test')){localStorage.setItem('shelflife.v4',JSON.stringify(s));sessionStorage.setItem('decor-test','1');}},snapshot);
 await page.goto('/');await page.getByRole('button',{name:'Shelf',exact:true}).click();
}
test('every room, wood and wallpaper changes the shelf and agrees with the live preview',async({page})=>{
 // This exercises the entire catalog plus reload persistence in one journey.
 // Linux WebKit needs more than the default 30 seconds for all these UI choices.
 test.setTimeout(90_000);
 await household(page);await open(page);
 for(const [group,target] of [['roomOpts','#cabinet'],['woodOpts','#cabinet .plank'],['wallOpts','#cabinet']]){
  const appearances=new Set();
  for(const button of await page.locator('#'+group+' button').all()){
   await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#'+group+' button[aria-pressed="true"]')).toHaveCount(1);
   const appearance=await background(page,target);expect(appearance).not.toContain('play-rug.webp');appearances.add(appearance);
   expect(await background(page,group==='woodOpts'?'.decor-preview-plank':'#decorPreview')).toBe(appearance);
  }
  expect(appearances.size).toBe(await page.locator('#'+group+' button').count());
 }
 for(const button of await page.locator('#accentOpts button').all()){
  await button.click();
  const swatch=await button.locator('.dot').evaluate(el=>getComputedStyle(el).backgroundColor);
  await expect(page.locator('#hangoutBtn')).toHaveCSS('background-color',swatch);
 }
 const before=await saved(page);const cabinet=await background(page,'#cabinet');const plank=await background(page,'#cabinet .plank');
 await page.locator('#decorClose').click();await page.reload();
 expect((await saved(page)).decor).toEqual(before.decor);expect((await saved(page)).slots).toEqual(before.slots);
 expect(await background(page,'#cabinet')).toBe(cabinet);expect(await background(page,'#cabinet .plank')).toBe(plank);
 await page.locator('#hangoutBtn').click();expect(await background(page,'.rug-stage')).toContain('play-rug.webp');
});
test('decoration keeps keyboard focus, fits narrow screens and survives failed storage honestly',async({page,browserName})=>{
 await household(page);await open(page);
 const first=page.locator('#roomOpts button').first();await first.focus();await page.keyboard.press('Enter');await expect(first).toBeFocused();
 await page.keyboard.press(browserName==='webkit'?'Alt+Tab':'Tab');await expect(page.locator('#roomOpts button').nth(1)).toBeFocused();
 for(const width of [320,390,430,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.locator('#decorVeil .sheet').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
 await page.locator('#woodOpts [data-decor-value="bone"]').click();
 await expect(page.locator('#decorSaveStatus')).toContainText('Not saved');
 await expect(page.locator('#woodOpts [data-decor-value="bone"]')).toHaveAttribute('aria-pressed','true');
});

test('night lighting preserves chosen paint and wallpaper instead of replacing them',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-09-20T04:00:00Z'));
 await household(page);await open(page);await expect(page.locator('body')).toHaveClass(/night/);
 const before=await background(page,'#cabinet');
 await page.locator('#roomOpts [data-decor-value="parlor"]').click();
 await page.locator('#wallOpts [data-decor-value="dots"]').click();
 const after=await background(page,'#cabinet');expect(after).not.toBe(before);
 expect(after).toBe(await background(page,'#decorPreview'));
 expect(after).toContain('radial-gradient');
 await page.locator('#woodOpts [data-decor-value="bone"]').click();
 await expect(page.locator('#cabinet .nameplate').first()).toHaveCSS('color','rgb(33, 26, 22)');
 await page.locator('#decorClose').click();await page.reload();
 expect(await background(page,'#cabinet')).toBe(after);
});
