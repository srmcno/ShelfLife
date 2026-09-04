# Shelf Life

Small creatures with needs, opinions, and long memories. They cannot die. They have looked into it.

A dark-comedy tamagotchi that runs entirely in the browser. You make little monsters, they live on a
shelf, and they get hungry, bored and filthy in real time whether the game is open or not. Who they
stand next to matters — neighbours feud. So does how you treat them: they keep score, and the notes
they leave you are the actual point of the game.

No build step, no dependencies, no backend. Plain ES modules and one stylesheet.

---

## Running it

It must be served over `http(s)` — ES modules and the service worker do not work from `file://`, so
double-clicking `index.html` will not work.

```bash
cd shelf-life
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static host works. Because there is no build step, deploying is just copying the directory —
GitHub Pages, Netlify, S3, whatever.

### Installing it as an app

There is a web manifest and a service worker, so it installs to a phone home screen ("Add to Home
Screen") and as a desktop app in Chrome/Edge ("Install app"), and it runs offline after the first
visit. The service worker is **network-first for the app's own JS/CSS/HTML** and cache-first only for
icons — an earlier cache-first-everything version meant a returning player kept getting stale code and
never saw updates.

---

## Playing

- **Make a pet** — the studio. Generate a creature from designed parts, or draw one freehand.
- **Check the shelf** — advances the world and produces notes. This is where the writing lives.
- **Do the rounds** — top everyone up at once. Efficient. They notice it was the rounds.
- **Tap a pet** — its card: needs, bond, grievances on file, traits, and the care buttons.
- **Drag a pet** — rearrange the shelf. Adjacency drives feuds, so this is a real decision.
- **Decorate** — six room themes, wall patterns, shelf woods, trim colours, and furniture that has
  actual mechanical effects on the pets standing next to it.
- **Incidents** — the achievements log.
- **Mature** — off by default. Turns on cruder, sweary variants of the writing.
- **Narrator** — reads notes aloud. See the note on voices below.

Pets act on their own: they relocate toward furniture they like and away from pets they don't, claim
and hoard props, steal from neighbours, and — if they have the anatomy for it — climb, hang off the
shelf edge, or sneak at night. Each move is explained in a note, so you can infer the motive.

---

## Layout

```
index.html            manifest.webmanifest    service-worker.js
css/style.css
src/
  main.js             boot + all wiring
  state.js            save/load/migration; the only file touching localStorage
  content/            traits, copy, feuds, props, decor, dialogue, mature-mode overlay
  engine/             tick, care, unlocks, achievements, loop, behavior, dialogue
  art/                stamps, creatures, sprite, animator, anatomy, studio
  audio/              sound (Web Audio SFX), narrator (SpeechSynthesis)
  ui/                 render, card, decorUI, drag, toast
test/                 node:test suites
docs/                 design docs, comedy direction, implementation plan
```

Imports point one way only: `state` → `content` → `engine` → `art`/`audio` → `ui` → `main`. Nothing
imports back up the stack, which is what let a dozen parts of this be built in parallel without
tangling. Every engine function takes `state` as an explicit first argument rather than reaching for a
global, which is what makes them testable with throwaway fixture states.

Content is fully separated from logic: adding fifty traits never touches animation code.

---

## Tests

Node's built-in runner. Zero dependencies, nothing to install.

```bash
node --test test/*.test.mjs
```

Pure logic (needs decay, mood, care, unlocks, grudges, feud arcs, streaks, behaviour, content
integrity) is covered here. The DOM-facing modules — rendering, animation, the studio, audio — are
verified by hand in a browser instead, since adding jsdom would mean adding the dependency and build
step this project deliberately doesn't have.

**`node --check` is not sufficient on its own.** It only validates syntax, so it happily passes a file
that imports a name another module doesn't export — that shipped twice here and produced a silently
dead page with nothing in the console. To catch it, load the app and force a re-evaluation:

```js
import('/src/main.js?v=1').then(() => 'OK').catch(e => 'ERR: ' + e.message)
```

---

## The narrator voice

The narrator uses the browser's built-in speech synthesis, so the available voices are whatever your
OS has installed — the game cannot ship a voice.

On macOS the only British voice present by default is **Daniel**, in its low-quality *compact* form.
The single biggest improvement available is installing the enhanced version:

> System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → English (UK) →
> **Daniel (Enhanced)**

Then reopen the page and pick him in the **Voice** panel. The game surfaces this hint itself rather
than quietly sounding bad. A voice picker is provided so you can choose any installed voice and
preview it.

---

## Saves

Everything lives in `localStorage` under `shelflife.v4`. **Back up** downloads a JSON file; **Restore**
loads one. Saves from older versions are migrated forward on load, so upgrading never loses a shelf.

Pet art is stored as data in the save, so a shelf of eighteen creatures is meaningfully sized — vector
creatures are compact, hand-drawn ones less so.

---

## Notes on the writing

The humour is the product, so it gets treated as such. `docs/comedy-direction.md` is the working
direction — voice, the rotation of note forms, which state the notes are allowed to know about you,
and a kill-list of failure modes. Its central rule, if you only keep one:

> A line that would survive being said by an adult in a flatshare is not a Shelf Life line. These
> things are four inches tall, wrong-textured, on a numbered grid, and cannot die. Every line should
> break if you removed that.

Mature mode is opt-in, off by default, and adds profanity for comedic emphasis in the same deadpan
register. It is crude in-fiction, aimed at the player and at other pets. It contains no slurs and no
sexual content.
