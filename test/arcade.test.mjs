import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { ARCADE_GAMES, ARCADE_QUIPS, FRENZY_ITEMS } from '../src/content/arcade.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import {
  seededRandom, frenzyStart, frenzyStep, stackStart, stackStep, stackDrop, STACK, seanceStart, seanceShown, seanceInput,
  whackStart, whackStep, whackHit, finishRun, tierFor, normalizeArcade, startGame
} from '../src/engine/arcade.js';
import { GAME_SOULS_PER_DAY } from '../src/engine/mayhem.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
function household() {
  const s = blankState();
  s.pets = [{ id: 'g0', name: 'Agnes', traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }];
  s.slots[0] = 'g0';
  return s;
}

test('every game has a catalogue entry, known glyphs and four tiers of jokes', () => {
  for (const g of ARCADE_GAMES) {
    assert.ok(GLYPH_NAMES.includes(g.glyph), g.id);
    assert.equal(ARCADE_QUIPS[g.id].length, 4, g.id);
    assert.ok(ARCADE_QUIPS[g.id].every(pool => pool.length >= 2));
    assert.ok(g.howto.length < 120, g.id + ' instructions must stay one line');
    assert.ok(startGame(g.id, seededRandom(1)));
  }
  for (const item of Object.values(FRENZY_ITEMS)) assert.ok(GLYPH_NAMES.includes(item.glyph));
});

test('Feeding Frenzy scores catches, loses lives to bad things and speeds up', () => {
  const g = frenzyStart(seededRandom(7));
  g.items.push({ id: 90, kind: 'tooth', x: 0.5, y: 0.82, vy: 0 });
  let events = frenzyStep(g, 0.01);
  assert.ok(events.some(e => e.type === 'catch' && e.points === 3));
  assert.equal(g.score, 3);
  g.items.push({ id: 91, kind: 'holy', x: 0.5, y: 0.82, vy: 0 });
  events = frenzyStep(g, 0.01);
  assert.ok(events.some(e => e.type === 'hit'));
  assert.equal(g.lives, 2);
  assert.equal(g.combo, 0);
  // Standing still for long enough always ends the game.
  let t = 0;
  while (!g.over && t < 600) { frenzyStep(g, 1 / 30); t += 1 / 30; }
  assert.ok(g.over, 'an idle player eventually runs out of lives');
});

test('Frenzy movement follows held keys and pointer targets inside the walls', () => {
  const g = frenzyStart(seededRandom(3));
  g.dir = 1; for (let i = 0; i < 60; i++) frenzyStep(g, 1 / 30);
  assert.ok(g.x > 0.9 && g.x <= 0.94);
  g.dir = 0; g.target = 0.2; for (let i = 0; i < 60; i++) frenzyStep(g, 1 / 30);
  assert.ok(Math.abs(g.x - 0.2) < 0.02);
});

test('Coffin Stack trims overhang, rewards perfect drops and ends on a miss', () => {
  const g = stackStart(seededRandom(1));
  const base = g.stack[0];
  g.mover.x = base.x; // perfect
  let r = stackDrop(g);
  assert.ok(r.perfect);
  assert.equal(g.score, 1);
  assert.ok(Math.abs(g.stack[1].w - base.w) < 1e-9);
  g.mover.x = g.stack[1].x + 0.1;
  r = stackDrop(g);
  assert.ok(!r.perfect && r.cut && r.cut.side === 1);
  assert.ok(Math.abs(g.stack[2].w - (base.w - 0.1)) < 1e-9);
  g.mover.x = 0.99 - g.mover.w; g.mover.x = g.stack[2].x + g.stack[2].w + 0.05;
  r = stackDrop(g);
  assert.ok(r.over && g.over);
  const h = stackStart(seededRandom(2));
  for (let i = 0; i < 200; i++) stackStep(h, 1 / 30);
  assert.ok(h.mover.x >= 0 && h.mover.x + h.mover.w <= 1 + 1e-9, 'the mover bounces inside the field');
  assert.ok(STACK.width > 0.3);
});

test('The Séance grows the sequence, forgives one mistake and then ends', () => {
  const g = seanceStart(seededRandom(5));
  assert.equal(seanceInput(g, 0).ignored, true, 'no input while the spirits speak');
  seanceShown(g);
  const r = seanceInput(g, g.seq[0]);
  assert.ok(r.round);
  assert.equal(g.score, 1);
  assert.equal(g.seq.length, 2);
  seanceShown(g);
  const wrong = (g.seq[0] + 1) % 4;
  assert.ok(seanceInput(g, wrong).forgiven);
  assert.equal(g.phase, 'show');
  seanceShown(g);
  assert.ok(seanceInput(g, (g.seq[0] + 1) % 4).over);
  assert.ok(g.over);
});

test('Grave Whack: hands score, the widow and escapes cost lives', () => {
  const g = whackStart(seededRandom(9));
  g.holes[4] = { id: 1, kind: 'hand', age: 0, life: 1 };
  assert.equal(whackHit(g, 4).points, 1);
  g.holes[2] = { id: 2, kind: 'mourner', age: 0, life: 1 };
  assert.ok(whackHit(g, 2).widow);
  assert.equal(g.lives, 2);
  g.holes[0] = { id: 3, kind: 'hand', age: 0, life: 0.1 };
  const events = whackStep(g, 0.2);
  assert.ok(events.some(e => e.type === 'escape'));
  assert.equal(g.lives, 1);
  assert.equal(whackHit(g, 8).empty, true);
  let t = 0; while (!g.over && t < 300) { whackStep(g, 1 / 30); t += 1 / 30; }
  assert.ok(g.over);
});

test('finishing a run pays souls from a daily purse, keeps the best and lifts the resident', () => {
  const s = household();
  const first = finishRun(s, 'frenzy', 30, 'g0', NOW, () => 0);
  assert.ok(first.newBest && first.best === 30);
  assert.ok(first.souls > 0);
  assert.equal(s.mayhem.souls, first.souls);
  assert.ok(first.counted);
  assert.ok(s.pets[0].needs.fuss > 40);
  const worse = finishRun(s, 'frenzy', 10, 'g0', NOW, () => 0);
  assert.equal(worse.newBest, false);
  assert.equal(s.arcade.best.frenzy, 30);
  assert.equal(s.arcade.plays.frenzy, 2);
  const zero = finishRun(s, 'stack', 0, 'g0', NOW, () => 0);
  assert.equal(zero.souls, 0);
  assert.equal(zero.counted, false, 'a warm-up is not a game');
  for (let i = 0; i < 40; i++) finishRun(s, 'whack', 100, 'g0', NOW, () => 0);
  assert.ok(s.mayhem.gameSouls <= GAME_SOULS_PER_DAY);
  assert.equal(tierFor('stack', 30), 3);
  assert.ok(first.quip.includes('Agnes') || first.quip.length > 10);
});

test('arcade records survive reload and hostile data', () => {
  const s = household();
  finishRun(s, 'seance', 9, 'g0', NOW);
  const restored = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.arcade.best.seance, 9);
  assert.deepEqual(normalizeArcade({ best: { frenzy: -3, nope: 5, stack: 'x', whack: 12 }, lastGame: 'court' }), { best: { whack: 12 }, plays: {}, lastGame: '' });
});

test('arcade trust is rationed by the same daily cap as every other bonus', async () => {
  const { BONUS_TRUST_PER_DAY } = await import('../src/state.js');
  const s = household();
  const before = s.pets[0].bond;
  for (let i = 0; i < 10; i++) finishRun(s, 'frenzy', 90, 'g0', NOW, () => 0);
  assert.equal(s.pets[0].bond - before, BONUS_TRUST_PER_DAY);
  assert.equal(s.pets[0].arcadeRuns, 10);
});
