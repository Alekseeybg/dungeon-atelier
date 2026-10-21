# Three.js performance and architecture audit

This pass optimizes the existing playground without integrating Three.js into production. The Canvas renderer, generation data, material recipes, art, camera behavior and effect defaults are preserved. All 18 fixed-seed before/after PNGs match byte for byte.

## Measurement protocol

- Seed: `performance-audit-v1`; 32, 48 and 64 square maps; both themes; effects off, approved Baseline, and Combined preset.
- Fixed 960?640 viewport, elevation 63.75?, rotation 38.5?, zoom 1.22?, frozen flame time. Six warmup frames followed by 24 sampled frames per case.
- Browser backend: Microsoft Basic Render Driver through ANGLE/D3D11 in headless Chrome with GPU disabled. These are software-rendering comparisons, not laptop GPU FPS predictions. GPU timer queries were unavailable; no GPU frame-time or GPU-memory measurements are claimed.
- CPU submission is measured separately from frame cadence. Cadence includes browser scheduling and software rendering. Means and nearest-rank p95 use the raw bounded samples.
- The baseline added raw sample output to the pre-existing measurement method only; it preceded rendering optimizations. Baseline captures remain local under ignored `reports/`.
- Effects-off timings also improved between runs despite identical draw counts. Host/browser variability therefore contributes to the absolute timing improvement. Draw-call reduction and identical images are stronger evidence than attributing every FPS difference to optimization.

## Before/after results

| Size | Theme / mode              | Average frame ms | p95 frame ms  | Average FPS | Draw calls |
| ---- | ------------------------- | ---------------- | ------------- | ----------- | ---------- |
| 32   | ancient-ruins / off       | 68.5 ? 54.2      | 71.2 ? 58.4   | 14.6 ? 18.4 | 20 ? 20    |
| 32   | ancient-ruins / baseline  | 142.4 ? 87.3     | 147.0 ? 89.9  | 7.0 ? 11.5  | 63 ? 23    |
| 32   | ancient-ruins / combined  | 172.0 ? 100.0    | 177.9 ? 107.9 | 5.8 ? 10.0  | 251 ? 57   |
| 32   | restored-crypt / off      | 48.6 ? 38.3      | 50.3 ? 40.9   | 20.6 ? 26.1 | 20 ? 20    |
| 32   | restored-crypt / baseline | 74.3 ? 53.5      | 76.9 ? 57.6   | 13.5 ? 18.7 | 39 ? 20    |
| 32   | restored-crypt / combined | 145.3 ? 74.0     | 152.7 ? 75.7  | 6.9 ? 13.5  | 250 ? 57   |
| 48   | ancient-ruins / off       | 97.5 ? 75.1      | 100.0 ? 77.0  | 10.3 ? 13.3 | 20 ? 20    |
| 48   | ancient-ruins / baseline  | 188.0 ? 118.0    | 209.7 ? 130.1 | 5.3 ? 8.5   | 63 ? 23    |
| 48   | ancient-ruins / combined  | 280.0 ? 142.3    | 297.3 ? 155.0 | 3.6 ? 7.0   | 253 ? 57   |
| 48   | restored-crypt / off      | 66.6 ? 53.4      | 70.7 ? 60.2   | 15.0 ? 18.7 | 20 ? 20    |
| 48   | restored-crypt / baseline | 102.9 ? 75.4     | 104.9 ? 84.2  | 9.7 ? 13.3  | 39 ? 20    |
| 48   | restored-crypt / combined | 211.4 ? 97.9     | 214.5 ? 113.0 | 4.7 ? 10.2  | 253 ? 57   |
| 64   | ancient-ruins / off       | 109.6 ? 87.0     | 113.9 ? 92.9  | 9.1 ? 11.5  | 21 ? 21    |
| 64   | ancient-ruins / baseline  | 202.2 ? 123.5    | 207.3 ? 129.2 | 4.9 ? 8.1   | 66 ? 24    |
| 64   | ancient-ruins / combined  | 305.6 ? 136.7    | 312.9 ? 140.6 | 3.3 ? 7.3   | 257 ? 59   |
| 64   | restored-crypt / off      | 74.9 ? 61.5      | 77.4 ? 65.6   | 13.4 ? 16.3 | 21 ? 21    |
| 64   | restored-crypt / baseline | 115.7 ? 81.6     | 125.7 ? 83.8  | 8.6 ? 12.3  | 41 ? 21    |
| 64   | restored-crypt / combined | 259.4 ? 104.7    | 269.1 ? 116.5 | 3.9 ? 9.6   | 257 ? 59   |

The 64?64 Ancient Ruins Combined case submitted 11,597,895 triangles across all passes before and 1,491,657 afterward. These are renderer counters including repeated shadow/post-processing draws, not changes to the scene mesh. The scene retained 22 meshes, 2,617,440 position vertices, 15 distinct materials, and the same source images and geometry. Average CPU submission in that case fell from 2.64 to 1.58 ms.

## Measured bottlenecks and changes

1. **Static shadow work repeated with flame animation.** Directional and point-light shadow maps now update when caster geometry, theme visibility, relevant torch settings or nearest-light positions change. Camera orbit alone does not move the light rig. Shadow resolution, softness, bias, filtering, caster geometry and light budgets are unchanged. Bloom and AO helper passes temporarily suppress both automatic and pending shadow updates, then restore those flags.
2. **AO depth/normal, occlusion and denoising repeated for unchanged geometry/camera.** The existing denoised AO texture is reused for flame-only and light-only frames. The original copy and multiply blend materials still composite against each fresh beauty frame. Camera, zoom, resize, geometry, theme, AO radius and context restoration invalidate the field. Intensity/diagnostic changes reuse the same field with the requested output mode. No new render targets, lower resolutions, fewer samples or approximate replacement shaders are introduced.
3. **Unchanged architectural setters rebuilt the complete scene.** Reapplying default height/door/cutaway settings took 1,265 / 3,214 / 4,588 ms for 32 / 48 / 64 maps before. Those calls now preserve geometry identities and take approximately 0?0.1 ms in this run. Actual geometry changes still rebuild normally. Nearest-torch sorting is skipped when its target and relevant state are unchanged.
4. **Per-flame-frame diagnostics rebuilt UI state.** Mesh counts and the existing source-image estimate are cached until geometry changes. Secondary Vue diagnostic notifications are limited to roughly four per second; camera and explicit setting changes publish immediately. Flame animation and visual updates keep their existing cadence.
5. **Initialization could populate a cache before applying the theme.** The full comparison matrix exposed this during development. The constructor now synchronizes geometry visibility, palette and lighting before its first frame. All final captures match their original baselines.

Theme switching was already inexpensive: the median setter time was about 0.1 ms at every size before and after. Full viewport construction remains roughly 1.9?2.9 seconds in this software run (including generating both material sets and architecture); this pass does not claim to eliminate genuine regeneration cost. Dungeon generation itself took approximately 4?11 ms in the after run.

## Memory and lifecycle findings

- Five construction/render/disposal cycles leave zero active viewports and zero canvases in the viewport host after each teardown. Event-listener counts stayed at 452 in the surrounding test page.
- After explicit GC checkpoints, JS heap was 27.4 ? 28.0 MiB before and 27.3 ? 27.8 MiB afterward over five cycles. These figures exclude native canvas storage, driver allocations and GPU memory. They do not establish behavior over hours of continuous use.
- The browser DOM node counter rose by two per cycle in both versions (1,145 ? 1,153). No matching listener growth or runaway JS heap growth appeared. This small retained-node trend remains a profiling risk; its origin is not proven by these measurements.
- A 30-second static idle produces zero renderer passes. A further 30 seconds with flame animation keeps texture/geometry counts unchanged; the live JS heap after GC stays approximately 29.4?29.5 MiB in the context-restoration test.
- GTAOPass in the installed Three.js version leaves its GTAO and blend materials out of its dispose method. The controller now disposes those explicitly along with its cache fullscreen helper, while retaining existing disposal for targets, maps, shadow maps, generated materials and geometry.
- Context loss pauses rendering and discards stale GPU timer queries. Restoration reactivates timing support where available and invalidates shadow/AO caches. Pixel output after forced context restoration matches the prior image. Disposal while the context is lost also passes.
- Existing controls, observers, listeners, animation loops and context resources are torn down through the existing viewport disposal path. The isolated verifier closes its one browser and removes its workspace-local profile; the profile list does not grow.

Live resident texture counts in an Ancient-only 64?64 case fall from 93 to 74 because initialization no longer uploads the wrong theme for an early frame. Materials/source maps are unchanged and the other theme still uploads when used. The UI source-texture estimate remains 225.0 MiB for this case; it is an RGBA/mipmap estimate, **not measured GPU memory**. No texture resolution, filtering or artwork was reduced.

## Architecture decisions and remaining risks

- Static geometry was already merged per material. The representative scene has only 15 materials; replacing it with instancing or a broad scene refactor offered no demonstrated benefit worth risking the approved geometry and picking behavior.
- Both palettes remain independent through the existing material binding. Adding a global texture/material cache could retain hundreds of megabytes across regenerations; this pass deliberately avoids introducing that retention without a bounded cache policy and stronger measurements.
- AO must recompute while the camera moves. Large-map camera motion and actual architecture rebuilds remain more expensive than stationary flame animation. The stationary benchmark gain is not a claim of equal improvement during continuous orbit/pan.
- Bloom still renders an occluded emissive source plus its blur chain each animated frame. That is now a larger share of remaining work; caching its depth would require additional compositing validation and was left unchanged.
- The current animation-loop dirty guard already avoids GPU rendering when idle. Replacing it with a new scheduling abstraction was not justified by the observed static rendering count.
- Use viewport setters for scene/camera/light changes so caches are invalidated. Future animated casters, moving architectural geometry or new occluders must invalidate the relevant caches; the current flame cards do not write depth or cast shadows.
- Browser-native memory and hardware GPU profiling remain necessary before production integration. No production renderer migration or new dependencies are part of this pass.

## Files changed

- [viewport.ts](../apps/dungeon-atelier/src/experiments/dungeon-3d/viewport.ts): invalidation, initialization, static shadows, diagnostic publication, timing samples and context lifecycle.
- [contact-lighting.ts](../apps/dungeon-atelier/src/experiments/dungeon-3d/contact-lighting.ts): cache the existing AO field, reuse its original blend, and finish material disposal.
- [selective-bloom.ts](../apps/dungeon-atelier/src/experiments/dungeon-3d/selective-bloom.ts): preserve pending shadow invalidation through the emissive source pass.
- [scene.ts](../apps/dungeon-atelier/src/experiments/dungeon-3d/scene.ts): unchanged-setting guards and unchanged-target light selection.
- [effects-timing.ts](../apps/dungeon-atelier/src/experiments/dungeon-3d/effects-timing.ts): reset lost-context query state.
- [benchmark-dungeon-3d.mjs](../scripts/benchmark-dungeon-3d.mjs): reproducible size/theme/effect matrix and lifecycle/resource checks.
- [verify-render-cache.mjs](../scripts/verify-render-cache.mjs): cached versus forced-fresh pixel comparisons across 22 states, context loss/restore, resize and optional extended idle.
- [effects-timing.test.mjs](../tests/effects-timing.test.mjs): lost-context and unsupported-timer regression tests.
- This report. Generated measurements and screenshots remain ignored local files.

## Reproducing the audit

With one normal development server running:

```sh
node scripts/benchmark-dungeon-3d.mjs --before
# Make the optimization under test, retaining the local baseline captures.
node scripts/benchmark-dungeon-3d.mjs
node scripts/verify-render-cache.mjs --extended-idle
```

Use `ATELIER_URL` if the server uses a different port. Capture before on the baseline implementation; regenerating it after changes cannot prove preservation. The harness compares the exact saved PNG bytes. The old baseline report field named `shadowUpdates` counted eligible function entries including empty fullscreen-pass light lists; it is not a reliable count of actual shadow-map renders. The corrected after report uses `eligibleShadowPasses`; conclusions above rely on draw/triangle counters and pixel checks, not comparing those two differently scoped fields.

[Local comparison gallery](../reports/dungeon-3d-performance/index.html) ? [Full before measurements](../reports/dungeon-3d-performance/before.json) ? [Full after measurements](../reports/dungeon-3d-performance/after.json) ? [Cache/idle regression results](../reports/dungeon-3d-performance/cache-regressions.json)

## Final validation

Passed: 170 automated tests, both workspace typechecks, repository formatting and ESLint, and the production build. Browser validation covered 22 cache/invalidation states, all 18 byte-identical before/after screenshot pairs, context restoration, and static/animated idle checks. See the measurement limitations above.
