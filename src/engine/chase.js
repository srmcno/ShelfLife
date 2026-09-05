import { artPersonality } from './personality.js';

export const CHASE_WIDTH = 320;
export const CHASE_HEIGHT = 230;
export const CHASE_GROUND = 20;
export const CHASE_SECONDS = 22;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function newChase(pet, { gentle = false, rng = Math.random } = {}) {
  const art = artPersonality(pet);
  return {
    kind: 'chase', petId: pet.id, time: 0, score: 0, caught: 0, combo: 0,
    dodged: 0, bumps: 0, airCatches: 0, goal: gentle ? 6 : 8,
    complete: false, finished: false, claimed: false, gentle,
    wings: art.motion.canFlap, horns: art.horns, halo: art.halo,
    shield: art.horns ? 1 : 0, player: { x: 160, z: 0, vy: 0, direction: 1, moving: false, glided: false, invincible: 0 },
    items: [], serial: 0, crumbsMade: 0, nextCrumb: .15, nextBunny: 3.2, rng
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
function spawnBunny(game) {
  const direction = game.rng() < .5 ? 1 : -1;
  game.items.push({ id: ++game.serial, kind: 'bunny', x: direction > 0 ? -18 : 338,
    z: 10, vx: direction * (game.gentle ? 64 : 94 + game.time), age: 0, dodged: false });
  game.nextBunny += game.gentle ? 5 : 3.8;
}

function step(game, input, dt, events) {
  game.time = Math.min(CHASE_SECONDS, game.time + dt);
  const p = game.player, previousZ = p.z;
  p.invincible = Math.max(0, p.invincible - dt);
  let dx = clamp(Number(input.axis) || 0, -1, 1) * 178 * dt;
  if (!dx && Number.isFinite(input.targetX)) dx = clamp(input.targetX - p.x, -178 * dt, 178 * dt);
  p.x = clamp(p.x + dx, 26, 294); p.moving = Math.abs(dx) > .01;
  if (p.moving) p.direction = dx < 0 ? -1 : 1;
  if (p.z > 0 || p.vy > 0) {
    p.vy -= (game.wings ? 550 : 900) * dt;
    p.z = Math.max(0, p.z + p.vy * dt);
    if (!p.z) { p.vy = 0; if (previousZ > 0) events.push({ type: 'land' }); }
  }
  while (game.time >= game.nextCrumb && game.time < CHASE_SECONDS - 1.8) spawnCrumb(game);
  if (game.time >= game.nextBunny && game.time < CHASE_SECONDS - 2) spawnBunny(game);
  for (const item of game.items) {
    item.age += dt;
    if (item.kind === 'crumb') {
      if (!item.gold || item.age > 1.2) {
        item.vy -= 225 * dt; item.z = Math.max(10, item.z + item.vy * dt);
      }
      if (item.z === 10) item.floorTime += dt;
      const distance = Math.hypot(item.x - p.x, item.z - (p.z + 27));
      if (game.halo && distance < 70) item.x += (p.x - item.x) * Math.min(1, dt * 3);
      if (Math.abs(item.x - p.x) < (game.halo ? 37 : game.gentle ? 32 : 26) && Math.abs(item.z - p.z - 27) < 30) {
        game.caught++; game.combo++;
        const air = p.z > 15;
        const points = (item.gold ? 30 : 10) * Math.min(3, 1 + Math.floor(game.combo / 4)) + (air ? 5 : 0);
        game.score += points; if (air) game.airCatches++;
        item.remove = true; events.push({ type: 'catch', points, air, gold: item.gold, x: item.x, z: item.z });
      } else if (item.floorTime > (game.gentle ? 2.3 : 1.4)) { item.remove = true; game.combo = 0; }
    } else {
      item.x += item.vx * dt;
      if (Math.abs(item.x - p.x) < 29) {
        if (p.z > 24 && !item.dodged) {
          item.dodged = true; game.dodged++; game.score += 15;
          events.push({ type: 'dodge', points: 15 });
        } else if (p.z <= 24 && !p.invincible && !item.dodged) {
          item.remove = true; p.invincible = .85;
          if (game.shield) { game.shield--; events.push({ type: 'shield' }); }
          else {
            game.bumps++; game.combo = 0; game.score = Math.max(0, game.score - 5);
            p.x = clamp(p.x + Math.sign(item.vx) * 14, 26, 294);
            events.push({ type: 'bump' });
          }
        }
      }
      if (item.x < -35 || item.x > 355) item.remove = true;
    }
  }
  game.items = game.items.filter(x => !x.remove);
  if (game.time >= CHASE_SECONDS) {
    game.finished = true; game.complete = game.caught >= game.goal;
    events.push({ type: 'finish', won: game.complete });
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

export function recordChase(pet, game, now = Date.now()) {
  if (!game.finished || game.petId !== pet.id) return false;
  if (!pet.chaseBest || game.score > pet.chaseBest.score) {
    pet.chaseBest = { score: game.score, caught: game.caught, dodged: game.dodged, at: now }; return true;
  }
  return false;
}
