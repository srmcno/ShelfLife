// Compact, versioned save data. No DOM, clock changes, or external services.
export function blankLife() {
  return { v:1, introDone:false, introStarted:false, xp:0, day:'', daily:[], awards:[], scenes:[], serial:0,
    relics:[], displayed:[], frame:'wood', visitorEpisodes:{}, outing:null, outings:0, projects:[], projectParts:{}, trailPages:[],
    lastSeen:0, recap:[], blueprints:[] };
}
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const number = (x, max=1e9) => Number.isFinite(x) ? Math.max(0,Math.min(max,Math.floor(x))) : 0;
export function normalizeLife(raw, established=false) {
  const s = Object.assign(blankLife(), obj(raw) ? raw : {});
  s.introDone = raw ? s.introDone === true : established;
  s.v=1; s.introStarted=s.introStarted===true;
  s.welcome=obj(s.welcome)&&typeof s.welcome.petId==='string'?{petId:s.welcome.petId.slice(0,80),bowlId:typeof s.welcome.bowlId==='string'?s.welcome.bowlId.slice(0,80):'',at:number(s.welcome.at,1e14),choice:['share','keep'].includes(s.welcome.choice)?s.welcome.choice:'',text:typeof s.welcome.text==='string'?s.welcome.text.slice(0,800):'',asleep:s.welcome.asleep===true,dismissed:s.welcome.dismissed===true}:null;
  for (const k of ['xp','serial','outings','lastSeen']) s[k]=number(s[k],k==='lastSeen'?1e14:1e9);
  s.day=typeof s.day==='string'?s.day.slice(0,10):'';
  s.trailPages=[...new Set((Array.isArray(s.trailPages)?s.trailPages:[]).filter(id=>typeof id==='string'&&/^(drawer|fridge|cupboard):[0-7](:detour)?$/.test(id)))].slice(0,48);
  s.projects=[...new Set((Array.isArray(s.projects)?s.projects:[]).filter(id=>['drawer','fridge','cupboard'].includes(id)))];
  s.projectParts=Object.fromEntries(['drawer','fridge','cupboard'].map(id=>[id,[...new Set((Array.isArray(s.projectParts?.[id])?s.projectParts[id]:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<3))]]));
  for (const k of ['daily','awards','relics','displayed']) s[k]=[...new Set((Array.isArray(s[k])?s[k]:[]).filter(x=>typeof x==='string'&&/^[a-z0-9:_-]{1,80}$/i.test(x)))].slice(0,k==='displayed'?3:200);
  s.scenes=(Array.isArray(s.scenes)?s.scenes:[]).filter(x=>obj(x)&&typeof x.title==='string'&&typeof x.text==='string')
    .slice(0,18).map(x=>({id:number(x.id),at:number(x.at,1e14),title:x.title.slice(0,100),text:x.text.slice(0,1200),kind:typeof x.kind==='string'?x.kind.slice(0,40):'story',cast:(Array.isArray(x.cast)?x.cast:[]).filter(id=>typeof id==='string').slice(0,2),...(obj(x.stage)?{stage:Object.fromEntries(['key','branch','object','guest','endingId'].filter(k=>typeof x.stage[k]==='string'&&/^[a-z0-9:_-]{1,60}$/i.test(x.stage[k])).map(k=>[k,x.stage[k]]).concat(x.stage.contentVersion===2?[['contentVersion',2]]:[]))}:{})}));
  s.recap=(Array.isArray(s.recap)?s.recap:[]).filter(x=>typeof x==='number').slice(0,3);
  s.visitorEpisodes=Object.fromEntries(Object.entries(obj(s.visitorEpisodes)?s.visitorEpisodes:{}).filter(([k])=>/^[a-z0-9_-]+$/.test(k)).map(([k,v])=>[k,number(v,3)]));
  if (!obj(s.outing)||!Array.isArray(s.outing.cast)||!Number.isInteger(s.outing.step)||s.outing.step<0||s.outing.step>3) s.outing=null;
  else {
    const o=s.outing,v2=o.version===2;
    s.outing={route:String(o.route).slice(0,20),gear:String(o.gear).slice(0,20),cast:[...new Set(o.cast.filter(x=>typeof x==='string'))].slice(0,2),step:o.step,score:number(o.score,10),log:(Array.isArray(o.log)?o.log:[]).filter(x=>typeof x==='string').map(x=>x.slice(0,1200)).slice(0,3),choices:(Array.isArray(o.choices)?o.choices:[]).slice(0,3)};
    if(v2){
      if(Number.isInteger(o.masteryTier)&&o.masteryTier>=0&&o.masteryTier<=2)Object.assign(s.outing,{masteryTier:o.masteryTier,practice:o.practice===true,receipt:typeof o.receipt==='string'?o.receipt.slice(0,80):''});
      const choices=[];for(const choice of s.outing.choices){if(![0,1,2].includes(choice))break;choices.push(choice);}
      Object.assign(s.outing,{version:2,edition:number(o.edition,7),expertise:[...new Set((Array.isArray(o.expertise)?o.expertise:[]).filter(x=>['cute','menace','damp','mystique'].includes(x)))],choices,step:choices.length,nerve:number(o.nerve,3),toolUsed:o.toolUsed===true});
      if(['bold','thrifty','steady'].includes(o.dare))s.outing.dare=o.dare;
      if(o.mission===true){s.outing.mission=true;if(o.missionRevision===2)s.outing.missionRevision=2;}
      if(o.mission===true&&Number.isInteger(o.returnedAt)&&o.returnedAt>=1&&o.returnedAt<=2)s.outing.returnedAt=o.returnedAt;
    }else s.outing.choices=s.outing.choices.filter(x=>x===0||x===1);
    if(obj(o.result)&&typeof o.result.relic==='string'){
      s.outing.result={relic:o.result.relic.slice(0,30),fresh:o.result.fresh===true};
      if(Number.isInteger(o.result.masteryUnlocked)&&o.result.masteryUnlocked===o.masteryTier+1&&o.result.masteryUnlocked<=2)s.outing.result.masteryUnlocked=o.result.masteryUnlocked;
      if(typeof o.result.page==='string'&&/^(drawer|fridge|cupboard):[0-7](:detour)?$/.test(o.result.page))Object.assign(s.outing.result,{page:o.result.page,pageFresh:o.result.pageFresh===true});
      if(['drawer','fridge','cupboard'].includes(o.result.project))Object.assign(s.outing.result,{project:o.result.project,built:o.result.built===true,found:(Array.isArray(o.result.found)?o.result.found:[]).filter(i=>[0,1,2].includes(i)).slice(0,3)});
    }
  }
  // The retired Night Market and Shelf Court kept saved trips here; drop them.
  delete s.market; delete s.court;
  for (const k of ['courtWins','courtPlays','courtBest','marketSerial','marketRuns','marketBest','marketErrandBest','marketErrandBestV4','marketErrandBestV5']) delete s[k];
  s.frame=['wood','brass','moon','velvet'].includes(s.frame)?s.frame:'wood';
  // Generated blueprints only, keeping the save small. Creature normalization
  // happens at the art boundary when a blueprint is loaded.
  s.blueprints=(Array.isArray(s.blueprints)?s.blueprints:[]).filter(x=>obj(x)&&typeof x.name==='string'&&obj(x.creature)).slice(0,6).map(x=>({name:x.name.slice(0,22),creature:x.creature}));
  return s;
}
