import { addNote, clamp, grantBonusTrust } from '../state.js';
import { playWait } from './play.js';
import { tick, isAsleep } from './tick.js';
import { lifeState, recordGameLife, recordScene } from './life.js';
const CASES=[
 {title:'The biscuit with a bite missing',intro:'Three witnesses had access to the biscuit. All three have prepared a deeply unconvincing face.',object:'The biscuit',a:['jam on their sleeve','flour on their sleeve'],b:['beside the lamp','beside the bowl'],clues:['The broken biscuit has a smear of jam. Flour was found only on the plate.','Warm wax fell on the missing piece. The bowl was nowhere near the lamp.'],end:'The missing bite has been returned in an unsuitable condition.'},
 {title:'The unauthorised funeral',intro:'Someone buried a perfectly serviceable crumb. Three residents attended. One brought a shovel.',object:'The crumb grave',a:['carrying a teaspoon','carrying a fork'],b:['wearing a black ribbon','wearing a red ribbon'],clues:['The grave has a smooth rounded bottom. A fork would have left three grooves.','A strand of black ribbon is caught under the headstone. The red ribbon is intact.'],end:'The crumb is exhumed. It has demanded a fresh obituary.'},
 {title:'The lamp that went missing',intro:'The light disappeared during a very short blackout. The darkness has declined to testify.',object:'The little lamp',a:['carrying a blue cloth','carrying a green cloth'],b:['at the doorway','at the window'],clues:['A blue thread is caught under the lamp. The green cloth has no loose threads.','Fresh wax leads to the doorway. The window sill is clean.'],end:'The lamp is found in a pocket. The pocket has been having a brilliant day.'},
 {title:'The counterfeit invitation',intro:'Someone invited the shelf to its own eviction. Attendance is inexplicably mandatory.',object:'The invitation',a:['using violet ink','using black ink'],b:['holding a round stamp','holding a square stamp'],clues:['The invitation uses violet ink. The black ink was still sealed.','The seal is circular. The square stamp leaves four corners and a grudge.'],end:'The invitation is revoked. The shelf remains home, pending a smaller appeal.'},
 {title:'The stolen last word',intro:'An argument ended too early. Somebody walked away carrying its conclusion.',object:'The last word',a:['holding an open jar','holding a sealed box'],b:['near the curtain','near the stair'],clues:['The missing word was heard rattling against glass. The box is made of wood.','Curtain fibres are caught in the container lid. The stair has no fabric.'],end:'The word is released. It turns out to be “actually.” Everybody regrets the rescue.'},
 {title:'The pea’s suspicious coronation',intro:'A pea is king. The residents would like to know who enabled this.',object:'The paper crown',a:['holding gold paper','holding silver paper'],b:['carrying scissors','carrying glue'],clues:['The crown is gold. The silver paper has not been touched.','Its points were cut cleanly. There are no glued seams.'],end:'The crown is confiscated. The pea returns to a constitutional side dish.'}
];
export function newCourt(state,rng=Math.random) {
 const l=lifeState(state),d=CASES[l.courtPlays%CASES.length];
 const cast=state.pets.slice(0,3).map(p=>({id:p.id,name:p.name}));
 for(const name of ['The Reflection','The Unclaimed Sock','A Passing Crumb'])if(cast.length<3)cast.push({id:'witness-'+cast.length,name});
 const roles=[{a:0,b:0},{a:0,b:1},{a:1,b:0}];
 for(let i=2;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor((Number(rng())||0)*(i+1))));[roles[i],roles[j]]=[roles[j],roles[i]];}
 return {kind:'court',petId:state.pets[0]?.id,title:d.title,intro:d.intro,object:d.object,clues:d.clues,end:d.end,
  suspects:cast.map((p,i)=>({...p,role:roles[i],details:[d.a[roles[i].a],d.b[roles[i].b]]})),answer:roles.findIndex(r=>r.a===0&&r.b===0),choice:null,claimed:false};
}
export function accuseCourt(state,game,choice,now=Date.now()) {
 if(!game||game.claimed||game.choice!==null||![0,1,2].includes(choice)||!state.pets.some(p=>p.id===game.petId))return null;
 game.choice=choice;game.claimed=true;
 const l=lifeState(state),correct=choice===game.answer,p=state.pets.find(p=>p.id===game.petId);
 l.courtPlays++;if(correct)l.courtWins++;
 if(!p)return {correct,bond:0,fuss:0};
 tick(state,now);let bond=0,fuss=0;
 if(correct&&!playWait(p,now,'court')&&!isAsleep(p,new Date(now))){bond=grantBonusTrust(p,1,now);fuss=Math.min(16,100-p.needs.fuss);p.needs.fuss=clamp(p.needs.fuss+fuss,0,100);p.playedAt||={};p.playedAt.court=now;p.lastPlayed=now;}
 if(correct)recordGameLife(state,p,'court',now);
 const culprit=game.suspects[game.answer];
 const text=culprit.name+' was '+culprit.details.join(' and ')+'. Both clues point to them. '+game.end;
 if(correct){recordScene(state,'court',game.title,text,state.pets.slice(0,2).map(p=>p.id),now);addNote(state,text,'Shelf Court','scheme');}
 return {correct,bond,fuss,text};
}
