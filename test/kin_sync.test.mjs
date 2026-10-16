// How Kin keeps what the cloud brings: one look per account, nothing written
// after the account or the household changed under it, and a foundling that is
// claimed on the server only once it is safe on the device. Runs the real UI
// module (src/ui/kin.js) and client against the in-memory fake, which mirrors
// supabase/migrations/0010_kin.sql. The real SQL has its own tests
// (kin_sql.test.mjs, kin_receipts_pg.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { createCloud } from '../src/cloud/client.js';
import { createSocial } from '../src/cloud/social.js';
import { createKin, parentSnapshot } from '../src/cloud/kin.js';
import { foundlingId } from '../src/engine/kin.js';
import { absorbMail, refreshKin, kinDebug, knownBirth, recoverBirths, stateFence, noteStateReplaced } from '../src/ui/kin.js';
import { generateCreature } from '../src/art/creatures.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';

const T0 = Date.UTC(2026, 9, 12, 12);
const DAY = 86400000;
const NODASH = /[\u2013\u2014]/;
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
async function befriend(w, a, b) {
  await a.social.addFriend(b.code);
  await b.social.respond(a.id, true);
  const f = w.fake.social.friendships.find(x => [x.requester, x.addressee].includes(a.id) && [x.requester, x.addressee].includes(b.id));
  f.created_at = new Date(w.now - 8 * DAY).toISOString();
}
// `from` leaves a basket, `to` takes it in on the server and goes away without reading the reply.
async function birth(from, to, fromIndex = 0, toIndex = 0) {
  const left = await from.kin.leaveBasket({ to: to.id, pet: from.shelf.pets[fromIndex], theirs: to.shelf.pets[toIndex].id });
  await to.kin.answerBasket(left.id, { accept: true, parent: parentSnapshot(to.shelf.pets[toIndex]), nameRoll: 2 });
  return left.id;
}
function ctxFor(p, { save = () => true } = {}) {
  const log = { saves: 0, renders: 0, toasts: [] };
  return { log, state: p.shelf, cloud: p.cloud, friend: () => null, renderAll: () => { log.renders++; }, toast: t => { log.toasts.push(t); },
    save: () => { log.saves++; return save(); } };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
// A restore, the way main.js does it: the live object keeps its identity and takes on another household's contents.
function restore(state, backup) {
  const next = normalizeState(JSON.parse(JSON.stringify(backup)));
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, next);
  noteStateReplaced();
}
const pending = (w, owner) => [...w.fake.kin.receipts.values()].filter(r => r.owner === owner && !r.claimed_at);
const tidy = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };

test('an account switch mid-load gets its own look, and the old look cannot touch the new account', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  const id = await birth(bea, ada); // Bea left the basket, Ada took it in: both have a birth waiting
  let current = ada;
  const held = deferred();
  const calls = [];
  const cloud = { configured: true, signedIn: () => true, userId: () => current.id,
    rpc: async (name, args) => {
      const who = current;
      calls.push([who.id, name]);
      if (name === 'kin_mail' && calls.filter(c => c[1] === 'kin_mail').length === 1) await held.promise;
      return who.cloud.rpc(name, args);
    } };
  const shared = household(['Mabel'], 'a'); // one device, one save, two accounts in turn
  const ctx = { state: shared, cloud, friend: () => null, save: () => true, renderAll() {}, toast() {} };
  const first = refreshKin(ctx);
  await tidy();
  current = bea;
  const second = refreshKin(ctx);
  assert.notEqual(second, first, 'a different account is not served the first account’s request');
  const mine = await second;
  assert.equal(mine.user, bea.id);
  assert.equal(kinDebug.cache.user, bea.id);
  held.resolve();
  assert.equal(await first, null, 'the old account’s answer is dropped');
  assert.equal(kinDebug.cache.user, bea.id, 'and does not become the cache');
  assert.equal(kinDebug.cache.mail.user, bea.id);
  assert.ok(shared.pets.some(p => p.id === foundlingId(id)), 'Bea’s own birth was taken in');
  assert.deepEqual(shared.kin.foundlings.map(f => f.basket), [id], 'and nothing of Ada’s');
  assert.equal(calls.filter(c => c[1] === 'kin_mail').length, 2);
  assert.equal(kinDebug.cache.loading.size, 0, 'nothing is left marked as loading');
});

test('two looks at once for the same account share one request', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  let mails = 0;
  const cloud = { configured: true, signedIn: () => true, userId: () => ada.id, rpc: (name, args) => { if (name === 'kin_mail') mails++; return ada.cloud.rpc(name, args); } };
  const ctx = { state: ada.shelf, cloud, friend: () => null, save: () => true, renderAll() {}, toast() {} };
  const [x, y] = [refreshKin(ctx), refreshKin(ctx)];
  assert.equal(x, y);
  await x;
  assert.equal(mails, 1);
});

test('a restore under the same account while a look is in flight leaves the restored shelf alone', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  await ada.kin.introduce({ to: bea.id, mine: 'a0', theirs: 'b0' });
  const id = await birth(ada, bea);
  const backup = JSON.parse(JSON.stringify(ada.shelf)); // the older save
  const held = deferred();
  let first = true;
  const cloud = { configured: true, signedIn: () => true, userId: () => ada.id,
    rpc: async (name, args) => { const out = await ada.cloud.rpc(name, args); if (first && name === 'kin_mail') { first = false; await held.promise; } return out; } };
  const ctx = { state: ada.shelf, cloud, friend: () => null, save: () => true, renderAll() {}, toast() {} };
  const look = refreshKin(ctx);
  await tidy();
  // The mail is back in the request; before it is absorbed, an older backup is restored over the same account.
  restore(ada.shelf, backup);
  const restored = JSON.stringify(ada.shelf);
  held.resolve();
  assert.equal(await look, null);
  assert.equal(JSON.stringify(ada.shelf), restored, 'nothing the old look found was written into the replacement');
  assert.equal(pending(w, ada.id).length, 1, 'and nothing was claimed on the server');
  // The next look serves the restored shelf as itself.
  const again = await refreshKin(ctx);
  assert.ok(again);
  assert.ok(ada.shelf.pets.some(p => p.id === foundlingId(id)), 'the foundling arrives on the restored shelf');
  assert.equal(ada.shelf.kin.letters.length >= 1, true, 'and so do the letters');
});

test('absorbMail writes nothing when the household or account is no longer the one it was fetched for', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  await ada.kin.introduce({ to: bea.id, mine: 'a0', theirs: 'b0' });
  await birth(ada, bea);
  const mail = await ada.kin.mail();
  assert.equal(mail.births.length, 1);
  const calls = [];
  const client = { userId: () => ada.id, collect: id => { calls.push(id); return Promise.resolve({}); } };
  const before = JSON.stringify(ada.shelf);
  // An account that is not the one the mail was for.
  let result = await absorbMail({ state: ada.shelf, mail: { ...mail, user: bea.id }, kin: client });
  assert.equal(result.stale, true);
  assert.equal(JSON.stringify(ada.shelf), before);
  // A household replaced during the work: the fence is taken before, checked after each wait.
  const held = deferred();
  const fence = stateFence(ada.shelf, client, ada.id);
  const running = absorbMail({ state: ada.shelf, mail, kin: client, current: fence, realize: async args => { await held.promise; return (await import('../src/art/kin-art.js')).realizeFoundling(args); } });
  await tidy();
  restore(ada.shelf, JSON.parse(before));
  const restored = JSON.stringify(ada.shelf);
  held.resolve();
  result = await running;
  assert.equal(result.stale, true);
  assert.equal(JSON.stringify(ada.shelf), restored, 'the replacement is untouched');
  assert.deepEqual(calls, [], 'and nothing is claimed');
});

test('a reply that never came back: the birth is waiting in the mail, unclaimed, and arrives once', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel', 'Pip'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs', 'Snag'], 'b'));
  await befriend(w, ada, bea);
  const id = await birth(ada, bea);
  const row = w.fake.kin.baskets.get(id);
  assert.equal(row.to_collected_at, null, 'accepting does not mark the recipient’s copy taken in');
  assert.deepEqual(pending(w, bea.id).map(r => r.basket_id), [id]);
  const ctx = ctxFor(bea);
  const mail = await refreshKin(ctx);
  assert.ok(bea.shelf.pets.some(p => p.id === foundlingId(id)), 'Bea’s device finds her own birth');
  assert.equal(mail.births.length, 1);
  assert.equal(pending(w, bea.id).length, 0, 'claimed after the save');
  assert.ok(ctx.log.saves >= 1);
  await refreshKin(ctx);
  assert.equal(bea.shelf.pets.filter(p => p.id === foundlingId(id)).length, 1);
  assert.equal(bea.shelf.kin.foundlings.length, 1);
  assert.deepEqual(bea.shelf.kin.foundlings[0].parents.map(p => [p.name, p.home]), [['Mabel', false], ['Grubbs', true]]);
  // The same child as Ada’s copy.
  await refreshKin(ctxFor(ada));
  const [a, b] = [ada, bea].map(p => p.shelf.pets.find(x => x.id === foundlingId(id)));
  for (const key of ['id', 'name', 'traits', 'stats', 'bio', 'art', 'born']) assert.deepEqual(a[key], b[key], key);
});

test('a failed save claims nothing and a retry reaches the same shelf, once', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  const id = await birth(ada, bea);
  const mail = await ada.kin.mail();
  const claimed = [];
  const client = { userId: () => ada.id, collect: x => { claimed.push(x); return ada.kin.collect(x); } };
  const failed = await absorbMail({ state: ada.shelf, mail, kin: client, now: T0, save: () => false });
  assert.equal(failed.saved, false);
  assert.deepEqual(claimed, [], 'nothing was claimed');
  assert.deepEqual(ada.shelf.kin.collected, [], 'nothing is marked collected');
  assert.equal(pending(w, ada.id).length, 1);
  assert.equal(failed.adopted.length, 1, 'the foundling is on the shelf in memory');
  const snapshot = JSON.stringify(ada.shelf.pets.find(p => p.id === foundlingId(id)));
  // A save that throws is a failed save too.
  const threw = await absorbMail({ state: ada.shelf, mail, kin: client, now: T0, save: () => { throw new Error('quota'); } });
  assert.equal(threw.saved, false);
  assert.deepEqual(claimed, []);
  const retried = await absorbMail({ state: ada.shelf, mail, kin: client, now: T0 + 5000, save: () => true });
  assert.equal(retried.saved, true);
  assert.deepEqual(claimed, [id], 'claimed once, after the save');
  assert.deepEqual(ada.shelf.kin.collected, [id]);
  assert.equal(ada.shelf.pets.filter(p => p.id === foundlingId(id)).length, 1, 'one foundling, however many tries');
  assert.equal(JSON.stringify(ada.shelf.pets.find(p => p.id === foundlingId(id))), snapshot, 'the same foundling, unchanged by the retry');
  assert.equal(ada.shelf.kin.foundlings.length, 1);
  assert.equal(ada.shelf.kin.notices.length, 1);
  assert.equal(pending(w, ada.id).length, 0);
  const again = await absorbMail({ state: ada.shelf, mail, kin: client, save: () => true });
  assert.deepEqual([again.changed, again.adopted.length], [false, 0]);
  assert.deepEqual(claimed, [id, id], 'replaying the same mail claims again, which the server treats as a no-op');
  assert.equal(pending(w, ada.id).length, 0);
});

test('a claim that is lost is made again, and the receipt never double-counts', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  const id = await birth(ada, bea);
  let failing = true;
  const cloud = { configured: true, signedIn: () => true, userId: () => ada.id, rpc: (name, args) => failing && name === 'kin_collect' ? Promise.reject(Object.assign(new Error('offline'), { offline: true })) : ada.cloud.rpc(name, args) };
  const ctx = { state: ada.shelf, cloud, friend: () => null, save: () => true, renderAll() {}, toast() {} };
  await refreshKin(ctx);
  assert.equal(ada.shelf.pets.filter(p => p.id === foundlingId(id)).length, 1);
  assert.equal(pending(w, ada.id).length, 1, 'the claim never arrived');
  failing = false;
  await refreshKin(ctx);
  assert.equal(pending(w, ada.id).length, 0);
  assert.equal(ada.shelf.pets.filter(p => p.id === foundlingId(id)).length, 1);
  assert.equal(ada.shelf.kin.notices.length, 1, 'announced once');
});

test('more foundlings than the step holds are not lost: they wait unclaimed and come in as room is made', async () => {
  const w = world();
  const ada = await w.player('Ada', household(Array.from({ length: 18 }, (_, i) => 'Dweller ' + i), 'a'));
  const friends = [];
  for (const name of ['Bea', 'Cat', 'Dan', 'Eve', 'Fay']) {
    const f = await w.player(name, household(['Pal ' + name], name.toLowerCase()));
    await befriend(w, ada, f);
    friends.push(f);
  }
  const ids = [];
  for (const [i, f] of friends.entries()) ids.push(await birth(ada, f, i, 0));
  assert.equal(ada.shelf.slots.indexOf(null), -1, 'a full shelf');
  const ctx = ctxFor(ada);
  const mail = await refreshKin(ctx);
  assert.equal(ada.shelf.kin.step.length, 3, 'the step holds three');
  assert.equal(mail.waiting, 2, 'two more are waiting at the door');
  assert.equal(pending(w, ada.id).length, 2, 'and are still unclaimed on the server');
  assert.equal(ada.shelf.pets.filter(p => p.id.startsWith('kin')).length, 0);
  assert.equal(normalizeState(JSON.parse(JSON.stringify(ada.shelf))).kin.step.length, 3, 'a reload keeps all three');
  // Looking again changes nothing and loses nothing.
  await refreshKin(ctx);
  assert.equal(ada.shelf.kin.step.length, 3);
  assert.equal(pending(w, ada.id).length, 2);
  // Make room, take the step in, and the rest follow.
  const { takeInFromStep } = await import('../src/ui/kin.js');
  for (let round = 0; round < 6 && ada.shelf.pets.filter(p => p.id.startsWith('kin')).length < 5; round++) {
    for (let k = 0; k < 2; k++) { const gone = ada.shelf.pets.find(p => !p.id.startsWith('kin')); ada.shelf.pets = ada.shelf.pets.filter(p => p !== gone); ada.shelf.slots[ada.shelf.slots.indexOf(gone.id)] = null; }
    for (const item of [...ada.shelf.kin.step]) takeInFromStep(ada.shelf, item.basket);
    await refreshKin(ctx);
  }
  const babies = ada.shelf.pets.filter(p => p.id.startsWith('kin')).map(p => p.id).sort();
  assert.deepEqual(babies, ids.map(foundlingId).sort(), 'all five, each once');
  assert.equal(pending(w, ada.id).length - ada.shelf.kin.step.length, 0, 'whatever is unclaimed is on the step');
});

test('a household restored from before a birth gets its foundling back from the receipt, after the basket row is long pruned', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel', 'Pip'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  const backup = JSON.parse(JSON.stringify(ada.shelf));
  const id = await birth(ada, bea);
  const ctx = ctxFor(ada);
  await refreshKin(ctx);
  const baby = JSON.stringify(ada.shelf.pets.find(p => p.id === foundlingId(id)));
  assert.equal(pending(w, ada.id).length, 0);
  // Months pass. Housekeeping takes the basket row; the receipt stays.
  w.tick(120 * DAY);
  const kept = JSON.stringify(ada.shelf.pets.filter(p => !p.id.startsWith('kin')));
  await ada.kin.mail();
  assert.equal(w.fake.kin.baskets.has(id), false);
  assert.equal(w.fake.kin.receipts.size, 2);
  // The old backup goes back on. The player's own residents come with it; the foundling does not.
  restore(ada.shelf, backup);
  assert.equal(ada.shelf.pets.some(p => p.id === foundlingId(id)), false);
  const adaCtx = ctxFor(ada);
  await refreshKin(adaCtx);
  const back = ada.shelf.pets.find(p => p.id === foundlingId(id));
  assert.ok(back, 'the foundling is recovered');
  assert.equal(JSON.stringify(back), baby.replace(/"born":\d+/, '"born":' + back.born), 'the same foundling');
  assert.equal(JSON.stringify(ada.shelf.pets.filter(p => !p.id.startsWith('kin'))), kept, 'the player’s own residents are exactly as the backup had them');
  assert.deepEqual(ada.shelf.kin.foundlings[0].parents.map(p => [p.name, p.home, p.shelf]), [['Mabel', true, ''], ['Grubbs', false, 'Bea']], 'with its parents');
  assert.equal(ada.shelf.kin.foundlings.length, 1);
  // And again: nothing twice, and the server's claim is a bookmark that stays.
  await refreshKin(adaCtx);
  noteStateReplaced();
  await refreshKin(adaCtx);
  assert.equal(ada.shelf.pets.filter(p => p.id === foundlingId(id)).length, 1);
  assert.equal(w.fake.kin.receipts.size, 2);
  assert.ok(w.fake.kin.receipts.get(ada.id + '|' + id).claimed_at, 'Ada’s claim is a bookmark that stays');
  assert.equal(w.fake.kin.receipts.get(bea.id + '|' + id).claimed_at, null, 'and Bea’s is hers alone');
});

test('a foundling that was rehomed is not brought back by the receipt', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel', 'Pip'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  const id = await birth(ada, bea);
  const ctx = ctxFor(ada);
  await refreshKin(ctx);
  const pet = ada.shelf.pets.find(p => p.id === foundlingId(id));
  // Rehomed: gone from the shelf and written into the household's memorial, which is never pruned.
  ada.shelf.pets = ada.shelf.pets.filter(p => p !== pet);
  ada.shelf.slots[ada.shelf.slots.indexOf(pet.id)] = null;
  ada.shelf.gone.push({ id: pet.id, name: pet.name, slot: 2, at: T0, neighbors: [] });
  ada.shelf.kin.foundlings = []; ada.shelf.kin.collected = [];
  noteStateReplaced();
  await refreshKin(ctx);
  assert.equal(ada.shelf.pets.some(p => p.id === pet.id), false, 'rehomed means rehomed');
  assert.equal(knownBirth(ada.shelf, id), true);
});

test('recovery walks every page of the index and fetches the unknown births four at a time', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const ids = [];
  for (const name of ['Bea', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon']) {
    const f = await w.player(name, household(['Pal ' + name], name.toLowerCase()));
    await befriend(w, ada, f);
    ids.push(await birth(f, ada, 0, 0));
    w.tick(1000);
  }
  const blank = household(['Mabel'], 'a');
  const calls = { recover: [], receipts: [] };
  const client = { userId: () => ada.id, collect: x => ada.kin.collect(x),
    recover: cursor => { calls.recover.push(cursor); return ada.kin.recover(cursor, 2); },
    receipts: list => { calls.receipts.push(list.length); return ada.kin.receipts(list); } };
  const found = await recoverBirths({ state: blank, kin: client, user: ada.id, now: T0, save: () => true });
  assert.equal(found.scanned, true);
  assert.equal(calls.recover.length, 5, 'nine receipts in pages of two');
  assert.deepEqual(calls.receipts, [4, 4, 1], 'four to a call');
  assert.equal(blank.pets.filter(p => p.id.startsWith('kin')).length, 9, 'the shelf has room for all nine');
  assert.deepEqual([...blank.pets.filter(p => p.id.startsWith('kin')).map(p => p.id)].sort(), ids.map(foundlingId).sort());
  assert.equal(pending(w, ada.id).length, 0);
  // Done once: a second look does not ask the server again.
  const second = await recoverBirths({ state: blank, kin: client, user: ada.id, now: T0, save: () => true });
  assert.equal(calls.recover.length, 5);
  assert.equal(second.adopted.length, 0);
});

test('no dashes in any Kin copy this module writes', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel'], 'a'));
  const bea = await w.player('Bea', household(['Grubbs'], 'b'));
  await befriend(w, ada, bea);
  await birth(ada, bea);
  const ctx = ctxFor(ada);
  await refreshKin(ctx);
  assert.ok(ctx.log.toasts.length);
  for (const text of [...ctx.log.toasts, ...ada.shelf.kin.notices.map(n => n.text)]) assert.ok(!NODASH.test(text), text);
});

test('a free space goes to the foundling that has waited longest, not to the newest arrival', async () => {
  const w = world();
  const ada = await w.player('Ada', household(Array.from({ length: 18 }, (_, i) => 'Dweller ' + i), 'a'));
  const bea = await w.player('Bea', household(['Pal Bea'], 'bea'));
  const cat = await w.player('Cat', household(['Pal Cat'], 'cat'));
  await befriend(w, ada, bea);
  await befriend(w, ada, cat);
  const first = await birth(ada, bea, 0, 0);
  const ctx = ctxFor(ada);
  await refreshKin(ctx);
  assert.deepEqual(ada.shelf.kin.step.map(s => s.basket), [first], 'the shelf is full, so it waits on the step');
  // A space opens up. A second birth arrives before anyone has taken the first in.
  const gone = ada.shelf.pets[3];
  ada.shelf.pets = ada.shelf.pets.filter(p => p !== gone);
  ada.shelf.slots[ada.shelf.slots.indexOf(gone.id)] = null;
  const second = await birth(ada, cat, 1, 0);
  await refreshKin(ctx);
  assert.deepEqual(ada.shelf.kin.step.map(s => s.basket), [first, second], 'it queues behind the first');
  assert.equal(ada.shelf.pets.some(p => p.id.startsWith('kin')), false, 'and the free space is still free for the first');
  assert.equal(pending(w, ada.id).length, 0, 'both are safe in the save, so both are claimed');
});
