import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHASE_STAGES, campaignSchedule, normalizeChaseCampaign, campaignProgress, recordChaseCampaign, claimChaseCampaign } from '../src/content/chase-campaign.js';
import { newChase, updateChase, recordChase } from '../src/engine/chase.js';
const pet = () => ({id:'p', name:'Pip', art:{stamps:[]}, bond:0});
test('twelve authored stages have three chapters, distinct goals and bounded deterministic schedules', () => {
  assert.equal(CHASE_STAGES.length,12);
  assert.deepEqual([...new Set(CHASE_STAGES.map(s=>s.chapter))],[1,2,3]);
  assert.equal(new Set(CHASE_STAGES.map(s=>JSON.stringify(s.requirements))).size,12);
  for (const s of CHASE_STAGES) for (const gentle of [false,true]) {
    const schedule=campaignSchedule(s.id,gentle);
    assert.deepEqual(schedule,campaignSchedule(s.id,gentle));
    assert.ok(schedule.length>0);
    assert.ok(schedule.every((e,i)=>e.at>=0&&e.at<s.seconds&&e.x>=-20&&e.x<=340&&(!i||schedule[i-1].at<=e.at)));
  }
  assert.ok(campaignSchedule(CHASE_STAGES[0].id).every(e=>e.kind==='crumb'));
});
test('legacy scores are untouched; corrupt progression cannot silently unlock stages', () => {
  const p=pet();p.chaseBest={score:1234};p.chaseRecords={standard:{score:1234}};
  const before=JSON.stringify(p);normalizeChaseCampaign(p.chaseCampaign);assert.equal(JSON.stringify(p),before);
  assert.equal(normalizeChaseCampaign({unlocked:12,records:{fake:{won:true}}}).unlocked,1);
  assert.equal(normalizeChaseCampaign({version:1,records:{}}).version,1);
});
test('wins alone unlock, records survive reload, practice does not duplicate mastery rewards', () => {
  const p=pet();const id=CHASE_STAGES[0].id;
  const loss={petId:p.id,format:'campaign',stageId:id,finished:true,complete:false,score:20,caught:1};
  recordChaseCampaign(p,loss,1);assert.equal(p.chaseCampaign.unlocked,1);assert.equal(claimChaseCampaign(p,loss),false);
  const win={...loss,campaignRecorded:false,complete:true,caught:5,score:70};
  assert.equal(recordChaseCampaign(p,win,2),true);assert.equal(p.chaseCampaign.unlocked,2);
  assert.equal(claimChaseCampaign(p,win),true);assert.equal(claimChaseCampaign(p,win),false);
  const restored=JSON.parse(JSON.stringify(p));restored.chaseCampaign=normalizeChaseCampaign(restored.chaseCampaign);
  assert.equal(restored.chaseCampaign.unlocked,2);assert.equal(claimChaseCampaign(restored,{...win}),false);
  assert.equal(recordChaseCampaign(restored,{...win,campaignRecorded:false,score:90},3),true);
  assert.equal(restored.chaseCampaign.records[id].score,90);
  assert.equal(recordChaseCampaign(restored,{...win,stageId:CHASE_STAGES[3].id}),false);
});
test('campaign handling does not depend on affection, and old quick records remain separate', () => {
  const a=newChase(pet(),{format:'campaign'}), b=newChase({...pet(),bond:99},{format:'campaign',mood:'furious'});
  assert.equal(a.format,'campaign');assert.equal(a.speedScale,b.speedScale);assert.equal(a.grip,b.grip);assert.equal(a.shield,b.shield);
  const p=pet();p.chaseBest={score:900};p.chaseRecords={standard:{score:900}};
  Object.assign(a,{finished:true,complete:true,caught:5,score:50});recordChase(p,a);
  assert.deepEqual(p.chaseBest,{score:900});assert.deepEqual(p.chaseRecords,{standard:{score:900}});
});
test('every campaign win requires its authored conditions and a stopped stage clock', () => {
  for(const s of CHASE_STAGES){
    const p=pet();p.chaseCampaign={version:1,records:Object.fromEntries(CHASE_STAGES.slice(0,s.index).map(s=>[s.id,{won:true}]))};
    const g=newChase(p,{format:'campaign',stageId:s.id});
    g.schedule=[];g.time=s.seconds-1/60;
    for(const r of s.requirements)g[r.stat]=r.max===undefined?r.target:0;
    updateChase(g,{},1/60);assert.equal(g.finished,true,s.id);assert.equal(g.complete,true,s.id);
    for(const requirement of s.requirements){
      const bad={...g,[requirement.stat]:requirement.max===undefined?0:requirement.max+1};
      assert.equal(campaignProgress(bad).done,false,s.id+' '+requirement.stat);
    }
  }
});

// Drive real controls at 60 Hz: no teleports, score injection, or skipped physics.
import { jumpChase, dashChase } from '../src/engine/chase.js';
function playLesson(p,stage,gentle,stamps=[],mirror=false) {
  p.art={stamps:stamps.map(kind=>({kind}))};
  const g=newChase(p,{format:'campaign',stageId:stage.id,gentle,mirror});
  while(!g.finished){
    const broom=g.items.find(i=>i.kind==='broom');
    let target=g.items.filter(i=>['crumb','biscuit','moth','sugar'].includes(i.kind)).sort((a,b)=>a.age>b.age?-1:1)[0];
    if(stage.index===5||stage.index===11&&g.time<20)target=g.items.find(i=>i.kind==='biscuit');
    if(stage.index===7)target=g.items.find(i=>i.kind==='moth')||target;
    if(stage.index===8)target=g.items.find(i=>i.kind==='sugar')||target;
    let x=target?.x??160;
    if(broom&&[4,11].includes(stage.index)){
      x=broom.x;
      if(broom.warning<.12&&Math.abs(g.player.x-x)<55)dashChase(g,x<160?1:-1);
    }else if(broom&&[6,10].includes(stage.index))x=broom.x<160?240:80;
    if(stage.index===3){
      const dust=g.items.find(i=>i.kind==='bunny'&&i.warning<=0&&!i.dodged);
      if(dust){x=160;if(Math.abs(dust.x-g.player.x)<65)jumpChase(g);}
    }else if(target&&target.z>57&&Math.abs(target.x-g.player.x)<45&&(!broom||![4,11].includes(stage.index)))jumpChase(g);
    updateChase(g,{targetX:x},1/60);
  }
  return g;
}
test('all twelve lessons are physically winnable with normal controls at either pace', () => {
  for(const gentle of [false,true])for(const stamps of [[],['wing']]){
    const p=pet();
    for(const stage of CHASE_STAGES){
      const g=playLesson(p,stage,gentle,stamps);
      assert.equal(g.complete,true,stage.id+' '+JSON.stringify({gentle,stamps,progress:campaignProgress(g).text}));
      recordChase(p,g);
    }
    assert.equal(p.chaseCampaign.unlocked,12);
  }
});

test('doing nothing cannot clear even the gentle introduction; restarting earns nothing', () => {
  const p=pet(), g=newChase(p,{format:'campaign',gentle:true});
  while(!g.finished)updateChase(g,{},1/60);
  assert.equal(g.complete,false);recordChase(p,g);assert.equal(p.chaseCampaign.unlocked,1);
  const interrupted=newChase(p,{format:'campaign',gentle:true});
  updateChase(interrupted,{axis:1},1);assert.equal(recordChaseCampaign(p,interrupted),false);
  assert.equal(claimChaseCampaign(p,interrupted),false);
});

test('the vacant-half lesson rejects staying on one side for the whole course', () => {
  for(const gentle of [false,true]){
    const p=pet();p.chaseCampaign={records:Object.fromEntries(CHASE_STAGES.slice(0,6).map(s=>[s.id,{won:true}]))};
    const g=newChase(p,{format:'campaign',stageId:'vacant-half',gentle});
    while(!g.finished)updateChase(g,{targetX:240},1/60);
    assert.equal(g.safeCrossings,0);assert.equal(g.complete,false);
  }
});
test('checking an earned mastery reward does not consume its pending receipt', () => {
  const p=pet(),g=newChase(p,{format:'campaign'});Object.assign(g,{finished:true,complete:true,caught:5});
  assert.equal(claimChaseCampaign(p,g,1,{consume:false}),true);
  assert.equal(p.chaseCampaign.records[g.stageId].rewarded,false);
  const restored=JSON.parse(JSON.stringify(p));
  assert.equal(claimChaseCampaign(restored,g,2,{consume:false}),true);
  assert.equal(claimChaseCampaign(restored,g,2),true);
  assert.equal(claimChaseCampaign(restored,g,3,{consume:false}),false);
});

import { blankState, normalizeState } from '../src/state.js';
import { rewardHandshake, PLAY_COOLDOWN } from '../src/engine/play.js';
test('cooldown clear survives normalized reload and receives its pending reward on a later replay', () => {
  const now=new Date(2026,8,19,12).getTime(), state=blankState(),p=pet();
  Object.assign(p,{traits:[],needs:{food:60,fuss:50,clean:70},cared:0,playedAt:{chase:now}});
  state.pets=[p];state.slots[0]=p.id;state.lastTick=now;
  const first=playLesson(p,CHASE_STAGES[0],true);recordChase(p,first,now);
  assert.equal(rewardHandshake(state,first,now).practice,true);
  assert.equal(p.chaseCampaign.records[first.stageId].rewarded,false);
  const restored=normalizeState(JSON.parse(JSON.stringify(state))),resident=restored.pets[0];
  assert.equal(resident.chaseCampaign.unlocked,2);
  const replay=playLesson(resident,CHASE_STAGES[0],true);recordChase(resident,replay,now+PLAY_COOLDOWN+1);
  const reward=rewardHandshake(restored,replay,now+PLAY_COOLDOWN+1);
  assert.ok(reward.fuss>0||reward.bond>0);assert.equal(resident.chaseCampaign.records[first.stageId].rewarded,true);
  const again=playLesson(resident,CHASE_STAGES[0],true);
  assert.equal(rewardHandshake(restored,again,now+2*PLAY_COOLDOWN+2).practice,true);
});

test('mirrored replay reflects every scheduled route and horizontal direction without changing timing or points', () => {
  for(const s of CHASE_STAGES)for(const gentle of [false,true]){
    const original=campaignSchedule(s.id,gentle), mirrored=campaignSchedule(s.id,gentle,true);
    assert.deepEqual(mirrored,original.map(e=>({...e,x:320-e.x,...(e.vx===undefined?{}:{vx:-e.vx})})));
    assert.notDeepEqual(mirrored,original,s.id);
  }
});
test('mirror is replay-only and cannot change an uncleared lesson', () => {
  const p=pet(),fresh=newChase(p,{format:'campaign',mirror:true});
  assert.equal(fresh.mirror,false);assert.deepEqual(fresh.schedule,campaignSchedule('first-crumbs'));
  p.chaseCampaign={records:{'first-crumbs':{won:true,score:120,rewarded:true}}};
  p.chaseBest={score:1234};p.chaseRecords={standard:{score:1234}};
  const before=JSON.stringify(p),replay=newChase(p,{format:'campaign',stageId:'first-crumbs',mirror:true});
  assert.equal(replay.mirror,true);assert.equal(JSON.stringify(p),before);
});


test('all twelve mirrored replays remain physically winnable with normal controls at either pace', () => {
  for(const gentle of [false,true])for(const stamps of [[],['wing']]){
    const p=pet();p.chaseCampaign={records:Object.fromEntries(CHASE_STAGES.map(s=>[s.id,{won:true,rewarded:true}]))};
    for(const stage of CHASE_STAGES){
      const g=playLesson(p,stage,gentle,stamps,true);
      assert.equal(g.mirror,true);
      assert.equal(g.complete,true,stage.id+' mirrored '+JSON.stringify({gentle,stamps,progress:campaignProgress(g).text}));
      assert.equal(claimChaseCampaign(p,g),false,'mirroring never grants a duplicate mastery reward');
    }
  }
});
