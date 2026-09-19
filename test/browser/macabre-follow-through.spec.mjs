import {test,expect} from 'playwright/test';
import {householdFixture} from '../household-fixtures.mjs';

test('Play works before any resident is adopted',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
 await expect(page.locator('#playroomVeil')).toBeVisible();
 await expect(page.locator('.activity-card')).toHaveCount(6);
 for(const card of await page.locator('.activity-card').all())await expect(card).toBeDisabled();
 expect(errors).toEqual([]);
});

test('rug aftermath belongs to its resident and captions get time to land',async({page})=>{
 test.setTimeout(45_000);
 const snapshot=householdFixture();snapshot.settings.theatreOn=false;snapshot.lastBackup=Date.now();
 snapshot.householdEchoes={version:1,openingDone:true,callbacks:[],events:[{id:'court-real',kind:'court',variant:'convicted',petId:'qa0',at:Date.now()-10000}]};
 await page.addInitScript(s=>{if(!sessionStorage.getItem('macabre-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(s));sessionStorage.setItem('macabre-fixture','1');}},snapshot);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Shelf',exact:true}).click();await page.locator('#hangoutBtn').click();
 await page.locator('#rugResident').selectOption('qa0');
 await expect(page.locator('#rugMemoryProp')).toHaveAttribute('data-kind','court');
 await expect(page.locator('#rugMemoryProp')).toBeVisible();
 await page.locator('#rugAction').click();
 await expect(page.locator('#rugCaption')).toContainText('Agnes: It eyes the mourning hat.');
 const caption=await page.locator('#rugCaption').textContent();
 await page.waitForTimeout(900);
 await expect(page.locator('#rugCaption')).toHaveText(caption);
 await page.locator('#rugResident').selectOption('qa1');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')).householdEchoes.callbacks)).toContain('qa0:convict-ball');
 await expect(page.locator('#rugMemoryProp')).toBeHidden();
 await page.locator('#rugClose').click();await page.reload();await page.getByRole('button',{name:'Shelf',exact:true}).click();await page.locator('#hangoutBtn').click();
 await page.locator('#rugResident').selectOption('qa0');await page.locator('#rugAction').click();
 await expect(page.locator('#rugOutcome')).toContainText('catch');
 await expect(page.locator('#rugCaption')).not.toHaveText(caption);
 expect(errors).toEqual([]);
});
