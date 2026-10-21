# Ancient dungeon: isolated true 3D prototype

Open `/#/dev/dungeon-3d` on the running Quasar development server. This route is excluded from the production build. The Canvas editor, generation algorithms, floor serialization and saved appearance settings remain authoritative. Three.js 0.186.1 is the only added runtime dependency; its TypeScript declarations are a development dependency.

The [visual polish and mouse-control milestone](dungeon-3d-polish.md) documents the subsequent wall atlas, coping, lighting and gesture improvements, with before/after evidence.

The later [selected-mockup refinement](dungeon-3d-refinement.md) documents the current inward cap chamfer, seeded weathering/chips, amber lighting and door-cap join repair.

The experiment builds actual meshes from existing `DungeonFloor` data. It is an evaluation view, not an alternative production appearance. The generated scene starts with seed `side-door-readability-0` at 32×32; a 64×64 option exercises larger chambers and full-map costs. The separately labeled fixed four-door diagnostic uses the existing finishing fixture and contains all cardinal door orientations and both staircases.

## Inspection and asset reuse

The logical grid uses square 32-unit cells with X right and Y down. The approved Canvas presentation compresses ground Y to 26 units and projects height independently. Its wall masks form a 20-unit central masonry footprint with connected six-unit arms. The 3D adapter keeps those footprints and maps logical X/Y to world X/Z; one logical tile is one world unit, and world Y is height. The Canvas projection is not used to produce the 3D geometry.

| Source                                 | Classification               | Experimental use and limitations                                                                                                                                                                          |
| -------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broad natural slabs                    | Reusable after remapping     | Sample the approved floor pattern into a texture, maintaining its mirrored 24-tile world period and exposure. Continuous world UVs avoid per-cell texture restarts.                                       |
| Weathered flagstones                   | Reusable after remapping     | Same mapping, assigned to corridors with the existing appearance rules.                                                                                                                                   |
| Irregular and rare regional floors     | Reusable after remapping     | Use `ancientFloorAssignments` unchanged. Entire room footprints share a material; no per-tile material lottery.                                                                                           |
| Ruins masonry elevation                | Reusable after preprocessing | Crop stone interiors into an atlas for individual raised blocks. Geometry defines course joints; painted joints no longer cross the blocks. The Canvas plane darkening is omitted. See the polish report. |
| Ruins coping texture                   | Reusable after remapping     | Map onto solid, modestly beveled coping footprints and stair stonework. Authored wear remains; the geometry supplies actual silhouettes and height.                                                       |
| Complete painted door frame and sill   | Visual reference             | Their painted recesses/bevels are not used as complete 3D objects. Replace with real jambs, lintels and individual threshold stones.                                                                      |
| Wooden leaf                            | Reusable after preprocessing | Crop a timber-only area between painted iron bands. Apply its grain to six thick planks and separate timber braces. Hinges, bands, rivets and rings are meshes.                                           |
| Painted stair shading                  | Visual reference             | Replace with real treads, risers, an upper landing and a recessed lower flight. Retain the adjacent brass level-sign design.                                                                              |
| Complete torch sprites                 | Visual reference             | Their baked view is unsuitable for arbitrary camera angles. Replace with a bracket, basket, bars and a small emissive flame volume.                                                                       |
| Production Canvas contact/light layers | Visual reference             | Use real directional shadows, restrained hemisphere/fill light, and geometry-derived contact gradients. Local torch lights are bounded.                                                                   |

Original assets are never overwritten. Derived texture canvases exist only in memory and are owned by the experimental viewport. Luminance-derived bump and roughness maps follow the artwork's joints and wear at low amplitude. They are approximations, not artist-authored PBR height maps; baked color and lighting in the source images cannot be completely removed by this adaptation.

## Geometry and interaction

- Floors merge by material and use world-space UVs. Downward staircase cells contain four border strips around a real hole; no solid plane lies behind the flight.
- Walls retain the existing connected footprints. Static geometry merges by material, including shallow masonry relief, rather than creating an object per stone. Coping traces each footprint's union and has a real sharp bevel. Tile-sized coping pieces meet over continuous wall cores; stone joints remain visible.
- One doorway module rotates around world Y for all four logical facings. It contains actual void space, stone jambs/lintel, segmented threshold, thick plank leaves, timber braces, hinge barrels, iron bands, rivets and rings. Opening the leaf rotates it around its hinge.
- Hidden secrets and their approach routes pass through the existing concealment adapter before geometry, floor materials or torch placement. Explicit preview reveal shows stone panels. No discovery or migration is written to saved dungeon data.
- Stair metadata specifies up/down, not a travel-facing axis. Flights follow the same north-rising/south-entry convention as the existing renderer, preserving their original cells. Up/down signs remain separate from the treads. There is no inter-floor traversal.
- Physical wall height starts at two world units, with 1.00×, 1.25×, 1.50× and 1.75× choices. Height changes rebuild architecture, doors and sconces while retaining floor geometry and materials.
- The orthographic camera starts 68° above the horizontal plane. Elevation spans 35–90°. Horizontal rotation covers a full turn around a 12° reference azimuth. This is real camera movement, not an image warp.
- Left drag pans, middle drag changes elevation (down raises the view), right drag rotates horizontally, and the wheel zooms. Sliders synchronize with mouse navigation. Fit and reset restore predictable framing; inspection choices focus existing rooms, doors and stairs.

## Lighting and visibility findings

The scene uses hemisphere lighting, a warm directional key with one 2048² soft shadow map, a restrained cool fill, and up to eight warm local torch lights. Additional torches retain their physical hardware and emissive flame. Local torch lights do not cast additional point-light shadow maps, so their light can bleed across nearby ordinary walls. Placement still uses the concealed floor, preventing hidden-route torch clues.

True 3D does **not** automatically make deeply recessed side doors readable from a steep overhead camera. Lintels and thick wall caps can physically obscure the leaf. Intact door screenshots deliberately preserve that limitation. Rotation helps, but at the highest elevations the leaf remains narrow. The optional **Door-head cutaway**, off by default, removes only the overhead lintel/cap of regular portals; it leaves jambs, thresholds and doors intact. Concealed secret masonry is never removed by this option. The side-door cutaway capture shows the resulting inspection view.

The floors preserve the approved imagery, material regions and scale, but real lighting and the physical camera produce different tones and framing. This is a faithful material/architecture experiment, not a pixel-identical recreation of the artistic Canvas projection. Tall walls can obscure narrow approaches; the prototype does not implement a general automatic wall-transparency system. Flames are static, and advanced particles, bloom, water, lava, bridges and other environments are outside this milestone.

## Evidence, diagnostics and verification

Run `npm run verify:3d` with the development server running. It defaults to `http://localhost:9001`; set `ATELIER_URL` when using a different port. It uses the existing headless Chrome/CDP helper and does not open visible tabs or launch another server.

The [capture gallery](../reports/dungeon-3d/index.html) contains same-generated-layout Canvas/default/rotated/lower/taller views, four-door and stair contact sheets from the labeled diagnostic fixture, a side-door cutaway comparison, and a 64×64 map/larger chamber. The [machine-readable report](../reports/dungeon-3d/report.json) records actual observed draw calls, rendered triangles, meshes, textures, geometries, renderer backend and CPU render-submission samples.

Triangle and draw-call statistics come from Three.js and include shadow work. Texture byte figures estimate uncompressed RGBA pixels plus mipmaps and exclude driver overhead and shadow targets; actual GPU byte usage is unavailable. CPU submission time is neither GPU frame time nor a hardware-independent FPS claim. Geometry is merged per material; further optimization should follow measurement, especially on large maps and software WebGL backends.

Initial milestone measurements, before the subsequent visual polish, observed on 2026-10-21 using Chrome's ANGLE / Microsoft Basic Render Driver backend (the linked machine-readable report is refreshed by later verification runs):

| Generated map | Draw calls | Rendered triangles, including shadows | Meshes | Resident textures | Estimated material textures |
| ------------- | ---------: | ------------------------------------: | -----: | ----------------: | --------------------------: |
| 32×32         |         24 |                               262,280 |     12 |                25 |                    59.5 MiB |
| 64×64         |         26 |                             1,565,852 |     13 |                28 |                    75.5 MiB |

Four camera-change samples had a median CPU submission time of 1.0 ms. This software-renderer measurement does not establish GPU throughput or sustained FPS. The larger scene's triangle count is a clear target for later relief/hidden-face optimization if the experiment continues.

The verifier checks generator parity at 32/64, all material families, camera sliders/wheel/pan/reset, physical height changes without floor reconstruction, bounded geometry counts across rebuilds, clear open portals through ray intersections, positive-height steps and negative-height descending flights, unchanged production pixels/settings, and zero active experimental viewports after leaving. Independent unit tests cover adapter determinism, room material coherence, world coordinates, cardinal door rotations and hidden-secret equivalence to an independently sealed floor.

Resources are owned by the viewport: merged geometry, sampled material maps, lights, shadow targets, controls, resize observer, animation callback and WebGL context are disposed on navigation. Rendering runs only when the camera, geometry, viewport size or controls change.

Completed validation:

| Check                | Result                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`           | 139 tests passed, including the existing generator/rendering suite and three new isolated 3D tests                                                                |
| `npm run typecheck`  | Core and app passed                                                                                                                                               |
| `npm run lint:check` | Repository formatting and app ESLint passed                                                                                                                       |
| `npm run build`      | Passed; experimental route and Three.js viewport absent from production output                                                                                    |
| `npm run verify:3d`  | Passed: 32/64 layouts, real portals, real stair openings, camera controls, lighting, resource bounds, generated secrets, production parity and navigation cleanup |

The browser run reported no uncaught exceptions or console errors. Door-head cutaway is an inspection aid, not a claim that intact side-facing leaves are always readable at normal overhead zoom. Screenshots and this limitation should guide the decision about further 3D development.

## Changed-file inventory

| Experimental file                                    | Responsibility                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/experiments/dungeon-3d/plan.ts`                 | Read-only logical adapter, seed presets, deterministic appearance variation  |
| `src/experiments/dungeon-3d/materials.ts`            | Existing-art sampling, PBR approximations and texture ownership              |
| `src/experiments/dungeon-3d/geometry.ts`             | Material batches, UV mapping, coping unions and geometry disposal            |
| `src/experiments/dungeon-3d/scene.ts`                | Floors, masonry, real portals, stairs and sconces                            |
| `src/experiments/dungeon-3d/viewport.ts`             | Three.js context, restricted orthographic controls, lighting and diagnostics |
| `src/pages/Dungeon3DPrototypePage.vue`               | Local prototype controls, comparison and PNG capture                         |
| `src/router/routes.ts`                               | Development-only lazy route                                                  |
| App `package.json`, root `package-lock.json`         | Three.js runtime and declaration dependencies                                |
| Root `package.json`, `scripts/verify-dungeon-3d.mjs` | Reproducible browser validation and capture command                          |
| `tests/dungeon-3d-plan.test.mjs`                     | New isolated adapter/orientation/concealment tests                           |
| `reports/dungeon-3d/`, this document and README      | Evidence, asset assessment and usage                                         |

The experiment can be removed by deleting its folder/page/route/dependencies and dedicated verification artifacts. It adds no production renderer switch, saved appearance fields or dungeon-schema changes.
