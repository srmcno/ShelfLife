import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, HOUR, FORM_LOG_MAX } from '../src/state.js';
import { effectiveHours, tick } from '../src/engine/tick.js';

const at = (hour, minute = 0) => new Date(2026, 8, 10, hour, minute).getTime();
const pet = id => ({ id, name: id, traits: [], needs: { food: 90, fuss: 90, clean: 90 } });

test('partial hours at dawn and dusk charge only the time on each side of the boundary', () => {
  assert.equal(effectiveHours(at(19, 30), at(20, 30)), .75);
  assert.equal(effectiveHours(at(6, 30), at(7, 30)), .75);
  assert.equal(effectiveHours(at(19, 59), at(20, 1)), 1 / 40);
  const whole = effectiveHours(at(6, 15), at(21, 45));
  let frequent = 0;
  for (let time = at(6, 15); time < at(21, 45); time += HOUR / 4) frequent += effectiveHours(time, time + HOUR / 4);
  assert.equal(whole, frequent, 'opening and closing the game does not change decay');
});

test('invalid or corrected clocks cannot poison needs or charge the same hour twice', () => {
  const state = blankState();
  state.pets = [pet('p1')]; state.slots[0] = 'p1'; state.lastTick = at(12);
  for (const invalid of [NaN, Infinity, -Infinity, 1e20]) {
    assert.equal(tick(state, invalid), false);
    assert.equal(effectiveHours(at(12), invalid), 0);
  }
  assert.equal(tick(state, at(11)), false);
  assert.equal(state.lastTick, at(12));
  assert.equal(tick(state, at(12)), false);
  assert.deepEqual(state.pets[0].needs, { food: 90, fuss: 90, clean: 90 });
  assert.equal(tick(state, at(13)), true);
  assert.ok(state.pets[0].needs.food < 90);
});

test('restoring malformed counters and future cooldowns cannot break care or lock out check-ins', () => {
  const now = Date.now();
  const raw = {
    pets: [{ ...pet('p1'), careLog: { food: -2, fuss: '6', clean: 3.9 }, bestFuss: -6, firstTouch: -9, fussRun: -5 }],
    lastCheck: now + 100 * HOUR, streak: { count: 3, lastCheckin: now + 100 * HOUR },
    formLog: Array.from({ length: 200 }, () => 'line'), noteCount: -15, lastGoneNote: 400,
    notes: [{ text: 'A complaint.', at: now }]
  };
  const state = normalizeState(raw);
  assert.deepEqual(state.pets[0].careLog, { food: 0, fuss: 0, clean: 3 });
  assert.equal(state.pets[0].bestFuss, 0); assert.equal(state.pets[0].firstTouch, 0); assert.equal(state.pets[0].fussRun, 0);
  assert.ok(state.lastCheck <= Date.now()); assert.ok(state.streak.lastCheckin <= Date.now());
  assert.equal(state.noteCount, 1); assert.equal(state.lastGoneNote, 1);
  assert.equal(state.formLog.length, FORM_LOG_MAX);
  assert.equal(raw.pets[0].careLog.food, -2, 'normalizing a preview leaves its source untouched');
});

// A small animation host models delayed browser cancellation events. No DOM
// dependency is needed to reproduce a stale clip clearing a newer movement.
function element(classes = []) {
  const tokens = new Set(classes), values = new Map();
  return {
    dataset: {}, isConnected: true,
    classList: {
      contains: key => tokens.has(key), add: (...keys) => keys.forEach(key => tokens.add(key)),
      remove: (...keys) => keys.forEach(key => tokens.delete(key)),
      toggle(key, on) { const keep = on ?? !tokens.has(key); if (keep) tokens.add(key); else tokens.delete(key); return keep; }
    },
    style: { animation: '', setProperty: (key, value) => values.set(key, value), getPropertyValue: key => values.get(key) || '', removeProperty: key => values.delete(key) },
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setAttribute() {}, appendChild() {}, remove() {}
  };
}
async function withAnimator(key, run) {
  const names = ['window', 'document', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
  const originals = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const timers = new Map(), intervals = new Map(), listeners = {}, preferenceListeners = {};
  let seq = 0;
  const act = element(), sprite = element(['sprite', 'sl2']), piece = element(['pet']), root = element(), animations = [];
  sprite.dataset = { pet: 'p1', slPrep: '1', slGait: 'walk' };
  sprite.querySelector = selector => selector === '.sprite-act' ? act : null;
  piece.dataset = { id: 'p1', slot: '1' };
  piece.querySelector = () => sprite;
  piece.animate = () => { const animation = { cancelled: false, cancel() { this.cancelled = true; } }; animations.push(animation); return animation; };
  root.querySelectorAll = () => [piece];
  const media = { matches: false, addEventListener: (type, fn) => preferenceListeners[type] = fn };
  const doc = {
    hidden: false, body: element(), querySelector: () => null, getElementById: () => null,
    addEventListener: (type, fn) => listeners[type] = fn,
    querySelectorAll(selector) {
      if (selector === '.sprite .sprite-act') return [act];
      if (selector.startsWith('.sprite.sl2')) return [sprite];
      return [];
    },
    createElement: () => element()
  };
  Object.assign(globalThis, {
    document: doc, window: { matchMedia: () => media },
    setTimeout(fn) { const id = ++seq; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    setInterval(fn) { const id = ++seq; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id)
  });
  try {
    const mod = await import('../src/art/animator.js?resilience=' + key);
    mod.initAnimator();
    await run({ mod, root, piece, sprite, act, animations, timers, intervals, doc, listeners, media, preferenceListeners });
  } finally {
    for (const name of names) {
      if (originals[name]) Object.defineProperty(globalThis, name, originals[name]); else delete globalThis[name];
    }
  }
}

test('a cancelled movement cannot clear its replacement, and hiding stops active travel', async () => {
  await withAnimator('travel', ({ mod, root, piece, sprite, animations, doc, listeners, intervals }) => {
    mod.playShelfMoves(root, new Map([['p1', { x: 100, y: 0, slot: '0' }]]));
    assert.equal(animations.length, 1);
    const old = animations[0];
    piece.dataset.slot = '2';
    mod.playShelfMoves(root, new Map([['p1', { x: 200, y: 0, slot: '1' }]]));
    assert.equal(old.cancelled, true);
    old.oncancel();
    assert.equal(sprite.classList.contains('sl-travel'), true, 'late cancellation leaves the new gait running');
    assert.equal(piece.style.zIndex, '5');
    doc.hidden = true; listeners.visibilitychange();
    assert.equal(animations[1].cancelled, true);
    assert.equal(sprite.classList.contains('sl-travel'), false);
    assert.equal(piece.style.zIndex, '');
    assert.equal(intervals.size, 0);
  });
});

test('hidden tabs cancel queued reactions and reduced motion stays stopped when the tab returns', async () => {
  await withAnimator('pause', ({ mod, timers, intervals, doc, listeners, media, preferenceListeners, act }) => {
    mod.reactTo('p1', 'notice', 400);
    assert.equal(timers.size, 1);
    doc.hidden = true; listeners.visibilitychange();
    assert.equal(timers.size, 0);
    media.matches = true; preferenceListeners.change();
    doc.hidden = false; listeners.visibilitychange();
    assert.equal(intervals.size, 0);
    assert.equal(act.style.animation, '');
    mod.reactTo('p1', 'notice', 400);
    assert.equal(timers.size, 0);
    media.matches = false; preferenceListeners.change();
    assert.equal(intervals.size, 1);
  });
});

test('court puppet gestures hold their poses and releasing a scene cancels every owned timer and clip', async () => {
  await withAnimator('court-release', ({ mod, sprite, act, timers, intervals }) => {
    const puppet = mod.createPuppet(sprite);
    puppet.move(true, -1, true);
    for (const [kind, held] of [['testify', 'sl-testifying'], ['deny', 'sl-denying'], ['confess', 'sl-confessing']]) {
      puppet.gesture(kind);
      assert.equal(sprite.classList.contains(held), true, kind + ' holds an anatomy pose for the clip');
      assert.ok(act.style.animation.startsWith('sl2-' + kind + ' '));
    }
    assert.equal(timers.size, 3);
    puppet.gesture('confess');
    assert.equal(timers.size, 3, 'repeating a gesture replaces its expiry instead of leaking a timer');
    puppet.release();
    assert.equal(timers.size, 0);
    assert.equal(act.style.animation, '');
    assert.equal(act.onanimationend, null);
    assert.equal(sprite.dataset.slControlled, undefined);
    assert.equal(sprite.style.getPropertyValue('--sl-face'), '');
    for (const held of ['sl-testifying', 'sl-denying', 'sl-confessing', 'sl-controlled', 'sl-travel', 'sl-airborne', 'sl-gait-walk']) {
      assert.equal(sprite.classList.contains(held), false, 'release clears ' + held);
    }
    assert.equal(intervals.size, 1, 'closing one scene leaves the shelf director available');
    const replacement = mod.createPuppet(sprite);
    replacement.gesture('testify');
    const replacementClip = act.style.animation;
    puppet.gesture('deny'); puppet.move(true, -1, true); puppet.release();
    assert.equal(act.style.animation, replacementClip, 'late calls from the old scene cannot interrupt its replacement');
    assert.equal(timers.size, 1);
    assert.equal(sprite.classList.contains('sl-denying'), false);
    assert.equal(sprite.classList.contains('sl-travel'), false);
    assert.equal(sprite.classList.contains('sl-controlled'), true);
    replacement.release();
    assert.equal(timers.size, 0);
  });
});

test('hidden and reduced-motion courtroom scenes cancel held gestures and reject new animation work', async () => {
  await withAnimator('court-visibility', ({ mod, sprite, act, timers, intervals, doc, listeners, media, preferenceListeners }) => {
    const puppet = mod.createPuppet(sprite);
    puppet.gesture('testify'); puppet.gesture('deny'); puppet.gesture('confess');
    assert.equal(timers.size, 3);
    doc.hidden = true; listeners.visibilitychange();
    for (const held of ['sl-testifying', 'sl-denying', 'sl-confessing']) assert.equal(sprite.classList.contains(held), false);
    assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(act.style.animation, '');
    for (const gesture of ['testify', 'deny', 'confess']) puppet.gesture(gesture);
    assert.equal(timers.size, 0); assert.equal(act.style.animation, '');
    media.matches = true; preferenceListeners.change();
    doc.hidden = false; listeners.visibilitychange();
    for (const gesture of ['testify', 'deny', 'confess']) puppet.gesture(gesture);
    assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(act.style.animation, '');
    media.matches = false; preferenceListeners.change();
    puppet.gesture('confess');
    assert.equal(sprite.classList.contains('sl-confessing'), true); assert.equal(timers.size, 1);
    media.matches = true; preferenceListeners.change();
    assert.equal(sprite.classList.contains('sl-confessing'), false); assert.equal(timers.size, 0); assert.equal(act.style.animation, '');
    puppet.release();
  });
});

test('light effects skip puppet gesture clips and pose timers until full effects return', async () => {
  await withAnimator('court-light-effects', ({ mod, sprite, act, timers, doc }) => {
    const puppet = mod.createPuppet(sprite);
    doc.body.dataset.effects = 'light';
    for (const kind of ['blink', 'testify', 'deny', 'confess', 'inspect', 'celebrate']) puppet.gesture(kind);
    assert.equal(timers.size, 0); assert.equal(act.style.animation, '');
    for (const held of ['sl-blink', 'sl-testifying', 'sl-denying', 'sl-confessing', 'sl-inspecting', 'sl-celebrating']) {
      assert.equal(sprite.classList.contains(held), false);
    }
    doc.body.dataset.effects = 'full';
    puppet.gesture('testify');
    assert.equal(timers.size, 1); assert.ok(act.style.animation.startsWith('sl2-testify '));
    puppet.release(); assert.equal(timers.size, 0);
  });
});
