import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';

test('desktop narration selects enhanced speech, cancels late audio, and falls back cleanly', async () => {
  const old = { window: globalThis.window, fetch: globalThis.fetch, Audio: globalThis.Audio, SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance };
  const browserVoice = { name: 'Daniel', lang: 'en-GB', voiceURI: 'basic', localService: true };
  const browserLines = [];
  const audio = [];
  let pendingResponse;
  const synth = { getVoices: () => [browserVoice], addEventListener() {}, cancel() {}, speak: u => browserLines.push(u) };
  globalThis.window = { speechSynthesis: synth, location: { hostname: '127.0.0.1' }, dispatchEvent() {} };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.Audio = class {
    constructor(src) { this.src = src; this.played = false; audio.push(this); }
    async play() { this.played = true; }
    pause() { this.paused = true; }
    removeAttribute() {}
  };
  globalThis.fetch = async url => url === '/api/voice'
    ? { ok: true, json: async () => ({ available: true, name: 'Daniel (Enhanced)' }) }
    : new Promise(resolve => { pendingResponse = resolve; });
  const narrator = await import('../src/audio/narrator.js');
  try {
    narrator.initNarrator();
    await nextTurn();
    assert.equal(narrator.pickBestVoice().name, 'Daniel (Enhanced)');
    assert.equal(narrator.voiceQualityHint(), null);
    narrator.speakPreview('A little funeral.');
    pendingResponse({ ok: true, blob: async () => new Blob(['RIFF']) });
    await nextTurn();
    assert.equal(audio.length, 1);
    assert.equal(audio[0].played, true);
    assert.equal(browserLines.length, 0);
    narrator.stopSpeech();
    assert.equal(audio[0].paused, true);
    narrator.speakPreview('Cancel this line.');
    narrator.stopSpeech();
    pendingResponse({ ok: true, blob: async () => new Blob(['RIFF']) });
    await nextTurn();
    assert.equal(audio.length, 1, 'cancelled generation must never play late');
    narrator.speakPreview('Service unavailable.');
    pendingResponse({ ok: false });
    await nextTurn();
    assert.equal(browserLines.length, 1);
    assert.equal(browserLines[0].voice, browserVoice);
  } finally {
    narrator.stopSpeech();
    Object.assign(globalThis, old);
  }
});
