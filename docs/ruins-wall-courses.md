# Ancient Ruins: bonded wall faces and contact lighting

This milestone replaces Ancient Ruins wall-face layout and improves its contact lighting. Approved caps (geometry, material maps and placement rules), floors, door leaves, torches and stair geometry are preserved. Stair and doorway stone finishes now share the wall quarry, as requested. Restored Crypt remains pixel-identical to its original five reference views. Production Canvas rendering and generation are unchanged.

## Wall construction

- Level courses retain shared heights around the dungeon. Each course uses weighted stock lengths of approximately 0.52, 0.76, 1.04, 1.36 and 1.68 tiles, plus fitted closure stones.
- Placement scores prefer lapped joints over the course below, discourage consecutive equal lengths and avoid tiny cut-off end stones. A smooth seven-tile region field biases the mix of stone sizes.
- Real stone faces sit 0.019–0.052 tiles above the mortar bed, with most close to a common plane. Occasional quieter recessed or protruding stones create restrained relief. Joints are approximately 0.018–0.024 tiles wide; chamfers use a fixed 0.014-tile edge width rather than scaling with block length.
- Wall runs share quarry families and broad weathering zones. Quiet and medium stones dominate; severe defects retain exclusion distances and rare hero eligibility. Immediate texture repeats are discouraged without forcing an alternating sequence.
- Individual stone-interior samples exclude photographed mortar lines. Mineral grain uses a consistent physical scale and seeded crop offsets, avoiding stretched stripes on long blocks.
- Both themes’ wall buffers are prepared together. Switching toggles the appropriate faces without regenerating the floor or allocating new geometry. Picking excludes inactive wall faces. Cosmetic relief does not alter the camera fit or established light-rig position.

## Matching stairs and door frames

Stair foundations, treads, retaining cheeks, door jambs, heads and thresholds now sample the same Ancient Ruins stone pools as the walls. Bearing stones use quiet/medium wear, shared regional values and physically scaled grain without photographed mortar inside a stone. Tread tops receive a restrained value lift; slab edges retain a darker tone for readability. Thin frames blend into the masonry without introducing a separate yellow/pale border. Staircase ascent, openings, endpoints, geometry and original UVs remain unchanged. Restored Crypt ignores the Ancient-only sampling attributes and keeps its original materials.

| Stone dressing | Before                                                                  | Matched finish                                               |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Stairs up      | [Before](../reports/ruins-wall-courses/before-dressing-stairs-up.png)   | [After](../reports/ruins-wall-courses/after-stairs-up.png)   |
| Stairs down    | [Before](../reports/ruins-wall-courses/before-dressing-stairs-down.png) | [After](../reports/ruins-wall-courses/after-stairs-down.png) |
| Door frames    | [Before](../reports/ruins-wall-courses/before-dressing-door.png)        | [After](../reports/ruins-wall-courses/after-door.png)        |

## AO and light response

Ancient Ruins uses Three.js GTAO from actual scene depth and normals, with a world-space radius of 0.65 tiles and a blend of 0.8, with a 1.2 response exponent. The original 0.26-radius/0.34-blend preset was too faint at gameplay zoom. The depth rejection limit is now 0.9 tiles, so nearby contact geometry contributes instead of being discarded; 16 samples and a distance exponent of 2 retain near-joint sampling while reaching room corners. Exposure, base lights and all surfaces remain unchanged in this follow-up. [Matched before/after captures](../reports/ao-response/) record the adjustment. Edge-aware Poisson denoising softens sampling without adding broad dark borders. It responds to wall/floor contact, corners, cap shoulders, stone seams, frames, stair edges and sconce attachments. It is independent of the Shadows toggle.

The playground’s **Contact AO** toggle permits direct comparison. Restored Crypt uses its original render path. Wireframe bypasses AO. Transparent flame cards are excluded from occlusion, so their rectangular planes cannot cast false AO. The unlit background keeps its original color. HDR output applies exposure/color conversion once; there is no bloom or exposure reduction.

Ancient Ruins torch lights retain inverse-square decay and intensity, with softer amber `#ffb064` and an extended 7.5-tile falloff range instead of 6. This avoids a concentrated orange patch while revealing the new bevels. Torch models and animation are unchanged.

Screen-space AO only considers visible geometry. It adds a depth/normal pass and full-screen processing; the toggle allows comparison or bypass. Render targets, noise textures and passes are disposed with the viewport. CPU submission timings are not measurements of GPU frame time.

## Screenshots

All comparisons use `side-door-readability-0`, the same dungeon and matched camera/zoom. AO-off views use the final wall geometry and torch settings, isolating the occlusion change. Original before images show the pre-milestone walls; `before-full.png` preserves the previous theme-verifier full view.

| View                  | Before / AO off                                                | After / AO on                                                |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Wall design           | [Before](../reports/ruins-wall-courses/before-walls.png)       | [After](../reports/ruins-wall-courses/after-walls.png)       |
| Wall contact lighting | [AO off](../reports/ruins-wall-courses/walls-ao-off.png)       | [AO on](../reports/ruins-wall-courses/after-walls.png)       |
| Door and torch        | [AO off](../reports/ruins-wall-courses/door-ao-off.png)        | [AO on](../reports/ruins-wall-courses/after-door.png)        |
| Stairs up             | [AO off](../reports/ruins-wall-courses/stairs-up-ao-off.png)   | [AO on](../reports/ruins-wall-courses/after-stairs-up.png)   |
| Stairs down           | [AO off](../reports/ruins-wall-courses/stairs-down-ao-off.png) | [AO on](../reports/ruins-wall-courses/after-stairs-down.png) |
| Full area             | [Before](../reports/ruins-wall-courses/before-area.png)        | [After](../reports/ruins-wall-courses/after-area.png)        |
| Full dungeon          | [Before](../reports/ruins-wall-courses/before-full.png)        | [After](../reports/ruins-wall-courses/after-full.png)        |

## Validation

- 165 Node tests: deterministic mixed bonds, full run coverage, no closure slivers, joint lapping, bounded relief, physical grain scale, original cap rules, and the existing generation/rendering suite.
- Application typecheck and ESLint; production build.
- `node scripts/verify-ruins-wall-courses.mjs`: original dungeon/stair metadata, complete cap geometry/material fingerprints, and all legacy stone-map fingerprints preserved; shader/console errors checked; matching screenshots captured.
- `node scripts/verify-dungeon-3d-themes.mjs`: exact Restored Crypt PNG comparisons, unchanged geometry objects/camera during switching, bounded repeated switching resources and deterministic surface maps.
- Existing 3D browser regression: generated 32/64 maps, four portal orientations, stairs, camera controls, bounded height rebuild resources, secret concealment, Canvas pixel parity and viewport cleanup.

The stone dressing uses Ancient-only material sampling attributes; original stone geometry/UV/color fingerprints and cap maps remain intact.
