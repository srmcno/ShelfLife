import { RUG_TRICKS, normalizeRug, rugProgress } from '../play-rug-state.js';
import { awardDiscovery, recordScene } from './life.js';

export { RUG_TRICKS, rugProgress };
export const RUG_WORLD = Object.freeze({ width: 1000, height: 600, ground: 490 });
export const RUG_GRAVITY = 1020;
export const RUG_STEP = 1 / 60;
export const RUG_LIMITS = Object.freeze({ balls: 3, bubbles: 12, foregroundGap: 2 });

const PET_RADIUS = 58, PET_CENTER = 67, PET_GRAVITY = 1300, PET_JUMP = 620;
const sessions = new WeakMap(), issued = new WeakMap(), consumed = new WeakSet();
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
let serial = 0;

function session(game) { return game && typeof game === 'object' ? sessions.get(game) : null; }
function emit(game, events, type, details = {}) {
  const meta = session(game);
  const event = Object.freeze({ ...details, type, id: game.sessionId + ':event:' + ++meta.event,
    sessionId: game.sessionId, petId: meta.petId, time: game.time });
  issued.set(event, { petId: meta.petId, sessionId: game.sessionId, trickId: type === 'trick' ? details.trickId : null });
  events.push(event);
  return event;
}
function trick(game, events, id, at) {
  const meta = session(game);
  if (meta.tricks.has(id)) return;
  meta.tricks.add(id);
  emit(game, events, 'trick', { trickId: id, x: at.x, y: at.y });
}

export function createRug(resident) {
  if (!resident || typeof resident.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(resident.id)
    || ['__proto__', 'prototype', 'constructor'].includes(resident.id)) return null;
  const seed = [...resident.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
  const game = { version: 1, sessionId: 'rug-' + ++serial, time: 0,
    pet: { id: resident.id, x: 500, y: RUG_WORLD.ground, vx: 0, vy: 0, facing: 1, pose: 'idle' },
    balls: [], bubbles: [], catches: 0, pops: 0, misses: 0, recoveries: 0, fumbles: 0, refusals: 0 };
  sessions.set(game, { petId: resident.id, seed, toy: 0, event: 0, ticks: 0, accumulator: 0,
    traits: resident.traits || [], radius: 36, reaction: (resident.traits || []).some(t => ['suspicious','witness','auditor'].includes(t)) ? .42 : .22,
    maxSpeed: (resident.traits || []).some(t => ['feral','bitey'].includes(t)) ? 370 : 310, targetId: null, readyAt: 0, poseUntil: 0,
    tricks: new Set(), jumpAt: 0, bubbleAt: 0, celebrateUntil: 0, poppedAt: [] });
  return game;
}

// Positions are virtual pixels and velocities are pixels per second. Invalid
// input does nothing; valid extreme input is clipped to this little room.
export function tossBall(game, options = {}) {
  const meta = session(game);
  if (!meta || !options || typeof options !== 'object' || Array.isArray(options)) return null;
  const { x = game.pet.x - 180, y = 360, vx = 260, vy = -570 } = options;
  if (![x, y, vx, vy].every(finite)) return null;
  const r = meta.radius;
  const ball = { id: game.sessionId + ':ball:' + ++meta.toy, x: clamp(x, r, RUG_WORLD.width - r),
    y: clamp(y, r, RUG_WORLD.ground - r), vx: clamp(vx, -1450, 1450), vy: clamp(vy, -1500, 1000),
    r, radius: r, rotation: 0, age: 0, bounces: 0, state: 'flying', born: game.time,
    allowedBounces: vy > 200 ? 2 : 1, refusal: meta.traits.some(t => ['narcissist','theatrical','spiteful'].includes(t)) && game.balls.some(b => b.age < 1.1) };
  if (game.balls.length >= RUG_LIMITS.balls) return null;
  game.balls.push(ball);
  return ball;
}

// Keyboard and touch presets share the actual toss path. They adapt to where
// the resident has run, so an accessible throw is useful anywhere on the rug.
export function tossPreset(game, kind = 'soft') {
  if (!session(game) || !['soft', 'high', 'bounce', 'long'].includes(kind)) return null;
  const direction = game.pet.x > RUG_WORLD.width / 2 ? 1 : -1;
  const x = clamp(game.pet.x - direction * 190, 25, RUG_WORLD.width - 25);
  if (kind === 'long') return tossBall(game, {x: game.pet.x > 500 ? 100 : 900, y: 320, vx: direction * 500, vy: -480});
  if (kind === 'high') return tossBall(game, { x, y: 380, vx: direction * 190, vy: -790 });
  if (kind === 'bounce') return tossBall(game, { x, y: 320, vx: direction * 230, vy: 460 });
  return tossBall(game, { x, y: 370, vx: direction * 230, vy: -200 });
}

export function spawnBubbles(game, options = {}) {
  const meta = session(game);
  if (!meta || !options || typeof options !== 'object' || Array.isArray(options)) return [];
  const { x = game.pet.x, y = 320, count = 5 } = options;
  if (![x, y, count].every(finite) || count < 1) return [];
  const amount = clamp(Math.floor(count), 1, RUG_LIMITS.bubbles), fresh = [];
  for (let index = 0; index < amount; index++) {
    const number = ++meta.toy, phase = ((meta.seed + number * 137) % 628) / 100;
    const r = 22 + number % 4 * 3;
    const bubble = { id: game.sessionId + ':bubble:' + number,
      x: clamp(x + (index - (amount - 1) / 2) * 62, r, RUG_WORLD.width - r),
      y: clamp(y + (index % 2) * 28, r, RUG_WORLD.ground - r), r, radius: r,
      vx: Math.sin(phase) * 14, vy: -30 - number % 4 * 6, phase, age: 0 };
    if (game.bubbles.length >= RUG_LIMITS.bubbles) game.bubbles.shift();
    game.bubbles.push(bubble); fresh.push(bubble);
  }
  return fresh;
}

function burst(game, bubble, actor, events) {
  const index = game.bubbles.indexOf(bubble);
  if (index < 0) return;
  game.bubbles.splice(index, 1); game.pops++;
  const meta = session(game);
  emit(game, events, 'pop', { bubbleId: bubble.id, actor, x: bubble.x, y: bubble.y, r: bubble.r });
  trick(game, events, 'first-bubble', bubble);
  if (actor === 'player') {
    meta.poppedAt = meta.poppedAt.filter(at => game.time - at <= 1.5);
    meta.poppedAt.push(game.time);
    if (meta.poppedAt.length > 3) meta.poppedAt.shift();
    if (meta.poppedAt.length >= 3) trick(game, events, 'group-burst', bubble);
  }
  meta.celebrateUntil = game.time + .3;
}

export function popBubble(game, id) {
  if (!session(game) || typeof id !== 'string') return [];
  const bubble = game.bubbles.find(item => item.id === id), events = [];
  if (bubble) burst(game, bubble, 'player', events);
  return events;
}

// The same radius drives rendering, contact and walls, including on narrow phones.
export function setRugViewport(game, width) {
  const meta = session(game);
  if (!meta || !finite(width) || width <= 0) return false;
  meta.radius = clamp(16000 / width, 22, 60);
  for (const ball of game.balls) { ball.r = ball.radius = meta.radius; ball.x = clamp(ball.x, ball.r, 1000-ball.r); ball.y = clamp(ball.y, ball.r, RUG_WORLD.ground-ball.r); }
  return true;
}
function settleMiss(game, ball, events, reason) {
  if (!['flying','dropped'].includes(ball.state)) return;
  ball.state = 'missed'; ball.resolvedAt = game.time; game.misses++;
  session(game).poseUntil = game.time + .85; session(game).outcomePose = 'miss';
  emit(game, events, 'miss', { ballId: ball.id, x: ball.x, y: ball.y, reason });
}
function advanceBall(game, ball, events) {
  ball.age += RUG_STEP;
  if (ball.refusal && !ball.refusalShown) {
    ball.refusalShown = true; ball.state = 'refused'; ball.resolvedAt = game.time;
    game.refusals++; session(game).poseUntil = game.time + 1; session(game).outcomePose = 'refuse';
    emit(game, events, 'refuse', {ballId:ball.id,x:ball.x,y:ball.y,reason:'Give it room to finish the previous throw.'});
  }
  if (ball.state === 'held') {
    ball.x = clamp(game.pet.x + game.pet.facing * 34,ball.r,1000-ball.r);
    ball.y = clamp(game.pet.y - 105,ball.r,RUG_WORLD.ground-ball.r);
    if (game.time < ball.heldUntil) return;
    ball.state = 'returned'; ball.resolvedAt = game.time; ball.vx = -game.pet.facing * 280; ball.vy = -290;
    emit(game,events,'return',{ballId:ball.id,x:ball.x,y:ball.y});
  }
  ball.vy += RUG_GRAVITY * RUG_STEP;
  ball.x += ball.vx * RUG_STEP; ball.y += ball.vy * RUG_STEP;
  ball.rotation += ball.vx * RUG_STEP / ball.r;
  if (ball.x < ball.r || ball.x > RUG_WORLD.width - ball.r) {
    ball.x = clamp(ball.x, ball.r, RUG_WORLD.width - ball.r); ball.vx *= -.72;
  }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * .7; }
  if (ball.y >= RUG_WORLD.ground - ball.r) {
    ball.y = RUG_WORLD.ground - ball.r;
    if (ball.vy > 100) {
      ball.bounces++;
      emit(game, events, 'bounce', { ballId: ball.id, x: ball.x, y: ball.y, bounces: ball.bounces });
      ball.vy *= -.62; ball.vx *= .8;
    } else { ball.vy = 0; ball.vx *= .94; }
    if (ball.bounces >= ball.allowedBounces || ball.age > 2.6) settleMiss(game,ball,events,'The ball landed beyond its reach.');
  }
  if (ball.age > 5.5) settleMiss(game,ball,events,'Too late to intercept.');
}

function targetFor(game) {
  const pet = game.pet;
  const choices = [...game.balls.filter(ball => ['flying','dropped'].includes(ball.state) && !ball.refusal).map(ball => ({ toy: ball, ball: true })),
    ...game.bubbles.filter(bubble => bubble.y > RUG_WORLD.ground - 260).map(bubble => ({ toy: bubble, ball: false }))];
  choices.sort((a, b) => (Math.abs(a.toy.x - pet.x) + Math.max(0, pet.y - PET_CENTER - a.toy.y) * .35)
    - (Math.abs(b.toy.x - pet.x) + Math.max(0, pet.y - PET_CENTER - b.toy.y) * .35));
  return choices[0] || null;
}

function step(game, events) {
  const meta = session(game), pet = game.pet;
  game.time = ++meta.ticks * RUG_STEP;
  game.balls.forEach(ball => advanceBall(game, ball, events));
  game.balls = game.balls.filter(ball => ball.age < 12 && (ball.resolvedAt === undefined || game.time - ball.resolvedAt < 3));
  game.bubbles.forEach(bubble => {
    bubble.age += RUG_STEP;
    bubble.vx = Math.sin(game.time * 1.6 + bubble.phase) * 22;
    bubble.x = clamp(bubble.x + bubble.vx * RUG_STEP, bubble.r, RUG_WORLD.width - bubble.r);
    bubble.y += bubble.vy * RUG_STEP;
  });
  game.bubbles = game.bubbles.filter(bubble => bubble.age < 14 && bubble.y + bubble.r > 0);

  const holding = game.balls.some(ball => ball.state === 'held');
  const choice = holding ? null : targetFor(game);
  if (choice?.toy.id !== meta.targetId) { meta.targetId = choice?.toy.id; meta.readyAt = game.time + meta.reaction; }
  const target = game.time >= meta.readyAt ? choice : null;
  const targetX = target ? clamp(target.toy.x + (target.ball ? target.toy.vx * .12 : 0), 65, RUG_WORLD.width - 65) : pet.x;
  const dx = targetX - pet.x;
  const wanted = target && Math.abs(dx) > 12 ? Math.sign(dx) * Math.min(meta.maxSpeed, Math.abs(dx) * 4) : 0;
  pet.vx += clamp(wanted - pet.vx, -850 * RUG_STEP, 850 * RUG_STEP);
  pet.x = clamp(pet.x + pet.vx * RUG_STEP, 65, RUG_WORLD.width - 65);
  if (Math.abs(pet.vx) > 8) pet.facing = Math.sign(pet.vx);
  if (target && pet.y >= RUG_WORLD.ground && game.time >= meta.jumpAt
    && target.toy.y > RUG_WORLD.ground - 280 && target.toy.y < RUG_WORLD.ground - 150
    && Math.abs(target.toy.x - pet.x) < 135 && (!target.ball || target.toy.vy > -70)) {
    pet.vy = -PET_JUMP; meta.jumpAt = game.time + 1.1;
    emit(game, events, 'jump', { x: pet.x, y: pet.y });
  }
  pet.vy += PET_GRAVITY * RUG_STEP;
  pet.y = Math.min(RUG_WORLD.ground, pet.y + pet.vy * RUG_STEP);
  if (pet.y === RUG_WORLD.ground) pet.vy = 0;
  pet.pose = holding ? 'hold' : game.time < meta.poseUntil ? meta.outcomePose : pet.y < RUG_WORLD.ground - 1 ? 'jump' : game.time < meta.celebrateUntil ? 'happy' : Math.abs(pet.vx) > 22 ? 'run' : 'idle';

  const touching = toy => Math.hypot(toy.x - pet.x, toy.y - (pet.y - PET_CENTER)) < PET_RADIUS + toy.r;
  for (const ball of game.balls) {
    if (holding || ball.refusal || !['flying','dropped'].includes(ball.state) || ball.age < meta.reaction || game.time < meta.readyAt || game.time < (ball.contactAfter || 0)) continue;
    // A small hand/mouth region, not the entire resident silhouette.
    const handX = pet.x + pet.facing * 28, handY = pet.y - 105;
    const distance = Math.hypot(ball.x - handX, ball.y - handY);
    if (distance > ball.r + 24) continue;
    const relativeSpeed = Math.hypot(ball.vx - pet.vx, ball.vy - pet.vy);
    const grip = meta.traits.some(t=>['feral','bitey'].includes(t)) ? 770 : 650;
    if (relativeSpeed > grip) {
      if (ball.state === 'dropped') { settleMiss(game,ball,events,'The rebound escaped its hands.'); continue; }
      ball.state = 'dropped'; ball.contactAfter = game.time + .3; ball.vx *= .36; ball.vy = -260; game.fumbles++;
      meta.poseUntil = game.time + .45; meta.outcomePose = 'fumble';
      emit(game,events,'fumble',{ballId:ball.id,x:ball.x,y:ball.y,reason:'Fast or off-centre contact knocked it loose.'}); continue;
    }
    const recovered = ball.state === 'dropped';
    ball.state = 'held'; ball.heldUntil = game.time + 1.15; ball.vx=0; ball.vy=0; game.catches++;
    if (recovered) { game.recoveries++; emit(game,events,'recover',{ballId:ball.id,x:ball.x,y:ball.y}); }
    emit(game, events, 'catch', { ballId: ball.id, x: ball.x, y: ball.y, bounces: ball.bounces, catches: game.catches, recovered,
      high: ball.y < RUG_WORLD.ground - 170 && pet.y < RUG_WORLD.ground - 45 });
    trick(game, events, 'first-catch', ball);
    if (ball.y < RUG_WORLD.ground - 170 && pet.y < RUG_WORLD.ground - 45) trick(game, events, 'high-catch', ball);
    if (ball.bounces > 0) trick(game, events, 'bounce-catch', ball);
    if (game.catches >= 5) trick(game, events, 'five-catches', ball);
    meta.celebrateUntil = game.time + .7;
    break;
  }
  // Leave room for the player's fingers. A resident investigates one bubble
  // at a time rather than swallowing an entire freshly blown party at once.
  if (game.time >= meta.bubbleAt) {
    const bubble = game.bubbles.find(item => item.age >= .4 && touching(item));
    if (bubble) { burst(game, bubble, 'resident', events); meta.bubbleAt = game.time + .6; }
  }
}

// The UI can pause on visibility/modal changes before another frame arrives.
// Leave the physical scene exactly as it was, but end the quick-pop gesture.
export function pauseRug(game) {
  const meta = session(game);
  if (!meta) return false;
  meta.accumulator = 0; meta.poppedAt = [];
  return true;
}

// Integrate only whole 60 Hz steps. A background/stalled frame resets the
// remainder and advances nothing; wall time never silently wins a trick.
export function updateRug(game, dt) {
  const meta = session(game);
  if (!meta || !finite(dt) || dt < 0) return [];
  if (dt > RUG_LIMITS.foregroundGap) { pauseRug(game); return []; }
  meta.accumulator += dt;
  const events = [], steps = Math.floor((meta.accumulator + 1e-10) / RUG_STEP);
  meta.accumulator = Math.max(0, meta.accumulator - steps * RUG_STEP);
  for (let index = 0; index < steps; index++) step(game, events);
  return events;
}

// Only immutable receipts issued by this live simulation can earn a moment.
// JSON copies, invented events, another resident's receipts, and duplicate
// callbacks cannot mint discoveries. The saved trick set handles later visits.
export function recordRugEvents(state, petId, events, now = Date.now()) {
  if (!state || !Array.isArray(state.pets) || !Array.isArray(events) || !events.length || !finite(now) || now < 0) return [];
  const pet = state.pets.slice(0, 18).find(item => item?.id === petId);
  if (!pet) return [];
  const journal = normalizeRug(state.rug, state, now), found = [];
  let entry = journal.residents.find(item => item.petId === petId);
  for (const event of events.slice(0, 128)) {
    const receipt = event && typeof event === 'object' ? issued.get(event) : null;
    if (!receipt || receipt.petId !== petId || !receipt.trickId || consumed.has(event)) continue;
    const definition = RUG_TRICKS.find(item => item.id === receipt.trickId);
    if (!definition) continue;
    consumed.add(event);
    if (entry?.tricks.some(item => item.id === definition.id)) continue;
    if (!entry) { entry = { petId, tricks: [] }; journal.residents.push(entry); }
    entry.tricks.push({ id: definition.id, at: now });
    const discoveryGained = awardDiscovery(state, 'rug:' + petId + ':' + definition.id, 1, now);
    recordScene(state, 'play-rug', definition.label, pet.name + ' ' + definition.line, [petId], now);
    found.push({ ...definition, earned: true, at: now, discoveryGained });
  }
  state.rug = normalizeRug(journal, state, now);
  return found;
}

// Caption priority must never discard another ball's physical catch receipt.
export function countRugChallenge(challenge, events) {
  if (!challenge || challenge.waiting) return false;
  challenge.receipts ||= [];
  let changed = false;
  for (const event of events) {
    if (event.type !== 'catch' || !event.id || challenge.receipts.includes(event.id)) continue;
    challenge.receipts.push(event.id);
    const qualifies = challenge.level === 0 ? !event.recovered : challenge.level === 1 ? event.bounces > 0 : event.high;
    if (qualifies && challenge.count < 3) { challenge.count++; changed = true; }
  }
  return changed;
}
