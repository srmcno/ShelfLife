import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newChase, updateChase, jumpChase, recordChase, CHASE_SECONDS} from '../src/engine/chase.js';
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
function scene(p=pet()) {const g=newChase(p);g.nextCrumb=100;g.nextBunny=100;return g;}
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
