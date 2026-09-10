import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { startCourt, currentCourt, courtAction, courtEvidence, courtRuleFits, finishCourt } from '../src/engine/court.js';
import { courtMarkup } from '../src/ui/court.js';
function fixture(){const s=blankState();s.pets=[{id:'p',name:'Pip',traits:[],art:{},needs:{food:60,fuss:60,clean:60},bond:0}];s.slots[0]='p';return s;}
test('inclusive or, exclusive or, and linked truth values have distinct truth tables',()=>{
  for(const a of [0,1])for(const b of [0,1]){
    const rule={first:{axis:0,value:1},second:{axis:1,value:1}};
    assert.equal(courtRuleFits([a,b,0],{...rule,type:'or'}),!!(a||b));
    assert.equal(courtRuleFits([a,b,0],{...rule,type:'xor'}),a!==b);
    assert.equal(courtRuleFits([a,b,0],{...rule,type:'same'}),a===b);
  }
});
test('new cases retain one culprit and make every exhibit necessary across all levels and themes',()=>{
  const types=new Set();
  for(let theme=0;theme<12;theme++)for(let level=0;level<3;level++)for(let seed=1;seed<=35;seed++){
    const s=fixture(),g=startCourt(s,{reworked:true,caseIndex:theme,level},()=>seed/37);
    const fits=g.suspects.map((_,i)=>courtEvidence(g,i));g.rules.forEach(r=>types.add(r.type));
    assert.equal(g.version,3);assert.equal(fits.filter(row=>row.every(Boolean)).length,1);assert.ok(fits[g.answer].every(Boolean));
    for(let omit=0;omit<g.rules.length;omit++)assert.ok(fits.filter(row=>row.every((fit,i)=>i===omit||fit)).length>1);
    assert.ok(g.suspects.every(s=>typeof s.defence==='string'));
  }
  assert.ok(types.has('or'));assert.ok(types.has('same'));assert.ok(types.has('if'));assert.ok(types.has('xor'));
});
test('new cases require both sources of a compound clue, penalize only new unsupported arguments, and replay identically',()=>{
  let s=fixture(),g;
  for(let seed=1;seed<30;seed++){g=startCourt(s,{reworked:true,level:2},()=>seed/31);if(g.rules.some(r=>r.second))break;}
  const clue=g.rules.findIndex(r=>r.second),r=g.rules[clue];
  courtAction(s,{type:'inspect',evidence:r.first.axis});
  assert.equal(courtAction(s,{type:'compare',suspect:g.answer,evidence:clue}),null);
  for(let evidence=0;evidence<3;evidence++)courtAction(s,{type:'inspect',evidence});
  courtAction(s,{type:'compare',suspect:g.answer,evidence:clue});assert.equal(currentCourt(s).mistakes,1);
  assert.equal(courtAction(s,{type:'compare',suspect:g.answer,evidence:clue}),null);assert.equal(currentCourt(s).mistakes,1);
  courtAction(s,{type:'hint'});assert.equal(currentCourt(s).mistakes,1);
  for(let suspect=0;suspect<g.suspects.length;suspect++)if(suspect!==g.answer)assert.ok(courtAction(s,{type:'compare',suspect,evidence:courtEvidence(g,suspect).findIndex(f=>!f)}));
  const before=currentCourt(s);s=normalizeState(JSON.parse(JSON.stringify(s)));assert.deepEqual(currentCourt(s),before);
  assert.equal(finishCourt(s,g.answer).correct,true);assert.equal(finishCourt(s,g.answer),null);
});
test('an exposed lie is not stamped cleared and old cases retain their saved rules',()=>{
  let s=fixture(),g=startCourt(s,{level:1},()=>.45);const old=structuredClone(g);
  s=normalizeState(s);assert.equal(currentCourt(s).version,2);assert.deepEqual(currentCourt(s).rules,old.rules);
  const suspect=g.answer,statement=g.witnesses[suspect].falseStatement;
  courtAction(s,{type:'question',suspect});courtAction(s,{type:'inspect',evidence:statement});courtAction(s,{type:'present',suspect,statement,evidence:statement});
  g=currentCourt(s);assert.ok(courtMarkup(g).includes('ACCOUNT CORRECTED'));assert.ok(!g.eliminations.includes(suspect));
});
