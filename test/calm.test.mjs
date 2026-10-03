import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// effects.js touches the page when imported, so read the one pure function from source instead.
const source = readFileSync(new URL('../src/ui/effects.js', import.meta.url), 'utf8');

function stage() {
  const real = new Map();
  const make = query => {
    if (!real.has(query)) {
      const listeners = new Set();
      real.set(query, { media: query, matches: false, addEventListener(type, fn) { if (type === 'change') listeners.add(fn); }, removeEventListener(type, fn) { listeners.delete(fn); }, listeners });
    }
    return real.get(query);
  };
  const classes = new Set();
  globalThis.window = { matchMedia: make };
  globalThis.document = { body: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: c => classes.has(c) } }, getElementById: () => null };
  return { classes, real };
}

test('Calm mode makes the reduced-motion question answer yes, and only that question', async () => {
  const { classes } = stage();
  const calm = await import('../src/ui/calm.js?wrap');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  assert.equal(motion.matches, false);
  assert.equal(calm.applyCalm(true), true);
  assert.equal(motion.matches, true, 'a list made before the switch follows it');
  assert.equal(window.matchMedia('(prefers-reduced-motion: reduce)').matches, true, 'so does one made after');
  assert.equal(coarse.matches, false, 'other queries are left alone');
  assert.equal(classes.has('calm'), true);
  assert.equal(calm.isCalm(), true);
  assert.equal(calm.applyCalm(true), false, 'switching on twice changes nothing');
  assert.equal(calm.applyCalm(false), true);
  assert.equal(motion.matches, false);
  assert.equal(classes.has('calm'), false);
});

test('code listening for the preference is told when Calm mode changes it', async () => {
  stage();
  const calm = await import('../src/ui/calm.js?listen');
  const heard = [];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = event => heard.push(event.matches);
  motion.addEventListener('change', listener);
  calm.applyCalm(true);
  calm.applyCalm(false);
  assert.deepEqual(heard, [true, false]);
  motion.removeEventListener('change', listener);
  calm.applyCalm(true);
  assert.deepEqual(heard, [true, false], 'a removed listener stays quiet');
  calm.applyCalm(false);
});

test('the device setting still counts when Calm mode is off', async () => {
  const { real } = stage();
  const calm = await import('../src/ui/calm.js?device');
  real.set('(prefers-reduced-motion: reduce)', { media: '(prefers-reduced-motion: reduce)', matches: true, addEventListener() {}, removeEventListener() {} });
  assert.equal(window.matchMedia('(prefers-reduced-motion: reduce)').matches, true);
  calm.applyCalm(true);
  calm.applyCalm(false);
  assert.equal(window.matchMedia('(prefers-reduced-motion: reduce)').matches, true, 'switching Calm off does not override the phone');
});

test('Calm mode forces Light effects, whatever else is chosen', () => {
  assert.match(source, /settings\?\.calm === true\) return 'light'/);
  const fn = new Function('return ' + source.slice(source.indexOf('export function effectsMode') + 7, source.indexOf('let currentState')).trim())();
  assert.equal(fn({ calm: true, effects: 'full' }, { memory: 16 }), 'light');
  assert.equal(fn({ calm: false, effects: 'full' }), 'full');
  assert.equal(fn({ effects: 'auto' }, { residents: 9 }), 'light');
});

test('the switch is described honestly in both states', async () => {
  stage();
  const { calmLabels } = await import('../src/ui/calm.js?labels');
  assert.match(calmLabels(false).sub, /light/);
  assert.match(calmLabels(true).label, /on/);
  assert.doesNotMatch(JSON.stringify([calmLabels(true), calmLabels(false)]), /[–—]/);
});
