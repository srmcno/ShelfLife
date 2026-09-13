# Save, transfer and CPU verification

Checked 13 September 2026 during the household revision. This is a bounded reliability report, not a claim that every game or browser environment was played.

## Performed checks

- Before implementation, `node --test test/*.test.mjs`: **647 passed, 0 failed, 0 skipped**, 6.98 seconds.
- After adding the fixtures and failure-path test, `node --test test/fixture-matrix.test.mjs test/backup.test.mjs`: **18 passed, 0 failed, 0 skipped**, 0.44 seconds. Eleven tests were added across these files.
- The existing storage/release and animation resilience tests were also executed. The intermediate combined run passed **39 of 40**. Its only failure correctly identified that a newly added production module was still missing from the offline asset list during integration. The final release suite, run after offline asset updates, is the release gate and supersedes that intermediate result.

| Synthetic fixture | Specific assertions performed |
| --- | --- |
| Fresh save | Empty state restores, defaults remain stable, simulation can start. |
| Established household | Three identities, generated anatomy, rename history, placement history, care counters, scenes, projects, achievements and former resident records survive repeated transfers. |
| Nearly full cabinet | Fourteen residents plus three pieces of furniture occupy exactly seventeen distinct slots. Transfers and one elapsed simulation minute preserve resident count. |
| Drawing heavy | Twelve valid synthetic raster PNG bodies, eighteen stamp layers per resident, and saved drawing bounds survive byte-for-byte. Serialized fixture is 954,213 bytes. |
| Conflicting preferences | Nocturnal, sugar-seeking, porcelain and damp residents keep their traits and placement through transfer and can resume simulation. This does not assert that their autonomous choices are ideally balanced. |
| Sleeping residents | Nocturnal residents are confirmed asleep at the test's explicit local noon. Saves restore their traits; the fixture naturally wakes at night in real-time browser testing. |
| Full needs and capped trust | Needs at 100, trust at 25, the daily bonus cap and individual activity timestamps survive transfer without resets. |
| Older imported save | Version 3 flattened drawing images migrate to version 4 art without losing pixels or residents; an established household skips the new introduction. |

Every populated fixture includes recorded relationship time and shared plots, visitor collection/statistics, a former resident/name record, an off lamp, and a partially consumed bowl. Tests preserve those records as well as identity and art. Each fixture is exported, restored, and transferred three additional times to check stable normalization without modifying the original import preview. A post-restore tick, behavior pass and story update are actually executed.

Transfer checks exercise JSON preference, identical-data text fallback, correct file attachment and restore instructions, synchronous share invocation from the click handler, cancellation, rejected sharing, duplicate-tap prevention, and the explicit download fallback. The added UI test verifies that a thrown download failure leaves backup bookkeeping untouched and the email action hidden, then allows a successful retry. These are simulated Web Share and DOM hosts, not native iOS or Android share sheets.

The quota regression starts with the only copy stored under the legacy key. A failed current-save write keeps that legacy copy and the latest in-memory changes. A successful retry writes the newest resident name, reports persistent storage again, and only then retires the old key. Existing executed tests also cover malformed imports, corrupt-save recovery, and refusal to overwrite a corrupt original when its recovery copy cannot be saved.

## CPU measurements

Reproduce with `node test/benchmark.mjs`. These measurements use Node v24.19.0 in the development environment, five warmup calls per operation, and the iteration counts below. They do not include DOM updates, localStorage disk latency, image decoding, GPU work or physical touch handling. Concurrent development work can affect timing.

| Operation | Iterations | Median ms | p95 ms |
| --- | ---: | ---: | ---: |
| Established save: parse and normalize | 40 | 0.337 | 2.050 |
| Nearly full save: parse and normalize | 40 | 0.726 | 1.239 |
| Drawing-heavy save: parse and normalize | 40 | 4.371 | 9.076 |
| Established save: JSON serialization | 100 | 0.051 | 0.110 |
| Nearly full save: JSON serialization | 100 | 0.179 | 0.273 |
| Drawing-heavy save: JSON serialization | 100 | 3.528 | 4.970 |
| Established household: elapsed simulation minute | 120 | 0.053 | 0.677 |
| Nearly full household: elapsed simulation minute | 120 | 0.159 | 2.866 |
| Drawing-heavy household: elapsed simulation minute | 120 | 0.191 | 2.393 |
| Complete 22-second Chase engine simulation, 1,320 updates | 100 | 0.749 | 2.274 |

These measurements identify raster save serialization as substantially more expensive than generated-art serialization. They do not establish a browser frame-rate problem or justify changing Chase difficulty. No speculative performance rewrite was made in this reliability work.

## Browser limitations and reusable harness

The provided browser rejected both local ports with `net::ERR_BLOCKED_BY_CLIENT`. No responsive screenshot, DOM profile, browser memory measurement, live backup upload or native share-sheet result is claimed here. Hidden-tab and reduced-motion lifecycle checks cited above were executed using the existing deterministic animation hosts, not physical devices.

`test/responsive-harness.html` provides a developer-facing synthetic fixture loader, 1366×768 / 1280×720 / 390×844 / 360×640 / 844×390 CSS frames, a 150% base-text switch and a five-second frame/DOM-mutation sampler. Run it on an isolated local port because loading a fixture replaces that origin's test shelf. It preserves the prior version 4 test shelf for restoration. The normal Pages build excludes the entire `test` directory. The harness has not been browser-verified in this environment, and its iframe sizes are responsive desktop-browser checks rather than device emulation.

Physical iOS Safari, Android Chrome, concurrent physical move-and-hop touch input, native email attachment delivery, device-specific downloads and browser memory remain unverified by this subtask. See the final release report for separately performed deployed-game checks.
