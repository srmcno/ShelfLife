import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAME_A, NAME_B, NAME_FORMS, SIGIL_SHAPES, SIGIL_SYMBOLS, SIGIL_COLOURS, COUNTERS, DAILY_CAPS, COUNTER_WORDS, GOALS, CHEST_TIERS,
  COVEN_CURIOS, SIGIL_FRAMES, INVITE_FRAMES, AWARDS, CEREMONY, COVEN_LINES, EMPTY_BOARD, DUPLICATE_SOULS, INVITE_REPEAT_SOULS
} from '../src/content/coven.js';
import { MAGNETS, MAGNET_BY_ID, DENY, DENY_STEMS, tileId, PUNCTUATION } from '../src/content/magnets.js';
import { PORTRAIT_BY_ID } from '../src/content/collections.js';
import { blankCoven, normalizeCovenState, covenState } from '../src/coven-state.js';
import {
  utcDay, covenWeek, weekStart, daysLeft, thresholds, tierReached, goalLine, syncCoven, setCoven, pendingReports, markReported,
  payChest, chestPaid, bindCovenRewards, invitePaid, wearFrame, payInvite, randomName, randomSigil, covenName, cleanSigil, memberColours, noteParts, noteText, hideNote,
  computeAwards, ceremonyScript, recordCeremony
} from '../src/engine/coven.js';
import { normalizeState, localDayKey } from '../src/state.js';
import { currencyRewardId, captureCoopMoney, applyCoopReward, readCoopRewardDetail } from '../src/engine/coop-money.js';
import { householdFixture } from './household-fixtures.mjs';

const NODASH = /[–—]/;
const STRAIGHT = /["']/;
const MON = Date.UTC(2026, 9, 12, 9);          // Monday 12 October 2026, 09:00 UTC
const SUN = Date.UTC(2026, 9, 11, 23, 59, 59);  // the Sunday before, one second to midnight
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function playerText() {
  const out = [];
  NAME_A.forEach(([, t]) => out.push(t)); NAME_B.forEach(([, t]) => out.push(t)); out.push(...NAME_FORMS);
  [...SIGIL_SHAPES, ...SIGIL_SYMBOLS, ...SIGIL_COLOURS].forEach(x => out.push(x.name));
  Object.values(COUNTER_WORDS).forEach(w => out.push(...w));
  GOALS.forEach(g => out.push(g.title, g.line, g.aside));
  CHEST_TIERS.forEach(t => out.push(t.name, t.line));
  [...COVEN_CURIOS, ...SIGIL_FRAMES].forEach(x => out.push(x.name, x.line));
  AWARDS.forEach(a => out.push(a.title, ...a.lines));
  Object.values(CEREMONY).forEach(list => out.push(...list));
  Object.values(COVEN_LINES).forEach(list => out.push(...list));
  out.push(EMPTY_BOARD);
  return out;
}

test('every line a player reads has no dashes and only curly quotes', () => {
  for (const t of playerText()) {
    assert.equal(typeof t, 'string');
    assert.ok(t.trim(), 'no blank lines');
    assert.ok(!NODASH.test(t), 'dash in: ' + t);
    assert.ok(!STRAIGHT.test(t), 'straight quote in: ' + t);
  }
  for (const t of MAGNETS) assert.ok(!NODASH.test(t.text) && !STRAIGHT.test(t.text), t.text);
});

test('the name banks: unique ids, every pairing reads in every form, thousands of names', () => {
  for (const bank of [NAME_A, NAME_B]) {
    const ids = bank.map(([id]) => id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]{1,24}$/);
  }
  assert.ok(NAME_A.length * NAME_B.length * NAME_FORMS.length >= 4000, 'enough names that a re-roll feels like one');
  assert.equal(covenName({ a: 'damp', b: 'sisterhood', form: 0 }), 'The Damp Sisterhood');
  assert.equal(covenName({ a: 'second-drawer', b: 'society', form: 1 }), 'Society of the Second Drawer');
  assert.equal(covenName({ a: 'unwashed', b: 'book-club', form: 3 }), 'Book Club for the Unwashed');
  assert.equal(covenName({ a: 'x-from-the-future', b: '<b>', form: 9 }), 'The Unrecorded Society', 'unknown ids never become text');
  const rnd = seeded(7), names = new Set();
  for (let i = 0; i < 40; i++) { const n = randomName(rnd); assert.ok(NAME_FORMS[n.form]); names.add(covenName(n)); }
  assert.ok(names.size > 30, 're-rolls vary');
});

test('sigils come from parts, and members get colours in order', () => {
  for (const list of [SIGIL_SHAPES, SIGIL_SYMBOLS, SIGIL_COLOURS]) assert.equal(new Set(list.map(x => x.id)).size, list.length);
  assert.ok(SIGIL_SYMBOLS.length >= 10 && SIGIL_SHAPES.length >= 5 && SIGIL_COLOURS.length >= 6);
  const s = randomSigil(seeded(3));
  assert.deepEqual(cleanSigil(s), s);
  assert.deepEqual(cleanSigil({ shape: 'pentagram', symbol: 'x', colour: '#fff' }), { shape: 'shield', symbol: 'candle', colour: 'ash' });
  const colours = memberColours('rust', 6);
  assert.equal(colours[0], SIGIL_COLOURS.find(c => c.id === 'rust').hex);
  assert.equal(new Set(colours).size, 6);
});

test('the weekly goal pool: twenty and more, built from the Almanac counters, with daily caps', () => {
  assert.ok(GOALS.length >= 20);
  assert.equal(new Set(GOALS.map(g => g.id)).size, GOALS.length);
  for (const g of GOALS) {
    assert.ok(COUNTERS.includes(g.counter), g.id);
    assert.ok(g.per > 0 && g.per * 6 <= DAILY_CAPS[g.counter] * 7 * 6, g.id + ' is possible within the caps');
    assert.match(g.line, /\{n\}/);
    assert.equal(g.id, g.counter + '-' + g.per);
  }
  assert.deepEqual(Object.keys(DAILY_CAPS).sort(), [...COUNTERS].sort());
  assert.equal(new Set(GOALS.map(g => g.counter)).size, COUNTERS.length, 'every counter has a goal');
  assert.equal(goalLine('court-3', 15), 'Hear 15 Shelf Court cases between you.');
  assert.deepEqual(thresholds(72), [24, 48, 72]);
  assert.deepEqual(thresholds(10), [4, 7, 10]);
  assert.deepEqual([0, 3, 4, 7, 9, 10, 99].map(p => tierReached(p, 10)), [0, 0, 1, 2, 2, 3, 3]);
});

test('the magnet bank: about three hundred tiles, every id shaped for the server, nothing from the deny list', () => {
  assert.ok(MAGNETS.length >= 280 && MAGNETS.length <= 360, 'about three hundred: ' + MAGNETS.length);
  const ids = MAGNETS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  for (const t of MAGNETS) {
    assert.match(t.id, /^[a-z0-9-]{1,20}$/, t.text);
    if (t.group !== 'punct') assert.equal(t.id, tileId(t.text.replace(/ /g, '-')), 'id is derived from the text: ' + t.text);
  }
  assert.ok(DENY.length > 60 && DENY_STEMS.length > 5);
  for (const t of MAGNETS) {
    const words = t.text.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
    for (const w of words) {
      assert.ok(!DENY.includes(w), 'denied word in the bank: ' + t.text);
      assert.ok(!DENY_STEMS.some(stem => w.startsWith(stem)), 'denied stem in the bank: ' + t.text);
    }
  }
  for (const word of ['drawer', 'regret', 'spoon', 'allegedly', 'again', 'moist', 'the', 'is', 'my']) assert.ok(MAGNET_BY_ID[word], word);
  assert.ok(MAGNETS.filter(t => t.group === 'glue').length >= 50, 'enough small words to make a sentence');
  assert.equal(MAGNETS.filter(t => t.group === 'punct').length, PUNCTUATION.length);
});

test('a note is drawn from known tiles only, with names for members and punctuation attached', () => {
  const B = '00000000-0000-4000-8000-000000000002';
  const parts = noteParts(['@' + B, 'owes', 'me', 'a', 'spoon', 'comma', 'allegedly', 'bang', 'kill', '<b>', 7], { [B]: 'Bea' });
  assert.deepEqual(parts.map(p => p.kind), ['name', 'word', 'word', 'word', 'word', 'punct', 'word', 'punct']);
  assert.equal(noteText(parts), 'Bea owes me a spoon, allegedly!');
  assert.equal(noteText(noteParts(['@00000000-0000-4000-8000-000000000009', 'dont', 'qm'])), 'someone who left Don’t?');
  assert.deepEqual(noteParts(null), []);
  assert.equal(noteText(noteParts(['keith', 'poss', 'custardcream'])), 'Keith’s custard cream');
});

test('weeks run Monday to Sunday in UTC, like the server', () => {
  assert.equal(covenWeek(MON), covenWeek(SUN) + 1, 'midnight UTC on Monday starts a week');
  assert.equal(covenWeek(SUN), covenWeek(Date.UTC(2026, 9, 5, 0, 0, 0)));
  assert.equal(new Date(weekStart(covenWeek(MON))).toISOString(), '2026-10-12T00:00:00.000Z');
  assert.equal(utcDay(SUN), '2026-10-11');
  assert.equal(daysLeft(covenWeek(MON), MON), 7);
  assert.equal(daysLeft(covenWeek(SUN), SUN), 1);
});

test('the coven state normalizes from anything, stays small, and is stable', () => {
  assert.deepEqual(normalizeCovenState(undefined), blankCoven());
  assert.deepEqual(normalizeCovenState([1, 2]), blankCoven());
  const messy = normalizeCovenState({
    init: 1, seen: { care: 12.7, resolved: -4, bogus: 9 }, flagDay: '2026-9-12', flags: { omen: 1, x: 3 },
    day: '2026-10-12', tally: { omen: 9, care: 3, souls: 99 }, sent: { care: 1 }, prev: { day: 'yesterday', tally: {} },
    covenId: 'not-a-uuid', claimed: ['1:1', '1:1', '2:4', 'x', ...Array.from({ length: 40 }, (_, i) => i + ':2')],
    curios: { 'cv-spoon': 2, 'cv-nope': 1, __proto__: 1 }, frames: ['ivy', 'ivy', 'nope'], frame: 'lace',
    trophies: Array.from({ length: 20 }, (_, i) => ({ week: i, award: i % 2 ? 'least' : 'nonsense', n: 3 })), seenAwards: 4,
    hidden: [1, 1, -2, 'x', 3.5, 9], invite: { code: 'abc', paid: ['00000000-0000-4000-8000-000000000002', 'x'] }, extra: 'dropped'
  });
  assert.deepEqual(messy.seen, { care: 12, resolved: 0, coffins: 0, outings: 0, episodes: 0, arcade: 0, curios: 0 });
  assert.deepEqual(messy.flags, { omen: 1 });
  assert.deepEqual(messy.tally, { omen: 1, care: 3 }, 'capped at the daily cap, unknown counters dropped');
  assert.equal(messy.prev, null);
  assert.equal(messy.covenId, '');
  assert.equal(messy.claimed.length, 24);
  assert.ok(!messy.claimed.includes('2:4'));
  assert.deepEqual(messy.curios, { 'cv-spoon': 2 });
  assert.deepEqual([messy.frames, messy.frame], [['ivy'], '']);
  assert.ok(messy.trophies.every(t => t.award === 'least') && messy.trophies.length === 10);
  assert.deepEqual(messy.hidden, [1, 9]);
  assert.deepEqual(messy.invite, { code: '', paid: ['00000000-0000-4000-8000-000000000002'] });
  assert.equal(messy.extra, undefined);
  assert.deepEqual(normalizeCovenState(JSON.parse(JSON.stringify(messy))), messy, 'idempotent');
  assert.ok(JSON.stringify(normalizeCovenState(messy)).length < 2500);
});

test('an old save without a coven loads unchanged, and gains an empty one', () => {
  const now = Date.UTC(2026, 9, 12, 12);
  const old = householdFixture('veteran', now);
  delete old.coven;
  const loaded = normalizeState(old);
  assert.deepEqual(loaded.coven, blankCoven());
  const { coven, ...rest } = loaded;
  const { coven: _, ...before } = normalizeState(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(rest, before);
});

function shelf(now) {
  const s = householdFixture('established', now);
  s.mayhem.resolved = 10; s.mayhem.coffins = 2;
  return s;
}
const C1 = '00000000-0000-4000-8000-0000000000c1', C2 = '00000000-0000-4000-8000-0000000000c2';

test('counting: no windfall for the past, nothing while out of a coven, then each change once', () => {
  let t = MON;
  const s = shelf(t);
  assert.deepEqual(syncCoven(s, t), {}, 'the first look takes a baseline');
  assert.equal(s.coven.init, 1);
  s.mayhem.resolved += 4;
  assert.deepEqual(syncCoven(s, t += 1000), {}, 'not in a coven: re-based, not counted');
  assert.deepEqual(s.coven.tally, {});
  setCoven(s, C1, t);
  s.mayhem.resolved += 3; s.mayhem.coffins += 1; s.pets[0].careLog.food += 2;
  assert.deepEqual(syncCoven(s, t += 1000), { emergency: 3, coffin: 1, care: 2 });
  assert.deepEqual(syncCoven(s, t += 1000), {}, 'seen once');
  // The omen is a day flag: flipped once today, counted once today.
  s.mayhem.omen = { day: localDayKey(t), id: 'wet-hand', streak: 1, lastDay: localDayKey(t), grace: 0 };
  assert.deepEqual(syncCoven(s, t += 1000), { omen: 1 });
  assert.deepEqual(syncCoven(s, t += 1000), {});
  // A count that fell (a restore) is re-based, and never taken back.
  s.mayhem.resolved -= 5;
  assert.deepEqual(syncCoven(s, t += 1000), {});
  s.mayhem.resolved += 2;
  assert.deepEqual(syncCoven(s, t += 1000), { emergency: 2 });
  assert.deepEqual(s.coven.tally, { emergency: 5, coffin: 1, care: 2, omen: 1 });
  // A busy day stops at the server's cap.
  s.mayhem.resolved += 500;
  syncCoven(s, t += 1000);
  assert.equal(s.coven.tally.emergency, DAILY_CAPS.emergency);
});

test('reports: running totals for today, yesterday’s leftovers once, and a new coven starts from zero', () => {
  let t = SUN - 3600000;
  const s = shelf(t);
  syncCoven(s, t); setCoven(s, C1, t);
  s.mayhem.resolved += 6; syncCoven(s, t += 1000);
  let reports = pendingReports(s, t);
  assert.deepEqual(reports, [{ day: '2026-10-11', counts: { emergency: 6 }, prev: false }]);
  markReported(s, reports[0]);
  assert.deepEqual(pendingReports(s, t), [], 'nothing new to say');
  s.mayhem.resolved += 2; syncCoven(s, t += 1000);
  // Midnight UTC passes before the next report.
  t = MON;
  s.mayhem.coffins += 1; syncCoven(s, t);
  reports = pendingReports(s, t);
  assert.deepEqual(reports, [{ day: '2026-10-11', counts: { emergency: 8 }, prev: true }, { day: '2026-10-12', counts: { coffin: 1 }, prev: false }]);
  reports.forEach(r => markReported(s, r));
  assert.deepEqual(pendingReports(s, t), []);
  assert.equal(s.coven.prev, null);
  // Joining another coven: today's count starts again.
  assert.equal(setCoven(s, C2, t), true);
  assert.equal(setCoven(s, C2, t), false, 'the same coven changes nothing');
  assert.deepEqual(s.coven.tally, {});
  s.mayhem.coffins += 2; syncCoven(s, t += 1000);
  assert.deepEqual(pendingReports(s, t)[0].counts, { coffin: 2 });
  setCoven(s, '', t);
  assert.deepEqual(pendingReports(s, t), [], 'out of a coven, nothing to report');
});

test('chests pay once into this save: souls, the next cupboard curio, a sigil frame, souls for duplicates', () => {
  const s = shelf(MON), souls = s.mayhem.souls;
  const one = payChest(s, 100, 1);
  assert.deepEqual([one.souls, one.curio, one.frame], [CHEST_TIERS[0].souls, null, null]);
  assert.equal(payChest(s, 100, 1), null, 'once');
  assert.ok(chestPaid(s, 100, 1));
  const two = payChest(s, 100, 2);
  assert.ok(two.curio && COVEN_CURIOS.some(c => c.id === two.curio.id));
  const three = payChest(s, 100, 3);
  assert.ok(three.frame && SIGIL_FRAMES.some(f => f.id === three.frame.id));
  assert.equal(s.mayhem.souls, souls + CHEST_TIERS.reduce((n, t) => n + t.souls, 0));
  assert.equal(payChest(s, 100, 4), null);
  // Every curio and frame owned: souls instead.
  for (let w = 101; w < 101 + COVEN_CURIOS.length + SIGIL_FRAMES.length; w++) { payChest(s, w, 2); payChest(s, w, 3); }
  assert.equal(Object.keys(s.coven.curios).length, COVEN_CURIOS.length);
  assert.equal(s.coven.frames.length, SIGIL_FRAMES.length);
  const before = s.mayhem.souls, dup = payChest(s, 200, 2);
  assert.deepEqual([dup.curio, dup.extra], [null, DUPLICATE_SOULS]);
  assert.equal(s.mayhem.souls, before + CHEST_TIERS[1].souls + DUPLICATE_SOULS);
  assert.equal(wearFrame(s, 'gilt'), true);
  assert.equal(wearFrame(s, 'nope'), false);
  assert.equal(normalizeState(s).coven.frame, 'gilt');
});

test('invite rewards: the pair of frames once, then souls; the frames are real portrait frames the Exchange does not sell', () => {
  for (const id of INVITE_FRAMES) assert.equal(PORTRAIT_BY_ID[id]?.reward, 'invite', id);
  const s = shelf(MON), souls = s.mayhem.souls;
  const first = payInvite(s, C1);
  assert.deepEqual(first.frames, INVITE_FRAMES);
  assert.equal(payInvite(s, C1), null, 'once per friend');
  assert.deepEqual(payInvite(s, C2).souls, INVITE_REPEAT_SOULS);
  assert.equal(s.mayhem.souls, souls + INVITE_REPEAT_SOULS);
  const loaded = normalizeState(s);
  for (const id of INVITE_FRAMES) assert.ok(loaded.exchange.portraits.includes(id), 'kept by normalizeExchange');
});

const member = (userId, name, counts = {}, extra = {}) => ({ userId, name, counts, days: 0, late: 0, notes: 0, ...extra });
test('the Shelfies: everyone wins exactly one thing, the same on every phone, Least Help last', () => {
  const members = [
    member('u1', 'Ada', { emergency: 40, coffin: 2 }, { days: 6 }),
    member('u2', 'Bea', { emergency: 30, coffin: 9, omen: 5 }, { days: 5, late: 9 }),
    member('u3', 'Cat', { care: 3 }, { days: 1 }),
    member('u4', 'Dan', {}, {}),
    member('u5', 'Eve', { court: 4, arcade: 2 }, { days: 2, notes: 3 }),
    member('u6', 'Fay', { emergency: 1 }, { days: 1 })
  ];
  const awards = computeAwards({ week: 3000, counter: 'emergency', members });
  assert.equal(awards.length, 6);
  assert.deepEqual(new Set(awards.map(a => a.userId)).size, 6, 'one each');
  assert.equal(new Set(awards.map(a => a.award)).size, 6, 'no award twice');
  assert.equal(awards.at(-1).award, 'least');
  assert.equal(awards.at(-1).name, 'Dan', 'the one who did nothing is Least Help');
  assert.equal(awards.find(a => a.userId === 'u1').award, 'carried', 'the top contributor to the goal carried it');
  for (const a of awards) {
    assert.ok(a.line.includes(a.name), a.line);
    assert.ok(!/\{|\}/.test(a.line), a.line);
  }
  assert.deepEqual(computeAwards({ week: 3000, counter: 'emergency', members: [...members].reverse() }), awards, 'order of members does not matter');
  // Two members who both did nothing: neither is told they helped least.
  const idle = computeAwards({ week: 5, counter: 'care', members: [member('a', 'A'), member('b', 'B')] });
  assert.deepEqual(idle.map(a => AWARDS.find(x => x.id === a.award).stat), ['zero', 'zero']);
  // Somebody outshone at everything still gets a kind word, not a zero.
  const shade = computeAwards({ week: 9, counter: 'care', members: [
    member('a', 'A', { care: 50, coffin: 9 }, { days: 7, late: 9 }), member('b', 'B', { care: 49, coffin: 8 }, { days: 6, late: 8 }), member('c', 'C', { care: 48, coffin: 7 }, { days: 5, late: 7 }),
    member('d', 'D', { care: 47 }, { days: 4 }), member('e', 'E', { care: 1 }, { days: 1 })] });
  assert.ok(shade.every(a => AWARDS.find(x => x.id === a.award).stat !== 'zero'));
  assert.deepEqual(computeAwards({ week: 1, counter: 'care', members: [] }), []);
  const solo = computeAwards({ week: 1, counter: 'care', members: [member('a', 'A', { care: 3 })] });
  assert.equal(solo[0].award, 'carried', 'a coven of one is not insulted');
});

test('the ceremony script is fixed for the week, and watching it puts your own trophy on the shelf once', () => {
  const awards = computeAwards({ week: 77, counter: 'omen', members: [member('me', 'Me', { omen: 4 }), member('you', 'You', { omen: 1 })] });
  const a = ceremonyScript(77, awards), b = ceremonyScript(77, awards);
  assert.deepEqual(a, b);
  assert.ok(CEREMONY.openings.includes(a.opening) && CEREMONY.closings.includes(a.closing));
  assert.ok(a.steps.every(s => s.envelope && s.reaction));
  assert.notEqual(ceremonyScript(78, awards).opening, a.opening, 'next week opens differently');
  assert.ok(CEREMONY.openings.length >= 12, 'twelve weeks before an opening repeats');
  const s = shelf(MON);
  assert.equal(recordCeremony(s, 77, awards, 'me', 'The Damp Sisterhood'), true);
  assert.equal(recordCeremony(s, 77, awards, 'me', 'The Damp Sisterhood'), false);
  assert.equal(recordCeremony(s, 76, awards, 'me'), false, 'an older ceremony does not go back on the shelf');
  assert.deepEqual(s.coven.trophies, [{ week: 77, award: 'carried', n: 4, coven: 'The Damp Sisterhood' }]);
  assert.equal(normalizeState(s).coven.trophies.length, 1);
});

test('hiding a note is local, bounded and once', () => {
  const s = shelf(MON);
  assert.equal(hideNote(s, 5), true);
  assert.equal(hideNote(s, 5), false);
  assert.equal(hideNote(s, -1), false);
  for (let i = 10; i < 80; i++) hideNote(s, i);
  assert.equal(covenState(s).hidden.length, 40);
});


test('chest and referral payment marks belong to the account that earned them', () => {
  const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002', friend = '00000000-0000-4000-8000-000000000003';
  const s = shelf();
  assert.ok(payChest(s, 2963, 1, A));
  assert.equal(payChest(s, 2963, 1, A), null);
  assert.ok(payChest(s, 2963, 1, B), 'the second account has its own eligible chest');
  assert.equal(payChest(s, 2963, 1, B), null);
  assert.equal(payChest(s, 2963, 1, A), null, 'switching back retains the first receipt');
  assert.ok(payInvite(s, friend, A));
  assert.ok(payInvite(s, friend, B), 'a shared friend is not a shared referral receipt');
  assert.equal(payInvite(s, friend, A), null);
  assert.equal(payInvite(s, friend, B), null);
});


test('prototype unowned marks are retained without guessing an account, and financial history outlives the display cache', () => {
  const A = '00000000-0000-4000-8000-000000000001';
  const s = shelf(); s.coven = blankCoven(); s.coven.claimed = ['2963:1']; s.coven.invite.paid = [C1];
  bindCovenRewards(s, A);
  assert.deepEqual(s.coven.unownedRewards, { claimed: ['2963:1'], paid: [C1] });
  assert.equal(chestPaid(s, 2963, 1, A), false); assert.equal(invitePaid(s, C1, A), false);
  for (let week = 2963; week < 2995; week++) payChest(s, week, 1, A);
  assert.equal(s.coven.claimed.length, 24);
  const restored = normalizeState(s);
  assert.equal(restored.coven.rewards[A].claimed.length, 32);
  const prototype = normalizeCovenState({ claimed: Array.from({ length: 40 }, (_, i) => (2900 + i) + ':1') });
  assert.equal(prototype.claimed.length, 24); assert.equal(prototype.unownedRewards.claimed.length, 40);
  assert.equal(chestPaid(restored, 2963, 1, A), true);
  assert.equal(payChest(restored, 2963, 1, A), null, 'an old tier cannot become payable when it leaves the display');
});


test('semantic chest and referral receipts preserve money once and replay their owned effects after restore', async () => {
  const A = '00000000-0000-4000-8000-000000000001', friend = C1;
  const s = shelf(), before = structuredClone(s), operation = await currencyRewardId(A, 'coven_chest:2963:2');
  const chest = payChest(s, 2963, 2, A, operation), total = s.mayhem.souls;
  assert.ok(chest.curio);
  assert.equal(captureCoopMoney(s, A), null, 'the award is not also recorded as a random save delta');
  const receipt = s.coop.money.pending.find(p => p.id === operation);
  assert.deepEqual([receipt.delta, receipt.earned, receipt.detail.curio], [70, 70, chest.curio.id]);
  const restored = normalizeState(s);
  restored.coven.claimed = []; restored.coven.rewards[A].claimed = [];
  assert.equal(payChest(restored, 2963, 2, A, operation), null, 'a retained money identity repairs the mark without another award');
  assert.equal(restored.mayhem.souls, total); assert.equal(restored.coop.money.pending.length, 1);
  const purse = before.mayhem.souls;
  applyCoopReward(before, A, receipt.detail); applyCoopReward(before, A, receipt.detail);
  assert.equal(before.mayhem.souls, purse, 'receipt effects do not add wallet money');
  assert.equal(chestPaid(before, 2963, 2, A), true); assert.equal(before.coven.curios[chest.curio.id], 1);
  assert.equal(chestPaid(before, 2963, 2, C2), false);
  const inviteOperation = await currencyRewardId(A, 'coven_invite:' + friend);
  const invite = payInvite(s, friend, A, inviteOperation);
  assert.deepEqual(invite.frames, INVITE_FRAMES);
  const inviteReceipt = s.coop.money.pending.find(p => p.id === inviteOperation);
  assert.equal(inviteReceipt.delta, 0, 'cosmetic-only rewards still have a semantic receipt');
  applyCoopReward(before, A, inviteReceipt.detail);
  assert.equal(invitePaid(before, friend, A), true);
  assert.deepEqual(before.exchange.portraits.slice(-2), INVITE_FRAMES);
  assert.equal(readCoopRewardDetail({ reward: 'coven_chest', week: 2963, tier: 1, curio: chest.curio.id }), null);
});


test('invalid semantic payout identities and hostile receipt parts are refused before mutation', () => {
  const A = '00000000-0000-4000-8000-000000000001', s = shelf(), before = structuredClone(s);
  assert.throws(() => payChest(s, 2963, 1, A, 'invalid'), /Invalid coven reward/);
  assert.throws(() => payInvite(s, C1, A, 'invalid'), /Invalid coven reward/);
  assert.deepEqual(s, before);
  assert.equal(readCoopRewardDetail({ reward: 'coven_chest', week: 2963, tier: 2, curio: '__proto__' }), null);
  assert.equal(readCoopRewardDetail({ reward: 'coven_chest', week: 2963, tier: 3, frame: 'constructor' }), null);
});
