import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {rememberEcho,normalizeEchoes,householdAftermath} from '../src/household-echoes.js';
const now=Date.now();const pet={id:'a',name:'Agnes',traits:[],art:{body:'',stamps:[]},needs:{food:80,fuss:80,clean:80},bond:0,cared:0};
test('true aftermath survives reload without altering names, art, or slots',()=>{
 const s=blankState();s.pets=[structuredClone(pet)];s.slots[0]='a';const before=structuredClone(s.pets[0].art);
 assert.equal(householdAftermath(s),null);rememberEcho(s,'miss','a','throw-1',now);
 assert.match(householdAftermath(s).text,/coffin invoice/);const loaded=normalizeState(JSON.parse(JSON.stringify(s)));
 assert.equal(loaded.householdEchoes.events.length,1);assert.deepEqual(loaded.pets[0].art,before);assert.equal(loaded.slots[0],'a');
 assert.equal(rememberEcho(loaded,'miss','a','throw-1',now),false);
});
test('events are bounded and rapid repeated outcomes do not spam the household',()=>{
 const s=blankState();s.pets=[pet];for(let i=0;i<100;i++)rememberEcho(s,'miss','a','t'+i,now+i);
 assert.equal(s.householdEchoes.events.length,1);for(let i=1;i<50;i++)rememberEcho(s,'miss','a','slow'+i,now+i*31000);
 assert.equal(s.householdEchoes.events.length,24);assert.equal(normalizeEchoes(s.householdEchoes,[],now+2e6).events.length,0);
});
test('saved aftermath retains court roles and does not invent a haul or a biscuit crime',()=>{
 for(const variant of ['convicted','witness',null]){
  const s=blankState();s.pets=[structuredClone(pet)];s.slots[0]='a';
  rememberEcho(s,'court',pet.id,'case-'+variant,now,variant);
  const loaded=normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(loaded.householdEchoes.events[0].variant,variant||undefined);
  const aftermath=householdAftermath(loaded);
  assert.doesNotMatch(aftermath.text,/biscuit/);
  if(variant==='convicted')assert.match(aftermath.text,/conviction/);
  else assert.doesNotMatch(aftermath.text,/conviction|apologiz/);
 }
 const s=blankState();s.pets=[structuredClone(pet)];s.slots[0]='a';
 rememberEcho(s,'expedition',pet.id,'empty-handed',now);
 assert.doesNotMatch(householdAftermath(s).text,/recovered objects|parts|treasure/);
});
test('a household saved with the retired play rug loads without it and keeps what it earned',()=>{
 const s=blankState();s.pets=[structuredClone(pet)];s.slots[0]='a';
 s.rug={version:1,residents:[{petId:'a',tricks:[{id:'first-catch',at:now-5000}]}]};
 s.life.awards.push('rug:a:first-catch');s.life.xp+=1;
 s.householdEchoes={version:1,openingDone:true,callbacks:['a:convict-ball'],events:[{id:'throw-1',kind:'catch',petId:'a',at:now-5000}]};
 const loaded=normalizeState(JSON.parse(JSON.stringify(s)));
 assert.equal('rug' in loaded,false);assert.equal('callbacks' in loaded.householdEchoes,false);
 assert.ok(loaded.life.awards.includes('rug:a:first-catch'));assert.equal(loaded.life.xp,s.life.xp);
 assert.match(householdAftermath(loaded).text,/Agnes/);assert.equal('rug' in blankState(),false);
});
