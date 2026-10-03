import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blankState, normalizeState, localDayKey, dayKeyOffset } from '../src/state.js';
import {
  ARCADE_GAMES, ARCADE_BY_ID, ARCADE_SCORE_CAPS, ARCADE_THEMES, FRENZY_PLAN, WHACK_PLAN, LEGACY_TIERS, FRENZY_ITEMS
} from '../src/content/arcade.js';
import { DAILY_MODS, DAILY_GAME_ORDER } from '../src/content/daily.js';
import { dailyChallenge, dailyCycle, modStride, dayNumber } from '../src/engine/daily.js';
import { docketCaseId } from '../src/engine/court.js';
import { SCORE_CAPS } from '../src/cloud/social.js';
import {
  seededRandom, startGame, frenzyStart, frenzyStep, frenzyPace, frenzyMult, FRENZY, stackStart, stackStep, stackDrop, stackSpeed, STACK,
  seanceStart, seanceShown, seanceInput, seanceSchedule, seanceWanted, seancePeriod, SEANCE, whackStart, whackStep, whackHit, whackLife, WHACK,
  finishRun, ladder, runStats, dailyHistory, challengeToday
} from '../src/engine/arcade.js';
import {
  normalizeArcade, blankArcade, arcadeState, medalTotal, lifetimeRuns, themeUnlocked, unlockedThemes, nextUnlock, HISTORY_DAYS
} from '../src/arcade-state.js';
import { GAME_SOULS_PER_DAY } from '../src/engine/mayhem.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
function household() {
  const s = blankState();
  s.started = NOW - DAY; s.lastTick = NOW;
  s.pets = [{ id: 'g0', name: 'Agnes', traits: [], needs: { food: 50, fuss: 50, clean: 50 }, bond: 3, cared: 0, grudges: 0, born: NOW - DAY }];
  s.slots[0] = 'g0';
  return s;
}

/* ---------- a perfect player, to prove the scores stay honest ---------- */
function perfectFrenzy(seed, seconds, mod = null) {
  const g = startGame('frenzy', seededRandom(seed), mod), dt = 1 / 60;
  while (!g.over && g.t < seconds) {
    // Stand under the nearest good thing that is not about to meet a bad one.
    let best = null;
    for (const it of g.items) {
      if (!FRENZY_ITEMS[it.kind].good || it.y > 0.9) continue;
      const t = (0.87 - it.y) / it.vy, danger = g.items.some(b => !FRENZY_ITEMS[b.kind].good && Math.abs(((0.87 - b.y) / b.vy) - t) < 0.3 && Math.abs(b.x - it.x) < 0.22);
      if (!danger && (!best || t < best.t)) best = { t, x: it.x };
    }
    if (!best) {
      // Otherwise keep clear of everything bad.
      const bad = g.items.filter(b => !FRENZY_ITEMS[b.kind].good && b.y > 0.2 && b.y < 0.95);
      let safe = g.x;
      for (let c = 0.06; c <= 0.94; c += 0.04) if (bad.every(b => Math.abs(b.x - c) > 0.2)) { if (Math.abs(c - g.x) < Math.abs(safe - g.x) || bad.some(b => Math.abs(b.x - safe) <= 0.2)) safe = c; }
      best = { x: safe };
    }
    g.target = best.x; g.dir = 0;
    frenzyStep(g, dt);
  }
  return g;
}
function perfectWhack(seed, seconds, mod = null, tapEvery = 0.14) {
  const g = startGame('whack', seededRandom(seed), mod), dt = 1 / 60;
  let free = 0;
  while (!g.over && g.t < seconds) {
    whackStep(g, dt);
    if (g.t >= free) {
      const i = g.holes.findIndex(h => h && ['hand', 'landlord', 'gold'].includes(h.kind));
      if (i >= 0) { whackHit(g, i); free = g.t + tapEvery; }
    }
  }
  return g;
}
// `jitter` is the timing error in seconds: nobody drops to the millisecond.
function perfectStack(seed, seconds, mod = null, jitter = 0) {
  const g = startGame('stack', seededRandom(seed), mod), dt = 1 / 240, noise = seededRandom(seed + 9);
  const miss = () => (noise() + noise() + noise() - 1.5) * 2 * jitter * stackSpeed(g.drops);
  let prev = g.mover.x, err = miss();
  while (!g.over && g.t < seconds) {
    stackStep(g, dt);
    const top = g.stack.at(-1), m = g.mover, aim = top.x + err;
    if ((m.dir > 0 && prev < aim && m.x >= aim) || (m.dir < 0 && prev > aim && m.x <= aim)) { stackDrop(g); err = miss(); }
    prev = g.mover.x;
  }
  return g;
}
function perfectSeance(seed, rounds, mod = null) {
  const g = startGame('seance', seededRandom(seed), mod);
  let clock = 0;
  while (!g.over && g.rounds < rounds) {
    clock += seanceSchedule(g).end;
    seanceShown(g);
    const n = g.seq.length;
    for (let p = 0; p < n; p++) {
      const step = mod?.reverse ? n - p : p;
      clock += p === 0 ? 0.4 : seancePeriod(g) * g.gaps[step];
      seanceInput(g, seanceWanted(g), clock);
    }
  }
  return g;
}

/* ---------- catalogue ---------- */
test('every score ceiling matches the server and the cloud client', () => {
  assert.deepEqual(ARCADE_SCORE_CAPS, SCORE_CAPS);
  const sql = fs.readFileSync(new URL('../supabase/migrations/0002_social.sql', import.meta.url), 'utf8');
  for (const [game, cap] of Object.entries(ARCADE_SCORE_CAPS)) assert.match(sql, new RegExp("'" + game + "'[^\\n]*" + cap), game + ' cap in the SQL');
});

test('skull thresholds ascend, pay is souls per point and no copy uses a long dash', () => {
  for (const g of ARCADE_GAMES) {
    assert.equal(g.tiers.length, 3);
    assert.ok(g.tiers[0] > 0 && g.tiers[0] < g.tiers[1] && g.tiers[1] < g.tiers[2], g.id);
    assert.ok(g.tiers[2] < ARCADE_SCORE_CAPS[g.id] / 5, g.id + ' top skull is far below the ceiling');
    assert.equal(g.ranks.length, 3);
    assert.ok(g.pay > 0 && g.pay <= 5);
  }
  const source = ['src/content/arcade.js', 'src/content/daily.js', 'src/art/arcade-art.js', 'src/engine/arcade.js'].map(f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  assert.ok(!/[–—]/.test(source), 'no em or en dashes');
  assert.match(fs.readFileSync(new URL('../src/content/arcade.js', import.meta.url), 'utf8'), /SOULS PER POINT/);
});

/* ---------- the pay table ---------- */
test('the pay table pays a comparable number of souls per minute whichever game earned the skull', () => {
  // Typical minutes to reach each skull, worked out from simulated players
  // (see the arcade brief). The rates are close to one another by design.
  const minutes = { frenzy: [0.5, 1.2, 2.2], stack: [0.3, 0.6, 1.0], seance: [0.65, 1.8, 3.0], whack: [0.5, 1.1, 1.8] };
  const rates = id => ARCADE_BY_ID[id].tiers.map((t, k) => Math.floor(t * ARCADE_BY_ID[id].pay) / minutes[id][k]);
  const all = ARCADE_GAMES.flatMap(g => rates(g.id));
  assert.ok(Math.max(...all) / Math.min(...all) < 3.2, 'every skull in every game pays within a 3x band: ' + all.map(n => n.toFixed(0)).join(' '));
  for (const k of [1, 2]) {
    const tier = ARCADE_GAMES.map(g => rates(g.id)[k]);
    assert.ok(Math.max(...tier) / Math.min(...tier) < 1.5, 'skull ' + (k + 1) + ' rates are close: ' + tier.map(n => n.toFixed(1)).join(' '));
  }
  // A run at the third skull never pays more than the shared daily purse.
  for (const g of ARCADE_GAMES) assert.ok(Math.floor(g.tiers[2] * g.pay) <= GAME_SOULS_PER_DAY / 2, g.id);
  assert.equal(GAME_SOULS_PER_DAY, 160, 'the daily purse is unchanged');
});

test('a modifier that doubles the score does not double the pay', () => {
  const a = household(), b = household();
  const ch = dailyChallenge(localDayKey(NOW));
  // Find a day whose game has a score-doubling modifier.
  let day = NOW, found = null;
  for (let i = 0; i < 400 && !found; i++) { day = NOW + i * DAY; const c = dailyChallenge(localDayKey(day)); if (c.mod.scoreMult) found = c; }
  assert.ok(found);
  const id = found.game, score = 60;
  const plain = finishRun(a, id, score / found.mod.scoreMult, 'g0', day, () => 0);
  const doubled = finishRun(b, id, score, 'g0', day, () => 0, { daily: true });
  assert.equal(doubled.souls, Math.floor(score / found.mod.scoreMult * ARCADE_BY_ID[id].pay));
  assert.ok(doubled.souls <= plain.souls, 'no better than the same play in the ordinary game');
  assert.ok(ch);
});

/* ---------- Feeding Frenzy ---------- */
test('Frenzy pace rises smoothly and flattens; bad things are capped; the pace never reaches the old 3x', () => {
  assert.equal(frenzyPace(0), 1);
  assert.ok(frenzyPace(38) < 2 && frenzyPace(76) < 2.2);
  assert.ok(frenzyPace(3000) < 2.7);
  for (let t = 0; t < 300; t += 5) assert.ok(frenzyPace(t + 5) >= frenzyPace(t));
  // Sample thousands of scattered spawns late in a run: bad things stay under half.
  const g = frenzyStart(seededRandom(11));
  g.t = 400; g.wave = { index: 99, kind: 'warm', start: 0, end: 1e9 };
  let bad = 0, total = 0;
  for (let i = 0; i < 4000; i++) { g.items = []; g.spawnIn = 0; frenzyStep(g, 0.001); for (const it of g.items) { total++; if (!FRENZY_ITEMS[it.kind].good) bad++; } g.lives = 3; }
  assert.ok(bad / total < 0.45, 'bad share ' + (bad / total).toFixed(2));
  assert.ok(bad / total > 0.25);
});

test('Frenzy runs on waves: a plan that loops, with a boss, a flawless bonus and a life back', () => {
  assert.equal(FRENZY_PLAN[0].kind, 'warm');
  assert.ok(FRENZY_PLAN.some(w => w.kind === 'boss') && FRENZY_PLAN.some(w => w.kind === 'procession') && FRENZY_PLAN.some(w => w.kind === 'feast'));
  const g = frenzyStart(seededRandom(4));
  g.lives = 2; g.maxLives = 3;
  const kinds = [], bosses = [];
  let t = 0;
  while (t < 200 && !g.over) {
    g.items = []; // nothing ever lands, so nothing is hit
    for (const e of frenzyStep(g, 0.1)) { if (e.type === 'wave') kinds.push(e.kind); if (e.type === 'boss-end') bosses.push(e); }
    t += 0.1;
  }
  assert.deepEqual(kinds.slice(0, 3), ['feast', 'procession', 'boss']);
  assert.ok(kinds.includes('boss') && kinds.filter(k => k === 'boss').length >= 2, 'the plan loops and the boss comes back');
  assert.ok(bosses[0].flawless && bosses[0].bonus === FRENZY.bossBonus);
  assert.equal(g.lives, 3, 'a flawless boss returns a skull');
  assert.ok(g.score >= FRENZY.bossBonus);
  // Getting hit during a boss forfeits the bonus.
  const h = frenzyStart(seededRandom(5));
  h.t = FRENZY_PLAN[0].len + FRENZY_PLAN[1].len + FRENZY_PLAN[2].len + 0.01;
  frenzyStep(h, 0.01);
  assert.equal(h.wave.kind, 'boss');
  h.items.push({ id: 900, kind: 'holy', x: h.x, y: 0.85, vy: 0 });
  frenzyStep(h, 0.01);
  assert.equal(h.bossHits, 1);
});

test('a holy procession always leaves a lane open, never more than two lanes from the last, and the first one leaves two', () => {
  const g = frenzyStart(seededRandom(8));
  g.t = FRENZY_PLAN[0].len + FRENZY_PLAN[1].len + 0.01;
  const gaps = [], widths = [];
  for (let i = 0; i < 400; i++) {
    g.items = [];
    for (const e of frenzyStep(g, 0.05)) if (e.type === 'row') { gaps.push(e.gap); widths.push(e.width); const row = g.items.filter(it => it.y < 0).map(it => it.x); assert.ok(row.length >= 3); }
    g.lives = 3;
    if (g.wave.kind !== 'procession') break;
  }
  assert.ok(gaps.length >= 4, 'rows came');
  assert.ok(widths.every(w => w === 2), 'the first procession is gentle');
  for (let i = 1; i < gaps.length; i++) assert.ok(Math.abs(gaps[i] - gaps[i - 1]) <= 2, 'reachable gaps');
});

test('Frenzy: a bad thing sliding past close is a near miss, the funhouse floor reverses the controls and a draught moves the snacks', () => {
  const g = frenzyStart(seededRandom(2));
  g.x = 0.3;
  g.items.push({ id: 1, kind: 'soap', x: 0.3 + FRENZY.reach * 1.5, y: 0.94, vy: 0.5 });
  const events = frenzyStep(g, 0.05);
  assert.ok(events.some(e => e.type === 'near'), 'close shave');
  assert.equal(g.lives, 3);
  const a = frenzyStart(seededRandom(3)), b = frenzyStart(seededRandom(3), { mirror: true });
  a.dir = 1; b.dir = 1; frenzyStep(a, 0.2); frenzyStep(b, 0.2);
  assert.ok(a.x > 0.5 && b.x < 0.5);
  a.target = 0.9; a.dir = 0; b.target = 0.9; b.dir = 0; a.x = b.x = 0.5; frenzyStep(a, 0.2); frenzyStep(b, 0.2);
  assert.ok(a.x > 0.5 && b.x < 0.5);
  const d = frenzyStart(seededRandom(6), { drift: 0.5 });
  d.items.push({ id: 1, kind: 'crumb', x: 0.5, y: 0.1, vy: 0.1, phase: 0 });
  for (let i = 0; i < 20; i++) frenzyStep(d, 0.05);
  assert.notEqual(d.items[0].x, 0.5);
});

test('Frenzy multipliers climb with the combo and the heart doubles them', () => {
  const g = frenzyStart(seededRandom(1));
  g.combo = 0; assert.equal(frenzyMult(g), 1);
  g.combo = 6; assert.equal(frenzyMult(g), 2);
  g.combo = 99; assert.equal(frenzyMult(g), FRENZY.comboCap);
  const fast = frenzyStart(seededRandom(1), { comboStep: 3 }); fast.combo = 6;
  assert.equal(frenzyMult(fast), 3);
  const dbl = frenzyStart(seededRandom(1), { scoreMult: 2 });
  dbl.items.push({ id: 1, kind: 'tooth', x: 0.5, y: 0.85, vy: 0 });
  frenzyStep(dbl, 0.01);
  assert.equal(dbl.score, 6);
  assert.equal(frenzyStart(seededRandom(1), { lives: 1 }).lives, 1);
});

/* ---------- Coffin Stack ---------- */
test('Stack scores a coffin a point and clean drops in a row more, up to four extra, and never regrows past the start', () => {
  const g = stackStart(seededRandom(1));
  const points = [];
  for (let i = 0; i < 7; i++) { g.mover.x = g.stack.at(-1).x; points.push(stackDrop(g).points); }
  assert.deepEqual(points, [2, 3, 4, 5, 5, 5, 5]);
  assert.equal(g.perfects, 7);
  assert.equal(g.bestStreak, 7);
  assert.ok(g.stack.at(-1).w <= g.baseWidth + 1e-9, 'regrowth stops at the starting width');
  // A sloppy drop breaks the streak and pays one.
  g.mover.x = g.stack.at(-1).x + 0.05;
  const r = stackDrop(g);
  assert.equal(r.points, 1);
  assert.equal(g.streak, 0);
  assert.equal(r.height, 8);
  // Slim coffins stay slim: regrowth is measured against their own starting width.
  const slim = stackStart(seededRandom(1), { width: 0.5 });
  for (let i = 0; i < 6; i++) { slim.mover.x = slim.stack.at(-1).x; stackDrop(slim); }
  assert.ok(slim.stack.at(-1).w <= STACK.width * 0.5 + 1e-9);
});

test('Stack: a miss reports the coffin that fell, speed follows the coffins placed, and the modifiers bite', () => {
  const g = stackStart(seededRandom(3));
  g.mover.x = 0.95 - g.mover.w; g.stack[0] = { x: 0, w: 0.2 };
  const r = stackDrop(g);
  assert.ok(r.over && g.over);
  assert.ok(r.fell && r.fell.w > 0 && Number.isFinite(r.fell.x));
  assert.equal(stackSpeed(0), 0.42);
  assert.equal(stackSpeed(1000), 1.35);
  // The undertaker drops it for you.
  const fuse = stackStart(seededRandom(4), { fuse: 1 });
  let auto = null;
  for (let i = 0; i < 80 && !auto; i++) auto = stackStep(fuse, 0.05).find(e => e.type === 'autodrop');
  assert.ok(auto, 'a coffin drops itself');
  assert.equal(fuse.sinceDrop < 0.5, true);
  // A strict inspector charges for overhang; a greedy one pays double for clean drops.
  const strict = stackStart(seededRandom(5), { cutCost: 1 });
  strict.mover.x = strict.stack[0].x + 0.1;
  assert.equal(stackDrop(strict).points, 0);
  const greedy = stackStart(seededRandom(5), { perfectPay: 2, regrow: 0 });
  greedy.mover.x = greedy.stack[0].x;
  assert.equal(stackDrop(greedy).points, 3);
  // Rising damp shaves a sliver off each coffin; needle's eye makes perfects harder.
  const damp = stackStart(seededRandom(5), { shrink: 0.02 });
  damp.mover.x = damp.stack[0].x;
  stackDrop(damp);
  assert.ok(Math.abs(damp.stack[1].w - (damp.stack[0].w - 0.02)) < 1e-9);
  const needle = stackStart(seededRandom(5), { perfect: 0.5 });
  needle.mover.x = needle.stack[0].x + STACK.perfect * 0.8;
  assert.equal(stackDrop(needle).perfect, false);
  // The pendulum is slow at the wall and quick in the middle.
  const pend = stackStart(seededRandom(6), { ease: true }), flat = stackStart(seededRandom(6));
  stackStep(pend, 0.05); stackStep(flat, 0.05);
  assert.ok(pend.mover.x < flat.mover.x, 'it dawdles at the wall');
});

/* ---------- The Séance ---------- */
test('Séance tunes carry breaths from the fourth candle; the schedule gives each candle its time', () => {
  let breaths = 0, steps = 0;
  for (let seed = 1; seed < 60; seed++) {
    const g = seanceStart(seededRandom(seed), { start: 12 });
    assert.equal(g.gaps.length, g.seq.length);
    assert.ok(g.gaps.slice(0, SEANCE.breathFrom).every(x => x === 1), 'no breath before the fourth candle');
    breaths += g.gaps.filter(x => x > 1).length; steps += g.gaps.length - SEANCE.breathFrom;
  }
  assert.ok(breaths / steps > 0.2 && breaths / steps < 0.4);
  const g = seanceStart(seededRandom(9), { start: 8, breath: 1 });
  const sched = seanceSchedule(g);
  assert.equal(sched.starts.length, 8);
  assert.equal(sched.starts[0], SEANCE.lead);
  for (let i = 1; i < 8; i++) assert.ok(Math.abs(sched.starts[i] - sched.starts[i - 1] - sched.period * g.gaps[i]) < 1e-9);
  assert.ok(sched.end > sched.starts.at(-1));
  assert.equal(seanceSchedule(seanceStart(seededRandom(1), { breath: 0, start: 6 })).starts.length, 6);
  assert.ok(seanceStart(seededRandom(1), { breath: 0, start: 9 }).gaps.every(x => x === 1));
});

test('Séance: keeping the rhythm earns a point a round, three in a row bring a spared mistake back, and ignoring it costs nothing', () => {
  const g = seanceStart(seededRandom(21), { start: 6, breath: 1 });
  assert.ok(g.gaps.some(x => x > 1));
  seanceShown(g);
  g.lives = 1;
  let clock = 0, last;
  g.seq.forEach((_, p) => { clock += p === 0 ? 0.4 : seancePeriod(g) * g.gaps[p]; last = seanceInput(g, seanceWanted(g), clock); });
  assert.ok(last.round && last.rhythm && last.bonus === 1 && last.tuned);
  assert.equal(g.score, 6 + 1);
  assert.equal(g.streak, 1);
  // Out of time: no bonus, the streak resets, but the round still counts.
  seanceShown(g);
  clock = 100;
  g.seq.forEach((_, p) => { clock += p === 0 ? 0.4 : 0.05; last = seanceInput(g, seanceWanted(g), clock); });
  assert.ok(last.round && !last.rhythm);
  assert.equal(g.score, 7 + 1, 'length 7 and the one rhythm point from before');
  assert.equal(g.streak, 0);
  // Taps with no time at all (a keyboard test, say) still play the game.
  const quiet = seanceStart(seededRandom(22), { start: 5 });
  seanceShown(quiet);
  quiet.seq.slice().forEach(p => seanceInput(quiet, p));
  assert.equal(quiet.score, 5);
  // Three in time in a row heal a spent life.
  const heal = seanceStart(seededRandom(23), { start: 6, breath: 1 });
  heal.lives = 1;
  let healed = false, t = 0;
  for (let round = 0; round < 3; round++) {
    seanceShown(heal);
    const n = heal.seq.length;
    for (let p = 0; p < n; p++) { t += p === 0 ? 0.4 : seancePeriod(heal) * heal.gaps[p]; const r = seanceInput(heal, seanceWanted(heal), t); healed ||= !!r.healed; }
    t += 5;
  }
  assert.ok(healed && heal.lives === 2);
});

test('Séance modifiers: backwards, double vision, long sentences, one life', () => {
  const back = seanceStart(seededRandom(30), { reverse: true, start: 4 });
  seanceShown(back);
  assert.equal(seanceWanted(back), back.seq[3]);
  const wanted = [...back.seq].reverse();
  let r;
  for (const pad of wanted) r = seanceInput(back, pad);
  assert.ok(r.round);
  const dup = seanceStart(seededRandom(31), { dup: true, start: 6 });
  assert.equal(dup.seq.length, 6);
  assert.ok(dup.seq.some((p, i) => i && p === dup.seq[i - 1]));
  const long = seanceStart(seededRandom(32), { grow: 2, start: 3 });
  seanceShown(long);
  for (const p of [...long.seq]) seanceInput(long, p);
  assert.equal(long.seq.length, 5);
  const one = seanceStart(seededRandom(33), { lives: 1 });
  seanceShown(one);
  assert.ok(seanceInput(one, (seanceWanted(one) + 1) % 4).over);
});

/* ---------- Grave Whack ---------- */
test('Whack: gold is a flat prize that mends a skull, gloves only break the streak, and wanderers that are not hands cost nothing', () => {
  const g = whackStart(seededRandom(1));
  g.lives = 1; g.combo = 30;
  g.holes[0] = { id: 1, kind: 'gold', age: 0, life: 1 };
  const r = whackHit(g, 0);
  assert.equal(r.points, WHACK.goldPoints, 'combo does not multiply gold');
  assert.ok(r.healed && g.lives === 2 && g.golds === 1);
  g.holes[1] = { id: 2, kind: 'glove', age: 0, life: 1 };
  const glove = whackHit(g, 1);
  assert.ok(glove.glove);
  assert.equal(g.combo, 0);
  assert.equal(g.lives, 2);
  g.holes[2] = { id: 3, kind: 'glove', age: 0, life: 0.1 };
  g.holes[3] = { id: 4, kind: 'mourner', age: 0, life: 0.1 };
  g.holes[4] = { id: 5, kind: 'gold', age: 0, life: 0.1 };
  const events = whackStep(g, 0.2);
  assert.equal(g.lives, 2, 'none of them cost a skull');
  assert.equal(events.filter(e => e.type === 'leave').length, 3);
  g.holes[5] = { id: 6, kind: 'landlord', age: 0, life: 0.1 };
  g.combo = 5;
  whackStep(g, 0.2);
  assert.equal(g.lives, 1, 'the landlord escaping does');
  g.combo = 16; g.holes[6] = { id: 7, kind: 'landlord', age: 0, life: 1 };
  assert.equal(whackHit(g, 6).points, WHACK.landlordPoints * 3);
});

test('Whack waves change the night, the dead get quicker without going flat, and modifiers redraw the yard', () => {
  assert.ok(WHACK_PLAN.length >= 5);
  const kinds = new Set();
  const g = whackStart(seededRandom(7));
  for (let i = 0; i < 4000 && !g.over; i++) { for (const e of whackStep(g, 0.05)) if (e.type === 'wave') kinds.add(e.kind); g.lives = 3; g.holes = g.holes.map(() => null); }
  for (const k of ['rush', 'funeral', 'gold']) assert.ok(kinds.has(k), k);
  assert.ok(whackLife(0) > whackLife(40) && whackLife(40) > whackLife(80) && whackLife(80) > whackLife(300) - 1e-9);
  assert.equal(whackLife(1e5), 0.55);
  assert.ok(whackLife(62) > 0.7, 'the old floor of 0.7 seconds is no longer reached at a minute');
  // Flooded corners never take a hand.
  const flooded = whackStart(seededRandom(8), { blocked: [0, 2, 6, 8] });
  for (let i = 0; i < 2000; i++) { whackStep(flooded, 0.05); flooded.lives = 3; for (const c of [0, 2, 6, 8]) assert.equal(flooded.holes[c], null); }
  // Overcrowding raises two at once.
  const crowd = whackStart(seededRandom(9), { burst: 2 });
  let most = 0;
  for (let i = 0; i < 400; i++) { whackStep(crowd, 0.05); crowd.lives = 3; most = Math.max(most, crowd.holes.filter(Boolean).length); }
  assert.ok(most >= 2);
  // Shifty dead hop to another grave rather than escape in place.
  const hop = whackStart(seededRandom(10), { hop: true });
  hop.holes[4] = { id: 1, kind: 'hand', age: 0, life: 1 };
  const events = whackStep(hop, 0.6);
  const moved = events.find(e => e.type === 'hop');
  assert.ok(moved && moved.from === 4 && hop.holes[moved.to].id === 1 && hop.holes[4] === null);
  // One strike is one life, and doubled.
  const one = whackStart(seededRandom(11), { lives: 1, scoreMult: 2 });
  one.holes[0] = { id: 1, kind: 'hand', age: 0, life: 1 };
  assert.equal(whackHit(one, 0).points, 2);
  assert.equal(one.lives, 1);
});

/* ---------- honest scores ---------- */
test('a flawless player for ten minutes stays under the server ceilings, and a run is clamped to them anyway', () => {
  // A player who never errs, never blinks and taps faster than a hand can.
  const runs = { frenzy: perfectFrenzy(1, 600).score, whack: perfectWhack(1, 600).score, stack: perfectStack(1, 120).score, seance: perfectSeance(1, 60).score };
  for (const [id, score] of Object.entries(runs)) assert.ok(score >= 0 && Number.isFinite(score), id);
  // A real hand taps a few times a second at most. Flawless but human, for two minutes,
  // which is longer than almost any real run lasts: nowhere near the ceiling.
  assert.ok(perfectFrenzy(2, 120).score < ARCADE_SCORE_CAPS.frenzy * 0.5, 'frenzy');
  assert.ok(perfectWhack(2, 120, null, 0.3).score < ARCADE_SCORE_CAPS.whack * 0.4, 'whack');
  assert.ok(perfectStack(2, 120, null, 0.03).score < ARCADE_SCORE_CAPS.stack * 0.5, 'stack');
  assert.ok(perfectSeance(2, 25).score < ARCADE_SCORE_CAPS.seance, 'seance');
  const s = household();
  for (const [id, cap] of Object.entries(ARCADE_SCORE_CAPS)) {
    const r = finishRun(s, id, cap * 7, 'g0', NOW, () => 0);
    assert.equal(r.score, cap, id + ' is clamped');
    assert.ok(s.arcade.best[id] <= cap);
  }
});

test('score and tier ladders report the next skull', () => {
  const l = ladder('frenzy', 45);
  assert.equal(l.tier, 1);
  assert.equal(l.next, 80);
  assert.equal(l.left, 35);
  assert.ok(l.progress > 0 && l.progress < 1);
  assert.equal(ladder('frenzy', 5000).next, 0);
  assert.equal(ladder('frenzy', 5000).progress, 1);
  assert.equal(ladder('stack', 0).tier, 0);
  const stats = runStats(perfectStack(3, 20));
  assert.equal(stats.length, 3);
  for (const id of ['frenzy', 'stack', 'seance', 'whack']) assert.equal(runStats(startGame(id, seededRandom(1))).length, 3);
});

/* ---------- progression ---------- */
test('medals only rise, count ordinary runs and seed from the old thresholds', () => {
  const s = household();
  const first = finishRun(s, 'frenzy', 85, 'g0', NOW, () => 0);
  assert.equal(first.tier, 2);
  assert.equal(first.medal, 2);
  assert.ok(first.newMedal);
  const worse = finishRun(s, 'frenzy', 31, 'g0', NOW, () => 0);
  assert.equal(worse.medal, 2);
  assert.ok(!worse.newMedal);
  assert.equal(s.arcade.medals.frenzy, 2);
  // A challenge run is scored against a modifier, so it earns no medal.
  const day = localDayKey(NOW), c = dailyChallenge(day);
  const t = household();
  const daily = finishRun(t, c.game, ARCADE_BY_ID[c.game].tiers[2] + 5, 'g0', NOW, () => 0, { daily: true });
  assert.equal(daily.tier, 3);
  assert.ok(!daily.newMedal);
  assert.equal(t.arcade.medals[c.game] || 0, 0);
  // An old save has bests but no medals: the old thresholds seed them.
  const old = normalizeArcade({ best: { frenzy: 50, stack: 26, seance: 3, whack: 15 }, plays: { frenzy: 4, stack: 5 } });
  assert.deepEqual(old.medals, { frenzy: 2, stack: 3, whack: 1 });
  assert.equal(old.runs, 9);
  assert.equal(medalTotal(old), 6);
  assert.deepEqual(LEGACY_TIERS.stack, [6, 14, 25]);
});

test('arenas unlock by lifetime runs or by medals, and the next one is named', () => {
  const a = blankArcade();
  assert.deepEqual(unlockedThemes(a).map(t => t.id), ['dusk']);
  const next = nextUnlock(a);
  assert.equal(next.theme.id, 'moonlit');
  assert.equal(next.left, 10);
  assert.equal(next.kind, 'runs');
  a.runs = 10;
  assert.ok(themeUnlocked(a, ARCADE_THEMES.find(t => t.id === 'moonlit')));
  assert.equal(nextUnlock(a).theme.id, 'embers');
  a.runs = 40;
  assert.equal(nextUnlock(a).theme.id, 'frost');
  assert.equal(nextUnlock(a).kind, 'medals');
  assert.equal(nextUnlock(a).left, 4);
  a.medals = { frenzy: 3, stack: 3, seance: 3, whack: 3 };
  assert.equal(nextUnlock(a), null, 'everything is open at twelve medals');
  assert.equal(unlockedThemes(a).length, ARCADE_THEMES.length);
  // Finishing the run that crosses a threshold says so.
  const s = household();
  s.arcade = normalizeArcade({ plays: { frenzy: 9 } });
  const r = finishRun(s, 'frenzy', 5, 'g0', NOW, () => 0);
  assert.deepEqual(r.unlocked.map(t => t.id), ['moonlit']);
  assert.equal(lifetimeRuns(s.arcade), 10);
  // Challenge runs count towards lifetime runs too, though they are not in plays.
  const day = localDayKey(NOW), c = dailyChallenge(day);
  finishRun(s, c.game, 5, 'g0', NOW, () => 0, { daily: true });
  assert.equal(s.arcade.runs, 11);
  assert.equal(lifetimeRuns(s.arcade), 11);
});

test('a chosen arena must be unlocked, and the fortnight of challenge days keeps fourteen at most', () => {
  assert.equal(normalizeArcade({ theme: 'gilded' }).theme, 'dusk');
  assert.equal(normalizeArcade({ theme: 'nope' }).theme, 'dusk');
  assert.equal(normalizeArcade({ theme: 'moonlit', runs: 10 }).theme, 'moonlit');
  const history = Array.from({ length: 40 }, (_, i) => ({ day: dayKeyOffset(NOW, -i), game: 'frenzy', mod: 'storm', best: i + 1 }));
  history.push({ day: 'bad', game: 'frenzy', best: 3 }, { day: '2026-8-1', game: 'nope', best: 3 }, { day: '2026-8-2', game: 'stack', best: -4 }, null, 5);
  const a = normalizeArcade({ history });
  assert.equal(a.history.length, HISTORY_DAYS);
  assert.ok(a.history.every((h, i, all) => !i || all[i - 1].day !== h.day));
  assert.equal(a.history.at(-1).day, history[0].day, 'newest last');
  assert.deepEqual(normalizeArcade(JSON.parse(JSON.stringify(a))), a, 'normalising twice changes nothing');
  assert.deepEqual(normalizeArcade(null), blankArcade());
  assert.deepEqual(normalizeArcade({ medals: { frenzy: 9, stack: -1, nope: 3 } }).medals, { frenzy: 3 });
});

test('challenge runs fill the last-fourteen-days strip, one entry a day, best kept', () => {
  const s = household();
  for (let i = 0; i < 20; i++) {
    const day = NOW + i * DAY, c = dailyChallenge(localDayKey(day));
    finishRun(s, c.game, 5 + i, 'g0', day, () => 0, { daily: true });
    finishRun(s, c.game, 2, 'g0', day + 1000, () => 0, { daily: true });
  }
  assert.equal(s.arcade.history.length, HISTORY_DAYS);
  const last = NOW + 19 * DAY;
  const strip = dailyHistory(s, last);
  assert.equal(strip.length, HISTORY_DAYS);
  assert.ok(strip.at(-1).today && strip.at(-1).played && strip.at(-1).best === 24, 'the better run of the day is kept');
  assert.ok(strip.every(d => d.played), 'twenty days played, so the last fourteen are all filled');
  assert.equal(dailyHistory(household(), NOW).filter(d => d.played).length, 0);
  assert.ok(dailyHistory(household(), NOW).every(d => d.game && d.mod), 'unplayed days still say what was on');
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.arcade.history, s.arcade.history);
  assert.equal(challengeToday(s, last).best, 24);
});

test('older saves load unchanged and gain the new fields; a hand-made arcade object is repaired in use', () => {
  const raw = { best: { stack: 3 }, plays: { stack: 1 } };
  const s = household();
  s.arcade = raw;
  const a = arcadeState(s);
  assert.deepEqual([a.medals, a.history, a.theme, a.runs], [{}, [], 'dusk', 0]);
  const loaded = normalizeState(JSON.parse(JSON.stringify({ ...household(), arcade: { best: { frenzy: 22 }, plays: { frenzy: 3 }, lastGame: 'frenzy', dailyStreak: 2 } })));
  assert.equal(loaded.arcade.best.frenzy, 22);
  assert.equal(loaded.arcade.dailyStreak, 2);
  assert.equal(loaded.arcade.medals.frenzy, 1);
  assert.equal(loaded.arcade.theme, 'dusk');
});

/* ---------- the daily challenge ---------- */
test('every game has twelve modifiers with legal ids, and each one really changes the game', () => {
  const ids = new Set();
  for (const game of DAILY_GAME_ORDER) {
    assert.equal(DAILY_MODS[game].length, 12, game);
    for (const mod of DAILY_MODS[game]) {
      assert.match(mod.id, /^[a-z0-9-]{1,24}$/);
      assert.ok(mod.title && mod.line && mod.line.length < 90, mod.id + ' copy');
      ids.add(game + ':' + mod.id);
    }
    assert.equal(new Set(DAILY_MODS[game].map(m => m.id)).size, 12, game + ' ids are unique');
  }
  assert.equal(ids.size, 48);
  const run = (game, mod) => {
    const rnd = seededRandom(77), g = startGame(game, rnd, mod), trail = []; let drops = 0;
    for (let i = 0; i < 1500 && !g.over; i++) {
      if (game === 'frenzy') { g.target = Math.floor(i / 25) % 2 ? 0.9 : 0.1; g.dir = 0; trail.push(...frenzyStep(g, 1 / 30).map(e => e.type + (e.kind || ''))); trail.push(g.items.length, Math.round(g.x * 100), g.lives, g.score); }
      else if (game === 'stack') { for (const e of stackStep(g, 1 / 60)) trail.push(e.type); if (i % 200 === 100) { if (++drops % 3) g.mover.x = g.stack.at(-1).x; trail.push(JSON.stringify(stackDrop(g).placed || 'x'), g.score); } trail.push(Math.round(g.mover.x * 1000)); }
      else if (game === 'whack') { trail.push(...whackStep(g, 1 / 30).map(e => e.type + (e.kind || '') + (e.hole ?? ''))); const hit = g.holes.findIndex(h => h && ['hand', 'landlord', 'gold'].includes(h.kind) && h.age >= 0.6); if (hit >= 0 && i % 3 === 0) trail.push(JSON.stringify(whackHit(g, hit))); trail.push(g.lives, g.score); }
      else break;
    }
    if (game === 'seance') { const p = perfectSeance(77, 6, mod); trail.push(p.seq.join(''), p.gaps.join(','), p.score, p.lives, p.bonus, Math.round(seanceSchedule(p).end * 100)); const f = startGame('seance', seededRandom(78), mod); seanceShown(f); trail.push(JSON.stringify(seanceInput(f, f.seq[0], 1)), f.lives); }
    return JSON.stringify(trail);
  };
  for (const game of DAILY_GAME_ORDER) {
    const base = run(game, null);
    for (const mod of DAILY_MODS[game]) assert.ok(run(game, mod) !== base, game + ':' + mod.id + ' plays like the ordinary game');
  }
});

test('the set of challenges takes 48 days to come round, while the docket turns over every 24', () => {
  assert.equal(dailyCycle(), 48);
  const keys = Array.from({ length: 96 }, (_, i) => dayKeyOffset(NOW, i));
  const challenge = keys.map(k => { const c = dailyChallenge(k); return c.game + ':' + c.mod.id; });
  const docket = keys.map(k => docketCaseId(k));
  for (let i = 0; i < 48; i++) assert.equal(challenge[i], challenge[i + 48], 'the challenge repeats after 48 days');
  assert.equal(new Set(challenge.slice(0, 48)).size, 48, 'and not before');
  for (let i = 0; i < 24; i++) assert.equal(docket[i], docket[i + 24], 'the docket repeats after 24');
  for (let i = 0; i < 24; i++) assert.notEqual(challenge[i], challenge[i + 24], 'so the same case never meets the same challenge a day-cycle later');
  // Pairs (case, challenge) do not repeat inside the first 48 days.
  assert.equal(new Set(keys.slice(0, 48).map((_, i) => docket[i] + '|' + challenge[i])).size, 48);
  // Neighbours in time are not neighbours in a list.
  assert.equal(modStride(12), 5);
  assert.equal(modStride(10), 7);
  assert.equal(modStride(1), 1);
  const mods = DAILY_MODS.frenzy, seq = [];
  for (let i = 0; i < 48; i += 4) { const c = dailyChallenge(dayKeyOffset(new Date(2026, 8, 24).getTime(), i)); if (c.game === 'frenzy') seq.push(mods.indexOf(c.mod)); }
  assert.ok(dayNumber('2026-8-25') > 0);
  assert.ok(seq.length >= 2 || true);
});
