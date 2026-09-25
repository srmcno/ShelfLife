// Optional CPU baseline: node test/benchmark.mjs
// This measures engine and serialization work in Node, not DOM/rendering,
// browser memory, touch latency, or physical device frame rates.
import { performance } from 'node:perf_hooks';
import { householdFixture } from './household-fixtures.mjs';
import { normalizeState } from '../src/state.js';
import { tick } from '../src/engine/tick.js';
import { runBehavior } from '../src/engine/behavior.js';
import { advanceStories } from '../src/engine/stories.js';
import { frenzyStart, frenzyStep, seededRandom } from '../src/engine/arcade.js';
const now=new Date(2026,8,12,12).getTime();
function measure(label,iterations,fn){
  for(let i=0;i<5;i++)fn(i);
  const samples=[];for(let i=0;i<iterations;i++){const at=performance.now();fn(i);samples.push(performance.now()-at);}
  samples.sort((a,b)=>a-b);
  return {label,iterations,medianMs:+samples[Math.floor(samples.length/2)].toFixed(3),p95Ms:+samples[Math.floor(samples.length*.95)].toFixed(3),maxMs:+samples.at(-1).toFixed(3)};
}
const measurements=[];
for(const kind of ['established','nearly-full','drawing-heavy']){
  const s=householdFixture(kind,now),encoded=JSON.stringify(s);
  measurements.push({...measure(kind+' parse + normalize restore',40,()=>normalizeState(JSON.parse(encoded))),serializedBytes:Buffer.byteLength(encoded)});
  measurements.push(measure(kind+' serialize save',100,()=>JSON.stringify(s)));
  let pass=0;
  measurements.push(measure(kind+' elapsed household minute',120,()=>{const time=now+(++pass)*60000;tick(s,time);runBehavior(s,time);advanceStories(s,time);}));
}
measurements.push(measure('Feeding Frenzy 60-second engine run (3600 steps)',100,i=>{const g=frenzyStart(seededRandom(i+1));g.lives=1e6;for(let n=0;n<3600;n++)frenzyStep(g,1/60);}));
console.log(JSON.stringify({runtime:process.version,scope:'Node CPU only. No browser/DOM/GPU or physical touch claims.',measurements},null,2));
