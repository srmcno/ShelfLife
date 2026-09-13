import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, addNote, normalizeState } from '../src/state.js';
import { fileDocument, householdReport, normalizePaperwork, PAPERWORK_LIMIT } from '../src/paperwork-state.js';
import { recordScene, startOuting, chooseOuting, finishOuting } from '../src/engine/life.js';
import { newCourt, accuseCourt } from '../src/engine/court.js';
const now = new Date(2026, 8, 13, 12).getTime();
function shelf() {
  const s = blankState(); s.started = s.lastTick = now;
  s.pets = [{ id: 'a', name: 'Mabel', traits: [], stats: {cute:7,menace:6,damp:4,mystique:8}, needs: {food:70,fuss:70,clean:70}, bond:3, careLog:{food:2,fuss:1,clean:0}, art:{} }];
  s.slots[0] = 'a'; return s;
}
test('documents and lists survive chatter replacing all forty corkboard notes and clearing the board', () => {
  const s = shelf(); addNote(s, 'MEETING: the spoon is missing.', 'Mabel', 'note', 'doc'); addNote(s, '1. Find spoon\n2. Blame someone', 'Mabel', 'note', 'list');
  for (let i=0; i<45; i++) addNote(s, 'Ordinary note ' + i, 'the shelf', 'note', 'line');
  assert.equal(s.notes.length,40); assert.equal(s.paperwork.entries.length,2);
  s.notes=[]; const loaded=normalizeState(s); assert.equal(loaded.paperwork.entries.length,2); assert.match(loaded.paperwork.entries[0].text,/Find spoon/);
});
test('legacy notes and recorded outcomes migrate exactly once without inventing missing history', () => {
  const s=shelf(); delete s.paperwork;
  s.notes=[{text:'Actual filed list',form:'list',from:'Mabel',at:now}];
  s.life.scenes=[{id:1,kind:'court',title:'The spoon trial',text:'Mabel was cleared by the evidence.',cast:['a'],at:now-1000},{id:2,kind:'care',title:'Snack',text:'Mabel ate.',cast:['a'],at:now}];
  const loaded=normalizeState(s),again=normalizeState(loaded);
  assert.equal(loaded.paperwork.entries.length,2); assert.deepEqual(again.paperwork,loaded.paperwork);
  assert.match(loaded.paperwork.entries[1].title,/Verdict/);
  assert.deepEqual(normalizeState(shelf()).paperwork.entries,[]);
});
test('on-demand census uses real care and shelf positions, deduplicates unchanged reports and awards nothing', () => {
  const s=shelf(), before={xp:s.life.xp,bond:s.pets[0].bond,notes:s.noteCount};
  const report=householdReport(s,now);assert.match(report.text,/Mabel · A1/);assert.match(report.text,/meals 2 · fusses 1 · cleans 0/);
  assert.ok(fileDocument(s,report));assert.equal(fileDocument(s,householdReport(s,now+1000)),null);
  s.pets[0].careLog.food++; s.slots[0]=null;s.slots[7]='a';const changed=householdReport(s,now+2000);
  assert.match(changed.text,/Mabel · B2/);assert.ok(fileDocument(s,changed));
  assert.deepEqual({xp:s.life.xp,bond:s.pets[0].bond,notes:s.noteCount},before);assert.equal(s.paperwork.entries.length,2);
  assert.equal(householdReport(blankState()),null);
});
test('actual expedition completion and court verdict each file one outcome and cannot file again by claiming twice', () => {
  const s=shelf();assert.ok(startOuting(s,'drawer','thread',['a']));
  chooseOuting(s,0,now);chooseOuting(s,1,now);chooseOuting(s,0,now);
  assert.equal(s.paperwork.entries.filter(d=>d.title.startsWith('Expedition report')).length,1);
  const count=s.paperwork.entries.length;chooseOuting(s,0,now);assert.equal(s.paperwork.entries.length,count);finishOuting(s);
  const court=newCourt(s,()=>.37);assert.ok(accuseCourt(s,court,court.answer,now));
  assert.equal(s.paperwork.entries.filter(d=>d.title.startsWith('Verdict')).length,1);
  const end=s.paperwork.entries.length;accuseCourt(s,court,court.answer,now);assert.equal(s.paperwork.entries.length,end);
});
test('the archive is bounded separately from the scene journal and malformed backup documents are rejected', () => {
  const s=shelf();for(let i=0;i<140;i++)recordScene(s,'outing','Journey '+i,'A recorded result.', ['a'],now+i);
  assert.equal(s.life.scenes.length,18);assert.equal(s.paperwork.entries.length,PAPERWORK_LIMIT);
  const loaded=normalizeState(s);assert.equal(loaded.paperwork.entries.length,PAPERWORK_LIMIT);assert.match(loaded.paperwork.entries[0].title,/Journey 139/);
  const docs=normalizePaperwork({entries:[null,{key:'bad',text:'X',at:-1},{key:'nan',text:'X',at:Infinity},{key:'ok',text:'X',title:'T',at:now,cast:['a','a',null,'<script>']},{key:'ok',text:'duplicate',at:now}]}).entries;
  assert.equal(docs.length,1);assert.deepEqual(docs[0].cast,['a']);assert.equal(fileDocument(s,null),null);
});

test('malformed note casts cannot break resident filters after importing an older backup', () => {
  const s=shelf();s.notes=[{},7,'a',['a','a','<bad>',null]].map((cast,i)=>({text:'Unrelated note '+i,from:'the shelf',at:now,cast}));
  assert.deepEqual(normalizeState(s).notes.map(n=>n.cast),[[],[],[],['a']]);
});
