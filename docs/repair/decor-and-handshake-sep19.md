# Decorate restoration and Handshake follow-up — September 19, 2026

The preceding art release incorrectly reused the perspective rug-room image behind the flat cabinet shelves and hardcoded their wood colors. Decorate saved choices that the cabinet did not show. This repair restores the earlier cabinet geometry and material construction, preserves all six columns and saved positions, and makes the chosen wallpaper visible on the cabinet back. The play rug retains its own room image.

The picker now shows a live material preview with the player's own residents. Room paint, wallpaper, wood and interface accent each change their intended surfaces; focus remains on the chosen button; saving reports success or storage failure. Night lighting no longer replaces chosen wallpaper. Bone wood uses dark name lettering; darker finishes retain light lettering. No resident artwork or saved decoration selection is replaced.

Browser regressions exercise every material option, preview agreement, reloads, keyboard focus, 320/390/430/1440 layouts, storage failure and nighttime appearance in Chromium and WebKit.

The reported Handshake failure was described as round four / the first sequence not accepting the second square. Direct coordinate input, repeated taps, first-to-second-square input, all ritual modes and Encore were exercised without reproducing that exact report. Synthetic unlocked tiers expose later lessons; all rounds are completed through actual UI input. These tests must not be described as proof that the user's specific failure was fixed.

A separate interruption path explains one legitimate locked state: losing focus after the first correct move pauses and resets the current sequence. Its former cue, “Take your time”, did not explain why the squares stopped responding. This release makes the paused and retry states explicit and offers a clear resume/replay action. The dedicated regression interrupts round four after one correct move, resumes the same round and completes it. Duet demonstration wording distinguishes remembering a beat from being allowed to tap.

Browser CI now runs its three browser projects in separate jobs and retains separate evidence archives. Every existing test remains in the gate; no assertions or platform coverage were removed.

The final handoff records test results, the published revision and remaining uncertainty about the exact reported Handshake trigger.
