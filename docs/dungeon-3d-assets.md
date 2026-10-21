# Three.js asset refinement

This milestone refines the development prototype at `/#/dev/dungeon-3d`. The approved caps remain the reference: their geometry, chamfer, UVs, vertex colors, albedo, bump and roughness maps, and material parameters match the captured baseline. The generation core, production Canvas renderer, camera defaults, wall heights, door placement, secret concealment, and light setup are retained.

Wall faces use larger, staggered masonry courses with shallow dressed edges. Seeded variation shares a value and texture family across four-unit segments and paired courses; individual blocks select grain within that family. Body-only grading restrains photographic contrast and saturation without changing cap processing. This makes the wall read as grouped masonry at room scale instead of independently shuffled blocks.

Floors now consist of shallow extruded stone slabs with real bevels, recessed grout, and 0.01 units of seeded height variation. Courses continue across logical tile boundaries. Their clipped pieces are united before extrusion, retaining the descending stair apertures. Broad room slabs and smaller corridor stones reuse interiors from the existing Ancient floor art, with rotated atlas samples and restrained surface bump. Contact shading sits above the slab surface. These are visual meshes; traversal and collision rules remain unchanged.

Doors use six thick beveled planks, rear bracing, tapered iron straps, rivets, hinge barrels, latch plates, and ring handles on both sides. Dressed jamb courses, a segmented header, and a stone threshold frame the existing opening. The hinge position, opening angle, door orientation, and secret-door behavior are retained.

Torches now use slender oxidized iron brackets holding charred wooden shafts, wrapped fuel heads, and uneven burned splinters. Soft additive flame sheets replace the opaque yellow flame mesh, with a pale hot core and orange feathered edges. Three crossed, slightly inclined sheets retain volume across camera angles. These are static procedural flames; animation remains a separate milestone. Torch surfaces have dedicated materials so door hardware remains unchanged. Existing warm point lights, their placement and eight-light budget, ambient lighting, directional lighting, exposure, and shadows are retained.

## Visual review

The [before/after gallery](../reports/dungeon-3d-assets/index.html) retains the milestone baseline. Requested views:

| View                                 | Capture                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Full room / normal gameplay distance | [Room](../reports/dungeon-3d-assets/after-full-room.png)                 |
| Cap and wall-face transition         | [Transition](../reports/dungeon-3d-assets/after-cap-profile-closeup.png) |
| Physical floor slab treatment        | [Floor](../reports/dungeon-3d-assets/after-floor-closeup.png)            |
| Door construction and hardware       | [Door](../reports/dungeon-3d-assets/after-door-closeup.png)              |
| Sconce and flame                     | [Torch](../reports/dungeon-3d-assets/after-torch-closeup.png)            |
| Masonry detail                       | [Wall](../reports/dungeon-3d-assets/after-wall-variation.png)            |

The close-ups expose the limits of reused photographic crops; this is still a procedural prototype, not a bespoke sculpted asset pack. Artistic acceptance remains a visual review decision.

## Validation

- All 148 tests pass, including slab contour union, real bevels, deterministic relief, open descending stair apertures, and shared wall variation.
- App TypeScript, formatting, ESLint, and production build checks pass.
- The browser verifier passes 32/64 map checks, real closed/open door ray tests, rising/recessed stair tests, height rebuild resource bounds, secret concealment, production Canvas parity, and cleanup.
- The asset browser pass compares approved cap geometry/material fingerprints against `before-report.json`, checks camera gestures, bounded draw calls, deterministic surface pixels, and visible torch illumination with identical ON/OFF camera framing.

To refresh the asset captures against the running development server in PowerShell:

```powershell
$env:ATELIER_URL='http://localhost:9000'
$env:ATELIER_3D_REPORT_DIR='reports/dungeon-3d-assets'
node scripts/verify-dungeon-3d-polish.mjs
```

The existing `before-*` captures are the approved-cap baseline. Do not regenerate them when checking later body refinements.
