import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBurst, BURSTS, countAt, parseCount, easeOutCubic, arcPoint, HAPTICS, emptyState, loadingState, motionLevel, haptic, CELEBRATIONS } from '../src/ui/fx.js';
import { classifyFrames, nextVerdict, effectsMode, FULL_MEDIAN_MS, FULL_P90_MS } from '../src/ui/effects-model.js';
import { emptyArt, EMPTY_KINDS } from '../src/art/empty-art.js';

const steady = (ms, n = 30) => Array.from({ length: n }, () => ms);
const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

test('every burst kind plans finite, bounded particles and nothing when motion is off', () => {
  for (const kind of Object.keys(BURSTS)) {
    const full = planBurst(kind, 'full', seeded());
    assert.equal(full.length, BURSTS[kind].n, kind);
    for (const p of full) {
      for (const key of ['x', 'y', 'size', 'life', 'delay', 'spin']) assert.ok(Number.isFinite(p[key]), kind + ' ' + key);
      assert.ok(p.size > 0 && p.life > 0 && p.delay >= 0);
      assert.match(p.color, /^#[0-9A-F]{6}$/i);
    }
    const light = planBurst(kind, 'light', seeded());
    assert.ok(light.length >= 4 && light.length < full.length, kind + ' light mode draws fewer');
    assert.deepEqual(planBurst(kind, 'off', seeded()), []);
  }
  assert.equal(planBurst('not-a-kind', 'full', seeded()).length, BURSTS.sparkles.n);
});

test('a burst is repeatable from its random source', () => {
  assert.deepEqual(planBurst('confetti', 'full', seeded()), planBurst('confetti', 'full', seeded()));
});

test('upward bursts go up and rising ones keep rising', () => {
  for (const p of planBurst('confetti', 'full', seeded())) assert.ok(p.y <= 0, 'confetti starts upwards');
  for (const p of planBurst('souls', 'full', seeded())) assert.ok(p.y <= 0 && p.fall < 0, 'souls rise');
});

test('counting runs from the start to the target and never overshoots', () => {
  assert.equal(countAt(10, 50, 0), 10);
  assert.equal(countAt(10, 50, 1), 50);
  assert.equal(countAt(50, 10, 1), 10);
  let last = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) { const n = countAt(0, 240, t); assert.ok(n >= last && n <= 240); last = n; }
  assert.equal(easeOutCubic(2), 1);
  assert.equal(easeOutCubic(-1), 0);
});

test('numbers are read back out of whatever the HUD printed', () => {
  assert.equal(parseCount('240'), 240);
  assert.equal(parseCount('+13 to every need'), 13);
  assert.equal(parseCount('-4'), -4);
  assert.equal(parseCount(''), 0);
  assert.equal(parseCount(null), 0);
});

test('a flight path starts and ends exactly on its endpoints', () => {
  const a = { x: 10, y: 20 }, b = { x: 210, y: -80 };
  assert.deepEqual(arcPoint(a, b, 40, 0), a);
  const end = arcPoint(a, b, 40, 1);
  assert.ok(Math.abs(end.x - b.x) < 1e-9 && Math.abs(end.y - b.y) < 1e-9);
  const mid = arcPoint(a, b, 40, 0.5), straight = arcPoint(a, b, 0, 0.5);
  assert.ok(Math.hypot(mid.x - straight.x, mid.y - straight.y) > 15, 'the bow lifts it off the straight line');
});

test('haptics and motion are inert without a browser', () => {
  assert.equal(motionLevel(), 'off');
  assert.equal(haptic('tick'), false);
  assert.ok(Object.values(HAPTICS).every(p => (Array.isArray(p) ? p : [p]).every(n => n > 0 && n < 60)), 'short, tasteful pulses');
  assert.equal(CELEBRATIONS.curio({ at: null, rarity: 'common' }), undefined);
});

test('empty states are illustrated, escaped, labelled and offer a way forward', () => {
  for (const kind of EMPTY_KINDS) {
    const art = emptyArt(kind);
    assert.match(art, /^<svg class="empty-art"/);
    assert.match(art, /aria-hidden="true"/);
  }
  assert.ok(EMPTY_KINDS.length >= 5);
  const html = emptyState({ kind: 'notes', title: 'Nothing <b>yet</b>', line: 'A "line"', action: { label: 'Check the shelf', attrs: 'id="checkBtn2"' } });
  assert.ok(!html.includes('<b>yet</b>'), 'titles are escaped');
  assert.match(html, /&quot;line&quot;/);
  assert.match(html, /<button class="btn fx-empty-action" type="button" id="checkBtn2">Check the shelf<\/button>/);
  assert.match(html, /fx-empty-notes/);
  assert.ok(!/<button/.test(emptyState({ kind: 'cabinet', title: 'None' })));
  assert.match(loadingState('Knocking.'), /role="status"/);
  assert.equal(emptyArt('unheard-of'), emptyArt('notes'), 'an unknown kind falls back to a drawing');
});

test('the frame benchmark calls steady 60 and 90 Hz Full and a struggling device Light', () => {
  assert.equal(classifyFrames(steady(16.7)), 'full');
  assert.equal(classifyFrames(steady(11.1)), 'full');
  assert.equal(classifyFrames(steady(33.4)), 'light');
  assert.equal(classifyFrames(steady(FULL_MEDIAN_MS)), 'full');
  assert.equal(classifyFrames(steady(FULL_MEDIAN_MS + 1)), 'light');
  // Smooth with the odd hitch is still Full; a stutter every third frame is not.
  const hitch = steady(16.7); hitch[5] = 80; hitch[17] = 90;
  assert.equal(classifyFrames(hitch), 'full');
  const stutter = steady(16.7).map((d, i) => (i % 3 ? d : FULL_P90_MS + 30));
  assert.equal(classifyFrames(stutter), 'light');
  assert.equal(classifyFrames(steady(16.7, 6)), null, 'too few frames to judge');
  assert.equal(classifyFrames([NaN, -1, 0, ...steady(16, 5)]), null);
  assert.equal(classifyFrames(null), null);
});

test('a slow reading is believed at once and a fast one has to be seen twice', () => {
  assert.deepEqual(nextVerdict(null, 'full'), { tier: 'full', up: 0 });
  assert.deepEqual(nextVerdict(null, 'light'), { tier: 'light', up: 0 });
  assert.deepEqual(nextVerdict({ tier: 'full', up: 0 }, 'light'), { tier: 'light', up: 0 });
  let v = nextVerdict({ tier: 'light', up: 0 }, 'full');
  assert.deepEqual(v, { tier: 'light', up: 1 });
  assert.deepEqual(nextVerdict(v, 'full'), { tier: 'full', up: 0 });
  assert.deepEqual(nextVerdict(v, 'light'), { tier: 'light', up: 0 }, 'a relapse resets the count');
  assert.deepEqual(nextVerdict({ tier: 'full', up: 0 }, 'full'), { tier: 'full', up: 0 });
  assert.deepEqual(nextVerdict({ tier: 'full', up: 0 }, 'banana'), { tier: 'full', up: 0 });
  assert.equal(nextVerdict(undefined, null), null);
});

test('Automatic follows the benchmark and the manual choice always wins', () => {
  const phone = { coarse: true, memory: 8, residents: 6 };
  assert.equal(effectsMode({ effects: 'full' }, { ...phone, tier: 'light' }), 'full');
  assert.equal(effectsMode({ effects: 'light' }, { ...phone, tier: 'full' }), 'light');
  assert.equal(effectsMode({}, { ...phone, tier: 'full' }), 'full', 'a fast phone is no longer forced to Light');
  assert.equal(effectsMode({ effects: 'auto' }, { ...phone, tier: 'light' }), 'light');
  assert.equal(effectsMode({}, { coarse: false, memory: 8, residents: 3, tier: 'light' }), 'light', 'a slow desktop is Light too');
  assert.equal(effectsMode({}, phone), 'light', 'unmeasured phones start Light');
  assert.equal(effectsMode({}, { coarse: false, memory: 8, residents: 3 }), 'full', 'unmeasured desktops start Full');
  assert.equal(effectsMode({}, { ...phone, tier: 'full', residents: 15 }), 'light', 'a crowded shelf is heavy even on a fast phone');
  assert.equal(effectsMode({}, { ...phone, tier: 'full', memory: 2 }), 'light');
  assert.equal(effectsMode(undefined, { coarse: false, memory: 8 }), 'full');
});

import { TRAIT_FIDGETS, ACT_IDS, fidgetBias, EMOTE_KINDS } from '../src/art/animator.js';
import { TRAITS } from '../src/content/traits.js';
import { completedSet, STREAK_MILESTONES, SET_LINES } from '../src/ui/celebrate.js';
import { CURIOS, RARITIES } from '../src/content/mayhem.js';
import { SEASONS } from '../src/content/seasons.js';

test('every trait fidget names a real trait and a real behaviour', () => {
  const traitIds = new Set(TRAITS.map(t => t.id));
  for (const [trait, table] of Object.entries(TRAIT_FIDGETS)) {
    assert.ok(traitIds.has(trait), trait + ' is a trait');
    for (const [act, weight] of Object.entries(table)) {
      assert.ok(ACT_IDS.includes(act), trait + ' asks for unknown behaviour ' + act);
      assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 10);
    }
  }
  assert.ok(Object.keys(TRAIT_FIDGETS).length >= 15, 'enough temperaments are covered to be noticed');
  assert.equal(fidgetBias(''), null);
  assert.equal(fidgetBias('nocturnal'), null, 'a trait without fidgets adds nothing');
  assert.deepEqual(fidgetBias('paranoid cryptid').doubletake, 7, 'biases add up across traits');
});

test('a resident can react in the ways the brief names', () => {
  for (const kind of ['happy', 'startled', 'proud', 'grossed']) assert.ok(EMOTE_KINDS.includes(kind), kind);
});

test('a finished set is announced for the rarity that was just completed, and only then', () => {
  const owned = {};
  const commons = CURIOS.filter(c => c.rarity === 'common');
  commons.slice(0, -1).forEach(c => { owned[c.id] = 1; });
  assert.equal(completedSet(owned, commons[0].id), null, 'one short of the set');
  owned[commons.at(-1).id] = 1;
  const done = completedSet(owned, commons.at(-1).id);
  assert.equal(done.id, 'common');
  assert.match(done.title, /^Every Common curio\.$/);
  assert.equal(done.line, SET_LINES.common);
  assert.equal(completedSet({}, 'not-a-curio'), null);
  for (const season of SEASONS) {
    const all = Object.fromEntries(season.curios.map(c => [c.id, 1]));
    assert.equal(completedSet(all, season.curios[0].id).id, 'season');
    assert.equal(completedSet({ [season.curios[0].id]: 1 }, season.curios[0].id), season.curios.length === 1 ? completedSet(all, season.curios[0].id) : null);
  }
  for (const rarity of RARITIES) assert.ok(SET_LINES[rarity.id], 'a line for ' + rarity.id);
});

test('streak milestones carry copy and no dashes', () => {
  for (const [n, mark] of Object.entries(STREAK_MILESTONES)) {
    assert.ok(Number(n) >= 3);
    assert.ok(mark.title.length > 5 && mark.line.length > 10);
    assert.ok(!/[–—]/.test(mark.title + mark.line));
  }
});
