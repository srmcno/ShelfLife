// The Android app's glue, and the only module that knows it exists.
//
// Everything here is inert in a browser: isNative() is true only when
// Capacitor says this page is running inside the installed app, and plugins
// are reached through window.Capacitor.Plugins, which the native bridge fills
// in before any page script runs. So the web game imports no npm package, and
// a normal browser never takes a native path.
//
// Other modules call this only where the app must behave differently:
//   files     a WebView cannot download or use the Web Share API, so backups
//             and postcards are written to the app's cache and handed to the
//             Android share sheet (no storage permission needed)
//   links     pages outside the game open in the browser, not over the game
//   speech    the WebView has no working speechSynthesis; the phone's own
//             text-to-speech engine reads the notes instead
//   lifecycle the Back key closes sheets and then minimises; pausing the app
//             saves, the same as hiding a browser tab
import { PLAY_URL } from './backup.js';

const cap = () => globalThis.Capacitor;

export function isNative() {
  try { return cap()?.isNativePlatform?.() === true; } catch { return false; }
}

// A plugin the native bridge provides, or null (always null in a browser).
export function plugin(name) {
  return isNative() ? cap()?.Plugins?.[name] || null : null;
}

const quietly = promise => Promise.resolve(promise).catch(() => {});

// ---------- files ----------

const EXPORT_DIR = 'shelf-life';

function base64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error || new Error('unreadable'));
    reader.readAsDataURL(blob);
  });
}

// Writes into the app's cache and resolves to a content URI the share sheet
// can hand to another app. Text is stored as UTF-8, a blob as its bytes.
export async function writeCacheFile({ name, data, blob }) {
  const fs = plugin('Filesystem');
  if (!fs) throw new Error('No filesystem');
  const path = EXPORT_DIR + '/' + String(name || 'shelf-life').replace(/[^\w.-]+/g, '-');
  const written = blob
    ? await fs.writeFile({ path, data: await base64(blob), directory: 'CACHE', recursive: true })
    : await fs.writeFile({ path, data: String(data ?? ''), directory: 'CACHE', encoding: 'utf8', recursive: true });
  if (!written?.uri) throw new Error('No file written');
  return written.uri;
}

// Resolves 'shared', 'cancelled', 'failed' or 'unsupported' (not the app).
export async function shareFile({ name, data, blob, title = 'Shelf Life', text, dialogTitle } = {}) {
  const share = plugin('Share');
  if (!share || !plugin('Filesystem')) return 'unsupported';
  let uri;
  try { uri = await writeCacheFile({ name, data, blob }); } catch { return 'failed'; }
  try {
    await share.share({ title, text, files: [uri], dialogTitle: dialogTitle || title });
    return 'shared';
  } catch (error) {
    return /cancel/i.test(String(error?.message || error || '')) ? 'cancelled' : 'failed';
  }
}

// "Save" in the app: the same share sheet, where Drive, Files or email keep the copy.
export function saveFile(options = {}) {
  return shareFile({ dialogTitle: 'Keep a copy somewhere safe', ...options });
}

// ---------- links ----------

// Opens a page or an address outside the game. http(s) pages use the in-app
// browser tab when it exists; mailto: and the rest go to whichever app handles
// them (Capacitor hands any navigation away from the game to the system).
export async function openExternal(url, { assign = target => globalThis.location.assign(target) } = {}) {
  if (!isNative() || !url) return false;
  const browser = plugin('Browser');
  if (/^https?:/i.test(url) && browser) {
    try { await browser.open({ url }); return true; } catch { /* fall through to the system */ }
  }
  assign(url);
  return true;
}

// Which link clicks leave the game: other sites, and site pages such as the
// privacy policy that open in a new tab on the web. In the app those are
// opened from the published site rather than replacing the game.
export function externalTarget(anchor, here = globalThis.location?.href) {
  const href = anchor?.getAttribute?.('href');
  if (!href || href.startsWith('#')) return null;
  let url;
  try { url = new URL(href, here); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const origin = new URL(here).origin;
  if (url.origin !== origin) return url.href;
  if (anchor.target === '_blank') return new URL(url.pathname.replace(/^\/+/, '') + url.search + url.hash, PLAY_URL).href;
  return null;
}

function watchLinks(doc) {
  doc.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    const url = externalTarget(event.target?.closest?.('a[href]'));
    if (!url) return;
    event.preventDefault();
    openExternal(url);
  }, true);
}

// ---------- speech ----------

export const speechAvailable = () => !!plugin('TextToSpeech');

// The phone's voices, each with the index the plugin expects back.
export async function deviceVoices() {
  const tts = plugin('TextToSpeech');
  if (!tts) return [];
  const result = await tts.getSupportedVoices();
  return (Array.isArray(result?.voices) ? result.voices : []).map((voice, index) => ({ ...voice, index }));
}

// Resolves when the line has been read, rejects if the engine refuses it.
export async function speak({ text, lang = 'en-GB', rate = 1, pitch = 1, volume = 1, voice } = {}) {
  const tts = plugin('TextToSpeech');
  if (!tts) throw new Error('No speech');
  const options = { text, lang, rate, pitch, volume, queueStrategy: 0 };
  if (Number.isInteger(voice) && voice >= 0) options.voice = voice;
  await tts.speak(options);
}

export function stopSpeaking() {
  const tts = plugin('TextToSpeech');
  if (tts) quietly(tts.stop());
}

// ---------- the app itself ----------

export function minimizeApp() {
  const app = plugin('App');
  if (app?.minimizeApp) quietly(app.minimizeApp());
}

export function hideSplash() {
  const splash = plugin('SplashScreen');
  if (splash?.hide) quietly(splash.hide());
}

// The hardware Back key: close the open sheet if there is one; otherwise keep
// the shelf safe and step out of the way, as a home screen press would.
export function backAction({ closeSheet, save } = {}) {
  if (closeSheet?.()) return 'closed';
  try { save?.(); } catch { /* minimise regardless: the pause handler saves again */ }
  minimizeApp();
  return 'minimised';
}

// Wires the App plugin to the game. Pausing and resuming arrive as
// shelflife:pause and shelflife:resume on window, beside the browser's own
// visibilitychange, so the modules that already save or pause on a hidden
// tab can listen for them too. Returns false in a browser.
export function initNative({ closeSheet, save, win = globalThis.window, doc = globalThis.document } = {}) {
  if (!isNative()) return false;
  doc?.documentElement?.classList.add('native-app');
  const app = plugin('App');
  if (app?.addListener) {
    quietly(app.addListener('backButton', () => backAction({ closeSheet, save })));
    quietly(app.addListener('pause', () => win?.dispatchEvent(new Event('shelflife:pause'))));
    quietly(app.addListener('resume', () => win?.dispatchEvent(new Event('shelflife:resume'))));
  }
  if (doc) watchLinks(doc);
  return true;
}
