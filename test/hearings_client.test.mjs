import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { createHearings, readHearing, readCast, readMember, readMarks, readRuling, readHearings, hearingText, hearingCode } from '../src/cloud/hearings.js';
import { householdFixture } from './household-fixtures.mjs';
import { readShelf, shelfSnapshot } from '../src/cloud/social.js';
import { jointCast, castAsSent, SERVED } from '../src/engine/court-joint.js';

const NOW = Date.UTC(2026, 9, 3, 17);
async function world() {
  const fake = createFakeSupabase({ now: () => NOW });
  const ada = await socialPlayer(fake, 'Ada', householdFixture('established', NOW), { now: () => NOW });
  const bea = await socialPlayer(fake, 'Bea', householdFixture('established', NOW), { now: () => NOW });
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  ada.hearings = createHearings({ cloud: ada.cloud, social: ada.social });
  bea.hearings = createHearings({ cloud: bea.cloud, social: bea.social });
  return { fake, ada, bea };
}
const SEALED = { ruling: 'defendant', truth: 'plaintiff', stars: 2, ratings: 87, agree: 4, dissent: 1 };
const MARKS = [{ at: 'opening:3', r: 'laugh', ms: 400 }];
function castFor(ada) {
  const residents = readShelf(shelfSnapshot(householdFixture('established', NOW))).residents;
  return jointCast(ada.shelf, { kind: SERVED, caseId: 'borrowed-coffin', twist: null, seed: 31, mineId: 'qa0', theirs: residents[1], friendShelf: residents, friendName: 'Bea', myName: 'Ada' }, NOW);
}
const openOne = (ada, bea, extra = {}) => ada.hearings.open({ to: bea.id, kind: 'served', caseId: 'borrowed-coffin', seed: 31, cast: castFor(ada), ruling: SEALED, marks: MARKS, ...extra });

test('a hearing travels sealed, is answered, and reveals both rulings to both judges', async () => {
  const { fake, ada, bea } = await world();
  const { id } = await openOne(ada, bea);
  assert.ok(fake.social.hearings.rows.has(id));
  const box = await bea.hearings.list();
  assert.equal(box.hearings.length, 1);
  assert.deepEqual([box.hearings[0].role, box.hearings[0].status, box.hearings[0].mine, box.hearings[0].theirs, box.hearings[0].otherName], ['second', 'open', null, null, 'Ada']);
  assert.equal(bea.hearings.count(), 1, 'one hearing waits for Bea');
  const full = await bea.hearings.get(id);
  assert.deepEqual(full.cast, castAsSent(castFor(ada)), 'the cast arrives exactly as the first judge staged it');
  assert.deepEqual(full.theirMarks, MARKS);
  assert.equal(full.mine, null); assert.equal(full.theirs, null);
  await assert.rejects(bea.hearings.reveal(id), err => err.code === 'sealed' && err.message === hearingText({ code: 'P0001', message: 'sealed' }));

  const answer = { ruling: 'plaintiff', truth: 'plaintiff', stars: 3, ratings: 70, agree: 6, dissent: 0 };
  const reveal = await bea.hearings.rule(id, answer, [{ at: 'rule:plaintiff:0', r: 'gavel', ms: 5 }]);
  assert.deepEqual([reveal.status, reveal.mine, reveal.theirs, reveal.seen], ['revealed', answer, SEALED, true]);
  assert.equal(bea.hearings.count(), 0, 'answering clears the count at once');
  await ada.hearings.list();
  assert.equal(ada.hearings.count(), 1, 'Ada has a reveal to read');
  const hers = await ada.hearings.reveal(id);
  assert.deepEqual([hers.mine, hers.theirs, hers.theirMarks], [SEALED, answer, [{ at: 'rule:plaintiff:0', r: 'gavel', ms: 5 }]]);
  assert.equal(ada.hearings.count(), 0);
  const record = await ada.hearings.benchRecord(bea.id);
  assert.deepEqual([record.hearings, record.fullBenches, record.mine, record.theirs, record.name, record.recent.length], [1, 0, 0, 1, 'Bea', 1]);
  const listed = await ada.hearings.list();
  assert.deepEqual(listed.records.map(r => [r.name, r.hearings]), [['Bea', 1]]);
});

test('declining, withdrawing and the refusals a player reads', async () => {
  const { ada, bea } = await world();
  const first = await openOne(ada, bea);
  assert.equal(await bea.hearings.decline(first.id), 'declined');
  const second = await openOne(ada, bea);
  assert.equal(await ada.hearings.decline(second.id), 'withdrawn');
  for (let i = 0; i < 5; i++) await openOne(ada, bea);
  await assert.rejects(openOne(ada, bea), err => err.code === 'too_many_open' && /Five hearings/.test(err.message));
  await assert.rejects(openOne(ada, bea, { ruling: { ...SEALED, ruling: 'guilty' } }), err => err.code === 'bad_ruling');
  await assert.rejects(openOne(ada, bea, { cast: { p: null } }), err => err.code === 'bad_cast');
  await assert.rejects(openOne(ada, bea, { seed: 0 }), err => err.code === 'bad_hearing');
  await assert.rejects(ada.hearings.get('not-a-uuid'), err => err.code === 'not_found');
  assert.equal(hearingCode({ offline: true }), 'offline');
  assert.match(hearingText({ offline: true }), /No connection/);
  assert.match(hearingText({ code: 'P0001', message: 'not_friends' }), /not friends/);
});

test('nothing is sent without the social layer, and another account’s list is never shown', async () => {
  const { fake, ada, bea } = await world();
  await openOne(ada, bea);
  const quiet = createHearings({ cloud: bea.cloud, social: { active: () => false } });
  await assert.rejects(quiet.list(), err => err.code === 'signed_out');
  assert.deepEqual(quiet.cached().hearings, []);
  const before = fake.requests.length;
  assert.equal(quiet.count(), 0);
  assert.equal(fake.requests.length, before);
  await bea.hearings.list();
  assert.equal(bea.hearings.count(), 1);
  await bea.cloud.signOut();
  assert.equal(bea.hearings.count(), 0, 'signed out, the cache is not this player’s');
});

test('readers rebuild everything and drop what they do not recognise', () => {
  assert.equal(readRuling({ ...SEALED, stars: 4 }), null);
  assert.equal(readRuling({ ...SEALED, agree: 4, dissent: 3 }), null);
  assert.deepEqual(readRuling({ ...SEALED, extra: 1 }), SEALED);
  assert.deepEqual(readMarks([...MARKS, { at: 'BAD', r: 'laugh', ms: 1 }, { at: 'x', r: 'boo', ms: 1 }, { at: 'x', r: 'gasp', ms: 1.5 }, ...Array(60).fill(MARKS[0])]).length, 40);
  assert.deepEqual(readMember({ kind: 'npc', id: 'woodlouse', name: '<b>Someone else</b>' }), { kind: 'npc', id: 'woodlouse', name: 'Geoffrey the Woodlouse' });
  assert.equal(readMember({ kind: 'npc', id: 'keith' }), null);
  assert.equal(readMember({ kind: 'robot', id: 'x', name: 'x' }), null);
  const big = readMember({ kind: 'pet', id: 'm1', name: 'Mabel‮', owner: 'boss', art: { body: 'data:image/png;base64,' + 'A'.repeat(130 * 1024), stamps: [] } });
  assert.deepEqual([big.name, big.owner, big.art], ['Mabel', '', null], 'a drawing over the cap and a bidi override are dropped');
  const cast = readCast({ p: { kind: 'npc', id: 'cat' }, d: { kind: 'npc', id: 'susan' }, jury: [{ kind: 'npc', id: 'raven' }, { kind: 'npc', id: 'nope' }, ...Array(9).fill({ kind: 'npc', id: 'moth' })],
    witnesses: Array(5).fill({ kind: 'npc', id: 'uncle' }), seats: { p: { traits: ['theatrical', 'not-a-trait'], bond: 99, dislikes: ['p', 'x'] }, jury: 'no' } });
  assert.equal(cast.jury.length, 5, 'six read, one unknown dropped');
  assert.equal(cast.witnesses.length, 3);
  assert.deepEqual(cast.seats.p, { traits: ['theatrical'], bond: 0, dislikes: ['p'] });
  assert.equal(cast.seats.jury.length, cast.jury.length);
  assert.equal(readCast({ p: { kind: 'npc', id: 'cat' }, jury: [] }), null);
  const row = { id: '00000000-0000-4000-8000-000000000001', kind: 'served', role: 'second', other_user: '00000000-0000-4000-8000-000000000002', other_name: 'Ada',
    case_id: 'borrowed-coffin', twist: null, seed: 5, status: 'open', mine: null, theirs: SEALED, alone: true, seen: false };
  const read = readHearing(row);
  assert.equal(read.theirs, null, 'an open hearing never carries the other ruling, whatever the server says');
  assert.equal(read.alone, false, 'only a first judge stands alone');
  for (const bad of [{ ...row, id: 'x' }, { ...row, kind: 'duel' }, { ...row, status: 'pending' }, { ...row, seed: 0 }, { ...row, case_id: 'Bad Case' }, { ...row, role: 'third' }]) {
    assert.equal(readHearing(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(readHearings({ hearings: [row, row, 'x'], records: [{ user_id: 'nope' }] }).hearings.length, 1);
});
