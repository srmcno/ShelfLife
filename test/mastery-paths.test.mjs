import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mastery,masteryTicket,completeMastery,normalizeMastery} from '../src/mastery-state.js';
test('learning is explicit, bounded and independent of affection; receipts survive reload',()=>{const p={bond:25};assert.equal(mastery(p,'expedition').tier,0);const id=masteryTicket(p,'expedition');assert.ok(completeMastery(p,'expedition',0,id));const loaded=JSON.parse(JSON.stringify(p));assert.equal(completeMastery(loaded,'expedition',0,id),false);assert.equal(mastery(loaded,'expedition').tier,1);assert.equal(normalizeMastery({expedition:{tier:Infinity}}).expedition.tier,0);});
import {blankState,normalizeState} from '../src/state.js';
import {startOuting,retryOuting,outingSnapshot,chooseOuting,returnFromMission} from '../src/engine/life.js';
const now=new Date(2026,8,19,12).getTime();
function fixture(){const s=blankState();s.lastTick=now;s.pets=[{id:'a',name:'Pip',traits:[],stats:{cute:8,damp:8,menace:8,mystique:8},bond:25,needs:{food:60,clean:60,fuss:60},art:{}}];s.slots[0]='a';return s;}
test('retrying a failed survey preserves its lesson and can advance after real decisions',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a'],{mission:true,learning:true,edition:0});
 for(let i=0;i<3;i++)chooseOuting(s,0,now);s=normalizeState(s);
 const oldReceipt=s.life.outing.receipt;assert.equal(mastery(s,'expedition').tier,0);
 assert.ok(retryOuting(s));assert.notEqual(s.life.outing.receipt,oldReceipt);s=normalizeState(s);
 assert.equal(s.life.outing.masteryTier,0);assert.deepEqual(s.life.outing.expertise,[]);
 for(const choice of [1,0,1])chooseOuting(s,choice,now);
 assert.equal(mastery(s,'expedition').tier,1);
 assert.ok(retryOuting(s));assert.equal(s.life.outing.masteryTier,0,'replay retains the cleared route rules');
});
test('retry retains advanced branches, explicit practice and legacy route rules',()=>{
 for(const options of [{learning:true},{learning:true,practice:true},{}]){
  let s=fixture();mastery(s,'expedition').tier=2;startOuting(s,'drawer','thread',['a'],{mission:true,edition:0,...options});
  chooseOuting(s,1,now);const steps=outingSnapshot(s).steps;
  chooseOuting(s,0,now);chooseOuting(s,0,now);s=normalizeState(s);
  const before=s.life.outing;assert.ok(retryOuting(s));s=normalizeState(s);
  assert.equal(s.life.outing.masteryTier,before.masteryTier);assert.equal(s.life.outing.practice,before.practice);assert.deepEqual(s.life.outing.expertise,before.expertise);
  chooseOuting(s,1,now);assert.deepEqual(outingSnapshot(s).steps,steps);
 }
});
test('fresh Expedition practice preserves recovered parts through reload without advancing mastery',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a'],{mission:true,learning:true,practice:true,edition:0});
 for(const choice of [1,0,1]){assert.ok(chooseOuting(s,choice,now));s=normalizeState(s);}
 assert.ok(outingSnapshot(s).score>=3);assert.ok(s.life.projectParts.drawer.length>0);
 assert.equal(mastery(s,'expedition').tier,0);assert.equal(mastery(s,'expedition').wins,0);
});
test('expedition mastery changes crew costs and actual later route; early return preserves parts without learning credit',()=>{let s=fixture();startOuting(s,'drawer','thread',['a'],{mission:true,learning:true});assert.deepEqual(outingSnapshot(s).expertise,[]);chooseOuting(s,1,now);assert.ok(returnFromMission(s,now));s=normalizeState(s);assert.ok(outingSnapshot(s).result);assert.equal(mastery(s,'expedition').tier,0);const xp=s.life.xp;assert.equal(returnFromMission(s,now),false);assert.equal(s.life.xp,xp);s.life.outing=null;mastery(s,'expedition').tier=2;startOuting(s,'drawer','thread',['a'],{mission:true,learning:true,edition:0});const before=outingSnapshot(s);assert.equal(before.expertise.length,4);chooseOuting(s,1,now);const after=outingSnapshot(s);assert.notDeepEqual(after.steps.slice(1),before.steps.slice(1));s=normalizeState(s);assert.deepEqual(outingSnapshot(s).steps,after.steps);});
test('old serialized lesson receipts cannot return after the bounded recent list rolls over',()=>{const p={};const first=masteryTicket(p,'expedition');completeMastery(p,'expedition',0,first);for(let i=0;i<70;i++)completeMastery(p,'expedition',0,masteryTicket(p,'expedition'));const restored=JSON.parse(JSON.stringify(p));assert.equal(completeMastery(restored,'expedition',0,first),false);assert.ok(mastery(restored,'expedition').receipts.length<=64);});
test('every branching expedition edition keeps advertised first-choice points after reload',()=>{for(let edition=0;edition<8;edition++){let s=fixture();mastery(s,'expedition').tier=2;startOuting(s,'drawer','thread',['a'],{learning:true,mission:true,edition});const expected=outingSnapshot(s).options[1].preview.points;chooseOuting(s,1,now);s=normalizeState(s);assert.equal(outingSnapshot(s).score,expected);}});
import {expeditionView,projectBoard} from '../src/ui/expeditions.js';
import {missionStops} from '../src/content/project-encounters.js';
test('advanced expedition explains its branch and archives only the encounters actually visited',()=>{
 let s=fixture();mastery(s,'expedition').tier=2;
 startOuting(s,'drawer','thread',['a'],{learning:true,mission:true,edition:0});
 const before=outingSnapshot(s);
 assert.match(expeditionView(s,before).html,/Opens a different route for stops 2 and 3/);
 for(const choice of [1,0,1])chooseOuting(s,choice,now);
 assert.deepEqual(s.life.trailPages,['drawer:0:detour']);
 s=normalizeState(s);const completed=outingSnapshot(s);
 assert.equal(completed.result.page,'drawer:0:detour');
 const board=projectBoard(s.life);
 for(const stop of completed.steps)assert.ok(board.includes(stop.title));
 assert.ok(!board.includes(missionStops('drawer',0,2)[1].title),'unvisited main-route encounter is not filed');
 assert.match(board,/Route edition 1 · detour/);
 assert.ok(retryOuting(s));for(const choice of [1,0,1])chooseOuting(s,choice,now);
 assert.equal(outingSnapshot(s).result.pageFresh,false);assert.equal(s.life.trailPages.length,1);
});
test('expedition homecoming preserves exact mastery unlock after reload and hides it on practice replay',()=>{
 let s=fixture();startOuting(s,'drawer','thread',['a'],{learning:true,mission:true,edition:0});
 for(const choice of [1,0,1])chooseOuting(s,choice,now);
 s=normalizeState(s);assert.match(expeditionView(s,outingSnapshot(s)).html,/Unlocked: Crew expertise/);
 assert.ok(retryOuting(s));for(const choice of [1,0,1])chooseOuting(s,choice,now);
 assert.doesNotMatch(expeditionView(s,outingSnapshot(s)).html,/Unlocked:/);
});

test('all original and detour field notes coexist through normalization without dropping old history',()=>{
 let s=fixture();const pages=['drawer','fridge','cupboard'].flatMap(route=>Array.from({length:8},(_,i)=>route+':'+i));
 s.life.trailPages=[...pages,...pages.map(id=>id+':detour'),'drawer:8:detour','drawer:0:invented'];
 s=normalizeState(s);assert.equal(s.life.trailPages.length,48);assert.deepEqual(s.life.trailPages.slice(0,24),pages);
 assert.match(projectBoard(s.life),/8\/8 main routes · 8\/8 detours/);
});
