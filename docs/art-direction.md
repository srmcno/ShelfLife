I read the real files and looked at the top three directions' screenshots (candlelit desktop/mobile/notes/crop, diorama desktop + parlor, specimen desktop, noir fold).

---

# SHELF LIFE — DEFINITIVE ART DIRECTION

## What I'm taking from where

| Source | What I take | Why |
|---|---|---|
| **#3 Candlelit** (winner) | The whole spatial premise: a near-black room with one lit object in it. Props as real light sources. Light as sort-order on the notes wall. The `--bone` lightness-pin theme trick. `.slot{min-width:0}`. | It is the only direction where the first screenful stops being a document. Four critics agreed. |
| **#0 Diorama** | The `drop-shadow` **chain** (halo → tight offset → long cast) that follows the vector outline, so horns cast horns. The proscenium frame with a raked corner. `.shelf-row{display:flow-root}`. | This is the fix for candlelit's single worst failure — its rim light is a symmetric outer glow that turns hand-drawn monsters into stickers. Diorama's shadows come from *somewhere*. |
| **#4 Specimen** | The typographic register (11.5px tracked caps, tabular figures, Gloock reserved) and — the best single idea in the whole exercise — **the catalogued vacancy**: an empty slot prints its own position mark instead of being a void. | Solves the "vast dead space" complaint that every other direction repainted black and called composition. |
| **#5 Dollhouse** | The plank's front face **is** the nameplate, with the reveal forced dark by `color-mix(var(--wood) 26%, #000)` so one fixed cream ink works on all seven woods. | This kills three separate failures at once: diorama's label bar ruled across the picture, cabinet's cream chips out-shouting the creatures, and the dead 38px `--label-drop` band under every row. |
| **#7 Noir** | The elliptical pool of light on the plank under each figure's feet, and the demotion of "What they left you" from 30px Gloock to a 10px machine label with a rule running off it. | Pools give footing. The heading demotion is the most disciplined line in that file. |

**What I am rejecting outright:** neon-noir's glowing wordmark (it out-competes the cast), storybook's flat-paper thesis (no air), terrarium's pink hardware slab, cabinet's brass plaque and astragal, and every direction's nine-metric status strip.

---

## 1. THE DIRECTION

**The page is a dark room. The shelf is a piece of furniture standing in it with a light above it. The creatures are the only lit, saturated, moving things in the frame, and light is the only compositional tool.**

Everything follows from asking, of every pixel, *where is the light coming from and what is it falling on?* Chrome is not styled — it is either unlit (recedes into the room), engraved (cut into a surface that is lit), or the one ember on the page ("Make a pet"). Emptiness is not a void; it is the unlit part of a room, and where it must be looked at, it is **printed** — an empty slot carries its own position mark, the way an empty plinth in a collection carries its label.

**Four moves carry it:**

1. **One key from above-front-left, and every surface obeys it.** The cabinet's top-left corner takes the rake; row 1 is a stop brighter than row 2, which is a stop brighter than row 3; every creature throws a directional cast shadow onto the back wall down-and-right; every prop that emits light actually emits it.
2. **The cabinet becomes built geometry, not a bordered rectangle.** Side returns, a lit floor, a ceiling shadow, headroom above row 1. You can see the box join.
3. **The plank's front face carries the engraved name.** The dead band under every shelf becomes the shelf itself.
4. **Eleven buttons become four; nine metrics become three, engraved on the case rail under the furniture.**

---

## 2. LIGHT AND SPACE

### The light model, in layers, from back to front

```
body                      flat --night (near-black, the room's own hue)
body::before  (fixed)     wall bloom + room vignette   ← the room, unlit
  .cabinet-wrap           carcass: side returns, cornice shadow, front lip
    .cabinet              interior back wall + key pool + depth falloff
      .shelf-row × 3      per-row exposure (--sl-stop)
        .slots            props' light pools (spill onto neighbours)
          .slot::before   elliptical pool of key on the plank at the feet
            .pet          drop-shadow chain: cast → contact → warm halo
        .plank            lit top lip / dark front face (engraved name)
```

**The key.** One warm source at 32% across, above the case front. It is *declared once* as tokens and consumed everywhere:

```css
body{
  --key:        var(--room-key);            /* per-room bulb, see §6      */
  --key-x: 32%; --key-y: -8%;               /* the source, in cabinet space */
  --cast-dx: 26px; --cast-dy: 18px;         /* every cast shadow agrees    */
}
```

`--cast-dx/dy` is the load-bearing number. Because it is a single token consumed by the creature shadow chain, the prop shadows and the plank's own cast, **nothing on the page casts a shadow in a direction that disagrees with anything else.** That is the thing candlelit did not do and it is why its light reads as an effect.

**Depth falloff.** Three stops down the case. Not opacity on the row — a real gradient on the interior:

```css
.cabinet{
  background:
    /* key pool, hitting the back wall behind row 1 */
    radial-gradient(120% 62% at var(--key-x) var(--key-y),
      color-mix(in srgb,var(--key) 26%,transparent) 0%,
      color-mix(in srgb,var(--key) 7%,transparent) 42%, transparent 74%),
    /* depth: the box gets darker as it goes down and back */
    linear-gradient(180deg, var(--case-lit) 0%, var(--case-mid) 46%, var(--case-deep) 100%),
    var(--night-2);
}
.shelf-row:nth-child(1){--sl-stop:1}
.shelf-row:nth-child(2){--sl-stop:.62}
.shelf-row:nth-child(3){--sl-stop:.38}
```

Row 3 at .38 is *not* dead black — that was diorama's and candlelit's shared failure. It is lit enough to read as unlit floor rather than as a hole. Its own creatures still carry full-strength rim and cast; only the ambient falls off.

### The cabinet is a built object

Candlelit's cabinet is a black div with a magenta outline. Fix it with four elements, all pseudo-elements on `.cabinet-wrap` and `.cabinet`:

- **Side returns.** The existing 10px `::before`/`::after` stiles widen to 22px and become a three-stop gradient — dark outer edge, lit inner face on the left (facing the key), dark inner face on the right. Asymmetric, because the light is at the left. This single asymmetry does more than any amount of border work.
- **Cornice shadow.** `.cabinet` gets `box-shadow: inset 0 14px 22px -10px rgba(0,0,0,.72)` — the top of the box occludes the key, so there is a shadow under the ceiling. This is what makes it read as a *box* rather than a lit panel.
- **Headroom.** `.cabinet` padding-top goes 16px → 30px. Row 1 currently starts immediately under the frame edge, which is why the whole thing reads as a container border. A real vitrine has air above the top shelf.
- **A lit floor.** Below row 3, a 26px band of the case floor catching the last of the key — the bottom of the box, so the frame does not end on a cut.

### Vignette, bloom, grain

One fixed layer, `body::before` (candlelit's approach; do **not** put these on `body` with `background-attachment:fixed` — iOS Safari ignores it):

```css
body::before{
  content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(58% 40% at 50% 6%,
      color-mix(in srgb,var(--key) 12%,transparent), transparent 70%),   /* wall bloom */
    radial-gradient(120% 90% at 50% 42%, transparent 46%, rgba(0,0,0,.55) 100%); /* vignette */
}
```

Grain is a `feTurbulence` data-URI at **4% opacity, `mix-blend-mode:overlay`**, on a second fixed layer. It must sit over the flat black and *not* over the lit wood — so mask it: `mask-image: radial-gradient(120% 90% at 50% 42%, transparent 30%, #000 100%)`. Grain in the shadows, clean in the light. That is how film works.

### Dead space becomes composition — three mechanisms, in priority order

1. **Collapse.** A row holding no creatures drops to 84px (`:not(:has(.pet))`). Already partly in the code as `.row-empty` but it only fires when the row holds *nothing* — a single prop keeps it at full height, which is exactly why candlelit's own hero shot has a 200px black band holding one clock. Change the selector to `:not(:has(.pet))` so a prop-only row collapses too. Props stay visible at their own scale on the shorter shelf.
2. **Print the vacancy** (from #4, the best idea in the exercise). An empty `.slot` gets a small register mark and its position, generated by CSS counters — no JS:
   ```css
   .shelf-row{counter-increment:sl-row}
   .slots{counter-reset:sl-col}
   .slot{counter-increment:sl-col}
   .slot:empty::after{
     content:counter(sl-row,upper-alpha) "-" counter(sl-col,decimal-leading-zero);
     position:absolute;bottom:9px;left:50%;transform:translateX(-50%);
     font:400 9.5px/1 var(--body);letter-spacing:.22em;
     color:color-mix(in srgb,var(--ink-lit) 26%,transparent);
   }
   ```
   A half-full shelf now reads as a shelf with vacancies rather than a void. It is also *truthful about the six-column adjacency mechanic* — A-04 means row A, position four.
3. **Light the emptiness.** The empty right-hand end of a row still gets the key pool falling across it. Unoccupied but lit reads as room; unoccupied and black reads as a bug.

---

## 3. THE CREATURES

### Sizing

```css
:root{--shell:1140px}                     /* was 960 */
.cabinet-wrap{--rail:calc(min(var(--shell),100vw - 36px) - 44px - 20px)}
.shelf-row{
  --pitch: calc(var(--rail) / 6);          /* ≈176px at 1440 */
  --pet-h: clamp(148px, min(calc(var(--pitch) * 1.14),
                            calc((100vh - 452px) / 2)), 232px);
  --slot-h: calc(var(--pet-h) + 16px);
  --plank-h: 26px;                          /* was 15 — it now carries type */
  --label-drop: 10px;                       /* was 38 — the band is gone     */
}
.slots{grid-template-columns:repeat(6,minmax(0,1fr))}
.slots>.slot{min-width:0}                   /* LOAD-BEARING. see §7        */
.slot .sprite{--pet-h:var(--pet-h)}
.slot .sprite.sl2{width:var(--pet-h);max-width:none}
```

At 1440×900 that is **200px** (from 124px declared / ~60px rendered) — a 3.3× area increase — and the creature is drawn 24px wider than its own 176px track, so the row shingles shoulder-to-shoulder like figurines on a crowded shelf. At 1280×720 the vertical term takes over and gives 134px → clamped to the **148px floor**, meaningfully better than diorama's 132px collapse. The `min-width:0` and `minmax(0,1fr)` are what make "the picture overhangs, the slot does not" actually true — without them the oversized sprite inflates every track and pushes column 6 off screen.

### The light on them — replace the halo with a chain

This is the single most important correction to the winning direction. Candlelit's rim is `drop-shadow` at even weight all round; it detaches from the form and reads as Photoshop outer-glow. Replace with three shadows that agree with `--cast-dx/dy`:

```css
.sl2 .sprite-figure{
  filter:
    /* 1. the long cast, thrown onto the back wall, away from the key */
    drop-shadow(var(--cast-dx) var(--cast-dy) 14px rgba(0,0,0,.58))
    /* 2. the tight contact offset — separates the body from the wall */
    drop-shadow(2px 3px 1px rgba(0,0,0,.42))
    /* 3. a DIRECTIONAL warm edge: offset toward the key, not a halo */
    drop-shadow(-3px -2px 5px color-mix(in srgb,var(--key) 62%,transparent));
}
```

Three shadows, not five. Note shadow 3 is **offset up-and-left**, toward the source. That one negative offset is the difference between "lit from somewhere" and "sticker outline," and it costs nothing. Because `drop-shadow` follows the vector outline, horns cast horn-shaped shadows and wings cast wing-shaped ones — on generated *and* freehand pets, with zero DOM cost.

Mood variants: furious swaps the warm edge for `#FF4A57` and gains one 18px bloom; asleep drops the warm edge entirely and halves the cast. Do not add a fourth shadow.

**Performance:** three `drop-shadow`s on up to 18 continuously-animating inline SVGs is real per-frame GPU cost that nobody in this exercise profiled. Halve the blur radii under `@media (max-width:640px)` and add `@media (prefers-reduced-motion:reduce){ .sl2 .sprite-figure{filter:drop-shadow(2px 3px 2px rgba(0,0,0,.5))} }`. **Profile this on a mid-range Android before shipping** — it is the one risk no screenshot can show.

### Footing — they must not float

Candlelit replaced the contact shadow with an underglow, so its creatures hover over a bright plank lip. Both are needed:

```css
/* the pool of key light on the plank at the feet — from #7 */
.slot::before{
  content:'';position:absolute;left:50%;transform:translateX(-50%);
  bottom:calc(-1 * var(--plank-h));width:150%;height:calc(var(--plank-h) + 6px);
  background:radial-gradient(ellipse at 42% 30%,
    color-mix(in srgb,var(--key) calc(22% * var(--sl-stop,1)),transparent), transparent 68%);
  pointer-events:none;
}
/* and a HARD dark contact patch, offset toward the shadow side */
.pet::after,.prop::after{
  left:56%;width:64%;height:9px;
  background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.72),rgba(0,0,0,.24) 52%,transparent 72%);
}
```

Pool underneath, dark patch on top of it, offset right because the key is left. The creature presses into the board.

### At 390px

Keep the existing overhang model — it is the best mobile work in the codebase — and raise it:

```css
@media (max-width:640px){
  .shelf-row{
    --rail:calc(100vw - 22px);
    --pitch:calc(var(--rail) / 6.6);
    --pet-h:calc(var(--pitch) * 1.72);      /* was 1.6 → ~102px */
    --slot-h:calc(var(--pet-h) + 12px);
    --plank-h:22px;--label-drop:8px;
  }
  .sl2 .sprite-figure{
    filter:drop-shadow(9px 7px 7px rgba(0,0,0,.6))
           drop-shadow(0 0 1.5px rgba(0,0,0,.55))
           drop-shadow(-2px -1px 3px color-mix(in srgb,var(--key) 55%,transparent));
  }
}
```

The tight second shadow at 1.5px blur is what stops six overlapping silhouettes of similar colour merging into one ribbon — the exact failure a critic named in candlelit's mobile shot. Names on the plank front face wrap to **one** line at 9.5px with `text-overflow:ellipsis`; two ragged lines was worse than an ellipsis in every mobile screenshot in this set. If "Bartholomew" ellipses, that is acceptable — the tap target opens the card.

---

## 4. CHROME

Ranked by how loudly each thing is allowed to speak:

| Rank | Element | Treatment |
|---|---|---|
| 1 | The creatures | Only saturated, only animated, only lit things on the page |
| 2 | The lit wood of the planks | The only other warm surface |
| 3 | "Make a pet" | One ember. The single accent-filled object on screen |
| 4 | Engraved names on the plank faces | Fixed cream, 10.5px tracked caps |
| 5 | Three actions + More | Unlit: transparent, hairline, 11.5px tracked caps |
| 6 | The case rail (three figures) | Engraved into the furniture, below it |
| 7 | Notes | Paper, deliberately one stop down |
| 8 | Footer, tagline | Barely there |

### Buttons: eleven → four, no JS

Use the disclosure pattern the phone build already ships, at **all** widths. `mobileNav.js`'s `#moreBtn` listener is not width-gated, so this is CSS only:

```css
@media (min-width:641px){
  .tb-primary{display:flex;gap:10px}
  .tb-more{display:inline-flex}
  .tb-rest{ /* desktop drawer: same geometry as the phone sheet */
    display:flex;position:fixed;right:24px;top:76px;width:260px;flex-direction:column;
    transform:translateY(-8px);opacity:0;visibility:hidden;pointer-events:none;
    background:var(--night-2);border:1px solid var(--hair-lit);
    box-shadow:0 30px 60px -24px #000, inset 0 1px 0 color-mix(in srgb,var(--key) 14%,transparent);
  }
  .tb-rest.open{transform:none;opacity:1;visibility:visible;pointer-events:auto}
  .tray-head{display:flex}
}
```

⚠️ **Coupling nobody would guess:** this depends on `mobileNav.js` firing its `moreBtn` listener at all widths. Add a comment in *that file* saying so. It also reuses `#trayScrim` to dim the room behind the drawer, which is free.

Buttons themselves: `background:transparent; border:1px solid var(--hair-lit); border-radius:2px; font:600 11.5px/1 var(--body); letter-spacing:.16em; text-transform:uppercase; color:var(--ink-lit)`. `.btn-primary` keeps its accent fill and `--accent-ink` — do not touch that pairing, it is measured.

**Delete the emoji.** `index.html` lines 42–45 (🔊 🗣️ 🎙️ 🔞) and `render.js` line 32 (🔥). Full-colour OS glyphs are the most saturated non-creature pixels on the page in *four* of the eight prototypes, and they sit inside a candlelit menu. Five deletions. If an icon is wanted, inline a 12px currentColor SVG.

### Status: nine metrics → three, welded to the furniture

Every one of the sixteen critic verdicts hit the status bar. Engraving a KPI rail in brass does not stop it being a KPI rail. **Cut it.**

The mood census (Content/Fine/Annoyed/Furious) is already visible in the case — it is the pips under every creature and the colour of every nameplate. It is redundant information rendered twice, once as physics and once as analytics. Delete the analytics copy.

In `render.js`, replace the nine spans with:

```js
statusBar.innerHTML =
  '<span>Day <b>' + days + '</b></span>' +
  '<span>Living here: <b>' + state.pets.length + '</b> of ' + state.slots.length + '</span>' +
  '<span>Bond: <b>' + totalBond(state) + '</b></span>' +
  (counts.furious || feuds
    ? '<span class="bad">Unrest: <b>' + (counts.furious + feuds) + '</b></span>' : '');
```

Four figures maximum, the fourth appearing only when there is something wrong — so the line *changes when the game changes*, which is the opposite of a dashboard. Streak moves into the pet-card sheet.

Placement, with **no DOM move** — `.stage` is already `flex-direction:column`, so just reorder at all widths:

```css
.stage>.cabinet-wrap{order:1}
.stage>.status{
  order:2;max-width:var(--shell);margin:0 auto;
  border:0;border-top:1px solid var(--hair-lit);padding:11px 24px;
  font:400 10.5px/1.9 var(--body);letter-spacing:.20em;text-transform:uppercase;
  color:var(--ink-dim);background:linear-gradient(180deg,color-mix(in srgb,var(--key) 5%,transparent),transparent);
}
.status b{font-family:var(--display);font-size:15px;font-variant-numeric:tabular-nums;color:var(--ink-lit)}
```

It reads as a line engraved on the case's bottom rail, exactly as wide as the furniture, *under* the thing it describes. Keep the coloured bead for `.bad` — that is the measured contrast fix and must not be undone.

### The narrator toast — the element nobody art-directed

`#voiceHint` is a pale bordered box with SHOW ME / NO THANKS sitting mid-fold in **four of the eight** prototypes' hero shots. It is now the most "web page" object on screen. The fix is already in this codebase: `.empty-shelf` at style.css:1304 is a pinned paper card with a pin, a rotation and a real shadow. Reuse it verbatim.

```css
.voice-hint{
  max-width:36ch;margin:26px auto 0;padding:20px 18px 14px;
  background:var(--paper-lit);color:#2B2028;border:0;border-radius:2px;
  font-family:var(--hand);font-size:20px;line-height:1.3;
  transform:rotate(-.8deg);
  box-shadow:0 2px 2px rgba(0,0,0,.24),0 14px 26px -12px #000;
}
.voice-hint::before{ /* the pin — copy .empty-shelf::before exactly */ }
.voice-hint .btn{font-family:var(--hand);font-size:17px;border-color:rgba(43,32,40,.3);color:#2B2028}
```

A note about the narrator, written on a note, in a game about creatures who leave notes. It stops being a cookie banner.

### The notes wall

Delete `.notes`' panel background, border and box-shadow entirely (from #3). The notes are pinned to the same dark wall the cabinet stands against, in a second, weaker pool of light — and **sort order becomes visible as light**: the newest sit in the pool, the oldest fall out of it.

```css
.notes{background:none;border:0;box-shadow:none;padding:34px 0 0;
       grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:30px 18px}
.notes::before{ /* the pool */
  content:'';position:absolute;inset:-20px 0 auto;height:340px;z-index:-1;pointer-events:none;
  background:radial-gradient(60% 100% at 30% 0%,
    color-mix(in srgb,var(--key) 13%,transparent), transparent 72%);
}
.note{background-color:color-mix(in srgb,var(--paper) 84%, var(--key) 16%)}
.note:nth-child(n+7){filter:brightness(.72)}
.note:nth-child(n+11){filter:brightness(.55)}
```

Two guards on that, both of which the winning direction got wrong in its own screenshot (its bottom-right note rendered essentially blank):

- Stop the falloff at `.55`. Note ink is `#2B2028` on `--paper`; at brightness .55 the *pair* dims together, so contrast ratio is preserved — but do not go below .5, and **measure the dimmest note's rendered pixels rather than computing them.**
- Density from #4: 212px cards, 5 columns, and **auto row heights** — specimen's fixed row heights left a punched-hole void under every short card, 26 times down the page.

Heading, from #7: `.notes-head h2` drops from 30px Gloock to `font:600 10px/1 var(--body); letter-spacing:.34em; text-transform:uppercase`, with a hairline rule running off it to the right. It can no longer compete with the shelf.

---

## 5. TYPE AND TEXTURE

Three faces, three jobs, no drift.

| Face | Job | Never used for |
|---|---|---|
| **Gloock** | The wordmark, and **numerals only** everywhere else | Anything with more than one word, other than the wordmark |
| **Karla** | All institutional labels, tracked uppercase | Body copy longer than a caption |
| **Caveat** | Note bodies, the pinned narrator card, the empty-shelf card | Any UI |

**Scale:**

```
wordmark          Gloock 34px / -.02em          (was clamp 40–66px)
section label     Karla 600 10px / .34em / caps
button            Karla 600 11.5px / .16em / caps
nameplate         Karla 600 10.5px / .14em / caps  — fixed #EFE2CE
case rail label   Karla 400 10.5px / .20em / caps
case rail figure  Gloock 15px, tabular-nums
vacancy mark      Karla 400 9.5px / .22em / caps
note body         Caveat 20px / 28px
note byline       Karla italic 11px
tagline / footer  Karla italic 12.5px, --ink-dim
```

**The wordmark drops to 34px.** This is non-negotiable and it is where noir lost: a glowing 86px display headline takes first fixation from 200px characters no matter how you rationalise it. The wordmark is a caption on the room, not a sign in it. Kill its `text-shadow` — a drop shadow on type in a room lit from one direction is a second, contradictory light.

**Texture, all pure CSS/SVG:**

- **Grain** — inline `feTurbulence` data-URI, `baseFrequency=".9"`, 4% opacity, `mix-blend-mode:overlay`, masked to the shadows (see §2). Do **not** animate it; noir's 500ms crawl is a compositing tax for a texture nobody consciously sees.
- **Wood grain** — already present at style.css:1275, a `repeating-linear-gradient(90deg,...)`. Keep it; add a second pass at 3° so the grain is not a perfect vertical comb.
- **Plank lip specular** — a 2px `color-mix(var(--wood-lip) 70%, #fff)` band, existing. Widen it on the **left half only** (`linear-gradient(90deg, ...)`) so the board's top edge is brighter where it faces the key.
- **Dust** — six 2px radial dots on a slow `translateY` in the key pool, `opacity:.14`, disabled under reduced-motion. Cheap, and it is what makes a light *beam* rather than a gradient.

---

## 6. THEMES — six bulbs, not six colours of darkness

The honest cost of the winning direction, which its own author named, is that three of six rooms stop being light rooms and the six collapse into one room with a hue rotation. Look at `/tmp/ad-candlelit-parlor.png` next to `/tmp/ad-candlelit-mortuary.png` — they are the same picture twice.

**Do the night rework anyway** — this direction is *about* light and it cannot survive a pale ground. But recover room identity by changing what varies. Right now what varies is *the hue of the darkness*, which is almost invisible. Make what varies **the bulb**.

Add one token per room. This is a five-line addition to `decor.js`'s `vars` object — the only JS/data change the theme system needs:

```js
aubergine: { …, '--room-key': '#F2C083' },   /* warm tungsten          */
mortuary:  { …, '--room-key': '#C8E8D4' },   /* cold clinical fluoro   */
nursery:   { …, '--room-key': '#F4B9C4' },   /* rose nightlight        */
basement:  { …, '--room-key': '#B478FF' },   /* UV tube                */
parlor:    { …, '--room-key': '#FFD9A0' },   /* gaslight, very warm    */
midnight:  { …, '--room-key': '#9EC0FF' },   /* moonlight through glass*/
```

Bone Parlor becomes a gaslit parlour after dark; Mortuary Mint a morgue under a failing strip light; Blacklight Basement genuinely blacklit. Same structure, six unmistakably different lights. That is the difference between six rooms and one room repainted, and it is five lines.

**The ink, preserving the measured contrast work.** Three of the six rooms ship a *dark* `--bone` (they are light rooms) which is invisible on a black wall. Use candlelit's pin — keep the hue, force the lightness:

```css
@supports (color:hsl(from red h s l)){
  body{
    --ink-lit: hsl(from var(--bone) h calc(s * .5) 93%);
    --ink-dim: hsl(from var(--bone) h calc(s * .5) 70%);
    --hair-lit: color-mix(in srgb,var(--ink-lit) 16%,transparent);
  }
}
body{ --ink-lit:#F2E9DC; --ink-dim:#B4A79A; --hair-lit:rgba(242,233,220,.16); } /* fallback FIRST */
```

**All overrides land on `body`, never `:root`.** `decorUI` writes to `documentElement`; the existing `:root` `color-mix()` derivations must keep deriving from the room's real values, and the sheets and cards must keep inheriting the pairings the previous contrast pass measured. This is why the direction is additive rather than a rewrite.

**Three things that must not be re-litigated:**
1. `--accent-ink` (style.css:55) — the auto-flipping label on the accent fill. Leave it alone.
2. Semantic colour rides on the **bead**, never on the text (style.css:118–124). A blood-coloured figure is 3.7:1 in Haunted Nursery.
3. The nameplate ink is **fixed** `#EFE2CE` on a **forced-dark** plank face (`color-mix(in srgb, var(--wood) 26%, #000)`), which is near-black for every one of the seven woods including Bone and Gilt. Theme-proof by construction, ~9:1 measured, and it removes nameplates from the theme system entirely.

**Verification protocol — the lesson from #0's two self-caught regressions.** Anything composited over a gradient must be **pixel-sampled from a rendered screenshot**, never computed. Diorama reported its label band at 17:1 when it was at 1.63:1 and not painting at all. Render all six rooms at 1440×900 and 390×844, sample the worst point of each text run off the PNG, and publish the numbers. Bone Parlor and Mortuary Mint are the two hardest cases; do those first.

---

## 7. THE DIFF — ordered so the biggest visual win lands first

Everything is one **appended** CSS block plus four small JS/HTML edits. Delete the block to restore the current build exactly.

**Step 0 — two real bugs, worth taking on their own merits, before any art:**
```css
.slots{grid-template-columns:repeat(6,minmax(0,1fr))}
.slots>.slot{min-width:0}     /* six 1fr tracks silently widen to 534px on a
                                 368px shelf; columns 5 and 6 leave the screen */
.shelf-row{display:flow-root} /* .plank's margin-bottom collapses out of the
                                 row, so anything painted on .shelf-row misses
                                 the label strip entirely */
```

**Step 1 — night + one light.** `--night/--night-2/--case-*` tokens on `body`, the fixed `body::before` bloom+vignette, the grain layer, `--room-key` in `decor.js`, the `--ink-lit/--ink-dim` pin. *This is the categorical change: the page stops being a document in about 60 lines.*

**Step 2 — the cabinet as geometry.** Widen the stiles to 22px with asymmetric faces, `padding-top:30px`, cornice inset shadow, the interior key pool + depth gradient, `--sl-stop` per row, the lit floor band.

**Step 3 — creature scale + the shadow chain.** `--shell:1140`, the `--pet-h` clamp, the three-shadow directional filter, the slot pool, the hardened offset contact patch.

**Step 4 — the plank carries the name.** `--plank-h:26px`, `--label-drop:10px`, forced-dark front face, fixed cream engraved caps, pips into the 10px reveal. *This step alone recovers ~84px of dead band per screen and deletes the label-bar failure mode that cost three directions points.*

**Step 5 — chrome.** Desktop drawer (CSS only), unlit button treatment, `render.js` status → 3–4 figures, `.stage>.status{order:2}` rail, **delete the five emoji**.

**Step 6 — emptiness.** `:not(:has(.pet))` row collapse, CSS-counter vacancy marks. *(`:has()` degrades silently to today's behaviour — no worse.)*

**Step 7 — notes.** Panel deleted, light-as-sort-order, 212px auto-height cards, heading demoted.

**Step 8 — the un-directed surfaces.** `.voice-hint` → pinned paper. Then `.veil .sheet` gets the case treatment: `--night-2` ground, hairline edges, the same tracked caps. The studio sheet should be the most theatrical screen in the game and in every prototype it was a settings dialog.

**Step 9 — mobile pass and measurement.** 1.72× overhang, halved blur radii, one-line ellipsised names, then sample all six rooms at both breakpoints.

---

## 8. WHAT NOT TO DO

1. **Do not ship a symmetric outer glow and call it rim light.** Candlelit's central thesis was delivered by a filter that does not know where the light is. If a creature has a candle to its right, it must be brighter on the right. One negative offset on the warm shadow fixes it for free.
2. **Do not engrave the dashboard.** Nine `LABEL: value` pairs in tracked caps on a brass plate is still nine `LABEL: value` pairs. Every direction tried this and every critic saw through it. **Cut the metrics; don't restyle them.**
3. **Do not rule a hard-edged dark bar across the picture** to solve nameplate contrast (diorama), and do not solve it with fixed-cream chips that become the brightest objects in the frame and out-shout the creatures (cabinet). Put the name on the plank's own front face.
4. **Do not leave the narrator toast and the studio sheet undirected.** They are in the middle of the fold in four of eight hero shots. A pale rounded box with two chips in a candlelit room is a hole punched in the wall.
5. **Do not put emoji in an engraved menu.** 🔊 🗣️ 🎙️ 🔞 🔥. Delete them.
6. **Do not let a prop keep a row at full height.** `.row-empty` currently only fires on a *completely* empty row, which is why candlelit's own screenshot has a 200px black band holding one clock. The advertised fix never triggers in its own hero shot.
7. **Do not let the wordmark, the plaque, or the primary CTA be the brightest object.** Noir's sign, cabinet's brass plaque and terrarium's pink slab all took first fixation from the monsters. One ember, and it is a button, and it is small.
8. **Do not put a heavy vertical divider through the middle of the shelf** (cabinet's astragal). Six columns and their left/right adjacency are the *mechanic*; a bar at 50% asks the player to read 3+3.
9. **Do not let creatures float.** An underglow that replaces the contact shadow leaves feet hovering over a lit plank lip. Pool *and* patch.
10. **Do not let the theme rework flatten the six rooms into one.** If Bone Parlor and Mortuary Mint come back as the same screenshot with a hue rotation, the direction has spent the decor system — a feature players buy with bond — to buy atmosphere. Vary the **bulb**, not the darkness.
11. **Do not report contrast from arithmetic.** Sample rendered pixels. Diorama claimed 17:1 on a band that was at 1.63:1 and not painting.
12. **Do not ship the shadow chain unprofiled.** Three `drop-shadow`s × 18 animating SVGs is the class of thing that turns this screenshot into a 20fps game on a mid-range Android.

---

**Files:** `/Users/stephenmoffitt/shelf-life/css/style.css` (append; ~340 lines), `/Users/stephenmoffitt/shelf-life/index.html` (delete 5 emoji glyphs, lines 42–45), `/Users/stephenmoffitt/shelf-life/src/ui/render.js` (line 23–32 status rewrite; line 92 optionally `btn.dataset.prop = pr.kind` to make props real light sources), `/Users/stephenmoffitt/shelf-life/src/content/decor.js` (add `--room-key` to each of the six `vars` objects). No id renamed, no node moved, no listener touched.