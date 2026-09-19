# September 19 repair release evidence

Reviewed baseline: `e77b69bf0736d616ada031806742ca7f82e6e80c`. Implementation: PR #14. Release identity and live checks will be recorded after the normal Pages workflow completes.

## Issue and acceptance matrix

| Area | Classification from review | Implementation / evidence |
|---|---|---|
| Repeated Quick Chase schedule | Design limitation | 12 authored campaign stages, three chapters, versioned per-resident mastery/records, unlocked replay with optional mirrored routes and independent gentle pace. 96 orientation/stage/pace/body combinations completed using control inputs in deterministic engine tests. See chase-report.md and chase-review.md. |
| Guaranteed preset catches | Reproduced design limitation | Finite reaction/acceleration/reach, physical grip, recoverable drop, visible miss/refusal, held ball and return. Settled easy presets remain forgiving; hard placement produces misses. 120 easy catches versus 99 hard catches/21 misses across positions/traits/widths; impossible remote throws miss. |
| Tiny ball | Rendering defect | Shared rendered/collision radius targets 32px on narrow phones. Browser measurements at 320/390/430 are part of the release gate. |
| Cozy room | Art-direction mismatch | New decayed room and Market paintings, shelf material alignment, early coffin furniture. Existing custom appearance stays intact. Before image: evidence/before-rug.jpg. After screenshots: evidence/after-rug-desktop.png and evidence/after-rug-320.png, captured in Chromium/WebKit on b058db5; the room and ball are unchanged by later record fixes. |
| Other game difficulty | Design limitation | Explicit mastery paths for all five other activities: ritual changes, combined evidence, multi-clue Court, beginner-to-budget Market, crew/branch Expeditions. Generated-case/route feasibility and duplicate reward regressions. See mastery-report.md. |
| Generic rug captions / delayed premise | Content and staging limitation | Structured event/trait/history-conditioned writing; bodily outcome poses; early visitor incident; bounded true-event journal and visible aftermath using actual resident art. Welcome variants survive reload without inventing a different incident. |
| Navigation / visible rewards | Design limitation and unverified phone report | Five primary destinations retained. Centralized Playroom launch, cast-filtered retained memories, related archive links and exact project-action focus. Browser focus assertions cover installed project use. No history deleted. |
| Existing saves | Preservation requirement | Nine reviewed-revision synthetic checkpoints compare identically for identity, drawings, slots, furniture, histories, installed projects and active outing after migration. See saves/README.md. |
| Physical iPhone, multi-day balance | Unverified device/product questions | No physical iPhone available. Emulated Chromium/WebKit and deterministic tests do not establish long-term balance or audience humor response. |

## Verification checkpoint

- Local domain: 843/843 passing after review fixes.
- Python: 4/4 passing; production build passes.
- Independent Chase review fixed stationary-safe-side crossing and reward consumption during cooldown.
- Whole-branch review fixed multi-event rug challenge receipts, novice Market wording and exact opening callbacks. Targeted re-review approved; 30 focused checks passed.
- Browser checkpoint: 123 passed and 3 intentional skips on b058db5 (Actions run 35454037276). This includes actual keyboard-earned Chase lessons 1–2, progression after reload, phone ball geometry and long-name layouts. Final exact-revision gates and live Pages inspection are recorded in the PR #14 release report.
- Normal UI on original published edition: completed all three Alibi rounds and the Curious funeral Court case (The Beadle, 125 points, no individually cleared innocents); completed Handshake (3 rounds, no errors), Market (1/3 errands, 9 buttons, 19 points), and Chase (6/8 crumbs, 60 points, one-star loss); played rug and completed an Under Fridge Expedition for 7/7 trail points, recovering two parts and installing Midnight Larder. All six activities plus the rug were replayed through normal UI on the reviewed edition. Automated isolated households remain separate from normal UI play evidence.

Repository review additionally reproduced fresh-tier practice advancement in Market, Handshake and Expeditions, and a missing passport stamp for a losing campaign attempt. Explicit practice intent survives Market/Expedition reload and retry; all four regressions now pass without removing completed activity or recovered parts. Two further regressions verify unique rug aftermath receipts across fresh module loads and a real five-round Encore when Echo practice is selected.

## Product limits

This restores concrete mechanics and presentation; it does not establish a numeric improvement in humor or prove every trait/ending over multi-day play. Consequences are bounded, harmless aftermath and callbacks, not a new simulation of permanent household damage. Existing project behavior is retained and surfaced. No framework, account service, or Mature mode was added.

## Screenshot-driven corrections

The first retained screenshots exposed two rendering defects: the spinning ball rotated its outer positioned element, changing its bounding envelope and shifting it from the physics centre; the rotation now belongs to the centred SVG paint. Long resident names in aftermath could widen the document behind an expedition dialog; the text flex item now shrinks and wraps. Market-specific older CSS flattened the new painted setting into a narrow strip; explicit responsive heights and a compact saved-lesson summary now give the scene room without hiding unlock details. Legacy shopping routes keep their own labels and scores, while v5 bests are recorded separately for each lesson.
