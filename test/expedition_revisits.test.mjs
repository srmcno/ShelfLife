import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {startOuting,chooseOuting,outingSnapshot,finishOuting,returnFromMission} from '../src/engine/life.js';
import {missionStops} from '../src/content/project-encounters.js';
import {PROJECTS,PROJECT_STOPS} from '../src/content/projects.js';
import {GEAR} from '../src/content/life.js';
import {expeditionView,projectBoard} from '../src/ui/expeditions.js';
const now=new Date(2026,8,13,12).getTime();
function fixture(){const s=blankState();s.pets=[{id:'p',name:'Pip',art:{},traits:[],stats:{menace:3,cute:3,damp:3,mystique:3},needs:{food:60,fuss:97,clean:60}},{id:'q',name:'Quill',art:{},traits:['haunted'],stats:{menace:8,cute:3,damp:3,mystique:8},needs:{food:60,fuss:100,clean:60}}];s.slots[0]='p';s.slots[1]='q';return s;}
test('saved mission editions have eight distinct routes while original encounters retain their exact script',()=>{
 for(const project of PROJECTS){const variants=new Set();for(let edition=0;edition<8;edition++){
  const s=fixture();startOuting(s,project.id,'thread',['p'],{mission:true,edition});const before=outingSnapshot(s);
  variants.add(before.steps.map(x=>x.title).join('|'));assert.deepEqual(outingSnapshot(normalizeState(s)),before);
  for(const [i,stop] of before.steps.entries()){assert.equal(stop.prop,PROJECT_STOPS[project.id][i].prop);assert.equal(stop.good,PROJECT_STOPS[project.id][i].good);}
 }assert.equal(variants.size,8);assert.deepEqual(missionStops(project.id,7,1),PROJECT_STOPS[project.id]);}
});
test('an early single-part return banks the part without phantom recovery, points, or a completed field note',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['p'],{mission:true,edition:0,dare:'steady'});
 assert.equal(returnFromMission(s,now),false);chooseOuting(s,1,now);assert.equal(outingSnapshot(s).nerve,0);assert.ok(returnFromMission(s,now));
 const result=outingSnapshot(s);assert.equal(result.nerve,0);assert.equal(result.score,2);assert.equal(result.dareBonus,0);assert.deepEqual(s.life.projectParts.drawer,[0]);assert.deepEqual(s.life.trailPages,[]);assert.equal(result.returnedAt,1);
 assert.ok(result.log.slice(1).every(line=>line.includes('unexplored')));assert.match(expeditionView(s,result).html,/Unvisited stops gave no nerve, points or field note/);
 s=normalizeState(s);assert.deepEqual(outingSnapshot(s),result);const xp=s.life.xp;assert.equal(returnFromMission(s,now),false);assert.equal(chooseOuting(s,0,now),null);assert.equal(s.life.xp,xp);
});
test('field notes are bounded, survive reload, name visited encounters and never repay a replay',()=>{
 let s=fixture();
 for(let edition=0;edition<8;edition++){
  startOuting(s,'drawer','thread',['p','q'],{mission:true,edition});for(const move of [1,2,0])assert.ok(chooseOuting(s,move,now));
  const view=outingSnapshot(s);assert.equal(view.result.page,'drawer:'+edition);assert.equal(view.result.pageFresh,true);assert.match(expeditionView(s,view).html,/\+2 discoveries/);s=normalizeState(s);assert.equal(s.life.trailPages.length,edition+1);finishOuting(s);
 }
 assert.equal(s.life.trailPages.length,8);const xp=s.life.xp;
 startOuting(s,'drawer','thread',['p','q'],{mission:true,edition:7});for(const move of [1,2,0])chooseOuting(s,move,now);
 assert.equal(outingSnapshot(s).result.pageFresh,false);assert.equal(s.life.xp,xp);assert.equal(s.life.trailPages.length,8);
 const board=projectBoard(s.life);assert.match(board,/Read field notes · 8\/8/);assert.ok(board.includes(missionStops('drawer',7,2)[0].title));
});
test('crew and tool previews name the actual advantages and capped attention',()=>{
 const s=fixture();s.mastery={expedition:{tier:1}};const plan=expeditionView(s,null,{route:'drawer',gear:'thread',lead:'p',companion:'q'}).html;
 assert.match(plan,/Quill/);assert.match(plan,/Reduces detour cost to 1 nerve/);assert.match(plan,/Can gain 3 attention/);assert.match(plan,/Can gain 0 attention/);assert.match(plan,/at stop 2 without spending nerve/);
 startOuting(s,'drawer','thread',['p','q'],{mission:true});assert.match(outingSnapshot(s).options[1].hint,/spend 1 nerve/);
 s.pets[1].stats.menace=1;assert.match(outingSnapshot(normalizeState(s)).options[1].hint,/spend 1 nerve/);
});
test('all current recovery editions retain attainable objectives and truthful maximum scores for every tool',()=>{
 for(const project of PROJECTS)for(const gear of GEAR)for(let edition=0;edition<8;edition++){
  let best=0,reported=0,canBuild=false;
  for(let pattern=0;pattern<27;pattern++){
   const s=fixture();startOuting(s,project.id,gear.id,['p'],{mission:true,edition});reported=outingSnapshot(s).best;
   for(const choice of [pattern%3,Math.floor(pattern/3)%3,Math.floor(pattern/9)])if(!chooseOuting(s,choice,now))break;
   const o=outingSnapshot(s);if(o.step===3){best=Math.max(best,o.score);canBuild||=s.life.projects.includes(project.id);}
  }
  assert.equal(best,reported);assert.ok(canBuild,project.id+'/'+gear.id+'/'+edition);
 }
});

test('a damaged early return cannot invent a recovered part beyond the declared return stop',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['p','q'],{mission:true});chooseOuting(s,1,now);
 Object.assign(s.life.outing,{returnedAt:1,choices:[1,1,0],step:3});
 const o=outingSnapshot(normalizeState(s));assert.equal(o.step,1);assert.deepEqual(o.recovered,[0]);assert.deepEqual(o.parts,[0]);
});
