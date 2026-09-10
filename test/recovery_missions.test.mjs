import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {lifeState,startOuting,outingSnapshot,chooseOuting,finishOuting,useProject,returnFromMission} from '../src/engine/life.js';
import {PROJECTS,PROJECT_STOPS} from '../src/content/projects.js';
import {GEAR} from '../src/content/life.js';
import {curioSVG} from '../src/art/curios.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.lastTick=now;s.pets=[{id:'p',name:'Professor Crumb',traits:[],stats:{cute:1,menace:1,damp:1,mystique:1},needs:{food:50,clean:50,fuss:50},bond:0,art:{}}];s.slots[0]='p';return s;}
const copy=s=>normalizeState(JSON.parse(JSON.stringify(s)));
function paths(s){const o=outingSnapshot(s);if(o.step===3)return [{state:s,parts:o.parts.length,score:o.score}];return o.options.filter(x=>x.available).flatMap(x=>{const n=copy(s);assert.ok(chooseOuting(n,x.choice,now));return paths(n);});}
test('each recovery mission can build its device in one trip with any packed tool and an unskilled solo crew',()=>{
 for(const p of PROJECTS)for(const gear of GEAR){
  const s=fixture();assert.ok(startOuting(s,p.id,gear.id,['p'],{mission:true}));
  const best=outingSnapshot(s).best,ends=paths(s),winners=ends.filter(e=>e.parts>=2);
  assert.ok(winners.length,p.id+' / '+gear.id+' must have an achievable objective');
  assert.equal(Math.max(...ends.map(e=>e.score)),best,'The advertised best is attainable using visible, legal options');
  for(const w of winners){assert.ok(w.state.life.projects.includes(p.id));assert.equal(w.state.life.outings,1);assert.equal(chooseOuting(w.state,1,now),null);}
 }
});
test('different parts accumulate across trips, repeated parts cannot substitute, and installation pays once',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['p'],{mission:true});
 [1,0,0].forEach(c=>chooseOuting(s,c,now));assert.deepEqual(s.life.projectParts.drawer,[0]);assert.deepEqual(s.life.projects,[]);finishOuting(s);
 startOuting(s,'drawer','thread',['p'],{mission:true});[1,0,0].forEach(c=>chooseOuting(s,c,now));assert.deepEqual(s.life.projects,[]);finishOuting(s);
 startOuting(s,'drawer','thread',['p'],{mission:true});[0,2,0].forEach(c=>chooseOuting(s,c,now));
 assert.deepEqual(s.life.projectParts.drawer,[0,1]);assert.deepEqual(s.life.projects,['drawer']);assert.equal(s.life.outing.result.built,true);
 const xp=s.life.xp;s=copy(s);assert.equal(outingSnapshot(s).result.built,true);assert.equal(s.life.xp,xp);assert.equal(chooseOuting(s,1,now),null);
 finishOuting(s);startOuting(s,'drawer','thread',['p'],{mission:true});[0,2,0].forEach(c=>chooseOuting(s,c,now));assert.equal(s.life.outing.result.built,false);assert.equal(s.life.awards.filter(x=>x==='built:drawer').length,1);
});
test('save restoration retains the contract and tool use while deriving resources from legal decisions',()=>{
 let s=fixture();startOuting(s,'fridge','lantern',['p'],{mission:true});
 chooseOuting(s,2,now);const before=outingSnapshot(s);s.life.outing.score=999;s.life.outing.nerve=999;s=copy(s);
 const after=outingSnapshot(s);assert.equal(after.mission,true);assert.equal(after.score,before.score);assert.deepEqual(after.recovered,[0]);assert.equal(after.toolUsed,true);assert.equal(after.steps[1].title,PROJECT_STOPS.fridge[1].title);
 assert.equal(chooseOuting(s,2,now),null,'Spent or mismatched tools cannot fabricate a component');
 chooseOuting(s,0,now);chooseOuting(s,1,now);assert.ok(s.life.projects.includes('fridge'));
});
test('installed devices provide the promised care once each day and remain playable afterwards',()=>{
 const s=fixture();lifeState(s);assert.equal(useProject(s,'drawer',now),null);
 for(const p of PROJECTS){s.life.projects.push(p.id);s.pets[0].needs[p.need]=95;assert.equal(useProject(s,p.id,now).fresh,true);assert.equal(s.pets[0].needs[p.need],100);
  s.pets[0].needs[p.need]=50;const xp=s.life.xp;assert.equal(useProject(s,p.id,now).fresh,false);assert.equal(s.pets[0].needs[p.need],50);assert.equal(s.life.xp,xp);
 }
 const restored=copy(s);for(const p of PROJECTS){assert.equal(useProject(restored,p.id,now+86400000).fresh,true);assert.equal(restored.pets[0].needs[p.need],56);}
});
test('older expeditions retain their encounters and every new scene has an explicit object illustration',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['p']);assert.equal(outingSnapshot(s).project,null);
 [1,0,2].forEach(c=>chooseOuting(s,c,now));assert.deepEqual(s.life.projects,[]);
 for(const steps of Object.values(PROJECT_STOPS))for(const step of steps)assert.notEqual(curioSVG(step.prop,{literal:true}),curioSVG('unknown',{literal:true}),step.title+' needs its actual prop');
});

test('securing the objective allows an early return without inventing encounters or paying twice',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['p'],{mission:true});assert.equal(returnFromMission(s,now),false);
 chooseOuting(s,1,now);assert.equal(returnFromMission(s,now),false);chooseOuting(s,2,now);
 assert.equal(returnFromMission(s,now),true);assert.ok(s.life.projects.includes('drawer'));assert.equal(s.life.outings,1);
 assert.match(outingSnapshot(s).log.at(-1),/unexplored/);const xp=s.life.xp;s=copy(s);
 assert.equal(outingSnapshot(s).returnedAt,2);assert.equal(returnFromMission(s,now),false);assert.equal(s.life.xp,xp);
});
