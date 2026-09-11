import test from 'node:test';
import assert from 'node:assert/strict';
import { state, setState, blankState, normalizeState, addNote } from '../src/state.js';

test('new, missing, and invalid narrator settings default off while explicit opt-in survives restore', () => {
  assert.equal(blankState().settings.narratorOn, false);
  assert.equal(normalizeState({ pets: [] }).settings.narratorOn, false);
  for (const value of [undefined, null, 'true', 'false', 0, 1, {}, []]) {
    assert.equal(normalizeState({ pets: [], settings: { narratorOn: value } }).settings.narratorOn, false);
  }
  for (const narratorOn of [true, false]) {
    const restored = normalizeState({ pets: [], settings: { narratorOn, narratorVoiceURI: 'chosen-voice', muted: true } });
    assert.equal(restored.settings.narratorOn, narratorOn);
    assert.equal(restored.settings.narratorVoiceURI, 'chosen-voice');
    assert.equal(restored.settings.muted, true);
  }
});

test('default boot and later voice arrival stay silent and hide voice advice until the player opts in', async t => {
  const oldState = state;
  const old = { window: globalThis.window, document: globalThis.document, SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance };
  const spoken = [], voiceListeners = [];
  let voices = [];
  const nodes = new Map(['voiceBtn', 'voiceVeil', 'voiceSelect', 'voiceMeta', 'voiceUpgrade', 'voiceHint', 'voiceHintText'].map(id => [id, {
    hidden: true, textContent: '', innerHTML: '', value: '', addEventListener() {},
    classList: { contains: () => false }
  }]));
  globalThis.document = { hidden: false, getElementById: id => nodes.get(id) || null };
  globalThis.window = { location: { hostname: 'srmcno.github.io' }, addEventListener() {},
    speechSynthesis: { getVoices: () => voices, addEventListener: (_, callback) => voiceListeners.push(callback),
      speak: utterance => spoken.push(utterance.text), cancel() {} } };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  setState(blankState());
  const narrator = await import('../src/audio/narrator.js');
  try {
    assert.equal(narrator.initNarrator(), true);
    assert.ok(narrator.initNarratorUI());
    addNote(state, 'A resident arrived.', 'the shelf');
    assert.deepEqual(spoken, []);
    assert.equal(narrator.narratorDebug().queued, 0);
    voices = [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'compact-daniel', localService: true }];
    voiceListeners.forEach(callback => callback());
    assert.equal(narrator.voicesResolved(), true);
    assert.equal(narrator.voiceQualityHint(), null);
    assert.equal(nodes.get('voiceHint').hidden, true);
    assert.equal(nodes.get('voiceUpgrade').hidden, true);
    assert.deepEqual(spoken, [], 'loading a voice never autoplays a note');
    assert.equal(narrator.speak('An unrequested line.'), false);

    narrator.setNarratorOn(true);
    assert.ok(narrator.voiceQualityHint(), 'voice advice remains available after opting in');
    addNote(state, 'The resident has an opinion.', 'the shelf');
    assert.deepEqual(spoken, ['The resident has an opinion.']);

    nodes.get('voiceHint').hidden = false;
    nodes.get('voiceUpgrade').hidden = false;
    narrator.setNarratorOn(false);
    assert.equal(nodes.get('voiceHint').hidden, true);
    assert.equal(nodes.get('voiceUpgrade').hidden, true);
    addNote(state, 'An opinion left on paper.', 'the shelf');
    assert.equal(spoken.length, 1);
    assert.equal(narrator.speakPreview('A requested voice sample.'), true);
    assert.equal(spoken.at(-1), 'A requested voice sample.', 'Hear it remains an explicit preview while narration is off');
    assert.equal(narrator.isNarratorOn(), false, 'previewing a voice does not opt the player in');
  } finally {
    narrator.stopSpeech();
    setState(oldState);
    Object.assign(globalThis, old);
  }
});
