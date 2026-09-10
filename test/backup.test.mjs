import { test } from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { blankState, normalizeState } from '../src/state.js';
import { createBackup, backupEmail, shareBackup, shareableBackup, PLAY_URL } from '../src/backup.js';
import { initBackupTransfer } from '../src/ui/backup.js';

test('backup is a complete, immutable snapshot that restores through the existing importer', async () => {
  const state = blankState();
  state.pets = [{ id: 'p1', name: 'Doodle 🦉', traits: [], needs: { food: 70, fuss: 80, clean: 90 }, bond: 7,
    art: { body: 'data:image/png;base64,AAA', stamps: [] }, handshakes: 4 }];
  state.slots[0] = 'p1';
  const original = JSON.stringify(state), now = Date.now();
  const backup = createBackup(state, now);
  assert.equal(JSON.stringify(state), original);
  assert.deepEqual(JSON.parse(backup.text), { ...state, lastBackup: now });
  state.pets[0].name = 'Changed after export';
  for (const type of ['application/json', 'text/plain']) {
    const file = shareableBackup(backup, { share() {}, canShare: ({ files }) => files[0].type === type }, File);
    const restored = normalizeState(JSON.parse(await file.text()));
    assert.equal(restored.pets[0].name, 'Doodle 🦉');
    assert.equal(restored.pets[0].handshakes, 4);
    assert.equal(restored.pets[0].bond, 7);
    assert.equal(restored.pets[0].art.body, 'data:image/png;base64,AAA');
    assert.equal(restored.slots[0], 'p1');
    assert.equal(restored.lastBackup, now);
  }
});

test('JSON is preferred, with a text file containing identical data when JSON is rejected', async () => {
  const backup = createBackup(blankState());
  const json = shareableBackup(backup, { share() {}, canShare: () => true }, File);
  assert.equal(json.name, backup.name);
  const txt = shareableBackup(backup, { share() {}, canShare: ({ files }) => files[0].type === 'text/plain' }, File);
  assert.match(txt.name, /\.txt$/);
  assert.equal(await txt.text(), backup.text);
});

test('unsupported and restricted browsers do not send a link without the actual save file', async () => {
  let sent = 0;
  const backup = createBackup(blankState());
  for (const nav of [{}, { share() { sent++; } }, { share() { sent++; }, canShare: () => false },
    { share() { sent++; }, canShare() { throw new Error('blocked'); } }]) {
    assert.equal(await shareBackup(backup, nav, File), 'unsupported');
  }
  assert.equal(sent, 0);
});

test('sharing starts synchronously from the gesture and passes the file plus restore instructions', async () => {
  let payload;
  const backup = createBackup(blankState());
  const result = shareBackup(backup, { canShare: () => true, share(data) { payload = data; return Promise.resolve(); } }, File);
  assert.ok(payload, 'share invoked before returning a promise to the caller');
  assert.equal(await payload.files[0].text(), backup.text);
  assert.ok(payload.text.includes(PLAY_URL));
  assert.match(payload.text, /More → Restore/);
  assert.equal(await result, 'shared');
});

test('cancel and share errors are distinct from a successful handoff', async () => {
  for (const [name, expected] of [['AbortError', 'cancelled'], ['NotAllowedError', 'failed'], ['DataError', 'failed']]) {
    const nav = { canShare: () => true, share() { throw Object.assign(new Error(name), { name }); } };
    assert.equal(await shareBackup(createBackup(blankState()), nav, File), expected);
  }
});

test('email draft is correctly encoded and asks for the attachment without embedding save data', () => {
  const backup = createBackup(blankState(), Date.UTC(2026, 8, 10, 12, 30));
  assert.match(backup.name, /^shelf-life-backup-2026-09-10T12-30-00-000Z\.json$/);
  const mail = new URL(backupEmail(backup.name));
  assert.equal(mail.protocol, 'mailto:');
  assert.equal(mail.searchParams.get('subject'), 'My Shelf Life backup');
  assert.match(mail.searchParams.get('body'), /Attach shelf-life-backup-/);
  assert.match(mail.searchParams.get('body'), /not automatic sync/);
  assert.ok(!mail.href.includes(encodeURIComponent(backup.text)));
});

test('transfer controls preserve the email attachment name and only mark successful handoffs', async () => {
  const previousDocument = globalThis.document;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const listeners = new Map();
      elements.set(id, { hidden: true, disabled: false, textContent: '', classList: { add() {}, remove() {} },
        addEventListener: (name, handler) => listeners.set(name, handler),
        fire: name => listeners.get(name)?.({}) });
    }
    return elements.get(id);
  };
  let settle, attempts = 0, downloads = [], marked = [];
  const state = blankState();
  globalThis.document = { getElementById: element, addEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    canShare: () => true, share() { attempts++; return new Promise((resolve, reject) => { settle = { resolve, reject }; }); }
  } });
  try {
    initBackupTransfer({ state, download: (text, name) => downloads.push({ text, name }), markBackup: created => marked.push(created) });
    const share = element('transferShare'), download = element('transferDownload'), email = element('transferEmail');
    const cancelled = share.fire('click');
    assert.equal(share.disabled, true);
    assert.equal(download.disabled, true);
    await share.fire('click');
    assert.equal(attempts, 1, 'repeated taps cannot launch simultaneous shares');
    settle.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    await cancelled;
    assert.equal(marked.length, 0);
    assert.equal(downloads.length, 0, 'cancellation does not silently download');
    assert.equal(share.disabled, false);
    const failed = share.fire('click'); settle.reject(new Error('no permission')); await failed;
    assert.equal(marked.length, 0);
    const handedOff = share.fire('click'); settle.resolve(); await handedOff;
    assert.equal(marked.length, 1);
    assert.match(element('transferStatus').textContent, /cannot confirm delivery/);
    download.fire('click');
    assert.equal(downloads.length, 1);
    assert.equal(marked.length, 2);
    assert.equal(email.hidden, false);
    assert.ok(new URL(email.href).searchParams.get('body').includes(downloads[0].name));
    assert.equal(element('transferFilename').textContent, downloads[0].name);
  } finally {
    globalThis.document = previousDocument;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
  }
});
