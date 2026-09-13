import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {startOuting,chooseOuting,outingSnapshot,returnFromMission,finishOuting} from '../src/engine/life.js';
import {expeditionView} from '../src/ui/expeditions.js';
import {PROJECTS} from '../src/content/projects.js';
import {GEAR,OUTINGS} from '../src/content/life.js';

const now=new Date(2026,8,13,12).getTime();
function fixture(){
 const s=blankState();s.lastTick=now;
 s.pets=[{id:'a',name:'Agnes',art:{},traits:[],stats:{cute:3,menace:3,damp:3,mystique:3},needs:{food:70,fuss:97,clean:70}},
  {id:'b',name:'Bramble',art:{},traits:[],stats:{cute:8,menace:8,damp:3,mystique:8},needs:{food:70,fuss:70,clean:70}}];
 s.slots[0]='a';s.slots[1]='b';return normalizeState(s);
}
function render(s,options={}){return expeditionView(s,outingSnapshot(s),options);}

test('every resource preview agrees with the actual accepted next move, including blocked moves and saved parts',()=>{
 for(const project of PROJECTS)for(const gear of GEAR)for(const skilled of [false,true]){
  const first=fixture();first.life.projectParts[project.id]=[1];
  startOuting(first,project.id,gear.id,skilled?['a','b']:['a'],{mission:true,edition:3});
  const pending=[first];
  while(pending.length){
   const state=pending.pop(),before=outingSnapshot(state);
   if(before.step===3)continue;
   for(const option of before.options){
    const trial=normalizeState(structuredClone(state)),prior=structuredClone(trial.life.outing);
    if(!option.available){assert.equal(option.preview,null);assert.equal(chooseOuting(trial,option.choice,now),null);assert.deepEqual(trial.life.outing,prior);continue;}
    const expected=option.preview;assert.ok(chooseOuting(trial,option.choice,now));const after=outingSnapshot(trial);
    assert.equal(after.nerve,expected.nerve);assert.equal(after.toolUsed,expected.toolUsed);
    assert.equal(after.baseScore-before.baseScore,expected.points);
    assert.equal(expected.partIndex,option.choice===0?null:before.step);
    assert.equal(expected.partNew,option.choice!==0&&!state.life.projectParts[project.id].includes(before.step));
    const loaded=normalizeState(structuredClone(trial));assert.deepEqual(outingSnapshot(loaded),after);
    pending.push(loaded);
   }
  }
 }
});

test('the actual playing view distinguishes new parts, already stored parts, capped recovery and unavailable tools',()=>{
 const s=fixture();s.life.projectParts.drawer=[0];startOuting(s,'drawer','thread',['a'],{mission:true,edition:0});
 let view=render(s);assert.match(view.html,/Part already stored · trail points only/);assert.match(view.html,/This stop needs Emergency biscuit/);assert.match(view.html,/Nerve 2 → 3 · \+0 points/);
 assert.ok(chooseOuting(s,0,now));view=render(s);
 assert.match(view.html,/Nerve 3 → 3 · \+0 points/);assert.match(view.html,/Recover An unclaimed button/);assert.doesNotMatch(view.html,/Part already stored · trail points only/);
 chooseOuting(s,2,now);view=render(s);
 assert.match(view.html,/Your tool has already been used/);assert.match(view.html,/This is|handle this part/);assert.equal((view.html.match(/data-life="outing-choice"/g)||[]).length,3);
});

test('rendering and reopening any phase cannot advance the trip or pay a reward',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a','b'],{mission:true,edition:0});
 for(const choice of [1,2,0]){
  const before=structuredClone(s);for(let i=0;i<3;i++)render(s,{interlude:true});assert.deepEqual(s,before);
  chooseOuting(s,choice,now);const after=structuredClone(s);
  const phase=render(s,{interlude:true}).phase;assert.equal(phase,s.life.outing.step===3?'result':'report');
  render(s);render(s,{route:'fridge',lead:'b'});assert.deepEqual(s,after);
  s=normalizeState(s);
 }
 const completed=structuredClone(s),view=render(s);
 assert.match(view.html,/New curiosity · \+4 discoveries/);assert.match(view.html,/Built and installed · \+6 discoveries/);assert.match(view.html,/New field note · \+2 discoveries/);
 assert.equal(s.life.projects.filter(p=>p==='drawer').length,1);assert.equal(s.pets[0].expeditions,1);
 assert.equal(chooseOuting(s,0,now),null);assert.deepEqual(s,completed);
 assert.equal(view.html,render(normalizeState(s)).html);
});

test('saved crew order and original expertise survive current shelf changes and rehoming one resident',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['b','a'],{mission:true,edition:0});chooseOuting(s,1,now);
 s.pets[1].stats.menace=1;
 const resumed=render(normalizeState(s));assert.deepEqual(resumed.crew.map(p=>p.id),['b','a']);assert.match(resumed.html,/Last time on this route/);
 assert.ok(resumed.html.indexOf('Bramble')<resumed.html.indexOf('Agnes'));
 s.pets=s.pets.filter(p=>p.id==='a');s.slots[1]=null;
 const survivor=render(normalizeState(s));assert.deepEqual(survivor.crew.map(p=>p.id),['a']);assert.equal(survivor.phase,'playing');assert.doesNotMatch(survivor.html,/Bramble/);
});

test('names and saved journey text are escaped in planning, resumed play and the result',()=>{
 const s=fixture();s.pets[0].name='<img src=x onerror="bad()">';
 let view=expeditionView(s,null,{lead:'a',companion:'b'});assert.doesNotMatch(view.html,/<img src=x/);assert.match(view.html,/&lt;img/);
 startOuting(s,'drawer','thread',['a'],{mission:true,edition:0});for(const choice of [1,2,0])chooseOuting(s,choice,now);
 view=render(s);assert.doesNotMatch(view.html,/<img src=x/);assert.match(view.html,/&lt;img/);
 const old=fixture();old.life.outing={route:'drawer',gear:'thread',cast:['a'],step:1,score:0,choices:[1],log:['<script>bad()</script>']};
 view=render(old);assert.doesNotMatch(view.html,/<script>/);assert.match(view.html,/&lt;script&gt;/);
});

test('early return shows only the recovered haul and never invents a full-route field note',()=>{
 const s=fixture();startOuting(s,'drawer','thread',['a'],{mission:true,edition:0});chooseOuting(s,1,now);
 assert.ok(returnFromMission(s,now));const view=render(s);
 assert.equal(view.phase,'result');assert.match(view.html,/A small haul. A good start/);assert.match(view.html,/A funeral spool/);
 assert.match(view.html,/Unvisited stops gave no nerve, points or field note/);assert.doesNotMatch(view.html,/New field note|Built and installed/);
 assert.deepEqual(s.life.projectParts.drawer,[0]);assert.deepEqual(s.life.trailPages,[]);
});

test('legacy unfinished expeditions keep two real choices and can complete and reopen through the new view',()=>{
 let s=fixture();s.life.outing={route:'cupboard',gear:'thread',cast:['a'],step:0,score:0,log:[],choices:[]};s=normalizeState(s);
 for(let i=0;i<3;i++){
  const view=render(s);assert.equal(view.phase,'playing');assert.equal((view.html.match(/data-life="outing-choice"/g)||[]).length,2);
  assert.ok(view.html.includes(OUTINGS.find(r=>r.id==='cupboard').steps[i].title));assert.doesNotMatch(view.html,/Nerve \d →/);
  chooseOuting(s,0,now);s=normalizeState(s);
 }
 const result=render(s);assert.equal(result.phase,'result');assert.match(result.html,/situations supported by your equipment or crew/);assert.match(result.html,/Display your curiosity/);
 assert.doesNotMatch(result.html,/data-life="outing-retry"/);assert.equal(s.pets[0].expeditions,1);
 const xp=s.life.xp;render(s);assert.equal(s.life.xp,xp);assert.ok(finishOuting(s));assert.equal(render(s).phase,'planning');
});
