import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {startMarket,chooseMarket,deliverMarket,leaveMarket,marketSnapshot,claimMarket} from '../src/engine/life.js';
import {errandLayout,bestErrandScore,initialErrands,applyErrandMove,errandScore,deliveryBonus} from '../src/engine/market-errands.js';
import {marketMarkup} from '../src/ui/market.js';
import {MARKET_ITEMS,MARKET_RARITIES} from '../src/content/life.js';
const now=new Date(2026,8,13,12).getTime();
function fixture(){const s=blankState();s.pets=[{id:'pip',name:'Pip',art:{},traits:[],needs:{food:60,fuss:60,clean:60}}];s.slots[0]='pip';return s;}
// Independent resource ledger, pair assignment and premium calculation.
function solve(seed){
 const {stalls,requests}=errandLayout(seed,{version:4}),seen=new Set();let best=-1,plan=[],threeWithPass=false,threeWithTrade=false;
 function visit(step,cash,bag,done,traded,premium,moves){
  const key=[step,cash,bag.map(i=>i.id).sort(),done.slice().sort(),traded,premium].join('|');if(seen.has(key))return;seen.add(key);
  for(const r of requests.filter(r=>!done.includes(r.id)))for(let a=0;a<bag.length;a++)for(let b=a+1;b<bag.length;b++){
   if(!(bag[a].tags.includes(r.tags[0])&&bag[b].tags.includes(r.tags[1])||bag[b].tags.includes(r.tags[0])&&bag[a].tags.includes(r.tags[1])))continue;
   visit(step,cash+4,bag.filter((_,i)=>i!==a&&i!==b),[...done,r.id],traded,premium+[bag[a],bag[b]].reduce((n,i)=>n+Math.max(0,i.cost-3)*2,0),[...moves,{type:'deliver',request:r.id,items:[bag[a].id,bag[b].id]}]);
  }
  if(step===stalls.length){
   if(done.length===3){threeWithPass||=moves.some(m=>m.pick===null);threeWithTrade||=traded;}
   const score=done.length*10+cash+premium;if(score>best){best=score;plan=[...moves,{type:'leave'}];}return;
  }
  visit(step+1,cash,bag,done,traded,premium,[...moves,{pick:null,trade:null}]);
  for(const item of stalls[step])for(const returned of [null,...(!traded?bag:[])]){
   const next=returned?bag.filter(i=>i!==returned):bag,budget=cash+(returned?1:0);
   if(next.length<3&&item.cost<=budget)visit(step+1,budget-item.cost,[...next,item],done,traded||!!returned,premium,[...moves,{pick:item.id,trade:returned?.id||null}]);
  }
 }
 visit(0,10,[],[],false,0,[]);return {best,plan,threeWithPass,threeWithTrade};
}
test('eight-stop markets have solvable three-delivery routes with passes, and independently checked optimal scores',()=>{
 let recoverable=0;
 for(let seed=1;seed<=24;seed++){
  const stock=errandLayout(seed,{version:4});assert.equal(stock.stalls.length,8);assert.equal(new Set(stock.stalls.flat().map(i=>i.id)).size,16);
  const oracle=solve(seed);assert.ok(oracle.threeWithPass,'a pass does not automatically sacrifice an errand');recoverable+=oracle.threeWithTrade?1:0;
  assert.equal(bestErrandScore(seed,{version:4}),oracle.best);assert.ok(oracle.best>=34);
 }
 assert.ok(recoverable>=18,'most sampled routes permit a recovered trade-in mistake and all three errands');
});
test('a costlier object with the same labels has a real delivery benefit, never points just for buying',()=>{
 const all=[...MARKET_ITEMS,...MARKET_RARITIES];
 for(const a of all)for(const b of all)if(a.cost>b.cost&&a.tags.slice().sort().join()==b.tags.slice().sort().join())assert.ok(deliveryBonus(a)>deliveryBonus(b));
 const s=initialErrands(3,[],{version:4}),expensive=all.find(i=>i.cost===6);s.bag=[expensive];assert.equal(errandScore(s).premiumPoints,0);
 assert.equal(deliveryBonus(expensive,3),0,'old rules stay unchanged');
});
test('v4 transactions, patrons, final rewards, score and claim guard survive restore after every decision',()=>{
 let s=fixture();assert.ok(startMarket(s,{errands:true}));assert.equal(s.life.market.version,4);
 const seed=s.life.market.seed,oracle=solve(seed);let paid=0,spent=0,refunds=0;
 for(const move of oracle.plan){
  const before=marketSnapshot(s);const okay=move.type==='deliver'?deliverMarket(s,move.request,move.items):move.type==='leave'?leaveMarket(s):chooseMarket(s,move.pick,move.trade);assert.ok(okay);
  if(move.type==='deliver')paid+=4;else if(move.pick){spent+=before.stalls[before.step].find(i=>i.id===move.pick).cost;refunds+=move.trade?1:0;}
  const after=marketSnapshot(s);assert.equal(after.buttons,10+paid-spent+refunds);s=normalizeState(JSON.parse(JSON.stringify(s)));assert.deepEqual(marketSnapshot(s),after);
 }
 assert.equal(marketSnapshot(s).score.total,oracle.best);assert.deepEqual(marketSnapshot(s).patronIds,['pip']);
 claimMarket(s,now);assert.equal(s.life.marketErrandBestV4,oracle.best);assert.equal(s.life.marketErrandBest,0);const xp=s.life.xp;assert.equal(claimMarket(s,now),null);assert.equal(s.life.xp,xp);
 s=normalizeState(s);assert.equal(marketSnapshot(s).claimed,true);assert.ok(startMarket(s,{replay:true,errands:true}));assert.equal(s.life.market.seed,seed);assert.equal(s.life.market.version,4);
});
test('old unfinished errands resume and replay exact stock and prices, with no premium score',()=>{
 let s=fixture();startMarket(s,{errands:true});s.life.market.version=3;delete s.life.market.patronIds;
 const old=marketSnapshot(s);for(let i=0;i<6;i++)assert.ok(chooseMarket(s,null));assert.ok(leaveMarket(s));claimMarket(s,now);
 s=normalizeState(s);assert.ok(startMarket(s,{replay:true,errands:true}));const replay=marketSnapshot(s);assert.equal(replay.version,3);assert.deepEqual(replay.stalls,old.stalls);assert.equal(replay.score.premiumPoints,undefined);
});
test('hints stay optional, all eight stalls render, invalid action tails cannot claim, and reactions identify actual recipients',()=>{
 const s=fixture();startMarket(s,{errands:true});let m=marketSnapshot(s);
 assert.match(marketMarkup(s,m),/<details class="market-hint"><summary>Need a pairing hint/);assert.doesNotMatch(marketMarkup(s,m),/<details class="market-hint" open/);
 for(let i=0;i<8;i++){assert.match(marketMarkup(s,marketSnapshot(s)),new RegExp('Stall '+(i+1)+' / 8'));chooseMarket(s,null);}
 assert.match(marketMarkup(s,marketSnapshot(s)),/market-leave/);
 s.life.market.moves.push({type:'deliver',request:'errand-0',items:['fake','false']},{type:'leave'});s.life.market.claimed=true;
 const loaded=normalizeState(s);assert.equal(marketSnapshot(loaded).complete,false);assert.equal(marketSnapshot(loaded).claimed,false);assert.equal(claimMarket(loaded,now),null);
 const direct=initialErrands(1,['Pip'],{version:4});direct.patronIds=['pip'];
 // Use a real witness delivery, not a fabricated matching pair.
 for(const move of solve(1).plan){assert.ok(applyErrandMove(direct,move));if(direct.delivered.includes('errand-0'))break;}
 assert.match(marketMarkup(s,direct,'',null,'','requests'),/data-patron="pip"/);
 assert.match(marketMarkup(s,direct,'',null,'','requests'),/market-delivery-objects/);
});
