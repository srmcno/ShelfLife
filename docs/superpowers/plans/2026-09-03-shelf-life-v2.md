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
  blankState(), migratePet(rawPet), load(), save(), state, setState(next)
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
art/sprite.js:            renderPetSprite(pet), moodMotionClasses(pet, {mood, asleep, feuding})
art/studio.js:            initStudio({ onSave }) -> { open(unlockedBond), close(),
                          rebuildPalette(unlockedBond), rebuildStamps(unlockedBond), isOpen() }
                          BASE_COLORS, UNLOCK_COLORS, unlockedColors(state)

engine/tick.js:           MOOD_WORD, hasTrait(pet,key), isNight(date), isAsleep(pet,date),
                          neighborSlots(index,slotCount), neighborProps(state,index),
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
ui/card.js:                 openCard(state,id,keepScroll), openPropCard(state,id), closeCard()
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

export function load() {
  try {
    const raw = Store.get(SAVE_KEY) || Store.get('shelflife.v2') || Store.get('shelflife.v1');
    if (!raw) return blankState();
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.pets)) return blankState();
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
import { migratePet, blankState, clamp, defaultNeeds, SLOT_COUNT, petById, addNote, onNote } from '../src/state.js';

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

Port the full original stylesheet from `~/Documents/shelf-life.html` (lines 11-192) verbatim — all custom properties, wall patterns, masthead/toolbar/status/cabinet/slot/pet/prop/ghost/notes/veil/studio/card/decor/toast/responsive rules — then append this block for the new toolbar buttons, streak badge, and layered-sprite animation system:

```css
.streak-badge{font-size:12px;color:var(--amber)}
#incidentsSheet .incident{border-top:1px solid var(--rule);padding:10px 0}
#incidentsSheet .incident b{color:var(--amber);font-size:14px}
#incidentsSheet .incident p{margin:4px 0 0;font-size:13px;color:var(--bone-dim)}
#incidentsSheet .incident-empty{font-family:var(--hand);font-size:20px;color:#6C5A7A}

.stamp-preview-layer{position:absolute;inset:0;pointer-events:none}
.stamp-preview-layer .sprite-stamp{position:absolute}

.sprite{position:relative;width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center;transform-origin:50% 100%}
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
    stats:{mystique:3}, care:{fuss:1.5},
    notes:['Was very busy at 3am. Doing what is unclear.','Slept through the entire day out of spite.','Has opinions it saves specifically for 3am.','Woke you up to make sure you were still asleep.'],
    social:['Woke {n} up. Denies it. There is evidence.','Had a whole conversation with {n} at 3am. {n} does not remember.','Let {n} sleep, for once. Historic.'] },
  { id:'magpie', name:'Magpie', blurb:'Collects things. Some of them were yours.',
    stats:{mystique:2,menace:1}, care:{},
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
    stats:{mystique:5,menace:1}, care:{fuss:1.3},
    notes:['Held a small ceremony. Would not disclose the purpose.','Asked you to join something. Declined to say what.','Lit the candle at an unusual hour. On schedule, apparently.','Has recruited zero members and remains extremely optimistic.'],
    social:['Invited {n} to something. {n} should probably say no.','{n} attended the ceremony. {n} will not discuss it.','Has named {n} in the schedule. No further details given.'] },
  { id:'doom', name:'Doomsayer', blurb:'Certain it ends badly. Often correct.',
    stats:{mystique:4,cute:-1}, care:{},
    notes:['Predicted disaster. There was a minor spill. It felt vindicated.','Has been "warning everyone" about something unspecified.','Said this was coming. This was dinner. Dinner was coming.','Updated its prophecy to be vaguer and therefore more accurate.'],
    social:['Warned {n} about something that has not happened.','Was right about {n}, for once, and will not let it go.','Comforted {n} about the coming doom. Badly.'] },
  { id:'clingy', name:'Emotionally Adjacent', blurb:'Always slightly closer than you left it.',
    stats:{cute:2,menace:-1}, care:{fuss:1.6},
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
