import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {normalizeLife} from '../src/life-state.js';
import {MARKET_ITEMS,MARKET_REQUESTS} from '../src/content/life.js';
import {marketLayout,marketSnapshot,startMarket,chooseMarket,claimMarket,bestMarketScore,scoreMarket} from '../src/engine/life.js';

const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.life.introDone=true;s.pets=[{id:'a',name:'Pip',traits:[],stats:{cute:5,menace:5,damp:5,mystique:5},needs:{food:65,fuss:65,clean:65},art:{},bond:0}];s.slots[0]='a';return s;}
function decisions(s,picks){for(const pick of picks)assert.equal(chooseMarket(s,pick),true);}
const perfectFirstMarket=['tiny-prophecy',null,null,null,'brass-sun','mirror-spoon'];

test('old saves have a fresh market without changing the rest of the shelf',()=>{
 const s=fixture();delete s.life.market;delete s.life.marketSerial;delete s.life.marketBest;delete s.life.marketRuns;
 s.life.xp=11;s.life.relics=['drawer:2'];const loaded=normalizeState(s);
 assert.equal(loaded.life.market,null);assert.equal(loaded.life.marketRuns,0);assert.equal(loaded.life.marketBest,0);
 assert.equal(loaded.life.xp,11);assert.deepEqual(loaded.life.relics,['drawer:2']);assert.equal(loaded.pets[0].name,'Pip');
});

test('requests require distinct items while sharing those items across different requests',()=>{
 const spoon=MARKET_ITEMS.find(i=>i.id==='mirror-spoon'),sun=MARKET_ITEMS.find(i=>i.id==='brass-sun'),receipt=MARKET_ITEMS.find(i=>i.id==='tiny-prophecy');
 const requests=['cabinet','museum','spectacle'].map(id=>MARKET_REQUESTS.find(r=>r.id===id));
 assert.deepEqual(scoreMarket([spoon],7,requests).fulfilled,[false,false,false],'one dual-tag object cannot fill a two-object request');
 const score=scoreMarket([receipt,sun,spoon],2,requests);
 assert.deepEqual(score.fulfilled,[true,true,true]);assert.equal(score.total,24);assert.equal(score.requestPoints,12);assert.equal(score.charm,10);
});

test('the first market rewards a genuinely optimal, reproducible basket',()=>{
 const s=fixture();assert.equal(startMarket(s),true);assert.equal(startMarket(s),false,'an active route cannot be overwritten');
 assert.equal(claimMarket(s,now),null,'a partial route cannot pay out');
 decisions(s,perfectFirstMarket);const m=marketSnapshot(s);assert.equal(m.score.total,24);assert.equal(bestMarketScore(m.seed),24);
 const result=claimMarket(s,now);assert.equal(result.relic.id,'market:2');assert.equal(s.life.marketBest,24);assert.equal(s.life.marketRuns,1);
 assert.equal(s.life.xp,8);assert.equal(s.life.displayed.includes('market:2'),true);assert.equal(claimMarket(s,now),null);
 assert.equal(chooseMarket(s,null),false);assert.equal(s.life.marketRuns,1);
});

test('a market resumes with identical stock, budget and decisions after every reload',()=>{
 let s=fixture();startMarket(s);const layout=marketLayout(s.life.market.seed);
 for(const [i,pick]of perfectFirstMarket.entries()){
  assert.equal(chooseMarket(s,pick),true);const before=marketSnapshot(s);s=normalizeState(s);const after=marketSnapshot(s);
  assert.equal(after.step,i+1);assert.deepEqual(after,before);assert.deepEqual(after.stalls,layout.stalls);
 }
 claimMarket(s,now);s=normalizeState(s);assert.equal(claimMarket(s,now),null);assert.equal(s.life.marketRuns,1);
 const seed=s.life.market.seed;assert.equal(startMarket(s,{replay:true}),true);assert.equal(s.life.market.seed,seed);assert.equal(marketSnapshot(s).buttons,10);
 decisions(s,perfectFirstMarket);assert.equal(claimMarket(s,now).fresh,false);assert.equal(s.life.xp,8,'the same reward cannot be farmed by replaying');
 assert.equal(s.life.marketRuns,2);startMarket(s);assert.notEqual(s.life.market.seed,seed);
});

test('failed purchases are atomic, and exactly one trade-in is available per trip',()=>{
 const s=fixture();startMarket(s);decisions(s,['sugar-star','tea-sock','bedtime-biscuit']);
 const before=structuredClone(s.life.market),m=marketSnapshot(s);assert.equal(m.buttons,2);assert.equal(m.bag.length,3);
 assert.equal(chooseMarket(s,'button-comet','sugar-star'),false,'the refund still cannot afford the comet');
 assert.deepEqual(s.life.market,before,'an unaffordable exchange must not remove the old purchase');
 assert.equal(chooseMarket(s,'comfort-crumbs'),false,'a full bag needs a trade-in');
 assert.equal(chooseMarket(s,'comfort-crumbs','invented'),false);assert.equal(chooseMarket(s,null,'tea-sock'),false,'passing cannot consume the trade-in');
 assert.equal(chooseMarket(s,'comfort-crumbs','sugar-star'),true);const after=marketSnapshot(s);
 assert.equal(after.buttons,1);assert.equal(after.bag.length,3);assert.equal(after.traded,true);assert.equal(after.bag.some(i=>i.id==='sugar-star'),false);
 assert.equal(chooseMarket(s,'haunted-pea','tea-sock'),false,'a second trade-in is rejected');
 decisions(s,[null,null]);assert.equal(marketSnapshot(s).complete,true);
});

test('stalls reject invented objects, future stock and duplicate decisions',()=>{
 const s=fixture();startMarket(s);
 for(const pick of ['invented','brass-sun',undefined,1,{},[]])assert.equal(chooseMarket(s,pick),false);
 assert.equal(marketSnapshot(s).step,0);assert.equal(chooseMarket(s,'tiny-prophecy'),true);assert.equal(chooseMarket(s,'tiny-prophecy'),false);
 assert.equal(marketSnapshot(s).step,1);assert.equal(marketSnapshot(s).buttons,8);
});

test('corrupted imported market histories stop at the last legal move',()=>{
 const s=fixture();startMarket(s);decisions(s,['tiny-prophecy']);
 s.life.market.moves.push({pick:'brass-sun',trade:null},{pick:null,trade:null});s.life.market.claimed=true;
 const loaded=normalizeState(s),m=marketSnapshot(loaded);assert.equal(m.step,1);assert.equal(m.claimed,false);assert.equal(m.buttons,8);assert.equal(loaded.life.market.moves.length,1);
 assert.equal(claimMarket(loaded,now),null);assert.equal(loaded.life.relics.length,0);
 for(const raw of [{seed:0,moves:[]},{seed:Infinity,moves:[]},{seed:1,moves:'nope'},{seed:1,moves:Array(7).fill({pick:null,trade:null})}])assert.equal(normalizeLife({market:raw}).market,null);
 const unsafe=normalizeLife({market:{seed:1,moves:[{pick:'<script>',trade:null}],claimed:true}});assert.deepEqual(unsafe.market.moves,[]);assert.equal(unsafe.market.claimed,false);
});

test('all prize tiers remain collectible and daily rewards are bounded',()=>{
 const s=fixture();startMarket(s);decisions(s,Array(6).fill(null));assert.equal(claimMarket(s,now).relic.id,'market:0');
 startMarket(s,{replay:true});decisions(s,['tiny-prophecy',null,'crumb-crown',null,'brass-sun',null]);assert.equal(claimMarket(s,now).relic.id,'market:1');
 startMarket(s,{replay:true});decisions(s,perfectFirstMarket);assert.equal(claimMarket(s,now).relic.id,'market:2');assert.equal(s.life.xp,16);
 for(let i=0;i<3;i++){startMarket(s,{replay:true});decisions(s,perfectFirstMarket);claimMarket(s,now);}
 assert.equal(s.life.xp,16);startMarket(s,{replay:true});decisions(s,perfectFirstMarket);claimMarket(s,now+86400000);assert.equal(s.life.xp,17);
 assert.equal(s.life.relics.filter(id=>id.startsWith('market:')).length,3);
});

test('market stock is varied, deterministic and always provides a playable route',()=>{
 const layouts=new Set();
 for(let i=1;i<=24;i++){
  const seed=(Math.imul(i,2654435761)>>>0)||1,layout=marketLayout(seed);
  assert.deepEqual(marketLayout(seed),layout);assert.equal(layout.stalls.length,6);assert.ok(layout.stalls.every(s=>s.length===2));
  assert.equal(new Set(layout.stalls.flat().map(x=>x.id)).size,12);assert.equal(new Set(layout.requests.map(x=>x.id)).size,3);
  assert.ok(bestMarketScore(seed)>=17);assert.ok(bestMarketScore(seed)<=26);layouts.add(layout.stalls.flat().map(x=>x.id).join(','));
 }
 assert.equal(layouts.size,24);
});
