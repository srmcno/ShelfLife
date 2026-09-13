// Optional CPU baseline: node test/benchmark.mjs
// This measures engine and serialization work in Node, not DOM/rendering,
// browser memory, touch latency, or physical device frame rates.
import { performance } from 'node:perf_hooks';
import { householdFixture } from './household-fixtures.mjs';
import { normalizeState } from '../src/state.js';
import { tick } from '../src/engine/tick.js';
import { runBehavior } from '../src/engine/behavior.js';
import { advanceStories } from '../src/engine/stories.js';
import { newChase, updateChase } from '../src/engine/chase.js';
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
const resident=householdFixture('established',now).pets[0];
measurements.push(measure('Crumb Chase full 22-second engine run (1320 updates)',100,()=>{const g=newChase(resident,{seed:121});for(let i=0;i<1320;i++)updateChase(g,{left:i%180<70,right:i%180>90,hop:i%120===0},1/60);}));
console.log(JSON.stringify({runtime:process.version,scope:'Node CPU only. No browser/DOM/GPU or physical touch claims.',measurements},null,2));
