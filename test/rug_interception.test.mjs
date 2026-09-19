import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createRug,tossBall,tossPreset,updateRug,setRugViewport} from '../src/engine/play-rug.js';
const pet={id:'audit',traits:[]};
const advance=(g,n=6)=>Array.from({length:n*60},()=>updateRug(g,1/60)).flat();
test('phone geometry matches a visible ball, rather than a CSS-only enlarged hitbox',()=>{
 const g=createRug(pet);setRugViewport(g,288);const b=tossPreset(g);assert.ok(b.r*2/1000*288>=30);assert.ok(b.r*2/1000*288<=36);
});
test('infeasible remote throws miss visibly and never become automatic floor catches',()=>{
 const g=createRug(pet);g.pet.x=900;tossBall(g,{x:80,y:440,vx:-400,vy:400});const e=advance(g,10);
 assert.ok(e.some(x=>x.type==='miss'));assert.equal(g.catches,0);
});
test('a clean catch keeps possession and returns the same visible ball without repeat catches',()=>{
 const g=createRug(pet);const b=tossPreset(g);let e=[];for(let i=0;i<180&&!g.catches;i++)e.push(...updateRug(g,1/60));
 assert.equal(g.catches,1);assert.equal(g.balls[0]?.id,b.id);assert.equal(g.balls[0]?.state,'held');e.push(...advance(g,7));
 assert.ok(e.some(x=>x.type==='return'));assert.equal(g.catches,1);
});
test('hard contacts fumble with a recoverable physical drop',()=>{
 const g=createRug(pet);tossBall(g,{x:120,y:375,vx:1100,vy:0});const e=advance(g,8);
 assert.ok(e.some(x=>['fumble','miss'].includes(x.type)));assert.ok(!e.some(x=>x.type==='catch'&&x.time<.3));
});
test('reactions have finite acceleration and do not intercept immediately',()=>{
 const g=createRug({id:'watcher',traits:['suspicious']});tossBall(g,{x:800,y:300,vx:0,vy:0});advance(g,0.1);assert.equal(g.pet.x,500);
});
test('easy, hard and infeasible commands have different physical outcomes over positions and traits',()=>{
 let easy=0,hard=0,misses=0,refusals=0;
 for(const width of [288,358,398,860])for(let i=0;i<30;i++){
  const traits=i%3===0?['suspicious']:i%3===1?['feral']:[];
  for(const kind of ['soft','long']){const g=createRug({id:'trial'+i,traits});g.pet.x=65+i/29*870;setRugViewport(g,width);tossPreset(g,kind);advance(g,9);if(kind==='soft')easy+=g.catches;else{hard+=g.catches;misses+=g.misses;}}
 }
 assert.ok(easy>100);assert.ok(hard<easy);assert.ok(misses>10);
 const g=createRug({id:'vain',traits:['narcissist']});tossPreset(g);tossPreset(g);const e=advance(g,8);assert.ok(e.some(x=>x.type==='refuse'));assert.ok(g.catches<=1);
});

test('challenge counts every catch independently of caption priority and ignores replayed receipts', async()=>{
 const {countRugChallenge}=await import('../src/engine/play-rug.js');
 const g=createRug({id:'a',traits:[]});
 for(const options of [
 {x:299.9724931549281,y:360.8219346217811,vx:-465.8732370007783,vy:-102.27733589708805},
 {x:430.52322684787214,y:187.48868385329843,vx:-112.05028020776808,vy:546.7134229838848},
 {x:250.57167279534042,y:207.31892039999366,vx:510.38915920071304,vy:-475.1025181263685}
 ])tossBall(g,options);
 let packet;for(let i=0;i<32;i++)packet=updateRug(g,1/60);
 assert.ok(packet.some(e=>e.type==='miss'));assert.ok(packet.some(e=>e.type==='catch'));
 const challenge={level:0,count:0};assert.equal(countRugChallenge(challenge,packet),true);assert.equal(challenge.count,1);
 assert.equal(countRugChallenge(challenge,packet),false);assert.equal(challenge.count,1);
 const recovery=[{type:'recover',id:'recovery'},{type:'catch',id:'recovered',bounces:1,high:true,recovered:true}];
 for(const level of [1,2]){const next={level,count:0};countRugChallenge(next,recovery);assert.equal(next.count,1);countRugChallenge(next,recovery);assert.equal(next.count,1);}
});
