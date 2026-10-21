# Selected-mockup refinement

The current experiment remains at `/#/dev/dungeon-3d`. This milestone refines the cap profile, materials and local lighting. It preserves camera defaults/interaction, wall height, generation, floor textures and assignments, door/stair placement and secret concealment. It does not change the production Canvas renderer or saved appearances.

## Profile and doorway repair

The former symmetric extrusion and projecting fascia are replaced by an inward-cut profile. Relative to the wall top, its vertical shoulder spans 0–0.015 world units, its chamfer rises to 0.085 over an inward width of 0.085, and its crown is flat. The facet is about 39.5° above horizontal. Separate geometric normals produce the top → facet → face transition; it is not a painted bevel or an overhang.

Exposed edges receive the chamfer. Connected cap units receive fine recessed top joints, 0.006 units wide across both pieces, with matching shoulders. Door heads use the same profile and elevation. Corner mitres follow the connected footprint.

The reported doorway strip came from wall caps treating the adjacent door head as an exposed end, plus a lower cap band overlapping the coplanar wall/lintel face. Coverage now includes the door head in each orientation; cap bands start at the wall top instead of below it. Lintel/jamb/cap material coordinates use the same scale. Cutaway still removes regular heads and retains secret masonry.

## Weathering and controlled variation

Cap surfaces reuse interior crops of the existing Ancient coping image, retaining stone grain without large painted mortar stripes competing with the profile. Seeded brown stains, muted moss around crevices, and irregular branching cracks add wear. Dirt contrast and fracture width were increased after the first pass showed mainly moss. The cracks taper, and the moss coverage is reduced so green staining does not dominate.

Eight cached geometric wear variants add occasional inward chips, approximately 0.018–0.036 units deep, to exposed shoulders/facets. They preserve the main flat crown and never extend outside the original footprint or cut holes into the wall below. Cap tint, chip choice, dirt, moss and fractures depend on the floor seed. Original assets remain unchanged; all derived maps are viewport-owned canvases/textures.

The initial repeating world-space dirt wash was replaced after review showed brown bands. Cap units now select from sixteen finish patches with eight rotated/mirrored UV orientations. About 55% use neutral worn stone, 22% localized neutral soil, 12% moss and 11% fractured finishes. Selection is seeded per stone; the same three-tile weathering phase no longer repeats along every wall. Grain choices vary independently across the atlas rows. These are bounded reusable variants, not a unique authored texture for every stone. UV padding keeps neighboring atlas patches out of each stone's mipmapped edges. Jambs and stair trim use a separate neutral stone material so the cap atlas does not form a checker pattern on those surfaces.

The final requested darkening lowers only the cap stone's underlying sRGB value target from 154 to 140 before weathering is blended. Dirt, moss and fracture masks, colors and strengths remain unchanged. Jamb/stair trim retains its previous base value of 154.

Wall faces retain real block courses and the existing stone-interior atlas. Crop values are balanced without making them identical; local contrast and bump are restrained. The coordinate hash now has an avalanche step to break neighboring atlas correlations. Independent salted choices select atlas cell, local tint and relief over a smooth six-tile regional tint field. The generator random stream is never consumed. Room-level floor variation is preserved.

## Torch balance

Local intensity changes from 8.5 to 5.2 candela, color from `#ffc58a` to amber `#ff9d42`, and cutoff from 5.5 to 6 units. Inverse-square decay remains 2. Neutral base lighting, exposure, directional shadows and the existing eight-light inspection pool are retained. No bloom or additional shadow maps are introduced.

The identical-camera room comparison changes roughly 267,000 pixels by more than three RGB levels. Its mean absolute RGB difference between torch ON and OFF is about 2.85 levels, compared with 5.13 before this milestone: a lower but still visible effect. These are image-difference measurements, not photometric calibration. Returning lighting to ON reproduces identical seeded surface pixels.

## Evidence

The [separate milestone gallery](../reports/dungeon-3d-refinement/index.html) preserves the preceding implementation as its baseline.

| View                                    | Final capture                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Full room, default camera               | [after-full-room.png](../reports/dungeon-3d-refinement/after-full-room.png)                                                 |
| Lower-angle room                        | [after-room-inspection.png](../reports/dungeon-3d-refinement/after-room-inspection.png)                                     |
| Chamfer, joints and weathering close-up | [after-cap-profile-closeup.png](../reports/dungeon-3d-refinement/after-cap-profile-closeup.png)                             |
| Floor / cap / wall-face separation      | [after-east-corner.png](../reports/dungeon-3d-refinement/after-east-corner.png)                                             |
| Torch warmth                            | [ON](../reports/dungeon-3d-refinement/after-torches-on.png) / [OFF](../reports/dungeon-3d-refinement/after-torches-off.png) |
| Seeded wall variation                   | [after-wall-variation.png](../reports/dungeon-3d-refinement/after-wall-variation.png)                                       |
| Repaired door-cap join                  | [after-side-door-inspection.png](../reports/dungeon-3d-refinement/after-side-door-inspection.png)                           |

The mockup remains a visual direction rather than a pixel-exact target. The retained floor has a different slab scale; walls/caps are more regular; flames use simple static geometry. Unshadowed point lights can still bleed across nearby ordinary walls. No floor-scale, camera-default, stair-size or traversal change is included.

Reproduce with the existing server running, substituting its actual address:

```powershell
$env:ATELIER_URL = 'http://localhost:9000'
$env:ATELIER_3D_REPORT_DIR = 'reports/dungeon-3d-refinement'
node scripts/verify-dungeon-3d-polish.mjs
npm run verify:3d
```

The output-directory option retains the previous milestone's baseline. Do not run `--baseline` over saved evidence during normal verification. Headless capture opens no visible tabs and launches no extra server.

## Validation and scope

The suite includes six new cap/appearance regressions: actual facet geometry, bounded footprints/joints, coherent seeded masonry, four-direction door-head coverage/cutaway, reproducible weathering/chips, and per-stone finish diversity without a three-tile repetition phase. Existing tests and fixtures are retained. Broader browser verification checks 32/64 layouts, door and stair rays, generated secrets, height rebuild resources, unchanged Canvas pixels/settings, console errors and viewport cleanup. Camera gesture checks remain in the focused capture verifier.

Changed prototype files, under `apps/dungeon-atelier/src/experiments/dungeon-3d/`: `geometry.ts`, `materials.ts`, `plan.ts`, `scene.ts`, the new `cap-weathering.ts`, and the material seed argument in `viewport.ts`. Supporting changes: `tests/dungeon-3d-cap-profile.test.mjs`, the focused capture script/report, refreshed broader 3D evidence and documentation. No page/control, route, dependency, core generator or production renderer changes are included in this milestone. Earlier uncommitted projection-study changes remain separate.

Validation passed: 145 tests, core compilation, app TypeScript, repository formatting/ESLint, production build, the focused browser verifier and the broader 3D verifier. Canvas pixels and saved appearance settings remained unchanged; no browser exceptions or console errors were reported, and active 3D viewports returned to zero after navigation. The production bundle excludes the experimental renderer. The final cap-only color adjustment was rechecked with app TypeScript and the focused browser comparison.
