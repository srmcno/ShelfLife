import {test,expect} from 'playwright/test';
import {householdFixture} from '../household-fixtures.mjs';

test('shabby rug, readable ball, physical outcomes and saved aftermath at phone widths',async({page},info)=>{
 test.setTimeout(90_000);
 const snapshot=householdFixture('established');snapshot.settings.theatreOn=false;snapshot.lastBackup=Date.now();
 await page.addInitScript(s=>{if(!sessionStorage.getItem('repair-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(s));sessionStorage.setItem('repair-fixture','1');}},snapshot);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Shelf',exact:true}).click();
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});await page.locator('#hangoutBtn').click();
  await page.locator('#rugThrow').selectOption('soft');await page.locator('#rugAction').click();
  const ball=page.locator('.rug-ball').first();await expect(ball).toBeVisible();const bounds=await ball.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(30);expect(bounds.width).toBeLessThanOrEqual(35);
  await expect(page.locator('#rugOutcome')).toContainText(/catch/i);
  await page.screenshot({path:`test-results/repair-rug-${info.project.name}-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#rugClose').click();
 }
 await expect(page.locator('#householdAftermath')).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Shelf',exact:true}).click();await expect(page.locator('#householdAftermath')).toBeVisible();
 await page.screenshot({path:`test-results/repair-household-${info.project.name}.png`,fullPage:true});
 expect(errors).toEqual([]);
});
