// The coven client (src/cloud/coven.js) against the in-memory fake, which
// mirrors 0008_covens.sql, and its readers against hostile replies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { createCovenClient, readStatus, readBoard, readReferrals, covenText, covenCode } from '../src/cloud/coven.js';
import { GOALS } from '../src/content/coven.js';
import { covenName } from '../src/engine/coven.js';

const NOW = Date.UTC(2026, 9, 14, 12);  // a Wednesday
async function world(names = ['Ada', 'Bea', 'Cat'], clock = { t: NOW }) {
  const fake = createFakeSupabase({ now: () => clock.t });
  const players = [];
  for (const name of names) {
    const p = await socialPlayer(fake, name, { pets: [] }, { now: () => clock.t });
    p.coven = createCovenClient({ cloud: p.cloud, social: p.social, now: () => clock.t });
    players.push(p);
  }
  for (let i = 1; i < players.length; i++) {
    await players[0].social.addFriend(players[i].code);
    await players[i].social.respond(players[0].id, true);
  }
  return { fake, players, clock };
}
const NAME = { a: 'damp', b: 'sisterhood', form: 0 }, SIGIL = { shape: 'shield', symbol: 'spoon', colour: 'bruise' };
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code);

test('nothing is sent before the player opens Friends, and offline is said plainly', async () => {
  const fake = createFakeSupabase({ now: () => NOW });
  const p = await socialPlayer(fake, '', { pets: [] }, { social: false, now: () => NOW });
  const coven = createCovenClient({ cloud: p.cloud, social: p.social });
  fake.requests.length = 0;
  await rejects(coven.status(), 'signed_out');
  assert.deepEqual(fake.calls().filter(r => r.path.includes('coven')), []);
  p.social.optIn();
  fake.setOffline(true);
  await assert.rejects(coven.status(), e => e.offline === true && /No connection/.test(e.message));
  fake.setOffline(false);
  assert.equal((await coven.status()).coven, null);
});

test('found, invite, accept: three players in one coven, with names and a week', async () => {
  const { fake, players: [ada, bea, cat] } = await world();
  fake.social.coven.forceGoal = 'emergency-12';
  const made = await ada.coven.found(NAME, SIGIL);
  assert.ok(made.id);
  let s = await ada.coven.status();
  assert.equal(covenName(s.coven.name), 'The Damp Sisterhood');
  assert.deepEqual(s.coven.sigil, SIGIL);
  assert.equal(s.coven.role, 'founder');
  assert.deepEqual([s.week.goal, s.week.counter, s.week.target], ['emergency-12', 'emergency', 24]);
  assert.equal(ada.coven.cached(), s, 'kept for the postbox badge');
  await rejects(bea.coven.invite(cat.id), 'no_coven');
  await ada.coven.invite(bea.id); await ada.coven.invite(cat.id);
  const box = await bea.coven.status();
  assert.deepEqual([box.invites.length, box.invites[0].fromName, covenName(box.invites[0].coven.name), box.invites[0].coven.members], [1, 'Ada', 'The Damp Sisterhood', 1]);
  assert.equal((await bea.coven.respond(box.invites[0].id, true)).status, 'joined');
  const catBox = await cat.coven.status();
  assert.equal((await cat.coven.respond(catBox.invites[0].id, false)).status, 'declined');
  await rejects(cat.coven.respond(catBox.invites[0].id, true), 'not_found');
  await ada.coven.invite(cat.id);
  await cat.coven.respond((await cat.coven.status()).invites[0].id, true);
  s = await ada.coven.status();
  assert.deepEqual(s.members.map(m => [m.name, m.role]), [['Ada', 'founder'], ['Bea', 'member'], ['Cat', 'member']]);
  assert.equal(covenText({ code: 'P0001', message: 'coven_full' }), 'The coven is full. Six seats, all of them taken, one of them wobbly.');
  assert.equal(covenCode({ code: 'P0001', message: 'not_friends' }), 'not_friends');
});

test('contributions: running totals, the week’s progress and each share; chests for those who helped', async () => {
  const { fake, players: [ada, bea, cat] } = await world();
  fake.social.coven.forceGoal = 'coffin-3';
  await ada.coven.found(NAME, SIGIL);
  for (const p of [bea, cat]) { await ada.coven.invite(p.id); await p.coven.respond((await p.coven.status()).invites[0].id, true); }
  const day = new Date(NOW).toISOString().slice(0, 10);
  // The week is fixed with the members present when it is first needed: three, at three coffins each.
  let s = await ada.coven.status();
  assert.equal(s.week.target, 9);
  assert.deepEqual(await ada.coven.contribute(day, { coffin: 2, care: 5, bogus: 9 }), { week: s.week.no, progress: 2, mine: 2 });
  assert.deepEqual(await bea.coven.contribute(day, { coffin: 1 }), { week: s.week.no, progress: 3, mine: 1 });
  await rejects(ada.coven.contribute('yesterday', { coffin: 1 }), 'bad_day');
  await rejects(ada.coven.contribute('2026-10-01', { coffin: 1 }), 'bad_day');
  s = await cat.coven.status();
  assert.equal(s.week.progress, 3);
  assert.deepEqual(s.week.shares.map(x => [x.userId === ada.id ? 'ada' : 'bea', x.amount]).sort(), [['ada', 2], ['bea', 1]]);
  assert.deepEqual(await ada.coven.claim(s.week.no, 1), { ok: true, fresh: true, week: s.week.no, tier: 1 });
  assert.equal((await ada.coven.claim(s.week.no, 1)).fresh, false);
  await rejects(cat.coven.claim(s.week.no, 1), 'not_eligible');
  await rejects(ada.coven.claim(s.week.no, 2), 'not_reached');
  assert.deepEqual((await ada.coven.status()).week.claimed, [1]);
});

test('the notice board: tiles from the bank, names of members, removal, and twenty kept', async () => {
  const { players: [ada, bea, cat] } = await world();
  await ada.coven.found(NAME, SIGIL);
  for (const p of [bea, cat]) { await ada.coven.invite(p.id); await p.coven.respond((await p.coven.status()).invites[0].id, true); }
  await rejects(ada.coven.post(['kill <b>']), 'bad_note');
  await rejects(ada.coven.post([]), 'bad_note');
  const note = await ada.coven.post(['@' + bea.id, 'owes', 'me', 'a', 'spoon']);
  await cat.coven.post(['the', 'drawer', 'is', 'moist']);
  const board = await bea.coven.board();
  assert.equal(board.length, 2);
  assert.deepEqual(board[1].tiles, ['@' + bea.id, 'owes', 'me', 'a', 'spoon']);
  assert.deepEqual(board[1].names, { [bea.id]: 'Bea' });
  await rejects(cat.coven.unpost(note.id), 'not_allowed');
  await bea.coven.unpost(note.id);
  assert.equal((await ada.coven.board()).length, 1);
  assert.equal((await ada.coven.status()).board.count, 1);
});

test('membership: pass the candle, remove, leave; blocks hide notes and stop invitations', async () => {
  const { players: [ada, bea, cat] } = await world();
  await ada.coven.found(NAME, SIGIL);
  for (const p of [bea, cat]) { await ada.coven.invite(p.id); await p.coven.respond((await p.coven.status()).invites[0].id, true); }
  await rejects(bea.coven.passCandle(cat.id), 'not_founder');
  await ada.coven.passCandle(bea.id);
  assert.equal((await cat.coven.status()).members.find(m => m.role === 'founder').name, 'Bea');
  await bea.coven.remove(cat.id);
  assert.equal((await cat.coven.status()).coven, null);
  await bea.coven.leave();
  assert.equal((await ada.coven.status()).coven.role, 'founder', 'the candle comes back to the longest standing');
  await ada.coven.leave();
  assert.equal((await ada.coven.status()).coven, null);
  await ada.coven.found(NAME, SIGIL);
  await cat.social.block(ada.id);
  await rejects(ada.coven.invite(cat.id), 'not_friends');
});

test('invite rewards: register, play three days, become friends, and both collect', async () => {
  const clock = { t: NOW };
  const { fake, players: [ada] } = await world(['Ada'], clock);
  const kid = await socialPlayer(fake, 'Kid', { pets: [] }, { now: () => clock.t });
  kid.coven = createCovenClient({ cloud: kid.cloud, social: kid.social });
  assert.equal((await kid.coven.referrals()).canRegister, true);
  await rejects(kid.coven.registerReferral('ZZZZZZZZ'), 'not_found');
  await rejects(kid.coven.registerReferral('nonsense'), 'not_found');
  assert.equal((await kid.coven.registerReferral(ada.code)).inviter, ada.id);
  await rejects(kid.coven.registerReferral(ada.code), 'already_referred');
  await rejects(kid.coven.claimReferral(ada.id), 'not_friends');
  await kid.social.addFriend(ada.code); await ada.social.respond(kid.id, true);
  assert.equal((await kid.coven.markActiveDay()).days, 1);
  await rejects(ada.coven.claimReferral(kid.id), 'not_ready');
  fake.social.coven.ageReferral(kid.id, 3);
  for (const d of [1, 2]) fake.social.coven.addActiveDay(kid.id, new Date(NOW - d * 86400000).toISOString().slice(0, 10));
  const mine = await ada.coven.referrals();
  assert.deepEqual(mine.invited.map(r => [r.name, r.friends, r.days, r.claimed]), [['Kid', true, 3, false]]);
  assert.deepEqual(await ada.coven.claimReferral(kid.id), { ok: true, fresh: true, side: 'inviter' });
  assert.deepEqual(await kid.coven.claimReferral(ada.id), { ok: true, fresh: true, side: 'invitee' });
  assert.equal((await ada.coven.referrals()).rewarded, 1);
  assert.equal(covenText({ code: 'cap_reached' }), 'Ten invite rewards is the most anyone can collect. Very sociable of you.');
});

test('readers rebuild every reply from scratch and drop what they do not recognise', () => {
  const u = n => '00000000-0000-4000-8000-00000000000' + n;
  const hostile = readStatus({
    coven: { id: u(1), name_a: '<script>', name_b: 'sisterhood', name_form: 99, shape: 'shield', symbol: 'spoon', colour: 'javascript:x', members: 900, role: 'god', frame: 'ivy' },
    members: [...Array.from({ length: 9 }, (_, i) => ({ user_id: u(i), display_name: '‮evil' + 'x'.repeat(50), role: 'founder' })), { user_id: 'not-a-uuid' }],
    week: { no: 3000, goal: 'emergency-12', counter: 'emergency', target: -5, progress: 1e12, members: [{ user_id: u(1), amount: 3 }, { user_id: u(1), amount: 9 }], claimed: [1, 1, 7, 'x'] },
    last: { no: 'x' }, invites: [{ id: 'bad' }, { id: u(5), coven: { id: u(6) }, from_user: u(7), from_name: 'Bea' }],
    sent: 'nope', board: { latest: -1, count: 900 }
  });
  assert.equal(hostile.coven.name.a, '', 'not an id: dropped, so it reads as a placeholder');
  assert.equal(covenName(hostile.coven.name), 'Sisterhood for the Unrecorded');
  assert.equal(hostile.coven.name.form, 3);
  assert.equal(hostile.coven.sigil.colour, '');
  assert.equal(hostile.coven.members, 6);
  assert.equal(hostile.coven.role, 'member');
  assert.equal(hostile.members.length, 6);
  assert.ok(hostile.members.every(m => m.name.length <= 24 && !m.name.includes('‮')));
  assert.equal(hostile.week.target, 1);
  assert.equal(hostile.week.progress, 1e6);
  assert.deepEqual(hostile.week.shares, [{ userId: u(1), amount: 3 }]);
  assert.deepEqual(hostile.week.claimed, [1]);
  assert.equal(hostile.last, null);
  assert.equal(hostile.invites.length, 1);
  assert.deepEqual(hostile.sent, []);
  assert.deepEqual(hostile.board, { latest: 0, count: 20 });
  assert.deepEqual(readStatus('garbage'), { coven: null, members: [], week: null, last: null, invites: [], sent: [], board: { latest: 0, count: 0 } });
  const board = readBoard([{ id: 1, author: u(1), tiles: ['spoon', 'Spoon', '<b>', 7, '@' + u(2)], mentions: [u(2), 'x'], mention_names: ['Bea\u0000'] },
    { id: 1, author: u(1), tiles: ['dupe'] }, { id: 2, author: 'x', tiles: ['spoon'] }, { id: 3, author: u(1), tiles: ['<b>'] }, ...Array(40).fill({ id: 9, author: u(1), tiles: ['a'] })]);
  assert.deepEqual(board.map(n => n.id), [1, 9]);
  assert.deepEqual(board[0].tiles, ['spoon', '@' + u(2)], 'upper case, markup and numbers are not tile ids');
  assert.deepEqual(board[0].names, { [u(2)]: 'Bea' });
  assert.deepEqual(readReferrals({ invited_by: { user_id: 'x' }, invited: [{ user_id: u(1), days: 900, friends: 'yes' }], rewarded: 99, can_register: 1 }),
    { invitedBy: null, invited: [{ userId: u(1), name: '', friends: false, days: 60, claimed: false }], rewarded: 10, canRegister: false });
  assert.ok(GOALS.length);
});
