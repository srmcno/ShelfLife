import { normalizeLife } from '../life-state.js';
import { OUTINGS, GEAR, RELICS, FRAMES, visitorActFor } from '../content/life.js';
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
  if(first)recordScene(state,'celebration', 'A shared incident', pet.name+' '+({memory:'has taught you a secret handshake. It now looks for your hand before pretending it was looking for something else.',chase:'has appointed itself Minister of Crumbs. The ministry has one employee and considerable overhead.',alibi:'has discovered you can check its story. It has requested a less observant landlord.',court:'has attended court. It has kept the little hammer. This may prove unwise.'}[kind]||'has taken up a hobby.'),[pet.id],now);
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
