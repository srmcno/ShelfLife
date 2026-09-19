import { MARKET_ITEMS, MARKET_RARITIES } from '../content/life.js';
import { MARKET_ERRANDS, ERRAND_PAY, ERRAND_POINTS, ERRAND_VENDOR_LINES } from '../content/market-errands.js';

function randomFor(seed) { let n=seed>>>0; return () => ((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296); }
function shuffled(items, random) {
  const copy=items.slice();
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
export function pairFits(items, request) {
  return items.length===2 && items[0].id!==items[1].id &&
    (items[0].tags.includes(request.tags[0])&&items[1].tags.includes(request.tags[1]) ||
     items[1].tags.includes(request.tags[0])&&items[0].tags.includes(request.tags[1]));
}
export function errandLayout(seed, {version=3,tier=2}={}) {
  const random=randomFor(seed);
  // Plant a legal three-delivery route before adding alternatives. Each pair
  // costs at most six, so ten starting buttons plus four per delivery suffice.
  // Neither side of the counter is always the planted choice.
  const plan=shuffled(MARKET_ITEMS.filter(i=>i.cost<=3),random).slice(0,6);
  const rare=shuffled(MARKET_RARITIES,random).slice(0,2);
  const other=shuffled(MARKET_ITEMS.filter(i=>!plan.includes(i)),random).slice(0,4);
  const alternatives=shuffled([...other,...rare],random);
  const used=new Set();
  const requests=Array.from({length:3},(_,i)=>{
    const candidates=shuffled(MARKET_ERRANDS.filter(r=>pairFits(plan.slice(i*2,i*2+2),r)),random);
    const request=candidates.find(r=>!used.has(r.id))||candidates[0];used.add(request.id);
    return {...request,template:request.id,id:'errand-'+i};
  });
  const stalls=plan.map((item,i)=>shuffled([item,alternatives[i]],random));
  if(version>=4 && !(version===5 && tier<2)){
    // Two genuine alternate stops leave room to pass or replace a mistake.
    // Keep the six affordable planted objects in order, with delivery windows.
    const stocked=new Set(stalls.flat().map(item=>item.id));
    const extras=shuffled([...MARKET_ITEMS,...MARKET_RARITIES].filter(item=>!stocked.has(item.id)),random).slice(0,4);
    stalls.splice(2,0,extras.slice(0,2));stalls.splice(5,0,extras.slice(2));
  }
  return version===5 && tier===0 ? {stalls:stalls.slice(0,2).map(stock=>stock.filter(i=>plan.includes(i))),requests:requests.slice(0,1)} : {stalls,requests};
}
export function deliveryOptions(snapshot, request) {
  if(snapshot.delivered.includes(request.id))return [];
  return snapshot.bag.flatMap((a,i)=>snapshot.bag.slice(i+1).filter(b=>pairFits([a,b],request)).map(b=>[a,b]));
}
// Live advice describes the player's own basket, never the planted solution.
// An object with two labels still occupies just one side of an errand pair.
export function errandProgress(snapshot, request) {
  const delivered=snapshot.delivered.includes(request.id);
  const pairs=deliveryOptions(snapshot,request);
  const partners=delivered?[]:snapshot.bag.flatMap(item=>
    [...new Set(request.tags.flatMap((tag,i)=>item.tags.includes(tag)?[request.tags[1-i]]:[]))]
      .map(tag=>({item,tag})));
  return {delivered,pairs,partners};
}
export function errandPurchasePreview(snapshot, item, trade=null) {
  const after={...snapshot,bag:snapshot.bag.slice(),delivered:snapshot.delivered.slice(),receipts:snapshot.receipts.slice()};
  if(!item||!applyErrandMove(after,{pick:item.id,trade}))return null;
  return {
    buttons:after.buttons,
    ready:after.requests.flatMap(request=>deliveryOptions(after,request)
      .filter(pair=>pair.some(p=>p.id===item.id)).map(pair=>({request,pair}))),
    helps:after.requests.filter(request=>!after.delivered.includes(request.id)&&request.tags.some(tag=>item.tags.includes(tag))),
    // The other offer at this stall is not a future partner: buying advances
    // the route. Show only real later stock, without promising affordability.
    futurePairs:after.requests.filter(request=>!after.delivered.includes(request.id)).flatMap(request=>
      after.stalls.slice(after.step).flatMap((stock,offset)=>stock.filter(partner=>pairFits([item,partner],request))
        .map(partner=>({request,partner,step:after.step+offset}))))
  };
}
export function maxRemainingErrands(snapshot, passed=false) {
  const purchases=Math.max(0,snapshot.stalls.length-snapshot.step-(passed?1:0));
  return Math.min(snapshot.requests.length,snapshot.delivered.length+Math.floor((snapshot.bag.length+purchases)/2));
}
// Premium objects pay for their extra cost only when actually delivered.
// They compete with keeping enough cash to finish another pair.
export function deliveryBonus(item,version=4) { return version>=4?Math.max(0,item.cost-3)*2:0; }
export function errandScore(snapshot) {
  const fulfilled=snapshot.requests.map(r=>snapshot.delivered.includes(r.id));
  const requestPoints=fulfilled.filter(Boolean).length*ERRAND_POINTS;
  const premiumPoints=snapshot.receipts.reduce((sum,receipt)=>sum+receipt.items.reduce((n,item)=>n+deliveryBonus(item,snapshot.version),0),0);
  return {fulfilled,requestPoints,...(snapshot.version>=4?{premiumPoints}:{}),buttons:snapshot.buttons,total:requestPoints+premiumPoints+snapshot.buttons};
}
export function applyErrandMove(s, move) {
  if(s.complete||!move||typeof move!=='object')return false;
  if(move.type==='deliver'){
    const request=s.requests.find(r=>r.id===move.request);
    if(!request||s.delivered.includes(request.id)||!Array.isArray(move.items)||move.items.length!==2)return false;
    const items=move.items.map(id=>s.bag.find(i=>i.id===id));
    if(items.some(i=>!i)||!pairFits(items,request))return false;
    s.bag=s.bag.filter(i=>!move.items.includes(i.id));s.delivered.push(request.id);s.buttons+=ERRAND_PAY;
    const patron=s.patrons?.[Number(request.id.slice(-1))]||'The household';
    const bonus=items.reduce((sum,item)=>sum+deliveryBonus(item,s.version),0);
    s.lastReceipt=patron+' received '+items.map(i=>i.name).join(' and ')+'. +4 buttons; two bag spaces freed.'+(bonus?' +'+bonus+' special-delivery points.':'')+' '+request.delivered;
    s.receipts.push({request:request.id,items:items.map(i=>({...i}))});
    return true;
  }
  if(move.type==='leave'){
    if(s.step!==s.stalls.length)return false;s.complete=true;return true;
  }
  if(move.type!==undefined||move.secret||s.step>=s.stalls.length||!(move.pick===null||typeof move.pick==='string')||!(move.trade===null||typeof move.trade==='string'))return false;
  const item=s.stalls[s.step].find(i=>i.id===move.pick),trade=s.bag.find(i=>i.id===move.trade);
  if(move.pick!==null&&!item||move.trade!==null&&(!trade||!item||s.traded))return false;
  const bag=trade?s.bag.filter(i=>i.id!==trade.id):s.bag.slice(),purse=s.buttons+(trade?1:0);
  if(item&&(bag.length>=3||item.cost>purse))return false;
  s.bag=item?[...bag,item]:bag;s.buttons=purse-(item?.cost||0);s.traded||=!!trade;
  s.lastReceipt=item?'Bought '+item.name+' for '+item.cost+' buttons.'+(trade?' Returned '+trade.name+' for 1 button.':'')+' '+ERRAND_VENDOR_LINES[s.step].bought:ERRAND_VENDOR_LINES[s.step].passed;
  s.step++;return true;
}
export function initialErrands(seed, patrons=[], {version=3,tier=2}={}) {
  return {...errandLayout(seed,{version,tier}),...(version===5?{tier}:{}),version,seed,patrons,step:0,buttons:10,bag:[],delivered:[],receipts:[],traded:false,complete:false,claimed:false,lastReceipt:''};
}
export function errandSnapshot(saved) {
  const snapshot=initialErrands(saved.seed,saved.patrons,{version:saved.version===5?5:saved.version===4?4:3,tier:saved.tier});
  if(snapshot.version>=4)snapshot.patronIds=(saved.patronIds||[]).slice();
  let count=0;for(const move of saved.moves){if(!applyErrandMove(snapshot,move))break;count++;}
  if(count!==saved.moves.length){saved.moves=saved.moves.slice(0,count);saved.claimed=false;}
  snapshot.claimed=snapshot.complete&&saved.claimed===true;if(snapshot.claimed&&Number.isInteger(saved.masteryUnlocked))snapshot.masteryUnlocked=saved.masteryUnlocked;snapshot.score=errandScore(snapshot);
  return snapshot;
}
// Search legal transactions, including deliveries between stalls. Show the
// attainable score only after returning home. Kept separate from live play.
const bestCache=new Map();
export function bestErrandScore(seed, {version=3,tier=2}={}) {
  const cacheKey=seed+':'+version+':'+tier;
  if(bestCache.has(cacheKey))return bestCache.get(cacheKey);
  const seen=new Map();let best=0;
  function visit(s){
    const key=[s.step,s.buttons,s.traded,s.delivered.slice().sort(),s.bag.map(i=>i.id).sort()].join('|'),premium=s.receipts.reduce((n,r)=>n+r.items.reduce((v,item)=>v+deliveryBonus(item,s.version),0),0);
    // With identical stock position, cash, bag and delivered errands, a lower
    // premium total cannot improve any future decision. Prune that dominated prefix.
    if(seen.has(key)&&seen.get(key)>=premium)return;seen.set(key,premium);
    const next=move=>{const copy={...s,bag:s.bag.slice(),delivered:s.delivered.slice(),receipts:s.receipts.slice()};if(applyErrandMove(copy,move))visit(copy);};
    for(const request of s.requests)for(const pair of deliveryOptions(s,request))next({type:'deliver',request:request.id,items:pair.map(i=>i.id)});
    if(s.step===s.stalls.length){best=Math.max(best,errandScore(s).total);return;}
    for(const pick of [null,...s.stalls[s.step].map(i=>i.id)])for(const trade of [null,...(!s.traded&&pick?s.bag.map(i=>i.id):[])])next({pick,trade});
  }
  visit(initialErrands(seed,[],{version,tier}));
  if(bestCache.size>=20)bestCache.delete(bestCache.keys().next().value);bestCache.set(cacheKey,best);return best;
}
