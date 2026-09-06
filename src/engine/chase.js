import { artPersonality } from './personality.js';

export const CHASE_WIDTH = 320;
export const CHASE_HEIGHT = 230;
export const CHASE_GROUND = 20;
export const CHASE_SECONDS = 22;
export const RUSH_SECONDS = 4;
// Base points. Catches (crumb, gold, moth, biscuit) are multiplied by the streak; the rest are flat.
export const CHASE_POINTS = { crumb: 10, gold: 30, moth: 20, biscuit: 50, stomp: 20, dodge: 15, air: 5, bump: -5 };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const FLOOR = 10;   // resting height of anything on the floorboards
const CHEST = 27;   // the catch box sits this far above the resident's feet

export const streakMultiplier = combo => Math.min(3, 1 + Math.floor(combo / 4));

/* Who you are chasing with used to change only what its body could do — wings
   glide, horns take a hit, a tail bounces higher off a bunny. What it FELT about
   you changed nothing at all, so a furious half-starved resident handled exactly
   like a content one that had been fussed all week.

   `temper` is that missing half. A creature in a mood is quick and hard to hold
   a line with; a settled one is slower off the mark and much easier to steer.
   Trust buys nothing so large that the game plays itself: one extra bump of
   patience at high trust, and that is all. */
export const TEMPER = {
  furious: { speed: 1.16, grip: 0.72 },
  annoyed: { speed: 1.08, grip: 0.85 },
  fine:    { speed: 1, grip: 1 },
  content: { speed: 0.95, grip: 1.12 }
};

export function temperOf(mood) { return TEMPER[mood] || TEMPER.fine; }

export function newChase(pet, { gentle = false, rng = Math.random, mood = 'fine' } = {}) {
  const art = artPersonality(pet);
  const temper = temperOf(mood);
  return {
    kind: 'chase', petId: pet.id, time: 0, score: 0, caught: 0, combo: 0, bestCombo: 0,
    dodged: 0, bumps: 0, airCatches: 0, stomps: 0, moths: 0, stolen: 0, biscuits: 0, powerups: 0,
    goal: gentle ? 6 : 8, complete: false, finished: false, claimed: false, gentle, stars: 0,
    wings: art.motion.canFlap, horns: art.horns, halo: art.halo, tail: art.motion.tails > 0,
    mood, speedScale: temper.speed, grip: temper.grip,
    // Horns are a shield. So, once, is a resident that genuinely trusts you: it
    // will take one knock on your behalf before it starts blaming you for them.
    shield: (art.horns ? 1 : 0) + ((pet.bond || 0) >= 15 ? 1 : 0), rush: 0,
    player: { x: 160, z: 0, vy: 0, direction: 1, moving: false, glided: false, invincible: 0 },
    items: [], serial: 0, crumbsMade: 0, nextCrumb: .15, nextBunny: 3.2,
    nextMoth: gentle ? 11 : 8, nextBiscuit: gentle ? 6 : 5, nextSugar: gentle ? 7 : 8, rng
  };
}

export function jumpChase(game) {
  if (!game || game.finished) return false;
  const p = game.player;
  if (p.z <= .01) {
    p.vy = game.wings ? 310 : 325; p.z = .1; p.glided = false;
    return true;
  }
  if (game.wings && !p.glided && p.vy < 140) {
    p.vy = 225; p.glided = true; return true;
  }
  return false;
}

function spawnCrumb(game) {
  const route = [0, 25, -40, 100, -100, 60, -65, 110, -110, 40, -35];
  const n = game.crumbsMade++;
  const gold = n > 2 && n % 5 === 4;
  game.items.push({ id: ++game.serial, kind: 'crumb', gold,
    x: clamp(160 + route[n % route.length] + (game.rng() - .5) * 16, 28, 292),
    z: gold ? 100 : 182, vy: -10, age: 0, floorTime: 0 });
  game.nextCrumb += game.gentle ? .9 : .95;
}
// Bunnies arrive faster and closer together as the clock runs down.
function spawnBunny(game) {
  const direction = game.rng() < .5 ? 1 : -1;
  game.items.push({ id: ++game.serial, kind: 'bunny', x: direction > 0 ? -18 : 338,
    z: FLOOR, vx: direction * (game.gentle ? 64 : 90 + game.time * 1.6), age: 0, dodged: false });
  game.nextBunny += game.gentle ? Math.max(3.6, 5 - game.time * .07) : Math.max(2.4, 3.8 - game.time * .07);
}
// A moth drifts across at eye height, dives for any crumb resting on the floor, and leaves with it.
function spawnMoth(game) {
  const direction = game.rng() < .5 ? 1 : -1;
  game.items.push({ id: ++game.serial, kind: 'moth', x: direction > 0 ? -16 : 336, z: 96 + game.rng() * 40,
    vx: direction * (game.gentle ? 40 : 56), age: 0, carrying: false });
  game.nextMoth += game.gentle ? 8 : 6;
}
// A biscuit is heavy: it falls slowly, and is only worth anything if caught before it lands.
function spawnBiscuit(game) {
  game.items.push({ id: ++game.serial, kind: 'biscuit', x: 60 + game.rng() * 200, z: 182, vy: game.gentle ? -34 : -42, age: 0 });
  game.nextBiscuit += 9;
}
// A sugar cube drops on the emptier side of the floor (it has to be gone for), sits three seconds, then melts.
// Touching it starts a sugar rush: faster steering and a crumb magnet for a few seconds.
function spawnSugar(game) {
  const p = game.player, side = p.x < 160 ? 1 : -1;
  game.items.push({ id: ++game.serial, kind: 'sugar', x: clamp(p.x + side * (90 + game.rng() * 90), 40, 280), z: 182, vy: -70, age: 0, floorTime: 0 });
  game.nextSugar += 7.5;
}
const EARLY = 12;
// For the first EARLY seconds only one hazard type is on screen at a time; the other waits half a second and retries.
const hazardClear = (game, other) => game.time >= EARLY || !game.items.some(i => i.kind === other);
function spawnAll(game) {
  const t = game.time;
  while (t >= game.nextCrumb && t < CHASE_SECONDS - 1.8) spawnCrumb(game);
  if (t >= game.nextBunny && t < CHASE_SECONDS - 2) { if (hazardClear(game, 'moth')) spawnBunny(game); else game.nextBunny += .5; }
  if (t >= game.nextMoth && t < CHASE_SECONDS - 3) { if (hazardClear(game, 'bunny')) spawnMoth(game); else game.nextMoth += .5; }
  if (t >= game.nextBiscuit && t < CHASE_SECONDS - 5) spawnBiscuit(game);
  if (t >= game.nextSugar && t < CHASE_SECONDS - 5) spawnSugar(game);
}

// Moves the resident and returns where its feet were before the move (stomps need to know).
function stepPlayer(game, input, dt, events) {
  const p = game.player, previousZ = p.z;
  p.invincible = Math.max(0, p.invincible - dt);
  if (game.rush > 0) { game.rush = Math.max(0, game.rush - dt); if (!game.rush) events.push({ type: 'rushEnd' }); }
  // Mood sets the top speed; grip is how much of a drag-to-steer instruction it
  // actually accepts. A furious creature is faster than you can comfortably aim.
  const speed = (game.rush > 0 ? 236 : 178) * (game.speedScale || 1);
  const grip = game.grip || 1;
  let dx = clamp(Number(input.axis) || 0, -1, 1) * speed * dt;
  if (!dx && Number.isFinite(input.targetX)) dx = clamp((input.targetX - p.x) * grip, -speed * dt, speed * dt);
  p.x = clamp(p.x + dx, 26, 294); p.moving = Math.abs(dx) > .01;
  if (p.moving) p.direction = dx < 0 ? -1 : 1;
  if (p.z > 0 || p.vy > 0) {
    p.vy -= (game.wings ? 550 : 900) * dt;
    p.z = Math.max(0, p.z + p.vy * dt);
    if (!p.z) { p.vy = 0; if (previousZ > 0) events.push({ type: 'land', x: p.x }); }
  }
  return previousZ;
}

const reachOf = game => game.halo ? 37 : game.gentle ? 32 : 26;
function touching(game, item, reach = reachOf(game)) {
  const p = game.player;
  return Math.abs(item.x - p.x) < reach && Math.abs(item.z - p.z - CHEST) < 30;
}
function extendStreak(game) { game.combo++; game.bestCombo = Math.max(game.bestCombo, game.combo); }
// A catch of any kind: streak, multiplier, air bonus, and one event the UI can turn into a pop.
function award(game, item, base, events) {
  const p = game.player, air = p.z > 15;
  extendStreak(game);
  const points = base * streakMultiplier(game.combo) + (air ? CHASE_POINTS.air : 0);
  game.score += points; if (air) game.airCatches++;
  item.remove = true;
  events.push({ type: 'catch', kind: item.kind, points, air, gold: !!item.gold, x: item.x, z: item.z, id: item.id });
}

function stepCrumb(game, item, dt, events) {
  const p = game.player;
  if (!item.gold || item.age > 1.2) { item.vy -= 225 * dt; item.z = Math.max(FLOOR, item.z + item.vy * dt); }
  if (item.z === FLOOR) item.floorTime += dt;
  const distance = Math.hypot(item.x - p.x, item.z - (p.z + CHEST));
  if ((game.halo || game.rush > 0) && distance < 70) item.x += (p.x - item.x) * Math.min(1, dt * 3);
  if (touching(game, item)) { game.caught++; award(game, item, item.gold ? CHASE_POINTS.gold : CHASE_POINTS.crumb, events); }
  else if (item.floorTime > (game.gentle ? 2.3 : 1.4)) { item.remove = true; game.combo = 0; events.push({ type: 'miss', x: item.x, id: item.id }); }
}

// Landing on a bunny from above squashes it and bounces the resident; tails bounce higher.
function stomp(game, item, events) {
  const p = game.player;
  item.remove = true; game.stomps++; extendStreak(game); game.score += CHASE_POINTS.stomp;
  p.vy = game.tail ? 265 : 205; p.glided = false;
  events.push({ type: 'stomp', points: CHASE_POINTS.stomp, x: item.x, z: item.z, id: item.id, tail: game.tail });
}
function collide(game, item, events) {
  const p = game.player;
  item.remove = true; p.invincible = .85;
  if (game.shield) { game.shield--; events.push({ type: 'shield' }); return; }
  game.bumps++; game.combo = 0; game.score = Math.max(0, game.score + CHASE_POINTS.bump);
  p.x = clamp(p.x + Math.sign(item.vx) * 14, 26, 294);
  events.push({ type: 'bump', x: p.x });
}
function stepBunny(game, item, dt, events, previousZ) {
  const p = game.player;
  item.x += item.vx * dt;
  if (Math.abs(item.x - p.x) < 29) {
    const fromAbove = previousZ > 3 && p.z < previousZ;
    if (p.z <= 24 && fromAbove) stomp(game, item, events);
    else if (p.z > 24 && !item.dodged) { item.dodged = true; game.dodged++; game.score += CHASE_POINTS.dodge; events.push({ type: 'dodge', points: CHASE_POINTS.dodge }); }
    else if (p.z <= 24 && !p.invincible && !item.dodged) collide(game, item, events);
  }
  if (item.x < -35 || item.x > 355) item.remove = true;
}

function nearestFloorCrumb(game, moth) {
  let best = null;
  for (const i of game.items) {
    if (i.kind !== 'crumb' || i.z !== FLOOR || i.remove) continue;
    if (!best || Math.abs(i.x - moth.x) < Math.abs(best.x - moth.x)) best = i;
  }
  return best;
}
function stepMoth(game, item, dt, events) {
  const target = item.carrying ? null : nearestFloorCrumb(game, item);
  if (target) {
    const dx = target.x - item.x, dz = target.z + 6 - item.z, d = Math.hypot(dx, dz) || 1, speed = Math.abs(item.vx) * 1.4;
    item.x += dx / d * speed * dt; item.z += dz / d * speed * dt;
    if (d < 10) {
      target.remove = true; item.carrying = true; game.stolen++; game.combo = 0;
      events.push({ type: 'steal', x: target.x, z: target.z, id: target.id });
    }
  } else {
    item.x += item.vx * dt;
    item.z = clamp(item.z + (item.carrying ? 80 : Math.cos(item.age * 4) * 60) * dt, FLOOR + 5, 200);
  }
  if (touching(game, item)) { game.moths++; award(game, item, CHASE_POINTS.moth, events); }
  else if (item.x < -35 || item.x > 355 || item.z >= 195) item.remove = true;
}

function stepBiscuit(game, item, dt, events) {
  item.z = Math.max(FLOOR, item.z + item.vy * dt);
  if (touching(game, item, reachOf(game) + 6)) { game.biscuits++; award(game, item, CHASE_POINTS.biscuit, events); }
  else if (item.z === FLOOR) { item.remove = true; events.push({ type: 'crumble', x: item.x, id: item.id }); }
}

function stepSugar(game, item, dt, events) {
  item.z = Math.max(FLOOR, item.z + item.vy * dt);
  if (item.z === FLOOR) item.floorTime += dt;
  if (touching(game, item)) {
    item.remove = true; game.powerups++; game.rush = game.gentle ? RUSH_SECONDS + 1 : RUSH_SECONDS;
    events.push({ type: 'powerup', kind: 'sugar', seconds: game.rush, x: item.x, z: item.z, id: item.id });
  } else if (item.floorTime > 3) { item.remove = true; events.push({ type: 'melt', x: item.x, id: item.id }); }
}

const STEPPERS = { crumb: stepCrumb, bunny: stepBunny, moth: stepMoth, biscuit: stepBiscuit, sugar: stepSugar };

function step(game, input, dt, events) {
  game.time = Math.min(CHASE_SECONDS, game.time + dt);
  const previousZ = stepPlayer(game, input, dt, events);
  spawnAll(game);
  for (const item of game.items) {
    if (item.remove) continue;
    item.age += dt;
    STEPPERS[item.kind]?.(game, item, dt, events, previousZ);
  }
  game.items = game.items.filter(x => !x.remove);
  if (game.time >= CHASE_SECONDS) {
    game.finished = true; game.complete = game.caught >= game.goal; game.stars = chaseStars(game);
    events.push({ type: 'finish', won: game.complete, stars: game.stars });
  }
}

// Small physics steps keep catches and jumps consistent at different frame rates.
export function updateChase(game, input = {}, elapsed = 0) {
  const events = [];
  if (!game || game.finished || !Number.isFinite(elapsed) || elapsed <= 0) return events;
  let remaining = Math.min(.25, elapsed);
  while (remaining > 1e-7 && !game.finished) {
    const dt = Math.min(1 / 60, remaining); step(game, input, dt, events); remaining -= dt;
  }
  return events;
}

// One star for turning up, two for the goal, three for the goal with room to spare and a real score.
export function chaseStars(game) {
  if (game.caught < game.goal) return 1;
  return game.caught >= game.goal + 5 && game.score >= game.goal * 45 ? 3 : 2;
}

// A higher score replaces the record; best streak and best star rating only ever climb.
export function recordChase(pet, game, now = Date.now()) {
  if (!game.finished || game.petId !== pet.id) return false;
  const previous = pet.chaseBest;
  const bestStreak = Math.max(game.bestCombo || 0, previous?.bestStreak || 0);
  const stars = Math.max(chaseStars(game), previous?.stars || 0);
  if (!previous || game.score > previous.score) {
    pet.chaseBest = { score: game.score, caught: game.caught, dodged: game.dodged, at: now, bestStreak, stars }; return true;
  }
  previous.bestStreak = bestStreak; previous.stars = stars;
  return false;
}
