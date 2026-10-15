# Verification guide

Run commands from the repository root after installing dependencies (`npm ci`). Node 22.12+, 24, or 26+ is supported. No test dependency or backend is required.

```sh
npm test
npm run verify:regressions
npm run verify:stress -- --count 10000 --workers 4
npm run lint:check
npm run typecheck
npm run build
```

`npm test` builds the core and runs unit, integration, import-mutation, and regression cases. `verify:regressions` runs only retained problem configurations. Stress generation does not replace the unit suite.

## Batch campaign

```sh
npm run verify:stress -- --count 10000 --workers 4 --output reports/verification/my-run
```

The stable matrix balances Classic Rooms and Compact Labyrinth over 16/24/32/48/64/96 squares plus 48×32 and 64×48. It varies density, room bounds, allowed families, shapes, loops, blocks, and secret shortcuts. Case indices map to unique seeds and full configurations in `tests/helpers/cases.mjs`.

Each case generates twice and compares the entire result. An independent flood fill, room-ownership map, and doorway checker verify every required room and stair, all walkable islands, boundaries, footprint connectivity, isolated secret interiors, sealed-secret public access, actual shortcut distances, and chamber entries. Every result is exported/imported, structurally compared, and checked again. Production schema validation is an additional check, not the sole oracle.

The runner writes `report.json`, a timestamped report copy, `report.md`, and a timestamped full-config JSON for **every** failed case. Worker termination turns every unreturned assigned case into an explicit infrastructure failure with its config. Failures cause a nonzero exit; cases are never replaced or skipped. Successful bounded retries remain visible in the attempt histogram and floor diagnostics.

Timings cover the first production generation, including its runtime validation and any retries. Determinism checks, independent verification, and serialization are outside that measurement but included in campaign wall time. Multiple workers compete for CPU; results are machine-specific and are not a browser latency promise.

## Reproduce and retain a failure

```sh
npm run verify:replay -- --index 4
npm run verify:replay -- reports/verification/baseline-smoke/failures/case-4.json
npm run verify:replay -- path/to/captured-failure.json --promote
```

Promotion adds the full configuration and original reason to `tests/fixtures/regressions.json`, even when replay still fails. Commit this fixture after fixing the defect. All 28 failures from the initial campaign are already retained, alongside a separate test for the user's reported secret-passage seed.

## Browser verification

Start `npm run dev` in another terminal, then:

```sh
npm run verify:browser
npm run verify:browser -- --url http://localhost:9000 --output reports/verification/browser-local
npm run verify:browser -- --compare reports/verification/browser-before/report.json
```

This utility launches an isolated headless Chrome profile without a visible window. The Windows default is `C:/Program Files/Google/Chrome/Application/chrome.exe`; elsewhere it uses `google-chrome`. Override with `CHROME_PATH`. Chrome's temporary profile stays in the OS temp directory so shutdown cannot race profile cleanup.

The dev server is required: the checker imports renderer/store source modules and inspects Vue component state. It renders imported fixtures in both modes and grid settings, compares repeated pixel hashes, checks non-mutation and protected material rules, imports legacy schemas, exercises walk controls and persistent 3×3 discovery, tests fog coverage, rejects runtime/checker overlays, and captures 1920×1080, 2560×1440, and 390×844 layouts with overflow checks. PNGs and a JSON report go to the selected output directory.

`--compare` additionally compares Classic hashes with a baseline. Use the same Chrome/OS/font environment and identical fixture configs: Canvas antialiasing and fonts can differ across platforms. The committed before/after reports document this campaign; they are not universal cross-platform golden images. Pixel determinism does not establish visual quality, so inspect the PNGs as well.

## CPU profiling

```sh
npm run build:core
node --cpu-prof --cpu-prof-dir=reports/verification/profile scripts/profile-generation.mjs
```

This samples 1,000 sequential production generations. Open the resulting `.cpuprofile` in browser developer tools. Retained `profile/summary.json` gives sampled self-time hotspots from this audit. Sampling includes startup/GC and is not exact phase timing. Avoid optimizing from one outlier; investigate the full-config slow cases in the stress report first.

See [audit](technical-audit.md), [results](results.md), and [material rules](../generation-and-materials.md).
