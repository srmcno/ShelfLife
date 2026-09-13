import { capabilitiesOf } from '../engine/behavior.js';
import { curioSVG } from '../art/curios.js';
import { renderPetSprite } from '../art/sprite.js';
import { missionStops } from '../content/project-encounters.js';
import { PROJECTS, PROJECT_STOPS } from '../content/projects.js';
import { GEAR, RELICS } from '../content/life.js';
import { OUTING_DARES } from '../engine/life.js';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scenery={drawer:['sock','button','medal'],fridge:['pea','moon','sun'],cupboard:['spoon','tooth','key']};

export function trailTheatre(route,step,{travel=false,done=false,mission=false}={}){
 const props=mission?PROJECT_STOPS[route].map(s=>s.prop):scenery[route]||scenery.drawer,current=Math.min(2,step);
 return '<div class="trail-theatre trail-scene-'+route+(travel?' travelling':'')+(done?' trail-homecoming':'')+'" style="--trail-stop:'+current+'" aria-hidden="true"><div class="trail-back-wall"></div><span class="trail-light"></span><div class="trail-road"></div>'+props.map((prop,i)=>'<div class="trail-landmark landmark-'+i+(i===current?' active':'')+'">'+curioSVG(prop,{literal:true})+'</div>').join('')+'<div class="trail-travellers"></div><span class="trail-dust dust-one"></span><span class="trail-dust dust-two"></span>'+(done?'<span class="trail-home-light"></span>':'')+'</div>';
}

export function mountTrailCrew(host,crew){
 const row=host.querySelector('.trail-travellers');if(!row)return;
 for(const pet of crew.slice(0,2)){const actor=document.createElement('div');const ability=capabilitiesOf(pet);actor.className='trail-traveller gait-'+(ability.fly?'fly':ability.ooze?'ooze':ability.stride?'scuttle':'walk');actor.appendChild(renderPetSprite(pet));row.appendChild(actor);}
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
  if(o.mission&&o.step>0&&(o.missionRevision>=2?o.recovered.length>0:o.parts.length>=2)){
   const back=document.createElement('button');back.className='btn trail-return-early';back.dataset.life='outing-return';back.textContent='Bank '+o.recovered.length+' recovered part'+(o.recovered.length===1?'':'s')+' & return home';dock.appendChild(back);
  }
  const label=document.createElement('p');label.className='trail-dock-status';label.textContent=o.project?Math.min(o.parts.length,2)+' / 2 parts · '+o.nerve+' nerve · '+(o.toolUsed?'tool used':'tool ready'):o.version===2?o.score+' points · '+o.nerve+' nerve · '+(o.toolUsed?'tool used':'tool ready'):o.score+' preparation points';dock.prepend(label);
  for(const b of dock.querySelectorAll('[data-life="outing-choice"]')){
   const choice=Number(b.dataset.choice),hint=b.querySelector('small');if(!hint)continue;
   hint.classList.add('trail-option-long');const brief=document.createElement('small');brief.className='trail-option-mobile';
   if(o.project){const part=o.project.parts[o.step],cost=o.expertise.includes(o.steps[o.step].stat)?1:2;brief.textContent=choice===0?'Leave part · restore 2 nerve':choice===1?'Get '+part+' · −'+cost+' nerve':o.toolUsed?'Tool already used':o.gear===o.steps[o.step].good?'Get '+part+' · use tool':'Save tool for another stop';}
   else if(o.version!==2)brief.textContent=hint.textContent;
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

export function projectArt(id) {
 const drawing=id==='drawer'?'<path d="M42 164V35h144v129M29 165h177"/><circle cx="170" cy="44" r="16"/><path d="M58 42h112v33"/><g class="project-moving"><path d="M165 71v38M125 107h78l-8 44h-62Z"/><circle cx="161" cy="127" r="11"/><path d="M151 127h20m-10-10v20"/></g>':id==='fridge'?'<path d="M52 30h135v138H52Z"/><path d="M61 47h117v107H61Z"/><path d="M62 102h115"/><g class="project-moving"><path d="M115 47v107h63V47Z"/><circle cx="128" cy="103" r="3"/></g><path d="M73 74h29v19H73Zm4-7h21M73 134h29m-22-8h18"/>':'<path d="M29 105h177l-15 50H45Zm19 51-6 14m144-14 7 14M167 103V61q0-20-20-20t-20 20h21"/><g class="project-moving"><path d="M65 86q-17-12 0-26t0-25m37 55q-17-12 0-26t0-25m35 68v-6"/></g><circle cx="120" cy="125" r="12"/><circle cx="80" cy="117" r="5"/>';
 return '<svg viewBox="0 0 240 190" role="img" aria-label="'+esc(PROJECTS.find(p=>p.id===id)?.name)+'"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</g></svg>';
}
export function projectBoard(l) {
 return '<section class="household-workshop" aria-label="Household projects"><div class="workshop-heading"><span class="eyebrow">Built by the household</span><h3>Bring the place to life.</h3><p>Expeditions recover the parts. You decide what gets built.</p></div><div class="project-grid">'+PROJECTS.map(p=>{
  const built=l.projects.includes(p.id),n=(l.projectParts[p.id]||[]).length,pages=(l.trailPages||[]).filter(id=>id.startsWith(p.id+':'));
  const journal=pages.length?'<details class="project-field-guide"><summary>Read field notes · '+pages.length+'/8</summary>'+pages.map(id=>'<article><b>Route edition '+(Number(id.split(':')[1])+1)+'</b>'+missionStops(p.id,Number(id.split(':')[1]),2).map(stop=>'<p><strong>'+esc(stop.title)+'</strong><br>'+esc(stop.text)+'</p>').join('')+'</article>').join('')+'</details>':'';
  return '<article class="project-card project-'+p.id+' '+(built?'is-built':'is-blueprint')+'"><div class="project-drawing">'+projectArt(p.id)+(built?'<div class="project-occupant" aria-hidden="true"></div>':'')+'<span>'+(built?'INSTALLED':'PLAN '+String(PROJECTS.indexOf(p)+1).padStart(2,'0'))+'</span></div><div class="project-card-copy"><h4>'+esc(p.name)+'</h4><p>'+esc(p.benefit)+'.</p><p class="project-field-pages">'+(l.trailPages||[]).filter(id=>id.startsWith(p.id+':')).length+' / 8 field notes</p><button class="btn" data-life="'+(built?'use-project':'project-mission')+'" data-id="'+p.id+'">'+esc(built?p.action:'Recover parts · '+Math.min(n,2)+'/2')+'</button><p class="project-reaction" role="status"></p>'+journal+'</div></article>';
 }).join('')+'</div></section>';
}
export function missionPlan(state,route,gear,lead,companion,dare) {
 const l=state.life,p=PROJECTS.find(x=>x.id===route),parts=l.projectParts[route]||[],built=l.projects.includes(route),crew=state.pets.filter(p=>[lead,companion].includes(p.id)),edition=l.outings%8,stops=missionStops(route,edition,2),pages=(l.trailPages||[]).filter(id=>id.startsWith(route+':')).length,pageKnown=(l.trailPages||[]).includes(route+':'+edition);
 const crewBrief=crew.map(pet=>{const supported=stops.filter(stop=>(pet.stats?.[stop.stat]||0)>=7);return '<p><b>'+esc(pet.name)+'</b> '+(supported.length?'Reduces detour cost to 1 nerve at '+supported.map(stop=>esc(stop.title)).join(' and ')+'.':'No specialist shortcut on this route. Detours cost 2 nerve.')+' <small>Can gain '+Math.max(0,Math.min(8,100-(pet.needs?.fuss||0)))+' attention this trip.</small></p>';}).join('');
 const matching=stops.findIndex(stop=>stop.good===gear);
 const gearBrief='<p><b>'+esc(GEAR.find(g=>g.id===gear)?.name)+'</b> secures '+esc(p.parts[matching])+' at stop '+(matching+1)+' without spending nerve. Once per trip.</p>';
 const select=(id,label,options)=>'<label>'+label+'<select id="'+id+'">'+options+'</select></label>';
 const option=(value,label,selected)=>'<option value="'+value+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
 return '<div class="trail-intro"><span class="eyebrow">Household recovery missions</span><h3>Something worth going out for.</h3></div><nav class="mission-picker" aria-label="Choose a recovery mission">'+PROJECTS.map(x=>'<button class="btn" data-life="route" data-id="'+x.id+'" aria-pressed="'+(x.id===route)+'">'+esc(x.name)+(l.projects.includes(x.id)?'<small>Built · explore again</small>':'<small>'+Math.min((l.projectParts[x.id]||[]).length,2)+' / 2 parts recovered</small>')+'</button>').join('')+'</nav><div class="mission-brief"><div class="mission-blueprint">'+projectArt(route)+'</div><div><span class="eyebrow">'+(built?'Challenge replay':'Your objective')+'</span><h3>'+esc(p.goal)+'</h3><p>'+esc(p.line)+'</p><p class="mission-reward"><b>'+esc(p.benefit)+'.</b> '+(built?'Already installed. Try different choices to discover more curiosities and complete your field notes.':'Bring home any 2 distinct parts below to install it permanently.')+'</p></div></div><ol class="mission-scout">'+stops.map((s,i)=>'<li class="'+(parts.includes(i)?'recovered':'')+'"><span>'+(parts.includes(i)?'✓':i+1)+'</span><div><b>'+esc(p.parts[i])+'</b><small>'+esc(s.title)+' · '+esc(GEAR.find(g=>g.id===s.good).name)+'</small></div></li>').join('')+'</ol><div class="crew-picker">'+select('outingLead','Lead resident',state.pets.map(p=>option(p.id,p.name,p.id===lead)).join(''))+select('outingCompanion','Companion',option('','Solo expedition',!companion)+state.pets.filter(p=>p.id!==lead).map(p=>option(p.id,p.name,p.id===companion)).join(''))+select('outingGear','Pack one tool',GEAR.map(g=>option(g.id,g.name,g.id===gear)).join(''))+'</div><section class="mission-crew-brief" aria-label="What your crew and tool change">'+crewBrief+gearBrief+'</section><div class="mission-rules"><p><b>Get a part:</b> take the detour (spend nerve), or use the matching tool (once per trip).</p><p><b>Need nerve?</b> Leave a part behind to restore 2 nerve. You start with 2 and can hold 3. Recovered parts stay yours between trips. After finding a part, you may return early: keep your haul, forgo later finds and the full-route field note.</p></div><details class="trail-map"><summary>Route costs & optional wager</summary>'+stops.map((s,i)=>'<article><b>'+esc(s.title)+'</b><span>Detour: '+(crew.some(p=>(p.stats?.[s.stat]||0)>=7)?1:2)+' nerve · '+esc(s.stat)+'</span></article>').join('')+trailDareSelect(dare)+'</details><p class="mission-field-note"><b>Field notes '+pages+'/8 · route edition '+(edition+1)+'</b> '+(pageKnown?'This page is already recorded. Replays still give attention and any missing curiosity.':'Visit all three stops to record this page: +2 discoveries, once for this edition.')+'</p><div class="life-links"><button class="btn btn-primary" data-life="set-out">'+(built?'Replay this mission':'Set out for parts')+'</button></div>';
}
export function missionStatus(o) {
 if(!o.project)return '';
 return '<div class="mission-progress"><span><b>'+esc(o.project.name)+'</b><small>'+(o.parts.length>=2?'Parts secured · return home or explore further':'Recover any 2 distinct parts')+'</small></span><strong>'+Math.min(o.parts.length,2)+' / 2</strong></div>';
}
export function missionResult(o) {
 if(!o.project)return '';
 const success=o.parts.length>=2;
 const relic=RELICS.find(r=>r.id===o.result?.relic);
 const recovered='<div class="mission-recovered-objects" aria-label="Recovered this trip">'+(o.result?.found||[]).map(i=>'<span>'+curioSVG(PROJECT_STOPS[o.route][i].prop,{literal:true})+'<small>'+esc(o.project.parts[i])+'</small></span>').join('')+'</div>';
 const haul=relic?'<div class="mission-haul"><span>Trail score <b>'+o.score+' / '+o.best+'</b><small>Possible with this crew and plan</small></span><p>Bonus find: <strong>'+esc(relic.name)+'</strong><small>'+(o.result.fresh?'New curiosity · +4 discoveries':'Already in your collection')+'</small></p></div>':'';
 return '<section class="mission-result"><div class="mission-result-drawing">'+projectArt(o.route)+'</div><span class="eyebrow">'+(o.result?.built?'Built and installed':success?'Mission replay complete':'Parts safely stored')+'</span><h3>'+esc(o.project.name)+'</h3><p>'+esc(success?o.project.benefit+'. It is waiting in your household workshop.':'You have '+o.parts.length+' of the 2 distinct parts needed. They stay in storage; your next trip can recover a different part.')+'</p><ol class="mission-scout">'+o.project.parts.map((name,i)=>'<li><span>'+(o.parts.includes(i)?'✓':'○')+'</span><div>'+esc(name)+'</div></li>').join('')+'</ol>'+recovered+haul+(o.result?.page?'<p class="mission-field-note">Field note '+(Number(o.result.page.split(':')[1])+1)+' / 8 · '+(o.result.pageFresh?'+2 discoveries. Read this route’s encounters in the workshop field notes.':'Already recorded. No repeat discovery points.')+'</p>':o.missionRevision>=2&&o.returnedAt?'<p class="mission-field-note">Returned after stop '+o.returnedAt+'. Your parts are safe. Unvisited stops gave no nerve, points or field note.</p>':'')+'</section>';
}
