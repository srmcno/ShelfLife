import { state, save, onNote } from '../state.js';

let voices = [];
let ready = false;
const readyCallbacks = [];

function refreshVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (voices.length && !ready) {
    ready = true;
    readyCallbacks.forEach(fn => fn());
    readyCallbacks.length = 0;
  }
}

export function initNarrator() {
  if (!window.speechSynthesis) return;
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  onNote((note) => {
    if (isNarratorOn()) speak(note.text);
  });
}

function scoreVoice(v) {
  const name = v.name.toLowerCase();
  if (v.lang === 'en-GB' && /daniel|arthur|oliver|george|male/.test(name)) return 100;
  if (v.lang === 'en-GB') return 80;
  if (v.lang && v.lang.startsWith('en-GB')) return 70;
  if (/british|uk english/.test(name)) return 65;
  if (v.lang && v.lang.startsWith('en')) return 30;
  return 0;
}

export function pickBestVoice() {
  if (state.settings.narratorVoiceURI) {
    const chosen = voices.find(v => v.voiceURI === state.settings.narratorVoiceURI);
    if (chosen) return chosen;
  }
  if (!voices.length) return null;
  return voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

export function availableVoices() { return voices.slice(); }
export function onVoicesReady(cb) { if (ready) cb(); else readyCallbacks.push(cb); }

export function speak(text) {
  if (!window.speechSynthesis || state.settings.muted) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickBestVoice();
  if (voice) utter.voice = voice;
  utter.rate = 0.93;
  utter.pitch = 1.18;
  utter.volume = 0.9;
  window.speechSynthesis.speak(utter);
}

export function isNarratorOn() { return !!state.settings.narratorOn; }
export function setNarratorOn(v) { state.settings.narratorOn = !!v; save(); }
export function toggleNarrator() { setNarratorOn(!isNarratorOn()); return isNarratorOn(); }
export function setNarratorVoice(voiceURI) { state.settings.narratorVoiceURI = voiceURI || null; save(); }
