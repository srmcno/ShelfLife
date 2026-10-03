import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey, dayKeyOffset } from '../src/state.js';
import { normalizeArcade } from '../src/arcade-state.js';
import { DAILY_GAME_ORDER, DAILY_MODS, DAILY_SOULS, DAILY_STREAK_SOULS, DAILY_STREAK_CAP } from '../src/content/daily.js';
import { dailyChallenge, dayNumber } from '../src/engine/daily.js';
import {
  seededRandom, startGame, frenzyStep, stackStep, stackDrop, seanceBeat, whackStep, finishRun, challengeToday, STACK, FRENZY
} from '../src/engine/arcade.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
function household() {
  const s = blankState();
  s.started = NOW - DAY; s.lastTick = NOW;
  s.pets = [{ id: 'g0', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0, born: NOW - DAY, arcadeRuns: 0 }];
  s.slots[0] = 'g0';
  return s;
}

test('the challenge is a pure function of the date and rotates through every game and modifier', () => {
  assert.deepEqual(dailyChallenge('2026-8-25'), dailyChallenge('2026-8-25'));
  assert.equal(dailyChallenge('nonsense'), null);
  const games = new Set(), seen = new Set();
  for (let i = 0; i < 4 * 12; i++) {
    const c = dailyChallenge(dayKeyOffset(NOW, i));
    games.add(c.game); seen.add(c.game + ':' + c.mod.id);
    assert.ok(DAILY_MODS[c.game].includes(c.mod));
  }
  assert.deepEqual([...games].sort(), [...DAILY_GAME_ORDER].sort());
  const expected = DAILY_GAME_ORDER.flatMap(g => DAILY_MODS[g].map(m => g + ':' + m.id));
  for (const key of expected) assert.ok(seen.has(key), 'never shown: ' + key);
  // Consecutive days do not repeat a game.
  for (let i = 0; i < 30; i++) assert.notEqual(dailyChallenge(dayKeyOffset(NOW, i)).game, dailyChallenge(dayKeyOffset(NOW, i + 1)).game);
  assert.equal(dayNumber('1970-0-2'), 1);
});

test('day keys step by calendar day', () => {
  assert.equal(dayKeyOffset(NOW, 1), localDayKey(NOW + DAY));
  assert.equal(dayKeyOffset(NOW, -1), localDayKey(NOW - DAY));
  // A month boundary and a leap day.
  assert.equal(dayKeyOffset(new Date(2026, 0, 31, 12).getTime(), 1), '2026-1-1');
  assert.equal(dayKeyOffset(new Date(2028, 1, 28, 12).getTime(), 1), '2028-1-29');
});

test('modifiers really change each game, and no modifier means the original game', () => {
  const plain = startGame('stack', seededRandom(1)), slim = startGame('stack', seededRandom(1), { width: 0.72 });
  assert.ok(Math.abs(slim.stack[0].w - STACK.width * 0.72) < 1e-9);
  assert.equal(plain.stack[0].w, STACK.width);
  // Rush order moves the mover further in the same step.
  const fast = startGame('stack', seededRandom(1), { speed: 1.3 });
  stackStep(plain, 0.1); stackStep(fast, 0.1);
  assert.ok(fast.mover.x > plain.mover.x);
  assert.equal(startGame('seance', seededRandom(2), { start: 5 }).seq.length, 5);
  assert.equal(startGame('seance', seededRandom(2)).seq.length, 3);
  assert.ok(seanceBeat(startGame('seance', seededRandom(2), { beat: 0.75 })) < seanceBeat(startGame('seance', seededRandom(2))));
  // Slippery floor slows the catcher and a storm spawns sooner.
  const a = startGame('frenzy', seededRandom(3)), b = startGame('frenzy', seededRandom(3), { speed: 0.7 });
  a.dir = 1; b.dir = 1; frenzyStep(a, 0.1); frenzyStep(b, 0.1);
  assert.ok(b.x < a.x);
  const spawned = mod => { const g = startGame('frenzy', seededRandom(9), mod); for (let i = 0; i < 4000; i++) { frenzyStep(g, 0.05); g.lives = 99; } return g.serial; };
  assert.ok(spawned({ spawn: 0.7 }) > spawned(null), 'a storm spawns more');
  // Funeral crowd: more mourners in the same number of spawns.
  const mourners = mod => { const g = startGame('whack', seededRandom(5), mod); let n = 0; for (let i = 0; i < 4000; i++) { whackStep(g, 0.1); g.lives = 99; g.holes.forEach(h => { if (h && h.kind === 'mourner') { n++; } }); g.holes = g.holes.map(() => null); } return n; };
  assert.ok(mourners({ mourner: 2 }) > mourners(null));
  const quick = startGame('whack', seededRandom(6), { life: 0.5 }); whackStep(quick, 0.7);
  const slow = startGame('whack', seededRandom(6)); whackStep(slow, 0.7);
  const lifeOf = g => g.holes.find(Boolean)?.life;
  assert.ok(lifeOf(quick) < lifeOf(slow));
  assert.ok(FRENZY.speed > 0);
});

test('a challenge run keeps its own best and pays a bonus once a day, outside the purse', () => {
  const s = household();
  const c = dailyChallenge(localDayKey(NOW));
  const game = c.game;
  s.arcade = normalizeArcade({ best: { [game]: 50 } });
  const first = finishRun(s, game, 20, 'g0', NOW, seededRandom(1), { daily: true });
  assert.ok(first.daily); assert.equal(first.daily.bonus, DAILY_SOULS); assert.equal(first.daily.streak, 1);
  assert.equal(s.arcade.best[game], 50, 'the ordinary record is untouched');
  assert.equal(first.newBest, true, 'a new best for the day');
  assert.equal(first.best, 20);
  const purseBefore = s.mayhem.gameSouls;
  const second = finishRun(s, game, 30, 'g0', NOW + 60000, seededRandom(2), { daily: true });
  assert.equal(second.daily.bonus, 0, 'the flat bonus is once a day');
  assert.equal(second.best, 30);
  assert.ok(s.mayhem.gameSouls >= purseBefore);
  // A score of nothing claims nothing.
  const t = household();
  const empty = finishRun(t, game, 0, 'g0', NOW, seededRandom(3), { daily: true });
  assert.equal(empty.daily.bonus, 0);
  assert.equal(challengeToday(t, NOW).claimed, false);
  // A normal run of the same game is a normal run.
  const normal = finishRun(s, game, 60, 'g0', NOW + 120000, seededRandom(4));
  assert.equal(normal.daily, null); assert.equal(s.arcade.best[game], 60);
  // Running a different game as a "challenge" is just a normal run.
  const other = DAILY_GAME_ORDER.find(g => g !== game);
  assert.equal(finishRun(s, other, 5, 'g0', NOW, seededRandom(5), { daily: true }).daily, null);
});

test('the challenge streak grows on consecutive days, resets after a gap and is capped in pay', () => {
  const s = household();
  let streak = 0;
  for (let i = 0; i < 8; i++) {
    const day = NOW + i * DAY;
    const c = dailyChallenge(localDayKey(day));
    const r = finishRun(s, c.game, 10, 'g0', day, seededRandom(i + 1), { daily: true });
    streak++;
    assert.equal(r.daily.streak, streak);
    assert.equal(r.daily.bonus, DAILY_SOULS + DAILY_STREAK_SOULS * Math.min(streak - 1, DAILY_STREAK_CAP));
  }
  const skip = NOW + 10 * DAY, c = dailyChallenge(localDayKey(skip));
  assert.equal(finishRun(s, c.game, 10, 'g0', skip, seededRandom(99), { daily: true }).daily.streak, 1);
  assert.equal(challengeToday(s, skip).streak, 1);
  assert.equal(challengeToday(s, skip + 3 * DAY).streak, 0, 'a lapsed streak reads as zero');
});

test('the challenge record survives reload and hostile data', () => {
  const s = household();
  const c = dailyChallenge(localDayKey(NOW));
  finishRun(s, c.game, 12, 'g0', NOW, seededRandom(1), { daily: true });
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.arcade.daily.best, 12); assert.equal(back.arcade.daily.claimed, true); assert.equal(back.arcade.dailyStreak, 1);
  const bad = normalizeArcade({ daily: { day: 'x', game: 'frenzy' }, dailyStreak: -3, dailyLastDay: 'later' });
  assert.equal(bad.daily, null); assert.equal(bad.dailyStreak, 0); assert.equal(bad.dailyLastDay, '');
  assert.equal(normalizeArcade({ daily: { day: '2026-8-25', game: 'nope' } }).daily, null);
  assert.equal(normalizeArcade({ daily: { day: '2026-8-25', game: 'whack', best: 1e12, plays: -5 } }).daily.best, 1e6);
});
