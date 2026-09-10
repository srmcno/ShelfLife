import { COURT_BANTER } from '../content/court-banter.js';
import { addNote, clamp, grantBonusTrust } from '../state.js';
import { playWait } from './play.js';
import { tick, isAsleep } from './tick.js';
import { lifeState, recordGameLife, recordScene } from './life.js';
import { COURT_CASES, COURT_LEVELS, COURT_DEFENCES, COURT_TRANSCRIPTS, COURT_INVESTIGATIONS } from '../content/court.js';

const draw = (rng, length) => Math.min(length - 1, Math.max(0, Math.floor((Number(rng()) || 0) * length)));
function shuffle(values, rng) {
 const copy=values.slice();
 for(let i=copy.length-1;i>0;i--){const j=draw(rng,i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy;
}
const matches = (facts, atom) => facts[atom.axis] === atom.value;
// The same evaluator drives generation, hints, verdict explanations and tests.
// Rules are data so a resumed or inspected puzzle has no hidden logic closure.
export function courtRuleFits(facts, rule) {
 const first=matches(facts,rule.first),second=rule.second?matches(facts,rule.second):false;
 if(rule.type==='is')return first;
 if(rule.type==='not')return !first;
 if(rule.type==='or')return first||second;
 if(rule.type==='same')return first===second;
 if(rule.type==='xor')return first!==second;
 if(rule.type==='if')return !first||second;
 return false;
}
export function courtEvidence(game, suspect) {
 const s=Number.isInteger(suspect)?game?.suspects[suspect]:suspect;
 if(!s||!Array.isArray(game?.rules))return [];
 return game.rules.map(rule=>courtRuleFits(s.facts,rule));
}
const atomText = (axes,atom) => axes[atom.axis].values[atom.value];
function ruleText(axes,rule) {
 const a=atomText(axes,rule.first),b=rule.second?atomText(axes,rule.second):'';
 if(rule.type==='is')return 'The culprit '+a+'.';
 if(rule.type==='not')return 'The culprit did not fit this observation: “'+a+'”.';
 if(rule.type==='or')return 'At least one of these was true of the culprit: “'+a+'” or “'+b+'”. Both is allowed.';
 if(rule.type==='same')return 'For the culprit, these observations were either both true or both false: “'+a+'” and “'+b+'”.';
 if(rule.type==='xor')return 'Exactly one of these was true of the culprit: “'+a+'” or “'+b+'”. Not both.';
 return 'If the culprit '+a+', they also '+b+'.';
}
function ruleHelp(axes,rule) {
 const a=atomText(axes,rule.first),b=rule.second?atomText(axes,rule.second):'';
 if(rule.type==='is')return 'Keep anybody whose record says “'+a+'”. A match to this exhibit alone is not proof.';
 if(rule.type==='not')return 'Rule out anybody whose record says “'+a+'”. Everyone with a different observation still fits this exhibit.';
 if(rule.type==='or')return 'One or two matches fit. This exhibit excludes only somebody matching neither observation.';
 if(rule.type==='same')return 'Two matches fit, and zero matches fit. Exactly one match contradicts this exhibit.';
 if(rule.type==='xor')return 'Check “'+a+'” and “'+b+'” separately. One match fits; zero matches or two matches do not.';
 return 'This rule excludes only somebody who '+a+' but did not fit “'+b+'”. If the first part is false, this exhibit does not rule them out.';
}
function contradiction(axes,facts,rule) {
 const a=atomText(axes,rule.first),actual=axes[rule.first.axis].values[facts[rule.first.axis]];
 if(rule.type==='is')return 'Their record says “'+actual+'”; this exhibit requires “'+a+'”.';
 if(rule.type==='not')return 'Their record includes “'+a+'”, which this exhibit explicitly rules out.';
 const b=atomText(axes,rule.second);
 if(rule.type==='or')return 'Their record matches neither “'+a+'” nor “'+b+'”. At least one is required.';
 if(rule.type==='same')return 'Their record matches only one of “'+a+'” and “'+b+'”. This exhibit requires both to be true or both to be false.';
 if(rule.type==='xor')return 'Their record matches '+(matches(facts,rule.first)?'both':'neither')+' of “'+a+'” and “'+b+'”. This exhibit allows exactly one.';
 return 'They '+a+', but their record says “'+axes[rule.second.axis].values[facts[rule.second.axis]]+'” instead of “'+b+'”. That breaks the if/then rule.';
}
function makeRules(level,rng,reworked=false) {
 const axes=shuffle([0,1,2],rng),values=axes.map(()=>shuffle([0,1,2],rng));
 const atom=(axis,value)=>({axis:axes[axis],value:values[axis][value]});
 if(level===0)return [{type:'is',first:atom(0,0)},{type:'is',first:atom(1,0)}];
 if(reworked&&level>0){
  const variant=draw(rng,3);
  if(level===1&&variant===0)return shuffle([{type:'or',first:atom(0,0),second:atom(1,0)},{type:'not',first:atom(0,1)},{type:'is',first:atom(2,0)}],rng);
  if(level===2&&variant===1)return shuffle([{type:'same',first:atom(0,0),second:atom(1,0)},{type:'not',first:atom(0,1)},{type:'is',first:atom(2,0)}],rng);
  if(level===2&&variant===2)return shuffle([{type:'or',first:atom(0,0),second:atom(1,0)},{type:'if',first:atom(0,0),second:atom(2,0)},{type:'not',first:atom(2,1)}],rng);
 }
 if(level===1)return shuffle([{type:'not',first:atom(0,0)},{type:'is',first:atom(1,0)},{type:'not',first:atom(2,0)}],rng);
 return shuffle([{type:'xor',first:atom(0,0),second:atom(1,0)},{type:'if',first:atom(2,0),second:atom(0,0)},{type:'not',first:atom(1,1)}],rng);
}
const ALL_FACTS=Array.from({length:27},(_,i)=>[Math.floor(i/9),Math.floor(i/3)%3,i%3]);
export function newCourt(state,rng=Math.random,options={}) {
 const l=lifeState(state),caseIndex=Number.isInteger(options.caseIndex)?clamp(options.caseIndex,0,COURT_CASES.length-1):l.courtPlays%COURT_CASES.length,d=COURT_CASES[caseIndex],trial=COURT_TRANSCRIPTS[caseIndex];
 // Challenge is a player choice, never a punishment for doing well.
 const level=Number.isInteger(options.level)?clamp(options.level,0,2):0;
 const rules=makeRules(level,rng,options.reworked),valid=ALL_FACTS.filter(f=>rules.every(r=>courtRuleFits(f,r)));
 const answerFacts=valid[draw(rng,valid.length)].slice();
 // One innocent fails each distinct exhibit while fitting every other one.
 // Consequently the whole dossier is necessary, yet exactly one answer fits.
 const roles=[answerFacts,...rules.map((_,i)=>{
  const pool=ALL_FACTS.filter(f=>rules.every((r,j)=>courtRuleFits(f,r)===(i!==j)));
  return pool[draw(rng,pool.length)].slice();
 })];
 const shuffled=shuffle(roles,rng),count=shuffled.length;
 const cast=shuffle(state.pets,rng).slice(0,count).map(p=>({id:p.id,name:p.name}));
 const standins=shuffle(['The Reflection','The Unclaimed Sock','A Passing Crumb','The Spare Button'],rng);
 while(cast.length<count)cast.push({id:'witness-'+cast.length,name:standins[cast.length-state.pets.length]||standins[cast.length%standins.length]});
 const defences=shuffle(options.reworked?COURT_BANTER[caseIndex].lines:COURT_DEFENCES,rng);
 return {kind:'court',caseIndex,petId:state.pets[0]?.id,level,difficulty:COURT_LEVELS[level].name,instructions:COURT_LEVELS[level].instructions,
  title:d.title,intro:d.intro,object:d.object,axes:d.axes,rules,trial,
  evidenceTitles:rules.map(r=>r.second?trial.reconstruction:trial.exhibits[r.first.axis]),
  clues:rules.map(r=>ruleText(d.axes,r)),end:trial.sentence,
  suspects:cast.map((p,i)=>({...p,facts:shuffled[i],details:d.axes.map((axis,j)=>axis.values[shuffled[i][j]]),defence:defences[i]})),
  answer:shuffled.indexOf(answerFacts),selection:null,hints:[],choice:null,claimed:false};
}

const seeded = initial => { let seed=initial>>>0;return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}; };
const validIndex = (value,length) => Number.isInteger(value)&&value>=0&&value<length;
const respond = (game,kind,speaker,text) => {
 const response={ok:true,kind,speaker,text};
 game.lastResponse=response;game.hearing={phase:kind,speaker,line:text,exhibit:game.ui.exhibit??0,cleared:game.rejected.slice()};
 return response;
};
function investigativeCourt(saved) {
 const rng=seeded(saved.seed),game=newCourt({pets:saved.cast,life:{courtPlays:saved.caseIndex}},rng,{level:saved.level,caseIndex:saved.caseIndex,reworked:saved.version===3});
 const story=COURT_INVESTIGATIONS[game.caseIndex],motives=shuffle(story.motives,rng);
 Object.assign(game,{version:saved.version,petId:saved.petId,scene:story.scene,phase:'investigation',inspected:[],questioned:[],pressed:[],exposures:[],attempts:[],comparisons:[],eliminations:[],rejected:[],mistakes:0,appeals:0,canFile:false,ui:{chapter:'investigation',witness:null,statement:null,exhibit:null}});
 // Each account contains exactly one falsifiable claim. It is not safe to
 // convict from testimony alone; the physical record can contradict it.
 game.witnesses=game.suspects.map((suspect,i)=>{
  const axis=draw(rng,3),claimed=suspect.facts.slice();claimed[axis]=(claimed[axis]+1+draw(rng,2))%3;
  const statements=game.axes.map((fact,j)=>({id:j,axis:j,text:'“I '+fact.values[claimed[j]]+'.”',originalText:'“I '+fact.values[claimed[j]]+'.”',pressed:false}));
  return {suspect:i,questioned:false,exposed:false,motive:null,opening:motives[i].match(/^.*?[.!?](?=\s|$)/)?.[0]||game.trial.objection,concealment:motives[i],falseStatement:axis,claimed,statements,account:game.axes.map((fact,j)=>fact.values[claimed[j]])};
 });
 game.sceneEvidence=game.axes.map((axis,i)=>{
  const clues=game.rules.flatMap((rule,index)=>rule.first.axis===i?[{index,text:game.clues[index]}]:[]);
  return {id:i,axis:i,title:game.trial.exhibits[i],description:story.pressure[i],clues,clue:clues.map(c=>c.text).join(' '),
   records:game.suspects.map((suspect,index)=>({suspect:index,name:suspect.name,text:suspect.details[i],axis:i}))};
 });
 respond(game,'opening','Judge Mortis',game.trial.opening);
 return game;
}
function syncCourt(game) {
 const needed=[...new Set(game.rules.flatMap(r=>[r.first,...(game.version===3&&r.second?[r.second]:[])].map(a=>a.axis)))];
 const allClues=needed.every(axis=>game.inspected.includes(axis));
 // Guilt follows from the crime evidence. Unrelated dishonest testimony is
 // optional character business, never a second prerequisite for a conviction.
 game.canFile=allClues&&validIndex(game.selection,game.suspects.length)&&!game.rejected.includes(game.selection)&&!game.eliminations.includes(game.selection)&&!game.claimed;
 game.phase=game.claimed?'verdict':allClues&&game.exposures.length?'verdict':game.inspected.length||game.questioned.length?'hearing':'investigation';
 game.caseBoard={examined:game.inspected.length,totalEvidence:game.sceneEvidence.length,cluesReady:allClues,exposed:game.exposures.length,
  missing:needed.filter(axis=>!game.inspected.includes(axis)),rejected:game.rejected.slice()};
 game.stats={contradictions:game.exposures.length,eliminations:game.eliminations.length,mistakes:game.mistakes,appeals:game.appeals};
 game.rank=game.appeals?'Case salvaged':game.mistakes?'Relentless counsel':game.version===3?(game.eliminations.length===game.suspects.length-1?'Every innocent accounted for':'A sound deduction'):game.exposures.length===game.suspects.length?'The full autopsy':'Evidence with teeth';
 return game;
}
function applyCourtMove(game,move) {
 if(game.claimed||!move||typeof move!=='object')return null;
 const {type,suspect,statement,evidence}=move,witness=game.witnesses[suspect];
 if(type==='compare'){
  const rule=game.rules[evidence],key=suspect+':'+evidence;
  if(!validIndex(suspect,game.suspects.length)||!rule||![rule.first,...(game.version===3&&rule.second?[rule.second]:[])].every(a=>game.inspected.includes(a.axis))||game.comparisons.includes(key))return null;
  game.comparisons.push(key);
  const fits=courtRuleFits(game.suspects[suspect].facts,rule),name=game.suspects[suspect].name;
  if(!fits){
   if(!game.eliminations.includes(suspect))game.eliminations.push(suspect);
   return respond(game,'sustained','Judge Mortis',name+' is cleared. '+contradiction(game.axes,game.suspects[suspect].facts,rule)+' '+(game.version===3?COURT_BANTER[game.caseIndex].cleared:'The jury has removed them from its dinner plans.'));
  }
  if(game.version===3)game.mistakes++;
  return respond(game,'overruled','Judge Mortis',name+' fits this clue, so it cannot clear them. Check another clue. Matching one fact does not prove guilt; the culprit must match all '+game.rules.length+'.');
 }
 if(type==='inspect'){
  if(!validIndex(evidence,game.sceneEvidence.length)||game.inspected.includes(evidence))return null;
  game.inspected.push(evidence);const item=game.sceneEvidence[evidence];
  return respond(game,'inspect','Court examiner',item.description+' '+(item.clue||'This record verifies individual testimony. It does not establish guilt by itself.'));
 }
 if(type==='question'){
  if(!validIndex(suspect,game.suspects.length)||game.questioned.includes(suspect))return null;
  game.questioned.push(suspect);witness.questioned=true;
  return respond(game,'testimony',game.suspects[suspect].name,witness.opening);
 }
 if(type==='press'){
  const key=suspect+':'+statement;
  if(!validIndex(suspect,game.suspects.length)||!validIndex(statement,3)||!game.questioned.includes(suspect)||game.pressed.includes(key)||witness.exposed)return null;
  game.pressed.push(key);witness.statements[statement].pressed=true;
  return respond(game,'press','Court examiner','The witness repeats: '+witness.statements[statement].text+' '+COURT_INVESTIGATIONS[game.caseIndex].pressure[statement]+' Compare that exact claim with the named observation in the record.');
 }
 if(type==='present'){
  const key=suspect+':'+statement+':'+evidence;
  if(!validIndex(suspect,game.suspects.length)||!validIndex(statement,3)||!validIndex(evidence,3)||!game.questioned.includes(suspect)||!game.inspected.includes(evidence)||witness.exposed||game.attempts.includes(key))return null;
  game.attempts.push(key);
  if(evidence===statement&&statement===witness.falseStatement){
   game.exposures.push(suspect);witness.exposed=true;witness.motive=witness.concealment;witness.account=game.suspects[suspect].details.slice();witness.statements[statement].text='“I '+game.suspects[suspect].details[statement]+'. That is my corrected statement.”';
   return respond(game,'sustained',game.suspects[suspect].name,'All right. I '+game.suspects[suspect].details[statement]+'. '+witness.motive);
  }
  game.mistakes++;
  return respond(game,'overruled','Judge Mortis',evidence!==statement?'That exhibit records '+game.axes[evidence].name.toLowerCase()+'. The claim concerns '+game.axes[statement].name.toLowerCase()+'. A threatening gesture is not a chain of evidence.':'The physical record agrees with this statement. The witness has lied elsewhere. Please reserve the gavel for an actual contradiction.');
 }
 if(type==='hint'){
  const hint=courtHint(game);return hint?respond(game,'guidance','Court clerk',hint):null;
 }
 if(type==='appeal'){
  if(!validIndex(suspect,game.suspects.length)||suspect===game.answer||game.rejected.includes(suspect)||!game.caseBoard.cluesReady)return null;
  game.rejected.push(suspect);game.appeals++;
  const failed=courtEvidence(game,suspect).findIndex(fit=>!fit);
  return respond(game,'acquittal','Judge Mortis',game.suspects[suspect].name+' is cleared by clue '+(failed+1)+'. '+contradiction(game.axes,game.suspects[suspect].facts,game.rules[failed])+' The case remains open. Find who fits every crime clue.');
 }
 if(type==='file'){
  if(suspect!==game.answer||!game.caseBoard.cluesReady)return null;
  game.choice=suspect;game.claimed=true;
  return respond(game,'conviction','Judge Mortis',game.trial.conviction);
 }
 return null;
}
function setCourtFocus(game,focus) {
 if(focus.chapter!==undefined&&['investigation','hearing','verdict'].includes(focus.chapter))game.ui.chapter=focus.chapter;
 for(const [key,input,max] of [['witness','suspect',game.suspects.length],['statement','statement',3],['exhibit','evidence',3]])if(focus[input]===null||validIndex(focus[input],max))game.ui[key]=focus[input];
 game.selection=game.ui.witness;return syncCourt(game);
}
function replayCourt(saved) {
 const game=investigativeCourt(saved),legal=[];
 syncCourt(game);
 for(const move of saved.moves){if(!applyCourtMove(game,move))break;legal.push(move);syncCourt(game);}
 // A corrupt or stale suffix is discarded. A forged 'claimed' flag can never
 // finish an unsolved case or pay a reward.
 saved.moves=legal;saved.claimed=game.claimed;
 setCourtFocus(game,{chapter:saved.ui?.chapter,suspect:saved.ui?.witness,statement:saved.ui?.statement,evidence:saved.ui?.exhibit});
 // A ruling belongs to its witness. Restoring a different selection must not
 // put the previous witness's CLEARED stamp over the current person in the dock.
 const last=legal.at(-1);
 if(!game.claimed&&validIndex(game.selection,game.suspects.length)&&last?.suspect!==undefined&&last.suspect!==game.selection){
  const suspect=game.suspects[game.selection];respond(game,'testimony',suspect.name,suspect.defence);
 }
 if(game.claimed)game.result=investigationResult(game,saved.reward||{bond:0,fuss:0});
 return game;
}
export function startCourt(state,options={},rng=Math.random) {
 const l=lifeState(state);if(!state.pets.length)return null;
 const level=Number.isInteger(options.level)?clamp(options.level,0,2):0;
 const caseIndex=Number.isInteger(options.caseIndex)?clamp(options.caseIndex,0,COURT_CASES.length-1):l.courtPlays%COURT_CASES.length;
 const host=state.pets.find(p=>p.id===options.petId)||state.pets[0],cast=[host,...state.pets.filter(p=>p!==host)].slice(0,4).map(p=>({id:p.id,name:p.name}));
 l.court={version:options.reworked?3:2,seed:1+draw(rng,4294967295),level,caseIndex,cast,petId:host.id,moves:[],claimed:false,ui:{chapter:'investigation',witness:null,statement:null,exhibit:null}};
 return currentCourt(state);
}
export function currentCourt(state) {
 const l=lifeState(state),saved=l.court;if(!saved)return null;
 if(!state.pets.some(p=>p.id===saved.petId)){l.court=null;return null;}
 return replayCourt(saved);
}
export function courtAction(state,action) {
 const game=currentCourt(state),saved=lifeState(state).court;if(!game||game.claimed||!action||typeof action!=='object')return null;
 if(action.type==='focus'){
  setCourtFocus(game,action);saved.ui={...game.ui};return {ok:true,kind:'focus',speaker:game.hearing.speaker,text:game.hearing.line};
 }
 // Selecting an already-questioned witness changes focus without duplicating
 // progress. Every other meaningful action is unique, keeping the log bounded.
 if(action.type==='question'&&validIndex(action.suspect,game.suspects.length)){
  setCourtFocus(game,{suspect:action.suspect,statement:0,chapter:'hearing'});saved.ui={...game.ui};
  if(game.questioned.includes(action.suspect))return {ok:true,kind:'testimony',speaker:game.suspects[action.suspect].name,text:game.witnesses[action.suspect].motive||'My account is on the record. The clerk has underlined the parts they particularly dislike.'};
 }
 if(action.type==='present'&&validIndex(action.suspect,game.suspects.length)&&validIndex(action.statement,3)&&validIndex(action.evidence,3)&&game.attempts.includes(action.suspect+':'+action.statement+':'+action.evidence)&&!game.exposures.includes(action.suspect)){
  // Re-reading an unsuccessful argument is feedback, not another mistake.
  return respond(game,'overruled','Judge Mortis',action.evidence!==action.statement?'That exhibit records '+game.axes[action.evidence].name.toLowerCase()+'. The claim concerns '+game.axes[action.statement].name.toLowerCase()+'. A threatening gesture is not a chain of evidence.':'The physical record agrees with this statement. The witness has lied elsewhere. Please reserve the gavel for an actual contradiction.');
 }
 if(action.type==='press'&&validIndex(action.suspect,game.suspects.length)&&validIndex(action.statement,3)&&game.pressed.includes(action.suspect+':'+action.statement)&&!game.exposures.includes(action.suspect))return respond(game,'press','Court examiner','The witness repeats: '+game.witnesses[action.suspect].statements[action.statement].text+' '+COURT_INVESTIGATIONS[game.caseIndex].pressure[action.statement]+' Compare that exact claim with the named observation in the record.');
 if(!['inspect','question','press','present','compare','hint'].includes(action.type)||saved.moves.length>=95)return null;
 const response=applyCourtMove(game,action);if(!response)return null;
 const move={type:action.type};for(const key of ['suspect','statement','evidence'])if(action[key]!==undefined)move[key]=action[key];
 saved.moves.push(move);return response;
}
function investigationResult(game,reward) {
 const reasons=game.suspects.map((suspect,i)=>{
  const failed=courtEvidence(game,i).flatMap((fit,j)=>fit?[]:[j+1]);
  return {name:suspect.name,culprit:i===game.answer,failed,text:i===game.answer?'Fits every crime clue.':'Ruled out by clue '+failed.join(' and ')+'.',explanation:failed.map(n=>contradiction(game.axes,suspect.facts,game.rules[n-1])).join(' ')};
 });
 const culprit=game.suspects[game.answer],text=culprit.name+' is the only suspect who fits all '+game.clues.length+' crime clues. '+game.trial.sentence;
 return {correct:true,retry:false,bond:reward.bond,fuss:reward.fuss,text,reasons,dialogue:[{speaker:'Judge Mortis',text:game.trial.conviction},{speaker:culprit.name,text:game.trial.plea},{speaker:'Judge Mortis',text:game.trial.sentence}],level:game.level,rank:game.rank,stats:{...game.stats},score:Math.max(1,100+game.level*25+(game.exposures.length+game.eliminations.length)*10-game.mistakes*5-game.appeals*15)};
}
export function finishCourt(state,suspect,now=Date.now()) {
 const game=currentCourt(state),l=lifeState(state),saved=l.court;
 if(!game||game.claimed||!validIndex(suspect,game.suspects.length)||saved.moves.length>=96)return null;
 setCourtFocus(game,{suspect,chapter:'verdict'});if(!game.canFile)return null;saved.ui={...game.ui};
 if(suspect!==game.answer){
  const response=applyCourtMove(game,{type:'appeal',suspect});if(!response)return null;saved.moves.push({type:'appeal',suspect});
  const failed=courtEvidence(game,suspect).flatMap((fit,i)=>fit?[]:[i+1]);
  return {correct:false,retry:true,bond:0,fuss:0,text:response.text,reasons:[{name:game.suspects[suspect].name,culprit:false,failed,text:'Cleared by clue '+failed.join(' and ')+'.',explanation:response.text}],dialogue:[{speaker:response.speaker,text:response.text}]};
 }
 // Use the established reward boundary once, after a legal completed hearing.
 // Reconstruction only restores display state and never calls this function.
 const result=accuseCourt(state,game,suspect,now);if(!result)return null;
 saved.moves.push({type:'file',suspect});saved.claimed=true;saved.reward={bond:result.bond,fuss:result.fuss};
 const finished=currentCourt(state);l.courtBest=Math.max(l.courtBest,finished.result.score);return finished.result;
}
// An assistance button explains one rule at a time, without identifying the
// answer or lowering rewards. Players can use it as their on-demand tutorial.
export function courtHint(game) {
 if(!game||game.claimed||game.hints.length>=game.rules.length)return null;
 const index=game.hints.length,text='Exhibit '+(index+1)+': '+ruleHelp(game.axes,game.rules[index]);
 game.hints.push(text);return text;
}
export function accuseCourt(state,game,choice,now=Date.now()) {
 if(!game||game.claimed||game.choice!==null||!Number.isInteger(choice)||choice<0||choice>=game.suspects.length||!state.pets.some(p=>p.id===game.petId))return null;
 game.choice=choice;game.claimed=true;
 const l=lifeState(state),correct=choice===game.answer,p=state.pets.find(p=>p.id===game.petId);
 l.courtPlays++;if(correct)l.courtWins++;
 tick(state,now);let bond=0,fuss=0;
 if(correct&&!playWait(p,now,'court')&&!isAsleep(p,new Date(now))){bond=grantBonusTrust(p,1,now);fuss=Math.min(16,100-p.needs.fuss);p.needs.fuss=clamp(p.needs.fuss+fuss,0,100);p.playedAt||={};p.playedAt.court=now;p.lastPlayed=now;}
 if(correct)recordGameLife(state,p,'court',now);
 const culprit=game.suspects[game.answer];
 const reasons=game.suspects.map((suspect,i)=>{
  const fits=courtEvidence(game,i),failed=fits.flatMap((fit,j)=>fit?[]:[j+1]);
  return {name:suspect.name,culprit:i===game.answer,failed,text:i===game.answer?'Fits every exhibit.': 'Ruled out by Exhibit '+failed.join(' and ')+'.',
   explanation:failed.map(exhibit=>contradiction(game.axes,suspect.facts,game.rules[exhibit-1])).join(' ')};
 });
 const text=culprit.name+' is the only suspect who fits all '+game.clues.length+' exhibits. '+game.end;
 if(correct){recordScene(state,'court',game.title,text,state.pets.slice(0,2).map(p=>p.id),now,{key:'court',branch:'guilty',object:'gavel'});addNote(state,text,'Shelf Court','scheme');}
 const dialogue=[{speaker:'Judge',text:correct?game.trial.conviction:game.trial.acquittal},
  {speaker:'Prosecutor',text:culprit.name+' is the only suspect who survives all '+game.clues.length+' exhibits.'},
  {speaker:culprit.name,text:game.trial.plea},{speaker:'Judge',text:game.trial.sentence}];
 return {correct,bond,fuss:Math.round(fuss),text,reasons,dialogue,level:game.level};
}
