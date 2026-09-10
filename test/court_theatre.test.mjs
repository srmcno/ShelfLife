import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState} from '../src/state.js';
import {newCourt,courtEvidence,accuseCourt} from '../src/engine/court.js';
import {courtHearing,courtInteract,courtMarkup,courtResultMarkup} from '../src/ui/court.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.lastTick=now;s.pets=[{id:'host',name:'Mrs Mortimer',traits:[],stats:{cute:4,menace:4,damp:4,mystique:4},needs:{food:60,fuss:60,clean:60},bond:0,cared:0,art:{}}];s.slots[0]='host';return s;}
function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}

test('cross-examination rules on the chosen evidence, clears only innocents, and never submits a verdict',()=>{
 for(let level=0;level<3;level++)for(let seed=1;seed<=80;seed++){
  const state=fixture(),game=newCourt(state,seeded(seed),{level});
  for(let suspect=0;suspect<game.suspects.length;suspect++){
   assert.equal(courtInteract(game,'select',suspect),true);
   assert.equal(courtHearing(game).line,game.suspects[suspect].defence);
   const evidence=courtEvidence(game,suspect);
   for(let exhibit=0;exhibit<evidence.length;exhibit++){
    assert.equal(courtInteract(game,'exhibit',exhibit),true);
    assert.equal(courtInteract(game,'object'),true);
    assert.equal(game.hearing.phase,evidence[exhibit]?'overruled':'sustained');
    assert.equal(game.choice,null);assert.equal(game.claimed,false);
   }
   assert.equal(game.hearing.cleared.includes(suspect),suspect!==game.answer);
  }
  assert.equal(new Set(game.hearing.cleared).size,game.suspects.length-1);
  assert.equal(state.life.courtPlays,0);assert.equal(state.life.courtWins,0);
 }
});

test('optional cross-examination neither changes rewards nor prevents an unassisted verdict',()=>{
 const a=fixture(),b=fixture(),assisted=newCourt(a,seeded(91),{level:2}),plain=newCourt(b,seeded(91),{level:2});
 for(let suspect=0;suspect<assisted.suspects.length;suspect++){
  courtInteract(assisted,'select',suspect);
  for(let i=0;i<assisted.clues.length;i++){courtInteract(assisted,'exhibit',i);courtInteract(assisted,'object');}
 }
 const result=accuseCourt(a,assisted,assisted.answer,now),other=accuseCourt(b,plain,plain.answer,now);
 assert.deepEqual(result,other);assert.equal(a.life.xp,b.life.xp);
 assert.equal(courtInteract(assisted,'select',0),false);
 assert.equal(courtInteract(assisted,'object'),false);
});

test('bad stage input cannot choose a hidden answer or generate a false ruling',()=>{
 const game=newCourt(fixture(),seeded(6));
 assert.equal(courtInteract(null,'object'),false);
 assert.equal(courtInteract(game,'object'),false);
 for(const invalid of [-1,999,NaN,Infinity,.5,'1']){
  assert.equal(courtInteract(game,'select',invalid),false);
  assert.equal(courtInteract(game,'exhibit',invalid),false);
 }
 assert.equal(game.selection,null);assert.equal(courtHearing(game).phase,'opening');
 assert.equal(courtInteract(game,'charge'),true);assert.equal(game.hearing.line,game.trial.charge);
 assert.equal(courtInteract(game,'prosecution'),true);assert.equal(game.hearing.line,game.trial.prosecution);
 assert.equal(courtInteract(game,'verdict'),false);assert.equal(game.claimed,false);
});

test('court renders resident text safely and separates cleared suspects from final accusation',()=>{
 const state=fixture();state.pets[0].name='<img src=x onerror=alert(1)>';
 const game=newCourt(state,seeded(2));
 let markup=courtMarkup(game);assert.ok(!markup.includes('<img src=x'));assert.ok(markup.includes('&lt;img src=x'));
 const innocent=game.suspects.findIndex((_,i)=>i!==game.answer),contradiction=courtEvidence(game,innocent).findIndex(fits=>!fits);
 courtInteract(game,'select',innocent);courtInteract(game,'exhibit',contradiction);courtInteract(game,'object');
 markup=courtMarkup(game);
 assert.match(markup,/data-life="court-confirm" disabled/);
 assert.ok(markup.includes('Cleared by the evidence'));
 courtInteract(game,'select',game.answer);
 assert.match(courtMarkup(game),/data-life="court-confirm" >Present verdict/);
 const result=accuseCourt(state,game,game.answer,now),finished=courtResultMarkup(game,result,state.life.courtWins);
 assert.ok(finished.includes('phase-conviction'));assert.ok(finished.includes('GUILTY'));
 assert.ok(!finished.includes('<img src=x'));assert.ok(!finished.includes('data-life="court-confirm"'));
});

test('a wrong verdict stages the selected suspect acquittal and explains the true culprit separately',()=>{
 const state=fixture(),game=newCourt(state,seeded(67));
 const choice=game.suspects.findIndex((_,i)=>i!==game.answer),result=accuseCourt(state,game,choice,now);
 const markup=courtResultMarkup(game,result,state.life.courtWins);
 assert.ok(markup.includes('phase-acquittal'));assert.ok(markup.includes('ACQUITTED'));
 assert.equal(game.choice,choice);assert.equal(game.hearing.line,game.trial.acquittal);
 assert.ok(result.dialogue.some(line=>line.text.includes(game.suspects[game.answer].name)));
});
