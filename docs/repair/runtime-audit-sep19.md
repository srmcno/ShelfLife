# Independent runtime audit — 19 September 2026

This audit exercised the local application in Chromium against the dependency-free server on port 4181. It began by adopting Mabel from the actual arrival screen. No engine actions, prewritten wins, manipulated clocks, or seeded progression were used. Playwright drove normal buttons, keyboard movement, and visible gesture pads. Read-only page inspection supplied the same positions, exhibits, and animation cues available to a player.

## Played and earned

| Activity | Actual result | Recovery / persistence evidence |
| --- | --- | --- |
| Crumb Chase | Lesson 1 cleared, four crumbs, 90 points, three stars; lesson 2 unlocked | Pause held the clock; resume completed the same attempt. Earned record survived reload. |
| Handshake | Echo's three rounds completed by repeating the visibly lit pads, zero mistakes; Long Echo unlocked | The same adopted resident retained the record through later reloads. |
| The Alibi | All three interviews completed; one lie found, two incorrect accusations | The result correctly reported partial success, gave the missing evidence, and did not unlock the next lesson. This was not a clean-win claim. |
| Expedition | Drawer route: detour, matching tool, then recover; three stops, five trail points | In-progress trip survived closing and reopening Chromium. The two actual parts installed the Button Lift. Completed report persisted. |
| Night Market | Bought the visible Shiny and Edible objects, delivered the pair, returned home; 18 points, the displayed route optimum | In-progress purchases survived browser closure. Delivery unlocked the next lesson. Reopening the completed report did not repay it. |
| Shelf Court | Read both exhibits and every suspect's verified observations, cleared two innocents using actual contradictions, accused the remaining suspect; 120 points, no missed arguments | Curious unlocked. Reopening the result retained the verdict and score without another reward. |
| Play rug | Soft, high, and bounce throws each caught and returned; three normal bubble-pop actions | Five distinct tricks earned and still visible after reload. The household's earned XP remained 36 after reopening completed reports and the rug. |

The persistent-state comparison covered Chase records, handshake record, installed projects, outing and market counts, court wins/best, rug discoveries, and household XP. All compared values were unchanged after repeated report reopenings and reloads. The exact comparison is in the local audit evidence.

## Responsive and runtime checks

All six activity entry screens and the rug were opened at 320, 390, 430, and 1440 CSS pixels: 28 layout checks. Document/body width and open-sheet content width stayed within the viewport/sheet; no horizontal clipping was found. Settled rug and court screenshots were retained at each width. The new room is visible behind the resident. At 320 × 740, the rug sheet fits exactly inside the viewport, its longer contents scroll vertically, the throw button accepts normal clicks, and the moving ball measures 32 × 32 pixels.

The normal `localhost` preview produced no JavaScript page errors or console errors in completed gameplay. A separate `127.0.0.1` preview emitted a 404 for `/api/voice`: that hostname intentionally enables discovery of the installed desktop speech endpoint, which the static preview does not implement. This is not evidence of a failed public-host voice request.

## Substantive finding sent to the implementing agent

Opening Play before adopting any resident could throw `Cannot read properties of null (reading 'approach')`. In `src/ui/playroom.js`, `adventure?.petId === pet?.id` evaluated true when both values were absent, then dereferenced `adventure.approach`. This is an empty-household navigation bug, not a demonstrated save-loss bug. The root agent repaired the guard. Independent retest with a fresh 390-pixel browser now opens the empty playroom, shows the first-resident action and disabled game cards, and produces no page errors.

## Evidence and limits

Local scratch evidence is under `../qa/` relative to this checkout, including `playtest.mjs`, the chronological `play-*.log` files, `court-facts.log`, `layout-results.json`, `persistence-results.json`, `browser-state.json`, `earned-state.json`, and `layout-{rug,court}-{width}.png`. The stored household is the one earned through these actions, not a rich fixture.

This independent pass did not complete all 12 Chase lessons, every mastery tier, optional trick challenges, Safari/iOS behavior, or a deployment. It did not use synthetic established/drawing-heavy households. Automated regression suites and release checks run by the root agent are separate evidence. Screenshots demonstrate the inspected layout; the action logs and saved-state comparisons substantiate gameplay and persistence.

## Additional campaign input pass

A second, isolated Chromium pass exercised lessons 3–12 with real arrow-key, Space, and X input, using rendered item positions and warning classes. A **synthetic practice-access fixture** supplied zero-score historical completion flags for lessons 1–11 solely to expose the stage selector. Those flags are not earned progress and are not counted as browser victories. No engine methods, runtime win flags, collision events, or clock changes were injected. The current attempt’s visible result screen supplied each outcome below.

| Lesson | Actual attempt outcome | Visible goal result | Score |
| --- | --- | --- | --- |
| 3. borrowed-knees | Won | 3/3 air catches | 120 |
| 4. dust-procession | Won | 2/2 hopped hazards · 3/3 crumbs | 275 |
| 5. broom-breaker | Lost | 1/2 dash smashes | 15 |
| 6. whole-estate | Won | 3/3 whole biscuits | 475 |
| 7. vacant-half | Won | 2/2 safe-side escapes · 3/3 crumbs | 205 |
| 8. witness-protection | Won | 2/2 rescued crumbs | 235 |
| 9. sugar-executor | Won | 4/4 catches during sugar rush | 175 |
| 10. moon-shelf | Won | 3/3 high catches | 215 |
| 11. clean-switchback | Won | 3/3 left crumbs · 3/3 right crumbs · 0/1 bumps at most | 215 |
| 12. last-inventory | Won | 1/1 dash smash · 2/2 whole biscuits · 3/3 final gold crumbs | 775 |

Nine of these ten attempts won. Broom breaker landed one real dash smash and missed its second requirement; the game correctly offered another attempt. No defect is established by that timing-driver loss. The final lesson did execute its broom dash, two biscuit catches, and three gold-arc catches successfully in the browser. Its displayed “all twelve” text reflects the synthetic access history; this audit does **not** claim a fresh sequential twelve-lesson completion.

There were no page errors during the valid ten-lesson pass. An initial harness iteration misread whitespace in serialized CSS transforms and failed to steer; its early lesson 1–2 outcomes were discarded as invalid evidence. Lesson 1 has the separate legitimate fresh-household victory above; the repository’s existing first-two-lessons browser regression is separate evidence for lesson 2. No extra retries were run. The bounded pass ran alongside the main regression suite, so its results are not a frame-rate benchmark.

Evidence: `../qa/campaign-browser-practice.mjs`, `campaign-browser-results.json`, `campaign-browser.log`, and `campaign-practice-{4,5,9,12}.png`.
