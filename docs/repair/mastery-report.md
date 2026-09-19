# Activity mastery repair evidence

Implemented all five paths using `src/mastery-state.js`. Saves contain version 1 bounded tier, win count, issued/claimed lesson serials and recent receipts. Legacy affection, wins, images, names, trips and records are not used to infer learning tier. Pet-scoped Handshake/Alibi and household-scoped Court/Market/Expedition normalize additively. Reward rest does not suppress learning. Replayed receipt serials remain consumed after the recent list rolls over.

## Playable paths

- Handshake: short Echo (2–4 moves), Long Echo (2–5), Mirror reversal, Duet alternating beats. Current lesson is the default; completing the lesson unlocks its successor. Echo beginner practice remains selectable. Slow demonstrations, replay, untimed entry and five-round encores remain separate. Next-lesson launch refreshes the visible rule, not only the sequence. Existing shared openings and bests remain saved.
- Alibi: spot a lie, support it with one true record, combine two true records. The last lesson asks for aggregate totals of two care types and requires both corresponding independently recorded counts. Neither one fact nor exact sentence matching supplies the proof. Three exhibits are true; two must be selected, including via A–C keyboard toggles. Full correct interviews advance mastery, including during reward rest. Existing mode-less reward objects retain legacy behavior.
- Court: default fresh hearing automatically selects Cozy, Curious or Tangled from mastery. Correct filed verdicts advance once. Existing unique-culprit clue solver, investigation, objections and help remain intact. Current tier/next condition and difficulty buttons appear outside Case file. Beginner practice remains accessible; unearned advanced UI choices are visibly locked.
- Market: new UI trips opt into version 5. First lesson has one affordable pair, one errand and two stalls. Second has three errands, six stalls, three-space capacity and budget/delivery pressure. Third has eight stalls, alternative merchant offers and premium delivery decisions. All tier layouts use the legal transaction engine and exhaustive attainable-score solver. A complete list advances once. One-errand practice is always offered. Versions 1–4, active transaction prefixes, names, prices, rewards and retry seeds remain unchanged. Existing direct legacy engine calls retain their previous version unless `learning:true` is requested.
- Expeditions: new UI trips explicitly save mastery tier and receipt. Survey has no crew cost discount; next lesson enables crew expertise; final lesson makes the first detour open different subsequent authored stops. Branch reconstruction and optimal-score search use actual branch decisions. First-step points remain identical before and after the branch/reload. Full return with at least 3 points advances learning. Safe partial return saves recovered project parts and never grants unvisited points or mastery. Existing active trips without these fields retain their rules. Beginner survey practice remains available.

## Verification

TDD: new tests first failed on trust-driven Handshake length and three-errand beginner Market; implemented against those failures. `test/mastery-paths.test.mjs` now has 9 focused progression, feasibility and restore tests:

- bounded migration, affection independence, persisted duplicate receipt rejection;
- longer/reversed/alternating Handshake mechanics and beginner practice;
- market feasibility for 12 seeds at each of three tiers;
- every Alibi tier, including two-record proof, reworded records and duplicate claims;
- every Court tier with exactly one consistent culprit and persisted file boundary;
- version-5 Market restore after each transaction, one-time progression and version-4 compatibility;
- Expedition crew discount, real branch change, reload and safe partial return;
- old receipt rejection after more than 64 later lessons;
- all eight Expedition editions retain advertised first-choice points after branch/reload.

Focused combined regression run: 88/88 passed (new mastery plus Handshake, life, household, expansion, trail, old errands and flexible market suites). Final full npm run after all changes: 823/823 passed. The 9 focused mastery tests also passed independently. Root runs final whole-tree release gates and browser verification. JavaScript syntax checks passed for changed gameplay/UI modules.

Legacy test intent updates: the old affection-driven Handshake test now asserts explicit learning; old reward/story helpers explicitly request beginner practice so those tests exercise their original reward/story concern rather than inadvertently entering longer lessons.

## Integration and limitations

New offline import: `src/mastery-state.js` (root owns service-worker manifest). Preserved root's campaign claim gate, macabre handshake lines, `rememberEcho` integration and additive state fields. Applied requested Chase hook correction: campaign entitlement is checked with `{consume:false}`; actual reward consumes it only after nonzero fuss/trust is granted.

No browser control was used by this worker, per task ownership. Root must verify real dialog layout, mobile two-record selection, next-lesson transitions, and publication. Mastery uses authored three/four-tier paths rather than unbounded escalation; cosmetic legacy records remain independent. Accessibility does not lower mastery rewards or increase difficulty.

## Final independent-review corrections

Addressed the Market P2 and teaching feedback in `final-review.md`: beginner return dock now says 1/1, and its saved scene uses the complete-list success prose. Market and Court rewards persist a display-only `masteryUnlocked` tier only when this completion actually advanced mastery; result screens announce that exact lesson and its next condition after reload. Beginner replays do not claim a new unlock. Combined Alibi verdict feedback marks both necessary count records as jointly disproving the total.

Added three focused tests through real Market purchases/delivery/JSON restore and generated dock/result markup, real Court investigation/verdict/JSON restore and result markup, and two-record Alibi feedback including exclusion of the unrelated exhibit. All 12 focused mastery tests pass.

Post-review full npm suite: 826/826 passed (`/tmp/mastery-review-all.log`).
