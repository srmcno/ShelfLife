import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE_NAMES, householdFixture } from './household-fixtures.mjs';
import { normalizeState } from '../src/state.js';
import { createBackup } from '../src/backup.js';
import { tick, isAsleep } from '../src/engine/tick.js';
import { runBehavior } from '../src/engine/behavior.js';
import { advanceStories, storyState } from '../src/engine/stories.js';
const now=new Date(2026,8,12,12).getTime();

for(const kind of FIXTURE_NAMES) test(kind+' household retains identity, artwork, placement and history through repeated transfers',()=>{
  const source=householdFixture(kind,now), copy=JSON.stringify(source);
  let loaded=normalizeState(JSON.parse(createBackup(source,now).text));
  assert.ok(loaded);assert.equal(JSON.stringify(source),copy,'preview does not mutate source');
  for(const p of source.pets){const restored=loaded.pets.find(x=>x.id===p.id);assert.equal(restored.name,p.name);assert.deepEqual(restored.art.body,p.img??p.art.body);if(p.art?.creature)assert.deepEqual(restored.art.creature,p.art.creature);if(p.art?.stamps)assert.deepEqual(restored.art.stamps,p.art.stamps);if(p.names)assert.deepEqual(restored.names,p.names);if(p.slotHist)assert.deepEqual(restored.slotHist,p.slotHist);assert.deepEqual(restored.careLog,p.careLog);}
  assert.deepEqual(loaded.slots,source.slots);assert.deepEqual(loaded.gone,source.gone);assert.deepEqual(loaded.achievements,source.achievements);
  if(source.theatre)assert.equal(loaded.theatre.lamps.qad1,false);
  if(source.behavior)assert.equal(loaded.behavior.props.qad0.uses,1);
  if(source.stories)assert.deepEqual(loaded.stories,source.stories,'relationships, visitors and rehomed records survive transfer');
  if(source.life) {assert.deepEqual(loaded.life.projects,source.life.projects);assert.deepEqual(loaded.life.scenes,source.life.scenes);}
  const stable=JSON.stringify(loaded);
  for(let pass=0;pass<3;pass++)loaded=normalizeState(JSON.parse(createBackup(loaded,now).text));
  assert.equal(JSON.stringify(loaded),stable,'repeated restores are stable');
  if(kind==='legacy') assert.equal(loaded.life.introDone,true,'established imported households skip first-session onboarding');
  if(kind==='sleeping')assert.ok(loaded.pets.every(p=>isAsleep(p,new Date(now))));
  assert.doesNotThrow(()=>{tick(loaded,now+60000);runBehavior(loaded,now+60000);advanceStories(loaded,now+60000);storyState(loaded);});
  assert.equal(loaded.pets.length,source.pets.length,'simulation cannot discard an imported resident');
});

test('fixtures cover a nearly full cabinet and a megabyte of layered raster art',()=>{
  assert.equal(householdFixture('nearly-full',now).slots.filter(Boolean).length,17);
  const drawing=householdFixture('drawing-heavy',now);
  assert.ok(JSON.stringify(drawing).length>900000);
  assert.ok(drawing.pets.every(p=>p.art.body.startsWith('data:image/png;base64,')&&p.art.stamps.length===18));
});

test('a quota failure can be retried without losing the latest household or deleting its only legacy copy',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const legacy=JSON.stringify(householdFixture('legacy',now)); const disk=new Map([['shelflife.v3',legacy]]);let full=false;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>disk.get(k)??null,setItem(k,v){if(full)throw Error('quota');disk.set(k,v);},removeItem:k=>disk.delete(k)}});
  try {const m=await import('../src/state.js?fixture-quota');m.state.pets[0].name='Latest Agnes';full=true;assert.equal(m.save(),false);assert.equal(disk.get('shelflife.v3'),legacy);assert.equal(m.Store.persistent,false);assert.equal(JSON.parse(m.Store.get(m.SAVE_KEY)).pets[0].name,'Latest Agnes');full=false;assert.equal(m.save(),true);assert.equal(disk.has('shelflife.v3'),false);assert.equal(JSON.parse(disk.get(m.SAVE_KEY)).pets[0].name,'Latest Agnes');}
  finally {if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
