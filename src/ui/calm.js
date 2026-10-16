/* Calm mode: a visible switch in More that makes the shelf hold still.

   The game already honours the device's own reduced-motion setting, in CSS and in
   the places that ask matchMedia. Calm mode is the same promise made from inside the
   game, for a player who has not found that setting or does not want it everywhere:
     * every animation and transition stops (the rules in css/guide.css, under body.calm);
     * effects are forced to Light (ui/effects.js reads settings.calm);
     * code that asks "does this person prefer reduced motion?" is told yes, and told
       again when the switch changes (the matchMedia wrapper below).
   Importing this module first lets the wrapper see every later request. */

const REDUCED = /prefers-reduced-motion\s*:\s*reduce/;
let calm = false;
const watchers = new Set();

export const isCalm = () => calm;

// Mirrors what the browser does with the same listener: one entry per function and
// list, dropped when its AbortSignal fires, and dropped after one call when `once`.
function watch(list, fn, query, options) {
  for (const w of watchers) if (w.fn === fn && w.query === query) return;
  const opts = typeof options === 'object' && options ? options : {};
  if (opts.signal?.aborted) return;
  const entry = { fn, query, list, once: !!opts.once };
  watchers.add(entry);
  opts.signal?.addEventListener?.('abort', () => watchers.delete(entry), { once: true });
  // A `once` listener the device fires itself is gone from the list, so it goes from here too.
  if (entry.once) list.addEventListener?.('change', () => watchers.delete(entry), { once: true });
}

function install() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia.__calm) return;
  const real = window.matchMedia.bind(window);
  const wrapped = query => {
    const list = real(query);
    if (!REDUCED.test(String(query))) return list;
    // The same list, except that Calm mode makes it say yes. Native methods keep their own receiver.
    return new Proxy(list, {
      get(target, prop) {
        if (prop === 'matches') return calm || target.matches;
        if (prop === 'addEventListener') return (type, fn, options) => { target.addEventListener(type, fn, options); if (type === 'change' && fn) watch(target, fn, query, options); };
        if (prop === 'removeEventListener') return (type, fn, options) => { target.removeEventListener(type, fn, options); for (const w of watchers) if (w.fn === fn) watchers.delete(w); };
        if (prop === 'addListener') return fn => { target.addListener?.(fn); if (fn) watch(target, fn, query); };
        if (prop === 'removeListener') return fn => { target.removeListener?.(fn); for (const w of watchers) if (w.fn === fn) watchers.delete(w); };
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  };
  wrapped.__calm = true;
  window.matchMedia = wrapped;
}
install();

// Turns Calm mode on or off everywhere at once. Safe to call every render.
export function applyCalm(on) {
  const next = !!on;
  if (typeof document !== 'undefined') document.body.classList.toggle('calm', next);
  if (next === calm) return false;
  calm = next;
  let truth = true;
  for (const w of [...watchers]) {
    if (w.once) { watchers.delete(w); w.list?.removeEventListener?.('change', w.fn); }
    try { truth = !!window.matchMedia(w.query).matches; w.fn({ matches: truth, media: String(w.query), type: 'change' }); } catch { /* one watcher must not stop the rest */ }
  }
  return true;
}

export function calmLabels(on) {
  return on ? { label: 'Calm mode on', sub: 'Nothing moves. Effects stay light.' } : { label: 'Calm mode', sub: 'Stills the room and keeps effects light' };
}

export function initCalm(state, { save = () => {}, onChange = () => {} } = {}) {
  const button = document.getElementById('calmBtn');
  const paint = () => {
    const on = state.settings.calm === true;
    applyCalm(on);
    if (!button) return;
    button.setAttribute('aria-pressed', String(on));
    const { label, sub } = calmLabels(on);
    const name = button.querySelector('span'), small = button.querySelector('small');
    if (name && name.textContent !== label) name.textContent = label;
    if (small && small.textContent !== sub) small.textContent = sub;
  };
  button?.addEventListener('click', () => { state.settings.calm = state.settings.calm !== true; save(); paint(); onChange(state.settings.calm); });
  // A restored backup or a cloud copy can bring a different setting with it.
  if (typeof window !== 'undefined') window.addEventListener('shelflife:state-replaced', paint);
  paint();
  return paint;
}
