# September 19 mastery follow-through

## Verified existing work

The September 19 repair already implemented real mastery paths for Handshake, Alibi, Court, Market and Expeditions. Inspection plus domain checks confirmed that affection does not select difficulty; Court cases have a unique consistent culprit; Market layouts use legal transactions and an attainable-score solver; expeditions reconstruct saved crew rules and branched decisions. Practice, incomplete returns, legacy shopping rules, daily project use and exact homecoming focus were present. These were retained.

## Additional fixes

- Explicit Alibi beginner practice now preserves history and ordinary care rewards without unlocking a mastery lesson. The UI labels the choice as practice and sends the intent to the engine. Normal mastery interviews still advance through all three lessons.
- Handshake practice consumes its completion receipt, preventing a serialized copy from counting or paying again after a reload. An intentional replay of the same pattern receives a fresh practice receipt; it retains the actual sequence and ritual.
- A correct accusation with incorrect combined evidence now produces the appropriate unsupported-evidence note, rather than claiming the player believed zero lies as if that explained the failure.
- Expedition detours now have separate additive field-note IDs, e.g. `drawer:0:detour`. The workshop reconstructs the first original encounter and the two actual detour encounters. Original IDs remain untouched. All 24 original and 24 detour pages survive normalization; each route variant awards discoveries once.
- The advanced detour button states that it changes stops 2 and 3. Homecoming states the exact new mastery lesson, retains that message after reload, and does not announce another unlock on a replay.
- High-frequency Handshake reactions now use distinct physical incidents (loose joints, teeth, damp duplication, rigor) instead of resolving each ritual into reassurance. Alibi references named incidents in natural character speech and has a dedicated two-fact reaction. This is an editorial revision, not evidence of measured audience response.

- Court scene metadata now distinguishes a real resident’s conviction from the host witnessing a stand-in’s conviction. The generic echo forwards this role to household aftermath, avoiding an innocent host inheriting guilt. A seeded-case regression exercises both paths and restoration.

## Evidence

The first three regressions failed against the starting source, then passed after implementation. The branch archive and expedition unlock regressions likewise failed before their fixes. Seven new domain regressions cover these boundaries, including JSON normalization, duplicate calls, old-history preservation and the generated player-facing markup.

- Focused Handshake/Alibi/mastery set: 38/38 passed after the first fixes.
- Focused expedition/navigation/mastery set: 43/43 passed after branch and unlock fixes.
- Final combined domain run: **857/857 passed** (`npm test`, local log `/tmp/shelflife-mastery-full-final.log`). This includes concurrent Chase/rug work at the time of the run.

No physical-device or browser claim is made by this workstream. The parent release workflow owns browser interaction, screenshot review, build and deployment verification. Existing old field-note entries are preserved as recorded; their original branch choice was not stored and cannot safely be inferred retroactively.

Court-role follow-up: all 28 focused mastery tests pass after adding the role metadata. Parent owns the corresponding household aftermath wording and final integrated full-suite rerun.

## Story-edition preservation

The revised adventure endings now use authored content edition 2. The exact baseline ending text, callback, labels and titles are retained in `src/content/escapades-legacy.js`; unversioned old receipts and scenes resolve to that edition. Newly earned album records carry edition 2. A replay stages the new story and a versioned callback without replacing the first-earned album, changing its original resident name, or paying discoveries again. Scene edition and ending identity survive ordinary save normalization. Resident speech uses the latest valid completed scene where available, falling back to the actual resident's album, and uses the resident's current name safely after rename.

Three additional tests cover an unversioned album with a literal `$&` name, a new replay of a legacy keepsake with zero repeated discoveries and normalized scene callback, and an unversioned replay scene that must keep its older ghost story. Existing new-story assertions now check the new telescope callback. Focused story/resident suite: **43/43 passed**.
