# Shelf Life

**[Play the tester build](https://srmcno.github.io/ShelfLife/)** · **[Report a bug or leave feedback](https://github.com/srmcno/ShelfLife/issues/new/choose)**

Small creatures with needs, opinions, and long memories. They cannot die. They have looked into it.

A dark-comedy tamagotchi that runs entirely in the browser. You make little monsters, they live on a
shelf, and they get hungry, bored and filthy in real time whether the game is open or not. Who they
stand next to matters — neighbours feud. So does how you treat them: they keep score, and the notes
they leave you are the actual point of the game.

No build step, no runtime dependencies, no backend. Fonts and their licenses are included locally for consistent offline rendering. Plain ES modules and local stylesheets.

---

## Market errands and stronger Court deductions

New Night Market trips are household errands. Start with ten buttons, visit six stalls and carry up to three objects. Each of three errands asks for a pair of distinct objects. Deliver a matching pair through the porter: both objects leave the bag, two spaces open, and the household pays four buttons so shopping can continue. A delivered object cannot fulfil another errand. Deliveries are available between stalls and after the final purchase, before choosing to return home.

The full route and every price are visible. Every generated route has a legal way to fulfil all three errands within the budget. Score is ten points per delivered errand plus buttons returned; purchases left in the bag earn nothing. One return, for one button while buying its replacement, remains available. New trips have no charm score or secret-selling penalty. Delivery receipts name the actual objects and the household's reaction to that errand. Vendor dialogue and item descriptions now respond to the shopping situation.

New Court hearings start at Curious difficulty for a new player. Cozy remains available. The revised puzzles vary exclusions, inclusive either/or, exclusive either/or, conditional evidence and linked observations. Every case has exactly one culprit, and every clue is necessary. Compound exhibits inspect both factual sources. An unsupported attempt to clear someone costs five case points; repeating the same failed argument cannot charge twice, and explanations are free. Incorrect accusations remain recoverable. Suspect remarks and acquittals are specific to each of the twelve cases; exposing a lie is labelled “account corrected”, never “cleared”.

In-progress older Court and Market games keep their original rules and deterministic replay. Existing saves, rewards, keepsakes and market records are preserved. New errand scores have a separate best record. The new version remains offline-capable and included in backup transfers.

## Court reasoning, restored Chase controls, and recovery missions

Court now follows one deduction: inspect the crime clues, compare each suspect’s verified facts, clear anyone who conflicts with a clue, then accuse the one who fits all of them. Every visible exhibit participates in the solution. An unrelated lie no longer blocks a verdict. Comparisons, acquittals and saved cases retain their explanations. The courtroom has a substantial scene again; on portrait screens the scene and case file share one scrolling column above a persistent action dock.

Chase restores the original **left / Hop / right** movement row. Dash sits above the arena as an optional extra. Portrait arenas use the available width, movement stops when a drag ends, and touch actions fire on press without double-firing on the following click. Keyboard and assistive clicks remain supported.

Expeditions now offer three recovery contracts: the Button Lift, Midnight Larder and Thimble Bath. Recover any two distinct components through three written encounters to install a working household object. Parts persist across trips; once the objective is secured you can return immediately or explore further. Each object provides its advertised attention, food or cleanliness benefit once a day, and remains playable afterwards. In-progress older expeditions retain their encounters and rewards.

The existing Handshake, Alibi, Night Market, household scenes and saved progress remain supported. Browser verification covers the public desktop build; physical phone rendering must still be checked on a phone.

## The full household update

- **Investigative Shelf Court:** inspect the crime evidence, compare verified observations, and eliminate innocents with specific conflicting clues. Twelve case families, three levels, scoring, appeals and a fully saved hearing. The current action stays in a visible Court footer on phones.
- **Midnight Run:** three 18-second Chase acts with contracts, two lasting upgrade decisions, telegraphed broom sweeps and a gold finale. Quick Chase remains available; run records and rewards are separate.
- **Three handshake rituals:** Echo, reverse-order Mirror and alternating-beat Duet, with distinct records, stage lighting and exact challenge replay.
- **Alibi with proof:** pair the false statement with its matching household record. Unsupported evidence cannot earn a clean win; casual spot-the-lie mode is available.
- **Expedition wagers and market secrets:** optional route challenges reward careful resource choices. Earlier market trips include rare stock and a once-per-trip secret sale. Those saved trips keep their rules; new markets use the errand system described above.
- **Scenes that follow the story:** each household scheme has its own objects and staged actions, selected from the recorded outcome. Visitors retain their actual appearance and returning expeditions show the relic they brought home. Replays have pause, manual steps and a finite ending; previews stay still.
- **Darker writing throughout:** revised care notes, trait behavior, visitor arcs, testimony, game reactions and shopping outcomes.
- **Phone navigation:** Shelf, Play, Notes, Stories and More are reachable from the bottom bar. Larger controls, remembered tab positions, readable sheets and a return to the Playroom after games reduce repeated navigation.

## Move your shelf between devices

Open **More → Move to another device**. **Share backup…** opens the device share menu where supported. Choose an email app, another device, or Files. The save is shared as JSON, or as an equivalent `.txt` file when the browser cannot share JSON.

If sharing is unavailable, choose **1. Download backup**, then **2. Open email draft**. Address the email to yourself and **attach the downloaded file manually** before sending. The draft includes restore instructions; a browser cannot attach a local file through an email link. You can also use your usual email website.

On the other device, save the attachment, open [Shelf Life](https://srmcno.github.io/ShelfLife/), and choose **More → Restore**. Both `.json` and `.txt` backups use the same validated restore preview. Keep a backup of any existing shelf before replacing it. This transfers a snapshot of residents, art, game progress, settings and memories. It does not merge shelves or sync automatically. Send a fresh backup from the device you last played on each time you switch.

The app does not send email itself or require an account. A completed share action confirms a handoff to the device, not delivery of an email. Backups now have dated filenames so copies are easier to tell apart. Existing backups still load.

## After-hours update

- **A proper Shelf Court:** an illustrated courtroom with a judge, dock, gallery, testimony, exhibits, objections and staged verdicts. Twelve darkly comic offences generate different evidence and suspect lineups. Choose Cozy, Curious or Tangled reasoning, cross-examine with exhibits, ask for hints, then present a deliberate verdict. Every case has exactly one answer, and every exhibit is necessary.
- **Crumb Chase with teeth:** direction-controlled Dash smashes dust; catches shorten its recharge. Touch Hop and Dash respond on press, jumps buffer before landing, approaching dust gives a warning, and a final five-gold arc rewards a well-timed hop and dash. Missed crumbs soften a streak instead of erasing it.
- **Expeditions with decisions:** three stops, finite nerve and a single-use packed tool. Preview the trail, weigh safe progress against bold detours, and save your equipment for the right obstacle. Different editions, exact-trail replay and nine relics give each route something to revisit. Existing unfinished expeditions keep their original rules.
- **Darker resident comedy:** sharper grudges, manipulative affection, mortal envy, macabre shopping stock and consequential trial testimony replace weaker whimsical and bureaucratic filler. Residents remain immortal; their histories and relationships stay intact.
- **The Playroom:** one always-visible doorway to all six activities, with an accomplice picker, personal records and a six-activity household passport. Suggested activities prioritise saved expeditions and markets, then untried games. Completed practice counts. Press P when no dialog or form control is active.
- **The Unlicensed Night Market:** a saved six-stall strategy game. Ten buttons, three bag spaces, previewable stock and three deliverable household errands. Collect new curiosities, compare your haul with the best attainable score, and replay the same market or visit a new one.
- **Remix without losing the good bits:** pin a body, individual features or colours before using Surprise me. Undo and redo are available from the creator and its keyboard shortcuts.
- **Better Crumb Chase practice:** select a side quest, repeat a course, track the next star and receive specific coaching after each run. Venue stars and score records retain their separate personal bests.
- **A calmer interface:** no independently scrolling desktop case column, a scrollable settings drawer on short screens, and keyboard access to expandable details.
- **Phone controls:** collapsible Chase settings, four large controls, scrollable results, larger touch targets and readable form fields. Cancelled or sideways swipes no longer dismiss a game.
- **Reliability:** more precise day/night catch-up, corrected care shortcuts and countdown refreshes, less unnecessary DOM replacement, and cancellation of stale animation work.

Existing shelves and backups continue to load. Playroom records come from the existing save, and the market stores its seed and choices so a resumed trip rebuilds the same stock and score. The Pages build includes the new modules in its offline shell and identifies each deployment by its Git commit in `release.json`.

## A larger small world

- **Beyond the shelf:** three expeditions, equipment and companion choices, nine illustrated curiosities, persistent progress, and shared resident history.
- **Shelf Court:** twelve case families starring your own residents, three chosen reasoning levels, and evidence explanations after every verdict.
- **Return visitors:** all twelve callers have three distinct chapters. Calling cards rest for fifteen minutes; missing a visit never costs trust.
- **Your collection:** display three keepsakes, unlock four cabinet finishes through discoveries, and replay short household scenes. Returning players get a factual recap.
- **More personal creatures:** edit a resident’s appearance without losing its history, and keep up to six reusable generated designs. Feature choices stay ordered and named.
- **Better active play:** three Crumb Chase grounds with separate records and different mechanics; clear handshake gesture labels; completed practice remembered by the household. Each game has its own reward rest, with the existing daily bonus-trust cap.
- **A quieter introduction:** meet your first resident, care for it, then play together to open the wider household. Established saves go straight to their shelf.

Scenes use finite animations and local vector artwork. Light effects, reduced motion, hidden-tab pauses, offline caching, and backup restoration remain supported. No accounts, paid shortcuts, ads, or streak penalties were added.

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

- **Make a pet** — choose a feature, browse previous/next variants in a fixed order, or choose its name from the dropdown. Only **Surprise me** randomizes the whole creature. Other parts and proportions stay put while you browse. Grow a creature from designed parts, or draw one freehand. The drawing studio has a live animated preview, full-resolution ink, and independently animated arm and leg stamps. Transparent margins are fitted automatically, including on older drawings.
- **Check the shelf** — advances the world and produces notes. This is where the writing lives. It restocks for a few seconds between checks, and a resident files at most one grievance an hour, so reading often never costs you.
- **Do the rounds** — add 13 to every need, with a one-minute trolley restock. Rounds build no trust. Individual care shows its actual gain, including sleep, saturation, and the meter cap. New arrivals need a little care so the first trust point is within reach.
- **Tap a pet** — its card: needs, bond, grievances on file, traits, and the care buttons.
- **Watch them.** Residents blink, glance at each other, face the way they walk, and cross the shelf in the gait their body allows (walkers plod, hoppers bounce, flyers arc, oozes stretch). Neighbours whisper, shove, sniff, glare across a feud line and wake each other up; furniture gets poked and rocks. Short thought bubbles come from `src/content/bubbles.js`.
- **Move a resident** — drag it, or use the position selector in its card. On phones, hold before dragging. Adjacency drives feuds and furniture effects.
- **Decorate** — six room themes, wall patterns, shelf woods, trim colours, and furniture that has
  actual mechanical effects on the pets standing next to it.
- **Weekly case files.** Six-beat household mysteries live in Plots. File clues, care for a witness, move it to B1 for a reconstruction, and earn confidence through a handshake or useful care. Listening and keeping residents comfortable leads to a cooperative ending; dismissing evidence leads to a different resolution. An unfinished file never expires. Three cases rotate weekly.
- **Fine character details.** Ordered feature pickers now include eye size/spacing, mouth size and posture sliders, three custom colour controls with matching body shading, reset and a 30-step undo history. Colours and proportions survive body/part changes and backup restoration.
- **Animation & performance.** More → Animation & performance offers Automatic, Light and Full effects. Automatic uses Light on touch devices, low-memory devices or shelves with eight residents. Shelf updates reuse creature/prop nodes, skip unchanged notes, batch story validation and save once. Hidden and offscreen sprites pause; games suspend background shelf maintenance. Chase movement uses transforms and changes score labels only when their values change. Core reactions, walking, wing motion and landing squash remain animated in Light mode; system reduced-motion preferences take priority.
- **Temporary visitors.** Twelve distinct guests arrive in a saved shuffle bag at a separate visiting step, including on solo or full shelves. Welcome one within six hours to collect its souvenir in the museum. Another arrives 8–18 hours after departure. Guests have unique portraits, return greetings and host-aware replies; a full cycle meets everyone before repeating. Madam Moth retains her original seeded design. After welcoming a guest, wave goodbye and send a calling card to invite another random guest, at most once every fifteen minutes. Natural visits still arrive while away; invitations survive reloads and welcome trust shares the daily bonus cap. No notification permission or account is needed.
- **Resident requests.** In a resident’s card, accept a request based on actual needs: food, attention, washing, a Handshake, Crumb Chase or Alibi win (including practice), useful furniture, a compatible neighbour or a different room. Existing arrangements are not offered as new chores. Fulfil it within twelve hours for +1 trust. Refusing costs up to one trust and adds a grievance. Requests influence movement toward the promised neighbour or prop.
- **Relationship cards.** Time beside one another builds friendship when both residents have trust; two shared supervised plots make co-conspirators. Rivals can be mediated into uneasy allies once both have three trust. A truce removes active feud unrest.
- **Made this way.** Wings affect travel and allow longer jumps and a second flap in Crumb Chase; horns intimidate gentle neighbours; halos slow neighbouring attention decay by 10%. Anatomy cards and arrival notes explain the effects for generated and stamped drawings.
- **Play together.** Crumb Chase puts your resident under direct control for 22 seconds: steer with touch or arrows, hop over dust bunnies or land on them to stomp, catch golden crumbs, and build a combo streak that multiplies every catch. Moths steal floor crumbs; catching a carrying moth rescues its crumb toward the goal, biscuits are worth 50 if caught before they land, and a sugar cube gives a short rush of speed and a crumb magnet. Catch eight crumbs to win (six at Gentle pace) and earn up to three stars. Wings extend jumps, horns block one collision, halos attract crumbs, and tails bounce higher off a stomp. Rotating side quests award 40 points once for a streak, airborne catches or a whole biscuit. Each resident keeps separate Standard/Gentle scores plus the historical overall best, streak and star rating. The secret handshake is an alternative memory game: the resident visibly demonstrates each gesture across three short rounds (four at high trust), with an optional five-round Encore. Slips repeat the current round without losing earlier progress; the best completed run tracks slips and replays, including practice. Winning either game gives up to +24 attention and +1 trust, with a separate five-minute reward rest for each game. Practice can still set records. Collisions and losses never harm shelf needs; leaving the tab pauses the chase.
- **The Alibi.** Find the false statement in three rounds of testimony about your own shelf. An untimed evidence notebook freezes the true facts at the start; keys 1–3 choose a statement. Verdicts show TRUE/FALSE stamps and the recorded evidence, and wait for **Next statement** so you can read at your own pace. A clean sweep earns up to +20 attention and +1 trust, with the same reward rest as the other games. The resident card now exposes its care and rewarded-game counts.
- **Memory museum.** Read completed cases, kept promises, visitors, truces, former residents, name histories and grievances. Keep up to six postcard thumbnails in its album; Back up includes the museum. This browser edition has no native OS widget or advertising.
- **Small conspiracies.** A rotating set of plans with two choices and an unsupervised outcome. Choices visibly trade needs for trust. Residents act on their own after three minutes; the next plan arrives five minutes after resolution. A return from offline resolves at most one outstanding plan. Games, visitor welcomes and conspiracies together add at most three trust per resident per day; individual care is uncapped.
- **Trust** — individual care and supervised schemes unlock furniture and drawing tools. The strip below the cabinet shows the next furnishing; trust is stored as `bond` in the save for compatibility.
- **Incidents.** The achievements log, with a hint for everything still unearned.
- **Postcard of the day.** A prominent shelf panel highlights discoveries, case endings and truces. The camera in the corner of the case (or More, then Postcard) draws the shelf, a note and a caption to a 1080 by 1350 picture you can share or save.
- **Night.** After eight in the evening the room goes dark, the eyes catch the light, and the moon in the status line shows the real phase with a comment from the shelf.
- **Notes board.** Filter chips for overheard scenes, complaints, paperwork and plots, and a tap on any byline keeps one resident's paper trail. On a phone the newest note also peeks onto the shelf tab.
- **What needs you.** A row of chips under the shelf for anything with a clock on it: a live conspiracy and its countdown, offered requests, a visitor at the door, a case beat ready to file, and anyone below thirty on a need. Each chip goes where the thing is decided.
- **Grievances, explained.** A resident's card lists its last few grievances with a reason and a time, so a falling trust number is never a mystery. The four particulars act too: cute sweetens fussing, menace wins arguments over furniture, damp attracts grime, and mystique attracts case files.
- **On a phone.** All six spaces fit the screen with no horizontal scrolling; the rows retain their real adjacency and resident cards provide larger portraits. The app is a three-tab layout (Shelf, Plots, Notes) with a bottom bar and a More tray. Cards and sheets rise from the bottom and can be pulled down to close; the notes tab badges when a check of the shelf adds new notes.
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
  content/            traits, copy, care voices, conspiracies, feuds, props, decor, dialogue, thought bubbles, postcard captions
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

Everything lives in `localStorage` under `shelflife.v4`; the first successful save retires any older `shelflife.v1` to `v3` keys. Furniture a build no longer knows is put away on load rather than rejecting the shelf. **Back up** downloads a JSON file; **Restore**
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

One voice throughout: contextual dark comedy responds to actual needs, promises, neighbours, games and care history. Older backups automatically discard the retired Mature setting.

Care effects distinguish falling crumbs, floating soap bubbles and hearts. Guest portraits preserve their animation and the host selector during shelf refreshes; reduced-motion preferences are respected.

## Release checks

The automated suite includes save corruption and storage quota recovery, drawing bounds and framing,
hand-drawn limb capabilities, scheme outcomes and cooldowns, offline cache completeness, and cache
isolation. GitHub Actions runs it on pushes and pull requests using Node 22.

Returning players see a **Save & refresh** banner when a new worker takes control. An open interaction or a failed save prevents that refresh.

Before publishing a changed release, bump `CACHE_VERSION` in `service-worker.js` and check that
`SHELL` includes every production module and asset. The tests verify the module list. Serve the
repository root over HTTPS for installation; localhost works for development.

Keyboard controls: Tab to move between controls; Enter or Space to activate; Escape to dismiss a
sheet. Sheets trap focus and return it to the opener. Motion follows the operating system's
reduced-motion preference. Clear notes has an undo until the page reloads.

Creature motion uses separate hips, knees, shoulders, and elbows, including drawn limb stamps. Alternating foot plants, torso weight shifts, arm counter-swings, and gesture follow-through replace rigid limb rotations. Different anatomy walks, scuttles, flies, hops, or oozes; the studio and resident cards include **See it move**. Reduced-motion preferences disable these effects. Service-worker releases refill the shell from the network and offer **Save & refresh** when a newer version takes control.

To reproduce the story-update microbenchmark, run `node scripts/benchmark_stories.mjs`. It uses 18 residents, 100 memories, 36 former residents and six postcard thumbnails. On the development runtime, the median fell from 0.60 ms to 0.07–0.10 ms per update after nested validation was batched. This measures simulation work only, not browser frame rate.
