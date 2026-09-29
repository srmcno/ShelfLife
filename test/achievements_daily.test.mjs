import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { SEASONS } from '../src/content/seasons.js';
import { ACHIEVEMENTS, checkAchievements } from '../src/engine/achievements.js';

const has = (s, id) => ACHIEVEMENTS.find(a => a.id === id).check(s);

test('daily streaks and seasonal sets are recorded as incidents, and nothing is handed out early', () => {
  const s = blankState();
  for (const id of ['docket-3', 'docket-7', 'challenge-3', 'challenge-7', 'season-set']) assert.equal(has(s, id), false, id + ' on an empty shelf');
  s.courtroom = { ...s.courtroom, docketStreak: 3 };
  assert.equal(has(s, 'docket-3'), true); assert.equal(has(s, 'docket-7'), false);
  s.courtroom.docketStreak = 7;
  assert.equal(has(s, 'docket-7'), true);
  s.arcade = { ...s.arcade, dailyStreak: 3 };
  assert.equal(has(s, 'challenge-3'), true); assert.equal(has(s, 'challenge-7'), false);
  s.arcade.dailyStreak = 7;
  assert.equal(has(s, 'challenge-7'), true);
  const partial = Object.fromEntries(SEASONS[0].curios.slice(1).map(c => [c.id, 1]));
  s.mayhem.curios = partial;
  assert.equal(has(s, 'season-set'), false, 'one curio short');
  s.mayhem.curios = Object.fromEntries(SEASONS[0].curios.map(c => [c.id, 1]));
  assert.equal(has(s, 'season-set'), true);
});

test('the new incidents unlock once and are written into the museum', () => {
  const s = blankState();
  s.courtroom = { ...s.courtroom, docketStreak: 3 };
  const first = checkAchievements(s, 1000);
  assert.ok(first.some(a => a.id === 'docket-3'));
  assert.equal(checkAchievements(s, 2000).some(a => a.id === 'docket-3'), false);
  assert.equal(s.achievementAt['docket-3'], 1000);
});
