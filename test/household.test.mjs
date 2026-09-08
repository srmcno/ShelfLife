import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { advanceStories, storyState, chooseRequest, acceptRequest, welcomeVisitor, caseGate, advanceCase, VISIT_LENGTH, VISIT_GAP_MIN, VISIT_GAP_MAX } from '../src/engine/stories.js';
import { observationLines, contextualCare, contextualExchanges } from '../src/engine/observations.js';
import { VISITORS } from '../src/content/stories.js';
import { OBSERVATIONS, CARE_CONTEXT } from '../src/content/observations.js';
import { generateCreature, SLOTS } from '../src/art/creatures.js';
import { rewardAlibi } from '../src/engine/alibi.js';
import { incidentProgress, checkAchievements } from '../src/engine/achievements.js';
const now = new Date(2026,8,7,12).getTime();
function fixture() {
  const s = blankState(); s.lastTick = now;
  s.pets = ['a','b'].map(id => ({id, name:id, traits:[], needs:{food:60,fuss:60,clean:60}, bond:0, cared:0, careLog:{food:0,fuss:0,clean:0}, stats:{cute:5,menace:5,damp:5,mystique:5}, grudges:0}));
  s.slots[0]='a'; s.slots[5]='b'; return s;
}
test('the saved visitor bag visits everyone once and never repeats across its seam', () => {
  let s=fixture(), t=now; const seen=[];
  for (let i=0;i<VISITORS.length+2;i++) {
    advanceStories(s,t,()=>.25);
    const v=s.stories.visitor; assert.ok(v); seen.push(v.kind);
    if(i) assert.notEqual(seen[i],seen[i-1]);
    assert.equal(v.returning,i>=VISITORS.length);
    assert.equal(welcomeVisitor(s,'a','tour',t),true);
    assert.equal(welcomeVisitor(s,'a','tour',t),false);
    assert.ok(s.stories.visitor.response.includes(VISITORS.find(d=>d.id===v.kind).tour));
    t+=VISIT_LENGTH; advanceStories(s,t,()=>.25);
    assert.equal(s.stories.visitor,null);
    assert.ok(s.stories.nextVisitAt >= t+VISIT_GAP_MIN && s.stories.nextVisitAt <= t+VISIT_GAP_MAX);
    t=s.stories.nextVisitAt;
    s=normalizeState(JSON.parse(JSON.stringify(s)));
  }
  assert.equal(new Set(seen.slice(0,VISITORS.length)).size,VISITORS.length);
  assert.equal(s.stories.collection.length,VISITORS.length);
});
test('offline absence expires one caller and schedules a future visit without a catch-up flood',()=>{
  const s=fixture(); advanceStories(s,now,()=>0);
  advanceStories(s,now+90*86400000,()=>0);
  assert.equal(s.stories.visitor,null); assert.equal(s.stories.visitCount,1);
  assert.equal(s.stories.archive.filter(x=>x.kind==='visitor').length,1);
  advanceStories(s,now+90*86400000,()=>0); assert.equal(s.stories.visitCount,1);
});
test('imported visitor records are deduplicated and corrupt shuffle entries are discarded',()=>{
  const s=fixture(); s.stories={collection:[{id:'moth'},{id:'moth'},{id:'bad'}],visitBag:['bad','moth','moth'],visitStats:{bad:{visits:5},moth:{visits:Infinity,welcomes:'oops'}}};
  storyState(s); assert.equal(s.stories.collection.length,1);assert.deepEqual(s.stories.visitBag,['moth']);
  advanceStories(s,now,()=>0);assert.equal(s.stories.visitor.kind,'moth');
  assert.equal(s.stories.visitStats.moth.visits,1);
});
test('urgent needs override routine requests; full needs and satisfied arrangements are never proposed',()=>{
  const s=fixture(),p=s.pets[0]; p.fulfilledRequests=19;p.needs.clean=8;
  assert.equal(chooseRequest(s,p).kind,'clean');
  p.needs={food:100,fuss:100,clean:100};s.decor.room='parlor';s.slots[5]=null;s.slots[1]='b';
  s.props=[{id:'bowl1',kind:'bowl'}];s.slots[6]='bowl1';
  // This prop is on the other row, so remains an eligible change.
  for(let i=0;i<15;i++){p.fulfilledRequests=i;assert.ok(['play','prop'].includes(chooseRequest(s,p).kind));}
});
test('every care request uses its own counter and pays only once',()=>{
  for(const kind of ['food','fuss','clean']){
    const s=fixture(),p=s.pets[0];advanceStories(s,now);
    s.stories.requests.a={kind,status:'offered',at:now};acceptRequest(s,'a',true,now);
    p.careLog[kind==='food'?'fuss':'food']++;advanceStories(s,now);assert.equal(p.bond,0);
    p.careLog[kind]++;advanceStories(s,now);advanceStories(s,now);assert.equal(p.bond,1);assert.equal(p.fulfilledRequests,1);
  }
});
test('a new play promise accepts any game win and an old handshake promise migrates without a free reward',()=>{
  for(const counter of ['handshakes','chases','alibiWins']){
    const s=fixture(),p=s.pets[0];p.chases=4;advanceStories(s,now);
    s.stories.requests.a={kind:'play',status:'accepted',at:now,baseline:0};
    advanceStories(s,now);assert.equal(p.bond,0);
    p[counter]=(p[counter]||0)+1;advanceStories(s,now);assert.equal(p.bond,1);
  }
});
test('Alibi clean wins, including practice, advance evidence; losing testimony does not',()=>{
  for(const correct of [0,2,3]){
    const s=fixture(),p=s.pets[0];advanceStories(s,now);advanceCase(s,'listen',now);
    const game={petId:p.id,complete:true,correct,rounds:[{},{},{}]};
    rewardAlibi(s,game,now);assert.equal(caseGate(s).ready,correct===3);
    assert.equal(p.alibiWins||0,correct===3?1:0);
    assert.equal(rewardAlibi(s,game,now),null);
  }
  const s=fixture(),p=s.pets[0];advanceStories(s,now);advanceCase(s,'listen',now);p.lastPlayed=now;p.playedAt={alibi:now};
  assert.equal(rewardAlibi(s,{petId:'a',complete:true,correct:3,rounds:[{},{},{}]},now).practice,true);
  assert.equal(caseGate(s).ready,true);
});
test('contextual notes and dialogue only claim facts currently supported by the save',()=>{
  const s=fixture(),p=s.pets[0];assert.deepEqual(observationLines(s,p,now),[]);assert.deepEqual(contextualExchanges(s,p,now),[]);
  p.needs.food=10;let lines=observationLines(s,p,now);assert.equal(lines.length,OBSERVATIONS.hungry.length);
  assert.deepEqual(contextualCare(s,p,'food',now),CARE_CONTEXT.food.urgent);
  p.needs.food=100;p.grudges=7;p.names=[{name:'Old Name'},{name:'a'}];p.alibis=5;
  lines=observationLines(s,p,now);assert.ok(lines.some(x=>x.includes('7 grievances')));assert.ok(lines.some(x=>x.includes('Old Name')));assert.ok(!lines.some(x=>x.includes('Alibi')));
  p.alibiWins=1;assert.ok(observationLines(s,p,now).some(x=>x.includes('Alibi')));
  storyState(s).requests.a={kind:'food',status:'accepted',at:now};
  assert.deepEqual(contextualCare(s,p,'food',now),CARE_CONTEXT.food.promised);
  assert.ok(!observationLines(s,p,now+12*3600000).some(x=>x.includes('accepted promise')));
});
test('visitor art uses real variants and each guest has complete arrival, return, and choice writing',()=>{
  for(const d of VISITORS){
    const c=generateCreature({seed:d.seed,body:d.body,palette:d.palette,parts:d.parts});
    if (d.classic) assert.deepEqual(c, generateCreature({seed:d.seed,parts:d.parts}));
    else { assert.equal(c.body,d.body);assert.equal(c.palette,d.palette); }
    for(const [slot,id] of Object.entries(d.parts)){assert.ok(SLOTS[slot]?.lib[id],d.id+': '+slot);assert.equal(c.parts[slot],id);}
    for(const key of ['line','returnLine','crumbs','tour'])assert.ok(typeof d[key]==='string'&&d[key].length>20,d.id+': '+key);
  }
});
test('the full souvenir achievement needs the whole current cast, not duplicate entries',()=>{
  const s=fixture();storyState(s).collection=Array.from({length:VISITORS.length},()=>({id:'moth'}));
  checkAchievements(s,now);assert.ok(!s.achievements.includes('all-visitors'));
  s.stories.collection=VISITORS.map(v=>({id:v.id}));checkAchievements(s,now);assert.ok(s.achievements.includes('all-visitors'));
  assert.equal(incidentProgress(s,'all-visitors').need,VISITORS.length);
});
