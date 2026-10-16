// Co-op on the shelf: the save, hired help in the expedition crew, field
// reports and wages, duel stakes, and the cloud wrappers against the fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { householdFixture, FIXTURE_NAMES } from './household-fixtures.mjs';
import { blankCoop, normalizeCoop, coopState, normalizeOutingGuest, COOP_LIMITS } from '../src/coop-state.js';
import { startOuting, chooseOuting, outingSnapshot, outingPreview, retryOuting, lifeState, finishOuting } from '../src/engine/life.js';
import {
  hireGuest, guestCrew, guestLine, guestArrival, guestFarewell, tripReport, fieldReport, hireMemory, collectReport, holdStake, payDuel, stakeHeld,
  duelSummary, duelLapsesAt, markAttempt, attemptFor, reportSent, setListed, applyCoopReceipts
} from '../src/engine/coop.js';
import { residentMemories } from '../src/engine/resident-memory.js';
import { addSouls } from '../src/engine/mayhem.js';
import { mayhemState } from '../src/mayhem-state.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { createCoop, readListing, readDuel, readTurn, readReport, coopText } from '../src/cloud/coop.js';
import { GUEST_LINES, REPORT_PAY, DUEL_CHALLENGES, fill, pickBy } from '../src/content/coop.js';

const now = new Date(2026, 9, 11, 12).getTime();
const FRIEND = '00000000-0000-4000-8000-0000000000b0', HIRE = '00000000-0000-4000-8000-0000000000c0';
function shelf(stats = 3) {
  const s = blankState(); s.lastTick = now; s.life.introDone = true;
  s.pets = [{ id: 'a', name: 'Pip', traits: [], stats: { cute: stats, menace: stats, damp: stats, mystique: stats }, needs: { food: 60, fuss: 60, clean: 60 }, bond: 0, cared: 0, art: {} }];
  s.slots[0] = 'a';
  return normalizeState(s);
}
const guest = (stats = { cute: 5, menace: 9, damp: 5, mystique: 5 }, extra = {}) => normalizeOutingGuest({ hireId: HIRE, from: { userId: FRIEND, name: 'Bea' },
  id: 'b1', name: 'Mabel', traits: ['spiteful'], stats, art: { creature: { v: 1, seed: 'x', body: 'blob', parts: {} } }, ...extra });

test('the co-op save is additive: old saves gain a blank one, and it is bounded, idempotent and drops what it does not know', () => {
  for (const kind of FIXTURE_NAMES) {
    const raw = householdFixture(kind, now);
    const s = kind === 'fresh' || kind === 'legacy' ? normalizeState(raw) : raw;
    assert.deepEqual(s.coop, blankCoop(), kind + ' gets a blank co-op record');
    assert.equal(JSON.stringify(normalizeState(JSON.parse(JSON.stringify(s))).coop), JSON.stringify(s.coop));
  }
  const messy = normalizeCoop({ v: 9, extra: 1, listed: ['a', 'a', 'b', 'c', '<x>'], outbox: Array.from({ length: 12 }, (_, i) => ({ hireId: HIRE.slice(0, -2) + String(i).padStart(2, '0'),
    report: { route: 'drawer', gear: 'thread', edition: 1, rev: 2, score: 4, tier: 1, returned: 0, built: false, choices: [1, 9, 0], helped: [0, 0], crew: ['A', 'B', 'C'] } })),
    memories: Array.from({ length: 30 }, (_, i) => ({ petId: 'p' + (i % 4), key: 'coop:hire:' + i, text: 'Line ' + i, at: i })),
    done: ['h:' + HIRE, 'h:' + HIRE, 'nope'], stakes: [{ duelId: HIRE, amount: 30 }, { duelId: FRIEND, amount: 5 }],
    attempts: [{ duelId: HIRE, round: 1, state: 'started', score: 4 }, { duelId: HIRE, round: 4, state: 'started' }], seen: [HIRE + ':1', 'x'],
    records: { [FRIEND]: { won: 2, lost: -1, junk: 1 }, bad: {} } });
  assert.deepEqual(messy.listed, ['a', 'b']);
  assert.equal(messy.outbox.length, COOP_LIMITS.outbox);
  assert.deepEqual(messy.outbox[0].report.choices, [1, 0]);
  assert.deepEqual(messy.outbox[0].report.helped, [0]);
  assert.equal(messy.outbox[0].report.crew.length, 2);
  assert.ok(messy.memories.length <= COOP_LIMITS.memories);
  for (const id of ['p0', 'p1', 'p2', 'p3']) assert.ok(messy.memories.filter(m => m.petId === id).length <= COOP_LIMITS.perPet);
  assert.equal(messy.memories.at(-1).text, 'Line 29', 'the newest memories are the ones kept');
  assert.deepEqual(messy.done, ['h:' + HIRE]);
  assert.deepEqual(messy.stakes.map(s => s.amount), [5]);
  assert.equal(messy.attempts.length, 1);
  assert.deepEqual(messy.seen, [HIRE + ':1']);
  assert.deepEqual(messy.records[FRIEND], { won: 2, lost: 0, tied: 0, roundsWon: 0, roundsLost: 0, streak: 0, best: 0, trips: 0, at: 0 });
  assert.equal(messy.extra, undefined);
  assert.deepEqual(normalizeCoop(messy), messy, 'idempotent');
  assert.deepEqual(normalizeCoop('nonsense'), blankCoop());
});

test('hired help counts at every stop exactly as a resident would, and never joins the shelf', () => {
  const s = shelf(3), plain = shelf(3);
  assert.deepEqual(outingPreview(s, 'drawer', 'thread', ['a']).map(x => x.skill), [false, false, false]);
  assert.deepEqual(outingPreview(s, 'drawer', 'thread', ['a'], guest()).map(x => x.skill), [true, false, false], 'the sock frontier wants menace');
  s.mastery = { expedition: { tier: 1, serial: 0, receipts: [] } }; plain.mastery = structuredClone(s.mastery);
  assert.ok(startOuting(s, 'drawer', 'thread', ['a'], { learning: true, mission: true, guest: guest() }));
  assert.ok(startOuting(plain, 'drawer', 'thread', ['a'], { learning: true, mission: true }));
  const withGuest = outingSnapshot(s), without = outingSnapshot(plain);
  assert.equal(withGuest.steps[0].stat, 'menace');
  assert.deepEqual(withGuest.expertise, ['menace']);
  assert.deepEqual(without.expertise, []);
  assert.match(withGuest.options[1].hint, /spend 1 nerve/);
  assert.match(without.options[1].hint, /spend 2 nerve/);
  assert.equal(s.pets.length, 1, 'never added to state.pets');
  // The guest survives a save and a load, and nothing about it can change.
  const reloaded = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(reloaded.life.outing.guest, guest());
  const crew = guestCrew(guest())[0];
  assert.throws(() => { 'use strict'; crew.stats.menace = 1; }, TypeError);
  // Practice trips are the beginner survey: no hired help.
  const practice = shelf(3);
  startOuting(practice, 'drawer', 'thread', ['a'], { learning: true, practice: true, mission: true, guest: guest() });
  assert.equal(practice.life.outing.guest, undefined);
});

test('a guest in the crew touches nothing but the trip: same needs, bonds, achievements and relationships as a solo trip', () => {
  // A guest with ordinary stats changes no costs, so the two trips are the same moves.
  const a = shelf(3), b = shelf(3), dull = guest({ cute: 5, menace: 5, damp: 5, mystique: 5 });
  startOuting(a, 'fridge', 'lantern', ['a'], { mission: true, guest: dull, edition: 3 });
  startOuting(b, 'fridge', 'lantern', ['a'], { mission: true, edition: 3 });
  for (const move of [2, 0, 1]) { chooseOuting(a, move, now); chooseOuting(b, move, now); }
  // Clocks, note forms and the written record aside, the two shelves must match.
  const strip = st => {
    const c = JSON.parse(JSON.stringify(st));
    delete c.life.outing.guest; delete c.coop;
    for (const k of ['notes', 'formLog', 'paperwork', 'householdEchoes', 'started', 'lastTick', 'noteCount']) delete c[k];
    c.life.scenes = c.life.scenes.map(x => ({ ...x, text: '', at: 0 }));
    c.pets.forEach(p => { delete p.born; delete p.names; });
    return c;
  };
  assert.deepEqual(strip(a), strip(b), 'only the trip record, the notes and the outbox differ');
  assert.equal(a.pets[0].expeditions, 1);
  assert.ok(!JSON.stringify(a.pets).includes('Mabel'));
  assert.ok(!JSON.stringify(a.stories || {}).includes('b1'));
  assert.ok(!JSON.stringify(a.achievements).includes('guest'));
  assert.match(a.life.scenes[0].text, /^Pip and Mabel \(from Bea’s shelf\) returned with/);
  // The report for the lender is queued once.
  const outbox = coopState(a).outbox;
  assert.equal(outbox.length, 1);
  assert.deepEqual(outbox[0].report, { route: 'fridge', gear: 'lantern', edition: 3, rev: 2, score: outingSnapshot(a).score, tier: outbox[0].report.tier,
    returned: 0, built: outbox[0].report.built, choices: [2, 0, 1], helped: [], crew: ['Pip'] });
  chooseOuting(a, 0, now);
  assert.equal(coopState(a).outbox.length, 1, 'never twice');
  reportSent(a, HIRE);
  assert.equal(coopState(a).outbox.length, 0);
});

test('a retry is a new trip without the hired help or the skill it brought', () => {
  const s = shelf(3);
  s.mastery = { expedition: { tier: 1, serial: 0, receipts: [] } };
  startOuting(s, 'drawer', 'thread', ['a'], { learning: true, mission: true, guest: guest() });
  for (const move of [1, 0, 0]) chooseOuting(s, move, now);
  assert.deepEqual(coopState(s).outbox[0].report.helped, [0], 'the guest’s menace made the first detour cheaper');
  assert.ok(retryOuting(s));
  assert.equal(lifeState(s).outing.guest, undefined);
  assert.deepEqual(lifeState(s).outing.expertise, []);
});

test('the guest has lines of its own, stable for a trip and different across trips', () => {
  const g = guest(), other = { ...g, hireId: '00000000-0000-4000-8000-0000000000c1' };
  assert.equal(guestLine(g, 1, 2, { lead: 'Pip', gear: 'lantern' }), guestLine(g, 1, 2, { lead: 'Pip', gear: 'lantern' }));
  const lines = new Set(Array.from({ length: 30 }, (_, i) => guestLine({ ...g, hireId: HIRE.slice(0, -2) + String(i).padStart(2, '0') }, 0, 1, { lead: 'Pip' })));
  assert.ok(lines.size >= 6, 'a varied pool');
  assert.ok(!/\{\w+\}/.test(guestLine(g, 2, 2, { lead: 'Pip', gear: 'biscuit' }) + guestArrival(other, 'Pip') + guestFarewell(g, 'Pip')), 'every placeholder filled');
  assert.match(guestLine(g, 2, 2, { gear: 'biscuit' }) + guestLine(g, 0, 2, { gear: 'biscuit' }) + guestLine(g, 1, 2, { gear: 'biscuit' }), /emergency biscuit|Bea|lead/);
  for (const pool of GUEST_LINES) assert.ok(pool.length >= 10);
  assert.ok(REPORT_PAY.length >= 10 && DUEL_CHALLENGES.length >= 8);
  assert.equal(fill('{a} {b} {c}', { a: 1, b: '<x>' }), '1 <x> {c}');
  assert.equal(pickBy(['x', 'y'], 'k'), pickBy(['x', 'y'], 'k'));
});

test('the lender reads a field report built from what happened, collects wages once, and the resident remembers', () => {
  const s = householdFixture('established', now), pet = s.pets[0];
  const item = { id: HIRE, hirer: FRIEND, hirerName: 'Bea', petId: pet.id, name: pet.name, wages: 12, finishedAt: now,
    report: { route: 'drawer', gear: 'lantern', edition: 0, rev: 2, score: 8, tier: 2, returned: 0, built: true, choices: [1, 2, 1], helped: [0], crew: ['Gladys'] } };
  const text = fieldReport(item);
  assert.equal(text, fieldReport(item), 'the same report always reads the same');
  assert.match(text, /Agnes/); assert.match(text, /Bea/);
  assert.match(text, /The undertaker’s spool/, 'names the stop the resident’s stats helped at');
  assert.match(text, /The Button Lift/);
  assert.ok(!/\{\w+\}/.test(text));
  const souls = mayhemState(s).souls;
  const first = collectReport(s, item, 12, now);
  assert.equal(first.souls, 12);
  assert.equal(mayhemState(s).souls, souls + 12);
  assert.equal(collectReport(s, item, 12, now).souls, 0, 'never paid twice');
  assert.equal(mayhemState(s).souls, souls + 12);
  const memories = residentMemories(s, pet, now);
  assert.ok(memories.some(m => m.key === 'coop:hire:' + HIRE && /Bea/.test(m.text)), 'the lent resident remembers the trip');
  assert.match(s.notes[0].text, /Wages: 12 souls\./);
  // Nothing about the resident itself changed.
  const fresh = householdFixture('established', now);
  assert.deepEqual(s.pets[0], fresh.pets[0]);
  // A report that never came home, and one with no wages left.
  assert.match(fieldReport({ ...item, report: null }), /Bea/);
  assert.match(fieldReport({ ...item, wages: 0 }), /free|union/);
  assert.match(fieldReport({ ...item, hirerName: '' }), /a friend you no longer see/);
  assert.match(hireMemory({ ...item, report: null }).evidence, /did not come home/);
  // A resident rehomed since gets no memory, and the wages still pay.
  const gone = collectReport(s, { ...item, id: FRIEND, petId: 'nobody' }, 6, now);
  assert.equal(gone.souls, 6);
  assert.equal(coopState(s).memories.filter(m => m.petId === 'nobody').length, 0);
  assert.deepEqual(setListed(s, [pet.id, 'nobody', s.pets[1].id, s.pets[2].id]), [pet.id, s.pets[1].id]);
});

test('duel stakes leave the purse once and come back as they went; only winnings count towards the lifetime total', () => {
  const s = householdFixture('established', now), m = mayhemState(s);
  m.souls = 30; m.lifetime = 100;
  assert.equal(holdStake(s, HIRE, 40), false, 'not enough souls');
  assert.equal(m.souls, 30);
  assert.equal(holdStake(s, HIRE, 10), true);
  assert.equal(holdStake(s, HIRE, 10), true, 'already held');
  assert.equal(m.souls, 20);
  assert.equal(stakeHeld(s, HIRE), 10);
  assert.equal(payDuel(s, HIRE, 20), 20);
  assert.deepEqual([m.souls, m.lifetime], [40, 110], 'your 10 back, their 10 earned');
  assert.equal(payDuel(s, HIRE, 20), 0, 'once');
  holdStake(s, FRIEND, 5);
  payDuel(s, FRIEND, 5);
  assert.deepEqual([m.souls, m.lifetime], [40, 110], 'a refund is not income');
  assert.equal(holdStake(s, HIRE.replace('c0', 'c9'), 0), true, 'no stake, nothing held');
  markAttempt(s, HIRE, 2, 'started');
  markAttempt(s, HIRE, 2, 'sent', 14);
  assert.deepEqual(attemptFor(s, HIRE, 2).state, 'sent');
});

test('a duel from each side: whose move it is, the rounds as mine and theirs, and when it lapses', () => {
  const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b';
  const duel = (rounds, extra = {}) => ({ id: HIRE, challenger: A, opponent: B, challengerName: 'Ada', opponentName: 'Bea', game: 'stack', stake: 10, status: 'open',
    winsChallenger: 0, winsOpponent: 0, outcome: null, claimed: false, rounds, ...extra });
  const r = (n, firstPlayer, status, firstScore = null, secondScore = null) => ({ n, firstPlayer, status, firstScore, secondScore, createdAt: 1000, firstAt: 2000, secondAt: 3000, started: false });
  assert.equal(duelSummary(duel([r(1, A, 'first')]), A).turn, 'play');
  assert.equal(duelSummary(duel([r(1, A, 'first')]), B).turn, 'wait');
  assert.equal(duelSummary(duel([r(1, A, 'second', 7)]), B).turn, 'answer');
  const done = duelSummary(duel([r(1, A, 'done', 7, 9)], { winsOpponent: 1 }), A);
  assert.deepEqual([done.turn, done.rounds[0].mine, done.rounds[0].theirs, done.rounds[0].result, done.otherName, done.theirWins], ['rematch', 7, 9, 'lost', 'Bea', 1]);
  assert.equal(duelSummary(duel([r(1, A, 'done', 7, 9), r(2, B, 'done', 3, 9)], { winsOpponent: 1, winsChallenger: 1 }), B).rounds[1].result, 'lost');
  assert.equal(duelSummary(duel([r(1, A, 'done', 7, 9)], { status: 'settled', outcome: 'opponent' }), B).outcome, 'won');
  assert.equal(duelSummary(duel([r(1, A, 'done', 7, 9)], { status: 'settled', outcome: 'opponent', claimed: true }), B).turn, 'done');
  assert.equal(duelLapsesAt(duel([r(1, A, 'second', 7)])), 2000 + 48 * 3600000);
  assert.equal(duelLapsesAt(duel([r(1, A, 'done', 7, 9)])), 3000 + 48 * 3600000);
});

test('readers rebuild what the server sends and refuse what they do not recognise', () => {
  const res = { id: 'b1', name: 'Mabel\u0007', traits: ['spiteful', 'nope'], stats: { cute: 11, menace: 9, damp: 'x', mystique: 2 }, art: { creature: { body: 'blob' } } };
  const listing = readListing({ owner: FRIEND, owner_name: 'Bea', pet_id: 'b1', resident: res, trips_today: 2, available: true });
  assert.deepEqual([listing.resident.name, listing.resident.traits, listing.resident.stats], ['Mabel', ['spiteful'], { cute: 5, menace: 9, damp: 5, mystique: 2 }]);
  assert.equal(readListing({ owner: FRIEND, pet_id: 'b2', resident: res }), null, 'the id must match');
  assert.equal(readListing({ owner: 'not-a-uuid', pet_id: 'b1', resident: res }), null);
  assert.equal(readReport({ id: HIRE, hirer: FRIEND, pet_id: 'b1', report: { route: 'attic' } }), null);
  assert.equal(readReport({ id: HIRE, hirer: FRIEND, pet_id: 'b1', report: null, wages: 99 }).wages, 30);
  assert.equal(readDuel({ id: HIRE, challenger: FRIEND, opponent: HIRE, game: 'pinball', status: 'open', rounds: [] }), null);
  const duel = readDuel({ id: HIRE, challenger: FRIEND, opponent: HIRE, game: 'stack', status: 'open', stake: 99, rounds: [{ n: 1, first_player: FRIEND, status: 'second', first_score: 9999 }] });
  assert.deepEqual([duel.stake, duel.rounds[0].firstScore], [25, null]);
  const turn = readTurn({ role: 'second', game: 'stack', round: 1, seed: 7, against: 'Ada', ghost: { v: 1, game: 'stack', mode: 'ghost', ticks: 10, score: 1, cut: 0, inputs: [5, 1], timeline: [0] } }, 'stack');
  assert.equal(turn.ghost.score, 1);
  assert.equal(readTurn({ role: 'second', game: 'stack', round: 1, seed: 7, ghost: { v: 1, game: 'stack', inputs: [5, 9] } }, 'stack').ghost, null, 'a bad log means no ghost, not a broken run');
  assert.equal(readTurn({ role: 'second', game: 'whack', round: 1, seed: 7 }, 'stack'), null);
  assert.equal(readTurn({ role: 'first', game: 'stack', round: 1, seed: 0 }, 'stack'), null);
  assert.match(coopText({ code: 'P0001', message: 'fully_booked' }), /Three trips today/);
});

test('the cloud wrappers drive the whole loop against the fake: list, hire, report, collect, duel and settle', async () => {
  const fake = createFakeSupabase({ now: () => now });
  const adaShelf = householdFixture('established', now), beaShelf = householdFixture('established', now);
  // Explicit funded fixture using the game's ordinary reward path.
  addSouls(adaShelf, 25); addSouls(beaShelf, 25);
  const ada = await socialPlayer(fake, 'Ada', adaShelf, { now: () => now }), bea = await socialPlayer(fake, 'Bea', beaShelf, { now: () => now });
  await ada.social.addFriend(bea.code); await bea.social.respond(ada.id, true);
  const adaCoop = createCoop({ cloud: ada.cloud, social: ada.social }), beaCoop = createCoop({ cloud: bea.cloud, social: bea.social });
  await adaCoop.openWallet(mayhemState(adaShelf).souls);
  await beaCoop.openWallet(mayhemState(beaShelf).souls);
  assert.deepEqual(await adaCoop.setHires([adaShelf.pets[0], adaShelf.pets[1]]), ['qa0', 'qa1']);
  const board = await beaCoop.hireBoard();
  assert.deepEqual(board.listings.map(l => [l.ownerName, l.resident.name, l.available]), [['Ada', 'Agnes', true], ['Ada', 'Lord Dampington III', true]]);
  assert.deepEqual(board.listings[0].resident.stats, { cute: 7, menace: 5, damp: 4, mystique: 8 }, 'the stats the engine uses travel with the look');
  const hire = await beaCoop.hire(ada.id, 'qa0');
  assert.equal(hire.ownerName, 'Ada');
  await assert.rejects(beaCoop.hire(ada.id, 'qa1'), /had your hire for today/);
  const g = hireGuest(hire);
  assert.deepEqual([g.name, g.from.name, g.stats.mystique], ['Agnes', 'Ada', 8]);
  startOuting(beaShelf, 'cupboard', 'biscuit', ['qa1'], { mission: true, guest: g });
  for (const move of [2, 1, 0]) assert.ok(chooseOuting(beaShelf, move, now), 'move ' + move);
  const queued = coopState(beaShelf).outbox[0];
  assert.equal(queued.owner, bea.id, 'the hirer owns the queued report across reload');
  assert.equal(normalizeState(structuredClone(beaShelf)).coop.outbox[0].owner, bea.id);
  reportSent(beaShelf, queued.hireId, ada.id);
  assert.equal(coopState(beaShelf).outbox.length, 1, 'a replacement owner cannot consume the other owner’s queued report');
  assert.deepEqual(await beaCoop.finishHire(queued.hireId, queued.report), { wages: queued.report.tier * 3 + 6 });
  const mail = await adaCoop.reports();
  assert.equal(mail.reports.length, 1);
  assert.equal(mail.reports[0].hirerName, 'Bea');
  assert.match(fieldReport(mail.reports[0]), /^Your Agnes|Agnes/);
  assert.deepEqual(await adaCoop.collect(mail.reports[0].id), { wages: queued.report.tier * 3 + 6 });
  const immutableId = (await adaCoop.receipts()).receipts[0].id;
  assert.deepEqual(await adaCoop.collect(mail.reports[0].id), { wages: 0 }, 'compatibility amount reports newly paid0; the immutable receipt survives');
  assert.equal((await adaCoop.receipts()).receipts[0].id, immutableId, 'the retry points to the same durable payment');
  const receiptPage = await adaCoop.receipts(), initialSouls = mayhemState(adaShelf).souls;
  applyCoopReceipts(adaShelf, ada.id, receiptPage.receipts);
  applyCoopReceipts(adaShelf, ada.id, (await adaCoop.receipts()).receipts);
  assert.equal(mayhemState(adaShelf).souls, initialSouls + queued.report.tier * 3 + 6, 'the same receipt never pays twice');
  // A duel, with a stake and a ghost.
  const made = await adaCoop.duelCreate(bea.id, 'stack', 5);
  assert.ok(made.seed >= 1);
  assert.equal((await adaCoop.duelPlay(made.id, 'stack')).role, 'first');
  await assert.rejects(beaCoop.duelPlay(made.id, 'stack'), /not your move/);
  await adaCoop.duelSubmit(made.id, 1, 6, 'stack', { v: 1, game: 'stack', mode: 'ghost', ticks: 120, score: 6, cut: 0, inputs: [40, 1, 40, 1], timeline: [0, 1, 6] });
  const sealed = (await beaCoop.duels())[0];
  assert.equal(sealed.rounds[0].firstScore, null);
  const turn = await beaCoop.duelPlay(made.id, 'stack');
  assert.deepEqual([turn.role, turn.seed, turn.against, turn.ghost.inputs], ['second', made.seed, 'Ada', [40, 1, 40, 1]]);
  await assert.rejects(beaCoop.duelSubmit(made.id, 1, 501, 'stack'), /score was refused/);
  const reveal = await beaCoop.duelSubmit(made.id, 1, 9, 'stack');
  assert.deepEqual([reveal.firstScore, reveal.secondScore, reveal.winsOpponent, reveal.settled], [6, 9, 1, false]);
  await adaCoop.duelDecline(made.id).catch(error => assert.match(error.message, /not your move/));
  const rematch = await adaCoop.duelRematch(made.id);
  assert.equal(rematch.round, 2);
  await adaCoop.duelSubmit(made.id, 2, 3, 'stack');
  await beaCoop.duelPlay(made.id, 'stack');
  const end = await beaCoop.duelSubmit(made.id, 2, 4, 'stack');
  assert.deepEqual([end.settled, end.outcome], [true, 'opponent']);
  assert.deepEqual(await beaCoop.duelClaim(made.id), { souls: 10 });
  const records = await beaCoop.records();
  assert.deepEqual([records[0].duelsWon, records[0].roundsWon, records[0].bestStreak, records[0].trips], [1, 2, 2, 1]);
  // Signed out, everything refuses politely and nothing is sent.
  const before = fake.requests.length;
  await assert.rejects(createCoop({ cloud: { configured: true, signedIn: () => false }, social: ada.social }).duels(), /Sign in to cloud save/);
  assert.equal(fake.requests.length, before);
  fake.setOffline(true);
  await assert.rejects(adaCoop.duels(), /No connection/);
  fake.setOffline(false);
});
