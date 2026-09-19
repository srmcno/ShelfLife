import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { capabilitiesOf } from '../engine/behavior.js';
import { curioSVG } from '../art/curios.js';
import { renderPetSprite } from '../art/sprite.js';
import { expeditionSet, expeditionTool } from '../art/expedition-stage.js';
import { missionStops } from '../content/project-encounters.js';
import { PROJECTS, PROJECT_STOPS } from '../content/projects.js';
import { GEAR, RELICS, OUTINGS } from '../content/life.js';
import { OUTING_DARES, outingPreview, dayKey } from '../engine/life.js';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scenery={drawer:['sock','button','medal'],fridge:['pea','moon','sun'],cupboard:['spoon','tooth','key']};

export function trailDareSelect(selected=''){
 return '<label class="trail-dare-picker">Optional field wager · +2 points if completed<select id="outingDare"><option value="">No wager this trip</option>'+OUTING_DARES.map(d=>'<option value="'+d.id+'" '+(selected===d.id?'selected':'')+'>'+esc(d.name)+' · '+esc(d.line)+'</option>').join('')+'</select></label><p class="hint">Your wager never takes points away. Choose a route that earns it without giving up a better detour.</p>';
}

export function trailDareStatus(o){
 const dare=OUTING_DARES.find(d=>d.id===o.dare);if(!dare)return '';
 let progress=o.dare==='bold'?o.choices.filter(c=>c===1).length+' / 2 detours':o.dare==='thrifty'?(o.toolUsed?'Equipment already used':'Equipment untouched'):o.nerve+' nerve / need 2 at home';
 if(o.step===3)progress=o.dareBonus?'+2 wager points earned':'Wager not met. No points lost.';
 return '<div class="trail-dare-status '+(o.step===3&&o.dareBonus?'fulfilled':'')+'"><b>'+esc(dare.name)+'</b><span>'+esc(progress)+'</span>'+(o.step===3&&o.dareBonus?'<p>'+esc(dare.payoff)+'</p>':'<small>'+esc(dare.line)+'</small>')+'</div>';
}

export function projectArt(id) {
 const drawing=id==='drawer'?'<path d="M42 164V35h144v129M29 165h177"/><circle cx="170" cy="44" r="16"/><path d="M58 42h112v33"/><g class="project-moving"><path d="M165 71v38M125 107h78l-8 44h-62Z"/><circle cx="161" cy="127" r="11"/><path d="M151 127h20m-10-10v20"/></g>':id==='fridge'?'<path d="M52 30h135v138H52Z"/><path d="M61 47h117v107H61Z"/><path d="M62 102h115"/><g class="project-moving"><path d="M115 47v107h63V47Z"/><circle cx="128" cy="103" r="3"/></g><path d="M73 74h29v19H73Zm4-7h21M73 134h29m-22-8h18"/>':'<path d="M29 105h177l-15 50H45Zm19 51-6 14m144-14 7 14M167 103V61q0-20-20-20t-20 20h21"/><g class="project-moving"><path d="M65 86q-17-12 0-26t0-25m37 55q-17-12 0-26t0-25m35 68v-6"/></g><circle cx="120" cy="125" r="12"/><circle cx="80" cy="117" r="5"/>';
 return '<svg viewBox="0 0 240 190" role="img" aria-label="'+esc(PROJECTS.find(p=>p.id===id)?.name)+'"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</g></svg>';
}
export function projectBoard(l,now=Date.now()) {
 return '<section class="household-workshop" aria-label="Household projects"><div class="workshop-heading"><span class="eyebrow">Built by the household</span><h3>Bring the place to life.</h3><p>Expeditions recover the parts. You decide what gets built.</p></div><div class="project-grid">'+PROJECTS.map(p=>{
  const built=l.projects.includes(p.id),n=(l.projectParts[p.id]||[]).length,pages=(l.trailPages||[]).filter(id=>id.startsWith(p.id+':'));
  const journal=pages.length?'<details class="project-field-guide"><summary>Read field notes · '+pages.length+'/8</summary>'+pages.map(id=>'<article><b>Route edition '+(Number(id.split(':')[1])+1)+'</b>'+missionStops(p.id,Number(id.split(':')[1]),2).map(stop=>'<p><strong>'+esc(stop.title)+'</strong><br>'+esc(stop.text)+'</p>').join('')+'</article>').join('')+'</details>':'';
  return '<article class="project-card project-'+p.id+' '+(built?'is-built':'is-blueprint')+'"><div class="project-drawing">'+projectArt(p.id)+(built?'<div class="project-occupant" aria-hidden="true"></div>':'')+'<span>'+(built?'INSTALLED':'PLAN '+String(PROJECTS.indexOf(p)+1).padStart(2,'0'))+'</span></div><div class="project-card-copy"><h4>'+esc(p.name)+'</h4><p>'+esc(p.benefit)+'.</p><p class="project-field-pages">'+(l.trailPages||[]).filter(id=>id.startsWith(p.id+':')).length+' / 8 field notes</p><button class="btn" data-life="'+(built?'use-project':'project-mission')+'" data-id="'+p.id+'">'+esc(built?p.action:'Recover parts · '+Math.min(n,2)+'/2')+'</button><p class="project-reaction" role="status">'+(built&&l.day===dayKey(now)&&l.daily?.includes('project:'+p.id)?'Today’s care delivered. Play again whenever you like.':'')+'</p>'+journal+'</div></article>';
 }).join('')+'</div></section>';
}
const actionButton=(label,action,{primary=false,extra='',className=''}={})=>'<button class="btn '+(primary?'btn-primary ':'')+className+'" data-life="'+action+'" '+extra+'>'+label+'</button>';
const gearName=id=>GEAR.find(g=>g.id===id)?.name||'Packed equipment';
const crewFor=(state,ids)=>[...new Set(ids)].map(id=>state.pets.find(p=>p.id===id)).filter(Boolean).slice(0,2);
const canReturn=o=>!!(o.mission&&o.step>0&&o.step<3&&(o.missionRevision>=2?o.recovered.length>0:o.parts.length>=2));
const partCount=o=>o.parts?.length||0;

function crewNames(crew) {
 return crew.map(p=>esc(p.name)).join(' <span aria-hidden="true">&amp;</span> ')||'Your expedition crew';
}

function stage(route,step,{phase='playing',choice,project=null,prop=null,gear='',crew=[]}={}) {
 const mode=choice===0?'quiet':choice===1?'detour':choice===2?'tool':'arrive';
 const object=project?projectArt(project.id):curioSVG(prop||PROJECT_STOPS[route]?.[Math.min(2,step)]?.prop||'key',{literal:true});
 return '<div class="expedition-stage set-'+route+' stage-'+phase+' move-'+mode+'" aria-hidden="true">'+expeditionSet(route)+'<div class="expedition-stage-vignette"></div><div class="expedition-path"></div><div class="expedition-object '+(project?'is-project':'')+'">'+object+'</div><div class="expedition-cast" data-expedition-cast></div>'+(phase==='report'&&choice===2?'<div class="expedition-tool-prop">'+expeditionTool(gear)+'</div>':'')+'<span class="expedition-dust"></span><span class="expedition-dust second"></span><span class="expedition-stage-ticket">'+(phase==='result'?'HOME, MOSTLY INTACT':phase==='planning'?'DEPARTURES · '+crew.length+' ABOARD':'FIELD STOP '+String(step+1).padStart(2,'0'))+'</span></div>';
}

function routeMap(stops,{current=-1,choices=[],parts=[],recovered=[],returnedAt=null,project=null,expertise=[],gear='',planning=false}={}) {
 return '<ol class="expedition-route-map" aria-label="'+(planning?'Three stops and their costs':'Expedition route progress')+'">'+stops.map((stop,i)=>{
  const visited=i<choices.length&&!(returnedAt&&i>=returnedAt),found=recovered.includes(i),stored=parts.includes(i),here=i===current;
  const status=planning?(stored?'Already stored':gear===stop.good?'Packed tool fits':(expertise.includes(stop.stat)?1:2)+' nerve detour'):found?'Part recovered':visited?'Passed safely':stored?'Stored at home':returnedAt&&i>=returnedAt?'Unvisited':here?'You are here':'Ahead';
  return '<li class="'+(here?'current ':'')+(visited?'visited ':'')+(found||stored?'has-part ':'')+(planning&&gear===stop.good?'tool-match':'')+'" '+(here?'aria-current="step"':'')+'><span class="expedition-route-node">'+(found?'✓':i+1)+'</span><div><b>'+esc(project?.parts[i]||stop.title)+'</b><small>'+esc(status)+'</small></div></li>';
 }).join('')+'</ol>';
}

function tripResources(o) {
 if(o.version!==2)return '<div class="expedition-hud"><span><b>'+o.score+' / 3</b> situations supported</span><span>'+esc(gearName(o.gear))+'</span></div>';
 const nerve='<span class="expedition-nerve" aria-label="'+o.nerve+' of 3 nerve">'+[0,1,2].map(i=>'<i class="'+(i<o.nerve?'filled':'')+'" aria-hidden="true"></i>').join('')+'</span>';
 return '<div class="expedition-hud" aria-label="Expedition supplies"><span>'+nerve+'<small><b>'+o.nerve+' / 3</b> nerve</small></span><span class="expedition-tool-state '+(o.toolUsed?'is-used':'')+'">'+expeditionTool(o.gear)+'<small><b>'+(o.toolUsed?'Tool used':'Tool ready')+'</b>'+esc(gearName(o.gear))+'</small></span><span><b class="expedition-score">'+o.score+'</b><small>trail points</small></span></div>';
}

function objective(o) {
 if(!o.project)return '';
 const secured=partCount(o)>=2;
 return '<div class="expedition-objective"><span><b>'+esc(o.project.name)+'</b><small>'+(secured?'The build is covered. Explore for a curiosity and field note.':'Any 2 different parts build it. Your stored parts count.')+'</small></span><strong>'+Math.min(2,partCount(o))+'<small> / 2 parts</small></strong></div>';
}

function journal(o,{open=false}={}) {
 if(!o.log?.length)return '';
 return '<details class="expedition-journal" '+(open?'open':'')+'><summary>Your journey so far · '+Math.min(o.returnedAt||o.step,3)+' '+((o.returnedAt||o.step)===1?'stop':'stops')+'</summary><ol>'+o.log.map((line,i)=>'<li><span>0'+(i+1)+'</span><div><b>'+esc(o.steps?.[i]?.title||OUTINGS.find(r=>r.id===o.route)?.steps[i]?.title||'Stop '+(i+1))+'</b><p>'+esc(line)+'</p></div></li>').join('')+'</ol></details>';
}

function routeNotes(o,crew) {
 const stops=o.steps||OUTINGS.find(r=>r.id===o.route)?.steps||[];
 return '<details class="trail-map expedition-notes"><summary>Look ahead · crew & route notes</summary><p class="hint">'+crewNames(crew)+' · '+esc(gearName(o.gear))+'</p>'+(o.version===2?stops.slice(o.step).map((stop,i)=>'<article><b>Stop '+(o.step+i+1)+' · '+esc(stop.title)+'</b><span>Detour: '+(o.expertise.includes(stop.stat)?1:2)+' nerve · +'+stop.points+' points'+(o.expertise.includes(stop.stat)?' · your crew has the '+esc(stop.stat):'')+'</span><small>Tool match: '+esc(gearName(stop.good))+'</small></article>').join(''):'')+trailDareStatus(o)+'<p class="hint">Everyone comes home. Trip nerve never changes your residents’ needs. Close whenever you like; your choices are saved.</p></details>';
}

function choiceMarkup(option,o) {
 const preview=option.preview,choice=option.choice;
 let outcome,detail;
 if(!option.available){
  outcome=choice===1?'Needs '+(o.expertise.includes(o.steps[o.step].stat)?1:2)+' nerve · you have '+o.nerve:o.toolUsed?'Your tool has already been used':'This stop needs '+gearName(o.steps[o.step].good);
  detail=choice===1?'Take the quiet route to recover nerve.':o.toolUsed?'Choose a detour or take the quiet route.':'Keep '+gearName(o.gear)+' for its matching stop.';
 } else {
  outcome=o.project?(choice===0?(o.parts.includes(o.step)?'Leave the spare part':'Leave this part'):preview.partNew?'Recover '+o.project.parts[preview.partIndex]:'Part already stored · trail points only'):choice===0?'Keep the crew steady':'Explore the encounter';
  detail='Nerve '+o.nerve+' → '+preview.nerve+' · +'+preview.points+' points'+(choice===2?' · use tool':'');
 }
 return actionButton('<span class="expedition-option-number" aria-hidden="true">'+(choice===0?'↪':choice===1?'↗':'✦')+'</span><span class="expedition-option-copy"><b>'+esc(option.label)+'</b><small class="expedition-option-outcome">'+esc(outcome)+'</small><small class="expedition-option-cost">'+esc(detail)+'</small></span>','outing-choice',{className:'expedition-option option-'+choice,extra:'data-choice="'+choice+'" '+(option.available?'':'disabled')});
}

function legacyChoices(state,o,step) {
 const preview=outingPreview(state,o.route,o.gear,o.cast)?.[o.step];
 return step.options.map((label,i)=>actionButton('<span class="expedition-option-copy"><b>'+esc(label)+'</b><small>'+esc(i===0?(preview?.gear?'Your equipment supports this.':'Best with '+gearName(step.good)+'. Improvisation still gets you home.'):(preview?.skill?'Your crew has the '+step.stat+' for this.':step.stat+' 7+ helps. Your crew will improvise.'))+'</small></span>','outing-choice',{className:'expedition-option',extra:'data-choice="'+i+'"'})).join('');
}

function planningMarkup(state,route,gear,lead,companion,dare) {
 const life=state.life,project=PROJECTS.find(p=>p.id===route)||PROJECTS[0],id=project.id;
 const parts=life.projectParts[id]||[],built=life.projects.includes(id),crew=crewFor(state,[lead,companion]);
 const edition=life.outings%8,stops=missionStops(id,edition,2),pages=(life.trailPages||[]).filter(key=>key.startsWith(id+':')).length,pageKnown=(life.trailPages||[]).includes(id+':'+edition);
 const trained=(state.mastery?.expedition?.tier||0)>=1;
 const expertise=trained?[...new Set(crew.flatMap(p=>['cute','menace','damp','mystique'].filter(stat=>(p.stats?.[stat]||0)>=7)))]:[];
 const matching=stops.findIndex(stop=>stop.good===gear);
 const select=(name,label,options)=>'<label>'+label+'<select id="'+name+'">'+options+'</select></label>';
 const option=(value,label,selected)=>'<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
 const pack=crew.map((pet,i)=>{
  const supported=trained?stops.map((stop,index)=>(pet.stats?.[stop.stat]||0)>=7?index+1:null).filter(Boolean):[];
  return '<article class="expedition-packed-resident"><div class="expedition-portrait" data-expedition-pet="'+i+'" aria-hidden="true"></div><div><small>'+(i?'Companion':'Lead resident')+'</small><b>'+esc(pet.name)+'</b><p>'+(supported.length?'1-nerve detours at '+(supported.length===1?'stop ':'stops ')+supported.join(' & '):trained?'No specialist shortcut on this route.':'Survey lesson · detours cost 2 nerve.')+'</p></div></article>';
 }).join('');
 const tool='<article class="expedition-packed-tool">'+expeditionTool(gear)+'<div><small>Use once</small><b>'+esc(gearName(gear))+'</b><p>Secures '+esc(project.parts[matching])+' at stop '+(matching+1)+' without spending nerve.</p></div></article>';
 const crewBrief=crew.map(pet=>{
  const supported=trained?stops.filter(stop=>(pet.stats?.[stop.stat]||0)>=7):[];
  return '<p><b>'+esc(pet.name)+'</b> '+(supported.length?'Reduces detour cost to 1 nerve at '+supported.map(stop=>esc(stop.title)).join(' and ')+'.':trained?'No specialist shortcut on this route. Detours cost 2 nerve.':'Survey detours cost 2 nerve. Learn crew expertise next.')+' <small>Can gain '+Math.max(0,Math.min(8,100-(pet.needs?.fuss||0)))+' attention this trip.</small></p>';
 }).join('');
 return '<header class="expedition-heading"><span class="eyebrow">Three stops. One unlikely little crew.</span><h3 tabindex="-1">Make something of the journey.</h3></header><nav class="mission-picker expedition-destinations" aria-label="Choose a recovery mission">'+PROJECTS.map(p=>actionButton('<span class="expedition-destination-art">'+curioSVG(p.shape,{literal:true})+'</span><span>'+esc(p.name)+'<small>'+(life.projects.includes(p.id)?'Built · explore again':Math.min(2,(life.projectParts[p.id]||[]).length)+' / 2 parts stored')+'</small></span>','route',{extra:'data-id="'+p.id+'" aria-pressed="'+(p.id===id)+'"'})).join('')+'</nav>'+stage(id,0,{phase:'planning',project,crew})+'<div class="expedition-mission-brief"><div><span class="eyebrow">'+esc(OUTINGS.find(r=>r.id===id).name)+'</span><h4>'+esc(project.goal)+'</h4><p>'+esc(project.line)+'</p></div><div class="expedition-build-promise"><b>'+esc(project.benefit)+'.</b><small>'+(built?'Already installed. Find missing curiosities and collect new field notes.':'Bring home any 2 distinct parts to install it permanently. Parts can come from different trips.')+'</small></div></div>'+routeMap(stops,{project,parts,expertise,gear,planning:true})+'<h4 class="expedition-pack-heading">Who’s going, and what’s in the bag?</h4><div class="expedition-packing">'+pack+tool+'</div><div class="crew-picker expedition-crew-picker">'+select('outingLead','Lead resident',state.pets.map(p=>option(p.id,p.name,p.id===lead)).join(''))+select('outingCompanion','Companion',option('','Solo expedition',!companion)+state.pets.filter(p=>p.id!==lead).map(p=>option(p.id,p.name,p.id===companion)).join(''))+select('outingGear','Pack one tool',GEAR.map(g=>option(g.id,g.name,g.id===gear)).join(''))+'</div><div class="expedition-primer"><p><b>Recover a part</b> with a detour or its matching tool.</p><p><b>Catch your breath</b> by passing a part: restore 2 nerve, up to 3.</p><p><b>Come home whenever</b> you have a part. Later stops and the full-route field note stay unexplored.</p></div><details class="trail-map expedition-notes"><summary>Check the plan · crew advantages & route costs</summary><section class="mission-crew-brief" aria-label="What your crew and tool change">'+crewBrief+'</section>'+stops.map((stop,i)=>'<article><b>Stop '+(i+1)+' · '+esc(stop.title)+'</b><span>Detour: '+(expertise.includes(stop.stat)?1:2)+' nerve · '+esc(stop.stat)+'</span><small>Tool: '+esc(gearName(stop.good))+'</small></article>').join('')+'<p class="hint">You start with 2 nerve and can hold 3. Trip nerve never changes your residents’ needs. There is no time limit. Close and pick up exactly where you left off.</p></details><details class="trail-wager-settings"><summary>Optional wager · +2 trail points</summary>'+trailDareSelect(dare)+'</details><p class="mission-field-note"><b>Field notes '+pages+'/8 · route edition '+(edition+1)+'</b> '+(pageKnown?'This page is already recorded. Replays still give attention and any missing curiosity.':'Visit all three stops to record this page: +2 discoveries, once for this edition.')+'</p>';
}

function homecoming(o,crew) {
 const modern=o.version===2;
 const tier=modern?(o.score>=6?2:o.score>=3?1:0):(o.score>=3?2:o.score>=1?1:0);
 const relic=RELICS.find(r=>r.id===(o.result?.relic||o.route+':'+tier));
 const installed=!!o.project&&partCount(o)>=2;
 const headline=o.result?.built?o.project.name+' is ready.':o.project&&!installed?'A small haul. A good start.':'Home with a story to tell.';
 const found=o.result?.found||o.recovered||[];
 const objects=o.project?'<section class="expedition-haul-parts"><h4>'+(found.length?'Brought home this trip':'Nothing recovered this trip')+'</h4><div>'+found.map(i=>'<span>'+curioSVG(PROJECT_STOPS[o.route][i].prop,{literal:true})+'<b>'+esc(o.project.parts[i])+'</b></span>').join('')+'</div><p>'+(!found.length?'All the existing parts are still safe in storage. ':o.result?.built?'These parts helped finish the build. ':installed?'Your project is already installed. ':'You now have '+partCount(o)+' of the 2 different parts needed. ')+'</p></section>':'';
 const rewardCards=[];
 if(o.result?.built)rewardCards.push('<article><span class="expedition-reward-icon">'+projectArt(o.route)+'</span><div><small>Built and installed · +6 discoveries</small><b>'+esc(o.project.name)+'</b><p>'+esc(o.project.benefit)+'.</p></div></article>');
 if(relic)rewardCards.push('<article><span class="expedition-reward-icon">'+curioSVG(relic.shape)+'</span><div><small>'+(o.result?.fresh?'New curiosity · +4 discoveries':'Curiosity already collected')+'</small><b>'+esc(relic.name)+'</b><p>'+esc(relic.line)+'</p></div></article>');
 if(o.result?.page)rewardCards.push('<article><span class="expedition-reward-icon">'+curioSVG('paper',{literal:true})+'</span><div><small>'+(o.result.pageFresh?'New field note · +2 discoveries':'Field note already recorded')+'</small><b>Route edition '+(Number(o.result.page.split(':')[1])+1)+'</b><p>Read this route’s encounters in the workshop field notes.</p></div></article>');
 return '<header class="expedition-heading"><span class="eyebrow">'+(o.returnedAt?'An early return. A perfectly valid plan.':'Expedition complete · three stops behind you')+'</span><h3 tabindex="-1">'+esc(headline)+'</h3><p class="expedition-crew-names">'+crewNames(crew)+'</p></header>'+stage(o.route,2,{phase:'result',project:installed?o.project:null,prop:relic?.shape,crew})+(o.project?'<p class="expedition-home-benefit">'+esc(installed?o.project.benefit+'. It is waiting in your household workshop.':'Recovered parts stay in storage. Bring home a different part next time to finish '+o.project.name+'.')+'</p>':'')+objects+'<section class="expedition-rewards" aria-label="Expedition rewards">'+rewardCards.join('')+'</section><div class="expedition-result-score"><b>'+o.score+'</b><span>'+(modern?'trail points · '+o.best+' possible with this crew and plan':'of 3 situations supported by your equipment or crew')+'<small>'+(modern&&o.score===o.best?'A perfect trail. The undertaker returned your deposit through clenched teeth.':'Everybody came home. The bag has become everybody’s problem.')+'</small></span></div>'+trailDareStatus(o)+(o.missionRevision>=2&&o.returnedAt?'<p class="mission-field-note">Returned after stop '+o.returnedAt+'. Your parts are safe. Unvisited stops gave no nerve, points or field note.</p>':'')+journal(o)+'<p class="expedition-save-note">These rewards belong to this completed trip. Reopening the report adds no rewards.</p>';
}

/** The presentation boundary for every saved expedition generation and phase.
 * Commands and persistence stay in initLife; this view owns no timers or game state.
 */
export function expeditionView(state,outing,{route='drawer',gear='thread',lead='',companion='',dare='',interlude=false}={}) {
 if(!outing){
  route=PROJECTS.some(p=>p.id===route)?route:'drawer';gear=GEAR.some(g=>g.id===gear)?gear:'thread';
  if(!state.pets.some(p=>p.id===lead))lead=state.pets[0]?.id||'';
  if(companion===lead||!state.pets.some(p=>p.id===companion))companion='';
  const crew=crewFor(state,[lead,companion]),built=state.life.projects.includes(route);
  return makeView('Beyond the shelf','planning',crew,'<p>'+esc(masteryText(state,'expedition'))+'</p><p>Finish with at least 3 trail points to learn the next lesson. Crew skills reduce detour costs after the survey. At the final tier, the first detour opens a different route for stops 2 and 3. Recover a part to return safely early.</p>'+planningMarkup(state,route,gear,lead,companion,dare),'<p class="expedition-departure"><b>2 nerve</b> · one tool · no time limit</p>'+actionButton(built?'Explore this route':'Set out for parts','set-out',{primary:true,extra:crew.length?'':'disabled'})+actionButton('Beginner survey practice','outing-practice')+'<small class="expedition-dock-note">Your journey saves after every choice.</small>');
 }
 const o=outing,crew=crewFor(state,o.cast||[]),modern=o.version===2;
 const phase=o.step===3?'result':interlude&&o.step>0?'report':'playing';
 const stops=modern?o.steps:OUTINGS.find(r=>r.id===o.route).steps;
 const step=stops[Math.min(2,phase==='report'?o.step-1:o.step)];
 const map=routeMap(stops,{current:phase==='report'?o.step-1:o.step,choices:o.choices||Array(o.step).fill(0),parts:o.parts||[],recovered:o.recovered||[],returnedAt:o.returnedAt,project:o.project});
 if(phase==='result'){
  const actions=(o.mission?actionButton(partCount(o)>=2?'Use it at home':'Return to the workshop','project-home',{primary:true}):actionButton('Display your curiosity','finish-outing',{primary:true}))+(modern?'<div class="expedition-secondary-actions">'+actionButton('Try this trail again','outing-retry')+actionButton('Plan another expedition','outing-next')+'</div>':'');
  return makeView(o.mission?'Back home':'Expedition complete',phase,crew,homecoming(o,crew),actions);
 }
 const back=canReturn(o)?actionButton('Return home · keep '+o.recovered.length+' recovered part'+(o.recovered.length===1?'':'s'),'outing-return',{className:'expedition-return'}):'';
 const header='<header class="expedition-heading"><span class="eyebrow">'+esc(OUTINGS.find(r=>r.id===o.route).name)+' · '+(phase==='report'?'Field report '+o.step:'Stop '+(o.step+1))+' of 3</span><h3 tabindex="-1">'+esc(phase==='report'?'A little further from ordinary.':step.title)+'</h3><p class="expedition-crew-names">'+crewNames(crew)+'</p></header>';
 let body=header+map+tripResources(o)+stage(o.route,phase==='report'?o.step-1:o.step,{phase,choice:phase==='report'?o.choices?.at(-1):undefined,prop:step.prop||scenery[o.route]?.[phase==='report'?o.step-1:o.step],gear:o.gear,crew});
 if(phase==='report'){
  const choice=o.choices?.at(-1),found=o.recovered?.includes(o.step-1);
  body+='<section class="expedition-field-report"><span class="eyebrow">'+(found?'Part safely in the bag':modern&&choice===0?'Quiet route taken'+(o.project?' · part left behind':''):'An encounter behind you')+'</span><p class="scene-script">'+esc(o.log.at(-1))+'</p></section>'+objective(o)+journal(o);
  return makeView('An expedition in progress',phase,crew,body,'<p class="expedition-next-stop">Next: <b>'+esc(stops[o.step].title)+'</b></p>'+actionButton('Continue to stop '+(o.step+1),'continue-outing',{primary:true})+back+'<small class="expedition-dock-note">Close now to pause here. Nothing expires.</small>');
 }
 body+='<p class="scene-script expedition-encounter">'+esc(step.text)+'</p>'+objective(o)+(o.step?'<details class="expedition-last-event"><summary>Last time on this route</summary><p>'+esc(o.log.at(-1))+'</p></details>':'')+routeNotes(o,crew)+journal(o);
 const choices=modern?o.options.map(option=>choiceMarkup(option,o)).join(''):legacyChoices(state,o,step);
 return makeView('An expedition in progress',phase,crew,body,'<p class="expedition-decision-prompt">'+(o.project?'How will you handle this part?':'What does your crew do?')+'</p><div class="expedition-choices expedition-decision-list">'+choices+'</div>'+back+'<small class="expedition-dock-note">'+(modern?'Every choice shows the exact result for your supplies.':'This saved expedition keeps its original two choices.')+'</small>');
}

function makeView(title,phase,crew,body,actions) {
 return {title,phase,crew,html:'<section class="adventure-workspace trail-workspace expedition-view phase-'+phase+'"><div class="adventure-scroll expedition-reading-pane">'+body+'</div><footer class="adventure-actions expedition-action-dock">'+actions+'</footer></section>'};
}

export function mountExpedition(host,view) {
 const row=host.querySelector('[data-expedition-cast]');
 row?.replaceChildren();
 for(const [i,pet] of view.crew.entries()){
  if(row){
   const actor=document.createElement('div'),ability=capabilitiesOf(pet);
   actor.className='expedition-actor gait-'+(ability.fly?'fly':ability.ooze?'ooze':ability.stride?'scuttle':'walk');
   // The finite trip choreography owns these sprites, including after redraw.
   // The global idle director must not claim the same animation layer.
   actor.dataset.slTheatre='1';actor.appendChild(renderPetSprite(pet));row.appendChild(actor);
  }
  const portrait=host.querySelector('[data-expedition-pet="'+i+'"]');
  if(portrait){portrait.dataset.slTheatre='1';portrait.replaceChildren(renderPetSprite(pet));}
 }
}
