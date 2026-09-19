# Whole-branch independent review

Reviewed baseline `e77b69bf0736d616ada031806742ca7f82e6e80c` through `0a5a506`, including the implementation plan and the mastery, rug/household, and Chase review reports. Followed the requesting-code-review review scope; no product edits or delegated reviewers. This is an engine, persistence, source, and generated-markup review, not a browser or touch playtest.

## Verdicts

**Spec compliance: substantially implemented, with changes requested.** The authored Chase campaign and its separately reviewed fixes, explicit beginner-to-advanced mastery paths, additive state, real rug contact/hold/miss mechanics, room artwork integration, and bounded aftermath journal are present. Three defects below violate challenge accounting or the explicit UI/fact truth requirement.

**Quality: changes requested for the P2 findings below; no P1 found.** Existing suites do not catch the new beginner Market copy or the rug UI's selection of a single event from a multi-event packet. Do not describe the whole repair as browser-verified based on this review.

## P2 findings

1. **Rug challenges silently discard valid catches when another outcome shares the update packet.** `src/ui/play-rug.js:132–146` picks one event for caption priority and uses that same selected event for challenge accounting. A miss takes precedence over a clean catch; `recover` also always precedes its associated `catch`, so recovered bounce/high catches cannot advance those challenges. Caption arbitration must be separate from processing all actual catch receipts. Independent ordinary-physics reproduction at 60 Hz: create a plain resident `a`, toss these three balls, then call `updateRug(game,1/60)` 32 times:

   ```js
   [
     {x:299.9724931549281,y:360.8219346217811,vx:-465.8732370007783,vy:-102.27733589708805},
     {x:430.52322684787214,y:187.48868385329843,vx:-112.05028020776808,vy:546.7134229838848},
     {x:250.57167279534042,y:207.31892039999366,vx:510.38915920071304,vy:-475.1025181263685}
   ]
   ```

   Frame index 31 emits `bounce, miss, catch, trick, trick`. The engine catch is real and earns its trick; the UI chooses `miss` and cannot increment the active clean-catch challenge. Add a focused challenge-accounting regression for this packet and for `recover, catch`; ensure repeated handling cannot duplicate challenge credit.

2. **The first Market lesson tells a successful novice that two errands are unfinished.** `src/ui/market-errands.js:69` still hardcodes `/3`; `src/engine/life.js:323` chooses success prose only for `done===3`. Reproduced using a new learning Market, buying each of the two sole offers, normalizing a JSON save after each purchase, delivering the single request, and rendering the dock. It says **“Return home · 1/3 delivered”**. The claimed scene then says **“Pip delivered 1 of 1 household errands … The completed errands are pleased. The others have requested your manager.”** The actual mastery advance and reward are correct, but this contradicts the taught one-errand goal and the final results screen. Use `requests.length` for both denominator and complete-list prose; add a generated-markup plus saved-scene check for tier 0.

3. **The opening aftermath recalls a different incident from the one the player chose.** `src/engine/welcome.js:55` records every welcome branch as the same generic opening; `src/household-echoes.js:22` renders it as a spat crumb in a matchbox coffin measured by a woodlouse. Reproduced with `unpackWelcome` then `chooseWelcome(state,'share')`: the saved scene says Pip offers a crumb to **Madam Moth**, who eats the mourners; immediately afterward `householdAftermath` says Pip **spat a crumb into a matchbox coffin and a woodlouse measured it**. The sleeping/keep branch is even further removed. Store the actual opening variant/guest or give welcome its own fact-preserving aftermath. Add a test through the real welcome choices and JSON reload, rather than only testing a manually injected generic event.

## Verified behavior and scope limits

- Independently reran the focused mastery, interception, and echo suites: **18 passed, 0 failed**. Root owns the full 823-test and CI browser gates. Existing focused tests verify additive mastery normalization, high-affection novice entry, duplicate serialized lesson rejection beyond the recent receipt buffer, market attainable layouts, first-lesson transaction restoration, Court unique solutions/reward boundaries, and expedition branch/first-step restoration.
- Reviewed novice Alibi auto mode, proof selection, two-record keyboard toggles, Court automatic next level and locked advanced buttons, persisted Market version/tier routing, expedition branch reconstruction/search and partial-return rules. No additional progression blocker found. Combine mode still marks only `round.proof` with “Contradicts the lie” in `src/ui/play.js:286` instead of highlighting both `round.proofs`; this is a smaller explanatory inconsistency worth fixing alongside its UI pass.
- Court result markup does not show the newly unlocked mastery condition; “Another case” does correctly start the next tier. Market results similarly omit the mastery announcement. These are teaching/feedback scope gaps rather than corrupted progression.
- New mastery/campaign fields are normalized additively. Legacy Market versions and active transaction prefixes remain explicitly routed. Rug trick rewards retain issued-object checking and durable saved trick sets. No custom-art rewrite was introduced in state normalization. This does not prove every arbitrary historic save or backup format from source review alone.
- The remaining presentation scope is limited: aftermath is a generic small stage plus prose, and the opening's ensemble is a resident and a visitor. Existing expedition project effects remain; this diff does not establish a richer new household workshop system. Treat broader ensemble choreography or bespoke persistent prop transformations as remaining product scope, not evidence supplied by the green tests.
- Actual 320px Alibi two-record usability, Court unlocked result/next navigation, mobile controls, artwork appearance, and published offline service-worker behavior still require root's browser/release verification. No screenshots were generated or visually approved by this reviewer.

## Targeted fix re-review — `079933e` and `f704897`

**Spec verdict for all three P2 findings: resolved. Quality verdict for these fixes: approved. No remaining P1/P2 found in this targeted scope.** The earlier findings above document the reviewed pre-fix behavior.

- Rug challenge accounting now iterates every catch independently of caption selection, tracks processed IDs within the challenge, and caps the count at three. The exact multi-ball 60 Hz reproduction is now a passing regression; duplicate packet handling and recovered bounce/high catch handling also pass. Permanent discovery rewards retain their separate issued-event boundary.
- Beginner Market now uses the actual request count in the return button and complete-list scene copy. The new regression drives legal purchases/delivery, checks the generated dock, restores the save, and verifies correct saved success prose. Market and Court now save and restore the actual unlocked tier for result announcements; practice does not invent an unlock.
- Welcome now stores a distinct `welcome` event and the exact awake/sleeping share/keep variant. All four real welcome routes preserve Madam Moth and their branch-specific action through JSON reload. The new CSS depicts the moth and bowl for that event rather than the generic woodlouse/coffin appearance.
- The smaller Alibi teaching inconsistency is resolved: both required proof records receive combined-proof feedback, while an unrelated record does not. Court/Market result unlock feedback is also resolved.
- Inspected aftermath sprite mounting: `renderPetSprite` is already imported, `petById` resolves the event's validated resident, and `updateMarkup` returns the boolean used to mount the sprite. No obvious exception or art mutation found. The aftermath cache remains keyed by event ID, so an existing event's name/art will not refresh immediately after a resident edit; this is a minor display-cache limitation, not a save or reward defect.

Verification: independently ran `test/mastery-paths.test.mjs`, `test/rug_interception.test.mjs`, `test/welcome-lifecycle.test.mjs`, and `test/household_echoes.test.mjs`: **30 passed, 0 failed**. This targeted approval does not replace the outstanding CI/browser/mobile/release gate or broaden the original visual-validation claims.
