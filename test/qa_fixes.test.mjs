import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { CHAPTERS, ALMANAC_CURIOS } from '../src/content/almanac.js';
import { SEASONS } from '../src/content/seasons.js';
import { DAILY_MODS } from '../src/content/daily.js';
import { chapterAt, nextChapter, LAST_YEAR } from '../src/engine/almanac.js';
import { curioCount, ownedCurioTotal } from '../src/engine/mayhem.js';
import { seededRandom, whackStart, whackHit } from '../src/engine/arcade.js';
import { normalizeArcade, lifetimeRuns, themeUnlocked } from '../src/arcade-state.js';
import { ARCADE_THEMES } from '../src/content/arcade.js';

/* Regressions for the open review findings on the last pull request. */

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 10, 5);
const DAY = 86400000;
function household() {
  const s = blankState();
  s.started = NOW - DAY; s.lastTick = NOW;
  s.pets = [{ id: 'g0', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0, born: NOW - DAY }];
  s.slots[0] = 'g0';
  return s;
}

test('the cabinet counts an Almanac or seasonal curio as owned, even with no ordinary one', () => {
  const s = household();
  assert.equal(ownedCurioTotal(s), 0);
  s.mayhem.curios[ALMANAC_CURIOS[0].id] = 1;
  assert.equal(curioCount(s), 0, 'the base cabinet tile still counts only the ordinary curios');
  assert.equal(ownedCurioTotal(s), 1, 'an Almanac edition is a curio the player owns');
  s.mayhem.curios[SEASONS[0].curios[0].id] = 2;
  assert.equal(ownedCurioTotal(s), 2, 'a seasonal curio counts once, however many copies');
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(ownedCurioTotal(back), 2);
});

test('a flooded grave ignores every hit, so a number key cannot break the combo', () => {
  const flooded = Object.values(DAILY_MODS).flat().find(m => m.id === 'flooded');
  assert.ok(flooded, 'the flooded corners modifier exists');
  const g = whackStart(seededRandom(4), flooded);
  g.combo = 5;
  for (const i of flooded.blocked) {
    const r = whackHit(g, i);
    assert.equal(r.ignored, true, 'grave ' + i + ' is underwater');
    assert.equal(g.combo, 5, 'the streak survives a press on grave ' + i);
  }
  const open = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => !flooded.blocked.includes(i));
  assert.equal(whackHit(g, open).empty, true, 'an open, empty grave is still a miss');
  assert.equal(g.combo, 0);
});

test('an encore chapter names the year it runs in, not the year it was written for', () => {
  const jan28 = chapterAt(at(LAST_YEAR + 1, 1, 10));
  assert.equal(jan28.id, 'resolve-2027');
  assert.equal(jan28.month, 'January ' + (LAST_YEAR + 1));
  assert.equal(chapterAt(at(LAST_YEAR + 3, 7, 4)).month, 'July ' + (LAST_YEAR + 3));
  assert.equal(chapterAt(at(LAST_YEAR + 1, 11, 1)).month, 'October ' + (LAST_YEAR + 1), 'the Thin Season runs into November and keeps its October label');
  assert.equal(nextChapter(at(LAST_YEAR + 1, 12, 20)).month, 'January ' + (LAST_YEAR + 2));
  // The written chapters are untouched.
  assert.equal(chapterAt(at(2027, 1, 10)).month, 'January 2027');
  assert.equal(CHAPTERS.find(c => c.id === 'resolve-2027').month, 'January 2027');
  for (let y = LAST_YEAR + 1; y <= LAST_YEAR + 4; y++) {
    for (let m = 1; m <= 12; m++) {
      const c = chapterAt(at(y, m, 15));
      assert.ok(c.month.endsWith(String(y)), c.key + ' says ' + c.month);
    }
  }
});

test('an old save without lifetime runs counts challenge runs from its residents', () => {
  const s = household();
  s.pets[0].arcadeRuns = 30;
  s.pets.push({ ...s.pets[0], id: 'g1', name: 'Bert', arcadeRuns: 12 });
  s.slots[1] = 'g1';
  // Before `runs` existed: ordinary plays here, challenge runs only on the residents.
  s.arcade = { best: { frenzy: 40 }, plays: { frenzy: 8 }, medals: {}, theme: 'moonlit' };
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.arcade.runs, 42, 'every scoring run a resident remembers counts');
  assert.equal(lifetimeRuns(back.arcade), 42);
  const again = normalizeState(JSON.parse(JSON.stringify(back)));
  assert.equal(again.arcade.runs, 42, 'the migration is idempotent');
});

test('the migration never lowers a count, never applies to a newer save and keeps an earned arena', () => {
  // The day's own challenge plays count when residents were rehomed.
  const old = normalizeArcade({ plays: { stack: 3 }, daily: { day: '2026-9-1', game: 'stack', mod: 'x', best: 9, plays: 4 } }, []);
  assert.equal(old.runs, 7);
  // A save that already has runs is trusted as it is.
  const newer = normalizeArcade({ plays: { stack: 3 }, runs: 5 }, [{ arcadeRuns: 400 }]);
  assert.equal(newer.runs, 5);
  // Hostile values are ignored.
  assert.equal(normalizeArcade({ plays: { stack: 3 } }, [{ arcadeRuns: -9 }, { arcadeRuns: 'many' }, null]).runs, 3);
  // A run-gated arena the old player had chosen survives the reload.
  const gated = ARCADE_THEMES.find(t => t.need?.runs);
  if (gated) {
    const raw = { plays: { frenzy: 1 }, theme: gated.id };
    assert.equal(normalizeArcade(raw, []).theme === gated.id, themeUnlocked({ plays: { frenzy: 1 }, runs: 1 }, gated));
    assert.equal(normalizeArcade(raw, [{ arcadeRuns: gated.need.runs }]).theme, gated.id);
  }
});
