import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
const test = base.extend({runtimeErrors:[async({page},use)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await use(errors);expect(errors).toEqual([]);
},{auto:true}]});
const saved = page => page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')));
async function setup(page,customize=()=>{}) {
  const s=householdFixture();s.settings.theatreOn=false;s.lastBackup=Date.now();customize(s);
  await page.addInitScript(s=>{if(!sessionStorage.getItem('paperwork-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(s));sessionStorage.setItem('paperwork-fixture','1');}},s);
  await page.goto('/');await expect(page.locator('#cabinet .pet')).toHaveCount(s.pets.length);
}
async function papers(page){await page.locator('.tabbar .tab[data-tab="notes"]').click();await page.locator('[data-filter="papers"]').click();await expect(page.locator('#paperworkDesk')).toBeVisible();}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width+1);}

test('file a real household report, retain it across clear notes and reload, and refresh it after care',async({page})=>{
  await setup(page);await papers(page);
  await expect(page.locator('#notes')).toContainText('filing desk is ready');
  const before=await saved(page);await page.locator('[data-file-report]').click();
  await expect(page.locator('#notes .document-title')).toHaveText('The household register');
  await expect(page.locator('#notes')).toContainText('Agnes · A1');
  await expect(page.locator('[data-file-report]')).toBeDisabled();
  expect((await saved(page)).life.xp).toBe(before.life.xp);
  await expect(page.locator('#clearNotes')).toBeHidden();
  await page.locator('[data-filter="all"]').click();await page.locator('#clearNotes').click();
  await page.reload();await papers(page);
  await expect(page.locator('#notes .document-title')).toHaveCount(1);await expect(page.locator('[data-file-report]')).toBeDisabled();
  await page.locator('.tabbar .tab[data-tab="shelf"]').click();await page.locator('#cabinet .piece[data-id="qa0"]').click();
  await page.locator('#cardVeil [data-care="food"]').click();await page.keyboard.press('Escape');await expect(page.locator('#cardVeil')).not.toBeVisible();
  await papers(page);await expect(page.locator('[data-file-report]')).toBeEnabled();await page.locator('[data-file-report]').click();
  await expect(page.locator('#notes .document-title')).toHaveCount(2);
  expect((await saved(page)).paperwork.entries).toHaveLength(2);await fits(page);
});

test('migrate existing documents and explain filters, owned keepsakes and unfinished milestones',async({page})=>{
  await setup(page,s=>{delete s.paperwork;s.notes=[{text:'MEETING 4\nPip requested a spoon.',from:'Pip',kind:'note',form:'doc',at:Date.now()-2000}];s.achievements=[];s.life.relics=['drawer:0'];s.life.displayed=[];});
  await papers(page);await expect(page.locator('#notes')).toContainText('MEETING 4');
  await expect(page.locator('[data-filter="papers"] .filter-count')).toHaveText('1');
  await page.locator('[data-filter="complaints"]').click();await expect(page.locator('#notes')).toContainText('Enjoy the peace');
  await page.locator('.tabbar .tab[data-tab="plots"]').click();await page.locator('#workshopFolder summary').click();
  await expect(page.locator('.display-cabinet')).toContainText('keepsakes ready to display');
  await page.locator('[data-life="display"]').click();await page.locator('[data-life="display-toggle"]').first().click();
  await page.locator('#lifeClose').click();await expect(page.locator('.display-curio')).toHaveCount(1);
  await page.locator('#tabMore').click();await page.locator('#incidentsBtn').click();await expect(page.locator('.incident-explainer')).toContainText('milestones');
  await expect(page.locator('.incident.locked b').first()).not.toHaveText('Not yet');await fits(page);
});

test('paperwork works at 320px with reduced motion and truthfully reports a failed save',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await papers(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='shelflife.v4')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  await page.locator('[data-file-report]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.paperwork-status')).toContainText('Filed for this visit');await expect(page.locator('#notes .document-title')).toHaveCount(1);
  await fits(page);
});
