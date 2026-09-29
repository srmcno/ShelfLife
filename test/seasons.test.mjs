import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { CURIOS } from '../src/content/mayhem.js';
import { SEASONS, SEASONAL_CURIOS, SEASON_RARITY } from '../src/content/seasons.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import { activeSeason, seasonProgress, seasonReturns } from '../src/engine/seasons.js';
import { rollCurio, openCoffin, addSouls, curioCount, CURIO_BY_ID, RARITY_BY_ID, COFFIN_COST } from '../src/engine/mayhem.js';
import { normalizeMayhem } from '../src/mayhem-state.js';

const at = (m, d, h = 12) => new Date(2026, m, d, h).getTime();
const household = () => {
  const s = blankState();
  s.pets = [{ id: 'a', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 0, cared: 0, grudges: 0 }];
  s.slots[0] = 'a';
  return s;
};

test('seasonal content is well formed and does not collide with the ordinary cabinet', () => {
  const ids = new Set(CURIOS.map(c => c.id));
  for (const season of SEASONS) {
    assert.ok(season.chance > 0 && season.chance < 1);
    assert.ok(season.curios.length >= 4);
    for (const c of season.curios) {
      assert.ok(!ids.has(c.id), 'duplicate id ' + c.id); ids.add(c.id);
      assert.equal(c.rarity, 'season');
      assert.ok(GLYPH_NAMES.includes(c.glyph), c.id + ' uses an unknown glyph');
      assert.ok(c.text.length <= 200 && c.name.length <= 40);
      assert.ok(!/—/.test(c.name + c.text), 'no em dashes');
    }
  }
  assert.equal(RARITY_BY_ID.season, SEASON_RARITY);
  for (const c of SEASONAL_CURIOS) assert.equal(CURIO_BY_ID[c.id], c);
});

test('a season is open from its first day to its last, every year, and closed outside', () => {
  const thin = SEASONS.find(s => s.id === 'thin-season');
  assert.equal(activeSeason(at(9, 14)), null);
  assert.equal(activeSeason(at(9, 15, 0)), thin);
  assert.equal(activeSeason(at(9, 31)), thin);
  assert.equal(activeSeason(at(10, 2, 23)), thin);
  assert.equal(activeSeason(at(10, 3)), null);
  assert.equal(activeSeason(new Date(2031, 9, 20).getTime()), thin);
  assert.equal(activeSeason(at(0, 1)), null);
  assert.equal(seasonReturns(thin, at(10, 3)).getFullYear(), 2027);
  assert.equal(seasonReturns(thin, at(8, 1)).getFullYear(), 2026);
});

test('windows may wrap the new year', () => {
  const winter = { id: 'test-winter', name: 'Test', from: [11, 20], to: [0, 5], chance: 0.5, blurb: '', curios: [] };
  SEASONS.push(winter);
  try {
    assert.equal(activeSeason(at(11, 25)), winter);
    assert.equal(activeSeason(at(0, 3)), winter);
    assert.equal(activeSeason(at(0, 6)), null);
    assert.equal(activeSeason(at(11, 19)), null);
  } finally { SEASONS.pop(); }
});

test('in season some rolls are seasonal, preferring curios you lack; out of season none are', () => {
  const s = household();
  const inSeason = at(9, 20);
  // rnd: first call is the season check (below chance), second picks fresh over any, third picks the index.
  const seasonal = rollCurio(s, (() => { const v = [0.1, 0.1, 0]; let i = 0; return () => v[i++ % 3]; })(), false, inSeason);
  assert.equal(seasonal.rarity, SEASON_RARITY);
  assert.equal(seasonal.seasonal, 'thin-season');
  assert.equal(seasonal.duplicate, false);
  assert.ok(s.mayhem.curios[seasonal.curio.id]);
  // Fresh ones are preferred: keep rolling low and every new roll is a new curio until the set is full.
  const owned = new Set([seasonal.curio.id]);
  for (let i = 0; i < 5; i++) {
    const r = rollCurio(s, (() => { const v = [0.1, 0.1, 0.3]; let j = 0; return () => v[j++ % 3]; })(), false, inSeason);
    assert.equal(r.duplicate, false); assert.ok(!owned.has(r.curio.id)); owned.add(r.curio.id);
  }
  assert.equal(owned.size, SEASONS[0].curios.length);
  // Now everything is owned, so a seasonal roll is a duplicate that refunds.
  const before = s.mayhem.souls;
  const dup = rollCurio(s, () => 0.1, false, inSeason);
  assert.equal(dup.duplicate, true); assert.equal(dup.refund, SEASON_RARITY.refund);
  assert.equal(s.mayhem.souls, before + SEASON_RARITY.refund);
  // Out of season the same dice give an ordinary curio and never consume the season check.
  const plain = household();
  const calls = [];
  const rec = () => { calls.push(1); return 0; };
  const ordinary = rollCurio(plain, rec, false, at(8, 1));
  assert.notEqual(ordinary.rarity, SEASON_RARITY);
  assert.ok(!ordinary.seasonal);
  assert.ok(CURIOS.some(c => c.id === ordinary.curio.id));
});

test('seasonal curios survive a reload, stay out of the ordinary count and cannot be ordered', () => {
  const s = household();
  addSouls(s, COFFIN_COST * 20);
  const first = SEASONS[0].curios[0];
  s.mayhem.curios[first.id] = 2;
  assert.equal(curioCount(s), 0, 'the ordinary cabinet count ignores seasonal curios');
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.mayhem.curios[first.id], 2);
  assert.deepEqual(seasonProgress(back.mayhem, SEASONS[0]), { owned: 1, total: SEASONS[0].curios.length });
  assert.deepEqual(Object.keys(normalizeMayhem({ curios: { [first.id]: 1, 'ts-fake': 3 } }, s, Date.now()).curios), [first.id]);
  // A coffin in season can hold one.
  const t = household();
  addSouls(t, COFFIN_COST);
  const r = openCoffin(t, at(9, 20), (() => { const v = [0.1, 0.1, 0]; let i = 0; return () => v[i++ % 3]; })());
  assert.equal(r.rarity, SEASON_RARITY);
});
