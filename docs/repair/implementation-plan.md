# ShelfLife September 19 repair implementation plan

Goal: Restore the dusty macabre household identity through playable progression, physical comedy and persistent consequences, then publish verified GitHub Pages.
Authority: Steve's September 19 review and successor prompt, supplied with explicit instruction to implement all and publish.
Architecture: Retain static ES modules, existing renderers, local saves and normal release workflow. Add bounded versioned progression and consequence records; retain all legacy records.

## Acceptance checklist
- [x] Baseline revision e77b69bf0736d616ada031806742ca7f82e6e80c, normal UI play, synthetic saves retained.
- [x] Twelve authored Chase stages in three mechanically different chapters, visible lesson/goal/next stage, replay/practice and independent gentle controls, versioned records.
- [x] Rug: bounded reaction/acceleration/reach, contact-based catches, fumbles/recovery/misses/refusals, held ball and return, phone-readable ball, optional challenges, no duplicate rewards.
- [x] Neglected room artwork and coherent market/household surfaces, readable controls and preserved resident art.
- [x] Mastery paths for Handshake, Alibi, Court, Market and Expeditions with mechanical changes and visible unlock conditions.
- [x] Structured varied rug writing and truthful cross-activity callbacks; early ensemble macabre incident, visible harmless consequences and workshop effects.
- [x] Navigation, actor focus, archive links and five destinations preserved.
- [ ] Domain, Python, browser, mobile, migration, backup, interruption and release verification.

## Task 1: Chase campaign
Own src/engine/chase.js, src/ui/chase.js, new src/content/chase-campaign.js, css/chase.css, campaign-specific tests. Introduce per-pet chaseCampaign versioned progress and records without deleting chaseRecords/chaseBest. Root integrates state normalization if necessary. Test stage schedule distinctions, advancement after wins only, replay, losses, reload, rewards. Add visible chapter/lesson/goal and hide advanced setup for first play. Use existing controls and stable movement.

## Task 2: Rug physical slice and room
Own play-rug engine/UI/state/content/CSS/assets. Tests must reproduce formerly guaranteed preset catches and distinguish feasible/infeasible throws; verify event receipt protection and pause. Art must be inspected at desktop and phone scale.

## Task 3: Other activities mastery
Own mastery-state.js, play/alibi/court/market/expedition engines and their UI, state normalization and focused tests. Use explicit additive state, no retroactive difficulty from affection. Beginner remains accessible; later mechanics change reasoning/ritual/resource decisions with solvability tests.

## Task 4: Consequences, navigation and release
Integrate bounded true event history, visible prop aftermath and callbacks, early visitor incident, archive links and focus. Root runs all existing checks, normal browser play, targeted failures, review and normal Pages deployment.

## Review focus
Legacy saves with custom art and completed/active outings; repeat rewards after reload; 320px controls/dialogue; background clocks; weak or infeasible generated deduction/market challenges.

## Progress and decisions
- Current repository baseline matches review. Fresh clone on repair/macabre-household.
- User's supplied spec and ordered implementation plan authorize implementation and publishing; no additional planning approval needed.
