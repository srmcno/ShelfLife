import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { advanceStories, storyState, currentCase, caseGate, advanceCase, acceptRequest, welcomeVisitor, VISIT_LENGTH, WEEK, relationship, brokerTruce, recordSharedPlot } from '../src/engine/stories.js';
import { activeFeuds } from '../src/engine/achievements.js';
import { artPersonality } from '../src/engine/personality.js';
import { decayRate } from '../src/engine/tick.js';
import { pairScore } from '../src/engine/behavior.js';
const now=new Date(2026,8,5,12).getTime();
function fixture(n=1){const s=blankState();s.lastTick=now;s.pets=Array.from({length:n},(_,i)=>({id:'p'+i,name:'Pet '+i,traits:[],needs:{food:60,fuss:60,clean:60},stats:{menace:2},bond:1,cared:0,handshakes:0,grudges:0}));s.pets.forEach((p,i)=>s.slots[i]=p.id);return s;}
test('a six-beat case requires real care, placement and confidence, with a cooperative payoff',()=>{
 const s=fixture();advanceStories(s,now);assert.equal(currentCase(s).beat,0);
 advanceCase(s,'listen',now);assert.equal(caseGate(s).ready,false);assert.equal(advanceCase(s,'listen',now),false);
 s.stories.careActions++;advanceCase(s,'listen',now);assert.equal(caseGate(s).ready,false);
 [s.slots[0],s.slots[6]]=[s.slots[6],s.slots[0]];advanceCase(s,'listen',now);advanceCase(s,'listen',now);
 assert.equal(caseGate(s).ready,false);s.stories.handshakes++;advanceCase(s,'listen',now);advanceCase(s,'listen',now);
 assert.equal(currentCase(s).beat,6);assert.equal(s.pets[0].bond,3);assert.equal(storyState(s).archive.length,1);
 assert.equal(advanceCase(s,'listen',now),false);advanceStories(s,now+WEEK);assert.equal(currentCase(s).beat,0);
});
test('unfinished weekly files persist and removal of a witness does not strand a case',()=>{
 const s=fixture(2);advanceStories(s,now);advanceCase(s,'listen',now);s.stories.careActions++;advanceCase(s,'listen',now);
 const kind=currentCase(s).kind;s.pets.shift();s.slots[0]=null;advanceStories(s,now+WEEK);
 assert.equal(currentCase(s).kind,kind);assert.equal(caseGate(s).ready,true);
});
test('care and choices change the final ending and rewards',()=>{
 const s=fixture();advanceStories(s,now);const c=s.stories.case;c.beat=5;c.choices=['blame','blame','blame','blame','blame'];
 s.pets[0].needs.clean=60;advanceCase(s,'blame',now);assert.equal(s.pets[0].bond,1);assert.equal(s.pets[0].needs.clean,72);
});
test('visitor welcome is idempotent, costs are explicit, and offline expiry never duplicates gifts',()=>{
 const s=fixture(18);advanceStories(s,now);assert.equal(s.slots.filter(Boolean).length,18);
 assert.equal(welcomeVisitor(s,'p0','crumbs',now),true);assert.equal(s.pets[0].needs.food,52);assert.equal(s.pets[0].bond,2);
 assert.equal(welcomeVisitor(s,'p0','tour',now),false);assert.equal(s.stories.collection.length,1);
 const loaded=normalizeState(s);advanceStories(loaded,now+VISIT_LENGTH);assert.equal(loaded.stories.visitor,null);assert.equal(loaded.stories.collection.length,1);
 advanceStories(loaded,now+VISIT_LENGTH);assert.equal(loaded.stories.visitor,null);
 advanceStories(loaded,now+VISIT_LENGTH+86400000);assert.ok(loaded.stories.visitor);assert.equal(loaded.pets.length,18);
});
test('visitors cannot consume food the host does not have; a tour remains available',()=>{
 const s=fixture();advanceStories(s,now);s.pets[0].needs.food=2;assert.equal(welcomeVisitor(s,'p0','crumbs',now),false);
 assert.equal(welcomeVisitor(s,'p0','tour',now),true);assert.equal(s.pets[0].needs.food,2);
});
test('requests reward the promised action once, refusal changes trust and memory, expiry is gentle',()=>{
 const s=fixture();advanceStories(s,now);assert.equal(acceptRequest(s,'p0',true,now),true);advanceStories(s,now);assert.equal(s.pets[0].bond,1);
 s.pets[0].careLog={food:1};advanceStories(s,now);assert.equal(s.pets[0].bond,2);assert.equal(s.pets[0].fulfilledRequests,1);
 advanceStories(s,now);assert.equal(s.pets[0].bond,2);
 advanceStories(s,now+6*3600000);assert.equal(s.stories.requests.p0.kind,'play');acceptRequest(s,'p0',false,now+6*3600000);
 assert.equal(s.pets[0].bond,1);assert.equal(s.pets[0].grudges,1);assert.equal(s.pets[0].refusedRequests,1);
 advanceStories(s,now+12*3600000);advanceStories(s,now+25*3600000);assert.equal(s.pets[0].bond,1);
});
test('adjacency grows friendship, two shared plots grow conspiracy, truces remove active unrest',()=>{
 const s=fixture(2);advanceStories(s,now);advanceStories(s,now+15*60000);
 assert.equal(relationship(s,...s.pets).label,'Friends');recordSharedPlot(s,'p0');recordSharedPlot(s,'p0');assert.equal(relationship(s,...s.pets).label,'Co-conspirators');
});
import { FEUDS } from '../src/content/feuds.js';
test('a mediated truce ends active feud indicators and preserves an uneasy alliance',()=>{
 const s=fixture(2);s.pets[0].traits=[FEUDS[0][0]];s.pets[1].traits=[FEUDS[0][1]];s.pets.forEach(p=>p.bond=3);
 assert.equal(activeFeuds(s).length,1);assert.equal(brokerTruce(s,'p0','p1',now),true);assert.equal(activeFeuds(s).length,0);
 assert.equal(relationship(s,...s.pets).label,'Uneasy allies');assert.equal(brokerTruce(s,'p0','p1',now),false);
});
test('drawn horns intimidate and halos ease neighbouring attention decay',()=>{
 const s=fixture(2),[a,b]=s.pets;const base=pairScore(s,a,b),rate=decayRate(a,'fuss',s);
 b.art={stamps:[{kind:'horns'}]};assert.equal(artPersonality(b).horns,true);assert.equal(pairScore(s,a,b),base-1.5);
 b.art={stamps:[{kind:'halo'}]};assert.equal(decayRate(a,'fuss',s),rate*.9);
});
test('old saves and malformed story containers recover without removing residents',()=>{
 const s=normalizeState({...fixture(),stories:{case:{kind:'bad'},visitor:{kind:'nope'},archive:[null],requests:{p0:null},collection:['bad'],postcards:[{image:'javascript:bad'}]}});
 advanceStories(s,now);assert.equal(s.pets.length,1);assert.ok(currentCase(s));assert.equal(s.stories.archive.length,0);assert.equal(s.stories.postcards.length,0);
});
test('case evidence survives rehoming the resident who earned it',()=>{
 const s=fixture(2);advanceStories(s,now);advanceCase(s,'listen',now);s.stories.careActions++;
 s.pets.shift();s.slots[0]=null;assert.equal(caseGate(s).ready,true);advanceCase(s,'listen',now);advanceCase(s,'listen',now);advanceCase(s,'listen',now);
 s.stories.handshakes++;assert.equal(caseGate(s).ready,true);
});

test('accepted prop, neighbour and room requests require the actual arrangement',()=>{
 for(const kind of ['prop','neighbor','room']){
  const s=fixture(2);advanceStories(s,now);
  s.stories.requests.p0={kind,status:'offered',at:now,target:kind==='neighbor'?'p1':kind==='prop'?'bowl':'parlor'};
  if(kind==='neighbor'){s.slots[1]=null;s.slots[5]='p1';}
  acceptRequest(s,'p0',true,now);advanceStories(s,now);assert.equal(s.pets[0].bond,1,kind);
  if(kind==='prop'){s.props=[{id:'bowl1',kind:'bowl'}];s.slots[1]='bowl1';s.slots[2]='p1';}
  if(kind==='neighbor'){s.slots[5]=null;s.slots[1]='p1';}
  if(kind==='room')s.decor.room='parlor';
  advanceStories(s,now);assert.equal(s.pets[0].bond,2,kind);assert.equal(s.stories.requests.p0,undefined,kind);
 }
});
import { careFor } from '../src/engine/care.js';
test('only useful individual care advances the persistent case evidence counter',()=>{
 const s=fixture();advanceStories(s,now);careFor(s,s.pets[0],'food',now);assert.equal(s.stories.careActions,1);
 careFor(s,s.pets[0],'food',now);assert.equal(s.stories.careActions,1);
 const loaded=normalizeState(s);advanceStories(loaded,now);assert.equal(loaded.stories.careActions,1);
});
test('corrupt relationship, memorial and request fields cannot strand an imported shelf',()=>{
 const s=fixture(2);s.stories={relationships:{'p0|p1':'bad'},residents:[{name:'Old one',names:7}],requests:{p0:{kind:'food',at:now,status:'accepted',baseline:'nope'}}};
 advanceStories(s,now);assert.deepEqual(s.stories.residents[0].names,[]);assert.equal(s.stories.requests.p0.baseline,0);
 assert.ok(relationship(s,...s.pets).label);
});
