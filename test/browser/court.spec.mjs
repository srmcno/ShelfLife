import { test as base, expect } from 'playwright/test';
import { householdFixture } from '../household-fixtures.mjs';
import { startCourt, currentCourt, courtEvidence } from '../../src/engine/court.js';

const test=base.extend({
  runtimeErrors:[async({page},use)=>{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await use(errors);expect(errors,'browser runtime errors').toEqual([]);
  },{auto:true}]
});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')));
async function openCourt(page){
  await page.locator('#tabPlay').click();
  await page.locator('[data-activity="court"]').click();
  await expect(page.locator('#lifeVeil.court-mode')).toBeVisible();
}
async function hearing(page,{reworked=true,kind='established'}={}){
  const snapshot=householdFixture(kind);
  snapshot.settings.theatreOn=false;snapshot.settings.effects='light';snapshot.lastBackup=Date.now();
  if(kind==='drawing-heavy')snapshot.pets[0].name='W'.repeat(22);
  const game=startCourt(snapshot,{reworked,level:2,petId:snapshot.pets[0].id},()=>.43);
  await page.addInitScript(snapshot=>{
    if(!sessionStorage.getItem('court-fixture')){
      localStorage.setItem('shelflife.v4',JSON.stringify(snapshot));sessionStorage.setItem('court-fixture','1');
    }
  },snapshot);
  await page.goto('/');await expect(page.locator('#cabinet .pet')).toHaveCount(snapshot.pets.length);
  await openCourt(page);await expect(page.locator('#courtCaseTitle')).toHaveText(game.title);
  return {game,snapshot};
}
async function inspect(page,game){
  for(let clue=0;clue<game.rules.length;clue++)await page.locator('.court-clue-tabs [data-clue="'+clue+'"]').click();
  await expect(page.locator('.court-action-bar')).toContainText(game.rules.length+' / '+game.rules.length+' crime clues inspected');
  await page.locator('.court-chapters [data-chapter="hearing"]').click();
}
async function compare(page,suspect,clue){
  await page.locator('.court-cast-picker [data-choice="'+suspect+'"]').click();
  await page.locator('.court-clue-tabs [data-clue="'+clue+'"]').click();
  await page.locator('[data-life="court-compare"]').click();
}
async function fits(page){
  const layout=await page.evaluate(()=>{
    const sheet=document.querySelector('#lifeVeil .sheet'),workspace=document.querySelector('.court-workspace'),bar=document.querySelector('.court-action-bar').getBoundingClientRect();
    return {viewport:innerWidth,doc:document.documentElement.scrollWidth,sheet:[sheet.clientWidth,sheet.scrollWidth],workspace:[workspace.clientWidth,workspace.scrollWidth],bar:{top:bar.top,bottom:bar.bottom},height:innerHeight};
  });
  expect(layout.viewport).toBeLessThanOrEqual(page.viewportSize().width+1);
  expect(layout.doc).toBeLessThanOrEqual(layout.viewport+1);
  expect(layout.sheet[1]).toBeLessThanOrEqual(layout.sheet[0]+1);
  expect(layout.workspace[1]).toBeLessThanOrEqual(layout.workspace[0]+1);
  expect(layout.bar.top).toBeGreaterThanOrEqual(0);expect(layout.bar.bottom).toBeLessThanOrEqual(layout.height+1);
}

test('a complete hearing corrects an unsupported argument, resumes its deductions and pays one verdict',async({page})=>{
  test.setTimeout(60_000);
  const {game,snapshot}=await hearing(page);await inspect(page,game);
  await compare(page,game.answer,0);
  await expect(page.locator('.court-dialogue')).toContainText('fits this clue');
  let progress=currentCourt(await saved(page));expect(progress.mistakes).toBe(1);expect(progress.eliminations).toEqual([]);
  const innocents=game.suspects.flatMap((_,i)=>i===game.answer?[]:[i]);
  const first=innocents.shift(),firstClue=courtEvidence(game,first).findIndex(fit=>!fit);
  await compare(page,first,firstClue);
  await expect(page.locator('.court-dialogue')).toContainText(game.suspects[first].name+' is cleared');
  await expect(page.locator('.court-dock-actor')).toHaveCSS('animation-name','court-relieved');
  await expect(page.locator('body')).toHaveAttribute('data-effects','light');
  await expect(page.locator('.court-action-bar [data-life="court-call"]')).toBeEnabled();
  await page.locator('.court-notebook summary').click();
  await page.locator('.court-matrix-cell[data-choice="'+first+'"][data-clue="'+firstClue+'"]').click();
  await expect(page.locator('.court-notebook')).toHaveAttribute('open','');
  await expect(page.locator('.court-matrix-cell[data-choice="'+first+'"][data-clue="'+firstClue+'"]')).toBeFocused();
  await fits(page);
  const moves=(await saved(page)).life.court.moves;
  await page.reload();await openCourt(page);
  expect((await saved(page)).life.court.moves).toEqual(moves);
  progress=currentCourt(await saved(page));expect(progress.eliminations).toContain(first);expect(progress.mistakes).toBe(1);
  for(const suspect of innocents)await compare(page,suspect,courtEvidence(game,suspect).findIndex(fit=>!fit));
  await page.locator('.court-action-bar [data-chapter="verdict"]').click();
  await expect(page.locator('.court-last-suspect')).toContainText('One suspect remains');
  await page.locator('[data-life="court-file"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#courtVerdictTitle')).toHaveText(game.suspects[game.answer].name+' did it.');
  await expect(page.locator('.court-sentence')).toContainText(game.trial.plea);
  await expect(page.locator('.court-sentence-order')).toHaveText('BY ORDER OF JUDGE MORTIS'+game.trial.sentence);
  const completed=await saved(page),result=currentCourt(completed).result;
  expect(result.stats).toMatchObject({eliminations:3,mistakes:1,appeals:0});expect(result.score).toBe(175);
  expect(completed.life.courtWins).toBe(snapshot.life.courtWins+1);expect(completed.life.courtPlays).toBe(snapshot.life.courtPlays+1);
  expect(completed.life.court.reward).toMatchObject({bond:1,reason:'ready'});expect(completed.life.court.reward.fuss).toBeGreaterThan(0);
  expect(completed.life.court.moves.filter(m=>m.type==='file')).toHaveLength(1);await fits(page);
  await page.reload();await openCourt(page);
  await expect(page.locator('#courtVerdictTitle')).toBeVisible();
  const restored=await saved(page);
  expect(restored.life.courtWins).toBe(completed.life.courtWins);expect(restored.life.courtPlays).toBe(completed.life.courtPlays);
  expect(restored.life.xp).toBe(completed.life.xp);expect(restored.life.court.reward).toEqual(completed.life.court.reward);
  expect(restored.life.court.moves.filter(m=>m.type==='file')).toHaveLength(1);
});

test('a saved old hearing supports a wrong accusation and keyboard recovery at 320px with drawn witnesses',async({page})=>{
  test.setTimeout(60_000);await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce'});
  const {game,snapshot}=await hearing(page,{reworked:false,kind:'drawing-heavy'});await inspect(page,game);
  const innocent=game.suspects.findIndex((_,i)=>i!==game.answer);
  await page.locator('.court-cast-picker [data-choice="'+innocent+'"]').click();
  await page.locator('.court-chapters [data-chapter="verdict"]').click();
  await page.locator('[data-life="court-file"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.court-dialogue')).toContainText('is cleared by clue');
  await expect(page.locator('[data-life="court-file"]')).toBeDisabled();
  const rejected=await saved(page);expect(rejected.life.court.claimed).toBe(false);expect(rejected.life.courtWins).toBe(snapshot.life.courtWins);
  expect(currentCourt(rejected).appeals).toBe(1);expect(rejected.life.court.version).toBe(2);
  await expect(page.locator('.court-dock-actor')).toHaveCSS('animation-name','none');await fits(page);
  await page.keyboard.press('Escape');await expect(page.locator('#lifeVeil')).not.toBeVisible();
  await expect(page.locator('#playroomVeil')).toBeVisible();
  await page.locator('[data-activity="court"]').click();
  const selected=page.locator('.court-cast-picker [data-choice="'+game.answer+'"]');await selected.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.court-record-facts').first()).toBeVisible();
  await page.locator('[data-life="court-file"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#courtVerdictTitle')).toHaveText(game.suspects[game.answer].name+' did it.');
  const completed=await saved(page);expect(completed.life.courtWins).toBe(snapshot.life.courtWins+1);
  expect(currentCourt(completed).result.stats.appeals).toBe(1);expect(completed.life.court.moves.filter(m=>m.type==='appeal')).toHaveLength(1);
  expect(completed.life.court.moves.filter(m=>m.type==='file')).toHaveLength(1);await fits(page);
});
