import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { generateCreature, customizeCreature, selectCreaturePart, normalizeCreature, resolveColors, buildRig, renderCreatureSVG } from '../src/art/creatures.js';
import { storyState, withStories, advanceStories, inviteVisitor, farewellVisitor, welcomeVisitor, INVITATION_REST } from '../src/engine/stories.js';
import { VISITORS } from '../src/content/stories.js';
const now = new Date(2026,8,7,12).getTime();
const pet = () => ({id:'p1', name:'Pip',traits:[],bond:3,born:now-1000,needs:{food:70,fuss:60,clean:70},careLog:{food:2,fuss:1,clean:3},art:{creature:generateCreature({seed:'optimise'})},stats:{mystique:3}});
function fixture() { const s=blankState();s.pets=[pet()];s.slots[0]='p1';s.lastTick=now;return s; }
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