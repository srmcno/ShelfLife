export const Store = (function () {
  let mem = {}, ok = true;
  try { localStorage.setItem('__sl_test', '1'); localStorage.removeItem('__sl_test'); } catch (e) { ok = false; }
  return {
    persistent: ok,
    get(k) { try { return ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } }
  };
})();

export const SAVE_KEY = 'shelflife.v4';
export const SLOT_COUNT = 18;
export const HOUR = 3600000;
export const MAX_OFFLINE_HOURS = 48;

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function defaultNeeds() { return { food: 78, fuss: 78, clean: 82 }; }
export function defaultDecor() { return { room: 'aubergine', wall: 'none', wood: 'rosewood', accent: 'bubblegum' }; }
export function defaultStreak() { return { count: 0, lastCheckin: 0 }; }
export function defaultSettings() { return { muted: false, narratorOn: true, narratorVoiceURI: null, matureMode: false }; }

export function blankState() {
  return {
    v: 4, pets: [], props: [], slots: new Array(SLOT_COUNT).fill(null),
    notes: [], seq: 1, lastTick: Date.now(), started: Date.now(),
    seenUnlocks: [], decor: defaultDecor(), achievements: [], feudArcs: {},
    streak: defaultStreak(), settings: defaultSettings()
  };
}

// ---------------------------------------------------------------------------
// The pet art model
// ---------------------------------------------------------------------------
// Two shapes, one optional field:
//
//   { body, stamps }               a FREEHAND pet — a raster data-URL body plus
//                                  positional stamp layers. Unchanged since v4.
//   { body:'', stamps:[], creature } a GENERATED pet — a plain serializable
//                                  creature from src/art/creatures.js, rendered
//                                  as vector SVG at display time.
//
// A generated pet deliberately stores NO raster fallback: vector is the whole
// point (it stays crisp at any --pet-h, it carries the data-part tagging the
// animation director needs, and it costs ~600 bytes of save instead of a ~60KB
// PNG data-URL). `body`/`stamps` are still always present so every existing
// reader — sprite.js's raster path, art/anatomy.js's stamp inference,
// engine/behavior.js — keeps the shape it already expects.
export function normalizePetArt(art) {
  const a = art && typeof art === 'object' ? art : {};
  const out = {
    body: typeof a.body === 'string' ? a.body : '',
    stamps: Array.isArray(a.stamps) ? a.stamps : []
  };
  if (a.creature && typeof a.creature === 'object') out.creature = a.creature;
  return out;
}

// Upgrades a pre-v4 pet (flattened single image, no art.stamps) to the v4 shape.
// Idempotent: a pet that already has `art.stamps` is returned unchanged.
export function migratePet(rawPet) {
  // A generated pet is already current; it only needs the {body,stamps} keys
  // guaranteed present, so a save hand-edited down to just `creature` (or one
  // written by an older/newer build) still renders and still animates.
  if (rawPet.art && rawPet.art.creature && typeof rawPet.art.creature === 'object') {
    if (Array.isArray(rawPet.art.stamps) && typeof rawPet.art.body === 'string') return rawPet;
    const p = { ...rawPet, art: normalizePetArt(rawPet.art) };
    if (typeof p.grudgeStage !== 'number') p.grudgeStage = 0;
    return p;
  }
  if (rawPet.art && Array.isArray(rawPet.art.stamps)) return rawPet;
  const p = { ...rawPet };
  p.art = { body: rawPet.img || '', stamps: [] };
  delete p.img;
  if (typeof p.grudgeStage !== 'number') p.grudgeStage = 0;
  return p;
}

// Shared by load() (parsing from Store) and main.js's import/restore flow
// (parsing from an uploaded backup file) so both go through identical
// migration/defaulting logic. Returns null if `raw` isn't a usable save shape.
export function normalizeState(raw) {
  if (!raw || !Array.isArray(raw.pets)) return null;
  const s = raw;
  s.v = 4;
  s.notes = Array.isArray(s.notes) ? s.notes : [];
  s.seq = s.seq || (s.pets.length + 1);
  s.lastTick = s.lastTick || Date.now();
  s.started = s.started || Date.now();
  s.seenUnlocks = Array.isArray(s.seenUnlocks) ? s.seenUnlocks : [];
  s.props = Array.isArray(s.props) ? s.props : [];
  s.decor = Object.assign(defaultDecor(), s.decor || {});
  s.achievements = Array.isArray(s.achievements) ? s.achievements : [];
  s.feudArcs = s.feudArcs && typeof s.feudArcs === 'object' ? s.feudArcs : {};
  s.streak = s.streak && typeof s.streak === 'object' ? Object.assign(defaultStreak(), s.streak) : defaultStreak();
  s.settings = s.settings && typeof s.settings === 'object' ? Object.assign(defaultSettings(), s.settings) : defaultSettings();
  if (!Array.isArray(s.slots) || s.slots.length !== SLOT_COUNT) {
    const slots = new Array(SLOT_COUNT).fill(null);
    s.pets.forEach((p, i) => { if (i < SLOT_COUNT) slots[i] = p.id; });
    s.slots = slots;
  }
  s.pets = s.pets.map(migratePet);
  s.pets.forEach(p => {
    if (!p.needs) p.needs = defaultNeeds();
    if (typeof p.bond !== 'number') p.bond = 0;
    if (typeof p.cared !== 'number') p.cared = 0;
    if (typeof p.grudges !== 'number') p.grudges = 0;
    if (typeof p.grudgeStage !== 'number') p.grudgeStage = 0;
  });
  return s;
}

export function load() {
  try {
    const raw = Store.get(SAVE_KEY) || Store.get('shelflife.v2') || Store.get('shelflife.v1');
    if (!raw) return blankState();
    const normalized = normalizeState(JSON.parse(raw));
    return normalized || blankState();
  } catch (e) { return blankState(); }
}

export let state = load();
export function setState(next) { state = next; }
export function save() { try { Store.set(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }

let noteListeners = [];
export function onNote(listener) { noteListeners.push(listener); }
export function addNote(state, text, from, kind = 'note') {
  const n = { text, from, kind, at: Date.now() };
  state.notes.unshift(n);
  if (state.notes.length > 40) state.notes.length = 40;
  noteListeners.forEach(fn => { try { fn(n, state); } catch (e) {} });
}

export function petById(state, id) { return state.pets.find(p => p.id === id) || null; }
export function propById(state, id) { return (state.props || []).find(x => x.id === id) || null; }
export function occupant(state, id) { return petById(state, id) || propById(state, id); }
