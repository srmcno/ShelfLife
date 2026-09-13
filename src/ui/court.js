import { COURT_LEVELS } from '../content/court.js';
import { COURT_BRIEFS } from '../content/court-banter.js';
import { courtEvidence, courtClueHelp, courtClearingReason, courtComparisonState, courtScore, courtDocket } from '../engine/court.js';
import { curioSVG } from '../art/curios.js';
import { renderPetSprite } from '../art/sprite.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,extra='')=>'<button class="btn" data-life="'+action+'" '+extra+'>'+label+'</button>';
const fallbackOpening='All rise. Those unable to rise may haunt the proceedings from where they are.';
export function courtHearing(game) {
 return game.hearing ||= {phase:'opening',speaker:'Judge Mortis',line:game.trial?.opening||fallbackOpening,exhibit:0,cleared:[]};
}
// The courtroom reacts to the very same evidence as the verdict engine. An
// objection tests one exhibit, never secretly substitutes a different puzzle.
export function courtInteract(game,action,index) {
 if(!game||game.claimed)return false;
 const h=courtHearing(game);
 if(action==='charge'||action==='prosecution'){
  h.phase='evidence';h.speaker=action==='charge'?'Clerk of the deceased':'Prosecution';h.line=game.trial?.[action]||game.intro;return true;
 }
 if(action==='select'){
  if(!Number.isInteger(index)||!game.suspects[index])return false;
  game.selection=index;h.phase='testimony';h.speaker=game.suspects[index].name;h.line=game.suspects[index].defence;return true;
 }
 if(action==='exhibit'){
  if(!Number.isInteger(index)||!game.clues[index])return false;
  h.exhibit=index;h.phase='evidence';h.speaker='Clerk of the deceased';h.line=game.clues[index];return true;
 }
 if(action==='object'){
  if(!Number.isInteger(game.selection)||!game.suspects[game.selection])return false;
  const suspect=game.suspects[game.selection],fits=courtEvidence(game,game.selection)[h.exhibit];
  h.phase=fits?'overruled':'sustained';h.speaker='Judge Mortis';
  h.line=fits?'Overruled. '+suspect.name+' fits Exhibit '+(h.exhibit+1)+'. Suspicion is not evidence, even when you point dramatically.':
   'Sustained. '+suspect.name+' contradicts Exhibit '+(h.exhibit+1)+' and is cleared. The prosecution may retrieve its dignity from the floor.';
  if(!fits&&!h.cleared.includes(game.selection))h.cleared.push(game.selection);
  return true;
 }
 return false;
}
const judge='<svg viewBox="0 0 120 145" aria-hidden="true"><path d="M23 145 31 91Q60 76 89 91L103 145" fill="#16151d" stroke="#7c676b" stroke-width="2"/><path d="m43 86 17 21 17-21-8 40H51Z" fill="#e3d2b1"/><path d="M33 49Q20 15 61 12q41 3 30 41L78 81H43Z" fill="#dacdad" stroke="#877b69" stroke-width="2"/><path d="M40 57q0-11 10-9 9 1 6 13-10 9-16-4m25 4q-3-12 6-13 10-2 10 9-6 13-16 4" fill="#31272f"/><path d="m56 71 5-8 5 8-5 2Z" fill="#42303a"/><path d="M47 80h28v12H47z" fill="#d2c2a2"/><path d="M52 80v12m8-12v12m8-12v12" stroke="#5b4e4d" stroke-width="2"/><path d="M31 61Q14 28 34 18q24-22 51 0 23 12 8 44l-12-3V36q-22 5-42 0v23Z" fill="#bcb7b0" stroke="#6b6265" stroke-width="2"/><g fill="#d4cfbf" stroke="#81767a" stroke-width="2"><circle cx="29" cy="45" r="8"/><circle cx="27" cy="57" r="8"/><circle cx="30" cy="69" r="8"/><circle cx="33" cy="81" r="8"/><circle cx="91" cy="45" r="8"/><circle cx="93" cy="57" r="8"/><circle cx="91" cy="69" r="8"/><circle cx="87" cy="81" r="8"/></g><path d="M33 30q5-18 19-10m0 0q8-18 18 0m0 0q13-9 18 12" fill="none" stroke="#ece6d3" stroke-width="6" stroke-linecap="round"/></svg>';
const room='<svg class="court-room-art" viewBox="0 0 720 350" preserveAspectRatio="none" aria-hidden="true"><path fill="#271d28" d="M0 0h720v350H0z"/><path fill="#342530" d="M30 0h660v248H30z"/><path fill="#111820" stroke="#765d4e" stroke-width="6" d="M280 151V80a80 80 0 0 1 160 0v71Z"/><path d="M360 0v151m-80-55h160" stroke="#765d4e" stroke-width="5"/><circle cx="394" cy="45" r="23" fill="#d7c69d"/><path d="M392 22q-20 27 4 44a23 23 0 0 1-4-44" fill="#f5dfae"/><path fill="#73533f" d="M51 0h22v249H51zm134 0h22v249h-22zM513 0h22v249h-22zm134 0h22v249h-22z"/><path fill="#a08059" d="M45 0h34v11H45zm0 234h34v14H45zM179 0h34v11h-34zm0 234h34v14h-34zM507 0h34v11h-34zm0 234h34v14h-34zM641 0h34v11h-34zm0 234h34v14h-34z"/><path fill="#4b2833" stroke="#87505b" stroke-width="2" d="M82 25h96v156H82zm460 0h94v181h-94z"/><path fill="#301e28" d="m82 25 48 67 48-67v35l-48 65-48-65zm460 0 47 66 47-66v35l-47 65-47-65Z"/><path d="M0 248h720v102H0z" fill="#493431"/><path d="m360 248-230 102m230-102-65 102m65-102 100 102m-100-102 270 102M0 275h720M0 312h720" stroke="#795546" stroke-width="2"/><path fill="#6b4937" stroke="#a58259" stroke-width="3" d="M214 175h292v82H214z"/><path fill="#472e2b" stroke="#8f674a" stroke-width="2" d="M228 188h264v54H228z"/><path fill="#ac8556" d="M202 171h316v11H202z"/><path fill="#b89762" d="m337 197 23-10 23 10v29l-23 9-23-9z"/><path d="m349 207 11-9 11 9m-11-9v25m-16 0h32" fill="none" stroke="#4f352f" stroke-width="3"/><path fill="#684536" stroke="#b08355" stroke-width="2" d="M77 230h139v72H77zm413 0h155v72H490z"/><path fill="#9b714c" d="M67 225h159v10H67zm413 0h175v10H480z"/><path d="M91 244v43m22-43v43m22-43v43m22-43v43m22-43v43m22-43v43m303-43v43m23-43v43m23-43v43m23-43v43m23-43v43m23-43v43" stroke="#412b29" stroke-width="10"/><path fill="#211a24" d="M0 309h720v41H0z"/><path fill="#684c3d" d="M0 304h720v9H0z"/><g fill="#d4c8aa" font-family="Georgia,serif" font-size="10" letter-spacing="2"><text x="360" y="252" text-anchor="middle">JUDGE MORTIS</text><text x="146" y="299" text-anchor="middle">PROSECUTION</text><text x="568" y="299" text-anchor="middle">THE DOCK</text></g></svg>';
const ghost=(i)=>'<span class="court-juror juror-'+i+'"><i></i></span>';
function stageMarkup(game) {
 const h=courtHearing(game),stamp=({sustained:'SUSTAINED',overruled:'OVERRULED',conviction:'GUILTY',acquittal:'ACQUITTED'})[h.phase];
 return '<section class="court-theatre" aria-label="The courtroom"><div class="court-stage phase-'+h.phase+'">'+room+'<div class="court-spotlight"></div><div class="court-judge">'+judge+'</div><div class="court-gavel"><svg viewBox="0 0 75 60" aria-hidden="true"><path d="m31 13 30 32" stroke="#d2ac74" stroke-width="9" stroke-linecap="round"/><path d="m15 17 21-17 17 19-21 17Z" fill="#bd9061" stroke="#e9c98e" stroke-width="3"/><path d="M30 52h38v7H30z" fill="#c5a171"/></svg></div><div class="court-prosecutor" aria-hidden="true"><svg viewBox="0 0 100 110"><path d="M27 20h50v60H27z" fill="#cabc9f"/><path d="M27 20h50L66 6H27Z" fill="#eee0ba"/><path d="M44 52h18m-21 10h25m-18 9h13" stroke="#5d4950" stroke-width="3"/><path d="M28 42 15 63m62-21 12 8M38 80v25m27-25v25" fill="none" stroke="#b59d80" stroke-width="5"/><circle cx="41" cy="37" r="4" fill="#44353b"/><circle cx="64" cy="37" r="4" fill="#44353b"/></svg></div><div class="court-dock-actor" data-court-dock aria-hidden="true"></div><div class="court-dock-front" aria-hidden="true"></div><div class="court-gallery" aria-hidden="true">'+[0,1,2,3,4,5].map(ghost).join('')+'</div>'+(stamp?'<div class="court-stamp" aria-hidden="true">'+stamp+'</div>':'')+'<span class="court-stage-caption" aria-hidden="true">THE LATE JURY</span></div><div class="court-dialogue"><span>'+esc(h.speaker)+(h.phase==='testimony'?' · unsworn testimony':'')+'</span><p>'+esc(h.line)+'</p></div>'+(!game.claimed?'<div class="court-stage-actions">'+button('Read the charge','court-charge')+button('Opening statement','court-prosecution')+'</div>':'')+'</section>';
}
function legacyCourtMarkup(game) {
 const h=courtHearing(game),selected=game.suspects[game.selection];
 return '<div class="court-case"><div class="court-masthead"><span class="eyebrow">The Court of Small & Final Matters</span><span class="court-session">In session</span></div><h3 id="courtCaseTitle" tabindex="-1">'+esc(game.title)+'</h3>'+stageMarkup(game)+'<p class="court-charge">'+esc(game.intro)+'</p><details class="court-case-settings"><summary>'+esc(game.difficulty)+' case · Change difficulty</summary><div class="court-levels" role="group" aria-label="Choose case difficulty">'+COURT_LEVELS.map((level,i)=>'<button class="btn" data-life="court-level" data-level="'+i+'" aria-pressed="'+(game.level===i)+'"><b>'+esc(level.name)+'</b><small>'+esc(level.summary)+'</small></button>').join('')+'</div><p>Changing difficulty starts a fresh case. No timer. No penalty for taking your time.</p></details><p class="court-instructions">'+esc(game.instructions)+' <b>Call a suspect, inspect the exhibits, then present your verdict.</b></p><div class="court-section-heading"><h4>Evidence on the record</h4><span>Verified facts</span></div><div class="court-evidence" role="group" aria-label="Choose an exhibit for cross-examination">'+game.clues.map((clue,i)=>'<button class="court-exhibit" data-life="court-exhibit" data-exhibit="'+i+'" aria-pressed="'+(h.exhibit===i)+'"><span class="court-exhibit-number">'+String(i+1).padStart(2,'0')+'</span><span><b>Exhibit '+(i+1)+(game.evidenceTitles?.[i]?' · '+esc(game.evidenceTitles[i]):'')+'</b><span>'+esc(clue)+'</span></span></button>').join('')+'</div><div class="court-controls">'+button(game.hints.length?'Explain the next exhibit':'Help me reason it out','court-hint',game.hints.length>=game.rules.length?'disabled':'')+'<small>Hints and objections are optional. Rewards stay the same.</small></div><div class="court-guidance" tabindex="-1">'+game.hints.map(hint=>'<p>'+esc(hint)+'</p>').join('')+'</div><div class="court-section-heading"><h4>Call someone to the stand</h4><span>'+game.suspects.length+' suspects · 1 culprit</span></div><p class="court-record-note">Their observations below are verified. Their testimony is not. A suspect must fit <b>every exhibit</b> to be guilty.</p><div class="suspect-grid" role="group" aria-label="Choose a suspect">'+game.suspects.map((suspect,i)=>'<button class="suspect-card '+(h.cleared.includes(i)?'court-cleared':'')+'" data-life="court-select" data-choice="'+i+'" aria-pressed="'+(game.selection===i)+'"><div id="suspectArt'+i+'" class="suspect-art" aria-hidden="true"></div><b>'+esc(suspect.name)+'</b>'+suspect.details.map((text,j)=>'<span><strong>'+esc(game.axes[j].name)+':</strong> '+esc(text)+'</span>').join('')+'<small>'+(h.cleared.includes(i)?'Cleared by the evidence':game.selection===i?'In the dock':'Call to the stand')+'</small></button>').join('')+'</div><div class="court-cross-examination"><div><span class="eyebrow">Cross-examination</span><p id="courtSelection" aria-live="polite">'+(selected?'<b>'+esc(selected.name)+'</b> is in the dock. Challenge their record against Exhibit '+(h.exhibit+1)+', or deliver your verdict.':'Choose a suspect above. A challenge checks the selected exhibit against their observations.')+'</p>'+(selected?'<blockquote class="court-witness-line"><span>'+esc(selected.name)+' · unsworn testimony</span>'+esc(selected.defence)+'</blockquote>':'')+'</div>'+button('Object with Exhibit '+(h.exhibit+1),'court-object',selected?'':'disabled')+'<div class="court-ruling">'+(['sustained','overruled'].includes(h.phase)?'<b>'+h.phase.toUpperCase()+'.</b> '+esc(h.line.replace(/^(Sustained|Overruled)\. /,'')):'')+'</div></div><div class="court-controls court-submit"><p>'+esc(selected?h.cleared.includes(game.selection)?'This suspect has been cleared. Call someone else to the stand before the verdict.':'Ready to accuse '+selected.name+'? Check every exhibit. The verdict ends this case.':'Select a suspect before presenting your verdict.')+'</p>'+button('Present verdict','court-confirm',selected&&!h.cleared.includes(game.selection)?'':'disabled')+'</div><details class="court-chatter"><summary>Read all unsworn statements</summary>'+game.suspects.map(suspect=>'<p><b>'+esc(suspect.name)+'</b><br>'+esc(suspect.defence)+'</p>').join('')+'</details></div>';
}
const courtReactions=new WeakMap();
export function mountCourtArt(host,game,state) {
 const mount=(holder,suspect)=>{
  if(!holder)return;
  const pet=state.pets.find(p=>p.id===suspect?.id);
  const manner=pet?((pet.stats?.menace||0)>(pet.stats?.cute||0)?'bluster':(pet.stats?.damp||0)>(pet.stats?.mystique||0)?'twitch':'wilt'):['bluster','wilt','twitch'][Array.from(suspect?.name||'').reduce((n,c)=>n+c.charCodeAt(0),0)%3];
  holder.dataset.manner=manner;
  holder.dataset.slTheatre='1';
  holder.replaceChildren();
  if(pet)holder.appendChild(renderPetSprite(pet));
  else holder.innerHTML=curioSVG(suspect?.name.includes('Sock')?'sock':suspect?.name.includes('Button')?'button':suspect?.name.includes('Crumb')?'raisin':'echo');
 };
 game.suspects.forEach((suspect,i)=>mount(host.querySelector('#suspectArt'+i),suspect));
 mount(host.querySelector('[data-court-dock]'),game.suspects[game.claimed?game.choice:game.selection]||game.suspects[0]);
 const stage=host.querySelector('.court-stage');
 if(stage&&game.sceneEvidence){
  const h=courtHearing(game),key=[game.seed,game.caseIndex,game.selection,h.phase,h.line].join('|');
  // Focus and notebook re-renders must not repeatedly slam the gavel. A new
  // witness, exhibit or ruling gets one finite reaction, including in Light.
  stage.classList.toggle('court-reaction-repeat',courtReactions.get(host)===key);
  courtReactions.set(host,key);
 }
}
export function courtRewardSummary(result) {
 if(result.rewardReason==='rest')return 'Practice verdict recorded. Court rewards were resting when you finished; the win and score still count.';
 if(result.rewardReason==='asleep')return 'Practice verdict recorded. Your resident was asleep when you finished; the win and score still count.';
 if(!result.rewardReason&&!result.fuss&&!result.bond)return 'Case recorded. No care reward was added; reward rests and daily trust limits may apply.';
 const attention=result.fuss>0?'+'+result.fuss+' attention.':'Attention is full.';
 const trust=result.bond>0?'+'+result.bond+' trust.':'No extra trust was available: the bond or daily bonus was full.';
 return attention+' '+trust;
}
export function courtResultMarkup(game,result,wins) {
 const h=courtHearing(game);h.phase=result.correct?'conviction':'acquittal';h.speaker='Judge Mortis';h.line=result.correct?(game.trial?.conviction||'Guilty. The sentence will outlive the crime.'):game.trial?.acquittal||'Acquitted. The prosecution is invited to reconsider its career.';
 const dialogue=result.dialogue||[{speaker:'Clerk',text:result.text}];
 return '<div class="court-case court-finished"><div class="court-masthead"><span class="eyebrow">The Court of Small & Final Matters</span><span class="court-session">Judgment delivered</span></div>'+stageMarkup(game)+'<div class="court-result"><span class="eyebrow">'+esc(game.difficulty)+' · '+(result.correct?'Correct verdict':'Case explained')+'</span><h3 id="courtVerdictTitle" tabindex="-1">'+(result.correct?'The evidence has teeth.':'Your suspect walks.')+'</h3><p>'+esc(result.text)+'</p><p>'+(result.correct?esc(courtRewardSummary(result))+' '+wins+' case'+(wins===1?'':'s')+' solved.':'No needs or trust lost. The culprit is identified below.')+'</p></div><div class="court-transcript">'+dialogue.map(line=>'<p><b>'+esc(line.speaker)+'</b><span>'+esc(line.text)+'</span></p>').join('')+'</div><div class="life-links">'+button('Another '+esc(game.difficulty.toLowerCase())+' case','court')+button('Close case','close')+'</div><div class="court-section-heading"><h4>Why the verdict stands</h4><span>The evidence, applied</span></div><div class="court-verdict-reasons">'+result.reasons.map(reason=>'<article class="'+(reason.culprit?'court-culprit':'')+'"><b>'+esc(reason.name)+'</b><span>'+esc(reason.text)+'</span>'+(reason.explanation?'<p>'+esc(reason.explanation)+'</p>':'')+'</article>').join('')+'</div><details class="court-review"><summary>Review the evidence and observations</summary><div class="court-evidence">'+game.clues.map((clue,i)=>'<article><b>Exhibit '+(i+1)+'</b><p>'+esc(clue)+'</p></article>').join('')+'</div>'+game.suspects.map(suspect=>'<p><b>'+esc(suspect.name)+'</b><br>'+suspect.details.map(esc).join(' · ')+'</p>').join('')+'</details><p class="hint">'+(result.correct?'Reward rests and daily trust limits still apply. ':'')+'The next hearing has fresh evidence and suspect records.</p></div>';
}

// The new trial is a workspace: the room and the next action stay on screen
// while just the current piece of evidence or testimony scrolls.
const chapterNames={investigation:'Evidence',hearing:'Suspects',verdict:'Verdict'};
export function courtView(game) {
 const v=game.ui||={chapter:game.phase||'investigation',witness:0,statement:0,exhibit:0};
 if(!chapterNames[v.chapter])v.chapter='investigation';
 for(const [key,length] of [['witness',game.suspects.length],['statement',3],['exhibit',game.sceneEvidence?.length||game.clues.length]])if(!Number.isInteger(v[key])||v[key]<0||v[key]>=length)v[key]=0;
 return v;
}
export function courtViewAction(game,action,value) {
 if(!game||game.claimed||!game.sceneEvidence)return false;
 const v=courtView(game);
 if(action==='chapter'&&chapterNames[value]){v.chapter=value;return true;}
 const length=action==='witness'?game.suspects.length:action==='statement'?3:action==='exhibit'?game.sceneEvidence.length:0;
 if(!Number.isInteger(value)||value<0||value>=length)return false;
 v[action]=value;
 if(action==='witness'){v.statement=0;game.selection=value;}
 return true;
}
export function courtResponse(game,response) {
 if(!response)return;
 const h=courtHearing(game);
 h.phase=response.kind||response.phase||'testimony';
 h.speaker=response.speaker||'Clerk of the deceased';
 h.line=response.text||response.message||h.line;
}
const evidenceShape=(e,i)=>/wax|seal|residue|dust|soil|fibre|fiber|marks|bite/i.test(e.title)?'tooth':/paper|notice|letter|ink|record|ledger/i.test(e.title)?'receipt':['key','paper','ribbon'][i%3];
const isExposed=(g,i)=>(g.exposures||[]).includes(i)||g.witnesses?.[i]?.exposed;
function courtDialogue(h) {
 return '<div class="court-dialogue"><span>'+esc(h.speaker)+'</span><p>'+esc(h.line)+'</p></div>';
}
function playableStage(game,finished=false) {
 const v=courtView(game),h=courtHearing(game),stamps={sustained:isExposed(game,v.witness)&&!game.eliminations.includes(v.witness)&&!game.rejected.includes(v.witness)?'ACCOUNT CORRECTED':'CLEARED',overruled:'STILL POSSIBLE',conviction:'GUILTY',acquittal:'TRY AGAIN',inspect:'EVIDENCE BAGGED'},stamp=stamps[h.phase];
 const visualPhase=h.phase==='sustained'&&(game.eliminations.includes(v.witness)||game.rejected.includes(v.witness))||h.phase==='acquittal'?'relief':h.phase;
 const hotspots=!finished&&v.chapter==='investigation'?crimeExhibits(game).map((e,i)=>'<button class="court-hotspot hotspot-'+i+' '+(e.collected?'is-bagged':'')+'" data-life="court-clue" data-clue="'+i+'" aria-label="Inspect Exhibit '+(i+1)+': '+esc(e.title)+'">'+curioSVG(evidenceShape(e,i),{literal:true})+'<span>'+(e.collected?'✓':i+1)+'</span></button>').join(''):'';
 return '<section class="court-theatre court-live-theatre" aria-label="The courtroom"><div class="court-stage phase-'+esc(visualPhase)+' scene-'+v.chapter+'"><div class="court-camera">'+room+'<div class="court-spotlight"></div><div class="court-judge">'+judge+'</div><div class="court-gavel"><svg viewBox="0 0 75 60" aria-hidden="true"><path d="m31 13 30 32" stroke="#d2ac74" stroke-width="9" stroke-linecap="round"/><path d="m15 17 21-17 17 19-21 17Z" fill="#bd9061" stroke="#e9c98e" stroke-width="3"/><path d="M30 52h38v7H30z" fill="#c5a171"/></svg></div><div class="court-prosecutor" aria-hidden="true"><svg viewBox="0 0 100 110"><path d="M27 20h50v60H27z" fill="#cabc9f"/><path d="M27 20h50L66 6H27Z" fill="#eee0ba"/><path d="M44 52h18m-21 10h25m-18 9h13" stroke="#5d4950" stroke-width="3"/><path d="M28 42 15 63m62-21 12 8M38 80v25m27-25v25" fill="none" stroke="#b59d80" stroke-width="5"/><circle cx="41" cy="37" r="4" fill="#44353b"/><circle cx="64" cy="37" r="4" fill="#44353b"/></svg></div><div class="court-dock-actor" data-court-dock aria-hidden="true"></div><div class="court-dock-front" aria-hidden="true"></div><div class="court-sweat" aria-hidden="true"><i></i><i></i><i></i></div><div class="court-gallery" aria-hidden="true">'+[0,1,2,3,4,5].map(ghost).join('')+'</div></div>'+hotspots+'<div class="court-dock-name"><span>'+(finished?'Verdict delivered':v.chapter==='investigation'?'Awaiting examination':cleared(game,v.witness)?'Cleared by the evidence':'On the stand')+'</span><b>'+esc(game.suspects[game.claimed?game.choice:v.witness]?.name||'')+'</b></div>'+(stamp?'<div class="court-stamp" aria-hidden="true">'+stamp+'</div>':'')+'<span class="court-stage-caption" aria-hidden="true">'+(v.chapter==='investigation'&&!finished?'TAP THE NUMBERED EVIDENCE':'THE LATE JURY')+'</span></div>'+courtDialogue(h)+'</section>';
}
export function crimeExhibits(game) {
 return game.rules.map((rule,i)=>{
  const source=game.sceneEvidence[rule.first.axis],axes=[...new Set([rule.first.axis,...(rule.second?[rule.second.axis]:[])])];
  return {id:i,source:source.id,title:game.evidenceTitles[i],description:source.description,clue:game.clues[i],collected:(game.version===3?axes.every(a=>game.inspected.includes(a)):game.inspected.includes(source.id)),records:game.suspects.map(s=>axes.map(a=>s.details[a]).join('; '))};
 });
}
const cleared=(game,i)=>game.eliminations?.includes(i)||game.rejected.includes(i);
function clueTabs(game) {
 const v=courtView(game);
 return '<div class="court-clue-tabs" role="group" aria-label="Crime evidence">'+crimeExhibits(game).map(e=>button('<span>'+(e.collected?'✓':e.id+1)+'</span><b>Clue '+(e.id+1)+'<small>'+esc(game.rules[e.id].second?'Linked observations':game.axes[game.rules[e.id].first.axis].name)+'</small></b>','court-clue','data-clue="'+e.id+'" aria-label="'+(e.collected?'Review':'Inspect')+' clue '+(e.id+1)+': '+esc(e.title)+'" aria-pressed="'+(v.statement===e.id)+'"')).join('')+'</div>';
}
function castPicker(game) {
 const v=courtView(game);
 return '<div class="court-cast-picker" role="group" aria-label="Call a suspect">'+game.suspects.map((s,i)=>button('<span id="suspectArt'+i+'" class="court-cast-art" aria-hidden="true"></span><b>'+esc(s.name)+'</b><small>'+(cleared(game,i)?'✓ Cleared':v.witness===i?'On the stand':'Call to stand')+'</small>','court-call','data-choice="'+i+'" aria-label="Call '+esc(s.name)+(cleared(game,i)?', cleared':'')+'" aria-pressed="'+(v.witness===i)+'"')).join('')+'</div>';
}
export function courtMatrixMarkup(game) {
 const v=courtView(game),labels={unknown:'Unknown',compatible:'Fits',contradictory:'Conflict'},symbols={unknown:'?',compatible:'✓',contradictory:'×'};
 return '<div class="court-comparison-board"><table class="court-comparison-matrix"><caption>Your deductions <small>Select a cell to compare its facts. Viewing is free.</small></caption><thead><tr><th scope="col">Suspect</th>'+game.rules.map((_,i)=>'<th scope="col">Clue '+(i+1)+'</th>').join('')+'</tr></thead><tbody>'+game.suspects.map((s,i)=>'<tr class="'+(cleared(game,i)?'is-cleared':v.witness===i?'is-selected':'')+'"><th scope="row">'+button('<b>'+esc(s.name)+'</b><small>'+(cleared(game,i)?'Cleared':v.witness===i?'On the stand':'Call to stand')+'</small>','court-call','data-choice="'+i+'" aria-pressed="'+(v.witness===i)+'"')+'</th>'+game.rules.map((_,j)=>{const status=courtComparisonState(game,i,j);return '<td><button class="court-matrix-cell state-'+status+'" data-life="court-pair" data-choice="'+i+'" data-clue="'+j+'" aria-label="'+esc(s.name)+', clue '+(j+1)+': '+labels[status]+'. View comparison" aria-pressed="'+(v.witness===i&&v.statement===j)+'"><span aria-hidden="true">'+symbols[status]+'</span><small>'+labels[status]+'</small></button></td>';}).join('')+'</tr>').join('')+'</tbody></table><p class="court-matrix-legend">? Untested · ✓ Compatible · × Contradictory <span>A matching clue alone never proves guilt.</span></p></div>';
}
function clueHelp(game,e) {
 return e.collected?'<details class="court-rule-help"><summary>Explain clue '+(e.id+1)+' · free</summary><p>'+esc(courtClueHelp(game,e.id))+'</p></details>':'';
}
function deductionFeedback(game,suspect) {
 const reason=courtClearingReason(game,suspect);
 return reason?'<p class="court-deduction-feedback">✓ Cleared by clue '+(reason.evidence+1)+'. '+esc(reason.text)+' Call someone else.</p>':'';
}
function notebook(game) {
 return '<details class="court-notebook"><summary>Your deduction notebook <span>'+courtDocket(game).cleared.length+' cleared · open grid</span></summary>'+courtMatrixMarkup(game)+'</details>';
}
function witnessRecord(game,e,suspect) {
 const rule=game.rules[e.id],axes=[...new Set([rule.first.axis,...(rule.second?[rule.second.axis]:[])])];
 return '<dl class="court-record-facts">'+axes.map(axis=>'<div><dt>'+esc(game.axes[axis].name)+'</dt><dd>'+esc(e.collected?game.suspects[suspect].details[axis]:'Observation sealed')+'</dd></div>').join('')+'</dl>';
}
function investigationPanel(game) {
 const v=courtView(game),e=crimeExhibits(game)[Math.min(v.statement,game.rules.length-1)];
 return '<div class="court-panel-heading"><span class="eyebrow">Your brief · find one culprit</span><h4 id="courtPanelTitle" tabindex="-1">'+esc(COURT_BRIEFS[game.caseIndex])+'</h4></div><p class="court-task-intro">Collect the clues. Find a contradiction to clear each innocent. The culprit fits every clue.</p>'+clueTabs(game)+'<article class="court-proof-sheet"><div class="court-evidence-label"><span class="court-evidence-illustration" aria-hidden="true">'+curioSVG(evidenceShape(e,e.id),{literal:true})+'</span><div><span class="eyebrow">Exhibit '+(e.id+1)+(e.collected?' · entered into evidence':' · awaiting inspection')+'</span><h5>'+esc(e.title)+'</h5></div></div>'+(e.collected?'<p class="court-proof">'+esc(e.clue)+'</p><p class="hint">Verified evidence. One conflicting observation is enough to clear a suspect.</p>':'<p>'+esc(e.description)+'</p><p class="hint">Tap the numbered object or Inspect Exhibit '+(e.id+1)+' below.</p>')+'</article>'+clueHelp(game,e)+'<details class="court-charge-details"><summary>The scene of the very small crime</summary><p>'+esc(game.intro)+'</p><p>'+esc(game.scene)+'</p></details>';
}
function hearingPanel(game) {
 const v=courtView(game),e=crimeExhibits(game)[Math.min(v.statement,game.rules.length-1)],s=game.suspects[v.witness],key=v.witness+':'+e.id,compared=game.comparisons.includes(key);
 return '<div class="court-panel-heading"><span class="eyebrow">Cross-examination · clear the innocents</span><h4 id="courtPanelTitle" tabindex="-1">'+esc(s.name)+(cleared(game,v.witness)?' may go.':' takes the stand.')+'</h4></div>'+castPicker(game)+clueTabs(game)+'<div class="court-fact-pair"><article><span>CLUE '+(e.id+1)+' · THE CULPRIT MUST FIT THIS</span><p>'+esc(e.collected?e.clue:'Inspect this exhibit first.')+'</p></article><article><span>'+esc(s.name.toUpperCase())+' · VERIFIED OBSERVATIONS</span>'+witnessRecord(game,e,v.witness)+'</article></div>'+(cleared(game,v.witness)?deductionFeedback(game,v.witness):compared?'<p class="court-deduction-feedback">No contradiction here. They remain possible. Choose a different clue above.</p>':'<p class="court-next-step"><b>Does their record break this rule?</b> If it does, submit the contradiction below. If it fits, read another clue.</p>')+clueHelp(game,e)+notebook(game)+'<details class="court-character-aside"><summary>The witness has more to say</summary>'+(s.memory?'<p>'+esc(s.memory)+'</p>':'')+'<p>'+esc(s.defence)+'</p><small>Unsworn commentary. It adds character, not evidence.</small></details>';
}
function verdictPanel(game) {
 const v=courtView(game),s=game.suspects[v.witness],docket=courtDocket(game);
 return '<div class="court-panel-heading"><span class="eyebrow">Closing argument · check every clue</span><h4 id="courtPanelTitle" tabindex="-1">'+(cleared(game,v.witness)?'This suspect has been cleared.':'Your accusation: '+esc(s.name))+'</h4></div>'+castPicker(game)+(docket.remaining.length===1?'<p class="court-last-suspect">One suspect remains. Check their record, then ask Mortis for a verdict.</p>':'<p class="court-next-step">'+docket.remaining.length+' suspects remain. You may accuse now if you can show that one fits every clue, or keep clearing innocents for 10 points each.</p>')+deductionFeedback(game,v.witness)+'<div class="court-verdict-ledger">'+crimeExhibits(game).map(e=>'<article><b>Clue '+(e.id+1)+'</b><p>'+esc(e.collected?e.clue:'Evidence not inspected.')+'</p>'+witnessRecord(game,e,v.witness)+clueHelp(game,e)+'</article>').join('')+'</div>'+notebook(game)+'<p class="court-next-step">A wrong accusation costs 15 case points and explains the conflict. The case stays open; nobody loses care or trust.</p>';
}
function courtActionBar(game) {
 const v=courtView(game),exhibits=crimeExhibits(game),e=exhibits[Math.min(v.statement,exhibits.length-1)],docket=courtDocket(game),all=docket.ready,next=exhibits.find(x=>!x.collected),isClear=cleared(game,v.witness);
 let actions,status;
 if(v.chapter==='investigation'){
  status=exhibits.filter(e=>e.collected).length+' / '+exhibits.length+' crime clues inspected';
  actions=(next?button('Inspect Exhibit '+(next.id+1),'court-clue','data-clue="'+next.id+'"'):button('Review the charge','court-charge'))+button('Compare suspects →','court-chapter','data-chapter="hearing" '+(all?'':'disabled'));
 }else if(v.chapter==='hearing'){
  const tested=game.comparisons.includes(v.witness+':'+e.id);
  status=!e.collected?'Inspect this clue before comparing the suspect’s record.':isClear?(docket.remaining.length===1?'One suspect remains. Their verdict is ready for your review.':'Innocent cleared. '+docket.remaining.length+' suspects remain. Call the next one.'):tested?'This clue fits. Try a different clue; one match does not prove guilt.':game.version===3?'A proven contradiction earns 10 points. An unsupported argument costs 5. Explanations are free.':'Use a conflicting clue to clear this suspect.';
  const nextClue=tested?exhibits.find(x=>!game.comparisons.includes(v.witness+':'+x.id)):null;
  actions=(!e.collected?button('Inspect clue '+(e.id+1),'court-clue','data-clue="'+e.id+'"'):isClear?button('Call '+esc(game.suspects[docket.nextSuspect].name),'court-call','data-choice="'+docket.nextSuspect+'"'):nextClue?button('Read clue '+(nextClue.id+1),'court-clue','data-clue="'+nextClue.id+'"'):button(tested?'All clues checked':'Clear with clue '+(e.id+1),'court-compare',tested?'disabled':''))+button(docket.remaining.length===1?'Review the final suspect →':'Make an accusation →','court-chapter','data-chapter="verdict" '+(all?'':'disabled'));
 }else{
  status=isClear?'This suspect is cleared. Select someone else.':!all?'Inspect all the crime clues before accusing.':'Does their verified record fit every crime clue?';
  actions=(next?button('Inspect clue '+(next.id+1),'court-clue','data-clue="'+next.id+'"'):button('Keep investigating','court-chapter','data-chapter="hearing"'))+button('Accuse '+esc(game.suspects[v.witness].name),'court-file',all&&!isClear?'':'disabled');
 }
 return '<footer class="court-action-bar"><p role="status">'+esc(status)+'</p><div>'+actions+'</div></footer>';
}
export function courtMarkup(game) {
 if(!game.sceneEvidence)return legacyCourtMarkup(game);
 const v=courtView(game),docket=courtDocket(game);
 return '<div class="court-case court-playable court-deduction"><header class="court-play-header"><div><span class="eyebrow">Court of Small & Final Matters · '+esc(game.difficulty)+'</span><h3 id="courtCaseTitle" tabindex="-1">'+esc(game.title)+'</h3><p class="court-case-progress">'+courtScore(game)+' points · '+docket.collected.filter(Boolean).length+'/'+game.rules.length+' clues · '+docket.remaining.length+' remaining</p></div><details class="court-case-settings"><summary aria-label="Case information and difficulty">Case file</summary><div><p>'+esc(game.intro)+'</p><p>The physical evidence identifies exactly one culprit. Clear anyone who conflicts with a clue. The remaining suspect must fit all of them.</p><p>Case points: start with '+(100+game.level*25)+', earn 10 for each innocent you clear, lose '+(game.version===3?'5 for an unsupported argument and ':'')+'15 for a wrong accusation. Explaining a clue is always free.</p><p>Choosing a new difficulty replaces this unfinished case.</p><div class="court-levels">'+COURT_LEVELS.map((l,i)=>button('New '+esc(l.name)+' case','court-level','data-level="'+i+'"')).join('')+'</div></div></details></header><nav class="court-chapters" aria-label="Court chapters">'+Object.entries(chapterNames).map(([id,label],i)=>'<button class="btn" data-life="court-chapter" data-chapter="'+id+'" aria-pressed="'+(v.chapter===id)+'"><span>'+(i+1)+'</span>'+label+'</button>').join('')+'</nav><div class="court-workspace">'+playableStage(game)+'<section class="court-action-panel" aria-label="'+chapterNames[v.chapter]+'">'+(v.chapter==='investigation'?investigationPanel(game):v.chapter==='hearing'?hearingPanel(game):verdictPanel(game))+'</section></div>'+courtActionBar(game)+'</div>';
}
export function courtFinishedMarkup(game,result,wins) {
 if(!game.sceneEvidence)return courtResultMarkup(game,result,wins);
 const h=courtHearing(game);h.phase='conviction';h.speaker='Judge Mortis';h.line=game.trial.conviction;
 const culprit=game.suspects[game.answer];
 const sentence='<section class="court-sentence" aria-label="Sentence and last word"><span class="eyebrow">The defendant would like the last word</span><blockquote><b>'+esc(culprit.name)+'</b><p>'+esc(game.trial.plea)+'</p></blockquote><div class="court-sentence-order"><span>BY ORDER OF JUDGE MORTIS</span><p>'+esc(game.trial.sentence)+'</p></div></section>';
 const reasons='<div class="court-verdict-reasons">'+(result.reasons||[]).map(r=>'<article class="'+(r.culprit?'court-culprit':'')+'"><b>'+esc(r.name)+'</b><span>'+esc(r.text)+'</span>'+(r.explanation?'<p>'+esc(r.explanation)+'</p>':'')+'</article>').join('')+'</div>';
 return '<div class="court-case court-playable court-deduction court-finished"><header class="court-play-header"><div><span class="eyebrow">Judgment delivered · '+esc(game.difficulty)+'</span><h3 id="courtVerdictTitle" tabindex="-1">'+esc(culprit.name)+' did it.</h3><p class="court-case-progress">'+esc(result.rank||game.rank||'Case closed')+'</p></div></header><div class="court-workspace">'+playableStage(game,true)+'<section class="court-action-panel" aria-label="Verdict and sentence">'+sentence+'<div class="court-result"><h4>The case is yours.</h4><p>'+esc(culprit.name)+' is the only suspect who fits all '+game.rules.length+' crime clues.</p><div class="court-verdict-metrics"><b>'+result.score+'<span>case points</span></b><b>'+(result.stats.eliminations||0)+' / '+(game.suspects.length-1)+'<span>innocents cleared</span></b><b>'+result.stats.mistakes+'<span>missed arguments</span></b></div><p>'+esc(courtRewardSummary(result))+' '+wins+' case'+(wins===1?'':'s')+' solved.</p></div><details class="court-review"><summary>Why the verdict stands</summary>'+reasons+'</details></section></div><footer class="court-action-bar"><p>Case closed. The witnesses are already revising their memoirs.</p><div>'+button('Another case','court-new')+button('Close case','close')+'</div></footer></div>';
}
