import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { residentMemories, residentVoice, rememberedExchange } from '../src/engine/resident-memory.js';
import { residentIntention, pairScore, WANT_FORGET_MS } from '../src/engine/behavior.js';
import { pickDirectAddress, pickDialogue } from '../src/engine/dialogue.js';
import { performShelfScene, availableShelfScenes, sceneAvailability, shelfSceneRewardPreview, SHELF_ENCORE_INTERVAL } from '../src/engine/shelf-theatre.js';
import { shelfSceneFrame, shelfMealFrame } from '../src/art/shelf-theatre.js';

const NOW = new Date(2026, 8, 12, 12).getTime();
const pet = (id, traits = [], needs = {}) => ({ id, name: id, traits, needs: {food:60,fuss:60,clean:60,...needs}, bond:3,
  stats:{cute:5,menace:5,damp:5,mystique:5},art:{body:'',stamps:[]},born:NOW-3600000,cared:0,grudges:0 });
function shelf(people, props = [], slots) {
  const s = blankState();s.pets=people;s.props=props;s.stories={relationships:{},residents:[],requests:{}};s.behavior={props:{},claims:{},lastRun:0};
  (slots || [...people.map(p=>p.id),...props.map(p=>p.id)]).forEach((id,i)=>s.slots[i]=id);
  return s;
}
const perform = (s,kind,at=NOW,more={}) => performShelfScene(s,{kind,manual:true,...more},at,()=>0);

test('new residents cannot inherit household achievements or invented promises as memories', () => {
  const a=pet('A'), s=shelf([a]);
  s.life.courtWins=10;s.stories.handshakes=30;s.life.marketRuns=12;
  s.stories.requests.A={kind:'food',status:'accepted',at:NOW-13*3600000};
  s.stories.residents=[{id:'Gone',name:'Gone'}];
  assert.deepEqual(residentMemories(s,a,NOW),[]);
  assert.deepEqual(residentMemories(s,pet('Elsewhere'),NOW),[]);
});

test('callbacks distinguish a kept promise, a declined request and an actual rename', () => {
  const a=pet('New',['clingy']),s=shelf([a]);
  a.names=[{name:'Old',at:NOW-5000},{name:'New',at:NOW}];a.fulfilledRequests=2;a.refusedRequests=1;
  const memories=residentMemories(s,a,NOW);
  assert.match(memories.find(m=>m.key==='renamed').text,/Old/);
  assert.match(memories.find(m=>m.key==='promise-kept').evidence,/2 fulfilled/);
  assert.match(memories.find(m=>m.key==='request-declined').evidence,/not a broken promise/);
  assert.ok(memories.every(m=>m.evidence && !m.text.includes('broke your promise')));
});

test('care patterns, games and visitor callbacks belong to the actual participant', () => {
  const a=pet('A'),b=pet('B'),s=shelf([a,b]);
  a.careLog={food:7,fuss:2,clean:1};a.handshakes=3;a.chases=2;a.alibiWins=1;a.playedAt={court:NOW-1};
  s.stories.visitor={kind:'moth',welcomed:true,hostId:'A',choice:'crumbs'};
  s.life.scenes=[{kind:'outing',cast:['A'],title:'Trip',text:'Returned'}];
  const keys=residentMemories(s,a,NOW).map(m=>m.key);
  for(const key of ['care-food','handshake','chase','alibi','court','visitor','outing'])assert.ok(keys.includes(key),key);
  assert.deepEqual(residentMemories(s,b,NOW),[]);
});

test('a departed neighbour callback requires both its rehome record and a surviving real relationship', () => {
  const a=pet('A'),s=shelf([a]);
  s.stories.residents=[{id:'Gone',name:'Mouldy Pearl',at:NOW-2000}];
  assert.deepEqual(residentMemories(s,a,NOW),[]);
  s.stories.relationships['A|Gone']={time:16*60000,plots:0};
  assert.match(residentMemories(s,a,NOW)[0].text,/Mouldy Pearl/);
  s.pets.push(pet('Gone'));assert.deepEqual(residentMemories(s,a,NOW),[],'a returned live resident is not spoken of as departed');
});

test('memory selection is read-only and different personalities respond differently to the same real event', () => {
  const a=pet('A',['clingy']),b=pet('B',['bitey']),s=shelf([a,b]);
  a.fulfilledRequests=1;b.fulfilledRequests=1;
  const before=JSON.stringify(s),first=residentMemories(s,a,NOW),second=residentMemories(s,b,NOW);
  assert.notEqual(first[0].text,second[0].text);
  assert.equal(residentVoice(a),'attached');assert.equal(residentVoice(b),'toothy');
  assert.equal(JSON.stringify(s),before);
  const said=pickDirectAddress(s,a,{now:NOW,rng:()=>0});
  assert.equal(said.meta.memory,'promise-kept');assert.equal(said.turns[0].line,first[0].text);
});

test('a remembered ritual quotes only the saved learned opening', () => {
  const a=pet('A'),s=shelf([a]);a.handshakes=20;
  assert.ok(!residentMemories(s,a,NOW).some(m=>m.key.startsWith('ritual:')));
  a.handshakeRituals={echo:{opening:[2,0,3],completions:1,clean:1,at:NOW}};
  assert.match(residentMemories(s,a,NOW).find(m=>m.key==='ritual:echo').text,/Blink, Knock, Boop/);
  a.handshakeRituals.echo.opening=[2,19];
  assert.ok(!residentMemories(s,a,NOW).some(m=>m.key.startsWith('ritual:')));
});

test('actual pair scenes produce future exchanges and modest temporary social appeal without stacking', () => {
  const a=pet('A'),b=pet('B'),s=shelf([a,b]);
  const base=pairScore(s,a,b,NOW);
  assert.equal(rememberedExchange(s,a,b),null);
  assert.equal(perform(s,'pair').action,'comfort');
  assert.ok(pairScore(s,a,b,NOW)>base);
  const exchange=pickDialogue(s,{kind:'generic',now:NOW,rng:()=>0});
  assert.equal(exchange.meta.memory,'pair-comfort');
  const first=pairScore(s,a,b,NOW);
  perform(s,'pair',NOW+SHELF_ENCORE_INTERVAL);
  assert.equal(pairScore(s,a,b,NOW+SHELF_ENCORE_INTERVAL),first);
  assert.equal(pairScore(s,a,b,NOW+SHELF_ENCORE_INTERVAL+WANT_FORGET_MS),base);
  assert.equal(rememberedExchange(s,a,pet('C')),null);
  const restored=normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(rememberedExchange(restored,restored.pets[0],restored.pets[1]).memory,'pair-comfort');
});

test('trait scenes are selected only for the lead that can say them', () => {
  const toothy=shelf([pet('A',['bitey']),pet('B')]);
  assert.equal(perform(toothy,'pair').variant,'pair:comfort-toothy');
  const plain=shelf([pet('A'),pet('B')]);
  assert.ok(!perform(plain,'pair').variant.includes('toothy'));
});

test('intentions reveal recorded moves, settle near favorite furniture and never advance the simulation', () => {
  const a=pet('A',['theatrical']),s=shelf([a],[{id:'mirror',kind:'mirror'}],['A','mirror']);
  const before=JSON.stringify(s);
  assert.equal(residentIntention(s,a,NOW).status,'settled');assert.equal(residentIntention(s,a,NOW).label,'Beside a favourite');
  assert.equal(JSON.stringify(s),before);
  a.wants={slot:3,since:NOW-1000,at:NOW-1000,tries:2};a.displacedFrom=3;a.displacedAt=NOW-1000;
  const plan=residentIntention(s,a,NOW);assert.equal(plan.slot,3);assert.equal(plan.label,'Wants its old spot back');assert.match(plan.text,/A4/);
  assert.equal(residentIntention(s,a,NOW+WANT_FORGET_MS).status,'settled');
  a.traits=['nocturnal'];assert.equal(residentIntention(s,a,NOW).status,'asleep');
});

test('visibly eaten bowl servings deplete even when care is full or on cooldown, with reload preserving stock', () => {
  let s=shelf([pet('A',['sugar'],{food:100})],[{id:'b',kind:'bowl'}]);
  let event=perform(s,'bowl');
  assert.equal(event.meal,'served');assert.deepEqual(event.rewards,[]);assert.equal(event.after.servings,1);
  s=normalizeState(JSON.parse(JSON.stringify(s)));
  event=perform(s,'bowl',NOW+SHELF_ENCORE_INTERVAL);
  assert.equal(event.after.servings,0);assert.ok(s.behavior.props.b.emptyUntil>NOW);
  const empty=perform(s,'bowl',NOW+2*SHELF_ENCORE_INTERVAL);
  assert.equal(empty.meal,'empty');assert.deepEqual(empty.rewards,[]);assert.equal(empty.after.servings,0);
  assert.equal(s.pets[0].needs.food,100);
  event=perform(s,'bowl',s.behavior.props.b.emptyUntil);
  assert.equal(event.meal,'served');assert.equal(event.after.servings,1);
});

test('empty bowls never show chewing or flying crumbs, including reduced motion', () => {
  for(const reduced of [false,true])for(const time of [0,3000,4400,7600]) {
    assert.ok(shelfSceneFrame('meal',time,reduced,{meal:'empty'}).actors.every(a=>a.pose!=='eat'));
    assert.equal(shelfMealFrame({meal:'empty'},time,reduced).visible,false);
  }
  assert.equal(shelfMealFrame({meal:'served'},4000).visible,true);
  assert.ok(shelfMealFrame({meal:'served'},4400).travel>shelfMealFrame({meal:'served'},3300).travel);
  assert.equal(shelfMealFrame({meal:'served'},6000).gone,true);
  assert.deepEqual(shelfMealFrame({meal:'served'},0,true),shelfMealFrame({meal:'served'},7000,true));
});

test('scene readiness identifies the actual missing prop, row, partner or trait', () => {
  const s=shelf([pet('A')]);
  assert.match(sceneAvailability(s,{kind:'bath'},NOW),/Place a tub/);
  s.props=[{id:'t',kind:'tub'}];s.slots[6]='t';
  assert.match(sceneAvailability(s,{kind:'bath'},NOW),/another row cannot reach/);
  s.props=[{id:'m',kind:'musicbox'}];s.slots[6]=null;s.slots[1]='m';
  assert.match(sceneAvailability(s,{kind:'musicbox'},NOW),/second resident/);
  s.props=[{id:'m',kind:'mirror'}];
  assert.match(sceneAvailability(s,{kind:'mirror'},NOW),/None of the nearby residents likes/);
});

test('reward preview explains caps, empty bowls and scenes with no care payout', () => {
  const s=shelf([pet('A',['sugar'],{food:100})],[{id:'b',kind:'bowl'}]);
  let candidate=availableShelfScenes(s,NOW).find(c=>c.kind==='bowl');
  assert.match(shelfSceneRewardPreview(s,candidate,NOW),/Uses 1 shared serving, even when full/);
  assert.match(shelfSceneRewardPreview(s,candidate,NOW),/already full/);
  s.behavior.props.b={uses:0,emptyUntil:NOW+60000,touched:{}};
  assert.match(shelfSceneRewardPreview(s,candidate,NOW),/empty-bowl scene gives no food/);
  const arguing=shelf([pet('A',[],{food:10,fuss:10,clean:10}),pet('B')]);
  candidate=availableShelfScenes(arguing,NOW).find(c=>c.kind==='pair');
  assert.match(shelfSceneRewardPreview(arguing,candidate,NOW),/No care or trust/);
});

test('adventure keepsakes and replays give only their actual resident a grounded callback', async () => {
  const { startEscapade, finishEscapade } = await import('../src/engine/escapades.js');
  const { recordEscapadeEvent } = await import('../src/escapade-state.js');
  const a=pet('A'),b=pet('B'),s=shelf([a,b]);
  function complete(actor,at){
    assert.equal(startEscapade(s,{episodeId:'crumb-observatory',approachId:'orbit',petId:actor.id},at),true);
    recordEscapadeEvent(s,{kind:'care',need:'food',petIds:[actor.id]},at+1);
    recordEscapadeEvent(s,{kind:'play',activity:'chase',petIds:[actor.id]},at+2);
    return finishEscapade(s,'discovery',at+3);
  }
  assert.equal(complete(a,NOW).fresh,true);
  assert.match(residentMemories(s,a,NOW+5)[0].text,/A insists/);
  assert.equal(residentMemories(s,b,NOW+5).some(m=>m.key.startsWith('escapade:')),false);
  assert.equal(complete(b,NOW+10).fresh,false);
  assert.equal(s.escapades.album[0].petId,a.id);
  assert.match(residentMemories(s,b,NOW+15)[0].text,/B insists/);
  a.name='Captain $&';
  assert.match(residentMemories(s,a,NOW+15)[0].text,/Captain \$& insists/);
});
