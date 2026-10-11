import { MAGNETS, MAX_TILES, MAX_NAMES } from '../content/magnets.js';

/* ================= FRIDGE MAGNETS: THE COMPOSER =================
   A reusable note builder. Tap a magnet in the tray to add it; tap a placed
   magnet to pick it up, then tap where it should go, or use Move and Take
   off; or drag it into place. Undo steps back through every change. The tray
   holds a shuffled handful (Shuffle deals another) plus the small words a
   sentence always needs, punctuation, and member names when a feature passes
   some in.

     const note = createMagnets({ names: [{ id: '@<uuid>', text: 'Bea' }] });
     el.innerHTML = note.html();          // re-render from note.html() at will
     note.tiles()                          // ['@<uuid>', 'owes', 'me', 'a', 'spoon']

   Its own clicks and drags are handled here, by delegation on the document,
   so a host that re-renders its markup never loses them. Host features must
   not use data-mg on their own elements. */

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CORE = ['the', 'a', 'is', 'my', 'your', 'i', 'you', 'not', 'and', 'again'];
const GLUE_HAND = 8, WORD_HAND = 18, HISTORY = 30, DRAG_START = 8;
const controllers = new Map();
let serial = 0;
function spin(id) { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 5) - 2) * 0.8; }
function shuffled(list, rnd) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function createMagnets({ id = 'mg' + (++serial), bank = MAGNETS, names = [], max = MAX_TILES, maxNames = MAX_NAMES, rnd = Math.random,
  label = 'Your note', onChange = () => {} } = {}) {
  const byId = new Map(bank.map(t => [t.id, t]));
  let tiles = [], selected = -1, history = [], hand = null, people = [];
  const self = { id };

  function setNames(list) {
    people = (Array.isArray(list) ? list : []).filter(n => n && /^@[0-9a-f-]{36}$/.test(n.id) && typeof n.text === 'string').slice(0, 6)
      .map(n => ({ id: n.id, text: n.text || 'A member', colour: /^#[0-9a-f]{6}$/i.test(n.colour || '') ? n.colour : '' }));
  }
  setNames(names);
  function deal() {
    const glue = bank.filter(t => t.group === 'glue'), words = bank.filter(t => !['glue', 'punct'].includes(t.group));
    const core = CORE.filter(x => byId.has(x));
    const extra = shuffled(glue.filter(t => !core.includes(t.id)), rnd).slice(0, GLUE_HAND).map(t => t.id);
    hand = { glue: [...core, ...extra], words: shuffled(words, rnd).slice(0, WORD_HAND).map(t => t.id), punct: bank.filter(t => t.group === 'punct').map(t => t.id) };
  }
  deal();
  const tileOf = tileId => tileId.startsWith('@') ? people.find(p => p.id === tileId) || { id: tileId, text: 'someone who left', name: true } : byId.get(tileId);
  const namesUsed = () => tiles.filter(t => t.startsWith('@')).length;
  const text = () => tiles.map(tileOf).filter(Boolean).reduce((s, t) => t.group === 'punct' || !s ? s + t.text : s + ' ' + t.text, '').trim();
  function commit(next, keepSelection = -1) {
    history.push(tiles); if (history.length > HISTORY) history.shift();
    tiles = next; selected = keepSelection; onChange(self);
  }

  function chip(tileId, { placed = false, at = -1, disabled = false } = {}) {
    const t = tileOf(tileId);
    if (!t) return '';
    const kind = tileId.startsWith('@') ? ' mg-name' : t.group === 'punct' ? ' mg-punct' : '';
    const style = (placed ? '--mg-spin:' + spin(tileId + at) + 'deg;' : '') + (t.colour ? '--mg-name:' + t.colour + ';' : '');
    const attrs = placed
      ? ' data-mg="pick" data-mg-at="' + at + '" aria-pressed="' + (selected === at) + '" aria-label="' + esc(t.text) + ', magnet ' + (at + 1) + ' of ' + tiles.length + (selected === at ? ', picked up' : '') + '"'
      : ' data-mg="add" data-mg-tile="' + esc(tileId) + '" aria-label="Add ' + esc(t.text) + '"';
    return '<button class="mg-tile' + kind + (placed ? ' mg-placed' : '') + (selected === at && placed ? ' mg-selected' : '') + '" type="button"' + attrs +
      (style ? ' style="' + style + '"' : '') + (disabled ? ' disabled' : '') + '>' + esc(t.text) + '</button>';
  }
  function html() {
    const full = tiles.length >= max, nameFull = namesUsed() >= maxNames;
    const note = tiles.length ? tiles.map((t, i) => chip(t, { placed: true, at: i })).join('')
      : '<p class="mg-empty">Tap magnets below to start. Twelve at most. Drag to rearrange.</p>';
    const pick = selected >= 0 ? tileOf(tiles[selected]) : null;
    const tools = pick
      ? '<p class="mg-hint">Tap another magnet to put <b>' + esc(pick.text) + '</b> there, or:</p><div class="mg-tools">' +
        '<button class="btn btn-sm" type="button" data-mg="left"' + (selected === 0 ? ' disabled' : '') + '>Move left</button>' +
        '<button class="btn btn-sm" type="button" data-mg="right"' + (selected === tiles.length - 1 ? ' disabled' : '') + '>Move right</button>' +
        '<button class="btn btn-sm" type="button" data-mg="off">Take off</button><button class="btn btn-sm btn-ghost" type="button" data-mg="drop">Put down</button></div>'
      : '<div class="mg-tools"><button class="btn btn-sm" type="button" data-mg="undo"' + (history.length ? '' : ' disabled') + '>Undo</button>' +
        '<button class="btn btn-sm btn-ghost" type="button" data-mg="clear"' + (tiles.length ? '' : ' disabled') + '>Clear</button></div>';
    const row = (list, opts) => '<div class="mg-row">' + list.map(t => chip(t, opts(t))).join('') + '</div>';
    return '<div class="mg" data-mg-root="' + esc(id) + '">' +
      '<div class="mg-fridge"><div class="mg-note" role="group" aria-label="' + esc(label) + '">' + note + '</div>' +
      '<p class="mg-count"><span>' + tiles.length + ' of ' + max + '</span></p></div>' +
      '<p class="sr-only" aria-live="polite" data-mg-said>' + esc(tiles.length ? 'Note so far: ' + text() : 'The note is empty.') + '</p>' + tools +
      '<div class="mg-tray">' +
      (people.length ? '<p class="mg-label">Members</p>' + row(people.map(p => p.id), t => ({ disabled: full || nameFull || tiles.includes(t) })) : '') +
      '<p class="mg-label">Small words</p>' + row([...hand.glue, ...hand.punct], () => ({ disabled: full })) +
      '<div class="mg-label mg-label-row"><span>Words</span><button class="btn btn-sm btn-ghost" type="button" data-mg="shuffle">Shuffle</button></div>' +
      row(hand.words, () => ({ disabled: full })) + '</div></div>';
  }

  function act(action, el) {
    const at = Number(el?.dataset?.mgAt);
    switch (action) {
      case 'add': {
        const t = el.dataset.mgTile;
        if (tiles.length >= max || !tileOf(t) || (t.startsWith('@') && (namesUsed() >= maxNames || tiles.includes(t)))) return null;
        commit([...tiles, t]);
        return '[data-mg="add"][data-mg-tile="' + CSS.escape(t) + '"]';
      }
      case 'pick':
        if (selected === at) { selected = -1; return '[data-mg="pick"][data-mg-at="' + at + '"]'; }
        if (selected >= 0) { move(selected, at); return '[data-mg="pick"][data-mg-at="' + at + '"]'; }
        selected = at; return '[data-mg="pick"][data-mg-at="' + at + '"]';
      case 'left': if (selected > 0) move(selected, selected - 1, true); return '[data-mg="pick"][data-mg-at="' + selected + '"]';
      case 'right': if (selected < tiles.length - 1) move(selected, selected + 1, true); return '[data-mg="pick"][data-mg-at="' + selected + '"]';
      case 'off': if (selected >= 0) commit(tiles.filter((_, i) => i !== selected)); return '[data-mg="undo"]';
      case 'drop': selected = -1; return '[data-mg="undo"]';
      case 'undo': if (history.length) { tiles = history.pop(); selected = -1; onChange(self); } return '[data-mg="undo"]';
      case 'clear': if (tiles.length) commit([]); return '[data-mg="undo"]';
      case 'shuffle': deal(); return '[data-mg="shuffle"]';
    }
    return null;
  }
  function move(from, to, keep = false) {
    if (from === to || from < 0 || from >= tiles.length) { selected = -1; return; }
    const next = tiles.slice(), [t] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, t);
    commit(next, keep ? Math.max(0, Math.min(next.length - 1, to)) : -1);
  }

  Object.assign(self, {
    html, act, move, setNames, text, tiles: () => tiles.slice(), count: () => tiles.length,
    set(list) { tiles = (Array.isArray(list) ? list : []).filter(t => tileOf(t)).slice(0, max); selected = -1; history = []; },
    clear() { tiles = []; selected = -1; history = []; },
    destroy() { controllers.delete(id); }
  });
  controllers.set(id, self);
  install();
  return self;
}

/* ---------- one set of listeners for every composer on the page ---------- */
function rootOf(el) { return el?.closest?.('[data-mg-root]') || null; }
function redraw(ctrl, focus) {
  const root = document.querySelector('[data-mg-root="' + CSS.escape(ctrl.id) + '"]');
  if (!root) return;
  const tray = root.querySelector('.mg-tray');
  const scroll = tray ? tray.scrollTop : 0;
  root.outerHTML = ctrl.html();
  const next = document.querySelector('[data-mg-root="' + CSS.escape(ctrl.id) + '"]');
  if (next?.querySelector('.mg-tray')) next.querySelector('.mg-tray').scrollTop = scroll;
  if (focus) {
    const target = next?.querySelector(focus);
    (target && !target.disabled ? target : next?.querySelector('[data-mg="undo"]:not([disabled]), .mg-tile:not([disabled])'))?.focus({ preventScroll: true });
  }
}

let installed = false, suppressClick = false, drag = null;
function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-mg]');
    const root = rootOf(b);
    if (!b || !root || b.disabled) return;
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    const ctrl = controllers.get(root.dataset.mgRoot);
    if (!ctrl) return;
    e.preventDefault();
    const focus = ctrl.act(b.dataset.mg, b);
    redraw(ctrl, focus || '[data-mg="' + b.dataset.mg + '"]');
  });
  // Dragging a placed magnet. The other magnets are measured once, when the
  // drag begins; after that only a transform changes, so nothing is laid out
  // again until the magnet is put down.
  document.addEventListener('pointerdown', e => {
    const tile = e.target.closest?.('.mg-placed');
    const root = rootOf(tile);
    if (!tile || !root || e.button > 0) return;
    const ctrl = controllers.get(root.dataset.mgRoot);
    if (!ctrl) return;
    const others = [...root.querySelectorAll('.mg-placed')].map(el => { const r = el.getBoundingClientRect(); return { at: Number(el.dataset.mgAt), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    drag = { ctrl, tile, from: Number(tile.dataset.mgAt), x: e.clientX, y: e.clientY, id: e.pointerId, moving: false, others, to: -1 };
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving) {
      if (Math.hypot(dx, dy) < DRAG_START) return;
      drag.moving = true;
      try { drag.tile.setPointerCapture(e.pointerId); } catch { /* the pointer may already be gone */ }
      drag.tile.classList.add('mg-dragging');
    }
    e.preventDefault();
    drag.tile.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(1.08)';
    let best = null;
    for (const o of drag.others) { const d = Math.hypot(o.x - e.clientX, o.y - e.clientY); if (!best || d < best.d) best = { d, at: o.at }; }
    drag.to = best ? best.at : drag.from;
  }, { passive: false });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { ctrl, moving, from, to } = drag;
    drag = null;
    if (!moving) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (e.type === 'pointerup' && to >= 0 && to !== from) ctrl.move(from, to);
    redraw(ctrl, '[data-mg="pick"][data-mg-at="' + (e.type === 'pointerup' && to >= 0 ? to : from) + '"]');
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}
