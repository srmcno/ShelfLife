import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { welcomeView, unpackWelcome, chooseWelcome, welcomeScene } from '../src/engine/welcome.js';
import { welcomeRewardLabel } from '../src/ui/welcome.js';
import { lifeState } from '../src/engine/life.js';
import { depleteProp, REFILL_MS, isSpent } from '../src/engine/behavior.js';
import { sceneDirection } from '../src/content/scenes.js';
const noon=new Date(2026,8,12,12).getTime(),night=new Date(2026,8,12,22).getTime();
function fresh(traits=[]) {
  const s=blankState();s.started=noon;s.lastTick=noon;s.life.introStarted=true;
  s.pets=[{id:'first',name:'Pip',traits,bond:0,needs:{food:78,fuss:78,clean:82},art:{body:'',stamps:[]}}];s.slots[0]='first';
  return normalizeState(s);
}
const roundTrip=s=>normalizeState(JSON.parse(JSON.stringify(s)));

test('the first incident requires two explicit choices and no timer, trust or permanent second-resident gate',()=>{
  let s=fresh();assert.equal(welcomeView(s,noon).stage,'offered');
  assert.equal(unpackWelcome(s,noon+5000),true);assert.equal(s.props.length,1);assert.equal(s.props[0].kind,'bowl');
  assert.equal(unpackWelcome(s,noon+5001),false,'double tap cannot duplicate the housewarming furniture');
  s=roundTrip(s);assert.equal(welcomeView(s,noon+10000).stage,'ready');
  const preview=welcomeView(s,noon+10000).rewards.share;
  const result=chooseWelcome(s,'share',noon+15000);
  assert.deepEqual({food:result.food,fuss:result.fuss,discovery:result.discovery},preview);
  assert.equal(s.life.introDone,true);assert.equal(s.pets.length,1,'Madam Moth is a temporary actor, not a permanent household member');
  assert.equal(result.scene.stage.guest,'moth');assert.deepEqual(result.scene.cast,['first']);
  assert.equal(s.behavior.props[s.props[0].id].uses,1,'one actual serving was consumed');
  const saved=JSON.stringify(s);assert.equal(chooseWelcome(s,'keep',noon+16000),null);assert.equal(JSON.stringify(s),saved);
  const replay=roundTrip(s);assert.equal(welcomeView(replay,noon+20000).stage,'finished');assert.equal(replay.life.scenes[0].text,result.scene.text);
  assert.equal(chooseWelcome(replay,'share',noon+20000),null,'reload cannot reclaim the first-bite rewards');
});

test('sleeping residents use valid clock values, half care and the original sleeping scene after nightfall',()=>{
  let s=fresh(['nocturnal']);assert.equal(welcomeView(s,noon).asleep,true);
  unpackWelcome(s,noon);assert.match(welcomeView(s,noon).line,/asleep/);
  const preview=welcomeView(s,noon).rewards.share;assert.deepEqual(preview,{food:3,fuss:4,discovery:1});
  const result=chooseWelcome(s,'share',noon);assert.equal(result.food,3);assert.equal(result.fuss,4);
  s=roundTrip(s);assert.equal(welcomeView(s,night).asleep,true,'finished scene keeps the recorded state, not the current clock');
  s.pets[0].traits=[];
  assert.equal(welcomeScene(s,night).stage.object,'sleepy','later trait editing cannot rewrite the incident');
  assert.match(welcomeScene(s,night).text,/sleepy feeding/);
  const direction=sceneDirection(welcomeScene(s,night));assert.equal(direction.guest,'moth');
  assert.ok(direction.beats.every(b=>b.actors[0].gesture==='nap'));
});

test('capped needs still earn a first memory, and previews report exactly what care can change',()=>{
  const s=fresh();s.pets[0].needs={food:100,fuss:100,clean:100};s.pets[0].bond=25;
  unpackWelcome(s,noon);const v=welcomeView(s,noon);
  assert.deepEqual(v.rewards.share,{food:0,fuss:0,discovery:1});assert.match(welcomeRewardLabel(v.rewards.share),/Needs already full.*\+1 discovery/);
  const r=chooseWelcome(s,'share',noon);assert.equal(r.food,0);assert.equal(r.fuss,0);assert.equal(r.discovery,1);assert.equal(s.pets[0].bond,25);assert.equal(s.life.scenes.length,1);
  const partial=fresh(['nocturnal']);partial.pets[0].needs.food=99;partial.pets[0].needs.fuss=99.5;unpackWelcome(partial,noon);
  assert.deepEqual(welcomeView(partial,noon).rewards.share,{food:1,fuss:.5,discovery:1});
});

test('moving or emptying the bowl blocks care without consuming another serving and recovers after refill',()=>{
  const s=fresh();unpackWelcome(s,noon);const bowl=s.props[0];const original=s.slots.indexOf(bowl.id);
  s.slots[original]=null;s.slots[8]=bowl.id;
  assert.match(welcomeView(s,noon).reason,/same shelf/);const needs={...s.pets[0].needs};assert.equal(chooseWelcome(s,'keep',noon),null);assert.deepEqual(s.pets[0].needs,needs);
  s.slots[8]=null;s.slots[original]=bowl.id;depleteProp(s,bowl.id,noon);
  assert.match(welcomeView(s,noon).reason,/40 min/);assert.equal(chooseWelcome(s,'share',noon),null);assert.equal(s.life.scenes.length,0);
  const restored=roundTrip(s);assert.equal(isSpent(restored,bowl.id,noon+REFILL_MS-1),true);
  assert.equal(chooseWelcome(restored,'keep',noon+REFILL_MS).food,15);assert.equal(restored.behavior.props[bowl.id].uses,1);
});

test('a partly used shared bowl enters its ordinary refill cooldown on the welcome serving',()=>{
  const s=fresh();unpackWelcome(s,noon);const bowl=s.props[0];s.behavior={props:{[bowl.id]:{uses:1,emptyUntil:0,touched:{}}}};
  chooseWelcome(s,'keep',noon);assert.equal(isSpent(s,bowl.id,noon),true);assert.equal(s.behavior.props[bowl.id].emptyUntil,noon+REFILL_MS);
  assert.equal(isSpent(roundTrip(s),bowl.id,noon+REFILL_MS-1),true);
});

test('old households, dismissed introductions and a rehomed incident host cannot mint a new first-bite account',()=>{
  const established=fresh();delete established.life;const old=roundTrip(established);assert.equal(welcomeView(old,noon),null);assert.equal(unpackWelcome(old,noon),false);
  const skipped=fresh();const l=lifeState(skipped);l.introDone=true;l.welcome={petId:'first',dismissed:true};assert.equal(welcomeView(roundTrip(skipped),noon),null);assert.equal(unpackWelcome(skipped,noon),false);
  const moved=fresh();unpackWelcome(moved,noon);const result=chooseWelcome(moved,'keep',noon);moved.pets=[{...moved.pets[0],id:'replacement',name:'Someone Else'}];moved.slots[0]='replacement';
  assert.equal(welcomeView(moved,noon),null);assert.equal(chooseWelcome(moved,'share',noon),null);assert.equal(moved.life.scenes[0].text,result.scene.text);assert.deepEqual(moved.life.scenes[0].cast,['first']);
});

test('a full first shelf explains the missing space and recovers when a compatible spot becomes available',()=>{
  const s=fresh();for(let i=1;i<6;i++){s.props.push({id:'blocked'+i,kind:'bowl'});s.slots[i]='blocked'+i;}
  assert.match(welcomeView(s,noon).reason,/free space/);assert.equal(unpackWelcome(s,noon),false);
  s.props=s.props.filter(p=>p.id!=='blocked1');s.slots[1]=null;assert.equal(unpackWelcome(s,noon),true);
  assert.equal(welcomeView(s,noon).reason,'');
});
