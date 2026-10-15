# Verification and visual upgrade results

Generator **3.1.0**, schema **2**. Architecture retained: framework-independent TypeScript core; Vue/Quasar/Pinia editor; Canvas artwork and temporary exploration state outside authoritative dungeon data.

## Completed campaigns

| Run                     |  Cases | Successful | Failed | Purpose                                                                           |
| ----------------------- | -----: | ---------: | -----: | --------------------------------------------------------------------------------- |
| Initial baseline        |  1,000 |        972 |     28 | Identify failures in generator 3.0.0                                              |
| Core verification       | 10,000 |     10,000 |      0 | Verify fixes before artwork                                                       |
| Final post-art campaign | 10,000 |     10,000 |      0 | Recheck with independently measured shortcut distances and public corridor access |

[Final JSON](../../reports/verification/final/report.json) includes full coverage, attempt counts, and the slowest ten seeds/configurations. [Original baseline](../../reports/verification/baseline-smoke/report.json) retains every failure, with individual reproductions in its `failures` directory. A preliminary successful run is retained in `full-run`; it predates the final import-safety hardening.

The final campaign used Node v24.21.0 on Windows, AMD Ryzen 7 6800H, four worker threads. It completed in **79.74 seconds**. First-generation timing includes production validation and retries:

| Statistic       | Milliseconds |
| --------------- | -----------: |
| Mean            |         6.42 |
| Median          |         3.13 |
| 95th percentile |        22.00 |
| Worst           |        83.09 |

The worst case was `verification-003341-5s`, 96×96; its complete configuration is in the report. Parallel CPU contention affects these measurements. They do not establish low-end device latency.

Both presets ran 5,000 times. Each dimension ran 1,250 times: 16², 24², 32², 48², 64², 96², 48×32, 64×48. All six irregular footprint families were exercised; 3,490 floors included chamber blocks and 2,902 included accepted secret shortcuts. Shape coverage counts floors containing each shape, rather than individual rooms.

9,729 floors succeeded on the first layout attempt. The remaining **271** succeeded on bounded retries: 183 on attempt 2, 57 on 3, 24 on 4, four on 5, one each on 6/7/8. No case exhausted the eight-attempt budget. Successes preserve every prior rejection reason in their floor diagnostics; retries are not counted as silently discarded cases.

## Defects and retained regressions

All 28 original failure configs are permanent tests in [regressions.json](../../tests/fixtures/regressions.json):

| Defect                                              |    Initial cases | Example                        | Correction                                                                                                  |
| --------------------------------------------------- | ---------------: | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Small-map sampling left only one room               |               22 | `verification-000004-0`, 16×16 | Deterministic bounded layout retries                                                                        |
| Dense placement left no legal ordinary connection   |                5 | `verification-000234-e`, 48×48 | Retry placement without weakening wall or doorway invariants                                                |
| Schema rejected a valid single shared doorway       |                1 | `verification-000044-2`, 16×16 | Schema-2 door/diagnostic minimum lowered to one                                                             |
| Imported ordinary entrance could be retagged secret | Adversarial test | Default two-room fixture       | Close all hidden doors and independently require all rooms/stairs reachable; reject unrecorded secret doors |

The user's `atelier-1l9r6un-16gc8ja` seed is additionally checked at 64×64 with secret chance 100%. Exact historical output requires generator 2.1.0; this regression checks the current generator's safety for that seed, not historical pixel/layout equivalence.

The final Node suite has **70 passing tests**, including shape integration, template fallback, invalid/mutated imports, retry exhaustion/metadata, long/Unicode seeds, serialization, and unchanged legacy fixtures. Every stress case generates twice, is independently graph/geometry checked, round-trips through real JSON export/import, and is checked again. No failed cases are counted as successes.

## Visual changes and browser evidence

Only Stone artwork changed. Surfaces now use quieter mineral grain and veins, chipped bevels, stronger mortar, darker wall faces, brighter caps, more deliberate floor/wall contact shadows, moss, grime, and tiny rubble. Corridors gain continuous replacement-slab patches and directional wear. Fitted thresholds stay clean; the existing door silhouettes and torch sprites remain intact.

Room identity follows actual data: stair chambers, chamber-block suites, secret-door chambers, junctions, rare patterned chambers, damp chambers, and ordinary rooms. Perimeter trim respects irregular footprints and openings; center inlays require a clear room-owned 3×3 region. Stair surrounds require an open neighborhood. These are decorative finishes, not new gameplay room types, traps, locked doors, water, or disconnected secret rooms.

Warm multi-stop light falloff uses bounded local connected footprints and adjacent wall faces. A subtle blue-gray void wash improves contrast. No animation was added, keeping PNG output repeatable. Fog remains the final cover layer.

[Browser report](../../reports/verification/browser-after/report.json) confirms:

- All **six Classic pixel hashes match** the pre-art baseline: three fixed imported floors, grid on/off, same Chrome/Windows environment.
- Both styles render deterministically without changing floor JSON; both legacy schemas render after validated import.
- Imported floors support walking; initial discovery is nine tiles, four successful steps expand it to sixteen, and previous discovery remains present. Unexplored pixels retain the fog color.
- Every paving family, all seven room identities, and all five surface conditions are exercised over sixteen additional seeds, including a 96×96 map. Clean thresholds/dressed corners and one base family per room are checked.
- No runtime exceptions or visible Vite/type/lint checker errors; no document overflow at 1920×1080, 2560×1440, or 390×844. Root font sizes remain 17.68, 20, and 16 px respectively.

Inspect the [before](../../reports/verification/browser-before/stone-0.png), [after](../../reports/verification/browser-after/stone-0.png), [larger-room sample](../../reports/verification/browser-after/stone-detail.png), and [studio at 1440p](../../reports/verification/browser-after/studio-2560.png). Headless render timings are retained per case; these smoke measurements include cache and scheduling effects and are not a renderer benchmark. Added detail increases map-cache construction work; camera movement continues to reuse the cached map.

## Performance findings and follow-up

A separate 1,000-generation V8 CPU sample attributes approximately **24.1% sampled self-time to connection routing**, **23.5% to distance-map BFS**, and **5.8% to route-metric calculation**. [Profile summary](../../reports/verification/profile/summary.json) retains the methodology. Anonymous code and startup/GC also consume samples; percentages are not exact phase timings.

Next technical work should move generation/validation to a Web Worker for UI responsiveness, then measure opportunities to reuse distance maps and routing buffers. Keep the independent verifier as the acceptance gate. Avoid broad topology optimization until profiling shows it is needed.

Bounded retries do not prove every supported combination is feasible; impossible room sizes still return explicit exhaustion errors. Generation/import remain synchronous. Browser visual checks cover Chrome only; real Safari/Firefox and lower-powered devices remain useful follow-up targets. Lighting is a local flood approximation, not physical ray tracing.

Schema 2 retains optional extensions. Updated readers accept unchanged valid older floors, but older strict schema-2 consumers can reject the new retry fields and one-door layouts; consumers should update together. Imports that depended on secret-only mandatory access or unrecorded secret doors now fail explicitly. Future incompatible terrain/ownership changes should use a new schema and migration fixtures. Seeds require their generator version; exported geometry remains the preservation format.

See [audit and algorithms](technical-audit.md), [exact material rules](../generation-and-materials.md), and [commands/reproduction guide](README.md). Changes are separated into core safety fixes, verification tooling/fixtures/reports, Stone rendering, and documentation; no architectural rewrite or dependency was introduced.
