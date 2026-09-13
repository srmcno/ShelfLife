import { sceneDirection } from '../content/scenes.js';
import { VISITORS } from '../content/stories.js';
import { curioSVG } from './curios.js';
import { keepsakeSvg } from './keepsakes.js';
import { renderPetSprite } from './sprite.js';
import { generateCreature } from './creatures.js';
import { createPuppet } from './animator.js';

// Stage objects are literal objects. A visitor's tooth-shaped souvenir must
// never turn a bread tooth into a medal, or an unknown memory into a crown.
const drawings = {
 wing:'<path d="M62 62C-5 75 3-4 41 17c18 11 22 23 21 45Z" fill="#b6abc7"/><path d="M61 60 20 20m36 33-32-6m29-2-7-22m-1 16-24-8" stroke="#6f657f"/><ellipse cx="29" cy="25" rx="7" ry="4" fill="#dccdad"/>',
 hand:'<path d="M22 70 12 45q-5-10 3-12 6-1 10 10V20q0-9 7-8 5 0 5 8V11q0-9 7-7 5 1 5 8v10q0-9 6-8 6 1 5 9v10q0-8 6-6 5 2 3 10l-3 20q-3 13-12 17Z" fill="#d5c8b5"/><path d="M27 47q16-4 21 8M37 23v18m12-18v17m11-5v9M28 66h27" stroke="#796471"/>',
 'spirit-circle':'<ellipse cx="40" cy="52" rx="32" ry="15" stroke="#d5c9a7" stroke-width="3" stroke-dasharray="2 3"/><path d="m40 38 8 21-24-13h32L32 59Z" stroke="#c3b59a"/><circle cx="40" cy="52" r="3" fill="#c3b59a"/>',
 wall:'<path d="M9 8h62v65H9Z" fill="#8c7271"/><path d="M10 24h60M10 41h60M10 58h60M29 8v16m21 0v17M29 41v17m21 0v15" stroke="#4b3b44" stroke-width="3"/><path d="m57 9-5 7 7 8-3 8" stroke="#c7b7a4"/>',
 knot:'<path d="M12 49C2 24 47 8 66 25c23 22-6 48-29 42-12-3-21-9-25-18Z" fill="#ad805c"/><path d="M20 47C8 26 48 16 61 30s-7 33-23 29c-9-2-15-5-18-12Zm9-4c-8-11 17-20 24-9s-10 21-18 15Z" stroke="#593e37"/><ellipse cx="40" cy="40" rx="4" ry="6" fill="#503732"/>',
 crumb:'<path d="m18 40 9-16 22-4 16 19-9 23-25 3-16-13Z" fill="#d8ad69"/><path d="m26 33 5 4m14-10 3 5m7 14-5 2m-18 7 4-5"/>',
 bowl:'<path d="M9 33h62c-3 29-14 34-31 34S13 62 9 33Z" fill="#a9bcae"/><ellipse cx="40" cy="33" rx="31" ry="9" fill="#3b303d"/><path d="M23 50q4 8 11 8" stroke="#e6e1c8"/>',
 tissue:'<path d="m10 24 23-7 12 6 25-5-5 41-22 7-18-6-14 4Z" fill="#efe6d5"/><path d="m33 18-8 42m20-36-2 41M13 39l54-5" opacity=".3"/>',
 pillow:'<path d="M10 27q28-8 60 0l-5 5 5 28q-29 7-60 0l5-7Z" fill="#c4abc2"/><path d="M20 34q20-4 40 0M21 54h38" opacity=".4"/>',
 rope:'<path d="M24 12c-35 21 44 28 28 47-7 9-29 6-24-5 4-9 39-6 31 11" stroke="#d0b785" stroke-width="6"/>',
 mask:'<path d="M7 29q13-10 33-1 21-9 33 1l-8 27q-15 9-25-3-11 12-25 3Z" fill="#302634"/><path d="m19 36 13 2-6 8Zm29 2 14-2-7 10Z" fill="#d9c6a9"/>',
 board:'<ellipse cx="40" cy="45" rx="34" ry="22" fill="#b28a5b"/><path d="M17 36q23-12 46 0M22 44h35M31 57h17"/><path d="m42 41 12 14H30Z" fill="#ebd6af"/><circle cx="42" cy="50" r="3"/>',
 ghost:'<path d="M18 66V37c-1-32 45-32 44 0v29l-12-7-10 8-11-8Z" fill="#d2e3d6"/><ellipse cx="31" cy="35" rx="3" ry="6" fill="#312637"/><ellipse cx="49" cy="35" rx="3" ry="6" fill="#312637"/><ellipse cx="40" cy="49" rx="4" ry="6"/>',
 hair:'<path d="M18 62c58-13-17-57 29-47s-7 53 16 51" stroke="#d4bd99" stroke-width="3"/>',
 frame:'<rect x="13" y="11" width="54" height="59" fill="#b38b55"/><rect x="20" y="18" width="40" height="45" fill="#252932"/><path d="M25 24h30M25 57h30" stroke="#e0b875"/>',
 flag:'<path d="M21 70V9" stroke="#bfa87a" stroke-width="4"/><path d="M24 12q13-11 36 0v26q-21-12-36 0Z" fill="#bc778f"/><path d="m39 21 6 3-6 4" stroke="#ecd6a9"/>',
 lamp:'<path d="M38 37h5v29H28v5h29v-5H43" fill="#bd9f67"/><path d="m23 10 32 0 14 32H10Z" fill="#ead293"/><path d="m32 15-4 19m20-19 5 19" stroke="#b98c5b"/><path d="M57 43v13"/>',
 pen:'<path d="m18 63 7-19 30-32 11 10-31 33Z" fill="#b35f76"/><path d="m18 63 17-8-10-11Z" fill="#e8c994"/><path d="m18 63 6-3-3-4Z" fill="#312637"/>',
 grave:'<path d="M25 55V26c0-25 31-25 31 0v29" fill="#858789"/><ellipse cx="40" cy="61" rx="31" ry="11" fill="#352d30"/><path d="M34 24h14M41 17v24" stroke="#c8c2b2"/>',
 coffin:'<path d="m25 10 30 0 12 19-10 43H23L13 29Z" fill="#815758"/><path d="m29 16 22 0 10 15-9 34H28l-9-34Z"/><path d="M33 32h14M40 23v29" stroke="#d2b37f"/>',
 moth:'<path d="M39 36C4-11 0 63 36 51c-27 23 13 30 5 2 17 29 35-4 4-3 40 4 22-66-4-14Z" fill="#b6abc7"/><path d="M40 25v35m0-31-9-12m9 12 8-13" stroke="#e8d5ba"/>',
 door:'<path d="M17 72V22c0-20 46-20 46 0v50Z" fill="#1b1925"/><path d="M24 70V25c0-13 33-13 33 0v45" stroke="#92765a"/><circle cx="48" cy="43" r="3" fill="#d3b575"/>',
 dust:'<path d="M18 60C0 51 12 30 24 35c-10-27 22-29 25-7 17-13 29 14 16 21 16 22-25 25-30 16-9 9-22 5-17-5Z" fill="#a79ba9"/><path d="M28 43h1m22 0h1M32 53q8 4 15 0"/>',
 gavel:'<path d="m37 33 25 32-7 6-27-31" fill="#b48a57"/><path d="m16 12 10-5 25 28-11 9Z" fill="#b68c61"/><path d="m13 17 8-7 8 8-8 7Zm26 24 8-7 8 8-8 7Z" fill="#d0ad77"/><path d="M13 71h31l-4-9H17Z" fill="#a97a4e"/>',
 bag:'<path d="m23 15 16 4 20-4-9 17c27 34 16 42-11 42S5 66 29 32Z" fill="#aa8a6b"/><path d="M29 32h22M33 38q-10 18-7 24m19-22q10 16 8 22"/><path d="M27 29h27" stroke="#d9c497" stroke-width="4"/>'
};
export function scenePropSVG(shape) {
 if(typeof shape==='string'&&shape.startsWith('keepsake:')){
  // An unknown keepsake must not pass through curioSVG's generic key fallback.
  // Size the self-contained art to the director's existing responsive prop box.
  return keepsakeSvg(shape.slice(9)).replace('<svg ','<svg width="100%" height="100%" ');
 }
 return drawings[shape] ? '<svg class="curio-art" viewBox="0 0 80 80" fill="none" stroke="#302638" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+drawings[shape]+'</svg>' : curioSVG(shape,{literal:true});
}
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const gestures={look:'inspect',peek:'inspect',read:'inspect',listen:'inspect',write:'knock',dig:'knock',point:'boop',offer:'boop',fuss:'wiggle',clean:'wiggle',eat:'catch',guard:'shield',gavel:'shield',surprise:'bump',anticipate:'jump',nap:'blink',sneak:'inspect',walk:'inspect'};
function place(node,pose={},fallback={}) {
 const p={x:50,y:0,rotate:0,scale:1,opacity:1,...fallback,...pose};
 node.style.left=clamp(finite(p.x,50),3,97)+'%';
 node.style.transform='translate(-50%,'+(-finite(p.y,0))+'px) rotate('+finite(p.rotate,0)+'deg) scale('+clamp(finite(p.scale,1),.05,3)+')';
 node.style.opacity=clamp(finite(p.opacity,1),0,1);
}

// This director never writes to a save. The preview is a still; the replay has
// a bounded timeline, manual stepping, and one owner for all animation cleanup.
export function mountHouseholdScene(host,state,scene,{mini=false}={}) {
 const direction=sceneDirection(scene),root=document.createElement('section');
 root.className='household-player'+(mini?' is-mini':'');
 const stage=document.createElement('div');stage.className='household-stage';
 stage.dataset.setting=direction.setting||'shelf';stage.setAttribute('aria-hidden','true');
 stage.innerHTML='<div class="household-wall"></div><div class="household-floor"></div><div class="household-pool"></div>';
 root.append(stage);host.append(root);
 const actors=[],props=new Map(),puppets=[];
 const cast=(scene.cast||[]).slice(0,2).map(id=>state.pets.find(p=>p.id===id));
 if(direction.key==='game:memory'&&cast.length===1)cast.push({player:true,name:'You'});
 if(direction.guest){const g=VISITORS.find(v=>v.id===direction.guest);if(g)cast.push({id:'guest-'+g.id,name:g.name,art:{creature:generateCreature(g.classic?{seed:g.seed,parts:g.parts}:{seed:g.seed,body:g.body,palette:g.palette,parts:g.parts})}});}
 cast.forEach((pet,i)=>{
  const wrap=document.createElement('div');wrap.className='household-actor';wrap.dataset.actor=i;
  if(pet?.player){wrap.classList.add('household-hand');wrap.innerHTML=scenePropSVG('hand');}
  else if(pet){const sprite=renderPetSprite(pet);wrap.append(sprite);if(!mini)puppets[i]=createPuppet(sprite);}
  else {wrap.classList.add('former-resident');wrap.innerHTML=scenePropSVG('ghost');}
  const name=document.createElement('span');name.className='household-name';name.textContent=pet?.name||'Former resident';wrap.append(name);
  actors.push(wrap);stage.append(wrap);
 });
 for(const prop of direction.props||[]){
  const node=document.createElement('div');node.className='household-prop';node.dataset.object=prop.shape;
  if(prop.id==='shadow'&&cast[0]){node.classList.add('household-shadow');node.append(renderPetSprite(cast[0]));}
  else node.innerHTML=scenePropSVG(prop.shape);node.title=prop.label||prop.shape;props.set(prop.id,{node,prop});stage.append(node);
 }
 let index=0,timer=null,gestureTimer=null,settleTimer=null,moveTimer=null,running=false,destroyed=false,previousActors=[];
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');
 // This is a requested, finite scene. Light effects trim decoration while
 // keeping the actors' actions readable; only reduced motion stops travel.
 const reducedMotion=()=>media.matches;
 let onScreen=true;
 const veil=root.closest('.veil');
 const blocked=()=>document.hidden||!root.isConnected||!onScreen||(veil&&!veil.classList.contains('open'))||[...document.querySelectorAll('.veil.open')].some(dialog=>dialog!==veil);
 const beats=direction.beats?.length?direction.beats:[{label:scene.title}];
 let caption,progress,toggle,next;
 if(!mini){
  const bar=document.createElement('div');bar.className='household-caption';
  progress=document.createElement('span');progress.className='eyebrow';
  caption=document.createElement('p');caption.setAttribute('role','status');bar.append(progress,caption);root.append(bar);
  const controls=document.createElement('div');controls.className='household-controls';
  toggle=document.createElement('button');toggle.className='btn btn-primary';toggle.type='button';
  next=document.createElement('button');next.className='btn';next.type='button';next.textContent='Next beat';
  toggle.addEventListener('click',()=>running?pause():play());next.addEventListener('click',()=>step());
  controls.append(toggle,next);root.append(controls);
 }
 function paint(animate=false){
  const beat=beats[index],moving=animate&&!reducedMotion();root.classList.toggle('is-moving',moving);root.dataset.beat=index;
  clearTimeout(settleTimer);
  // Pausing the timeline must not freeze the next manually requested gesture.
  if(moving){root.classList.remove('is-paused');if(!running)settleTimer=setTimeout(()=>{if(!destroyed&&!running){root.classList.add('is-paused');root.classList.remove('is-moving');}},1500);}
  clearTimeout(moveTimer);puppets.forEach(p=>p?.move(false));
  actors.forEach((node,i)=>{const pose=beat.actors?.[i]||{},x=finite(pose.x,i===0?25:i===1?72:82);place(node,pose,{x});if(moving&&previousActors[i]!==undefined&&Math.abs(x-previousActors[i])>2)puppets[i]?.move(true,x<previousActors[i]?-1:1);previousActors[i]=x;});
  if(moving)moveTimer=setTimeout(()=>puppets.forEach(p=>p?.move(false)),950);
  for(const [id,{node,prop}]of props)place(node,beat.props?.[id],prop);
  clearTimeout(gestureTimer);
  if(animate&&!reducedMotion())gestureTimer=setTimeout(()=>{
   if(destroyed||blocked())return;
   puppets.forEach((p,i)=>{const kind=beat.actors?.[i]?.gesture||'inspect';p?.gesture(gestures[kind]||kind);});
  },160);
  if(caption){caption.textContent=beat.label||scene.title;progress.textContent='Scene '+(index+1)+' of '+beats.length;next.disabled=index===beats.length-1;toggle.textContent=running?'Pause scene':index===beats.length-1?'Replay scene':'Play scene';toggle.setAttribute('aria-pressed',String(running));}
 }
 function schedule(){clearTimeout(timer);if(!running)return;timer=setTimeout(()=>{
  if(destroyed||blocked()){pause();return;}
  if(index<beats.length-1){index++;paint(true);schedule();}else pause();
 },Math.max(2200,Math.min(4200,(beats[index].label||'').length*34+1100)));}
 function play(){if(destroyed||mini||blocked())return;if(index===beats.length-1)index=0;running=true;root.classList.remove('is-paused');paint(true);schedule();}
 function pause(){if(destroyed)return;running=false;clearTimeout(timer);clearTimeout(gestureTimer);clearTimeout(settleTimer);clearTimeout(moveTimer);root.classList.add('is-paused');paint(false);}
 function step(){if(destroyed||mini||blocked())return;pause();index=Math.min(index+1,beats.length-1);paint(!reducedMotion());}
 function visibility(){if(document.hidden)pause();}
 function preference(){if(reducedMotion())pause();}
 // Observe dialog shells only: watching every animated descendant would create
 // unnecessary callbacks on each pose. Dialog shells are permanent in index.html.
 const observer=!mini?new MutationObserver(()=>{if(reducedMotion()||blocked())pause();}):null;
 if(observer){for(const dialog of document.querySelectorAll('.veil'))observer.observe(dialog,{attributes:true,attributeFilter:['class']});observer.observe(document.body,{attributes:true,attributeFilter:['data-effects']});}
 const intersection=!mini&&typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{
  if(destroyed)return;
  for(const entry of entries)if(entry.target===root){onScreen=entry.isIntersecting;if(!onScreen)pause();}
 }):null;
 intersection?.observe(root);
 function destroy(){if(destroyed)return;pause();destroyed=true;puppets.forEach(p=>p?.release());observer?.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',visibility);media.removeEventListener?.('change',preference);}
 if(mini){index=beats.length-1;paint(false);}
 else {document.addEventListener('visibilitychange',visibility);media.addEventListener?.('change',preference);paint(false);if(!reducedMotion())play();}
 return {play,pause,step,destroy};
}
