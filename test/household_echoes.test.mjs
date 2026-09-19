import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {rememberEcho,rememberRugLine,normalizeEchoes,householdAftermath} from '../src/household-echoes.js';
import {rugReaction} from '../src/content/rug-comedy.js';
const now=Date.now();const pet={id:'a',name:'Agnes',traits:[],art:{body:'',stamps:[]},needs:{food:80,fuss:80,clean:80},bond:0,cared:0};
test('the same real rug interaction after a module reload creates a new persistent aftermath',async()=>{
 const s=blankState();s.pets=[structuredClone(pet)];s.slots[0]='a';
 const engines=await Promise.all([import('../src/engine/play-rug.js?first-page'),import('../src/engine/play-rug.js?reloaded-page')]);
 let state=s;
 for(const [i,engine] of engines.entries()){
  const g=engine.createRug(pet);engine.tossPreset(g);
  const events=Array.from({length:600},()=>engine.updateRug(g,1/60)).flat();const caught=events.find(e=>e.type==='catch');assert.ok(caught);
  assert.equal(rememberEcho(state,'catch',pet.id,caught.id,now-60000+i*31000),true);
  assert.equal(rememberEcho(state,'catch',pet.id,caught.id,now-29000),false,'same receipt stays deduplicated');
  state=normalizeState(JSON.parse(JSON.stringify(state)));
 }
 assert.equal(state.householdEchoes.events.length,2);
});
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
test('callback text needs a real event and high-frequency lines avoid immediate repeats',()=>{
 const first=rugReaction({type:'return'},pet,[],[]);assert.notEqual(first.id,'coffin-refund');
 assert.equal(rugReaction({type:'return'},pet,[{kind:'miss',petId:'a'}],[]).id,'coffin-refund');
 const used=[];for(let i=0;i<6;i++){const line=rugReaction({type:'miss'},pet,[],used);assert.ok(!used.includes(line.id));used.push(line.id);}
 assert.match(rugReaction({type:'catch'},{...pet,traits:['feral']},[],[]).text,/mouth/);
});
test('rug callbacks distinguish a convicted resident from witnesses and other residents',()=>{
 const caught={type:'catch'};
 for(const facts of [[{kind:'court',petId:'b',variant:'convicted'}],[{kind:'court',petId:'a',variant:'witness'}],[{kind:'court',petId:'a'}]])assert.notEqual(rugReaction(caught,pet,facts,[]).id,'convict-ball');
 assert.equal(rugReaction(caught,pet,[{kind:'court',petId:'a',variant:'convicted'}],[]).id,'convict-ball');
 assert.notEqual(rugReaction(caught,pet,[{kind:'court',petId:'a',variant:'convicted'},{kind:'bath',petId:'a'}],[]).id,'convict-ball','no hat reference when the bath cup has replaced it on the rug');
 assert.notEqual(rugReaction({type:'refuse'},pet,[{kind:'market',petId:'a'},{kind:'expedition',petId:'a'}],[]).id,'market-break');
 assert.notEqual(rugReaction({type:'pop'},pet,[{kind:'bath',petId:'b'}],[]).id,'bath-bubble');
});
test('read rug lines survive reload and stay bounded without changing rewards',()=>{
 const s=blankState();s.pets=[structuredClone(pet)];s.slots[0]='a';
 const first=rugReaction({type:'catch'},pet);
 rememberRugLine(s,pet.id,first.id);
 const loaded=normalizeState(JSON.parse(JSON.stringify(s)));
 const used=loaded.householdEchoes.callbacks.map(key=>key.slice(2));
 assert.notEqual(rugReaction({type:'catch'},pet,[],used).id,first.id);
 for(let i=0;i<40;i++)rememberRugLine(loaded,pet.id,'line-'+i);
 assert.equal(loaded.householdEchoes.callbacks.length,24);
 assert.equal(loaded.life.xp,s.life.xp);
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
