import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wireChaseAction, createChaseInput} from '../src/ui/chase.js';
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
test('native click and assistive activation work; delayed touch clicks do not repeat an action',async()=>{
 const hop=new EventTarget();let n=0;wireChaseAction(hop,()=>n++,()=>true);
 fire(hop,'click',{detail:1});fire(hop,'click',{detail:0});assert.equal(n,2);
 fire(hop,'pointerdown',{button:0});fire(hop,'pointerup');await new Promise(resolve=>setTimeout(resolve,5));
 fire(hop,'click',{detail:1});assert.equal(n,3,'A delayed compatibility click must not become a second flap');
 fire(hop,'click',{detail:1});assert.equal(n,4,'The consumed click does not block a later independent activation');
 fire(hop,'pointerdown',{button:2});assert.equal(n,4);
 fire(hop,'pointerdown',{button:0});fire(hop,'pointercancel');fire(hop,'click',{detail:0});assert.equal(n,6,'Assistive activation works after a cancelled touch');
});
test('held directions remain independent across keys and simultaneous touch controls',()=>{
 const input=createChaseInput();
 input.hold('key:ArrowLeft','left');input.hold('pointer:1','left');assert.equal(input.axis,-1);
 input.release('pointer:1');assert.equal(input.axis,-1,'Releasing the thumb must keep the arrow key held');
 input.hold('key:KeyA','left');input.release('key:ArrowLeft');assert.equal(input.axis,-1,'Releasing one left key keeps the other key held');
 input.hold('pointer:2','right');assert.equal(input.axis,0,'Opposite controls cancel while both are held');
 input.release('key:KeyA');assert.equal(input.axis,1);
 input.release('pointer:99');assert.equal(input.axis,1,'An unrelated pointer cancellation must not change movement');
 input.clear();assert.equal(input.axis,0,'Pausing clears every input source');
});
