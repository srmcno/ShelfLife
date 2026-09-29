import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, localDayKey, dayKeyOffset } from '../src/state.js';
import { COURT_BY_ID, docketCaseId } from '../src/engine/court.js';
import { dailyChallenge } from '../src/engine/daily.js';
import { ARCADE_BY_ID } from '../src/content/arcade.js';
import { planNudges, outOfQuiet, syncNudges, enableNudges, nudgesAvailable, NUDGE_IDS } from '../src/notify.js';

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
