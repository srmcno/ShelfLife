import { curioSVG } from '../art/curios.js';
import { renderPetSprite } from '../art/sprite.js';
import { OUTING_DARES } from '../engine/life.js';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scenery={drawer:['sock','button','medal'],fridge:['pea','moon','sun'],cupboard:['spoon','tooth','key']};

export function trailTheatre(route,step,{travel=false,done=false}={}){
 const props=scenery[route]||scenery.drawer,current=Math.min(2,step);
 return '<div class="trail-theatre trail-scene-'+route+(travel?' travelling':'')+(done?' trail-homecoming':'')+'" style="--trail-stop:'+current+'" aria-hidden="true"><div class="trail-back-wall"></div><span class="trail-light"></span><div class="trail-road"></div>'+props.map((prop,i)=>'<div class="trail-landmark landmark-'+i+(i===current?' active':'')+'">'+curioSVG(prop,{literal:true})+'</div>').join('')+'<div class="trail-travellers"></div><span class="trail-dust dust-one"></span><span class="trail-dust dust-two"></span>'+(done?'<span class="trail-home-light"></span>':'')+'</div>';
}

export function mountTrailCrew(host,crew){
 const row=host.querySelector('.trail-travellers');if(!row)return;
 for(const pet of crew.slice(0,2)){const actor=document.createElement('div');actor.className='trail-traveller';actor.appendChild(renderPetSprite(pet));row.appendChild(actor);}
}

export function trailDareSelect(selected=''){
 return '<label class="trail-dare-picker">Optional field wager · +2 points if completed<select id="outingDare"><option value="">No wager this trip</option>'+OUTING_DARES.map(d=>'<option value="'+d.id+'" '+(selected===d.id?'selected':'')+'>'+esc(d.name)+' · '+esc(d.line)+'</option>').join('')+'</select></label><p class="hint">Your wager never takes points away. Choose a route that earns it without giving up a better detour.</p>';
}

export function trailDareStatus(o){
 const dare=OUTING_DARES.find(d=>d.id===o.dare);if(!dare)return '';
 let progress=o.dare==='bold'?o.choices.filter(c=>c===1).length+' / 2 detours':o.dare==='thrifty'?(o.toolUsed?'Equipment already used':'Equipment untouched'):o.nerve+' nerve / need 2 at home';
 if(o.step===3)progress=o.dareBonus?'+2 wager points earned':'Wager not met. No points lost.';
 return '<div class="trail-dare-status '+(o.step===3&&o.dareBonus?'fulfilled':'')+'"><b>'+esc(dare.name)+'</b><span>'+esc(progress)+'</span>'+(o.step===3&&o.dareBonus?'<p>'+esc(dare.payoff)+'</p>':'<small>'+esc(dare.line)+'</small>')+'</div>';
}

// Every expedition screen has one reading pane and a separate action dock.
// Desktop remains a document layout; on phones the dock cannot scroll away.
export function wrapTrailLayout(host,phase,o=null){
 const workspace=document.createElement('section'),scroll=document.createElement('div'),dock=document.createElement('footer');
 workspace.className='adventure-workspace trail-workspace phase-'+phase;scroll.className='adventure-scroll';dock.className='adventure-actions trail-action-dock';
 const selector=phase==='playing'?'.expedition-choices':phase==='report'?'.trail-report-actions':phase==='result'?'.trail-final-actions':'.life-links';
 const actions=host.querySelector(selector);if(actions)dock.appendChild(actions);
 if(phase==='playing'&&o){
  const label=document.createElement('p');label.className='trail-dock-status';label.textContent=o.version===2?o.score+' points · '+o.nerve+' nerve · '+(o.toolUsed?'tool used':'tool ready'):o.score+' preparation points';dock.prepend(label);
  for(const b of dock.querySelectorAll('[data-life="outing-choice"]')){
   const choice=Number(b.dataset.choice),hint=b.querySelector('small');if(!hint)continue;
   hint.classList.add('trail-option-long');const brief=document.createElement('small');brief.className='trail-option-mobile';
   if(o.version!==2)brief.textContent=hint.textContent;
   else if(choice===0)brief.textContent='Restore 2 nerve · 0 points';
   else if(choice===1){const parts=hint.textContent.match(/\+(\d+) points · costs (\d+) nerve/);brief.textContent=parts?'+'+parts[1]+' points · −'+parts[2]+' nerve':hint.textContent;}
   else{const points=hint.textContent.match(/\+(\d+) points/);brief.textContent=points?'+'+points[1]+' points · use tool':'Tool already used';}
   b.appendChild(brief);
  }
 }
 if(phase==='planning'){
  const wager=host.querySelector('.trail-dare-picker'),rules=host.querySelector('.trail-rules');
  if(wager){const details=document.createElement('details'),summary=document.createElement('summary');details.className='trail-wager-settings';summary.textContent='Optional wager · bonus points';details.appendChild(summary);wager.before(details);const hint=wager.nextElementSibling;details.appendChild(wager);if(hint?.classList.contains('hint'))details.appendChild(hint);}
  const map=host.querySelector('.trail-map');if(rules&&map)map.appendChild(rules);
 }
 if(phase==='playing'){
  host.querySelector('.trail-supplies')?.classList.add('trail-supplies-desktop');
  const wager=host.querySelector('.trail-dare-status'),map=host.querySelector('.trail-map');if(wager&&map)map.querySelector('summary')?.after(wager);
 }
 while(host.firstChild)scroll.appendChild(host.firstChild);workspace.append(scroll,dock);host.appendChild(workspace);
}
