# Shelf Life

**[Play the tester build](https://srmcno.github.io/ShelfLife/)** · **[Report a bug or leave feedback](https://github.com/srmcno/ShelfLife/issues/new/choose)**

Small creatures with needs, opinions, and long memories. They cannot die. They have looked into it.

A dark-comedy tamagotchi that runs entirely in the browser. You make little monsters, they live on a
shelf, and they get hungry, bored and filthy in real time whether the game is open or not. Who they
stand next to matters — neighbours feud. So does how you treat them: they keep score, and the notes
they leave you are the actual point of the game.

No build step, no runtime dependencies, no backend. Fonts and their licenses are included locally for consistent offline rendering. Plain ES modules and one stylesheet.

---

## Running it

For testers, open the link above. No installation or account is needed. Progress is saved in
that browser on that device. Use **More → Back up** before clearing browser data or moving to
another browser. The public site starts its own shelf; it does not inherit a localhost save.
Narration uses each tester's available browser voices, so the accent and quality can vary.

### Local development and the optional Mac app

On this Mac, open **Shelf Life** in your user Applications folder. The launcher starts a
server available only on this computer and opens the game in your default browser at
`http://127.0.0.1:8766/`. Saves belong to the browser you play in; use **More → Back up**
and **Restore** to move a shelf between browsers. The in-app preview uses the same address.

To install or refresh the Mac application from this checkout:

```bash
python3 scripts/install_macos.py
```

The application includes its own copy of the game and uses the Python installation available
when it was installed. No terminal needs to remain open while playing. After a restart,
the local server starts again the next time you open Shelf Life.

It must be served over `http(s)` — ES modules and the service worker do not work from `file://`, so
double-clicking `index.html` will not work.

```bash
cd shelf-life
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static host works. Because there is no build step, deploying is just copying the directory —
GitHub Pages, Netlify, S3, whatever.

### GitHub Pages publishing

Push to `main` to run the game and desktop tests, package the static assets, and publish the tester
site through GitHub Actions. Pages must use **GitHub Actions** as its publishing source. The
`Publish tester game` workflow deploys only `dist/`, produced by `python3 scripts/build_site.py`.
Source, tests, documentation, and the optional Mac installer stay in this repository. The deployed
site excludes Python tools, tests, git metadata, and development notes. Each release gets a unique
offline cache version. `release.json` identifies the deployed commit.

The public version has no voice backend and does not yet include prerecorded narration. Daniel
(Enhanced) is a feature of the optional local Mac launcher, not a voice distributed by Pages.

### Installing it as an app

There is a web manifest and a service worker, so it installs to a phone home screen ("Add to Home
Screen") and as a desktop app in Chrome/Edge ("Install app"), and it runs offline after the first
visit. The service worker is **network-first for the app's own JS/CSS/HTML** and cache-first only for
icons — an earlier cache-first-everything version meant a returning player kept getting stale code and
never saw updates.

---

## Playing

- **Make a pet** — grow a creature from designed parts, or draw one freehand. The drawing studio has a live animated preview, full-resolution ink, and independently animated arm and leg stamps. Transparent margins are fitted automatically, including on older drawings.
- **Check the shelf** — advances the world and produces notes. This is where the writing lives.
- **Do the rounds** — top everyone up at once. Efficient. They notice it was the rounds.
- **Tap a pet** — its card: needs, bond, grievances on file, traits, and the care buttons.
- **Watch them.** Residents blink, glance at each other, face the way they walk, and cross the shelf in the gait their body allows (walkers plod, hoppers bounce, flyers arc, oozes stretch). Neighbours whisper, shove, sniff, glare across a feud line and wake each other up; furniture gets poked and rocks. Short thought bubbles come from `src/content/bubbles.js`.
- **Move a resident** — drag it, or use the position selector in its card. On phones, hold before dragging. Adjacency drives feuds and furniture effects.
- **Decorate** — six room themes, wall patterns, shelf woods, trim colours, and furniture that has
  actual mechanical effects on the pets standing next to it.
- **Small conspiracies.** A rotating set of plans with two choices and an unsupervised outcome. Choices visibly trade needs for trust. Residents act on their own after three minutes; the next plan arrives five minutes after resolution. A return from offline resolves at most one outstanding plan.
- **Trust** — individual care and supervised schemes unlock furniture and drawing tools. The strip below the cabinet shows the next furnishing; trust is stored as `bond` in the save for compatibility.
- **Incidents.** The achievements log, with a hint for everything still unearned.
- **Postcard.** The camera in the corner of the case (or More, then Postcard) draws the shelf, a note and a caption to a 1080 by 1350 picture you can share or save.
- **Night.** After eight in the evening the room goes dark, the eyes catch the light, and the moon in the status line shows the real phase with a comment from the shelf.
- **Notes board.** Filter chips for overheard scenes, complaints, paperwork and plots. On a phone the newest note also peeks onto the shelf tab.
- **On a phone.** The app is a three-tab layout (Shelf, Plots, Notes) with a bottom bar and a More tray. Cards and sheets rise from the bottom and can be pulled down to close; the notes tab badges when a check of the shelf adds new notes.
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
  content/            traits, copy, care voices, conspiracies, feuds, props, decor, dialogue, thought bubbles, postcard captions, mature-mode overlay
  engine/             tick, care, schemes, unlocks, achievements, loop, behavior, dialogue
  art/                stamps, creatures, sprite, animator, anatomy, drawing bounds, studio
  audio/              sound (Web Audio SFX), narrator (SpeechSynthesis)
  ui/                 render, card, schemes, dialogs, decorUI, drag, toast, nav (tabs, More tray, phone sheets), postcard
test/                 node:test suites
docs/                 design docs, comedy direction, implementation plan
```

Gameplay engines receive `state` explicitly and can be tested with throwaway fixture shelves. Static content is kept separate from logic. The state loader uses the furniture registry to validate restores; the behaviour engine shares the drawing anatomy contract with the animator.

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

The installed Mac application automatically offers **Daniel (Enhanced)** when that voice is
installed. The local launcher generates full-quality British speech using macOS, including in
browsers that expose only the compact Daniel voice. Speech stays on this computer, works without
an internet connection, and requires no account or subscription. Open **More → Voice → Hear it**
to audition him. An explicit voice selection always takes priority over the automatic choice.

On ordinary web hosting, or if the local voice service is unavailable, the game uses browser
speech synthesis. Voice downloads are managed in macOS Accessibility settings. Installing a voice
does not guarantee every browser exposes it; the desktop launcher avoids that limitation.

---

## Saves

Everything lives in `localStorage` under `shelflife.v4`. **Back up** downloads a JSON file; **Restore**
previews a replacement before loading one. Damaged or duplicate slot assignments are repaired; unusable backups are rejected. Storage failures show a visible warning while retaining the latest changes in memory. An unreadable local save is preserved as a downloadable recovery file before a fresh shelf can overwrite it. Saves from older versions are migrated forward on load, so upgrading never loses a shelf.

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

## Release checks

The automated suite includes save corruption and storage quota recovery, drawing bounds and framing,
hand-drawn limb capabilities, scheme outcomes and cooldowns, offline cache completeness, and cache
isolation. GitHub Actions runs it on pushes and pull requests using Node 22.

Before publishing a changed release, bump `CACHE_VERSION` in `service-worker.js` and check that
`SHELL` includes every production module and asset. The tests verify the module list. Serve the
repository root over HTTPS for installation; localhost works for development.

Keyboard controls: Tab to move between controls; Enter or Space to activate; Escape to dismiss a
sheet. Sheets trap focus and return it to the opener. Motion follows the operating system's
reduced-motion preference. Clear notes has an undo until the page reloads.
