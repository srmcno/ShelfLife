import { COURT_LEVELS } from '../content/court.js';
import { courtEvidence } from '../engine/court.js';
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
export function mountCourtArt(host,game,state) {
 const mount=(holder,suspect)=>{
  if(!holder)return;
  const pet=state.pets.find(p=>p.id===suspect?.id);
  const manner=pet?((pet.stats?.menace||0)>(pet.stats?.cute||0)?'bluster':(pet.stats?.damp||0)>(pet.stats?.mystique||0)?'twitch':'wilt'):['bluster','wilt','twitch'][Array.from(suspect?.name||'').reduce((n,c)=>n+c.charCodeAt(0),0)%3];
  holder.dataset.manner=manner;
  if(pet)holder.appendChild(renderPetSprite(pet));
  else holder.innerHTML=curioSVG(suspect?.name.includes('Sock')?'sock':suspect?.name.includes('Button')?'button':suspect?.name.includes('Crumb')?'raisin':'echo');
 };
 game.suspects.forEach((suspect,i)=>mount(host.querySelector('#suspectArt'+i),suspect));
 mount(host.querySelector('[data-court-dock]'),game.suspects[game.claimed?game.choice:game.selection]||game.suspects[0]);
}
export function courtResultMarkup(game,result,wins) {
 const h=courtHearing(game);h.phase=result.correct?'conviction':'acquittal';h.speaker='Judge Mortis';h.line=result.correct?(game.trial?.conviction||'Guilty. The sentence will outlive the crime.'):game.trial?.acquittal||'Acquitted. The prosecution is invited to reconsider its career.';
 const dialogue=result.dialogue||[{speaker:'Clerk',text:result.text}];
 return '<div class="court-case court-finished"><div class="court-masthead"><span class="eyebrow">The Court of Small & Final Matters</span><span class="court-session">Judgment delivered</span></div>'+stageMarkup(game)+'<div class="court-result"><span class="eyebrow">'+esc(game.difficulty)+' · '+(result.correct?'Correct verdict':'Case explained')+'</span><h3 id="courtVerdictTitle" tabindex="-1">'+(result.correct?'The evidence has teeth.':'Your suspect walks.')+'</h3><p>'+esc(result.text)+'</p><p>'+(result.correct?'+'+result.fuss+' attention · +'+result.bond+' trust. '+wins+' cases solved.':'No needs or trust lost. The culprit is identified below.')+'</p></div><div class="court-transcript">'+dialogue.map(line=>'<p><b>'+esc(line.speaker)+'</b><span>'+esc(line.text)+'</span></p>').join('')+'</div><div class="life-links">'+button('Another '+esc(game.difficulty.toLowerCase())+' case','court')+button('Back to the shelf','close')+'</div><div class="court-section-heading"><h4>Why the verdict stands</h4><span>The evidence, applied</span></div><div class="court-verdict-reasons">'+result.reasons.map(reason=>'<article class="'+(reason.culprit?'court-culprit':'')+'"><b>'+esc(reason.name)+'</b><span>'+esc(reason.text)+'</span>'+(reason.explanation?'<p>'+esc(reason.explanation)+'</p>':'')+'</article>').join('')+'</div><details class="court-review"><summary>Review the evidence and observations</summary><div class="court-evidence">'+game.clues.map((clue,i)=>'<article><b>Exhibit '+(i+1)+'</b><p>'+esc(clue)+'</p></article>').join('')+'</div>'+game.suspects.map(suspect=>'<p><b>'+esc(suspect.name)+'</b><br>'+suspect.details.map(esc).join(' · ')+'</p>').join('')+'</details><p class="hint">'+(result.correct?'Reward rests and daily trust limits still apply. ':'')+'The next hearing has fresh evidence and suspect records.</p></div>';
}

// The new trial is a workspace: the room and the next action stay on screen
// while just the current piece of evidence or testimony scrolls.
const chapterNames={investigation:'Investigate',hearing:'Cross-examine',verdict:'Verdict'};
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
function evidenceTray(game) {
 const v=courtView(game);
 return '<div class="court-exhibit-tray" role="group" aria-label="Evidence bag">'+game.sceneEvidence.map((e,i)=>'<button class="court-inventory '+((game.inspected||[]).includes(i)?'collected':'')+'" data-life="court-view-exhibit" data-exhibit="'+i+'" aria-pressed="'+(v.exhibit===i)+'" aria-label="Select Exhibit '+(i+1)+': '+esc(e.title)+((game.inspected||[]).includes(i)?', collected':', not inspected')+'"><span>'+curioSVG(evidenceShape(e,i))+'</span><b>'+(i+1)+'</b><small>'+((game.inspected||[]).includes(i)?'Bagged':'Uncollected')+'</small></button>').join('')+'</div>';
}
function compactCourtDialogue(h) {
 const line=String(h.line||''),first=line.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||line;
 const preview=first.length>100?first.slice(0,97).replace(/\s+\S*$/,'')+'…':first;
 return '<div class="court-dialogue"><span>'+esc(h.speaker)+'</span><p class="court-desktop-line">'+esc(line)+'</p><details class="court-mobile-line"><summary><span class="court-dialogue-preview"><b>'+esc(h.speaker)+'</b><span>'+esc(preview)+'</span></span><span class="court-line-toggle"><span class="court-line-more">Full line</span><span class="court-line-less">Close line</span></span></summary><p tabindex="0" aria-label="Full courtroom dialogue">'+esc(line)+'</p></details></div>';
}
function playableStage(game,finished=false) {
 const v=courtView(game),h=courtHearing(game),stamps={sustained:'CONTRADICTION',overruled:'NOT PROVEN',conviction:'GUILTY',acquittal:'TRY AGAIN',inspect:'EVIDENCE BAGGED'},stamp=stamps[h.phase];
 const hotspots=!finished&&v.chapter==='investigation'?game.sceneEvidence.map((e,i)=>'<button class="court-hotspot hotspot-'+i+' '+((game.inspected||[]).includes(i)?'is-bagged':'')+'" data-life="court-inspect" data-exhibit="'+i+'" aria-label="Inspect Exhibit '+(i+1)+': '+esc(e.title)+'">'+curioSVG(evidenceShape(e,i))+'<span>'+((game.inspected||[]).includes(i)?'✓':i+1)+'</span></button>').join(''):'';
 return '<section class="court-theatre court-live-theatre" aria-label="The courtroom"><div class="court-stage phase-'+esc(h.phase)+' scene-'+v.chapter+'"><div class="court-camera">'+room+'<div class="court-spotlight"></div><div class="court-judge">'+judge+'</div><div class="court-gavel"><svg viewBox="0 0 75 60" aria-hidden="true"><path d="m31 13 30 32" stroke="#d2ac74" stroke-width="9" stroke-linecap="round"/><path d="m15 17 21-17 17 19-21 17Z" fill="#bd9061" stroke="#e9c98e" stroke-width="3"/><path d="M30 52h38v7H30z" fill="#c5a171"/></svg></div><div class="court-prosecutor" aria-hidden="true"><svg viewBox="0 0 100 110"><path d="M27 20h50v60H27z" fill="#cabc9f"/><path d="M27 20h50L66 6H27Z" fill="#eee0ba"/><path d="M44 52h18m-21 10h25m-18 9h13" stroke="#5d4950" stroke-width="3"/><path d="M28 42 15 63m62-21 12 8M38 80v25m27-25v25" fill="none" stroke="#b59d80" stroke-width="5"/><circle cx="41" cy="37" r="4" fill="#44353b"/><circle cx="64" cy="37" r="4" fill="#44353b"/></svg></div><div class="court-dock-actor" data-court-dock aria-hidden="true"></div><div class="court-dock-front" aria-hidden="true"></div><div class="court-sweat" aria-hidden="true"><i></i><i></i><i></i></div><div class="court-gallery" aria-hidden="true">'+[0,1,2,3,4,5].map(ghost).join('')+'</div></div>'+hotspots+(stamp?'<div class="court-stamp" aria-hidden="true">'+stamp+'</div>':'')+'<span class="court-stage-caption" aria-hidden="true">'+(v.chapter==='investigation'&&!finished?'TAP THE NUMBERED EVIDENCE':'THE LATE JURY')+'</span></div>'+compactCourtDialogue(h)+'</section>';
}
function witnessPicker(game,label='Witness') {
 const v=courtView(game);
 return '<label class="court-witness-picker">'+label+'<select id="courtWitness" aria-label="'+label+'">'+game.suspects.map((s,i)=>'<option value="'+i+'" '+(v.witness===i?'selected':'')+'>'+esc(s.name)+(isExposed(game,i)?' · account corrected':'')+'</option>').join('')+'</select></label>';
}
function investigationPanel(game) {
 const v=courtView(game),e=game.sceneEvidence[v.exhibit],collected=(game.inspected||[]).includes(v.exhibit);
 return '<div class="court-panel-heading"><span class="eyebrow">Evidence '+(v.exhibit+1)+' / '+game.sceneEvidence.length+'</span><h4 id="courtPanelTitle" tabindex="-1">'+esc(e.title)+'</h4></div>'+evidenceTray(game)+'<div class="court-evidence-detail"><div class="court-found-object" aria-hidden="true">'+curioSVG(evidenceShape(e,v.exhibit))+'</div><p>'+esc(e.description)+'</p>'+(collected?'<p class="court-proof"><b>What this proves</b>'+esc(e.clue||'Verifies individual testimony; it does not establish the culprit.')+'</p><details class="court-observation-list"><summary>Verified observations · '+(e.records||[]).length+' suspects</summary>'+(e.records||[]).map(r=>'<p><b>'+esc(r.name)+'</b>'+esc(r.text)+'</p>').join('')+'</details>':'<p class="court-next-step">Inspect the object to bag its evidence and read the verified observations.</p>')+'</div>';
}
function hearingPanel(game) {
 const v=courtView(game),w=game.witnesses[v.witness],statement=w.statements[v.statement],e=game.sceneEvidence[v.exhibit],collected=(game.inspected||[]).includes(v.exhibit),record=e.records?.find(r=>r.suspect===v.witness);
 return '<h4 class="sr-only" id="courtPanelTitle" tabindex="-1">Cross-examine a witness</h4>'+witnessPicker(game)+'<div class="court-testimony-tabs" role="group" aria-label="Witness statements">'+w.statements.map((s,i)=>'<button class="btn" data-life="court-statement" data-statement="'+i+'" aria-pressed="'+(v.statement===i)+'">Statement '+(i+1)+'</button>').join('')+'</div><blockquote class="court-active-statement"><span>'+esc(game.suspects[v.witness].name)+(isExposed(game,v.witness)?' · corrected account':' · on the stand')+'</span>'+esc(statement.text)+'</blockquote>'+'<div class="court-compare-heading"><span class="eyebrow">Match a specific contradiction</span><span>Selected evidence</span></div>'+evidenceTray(game)+'<div class="court-compare-evidence"><b>Exhibit '+(v.exhibit+1)+' · '+esc(e.title)+'</b>'+(collected?'<p>'+esc(record?.text||e.clue||'Verifies individual testimony; it does not establish the culprit.')+'</p>':'<p>This object has not been inspected. Return to Investigate to collect it.</p>')+'</div>'+(isExposed(game,v.witness)?'<p class="court-exposed-note"><b>Account corrected.</b> '+esc(w.motive)+' Being caught lying does not prove this crime. Check the crime evidence before accusing.</p>':'<p class="court-next-step">Press for detail, or present an exhibit that disagrees with this statement. A poor argument can be retried.</p>');
}
function verdictPanel(game) {
 const v=courtView(game),suspect=game.suspects[v.witness],all=game.caseBoard?.cluesReady;
 return '<div class="court-panel-heading"><span class="eyebrow">Build the accusation</span><h4 id="courtPanelTitle" tabindex="-1">Who fits every crime exhibit?</h4></div>'+witnessPicker(game,'Accuse')+'<p class="court-next-step">Everyone had something to hide. A lie alone is not a conviction.</p><div class="court-case-checks"><span class="'+(all?'done':'')+'">'+(all?'✓':'○')+' Inspect the physical evidence for every crime clue</span><span class="'+(isExposed(game,v.witness)?'done':'')+'">'+(isExposed(game,v.witness)?'✓':'○')+' Expose one contradiction in '+esc(suspect.name)+'’s account</span></div><div class="court-final-evidence">'+game.sceneEvidence.map((e,i)=>'<article><b>Exhibit '+(i+1)+'</b><p>'+((game.inspected||[]).includes(i)?esc(e.clue||'Verifies individual testimony; it does not establish the culprit.'):'Not yet collected.')+'</p><span><b>'+esc(suspect.name)+':</b> '+((game.inspected||[]).includes(i)?esc(e.records?.find(r=>r.suspect===v.witness)?.text||'No recorded observation.'):'Inspect the object to see the verified observation.')+'</span></article>').join('')+'</div><p class="court-next-step">A wrong verdict keeps the case open. Your resident loses no care or trust.</p>'+button('Explain the next crime clue','court-hint',game.hints.length>=game.rules.length?'disabled':'');
}
function courtActionBar(game) {
 const v=courtView(game),inspected=(game.inspected||[]).includes(v.exhibit),all=game.caseBoard?.cluesReady,canFile=all&&isExposed(game,v.witness)&&!(game.rejected||[]).includes(v.witness);
 let actions,status;
 if(v.chapter==='investigation'){
  status=(game.inspected||[]).length+' / '+game.sceneEvidence.length+' evidence objects collected';
  const next=inspected?game.sceneEvidence.findIndex((_,i)=>!(game.inspected||[]).includes(i)):v.exhibit;
  actions=(next>=0?button('Inspect '+(inspected?'next object':'Exhibit '+(next+1)),'court-inspect','data-exhibit="'+next+'"'):button('Read the charge','court-charge'))+button('Call a witness','court-chapter','data-chapter="hearing" '+((game.inspected||[]).length?'':'disabled'));
 }else if(v.chapter==='hearing'){
  status=isExposed(game,v.witness)?'Account corrected. Review the crime evidence in Verdict.':'Choose a statement and the evidence that contradicts it.';
  const pressed=(game.pressed||[]).includes(v.witness+':'+v.statement),attempted=(game.attempts||[]).includes(v.witness+':'+v.statement+':'+v.exhibit);
  actions=isExposed(game,v.witness)?button('Call another witness','court-next-witness')+button('Review accusation','court-chapter','data-chapter="verdict"'):button(pressed?'Detail on the record':'Press for detail','court-press',pressed?'disabled':'')+button(attempted?'Try another pairing':'Present Exhibit '+(v.exhibit+1),'court-present',inspected&&!attempted?'':'disabled');
 }else{
  status=canFile?'Your case is ready. Deliver the verdict when you are satisfied.':!all?'Collect the physical evidence for every crime clue first.':(game.rejected||[]).includes(v.witness)?'This suspect is cleared. Choose someone who fits every crime clue.':'Expose this suspect’s contradiction in Cross-examine first.';
  actions=button('Back to hearing','court-chapter','data-chapter="hearing"')+button('Deliver verdict','court-file',canFile?'':'disabled');
 }
 return '<footer class="court-action-bar"><p role="status">'+esc(status)+'</p><div>'+actions+'</div></footer>';
}
export function courtMarkup(game) {
 if(!game.sceneEvidence)return legacyCourtMarkup(game);
 const v=courtView(game);
 return '<div class="court-case court-playable"><header class="court-play-header"><div><span class="eyebrow">Court of Small & Final Matters · '+esc(game.difficulty)+'</span><h3 id="courtCaseTitle" tabindex="-1">'+esc(game.title)+'</h3></div><details class="court-case-settings"><summary aria-label="Case information and difficulty">Case file</summary><div><p>'+esc(game.intro)+'</p><p>'+esc(game.instructions)+'</p><p>Progress is saved. Starting another case replaces this investigation.</p><div class="court-levels">'+COURT_LEVELS.map((l,i)=>button('New '+esc(l.name)+' case','court-level','data-level="'+i+'"')).join('')+'</div></div></details></header><nav class="court-chapters" aria-label="Court chapters">'+Object.entries(chapterNames).map(([id,label],i)=>'<button class="btn" data-life="court-chapter" data-chapter="'+id+'" aria-pressed="'+(v.chapter===id)+'"><span>'+(i+1)+'</span>'+label+'</button>').join('')+'</nav><div class="court-workspace">'+playableStage(game)+'<section class="court-action-panel" aria-label="'+chapterNames[v.chapter]+'">'+(v.chapter==='investigation'?investigationPanel(game):v.chapter==='hearing'?hearingPanel(game):verdictPanel(game))+'</section></div>'+courtActionBar(game)+'</div>';
}
export function courtFinishedMarkup(game,result,wins) {
 if(!game.sceneEvidence)return courtResultMarkup(game,result,wins);
 const h=courtHearing(game);h.phase='conviction';h.speaker='Judge Mortis';h.line=game.trial.conviction;
 return '<div class="court-case court-playable court-finished"><header class="court-play-header"><div><span class="eyebrow">Judgment delivered</span><h3 id="courtVerdictTitle" tabindex="-1">'+esc(result.rank||game.rank||'Case closed')+'</h3></div></header><div class="court-workspace">'+playableStage(game,true)+'<section class="court-action-panel" aria-label="Verdict and sentence"><div class="court-result"><h4>The evidence has teeth.</h4><div class="court-verdict-metrics"><b>'+result.score+'<span>case points</span></b><b>'+result.stats.contradictions+' / '+game.suspects.length+'<span>accounts exposed</span></b><b>'+result.stats.mistakes+'<span>missed arguments</span></b></div><p>'+esc(result.text)+'</p><p>+'+(result.fuss||0)+' attention · +'+(result.bond||0)+' trust · '+wins+' cases solved</p></div><div class="court-transcript">'+(result.dialogue||[]).map(l=>'<p><b>'+esc(l.speaker)+'</b><span>'+esc(l.text)+'</span></p>').join('')+'</div><details class="court-review"><summary>Why the verdict stands</summary><div class="court-verdict-reasons">'+(result.reasons||[]).map(r=>'<article><b>'+esc(r.name)+'</b><p>'+esc(r.text)+' '+esc(r.explanation)+'</p></article>').join('')+'</div></details></section></div><footer class="court-action-bar"><p>Case closed. The witnesses are already revising their memoirs.</p><div>'+button('Another case','court-new')+button('Back to the shelf','close')+'</div></footer></div>';
}
