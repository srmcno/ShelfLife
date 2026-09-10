import { addNote, clamp, grantBonusTrust } from '../state.js';
import { playWait } from './play.js';
import { tick, isAsleep } from './tick.js';
import { lifeState, recordGameLife, recordScene } from './life.js';
import { COURT_CASES, COURT_LEVELS, COURT_DEFENCES, COURT_TRANSCRIPTS } from '../content/court.js';

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
 if(rule.type==='xor')return 'Exactly one of these was true of the culprit: “'+a+'” or “'+b+'”. Not both.';
 return 'If the culprit '+a+', they also '+b+'.';
}
function ruleHelp(axes,rule) {
 const a=atomText(axes,rule.first),b=rule.second?atomText(axes,rule.second):'';
 if(rule.type==='is')return 'Keep anybody whose record says “'+a+'”. A match to this exhibit alone is not proof.';
 if(rule.type==='not')return 'Rule out anybody whose record says “'+a+'”. Everyone with a different observation still fits this exhibit.';
 if(rule.type==='xor')return 'Check “'+a+'” and “'+b+'” separately. One match fits; zero matches or two matches do not.';
 return 'This rule excludes only somebody who '+a+' but did not fit “'+b+'”. If the first part is false, this exhibit does not rule them out.';
}
function contradiction(axes,facts,rule) {
 const a=atomText(axes,rule.first),actual=axes[rule.first.axis].values[facts[rule.first.axis]];
 if(rule.type==='is')return 'Their record says “'+actual+'”; this exhibit requires “'+a+'”.';
 if(rule.type==='not')return 'Their record includes “'+a+'”, which this exhibit explicitly rules out.';
 const b=atomText(axes,rule.second);
 if(rule.type==='xor')return 'Their record matches '+(matches(facts,rule.first)?'both':'neither')+' of “'+a+'” and “'+b+'”. This exhibit allows exactly one.';
 return 'They '+a+', but their record says “'+axes[rule.second.axis].values[facts[rule.second.axis]]+'” instead of “'+b+'”. That breaks the if/then rule.';
}
function makeRules(level,rng) {
 const axes=shuffle([0,1,2],rng),values=axes.map(()=>shuffle([0,1,2],rng));
 const atom=(axis,value)=>({axis:axes[axis],value:values[axis][value]});
 if(level===0)return [{type:'is',first:atom(0,0)},{type:'is',first:atom(1,0)}];
 if(level===1)return shuffle([{type:'not',first:atom(0,0)},{type:'is',first:atom(1,0)},{type:'not',first:atom(2,0)}],rng);
 return shuffle([{type:'xor',first:atom(0,0),second:atom(1,0)},{type:'if',first:atom(2,0),second:atom(0,0)},{type:'not',first:atom(1,1)}],rng);
}
const ALL_FACTS=Array.from({length:27},(_,i)=>[Math.floor(i/9),Math.floor(i/3)%3,i%3]);
export function newCourt(state,rng=Math.random,options={}) {
 const l=lifeState(state),caseIndex=l.courtPlays%COURT_CASES.length,d=COURT_CASES[caseIndex],trial=COURT_TRANSCRIPTS[caseIndex];
 // Challenge is a player choice, never a punishment for doing well.
 const level=Number.isInteger(options.level)?clamp(options.level,0,2):0;
 const rules=makeRules(level,rng),valid=ALL_FACTS.filter(f=>rules.every(r=>courtRuleFits(f,r)));
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
 const defences=shuffle(COURT_DEFENCES,rng);
 return {kind:'court',petId:state.pets[0]?.id,level,difficulty:COURT_LEVELS[level].name,instructions:COURT_LEVELS[level].instructions,
  title:d.title,intro:d.intro,object:d.object,axes:d.axes,rules,trial,
  evidenceTitles:rules.map(r=>r.second?trial.reconstruction:trial.exhibits[r.first.axis]),
  clues:rules.map(r=>ruleText(d.axes,r)),end:trial.sentence,
  suspects:cast.map((p,i)=>({...p,facts:shuffled[i],details:d.axes.map((axis,j)=>axis.values[shuffled[i][j]]),defence:defences[i]})),
  answer:shuffled.indexOf(answerFacts),selection:null,hints:[],choice:null,claimed:false};
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
 if(correct){recordScene(state,'court',game.title,text,state.pets.slice(0,2).map(p=>p.id),now);addNote(state,text,'Shelf Court','scheme');}
 const dialogue=[{speaker:'Judge',text:correct?game.trial.conviction:game.trial.acquittal},
  {speaker:'Prosecutor',text:culprit.name+' is the only suspect who survives all '+game.clues.length+' exhibits.'},
  {speaker:culprit.name,text:game.trial.plea},{speaker:'Judge',text:game.trial.sentence}];
 return {correct,bond,fuss:Math.round(fuss),text,reasons,dialogue,level:game.level};
}
