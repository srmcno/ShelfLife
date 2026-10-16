// Moving house (src/move.js): the pure parts. test/browser/move.spec.mjs runs
// the real hops between two addresses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseShelf, applyIncoming, encodePayload, decodePayload, partsOf, collectKeys, sha256Hex, fnv, role, gate, arrivalLine,
  SAVE_KEY, SAFETY_KEY, SPARE_KEY, CLOUD_KEY, APPLIED_KEY, NOTE_KEY, DONE_KEY, PART
} from '../src/move.js';
import { SAVE_KEY as GAME_SAVE_KEY } from '../src/state.js';
import { SAFETY_KEY as GAME_SAFETY_KEY } from '../src/cloud/sync.js';
import { CLOUD_KEY as GAME_CLOUD_KEY } from '../src/cloud/client.js';

class Storage {
  constructor(entries = {}, quota = Infinity) { this.map = new Map(Object.entries(entries)); this.quota = quota; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const used = [...this.map].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + String(v).length > this.quota) throw new Error('QuotaExceededError');
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}
const shelf = (names, lastTick = 1000, extra = {}) => JSON.stringify({ pets: names.map((name, i) => ({ id: 'p' + i, name })), lastTick, mayhem: { souls: 5 }, ...extra });

test('the move uses the same storage keys as the game', () => {
  assert.equal(SAVE_KEY, GAME_SAVE_KEY);
  assert.equal(SAFETY_KEY, GAME_SAFETY_KEY);
  assert.equal(CLOUD_KEY, GAME_CLOUD_KEY);
});

test('which shelf is played after a move, and which is kept as the spare: nothing is ever dropped', () => {
  const old = shelf(['Mabel', 'Grubbs', 'Pip'], 500);
  assert.deepEqual(chooseShelf(null, old), { take: true, spare: null, reason: 'empty' });
  const fresh = shelf([], 900);
  assert.deepEqual(chooseShelf(fresh, old), { take: true, spare: fresh, reason: 'nobody-here' });
  const startedHere = shelf(['Newbie'], 900);
  assert.deepEqual(chooseShelf(startedHere, old), { take: true, spare: startedHere, reason: 'bigger' }, 'the real household wins, the new one is kept');
  const bigHere = shelf(['A', 'B', 'C', 'D'], 100);
  assert.deepEqual(chooseShelf(bigHere, old), { take: false, spare: old, reason: 'kept-here' });
  assert.equal(chooseShelf(shelf(['A', 'B', 'C'], 600), old).take, false, 'a tie goes to the more recent');
  assert.equal(chooseShelf(shelf(['A', 'B', 'C'], 400), old).take, true);
  assert.equal(chooseShelf(old, old).take, false);
  assert.deepEqual(chooseShelf('not json', old), { take: true, spare: 'not json', reason: 'nobody-here' }, 'an unreadable copy is kept, not overwritten into nothing');
  assert.equal(chooseShelf(startedHere, 'garbage').take, false, 'a broken payload changes nothing');
  // An earlier move left this copy untouched: the old address played on offline, this is its update.
  assert.deepEqual(chooseShelf(bigHere, old, { hash: fnv(bigHere) }), { take: true, spare: null, reason: 'update' });
});

test('the payload survives compression, base64url and splitting into URL-sized parts', async () => {
  const big = { keys: { [SAVE_KEY]: shelf(Array.from({ length: 30 }, (_, i) => 'Resident ' + i)), 'shelflife.cloud': '{"x":1}', art: 'data:image/png;base64,' + 'iVBOR'.repeat(200000) } };
  const text = await encodePayload(big);
  assert.match(text, /^[gr][A-Za-z0-9_-]*$/, 'only URL-safe characters');
  const parts = partsOf(text);
  assert.ok(parts.every(p => p.length <= PART));
  assert.deepEqual(await decodePayload(parts.join('')), big);
  assert.match(await sha256Hex(text), /^[0-9a-f]{64}$/);
  assert.deepEqual(partsOf(''), ['']);
});

test('everything the game keeps comes along, but not the move bookkeeping', () => {
  const s = new Storage({ 'shelflife.v4': 'save', 'shelflife.v4.recovery': 'rec', 'shelflife.cloud': 'c', 'shelflife.tab': 'court', 'shelflife-move.done': 'x', other: 'y' });
  assert.deepEqual(Object.keys(collectKeys(s)), ['shelflife.cloud', 'shelflife.tab', 'shelflife.v4', 'shelflife.v4.recovery']);
});

test('applying a move: a fresh address takes the shelf and the extras', () => {
  const s = new Storage();
  const keys = { [SAVE_KEY]: shelf(['Mabel']), 'shelflife.v4.recovery': 'rec', 'shelflife.tab': 'court' };
  const r = applyIncoming(s, keys, { from: 'https://old/', sha: 'a'.repeat(64), now: 7 });
  assert.deepEqual(r, { ok: true, took: true, spare: false, reason: 'empty' });
  assert.equal(s.getItem(SAVE_KEY), keys[SAVE_KEY]);
  assert.equal(s.getItem('shelflife.v4.recovery'), 'rec');
  assert.deepEqual(JSON.parse(s.getItem(APPLIED_KEY)), { from: 'https://old/', sha: 'a'.repeat(64), at: 7, hash: fnv(keys[SAVE_KEY]) });
  assert.match(arrivalLine(JSON.parse(s.getItem(NOTE_KEY))), /Everyone made it/);
  // The same payload again (a lost "done") changes nothing.
  s.setItem(SAVE_KEY, shelf(['Mabel', 'Played here since']));
  assert.equal(applyIncoming(s, keys, { sha: 'a'.repeat(64) }).reason, 'already');
  assert.match(s.getItem(SAVE_KEY), /Played here since/);
});

test('applying a move over a shelf started at the new address keeps that one as a spare with Undo', () => {
  const startedHere = shelf(['Newbie'], 900);
  const s = new Storage({ [SAVE_KEY]: startedHere, [CLOUD_KEY]: JSON.stringify({ syncUser: 'u1', baseRev: 3 }), 'shelflife.tab': 'shelf' });
  const old = shelf(['Mabel', 'Grubbs'], 500);
  const r = applyIncoming(s, { [SAVE_KEY]: old, 'shelflife.tab': 'court', [CLOUD_KEY]: '{"syncUser":"other"}' }, { sha: 'b'.repeat(64), now: 42 });
  assert.deepEqual(r, { ok: true, took: true, spare: true, reason: 'bigger' });
  assert.equal(s.getItem(SAVE_KEY), old);
  assert.equal(s.getItem(SPARE_KEY), startedHere);
  assert.equal(s.getItem(SAFETY_KEY), startedHere, 'the Cloud sheet Undo swaps them');
  const cloud = JSON.parse(s.getItem(CLOUD_KEY));
  assert.equal(cloud.syncUser, 'u1', "this address's own cloud session is not replaced");
  assert.equal(cloud.dirty, true, 'so the cloud asks before swapping either shelf');
  assert.equal(cloud.safetyCopyAt, 42);
  assert.deepEqual(cloud.safetySummary.names, ['Newbie']);
  assert.equal(s.getItem('shelflife.tab'), 'shelf', 'settings here win');
  assert.match(arrivalLine(JSON.parse(s.getItem(NOTE_KEY))), /kept as a spare/);
});

test('a move that cannot fit changes nothing that matters, so the old address tries again later', () => {
  const here = shelf(['Newbie']);
  const s = new Storage({ [SAVE_KEY]: here }, here.length + 40);
  const r = applyIncoming(s, { [SAVE_KEY]: shelf(['Mabel', 'Grubbs', 'Pip']) }, { sha: 'c'.repeat(64) });
  assert.equal(r.ok, false);
  assert.equal(s.getItem(SAVE_KEY), here);
  assert.equal(s.getItem(APPLIED_KEY), null);
});

const fakeWin = (href, { online = true, entries = {}, native = false } = {}) => {
  const listeners = {};
  const win = {
    location: Object.assign(new URL(href), { replace(url) { win.went = String(url); } }),
    localStorage: new Storage(entries), sessionStorage: new Storage(),
    navigator: { onLine: online }, went: null,
    addEventListener: (t, fn) => { listeners[t] = fn; }, fire: t => listeners[t]?.(),
    Capacitor: native ? { isNativePlatform: () => true } : undefined
  };
  return win;
};

test('the gate: the old address hands over, then redirects, keeping invite links; never in the app or offline', () => {
  const to = 'https://shelf-life.vercel.app/';
  assert.equal(role({ to, from: [], origin: 'https://srmcno.github.io' }), 'old');
  assert.equal(role({ to, from: [], origin: 'https://shelf-life.vercel.app' }), 'none');
  assert.equal(role({ to: '', from: ['https://srmcno.github.io/ShelfLife/'], origin: 'https://shelf-life.vercel.app' }), 'new');
  assert.equal(role({ to: '', from: [], origin: 'https://x' }), 'none');

  const first = fakeWin('https://srmcno.github.io/ShelfLife/?invite=ABC#court', { entries: { [SAVE_KEY]: shelf(['Mabel']) } });
  assert.equal(gate(first, { to }), true);
  assert.equal(first.went, 'https://srmcno.github.io/ShelfLife/move.html');
  assert.equal(first.sessionStorage.getItem('shelflife-move.return'), '?invite=ABC#court');

  const moved = fakeWin('https://srmcno.github.io/ShelfLife/?invite=ABC', { entries: { [DONE_KEY]: JSON.stringify({ to, sha: 'x' }) } });
  assert.equal(gate(moved, { to }), true);
  assert.equal(moved.went, 'https://shelf-life.vercel.app/?invite=ABC');

  const offline = fakeWin('https://srmcno.github.io/ShelfLife/', { online: false, entries: { [DONE_KEY]: JSON.stringify({ to, sha: 'x' }) } });
  assert.equal(gate(offline, { to }), false, 'offline, the old address still plays');
  offline.fire('shelflife:storage');
  assert.equal(JSON.parse(offline.localStorage.getItem(DONE_KEY)).stale, true, 'and hands the newer shelf over next time');

  assert.equal(gate(fakeWin('https://srmcno.github.io/ShelfLife/', { native: true }), { to }), false);
  assert.equal(gate(fakeWin('https://shelf-life.vercel.app/'), { to }), false, 'the new address never redirects to itself');
  const stay = fakeWin('https://srmcno.github.io/ShelfLife/?stay=1');
  assert.equal(gate(stay, { to }), false);
  assert.equal(gate(stay, { to }), false, 'a failed move lets this tab play where it is');
});
