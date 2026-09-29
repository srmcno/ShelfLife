import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { readFileSync, existsSync } from 'node:fs';
import {
  isNative, plugin, shareFile, saveFile, shareText, openExternal, externalTarget, initNative, backAction,
  deviceVoices, speak, stopSpeaking, speechAvailable, hideSplash, minimizeApp
} from '../src/native.js';
import { PLAY_URL } from '../src/backup.js';

// A stand-in for what Capacitor's Android bridge puts on window, recording every call.
function fakeCapacitor({ native = true, plugins = {} } = {}) {
  const calls = [], listeners = {};
  const record = (name, method, result) => async arg => { calls.push([name, method, arg]); return typeof result === 'function' ? result(arg) : result; };
  const all = {
    Filesystem: { writeFile: record('Filesystem', 'writeFile', arg => ({ uri: 'file:///cache/' + arg.path })) },
    Share: { share: record('Share', 'share', { activityType: 'com.google.android.gm' }) },
    Browser: { open: record('Browser', 'open') },
    App: {
      addListener: (event, fn) => { calls.push(['App', 'addListener', event]); listeners[event] = fn; return { remove: async () => {} }; },
      minimizeApp: record('App', 'minimizeApp')
    },
    SplashScreen: { hide: record('SplashScreen', 'hide') },
    TextToSpeech: {
      getSupportedVoices: record('TextToSpeech', 'getSupportedVoices', { voices: [
        { voiceURI: 'de-de-x-deb-local', name: 'German Germany', lang: 'de-DE', localService: true },
        { voiceURI: 'en-gb-x-rjs-local', name: 'English United Kingdom', lang: 'en-GB', localService: true },
        { voiceURI: 'en-us-x-iol-network', name: 'English United States', lang: 'en-US', localService: false }
      ] }),
      speak: record('TextToSpeech', 'speak'),
      stop: record('TextToSpeech', 'stop')
    },
    ...plugins
  };
  globalThis.Capacitor = { isNativePlatform: () => native, getPlatform: () => native ? 'android' : 'web', Plugins: all };
  return { calls, listeners, plugins: all, of: name => calls.filter(c => c[0] === name) };
}
const reset = () => { delete globalThis.Capacitor; };

test('in a browser every native path is inert and says so', async () => {
  reset();
  assert.equal(isNative(), false);
  assert.equal(plugin('Share'), null);
  assert.equal(await shareFile({ name: 'x.json', data: '{}' }), 'unsupported');
  assert.equal(await saveFile({ name: 'x.json', data: '{}' }), 'unsupported');
  let assigned = null;
  assert.equal(await openExternal('https://example.com/', { assign: url => { assigned = url; } }), false);
  assert.equal(assigned, null);
  assert.equal(initNative({ closeSheet: () => true }), false);
  assert.equal(speechAvailable(), false);
  assert.deepEqual(await deviceVoices(), []);
  hideSplash(); minimizeApp(); stopSpeaking();
  // The nudges tests fake LocalNotifications without claiming to be native; that is still the web.
  const fake = fakeCapacitor({ native: false });
  assert.equal(isNative(), false);
  assert.equal(await shareFile({ name: 'x.json', data: '{}' }), 'unsupported');
  assert.deepEqual(fake.calls, []);
  reset();
});

test('a backup is written to the cache as text and handed to the share sheet', async () => {
  const fake = fakeCapacitor();
  try {
    const result = await shareFile({ name: 'shelf life backup.json', data: '{"pets":[]}', title: 'My Shelf Life backup', text: 'Restore it with More, Restore.', dialogTitle: 'Send your shelf' });
    assert.equal(result, 'shared');
    assert.deepEqual(fake.of('Filesystem')[0][2], { path: 'shelf-life/shelf-life-backup.json', data: '{"pets":[]}', directory: 'CACHE', encoding: 'utf8', recursive: true });
    assert.deepEqual(fake.of('Share')[0][2], { title: 'My Shelf Life backup', text: 'Restore it with More, Restore.', files: ['file:///cache/shelf-life/shelf-life-backup.json'], dialogTitle: 'Send your shelf' });
    await saveFile({ name: 'b.json', data: '{}' });
    assert.equal(fake.of('Share')[1][2].dialogTitle, 'Keep a copy somewhere safe');
  } finally { reset(); }
});

test('a postcard is written as base64 bytes, with no text encoding', async () => {
  const fake = fakeCapacitor();
  const oldReader = globalThis.FileReader;
  globalThis.FileReader = class {
    readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = 'data:image/png;base64,' + Buffer.from(buffer).toString('base64'); this.onload(); }); }
  };
  try {
    assert.equal(await shareFile({ name: 'shelf-life-day-3.png', blob: new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }) }), 'shared');
    const write = fake.of('Filesystem')[0][2];
    assert.equal(write.data, Buffer.from([137, 80, 78, 71]).toString('base64'));
    assert.equal(write.encoding, undefined);
    assert.equal(write.directory, 'CACHE');
  } finally { globalThis.FileReader = oldReader; reset(); }
});

test('a cancelled share, a refused share and an unwritable cache are told apart', async () => {
  fakeCapacitor({ plugins: { Share: { share: async () => { throw new Error('Share canceled'); } } } });
  assert.equal(await shareFile({ name: 'a.json', data: '{}' }), 'cancelled');
  fakeCapacitor({ plugins: { Share: { share: async () => { throw new Error('No Activity found'); } } } });
  assert.equal(await shareFile({ name: 'a.json', data: '{}' }), 'failed');
  const fake = fakeCapacitor({ plugins: { Filesystem: { writeFile: async () => { throw new Error('disk full'); } } } });
  assert.equal(await shareFile({ name: 'a.json', data: '{}' }), 'failed');
  assert.equal(fake.of('Share').length, 0, 'nothing is shared when the file was never written');
  fakeCapacitor({ plugins: { Share: undefined } });
  assert.equal(await shareFile({ name: 'a.json', data: '{}' }), 'unsupported');
  reset();
});

test('a friend code goes to the share sheet as words and a link, with no file', async () => {
  reset();
  assert.equal(await shareText({ text: 'My friend code is ABCD EFGH.' }), 'unsupported');
  const fake = fakeCapacitor();
  try {
    assert.equal(await shareText({ text: 'My friend code is ABCD EFGH.', url: PLAY_URL, dialogTitle: 'Send your friend code' }), 'shared');
    assert.deepEqual(fake.of('Share')[0][2], { title: 'Shelf Life', text: 'My friend code is ABCD EFGH.', url: PLAY_URL, dialogTitle: 'Send your friend code' });
    assert.equal(fake.of('Filesystem').length, 0);
  } finally { reset(); }
});

test('pages outside the game open in the browser tab; mailto goes to the system', async () => {
  const fake = fakeCapacitor();
  try {
    const assigned = [];
    const assign = url => assigned.push(url);
    assert.equal(await openExternal('https://github.com/srmcno/ShelfLife/issues/new/choose', { assign }), true);
    assert.deepEqual(fake.of('Browser')[0][2], { url: 'https://github.com/srmcno/ShelfLife/issues/new/choose' });
    await openExternal('mailto:?subject=Backup', { assign });
    assert.deepEqual(assigned, ['mailto:?subject=Backup']);
    fakeCapacitor({ plugins: { Browser: undefined } });
    await openExternal('https://example.com/', { assign });
    assert.deepEqual(assigned, ['mailto:?subject=Backup', 'https://example.com/']);
  } finally { reset(); }
});

test('only other sites and new-tab site pages count as leaving the game', () => {
  const here = 'https://localhost/index.html';
  const a = (href, target = '') => ({ target, getAttribute: () => href });
  assert.equal(externalTarget(a('https://github.com/srmcno/ShelfLife/issues/new/choose'), here), 'https://github.com/srmcno/ShelfLife/issues/new/choose');
  assert.equal(externalTarget(a('privacy.html', '_blank'), here), PLAY_URL + 'privacy.html');
  assert.equal(externalTarget(a('delete-account.html#steps', '_blank'), here), PLAY_URL + 'delete-account.html#steps');
  assert.equal(externalTarget(a('index.html'), here), null);
  assert.equal(externalTarget(a('#cabinet'), here), null);
  assert.equal(externalTarget(a('mailto:?subject=x'), here), null, 'Capacitor already sends mailto: to the mail app');
  assert.equal(externalTarget(null, here), null);
});

test('Back closes the open sheet first, and only minimises (after saving) when none is open', async () => {
  const fake = fakeCapacitor();
  const order = [];
  let sheetOpen = true;
  const win = new EventTarget();
  const doc = { documentElement: { classList: { add: cls => order.push('class ' + cls) } }, addEventListener: () => {} };
  try {
    assert.equal(initNative({ closeSheet: () => { order.push('close'); const was = sheetOpen; sheetOpen = false; return was; }, save: () => order.push('save'), win, doc }), true);
    assert.deepEqual(fake.of('App').map(c => c[2]), ['backButton', 'pause', 'resume']);
    fake.listeners.backButton({ canGoBack: false });
    await nextTurn();
    assert.deepEqual(order, ['class native-app', 'close']);
    assert.equal(fake.of('App').filter(c => c[1] === 'minimizeApp').length, 0);
    fake.listeners.backButton({ canGoBack: false });
    await nextTurn();
    assert.deepEqual(order, ['class native-app', 'close', 'close', 'save']);
    assert.equal(fake.of('App').filter(c => c[1] === 'minimizeApp').length, 1);
    // Pause and resume reach the page as window events the game already listens for.
    const heard = [];
    win.addEventListener('shelflife:pause', () => heard.push('pause'));
    win.addEventListener('shelflife:resume', () => heard.push('resume'));
    fake.listeners.pause(); fake.listeners.resume();
    assert.deepEqual(heard, ['pause', 'resume']);
    // A save that throws never traps the player in the app.
    assert.equal(backAction({ closeSheet: () => false, save: () => { throw new Error('quota'); } }), 'minimised');
  } finally { reset(); }
});

test('speech goes to the phone engine with the voice index it listed', async () => {
  const fake = fakeCapacitor();
  try {
    assert.equal(speechAvailable(), true);
    const voices = await deviceVoices();
    assert.deepEqual(voices.map(v => [v.voiceURI, v.index]), [['de-de-x-deb-local', 0], ['en-gb-x-rjs-local', 1], ['en-us-x-iol-network', 2]]);
    await speak({ text: 'Somebody has found the rat poison.', lang: 'en-GB', rate: 0.95, pitch: 0.97, volume: 0.95, voice: 1 });
    assert.deepEqual(fake.of('TextToSpeech').at(-1)[2], { text: 'Somebody has found the rat poison.', lang: 'en-GB', rate: 0.95, pitch: 0.97, volume: 0.95, queueStrategy: 0, voice: 1 });
    await speak({ text: 'Default voice.', voice: -1 });
    assert.equal('voice' in fake.of('TextToSpeech').at(-1)[2], false);
    stopSpeaking(); hideSplash();
    await nextTurn();
    assert.equal(fake.of('TextToSpeech').at(-1)[1], 'stop');
    assert.equal(fake.of('SplashScreen').length, 1);
  } finally { reset(); }
});

test('the narrator reads notes through the phone engine in the app, and stops it', async () => {
  const fake = fakeCapacitor();
  const old = { window: globalThis.window, document: globalThis.document };
  const nodes = new Map(['narratorBtn', 'voiceBtn', 'voiceHint', 'voicePlayback'].map(id => [id, { hidden: false, textContent: '' }]));
  globalThis.document = { hidden: false, getElementById: id => nodes.get(id) || null };
  globalThis.window = Object.assign(new EventTarget(), { location: { hostname: 'localhost' }, speechSynthesis: { getVoices: () => { throw new Error('the WebView voice list must not be used'); } } });
  const { state } = await import('../src/state.js');
  const wasOn = state.settings.narratorOn;
  state.settings.narratorOn = true;
  try {
    const narrator = await import('../src/audio/narrator.js?native-app');
    assert.equal(narrator.initNarrator(), true);
    await new Promise(resolve => setTimeout(resolve, 10));
    const best = narrator.pickBestVoice();
    assert.equal(best.lang, 'en-GB');
    assert.equal(best.device, true);
    assert.equal(narrator.availableVoices().some(v => /^de/.test(v.lang)), false, 'only English voices are offered');
    assert.equal(narrator.voiceQualityHint(), null);
    assert.equal(narrator.speakPreview('A small funeral for a raisin.'), true);
    await nextTurn();
    const call = fake.of('TextToSpeech').find(c => c[1] === 'speak')[2];
    assert.equal(call.text, 'A small funeral for a raisin.');
    assert.equal(call.lang, 'en-GB');
    assert.equal(call.voice, 1);
    assert.equal(call.rate, narrator.PROSODY.rate);
    narrator.stopSpeech();
    await nextTurn();
    assert.equal(fake.of('TextToSpeech').at(-1)[1], 'stop');
    assert.equal(nodes.get('narratorBtn').hidden, false);
  } finally {
    state.settings.narratorOn = wasOn;
    Object.assign(globalThis, old);
    reset();
  }
});

test('an app without a speech engine hides the narrator instead of failing', async () => {
  fakeCapacitor({ plugins: { TextToSpeech: undefined } });
  const old = { window: globalThis.window, document: globalThis.document };
  const nodes = new Map(['narratorBtn', 'voiceBtn', 'voiceHint'].map(id => [id, { hidden: false }]));
  globalThis.document = { hidden: false, getElementById: id => nodes.get(id) || null };
  globalThis.window = Object.assign(new EventTarget(), { location: { hostname: 'localhost' } });
  try {
    const narrator = await import('../src/audio/narrator.js?native-no-speech');
    assert.equal(narrator.initNarrator(), false);
    for (const node of nodes.values()) assert.equal(node.hidden, true);
    assert.equal(narrator.speak('Nobody will hear this.', { force: true }), false);
  } finally {
    Object.assign(globalThis, old);
    reset();
  }
});

test('nudges go to a channel that exists, scheduled inexactly', async () => {
  const { syncNudges, NUDGE_CHANNEL } = await import('../src/notify.js');
  const { householdFixture } = await import('./household-fixtures.mjs');
  const s = householdFixture('established');
  s.settings.nudges = true;
  const calls = [];
  const plugin = { cancel: async () => calls.push(['cancel']), createChannel: async arg => calls.push(['channel', arg]), schedule: async arg => calls.push(['schedule', arg]) };
  assert.ok(await syncNudges(s, plugin, Date.now()) > 0);
  assert.deepEqual(calls.map(c => c[0]), ['cancel', 'channel', 'schedule']);
  assert.equal(calls[1][1].id, 'shelf');
  for (const n of calls[2][1].notifications) {
    assert.equal(n.channelId, NUDGE_CHANNEL.id);
    assert.equal(n.isExactNotification, false);
  }
});

test('the Android project asks for notifications but never for exact alarms, and has the icon it names', () => {
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS"\s*\/>/);
  for (const exact of ['SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']) {
    assert.match(manifest, new RegExp('android\\.permission\\.' + exact + '"\\s+tools:node="remove"'), exact + ' must be removed from the merged manifest');
  }
  assert.doesNotMatch(manifest, /screenOrientation/, 'orientation stays unlocked');
  const config = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(config.appId, 'io.github.srmcno.shelflife');
  assert.equal(config.webDir, 'dist');
  assert.equal(config.plugins.SystemBars.style, 'DARK', 'light status bar icons on the dark room');
  assert.ok(existsSync(new URL('../android/app/src/main/res/drawable/' + config.plugins.LocalNotifications.smallIcon + '.xml', import.meta.url)));
  assert.match(readFileSync(new URL('../android/variables.gradle', import.meta.url), 'utf8'), /targetSdkVersion = 36/);
});
