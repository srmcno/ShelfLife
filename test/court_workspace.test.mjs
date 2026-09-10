import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState} from '../src/state.js';
import {startCourt,currentCourt,courtAction,finishCourt} from '../src/engine/court.js';
import {courtMarkup,courtFinishedMarkup,courtView,courtViewAction} from '../src/ui/court.js';
const now=new Date(2026,8,10,12).getTime();
function fixture(){const state=blankState();state.lastTick=now;state.pets=[{id:'host',name:'Mrs Mortimer',traits:[],stats:{cute:4,menace:4,damp:4,mystique:4},needs:{food:60,fuss:60,clean:60},bond:0,cared:0,art:{}}];state.slots[0]='host';return state;}
function focus(state,chapter,suspect=0,statement=0,evidence=0){courtAction(state,{type:'focus',chapter,suspect,statement,evidence});return currentCourt(state);}
function collect(state){for(let evidence=0;evidence<3;evidence++)courtAction(state,{type:'inspect',evidence});}
function expose(state,suspect){courtAction(state,{type:'question',suspect});const statement=currentCourt(state).witnesses[suspect].falseStatement;courtAction(state,{type:'present',suspect,statement,evidence:statement});}
const footer=markup=>markup.slice(markup.indexOf('<footer class="court-action-bar">'));

test('each courtroom chapter renders one focus panel followed by separate always-available actions',()=>{
 const state=fixture();startCourt(state,{},()=>.52);
 for(const chapter of ['investigation','hearing','verdict']){
  const markup=courtMarkup(focus(state,chapter));
  assert.equal((markup.match(/class="court-action-panel"/g)||[]).length,1);
  assert.equal((markup.match(/class="court-action-bar"/g)||[]).length,1);
  assert.ok(markup.indexOf('</section></div><footer class="court-action-bar">')>0,'Footer is outside the scrollable panel and workspace');
  assert.match(markup,/aria-label="Court chapters"/);
  assert.equal((footer(markup).match(/<button /g)||[]).length,2);
 }
});

test('investigation suggests the next uninspected object and never strands the player on repeated inspection',()=>{
 const state=fixture();startCourt(state,{},()=>.91);
 assert.match(footer(courtMarkup(currentCourt(state))),/>Inspect Exhibit 1</);
 courtAction(state,{type:'inspect',evidence:0});
 let markup=courtMarkup(focus(state,'investigation',0,0,0));
 assert.match(footer(markup),/data-life="court-inspect" data-exhibit="1">Inspect next object/);
 assert.match(footer(markup),/>Call a witness</);
 collect(state);markup=courtMarkup(focus(state,'investigation'));
 assert.ok(!footer(markup).includes('court-inspect'));
 assert.match(footer(markup),/data-life="court-chapter" data-chapter="hearing" >Call a witness/);
});

test('uncollected records stay undisclosed and evidence without a crime clue is not given a different clue by index',()=>{
 const state=fixture(),game=startCourt(state,{},()=>.52);
 let markup=courtMarkup(focus(state,'verdict'));
 for(const evidence of game.sceneEvidence){
  assert.ok(!markup.includes(evidence.records[0].text));
  for(const clue of evidence.clues)assert.ok(!markup.includes(clue.text));
 }
 const evidence=game.sceneEvidence.find(e=>!e.clues.length);assert.ok(evidence);
 courtAction(state,{type:'inspect',evidence:evidence.id});
 markup=courtMarkup(focus(state,'investigation',0,0,evidence.id));
 assert.ok(markup.includes('Verifies individual testimony; it does not establish the culprit.'));
 for(const clue of game.clues)assert.ok(!markup.includes(clue));
});

test('hearing compares the chosen statement and named physical record, and exposes corrected dialogue',()=>{
 const state=fixture(),game=startCourt(state,{},()=>.32),suspect=game.answer;collect(state);
 courtAction(state,{type:'question',suspect});const statement=game.witnesses[suspect].falseStatement;
 let current=focus(state,'hearing',suspect,statement,statement),markup=courtMarkup(current);
 assert.ok(markup.includes(current.sceneEvidence[statement].records[suspect].text));
 assert.match(footer(markup),/>Present Exhibit [123]</);
 expose(state,suspect);current=focus(state,'hearing',suspect,statement,statement);markup=courtMarkup(current);
 assert.ok(markup.includes('corrected statement'));assert.ok(markup.includes('Account corrected.'));
 assert.match(footer(markup),/>Review accusation</);
 assert.ok(!footer(markup).includes('court-present'));
});

test('verdict action obeys collected clues, actual exposure and acquittals',()=>{
 const state=fixture(),game=startCourt(state,{level:2},()=>.61),suspect=(game.answer+1)%4;
 assert.match(footer(courtMarkup(focus(state,'verdict',suspect))),/data-life="court-file" disabled/);
 collect(state);assert.match(footer(courtMarkup(focus(state,'verdict',suspect))),/data-life="court-file" disabled/);
 expose(state,suspect);assert.match(footer(courtMarkup(focus(state,'verdict',suspect))),/data-life="court-file" >Deliver verdict/);
 assert.equal(finishCourt(state,suspect,now).retry,true);
 const markup=courtMarkup(focus(state,'verdict',suspect));
 assert.match(footer(markup),/data-life="court-file" disabled/);
 assert.match(footer(markup),/This suspect is cleared/);
 expose(state,game.answer);const result=finishCourt(state,game.answer,now);
 const finished=courtFinishedMarkup(currentCourt(state),result,state.life.courtWins);
 assert.match(footer(finished),/>Another case</);assert.match(footer(finished),/>Back to the shelf</);
 assert.ok(!finished.includes('court-file'));
});

test('court view rejects invalid selections and escapes restored resident and evidence text',()=>{
 const state=fixture();state.pets[0].name='<img src=x onerror=alert(1)>';const game=startCourt(state,{},()=>.1);
 for(const value of [-1,999,NaN,Infinity,.5,'1'])assert.equal(courtViewAction(game,'witness',value),false);
 assert.equal(courtViewAction(game,'chapter','not-a-chapter'),false);
 assert.equal(courtViewAction(game,'chapter','hearing'),true);
 game.ui.exhibit=99;assert.equal(courtView(game).exhibit,0);
 const markup=courtMarkup(game);assert.ok(!markup.includes('<img src=x'));assert.ok(markup.includes('&lt;img src=x'));
});
