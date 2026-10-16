// The Kin client (src/cloud/kin.js) against the in-memory fake, which mirrors
// supabase/migrations/0010_kin.sql: two players, a basket, a foundling on
// both shelves, letters and replies, refusals, and readers that do not trust
// the server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { createCloud } from '../src/cloud/client.js';
import { createSocial, readResident } from '../src/cloud/social.js';
import { createKin, kinText, kinCode, readBasket, readLetter, readPal, readKinMail, readCard, parentSnapshot } from '../src/cloud/kin.js';
import { realizeFoundling } from '../src/art/kin-art.js';
import { foundlingId, foundlingName, foundlingPet } from '../src/engine/kin.js';
import { absorbMail, adopt, foundlingRecord, keepLetter } from '../src/ui/kin.js';
import { replyOptions } from '../src/engine/kin-letters.js';
import { generateCreature } from '../src/art/creatures.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { kinWeek } from './support/fake-kin.mjs';

const T0 = Date.UTC(2026, 9, 12, 12);
const DAY = 86400000;
function memory() {
  const items = new Map();
  return { getItem: k => items.has(k) ? items.get(k) : null, setItem: (k, v) => { items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
}
function household(names, prefix) {
  const s = blankState();
  s.pets = names.map((name, i) => ({ id: prefix + i, name, traits: i % 2 ? ['litigious', 'sugar'] : ['spiteful', 'damp'], needs: { food: 80, fuss: 80, clean: 80 }, bond: 3,
    art: { body: '', stamps: [], creature: generateCreature({ seed: prefix + 'c' + i }) } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return normalizeState(s);
}
function world() {
  let clock = T0;
  const fake = createFakeSupabase({ now: () => clock });
  async function player(name, shelf) {
    const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory(), now: () => clock });
    await cloud.signInAnonymously();
    const social = createSocial({ cloud, getState: () => shelf, now: () => clock });
    social.optIn();
    await social.setName(name);
    const me = await social.profile();
    await social.publish({ force: true });
    return { cloud, social, kin: createKin({ cloud }), shelf, id: cloud.userId(), code: me.code, name };
  }
  return { fake, player, tick: ms => { clock += ms; }, get now() { return clock; } };
}
async function friends(w, a, b, { daysAgo = 8 } = {}) {
  await a.social.addFriend(b.code);
  await b.social.respond(a.id, true);
  const f = w.fake.social.friendships.find(x => [x.requester, x.addressee].includes(a.id) && [x.requester, x.addressee].includes(b.id));
  f.created_at = new Date(w.now - daysAgo * DAY).toISOString();
}
const refused = code => err => { assert.equal(kinCode(err), code, err.message); return true; };

test('a basket, accepted, gives both shelves the same foundling with the right parents', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel', 'Pip'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs', 'Snag', 'Wanda'], 'b'));
  await friends(w, ada, bea);
  const left = await ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[0], theirs: 'b0' });
  assert.ok(left.id && left.expiresAt === w.now + 48 * 3600000);
  await assert.rejects(ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[1], theirs: 'b1' }), refused('basket_waiting'));
  const out = await ada.kin.mail();
  assert.deepEqual(out.baskets.map(b => [b.direction, b.status, b.seed]), [['out', 'offered', null]], 'the leaver does not see the seed');
  assert.equal(out.friends.find(f => f.userId === bea.id).openBasket, true);
  const box = await bea.kin.mail();
  const [basket] = box.baskets;
  assert.deepEqual([basket.direction, basket.status, basket.fromParent.name, basket.toParentName], ['in', 'offered', 'Mabel', 'Grubbs']);
  assert.ok(basket.fromParent.art.creature, 'the whole parent, to preview the child');
  // Bea previews from exactly what she will send.
  const snapshot = parentSnapshot(bea.shelf.pets[0]);
  const preview = await realizeFoundling({ a: basket.fromParent, b: readResident(snapshot), seed: basket.seed });
  const born = await bea.kin.answerBasket(basket.id, { accept: true, parent: snapshot, nameRoll: 3 });
  assert.equal(born.status, 'born');
  const beaPet = foundlingPet({ ...preview, name: foundlingName('Mabel', 'Grubbs', basket.seed, 3) }, { basketId: basket.id, born: w.now });
  assert.equal(adopt(bea.shelf, beaPet, foundlingRecord({ ...basket, toParent: readResident(snapshot) }, beaPet, 'in', 'Ada'), preview.birth), 'adopted');
  // Ada's device finds the birth and takes her copy in.
  const mail = await ada.kin.mail();
  const [step] = mail.births;
  assert.equal(step.seed, basket.seed);
  const result = await absorbMail({ state: ada.shelf, mail, kin: ada.kin, shelfName: () => 'Bea', now: w.now });
  assert.equal(result.adopted.length, 1);
  const adaPet = ada.shelf.pets.find(p => p.id === foundlingId(basket.id));
  for (const key of ['id', 'name', 'traits', 'stats', 'bio']) assert.deepEqual(adaPet[key], beaPet[key], key + ' matches on both shelves');
  assert.deepEqual(adaPet.art, beaPet.art);
  assert.deepEqual(ada.shelf.kin.foundlings[0].parents.map(p => [p.name, p.home, p.shelf]), [['Mabel', true, ''], ['Grubbs', false, 'Bea']]);
  assert.deepEqual(bea.shelf.kin.foundlings[0].parents.map(p => [p.name, p.home, p.shelf]), [['Mabel', false, 'Ada'], ['Grubbs', true, '']]);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(w.fake.kin.receipts.get(ada.id + '|' + basket.id).claimed_at, 'claimed on the server');
  assert.equal((await ada.kin.mail()).births.length, 0);
  // Both saves stay valid.
  assert.ok(normalizeState(JSON.parse(JSON.stringify(ada.shelf))));
  assert.ok(normalizeState(JSON.parse(JSON.stringify(bea.shelf))));
  // The next basket waits 14 days, whoever asks.
  await assert.rejects(bea.kin.leaveBasket({ to: ada.id, pet: bea.shelf.pets[1], theirs: 'a1' }), refused('too_soon'));
  w.tick(15 * DAY);
  assert.ok((await bea.kin.leaveBasket({ to: ada.id, pet: bea.shelf.pets[1], theirs: 'a1' })).id);
});

test('pen pals get a letter a week by the server week, and a reply reads the same on both shelves', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await friends(w, ada, bea);
  const pal = await ada.kin.introduce({ to: bea.id, mine: 'a0', theirs: 'b0' });
  const box = await bea.kin.mail();
  assert.equal(box.week, kinWeek(w.now));
  const [letter] = box.letters;
  assert.deepEqual([letter.pal, letter.kind, letter.writer.name, letter.reader.name], [pal.id, 'weekly', 'Mabel', 'Grubbs']);
  assert.equal((await bea.kin.mail()).letters.length, 1, 'once a week');
  const kept = keepLetter(bea.shelf, box, letter, 'Ada');
  assert.match(kept.text, /^Dear Grubbs,\n\n/);
  assert.match(kept.text, /\nMabel\n\nP\.S\. /);
  const options = replyOptions({ seed: kept.cards.seed, week: kept.week, writer: kept.cards.reader, reader: kept.cards.writer });
  const sent = await bea.kin.reply(letter.id, 1);
  await assert.rejects(bea.kin.reply(letter.id, 0), refused('already_replied'));
  const adaBox = await ada.kin.mail();
  const reply = adaBox.letters.find(l => l.id === sent.id);
  assert.equal(reply.kind, 'reply');
  assert.equal(keepLetter(ada.shelf, adaBox, reply, 'Bea').text, options[1].text, 'Ada reads exactly what Bea chose');
  assert.equal(await ada.kin.read(reply.id), true);
  assert.equal((await ada.kin.mail()).letters.some(l => l.id === reply.id), false);
  w.tick(7 * DAY);
  assert.equal((await bea.kin.mail()).letters.filter(l => l.kind === 'weekly').length, 1, 'the next week brings the next letter');
  // Stopping ends it for both.
  await bea.kin.end(pal.id);
  assert.equal((await ada.kin.mail()).pals.length, 0);
});

test('refusals reach the player as plain sentences', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await assert.rejects(ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[0], theirs: 'b0' }), refused('not_friends'));
  await friends(w, ada, bea, { daysAgo: 1 });
  await assert.rejects(ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[0], theirs: 'b0' }), err => /no history yet/.test(err.message));
  await assert.rejects(ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[0], theirs: 'nobody' }), refused('not_found'));
  w.fake.profiles.get(bea.id).dnd_until = new Date(w.now + DAY).toISOString();
  await assert.rejects(ada.kin.introduce({ to: bea.id, mine: 'a0', theirs: 'b0' }), refused('do_not_disturb'));
  delete w.fake.profiles.get(bea.id).dnd_until;
  w.fake.setOffline(true);
  await assert.rejects(ada.kin.mail(), err => kinCode(err) === 'offline' && /No connection/.test(err.message));
  w.fake.setOffline(false);
  await ada.cloud.signOut();
  await assert.rejects(ada.kin.mail(), err => /Sign in to cloud save first/.test(err.message));
  assert.equal(kinText({ code: 'P0001', message: 'shelf_full' }), 'Your shelf is full. Rehome someone or put furniture away first.');
  assert.equal(kinText({ code: 'P0001', message: 'too_large' }), 'Too large to send. Drawn residents take the most room.');
  assert.equal(kinText(null), 'The cloud did not answer properly. Try again in a moment.');
});

test('a full shelf on show cannot accept, and blocking takes waiting baskets back in', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(Array.from({ length: 18 }, (_, i) => 'Dweller ' + i), 'b'));
  await friends(w, ada, bea);
  await ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[0], theirs: 'b0' });
  const [basket] = (await bea.kin.mail()).baskets;
  await assert.rejects(bea.kin.answerBasket(basket.id, { accept: true, parent: parentSnapshot(bea.shelf.pets[0]) }), refused('shelf_full'));
  await bea.social.block(ada.id);
  assert.equal(w.fake.kin.baskets.size, 0);
  assert.deepEqual((await bea.kin.mail()).baskets, []);
});

test('readers drop what they do not recognise', () => {
  const me = '00000000-0000-4000-8000-00000000000a', other = '00000000-0000-4000-8000-00000000000b';
  const id = '00000000-0000-4000-8000-0000000000aa';
  const parent = { id: 'p0', name: '<b>Mabel</b>', traits: ['spiteful', '__proto__'], art: { creature: { body: 'pear', palette: 'mint', parts: { eyes: 'evil' } } } };
  const base = { id, direction: 'in', status: 'offered', from_user: other, to_user: me, from_parent: parent, to_parent_id: 'b0', seed: 12 };
  assert.ok(readBasket(base, me));
  assert.equal(readBasket({ ...base, direction: 'out' }, me), null, 'direction must match who is asking');
  assert.equal(readBasket({ ...base, seed: null }, me), null, 'an offer to us needs its seed');
  assert.equal(readBasket({ ...base, status: 'born' }, me), null, 'a birth needs both parents');
  assert.equal(readBasket({ ...base, to_parent_id: '../x' }, me), null);
  assert.equal(readBasket(base, me).fromParent.art.creature.parts.eyes, 'pair', 'parts rebuilt from known ones');
  assert.equal(readBasket(base, me).fromParent.name, '<b>Mabel</b>', 'names are text; the UI escapes them');
  assert.equal(readPal({ id, friend: other, mine: { id: 'a' }, theirs: { id: 'b' }, history: 'sorcery', seed: 1 }), null);
  assert.ok(readPal({ id, friend: other, mine: { id: 'a' }, theirs: { id: 'b' }, history: 'twin', seed: 1 }));
  const letter = { id, pal_id: id, from_user: other, kind: 'reply', week: 150, writer: { id: 'w', name: 'W' }, reader: { id: 'r', name: 'R' } };
  assert.equal(readLetter(letter), null, 'a reply needs its choice');
  assert.ok(readLetter({ ...letter, reply_to: id, choice: 2 }));
  assert.equal(readLetter({ ...letter, kind: 'weekly', week: -1 }), null);
  assert.deepEqual(readCard({ id: 'x', name: 'A'.repeat(40), traits: ['damp', 'damp', 'nope'], mood: 'ecstatic' }), { id: 'x', name: 'A'.repeat(22), traits: ['damp'], mood: 'fine' });
  const mail = readKinMail({ baskets: Array(40).fill(base), pals: 'x', letters: [null, 4], friends: [{ user_id: other, hearings: [['a', 'b'], ['bad id!', 'c'], 'x'] }] }, me);
  assert.equal(mail.baskets.length, 1, 'duplicates and the overflow are dropped');
  assert.deepEqual(mail.friends[0].hearings, [['a', 'b']]);
  assert.deepEqual([mail.pals, mail.letters], [[], []]);
});

test('birth receipts: the mail carries unclaimed ones, the index pages, and ids that are not ours come back empty', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel', 'Pip'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs', 'Snag'], 'b'));
  const cat = await w.player('Cat', household(['Clod'], 'c'));
  await friends(w, ada, bea);
  const left = await ada.kin.leaveBasket({ to: bea.id, pet: ada.shelf.pets[0], theirs: 'b0' });
  await bea.kin.answerBasket(left.id, { accept: true, parent: parentSnapshot(bea.shelf.pets[0]) });
  const [mine] = (await ada.kin.mail()).births;
  assert.deepEqual([mine.id, mine.direction, mine.status, mine.collected, mine.fromParent.name, mine.toParent.name], [left.id, 'out', 'born', false, 'Mabel', 'Grubbs']);
  const [theirs] = (await bea.kin.mail()).births;
  assert.deepEqual([theirs.direction, theirs.fromName, theirs.toName], ['in', 'Ada', 'Bea'], 'the recipient has one too, from her side');
  assert.equal(theirs.seed, mine.seed);
  const index = await ada.kin.recover();
  assert.deepEqual(index.items.map(i => [i.id, i.claimed]), [[left.id, false]]);
  assert.equal(index.next, null);
  assert.deepEqual((await ada.kin.receipts([left.id, left.id])).map(b => b.id), [left.id], 'asked twice, answered once');
  assert.deepEqual(await cat.kin.receipts([left.id]), [], 'someone else’s receipt is not theirs to read');
  assert.deepEqual((await cat.kin.recover()).items, []);
  const claim = await ada.kin.collect(left.id);
  assert.equal(claim.id, left.id);
  assert.ok(claim.claimedAt >= w.now - 1);
  assert.equal((await ada.kin.collect(left.id)).claimedAt, claim.claimedAt, 'claiming twice keeps the first time');
  assert.deepEqual((await ada.kin.mail()).births, []);
  assert.equal((await ada.kin.recover()).items[0].claimed, true, 'a claim is a bookmark: the receipt stays');
  await assert.rejects(cat.kin.collect(left.id), refused('not_found'));
  assert.deepEqual(await ada.kin.receipts(['not-a-uuid']), [], 'a malformed id is dropped before asking');
  // Many ids go four to a call.
  const ids = Array.from({ length: 9 }, (_, i) => '00000000-0000-4000-8000-0000000003' + String(10 + i));
  assert.deepEqual(await ada.kin.receipts(ids), []);
});

test('a server from before receipts: its uncollected outgoing births ride in the baskets', () => {
  const me = '00000000-0000-4000-8000-00000000000a', other = '00000000-0000-4000-8000-00000000000b', id = '00000000-0000-4000-8000-0000000000aa';
  const parent = { id: 'p0', name: 'Mabel', traits: [], art: { creature: { body: 'pear', palette: 'mint', parts: {} } } };
  const born = { id, direction: 'out', status: 'born', from_user: me, to_user: other, from_parent: parent, to_parent_id: 'b0', to_parent: { ...parent, id: 'b0' }, seed: 5, collected: false };
  assert.deepEqual(readKinMail({ baskets: [born] }, me).births.map(b => b.id), [id]);
  assert.deepEqual(readKinMail({ baskets: [born], births: [] }, me).births, [], 'a server that sends births is believed');
  assert.deepEqual(readKinMail({ baskets: [{ ...born, collected: true }] }, me).births, []);
  assert.equal(readKinMail({ baskets: [born], births: [born, { ...born, id: 'junk' }], births_more: true }, me).birthsMore, true);
  assert.equal(readKinMail({ baskets: [born], births: [born, { ...born, id: 'junk' }] }, me).births.length, 1, 'a birth that does not read is dropped');
  assert.equal(readKinMail({ baskets: [born] }, me).baskets.length, 0, 'a born basket is never listed as a basket');
});
