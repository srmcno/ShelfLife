import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { generateCreature } from '../src/art/creatures.js';

// Deterministic, synthetic households. No player data belongs in this file.
export const FIXTURE_NAMES = ['fresh', 'established', 'nearly-full', 'drawing-heavy', 'conflicting', 'sleeping', 'capped', 'legacy'];
const names = ['Agnes', 'Lord Dampington III', 'Pip', 'Bitey', 'Velvet', 'Mothball', 'Cricket', 'Doreen', 'Gladys', 'Snag', 'Mildred', 'Crumb', 'Wanda', 'Nell', 'Gnasher'];
const traits = ['spiteful', 'damp', 'theatrical', 'magpie', 'porcelain', 'sugar', 'loadbearing', 'nocturnal'];
// A valid synthetic raster with deliberately uncompressed pixels exercises the
// storage and image path of a large freehand drawing without external assets.
function drawing() {
  const width = 120, bytes = [137,80,78,71,13,10,26,10];
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const crc = data => { let n = -1; for (const b of data) { n ^= b; for(let i=0;i<8;i++) n=(n>>>1)^((n&1)?0xedb88320:0); } return (n^-1)>>>0; };
  const chunk = (name, data) => { const body = [...name].map(c=>c.charCodeAt(0)).concat(data); bytes.push(...u32(data.length), ...body, ...u32(crc(body))); };
  chunk('IHDR', [...u32(width), ...u32(width), 8,6,0,0,0]);
  const pixels=[];
  for(let y=0;y<width;y++) { pixels.push(0); for(let x=0;x<width;x++) { const inside=(x-60)**2+(y-65)**2<46**2; pixels.push(174+(x%23),90+(y%25),171,inside?255:0); } }
  let a=1,b=0; for(const p of pixels) { a=(a+p)%65521; b=(b+a)%65521; }
  const length=pixels.length;
  chunk('IDAT',[0x78,0x01,1,length&255,length>>>8,(~length)&255,((~length)>>>8)&255,...pixels,...u32((b<<16)|a)]);
  chunk('IEND', []);
  return 'data:image/png;base64,' + btoa(bytes.map(n=>String.fromCharCode(n)).join(''));
}
let raster;
export function householdFixture(kind='established', now=Date.now()) {
  if(!FIXTURE_NAMES.includes(kind)) throw new Error('Unknown test household: '+kind);
  const s=blankState(); s.started=now-7*86400000; s.lastTick=now; s.seq=80;
  if(kind==='fresh') return s;
  const count=kind==='nearly-full'?14:kind==='drawing-heavy'?12:kind==='conflicting'?4:3;
  s.pets=Array.from({length:count},(_,i)=>({ id:'qa'+i,name:names[i],bio:'Synthetic test resident with a recorded household history.',
    born:s.started+i*60000,traits:[traits[i%traits.length]],needs:{food:74,fuss:69,clean:81},bond:9,cared:18,grudges:0,
    stats:{cute:7,menace:5,damp:4,mystique:8},careLog:{food:9,fuss:5,clean:4},handshakes:2,chases:1,alibis:1,
    names:[{name:'Arrival '+i,at:s.started},{name:names[i],at:now-86400000}],
    slotHist:[{slot:(i+6)%18,at:s.started},{slot:i,at:now-86400000}],
    art:{body:'',stamps:[],creature:generateCreature({seed:'qa-resident-'+i})}
  }));
  s.props=[{id:'qad0',kind:'bowl'},{id:'qad1',kind:'lamp'},{id:'qad2',kind:'yarn'}];
  s.theatre={lamps:{qad1:false}};
  s.behavior={props:{qad0:{uses:1,emptyUntil:0}}};
  s.pets.forEach((p,i)=>s.slots[i]=p.id); s.props.forEach((p,i)=>s.slots[count+i]=p.id);
  s.life.introDone=true; s.life.introStarted=true; s.life.xp=85; s.life.projects=['drawer']; s.life.projectParts={drawer:[0,2],fridge:[1],cupboard:[]};
  s.life.relics=['brass-button']; s.life.lastSeen=now;
  s.life.scenes=[{id:1,at:now-60000,kind:'care',title:'An actual fixture memory',text:'Agnes was fed during this test household’s recorded history.',cast:['qa0']}];
  s.life.serial=1;
  s.stories={relationships:{'qa0|qa1':{time:1800000,plots:2},'qa1|qa2':{time:1200000,plots:0}},
    collection:[{id:'moth',at:now-86400000}],visitStats:{moth:{visits:2,welcomes:1}},
    archive:[{kind:'relationship',title:'A shared plot',text:'Agnes and Lord Dampington III completed two supervised plots.',at:now-3600000}],
    residents:[{id:'qa-old',name:'Old Slipper',names:[{name:'Old Slipper',at:s.started}]}],
    lastRelations:now,lastVisit:now-86400000,nextVisitAt:now+3600000};
  s.notes=[{text:'Agnes stood beside Pip. Neither denied enjoying it.',from:'the shelf',kind:'note',form:'line',at:now-60000}];
  s.achievements=['first-touch']; s.achievementAt={'first-touch':now-3600000};
  s.gone=[{id:'qa-old',name:'Old Slipper',slot:4,at:now-2*86400000,neighbors:['Agnes']}];
  s.friction={'qa0|qa1':{n:2,at:now-3600000}};
  s.settings.muted=true; s.settings.narratorOn=false;
  if(kind==='conflicting') { s.pets[0].traits=['nocturnal']; s.pets[1].traits=['sugar']; s.pets[2].traits=['porcelain']; s.pets[3].traits=['damp']; }
  // Nocturnal residents sleep during local daytime. Engine tests pin noon;
  // browser checks at night must report that this fixture is naturally awake.
  if(kind==='sleeping') s.pets.forEach(p=>p.traits=['nocturnal']);
  if(kind==='capped') s.pets.forEach(p=>{p.bond=25;p.needs={food:100,fuss:100,clean:100};p.bonusTrust={day:localDayKey(now),n:3};p.playedAt={memory:now,chase:now,alibi:now,court:now};});
  if(kind==='drawing-heavy') { raster ||= drawing(); s.pets.forEach(p=>p.art={body:raster,stamps:Array.from({length:18},(_,i)=>({kind:i%2?'eyes':'legs',x:220+(i%6)*30,y:210+Math.floor(i/6)*65,size:24,rotation:i*3,color:'#271927'})),bounds:{x:.1,y:.1,width:.8,height:.85}}); }
  if(kind==='legacy') { s.v=3; delete s.life; s.pets.forEach(p=>{p.img=drawing();delete p.art;delete p.names;delete p.slotHist;}); return s; }
  return normalizeState(s);
}
