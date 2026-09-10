import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {startCourt,currentCourt,courtAction,finishCourt,courtEvidence} from '../src/engine/court.js';
import {courtMarkup,courtFinishedMarkup,courtView,courtViewAction,crimeExhibits} from '../src/ui/court.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(){const state=blankState();state.lastTick=now;state.pets=[{id:'host',name:'Mrs Mortimer',traits:[],stats:{cute:4,menace:4,damp:4,mystique:4},needs:{food:60,fuss:60,clean:60},bond:0,cared:0,art:{}}];state.slots[0]='host';return state;}
function focus(state,chapter,suspect=0,statement=0){courtAction(state,{type:'focus',chapter,suspect,statement});return currentCourt(state);}
function collect(state){for(const e of crimeExhibits(currentCourt(state)))courtAction(state,{type:'inspect',evidence:e.source});}
const footer=markup=>markup.slice(markup.indexOf('<footer class="court-action-bar">'));
test('one case panel scrolls independently of the two permanent action buttons',()=>{
 const state=fixture();startCourt(state,{},()=>.52);
 for(const chapter of ['investigation','hearing','verdict']){
  const markup=courtMarkup(focus(state,chapter));
  assert.equal((markup.match(/class="court-action-panel"/g)||[]).length,1);
  assert.ok(markup.indexOf('</section></div><footer class="court-action-bar">')>0);
  assert.equal((footer(markup).match(/<button /g)||[]).length,2);
 }
});
test('every displayed exhibit is a crime clue and every record uses the same factual axes as that clue',()=>{
 for(let level=0;level<3;level++)for(let seed=1;seed<20;seed++){
  const state=fixture(),game=startCourt(state,{level},()=>seed/20),exhibits=crimeExhibits(game);
  assert.equal(exhibits.length,game.rules.length);
  exhibits.forEach((e,i)=>{assert.equal(e.clue,game.clues[i]);assert.equal(e.collected,false);assert.equal(e.source,game.rules[i].first.axis);
   e.records.forEach((record,suspect)=>{assert.ok(record.includes(game.suspects[suspect].details[game.rules[i].first.axis]));if(game.rules[i].second)assert.ok(record.includes(game.suspects[suspect].details[game.rules[i].second.axis]));});
  });
  assert.ok(!courtMarkup(focus(state,'verdict')).includes(exhibits[0].records[0]));
  courtAction(state,{type:'inspect',evidence:exhibits[0].source});focus(state,'investigation');assert.match(footer(courtMarkup(currentCourt(state))),/>Inspect Exhibit 2</);
  collect(state);assert.match(footer(courtMarkup(currentCourt(state))),/data-chapter="hearing" >Compare suspects/);
 }
});
test('a full deduction works without the disconnected testimony puzzle and survives save restoration',()=>{
 for(let level=0;level<3;level++){
  let state=fixture();const game=startCourt(state,{level},()=>.43);collect(state);
  for(let i=0;i<game.suspects.length;i++){
   if(i===game.answer)continue;
   const failed=courtEvidence(game,i).findIndex(fit=>!fit);
   assert.equal(courtAction(state,{type:'compare',suspect:i,evidence:failed}).kind,'sustained');
   assert.equal(finishCourt(state,i,now),null,'A factually cleared suspect cannot be convicted');
  }
  state=normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(currentCourt(state).eliminations.length,game.suspects.length-1);
  assert.equal(currentCourt(state).exposures.length,0);
  const result=finishCourt(state,game.answer,now);assert.equal(result.correct,true);
  const xp=state.life.xp;state=normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(currentCourt(state).claimed,true);assert.equal(finishCourt(state,game.answer,now),null);assert.equal(state.life.xp,xp);
  assert.match(courtFinishedMarkup(currentCourt(state),result,state.life.courtWins),/innocents cleared/);
 }
});
test('a matching clue never clears a suspect; a wrong accusation explains the mismatch and leaves a retry',()=>{
 const state=fixture(),game=startCourt(state,{level:2},()=>.61),innocent=(game.answer+1)%4;
 assert.equal(courtAction(state,{type:'compare',suspect:innocent,evidence:0}),null);
 assert.match(footer(courtMarkup(focus(state,'verdict',innocent))),/data-life="court-file" disabled/);
 collect(state);const fits=courtEvidence(game,innocent).findIndex(Boolean);
 assert.equal(courtAction(state,{type:'compare',suspect:innocent,evidence:fits}).kind,'overruled');assert.deepEqual(currentCourt(state).eliminations,[]);
 assert.equal(courtAction(state,{type:'compare',suspect:innocent,evidence:fits}),null,'Repeated comparisons do not inflate the log');
 const retry=finishCourt(state,innocent,now);assert.equal(retry.retry,true);assert.match(retry.text,/cleared by clue/);
 assert.match(footer(courtMarkup(focus(state,'verdict',innocent))),/data-life="court-file" disabled/);
 assert.equal(finishCourt(state,game.answer,now).correct,true);
});
test('court view rejects invalid choices and escapes resident names',()=>{
 const state=fixture();state.pets[0].name='<img src=x onerror=alert(1)>';const game=startCourt(state,{},()=>.1);
 for(const value of [-1,999,NaN,Infinity,.5,'1'])assert.equal(courtViewAction(game,'witness',value),false);
 assert.equal(courtViewAction(game,'chapter','not-a-chapter'),false);courtViewAction(game,'chapter','hearing');game.ui.exhibit=99;assert.equal(courtView(game).exhibit,0);
 const markup=courtMarkup(game);assert.ok(!markup.includes('<img src=x'));assert.ok(markup.includes('&lt;img src=x'));
});
