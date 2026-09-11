import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { newHandshake, tapHandshake, handshakePattern, handshakeDemonstration, handshakeRecordKey, restartHandshake, replayHandshake, rewardHandshake } from '../src/engine/play.js';
import { newAlibi, currentRound, answerAlibi, advanceAlibi, rewardAlibi, alibiRank, alibiReaction, statementsFor } from '../src/engine/alibi.js';
const now = new Date(2026,8,10,12).getTime();
function shelf() { const state = blankState(); state.lastTick = now; state.pets = [{ id:'p', name:'Mrs Clot', born:now - 100000, traits:[], needs:{food:50,fuss:40,clean:50}, bond:0, careLog:{ food:2, fuss:1, clean:4 } }]; state.slots[0] = 'p'; return state; }
function rng(seed=42) { let x=seed; return () => { x=(x*1664525+1013904223)>>>0; return x/4294967296; }; }
function finish(game) { while (!game.complete) for (const gesture of handshakePattern(game)) tapHandshake(game, gesture); }

test('Mirror transforms only the active round and asks for its reverse',()=>{
 const game = newHandshake(shelf().pets[0],rng(),{ritual:'mirror'}); game.sequence=[0,1,2,3];
 assert.deepEqual(handshakeDemonstration(game),[0,1]); assert.deepEqual(handshakePattern(game),[1,0]);
 assert.equal(tapHandshake(game,0),'retry'); assert.equal(tapHandshake(game,1),'correct'); assert.equal(tapHandshake(game,0),'round');
 assert.deepEqual(handshakePattern(game),[2,1,0]); assert.deepEqual(game.sequence,[0,1,2,3]); finish(game); assert.equal(game.complete,true);
});
test('Duet filters out the resident beats and grows the player part from two to four moves',()=>{
 const game = newHandshake(shelf().pets[0],rng(),{ritual:'duet'}); game.sequence=[3,0,2,1,1,2,0,3];
 assert.deepEqual(handshakeDemonstration(game),[3,0,2,1]); assert.deepEqual(handshakePattern(game),[0,1]);
 assert.equal(tapHandshake(game,3),'retry'); assert.equal(tapHandshake(game,0),'correct'); assert.equal(tapHandshake(game,1),'round');
 assert.deepEqual(handshakePattern(game),[0,1,2]); finish(game); assert.equal(game.round,3);
});
test('Ritual records stay separate, survive restore and share the memory reward rest',()=>{
 const state=shelf();
 for(const ritual of ['echo','mirror','duet']) for(const encore of [false,true]) {
  const game=newHandshake(state.pets[0],rng(),{ritual,encore}); finish(game);
  const result=rewardHandshake(state,game,now); assert.equal(result.practice,ritual!=='echo'||encore);
  assert.equal(rewardHandshake(state,game,now),null); assert.ok(state.pets[0].handshakeBest[handshakeRecordKey(game)]);
 }
 const restored=normalizeState(state); assert.equal(Object.keys(restored.pets[0].handshakeBest).length,6);
 assert.equal(state.pets[0].handshakes,6); assert.equal(state.pets[0].bond,1);
});
test('Exact ritual replay resets progress without mutating the completed challenge',()=>{
 const game=newHandshake(shelf().pets[0],rng(),{ritual:'duet',encore:true}); finish(game); game.claimed=true;
 const replay=restartHandshake(game); assert.equal(replay.round,0); assert.equal(replay.complete,false); assert.equal(replay.claimed,false);
 assert.deepEqual(replay.sequence,game.sequence); replay.sequence[0]=(replay.sequence[0]+1)%4; assert.notDeepEqual(replay.sequence,game.sequence); assert.equal(game.complete,true);
});
test('replaying a pattern preserves completed rounds, mistakes and the exact challenge',()=>{
 for(const ritual of ['echo','mirror','duet']) {
  const game=newHandshake(shelf().pets[0],rng(),{ritual});
  for(const gesture of handshakePattern(game))tapHandshake(game,gesture);
  const pattern=handshakePattern(game), sequence=game.sequence.slice();
  tapHandshake(game,(pattern[0]+1)%4);
  tapHandshake(game,pattern[0]);
  assert.equal(game.cursor,1);assert.equal(game.round,1);assert.equal(game.mistakes,1);
  assert.equal(replayHandshake(game),true);
  assert.equal(game.cursor,0);assert.equal(game.round,1);assert.equal(game.mistakes,1);assert.equal(game.replays,1);
  assert.deepEqual(handshakePattern(game),pattern);assert.deepEqual(game.sequence,sequence);
  finish(game);const completed=structuredClone(game);
  assert.equal(replayHandshake(game),false);assert.deepEqual(game,completed);
 }
 assert.equal(replayHandshake(null),false);
});

test('handshake rewards report the actual small top-up instead of rounding it away',()=>{
 const state=shelf(), pet=state.pets[0];pet.needs.fuss=99.75;
 const game=newHandshake(pet,rng());finish(game);
 const result=rewardHandshake(state,game,now);
 assert.equal(result.fuss,.25);assert.equal(pet.needs.fuss,100);
 assert.equal(rewardHandshake(state,game,now),null);
});
test('Evidence investigation requires a deliberate valid proof and guards double accusations',()=>{
 const state=shelf(), game=newAlibi(state,state.pets[0],rng(),{mode:'prove'}), round=currentRound(game);
 assert.equal(answerAlibi(game,round.lie),'ignored'); assert.equal(answerAlibi(game,round.lie,-1),'ignored'); assert.equal(round.answered,null);
 assert.equal(answerAlibi(game,round.lie,round.proof),'right'); assert.equal(game.proved,1);
 assert.equal(answerAlibi(game,round.lie,round.proof),'ignored'); assert.equal(game.proved,1); assert.equal(advanceAlibi(game),true);
});
test('Every exhibit is a frozen actual shelf fact, with one relevant contradiction',()=>{
 const state=shelf(), facts=statementsFor(state,state.pets[0]).truths;
 for(let seed=1;seed<=60;seed++) {
  const game=newAlibi(state,state.pets[0],rng(seed),{mode:'prove'}); assert.equal(game.rounds.length,3);
  for(const round of game.rounds) {
   assert.equal(round.exhibits.length,3); assert.equal(new Set(round.exhibits.map(e=>e.key)).size,3);
   assert.equal(round.exhibits[round.proof].key,round.keys[round.lie]);
   for(const exhibit of round.exhibits) assert.equal(exhibit.text,facts.filter(f=>f.key===exhibit.key).map(f=>f.text).join(' '));
   assert.ok(alibiReaction(round).length>20);
  }
  const frozen=JSON.stringify(game); state.pets[0].name='Mrs Ash'; assert.equal(JSON.stringify(game),frozen);
 }
});
test('Correct lies with unrelated true records earn attention but cannot claim a clean win',()=>{
 const state=shelf(), game=newAlibi(state,state.pets[0],rng(),{mode:'prove'});
 while(!game.complete) { const round=currentRound(game); assert.equal(answerAlibi(game,round.lie,(round.proof+1)%3),'unsupported'); advanceAlibi(game); }
 assert.equal(game.correct,3); assert.equal(game.proved,0); assert.equal(alibiRank(game),'Right instinct, loose case');
 const reward=rewardAlibi(state,game,now); assert.equal(reward.clean,false); assert.equal(reward.bond,0); assert.ok(reward.fuss>0); assert.equal(state.pets[0].alibiWins||0,0);
 assert.equal(rewardAlibi(state,game,now),null);
});
test('Three proved contradictions achieve an airtight case without a second payout',()=>{
 const state=shelf(), game=newAlibi(state,state.pets[0],rng(),{mode:'prove'});
 while(!game.complete) { const round=currentRound(game); answerAlibi(game,round.lie,round.proof); advanceAlibi(game); }
 assert.equal(alibiRank(game),'Airtight'); assert.equal(game.proved,3); assert.equal(rewardAlibi(state,game,now).clean,true);
 const again=newAlibi(state,state.pets[0],rng(),{mode:'prove'}); while(!again.complete) { const round=currentRound(again); answerAlibi(again,round.lie,round.proof); advanceAlibi(again); }
 assert.equal(rewardAlibi(state,again,now).practice,true); assert.equal(state.pets[0].bond,1);
});
test('The casual Alibi remains playable with one answer and preserves existing semantics',()=>{
 const state=shelf(), game=newAlibi(state,state.pets[0],rng());
 while(!game.complete) { assert.equal(answerAlibi(game,currentRound(game).lie),'right'); advanceAlibi(game); }
 assert.equal(game.correct,3); assert.equal(rewardAlibi(state,game,now).clean,true);
});
