import {test,expect} from 'playwright/test';

test('Play works before any resident is adopted',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('#playroomBtn:visible, #tabPlay:visible').first().click();
 await expect(page.locator('#playroomVeil')).toBeVisible();
 await expect(page.locator('.activity-card')).toHaveCount(6);
 for(const card of await page.locator('.activity-card').all())await expect(card).toBeDisabled();
 expect(errors).toEqual([]);
});
