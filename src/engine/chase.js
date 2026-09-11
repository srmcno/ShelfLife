import { artPersonality } from './personality.js';

export const CHASE_VENUES = { shelf:{name:'The Floorboards',biscuitEvery:9,gravity:1}, pantry:{name:'The Pantry',biscuitEvery:5,gravity:1}, moon:{name:'The Moonlit Sill',biscuitEvery:9,gravity:.72} };
export const chaseRecordKey = game => (game.format === 'run' ? 'run:' : game.venue && game.venue !== 'shelf' ? game.venue+':' : '')+(game.gentle?'gentle':'standard');
export const CHASE_WIDTH = 320;
export const CHASE_HEIGHT = 230;
export const CHASE_GROUND = 20;
// The resident occupies 76 board pixels. Wings plus low gravity and an upgrade
// must not send its face out of the arena while the controls remain active.
export const CHASE_CEILING = CHASE_HEIGHT - CHASE_GROUND - 76;
export const CHASE_SECONDS = 22;
export const RUSH_SECONDS = 4;
export const DASH_SECONDS = .18;
export const DASH_COOLDOWN = 2.4;
export const FINALE_AT = 16.5;
export const FINALE_WARNING_SECONDS = 1.5;
export const FINALE_BONUS = 60;
export const RUN_WAVE_SECONDS = 18;
export const RUN_WAVES = [
  { name: 'The eviction', venue: 'shelf', stat: 'caught', target: 8, gentleTarget: 6, goal: 'crumbs', bonus: 50, intro: 'Breakfast has been evicted. Intercept the tenants.' },
  { name: 'Last supper', venue: 'pantry', stat: 'biscuits', target: 2, gentleTarget: 1, goal: 'whole biscuits', bonus: 75, intro: 'The pantry has opened the family crypt. Catch the biscuits before burial.' },
  { name: 'Above suspicion', venue: 'moon', stat: 'finaleCaught', target: 5, gentleTarget: 3, goal: 'final gold crumbs', bonus: 100, intro: 'Low gravity. One final gold arc. Leave nothing for the coroner.' }
];
export const RUN_UPGRADES = {
  boots: { name: 'Undertaker’s boots', description: 'Dash recharges in 1.35s. Smashing dust or a broom earns 10 extra points.' },
  spring: { name: 'Borrowed kneecaps', description: 'Higher hops. Every airborne catch earns 15 extra points.' },
  salvage: { name: 'Grave robber’s licence', description: 'Grounded crumbs last 1.2s longer and pay 8 extra points when collected from the floor.' }
};
export const chaseDuration = game => game.format === 'run' ? RUN_WAVE_SECONDS * RUN_WAVES.length : CHASE_SECONDS;
export const chaseWaveTime = game => game.format === 'run' ? game.time - game.wave * RUN_WAVE_SECONDS : game.time;
export function chaseWaveContract(game) {
  if (game.format !== 'run') return null;
  const wave = RUN_WAVES[game.wave], target = game.gentle ? wave.gentleTarget : wave.target;
  const progress = Math.max(0, game[wave.stat] - (game.waveBaseline[wave.stat] || 0));
  return { ...wave, target, progress, done: progress >= target };
}
// Intermission is a stopped clock, and choosing an upgrade is an atomic action.
// Closing the dialog never awards a partial run or spends anything from the shelf.
export function advanceChaseWave(game, upgrade) {
  if (!game || game.format !== 'run' || !game.awaitingChoice || game.finished || !RUN_UPGRADES[upgrade] || game.upgrades.includes(upgrade)) return false;
  game.upgrades.push(upgrade); game.wave++; game.awaitingChoice = false;
  game.venue = RUN_WAVES[game.wave].venue;
  game.waveBaseline = { caught: game.caught, biscuits: game.biscuits, finaleCaught: game.finaleCaught };
  game.items = []; game.crumbsMade = 0; game.nextCrumb = .15; game.nextBunny = 3.2;
  game.nextMoth = game.gentle ? 11 : 8; game.nextBiscuit = game.wave === 1 ? 1.2 : 5;
  game.nextSugar = 7; game.nextBroom = 4.5; game.broomsMade = 0;
  game.player.x = 160; game.player.z = 0; game.player.vy = 0;
  game.player.dash = 0; game.player.dashCooldown = 0; game.player.jumpBuffer = 0;
  game.player.invincible = 0; game.rush = 0;
  return true;
}
// Base points. Catches (crumb, gold, moth, biscuit) are multiplied by the streak; the rest are flat.
export const CHASE_POINTS = { crumb: 10, gold: 30, moth: 20, biscuit: 50, stomp: 20, dodge: 15, air: 5, bump: -5 };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const FLOOR = 10;   // resting height of anything on the floorboards
const CHEST = 27;   // the catch box sits this far above the resident's feet

export const CHASE_OBJECTIVES = {
  combo: { stat: 'bestCombo', target: 6, label: 'build a streak of 6' },
  air: { stat: 'airCatches', target: 3, label: 'make 3 airborne catches' },
  biscuit: { stat: 'biscuits', target: 1, label: 'catch a whole biscuit' }
};

export const streakMultiplier = combo => Math.min(3, 1 + Math.floor(combo / 4));

export function chaseCourseRng(seed) {
  let value = Number(seed) >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

// Expose both requirements. A large score alone cannot earn the third star.
export function chaseStarTarget(game) {
  if (game.caught < game.goal) return { stars: 2, crumbs: game.goal - game.caught, points: 0 };
  if (game.format === 'run') {
    const fulfilled = game.waveResults.filter(result => result.bonus > 0).length + (game.waveResults.length <= game.wave && chaseWaveContract(game).done ? 1 : 0);
    return { stars: 3, crumbs: Math.max(0, game.goal + 12 - game.caught), points: Math.max(0, game.goal * 60 - game.score), contracts: 3 - fulfilled };
  }
  return { stars: 3, crumbs: Math.max(0, game.goal + 5 - game.caught), points: Math.max(0, game.goal * 45 - game.score) };
}

export function chaseCoaching(game) {
  if (game.caught < game.goal) return 'Follow the lowest crumbs first. ' + (game.goal - game.caught) + ' more would have reached your goal.';
  if (game.format === 'run') {
    const missed = game.waveResults.find(result => !result.bonus);
    if (missed?.goal === 'whole biscuits') return 'The pantry contract pays for whole biscuits. Watch the slow falling circles and meet them before they touch the floor; each is worth five ordinary crumbs.';
    if (missed?.goal === 'final gold crumbs') return 'The last contract begins at 11.5 seconds in the moon act. Sweep the gold from one edge, hopping across the high centre. You can cross back for anything you missed.';
    const target = chaseStarTarget(game);
    if (!target.crumbs && !target.points && !target.contracts) return 'Three stars and every contract fulfilled. Try different upgrades on the same seed to challenge this score.';
    return 'Three stars need all three contracts, ' + (game.goal + 12) + ' crumbs and ' + (game.goal * 60) + ' points. Choose salvage for floor catches, boots for dust attacks, or kneecaps for airborne points.';
  }
  if (game.bumps >= 2) return 'Watch for the dust warning at either edge. Hop over it or Dash through it; catches recharge your next Dash sooner.';
  if (game.bestCombo < 8) return 'Eight catches in a streak unlock ×3 points. Sweep up grounded crumbs before they disappear.';
  const target = chaseStarTarget(game);
  if (target.crumbs > 0) return 'Your score is growing. Three stars also need ' + (game.goal + 5) + ' crumbs, so keep collecting after the goal.';
  if (target.points > 0) return 'You collected enough for three stars. Biscuits and the final gold sweep can supply the remaining ' + target.points + ' points. Hop, then Dash across the gold arc.';
  return 'Three stars earned. Try another chase ground or challenge to put a different skill to work.';
}

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

export function newChase(pet, { gentle = false, rng = Math.random, seed = null, mood = 'fine', objective = null, venue = 'shelf', format = 'quick' } = {}) {
  const art = artPersonality(pet);
  const temper = temperOf(mood);
  return {
    kind: 'chase', seed, format: format === 'run' ? 'run' : 'quick', venue: format === 'run' ? 'shelf' : CHASE_VENUES[venue] ? venue : 'shelf', petId: pet.id, time: 0, score: 0, caught: 0, combo: 0, bestCombo: 0,
    wave: 0, waveBaseline: { caught: 0, biscuits: 0, finaleCaught: 0 }, waveResults: [], upgrades: [], awaitingChoice: false, nextBroom: 4.5, broomsMade: 0,
    rescued: 0, objective: objective && CHASE_OBJECTIVES[objective] ? { id: objective, ...CHASE_OBJECTIVES[objective], done: false } : null,
    dodged: 0, bumps: 0, airCatches: 0, stomps: 0, moths: 0, stolen: 0, biscuits: 0, powerups: 0,
    dashes: 0, dashSmashes: 0, finaleWarned: false, finaleStarted: false, finaleCaught: 0, finaleComplete: false,
    goal: format === 'run' ? (gentle ? 18 : 22) : gentle ? 6 : 8, complete: false, finished: false, claimed: false, gentle, stars: 0,
    wings: art.motion.canFlap, horns: art.horns, halo: art.halo, tail: art.motion.tails > 0,
    mood, speedScale: temper.speed, grip: temper.grip,
    // Horns are a shield. So, once, is a resident that genuinely trusts you: it
    // will take one knock on your behalf before it starts blaming you for them.
    shield: (art.horns ? 1 : 0) + ((pet.bond || 0) >= 15 ? 1 : 0), rush: 0,
    player: { x: 160, z: 0, vy: 0, direction: 1, moving: false, glided: false, invincible: 0, dash: 0, dashCooldown: 0, jumpBuffer: 0 },
    items: [], serial: 0, crumbsMade: 0, nextCrumb: .15, nextBunny: 3.2,
    nextMoth: gentle ? 11 : 8, nextBiscuit: gentle ? 6 : 5, nextSugar: gentle ? 7 : 8, rng: seed === null ? rng : chaseCourseRng(seed)
  };
}

export function jumpChase(game, { buffer = false } = {}) {
  if (!game || game.finished || game.awaitingChoice) return false;
  const p = game.player;
  if (p.z <= .01) {
    p.vy = (game.wings ? 310 : 325) * (game.upgrades?.includes('spring') ? 1.12 : 1); p.z = .1; p.glided = false; p.jumpBuffer = 0;
    return true;
  }
  if (game.wings && !p.glided && p.vy < 140) {
    p.vy = 225; p.glided = true; p.jumpBuffer = 0; return true;
  }
  // A tap just before landing should become a jump, not disappear. Opt in at
  // the input boundary so simulations that repeatedly call jump keep their pace.
  if (buffer && p.vy < 0 && p.z < 38) p.jumpBuffer = .13;
  return false;
}

export function dashChase(game, direction = 0) {
  if (!game || game.finished || game.awaitingChoice) return false;
  const p = game.player;
  if (p.dash > 0 || p.dashCooldown > 0) return false;
  p.direction = Math.sign(Number(direction)) || p.direction || 1;
  p.dash = DASH_SECONDS; p.dashCooldown = game.upgrades?.includes('boots') ? 1.35 : DASH_COOLDOWN;
  game.dashes++;
  return true;
}

function spawnCrumb(game) {
  const route = [0, 25, -40, 100, -100, 60, -65, 110, -110, 40, -35];
  const n = game.crumbsMade++;
  const gold = n > 2 && n % 5 === 4;
  game.items.push({ id: ++game.serial, kind: 'crumb', gold,
    x: clamp(160 + route[(n + (game.format === 'run' ? (game.wave * 3 + (Number(game.seed) >>> 0) % 3) : 0)) % route.length] + (game.rng() - .5) * 16, 28, 292),
    z: gold ? 100 : 182, vy: -10, age: 0, floorTime: 0 });
  game.nextCrumb += game.gentle ? .9 : .95;
}
// Bunnies arrive faster and closer together as the clock runs down.
function spawnBunny(game) {
  const direction = game.rng() < .5 ? 1 : -1;
  game.items.push({ id: ++game.serial, kind: 'bunny', x: direction > 0 ? -18 : 338,
    z: FLOOR, vx: direction * (game.gentle ? 64 : 90 + chaseWaveTime(game) * 1.6), age: 0, dodged: false, warning: game.gentle ? .65 : .42 });
  game.nextBunny += game.gentle ? Math.max(3.6, 5 - chaseWaveTime(game) * .07) : Math.max(2.4, 3.8 - chaseWaveTime(game) * .07);
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
  game.nextBiscuit += game.format === 'run' && game.wave === 1 ? 4 : CHASE_VENUES[game.venue || 'shelf'].biscuitEvery;
}
// A sugar cube drops on the emptier side of the floor (it has to be gone for), sits three seconds, then melts.
// Touching it starts a sugar rush: faster steering and a crumb magnet for a few seconds.
function spawnSugar(game) {
  const p = game.player, side = p.x < 160 ? 1 : -1;
  game.items.push({ id: ++game.serial, kind: 'sugar', x: clamp(p.x + side * (90 + game.rng() * 90), 40, 280), z: 182, vy: -70, age: 0, floorTime: 0 });
  game.nextSugar += 7.5;
}
// Last call is a visible, optional sweep. Missing these extras never breaks a
// streak: the player can finish their normal goal or commit to the gold arc.
function spawnFinale(game, events) {
  game.finaleStarted = true;
  // The arc follows a normal hop: run up one side, dash across the crest, land
  // at the far end. A stationary resident cannot vacuum up the centre for free.
  for (const [x, z] of [[52, 42], [106, 70], [160, 94], [214, 70], [268, 42]]) {
    game.items.push({ id: ++game.serial, kind: 'crumb', gold: true, finale: true,
      x, z, vy: 0, age: 0, floorTime: 0, expiresAt: chaseDuration(game) });
  }
  events.push({ type: 'finale', count: 5, bonus: FINALE_BONUS });
}
const EARLY = 12;
// For the first EARLY seconds only one hazard type is on screen at a time; the other waits half a second and retries.
const hazardClear = (game, other) => game.time >= EARLY || !game.items.some(i => i.kind === other);
function spawnAll(game, events) {
  const t = chaseWaveTime(game), end = game.format === 'run' ? RUN_WAVE_SECONDS : CHASE_SECONDS;
  while (t >= game.nextCrumb && t < end - 1.8) spawnCrumb(game);
  if (t >= game.nextBunny && t < end - 2) { if (hazardClear(game, 'moth')) spawnBunny(game); else game.nextBunny += .5; }
  if (t >= game.nextMoth && t < end - 3) { if (hazardClear(game, 'bunny')) spawnMoth(game); else game.nextMoth += .5; }
  if (t >= game.nextBiscuit && t < end - 5) spawnBiscuit(game);
  if (t >= game.nextSugar && t < end - 5) spawnSugar(game);
  if (game.format === 'run' && game.wave > 0 && t >= game.nextBroom && t < end - 3) {
    const left = (game.broomsMade++ + (Number(game.seed) >>> 0) % 2) % 2 === 0;
    game.items.push({ id: ++game.serial, kind: 'broom', x: left ? 86 : 234, z: 10, vx: left ? 1 : -1, warning: game.gentle ? 1.6 : 1.2, active: .3, age: 0, resolved: false });
    events.push({ type: 'broomWarning', side: left ? 'left' : 'right' });
    game.nextBroom += game.gentle ? 7 : 6;
  }
}

// Moves the resident and returns where its feet were before the move (stomps need to know).
function stepPlayer(game, input, dt, events) {
  const p = game.player, previousZ = p.z;
  p.invincible = Math.max(0, p.invincible - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (game.rush > 0) { game.rush = Math.max(0, game.rush - dt); if (!game.rush) events.push({ type: 'rushEnd' }); }
  // Mood sets the top speed; grip is how much of a drag-to-steer instruction it
  // actually accepts. A furious creature is faster than you can comfortably aim.
  const speed = (game.rush > 0 ? 236 : 178) * (game.speedScale || 1);
  const grip = game.grip || 1;
  let dx = clamp(Number(input.axis) || 0, -1, 1) * speed * dt;
  if (!dx && Number.isFinite(input.targetX)) dx = clamp((input.targetX - p.x) * grip, -speed * dt, speed * dt);
  if (p.dash > 0) dx = p.direction * 470 * dt;
  p.x = clamp(p.x + dx, 26, 294); p.moving = Math.abs(dx) > .01;
  if (p.moving) p.direction = dx < 0 ? -1 : 1;
  if (p.z > 0 || p.vy > 0) {
    p.vy -= (game.wings ? 550 : 900) * CHASE_VENUES[game.venue || 'shelf'].gravity * dt;
    p.z = clamp(p.z + p.vy * dt, 0, CHASE_CEILING);
    if (p.z === CHASE_CEILING && p.vy > 0) p.vy = 0;
    if (!p.z) {
      p.vy = 0;
      if (previousZ > 0) events.push({ type: 'land', x: p.x });
      if (p.jumpBuffer > 0 && jumpChase(game)) events.push({ type: 'bufferedJump' });
    }
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
  const points = base * streakMultiplier(game.combo) + (air ? CHASE_POINTS.air + (game.upgrades?.includes('spring') ? 15 : 0) : 0)
    + (item.kind === 'crumb' && item.z === FLOOR && game.upgrades?.includes('salvage') ? 8 : 0);
  game.score += points; if (air) game.airCatches++;
  // Good steering buys the next burst sooner; waiting also recharges it fully.
  p.dashCooldown = Math.max(0, p.dashCooldown - .16);
  item.remove = true;
  events.push({ type: 'catch', kind: item.kind, points, air, gold: !!item.gold, finale: !!item.finale, rescued: !!item.carrying, x: item.x, z: item.z, id: item.id });
  if (item.finale) {
    game.finaleCaught++;
    if (game.finaleCaught === 5) {
      game.finaleComplete = true; game.score += FINALE_BONUS;
      events.push({ type: 'finaleComplete', points: FINALE_BONUS });
    }
  }
}

function stepCrumb(game, item, dt, events) {
  const p = game.player;
  if (!item.finale && (!item.gold || item.age > 1.2)) { item.vy -= 225 * dt; item.z = Math.max(FLOOR, item.z + item.vy * dt); }
  if (item.z === FLOOR) item.floorTime += dt;
  const distance = Math.hypot(item.x - p.x, item.z - (p.z + CHEST));
  if ((game.halo || game.rush > 0) && distance < 70) item.x += (p.x - item.x) * Math.min(1, dt * 3);
  if (touching(game, item)) { game.caught++; award(game, item, item.gold ? CHASE_POINTS.gold : CHASE_POINTS.crumb, events); }
  // Leave the advertised final sweep available until the buzzer, including the
  // longer moon act. A missed first pass still leaves time to turn back.
  else if (item.finale && game.time >= item.expiresAt) item.remove = true;
  else if (!item.finale && item.floorTime > (game.gentle ? 2.3 : 1.4) + (game.upgrades?.includes('salvage') ? 1.2 : 0)) {
    item.remove = true;
    // Losing one target trims two catches, instead of erasing the whole run.
    // Dust collisions and moth theft still reward careful play by breaking it.
    game.combo = Math.max(0, game.combo - 2);
    events.push({ type: 'miss', x: item.x, id: item.id, combo: game.combo });
  }
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
  if (game.shield) { const source = game.horns && !game.hornSpent ? 'horns' : 'trust'; game.hornSpent = true; game.shield--; events.push({ type: 'shield', source }); return; }
  const points = Math.max(-game.score, CHASE_POINTS.bump);
  game.bumps++; game.combo = 0; game.score = Math.max(0, game.score + CHASE_POINTS.bump);
  p.x = clamp(p.x + Math.sign(item.vx) * 14, 26, 294);
  events.push({ type: 'bump', x: p.x, loss: -points });
}
function stepBunny(game, item, dt, events, previousZ) {
  const p = game.player;
  if (item.warning > 0) { item.warning = Math.max(0, item.warning - dt); return; }
  item.x += item.vx * dt;
  if (Math.abs(item.x - p.x) < 29) {
    const fromAbove = previousZ > 3 && p.z < previousZ;
    if (p.z <= 24 && p.dash > 0) {
      const points = CHASE_POINTS.stomp + (game.upgrades?.includes('boots') ? 10 : 0);
      item.remove = true; game.dashSmashes++; extendStreak(game); game.score += points;
      events.push({ type: 'dashSmash', points, x: item.x, z: item.z, id: item.id });
    }
    else if (p.z <= 24 && fromAbove) stomp(game, item, events);
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
  if (touching(game, item)) {
    game.moths++;
    if (item.carrying) { game.caught++; game.rescued++; }
    award(game, item, CHASE_POINTS.moth, events);
  }
  else if (item.x < -35 || item.x > 355 || item.z >= 195) item.remove = true;
}

function stepBiscuit(game, item, dt, events) {
  item.z = Math.max(FLOOR, item.z + item.vy * dt);
  if (item.z === FLOOR) { item.remove = true; events.push({ type: 'crumble', x: item.x, id: item.id }); }
  else if (touching(game, item, reachOf(game) + 6)) { game.biscuits++; award(game, item, CHASE_POINTS.biscuit, events); }
}

function stepSugar(game, item, dt, events) {
  item.z = Math.max(FLOOR, item.z + item.vy * dt);
  if (item.z === FLOOR) item.floorTime += dt;
  if (touching(game, item)) {
    item.remove = true; game.powerups++; game.rush = game.gentle ? RUSH_SECONDS + 1 : RUSH_SECONDS;
    events.push({ type: 'powerup', kind: 'sugar', seconds: game.rush, x: item.x, z: item.z, id: item.id });
  } else if (item.floorTime > 3) { item.remove = true; events.push({ type: 'melt', x: item.x, id: item.id }); }
}

function stepBroom(game, item, dt, events) {
  if (item.warning > 0) { item.warning = Math.max(0, item.warning - dt); return; }
  const p = game.player;
  if (!item.resolved && Math.abs(item.x - p.x) < 76) {
    if (p.dash > 0 && p.z <= 30) {
      const points = CHASE_POINTS.stomp + (game.upgrades.includes('boots') ? 10 : 0);
      item.remove = true; game.dashSmashes++; extendStreak(game); game.score += points;
      events.push({ type: 'dashSmash', points, x: item.x, z: item.z, id: item.id });
    } else if (p.z > 30) {
      game.dodged++; game.score += CHASE_POINTS.dodge; events.push({ type: 'dodge', points: CHASE_POINTS.dodge });
    } else if (!p.invincible) {
      collide(game, item, events);
      const hit = events.at(-1); if (hit?.type === 'bump') hit.hazard = 'broom';
    }
    item.resolved = true;
  }
  item.active -= dt; if (item.active <= 0) item.remove = true;
}
const STEPPERS = { crumb: stepCrumb, bunny: stepBunny, moth: stepMoth, biscuit: stepBiscuit, sugar: stepSugar, broom: stepBroom };

function step(game, input, dt, events) {
  const end = game.format === 'run' ? (game.wave + 1) * RUN_WAVE_SECONDS : CHASE_SECONDS;
  game.time = Math.min(end, game.time + dt);
  const previousZ = stepPlayer(game, input, dt, events);
  spawnAll(game, events);
  const finaleAt = game.format === 'run' ? 2 * RUN_WAVE_SECONDS + 11.5 : FINALE_AT;
  if (!game.finaleWarned && game.time >= finaleAt - FINALE_WARNING_SECONDS) {
    game.finaleWarned = true; events.push({ type: 'finaleWarning', seconds: FINALE_WARNING_SECONDS });
  }
  if (!game.finaleStarted && (game.format === 'run' ? game.wave === 2 && chaseWaveTime(game) >= 11.5 : game.time >= FINALE_AT)) spawnFinale(game, events);
  for (const item of game.items) {
    if (item.remove) continue;
    item.age += dt;
    STEPPERS[item.kind]?.(game, item, dt, events, previousZ);
  }
  game.items = game.items.filter(x => !x.remove);
  game.player.dash = Math.max(0, game.player.dash - dt);
  const quest = game.objective;
  if (quest && !quest.done && game[quest.stat] >= quest.target) {
    quest.done = true; game.score += 40; events.push({type:'objective', points:40});
  }
  if (game.time >= end && game.format === 'run') {
    const contract = chaseWaveContract(game);
    if (contract.done) game.score += contract.bonus;
    game.waveResults.push({ name: contract.name, progress: contract.progress, target: contract.target, goal: contract.goal, bonus: contract.done ? contract.bonus : 0 });
    if (game.wave < RUN_WAVES.length - 1) {
      game.awaitingChoice = true;
      events.push({ type: 'intermission', wave: game.wave, contract }); return;
    }
  }
  if (game.time >= chaseDuration(game)) {
    game.finished = true; game.complete = game.caught >= game.goal; game.stars = chaseStars(game);
    events.push({ type: 'finish', won: game.complete, stars: game.stars });
  }
}

// Small physics steps keep catches and jumps consistent at different frame rates.
export function updateChase(game, input = {}, elapsed = 0) {
  const events = [];
  if (!game || game.finished || game.awaitingChoice || !Number.isFinite(elapsed) || elapsed <= 0) return events;
  let remaining = Math.min(.25, elapsed);
  while (remaining > 1e-7 && !game.finished && !game.awaitingChoice) {
    const dt = Math.min(1 / 60, remaining); step(game, input, dt, events); remaining -= dt;
  }
  return events;
}

// One star for turning up, two for the goal, three for the goal with room to spare and a real score.
export function chaseStars(game) {
  if (game.caught < game.goal) return 1;
  if (game.format === 'run') {
    const target = chaseStarTarget(game);
    return !target.crumbs && !target.points && !target.contracts ? 3 : 2;
  }
  return game.caught >= game.goal + 5 && game.score >= game.goal * 45 ? 3 : 2;
}

// A higher score replaces the record; best streak and best star rating only ever climb.
export function recordChase(pet, game, now = Date.now()) {
  if (!game.finished || game.petId !== pet.id) return false;
  pet.chaseRecords ||= {};
  const mode = chaseRecordKey(game), modeBest = pet.chaseRecords[mode];
  const modeStars = Math.max(chaseStars(game), modeBest?.stars || 0);
  if (!modeBest || game.score > modeBest.score) pet.chaseRecords[mode] = { score:game.score, stars:modeStars, at:now };
  else modeBest.stars = modeStars;
  if (game.format === 'run') return !modeBest || game.score > modeBest.score;
  const previous = pet.chaseBest;
  const bestStreak = Math.max(game.bestCombo || 0, previous?.bestStreak || 0);
  const stars = Math.max(chaseStars(game), previous?.stars || 0);
  if (!previous || game.score > previous.score) {
    pet.chaseBest = { score: game.score, caught: game.caught, dodged: game.dodged, at: now, bestStreak, stars }; return true;
  }
  previous.bestStreak = bestStreak; previous.stars = stars;
  return false;
}
