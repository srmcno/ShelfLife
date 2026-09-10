import { normalizeLife } from '../life-state.js';
import { OUTINGS, GEAR, RELICS, FRAMES, MARKET_ITEMS, MARKET_REQUESTS, visitorActFor } from '../content/life.js';
import { VISITORS } from '../content/stories.js';
import { addNote, clamp } from '../state.js';
const checked = new WeakSet();
export function lifeState(state) {
  if (!state.life || !checked.has(state.life)) { state.life=normalizeLife(state.life,state.pets.length>0); checked.add(state.life); }
  return state.life;
}
export const dayKey = now => { const d=new Date(now); return [d.getFullYear(),d.getMonth()+1,d.getDate()].join('-'); };
export function awardDiscovery(state, key, amount, now=Date.now()) {
  const l=lifeState(state); if (l.awards.includes(key)) return false;
  l.awards.push(key); if(l.awards.length>180)l.awards.splice(0,l.awards.length-180);
  l.xp+=amount; return true;
}
export function dailyActivity(state, kind, now=Date.now()) {
  const l=lifeState(state), day=dayKey(now);
  if(l.day!==day){l.day=day;l.daily=[];}
  if(l.daily.includes(kind))return false;
  l.daily.push(kind); l.xp+=1;
  return true;
}
export function recordScene(state, kind, title, text, cast=[], now=Date.now()) {
  const l=lifeState(state);
  const scene={id:++l.serial,kind,title,text,cast:cast.slice(0,2),at:now};
  l.scenes.unshift(scene); l.scenes.length=Math.min(18,l.scenes.length);
  return scene;
}
export function recordGameLife(state, pet, kind, now=Date.now(), victory=true) {
  const l=lifeState(state);
  dailyActivity(state,'play',now);
  const first=awardDiscovery(state,'game:'+kind,3,now);
  if(first)recordScene(state,'celebration', ({memory:'The secret accomplice',chase:'The Ministry of Crumbs',alibi:'An inconveniently observant landlord',court:'The household takes the stand'})[kind] || 'A shared incident', pet.name+' '+({memory:'has taught you a secret handshake. It now looks for your hand before pretending it was looking for something else.',chase:'has appointed itself Minister of Crumbs. The ministry has one employee and considerable overhead.',alibi:'has discovered you can check its story. It has requested a less observant landlord.',court:'has attended court. It has kept the little hammer. This may prove unwise.'}[kind]||'has taken up a hobby.'),[pet.id],now);
  l.introDone=true;
  return first;
}
export function favoriteFor(pet) {
  const traits=pet.traits||[];
  if(traits.some(t=>['haunted','cult','undertaker','cryptid'].includes(t)))return {name:'Midnight crumbs',kind:'mystique',line:'Prefers food with an unresolved past.'};
  if(traits.some(t=>['sugar','clingy','porcelain'].includes(t)))return {name:'Jam freckles',kind:'cute',line:'Believes jam counts as an emotional support system.'};
  if(traits.some(t=>['damp','fungal'].includes(t)))return {name:'Damp biscuits',kind:'damp',line:'Asks whether you could make it a little less structurally sound.'};
  return {name:'Contraband crackers',kind:'menace',line:'The flavour improves if somebody says it is forbidden.'};
}
export function outingPreview(state, routeId, gearId, cast) {
  const route=OUTINGS.find(x=>x.id===routeId);
  const crew=state.pets.filter(p=>cast.includes(p.id));
  if(!route||!GEAR.some(x=>x.id===gearId)||!crew.length)return null;
  return route.steps.map(step=>({gear:step.good===gearId,skill:crew.some(p=>(p.stats?.[step.stat]||0)>=7),stat:step.stat}));
}
export function startOuting(state, routeId, gearId, cast) {
  const l=lifeState(state);
  if(l.outing)return false;
  const ids=[...new Set(cast)].filter(id=>state.pets.some(p=>p.id===id)).slice(0,2);
  if(!outingPreview(state,routeId,gearId,ids))return false;
  l.outing={route:routeId,gear:gearId,cast:ids,step:0,score:0,log:[],choices:[]};
  return true;
}
export function chooseOuting(state, choice, now=Date.now()) {
  const l=lifeState(state), o=l.outing, route=OUTINGS.find(x=>x.id===o?.route);
  if(!o||!route||o.step>=3||![0,1].includes(choice))return null;
  const step=route.steps[o.step], crew=state.pets.filter(p=>o.cast.includes(p.id));
  if(!crew.length){l.outing=null;return null;}
  // Gear supports the practical route; a named crew skill supports negotiation.
  const supported=choice===0 ? o.gear===step.good : crew.some(p=>(p.stats?.[step.stat]||0)>=7);
  o.score+=supported?1:0; o.choices.push(choice);
  const line=step.outcomes[choice]+(supported?' Their preparation paid off.':' They improvised. It was not dignified, but it worked.');
  o.log.push(line);o.step++;
  if(o.step<3)return {text:line,complete:false,supported};
  const tier=o.score>=3?2:o.score>=1?1:0, relic=RELICS.find(r=>r.id===o.route+':'+tier);
  const fresh=!l.relics.includes(relic.id);
  if(fresh){l.relics.push(relic.id);l.xp+=4;if(l.displayed.length<3)l.displayed.push(relic.id);}
  l.outings++;dailyActivity(state,'outing',now);l.introDone=true;
  crew.forEach(p=>{p.needs.fuss=clamp(p.needs.fuss+8,0,100);p.expeditions=(p.expeditions||0)+1;});
  if(crew.length===2){state.stories||={};state.stories.relationships||={};const key=crew.map(p=>p.id).sort().join('|');const r=state.stories.relationships[key]||={time:0,plots:0};r.plots=(r.plots||0)+1;}
  const text=crew.map(p=>p.name).join(' and ')+' returned with '+relic.name.toLowerCase()+'. '+relic.line+' '+line;
  recordScene(state,'outing',route.name,text,crew.map(p=>p.id),now);addNote(state,text,'beyond the shelf','scheme');
  o.result={relic:relic.id,fresh};
  return {complete:true,text,fresh,relic,supported};
}
export function finishOuting(state) {
  const l=lifeState(state);if(!l.outing||l.outing.step!==3)return false;l.outing=null;return true;
}
export function visitorActivity(state) {
  const v=state.stories?.visitor;if(!v?.welcomed)return null;
  const l=lifeState(state), chapter=l.visitorEpisodes[v.kind]||0, act=visitorActFor(v.kind,Math.min(2,v.activityDone?Math.max(0,chapter-1):chapter));
  if(!act)return null;
  return { ...act,chapter,done:!!v.activityDone,complete:chapter>=3,response:v.activityResponse||'' };
}
export function solveVisitorActivity(state, answer, now=Date.now()) {
  const act=visitorActivity(state),v=state.stories?.visitor;
  if(!act||act.done||act.complete||![0,1].includes(answer)||now>=v.at+6*3600000)return false;
  const l=lifeState(state),guest=VISITORS.find(x=>x.id===v.kind);
  v.activityDone=true;l.visitorEpisodes[v.kind]=act.chapter+1;
  v.activityResponse=answer===act.right?act.win:act.miss;
  l.xp+=2;dailyActivity(state,'visitor',now);
  recordScene(state, 'visitor',guest.name+': '+act.title,v.activityResponse,[v.hostId].filter(Boolean),now);
  addNote(state,v.activityResponse,guest.name,'arrival');
  return true;
}
export function displayCurio(state,id) {
  const l=lifeState(state);
  if(!l.relics.includes(id)&&!state.stories?.collection?.some(x=>x.id===id))return false;
  if(l.displayed.includes(id))l.displayed=l.displayed.filter(x=>x!==id);
  else {if(l.displayed.length>=3)l.displayed.shift();l.displayed.push(id);}
  return true;
}
export function selectFrame(state,id) {
  const l=lifeState(state),frame=FRAMES.find(x=>x.id===id);
  if(!frame||l.xp<frame.at)return false;l.frame=id;return true;
}
export function welcomeBack(state, now=Date.now()) {
  const l=lifeState(state),away=now-l.lastSeen;
  if(l.lastSeen && away>20*60000 && state.pets.length && !l.scenes.some(s=>s.at>l.lastSeen)) {
    const needy=state.pets.filter(p=>Math.min(...Object.values(p.needs))<40);
    recordScene(state,'return','The household report',needy.length?needy.map(p=>p.name).join(' and ')+' could use some care. The complaints have been arranged by urgency, then by how dramatically they can be sighed.':'Everyone is reasonably comfortable. They have maintained this position in your absence and would like it entered into the record.',state.pets.slice(0,2).map(p=>p.id),now);
  }
  l.recap=l.lastSeen&&away>20*60000?l.scenes.filter(s=>s.at>=l.lastSeen).slice(0,3).map(s=>s.id):[];
  l.lastSeen=now;
  return l.recap;
}

/* ================= The Unlicensed Night Market =================
   Six stalls, one purchase per stall, ten buttons, three bag slots. All future
   stock is visible. One trade-in returns one button and frees a slot before a
   purchase. A finished basket scores charm + four per request + spare buttons.
   A request always needs TWO DISTINCT items; items may serve other requests.
   There is no real currency, clock, pet-stat advantage, or repeatable XP payout. */
export const MARKET_BUDGET=10, MARKET_BAG_SIZE=3, MARKET_ROUNDS=6;
function marketRandom(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function marketShuffle(values,random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function marketLayout(seed){
 const random=marketRandom(seed),items=marketShuffle(MARKET_ITEMS,random).slice(0,MARKET_ROUNDS*2);
 return {stalls:Array.from({length:MARKET_ROUNDS},(_,i)=>items.slice(i*2,i*2+2)),requests:marketShuffle(MARKET_REQUESTS,random).slice(0,3)};
}
export function scoreMarket(bag,buttons,requests){
 const fulfilled=requests.map(request=>bag.some((item,i)=>item.tags.includes(request.tags[0])&&bag.some((other,j)=>i!==j&&other.tags.includes(request.tags[1]))));
 const charm=bag.reduce((n,item)=>n+item.charm,0),requestPoints=fulfilled.filter(Boolean).length*4;
 return {charm,requestPoints,buttons,fulfilled,total:charm+requestPoints+buttons};
}
function applyMarketMove(snapshot,move){
 if(snapshot.step>=MARKET_ROUNDS||!move||!(move.pick===null||typeof move.pick==='string')||!(move.trade===null||typeof move.trade==='string'))return false;
 const item=snapshot.stalls[snapshot.step].find(x=>x.id===move.pick);
 if(move.pick!==null&&!item)return false;
 // Trading and buying happen as one move; rejected purchases keep the old item.
 const trade=move.trade===null?null:snapshot.bag.find(x=>x.id===move.trade);
 if(move.trade!==null&&(!trade||snapshot.traded||!item))return false;
 const bag=trade?snapshot.bag.filter(x=>x.id!==trade.id):snapshot.bag.slice(),buttons=snapshot.buttons+(trade?1:0);
 if(item&&(bag.length>=MARKET_BAG_SIZE||item.cost>buttons))return false;
 snapshot.bag=item?[...bag,item]:bag;snapshot.buttons=buttons-(item?.cost||0);snapshot.traded||=!!trade;snapshot.step++;
 return true;
}
export function marketSnapshot(state){
 const market=lifeState(state).market;if(!market)return null;
 const layout=marketLayout(market.seed),snapshot={...layout,seed:market.seed,step:0,buttons:MARKET_BUDGET,bag:[],traded:false,complete:false,claimed:false};
 for(const move of market.moves){if(!applyMarketMove(snapshot,move))break;}
 // Damaged legacy/imported histories stop at the last legal decision.
 if(snapshot.step!==market.moves.length){market.moves=market.moves.slice(0,snapshot.step);market.claimed=false;}
 snapshot.complete=snapshot.step===MARKET_ROUNDS;snapshot.claimed=market.claimed;
 snapshot.score=scoreMarket(snapshot.bag,snapshot.buttons,snapshot.requests);
 return snapshot;
}
export function startMarket(state,{replay=false}={}){
 const l=lifeState(state);if(!state.pets.length||l.market&&!l.market.claimed)return false;
 const previous=l.market?.seed;
 if(!replay||!previous)l.marketSerial++;
 // Stable market numbers let players retry an identical planning puzzle.
 const seed=replay&&previous?previous:(Math.imul(l.marketSerial,2654435761)>>>0)||1;
 l.market={seed,moves:[],claimed:false};return true;
}
export function chooseMarket(state,pick,trade=null){
 const l=lifeState(state),snapshot=marketSnapshot(state),move={pick,trade};
 if(!snapshot||snapshot.complete||snapshot.claimed||!applyMarketMove(snapshot,move))return false;
 l.market.moves.push(move);return true;
}
export function claimMarket(state,now=Date.now()){
 const l=lifeState(state),snapshot=marketSnapshot(state);
 if(!snapshot?.complete||snapshot.claimed)return null;
 const score=snapshot.score,tier=score.total===bestMarketScore(snapshot.seed)?2:score.total>=17?1:0,relic=RELICS.find(r=>r.id==='market:'+tier);
 l.market.claimed=true;l.marketRuns++;l.marketBest=Math.max(l.marketBest,score.total);
 const fresh=!l.relics.includes(relic.id);
 if(fresh){l.relics.push(relic.id);l.xp+=4;if(l.displayed.length<3)l.displayed.push(relic.id);}
 const first=awardDiscovery(state,'game:market',3,now);dailyActivity(state,'market',now);l.introDone=true;
 const cast=state.pets.slice(0,2).map(p=>p.id),names=state.pets.slice(0,2).map(p=>p.name).join(' and ')||'The household';
 const text=names+' returned from the night market with '+snapshot.bag.length+' questionable purchase'+(snapshot.bag.length===1?'':'s')+' and '+score.fulfilled.filter(Boolean).length+' of 3 requests filled. '+(tier===2?'The vendors applauded. One of them checked for missing buttons.':tier===1?'The household calls this careful budgeting. The receipt calls it three objects in a bag.':'The bag has been presented as an artistic statement. This is why nobody lets the bag speak.')+' '+relic.line;
 recordScene(state,'market','The Unlicensed Night Market',text,cast,now);addNote(state,text,'the night market','scheme');
 return {score,relic,fresh,first};
}

// A tiny exhaustive planner runs only on the result screen. It gives a truthful
// attainable target for replay, considering skip, buy and the single trade-in.
// No solution or advice is revealed before the player's first attempt ends.
const marketBestCache=new Map();
export function bestMarketScore(seed){
 if(marketBestCache.has(seed))return marketBestCache.get(seed);
 const layout=marketLayout(seed),seen=new Map();let best=0;
 function visit(s){
  if(s.step===MARKET_ROUNDS){best=Math.max(best,scoreMarket(s.bag,s.buttons,s.requests).total);return;}
  const key=[s.step,s.buttons,s.traded?1:0,s.bag.map(i=>i.id).sort().join(',')].join('|');if(seen.has(key))return;seen.set(key,true);
  for(const pick of [null,...s.stalls[s.step].map(x=>x.id)])for(const trade of [null,...(!s.traded&&pick?s.bag.map(x=>x.id):[])]){
   const next={...s,bag:s.bag.slice()};if(applyMarketMove(next,{pick,trade}))visit(next);
  }
 }
 visit({...layout,step:0,buttons:MARKET_BUDGET,bag:[],traded:false});
 if(marketBestCache.size>=20)marketBestCache.delete(marketBestCache.keys().next().value);marketBestCache.set(seed,best);return best;
}
