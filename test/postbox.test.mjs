// Visits, gifts, guestbooks, waves, levels and Do not disturb: the save, the
// rules in src/engine/visits.js and the client in src/cloud/postbox.js against
// the in-memory server (test/support/fake-postbox.mjs), with two players.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { createPostbox, readPostbox, readStrips, postboxText, boxCount } from '../src/cloud/postbox.js';
import { blankFriendVisits, normalizeFriendVisits } from '../src/visits-state.js';
import {
  activeGuests, applyPostbox, awayFor, collectEnding, collectGift, friendLevel, postcardText, thankYouText, reactionLine,
  souvenirFor, dropDepartedGuests, recordCare, careCounts
} from '../src/engine/visits.js';
import { normalizeState, blankState } from '../src/state.js';
import { householdFixture, FIXTURE_NAMES } from './household-fixtures.mjs';
import { createBackup } from '../src/backup.js';
import { generateCreature } from '../src/art/creatures.js';
import { checkAchievements } from '../src/engine/achievements.js';
import { rankInfo } from '../src/engine/mayhem.js';
import { totalBond } from '../src/engine/unlocks.js';
import { FRIEND_LEVELS, GUESTBOOK_LINES, TREATS, SOUVENIRS, WAVE_LINES, POKE_LINES, STAMPS } from '../src/content/postbox.js';

const T0 = Date.UTC(2026, 9, 11, 12);
const DAY = 86400000;
const ID = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

function pet(id, name, traits = ['damp']) {
  return { id, name, traits, needs: { food: 80, fuss: 80, clean: 80 }, bond: 4, art: { body: '', stamps: [], creature: generateCreature({ seed: id }) } };
}
async function world() {
  let clock = T0;
  const now = () => clock;
  const fake = createFakeSupabase({ now });
  const ada = await socialPlayer(fake, 'Ada', { pets: [pet('ada0', 'Mabel', ['critic']), pet('ada1', 'Pip')] }, { now });
  const bea = await socialPlayer(fake, 'Bea', { pets: [pet('bea0', 'Gladys'), pet('bea1', 'Snag')] }, { now });
  const cat = await socialPlayer(fake, 'Cat', { pets: [pet('cat0', 'Wanda')] }, { now });
  for (const [x, y] of [[ada, bea], [ada, cat], [bea, cat]]) { await x.social.addFriend(y.code); await y.social.respond(x.id, true); }
  for (const p of [ada, bea, cat]) { p.postbox = createPostbox({ cloud: p.cloud, social: p.social, now }); await p.social.publish({ force: true }); }
  return { fake, ada, bea, cat, tick: ms => { clock += ms; }, now };
}

test('an old save gets a blank friendVisits; the normalizer is idempotent, capped and refuses junk', () => {
  const old = householdFixture('established', T0);
  delete old.friendVisits;
  const s = normalizeState(old);
  assert.deepEqual(s.friendVisits, blankFriendVisits());
  assert.ok(Array.isArray(s.visits), 'the session log under state.visits is untouched');
  const resident = { id: 'r1', name: 'Mabel', traits: ['damp', '<b>'], mood: 'fine', bond: 3, art: { body: '', stamps: [], creature: generateCreature({ seed: 'g' }) } };
  const raw = {
    guests: [
      { visitId: ID(1), from: { userId: ID(2), name: 'Ada' }, resident, arrived: T0, leaves: T0 + DAY },
      { visitId: ID(1), from: { userId: ID(2), name: 'Dup' }, resident, arrived: T0, leaves: T0 + DAY },
      { visitId: ID(3), from: { userId: ID(4), name: 'Bea' }, resident: { ...resident, art: { body: 'x'.repeat(200000) } }, arrived: T0, leaves: T0 + DAY },
      { visitId: ID(5), from: { userId: ID(6), name: 'Too many' }, resident, arrived: T0, leaves: T0 + DAY },
      { visitId: 'nope', from: {}, resident, arrived: 1, leaves: 2 }
    ],
    away: [{ visitId: ID(7), residentId: 'qa0', host: { userId: ID(8), name: 'Cat' }, status: 'accepted', leaves: T0 + DAY }, { visitId: ID(9), residentId: '../x', host: {} }],
    care: { [ID(1)]: { food: 99, fuss: 2, clean: -1 }, [ID(99)]: { food: 1 } },
    postcards: Array.from({ length: 40 }, (_, i) => ({ visitId: ID(100 + i), host: 'Bea', pet: 'Mabel', text: 'Hello', souvenir: 'their-spoon', souls: 8, at: T0 })),
    souvenirs: [{ id: 'their-spoon', visitId: ID(100), host: 'Bea', pet: 'Mabel', at: T0 }, { id: 'BAD ID', visitId: ID(101) }],
    paid: [ID(1), ID(1), 'junk']
  };
  const v = normalizeFriendVisits(raw);
  assert.deepEqual(v.guests.map(g => g.visitId), [ID(1), ID(3)], 'two guests at most, no duplicates, no junk');
  assert.deepEqual(v.guests[0].resident.traits, ['damp']);
  assert.equal(v.guests[1].resident.art, null, 'an oversized drawing is dropped');
  assert.deepEqual(v.care, { [ID(1)]: { food: 30, fuss: 2, clean: 0 } });
  assert.equal(v.away.length, 1);
  assert.equal(v.postcards.length, 20);
  assert.equal(v.souvenirs.length, 1);
  assert.deepEqual(v.paid, [ID(1)]);
  assert.deepEqual(normalizeFriendVisits(JSON.parse(JSON.stringify(v))), v, 'idempotent');
  for (const junk of [null, 7, 'x', [], { guests: 'x', away: {}, care: [], postcards: null }]) assert.deepEqual(normalizeFriendVisits(junk), blankFriendVisits());
});

test('a household with a guest and a resident away survives repeated transfers', () => {
  const s = householdFixture('established', T0);
  s.friendVisits = { guests: [{ visitId: ID(1), from: { userId: ID(2), name: 'Ada' }, resident: { id: 'g1', name: 'Mabel', traits: [], mood: 'fine', bond: 0, art: null }, arrived: T0, leaves: T0 + DAY }],
    away: [{ visitId: ID(3), residentId: 'qa0', host: { userId: ID(4), name: 'Bea' }, status: 'accepted', leaves: T0 + DAY }], care: { [ID(1)]: { food: 1, fuss: 0, clean: 2 } },
    postcards: [], souvenirs: [], paid: [] };
  let loaded = normalizeState(JSON.parse(createBackup(s, T0).text));
  const stable = JSON.stringify(loaded.friendVisits);
  for (let i = 0; i < 3; i++) loaded = normalizeState(JSON.parse(createBackup(loaded, T0).text));
  assert.equal(JSON.stringify(loaded.friendVisits), stable);
  assert.equal(loaded.friendVisits.guests[0].resident.name, 'Mabel');
  for (const kind of FIXTURE_NAMES) assert.ok(normalizeState(JSON.parse(JSON.stringify(householdFixture(kind, T0)))).friendVisits, kind);
});

test('guests are not residents: no household count, bond, rank or achievement moves', () => {
  const s = householdFixture('established', T0);
  const before = { pets: s.pets.length, bond: totalBond(s), rank: rankInfo(s).index, ach: [...s.achievements] };
  s.friendVisits.guests = [0, 1].map(i => ({ visitId: ID(10 + i), from: { userId: ID(20), name: 'Ada' },
    resident: { id: 'guest' + i, name: 'Guest ' + i, traits: ['damp'], mood: 'content', bond: 25, art: null }, arrived: T0 - 1000, leaves: T0 + DAY }));
  checkAchievements(s, T0);
  assert.deepEqual({ pets: s.pets.length, bond: totalBond(s), rank: rankInfo(s).index, ach: s.achievements.filter(a => before.ach.includes(a)) }, before);
  assert.equal(activeGuests(s, T0).length, 2);
  assert.deepEqual(Object.keys(activeGuests(s, T0)[0]).sort(), ['arrived', 'from', 'leaves', 'resident', 'visitId']);
  assert.equal(activeGuests(s, T0 + 2 * DAY).length, 0, 'a guest past its time is gone');
  assert.equal(dropDepartedGuests(s, T0 + 2 * DAY), true);
  assert.equal(s.friendVisits.guests.length, 0);
});

test('the words: postcards, thank-you notes, reactions, souvenirs and levels', () => {
  assert.equal(GUESTBOOK_LINES.length, 24);
  assert.equal(WAVE_LINES.length + POKE_LINES.length, 16);
  assert.ok(TREATS.length >= 8 && SOUVENIRS.length >= 10 && STAMPS.length === 6);
  const all = JSON.stringify([GUESTBOOK_LINES, TREATS, SOUVENIRS, WAVE_LINES, POKE_LINES, FRIEND_LEVELS]);
  assert.doesNotMatch(all, /[–—]/, 'no dashes');
  assert.doesNotMatch(all, /'/, 'curly apostrophes only');
  const card = postcardText({ id: ID(1), status: 'ended', otherName: 'Bea', residentName: 'Mabel', fed: 2, fussed: 0, washed: 1, days: 2 });
  assert.match(card, /^Bea fed Mabel twice and washed them once\. /);
  assert.match(postcardText({ id: ID(2), status: 'ended', otherName: 'Bea', residentName: 'Mabel', fed: 0, fussed: 0, washed: 0, days: 3 }), /^Mabel stayed three days at Bea’s\. /);
  assert.match(postcardText({ id: ID(3), status: 'declined', otherName: 'Bea', residentName: 'Mabel' }), /Bea/);
  assert.match(postcardText({ id: ID(4), status: 'lapsed', otherName: 'Bea', residentName: 'Mabel' }), /Bea/);
  assert.match(thankYouText({ id: ID(1), residentName: 'Mabel', otherName: 'Ada' }), /^Mabel has gone home to Ada\. It left a note: “.+”$/);
  assert.equal(souvenirFor(ID(1)).id, souvenirFor(ID(1)).id, 'the same visit, the same souvenir');
  assert.match(reactionLine({ name: 'Mabel', traits: ['critic'] }, 'food', 0), /Mabel gives the meal two skulls/);
  assert.match(reactionLine({ name: 'Mabel', traits: [] }, 'clean', 1), /Mabel/);
  assert.deepEqual([0, 3, 8, 16, 30, 50, 500].map(n => friendLevel(n).index), [0, 1, 2, 3, 4, 5, 5]);
  assert.equal(friendLevel(5).progress, 0.4);
  assert.equal(friendLevel(0).name, 'Acquaintance');
  assert.equal(friendLevel(60).name, 'Co-conspirators');
  assert.equal(friendLevel(60).next, null);
});

test('readers drop junk and never trust the server', () => {
  const box = readPostbox({ dnd: 'yes', requests: [{ id: 'x' }, { id: ID(1), from_user: ID(2), from_name: '<b>Ada</b>‮', resident: { id: 'r', name: 'M' }, days: 9, created_at: new Date(T0).toISOString() }],
    gifts: [{ id: ID(3), from_user: ID(2), treat: 'NOT OK', status: 'sent' }, { id: ID(4), from_user: ID(2), treat: 'mystery-box', status: 'sent', created_at: new Date(T0).toISOString() }],
    waves: [{ id: ID(5), from_user: ID(2), kind: 'slap', line: 1 }], signatures: [{ id: ID(6), signer: ID(2), line: 3, stamp: 'glitter' }],
    levels: [{ user_id: ID(2), kinds: { visit: 2, gift: -5, case: 1e12, nonsense: 9 } }], gifted_today: [ID(2), 'x', ID(2)] }, T0);
  assert.equal(box.dnd, false);
  assert.equal(box.requests.length, 0, 'days out of range');
  assert.deepEqual(box.gifts.map(g => [g.treat, g.known]), [['mystery-box', false]]);
  assert.equal(box.waves.length + box.signatures.length, 0);
  assert.deepEqual(box.levels[0].kinds, { case: 100000, visit: 2, gift: 0, signature: 0, trade: 0, hearing: 0, wave: 0 });
  assert.deepEqual(box.giftedToday, [ID(2)]);
  const strips = readStrips([{ user_id: ID(2), count: 9, residents: [{ id: 'a', name: 'x'.repeat(80), mood: 'odd', art: null }, { id: '../bad' }] }]);
  assert.deepEqual(strips.get(ID(2)).residents.map(r => [r.id, r.name.length, r.mood, r.art]), [['a', 22, 'fine', null]]);
});

test('a whole visit between two players: request, accept, guest, care, end, postcard and souvenir', async () => {
  const { ada, bea, tick, now } = await world();
  await ada.postbox.sendVisit({ to: bea.id, pet: ada.shelf.pets[0], days: 2 });
  assert.equal((await ada.postbox.load()).away[0].status, 'pending');
  await assert.rejects(ada.postbox.sendVisit({ to: bea.id, pet: ada.shelf.pets[1], days: 1 }), e => e.code === 'already_visiting' && e.message === postboxText(e));
  let box = await bea.postbox.load();
  assert.equal(bea.postbox.count(), 1);
  assert.deepEqual(box.requests.map(r => [r.fromName, r.resident.name, r.days]), [['Ada', 'Mabel', 2]]);
  assert.ok(box.requests[0].resident.art?.creature, 'the copy travels with its art');
  const answer = await bea.postbox.respondVisit(box.requests[0].id, true);
  assert.equal(answer.status, 'accepted');
  assert.equal(bea.postbox.count(), 0);

  const host = blankState();
  box = await bea.postbox.load();
  assert.equal(applyPostbox(host, box, now()), true);
  const [guest] = activeGuests(host, now());
  assert.deepEqual([guest.from.name, guest.resident.name, guest.leaves - guest.arrived], ['Ada', 'Mabel', 2 * DAY]);
  const home = blankState();
  applyPostbox(home, await ada.postbox.load(), now());
  assert.equal(awayFor(home, 'ada0', now()).host.name, 'Bea');

  const counts = await bea.postbox.care(guest.visitId, 'food');
  assert.deepEqual(counts, { fed: 1, fussed: 0, washed: 0 });
  recordCare(host, guest.visitId, counts);
  assert.deepEqual(careCounts(host, guest.visitId), { food: 1, fuss: 0, clean: 0 });
  await assert.rejects(bea.postbox.care(guest.visitId, 'clean'), e => e.code === 'too_soon');
  tick(4000);
  await bea.postbox.care(guest.visitId, 'clean');
  tick(4000);
  await bea.postbox.care(guest.visitId, 'food');

  tick(2 * DAY);
  const ending = (await ada.postbox.load()).endings[0];
  assert.deepEqual([ending.role, ending.status, ending.otherName, ending.fed, ending.washed], ['sender', 'ended', 'Bea', 2, 1]);
  const got = await ada.postbox.collect(ending.id);
  assert.equal(got.souls, 8);
  const before = home.mayhem.souls;
  const kept = collectEnding(home, got.ending, got.souls, now());
  assert.equal(home.mayhem.souls, before + 8);
  assert.match(kept.postcard.text, /^Bea fed Mabel twice and washed them once\./);
  assert.equal(home.friendVisits.souvenirs.length, 1);
  assert.equal(collectEnding(home, got.ending, got.souls, now()).souls, 0, 'never paid twice');
  assert.equal(home.mayhem.souls, before + 8);
  const thanks = (await bea.postbox.load()).endings[0];
  const hostGot = await bea.postbox.collect(thanks.id);
  assert.equal(hostGot.souls, 6);
  assert.match(collectEnding(host, hostGot.ending, hostGot.souls, now()).text, /^Mabel has gone home to Ada\./);
  applyPostbox(host, await bea.postbox.load(), now());
  assert.equal(activeGuests(host, now()).length, 0);
  assert.equal((await ada.postbox.load()).levels.find(l => l.userId === bea.id).kinds.visit, 1);
});

test('gifts, guestbooks and waves through the client, with their caps', async () => {
  const { ada, bea, cat } = await world();
  await ada.postbox.sendGift(bea.id, 'moth-pie');
  await assert.rejects(ada.postbox.sendGift(bea.id, 'moth-pie'), e => e.code === 'already_sent' && /Restraint/.test(e.message));
  let box = await bea.postbox.load();
  assert.equal(box.gifts[0].fromName, 'Ada');
  const state = blankState();
  const opened = await bea.postbox.openGift(box.gifts[0].id);
  assert.equal(opened.souls, 4);
  assert.equal(collectGift(state, box.gifts[0].id, opened.souls), 4);
  assert.equal(collectGift(state, box.gifts[0].id, opened.souls), 0);
  await cat.postbox.sendGift(bea.id, 'jar-of-teeth');
  box = await bea.postbox.load();
  await bea.postbox.declineGift(box.gifts.find(g => g.status === 'sent').id);

  await ada.postbox.sign(bea.id, 4, 'moth');
  await assert.rejects(ada.postbox.sign(bea.id, 5, 'moth'), e => e.code === 'already_signed');
  assert.deepEqual((await ada.postbox.guestbook(bea.id)).entries.map(e => e.line), [4]);
  const book = await bea.postbox.guestbook(bea.id);
  assert.equal(book.entries[0].signerName, 'Ada');

  const w = await ada.postbox.wave({ to: bea.id, residentId: 'bea1', kind: 'poke', line: 2 });
  assert.equal(w.residentName, 'Snag');
  box = await bea.postbox.load();
  assert.equal(box.waves[0].residentName, 'Snag');
  assert.equal(boxCount(box), 2, 'an unseen wave and an unseen signature');
  await bea.postbox.seen();
  assert.equal(bea.postbox.count(), 0);
  await bea.postbox.clear();
  box = await bea.postbox.load();
  assert.deepEqual([box.waves.length, box.signatures.length, box.gifts.length], [0, 0, 0]);
  await bea.postbox.removeSignature(book.entries[0].id);
  assert.equal((await bea.postbox.guestbook(bea.id)).entries.length, 0);
});

test('Do not disturb refuses politely; blocking hides everything; offline queues nothing', async () => {
  const { fake, ada, bea, cat } = await world();
  await cat.postbox.sendGift(bea.id, 'moth-pie');
  assert.equal(await bea.postbox.setDnd(true), true);
  for (const attempt of [
    () => ada.postbox.sendVisit({ to: bea.id, pet: ada.shelf.pets[0], days: 1 }),
    () => ada.postbox.sendGift(bea.id, 'moth-pie'),
    () => ada.postbox.wave({ to: bea.id, residentId: 'bea0', kind: 'wave', line: 0 })
  ]) await assert.rejects(attempt(), e => e.code === 'dnd' && /Do not disturb/.test(e.message));
  await assert.rejects(ada.social.serve({ to: bea.id, caseId: 'borrowed-coffin', plaintiff: ada.shelf.pets[0], defendant: bea.shelf.pets[0] }), e => /Do not disturb/.test(e.message));
  assert.equal((await bea.postbox.load()).gifts.length, 1, 'what had arrived stays');
  await bea.postbox.setDnd(false);

  await ada.postbox.sendVisit({ to: bea.id, pet: ada.shelf.pets[0], days: 1 });
  await ada.postbox.sign(bea.id, 1, 'eye');
  await bea.social.block(ada.id);
  const box = await bea.postbox.load();
  assert.deepEqual([box.requests.length, box.signatures.length], [0, 0]);
  await assert.rejects(ada.postbox.sendGift(bea.id, 'moth-pie'), e => e.code === 'not_friends');

  const before = fake.requests.length;
  fake.setOffline(true);
  await assert.rejects(cat.postbox.sendGift(ada.id, 'moth-pie'), e => e.offline === true);
  fake.setOffline(false);
  assert.equal(fake.postbox.gifts.filter(g => g.to_user === ada.id).length, 0, 'nothing was queued');
  assert.ok(fake.requests.length >= before);
});
