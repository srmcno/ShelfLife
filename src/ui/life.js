import { lifeState, favoriteFor, outingPreview, startOuting, chooseOuting, finishOuting, visitorActivity, solveVisitorActivity, displayCurio, selectFrame } from '../engine/life.js';
import { OUTINGS, GEAR, RELICS, FRAMES } from '../content/life.js';
import { VISITORS } from '../content/stories.js';
import { newCourt, accuseCourt } from '../engine/court.js';
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
 const key=JSON.stringify([l.introDone,l.xp,l.day,l.daily,l.frame,l.displayed,l.scenes[0]?.id,l.outing?.step,state.pets.map(p=>[p.id,p.name,p.cared]),l.recap]);
 if(hub.dataset.key===key)return;hub.dataset.key=key;
 const next=FRAMES.find(f=>f.at>l.xp), scene=l.scenes[0];
 if(!l.introDone){
  const cared=state.pets.some(p=>(p.careLog?.food||0)+(p.careLog?.fuss||0)+(p.careLog?.clean||0)>0);
  hub.innerHTML='<div class="chapter-intro"><span class="eyebrow">Getting acquainted · '+(cared?'2':'1')+' of 3</span><h2>'+esc(cared?'Make your first shared memory.':'Someone small is counting on you.')+'</h2><p>'+esc(cared?'Play a game together. Your first completed game opens the door to visitors, mysteries and expeditions.':'Start with a little individual care for '+first.name+'. Then try a game together.')+'</p>'+button(cared?'Play together':'Meet '+esc(first.name),cared?'play':'care')+button('Explore everything','skip')+'</div>';
  return;
 }
 hub.innerHTML='<div class="life-heading"><div><span class="eyebrow">Your small world</span><h2>Something worth coming back for.</h2></div><span class="discovery-count">'+l.xp+' discoveries</span></div><div class="life-links">'+button('Play with a resident','play')+button(l.outing?'Continue expedition':'Go beyond the shelf','outing')+button('Shelf Court','court')+'</div><div class="display-cabinet frame-'+l.frame+'" aria-label="Your displayed curiosities">'+(l.displayed.length?l.displayed.map(id=>{const d=curioDetails(id);return d?'<button class="display-curio" data-life="curio" data-id="'+id+'" aria-label="Inspect '+esc(d.name)+'">'+art(id)+'<span>'+esc(d.name)+'</span></button>':'';}).join(''):'<p>Your first curiosity belongs here.<br><small>Welcome a visitor or bring something home from an expedition.</small></p>')+'</div><div class="display-footer"><span>'+esc(next?next.name+' at '+next.at+' discoveries · '+(next.at-l.xp)+' to go':'Every display finish unlocked. The velvet is impressed.')+'</span>'+button('Arrange display','display')+'</div>'+(scene?'<article class="scene-preview"><div class="scene-mini" id="sceneMini"></div><div><span class="eyebrow">'+(l.recap.length?'While you were out':'Latest household scene')+'</span><h3>'+esc(scene.title)+'</h3><p>'+esc(scene.text)+'</p>'+button(l.recap.length?'Read the recap':'Watch the scene','scene')+'</div></article>':'<div class="scene-empty">The cast is assembled. Their first scene is only a terrible decision away.</div>')+'<p class="life-footnote">Discoveries come from new games, keepsakes and visitor chapters, plus your first care, play, outing and visitor activity each day. No streak to lose.</p>';
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
 let court=null,selectedRoute='drawer',selectedGear='thread',interlude=false;
 function open(name){document.querySelectorAll('.veil.open').forEach(v=>{if(v!==veil)v.classList.remove('open');});title.textContent=name;veil.classList.add('open');content.replaceChildren();}
 function close(){veil.classList.remove('open');court=null;}
 document.getElementById('lifeClose').addEventListener('click',close);
 veil.addEventListener('click',e=>{if(e.target===veil)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 function drawScene(scene){
  open(scene.title);sceneArt(state,scene,content);
  content.insertAdjacentHTML('beforeend','<p class="scene-script">'+esc(scene.text)+'</p><div class="life-links">'+button('Replay','replay')+button('Back to the shelf','close')+'</div><div class="scene-history">'+lifeState(state).scenes.slice(0,8).map(s=>button(esc(s.title),'scene-select','data-id="'+s.id+'"')).join('')+'</div>');
  const l=lifeState(state);l.recap=[];save();
 }
 function display(){const l=lifeState(state);open('Your cabinet of curiosities');const ids=[...(state.stories?.collection||[]).map(x=>x.id),...l.relics];content.innerHTML='<p>Pick up to three to display. Choosing a fourth replaces the oldest. Every object has a story.</p><div class="curio-grid">'+ids.map(id=>{const d=curioDetails(id);return d?'<button class="curio-tile '+(l.displayed.includes(id)?'selected':'')+'" data-life="display-toggle" data-id="'+id+'" aria-pressed="'+l.displayed.includes(id)+'">'+art(id)+'<b>'+esc(d.name)+'</b><small>'+esc(d.line)+'</small></button>':'';}).join('')+'</div>'+(!ids.length?'<p class="hint">Your first expedition always brings back an object. A welcomed visitor also leaves a souvenir.</p>'+button('Choose an expedition','outing'):'')+'<h3>Display finishes</h3><div class="frame-choices">'+FRAMES.map(f=>'<button class="btn frame-choice frame-'+f.id+'" data-life="frame" data-id="'+f.id+'" '+(l.xp<f.at?'disabled':'')+' aria-pressed="'+(l.frame===f.id)+'"><b>'+f.name+'</b><small>'+(l.xp<f.at?f.at+' discoveries':f.line)+'</small></button>').join('')+'</div>';}
 function outing(){const l=lifeState(state),o=l.outing;open(o?'An expedition in progress':'Beyond the shelf');
  if(!o){content.innerHTML='<p>One or two residents. One piece of equipment. Three questionable decisions. Everyone comes home, and every route has three curiosities to discover.</p><div class="outing-routes">'+OUTINGS.map(r=>'<button class="route-card '+r.tone+'" data-life="route" data-id="'+r.id+'" aria-pressed="'+(selectedRoute===r.id)+'">'+curioSVG(r.id==='drawer'?'sock':r.id==='fridge'?'pea':'key')+'<b>'+r.name+'</b><small>'+r.intro+'</small></button>').join('')+'</div><div class="crew-picker"><label>Lead resident<select id="outingLead">'+state.pets.map(p=>'<option value="'+p.id+'" '+(p.id===leadId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label>Companion<select id="outingCompanion"><option value="">Solo expedition</option>'+state.pets.map(p=>'<option value="'+p.id+'" '+(p.id===companionId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label>Equipment<select id="outingGear">'+GEAR.map(g=>'<option value="'+g.id+'" '+(selectedGear===g.id?'selected':'')+'>'+g.name+'</option>').join('')+'</select></label></div><p id="gearHint" class="hint">'+GEAR.find(g=>g.id===selectedGear).hint+'</p>'+button('Set out','set-out');return;}
  const r=OUTINGS.find(r=>r.id===o.route);if(!r){l.outing=null;outing();return;}
  if(o.step===3){const relic=RELICS.find(x=>x.id===o.route+':'+(o.score>=3?2:o.score>=1?1:0));content.innerHTML='<div class="expedition-prize">'+curioSVG(relic.shape)+'<span class="eyebrow">Home, more or less intact</span><h3>'+esc(relic.name)+'</h3><p>'+esc(relic.line)+'</p><p>'+o.score+' of 3 situations supported by your equipment or crew. Everyone gains up to 8 attention.</p></div><ol class="outing-log">'+o.log.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol>'+button('Bring it home','finish-outing');return;}
  const step=r.steps[o.step],crew=state.pets.filter(p=>o.cast.includes(p.id)),p=outingPreview(state,o.route,o.gear,o.cast)?.[o.step];
  if(interlude){content.innerHTML='<span class="eyebrow">Field report · '+o.step+' of 3</span><p class="scene-script">'+esc(o.log.at(-1))+'</p>'+button('Continue expedition','continue-outing');return;}
  content.innerHTML='<span class="eyebrow">'+r.name+' · '+(o.step+1)+' of 3</span><h3>'+step.title+'</h3><p class="scene-script">'+step.text+'</p><p class="crew-readout">'+esc(crew.map(p=>p.name).join(' & '))+' · '+esc(GEAR.find(g=>g.id===o.gear)?.name)+'</p><div class="expedition-choices">'+step.options.map((t,i)=>button(esc(t)+'<small>'+esc(i===0?(p?.gear?'Your equipment supports this.':'Best with '+GEAR.find(g=>g.id===step.good).name+'. Improvisation still gets you home.'):(p?.skill?'Your crew has the '+step.stat+' for this.':step.stat+' 7+ helps. Your crew will improvise.'))+'</small>','outing-choice','data-choice="'+i+'"')).join('')+'</div><p class="hint">Preparation affects which curiosity you find. Every expedition brings something home. Try different equipment and companions to find all three curiosities.</p>';
 }
 function courtStart(){court=newCourt(state);open('Shelf Court');courtPaint();}
 function courtPaint(){content.innerHTML='<span class="eyebrow">Two clues. One explanation.</span><h3>'+esc(court.title)+'</h3><p>'+esc(court.intro)+'</p><div class="court-evidence">'+court.clues.map((c,i)=>'<article><b>Exhibit '+(i+1)+'</b><p>'+esc(c)+'</p></article>').join('')+'</div><div class="suspect-grid">'+court.suspects.map((s,i)=>'<button class="suspect-card" data-life="accuse" data-choice="'+i+'"><div id="suspectArt'+i+'" class="suspect-art"></div><b>'+esc(s.name)+'</b>'+s.details.map(t=>'<span>'+esc(t)+'</span>').join('')+'<small>Identify this suspect</small></button>').join('')+'</div><p class="hint">Match both clues. Each innocent matches only one. There is no timer or penalty for reading.</p>';court.suspects.forEach((s,i)=>{const p=state.pets.find(p=>p.id===s.id),h=document.getElementById('suspectArt'+i);if(p)h.appendChild(renderPetSprite(p));else h.innerHTML=curioSVG(i===1?'sock':'echo');});}
 function visitor(){const a=visitorActivity(state);if(!a||a.done||a.complete)return;open(a.title);content.innerHTML='<span class="eyebrow">A visitor chapter · '+(a.chapter+1)+' of 3</span>'+(a.chapter?'<p>'+esc(a.later)+'</p>':'')+'<div class="court-evidence"><article><b>What you notice</b><p>'+esc(a.clue)+'</p></article></div><div class="expedition-choices">'+a.choices.map((x,i)=>button(esc(x),'visitor-answer','data-choice="'+i+'"')).join('')+'</div><p class="hint">Either choice advances their story. A good observation changes the outcome. Two discoveries for helping, once this visit.</p>';}
 document.addEventListener('change',e=>{if(e.target.id==='outingLead')leadId=e.target.value;if(e.target.id==='outingCompanion')companionId=e.target.value;if(e.target.id==='outingGear'){selectedGear=e.target.value;document.getElementById('gearHint').textContent=GEAR.find(g=>g.id===selectedGear).hint;}});
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
  if(action==='route'){selectedRoute=b.dataset.id;outing();return;}
  if(action==='set-out'){const cast=[document.getElementById('outingLead').value,document.getElementById('outingCompanion').value];if(startOuting(state,selectedRoute,selectedGear,cast)){save();interlude=false;outing();refresh();}return;}
  if(action==='outing-choice'){const result=chooseOuting(state,Number(b.dataset.choice));if(result){interlude=!result.complete;refresh();outing();}return;}
  if(action==='continue-outing'){interlude=false;outing();return;}
  if(action==='finish-outing'){finishOuting(state);refresh();display();return;}
  if(action==='court'){courtStart();return;}
  if(action==='accuse'){const result=accuseCourt(state,court,Number(b.dataset.choice));if(!result)return;checkAchievements(state);checkUnlocks(state);refresh();content.innerHTML='<div class="court-result">'+curioSVG(result.correct?'medal':'paper')+'<h3>'+(result.correct?'Case solved. The jury is mostly crumbs.':'A plausible accusation. Unfortunately, the wrong one.')+'</h3><p>'+esc(result.text)+'</p><p>'+(result.correct?'+'+result.fuss+' attention · +'+result.bond+' trust. '+l.courtWins+' cases solved.':'No needs or trust lost. The matching evidence is explained above.')+'</p></div>'+button('Another case','court')+button('Back to the shelf','close');return;}
  if(action==='visitor'){visitor();return;}
  if(action==='visitor-answer'){if(solveVisitorActivity(state,Number(b.dataset.choice))){const response=state.stories.visitor.activityResponse;refresh();content.innerHTML='<div class="court-result">'+curioSVG(state.stories.visitor.kind)+'<p class="scene-script">'+esc(response)+'</p><p>Two discoveries earned. Their next chapter comes with a return visit.</p></div>'+button('Back to the shelf','close');}return;}
 });
}
