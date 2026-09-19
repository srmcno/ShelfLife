import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {rememberEcho,normalizeEchoes,householdAftermath} from '../src/household-echoes.js';
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
