import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mastery,masteryTicket,completeMastery,normalizeMastery} from '../src/mastery-state.js';
import {newHandshake,handshakePattern,tapHandshake,rewardHandshake} from '../src/engine/play.js';
import {initialErrands,bestErrandScore} from '../src/engine/market-errands.js';
test('learning is explicit, bounded and independent of affection; receipts survive reload',()=>{const p={bond:25};assert.equal(mastery(p,'handshake').tier,0);const id=masteryTicket(p,'handshake');assert.ok(completeMastery(p,'handshake',0,id));const loaded=JSON.parse(JSON.stringify(p));assert.equal(completeMastery(loaded,'handshake',0,id),false);assert.equal(mastery(loaded,'handshake').tier,1);assert.equal(normalizeMastery({court:{tier:Infinity}}).court.tier,0);});
test('handshake mastery changes sequence length and ritual without making beginner unavailable',()=>{const p={id:'a',bond:25};let g=newHandshake(p,()=>.4);assert.equal(g.rounds,3);mastery(p,'handshake').tier=3;g=newHandshake(p,()=>.4);assert.equal(g.ritual,'duet');while(!g.complete)for(const n of handshakePattern(g))tapHandshake(g,n);assert.ok(g.complete);assert.equal(newHandshake(p,()=>.4,{practice:true}).rounds,3);});
test('one-errand learning market and later markets are feasible across seeds',()=>{for(let seed=1;seed<=12;seed++){const s=initialErrands(seed,[],{version:5,tier:0});assert.equal(s.requests.length,1);assert.equal(s.stalls.length,2);assert.ok(bestErrandScore(seed,{version:5,tier:0})>=10);for(const tier of [1,2])assert.ok(bestErrandScore(seed,{version:5,tier})>=30);}});
import {blankState,normalizeState} from '../src/state.js';
import {newAlibi,answerAlibi,advanceAlibi,rewardAlibi} from '../src/engine/alibi.js';
import {startCourt,currentCourt,courtAction,finishCourt,courtEvidence} from '../src/engine/court.js';
import {startOuting,retryOuting,outingSnapshot,chooseOuting,returnFromMission,startMarket,marketSnapshot,chooseMarket,deliverMarket,leaveMarket,claimMarket} from '../src/engine/life.js';
const now=new Date(2026,8,19,12).getTime();
function fixture(){const s=blankState();s.lastTick=now;s.pets=[{id:'a',name:'Pip',traits:[],stats:{cute:8,damp:8,menace:8,mystique:8},bond:25,needs:{food:60,clean:60,fuss:60},art:{}}];s.slots[0]='a';return s;}
test('fresh beginner Market practice and its replay never unlock lessons after reload',()=>{
 let s=fixture();
 for(const replay of [false,true]){
  assert.ok(startMarket(s,{errands:true,learning:true,practice:!replay,replay}));
  for(let i=0;i<2;i++){const m=marketSnapshot(s);chooseMarket(s,m.stalls[i][0].id);s=normalizeState(s);}
  const m=marketSnapshot(s);deliverMarket(s,m.requests[0].id,m.bag.map(i=>i.id));leaveMarket(s);s=normalizeState(s);
  assert.ok(claimMarket(s,now));s=normalizeState(s);
  assert.equal(mastery(s,'market').tier,0);assert.equal(mastery(s,'market').wins,0);assert.equal(s.life.market.practice,true);
 }
});
test('fresh beginner Handshake practice completes without advancing mastery',()=>{
 const s=fixture(),g=newHandshake(s.pets[0],()=>.4,{practice:true});
 while(!g.complete)for(const n of handshakePattern(g))tapHandshake(g,n);
 assert.ok(rewardHandshake(s,g,now));assert.equal(mastery(s.pets[0],'handshake').tier,0);
 assert.equal(s.pets[0].handshakes,1);assert.equal(rewardHandshake(s,g,now),null);
});
test('five-round Encore stays independent of beginner Echo practice',()=>{
 const s=fixture(),g=newHandshake(s.pets[0],()=>.4,{practice:true,encore:true});
 assert.equal(g.rounds,5);assert.equal(g.ritual,'echo');
 while(!g.complete)for(const n of handshakePattern(g))tapHandshake(g,n);
 assert.ok(rewardHandshake(s,g,now));assert.equal(mastery(s.pets[0],'handshake').tier,0);
});
test('Encore advances the selected mastery lesson at every non-final tier',()=>{
 for(const tier of [0,1,2]){
  const s=fixture();mastery(s.pets[0],'handshake').tier=tier;
  const g=newHandshake(s.pets[0],()=>.4,{encore:true});assert.equal(g.rounds,5);assert.equal(g.masteryTier,tier);
  while(!g.complete)for(const n of handshakePattern(g))tapHandshake(g,n);
  rewardHandshake(s,g,now);assert.equal(mastery(s.pets[0],'handshake').tier,tier+1);
 }
});
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
test('Alibi progresses from detection through proof to combining two available true facts',()=>{let s=fixture();for(let tier=0;tier<3;tier++){const g=newAlibi(s,s.pets[0],()=>.3,{mode:null});assert.equal(g.mode,['quick','prove','combine'][tier]);for(const r of g.rounds){if(tier===2){assert.equal(answerAlibi(g,r.lie,[r.proof]),'ignored');r.exhibits.forEach(e=>e.text='Reworded true record');}assert.equal(answerAlibi(g,r.lie,tier===2?r.proofs:r.proof),'right');advanceAlibi(g);}assert.ok(rewardAlibi(s,g,now).clean);assert.equal(rewardAlibi(s,g,now),null);s=normalizeState(s);assert.equal(mastery(s.pets[0],'alibi').tier,Math.min(tier+1,2));}});
test('Court automatically advances through uniquely solvable levels and preserves each reward boundary',()=>{let s=fixture();for(let tier=0;tier<3;tier++){const g=startCourt(s,{reworked:true},()=>.15+tier*.2);assert.equal(g.level,tier);assert.equal(g.suspects.filter((_,i)=>courtEvidence(g,i).every(Boolean)).length,1);g.sceneEvidence.forEach((_,evidence)=>courtAction(s,{type:'inspect',evidence}));courtAction(s,{type:'question',suspect:g.answer});const statement=currentCourt(s).witnesses[g.answer].falseStatement;courtAction(s,{type:'present',suspect:g.answer,statement,evidence:statement});assert.ok(finishCourt(s,g.answer,now).correct);s=normalizeState(s);assert.equal(finishCourt(s,g.answer,now),null);assert.equal(mastery(s,'court').tier,Math.min(tier+1,2));}});
test('learning market saves one errand after every transaction, advances once and preserves legacy v4',()=>{let s=fixture();startMarket(s,{errands:true,learning:true});for(let i=0;i<2;i++){const m=marketSnapshot(s);assert.equal(m.version,5);assert.equal(m.requests.length,1);assert.ok(chooseMarket(s,m.stalls[i][0].id));s=normalizeState(s);}let m=marketSnapshot(s);assert.ok(deliverMarket(s,m.requests[0].id,m.bag.map(i=>i.id)));s=normalizeState(s);assert.ok(leaveMarket(s));assert.ok(claimMarket(s,now));s=normalizeState(s);assert.equal(claimMarket(s,now),null);assert.equal(mastery(s,'market').tier,1);startMarket(s,{errands:true});assert.equal(marketSnapshot(s).version,4);});
test('expedition mastery changes crew costs and actual later route; early return preserves parts without learning credit',()=>{let s=fixture();startOuting(s,'drawer','thread',['a'],{mission:true,learning:true});assert.deepEqual(outingSnapshot(s).expertise,[]);chooseOuting(s,1,now);assert.ok(returnFromMission(s,now));s=normalizeState(s);assert.ok(outingSnapshot(s).result);assert.equal(mastery(s,'expedition').tier,0);const xp=s.life.xp;assert.equal(returnFromMission(s,now),false);assert.equal(s.life.xp,xp);s.life.outing=null;mastery(s,'expedition').tier=2;startOuting(s,'drawer','thread',['a'],{mission:true,learning:true,edition:0});const before=outingSnapshot(s);assert.equal(before.expertise.length,4);chooseOuting(s,1,now);const after=outingSnapshot(s);assert.notDeepEqual(after.steps.slice(1),before.steps.slice(1));s=normalizeState(s);assert.deepEqual(outingSnapshot(s).steps,after.steps);});
test('old serialized lesson receipts cannot return after the bounded recent list rolls over',()=>{const p={};const first=masteryTicket(p,'handshake');completeMastery(p,'handshake',0,first);for(let i=0;i<70;i++)completeMastery(p,'handshake',0,masteryTicket(p,'handshake'));const restored=JSON.parse(JSON.stringify(p));assert.equal(completeMastery(restored,'handshake',0,first),false);assert.ok(mastery(restored,'handshake').receipts.length<=64);});
test('every branching expedition edition keeps advertised first-choice points after reload',()=>{for(let edition=0;edition<8;edition++){let s=fixture();mastery(s,'expedition').tier=2;startOuting(s,'drawer','thread',['a'],{learning:true,mission:true,edition});const expected=outingSnapshot(s).options[1].preview.points;chooseOuting(s,1,now);s=normalizeState(s);assert.equal(outingSnapshot(s).score,expected);}});
import {marketMarkup} from '../src/ui/market.js';
import {courtFinishedMarkup} from '../src/ui/court.js';
import {alibiEvidenceFeedback} from '../src/ui/play.js';
test('one-errand dock, saved success scene and persisted unlock report agree with the actual list',()=>{let s=fixture();startMarket(s,{errands:true,learning:true});for(let i=0;i<2;i++){const m=marketSnapshot(s);chooseMarket(s,m.stalls[i][0].id);s=normalizeState(s);}let m=marketSnapshot(s);deliverMarket(s,m.requests[0].id,m.bag.map(i=>i.id));assert.match(marketMarkup(s,marketSnapshot(s),'',null,'',''),/Return home · 1\/1 delivered/);leaveMarket(s);claimMarket(s,now);s=normalizeState(s);const scene=s.life.scenes.find(x=>x.kind==='market');assert.match(scene.text,/Everyone got what they asked for/);assert.doesNotMatch(scene.text,/others have requested/);assert.match(marketMarkup(s,marketSnapshot(s),'',null,'',''),/Unlocked: Three errands/);startMarket(s,{errands:true,learning:true,practice:true});for(let i=0;i<2;i++){m=marketSnapshot(s);chooseMarket(s,m.stalls[i][0].id);}m=marketSnapshot(s);deliverMarket(s,m.requests[0].id,m.bag.map(i=>i.id));leaveMarket(s);claimMarket(s,now);assert.doesNotMatch(marketMarkup(s,marketSnapshot(s),'',null,'',''),/Unlocked:/);});
test('Court completion announces only the lesson actually unlocked and retains it after restore',()=>{let s=fixture();const g=startCourt(s,{reworked:true},()=>.31);g.sceneEvidence.forEach((_,evidence)=>courtAction(s,{type:'inspect',evidence}));courtAction(s,{type:'question',suspect:g.answer});const statement=currentCourt(s).witnesses[g.answer].falseStatement;courtAction(s,{type:'present',suspect:g.answer,statement,evidence:statement});finishCourt(s,g.answer,now);s=normalizeState(s);const final=currentCourt(s);assert.match(courtFinishedMarkup(final,final.result,s.life.courtWins),/Unlocked: Curious/);assert.match(courtFinishedMarkup(final,final.result,s.life.courtWins),/Tangled/);});
test('combined Alibi feedback identifies both necessary records and no unrelated exhibit',()=>{const r={proof:2,proofs:[2,0]};assert.match(alibiEvidenceFeedback(r,2),/Together/);assert.match(alibiEvidenceFeedback(r,0),/Together/);assert.equal(alibiEvidenceFeedback(r,1),'');assert.equal(alibiEvidenceFeedback({proof:1},1),'Contradicts the lie');});

test('active Market folds help away and labels the saved route rather than household mastery',()=>{const s=fixture();mastery(s,'market').tier=2;startMarket(s,{errands:true,learning:true,practice:true});let html=marketMarkup(s,marketSnapshot(s),'',null,'','');assert.match(html,/<details class="market-lesson"><summary>Lesson 1\/3 · One household errand<\/summary>/);assert.doesNotMatch(html,/<details class="market-lesson" open/);s.life.market=null;startMarket(s,{errands:true});html=marketMarkup(s,marketSnapshot(s),'',null,'','');assert.match(html,/<summary>Saved shopping route · 8 stalls<\/summary>/);assert.doesNotMatch(html,/Lesson 1\/3 · One household errand/);});
test('v5 Market bests stay separate for each tier and never overwrite legacy v4 scores',()=>{let s=fixture();s.life.marketErrandBestV4=91;for(let tier=0;tier<3;tier++){mastery(s,'market').tier=tier;startMarket(s,{errands:true,learning:true});let m=marketSnapshot(s);while(m.step<m.stalls.length){chooseMarket(s,null);m=marketSnapshot(s);}leaveMarket(s);const result=claimMarket(s,now);s=normalizeState(s);assert.equal(s.life.marketErrandBestV4,91);assert.equal(s.life.marketErrandBestV5[tier],result.score.total);assert.match(marketMarkup(s,marketSnapshot(s),'',null,'',''),new RegExp('Your best with these rules: '+result.score.total+'\\.'));}assert.deepEqual(s.life.marketErrandBestV5,[10,10,10]);s.life.marketErrandBestV5=[Infinity,-1,3.9,9999999];s=normalizeState(s);assert.deepEqual(s.life.marketErrandBestV5,[0,0,3]);});

test('explicit Alibi practice keeps history without unlocking a lesson and rejects restored duplicate claims',()=>{
 let s=fixture();const g=newAlibi(s,s.pets[0],()=>.3,{mode:'quick',practice:true});
 for(const r of g.rounds){answerAlibi(g,r.lie);advanceAlibi(g);}
 const replay=JSON.parse(JSON.stringify(g));assert.ok(rewardAlibi(s,g,now).clean);
 assert.equal(mastery(s.pets[0],'alibi').tier,0);assert.equal(mastery(s.pets[0],'alibi').wins,0);
 assert.equal(s.pets[0].alibis,1);s=normalizeState(s);
 assert.equal(rewardAlibi(s,replay,now+600000).practice,true);assert.equal(s.pets[0].alibis,1);
});
test('Handshake practice consumes a completion receipt even when it earns no mastery',()=>{
 let s=fixture();const g=newHandshake(s.pets[0],()=>.4,{practice:true});
 while(!g.complete)for(const n of handshakePattern(g))tapHandshake(g,n);
 const replay=JSON.parse(JSON.stringify(g));rewardHandshake(s,g,now);s=normalizeState(s);
 rewardHandshake(s,replay,now+600000);
 assert.equal(s.pets[0].handshakes,1);assert.equal(s.pets[0].handshakeRituals.echo.completions,1);
 assert.equal(mastery(s.pets[0],'handshake').wins,0);
});
test('combined Alibi notes distinguish a failed proof from believing a true statement',()=>{
 const s=fixture();const g=newAlibi(s,s.pets[0],()=>.3,{mode:'combine'});
 for(const r of g.rounds){answerAlibi(g,r.lie,[0,1,2].filter(i=>i!==r.proofs[0]));advanceAlibi(g);}
 rewardAlibi(s,g,now);
 assert.equal(g.correct,g.rounds.length);assert.equal(g.proved,0);
 assert.match(s.notes[0].text,/evidence did not hold up/);
});

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

test('Court aftermath identifies a real convicted resident separately from a host witnessing a stand-in conviction',()=>{
 const seen=new Set();
 for(let seed=1;seed<=80&&seen.size<2;seed++){
  const s=fixture(),g=startCourt(s,{reworked:true,caseIndex:1},()=>seed/100);
  const culprit=g.suspects[g.answer],resident=s.pets.some(p=>p.id===culprit.id);
  g.sceneEvidence.forEach((_,evidence)=>courtAction(s,{type:'inspect',evidence}));
  courtAction(s,{type:'question',suspect:g.answer});const statement=currentCourt(s).witnesses[g.answer].falseStatement;
  courtAction(s,{type:'present',suspect:g.answer,statement,evidence:statement});finishCourt(s,g.answer,now);
  const scene=s.life.scenes.find(row=>row.kind==='court'),variant=resident?'convicted':'witness';
  assert.equal(scene.stage.branch,variant);assert.equal(scene.cast[0],resident?culprit.id:s.pets[0].id);
  assert.equal(normalizeState(s).life.scenes.find(row=>row.kind==='court').stage.branch,variant);
  seen.add(variant);
 }
 assert.deepEqual([...seen].sort(),['convicted','witness']);
});
