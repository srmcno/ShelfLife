# ShelfLife repair follow-through — September 19, 2026

## What the interrupted conversation actually delivered

The supplied review described e77b69bf0736d616ada031806742ca7f82e6e80c. The local primary checkout was still at that revision, but GitHub and the live release were already at 4a3e50a622ae00224b906fd5822cc8a910f4cfa7. PR14 had merged the campaign, rug mechanics, game mastery, room art and aftermath; PR15 corrected catalogue summaries. The ChatGPT review correctly said it changed no code. The subsequent “Stuck progress feedback” conversation exposed the implementation request and follow-up but no assistant completion message. Repository and live evidence establish that substantial work was published despite the missing handoff.

This release builds on that work. It does not claim to have invented or reimplemented the twelve lessons, physical catching engine or entire mastery system.

## Completed areas

| Request | Retained prior implementation | Follow-through in this release |
| --- | --- | --- |
| Chase progression | Twelve authored lessons, three chapters, normal/mirrored replay, persistent versioned records and independent gentle pace | Removed hidden free-play side-quest score bonuses from campaign; taught the final gold arc before spawning it; corrected pause goals and broom Dash instruction; revised result/personality writing |
| Rug mechanics | Bounded reaction, acceleration and contact; catches, fumbles, recovery, misses, refusal, held ball and return; untimed challenges | Added ordinary-command fumble-to-return and refusal regressions; kept 32px phone ball; visitor approaches a missed catch; captions hold for three seconds and retain bounded reading history across visits |
| Rug environment | Earlier replacement was a realistic decayed parlor | New ink-and-gouache room: angular damaged joinery, peeling wall, damp hand-shaped mark, gutted chair, tooth dish, clear worn rug; shared shelf backdrop updated; saved creature art untouched |
| Other game mastery | Handshake rituals, two-record Alibi, uniquely solvable Court, feasible Market tiers, expedition crew/branch decisions | Alibi practice cannot unlock mastery; practice Handshake claims are one-use while intentional replays get fresh receipts; unsupported evidence explains itself; expedition detours archive their actual visited stops and expose branch consequences/unlocks |
| Dark comedy | Strong Court/expedition material and household theatre retained | Reworked common care, arrivals, rug/discoveries, Handshake/Chase and all sixteen adventure endings around physical wrongness and petty motives; fewer narrator punchlines; useful instructions stay plain |
| Consequences | Persistent household echoes and workshop projects | Correct Court culprit/witness distinction; no imaginary haul on empty returns; per-resident rug props for bath, conviction, market and expeditions; callbacks reference only the prop actually displayed |
| Navigation | Five destinations, consolidated archives, existing focus behavior | Fixed Play tab crash before adoption; ordinary empty-state, game-return and responsive paths exercised |
| Preservation | Existing additive normalization, backup, rewards and drawings retained | Versioned adventure content: old album stories/titles/callbacks remain exact; new stories use edition2; new replay events do not replace the original album or repay it |

Cosmetic reading history is flushed when switching residents, pausing, leaving the rug or hiding the page; it does not synchronously serialize drawing-heavy saves for every caption. Reduced motion keeps physical outcome poses but disables the new prop/visitor animation.

## Verification and release

- Node domain suite, Python packaging/desktop endpoint tests and static build are required gates.
- Playwright covers desktop Chromium, phone Chromium and phone WebKit, including 320/390/430 layouts, custom drawings, legacy restoration, interrupted scenes, rewards, backup and offline installation. Unsupported/desktop-only cases remain explicitly skipped.
- Independent fresh-household UI play completed all six activities and the rug. Chase1, Echo, Court, Market and Expedition were successful; Alibi was a recorded 1/3 result. Progress survived reload and completed-report revisits did not issue duplicate rewards. See runtime-audit-sep19.md.
- Deterministic engine course checks cover all twelve lessons, mirrored routes, both paces and plain/winged bodies (96 actual simulated clears), plus progression/loss/receipt tests. These are simulation evidence, separately identified from browser input.
- Browser gameplay and screenshots establish implementation behavior, not a measured universal humor rating or physical-device guarantee. No physical iPhone/Android or multi-day human study was performed.
- Release follows the repository PR/CI/Pages pipeline. Its deployment verification checks release.json, exact revision cache, live desktop/phone play, persisted records and offline artwork.

Final counts, released revision and links are recorded in the PR and user-facing delivery notes.
