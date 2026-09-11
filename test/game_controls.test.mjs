import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptsGameShortcut, chaseKeyAction, chaseSettingsLocked } from '../src/ui/game-controls.js';

test('game shortcuts leave editing, handled events and browser commands alone', () => {
  for (const input of [{defaultPrevented:true},{ctrlKey:true},{metaKey:true},{altKey:true},
    {target:{isContentEditable:true}}, {target:{closest:selector => selector.includes('input') ? {} : null}}]) {
    const event = {key:'p',...input};
    assert.equal(acceptsGameShortcut(event),false);
    assert.equal(chaseKeyAction(event,{running:true,paused:false}),null);
  }
  assert.equal(acceptsGameShortcut({key:'ArrowLeft'}),true);
});

test('Chase pause and resume are deliberate while repeated jump and dash keys cannot fire twice', () => {
  assert.equal(chaseKeyAction({key:'P'},{running:true,paused:false}),'pause');
  assert.equal(chaseKeyAction({key:'p'},{running:false,paused:true}),'resume');
  assert.equal(chaseKeyAction({key:'p',repeat:true},{running:true,paused:false}),null);
  assert.equal(chaseKeyAction({key:'p'},{running:false,paused:false}),null);
  assert.equal(chaseKeyAction({key:'p'},{running:true,paused:false,visible:false}),null);
  for (const key of [' ','ArrowUp','W','x']) assert.equal(chaseKeyAction({key,repeat:true},{running:true}),'suppress');
  for (const key of ['ArrowLeft','a']) assert.equal(chaseKeyAction({key,repeat:true},{running:true}),'left');
  for (const key of ['ArrowRight','D']) assert.equal(chaseKeyAction({key},{running:true}),'right');
  assert.equal(chaseKeyAction({key:' '},{running:true}),'hop');
  assert.equal(chaseKeyAction({key:'X'},{running:true}),'dash');
});

test('focused game buttons retain native keyboard activation without spending a second action', () => {
  const target = {closest:selector => selector === 'button' ? {} : null};
  for (const key of [' ','Enter']) assert.equal(chaseKeyAction({key,target},{running:true,paused:false}),null);
  assert.equal(chaseKeyAction({key:'p',target},{running:true,paused:false}),'pause');
});

test('pace is editable only before a chase or after its recorded result', () => {
  for (const phase of ['play','paused','upgrade']) assert.equal(chaseSettingsLocked(phase),true);
  for (const phase of ['setup','result']) assert.equal(chaseSettingsLocked(phase),false);
});
