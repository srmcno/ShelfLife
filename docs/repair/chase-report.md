# Chase campaign implementation report

Implemented twelve authored lessons in three chapters. Each course has its own deterministic schedule, duration, lesson, goal conditions, and venue. Stages require floor collection, both cupboards, airborne catches, hopping hazards, smashing brooms, whole biscuits, safe-side escapes, carried-moth rescues, catches during sugar rush, high moon catches, clean switchbacks, and a three-phase final inventory. These are separate decisions and win conditions, not twelve spawn-rate presets.

Campaign steering speed and drag grip are stable across moods and bond. Resident art abilities remain intact. Campaign mastery is independent of affection and legacy best scores. The first lesson has no hazards, lasts fourteen seconds, and cannot be cleared by standing still, even with gentle catches. Every setup clearly shows its lesson, goal, and chapter. Gentle is a dedicated, initially checked campaign control. Unlocked stages can be replayed from a lesson selector. A win presents the next lesson, including its explanation, before starting its clock. Advanced free-play options begin collapsed; Quick Chase and Midnight Run remain available there.

Persistence uses `pet.chaseCampaign = {version:1, unlocked, records}`. `normalizeChaseCampaign(value)` bounds records and derives unlocks from consecutive wins rather than trusting a supplied unlocked count. `recordChase` routes campaign results to this structure without touching `chaseBest` or `chaseRecords`. Losses keep records without unlocking, interrupted attempts do not record, and the per-stage rewarded receipt prevents repeated mastery rewards after a JSON save/reload. Stage scores can still improve during practice.

## Integration owned by root

- Assign `pet.chaseCampaign = normalizeChaseCampaign(pet.chaseCampaign)` in state normalization; import from `src/content/chase-campaign.js`.
- In `rewardHandshake`, for a finished, complete, unclaimed campaign game, call `claimChaseCampaign(pet, game, now, {consume:false})` before the existing claimed assignment. Consume with the default call only after actual fuss or bond is granted. A false return is a practice result: mark claimed and return `{practice:true,fuss:0,bond:0}`. First claims continue through the existing capped reward path.
- Link `css/chase.css` after `css/arcade.css` in index.html. The assigned Chase-specific file is new; previous Chase styles remain in existing stylesheets.
- Add new JS/CSS to the offline asset manifest through the usual release process.

## Verification actually run

- Wrote campaign tests first; initial run failed with missing new campaign module.
- `node --test test/chase_campaign.test.mjs test/chase.test.mjs test/chase_clock.test.mjs test/chase_input.test.mjs test/chase_flow.test.mjs`: **45 passed**, zero failed.
- Within the campaign test, all twelve stages were completed sequentially using real 60 Hz physics and normal `targetX`, `jumpChase`, and `dashChase` controls. **48 successful complete courses**: twelve stages × two paces × plain and winged bodies. The solver does not teleport the resident, mutate catch totals, inject scores, or skip collisions. This proves mechanical feasibility, not human usability or browser input quality.
- Additional tests cover deterministic bounded schedules, every authored goal's failure condition, stage-end clocks, stable affection-independent handling, locked stages, losses, interruption, inactive-player introduction failure, legacy preservation, JSON reload, first rewards, repeat claims, and improving replay scores.
- Full `npm test`: **807 tests, 806 passed, one failed** at the time of the run. The sole failure was the release offline manifest check reporting root's new `household-echoes.js` missing offline. Root was notified to regenerate/add all new assets.
- `node --check src/ui/chase.js` passed. `git diff --check` passed.
- Added two browser scenarios for default gentle setup/pause and 320px layout/advanced free play. Attempted desktop and mobile Chromium execution, but all four cases were blocked at browser launch: installed Playwright expects Chromium headless shell revision 1243, whose executable is absent. No browser assertions executed and no visual browser success is claimed. Root owns browser verification and release.

## Limits

Campaign records are durable; an interrupted live physics attempt restarts without rewards, consistent with the existing Chase runtime. Per-stage records aggregate both pace settings; old free-play pace records remain separate. Platform browser verification, state/reward integration, and release manifest completion must be checked by root before publication.


## Review corrections

Two review regressions were reproduced with failing tests before applying fixes.

1. **Pending reward lost during cooldown.** The claim API now supports `{consume:false}` for eligibility checks. The coordinated play.js hook only consumes the durable receipt after a positive fuss or bond grant. A cooldown clear still unlocks the next stage and records mastery, but retains its unclaimed reward. Result copy distinguishes a pending reward from one already received. An integration test clears through real normal-control gameplay while the chase cooldown is active, calls `rewardHandshake`, round-trips through JSON and `normalizeState`, replays after cooldown, verifies a positive reward and consumed receipt, then verifies a subsequent replay pays nothing.
2. **Safe-side occupancy counted as crossing.** Each scheduled broom records whether the resident was in its threatened area when the warning began. An escape counts only if that resident has moved out by activation. Starting and remaining on the safe side earns no crossing. The vacant-half crumb cues now follow the warnings, supporting the taught crossing. A regression runs `targetX:240` throughout at both paces and verifies zero crossings and a loss.

After coordinated reward-hook changes, the focused Chase suite passes **48/48 tests**. The existing real-controls feasibility test still completes **all 48 course/pace/body combinations**. No browser success is inferred from these engine/integration checks.
