import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { startMarket, marketSnapshot, chooseMarket, deliverMarket, leaveMarket, claimMarket } from '../src/engine/life.js';
import { errandLayout, initialErrands, applyErrandMove, deliveryOptions, bestErrandScore } from '../src/engine/market-errands.js';
import { marketMarkup } from '../src/ui/market.js';

const now=new Date(2026,8,10,12).getTime();
function fixture(){const s=blankState();s.pets=[{id:'p',name:'Pip',traits:[],art:{},needs:{food:60,fuss:60,clean:60},bond:0}];s.slots[0]='p';return s;}
// Independent planner: a hand-in consumes the two selected items; money is a
// running ledger. Returns a witness route, not the engine's cached score.
function oracle(seed){
  const {stalls,requests}=errandLayout(seed);let best=-1,plan=[];const seen=new Set();
  function visit(step,coins,bag,done,traded,moves){
    const key=[step,coins,bag.map(i=>i.id).sort(),done.slice().sort(),traded].join('|');if(seen.has(key))return;seen.add(key);
    for(const r of requests.filter(r=>!done.includes(r.id)))for(let a=0;a<bag.length;a++)for(let b=a+1;b<bag.length;b++){
      const fits=(bag[a].tags.includes(r.tags[0])&&bag[b].tags.includes(r.tags[1]))||(bag[b].tags.includes(r.tags[0])&&bag[a].tags.includes(r.tags[1]));
      if(fits)visit(step,coins+4,bag.filter((_,i)=>i!==a&&i!==b),[...done,r.id],traded,[...moves,{type:'deliver',request:r.id,items:[bag[a].id,bag[b].id]}]);
    }
    if(step===6){const score=done.length*10+coins;if(score>best){best=score;plan=[...moves,{type:'leave'}];}return;}
    visit(step+1,coins,bag,done,traded,[...moves,{pick:null,trade:null}]);
    for(const item of stalls[step])for(const returned of [null,...(!traded?bag:[])]){
      const nextBag=returned?bag.filter(i=>i!==returned):bag,budget=coins+(returned?1:0);
      if(nextBag.length<3&&item.cost<=budget)visit(step+1,budget-item.cost,[...nextBag,item],done,traded||!!returned,[...moves,{pick:item.id,trade:returned?.id||null}]);
    }
  }
  visit(0,10,[],[],false,[]);return {best,plan};
}
function play(state,move){return move.type==='deliver'?deliverMarket(state,move.request,move.items):move.type==='leave'?leaveMarket(state):chooseMarket(state,move.pick,move.trade);}

test('every sampled route permits all three deliveries and the advertised optimum agrees with an independent planner',()=>{
  for(let seed=1;seed<=50;seed++){
    const layout=errandLayout(seed),solved=oracle(seed);
    assert.deepEqual(layout,errandLayout(seed));assert.equal(new Set(layout.stalls.flat().map(i=>i.id)).size,12);
    assert.equal(layout.requests.length,3);assert.ok(solved.best>=34,'three deliveries always feasible');
    assert.equal(bestErrandScore(seed),solved.best);
    assert.equal(solved.plan.filter(m=>m.type==='deliver').length,3);
  }
});

test('deliveries consume exactly two objects, pay once, preserve the stall and survive every restore',()=>{
  let s=fixture();startMarket(s,{errands:true});const seed=s.life.market.seed,plan=oracle(seed).plan;
  const originalNeeds={...s.pets[0].needs};let spent=0,refunds=0,paid=0;
  for(const move of plan){
    const before=marketSnapshot(s);
    assert.equal(play(s,move),true);
    const after=marketSnapshot(s);
    if(move.type==='deliver'){
      paid+=4;assert.equal(after.step,before.step);assert.equal(after.bag.length,before.bag.length-2);
      assert.ok(move.items.every(id=>!after.bag.some(i=>i.id===id)));
      assert.equal(play(s,move),false,'a receipt cannot pay twice');
      assert.ok(move.items.every(id=>after.lastReceipt.includes(before.bag.find(i=>i.id===id).name)));
    }else if(move.pick){spent+=before.stalls[before.step].find(i=>i.id===move.pick).cost;refunds+=move.trade?1:0;}
    assert.equal(after.buttons,10-spent+refunds+paid);
    s=normalizeState(JSON.parse(JSON.stringify(s)));assert.deepEqual(marketSnapshot(s),after);
  }
  const complete=marketSnapshot(s);assert.equal(complete.delivered.length,3);assert.equal(complete.bag.length,0);
  const result=claimMarket(s,now);assert.equal(result.relic.id,'market:2');assert.equal(s.life.marketErrandBest,complete.score.total);
  const xp=s.life.xp;assert.equal(claimMarket(s,now),null);assert.equal(s.life.xp,xp);assert.deepEqual(s.pets[0].needs,originalNeeds);
  assert.equal(startMarket(s,{replay:true,errands:true}),true);assert.equal(s.life.market.seed,seed);assert.equal(s.life.market.version,3);
});

test('one multi-tag object cannot count as two or satisfy two errands after delivery',()=>{
  const s=initialErrands(9);s.bag=s.stalls.flat().slice(0,3);
  const copy=structuredClone(s);assert.equal(applyErrandMove(s,{type:'deliver',request:s.requests[0].id,items:[s.bag[0].id,s.bag[0].id]}),false);assert.deepEqual(s,copy);
  const r=s.requests.find(r=>deliveryOptions(s,r).length);
  if(r){const pair=deliveryOptions(s,r)[0].map(i=>i.id);assert.equal(applyErrandMove(s,{type:'deliver',request:r.id,items:pair}),true);assert.equal(applyErrandMove(s,{type:'deliver',request:s.requests.find(x=>x!==r).id,items:pair}),false);}
});

test('leaving is explicit, final-stall deliveries remain available, and impossible imported actions stop safely',()=>{
  const s=fixture();startMarket(s,{errands:true});assert.equal(leaveMarket(s),false);assert.equal(claimMarket(s),null);
  const first=marketSnapshot(s).stalls[0][0],saved=structuredClone(s.life.market);
  assert.equal(deliverMarket(s,'errand-0',[first.id,'invented']),false);assert.deepEqual(s.life.market,saved);
  for(let i=0;i<6;i++)assert.equal(chooseMarket(s,null),true);
  assert.equal(marketSnapshot(s).complete,false);assert.equal(claimMarket(s),null);
  const view=marketMarkup(s,marketSnapshot(s));assert.match(view,/market-leave/);assert.match(view,/You can still deliver/);
  s.life.market.moves.push({type:'deliver',request:'errand-0',items:['made-up','also-made-up']},{type:'leave'});s.life.market.claimed=true;
  const restored=normalizeState(s),snap=marketSnapshot(restored);assert.equal(restored.life.market.moves.length,6);assert.equal(snap.claimed,false);assert.equal(snap.complete,false);
  assert.equal(leaveMarket(restored),true);assert.equal(marketSnapshot(restored).score.total,10);assert.equal(claimMarket(restored,now).relic.id,'market:0');
});

test('new market explains deliveries, removes secret/charm scoring, and escapes patron names',()=>{
  const s=fixture();s.pets[0].name='<img src=x>';const intro=marketMarkup(s,null);assert.match(intro,/Send a pair home/);assert.ok(!intro.includes('Sell a secret'));
  startMarket(s,{errands:true});const m=marketSnapshot(s),view=marketMarkup(s,m,'',null,'','requests');
  assert.ok(view.includes('&lt;img src=x&gt;'));assert.ok(!view.includes('<img src=x>'));assert.ok(!view.includes('charm'));assert.ok(!view.includes('market-secret'));
  assert.match(view,/two named objects/);assert.match(view,/four buttons/);
});
