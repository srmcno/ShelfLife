import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { holdStake, stakeHeld, payDuel, markAttempt, attemptFor, applyCoopReceipts } from '../src/engine/coop.js';
import { coopState, normalizeCoop } from '../src/coop-state.js';
import { mayhemState } from '../src/mayhem-state.js';
const A = '00000000-0000-4000-8000-000000000001', B = A.replace(/1$/, '2'), D = A.replace(/1$/, '3');
const wallet = n => { const s = blankState(); mayhemState(s).souls = n; mayhemState(s).lifetime = 100; return s; };
const receipt = (seq, kind, delta, earned = 0, owner = A) => ({ id: A.replace(/1$/, String(seq + 3)), sourceId: D, owner, seq, kind, delta, earned });
test('duel holds, attempts and payout marks belong to the account that created them across reload', () => {
  const s = wallet(100);
  holdStake(s, D, 25, A); markAttempt(s, D, 1, 'sent', 5, {}, 1, A);
  assert.equal(stakeHeld(s, D, B), 0); assert.equal(attemptFor(s, D, 1, B), null);
  assert.equal(holdStake(s, D, 25, B), true); markAttempt(s, D, 1, 'played', 2, {}, 2, B);
  assert.equal(payDuel(s, D, 0, A), 0); assert.equal(payDuel(s, D, 50, B), 50);
  const reload = normalizeState(structuredClone(s));
  assert.equal(attemptFor(reload, D, 1, A).score, 5); assert.equal(attemptFor(reload, D, 1, B).score, 2);
  assert.equal(payDuel(reload, D, 50, B), 0); assert.equal(mayhemState(reload).souls, 100);
});
test('a lost payment response retries the same durable receipt once, including after reload', () => {
  const s = wallet(100), debit = receipt(1, 'stake', -25), credit = receipt(2, 'duel', 50, 25);
  applyCoopReceipts(s, A, [debit]);
  const reload = normalizeState(structuredClone(s));
  assert.equal(applyCoopReceipts(reload, A, [debit, credit]).paid, 50);
  assert.equal(applyCoopReceipts(reload, A, [debit, credit]).paid, 0);
  assert.deepEqual([mayhemState(reload).souls, mayhemState(reload).lifetime], [125, 125]);
});
test('restoring a backup from before the stake replays debit then refund without minting souls', () => {
  const old = wallet(100), receipts = [receipt(1, 'stake', -25), receipt(2, 'duel', 25)];
  applyCoopReceipts(old, A, receipts);
  assert.deepEqual([mayhemState(old).souls, mayhemState(old).lifetime], [100, 100]);
  const held = wallet(100); holdStake(held, D, 25, A);
  applyCoopReceipts(held, A, receipts);
  assert.equal(mayhemState(held).souls, 100, 'an already saved local hold is not charged again');
});
test('missing receipts and replacement-account replies are refused before wallet changes', () => {
  const s = wallet(100);
  assert.throws(() => applyCoopReceipts(s, A, [receipt(2, 'duel', 25)]), /sequence/);
  assert.throws(() => applyCoopReceipts(s, A, [receipt(1, 'hire', 12, 12, B)]), /sequence/);
  assert.equal(mayhemState(s).souls, 100); assert.equal(coopState(s).ledger[A], undefined);
});
test('an underfunded restored save retains debit debt rather than clamping it away', () => {
  const s = wallet(5);
  applyCoopReceipts(s, A, [receipt(1, 'stake', -25)]);
  assert.deepEqual([mayhemState(s).souls, coopState(s).ledger[A].debt], [0, 20]);
  const reload = normalizeState(structuredClone(s));
  applyCoopReceipts(reload, A, [receipt(2, 'duel', 25)]);
  assert.deepEqual([mayhemState(reload).souls, coopState(reload).ledger[A].debt], [5, 0]);
});
test('financial cursors survive many owner switches; activity limits cannot replay payments', () => {
  const ledger = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [A.slice(0, -3) + String(i).padStart(3, '0'), { seq: i, debt: 0 }]));
  assert.deepEqual(normalizeCoop({ ledger }).ledger, ledger);
});

test('a delayed cloud reply cannot return receipts or a turn for a replacement account', async () => {
  const { createCoop } = await import('../src/cloud/coop.js');
  let owner = A, release;
  const cloud = { configured: true, signedIn: () => true, userId: () => owner,
    rpc: () => new Promise(resolve => { release = resolve; }) };
  const coop = createCoop({ cloud, social: { active: () => true } });
  const pending = coop.receipts(0); owner = B;
  release({ receipts: [ { ...receipt(1, 'hire', 12, 12), source_id: D } ], more: false });
  await assert.rejects(pending);
});
test('financial readers refuse negative credits and a pagination reply that cannot advance', async () => {
  const { readCoopReceipts } = await import('../src/cloud/coop.js');
  assert.throws(() => readCoopReceipts({ receipts: [], has_more: true, last_seq: 1 }, A));
  assert.throws(() => readCoopReceipts({ receipts: [{ ...receipt(1, 'hire', -1), source_id: D }], has_more: false, last_seq: 1 }, A));
});

test('labelled fake server commits before a lost claim/collect response; durable retries recover both payments once', async () => {
  const { createFakeSupabase } = await import('./support/fake-supabase.mjs');
  const { socialPlayer } = await import('./support/social-world.mjs');
  const { householdFixture } = await import('./household-fixtures.mjs');
  const { createCoop } = await import('../src/cloud/coop.js');
  const fake = createFakeSupabase(), shelf = householdFixture('established');
  const ada = await socialPlayer(fake, 'Ada', shelf), bea = await socialPlayer(fake, 'Bea', shelf);
  await ada.social.addFriend(bea.code); await bea.social.respond(ada.id, true);
  let lose = '';
  const cloud = { ...ada.cloud, async rpc(name, args) {
    const result = await ada.cloud.rpc(name, args);
    if (name === lose) { lose = ''; throw Object.assign(new Error('Lost reply after commit'), { offline: true }); }
    return result;
  } };
  const coop = createCoop({ cloud, social: ada.social }), other = createCoop({ cloud: bea.cloud, social: bea.social });
  let local = wallet(100);
  await coop.openWallet(100);
  const duel = await coop.duelCreate(bea.id, 'stack', 25);
  applyCoopReceipts(local, ada.id, (await coop.receipts()).receipts);
  fake.coop.age(49 * 3600000); await coop.duels();
  lose = 'coop_duel_claim'; await assert.rejects(coop.duelClaim(duel.id));
  assert.equal(mayhemState(local).souls, 75);
  assert.deepEqual(await coop.duelClaim(duel.id), { souls: 0 }, 'retry compatibilityamount is0, but the committed refund receipt remains replayable');
  local = normalizeState(structuredClone(local));
  applyCoopReceipts(local, ada.id, (await coop.receipts(coopState(local).ledger[ada.id].seq)).receipts);
  assert.equal(mayhemState(local).souls, 100);
  await coop.setHires([shelf.pets[0]]);
  const h = await other.hire(ada.id, shelf.pets[0].id);
  await other.finishHire(h.id, { route: 'drawer', gear: 'thread', edition: 0, rev: 2, score: 8, tier: 2, returned: 0, built: false, choices: [1, 0, 1], helped: [0], crew: ['Bea'] });
  lose = 'coop_collect'; await assert.rejects(coop.collect(h.id));
  assert.equal(mayhemState(local).souls, 100);
  assert.deepEqual(await coop.collect(h.id), { wages: 0 }, 'retry reads the original receipt instead of issuing another payment');
  const page = await coop.receipts(coopState(local).ledger[ada.id].seq);
  applyCoopReceipts(local, ada.id, page.receipts); applyCoopReceipts(local, ada.id, page.receipts);
  assert.equal(mayhemState(local).souls, 112);
  assert.equal(fake.coop.receipts.filter(r => r.owner === ada.id).length, 3, 'one debit and two immutable credits');
});

test('unowned prototype holds and attempts are quarantined rather than adopted by the current account', () => {
  const s = wallet(100);
  s.coop = normalizeCoop({ stakes: [{ duelId: D, amount: 25 }], attempts: [{ duelId: D, round: 1, state: 'sent' }], done: ['d:' + D] });
  assert.equal(stakeHeld(s, D, A), 0); assert.equal(attemptFor(s, D, 1, A), null);
  assert.equal(stakeHeld(s, D, B), 0); assert.equal(attemptFor(s, D, 1, B), null);
  assert.equal(s.coop.stakes.length, 1, 'retained for explicit prototype migration, never assigned by guess');
});

test('hire listings and friend-record caches have an explicit owner and are rebuilt on owner replacement', async () => {
  const { setListed, rememberRecords } = await import('../src/engine/coop.js');
  const s = wallet(100); s.pets = [{ id: 'resident' }];
  setListed(s, ['resident'], A);
  rememberRecords(s, [{ friend: D, duelsWon: 4 }], 1, A);
  const reload = normalizeState(structuredClone(s));
  assert.equal(coopState(reload).listedOwner, A); assert.equal(coopState(reload).recordsOwner, A);
  rememberRecords(reload, [], 2, B);
  assert.equal(coopState(reload).recordsOwner, B); assert.deepEqual(coopState(reload).records, {});
  setListed(reload, [], B); assert.equal(coopState(reload).listedOwner, B); assert.deepEqual(coopState(reload).listed, []);
});
