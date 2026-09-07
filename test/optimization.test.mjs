import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { generateCreature, customizeCreature, selectCreaturePart, normalizeCreature, resolveColors, buildRig, renderCreatureSVG } from '../src/art/creatures.js';
import { storyState, withStories, advanceStories, inviteVisitor, farewellVisitor, welcomeVisitor, INVITATION_REST } from '../src/engine/stories.js';
import { VISITORS } from '../src/content/stories.js';
import { newChase, updateChase, recordChase } from '../src/engine/chase.js';
import { newHandshake, tapHandshake, rewardHandshake } from '../src/engine/play.js';
import { newAlibi, answerAlibi, advanceAlibi } from '../src/engine/alibi.js';
const now = new Date(2026,8,7,12).getTime();
const pet = () => ({id:'p1', name:'Pip',traits:[],bond:3,born:now-1000,needs:{food:70,fuss:60,clean:70},careLog:{food:2,fuss:1,clean:3},art:{creature:generateCreature({seed:'optimise'})},stats:{mystique:3}});
function fixture() { const s=blankState();s.pets=[pet()];s.slots[0]='p1';s.lastTick=now;return s; }
function quietChase(options) {const p=pet(),g=newChase(p,options);for(const key of ['nextCrumb','nextBunny','nextMoth','nextBiscuit','nextSugar'])g[key]=100;return {p,g};}

test('fine details preserve parts, custom colours and current rig through choices and save restoration',()=>{
  const s=fixture(),p=s.pets[0],original=p.art.creature;
  const c=customizeCreature(original,{tune:{eyeScale:1.35,lean:-6},colors:{body:'#164D52',accent:'#EABBCB'}});
  assert.deepEqual(c.parts,original.parts);assert.deepEqual(original.colors,undefined);
  const changed=selectCreaturePart(c,'body','pear');
  assert.equal(changed.tune.eyeScale,1.35);assert.equal(resolveColors(changed).body,'#164D52');
  assert.notEqual(resolveColors(changed).bodyDark,resolveColors(original).bodyDark);
  assert.deepEqual(changed.rig,buildRig(changed));
  p.art.creature=changed;
  const restored=normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.pets[0].art.creature,changed);
  assert.match(renderCreatureSVG(restored.pets[0].art.creature),/#164D52/);
});
test('imported fine details cannot produce nonfinite transforms or inject SVG',()=>{
  const c=normalizeCreature({...generateCreature({seed:2}),tune:{eyeScale:Infinity,eyeSpread:-55,mouthScale:NaN,lean:500},colors:{body:'red"/><script>bad()</script>',accent:'#ABCDEF',unknown:'#123456'}});
  assert.deepEqual(c.tune,{eyeScale:1,eyeSpread:.75,mouthScale:1,lean:7});
  assert.deepEqual(c.colors,{accent:'#ABCDEF'});
  assert.doesNotMatch(renderCreatureSVG(c),/NaN|Infinity|<script/);
});
test('story batching shares checked data and always releases its validation scope',()=>{
  const s=fixture();
  withStories(s,checked=>{
    const archive=checked.archive;
    for(let i=0;i<30;i++)assert.equal(storyState(s).archive,archive);
    withStories(s,nested=>assert.equal(nested,checked));
  });
  assert.throws(()=>withStories(s,()=>{throw Error('cancel');}),/cancel/);
  s.stories.archive='corrupt';
  assert.deepEqual(storyState(s).archive,[]);
  const other=fixture();withStories(s,()=>assert.notEqual(storyState(other),storyState(s)));
});
test('original Madam Moth is restored and the expanded roster has twelve distinct designs',()=>{
  assert.equal(VISITORS.length,12);
  const moth=VISITORS.find(v=>v.id==='moth');assert.equal(moth.classic,true);
  const original=generateCreature({seed:'visitor-moth',parts:{wings:'moth',top:'antennae'}});
  assert.equal(original.body,'pear');
  const silhouettes=VISITORS.map(v=>{const c=generateCreature(v.classic?{seed:v.seed,parts:v.parts}:{seed:v.seed,body:v.body,palette:v.palette,parts:v.parts});return JSON.stringify([c.body,c.palette,c.parts]);});
  assert.equal(new Set(silhouettes).size,12);
});
test('calling cards respect active guests, saved cooldowns and the unrepeated visitor bag',()=>{
  const s=fixture();assert.equal(inviteVisitor(s,now,()=>.25),true);
  const first=s.stories.visitor.kind;
  assert.equal(inviteVisitor(s,now+1),false);assert.equal(farewellVisitor(s,now+2),false);
  assert.equal(welcomeVisitor(s,'p1','tour',now+3),true);assert.equal(farewellVisitor(s,now+4),true);
  assert.equal(inviteVisitor(s,now+5),false);
  const loaded=normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(inviteVisitor(loaded,now+INVITATION_REST-1),false);
  assert.equal(inviteVisitor(loaded,now+INVITATION_REST,()=>.25),true);
  assert.notEqual(loaded.stories.visitor.kind,first);
  assert.equal(loaded.stories.collection.length,1);
  assert.equal(inviteVisitor(blankState(),now),false);
});
test('welcoming more visitors does not bypass the existing daily bonus trust cap',()=>{
  const s=fixture();
  for(let i=0;i<6;i++){
    const t=now+i*INVITATION_REST;
    assert.ok(inviteVisitor(s,t,()=>.4));
    assert.ok(welcomeVisitor(s,'p1','crumbs',t));
    assert.ok(farewellVisitor(s,t+1));
  }
  assert.equal(s.pets[0].bond,6);assert.equal(s.stories.collection.length,6);
});
test('catching a carrying moth restores exactly one stolen crumb and advances the goal',()=>{
  const {g}=quietChase();g.caught=g.goal-1;
  g.items=[{id:1,kind:'moth',x:160,z:27,vx:0,age:0,carrying:true}];
  const events=updateChase(g,{},1/60);
  assert.equal(g.caught,g.goal);assert.equal(g.rescued,1);assert.equal(g.moths,1);
  assert.ok(events.some(e=>e.type==='catch'&&e.rescued));
  updateChase(g,{},.2);assert.equal(g.rescued,1);
});
test('rotating chase objectives pay once and never change the win requirement',()=>{
  const {g}=quietChase({objective:'biscuit'});
  g.items=[{id:1,kind:'biscuit',x:160,z:27,vy:0,age:0}];
  const events=updateChase(g,{},1/60);
  assert.equal(g.score,90);assert.equal(g.objective.done,true);assert.equal(g.caught,0);
  assert.equal(events.filter(e=>e.type==='objective').length,1);
  assert.equal(updateChase(g,{},.2).filter(e=>e.type==='objective').length,0);
  assert.equal(g.complete,false);
});
test('dust reports the actual loss and distinguishes horns from high-trust protection',()=>{
  const {g}=quietChase();g.score=2;
  const bunny=()=>({id:1,kind:'bunny',x:160,z:10,vx:1,age:0});
  g.items=[bunny()];const e=updateChase(g,{},1/60).find(e=>e.type==='bump');
  assert.equal(e.loss,2);assert.equal(g.score,0);
  const guarded=quietChase().g;guarded.horns=true;guarded.shield=2;
  for(const source of ['horns','trust']){
    guarded.player.x=160;guarded.player.invincible=0;guarded.items=[bunny()];
    assert.equal(updateChase(guarded,{},1/60).find(e=>e.type==='shield').source,source);
  }
  assert.equal(guarded.horns,true);
});
test('chase records compare like difficulty while preserving historical overall best',()=>{
  const {p,g}=quietChase({gentle:true});g.finished=true;g.caught=12;g.score=500;recordChase(p,g,now);
  const standard=newChase(p);standard.finished=true;standard.caught=8;standard.score=200;recordChase(p,standard,now);
  assert.equal(p.chaseBest.score,500);assert.equal(p.chaseRecords.gentle.score,500);assert.equal(p.chaseRecords.standard.score,200);
  const s=fixture();s.pets=[p];const restored=normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.pets[0].chaseRecords,p.chaseRecords);
});
test('Encore grows to six gestures, retries retain rounds, and practice can improve records without rewards',()=>{
  const s=fixture(),p=s.pets[0],g=newHandshake(p,()=>.3,{encore:true});
  assert.equal(g.sequence.length,6);
  tapHandshake(g,1);tapHandshake(g,1);assert.equal(g.round,1);
  tapHandshake(g,2);assert.equal(g.round,1);assert.equal(g.mistakes,1);
  while(!g.complete)for(const i of g.sequence.slice(0,g.round+2))tapHandshake(g,i);
  assert.equal(rewardHandshake(s,g,now).practice,false);assert.equal(p.handshakeBest.encore.mistakes,1);
  const bond=p.bond,fuss=p.needs.fuss;
  const clean=newHandshake(p,()=>.3,{encore:true});
  while(!clean.complete)for(const i of clean.sequence.slice(0,clean.round+2))tapHandshake(clean,i);
  assert.equal(rewardHandshake(s,clean,now).practice,true);assert.equal(p.handshakeBest.encore.mistakes,0);
  assert.equal(p.bond,bond);assert.equal(p.needs.fuss,fuss);assert.equal(rewardHandshake(s,clean,now),null);
});
test('Alibi notebook is a frozen record and contains a factual correction for every lie',()=>{
  const s=fixture();s.pets.push({...pet(),id:'p2',name:'Old Crumb',born:now-20000});s.slots[1]='p2';
  for(let seed=0;seed<30;seed++){
    let x=seed+1;const rng=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
    const g=newAlibi(s,s.pets[0],rng),book=[...g.notebook];assert.equal(g.rounds.length,3);
    for(const round of g.rounds)assert.ok(!round.evidence.startsWith('That claim does not match'));
    s.pets[0].careLog.food++;assert.deepEqual(g.notebook,book);
    for(const round of g.rounds){answerAlibi(g,round.lie);advanceAlibi(g);}
    assert.equal(g.correct,3);
  }
});
