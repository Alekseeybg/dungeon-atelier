# Technical audit: generator 3.0.0 → 3.1.0

The audit starts from commit `73d86fb`. The existing architecture is retained.

## Architecture and algorithms

| Area          | Current implementation                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core          | Framework-independent TypeScript package: typed model, bounded generator, Ajv schema validation, JSON serialization, seeded utilities                                                 |
| Editor        | Vue 3 / Quasar / Pinia; temporary camera, selection, and exploration state stay outside exported floors                                                                               |
| Rooms         | Bounded rejection sampling of spaced bounding rectangles, then connected explicit floor footprints for L/T/cross/alcoved/U/chamfered rooms                                            |
| Templates     | One optional paired chamber block; four or six independently owned rooms, predefined ordinary doors, shared corridor coordinates and reserved masonry                                 |
| Corridors     | Multi-source breadth-first routing between safe room-wall portals, outside protected footprints; ordinary routes can reuse corridors                                                  |
| Connectivity  | Connected-component growth using distance-ranked room pairs; reachability refreshed after carving, including preconnected template members                                            |
| Extra routes  | Detour-ranked regional loops save at least four steps; short major links are reserved for the separate rare-shortcut pass                                                             |
| Secret routes | At most one separately rolled, fresh, wall-buffered path, ≤12 corridor cells; saves ≥12 steps and ≥35%; new records declare isolation                                                 |
| Side branches | Separately seeded bounded 2–4-cell dead ends, carved before secret routes                                                                                                             |
| Stairs        | Two sweeps choose distant room representatives; this is a heuristic, not a global graph-diameter guarantee                                                                            |
| Traps / water | Not implemented as terrain or gameplay. Visual dampness has no collision or movement effect                                                                                           |
| Randomness    | FNV-1a seed hashing and Mulberry32; separate streams for blocks, side passages, shortcuts; renderer uses independent hashes                                                           |
| JSON          | Schema 2 plus a frozen version-1 importer; generator version identifies seed-reproduction rules. Geometry is authoritative on import                                                  |
| Rendering     | Cached procedural Canvas sprites, geometry-based material planning, structure/doors/stairs, lighting, markers, then viewport fog/overlays. Classic has its own unchanged drawing path |

## Findings and implemented corrections

The initial 1,000-case matrix found 28 failures: 22 exhausted small-map placements, five blocked dense layouts, and one legitimate single shared doorway rejected by schema minima. Exact configurations and original reasons are preserved in `tests/fixtures/regressions.json` and `reports/verification/baseline-smoke/failures`.

Generator 3.1.0 permits eight bounded deterministic placement/routing attempts. Attempt zero preserves the old layout stream; subsequent attempts use `<seed>:layout-retry:<attempt>` for room/block placement only. Public seed/config remain unchanged. Success records `generationAttempts` and every preceding `retryReasons` entry; exhaustion returns all attempt reasons. Only placement/routing failures retry. Schema failures and invariant failures are never retried or hidden.

Schema 2 now permits one door, including its diagnostic count; schema 1 remains unchanged. A two-room shared-wall layout legitimately needs one door. This is a backward-compatible widening for readers of schema 2; older readers that enforce the previous minimum must update. The new optional retry fields also require updated strict schema-2 consumers; compatibility is old-data-to-new-reader, not guaranteed new-data-to-old-reader.

An additional adversarial audit found that an imported ordinary door could be retagged as secret while existing geometry diagnostics stayed unchanged. Runtime validation now independently closes **all** secret doors and requires every room floor and both stairs to remain reachable. Every secret door must belong to a recorded shortcut. Previously accepted unsafe legacy data can therefore be rejected with explicit errors; valid legacy fixtures retain their fields and geometry.

## Verification strategy

Node's built-in test runner needs no new dependency. Unit/integration tests cover configuration bounds, shapes, templates, mutations, serialization, schemas, retry exhaustion, long/Unicode seeds, and retained regressions. The stress checker implements its own flood fill and ownership map instead of trusting production connectivity metrics. It regenerates each case, checks every walkable tile and every required room cell, closes hidden doors, validates corridors/entries, round-trips JSON, and checks the restored geometry again.

The matrix balances both presets across 16/24/32/48/64/96 squares and rectangular maps, varied density, room dimensions, allowed designs, shape probability, loop probability, block probability, and shortcut probability. Impossible user configurations remain explicit failures; the suite does not count rejected cases as successes.

## Performance and remaining risks

Generation and import are synchronous. The largest bounded floors can pause the UI on slower devices. Repeated breadth-first distance maps, candidate routing, and full-floor validation dominate algorithmic work; the retained CPU profile summary distinguishes measured hotspots from this complexity analysis. No performance threshold is asserted across machines.

Placement retries reduce observed failures but cannot prove all admissible configurations have a routable layout. Exhaustion remains a supported error. Layout attempts can produce fewer rooms than requested, with a warning. A 10,000-case campaign is evidence rather than an exhaustive proof.

Schema 2 has accumulated optional extensions. Future incompatible terrain, feature semantics, or ownership changes should use a new schema version and migration tests. Generator changes require a version change; JSON preserves old layouts, while seeds alone require their original algorithm version.

Historic schema-2 shortcut records without an isolation declaration retain older validation semantics for their interior. Mandatory-route safety is always enforced. No optional disconnected content is generated or silently exempted from whole-map reachability.

## Completed work and evidence

The final post-art campaign passed 10,000/10,000 cases, with 70 unit/integration/regression tests. All six Classic pixel comparisons matched their pre-art baselines. Stone materials and atmospheric overlays remain isolated from core geometry and serialized data. See [measured results, regressions, visual evidence, and recommendations](results.md) and [verification commands](README.md).
