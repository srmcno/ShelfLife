import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankState, normalizeState } from '../src/state.js';
import { FIXTURE_NAMES, householdFixture } from './household-fixtures.mjs';
import { normalizeGuide } from '../src/life-state.js';
import { mayhemState } from '../src/mayhem-state.js';
import { lifeState } from '../src/engine/life.js';
import { EMERGENCIES } from '../src/content/mayhem.js';
import { COFFIN_COST, CARE_SOULS, omenGift } from '../src/engine/mayhem.js';
import {
  GUIDE_STEPS, GUIDE_TOTAL, FRESH_WINDOW_MS, DAY_MS, householdIsFresh, ensureGuide, guideOf, guideActive, guideView, guideCopy, advanceGuide,
  markGuideSeen, skipGuide, resumeGuide, celebrateGuide, guideDay, deskStage, deskReveal
} from '../src/engine/guide.js';

const noon = new Date(2026, 8, 12, 12).getTime();
const roundTrip = s => normalizeState(JSON.parse(JSON.stringify(s)));
function newcomer(now = noon, count = 1) {
  const s = blankState();
  s.started = now; s.lastTick = now;
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: i ? 'Pip' : 'Mabel', traits: [], bond: 0, born: now, needs: { food: 58, fuss: 54, clean: 66 }, art: { body: '', stamps: [] } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return roundTrip(s);
}
const care = (s, need = 'food') => { s.pets[0].careLog = { food: 0, fuss: 0, clean: 0, ...s.pets[0].careLog }; s.pets[0].careLog[need] += 1; };

test('a brand new household starts the tour once; the first step is to say hello', () => {
  const s = newcomer();
  assert.equal(guideOf(s), null);
  assert.equal(householdIsFresh(s, noon), true);
  const g = ensureGuide(s, noon);
  assert.equal(g.status, 'on');
  assert.equal(g.at, noon);
  assert.equal(ensureGuide(s, noon + 5000), g, 'idempotent');
  const view = guideView(s);
  assert.equal(view.step.id, 'meet');
  assert.equal(view.step.number, 1);
  assert.equal(view.total, GUIDE_TOTAL);
  assert.match(view.step.line, /Mabel/);
  assert.equal(guideActive(s), true);
});

test('no resident, no tour', () => {
  const s = blankState();
  assert.equal(ensureGuide(s, noon), null);
  assert.equal(householdIsFresh(s, noon), false);
});

test('every established household skips the tour entirely and keeps its save unchanged', () => {
  for (const kind of FIXTURE_NAMES) {
    const s = householdFixture(kind, noon);
    lifeState(s); // normalising a raw fixture is not the tour's doing
    const before = JSON.stringify(s);
    assert.equal(householdIsFresh(s, noon), false, kind + ' is not new');
    assert.equal(ensureGuide(s, noon), null, kind + ' gets no guide');
    assert.equal(guideActive(s), false);
    assert.equal(advanceGuide(s, noon), null);
    assert.equal(JSON.stringify(s), before, kind + ' save was not touched');
    assert.equal(deskStage(s, noon), 3, kind + ' sees the whole desk');
    const reveal = deskReveal(s, noon);
    assert.ok(reveal.omen && reveal.chores && reveal.coffin && reveal.today && reveal.cabinet && reveal.season, kind + ' desk');
    assert.equal(reveal.teaser, '');
  }
});

test('a household that has done anything at all is established, whatever its age', () => {
  const settled = newcomer(); settled.life.introDone = true;
  assert.equal(ensureGuide(settled, noon), null, 'the housewarming is settled');
  const played = newcomer(); mayhemState(played).lifetime = 3;
  assert.equal(ensureGuide(played, noon), null, 'souls were earned before');
  const solved = newcomer(); mayhemState(solved).resolved = 1;
  assert.equal(ensureGuide(solved, noon), null);
  const discovered = newcomer(); discovered.life.xp = 1;
  assert.equal(ensureGuide(discovered, noon), null);
  const old = newcomer(noon - 3 * DAY_MS);
  assert.equal(ensureGuide(old, noon), null, 'a resident from three days ago is not a first session');
  assert.equal(ensureGuide(newcomer(noon, 3), noon), null, 'three residents is not a first session');
  const edge = newcomer(noon - FRESH_WINDOW_MS);
  assert.ok(ensureGuide(edge, noon), 'the window is inclusive');
});

test('an old save with an unfinished housewarming is not given a tour on upgrade', () => {
  const s = householdFixture('established', noon);
  s.life.introDone = false;
  s.mayhem = { souls: 80, lifetime: 80, nextAt: noon + 1 };
  assert.equal(ensureGuide(roundTrip(s), noon), null);
});

test('steps finish on the real action, in any order, and each pays its reward once', () => {
  const s = newcomer(); ensureGuide(s, noon);
  const m = mayhemState(s);
  assert.equal(advanceGuide(s, noon), null, 'nothing has happened yet');
  care(s);
  let result = advanceGuide(s, noon);
  assert.deepEqual(result.steps.map(x => x.id), ['feed']);
  assert.equal(m.souls, GUIDE_STEPS.find(x => x.id === 'feed').reward);
  assert.equal(advanceGuide(s, noon), null, 'paid once');
  assert.equal(guideView(s).step.id, 'meet', 'the current step is the first one still open');
  assert.equal(markGuideSeen(s, 'meet'), true);
  assert.equal(markGuideSeen(s, 'meet'), false);
  result = advanceGuide(s, noon);
  assert.deepEqual(result.steps.map(x => x.id), ['meet']);
  assert.equal(guideView(s).step.id, 'emergency');
  m.resolved = 1;
  m.omen = { day: 'x', id: 'wet-hand', streak: 1, lastDay: 'x', grace: 1 };
  markGuideSeen(s, 'note');
  m.coffins = 1;
  result = advanceGuide(s, noon + 60000);
  assert.deepEqual(result.steps.map(x => x.id).sort(), ['coffin', 'emergency', 'note', 'omen']);
  assert.equal(result.finished, true);
  assert.equal(guideOf(s).status, 'done');
  assert.equal(guideOf(s).finishedAt, noon + 60000);
  assert.equal(guideActive(s), false);
  assert.equal(guideView(s).step, null);
  assert.equal(advanceGuide(s, noon + 120000), null, 'a finished tour never pays again');
});

test('only the screen can see two steps, and only while the tour is on', () => {
  const s = newcomer();
  assert.equal(markGuideSeen(s, 'meet'), false, 'no tour yet');
  ensureGuide(s, noon);
  assert.equal(markGuideSeen(s, 'feed'), false, 'feeding is read from the save, not reported');
  assert.equal(markGuideSeen(s, 'bogus'), false);
  skipGuide(s);
  assert.equal(markGuideSeen(s, 'note'), false, 'a skipped tour records nothing');
});

test('the feeding step needs actual food: a wash or a fuss does not count', () => {
  const s = newcomer(); ensureGuide(s, noon);
  care(s, 'clean');
  care(s, 'fuss');
  assert.equal(advanceGuide(s, noon), null);
  care(s, 'food');
  assert.deepEqual(advanceGuide(s, noon).steps.map(x => x.id), ['feed']);
});

test('the rewards guarantee the first coffin is affordable by the time it is offered', () => {
  const beforeCoffin = GUIDE_STEPS.filter(x => x.id !== 'coffin').reduce((n, x) => n + x.reward, 0);
  const worstEmergency = Math.min(...EMERGENCIES.flatMap(e => e.choices.flatMap(c => c.outcomes.map(o => o.souls || 0))));
  const floor = beforeCoffin + omenGift(1) + CARE_SOULS + worstEmergency;
  assert.ok(floor >= COFFIN_COST, 'guaranteed ' + floor + ' souls against a coffin at ' + COFFIN_COST);
});

test('skipping is remembered, can be resumed with progress intact, and a finished tour cannot restart', () => {
  const s = newcomer(); ensureGuide(s, noon);
  care(s); advanceGuide(s, noon);
  assert.equal(skipGuide(s), true);
  assert.equal(skipGuide(s), false);
  assert.equal(guideView(s).step, null);
  assert.equal(advanceGuide(s, noon), null, 'skipped means quiet');
  const again = roundTrip(s);
  assert.equal(guideOf(again).status, 'skipped');
  assert.deepEqual(guideOf(again).done, ['feed']);
  assert.equal(resumeGuide(again), true);
  assert.equal(guideView(again).step.id, 'meet', 'progress was kept');
  const done = newcomer(); ensureGuide(done, noon); guideOf(done).status = 'done';
  assert.equal(resumeGuide(done), false);
  assert.equal(celebrateGuide(done), true);
  assert.equal(celebrateGuide(done), false);
});

test('guide state survives reloads and repairs malformed data', () => {
  const s = newcomer(); ensureGuide(s, noon); markGuideSeen(s, 'meet');
  const loaded = roundTrip(s);
  assert.deepEqual(guideOf(loaded), guideOf(s));
  assert.equal(JSON.stringify(roundTrip(loaded)), JSON.stringify(loaded), 'idempotent');
  assert.equal(normalizeGuide(null), null);
  assert.equal(normalizeGuide([]), null);
  assert.equal(normalizeGuide('on'), null);
  const messy = normalizeGuide({ status: 'bogus', at: -4, seen: ['meet', 'meet', 7, 'NOT OK', '__proto__'], done: 'meet', finishedAt: Infinity, celebrated: 'yes' });
  assert.deepEqual(messy, { v: 1, status: 'on', at: 0, seen: ['meet'], done: [], finishedAt: 0, celebrated: false });
  assert.equal(normalizeGuide({ seen: Array.from({ length: 40 }, (_, i) => 'step' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + (i % 20))) }).seen.length <= 12, true);
});

test('the desk grows over the first days: calendar and milestones together, never the calendar alone', () => {
  const s = newcomer(); ensureGuide(s, noon);
  const m = mayhemState(s);
  assert.equal(guideDay(guideOf(s), noon), 1);
  assert.equal(deskStage(s, noon), 1);
  assert.deepEqual(['omen', 'chores', 'coffin', 'today', 'cabinet', 'season'].map(k => deskReveal(s, noon)[k]), [false, false, false, false, false, false]);
  assert.match(deskReveal(s, noon).teaser, /settle in/);
  // The calendar alone does nothing.
  assert.equal(deskStage(s, noon + 2 * DAY_MS), 1, 'two days of not playing reveal nothing');
  // A milestone alone does nothing on the first day.
  m.resolved = 1;
  assert.equal(deskStage(s, noon), 1, 'solving an emergency on day one keeps the desk small');
  // Tomorrow plus a milestone: omen and chores.
  const tomorrow = noon + DAY_MS;
  assert.equal(guideDay(guideOf(s), tomorrow), 2);
  assert.equal(deskStage(s, tomorrow), 2);
  const two = deskReveal(s, tomorrow);
  assert.ok(two.omen && two.chores && two.coffin && !two.today && !two.cabinet && !two.season);
  assert.match(two.teaser, /Playroom board/);
  // The third day needs a finished tour or an opened coffin as well.
  assert.equal(deskStage(s, noon + 2 * DAY_MS), 2);
  m.coffins = 1;
  assert.equal(deskStage(s, noon + 2 * DAY_MS), 3);
  assert.equal(deskReveal(s, noon + 2 * DAY_MS).teaser, '');
});

test('staging counts calendar days, so a night owl sees tomorrow at midnight and a long first day stays day one', () => {
  const late = new Date(2026, 8, 12, 23, 30).getTime();
  const s = newcomer(late); ensureGuide(s, late);
  assert.equal(guideDay(guideOf(s), late + 40 * 60000), 2, 'ten past midnight is the second day');
  assert.equal(guideDay(guideOf(s), late + 20 * 60000), 1, 'ten to midnight is still the first');
  const morning = new Date(2026, 8, 12, 7).getTime();
  const early = newcomer(morning); ensureGuide(early, morning);
  assert.equal(guideDay(guideOf(early), morning + 16 * 3600000), 1, 'sixteen hours later is still the same day');
});

test('a finished or skipped tour never hides anything again', () => {
  const skipped = newcomer(); ensureGuide(skipped, noon); skipGuide(skipped);
  assert.equal(deskStage(skipped, noon), 3);
  const done = newcomer(); ensureGuide(done, noon); guideOf(done).status = 'done';
  assert.equal(deskStage(done, noon), 1, 'finishing the tour on day one still waits for the days');
  assert.equal(deskStage(done, noon + DAY_MS), 2);
  assert.equal(deskStage(done, noon + 2 * DAY_MS), 3);
});

test('the coffin tile appears the moment there is something to spend, and during the coffin step', () => {
  const s = newcomer(); ensureGuide(s, noon);
  assert.equal(deskReveal(s, noon).coffin, false);
  mayhemState(s).souls = COFFIN_COST;
  assert.equal(deskReveal(s, noon).coffin, true);
  mayhemState(s).souls = 0;
  const g = guideOf(s); g.seen = ['meet', 'note']; g.done = ['meet', 'feed', 'emergency', 'omen', 'note'];
  assert.equal(guideView(s).step.id, 'coffin');
  assert.equal(deskReveal(s, noon).coffin, true, 'the step needs its button');
});

test('guide copy is complete, names the resident and keeps to the house rules', () => {
  for (const step of GUIDE_STEPS) {
    const copy = guideCopy(step.id, 'Gnash');
    assert.ok(copy.line.length > 8 && copy.line.length < 60, step.id + ' line is short');
    assert.ok(copy.hint.length > 20 && copy.hint.length < 140, step.id + ' hint fits a phone');
    assert.doesNotMatch(copy.line + copy.hint, /[–—]/, 'no em or en dashes');
  }
  assert.match(guideCopy('meet', 'Gnash').line, /Gnash/);
  assert.match(guideCopy('feed', 'Gnash').line, /Gnash/);
  assert.equal(guideCopy('nonsense').line, '');
  const source = readFileSync(new URL('../src/engine/guide.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/engine/nextstep.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /[–—]/);
});
