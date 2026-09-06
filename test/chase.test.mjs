import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newChase, updateChase, jumpChase, recordChase, chaseStars, CHASE_SECONDS, CHASE_POINTS, RUSH_SECONDS} from '../src/engine/chase.js';
import {blankState, normalizeState} from '../src/state.js';
import {newHandshake, tapHandshake, rewardHandshake, PLAY_COOLDOWN} from '../src/engine/play.js';
import {advanceStories, advanceCase, caseGate} from '../src/engine/stories.js';
const now = new Date(2026,8,5,12).getTime();
const pet = (stamps=[]) => ({id:'p',name:'Pip',traits:[],art:{body:'',stamps:stamps.map(kind=>({kind}))},needs:{food:60,fuss:50,clean:70},bond:1,cared:0});
function rng(seed) {let x=seed;return ()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};}
function play(g) {
  while(!g.finished) {
    const target=g.items.filter(i=>i.kind==='crumb').sort((a,b)=>a.z-b.z)[0]?.x??160;
    if(g.items.some(i=>i.kind==='bunny' && Math.abs(i.x-g.player.x)<65))jumpChase(g);
    updateChase(g,{targetX:target},1/60);
  }
  return g;
}
function scene(p=pet()) {const g=newChase(p);for(const k of ['nextCrumb','nextBunny','nextMoth','nextBiscuit','nextSugar'])g[k]=100;return g;}
test('steering moves the resident continuously and stays within the board',()=>{
  const g=scene();updateChase(g,{axis:1},.1);assert.ok(g.player.x>160&&g.player.x<190);assert.equal(g.player.moving,true);
  for(let i=0;i<30;i++)updateChase(g,{axis:1},.1);assert.equal(g.player.x,294);
  for(let i=0;i<40;i++)updateChase(g,{axis:-1},.1);assert.equal(g.player.x,26);assert.equal(g.player.direction,-1);
});
test('jumps leave the ground, land, and wings provide a real extra flap',()=>{
  const walker=scene();assert.equal(jumpChase(walker),true);assert.equal(jumpChase(walker),false);
  updateChase(walker,{},.25);assert.ok(walker.player.z>45);
  for(let i=0;i<10;i++)updateChase(walker,{},.1);assert.equal(walker.player.z,0);
  const flyer=scene(pet(['wing']));jumpChase(flyer);updateChase(flyer,{},.25);updateChase(flyer,{},.1);
  assert.ok(flyer.player.z>walker.player.z);assert.equal(jumpChase(flyer),true);assert.equal(jumpChase(flyer),false);
});
test('crumb collisions require the resident, award once, and gold and air catches score extra',()=>{
  const g=scene();g.items=[{id:1,kind:'crumb',x:160,z:27,vy:0,age:0,floorTime:0}];
  assert.ok(updateChase(g,{},1/60).some(e=>e.type==='catch'));assert.equal(g.caught,1);assert.equal(g.score,10);
  updateChase(g,{},.1);assert.equal(g.caught,1);
  g.player.z=50;g.player.vy=0;g.items=[{id:2,kind:'crumb',gold:true,x:160,z:77,vy:0,age:0,floorTime:0}];
  updateChase(g,{},1/60);assert.equal(g.score,45);assert.equal(g.airCatches,1);
});
test('dust breaks the combo, horns block a hit, and a jumped bunny cannot hit again',()=>{
  const bunny=()=>({id:1,kind:'bunny',x:160,z:10,vx:90,age:0,dodged:false});
  const g=scene();g.score=40;g.combo=4;g.items=[bunny()];updateChase(g,{},1/60);
  assert.equal(g.bumps,1);assert.equal(g.score,35);assert.equal(g.combo,0);assert.equal(g.items.length,0);
  const horned=scene(pet(['horns']));horned.items=[bunny()];assert.ok(updateChase(horned,{},1/60).some(e=>e.type==='shield'));assert.equal(horned.bumps,0);assert.equal(horned.shield,0);
  const jumper=scene();jumper.player.z=50;jumper.items=[bunny()];updateChase(jumper,{},1/60);assert.equal(jumper.dodged,1);
  jumper.player.z=0;updateChase(jumper,{},1/60);assert.equal(jumper.bumps,0);assert.equal(jumper.dodged,1);
});
test('halo attraction and gentle catches visibly affect collection range',()=>{
  for(const [stamps,gentle,want] of [[[],false,0],[['halo'],false,1],[[],true,1]]) {
    const g=newChase(pet(stamps),{gentle});g.items=[{id:1,kind:'crumb',x:190,z:27,vy:0,age:0,floorTime:0}];
    updateChase(g,{},1/60);assert.equal(g.caught,want);
  }
});
test('doing nothing loses the standard chase; an active strategy can win across bodies and seeds',()=>{
  for(let seed=1;seed<=8;seed++) {
    const idle=newChase(pet(),{rng:rng(seed)});while(!idle.finished)updateChase(idle,{},1/60);assert.equal(idle.complete,false);
    for(const stamps of [[],['legs','arms'],['wing'],['horns'],['halo']]) {
      const g=play(newChase(pet(stamps),{rng:rng(seed)}));assert.equal(g.complete,true,JSON.stringify({seed,stamps,caught:g.caught}));assert.equal(g.time,CHASE_SECONDS);
    }
  }
});
test('time, collisions and scoring stay consistent across 30 and 60 FPS',()=>{
  const a=newChase(pet(),{rng:rng(21)}),b=newChase(pet(),{rng:rng(21)});
  while(!a.finished)updateChase(a,{axis:1},1/60);
  while(!b.finished)updateChase(b,{axis:1},1/30);
  assert.equal(a.time,b.time);assert.equal(a.score,b.score);assert.equal(a.caught,b.caught);
  const time=a.time;assert.deepEqual(updateChase(a,{},.1),[]);assert.equal(a.time,time);
});
test('chase rewards are earned once, share the handshake cooldown, and preserve personal bests',()=>{
  const s=blankState(),p=pet();s.pets=[p];s.slots[0]=p.id;s.lastTick=now;advanceStories(s,now);
  const unfinished=scene(p);assert.equal(recordChase(p,unfinished,now),false);assert.equal(rewardHandshake(s,unfinished,now),null);
  const g=play(newChase(p,{rng:rng(2)}));assert.equal(recordChase(p,g,now),true);const best=p.chaseBest.score;
  assert.deepEqual(rewardHandshake(s,g,now),{practice:false,fuss:24,bond:1});assert.equal(p.chases,1);assert.equal(s.stories.chases,1);assert.equal(p.needs.clean,70);
  assert.equal(rewardHandshake(s,g,now),null);
  const h=newHandshake(p);for(let n=0;n<3;n++)for(const x of h.sequence.slice(0,n+2))tapHandshake(h,x);
  assert.equal(rewardHandshake(s,h,now+100).practice,true);
  assert.equal(normalizeState(s).pets[0].chaseBest.score,best);
  const later=play(newChase(p,{rng:rng(3)}));assert.equal(rewardHandshake(s,later,now+PLAY_COOLDOWN).practice,false);
});
test('well-cared-for existing shelves can progress case evidence through active play',()=>{
  const s=blankState(),p=pet();s.pets=[p];s.slots[0]=p.id;s.lastTick=now;p.needs={food:100,fuss:100,clean:100};advanceStories(s,now);advanceCase(s,'listen',now);
  assert.equal(caseGate(s).ready,false);const g=play(newChase(p,{rng:rng(4)}));rewardHandshake(s,g,now);assert.equal(caseGate(s).ready,true);
});
test('landing on a dust bunny from above stomps it: points, streak, a bounce, and a bigger bounce with a tail',()=>{
  const bunny=()=>({id:1,kind:'bunny',x:160,z:10,vx:90,age:0,dodged:false});
  const g=scene();g.player.z=20;g.player.vy=-80;g.items=[bunny()];
  const stomp=updateChase(g,{},1/60).find(e=>e.type==='stomp');
  assert.ok(stomp);assert.equal(stomp.points,CHASE_POINTS.stomp);assert.equal(stomp.id,1);assert.equal(stomp.tail,false);
  assert.equal(g.stomps,1);assert.equal(g.bumps,0);assert.equal(g.combo,1);assert.equal(g.bestCombo,1);assert.equal(g.score,20);
  assert.equal(g.items.length,0);assert.ok(g.player.vy>150,'a short bounce');
  const tailed=scene(pet(['tail']));tailed.player.z=20;tailed.player.vy=-80;tailed.items=[bunny()];
  assert.equal(updateChase(tailed,{},1/60).find(e=>e.type==='stomp').tail,true);assert.ok(tailed.player.vy>g.player.vy+40,'tails bounce higher');
  const rising=scene();rising.player.z=10;rising.player.vy=200;rising.items=[bunny()];updateChase(rising,{},1/60);
  assert.equal(rising.bumps,1);assert.equal(rising.stomps,0,'jumping into a bunny is still a bump');
  const jumper=scene();jumper.player.z=40;jumper.player.vy=-300;jumper.items=[bunny()];let seen=[];
  for(let i=0;i<8;i++)seen=seen.concat(updateChase(jumper,{},1/60).map(e=>e.type));
  assert.deepEqual(seen.filter(t=>t==='dodge'||t==='stomp'),['dodge','stomp']);assert.equal(jumper.bumps,0);assert.equal(jumper.score,35);
});
test('a moth drifts, steals a resting crumb unless caught, and is worth 20 when caught',()=>{
  const g=scene();g.player.x=40;g.combo=3;
  g.items=[{id:1,kind:'crumb',x:200,z:10,vy:0,age:0,floorTime:0},{id:2,kind:'moth',x:170,z:60,vx:56,age:0,carrying:false}];
  let steal=null;for(let i=0;i<60&&!steal;i++)steal=updateChase(g,{},1/60).find(e=>e.type==='steal');
  assert.ok(steal);assert.equal(steal.id,1);assert.equal(g.stolen,1);assert.equal(g.combo,0);assert.equal(g.items.some(i=>i.kind==='crumb'),false);
  const moth=g.items.find(i=>i.kind==='moth');assert.equal(moth.carrying,true);
  const z=moth.z;updateChase(g,{},.2);assert.ok(moth.z>z+10,'a moth leaves upward with its crumb');
  const catcher=scene();catcher.items=[{id:3,kind:'moth',x:160,z:40,vx:-56,age:0,carrying:false}];
  const caught=updateChase(catcher,{},1/60).find(e=>e.type==='catch');
  assert.equal(caught.kind,'moth');assert.equal(caught.points,CHASE_POINTS.moth);assert.equal(catcher.moths,1);assert.equal(catcher.caught,0,'moths do not count toward the crumb goal');assert.equal(catcher.combo,1);assert.equal(catcher.items.length,0);
});
test('a biscuit falls slowly and pays 50 only if caught before it lands',()=>{
  const g=scene();g.player.x=40;g.combo=2;g.items=[{id:1,kind:'biscuit',x:200,z:182,vy:-42,age:0}];
  for(let i=0;i<4;i++)updateChase(g,{},.25);assert.ok(g.items[0].z>138&&g.items[0].z<142,'about 42 a second');
  let crumble=null;for(let i=0;i<300&&!crumble;i++)crumble=updateChase(g,{},1/60).find(e=>e.type==='crumble');
  assert.ok(crumble);assert.equal(crumble.id,1);assert.equal(g.items.length,0);assert.equal(g.score,0);assert.equal(g.biscuits,0);assert.equal(g.combo,2,'a landed biscuit costs nothing');
  const catcher=scene();catcher.items=[{id:2,kind:'biscuit',x:160,z:50,vy:-42,age:0}];
  const caught=updateChase(catcher,{},1/60).find(e=>e.type==='catch');
  assert.equal(caught.kind,'biscuit');assert.equal(caught.points,CHASE_POINTS.biscuit);assert.equal(catcher.biscuits,1);assert.equal(catcher.score,50);assert.equal(catcher.caught,0);
  const gentle=newChase(pet(),{gentle:true});for(const k of ['nextCrumb','nextBunny','nextMoth','nextSugar'])gentle[k]=100;gentle.nextBiscuit=0;
  updateChase(gentle,{},1/60);assert.equal(gentle.items.find(i=>i.kind==='biscuit').vy,-34,'gentle biscuits fall slower');
});
test('a sugar cube starts a rush: faster steering and a crumb magnet that wears off; it lands away from the resident',()=>{
  const g=scene();g.items=[{id:1,kind:'sugar',x:160,z:40,vy:-70,age:0,floorTime:0}];
  const up=updateChase(g,{},1/60).find(e=>e.type==='powerup');
  assert.equal(up.kind,'sugar');assert.equal(up.seconds,RUSH_SECONDS);assert.equal(g.rush,RUSH_SECONDS);assert.equal(g.powerups,1);assert.equal(g.items.length,0);assert.equal(g.score,0);
  updateChase(g,{axis:1},.1);const plain=scene();updateChase(plain,{axis:1},.1);
  assert.ok(g.player.x-160>(plain.player.x-160)*1.2,'rush steering is faster');
  g.player.x=160;g.items=[{id:2,kind:'crumb',x:215,z:10,vy:0,age:0,floorTime:0}];updateChase(g,{},.1);assert.ok(g.items[0].x<205,'the rush pulls crumbs in');
  const still=scene();still.items=[{id:3,kind:'crumb',x:215,z:10,vy:0,age:0,floorTime:0}];updateChase(still,{},.1);assert.equal(still.items[0].x,215);
  let ended=false;for(let i=0;i<50&&!ended;i++)ended=updateChase(g,{},.1).some(e=>e.type==='rushEnd');assert.ok(ended);assert.equal(g.rush,0);
  const gentle=newChase(pet(),{gentle:true});gentle.items=[{id:4,kind:'sugar',x:160,z:40,vy:-70,age:0,floorTime:0}];updateChase(gentle,{},1/60);assert.equal(gentle.rush,RUSH_SECONDS+1);
  const melt=scene();melt.player.x=40;melt.items=[{id:5,kind:'sugar',x:200,z:10,vy:0,age:0,floorTime:0}];
  let melted=null;for(let i=0;i<40&&!melted;i++)melted=updateChase(melt,{},.1).find(e=>e.type==='melt');assert.ok(melted);assert.equal(melt.items.length,0);
  for(const x of [26,160,294]){const drop=scene();drop.player.x=x;drop.nextSugar=0;updateChase(drop,{},1/60);assert.ok(Math.abs(drop.items.find(i=>i.kind==='sugar').x-x)>=80,'sugar drops out of reach at '+x);}
});
test('difficulty ramps: bunnies get faster and closer together, and early on only one hazard type is on screen',()=>{
  const counts={};
  for(const gentle of [false,true]){
    const g=newChase(pet(),{rng:rng(7),gentle});const seen=new Set(),bunnies=[];let moths=0,overlap=0;
    while(!g.finished){
      updateChase(g,{},1/60);
      for(const i of g.items)if(!seen.has(i.id)){seen.add(i.id);if(i.kind==='bunny')bunnies.push({t:g.time,v:Math.abs(i.vx)});if(i.kind==='moth')moths++;}
      if(g.time<12&&g.items.some(i=>i.kind==='bunny')&&g.items.some(i=>i.kind==='moth'))overlap++;
    }
    assert.equal(overlap,0);counts[gentle?'gentle':'standard']={bunnies:bunnies.length,moths};
    const gaps=bunnies.slice(1).map((s,i)=>s.t-bunnies[i].t);
    if(gentle)assert.ok(bunnies.every(s=>s.v===64),'gentle bunnies never speed up');
    else{assert.ok(bunnies.at(-1).v>bunnies[0].v+15,'later bunnies are faster');assert.ok(gaps.at(-1)<gaps[0]-.5,'later bunnies arrive closer together');}
  }
  assert.ok(counts.standard.bunnies>=5&&counts.standard.moths>=1);
  assert.ok(counts.gentle.bunnies<counts.standard.bunnies&&counts.gentle.moths<=counts.standard.moths,'gentle stays gentle');
});
test('star ratings follow crumbs and score, and personal bests keep the best streak and rating',()=>{
  const g=scene();g.caught=5;g.score=400;assert.equal(chaseStars(g),1);
  g.caught=8;g.score=100;assert.equal(chaseStars(g),2);
  g.caught=13;g.score=359;assert.equal(chaseStars(g),2);g.score=360;assert.equal(chaseStars(g),3);g.caught=12;assert.equal(chaseStars(g),2);
  const soft=newChase(pet(),{gentle:true});soft.caught=11;soft.score=270;assert.equal(chaseStars(soft),3);
  const p=pet();const first=scene(p);first.finished=true;first.caught=9;first.score=150;first.bestCombo=6;
  assert.equal(recordChase(p,first,now),true);assert.deepEqual(p.chaseBest,{score:150,caught:9,dodged:0,at:now,bestStreak:6,stars:2});
  const worse=scene(p);worse.finished=true;worse.caught=13;worse.score=140;worse.bestCombo=9;
  assert.equal(recordChase(p,worse,now+1),false);assert.equal(p.chaseBest.score,150);assert.equal(p.chaseBest.bestStreak,9);assert.equal(p.chaseBest.stars,2);
  const better=scene(p);better.finished=true;better.caught=13;better.score=400;better.bestCombo=4;
  assert.equal(recordChase(p,better,now+2),true);assert.deepEqual(p.chaseBest,{score:400,caught:13,dodged:0,at:now+2,bestStreak:9,stars:3});
  const full=play(newChase(p,{rng:rng(5)}));assert.equal(full.stars,chaseStars(full));assert.ok(full.stars>=1&&full.stars<=3);
  const s=blankState();s.pets=[p];s.slots[0]=p.id;p.chaseBest.stars=9;p.chaseBest.bestStreak=-3;
  const kept=normalizeState(s).pets[0].chaseBest;assert.equal(kept.stars,3);assert.equal(kept.bestStreak,0);assert.equal(kept.score,400);
});
test('no chase event touches the resident, its needs, or the shelf; rewards only ever add',()=>{
  for(let seed=1;seed<=6;seed++)for(const stamps of [[],['wing'],['horns'],['halo'],['tail']]){
    const p=pet(stamps);const before=JSON.stringify(p);const hugger=newChase(p,{rng:rng(seed)});let low=0;
    while(!hugger.finished){for(const e of updateChase(hugger,{axis:seed%2?1:-1},1/60))if(e.points<0)low++;if(hugger.score<0)low++;}
    assert.equal(low,0);assert.ok(hugger.bumps+hugger.stolen+hugger.dodged>0,'the wall-hugger meets some dust');
    const g=play(newChase(p,{rng:rng(seed)}));assert.equal(JSON.stringify(p),before,'the engine never writes to the pet');
    const s=blankState();s.pets=[p];s.slots[0]=p.id;s.lastTick=now;const shelf=JSON.stringify({slots:s.slots,props:s.props});
    const needs={...p.needs};rewardHandshake(s,g,now);
    for(const k of Object.keys(needs))assert.ok(p.needs[k]>=needs[k]&&p.needs[k]<=100,k+' never drops');
    assert.equal(JSON.stringify({slots:s.slots,props:s.props}),shelf);
  }
});
