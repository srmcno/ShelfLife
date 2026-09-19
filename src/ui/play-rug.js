import { rugReaction } from '../content/rug-comedy.js';
import { rememberEcho, householdAftermath } from '../household-echoes.js';
import { countRugChallenge, createRug, tossBall, tossPreset, spawnBubbles, popBubble, updateRug, pauseRug, recordRugEvents, rugProgress, setRugViewport, RUG_WORLD } from '../engine/play-rug.js';
import { renderPetSprite } from '../art/sprite.js';
import { careFor, previewCare } from '../engine/care.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements } from '../engine/achievements.js';
import { escapadeView } from '../engine/escapades.js';
import { save } from '../state.js';
import { playFeed, playFuss, playClean, playStar, playUnlock } from '../audio/sound.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BALL = '<svg viewBox="6 6 68 68" aria-hidden="true"><circle cx="40" cy="40" r="33" fill="#df858e" stroke="#713f52" stroke-width="3"/><path d="M12 33q31 12 47-20M16 58q29-25 49-7M40 8q-9 33 12 62" fill="none" stroke="#f7c8b4" stroke-width="3"/><path d="m19 37 4-6m8 9 3-6m9 5 1-6m9 1-1-6m-30 22 5 4m3-9 5 5m4-8 3 6m6-7 2 7m8-6-1 7" stroke="#713f52" stroke-width="1.5"/><ellipse cx="29" cy="23" rx="9" ry="5" fill="#ffe7d6" opacity=".3" transform="rotate(-25 29 23)"/></svg>';
const BUBBLE = '<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="31" fill="#a8ddd924" stroke="#bbebe7" stroke-width="2"/><path d="M16 43a25 25 0 0 1 29-27" fill="none" stroke="#fff4d8" stroke-width="5" stroke-linecap="round"/><path d="M29 64a26 26 0 0 0 34-28" fill="none" stroke="#eda8d1" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="31" r="4" fill="#fff9e8"/></svg>';
const BADGE = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m20 39-5 21 17-8 17 8-5-22" fill="#628d89" stroke="#284f54" stroke-width="2"/><path d="m32 4 7 5 9 1 3 9 5 7-3 9-1 9-9 3-7 5-9-3-9-1-3-9-5-7 3-9 1-9 9-3Z" fill="#e7b96a" stroke="#714b36" stroke-width="2"/><path d="m30 17 4 9 10 1-8 7 2 10-9-5-9 4 2-10-7-7 11-1Z" fill="#fff0c9"/></svg>';
const CARE_ICON = {
  food: '<path d="M4 12h24c-1 8-4 12-12 12S5 20 4 12Zm6-5h12m-8-4h4"/>',
  fuss: '<path d="M16 27C-6 11 7 1 16 10 25 1 38 11 16 27Z"/>',
  clean: '<path d="M16 3C12 10 6 15 6 21a10 10 0 0 0 20 0C26 15 20 10 16 3Zm-5 18q0 5 5 5"/>'
};
const careIcon = key => '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+CARE_ICON[key]+'</svg>';


let sync = () => {};
export function renderPlayRug(state) { sync(state); }

// Install before initDialogs so the rug participates in the same focus and
// inert boundary as every existing sheet. The simulation never owns this DOM.
export function initPlayRug(state, refresh) {
  const veil = document.createElement('div'); veil.id = 'hangoutVeil'; veil.className = 'veil rug-veil';
  veil.innerHTML = '<div class="sheet rug-sheet">'+
    '<div class="sheet-head rug-head"><div><h2 id="rugTitle">The play rug</h2><p>No timer. Loose wrists. Questionable reflexes.</p></div><button class="btn btn-ghost btn-sm" id="rugClose">Back to the shelf</button></div>'+
    '<div class="rug-company"><label for="rugResident">On the rug</label><select id="rugResident"></select><div id="rugNeeds" class="rug-needs"></div></div>'+
    '<div class="rug-body"><div class="rug-play"><div class="rug-stage" id="rugStage" tabindex="0" role="group" aria-label="Interactive play rug. Tap to throw a ball, or use the toy controls." aria-describedby="rugInstructions">'+
    '<div class="rug-world"><div class="rug-guest" aria-label="A visiting woodlouse undertaker"><span class="woodlouse"><i></i></span><span class="rug-coffin"></span></div><div class="rug-shadow" id="rugShadow"></div><div class="rug-resident" id="rugPet" data-sl-theatre="1"></div><div class="rug-entities" id="rugEntities"></div><div class="rug-sparkles" id="rugSparkles" aria-hidden="true"></div><svg class="rug-aim" id="rugAim" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" hidden><path/></svg></div>'+
    '<div class="rug-discovery" id="rugDiscovery" role="status" hidden></div><div class="rug-pause" id="rugPause" hidden><span>The rug is waiting.</span><p id="rugPauseReason"></p><button class="btn btn-primary" id="rugResume">Resume playing</button></div></div>'+
    '<p id="rugOutcome" class="rug-outcome" role="status"></p><p class="rug-caption" id="rugCaption" aria-live="polite">Pick up a toy. See what happens.</p></div>'+
    '<aside class="rug-tools" aria-label="Toys and care"><div class="rug-toy-picker" role="group" aria-label="Choose a toy"><button class="rug-toy" type="button" data-rug-toy="ball" aria-pressed="true">'+BALL+'<span>Patchwork ball</span></button><button class="rug-toy" type="button" data-rug-toy="bubbles" aria-pressed="false">'+BUBBLE+'<span>Soap bubbles</span></button></div>'+
    '<p id="rugInstructions" class="rug-instructions">Tap to aim. Drag farther for a harder throw. Let it return the ball before tossing again.</p>'+
    '<div class="rug-throw-style" id="rugThrowStyle"><label for="rugThrow">Try a throw</label><select id="rugThrow"><option value="soft">Soft toss</option><option value="high">Sky high</option><option value="bounce">Bounce pass</option><option value="long">Across the room · hard</option></select></div>'+
    '<button class="btn btn-primary rug-launch" id="rugAction">Toss a ball</button><button class="btn" id="rugPop" hidden>Pop a bubble</button>'+
    '<div class="rug-care"><span>A little care, too</span><div>'+['food','fuss','clean'].map((key,i)=>'<button class="btn" type="button" data-rug-care="'+key+'">'+careIcon(key)+'<span>'+['Snack','Fuss','Wash'][i]+'</span></button>').join('')+'</div></div>'+
    '<details class="rug-challenges"><summary>Try a trick challenge</summary><p>Untimed. Misses are allowed. Practice never costs trust.</p><button class="btn" id="rugChallenge">Start: three clean catches</button><p id="rugChallengeProgress"></p></details><details class="rug-tricks" id="rugTricks"><summary><span>Little tricks</span><b id="rugTally">0 / 6</b></summary><p>Each new trick earns one discovery. Every resident has their own little repertoire.</p><ol id="rugTrickList"></ol></details><p class="rug-next" id="rugNext"></p></aside></div></div>';
  document.body.appendChild(veil);
  const el = id => veil.querySelector('#'+id);
  const stage = el('rugStage'), host = el('rugPet'), entities = el('rugEntities'), caption = el('rugCaption');
  const residentPicker = el('rugResident'), nodes = new Map();
  let usedLines = [], challenge = null, lastCaptionAt = 0;
  let pet = null, game = null, toy = 'ball', frame = 0, last = 0, active = false, paused = false, gesture = null;
  let celebrationTimer = 0, captionCount = 0, lastSound = 0, lastInput = 0, progressKey = '', selectorKey = '', pauseReturn = null;
  const isOpen = () => active && veil.classList.contains('open');
  const available = () => isOpen() && !paused && !document.hidden && state.pets.includes(pet);
  const setCaption = text => { if (caption.textContent !== text) caption.textContent = text; };
  function syncProgress() {
    if (!pet) return;
    const progress = rugProgress(state, pet.id);
    const key = JSON.stringify([pet.id, progress.tricks]);
    if (key === progressKey) return; progressKey = key;
    el('rugTally').textContent = progress.earned+' / '+progress.total;
    el('rugTrickList').innerHTML = progress.tricks.map(trick=>'<li class="'+(trick.earned?'earned':'')+'">'+(trick.earned?BADGE:'<span class="rug-unlearned" aria-hidden="true">✧</span>')+'<div><b>'+esc(trick.label)+'</b><span>'+esc(trick.hint)+'</span></div></li>').join('');
    el('rugNext').textContent = progress.next ? 'Something to try: '+progress.next.hint : 'A full repertoire. It is available for very small bookings.';
  }
  function syncCare() {
    if (!pet) return;
    el('rugNeeds').innerHTML = ['food','fuss','clean'].map((key,i)=>'<span title="'+['Fed','Fussed','Clean'][i]+' '+Math.round(pet.needs[key])+' of 100">'+careIcon(key)+'<meter min="0" max="100" value="'+pet.needs[key]+'" aria-label="'+['Fed','Fussed','Clean'][i]+'"></meter></span>').join('');
    const story = escapadeView(state).active;
    for (const button of veil.querySelectorAll('[data-rug-care]')) {
      const key = button.dataset.rugCare, preview = previewCare(pet,key);
      const moment = story?.petId===pet.id && !story.careDone && story.episode.care.need===key;
      button.disabled = preview.gain <= .01 && !moment;
      button.title = moment && preview.gain <= .01 ? 'A personal moment for your adventure' : preview.gain <= .01 ? 'Already comfortable' : '+'+Math.round(preview.gain)+' · '+preview.reason;
    }
  }
  sync = () => {
    const button = document.getElementById('hangoutBtn');
    if (button) { button.disabled = !state.pets.length; button.title = state.pets.length?'Toys, small tricks and a little time together':'Make a resident to play together'; }
    if (!isOpen()) return;
    if (!state.pets.includes(pet)) { close(); return; }
    syncCare(); syncProgress();
  };
  function clearGesture() {
    if (gesture) { try { stage.releasePointerCapture(gesture.id); } catch { /* already released */ } }
    gesture = null; el('rugAim').setAttribute('hidden', '');
  }
  function stop() { cancelAnimationFrame(frame); frame=0; last=0; }
  function pause(reason) {
    if (!isOpen()) return;
    if (!paused) pauseReturn=veil.contains(document.activeElement)?document.activeElement:stage;
    paused=true;stop();clearGesture();
    pauseRug(game);veil.querySelector('.rug-tools').inert=true;
    el('rugPause').hidden=false;el('rugPauseReason').textContent=reason;
    if(!document.hidden)el('rugResume').focus();
  }
  function resume(restoreFocus=false) {
    if (!isOpen() || document.hidden) return;
    paused=false;veil.querySelector('.rug-tools').inert=false;el('rugPause').hidden=true;lastInput=performance.now();start();
    if(restoreFocus){const target=pauseReturn?.isConnected&&!pauseReturn.disabled&&pauseReturn.getClientRects().length?pauseReturn:stage;target.focus({preventScroll:true});}
    pauseReturn=null;
  }
  function close() {
    active=false;stop();clearGesture();clearTimeout(celebrationTimer);pauseReturn=null;
    el('rugDiscovery').hidden=true;veil.classList.remove('open');
    nodes.clear();entities.replaceChildren();el('rugSparkles').replaceChildren();host.replaceChildren();game=null;pet=null;
    save();refresh();
  }
  function chooseResident(id) {
    stop();clearGesture();
    pet=state.pets.find(p=>p.id===id) || state.pets[0];if(!pet){close();return;}
    game=createRug(pet);setRugViewport(game,stage.getBoundingClientRect().width);usedLines=[];challenge=null;el('rugChallengeProgress').textContent='';el('rugOutcome').textContent='';residentPicker.value=pet.id;host.replaceChildren(renderPetSprite(pet));
    host.setAttribute('aria-label',pet.name);progressKey='';nodes.clear();entities.replaceChildren();el('rugSparkles').replaceChildren();
    el('rugDiscovery').hidden=true;clearTimeout(celebrationTimer);
    const aftermath=householdAftermath(state,pet.id);setCaption(aftermath?aftermath.text:pet.name+' eyes the woodlouse measuring the coffin. “That had better be for the ball.”');syncCare();syncProgress();paint();resume();
  }
  function open(id) {
    if (document.querySelector('.veil.open,#moreTray.open') || !state.pets.length) return;
    const key=state.pets.map(p=>p.id+'|'+p.name).join(';');
    if(key!==selectorKey){selectorKey=key;residentPicker.replaceChildren(...state.pets.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;return o;}));}
    active=true;veil.classList.add('open');chooseResident(id||residentPicker.value);
  }
  function feedback(events) {
    if (!events.length || !pet) return;
    const learned=recordRugEvents(state,pet.id,events);
    if(learned.length){
      const persisted=save();refresh();syncProgress();
      const discovery=el('rugDiscovery');discovery.innerHTML=BADGE+'<div><small>'+esc(pet.name)+' learned a trick</small><b>'+esc(learned.map(t=>t.label).join(' & '))+'</b><span>+'+learned.length+' '+(learned.length===1?'discovery':'discoveries')+' · saved</span></div>';
      const gained=learned.filter(trick=>trick.discoveryGained).length;
      discovery.querySelector('div > span').textContent=(gained?'+'+gained+' '+(gained===1?'discovery':'discoveries'):'Memory kept')+(persisted?' · saved':' · kept for this visit');
      if(!persisted)discovery.insertAdjacentHTML('beforeend','<p class="rug-save-warning">Back up from More before closing. This browser could not save.</p>');
      discovery.hidden=false;clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>{discovery.hidden=true;},4200);playUnlock();
    }
    const priority=['recover','miss','refuse','fumble','catch','pop','return','jump'];
    const reaction=priority.map(type=>events.find(e=>e.type===type)).find(Boolean);
    if(reaction){
      const facts=state.householdEchoes?.events || [];
      const line=rugReaction(reaction,pet,facts,usedLines);
      if(line && (performance.now()-lastCaptionAt>1800 || ['miss','fumble','recover','refuse'].includes(reaction.type))){
        setCaption(pet.name+': '+line.text);usedLines.push(line.id);if(usedLines.length>36)usedLines.shift();lastCaptionAt=performance.now();
      }
      const labels={catch:reaction.recovered?'Recovered catch':'Clean catch',fumble:'Fumble: catch the rebound',recover:'Recovered',miss:'Miss: try a nearer or slower throw',refuse:'Refused: let it finish the previous throw',return:'Ball returned'};
      if(labels[reaction.type])el('rugOutcome').textContent=labels[reaction.type];
      if(['miss','fumble','recover','catch'].includes(reaction.type)&&rememberEcho(state,reaction.type,pet.id,reaction.id))save();
      if(performance.now()-lastSound>180){lastSound=performance.now();if(reaction.type==='catch')playFeed();else if(reaction.type==='pop')playStar();}
    }
    if(countRugChallenge(challenge,events)){
        el('rugChallengeProgress').textContent=challenge.count+' / 3 '+['clean catches','bounce catches','airborne catches'][challenge.level];
        if(challenge.count>=3){el('rugChallengeProgress').textContent+=' · complete. The woodlouse eats the podium.';el('rugChallenge').textContent=challenge.level<2?'Next challenge':'Replay challenges';challenge={level:(challenge.level+1)%3,count:0,waiting:true};}
      }

    for(const event of events.filter(e=>['catch','pop'].includes(e.type)).slice(0,6)) {
      const spark=document.createElement('span');spark.className='rug-spark';spark.textContent=event.type==='catch'?'✦':'✧';spark.style.left=event.x/10+'%';spark.style.top=event.y/6+'%';
      el('rugSparkles').append(spark);setTimeout(()=>spark.remove(),650);
    }
  }
  function paint() {
    if(!game)return;
    const p=game.pet;
    host.style.left=p.x/10+'%';host.style.top=p.y/6+'%';host.dataset.pose=p.pose;stage.dataset.outcome=p.pose;
    const sprite=host.firstElementChild;
    sprite.style.setProperty('--sl-face',p.facing||1);sprite.classList.toggle('rug-moving',Math.abs(p.vx)>5);
    el('rugShadow').style.left=p.x/10+'%';el('rugShadow').style.opacity=String(clamp(1-(RUG_WORLD.ground-p.y)/250,.15,.65));
    const current=new Set();
    for(const [kind,items] of [['ball',game.balls],['bubble',game.bubbles]]) for(const item of items){
      const key=kind+':'+item.id;current.add(key);let node=nodes.get(key);
      if(!node){node=document.createElement(kind==='bubble'?'button':'span');node.className='rug-entity rug-'+kind;node.innerHTML=kind==='ball'?BALL:BUBBLE;
        if(kind==='bubble'){node.type='button';node.dataset.bubble=String(item.id);node.setAttribute('aria-label','Pop bubble');node.tabIndex=-1;}
        nodes.set(key,node);entities.append(node);}
      node.style.left=item.x/10+'%';node.style.top=item.y/6+'%';node.style.setProperty('--diameter',((item.radius||item.r||24)*2/10)+'%');
      if(kind==='ball'){node.dataset.state=item.state;node.style.setProperty('--ball-rotation',item.rotation+'rad');}if(kind==='ball')node.style.rotate=((item.x+item.y)*.6)+'deg';
    }
    for(const [key,node] of nodes)if(!current.has(key)){node.remove();nodes.delete(key);}
    el('rugPop').disabled=!game.bubbles.length;
  }
  function step(time) {
    frame=0;if(!available())return;
    const dt=last?(time-last)/1000:0;last=time;
    if(dt>2){pause('The browser took a breather. Your toys stayed put.');return;}
    feedback(updateRug(game,dt));paint();
    if(game.balls.length||game.bubbles.length||Math.abs(game.pet.vx)>1||game.pet.y<RUG_WORLD.ground||time-lastInput<2500)frame=requestAnimationFrame(step);
    else last=0;
  }
  function start(){if(available()&&!frame){last=0;frame=requestAnimationFrame(step);}}
  function input(){lastInput=performance.now();start();}
  function presetThrow() {
    if(!available())return;
    if(!tossPreset(game,el('rugThrow').value))setCaption('Three balls. The rug has reached peak ambition.');
    input();paint();
  }
  function blow(x=game?.pet.x||500,y=game?.pet.y-120||360) {
    if(!available())return;
    const added=spawnBubbles(game,{x,y,count:5});if(!added.length)setCaption('Pop a few bubbles to make room for more.');
    input();paint();
  }
  function selectToy(next){
    toy=next;veil.querySelectorAll('[data-rug-toy]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rugToy===toy)));
    el('rugAction').textContent=toy==='ball'?'Toss a ball':'Blow bubbles';el('rugThrowStyle').hidden=toy!=='ball';el('rugPop').hidden=toy!=='bubbles';
    el('rugInstructions').textContent=toy==='ball'?'Tap to aim. Drag farther for a harder throw. Let it return the ball before tossing again.':'Tap the rug to blow bubbles. Pop them before your resident does.';
    stage.setAttribute('aria-label','Interactive play rug. '+el('rugInstructions').textContent+' The toy buttons work with a keyboard too.');
  }
  const position=e=>{const r=stage.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width*1000,25,975),y:clamp((e.clientY-r.top)/r.height*600,35,480)};};
  function popButton(button) {
    if(!button||!available())return;
    const bubble=game.bubbles.find(b=>String(b.id)===button.dataset.bubble);
    if(bubble){feedback(popBubble(game,bubble.id));input();paint();}
  }
  stage.addEventListener('pointerdown',e=>{
    if(!available()||e.button!==0||e.isPrimary===false)return;
    const bubble=e.target.closest('[data-bubble]');
    if(bubble){e.preventDefault();popButton(bubble);return;}
    if(e.target.closest('button'))return;
    const p=position(e);gesture={id:e.pointerId,start:p,last:p,at:performance.now()};
    try{stage.setPointerCapture(e.pointerId);}catch{/* pointer already released */}
  });
  stage.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    gesture.last=position(e);
    if(toy==='ball'&&Math.hypot(gesture.last.x-gesture.start.x,gesture.last.y-gesture.start.y)>20){
      el('rugAim').removeAttribute('hidden');el('rugAim').querySelector('path').setAttribute('d','M'+gesture.start.x+' '+gesture.start.y+' L'+gesture.last.x+' '+gesture.last.y);
    }
  });
  stage.addEventListener('pointerup',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const g=gesture,p=position(e);clearGesture();if(!available())return;
    if(toy==='bubbles'){blow(p.x,p.y);return;}
    const distance=Math.hypot(p.x-g.start.x,p.y-g.start.y);
    if(distance>20){const duration=clamp((performance.now()-g.at)/1000,.14,.8);tossBall(game,{x:g.start.x,y:g.start.y,vx:clamp((p.x-g.start.x)/duration,-1000,1000),vy:clamp((p.y-g.start.y)/duration,-1200,800)});}
    else {const origin=game.pet.x<500?85:915;tossBall(game,{x:origin,y:430,vx:(p.x-origin)/1.05,vy:-700});}
    input();paint();
  });
  stage.addEventListener('pointercancel',clearGesture);stage.addEventListener('lostpointercapture',()=>{gesture=null;el('rugAim').setAttribute('hidden','');});
  stage.addEventListener('click',e=>{
    // Touch emits a compatibility click after pointerup. A new bubble can
    // appear under that same finger; only a fresh pointerdown may pop it.
    // Detail-zero activation retains assistive-technology/keyboard support.
    if(e.detail===0)popButton(e.target.closest('[data-bubble]'));
  });
  new ResizeObserver(()=>{if(game)setRugViewport(game,stage.getBoundingClientRect().width);}).observe(stage);
  el('rugChallenge').addEventListener('click',()=>{const level=challenge?.waiting?challenge.level:0;challenge={level,count:0};el('rugChallenge').textContent='Restart challenge';el('rugChallengeProgress').textContent='0 / 3 '+['clean catches','bounce catches','airborne catches'][level];});
  el('rugAction').addEventListener('click',()=>toy==='ball'?presetThrow():blow());
  el('rugPop').addEventListener('click',()=>{if(!available()||!game.bubbles.length)return;feedback(popBubble(game,game.bubbles[0].id));input();paint();});
  veil.querySelectorAll('[data-rug-toy]').forEach(b=>b.addEventListener('click',()=>selectToy(b.dataset.rugToy)));
  veil.querySelectorAll('[data-rug-care]').forEach(button=>button.addEventListener('click',()=>{
    if(!available())return;const need=button.dataset.rugCare,result=careFor(state,pet,need);
    setCaption(result.message);({food:playFeed,fuss:playFuss,clean:playClean}[need])();
    host.classList.remove('rug-care-food','rug-care-fuss','rug-care-clean');void host.offsetWidth;host.classList.add('rug-care-'+need);
    checkUnlocks(state);checkAchievements(state);refresh();syncCare();input();
  }));
  residentPicker.addEventListener('change',()=>chooseResident(residentPicker.value));
  el('rugClose').addEventListener('click',close);el('rugResume').addEventListener('click',()=>resume(true));
  veil.addEventListener('click',e=>{if(e.target===veil)close();});
  window.addEventListener('shelflife:rug',e=>open(e.detail?.petId));
  document.getElementById('hangoutBtn')?.addEventListener('click',()=>open());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&isOpen())pause('Come back whenever you like. Nothing here is on a timer.');else if(isOpen()&&paused)el('rugResume').focus();});
  window.addEventListener('pagehide',stop);
  stage.addEventListener('keydown',e=>{if(e.target!==stage||![' ','Enter'].includes(e.key)||e.repeat)return;e.preventDefault();toy==='ball'?presetThrow():blow();});
  sync(state);
}
