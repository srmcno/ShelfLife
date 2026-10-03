import {
  ARCADE_BY_ID, ARCADE_QUIPS, NEW_BEST_LINES, FRENZY_ITEMS, FRENZY_PLAN, WHACK_PLAN, ARCADE_SCORE_CAPS, ARCADE_THEMES
} from '../content/arcade.js';
import { grantBonusTrust, localDayKey, dayKeyOffset, clamp, petById } from '../state.js';
import { payGameSouls, addSouls, deed } from './mayhem.js';
import { dailyChallenge } from './daily.js';
import { DAILY_SOULS, DAILY_STREAK_SOULS, DAILY_STREAK_CAP } from '../content/daily.js';
import { recordGameLife } from './life.js';
import { recordEscapadeEvent } from '../escapade-state.js';
import { arcadeState, HISTORY_DAYS, themeUnlocked, lifetimeRuns } from '../arcade-state.js';
import { canBridge, spendFreeze, earnFreeze } from './streaks.js';
export { normalizeArcade, blankArcade } from '../arcade-state.js';

/* ================= ARCADE SIMULATIONS =================
   Four small games, each a plain object stepped by the UI. Nothing here
   touches the page, so every rule is testable with a fixed random seed.
   Positions are fractions of the playfield: x 0..1 left to right, y 0..1
   top to bottom. Time is in seconds. Every step returns a list of events for
   the screen to react to (sounds, particles, banners); the rules never wait
   on them.

   Each game is endless and gets harder in waves. Daily modifiers
   (content/daily.js) are plain objects of multipliers that the rules read
   with a default, so a missing key always means "the normal game". */

// Feeding Frenzy keyboard control: left or right, or null for any other key.
export function frenzyDirection(key) {
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return -1;
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 1;
  return null;
}

export function seededRandom(seed = 1) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const weighted = (entries, rnd) => {
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let r = rnd() * total;
  for (const [key, w] of entries) { r -= w; if (r <= 0) return key; }
  return entries[entries.length - 1][0];
};
// The plan plays once and then loops from its second entry, harder each time round.
function planAt(plan, index) { return index < plan.length ? plan[index] : plan[1 + ((index - 1) % (plan.length - 1))]; }
function planStarts(plan, index) { let at = 0; for (let i = 0; i < index; i++) at += planAt(plan, i).len; return at; }

/* ---------- Feeding Frenzy: catch the good, dodge the bad ---------- */
export const FRENZY = {
  lives: 3, catchY: [0.8, 0.95], reach: 0.1, speed: 1.7, frenzyFor: 6, comboStep: 6, comboCap: 5,
  badCap: 1.7, lanes: 5, bossLanes: 6, bossBonus: 25
};
// What each kind of wave changes. `formation` waves throw rows of holy water
// with one gap in them instead of scattering things at random.
const FRENZY_WAVE = {
  warm: { good: 1, bad: 1, gap: 1 },
  feast: { good: 1.8, bad: 0.45, gap: 0.8, heart: 2.2 },
  draught: { good: 1, bad: 0.85, gap: 0.7, gust: 0.16 },
  procession: { formation: true, every: 2.1, feed: 1.7 },
  boss: { formation: true, every: 1.55, feed: 2.2, boss: true }
};
export function frenzyStart(rnd = Math.random, mod = null) {
  const lives = Math.max(1, Math.floor(mod?.lives ?? FRENZY.lives));
  const g = { id: 'frenzy', rnd, mod, t: 0, x: 0.5, dir: 0, target: null, lives, maxLives: lives, score: 0, combo: 0, bestCombo: 0,
    items: [], spawnIn: 0.6, formIn: 0, serial: 0, frenzyUntil: 0, over: false,
    wave: null, waveIndex: -1, bosses: 0, bossHits: 0, flawless: 0, hits: 0, catches: 0, near: 0, gust: 0 };
  frenzyWave(g, 0, null);
  return g;
}
export function frenzyPace(t, mod = null) { return (1 + 1.6 * (1 - Math.exp(-t / 70))) * (mod?.pace ?? 1); }
// The multiplier on the current combo, before the heart doubles it.
export function frenzyMult(g) { return Math.min(FRENZY.comboCap, 1 + Math.floor(g.combo / (g.mod?.comboStep ?? FRENZY.comboStep))); }

function frenzyWave(g, index, events) {
  const entry = planAt(FRENZY_PLAN, index), start = planStarts(FRENZY_PLAN, index);
  g.waveIndex = index;
  g.wave = { index, kind: entry.kind, start, end: start + entry.len };
  g.formIn = 0.9; g.bossHits = 0;
  g.gust = FRENZY_WAVE[entry.kind].gust ? (g.rnd() < 0.5 ? -1 : 1) * FRENZY_WAVE[entry.kind].gust : 0;
  if (entry.kind === 'boss') g.bosses += 1;
  if (events && index > 0) events.push({ type: 'wave', index, kind: entry.kind, boss: entry.kind === 'boss' });
}
function laneXs(n) { return Array.from({ length: n }, (_, i) => 0.1 + i * (0.8 / (n - 1))); }

function frenzyDrop(g, kind, x, y = -0.05) {
  const pace = frenzyPace(g.t, g.mod) + Math.min(0.35, g.bosses * 0.07);
  g.items.push({ id: ++g.serial, kind, x, y, vy: (0.3 + g.rnd() * 0.12) * pace * (g.mod?.fall ?? 1), vx: g.gust * (0.6 + g.rnd() * 0.8), spin: g.rnd() * 360, phase: g.rnd() * 6.28 });
}
function frenzyScatter(g, rule) {
  const bad = Math.min(FRENZY.badCap, 1 + g.t / 70) * (rule.bad ?? 1) * (g.mod?.bad ?? 1);
  const entries = Object.entries(FRENZY_ITEMS).map(([k, v]) => {
    const w = (g.mod?.weights?.[k] ?? 1) * (v.good ? (rule.good ?? 1) * (k === 'heart' ? rule.heart ?? 1 : 1) : bad);
    return [k, v.weight * w];
  });
  frenzyDrop(g, weighted(entries, g.rnd), 0.06 + g.rnd() * 0.88);
}
// A row of holy water across the whole field with a lane left open and a
// tooth waiting in it. The first procession leaves two lanes open; after that
// there is one, and Brother Aldous uses six lanes. The next gap is never more
// than two lanes away, so the catcher can always get there in time.
function frenzyRow(g, events) {
  const boss = g.wave.kind === 'boss', n = boss ? FRENZY.bossLanes : FRENZY.lanes, xs = laneXs(n);
  const width = !boss && g.bosses === 0 ? 2 : 1;
  const prev = g.gapLane ?? Math.floor(g.rnd() * (n - width + 1));
  const gap = clamp(prev + Math.floor(g.rnd() * 5) - 2, 0, n - width);
  g.gapLane = gap;
  const bad = ['holy', 'holy', 'soap', 'trap'];
  xs.forEach((x, i) => {
    if (i >= gap && i < gap + width) { frenzyDrop(g, g.rnd() < 0.25 ? 'heart' : 'tooth', x); return; }
    frenzyDrop(g, bad[Math.floor(g.rnd() * bad.length)], x, -0.05 - (i % 2) * 0.05);
  });
  events.push({ type: 'row', gap, width, x: (xs[gap] + xs[gap + width - 1]) / 2, boss });
}

export function frenzyStep(g, dt) {
  if (g.over) return [];
  const events = [];
  g.t += dt;
  while (g.t >= g.wave.end) {
    if (g.wave.kind === 'boss') {
      const flawless = g.bossHits === 0;
      if (flawless) { g.score += FRENZY.bossBonus; g.flawless += 1; if (g.lives < g.maxLives) g.lives += 1; }
      events.push({ type: 'boss-end', flawless, bonus: flawless ? FRENZY.bossBonus : 0 });
    }
    frenzyWave(g, g.wave.index + 1, events);
  }
  const rule = FRENZY_WAVE[g.wave.kind];
  // Movement: a held direction wins; otherwise glide toward a pointer target.
  const speed = FRENZY.speed * (g.mod?.speed ?? 1);
  const flip = g.mod?.mirror ? -1 : 1;
  const dir = g.dir * flip, target = g.target == null ? null : (flip < 0 ? 1 - g.target : g.target);
  if (dir) g.x += dir * speed * dt;
  else if (target != null) { const d = target - g.x; g.x += Math.sign(d) * Math.min(Math.abs(d), speed * 1.4 * dt); }
  g.x = clamp(g.x, 0.06, 0.94);
  if (rule.formation) {
    g.formIn -= dt;
    if (g.formIn <= 0) { g.formIn = rule.every / Math.min(1.5, Math.pow(frenzyPace(g.t, g.mod), 0.5)) * (g.mod?.spawn ?? 1); frenzyRow(g, events); }
    // Between the rows, a little food for the combo.
    g.spawnIn -= dt;
    if (g.spawnIn <= 0) { g.spawnIn = (0.8 / rule.feed) * (0.75 + g.rnd() * 0.5); frenzyDrop(g, weighted([['crumb', 40], ['raisin', 22], ['tooth', 10]], g.rnd), 0.06 + g.rnd() * 0.88); }
  } else {
    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      g.spawnIn = Math.max(0.3, 0.8 - g.t * 0.008) * (0.75 + g.rnd() * 0.5) * (g.mod?.spawn ?? 1) * (rule.gap ?? 1);
      frenzyScatter(g, rule);
    }
  }
  const sway = g.mod?.drift || 0;
  for (const item of g.items) {
    item.y += item.vy * dt;
    if (item.vx) item.x = clamp(item.x + item.vx * dt, 0.04, 0.96);
    if (sway) item.x = clamp(item.x + Math.sin((item.phase || 0) + g.t * 2.2) * sway * dt, 0.04, 0.96);
  }
  const keep = [], reach = FRENZY.reach * (g.mod?.reach ?? 1), mult = g.mod?.scoreMult ?? 1;
  for (const item of g.items) {
    const def = FRENZY_ITEMS[item.kind], dx = Math.abs(item.x - g.x);
    if (item.y >= FRENZY.catchY[0] && item.y <= FRENZY.catchY[1] && dx < reach) {
      if (def.good) {
        g.combo += 1; g.bestCombo = Math.max(g.bestCombo, g.combo); g.catches += 1;
        const m = frenzyMult(g) * (g.t < g.frenzyUntil ? 2 : 1);
        const points = Math.round(def.points * m * mult);
        g.score += points;
        if (def.frenzy) { g.frenzyUntil = g.t + FRENZY.frenzyFor; events.push({ type: 'frenzy' }); }
        events.push({ type: 'catch', kind: item.kind, points, mult: m, combo: g.combo, x: item.x });
      } else {
        g.lives -= 1; g.combo = 0; g.hits += 1;
        if (g.wave.kind === 'boss') g.bossHits += 1;
        events.push({ type: 'hit', kind: item.kind, x: item.x });
      }
      continue;
    }
    // A bad thing that slides past close enough to feel it.
    if (!def.good && !item.passed && item.y > FRENZY.catchY[1]) {
      item.passed = true;
      if (dx < reach * 1.9) { g.near += 1; events.push({ type: 'near', kind: item.kind, x: item.x }); }
    }
    if (item.y > 1.05) { if (def.good && g.combo) { g.combo = 0; events.push({ type: 'miss', kind: item.kind }); } continue; }
    keep.push(item);
  }
  g.items = keep;
  if (g.lives <= 0) { g.over = true; events.push({ type: 'over' }); }
  return events;
}

/* ---------- Coffin Stack: drop on the beat, keep what overlaps ---------- */
export const STACK = { width: 0.42, perfect: 0.018, minOverlap: 0.012, regrow: 0.03, streakCap: 4, regrowAfter: 3 };
export function stackStart(rnd = Math.random, mod = null) {
  const width = STACK.width * (mod?.width ?? 1);
  return { id: 'stack', rnd, mod, t: 0, stack: [{ x: 0.5 - width / 2, w: width }], mover: { x: 0, w: width, dir: 1 }, baseWidth: width,
    score: 0, streak: 0, bestStreak: 0, drops: 0, perfects: 0, sinceDrop: 0, over: false };
}
// How fast the mover slides after this many coffins are down. Perfect drops add
// score, not speed, so a clean run is not punished with a faster tower.
export function stackSpeed(drops) { return Math.min(1.35, 0.42 + drops * 0.035); }
export function stackStep(g, dt) {
  if (g.over) return [];
  const events = [], mod = g.mod || {}, m = g.mover;
  g.t += dt; g.sinceDrop += dt;
  if (mod.flip && g.rnd() < mod.flip * dt) m.dir *= -1;
  let speed = stackSpeed(g.drops) * (mod.speed ?? 1);
  if (mod.alt) speed *= g.drops % 2 ? 1 + mod.alt : 1 - mod.alt;
  // Pendulum: slow at the walls, quick through the middle.
  if (mod.ease) speed *= 0.45 + 1.1 * Math.sin(Math.PI * clamp(m.x / Math.max(1e-6, 1 - m.w), 0, 1));
  m.x += m.dir * speed * dt;
  if (m.x <= 0) { m.x = 0; m.dir = 1; }
  if (m.x + m.w >= 1) { m.x = 1 - m.w; m.dir = -1; }
  // An impatient undertaker drops it for you.
  if (mod.fuse && g.sinceDrop >= mod.fuse) events.push({ type: 'autodrop', result: stackDrop(g) });
  return events;
}
export function stackDrop(g) {
  if (g.over) return { over: true };
  const top = g.stack[g.stack.length - 1], m = g.mover, mod = g.mod || {};
  let left = Math.max(m.x, top.x), right = Math.min(m.x + m.w, top.x + top.w);
  const perfect = Math.abs(m.x - top.x) <= STACK.perfect * (mod.perfect ?? 1);
  if (perfect) { left = top.x; right = top.x + top.w; }
  const width = right - left;
  if (width < STACK.minOverlap) { g.over = true; return { over: true, fell: { x: m.x, w: m.w } }; }
  const cut = perfect ? null : m.x < top.x ? { x: m.x, w: top.x - m.x, side: -1 } : { x: right, w: m.x + m.w - right, side: 1 };
  g.streak = perfect ? g.streak + 1 : 0;
  g.bestStreak = Math.max(g.bestStreak, g.streak);
  if (perfect) g.perfects += 1;
  // Three clean drops in a row win back a sliver of width, never past the starting width.
  const bonus = perfect && g.streak >= STACK.regrowAfter && mod.regrow !== 0 ? Math.max(0, Math.min(STACK.regrow, g.baseWidth - width)) : 0;
  const placed = { x: Math.max(0, left - bonus / 2), w: Math.max(STACK.minOverlap, width + bonus - (mod.shrink || 0)) };
  g.stack.push(placed);
  // A coffin is a point; clean drops in a row pay more, up to four extra a drop.
  let points = 1 + (perfect ? Math.floor(Math.min(g.streak, STACK.streakCap) * (mod.perfectPay ?? 1)) : 0);
  if (!perfect && mod.cutCost) points = Math.max(0, points - mod.cutCost);
  g.score += points;
  g.drops += 1; g.sinceDrop = 0;
  const fromLeft = g.drops % 2 === 0;
  g.mover = { x: fromLeft ? 0 : 1 - placed.w, w: placed.w, dir: fromLeft ? 1 : -1 };
  // Hanging on by a thread: most of the coffin was sawn off.
  const risky = !perfect && width < Math.max(0.07, m.w * 0.3);
  return { placed, cut, perfect, streak: g.streak, grew: bonus > 0, points, risky, height: g.stack.length - 1 };
}

/* ---------- The Séance: repeat what the candles say ---------- */
export const SEANCE = { pads: 4, lives: 2, start: 3, breath: 1.7, breathFrom: 3, breathChance: 0.3, window: 0.38, lead: 0.55, healAt: 3 };
function seanceAppend(g, copies = 1) {
  let next = Math.floor(g.rnd() * SEANCE.pads);
  if (g.seq.length >= 2 && g.seq.at(-1) === next && g.seq.at(-2) === next) next = (next + 1) % SEANCE.pads;
  const chance = g.mod?.breath ?? SEANCE.breathChance;
  // Later candles sometimes come after a held breath; the tune keeps its rhythm.
  g.gaps.push(g.seq.length >= SEANCE.breathFrom && g.rnd() < chance ? SEANCE.breath : 1);
  g.seq.push(next);
  for (let i = 1; i < copies; i++) { g.seq.push(next); g.gaps.push(1); }
}
function seanceGrow(g, count) { for (let i = 0; i < count; i++) seanceAppend(g, g.mod?.dup ? 2 : 1); }
export function seanceStart(rnd = Math.random, mod = null) {
  const lives = Math.max(1, Math.floor(mod?.lives ?? SEANCE.lives));
  const g = { id: 'seance', rnd, mod, seq: [], gaps: [], pos: 0, score: 0, bonus: 0, lives, maxLives: lives, phase: 'show', over: false,
    rounds: 0, inTime: 0, streak: 0, bestStreak: 0, beat: { last: null, ok: true } };
  const n = Math.max(1, Math.floor(mod?.start || SEANCE.start));
  while (g.seq.length < n) seanceGrow(g, 1);
  g.seq.length = n; g.gaps.length = n;
  return g;
}
// How long each candle stays lit while the spirits speak.
export function seanceBeat(g) { return Math.max(0.26, 0.62 - g.seq.length * 0.03) * (g.mod?.beat ?? 1); }
// The time between one candle starting and the next, before any held breath.
export function seancePeriod(g) { return seanceBeat(g) * 1.45; }
// When each candle of the sequence lights, in seconds from the start of the show.
export function seanceSchedule(g) {
  const period = seancePeriod(g), starts = [];
  let at = SEANCE.lead;
  g.seq.forEach((_, i) => { if (i > 0) at += period * g.gaps[i]; starts.push(at); });
  return { lead: SEANCE.lead, starts, beat: seanceBeat(g), period, end: (starts.at(-1) ?? at) + seanceBeat(g) };
}
export function seanceWanted(g) { return g.mod?.reverse ? g.seq[g.seq.length - 1 - g.pos] : g.seq[g.pos]; }
export function seanceShown(g) { if (!g.over) { g.phase = 'input'; g.pos = 0; g.beat = { last: null, ok: true }; } }
// `at` is the time of the tap in seconds, when the screen has one. Repeating
// the pauses of the tune earns a bonus; ignoring them costs nothing.
export function seanceInput(g, pad, at = null) {
  if (g.over || g.phase !== 'input') return { ignored: true };
  if (pad === seanceWanted(g)) {
    let off = false;
    if (at != null && g.beat.last != null && g.pos > 0) {
      const step = g.mod?.reverse ? g.seq.length - g.pos : g.pos;
      const want = seancePeriod(g) * g.gaps[step];
      if (Math.abs((at - g.beat.last) / want - 1) > SEANCE.window) { g.beat.ok = false; off = true; }
    }
    if (at != null) g.beat.last = at;
    g.pos += 1;
    if (g.pos < g.seq.length) return { ok: true, off };
    const done = g.seq.length;
    // A round in time needs a tune with at least one breath in it.
    const tuned = at != null && g.gaps.some((x, i) => i > 0 && x > 1);
    let rhythm = false, bonus = 0, healed = false;
    if (tuned && g.beat.ok) {
      g.streak += 1; g.inTime += 1; g.bestStreak = Math.max(g.bestStreak, g.streak);
      // A round in time is a point more. Three in a row and a forgiven mistake comes back.
      bonus = Math.max(1, Math.round(g.mod?.rhythmPay ?? 1));
      g.bonus += bonus; rhythm = true;
      if (g.streak % SEANCE.healAt === 0 && g.lives < g.maxLives) { g.lives += 1; healed = true; }
    } else if (tuned) g.streak = 0;
    g.rounds += 1;
    g.score = Math.round((done + g.bonus) * (g.mod?.scoreMult ?? 1));
    seanceGrow(g, Math.max(1, Math.floor(g.mod?.grow || 1)));
    g.phase = 'show'; g.pos = 0;
    return { ok: true, round: true, rhythm, bonus, tuned, off, healed };
  }
  g.lives -= 1; g.streak = 0;
  if (g.lives <= 0) { g.over = true; g.phase = 'over'; return { ok: false, over: true, wanted: seanceWanted(g) }; }
  const wanted = seanceWanted(g);
  g.phase = 'show'; g.pos = 0;
  return { ok: false, forgiven: true, wanted };
}

/* ---------- Grave Whack: push the dead back down ---------- */
export const WHACK = { holes: 9, lives: 3, comboStep: 8, comboCap: 4, goldPoints: 8, landlordPoints: 5 };
export function whackLife(t) { return Math.max(0.55, 1.7 * Math.exp(-t / 85)); }
const WHACK_WAVE = {
  calm: { gap: 1 }, rush: { gap: 0.6, twin: 0.3 }, funeral: { gap: 0.9, mourner: 2.2, glove: 1.6 }, gold: { gap: 0.75, gold: 4, life: 0.85 }
};
export function whackStart(rnd = Math.random, mod = null) {
  const lives = Math.max(1, Math.floor(mod?.lives ?? WHACK.lives));
  const g = { id: 'whack', rnd, mod, t: 0, holes: Array.from({ length: WHACK.holes }, () => null), spawnIn: 0.6, score: 0, combo: 0, bestCombo: 0,
    lives, maxLives: lives, over: false, serial: 0, wave: null, waveIndex: -1, hits: 0, golds: 0, gloves: 0 };
  whackWave(g, 0, null);
  return g;
}
function whackWave(g, index, events) {
  const entry = planAt(WHACK_PLAN, index), start = planStarts(WHACK_PLAN, index);
  g.waveIndex = index;
  g.wave = { index, kind: entry.kind, start, end: start + entry.len };
  if (events && index > 0) events.push({ type: 'wave', index, kind: entry.kind });
}
export function whackMult(g) { return Math.min(WHACK.comboCap, 1 + Math.floor(g.combo / (g.mod?.comboStep ?? WHACK.comboStep))); }
function whackSpawn(g, events) {
  const mod = g.mod || {}, rule = WHACK_WAVE[g.wave.kind], blocked = mod.blocked || [];
  const empty = g.holes.map((h, i) => h || blocked.includes(i) ? -1 : i).filter(i => i >= 0);
  if (!empty.length) return;
  const mourner = Math.min(0.45, Math.min(0.28, 0.12 + g.t / 400) * (mod.mourner ?? 1) * (rule.mourner ?? 1));
  const landlord = Math.min(0.3, 0.06 * (mod.landlord ?? 1));
  const gold = Math.min(0.4, 0.035 * (mod.gold ?? 1) * (rule.gold ?? 1));
  const glove = g.t < 15 ? 0 : Math.min(0.3, Math.min(0.14, 0.04 + g.t / 700) * (mod.glove ?? 1) * (rule.glove ?? 1));
  const r = g.rnd();
  const kind = r < landlord ? 'landlord' : r < landlord + gold ? 'gold' : r < landlord + gold + glove ? 'glove'
    : r < landlord + gold + glove + mourner ? 'mourner' : 'hand';
  const i = empty[Math.floor(g.rnd() * empty.length) % empty.length];
  const life = whackLife(g.t) * (mod.life ?? 1) * (rule.life ?? 1) * (kind === 'landlord' ? 0.8 : kind === 'gold' ? 0.9 : 1);
  g.holes[i] = { id: ++g.serial, kind, age: 0, life };
  events.push({ type: 'rise', hole: i, kind });
}
export function whackStep(g, dt) {
  if (g.over) return [];
  const events = [], mod = g.mod || {}, blocked = mod.blocked || [];
  g.t += dt;
  while (g.t >= g.wave.end) whackWave(g, g.wave.index + 1, events);
  const rule = WHACK_WAVE[g.wave.kind];
  const before = g.holes.slice();
  for (let i = 0; i < before.length; i++) {
    const hole = before[i];
    if (!hole) continue;
    hole.age += dt;
    // A shifty hand that has waited too long moves to a free grave.
    if (mod.hop && !hole.hopped && hole.kind === 'hand' && hole.age >= hole.life * 0.5) {
      const free = g.holes.map((h, j) => h || blocked.includes(j) ? -1 : j).filter(j => j >= 0);
      hole.hopped = true;
      if (free.length) { const j = free[Math.floor(g.rnd() * free.length) % free.length]; g.holes[j] = hole; g.holes[i] = null; events.push({ type: 'hop', from: i, to: j }); }
      continue;
    }
    if (hole.age < hole.life) continue;
    g.holes[i] = null;
    // Mourners, gloves and gold that wander off cost nothing.
    if (hole.kind === 'hand' || hole.kind === 'landlord') { g.lives -= 1; g.combo = 0; events.push({ type: 'escape', hole: i, kind: hole.kind }); }
    else events.push({ type: 'leave', hole: i, kind: hole.kind });
  }
  g.spawnIn -= dt;
  if (g.spawnIn <= 0) {
    g.spawnIn = Math.max(0.26, 0.95 * Math.exp(-g.t / 90)) * (0.7 + g.rnd() * 0.6) * (rule.gap ?? 1) * (mod.spawn ?? 1);
    const n = Math.max(1, Math.floor(mod.burst || 1)) + (rule.twin && g.rnd() < rule.twin ? 1 : 0);
    for (let k = 0; k < n; k++) whackSpawn(g, events);
  }
  if (g.lives <= 0) { g.over = true; events.push({ type: 'over' }); }
  return events;
}
export function whackHit(g, i) {
  if (g.over) return { ignored: true };
  const hole = g.holes[i];
  if (!hole) { g.combo = 0; return { empty: true }; }
  g.holes[i] = null;
  if (hole.kind === 'mourner') {
    g.lives -= 1; g.combo = 0;
    if (g.lives <= 0) g.over = true;
    return { widow: true, over: g.over };
  }
  // A stuffed glove: no harm done, but the streak is gone.
  if (hole.kind === 'glove') { g.combo = 0; g.gloves += 1; return { glove: true }; }
  g.combo += 1; g.bestCombo = Math.max(g.bestCombo, g.combo); g.hits += 1;
  // Gold pays a flat bonus; the streak multiplier is for the ordinary dead.
  const base = hole.kind === 'landlord' ? WHACK.landlordPoints : hole.kind === 'gold' ? WHACK.goldPoints : 1;
  const points = Math.round(base * (hole.kind === 'gold' ? 1 : whackMult(g)) * (g.mod?.scoreMult ?? 1));
  g.score += points;
  let healed = false;
  if (hole.kind === 'gold') { g.golds += 1; if (g.lives < g.maxLives) { g.lives += 1; healed = true; } }
  return { points, kind: hole.kind, healed, combo: g.combo, mult: whackMult(g) };
}

/* ---------- starting, finishing and paying ---------- */
const STARTERS = { frenzy: frenzyStart, stack: stackStart, seance: seanceStart, whack: whackStart };
export function startGame(id, rnd = Math.random, mod = null) { return STARTERS[id] ? STARTERS[id](rnd, mod) : null; }

// Three lines for the result card, from what actually happened in the run.
export function runStats(g) {
  if (!g) return [];
  if (g.id === 'frenzy') return [['Best combo', g.bestCombo], ['Flawless bosses', g.flawless], ['Close shaves', g.near]];
  if (g.id === 'stack') return [['Height', g.stack.length - 1], ['Perfect drops', g.perfects], ['Longest streak', g.bestStreak]];
  if (g.id === 'seance') return [['Rounds', g.rounds], ['In time', g.inTime], ['Longest streak', g.bestStreak]];
  if (g.id === 'whack') return [['Pushed down', g.hits], ['Best combo', g.bestCombo], ['Gold teeth', g.golds]];
  return [];
}

// Where a score stands on the skull ladder: the skulls earned, the next
// threshold and how far away it is. `next` is 0 once the last skull is won.
export function ladder(id, score) {
  const tiers = ARCADE_BY_ID[id]?.tiers || [];
  const tier = tiers.filter(t => score >= t).length;
  const next = tiers[tier] || 0, floor = tier ? tiers[tier - 1] : 0;
  return { tier, next, left: next ? next - score : 0, progress: next ? clamp((score - floor) / (next - floor), 0, 1) : 1 };
}

// Today's challenge record: one per day, replaced when the date changes.
export function dailyRecord(state, challenge) {
  const a = arcadeState(state);
  if (a.daily?.day !== challenge.day) a.daily = { day: challenge.day, game: challenge.game, mod: challenge.mod.id, best: 0, plays: 0, claimed: false };
  return a.daily;
}
export function challengeToday(state, now = Date.now()) {
  const challenge = dailyChallenge(localDayKey(now));
  if (!challenge) return null;
  const a = arcadeState(state), rec = a.daily?.day === challenge.day ? a.daily : null;
  const yesterday = dayKeyOffset(now, -1);
  const kept = a.dailyLastDay === localDayKey(now) || a.dailyLastDay === yesterday;
  // One missed day is bridged by a streak freeze (engine/streaks.js), spent when the challenge is next claimed.
  const bridged = !kept && canBridge(state, a.dailyLastDay, a.dailyStreak, now);
  const streak = kept || bridged ? a.dailyStreak : 0;
  return { ...challenge, best: rec?.best || 0, plays: rec?.plays || 0, claimed: !!rec?.claimed, streak, bridged };
}
// The last fortnight of challenge days, oldest first. A day nobody played is null.
export function dailyHistory(state, now = Date.now()) {
  const a = arcadeState(state), byDay = new Map(a.history.map(h => [h.day, h]));
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const day = dayKeyOffset(now, i - (HISTORY_DAYS - 1));
    const h = byDay.get(day), c = dailyChallenge(day);
    return { day, today: i === HISTORY_DAYS - 1, game: h?.game || c?.game || '', mod: h?.mod || c?.mod.id || '', best: h?.best || 0, played: !!h };
  });
}
function recordHistory(a, day, game, mod, best) {
  const at = a.history.findIndex(h => h.day === day);
  const entry = { day, game, mod, best };
  if (at >= 0) a.history[at] = entry; else a.history.push(entry);
  a.history = a.history.slice(-HISTORY_DAYS);
}

export function tierFor(id, score) { return (ARCADE_BY_ID[id]?.tiers || []).filter(t => score >= t).length; }

export function finishRun(state, id, score, petId, now = Date.now(), rnd = Math.random, opts = {}) {
  const game = ARCADE_BY_ID[id];
  if (!game) return null;
  const a = arcadeState(state);
  const pet = petById(state, petId) || state.pets?.[0] || null;
  const themesBefore = new Set(ARCADE_THEMES.filter(t => themeUnlocked(a, t)).map(t => t.id)), runsBefore = lifetimeRuns(a);
  // The server refuses anything over its ceiling, so a run is never reported above it.
  score = Math.min(ARCADE_SCORE_CAPS[id] ?? 0, Math.max(0, Math.floor(score || 0)));
  // A challenge run keeps its own best for the day, so a slim-coffin score never
  // replaces the ordinary record it cannot fairly be compared with.
  const challenge = opts.daily ? dailyChallenge(localDayKey(now)) : null;
  const daily = challenge && challenge.game === id ? dailyRecord(state, challenge) : null;
  const previous = daily ? daily.best : a.best[id] || 0;
  const newBest = score > previous && score > 0;
  if (newBest) { if (daily) daily.best = score; else a.best[id] = score; }
  a.lastGame = id;
  const tier = tierFor(id, score);
  // Skulls on the card are earned in the ordinary game, where scores compare.
  const medalBefore = Number(a.medals[id]) || 0;
  if (!daily && tier > medalBefore) a.medals[id] = tier;
  let souls = 0, trust = 0, counted = false;
  // A run that scored nothing is a warm-up, not a game.
  if (score > 0) {
    if (daily) daily.plays += 1; else a.plays[id] = (a.plays[id] || 0) + 1;
    a.runs = runsBefore + 1;
    // Pay follows the score, not the modifier: a doubled score does not pay double.
    const worth = score / Math.max(1, challenge && daily ? challenge.mod.scoreMult || 1 : 1);
    souls = payGameSouls(state, Math.floor(worth * game.pay) + (newBest && !daily ? 10 : 0), now);
    deed(state, 'game', 1, now);
    if (pet) {
      pet.needs && (pet.needs.fuss = clamp((pet.needs.fuss || 0) + 12, 0, 100));
      if (tier >= 1) trust = grantBonusTrust(pet, 1, now);
      recordGameLife(state, pet, 'arcade', now, false);
      recordEscapadeEvent(state, { kind: 'play', petIds: [pet.id], activity: 'arcade:' + id }, now);
      pet.arcadeRuns = (pet.arcadeRuns || 0) + 1;
      counted = true;
    }
  }
  // The first scoring challenge run of the day pays a flat bonus, outside the daily purse.
  let dailyResult = null;
  if (daily) {
    let bonus = 0, freeze = false;
    if (score > 0 && !daily.claimed) {
      daily.claimed = true;
      const today = localDayKey(now);
      freeze = a.dailyLastDay !== dayKeyOffset(now, -1) && canBridge(state, a.dailyLastDay, a.dailyStreak, now) && spendFreeze(state, 'challenge', now);
      a.dailyStreak = a.dailyLastDay === dayKeyOffset(now, -1) || freeze ? a.dailyStreak + 1 : 1;
      a.dailyLastDay = today;
      earnFreeze(state, 'challenge', a.dailyStreak, now);
      bonus = DAILY_SOULS + DAILY_STREAK_SOULS * Math.min(a.dailyStreak - 1, DAILY_STREAK_CAP);
      addSouls(state, bonus);
    }
    if (daily.best > 0) recordHistory(a, daily.day, id, challenge.mod.id, daily.best);
    dailyResult = { title: challenge.mod.title, mod: challenge.mod.id, best: daily.best, bonus, streak: a.dailyStreak, freeze };
  }
  const unlocked = ARCADE_THEMES.filter(t => themeUnlocked(a, t) && !themesBefore.has(t.id));
  const name = pet ? pet.name : 'Someone';
  const pool = ARCADE_QUIPS[id][tier] || ARCADE_QUIPS[id][0];
  const quip = pool[Math.floor(rnd() * pool.length) % pool.length].replace(/\{n\}/g, name);
  const bestLine = newBest && previous ? NEW_BEST_LINES[Math.floor(rnd() * NEW_BEST_LINES.length) % NEW_BEST_LINES.length].replace(/\{n\}/g, name) : '';
  return { id, score, best: daily ? daily.best : a.best[id] || 0, previous, newBest, tier, medal: Number(a.medals[id]) || 0, newMedal: !daily && tier > medalBefore,
    unlocked, souls, trust, counted, quip, bestLine, daily: dailyResult, day: localDayKey(now) };
}
