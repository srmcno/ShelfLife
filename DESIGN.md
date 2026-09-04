# Shelf Life v2 — Design

Source of truth for the rebuild. Original single-file prototype: `~/Documents/shelf-life.html` (untouched, kept as reference).

## Goal
A hilarious, dark-passive-aggressive tamagotchi-style shelf game. You draw creatures, they live on a shelf, they have needs, grudges, feuds, and long memories. Works on mobile and PC as an installable app. No backend — static, client-side, localStorage saves.

## 1. File layout (plain ES modules, no build step)
```
shelf-life/
  index.html, manifest.webmanifest, service-worker.js
  css/style.css
  src/
    main.js                 – boot & wiring
    state.js                – Store, save/load, migration
    content/ traits.js, feuds.js, copy.js, props.js, decor.js
    engine/ tick.js, care.js, unlocks.js, achievements.js
    art/ stamps.js, studio.js, sprite.js
    ui/ render.js, card.js, decorUI.js, drag.js, toast.js
  icons/
  README.md, DESIGN.md
```
Content data, engine logic, art/animation, and rendering are fully separated: adding traits never touches animation code, changing animation never touches copy.

Must be served over http(s) — ES modules + the service worker do not run from `file://`. Use any static server locally (`python3 -m http.server`) or GitHub Pages once pushed.

## 2. Layered sprite animation
- The freehand-painted canvas remains the **body** layer (color + shape) — the one part that's genuinely freehand and can't be decomposed further.
- Stamps (eyes, horns, wings, tail, tentacles, etc.) are no longer baked into pixels. Each placed stamp is stored as data: `{kind, x, y, size, rotation, color}`. Rendered as its own absolutely-positioned inline SVG layer over the body image.
- Each stamp kind gets a canned idle animation: eyes/deadeyes/thirdeye → periodic blink; ears/wings/tail/tentacles/antlers → idle sway; horns/stitches → occasional twitch; halo → slow rotate/bob; crown/bow → gentle bob.
- The whole pet container gets mood/trait-driven procedural motion regardless of its stamps: idle bob + breathing, randomized per-pet phase offset (shelf doesn't move in lockstep), shake when furious, droop when asleep, lean-away from a feud neighbor, jitter when very hungry/filthy.
- `prefers-reduced-motion` disables all animation (keyframes + transitions).
- Migration: pets saved under the old flattened-image format keep loading and rendering — they just only get whole-sprite motion, no independent stamp animation. No data loss on upgrade.

## 3. Content & mechanics
- Trait pool expanded roughly 22 → 45+, same voice, sharper writing — more notes/social lines/feud pairs per trait.
- **Grudge payoff**: crossing grudge thresholds (e.g. 5/12/20) triggers a real escalating "reckoning" consequence (shelf rearrangement, an ultimatum note, a bond hit) — not just a counter.
- **Feud arcs**: feuds can escalate (sabotage) or rarely curdle into an uneasy truce, so the shelf has ongoing story rather than static permanent feud state.
- **Incident Log / achievements**: milestone unlocks (first feud, first grudge, full shelf, 7-day streak, etc.) logged with a dark-humor toast — completionist hook.
- **Daily streak**: tracks consecutive check-in days; small unlock nudges tied to streak, not just bond. The existing 48h offline-decay cap stays, so lapses aren't punishing.
- A few more darker-flavored props if time allows (stretch, not core).

## 4. Mobile + PC (PWA now)
- `manifest.webmanifest` + a couple of maskable icons + `service-worker.js` (cache-first app-shell caching for offline + installability).
- Installable to a phone home screen and as a desktop app (Chrome/Edge "Install app").
- Responsive/touch pass on top of the existing Pointer Events drag system; safe-area insets kept.

## 5. Data model & migration
- Save version bump. On load, old single-image pets are wrapped as `{ art: { body: <old img>, stamps: [] } }` so old shelves keep working.
- Storage stays localStorage via the existing `Store` abstraction (already degrades gracefully when storage is unavailable).

## 6. Verification
No JS test framework in scope (would conflict with the "no build step" choice). Manual smoke test via local static server: draw a layered pet and confirm animation, run the decay/feud/care loop, confirm save/reload, confirm offline reload + install prompt, check a mobile viewport in devtools. Flagged explicitly if anything is left unverified.
