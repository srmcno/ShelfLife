// Trading on the client: readers, the save state, escrow, and applying a
// sealed trade exactly once, against the in-memory Supabase (fake-trades.mjs
// mirrors 0004_trades.sql). Two players, and for some tests two devices of one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './support/fake-supabase.mjs';
import { socialPlayer } from './support/social-world.mjs';
import { householdFixture } from './household-fixtures.mjs';
import { normalizeState, SLOT_COUNT } from '../src/state.js';
import { createBackup } from '../src/backup.js';
import { createCloud } from '../src/cloud/client.js';
import { createSocial } from '../src/cloud/social.js';
import { createTrades, readTrade, readTradeList, readTradeBook, tradeSnapshot, tradeText } from '../src/cloud/trades.js';
import { createTradeSync } from '../src/cloud/trade-sync.js';
import { normalizeTrades, blankTrades, tradesState } from '../src/trade-state.js';
import {
  spareCount, spares, applyTrade, packingFor, residentBlock, offerBlock, acceptBlock, toggleWish, seatWaiting, lastLineFor, firstLineFor, tradeBook
} from '../src/engine/trades.js';
import { LAST_LINES, FIRST_LINES, WELCOME_LINES, FAREWELL_LINES, TRADE_LINES } from '../src/content/trades.js';

const NOW = Date.UTC(2026, 9, 3, 17);
const DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));

function household(names, curios = {}) {
  const s = householdFixture('established', NOW - 1000);
  s.pets.forEach((p, i) => { if (names[i]) { p.name = names[i]; p.names = [{ name: names[i], at: s.started }]; } });
  s.pets = s.pets.slice(0, names.length);
  s.slots = s.slots.map(id => !id || s.pets.some(p => p.id === id) || s.props.some(p => p.id === id) ? id : null);
  s.mayhem.curios = { ...curios };
  return normalizeState(s);
}
function memory(seed = {}) {
  const items = new Map(Object.entries(seed));
  return { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k) };
}
let clock = NOW;
const now = () => clock;
async function trader(fake, name, state) {
  const p = await socialPlayer(fake, name, state, { now });
  const box = { state };
  const trades = createTrades({ cloud: p.cloud });
  const sync = createTradeSync({ cloud: p.cloud, social: p.social, trades, getState: () => box.state, now });
  return { ...p, box, trades, sync, get state() { return box.state; } };
}
// Another device signed in to the same account, with its own copy of the shelf.
function secondDevice(fake, player, state) {
  const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory({ 'shelflife.cloud': JSON.stringify({ session: player.cloud.session(), socialUser: player.id }) }), now });
  const social = createSocial({ cloud, getState: () => state, now });
  const box = { state };
  const trades = createTrades({ cloud });
  return { cloud, social, box, trades, sync: createTradeSync({ cloud, social, trades, getState: () => box.state, now }), get state() { return box.state; } };
}
async function world(adaCurios = { 'moth-wing': 3, 'glass-eye': 2, 'tiny-coffin': 1 }, beaCurios = { 'half-candle': 2, 'button-eye': 4 }) {
  clock = NOW;
  const fake = createFakeSupabase({ now });
  const ada = await trader(fake, 'Ada', household(['Agnes', 'Mabel', 'Pip'], adaCurios));
  const bea = await trader(fake, 'Bea', household(['Gladys', 'Snag', 'Wanda'], beaCurios));
  await ada.social.addFriend(bea.code);
  await bea.social.respond(ada.id, true);
  return { fake, ada, bea };
}
const curioDraft = (give, want = {}) => ({ mode: 'curio', give, want });
const curios = state => ({ ...state.mayhem.curios });

test('the content pools are long enough, curly and dash free', () => {
  for (const [pool, min] of [[LAST_LINES, 12], [FIRST_LINES, 12], [WELCOME_LINES, 12], [FAREWELL_LINES, 6], [TRADE_LINES, 8]]) {
    assert.ok(pool.length >= min, 'pool of ' + pool.length);
    for (const line of pool.map(x => typeof x === 'string' ? x : x.text)) {
      assert.ok(!/[\u2013\u2014]/.test(line), 'no dashes: ' + line);
      assert.ok(!/["']/.test(line.replace(/\{\w+\}/g, '')), 'curly quotes only: ' + line);
    }
  }
  for (const line of [...LAST_LINES, ...FIRST_LINES]) assert.match(line, /^“.*”$/, 'spoken lines are quoted');
  assert.equal(lastLineFor('00000000-0000-4000-8000-000000000001', 'Mabel', 'Bea'), lastLineFor('00000000-0000-4000-8000-000000000001', 'Mabel', 'Bea'), 'the same words on every device');
  assert.ok(!firstLineFor('00000000-0000-4000-8000-000000000002', 'Mabel', 'Bea').includes('{'), 'placeholders are filled');
});

test('old saves load with an empty trading book, and junk is bounded or dropped', () => {
  const old = householdFixture('veteran', NOW);
  delete old.trades;
  const loaded = normalizeState(old);
  assert.deepEqual(loaded.trades, blankTrades());
  const id = '00000000-0000-4000-8000-0000000000aa';
  const messy = normalizeTrades({
    wishlist: ['moth-wing', 'moth-wing', 'not-a-curio', ...Array.from({ length: 20 }, () => 'glass-eye'), 'tiny-coffin'],
    escrow: { [id]: { curios: { 'moth-wing': 9, nope: 1 }, residentId: 'qa0', to: 'x' }, bad: { curios: { 'moth-wing': 1 } }, ['00000000-0000-4000-8000-0000000000ab']: {} },
    applied: [{ id, at: NOW }, { id, at: NOW - 1 }, { id: 'nope' }, ...Array.from({ length: 500 }, (_, i) => ({ id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), at: i }))],
    portraits: [{ id, name: 'Mabel', art: { body: 'javascript:alert(1)', stamps: [] }, lines: ['a', 7] }, { id: 'x', name: 'y' }],
    waiting: [{ trade: id, pet: { id: 'tr-' + id, name: 'Gladys', traits: ['damp', 'nope'], art: {} } }, { trade: id, pet: { id: 'qa0' } }],
    notices: [{ id, kind: 'sealed', text: 'x'.repeat(2000) }, { id, kind: 'nonsense' }]
  }, { pets: [{ id: 'qa0', arrivedByTrade: { id: 'junk' } }, { id: 'qa1', arrivedByTrade: { id, at: 'soon', from: 'Bea'.repeat(20) } }] }, NOW);
  assert.deepEqual(messy.wishlist, ['moth-wing', 'glass-eye', 'tiny-coffin']);
  assert.deepEqual(Object.keys(messy.escrow), [id]);
  assert.deepEqual(messy.escrow[id].curios, { 'moth-wing': 3 });
  assert.equal(messy.applied.length, 400);
  assert.equal(messy.applied.filter(a => a.id === id).length, 1);
  assert.equal(messy.portraits.length, 1);
  assert.equal(messy.portraits[0].art.body, '', 'only PNG drawings survive');
  assert.deepEqual(messy.portraits[0].lines, ['a']);
  assert.equal(messy.waiting.length, 1);
  assert.deepEqual(messy.waiting[0].pet.traits, ['damp']);
  assert.equal(messy.notices.length, 1);
  assert.equal(messy.notices[0].text.length, 600);
  const s = household(['Agnes', 'Mabel'], { 'moth-wing': 2 });
  s.pets[0].arrivedByTrade = { id: 'junk' };
  s.pets[1].arrivedByTrade = { id, at: NOW, from: 'Bea' };
  const again = normalizeState(s);
  assert.equal(again.pets[0].arrivedByTrade, undefined, 'a malformed record is dropped, never the resident');
  assert.deepEqual(again.pets[1].arrivedByTrade, { id, at: NOW, from: 'Bea' });
  const stable = JSON.stringify(normalizeState(JSON.parse(createBackup(again, NOW).text)));
  assert.equal(JSON.stringify(normalizeState(JSON.parse(stable))), stable, 'repeated restores are stable');
});

test('readers rebuild what the server sends and refuse what they do not recognise', () => {
  const id = '00000000-0000-4000-8000-0000000000aa', a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  const raw = { id, from_user: a, to_user: b, from_name: 'Ada\u0000<b>', to_name: 'Bea', kind: 'curio', status: 'open', line: 'nope',
    created_at: '2026-10-03T17:00:00Z', expires_at: '2026-10-10T17:00:00Z', closed_at: null,
    items: [{ side: 'from', kind: 'curio', ref: 'moth-wing', qty: 9 }, { side: 'from', kind: 'curio', ref: 'from-the-future', qty: 1 }, { side: 'to', kind: 'curio', ref: 'glass-eye', qty: 1 }, { side: 'sideways', kind: 'curio', ref: 'x' }] };
  const t = readTrade(raw);
  assert.deepEqual(t.give.curios, [{ id: 'moth-wing', n: 3 }]);
  assert.deepEqual(t.want.curios, [{ id: 'glass-eye', n: 1 }]);
  assert.equal(t.unknown, true, 'an unknown curio is flagged so the offer cannot be accepted');
  assert.equal(t.line, '');
  assert.equal(t.fromName, 'Ada <b>');
  assert.equal(readTrade({ ...raw, status: 'stolen' }), null);
  assert.equal(readTrade({ ...raw, id: 'x' }), null);
  const res = readTrade({ ...raw, kind: 'resident', items: [{ side: 'from', kind: 'resident', ref: 'p1', snapshot: { id: 'evil', name: 'Mabel', traits: ['damp', 'nope'], stats: { cute: 99 }, bio: 'x'.repeat(900), art: { stamps: [] } } },
    { side: 'to', kind: 'resident', ref: 'q1', snapshot: { id: 'q1', name: 'Snag' } }] });
  assert.equal(res.give.resident.id, 'p1', 'the item ref wins over the snapshot id');
  assert.deepEqual(res.give.resident.traits, ['damp']);
  assert.equal(res.give.resident.stats.cute, 10);
  assert.equal(res.give.resident.bio.length, 600);
  assert.equal(res.give.resident.artPending, true, 'a list leaves the drawing at home');
  assert.equal(res.want.resident.placeholder, true);
  const list = readTradeList({ now: '2026-10-03T17:00:00Z', count: 1000, trades: [raw, raw, { junk: true }] });
  assert.equal(list.trades.length, 1);
  assert.equal(list.count, 99);
  assert.deepEqual(readTradeBook({ wishlist: ['moth-wing', 'nope', 'moth-wing'], spares: { 'glass-eye': 2, nope: 1, 'tiny-coffin': -1 } }), { wishlist: ['moth-wing'], spares: { 'glass-eye': 2 }, updatedAt: 0 });
  assert.equal(tradeText({ code: 'P0001', message: 'resident_limit' }).startsWith('Two residents a week'), true);
  assert.equal(tradeText({ code: 'P0001', message: 'not_friends' }).length > 0, true);
});

test('spares: copies beyond the first, minus anything on hold; the wishlist holds twelve', () => {
  const s = household(['Agnes'], { 'moth-wing': 3, 'glass-eye': 1 });
  assert.equal(spareCount(s, 'moth-wing'), 2);
  assert.equal(spareCount(s, 'glass-eye'), 0, 'the last copy never leaves');
  assert.deepEqual(spares(s), { 'moth-wing': 2 });
  tradesState(s).escrow['00000000-0000-4000-8000-0000000000aa'] = { curios: { 'moth-wing': 2 }, residentId: '', user: '', to: '', toName: '', at: NOW };
  assert.equal(spareCount(s, 'moth-wing'), 0);
  assert.deepEqual(tradeBook(s), { wishlist: [], spares: {} });
  const ids = ['moth-wing', 'glass-eye', 'tiny-coffin', 'half-candle', 'button-eye', 'warm-glove', 'damp-receipt', 'name-tag', 'coffin-nail', 'death-photo', 'lake-ring', 'jar-teeth'];
  for (const id of ids) assert.equal(toggleWish(s, id), 'added');
  assert.equal(toggleWish(s, 'planchette'), 'full');
  assert.equal(toggleWish(s, 'moth-wing'), 'removed');
  assert.equal(toggleWish(s, 'not-a-curio'), false);
});

test('a curio gift: held on offer, accepted once, applied once on each side', async () => {
  const { fake, ada, bea } = await world();
  const before = curios(ada.state);
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 2 }), line: 'hiding' });
  assert.equal(offer.status, 'open');
  assert.deepEqual(curios(ada.state), before, 'the curios stay in the cabinet while held');
  assert.equal(spareCount(ada.state, 'moth-wing'), 0);
  await assert.rejects(ada.sync.propose({ to: bea.id, draft: curioDraft({ 'moth-wing': 1 }) }), /do not have a spare Moth Wing/);
  assert.deepEqual((await bea.sync.book(ada.id)).spares, { 'glass-eye': 1 }, 'friends see only what is still spare');

  await bea.sync.sync({ force: true });
  assert.equal(bea.sync.waiting(), 1);
  const incoming = bea.sync.cache().trades.find(t => t.id === offer.id);
  assert.equal(acceptBlock(bea.state, incoming, bea.id, now()), '');
  const { result } = await bea.sync.accept(incoming);
  assert.deepEqual(result.curiosIn, [{ id: 'moth-wing', n: 2 }]);
  assert.equal(bea.state.mayhem.curios['moth-wing'], 2);
  assert.equal(bea.state.trades.notices[0].kind, 'sealed');
  await assert.rejects(bea.sync.accept(incoming), /already been settled|not yours/i);

  clock += 60000;
  const first = await ada.sync.sync({ force: true });
  assert.equal(first.results.length, 1);
  assert.equal(ada.state.mayhem.curios['moth-wing'], 1);
  assert.deepEqual(ada.state.trades.escrow, {}, 'the hold is released once applied');
  const settled = JSON.stringify(ada.state.mayhem.curios);
  const second = await ada.sync.sync({ force: true });
  assert.equal(second.results.length, 0, 'a second look changes nothing');
  assert.equal(JSON.stringify(ada.state.mayhem.curios), settled);
  const sealed = await ada.trades.payload(offer.id);
  assert.equal(applyTrade(ada.state, sealed, { me: ada.id }), null, 'applying by hand twice is refused by id');
  assert.equal(applyTrade(bea.state, sealed, { me: bea.id }), null);
  assert.equal(fake.social.trades.trades.get(offer.id).status, 'accepted');
});

test('a curio swap with a counter: the original is released, the counter held, and both sides balance', async () => {
  const { ada, bea } = await world();
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'glass-eye': 1 }, { 'button-eye': 3 }) });
  await bea.sync.sync({ force: true });
  const incoming = bea.sync.cache().trades.find(t => t.id === offer.id);
  const counter = await bea.sync.counter(incoming, { draft: curioDraft({ 'button-eye': 1 }, { 'glass-eye': 1, 'moth-wing': 1 }), line: 'counter' });
  assert.equal(counter.parent, offer.id);
  assert.ok(packingFor(bea.state, '') === null && bea.state.trades.escrow[counter.id], 'Bea holds her side of the counter');
  await ada.sync.sync({ force: true });
  assert.equal(ada.state.trades.escrow[offer.id], undefined, 'Ada’s original is released');
  assert.equal(ada.state.trades.notices[0].kind, 'countered');
  const theirs = ada.sync.cache().trades.find(t => t.id === counter.id);
  await assert.rejects(ada.sync.counter(theirs, { draft: curioDraft({ 'moth-wing': 1 }) }), /cannot be countered/);
  await ada.sync.accept(theirs);
  await bea.sync.sync({ force: true });
  assert.deepEqual([ada.state.mayhem.curios['glass-eye'], ada.state.mayhem.curios['moth-wing'], ada.state.mayhem.curios['button-eye']], [1, 2, 1]);
  assert.deepEqual([bea.state.mayhem.curios['glass-eye'], bea.state.mayhem.curios['moth-wing'], bea.state.mayhem.curios['button-eye']], [1, 1, 3]);
});

test('decline, cancel, expiry and a deleted account all release escrow, with a word when it was not the player', async () => {
  const { fake, ada, bea } = await world();
  const declined = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 1 }) });
  const expired = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 1 }) });
  const cancelled = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'glass-eye': 1 }) });
  assert.equal(spareCount(ada.state, 'moth-wing'), 0);
  await bea.sync.sync({ force: true });
  await bea.sync.decline(bea.sync.cache().trades.find(t => t.id === declined.id));
  fake.social.trades.age(expired.id, 8 * DAY);
  await ada.sync.cancel(cancelled);
  assert.equal(spareCount(ada.state, 'glass-eye'), 1, 'cancelling releases at once');
  await ada.sync.sync({ force: true });
  assert.deepEqual(ada.state.trades.escrow, {});
  assert.equal(spareCount(ada.state, 'moth-wing'), 2);
  assert.deepEqual(ada.state.trades.notices.map(n => n.kind).sort(), ['declined', 'expired'], 'the player’s own cancel needs no notice');

  const vanished = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 1 }) });
  await bea.cloud.deleteAccount();
  await ada.sync.sync({ force: true });
  assert.equal(ada.state.trades.escrow[vanished.id], undefined, 'an offer the server no longer has is released');
});

test('a resident swap: two step checks, a framed portrait, a fresh arrival with one memory, and a welcome', async () => {
  const { ada, bea } = await world();
  const agnes = ada.state.pets.find(p => p.name === 'Agnes'), gladys = bea.state.pets.find(p => p.name === 'Gladys');
  ada.state.stories.relationships[[agnes.id, ada.state.pets[1].id].sort().join('|')] = { time: 40 * 60000, plots: 2 };
  agnes.grudges = 3;
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: { mode: 'resident', giveResident: agnes.id, wantResident: { id: gladys.id, name: 'Gladys' } } });
  assert.ok(packingFor(ada.state, agnes.id), 'Agnes is packing to leave');
  assert.ok(ada.state.pets.some(p => p.id === agnes.id), 'and still on the shelf');
  assert.match(residentBlock(ada.state, agnes, now()), /already packed/);
  await assert.rejects(ada.sync.propose({ to: bea.id, draft: { mode: 'resident', giveResident: agnes.id } }), /already packed/);
  await bea.sync.sync({ force: true });
  const incoming = bea.sync.cache().trades.find(t => t.id === offer.id);
  assert.equal(incoming.give.resident.name, 'Agnes');
  const { result } = await bea.sync.accept(incoming);
  assert.equal(result.arrived.pet.name, 'Agnes');
  assert.equal(result.departed.name, 'Gladys');
  const arrived = bea.state.pets.find(p => p.id === 'tr-' + offer.id);
  const look = c => [c.body, c.palette, JSON.stringify(c.parts)];
  assert.deepEqual([arrived.name, arrived.traits, look(arrived.art.creature)], [agnes.name, agnes.traits, look(agnes.art.creature)], 'name, traits and look travel');
  assert.deepEqual(arrived.stats, agnes.stats, 'and the personality');
  assert.deepEqual([arrived.bond, arrived.grudges, arrived.needs], [0, 0, { food: 78, fuss: 78, clean: 82 }], 'needs start fresh');
  assert.equal(arrived.arrivedByTrade.from, 'Ada');
  assert.equal(bea.state.life.scenes.filter(s => s.kind === 'trade' && s.cast.includes(arrived.id)).length, 1, 'one memory of the move');
  assert.ok(bea.state.notes.some(n => n.kind === 'arrival' && n.text.includes('Agnes')), 'the new household gets a welcome line');
  assert.ok(!bea.state.pets.some(p => p.id === gladys.id));
  assert.equal(bea.state.trades.portraits[0].name, 'Gladys');
  assert.match(residentBlock(bea.state, arrived, now()), /only just arrived/);

  await ada.sync.sync({ force: true });
  assert.ok(!ada.state.pets.some(p => p.id === agnes.id), 'Agnes has left Ada’s shelf');
  assert.equal(ada.state.pets.find(p => p.id === 'tr-' + offer.id).name, 'Gladys');
  const portrait = ada.state.trades.portraits[0];
  assert.deepEqual([portrait.name, portrait.to], ['Agnes', 'Bea']);
  assert.match(portrait.lines.join(' '), /Lived here/);
  assert.match(portrait.lines.join(' '), /3 grievances/);
  assert.match(portrait.lines.join(' '), /Closest to Mabel/, 'bonds with the other residents are summarised');
  assert.equal(portrait.lastLine, lastLineFor(offer.id, 'Agnes', 'Bea'));
  assert.equal(ada.state.trades.notices[0].last, portrait.lastLine, 'the same last words in the postbox');
  assert.equal(ada.state.pets.length, 3);
  assert.equal(normalizeState(clone(ada.state)).pets.length, 3, 'the shelf still loads');
});

test('the last resident cannot leave, and a full shelf cannot take a gift', async () => {
  const { ada, bea } = await world();
  ada.box.state = household(['Agnes'], { 'moth-wing': 2 });
  assert.match(offerBlock(ada.state, { mode: 'resident', giveResident: ada.state.pets[0].id }), /last resident/);
  await assert.rejects(ada.sync.propose({ to: bea.id, draft: { mode: 'resident', giveResident: ada.state.pets[0].id } }), /last resident/);
  // Two residents, one packing: the other is now the last to stay.
  ada.box.state = household(['Agnes', 'Mabel'], {});
  await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: { mode: 'resident', giveResident: ada.state.pets[0].id } });
  assert.match(residentBlock(ada.state, ada.state.pets[1], now()), /last resident/);
  // Bea's shelf is full of furniture: the gift waits until she makes room.
  bea.box.state.slots = bea.box.state.slots.map((s, i) => s || 'qad' + (i % 3));
  await bea.sync.sync({ force: true });
  const gift = bea.sync.cache().trades.find(t => t.status === 'open');
  assert.match(acceptBlock(bea.state, gift, bea.id), /shelf is full/);
});

test('a resident who arrives to a full shelf waits on the doorstep, then moves in', async () => {
  const { ada, bea } = await world();
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: { mode: 'resident', giveResident: ada.state.pets[2].id } });
  await bea.sync.sync({ force: true });
  await bea.sync.accept(bea.sync.cache().trades.find(t => t.id === offer.id));
  // A second copy of Bea's shelf that was full when it caught up.
  const copy = clone(bea.state);
  copy.pets = copy.pets.filter(p => p.id !== 'tr-' + offer.id);
  copy.slots = copy.slots.map((s, i) => s === 'tr-' + offer.id || !s ? 'filler' + i : s);
  copy.trades.applied = [];
  const full = { ...copy, slots: copy.slots };
  const sealed = await bea.trades.payload(offer.id);
  const result = applyTrade(full, sealed, { me: bea.id, now: now() });
  assert.equal(result.arrived.waiting, true);
  assert.equal(full.trades.waiting.length, 1);
  assert.ok(!full.pets.some(p => p.id === 'tr-' + offer.id));
  const loaded = normalizeState({ ...full, slots: full.slots.map(s => s?.startsWith('filler') ? null : s) });
  assert.equal(loaded.trades.waiting.length, 1, 'the waiting resident survives a reload');
  assert.equal(seatWaiting(loaded, now()).length, 1);
  assert.ok(loaded.pets.some(p => p.id === 'tr-' + offer.id));
  assert.equal(loaded.trades.waiting.length, 0);
  assert.ok(loaded.pets.length <= SLOT_COUNT);
});

test('a restored backup that still has a traded-away resident: removed, explained, kept as a portrait', async () => {
  const { ada, bea } = await world();
  const backup = createBackup(ada.state, NOW).text; // taken before the offer
  const mabel = ada.state.pets.find(p => p.name === 'Mabel');
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: { mode: 'resident', giveResident: mabel.id } });
  await bea.sync.sync({ force: true });
  await bea.sync.accept(bea.sync.cache().trades.find(t => t.id === offer.id));
  await ada.sync.sync({ force: true });
  assert.ok(!ada.state.pets.some(p => p.id === mabel.id));
  // Ada restores the old file: Mabel is back in it, with no record of the trade.
  ada.box.state = normalizeState(JSON.parse(backup));
  assert.ok(ada.state.pets.some(p => p.id === mabel.id));
  const r = await ada.sync.sync({ force: true });
  assert.equal(r.results.length, 1);
  assert.ok(!ada.state.pets.some(p => p.id === mabel.id), 'Mabel cannot be in two places');
  const n = ada.state.trades.notices.find(x => x.kind === 'restored');
  assert.match(n.text, /This copy of the shelf still had Mabel/);
  assert.equal(ada.state.trades.portraits[0].name, 'Mabel');
  await assert.rejects(ada.trades.propose({ to: bea.id, give: { resident: mabel } }), /already been traded away/, 'and the server would refuse to send her again');
  // Bea restores an old file too: Mabel arrives again on that copy, once.
  bea.box.state = household(['Gladys', 'Snag', 'Wanda'], {});
  await bea.sync.sync({ force: true });
  assert.equal(bea.state.pets.filter(p => p.id === 'tr-' + offer.id).length, 1);
  await bea.sync.sync({ force: true });
  assert.equal(bea.state.pets.filter(p => p.id === 'tr-' + offer.id).length, 1);
});

test('two devices on one account: the hold follows the offer, and the trade lands once on each copy', async () => {
  const { fake, ada, bea } = await world();
  const phone = secondDevice(fake, ada, clone(ada.state));
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 2 }) });
  await phone.sync.sync({ force: true });
  assert.deepEqual(phone.state.trades.escrow[offer.id].curios, { 'moth-wing': 2 }, 'the phone holds the offer the tablet made');
  assert.equal(spareCount(phone.state, 'moth-wing'), 0);
  await bea.sync.sync({ force: true });
  await bea.sync.accept(bea.sync.cache().trades.find(t => t.id === offer.id));
  await phone.sync.sync({ force: true });
  await ada.sync.sync({ force: true });
  assert.equal(ada.state.mayhem.curios['moth-wing'], 1);
  assert.equal(phone.state.mayhem.curios['moth-wing'], 1);
  // Cloud save keeps one copy or the other, never a merge: either is already settled.
  for (const kept of [ada.state, phone.state]) {
    const box = secondDevice(fake, ada, normalizeState(clone(kept)));
    const r = await box.sync.sync({ force: true });
    assert.equal(r.results.length, 0);
    assert.equal(box.state.mayhem.curios['moth-wing'], 1);
  }
  // A copy from before the trade (a stale device winning the conflict) catches up once.
  const stale = secondDevice(fake, ada, household(['Agnes', 'Mabel', 'Pip'], { 'moth-wing': 3, 'glass-eye': 2, 'tiny-coffin': 1 }));
  await stale.sync.sync({ force: true });
  assert.equal(stale.state.mayhem.curios['moth-wing'], 1);
});

test('offline at the moment of acceptance: nothing changes; a lost reply is settled on the next look', async () => {
  const { fake, ada, bea } = await world();
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 1 }, { 'button-eye': 1 }) });
  await bea.sync.sync({ force: true });
  const incoming = bea.sync.cache().trades.find(t => t.id === offer.id);
  fake.setOffline(true);
  await assert.rejects(bea.sync.accept(incoming), err => err.offline === true);
  assert.equal(bea.state.trades.escrow[offer.id].accepting, true, 'her half stays held until the server is asked again');
  assert.equal(spareCount(bea.state, 'button-eye'), 2);
  fake.setOffline(false);
  await bea.sync.sync({ force: true });
  assert.equal(bea.state.trades.escrow[offer.id], undefined, 'still open on the server, so the hold is released');
  assert.equal(bea.state.mayhem.curios['button-eye'], 4, 'and nothing moved');
  // The reply is lost after the server sealed it: the hold stays, and the next look applies it.
  const realAccept = bea.trades.accept;
  bea.trades.accept = async (...args) => { await realAccept(...args); throw Object.assign(new Error('Could not reach the cloud.'), { code: 'offline', offline: true }); };
  await assert.rejects(bea.sync.accept(incoming));
  bea.trades.accept = realAccept;
  assert.equal(bea.state.mayhem.curios['moth-wing'], undefined);
  await bea.sync.sync({ force: true });
  assert.equal(bea.state.mayhem.curios['moth-wing'], 1);
  assert.equal(bea.state.mayhem.curios['button-eye'], 3);
  assert.ok(!bea.state.trades.notices.some(n => n.kind === 'restored'), 'nothing to explain: this device held it');
});

test('a refused accept releases the hold at once, and the receiver’s side is checked first', async () => {
  const { ada, bea } = await world();
  const offer = await ada.sync.propose({ to: bea.id, toName: 'Bea', draft: curioDraft({ 'moth-wing': 1 }, { 'half-candle': 1 }) });
  await bea.sync.sync({ force: true });
  const incoming = bea.sync.cache().trades.find(t => t.id === offer.id);
  bea.state.mayhem.curios['half-candle'] = 1;
  await assert.rejects(bea.sync.accept(incoming), /no longer have a spare Half a Candle/);
  bea.state.mayhem.curios['half-candle'] = 2;
  await ada.sync.cancel(offer);
  await assert.rejects(bea.sync.accept(incoming), /already been settled/);
  assert.equal(bea.state.trades.escrow[offer.id], undefined);
  assert.equal(spareCount(bea.state, 'half-candle'), 1);
});

test('the trading book is published when it changes, and only then', async () => {
  const { fake, ada, bea } = await world();
  toggleWish(ada.state, 'half-candle');
  await ada.sync.sync({ force: true });
  assert.deepEqual(await bea.sync.book(ada.id), { wishlist: ['half-candle'], spares: { 'glass-eye': 1, 'moth-wing': 2 }, updatedAt: now() });
  const calls = fake.calls('publish_trade_book').length;
  await ada.sync.sync({ force: true });
  assert.equal(fake.calls('publish_trade_book').length, calls, 'an unchanged book is not sent again');
  assert.equal(tradeSnapshot({ id: 'x', name: 'Big', art: { body: 'data:image/png;base64,' + 'A'.repeat(130000), stamps: [] } }), null, 'a drawing too large to post is refused, never dropped');
});
