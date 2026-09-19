import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { lifeState, useProject, returnFromMission, favoriteFor, outingSnapshot, startOuting, chooseOuting, finishOuting, visitorActivity, solveVisitorActivity, displayCurio, selectFrame, marketSnapshot, deliverMarket, leaveMarket, startMarket, chooseMarket, claimMarket } from '../engine/life.js';
import { OUTINGS, RELICS, FRAMES } from '../content/life.js';
import { VISITORS } from '../content/stories.js';
import { startCourt, currentCourt, courtAction, finishCourt } from '../engine/court.js';
import { courtMarkup, mountCourtArt, courtFinishedMarkup, courtHearing, courtView, courtResponse } from './court.js';
import { playStomp } from '../audio/sound.js';
import { curioSVG } from '../art/curios.js';
import { renderPetSprite } from '../art/sprite.js';
import { mountHouseholdScene } from '../art/household-scene.js';
import { marketMarkup, marketSelectedOffer, mountMarketRecipients } from './market.js';
import { projectBoard, expeditionView, mountExpedition } from './expeditions.js';
import { checkAchievements } from '../engine/achievements.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { save } from '../state.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,extra='')=>'<button class="btn" data-life="'+action+'" '+extra+'>'+label+'</button>';
export function sceneHistoryMarkup(scenes,pets,filter=''){const cast=pets.filter(p=>scenes.some(s=>s.cast?.includes(p.id)));const visible=filter?scenes.filter(s=>s.cast?.includes(filter)):scenes;return '<h3>Household memories</h3><div class="life-links" aria-label="Filter memories by resident">'+button('Everyone','scene-filter','data-id="" aria-pressed="'+!filter+'"')+cast.map(p=>button(esc(p.name),'scene-filter','data-id="'+esc(p.id)+'" aria-pressed="'+(filter===p.id)+'"')).join('')+'</div><p>'+visible.length+' saved scene'+(visible.length===1?'':'s')+'</p><div class="scene-history">'+visible.map(s=>button(esc(s.title),'scene-select','data-id="'+s.id+'"')).join('')+'</div>'; }
export function projectHomeTarget(o){return ['drawer','fridge','cupboard'].includes(o?.route)?'.project-'+o.route+' [data-life="'+(o.parts?.length>=2?'use-project':'project-mission')+'"]':'.household-workshop';}
export function curioDetails(id) {const r=RELICS.find(x=>x.id===id),g=VISITORS.find(x=>x.id===id);return r?{name:r.name,line:r.line,shape:r.shape}:g?{name:g.gift,line:g.name,shape:g.id}:null;}
function art(id){const d=curioDetails(id);return curioSVG(d?.shape||id);}
export function renderLife(state) {
 const l=lifeState(state),hub=document.getElementById('lifeHub');if(!hub)return;
 hub.hidden=!state.pets.length;
 const first=state.pets[0];
 document.body.classList.toggle('settling-in',!!first&&!l.introDone);
 if(!first)return;
 const key=JSON.stringify([l.introDone,l.xp,l.projects,l.projectParts,l.day,l.daily,l.frame,l.displayed,l.scenes[0]?.id,l.outing?.step,l.market?.moves.length,l.market?.claimed,l.marketRuns,l.marketBest,state.pets.map(p=>[p.id,p.name,p.cared]),l.recap]);
 if(hub.dataset.key===key)return;hub.dataset.key=key;
 const next=FRAMES.find(f=>f.at>l.xp), scene=l.scenes[0];
 if(!l.introDone){
  const cared=state.pets.some(p=>(p.careLog?.food||0)+(p.careLog?.fuss||0)+(p.careLog?.clean||0)>0);
  hub.innerHTML='<div class="chapter-intro"><span class="eyebrow">Getting acquainted · '+(cared?'2':'1')+' of 3</span><h2>'+esc(cared?'Make your first shared memory.':'Someone small is counting on you.')+'</h2><p>'+esc(cared?'Play a game together. Your first completed game opens the door to visitors, mysteries and expeditions.':'Start with a little individual care for '+first.name+'. Then try a game together.')+'</p>'+button(cared?'Play together':'Meet '+esc(first.name),cared?'play':'care')+button('Explore everything','skip')+'</div>';
  return;
 }
 hub.innerHTML='<div class="life-heading"><div><span class="eyebrow">Your small world</span><h2>Something worth coming back for.</h2></div><span class="discovery-count">'+l.xp+' discoveries</span></div><div class="life-links">'+button('Open the playroom','play')+(l.outing?button('Continue expedition','outing'):'')+(l.market&&!l.market.claimed?button('Continue night market','market'):'')+'</div><div class="display-cabinet frame-'+l.frame+'" aria-label="Your displayed curiosities">'+(l.displayed.length?l.displayed.map(id=>{const d=curioDetails(id);return d?'<button class="display-curio" data-life="curio" data-id="'+id+'" aria-label="Inspect '+esc(d.name)+'">'+art(id)+'<span>'+esc(d.name)+'</span></button>':'';}).join(''):'<div class="display-empty"><p>'+((l.relics.length||(state.stories?.collection||[]).length)?'You have keepsakes ready to display.<br><small>Choose Arrange display below to place up to three in this cabinet.</small>':'Your first curiosity belongs here.<br><small>Finish an expedition or welcome a visitor to earn a keepsake. Then choose Arrange display to put it here.</small>')+'</p></div>')+'</div><div class="display-footer"><span>'+esc(next?next.name+' at '+next.at+' discoveries · '+(next.at-l.xp)+' to go':'Every display finish unlocked. The velvet is impressed.')+'</span>'+button('Arrange display','display')+'</div>'+(scene?'<article class="scene-preview"><div class="scene-mini" id="sceneMini"></div><div><span class="eyebrow">'+(l.recap.length?'While you were out':'Latest household scene')+'</span><h3>'+esc(scene.title)+'</h3><p>'+esc(scene.text)+'</p>'+button(l.recap.length?'Read the recap':'Watch the scene','scene')+'</div></article>':'<div class="scene-empty">Your shared memories will play here. Finish a game, help a visitor or return from an expedition to create the first scene.</div>')+'<p class="life-footnote">Discoveries come from new games, keepsakes and visitor chapters, plus your first care, play, outing, market and visitor activity each day. No streak to lose.</p>';
 hub.querySelector('.display-cabinet').insertAdjacentHTML('beforebegin',projectBoard(l));
 hub.querySelectorAll('.project-occupant').forEach(holder=>holder.appendChild(renderPetSprite(first)));
 if(scene)mountHouseholdScene(hub.querySelector('#sceneMini'),state,scene,{mini:true});
}
export function visitorActivityHTML(state) {
 const a=visitorActivity(state);if(!a)return '';
 return '<div class="visitor-activity"><span class="eyebrow">'+(a.complete?'Story complete': 'A small favour · chapter '+Math.min(3,a.chapter+1)+' of 3')+'</span><h3>'+esc(a.title)+'</h3><p>'+esc(a.done?a.response:a.complete?'Three shared chapters. A familiar face with a very long memory.':a.chapter?a.later:a.clue)+'</p>'+(!a.done&&!a.complete?button('Help with their predicament','visitor'):'')+'</div>';
}
export function residentLifeHTML(pet){const fav=favoriteFor(pet);return '<details class="resident-habits"><summary>Little habits & shared history</summary><p><b>'+esc(fav.name)+'</b> · '+esc(fav.line)+'</p><p>'+(pet.expeditions||0)+' expeditions · '+(pet.handshakes||0)+' handshakes · '+(pet.chases||0)+' chases. Completed practice counts too.</p></details>';}
export function initLife(state,refresh) {
 const veil=document.getElementById('lifeVeil'),content=document.getElementById('lifeContent'),title=document.getElementById('lifeTitle');
 let leadId='',companionId='',scenePlayback=null,sceneFilter='';
 let court=null,selectedRoute='drawer',selectedGear='thread',interlude=false,marketTrade='',selectedDare='',marketAction=null,marketSelection='',marketPanel='';
 function open(name){scenePlayback?.destroy();scenePlayback=null;document.querySelectorAll('.veil.open').forEach(v=>{if(v!==veil)v.classList.remove('open');});title.textContent=name;veil.classList.toggle('court-mode',name==='Shelf Court');const outing=['Beyond the shelf','An expedition in progress'].includes(name),market=name==='The Unlicensed Night Market';veil.classList.toggle('life-game-mode',outing||market);veil.classList.toggle('outing-mode',outing);veil.classList.toggle('market-mode',market);veil.querySelector('.court-announcement')?.replaceChildren();veil.classList.add('open');content.replaceChildren();}
 function close(){scenePlayback?.destroy();scenePlayback=null;veil.classList.remove('open','court-mode','life-game-mode','outing-mode','market-mode');court=null;veil.querySelector('.court-announcement')?.replaceChildren();}
 document.getElementById('lifeClose').addEventListener('click',close);
 veil.addEventListener('click',e=>{if(e.target===veil)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 function drawScene(scene){
  open(scene.title);scenePlayback=mountHouseholdScene(content,state,scene);
  content.insertAdjacentHTML('beforeend','<p class="scene-script">'+esc(scene.text)+'</p><div class="life-links">'+button('Back to the shelf','close')+button('Museum & case archive','scene-museum')+(scene.cast||[]).map(id=>state.pets.find(p=>p.id===id)).filter(Boolean).map(p=>button('Notes about '+esc(p.name),'scene-notes','data-id="'+p.id+'"')).join('')+'</div><section id="sceneHistory">'+sceneHistoryMarkup(lifeState(state).scenes,state.pets,sceneFilter)+'</section>');
  content.closest('.sheet')?.scrollTo({top:0});title.tabIndex=-1;title.focus({preventScroll:true});
  const l=lifeState(state);l.recap=[];save();
 }
 function display(){const l=lifeState(state);open('Your cabinet of curiosities');const ids=[...(state.stories?.collection||[]).map(x=>x.id),...l.relics];content.innerHTML='<p>Pick up to three to display. Choosing a fourth replaces the oldest. Every object has a story.</p><div class="curio-grid">'+ids.map(id=>{const d=curioDetails(id);return d?'<button class="curio-tile '+(l.displayed.includes(id)?'selected':'')+'" data-life="display-toggle" data-id="'+id+'" aria-pressed="'+l.displayed.includes(id)+'">'+art(id)+'<b>'+esc(d.name)+'</b><small>'+esc(d.line)+'</small></button>':'';}).join('')+'</div>'+(!ids.length?'<p class="hint">Your first expedition always brings back an object. A welcomed visitor also leaves a souvenir.</p>'+button('Choose an expedition','outing'):'')+'<h3>Display finishes</h3><div class="frame-choices">'+FRAMES.map(f=>'<button class="btn frame-choice frame-'+f.id+'" data-life="frame" data-id="'+f.id+'" '+(l.xp<f.at?'disabled':'')+' aria-pressed="'+(l.frame===f.id)+'"><b>'+f.name+'</b><small>'+(l.xp<f.at?f.at+' discoveries':f.line)+'</small></button>').join('')+'</div>';}
 function focusOutingProgress(){
  const heading=content.querySelector('h3,.scene-script')||title;content.querySelector('.adventure-scroll')?.scrollTo({top:0});
  const sheet=content.closest('.sheet');if(sheet)sheet.scrollTop=0;veil.scrollTop=0;
  heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
 }
 function repaintOutingSetup(id='',route=''){
  const sheet=content.closest('.sheet'),sheetScroll=sheet?.scrollTop||0,veilScroll=veil.scrollTop,mapOpen=!!content.querySelector('.trail-map')?.open,paneScroll=content.querySelector('.adventure-scroll')?.scrollTop||0,wagerOpen=!!content.querySelector('.trail-wager-settings')?.open;
  outing();
  const map=content.querySelector('.trail-map');if(map)map.open=mapOpen;const pane=content.querySelector('.adventure-scroll');if(pane)pane.scrollTop=paneScroll;const wager=content.querySelector('.trail-wager-settings');if(wager)wager.open=wagerOpen;
  if(sheet)sheet.scrollTop=sheetScroll;veil.scrollTop=veilScroll;
  const control=id?document.getElementById(id):[...content.querySelectorAll('[data-life="route"]')].find(el=>el.dataset.id===route);
  control?.focus({preventScroll:true});
 }
 function outing(){
  const l=lifeState(state),o=outingSnapshot(state);
  if(o&&!OUTINGS.some(route=>route.id===o.route)){l.outing=null;save();outing();return;}
  if(!o){
   if(l.outing){l.outing=null;save();}
   if(!state.pets.some(p=>p.id===leadId))leadId=state.pets[0]?.id||'';
   if(companionId===leadId||!state.pets.some(p=>p.id===companionId))companionId='';
  }
  open(o?'An expedition in progress':'Beyond the shelf');
  const view=expeditionView(state,o,{route:selectedRoute,gear:selectedGear,lead:leadId,companion:companionId,dare:selectedDare,interlude});
  title.textContent=view.title;content.innerHTML=view.html;mountExpedition(content,view);
 }

 function market(){
  open('The Unlicensed Night Market');
  let m=marketSnapshot(state);
  if(m?.complete&&!m.claimed){claimMarket(state);refresh();m=marketSnapshot(state);}
  if(m&&!m.complete)marketSelection=marketSelectedOffer(m,marketSelection,marketTrade)?.id||'';
  content.innerHTML=marketMarkup(state,m,marketTrade,marketAction,marketSelection,marketPanel);
  mountMarketRecipients(content,state);
 }
 function focusMarketProgress(){
  content.querySelector('.adventure-scroll')?.scrollTo({top:0});
  const sheet=content.closest('.sheet');if(sheet)sheet.scrollTop=0;veil.scrollTop=0;
  content.querySelector('.market-heading h3,.market-results h3')?.focus({preventScroll:true});
 }

 let courtLevel=undefined,courtHostId='';
 function courtAnnounce(text){let node=veil.querySelector('.court-announcement');if(!node){node=document.createElement('span');node.className='court-announcement sr-only';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');veil.querySelector('.sheet').appendChild(node);}node.textContent=text;}
 function courtStart(level=undefined,fresh=false){
  const options={level,reworked:true,petId:courtHostId||state.pets[0]?.id};court=fresh?startCourt(state,options):currentCourt(state)||startCourt(state,options);if(!court)return;
  courtLevel=court.level;open('Shelf Court');save();courtPaint('#courtCaseTitle,#courtVerdictTitle');courtAnnounce(courtHearing(court).line);
 }
 function courtPaint(focusSelector,resetPanel=false){
  const panelScroll=resetPanel?0:content.querySelector('.court-action-panel')?.scrollTop||0,workspaceScroll=resetPanel?0:content.querySelector('.court-workspace')?.scrollTop||0;
  const notebookOpen=content.querySelector('.court-notebook')?.open||false;
  content.innerHTML=court.claimed&&court.result?courtFinishedMarkup(court,court.result,lifeState(state).courtWins):courtMarkup(court);
  mountCourtArt(content,court,state);const panel=content.querySelector('.court-action-panel');if(panel)panel.scrollTop=panelScroll;
  const notebook=content.querySelector('.court-notebook');if(notebook)notebook.open=notebookOpen;
  const workspace=content.querySelector('.court-workspace');if(workspace)workspace.scrollTop=workspaceScroll;
  veil.scrollTop=0;const sheet=content.closest('.sheet');if(sheet)sheet.scrollTop=0;
  if(focusSelector)(content.querySelector(focusSelector)||content.querySelector('#courtPanelTitle,#courtVerdictTitle'))?.focus({preventScroll:true});
 }
 function courtMove(move,focusSelector,resetPanel=false){
  const response=courtAction(state,move);if(!response)return false;
  court=currentCourt(state);if(response.kind!=='focus')courtResponse(court,response);
  if(['sustained','overruled'].includes(response.kind))playStomp();
  save();courtPaint(focusSelector,resetPanel);if(response.kind!=='focus')courtAnnounce(response.speaker+': '+response.text);return true;
 }
 content.addEventListener('change',e=>{
  if(e.target.id!=='courtWitness'||!court||court.claimed)return;
  const suspect=Number(e.target.value),view=courtView(court);
  courtMove(view.chapter==='hearing'?{type:'question',suspect}:{type:'focus',suspect},'#courtWitness',true);
 });
 function visitor(){const a=visitorActivity(state);if(!a||a.done||a.complete)return;open(a.title);content.innerHTML='<span class="eyebrow">A visitor chapter · '+(a.chapter+1)+' of 3</span>'+(a.chapter?'<p>'+esc(a.later)+'</p>':'')+'<div class="court-evidence"><article><b>What you notice</b><p>'+esc(a.clue)+'</p></article></div><div class="expedition-choices">'+a.choices.map((x,i)=>button(esc(x),'visitor-answer','data-choice="'+i+'"')).join('')+'</div><p class="hint">Either choice advances their story. A good observation changes the outcome. Two discoveries for helping, once this visit.</p>';}
 window.addEventListener('shelflife:activity',e=>{
  if(!state.pets.length)return;
  const {action,petId}=e.detail||{};
  if(action==='outing'){if(state.pets.some(p=>p.id===petId))leadId=petId;interlude=false;outing();}
  if(action==='court'){if(state.pets.some(p=>p.id===petId))courtHostId=petId;courtStart();}
  if(action==='market'){if(state.pets.some(p=>p.id===petId))leadId=petId;marketTrade='';marketAction=null;marketSelection='';marketPanel='';market();focusMarketProgress();}
 });
 document.addEventListener('change',e=>{if(e.target.id==='marketTrade'){marketTrade=e.target.value;market();content.querySelector('#marketTrade')?.focus();}if(['outingLead','outingCompanion','outingGear','outingDare'].includes(e.target.id)){const id=e.target.id;if(id==='outingLead')leadId=e.target.value;if(id==='outingCompanion')companionId=e.target.value;if(id==='outingGear')selectedGear=e.target.value;if(id==='outingDare')selectedDare=e.target.value;repaintOutingSetup(id);}});
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-life]');if(!b)return;
  const action=b.dataset.life,l=lifeState(state);
  if(action==='close'){close();return;}
  if(action==='skip'){l.introDone=true;refresh();return;}
  if(action==='care'){window.dispatchEvent(new CustomEvent('shelflife:care',{detail:{petId:state.pets[0]?.id}}));return;}
  if(action==='play'){close();document.getElementById('playroomBtn')?.click();return;}
  if(action==='scene-filter'){sceneFilter=b.dataset.id||'';const history=document.getElementById('sceneHistory');history.innerHTML=sceneHistoryMarkup(l.scenes,state.pets,sceneFilter);[...history.querySelectorAll('[data-life="scene-filter"]')].find(el=>el.dataset.id===sceneFilter)?.focus({preventScroll:true});return;}
  if(action==='scene-museum'){close();document.getElementById('museumBtn')?.click();return;}
  if(action==='scene-notes'){const pet=state.pets.find(p=>p.id===b.dataset.id);if(pet){close();import('./render.js').then(({setPetFilter})=>{setPetFilter(state,pet.name);document.querySelector('[data-filter="all"]')?.click();window.dispatchEvent(new CustomEvent('shelflife:goto',{detail:{tab:'notes',target:'#noteFilters'}}));});}return;}
  if(action==='play-pet'){close();window.dispatchEvent(new CustomEvent('shelflife:play',{detail:{petId:b.dataset.id}}));return;}
  if(action==='scene'||action==='scene-select'){const s=action==='scene'?l.scenes[0]:l.scenes.find(x=>x.id===Number(b.dataset.id));if(s)drawScene(s);return;}
  if(action==='curio'){const d=curioDetails(b.dataset.id);if(!d)return;open(d.name);content.innerHTML='<div class="expedition-prize">'+art(b.dataset.id)+'<p>'+esc(d.line)+'</p></div>'+button('Arrange display','display');return;}
  if(action==='display'){display();return;}
  if(action==='display-toggle'){displayCurio(state,b.dataset.id);refresh();display();return;}
  if(action==='frame'){selectFrame(state,b.dataset.id);refresh();display();return;}
  if(action==='outing'){interlude=false;outing();return;}
  if(action==='project-mission'){selectedRoute=b.dataset.id;interlude=false;outing();focusOutingProgress();return;}
  if(action==='project-home'){const target=projectHomeTarget(outingSnapshot(state));finishOuting(state);close();save();refresh();window.dispatchEvent(new CustomEvent('shelflife:goto',{detail:{tab:'shelf',target}}));return;}
  if(action==='use-project'){
   const result=useProject(state,b.dataset.id);if(!result)return;save();refresh();
   const card=document.querySelector('.project-'+b.dataset.id);if(card){card.classList.remove('project-in-use');void card.offsetWidth;card.classList.add('project-in-use');}
   const line=card?.querySelector('.project-reaction');if(line)line.textContent=result.text+(result.fresh?' Daily care delivered.':' Today’s care already delivered. Play again whenever you like.');card?.querySelector('[data-life="use-project"]')?.focus({preventScroll:true});playStomp();return;
  }
  if(action==='route'){selectedRoute=b.dataset.id;repaintOutingSetup('',selectedRoute);return;}
  if(action==='set-out'||action==='outing-practice'){const cast=[document.getElementById('outingLead').value,document.getElementById('outingCompanion').value];if(startOuting(state,selectedRoute,selectedGear,cast,{dare:selectedDare,mission:true,learning:true,practice:action==='outing-practice'})){save();interlude=false;outing();refresh();focusOutingProgress();}return;}
  if(action==='outing-choice'){const result=chooseOuting(state,Number(b.dataset.choice));if(result){interlude=!result.complete;refresh();outing();focusOutingProgress();}return;}
  if(action==='outing-return'){if(returnFromMission(state)){interlude=false;save();refresh();outing();focusOutingProgress();}return;}
  if(action==='continue-outing'){interlude=false;outing();focusOutingProgress();return;}
  if(action==='outing-retry'||action==='outing-next'){
   const previous=outingSnapshot(state);if(!previous||previous.step!==3)return;
   selectedRoute=previous.route;selectedGear=previous.gear;selectedDare=previous.dare||'';[leadId,companionId='']=previous.cast;
   finishOuting(state);
   if(action==='outing-retry'){
    if(startOuting(state,selectedRoute,selectedGear,previous.cast,{edition:previous.edition,dare:previous.dare,mission:previous.mission===true,missionRevision:previous.missionRevision||1}))lifeState(state).outing.expertise=previous.expertise.slice();
   }
   interlude=false;save();refresh();outing();focusOutingProgress();return;
  }
  if(action==='finish-outing'){finishOuting(state);refresh();display();return;}
  if(action==='market'){marketTrade='';marketAction=null;marketSelection='';marketPanel='';market();focusMarketProgress();return;}
  if(action==='market-start'||action==='market-retry'||action==='market-practice'){if(startMarket(state,{replay:action==='market-retry',practice:action==='market-practice',learning:true,errands:true,petId:leadId})){marketTrade='';marketAction=null;marketSelection='';marketPanel='';save();refresh();market();focusMarketProgress();}return;}
  if(action==='market-select'){const m=marketSnapshot(state);if(!m||m.complete||!m.stalls[m.step].some(item=>item.id===b.dataset.id))return;const scroll=content.querySelector('.adventure-scroll')?.scrollTop||0;marketSelection=b.dataset.id;market();const pane=content.querySelector('.adventure-scroll');if(pane)pane.scrollTop=scroll;content.querySelector('[data-life="market-select"][data-id="'+marketSelection+'"]')?.focus({preventScroll:true});return;}
  if(action==='market-panel'){const panel=b.dataset.panel||'';if(!['','requests','bag','route'].includes(panel))return;marketPanel=panel===marketPanel?'':panel;market();content.querySelector('.adventure-scroll')?.scrollTo({top:0});(content.querySelector('.market-context-panel')||content.querySelector('.market-heading h3'))?.focus({preventScroll:true});return;}
  if(action==='market-deliver'||action==='market-leave'){
   const ok=action==='market-deliver'?deliverMarket(state,b.dataset.request,(b.dataset.items||'').split(',')):leaveMarket(state);
   if(ok){marketTrade='';marketSelection='';marketAction=null;save();refresh();market();focusMarketProgress();}return;
  }
  if(action==='market-buy'||action==='market-pass'||action==='market-secret'){const before=marketSnapshot(state);if(chooseMarket(state,action==='market-buy'?b.dataset.id:null,action==='market-buy'?marketTrade||null:null,{secret:action==='market-secret'})){marketAction={kind:action.slice(7),step:before.step,item:before.stalls[before.step].find(item=>item.id===b.dataset.id)};marketTrade='';marketSelection='';marketPanel='';save();refresh();market();focusMarketProgress();}return;}
  if(action==='court'){courtStart();return;}
  if(action==='court-new'){courtStart(undefined,true);return;}
  if(action==='court-clue'){
   if(!court||court.claimed)return;const clue=Number(b.dataset.clue),rule=court.rules[clue];if(!rule)return;
   courtAction(state,{type:'focus',statement:clue,evidence:rule.first.axis});
   if(court.version===3){for(const atom of [rule.first,rule.second].filter(Boolean))courtAction(state,{type:'inspect',evidence:atom.axis});court=currentCourt(state);courtResponse(court,{kind:'inspect',speaker:'Court examiner',text:court.clues[clue]});save();courtPaint('#courtPanelTitle');courtAnnounce(courtHearing(court).line);return;}
   if(!court.inspected.includes(rule.first.axis))courtMove({type:'inspect',evidence:rule.first.axis},'#courtPanelTitle');
   else{court=currentCourt(state);save();courtPaint('#courtPanelTitle');}return;
  }
  if(action==='court-call'){
   if(!court||court.claimed)return;const suspect=Number(b.dataset.choice),v=courtView(court);if(!court.suspects[suspect])return;
   courtAction(state,{type:'focus',suspect});court=currentCourt(state);
   courtResponse(court,{kind:'testimony',speaker:court.suspects[suspect].name,text:court.suspects[suspect].memory||court.suspects[suspect].defence});save();courtPaint('#courtPanelTitle');courtAnnounce(courtHearing(court).line);return;
  }
  if(action==='court-pair'){
   if(!court||court.claimed)return;const suspect=Number(b.dataset.choice),clue=Number(b.dataset.clue);
   if(!Number.isInteger(suspect)||!Number.isInteger(clue)||!court.suspects[suspect]||!court.rules[clue])return;
   courtAction(state,{type:'focus',chapter:'hearing',suspect,statement:clue,evidence:court.rules[clue].first.axis});court=currentCourt(state);
   courtResponse(court,{kind:'testimony',speaker:court.suspects[suspect].name,text:court.suspects[suspect].memory||court.suspects[suspect].defence});save();courtPaint('[data-life="court-pair"][data-choice="'+suspect+'"][data-clue="'+clue+'"]');courtAnnounce('Comparing '+court.suspects[suspect].name+' with clue '+(clue+1)+'. No argument submitted.');return;
  }
  if(action==='court-compare'){
   if(!court||court.claimed)return;const v=courtView(court);courtMove({type:'compare',suspect:v.witness,evidence:Math.min(v.statement,court.rules.length-1)},'#courtPanelTitle');return;
  }
  if(action==='court-level'){const level=Number(b.dataset.level);if(Number.isInteger(level)&&level>=0&&level<=2)courtStart(level,true);return;}
  if(action==='court-chapter'){
   if(!court||court.claimed)return;const chapter=b.dataset.chapter,view=courtView(court);
   if(!['investigation','hearing','verdict'].includes(chapter))return;
   let suspect=view.witness;
   if(chapter==='verdict'&&[...(court.eliminations||[]),...(court.rejected||[])].includes(suspect)){
    const remaining=court.suspects.findIndex((_,i)=>!(court.eliminations||[]).includes(i)&&!(court.rejected||[]).includes(i));
    if(remaining>=0)suspect=remaining;
   }
   courtAction(state,{type:'focus',chapter,suspect,statement:view.statement,evidence:view.exhibit});
   if(chapter==='hearing')courtMove({type:'question',suspect:view.witness},'#courtPanelTitle',true);
   else{court=currentCourt(state);save();courtPaint('#courtPanelTitle',true);}return;
  }
  if(action==='court-view-exhibit'){
   const evidence=Number(b.dataset.exhibit);courtMove({type:'focus',evidence},'[data-life="court-view-exhibit"][data-exhibit="'+evidence+'"]');return;
  }
  if(action==='court-inspect'){
   if(!court||court.claimed)return;const evidence=Number(b.dataset.exhibit);
   if(!Number.isInteger(evidence)||!court.sceneEvidence[evidence])return;
   courtAction(state,{type:'focus',evidence});
   if(court.inspected.includes(evidence)){
    court=currentCourt(state);const item=court.sceneEvidence[evidence];courtResponse(court,{kind:'evidence',speaker:'Court examiner',text:item.description+' '+item.clue});save();courtPaint('#courtPanelTitle',true);courtAnnounce(courtHearing(court).line);
   }else courtMove({type:'inspect',evidence},'#courtPanelTitle',true);return;
  }
  if(action==='court-statement'){
   if(!court||court.claimed)return;const statement=Number(b.dataset.statement);
   if(!Number.isInteger(statement)||statement<0||statement>2)return;
   courtAction(state,{type:'focus',statement});court=currentCourt(state);const v=courtView(court);
   courtResponse(court,{kind:'testimony',speaker:court.suspects[v.witness].name,text:court.witnesses[v.witness].statements[statement].text});save();courtPaint('[data-life="court-statement"][data-statement="'+statement+'"]');courtAnnounce(courtHearing(court).line);return;
  }
  if(action==='court-next-witness'){
   if(!court||court.claimed)return;const v=courtView(court),next=court.witnesses.findIndex((w,i)=>i!==v.witness&&!w.exposed);
   courtMove({type:'question',suspect:next<0?(v.witness+1)%court.suspects.length:next},'#courtWitness',true);return;
  }
  if(action==='court-press'||action==='court-present'){
   if(!court||court.claimed)return;const v=courtView(court);
   courtMove({type:action==='court-press'?'press':'present',suspect:v.witness,statement:v.statement,evidence:v.exhibit},'.court-action-bar .btn:not(:disabled)');return;
  }
  if(action==='court-charge'){
   if(!court||court.claimed)return;courtResponse(court,{kind:'evidence',speaker:'Clerk of the deceased',text:court.trial.charge+' '+court.intro});courtPaint('[data-life="court-charge"]');courtAnnounce(courtHearing(court).line);return;
  }
  if(action==='court-hint'){courtMove({type:'hint'},'[data-life="court-hint"]');return;}
  if(action==='court-file'){
   if(!court||court.claimed)return;const result=finishCourt(state,courtView(court).witness);if(!result)return;
   court=currentCourt(state);playStomp();checkAchievements(state);checkUnlocks(state);save();refresh();
   if(result.retry){courtAction(state,{type:'focus',chapter:'verdict'});court=currentCourt(state);courtPaint('#courtPanelTitle',true);courtAnnounce(result.text);}
   else{courtPaint('#courtVerdictTitle',true);courtAnnounce('Correct verdict. '+result.text);}return;
  }
  if(action==='visitor'){visitor();return;}
  if(action==='visitor-answer'){if(solveVisitorActivity(state,Number(b.dataset.choice))){const response=state.stories.visitor.activityResponse;refresh();content.innerHTML='<div class="court-result">'+curioSVG(state.stories.visitor.kind)+'<p class="scene-script">'+esc(response)+'</p><p>Two discoveries earned. Their next chapter comes with a return visit.</p></div>'+button('Back to the shelf','close');}return;}
 });
}
