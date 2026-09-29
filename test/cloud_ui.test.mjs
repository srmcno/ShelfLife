import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudNudgeDue, cloudCovers, cloudTrayLabel, timeAgo, describeShelf, problemText, actionText, NUDGE_SNOOZE } from '../src/ui/cloud.js';

const NOW = Date.UTC(2026, 8, 29, 12), DAY = 86400000;
const off = { status: 'off', signedIn: false };
const shelf = (pets, age) => ({ pets: Array.from({ length: pets }, (_, i) => ({ id: 'p' + i })), started: NOW - age });

test('the nudge waits for a shelf worth losing, and a dismissal lasts a fortnight', () => {
  assert.equal(cloudNudgeDue(shelf(2, 2 * DAY), off, {}, NOW), true);
  assert.equal(cloudNudgeDue(shelf(1, 30 * DAY), off, {}, NOW), false, 'one resident is not yet a household');
  assert.equal(cloudNudgeDue(shelf(5, DAY), off, {}, NOW), false, 'nothing on day one');
  assert.equal(cloudNudgeDue(shelf(5, 9 * DAY), { status: 'idle', signedIn: true }, {}, NOW), false, 'never once it is on');
  assert.equal(cloudNudgeDue(shelf(5, 9 * DAY), off, { nudgeDismissedAt: NOW - 13 * DAY }, NOW), false);
  assert.equal(cloudNudgeDue(shelf(5, 9 * DAY), off, { nudgeDismissedAt: NOW - NUDGE_SNOOZE }, NOW), true);
});

test('only a recently synced email account quiets the backup reminder', () => {
  const synced = { signedIn: true, anonymous: false, status: 'idle', lastSyncedAt: NOW - DAY };
  assert.equal(cloudCovers(synced, NOW), true);
  assert.equal(cloudCovers({ ...synced, anonymous: true }, NOW), false, 'clearing site data loses an anonymous key');
  assert.equal(cloudCovers({ ...synced, status: 'conflict' }, NOW), false);
  assert.equal(cloudCovers({ ...synced, lastSyncedAt: NOW - 8 * DAY }, NOW), false);
});

test('tray labels and relative times read naturally', () => {
  assert.equal(cloudTrayLabel(off, NOW), 'Off');
  assert.equal(cloudTrayLabel({ signedIn: true, status: 'idle', lastSyncedAt: NOW - 2 * 60000 }, NOW), 'Saved 2 minutes ago');
  assert.equal(cloudTrayLabel({ signedIn: true, status: 'offline' }, NOW), 'Offline');
  assert.equal(cloudTrayLabel({ signedIn: true, status: 'conflict' }, NOW), 'Needs a decision');
  assert.equal(cloudTrayLabel({ signedIn: true, status: 'error', repairable: true }, NOW), 'Needs a decision');
  assert.deepEqual([10e3, 70e3, 3600e3, 5 * 3600e3, 30 * 3600e3, 4 * DAY].map(ms => timeAgo(NOW - ms, NOW)),
    ['just now', 'a minute ago', 'an hour ago', '5 hours ago', 'yesterday', '4 days ago']);
});

test('shelf descriptions and messages are plain, short and free of em dashes', () => {
  assert.equal(describeShelf({ residents: 1, names: ['Agnes'], souls: 1 }), '1 resident: Agnes. 1 soul.');
  assert.equal(describeShelf({ residents: 5, names: ['A', 'B', 'C'], souls: 0 }), '5 residents: A, B, C and 2 more.');
  assert.equal(describeShelf({ residents: 0, names: [], souls: 9 }), 'No residents.');
  const lines = [problemText({ status: 'offline' }), problemText({ status: 'error' }), problemText({ error: { code: 'too_large' } }),
    ...['offline', 'invalid_email', 'otp_expired', 'over_email_send_rate_limit', 'x'].map(code => actionText({ code, offline: code === 'offline' }))];
  for (const line of lines) {
    assert.ok(line && line.length <= 110, line);
    assert.doesNotMatch(line, /[–—]/);
  }
});
