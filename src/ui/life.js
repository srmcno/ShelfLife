import { lifeState, favoriteFor, outingPreview, outingSnapshot, outingTrail, startOuting, chooseOuting, finishOuting, visitorActivity, solveVisitorActivity, displayCurio, selectFrame, marketSnapshot, startMarket, chooseMarket, claimMarket, bestMarketScore, scoreMarket } from '../engine/life.js';
import { OUTINGS, GEAR, RELICS, FRAMES, MARKET_TAGS, MARKET_STALLS } from '../content/life.js';
import { VISITORS } from '../content/stories.js';
import { newCourt, accuseCourt, courtHint } from '../engine/court.js';
import { courtMarkup, mountCourtArt, courtResultMarkup, courtHearing, courtInteract } from './court.js';
import { playStomp } from '../audio/sound.js';
import { curioSVG } from '../art/curios.js';
import { renderPetSprite } from '../art/sprite.js';
import { checkAchievements } from '../engine/achievements.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { save } from '../state.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,extra='')=>'<button class="btn" data-life="'+action+'" '+extra+'>'+label+'</button>';
export function curioDetails(id) {const r=RELICS.find(x=>x.id===id),g=VISITORS.find(x=>x.id===id);return r?{name:r.name,line:r.line,shape:r.shape}:g?{name:g.gift,line:g.name,shape:g.id}:null;}
function art(id){const d=curioDetails(id);return curioSVG(d?.shape||id);}
function sceneArt(state,scene,host) {
 const stage=document.createElement('div');stage.className='tiny-theatre scene-'+(scene?.kind||'welcome');stage.setAttribute('aria-hidden','true');
 const cast=(scene?.cast||state.pets.slice(0,2).map(p=>p.id)).map(id=>state.pets.find(p=>p.id===id)).filter(Boolean).slice(0,2);
 for(const [i,p]of cast.entries()){const wrap=document.createElement('div');wrap.className='scene-actor actor-'+i;wrap.appendChild(renderPetSprite(p));stage.appendChild(wrap);}
 const prop=document.createElement('div');prop.className='scene-object';const key=({raisin:'raisin',case:'scarf',court:'paper',outing:'key',tooth:'tooth',seance:'moon',haunt:'echo',escape:'key',heist:'spoon',will:'receipt',shadow:'echo',parachute:'sock',trial:'paper',forgery:'receipt',care:'button'})[scene?.kind]||'crown';prop.innerHTML=curioSVG(key);stage.appendChild(prop);
 stage.insertAdjacentHTML('afterbegin','<span class="stage-moon"></span><span class="stage-drape"></span>');
 host.appendChild(stage);
}
export function renderLife(state) {
 const l=lifeState(state),hub=document.getElementById('lifeHub');if(!hub)return;
 hub.hidden=!state.pets.length;
 const first=state.pets[0];
 document.body.classList.toggle('settling-in',!!first&&!l.introDone);
 if(!first)return;
 const key=JSON.stringify([l.introDone,l.xp,l.day,l.daily,l.frame,l.displayed,l.scenes[0]?.id,l.outing?.step,l.market?.moves.length,l.market?.claimed,l.marketRuns,l.marketBest,state.pets.map(p=>[p.id,p.name,p.cared]),l.recap]);
 if(hub.dataset.key===key)return;hub.dataset.key=key;
 const next=FRAMES.find(f=>f.at>l.xp), scene=l.scenes[0];
 if(!l.introDone){
  const cared=state.pets.some(p=>(p.careLog?.food||0)+(p.careLog?.fuss||0)+(p.careLog?.clean||0)>0);
  hub.innerHTML='<div class="chapter-intro"><span class="eyebrow">Getting acquainted · '+(cared?'2':'1')+' of 3</span><h2>'+esc(cared?'Make your first shared memory.':'Someone small is counting on you.')+'</h2><p>'+esc(cared?'Play a game together. Your first completed game opens the door to visitors, mysteries and expeditions.':'Start with a little individual care for '+first.name+'. Then try a game together.')+'</p>'+button(cared?'Play together':'Meet '+esc(first.name),cared?'play':'care')+button('Explore everything','skip')+'</div>';
  return;
 }
 hub.innerHTML='<div class="life-heading"><div><span class="eyebrow">Your small world</span><h2>Something worth coming back for.</h2></div><span class="discovery-count">'+l.xp+' discoveries</span></div><div class="life-links">'+button('Play with a resident','play')+button(l.outing?'Continue expedition':'Go beyond the shelf','outing')+button('Shelf Court','court')+button(l.market&&!l.market.claimed?'Continue night market':'Visit the night market','market')+'</div><div class="display-cabinet frame-'+l.frame+'" aria-label="Your displayed curiosities">'+(l.displayed.length?l.displayed.map(id=>{const d=curioDetails(id);return d?'<button class="display-curio" data-life="curio" data-id="'+id+'" aria-label="Inspect '+esc(d.name)+'">'+art(id)+'<span>'+esc(d.name)+'</span></button>':'';}).join(''):'<p>Your first curiosity belongs here.<br><small>Welcome a visitor or bring something home from an expedition.</small></p>')+'</div><div class="display-footer"><span>'+esc(next?next.name+' at '+next.at+' discoveries · '+(next.at-l.xp)+' to go':'Every display finish unlocked. The velvet is impressed.')+'</span>'+button('Arrange display','display')+'</div>'+(scene?'<article class="scene-preview"><div class="scene-mini" id="sceneMini"></div><div><span class="eyebrow">'+(l.recap.length?'While you were out':'Latest household scene')+'</span><h3>'+esc(scene.title)+'</h3><p>'+esc(scene.text)+'</p>'+button(l.recap.length?'Read the recap':'Watch the scene','scene')+'</div></article>':'<div class="scene-empty">The cast is assembled. Their first scene is only a terrible decision away.</div>')+'<p class="life-footnote">Discoveries come from new games, keepsakes and visitor chapters, plus your first care, play, outing, market and visitor activity each day. No streak to lose.</p>';
 if(scene)sceneArt(state,scene,hub.querySelector('#sceneMini'));
}
export function visitorActivityHTML(state) {
 const a=visitorActivity(state);if(!a)return '';
 return '<div class="visitor-activity"><span class="eyebrow">'+(a.complete?'Story complete': 'A small favour · chapter '+Math.min(3,a.chapter+1)+' of 3')+'</span><h3>'+esc(a.title)+'</h3><p>'+esc(a.done?a.response:a.complete?'Three shared chapters. A familiar face with a very long memory.':a.chapter?a.later:a.clue)+'</p>'+(!a.done&&!a.complete?button('Help with their predicament','visitor'):'')+'</div>';
}
export function residentLifeHTML(pet){const fav=favoriteFor(pet);return '<details class="resident-habits"><summary>Little habits & shared history</summary><p><b>'+esc(fav.name)+'</b> · '+esc(fav.line)+'</p><p>'+(pet.expeditions||0)+' expeditions · '+(pet.handshakes||0)+' handshakes · '+(pet.chases||0)+' chases. Completed practice counts too.</p></details>';}
export function initLife(state,refresh) {
 const veil=document.getElementById('lifeVeil'),content=document.getElementById('lifeContent'),title=document.getElementById('lifeTitle');
 let leadId='',companionId='';
 let court=null,selectedRoute='drawer',selectedGear='thread',interlude=false,marketTrade='';
 function open(name){document.querySelectorAll('.veil.open').forEach(v=>{if(v!==veil)v.classList.remove('open');});title.textContent=name;veil.querySelector('.court-announcement')?.replaceChildren();veil.classList.add('open');content.replaceChildren();}
 function close(){veil.classList.remove('open');court=null;veil.querySelector('.court-announcement')?.replaceChildren();}
 document.getElementById('lifeClose').addEventListener('click',close);
 veil.addEventListener('click',e=>{if(e.target===veil)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 function drawScene(scene){
  open(scene.title);sceneArt(state,scene,content);
  content.insertAdjacentHTML('beforeend','<p class="scene-script">'+esc(scene.text)+'</p><div class="life-links">'+button('Replay','replay')+button('Back to the shelf','close')+'</div><div class="scene-history">'+lifeState(state).scenes.slice(0,8).map(s=>button(esc(s.title),'scene-select','data-id="'+s.id+'"')).join('')+'</div>');
  const l=lifeState(state);l.recap=[];save();
 }
 function display(){const l=lifeState(state);open('Your cabinet of curiosities');const ids=[...(state.stories?.collection||[]).map(x=>x.id),...l.relics];content.innerHTML='<p>Pick up to three to display. Choosing a fourth replaces the oldest. Every object has a story.</p><div class="curio-grid">'+ids.map(id=>{const d=curioDetails(id);return d?'<button class="curio-tile '+(l.displayed.includes(id)?'selected':'')+'" data-life="display-toggle" data-id="'+id+'" aria-pressed="'+l.displayed.includes(id)+'">'+art(id)+'<b>'+esc(d.name)+'</b><small>'+esc(d.line)+'</small></button>':'';}).join('')+'</div>'+(!ids.length?'<p class="hint">Your first expedition always brings back an object. A welcomed visitor also leaves a souvenir.</p>'+button('Choose an expedition','outing'):'')+'<h3>Display finishes</h3><div class="frame-choices">'+FRAMES.map(f=>'<button class="btn frame-choice frame-'+f.id+'" data-life="frame" data-id="'+f.id+'" '+(l.xp<f.at?'disabled':'')+' aria-pressed="'+(l.frame===f.id)+'"><b>'+f.name+'</b><small>'+(l.xp<f.at?f.at+' discoveries':f.line)+'</small></button>').join('')+'</div>';}
 function focusOutingProgress(){
  const heading=content.querySelector('h3,.scene-script')||title;
  const sheet=content.closest('.sheet');if(sheet)sheet.scrollTop=0;veil.scrollTop=0;
  heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
 }
 function repaintOutingSetup(id='',route=''){
  const sheet=content.closest('.sheet'),sheetScroll=sheet?.scrollTop||0,veilScroll=veil.scrollTop,mapOpen=!!content.querySelector('.trail-map')?.open;
  outing();
  const map=content.querySelector('.trail-map');if(map)map.open=mapOpen;
  if(sheet)sheet.scrollTop=sheetScroll;veil.scrollTop=veilScroll;
  const control=id?document.getElementById(id):[...content.querySelectorAll('[data-life="route"]')].find(el=>el.dataset.id===route);
  control?.focus({preventScroll:true});
 }
 function outing(){
  const l=lifeState(state),o=outingSnapshot(state);open(o?'An expedition in progress':'Beyond the shelf');
  if(!o){
   if(l.outing){l.outing=null;save();}
   if(!state.pets.some(p=>p.id===leadId))leadId=state.pets[0]?.id||'';
   if(companionId===leadId||!state.pets.some(p=>p.id===companionId))companionId='';
   const crew=state.pets.filter(p=>[leadId,companionId].includes(p.id)),trail=outingTrail(selectedRoute,l.outings%8);
   content.innerHTML='<div class="trail-intro"><span class="eyebrow">A three-stop expedition · No timer</span><h3>Pack one tool. Spend your nerve wisely.</h3><p>Take a detour for points, recover your nerve on the quiet path, or use your equipment once. Each trip brings home a curiosity. The paperwork may suggest otherwise.</p></div><div class="outing-routes">'+OUTINGS.map(r=>'<button class="route-card '+r.tone+'" data-life="route" data-id="'+r.id+'" aria-pressed="'+(selectedRoute===r.id)+'">'+curioSVG(r.id==='drawer'?'sock':r.id==='fridge'?'pea':'key')+'<b>'+r.name+'</b><small>'+r.intro+'</small></button>').join('')+'</div><div class="crew-picker"><label>Lead resident<select id="outingLead">'+state.pets.map(p=>'<option value="'+p.id+'" '+(p.id===leadId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label>Companion<select id="outingCompanion"><option value="">Solo expedition</option>'+state.pets.filter(p=>p.id!==leadId).map(p=>'<option value="'+p.id+'" '+(p.id===companionId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label>Equipment · one use this trip<select id="outingGear">'+GEAR.map(g=>'<option value="'+g.id+'" '+(selectedGear===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label></div><p id="gearHint" class="hint">'+esc(GEAR.find(g=>g.id===selectedGear).hint)+' Matching equipment earns 3 points; improvised equipment earns 1.</p><div class="trail-rules"><span><b>2 nerve</b> to start; hold up to 3</span><span><b>3 points</b> unlock the second curiosity</span><span><b>6 points</b> unlock the third</span></div><details class="trail-map"><summary>Scout this trail before packing</summary><p class="hint">Quiet paths restore 2 nerve and earn no points. A crew stat of 7 or more reduces that stop’s detour cost from 2 nerve to 1.</p>'+trail.map((step,i)=>'<article><span class="eyebrow">Stop '+(i+1)+'</span><b>'+esc(step.title)+'</b><span>Detour: '+step.points+' points / '+(crew.some(p=>(p.stats?.[step.stat]||0)>=7)?1:2)+' nerve · '+step.stat+'</span><small>Equipment match: '+esc(GEAR.find(g=>g.id===step.good).name)+'</small></article>').join('')+'</details>'+button('Pack and head out','set-out');return;
  }
  const r=OUTINGS.find(r=>r.id===o.route);if(!r){l.outing=null;outing();return;}
  const modern=o.version===2;
  if(o.step===3){
   const tier=modern?(o.score>=6?2:o.score>=3?1:0):(o.score>=3?2:o.score>=1?1:0),relic=RELICS.find(x=>x.id===o.route+':'+tier);
   content.innerHTML='<div class="expedition-prize">'+curioSVG(relic.shape)+'<span class="eyebrow">Everyone accounted for. Morally, less certain.</span><h3>'+esc(relic.name)+'</h3><p>'+esc(relic.line)+'</p>'+(modern?'<div class="trail-final-score"><b>'+o.score+'</b><span>trail points<br>'+o.best+' possible with this crew and equipment</span></div><p>'+(o.score===o.best?'A perfect trail. The survivors have agreed never to discuss your methods.':o.score>=6?'A remarkable haul. You may wish to wash your hands before displaying it.':'The trip was a success by the broad standards of people who all came back.')+'</p>':'<p>'+o.score+' of 3 situations supported by your equipment or crew.</p>')+'<p>Everyone gains up to 8 attention.</p></div><ol class="outing-log">'+o.log.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol>'+(modern?'<p class="hint">Curiosities unlock at 0, 3 and 6 points. A new curiosity earns four discoveries, plus one for your first expedition each day. Replays keep the same stops and crew skills.</p><div class="life-links">'+button('Try this trail again','outing-retry')+button('Plan another expedition','outing-next')+button('Display your curiosity','finish-outing')+'</div>':button('Bring it home','finish-outing'));return;
  }
  const step=modern?o.steps[o.step]:r.steps[o.step],crew=state.pets.filter(p=>o.cast.includes(p.id));
  if(interlude){content.innerHTML='<span class="eyebrow">Field report · '+o.step+' of 3</span><p class="scene-script">'+esc(o.log.at(-1))+'</p>'+(modern?'<p class="crew-readout">'+o.score+' points · '+o.nerve+' nerve · '+(o.toolUsed?'equipment used':'equipment ready')+'</p>':'')+button('Continue expedition','continue-outing');return;}
  const p=modern?null:outingPreview(state,o.route,o.gear,o.cast)?.[o.step];
  const choices=modern?o.options.map(option=>button(esc(option.label)+'<small>'+esc(option.hint)+'</small>','outing-choice','data-choice="'+option.choice+'" '+(option.available?'':'disabled'))).join(''):step.options.map((t,i)=>button(esc(t)+'<small>'+esc(i===0?(p?.gear?'Your equipment supports this.':'Best with '+GEAR.find(g=>g.id===step.good).name+'. Improvisation still gets you home.'):(p?.skill?'Your crew has the '+step.stat+' for this.':step.stat+' 7+ helps. Your crew will improvise.'))+'</small>','outing-choice','data-choice="'+i+'"')).join('');
  content.innerHTML='<span class="eyebrow">'+esc(r.name)+' · '+(o.step+1)+' of 3</span>'+(modern?'<ol class="trail-progress" aria-label="Expedition progress">'+o.steps.map((x,i)=>'<li class="'+(i<o.step?'visited':i===o.step?'current':'')+'" '+(i===o.step?'aria-current="step"':'')+'><span>'+(i+1)+'</span>'+esc(x.title)+'</li>').join('')+'</ol>':'')+'<h3>'+esc(step.title)+'</h3><p class="scene-script">'+esc(step.text)+'</p><p class="crew-readout">'+esc(crew.map(p=>p.name).join(' & '))+' · '+esc(GEAR.find(g=>g.id===o.gear)?.name)+'</p>'+(modern?'<div class="trail-supplies"><div><b>'+o.score+'</b><span>trail points</span></div><div><b>'+o.nerve+' / 3</b><span>nerve left</span></div><div><b>'+(o.toolUsed?'Used':'Ready')+'</b><span>packed equipment</span></div></div>':'')+'<div class="expedition-choices '+(modern?'trail-choices':'')+'">'+choices+'</div>'+(modern?'<details class="trail-map"><summary>Look ahead: '+(2-o.step)+' remaining stops</summary>'+o.steps.slice(o.step+1).map(x=>'<article><b>'+esc(x.title)+'</b><span>Detour: '+x.points+' points / '+(o.expertise.includes(x.stat)?1:2)+' nerve · '+x.stat+'</span><small>Equipment match: '+esc(GEAR.find(g=>g.id===x.good).name)+'</small></article>').join('')+(o.step===2?'<p>This is the last stop. Unspent nerve and equipment earn no extra points.</p>':'')+'</details><p class="hint">Everyone comes home. Nerve belongs to this trip and never changes your residents’ needs. Close the window whenever you like; the expedition is saved.</p>':'<p class="hint">Preparation affects which curiosity you find. Every expedition brings something home.</p>');
 }
 function market(){
  open('The Unlicensed Night Market');
  const l=lifeState(state),m=marketSnapshot(state);
  const tags=item=>item.tags.map(t=>'<span class="market-tag tag-'+t+'">'+MARKET_TAGS[t]+'</span>').join('');
  if(!m){
   content.innerHTML='<div class="market-welcome">'+curioSVG('crown')+'<span class="eyebrow">A small game of very questionable shopping</span><h3>Six stalls. Ten buttons. One suspiciously good basket.</h3><p>The household has three shopping requests. Combine objects to fulfil as many as you can, and keep a few buttons in your pocket.</p></div><ol class="market-rules"><li><b>Plan your route.</b> Look ahead at every stall. Buy one of its two objects, or walk past.</li><li><b>Pack carefully.</b> Your bag holds three objects. Once per trip, trade an object back for one button as part of a new purchase.</li><li><b>Make things work together.</b> Each request needs two separate objects. An object can help with several requests.</li></ol><div class="market-score-rule"><b>Your score</b><span>Object charm + 4 per request + unspent buttons</span></div><p class="hint">No timer. Close this window whenever you like; your choices are saved. Buttons belong to this game and reset each trip.</p><div class="life-links">'+button('Enter the night market','market-start')+'</div>';
   return;
  }
  const requests='<div class="market-requests">'+m.requests.map((r,i)=>'<article class="market-request '+(m.score.fulfilled[i]?'fulfilled':'')+'"><span class="eyebrow">'+(m.score.fulfilled[i]?'Fulfilled · +4':'Shopping request · 4 points')+'</span><b>'+esc(r.name)+'</b><div class="market-tags">'+tags(r)+'</div><small>'+esc(r.line)+'</small></article>').join('')+'</div>';
  if(m.complete){
   if(!m.claimed){claimMarket(state);refresh();}
   const best=bestMarketScore(m.seed),tier=m.score.total===best?2:m.score.total>=17?1:0,relic=RELICS.find(r=>r.id==='market:'+tier);
   content.innerHTML='<div class="market-welcome market-results">'+curioSVG(relic.shape)+'<span class="eyebrow">The bag has reached its final form</span><h3>'+m.score.total+' points. '+(m.score.total===best?'A perfect market.':m.score.total>=23?'A suspiciously good haul.':m.score.total>=17?'The receipt is almost respectable.':'An interesting interpretation of shopping.')+'</h3><p>'+esc(relic.name)+'<br>'+esc(relic.line)+'</p></div><div class="market-tally"><div><b>'+m.score.charm+'</b><span>Object charm</span></div><div><b>'+m.score.requestPoints+'</b><span>Requests</span></div><div><b>'+m.buttons+'</b><span>Spare buttons</span></div></div>'+requests+'<div class="market-record"><b>'+best+' points were possible on this route.</b><span>Your all-time best: '+l.marketBest+' · Markets completed: '+l.marketRuns+'</span></div><p class="hint">Retry the exact same stalls to improve your plan, or visit a new arrangement. Keepsakes unlock at 17 points and a perfect route; each new keepsake awards four discoveries. Previously earned keepsakes give no extra discoveries; your first market each day gives one.</p><div class="life-links">'+button('Try this market again','market-retry')+button('Visit a new market','market-start')+button('Display your keepsake','display')+'</div><details class="market-map"><summary>Your final basket</summary>'+m.bag.map(item=>'<p><b>'+esc(item.name)+'</b> · '+item.charm+' charm<br>'+esc(item.line)+'</p>').join('')+(!m.bag.length?'<p>The bag contains a wealth of possibility and absolutely no purchases.</p>':'')+'</details>';
   return;
  }
  const traded=m.bag.find(item=>item.id===marketTrade),available=m.buttons+(traded?1:0),bag=traded?m.bag.filter(item=>item!==traded):m.bag;
  const stall=MARKET_STALLS[m.step];
  content.innerHTML='<div class="market-heading"><div><span class="eyebrow">Stall '+(m.step+1)+' of 6 · No timer</span><h3>'+esc(stall.name)+'</h3><p>'+esc(stall.line)+'</p></div><div class="market-purse"><b>'+m.buttons+'</b><span>buttons left</span></div></div><div class="market-progress" aria-label="Market route, stall '+(m.step+1)+' of 6">'+MARKET_STALLS.map((_,i)=>'<span class="'+(i<m.step?'visited':i===m.step?'current':'')+'" '+(i===m.step?'aria-current="step"':'')+'>'+(i+1)+'</span>').join('')+'</div>'+requests+'<div class="market-bag"><div class="market-bag-heading"><b>Your bag · '+m.bag.length+' / 3</b><span>'+m.score.total+' points if you stop buying</span></div><div class="market-bag-items">'+(m.bag.length?m.bag.map(item=>'<div class="market-packed">'+curioSVG(item.shape)+'<div><b>'+esc(item.name)+'</b><span>'+item.charm+' charm · '+item.tags.map(t=>MARKET_TAGS[t]).join(' / ')+'</span></div></div>').join(''):'<p>Three empty spaces. The household calls this restraint.</p>')+'</div>'+(!m.traded&&m.bag.length?'<label class="market-trade-label">Optional trade-in · one per trip<select id="marketTrade"><option value="">Keep everything in my bag</option>'+m.bag.map(item=>'<option value="'+item.id+'" '+(marketTrade===item.id?'selected':'')+'>Trade '+esc(item.name)+' for 1 button</option>').join('')+'</select></label><p class="hint">A trade happens only when you buy your next object. Walking past keeps your bag intact.</p>':m.traded?'<p class="hint">Your one trade-in has been used.</p>':'')+'</div><div class="market-offers">'+m.stalls[m.step].map(item=>{
   const full=bag.length>=3,short=item.cost>available,disabled=full||short,projected=scoreMarket([...bag,item],available-item.cost,m.requests);
   return '<article class="market-offer">'+curioSVG(item.shape)+'<div class="market-price">'+item.cost+' buttons <span>· '+item.charm+' charm</span></div><h4>'+esc(item.name)+'</h4><div class="market-tags">'+tags(item)+'</div><p>'+esc(item.line)+'</p>'+button(full?'Bag full':short?'Need '+(item.cost-available)+' more button'+(item.cost-available===1?'':'s'):traded?'Trade & buy':'Buy this object','market-buy','data-id="'+item.id+'" '+(disabled?'disabled':''))+'<small>'+(disabled?full?(m.traded?'Pass this stall to finish with your current bag.':'Choose a trade-in above to free a space.'):'Save your buttons for another stall.':'Basket would score '+projected.total+' · '+projected.fulfilled.filter(Boolean).length+' requests fulfilled')+'</small></article>';
  }).join('')+'</div><div class="life-links">'+button(m.step===5?'Finish shopping without buying':'Walk past this stall','market-pass')+'</div><details class="market-map"><summary>Plan ahead: '+(5-m.step)+' remaining stalls and their prices</summary><p class="hint">All stock is shown. Each row is one stall: you can buy at most one object from it.</p>'+m.stalls.slice(m.step+1).map((stock,i)=>'<article><b>'+esc(MARKET_STALLS[m.step+i+1].name)+'</b><div>'+stock.map(item=>'<p><strong>'+esc(item.name)+'</strong><span>'+item.cost+' buttons · '+item.charm+' charm · '+item.tags.map(t=>MARKET_TAGS[t]).join(' / ')+'</span></p>').join('')+'</div></article>').join('')+(!m.stalls.slice(m.step+1).length?'<p>This is the last stall. Your next choice completes the market.</p>':'')+'</details><p class="hint">Score = object charm + 4 per fulfilled request + spare buttons. Two separate objects per request; the same object can help with other requests.</p>';
 }
 let courtLevel=0;
 function courtAnnounce(text){let node=veil.querySelector('.court-announcement');if(!node){node=document.createElement('span');node.className='court-announcement sr-only';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');veil.querySelector('.sheet').appendChild(node);}node.textContent=text;}
 function courtStart(level=courtLevel){courtLevel=level;court=newCourt(state,Math.random,{level});open('Shelf Court');courtPaint();const sheet=content.closest('.sheet');veil.scrollTop=0;if(sheet)sheet.scrollTop=0;content.querySelector('#courtCaseTitle')?.focus({preventScroll:true});courtAnnounce(courtHearing(court).line);}
 function courtPaint(focusSelector){const veilScroll=veil.scrollTop,sheet=content.closest('.sheet'),scroll=sheet?.scrollTop||0,expanded=content.querySelector('.court-case-settings')?.open;content.innerHTML=courtMarkup(court);mountCourtArt(content,court,state);if(expanded)content.querySelector('.court-case-settings').open=true;veil.scrollTop=veilScroll;if(sheet)sheet.scrollTop=scroll;if(focusSelector)content.querySelector(focusSelector)?.focus({preventScroll:true});}
 function visitor(){const a=visitorActivity(state);if(!a||a.done||a.complete)return;open(a.title);content.innerHTML='<span class="eyebrow">A visitor chapter · '+(a.chapter+1)+' of 3</span>'+(a.chapter?'<p>'+esc(a.later)+'</p>':'')+'<div class="court-evidence"><article><b>What you notice</b><p>'+esc(a.clue)+'</p></article></div><div class="expedition-choices">'+a.choices.map((x,i)=>button(esc(x),'visitor-answer','data-choice="'+i+'"')).join('')+'</div><p class="hint">Either choice advances their story. A good observation changes the outcome. Two discoveries for helping, once this visit.</p>';}
 window.addEventListener('shelflife:activity',e=>{
  if(!state.pets.length)return;
  const {action,petId}=e.detail||{};
  if(action==='outing'){if(state.pets.some(p=>p.id===petId))leadId=petId;interlude=false;outing();}
  if(action==='court')courtStart();
  if(action==='market'){marketTrade='';market();}
 });
 document.addEventListener('change',e=>{if(e.target.id==='marketTrade'){marketTrade=e.target.value;market();content.querySelector('#marketTrade')?.focus();}if(['outingLead','outingCompanion','outingGear'].includes(e.target.id)){const id=e.target.id;if(id==='outingLead')leadId=e.target.value;if(id==='outingCompanion')companionId=e.target.value;if(id==='outingGear')selectedGear=e.target.value;repaintOutingSetup(id);}});
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-life]');if(!b)return;
  const action=b.dataset.life,l=lifeState(state);
  if(action==='close'){close();return;}
  if(action==='skip'){l.introDone=true;refresh();return;}
  if(action==='care'){window.dispatchEvent(new CustomEvent('shelflife:care',{detail:{petId:state.pets[0]?.id}}));return;}
  if(action==='play'){open('Choose your accomplice');content.innerHTML='<p>Every game keeps its own reward rest. Completed practice always counts in your history.</p><div class="play-roster">'+state.pets.map(p=>button(esc(p.name),'play-pet','data-id="'+p.id+'"')).join('')+'</div>';return;}
  if(action==='play-pet'){close();window.dispatchEvent(new CustomEvent('shelflife:play',{detail:{petId:b.dataset.id}}));return;}
  if(action==='scene'||action==='scene-select'){const s=action==='scene'?l.scenes[0]:l.scenes.find(x=>x.id===Number(b.dataset.id));if(s)drawScene(s);return;}
  if(action==='replay'){const stage=content.querySelector('.tiny-theatre');stage?.getAnimations({subtree:true}).forEach(a=>{a.currentTime=0;a.play();});return;}
  if(action==='curio'){const d=curioDetails(b.dataset.id);if(!d)return;open(d.name);content.innerHTML='<div class="expedition-prize">'+art(b.dataset.id)+'<p>'+esc(d.line)+'</p></div>'+button('Arrange display','display');return;}
  if(action==='display'){display();return;}
  if(action==='display-toggle'){displayCurio(state,b.dataset.id);refresh();display();return;}
  if(action==='frame'){selectFrame(state,b.dataset.id);refresh();display();return;}
  if(action==='outing'){interlude=false;outing();return;}
  if(action==='route'){selectedRoute=b.dataset.id;repaintOutingSetup('',selectedRoute);return;}
  if(action==='set-out'){const cast=[document.getElementById('outingLead').value,document.getElementById('outingCompanion').value];if(startOuting(state,selectedRoute,selectedGear,cast)){save();interlude=false;outing();refresh();focusOutingProgress();}return;}
  if(action==='outing-choice'){const result=chooseOuting(state,Number(b.dataset.choice));if(result){interlude=!result.complete;refresh();outing();focusOutingProgress();}return;}
  if(action==='continue-outing'){interlude=false;outing();focusOutingProgress();return;}
  if(action==='outing-retry'||action==='outing-next'){
   const previous=outingSnapshot(state);if(!previous||previous.step!==3)return;
   selectedRoute=previous.route;selectedGear=previous.gear;[leadId,companionId='']=previous.cast;
   finishOuting(state);
   if(action==='outing-retry'){
    if(startOuting(state,selectedRoute,selectedGear,previous.cast,{edition:previous.edition}))lifeState(state).outing.expertise=previous.expertise.slice();
   }
   interlude=false;save();refresh();outing();focusOutingProgress();return;
  }
  if(action==='finish-outing'){finishOuting(state);refresh();display();return;}
  if(action==='market'){marketTrade='';market();return;}
  if(action==='market-start'||action==='market-retry'){if(startMarket(state,{replay:action==='market-retry'})){marketTrade='';save();refresh();market();}return;}
  if(action==='market-buy'||action==='market-pass'){if(chooseMarket(state,action==='market-buy'?b.dataset.id:null,action==='market-buy'?marketTrade||null:null)){marketTrade='';save();refresh();market();content.querySelector('.market-heading h3,.market-results h3')?.setAttribute('tabindex','-1');content.querySelector('.market-heading h3,.market-results h3')?.focus({preventScroll:true});}return;}
  if(action==='court'){courtStart();return;}
  if(action==='court-level'){const level=Number(b.dataset.level);if(Number.isInteger(level)&&level>=0&&level<=2)courtStart(level);return;}
  if(action==='court-select'||action==='court-exhibit'||action==='court-object'||action==='court-charge'||action==='court-prosecution'){
   const type=action.slice(6),index=type==='select'?Number(b.dataset.choice):Number(b.dataset.exhibit);
   if(courtInteract(court,type,index)){if(type==='object')playStomp();const focus=type==='select'?'[data-life="court-select"][data-choice="'+index+'"]':type==='exhibit'?'[data-life="court-exhibit"][data-exhibit="'+index+'"]':'[data-life="'+action+'"]';courtPaint(focus);const h=courtHearing(court);courtAnnounce(h.speaker+': '+h.line);}return;
  }
  if(action==='court-hint'){const hint=courtHint(court);if(hint){courtPaint(court.hints.length>=court.rules.length?'.court-guidance':'[data-life="court-hint"]');courtAnnounce(hint);}return;}
  if(action==='court-confirm'){
   if(!court||!Number.isInteger(court.selection)||courtHearing(court).cleared.includes(court.selection))return;
   const result=accuseCourt(state,court,court.selection);if(!result)return;playStomp();checkAchievements(state);checkUnlocks(state);refresh();content.innerHTML=courtResultMarkup(court,result,l.courtWins);mountCourtArt(content,court,state);const sheet=content.closest('.sheet');veil.scrollTop=0;if(sheet)sheet.scrollTop=0;content.querySelector('#courtVerdictTitle')?.focus({preventScroll:true});courtAnnounce((result.correct?'Correct verdict. ':'Suspect acquitted. ')+result.text);return;
  }
  if(action==='visitor'){visitor();return;}
  if(action==='visitor-answer'){if(solveVisitorActivity(state,Number(b.dataset.choice))){const response=state.stories.visitor.activityResponse;refresh();content.innerHTML='<div class="court-result">'+curioSVG(state.stories.visitor.kind)+'<p class="scene-script">'+esc(response)+'</p><p>Two discoveries earned. Their next chapter comes with a return visit.</p></div>'+button('Back to the shelf','close');}return;}
 });
}
