import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { blankState } = await import(root + '/src/state.js');
const { advanceStories, storyState } = await import(root + '/src/engine/stories.js');
const { generateCreature } = await import(root + '/src/art/creatures.js');
const s = blankState();
s.pets = Array.from({length:18}, (_,i)=>({id:'p'+i,name:'Resident '+i,traits:[],bond:5,needs:{food:70,fuss:70,clean:80},stats:{mystique:3},art:{creature:generateCreature({seed:i})}}));
s.slots=s.pets.map(p=>p.id);
const stories=storyState(s);
stories.archive=Array.from({length:100}, (_,i)=>({title:'Memory',text:'A letter from the shelf '+i,at:Date.now()}));
stories.residents=Array.from({length:36}, (_,i)=>({name:'Former '+i,names:Array.from({length:30},(_,j)=>({name:'Name '+j}))}));
stories.postcards=Array.from({length:6}, ()=>({image:'data:image/jpeg;base64,'+'a'.repeat(120000)}));
advanceStories(s,1800000000000,()=>.3);
for(let i=0;i<20;i++) advanceStories(s,1800000000000+i,()=>.3);
const trials=[];
for(let j=0;j<5;j++){const start=performance.now();for(let i=0;i<200;i++)advanceStories(s,1800000000100+i,()=>.3);trials.push((performance.now()-start)/200);}
console.log(JSON.stringify({scenario:'18 residents, 100 memories, 36 former residents, 6 postcards',millisecondsPerStoryUpdate:trials,median:trials.sort((a,b)=>a-b)[2]}));
