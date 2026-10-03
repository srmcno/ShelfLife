import test from 'node:test';
import assert from 'node:assert/strict';
import { householdFixture } from './household-fixtures.mjs';
import { blankState, normalizeState } from '../src/state.js';
import { createBackup } from '../src/backup.js';
import { normalizeCourtroom, courtroomState, blankCourtroom } from '../src/court-state.js';
import { careerView } from '../src/engine/court-career.js';
import { versionRecord } from '../src/engine/court-twists.js';
import { castEpisode, episodeRule, courtFinish, nextCaseId, rotateCast, payOwedSummons } from '../src/engine/court.js';
import { seededRandom } from '../src/engine/arcade.js';

const NOW = new Date(2026, 8, 12, 12).getTime();

test('a save from before the replay work loads unchanged, gains blank new fields, and keeps its stars and rank credit', () => {
  const old = blankState();
  old.courtroom = { episodes: 9, justice: 6, best: { 'borrowed-coffin': 3, 'snoring-wall': 2 }, last: 'snoring-wall', docketDay: '2026-8-11', docketStreak: 2, docketLastDay: '2026-8-11',
    summonsDay: '2026-8-11', summonsHeard: 1, summonsVerdicts: 0, summonsPaid: ['00000000-0000-4000-8000-000000000009'] };
  const loaded = normalizeState(JSON.parse(JSON.stringify(old)));
  const c = loaded.courtroom;
  assert.deepEqual([c.episodes, c.justice, c.best, c.last, c.docketStreak, c.summonsHeard], [9, 6, { 'borrowed-coffin': 3, 'snoring-wall': 2 }, 'snoring-wall', 2, 1]);
  assert.deepEqual(c.summonsPaid, ['00000000-0000-4000-8000-000000000009']);
  assert.deepEqual([c.versions, c.recent, c.seats, c.stars, c.rank, c.flawless, c.summonsOwed], [{}, [], {}, 0, 0, 0, []]);
  assert.equal(careerView(c).stars, 5, 'the best stars it already had are credited');
  assert.deepEqual(versionRecord(c, 'borrowed-coffin'), { base: 3 }, 'and the one airing it has on record was the original');
  assert.equal(JSON.stringify(normalizeState(JSON.parse(JSON.stringify(loaded))).courtroom), JSON.stringify(c), 'loading twice changes nothing');
  // Playing on from it keeps everything and adds only what is new.
  loaded.pets = ['Agnes', 'Mort', 'Pip'].map((name, i) => ({ id: 'g' + i, name, traits: ['damp'], needs: { food: 50, fuss: 50, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }));
  const ep = castEpisode(loaded, { caseId: 'stolen-slot', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  episodeRule(ep, 'both', seededRandom(2));
  const res = courtFinish(loaded, ep, NOW);
  assert.equal(c.best['borrowed-coffin'], 3);
  assert.equal(courtroomState(loaded).stars, 5 + res.stars);
  assert.deepEqual(courtroomState(loaded).recent, ['stolen-slot']);
  assert.ok(nextCaseId(loaded, seededRandom(4)) !== 'stolen-slot');
  assert.ok(rotateCast(loaded, seededRandom(1)).plaintiffId);
});

test('normalizing the courtroom twice is the same as once, for blank, hostile and full records', () => {
  const full = householdFixture('court-veteran', NOW).courtroom;
  for (const raw of [undefined, null, 5, 'x', [], {}, { versions: { 'borrowed-coffin': { base: 2 } }, seats: { a: 1 }, recent: ['tontine'] }, full, { stars: 1e12, rank: 1e12, flawless: -4, summonsOwed: 'x' }]) {
    const once = normalizeCourtroom(raw), twice = normalizeCourtroom(once);
    assert.deepEqual(twice, once);
    assert.deepEqual(Object.keys(once).sort(), Object.keys(blankCourtroom()).sort());
  }
  assert.deepEqual(normalizeCourtroom(full), full, 'a well-formed record survives untouched');
});

test('the court veteran survives repeated transfers and still pays what it is owed', () => {
  const source = householdFixture('court-veteran', NOW);
  let loaded = normalizeState(JSON.parse(createBackup(source, NOW).text));
  for (let i = 0; i < 3; i++) loaded = normalizeState(JSON.parse(createBackup(loaded, NOW).text));
  assert.deepEqual(loaded.courtroom, source.courtroom);
  assert.equal(careerView(loaded.courtroom).name, 'Circuit Judge, Allegedly', '52 stars is past the fifth rank');
  assert.equal(loaded.courtroom.rank, 4, 'one promotion is earned but not yet paid');
  assert.deepEqual(careerView(loaded.courtroom).dress.banner, 'crest');
  // The reward over the cap waits; tomorrow it is paid, once.
  const before = loaded.mayhem.souls;
  assert.deepEqual(payOwedSummons(loaded, NOW), { souls: 0, count: 0 });
  assert.deepEqual(payOwedSummons(loaded, NOW + 86400000), { souls: 15, count: 1 });
  assert.equal(loaded.mayhem.souls - before, 15);
  assert.deepEqual(payOwedSummons(loaded, NOW + 86400000), { souls: 0, count: 0 });
});
