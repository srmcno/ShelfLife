import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {startCourt,currentCourt,courtAction,courtEvidence,courtDocket,finishCourt} from '../src/engine/court.js';
import {courtMarkup,courtFinishedMarkup} from '../src/ui/court.js';
function fixture(){const state=blankState();state.pets=[{id:'p',name:'Pip',traits:[],art:{},needs:{food:60,fuss:60,clean:60},bond:0}];state.slots[0]='p';return state;}

test('the clerk suggests remaining witnesses from recorded rulings, never the hidden culprit',()=>{
  for(const reworked of [false,true])for(let seed=1;seed<24;seed++){
    let state=fixture(),game=startCourt(state,{reworked,level:2},()=>seed/25);
    const docket=courtDocket(game);
    assert.deepEqual(docket.remaining,[0,1,2,3]);assert.deepEqual(docket.cleared,[]);assert.equal(docket.ready,false);
    assert.deepEqual(courtDocket({...game,answer:(game.answer+1)%4}),docket,'Changing a hidden answer must not influence suggested people');
    for(let evidence=0;evidence<3;evidence++)courtAction(state,{type:'inspect',evidence});
    assert.equal(courtDocket(currentCourt(state)).ready,true);
    for(let suspect=0;suspect<4;suspect++){
      if(suspect===game.answer)continue;
      courtAction(state,{type:'focus',chapter:'hearing',suspect});
      courtAction(state,{type:'compare',suspect,evidence:courtEvidence(game,suspect).findIndex(f=>!f)});
      const current=currentCourt(state),progress=courtDocket(current);
      assert.ok(!progress.remaining.includes(suspect));assert.ok(progress.remaining.includes(progress.nextSuspect));
      assert.match(courtMarkup(current),new RegExp('data-life="court-call" data-choice="'+progress.nextSuspect+'">Call '));
      state=normalizeState(JSON.parse(JSON.stringify(state)));
      assert.deepEqual(courtDocket(currentCourt(state)),progress);
    }
    assert.deepEqual(courtDocket(currentCourt(state)).remaining,[game.answer]);
  }
});

test('a matching argument offers an untested clue, while an appeal also advances the public docket',()=>{
  const state=fixture(),game=startCourt(state,{reworked:true,level:2},()=>.43);
  for(let evidence=0;evidence<3;evidence++)courtAction(state,{type:'inspect',evidence});
  courtAction(state,{type:'focus',chapter:'hearing',suspect:game.answer,statement:0});
  courtAction(state,{type:'compare',suspect:game.answer,evidence:0});
  assert.match(courtMarkup(currentCourt(state)),/data-life="court-clue" data-clue="1">Read clue 2/);
  const innocent=game.suspects.findIndex((_,i)=>i!==game.answer);
  assert.equal(finishCourt(state,innocent).retry,true);
  const docket=courtDocket(currentCourt(state));assert.deepEqual(docket.cleared,[innocent]);assert.ok(!docket.remaining.includes(innocent));
});

test('the completed hearing shows the personal plea and actual sentence without opening a disclosure',()=>{
  const state=fixture(),game=startCourt(state,{reworked:true,level:1},()=>.58);
  for(let evidence=0;evidence<3;evidence++)courtAction(state,{type:'inspect',evidence});
  const result=finishCourt(state,game.answer),markup=courtFinishedMarkup(currentCourt(state),result,state.life.courtWins);
  const sentence=markup.slice(markup.indexOf('<section class="court-sentence"'),markup.indexOf('<div class="court-result">'));
  assert.ok(sentence.includes(game.trial.plea));assert.ok(sentence.includes(game.trial.sentence));assert.ok(!sentence.includes('<details'));
  assert.equal(finishCourt(state,game.answer),null);
});
