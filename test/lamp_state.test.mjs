import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { decayRate } from '../src/engine/tick.js';
import { useProp, aversionPhase, slotScore } from '../src/engine/behavior.js';

function shelf(traits=[]){
 const state=blankState();
 const pet={id:'p',name:'Pip',traits,needs:{food:50,fuss:40,clean:50},stats:{damp:5},bond:0};
 const lamp={id:'lamp',kind:'lamp'};
 state.pets=[pet];state.props=[lamp];state.slots[0]='p';state.slots[1]='lamp';
 state.theatre={lamps:{lamp:false}};
 return {state,pet,lamp};
}
test('an off lamp has neither a calming aura nor a nocturnal light penalty',()=>{
 for(const traits of [[],['nocturnal']]){
  const {state,pet}=shelf(traits),off=decayRate(pet,'fuss',state);
  state.slots[1]=null;
  assert.equal(off,decayRate(pet,'fuss',state));
  state.slots[1]='lamp';state.theatre.lamps.lamp=true;
  assert.ok(Math.abs(decayRate(pet,'fuss',state)-off*.8*(traits.length?1.5:1))<1e-9);
 }
});
test('the legacy behaviour pass cannot use or resent an unlit lamp',()=>{
 const {state,pet,lamp}=shelf(['nocturnal']),now=new Date(2026,8,10,23).getTime();
 assert.deepEqual(useProp(state,pet,lamp,now),{outcome:'off',gain:0});
 assert.equal(pet.needs.fuss,40);assert.equal(aversionPhase(state,now),null);
 const besideOff=slotScore(state,pet,0,now);state.slots[1]=null;
 assert.equal(besideOff,slotScore(state,pet,0,now));
});
test('lamp switch and autoplay preference survive restore; absent lamps stay lit by default',()=>{
 const {state}=shelf();state.settings.theatreOn=false;
 const restored=normalizeState(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.theatre.lamps.lamp,false);assert.equal(restored.settings.theatreOn,false);
 delete state.theatre;state.settings.theatreOn='invalid';
 const legacy=normalizeState(state);assert.equal(legacy.theatre.lamps.lamp,undefined);assert.equal(legacy.settings.theatreOn,true);
});
