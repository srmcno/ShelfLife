import { SHELF_SCENES } from '../content/shelf-theatre.js';
import { availableShelfScenes, performShelfScene, sceneAvailability } from '../engine/shelf-theatre.js';
import { initShelfTheatre } from '../art/shelf-theatre.js';
import { PROPS } from '../content/props.js';
import { totalBond } from '../engine/unlocks.js';
import { save } from '../state.js';
import { isDragging } from './drag.js';
import { placeProp } from './decorUI.js';
import { visibleSceneCandidates } from './theatre-visibility.js';

let update = () => {};
export function renderTheatreControls(state) { update(state); }

export function initTheatreControls({ getState, refresh }) {
  const root=document.getElementById('shelfTheatre'), play=document.getElementById('theatrePlay');
  const stop=document.getElementById('theatreStop'), kind=document.getElementById('theatreKind');
  const caption=document.getElementById('theatreCaption'), auto=document.getElementById('theatreAuto');
  const availability=document.getElementById('theatreAvailability'), repertoire=document.getElementById('theatreRepertoire');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let nextAt=Date.now()+15000, lastEvent=null, repertoireKey='';
  const visible=() => !document.hidden && document.getElementById('paneShelf').getClientRects().length>0 && !document.querySelector('.veil.open,#moreTray.open') && !isDragging();
  const director=initShelfTheatre({getState,onCaption(text,actorId){
    const name=getState().pets.find(p=>p.id===actorId)?.name;
    caption.textContent=(name?name+': ':'')+text;
  },onDone(event,{cancelled}={}){
    if(lastEvent)caption.textContent=cancelled?'The cast has dispersed. Their small household changes are saved.':lastEvent.title+'. '+lastEvent.summary;
    nextAt=Date.now()+24000+Math.random()*12000;
    update(getState());
  }});
  for(const scene of SHELF_SCENES){const option=document.createElement('option');option.value=scene.kind;option.textContent=scene.title;kind.append(option);}
  function openFurniture(){
    document.getElementById('decorBtn').click();
    requestAnimationFrame(()=>document.getElementById('propTray').scrollIntoView({block:'start'}));
  }
  function request(options={},manual=true){
    if(!visible()||director.isPlaying())return;
    const event=performShelfScene(getState(),{...options,manual},Date.now());
    if(!event){if(manual)caption.textContent=sceneAvailability(getState(),{...options,manual:true},Date.now());update(getState());return;}
    lastEvent=event;
    refresh();
    if(manual){
      const actor=[...document.querySelectorAll('#cabinet .pet')].find(e=>e.dataset.id===event.actorIds[0]);
      actor?.closest('.shelf-row')?.scrollIntoView({block:'center',behavior:'instant'});
    }
    caption.textContent=event.title;
    if(!director.play(event))caption.textContent=event.summary;
    update(getState());
  }
  update=state=>{
    root.hidden=!state.pets.length;
    if(root.hidden)return;
    auto.checked=state.settings.theatreOn!==false;
    const candidates=availableShelfScenes(state), selected=kind.value;
    const ready=candidates.some(s=>!selected||s.kind===selected), busy=director.isPlaying();
    play.disabled=busy||!ready;stop.hidden=!busy;
    repertoire.querySelectorAll('[data-scene-kind]').forEach(button=>{button.disabled=busy;});
    play.textContent=lastEvent?'Play another':'Play a scene';
    availability.textContent=busy?'The cast is occupied.':!ready?sceneAvailability(state,{...(selected?{kind:selected}:{}),manual:true},Date.now()):reduced.matches?'Reduced motion: request a scene to read a still performance.':'Place residents within two spaces of furniture, on the same shelf.';
    const seen=new Set(state.theatre?.seen||[]), total=SHELF_SCENES.reduce((n,s)=>n+s.variants.length,0);
    document.getElementById('theatreCount').textContent=seen.size+' / '+total+' endings seen';
    const key=JSON.stringify([state.slots,state.props.map(p=>p.kind),[...new Set(candidates.map(s=>s.kind))],[...seen],totalBond(state)]);
    if(key===repertoireKey)return;
    repertoireKey=key;repertoire.replaceChildren();
    for(const scene of SHELF_SCENES){
      const entry=document.createElement('article');entry.className='theatre-entry';
      const info=document.createElement('div'), title=document.createElement('h3'), hint=document.createElement('p'), tally=document.createElement('p');
      title.textContent=scene.title;hint.textContent=scene.requirements;tally.className='theatre-tally';tally.textContent=scene.variants.filter(v=>seen.has(v.id)).length+' / '+scene.variants.length+' endings';
      info.append(title,hint,tally);entry.append(info);
      const button=document.createElement('button');button.className='btn btn-sm';button.type='button';
      const prop=PROPS[scene.propKind], owned=state.props.some(p=>p.kind===scene.propKind);
      if(candidates.some(c=>c.kind===scene.kind)){
        button.textContent='Watch';button.dataset.sceneKind=scene.kind;button.disabled=busy;
        button.addEventListener('click',()=>{kind.value=scene.kind;request({kind:scene.kind});});
      } else if(prop&&!owned&&totalBond(state)>=prop.at){
        button.textContent='Add '+({tub:'a tub',lamp:'a lamp',bowl:'a bowl',yarn:'yarn',musicbox:'music',mirror:'a mirror',phone:'a phone'}[scene.propKind]||'furniture');
        button.disabled=!state.slots.includes(null);
        button.addEventListener('click',()=>{placeProp(getState(),scene.propKind,{nearResident:true});kind.value=scene.kind;update(getState());});
      } else {
        button.textContent=prop&&!owned?'Trust '+prop.at:'Arrange cast';
        button.addEventListener('click',()=>{caption.textContent=sceneAvailability(getState(),{kind:scene.kind,manual:true},Date.now());if(prop&&!owned)openFurniture();else document.getElementById('cabinet').scrollIntoView({block:'center'});});
      }
      entry.append(button);repertoire.append(entry);
    }
  };
  play.addEventListener('click',()=>request(kind.value?{kind:kind.value}:{}));
  stop.addEventListener('click',()=>director.stop());
  kind.addEventListener('change',()=>update(getState()));
  auto.addEventListener('change',()=>{getState().settings.theatreOn=auto.checked;nextAt=Date.now()+24000;save();});
  document.getElementById('theatreDecor').addEventListener('click',openFurniture);
  window.addEventListener('shelflife:scene',e=>{
    window.dispatchEvent(new CustomEvent('shelflife:goto',{detail:{tab:'shelf',target:'#cabinet'}}));
    requestAnimationFrame(()=>requestAnimationFrame(()=>request(e.detail||{})));
  });
  setInterval(()=>{
    if(!visible())return;
    update(getState());
    if(director.isPlaying()||reduced.matches||getState().settings.theatreOn===false||Date.now()<nextAt)return;
    const pieces=[...document.querySelectorAll('#cabinet .pet,#cabinet .prop')];
    const candidates=visibleSceneCandidates(availableShelfScenes(getState()),id=>pieces.find(piece=>piece.dataset.id===id)?.getBoundingClientRect(),innerWidth,innerHeight);
    if(!candidates.length)return;
    let ticket=Math.random()*candidates.reduce((sum,candidate)=>sum+candidate.weight,0);
    const selected=candidates.find(candidate=>(ticket-=candidate.weight)<0)||candidates.at(-1);
    nextAt=Date.now()+24000+Math.random()*12000;
    request({kind:selected.kind,propId:selected.propId,actorIds:selected.actorIds},false);
  },2000);
  return director;
}
