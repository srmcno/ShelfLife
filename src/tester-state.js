// What the save remembers for the testing tools. Pure: no DOM, no clock of
// its own, no imports from state.js (state.js imports this).
//
//   state.tester   true once anything has bent time or handed out souls from
//                  the tester panel. It never goes back to false. A tester save
//                  never sends daily challenge scores or Court verdict stars.
//   state.testing  { seenVersion, pulse: { done, notNow }, countDays }
//                  seenVersion  the last version whose What's new was handled
//                  pulse.done   check-in moments already asked: [{ id, outcome }]
//                  pulse.notNow how many times "Not now" was chosen; two means never again
//                  countDays    false when the player switched off counting play days
//
// Both are additive and bounded (three moments at most). normalizeState() in
// state.js calls normalizeTesting, so old saves load unchanged.

import { compareVersions } from './version.js';

const DAY = 86400000;
export const PULSE_MOMENTS = ['day2', 'court', 'day7'];
const OUTCOMES = ['sent', 'notnow', 'skipped'];
export const PULSE_GIVE_UP = 2;

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function blankTesting() {
  return { seenVersion: '', pulse: { done: [], notNow: 0 }, countDays: true };
}

export function normalizeTesting(raw) {
  const out = blankTesting();
  if (!record(raw)) return out;
  if (typeof raw.seenVersion === 'string' && /^\d{1,3}\.\d{1,2}\.\d{1,2}$/.test(raw.seenVersion)) out.seenVersion = raw.seenVersion;
  const pulse = record(raw.pulse) ? raw.pulse : {};
  const seen = new Set();
  out.pulse.done = (Array.isArray(pulse.done) ? pulse.done : [])
    .filter(d => record(d) && PULSE_MOMENTS.includes(d.id) && !seen.has(d.id) && seen.add(d.id))
    .map(d => ({ id: d.id, outcome: OUTCOMES.includes(d.outcome) ? d.outcome : 'skipped' }));
  out.pulse.notNow = Number.isFinite(pulse.notNow) ? Math.max(0, Math.min(PULSE_GIVE_UP, Math.floor(pulse.notNow))) : 0;
  out.countDays = raw.countDays !== false;
  return out;
}

// The live record, created on first use (a brand new shelf has not been
// through normalizeState yet).
export function testingState(state) {
  if (!record(state.testing) || !record(state.testing.pulse) || !Array.isArray(state.testing.pulse.done)) state.testing = normalizeTesting(state.testing);
  return state.testing;
}

export const isTesterSave = state => state?.tester === true;
// The two places a save talks to shared boards: src/ui/arcade.js (daily
// challenge scores) and src/ui/court.js (the stars on a friend's verdict).
export const mayPostScore = state => !isTesterSave(state);
export const postedStars = (state, stars) => (isTesterSave(state) ? 0 : stars);
export function markTester(state) {
  const was = state.tester === true;
  state.tester = true;
  return !was;
}

export function daysSinceStart(state, now = Date.now()) {
  const started = Number.isFinite(state?.started) ? state.started : now;
  return Math.max(0, Math.floor((now - started) / DAY));
}

/* ---------------- What's new ---------------- */

// 'show' after an update to an established household, 'quiet' for a brand
// new install (nothing to compare against), 'none' when already handled.
export function whatsNewCheck(state, version) {
  const t = testingState(state);
  if (t.seenVersion && compareVersions(t.seenVersion, version) >= 0) return 'none';
  return (state.pets || []).length ? 'show' : 'quiet';
}
export function markVersionSeen(state, version) {
  const t = testingState(state);
  if (!t.seenVersion || compareVersions(version, t.seenVersion) > 0) t.seenVersion = version;
  return t.seenVersion;
}

/* ---------------- "How is it going?" ---------------- */

function reached(state, id, now) {
  if (id === 'day2') return daysSinceStart(state, now) >= 2;
  if (id === 'day7') return daysSinceStart(state, now) >= 7;
  if (id === 'court') return (Number(state.courtroom?.episodes) || 0) >= 1;
  return false;
}

// The moment to ask about now, or null. A household that is past day seven
// is not asked about day two as well: the later question covers it.
export function duePulse(state, now = Date.now()) {
  if (!(state?.pets || []).length) return null;
  const t = testingState(state);
  if (t.pulse.notNow >= PULSE_GIVE_UP) return null;
  const asked = new Set(t.pulse.done.map(d => d.id));
  for (const id of ['day7', 'court', 'day2']) if (!asked.has(id) && reached(state, id, now)) return id;
  return null;
}

// 'sent' or 'notnow'. Either way the moment is never asked again.
export function recordPulse(state, id, outcome) {
  if (!PULSE_MOMENTS.includes(id)) return false;
  const t = testingState(state);
  if (t.pulse.done.some(d => d.id === id)) return false;
  t.pulse.done.push({ id, outcome: outcome === 'sent' ? 'sent' : 'notnow' });
  if (id === 'day7' && !t.pulse.done.some(d => d.id === 'day2')) t.pulse.done.push({ id: 'day2', outcome: 'skipped' });
  if (outcome !== 'sent') t.pulse.notNow = Math.min(PULSE_GIVE_UP, t.pulse.notNow + 1);
  return true;
}

export const PULSE_QUESTIONS = {
  day2: 'Two days in. How is the shelf treating you?',
  court: 'You have sat through your first Shelf Court. How was it?',
  day7: 'A week of this. How is it going?'
};
