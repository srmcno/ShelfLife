# Little adventures

This pass gives the existing games a resident-authored purpose. One ongoing
adventure connects a personal care moment and a completed activity to a chosen
ending, an illustrated keepsake and a memory the actual resident can recall.

## Product rules

- Eight authored stories, two activity approaches and two distinct endings each.
- One active story; progress survives closing, reload, offline use and long gaps.
- Count real individual care and finished play, including practice and imperfect
  results. Opening or cancelling a game does not count. Full needs cannot block
  the care moment; only the actual participating resident earns progress.
- Endings award their two discoveries once. Replaying cannot multiply rewards.
- Keep collected stories after renaming or rehoming their participants. Retire
  orphaned active stories safely rather than crediting a different creature.
- Show the next step on the shelf, resident card and Playroom. Explain saved
  activities with another cast before sending the player back to that activity.
- Preserve the first maker in the album; celebrate the actual current resident
  in a replay finale and its recorded scene. Each ending has its own scene prop.

## Implementation

`escapade-state.js` is a bounded save/reducer module without engine imports.
Existing care and game completion paths report actual participant IDs to it.
`engine/escapades.js` owns starting, finishing and a pure view of saved progress.
Content and SVG art live separately from the dialog and shelf presentation.

The existing save, backup, scene journal and offline shell include adventures.
No runtime dependency, server, account or migration that discards player data
was added. New stories are immediately available; there is no calendar gate.

## Verification

The September 13 development pass passed 738 domain tests, including all story
approaches, sixteen unique endings, capped rewards, stale callbacks, malformed
saves, actual cast attribution, replay identity and authored scene lifecycle.

The full browser suite passed 58 scenarios across desktop Chromium, phone-sized
Chromium and WebKit. It completed real 22-second Chase adventures and imperfect
Market trips, checked interruption/reload, full-needs care, another crew's saved
trip, original/replay receipts, and all sixteen keepsakes with long names at
320px. The final active-brief wrapping correction passed all three browsers.
The two intentional skips are desktop-only absence of mobile tabs and WebKit
service-worker offline emulation. Chromium offline adventure/care checks pass.

Independent review found and verified fixes for replay attribution, long-name
layout overflow, and saved-case guidance. Additional phone, landscape and desktop
handoffs preserved dialog focus and produced no observed browser errors.

Release gates remain the domain, Python, browser and packaging checks in the
Pages workflow. Verify `release.json`, the service-worker revision and important
live gameplay against the published commit when delivering a release.

This is browser automation and local playtesting, not physical-device testing.
The intended improvement is a clearer emotional reason to play and return;
retention and player enjoyment have not been measured with real users.
