import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {normalizeLife} from '../src/life-state.js';
import {COURT_CASES,COURT_INVESTIGATIONS} from '../src/content/court.js';
import {startCourt,currentCourt,courtAction,finishCourt,courtEvidence} from '../src/engine/court.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.lastTick=now;s.pets=[{id:'host',name:'Mrs Mortimer',traits:[],stats:{cute:4,menace:4,damp:4,mystique:4},needs:{food:60,fuss:60,clean:60},bond:0,cared:0,art:{}}];s.slots[0]='host';return s;}
function collect(s){currentCourt(s).sceneEvidence.forEach((_,evidence)=>courtAction(s,{type:'inspect',evidence}));}
function expose(s,suspect){courtAction(s,{type:'question',suspect});const statement=currentCourt(s).witnesses[suspect].falseStatement;return courtAction(s,{type:'present',suspect,statement,evidence:statement});}

test('every trial contains a single falsifiable claim per witness and a unique complete crime solution',()=>{
 for(let theme=0;theme<COURT_CASES.length;theme++)for(let level=0;level<3;level++)for(let seed=1;seed<=12;seed++){
  const s=fixture(),g=startCourt(s,{caseIndex:theme,level},()=>seed/13);
  assert.equal(g.sceneEvidence.length,3);
  assert.equal(g.sceneEvidence.flatMap(e=>e.clues).length,g.rules.length);
  const candidates=g.suspects.map((_,i)=>courtEvidence(g,i).every(Boolean));assert.equal(candidates.filter(Boolean).length,1);
  g.witnesses.forEach((w,i)=>{
   assert.equal(w.claimed.filter((fact,axis)=>fact!==g.suspects[i].facts[axis]).length,1);
   assert.notEqual(w.claimed[w.falseStatement],g.suspects[i].facts[w.falseStatement]);
   g.sceneEvidence.forEach((e,axis)=>assert.equal(e.records[i].text,g.axes[axis].values[g.suspects[i].facts[axis]]));
  });
  assert.ok(g.scene.length>60);assert.equal(new Set(COURT_INVESTIGATIONS[theme].motives).size,4);
 }
});

test('presenting evidence requires inspected physical proof and the actual false statement',()=>{
 const s=fixture(),g=startCourt(s,{},()=>.123),suspect=g.answer,statement=g.witnesses[suspect].falseStatement;
 assert.equal(finishCourt(s,suspect,now),null,'A direct accusation cannot skip investigation');
 assert.equal(courtAction(s,{type:'present',suspect,statement,evidence:statement}),null);
 courtAction(s,{type:'question',suspect});
 assert.equal(courtAction(s,{type:'present',suspect,statement,evidence:statement}),null,'Unread evidence cannot be used');
 collect(s);
 assert.equal(finishCourt(s,suspect,now),null,'Physical clues alone do not replace cross-examination');
 const wrong=(statement+1)%3;
 assert.equal(courtAction(s,{type:'present',suspect,statement,evidence:wrong}).kind,'overruled');
 assert.equal(courtAction(s,{type:'present',suspect,statement:wrong,evidence:wrong}).kind,'overruled','True statements cannot be exposed');
 assert.equal(courtAction(s,{type:'present',suspect,statement,evidence:statement}).kind,'sustained');
 const exposed=currentCourt(s).witnesses[suspect];
 assert.equal(exposed.exposed,true);assert.deepEqual(exposed.account,g.suspects[suspect].details);
 assert.match(exposed.statements[statement].text,/corrected statement/);assert.ok(exposed.motive.length>50);
 assert.equal(courtAction(s,{type:'present',suspect,statement,evidence:statement}),null,'A repeated exposure is not progress');
 assert.equal(currentCourt(s).mistakes,2);
});

test('case seed, testimony, inspected evidence, pressed claim and UI position survive restoration',()=>{
 let s=fixture();const g=startCourt(s,{level:2,caseIndex:7},()=>.7123),suspect=1,statement=g.witnesses[suspect].falseStatement;
 courtAction(s,{type:'inspect',evidence:statement});courtAction(s,{type:'question',suspect});courtAction(s,{type:'press',suspect,statement});
 courtAction(s,{type:'focus',chapter:'hearing',suspect,statement,evidence:statement});
 const before=currentCourt(s),xp=s.life.xp;s=normalizeState(JSON.parse(JSON.stringify(s)));
 s.pets[0].name='A renamed resident';
 const after=currentCourt(s);
 assert.deepEqual(after.suspects,before.suspects,'Court identity snapshots do not shift when residents are renamed');
 assert.deepEqual(after.ui,before.ui);assert.deepEqual(after.inspected,before.inspected);assert.deepEqual(after.pressed,before.pressed);
 assert.deepEqual(after.hearing,before.hearing);assert.equal(s.life.xp,xp);
 assert.equal(courtAction(s,{type:'present',suspect,statement,evidence:statement}).kind,'sustained');
});

test('an innocent can be exposed without being guilty and a mistaken verdict allows an appeal',()=>{
 const s=fixture(),g=startCourt(s,{level:2},()=>.455),innocent=(g.answer+1)%4;collect(s);expose(s,innocent);
 const needs={...s.pets[0].needs},xp=s.life.xp;
 const failed=finishCourt(s,innocent,now);
 assert.equal(failed.retry,true);assert.equal(failed.correct,false);assert.equal(failed.reasons.length,1);
 assert.equal(failed.reasons[0].name,g.suspects[innocent].name);assert.deepEqual(s.pets[0].needs,needs);assert.equal(s.life.xp,xp);
 assert.equal(currentCourt(s).claimed,false);assert.deepEqual(currentCourt(s).rejected,[innocent]);
 assert.equal(finishCourt(s,innocent,now),null,'The same acquitted suspect cannot repeatedly consume an appeal');
 expose(s,g.answer);const won=finishCourt(s,g.answer,now);
 assert.equal(won.correct,true);assert.equal(won.rank,'Case salvaged');assert.equal(won.stats.appeals,1);
 assert.equal(s.life.courtWins,1);assert.equal(s.life.courtPlays,1);
});

test('completion pays once and restored results never replay care or discovery rewards',()=>{
 let s=fixture();const g=startCourt(s,{level:1},()=>.819);collect(s);expose(s,g.answer);
 const result=finishCourt(s,g.answer,now),xp=s.life.xp,bond=s.pets[0].bond;
 assert.ok(result.correct);assert.equal(s.life.courtBest,result.score);
 assert.equal(finishCourt(s,g.answer,now),null);s=normalizeState(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(currentCourt(s).result,result);assert.equal(finishCourt(s,g.answer,now),null);
 assert.equal(s.life.xp,xp);assert.equal(s.pets[0].bond,bond);assert.equal(s.life.courtPlays,1);
});

test('illegal action suffixes and forged claim flags cannot complete a saved investigation',()=>{
 const s=fixture(),g=startCourt(s,{},()=>.42);courtAction(s,{type:'inspect',evidence:0});
 s.life.court.moves.push({type:'file',suspect:g.answer},{type:'inspect',evidence:1});s.life.court.claimed=true;s.life.court.reward={bond:999,fuss:999};
 s.life=normalizeLife(JSON.parse(JSON.stringify(s.life)));const replayed=currentCourt(s);
 assert.equal(replayed.claimed,false);assert.deepEqual(replayed.inspected,[0]);assert.equal(s.life.court.moves.length,1);assert.equal(s.life.xp,0);
 s.life.court.moves.push({type:'present',suspect:-1,statement:0,evidence:0},{type:'inspect',evidence:2});
 s.life=normalizeLife(s.life);assert.equal(s.life.court.moves.length,1);
 assert.equal(normalizeLife({court:{...s.life.court,seed:0}}).court,null);
});

test('inspection order and optional help do not force a witness checklist or change rewards',()=>{
 const a=fixture(),b=fixture(),ga=startCourt(a,{},()=>.381),gb=startCourt(b,{},()=>.381);
 for(const evidence of [2,0,1])courtAction(a,{type:'inspect',evidence});collect(b);
 for(let i=0;i<3;i++)courtAction(a,{type:'hint'});
 expose(a,ga.answer);expose(b,gb.answer);
 const ra=finishCourt(a,ga.answer,now),rb=finishCourt(b,gb.answer,now);
 assert.equal(ra.stats.contradictions,1);assert.equal(ra.score,rb.score);assert.equal(ra.bond,rb.bond);assert.equal(a.life.xp,b.life.xp);
});

test('a rehomed lead closes the saved hearing and cannot claim for a replacement resident',()=>{
 const s=fixture(),g=startCourt(s);collect(s);expose(s,g.answer);s.pets[0].id='replacement';
 assert.equal(currentCourt(s),null);assert.equal(s.life.court,null);assert.equal(finishCourt(s,g.answer,now),null);assert.equal(s.life.courtWins,0);
});
