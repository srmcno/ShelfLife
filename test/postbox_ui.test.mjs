// The hub's markup and plug-ins, without a page: everything a friend wrote is
// printed as text, the registered sources and actions behave, and the mail
// check polls the postbox too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendRow, historyLine, levelMarkup, confirmBox } from '../src/ui/friends.js';
import { plankMarkup, careLine } from '../src/ui/guests.js';
import { postcardMarkup, waveText, signatureLine, leftWords, stampIcon } from '../src/ui/postbox.js';
import '../src/ui/social-court.js';
import { postboxSources, friendActions, friendsSections, postboxCount, setSocialContext, socialContext } from '../src/ui/social-registry.js';
import { createInboxMonitor } from '../src/cloud/inbox.js';
import { otherMail } from '../src/ui/social-inbox.js';
import { friendLevel } from '../src/engine/visits.js';
import { blankBox } from '../src/cloud/postbox.js';
import { blankState } from '../src/state.js';

const ID = '00000000-0000-4000-8000-000000000001';
const EVIL = '<img src=x onerror=y>';
const dashes = text => /[–—]/.test(text);

test('rows, levels, plank, postcards and waves print a friend’s words as text', () => {
  const friend = { userId: ID, name: EVIL, code: 'ABCDEFGH', status: 'accepted', shelfAt: 0 };
  for (const html of [friendRow(friend, { level: friendLevel(9), count: 3, mail: true }), confirmBox('block', friend), confirmBox('report', friend), confirmBox('remove', friend),
    plankMarkup([{ visitId: ID, from: { userId: ID, name: EVIL }, resident: { name: EVIL, traits: [] }, arrived: 1, leaves: Date.now() + 3600000 * 5 }]),
    postcardMarkup({ visitId: ID, host: EVIL, pet: EVIL, text: EVIL, souvenir: 'their-spoon', souls: 8 })]) {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img src=x onerror=y&gt;/);
    assert.ok(!dashes(html));
  }
  assert.match(friendRow(friend, { level: friendLevel(9), count: 3 }), /Spare Key Holder · 3 residents · No shelf on show yet/);
  assert.match(friendRow(friend, { mail: true }), /fr-dot/);
  assert.match(levelMarkup(friendLevel(5)), /aria-valuenow="40"/);
  assert.match(levelMarkup(friendLevel(5)), /3 more to Spare Key Holder/);
  assert.match(levelMarkup(friendLevel(99)), /As close as it gets\./);
  assert.equal(historyLine({ case: 2, visit: 1, gift: 0, wave: 1 }), '2 cases heard, 1 visit, 1 day of waving.');
  assert.match(historyLine({}), /^Nothing yet\./);
  assert.equal(waveText({ kind: 'wave', line: 0, fromName: 'Ada', residentName: 'Mabel' }), 'Ada waved at Mabel. Mabel has not recovered.');
  assert.equal(waveText({ kind: 'poke', line: 9, fromName: 'Ada', residentName: 'Mabel' }), 'Ada poked Mabel. Mabel made a noise like a kettle and will not discuss it.');
  assert.match(signatureLine({ line: 99 }), /cannot read/);
  assert.deepEqual([30 * 60000, 5 * 3600000, 36 * 3600000].map(leftWords), ['within the hour', '5 hours', '2 days']);
  assert.match(stampIcon('moth', 'Moth stamp'), /aria-label="Moth stamp"/);
  assert.equal(careLine({ food: 2, fuss: 0, clean: 1 }), 'So far you have fed it twice and washed it once. Its owner gets a postcard about all of it.');
});

test('the registered plug-ins: one postbox, Court mail inside it, actions with reasons', async () => {
  const ids = postboxSources().map(s => s.id);
  for (const id of ['summons', 'verdicts', 'visits', 'gifts', 'signatures', 'waves']) assert.ok(ids.includes(id), id);
  assert.deepEqual(friendsSections('home').map(s => s.id), ['pb-stays', 'pb-book', 'pb-keepsakes']);
  assert.deepEqual(friendsSections('friend').map(s => s.id), ['pb-their-book']);
  let box = { ...blankBox(), giftedToday: [ID], signedToday: [] };
  const postbox = { active: () => true, loaded: () => true, state: () => box, count: () => 0, guestbook: async () => ({ entries: [] }) };
  const social = { active: () => true, inboxCount: () => 2, inboxState: () => ({ cases: [], results: [] }) };
  let online = true;
  const ctx = { state: blankState(), social, postbox, online: () => online, friends: () => [], me: { userId: ID } };
  ctx.state.pets = [{ id: 'p1', name: 'Pip' }];
  const friend = { userId: ID, name: 'Bea' };
  const states = () => Object.fromEntries(friendActions(friend, ctx).map(a => [a.id, a.state]));
  assert.deepEqual(states(), { 'visit-shelf': true, invite: true, serve: true, treat: 'Treat sent today. Tomorrow, another.', sign: true });
  box = { ...box, away: [{ id: ID, toUser: ID, residentName: 'Pip', status: 'pending' }] };
  assert.equal(states().invite, 'Pip is already waiting at their door.');
  online = false;
  assert.match(states().treat, /^No connection/);
  assert.match(states().serve, /^No connection/);
  // The badge: two court letters by the stored count, plus the postbox.
  box = { ...blankBox(), requests: [{ id: ID }], gifts: [{ id: ID, status: 'sent' }, { id: ID + 'x', status: 'opened' }], waves: [{ id: ID, seen: false }] };
  assert.equal(postboxCount(ctx), 2 + 1 + 1 + 1);
  assert.equal(otherMail(ctx), 3);
  setSocialContext(ctx);
  assert.equal(socialContext(), ctx);
});

test('the 30 second check also polls the postbox and listens to it', async () => {
  let polled = 0, feed = null, changes = 0;
  const cloud = { configured: true, userId: () => 'u1', subscribe: () => () => {} };
  const social = { active: () => true, inbox: async () => ({}), inboxState: () => ({ cases: [], results: [] }), subscribe: () => () => {} };
  const timers = [];
  const monitor = createInboxMonitor({ cloud, social, onChange: () => { changes++; }, schedule: fn => { timers.push(fn); return 1; }, cancel: () => {},
    poll: () => { polled++; }, watch: [fn => { feed = fn; return () => { feed = null; }; }] });
  monitor.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(polled, 1);
  await timers[0]();
  assert.equal(polled, 2);
  const before = changes;
  feed();
  assert.equal(changes, before + 1, 'a postbox change updates the notice');
  monitor.stop();
  assert.equal(feed, null);
});
