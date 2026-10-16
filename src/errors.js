// The last 20 things that broke, for "Report a problem".
//
// Uncaught errors and unhandled promise rejections are kept as a message, the
// file and line they came from, and when: never the save, never what the
// player typed. They live under shelflife.errors, outside the save, so they
// never reach a backup or the cloud unless the player sends a report with
// diagnostics attached. main.js imports this early so it sees errors from the
// rest of the game starting up.
//
// Import-safe in Node: nothing is installed without a window.

export const ERRORS_KEY = 'shelflife.errors';
export const MAX_ERRORS = 20;
const MAX_MESSAGE = 300, MAX_SOURCE = 120, REPEAT_MS = 2000;
// Browser noise that is not the game breaking.
const IGNORED = [/^ResizeObserver loop/i, /^Script error\.?$/i];
const listeners = new Set();
let memory = [];

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// "https://example.org/ShelfLife/src/ui/court.js?v=3" becomes "src/ui/court.js".
// Anything from another site (a browser extension, say) is named by its host only.
export function shortSource(url, here = globalThis.location?.href) {
  const raw = String(url || '');
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw, here || 'http://localhost/'); } catch { return text(raw, MAX_SOURCE); }
  let page = null;
  try { page = here ? new URL(here) : null; } catch { /* no page address: keep the path */ }
  if (page && parsed.origin !== page.origin && /^https?:$/.test(parsed.protocol)) return text(parsed.host, MAX_SOURCE);
  if (!/^https?:$/.test(parsed.protocol)) return text(parsed.protocol.replace(':', ''), MAX_SOURCE);
  // Relative to the game's own folder (the site may live under /ShelfLife/).
  const folder = page ? page.pathname.replace(/[^/]*$/, '') : '/';
  const path = parsed.pathname.startsWith(folder) ? parsed.pathname.slice(folder.length) : parsed.pathname.replace(/^\/+/, '');
  return text(path || 'index.html', MAX_SOURCE);
}

// The first file:line:column in a stack trace (Chrome "at f (url:1:2)", Firefox and Safari "f@url:1:2").
export function stackSource(stack, here) {
  const m = String(stack || '').match(/((?:https?|file|capacitor):\/\/[^\s)]+?):(\d+):(\d+)/);
  return m ? { file: shortSource(m[1], here), line: Number(m[2]), column: Number(m[3]) } : null;
}

// One entry: { message, source, at, count }. null for noise.
export function errorEntry({ message, filename, lineno, colno, stack } = {}, now = Date.now(), here = globalThis.location?.href) {
  const msg = text(message, MAX_MESSAGE) || 'Unknown error';
  if (IGNORED.some(pattern => pattern.test(msg))) return null;
  let file = shortSource(filename, here), line = Number(lineno) || 0, column = Number(colno) || 0;
  if (!file) {
    const found = stackSource(stack, here);
    if (found) ({ file, line, column } = found);
  }
  const source = file ? file + (line ? ':' + line + (column ? ':' + column : '') : '') : '';
  return { message: msg, source: text(source, MAX_SOURCE), at: Number.isFinite(now) ? now : 0, count: 1 };
}

function cleanList(list) {
  return (Array.isArray(list) ? list : []).filter(e => e && typeof e === 'object' && typeof e.message === 'string').slice(-MAX_ERRORS)
    .map(e => ({ message: text(e.message, MAX_MESSAGE), source: text(e.source, MAX_SOURCE), at: Number.isFinite(e.at) ? e.at : 0,
      count: Number.isInteger(e.count) && e.count > 0 ? Math.min(e.count, 999) : 1 }));
}

// Oldest first, at most 20.
export function readErrors(store = storage()) {
  let raw;
  try { raw = store ? store.getItem(ERRORS_KEY) : null; } catch { return cleanList(memory); }
  if (!store) return cleanList(memory);
  try { return cleanList(JSON.parse(raw || '[]')); } catch { return []; }
}
function writeErrors(list, store) {
  memory = list;
  try { store?.setItem(ERRORS_KEY, JSON.stringify(list)); } catch { /* full or blocked storage keeps the list in memory */ }
}

// Adds one to the ring. The same error again within two seconds counts up instead.
export function recordError(raw, { store = storage(), now = Date.now(), here } = {}) {
  const entry = errorEntry(raw, now, here);
  if (!entry) return null;
  const list = readErrors(store);
  const last = list.at(-1);
  if (last && last.message === entry.message && last.source === entry.source && Math.abs(entry.at - last.at) < REPEAT_MS) {
    last.count = Math.min(last.count + 1, 999);
    last.at = entry.at;
  } else list.push(entry);
  writeErrors(list.slice(-MAX_ERRORS), store);
  listeners.forEach(fn => { try { fn(entry); } catch { /* a listener must not break the capture */ } });
  return entry;
}

export function clearErrors(store = storage()) { writeErrors([], store); }
export function onError(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Listens on the window for the rest of the page's life. Idempotent.
export function installErrorCapture(win = globalThis.window) {
  if (!win?.addEventListener || win.__shelflifeErrors) return false;
  win.__shelflifeErrors = true;
  win.addEventListener('error', event => {
    // Failed images and stylesheets arrive here too in some browsers, without a message.
    if (!event || (event.target && event.target !== win && !event.message)) return;
    recordError({ message: event.message || event.error?.message, filename: event.filename, lineno: event.lineno, colno: event.colno, stack: event.error?.stack });
  });
  win.addEventListener('unhandledrejection', event => {
    const reason = event?.reason;
    if (reason?.name === 'AbortError') return;
    const message = reason instanceof Error || typeof reason?.message === 'string'
      ? (reason.name && reason.name !== 'Error' ? reason.name + ': ' : '') + reason.message
      : typeof reason === 'string' ? reason : 'A promise was rejected';
    recordError({ message: 'Unhandled rejection: ' + message, stack: reason?.stack });
  });
  return true;
}

installErrorCapture();
