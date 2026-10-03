import test from 'node:test';
import assert from 'node:assert/strict';
import { householdFixture } from './household-fixtures.mjs';
import { normalizeState, blankState } from '../src/state.js';
import { createBackup } from '../src/backup.js';
import { FREE_DECOR_KEYS } from '../src/almanac-state.js';

// A date in the past, like the other fixture tests: the save clamps times to the real clock.
const now = new Date(2026, 8, 12, 12).getTime();
const RETENTION = ['almanac', 'streaks', 'returns', 'legacy', 'collections', 'exchange'];

test('a long-time household keeps every piece of the new state through backup, restore and restore again', () => {
  const source = householdFixture('veteran', now);
  for (const key of RETENTION) assert.ok(source[key] && typeof source[key] === 'object', key + ' is in the save');
  assert.equal(source.almanac.chapters['thin-2026'].claimed, 31);
  assert.equal(source.streaks.freezes, 1);
  assert.equal(source.exchange.frame, 'tin');
  assert.equal(source.exchange.title, 'set:paper');
  assert.deepEqual(source.collections.claimed, ['paper']);
  assert.ok(source.decor.owned.includes('room:pumpkin-hollow'));
  assert.deepEqual(source.settings.nudgeCats, { emergency: true, away: false, almanac: true, chest: true });
  let loaded = normalizeState(JSON.parse(createBackup(source, now).text));
  for (const key of RETENTION) assert.deepEqual(loaded[key], source[key], key + ' survives a backup');
  assert.deepEqual(loaded.decor.owned.slice().sort(), source.decor.owned.slice().sort());
  const stable = JSON.stringify(loaded);
  for (let i = 0; i < 3; i++) loaded = normalizeState(JSON.parse(createBackup(loaded, now).text));
  assert.equal(JSON.stringify(loaded), stable, 'repeated restores are stable');
});

test('a save from before any of this existed loads unchanged, with blank new state and everything free still owned', () => {
  const full = householdFixture('established', now);
  const old = JSON.parse(JSON.stringify(full));
  for (const key of RETENTION) delete old[key];
  delete old.decor.owned; delete old.settings.nudgeCats;
  const loaded = normalizeState(old);
  assert.ok(loaded);
  assert.deepEqual(loaded.pets.map(p => p.id), full.pets.map(p => p.id));
  assert.deepEqual(loaded.slots, full.slots);
  assert.equal(JSON.stringify(loaded.mayhem), JSON.stringify(full.mayhem));
  assert.equal(JSON.stringify(loaded.arcade), JSON.stringify(full.arcade));
  assert.equal(JSON.stringify(loaded.courtroom), JSON.stringify(full.courtroom));
  assert.equal(loaded.almanac.init, 0, 'the Almanac re-bases on first sight, so there is no windfall');
  assert.equal(loaded.streaks.freezes, 0);
  assert.equal(loaded.returns.seenAt, 0, 'no return card for a household with no recorded visit');
  assert.equal(loaded.legacy.spent, 0);
  assert.deepEqual(loaded.collections.claimed, []);
  assert.deepEqual(loaded.exchange.frames, []);
  assert.deepEqual(loaded.decor.owned.slice().sort(), [...FREE_DECOR_KEYS].sort());
  assert.deepEqual({ ...loaded.decor, owned: undefined }, { ...full.decor, owned: undefined }, 'their room, wall, wood and accent are untouched');
  assert.deepEqual(loaded.settings.nudgeCats, { emergency: true, away: true, almanac: true, chest: true });
});

test('hostile or hand-edited retention state is repaired, never trusted', () => {
  const raw = JSON.parse(JSON.stringify(householdFixture('established', now)));
  raw.almanac = { init: 1, chapters: { 'thin-2026': { xp: 1e300, claimed: 'all', badge: 9 } }, week: { done: ['x'], counts: { care: -1 } }, by: { __proto__: { polluted: 1 } }, constructor: 5 };
  raw.streaks = { freezes: 'lots', notices: 'none' };
  raw.exchange = { frames: ['gilt', 'nope'], frame: 'gilt', titles: ['ch:thin-2026', '<script>'], title: '<script>', portrait: { __proto__: 'x' } };
  raw.legacy = { spent: 1e9 };
  raw.decor.owned = ['room:catacomb-chic', 'room:../../etc', 5, null];
  raw.collections = { claimed: ['paper', '../paper'] };
  const loaded = normalizeState(raw);
  assert.ok(loaded);
  assert.ok(loaded.almanac.chapters['thin-2026'].xp <= 1e6);
  assert.equal(loaded.almanac.chapters['thin-2026'].badge, 0);
  assert.equal(({}).polluted, undefined);
  assert.equal(loaded.streaks.freezes, 0);
  assert.deepEqual(loaded.streaks.notices, []);
  assert.deepEqual(loaded.exchange.frames, ['gilt']);
  assert.deepEqual(loaded.exchange.titles, ['ch:thin-2026']);
  assert.equal(loaded.exchange.title, '');
  assert.equal(loaded.legacy.spent, 0, 'cannot spend tokens that were never earned');
  assert.ok(loaded.decor.owned.includes('room:catacomb-chic') && !loaded.decor.owned.some(k => k.includes('..')));
  assert.deepEqual(loaded.collections.claimed, ['paper']);
});

test('a brand new household starts level and the retention state is small', () => {
  const s = blankState();
  for (const key of RETENTION) assert.ok(s[key], key);
  assert.equal(s.almanac.init, 1);
  assert.ok(JSON.stringify(RETENTION.map(k => s[k])).length < 700);
  const loaded = normalizeState(JSON.parse(JSON.stringify({ ...s, pets: [] })));
  assert.deepEqual(RETENTION.map(k => loaded[k]), RETENTION.map(k => s[k]));
});

test('an equipped Legacy title survives a reload, because it is earned from lifetime souls and not stored', () => {
  const s = blankState();
  s.mayhem.lifetime = 40000;
  s.exchange = { frames: [], frame: 'plain', portraits: [], portrait: {}, commissions: [], titles: [], title: 'lg:2' };
  const once = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(once.exchange.title, 'lg:2');
  assert.equal(normalizeState(JSON.parse(JSON.stringify(once))).exchange.title, 'lg:2', 'and again');
  const poor = blankState();
  poor.exchange = { ...s.exchange };
  assert.equal(normalizeState(JSON.parse(JSON.stringify(poor))).exchange.title, '', 'a title that has not been earned is dropped');
  const wild = blankState();
  wild.mayhem.lifetime = 40000;
  wild.exchange = { ...s.exchange, title: 'lg:9999' };
  assert.equal(normalizeState(JSON.parse(JSON.stringify(wild))).exchange.title, '', 'so is one beyond the ladder');
});
