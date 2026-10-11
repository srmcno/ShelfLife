// Tools for testers, without a browser: the error buffer, diagnostics (no
// email, no save contents), What's new and check-in gating, the tester flag,
// the tester clock and the feedback client against the in-memory Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { errorEntry, recordError, readErrors, clearErrors, shortSource, stackSource, installErrorCapture, ERRORS_KEY, MAX_ERRORS } from '../src/errors.js';
import { collectDiagnostics, buildReport, reportText, diagnosticRows, cloudState, sheetName, DIAGNOSTICS_LIMIT } from '../src/diagnostics.js';
import { normalizeTesting, testingState, whatsNewCheck, markVersionSeen, duePulse, recordPulse, isTesterSave, markTester, mayPostScore, postedStars, daysSinceStart } from '../src/tester-state.js';
import { cleanOffset, readOffset, setClockOffset, installClock, CLOCK_KEY, DAY_MS } from '../src/clock.js';
import { createFeedback, cleanReport, feedbackText, FEEDBACK_KEY, MAX_QUEUE } from '../src/cloud/feedback.js';
import { createCloud } from '../src/cloud/client.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { householdFixture } from './household-fixtures.mjs';
import { normalizeState, blankState } from '../src/state.js';
import { VERSION } from '../src/version.js';
import { TESTER_NOTES } from '../src/content/tester-notes.js';
import { replayGuide, advanceGuide, guideView, deskStage } from '../src/engine/guide.js';

function memory(initial = {}) {
  const items = new Map(Object.entries(initial));
  return { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k), items };
}
const DAY = 86400000;
const HERE = 'https://srmcno.github.io/ShelfLife/';

/* ---------------- the error buffer ---------------- */

test('errors are kept as message, file, line and time, and nothing else', () => {
  const store = memory();
  const entry = recordError({ message: 'TypeError: Cannot read properties of undefined (reading \'name\')', filename: HERE + 'src/ui/court.js?v=2', lineno: 251, colno: 7, extra: { pets: ['Agnes'] } }, { store, now: 1000, here: HERE });
  assert.deepEqual(entry, { message: 'TypeError: Cannot read properties of undefined (reading \'name\')', source: 'src/ui/court.js:251:7', at: 1000, count: 1 });
  assert.deepEqual(Object.keys(readErrors(store)[0]).sort(), ['at', 'count', 'message', 'source']);
  assert.equal(shortSource('chrome-extension://abc/content.js', HERE), 'chrome-extension');
  assert.equal(shortSource('https://evil.example/x.js', HERE), 'evil.example', 'another site is named by host only');
  assert.equal(shortSource(HERE + 'index.html#cabinet', HERE), 'index.html');
  assert.deepEqual(stackSource('Error: x\n    at f (' + HERE + 'src/main.js:10:5)', HERE), { file: 'src/main.js', line: 10, column: 5 });
  assert.deepEqual(stackSource('f@' + HERE + 'src/state.js:4:2', HERE), { file: 'src/state.js', line: 4, column: 2 });
  assert.equal(errorEntry({ message: 'ResizeObserver loop completed with undelivered notifications.' }), null, 'browser noise is ignored');
  assert.equal(errorEntry({ message: 'x'.repeat(900) }).message.length, 300, 'messages are clamped');
});

test('the ring keeps the last 20, counts quick repeats, survives bad storage and clears', () => {
  const store = memory();
  for (let i = 0; i < 25; i++) recordError({ message: 'Error ' + i, filename: HERE + 'src/a.js', lineno: i }, { store, now: i * 10000, here: HERE });
  const list = readErrors(store);
  assert.equal(list.length, MAX_ERRORS);
  assert.equal(list[0].message, 'Error 5');
  assert.equal(list.at(-1).message, 'Error 24');
  recordError({ message: 'Same', filename: HERE + 'src/a.js', lineno: 1 }, { store, now: 500000, here: HERE });
  recordError({ message: 'Same', filename: HERE + 'src/a.js', lineno: 1 }, { store, now: 500500, here: HERE });
  assert.equal(readErrors(store).at(-1).count, 2, 'a burst is one entry with a count');
  assert.equal(readErrors(store).length, MAX_ERRORS);
  store.setItem(ERRORS_KEY, '{not json');
  assert.deepEqual(readErrors(store), [], 'an unreadable list is an empty list, not a crash');
  store.setItem(ERRORS_KEY, JSON.stringify([{ message: 'kept', source: 's', at: 5 }, { nonsense: true }, 'string']));
  assert.deepEqual(readErrors(store).map(e => e.message), ['kept']);
  clearErrors(store);
  assert.deepEqual(readErrors(store), []);
});

test('capture listens for uncaught errors and unhandled rejections, once', () => {
  const handlers = {}, win = { addEventListener: (name, fn) => { handlers[name] = (handlers[name] || []).concat(fn); } };
  assert.equal(installErrorCapture(win), true);
  assert.equal(installErrorCapture(win), false, 'idempotent');
  assert.deepEqual(Object.keys(handlers).sort(), ['error', 'unhandledrejection']);
  assert.equal(handlers.error.length, 1);
});

/* ---------------- diagnostics ---------------- */

function signedInCloud(email = 'secret.person@example.com') {
  return { configured: true, signedIn: () => true, isAnonymous: () => !email, email: () => email, userId: () => 'u1', session: () => ({ user: { email } }) };
}
function fullEnv() {
  return { platform: 'android', userAgent: 'Mozilla/5.0 (Linux; Android 14) Test', screen: { width: 412, height: 915 }, viewport: { width: 412, height: 839 },
    dpr: 2.625, online: true, effectsMode: 'light', bench: { tier: 'light', median: 25.4, p90: 41.2, run: 'shelf', at: 1 }, sheet: 'courtVeil', saveBytes: 51200, clockDays: 2 };
}

test('diagnostics say what the brief asks for, and never the email or the shelf', () => {
  const state = householdFixture('established', Date.now());
  state.settings.calm = true;
  state.pets[0].name = 'Bartholomew Uniquename';
  state.notes.unshift({ text: 'A deeply private note about the raisin', from: 'the shelf', kind: 'note', at: Date.now() });
  const errors = [{ message: 'TypeError: boom', source: 'src/ui/court.js:1:2', at: Date.UTC(2026, 9, 11, 12), count: 3 }];
  const d = collectDiagnostics({ state, env: fullEnv(), cloud: signedInCloud(), errors, now: Date.now() });
  assert.equal(d.version, VERSION);
  assert.equal(d.platform, 'android');
  assert.equal(d.userAgent, 'Mozilla/5.0 (Linux; Android 14) Test');
  assert.equal(d.screen, '412x915');
  assert.equal(d.viewport, '412x839');
  assert.equal(d.dpr, 2.63);
  assert.deepEqual(d.effects, { setting: state.settings.effects, mode: 'light', benchmark: { tier: 'light', median: 25.4, p90: 41.2, run: 'shelf' } });
  assert.equal(d.calm, true);
  assert.equal(d.residents, state.pets.length);
  assert.equal(d.days, 7);
  assert.equal(d.saveKB, 50);
  assert.equal(d.sheet, 'Shelf Court');
  assert.equal(d.online, true);
  assert.equal(d.cloud, 'email', 'whether there is an email, never which');
  assert.equal(d.clockDays, 2);
  assert.deepEqual(d.errors, [{ message: 'TypeError: boom', source: 'src/ui/court.js:1:2', at: '2026-10-11T12:00:00.000Z', count: 3 }]);
  const text = JSON.stringify(d) + reportText(buildReport({ kind: 'bug', body: '', diagnostics: d }));
  for (const secret of ['secret.person', 'example.com', 'Bartholomew', 'raisin', 'Agnes', state.pets[1].name, 'data:image']) assert.ok(!text.includes(secret), 'no ' + secret);
  assert.ok(JSON.stringify(d).length < DIAGNOSTICS_LIMIT);
});

test('diagnostics stay under the server limit even with twenty enormous errors', () => {
  const errors = Array.from({ length: 20 }, (_, i) => ({ message: 'x'.repeat(5000) + i, source: 'y'.repeat(5000), at: i }));
  const d = collectDiagnostics({ state: blankState(), env: { ...fullEnv(), userAgent: 'z'.repeat(5000) }, errors });
  assert.ok(JSON.stringify(d).length <= DIAGNOSTICS_LIMIT);
  assert.equal(d.errors.length, 20, 'clamped messages still fit all twenty');
  assert.equal(d.userAgent.length, 300);
});

test('the cloud state is one of four words, and minimal diagnostics carry only the basics', () => {
  assert.equal(cloudState(null), 'not set up');
  assert.equal(cloudState({ configured: true, signedIn: () => false }), 'off');
  assert.equal(cloudState(signedInCloud('')), 'guest');
  assert.equal(cloudState(signedInCloud()), 'email');
  assert.equal(sheetName(''), 'none');
  assert.equal(sheetName('mysteryVeil'), 'mystery');
  const d = collectDiagnostics({ state: householdFixture('established'), env: fullEnv(), cloud: signedInCloud(), minimal: true });
  assert.deepEqual(Object.keys(d).sort(), ['build', 'days', 'platform', 'residents', 'version']);
});

test('a report is clamped, typed and readable, and the readable text matches what is sent', () => {
  const d = collectDiagnostics({ state: householdFixture('established'), env: fullEnv(), cloud: null, errors: [] });
  const report = buildReport({ kind: 'confusing', body: 'a'.repeat(1500), doing: 'court', diagnostics: d, now: Date.UTC(2026, 9, 11) });
  assert.equal(report.body.length, 1000);
  assert.match(report.client_id, /^fb-[a-z0-9]+-[a-z0-9]{8}$/);
  assert.equal(report.platform, 'android');
  assert.equal(report.rating, null, 'only a check-in has a rating');
  assert.equal(buildReport({ kind: 'rant' }).kind, 'bug');
  assert.equal(buildReport({ kind: 'bug', doing: 'hacking' }).doing, '');
  assert.equal(buildReport({ kind: 'pulse', rating: 4, moment: 'day7' }).rating, 4);
  const text = reportText(report);
  for (const [label, value] of diagnosticRows(d)) assert.ok(text.includes(label + ': ' + value), label);
  assert.ok(text.includes('Doing: Shelf Court'));
  assert.ok(text.includes('Report id: ' + report.client_id));
  assert.match(reportText(buildReport({ kind: 'idea', body: 'x' })), /Diagnostics: not attached/);
});

/* ---------------- the save's side ---------------- */

test('old saves load unchanged, and the new fields are normalized and bounded', () => {
  const old = householdFixture('established');
  delete old.tester; delete old.testing;
  const loaded = normalizeState(JSON.parse(JSON.stringify(old)));
  assert.equal(loaded.tester, false);
  assert.deepEqual(loaded.testing, { seenVersion: '', pulse: { done: [], notNow: 0 }, countDays: true });
  const hostile = normalizeState({ ...old, tester: 'yes', testing: { seenVersion: '<script>', pulse: { done: [{ id: 'day2', outcome: 'sent' }, { id: 'day2' }, { id: 'nope' }, 'x', { id: 'court', outcome: 'weird' }], notNow: 99 }, countDays: 0, extra: 'x'.repeat(10) } });
  assert.equal(hostile.tester, false, 'only true counts');
  assert.deepEqual(hostile.testing, { seenVersion: '', pulse: { done: [{ id: 'day2', outcome: 'sent' }, { id: 'court', outcome: 'skipped' }], notNow: 2 }, countDays: true });
  const again = normalizeState(JSON.parse(JSON.stringify(hostile)));
  assert.deepEqual(again.testing, hostile.testing, 'idempotent');
  assert.equal(normalizeState({ ...old, tester: true }).tester, true, 'a tester save stays one through a backup');
  assert.equal(normalizeTesting({ countDays: false }).countDays, false);
});

test('What’s new: after an update once, never on a brand-new install, never twice', () => {
  const established = householdFixture('established');
  assert.equal(whatsNewCheck(established, VERSION), 'show');
  markVersionSeen(established, VERSION);
  assert.equal(whatsNewCheck(established, VERSION), 'none');
  assert.equal(whatsNewCheck(established, '9.0.0'), 'show', 'the next update shows again');
  markVersionSeen(established, '0.1.0');
  assert.equal(testingState(established).seenVersion, VERSION, 'never goes backwards');
  const fresh = blankState();
  assert.equal(whatsNewCheck(fresh, VERSION), 'quiet', 'a new install has nothing to compare against');
  markVersionSeen(fresh, VERSION);
  fresh.pets.push({ id: 'p1' });
  assert.equal(whatsNewCheck(fresh, VERSION), 'none', 'and its first resident does not bring the sheet with it');
});

test('check-ins: three moments at most, never twice, and Not now twice means never again', () => {
  const now = Date.now();
  const s = householdFixture('established', now);
  s.started = now - 1 * DAY;
  s.courtroom.episodes = 0;
  assert.equal(duePulse(s, now), null, 'day one: nothing');
  s.started = now - 2 * DAY;
  assert.equal(duePulse(s, now), 'day2');
  assert.equal(recordPulse(s, 'day2', 'sent'), true);
  assert.equal(recordPulse(s, 'day2', 'sent'), false, 'never twice');
  assert.equal(duePulse(s, now), null);
  s.courtroom.episodes = 1;
  assert.equal(duePulse(s, now), 'court');
  recordPulse(s, 'court', 'notnow');
  s.started = now - 7 * DAY;
  assert.equal(duePulse(s, now), 'day7');
  recordPulse(s, 'day7', 'notnow');
  assert.equal(testingState(s).pulse.notNow, 2);
  assert.equal(duePulse(s, now), null);
  const quitter = householdFixture('established', now);
  quitter.courtroom.episodes = 3;
  quitter.started = now - 3 * DAY;
  recordPulse(quitter, duePulse(quitter, now), 'notnow');
  recordPulse(quitter, duePulse(quitter, now), 'notnow');
  quitter.started = now - 8 * DAY;
  assert.equal(duePulse(quitter, now), null, 'two Not nows and the day-seven question never comes');
  const late = householdFixture('established', now);
  late.courtroom.episodes = 0;
  late.started = now - 20 * DAY;
  assert.equal(duePulse(late, now), 'day7', 'a long-established shelf is asked the latest question');
  recordPulse(late, 'day7', 'sent');
  assert.equal(duePulse(late, now), null, 'and is not then asked about day two');
  assert.equal(duePulse(blankState(), now), null, 'nobody to ask about');
  assert.equal(daysSinceStart({ started: now - 3.5 * DAY }, now), 3);
});

test('a tester save never posts scores or verdict stars, and stays a tester save', () => {
  const s = householdFixture('established');
  assert.equal(isTesterSave(s), false);
  assert.equal(mayPostScore(s), true);
  assert.equal(postedStars(s, 3), 3);
  assert.equal(markTester(s), true);
  assert.equal(markTester(s), false);
  assert.equal(mayPostScore(s), false);
  assert.equal(postedStars(s, 3), 0);
  // The guards are where the client talks to the boards.
  const arcade = readFileSync(new URL('../src/ui/arcade.js', import.meta.url), 'utf8');
  const court = readFileSync(new URL('../src/ui/court.js', import.meta.url), 'utf8');
  assert.match(arcade, /if \(score > 0 && mayPostScore\(S\)\) \{\s*try \{\s*await social\.submitScore\(/);
  assert.equal((arcade.match(/submitScore\(/g) || []).length, 1, 'no other route to the scoreboard');
  assert.match(court, /courtSocial\.rule\([^;]*stars: postedStars\(S, res\.stars\)/);
  assert.equal((court.match(/courtSocial\.rule\(/g) || []).length, 1);
});

/* ---------------- the tester clock ---------------- */

test('the clock offset is whole days, capped, stored outside the save, and patches Date only when set', () => {
  assert.equal(cleanOffset(DAY_MS * 1.4), DAY_MS);
  assert.equal(cleanOffset(-DAY_MS), 0);
  assert.equal(cleanOffset('nonsense'), 0);
  assert.equal(cleanOffset(DAY_MS * 500), 60 * DAY_MS);
  const store = memory();
  assert.equal(setClockOffset(2 * DAY_MS, store), 2 * DAY_MS);
  assert.equal(readOffset(store), 2 * DAY_MS);
  assert.equal(JSON.parse(store.getItem(CLOCK_KEY)).offset, 2 * DAY_MS);
  setClockOffset(0, store);
  assert.equal(store.getItem(CLOCK_KEY), null);
  assert.equal(installClock(0), false, 'no offset, no patch');
  assert.equal(globalThis.Date.name, 'Date');
  const RealDate = globalThis.Date;
  try {
    assert.equal(installClock(DAY_MS), true);
    const shifted = new Date().getTime() - RealDate.now();
    assert.ok(Math.abs(shifted - DAY_MS) < 1000, 'new Date() is a day on');
    assert.ok(Math.abs(Date.now() - RealDate.now() - DAY_MS) < 1000, 'Date.now() too');
    assert.equal(new Date(0).getTime(), 0, 'dates from a value are untouched');
    assert.equal(Date.UTC(2026, 0, 1), RealDate.UTC(2026, 0, 1));
    assert.ok(new Date() instanceof RealDate);
  } finally { globalThis.Date = RealDate; }
});

/* ---------------- the feedback client ---------------- */

async function world() {
  const fake = createFakeSupabase();
  const storage = memory();
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory() });
  const feedback = createFeedback({ cloud, storage });
  return { fake, cloud, feedback, storage };
}
const report = (over = {}) => buildReport({ kind: 'bug', body: 'The raisin funeral never ended.', diagnostics: collectDiagnostics({ state: householdFixture('established'), env: fullEnv() }), ...over });

test('signed out, a report waits on the device and goes on the next sign-in; nobody is signed in silently', async () => {
  const { fake, cloud, feedback, storage } = await world();
  assert.equal(await feedback.submit(report()), 'queued');
  assert.equal(await feedback.submit(report({ kind: 'pulse', rating: 2, moment: 'day2', body: '' })), 'queued');
  assert.equal(feedback.queued().length, 2);
  assert.equal(fake.requests.length, 0, 'not a single request while signed out');
  assert.equal(cloud.signedIn(), false);
  assert.ok(JSON.parse(storage.getItem(FEEDBACK_KEY)).queue.length === 2, 'kept outside the save');
  await feedback.flush();
  assert.equal(fake.requests.length, 0, 'flush without a session does nothing');
  await cloud.signInAnonymously();
  assert.deepEqual(await feedback.flush(), { sent: 2, left: 0 });
  assert.deepEqual(fake.feedback.feedback.map(f => [f.kind, f.rating, f.moment]), [['bug', null, ''], ['pulse', 2, 'day2']]);
  assert.equal(fake.feedback.feedback[0].diagnostics.platform, 'android');
});

test('signed in, a report goes straight away, once, and the queue is capped', async () => {
  const { fake, cloud, feedback } = await world();
  await cloud.signInAnonymously();
  const one = report();
  assert.equal(await feedback.submit(one), 'sent');
  assert.equal(await feedback.submit(one), 'sent', 'a resend is answered as a duplicate');
  assert.equal(fake.feedback.feedback.length, 1);
  fake.setOffline(true);
  assert.equal(await feedback.submit(report()), 'queued', 'offline: kept, not lost');
  fake.setOffline(false);
  assert.deepEqual(await feedback.flush(), { sent: 1, left: 0 });
  const { feedback: offlineBox } = await world();
  for (let i = 0; i < MAX_QUEUE + 4; i++) await offlineBox.submit(report({ body: 'number ' + i }));
  assert.equal(offlineBox.queued().length, MAX_QUEUE);
  assert.equal(offlineBox.queued()[0].body, 'number 4', 'the oldest go first');
});

test('the daily limit and refusals come back as words, and a refused report is not retried forever', async () => {
  const { fake, cloud, feedback } = await world();
  await cloud.signInAnonymously();
  for (let i = 0; i < 10; i++) assert.equal(await feedback.submit(report()), 'sent');
  await assert.rejects(feedback.submit(report()), error => error.code === 'rate_limited' && /ten reports today/.test(error.message));
  assert.match(feedbackText({ code: 'P0001', message: 'too_large' }), /too large/);
  assert.match(feedbackText({ code: 'P0001', message: 'bad_kind' }), /would not take/);
  assert.equal(cleanReport({ client_id: 'NOPE', kind: 'bug' }), null);
  assert.equal(cleanReport({ client_id: 'fb-12345678', kind: 'pulse', rating: 9 }), null);
  fake.feedback.feedback.length = 0;
  // A queued report the server will never accept is dropped, and the rest still go.
  const { feedback: box, cloud: c2, fake: f2 } = await world();
  await box.submit(report({ body: 'first' }));
  // Short enough in characters for the client, too many bytes for the server.
  await box.submit({ ...report({ body: 'second' }), diagnostics: { blob: '\u20ac'.repeat(5400) } });
  await box.submit(report({ body: 'third' }));
  await c2.signInAnonymously();
  const result = await box.flush();
  assert.deepEqual(result, { sent: 2, left: 0 });
  assert.deepEqual(f2.feedback.feedback.map(f => f.body), ['first', 'third']);
});

test('play days: once a day, only signed in, only while allowed, and forgettable', async () => {
  const { fake, cloud, feedback } = await world();
  assert.equal(await feedback.markPlayDay(), false, 'signed out: nothing');
  assert.equal(fake.requests.length, 0);
  await cloud.signInAnonymously();
  assert.equal(await feedback.markPlayDay({ allowed: false }), false, 'switched off: nothing');
  assert.equal(fake.calls('mark_play_day').length, 0);
  assert.equal(await feedback.markPlayDay(), true);
  assert.equal(await feedback.markPlayDay(), false, 'once per local day');
  assert.equal(fake.calls('mark_play_day').length, 1);
  assert.equal(fake.feedback.playDays.length, 1);
  assert.match(fake.feedback.playDays[0].day, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fake.feedback.playDays[0].day, JSON.parse(fake.calls('mark_play_day')[0].body).p_day, 'a real calendar date, not the game’s month-from-zero key');
  fake.setOffline(true);
  assert.equal(await feedback.forgetPlayDays(), false);
  fake.setOffline(false);
  assert.equal(await feedback.retryForget(), true, 'remembered and retried');
  assert.equal(fake.feedback.playDays.length, 0);
  assert.equal(await feedback.retryForget(), false, 'and only once');
});

test('the tester notes are there for the owner to edit, in the house style', () => {
  assert.ok(TESTER_NOTES.tryThisWeek.length >= 3);
  for (const line of [TESTER_NOTES.intro, TESTER_NOTES.week, ...TESTER_NOTES.tryThisWeek, ...TESTER_NOTES.howToReport, ...TESTER_NOTES.howToReset]) {
    assert.equal(typeof line, 'string');
    assert.doesNotMatch(line, /[\u2013\u2014<>]/, 'no dashes, no HTML');
  }
});

test('replaying the first-day tour starts at step one and counts only what happens next', () => {
  const now = Date.now();
  const s = normalizeState(householdFixture('established', now));
  s.mayhem.resolved = 5; s.mayhem.coffins = 2;
  assert.equal(deskStage(s, now), 3);
  replayGuide(s, now);
  assert.equal(advanceGuide(s, now), null, 'nothing done before the replay counts');
  assert.equal(guideView(s).step.id, 'meet');
  assert.equal(deskStage(s, now), 3, 'the desk stays as an established household has it');
  s.mayhem.resolved++;
  s.pets[0].careLog.food++;
  const progress = advanceGuide(s, now);
  assert.deepEqual(progress.steps.map(x => x.id), ['feed', 'emergency']);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(reloaded.life.guide.replay, s.life.guide.replay, 'the replay survives a reload');
  assert.equal(advanceGuide(reloaded, now), null);
  assert.equal(replayGuide(blankState(), now), null, 'no tour without a resident');
});


for (const signedIn of [false, true]) test(`feedback never claims a report is queued after a storage write fails (${signedIn ? 'signed in, offline' : 'signed out'})`, async () => {
  const { fake, cloud, feedback, storage } = await world();
  if (signedIn) { await cloud.signInAnonymously(); fake.setOffline(true); }
  storage.setItem = () => { throw new Error('storage full'); };
  await assert.rejects(feedback.submit(report()), error => error.code === 'storage_failed');
  assert.deepEqual(feedback.queued(), []);
  assert.match(feedbackText({ code: 'storage_failed' }), /could not keep/);
});

test('feedback read failure does not overwrite previous reports with an empty queue', async () => {
  const { feedback, storage } = await world();
  await feedback.submit(report()); const previous = storage.items.get(FEEDBACK_KEY);
  let writes = 0;
  storage.getItem = () => { throw new Error('storage inaccessible'); };
  storage.setItem = () => { writes++; };
  await assert.rejects(feedback.submit(report()), error => error.code === 'storage_failed');
  assert.equal(writes, 0); assert.equal(storage.items.get(FEEDBACK_KEY), previous);
});

test('a server-acknowledged report remains sent when its queued copy cannot be removed', async () => {
  const { feedback, storage, cloud, fake } = await world();
  const draft = report(); await feedback.submit(draft); await cloud.signInAnonymously();
  const write = storage.setItem; storage.setItem = () => { throw new Error('storage full'); };
  assert.equal(await feedback.submit(draft), 'sent'); assert.equal(feedback.queued().length, 1);
  assert.deepEqual(await feedback.flush(), { sent: 1, left: 1 });
  storage.setItem = write;
  assert.deepEqual(await feedback.flush(), { sent: 1, left: 0 });
  assert.equal(fake.feedback.feedback.length, 1, 'retries file the same client id once');
});

test('unavailable default local storage cannot claim durable feedback storage', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage denied'); } });
  try { await assert.rejects(createFeedback().submit(report()), error => error.code === 'storage_failed'); }
  finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage; }
});


test('play-day metadata cannot overwrite queued feedback after a storage read fails', async () => {
  const { feedback, storage, cloud } = await world();
  await feedback.submit(report()); const previous = storage.items.get(FEEDBACK_KEY);
  await cloud.signInAnonymously(); let writes = 0;
  storage.getItem = () => { throw new Error('storage inaccessible'); };
  storage.setItem = () => { writes++; };
  await assert.rejects(feedback.resumePlayDays(), error => error.code === 'storage_failed');
  await feedback.markPlayDay(); await feedback.forgetPlayDays();
  assert.equal(writes, 0); assert.equal(storage.items.get(FEEDBACK_KEY), previous);
});
