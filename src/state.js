import { PROPS } from './content/props.js';
export const Store = (function () {
  const mem = Object.create(null);
  let ok = true;
  try { localStorage.setItem('__sl_test', '1'); localStorage.removeItem('__sl_test'); } catch (e) { ok = false; }
  return {
    get persistent() { return ok; },
    get(k) {
      if (k in mem) return mem[k];
      try { return localStorage.getItem(k); } catch { return null; }
    },
    set(k, v) {
      mem[k] = v;
      try { localStorage.setItem(k, v); ok = true; }
      catch { ok = false; }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('shelflife:storage'));
      return ok;
    },
    remove(k) {
      delete mem[k];
      try { localStorage.removeItem(k); } catch { /* nothing to remove, or storage is unavailable */ }
    }
  };
})();

export const SAVE_KEY = 'shelflife.v4';
export const RECOVERY_KEY = SAVE_KEY + '.recovery';
export let loadFailed = false;
let recoveryRequired = false;
export const SLOT_COUNT = 18;
export const ROW_WIDTH = 6;
export const HOUR = 3600000;
// Needs stop draining after this many hours away. The decay rates in
// content/copy.js are tuned so a full day's absence leaves a hungry shelf, not
// an empty one: coming back should cost care, never a fresh start.
export const MAX_OFFLINE_HOURS = 18;
// Between these local hours the whole shelf is dozing, so needs drain at half
// speed. A night's sleep costs the player half a night's worth of complaints.
export const NIGHT_DECAY_FACTOR = 0.5;
// Games and conspiracies can add at most this much trust per resident per day.
// Care is the steady route; the fast lanes are capped so they stay treats.
export const BONUS_TRUST_PER_DAY = 3;
export const LEGACY_SAVE_KEYS = ['shelflife.v3', 'shelflife.v2', 'shelflife.v1'];

/* ================= FORM ROTATION =================
   Every note carries a `form`. Forms 2/4/6 are physically multi-line (they need
   css white-space:pre-line); 1/3/5/7/8 are single blocks of prose that differ in
   who is speaking and what the note is *of*. Shares are of total note volume.

   Two hard rules, enforced in chooseForm() and asserted in test/comedy.test.mjs:
     1. never the same form twice in a row;
     2. no form other than the plain one-liner twice within four notes.
   Rule 1 is why addNote() tags an untagged note itself rather than defaulting to
   'line': engine/achievements.js and engine/behavior.js emit prose notes back to
   back, and a hardcoded default would put two identical tags next to each other.

   FORM 9, 'thought', is the inner voice: the one form in the game that is not a
   report. Everything else on the corkboard is something the shelf observed or
   something a creature said out loud. A thought is what it did not say, printed
   anyway, and it is the only place the writing is allowed to be fond of you
   without a straight man in the room to undercut it. It is rationed low for that
   reason — an inner monologue is a devastating once, and a diary if overused. */
export const FORMS = ['line', 'two', 'react', 'list', 'found', 'doc', 'direct', 'silence', 'thought'];
export const FORM_SHARE = { line: 40, two: 18, react: 8, list: 10, found: 9, doc: 6, direct: 6, silence: 3, thought: 7 };
// The forms a plain block of prose can be tagged with when the caller did not say.
// Four of them, and one is the one-liner: that is exactly the condition under which
// both rules are always satisfiable. If prev is not 'line', 'line' is free; if prev
// IS 'line', the last three notes hold at most two other forms, so one of the
// remaining three is free. Never shrink this set below four.
export const AMBIENT_FORMS = ['line', 'react', 'found', 'silence'];
export const FORM_LOG_MAX = 8;

export function formAllowed(state, form) {
  const log = (state && state.formLog) || [];
  if (log[0] === form) return false;                                   // rule 1
  if (form !== 'line' && log.slice(0, 3).indexOf(form) >= 0) return false;  // rule 2
  return true;
}

// Weighted draw over `candidates`, minus anything the two rules forbid. `fallback`
// is what to widen to if the rules exclude every candidate — callers that can only
// render certain forms (a block of prose cannot become a document) must pass their
// own candidate list here rather than let it widen to all eight.
export function chooseForm(state, candidates = AMBIENT_FORMS, rnd = Math.random, fallback = FORMS) {
  let ok = candidates.filter(f => FORM_SHARE[f] && formAllowed(state, f));
  if (!ok.length) ok = fallback.filter(f => formAllowed(state, f));
  if (!ok.length) ok = fallback.filter(f => f !== ((state && state.formLog) || [])[0]);
  if (!ok.length) ok = candidates.slice();
  const total = ok.reduce((n, f) => n + FORM_SHARE[f], 0);
  let r = rnd() * total;
  for (const f of ok) { r -= FORM_SHARE[f]; if (r <= 0) return f; }
  return ok[ok.length - 1];
}

/* ================= RECENT-LINE SUPPRESSION =================
   pick() is the one place every pool in the game is drawn from — trait notes,
   complaints, events, prop lines, feud lines, behaviour notes, care toasts — so
   the fix for "the same joke three times in one feed" goes here rather than at
   forty call sites. It is a shuffle bag, not a random draw:

     * anything not picked recently is chosen from uniformly;
     * once a pool is exhausted, it draws from the stalest 40% of it, so even a
       three-line pool cycles instead of repeating;
     * non-string pools (pets, props, trait objects) are unaffected — they fall
       through to a plain uniform draw.

   The memory is module-scoped rather than on `state` because it is a within-
   session display concern, not save data; normalizeState() seeds it from the
   notes already on the corkboard so a reload does not re-tell a visible joke. */
const RECENT_PICKS = [];
export const PICK_MEMORY = 120;
// When a pool is exhausted, draw only from its stalest quarter, so even a five-line
// pool puts real distance between repeats instead of ping-ponging.
export const STALE_FRACTION = 0.25;

export function recentPicks() { return RECENT_PICKS.slice(); }
export function resetPickMemory() { RECENT_PICKS.length = 0; }
export function wasPickedRecently(line, within = PICK_MEMORY) {
  const i = RECENT_PICKS.indexOf(line);
  return i >= 0 && i < within;
}

// Call this for a line that reached a note without going through pick() (an
// assembled template, say), so it counts against future draws.
export function rememberPick(value) {
  if (typeof value !== 'string' || !value) return value;
  const at = RECENT_PICKS.indexOf(value);
  if (at >= 0) RECENT_PICKS.splice(at, 1);
  RECENT_PICKS.unshift(value);
  if (RECENT_PICKS.length > PICK_MEMORY) RECENT_PICKS.length = PICK_MEMORY;
  return value;
}

// The opposite: a line that was drawn and then not shown (a scene the rotation
// rules turned down) should not count as told.
export function forgetPick(value) {
  const at = RECENT_PICKS.indexOf(value);
  if (at >= 0) RECENT_PICKS.splice(at, 1);
}

export function pick(arr) {
  if (!Array.isArray(arr) || !arr.length) return undefined;
  if (arr.length === 1) return rememberPick(arr[0]);
  const ranked = arr.map(v => ({ v, r: typeof v === 'string' ? RECENT_PICKS.indexOf(v) : -1 }));
  let bag = ranked.filter(x => x.r < 0);                               // never used lately
  if (!bag.length) {
    ranked.sort((a, b) => b.r - a.r);                                  // stalest first
    bag = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * STALE_FRACTION)));
  }
  return rememberPick(bag[Math.floor(Math.random() * bag.length)].v);
}

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function defaultNeeds() { return { food: 78, fuss: 78, clean: 82 }; }
export function defaultDecor() { return { room: 'aubergine', wall: 'none', wood: 'rosewood', accent: 'bubblegum' }; }
export function defaultStreak() { return { count: 0, lastCheckin: 0 }; }
export function defaultSettings() { return { muted: false, narratorOn: true, narratorVoiceURI: null, matureMode: false }; }
export function defaultCareLog() { return { food: 0, fuss: 0, clean: 0 }; }
// meeting: how many times the shelf has convened over you. carried: how many times
// Item 4 has been carried forward. struck: petId -> when that pet closed the matter.
export function defaultLedger() { return { meeting: 1, carried: 0, struck: {}, arcSum: 0 }; }

export function blankState() {
  return {
    v: 4, pets: [], props: [], slots: new Array(SLOT_COUNT).fill(null),
    notes: [], seq: 1, lastTick: Date.now(), started: Date.now(),
    seenUnlocks: [], decor: defaultDecor(), achievements: [], feudArcs: {},
    streak: defaultStreak(), settings: defaultSettings(),
    gone: [], visits: [], ledger: defaultLedger(), roster: {}, rosterSeeded: false,
    formLog: [], noteCount: 0, lastGoneNote: 0, lastBackup: 0, backupSnooze: 0
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
  if (a.anatomy && typeof a.anatomy === 'object' && !Array.isArray(a.anatomy)) out.anatomy = { ...a.anatomy };
  if (a.bounds && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(a.bounds[k]))) out.bounds = { ...a.bounds };
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
  // Work on a copy: a failed restore must never partially mutate the live shelf.
  let s;
  try { s = JSON.parse(JSON.stringify(raw)); } catch { return null; }
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const finite = (value, fallback, lo = 0, hi = Number.MAX_SAFE_INTEGER) =>
    Number.isFinite(value) ? clamp(value, lo, hi) : fallback;
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id) &&
    !['__proto__', 'constructor', 'prototype'].includes(id);
  if (s.pets.some(p => !record(p) || !validId(p.id))) return null;
  s.props = Array.isArray(s.props) ? s.props : [];
  if (s.props.some(p => !record(p) || !validId(p.id) || typeof p.kind !== 'string')) return null;
  // Furniture this build no longer knows is put away rather than bricking the
  // shelf: a backup from a newer edition, or a retired kind, still loads.
  s.props = s.props.filter(p => Object.hasOwn(PROPS, p.kind));
  // Reject malformed history records before any gameplay can consume them.
  for (const key of ['gone', 'visits']) {
    if (Array.isArray(s[key]) && s[key].some(item => !record(item))) return null;
  }
  for (const key of ['feudArcs', 'roster']) {
    if (record(s[key]) && Object.values(s[key]).some(item => !record(item))) return null;
  }
  const ids = [...s.pets, ...s.props].map(p => p.id);
  if (ids.length > SLOT_COUNT || new Set(ids).size !== ids.length) return null;
  const now = Date.now();
  s.seq = Math.floor(finite(s.seq, ids.length + 1, 1));
  s.lastTick = finite(s.lastTick, now, 1, now);
  s.started = finite(s.started, now, 1, now);
  s.lastRounds = finite(s.lastRounds, 0, 0, now);
  s.notes = (Array.isArray(s.notes) ? s.notes : []).filter(n => record(n) && typeof n.text === 'string')
    .slice(0, 40).map(n => ({ ...n, text: n.text.slice(0, 10000), from: typeof n.from === 'string' ? n.from : 'the shelf',
      kind: typeof n.kind === 'string' && /^[a-z-]+$/.test(n.kind) ? n.kind : 'note', at: finite(n.at, now) }));
  s.v = 4;
  s.notes = Array.isArray(s.notes) ? s.notes : [];
  s.seq = s.seq || (s.pets.length + 1);
  s.lastTick = s.lastTick || Date.now();
  s.started = s.started || Date.now();
  s.seenUnlocks = Array.isArray(s.seenUnlocks) ? s.seenUnlocks : [];
  s.props = Array.isArray(s.props) ? s.props : [];
  s.decor = Object.assign(defaultDecor(), s.decor || {});
  s.achievements = Array.isArray(s.achievements) ? s.achievements : [];
  // When each incident happened, so the log can be dated. Additive: a save from
  // before this existed simply has undated entries.
  s.achievementAt = record(s.achievementAt) ? s.achievementAt : {};
  Object.keys(s.achievementAt).forEach(k => {
    if (!Number.isFinite(s.achievementAt[k])) delete s.achievementAt[k];
  });
  s.feudArcs = s.feudArcs && typeof s.feudArcs === 'object' ? s.feudArcs : {};
  s.streak = s.streak && typeof s.streak === 'object' ? Object.assign(defaultStreak(), s.streak) : defaultStreak();
  s.settings = s.settings && typeof s.settings === 'object' ? Object.assign(defaultSettings(), s.settings) : defaultSettings();
  // Keep valid positions, remove stale/duplicate occupants, then seat missing ones.
  const seated = new Set();
  const oldSlots = Array.isArray(s.slots) ? s.slots : [];
  s.slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const id = oldSlots[i];
    if (!ids.includes(id) || seated.has(id)) return null;
    seated.add(id);
    return id;
  });
  ids.filter(id => !seated.has(id)).forEach(id => { s.slots[s.slots.indexOf(null)] = id; });
  // Comedy-direction state (v4.1). Every field is additive and defaulted here, so a
  // save written before any of this existed loads with empty histories rather than
  // undefined reads in the note templates.
  s.gone = Array.isArray(s.gone) ? s.gone.filter(g => typeof g.name === 'string' && Number.isFinite(g.at)) : [];
  s.visits = Array.isArray(s.visits) ? s.visits.filter(v => Number.isFinite(v.at)).slice(-20) : [];
  s.ledger = s.ledger && typeof s.ledger === 'object' ? Object.assign(defaultLedger(), s.ledger) : defaultLedger();
  if (!s.ledger.struck || typeof s.ledger.struck !== 'object') s.ledger.struck = {};
  s.roster = s.roster && typeof s.roster === 'object' ? s.roster : {};
  s.rosterSeeded = s.rosterSeeded === true;
  s.formLog = Array.isArray(s.formLog) ? s.formLog.filter(f => FORMS.indexOf(f) >= 0) : [];
  s.noteCount = typeof s.noteCount === 'number' ? s.noteCount : s.notes.length;
  s.lastGoneNote = typeof s.lastGoneNote === 'number' ? s.lastGoneNote : 0;
  // When this shelf was last written to a file, and when the player last waved the
  // reminder away. Both default to zero, so a save from before the reminder existed
  // is treated as never-backed-up rather than as recently safe.
  s.lastBackup = finite(s.lastBackup, 0, 0, now);
  s.backupSnooze = finite(s.backupSnooze, 0, 0, now);
  // Per-pair friction: what these two have actually done to each other, as
  // opposed to what their traits say they should think of each other.
  s.friction = record(s.friction) ? s.friction : {};
  Object.entries(s.friction).forEach(([key, value]) => {
    if (!record(value) || !Number.isFinite(value.n) || !Number.isFinite(value.at) || !/^[\w-]+\|[\w-]+$/.test(key)) delete s.friction[key];
    else s.friction[key] = { n: clamp(value.n, 0, 8), at: finite(value.at, now, 0, now) };
  });
  s.notes.forEach(n => { if (n && FORMS.indexOf(n.form) < 0) n.form = 'line'; });

  for (const key of ['muted', 'narratorOn', 'matureMode']) {
    if (typeof s.settings[key] !== 'boolean') s.settings[key] = defaultSettings()[key];
  }
  s.streak.count = Math.floor(finite(s.streak.count, 0));
  s.streak.lastCheckin = finite(s.streak.lastCheckin, 0);
  s.pets = s.pets.map(migratePet);
  s.pets.forEach(p => {
    p.name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 22) : 'Someone';
    p.bio = typeof p.bio === 'string' ? p.bio.slice(0, 3000) : 'It arrived without references.';
    p.born = finite(p.born, s.started, 1, now);
    p.lastPlayed = finite(p.lastPlayed, 0, 0, now);
    if (record(p.chaseBest)) p.chaseBest = { score: Math.floor(finite(p.chaseBest.score, 0, 0, 100000)), caught: Math.floor(finite(p.chaseBest.caught, 0, 0, 100)), dodged: Math.floor(finite(p.chaseBest.dodged, 0, 0, 100)), at: finite(p.chaseBest.at, now, 0, now), bestStreak: Math.floor(finite(p.chaseBest.bestStreak, 0, 0, 100)), stars: Math.floor(finite(p.chaseBest.stars, 0, 0, 3)) };
    else delete p.chaseBest;
    for (const key of ['handshakes', 'dustPatrols', 'chases', 'alibis', 'fulfilledRequests', 'refusedRequests']) p[key] = Math.floor(finite(p[key], 0));
    p.traits = Array.isArray(p.traits) ? p.traits.filter(t => typeof t === 'string' && !['__proto__', 'prototype', 'constructor'].includes(t)) : [];
    p.stats = record(p.stats) ? p.stats : {};
    ['cute', 'menace', 'damp', 'mystique'].forEach(k => { p.stats[k] = finite(p.stats[k], 5, 1, 10); });
    p.needs = record(p.needs) ? p.needs : {};
    Object.entries(defaultNeeds()).forEach(([k, v]) => { p.needs[k] = finite(p.needs[k], v, 0, 100); });
    p.bond = Math.floor(finite(p.bond, 0, 0, 25));
    ['cared', 'grudges', 'grudgeStage'].forEach(k => { p[k] = Math.floor(finite(p[k], 0)); });
    p.lastGrudgeAt = finite(p.lastGrudgeAt, 0, 0, now);
    p.grudgeLog = (Array.isArray(p.grudgeLog) ? p.grudgeLog : [])
      .filter(g => record(g) && typeof g.why === 'string' && Number.isFinite(g.at))
      .map(g => ({ why: g.why.slice(0, 80), at: g.at })).slice(-GRUDGE_LOG_MAX);
    p.bonusTrust = record(p.bonusTrust) && typeof p.bonusTrust.day === 'string'
      ? { day: p.bonusTrust.day.slice(0, 12), n: Math.floor(finite(p.bonusTrust.n, 0, 0, 99)) } : null;
    if (!p.bonusTrust) delete p.bonusTrust;
    p.art = normalizePetArt(p.art);
    p.art.stamps = p.art.stamps.filter(stamp => record(stamp) && typeof stamp.kind === 'string' && [stamp.x, stamp.y, stamp.size].every(Number.isFinite));
    if (!p.needs) p.needs = defaultNeeds();
    if (typeof p.bond !== 'number') p.bond = 0;
    if (typeof p.cared !== 'number') p.cared = 0;
    if (typeof p.grudges !== 'number') p.grudges = 0;
    if (typeof p.grudgeStage !== 'number') p.grudgeStage = 0;
    if (!p.careLog || typeof p.careLog !== 'object') p.careLog = defaultCareLog();
    else ['food', 'fuss', 'clean'].forEach(k => { if (typeof p.careLog[k] !== 'number') p.careLog[k] = 0; });
    if (typeof p.firstTouch !== 'number') p.firstTouch = 0;
    if (typeof p.bestFuss !== 'number') p.bestFuss = 0;
    if (typeof p.fussRun !== 'number') p.fussRun = 0;
    if (!Array.isArray(p.names) || !p.names.length) p.names = [{ name: p.name, at: p.born || s.started }];
    p.names = p.names.filter(n => record(n) && typeof n.name === 'string');
    if (!p.names.length) p.names = [{ name: p.name, at: p.born }];
    p.slotHist = Array.isArray(p.slotHist) ? p.slotHist.filter(h => record(h) && Number.isFinite(h.slot) && Number.isFinite(h.at)).slice(-8) : [];
    // What it is currently trying to do about where it is standing (engine/behavior.js).
    p.wants = record(p.wants) && Number.isFinite(p.wants.slot)
      ? { slot: clamp(Math.floor(p.wants.slot), 0, SLOT_COUNT - 1), since: finite(p.wants.since, now, 0, now),
          at: finite(p.wants.at, now, 0, now), tries: Math.floor(finite(p.wants.tries, 1, 0, 20)) }
      : null;
    if (!p.wants) delete p.wants;
    p.displacedFrom = Number.isFinite(p.displacedFrom) ? clamp(Math.floor(p.displacedFrom), 0, SLOT_COUNT - 1) : null;
    p.displacedAt = finite(p.displacedAt, 0, 0, now);
  });
  return s;
}

/* ================= WHAT THE SAVE FILE REMEMBERS =================
   The four recorders below are the whole of lever 3. Everything they write is
   cheap, additive and read back by the note templates in engine/loop.js. */

export const SLOT_HIST_MAX = 8;
export const GRUDGE_LOG_MAX = 6;
export const VISIT_MAX = 20;

export function localDayKey(ts = Date.now()) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

// Trust from games and conspiracies, rationed per resident per local day.
// Returns how much was actually granted, so the caller can say so honestly.
export function grantBonusTrust(pet, amount, now = Date.now()) {
  if (!pet || !(amount > 0)) return 0;
  const day = localDayKey(now);
  if (!pet.bonusTrust || pet.bonusTrust.day !== day) pet.bonusTrust = { day, n: 0 };
  const room = Math.max(0, Math.min(BONUS_TRUST_PER_DAY - pet.bonusTrust.n, 25 - (pet.bond || 0)));
  const granted = Math.min(amount, room);
  if (granted > 0) {
    pet.bond = clamp((pet.bond || 0) + granted, 0, 25);
    pet.bonusTrust.n += granted;
  }
  return granted;
}

export function bonusTrustLeft(pet, now = Date.now()) {
  if (!pet) return 0;
  const day = localDayKey(now);
  const used = pet.bonusTrust && pet.bonusTrust.day === day ? pet.bonusTrust.n : 0;
  return Math.max(0, BONUS_TRUST_PER_DAY - used);
}
export const VISIT_GAP_MS = 2 * HOUR;   // a gap this long starts a new visit
export const BRIEFING_AT = 12;          // total grudges at which new arrivals get briefed

/* ================= THE BACKUP REMINDER =================
   Everything in this game lives in one browser's localStorage: no account, no
   sync, and no way back from a cleared site-data dialog. The game has always
   offered a backup under More and has never once suggested taking one, so the
   players most likely to lose a shelf were exactly the ones who never opened that
   menu. These rules ask — but only once a shelf is old enough and populated
   enough to be worth losing, and never more often than once a week. */
export const BACKUP_MIN_PETS = 3;
export const BACKUP_MIN_AGE = 2 * 24 * HOUR;      // nothing on day one
export const BACKUP_STALE = 7 * 24 * HOUR;        // a week since the last copy
export const BACKUP_SNOOZE = 3 * 24 * HOUR;       // "Not now" buys three days

export function backupDue(state, now = Date.now()) {
  if (!state || (state.pets || []).length < BACKUP_MIN_PETS) return false;
  if (now - (state.started || now) < BACKUP_MIN_AGE) return false;
  if (now - (state.backupSnooze || 0) < BACKUP_SNOOZE) return false;
  return now - (state.lastBackup || 0) >= BACKUP_STALE;
}

export function totalGrudges(state) {
  return (state.pets || []).reduce((n, p) => n + (p.grudges || 0), 0);
}

// Names of the pets physically either side of a slot. Duplicated (cheaply) from
// engine/tick.js so state.js keeps importing nothing.
export function neighborNamesAt(state, slot) {
  if (!(slot >= 0)) return [];
  const out = [];
  if (slot % ROW_WIDTH > 0) out.push(slot - 1);
  if (slot % ROW_WIDTH < ROW_WIDTH - 1) out.push(slot + 1);
  return out.map(i => state.slots[i]).filter(Boolean)
    .map(id => (state.pets.find(p => p.id === id) || {}).name).filter(Boolean);
}

// A visit is a contiguous run of attention. Anything after a VISIT_GAP_MS silence
// is a new one, and the gap it opened is kept on it as `away` (hours are derived
// at note time). Returns the current visit.
export function recordVisit(state, now = Date.now()) {
  if (!Array.isArray(state.visits)) state.visits = [];
  const last = state.visits[state.visits.length - 1];
  if (last && now - (last.at + (last.dur || 0)) < VISIT_GAP_MS) {
    last.dur = Math.max(last.dur || 0, now - last.at);
    last.fresh = false;
    return last;
  }
  const v = { at: now, dur: 0, firstTouch: null, away: last ? now - (last.at + (last.dur || 0)) : 0, fresh: true };
  state.visits.push(v);
  if (state.visits.length > VISIT_MAX) state.visits.splice(0, state.visits.length - VISIT_MAX);
  return v;
}

// Called from engine/care.js on every accepted care action.
export function recordCare(state, pet, need, now = Date.now()) {
  if (!state || !pet || !need) return null;
  if (!pet.careLog || typeof pet.careLog !== 'object') pet.careLog = defaultCareLog();
  pet.careLog[need] = (pet.careLog[need] || 0) + 1;
  if (need === 'fuss') {
    pet.fussRun = (pet.fussRun || 0) + 1;
    if (pet.fussRun > (pet.bestFuss || 0)) { pet.bestFuss = pet.fussRun; pet.bestFussAt = now; }
  } else {
    pet.fussRun = 0;
  }
  const visit = recordVisit(state, now);
  if (visit && !visit.firstTouch) {
    visit.firstTouch = pet.id;
    pet.firstTouch = (pet.firstTouch || 0) + 1;
  }
  return visit;
}

// How many of the remembered visits began with this pet, and who leads overall.
export function firstTouchCounts(state) {
  const counts = {};
  (state.visits || []).forEach(v => { if (v.firstTouch) counts[v.firstTouch] = (counts[v.firstTouch] || 0) + 1; });
  return counts;
}

/* Silent bookkeeping, run before notes are written. It watches the shelf rather
   than asking every caller to report in, so a rename from ui/card.js, a drag from
   ui/drag.js and a self-move from engine/behavior.js are all recorded the same way
   without those modules knowing this exists. */
export function reconcile(state, now = Date.now()) {
  if (!state || !Array.isArray(state.pets)) return state;
  if (!state.roster || typeof state.roster !== 'object') state.roster = {};
  if (!Array.isArray(state.gone)) state.gone = [];
  if (!state.ledger) state.ledger = defaultLedger();
  const seeded = state.rosterSeeded === true;
  const briefing = totalGrudges(state) >= BRIEFING_AT;
  const live = {};

  state.pets.forEach(p => {
    live[p.id] = true;
    if (!Array.isArray(p.names) || !p.names.length) p.names = [{ name: p.name, at: p.born || now }];
    else if (p.names[p.names.length - 1].name !== p.name) p.names.push({ name: p.name, at: now });

    const slot = state.slots.indexOf(p.id);
    if (!Array.isArray(p.slotHist)) p.slotHist = [];
    const lastSlot = p.slotHist[p.slotHist.length - 1];
    if (slot >= 0 && (!lastSlot || lastSlot.slot !== slot)) {
      p.slotHist.push({ slot, at: now, from: lastSlot ? lastSlot.slot : null });
      if (p.slotHist.length > SLOT_HIST_MAX) p.slotHist.splice(0, p.slotHist.length - SLOT_HIST_MAX);
    }
    // An arrival the shelf has never seen before. If the ledger is already deep,
    // this one gets briefed on the way in (4b) — one integer, delivered by a
    // creature that was not there for any of it.
    if (!state.roster[p.id] && seeded && briefing && !p.briefed) p.briefPending = true;
    state.roster[p.id] = { name: p.name, slot, at: now, neighbors: neighborNamesAt(state, slot) };
  });

  Object.keys(state.roster).forEach(id => {
    if (live[id]) return;
    const r = state.roster[id];
    delete state.roster[id];
    if (!seeded) return;
    // state.gone is never pruned. This is the only record that survives a pet.
    state.gone.push({ id, name: r.name, slot: r.slot, at: now, neighbors: r.neighbors || [] });
  });
  state.rosterSeeded = true;

  // Every feud escalation is another meeting the shelf has held about you.
  const arcSum = Object.keys(state.feudArcs || {}).reduce((n, k) => n + (state.feudArcs[k].level || 0), 0);
  if (typeof state.ledger.arcSum !== 'number') state.ledger.arcSum = arcSum;
  if (arcSum > state.ledger.arcSum) {
    state.ledger.meeting += arcSum - state.ledger.arcSum;
    state.ledger.arcSum = arcSum;
  }
  return state;
}

function preserveUnreadableSave(raw) {
  loadFailed = true;
  recoveryRequired = !Store.set(RECOVERY_KEY, raw);
  return blankState();
}
export function load() {
  let raw;
  try {
    raw = Store.get(SAVE_KEY) || Store.get('shelflife.v3') || Store.get('shelflife.v2') || Store.get('shelflife.v1');
    if (!raw) return blankState();
    const normalized = normalizeState(JSON.parse(raw));
    if (!normalized) return preserveUnreadableSave(raw);
    // Seed the shuffle bag from the corkboard, so reloading the page does not
    // let it re-tell a joke that is still visible on screen.
    normalized.notes.slice().reverse().forEach(n => { if (n && n.text) rememberPick(n.text); });
    return normalized;
  } catch { return raw ? preserveUnreadableSave(raw) : blankState(); }
}

export let state = load();
export function setState(next) { state = next; }
export function save() {
  try {
    // Never overwrite an unreadable original until its recovery copy is safe.
    if (recoveryRequired) {
      if (!Store.set(RECOVERY_KEY, Store.get(RECOVERY_KEY))) return false;
      recoveryRequired = false;
    }
    const ok = Store.set(SAVE_KEY, JSON.stringify(state));
    // The first successful v4 save retires the old keys: a v3 shelf of drawn
    // pets is megabytes of data-URLs sitting next to the live save, and on a
    // small quota that is the difference between saving and not.
    if (ok && !legacyCleared) { legacyCleared = true; LEGACY_SAVE_KEYS.forEach(k => Store.remove(k)); }
    return ok;
  } catch { return false; }
}
let legacyCleared = false;

let noteListeners = [];
export function onNote(listener) { noteListeners.push(listener); }
// `form` is optional: a caller that knows its text is a two-hander, a list or a
// filled-in document says so, and anything else gets tagged by the rotation engine
// as the prose form that keeps the corkboard from repeating itself.
export function addNote(state, text, from, kind = 'note', form) {
  const f = FORMS.indexOf(form) >= 0 ? form : chooseForm(state, AMBIENT_FORMS);
  const n = { text, from, kind, form: f, at: Date.now() };
  state.notes.unshift(n);
  if (state.notes.length > 40) state.notes.length = 40;
  if (!Array.isArray(state.formLog)) state.formLog = [];
  state.formLog.unshift(f);
  if (state.formLog.length > FORM_LOG_MAX) state.formLog.length = FORM_LOG_MAX;
  state.noteCount = (state.noteCount || 0) + 1;
  noteListeners.forEach(fn => { try { fn(n, state); } catch (e) {} });
  return n;
}

export function petById(state, id) { return state.pets.find(p => p.id === id) || null; }
export function propById(state, id) { return (state.props || []).find(x => x.id === id) || null; }
export function occupant(state, id) { return petById(state, id) || propById(state, id); }
