# Household revision: evidence and limits

This revision starts from `cb642de`, preserving the existing creator, autonomous movement, cabinet, immortal residents, drawings and save history. It is an integration of household personality, first-session, interface and activity changes, not a replacement game.

## Verified baseline and changes

The original Node suite passed 647 tests. Source inspection confirmed that left / Hop / right, independent keyboard/touch sources, deliberate Handshake rounds, slower replay, lamp switches, scene interruption and old-market replay already existed. Those improvements were retained.

Observed in the public browser: the established two-resident cabinet devoted substantial height to empty rows, with scenes below the fold. Existing household animations, notes, project cards, Playroom, More and backup controls were visible. Echo demonstration, a mistake, slower replay and deliberate round advancement were exercised before the update. The backup action produced a valid downloaded household even though the browser download event timed out.

Source-based defects addressed include Alibi's narrow vertical desk; absent Court comparison matrix; Court outcome scene using the first two pets instead of the actual participants; forced six-purchase market completion; identical-tag purchases without a premium benefit; unvisited expedition stops granting recovery; and eating animations that did not consume servings at a care cap.

Subjective design decisions: a short housewarming establishes character and company sooner; personal rituals and grounded callbacks make residents less interchangeable; optional market hints preserve room to think; concise results reduce reading friction. These judgments are not evidence of a measured retention increase.

## Automated verification

- The integrated JavaScript suite passed 702 tests with no skipped tests at the release checkpoint.
- Four Python launcher/API tests passed, including deliberate error handling.
- Static site packaging completed and the offline-shell test covers every production module and asset.
- New regression cases cover grounded memories, scene servings, bounded relationship effects, truthful Court evidence, actual participants, Handshake rituals, contracts, old rules, market flexibility and scoring, expedition return rules and first-session persistence.
- All eight requested household types are reusable fixtures: fresh, established, nearly full, drawing-heavy, conflicting preferences, sleeping, full needs/capped trust and older saves. Details and CPU-only timings are in `qa-fixture-results.md`.
- Market testing independently solves 24 new routes. Expedition tests exercise route, equipment and edition combinations and verify early-return and repeat-claim behavior.

## Environment limits

The browser cannot reach this environment's localhost, and its policy also blocks local file navigation. The new responsive harness is checked into `test/` for normal development but is excluded from the published game. No alternate browser-control mechanism was used to bypass those limits.

Automated pointer-source tests do not establish physical multitouch behavior. Physical iOS Safari, Android Chrome, native sharing cancellation, device GPU cost and memory pressure remain untested. CPU benchmarks do not measure frame rate or touch latency. No minigame physics or difficulty was changed on the strength of an automated score.

The first-session path is engineered for a short sequence of actions, but the roughly two-minute target needs an actual timed fresh-save run. Do not treat unit tests as that timing measurement.

## Remaining design limits

Companion choice still often rewards bringing the strongest relevant skills. Expedition editions remix nine alternate encounters rather than providing eight wholly independent stories. Delivery animation shows recipients and real objects but is not a bespoke physical routine for every errand. Relationship development remains a lightweight simulation, not an unrestricted narrative engine. The interface still contains a large catalogue below its immediate household view.

Fun, humor and attachment should be assessed through further play and returning-player feedback. Feature count alone does not justify a perfect score.

## Scene lifecycle follow-up

A source review found that the inline housewarming player could continue behind an open dialog or below the viewport. Scene playback now pauses on either condition and requires deliberate resumption. Hidden-tab behavior, reduced-motion manual stepping, modal replay and observer cleanup have direct controller regression coverage. These tests use a controlled DOM fixture; they do not establish browser rendering correctness.

The follow-up JavaScript suite passed 707 tests without skips; all four Python tests and static packaging passed. The browser connection remained unresponsive during this follow-up, so timed first-session play, the responsive viewport matrix and physical-device checks remain outstanding. No save format or gameplay reward rule changed in this follow-up.
