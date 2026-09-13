# A living cabinet

The September play rug edition brings the playable household to the front.

## Direction and acceptance

- The home screen is a piece of furniture with residents, one timely invitation,
  and a few useful actions. Stories, workshop and the journal have real destinations
  on desktop as well as phones. Every existing workflow stays reachable.
- The Play rug is immediately playable with the player's actual resident: toss a
  cloth ball, try a bounce pass, blow bubbles, pop them and watch the creature chase.
  Touch, pointer and keyboard have equivalent actions. No timer or loss pressure.
- Six little tricks belong to each resident. New tricks earn one discovery once;
  care, adventure credit and game completion retain their existing rules.
- Existing drawings, generated creatures, furniture, topology, names and histories
  survive. The cabinet always has six columns per row.
- Stop simulation on close, backgrounding and long frame gaps. Keep the stage clear,
  bound toy counts, reuse render nodes and respect reduced motion for decorative effects.
- Verify real throws, catches, bubble pops, saved rewards, reload, no duplicate payout,
  care and modal handoffs on desktop Chromium and phone Chromium/WebKit before release.

## Visual language

The room uses walnut, lamplight and dusty rose textiles: plum `#261e2b`, walnut
`#644436`, rose `#df858e`, lamplight `#eab586`, sage `#a4cab5` and warm ink
`#f4e6d6`. Gloock supplies the story titles, Karla the controls, Caveat the
resident's small remarks. Controls stay outside the playfield. The new illustrated
room is a quiet backdrop; all residents, toys and effects are live, separate objects.

The simulation has a small command/event interface and no browser dependency.
Save normalization owns the bounded trick history. UI owns input, rendering,
sound, focus and visibility. Toy positions are transient; earned discoveries save
as they happen, without requiring an end-session button.

## Work record

- [x] Inspect existing fresh/established desktop and phone screens.
- [x] Review Game Studio's UI, architecture and playtest guidance; apply
  mattpocock's deep-module design guidance.
- [x] Check Game Development Studio readiness: `game-dev` is not installed.
  Use existing local browser/Playwright tooling; no CLI execution or provider claim.
- [x] Create and optimize original playroom illustration.
- [x] Integrate cabinet destinations and toy play.
- [ ] Complete domain, browser, accessibility and release checks.
- [ ] Publish and verify the exact Pages revision; audit clean repository state.

Review corrections include explicit animation ownership for the rug puppet,
focus restoration after pausing, truthful feedback when browser storage is full,
and readable thought bubbles anchored within the smallest cabinet layout.
The browser test preview now uses the existing Node runtime to avoid local Python
server startup and DNS stalls; production remains a static, dependency-free PWA.
Direct pointer testing also caught an SVG visibility bug in the aiming guide;
its visibility now uses the SVG attribute rather than an HTML-only property.

Local domain checks passed 776 tests and all four Python checks. The first full
browser pass passed 72 cases, then exposed a 320px WebKit selector overflow and
host browser stalls. The overflow has an intrinsic-sizing fix, with the original
assertion retained. Direct drag, cancellation and bubble tapping passed after the
aim-guide correction. The release runner must pass the entire final matrix;
local startup and browser-protocol timeouts do not count as passing checks.

## Original illustration

`assets/rooms/play-rug.webp` was generated for this project with the built-in image
tool on 2026-09-13, then encoded as WebP (1536 × 1024; about 203 KiB). It is
decorative art, not a simulated game frame. Source generation file remains in the
local Codex generated-image folder. No third-party stock asset was used.

Generation prompt:

> Use case: illustration-story. Asset type: finished background illustration for the interactive play rug in Shelf Life, a whimsical darkly comic browser game about four-inch household creatures. Generate a wide 3:2 game environment image, no text, no characters, no interface, no balls or bubbles. Camera almost straight-on at tiny creature eye level, a gently elevated view of a miniature room made inside an old walnut cabinet. The lower half is a large oval faded dusty-rose braided fabric rug extending nearly edge-to-edge, its rear edge at 54% down and front edge at 96% down, flat enough to be a game play surface. All objects sit only around the edges, with a spacious quiet central playing area. Upper-left a tiny amber table lamp made from a brass thimble and cloth shade, a small stack of old illustrated books nearby with no legible text. Upper-right a rounded window with a dusky teal night sky and small warm stars, and a little curtain; on the far right a blue-green sewing tin. Warm plum and walnut wooden walls, fine joinery, intimate lamplight, russet and muted sage details, soft pools of golden light. Style: beautifully crafted illustrated indie game, confident drawn contours, hand-painted gouache textures, slightly wonky charming objects, tactile materials, sophisticated color grading and gentle shadows, stylized readable shapes, not photoreal, not a crude vector mockup. Keep the mid-center open, low contrast and brighter enough for colorful creatures to read. No monsters or humans, no eyes/faces on furniture, no spooky skulls, no text, no watermark. This must be a polished production game background, no outer frame.
