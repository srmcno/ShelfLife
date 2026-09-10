import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wireChaseAction} from '../src/ui/chase.js';
function fire(button,type,values={}){const e=new Event(type,{cancelable:true});Object.assign(e,values);button.dispatchEvent(e);}
test('holding a direction while pressing Hop and Dash delivers independent immediate actions',()=>{
 const hop=new EventTarget(),dash=new EventTarget();let jumps=0,bursts=0,running=true;
 wireChaseAction(hop,()=>jumps++,()=>running);wireChaseAction(dash,()=>bursts++,()=>running);
 fire(hop,'pointerdown',{button:0,pointerId:2});assert.equal(jumps,1);
 fire(dash,'pointerdown',{button:0,pointerId:3});assert.equal(bursts,1);
 fire(hop,'pointerup');fire(hop,'click',{detail:1});assert.equal(jumps,1,'A synthetic click must not consume a second midair flap');
 fire(dash,'click',{detail:1});assert.equal(bursts,1);
 running=false;fire(hop,'pointerdown',{button:0});fire(hop,'click',{detail:0});assert.equal(jumps,1);
});
test('native click, keyboard and assistive activation work without a preceding pointer event',async()=>{
 const hop=new EventTarget();let n=0;wireChaseAction(hop,()=>n++,()=>true);
 fire(hop,'click',{detail:1});fire(hop,'click',{detail:0});assert.equal(n,2);
 fire(hop,'pointerdown',{button:0});fire(hop,'pointerup');await new Promise(resolve=>setTimeout(resolve,5));
 fire(hop,'click',{detail:1});assert.equal(n,4,'A cancelled synthesized click cannot poison the next native click');
 fire(hop,'pointerdown',{button:2});assert.equal(n,4);
});
