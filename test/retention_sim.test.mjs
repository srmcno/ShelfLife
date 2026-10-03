import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlayer, DAY, START } from './support/retention-sim.mjs';
import { CHAPTERS, TRACK, DAILY_XP_CAP, WEEKLY_SOULS, CHEST_SOULS, EDITION_RARITY, SPOTLIGHT_XP, WEEKLY_XP, CHEST_XP, RETURN_XP_PER_DAY } from '../src/content/almanac.js';
import { SETS } from '../src/content/collections.js';
import { chapterAt, backIssues, weekNumber } from '../src/engine/almanac.js';
import { chestFor, RETURN_MAX_DAYS } from '../src/engine/returns.js';
import { normalizeState } from '../src/state.js';
import { legacyInfo } from '../src/engine/legacy.js';

/* A scripted 120-day run on a fake clock, through the real engines. It checks the
   two things the long-term systems promise: there is always something to do or
   save for, and no new faucet has no ceiling. The run starts on 3 October 2026. */

const DAYS = 120;
const runs = {};
const run = persona => (runs[persona] ||= runPlayer({ persona, days: DAYS }));

test('content and goals remain through day 120: every day has a chapter and several things to work toward', () => {
  const { rows } = run('daily');
  assert.equal(rows.length, DAYS);
  for (const row of rows) {
    assert.ok(row.chapter, 'a chapter runs on day ' + row.day);
    assert.ok(row.goals.length >= 3, 'day ' + row.day + ' has goals: ' + row.goals.join());
    assert.ok(row.goals.includes('weekly') || row.goals.includes('sets'), 'day ' + row.day);
  }
  assert.deepEqual([...new Set(rows.map(r => r.chapter))], ['thin-2026', 'fog-2026', 'night-2026', 'resolve-2027']);
  // Every chapter hands the track back to the player on its first day.
  for (const key of ['thin-2026', 'fog-2026', 'night-2026', 'resolve-2027']) assert.ok(rows.find(r => r.chapter === key).goals.includes('track'), key);
  assert.ok(rows.at(-1).goals.includes('exchange') && rows.at(-1).goals.includes('legacy'), 'a full-track player still has the Exchange and the ranks');
});

test('a player who plays one short session a day is never locked out and gets most of the way through each chapter', () => {
  const { rows, state } = run('casual');
  const byChapter = {};
  for (const r of rows) (byChapter[r.chapter] ||= []).push(r);
  for (const [key, list] of Object.entries(byChapter)) assert.ok(list.at(-1).tier >= 18, key + ' ended at tier ' + list.at(-1).tier);
  assert.ok(state.almanac.stats.tiers >= 60);
  assert.ok(rows.every(r => r.goals.length >= 3));
});

test('a heavy player does not run out of chapter in the first week', () => {
  const { rows } = run('daily');
  for (const key of ['thin-2026', 'fog-2026', 'night-2026', 'resolve-2027']) {
    const list = rows.filter(r => r.chapter === key);
    const finished = list.findIndex(r => r.tier >= 30);
    assert.ok(finished === -1 || finished >= 10, key + ' was finished on day ' + finished + ' of the chapter');
  }
});

test('the day is capped: no player, however busy, earns more Almanac XP than the cap on a day', () => {
  for (const persona of ['daily', 'diligent', 'farmer']) {
    const { rows } = run(persona);
    assert.ok(Math.max(...rows.map(r => r.xpToday)) <= DAILY_XP_CAP, persona);
  }
});

test('no faucet is uncapped: the new ones are bounded by chapters, weeks, days and sets, however hard they are pushed', () => {
  const trackMax = TRACK.reduce((n, t) => n + (t.amount || 0), 0) + 4 * EDITION_RARITY.refund + 100 + 80;   // even an encore pays out no more than this
  const setMax = SETS.reduce((n, s) => n + s.souls, 0);
  for (const persona of ['daily', 'diligent', 'farmer']) {
    const { ledger, rows, state } = run(persona);
    const chapters = new Set(rows.map(r => r.chapter)).size, weeks = Math.ceil(DAYS / 7) + 1;
    assert.ok(ledger.track <= chapters * trackMax, persona + ' track ' + ledger.track + ' vs ' + chapters * trackMax);
    assert.ok(ledger.weekly <= weeks * 3 * WEEKLY_SOULS, persona + ' weekly');
    assert.ok(ledger.chest <= weeks * CHEST_SOULS, persona + ' chest');
    assert.ok(ledger.returns <= DAYS * chestFor(RETURN_MAX_DAYS).souls, persona + ' returns');
    assert.ok(ledger.spotlight <= chapters * 2 * 40, persona + ' spotlight');
    assert.ok(ledger.sets <= setMax, persona + ' sets');
    // And the chapter XP itself: days times the cap, plus what happens once a week, a chapter or a return.
    for (const [key, rec] of Object.entries(state.almanac.chapters)) {
      const span = rows.filter(r => r.chapter === key).length;
      const bound = span * DAILY_XP_CAP + Math.ceil(span / 7 + 1) * (3 * WEEKLY_XP + CHEST_XP) + 2 * SPOTLIGHT_XP + span * RETURN_XP_PER_DAY * RETURN_MAX_DAYS;
      assert.ok(rec.xp <= bound, persona + ' ' + key + ' xp ' + rec.xp + ' vs ' + bound);
    }
  }
});

test('pushing every lever all day finds no extra income from the new systems', () => {
  const daily = run('diligent'), farmer = run('farmer');
  const per = r => r.ledger.track + r.ledger.weekly + r.ledger.chest + r.ledger.returns + r.ledger.spotlight + r.ledger.settled + r.ledger.sets;
  assert.ok(per(farmer) <= per(daily) * 1.05, 'the farmer gets ' + per(farmer) + ' from the new faucets; a completionist ' + per(daily));
  assert.ok(Math.max(...farmer.rows.map(r => r.newFaucet)) < 1500, 'no single day pays out more than a chapter’s worth');
});

test('the new faucets are a lift, not a flood: under a quarter of a daily player’s income', () => {
  for (const persona of ['daily', 'diligent']) {
    const { rows } = run(persona);
    const earned = rows.reduce((n, r) => n + r.soulsEarned, 0), fresh = rows.reduce((n, r) => n + r.newFaucet, 0);
    assert.ok(fresh / earned < 0.25, persona + ' new share ' + (fresh / earned).toFixed(3));
    assert.ok(fresh / DAYS > 20, 'and it is worth having');
  }
});

test('the sinks keep up: a collector who spends is still saving for something on day 120', () => {
  const { state, ledger, rows } = run('diligent');
  assert.ok(ledger.spent > 40000, 'spent ' + ledger.spent);
  assert.ok(state.mayhem.souls < state.mayhem.lifetime * 0.25, 'souls in hand ' + state.mayhem.souls + ' of ' + state.mayhem.lifetime);
  assert.ok(rows.at(-1).goals.includes('exchange'));
  assert.ok(legacyInfo(state).level >= 3, 'past Unspeakable and climbing');
  assert.ok(state.achievements.length >= 28);
});

test('a player who vanishes for a month is welcomed, not punished, and can buy back what they missed', () => {
  const { state, rows } = runPlayer({ persona: 'lapsed', days: DAYS, awayFrom: 3, awayDays: 40 });
  const back = rows.find(r => r.day === 43);
  assert.ok(back, 'they came back on day 43');
  assert.ok(back.goals.includes('track') && back.goals.includes('weekly'));
  assert.ok(rows.every((r, i) => !i || r.lifetime >= rows[i - 1].lifetime), 'nothing was taken');
  assert.ok(rows.every(r => r.souls >= 0));
  // The chest after a month away is the capped one, claimed once.
  assert.ok(state.returns.claimed >= 1);
  assert.equal(state.returns.pending, null);
  // What ended while they were out is for sale, never lost.
  const at = START + DAYS * DAY;
  const list = backIssues(state, at);
  assert.ok(list.curios.length >= 3 && list.decor.length >= 1, 'back issues: ' + list.curios.length + ' curios, ' + list.decor.length + ' room sets');
  assert.ok(list.curios.every(c => c.cost <= 450));
  assert.ok(chapterAt(at));
});

test('the weeks keep turning: a new set of challenges every Monday, and a save that stays small', () => {
  const { state } = run('daily');
  const seen = new Set();
  for (let d = 0; d < DAYS; d += 7) seen.add(weekNumber(START + d * DAY));
  assert.ok(seen.size >= 17);
  const size = JSON.stringify(state).length - JSON.stringify({ ...state, almanac: null, streaks: null, returns: null, legacy: null, collections: null, exchange: null }).length;
  assert.ok(size < 6000, 'the retention state is ' + size + ' characters after 120 days');
  const back = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(back.almanac, state.almanac, 'it survives a reload unchanged');
  assert.deepEqual(back.exchange, state.exchange);
  assert.deepEqual(back.streaks, state.streaks);
});

test('claimables never run dry for the daily player and always carry the documented shape', () => {
  const { rows } = run('daily');
  assert.ok(rows.filter(r => r.claimables > 0).length >= 5, 'there are claimable moments');
});
