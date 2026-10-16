// Moving house. A browser keeps each web address's storage apart, so when the
// game changes address (GitHub Pages to Vercel, say) every shelf would stay behind
// on the old one. Instead the old address hands its storage over by itself the
// first time a player opens it online, and nobody taps anything:
//
//   old/move.html -> new/move.html#part 0 -> old/move.html#next 1 -> ...
//   -> new/move.html#last part (checked, applied) -> old/move.html#done
//   -> the new address, which the old one redirects to from then on.
//
// Every hop is a top-level page load, so the new address writes its own
// first-party storage (an iframe would only get partitioned storage). The data
// rides in the URL fragment, which never reaches either server, in parts small
// enough for every browser's URL limit. The new address takes parts only from a
// page whose referrer is a configured old address and applies nothing until the
// whole payload matches its SHA-256. The old address only accepts "done" for the
// SHA of what it actually holds. Nothing is ever dropped: the old copy stays where
// it was, and when the new address already has a shelf with residents, the bigger
// one is used and the other is kept as a spare (the Cloud sheet's Undo swaps them).
import { MOVE_TO, MOVE_FROM } from './move-config.js';

export const SAVE_KEY = 'shelflife.v4';
export const SAFETY_KEY = 'shelflife.v4.beforecloud';
export const SPARE_KEY = 'shelflife.v4.beforemove';
export const CLOUD_KEY = 'shelflife.cloud';
export const DONE_KEY = 'shelflife-move.done';
export const APPLIED_KEY = 'shelflife-move.applied';
export const NOTE_KEY = 'shelflife-move.note';
export const TRIES_KEY = 'shelflife-move.tries';
export const RETURN_KEY = 'shelflife-move.return';
export const STAY_KEY = 'shelflife-move.stay';
export const OUT_KEY = 'shelflife-move.out';
export const INBOX_PREFIX = 'shelflife-move.in.';
export const CHANNEL = 'shelflife-move';
// Characters of payload per hop. Firefox caps a URL at 1 MB; this stays well under.
export const PART = 400000;
export const MAX_PARTS = 64;
// Fresh starts allowed per hour before the old address stops trying for a while
// (a broken network, a referrer-stripping extension): the game is still playable there.
export const MAX_STARTS = 3;
export const HOUR = 3600000;

const SHA = /^[0-9a-f]{64}$/;

// ---- small pure helpers ----

export function originOf(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

export function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + ':' + text.length;
}

// Everything the game keeps: the save, its recovery and spare copies, the cloud
// session and the small settings. The move's own bookkeeping stays put.
export function collectKeys(storage) {
  const keys = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (typeof k === 'string' && k.startsWith('shelflife.')) keys[k] = storage.getItem(k);
  }
  return Object.fromEntries(Object.keys(keys).sort().map(k => [k, keys[k]]));
}

export function partsOf(text, size = PART) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.length ? parts : [''];
}

function toBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(text) {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// 'g' + gzip + base64url where the browser can compress, 'r' + base64url where it cannot.
export async function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream === 'function') {
    try { return 'g' + toBase64Url(await pipe(bytes, new CompressionStream('gzip'))); } catch { /* fall through to plain */ }
  }
  return 'r' + toBase64Url(bytes);
}
export async function decodePayload(text) {
  let bytes = fromBase64Url(text.slice(1));
  if (text[0] === 'g') bytes = await pipe(bytes, new DecompressionStream('gzip'));
  else if (text[0] !== 'r') throw new Error('unknown payload');
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function summary(raw) {
  if (typeof raw !== 'string' || !raw) return { present: false, valid: false, residents: 0, lastSaved: 0, names: [], souls: 0 };
  try {
    const data = JSON.parse(raw);
    const pets = Array.isArray(data?.pets) ? data.pets : null;
    if (!pets) return { present: true, valid: false, residents: 0, lastSaved: 0, names: [], souls: 0 };
    return {
      present: true, valid: true, residents: pets.length,
      names: pets.slice(0, 3).map(p => typeof p?.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 22) : 'Someone'),
      souls: Math.max(0, Math.floor(Number(data?.mayhem?.souls) || 0)),
      lastSaved: Number.isFinite(data?.lastTick) ? data.lastTick : 0
    };
  } catch { return { present: true, valid: false, residents: 0, lastSaved: 0, names: [], souls: 0 }; }
}

// Which shelf to play here once a moved one arrives, and which to keep as a spare.
// Nothing is thrown away: whichever is not used is the spare.
export function chooseShelf(hereRaw, incomingRaw, applied = null) {
  const here = summary(hereRaw), there = summary(incomingRaw);
  if (!there.valid) return { take: false, spare: null, reason: 'nothing-to-move' };
  if (hereRaw === incomingRaw) return { take: false, spare: null, reason: 'same' };
  if (!here.present) return { take: true, spare: null, reason: 'empty' };
  // An earlier move left this copy and nobody has touched it since: this is its update.
  if (applied && applied.hash === fnv(hereRaw)) return { take: true, spare: null, reason: 'update' };
  if (!here.valid || here.residents === 0) return { take: true, spare: hereRaw, reason: 'nobody-here' };
  const hereWins = here.residents > there.residents || (here.residents === there.residents && here.lastSaved > there.lastSaved);
  return hereWins ? { take: false, spare: incomingRaw, reason: 'kept-here' } : { take: true, spare: hereRaw, reason: 'bigger' };
}

function readJson(storage, key) {
  try { const v = JSON.parse(storage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

// Write a moved household into this address's storage. Returns
// { ok, took, spare, reason }; ok false means nothing changed that matters
// (the old address keeps its copy and tries again later).
export function applyIncoming(storage, keys, { from = '', sha = '', now = Date.now() } = {}) {
  const applied = readJson(storage, APPLIED_KEY);
  if (applied && sha && applied.sha === sha) return { ok: true, took: false, spare: false, reason: 'already' };
  const hereRaw = storage.getItem(SAVE_KEY);
  const choice = chooseShelf(hereRaw, keys[SAVE_KEY], applied);
  // Settings, the cloud session and the recovery copy come along wherever this
  // address has none of its own.
  for (const [k, v] of Object.entries(keys)) {
    if (k === SAVE_KEY || typeof v !== 'string') continue;
    if (storage.getItem(k) === null) { try { storage.setItem(k, v); } catch { /* optional extras; the save matters */ } }
  }
  let spareKept = false;
  if (choice.spare) {
    const s = summary(choice.spare);
    try { storage.setItem(SPARE_KEY, choice.spare); spareKept = true; } catch { spareKept = false; }
    // The Cloud sheet's Undo swaps the playing shelf with this one.
    const cloud = readJson(storage, CLOUD_KEY) || {};
    if (storage.getItem(SAFETY_KEY) === null || !cloud.safetyCopyAt) {
      try {
        storage.setItem(SAFETY_KEY, choice.spare);
        storage.setItem(CLOUD_KEY, JSON.stringify({ ...cloud, safetyCopyAt: now, safetySummary: { residents: s.residents, names: s.names, souls: s.souls, lastSaved: s.lastSaved } }));
        spareKept = true;
      } catch { /* SPARE_KEY still holds it */ }
    }
    if (!spareKept) return { ok: false, took: false, spare: false, reason: 'no-room-for-spare' };
  }
  if (choice.take) {
    try { storage.setItem(SAVE_KEY, keys[SAVE_KEY]); } catch { return { ok: false, took: false, spare: spareKept, reason: 'no-room' }; }
    // A signed-in cloud copy here belongs to the shelf that was here. Mark the
    // device as changed, so the cloud asks rather than quietly swapping either way.
    const cloud = readJson(storage, CLOUD_KEY);
    if (cloud && cloud.syncUser) { try { storage.setItem(CLOUD_KEY, JSON.stringify({ ...cloud, dirty: true })); } catch { /* the conflict card still guards it */ } }
  }
  const finalRaw = storage.getItem(SAVE_KEY) || '';
  try {
    storage.setItem(APPLIED_KEY, JSON.stringify({ from, sha, at: now, hash: fnv(finalRaw) }));
    storage.setItem(NOTE_KEY, JSON.stringify({ took: choice.take, spare: spareKept, reason: choice.reason, at: now }));
  } catch { /* the move happened; only the welcome line is lost */ }
  return { ok: true, took: choice.take, spare: spareKept, reason: choice.reason };
}

export function arrivalLine(note) {
  if (!note || typeof note !== 'object') return '';
  if (note.took && note.spare) return 'Your shelf moved to its new address. The one started here is kept as a spare: Cloud, then Undo, swaps them.';
  if (note.took) return 'Your shelf moved to its new address. Everyone made it.';
  if (note.spare) return 'Your shelf from the old address is kept here as a spare: Cloud, then Undo, swaps them.';
  return '';
}

// ---- the pages ----

const isNative = win => { try { return win.Capacitor?.isNativePlatform?.() === true; } catch { return false; } };
const hashParams = win => new URLSearchParams(String(win.location.hash || '').replace(/^#/, ''));
const go = (win, url) => win.location.replace(String(url));
const fragment = obj => '#' + new URLSearchParams(Object.entries(obj).map(([k, v]) => [k, String(v)])).toString();

function session(win, key, value) {
  try {
    if (value === undefined) return win.sessionStorage.getItem(key);
    if (value === null) win.sessionStorage.removeItem(key); else win.sessionStorage.setItem(key, value);
  } catch { return null; }
  return null;
}

export function role({ to = MOVE_TO, from = MOVE_FROM, origin } = {}) {
  if (to && originOf(to) && originOf(to) !== origin) return 'old';
  if (Array.isArray(from) && from.some(f => originOf(f) && originOf(f) !== origin)) return 'new';
  return 'none';
}

// Runs before the game on the old address's index page. True means the page is
// on its way somewhere else.
export function gate(win = globalThis, { to = MOVE_TO } = {}) {
  if (role({ to, from: [], origin: win.location.origin }) !== 'old' || isNative(win)) return false;
  const storage = win.localStorage;
  const query = new URLSearchParams(win.location.search);
  if (query.has('stay')) session(win, STAY_KEY, '1');
  if (session(win, STAY_KEY)) return false;
  const done = readJson(storage, DONE_KEY);
  if (win.navigator.onLine === false) {
    // Played offline after moving: the next online visit hands the newer shelf over again.
    if (done) win.addEventListener('shelflife:storage', () => { try { storage.setItem(DONE_KEY, JSON.stringify({ ...done, stale: true })); } catch { /* next time */ } }, { once: true });
    return false;
  }
  const back = win.location.search + win.location.hash;
  if (done && done.to === to && !done.stale) { go(win, new URL('./' + back, to)); return true; }
  session(win, RETURN_KEY, back);
  go(win, new URL('move.html', win.location.href));
  return true;
}

async function runOld(win, to) {
  const storage = win.localStorage;
  const p = hashParams(win);
  const home = new URL('./' + (session(win, RETURN_KEY) || ''), to);
  const keys = collectKeys(storage);
  if (!keys[SAVE_KEY] && !Object.keys(keys).length) {
    try { storage.setItem(DONE_KEY, JSON.stringify({ to, sha: '', at: Date.now() })); } catch { /* redirect anyway */ }
    return go(win, home);
  }
  // The payload is built once per move and kept in this tab's session storage,
  // so every hop sends parts of exactly the same text.
  const plain = JSON.stringify(keys);
  let text = null;
  try { const kept = JSON.parse(session(win, OUT_KEY) || 'null'); if (kept && kept.of === fnv(plain)) text = kept.text; } catch { text = null; }
  if (!text) {
    text = await encodePayload({ v: 1, keys });
    session(win, OUT_KEY, JSON.stringify({ of: fnv(plain), text }));
  }
  const sha = await sha256Hex(text);
  const parts = partsOf(text);
  if (parts.length > MAX_PARTS) return go(win, './?stay=1');
  if (p.get('done') && p.get('sha') === sha) {
    storage.setItem(DONE_KEY, JSON.stringify({ to, sha, at: Date.now() }));
    session(win, RETURN_KEY, null);
    session(win, OUT_KEY, null);
    return go(win, home);
  }
  if (p.get('fail')) return go(win, './?stay=1');
  let i = p.get('sha') === sha ? Number(p.get('next')) : 0;
  if (!Number.isInteger(i) || i < 0 || i >= parts.length) i = 0;
  if (i === 0) {
    const tries = readJson(storage, TRIES_KEY);
    const recent = tries && Date.now() - tries.at < HOUR ? tries.n : 0;
    if (recent >= MAX_STARTS) return go(win, './?stay=1');
    try { storage.setItem(TRIES_KEY, JSON.stringify({ n: recent + 1, at: recent ? tries.at : Date.now() })); } catch { /* still try */ }
  }
  return go(win, new URL('move.html', to).href + fragment({ m: 1, sha, i, n: parts.length, d: parts[i] }));
}

async function runNew(win, from) {
  const storage = win.localStorage;
  const p = hashParams(win);
  const base = from.find(f => originOf(f) && originOf(f) === originOf(win.document.referrer));
  const sha = p.get('sha') || '', i = Number(p.get('i')), n = Number(p.get('n')), d = p.get('d');
  if (!base || p.get('m') !== '1' || !SHA.test(sha) || !Number.isInteger(n) || n < 1 || n > MAX_PARTS
      || !Number.isInteger(i) || i < 0 || i >= n || typeof d !== 'string' || d.length > PART) return go(win, './');
  const back = obj => go(win, new URL('move.html', base).href + fragment(obj));
  const clearInbox = keep => {
    for (let k = storage.length - 1; k >= 0; k--) {
      const key = storage.key(k);
      if (key && key.startsWith(INBOX_PREFIX) && (!keep || !key.startsWith(INBOX_PREFIX + keep + '.'))) storage.removeItem(key);
    }
  };
  clearInbox(sha);
  try { storage.setItem(INBOX_PREFIX + sha + '.' + i, d); } catch { clearInbox(); return back({ fail: 'room' }); }
  if (i < n - 1) return back({ sha, next: i + 1 });
  const parts = [];
  for (let k = 0; k < n; k++) {
    const part = storage.getItem(INBOX_PREFIX + sha + '.' + k);
    if (part === null) return back({ sha, next: k });
    parts.push(part);
  }
  const text = parts.join('');
  clearInbox();
  if (await sha256Hex(text) !== sha) return back({});
  let payload;
  try { payload = await decodePayload(text); } catch { return back({ fail: 'read' }); }
  const keys = payload && typeof payload.keys === 'object' && payload.keys ? payload.keys : {};
  const result = applyIncoming(storage, keys, { from: base, sha });
  if (!result.ok) return back({ fail: result.reason });
  // A tab of the game already open here would save its old shelf over this one.
  try { const ch = new win.BroadcastChannel(CHANNEL); ch.postMessage({ moved: sha }); ch.close(); } catch { /* no other tabs to tell */ }
  return back({ done: 1, sha });
}

// move.html on either address.
export async function runMovePage(win = globalThis, { to = MOVE_TO, from = MOVE_FROM } = {}) {
  const r = role({ to, from, origin: win.location.origin });
  // One address can be both: it takes shelves from where the game used to be
  // and, after a later move, hands them on. A part arriving is always taken in.
  const incoming = hashParams(win).get('m') === '1' && role({ to: '', from, origin: win.location.origin }) === 'new';
  try {
    if (incoming) return await runNew(win, from);
    if (r === 'old' && !isNative(win)) return await runOld(win, to);
    if (r === 'new') return await runNew(win, from);
  } catch {
    return go(win, r === 'old' ? './?stay=1' : './');
  }
  return go(win, './');
}

// On the new address's game page: say the shelf arrived, once, and reload if
// another tab finishes a move while this one is open.
export function watchArrivals(win = globalThis, say = () => {}) {
  try {
    const note = readJson(win.localStorage, NOTE_KEY);
    if (note) { win.localStorage.removeItem(NOTE_KEY); const line = arrivalLine(note); if (line) say(line); }
  } catch { /* no note */ }
  try { const ch = new win.BroadcastChannel(CHANNEL); ch.onmessage = () => win.location.reload(); } catch { /* single tab */ }
}
