import {test,expect} from 'playwright/test';
import {householdFixture} from '../household-fixtures.mjs';

// Synthetic established learning tiers expose later lessons. Every round is
// completed with normal gesture-button input from the displayed demonstration.
async function openHandshake(page,tier,{encore=false,ritual='auto',opening=null}={}) {
 const snapshot=householdFixture();snapshot.settings.theatreOn=false;snapshot.lastBackup=Date.now();
 snapshot.pets[0].bond=20;snapshot.pets[0].mastery.handshake.tier=tier;
 if(opening)snapshot.pets[0].handshakeRituals={echo:{opening,completions:1,clean:1,at:Date.now()-10000}};
 await page.addInitScript(snapshot=>{if(!sessionStorage.getItem('handshake-fixture')){localStorage.setItem('shelflife.v4',JSON.stringify(snapshot));sessionStorage.setItem('handshake-fixture','1');}},snapshot);
 await page.goto('/');
 await page.locator('#playroomBtn:visible,#tabPlay:visible').first().click();
 await page.locator('[data-activity="memory"]').click();
 await page.locator('#handshakeRitual').selectOption(ritual);
 if(encore){await page.locator('#memorySetup summary').click();await page.locator('#playEncore').check();}
}
async function gestureTargets(page) {
 const boxes=await page.locator('[data-gesture]').evaluateAll(pads=>pads.map(pad=>{
  const r=pad.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  return {gesture:Number(pad.dataset.gesture),x,y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,
   viewportWidth:innerWidth,viewportHeight:innerHeight,hit:document.elementFromPoint(x,y)?.closest('[data-gesture]')?.dataset.gesture};
 }));
 for(const box of boxes){
  expect(box.left,'gesture '+box.gesture+' left').toBeGreaterThanOrEqual(0);
  expect(box.right,'gesture '+box.gesture+' right').toBeLessThanOrEqual(box.viewportWidth);
  expect(box.top,'gesture '+box.gesture+' top').toBeGreaterThanOrEqual(0);
  expect(box.bottom,'gesture '+box.gesture+' bottom').toBeLessThanOrEqual(box.viewportHeight);
  expect(box.hit,'unobstructed gesture '+box.gesture).toBe(String(box.gesture));
 }
 return boxes;
}
async function tapGesture(page,n,touch=false){
 const boxes=await gestureTargets(page),box=boxes[n];
 // Raw coordinates cannot auto-scroll a clipped control into reach.
 if(touch)await page.touchscreen.tap(box.x,box.y);else await page.mouse.click(box.x,box.y);
}
async function playRound(page,round,ritual,total) {
 await expect(page.locator('#playProgress')).toHaveText('Round '+round+' of '+total);
 await page.locator('#playStart').click();
 const announcement=await page.locator('#playAnnouncement').textContent();
 const gestures=announcement.split('Demonstration: ')[1].match(/Knock|Wiggle|Blink|Boop/g);
 expect(gestures).toHaveLength((round+1)*(ritual==='duet'?2:1));
 let pattern=ritual==='duet'?gestures.filter((_,i)=>i%2===1):ritual==='mirror'?gestures.toReversed():gestures;
 await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false',{timeout:20000});
 await gestureTargets(page);
 for(const gesture of pattern)await tapGesture(page,['Knock','Wiggle','Blink','Boop'].indexOf(gesture));
 if(round<total)await expect(page.locator('#playStart')).toHaveText('Watch round '+(round+1));
 else await expect(page.locator('#playProgress')).toHaveText('Complete · '+total+' rounds');
}
for(const scenario of [{tier:1,ritual:'echo',encore:false},{tier:2,ritual:'mirror',encore:false},{tier:3,ritual:'duet',encore:false},{tier:1,ritual:'echo',encore:true}]){
 test('Handshake '+scenario.ritual+(scenario.encore?' encore':' mastery')+' completes round four'+(scenario.encore?' and five':''),async({page})=>{
  test.setTimeout(150000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openHandshake(page,scenario.tier,{encore:scenario.encore});
  const total=scenario.encore?5:4;
  for(let round=1;round<=total;round++)await playRound(page,round,scenario.ritual,total);
  await expect(page.locator('#playAnnouncement')).toContainText('Handshake complete. '+total+' rounds remembered.');
  expect(errors).toEqual([]);
  await page.locator('#playClose').click();await page.reload();
  const pet=await page.evaluate(()=>JSON.parse(localStorage.getItem('shelflife.v4')).pets[0]);
  expect(pet.handshakeRituals[scenario.ritual].completions).toBe(1);
  expect(pet.handshakeBest[scenario.encore?'encore':scenario.ritual==='echo'?'standard':scenario.ritual].rounds).toBe(total);
 });
}

for(const opening of [[0,1],[1,1]])test('first sequence accepts rapid '+(opening[0]===opening[1]?'repeated second-pad':'first-to-second-pad')+' input',async({page},testInfo)=>{
 test.setTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openHandshake(page,1,{opening});
 await page.locator('#playStart').click();
 await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false');
 for(const n of opening){const pad=page.locator('[data-gesture="'+n+'"]');if(testInfo.project.use.hasTouch)await pad.tap();else await page.keyboard.press(String(n+1));}
 await expect(page.locator('#playStart')).toHaveText('Watch round 2');
 expect(errors).toEqual([]);
});

test('round four accepts consecutive fast repeated-pad taps and recovers from a wrong gesture',async({page},testInfo)=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openHandshake(page,1,{opening:[1,1]});
 for(let round=1;round<=3;round++)await playRound(page,round,'echo',4);
 await page.locator('#playStart').click();
 const announcement=await page.locator('#playAnnouncement').textContent();
 const pattern=announcement.split('Demonstration: ')[1].match(/Knock|Wiggle|Blink|Boop/g).map(g=>['Knock','Wiggle','Blink','Boop'].indexOf(g));
 expect(pattern.slice(0,2)).toEqual([1,1]);
 await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false',{timeout:15000});
 const enter=async n=>{const pad=page.locator('[data-gesture="'+n+'"]');if(testInfo.project.use.hasTouch)await pad.tap();else await page.keyboard.press(String(n+1));};
 await enter(0);
 await expect(page.locator('#playReplay')).toBeEnabled();
 await expect(page.locator('#playReplay')).toHaveText('Retry this round');
 await expect(page.locator('#playCue')).toHaveText('Wrong move · replay this round');
 await expect(page.locator('#playStatus')).toContainText('Repeat every move in the same order.');
 await expect(page.locator('#playProgress')).toHaveText('Round 4 of 4');
 await page.getByRole('button',{name:'Replay slowly',exact:true}).click();
 await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false',{timeout:15000});
 await enter(1);await enter(1);
 await expect(page.locator('#memoryTrail')).toHaveAttribute('aria-label','2 of 5 gestures remembered');
 for(const n of pattern.slice(2))await enter(n);
 await expect(page.locator('#playProgress')).toHaveText('Complete · 4 rounds');expect(errors).toEqual([]);
});


test('Duet first sequence and round four remain physically tappable without automatic scrolling',async({page},testInfo)=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(testInfo.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:740});
 await openHandshake(page,3);
 for(let round=1;round<=4;round++){
  await page.locator('#playStart').click();
  const announcement=await page.locator('#playAnnouncement').textContent();
  const pattern=announcement.split('Demonstration: ')[1].match(/Knock|Wiggle|Blink|Boop/g).filter((_,i)=>i%2===1);
  if(round===1){
   await expect(page.locator('#playStatus')).toContainText('Watch first. Gesture pads unlock after the demonstration.');
   await expect(page.locator('#playCue')).toContainText('Watch · Remember',{timeout:5000});
   await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','true');
  }
  await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false',{timeout:20000});
  await expect(page.locator('#playCue')).toHaveText('Your turn · your beats only');
  const positions=await gestureTargets(page);
  if(round===1||round===4)await testInfo.attach('round-'+round+'-hit-targets',{contentType:'application/json',body:JSON.stringify(positions)});
  for(const gesture of pattern)await tapGesture(page,['Knock','Wiggle','Blink','Boop'].indexOf(gesture),!!testInfo.project.use.hasTouch);
  if(round<4)await expect(page.locator('#playStart')).toHaveText('Watch round '+(round+1));
 }
 await expect(page.locator('#playProgress')).toHaveText('Complete · 4 rounds');expect(errors).toEqual([]);
});


test('interruption after the first tap explains the locked pads and resumes the same fourth round',async({page},testInfo)=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openHandshake(page,1,{opening:[0,1]});
 for(let round=1;round<=3;round++)await playRound(page,round,'echo',4);
 await page.locator('#playStart').click();
 const announcement=await page.locator('#playAnnouncement').textContent();
 const pattern=announcement.split('Demonstration: ')[1].match(/Knock|Wiggle|Blink|Boop/g).map(g=>['Knock','Wiggle','Blink','Boop'].indexOf(g));
 await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false',{timeout:15000});
 await tapGesture(page,pattern[0],!!testInfo.project.use.hasTouch);
 await expect(page.locator('#memoryTrail')).toHaveAttribute('aria-label','1 of 5 gestures remembered');
 // Simulate the browser's app-switch/blur event, not a victory or game mutation.
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(page.locator('#playCue')).toHaveText('Paused · resume this round');
 await expect(page.locator('#playReplay')).toHaveText('Resume this round');
 await expect(page.locator('#playReplay')).toBeEnabled();
 await expect(page.locator('#playStatus')).toContainText('Gesture pads are paused');
 await tapGesture(page,pattern[1],!!testInfo.project.use.hasTouch);
 await expect(page.locator('#memoryTrail')).toHaveAttribute('aria-label','0 of 5 gestures remembered');
 await expect(page.locator('#playProgress')).toHaveText('Round 4 of 4');
 await page.getByRole('button',{name:'Resume this round',exact:true}).click();
 await expect(page.locator('#playAnnouncement')).toHaveText(announcement);
 await expect(page.locator('#playReplay')).toHaveText('Replay pattern');
 await expect(page.locator('[data-gesture="0"]')).toHaveAttribute('aria-disabled','false',{timeout:15000});
 for(const n of pattern)await tapGesture(page,n,!!testInfo.project.use.hasTouch);
 await expect(page.locator('#playProgress')).toHaveText('Complete · 4 rounds');
 expect(errors).toEqual([]);
});
