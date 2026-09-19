# Chase review

Reviewed commit `b4d98af` against Task 1 of `implementation-plan.md` and `chase-report.md`, plus the working-tree campaign normalization in `src/state.js`, reward integration in `src/engine/play.js`, and stylesheet link in `index.html`. Product files were not changed.

## Spec compliance verdict: mostly compliant, changes requested

The twelve authored stages, three chapters, distinct schedules and goals, visible teaching text, independent default-gentle control, stable affection-independent handling, unlocked lesson selection, next-lesson setup, and retained free-play modes are present. Campaign progress is versioned and bounded. Wins unlock consecutive lessons; losses and interruption do not. Legacy `chaseBest` and `chaseRecords` are kept separate. One stage does not actually require its advertised crossing skill; see finding 2.

## Quality verdict: changes requested

1. **P2 — A cooldown consumes the permanent stage reward without paying it.** `src/engine/play.js:147` calls `claimChaseCampaign`, which sets `record.rewarded=true` in `src/content/chase-campaign.js:75`, before the cooldown/asleep gate at `src/engine/play.js:170`. With a recent Chase play, a first campaign win returns `{practice:true,fuss:0,bond:0}` but saves `rewarded:true`. JSON reload through `normalizeState`, followed by replay after the five-minute cooldown, still grants zero permanently. This will affect ordinary sequential campaign play because courses last only 14–30 seconds. Keep win/unlock recording independent, but defer the reward receipt until the reward is actually eligible, or establish and communicate a different explicit policy. Add an integration regression through `rewardHandshake`; current receipt tests call the campaign helper directly and miss this ordering.

2. **P2 — The safe-side escape lesson can be cleared without crossing back.** `src/engine/chase.js:430` credits `safeCrossings` whenever the player is outside the broom's half at resolution, regardless of whether the player moved out of its warning area. `src/content/chase-campaign.js` defines `vacant-half` as two escapes plus three catches with no bump limit. Reproduced using normal physics and only `updateChase(game,{targetX:240},1/60)` for the entire lesson at both paces: complete=true, two credited escapes and two bumps. The player moves right initially and then never changes sides, despite the lesson saying to cross before each warning ends. Track a real threatened-side-to-safe-side transition during a warning, or author a win condition/schedule that requires alternating safe decisions. Add a negative fixed-side strategy test.

## Verification and remaining limits

- Reran `node --test test/chase_campaign.test.mjs test/chase.test.mjs test/chase_clock.test.mjs test/chase_input.test.mjs test/chase_flow.test.mjs`: **45 passed, 0 failed**. The existing solver completes all twelve stages at both paces with plain and winged residents using ordinary physics controls.
- Independently reproduced both findings with small read-only Node probes. The reward probe used `blankState`, `normalizeState`, `recordChase`, `rewardHandshake`, and a real JSON round trip.
- Record routing and normalization preserve old scores. Successful claims have durable receipts and cannot be paid again after reload. Replays can improve scores and do not regress unlocks. Interrupted live games do not record.
- Static UI review: the lesson selector permits every unlocked earlier lesson and disables locked ones. A completed lesson's Next button calls `prepare` for the following lesson before starting its timer. Change setup returns to the selector for earlier practice; lesson 12 offers practice. Quick Chase and Midnight Run remain selectable under Advanced, with their existing venue/run behavior and legacy record keys.
- Browser interaction, desktop/320px layout, and actual back/next clicks were not executed in this review. The implementation report accurately identifies its browser launch failure. Root's browser/release verification remains necessary; source inspection is not a visual or touch usability pass.

## Scoped fix re-review — `5edb5d8` and current reward hook

**Spec verdict for the two findings: resolved. Quality verdict for these fixes: approved.** No new Chase regression found within the fix scope.

- Finding 1 is resolved: the initial campaign receipt check now uses `consume:false`; the current `src/engine/play.js` consumes the receipt only after a positive fuss or bond grant. Cooldown/asleep exits keep it pending. The new integration test completes real courses, normalizes a JSON reload, grants the later eligible reward, and rejects another paid replay. Result copy now distinguishes pending rewards from already claimed rewards. The shared handshake mastery hook explicitly excludes `kind==='chase'`.
- Finding 2 is resolved: broom spawn records whether the resident was in the threatened half when the warning began, and the escape count requires safe-side resolution of that warning. The adjusted crumb schedule supports actual alternating crossings. The fixed-side strategy now fails at both paces; all twelve lessons remain physically completable at both paces for plain and winged residents.
- Verification: the five focused Chase test files pass **48/48**. Also ran `test/play.test.mjs` with them because the reward function is shared: combined **53 tests, 52 passed, 1 failed**. The failure is the handshake test `practice never farms rewards, reload preserves cooldown, and later games reward again` at `test/play.test.mjs:21`, which reads `.practice` from a null result. This is outside the two Chase fixes and has been reported to root for the activity worker/release gate; it prevents claiming the broader shared-play suite is green.
- This re-review does not replace root's outstanding browser and release checks.
