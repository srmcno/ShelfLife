import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,normalizeState} from '../src/state.js';
import {rememberEcho,normalizeEchoes,householdAftermath} from '../src/household-echoes.js';
import {rugReaction} from '../src/content/rug-comedy.js';
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
test('callback text needs a real event and high-frequency lines avoid immediate repeats',()=>{
 const first=rugReaction({type:'return'},pet,[],[]);assert.notEqual(first.id,'coffin-refund');
 assert.equal(rugReaction({type:'return'},pet,[{kind:'miss',petId:'a'}],[]).id,'coffin-refund');
 const used=[];for(let i=0;i<6;i++){const line=rugReaction({type:'miss'},pet,[],used);assert.ok(!used.includes(line.id));used.push(line.id);}
 assert.match(rugReaction({type:'catch'},{...pet,traits:['feral']},[],[]).text,/mouth/);
});
