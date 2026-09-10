import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {COURT_CASES,COURT_LEVELS,COURT_TRANSCRIPTS} from '../src/content/court.js';
import {newCourt,courtRuleFits,courtEvidence,courtHint,accuseCourt} from '../src/engine/court.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.lastTick=now;s.pets=[{id:'host',name:'Mrs Mortimer',traits:[],stats:{cute:4,menace:4,damp:4,mystique:4},needs:{food:60,fuss:60,clean:60},bond:0,cared:0,art:{}}];s.slots[0]='host';return s;}
function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}

test('generated court cases have exactly one answer and every exhibit is necessary',()=>{
 const s=fixture();
 for(let level=0;level<3;level++)for(let theme=0;theme<COURT_CASES.length;theme++)for(let seed=1;seed<=80;seed++){
  s.life.courtPlays=theme;
  const game=newCourt(s,seeded(seed+theme*1000),{level}),verdicts=game.suspects.map((_,i)=>courtEvidence(game,i));
  assert.equal(game.suspects.length,level===0?3:4);
  assert.equal(verdicts.filter(fits=>fits.every(Boolean)).length,1);
  assert.ok(verdicts[game.answer].every(Boolean));
  assert.equal(new Set(game.suspects.map(p=>p.facts.join(','))).size,game.suspects.length);
  for(let clue=0;clue<game.rules.length;clue++){
   const without=verdicts.filter(fits=>fits.every((fit,i)=>i===clue||fit));
   assert.equal(without.length,2,'Removing any exhibit must leave a genuine alternative');
  }
  assert.ok(verdicts.every((fits,i)=>i===game.answer||fits.filter(Boolean).length===game.rules.length-1));
  assert.equal(game.clues.length,game.evidenceTitles.length);
  game.suspects.forEach(suspect=>suspect.details.forEach((detail,i)=>assert.equal(detail,game.axes[i].values[suspect.facts[i]])));
 }
});

test('fixed scenario replays rotate facts, suspects and answer positions',()=>{
 const s=fixture(),signatures=new Set(),positions=new Set();
 for(let seed=1;seed<=300;seed++){
  const game=newCourt(s,seeded(seed),{level:2});
  signatures.add(JSON.stringify([game.rules,game.suspects.map(p=>p.facts)]));positions.add(game.answer);
 }
 assert.ok(signatures.size>280,'Replaying a theme must produce new reasoning, not just a shuffled fixed answer');
 assert.equal(positions.size,4);
});

test('challenge is a deliberate choice and successful play never forces a higher level',()=>{
 const s=fixture();s.life.courtWins=10000;
 assert.equal(newCourt(s).level,0);
 COURT_LEVELS.forEach((level,i)=>assert.equal(newCourt(s,()=>.5,{level:i}).difficulty,level.name));
 assert.equal(newCourt(s,()=>.5,{level:Infinity}).level,0);
 assert.equal(newCourt(s,()=>.5,{level:-1}).level,0);
 assert.equal(newCourt(s,()=>.5,{level:5}).level,2);
});

test('conditional and exclusive-or evidence handles the easily confused truth-table cases',()=>{
 const rule={type:'if',first:{axis:0,value:0},second:{axis:1,value:0}};
 assert.equal(courtRuleFits([0,0,0],rule),true);
 assert.equal(courtRuleFits([0,1,0],rule),false);
 assert.equal(courtRuleFits([1,0,0],rule),true,'If does not imply only if');
 assert.equal(courtRuleFits([1,1,0],rule),true,'A false premise does not rule the suspect out');
 const xor={...rule,type:'xor'};
 assert.equal(courtRuleFits([0,0,0],xor),false);
 assert.equal(courtRuleFits([1,1,0],xor),false);
 assert.equal(courtRuleFits([0,1,0],xor),true);
 assert.equal(courtRuleFits([1,0,0],xor),true);
});

test('hints teach each exhibit without giving a suspect name or changing rewards',()=>{
 const a=fixture(),b=fixture(),ga=newCourt(a,seeded(67),{level:2}),gb=newCourt(b,seeded(67),{level:2});
 for(let i=0;i<ga.rules.length;i++){
  const hint=courtHint(ga);assert.ok(hint.startsWith('Exhibit '+(i+1)+':'));
  assert.ok(!ga.suspects.some(suspect=>hint.includes(suspect.name)));
 }
 assert.equal(courtHint(ga),null);
 const hinted=accuseCourt(a,ga,ga.answer,now),plain=accuseCourt(b,gb,gb.answer,now);
 assert.equal(hinted.bond,plain.bond);assert.equal(hinted.fuss,plain.fuss);
 assert.equal(a.life.xp,b.life.xp);assert.equal(courtHint(ga),null);
});

test('all four suspects can be accused, verdicts explain every contradiction, and claims pay once',()=>{
 const chosen=new Set();
 for(let seed=1;seed<=40;seed++){
  const s=fixture(),game=newCourt(s,seeded(seed),{level:2}),choice=seed%4;
  chosen.add(choice);const result=accuseCourt(s,game,choice,now);
  assert.equal(result.correct,choice===game.answer);
  assert.equal(s.life.courtPlays,1);assert.equal(s.life.courtWins,result.correct?1:0);
  assert.equal(result.dialogue.length,4);
  assert.equal(result.reasons.filter(r=>r.culprit).length,1);
  result.reasons.forEach(reason=>{
   if(reason.culprit){assert.equal(reason.failed.length,0);return;}
   assert.equal(reason.failed.length,1);assert.ok(reason.explanation.length>30);
  });
  assert.equal(accuseCourt(s,game,choice,now),null);
  assert.equal(normalizeState(s).life.courtPlays,1);
 }
 assert.equal(chosen.size,4);
});

test('invalid court choices cannot consume a hearing or write progress',()=>{
 const s=fixture(),game=newCourt(s,()=>0,{level:2});
 for(const choice of [-1,4,NaN,Infinity,'0',null,undefined,1.5])assert.equal(accuseCourt(s,game,choice,now),null);
 assert.equal(s.life.courtPlays,0);assert.equal(game.claimed,false);
 s.pets=[];assert.equal(accuseCourt(s,game,game.answer,now),null);
});

test('each court story supplies crime-specific exhibits and a complete trial transcript',()=>{
 assert.equal(COURT_CASES.length,12);assert.equal(COURT_TRANSCRIPTS.length,COURT_CASES.length);
 assert.equal(new Set(COURT_CASES.map(c=>c.title)).size,12);
 COURT_TRANSCRIPTS.forEach(transcript=>{
  for(const key of ['charge','opening','prosecution','plea','conviction','acquittal','sentence','objection','reconstruction'])assert.ok(transcript[key].length>20,key);
  assert.equal(transcript.exhibits.length,3);
  assert.equal(new Set(transcript.exhibits).size,3);
 });
});
