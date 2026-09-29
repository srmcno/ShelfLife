import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { createCloud } from '../src/cloud/client.js';
import { createSync, saveHash, shelfSummary, deviceKind, SAFETY_KEY, DEBOUNCE_MS, MAX_WAIT_MS, MIN_GAP_MS, SAFETY_MS } from '../src/cloud/sync.js';
import { createFakeSupabase, FAKE_CODE } from './support/fake-supabase.mjs';

const T0 = Date.UTC(2026, 8, 29, 12);
const flush = async () => { for (let i = 0; i < 25; i++) await new Promise(resolve => setImmediate(resolve)); };

function memory() {
  const items = new Map();
  return { items, full: new Set(), getItem: k => items.has(k) ? items.get(k) : null,
    setItem(k, v) { if (this.full.has(k)) throw new Error('QuotaExceededError'); items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
}
function shelf(names, souls = 0) {
  const s = blankState();
  s.pets = names.map((name, i) => ({ id: 'p' + i + name.toLowerCase(), name, art: { body: '', stamps: [] } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  s.mayhem.souls = souls;
  s.started = s.lastTick = T0 - 86400000;
  return normalizeState(s);
}
const names = state => state.pets.map(p => p.name);

// One device: its own storage, clock, timers and page events, sharing a fake server.
function device(fake, clock, local = shelf(['Agnes', 'Pip'])) {
  const storage = memory(), events = new EventTarget(), timers = new Map(), applied = [];
  let seq = 0, hidden = false;
  const cloud = createCloud({ config: fake.config, fetch: (...args) => fake.fetch(...args), storage, now: () => clock.now });
  const d = {
    storage, events, cloud, applied, fake,
    get local() { return local; }, set local(value) { local = value; },
    timers: {
      setTimeout(fn, ms) { const id = ++seq; timers.set(id, { fn, at: clock.now + ms }); return id; },
      clearTimeout(id) { timers.delete(id); }
    },
    pendingTimers: () => timers.size,
    async advance(ms) {
      const end = clock.now + ms;
      for (;;) {
        const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        clock.now = Math.max(clock.now, due[1].at);
        due[1].fn();
        await flush();
      }
      clock.now = end;
      await flush();
    },
    // The player touches something, and the game saves.
    async play(change = s => { s.pets[0].needs.food = Math.max(0, s.pets[0].needs.food - 1); }) {
      events.dispatchEvent(new Event('pointerdown'));
      change(local);
      events.dispatchEvent(new Event('shelflife:storage'));
      await flush();
    },
    async hide() { hidden = true; events.dispatchEvent(new Event('visibilitychange')); await flush(); },
    async show() { hidden = false; events.dispatchEvent(new Event('visibilitychange')); await flush(); },
    meta: () => cloud.meta()
  };
  d.sync = createSync({ cloud, getState: () => local, applyRemote: (next, detail) => { local = next; applied.push(detail.reason); return true; },
    events, storage, now: () => clock.now, timers: d.timers, hidden: () => hidden, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
  d.sync.start();
  return d;
}
function world() {
  const clock = { now: T0 };
  const fake = createFakeSupabase({ now: () => clock.now });
  return { clock, fake, device: local => device(fake, clock, local) };
}
const pushes = fake => fake.calls('/rest/v1/rpc/push_save').length;
async function emailAccount(d, email = 'mabel@example.com') {
  await d.cloud.requestEmailCode(email, { mode: 'signin' });
  await d.cloud.verifyEmailCode(email, FAKE_CODE);
  await flush();
}

test('hash, summary and device kind helpers', () => {
  assert.equal(saveHash('abc'), saveHash('abc'));
  assert.notEqual(saveHash('abc'), saveHash('abd'));
  assert.deepEqual(shelfSummary(shelf(['Agnes', 'Pip', 'Bitey', 'Velvet'], 12)), { residents: 4, names: ['Agnes', 'Pip', 'Bitey'], souls: 12, lastSaved: T0 - 86400000 });
  assert.equal(deviceKind('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'android');
  assert.equal(deviceKind('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'iphone');
  assert.equal(deviceKind('iphone-abc123def4'), 'iphone');
});

test('turning it on pushes the shelf when the cloud has nothing (a)', async () => {
  const { fake, device: make } = world();
  const d = make();
  assert.equal(d.sync.status(), 'off');
  assert.equal(fake.requests.length, 0, 'nothing is sent before the player opts in');
  const info = await d.sync.enable();
  assert.equal(info.status, 'idle');
  const row = fake.saves.get(d.cloud.userId());
  assert.equal(row.rev, 1);
  assert.deepEqual(names(row.data), ['Agnes', 'Pip']);
  assert.match(row.device_id, /^linux-[a-z0-9]{8}$/);
  assert.deepEqual(normalizeState(row.data).pets.map(p => p.id), d.local.pets.map(p => p.id), 'the cloud copy restores like a backup');
  const m = d.meta();
  assert.equal(m.baseRev, 1);
  assert.equal(m.syncUser, d.cloud.userId());
  assert.equal(m.lastPushHash, saveHash(JSON.stringify(d.local)));
  assert.equal(d.storage.getItem('shelflife.v4'), null, 'cloud bookkeeping never touches the save key');
});

test('checking an unchanged cloud copy fetches only its rev, not the whole shelf', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  const pulls = fake.calls('/rest/v1/rpc/pull_save').length;
  const info = await d.sync.syncNow();
  assert.equal(info.status, 'idle');
  assert.equal(fake.calls('/rest/v1/rpc/pull_save').length, pulls);
  assert.equal(fake.requests.at(-1).path, '/rest/v1/saves');
  assert.equal(fake.requests.at(-1).search, '?select=rev,device_id');
});

test('pushes wait 20 s after the last save, only follow player input, and skip unchanged shelves', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  const base = pushes(fake);
  // The game saving on its own (a tick) is not a reason to upload.
  d.local.lastTick += 30000;
  d.events.dispatchEvent(new Event('shelflife:storage'));
  await d.advance(DEBOUNCE_MS * 3);
  assert.equal(pushes(fake), base);
  await d.play();
  await d.advance(15000);
  await d.play();
  await d.advance(15000);
  assert.equal(pushes(fake), base, 'still inside the debounce');
  await d.advance(6000);
  assert.equal(pushes(fake), base + 1);
  assert.equal(fake.saves.get(d.cloud.userId()).rev, 2);
  // Input that changes nothing produces no upload: the hash matches.
  await d.play(() => {});
  await d.advance(DEBOUNCE_MS * 4);
  assert.equal(pushes(fake), base + 1);
  assert.equal(d.meta().dirty, false);
});

test('continuous play still pushes within the two minute ceiling', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  await d.advance(MAX_WAIT_MS);
  const base = pushes(fake);
  for (let i = 0; i < 14; i++) { await d.play(); await d.advance(10000); }
  assert.ok(pushes(fake) >= base + 1, 'a player who never pauses is still backed up');
  assert.ok(pushes(fake) <= base + 3, 'but not on every save');
});

test('hiding the page pushes straight away, and never two requests at once', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  let inFlight = 0, most = 0;
  const fetch = fake.fetch;
  fake.fetch = async (...args) => { inFlight++; most = Math.max(most, inFlight); try { return await fetch(...args); } finally { inFlight--; } };
  await d.play();
  const before = pushes(fake);
  await d.hide();
  d.events.dispatchEvent(new Event('pagehide'));
  d.sync.syncNow();
  d.sync.push();
  await flush();
  assert.equal(pushes(fake), before + 1);
  assert.equal(most, 1);
  assert.equal(d.pendingTimers(), 0);
});

test('a newer cloud copy arrives quietly on a device nobody touched, and a device with no residents takes the cloud copy (b)', async () => {
  const { fake, clock, device: make } = world();
  const phone = make(shelf(['Agnes', 'Pip'], 5));
  await emailAccount(phone);
  await phone.sync.enable();
  // The browser signs in to the same account with an empty shelf: (b).
  const browser = make(blankState());
  await emailAccount(browser);
  await browser.sync.check();
  assert.deepEqual(browser.applied, ['arrived']);
  assert.deepEqual(names(browser.local), ['Agnes', 'Pip']);
  assert.equal(browser.sync.status(), 'idle');
  assert.equal(browser.meta().baseRev, 1);
  // The phone plays on; the untouched browser catches up when it is looked at again.
  await phone.play(s => { s.mayhem.souls = 40; });
  await phone.advance(MIN_GAP_MS);
  assert.equal(fake.saves.get(phone.cloud.userId()).rev, 2);
  clock.now += 120000;
  await browser.hide();
  await browser.show();
  assert.deepEqual(browser.applied, ['arrived', 'newer']);
  assert.equal(browser.local.mayhem.souls, 40);
  assert.equal(browser.meta().baseRev, 2);
});

test('two shelves that both moved on become a question, never a merge (c), and keeping the cloud copy can be undone', async () => {
  const { fake, device: make } = world();
  const phone = make(shelf(['Agnes', 'Pip'], 5));
  await emailAccount(phone);
  await phone.sync.enable();
  const browser = make(shelf(['Mothball', 'Cricket', 'Doreen'], 70));
  await emailAccount(browser);
  const info = await browser.sync.check();
  assert.equal(info.status, 'conflict');
  assert.equal(pushes(fake), 1, 'nothing was written while undecided');
  assert.deepEqual(info.conflict.local, { residents: 3, names: ['Mothball', 'Cricket', 'Doreen'], souls: 70, lastSaved: T0 - 86400000 });
  assert.equal(info.conflict.remote.residents, 2);
  assert.equal(info.conflict.remote.device, 'linux');
  assert.equal(Date.parse(fake.saves.get(browser.cloud.userId()).updated_at), info.conflict.remote.lastSaved);
  // Background saves wait for the decision.
  await browser.play();
  await browser.advance(DEBOUNCE_MS * 5);
  assert.equal(pushes(fake), 1);

  const chosen = await browser.sync.resolve('cloud');
  assert.equal(chosen.status, 'idle');
  assert.deepEqual(names(browser.local), ['Agnes', 'Pip']);
  assert.deepEqual(browser.applied, ['chosen']);
  assert.deepEqual(names(JSON.parse(browser.storage.getItem(SAFETY_KEY))), ['Mothball', 'Cricket', 'Doreen']);
  assert.equal(chosen.safetyCopy.residents, 3);
  assert.equal(chosen.safetyCopy.until, browser.meta().safetyCopyAt + SAFETY_MS);
  assert.equal(pushes(fake), 1, 'taking the cloud copy writes nothing to the cloud');

  const undone = await browser.sync.undo();
  assert.equal(undone.status, 'idle');
  assert.deepEqual(names(browser.local), ['Mothball', 'Cricket', 'Doreen']);
  assert.deepEqual(names(fake.saves.get(browser.cloud.userId()).data), ['Mothball', 'Cricket', 'Doreen']);
  assert.deepEqual(names(JSON.parse(browser.storage.getItem(SAFETY_KEY))), ['Agnes', 'Pip'], 'undo swaps, so nothing is lost either way');
});

test('keeping this device overwrites the cloud only after keeping the cloud copy aside', async () => {
  const { fake, device: make } = world();
  const phone = make(shelf(['Agnes', 'Pip']));
  await emailAccount(phone);
  await phone.sync.enable();
  const browser = make(shelf(['Mothball']));
  await emailAccount(browser);
  await browser.sync.check();
  const kept = await browser.sync.resolve('local');
  assert.equal(kept.status, 'idle');
  const row = fake.saves.get(browser.cloud.userId());
  assert.equal(row.rev, 2);
  assert.deepEqual(names(row.data), ['Mothball']);
  assert.deepEqual(names(JSON.parse(browser.storage.getItem(SAFETY_KEY))), ['Agnes', 'Pip']);
  assert.deepEqual(names(browser.local), ['Mothball']);
});

test('a push that meets a newer cloud copy asks instead of overwriting', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  fake.setRemote(d.cloud.userId(), shelf(['Gladys', 'Snag']), { device: 'iphone-abcdef1234' });
  await d.play();
  await d.advance(MIN_GAP_MS);
  assert.equal(d.sync.status(), 'conflict');
  assert.equal(d.sync.info().conflict.remote.device, 'iphone');
  assert.deepEqual(names(fake.saves.get(d.cloud.userId()).data), ['Gladys', 'Snag']);
  assert.deepEqual(names(d.local), ['Agnes', 'Pip']);
});

test('a cloud copy this device wrote itself is not a conflict', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  // The reply to a push sent as the page closed never arrived.
  fake.setRemote(d.cloud.userId(), d.local, { device: d.sync.deviceId() });
  await d.play();
  const info = await d.sync.syncNow();
  assert.equal(info.status, 'idle');
  assert.equal(fake.saves.get(d.cloud.userId()).rev, 3);
  assert.equal(d.meta().baseRev, 3);
});

test('a corrupt cloud copy is refused and the local shelf is kept', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  fake.setRemote(d.cloud.userId(), { pets: [{ id: 'constructor' }] });
  const before = JSON.stringify(d.local);
  const info = await d.sync.syncNow();
  assert.equal(info.status, 'error');
  assert.equal(info.error.code, 'corrupt_remote');
  assert.equal(info.repairable, true);
  assert.deepEqual(d.applied, []);
  assert.equal(JSON.stringify(d.local), before);
  // Playing on neither overwrites it quietly nor forgets why sync stopped.
  await d.play();
  await d.advance(MIN_GAP_MS);
  assert.equal(d.sync.info().error.code, 'corrupt_remote');
  assert.equal(fake.saves.get(d.cloud.userId()).rev, 2);
  // The player may replace it with the healthy shelf.
  const repaired = await d.sync.resolve('local');
  assert.equal(repaired.status, 'idle');
  assert.deepEqual(names(fake.saves.get(d.cloud.userId()).data), ['Agnes', 'Pip']);
});

test('a full browser still lets the player choose, and says no spare was kept', async () => {
  const { device: make } = world();
  const phone = make(shelf(['Agnes']));
  await emailAccount(phone);
  await phone.sync.enable();
  const browser = make(shelf(['Mothball']));
  browser.storage.full.add(SAFETY_KEY);
  await emailAccount(browser);
  await browser.sync.check();
  const info = await browser.sync.resolve('cloud');
  assert.equal(info.status, 'idle');
  assert.equal(info.safetyCopyFailed, true);
  assert.equal(info.safetyCopy, null);
  assert.deepEqual(names(browser.local), ['Agnes']);
});

test('offline pushes fail quietly, keep the changes pending, and go through later', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  fake.setOffline(true);
  await d.play();
  await d.advance(MIN_GAP_MS);
  assert.equal(d.sync.status(), 'offline');
  assert.equal(d.meta().dirty, true);
  assert.equal(fake.saves.get(d.cloud.userId()).rev, 1);
  fake.setOffline(false);
  d.events.dispatchEvent(new Event('online'));
  await flush();
  assert.equal(d.sync.status(), 'idle');
  assert.equal(fake.saves.get(d.cloud.userId()).rev, 2);
  // Server trouble is an error, retried on a timer rather than announced.
  await d.play();
  fake.failNext(1, 500);
  await d.advance(MIN_GAP_MS);
  assert.equal(d.sync.status(), 'error');
  await d.advance(30000);
  assert.equal(d.sync.status(), 'idle');
  assert.equal(fake.saves.get(d.cloud.userId()).rev, 3);
});

test('an oversized shelf is refused before any upload', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  const before = fake.requests.length;
  await d.play(s => { s.pets[0].art.body = 'data:image/png;base64,' + 'A'.repeat(5600000); });
  await d.advance(MIN_GAP_MS);
  assert.equal(d.sync.info().error.code, 'too_large');
  assert.equal(fake.requests.length, before);
});

test('a lost session turns cloud save off without touching the shelf', async () => {
  const { fake, device: make } = world();
  const d = make();
  await d.sync.enable();
  fake.expireTokens();
  fake.revokeRefreshTokens();
  const info = await d.sync.syncNow();
  assert.equal(info.status, 'off');
  assert.equal(info.error.code, 'session_expired');
  assert.deepEqual(names(d.local), ['Agnes', 'Pip']);
});

test('signing in to a different account starts over with that account (first contact)', async () => {
  const { fake, device: make } = world();
  const phone = make(shelf(['Agnes']));
  await emailAccount(phone, 'other@example.com');
  await phone.sync.enable();
  const d = make(shelf(['Mothball']));
  await d.sync.enable();
  await emailAccount(d, 'other@example.com');
  await d.sync.check();
  assert.equal(d.sync.status(), 'conflict');
  assert.equal(fake.saves.size, 2);
});

test('signing out stops the copying and keeps the shelf; deleting ends the account and the bookkeeping', async () => {
  const { fake, device: make } = world();
  const d = make();
  await emailAccount(d);
  await d.sync.enable();
  await d.sync.signOut();
  assert.equal(d.sync.status(), 'off');
  const before = fake.requests.length;
  await d.play();
  await d.advance(DEBOUNCE_MS * 3);
  await d.hide();
  assert.equal(fake.requests.length, before);
  assert.deepEqual(names(d.local), ['Agnes', 'Pip']);
  // Back in, the same account carries on from where it was.
  await emailAccount(d);
  await d.sync.check();
  assert.equal(d.sync.status(), 'idle');
  const id = d.cloud.userId();
  const info = await d.sync.deleteAccount();
  assert.equal(info.status, 'off');
  assert.equal(fake.users.has(id), false);
  assert.equal(fake.saves.has(id), false);
  assert.deepEqual(names(d.local), ['Agnes', 'Pip']);
  assert.equal(d.meta().baseRev, 0);
  assert.equal(d.meta().syncUser, undefined);
});

test('an old safety copy is dropped after a week', async () => {
  const { clock, device: make } = world();
  const phone = make(shelf(['Agnes']));
  await emailAccount(phone);
  await phone.sync.enable();
  const browser = make(shelf(['Mothball']));
  await emailAccount(browser);
  await browser.sync.check();
  await browser.sync.resolve('cloud');
  assert.ok(browser.storage.getItem(SAFETY_KEY));
  clock.now += SAFETY_MS + 1;
  assert.equal(browser.sync.info().safetyCopy, null);
  browser.sync.stop();
  browser.sync.start();
  assert.equal(browser.storage.getItem(SAFETY_KEY), null);
});
