# Shelf Life

**[Play Shelf Life](https://srmcno.github.io/ShelfLife/)** · [Report a problem](https://github.com/srmcno/ShelfLife/issues/new/choose)

Small creatures. Long memories. A free, darkly comic creature game for phones and desktops.
Make peculiar residents, look after them, play together and collect the evidence of a small life.
They cannot die. They have looked into it.

## Make yourself at home

Meet Mabel, Pip or Oswald, or create someone entirely your own. The face you choose is the
face you take into the creator. Change its features, colours, name, quirks and backstory,
or draw a creature with your own hand. Appearance changes later keep its personality and history.

Tap a resident for food, attention and a wash. Individual care builds trust and unlocks furniture.
**Do the rounds** gives everyone a modest top-up; **Notes → Check the shelf** collects their latest opinions.
Drag residents and furniture to rearrange them. On a phone, hold first. Each row always has six
positions: neighbours, furniture, wings, horns and personalities have real effects.

The cabinet gets its own screen. The same five destinations work on phone and desktop:
**Shelf**, **Play**, **Stories**, **Notes** and **More**. Stories holds little adventures,
household correspondence and the workshop; folders keep their contents within easy reach.

The cabinet also hosts small domestic scenes. Place appropriate furniture near residents and choose
**Play a scene**, or let them improvise while you watch. Bowl servings, lamp switches, relationships,
requests, case files and keepsakes persist. The residents remember how you treat them.

## The play rug

Take any resident onto a lamplit rug with a patchwork ball and an improbable number of bubbles.
These are your actual creatures, including the ones you drew. They scamper, jump, catch and pop;
you can give them a snack, some attention or a wash without leaving the room.

Tap to toss, or drag and release to aim your own throw. Try **Soft toss**, **Sky high** and
**Bounce pass**, or blow bubbles and race your resident to pop them. The toy controls also work
with a keyboard. Six little tricks belong to each resident, from their first catch to five
catches in one visit. Each new trick earns one discovery, saves immediately and becomes a
memory in the scene journal. Repeating it is for the pleasure of being very good at something.

There is no timer or penalty for leaving. Backgrounding pauses the toys; reopening starts a
fresh rug with your earned tricks intact. The rug is free play. Little adventures still ask
you to finish one of the games in the Playroom.

## Little adventures

Your residents now have plans. Share a personal care moment, finish a game together and
choose how their story ends. Build a crumb observatory, audition a very small ghost or
prepare an unbirthday: eight stories lead to sixteen illustrated keepsakes.

Each story offers two ways to play. An imperfect game or completed practice still counts;
the important part is doing it with the resident who invited you. Do the care and game in
either order, then choose the ending. Progress waits through closing, reloads and days away.
There are no deadlines or streaks to lose, and another story is always available.

The keepsake album records the original maker. Replaying an ending makes a new household
scene with the current resident; each different ending earns two discoveries once.
Residents can recall the moments they actually shared. Collected memories survive renaming
and rehoming, and their exact objects appear in the scene journal.

Time on the shelf leaves its own small record. Residents earn keepsakes after a day, a week,
a month, one hundred days and a year; these are dated from their move-in, never expire and
carry no streak or care penalty. Their habits, old names and changing moods also shape what
they say about the life they have had here.

## The Playroom

| Activity | What you do |
| --- | --- |
| Crumb Chase | Steer, hop and dash for crumbs in a 22-second chase or three-act Midnight Run. |
| Handshake | Repeat, reverse or trade gestures in untimed memory challenges. |
| The Alibi | Find a false statement and prove it with a record from your own household. |
| Expeditions | Pack a tool, choose a crew and recover parts for working household objects. |
| Shelf Court | Inspect evidence, compare verified facts and deduce the only possible culprit. |
| Night Market | Visit eight stalls, buy pairs for three errands and deliver them to fund more shopping. |

Older saved activities retain their original rules. Continue unfinished expeditions, hearings and
market trips from the Playroom. Practice stays available when care rewards need a rest.

Court pairs each clue with the suspect's actual record, with an optional deduction notebook
and a full sentence after the verdict. Expeditions show your crew, packed equipment, route,
exact choice consequences and a saved journey log. Returning home keeps only the parts you
actually recovered; two distinct parts build a permanent household project.

**Notes → Paperwork** keeps the latest 120 filed documents independently of the temporary
note board. Court verdicts, expedition reports, market receipts and resident documents are
filed automatically. You can request a household register drawn from your actual care and
activity records. Clearing notes preserves these documents. Empty filters and display areas
explain what belongs there and how to add it.

On desktop, **P** opens the Playroom. In Chase use arrows or A/D, Space to hop and P to pause.
Touch controls are built into the game. Other games explain their keys beside the actions.
**Escape** closes the current sheet and returns focus to its opener. Motion follows your system
preference; More also offers Automatic, Light and Full effects. The narrator is off until enabled.
Light retains brief gameplay reactions and scene movement while simplifying decoration.
See [the hearing, expedition and paperwork design notes](docs/hearings-and-expeditions.md).

## Your save

The game has no accounts, server or automatic device sync. It stores your household in this
browser under `shelflife.v4`. Clearing browser data removes that local copy.

Use **More → Back up** to download a copy. **Move to another device** offers the device share menu
or a download and email draft. If you use the draft, attach the downloaded file yourself.
On the other device, open Shelf Life and choose **More → Restore**. Restore previews the replacement;
it does not merge two households. JSON and equivalent text backups are accepted.

Earlier save versions migrate automatically. Invalid positions are repaired. Storage failures show
a warning; unreadable saves are preserved as downloadable recovery files. Keep a backup before
clearing site data or switching devices.

After the first visit, the installed game also works offline. Returning players receive a
**Save & refresh** banner when a new edition is available. An active interaction or failed save
prevents that refresh. Installation is available through your browser's app or home-screen menu.

## Development

No runtime dependencies, backend or bundler. Plain ES modules, local styles, SVG creatures and
bundled licensed fonts. Serve over HTTP; opening `index.html` as a file does not support modules.

```sh
node test/serve.mjs
# Open http://localhost:4175
```

Node 24 and Python 3.12+ are used for release checks. Browser tooling is development-only:

```sh
npm ci
npm test
python3 -m unittest discover -s test -p '*_test.py'
npx playwright install chromium webkit
npm run test:browser
npm run build
```

The browser suite uses isolated synthetic households and a separate local server. It checks
creation, saved appearance, care, all six activity entrances, completed adventure endings,
interrupted play, full court hearings and expedition returns, report persistence,
replay identity, all sixteen keepsakes, real rug catches and bubble pops,
cancelled gestures, failed saves, responsive layouts and runtime errors
in desktop Chromium and phone-sized Chromium/WebKit. Offline reload is tested in Chromium;
Playwright does not support WebKit service-worker tooling. This is browser automation, not physical-device
testing. `test/responsive-harness.html` provides additional local fixture exploration.

| Location | Responsibility |
| --- | --- |
| `src/state.js`, `src/life-state.js` | Saves, validation, migration and bounded history |
| `src/play-rug-state.js`, `src/engine/play-rug.js` | Resident trick collections and a bounded toy simulation |
| `src/engine/` | Testable gameplay rules and state transitions |
| `src/content/` | Traits, writing, activities and creator invitations |
| `src/art/` | Creature/drawing data, SVG rendering, animation and the studio |
| `src/ui/` | Views, interaction, navigation and accessible dialogs |
| `css/` | Shared materials and dedicated game/workspace layouts |
| `test/` | Domain regressions, synthetic households and browser tests |
| `scripts/` | Pages packaging and optional local Mac launcher |

Main publishes to GitHub Pages only after domain, Python and browser checks pass. Packaging excludes
development files and writes the commit to `release.json`; the same revision identifies the offline
cache. Add new production assets to `service-worker.js` and bump its development cache version.
The tests check that the offline shell is complete.

The optional Mac launcher can use locally installed **Daniel (Enhanced)**. Pages uses the voices
provided by each visitor's browser; the local Mac voice is not distributed with the web game.
