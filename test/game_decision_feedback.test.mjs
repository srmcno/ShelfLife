import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { initialErrands, errandProgress, errandPurchasePreview, maxRemainingErrands, applyErrandMove } from '../src/engine/market-errands.js';
import { startCourt, currentCourt, courtAction, courtEvidence, courtClueHelp, courtClearingReason, courtScore, finishCourt } from '../src/engine/court.js';
import { courtMarkup } from '../src/ui/court.js';
import { marketMarkup } from '../src/ui/market.js';

function shelf(){
  const state=blankState();
  state.pets=[{id:'p',name:'Pip',traits:[],art:{},needs:{food:60,fuss:60,clean:60},bond:0}];
  state.slots[0]='p';return state;
}
function basket(){
  const market=initialErrands(5);
  const packed={id:'packed',name:'Soft oddity',cost:2,tags:['cozy','odd']};
  const offered={id:'offered',name:'Warm sock',cost:3,tags:['cozy']};
  market.step=1;market.buttons=7;market.bag=[packed];market.stalls[1]=[offered];
  market.requests=[{id:'comfort',name:'Two comforts',tags:['cozy','cozy']},{id:'visitor',name:'Visitor tea',tags:['cozy','odd']}];
  return {market,packed,offered};
}

test('shopping guidance respects two distinct objects, alternative tag assignments, and consumed deliveries',()=>{
  const {market,packed}=basket();
  assert.equal(errandProgress(market,market.requests[0]).pairs.length,0,'one object cannot fulfil both comforts');
  assert.deepEqual(errandProgress(market,market.requests[0]).partners,[{item:packed,tag:'cozy'}]);
  assert.deepEqual(errandProgress(market,market.requests[1]).partners.map(p=>p.tag).sort(),['cozy','odd']);
  market.delivered.push('visitor');
  assert.deepEqual(errandProgress(market,market.requests[1]),{delivered:true,pairs:[],partners:[]});
});

test('purchase previews reveal the exact new pairs without spending buttons or hiding a return',()=>{
  const {market,packed,offered}=basket(),before=structuredClone(market);
  const preview=errandPurchasePreview(market,offered);
  assert.equal(preview.buttons,4);
  assert.deepEqual(preview.ready.map(p=>p.request.id),['comfort','visitor']);
  assert.ok(preview.ready.every(p=>p.pair.map(i=>i.id).join(',')==='packed,offered'));
  assert.deepEqual(market,before);
  const replacing=errandPurchasePreview(market,offered,packed.id);
  assert.equal(replacing.buttons,5);assert.deepEqual(replacing.ready,[],'the returned object cannot also be delivered');
  assert.deepEqual(market,before);
  market.buttons=2;assert.equal(errandPurchasePreview(market,offered),null);
  assert.equal(errandPurchasePreview(market,offered,packed.id).buttons,0);
  market.buttons=10;market.bag.push({...packed,id:'second'},{...packed,id:'third'});
  assert.equal(errandPurchasePreview(market,offered),null,'a full bag cannot promise a purchase');
  market.traded=true;assert.equal(errandPurchasePreview(market,offered,packed.id),null);
});

test('market warns when a pass makes a three-errand finish impossible and exposes unfinished final deliveries',()=>{
  const market=initialErrands(5);
  assert.equal(maxRemainingErrands(market),3);assert.equal(maxRemainingErrands(market,true),2);
  assert.match(marketMarkup(shelf(),market),/Passing this stall leaves at most 2 of 3 errands possible/);
  applyErrandMove(market,{pick:null,trade:null});assert.equal(maxRemainingErrands(market),2);
  market.step=6;market.bag=market.stalls.flat();
  const ready=market.requests.find(r=>errandProgress(market,r).pairs.length);
  assert.ok(ready);
  market.bag=errandProgress(market,ready).pairs[0];
  const markup=marketMarkup(shelf(),market,'',null,'','bag');
  assert.match(markup,/Send the ready pair/);assert.match(markup,/Leave with undelivered shopping/);
  market.step=1;const tradeMarkup=marketMarkup(shelf(),market,'',null,'','bag');
  assert.equal((tradeMarkup.match(/<label /g)||[]).length,1);
  assert.equal((tradeMarkup.match(/<\/label>/g)||[]).length,1);
});

test('Court explanations teach the selected clue and can be reread without mutating the case',()=>{
  const state=shelf(),game=startCourt(state,{level:2,reworked:true},()=>.72),before=structuredClone(game);
  game.rules.forEach((_,i)=>{const explanation=courtClueHelp(game,i);assert.ok(explanation);assert.equal(courtClueHelp(game,i),explanation);assert.ok(!explanation.includes('Pip'));});
  assert.deepEqual(game,before);
  assert.equal(courtClueHelp(game,99),'');assert.equal(courtClueHelp(game,'0'),'');
  for(let evidence=0;evidence<3;evidence++)courtAction(state,{type:'inspect',evidence});
  courtAction(state,{type:'focus',chapter:'hearing',suspect:0,statement:2});
  const markup=courtMarkup(currentCourt(state));
  assert.match(markup,/Explain clue 3 · free/);assert.ok(!markup.includes('data-life="court-hint"'));
});

test('Court only remembers demonstrated clearings and the visible score agrees with the saved verdict',()=>{
  let state=shelf();const initial=startCourt(state,{level:1,reworked:true},()=>.62),innocents=initial.suspects.map((_,i)=>i).filter(i=>i!==initial.answer);
  const base=courtScore(initial);assert.equal(base,125);
  for(const i of innocents)assert.equal(courtClearingReason(initial,i),null,'the notebook cannot solve an untested suspect');
  for(let evidence=0;evidence<3;evidence++)courtAction(state,{type:'inspect',evidence});
  const innocent=innocents[0],wrongClue=courtEvidence(initial,innocent).findIndex(Boolean);
  courtAction(state,{type:'compare',suspect:innocent,evidence:wrongClue});
  assert.equal(courtScore(currentCourt(state)),base-5);assert.equal(courtClearingReason(currentCourt(state),innocent),null);
  const clue=courtEvidence(initial,innocent).findIndex(f=>!f);
  courtAction(state,{type:'compare',suspect:innocent,evidence:clue});
  const reason=courtClearingReason(currentCourt(state),innocent);
  assert.equal(reason.evidence,clue);assert.ok(reason.text);assert.equal(courtScore(currentCourt(state)),base+5);
  state=normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(courtClearingReason(currentCourt(state),innocent),reason);
  const appealed=finishCourt(state,innocents[1]);assert.equal(appealed.retry,true);
  assert.ok(courtClearingReason(currentCourt(state),innocents[1]));assert.equal(courtScore(currentCourt(state)),base-10);
  const visible=courtScore(currentCourt(state)),result=finishCourt(state,initial.answer);
  assert.equal(result.score,visible);
});
