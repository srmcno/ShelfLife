import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { rememberEcho } from '../household-echoes.js';
import { normalizeLife } from '../life-state.js';
import { OUTINGS, OUTING_TRAIL_SCENES, OUTING_ALTERNATES, GEAR, RELICS, FRAMES, visitorActFor } from '../content/life.js';
import { VISITORS } from '../content/stories.js';
import { missionStops } from '../content/project-encounters.js';
import { PROJECTS, PROJECT_STOPS } from '../content/projects.js';
import { addNote, clamp } from '../state.js';
import { recordEscapadeEvent } from '../escapade-state.js';
import { fileScene } from '../paperwork-state.js';
import { RESIDENT_TENURE } from '../content/resident-life.js';
import { rewardGame } from './mayhem.js';
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
export function recordScene(state, kind, title, text, cast=[], now=Date.now(), stage=null) {
  const l=lifeState(state);
  const scene={id:++l.serial,kind,title,text,cast:cast.slice(0,2),at:now};
  if(stage && typeof stage==='object')scene.stage={...stage};
  l.scenes.unshift(scene); l.scenes.length=Math.min(18,l.scenes.length);
  fileScene(state, scene);
  const echoKind = ({court:'court',market:'market',outing:'expedition'})[kind] || (stage?.key==='game:chase'?'chase':null);
  if(echoKind&&cast[0])rememberEcho(state,echoKind,cast[0],'scene:'+scene.id,now,echoKind==='court'?stage?.branch:null);
  return scene;
}
export function residentTenureDays(pet, now=Date.now()) {
  return Number.isFinite(pet?.born) ? Math.max(0, Math.floor((now - pet.born) / 86400000)) : 0;
}
// One resident earns one current life marker per shelf check. If time passed
// while the game was closed, record only their highest reached marker and mark
// earlier ones complete so a return never floods the corkboard.
export function recordResidentTenure(state, now=Date.now()) {
  for (const pet of state.pets || []) {
    const completed = new Set(Array.isArray(pet.lifeMilestones) ? pet.lifeMilestones : []);
    const due = RESIDENT_TENURE.filter(milestone => milestone.days <= residentTenureDays(pet, now) && !completed.has(milestone.days));
    if (!due.length) continue;
    const milestone = due.at(-1);
    pet.lifeMilestones = [...new Set([...completed, ...due.map(item => item.days)])].sort((a, b) => a - b);
    pet.lifeKeepsakes = [...new Set([...(Array.isArray(pet.lifeKeepsakes) ? pet.lifeKeepsakes : []), milestone.days])].sort((a, b) => a - b);
    const text = pet.name + ' ' + milestone.report;
    recordScene(state, 'residency', milestone.title, text, [pet.id], now, { key: 'resident-tenure', branch: String(milestone.days) });
    addNote(state, text, pet.name, 'note');
    return { petId: pet.id, days: milestone.days, title: milestone.title };
  }
  return null;
}
export function recordGameLife(state, pet, kind, now=Date.now(), victory=true) {
  const l=lifeState(state);
  dailyActivity(state,'play',now);
  if(victory!==false)rewardGame(state,now);
  const first=awardDiscovery(state,'game:'+kind,3,now);
  if(first)recordScene(state,'celebration', ({arcade:'After hours at the arcade',memory:'The secret accomplice',chase:'The Ministry of Crumbs',alibi:'An inconveniently observant landlord',court:'The household takes the stand'})[kind] || 'A shared incident', pet.name+' '+({arcade:'has discovered high scores. It now rates everything out of ten, including your face, which got a four.',memory:'has taught you a secret handshake. It now looks for your hand before pretending it was looking for something else.',chase:'has appointed itself Minister of Crumbs. The ministry has one employee and considerable overhead.',alibi:'has discovered you can check its story. It has requested a less observant landlord.',court:'has attended court. It has kept the little hammer. This may prove unwise.'}[kind]||'has taken up a hobby.'),[pet.id],now,{key:'game:'+kind});
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
// A trail has no hidden dice rolls. Decisions trade nerve, points and the one
// packed tool; a small look-ahead map lets the player plan instead of guess.
export function outingTrail(routeId, edition=0, mission=false, missionRevision=1) {
  const route=OUTINGS.find(x=>x.id===routeId);
  if(!route)return null;
  const n=Number.isInteger(edition)&&edition>=0&&edition<8?edition:0;
  return route.steps.map((step,i)=>({...((mission?missionStops(routeId,n,missionRevision)[i]:((n>>i)&1?OUTING_ALTERNATES[routeId][i]:OUTING_TRAIL_SCENES[routeId][i]))),points:2+(i+n%3)%3}));
}
export const OUTING_DARES = [
  {id:'bold',name:'Do it the hard way',line:'Take at least two detours.',payoff:'Two detours, no fatalities. The undertaker has blocked your number.'},
  {id:'thrifty',name:'Keep the equipment clean',line:'Finish without using your packed equipment.',payoff:'The equipment is spotless. The crew have asked you to stop telling that part first.'},
  {id:'steady',name:'Leave something in the tank',line:'Return with at least 2 nerve.',payoff:'You still have enough nerve to open the bag. Everyone else has left the room.'}
];
function trailDareMet(dare,choices,nerve,toolUsed){return dare==='bold'?choices.filter(c=>c===1).length>=2:dare==='thrifty'?!toolUsed:dare==='steady'?nerve>=2:false;}
function trailMove(step,gear,expertise,nerve,toolUsed,choice) {
  const cost=expertise.includes(step.stat)?1:2;
  if(choice===0)return {nerve:Math.min(3,nerve+2),toolUsed,points:0,text:step.quiet+' +2 nerve, up to 3.'};
  if(choice===1&&nerve>=cost)return {nerve:nerve-cost,toolUsed,points:step.points,text:step.outcomes[1]+' +'+step.points+' trail points. '+cost+' nerve spent.'};
  if(choice===2&&!toolUsed){const matched=step.good===gear;return {nerve,toolUsed:true,points:matched?3:1,text:(matched?step.outcomes[0]:'They improvised with their packed equipment. The incident report names a witness who had conveniently died before the incident.')+' +'+(matched?3:1)+' trail points. Equipment used for this trip.'};}
  return null;
}
export function outingSnapshot(state) {
  const l=lifeState(state),o=l.outing;
  // A resident can be rehomed while its saved trip is closed. Retire an empty
  // crew before rendering choices, while retaining already completed reports.
  if(o&&o.step<3&&!state.pets.some(p=>o.cast.includes(p.id))){l.outing=null;return null;}
  if(!o||o.version!==2)return o;
  const branchEdition = o.masteryTier>=2 && o.choices?.[0]===1 ? (o.edition ^ 6) : o.edition;
  const steps=outingTrail(o.route,branchEdition,o.mission,o.missionRevision);
  if(steps && branchEdition!==o.edition)steps[0]=outingTrail(o.route,o.edition,o.mission,o.missionRevision)[0];
  if(!steps||!GEAR.some(g=>g.id===o.gear))return null;
  const expertise=Array.isArray(o.expertise)?o.expertise:[],choices=[],log=[];
  let nerve=2,score=0,toolUsed=false;
  for(const choice of (Array.isArray(o.choices)?o.choices:[]).slice(0,3)){
    if(o.mission&&choice===2&&steps[choices.length].good!==o.gear)break;
    const move=trailMove(steps[choices.length],o.gear,expertise,nerve,toolUsed,choice);
    if(!move)break;
    const returning=o.mission&&Number.isInteger(o.returnedAt)&&choices.length>=o.returnedAt;
    if(returning&&o.missionRevision>=2){if(choice!==0)break;choices.push(choice);log.push('You left '+steps[choices.length-1].title+' unexplored and carried the recovered parts home.');continue;}
    choices.push(choice);log.push(returning?'You left '+steps[choices.length-1].title+' unexplored and carried the recovered parts home.':move.text);nerve=move.nerve;toolUsed=move.toolUsed;score+=move.points;
  }
  // A receipt means the trip already paid out. A damaged replay prefix must
  // never turn it back into an active trip and award the same homecoming twice.
  if(o.result&&choices.length<3){l.outing=null;return null;}
  // Rebuild resource counters from legal moves, including after save restoration.
  const dare=OUTING_DARES.find(d=>d.id===o.dare),dareMet=!!dare&&trailDareMet(dare.id,o.missionRevision>=2&&o.returnedAt?choices.slice(0,o.returnedAt):choices,nerve,toolUsed),dareBonus=choices.length===3&&dareMet?2:0;
  const baseScore=score;score+=dareBonus;
  Object.assign(o,{choices,log,nerve,score,toolUsed,step:choices.length});
  const search=(i,n,used,path=[])=>i===3?(dare&&trailDareMet(dare.id,path,n,used)?2:0):Math.max(...[0,1,2].map(c=>{const searchSteps=outingTrail(o.route,o.masteryTier>=2&&path[0]===1?o.edition^6:o.edition,o.mission,o.missionRevision);if(o.mission&&c===2&&searchSteps[i].good!==o.gear)return -Infinity;const m=trailMove(i===0?outingTrail(o.route,o.edition,o.mission,o.missionRevision)[0]:searchSteps[i],o.gear,expertise,n,used,c);return m?m.points+search(i+1,m.nerve,m.toolUsed,[...path,c]):-Infinity;}));
  const step=steps[o.step];
  const recovered=o.mission?choices.flatMap((c,i)=>c===1||c===2&&steps[i].good===o.gear?[i]:[]):[];
  const stored=lifeState(state).projectParts[o.route]||[],parts=[...new Set([...stored,...recovered])];
  return {...o,steps,baseScore,dareMet,dareBonus,recovered,parts,project:o.mission?PROJECTS.find(p=>p.id===o.route):null,best:search(0,2,false),options:step?[0,1,2].map(choice=>{
    const move=trailMove(step,o.gear,expertise,nerve,toolUsed,choice),cost=expertise.includes(step.stat)?1:2;
    const part=PROJECTS.find(p=>p.id===o.route)?.parts[o.step],pickup=stored.includes(o.step)?'Already stored · earn trail points':'Recover: '+part;
    const missionHint=choice===0?'Leave the part · restore 2 nerve':choice===1?pickup+' · spend '+cost+' nerve':toolUsed?'Equipment already used':step.good===o.gear?pickup+' · use tool · no nerve cost':'Your packed tool fits another stop';
    const available=!!move&&(!o.mission||choice!==2||step.good===o.gear);
    return {choice,available,preview:available?{nerve:move.nerve,toolUsed:move.toolUsed,points:move.points,partIndex:o.mission&&choice!==0?o.step:null,partNew:!!(o.mission&&choice!==0&&!stored.includes(o.step))}:null,label:choice===0?(o.mission?'Leave this part & recover':'Take the quiet way around'):choice===1?step.options[1]:step.good===o.gear?step.options[0]:o.mission?'Save the tool for another stop':'Improvise with '+GEAR.find(g=>g.id===o.gear).name.toLowerCase(),hint:o.masteryTier>=2&&o.step===0&&choice===1?missionHint+' · opens a different route for stops 2 and 3':o.mission?missionHint:choice===0?'0 points · restore 2 nerve (maximum 3)':choice===1?'+'+step.points+' points · costs '+cost+' nerve'+(expertise.includes(step.stat)?' · crew skill helps':''):toolUsed?'Equipment already used this trip':'+'+(step.good===o.gear?3:1)+' points · use your equipment once · no nerve cost'};
  }):[]};
}
export function outingPreview(state, routeId, gearId, cast) {
  const route=OUTINGS.find(x=>x.id===routeId);
  const crew=state.pets.filter(p=>Array.isArray(cast)&&cast.includes(p.id));
  if(!route||!GEAR.some(x=>x.id===gearId)||!crew.length)return null;
  return route.steps.map(step=>({gear:step.good===gearId,skill:crew.some(p=>(p.stats?.[step.stat]||0)>=7),stat:step.stat}));
}
export function startOuting(state, routeId, gearId, cast, options={}) {
  const l=lifeState(state);
  if(l.outing||!Array.isArray(cast))return false;
  const learning = options.learning ? (options.practice ? 0 : mastery(state,'expedition').tier) : null;
  const ids=[...new Set(cast)].filter(id=>state.pets.some(p=>p.id===id)).slice(0,2);
  if(!outingPreview(state,routeId,gearId,ids))return false;
  const crew=state.pets.filter(p=>ids.includes(p.id));
  const edition=Number.isInteger(options.edition)&&options.edition>=0&&options.edition<8?options.edition:l.outings%8;
  const expertise=learning===0?[]:['cute','menace','damp','mystique'].filter(stat=>crew.some(p=>(p.stats?.[stat]||0)>=7));
  l.outing={...(learning!==null?{masteryTier:learning,practice:options.practice===true,receipt:masteryTicket(state,'expedition')}:{}),version:2,edition,expertise,route:routeId,gear:gearId,cast:ids,step:0,score:0,log:[],choices:[],nerve:2,toolUsed:false};
  if(options.mission===true){l.outing.mission=true;if(options.missionRevision!==1)l.outing.missionRevision=2;}
  if(OUTING_DARES.some(d=>d.id===options.dare))l.outing.dare=options.dare;
  return true;
}
// Replay the same route rules with a fresh completion receipt. Mastery may
// have advanced since this route began; it must not rewrite the replay.
export function retryOuting(state) {
  const previous=outingSnapshot(state);
  if(!previous||previous.version!==2||previous.step!==3||!finishOuting(state))return false;
  const learning=Number.isInteger(previous.masteryTier);
  const started=startOuting(state,previous.route,previous.gear,previous.cast,{edition:previous.edition,dare:previous.dare,mission:previous.mission===true,missionRevision:previous.missionRevision||1,learning,practice:previous.practice===true});
  if(started){const next=lifeState(state).outing;next.expertise=previous.expertise.slice();if(learning)next.masteryTier=previous.masteryTier;}
  return started;
}
export function chooseOuting(state, choice, now=Date.now()) {
  const l=lifeState(state), o=l.outing, route=OUTINGS.find(x=>x.id===o?.route);
  if(!o||!route||![0,1,2].includes(choice))return null;
  const snapshot=outingSnapshot(state);
  if(!snapshot||o.step>=3)return null;
  const crew=state.pets.filter(p=>o.cast.includes(p.id));
  if(!crew.length){l.outing=null;return null;}
  let supported,line;
  if(o.version===2){
    if(!snapshot.options[choice]?.available)return null;
    o.choices.push(choice);const after=outingSnapshot(state);line=after.log.at(-1);supported=choice!==0;
  }else{
    // In-progress legacy expeditions keep their original two-choice rules.
    if(choice===2)return null;
    const step=route.steps[o.step];
    supported=choice===0?o.gear===step.good:crew.some(p=>(p.stats?.[step.stat]||0)>=7);
    o.score+=supported?1:0;o.choices.push(choice);
    line=step.outcomes[choice]+(supported?' Their preparation paid off.':' They improvised. It was not dignified, but it worked.');
    o.log.push(line);o.step++;
  }
  if(o.step<3)return {text:line,complete:false,supported};
  const tier=o.version===2?(o.score>=6?2:o.score>=3?1:0):(o.score>=3?2:o.score>=1?1:0),relic=RELICS.find(r=>r.id===o.route+':'+tier);
  const fresh=!l.relics.includes(relic.id);
  if(fresh){l.relics.push(relic.id);l.xp+=4;if(l.displayed.length<3)l.displayed.push(relic.id);}
  l.outings++;dailyActivity(state,'outing',now);l.introDone=true;
  crew.forEach(p=>{p.needs.fuss=clamp(p.needs.fuss+8,0,100);p.expeditions=(p.expeditions||0)+1;});
  if(crew.length===2){state.stories||={};state.stories.relationships||={};const key=crew.map(p=>p.id).sort().join('|');const r=state.stories.relationships[key]||={time:0,plots:0};r.plots=(r.plots||0)+1;r.lastPlotAt=now;}
  const text=crew.map(p=>p.name).join(' and ')+' returned with '+relic.name.toLowerCase()+'. '+relic.line+' '+line;
  recordScene(state,'outing',route.name,text,crew.map(p=>p.id),now,{key:'outing',branch:route.id,object:relic.id});addNote(state,text,'beyond the shelf','scheme');rewardGame(state,now);
  o.result={relic:relic.id,fresh};
  if(o.receipt && !o.practice && !o.returnedAt && o.score>=3) {
    const before=mastery(state,'expedition').tier;
    completeMastery(state,'expedition',o.masteryTier,o.receipt);
    if(mastery(state,'expedition').tier>before)o.result.masteryUnlocked=mastery(state,'expedition').tier;
  }
  recordEscapadeEvent(state, { kind: 'play', petIds: crew.map(p => p.id), activity: 'outing' }, now);
  if(o.mission){
    const after=outingSnapshot(state),builtBefore=l.projects.includes(o.route);
    l.projectParts[o.route]=after.parts;
    if(after.parts.length>=2&&!builtBefore){l.projects.push(o.route);awardDiscovery(state,'built:'+o.route,6,now);}
    o.result.project=o.route;o.result.built=!builtBefore&&l.projects.includes(o.route);o.result.found=after.recovered;
    if(o.missionRevision>=2&&!o.returnedAt){
      // A detour visits different encounters. Keep its field note separate so
      // the archive never attributes unvisited stops or consumes the main page.
      const page=o.route+':'+o.edition+(o.masteryTier>=2&&o.choices[0]===1?':detour':''); l.trailPages||=[];
      o.result.page=page;o.result.pageFresh=!l.trailPages.includes(page);
      if(o.result.pageFresh){l.trailPages.push(page);l.xp+=2;}
    }
  }
  return {complete:true,text,fresh,relic,supported};
}
export function useProject(state,id,now=Date.now()) {
  const l=lifeState(state),project=PROJECTS.find(p=>p.id===id);
  if(!project||!l.projects.includes(id)||!state.pets.length)return null;
  const fresh=dailyActivity(state,'project:'+id,now);
  if(fresh)state.pets.forEach(p=>{p.needs[project.need]=clamp(p.needs[project.need]+6,0,100);});
  return {fresh,text:project.reaction,benefit:project.benefit};
}
export function finishOuting(state) {
  const l=lifeState(state);if(!l.outing||l.outing.step!==3)return false;l.outing=null;return true;
}
export function returnFromMission(state,now=Date.now()) {
  const o=outingSnapshot(state);
  if(!o?.mission||o.step<1||o.step>=3||(o.missionRevision>=2?o.recovered.length<1:o.parts.length<2))return false;
  lifeState(state).outing.returnedAt=o.step;
  // Cash out over the quiet route. Unvisited stops are explicitly recorded as
  // unexplored, and completion still passes through the single reward boundary.
  while(lifeState(state).outing.step<3)if(!chooseOuting(state,0,now))return false;
  return true;
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
  recordScene(state, 'visitor',guest.name+': '+act.title,v.activityResponse,[v.hostId].filter(Boolean),now,{key:'visitor',guest:guest.id,branch:'chapter-'+(act.chapter+1)});
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

