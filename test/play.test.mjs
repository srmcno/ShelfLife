import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { newHandshake, tapHandshake, rewardHandshake, PLAY_COOLDOWN, playWait } from '../src/engine/play.js';
import { previewCare, careFor, doRounds, ROUNDS_COOLDOWN } from '../src/engine/care.js';
const now = new Date(2026,8,5,12).getTime();
function fixture() { const s=blankState(); s.lastTick=now; s.pets=[{id:'p',name:'Pip',traits:[],needs:{food:50,fuss:50,clean:50},bond:0,cared:0}];s.slots[0]='p';return s; }
function finish(game) { for(let round=0;round<3;round++) for(const tap of game.sequence.slice(0,round+2)) tapHandshake(game,tap); }
test('handshake grows 2/3/4 gestures, retries freely, and pays once after completion',()=>{
 const s=fixture(),p=s.pets[0],game=newHandshake(p,()=>.3);
 assert.equal(rewardHandshake(s,game,now),null);
 assert.equal(tapHandshake(game,3),'retry'); assert.equal(game.round,0);
 finish(game); assert.equal(game.complete,true);
 assert.deepEqual(rewardHandshake(s,game,now),{practice:false,fuss:24,bond:1});
 assert.equal(p.needs.fuss,74);assert.equal(p.bond,1);assert.equal(p.handshakes,1);
 assert.equal(rewardHandshake(s,game,now),null);assert.equal(tapHandshake(game,1),'ignored');
});
test('practice never farms rewards, reload preserves cooldown, and later games reward again',()=>{
 const s=fixture(),p=s.pets[0],g=newHandshake(p);finish(g);rewardHandshake(s,g,now);
 const loaded=normalizeState(s);assert.equal(playWait(loaded.pets[0],now),PLAY_COOLDOWN);
 const practice=newHandshake(p);finish(practice);assert.equal(rewardHandshake(s,practice,now).practice,true);
 assert.equal(p.handshakes,1);const later=newHandshake(p);finish(later);rewardHandshake(s,later,now+PLAY_COOLDOWN);assert.equal(p.handshakes,2);
});
test('sleeping pets permit practice but no reward; removed pets cannot receive rewards',()=>{
 const s=fixture(),p=s.pets[0];p.traits=['nocturnal'];const g=newHandshake(p);finish(g);
 assert.equal(rewardHandshake(s,g,now).practice,true);assert.equal(p.bond,0);
 const gone=newHandshake(p);finish(gone);s.pets=[];assert.equal(rewardHandshake(s,gone,now),null);
});
test('care previews match executed gains for saturation, sleep and full meters',()=>{
 for(const level of [0,50,79,99,100])for(const traits of [[],['nocturnal']]){
  const s=fixture(),p=s.pets[0];p.needs.food=level;p.traits=traits;
  const preview=previewCare(p,'food',now);careFor(s,p,'food',now);assert.equal(p.needs.food-level,preview.gain);
 }
});
test('rounds have a persistent cooldown and cannot be spammed',()=>{
 const s=fixture();doRounds(s,now);const food=s.pets[0].needs.food,notes=s.notes.length;
 assert.equal(doRounds(s,now).cooling,true);assert.equal(s.pets[0].needs.food,food);assert.equal(s.notes.length,notes);
 const loaded=normalizeState(s);assert.equal(doRounds(loaded,now).cooling,true);
 assert.ok(!doRounds(s,now+ROUNDS_COOLDOWN).cooling);assert.ok(s.pets[0].needs.food>food);
});

import { newDustPatrol, nextDust, catchDust, finishDust } from '../src/engine/play.js';
test('dust patrol offers 12 specks, prevents duplicate hits, and rewards cleanliness only on a win',()=>{
 const s=fixture(),p=s.pets[0],g=newDustPatrol(p);
 assert.equal(catchDust(g,-1),false);assert.equal(finishDust(g),false);
 for(let i=0;i<12;i++){assert.equal(nextDust(g,()=>.5),true);if(i<6){assert.equal(catchDust(g,g.target),true);assert.equal(catchDust(g,g.target),false);}}
 assert.equal(nextDust(g),false);assert.equal(finishDust(g),true);
 rewardHandshake(s,g,now);assert.equal(p.needs.clean,74);assert.equal(p.needs.fuss,50);assert.equal(p.dustPatrols,1);assert.equal(p.handshakes,undefined);
});
test('missing dust costs no needs and an unfinished patrol cannot claim a reward',()=>{
 const s=fixture(),g=newDustPatrol(s.pets[0]);for(let i=0;i<12;i++)nextDust(g);
 assert.equal(finishDust(g),false);assert.equal(rewardHandshake(s,g,now),null);assert.equal(s.pets[0].bond,0);
});
