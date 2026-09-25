import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { EMERGENCIES, CURIOS, RANKS, OMENS, CHORES, RARITIES } from '../src/content/mayhem.js';
import { normalizeMayhem, blankMayhem } from '../src/mayhem-state.js';
import {
  accrueMayhem, resolveEmergency, describeEmergency, openCoffin, drawOmen, omenPending, todaysOmen, deed, ensureChores,
  rankIndexFor, addSouls, rollCurio, EMERGENCY_EVERY_MS, COFFIN_COST, queueCap, pokeDrawer, POKE_COST, fill
} from '../src/engine/mayhem.js';
import { careFor, doRounds } from '../src/engine/care.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
function household(count = 3) {
  const s = blankState();
  s.started = NOW - 86400000; s.lastTick = NOW;
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 'm' + i, name: ['Agnes', 'Pip', 'Oswald', 'Gnasher'][i], traits: ['damp'], needs: { food: 40, fuss: 40, clean: 40 }, bond: 3, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('every emergency is well formed, fits its cast and ships a known glyph', () => {
  const ids = new Set();
  for (const e of EMERGENCIES) {
    assert.ok(!ids.has(e.id), 'duplicate emergency ' + e.id); ids.add(e.id);
    assert.ok(GLYPH_NAMES.includes(e.art), e.id + ' uses an unknown glyph ' + e.art);
    assert.equal(e.choices.length, 2, e.id + ' needs two choices');
    const all = [e.title, ...e.choices.flatMap(c => [c.label, ...c.outcomes.map(o => o.text)])];
    if (!e.pair) assert.ok(all.every(t => !t.includes('{b}')), e.id + ' mentions {b} without a pair');
    for (const c of e.choices) {
      assert.ok(c.outcomes.length >= 2, e.id + ' choice needs at least two outcomes');
      for (const o of c.outcomes) {
        assert.ok(['good', 'bad', 'weird'].includes(o.tone));
        assert.ok(o.stamp && o.stamp.length <= 16, e.id + ' stamp too long: ' + o.stamp);
        assert.ok(o.souls > 0 && o.souls <= 40);
        assert.ok(o.text.length <= 280, e.id + ' outcome over budget');
        if (o.grudge === 'b' || o.b) assert.ok(e.pair, e.id + ' affects {b} without a pair');
      }
    }
  }
  assert.ok(EMERGENCIES.length >= 40);
});

test('curios, ranks, omens and chores are consistent', () => {
  const rarities = new Set(RARITIES.map(r => r.id));
  assert.equal(new Set(CURIOS.map(c => c.id)).size, CURIOS.length);
  for (const c of CURIOS) { assert.ok(rarities.has(c.rarity)); assert.ok(GLYPH_NAMES.includes(c.glyph), c.id); }
  for (const r of RARITIES) assert.ok(CURIOS.some(c => c.rarity === r.id), 'no curio of rarity ' + r.id);
  RANKS.forEach((rank, i) => { if (i) assert.ok(rank.at > RANKS[i - 1].at); });
  assert.ok(OMENS.length >= 7);
  assert.ok(CHORES.length >= 6);
});

test('a new household starts with two emergencies, then one arrives on the clock up to the cap', () => {
  const s = household();
  assert.equal(accrueMayhem(s, NOW, seq([0.1, 0.5, 0.9])), 2);
  assert.equal(s.mayhem.queue.length, 2);
  assert.equal(accrueMayhem(s, NOW + EMERGENCY_EVERY_MS - 1), 0);
  assert.equal(accrueMayhem(s, NOW + EMERGENCY_EVERY_MS), 1);
  // A long absence fills the tray but never overflows it or banks a backlog.
  accrueMayhem(s, NOW + 50 * EMERGENCY_EVERY_MS);
  assert.equal(s.mayhem.queue.length, queueCap(s, NOW));
  assert.ok(s.mayhem.nextAt > NOW + 50 * EMERGENCY_EVERY_MS);
  assert.equal(new Set(s.mayhem.queue.map(q => q.id)).size, s.mayhem.queue.length, 'no duplicate cards in the tray');
});

test('an empty shelf has no emergencies and a solo shelf never draws a pair card', () => {
  const empty = household(0);
  assert.equal(accrueMayhem(empty, NOW), 0);
  const solo = household(1);
  for (let i = 0; i < 30; i++) { accrueMayhem(solo, NOW + i * EMERGENCY_EVERY_MS); solo.mayhem.queue.length = 0; }
  assert.ok(solo.mayhem.recent.every(id => !EMERGENCIES.find(e => e.id === id).pair));
});

test('resolving an emergency pays souls, files the report and advances mayhem chores', () => {
  const s = household();
  accrueMayhem(s, NOW, () => 0);
  const entry = s.mayhem.queue[0];
  const info = describeEmergency(s, entry);
  assert.ok(info.title.includes(s.pets.find(p => p.id === entry.a).name));
  const before = s.notes.length;
  const result = resolveEmergency(s, entry.uid, 0, NOW, () => 0.99);
  assert.ok(result.souls > 0);
  assert.equal(s.mayhem.souls, result.souls + (result.curio?.refund || 0));
  assert.equal(s.mayhem.lifetime, s.mayhem.souls);
  assert.equal(s.mayhem.resolved, 1);
  assert.equal(s.notes.length, before + 1);
  assert.equal(s.notes[0].from, 'the incident report');
  assert.ok(!s.mayhem.queue.some(q => q.uid === entry.uid));
  assert.equal(resolveEmergency(s, entry.uid, 0, NOW), null, 'a card resolves once');
});

test('a rehomed resident takes their emergencies with them', () => {
  const s = household(2);
  accrueMayhem(s, NOW);
  const victim = s.mayhem.queue[0].a;
  s.pets = s.pets.filter(p => p.id !== victim);
  accrueMayhem(s, NOW + 1000);
  assert.ok(s.mayhem.queue.every(q => q.a !== victim && q.b !== victim));
});

test('coffins cost souls, always hold a curio and refund duplicates', () => {
  const s = household();
  assert.equal(openCoffin(s, NOW), null);
  addSouls(s, COFFIN_COST * 3);
  const first = openCoffin(s, NOW, () => 0);
  assert.ok(first.curio && !first.duplicate);
  assert.equal(s.mayhem.souls, COFFIN_COST * 2);
  const again = openCoffin(s, NOW, () => 0);
  assert.ok(again.duplicate || again.curio.id !== first.curio.id);
  const roll = rollCurio(s, () => 0);
  if (roll.duplicate) assert.ok(roll.refund > 0);
});

test('the omen arrives once a night, pays more for consecutive nights and can halve coffins', () => {
  const s = household();
  assert.ok(omenPending(s, NOW));
  const one = drawOmen(s, NOW, () => 0);
  assert.equal(one.streak, 1);
  assert.equal(drawOmen(s, NOW + 1000), null);
  assert.ok(!omenPending(s, NOW + 1000));
  const two = drawOmen(s, NOW + 86400000, () => 0.1);
  assert.equal(two.streak, 2);
  assert.ok(two.gift > one.gift);
  const gap = drawOmen(s, NOW + 4 * 86400000, () => 0.2);
  assert.equal(gap.streak, 1, 'a missed night restarts the count without taking anything away');
  assert.ok(todaysOmen(s, NOW + 4 * 86400000));
});

test('chores count real care, rounds and emergencies, and all three pay a curio', () => {
  const s = household();
  s.mayhem.chores = { day: localDayKey(NOW), list: [{ id: 'feed', have: 0, done: false }, { id: 'rounds', have: 0, done: false }, { id: 'mayhem', have: 0, done: false }], bonus: false };
  s.pets.forEach(p => careFor(s, p, 'food', NOW));
  assert.ok(s.mayhem.chores.list[0].done);
  doRounds(s, NOW);
  assert.ok(s.mayhem.chores.list[1].done);
  deed(s, 'mayhem', 2, NOW);
  assert.ok(s.mayhem.chores.list[2].done);
  assert.equal(s.mayhem.chores.bonus, true);
  assert.ok(Object.keys(s.mayhem.curios).length >= 1);
  // A new day brings three new chores.
  const tomorrow = ensureChores(s, NOW + 86400000);
  assert.equal(tomorrow.list.length, 3);
  assert.ok(tomorrow.list.every(c => !c.done));
});

test('care pays a couple of souls; lifetime souls set the rank', () => {
  const s = household();
  const r = careFor(s, s.pets[0], 'fuss', NOW);
  assert.ok(r.souls > 0);
  assert.equal(rankIndexFor(0), 0);
  assert.equal(rankIndexFor(RANKS[3].at), 3);
  const up = addSouls(s, RANKS[2].at);
  assert.ok(up && up.index >= 2);
});

test('poking the drawer costs more than it usually pays', () => {
  const s = household();
  accrueMayhem(s, NOW);
  s.mayhem.queue.length = 0;
  assert.equal(pokeDrawer(s, NOW), null);
  addSouls(s, POKE_COST);
  assert.ok(pokeDrawer(s, NOW));
  assert.equal(s.mayhem.souls, 0);
  const average = EMERGENCIES.flatMap(e => e.choices.flatMap(c => c.outcomes.map(o => o.souls))).reduce((a, b, _, all) => a + b / all.length, 0);
  assert.ok(average < POKE_COST);
});

test('names are substituted and saves survive hostile or old data', () => {
  assert.equal(fill('{a} bit {b}.', { name: 'Pip' }, { name: 'Agnes' }), 'Pip bit Agnes.');
  const s = household();
  accrueMayhem(s, NOW);
  addSouls(s, 90);
  const restored = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.mayhem.souls, 90);
  assert.equal(restored.mayhem.queue.length, 2);
  const hostile = normalizeMayhem({ souls: -5, lifetime: 'x', queue: [{ id: 'nope', a: 'm0' }, { id: 'will', a: 'ghost' }], curios: { __proto__: 3, 'monkey-paw': 2, fake: 9 }, chores: { list: [{ id: 'feed', have: 99 }] } }, s, NOW);
  assert.equal(hostile.souls, 0);
  assert.equal(hostile.queue.length, 0);
  assert.deepEqual(Object.keys(hostile.curios), ['monkey-paw']);
  assert.deepEqual(normalizeMayhem(null, s, NOW), blankMayhem());
  const legacy = normalizeState({ pets: [], slots: [] });
  assert.ok(legacy.mayhem && legacy.mayhem.souls === 0);
});

test('Crumb Chase achievements count the Midnight Run campaign records', async () => {
  const { ACHIEVEMENTS, bestChaseStars } = await import('../src/engine/achievements.js');
  const s = household(1);
  const win = ACHIEVEMENTS.find(a => a.id === 'chase-win'), perfect = ACHIEVEMENTS.find(a => a.id === 'chase-perfect');
  assert.equal(win.check(s), false);
  s.pets[0].chaseCampaign = { version: 1, unlocked: 2, records: { 'first-crumbs': { won: true, score: 4, stars: 3, attempts: 1, at: NOW, rewarded: true } } };
  assert.equal(bestChaseStars(s.pets[0]), 3);
  assert.equal(win.check(s), true);
  assert.equal(perfect.check(s), true);
  s.pets[0].chaseCampaign.records['first-crumbs'].won = false;
  assert.equal(win.check(s), false, 'an unfinished stage is not a win');
});
