import { ARCADE_BY_ID, ARCADE_QUIPS, NEW_BEST_LINES, FRENZY_ITEMS } from '../content/arcade.js';
import { grantBonusTrust, localDayKey, dayKeyOffset, clamp, petById } from '../state.js';
import { payGameSouls, addSouls, deed } from './mayhem.js';
import { dailyChallenge } from './daily.js';
import { DAILY_SOULS, DAILY_STREAK_SOULS, DAILY_STREAK_CAP } from '../content/daily.js';
import { recordGameLife } from './life.js';
import { recordEscapadeEvent } from '../escapade-state.js';
import { arcadeState } from '../arcade-state.js';
import { canBridge, spendFreeze, earnFreeze } from './streaks.js';
export { normalizeArcade, blankArcade } from '../arcade-state.js';

/* ================= ARCADE SIMULATIONS =================
   Four small games, each a plain object stepped by the UI. Nothing here
   touches the page, so every rule is testable with a fixed random seed.
   Positions are fractions of the playfield: x 0..1 left to right, y 0..1
   top to bottom. Time is in seconds. */

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

/* ---------- Feeding Frenzy: catch the good, dodge the bad ---------- */
export const FRENZY = { lives: 3, catchY: [0.8, 0.95], reach: 0.1, speed: 1.7, frenzyFor: 6 };
export function frenzyStart(rnd = Math.random, mod = null) {
  return { id: 'frenzy', rnd, mod, t: 0, x: 0.5, dir: 0, target: null, lives: FRENZY.lives, score: 0, combo: 0, bestCombo: 0,
    items: [], spawnIn: 0.5, serial: 0, frenzyUntil: 0, over: false };
}
export function frenzyPace(t) { return Math.min(3, 1 + t / 38); }
export function frenzyStep(g, dt) {
  if (g.over) return [];
  const events = [];
  g.t += dt;
  const pace = frenzyPace(g.t);
  // Movement: a held direction wins; otherwise glide toward a pointer target.
  const speed = FRENZY.speed * (g.mod?.speed ?? 1);
  if (g.dir) g.x += g.dir * speed * dt;
  else if (g.target != null) { const d = g.target - g.x; g.x += Math.sign(d) * Math.min(Math.abs(d), speed * 1.4 * dt); }
  g.x = clamp(g.x, 0.06, 0.94);
  g.spawnIn -= dt;
  if (g.spawnIn <= 0) {
    g.spawnIn = Math.max(0.24, 0.8 - g.t * 0.011) * (0.75 + g.rnd() * 0.5) * (g.mod?.spawn ?? 1);
    const badBoost = (1 + g.t / 40) * (g.mod?.bad ?? 1);
    const kind = weighted(Object.entries(FRENZY_ITEMS).map(([k, v]) => [k, v.good ? v.weight : v.weight * badBoost]), g.rnd);
    g.items.push({ id: ++g.serial, kind, x: 0.06 + g.rnd() * 0.88, y: -0.05, vy: (0.3 + g.rnd() * 0.12) * pace, spin: g.rnd() * 360 });
  }
  for (const item of g.items) item.y += item.vy * dt;
  const keep = [];
  for (const item of g.items) {
    const def = FRENZY_ITEMS[item.kind];
    if (item.y >= FRENZY.catchY[0] && item.y <= FRENZY.catchY[1] && Math.abs(item.x - g.x) < FRENZY.reach) {
      if (def.good) {
        g.combo += 1; g.bestCombo = Math.max(g.bestCombo, g.combo);
        const mult = Math.min(5, 1 + Math.floor(g.combo / 6)) * (g.t < g.frenzyUntil ? 2 : 1);
        const points = def.points * mult;
        g.score += points;
        if (def.frenzy) g.frenzyUntil = g.t + FRENZY.frenzyFor;
        events.push({ type: 'catch', kind: item.kind, points, mult, x: item.x });
      } else {
        g.lives -= 1; g.combo = 0;
        events.push({ type: 'hit', kind: item.kind, x: item.x });
      }
      continue;
    }
    if (item.y > 1.05) { if (def.good && g.combo) { g.combo = 0; events.push({ type: 'miss', kind: item.kind }); } continue; }
    keep.push(item);
  }
  g.items = keep;
  if (g.lives <= 0) { g.over = true; events.push({ type: 'over' }); }
  return events;
}

/* ---------- Coffin Stack: drop on the beat, keep what overlaps ---------- */
export const STACK = { width: 0.42, perfect: 0.018, minOverlap: 0.012 };
export function stackStart(rnd = Math.random, mod = null) {
  const width = STACK.width * (mod?.width ?? 1);
  return { id: 'stack', rnd, mod, t: 0, stack: [{ x: 0.5 - width / 2, w: width }], mover: { x: 0, w: width, dir: 1 },
    score: 0, streak: 0, over: false };
}
export function stackSpeed(level) { return Math.min(1.35, 0.42 + level * 0.035); }
export function stackStep(g, dt) {
  if (g.over) return;
  g.t += dt;
  const m = g.mover;
  m.x += m.dir * stackSpeed(g.score) * (g.mod?.speed ?? 1) * dt;
  if (m.x <= 0) { m.x = 0; m.dir = 1; }
  if (m.x + m.w >= 1) { m.x = 1 - m.w; m.dir = -1; }
}
export function stackDrop(g) {
  if (g.over) return { over: true };
  const top = g.stack[g.stack.length - 1], m = g.mover;
  let left = Math.max(m.x, top.x), right = Math.min(m.x + m.w, top.x + top.w);
  const perfect = Math.abs(m.x - top.x) <= STACK.perfect;
  if (perfect) { left = top.x; right = top.x + top.w; }
  const width = right - left;
  if (width < STACK.minOverlap) { g.over = true; return { over: true, fell: { x: m.x, w: m.w } }; }
  const cut = perfect ? null : m.x < top.x ? { x: m.x, w: top.x - m.x, side: -1 } : { x: right, w: m.x + m.w - right, side: 1 };
  g.streak = perfect ? g.streak + 1 : 0;
  // Three clean drops in a row win back a sliver of width.
  const bonus = perfect && g.streak >= 3 ? Math.min(0.03, STACK.width - width) : 0;
  const placed = { x: Math.max(0, left - bonus / 2), w: width + bonus };
  g.stack.push(placed);
  g.score += 1;
  const fromLeft = g.score % 2 === 0;
  g.mover = { x: fromLeft ? 0 : 1 - placed.w, w: placed.w, dir: fromLeft ? 1 : -1 };
  return { placed, cut, perfect, streak: g.streak, grew: bonus > 0 };
}

/* ---------- The Séance: repeat what the candles say ---------- */
export const SEANCE = { pads: 4, lives: 2 };
export function seanceStart(rnd = Math.random, mod = null) {
  const seq = [];
  for (let i = 0; i < Math.max(1, mod?.start || 1); i++) {
    let next = Math.floor(rnd() * SEANCE.pads);
    if (seq.length >= 2 && seq.at(-1) === next && seq.at(-2) === next) next = (next + 1) % SEANCE.pads;
    seq.push(next);
  }
  return { id: 'seance', rnd, mod, seq, pos: 0, score: 0, lives: SEANCE.lives, phase: 'show', over: false };
}
// How long each candle stays lit while the spirits speak.
export function seanceBeat(g) { return Math.max(0.26, 0.62 - g.seq.length * 0.03) * (g.mod?.beat ?? 1); }
export function seanceShown(g) { if (!g.over) { g.phase = 'input'; g.pos = 0; } }
export function seanceInput(g, pad) {
  if (g.over || g.phase !== 'input') return { ignored: true };
  if (pad === g.seq[g.pos]) {
    g.pos += 1;
    if (g.pos < g.seq.length) return { ok: true };
    g.score = g.seq.length;
    let next = Math.floor(g.rnd() * SEANCE.pads);
    // Never three of the same candle in a row; the dead are not that boring.
    if (g.seq.length >= 2 && g.seq.at(-1) === next && g.seq.at(-2) === next) next = (next + 1) % SEANCE.pads;
    g.seq.push(next);
    g.phase = 'show'; g.pos = 0;
    return { ok: true, round: true };
  }
  g.lives -= 1;
  if (g.lives <= 0) { g.over = true; g.phase = 'over'; return { ok: false, over: true, wanted: g.seq[g.pos] }; }
  g.phase = 'show'; g.pos = 0;
  return { ok: false, forgiven: true, wanted: g.seq[g.pos] };
}

/* ---------- Grave Whack: push the dead back down ---------- */
export const WHACK = { holes: 9, lives: 3 };
export function whackStart(rnd = Math.random, mod = null) {
  return { id: 'whack', rnd, mod, t: 0, holes: Array.from({ length: WHACK.holes }, () => null), spawnIn: 0.6, score: 0, combo: 0, lives: WHACK.lives, over: false, serial: 0 };
}
export function whackStep(g, dt) {
  if (g.over) return [];
  const events = [];
  g.t += dt;
  g.holes.forEach((hole, i) => {
    if (!hole) return;
    hole.age += dt;
    if (hole.age < hole.life) return;
    g.holes[i] = null;
    if (hole.kind !== 'mourner') { g.lives -= 1; g.combo = 0; events.push({ type: 'escape', hole: i, kind: hole.kind }); }
  });
  g.spawnIn -= dt;
  const empty = g.holes.map((h, i) => h ? -1 : i).filter(i => i >= 0);
  if (g.spawnIn <= 0 && empty.length) {
    g.spawnIn = Math.max(0.32, 0.95 - g.t * 0.012) * (0.7 + g.rnd() * 0.6);
    const mournerChance = Math.min(0.45, Math.min(0.28, 0.12 + g.t / 400) * (g.mod?.mourner ?? 1));
    const r = g.rnd();
    const kind = r < 0.06 ? 'landlord' : r < 0.06 + mournerChance ? 'mourner' : 'hand';
    const i = empty[Math.floor(g.rnd() * empty.length) % empty.length];
    g.holes[i] = { id: ++g.serial, kind, age: 0, life: Math.max(0.7, 1.7 - g.t * 0.016) * (kind === 'landlord' ? 0.8 : 1) * (g.mod?.life ?? 1) };
    events.push({ type: 'rise', hole: i, kind });
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
  g.combo += 1;
  const points = (hole.kind === 'landlord' ? 5 : 1) * Math.min(4, 1 + Math.floor(g.combo / 8));
  g.score += points;
  return { points, kind: hole.kind };
}

/* ---------- starting, finishing and paying ---------- */
const STARTERS = { frenzy: frenzyStart, stack: stackStart, seance: seanceStart, whack: whackStart };
export function startGame(id, rnd = Math.random, mod = null) { return STARTERS[id] ? STARTERS[id](rnd, mod) : null; }

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

export function tierFor(id, score) { return (ARCADE_BY_ID[id]?.tiers || []).filter(t => score >= t).length; }

export function finishRun(state, id, score, petId, now = Date.now(), rnd = Math.random, opts = {}) {
  const game = ARCADE_BY_ID[id];
  if (!game) return null;
  const a = arcadeState(state);
  const pet = petById(state, petId) || state.pets?.[0] || null;
  score = Math.max(0, Math.floor(score || 0));
  // A challenge run keeps its own best for the day, so a slim-coffin score never
  // replaces the ordinary record it cannot fairly be compared with.
  const challenge = opts.daily ? dailyChallenge(localDayKey(now)) : null;
  const daily = challenge && challenge.game === id ? dailyRecord(state, challenge) : null;
  const previous = daily ? daily.best : a.best[id] || 0;
  const newBest = score > previous && score > 0;
  if (newBest) { if (daily) daily.best = score; else a.best[id] = score; }
  if (daily) daily.plays += 1; else a.plays[id] = (a.plays[id] || 0) + 1;
  a.lastGame = id;
  const tier = tierFor(id, score);
  let souls = 0, trust = 0, counted = false;
  // A run that scored nothing is a warm-up, not a game.
  if (score > 0) {
    souls = payGameSouls(state, Math.floor(score * game.pay) + (newBest && !daily ? 10 : 0), now);
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
    dailyResult = { title: challenge.mod.title, mod: challenge.mod.id, best: daily.best, bonus, streak: a.dailyStreak, freeze };
  }
  const name = pet ? pet.name : 'Someone';
  const pool = ARCADE_QUIPS[id][tier] || ARCADE_QUIPS[id][0];
  const quip = pool[Math.floor(rnd() * pool.length) % pool.length].replace(/\{n\}/g, name);
  const bestLine = newBest && previous ? NEW_BEST_LINES[Math.floor(rnd() * NEW_BEST_LINES.length) % NEW_BEST_LINES.length].replace(/\{n\}/g, name) : '';
  return { id, score, best: daily ? daily.best : a.best[id] || 0, previous, newBest, tier, souls, trust, counted, quip, bestLine, daily: dailyResult, day: localDayKey(now) };
}
