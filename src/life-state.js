// Compact, versioned save data. No DOM, clock changes, or external services.
export function blankLife() {
  return { v:1, introDone:false, introStarted:false, xp:0, day:'', daily:[], awards:[], scenes:[], serial:0,
    relics:[], displayed:[], frame:'wood', visitorEpisodes:{}, outing:null, outings:0,
    courtWins:0, courtPlays:0, lastSeen:0, recap:[], blueprints:[],
    market:null, marketSerial:0, marketRuns:0, marketBest:0 };
}
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const number = (x, max=1e9) => Number.isFinite(x) ? Math.max(0,Math.min(max,Math.floor(x))) : 0;
export function normalizeLife(raw, established=false) {
  const s = Object.assign(blankLife(), obj(raw) ? raw : {});
  s.introDone = raw ? s.introDone === true : established;
  s.v=1; s.introStarted=s.introStarted===true;
  for (const k of ['xp','serial','outings','courtWins','courtPlays','lastSeen','marketSerial','marketRuns','marketBest']) s[k]=number(s[k],k==='lastSeen'?1e14:1e9);
  s.day=typeof s.day==='string'?s.day.slice(0,10):'';
  for (const k of ['daily','awards','relics','displayed']) s[k]=[...new Set((Array.isArray(s[k])?s[k]:[]).filter(x=>typeof x==='string'&&/^[a-z0-9:_-]{1,80}$/i.test(x)))].slice(0,k==='displayed'?3:200);
  s.scenes=(Array.isArray(s.scenes)?s.scenes:[]).filter(x=>obj(x)&&typeof x.title==='string'&&typeof x.text==='string')
    .slice(0,18).map(x=>({id:number(x.id),at:number(x.at,1e14),title:x.title.slice(0,100),text:x.text.slice(0,1200),kind:typeof x.kind==='string'?x.kind.slice(0,40):'story',cast:(Array.isArray(x.cast)?x.cast:[]).filter(id=>typeof id==='string').slice(0,2)}));
  s.recap=(Array.isArray(s.recap)?s.recap:[]).filter(x=>typeof x==='number').slice(0,3);
  s.visitorEpisodes=Object.fromEntries(Object.entries(obj(s.visitorEpisodes)?s.visitorEpisodes:{}).filter(([k])=>/^[a-z0-9_-]+$/.test(k)).map(([k,v])=>[k,number(v,3)]));
  if (!obj(s.outing)||!Array.isArray(s.outing.cast)||!Number.isInteger(s.outing.step)||s.outing.step<0||s.outing.step>3) s.outing=null;
  else {
    const o=s.outing,v2=o.version===2;
    s.outing={route:String(o.route).slice(0,20),gear:String(o.gear).slice(0,20),cast:[...new Set(o.cast.filter(x=>typeof x==='string'))].slice(0,2),step:o.step,score:number(o.score,10),log:(Array.isArray(o.log)?o.log:[]).filter(x=>typeof x==='string').map(x=>x.slice(0,1200)).slice(0,3),choices:(Array.isArray(o.choices)?o.choices:[]).slice(0,3)};
    if(v2){
      const choices=[];for(const choice of s.outing.choices){if(![0,1,2].includes(choice))break;choices.push(choice);}
      Object.assign(s.outing,{version:2,edition:number(o.edition,7),expertise:[...new Set((Array.isArray(o.expertise)?o.expertise:[]).filter(x=>['cute','menace','damp','mystique'].includes(x)))],choices,step:choices.length,nerve:number(o.nerve,3),toolUsed:o.toolUsed===true});
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
      moves.push({pick:move.pick,trade:move.trade});
    }
    s.market={seed:s.market.seed,moves,claimed:s.market.claimed===true&&moves.length===6};
  }
  s.frame=['wood','brass','moon','velvet'].includes(s.frame)?s.frame:'wood';
  // Generated blueprints only, keeping the save small. Creature normalization
  // happens at the art boundary when a blueprint is loaded.
  s.blueprints=(Array.isArray(s.blueprints)?s.blueprints:[]).filter(x=>obj(x)&&typeof x.name==='string'&&obj(x.creature)).slice(0,6).map(x=>({name:x.name.slice(0,22),creature:x.creature}));
  return s;
}
