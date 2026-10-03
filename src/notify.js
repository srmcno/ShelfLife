import { mayhemState } from './mayhem-state.js';
import { queueCap, omenPending } from './engine/mayhem.js';
import { COURT_BY_ID, docketCaseId } from './engine/court.js';
import { dailyChallenge } from './engine/daily.js';
import { ARCADE_BY_ID } from './content/arcade.js';
import { localDayKey } from './state.js';
import { chapterAt, nextChapter, daysLeft, chapterRecord, tierFor, weeklyView } from './engine/almanac.js';
import { dayNumber } from './engine/daily.js';
import { AWAY_LADDER, CHAPTER_START_BODY, CHAPTER_LAST_BODY, CHEST_READY_BODY, CHEST_WEEK_BODY } from './content/nudges.js';
import { TIERS } from './content/almanac.js';

/* Local nudges for the installed app. Nothing here talks to a server: every
   nudge is scheduled on the phone from what the game already knows (when the
   next emergency is due, whether tonight's omen is face down), so they work
   offline and need no account. The plugin is Capacitor's LocalNotifications;
   on the web there is none, so every function here quietly does nothing. */

export const NUDGE_IDS = {
  emergency: 9101, waiting: 9102, candle: 9103, morning: 9104,
  // The way back for a player who has been away: a day, three, a week, a fortnight, a month. Then nothing.
  away1: 9111, away3: 9112, away7: 9113, away14: 9114, away30: 9115,
  // From the Almanac’s calendar and the week.
  chapterStart: 9121, chapterLast: 9122, chest: 9123
};
// Each nudge belongs to one category, and each category can be turned off on its own (More, Nudges).
export const NUDGE_CATEGORY = {
  emergency: 'emergency', waiting: 'emergency', candle: 'emergency', morning: 'emergency',
  away1: 'away', away3: 'away', away7: 'away', away14: 'away', away30: 'away',
  chapterStart: 'almanac', chapterLast: 'almanac', chest: 'chest'
};
export const NUDGE_CATEGORY_LABELS = {
  emergency: ['Emergencies', 'When something goes wrong, or is still waiting'],
  away: ['Coming back', 'A few quiet notes after a day, three, a week, a fortnight and a month away. Then no more.'],
  almanac: ['The Almanac', 'When a chapter opens and on its last day'],
  chest: ['Weekly chest', 'When it is ready, or the week is about to close']
};
const AWAY_STEPS = [['away1', 1, 18, 40], ['away3', 3, 17, 20], ['away7', 7, 12, 10], ['away14', 14, 19, 10], ['away30', 30, 18, 0]];
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
  const cats = state.settings.nudgeCats || {};
  const on = category => cats[category] !== false;
  const plan = [];
  if (on('emergency')) plan.push(...gameNudges(state, now));
  if (on('away')) plan.push(...awayNudges(state, now));
  if (on('almanac')) plan.push(...chapterNudges(state, now));
  if (on('chest')) plan.push(...chestNudges(state, now));
  return plan.filter(n => n.at > now).sort((a, b) => a.at - b.at);
}

// The first four, as they have always been: the next emergency, a waiting reminder, the candle and the morning line.
function gameNudges(state, now) {
  const pets = state.pets;
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
  return plan;
}

// The way back. Five notes after you were last here, at a day, three, seven, fourteen and thirty days, in the
// evening or the middle of the day, never in quiet hours, and none after the thirtieth. Every one is cancelled
// the moment the game is opened (clearAwayNudges), so nobody is nudged while they are already here.
export function awayNudges(state, now) {
  const pets = state.pets, base = Math.floor(now / 86400000);
  return AWAY_STEPS.map(([key, days, hour, minute]) => {
    const pool = AWAY_LADDER[key], variant = Math.abs(base + days * 7) % pool.length;
    const name = pets[Math.abs(base + days) % pets.length].name;
    const [title, body] = pool[variant];
    return { id: NUDGE_IDS[key], at: outOfQuiet(atLocal(now, days, hour, minute)), title, body: body.replace(/\{name\}/g, name) };
  });
}

// A new chapter on the day it opens, and the last day of the running one if its track is unfinished.
export function chapterNudges(state, now) {
  const plan = [], chapter = chapterAt(now), next = nextChapter(now);
  if (next) {
    const wait = next.fromNo - dayNumber(localDayKey(now));
    if (wait >= 0 && wait <= 45) plan.push({ id: NUDGE_IDS.chapterStart, at: outOfQuiet(atLocal(now, wait, 10, 5)), title: 'A new chapter of the Almanac', body: CHAPTER_START_BODY(next) });
  }
  if (chapter) {
    const left = daysLeft(chapter, now), tier = tierFor(chapterRecord(state, chapter).xp, chapter.days);
    if (left >= 1 && tier < TIERS) plan.push({ id: NUDGE_IDS.chapterLast, at: outOfQuiet(atLocal(now, left - 1, 17, 45)), title: chapter.name + ' ends today', body: CHAPTER_LAST_BODY(chapter, TIERS - tier) });
  }
  return plan;
}

// The weekly chest: a nudge when it is ready, or a word before the week closes with one challenge to go.
export function chestNudges(state, now) {
  const week = weeklyView(state, now);
  if (week.chest.ready) return [{ id: NUDGE_IDS.chest, at: outOfQuiet(now + 3 * HOUR), title: 'The weekly chest is ready', body: CHEST_READY_BODY }];
  const done = week.items.filter(c => c.done).length;
  if (done >= 1 && done < 3 && !week.chest.claimed) return [{ id: NUDGE_IDS.chest, at: outOfQuiet(atLocal(now, week.endsIn - 1, 17, 0)), title: 'The week is nearly over', body: CHEST_WEEK_BODY(done) }];
  return [];
}

const pluginFor = () => globalThis.Capacitor?.Plugins?.LocalNotifications || null;
// Android drops a notification posted to a channel that does not exist, so the
// channel is (re)made before scheduling. Making it again is harmless.
export const NUDGE_CHANNEL = { id: 'shelf', name: 'Nudges', description: 'When something on the shelf needs you', importance: 3 };
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
    if (plugin.createChannel) await plugin.createChannel(NUDGE_CHANNEL);
    // Inexact on purpose: the app does not ask for the exact-alarm permission,
    // and a nudge a few minutes late is still a nudge.
    await plugin.schedule({ notifications: plan.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, channelId: NUDGE_CHANNEL.id, isExactNotification: false })) });
    return plan.length;
  } catch { return 0; }
}

// Opening the game cancels the way-back notes at once: they are for someone who is not here.
export async function clearAwayNudges(plugin = pluginFor()) {
  if (!plugin) return 0;
  try {
    const ids = Object.entries(NUDGE_CATEGORY).filter(([, c]) => c === 'away').map(([k]) => ({ id: NUDGE_IDS[k] }));
    await plugin.cancel({ notifications: ids });
    return ids.length;
  } catch { return 0; }
}
