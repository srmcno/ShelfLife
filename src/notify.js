import { mayhemState } from './mayhem-state.js';
import { queueCap, omenPending } from './engine/mayhem.js';
import { COURT_BY_ID, docketCaseId } from './engine/court.js';
import { dailyChallenge } from './engine/daily.js';
import { ARCADE_BY_ID } from './content/arcade.js';
import { localDayKey } from './state.js';

/* Local nudges for the installed app. Nothing here talks to a server: every
   nudge is scheduled on the phone from what the game already knows (when the
   next emergency is due, whether tonight's omen is face down), so they work
   offline and need no account. The plugin is Capacitor's LocalNotifications;
   on the web there is none, so every function here quietly does nothing. */

export const NUDGE_IDS = { emergency: 9101, waiting: 9102, candle: 9103, morning: 9104 };
const HOUR = 3600000;
const QUIET_FROM = 22, QUIET_TO = 8;

const atLocal = (ts, days, hour, minute = 0) => { const d = new Date(ts); d.setDate(d.getDate() + days); d.setHours(hour, minute, 0, 0); return d.getTime(); };
// Nothing buzzes overnight: a nudge that lands in quiet hours waits for the morning.
export function outOfQuiet(ts) {
  const h = new Date(ts).getHours();
  if (h >= QUIET_FROM) return atLocal(ts, 1, QUIET_TO, 15);
  if (h < QUIET_TO) return atLocal(ts, 0, QUIET_TO, 15);
  return ts;
}

const EMERGENCY_LINES = [
  name => name + ' has found something. Again.',
  name => 'Something is happening near ' + name + '. Nobody has been told.',
  name => name + ' would like a word. It is not a small one.'
];

// What to schedule, as [{ id, at, title, body }], soonest first. Pure: the same
// state and clock always give the same plan.
export function planNudges(state, now = Date.now()) {
  const pets = state?.pets || [];
  if (!pets.length || !state.settings?.nudges) return [];
  const m = mayhemState(state), plan = [];
  const pet = pets[Math.abs(Math.floor(now / 86400000)) % pets.length];

  // The next emergency is due on the game's own clock.
  if (m.queue.length < queueCap(state, now)) {
    const at = outOfQuiet(Math.max(m.nextAt, now + 60000));
    plan.push({ id: NUDGE_IDS.emergency, at, title: 'Something has gone wrong', body: EMERGENCY_LINES[Math.abs(Math.floor(at / HOUR)) % EMERGENCY_LINES.length](pet.name) });
  }
  // A reminder for cards already waiting, once, a few hours on.
  if (m.queue.length) {
    const n = m.queue.length;
    plan.push({ id: NUDGE_IDS.waiting, at: outOfQuiet(now + 3 * HOUR), title: 'The shelf is waiting', body: n === 1 ? 'One emergency still needs a decision.' : n + ' emergencies still need a decision.' });
  }
  // A guttering candle: only worth a nudge when there is a streak to lose.
  const streak = m.omen.streak || 0;
  if (omenPending(state, now) && streak >= 2 && new Date(now).getHours() < 20) {
    plan.push({ id: NUDGE_IDS.candle, at: atLocal(now, 0, 20), title: 'The candle is guttering', body: 'Night ' + (streak + 1) + ' is waiting under a face-down card. Tonight’s omen is still unread.' });
  }
  // One morning line, naming what is new about the day it announces. If today's
  // omen is already read there is nothing to announce before tomorrow.
  let target = atLocal(now, 0, 9);
  if (target <= now || !omenPending(state, now)) target = atLocal(now, 1, 9);
  const docket = COURT_BY_ID[docketCaseId(localDayKey(target))], challenge = dailyChallenge(localDayKey(target));
  if (docket && challenge) {
    plan.push({ id: NUDGE_IDS.morning, at: target, title: 'A new day on the shelf',
      body: 'Tonight’s omen is face down. Shelf Court hears “' + docket.title + '”. The arcade challenge is ' + ARCADE_BY_ID[challenge.game].title + ': ' + challenge.mod.title + '.' });
  }
  return plan.filter(n => n.at > now).sort((a, b) => a.at - b.at);
}

const pluginFor = () => globalThis.Capacitor?.Plugins?.LocalNotifications || null;
export const nudgesAvailable = (plugin = pluginFor()) => !!plugin;

// Ask the phone once, when the player says yes. Resolves 'granted', 'denied' or 'unavailable'.
export async function enableNudges(plugin = pluginFor()) {
  if (!plugin) return 'unavailable';
  try {
    let status = (await plugin.checkPermissions())?.display;
    if (status !== 'granted') status = (await plugin.requestPermissions())?.display;
    return status === 'granted' ? 'granted' : 'denied';
  } catch { return 'denied'; }
}

// Replace whatever is scheduled with the current plan. Call when the game goes to the background.
export async function syncNudges(state, plugin = pluginFor(), now = Date.now()) {
  if (!plugin) return 0;
  try {
    await plugin.cancel({ notifications: Object.values(NUDGE_IDS).map(id => ({ id })) });
    const plan = planNudges(state, now);
    if (!plan.length) return 0;
    await plugin.schedule({ notifications: plan.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, channelId: 'shelf' })) });
    return plan.length;
  } catch { return 0; }
}
