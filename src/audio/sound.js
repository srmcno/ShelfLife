import { state, save, onNote } from '../state.js';

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { duration = 0.14, type = 'sine', gain = 0.08, delay = 0, glideTo = null } = {}) {
  if (state.settings.muted) return;
  const c = getCtx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + duration + 0.02);
}

function noiseBurst({ duration = 0.09, gain = 0.06, delay = 0, cutoff = 900 } = {}) {
  if (state.settings.muted) return;
  const c = getCtx();
  const t0 = c.currentTime + delay;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filt); filt.connect(g); g.connect(c.destination);
  src.start(t0);
}

export function playFeed() { noiseBurst({ duration: 0.1, cutoff: 700 }); tone(180, { duration: 0.1, type: 'triangle', gain: 0.05, delay: 0.05 }); }
export function playFuss() { tone(520, { duration: 0.16, type: 'sine', gain: 0.06, glideTo: 640 }); tone(780, { duration: 0.14, type: 'sine', gain: 0.04, delay: 0.05, glideTo: 900 }); }
export function playClean() { tone(1200, { duration: 0.08, type: 'sine', gain: 0.05 }); tone(1600, { duration: 0.06, type: 'sine', gain: 0.04, delay: 0.06 }); }
export function playNoteArrive() { tone(440, { duration: 0.05, type: 'square', gain: 0.03 }); }
export function playFeud() { tone(220, { duration: 0.22, type: 'sawtooth', gain: 0.04, glideTo: 205 }); tone(233, { duration: 0.22, type: 'sawtooth', gain: 0.03, delay: 0.02 }); }
export function playUnlock() { [440, 554, 659, 880].forEach((f, i) => tone(f, { duration: 0.14, type: 'triangle', gain: 0.05, delay: i * 0.07 })); }
export function playAchievement() { [523, 659, 784].forEach((f, i) => tone(f, { duration: 0.16, type: 'triangle', gain: 0.055, delay: i * 0.09 })); tone(392, { duration: 0.3, type: 'sine', gain: 0.03, delay: 0.3 }); }
export function playError() { tone(160, { duration: 0.18, type: 'square', gain: 0.05, glideTo: 110 }); }

export function isMuted() { return !!state.settings.muted; }
export function setMuted(v) { state.settings.muted = !!v; save(); }
export function toggleMuted() { setMuted(!isMuted()); return isMuted(); }

// Self-registers so every note gets a tick/dissonance cue without note-producing
// code (engine/loop.js, engine/care.js, etc.) needing to know audio exists.
export function initSoundNoteHook() {
  onNote(note => { if (note.kind === 'feud') playFeud(); else playNoteArrive(); });
}
