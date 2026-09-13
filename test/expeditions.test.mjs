import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {OUTINGS,GEAR} from '../src/content/life.js';
import {lifeState,startOuting,chooseOuting,finishOuting,outingSnapshot,outingTrail} from '../src/engine/life.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(stats=3){const s=blankState();s.lastTick=now;s.life.introDone=true;s.pets=[{id:'a',name:'Pip',traits:[],stats:{cute:stats,menace:stats,damp:stats,mystique:stats},needs:{food:60,fuss:60,clean:60},bond:0,cared:0,art:{}}];s.slots[0]='a';return s;}
function plan(s,moves){let result;for(const move of moves){result=chooseOuting(s,move,now);if(!result)return null;}return result;}

test('new trails have consequential resource choices rather than repeatable equipment checks',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['a']);
 let view=outingSnapshot(s);assert.equal(view.nerve,2);assert.equal(view.options.length,3);
 assert.ok(chooseOuting(s,1,now));view=outingSnapshot(s);assert.equal(view.nerve,0);assert.equal(view.score,2);
 const before=structuredClone(s.life.outing);assert.equal(chooseOuting(s,1,now),null);assert.deepEqual(s.life.outing,before,'an unaffordable detour is atomic');
 assert.ok(chooseOuting(s,0,now));assert.equal(outingSnapshot(s).nerve,2);
 const end=chooseOuting(s,1,now);assert.equal(end.relic.id,'drawer:2');assert.equal(outingSnapshot(s).score,6);
 assert.equal(s.pets[0].needs.food,60);assert.equal(s.pets[0].needs.clean,60);assert.equal(s.pets[0].needs.fuss,68);
});

test('the packed tool is used once, and saving a matching tool changes the result',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['a']);assert.ok(chooseOuting(s,2,now));
 assert.equal(outingSnapshot(s).score,3);assert.equal(outingSnapshot(s).nerve,2);
 const before=structuredClone(s.life.outing);assert.equal(chooseOuting(s,2,now),null);assert.deepEqual(s.life.outing,before);
 assert.equal(outingSnapshot(s).options[2].available,false);assert.match(outingSnapshot(s).options[2].hint,/already used/);
 plan(s,[0,1]);assert.equal(outingSnapshot(s).score,7);
 const other=fixture();startOuting(other,'drawer','thread',['a']);plan(other,[1,0,2]);assert.equal(outingSnapshot(other).score,5,'using the same tool at a different stop trades away a more valuable detour');
});

test('crew strengths reduce nerve cost and stay stable for a saved expedition',()=>{
 let s=fixture(8);startOuting(s,'drawer','lantern',['a']);
 assert.match(outingSnapshot(s).options[1].hint,/costs 1 nerve/);
 chooseOuting(s,1,now);s.pets[0].stats={cute:1,menace:1,damp:1,mystique:1};s=normalizeState(s);
 assert.match(outingSnapshot(s).options[1].hint,/costs 1 nerve/);chooseOuting(s,2,now);const end=chooseOuting(s,1,now);
 assert.equal(end.relic.id,'drawer:2');assert.equal(outingSnapshot(s).score,9);
});

test('trip resources, scenery, choices and claim state survive every reload',()=>{
 let s=fixture();startOuting(s,'fridge','biscuit',['a'],{edition:5});
 for(const move of [2,0,1]){assert.ok(chooseOuting(s,move,now));const before=outingSnapshot(s);s=normalizeState(s);assert.deepEqual(outingSnapshot(s),before);}
 const xp=s.life.xp,count=s.life.outings;assert.equal(chooseOuting(s,0,now),null);assert.equal(s.life.xp,xp);assert.equal(s.life.outings,count);assert.equal(s.pets[0].expeditions,1);
 assert.ok(finishOuting(s));assert.equal(finishOuting(s),false);
});

test('every trail edition has distinct saved scenery and repeatable choices',()=>{
 for(const route of OUTINGS){const titles=new Set();for(let edition=0;edition<8;edition++){
  const s=fixture();startOuting(s,route.id,'thread',['a'],{edition});titles.add(outingSnapshot(s).steps.map(x=>x.title).join('|'));
  assert.deepEqual(outingSnapshot(s).steps,outingTrail(route.id,edition));
  plan(s,[0,0,0]);finishOuting(s);startOuting(s,route.id,'thread',['a'],{edition});assert.deepEqual(outingSnapshot(s).steps,outingTrail(route.id,edition));
 }assert.equal(titles.size,8);}
});

test('replaying a completed trip repeats the challenge without duplicating discovery rewards',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['a'],{edition:0});plan(s,[2,0,1]);const xp=s.life.xp;finishOuting(s);
 startOuting(s,'drawer','thread',['a'],{edition:0});const end=plan(s,[2,0,1]);assert.equal(end.fresh,false);assert.equal(s.life.xp,xp);assert.equal(s.life.outings,2);
});

for(const route of OUTINGS)test(route.name+' has all three reachable new prizes and honest possible-score feedback',()=>{
 const prizes=new Set();
 for(const stats of [3,8])for(const gear of GEAR)for(let edition=0;edition<8;edition++){
  let actualBest=0,reportedBest=0;
  for(let pattern=0;pattern<27;pattern++){
   const s=fixture(stats);startOuting(s,route.id,gear.id,['a'],{edition});reportedBest=outingSnapshot(s).best;
   const end=plan(s,[pattern%3,Math.floor(pattern/3)%3,Math.floor(pattern/9)]);
   if(end){prizes.add(end.relic.id);actualBest=Math.max(actualBest,outingSnapshot(s).score);}
  }
  assert.equal(reportedBest,actualBest,`${route.id}/${gear.id}/${edition}/${stats}`);
 }
 assert.deepEqual([...prizes].sort(),[0,1,2].map(t=>route.id+':'+t));
});

test('corrupt saved trail resources are rebuilt from the legal decision prefix',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a']);chooseOuting(s,1,now);
 Object.assign(s.life.outing,{score:999,nerve:999,toolUsed:true,choices:[1,1,2],step:3});s=normalizeState(s);
 const view=outingSnapshot(s);assert.equal(view.step,1);assert.equal(view.nerve,0);assert.equal(view.score,2);assert.equal(view.toolUsed,false);assert.deepEqual(view.choices,[1]);assert.equal(s.life.relics.length,0);
});

test('bad new-expedition requests do not replace a trip or award anything',()=>{
 const s=fixture();for(const args of [['bad','thread',['a']],['drawer','bad',['a']],['drawer','thread',null],['drawer','thread',['missing']]])assert.equal(startOuting(s,...args),false);
 assert.equal(lifeState(s).outing,null);startOuting(s,'drawer','thread',['a','a']);assert.deepEqual(s.life.outing.cast,['a']);
 for(const move of [-1,3,NaN,'1',undefined,{}])assert.equal(chooseOuting(s,move,now),null);
 assert.equal(outingSnapshot(s).step,0);
});

test('reopening a trip whose entire crew was rehomed returns to planning without rewards',()=>{
 for(const legacy of [false,true]){
  const s=fixture();startOuting(s,'drawer','thread',['a']);
  if(legacy)delete s.life.outing.version;
  chooseOuting(s,0,now);
  s.pets[0].id='replacement';s.slots[0]='replacement';
  const xp=s.life.xp;
  assert.equal(outingSnapshot(s),null);
  assert.equal(s.life.outing,null);
  assert.equal(s.life.xp,xp);assert.equal(s.life.outings,0);assert.equal(s.life.relics.length,0);
  assert.equal(startOuting(s,'fridge','biscuit',['replacement']),true,'the new resident can set out immediately');
 }
});

test('a restored completion receipt cannot pay again after a damaged decision log is repaired',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a']);plan(s,[2,0,1]);
 const earned={xp:s.life.xp,outings:s.life.outings,expeditions:s.pets[0].expeditions,fuss:s.pets[0].needs.fuss,relics:s.life.relics.slice()};
 s.life.outing.choices=[2,2,1]; // The second use of the one-shot tool cannot be replayed.
 s=normalizeState(s);
 assert.equal(outingSnapshot(s),null,'retire the damaged report instead of reopening an already paid trip');
 assert.equal(s.life.outing,null);
 assert.equal(chooseOuting(s,0,now),null);
 assert.deepEqual({xp:s.life.xp,outings:s.life.outings,expeditions:s.pets[0].expeditions,fuss:s.pets[0].needs.fuss,relics:s.life.relics},earned);
 assert.equal(startOuting(s,'drawer','thread',['a']),true);
});
