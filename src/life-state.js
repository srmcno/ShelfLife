// Compact, versioned save data. No DOM, clock changes, or external services.
export function blankLife() {
  return { v:1, introDone:false, introStarted:false, xp:0, day:'', daily:[], awards:[], scenes:[], serial:0,
    relics:[], displayed:[], frame:'wood', visitorEpisodes:{}, outing:null, outings:0,
    court:null, courtWins:0, courtPlays:0, courtBest:0, lastSeen:0, recap:[], blueprints:[],
    market:null, marketSerial:0, marketRuns:0, marketBest:0 };
}
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const number = (x, max=1e9) => Number.isFinite(x) ? Math.max(0,Math.min(max,Math.floor(x))) : 0;
export function normalizeLife(raw, established=false) {
  const s = Object.assign(blankLife(), obj(raw) ? raw : {});
  s.introDone = raw ? s.introDone === true : established;
  s.v=1; s.introStarted=s.introStarted===true;
  for (const k of ['xp','serial','outings','courtWins','courtPlays','courtBest','lastSeen','marketSerial','marketRuns','marketBest']) s[k]=number(s[k],k==='lastSeen'?1e14:1e9);
  s.day=typeof s.day==='string'?s.day.slice(0,10):'';
  for (const k of ['daily','awards','relics','displayed']) s[k]=[...new Set((Array.isArray(s[k])?s[k]:[]).filter(x=>typeof x==='string'&&/^[a-z0-9:_-]{1,80}$/i.test(x)))].slice(0,k==='displayed'?3:200);
  s.scenes=(Array.isArray(s.scenes)?s.scenes:[]).filter(x=>obj(x)&&typeof x.title==='string'&&typeof x.text==='string')
    .slice(0,18).map(x=>({id:number(x.id),at:number(x.at,1e14),title:x.title.slice(0,100),text:x.text.slice(0,1200),kind:typeof x.kind==='string'?x.kind.slice(0,40):'story',cast:(Array.isArray(x.cast)?x.cast:[]).filter(id=>typeof id==='string').slice(0,2),...(obj(x.stage)?{stage:Object.fromEntries(['key','branch','object','guest'].filter(k=>typeof x.stage[k]==='string'&&/^[a-z0-9:_-]{1,60}$/i.test(x.stage[k])).map(k=>[k,x.stage[k]]))}:{})}));
  s.recap=(Array.isArray(s.recap)?s.recap:[]).filter(x=>typeof x==='number').slice(0,3);
  s.visitorEpisodes=Object.fromEntries(Object.entries(obj(s.visitorEpisodes)?s.visitorEpisodes:{}).filter(([k])=>/^[a-z0-9_-]+$/.test(k)).map(([k,v])=>[k,number(v,3)]));
  if (!obj(s.outing)||!Array.isArray(s.outing.cast)||!Number.isInteger(s.outing.step)||s.outing.step<0||s.outing.step>3) s.outing=null;
  else {
    const o=s.outing,v2=o.version===2;
    s.outing={route:String(o.route).slice(0,20),gear:String(o.gear).slice(0,20),cast:[...new Set(o.cast.filter(x=>typeof x==='string'))].slice(0,2),step:o.step,score:number(o.score,10),log:(Array.isArray(o.log)?o.log:[]).filter(x=>typeof x==='string').map(x=>x.slice(0,1200)).slice(0,3),choices:(Array.isArray(o.choices)?o.choices:[]).slice(0,3)};
    if(v2){
      const choices=[];for(const choice of s.outing.choices){if(![0,1,2].includes(choice))break;choices.push(choice);}
      Object.assign(s.outing,{version:2,edition:number(o.edition,7),expertise:[...new Set((Array.isArray(o.expertise)?o.expertise:[]).filter(x=>['cute','menace','damp','mystique'].includes(x)))],choices,step:choices.length,nerve:number(o.nerve,3),toolUsed:o.toolUsed===true});
      if(['bold','thrifty','steady'].includes(o.dare))s.outing.dare=o.dare;
    }else s.outing.choices=s.outing.choices.filter(x=>x===0||x===1);
    if(obj(o.result)&&typeof o.result.relic==='string')s.outing.result={relic:o.result.relic.slice(0,30),fresh:o.result.fresh===true};
  }
  // Only the seed and choices are saved. Prices, bag contents and the score are
  // replayed by the market engine, so stale or edited counters cannot mint prizes.
  if (!obj(s.market)||!Number.isInteger(s.market.seed)||s.market.seed<1||s.market.seed>4294967295||!Array.isArray(s.market.moves)||s.market.moves.length>6) s.market=null;
  else {
    const moves=[];
    for(const move of s.market.moves){
      if(!obj(move)||!(move.pick===null||typeof move.pick==='string'&&/^[a-z-]{1,30}$/.test(move.pick))||!(move.trade===null||typeof move.trade==='string'&&/^[a-z-]{1,30}$/.test(move.trade)))break;
      moves.push({pick:move.pick,trade:move.trade,...(s.market.version===2&&move.secret===true?{secret:true}:{})});
    }
    s.market={seed:s.market.seed,moves,claimed:s.market.claimed===true&&moves.length===6,...(s.market.version===2?{version:2}:{})};
  }
  // Court stores identity snapshots and a bounded legal-action log. Testimony,
  // evidence, guilt and ranks are reconstructed by the seeded engine on load.
  if(!obj(s.court)||s.court.version!==2||!Number.isInteger(s.court.seed)||s.court.seed<1||s.court.seed>4294967295||!Number.isInteger(s.court.caseIndex)||s.court.caseIndex<0||s.court.caseIndex>=12||!Number.isInteger(s.court.level)||s.court.level<0||s.court.level>2||!Array.isArray(s.court.cast)||!Array.isArray(s.court.moves))s.court=null;
  else {
    const c=s.court,cast=c.cast.filter(p=>obj(p)&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=80&&typeof p.name==='string').slice(0,4).map(p=>({id:p.id,name:p.name.slice(0,40)}));
    if(!cast.length||new Set(cast.map(p=>p.id)).size!==cast.length||typeof c.petId!=='string'||!cast.some(p=>p.id===c.petId))s.court=null;
    else {
      const moves=[];
      for(const move of c.moves.slice(0,96)){
        if(!obj(move)||!['inspect','question','press','present','appeal','hint','file'].includes(move.type))break;
        const clean={type:move.type};let valid=true;
        for(const key of (move.type==='inspect'?['evidence']:move.type==='question'||move.type==='appeal'||move.type==='file'?['suspect']:move.type==='press'?['suspect','statement']:move.type==='present'?['suspect','statement','evidence']:[])){
          if(!Number.isInteger(move[key])||move[key]<0||move[key]>(key==='suspect'?3:2)){valid=false;break;}clean[key]=move[key];
        }
        if(!valid)break;moves.push(clean);
      }
      const ui=obj(c.ui)?c.ui:{};
      s.court={version:2,seed:c.seed,caseIndex:c.caseIndex,level:c.level,cast,petId:c.petId,moves,claimed:c.claimed===true&&moves.at(-1)?.type==='file',ui:{chapter:['investigation','hearing','verdict'].includes(ui.chapter)?ui.chapter:'investigation',witness:Number.isInteger(ui.witness)&&ui.witness>=0&&ui.witness<4?ui.witness:null,statement:Number.isInteger(ui.statement)&&ui.statement>=0&&ui.statement<3?ui.statement:null,exhibit:Number.isInteger(ui.exhibit)&&ui.exhibit>=0&&ui.exhibit<3?ui.exhibit:null}};
      // Display-only reward totals are never paid by reconstruction.
      if(s.court.claimed&&obj(c.reward))s.court.reward={bond:number(c.reward.bond,1),fuss:number(c.reward.fuss,16)};
    }
  }
  s.frame=['wood','brass','moon','velvet'].includes(s.frame)?s.frame:'wood';
  // Generated blueprints only, keeping the save small. Creature normalization
  // happens at the art boundary when a blueprint is loaded.
  s.blueprints=(Array.isArray(s.blueprints)?s.blueprints:[]).filter(x=>obj(x)&&typeof x.name==='string'&&obj(x.creature)).slice(0,6).map(x=>({name:x.name.slice(0,22),creature:x.creature}));
  return s;
}
