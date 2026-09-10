import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {OUTINGS,GEAR,OUTING_TRAIL_SCENES,OUTING_ALTERNATES} from '../src/content/life.js';
import {OUTING_DARES,startOuting,chooseOuting,outingSnapshot,finishOuting} from '../src/engine/life.js';

const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.life.introDone=true;s.pets=[{id:'a',name:'Pip',traits:[],stats:{cute:3,menace:3,damp:3,mystique:3},needs:{food:65,fuss:65,clean:65},art:{},bond:0}];s.slots[0]='a';return s;}

test('an expedition wager pays only on the completed history, survives reload, and keeps a repeat bounded',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a'],{dare:'bold',edition:0});
 for(const move of [1,0]){chooseOuting(s,move,now);assert.equal(outingSnapshot(s).dareBonus,0);s=normalizeState(s);assert.equal(s.life.outing.dare,'bold');}
 chooseOuting(s,1,now);let m=outingSnapshot(s);assert.equal(m.baseScore,6);assert.equal(m.dareBonus,2);assert.equal(m.score,8);
 const xp=s.life.xp,count=s.life.outings;s=normalizeState(s);assert.deepEqual(outingSnapshot(s),m);assert.equal(chooseOuting(s,1,now),null);assert.equal(s.life.outings,count);
 finishOuting(s);startOuting(s,'drawer','thread',['a'],{dare:'bold',edition:0});for(const c of [1,0,1])chooseOuting(s,c,now);assert.equal(s.life.xp,xp);
});

test('equipment and nerve wagers reward different concrete plans without penalising a missed wager',()=>{
 const paths=[['thrifty',[1,0,1],2],['thrifty',[2,0,1],0],['steady',[2,1,0],2],['steady',[1,0,1],0]];
 for(const [dare,moves,bonus] of paths){const s=fixture();startOuting(s,'drawer','thread',['a'],{dare,edition:0});for(const c of moves)assert.ok(chooseOuting(s,c,now));const m=outingSnapshot(s);assert.equal(m.dareBonus,bonus);assert.equal(m.score,m.baseScore+bonus);}
});

test('reported wager targets are reachable for each route, tool, and wager',()=>{
 for(const route of OUTINGS)for(const gear of GEAR)for(const dare of OUTING_DARES){
  let actual=-1,target;
  for(let n=0;n<27;n++){
   const s=fixture();startOuting(s,route.id,gear.id,['a'],{edition:3,dare:dare.id});target=outingSnapshot(s).best;
   let valid=true;for(const c of [n%3,Math.floor(n/3)%3,Math.floor(n/9)])if(!chooseOuting(s,c,now)){valid=false;break;}
   if(valid)actual=Math.max(actual,outingSnapshot(s).score);
  }
  assert.equal(target,actual,`${route.id}/${gear.id}/${dare.id}`);
 }
});

test('every selectable quiet path has an authored outcome and malformed wagers grant nothing',()=>{
 for(const book of [OUTING_TRAIL_SCENES,OUTING_ALTERNATES])for(const steps of Object.values(book))for(const step of steps)assert.ok(typeof step.quiet==='string'&&step.quiet.length>30,step.title);
 const s=fixture();startOuting(s,'drawer','thread',['a'],{dare:'invented'});assert.equal(s.life.outing.dare,undefined);
 for(const c of [1,0,1])chooseOuting(s,c,now);assert.equal(outingSnapshot(s).score,6);
});
