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
  await expect(page.locator('.chase-campaign-pace input')).toBeChecked();
  await expect(page.locator('.chase-settings')).not.toHaveAttribute('open','');
  await expect(page.locator('#chaseStage option:disabled')).toHaveCount(11);
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
