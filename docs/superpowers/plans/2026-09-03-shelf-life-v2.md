# Shelf Life v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note for this project:** the user has ultracode enabled and asked for multi-agent Workflow orchestration. Execution will be driven by a Workflow script that maps the dependency waves below onto `pipeline()`/`parallel()` calls, one agent per task, rather than the standard subagent-driven-development loop. The task breakdown, interfaces, and code in this plan are what each Workflow agent is briefed with.

**Goal:** Rebuild the single-file "Shelf Life" prototype into a multi-file, PWA-installable tamagotchi game with layered animated pet sprites, procedural sound + a speaking narrator, and a much larger, darker-humor content pool.

**Architecture:** Plain ES modules (no bundler), strictly layered so imports only point one direction: `state.js` (base, zero deps) → `content/*.js` (data, zero deps) → `engine/*.js` (game logic, imports state+content) → `art/*.js` and `audio/*.js` (imports state+content+engine) → `ui/*.js` (imports everything below it) → `main.js` (wires it all together). No file outside this order imports "up" the stack — that's what keeps 6+ build tasks parallelizable without merge conflicts.

**Tech Stack:** Vanilla JS (ES2022+, native `<script type="module">`), plain CSS, Web App Manifest + Service Worker for PWA, Web Audio API for SFX, SpeechSynthesis API for the narrator, Node's built-in `node:test`/`node:assert` runner for engine unit tests (zero dependencies — no package.json, no npm install).

**Spec:** `~/shelf-life/DESIGN.md`

## Global Constraints

- No build step, no npm dependencies, no bundler. Everything runs from static files served over http(s) (ES modules and the service worker do not work from `file://`) — dev server: `python3 -m http.server 8000` from `~/shelf-life/`.
- Original prototype for reference/porting, already fully read this session: `~/Documents/shelf-life.html` (do not modify it).
- Voice: deadpan, passive-aggressive, dark-comic, spooky-cute menace. Never graphic, never a real threat.
- Testing split: `engine/*.js` (pure logic — decay, mood, care, unlocks, achievements, grudge/feud arcs, streak) gets real automated tests via `node --test test/`. Everything DOM-facing (`art/*.js`, `audio/*.js`, `ui/*.js`, `main.js`) gets manual smoke-test verification steps against a local static server — no jsdom, no browser test framework, per the no-build-step constraint.
- `Store` (localStorage wrapper), `addNote`/`onNote`, save key, and `SLOT_COUNT` are defined once in `state.js`. No other file touches `localStorage` directly.
- Every function that reads or mutates the game takes the `state` object as an explicit first argument (never closes over a hidden global) — this is what makes `engine/*.js` unit-testable with disposable fixture states instead of the live singleton, and it must be followed consistently across every task below.
- All new save data is additive/migrated — an old save from `~/Documents/shelf-life.html` (format v3, no `art.stamps`, no `achievements`/`feudArcs`/`streak`/`settings`) must still load without data loss.

---

## Execution order (dependency waves)

For the Workflow script driving implementation: tasks in the same wave have no dependency on each other and should run via `parallel()`; each wave depends only on waves before it.

- **Wave 1** (fully parallel, 6 tasks): Task 1 (scaffold+state.js), Task 3 (traits+feuds), Task 4 (copy+props+decor), Task 5 (stamps.js), Task 10 (audio), Task 15 (PWA manifest/service-worker/icons)
- **Wave 2** (needs Wave 1): Task 2 (index.html+css — needs nothing structurally but benefits from state.js's settings shape being final, so sequence after Task 1), Task 6 (sprite.js — needs stamps.js), Task 7 (studio.js — needs stamps.js+state.js), Task 8 (tick.js+care.js — needs state.js+copy.js), Task 9 (unlocks+achievements+loop — needs state.js+traits+feuds+copy)
- **Wave 3** (needs Wave 2): Task 11 (render.js+toast.js — needs sprite.js+engine+content), Task 12 (card.js — needs engine+content+state), Task 13 (decorUI.js+drag.js — needs state+content+engine/unlocks)
- **Wave 4** (needs Wave 3): Task 14 (main.js — needs everything above it)
- **Wave 5** (needs Wave 4): Task 16 (final integration + manual smoke test + README)

---

## Global contracts

Every task's Interfaces block references these exact shapes. Read this section before starting any task.

### Save data shape (v4)

```js
// state object
{
  v: 4,
  pets: [ Pet ],
  props: [ Prop ],
  slots: Array(18) of (id string | null),
  notes: [ { text, from, kind, at } ],
  seq: number,
  lastTick: number,
  started: number,
  seenUnlocks: [ string ],
  decor: { room, wall, wood, accent },
  achievements: [ string ],           // unlocked achievement ids
  feudArcs: { [pairKey]: { level: number, truce: boolean } },  // pairKey = [idA,idB] sorted, joined "|"
  streak: { count: number, lastCheckin: number },
  settings: { muted: boolean, narratorOn: boolean, narratorVoiceURI: string|null, matureMode: boolean }
}

// Pet
{
  id, name,
  art: { body: dataURLstring, stamps: [ { kind, x, y, size, rotation, color } ] },
  traits: [ traitId, ... ],
  stats: { cute, menace, damp, mystique },
  bio: string,
  born: number,
  needs: { food, fuss, clean },       // 0-100
  bond: number,                       // 0-25
  cared: number,
  grudges: number,
  grudgeStage: number                 // 0-3
}

// Prop
{ id, kind }
```

### Module export contracts

```
state.js:
  Store, SAVE_KEY, SLOT_COUNT, HOUR, MAX_OFFLINE_HOURS
  pick(arr), clamp(n,lo,hi)
  defaultNeeds(), defaultDecor(), defaultStreak(), defaultSettings()
  blankState(), migratePet(rawPet), normalizeState(raw), load(), save(), state, setState(next)
  onNote(listener), addNote(state, text, from, kind='note')
  petById(state,id), propById(state,id), occupant(state,id)

content/traits.js:      TRAITS, TRAIT_BY_ID
content/feuds.js:        FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES
content/copy.js:         NEED_LABEL, DECAY, COMPLAINTS, CARE_LINES, OVERFED, HAPPY_NOTES,
                          ASLEEP_LINES, EVENTS, FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS,
                          GRUDGE_LINES, STREAK_LINES
content/props.js:        PROPS, PROP_ART
content/decor.js:        ROOMS, WALLS, WOODS, ACCENTS
content/mature.js:       MATURE_COMPLAINTS_EXTRA, MATURE_HAPPY_EXTRA, MATURE_EVENTS_EXTRA, MATURE_GRUDGE_EXTRA
                          (opt-in extra-profane lines mixed into the normal pools by engine/loop.js
                          only when state.settings.matureMode is true — crude language/swearing for
                          comedic emphasis, not sexual content; default OFF, explicit toggle in the UI)

art/stamps.js:           CANVAS_SIZE (=640), BASE_STAMPS, UNLOCK_STAMPS, STAMP_LABELS, STAMP_SVG,
                          STAMP_ANIM_CLASS, DEFAULT_STAMP_SIZE
art/sprite.js:            renderPetSprite(pet), moodMotionClasses(pet, {mood, asleep, feudDirection})
                          (feudDirection is 'left'|'right'|null — the caller, ui/render.js in Task 11,
                          computes which side a feuding neighbor is on; sprite.js has no slot/neighbor
                          knowledge of its own)
art/studio.js:            initStudio({ onSave }) -> { open(unlockedBond), close(),
                          rebuildPalette(unlockedBond), rebuildStamps(unlockedBond), isOpen() }
                          BASE_COLORS, UNLOCK_COLORS, unlockedColors(state)

engine/tick.js:           MOOD_WORD, hasTrait(pet,key), isNight(date), isAsleep(pet,date),
                          neighborSlots(index,slotCount), neighborProps(state,index), neighborPets(state,index),
                          decayRate(pet,need,state), tick(state,now), moodOf(pet), worstNeed(pet)
engine/care.js:           CARE_GAIN, careFor(state,pet,need,now), doRounds(state,now)
engine/unlocks.js:        totalBond(state), unlockedStampKinds(state), checkUnlocks(state)
engine/achievements.js:   ACHIEVEMENTS, checkAchievements(state), GRUDGE_STAGE_AT,
                          grudgeStageFor(grudges), checkGrudgeEscalation(state,pet),
                          activeFeuds(state), feudingIds(state), feudPairKey(a,b),
                          stepFeudArc(state,pairKey,a,b), checkinStreak(state,now)
engine/loop.js:           checkShelf(state,now), autonomy(state), petLine(state,pet)

audio/sound.js:            playFeed(), playFuss(), playClean(), playNoteArrive(), playFeud(),
                          playUnlock(), playAchievement(), playError(),
                          isMuted(), setMuted(v), toggleMuted(), initSoundNoteHook()
audio/narrator.js:        initNarrator(), pickBestVoice(), availableVoices(), onVoicesReady(cb),
                          speak(text), isNarratorOn(), setNarratorOn(v), toggleNarrator(),
                          setNarratorVoice(voiceURI)

ui/render.js:              renderAll(state), renderStatus(state), renderShelf(state), renderNotes(state)
ui/toast.js:                toast(msg)
ui/card.js:                 openCard(state,id,keepScroll), openPropCard(state,id), closeCard(), getOpenPetId()
ui/decorUI.js:              buildDecor(state), applyDecor(state), initDecorUI(state)
ui/drag.js:                  initDrag(state)
```

---

### Task 1: Project scaffold + state.js

**Files:**
- Create: `.gitignore`
- Create: `src/state.js`
- Test: `test/state.test.mjs`

**Interfaces:**
- Produces: everything under `state.js:` in the Global contracts section above. This is the foundation every other task imports from.

- [ ] **Step 1: Create the directory scaffold and .gitignore**

```bash
cd ~/shelf-life
mkdir -p src/content src/engine src/art src/audio src/ui icons test
cat > .gitignore << 'EOF'
.DS_Store
*.log
EOF
```

- [ ] **Step 2: Write `src/state.js`**

```js
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

// Upgrades a pre-v4 pet (flattened single image, no art.stamps) to the v4 shape.
// Idempotent: a pet that already has `art.stamps` is returned unchanged.
export function migratePet(rawPet) {
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
```

- [ ] **Step 3: Write `test/state.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migratePet, normalizeState, blankState, clamp, defaultNeeds, SLOT_COUNT, petById, addNote, onNote } from '../src/state.js';

test('clamp bounds a value', () => {
  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(50, 0, 100), 50);
});

test('blankState has the v4 shape', () => {
  const s = blankState();
  assert.equal(s.v, 4);
  assert.equal(s.slots.length, SLOT_COUNT);
  assert.deepEqual(s.pets, []);
  assert.deepEqual(s.achievements, []);
  assert.deepEqual(s.feudArcs, {});
  assert.equal(s.streak.count, 0);
  assert.equal(s.settings.narratorOn, true);
  assert.equal(s.settings.matureMode, false);
});

test('migratePet upgrades a v3 flattened-image pet', () => {
  const old = { id: 'p1', name: 'Gnash', img: 'data:image/png;base64,AAA', traits: ['spiteful'], needs: defaultNeeds(), bond: 3, cared: 2, grudges: 1 };
  const migrated = migratePet(old);
  assert.equal(migrated.art.body, 'data:image/png;base64,AAA');
  assert.deepEqual(migrated.art.stamps, []);
  assert.equal(migrated.img, undefined);
  assert.equal(migrated.grudgeStage, 0);
});

test('migratePet is idempotent on a v4 pet', () => {
  const v4 = { id: 'p2', name: 'Doreen', art: { body: 'x', stamps: [{ kind: 'eyes', x: 10, y: 10, size: 20, rotation: 0, color: '#fff' }] } };
  assert.equal(migratePet(v4), v4);
});

test('normalizeState rejects non-save shapes and fills in every default field on a valid one', () => {
  assert.equal(normalizeState(null), null);
  assert.equal(normalizeState({}), null);
  assert.equal(normalizeState({ pets: 'not-an-array' }), null);
  const n = normalizeState({ pets: [{ id: 'p1', name: 'X', img: 'data:x' }] });
  assert.equal(n.v, 4);
  assert.equal(n.slots.length, SLOT_COUNT);
  assert.equal(n.slots[0], 'p1');
  assert.deepEqual(n.achievements, []);
  assert.equal(n.pets[0].art.body, 'data:x');
});

test('petById finds by id in a given state, not a global', () => {
  const s = blankState();
  s.pets.push({ id: 'p9', name: 'Test' });
  assert.equal(petById(s, 'p9').name, 'Test');
  assert.equal(petById(blankState(), 'p9'), null);
});

test('addNote pushes to the front, caps at 40, and notifies listeners', () => {
  const s = blankState();
  let heard = null;
  onNote(n => { heard = n; });
  addNote(s, 'hello', 'someone', 'note');
  assert.equal(s.notes[0].text, 'hello');
  assert.equal(heard.text, 'hello');
  for (let i = 0; i < 45; i++) addNote(s, 'n' + i, 'x');
  assert.equal(s.notes.length, 40);
});
```

- [ ] **Step 4: Run the tests**

Run: `cd ~/shelf-life && node --test test/state.test.mjs`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/shelf-life
git add .gitignore src/state.js test/state.test.mjs
git commit -m "Add project scaffold and state.js (save/load/migration)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 2: index.html + css/style.css

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Consumes: nothing (structural only). References `src/main.js` via a module script tag — that file doesn't exist until Task 14, so this task's own verification is structural, not a live page load (full page load is verified in Task 16 once every module exists).
- Produces: every DOM id later tasks query by `getElementById`, and the CSS classes `art/sprite.js` (Task 6) and `art/studio.js` (Task 7) apply for animation.

Required DOM ids (later tasks depend on these exact ids — do not rename): `wall`, `newPetBtn`, `roundsBtn`, `checkBtn`, `decorBtn`, `exportBtn`, `importBtn`, `importFile`, `muteBtn`, `narratorBtn`, `matureBtn`, `incidentsBtn`, `storageWarn`, `statusBar`, `cabinet`, `clearNotes`, `notes`, `studioVeil`, `pad`, `swatches`, `sizes`, `eraserChip`, `stamps`, `undoBtn`, `clearBtn`, `petName`, `studioClose`, `cancelPet`, `savePet`, `decorVeil`, `roomOpts`, `wallOpts`, `woodOpts`, `accentOpts`, `propTray`, `decorClose`, `cardVeil`, `cardSheet`, `incidentsVeil`, `incidentsSheet`, `toast`.

Required animation CSS classes later tasks apply via `classList` (Task 6/7 produce these class names; this task must define their `@keyframes` and base rules): `.sprite`, `.sprite-body`, `.sprite-stamp`, `.motion-bob`, `.motion-furious`, `.motion-asleep`, `.motion-lean-left`, `.motion-lean-right`, `.motion-jitter`, `.anim-blink`, `.anim-blink-slow`, `.anim-sway`, `.anim-sway-slow`, `.anim-undulate`, `.anim-twitch`, `.anim-halo`, `.anim-bob`.

- [ ] **Step 1: Write `index.html`**

Port the original masthead/status/cabinet/notes/footer/studioVeil/decorVeil/cardVeil/toast markup from `~/Documents/shelf-life.html` (lines 194-289) verbatim, with these additions: PWA `<link rel="manifest">` + `<meta name="theme-color">` + `<link rel="apple-touch-icon">` in `<head>`; two new toolbar buttons (`muteBtn`, `narratorBtn`) and an `incidentsBtn` button in the toolbar; a streak badge in the status bar area; a new `incidentsVeil`; and a `<script type="module" src="src/main.js">` before `</body>`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#33203D">
<title>Shelf Life</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="icon" href="icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Karla:ital,wght@0,400;0,600;0,700;1,400&family=Caveat:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<div id="wall"></div>

<header class="masthead">
  <div class="wordmark">
    <h1>Shelf<span class="tail">&nbsp;Life</span></h1>
    <p class="tagline">Small creatures with needs, opinions, and long memories. They cannot die. They have looked into it.</p>
  </div>
  <div class="toolbar">
    <button class="btn btn-primary" id="newPetBtn">Make a pet</button>
    <button class="btn" id="roundsBtn">Do the rounds</button>
    <button class="btn" id="checkBtn">Check the shelf</button>
    <button class="btn" id="decorBtn">Decorate</button>
    <button class="btn btn-ghost btn-sm" id="incidentsBtn">Incidents</button>
    <button class="btn btn-ghost btn-sm" id="muteBtn" aria-pressed="false">🔊 Sound</button>
    <button class="btn btn-ghost btn-sm" id="narratorBtn" aria-pressed="true">🗣️ Narrator</button>
    <button class="btn btn-ghost btn-sm" id="matureBtn" aria-pressed="false" title="Adds swearing and cruder jokes to notes. Off by default.">🔞 Mature: Off</button>
    <button class="btn btn-ghost btn-sm" id="exportBtn">Back up</button>
    <button class="btn btn-ghost btn-sm" id="importBtn">Restore</button>
    <input type="file" id="importFile" accept="application/json" hidden>
  </div>
</header>

<div class="storage-warn" id="storageWarn" hidden>
  Saving is off in this preview window. Download the file or open the hosted link and your shelf will stick around.
</div>

<div class="status" id="statusBar"></div>
<main class="cabinet" id="cabinet"></main>

<div class="notes-head">
  <h2>What they left you</h2>
  <button class="btn btn-ghost btn-sm" id="clearNotes">Clear notes</button>
</div>
<section class="notes" id="notes"></section>

<footer>They get hungry, bored and filthy in real time, whether the game is open or not. Drag a pet to move it. Tap a pet to take care of it. Who they stand next to matters.</footer>

<div class="veil" id="studioVeil">
  <div class="sheet">
    <div class="sheet-head">
      <div>
        <h2>Make a pet</h2>
        <div class="card-meta">Draw it, stamp it, name it. It takes over from there.</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="studioClose">Close</button>
    </div>
    <div class="pad-wrap"><canvas id="pad"></canvas><div id="stampLayer" class="stamp-preview-layer"></div></div>
    <div class="tool-block">
      <div class="tool-label">Color</div>
      <div class="swatches" id="swatches"></div>
    </div>
    <div class="tool-block">
      <div class="tool-label">Brush</div>
      <div class="chiprow" id="sizes">
        <button class="chip" data-size="6">Thin</button>
        <button class="chip" data-size="16" aria-pressed="true">Medium</button>
        <button class="chip" data-size="34">Fat</button>
        <button class="chip" id="eraserChip" data-erase="1">Eraser</button>
      </div>
    </div>
    <div class="tool-block">
      <div class="tool-label">Stamps: pick one, then tap the canvas</div>
      <div class="chiprow" id="stamps"></div>
    </div>
    <div class="tool-block">
      <div class="chiprow">
        <button class="chip" id="undoBtn">Undo</button>
        <button class="chip" id="clearBtn">Start over</button>
      </div>
    </div>
    <div class="tool-block">
      <div class="tool-label">Name</div>
      <input type="text" id="petName" maxlength="22" placeholder="Bartholomew, Gnash, Miss Teeth...">
      <div class="hint">Leave it blank and one gets picked for you. You may regret that.</div>
    </div>
    <div class="studio-actions">
      <button class="btn btn-ghost" id="cancelPet">Cancel</button>
      <button class="btn btn-primary" id="savePet">Move it in</button>
    </div>
  </div>
</div>

<div class="veil" id="decorVeil">
  <div class="sheet">
    <div class="sheet-head">
      <div><h2>Decorate</h2><div class="card-meta">The room, the shelf, and the things that live on it.</div></div>
      <button class="btn btn-ghost btn-sm" id="decorClose">Close</button>
    </div>
    <div class="decor-section"><h3>Room</h3><div class="opt-row" id="roomOpts"></div></div>
    <div class="decor-section"><h3>Wall</h3><div class="opt-row" id="wallOpts"></div></div>
    <div class="decor-section"><h3>Shelf</h3><div class="opt-row" id="woodOpts"></div></div>
    <div class="decor-section"><h3>Trim</h3><div class="opt-row" id="accentOpts"></div></div>
    <div class="decor-section"><h3>Things for the shelf</h3><div class="prop-tray" id="propTray"></div></div>
  </div>
</div>

<div class="veil" id="cardVeil"><div class="sheet" id="cardSheet"></div></div>
<div class="veil" id="incidentsVeil"><div class="sheet" id="incidentsSheet"></div></div>
<div id="toast" role="status" aria-live="polite"></div>

<script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `css/style.css`**

Full stylesheet: the original stylesheet ported verbatim (custom properties, wall patterns, masthead/toolbar/status/cabinet/slot/pet/prop/ghost/notes/veil/studio/card/decor/toast/responsive rules) plus the additions for the new toolbar buttons, streak badge, layered-sprite animation system, and a card-portrait sprite-size override (pets render larger in the detail card's 118px portrait box than on the 78px-capped shelf).

```css
:root{
  --ink:#1A1220; --ink-2:#2A1E33; --wood:#5C3A47; --wood-lip:#7A4C5B;
  --bone:#F2E9DC; --bone-dim:#C9BCAE; --pink:#FF8FB8; --mint:#7FD8C0;
  --amber:#F2B441; --blood:#A32C3C; --paper:#EDE3D2; --shadow:rgba(0,0,0,.45);
  --room-a:#33203D; --room-b:#1A1220; --panel-a:#2C1D35; --panel-b:#241830;
  --line:var(--line); --rule:var(--rule); --surface:var(--surface); --surface-hi:var(--surface-hi);
  --field:var(--field); --wall-ink:rgba(242,233,220,.16);
  --display:'Gloock',Georgia,serif; --body:'Karla',system-ui,-apple-system,sans-serif;
  --hand:'Caveat','Bradley Hand',cursive;
}
*{box-sizing:border-box}
#wall{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.9}
body.wall-stripes #wall{background-image:repeating-linear-gradient(90deg,var(--wall-ink) 0 2px,transparent 2px 28px)}
body.wall-dots #wall{background-image:radial-gradient(var(--wall-ink) 1.6px,transparent 1.7px);background-size:24px 24px}
body.wall-grid #wall{background-image:repeating-linear-gradient(0deg,var(--wall-ink) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,var(--wall-ink) 0 1px,transparent 1px 34px)}
body.wall-web #wall{background-image:repeating-radial-gradient(circle at 0 0,transparent 0 30px,var(--wall-ink) 30px 31px),repeating-radial-gradient(circle at 100% 0,transparent 0 30px,var(--wall-ink) 30px 31px)}
body.wall-diamond #wall{background-image:repeating-linear-gradient(45deg,var(--wall-ink) 0 1px,transparent 1px 26px),repeating-linear-gradient(-45deg,var(--wall-ink) 0 1px,transparent 1px 26px)}
html,body{margin:0;padding:0}
body{
  background:radial-gradient(130% 85% at 50% -12%,var(--room-a) 0%,transparent 62%),var(--room-b);
  color:var(--bone);font-family:var(--body);font-size:16px;line-height:1.5;
  min-height:100vh;padding:20px 16px 72px;-webkit-tap-highlight-color:transparent;
}
:focus-visible{outline:3px solid var(--mint);outline-offset:2px;border-radius:3px}

.masthead{max-width:920px;margin:0 auto 14px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
h1{font-family:var(--display);font-size:clamp(38px,10vw,62px);line-height:.92;margin:0;letter-spacing:-.01em}
h1 .tail{color:var(--pink)}
.tagline{font-size:14px;color:var(--bone-dim);font-style:italic;max-width:36ch}
.toolbar{display:flex;gap:8px;flex-wrap:wrap}

button{font-family:var(--body);font-size:15px;cursor:pointer;border:none;background:none;color:inherit}
.btn{padding:10px 16px;border-radius:2px;font-weight:600;background:var(--ink-2);color:var(--bone);border:1px solid var(--line);transition:background .12s ease,transform .08s ease}
.btn:hover{background:var(--surface-hi)}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--pink);color:#2A0E1C;border-color:var(--pink);font-weight:700}
.btn-primary:hover{background:#ffa6c6}
.btn-ghost{border:1px solid var(--line);background:transparent;color:var(--bone-dim)}
.btn-ghost:hover{color:var(--bone);background:var(--surface)}
.btn-danger{background:transparent;color:var(--blood);border:1px solid var(--blood)}
.btn-danger:hover{background:var(--blood);color:var(--bone)}
.btn-sm{padding:7px 11px;font-size:13px}
.btn[disabled]{opacity:.4;cursor:not-allowed}

.status{max-width:920px;margin:0 auto 14px;display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--bone-dim);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:9px 2px}
.status b{color:var(--bone);font-weight:700}
.status .bad{color:var(--blood)}
.status .mid{color:var(--amber)}
.status .good{color:var(--mint)}

.cabinet{max-width:920px;margin:0 auto;background:linear-gradient(180deg,var(--panel-a),var(--panel-b));border:1px solid var(--line);padding:8px 14px 20px}
.shelf-row{position:relative;margin-bottom:6px}
.slots{display:grid;grid-template-columns:repeat(6,1fr);align-items:end;gap:4px;min-height:126px;padding:0 6px}
.plank{height:12px;background:linear-gradient(180deg,var(--wood-lip) 0 4px,var(--wood) 4px 100%);box-shadow:0 6px 14px var(--shadow);margin-bottom:20px}
.slot{position:relative;display:flex;align-items:flex-end;justify-content:center;height:120px;border-radius:2px}
.slot.drop-target{background:rgba(127,216,192,.14);outline:1px dashed var(--mint)}
.pet{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;background:none;touch-action:none;cursor:grab;padding:0}
.pet img{width:100%;max-height:78px;object-fit:contain;filter:drop-shadow(0 4px 5px rgba(0,0,0,.5));pointer-events:none;transition:transform .2s ease}
.pet.asleep img{opacity:.45;filter:grayscale(.5) drop-shadow(0 4px 5px rgba(0,0,0,.5))}
.pet.furious img{transform:rotate(-4deg)}
.pet .nameplate{font-size:10px;color:var(--bone-dim);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pet.furious .nameplate{color:var(--blood);font-weight:700}
.pet.feuding .nameplate{color:var(--blood)}
.pet.dragging,.prop.dragging{opacity:.25}
.pips{display:flex;gap:3px;height:7px;align-items:center}
.pip{width:6px;height:6px;border-radius:50%}
.pip.food{background:var(--amber)}
.pip.fuss{background:var(--pink)}
.pip.clean{background:var(--mint)}
.pip.zzz{width:auto;height:auto;font-size:9px;color:#7A6A8A;border-radius:0}
.ghost svg{width:88px;height:88px;display:block}
.ghost{position:fixed;z-index:80;pointer-events:none;width:90px;transform:translate(-50%,-60%) rotate(-4deg);filter:drop-shadow(0 8px 10px rgba(0,0,0,.6))}
.empty-shelf{grid-column:1/-1;text-align:center;color:#6C5A7A;font-family:var(--hand);font-size:22px;align-self:center;padding:30px 0}

.notes-head{max-width:920px;margin:34px auto 12px;display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.notes-head h2{font-family:var(--display);font-size:26px;margin:0;font-weight:400}
.notes{max-width:920px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.note{background:var(--paper);color:#2B2028;padding:12px 14px 14px;font-family:var(--hand);font-size:20px;line-height:1.25;box-shadow:0 3px 0 rgba(0,0,0,.35)}
.note:nth-child(3n){transform:rotate(-.7deg)}
.note:nth-child(3n+2){transform:rotate(.6deg)}
.note .from{display:block;font-family:var(--body);font-size:11px;color:#7A6A72;margin-top:8px;font-style:italic}
.note.feud{background:#E8CFCE;border-left:4px solid var(--blood)}
.note.arrival{background:#D9E9DF;border-left:4px solid var(--mint)}
.note.angry{background:#E4C9C4;border-left:4px solid #6E1B26}
.notes-empty{color:#6C5A7A;font-family:var(--hand);font-size:20px}

.veil{position:fixed;inset:0;background:rgba(12,7,16,.82);display:none;z-index:60;overflow-y:auto;padding:18px 14px 40px}
.veil.open{display:block}
.sheet{max-width:560px;margin:0 auto;background:linear-gradient(180deg,var(--panel-a),var(--panel-b));border:1px solid var(--line);padding:18px}
.sheet h2{font-family:var(--display);font-weight:400;font-size:28px;margin:0 0 4px}
.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}

.pad-wrap{position:relative;width:100%;max-width:340px;margin:0 auto 14px;aspect-ratio:1;background-color:#F6F1E7;
  background-image:linear-gradient(45deg,#E7DFD2 25%,transparent 25%,transparent 75%,#E7DFD2 75%),linear-gradient(45deg,#E7DFD2 25%,transparent 25%,transparent 75%,#E7DFD2 75%);
  background-size:22px 22px;background-position:0 0,11px 11px;border:1px solid var(--line)}
#pad{width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
.tool-block{margin-bottom:12px}
.tool-label{font-size:12px;color:var(--bone-dim);margin-bottom:6px}
.swatches{display:flex;flex-wrap:wrap;gap:6px}
.sw{width:30px;height:30px;border:2px solid transparent;border-radius:2px;padding:0}
.sw[aria-pressed="true"]{border-color:var(--bone);transform:scale(1.06)}
.chiprow{display:flex;flex-wrap:wrap;gap:6px}
.chip{padding:7px 10px;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--bone-dim);border-radius:2px}
.chip[aria-pressed="true"]{background:var(--mint);color:#10281F;border-color:var(--mint);font-weight:700}
.chip:hover{color:var(--bone)}
.chip[aria-pressed="true"]:hover{color:#10281F}
input[type=text]{width:100%;padding:11px 12px;background:var(--field);border:1px solid var(--line);color:var(--bone);font-family:var(--body);font-size:16px;border-radius:2px}
input[type=text]::placeholder{color:#6C5A7A}
.studio-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}
.hint{font-size:12px;color:#8A7A98;margin-top:6px}

.card-top{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}
.card-portrait{width:118px;height:118px;flex:none;background:radial-gradient(circle at 50% 60%,var(--panel-a),var(--panel-b));border:1px solid var(--line);display:flex;align-items:center;justify-content:center;padding:6px}
.card-portrait img{max-width:100%;max-height:100%;object-fit:contain}
.card-portrait svg{width:86px;height:86px}
.card-meta{font-size:12px;color:var(--bone-dim)}
.mood-tag{display:inline-block;margin-top:6px;font-size:12px;font-weight:700;padding:3px 8px;border:1px solid currentColor}
.mood-content{color:var(--mint)}
.mood-fine{color:var(--bone-dim)}
.mood-annoyed{color:var(--amber)}
.mood-furious{color:var(--blood)}
.needs{margin:0 0 4px}
.need{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:8px;margin-bottom:7px;font-size:13px}
.bar{height:9px;background:var(--field);border:1px solid var(--line)}
.bar span{display:block;height:100%;transition:width .25s ease}
.need.food .bar span{background:var(--amber)}
.need.fuss .bar span{background:var(--pink)}
.need.clean .bar span{background:var(--mint)}
.need.low .bar span{background:var(--blood)}
.care-row{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 6px}
.care-row .btn{flex:1 1 30%;min-width:110px;text-align:center}
.bondline{font-size:12px;color:var(--bone-dim);margin-bottom:10px}
.bond-bar{height:5px;background:var(--field);border:1px solid var(--line);margin-top:4px}
.bond-bar span{display:block;height:100%;background:var(--amber)}
.bio{font-family:var(--hand);font-size:21px;line-height:1.3;color:var(--paper);margin:14px 0 8px}
.stat{display:grid;grid-template-columns:74px 1fr 26px;align-items:center;gap:8px;margin-bottom:5px;font-size:13px}
.stat .bar span{background:var(--pink)}
.stat.menace .bar span{background:var(--blood)}
.stat.damp .bar span{background:var(--mint)}
.stat.mystique .bar span{background:var(--amber)}
.stat .num{text-align:right;color:var(--bone-dim)}
.traits{list-style:none;padding:0;margin:14px 0 0}
.traits li{border-top:1px solid var(--rule);padding:9px 0}
.traits strong{font-size:15px;color:var(--amber);font-weight:700}
.traits em{display:block;font-style:normal;font-size:13px;color:var(--bone-dim)}
.card-actions{display:flex;justify-content:space-between;gap:8px;margin-top:18px;flex-wrap:wrap}
.section-rule{border-top:1px solid var(--rule);margin:16px 0 12px}

.prop{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;background:none;touch-action:none;cursor:grab;padding:0}
.prop svg{width:64px;height:64px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.45));pointer-events:none}
.prop .nameplate{font-size:10px;color:var(--bone-dim);opacity:.75}
.prop.busy svg{transform:rotate(-3deg)}

.decor-section{margin-bottom:18px}
.decor-section h3{font-family:var(--body);font-size:13px;font-weight:700;letter-spacing:.02em;margin:0 0 8px;color:var(--bone-dim)}
.opt-row{display:flex;flex-wrap:wrap;gap:7px}
.opt{padding:8px 11px;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--bone-dim);border-radius:2px;display:flex;align-items:center;gap:7px}
.opt[aria-pressed="true"]{border-color:var(--bone);color:var(--bone);font-weight:700}
.opt .dot{width:14px;height:14px;border-radius:2px;border:1px solid rgba(0,0,0,.3);display:inline-block}
.prop-tray{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}
.prop-card{border:1px solid var(--line);background:var(--surface);padding:9px 7px;text-align:center;border-radius:2px;display:flex;flex-direction:column;align-items:center;gap:4px}
.prop-card svg{width:44px;height:44px}
.prop-card b{font-size:12px;font-weight:700;color:var(--bone)}
.prop-card small{font-size:11px;color:var(--bone-dim);line-height:1.25}
.prop-card.locked{opacity:.45;cursor:not-allowed}
.prop-card.locked small{color:var(--amber)}
#toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(20px);
  background:var(--paper);color:#2B2028;padding:11px 16px;font-family:var(--hand);font-size:20px;
  box-shadow:0 4px 0 rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;z-index:90;max-width:88vw;text-align:center}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

.storage-warn{max-width:920px;margin:0 auto 16px;padding:9px 12px;border:1px solid var(--amber);color:var(--amber);font-size:13px}
footer{max-width:920px;margin:36px auto 0;font-size:12px;color:#6C5A7A}

@media (max-width:640px){
  .slots{grid-template-columns:repeat(3,1fr)}
  .sheet{padding:14px}
  .card-portrait{width:88px;height:88px}
  .card-top{gap:10px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}

.streak-badge{font-size:12px;color:var(--amber)}
#incidentsSheet .incident{border-top:1px solid var(--rule);padding:10px 0}
#incidentsSheet .incident b{color:var(--amber);font-size:14px}
#incidentsSheet .incident p{margin:4px 0 0;font-size:13px;color:var(--bone-dim)}
#incidentsSheet .incident-empty{font-family:var(--hand);font-size:20px;color:#6C5A7A}

.stamp-preview-layer{position:absolute;inset:0;pointer-events:none}
.stamp-preview-layer .sprite-stamp{position:absolute}

.sprite{position:relative;width:100%;max-height:78px;display:flex;align-items:flex-end;justify-content:center;transform-origin:50% 100%}
.sprite-body{width:100%;max-height:78px;object-fit:contain;filter:drop-shadow(0 4px 5px rgba(0,0,0,.5));pointer-events:none;position:relative}
.sprite-stamp{position:absolute;pointer-events:none;transform-origin:center center}
.sprite-stamp svg{width:100%;height:100%;display:block}

@keyframes sl-bob{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-3px) scaleY(1.025)}}
@keyframes sl-shake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-2px) rotate(-1.5deg)}75%{transform:translateX(2px) rotate(1.5deg)}}
@keyframes sl-jitter{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}
@keyframes sl-lean-left{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}
@keyframes sl-lean-right{0%,100%{transform:rotate(0)}50%{transform:rotate(5deg)}}
@keyframes sl-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes sl-blink-slow{0%,96%,100%{transform:scaleY(1)}98%{transform:scaleY(.08)}}
@keyframes sl-sway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes sl-sway-slow{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
@keyframes sl-undulate{0%,100%{transform:translateX(0) rotate(0)}33%{transform:translateX(1.5px) rotate(4deg)}66%{transform:translateX(-1.5px) rotate(-4deg)}}
@keyframes sl-twitch{0%,88%,100%{transform:rotate(0)}90%{transform:rotate(-7deg)}92%{transform:rotate(5deg)}94%{transform:rotate(0)}}
@keyframes sl-halo{0%{transform:rotate(0) translateY(0)}50%{transform:rotate(180deg) translateY(-2px)}100%{transform:rotate(360deg) translateY(0)}}

.motion-bob{animation:sl-bob 3.4s ease-in-out infinite}
.motion-furious{animation:sl-shake .5s ease-in-out infinite}
.motion-jitter{animation:sl-jitter 1.1s ease-in-out infinite}
.motion-asleep{animation:sl-bob 7s ease-in-out infinite}
.motion-lean-left{animation:sl-lean-left 4.5s ease-in-out infinite}
.motion-lean-right{animation:sl-lean-right 4.5s ease-in-out infinite}

.anim-blink{animation:sl-blink 4.2s ease-in-out infinite}
.anim-blink-slow{animation:sl-blink-slow 6.5s ease-in-out infinite}
.anim-sway{animation:sl-sway 3.1s ease-in-out infinite}
.anim-sway-slow{animation:sl-sway-slow 5.2s ease-in-out infinite}
.anim-undulate{animation:sl-undulate 2.6s ease-in-out infinite}
.anim-twitch{animation:sl-twitch 3.8s ease-in-out infinite}
.anim-halo{animation:sl-halo 6s linear infinite}
.anim-bob{animation:sl-bob 2.8s ease-in-out infinite}

@media (prefers-reduced-motion:reduce){
  .sprite,.sprite-body,.sprite-stamp,.motion-bob,.motion-furious,.motion-jitter,.motion-asleep,
  .motion-lean-left,.motion-lean-right,.anim-blink,.anim-blink-slow,.anim-sway,.anim-sway-slow,
  .anim-undulate,.anim-twitch,.anim-halo,.anim-bob{animation:none!important}
}

.card-portrait .sprite,.card-portrait .sprite-body{max-height:104px}
```

- [ ] **Step 3: Structural sanity check (no live page load yet — `src/main.js` doesn't exist until Task 14)**

```bash
cd ~/shelf-life
for id in wall newPetBtn roundsBtn checkBtn decorBtn incidentsBtn muteBtn narratorBtn matureBtn exportBtn importBtn \
  storageWarn statusBar cabinet clearNotes notes studioVeil pad swatches sizes eraserChip stamps undoBtn \
  clearBtn petName studioClose cancelPet savePet decorVeil roomOpts wallOpts woodOpts accentOpts propTray \
  decorClose cardVeil cardSheet incidentsVeil incidentsSheet toast; do
  grep -q "id=\"$id\"" index.html || echo "MISSING id: $id"
done
grep -c '@keyframes' css/style.css
```
Expected: no "MISSING id" lines printed; keyframes count >= 13.

- [ ] **Step 4: Commit**

```bash
cd ~/shelf-life
git add index.html css/style.css
git commit -m "Add index.html and stylesheet, incl. layered-sprite animation CSS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 3: content/traits.js + content/feuds.js

**Files:**
- Create: `src/content/traits.js`
- Create: `src/content/feuds.js`
- Test: `test/content.test.mjs` (covers both files; Task 4 appends more tests to this same file)

**Interfaces:**
- Produces: `TRAITS`, `TRAIT_BY_ID` (traits.js); `FEUDS`, `FEUD_LINES`, `ESCALATION_LINES`, `TRUCE_LINES` (feuds.js). `engine/achievements.js` (Task 9) matches trait pairs against `FEUDS`; `engine/loop.js` (Task 9) picks from `FEUD_LINES`/`ESCALATION_LINES`/`TRUCE_LINES`; every other engine/ui file that shows a trait imports `TRAIT_BY_ID`.
- This is pure data — no imports needed in either file.

Voice for every note/social line: deadpan, passive-aggressive, dark-comic, spooky-cute. Never graphic, never a real threat, never mocking a real protected group or real mental-health diagnosis — comedic archetypes only (office satire, internet-culture satire, classic monster tropes, petty domestic grievance). This pool stays free of profanity — a separate opt-in mature-language overlay is added in Task 4 (`content/mature.js`) and mixed in by `engine/loop.js`, not baked in here.

- [ ] **Step 1: Write `src/content/traits.js`**

22 traits ported verbatim from `~/Documents/shelf-life.html` lines 308-392 (`spiteful`, `damp`, `management`, `loadbearing`, `haunted`, `theatrical`, `nocturnal`, `magpie`, `unblinking`, `sugar`, `complaints`, `terminal`, `clean`, `feral`, `cult`, `doom`, `clingy`, `taxidermy`, `amnesiac`, `gossip`, `ancient`, `glitter`) plus 24 new traits, for 46 total:

```js
export const TRAITS = [
  { id:'spiteful', name:'Spiteful', blurb:'Keeps a list. You are on it.',
    stats:{menace:3,cute:-1}, care:{fuss:1.3},
    notes:['Moved your things. Will not say which ones.','Has been counting. You are at nine.','Is not angry. It is simply keeping records.','Wrote your name down and underlined it.'],
    social:['{n} has been struck from the list.','Told {n} exactly what it thinks. Twice.','Has started a second list, just for {n}.'] },
  { id:'damp', name:'Perpetually Damp', blurb:'Nobody knows why. Nobody asks anymore.',
    stats:{damp:5,cute:-1}, care:{clean:2.2},
    notes:['Left another ring on the shelf.','Insists this is ambient moisture.','Something underneath it has started to smell hopeful.','You wrung it out. It refilled.'],
    social:['{n} is now also damp.','Sat beside {n} for an hour. On purpose.','Says {n} was dry and smug about it.'] },
  { id:'management', name:'Former Management', blurb:'Had a corner office. Will not elaborate.',
    stats:{mystique:2,cute:-1}, care:{fuss:1.2},
    notes:['Scheduled a meeting. You were not invited.','Referred to the shelf as "the floor".','Has restructured something. Unclear what.','Says it is not micromanaging, it is present.'],
    social:['Put {n} on a performance plan.','Called {n} "a resource".','Took credit for something {n} did.'] },
  { id:'loadbearing', name:'Load Bearing', blurb:'Believes the shelf collapses without it.',
    stats:{menace:2,mystique:1}, care:{},
    notes:['Stood very still today. Called it "holding things up."','Refused to move. Cited structural concerns. There are none.','Has appointed itself essential personnel.','Took a break from load-bearing. The shelf was fine. It was not pleased about that.'],
    social:['Told {n} to stand somewhere less load-bearing.','Credits itself for {n} not falling off the shelf.','Let {n} take a turn holding things up. Supervised closely.'] },
  { id:'haunted', name:'Haunted', blurb:'Came with a previous owner attached.',
    stats:{mystique:5,cute:-1}, care:{fuss:1.3},
    notes:['Someone else answered when you called its name.','Cold spot again. Right where it usually sits.','Says the previous owner "has notes" about your parenting.','Flickered. Apologized. Would not say for what.'],
    social:['The previous owner does not care for {n}.','{n} felt watched. Correctly.','Introduced {n} to someone who is not there.'] },
  { id:'theatrical', name:'Theatrical', blurb:'Every Tuesday is a farewell tour.',
    stats:{mystique:2,menace:1}, care:{fuss:1.4},
    notes:['Announced its own demise. Recovered for dinner.','Performed a monologue about the injustice of Tuesdays.','Took a bow. Nobody was watching. Took another.','Is "workshopping some material" about you.'],
    social:['Made {n} its scene partner without asking.','Upstaged {n} during a nap.','Dedicated a performance to {n}. {n} did not want that.'] },
  { id:'nocturnal', name:'Nocturnal', blurb:'Awake at 3am. So are you now.',
    stats:{mystique:3}, care:{fuss:1.5}, nocturnal:true,
    notes:['Was very busy at 3am. Doing what is unclear.','Slept through the entire day out of spite.','Has opinions it saves specifically for 3am.','Woke you up to make sure you were still asleep.'],
    social:['Woke {n} up. Denies it. There is evidence.','Had a whole conversation with {n} at 3am. {n} does not remember.','Let {n} sleep, for once. Historic.'] },
  { id:'magpie', name:'Magpie', blurb:'Collects things. Some of them were yours.',
    stats:{mystique:2,menace:1}, care:{}, thief:true,
    notes:['Has a stash. Will not disclose contents.','Something shiny went missing. You have a guess.','Reorganized the stash by "importance."','Traded something to another pet. Terms unclear.'],
    social:['Took something from {n}. {n} noticed. {n} said nothing.','Traded {n} a shiny rock for something actually valuable.','Showed {n} the stash. Regretted it immediately.'] },
  { id:'unblinking', name:'Unblinking', blurb:'Has not blinked since the day it arrived.',
    stats:{mystique:4,cute:-2}, care:{},
    notes:['Still has not blinked. It is being counted.','Watched you eat. The whole time. All of it.','Stared at the door for six hours. Nothing came.','Blinked once, finally. It was worse.'],
    social:['Watched {n} sleep. All night. {n} does not know.','Stared {n} down over nothing. Won.','Has not looked away from {n} since Tuesday.'] },
  { id:'sugar', name:'Sugar Fiend', blurb:'Would trade you for a marshmallow.',
    stats:{cute:3,menace:1}, care:{food:0.7},
    notes:['Found sugar. Somewhere. Will not say where.','Vibrating slightly. Refuses to explain why.','Has hidden a stash of something sweet. And sticky.','Crashed hard at 2pm. Blames you specifically.'],
    social:['Offered {n} a bite. It was mostly gone already.','Bribed {n} with something sticky. It worked.','Got {n} hooked on something it should not share.'] },
  { id:'complaints', name:'Complaint Filer', blurb:'There is paperwork. There is a copy.',
    stats:{menace:2,mystique:1}, care:{fuss:1.3},
    notes:['Filed a complaint. About the lighting. There is no lighting.','Requested a supervisor. There is no supervisor.','Has opened a case number for this Tuesday specifically.','Submitted a follow-up to a complaint from last week.'],
    social:['Filed a complaint against {n}. Cc\'d nobody.','Escalated a disagreement with {n} to "corporate."','Withdrew a complaint against {n}. Filed a new one instead.'] },
  { id:'terminal', name:'Terminally Dramatic', blurb:'Announces its demise weekly. Recovers by dinner.',
    stats:{mystique:2,menace:1}, care:{fuss:1.4},
    notes:['Announced it was fading. Ate a full dinner immediately after.','Delivered final words. Delivered them again the next day.','Is "not long for this shelf." Has said this six times.','Made a will. The will bequeaths nothing to anyone specific.'],
    social:['Said goodbye to {n} forever. Saw {n} an hour later.','Named {n} in the will. The will has since been revised.','Gave {n} a tearful farewell speech over a minor inconvenience.'] },
  { id:'clean', name:'Suspiciously Clean', blurb:'Nothing sticks to it. Nothing.',
    stats:{damp:-2,cute:2}, care:{clean:0.4},
    notes:['Still spotless. This is being monitored.','Walked through something filthy. Emerged pristine.','Will not explain the method. There may not be one.','Judged the shelf\'s cleanliness. Said nothing. The silence was loud.'],
    social:['Made {n} feel filthy by comparison. On purpose.','Refused to sit near {n} until {n} cleaned up.','Gave {n} tips on staying clean. {n} did not ask.'] },
  { id:'feral', name:'Feral At Heart', blurb:'Domesticated in theory only.',
    stats:{menace:4,cute:1}, care:{clean:1.6},
    notes:['Reverted to instinct over a dropped crumb.','Made a nest out of something that was not nest material.','Growled at the vacuum. The vacuum was off.','Has gone back to basics. The basics are chaos.'],
    social:['Challenged {n} to something. {n} did not accept. It happened anyway.','Taught {n} a feral habit. {n} picked it up fast.','Backed off from {n} for once. Historic. Do not ask why.'] },
  { id:'cult', name:'Cult Adjacent', blurb:'Has a candle, a schedule, and questions.',
    stats:{mystique:5,menace:1}, care:{fuss:1.3}, wanderer:true,
    notes:['Held a small ceremony. Would not disclose the purpose.','Asked you to join something. Declined to say what.','Lit the candle at an unusual hour. On schedule, apparently.','Has recruited zero members and remains extremely optimistic.'],
    social:['Invited {n} to something. {n} should probably say no.','{n} attended the ceremony. {n} will not discuss it.','Has named {n} in the schedule. No further details given.'] },
  { id:'doom', name:'Doomsayer', blurb:'Certain it ends badly. Often correct.',
    stats:{mystique:4,cute:-1}, care:{},
    notes:['Predicted disaster. There was a minor spill. It felt vindicated.','Has been "warning everyone" about something unspecified.','Said this was coming. This was dinner. Dinner was coming.','Updated its prophecy to be vaguer and therefore more accurate.'],
    social:['Warned {n} about something that has not happened.','Was right about {n}, for once, and will not let it go.','Comforted {n} about the coming doom. Badly.'] },
  { id:'clingy', name:'Emotionally Adjacent', blurb:'Always slightly closer than you left it.',
    stats:{cute:2,menace:-1}, care:{fuss:1.6}, wanderer:true,
    notes:['Was exactly where you left it. Somehow closer.','Followed you with its eyes across the entire room.','Left a spot warm from waiting. It had been hours.','Asked, without words, to be picked up. You understood anyway.'],
    social:['Sat closer to {n} than personal space allows.','Got jealous of {n} for no clear reason.','Held a grudge against {n} for leaving the room.'] },
  { id:'taxidermy', name:'Taxidermy Curious', blurb:'Asks unusual questions about the others.',
    stats:{mystique:3,menace:2}, care:{},
    notes:['Measured something with its eyes. Would not say what.','Asked about "preservation techniques." Unprompted.','Has been eyeing a specific corner of the shelf. For projects.','Took notes on posture. Everyone\'s posture. Concerning notes.'],
    social:['Studied {n} a little too closely.','Complimented {n}\'s "form." {n} did not take it as a compliment.','Sketched {n}. Would not show the sketch. Best left that way.'] },
  { id:'amnesiac', name:'Amnesiac', blurb:'Remembers nothing before Tuesday. Tuesday was a lot.',
    stats:{cute:2,mystique:2}, care:{},
    notes:['Asked where it is. Again. Was told. Forgot again.','Introduced itself to the mirror. Politely.','Has no memory of yesterday\'s incident. Everyone else does.','Woke up convinced it was still Tuesday. It was Thursday.'],
    social:['Met {n} for the "first time" again.','Forgot an argument with {n} mid-argument. {n} did not.','Complimented {n} on a name it just relearned.'] },
  { id:'gossip', name:'Gossip', blurb:'Knows. Will tell. Has already told.',
    stats:{mystique:3,menace:1}, care:{fuss:1.2},
    notes:['Knows something. Will not say what. Told someone else already.','Has a source. The source is unreliable. The gossip stands.','Spread a rumor about the lamp. The lamp cannot defend itself.','Confirmed a rumor it started an hour earlier.'],
    social:['Told {n}\'s business to everyone but {n}.','Started a rumor about {n}. It is spreading.','Swore {n} to secrecy, then told two others immediately.'] },
  { id:'ancient', name:'Ancient', blurb:'Claims four hundred years. Cannot produce documents.',
    stats:{mystique:5,cute:-2}, care:{},
    notes:['Referenced an event from "before your kind kept records."','Sighed at modern conveniences. Used one anyway.','Says it has "seen empires fall." Has seen a sock fall.','Corrected your history. Its history is also wrong.'],
    social:['Called {n} "young." {n} is the same age.','Told {n} an old story. The story keeps changing.','Recognized something in {n} from "a past life." Made that up.'] },
  { id:'glitter', name:'Glitter Cursed', blurb:'Sheds glitter. It never fully leaves.',
    stats:{cute:3,damp:1}, care:{clean:1.8},
    notes:['Left a trail. The trail will outlive everyone involved.','Insists this is "sparkle," not a hazard.','Found glitter somewhere new. Nobody knows how.','You will find this glitter in a decade. That is a promise.'],
    social:['{n} is now also glitter.','Hugged {n}. {n} has not recovered.','Says {n} looks better this way. {n} does not.'] },
  { id:'litigious', name:'Litigious', blurb:'Has retained counsel. The counsel is unlicensed.',
    stats:{mystique:2,cute:-1}, care:{fuss:1.3},
    notes:['Has filed a motion. The motion is a sticky note.','Is suing the lamp for emotional damages.','Says this is "going in the deposition." There is no deposition.','Settled out of court with the dust bunny. Terms undisclosed.'],
    social:['{n} has been served. {n} does not know this yet.','Is building a case against {n}. Exhibit A is a crumb.','Dropped the suit against {n}. Refiled it an hour later.'] },
  { id:'narcissist', name:'Main Character', blurb:'Believes the shelf is a season, and this is the finale.',
    stats:{mystique:3,menace:1}, care:{fuss:1.4},
    notes:['Narrated its own snack. Out loud. In third person.','Is convinced the lamp turning on was about it.','Has decided today is "an arc." Nobody asked which kind.','Paused meaningfully by the window for no visible reason.'],
    social:['Has cast {n} as a supporting character. {n} was not consulted.','Told {n} this is "their villain era." {n} agreed, unfortunately.','Upstaged {n} during a nap. This is apparently possible.'] },
  { id:'paranoid', name:'Mildly Paranoid', blurb:'The vacuum cleaner knows things. It is not wrong.',
    stats:{mystique:2,damp:1}, care:{clean:1.4},
    notes:['Has mapped the outlets. Will not say why.','Believes the smoke detector is listening. It is.','Unplugged something "on principle." Ask it nothing further.','Has a theory about the mailman. It is getting worse.'],
    social:['Warned {n} about the microwave. {n} did not listen.','Thinks {n} is compromised. Will not elaborate.','Trusts {n} slightly more after the toaster incident.'] },
  { id:'influencer', name:'Aspiring Influencer', blurb:'Content is content. This nap is content.',
    stats:{cute:2,mystique:1}, care:{fuss:1.5},
    notes:['Posed for eleven minutes. There was no camera.','Referred to eating as "a moment."','Is "just being authentic," extremely deliberately.','Has a ring light. Has never plugged it in. Wants credit anyway.'],
    social:['Tagged {n} in something that does not exist.','Collaborated with {n} on a bit nobody filmed.','Unfollowed {n}, conceptually, mid-argument.'] },
  { id:'landlord', name:'Landlord Energy', blurb:'Owns nothing. Charges rent on all of it.',
    stats:{menace:3,cute:-1}, care:{food:1.3},
    notes:['Has issued a notice. The notice is a Post-it.','Raised the rent on a corner it does not own.','Says maintenance is "not in the budget." There is no budget.','Inspected the premises. The premises is a shelf.'],
    social:['{n} is three days late on rent that does not exist.','Evicted {n} from a spot {n} was already leaving.','Offered {n} a lease. The lease has no terms, only threats.'] },
  { id:'hoarder', name:'Hoarder', blurb:'Everything is important. Nothing is explained.',
    stats:{mystique:2,cute:1}, care:{clean:1.4},
    notes:['The pile has grown. The pile has opinions now.','Would not say what is in the pile. Got defensive about it.','Added something to the pile at 3am. It squeaked.','Refused to downsize. The pile has tenure.'],
    social:['Took something of {n}\'s "for safekeeping."','Showed {n} the pile. {n} regrets asking.','Offered {n} a place in the pile. It was not a compliment.'] },
  { id:'martyr', name:'Martyr Complex', blurb:'Suffers loudly, on a schedule, for an audience of you.',
    stats:{menace:1,mystique:2}, care:{fuss:1.5},
    notes:['Sighed at a volume designed to be heard three rooms away.','Said "it\'s fine" in a tone that means the opposite.','Has decided to "just deal with it," audibly, for twenty minutes.','Is suffering. Beautifully. On purpose. For you specifically.'],
    social:['Suffered near {n} until {n} noticed. {n} noticed.','Told {n} not to worry about it. {n} was not worrying about it.','Forgave {n} out loud for something {n} did not do.'] },
  { id:'revisionist', name:'Revisionist', blurb:'Was never afraid of the vacuum. History has been amended.',
    stats:{mystique:3,menace:1}, care:{},
    notes:['Has revised the record. It was always brave.','Denies the incident. There were witnesses. It denies them too.','Says that never happened. It happened forty minutes ago.','Updated its own origin story. Again. It gets better every time.'],
    social:['Rewrote the argument with {n}. {n} lost it now, apparently.','Claims it warned {n} about everything, in advance, always.','Insists {n} started it. History disagrees. History was overruled.'] },
  { id:'cryptid', name:'Local Cryptid', blurb:'Blurry in every photo. Sharp in every doorway.',
    stats:{mystique:5,cute:-1}, care:{},
    notes:['Was photographed. The photo shows a smudge with opinions.','Was seen at the edge of the yard. There is no yard.','Left a footprint that does not match its feet.','Has a cryptid research group now. It started the group.'],
    social:['Was allegedly seen standing near {n} at 4am. Allegedly.','Denies being near {n} last night. Nobody accused it yet.','Let {n} photograph it once. The photo did not develop.'] },
  { id:'closer', name:'Always Closing', blurb:'Everything is an opportunity. This is the opportunity of a lifetime.',
    stats:{mystique:2,menace:1}, care:{fuss:1.3},
    notes:['Pitched a "ground floor opportunity." The floor is the shelf.','Has a downline. The downline is imaginary. It is still recruiting.','Says this is not a scheme. It is definitely a scheme.','Offered you a "starter kit." The kit is lint.'],
    social:['Recruited {n}. {n} did not agree to this.','Says {n} is "at the top" now. {n} is not.','{n} asked to be removed from the downline. Request pending.'] },
  { id:'doomscroll', name:'Doomscroller', blurb:'Informed, exhausted, and staring at absolutely nothing.',
    stats:{mystique:1,cute:-1}, care:{fuss:1.2},
    notes:['Stared at the wall for two hours. Called it "staying informed."','Sighed at the wall specifically, not you, the wall.','Has strong opinions about nothing in particular, urgently.','Refreshed something that does not exist. Found it disappointing.'],
    social:['Told {n} something upsetting and vague and definitely wrong.','Showed {n} nothing on the wall. {n} looked anyway.','Agreed with {n} about something neither of them explained.'] },
  { id:'freegan', name:'Freegan', blurb:'Will eat anything. Will judge you for buying it first.',
    stats:{damp:1,cute:1}, care:{food:0.65},
    notes:['Found something. Ate it. Would not say where "somewhere" was.','Turned down a fresh one out of principle. Ate it later, alone.','Called your groceries "wasteful." Ate your groceries.','Has never once paid for a snack and wants that acknowledged.'],
    social:['Judged {n}\'s snack. Ate half of it anyway.','Shared a found item with {n}. {n} did not ask what it was.','Lectured {n} about waste while visibly hoarding crumbs.'] },
  { id:'astrology', name:'Astrologically Confident', blurb:'Mercury is in something. That explains everything, apparently.',
    stats:{mystique:3}, care:{fuss:1.2},
    notes:['Blamed the retrograde. There is no retrograde. It doesn\'t care.','Has read its chart. Has not read anything else, ever.','Says today is "not a good day for feedback." Every day is that day.','Diagnosed the lamp\'s energy. The lamp has bad energy, apparently.'],
    social:['Told {n} their sign explains everything wrong with them.','Says it and {n} are "cosmically incompatible." They are neighbors.','Apologized to {n}, blamed the moon, meant none of it.'] },
  { id:'witness', name:'Witness To Everything', blurb:'Saw what happened. Has a log. The log has footnotes.',
    stats:{mystique:2,menace:1}, care:{},
    notes:['Updated the log. The log is getting long.','Says it "saw everything." It was asleep. It stands by the claim.','Cross-referenced two events that did not happen together.','Has begun dating entries. This feels ominous.'],
    social:['Logged something {n} did. {n} did not do it. Logged anyway.','Corroborated its own story about {n}. There was no other witness.','Testified against {n} to an audience of nobody.'] },
  { id:'steward', name:'Shop Steward', blurb:'Organizing the shelf. Demands are being drafted.',
    stats:{menace:2,mystique:1}, care:{food:1.2,fuss:1.2},
    notes:['Called a meeting. Attendance was mandatory. Attendance was one.','Drafted a list of demands. Demand one: better snacks.','Is "in talks" with itself. Talks are going well.','Threatened a walkout. Walked three inches. Walked back.'],
    social:['Recruited {n} to the cause. {n} has no idea what the cause is.','Negotiated on {n}\'s behalf without asking {n}.','Says {n} crossed a picket line that does not exist.'] },
  { id:'critic', name:'Restaurant Critic', blurb:'Rates everything. Nothing gets more than three stars.',
    stats:{mystique:2,cute:-1}, care:{food:1.3},
    notes:['Rated dinner two stars. Ate all of it anyway.','Sent the bowl back. There is nowhere to send it.','Wrote a review. The review is one word and it is unkind.','Says the presentation was "beneath it." Ate off the floor once.'],
    social:['Reviewed {n}\'s spot on the shelf. Unfavorably.','Compared {n} unfavorably to a bowl.','Gave {n} a rare compliment, then immediately walked it back.'] },
  { id:'napoleon', name:'Small Napoleon', blurb:'Short. Furious about it. Conquering the footstool regardless.',
    stats:{menace:4,cute:1}, care:{fuss:1.3},
    notes:['Has claimed the whole shelf "in principle."','Drew a map. The map is wrong and also aggressive.','Declared victory over a sock.','Is planning a campaign. The campaign is a nap with ambitions.'],
    social:['Has annexed {n}\'s spot. {n} is now a territory.','Demanded {n}\'s surrender. {n} was not at war.','Formed an alliance with {n}. The alliance favors it entirely.'] },
  { id:'prophet', name:'Self-Appointed Prophet', blurb:'Foretold your downfall. Timeline vague. Confidence high.',
    stats:{mystique:4,cute:-1}, care:{},
    notes:['Predicted something bad. It was mildly inconvenient. Called it a sign.','Has a prophecy. The prophecy is about the shelf. Mostly about itself.','Says it "saw this coming." It did not see this coming.','Updated the prophecy to match what already happened.'],
    social:['Foretold doom for {n}. {n} had a fine day.','Says {n} is "written about." {n} is not written about.','Blessed {n}, unprompted, slightly condescendingly.'] },
  { id:'cursed', name:'Mildly Cursed', blurb:'Bad luck follows it politely, at a short distance.',
    stats:{mystique:3,damp:1}, care:{},
    notes:['Something nearby broke. It was not touching it. It smiled anyway.','The lights flickered. It took a small bow.','Says the bad luck "isn\'t personal." It feels personal.','Has started collecting the bad luck like a hobby.'],
    social:['Stood near {n}. Something of {n}\'s went missing shortly after.','Apologized to {n} in advance for something that hasn\'t happened yet.','Shared the curse with {n}, generously, without asking.'] },
  { id:'socialite', name:'Shelf Socialite', blurb:'RSVPs to nothing. Shows up to everything. Judges the snacks.',
    stats:{cute:2,mystique:1}, care:{fuss:1.4},
    notes:['Was "just passing through" for forty minutes.','Complimented the shelf, insulted the lighting.','Made an entrance nobody asked for. Made it twice.','Left early, loudly, to be noticed leaving.'],
    social:['Air-kissed {n}. Neither of them has lips shaped for that.','Introduced {n} to someone who was already right there.','Told {n} they simply must catch up sometime. They are neighbors.'] },
  { id:'minimalist', name:'Aggressive Minimalist', blurb:'Owns nothing. Judges everything you own.',
    stats:{mystique:2,cute:-1}, care:{clean:1.3},
    notes:['Threw something out. It was not its to throw out.','Called the shelf "cluttered." The shelf has four things on it.','Has achieved a state of "intentional emptiness." Also just empty.','Recommends you own less. Owns nothing. Very proud of that.'],
    social:['Suggested {n} "let go" of something {n} was still using.','Donated one of {n}\'s things without asking. On {n}\'s behalf.','Told {n} that less is more. {n} now has less.'] },
  { id:'timeshare', name:'Timeshare Salesman', blurb:'Technically homeless. Extremely committed to the pitch.',
    stats:{mystique:1,menace:1}, care:{fuss:1.3},
    notes:['Pitched a "limited time offer." The offer has no details.','Says this corner is "an investment opportunity." It is a corner.','Has a brochure. The brochure is a leaf.','Will not stop talking about "the property." There is no property.'],
    social:['Sold {n} a timeshare in a spot {n} already lives in.','Says {n} "signed something." {n} did not sign anything.','Offered {n} a tour of the shelf {n} has lived on for months.'] },
  { id:'nihilist', name:'Committed Nihilist', blurb:'Nothing matters. Dinner is fifteen minutes late regardless.',
    stats:{mystique:2,cute:-1}, care:{fuss:0.7},
    notes:['Said nothing matters, then complained about the bowl placement.','Shrugged at the void. Shrugged at dinner too, but ate it fast.','Declared meaning "a construct." Still wants the good spot.','Insists none of this matters, in a tone that suggests it really does.'],
    social:['Told {n} nothing they do means anything. {n} kept doing it.','Agreed with {n} about the void, then took {n}\'s spot anyway.','Comforted {n} with nihilism. It did not land as comfort.'] },
  { id:'method', name:'Method Actor', blurb:'Is "playing a rock" this week. Will not break character.',
    stats:{mystique:3,cute:1}, care:{},
    notes:['Stayed completely still for an audience of nobody. In character.','Refused to respond to its own name. Said that\'s "not the role."','Is deep in a new role. The role is "haunted teapot." Unclear why.','Broke character once, briefly, to eat. Stayed in character while chewing.'],
    social:['Refused to acknowledge {n} exists. Says it\'s "for the part."','Improvised a scene with {n}. {n} was not told this was happening.','Workshopped a monologue at {n}. {n} did not ask for notes.'] }
];
export const TRAIT_BY_ID = {};
TRAITS.forEach(t => TRAIT_BY_ID[t.id] = t);
```

- [ ] **Step 2: Write `src/content/feuds.js`**

```js
export const FEUDS = [
  ['gossip','spiteful'],['magpie','loadbearing'],['unblinking','nocturnal'],
  ['taxidermy','terminal'],['management','complaints'],['glitter','clean'],
  ['feral','clingy'],['ancient','amnesiac'],['cult','doom'],
  ['damp','clean'],['sugar','magpie'],['theatrical','management'],
  ['litigious','landlord'],['narcissist','critic'],['paranoid','influencer'],
  ['hoarder','minimalist'],['martyr','nihilist'],['revisionist','witness'],
  ['closer','timeshare'],['steward','landlord'],['prophet','cursed'],
  ['socialite','method'],['napoleon','steward'],['doomscroll','astrology'],
  ['cryptid','witness'],['freegan','critic']
];

export const FEUD_LINES = [
  '{a} and {b} are not speaking.',
  "{a} has moved {b}'s things. {b} has noticed.",
  '{a} says {b} started it. {b} is not commenting.',
  '{a} and {b} have drawn a line down the shelf.',
  '{a} wants {b} moved. Immediately. Permanently.',
  '{b} says {a} knows what it did.',
  '{a} has been sharpening something. {b} has been watching.',
  '{a} and {b} have agreed to disagree. Neither meant it.',
  '{b} slept badly. {a} slept excellently.',
  '{a} has stopped saying {b} out loud. Uses a gesture now.'
];

// Used when a feud arc escalates (engine/achievements.js stepFeudArc)
export const ESCALATION_LINES = [
  '{a} rearranged the shelf overnight. {b} is now facing the wall.',
  "{a} took something of {b}'s. {b} has not said anything. Yet.",
  '{a} and {b} stopped speaking through a third party. There is no third party. They still stopped.',
  '{a} left a note for {b}. The note is one sentence and it is devastating.',
  '{a} has recruited two others against {b}. {b} does not know yet.',
  "{a} moved into {b}'s spot while {b} was asleep. {b} will notice.",
  "{a} has stopped saying {b}'s name entirely. Uses a long pause instead.",
  "Something of {b}'s is missing. {a} is whistling."
];

// Rare, used when a feud arc resolves into a truce
export const TRUCE_LINES = [
  '{a} and {b} are speaking again. Nobody knows what changed. Neither will say.',
  '{a} apologized to {b}. It was three words and it cost {a} everything.',
  '{a} and {b} shared a spot on the shelf without incident. Historians are stunned.',
  '{a} and {b} have called it even. The ledger has been quietly destroyed.',
  '{a} did something small for {b}. {b} pretended not to notice. Both know.',
  'Whatever happened between {a} and {b} is over now. It is somehow worse, actually — they get along.',
  '{a} and {b} have a truce. It has terms. The terms are secret.',
  '{a} and {b} sat together all day. It was, against every odd, fine.'
];
```

- [ ] **Step 3: Write `test/content.test.mjs`** (structural integrity — not part of the stated engine-only automated-test floor, but content.js is pure data with zero DOM dependency, so it's cheap and worthwhile insurance against typos in ~46 hand-authored entries)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS, TRAIT_BY_ID } from '../src/content/traits.js';
import { FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../src/content/feuds.js';

test('at least 45 traits, each with the required shape', () => {
  assert.ok(TRAITS.length >= 45, `expected >=45 traits, got ${TRAITS.length}`);
  TRAITS.forEach(t => {
    assert.equal(typeof t.id, 'string');
    assert.equal(typeof t.name, 'string');
    assert.equal(typeof t.blurb, 'string');
    assert.ok(Array.isArray(t.notes) && t.notes.length >= 3, `${t.id} needs >=3 notes`);
    assert.ok(Array.isArray(t.social) && t.social.length >= 2, `${t.id} needs >=2 social lines`);
  });
});

test('trait ids are unique and TRAIT_BY_ID matches TRAITS', () => {
  const ids = TRAITS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate trait id found');
  ids.forEach(id => assert.equal(TRAIT_BY_ID[id].id, id));
});

test('gameplay boolean flags are present on the traits the engine depends on', () => {
  // hasTrait(pet,'nocturnal'|'thief'|'wanderer') checks a literal flag property on the
  // trait definition, not the trait id — these four are load-bearing for engine/tick.js's
  // isAsleep() and engine/loop.js's autonomy() (self-moving/food-stealing pets).
  assert.equal(TRAIT_BY_ID.nocturnal.nocturnal, true);
  assert.equal(TRAIT_BY_ID.magpie.thief, true);
  assert.equal(TRAIT_BY_ID.cult.wanderer, true);
  assert.equal(TRAIT_BY_ID.clingy.wanderer, true);
});

test('every FEUDS pair references two real, distinct trait ids', () => {
  assert.ok(FEUDS.length >= 20, `expected >=20 feud pairs, got ${FEUDS.length}`);
  FEUDS.forEach(([a, b]) => {
    assert.ok(TRAIT_BY_ID[a], `unknown trait id in FEUDS: ${a}`);
    assert.ok(TRAIT_BY_ID[b], `unknown trait id in FEUDS: ${b}`);
    assert.notEqual(a, b);
  });
});

test('feud/escalation/truce line pools use {a} and {b} placeholders', () => {
  [FEUD_LINES, ESCALATION_LINES, TRUCE_LINES].forEach(pool => {
    assert.ok(pool.length >= 8, 'expected >=8 lines in pool');
    pool.forEach(line => {
      assert.ok(line.includes('{a}'), `missing {a} in: ${line}`);
      assert.ok(line.includes('{b}'), `missing {b} in: ${line}`);
    });
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `cd ~/shelf-life && node --test test/content.test.mjs`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/shelf-life
git add src/content/traits.js src/content/feuds.js test/content.test.mjs
git commit -m "Add 46-trait pool and expanded feud/escalation/truce content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```


---

### Task 5: art/stamps.js

**Files:**
- Create: `src/art/stamps.js`
- Test: `test/stamps.test.mjs`

**Interfaces:**
- Produces: `BASE_STAMPS`, `UNLOCK_STAMPS`, `STAMP_LABELS`, `STAMP_SVG`, `STAMP_ANIM_CLASS`, `DEFAULT_STAMP_SIZE`. Pure static data, zero imports. `art/studio.js` (Task 7) uses `STAMP_SVG`/`DEFAULT_STAMP_SIZE` for the stamp picker and live preview; `art/sprite.js` (Task 6) uses `STAMP_SVG`/`STAMP_ANIM_CLASS` to render each placed stamp as an animated layer.

Every stamp SVG is a hand-converted equivalent of the original canvas-drawn `STAMPS` functions from `~/Documents/shelf-life.html` (the `const STAMPS = {...}` block, lines ~1030-1090), translated from canvas-context draw calls into static SVG markup on a fixed -30..30 (60x60) viewBox — computed programmatically (not hand-transcribed) to guarantee the coordinate math matches the originals' proportions exactly. Colored parts use `fill`/`stroke="currentColor"` so `art/sprite.js` tints them via CSS `color`, matching how the original passed a `col` parameter into each draw function; the two fixed off-white parts (eye whites, teeth) stay literal `#F2E9DC`.

- [ ] **Step 1: Write `src/art/stamps.js`**

```js
// Studio canvas is a fixed 640x640 square (see art/studio.js). A placed stamp's
// x/y/size are stored in that same pixel space; art/sprite.js converts them to
// percentages of this constant when rendering, so a stamp lands in the same
// relative spot on the shelf (rendered much smaller) as it was drawn in the studio.
export const CANVAS_SIZE = 640;

export const BASE_STAMPS = ['blob','eyes','bigeye','deadeyes','ears','horns','grin','tail','wing','bow','halo','stitches','spots'];
export const UNLOCK_STAMPS = [
  { at:20, stamps:['thirdeye','antlers'], label:'a third eye and antlers' },
  { at:45, stamps:['tentacles','crown'], label:'tentacles and a crown' }
];
export const STAMP_LABELS = { blob:'Body', eyes:'Eyes', bigeye:'One eye', deadeyes:'X eyes', ears:'Ears', horns:'Horns', grin:'Teeth', tail:'Tail', wing:'Wing', bow:'Bow', halo:'Halo', stitches:'Stitches', spots:'Spots', thirdeye:'Third eye', antlers:'Antlers', tentacles:'Tentacles', crown:'Crown' };
export const DEFAULT_STAMP_SIZE = 40;

// Each SVG uses fill/stroke=currentColor for the tinted parts and a fixed off-white
// (#F2E9DC) for eye-whites/teeth, matching the original canvas-drawn stamps. Coordinate
// space is a fixed -30..30 (60x60) box, same convention as PROP_ART.
export const STAMP_SVG = {
  blob: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M 0 -19.2 C 24 -18 22.8 19.2 0 20.4 C -22.8 19.2 -24 -18 0 -19.2 Z"/>
</svg>`,
  eyes: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="-6.6" cy="0" rx="5.04" ry="6" fill="#F2E9DC"/>
  <ellipse cx="6.6" cy="0" rx="5.04" ry="6" fill="#F2E9DC"/>
  <circle cx="-6" cy="0.6" r="2.4" fill="currentColor"/>
  <circle cx="7.2" cy="0.6" r="2.4" fill="currentColor"/>
</svg>`,
  bigeye: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="0" cy="0" rx="10.8" ry="9" fill="#F2E9DC"/>
  <circle cx="0" cy="0" r="4.32" fill="currentColor"/>
  <circle cx="1.92" cy="-1.92" r="1.32" fill="#F2E9DC"/>
</svg>`,
  deadeyes: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.92" stroke-linecap="round" fill="none">
  <line x1="-10.8" y1="-3.6" x2="-3.6" y2="3.6"/>
  <line x1="-3.6" y1="-3.6" x2="-10.8" y2="3.6"/>
  <line x1="3.6" y1="-3.6" x2="10.8" y2="3.6"/>
  <line x1="10.8" y1="-3.6" x2="3.6" y2="3.6"/>
</svg>`,
  ears: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M -10.8 8.4 Q -14.4 -13.2 -1.8 -2.4 Z"/>
  <path d="M 10.8 8.4 Q 14.4 -13.2 1.8 -2.4 Z"/>
</svg>`,
  horns: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M -6 7.2 Q -18 -2.4 -9 -14.4 Q -7.2 -1.2 -0.6 7.2 Z"/>
  <path d="M 6 7.2 Q 18 -2.4 9 -14.4 Q 7.2 -1.2 0.6 7.2 Z"/>
</svg>`,
  grin: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <path d="M 9.62 2.5 A 10.8 10.8 0 0 1 -9.62 2.5" fill="none" stroke="currentColor" stroke-width="1.68"/>
  <path d="M -9.84 6.6 L -6.48 6.6 L -8.16 11.4 Z" fill="#F2E9DC"/>
  <path d="M -5.76 6.6 L -2.4 6.6 L -4.08 11.4 Z" fill="#F2E9DC"/>
  <path d="M -1.68 6.6 L 1.68 6.6 L 0 11.4 Z" fill="#F2E9DC"/>
  <path d="M 2.4 6.6 L 5.76 6.6 L 4.08 11.4 Z" fill="#F2E9DC"/>
  <path d="M 6.48 6.6 L 9.84 6.6 L 8.16 11.4 Z" fill="#F2E9DC"/>
</svg>`,
  tail: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linecap="round">
  <path d="M 0 0 C 16.8 -2.4 13.2 -19.2 -1.2 -15.6"/>
</svg>`,
  wing: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M 0 0 Q -21.6 -16.8 -25.2 2.4 Q -14.4 1.2 -16.8 10.8 Q -6 6 0 0 Z"/>
</svg>`,
  bow: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <ellipse cx="-9" cy="0" rx="8.4" ry="6" transform="rotate(-17.2 -9 0)"/>
  <ellipse cx="9" cy="0" rx="8.4" ry="6" transform="rotate(17.2 9 0)"/>
  <circle cx="0" cy="0" r="3.6"/>
</svg>`,
  halo: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.64">
  <ellipse cx="0" cy="0" rx="14.4" ry="5.04"/>
</svg>`,
  stitches: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.44" stroke-linecap="round">
  <line x1="-14.4" y1="0" x2="14.4" y2="0"/>
  <line x1="-12" y1="-4.8" x2="-12" y2="4.8"/>
  <line x1="-6" y1="-4.8" x2="-6" y2="4.8"/>
  <line x1="0" y1="-4.8" x2="0" y2="4.8"/>
  <line x1="6" y1="-4.8" x2="6" y2="4.8"/>
  <line x1="12" y1="-4.8" x2="12" y2="4.8"/>
</svg>`,
  spots: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <circle cx="0" cy="0" r="7.56"/>
  <circle cx="13.2" cy="6" r="5.94"/>
  <circle cx="-10.8" cy="7.2" r="5.13"/>
  <circle cx="4.8" cy="-10.8" r="4.86"/>
</svg>`,
  thirdeye: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="0" cy="0" rx="9.6" ry="13.2" fill="#F2E9DC"/>
  <ellipse cx="0" cy="0" rx="3.6" ry="9" fill="currentColor"/>
  <g stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
  <line x1="12" y1="0" x2="18" y2="0"/>
  <line x1="8.49" y1="11.03" x2="12.73" y2="16.12"/>
  <line x1="0" y1="15.6" x2="0" y2="22.8"/>
  <line x1="-8.49" y1="11.03" x2="-12.73" y2="16.12"/>
  <line x1="-12" y1="0" x2="-18" y2="0"/>
  <line x1="-8.49" y1="-11.03" x2="-12.73" y2="-16.12"/>
  <line x1="0" y1="-15.6" x2="0" y2="-22.8"/>
  <line x1="8.49" y1="-11.03" x2="12.73" y2="-16.12"/>
  </g>
</svg>`,
  antlers: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2.16" stroke-linecap="round" fill="none">
  <line x1="-3.6" y1="9.6" x2="-8.4" y2="-16.8"/>
  <line x1="-6" y1="-3.6" x2="-16.8" y2="-10.8"/>
  <line x1="-7.44" y1="-10.8" x2="-15.6" y2="-20.4"/>
  <line x1="3.6" y1="9.6" x2="8.4" y2="-16.8"/>
  <line x1="6" y1="-3.6" x2="16.8" y2="-10.8"/>
  <line x1="7.44" y1="-10.8" x2="15.6" y2="-20.4"/>
</svg>`,
  tentacles: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.64" stroke-linecap="round">
  <path d="M -13.2 0 C -21.6 10.8 -6 18 -16.8 25.2"/>
  <path d="M -4.8 0 C 3.6 10.8 -12 18 -1.2 25.2"/>
  <path d="M 4.8 0 C -3.6 10.8 12 18 1.2 25.2"/>
  <path d="M 13.2 0 C 21.6 10.8 6 18 16.8 25.2"/>
</svg>`,
  crown: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M -15.6 7.2 L -15.6 -8.4 L -7.8 0.6 L 0 -13.2 L 7.8 0.6 L 15.6 -8.4 L 15.6 7.2 Z"/>
</svg>`,
};

export const STAMP_ANIM_CLASS = {
  blob:'', eyes:'anim-blink', bigeye:'anim-blink', deadeyes:'anim-blink-slow', thirdeye:'anim-blink-slow',
  ears:'anim-sway', wing:'anim-sway', tail:'anim-sway', antlers:'anim-sway-slow', tentacles:'anim-undulate',
  horns:'anim-twitch', stitches:'anim-twitch', halo:'anim-halo', crown:'anim-bob', bow:'anim-bob',
  grin:'', spots:''
};
```

- [ ] **Step 2: Write `test/stamps.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_STAMPS, UNLOCK_STAMPS, STAMP_LABELS, STAMP_SVG, STAMP_ANIM_CLASS, DEFAULT_STAMP_SIZE } from '../src/art/stamps.js';

test('every base and unlockable stamp kind has SVG markup and a label', () => {
  const allKinds = BASE_STAMPS.concat(UNLOCK_STAMPS.flatMap(u => u.stamps));
  assert.ok(allKinds.length >= 16, `expected >=16 stamp kinds, got ${allKinds.length}`);
  allKinds.forEach(kind => {
    assert.ok(STAMP_SVG[kind] && STAMP_SVG[kind].includes('<svg'), `missing/invalid SVG for ${kind}`);
    assert.ok(typeof STAMP_LABELS[kind] === 'string' && STAMP_LABELS[kind].length > 0, `missing label for ${kind}`);
    assert.ok(kind in STAMP_ANIM_CLASS, `missing STAMP_ANIM_CLASS entry for ${kind}`);
  });
});

test('DEFAULT_STAMP_SIZE is a positive number', () => {
  assert.equal(typeof DEFAULT_STAMP_SIZE, 'number');
  assert.ok(DEFAULT_STAMP_SIZE > 0);
});

test('UNLOCK_STAMPS thresholds are ascending', () => {
  const ats = UNLOCK_STAMPS.map(u => u.at);
  for (let i = 1; i < ats.length; i++) assert.ok(ats[i] > ats[i - 1], 'unlock thresholds must be ascending');
});
```

- [ ] **Step 3: Run the tests**

Run: `cd ~/shelf-life && node --test test/stamps.test.mjs`
Expected: all 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd ~/shelf-life
git add src/art/stamps.js test/stamps.test.mjs
git commit -m "Add art/stamps.js: 16 SVG stamp layers converted from the original canvas draws

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 10: audio/sound.js + audio/narrator.js

**Files:**
- Create: `src/audio/sound.js`
- Create: `src/audio/narrator.js`

**Interfaces:**
- Consumes: `state`, `save`, `onNote` from `state.js` (both files import these directly — audio is a singleton subsystem for a single-instance app, matching the project's direct-import convention).
- Produces: everything under `audio/sound.js:` and `audio/narrator.js:` in the Global contracts section. `main.js` (Task 14) calls `initNarrator()` and wires `muteBtn`/`narratorBtn` to `toggleMuted()`/`toggleNarrator()`; `engine/care.js` and `engine/loop.js`/`engine/achievements.js` (Tasks 8/9) call the `playX()` functions at the appropriate moments.
- No automated tests possible (both files require browser-only APIs — `AudioContext`, `SpeechSynthesis` — unavailable under `node --test`). Verified manually in Task 16.

Both modules self-register against `state.js`'s generic `onNote(listener)` hook rather than `state.js` importing either of them — this keeps `state.js` at the dependency-free base of the layering while still letting audio react to every note.

- [ ] **Step 1: Write `src/audio/sound.js`**

```js
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
```

- [ ] **Step 2: Write `src/audio/narrator.js`**

```js
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
```

- [ ] **Step 3: Syntax check (no automated behavioral test — browser-only APIs)**

```bash
cd ~/shelf-life
node --check src/audio/sound.js
node --check src/audio/narrator.js
```
Expected: both print nothing (silent success).

- [ ] **Step 4: Manual verification (deferred to Task 16)**

Once `main.js` (Task 14) wires the toolbar buttons: feeding/fussing/cleaning a pet plays a distinct short sound each; toggling `muteBtn` silences all SFX; a new note triggers a spoken utterance when `narratorBtn` is on (voice quality depends on the OS — note this caveat in the README); toggling `narratorBtn` off stops new notes from being spoken.

- [ ] **Step 5: Commit**

```bash
cd ~/shelf-life
git add src/audio/sound.js src/audio/narrator.js
git commit -m "Add procedural SFX (Web Audio) and speaking narrator (SpeechSynthesis)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 15: PWA — manifest.webmanifest, service-worker.js, icons

**Files:**
- Create: `icons/icon.svg`
- Create: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-180.png` (generated from the SVG, not hand-authored)
- Create: `manifest.webmanifest`
- Create: `service-worker.js`

**Interfaces:**
- Consumes: nothing. Structurally independent of every other task.
- Produces: the manifest and icons referenced by `index.html` (Task 2, already links `manifest.webmanifest` and `icons/icon-192.png`); `main.js` (Task 14) registers `service-worker.js`.

- [ ] **Step 1: Write `icons/icon.svg`**

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#33203D"/>
  <rect x="40" y="40" width="432" height="432" rx="64" fill="#1A1220"/>
  <ellipse cx="256" cy="270" rx="150" ry="130" fill="#FF8FB8"/>
  <ellipse cx="205" cy="250" rx="34" ry="40" fill="#F2E9DC"/>
  <ellipse cx="315" cy="250" rx="34" ry="40" fill="#F2E9DC"/>
  <circle cx="197" cy="258" r="16" fill="#1A1220"/>
  <circle cx="325" cy="258" r="16" fill="#1A1220"/>
  <path d="M180 330 Q256 380 332 330 L318 360 L294 336 L270 366 L246 336 L222 366 L198 336 Z" fill="#F2E9DC"/>
  <path d="M150 165 L175 230 L120 215 Z" fill="#FF8FB8"/>
  <path d="M362 165 L337 230 L392 215 Z" fill="#FF8FB8"/>
</svg>
```

- [ ] **Step 2: Rasterize the icon to the required PNG sizes**

```bash
cd ~/shelf-life
rsvg-convert -w 192 -h 192 icons/icon.svg -o icons/icon-192.png
rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png
rsvg-convert -w 180 -h 180 icons/icon.svg -o icons/icon-180.png
file icons/icon-192.png icons/icon-512.png icons/icon-180.png
```
Expected: `file` reports each as "PNG image data" with the matching dimensions. (If `rsvg-convert` isn't available in the environment executing this task, fall back to `magick icons/icon.svg -resize 192x192 icons/icon-192.png` etc. — both `rsvg-convert` and `magick`/`convert` were confirmed installed on this machine.)

- [ ] **Step 3: Write `manifest.webmanifest`**

```json
{
  "name": "Shelf Life",
  "short_name": "Shelf Life",
  "description": "Small creatures with needs, opinions, and long memories. They cannot die. They have looked into it.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#1A1220",
  "theme_color": "#33203D",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 4: Write `service-worker.js`**

App-shell cache-first strategy: on install, precache the static shell; on fetch, serve from cache first and fall back to network, updating the cache in the background (stale-while-revalidate) so an online visit picks up new deploys without breaking offline play. Cache name is versioned so bumping `CACHE_VERSION` invalidates old caches on activate.

```js
const CACHE_VERSION = 'shelflife-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './src/main.js',
  './src/state.js',
  './src/content/traits.js',
  './src/content/feuds.js',
  './src/content/copy.js',
  './src/content/props.js',
  './src/content/decor.js',
  './src/content/mature.js',
  './src/engine/tick.js',
  './src/engine/care.js',
  './src/engine/unlocks.js',
  './src/engine/achievements.js',
  './src/engine/loop.js',
  './src/art/stamps.js',
  './src/art/sprite.js',
  './src/art/studio.js',
  './src/audio/sound.js',
  './src/audio/narrator.js',
  './src/ui/render.js',
  './src/ui/toast.js',
  './src/ui/card.js',
  './src/ui/decorUI.js',
  './src/ui/drag.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
```

- [ ] **Step 5: Structural verification**

```bash
cd ~/shelf-life
python3 -c "import json; json.load(open('manifest.webmanifest')); print('manifest.webmanifest is valid JSON')"
node --check service-worker.js && echo "service-worker.js OK"
```
Expected: both print their success line, no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/shelf-life
git add icons/icon.svg icons/icon-192.png icons/icon-512.png icons/icon-180.png manifest.webmanifest service-worker.js
git commit -m "Add PWA manifest, service worker, and app icons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 6: art/sprite.js

**Files:**
- Create: `src/art/sprite.js`

**Interfaces:**
- Consumes: `STAMP_SVG`, `STAMP_ANIM_CLASS`, `CANVAS_SIZE` from `art/stamps.js` (Task 5).
- Produces: `renderPetSprite(pet)`, `moodMotionClasses(pet, {mood, asleep, feudDirection})` — the exact shapes from the Global contracts section above. `ui/render.js` (Task 11) is the sole caller: it builds the element with `renderPetSprite(pet)`, computes mood/asleep/feudDirection itself, then applies motion with `el.classList.add(...moodMotionClasses(pet, {...}))`. `feudDirection` is `'left'|'right'|null` — computed by `ui/render.js` from shelf slot adjacency; `sprite.js` has no slot/neighbor knowledge of its own and does not call `moodMotionClasses` itself.

This module is DOM-facing (`document.createElement`) and has no automated test — `node --test` has no DOM. Per the plan's stated testing split, verification here is `node --check` for syntax only; behavioral verification (a pet actually renders and animates in a real page) happens in Task 16's manual browser smoke test once `main.js` exists to call this code.

A stamp's `x`/`y`/`size` are stored in the studio's 640x640 canvas pixel space (`CANVAS_SIZE`). `renderPetSprite` converts them to percentages of that constant so a stamp lands in the same relative spot on the shelf (rendered much smaller than the studio canvas) as it was drawn. Both the sprite wrapper and every stamp layer get a negative random `animation-delay` so multiple pets/stamps on the shelf don't move in visual lockstep. `moodMotionClasses` returns exactly one motion class (not multiple) because CSS `animation` is a non-additive shorthand — stacking two animation-setting classes on one element means only the later stylesheet rule wins, they don't combine.

- [ ] **Step 1: Write `src/art/sprite.js`**

```js
import { STAMP_SVG, STAMP_ANIM_CLASS, CANVAS_SIZE } from './stamps.js';

// Renders a Pet's layered sprite: the freehand-painted body image as the base
// layer, plus one absolutely-positioned inline-SVG layer per placed stamp.
// Stamp x/y/size are stored in the studio's 640x640 canvas pixel space (see
// stamps.js's CANVAS_SIZE); converting to percentages here means the sprite
// scales correctly no matter how small/large it's finally rendered on the shelf.
// Handles migrated pre-v4 pets (art.stamps empty/undefined) gracefully — they
// just render as a body with no stamp layers.
export function renderPetSprite(pet) {
  const wrap = document.createElement('div');
  wrap.className = 'sprite';

  const img = document.createElement('img');
  img.className = 'sprite-body';
  img.src = pet.art.body;
  img.alt = '';
  wrap.appendChild(img);

  (pet.art.stamps || []).forEach(stamp => {
    const layer = document.createElement('div');
    const animClass = STAMP_ANIM_CLASS[stamp.kind] || '';
    layer.className = 'sprite-stamp' + (animClass ? ' ' + animClass : '');
    const wPct = (stamp.size * 2 / CANVAS_SIZE) * 100;
    layer.style.left = (stamp.x / CANVAS_SIZE * 100) + '%';
    layer.style.top = (stamp.y / CANVAS_SIZE * 100) + '%';
    layer.style.width = wPct + '%';
    layer.style.height = wPct + '%';
    layer.style.color = stamp.color;
    layer.style.transform = `translate(-50%,-50%) rotate(${stamp.rotation || 0}deg)`;
    // Negative random delay so stamps animating the same keyframes (e.g. every
    // pet's blinking eyes) don't all move in visual lockstep across the shelf.
    layer.style.animationDelay = '-' + (Math.random() * 6).toFixed(2) + 's';
    layer.innerHTML = STAMP_SVG[stamp.kind] || '';
    wrap.appendChild(layer);
  });

  // Same lockstep-avoidance trick applied to the whole-sprite motion class the
  // caller adds later (moodMotionClasses) — the wrapper animation is present
  // from creation even though the class enabling it may be added afterward.
  wrap.style.animationDelay = '-' + (Math.random() * 6).toFixed(2) + 's';
  return wrap;
}

// Picks exactly one whole-sprite motion class for renderPetSprite's wrapper
// element, by priority. CSS `animation` is a non-additive shorthand — stacking
// two animation-setting classes on one element means only one wins (whichever
// rule is later in the stylesheet), they don't combine — so this deliberately
// returns a single-element array rather than accumulating multiple matches.
// Still returns an array (not a bare string) so every call site can use the
// same `classList.add(...moodMotionClasses(...))` spread shape.
//
// sprite.js has no knowledge of mood/sleep/feud state itself — the caller
// (ui/render.js) computes those and passes them in, including which side
// (`'left'` | `'right'` | null) a feuding neighbor sits on.
export function moodMotionClasses(pet, { mood, asleep, feudDirection } = {}) {
  if (asleep) return ['motion-asleep'];
  if (mood === 'furious') return ['motion-furious'];
  if (feudDirection === 'left') return ['motion-lean-left'];
  if (feudDirection === 'right') return ['motion-lean-right'];
  if (mood === 'annoyed') return ['motion-jitter'];
  return ['motion-bob'];
}
```

- [ ] **Step 2: Syntax-check (no DOM in `node:test`, so this replaces an automated test for this file)**

```bash
cd ~/shelf-life
node --check src/art/sprite.js && echo "sprite.js syntax OK"
```
Expected: prints `sprite.js syntax OK`, no errors. Behavioral verification (pet renders with body + stamp layers, motion animates, migrated stampless pets still render) happens in Task 16's manual browser smoke test.

- [ ] **Step 3: Commit**

```bash
cd ~/shelf-life
git add src/art/sprite.js
git commit -m "Add art/sprite.js: layered pet rendering + mood motion classes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

---

### Task 8: engine/tick.js + engine/care.js

**Files:**
- Create: `src/engine/tick.js`
- Create: `src/engine/care.js`
- Test: `test/tick.test.mjs`
- Test: `test/care.test.mjs`

**Interfaces:**
- Consumes: `TRAIT_BY_ID` (content/traits.js), `PROPS` (content/props.js), `DECAY`/`CARE_LINES`/`OVERFED`/`ASLEEP_LINES` (content/copy.js), `propById`/`clamp`/`pick`/`addNote`/`HOUR`/`MAX_OFFLINE_HOURS` (state.js).
- Produces: everything under `engine/tick.js:` and `engine/care.js:` in Global contracts. Neither file touches the DOM, toasts, or calls `save()`/`renderAll()` — those are the caller's job (ui layer, Task 11/12, and `main.js`, Task 14), which is what keeps this pure and unit-testable.
- Every exported function takes `state` explicitly (per Global Constraints) — no closures over the live singleton.

- [ ] **Step 1: Write `src/engine/tick.js`**

```js
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS } from '../content/props.js';
import { DECAY } from '../content/copy.js';
import { propById, petById, clamp, HOUR, MAX_OFFLINE_HOURS } from '../state.js';

export const MOOD_WORD = { content: 'Content', fine: 'Fine', annoyed: 'Annoyed', furious: 'Furious' };

export function hasTrait(pet, key) {
  return pet.traits.some(id => TRAIT_BY_ID[id] && TRAIT_BY_ID[id][key]);
}

export function isNight(date = new Date()) {
  const h = date.getHours();
  return h >= 20 || h < 7;
}

export function isAsleep(pet, date = new Date()) {
  return hasTrait(pet, 'nocturnal') && !isNight(date);
}

export function neighborSlots(index, slotCount) {
  const out = [];
  if (index % 6 > 0) out.push(index - 1);
  if (index % 6 < 5) out.push(index + 1);
  return out.filter(x => x >= 0 && x < slotCount);
}

export function neighborProps(state, index) {
  return neighborSlots(index, state.slots.length)
    .map(x => state.slots[x])
    .filter(Boolean)
    .map(id => propById(state, id))
    .filter(Boolean);
}

export function neighborPets(state, index) {
  return neighborSlots(index, state.slots.length)
    .map(x => state.slots[x])
    .filter(Boolean)
    .map(id => petById(state, id))
    .filter(Boolean);
}

export function decayRate(pet, need, state) {
  let r = DECAY[need];
  pet.traits.forEach(id => {
    const c = (TRAIT_BY_ID[id] && TRAIT_BY_ID[id].care) || {};
    if (c[need]) r *= c[need];
  });
  const i = state.slots.indexOf(pet.id);
  if (i >= 0) {
    const nbrs = neighborProps(state, i);
    nbrs.forEach(pr => {
      const a = (PROPS[pr.kind] && PROPS[pr.kind].aura) || {};
      if (a[need]) r *= a[need];
    });
    if (hasTrait(pet, 'nocturnal') && nbrs.some(pr => pr.kind === 'lamp') && need === 'fuss') r *= 1.5;
  }
  return r;
}

export function tick(state, now = Date.now()) {
  let hours = (now - state.lastTick) / HOUR;
  if (hours <= 0) { state.lastTick = now; return false; }
  hours = Math.min(hours, MAX_OFFLINE_HOURS);
  state.pets.forEach(pet => {
    ['food', 'fuss', 'clean'].forEach(k => {
      pet.needs[k] = clamp(pet.needs[k] - decayRate(pet, k, state) * hours, 0, 100);
    });
  });
  state.lastTick = now;
  return true;
}

export function moodOf(pet) {
  const avg = (pet.needs.food + pet.needs.fuss + pet.needs.clean) / 3;
  if (avg >= 76) return 'content';
  if (avg >= 50) return 'fine';
  if (avg >= 26) return 'annoyed';
  return 'furious';
}

export function worstNeed(pet) {
  let k = 'food';
  ['fuss', 'clean'].forEach(n => { if (pet.needs[n] < pet.needs[k]) k = n; });
  return k;
}
```

- [ ] **Step 2: Write `test/tick.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTrait, isNight, isAsleep, neighborSlots, neighborProps, neighborPets, decayRate, tick, moodOf, worstNeed } from '../src/engine/tick.js';
import { blankState, defaultNeeds } from '../src/state.js';

function localHour(h) { return new Date(2024, 0, 1, h, 0, 0).getTime(); }

function makePet(overrides = {}) {
  return { id: 'p1', name: 'Test', traits: ['damp'], needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...overrides };
}

test('hasTrait checks the trait pool, not a literal string match', () => {
  assert.equal(hasTrait(makePet({ traits: ['nocturnal'] }), 'nocturnal'), true);
  assert.equal(hasTrait(makePet({ traits: ['nocturnal'] }), 'clean'), false);
});

test('isNight is true 20:00-06:59, false 07:00-19:59', () => {
  assert.equal(isNight(new Date(localHour(22))), true);
  assert.equal(isNight(new Date(localHour(6))), true);
  assert.equal(isNight(new Date(localHour(7))), false);
  assert.equal(isNight(new Date(localHour(19))), false);
  assert.equal(isNight(new Date(localHour(20))), true);
});

test('a nocturnal pet is asleep during the day and awake at night; others never sleep', () => {
  const nocturnal = makePet({ traits: ['nocturnal'] });
  assert.equal(isAsleep(nocturnal, new Date(localHour(12))), true);
  assert.equal(isAsleep(nocturnal, new Date(localHour(22))), false);
  const diurnal = makePet({ traits: ['damp'] });
  assert.equal(isAsleep(diurnal, new Date(localHour(12))), false);
  assert.equal(isAsleep(diurnal, new Date(localHour(22))), false);
});

test('neighborSlots respects row boundaries on a 6-wide grid', () => {
  assert.deepEqual(neighborSlots(0, 18), [1]);
  assert.deepEqual(neighborSlots(5, 18), [4]);
  assert.deepEqual(neighborSlots(3, 18), [2, 4]);
  assert.deepEqual(neighborSlots(6, 18), [7]);
});

test('neighborProps only returns occupied neighbor slots that hold props', () => {
  const s = blankState();
  const pet = makePet({ id: 'pA' });
  s.pets.push(pet);
  s.props.push({ id: 'd1', kind: 'lamp' });
  s.slots[0] = 'pA';
  s.slots[1] = 'd1';
  assert.equal(neighborProps(s, 0).length, 1);
  assert.equal(neighborProps(s, 0)[0].kind, 'lamp');
  assert.equal(neighborProps(s, 5).length, 0);
});

test('neighborPets mirrors neighborProps for pet-occupied neighbor slots', () => {
  const s = blankState();
  const a = makePet({ id: 'pA' });
  const b = makePet({ id: 'pB' });
  s.pets.push(a, b);
  s.slots[0] = 'pA';
  s.slots[1] = 'pB';
  assert.equal(neighborPets(s, 0).length, 1);
  assert.equal(neighborPets(s, 0)[0].id, 'pB');
  assert.equal(neighborPets(s, 5).length, 0);
});

test('decayRate applies trait care multiplier and prop aura multiplier', () => {
  const s = blankState();
  const dampPet = makePet({ id: 'pA', traits: ['damp'] });
  s.pets.push(dampPet);
  s.slots[0] = 'pA';
  const baseline = decayRate(makePet({ traits: [] }), 'clean', s);
  const withDampTrait = decayRate(dampPet, 'clean', s);
  assert.ok(withDampTrait > baseline, 'damp trait should raise clean decay rate');

  s.props.push({ id: 'd1', kind: 'lamp' });
  s.slots[1] = 'd1';
  const withoutLamp = decayRate(makePet({ id: 'pB', traits: ['nocturnal'] }), 'fuss', s);
  s.pets.push(makePet({ id: 'pB', traits: ['nocturnal'] }));
  s.slots[2] = 'pB';
  const nocturnalNextToLamp = decayRate(s.pets.find(p => p.id === 'pB'), 'fuss', s);
  assert.ok(nocturnalNextToLamp !== withoutLamp);
});

test('tick decays needs proportional to elapsed hours, capped at MAX_OFFLINE_HOURS, and no-ops for non-positive elapsed time', () => {
  const s = blankState();
  const pet = makePet({ id: 'pA', traits: [], needs: { food: 100, fuss: 100, clean: 100 } });
  s.pets.push(pet);
  s.slots[0] = 'pA';
  s.lastTick = 0;
  const changed = tick(s, HOUR_MS(2));
  assert.equal(changed, true);
  assert.ok(pet.needs.food < 100);

  const before = { ...pet.needs };
  const changedAgain = tick(s, HOUR_MS(2));
  assert.equal(changedAgain, false);
  assert.deepEqual(pet.needs, before);

  function HOUR_MS(h) { return h * 3600000; }
});

test('moodOf buckets by average need at the documented thresholds', () => {
  assert.equal(moodOf(makePet({ needs: { food: 90, fuss: 90, clean: 90 } })), 'content');
  assert.equal(moodOf(makePet({ needs: { food: 60, fuss: 60, clean: 60 } })), 'fine');
  assert.equal(moodOf(makePet({ needs: { food: 30, fuss: 30, clean: 30 } })), 'annoyed');
  assert.equal(moodOf(makePet({ needs: { food: 10, fuss: 10, clean: 10 } })), 'furious');
});

test('worstNeed picks the lowest of food/fuss/clean', () => {
  assert.equal(worstNeed(makePet({ needs: { food: 80, fuss: 20, clean: 90 } })), 'fuss');
  assert.equal(worstNeed(makePet({ needs: { food: 10, fuss: 80, clean: 90 } })), 'food');
});
```

- [ ] **Step 3: Run the tick tests**

Run: `cd ~/shelf-life && node --test test/tick.test.mjs`
Expected: all 8 tests PASS.

- [ ] **Step 4: Write `src/engine/care.js`**

```js
import { tick, isAsleep } from './tick.js';
import { ASLEEP_LINES, OVERFED, CARE_LINES } from '../content/copy.js';
import { clamp, pick, addNote } from '../state.js';

export const CARE_GAIN = { food: 34, fuss: 38, clean: 42 };

export function careFor(state, pet, need, now = Date.now()) {
  tick(state, now);
  const before = pet.needs[need];
  let gain = CARE_GAIN[need];
  let line;
  if (isAsleep(pet, new Date(now))) {
    gain = Math.round(gain * 0.5);
    line = pick(ASLEEP_LINES);
  } else if (before > 78) {
    gain = Math.round(gain * 0.25);
    line = pick(OVERFED[need]);
  } else {
    line = pick(CARE_LINES[need]);
  }
  pet.needs[need] = clamp(before + gain, 0, 100);
  let bondGained = false;
  if (before < 72) {
    pet.cared++;
    if (pet.cared % 3 === 0) {
      pet.bond = clamp(pet.bond + 1, 0, 25);
      bondGained = true;
    }
  }
  return { message: pet.name + ': ' + line, bondGained };
}

const ROUNDS_NOTES = [
  'You did the rounds. They can all tell it was the rounds.',
  'Everyone was seen to. Nobody was seen.',
  'You went down the line. They noticed the order.'
];
const ROUNDS_TOASTS = [
  'Rounds done. Nobody feels special.',
  'Everyone fed. Everyone unimpressed.',
  'Efficient. They hated it.'
];

export function doRounds(state, now = Date.now()) {
  tick(state, now);
  if (!state.pets.length) return null;
  state.pets.forEach(pet => {
    ['food', 'fuss', 'clean'].forEach(k => { pet.needs[k] = clamp(pet.needs[k] + 13, 0, 100); });
  });
  addNote(state, pick(ROUNDS_NOTES), 'the shelf', 'note');
  return { message: pick(ROUNDS_TOASTS) };
}
```

- [ ] **Step 5: Write `test/care.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careFor, doRounds, CARE_GAIN } from '../src/engine/care.js';
import { blankState, defaultNeeds } from '../src/state.js';

function localHour(h) { return new Date(2024, 0, 1, h, 0, 0).getTime(); }

function makePet(overrides = {}) {
  return { id: 'p1', name: 'Test', traits: [], needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...overrides };
}

test('careFor raises the targeted need and returns a message prefixed with the pet name', () => {
  const s = blankState();
  const pet = makePet({ needs: { food: 40, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  const result = careFor(s, pet, 'food', localHour(12));
  assert.equal(pet.needs.food, 40 + CARE_GAIN.food);
  assert.ok(result.message.startsWith('Test: '));
});

test('careFor grants reduced gain when the need is already high (overfed path)', () => {
  const s = blankState();
  const pet = makePet({ needs: { food: 85, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  careFor(s, pet, 'food', localHour(12));
  assert.equal(pet.needs.food, 85 + Math.round(CARE_GAIN.food * 0.25));
});

test('careFor grants reduced gain for a sleeping nocturnal pet', () => {
  const s = blankState();
  const pet = makePet({ traits: ['nocturnal'], needs: { food: 40, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  careFor(s, pet, 'food', localHour(12)); // daytime -> nocturnal pet is asleep
  assert.equal(pet.needs.food, 40 + Math.round(CARE_GAIN.food * 0.5));
});

test('careFor awards bond exactly every third care below the 72 threshold', () => {
  const s = blankState();
  const pet = makePet({ needs: { food: 10, fuss: 40, clean: 40 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  let gains = [];
  for (let i = 0; i < 3; i++) {
    pet.needs.food = 10;
    gains.push(careFor(s, pet, 'food', localHour(12)).bondGained);
  }
  assert.deepEqual(gains, [false, false, true]);
  assert.equal(pet.bond, 1);
});

test('doRounds returns null with no pets, otherwise bumps every need and adds a note', () => {
  const empty = blankState();
  assert.equal(doRounds(empty, localHour(12)), null);

  const s = blankState();
  const pet = makePet({ needs: { food: 50, fuss: 50, clean: 50 } });
  s.pets.push(pet); s.slots[0] = pet.id; s.lastTick = localHour(12);
  const result = doRounds(s, localHour(12));
  assert.equal(pet.needs.food, 63);
  assert.ok(typeof result.message === 'string' && result.message.length > 0);
  assert.equal(s.notes.length, 1);
});
```

- [ ] **Step 6: Run the care tests**

Run: `cd ~/shelf-life && node --test test/care.test.mjs`
Expected: all 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd ~/shelf-life
git add src/engine/tick.js src/engine/care.js test/tick.test.mjs test/care.test.mjs
git commit -m "Add engine/tick.js and engine/care.js with full node:test coverage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 7: art/studio.js

**Files:**
- Create: `src/art/studio.js`

**Interfaces:**
- Consumes: `CANVAS_SIZE`, `BASE_STAMPS`, `UNLOCK_STAMPS`, `STAMP_SVG`, `STAMP_LABELS` from `art/stamps.js` (Task 5); `state` from `state.js` (Task 1). Deliberately does NOT import `engine/unlocks.js` (a parallel, not-yet-built task) — the one line of total-bond arithmetic it would need is duplicated inline instead, to avoid a hard/backwards dependency.
- Produces: `initStudio({ onSave }) -> { open(unlockedBond), close(), rebuildPalette(unlockedBond), rebuildStamps(unlockedBond), isOpen() }` plus `BASE_COLORS`, `UNLOCK_COLORS`, `unlockedColors(state)` — the exact shapes from the Global contracts section above. `ui/render.js`/`main.js` (Task 14) is the sole caller of `initStudio`; `onSave` is invoked as `onSave(art, name)` where `art = { body: <dataURL>, stamps: [...] }` matches the Pet type's `art` field exactly, and pet construction itself (rolling traits/stats/bio, picking a fallback name, pushing into `state.pets`, assigning a shelf slot) is Task 14's job, not this file's.

This module is DOM-facing (canvas, pointer events, live DOM manipulation) and has no automated test — `node --test` has no DOM/canvas. Per the plan's stated testing split, verification here is `node --check` for syntax only; behavioral verification (draw a freehand body, place/undo stamps, save a pet) happens in Task 16's manual browser smoke test once `main.js` exists to call `initStudio`.

Ported from the original prototype's freehand-canvas mechanics (`pad`/`ctx`/`brush`/`padPos`/`strokeTo`/pointer handlers/`pushUndo`/`padIsEmpty`/`padThumb`/`buildPalette`/`sizeWrap` handler/`openStudio`/`closeStudio`, `~/Documents/shelf-life.html` lines ~989-1197) essentially unchanged. The one deliberate behavior change: stamps are no longer drawn onto the canvas as pixels. A placed stamp is recorded as `{ kind, x, y, size, rotation, color }` (`size` = `brush.size * 1.7`, matching the original's stamp-draw call so proportions match; `rotation` always `0` — reserved, no rotate UI yet) and rendered as a live absolutely-positioned inline-SVG preview in `#stampLayer`, using the same `left/top/width/height/transform` percentage-of-`CANVAS_SIZE` math `art/sprite.js` (Task 6) uses to render stamps on the shelf. Undo covers both freehand strokes and stamp placements in one linear stack of tagged entries (`{type:'stroke', dataURL}` restored via `ctx.drawImage`, or `{type:'stamp'}` which just pops the last placed stamp and its DOM layer) — pushed on every `pointerdown` that starts a stroke, and on every stamp placement, respectively.

- [ ] **Step 1: Write `src/art/studio.js`**

```js
// Drawing studio: freehand body canvas (unchanged mechanics from the original prototype)
// plus stamps recorded as positional data instead of being baked into canvas pixels.
// Everything here takes `state` as an explicit argument or reads the live `state`
// import — never a hidden closure over a duplicated copy of the save data.
import { CANVAS_SIZE, BASE_STAMPS, UNLOCK_STAMPS, STAMP_SVG, STAMP_LABELS } from './stamps.js';
import { state } from '../state.js';

// Ported verbatim from ~/Documents/shelf-life.html (lines ~475-480). Studio-only concern:
// which brush colors are available at the shelf's current total bond.
export const BASE_COLORS = ['#1A1220', '#F2E9DC', '#FF8FB8', '#C94F7C', '#7FD8C0', '#3E9E86', '#F2B441', '#E0672F', '#A32C3C', '#8E6BD1', '#4A7FD1', '#6FBF4A', '#8A5A3B', '#9AA5AD'];
export const UNLOCK_COLORS = [
  { at: 10, colors: ['#39D6C0', '#FF5FA2', '#FFE066'], label: 'three loud colors' },
  { at: 30, colors: ['#B8FF5A', '#8C1BE0', '#00E5FF'], label: 'three colors that should not exist' },
  { at: 60, colors: ['#FF3B1F', '#0B0F45', '#E8D7FF'], label: 'the last three colors' }
];

// Pure function per the project's "state is an explicit first argument" rule. Computes
// total bond inline rather than importing engine/unlocks.js's totalBond(state) — that
// module is a parallel, not-yet-built task, and this is one line of harmless duplicated
// arithmetic rather than a backwards/circular dependency.
export function unlockedColors(state) {
  const bond = state.pets.reduce((n, p) => n + p.bond, 0);
  let out = BASE_COLORS.slice();
  UNLOCK_COLORS.forEach(u => { if (bond >= u.at) out = out.concat(u.colors); });
  return out;
}

// Mirrors unlockedColors' shape for stamp kinds. Not part of the module's export
// contract (only art/studio.js itself needs it to build the stamp picker), so it stays
// local rather than exported.
function unlockedStampKinds() {
  const bond = state.pets.reduce((n, p) => n + p.bond, 0);
  let out = BASE_STAMPS.slice();
  UNLOCK_STAMPS.forEach(u => { if (bond >= u.at) out = out.concat(u.stamps); });
  return out;
}

export function initStudio({ onSave }) {
  const studioVeil = document.getElementById('studioVeil');
  const pad = document.getElementById('pad');
  const stampLayer = document.getElementById('stampLayer');
  const swatchesWrap = document.getElementById('swatches');
  const sizeWrap = document.getElementById('sizes');
  const eraserChip = document.getElementById('eraserChip');
  const stampPickerWrap = document.getElementById('stamps');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const petName = document.getElementById('petName');
  const studioClose = document.getElementById('studioClose');
  const cancelPet = document.getElementById('cancelPet');
  const savePet = document.getElementById('savePet');

  const ctx = pad.getContext('2d');
  pad.width = CANVAS_SIZE;
  pad.height = CANVAS_SIZE;

  const brush = { color: BASE_COLORS[0], size: 16, erase: false, stamp: null };

  // Single linear undo history covering both freehand strokes and stamp placements,
  // oldest-to-newest, matching the original's single-stack single-button UX.
  //   { type: 'stroke', dataURL }  – canvas snapshot taken *before* the stroke started
  //   { type: 'stamp' }            – undoing just pops the last placed stamp
  let undoStack = [];

  // Placed stamps: plain data objects, never drawn onto the canvas. `stamps` is the
  // data (this is what becomes art.stamps on save); `stampEls` is the parallel array of
  // live preview DOM nodes in #stampLayer, kept in lockstep so undo can remove the right one.
  let stamps = [];
  let stampEls = [];

  let drawing = false;
  let lastPt = null;

  function padPos(e) {
    const r = pad.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (pad.width / r.width), y: (e.clientY - r.top) * (pad.height / r.height) };
  }

  function strokeTo(a, b) {
    ctx.globalCompositeOperation = brush.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brush.color;
    ctx.lineWidth = brush.size * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function pushStrokeUndo() {
    try { undoStack.push({ type: 'stroke', dataURL: pad.toDataURL() }); } catch (e) {}
    if (undoStack.length > 12) undoStack.shift();
  }

  // Same left/top/width/height/transform math art/sprite.js uses to place a stamp on the
  // shelf, so a stamp previewed here lands in the same relative spot once rendered small.
  function renderStampEl(s) {
    const el = document.createElement('div');
    el.className = 'sprite-stamp';
    el.style.left = (s.x / CANVAS_SIZE * 100) + '%';
    el.style.top = (s.y / CANVAS_SIZE * 100) + '%';
    const wh = (s.size * 2 / CANVAS_SIZE * 100) + '%';
    el.style.width = wh;
    el.style.height = wh;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.color = s.color;
    el.innerHTML = STAMP_SVG[s.kind] || '';
    return el;
  }

  function placeStamp(p) {
    const s = { kind: brush.stamp, x: p.x, y: p.y, size: brush.size * 1.7, rotation: 0, color: brush.color };
    stamps.push(s);
    undoStack.push({ type: 'stamp' });
    if (undoStack.length > 12) undoStack.shift();
    const el = renderStampEl(s);
    stampEls.push(el);
    stampLayer.appendChild(el);
  }

  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const p = padPos(e);
    if (brush.stamp) { placeStamp(p); return; }
    pushStrokeUndo();
    drawing = true;
    lastPt = p;
    strokeTo(p, p);
  });
  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = padPos(e);
    strokeTo(lastPt, p);
    lastPt = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { drawing = false; lastPt = null; }));

  sizeWrap.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    sizeWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    if (chip.dataset.erase) brush.erase = true;
    else { brush.erase = false; brush.size = Number(chip.dataset.size); }
  });

  undoBtn.addEventListener('click', () => {
    if (!undoStack.length) return;
    const entry = undoStack.pop();
    if (entry.type === 'stamp') {
      stamps.pop();
      const el = stampEls.pop();
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!entry.dataURL) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, pad.width, pad.height);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, pad.width, pad.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = entry.dataURL;
  });

  // "Start over" clears the freehand canvas only, exactly like the original prototype's
  // clearBtn — it does not remove already-placed stamps. See report/judgment-call notes.
  clearBtn.addEventListener('click', () => {
    pushStrokeUndo();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
  });

  function isEmpty() {
    const d = ctx.getImageData(0, 0, pad.width, pad.height).data;
    for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) return false;
    return true;
  }

  function padThumb() {
    const out = document.createElement('canvas');
    out.width = 320;
    out.height = 320;
    out.getContext('2d').drawImage(pad, 0, 0, 320, 320);
    return out.toDataURL('image/png');
  }

  // `unlockedBond` is accepted for contract-shape parity with the caller (main.js may
  // already have a fresh totalBond(state) on hand), but since `state` is imported live
  // here, rebuilding straight from `state` is always correct and avoids a second,
  // possibly-stale source of truth. See report for this judgment call.
  function rebuildPalette(unlockedBond) {
    swatchesWrap.innerHTML = '';
    unlockedColors(state).forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw';
      b.style.background = c;
      b.setAttribute('aria-pressed', c === brush.color ? 'true' : 'false');
      b.setAttribute('aria-label', 'Color ' + c);
      b.addEventListener('click', () => {
        brush.color = c;
        brush.erase = false;
        swatchesWrap.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        eraserChip.setAttribute('aria-pressed', 'false');
        const m = sizeWrap.querySelector('.chip[data-size="' + brush.size + '"]');
        if (m) m.setAttribute('aria-pressed', 'true');
      });
      swatchesWrap.appendChild(b);
    });
  }

  function rebuildStamps(unlockedBond) {
    stampPickerWrap.innerHTML = '';
    unlockedStampKinds().forEach(key => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = STAMP_LABELS[key];
      b.setAttribute('aria-pressed', brush.stamp === key ? 'true' : 'false');
      b.addEventListener('click', () => {
        const on = brush.stamp === key;
        stampPickerWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        brush.stamp = on ? null : key;
        b.setAttribute('aria-pressed', on ? 'false' : 'true');
      });
      stampPickerWrap.appendChild(b);
    });
  }

  function open(unlockedBond) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
    undoStack = [];
    stamps = [];
    stampEls = [];
    stampLayer.innerHTML = '';
    petName.value = '';
    brush.stamp = null;
    rebuildPalette(unlockedBond);
    rebuildStamps(unlockedBond);
    studioVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    studioVeil.classList.remove('open');
    document.body.style.overflow = '';
  }

  function isOpen() {
    return studioVeil.classList.contains('open');
  }

  studioClose.addEventListener('click', close);
  cancelPet.addEventListener('click', close);
  savePet.addEventListener('click', () => {
    if (isEmpty()) return;
    const art = { body: padThumb(), stamps: stamps.map(s => ({ ...s })) };
    const name = (petName.value || '').trim();
    onSave(art, name);
    close();
  });

  return { open, close, rebuildPalette, rebuildStamps, isOpen, isEmpty };
}
```

- [ ] **Step 2: Syntax-check (no DOM/canvas in `node:test`, so this replaces an automated test for this file)**

```bash
cd ~/shelf-life
node --check src/art/studio.js && echo "studio.js syntax OK"
```
Expected: prints `studio.js syntax OK`, no errors. Behavioral verification (draw, stamp, undo across both entry types, save, unlock-tier palette/stamp rebuild) happens in Task 16's manual browser smoke test once `main.js` exists to call `initStudio`.

- [ ] **Step 3: Commit**

```bash
cd ~/shelf-life
git add src/art/studio.js
git commit -m "Add art/studio.js: freehand body canvas + stamps as positional data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

---

### Task 4: content/copy.js + content/props.js + content/decor.js + content/mature.js

**Files:**
- Create: `src/content/copy.js`
- Create: `src/content/props.js`
- Create: `src/content/decor.js`
- Create: `src/content/mature.js`
- Test: `test/copy.test.mjs`

**Interfaces:**
- Produces: everything under `content/copy.js:`, `content/props.js:`, `content/decor.js:`, `content/mature.js:` in the Global contracts section above. `engine/tick.js`/`engine/care.js` (Task 8) read `NEED_LABEL`/`DECAY`/`COMPLAINTS`/`CARE_LINES`/`OVERFED`/`ASLEEP_LINES`; `engine/loop.js`/`engine/achievements.js` (Task 9) read `HAPPY_NOTES`/`EVENTS`/`GRUDGE_LINES`/`STREAK_LINES` and mix in `MATURE_*_EXTRA` from `content/mature.js` only when `state.settings.matureMode` is true; the pet-creation flow (Task 7/14) composes a bio as `pick(ORIGINS)+' '+pick(HABITS)+' '+trait.blurb+' '+pick(CLOSERS)` and falls back to `pick(FALLBACK_NAMES)` when no name is given; `ui/decorUI.js` (Task 13) reads `PROPS`/`PROP_ART`/`ROOMS`/`WALLS`/`WOODS`/`ACCENTS` to render the decorate sheet and prop tray.
- This is pure data — no imports needed in any of the four files.

Voice matches Task 3: deadpan, passive-aggressive, dark-comic, spooky-cute menace. Never graphic, never a real threat, never targeting real people, protected groups, or real mental-health conditions. `content/mature.js` is the sole opt-in exception to the profanity-free rule — its lines are additive extras (not replacements) and are only mixed into the base pools when the player has explicitly turned on Mature mode (off by default).

- [ ] **Step 1: Write `src/content/copy.js`**

Ports `NEED_LABEL`, `DECAY`, `COMPLAINTS`, `CARE_LINES`, `OVERFED`, `HAPPY_NOTES`, `ASLEEP_LINES`, `EVENTS`, `FALLBACK_NAMES`, `ORIGINS`, `HABITS`, `CLOSERS` from `~/Documents/shelf-life.html` lines 419-467, roughly doubling each pool and pushing `EVENTS` darker/weirder, then adds two new pools: `GRUDGE_LINES` (keyed by grudge escalation stage 1/2/3, `{n}` = pet name) and `STREAK_LINES` (`{d}` = consecutive check-in day count).

```js
/* ================= CARE COPY ================= */
export const NEED_LABEL = { food: 'Fed', fuss: 'Fussed', clean: 'Clean' };
export const DECAY = { food: 5.2, fuss: 4.4, clean: 3.4 };

export const COMPLAINTS = {
  food: {
    annoyed: [
      'Has not eaten. Is being brave about it.',
      'Asked when dinner is. Dinner was yesterday.',
      'Has been staring at the kitchen. Pointedly.',
      'Is chewing the shelf. Slowly. Meaningfully.',
      'Checked the bowl four times this hour. Optimism, mostly.',
      'Has started rationing. There was nothing to ration.',
      'Sighed audibly near the empty bowl.',
      'Says it is "not hungry, just disappointed." It is hungry.'
    ],
    furious: [
      'Has started eyeing the others.',
      'Says it will eat the shelf. It might.',
      'Ate something structural. You will find out which part later.',
      'Has drawn up a menu. The others are on it.',
      'Says hunger is temporary and grudges are forever.',
      'Has begun taking inventory of anything that could be food.',
      'Chewed through something that was not meant to be chewed.',
      'Has stopped asking. That is worse.',
      'Looked at your hand like it was an appetizer.',
      'Filed dinner under "unresolved." The file is thick.'
    ]
  },
  fuss: {
    annoyed: [
      'Waited by the door. You walked past twice.',
      'Says you have been busy. Says it in that voice.',
      'Has been sighing at a volume you were meant to hear.',
      'Asked the others whether you had mentioned it. You had not.',
      'Left a spot warm for you. You did not sit in it.',
      'Practiced a conversation with you that did not happen.',
      'Has started a countdown. It will not say to what.',
      'Watched the door for a while. The door did not open.'
    ],
    furious: [
      'Has stopped waiting. Wants you to know it stopped.',
      'Has decided it does not need anyone. It is lying.',
      'Turned to face the wall. It has been hours.',
      'Has written you out of something. There was nothing to be written out of.',
      'Says it is fine. Nothing about it is fine.',
      'Has unlearned your name on purpose.',
      'Practiced getting along without you. Badly.',
      'Told the others it never liked you anyway.',
      'Has drafted a goodbye it has no intention of sending. Yet.',
      'Stopped saving you a spot. The spot is gone now.'
    ]
  },
  clean: {
    annoyed: [
      'Something is growing on it. It has named the something.',
      'Is sticky and will not explain why.',
      'Left a mark. The mark is spreading.',
      'Has begun attracting flies. Considers them company.',
      'Smells faintly of something you cannot place. Yet.',
      'Has developed a texture. It is proud of the texture.',
      'Left a print somewhere it should not have been.',
      'Is collecting dust like it is a hobby.'
    ],
    furious: [
      'Has achieved a new texture. Do not touch it.',
      'Is no longer entirely one color.',
      'The shelf smells. It says that is not its problem.',
      'Something has moved in with it and started charging rent.',
      'You will need gloves. Possibly a bag.',
      'Has begun to shine, in a way that concerns everyone.',
      'Left a trail. The trail is still moving.',
      'Something under it has developed a heartbeat. Probably.',
      'Has stopped being a color and started being a warning.',
      'Requires a hazmat approach and a moment of silence.'
    ]
  }
};

export const CARE_LINES = {
  food: [
    'Ate. Said nothing.',
    'Ate it. Wanted a different one.',
    'Inhaled it. Looked at the bowl. Looked at you.',
    'Ate, then asked what the next one is.',
    'Chewed slowly while maintaining eye contact.',
    'Finished it in one bite and pretended it took longer.',
    'Ate half. Saved the rest. For spite, probably.',
    'Sniffed it first. Approved, reluctantly.',
    'Ate without looking away from the door.',
    'Licked the bowl clean and rated it "adequate."'
  ],
  fuss: [
    'Allowed it. Briefly.',
    'Pretended not to enjoy that.',
    'Leaned in. Will deny leaning in.',
    'Purred, then acted like nothing happened.',
    'Says it merely tolerated that. It did not merely tolerate that.',
    'Closed its eyes for exactly four seconds. A record.',
    'Let you get close. Filed it under "an exception."',
    'Made a small sound. Refuses to repeat it.',
    'Softened, visibly, then caught itself.',
    'Accepted the attention like it was doing you a favor.'
  ],
  clean: [
    'Tolerated the wipe. Barely.',
    'Is clean. Is furious about being clean.',
    'Smells like nothing now. It preferred smelling like something.',
    'Held very still. Made it weird.',
    'Watched you the entire time without blinking.',
    'Emerged pristine and immediately went looking for something to ruin that.',
    'Sat through it with the dignity of someone being wrongly arrested.',
    'Is shiny now. Resents being shiny.',
    'Allowed the cleaning under written protest. There is no writing. There is protest.',
    'Came out smelling like nothing, which it considers a personality loss.'
  ]
};

export const OVERFED = {
  food: [
    'Was not hungry. Ate anyway. Consequences pending.',
    'Turned it down. Nobody turns down food. Something is wrong.',
    'Is full. Took it anyway. For the stash.',
    'Ate out of spite, not hunger. Same result.',
    'Says it is stuffed. Is already eyeing the next one.',
    'Has reached capacity and kept going regardless.'
  ],
  fuss: [
    'Has had enough attention for one day.',
    'Wriggled away. You are the clingy one now.',
    'Says this is getting needy. It means you.',
    'Has had its fill of affection and is filing a complaint about the surplus.',
    'Requested space. Received it. Immediately missed the attention.',
    'Is overstimulated and blaming you for it, specifically.'
  ],
  clean: [
    'Is already clean. This is harassment.',
    'Was clean. Is now damp. Well done.',
    'Says you are scrubbing off its personality.',
    'Has been cleaned enough to lose a layer of mystique.',
    'Squeaks now. Did not squeak before. Does not want to discuss it.',
    'Is too clean to function and holds you personally responsible.'
  ]
};

export const HAPPY_NOTES = [
  'Everything is fine. It is suspicious about that.',
  'Has no complaints today and wants that noted as unusual.',
  'Sat on your thing. Considers this affection.',
  'Slept somewhere warm and will not admit whose fault that was.',
  'Is content. Do not make it weird.',
  'Said something almost nice, then took it back.',
  'Has decided to keep you. For now.',
  'Is in a good mood. The others find this unsettling.',
  'Hummed something. Stopped the second you noticed.',
  'Left the good spot for you. Will deny it was on purpose.',
  'Had a fine day and is furious about how fine it was.',
  'Smiled. It was brief. It happened.',
  'Told the others you are "acceptable." High praise, apparently.',
  'Napped in full view of everyone. Vulnerability, on its terms.',
  'Is, against all evidence and effort, happy.',
  'Kept a good mood going all day and blamed nobody for it, which is new.'
];

export const ASLEEP_LINES = [
  'Was asleep. Is now awake and unimpressed.',
  'You woke it. It will remember.',
  'It is daytime. It is nocturnal. Do the math.',
  'Opened one eye, closed it. That was your answer.',
  'Was mid-dream. You will never know about what. Neither will it.',
  'Grumbled something in its sleep. It was about you.',
  'Surfaced just enough to register the disappointment, then went back under.',
  'Is technically awake now. Emotionally, still asleep.'
];

export const EVENTS = [
  'Something fell off the shelf in the night. Nothing was near the edge.',
  'A tooth was found on the floor. Nobody is missing one.',
  'They were all facing the same direction this morning. Nobody moved them.',
  'There is one more shadow than there are pets. Probably the lighting.',
  'A name has been scratched into the wood. It is not one of theirs.',
  'The house was very quiet at 4am. Too quiet, according to three of them.',
  'Something has been buried in a houseplant. It is best left there.',
  'They have voted on something. The result was not shared with you.',
  'The pile of teeth is growing. They are calling it a collection.',
  'One of them was on the top shelf this morning. It cannot climb.',
  'Everyone was exactly one inch to the left. Every single one.',
  'A small hole has appeared in the wall. It is at their height.',
  'The clock in the other room stopped at the same time three nights running.',
  'Something was singing very quietly after midnight. It knew the words.',
  'A second set of small footprints appeared next to the usual ones. They stop mid-stride.',
  'Every mirror on the shelf was turned to face the wall this morning. Nobody will say who started it.',
  'There is a list taped under the shelf. Your name is on it twice.',
  'The temperature dropped for exactly six minutes at 3am. It has been noted.',
  'Something drew a door on the wall. It has no handle. Nobody has tried it. Yet.',
  'A jar that was empty last night is not empty anymore.',
  'They all went quiet at once, for no reason anyone will name.',
  'One of the shadows on the shelf does not match anything currently on the shelf.',
  'A single candle was lit and extinguished by morning. Nobody owns a lighter.',
  'Something has been counting. The counting stopped exactly at your name.'
];

/* ================= NAMING + BIO ================= */
export const FALLBACK_NAMES = [
  'Bartholomew', 'Gnash', 'Miss Teeth', 'Pudding', 'The Reverend', 'Snaggle', 'Doreen', 'Wretch',
  'Buttons', 'Mildew', 'Sir Nibbles', 'Grandma', 'Tuesday', 'Hex', 'Marshmallow', 'Custard',
  'The Landlord', 'Prudence', 'Gob', 'Winifred', 'Sock', 'Beverly', 'The Widow', 'Gravy',
  'Nubbins', 'Small Kevin', 'Aunt Vera', 'Chompy', 'Poultice', 'Dread Nancy', 'Bisque', 'Moth',
  'Gristle', 'Peaches', 'Uncle Bramble', 'Sister Margaret', 'The Auditor', 'Roach', 'Vellum',
  'Nubby', 'The Understudy', 'Cutlet', 'Miss Fortune', 'Gizzard', 'The Sublet', 'Old Nan',
  'Weevil', 'The Deposit', 'Corncob', 'Sourdough', 'The Notary', 'Bramwell', 'Mothball',
  'The Intern', 'Chives', 'Reverend Tuesday', 'Gnat', 'The Estate', 'Buttercream', 'Doily',
  'The Codicil', 'Sprocket', 'Aunt Ruth', 'Barnacle'
];

export const ORIGINS = [
  'Found at a yard sale in a town nobody names.',
  'Arrived in a box marked "do not".',
  'Traded for half a sandwich.',
  'Was in the walls. Now it is not.',
  'Came free with something else. That something is gone.',
  'Left on a porch. Not this porch.',
  'Won in a bet nobody remembers making.',
  'Was already here when you moved in.',
  'Rescued, allegedly.',
  'Fell out of a coat pocket. Not yours.',
  'Dug up, cleaned off, mostly.',
  'Returned to the store twice. Came back anyway.',
  'Inherited. The will was oddly specific about it.',
  'Found in a storage unit with the light still on.',
  'A gift from someone who moved away shortly afterward.',
  'Delivered to the wrong address. Kept anyway.',
  'Won at a raffle nobody remembers entering.',
  'Followed you home. You let it.',
  'Confiscated from a yard sale before it could be sold to someone worse.',
  'Appeared during a power outage. Has never explained the timing.',
  'Purchased "as is." As is turned out to be a lot.',
  'Was left in the mailbox with no note and no stamp.',
  'Emerged from a box marked FRAGILE. Was not fragile.',
  'Swapped for something you liked better at the time.',
  'Found under the porch, mid-argument with something unseen.',
  'Came with the apartment. The lease did not mention it.',
  'Salvaged from a dumpster behind somewhere that closed suddenly.',
  'Handed over by a stranger who seemed relieved to be rid of it.',
  'Turned up at the door during a storm and never left.',
  'Acquired in a trade that felt fair at the time.'
];

export const HABITS = [
  'Keeps its own hours.',
  'Answers to its name roughly half the time.',
  'Not for sale. It has made that clear.',
  'Prefers the left side of everything.',
  'Does not photograph well and knows it.',
  'Has strong opinions about the curtains.',
  'Sits where it likes, which is where you were.',
  'Will not be rushed.',
  'Holds grudges longer than it has been alive.',
  'Sleeps facing the door.',
  'Does not like being counted.',
  'Has never once been where you left it.',
  'Refuses to be photographed from the left.',
  'Counts things. Will not say what or why.',
  'Naps in fifteen-minute increments, on the hour, without fail.',
  'Has never once said thank you and never will.',
  'Keeps something hidden and checks on it nightly.',
  'Refuses all beverages except the one you are drinking.',
  'Insists on the last word, even when there is no argument.',
  'Has a designated sulking corner.',
  'Will not enter a room second.',
  'Tracks the weather better than any app.',
  'Only eats in front of an audience.',
  'Maintains a private feud with the vacuum cleaner.'
];

export const CLOSERS = [
  'Good luck.',
  'It has been very patient with you.',
  'Do not leave food out.',
  'Loved, technically.',
  'Ask it nothing after dark.',
  'Warranty void.',
  'Handle with mild suspicion.',
  'No refunds. It checked.',
  'Keep it away from the good curtains.',
  'It knows where you sleep. That is probably fine.',
  'Do not let it near the good yarn.',
  'It is watching you read this.',
  'Feed it on schedule. It is keeping track.',
  'You agreed to this. There are witnesses.',
  'It does not forgive. It archives.',
  'Batteries not included. There are no batteries.',
  'Terms and conditions apply, mostly to you.',
  'It has already decided how this ends.',
  'Store away from open flame and open arguments.',
  'This is now permanent. Congratulations, probably.'
];

/* ================= GRUDGES + STREAK ================= */
// Keyed by grudge escalation stage: 1 = mild (5+ grudges), 2 = serious (12+), 3 = terminal (20+).
export const GRUDGE_LINES = {
  1: [
    '{n} has started a list with your name at the top.',
    "{n} moved your things two inches to the left. Just to see if you'd notice.",
    '{n} is being extremely polite to you. This is not a good sign.',
    '{n} has stopped making eye contact. It is on purpose.',
    '{n} left something unpleasant exactly where you would find it.',
    '{n} has begun referring to you in the third person while you are in the room.'
  ],
  2: [
    '{n} has recruited two others against you. You are the last to know.',
    '{n} has stopped eating in front of you. It eats fine when you leave.',
    '{n} has drawn up something that looks a lot like a formal grievance, with your name on it.',
    '{n} rearranged the shelf overnight so nothing faces you.',
    '{n} has been telling the others a version of events that is not flattering to you.',
    '{n} has taken something of yours and is not hiding it especially well.'
  ],
  3: [
    '{n} has stopped speaking to you entirely. The silence has a schedule.',
    '{n} has named a small, ominous jar after you. Nobody knows what is in the jar.',
    '{n} held a ceremony. You were not invited, but you were definitely the subject.',
    '{n} has begun leaving notes that are just your name, underlined, with no further explanation.',
    '{n} has started keeping a shrine. It is not a nice shrine.',
    '{n} is being suspiciously, aggressively kind to you now. This is the worst sign yet.'
  ]
};

// {d} = consecutive check-in day count.
export const STREAK_LINES = [
  "Oh. You're back. Day {d}.",
  'Day {d}. They noticed. They will not say they noticed.',
  '{d} days running. Somewhere between habit and hostage situation.',
  'Day {d} of you showing up. Nobody is impressed. Everybody noticed.',
  '{d} days. That is either dedication or a controlled experiment. Unclear which.',
  'Back again. Day {d}. The shelf keeps better records than you do.',
  'Day {d}. This is either the beginning of something or a very long habit.',
  '{d} days straight. They have started to expect you, which is worse than needing you.',
  'Day {d}. Somewhere, quietly, this is being counted as loyalty.',
  '{d} days. Nobody said it out loud, but they would miss you. Do not bring this up.'
];
```

- [ ] **Step 2: Write `src/content/props.js`**

Ports all 12 original props (`bowl`, `tub`, `lamp`, `yarn`, `musicbox`, `candle`, `fern`, `mirror`, `skull`, `coffinbed`, `bell`, `globe`) with their exact `aura`/`at` mechanical values and SVG art from `~/Documents/shelf-life.html` lines 489-570, then adds 4 new props in the same shape (`trophy`, `board`, `box`, `plant`) with matching hand-drawn-style `PROP_ART` SVGs on the same `viewBox="0 0 60 60"` convention.

```js
/* ================= PROPS =================
   Every SVG uses a fixed 0 0 60 60 viewBox (same convention as the original canvas-era
   props), with themeable parts referencing CSS custom properties (var(--wood),
   var(--wood-lip), var(--pink), var(--amber), var(--mint), var(--blood)) so the room/
   wood/accent decor palette re-tints them automatically. */
export const PROP_ART = {
  bowl: '<svg viewBox="0 0 60 60"><ellipse cx="30" cy="34" rx="20" ry="6" fill="var(--wood-lip)"/><path d="M10 34a20 12 0 0 0 40 0z" fill="var(--wood)"/><ellipse cx="30" cy="33" rx="14" ry="4" fill="var(--amber)"/></svg>',
  tub: '<svg viewBox="0 0 60 60"><rect x="10" y="26" width="40" height="20" rx="9" fill="#B9C6CC"/><rect x="14" y="29" width="32" height="9" rx="4" fill="var(--mint)"/><rect x="14" y="46" width="5" height="6" fill="#8A979D"/><rect x="41" y="46" width="5" height="6" fill="#8A979D"/></svg>',
  lamp: '<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="17" fill="var(--amber)" opacity=".22"/><path d="M18 26h24l-6-13H24z" fill="var(--amber)"/><rect x="28" y="26" width="4" height="20" fill="#8A7A5A"/><ellipse cx="30" cy="47" rx="11" ry="4" fill="#6E6046"/></svg>',
  yarn: '<svg viewBox="0 0 60 60"><circle cx="30" cy="33" r="15" fill="var(--pink)"/><path d="M18 27c8 6 16 8 24 4M17 36c9 5 19 5 26-2M22 44c6 3 13 2 18-2" stroke="rgba(0,0,0,.28)" stroke-width="2" fill="none"/></svg>',
  musicbox: '<svg viewBox="0 0 60 60"><rect x="12" y="30" width="36" height="17" rx="2" fill="#7A4C2B"/><path d="M12 30l6-8h30l-6 8z" fill="#98603A"/><circle cx="42" cy="20" r="3" fill="var(--bone-dim)"/><path d="M42 20v-7h6" stroke="var(--bone-dim)" stroke-width="2" fill="none"/></svg>',
  candle: '<svg viewBox="0 0 60 60"><path d="M30 8c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="var(--amber)"/><rect x="24" y="24" width="12" height="22" fill="#2B2430"/><ellipse cx="30" cy="46" rx="11" ry="4" fill="#514659"/></svg>',
  fern: '<svg viewBox="0 0 60 60"><path d="M30 40c-2-12-10-18-18-20 4 12 8 18 18 20zM30 40c2-12 10-18 18-20-4 12-8 18-18 20z" fill="#3E7A4A"/><path d="M18 40h24l-3 12H21z" fill="#8A5A3B"/></svg>',
  mirror: '<svg viewBox="0 0 60 60"><ellipse cx="30" cy="28" rx="16" ry="21" fill="#B9C6CC"/><ellipse cx="30" cy="28" rx="12" ry="17" fill="#D8E3E7"/><path d="M24 12l6 14-5 8 8 12" stroke="#8A979D" stroke-width="1.6" fill="none"/><rect x="26" y="48" width="8" height="6" fill="var(--wood)"/></svg>',
  skull: '<svg viewBox="0 0 60 60"><path d="M30 12c11 0 17 8 17 16 0 6-3 9-3 13 0 3-5 5-14 5s-14-2-14-5c0-4-3-7-3-13 0-8 6-16 17-16z" fill="#E8E0CE"/><ellipse cx="23" cy="30" rx="5" ry="6" fill="#2B2028"/><ellipse cx="37" cy="30" rx="5" ry="6" fill="#2B2028"/><path d="M30 36l-3 6h6z" fill="#2B2028"/></svg>',
  coffinbed: '<svg viewBox="0 0 60 60"><path d="M22 22h16l7 12-7 14H22l-7-14z" fill="#4B3350"/><path d="M25 26h10l5 8-5 10H25l-5-10z" fill="var(--pink)" opacity=".55"/></svg>',
  bell: '<svg viewBox="0 0 60 60"><rect x="14" y="44" width="32" height="6" rx="2" fill="var(--wood)"/><path d="M18 44V30a12 12 0 0 1 24 0v14z" fill="#CFE0E5" opacity=".55" stroke="#A9BEC4" stroke-width="1.5"/><circle cx="30" cy="38" r="5" fill="var(--blood)" opacity=".8"/></svg>',
  globe: '<svg viewBox="0 0 60 60"><rect x="18" y="43" width="24" height="7" rx="2" fill="#5A3A46"/><circle cx="30" cy="29" r="16" fill="#CFE0E5" opacity=".5" stroke="#A9BEC4" stroke-width="1.5"/><circle cx="24" cy="24" r="1.6" fill="#fff"/><circle cx="34" cy="30" r="1.6" fill="#fff"/><circle cx="29" cy="36" r="1.6" fill="#fff"/><circle cx="36" cy="21" r="1.4" fill="#fff"/></svg>',
  trophy: '<svg viewBox="0 0 60 60"><path d="M18 46l12 6 12-6-4-14H22z" fill="var(--wood)"/><ellipse cx="30" cy="26" rx="10" ry="9" fill="#C9B79A"/><path d="M22 20l-6-10M38 20l6-10M20 16l-8-6M40 16l8-6" stroke="#8A7A5A" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="26" cy="25" r="1.6" fill="#2B2028"/><circle cx="34" cy="25" r="1.6" fill="#2B2028"/></svg>',
  board: '<svg viewBox="0 0 60 60"><rect x="10" y="14" width="40" height="30" rx="2" fill="#241833"/><path d="M14 40a16 16 0 0 1 32 0" stroke="var(--amber)" stroke-width="1.4" fill="none"/><circle cx="18" cy="24" r="1.4" fill="var(--amber)"/><circle cx="24" cy="19" r="1.4" fill="var(--amber)"/><circle cx="30" cy="17" r="1.4" fill="var(--amber)"/><circle cx="36" cy="19" r="1.4" fill="var(--amber)"/><circle cx="42" cy="24" r="1.4" fill="var(--amber)"/><path d="M22 34l8-6 8 6-4 8h-8z" fill="var(--blood)" opacity=".7"/><circle cx="30" cy="33" r="2.4" fill="#F2E9DC"/></svg>',
  box: '<svg viewBox="0 0 60 60"><rect x="14" y="26" width="32" height="22" rx="2" fill="var(--wood)"/><rect x="21" y="20" width="18" height="7" rx="1" fill="var(--wood-lip)"/><rect x="24" y="16" width="3" height="10" fill="#F2E9DC"/><rect x="29" y="14" width="3" height="12" fill="#F2E9DC"/><rect x="34" y="17" width="3" height="9" fill="#F2E9DC"/><rect x="20" y="48" width="20" height="3" fill="#3A2A20"/></svg>',
  plant: '<svg viewBox="0 0 60 60"><path d="M30 40c-1-10-6-16-13-19 2 3 4 9 7 13-3 1-6 0-9-2 3 6 9 9 15 8z" fill="#3E7A4A"/><path d="M30 40c1-11 7-17 15-19-3 4-5 10-8 14 3 0 6-1 8-3-4 6-9 9-15 8z" fill="#345F3B"/><ellipse cx="27" cy="30" rx="2" ry="3" fill="var(--blood)" opacity=".6"/><rect x="21" y="40" width="18" height="10" rx="2" fill="var(--wood)"/><path d="M22 50q8 4 16 0" stroke="#2B2028" stroke-width="1" fill="none" opacity=".4"/></svg>'
};

export const PROPS = {
  bowl: { name: 'Snack Bowl', at: 0, aura: { food: 0.62 }, desc: 'Neighbors get hungry more slowly.',
    lines: ['{p} has been at the bowl again. The bowl is empty again.', '{p} says it did not touch the bowl. The bowl disagrees.', '{p} guarded the bowl all night. From nobody.'],
    ambient: ['The bowl was full this morning. It is not now.', 'Something has been licked clean. Twice.'] },
  tub: { name: 'Tin Bathtub', at: 0, aura: { clean: 0.58 }, desc: 'Neighbors stay clean longer.',
    lines: ['{p} got in the tub voluntarily. Everyone is unsettled.', '{p} bathed and has been insufferable since.', '{p} refused the tub, then used it at 3am when nobody was looking.'],
    ambient: ['The water in the tub has changed color. Nobody will say why.', 'There are wet prints leading away from the tub and none leading back.'] },
  lamp: { name: 'Dim Lamp', at: 0, aura: { fuss: 0.8 }, desc: 'A little company. Nocturnal pets resent it.',
    lines: ['{p} sat under the lamp for hours doing nothing.', '{p} has claimed the lamp. There is no sharing arrangement.', '{p} says the light is fine. {p} moved it two inches anyway.'],
    ambient: ['The lamp flickered at the same time three nights running.', 'The bulb is warm and nobody has touched it.'] },
  yarn: { name: 'Ball of Yarn', at: 0, aura: { fuss: 0.75 }, desc: 'Something to destroy. Keeps boredom down.',
    lines: ['{p} unraveled the whole thing and blamed the room.', '{p} has been wrestling the yarn since Tuesday. The yarn is winning.', '{p} tied something up with the yarn. It will not say what.'],
    ambient: ['The yarn is in a different room. Nobody carried it there.', 'There is a string running under the shelf. It leads somewhere.'] },
  musicbox: { name: 'Music Box', at: 6, aura: { fuss: 0.62 }, desc: 'Keeps everyone entertained. Mostly.',
    lines: ['{p} wound the music box and sat through the whole thing.', '{p} plays it on repeat. The others have asked it to stop.', '{p} says the tune has words. It sang them once. Once.'],
    ambient: ['The music box played for eleven seconds at 4am.', 'The lid was closed. It is open now.'] },
  candle: { name: 'Black Candle', at: 6, aura: {}, desc: 'No practical use. They love it.',
    lines: ['{p} has been staring into the candle for two hours.', '{p} lit the candle. Nobody gave it matches.', '{p} says the flame leans toward whoever is lying.'],
    ambient: ['The candle is shorter than it was and has never been lit.', 'Wax has run in a straight line toward the door.'] },
  fern: { name: 'Suspicious Fern', at: 12, aura: { clean: 1.22 }, desc: 'Lovely. Also, things get buried in it.',
    lines: ['{p} buried something in the fern. The fern is thriving.', '{p} has been talking to the fern. The fern has been listening.', '{p} says the fern moved. The fern did move.'],
    ambient: ['The soil has been disturbed again.', 'The fern has grown noticeably since last week. Nobody waters it.'] },
  mirror: { name: 'Cracked Mirror', at: 12, aura: { fuss: 1.18 }, desc: 'Beautiful. Makes everyone slightly worse.',
    lines: ['{p} spent an hour at the mirror and came back different.', '{p} says its reflection blinked first.', '{p} has stopped using the mirror. It will not explain.'],
    ambient: ['The crack is longer today.', 'Something moved in the mirror while the shelf was empty.'] },
  skull: { name: 'Uncle', at: 20, aura: {}, desc: 'A small skull. He came with the house.',
    lines: ['{p} has been telling Uncle about your day.', '{p} moved Uncle so he faces the door. Uncle prefers it.', '{p} says Uncle agrees with it. Uncle has no comment.'],
    ambient: ['Uncle is facing a different way.', 'Uncle was on the top shelf this morning.'] },
  coffinbed: { name: 'Coffin Bed', at: 20, aura: { food: 0.85, fuss: 0.82, clean: 0.85 }, desc: 'Very comfortable. Slows everything down a little.',
    lines: ['{p} slept fourteen hours and woke up rude.', '{p} will not get out of the bed. It has been days.', '{p} has started charging others to nap in it.'],
    ambient: ['The bed was made this morning. Nobody makes the bed.', 'There is a dent in the pillow and everyone is accounted for.'] },
  bell: { name: 'Bell Jar', at: 32, aura: { clean: 0.68 }, desc: 'Keeps the dust off. Keeps other things in.',
    lines: ['{p} got under the bell jar and would not come out.', '{p} put something under the jar. It is best left there.', '{p} taps the glass whenever it walks past.'],
    ambient: ['The jar has fogged from the inside.', 'Whatever is under the jar has moved to the other side.'] },
  globe: { name: 'Snow Globe', at: 32, aura: {}, desc: 'Purely decorative. They are obsessed with it.',
    lines: ['{p} shook the globe forty times in a row.', '{p} says there is somebody in the globe. There is a small figure in the globe.', '{p} watched the snow settle and then did it again.'],
    ambient: ['The snow in the globe is still falling. It has been hours.', 'The little figure is facing outward now.'] },
  trophy: { name: 'Taxidermy Trophy', at: 40, aura: {}, desc: 'A little menace for the shelf. Nobody asks where it came from.',
    lines: ['{p} has been talking shop with the trophy. Career advice, probably.', '{p} salutes the trophy every morning. The trophy does not salute back.', '{p} asked what happened to the rest of it. Nobody answered.'],
    ambient: ['The trophy is facing a different direction than it was yesterday.', 'Something about the trophy is looking fresher than taxidermy should.'] },
  board: { name: 'Spirit Board', at: 40, aura: {}, desc: 'No practical use. They ask it things anyway.',
    lines: ['{p} asked the board a yes-or-no question. It answered in cursive.', '{p} spent an hour on the board and came back oddly formal.', '{p} says the board is "just for fun." The board disagrees.'],
    ambient: ['The planchette has moved two inches since last night.', 'Someone has been asking questions. The board has been answering.'] },
  box: { name: 'Complaint Box', at: 50, aura: { fuss: 0.66 }, desc: 'Give them somewhere to file it. They complain less everywhere else.',
    lines: ['{p} filed something in the box. The box is nearly full.', '{p} checks the box daily for a response. There is no response.', '{p} has started filing complaints about the box itself.'],
    ambient: ['The box is heavier than it should be for how few papers are in it.', 'A slip of paper worked its way out overnight. Nobody wrote it down again.'] },
  plant: { name: 'Weeping Fig', at: 50, aura: { clean: 0.7 }, desc: 'Thrives on grime nobody can identify. Neighbors stay tidier near it.',
    lines: ['{p} has been crying near the fig. The fig started it.', '{p} waters the fig with something that is not water.', '{p} insists the fig "understands" it. Concerning, either way.'],
    ambient: ['The soil is damp in a way the plant should not need.', 'The fig has grown noticeably overnight. Nobody waters it that well.'] }
};
```

- [ ] **Step 3: Write `src/content/decor.js`**

Ports `ROOMS`, `WALLS`, `WOODS`, `ACCENTS` verbatim from `~/Documents/shelf-life.html` lines 489-497 — no expansion needed, faithful porting only.

```js
/* ================= DECOR CATALOGS =================
   Ported verbatim from the original prototype (~/Documents/shelf-life.html lines 489-497). */
export const ROOMS = {
  aubergine: { name: 'Aubergine', swatch: '#33203D', vars: { '--room-a': '#33203D', '--room-b': '#1A1220', '--panel-a': '#2C1D35', '--panel-b': '#241830', '--line': '#4A3557', '--rule': '#3A2A47', '--surface': '#241833', '--surface-hi': '#372748', '--field': '#1C1327', '--bone': '#F2E9DC', '--bone-dim': '#C9BCAE', '--wall-ink': 'rgba(242,233,220,.14)' } },
  mortuary: { name: 'Mortuary Mint', swatch: '#8FB5A4', vars: { '--room-a': '#A8C9B9', '--room-b': '#7FA492', '--panel-a': '#E4EDE4', '--panel-b': '#D2E0D4', '--line': '#8CA697', '--rule': '#A9BFB0', '--surface': '#DCE7DD', '--surface-hi': '#CBDACD', '--field': '#EDF3ED', '--bone': '#23302A', '--bone-dim': '#4E6357', '--wall-ink': 'rgba(30,50,40,.12)' } },
  nursery: { name: 'Haunted Nursery', swatch: '#D9A7B0', vars: { '--room-a': '#E7BFC6', '--room-b': '#C08D98', '--panel-a': '#F3E2E4', '--panel-b': '#E5CED3', '--line': '#B98F98', '--rule': '#CFA9B1', '--surface': '#EEDCDF', '--surface-hi': '#E2C8CD', '--field': '#F7ECEE', '--bone': '#33202A', '--bone-dim': '#61454F', '--wall-ink': 'rgba(60,30,40,.12)' } },
  basement: { name: 'Blacklight Basement', swatch: '#1B0B2E', vars: { '--room-a': '#2E0F52', '--room-b': '#0C0616', '--panel-a': '#1D0C33', '--panel-b': '#130823', '--line': '#4A208A', '--rule': '#33146B', '--surface': '#1C0B34', '--surface-hi': '#2C1252', '--field': '#150826', '--bone': '#E8DBFF', '--bone-dim': '#A98FD4', '--wall-ink': 'rgba(180,120,255,.16)' } },
  parlor: { name: 'Bone Parlor', swatch: '#E8DFCE', vars: { '--room-a': '#F4EDDF', '--room-b': '#DCD2BE', '--panel-a': '#EFE7D6', '--panel-b': '#E2D8C4', '--line': '#BCAE95', '--rule': '#CFC3AB', '--surface': '#E7DECB', '--surface-hi': '#DBD0B9', '--field': '#F6F1E5', '--bone': '#2B2318', '--bone-dim': '#5D5241', '--wall-ink': 'rgba(60,48,30,.10)' } },
  midnight: { name: 'Midnight', swatch: '#0E1526', vars: { '--room-a': '#17233F', '--room-b': '#080C16', '--panel-a': '#131C31', '--panel-b': '#0C1322', '--line': '#2C3D63', '--rule': '#22314F', '--surface': '#141E36', '--surface-hi': '#1F2C4B', '--field': '#0F1728', '--bone': '#DDE6F5', '--bone-dim': '#93A3C2', '--wall-ink': 'rgba(190,210,255,.12)' } }
};

export const WALLS = { none: 'Bare', stripes: 'Stripes', dots: 'Dots', grid: 'Grid', web: 'Cobwebs', diamond: 'Diamonds' };

export const WOODS = {
  rosewood: { name: 'Rosewood', wood: '#5C3A47', lip: '#7A4C5B' },
  charcoal: { name: 'Charcoal', wood: '#2F2E33', lip: '#474650' },
  bone: { name: 'Bone', wood: '#CFC3AC', lip: '#E6DCC8' },
  bubblegum: { name: 'Bubblegum', wood: '#C4708F', lip: '#E28FAC' },
  moss: { name: 'Moss', wood: '#44573F', lip: '#5E7455' },
  oxblood: { name: 'Oxblood', wood: '#5A1E23', lip: '#7A2C33' },
  gilt: { name: 'Gilt', wood: '#8A6B22', lip: '#C4972F' }
};

export const ACCENTS = {
  bubblegum: { name: 'Bubblegum', c: '#FF8FB8' },
  mint: { name: 'Mint', c: '#7FD8C0' },
  amber: { name: 'Amber', c: '#F2B441' },
  blood: { name: 'Blood', c: '#C4414F' },
  violet: { name: 'Violet', c: '#B183F0' },
  acid: { name: 'Acid', c: '#B8E634' }
};
```

- [ ] **Step 4: Write `src/content/mature.js`**

Opt-in extra-profane lines mixed into the normal `content/copy.js` pools by `engine/loop.js` only when `state.settings.matureMode` is true (default OFF, explicit toggle in the UI). Real mild-to-moderate profanity for comedic emphasis, in the same deadpan voice — not slurs, not sexual content, not targeting real people or protected groups.

```js
/* ================= MATURE MODE OVERLAY =================
   Opt-in extra lines mixed into the normal copy.js pools by engine/loop.js only when
   state.settings.matureMode is true (default OFF, explicit toggle in the UI). Mild-to-
   moderate profanity for comedic emphasis, same deadpan "small monster with a grudge"
   voice as the rest of the content — never slurs, never targeting real people or
   protected groups, never sexual content. These are additions, not replacements. */

export const MATURE_COMPLAINTS_EXTRA = {
  food: [
    'Says the bowl is empty and this is bullshit, frankly.',
    'Is hungry as hell and taking it personally.',
    'Announced, loudly, that this is "some shit," regarding dinner.',
    'Has decided starvation is your fault specifically, goddammit.',
    'Said "where the hell is dinner" in a voice clearly meant to be heard.',
    'Is one skipped meal away from eating something it will regret, and does not give a damn.'
  ],
  fuss: [
    'Says you have been a real ass about the attention thing lately.',
    'Is done waiting around like some kind of idiot, and said so.',
    'Muttered "screw this" and turned to face the wall.',
    'Has decided you do not give a damn, and is telling everyone.',
    'Called the whole situation bullshit and went to sulk about it professionally.',
    'Called you a stubborn bitch. Fondly. Ish.'
  ],
  clean: [
    'Smells like actual hell and has strong feelings about being told so.',
    'Says the mess is not that bad, which is a flat-out lie.',
    'Has gone full swamp creature and is weirdly proud of it, the little shit.',
    'Is sticky as hell and blaming the room for it.',
    'Says cleaning is bullshit and dignity is optional anyway.',
    'Has achieved a smell that could be legally classified as a weapon, goddamn it.'
  ]
};

export const MATURE_HAPPY_EXTRA = [
  'Had a genuinely good day and is pissed about how good it was.',
  'Admitted, once, quietly, that today did not suck.',
  'Said "fine, this is actually pretty damn nice" and immediately regretted saying it out loud.',
  'Is in a good mood and daring anyone to say a goddamn word about it.',
  "Told the mirror you're \"not the worst,\" which, for this one, is basically a love letter.",
  'Had a decent day and is furious there is no one to blame for that.',
  'Said today "didn\'t completely suck," which is the nicest thing it has said all month.'
];

export const MATURE_EVENTS_EXTRA = [
  'Someone wrote "this shelf is bullshit" on the wall in something that is hopefully paint.',
  'A voice at 3am said one word, clearly, and the word was profane. Nobody claimed it.',
  'Something knocked a single item off the shelf and left a note that just said "oops, my bad."',
  'There was swearing in the walls last night. Confirmed by three witnesses. Denied by all three in the morning.',
  'A jar labeled "do not open, for fuck\'s sake" has appeared. It has not been opened. Yet.',
  'Someone held a small, profane funeral for a dropped snack.',
  'Something scratched a single curse word into the underside of the shelf. Spelling questionable. Sentiment clear.'
];

export const MATURE_GRUDGE_EXTRA = {
  1: [
    '{n} called you a little bit of an ass under its breath.',
    '{n} muttered "screw this guy" and went back to what it was doing.',
    '{n} said this whole thing was bullshit and wrote it down anyway.',
    '{n} is giving you the silent treatment and swearing about it internally, loudly.',
    '{n} said "damn it" at you specifically, which is new.',
    '{n} has started a list. The list has a swear word for a title.'
  ],
  2: [
    '{n} told the others you\'re "kind of an asshole about this," and they agreed.',
    '{n} said, flatly, "I\'m done with this shit," and rearranged the shelf to prove it.',
    '{n} has recruited backup and used a lot of profanity doing it.',
    '{n} left a note that just says "screw you" and walked away, satisfied.',
    '{n} is telling everyone within earshot that you\'re "the actual worst," with feeling.',
    '{n} filed a complaint that opens with "this is bullshit" and gets worse from there.'
  ],
  3: [
    '{n} has a jar with your name on it and a label that says "for later, you bastard."',
    '{n} held a small, extremely profane ceremony and you were definitely the subject.',
    '{n} said, very calmly, "I am not going to swear about this," and then swore about it at length.',
    '{n} has started being suspiciously nice, and every kindness comes with a muttered "for now."',
    '{n} wrote your name on something in what might be permanent marker, might be worse, and added "asshole" underneath.',
    '{n} has stopped yelling entirely, which everyone agrees is the scariest goddamn thing it has ever done.'
  ]
};
```

- [ ] **Step 5: Write `test/copy.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEED_LABEL, DECAY, COMPLAINTS, CARE_LINES, OVERFED, HAPPY_NOTES,
  ASLEEP_LINES, EVENTS, FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS,
  GRUDGE_LINES, STREAK_LINES
} from '../src/content/copy.js';
import { PROPS, PROP_ART } from '../src/content/props.js';
import { ROOMS, WALLS, WOODS, ACCENTS } from '../src/content/decor.js';
import {
  MATURE_COMPLAINTS_EXTRA, MATURE_HAPPY_EXTRA, MATURE_EVENTS_EXTRA, MATURE_GRUDGE_EXTRA
} from '../src/content/mature.js';

const NEEDS = ['food', 'fuss', 'clean'];

test('NEED_LABEL and DECAY have the three need keys with the right shapes', () => {
  NEEDS.forEach(k => {
    assert.equal(typeof NEED_LABEL[k], 'string');
    assert.ok(NEED_LABEL[k].length > 0);
    assert.equal(typeof DECAY[k], 'number');
    assert.ok(DECAY[k] > 0);
  });
  assert.equal(DECAY.food, 5.2);
  assert.equal(DECAY.fuss, 4.4);
  assert.equal(DECAY.clean, 3.4);
});

test('COMPLAINTS has annoyed/furious pools per need, each at/above the size floor', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(COMPLAINTS[k].annoyed) && COMPLAINTS[k].annoyed.length >= 8, `${k}.annoyed too small`);
    assert.ok(Array.isArray(COMPLAINTS[k].furious) && COMPLAINTS[k].furious.length >= 10, `${k}.furious too small`);
    COMPLAINTS[k].annoyed.concat(COMPLAINTS[k].furious).forEach(line => {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    });
  });
});

test('CARE_LINES has >=10 lines per need', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(CARE_LINES[k]) && CARE_LINES[k].length >= 10, `CARE_LINES.${k} too small`);
  });
});

test('OVERFED has >=6 lines per need', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(OVERFED[k]) && OVERFED[k].length >= 6, `OVERFED.${k} too small`);
  });
});

test('HAPPY_NOTES, ASLEEP_LINES, EVENTS meet their size floors', () => {
  assert.ok(HAPPY_NOTES.length >= 16, `HAPPY_NOTES too small: ${HAPPY_NOTES.length}`);
  assert.ok(ASLEEP_LINES.length >= 8, `ASLEEP_LINES too small: ${ASLEEP_LINES.length}`);
  assert.ok(EVENTS.length >= 24, `EVENTS too small: ${EVENTS.length}`);
});

test('bio-composition pools meet their size floors and are non-empty strings', () => {
  assert.ok(FALLBACK_NAMES.length >= 30, `FALLBACK_NAMES too small: ${FALLBACK_NAMES.length}`);
  assert.ok(ORIGINS.length >= 30, `ORIGINS too small: ${ORIGINS.length}`);
  assert.ok(HABITS.length >= 24, `HABITS too small: ${HABITS.length}`);
  assert.ok(CLOSERS.length >= 20, `CLOSERS too small: ${CLOSERS.length}`);
  [FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS].forEach(pool => {
    pool.forEach(line => {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    });
  });
});

test('GRUDGE_LINES has keys 1/2/3, each with >=5 lines using {n}', () => {
  [1, 2, 3].forEach(stage => {
    const pool = GRUDGE_LINES[stage];
    assert.ok(Array.isArray(pool) && pool.length >= 5, `GRUDGE_LINES[${stage}] too small`);
    pool.forEach(line => assert.ok(line.includes('{n}'), `missing {n} in: ${line}`));
  });
});

test('STREAK_LINES has >=8 entries, all including {d}', () => {
  assert.ok(STREAK_LINES.length >= 8, `STREAK_LINES too small: ${STREAK_LINES.length}`);
  STREAK_LINES.forEach(line => assert.ok(line.includes('{d}'), `missing {d} in: ${line}`));
});

test('PROPS has >=16 entries, each with a matching PROP_ART entry and the required shape', () => {
  const ids = Object.keys(PROPS);
  assert.ok(ids.length >= 16, `expected >=16 props, got ${ids.length}`);
  ids.forEach(id => {
    const p = PROPS[id];
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.at, 'number');
    assert.equal(typeof p.aura, 'object');
    assert.equal(typeof p.desc, 'string');
    assert.ok(Array.isArray(p.lines) && p.lines.length > 0, `${id} needs lines`);
    assert.ok(Array.isArray(p.ambient) && p.ambient.length > 0, `${id} needs ambient`);
    assert.ok(PROP_ART[id] && PROP_ART[id].includes('<svg'), `missing/invalid PROP_ART for ${id}`);
    assert.ok(PROP_ART[id].includes('viewBox="0 0 60 60"'), `PROP_ART.${id} should use the 0 0 60 60 viewBox convention`);
  });
});

test('ROOMS/WALLS/WOODS/ACCENTS are non-empty objects with the expected sub-shapes', () => {
  assert.ok(Object.keys(ROOMS).length > 0, 'ROOMS is empty');
  Object.values(ROOMS).forEach(r => {
    assert.equal(typeof r.name, 'string');
    assert.equal(typeof r.swatch, 'string');
    assert.equal(typeof r.vars, 'object');
    assert.ok(Object.keys(r.vars).length > 0);
  });
  assert.ok(Object.keys(WALLS).length > 0, 'WALLS is empty');
  Object.values(WALLS).forEach(v => assert.equal(typeof v, 'string'));

  assert.ok(Object.keys(WOODS).length > 0, 'WOODS is empty');
  Object.values(WOODS).forEach(w => {
    assert.equal(typeof w.name, 'string');
    assert.equal(typeof w.wood, 'string');
    assert.equal(typeof w.lip, 'string');
  });

  assert.ok(Object.keys(ACCENTS).length > 0, 'ACCENTS is empty');
  Object.values(ACCENTS).forEach(a => {
    assert.equal(typeof a.name, 'string');
    assert.equal(typeof a.c, 'string');
  });
});

test('mature-mode overlay pools meet their size floors', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(MATURE_COMPLAINTS_EXTRA[k]) && MATURE_COMPLAINTS_EXTRA[k].length >= 6, `MATURE_COMPLAINTS_EXTRA.${k} too small`);
  });
  assert.ok(MATURE_HAPPY_EXTRA.length >= 6, `MATURE_HAPPY_EXTRA too small: ${MATURE_HAPPY_EXTRA.length}`);
  assert.ok(MATURE_EVENTS_EXTRA.length >= 6, `MATURE_EVENTS_EXTRA too small: ${MATURE_EVENTS_EXTRA.length}`);
  [1, 2, 3].forEach(stage => {
    const pool = MATURE_GRUDGE_EXTRA[stage];
    assert.ok(Array.isArray(pool) && pool.length >= 6, `MATURE_GRUDGE_EXTRA[${stage}] too small`);
    pool.forEach(line => assert.ok(line.includes('{n}'), `missing {n} in: ${line}`));
  });
});

test('mature overlay pools are additive extras only (disjoint from the base pools)', () => {
  NEEDS.forEach(k => {
    MATURE_COMPLAINTS_EXTRA[k].forEach(line => {
      assert.ok(!COMPLAINTS[k].annoyed.includes(line) && !COMPLAINTS[k].furious.includes(line));
    });
  });
  MATURE_HAPPY_EXTRA.forEach(line => assert.ok(!HAPPY_NOTES.includes(line)));
  MATURE_EVENTS_EXTRA.forEach(line => assert.ok(!EVENTS.includes(line)));
});
```

- [ ] **Step 6: Run the tests**

Run: `cd ~/shelf-life && node --test test/copy.test.mjs`
Expected: all 12 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd ~/shelf-life
git add src/content/copy.js src/content/props.js src/content/decor.js src/content/mature.js test/copy.test.mjs docs/superpowers/plans/2026-09-03-shelf-life-v2.md
git commit -m "Add copy/props/decor content and opt-in mature-mode overlay

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 9: engine/unlocks.js + engine/achievements.js + engine/loop.js

**Files:**
- Create: `src/engine/unlocks.js`
- Create: `src/engine/achievements.js`
- Create: `src/engine/loop.js`
- Test: `test/unlocks.test.mjs`
- Test: `test/achievements.test.mjs`
- Test: `test/loop.test.mjs`

**Interfaces:**
- Consumes: `BASE_STAMPS`/`UNLOCK_STAMPS` (art/stamps.js — pure data, zero DOM deps, safe for engine to import despite living in `art/`), `FEUDS`/`FEUD_LINES`/`ESCALATION_LINES`/`TRUCE_LINES` (content/feuds.js), `GRUDGE_LINES`/`STREAK_LINES`/`COMPLAINTS`/`HAPPY_NOTES`/`EVENTS` (content/copy.js), `MATURE_COMPLAINTS_EXTRA`/`MATURE_HAPPY_EXTRA`/`MATURE_EVENTS_EXTRA` (content/mature.js), `TRAIT_BY_ID` (content/traits.js), `PROPS` (content/props.js), `neighborSlots`/`neighborProps`/`neighborPets`/`tick`/`moodOf`/`worstNeed`/`isAsleep`/`hasTrait` (engine/tick.js), `pick`/`clamp`/`addNote`/`petById` (state.js).
- Produces: everything under `engine/unlocks.js:`, `engine/achievements.js:`, `engine/loop.js:` in Global contracts.
- `engine/achievements.js` imports `totalBond` from `engine/unlocks.js` (both are `engine/`, siblings, no cycle). `engine/loop.js` imports from both `engine/tick.js` and `engine/achievements.js`/`engine/unlocks.js` — it's the top of the engine layer, the orchestration entry point `main.js` (Task 14) calls for "Check the shelf".
- Color-tier unlocks (`BASE_COLORS`/`UNLOCK_COLORS`) stay owned by `art/studio.js` (Task 7, already built) — `checkUnlocks` here only fires notifications for *stamp* unlock tiers, which is the gameplay-relevant one; the palette silently grows as bond rises (no separate toast), a deliberate scope simplification from the original prototype (which combined both).

- [ ] **Step 1: Write `src/engine/unlocks.js`**

```js
import { BASE_STAMPS, UNLOCK_STAMPS } from '../art/stamps.js';
import { addNote } from '../state.js';

export function totalBond(state) {
  return state.pets.reduce((n, p) => n + p.bond, 0);
}

export function unlockedStampKinds(state) {
  const bond = totalBond(state);
  let out = BASE_STAMPS.slice();
  UNLOCK_STAMPS.forEach(u => { if (bond >= u.at) out = out.concat(u.stamps); });
  return out;
}

export function checkUnlocks(state) {
  const bond = totalBond(state);
  const newly = [];
  UNLOCK_STAMPS.forEach(u => {
    const key = 'stamps:' + u.at;
    if (bond >= u.at && !state.seenUnlocks.includes(key)) {
      state.seenUnlocks.push(key);
      addNote(state, 'They trust you enough for ' + u.label + ' in the studio.', 'the shelf', 'arrival');
      newly.push({ key, label: u.label });
    }
  });
  return newly;
}
```

- [ ] **Step 2: Write `test/unlocks.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalBond, unlockedStampKinds, checkUnlocks } from '../src/engine/unlocks.js';
import { BASE_STAMPS, UNLOCK_STAMPS } from '../src/art/stamps.js';
import { blankState, defaultNeeds } from '../src/state.js';

function makePet(bond) {
  return { id: 'p' + Math.random(), name: 'T', traits: [], needs: defaultNeeds(), bond, cared: 0, grudges: 0, grudgeStage: 0 };
}

test('totalBond sums bond across all pets', () => {
  const s = blankState();
  s.pets.push(makePet(3), makePet(7));
  assert.equal(totalBond(s), 10);
});

test('unlockedStampKinds only includes base stamps below the first threshold', () => {
  const s = blankState();
  s.pets.push(makePet(5));
  const kinds = unlockedStampKinds(s);
  BASE_STAMPS.forEach(k => assert.ok(kinds.includes(k)));
  UNLOCK_STAMPS.forEach(u => u.stamps.forEach(k => assert.ok(!kinds.includes(k))));
});

test('unlockedStampKinds includes a tier once bond meets its threshold', () => {
  const s = blankState();
  const firstTier = UNLOCK_STAMPS[0];
  s.pets.push(makePet(firstTier.at));
  const kinds = unlockedStampKinds(s);
  firstTier.stamps.forEach(k => assert.ok(kinds.includes(k)));
});

test('checkUnlocks fires once per threshold and is idempotent after that', () => {
  const s = blankState();
  const firstTier = UNLOCK_STAMPS[0];
  s.pets.push(makePet(firstTier.at));
  const first = checkUnlocks(s);
  assert.equal(first.length, 1);
  assert.equal(s.notes.length, 1);
  const second = checkUnlocks(s);
  assert.equal(second.length, 0);
  assert.equal(s.notes.length, 1);
});
```

- [ ] **Step 3: Run the unlocks tests**

Run: `cd ~/shelf-life && node --test test/unlocks.test.mjs`
Expected: all 4 tests PASS.

- [ ] **Step 4: Write `src/engine/achievements.js`**

```js
import { FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../content/feuds.js';
import { GRUDGE_LINES, STREAK_LINES } from '../content/copy.js';
import { neighborPets, neighborSlots } from './tick.js';
import { totalBond } from './unlocks.js';
import { pick, addNote, clamp, petById } from '../state.js';

export function activeFeuds(state) {
  const found = [];
  state.slots.forEach((id, i) => {
    if (!id) return;
    const a = petById(state, id);
    if (!a) return;
    neighborPets(state, i).forEach(b => {
      if (b.id <= a.id) return;
      for (const [x, y] of FEUDS) {
        if ((a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x))) {
          found.push([a, b]);
          return;
        }
      }
    });
  });
  return found;
}

export function feudingIds(state) {
  const s = new Set();
  activeFeuds(state).forEach(([a, b]) => { s.add(a.id); s.add(b.id); });
  return s;
}

export function feudPairKey(a, b) {
  return [a, b].sort().join('|');
}

// Every active feud gets exactly one note per call: an ongoing flavor line by
// default, a chance to escalate (deepening the arc), or — only once the arc
// has escalated at least twice — a rare chance to resolve into a truce.
export function stepFeudArc(state, pairKey, a, b) {
  const arc = state.feudArcs[pairKey] || (state.feudArcs[pairKey] = { level: 0, truce: false });
  if (arc.truce) return null;
  const roll = Math.random();
  if (arc.level >= 2 && roll < 0.12) {
    arc.truce = true;
    addNote(state, pick(TRUCE_LINES).replace(/\{a\}/g, a.name).replace(/\{b\}/g, b.name), 'observed', 'note');
    return 'truce';
  }
  if (roll < 0.35) {
    arc.level += 1;
    addNote(state, pick(ESCALATION_LINES).replace(/\{a\}/g, a.name).replace(/\{b\}/g, b.name), 'observed', 'feud');
    return 'escalate';
  }
  addNote(state, pick(FEUD_LINES).replace(/\{a\}/g, a.name).replace(/\{b\}/g, b.name), 'observed', 'feud');
  return 'ongoing';
}

export const GRUDGE_STAGE_AT = [5, 12, 20];

export function grudgeStageFor(grudges) {
  let stage = 0;
  GRUDGE_STAGE_AT.forEach((t, i) => { if (grudges >= t) stage = i + 1; });
  return stage;
}

// Called after pet.grudges increments. Fires the escalating "reckoning" the
// first time a new stage is crossed: a note, a bond hit, and — at stage 2 —
// the pet relocates itself to a random neighboring slot.
export function checkGrudgeEscalation(state, pet) {
  const newStage = grudgeStageFor(pet.grudges);
  if (newStage <= pet.grudgeStage) return false;
  pet.grudgeStage = newStage;
  const lines = GRUDGE_LINES[newStage] || [];
  if (!lines.length) return false;
  addNote(state, pick(lines).replace(/\{n\}/g, pet.name), pet.name, 'angry');
  if (newStage === 1) {
    pet.bond = clamp(pet.bond - 1, 0, 25);
  } else if (newStage === 2) {
    pet.bond = clamp(pet.bond - 2, 0, 25);
    const i = state.slots.indexOf(pet.id);
    if (i >= 0) {
      const nbrs = neighborSlots(i, state.slots.length).filter(x => state.slots[x]);
      if (nbrs.length) {
        const j = pick(nbrs);
        const tmp = state.slots[i]; state.slots[i] = state.slots[j]; state.slots[j] = tmp;
      }
    }
  } else if (newStage === 3) {
    pet.bond = clamp(pet.bond - 3, 0, 25);
  }
  return true;
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

export function checkinStreak(state, now = Date.now()) {
  const today = dayKey(now);
  if (!state.streak.lastCheckin) {
    state.streak.count = 1;
    state.streak.lastCheckin = now;
    return { streak: 1, isNewDay: true };
  }
  const last = dayKey(state.streak.lastCheckin);
  if (last === today) return { streak: state.streak.count, isNewDay: false };
  const yesterday = dayKey(now - 86400000);
  state.streak.count = (last === yesterday) ? state.streak.count + 1 : 1;
  state.streak.lastCheckin = now;
  addNote(state, pick(STREAK_LINES).replace(/\{d\}/g, String(state.streak.count)), 'the shelf', 'note');
  return { streak: state.streak.count, isNewDay: true };
}

export const ACHIEVEMENTS = [
  { id: 'first-arrival', label: 'Move-In Day', desc: 'Made your first pet.', toastLine: 'First one. There will be more.', check: state => state.pets.length >= 1 },
  { id: 'full-shelf', label: 'No Vacancy', desc: 'Filled every slot on the shelf.', toastLine: 'The shelf is full. So are your obligations.', check: state => state.slots.every(s => s !== null) },
  { id: 'first-feud', label: 'Drama', desc: 'Witnessed your first feud.', toastLine: 'Someone is not speaking to someone else. Achievement unlocked.', check: state => activeFeuds(state).length >= 1 },
  { id: 'first-grudge', label: 'On The List', desc: 'A pet started keeping score.', toastLine: 'It is counting now. It will not stop.', check: state => state.pets.some(p => p.grudges >= 1) },
  { id: 'first-reckoning', label: 'The Reckoning', desc: 'A grudge finally escalated.', toastLine: 'That was a mistake. That was definitely a mistake.', check: state => state.pets.some(p => p.grudgeStage >= 1) },
  { id: 'terminal-grudge', label: 'It Has A Folder Now', desc: 'A grudge reached its final stage.', toastLine: 'This is no longer about the sock.', check: state => state.pets.some(p => p.grudgeStage >= 3) },
  { id: 'max-bond', label: 'Chosen', desc: 'A pet reached maximum bond.', toastLine: 'It has decided to keep you. Permanently, probably.', check: state => state.pets.some(p => p.bond >= 25) },
  { id: 'bond-10', label: 'Trusted, Barely', desc: 'Reached 10 total bond.', toastLine: 'They trust you slightly more than the furniture.', check: state => totalBond(state) >= 10 },
  { id: 'bond-30', label: 'Household Name', desc: 'Reached 30 total bond.', toastLine: 'You are, against all odds, beloved.', check: state => totalBond(state) >= 30 },
  { id: 'bond-60', label: 'Cult Leader', desc: 'Reached 60 total bond.', toastLine: 'This is either love or a hostage situation.', check: state => totalBond(state) >= 60 },
  { id: 'streak-3', label: 'Creature Of Habit', desc: 'Checked in three days running.', toastLine: 'Three days. They have noticed the pattern.', check: state => state.streak.count >= 3 },
  { id: 'streak-7', label: 'They Expect You Now', desc: 'Checked in seven days running.', toastLine: 'A full week. This is a relationship now.', check: state => state.streak.count >= 7 },
  { id: 'first-truce', label: 'Unlikely Peace', desc: 'A feud resolved into a truce.', toastLine: 'Nobody knows what changed. It is, somehow, fine now.', check: state => Object.values(state.feudArcs).some(a => a.truce) },
  { id: 'menagerie', label: 'A Real Collection', desc: 'Ten or more pets living on the shelf at once.', toastLine: 'This is either a menagerie or a liability.', check: state => state.pets.length >= 10 },
  { id: 'decorator', label: 'Furnished', desc: 'Placed five or more things on the shelf.', toastLine: 'The shelf has a personality now. It is not yours.', check: state => state.props.length >= 5 }
];

export function checkAchievements(state) {
  const unlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (state.achievements.includes(a.id)) return;
    if (a.check(state)) {
      state.achievements.push(a.id);
      addNote(state, a.toastLine, 'the shelf', 'arrival');
      unlocked.push(a);
    }
  });
  return unlocked;
}
```

- [ ] **Step 5: Write `test/achievements.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFeuds, feudingIds, feudPairKey, stepFeudArc,
  GRUDGE_STAGE_AT, grudgeStageFor, checkGrudgeEscalation,
  checkinStreak, ACHIEVEMENTS, checkAchievements
} from '../src/engine/achievements.js';
import { FEUDS } from '../src/content/feuds.js';
import { blankState, defaultNeeds } from '../src/state.js';

function makePet(id, traits, overrides = {}) {
  return { id, name: id, traits, needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0, ...overrides };
}
function localHour(h, day = 1) { return new Date(2024, 0, day, h, 0, 0).getTime(); }

test('activeFeuds detects a feuding pair sitting next to each other', () => {
  const [x, y] = FEUDS[0];
  const s = blankState();
  s.pets.push(makePet('a', [x]), makePet('b', [y]));
  s.slots[0] = 'a'; s.slots[1] = 'b';
  assert.equal(activeFeuds(s).length, 1);
  assert.equal(feudingIds(s).has('a'), true);
  assert.equal(feudingIds(s).has('b'), true);
});

test('activeFeuds finds nothing for non-adjacent pets', () => {
  const [x, y] = FEUDS[0];
  const s = blankState();
  s.pets.push(makePet('a', [x]), makePet('b', [y]));
  s.slots[0] = 'a'; s.slots[2] = 'b';
  assert.equal(activeFeuds(s).length, 0);
});

test('feudPairKey is order-independent', () => {
  assert.equal(feudPairKey('a', 'b'), feudPairKey('b', 'a'));
});

test('stepFeudArc always adds exactly one note per call, level never regresses, truce only after level 2', () => {
  const s = blankState();
  const a = makePet('a', []); const b = makePet('b', []);
  const key = feudPairKey('a', 'b');
  for (let i = 0; i < 150; i++) {
    const before = s.feudArcs[key] ? s.feudArcs[key].level : 0;
    const notesBefore = s.notes.length;
    const outcome = stepFeudArc(s, key, a, b);
    if (outcome === null) continue;
    assert.equal(s.notes.length, notesBefore + 1);
    const after = s.feudArcs[key].level;
    assert.ok(after >= before);
    if (s.feudArcs[key].truce) assert.ok(after >= 2);
  }
});

test('grudgeStageFor buckets at the documented thresholds', () => {
  assert.equal(grudgeStageFor(0), 0);
  assert.equal(grudgeStageFor(4), 0);
  assert.equal(grudgeStageFor(GRUDGE_STAGE_AT[0]), 1);
  assert.equal(grudgeStageFor(GRUDGE_STAGE_AT[1]), 2);
  assert.equal(grudgeStageFor(GRUDGE_STAGE_AT[2]), 3);
});

test('checkGrudgeEscalation only fires once per stage and reduces bond', () => {
  const s = blankState();
  const pet = makePet('a', [], { grudges: GRUDGE_STAGE_AT[0], bond: 10 });
  s.pets.push(pet);
  assert.equal(checkGrudgeEscalation(s, pet), true);
  assert.equal(pet.grudgeStage, 1);
  assert.equal(pet.bond, 9);
  assert.equal(checkGrudgeEscalation(s, pet), false);
  assert.equal(pet.bond, 9);
});

test('checkinStreak: first check-in is 1, same day is a no-op, next day increments, a gap resets to 1', () => {
  const s = blankState();
  assert.deepEqual(checkinStreak(s, localHour(10, 1)), { streak: 1, isNewDay: true });
  assert.deepEqual(checkinStreak(s, localHour(20, 1)), { streak: 1, isNewDay: false });
  assert.equal(checkinStreak(s, localHour(9, 2)).streak, 2);
  assert.equal(checkinStreak(s, localHour(9, 5)).streak, 1);
});

test('checkAchievements unlocks first-arrival exactly once', () => {
  const s = blankState();
  s.pets.push(makePet('a', []));
  const unlocked = checkAchievements(s);
  assert.ok(unlocked.some(a => a.id === 'first-arrival'));
  assert.ok(s.achievements.includes('first-arrival'));
  assert.equal(checkAchievements(s).some(a => a.id === 'first-arrival'), false);
});

test('every achievement has a unique id and a check function', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  ACHIEVEMENTS.forEach(a => assert.equal(typeof a.check, 'function'));
});
```

- [ ] **Step 6: Run the achievements tests**

Run: `cd ~/shelf-life && node --test test/achievements.test.mjs`
Expected: all 8 tests PASS.

- [ ] **Step 7: Write `src/engine/loop.js`**

```js
import { tick, moodOf, worstNeed, isAsleep, hasTrait, neighborProps, neighborPets } from './tick.js';
import { activeFeuds, feudPairKey, stepFeudArc, checkGrudgeEscalation, checkinStreak } from './achievements.js';
import { checkUnlocks } from './unlocks.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS } from '../content/props.js';
import { COMPLAINTS, HAPPY_NOTES, EVENTS } from '../content/copy.js';
import { MATURE_COMPLAINTS_EXTRA, MATURE_HAPPY_EXTRA, MATURE_EVENTS_EXTRA } from '../content/mature.js';
import { pick, addNote, clamp, petById } from '../state.js';

export function petLine(state, pet) {
  const mood = moodOf(pet);
  const need = worstNeed(pet);
  if (mood === 'furious' || mood === 'annoyed') {
    let pool = COMPLAINTS[need][mood];
    if (state.settings.matureMode) pool = pool.concat(MATURE_COMPLAINTS_EXTRA[need] || []);
    return { text: pick(pool), kind: 'angry' };
  }
  const i = state.slots.indexOf(pet.id);
  const nbrs = i >= 0 ? neighborPets(state, i) : [];
  const trait = TRAIT_BY_ID[pick(pet.traits)];
  if (nbrs.length && trait.social && Math.random() < 0.45) {
    return { text: pick(trait.social).replace(/\{n\}/g, pick(nbrs).name), kind: 'note' };
  }
  if (mood === 'content' && Math.random() < 0.35) {
    let pool = HAPPY_NOTES;
    if (state.settings.matureMode) pool = pool.concat(MATURE_HAPPY_EXTRA);
    return { text: pick(pool), kind: 'note' };
  }
  return { text: pick(trait.notes), kind: 'note' };
}

export function autonomy(state) {
  state.pets.forEach(pet => {
    const mood = moodOf(pet);
    const i = state.slots.indexOf(pet.id);
    if (i < 0) return;
    if ((mood === 'furious' || hasTrait(pet, 'wanderer')) && Math.random() < (mood === 'furious' ? 0.45 : 0.2)) {
      const nbrs = neighborPets(state, i);
      if (nbrs.length) {
        const other = pick(nbrs);
        const j = state.slots.indexOf(other.id);
        state.slots[i] = other.id;
        state.slots[j] = pet.id;
        addNote(state, 'Moved itself next to ' + other.name + '. Nobody was consulted.', pet.name, 'angry');
      }
    }
    if (hasTrait(pet, 'thief') && pet.needs.food < 45) {
      const nbrs = neighborPets(state, i);
      if (nbrs.length) {
        const victim = pick(nbrs);
        victim.needs.food = clamp(victim.needs.food - 14, 0, 100);
        pet.needs.food = clamp(pet.needs.food + 12, 0, 100);
        addNote(state, 'Took food from ' + victim.name + '. ' + victim.name + ' is aware.', pet.name, 'feud');
      }
    }
  });
}

export function checkShelf(state, now = Date.now()) {
  tick(state, now);
  if (!state.pets.length) {
    addNote(state, pick([
      'The shelf is empty and somehow still judging you.',
      'Nothing lives here. The dust has opinions anyway.',
      'Empty. The wood creaked once, unprompted.'
    ]), 'the shelf', 'note');
    return;
  }
  activeFeuds(state).slice(0, 2).forEach(([a, b]) => {
    stepFeudArc(state, feudPairKey(a.id, b.id), a, b);
  });
  const occupied = state.slots.map((id, i) => id ? i : -1).filter(i => i >= 0);
  const chosen = occupied.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  chosen.forEach(i => {
    const pet = petById(state, state.slots[i]);
    if (!pet) return;
    if (isAsleep(pet, new Date(now)) && Math.random() < 0.5) {
      addNote(state, 'Asleep. Has left a note reading "later".', pet.name, 'note');
      return;
    }
    const near = neighborProps(state, i);
    if (near.length && moodOf(pet) !== 'furious' && Math.random() < 0.42) {
      const pr = pick(near);
      addNote(state, pick(PROPS[pr.kind].lines).replace(/\{p\}/g, pet.name), PROPS[pr.kind].name, 'note');
      return;
    }
    const line = petLine(state, pet);
    if (line.kind === 'angry') {
      pet.grudges = (pet.grudges || 0) + 1;
      checkGrudgeEscalation(state, pet);
    }
    addNote(state, line.text, pet.name, line.kind);
  });
  if (state.props.length && Math.random() < 0.35) {
    const pr = pick(state.props);
    addNote(state, pick(PROPS[pr.kind].ambient), PROPS[pr.kind].name, 'note');
  }
  let eventPool = EVENTS;
  if (state.settings.matureMode) eventPool = eventPool.concat(MATURE_EVENTS_EXTRA);
  if (Math.random() < 0.4) addNote(state, pick(eventPool), 'the shelf', 'note');
  autonomy(state);
  checkinStreak(state, now);
  checkUnlocks(state);
}
```

- [ ] **Step 8: Write `test/loop.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petLine, autonomy, checkShelf } from '../src/engine/loop.js';
import { blankState, defaultNeeds } from '../src/state.js';

function makePet(id, traits, needs) {
  return { id, name: id, traits, needs: needs || defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0 };
}

test('petLine returns an angry complaint for a furious pet', () => {
  const s = blankState();
  const pet = makePet('a', ['spiteful'], { food: 5, fuss: 5, clean: 5 });
  const line = petLine(s, pet);
  assert.equal(line.kind, 'angry');
  assert.ok(line.text.length > 0);
});

test('petLine does not throw with matureMode on, across many draws', () => {
  const s = blankState();
  s.settings.matureMode = true;
  const pet = makePet('a', ['spiteful'], { food: 5, fuss: 90, clean: 90 });
  for (let i = 0; i < 20; i++) assert.doesNotThrow(() => petLine(s, pet));
});

test('checkShelf on an empty shelf adds exactly one note', () => {
  const s = blankState();
  checkShelf(s, Date.now());
  assert.equal(s.notes.length, 1);
});

test('checkShelf on a populated shelf ticks and never throws', () => {
  const s = blankState();
  const pet = makePet('a', ['spiteful'], { food: 50, fuss: 50, clean: 50 });
  s.pets.push(pet); s.slots[0] = pet.id;
  s.lastTick = Date.now() - 3600000;
  assert.doesNotThrow(() => checkShelf(s, Date.now()));
});

test('autonomy never throws across many randomized trials', () => {
  for (let i = 0; i < 30; i++) {
    const s = blankState();
    s.pets.push(makePet('a', [], { food: 0, fuss: 0, clean: 0 }), makePet('b', [], { food: 90, fuss: 90, clean: 90 }));
    s.slots[0] = 'a'; s.slots[1] = 'b';
    assert.doesNotThrow(() => autonomy(s));
  }
});
```

- [ ] **Step 9: Run the loop tests**

Run: `cd ~/shelf-life && node --test test/loop.test.mjs`
Expected: all 5 tests PASS.

- [ ] **Step 10: Commit**

```bash
cd ~/shelf-life
git add src/engine/unlocks.js src/engine/achievements.js src/engine/loop.js test/unlocks.test.mjs test/achievements.test.mjs test/loop.test.mjs
git commit -m "Add engine/unlocks.js, achievements.js, loop.js with full node:test coverage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

---

### Task 11: ui/render.js + ui/toast.js

**Files:**
- Create: `src/ui/render.js`
- Create: `src/ui/toast.js`

**Interfaces:**
- Consumes: `moodOf`/`isAsleep`/`MOOD_WORD` (engine/tick.js), `activeFeuds`/`feudingIds`/`totalBond` (engine/achievements.js), `renderPetSprite`/`moodMotionClasses` (art/sprite.js), `PROPS`/`PROP_ART` (content/props.js).
- Produces: `renderAll(state)`, `renderStatus(state)`, `renderShelf(state)`, `renderNotes(state)`, and `escapeHtml(s)` (one extra export beyond the contract minimum — Task 12/13 should import it from here rather than duplicating it). `toast.js` produces `toast(msg)`.
- DOM-facing, no automated test — verified in Task 16's manual smoke test. `node --check` only.

`feudDirection` (consumed by `moodMotionClasses`) means "which side the feuding neighbor is on" — the pet should lean *away* from that side, so a neighbor on the left passes `feudDirection:'right'` (lean right, away from it) and vice versa. This is computed here, not in `art/sprite.js`, because only the renderer knows slot layout/neighbors.

- [ ] **Step 1: Write `src/ui/render.js`**

```js
import { moodOf, isAsleep, MOOD_WORD } from '../engine/tick.js';
import { activeFeuds, feudingIds, totalBond } from '../engine/achievements.js';
import { renderPetSprite, moodMotionClasses } from '../art/sprite.js';
import { PROPS, PROP_ART } from '../content/props.js';

const cabinet = document.getElementById('cabinet');
const notesEl = document.getElementById('notes');
const statusBar = document.getElementById('statusBar');

export function renderAll(state) {
  renderStatus(state);
  renderShelf(state);
  renderNotes(state);
}

export function renderStatus(state) {
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  const counts = { content: 0, fine: 0, annoyed: 0, furious: 0 };
  state.pets.forEach(p => counts[moodOf(p)]++);
  const feuds = activeFeuds(state).length;
  statusBar.innerHTML =
    '<span>Day <b>' + days + '</b></span>' +
    '<span>Living here: <b>' + state.pets.length + '</b> of ' + state.slots.length + '</span>' +
    '<span class="good">Content: <b>' + counts.content + '</b></span>' +
    '<span>Fine: <b>' + counts.fine + '</b></span>' +
    '<span class="mid">Annoyed: <b>' + counts.annoyed + '</b></span>' +
    '<span class="bad">Furious: <b>' + counts.furious + '</b></span>' +
    '<span>Feuds: <b>' + feuds + '</b></span>' +
    '<span>Bond: <b>' + totalBond(state) + '</b></span>' +
    '<span class="streak-badge">🔥 Streak: <b>' + (state.streak.count || 0) + '</b></span>';
}

function feudDirectionFor(state, pet, slotIndex) {
  const partnerIds = new Set();
  activeFeuds(state).forEach(([a, b]) => {
    if (a.id === pet.id) partnerIds.add(b.id);
    else if (b.id === pet.id) partnerIds.add(a.id);
  });
  if (!partnerIds.size) return null;
  const leftIdx = slotIndex % 6 > 0 ? slotIndex - 1 : -1;
  const rightIdx = slotIndex % 6 < 5 ? slotIndex + 1 : -1;
  if (leftIdx >= 0 && partnerIds.has(state.slots[leftIdx])) return 'right';
  if (rightIdx >= 0 && partnerIds.has(state.slots[rightIdx])) return 'left';
  return null;
}

function petEl(state, pet, slotIndex) {
  const mood = moodOf(pet);
  const asleep = isAsleep(pet);
  const feuding = feudingIds(state).has(pet.id);
  const feudDirection = feuding ? feudDirectionFor(state, pet, slotIndex) : null;

  const btn = document.createElement('button');
  btn.className = 'pet piece' + (feuding ? ' feuding' : '') + (mood === 'furious' ? ' furious' : '') + (asleep ? ' asleep' : '');
  btn.dataset.id = pet.id;
  btn.dataset.kind = 'pet';
  btn.dataset.slot = slotIndex;
  btn.setAttribute('aria-label', 'Take care of ' + pet.name + ', currently ' + MOOD_WORD[mood]);

  const sprite = renderPetSprite(pet);
  sprite.classList.add(...moodMotionClasses(pet, { mood, asleep, feudDirection }));
  btn.appendChild(sprite);

  const nameplate = document.createElement('span');
  nameplate.className = 'nameplate';
  nameplate.textContent = pet.name;
  btn.appendChild(nameplate);

  const pips = document.createElement('span');
  pips.className = 'pips';
  if (asleep) pips.innerHTML += '<span class="pip zzz">asleep</span>';
  ['food', 'fuss', 'clean'].forEach(k => { if (pet.needs[k] < 42) pips.innerHTML += '<span class="pip ' + k + '"></span>'; });
  btn.appendChild(pips);

  return btn;
}

function propEl(pr, slotIndex) {
  const def = PROPS[pr.kind];
  const btn = document.createElement('button');
  btn.className = 'prop piece';
  btn.dataset.id = pr.id;
  btn.dataset.kind = 'prop';
  btn.dataset.slot = slotIndex;
  btn.setAttribute('aria-label', def.name);
  btn.innerHTML = PROP_ART[pr.kind] + '<span class="nameplate">' + escapeHtml(def.name) + '</span>';
  return btn;
}

export function renderShelf(state) {
  cabinet.innerHTML = '';
  const rows = state.slots.length / 6;
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'shelf-row';
    const slots = document.createElement('div');
    slots.className = 'slots';
    for (let c = 0; c < 6; c++) {
      const i = r * 6 + c;
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = i;
      const id = state.slots[i];
      if (id) {
        const pet = state.pets.find(p => p.id === id);
        if (pet) slot.appendChild(petEl(state, pet, i));
        else {
          const pr = (state.props || []).find(x => x.id === id);
          if (pr) slot.appendChild(propEl(pr, i));
        }
      }
      slots.appendChild(slot);
    }
    if (r === 0 && !state.pets.length) {
      slots.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'empty-shelf';
      msg.textContent = 'Nothing lives here yet. Make something.';
      slots.appendChild(msg);
    }
    row.appendChild(slots);
    const plank = document.createElement('div');
    plank.className = 'plank';
    row.appendChild(plank);
    cabinet.appendChild(row);
  }
}

export function renderNotes(state) {
  notesEl.innerHTML = '';
  if (!state.notes.length) {
    const d = document.createElement('div');
    d.className = 'notes-empty';
    d.textContent = 'No notes yet. Press "Check the shelf" and see what turns up.';
    notesEl.appendChild(d);
    return;
  }
  state.notes.forEach(n => {
    const d = document.createElement('div');
    d.className = 'note ' + n.kind;
    d.innerHTML = escapeHtml(n.text) + '<span class="from">' + escapeHtml(n.from) + '</span>';
    notesEl.appendChild(d);
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Write `src/ui/toast.js`**

```js
let toastTimer = null;
const toastEl = document.getElementById('toast');

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
```

- [ ] **Step 3: Syntax check**

```bash
cd ~/shelf-life
node --check src/ui/render.js && echo "render.js OK"
node --check src/ui/toast.js && echo "toast.js OK"
```

- [ ] **Step 4: Commit**

```bash
cd ~/shelf-life
git add src/ui/render.js src/ui/toast.js
git commit -m "Add ui/render.js and ui/toast.js: shelf/status/notes rendering via sprite.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

### Task 12: ui/card.js

**Files:**
- Create: `src/ui/card.js`

**Interfaces:**
- Consumes: `moodOf`/`isAsleep`/`MOOD_WORD` (engine/tick.js), `careFor` (engine/care.js), `checkUnlocks` (engine/unlocks.js), `checkAchievements`/`grudgeStageFor`/`GRUDGE_STAGE_AT` (engine/achievements.js), `TRAIT_BY_ID` (content/traits.js), `PROPS`/`PROP_ART` (content/props.js), `renderPetSprite` (art/sprite.js), `renderAll`/`escapeHtml` (ui/render.js), `toast` (ui/toast.js), `buildDecor` (ui/decorUI.js, Task 13 — built in parallel; not yet on disk when this task runs but present by the time anything imports this module), `playFeed`/`playFuss`/`playClean` (audio/sound.js), `petById`/`propById`/`pick`/`addNote`/`save`/`clamp` (state.js).
- Produces: `openCard(state,id,keepScroll)`, `openPropCard(state,id)`, `closeCard()`.
- DOM-facing, no automated test — verified in Task 16's manual smoke test. `node --check` only.

Ported from `~/Documents/shelf-life.html`'s `grievanceLine`/`needRow`/`statRow`/`openCard`/`closeCard`/`openPropCard` and the `cardVeil` click-outside/Escape handlers, adapted for the new data model:

- No global `state` — every function takes it as an explicit first argument.
- The pet portrait is a live animated sprite, not a static `<img>`. `openCard` builds the header/needs/bio/stats/traits/actions as one HTML string (assigned to `cardSheet.innerHTML`) with an empty `<div class="card-portrait" id="cardPortraitHost">` left in it, then appends `renderPetSprite(pet)` into that host afterward — a real DOM element can't live inside an `innerHTML` string.
- Care buttons don't mutate/save/render themselves. `careFor(state, pet, need)` only returns `{message, bondGained}`; this module applies the side effects: toast the message, play the matching sound (`playFeed`/`playFuss`/`playClean`), then `checkUnlocks(state)`, `checkAchievements(state)`, `save()`, `renderAll(state)`, and reopen the card (`openCard(state, pet.id, true)`) if it's still open, so the bars visibly update.
- New grudge-stage UI: a line reading "Grudge stage N of 3" (`grudgeStageFor(pet.grudges)` out of `GRUDGE_STAGE_AT.length`) sits alongside the ported `grievanceLine` text near the bond bar. `grievanceLine`'s thresholds now reference `GRUDGE_STAGE_AT[0]`/`[1]`/`[2]` (5/12/20) instead of the original's hardcoded 4/10/20, to stay in sync with the engine's actual escalation thresholds.
- `openPropCard`'s "Put it away" button removes the prop from `state.props`/`state.slots`, adds a note, saves, closes the card, and refreshes the decor prop tray via `buildDecor(state)` in addition to `renderAll(state)`.
- This module wires only `cardVeil`'s own outside-click-to-close handler. It does not install a document-level Escape-key handler (that would need to know about every other veil in the app) — `main.js` (Task 14) owns that and calls the exported `closeCard()`.
- Rehome keeps the original's blocking `confirm()` — the app has no other modal-confirmation pattern, and it's a destructive, rare action.

- [ ] **Step 1: Write `src/ui/card.js`**

```js
import { moodOf, isAsleep, MOOD_WORD } from '../engine/tick.js';
import { careFor } from '../engine/care.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements, grudgeStageFor, GRUDGE_STAGE_AT } from '../engine/achievements.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { renderPetSprite } from '../art/sprite.js';
import { renderAll, escapeHtml } from './render.js';
import { toast } from './toast.js';
import { buildDecor } from './decorUI.js';
import { playFeed, playFuss, playClean } from '../audio/sound.js';
import { petById, propById, pick, addNote, save, clamp } from '../state.js';

const cardVeil = document.getElementById('cardVeil');
const cardSheet = document.getElementById('cardSheet');

let openPetId = null;

// Thresholds mirror engine/achievements.js's GRUDGE_STAGE_AT (5/12/20) rather
// than the original prototype's hardcoded 4/10/20, so this stays in sync with
// the actual grudge-stage escalation logic.
function grievanceLine(pet) {
  const g = pet.grudges || 0;
  if (g === 0) return 'No grievances on file. Yet.';
  if (g < GRUDGE_STAGE_AT[0]) return 'Grievances filed: ' + g + '.';
  if (g < GRUDGE_STAGE_AT[1]) return 'Grievances filed: ' + g + '. It has started numbering them.';
  if (g < GRUDGE_STAGE_AT[2]) return 'Grievances filed: ' + g + '. There is a folder now.';
  return 'Grievances filed: ' + g + '. It has stopped filing and started planning.';
}

function needRow(pet, key, label) {
  const v = Math.round(pet.needs[key]);
  return '<div class="need ' + key + (v < 30 ? ' low' : '') + '"><span>' + label + '</span>' +
    '<span class="bar"><span style="width:' + v + '%"></span></span><span class="num">' + v + '</span></div>';
}

function statRow(label, key, val) {
  return '<div class="stat ' + key + '"><span>' + label + '</span>' +
    '<span class="bar"><span style="width:' + (val * 10) + '%"></span></span><span class="num">' + val + '</span></div>';
}

export function openCard(state, id, keepScroll) {
  const pet = petById(state, id);
  if (!pet) return;
  openPetId = id;
  const y = keepScroll ? cardVeil.scrollTop : 0;
  const mood = moodOf(pet);
  const asleep = isAsleep(pet);
  const dateStr = new Date(pet.born).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const stage = grudgeStageFor(pet.grudges);

  let html = '';
  html += '<div class="sheet-head"><div><h2>' + escapeHtml(pet.name) + '</h2>' +
    '<div class="card-meta">Moved in ' + dateStr + (asleep ? '. Asleep right now.' : '') + '</div>' +
    '<span class="mood-tag mood-' + mood + '">' + MOOD_WORD[mood] + '</span></div>' +
    '<button class="btn btn-ghost btn-sm" id="cardClose">Close</button></div>';
  html += '<div class="card-top"><div class="card-portrait" id="cardPortraitHost"></div><div class="needs">' +
    needRow(pet, 'food', 'Fed') + needRow(pet, 'fuss', 'Fussed') + needRow(pet, 'clean', 'Clean') +
    '<div class="bondline">Bond ' + pet.bond + ' of 25' +
    '<br>' + grievanceLine(pet) +
    '<br>Grudge stage ' + stage + ' of ' + GRUDGE_STAGE_AT.length +
    '<span class="bond-bar"><span style="width:' + (pet.bond / 25 * 100) + '%"></span></span></div>' +
    '</div></div>';
  html += '<div class="care-row">' +
    '<button class="btn" data-care="food">Feed it</button>' +
    '<button class="btn" data-care="fuss">Fuss over it</button>' +
    '<button class="btn" data-care="clean">Clean it up</button></div>';
  html += '<p class="bio">' + escapeHtml(pet.bio) + '</p>';
  html += '<div class="section-rule"></div>';
  html += statRow('Cute', 'cute', pet.stats.cute) + statRow('Menace', 'menace', pet.stats.menace) +
    statRow('Damp', 'damp', pet.stats.damp) + statRow('Mystique', 'mystique', pet.stats.mystique);
  html += '<ul class="traits">';
  pet.traits.forEach(tid => {
    const t = TRAIT_BY_ID[tid];
    if (!t) return;
    html += '<li><strong>' + escapeHtml(t.name) + '</strong><em>' + escapeHtml(t.blurb) + '</em></li>';
  });
  html += '</ul>';
  html += '<div class="card-actions"><button class="btn btn-danger btn-sm" id="rehomeBtn">Rehome</button>' +
    '<button class="btn btn-sm" id="renameBtn">Rename</button></div>';

  cardSheet.innerHTML = html;
  // The portrait is a live animated sprite (a real DOM element), not something
  // that can live inside the innerHTML string above — appended after the fact
  // into the empty host div that string left behind.
  document.getElementById('cardPortraitHost').appendChild(renderPetSprite(pet));

  cardVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
  cardVeil.scrollTop = y;

  cardSheet.querySelectorAll('[data-care]').forEach(btn => {
    btn.addEventListener('click', () => {
      const need = btn.dataset.care;
      const result = careFor(state, pet, need);
      toast(result.message);
      if (need === 'food') playFeed();
      else if (need === 'fuss') playFuss();
      else if (need === 'clean') playClean();
      checkUnlocks(state);
      checkAchievements(state);
      save();
      renderAll(state);
      if (cardVeil.classList.contains('open') && openPetId === pet.id) {
        openCard(state, pet.id, true);
      }
    });
  });
  document.getElementById('cardClose').addEventListener('click', closeCard);
  document.getElementById('renameBtn').addEventListener('click', () => {
    const next = prompt('New name for ' + pet.name, pet.name);
    if (next && next.trim()) {
      pet.name = next.trim().slice(0, 22);
      save();
      openCard(state, pet.id, true);
      renderAll(state);
    }
  });
  document.getElementById('rehomeBtn').addEventListener('click', () => {
    if (!confirm('Rehome ' + pet.name + '? It does not come back.')) return;
    state.pets = state.pets.filter(x => x.id !== pet.id);
    state.slots = state.slots.map(s => s === pet.id ? null : s);
    state.pets.forEach(o => { o.needs.fuss = clamp(o.needs.fuss - 9, 0, 100); });
    addNote(state, pet.name + ' is gone. The others noticed immediately and said nothing.', 'the shelf', 'feud');
    if (state.pets.length) {
      addNote(state, pick([
        'They have counted themselves twice since.',
        'Nobody has taken the empty space. Nobody will.',
        'One of them asked whether there is a list, and whether it is on it.'
      ]), 'the shelf', 'angry');
    }
    save();
    closeCard();
    renderAll(state);
  });
}

export function openPropCard(state, id) {
  const pr = propById(state, id);
  if (!pr) return;
  const def = PROPS[pr.kind];
  openPetId = null;
  cardSheet.innerHTML =
    '<div class="sheet-head"><div><h2>' + escapeHtml(def.name) + '</h2>' +
    '<div class="card-meta">' + escapeHtml(def.desc) + '</div></div>' +
    '<button class="btn btn-ghost btn-sm" id="cardClose">Close</button></div>' +
    '<div class="card-top"><div class="card-portrait">' + PROP_ART[pr.kind] + '</div><div>' +
    '<p class="bio">' + escapeHtml(pick(def.ambient)) + '</p></div></div>' +
    '<div class="card-actions"><button class="btn btn-danger btn-sm" id="removeProp">Put it away</button></div>';
  cardVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('cardClose').addEventListener('click', closeCard);
  document.getElementById('removeProp').addEventListener('click', () => {
    state.props = state.props.filter(x => x.id !== pr.id);
    state.slots = state.slots.map(x => x === pr.id ? null : x);
    addNote(state, def.name + ' has been put away. Somebody has noticed.', 'the shelf', 'note');
    save();
    closeCard();
    buildDecor(state);
    renderAll(state);
  });
}

// Lets main.js's periodic tick know which pet's card (if any) to silently
// refresh, without needing its own copy of this module's open-card state.
export function getOpenPetId() {
  return openPetId;
}

export function closeCard() {
  openPetId = null;
  cardVeil.classList.remove('open');
  document.body.style.overflow = '';
}

// This module only owns cardVeil's own outside-click-to-close behavior — the
// global Escape-key handler (which needs to know about every other veil in
// the app) belongs to main.js (Task 14), not here.
cardVeil.addEventListener('click', e => { if (e.target === cardVeil) closeCard(); });
```

- [ ] **Step 2: Syntax check**

```bash
cd ~/shelf-life
node --check src/ui/card.js && echo "card.js OK"
```

- [ ] **Step 3: Commit**

```bash
cd ~/shelf-life
git add src/ui/card.js
git commit -m "Add ui/card.js: pet/prop detail sheet with grudge-stage display

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```

### Task 13: ui/decorUI.js + ui/drag.js

**Files:**
- Create: `src/ui/decorUI.js`
- Create: `src/ui/drag.js`

**Interfaces:**
- Consumes: `ROOMS`/`WALLS`/`WOODS`/`ACCENTS` (content/decor.js), `PROPS`/`PROP_ART` (content/props.js), `totalBond` (engine/unlocks.js), `save`/`addNote`/`defaultDecor`/`petById`/`propById` (state.js), `toast` (ui/toast.js), `renderAll`/`escapeHtml` (ui/render.js), `openCard`/`openPropCard` (ui/card.js — Task 12, built in parallel; not yet on disk when this task starts, but it will exist by the time anyone runs the page).
- Produces: `buildDecor(state)`, `applyDecor(state)`, `initDecorUI(state)` (decorUI.js); `initDrag(state)` (drag.js).
- DOM-facing, no automated test possible (drag physics, pointer events, veil open/close) — verified with `node --check` only here; full behavioral verification happens in Task 16's manual browser smoke test.

`ui/decorUI.js` owns the decor veil's entire lifecycle itself — `initDecorUI(state)` wires `#decorBtn`'s click (build the pickers, then open the veil), `#decorClose`'s click (close it), and click-outside-to-close on `#decorVeil` — mirroring how `art/studio.js` (Task 7) owns its own veil rather than leaving that wiring to `main.js`. `placeProp` stays internal to the module (not exported); it's only reachable via a prop-tray card's click handler built inside `buildDecor`.

`ui/drag.js` wraps the original prototype's module-level `drag` variable and its four `cabinet` pointer-event listeners (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`) inside one `initDrag(state)` function, called once at boot. There is no `FEUD_SET` cache to maintain here — `ui/render.js` (Task 11) already calls `feudingIds(state)` fresh on every render, so a successful drop just needs `save()` (no args — it persists the module-level `state` singleton) and `renderAll(state)`. The pet drag ghost is built from `pet.art.body` (the freehand body image) — stamps are intentionally not rendered in the drag ghost, a lightweight body-only preview matching the original's "lightweight drag preview" spirit.

- [ ] **Step 1: Write `src/ui/decorUI.js`**

```js
// Decor veil: room/wall/wood/accent pickers plus the prop tray. Owns its own
// veil open/close lifecycle (mirrors art/studio.js's self-contained-widget
// pattern) rather than leaving that wiring to main.js.
import { ROOMS, WALLS, WOODS, ACCENTS } from '../content/decor.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { totalBond } from '../engine/unlocks.js';
import { save, addNote, defaultDecor } from '../state.js';
import { toast } from './toast.js';
import { renderAll, escapeHtml } from './render.js';

// Ported verbatim from ~/Documents/shelf-life.html's optButton (~line 1339).
// Not part of the module's export contract — only buildDecor needs it.
function optButton(label, pressed, swatchColor, onClick, disabled) {
  const b = document.createElement('button');
  b.className = 'opt';
  b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  b.innerHTML = (swatchColor ? '<span class="dot" style="background:' + swatchColor + '"></span>' : '') + escapeHtml(label);
  if (disabled) b.disabled = true;
  else b.addEventListener('click', onClick);
  return b;
}

export function applyDecor(state) {
  const d = state.decor || defaultDecor();
  const root = document.documentElement.style;
  const room = ROOMS[d.room] || ROOMS.aubergine;
  for (const k in room.vars) root.setProperty(k, room.vars[k]);
  const wood = WOODS[d.wood] || WOODS.rosewood;
  root.setProperty('--wood', wood.wood);
  root.setProperty('--wood-lip', wood.lip);
  root.setProperty('--pink', (ACCENTS[d.accent] || ACCENTS.bubblegum).c);
  document.body.className = 'wall-' + d.wall;
}

// Not exported — only the prop-tray click handler built inside buildDecor
// calls it, matching the original's internal-only placeProp.
function placeProp(state, kind) {
  const slot = state.slots.indexOf(null);
  if (slot === -1) { toast('No room on the shelf. Move something first.'); return; }
  const pr = { id: 'd' + (state.seq++) + '_' + Date.now().toString(36), kind: kind };
  state.props.push(pr);
  state.slots[slot] = pr.id;
  addNote(state, PROPS[kind].name + ' arrived on the shelf. They are pretending not to care.', 'the shelf', 'arrival');
  save();
  buildDecor(state);
  renderAll(state);
  toast(PROPS[kind].name + ' placed. Drag it where you want it.');
}

export function buildDecor(state) {
  const d = state.decor;

  const rooms = document.getElementById('roomOpts');
  rooms.innerHTML = '';
  Object.keys(ROOMS).forEach(k => rooms.appendChild(optButton(ROOMS[k].name, d.room === k, ROOMS[k].swatch, () => { d.room = k; applyDecor(state); save(); buildDecor(state); })));

  const walls = document.getElementById('wallOpts');
  walls.innerHTML = '';
  Object.keys(WALLS).forEach(k => walls.appendChild(optButton(WALLS[k], d.wall === k, null, () => { d.wall = k; applyDecor(state); save(); buildDecor(state); })));

  const woods = document.getElementById('woodOpts');
  woods.innerHTML = '';
  Object.keys(WOODS).forEach(k => woods.appendChild(optButton(WOODS[k].name, d.wood === k, WOODS[k].lip, () => { d.wood = k; applyDecor(state); save(); buildDecor(state); })));

  const acc = document.getElementById('accentOpts');
  acc.innerHTML = '';
  Object.keys(ACCENTS).forEach(k => acc.appendChild(optButton(ACCENTS[k].name, d.accent === k, ACCENTS[k].c, () => { d.accent = k; applyDecor(state); save(); buildDecor(state); })));

  const tray = document.getElementById('propTray');
  tray.innerHTML = '';
  const bond = totalBond(state);
  Object.keys(PROPS).forEach(kind => {
    const def = PROPS[kind];
    const locked = bond < def.at;
    const card = document.createElement('button');
    card.className = 'prop-card' + (locked ? ' locked' : '');
    const owned = state.props.filter(x => x.kind === kind).length;
    card.innerHTML = PROP_ART[kind] + '<b>' + escapeHtml(def.name) + '</b><small>' +
      (locked ? 'Needs bond ' + def.at : escapeHtml(def.desc) + (owned ? '<br>On the shelf: ' + owned : '')) + '</small>';
    if (locked) card.disabled = true;
    else card.addEventListener('click', () => placeProp(state, kind));
    tray.appendChild(card);
  });
}

export function initDecorUI(state) {
  const decorVeil = document.getElementById('decorVeil');
  const decorBtn = document.getElementById('decorBtn');
  const decorClose = document.getElementById('decorClose');

  function openIt() {
    buildDecor(state);
    decorVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeIt() {
    decorVeil.classList.remove('open');
    document.body.style.overflow = '';
  }

  decorBtn.addEventListener('click', openIt);
  decorClose.addEventListener('click', closeIt);
  decorVeil.addEventListener('click', e => {
    if (e.target === decorVeil) closeIt();
  });
}
```

- [ ] **Step 2: Write `src/ui/drag.js`**

```js
// Shelf drag-and-drop: pointer-event handlers delegated from #cabinet.
// Wraps the original prototype's module-level `drag` variable and its four
// cabinet pointer listeners inside one init function so main.js can wire it
// up once at boot with the live state.
import { petById, propById, save } from '../state.js';
import { PROP_ART } from '../content/props.js';
import { renderAll } from './render.js';
import { openCard, openPropCard } from './card.js';

export function initDrag(state) {
  const cabinet = document.getElementById('cabinet');
  let drag = null;

  cabinet.addEventListener('pointerdown', e => {
    const piece = e.target.closest('.piece');
    if (!piece) return;
    drag = { id: piece.dataset.id, kind: piece.dataset.kind, from: Number(piece.dataset.slot), el: piece, startX: e.clientX, startY: e.clientY, moved: false, ghost: null };
    piece.setPointerCapture(e.pointerId);
  });

  cabinet.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 7) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.el.classList.add('dragging');
      let g;
      if (drag.kind === 'pet') {
        g = document.createElement('img');
        g.src = petById(state, drag.id).art.body;
      } else {
        g = document.createElement('div');
        g.innerHTML = PROP_ART[propById(state, drag.id).kind];
      }
      g.className = 'ghost';
      document.body.appendChild(g);
      drag.ghost = g;
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest ? under.closest('.slot') : null;
    if (slot) slot.classList.add('drop-target');
  });

  cabinet.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    document.querySelectorAll('.slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove('dragging');
    if (!d.moved) {
      if (d.kind === 'pet') openCard(state, d.id);
      else openPropCard(state, d.id);
      return;
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest ? under.closest('.slot') : null;
    if (!slot) return;
    const to = Number(slot.dataset.slot);
    if (to === d.from) return;
    const tmp = state.slots[to];
    state.slots[to] = d.id;
    state.slots[d.from] = tmp;
    save();
    renderAll(state);
  });

  cabinet.addEventListener('pointercancel', () => {
    if (drag && drag.ghost) drag.ghost.remove();
    if (drag) drag.el.classList.remove('dragging');
    drag = null;
  });
}
```

- [ ] **Step 3: Syntax check**

```bash
cd ~/shelf-life
node --check src/ui/decorUI.js && echo "decorUI.js OK"
node --check src/ui/drag.js && echo "drag.js OK"
```

- [ ] **Step 4: Commit**

```bash
cd ~/shelf-life
git add src/ui/decorUI.js src/ui/drag.js docs/superpowers/plans/2026-09-03-shelf-life-v2.md
git commit -m "Add ui/decorUI.js and ui/drag.js: decor veil + shelf drag-and-drop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WE6ff2D84iY6JvjjyjqCZB"
```
