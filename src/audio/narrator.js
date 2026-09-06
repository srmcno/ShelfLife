import { state, save, onNote } from '../state.js';

/* ---------------------------------------------------------------------------
   Shelf Life — the narrator
   ---------------------------------------------------------------------------
   Reads the notes out loud in the driest English voice the machine has.

   Three things matter here and none of them are obvious:

   1. Voice choice. getVoices() is async and frequently returns [] on the first
      call, so nothing may pick a voice synchronously at boot. Selection is a
      deterministic score (en-GB male, enhanced first) rather than "the first
      thing that looks British", and the macOS novelty voices (Bells, Boing,
      Zarvox, Fred...) are actively pushed down so they can never win a tie.

   2. Prosody. The old code raised pitch to 1.18, which turns a British male
      voice thin and cartoonish. A slightly *lowered* pitch at a near-natural
      rate is what reads as dry, plummy and deadpan, which is the joke.

   3. Queueing. One "Check the shelf" click can add half a dozen notes at once.
      cancel()-ing per utterance chopped every line in half. Lines are queued
      with a small cap instead, newest kept, so a burst reads as a few complete
      sentences rather than a stutter.
--------------------------------------------------------------------------- */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Tuned against Daniel (en-GB) — the only British voice most macOS installs
// have. Slightly under natural rate, slightly under natural pitch: unhurried
// and a bit plummy, without tipping into slow-motion or into a cartoon.
export const PROSODY = { rate: 0.95, pitch: 0.88, lightPitch: 0.97, volume: 0.95 };

// Voices with enough body that dropping the pitch reads as dry rather than muddy.
const DEEP_VOICE = /^(daniel|arthur|oliver|george|jamie|graham|thomas|malcolm|alex|rishi|lee|aaron|gordon|reed|rocko|eddy|fred|ralph|bruce)\b/i;
// A named English man, in rough order of how often they exist on real machines.
const ENGLISH_MALE = /^(daniel|arthur|oliver|george|jamie|malcolm|graham|thomas|ryan)\b/i;
const ENHANCED = /\b(enhanced|premium|neural|natural|siri)\b/i;
// macOS ships a drawer of joke voices. They are all English. None of them narrate.
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|bruce|agnes|victoria|grandma|grandpa|flo|sandy|shelley|eddy|rocko|reed|junior|wobble)\b/i;

const MAX_QUEUE = 3;      // pending notes, on top of the one being spoken
const GAP_MS = 170;       // a breath between lines
const MAX_CHARS = 320;
// Chrome's network voices stop dead at roughly fifteen seconds with no `end`
// event, so a long note is read as a run of short utterances instead of one.
const CHUNK_CHARS = 170;
const READY_TIMEOUT = 2500;

let voices = [];
let ready = false;        // safe to pick a voice and speak
let resolved = false;     // voices actually arrived (vs. we gave up waiting)
let readyCallbacks = [];
let queue = [];
let speaking = false;
let poller = null;
let pumpPending = false;
let lastUtterance = null;
// Each browser utterance gets a serial; a callback from an utterance that has
// since been cancelled (the voice picker's preview, a restore) must not tear
// down the one that replaced it.
let utterSerial = 0;
let noteSerial = 0;
let nativeVoice = null;
let nativeAudio = null;
let nativeURL = null;
let nativeRequest = null;
let speechEpoch = 0;

function playbackStatus(text) {
  if (typeof document === 'undefined') return;
  const status = document.getElementById('voicePlayback');
  if (status) status.textContent = text;
}

async function discoverNativeVoice() {
  // Only the installed desktop game has this endpoint. Ordinary web hosting
  // continues to use the browser's own voices with no remote speech service.
  if (window.location.hostname !== '127.0.0.1') return;
  try {
    const response = await fetch('/api/voice', { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    if (!response.ok) return;
    const info = await response.json();
    if (!info.available || info.name !== 'Daniel (Enhanced)') return;
    nativeVoice = { name: info.name, lang: 'en-GB', voiceURI: 'shelflife:daniel-enhanced', localService: true, native: true };
    refreshVoices();
    window.dispatchEvent(new Event('shelflife:voiceschanged'));
  } catch { /* Browser voices remain available when the desktop server is absent. */ }
}

function refreshVoices() {
  voices = [...(nativeVoice ? [nativeVoice] : []), ...(synth ? synth.getVoices() || [] : [])];
  if (voices.length && !resolved) {
    resolved = true;
    markReady();
  }
}

function markReady() {
  if (ready) return;
  ready = true;
  const cbs = readyCallbacks;
  readyCallbacks = [];
  cbs.forEach(fn => { try { fn(); } catch (e) {} });
}

export function initNarrator() {
  if (!synth) return;
  discoverNativeVoice();
  refreshVoices();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', refreshVoices);
  } else {
    synth.onvoiceschanged = refreshVoices;
  }
  // voiceschanged is unreliable: it can fire before we listen, or never. Poll a
  // few times, then give up and speak with the browser default rather than
  // going silent forever.
  let tries = 0;
  const tick = setInterval(() => {
    refreshVoices();
    if (resolved || ++tries > 10) clearInterval(tick);
  }, 220);
  setTimeout(markReady, READY_TIMEOUT);

  onNote(note => { if (isNarratorOn()) speak(note.text); });
  return true;
}

// ---------- voice selection ----------

// Fallback chain, highest first:
//   the player's explicit choice
//   -> en-GB male, enhanced/premium variant
//   -> en-GB male (Daniel)
//   -> any other en-GB voice
//   -> en-IE / en-AU / en-NZ / en-ZA
//   -> en-US / other English, novelty voices last
//   -> null, meaning "let the browser use its default"
export function scoreVoice(v) {
  if (!v) return 0;
  const name = v.name || '';
  const lang = (v.lang || '').replace('_', '-');
  let s;
  if (/^en-GB/i.test(lang) || /\b(uk|british) english\b/i.test(name)) s = 600;
  else if (/^en-(IE|AU|NZ|ZA)/i.test(lang)) s = 400;
  else if (/^en-US/i.test(lang)) s = 300;
  else if (/^en/i.test(lang)) s = 250;
  else return 0; // never auto-select a voice that cannot read English
  if (ENGLISH_MALE.test(name) || /\bmale\b/i.test(name)) s += 150;
  if (ENHANCED.test(name)) s += 120;
  if (v.native) s += 100;
  if (/^daniel\b/i.test(name)) s += 40; // the known-good British man on macOS
  // Enough to sink them below every serious voice, not enough to zero them:
  // a score of 0 means "not usable at all", and Boing is still a last resort.
  if (NOVELTY.test(name)) s -= 280;
  return s;
}

export function pickBestVoice() {
  if (!voices.length) return null;
  const wanted = state.settings.narratorVoiceURI;
  if (wanted) {
    // Keep the setting even if the voice is missing right now — it may still be
    // loading, or the player may be on another machine for the afternoon.
    const chosen = voices.find(v => v.voiceURI === wanted) || voices.find(v => v.name === wanted);
    if (chosen) return chosen;
  }
  let best = null;
  let bestScore = 0;
  voices.forEach(v => {
    const s = scoreVoice(v);
    if (s > bestScore) { bestScore = s; best = v; } // ties keep the earlier voice
  });
  return best;
}

export function prosodyFor(voice) {
  const name = (voice && voice.name) || '';
  return {
    rate: PROSODY.rate,
    // Dropping the pitch only flatters a voice with some chest in it; on a
    // lighter voice the same move just sounds muffled.
    pitch: DEEP_VOICE.test(name) ? PROSODY.pitch : PROSODY.lightPitch,
    volume: PROSODY.volume
  };
}

export function availableVoices() { return voices.slice(); }
export function onVoicesReady(cb) { if (ready) cb(); else readyCallbacks.push(cb); }
export function voicesResolved() { return resolved; }

// ---------- text preparation ----------

const KEEP_CAPS = new Set(['I', 'OK', 'TV', 'DNA', 'IOU', 'PS', 'RIP', 'BBC', 'NHS']);

// Note text is written to be read on paper. Speech engines say "dash", spell
// out shouted words letter by letter, and run whole paragraphs together without
// the pauses the punctuation implies. This fixes the worst of it.
export function prepareForSpeech(raw) {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}]/gu, ' ');
  s = s.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");
  s = s.replace(/\s*[—–]+\s*/g, ', ');   // em/en dash -> a breath
  s = s.replace(/…|\.{3,}/g, '. ');           // ellipsis -> a full stop
  s = s.replace(/&/g, ' and ');
  s = s.replace(/(\d)\s*%/g, '$1 percent');
  s = s.replace(/(\w)\/(\w)/g, '$1 or $2');
  s = s.replace(/[*_`~|#^<>[\]{}\\]/g, ' ');
  s = s.replace(/\b[A-Z]{2,}\b/g, w => (KEEP_CAPS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()));
  s = s.replace(/\s+([,.!?;:])/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^["'(\s]+/, '').replace(/["')\s]+$/, '').trim();
  if (!s) return '';
  if (s.length > MAX_CHARS) {
    const head = s.slice(0, MAX_CHARS);
    const stop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
    s = (stop > 60 ? head.slice(0, stop + 1) : head.slice(0, head.lastIndexOf(' '))).trim();
  }
  if (!/[.!?"']$/.test(s)) s += '.';
  return s;
}

// ---------- speaking ----------

export function buildUtterance(text, browserFallback = false) {
  const u = new SpeechSynthesisUtterance(text);
  let voice = pickBestVoice();
  if (voice?.native || browserFallback) voice = voices.filter(v => !v.native).sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
  if (voice) {
    u.voice = voice;
    if (voice.lang) u.lang = voice.lang;
  }
  const p = prosodyFor(voice);
  u.rate = p.rate;
  u.pitch = p.pitch;
  u.volume = p.volume;
  return u;
}

// Sentence-sized pieces, each short enough for the flakiest voice, in order.
export function splitForSpeech(line, max = CHUNK_CHARS) {
  const parts = [];
  let current = '';
  String(line).split(/(?<=[.!?…])\s+/).forEach(sentence => {
    if (!sentence) return;
    if (current && (current + ' ' + sentence).length > max) { parts.push(current); current = sentence; }
    else current = current ? current + ' ' + sentence : sentence;
    while (current.length > max) {
      const cut = current.lastIndexOf(' ', max);
      const at = cut > 40 ? cut : max;
      parts.push(current.slice(0, at).trim());
      current = current.slice(at).trim();
    }
  });
  if (current) parts.push(current);
  return parts;
}

export function speak(text, opts) {
  const o = opts || {};
  if (!synth) return false;
  if (state.settings.muted && !o.force) return false;
  // A background tab does not narrate. The note is on the board when they return.
  if (typeof document !== 'undefined' && document.hidden && !o.force) return false;
  const line = prepareForSpeech(text);
  if (!line) return false;
  if (o.immediate) {
    queue.length = 0;
    stopSpeech();
  }
  const note = ++noteSerial;
  splitForSpeech(line).forEach(chunk => queue.push({ text: chunk, note }));
  // A burst of notes should not become a five-minute monologue. Keep the
  // newest few notes whole, rather than the newest few sentences.
  const notes = [...new Set(queue.map(q => q.note))];
  if (notes.length > MAX_QUEUE) {
    const keep = new Set(notes.slice(-MAX_QUEUE));
    for (let i = queue.length - 1; i >= 0; i--) if (!keep.has(queue[i].note)) queue.splice(i, 1);
  }
  pump();
  return true;
}

export const PREVIEW_LINE =
  'It has been three days. The shelf remembers, even if you do not.';

// The voice-picker preview: jumps the queue and ignores the mute button,
// because the player just pressed a button that says "hear it".
export function speakPreview(text) {
  return speak(text || PREVIEW_LINE, { immediate: true, force: true });
}

function pump() {
  if (!synth || speaking || !queue.length) return;
  if (!ready) {
    if (!pumpPending) {
      pumpPending = true;
      onVoicesReady(() => { pumpPending = false; pump(); });
    }
    return;
  }
  const line = queue.shift().text;
  if (pickBestVoice()?.native) {
    speaking = true;
    speakNative(line, speechEpoch);
    return;
  }
  speakBrowser(line);
}

function speakBrowser(line) {
  const u = buildUtterance(line);
  playbackStatus(pickBestVoice()?.native
    ? 'Enhanced speech is unavailable right now. Using the browser voice.'
    : 'Speaking with ' + (u.voice?.name || 'the browser voice') + '.');
  lastUtterance = u;
  speaking = true;
  const mine = ++utterSerial;
  u.onend = u.onerror = () => { if (mine === utterSerial) finish(); };
  try {
    synth.speak(u);
  } catch (e) {
    finish();
    return;
  }
  watch(line);
}

async function speakNative(line, epoch) {
  playbackStatus('Daniel is clearing his throat…');
  const controller = new AbortController();
  nativeRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch('/api/voice/speak', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: line }), signal: controller.signal,
    });
    if (!response.ok) throw new Error('Voice unavailable');
    const blob = await response.blob();
    if (epoch !== speechEpoch) return;
    nativeURL = URL.createObjectURL(blob);
    nativeAudio = new Audio(nativeURL);
    nativeAudio.volume = PROSODY.volume;
    nativeAudio.onended = finish;
    nativeAudio.onerror = finish;
    lastUtterance = { text: line, voice: nativeVoice, rate: 1, pitch: 1, volume: PROSODY.volume };
    await nativeAudio.play();
    if (epoch === speechEpoch) playbackStatus('Speaking with Daniel (Enhanced).');
  } catch {
    if (epoch === speechEpoch) { clearNativeAudio(); speakBrowser(line); }
  } finally { clearTimeout(timeout); }
}

function clearNativeAudio() {
  if (nativeAudio) {
    nativeAudio.onended = nativeAudio.onerror = null;
    nativeAudio.pause();
    nativeAudio.removeAttribute('src');
    nativeAudio = null;
  }
  if (nativeURL) { URL.revokeObjectURL(nativeURL); nativeURL = null; }
}

function finish() {
  if (!speaking) return;
  playbackStatus('Last read by ' + (lastUtterance?.voice?.name || 'the browser voice') + '.');
  speaking = false;
  clearNativeAudio();
  unwatch();
  if (queue.length) setTimeout(pump, GAP_MS);
}

// Chrome drops `onend` often enough that a queue relying on it alone can wedge
// shut. Poll the engine, and hard-stop after a generous estimate of the line's
// own length so a lost event costs one pause, not the rest of the session.
function watch(line) {
  unwatch();
  const words = line.split(/\s+/).length;
  const estimate = (words / (2.6 * PROSODY.rate)) * 1000 + 2500;
  const startedAt = Date.now();
  poller = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed > 400 && !synth.speaking && !synth.pending) finish();
    else if (elapsed > estimate) { try { synth.cancel(); } catch (e) {} finish(); }
  }, 300);
}

function unwatch() {
  if (poller) { clearInterval(poller); poller = null; }
}

export function stopSpeech() {
  playbackStatus('Narration stopped.');
  speechEpoch++;
  utterSerial++;                  // orphan any callback still in flight
  nativeRequest?.abort();
  nativeRequest = null;
  clearNativeAudio();
  queue.length = 0;
  unwatch();
  speaking = false;
  if (synth) { try { synth.cancel(); } catch (e) {} }
}

export function narratorDebug() {
  const voice = pickBestVoice();
  return {
    voiceCount: voices.length,
    resolved, ready, speaking, queued: queue.length,
    chosen: voice ? { name: voice.name, lang: voice.lang, uri: voice.voiceURI, score: scoreVoice(voice) } : null,
    last: lastUtterance
      ? { text: lastUtterance.text, voice: lastUtterance.voice && lastUtterance.voice.name, rate: lastUtterance.rate, pitch: lastUtterance.pitch, volume: lastUtterance.volume }
      : null
  };
}

// ---------- settings ----------

export function isNarratorOn() { return !!state.settings.narratorOn; }
export function setNarratorOn(v) {
  state.settings.narratorOn = !!v;
  if (!state.settings.narratorOn) stopSpeech();
  save();
}
export function toggleNarrator() { setNarratorOn(!isNarratorOn()); return isNarratorOn(); }
export function setNarratorVoice(voiceURI) {
  state.settings.narratorVoiceURI = voiceURI || null;
  save();
}

// ---------- quality hint ----------

// The honest state of things on a stock Mac: exactly one British voice exists,
// Daniel, and by default it is the low-bitrate "compact" build. Installing the
// enhanced one is a two-minute job and the single biggest improvement available,
// so say so once instead of quietly sounding like a train announcement.
export function voiceQualityHint() {
  const v = pickBestVoice();
  const mac = typeof navigator !== 'undefined' &&
    /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
  if (!v) return null;
  if (ENHANCED.test(v.name)) return null;
  if (typeof window !== 'undefined' && window.location.hostname !== '127.0.0.1') {
    return {
      id: 'browser-voices',
      short: 'Narration uses the voices available in your browser.',
      detail: 'British voices and their quality vary by device. Try the available voices above, or switch the narrator off and enjoy the notes on paper.'
    };
  }
  if (/^daniel\b/i.test(v.name)) {
    return {
      id: 'daniel-enhanced',
      short: 'The narrator is Daniel, the compact British voice. There is a much better version of him going spare.',
      steps: mac
        ? ['System Settings', 'Accessibility', 'Spoken Content', 'System Voice', 'Manage Voices', 'English (UK)', 'Daniel (Enhanced)']
        : null,
      detail: mac
        ? 'Download Daniel (Enhanced), then reopen this page and pick him below. Same man, considerably less robot.'
        : 'Install a higher quality English (UK) voice in your system settings, then reopen this page and pick it below.'
    };
  }
  if (!/^en-GB/i.test(v.lang || '')) {
    return {
      id: 'no-en-gb',
      short: 'No British voice is installed, so the narrator is ' + v.name + '.',
      steps: mac
        ? ['System Settings', 'Accessibility', 'Spoken Content', 'System Voice', 'Manage Voices', 'English (UK)', 'Daniel (Enhanced)']
        : null,
      detail: 'Install an English (UK) voice in your system settings and the narrator will switch to it automatically.'
    };
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Voice picker UI

   Lives here rather than in main.js so the whole narrator, including the bit
   the player touches, is one file. Every element is optional: if the markup
   isn't there, this quietly does nothing.
--------------------------------------------------------------------------- */

function voiceLabel(v) {
  const tags = [];
  if (/^en-GB/i.test(v.lang || '')) tags.push('British');
  if (ENHANCED.test(v.name)) tags.push('enhanced');
  if (!v.localService) tags.push('online');
  return v.name + ' (' + (v.lang || '??') + (tags.length ? ', ' + tags.join(', ') : '') + ')';
}

export function initNarratorUI() {
  if (typeof document === 'undefined') return null;
  const btn = document.getElementById('voiceBtn');
  const veil = document.getElementById('voiceVeil');
  const select = document.getElementById('voiceSelect');
  if (!btn || !veil || !select) return null;

  const meta = document.getElementById('voiceMeta');
  const upgrade = document.getElementById('voiceUpgrade');
  const hint = document.getElementById('voiceHint');
  const hintText = document.getElementById('voiceHintText');

  function fillSelect() {
    const list = availableVoices();
    const best = pickBestVoice();
    // English first, best-scoring first, everything else after — the list is
    // 68 voices long on a stock Mac and the player wants the top of it.
    const english = list.filter(v => /^en/i.test(v.lang || '')).sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const rest = list.filter(v => !/^en/i.test(v.lang || ''));
    let html = '<option value="">Best available (' + (best ? best.name : 'system default') + ')</option>';
    if (english.length) {
      html += '<optgroup label="English">' +
        english.map(v => '<option value="' + escapeAttr(v.voiceURI) + '">' + escapeText(voiceLabel(v)) + '</option>').join('') +
        '</optgroup>';
    }
    if (rest.length) {
      html += '<optgroup label="Other languages">' +
        rest.map(v => '<option value="' + escapeAttr(v.voiceURI) + '">' + escapeText(voiceLabel(v)) + '</option>').join('') +
        '</optgroup>';
    }
    select.innerHTML = html;
    select.value = state.settings.narratorVoiceURI || '';
    if (select.value !== (state.settings.narratorVoiceURI || '')) select.value = '';
    describe();
  }

  function describe() {
    if (!meta) return;
    const v = pickBestVoice();
    if (!v) {
      meta.textContent = availableVoices().length
        ? 'No English voice found. The browser will use its own default.'
        : ready ? 'This browser reports no voices. Narration will use whatever the system provides, or stay on paper.'
        : 'Still asking the system what voices it has.';
      return;
    }
    const auto = !state.settings.narratorVoiceURI;
    const p = prosodyFor(v);
    meta.textContent = (auto ? 'Chosen for you: ' : 'Your pick: ') + v.name + ' (' + (v.lang || '??') + '). ' +
      (v.native ? 'Full-quality speech generated on your Mac. Works offline. ' : 'Browser voice. ') +
      (isNarratorOn() ? '' : 'The narrator is currently switched off.');
    const up = voiceQualityHint();
    if (upgrade) {
      if (up) {
        upgrade.hidden = false;
        upgrade.innerHTML = '<b>' + escapeText(up.short) + '</b>' +
          (up.steps ? '<div class="voice-steps">' + up.steps.map(escapeText).join(' <span aria-hidden="true">&rsaquo;</span> ') + '</div>' : '') +
          '<p>' + escapeText(up.detail) + '</p>';
      } else {
        upgrade.hidden = true;
        upgrade.innerHTML = '';
      }
    }
  }

  function open() {
    fillSelect();
    veil.classList.add('open');
    document.body.style.overflow = 'hidden';
    dismissHint();
  }
  function close() {
    veil.classList.remove('open');
    document.body.style.overflow = '';
  }

  function dismissHint() {
    if (hint) hint.hidden = true;
    if (!state.settings.voiceHintSeen) { state.settings.voiceHintSeen = true; save(); }
  }

  btn.addEventListener('click', open);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  const closeBtn = document.getElementById('voiceClose');
  if (closeBtn) closeBtn.addEventListener('click', close);

  select.addEventListener('change', () => {
    setNarratorVoice(select.value || null);
    describe();
    speakPreview();
  });

  const preview = document.getElementById('voicePreview');
  if (preview) preview.addEventListener('click', () => speakPreview());

  const auto = document.getElementById('voiceAuto');
  if (auto) auto.addEventListener('click', () => {
    setNarratorVoice(null);
    fillSelect();
    speakPreview();
  });

  onVoicesReady(() => {
    fillSelect();
    if (!hint || !hintText) return;
    const up = voiceQualityHint();
    if (!up || state.settings.voiceHintSeen) return;
    // Only ever reveal the bar once it actually has copy in it. A stale cached
    // narrator.js against fresh index.html markup once produced a visible hint
    // bar containing nothing but its two buttons.
    const copy = 'The narrator can sound better. Choose a voice that suits your shelf.';
    if (!copy) return;
    hintText.textContent = copy;
    hint.hidden = false;
  });
  if (typeof synth !== 'undefined' && synth && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => { if (veil.classList.contains('open')) fillSelect(); });
  }
  window.addEventListener('shelflife:voiceschanged', () => {
    fillSelect();
    if (nativeVoice && hint) hint.hidden = true;
  });

  const hintOpen = document.getElementById('voiceHintOpen');
  if (hintOpen) hintOpen.addEventListener('click', open);
  const hintDismiss = document.getElementById('voiceHintDismiss');
  if (hintDismiss) hintDismiss.addEventListener('click', dismissHint);

  return { open, close, refresh: fillSelect };
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}
