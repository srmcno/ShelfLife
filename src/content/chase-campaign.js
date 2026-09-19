// Authored courses are independent of bond, mood, old scores and one another's
// random generators. Schedules describe decisions, not escalating spawn rates.
export const CHASE_CHAPTERS = ['The breakfast remains', 'A pantry with witnesses', 'The midnight inventory'];
const need = (stat,target,label) => ({stat,target,label});
export const CHASE_STAGES = [
  ['first-crumbs',1,'The breakfast remains','Walk to the falling crumbs. No jumping or hazards yet.',14,[need('caught',4,'crumbs')],'shelf'],
  ['both-cupboards',1,'Both cupboards','Turn back after each little pile. Collect from both sides.',18,[need('leftCaught',2,'left crumbs'),need('rightCaught',2,'right crumbs')],'shelf'],
  ['borrowed-knees',1,'Borrowed knees','Hop into the suspended crumbs. Grounded catches cannot finish this lesson.',18,[need('airCatches',3,'air catches')],'shelf'],
  ['dust-procession',1,'The dust procession','Meet the dust with a hop. Cross above it, then land for breakfast.',22,[need('dodged',2,'hopped hazards'),need('caught',3,'crumbs')],'shelf'],
  ['broom-breaker',2,'Broom breaker','Wait for BROOM to flash, then Dash through its half of the floor.',20,[need('dashSmashes',2,'dash smashes')],'pantry'],
  ['whole-estate',2,'The whole estate','Prioritise biscuits before they break. The small crumbs are a distraction.',22,[need('biscuits',3,'whole biscuits')],'pantry'],
  ['vacant-half',2,'The vacant half','Cross to the unthreatened half before each broom warning ends. Hopping does not count as leaving.',24,[need('safeCrossings',2,'safe-side escapes'),need('caught',3,'crumbs')],'pantry'],
  ['witness-protection',2,'Witness protection','Intercept the low-flying thieves. Only moths carrying crumbs count as rescues.',24,[need('rescued',2,'rescued crumbs')],'pantry'],
  ['sugar-executor',3,'Sugar executor','Touch the sugar cube, then collect its nearby crumb trail before the rush wears off.',24,[need('rushCatches',4,'catches during sugar rush')],'shelf'],
  ['moon-shelf',3,'The high shelf','Moon gravity gives a longer hop. Reach the suspended high crumbs; the lower trail is optional.',24,[need('highCatches',3,'high catches')],'moon'],
  ['clean-switchback',3,'The clean switchback','Alternate cupboards as the broom changes sides. Take the safe route; at most one bump.',26,[need('leftCaught',3,'left crumbs'),need('rightCaught',3,'right crumbs'),{stat:'bumps',max:1,label:'bumps at most'}],'pantry'],
  ['last-inventory',3,'The last inventory','First Dash a broom, then save two biscuits. Finish by hopping across the gold arc.',30,[need('dashSmashes',1,'dash smash'),need('biscuits',2,'whole biscuits'),need('finaleCaught',3,'final gold crumbs')],'moon']
].map(([id,chapter,name,lesson,seconds,requirements,venue],index)=>Object.freeze({id,index,chapter,name,lesson,seconds,requirements,venue}));
export const chaseStage = id => CHASE_STAGES.find(s=>s.id===id) || CHASE_STAGES[0];
export function campaignSchedule(id, gentle = false) {
  const s=chaseStage(id), out=[];
  const add=(at,kind,x,z=182,extra={})=>out.push({at,kind,x,z,...extra});
  const crumbs=(at,xs,spacing=1.6,z=182,extra={})=>xs.forEach((x,i)=>add(at+i*spacing,'crumb',x,z,extra));
  const broom=(at,left)=>add(at,'broom',left?86:234,10,{vx:left?1:-1,warning:gentle?1.8:1.4,active:.3,resolved:false});
  const bunny=(at,left)=>add(at,'bunny',left?-18:338,10,{vx:(left?1:-1)*(gentle?64:78),warning:.9,dodged:false});
  const biscuits=(at,xs)=>xs.forEach((x,i)=>add(at+i*3.3,'biscuit',x,182,{vy:gentle?-30:-36}));
  switch(s.index){
    case 0: crumbs(.8,[90,120,180,220,200,160],1.8);break;
    case 1: crumbs(.6,[80,80,240,240,80,240,80,240],1.9);break;
    case 2: crumbs(1,[105,160,215,105,215,160],2.4,86,{hover:true,life:5});break;
    case 3: crumbs(.5,[160,110,210,160,90,220,160,160],2.4);bunny(2,true);bunny(8,false);bunny(14,true);break;
    case 4: broom(2,true);broom(7,false);broom(12,true);broom(16,false);break;
    case 5: biscuits(.5,[75,245,90,230,160]);crumbs(2,[245,75,240,80],3.3);break;
    case 6: crumbs(.5,[85],1); [2.3,7.3,12.3,17.3].forEach((at,i)=>crumbs(at,[i%2?85:235,i%2?85:235],1.8));broom(2,true);broom(7,false);broom(12,true);broom(17,false);break;
    case 7: [1,6,11,16].forEach((at,i)=>add(at,'moth',i%2?300:20,65,{vx:i%2?-36:36,carrying:true,campaignCarrier:true}));crumbs(3,[100,220,100,220],4);break;
    case 8: [1,9,17].forEach((at,i)=>{const x=i%2?235:85;add(at,'sugar',x,100,{vy:-70});crumbs(at+1.8,[x,x+25,x-20],.7,70);});break;
    case 9: crumbs(.8,[80,140,210,250,170,100],3,125,{hover:true,life:6});crumbs(2,[210,80,250],5);break;
    case 10: crumbs(.5,[235,235,85,85,235,235,85,85,235,85],2.3,110,{life:1});broom(1,true);broom(6,false);broom(11,true);broom(16,false);broom(21,true);break;
    case 11: broom(2,true);broom(5,false);biscuits(7,[90,230,160]);[[52,42],[106,70],[160,94],[214,70],[268,42]].forEach(([x,z])=>add(20,'crumb',x,z,{gold:true,finale:true,expiresAt:30}));break;
  }
  return out.sort((a,b)=>a.at-b.at);
}
const bounded = (v,max=1000000) => Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
export function normalizeChaseCampaign(value) {
  const records={};
  for(const s of CHASE_STAGES){
    const r=value?.records?.[s.id];if(!r||typeof r!=='object')continue;
    records[s.id]={won:r.won===true,score:bounded(r.score),stars:bounded(r.stars,3),attempts:bounded(r.attempts),at:bounded(r.at,8640000000000000),rewarded:r.rewarded===true};
  }
  let unlocked=1;while(unlocked<12&&records[CHASE_STAGES[unlocked-1].id]?.won)unlocked++;
  return {version:1,unlocked,records};
}
export function campaignProgress(game) {
  const stage=chaseStage(game.stageId);
  const requirements=stage.requirements.map(r=>({...r,value:bounded(game[r.stat]),done:r.max===undefined?bounded(game[r.stat])>=r.target:bounded(game[r.stat])<=r.max}));
  return {stage,requirements,done:requirements.every(r=>r.done),text:requirements.map(r=>r.max===undefined?`${Math.min(r.value,r.target)}/${r.target} ${r.label}`:`${r.value}/${r.max} ${r.label}`).join(' · ')};
}
export function recordChaseCampaign(pet,game,now=Date.now()) {
  if(game.format!=='campaign'||!game.finished||game.petId!==pet.id||!CHASE_STAGES.some(s=>s.id===game.stageId))return false;
  const campaign=pet.chaseCampaign=normalizeChaseCampaign(pet.chaseCampaign),stage=chaseStage(game.stageId);
  if(stage.index>=campaign.unlocked||game.campaignRecorded)return false;
  game.campaignRecorded=true;
  const previous=campaign.records[stage.id],best=!previous||game.score>previous.score;
  campaign.records[stage.id]={won:!!previous?.won||!!game.complete,score:Math.max(previous?.score||0,bounded(game.score)),stars:Math.max(previous?.stars||0,game.complete?2:1,game.stars||0),attempts:Math.min(1000000,(previous?.attempts||0)+1),at:bounded(now,8640000000000000),rewarded:!!previous?.rewarded};
  pet.chaseCampaign=normalizeChaseCampaign(campaign);
  return best;
}
// Call at the reward boundary, after recordChase (or alone). The receipt belongs
// to mastery of the stage, not an in-memory object or a mutable affection score.
// Check with consume:false before reward eligibility; consume only after an
// actual positive grant, so cooldown or asleep practice keeps its pending reward.
export function claimChaseCampaign(pet,game,now=Date.now(),{consume=true}={}) {
  if(game.format!=='campaign'||!game.finished||!game.complete||game.petId!==pet.id)return false;
  recordChaseCampaign(pet,game,now);
  const record=pet.chaseCampaign?.records?.[game.stageId];
  if(!record?.won||record.rewarded)return false;
  if(consume)record.rewarded=true;return true;
}
