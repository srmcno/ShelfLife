import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGovernor, fxLevelFor, FX_CAPS, buzz, HAPTICS, countUp, rememberLevel, rememberedLevel } from '../src/ui/arcade-fx.js';
import { ladderFreq, CANDLE_NOTES, arcadeSoundNames, sfx, bedState, stopBed } from '../src/audio/arcade-audio.js';
import { ARCADE_GLYPH_NAMES, arcadeGlyph, sceneMarkup, hubArt, bossMarkup, allGlyphNames } from '../src/art/arcade-art.js';
import { ARCADE_GAMES, ARCADE_THEMES, FRENZY_ITEMS } from '../src/content/arcade.js';

test('effects levels follow the device: Light starts at 1, reduced motion at 2, and a struggling device keeps its level', () => {
  assert.equal(fxLevelFor({ mode: 'full' }), 0);
  assert.equal(fxLevelFor({ mode: 'light' }), 1);
  assert.equal(fxLevelFor({ mode: 'full', reduced: true }), 2);
  assert.equal(fxLevelFor({ mode: 'light', reduced: true }), 2);
  assert.equal(fxLevelFor({ mode: 'full', remembered: 1 }), 1);
  assert.equal(fxLevelFor({ mode: 'light', remembered: 2 }), 2);
  assert.equal(fxLevelFor({ mode: 'full', remembered: 9 }), 2);
  // Each level asks for less than the one before.
  for (let i = 1; i < FX_CAPS.length; i++) {
    assert.ok(FX_CAPS[i].particles <= FX_CAPS[i - 1].particles);
    assert.ok(FX_CAPS[i].shake <= FX_CAPS[i - 1].shake);
    assert.ok(FX_CAPS[i].dpr <= FX_CAPS[i - 1].dpr);
  }
  assert.equal(FX_CAPS[2].particles, 0);
  assert.equal(FX_CAPS[2].hitStop, 0);
  assert.equal(FX_CAPS[2].slowmo, false);
  assert.equal(FX_CAPS[0].hitStop, 60, 'a 60 millisecond hit-stop at full effects');
  assert.equal(rememberedLevel(), 0);
  rememberLevel(1); rememberLevel(0);
  assert.equal(rememberedLevel(), 1, 'a level only ever goes up');
});

test('the frame governor steps effects down after a slow two seconds and never back up', () => {
  const feed = (gov, ms, seconds) => { let step = null; for (let t = 0; t < seconds * 1000; t += ms) step = gov.push(ms) ?? step; return step; };
  // A steady 60 fps never trips it, however long it runs.
  const smooth = createGovernor();
  assert.equal(feed(smooth, 16.7, 30), null);
  assert.equal(smooth.level, 0);
  // 40 ms frames (25 fps) do, inside the first window or two.
  const slow = createGovernor();
  let first = null, elapsed = 0;
  while (first === null && elapsed < 6000) { first = slow.push(40); elapsed += 40; }
  assert.equal(first, 1);
  assert.ok(elapsed <= 2600, 'noticed within about two seconds: ' + elapsed);
  assert.equal(feed(slow, 40, 3), 2, 'still slow, so it steps down again');
  assert.equal(feed(slow, 40, 10), null, 'minimal is the floor');
  assert.equal(slow.level, 2);
  assert.equal(feed(slow, 10, 10), null, 'and a recovery does not raise it again');
  // A pause or a hidden tab is a gap, not slowness.
  const paused = createGovernor();
  for (let i = 0; i < 30; i++) { paused.push(16); paused.push(900); }
  assert.equal(paused.level, 0);
  // A single hiccup in a good second does not count.
  const hiccup = createGovernor();
  assert.equal(feed(hiccup, 16, 1), null);
  assert.equal(hiccup.push(240), null);
  assert.equal(feed(hiccup, 16, 3), null);
  // A phone managing seven frames a second is noticed too, not mistaken for a pause.
  const crawl = createGovernor();
  let seen = null, spent = 0;
  while (seen === null && spent < 6000) { seen = crawl.push(150); spent += 150; }
  assert.equal(seen, 1);
  assert.ok(spent <= 3200, 'noticed in about two seconds: ' + spent);
  // A device that begins at Light starts the governor there.
  const light = createGovernor(); light.level = 1;
  assert.equal(feed(light, 40, 3), 2);
});

test('haptics: patterns exist, the switch is respected, and a flurry of taps is thinned', () => {
  const calls = [], saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setNavigator = value => Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
  setNavigator({ vibrate: p => { calls.push(p); return true; } });
  try {
    const state = { at: 0 };
    assert.equal(buzz('catch', false, 1000, state), false, 'off means off');
    assert.equal(calls.length, 0);
    assert.equal(buzz('catch', true, 1000, state), true);
    assert.equal(buzz('catch', true, 1020, state), false, 'too soon after the last one');
    assert.equal(buzz('fatal', true, 1030, state), true, 'the end of a run always buzzes');
    assert.equal(buzz('nonsense', true, 5000, state), false);
    assert.deepEqual(calls, [HAPTICS.catch, HAPTICS.fatal]);
    for (const [name, pattern] of Object.entries(HAPTICS)) {
      const list = [].concat(pattern);
      assert.ok(list.every(n => n > 0 && n <= 200), name);
      assert.ok(list.reduce((a, b) => a + b, 0) <= 450, name + ' is short enough not to annoy');
    }
    setNavigator({});
    assert.equal(buzz('catch', true, 9000, { at: 0 }), false, 'a phone that cannot vibrate is left alone');
  } finally { if (saved) Object.defineProperty(globalThis, 'navigator', saved); else delete globalThis.navigator; }
});

test('the score count-up lands on the real number, and skips when asked', () => {
  const el = { textContent: '' };
  let done = 0;
  const finish = countUp(el, 120, { instant: true, onDone: () => done++ });
  assert.equal(el.textContent, '120');
  assert.equal(done, 1);
  assert.equal(typeof finish, 'function');
  const zero = { textContent: 'x' };
  countUp(zero, 0, {});
  assert.equal(zero.textContent, '0');
});

test('the combo ladder climbs a pentatonic scale and every game has a quiet voice of its own', () => {
  const freqs = Array.from({ length: 15 }, (_, i) => ladderFreq(i));
  for (let i = 1; i < freqs.length; i++) assert.ok(freqs[i] > freqs[i - 1], 'rung ' + i + ' is higher');
  assert.ok(Math.abs(freqs[5] / freqs[0] - 2) < 1e-9, 'five rungs is an octave');
  assert.equal(ladderFreq(99), freqs[14]);
  assert.equal(ladderFreq(-3), freqs[0]);
  assert.equal(CANDLE_NOTES.length, 4);
  const names = arcadeSoundNames();
  for (const need of ['combo', 'thunk', 'perfect', 'creak', 'near', 'pop', 'gold', 'hurt', 'widow', 'tick', 'go', 'tier', 'wave', 'boss', 'fell', 'fatal', 'candle', 'wrong', 'chime']) assert.ok(names.includes(need), need);
  // Without a browser there is no audio, and asking for a sound must simply do nothing.
  assert.equal(sfx('combo', 3), null);
  assert.equal(sfx('not-a-sound'), null);
  stopBed();
  assert.equal(bedState().playing, false);
});

test('every arcade scene, hub card and glyph is real SVG, themed through variables and without filters', () => {
  for (const g of ARCADE_GAMES) {
    const scene = sceneMarkup(g.id), hub = hubArt(g.id);
    assert.ok(scene.includes('<svg') && scene.includes('viewBox'), g.id);
    assert.ok(hub.startsWith('<svg'), g.id);
    assert.ok(!/<filter|filter:/.test(scene + hub), g.id + ' scenes use no filters');
    assert.ok(!/hub-art[^>]*class="ar-(candle|grave)/.test(hub), 'hub art does not borrow the playfield class names');
    // Colours come from the arena, not hard-coded into the scene.
    assert.ok(/var\(--ar-/.test(scene) || /class="a-/.test(scene), g.id + ' is themed');
    assert.equal((scene.match(/<svg/g) || []).length, (scene.match(/<\/svg>/g) || []).length, g.id + ' tags balance');
  }
  assert.ok(sceneMarkup('stack').includes('st-night') && sceneMarkup('stack').includes('st-heaven'), 'the sky has stages that follow the height');
  assert.ok(bossMarkup().includes('<svg'));
  for (const name of ['casket', 'soap', 'trap', 'glove', 'goldtooth']) {
    assert.ok(ARCADE_GLYPH_NAMES.includes(name), name);
    const svg = arcadeGlyph(name);
    assert.ok(svg.includes('viewBox="0 0 48 48"') && svg.includes('path'), name);
    assert.notEqual(svg, arcadeGlyph('skull'), name + ' is not the fallback skull');
  }
  assert.equal(arcadeGlyph('skull'), arcadeGlyph('skull'), 'the shared curio glyphs still resolve');
  assert.ok(allGlyphNames().includes('skull') && allGlyphNames().includes('soap'));
  for (const item of Object.values(FRENZY_ITEMS)) assert.ok(allGlyphNames().includes(item.glyph));
  for (const t of ARCADE_THEMES) {
    assert.equal(t.sky.length, 2);
    for (const c of [...t.sky, t.ground, t.glow, t.fog, t.star]) assert.match(c, /^#[0-9a-f]{6}$/i, t.id);
  }
});

test('arcade styles keep to the performance rules: no veil blur while playing, nothing animated by layout', () => {
  const css = fs.readFileSync(new URL('../css/games.css', import.meta.url), 'utf8');
  assert.match(css, /#arcadeVeil\.ar-live\{[^}]*backdrop-filter:none/, 'no blur behind a live run');
  // Moving things are moved with transforms: no keyframes animate left, top, width or height.
  for (const [, body] of css.matchAll(/@keyframes [\w-]+\{([\s\S]*?)\}\s*(?=[.@#a-z\n])/g)) assert.ok(!/(^|[{;])\s*(left|top|width|height|bottom|right)\s*:/.test(body), 'keyframes animate only transforms and opacity');
  for (const selector of ['.ar-item{', '.ar-mover{', '.ar-catcher{', '.ar-rider{']) assert.ok(css.includes(selector + 'position:absolute;'), selector);
  assert.match(css, /\.ar-item\{[^}]*will-change:transform/);
  assert.ok(!/\.ar-(item|catcher|mover|rider)[^{]*\{[^}]*(?<![-\w])filter:(?!none)/.test(css), 'no filter on anything that moves a frame at a time');
  assert.match(css, /data-fx="2"/);
  assert.match(css, /body\[data-effects="light"\]/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.ok(!/[–—]/.test(css));
});
