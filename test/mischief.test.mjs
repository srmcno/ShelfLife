// Mischief on the shelf: the hook that lets a friend's hex into the emergency
// tray (engine/mayhem.js), its normalizer (mischief-state.js) and the rules in
// engine/mischief.js. A hex must leave every emergency invariant as it was:
// the tray's cap and clock, what counts as an emergency for achievements and
// the Almanac, and the promise that nothing is ever taken away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { householdFixture } from './household-fixtures.mjs';
import { normalizeState } from '../src/state.js';
import { normalizeMayhem, QUEUE_MAX } from '../src/mayhem-state.js';
import { normalizeMischief, normalizeHexPayload, normalizeGuest, PENDING_MAX, GUEST_MAX_CHARS } from '../src/mischief-state.js';
import {
  accrueMayhem, describeEmergency, resolveEmergency, injectEmergency, registerExternalCards, queueCap, EMERGENCY_EVERY_MS, nextEmergencyIn
} from '../src/engine/mayhem.js';
import * as X from '../src/engine/mischief.js';
import { syncAlmanac } from '../src/engine/almanac.js';
import { checkAchievements } from '../src/engine/achievements.js';
import { HEX_BY_ID, HEX_DECK, TRICK_DECK, HEX_DECLINED_LINES } from '../src/content/mischief.js';
import { SEASONAL_CURIOS } from '../src/content/seasons.js';
import { awayExtraLines } from '../src/engine/returns.js';

const NOW = Date.UTC(2026, 9, 20, 12);
const ME = '00000000-0000-4000-8000-0000000000aa', BEA = '00000000-0000-4000-8000-0000000000bb', CAT = '00000000-0000-4000-8000-0000000000cc';
const ref = n => '11111111-1111-4111-8111-' + String(n).padStart(12, '0');
const grubbs = { id: 'g1', name: 'Grubbs', traits: ['spiteful'], mood: 'fine', bond: 3, art: { body: '', stamps: [] } };

function shelf(kind = 'established') {
  const s = normalizeState(householdFixture(kind, NOW));
  s.mayhem.queue = []; s.mayhem.nextAt = NOW + 5 * 60000;
  s.mayhem.omen = { day: '', id: '', streak: 0, lastDay: '', grace: 1 };
  return s;
}
const hex = (n, extra = {}) => ({ kind: 'hex', ref: ref(n), card: HEX_DECK[n % HEX_DECK.length].id, from: { userId: BEA, name: 'Bea' }, culprit: grubbs,
  arrived: NOW - 1000, expires: NOW + 3600000, rebound: false, trick: false, ...extra });
const serverHex = (n, extra = {}) => ({ id: ref(n), fromUser: BEA, fromName: 'Bea', card: HEX_DECK[n % HEX_DECK.length].id, culprit: grubbs,
  createdAt: NOW - 1000, expiresAt: NOW + 3600000, rebound: false, ...extra });
const box = (extra = {}) => ({ status: {}, hexes: [], hauntings: [], helps: [], results: [], hauntResults: [], doorstep: { bowl: 'none', count: 0, knocks: [] }, ...extra });
const rnd = seq => { let i = 0; return () => seq[i++ % seq.length]; };

test('a hex takes a place in the tray only when there is room, under the same cap as the house', () => {
  const s = shelf();
  const cap = queueCap(s, NOW);
  assert.equal(cap, QUEUE_MAX - 1);
  const ids = [];
  for (let i = 0; i < cap; i++) ids.push(injectEmergency(s, hex(i), s.pets[i % s.pets.length].id, NOW)?.uid);
  assert.ok(ids.every(Number.isInteger));
  assert.equal(new Set(ids).size, cap, 'each entry gets its own uid from the shared serial');
  assert.equal(injectEmergency(s, hex(9), s.pets[0].id, NOW), null, 'no room past the cap');
  assert.equal(s.mayhem.queue.length, cap);
  assert.equal(accrueMayhem(s, NOW + 3 * EMERGENCY_EVERY_MS), 0, 'a full tray of hexes stops the house clock too');
  assert.equal(nextEmergencyIn(s, NOW), 0, 'the countdown reads a full tray as full');
  // The omen that allows an extra disaster allows an extra hex, and no more.
  const t = shelf();
  t.mayhem.omen = { day: '2026-9-20', id: 'many-eyes', streak: 1, lastDay: '2026-9-20', grace: 1 };
  const extra = queueCap(t, NOW);
  for (let i = 0; i < 6; i++) injectEmergency(t, hex(i), t.pets[0].id, NOW);
  assert.ok(t.mayhem.queue.length === extra && extra <= QUEUE_MAX);
});

test('injecting leaves the house clock alone; the same hex cannot enter twice; strangers are refused', () => {
  const s = shelf(), before = s.mayhem.nextAt, serial = s.mayhem.serial;
  const entry = injectEmergency(s, hex(1), s.pets[0].id, NOW);
  assert.equal(s.mayhem.nextAt, before, 'the next house emergency is not moved');
  assert.equal(entry.uid, serial + 1);
  assert.equal(injectEmergency(s, hex(1), s.pets[1].id, NOW), null, 'one place per hex');
  assert.equal(injectEmergency(s, { ...hex(2), kind: 'parcel' }, s.pets[0].id, NOW), null, 'an unknown kind of card');
  assert.equal(injectEmergency(s, hex(3), 'nobody', NOW), null, 'a resident who is not here');
  assert.equal(injectEmergency(s, { ...hex(4), card: 'no-such-card' }, s.pets[0].id, NOW), null, 'a card this edition does not know');
  assert.equal(injectEmergency(s, hex(5, { expires: NOW - 1 }), s.pets[0].id, NOW), null, 'an expired hex');
  assert.equal(s.mayhem.serial, serial + 1, 'refusals do not use up uids');
  assert.equal(accrueMayhem(s, NOW + 6 * 60000), 1, 'the house clock carries on around it');
});

test('a hex reads like any emergency, names its sender, and pays without taking anything', () => {
  for (const card of HEX_DECK) for (let c = 0; c < card.choices.length; c++) for (let o = 0; o < card.choices[c].outcomes.length; o++) {
    const s = shelf(), pet = s.pets[0];
    pet.needs = { food: 40, fuss: 40, clean: 40 };
    const grudges = pet.grudges, souls = s.mayhem.souls, resolved = s.mayhem.resolved;
    const entry = injectEmergency(s, { ...hex(1), card: card.id }, pet.id, NOW);
    const info = describeEmergency(s, entry);
    assert.equal(info.from, 'from Bea’s shelf');
    assert.equal(info.b.name, 'Grubbs', 'the culprit is the friend’s resident');
    assert.ok(!info.title.includes('{'), card.id + ' is filled in');
    // Pick outcome o: the weights are all equal for a plain resident with these stats.
    pet.stats = { cute: 5, menace: 5, damp: 5, mystique: 5 }; pet.bond = 0; pet.traits = [];
    const n = card.choices[c].outcomes.length;
    const result = resolveEmergency(s, entry.uid, c, NOW, rnd([(o + 0.5) / n, 0.99]));
    const outcome = card.choices[c].outcomes[o];
    assert.equal(result.stamp, outcome.stamp, card.id);
    assert.ok(result.souls >= 10, 'it pays');
    assert.equal(s.mayhem.souls, souls + result.souls + (result.curio?.refund || 0));
    assert.equal(result.fallout, null, 'no mess left behind');
    assert.equal(result.grudge, null);
    assert.equal(pet.grudges, grudges);
    for (const need of ['food', 'fuss', 'clean']) assert.ok(pet.needs[need] >= 40, card.id + ' never lowers ' + need);
    assert.equal(s.mayhem.resolved, resolved + 1, 'it counts as an emergency survived');
    assert.equal(result.external, 'hex');
    assert.match(result.note, outcome.rebound ? /rebounded/ : /will hear how it went/);
    assert.deepEqual(s.mischief.outbox.map(x => [x.op, x.ref, x.choice, x.outcome, x.rebound]), [['resolve', ref(1), c, o, !!outcome.rebound]]);
    assert.equal(s.mayhem.queue.length, 0);
  }
});

test('a provider that asks for harm gets none of it', () => {
  registerExternalCards('cursed-test', {
    template: () => ({ title: '{b} curses {a}.', choices: [{ label: 'Take it', outcomes: [{ tone: 'bad', stamp: 'CURSED', text: 'Ouch.', souls: 12, a: { food: -50, fuss: 20 }, b: { food: -50 }, grudge: 'a' }] }] }),
    partner: () => ({ id: 'guest-x', name: 'X', needs: { food: 50, fuss: 50, clean: 50 } })
  });
  const s = shelf(), pet = s.pets[0];
  pet.needs = { food: 40, fuss: 40, clean: 40 };
  const entry = injectEmergency(s, { kind: 'cursed-test', ref: 'r', card: 'c' }, pet.id, NOW);
  const result = resolveEmergency(s, entry.uid, 0, NOW, () => 0.5);
  assert.deepEqual(pet.needs, { food: 40, fuss: 60, clean: 40 }, 'only the kind half of the delta');
  assert.equal(result.grudge, null);
  assert.equal(result.fallout, null);
  assert.equal(result.b.needs.food, 50, 'the partner lives elsewhere and is not touched');
});

test('the Almanac and achievements count a hex exactly like a house emergency', () => {
  const house = shelf(), hexed = shelf();
  for (const s of [house, hexed]) syncAlmanac(s, NOW);
  accrueMayhem(house, house.mayhem.nextAt);
  const h = house.mayhem.queue[0];
  resolveEmergency(house, h.uid, 0, NOW + 1, () => 0.99);
  const e = injectEmergency(hexed, hex(1), hexed.pets[0].id, NOW);
  resolveEmergency(hexed, e.uid, 0, NOW + 1, () => 0.99);
  const xp = s => (s.almanac.by.emergency || 0);
  syncAlmanac(house, NOW + 2); syncAlmanac(hexed, NOW + 2);
  assert.equal(house.mayhem.resolved, hexed.mayhem.resolved);
  assert.ok(xp(hexed) > 0);
  assert.equal(xp(hexed), xp(house), 'the same Almanac XP for one emergency');
  assert.equal(hexed.almanac.week.counts.emergency, house.almanac.week.counts.emergency, 'the same weekly count');
  assert.doesNotThrow(() => checkAchievements(hexed));
  assert.equal(hexed.mayhem.log[0].title, describeEmergency(hexed, e)?.title ?? hexed.mayhem.log[0].title);
  assert.equal(hexed.mayhem.recent.length, 0, 'a hex is not one of the house’s recent cards');
});

test('the normalizer keeps good hexes, drops malformed or expired ones, and is stable', () => {
  const s = shelf(), pet = s.pets[0].id;
  const good = { uid: 7, id: 'x:' + HEX_DECK[0].id, a: pet, at: NOW - 5, ext: hex(0, { card: HEX_DECK[0].id }) };
  const bad = [
    { ...good, uid: 8, ext: { ...good.ext, ref: 'not-a-ref' } },
    { ...good, uid: 9, ext: { ...good.ext, card: 'no-such-card' } },
    { ...good, uid: 10, ext: { ...good.ext, kind: 'gift' } },
    { ...good, uid: 11, ext: { ...good.ext, culprit: null } },
    { ...good, uid: 12, ext: { ...good.ext, expires: NOW - 1 } },
    { ...good, uid: 13, ext: 'hex' },
    { ...good, uid: 14, a: 'nobody' },
    { ...good, uid: 15, ext: { ...good.ext, culprit: { ...grubbs, id: '../../etc' } } }
  ];
  const out = normalizeMayhem({ ...s.mayhem, queue: [good, ...bad] }, s, NOW);
  assert.deepEqual(out.queue.map(q => q.uid), [7]);
  assert.equal(out.queue[0].id, 'x:' + HEX_DECK[0].id);
  assert.equal(out.queue[0].ext.culprit.name, 'Grubbs');
  // A tray of four bad entries cannot push out the good one: the cap is applied first, then the bad are dropped.
  assert.ok(normalizeMayhem({ ...s.mayhem, queue: [...bad.slice(0, 3), good] }, s, NOW).queue.length <= QUEUE_MAX);
  assert.deepEqual(normalizeMayhem(out, s, NOW), out, 'stable');
  // A hex long past its time is gone after a reload.
  assert.deepEqual(normalizeMayhem(out, s, NOW + 49 * 3600000).queue, []);
  // An expiry further out than 48 hours is clamped.
  assert.equal(normalizeHexPayload(hex(1, { expires: NOW + 30 * 86400000 }), NOW).expires, NOW - 1000 + 48 * 3600000);
  // A trick may have no culprit.
  assert.ok(normalizeHexPayload(hex(2, { card: TRICK_DECK[0].id, trick: true, culprit: null }), NOW));
  assert.equal(normalizeHexPayload(hex(2, { card: TRICK_DECK[0].id, trick: false }), NOW), null, 'a trick card is not a hex');
});

test('a friend’s resident is kept small in the save, whatever the friend sent', () => {
  const huge = 'data:image/png;base64,' + 'A'.repeat(200000);
  assert.equal(normalizeGuest({ ...grubbs, art: { body: huge, stamps: [] } }).art.body, '', 'a drawing over the cap is dropped');
  const g = normalizeGuest({ ...grubbs, name: 'Grubbs' + '\u0007'.repeat(3) + ' the Terrible of the Upper Shelf', traits: ['spiteful', '<b>', 7], mood: 'ecstatic', bond: 999,
    art: { creature: { body: 'x', blob: 'y'.repeat(9000) } } });
  assert.equal(g.name.length, 22);
  assert.deepEqual(g.traits, ['spiteful']);
  assert.equal(g.mood, 'fine');
  assert.equal(g.bond, 25);
  assert.deepEqual(g.art, { body: '', stamps: [] }, 'an oversized creature is dropped');
  assert.ok(JSON.stringify(normalizeGuest({ ...grubbs, art: { body: '', stamps: Array.from({ length: 900 }, () => ({ kind: 'eyes', pad: 'z'.repeat(400) })) } })).length <= GUEST_MAX_CHARS);
  assert.equal(normalizeGuest({ id: 'constructor' }), null);
});

test('state.mischief is additive: old saves load unchanged and the save normalizes stably', () => {
  // A save from before mischief: no state.mischief at all.
  const fixture = householdFixture('veteran', Date.now()), old = JSON.parse(JSON.stringify(fixture));
  delete old.mischief;
  const loaded = normalizeState(old);
  assert.deepEqual(loaded.mischief, normalizeMischief(undefined));
  const { mischief: a, ...rest } = loaded, { mischief: b, ...before } = fixture;
  assert.deepEqual(rest, before, 'everything else loads exactly as it did');
  const junk = normalizeMischief({ user: 'me', hexes: 'lots', outbox: [{ op: 'explode', ref: ref(1) }, { op: 'resolve', ref: ref(2), choice: 99, outcome: -3, at: NOW }],
    helps: [{ id: ref(3), petId: 'qa0', need: 'gravy' }], haunt: { ref: ref(4), ghost: null }, done: [ref(5), 'x', ref(5)], paid: { day: 7, help: 1e9 } }, {}, NOW);
  assert.equal(junk.user, '');
  assert.deepEqual(junk.hexes, []);
  assert.deepEqual(junk.outbox.map(o => [o.op, o.choice, o.outcome]), [['resolve', 3, 0]]);
  assert.deepEqual(junk.helps, []);
  assert.equal(junk.haunt, null);
  assert.deepEqual(junk.done, [ref(5)]);
  assert.deepEqual(junk.paid, { day: '', help: 99, knock: 0, shoo: 0 });
  assert.deepEqual(normalizeMischief(junk, {}, NOW), junk);
});

test('mail from the server becomes hexes in the tray, waiting when the tray is full', () => {
  const s = shelf();
  for (let i = 0; i < queueCap(s, NOW); i++) accrueMayhem(s, s.mayhem.nextAt || NOW);
  while (s.mayhem.queue.length < queueCap(s, NOW)) accrueMayhem(s, s.mayhem.nextAt);
  const news = X.receiveInbox(s, box({ hexes: [serverHex(1), serverHex(2), serverHex(3)] }), ME, NOW);
  assert.equal(news.hexes.length, 2, 'two friends’ hexes at most, as the server allows');
  assert.equal(X.settleMischief(s, NOW).length, 0, 'no room yet');
  assert.ok(X.pendingHexes(s).every(h => !X.inTray(s, h.ref)));
  const first = s.mayhem.queue[0];
  resolveEmergency(s, first.uid, 0, NOW, () => 0.5);
  const added = X.settleMischief(s, NOW);
  assert.equal(added.length, 1, 'the first free place goes to a waiting hex');
  assert.ok(X.inTray(s, ref(1)));
  // Already received: a second read does not duplicate it.
  assert.equal(X.receiveInbox(s, box({ hexes: [serverHex(1), serverHex(2)] }), ME, NOW).hexes.length, 0);
  // Played on another device: the server stops listing it and it leaves this one.
  X.receiveInbox(s, box({ hexes: [serverHex(2)] }), ME, NOW);
  assert.ok(!X.inTray(s, ref(1)));
  assert.deepEqual(X.pendingHexes(s).map(h => h.ref), [ref(2)]);
});

test('an expired hex disappears from the tray and from the waiting list', () => {
  const s = shelf();
  X.receiveInbox(s, box({ hexes: [serverHex(1, { expiresAt: NOW + 60000 }), serverHex(2, { expiresAt: NOW + 7200000 })] }), ME, NOW);
  X.settleMischief(s, NOW);
  assert.equal(s.mayhem.queue.length, 2);
  accrueMayhem(s, NOW + 120000);
  assert.ok(!X.inTray(s, ref(1)), 'accrueMayhem drops it');
  assert.ok(X.inTray(s, ref(2)));
  X.settleMischief(s, NOW + 120000);
  assert.deepEqual(X.pendingHexes(s).map(h => h.ref), [ref(2)]);
  assert.equal(describeEmergency(s, { uid: 99, id: 'x:' + HEX_DECK[0].id, a: s.pets[0].id, at: NOW, ext: { ...hex(9), kind: 'hex' } }).from, 'from Bea’s shelf');
});

test('a resolved or returned hex is never let back in, and is told to the server once', () => {
  const s = shelf();
  X.receiveInbox(s, box({ hexes: [serverHex(1), serverHex(2)] }), ME, NOW);
  X.settleMischief(s, NOW);
  const [a] = s.mayhem.queue;
  resolveEmergency(s, a.uid, 1, NOW, () => 0.1);
  s.mayhem.nextAt = NOW - 10;
  assert.ok(X.declineHex(s, ref(2), NOW));
  assert.ok(s.mayhem.nextAt > NOW, 'the clock restarts as it does after a resolve');
  assert.deepEqual(X.outboxFor(s, ME).map(o => o.op), ['resolve', 'decline']);
  // The server still lists them until the outbox reaches it: they stay out.
  X.receiveInbox(s, box({ hexes: [serverHex(1), serverHex(2)] }), ME, NOW);
  X.settleMischief(s, NOW);
  assert.equal(s.mayhem.queue.length, 0);
  X.clearOutbox(s, X.outboxFor(s, ME));
  assert.deepEqual(X.outboxFor(s, ME), []);
  assert.equal(X.declineHex(s, ref(2), NOW), null, 'gone');
});

test('blocking or switching accounts takes a friend’s mischief off the shelf', () => {
  const s = shelf();
  X.receiveInbox(s, box({ hexes: [serverHex(1), { ...serverHex(2), fromUser: CAT, fromName: 'Cat' }],
    hauntings: [{ id: ref(7), fromUser: BEA, fromName: 'Bea', ghost: grubbs, createdAt: NOW - 10, endsAt: NOW + 3600000 }] }), ME, NOW);
  X.settleMischief(s, NOW);
  X.dropFriend(s, BEA, NOW);
  assert.deepEqual(s.mayhem.queue.map(q => q.ext.from.name), ['Cat']);
  assert.equal(s.mischief.haunt, null);
  X.receiveInbox(s, box({ hexes: [{ ...serverHex(3), fromUser: CAT, fromName: 'Cat' }] }), CAT, NOW);
  assert.ok(!X.inTray(s, ref(2)), 'another account’s hex leaves with it');
  assert.equal(s.mischief.user, CAT);
});

test('help is applied once, bounded, at most three a day, and named on the card and the return card', () => {
  const s = shelf(), pet = s.pets[0];
  pet.needs.food = 20;
  const help = (n, extra = {}) => ({ id: ref(100 + n), fromUser: BEA, fromName: 'Bea', residentId: pet.id, residentName: pet.name, need: 'food', amount: 25, createdAt: NOW - 5000, ...extra });
  const news = X.receiveInbox(s, box({ helps: [help(1)] }), ME, NOW);
  assert.equal(news.helps.length, 1);
  assert.equal(pet.needs.food, 45);
  assert.equal(s.notes[0].text.startsWith('Bea fed ' + pet.name + ' while you were out.'), true, 'a note on the board');
  X.receiveInbox(s, box({ helps: [help(1)] }), ME, NOW + 1000);
  assert.equal(pet.needs.food, 45, 'applied once, even when the server sends it again');
  assert.deepEqual(X.outboxFor(s, ME).map(o => o.op), ['ack'], 'acknowledged once');
  X.receiveInbox(s, box({ helps: [help(2, { amount: 900, need: 'fuss' }), help(3, { need: 'clean' }), help(4, { need: 'food' })] }), ME, NOW + 2000);
  assert.equal(s.mischief.helps.length, 3, 'three a day');
  assert.ok(pet.needs.fuss <= 100 && pet.needs.fuss - 69 <= 30, 'never more than 30 at once');
  assert.equal(X.helpLineFor(s, pet, NOW + 3000), 'Bea washed ' + pet.name + ' while you were out.');
  assert.equal(X.helpLineFor(s, s.pets[1], NOW), '');
  assert.equal(X.helpLineFor(s, pet, NOW + 3 * 86400000), '', 'old news after two days');
  const lines = awayExtraLines(s, { from: NOW - 3600000 });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^While you were out, Bea (fed|fussed over|washed) /);
  assert.match(lines[1], /someone else helped too\.$/);
  assert.equal(X.receiveInbox(s, box({ helps: [help(9, { residentId: 'gone' })] }), ME, NOW).helps.length, 0, 'a rehomed resident is skipped');
  assert.ok(X.outboxFor(s, ME).some(o => o.ref === ref(109)), 'and still acknowledged');
});

test('the helper is paid a few souls, three times a day', () => {
  const s = shelf(), souls = s.mayhem.souls;
  const lines = [1, 2, 3, 4].map(i => X.helped(s, { need: 'clean', petName: 'Pip', friend: 'Bea' }, NOW + i));
  assert.deepEqual(lines.map(l => l.souls), [X.HELP_SOULS, X.HELP_SOULS, X.HELP_SOULS, 0]);
  assert.equal(s.mayhem.souls, souls + 3 * X.HELP_SOULS);
  assert.ok(!lines[0].line.includes('{'));
});

test('a haunting drifts in, talks, and pays once when shooed', () => {
  const s = shelf(), souls = s.mayhem.souls;
  const g = { id: ref(7), fromUser: BEA, fromName: 'Bea', ghost: grubbs, createdAt: NOW - 10, endsAt: NOW + 3600000 };
  assert.ok(X.receiveInbox(s, box({ hauntings: [g] }), ME, NOW).haunt);
  const h = X.activeHaunt(s, NOW);
  assert.equal(h.ghost.name, 'Grubbs');
  const said = new Set(Array.from({ length: 40 }, (_, i) => X.hauntLine(s, h, i)));
  assert.ok(said.size >= 15, 'it has plenty to say');
  assert.ok([...said].every(l => !l.includes('{')));
  const r = X.shooHaunt(s, 5, NOW + 10);
  assert.equal(r.souls, X.SHOO_SOULS);
  assert.equal(s.mayhem.souls, souls + X.SHOO_SOULS);
  assert.equal(X.activeHaunt(s, NOW + 20), null);
  assert.equal(X.shooHaunt(s, 5, NOW + 30), null, 'once');
  assert.deepEqual(X.outboxFor(s, ME).map(o => [o.op, o.taps]), [['shoo', 5]]);
  X.receiveInbox(s, box({ hauntings: [g] }), ME, NOW + 40);
  assert.equal(X.activeHaunt(s, NOW + 50), null, 'a shooed ghost is not let back in');
  X.receiveInbox(s, box({ hauntings: [{ ...g, id: ref(8), fromUser: CAT, fromName: 'Cat' }] }), ME, NOW + 60);
  assert.equal(X.activeHaunt(s, NOW + 70).from.name, 'Cat', 'the next one can come in');
  assert.equal(X.shooHaunt(s, 6, NOW + 80).souls, X.SHOO_SOULS);
  X.receiveInbox(s, box({ hauntings: [{ ...g, id: ref(9), fromUser: CAT, fromName: 'Cat' }] }), ME, NOW + 90);
  assert.equal(X.shooHaunt(s, 6, NOW + 100).souls, 0, 'two paid shoos a day');
  X.settleMischief(s, NOW + 2 * 86400000);
  assert.equal(s.mischief.haunt, null, 'it leaves when its day is up');
});

test('a knock pays the server’s roll: souls, a seasonal curio, or a trick in your own tray', () => {
  const s = shelf(), bea = { userId: BEA, name: 'Bea' };
  const souls = s.mayhem.souls;
  const treat = X.takeKnock(s, bea, { id: ref(20), result: 'treat', prize: 'souls', souls: 99, bowl: 'full-size' }, NOW);
  assert.equal(treat.souls, 30, 'never more than the server may pay');
  assert.equal(s.mayhem.souls, souls + 30);
  const curio = X.takeKnock(s, bea, { id: ref(21), result: 'treat', prize: 'curio', souls: 0 }, NOW, () => 0);
  assert.ok(SEASONAL_CURIOS.some(c => c.id === curio.curio.curio.id));
  assert.equal(s.mayhem.curios[curio.curio.curio.id], 1);
  const trick = X.takeKnock(s, bea, { id: ref(22), result: 'trick', prize: TRICK_DECK[3].id, souls: 0, culprit: grubbs }, NOW);
  assert.equal(trick.queued, true);
  const [entry] = X.settleMischief(s, NOW);
  const info = describeEmergency(s, entry);
  assert.equal(info.from, 'from Bea’s doorstep');
  const result = resolveEmergency(s, entry.uid, 0, NOW, () => 0.1);
  assert.ok(result.souls >= 10);
  assert.equal(result.note, '');
  assert.deepEqual(X.outboxFor(s, ME).filter(o => o.op === 'resolve'), [], 'a trick is played locally only');
  // Full of hexes: the trick waits on the step instead.
  X.receiveInbox(s, box({ hexes: [serverHex(1), serverHex(2)] }), ME, NOW);
  X.takeKnock(s, bea, { id: ref(23), result: 'trick', prize: TRICK_DECK[0].id, souls: 0, culprit: null }, NOW);
  assert.equal(X.takeKnock(s, bea, { id: ref(24), result: 'trick', prize: TRICK_DECK[1].id, souls: 0, culprit: null }, NOW).queued, false);
  // Twelve paid knocks a day.
  const t = shelf();
  const paid = Array.from({ length: 14 }, (_, i) => X.takeKnock(t, bea, { id: ref(40 + i), result: 'treat', prize: 'souls', souls: 10 }, NOW).souls);
  assert.equal(paid.filter(Boolean).length, X.KNOCK_PAID_PER_DAY);
});

test('the sender reads how it went, in the brief’s own words', () => {
  assert.equal(X.hexResultLine({ id: ref(1), toName: 'Bea', card: 'unsolicited-accordion', culpritName: 'Grubbs', status: 'resolved', choice: 0, outcome: 0, rebound: false }),
    'Bea resolved your Unsolicited Accordion with a firm lid. Your Grubbs was returned, flattened.');
  assert.match(X.hexResultLine({ id: ref(1), toName: 'Bea', card: 'unsolicited-accordion', culpritName: 'Grubbs', status: 'resolved', choice: 0, outcome: 1, rebound: true }),
    /It rebounded: Bea may send one back, free\.$/);
  const declined = X.hexResultLine({ id: ref(2), toName: 'Bea', card: 'damp-invitation', culpritName: 'Grubbs', status: 'declined' });
  assert.ok(HEX_DECLINED_LINES.some(l => declined === l.replace(/\{f\}/g, 'Bea').replace(/\{c\}/g, 'Grubbs').replace(/\{hex\}/g, 'Damp Invitation')));
  assert.match(X.hexResultLine({ id: ref(3), toName: '', card: 'nope', culpritName: '', status: 'expired' }), /^[A-Z]/);
  assert.match(X.hauntResultLine({ id: ref(4), toName: 'Bea', ghostName: 'Grubbs', status: 'shooed', taps: 6 }), /Bea|Grubbs/);
  assert.ok(X.doorstepLine(6).startsWith('Six knocks tonight') || X.doorstepLine(6).includes('Six'));
  assert.ok([0, 1, 2, 5, 6, 13, 40].every(n => !X.doorstepLine(n, 'x').includes('{')));
});

test('a household fixture with mischief in it survives backup and restore', () => {
  // normalizeState reads the real clock, so this household is built around it.
  const hexed = householdFixture('hexed', Date.now());
  assert.equal(hexed.mischief.hexes.length, 2, 'one hex in the tray and one waiting');
  assert.ok(hexed.mayhem.queue.some(q => q.ext?.card === 'unsolicited-accordion'));
  assert.ok(hexed.mischief.haunt && hexed.mischief.helps.length && hexed.mischief.outbox.length);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(hexed))), hexed);
  assert.equal(describeEmergency(hexed, hexed.mayhem.queue[0]).from, 'from Bea’s shelf');
  // Long after, the hexes and the ghost are gone and nothing else changed.
  const later = householdFixture('hexed', Date.now() - 5 * 86400000);
  assert.deepEqual([later.mischief.hexes, later.mayhem.queue, later.mischief.haunt], [[], [], null]);
  assert.equal(later.pets.length, hexed.pets.length);
});
