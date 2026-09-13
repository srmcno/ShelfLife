import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { statementsFor, newAlibi, answerAlibi, advanceAlibi, rewardAlibi, alibiReaction } from '../src/engine/alibi.js';
import { startCourt, currentCourt, courtAction, finishCourt, courtEvidence, courtComparisonState, courtPersonalAside } from '../src/engine/court.js';
import { courtMatrixMarkup, courtMarkup } from '../src/ui/court.js';

const now = new Date(2026, 8, 13, 12).getTime();
function fixture(count = 4) {
  const state = blankState(); state.lastTick = now;
  state.pets = Array.from({length: count}, (_, i) => ({id:'p'+i,name:['Dot','Little Bastard','Aunt Bone','Moss'][i],traits:[],stats:{cute:4,menace:4,damp:4,mystique:4},art:{},needs:{food:60,fuss:60,clean:60},born:now-10000+i,bond:0,careLog:{food:0,clean:0,fuss:0}}));
  state.pets.forEach((p, i) => {state.slots[i] = p.id;}); return state;
}
function inspect(state) {
  for(const evidence of [0,1,2]) courtAction(state, {type:'inspect',evidence});
}
test('comparison matrix never reveals untested deductions or sealed compound evidence', () => {
  const state = fixture(), game = startCourt(state, {level:2,reworked:true}, () => .37);
  for(let s=0;s<game.suspects.length;s++) for(let e=0;e<game.rules.length;e++) assert.equal(courtComparisonState(game,s,e),'unknown');
  inspect(state);
  let current=currentCourt(state);
  assert.equal((courtMatrixMarkup(current).match(/state-unknown/g)||[]).length,game.suspects.length*game.rules.length);
  assert.equal(courtComparisonState(current,game.answer,0),'unknown','Inspection alone does not solve a row');
  courtAction(state,{type:'compare',suspect:game.answer,evidence:0});
  current=currentCourt(state);assert.equal(courtComparisonState(current,game.answer,0),'compatible');
  assert.equal(courtComparisonState(current,game.answer,1),'unknown');
  const innocent=(game.answer+1)%game.suspects.length,failed=courtEvidence(game,innocent).findIndex(fit=>!fit);
  courtAction(state,{type:'compare',suspect:innocent,evidence:failed});
  current=currentCourt(state);assert.equal(courtComparisonState(current,innocent,failed),'contradictory');
  current.ui.witness=innocent;
  assert.match(courtMarkup(current),/court-stage phase-relief/,'A cleared innocent reacts with relief, not a guilty collapse');
  const untouched=game.rules.findIndex((_,i)=>i!==failed);assert.equal(courtComparisonState(current,innocent,untouched),'unknown','Clearing one clue does not reveal the rest of their row');
  const restored=currentCourt(normalizeState(structuredClone(state)));
  assert.equal(courtComparisonState(restored,innocent,failed),'contradictory');
  assert.equal(courtComparisonState(restored,game.answer,0),'compatible');
});
test('a wrong accusation remembers only the contradiction actually explained by the appeal', () => {
  const state=fixture(),game=startCourt(state,{level:2,reworked:true},()=>.66);inspect(state);
  const innocent=(game.answer+1)%game.suspects.length,failed=courtEvidence(game,innocent).findIndex(fit=>!fit);
  assert.equal(finishCourt(state,innocent,now).retry,true);
  const current=currentCourt(state);
  assert.equal(courtComparisonState(current,innocent,failed),'contradictory');
  assert.equal(courtComparisonState(current,game.answer,failed),'unknown');
});
test('court remembers the actual culprit and host, never the first two unrelated residents', () => {
  const state=fixture(),game=startCourt(state,{petId:'p3',reworked:true},()=>.71);inspect(state);
  const result=finishCourt(state,game.answer,now);assert.equal(result.correct,true);
  const expected=[...new Set([game.suspects[game.answer].id,'p3'])];
  const scene=state.life.scenes.find(s=>s.kind==='court');assert.deepEqual(scene.cast,expected);
  const sceneCount=state.life.scenes.length;assert.equal(finishCourt(state,game.answer,now),null);assert.equal(state.life.scenes.length,sceneCount);
  const next=startCourt(state,{petId:'p3',reworked:true},()=>.38);
  assert.match(next.suspects.find(s=>s.id==='p3').memory,/I remember/);
  const unrelated=state.pets.find(p=>!expected.includes(p.id));assert.equal(courtPersonalAside(state,unrelated),'');
});
test('court witness memory is factual, escaped in markup, and frozen across renaming and restore', () => {
  const state=fixture(),pet=state.pets[0];pet.names=[{name:'<Old Bone>',at:now-1000},{name:'Dot',at:now}];
  const game=startCourt(state,{level:1,reworked:true},()=>.48),memory=game.suspects.find(s=>s.id===pet.id).memory;
  assert.match(memory,/<Old Bone>/);
  pet.names.push({name:'New Bone',at:now});pet.name='New Bone';
  const restored=currentCourt(normalizeState(structuredClone(state)));
  assert.equal(restored.suspects.find(s=>s.id===pet.id).memory,memory);
  assert.deepEqual(restored.rules,game.rules);assert.equal(restored.answer,game.answer);
  const old=structuredClone(state);for(const p of old.life.court.cast)delete p.memory;
  assert.ok(currentCourt(normalizeState(old)),'Older cast snapshots without memories still resume');
  const forged=structuredClone(state);forged.life.court.cast[0].memory='x'.repeat(2000);
  assert.equal(normalizeState(forged).life.court.cast[0].memory.length,360);
  game.suspects[0].name='<script>alert(1)</script>';
  assert.ok(!courtMatrixMarkup(game).includes('<script>'));
});
test('Alibi history contradictions require real recorded care, requests, company and incidents', () => {
  const state=fixture(),pet=state.pets[0];
  const fresh=statementsFor(state,pet);
  for(const key of ['care-pattern','journeys','kept-request','refused-request','incident','company']) assert.ok(!fresh.truths.some(t=>t.key===key));
  pet.careLog={food:8,clean:3,fuss:2};pet.expeditions=2;pet.fulfilledRequests=3;pet.refusedRequests=1;
  state.life.scenes=[{id:1,kind:'court',title:'The missing tooth',text:'A hearing.',cast:[pet.id],at:now}];
  state.stories={relationships:{'p0|p1':{time:0,plots:2}}};
  const facts=statementsFor(state,pet);
  assert.match(facts.truths.find(t=>t.key==='care-pattern').text,/fed me more often/);
  assert.match(facts.truths.find(t=>t.key==='journeys').text,/2 times/);
  assert.match(facts.truths.find(t=>t.key==='company').text,/Little Bastard and I have 2/);
  assert.match(facts.truths.find(t=>t.key==='incident').text,/The missing tooth/);
  const game=newAlibi(state,pet,()=>.43,{mode:'prove'}),first=game.rounds[0];
  assert.ok(['care-pattern','journeys','kept-request','refused-request','incident','company'].includes(first.keys[first.lie]));
  assert.equal(new Set(game.rounds.flatMap(r=>r.keys)).size,game.rounds.length*3);
  const snapshot=structuredClone(game);pet.careLog.food=0;state.life.scenes=[];
  assert.deepEqual(game,snapshot,'Evidence stays frozen while the shelf changes');
  for(const round of game.rounds){assert.equal(answerAlibi(game,round.lie,round.proof),'right');advanceAlibi(game);}
  const reward=rewardAlibi(state,game,now);assert.equal(reward.clean,true);const bond=pet.bond;
  assert.equal(rewardAlibi(state,game,now),null);assert.equal(pet.bond,bond);
});
test('Alibi warmth can match a resident trait while preserving the actual exposed fact', () => {
  const round={keys:['shake'],lie:0};
  assert.match(alibiReaction(round,{traits:['clingy']}),/hand closer/);
  assert.match(alibiReaction(round,{traits:[]}),/gesture/);
});
