import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeState, blankState, normalizePetArt } from '../src/state.js';
import { drawingBounds, drawingFrame } from '../src/art/drawing.js';
import { TRAIT_CARE, DRAWN_NOTES } from '../src/content/care.js';
import { TRAIT_BY_ID } from '../src/content/traits.js';
import { careFor } from '../src/engine/care.js';

const pet = id => ({ id, name: id, art: { body: '', stamps: [] } });
test('restore repairs duplicate, missing, and stale shelf occupants without losing residents', () => {
  const raw = { pets: [pet('p1'), pet('p2')], props: [{ id: 'd1', kind: 'bowl' }], slots: ['p1', 'p1', 'missing', null, 'd1'] };
  const normalized = normalizeState(raw);
  assert.equal(normalized.slots.length, 18);
  for (const id of ['p1', 'p2', 'd1']) assert.equal(normalized.slots.filter(x => x === id).length, 1);
  assert.equal(normalized.slots[4], 'd1');
  assert.deepEqual(raw.slots, ['p1', 'p1', 'missing', null, 'd1']);
});
test('restore rejects malformed or oversized rosters before replacing a shelf', () => {
  for (const raw of [
    { pets: [null] }, { pets: [pet('constructor')] }, { pets: [pet('x'), pet('x')] },
    { pets: [pet('x')], props: [{ id: 'x', kind: 'bowl' }] },
    { pets: [], props: [{ id: 'd', kind: 'unknown' }] },
    { pets: Array.from({ length: 19 }, (_, i) => pet('p' + i)) },
    { pets: [], gone: [null] }, { pets: [], feudArcs: { x: null } }
  ]) assert.equal(normalizeState(raw), null);
});
test('restore supplies finite needs, stats, dates, names and safe opt-in settings', () => {
  const s = normalizeState({ pets: [{ id: 'p', needs: { food: -99, fuss: 300, clean: 'bad' }, stats: null, bond: 100, traits: null }], lastTick: Infinity, settings: { matureMode: 'false' } });
  assert.deepEqual(s.pets[0].needs, { food: 0, fuss: 100, clean: 82 });
  assert.equal(s.pets[0].bond, 25);
  assert.equal(s.pets[0].stats.cute, 5);
  assert.equal(s.settings.matureMode, false);
  assert.ok(Number.isFinite(s.lastTick));
  assert.equal(s.pets[0].name, 'Someone');
});
test('storage failure keeps latest save readable and exposes loss of persistence', async () => {
  const disk = new Map();
  let full = false;
  globalThis.localStorage = { getItem: k => disk.get(k) ?? null, setItem: (k, v) => { if (full) throw Error('quota'); disk.set(k, v); }, removeItem: k => disk.delete(k) };
  try {
    const { Store } = await import('../src/state.js?storage-test');
    assert.equal(Store.set('save', 'old'), true);
    full = true;
    assert.equal(Store.set('save', 'latest'), false);
    assert.equal(Store.persistent, false);
    assert.equal(Store.get('save'), 'latest');
    assert.equal(disk.get('save'), 'old');
    full = false;
    assert.equal(Store.set('save', 'latest'), true);
    assert.equal(Store.persistent, true);
  } finally { delete globalThis.localStorage; }
});
test('drawing bounds find a single thin pixel instead of sampling past it', () => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  pixels[(3 * 10 + 2) * 4 + 3] = 255;
  const b = drawingBounds(pixels, 10, 10);
  assert.equal(b.x, .2); assert.equal(b.y, .3);
  assert.ok(Math.abs(b.width - .1) < 1e-8);
  assert.equal(drawingBounds(new Uint8ClampedArray(400), 10, 10), null);
});
test('drawing bounds use visible stamp ink and include rotated off-canvas parts', () => {
  const stamp = { kind: 'eyes', x: 320, y: 320, size: 40 };
  const b = drawingBounds(null, 0, 0, [stamp], { eyes: { x: -12, y: -6, width: 24, height: 12 } });
  assert.ok(b.width < .15 && b.height < .1);
  const rotated = drawingBounds(null, 0, 0, [{ ...stamp, x: 0, rotation: 45 }]);
  assert.ok(rotated.x < 0);
  assert.ok(rotated.width > 200 / 640);
});
test('framing centers the silhouette, plants its feet, and caps magnification', () => {
  const b = { x: .1, y: .15, width: .4, height: .6 };
  const f = drawingFrame(b);
  assert.ok(Math.abs(f.left + (b.x + b.width / 2) * f.scale - .5) < 1e-8);
  assert.ok(Math.abs(f.top + (b.y + b.height) * f.scale - .97) < 1e-8);
  assert.equal(drawingFrame({ x: 0, y: 0, width: .001, height: .001 }).scale, 4);
  assert.equal(drawingFrame({ x: 0, y: 0, width: 0, height: 0 }), null);
  assert.deepEqual(normalizePetArt({ bounds: b }).bounds, b);
});
test('trait care matches real traits and stays short with no unresolved placeholders', () => {
  for (const [id, needs] of Object.entries(TRAIT_CARE)) {
    assert.ok(TRAIT_BY_ID[id], id);
    assert.deepEqual(Object.keys(needs).sort(), ['clean', 'food', 'fuss']);
    for (const lines of Object.values(needs)) for (const line of lines) {
      assert.ok(line.length <= 100, line);
      assert.doesNotMatch(line, /[{}]/);
    }
  }
  for (const line of DRAWN_NOTES) assert.ok(line.length <= 100);
});
test('trait-specific care does not leak to pets without that trait', () => {
  const oldRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = blankState();
    const p = { ...pet('p'), traits: ['porcelain'], needs: { food: 30, fuss: 30, clean: 30 }, cared: 0, bond: 0 };
    s.pets = [p]; s.slots[0] = 'p';
    assert.ok(TRAIT_CARE.porcelain.food.some(line => careFor(s, p, 'food', s.lastTick).message.includes(line)));
    p.traits = []; p.needs.food = 30;
    const generic = careFor(s, p, 'food', s.lastTick).message;
    assert.ok(!TRAIT_CARE.porcelain.food.some(line => generic.includes(line)));
  } finally { Math.random = oldRandom; }
});

const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
function worker() {
  const events = {}, stores = new Map([['another-app', new Map()], ['shelflife-old', new Map()]]);
  const resolve = value => new URL(typeof value === 'string' ? value : value.url, 'https://test.example/game/').href.split('?')[0];
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return { addAll: async paths => paths.forEach(p => entries.set(resolve(p), new Response('cached ' + p))), match: async r => entries.get(resolve(r))?.clone(), put: async (r, response) => entries.set(resolve(r), response) };
  };
  const context = { URL, Response, AbortController, setTimeout, clearTimeout,
    self: { location: { origin: 'https://test.example' }, registration: { scope: 'https://test.example/game/' }, addEventListener: (name, fn) => { events[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async name => cache(name), keys: async () => [...stores.keys()], delete: async name => stores.delete(name) },
    fetch: async () => { throw Error('offline'); }
  };
  vm.runInNewContext(sw, context);
  return { events, stores };
}
test('offline shell includes every production module, and every cached asset exists', async () => {
  const { events, stores } = worker();
  await new Promise(resolve => events.install({ waitUntil: p => p.then(resolve) }));
  const shell = [...stores.get('shelflife-v4').keys()].map(u => u.replace('https://test.example/game/', ''));
  for (const file of fs.readdirSync(new URL('../src', import.meta.url), { recursive: true }).filter(p => p.endsWith('.js'))) assert.ok(shell.includes('src/' + file), file + ' missing offline');
  for (const file of shell) assert.ok(fs.existsSync(new URL('../' + file, import.meta.url)), file);
});
test('activation deletes only Shelf Life caches', async () => {
  const { events, stores } = worker();
  await new Promise(resolve => events.activate({ waitUntil: p => p.then(resolve) }));
  assert.ok(stores.has('another-app'));
  assert.ok(!stores.has('shelflife-old'));
});
test('offline requests serve cached modules and navigation, or an explicit failure', async () => {
  const { events } = worker();
  await new Promise(resolve => events.install({ waitUntil: p => p.then(resolve) }));
  async function request(path, mode = 'cors') {
    let answer;
    events.fetch({ request: { url: 'https://test.example/game/' + path, method: 'GET', mode }, respondWith: p => { answer = p; }, waitUntil() {} });
    return answer;
  }
  assert.equal((await request('src/art/drawing.js?v=2')).status, 200);
  assert.equal((await request('resume', 'navigate')).status, 200);
  assert.equal((await request('missing.js')).status, 503);
});

test('an unreadable local save is preserved before a new shelf is written', async () => {
  const original = '{broken json';
  const disk = new Map([['shelflife.v4', original]]);
  globalThis.localStorage = { getItem: k => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, v), removeItem: k => disk.delete(k) };
  try {
    const mod = await import('../src/state.js?recovery-test');
    assert.equal(mod.loadFailed, true);
    assert.equal(disk.get(mod.RECOVERY_KEY), original);
    assert.equal(mod.save(), true);
    assert.equal(disk.get(mod.RECOVERY_KEY), original);
    assert.deepEqual(JSON.parse(disk.get(mod.SAVE_KEY)).pets, []);
  } finally { delete globalThis.localStorage; }
});

test('a full disk cannot cause an unreadable original save to be overwritten', async () => {
  const original = '{broken json';
  const disk = new Map([['shelflife.v4', original]]);
  globalThis.localStorage = { getItem: k => disk.get(k) ?? null, setItem: (k, v) => { if (k.endsWith('.recovery')) throw Error('quota'); disk.set(k, v); }, removeItem: k => disk.delete(k) };
  try {
    const mod = await import('../src/state.js?recovery-full-test');
    assert.equal(mod.save(), false);
    assert.equal(disk.get(mod.SAVE_KEY), original);
    assert.equal(mod.Store.get(mod.RECOVERY_KEY), original);
  } finally { delete globalThis.localStorage; }
});
