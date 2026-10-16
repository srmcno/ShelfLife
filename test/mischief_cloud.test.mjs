// The mischief client (src/cloud/mischief.js) against the in-memory server
// (test/support/fake-mischief.mjs), with two players, and the readers against
// hostile replies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { householdFixture } from './household-fixtures.mjs';
import {
  createMischief, readMischiefInbox, readHex, readKnockResult, compactGuest, mischiefText, mischiefCode, MAX_GUEST_CHARS
} from '../src/cloud/mischief.js';
import { CloudError } from '../src/cloud/client.js';
import * as X from '../src/engine/mischief.js';
import { resolveEmergency, describeEmergency } from '../src/engine/mayhem.js';
import { HEX_IDS, TRICK_IDS } from '../src/content/mischief.js';

let clock = Date.UTC(2026, 9, 20, 18);
const now = () => clock;
const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

function household(names) {
  const s = householdFixture('established', Date.now());
  s.pets.forEach((p, i) => { p.name = names[i]; });
  s.mayhem.queue = []; s.mayhem.nextAt = clock + 600000;
  return s;
}
async function world() {
  clock = Date.UTC(2026, 9, 20, 18);
  const fake = createFakeSupabase({ now });
  const ada = await socialPlayer(fake, 'Ada', household(['Agnes', 'Grubbs', 'Pip']), { now });
  const bea = await socialPlayer(fake, 'Bea', household(['Gladys', 'Snag', 'Wanda']), { now });
  const cat = await socialPlayer(fake, 'Cat', household(['Mildred', 'Crumb', 'Nell']), { now });
  for (const [x, y] of [[ada, bea], [cat, bea], [ada, cat]]) { await x.social.addFriend(y.code); await y.social.respond(x.id, true); }
  for (const p of [ada, bea, cat]) { p.mx = createMischief({ cloud: p.cloud, social: p.social, now }); await p.social.publish({ force: true }); }
  return { fake, ada, bea, cat };
}
const refused = token => error => { assert.equal(mischiefCode(error), token, error.message); assert.equal(error.message, mischiefText(error)); return true; };

test('readers keep only what this edition knows, and keep it small', () => {
  const huge = 'data:image/png;base64,' + 'A'.repeat(100 * 1024);
  const raw = { status: { hand: ['sock-of-ill-omen', 'no-such', 'sock-of-ill-omen', 'damp-invitation', 'express-coffin'], hexed_today: 'yes', season: true,
      helped: [U(1), 'nope', U(1)], rebounds: [{ id: U(2), to_user: U(3), card: 'x' }, { id: 'bad' }] },
    hexes: [
      { id: U(4), from_user: U(5), from_name: 'Bea\u0000' + 'x'.repeat(80), card: 'sock-of-ill-omen', culprit: { id: 'g1', name: '<b>Grubbs</b>', art: { body: huge, stamps: [] } },
        created_at: '2026-10-20T10:00:00Z', expires_at: '2027-01-01T00:00:00Z' },
      { id: U(6), from_user: U(5), card: 'not-a-card', culprit: { id: 'g1' }, created_at: '2026-10-20T10:00:00Z' },
      { id: U(7), from_user: U(5), card: 'sock-of-ill-omen', culprit: { id: '../x' }, created_at: '2026-10-20T10:00:00Z' },
      'junk', null
    ],
    helps: [{ id: U(8), from_user: U(5), resident_id: 'qa0', need: 'food', amount: 900 }, { id: U(9), from_user: U(5), resident_id: 'qa0', need: 'gravy' }],
    results: [{ id: U(10), to_user: U(5), status: 'resolved', card: 'sock-of-ill-omen', choice: 7, outcome: 1 }, { id: U(11), to_user: U(5), status: 'exploded' }],
    doorstep: { bowl: 'caviar', count: -4, knocks: [{ id: U(12), from_user: U(5), result: 'treat' }, { id: U(13), from_user: U(5), result: 'bribe' }] } };
  const box = readMischiefInbox(raw);
  assert.deepEqual(box.status.hand, ['sock-of-ill-omen', 'damp-invitation', 'express-coffin'], 'known cards, three at most, no repeats');
  assert.equal(box.status.hexedToday, false);
  assert.deepEqual(box.status.helped, [U(1)]);
  assert.deepEqual(box.status.rebounds, [{ id: U(2), toUser: U(3), card: '' }]);
  assert.equal(box.hexes.length, 1);
  const [h] = box.hexes;
  assert.equal(h.fromName.length, 24);
  assert.equal(h.culprit.name, '<b>Grubbs</b>', 'kept as text; the UI escapes it');
  assert.equal(h.culprit.art.body, '', 'a drawing too big for the save stays out');
  assert.ok(JSON.stringify(h.culprit).length <= MAX_GUEST_CHARS);
  assert.equal(h.expiresAt - h.createdAt, 48 * 3600000, 'never longer than 48 hours, whatever the server says');
  assert.deepEqual(box.helps.map(x => [x.need, x.amount]), [['food', 30]]);
  assert.deepEqual(box.results.map(r => [r.status, r.choice, r.outcome]), [['resolved', null, 1]]);
  assert.deepEqual([box.doorstep.bowl, box.doorstep.count, box.doorstep.knocks.length], ['none', 0, 1]);
  assert.equal(readHex({ ...raw.hexes[0], id: 'x' }), null);
  assert.equal(readKnockResult({ result: 'trick', prize: 'souls' }), null, 'a trick names a trick card');
  assert.deepEqual(readKnockResult({ id: U(1), result: 'treat', prize: 'souls', souls: 400, bowl: 'raisins' }), { id: U(1), result: 'treat', prize: 'souls', souls: 30, bowl: 'raisins', culprit: null });
  assert.equal(compactGuest({ id: 'g', name: 'G', art: { creature: { body: 'constructor', parts: { eyes: '__proto__' } } } }).art.creature.v, 1, 'creatures are rebuilt from known parts');
});

test('refusals read as plain sentences', () => {
  for (const token of ['hexed_today', 'shelf_full', 'dnd', 'not_in_hand', 'no_rebound', 'haunted_this_week', 'already_haunted', 'helped_today', 'helps_full',
    'helped_enough', 'not_needed', 'out_of_season', 'knocked_tonight', 'expired']) {
    const text = mischiefText({ code: 'P0001', message: token });
    assert.ok(text.length > 10 && !/unexpected|properly/.test(text), token + ': ' + text);
  }
  assert.match(mischiefText({ offline: true }), /No connection/);
  assert.match(mischiefText({ code: 'P0001', message: 'not_friends' }), /not friends/);
  assert.match(mischiefText(new CloudError('x', { status: 500, code: 'XX000' })), /did not answer properly/);
});

test('a hex goes from one shelf to another, is played, and its sender reads how it went', async () => {
  const { fake, ada, bea } = await world();
  const box = await ada.mx.inbox();
  assert.equal(box.status.hand.length, 3);
  await assert.rejects(ada.mx.sendHex({ to: bea.id, card: HEX_IDS.find(c => !box.status.hand.includes(c)), culprit: 'qa1' }), refused('not_in_hand'));
  await assert.rejects(ada.mx.sendHex({ to: bea.id, card: box.status.hand[0], culprit: 'nobody' }), refused('bad_culprit'));
  await ada.mx.sendHex({ to: bea.id, card: box.status.hand[0], culprit: 'qa1' });
  assert.equal(ada.mx.cached().status.hexedToday, true, 'the cache knows at once');
  await assert.rejects(ada.mx.sendHex({ to: bea.id, card: box.status.hand[1], culprit: 'qa1' }), refused('hexed_today'));
  // Bea's device picks it up.
  const mail = await bea.mx.inbox();
  assert.deepEqual(mail.hexes.map(h => [h.fromName, h.card, h.culprit.name]), [['Ada', box.status.hand[0], 'Grubbs']]);
  const news = X.receiveInbox(bea.shelf, mail, bea.id, clock);
  assert.equal(news.hexes.length, 1);
  const [entry] = X.settleMischief(bea.shelf, clock);
  assert.equal(describeEmergency(bea.shelf, entry).b.name, 'Grubbs');
  const card = describeEmergency(bea.shelf, entry).template;
  const choice = card.choices.findIndex(c => c.outcomes.some(o => o.rebound));
  const reboundAt = card.choices[Math.max(0, choice)].outcomes.findIndex(o => o.rebound);
  const n = card.choices[Math.max(0, choice)].outcomes.length;
  resolveEmergency(bea.shelf, entry.uid, Math.max(0, choice), clock, (() => { let i = 0; return () => (i++ ? 0.99 : (Math.max(0, reboundAt) + 0.5) / n); })());
  // The outbox reaches the server.
  for (const item of X.outboxFor(bea.shelf, bea.id)) { await bea.mx.resolveHex(item.ref, item); X.clearOutbox(bea.shelf, [item]); }
  assert.equal(fake.mischief.hexes.size, 1);
  const row = [...fake.mischief.hexes.values()][0];
  assert.equal(row.status, 'resolved');
  const results = (await ada.mx.inbox()).results;
  assert.equal(results.length, 1);
  const line = X.hexResultLine(results[0]);
  assert.match(line, /^Bea resolved your .+\./);
  await ada.mx.seen('hex', results[0].id);
  assert.deepEqual((await ada.mx.inbox()).results, []);
  // A rebound is a free hex back, once.
  assert.equal(row.rebound, choice >= 0, 'the rebound the victim rolled reached the server');
  if (row.rebound) {
    const reb = (await bea.mx.inbox()).status.rebounds;
    assert.deepEqual(reb.map(r => r.toUser), [ada.id]);
    await bea.mx.sendHex({ to: ada.id, card: HEX_IDS[0], culprit: 'qa0', rebound: reb[0].id });
    await assert.rejects(bea.mx.sendHex({ to: ada.id, card: HEX_IDS[1], culprit: 'qa0', rebound: reb[0].id }), refused('no_rebound'));
    assert.equal((await ada.mx.inbox()).hexes[0].rebound, true);
  }
});

test('the fake keeps the server’s limits: two waiting per shelf, Do not disturb, blocks', async () => {
  const { fake, ada, bea, cat } = await world();
  const dan = await socialPlayer(fake, 'Dan', household(['Doreen', 'Snag', 'Nell']), { now });
  dan.mx = createMischief({ cloud: dan.cloud, social: dan.social, now });
  await dan.social.addFriend(bea.code); await bea.social.respond(dan.id, true); await dan.social.publish({ force: true });
  for (const p of [ada, cat]) await p.mx.sendHex({ to: bea.id, card: (await p.mx.inbox()).status.hand[0], culprit: 'qa0' });
  await assert.rejects(dan.mx.sendHex({ to: bea.id, card: (await dan.mx.inbox()).status.hand[0], culprit: 'qa0' }), refused('shelf_full'));
  fake.mischief.setDnd(ada.id);
  await assert.rejects(bea.mx.sendHex({ to: ada.id, card: (await bea.mx.inbox()).status.hand[0], culprit: 'qa0' }), refused('dnd'));
  await assert.rejects(bea.mx.knock(ada.id), refused('dnd'));
  fake.mischief.setDnd(ada.id, false);
  await bea.social.block(ada.id);
  assert.deepEqual((await bea.mx.inbox()).hexes.map(h => h.fromName), ['Cat'], 'the block took Ada’s hex with it');
  await assert.rejects(ada.mx.sendHaunt({ to: bea.id, resident: 'qa0' }), refused('not_friends'));
  clock += 49 * 3600000;
  assert.deepEqual((await bea.mx.inbox()).hexes, [], 'expired after two days');
  assert.equal((await cat.mx.inbox()).results[0].status, 'expired');
});

test('help: the published needs decide, the owner applies it once, and the helper is paid', async () => {
  const { ada, bea } = await world();
  bea.shelf.pets[1].needs = { food: 22, fuss: 90, clean: 35 };
  await bea.social.publish({ force: true });
  const shelf = await ada.social.shelf(bea.id);
  assert.deepEqual(shelf.shelf.residents[1].needs, { food: 20, fuss: 90, clean: 40 }, 'published, rounded to tens');
  await assert.rejects(ada.mx.help({ to: bea.id, resident: 'qa1', need: 'fuss' }), refused('not_needed'));
  await ada.mx.help({ to: bea.id, resident: 'qa1', need: 'food' });
  await assert.rejects(ada.mx.help({ to: bea.id, resident: 'qa1', need: 'clean' }), refused('helped_today'));
  const paid = X.helped(ada.shelf, { need: 'food', petName: 'Snag', friend: 'Bea' }, clock);
  assert.equal(paid.souls, X.HELP_SOULS);
  const before = bea.shelf.pets[1].needs.food;
  const news = X.receiveInbox(bea.shelf, await bea.mx.inbox(), bea.id, clock);
  assert.deepEqual(news.helps.map(h => [h.from.name, h.petName, h.need]), [['Ada', 'Snag', 'food']]);
  assert.equal(bea.shelf.pets[1].needs.food, before + 25);
  const acks = X.outboxFor(bea.shelf, bea.id);
  assert.equal(await bea.mx.ackHelps(acks.map(o => o.ref)), 1);
  assert.equal(await bea.mx.ackHelps(acks.map(o => o.ref)), 0, 'once');
  assert.deepEqual((await bea.mx.inbox()).helps, []);
  assert.equal(X.helpLineFor(bea.shelf, bea.shelf.pets[1], clock), 'Ada fed Snag while you were out.');
});

test('a haunting is sent, shooed, and reported back', async () => {
  const { ada, bea } = await world();
  await ada.mx.sendHaunt({ to: bea.id, resident: 'qa2' });
  await assert.rejects(ada.mx.sendHaunt({ to: bea.id, resident: 'qa2' }), refused('haunted_this_week'));
  X.receiveInbox(bea.shelf, await bea.mx.inbox(), bea.id, clock);
  assert.equal(X.activeHaunt(bea.shelf, clock).ghost.name, 'Pip');
  X.shooHaunt(bea.shelf, 7, clock);
  const [item] = X.outboxFor(bea.shelf, bea.id);
  await bea.mx.shoo(item.ref, item.taps);
  const [r] = (await ada.mx.inbox()).hauntResults;
  assert.deepEqual([r.status, r.taps, r.ghostName], ['shooed', 7, 'Pip']);
  assert.match(X.hauntResultLine(r), /Bea|Pip/);
});

test('trick-or-treat: the server rolls once a night, only in season', async () => {
  const { fake, ada, bea } = await world();
  await bea.mx.setBowl('apples');
  await assert.rejects(bea.mx.setBowl('caviar'), refused('bad_bowl'));
  const knock = await ada.mx.knock(bea.id);
  assert.ok(['treat', 'trick'].includes(knock.result));
  assert.equal(knock.bowl, 'apples');
  if (knock.result === 'trick') { assert.ok(TRICK_IDS.includes(knock.prize)); assert.ok(knock.culprit?.name); }
  await assert.rejects(ada.mx.knock(bea.id), refused('knocked_tonight'));
  const door = (await bea.mx.inbox()).doorstep;
  assert.deepEqual([door.count, door.knocks[0].fromName], [1, 'Ada']);
  assert.ok((await ada.mx.inbox()).status.knocked.includes(bea.id));
  const out = X.takeKnock(ada.shelf, { userId: bea.id, name: 'Bea' }, knock, clock);
  assert.ok(out.line.length > 10 && !out.line.includes('{'));
  clock = Date.UTC(2026, 11, 1, 18);
  await assert.rejects(ada.mx.knock(bea.id), refused('out_of_season'));
  assert.equal(fake.mischief.knocks.size, 1);
});

test('signed out, the client sends nothing and says why', async () => {
  const { ada, bea } = await world();
  await ada.cloud.signOut?.();
  const before = ada.mx.cached();
  await assert.rejects(ada.mx.inbox(), refused('signed_out'));
  await assert.rejects(ada.mx.knock(bea.id), refused('signed_out'));
  assert.equal(before === null || typeof before === 'object', true);
});

test('every late write belongs to the account that started it', async () => {
  const writes = [
    ['sendHex', mx => mx.sendHex({ to: U(3), card: HEX_IDS[0], culprit: 'qa0' }), { id: U(4) }],
    ['sendHaunt', mx => mx.sendHaunt({ to: U(3), resident: 'qa0' }), { id: U(4) }],
    ['help', mx => mx.help({ to: U(3), resident: 'qa0', need: 'food' }), { id: U(4), amount: 25 }],
    ['knock', mx => mx.knock(U(3)), { id: U(4), result: 'treat', prize: 'souls', souls: 5 }],
    ['setBowl', mx => mx.setBowl('apples'), { bowl: 'apples' }],
    ['resolveHex', mx => mx.resolveHex(U(4), { choice: 0, outcome: 0 }), { ok: true }],
    ['declineHex', mx => mx.declineHex(U(4)), { ok: true }],
    ['shoo', mx => mx.shoo(U(4), 5), { ok: true }],
    ['ackHelps', mx => mx.ackHelps([U(4)]), { count: 1 }],
    ['seen', mx => mx.seen('hex', U(4)), { ok: true }]
  ];
  for (const [name, write, reply] of writes) {
    let user = U(1), finish, started;
    const begun = new Promise(resolve => { started = resolve; });
    const cloud = { userId: () => user, rpc: async rpc => {
      if (rpc === 'mischief_inbox') return { status: { helped: [], helps_given: 0 } };
      started(); return new Promise(resolve => { finish = resolve; });
    } };
    const social = { signedIn: () => true, active: () => true, publish: async () => {} };
    const mx = createMischief({ cloud, social, now });
    await mx.inbox();
    const pending = write(mx);
    const rejected = assert.rejects(pending, refused('signed_out'), name);
    await begun;
    user = U(2);
    await mx.inbox();
    const before = structuredClone(mx.cached());
    finish(reply);
    await rejected;
    assert.deepEqual(mx.cached(), before, name + ' cannot patch the next account');
  }
});

test('switching accounts while publishing a culprit never sends from the replacement account', async () => {
  for (const send of [mx => mx.sendHex({ to: U(3), card: HEX_IDS[0], culprit: 'qa0' }), mx => mx.sendHaunt({ to: U(3), resident: 'qa0' })]) {
    let user = U(1), finish;
    const calls = [];
    const cloud = { userId: () => user, rpc: async name => { calls.push(name); return { id: U(4) }; } };
    const social = { signedIn: () => true, active: () => true, publish: () => new Promise(resolve => { finish = resolve; }) };
    const pending = send(createMischief({ cloud, social, now }));
    const rejected = assert.rejects(pending, refused('signed_out'));
    user = U(2); finish();
    await rejected;
    assert.deepEqual(calls, []);
  }
});

test('a stale inbox remains a discarded read while the replacement account loads independently', async () => {
  let user = U(1), finish;
  const cloud = { userId: () => user, rpc: () => user === U(1)
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ status: { helps_given: 2 } }) };
  const social = { signedIn: () => true, active: () => true };
  const mx = createMischief({ cloud, social, now });
  const old = mx.inbox();
  user = U(2);
  await mx.inbox();
  finish({ status: { helps_given: 1 } });
  assert.equal(await old, null);
  assert.equal(mx.cached().status.helpsGiven, 2);
});
