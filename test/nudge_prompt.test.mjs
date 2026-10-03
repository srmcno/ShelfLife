import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { nudgePromptDue, notePrompted, resetPromptedForTests } from '../src/notify.js';

function household(resolved) {
  const s = blankState();
  s.pets = [{ id: 'a', name: 'Mabel' }];
  s.mayhem.resolved = resolved;
  return s;
}

test('the nudge offer waits for the first resolved emergency', () => {
  resetPromptedForTests();
  assert.equal(nudgePromptDue(household(0), true), false, 'not at launch, not before there is a reason');
  assert.equal(nudgePromptDue(household(1), true), true);
  assert.equal(nudgePromptDue(household(7), true), true, 'a player who never answered is asked at a later result');
});

test('it is never asked twice in one session, and a remembered "not now" is final', () => {
  resetPromptedForTests();
  const s = household(1);
  assert.equal(nudgePromptDue(s, true), true);
  notePrompted();
  assert.equal(nudgePromptDue(s, true), false, 'the same session does not see it again');
  resetPromptedForTests();
  s.settings.nudgeAsked = true;
  assert.equal(nudgePromptDue(s, true), false, 'asked in an earlier session and answered');
  const on = household(3); on.settings.nudges = true;
  assert.equal(nudgePromptDue(on, true), false, 'already on');
});

test('on the web, where there is no plugin, nothing is ever offered', () => {
  resetPromptedForTests();
  assert.equal(nudgePromptDue(household(5), false), false);
  assert.equal(nudgePromptDue(null, true), false);
});
