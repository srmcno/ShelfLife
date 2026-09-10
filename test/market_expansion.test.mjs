import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {normalizeLife} from '../src/life-state.js';
import {MARKET_RARITIES} from '../src/content/life.js';
import {marketLayout,marketSnapshot,startMarket,chooseMarket,claimMarket,bestMarketScore} from '../src/engine/life.js';
import {marketMarkup} from '../src/ui/market.js';

const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.life.introDone=true;s.pets=[{id:'a',name:'Pip',traits:[],stats:{cute:5,menace:5,damp:5,mystique:5},needs:{food:65,fuss:65,clean:65},art:{},bond:0}];s.slots[0]='a';return s;}
const expandedPlan=[{pick:'extracted-halo'},{pick:null},{pick:null},{pick:'saints-biscuit'},{pick:null,secret:true},{pick:'mirror-spoon'}];

test('expanded rare stock is deterministic while original first-market stock stays unchanged',()=>{
 const seed=2654435761,old=marketLayout(seed),expanded=marketLayout(seed,{version:2});
 assert.equal(old.stalls[0][1].id,'sugar-star');assert.equal(expanded.stalls[0][1].id,'extracted-halo');
 assert.deepEqual(expanded,marketLayout(seed,{version:2}));assert.deepEqual(old.requests,expanded.requests);
 assert.equal(expanded.stalls.flat().filter(i=>MARKET_RARITIES.includes(i)).length,2);
 assert.equal(new Set(expanded.stalls.flat().map(i=>i.id)).size,12);
 assert.equal(bestMarketScore(seed),24);assert.equal(bestMarketScore(seed,{version:2}),26);
});

test('selling a secret is one atomic alternative to a purchase and does not inflate an empty basket score',()=>{
 const s=fixture();startMarket(s,{expanded:true});const before=marketSnapshot(s);
 assert.equal(chooseMarket(s,'tiny-prophecy',null,{secret:true}),false);assert.equal(marketSnapshot(s).step,0);
 assert.equal(chooseMarket(s,null,null,{secret:true}),true);const after=marketSnapshot(s);
 assert.equal(after.buttons,13);assert.equal(after.score.total,before.score.total);assert.equal(after.score.scandal,3);
 assert.equal(after.step,1);assert.deepEqual(after.bag,[]);assert.equal(after.secretStall,0);
 const saved=structuredClone(s.life.market);assert.equal(chooseMarket(s,null,null,{secret:true}),false);assert.deepEqual(s.life.market,saved);
 assert.equal(chooseMarket(s,'extracted-halo'),false,'the abandoned stall cannot be bought retroactively');
 assert.equal(s.life.xp,0);assert.deepEqual(s.pets[0].needs,{food:65,fuss:65,clean:65});
});

test('a costly basket genuinely needs the secret tradeoff and survives reload after every decision',()=>{
 let s=fixture();startMarket(s,{expanded:true});
 for(const move of expandedPlan){
  assert.equal(chooseMarket(s,move.pick,null,{secret:!!move.secret}),true);const before=marketSnapshot(s);
  s=normalizeState(s);assert.deepEqual(marketSnapshot(s),before);
 }
 const m=marketSnapshot(s);assert.equal(m.score.total,26);assert.equal(m.score.charm,17);assert.equal(m.score.requestPoints,12);assert.equal(m.buttons,0);
 const result=claimMarket(s,now);assert.equal(result.relic.id,'market:2');assert.equal(claimMarket(s,now),null);
 const xp=s.life.xp,seed=m.seed;assert.equal(startMarket(s,{replay:true}),true);assert.equal(marketSnapshot(s).version,2);assert.equal(marketSnapshot(s).seed,seed);
 for(const move of expandedPlan)assert.equal(chooseMarket(s,move.pick,null,{secret:!!move.secret}),true);
 claimMarket(s,now);assert.equal(s.life.xp,xp,'replaying the same new prize cannot farm discoveries');
 const without=fixture();startMarket(without,{expanded:true});
 for(const move of expandedPlan.slice(0,4))assert.equal(chooseMarket(without,move.pick),true);
 chooseMarket(without,null);assert.equal(chooseMarket(without,'mirror-spoon'),false,'the tempting final object is unaffordable without giving up an earlier stall');
});

test('old market saves and their retries never acquire new stock or secret rules',()=>{
 const s=fixture();startMarket(s);
 assert.equal(chooseMarket(s,null,null,{secret:true}),false);
 for(const pick of ['tiny-prophecy',null,null,null,'brass-sun','mirror-spoon'])assert.equal(chooseMarket(s,pick),true);
 assert.equal(claimMarket(s,now).relic.id,'market:2');assert.equal(marketSnapshot(s).score.total,24);
 startMarket(s,{replay:true,expanded:true});assert.equal(marketSnapshot(s).version,1);assert.equal(marketSnapshot(s).stalls[0][1].id,'sugar-star');
});

test('a damaged expanded history stops at a repeated secret and cannot claim a prize',()=>{
 const s=fixture();startMarket(s,{expanded:true});chooseMarket(s,null,null,{secret:true});
 s.life.market.moves.push({pick:null,trade:null,secret:true},{pick:null,trade:null});s.life.market.claimed=true;
 const loaded=normalizeState(s),m=marketSnapshot(loaded);assert.equal(m.step,1);assert.equal(m.buttons,13);assert.equal(m.claimed,false);assert.equal(claimMarket(loaded,now),null);
 const old=normalizeLife({market:{seed:1,moves:[{pick:null,trade:null,secret:true}]}});assert.equal(old.market.moves[0].secret,undefined,'new move properties are not smuggled into an original rules save');
});

test('the selected market offer drives a separate purchase dock without changing the basket',()=>{
 const s=fixture();startMarket(s,{expanded:true});const m=marketSnapshot(s),before=structuredClone(s.life.market);
 const html=marketMarkup(s,m,'',null,'extracted-halo');
 assert.equal((html.match(/class="adventure-scroll"/g)||[]).length,1);
 assert.match(html,/<\/div><footer class="adventure-actions market-action-dock">/);
 assert.equal((html.match(/data-life="market-buy"/g)||[]).length,1);
 assert.match(html,/<button[^>]*data-life="market-buy"[^>]*data-id="extracted-halo"/);
 assert.match(html,/Buy · 5 buttons/);assert.match(html,/data-life="market-pass"/);assert.match(html,/data-life="market-secret"/);
 assert.deepEqual(s.life.market,before,'selecting or inspecting an offer does not spend buttons');
 for(const panel of ['bag','requests','route']){
  const view=marketMarkup(s,m,'',null,'extracted-halo',panel);
  assert.match(view,/class="market-context-panel"/);assert.doesNotMatch(view,/class="market-offer-selector"/);
  assert.match(view,/<button[^>]*data-life="market-buy"[^>]*data-id="extracted-halo"/);
 }
 chooseMarket(s,null,null,{secret:true});assert.doesNotMatch(marketMarkup(s,marketSnapshot(s)),/data-life="market-secret"/);
});

test('a full market bag exposes an actionable trade picker instead of a dead purchase button',()=>{
 const s=fixture();startMarket(s);for(const pick of ['sugar-star','tea-sock','bedtime-biscuit'])chooseMarket(s,pick);
 const m=marketSnapshot(s),view=marketMarkup(s,m);
 assert.match(view,/data-life="market-panel" data-panel="bag">Choose a trade-in/);
 assert.doesNotMatch(view,/data-life="market-buy"/);
 const trading=marketMarkup(s,m,'sugar-star',null,'comfort-crumbs','bag');
 assert.match(trading,/Trade &amp; buy|Trade & buy/);
 assert.match(trading,/<button[^>]*data-life="market-buy"[^>]*data-id="comfort-crumbs"/);
});
