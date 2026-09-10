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
