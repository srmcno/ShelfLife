import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, localDayKey, dayKeyOffset } from '../src/state.js';
import { COURT_BY_ID, docketCaseId } from '../src/engine/court.js';
import { dailyChallenge } from '../src/engine/daily.js';
import { ARCADE_BY_ID } from '../src/content/arcade.js';
import { planNudges, outOfQuiet, syncNudges, enableNudges, nudgesAvailable, clearAwayNudges, NUDGE_IDS, NUDGE_CATEGORY, NUDGE_CATEGORY_LABELS } from '../src/notify.js';
import { AWAY_LADDER } from '../src/content/nudges.js';
import { NUDGE_CATEGORIES, normalizeNudgeCats } from '../src/almanac-state.js';
import { normalizeState } from '../src/state.js';
import { weeklyChallenges, weekNumber, grantXp, syncAlmanac } from '../src/engine/almanac.js';

const at = (m, d, h = 12, min = 0) => new Date(2026, m, d, h, min).getTime();
const NOW = at(8, 29, 10);
function household(over = {}) {
  const s = blankState();
  s.started = NOW - 86400000; s.lastTick = NOW;
  s.pets = [{ id: 'a', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 0, cared: 0, grudges: 0 }, { id: 'b', name: 'Pip', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 0, cared: 0, grudges: 0 }];
  s.slots[0] = 'a'; s.slots[1] = 'b';
  s.settings.nudges = true;
  Object.assign(s.mayhem, over);
  return s;
}

test('nothing is planned unless the player has said yes, or there is nobody to nudge about', () => {
  const off = household(); off.settings.nudges = false;
  assert.deepEqual(planNudges(off, NOW), []);
  const empty = blankState(); empty.settings.nudges = true;
  assert.deepEqual(planNudges(empty, NOW), []);
});

test('the next emergency is scheduled on the game’s own clock, and quiet hours push it to the morning', () => {
  const s = household({ nextAt: at(8, 29, 15) });
  const plan = planNudges(s, NOW);
  const emergency = plan.find(n => n.id === NUDGE_IDS.emergency);
  assert.equal(emergency.at, at(8, 29, 15));
  assert.ok(/Agnes|Pip/.test(emergency.body));
  assert.equal(outOfQuiet(at(8, 29, 23, 30)), at(8, 30, 8, 15));
  assert.equal(outOfQuiet(at(8, 29, 3, 0)), at(8, 29, 8, 15));
  assert.equal(outOfQuiet(at(8, 29, 12, 0)), at(8, 29, 12, 0));
  const late = household({ nextAt: at(8, 29, 23, 30) });
  assert.equal(planNudges(late, NOW).find(n => n.id === NUDGE_IDS.emergency).at, at(8, 30, 8, 15));
  // A due-now emergency is nudged a minute out, never in the past.
  const due = household({ nextAt: NOW - 5000 });
  assert.ok(planNudges(due, NOW).find(n => n.id === NUDGE_IDS.emergency).at > NOW);
});

test('waiting cards get one reminder and a full tray stops the emergency clock', () => {
  const s = household({ nextAt: at(8, 29, 15), queue: [{ uid: 1, id: 'ouija', a: 'a', at: NOW }, { uid: 2, id: 'rat-poison', a: 'b', at: NOW }] });
  const waiting = planNudges(s, NOW).find(n => n.id === NUDGE_IDS.waiting);
  assert.equal(waiting.body, '2 emergencies still need a decision.');
  const full = household({ nextAt: at(8, 29, 15), queue: [1, 2, 3].map(uid => ({ uid, id: ['ouija', 'rat-poison', 'grave-in-pot'][uid - 1], a: 'a', at: NOW })) });
  assert.equal(planNudges(full, NOW).some(n => n.id === NUDGE_IDS.emergency), false);
  const one = household({ nextAt: at(8, 29, 15), queue: [{ uid: 1, id: 'ouija', a: 'a', at: NOW }] });
  assert.equal(planNudges(one, NOW).find(n => n.id === NUDGE_IDS.waiting).body, 'One emergency still needs a decision.');
});

test('the candle nudge exists only when a streak is at stake, the omen is unread and it is still before eight', () => {
  const key = localDayKey(NOW);
  const streaky = household({ omen: { day: '', id: '', streak: 4, lastDay: dayKeyOffset(NOW, -1), grace: 1 }, nextAt: at(8, 29, 15) });
  const candle = planNudges(streaky, NOW).find(n => n.id === NUDGE_IDS.candle);
  assert.equal(candle.at, at(8, 29, 20));
  assert.ok(candle.body.includes('Night 5'));
  assert.equal(planNudges(household({ omen: { day: '', id: '', streak: 1, lastDay: '', grace: 1 } }), NOW).some(n => n.id === NUDGE_IDS.candle), false, 'a streak of one is not worth a nudge');
  const read = household({ omen: { day: key, id: 'wet-hand', streak: 4, lastDay: key, grace: 1 } });
  assert.equal(planNudges(read, NOW).some(n => n.id === NUDGE_IDS.candle), false, 'already read today');
  assert.equal(planNudges(streaky, at(8, 29, 21)).some(n => n.id === NUDGE_IDS.candle), false, 'too late tonight');
});

test('the morning line names the docket and challenge for the day it announces', () => {
  const s = household({ nextAt: at(9, 30, 15) });
  const morning = planNudges(s, NOW).find(n => n.id === NUDGE_IDS.morning);
  // Omen unread and it is 10:00, so the next 9:00 is tomorrow.
  assert.equal(morning.at, at(8, 30, 9));
  const day = localDayKey(at(8, 30, 9));
  assert.ok(morning.body.includes(COURT_BY_ID[docketCaseId(day)].title));
  const c = dailyChallenge(day);
  assert.ok(morning.body.includes(ARCADE_BY_ID[c.game].title) && morning.body.includes(c.mod.title));
  // Before nine with an unread omen, the morning line is for today.
  const early = planNudges(household({ nextAt: at(9, 30, 15) }), at(8, 29, 7));
  assert.equal(early.find(n => n.id === NUDGE_IDS.morning).at, at(8, 29, 9));
  // Omen already read today: the next announcement is tomorrow's.
  const key = localDayKey(at(8, 29, 7));
  const read = household({ nextAt: at(9, 30, 15), omen: { day: key, id: 'wet-hand', streak: 1, lastDay: key, grace: 1 } });
  assert.equal(planNudges(read, at(8, 29, 7)).find(n => n.id === NUDGE_IDS.morning).at, at(8, 30, 9));
});

test('the plan is sorted, in the future, and stable for the same inputs', () => {
  const s = household({ nextAt: at(8, 29, 15), queue: [{ uid: 1, id: 'ouija', a: 'a', at: NOW }] });
  const a = planNudges(s, NOW), b = planNudges(s, NOW);
  assert.deepEqual(a, b);
  assert.ok(a.every(n => n.at > NOW));
  assert.deepEqual(a.map(n => n.at), [...a.map(n => n.at)].sort((x, y) => x - y));
  assert.equal(new Set(a.map(n => n.id)).size, a.length);
});

test('syncing replaces what is scheduled, does nothing without the plugin and never throws', async () => {
  const calls = [];
  const plugin = { cancel: async arg => { calls.push(['cancel', arg]); }, schedule: async arg => { calls.push(['schedule', arg]); } };
  const s = household({ nextAt: at(8, 29, 15) });
  const n = await syncNudges(s, plugin, NOW);
  assert.ok(n >= 2);
  assert.equal(calls[0][0], 'cancel'); assert.equal(calls[0][1].notifications.length, Object.keys(NUDGE_IDS).length);
  assert.equal(calls[1][0], 'schedule');
  const first = calls[1][1].notifications[0];
  assert.ok(first.schedule.at instanceof Date && first.schedule.at.getTime() > NOW && first.schedule.allowWhileIdle === true);
  s.settings.nudges = false;
  calls.length = 0;
  assert.equal(await syncNudges(s, plugin, NOW), 0);
  assert.deepEqual(calls.map(c => c[0]), ['cancel'], 'turning nudges off clears what was scheduled');
  assert.equal(await syncNudges(s, null, NOW), 0);
  assert.equal(await syncNudges(household(), { cancel: async () => { throw new Error('boom'); }, schedule: async () => {} }, NOW), 0);
  assert.equal(nudgesAvailable(null), false); assert.equal(nudgesAvailable(plugin), true);
});

test('asking permission returns a plain answer', async () => {
  assert.equal(await enableNudges(null), 'unavailable');
  const granted = { checkPermissions: async () => ({ display: 'prompt' }), requestPermissions: async () => ({ display: 'granted' }) };
  assert.equal(await enableNudges(granted), 'granted');
  const already = { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => { throw new Error('should not ask'); } };
  assert.equal(await enableNudges(already), 'granted');
  const denied = { checkPermissions: async () => ({ display: 'prompt' }), requestPermissions: async () => ({ display: 'denied' }) };
  assert.equal(await enableNudges(denied), 'denied');
  assert.equal(await enableNudges({ checkPermissions: async () => { throw new Error('x'); } }), 'denied');
});

/* ---- the way back, chapters and the weekly chest ---- */
const hourOf = ts => new Date(ts).getHours();
const NODASH = /[\u2013\u2014]/;

test('every nudge id has a category and a label, and the id set is the one the cancel list uses', () => {
  assert.equal(Object.keys(NUDGE_IDS).length, 12);
  assert.deepEqual(Object.keys(NUDGE_CATEGORY).sort(), Object.keys(NUDGE_IDS).sort());
  assert.equal(new Set(Object.values(NUDGE_IDS)).size, 12);
  assert.deepEqual([...new Set(Object.values(NUDGE_CATEGORY))].sort(), [...NUDGE_CATEGORIES].sort());
  for (const c of NUDGE_CATEGORIES) assert.ok(NUDGE_CATEGORY_LABELS[c][0] && NUDGE_CATEGORY_LABELS[c][1]);
});

test('the way back is five notes at a day, three, seven, fourteen and thirty days, and then nothing', () => {
  const s = household({ nextAt: at(8, 29, 15) });
  const plan = planNudges(s, NOW);
  const away = ['away1', 'away3', 'away7', 'away14', 'away30'].map(k => plan.find(n => n.id === NUDGE_IDS[k]));
  assert.ok(away.every(Boolean));
  const days = away.map(n => Math.round((n.at - NOW) / 86400000));
  assert.deepEqual(days, [1, 3, 7, 14, 30]);
  assert.ok(away.every(n => n.at > NOW));
  assert.equal(plan.filter(n => NUDGE_CATEGORY[Object.keys(NUDGE_IDS).find(k => NUDGE_IDS[k] === n.id)] === 'away').length, 5, 'no sixth');
  assert.ok(Math.max(...plan.filter(n => n.id >= NUDGE_IDS.away1 && n.id <= NUDGE_IDS.away30).map(n => n.at)) <= NOW + 31 * 86400000, 'nothing after day thirty');
});

test('the way-back notes keep to the evening or the day, never to quiet hours, and read in the shelf’s voice', () => {
  for (let h = 0; h < 24; h++) {
    const s = household();
    const plan = planNudges(s, at(8, 29, h, 30));
    for (const n of plan) assert.ok(hourOf(n.at) >= 8 && hourOf(n.at) < 22, 'a note at ' + new Date(n.at).toString());
    for (const k of ['away1', 'away3', 'away7', 'away14', 'away30']) {
      const n = plan.find(x => x.id === NUDGE_IDS[k]);
      assert.ok(/Agnes|Pip/.test(n.body) && !n.body.includes('{'), n.body);
      assert.ok(!NODASH.test(n.title + n.body));
    }
  }
});

test('each step has three distinct voices, and the date picks between them', () => {
  for (const [key, pool] of Object.entries(AWAY_LADDER)) {
    assert.equal(pool.length, 3, key);
    assert.equal(new Set(pool.map(p => p[0])).size, 3); assert.equal(new Set(pool.map(p => p[1])).size, 3);
    for (const [title, body] of pool) { assert.ok(title.length <= 40 && body.length <= 150 && body.includes('{name}') , body); assert.ok(!/abandon|neglect|guilt|miss you so|why did you/i.test(body)); }
  }
  const bodies = new Set();
  for (let d = 0; d < 12; d++) bodies.add(planNudges(household(), NOW + d * 86400000).find(n => n.id === NUDGE_IDS.away7).body.replace(/Agnes|Pip/, '{name}'));
  assert.equal(bodies.size, 3, 'all three voices turn up');
  assert.ok(AWAY_LADDER.away30.some(p => /no more/i.test(p[1])), 'the last note says it is the last');
});

test('each category can be turned off on its own, and defaults are all on', () => {
  const s = household({ nextAt: at(8, 29, 15) });
  const kinds = plan => new Set(plan.map(n => NUDGE_CATEGORY[Object.keys(NUDGE_IDS).find(k => NUDGE_IDS[k] === n.id)]));
  assert.deepEqual([...kinds(planNudges(s, NOW))].sort(), ['almanac', 'away', 'emergency']);
  s.settings.nudgeCats = { emergency: false, away: true, almanac: true, chest: true };
  assert.ok(!kinds(planNudges(s, NOW)).has('emergency'));
  assert.ok(kinds(planNudges(s, NOW)).has('away'));
  s.settings.nudgeCats = { emergency: true, away: false, almanac: false, chest: false };
  assert.deepEqual([...kinds(planNudges(s, NOW))], ['emergency']);
  s.settings.nudgeCats = { emergency: false, away: false, almanac: false, chest: false };
  assert.deepEqual(planNudges(s, NOW), []);
  assert.deepEqual(normalizeNudgeCats(undefined), { emergency: true, away: true, almanac: true, chest: true });
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.settings.nudgeCats, s.settings.nudgeCats, 'the choice survives a reload');
});

test('a chapter announces itself on its first day and warns on its last, only if the track is unfinished', () => {
  const s = household({ nextAt: at(9, 30, 15) });
  // Two days before the first chapter (29 September): the opening is scheduled for the day.
  const plan = planNudges(s, NOW);
  const open = plan.find(n => n.id === NUDGE_IDS.chapterStart);
  assert.equal(new Date(open.at).getDate(), 1); assert.equal(new Date(open.at).getMonth(), 9);
  assert.ok(open.body.startsWith('The Thin Season opens today.'));
  assert.ok(!plan.some(n => n.id === NUDGE_IDS.chapterLast), 'no chapter is running yet');
  // On the last day of The Thin Season (2 November), before 17:45, with the track unfinished.
  const lastDay = at(10, 2, 9);
  const last = planNudges(s, lastDay).find(n => n.id === NUDGE_IDS.chapterLast);
  assert.equal(new Date(last.at).getDate(), 2); assert.equal(new Date(last.at).getMonth(), 10);
  assert.equal(last.title, 'The Thin Season ends today');
  assert.ok(/30 tiers/.test(last.body));
  // A finished track needs no warning.
  const done = household({ nextAt: at(10, 30, 15) });
  // (This file’s helper counts months from zero: at(9, 20) is 20 October.)
  syncAlmanac(done, at(9, 20));
  grantXp(done, 99999, at(9, 20));
  assert.ok(!planNudges(done, lastDay).some(n => n.id === NUDGE_IDS.chapterLast));
  assert.ok(planNudges(done, lastDay).some(n => n.id === NUDGE_IDS.chapterStart), 'but the next chapter is announced');
});

test('the weekly chest: a nudge when it is ready, a word before the week closes when it is nearly done, silence otherwise', () => {
  const when = at(10, 7, 10);
  const s = household({ nextAt: at(10, 7, 15) });
  syncAlmanac(s, when);
  assert.ok(!planNudges(s, when).some(n => n.id === NUDGE_IDS.chest), 'nothing done yet');
  const list = weeklyChallenges(weekNumber(when));
  s.almanac.week.done = [list[0].id];
  const nearly = planNudges(s, when).find(n => n.id === NUDGE_IDS.chest);
  assert.equal(new Date(nearly.at).getDay(), 0, 'Sunday');
  assert.ok(nearly.body.startsWith('1 of 3'));
  s.almanac.week.done = list.map(c => c.id);
  const ready = planNudges(s, when).find(n => n.id === NUDGE_IDS.chest);
  assert.equal(ready.title, 'The weekly chest is ready'); assert.ok(ready.at - when <= 4 * 3600000);
  s.almanac.week.chest = 1;
  assert.ok(!planNudges(s, when).some(n => n.id === NUDGE_IDS.chest), 'already opened');
});

test('opening the game cancels the way-back notes, and only those, and never throws', async () => {
  const calls = [];
  const plugin = { cancel: async arg => { calls.push(arg); } };
  assert.equal(await clearAwayNudges(plugin), 5);
  assert.deepEqual(calls[0].notifications.map(n => n.id).sort(), [9111, 9112, 9113, 9114, 9115]);
  assert.equal(await clearAwayNudges(null), 0);
  assert.equal(await clearAwayNudges({ cancel: async () => { throw new Error('boom'); } }), 0);
});

test('a full plan is sorted, in the future, unique and small enough for the phone', () => {
  const s = household({ nextAt: at(8, 29, 15), queue: [{ uid: 1, id: 'ouija', a: 'a', at: NOW }] });
  const plan = planNudges(s, NOW);
  assert.ok(plan.length <= 12 && plan.length >= 8);
  assert.equal(new Set(plan.map(n => n.id)).size, plan.length);
  assert.deepEqual(plan.map(n => n.at), [...plan.map(n => n.at)].sort((x, y) => x - y));
  assert.ok(plan.every(n => n.at > NOW && n.title && n.body));
});
