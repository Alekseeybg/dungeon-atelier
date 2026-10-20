# Visual foundation — four-door demonstration

These notes record the original visual foundation study. Its approved architecture now ships in Ancient Ruined Dungeon; see [production visual integration](production-visual-integration.md). The review page retains material comparisons, but the retired Dimensional Stone baseline renderer has been removed.

The current [realistic floor refinement](realistic-floor-review.md) uses the latest mockup's realistic half. The previous floor remains selectable; the comic-book half is reserved for a future theme. The foundation notes below describe the shared architecture and earlier source set.

The latest [structural readability pass](plane-separation.md) adds shared cap/face value responses and a floor-clipped contact band, with dedicated east-wall and south-east corner review views. Toggle Structural separation off to inspect the earlier material response.

The current review adds [two masonry and doorway treatments, A / B](masonry-review.md), while keeping the projection, floor, and fixture below. A is the default; the preceding material set remains selectable as Previous prototype. The following foundation notes describe the shared construction; see the A/B review for the replacement wall/frame/sill sources and current screenshots.

With `npm run dev` running, open [the review page](http://localhost:9000/#/visual-foundation). It has a room view, full layout, masonry/corner detail, north/south and east/west details, closed/open doorways, a concealed/revealed north entrance, lighting, a logical grid, material comparisons, and PNG download.

## Result and comparison

- [Candidate room](../reports/visual-foundation/candidate-room-closed.png)
- [Same layout before and after](../reports/visual-foundation/comparison-room.png)
- [Complete layout](../reports/visual-foundation/candidate-scene-closed.png)
- [Wall caps, faces, corners, and floor detail](../reports/visual-foundation/candidate-architecture-closed.png)
- [North/south doors](../reports/visual-foundation/candidate-doors-ns-closed.png)
- [East/west profiles](../reports/visual-foundation/candidate-doors-ew-closed.png)
- [Unlit material review](../reports/visual-foundation/candidate-room-unlit.png)
- [Open doorways](../reports/visual-foundation/candidate-room-open.png)
- [Technical report](../reports/visual-foundation/report.json)

The PNGs are archived Canvas exports from the original review. Baseline and candidate used the same deterministic room, corridors, doors, and output pixel density. The baseline images remain as historical evidence; that renderer is no longer included in the app.

The reference is the user's dungeon mockup and `D:/Projects/Dungeon Tileset Atlas and Preview.png`, used as an art-style reference, not cropped into a tileset.

| Characteristic | Candidate compared with the reference                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flooring       | Broad, varied painted flagstones and a visibly worn/damp lower-right area. Slabs are larger and rougher than much of the reference paving.                                  |
| Masonry        | Continuous painted staggered courses retain mortar, bevels, and mineral faces. Separate overhead coping avoids using front-face shading on the cap.                         |
| Wall depth     | One cap plane and one height vector; darker south/east faces, with floor-level contact shadows.                                                                             |
| Doors          | Frames and leaves occupy the visible wall surface, with floor-level thresholds and coping above. The frames are projected architectural surfaces, not upright floor icons.  |
| Profiles       | East/west faces are narrow under the fixed view. They need stronger authored hinge, edge, and wood detail for a production-quality finish.                                  |
| Corners        | Connected geometry has no detached caps or unfilled junction holes in this scene. Silhouettes remain more regular than the reference's individually authored corner stones. |
| Repetition     | The room uses a large coherent floor field rather than independent random square tiles. Source periods and the small wall-profile set still repeat outside that field.      |
| Lighting       | Two restrained, connected-area warm lights. The unlit view allows the artwork to be judged independently of lighting.                                                       |

Technical tests establish behavior and alignment, **not visual approval**. The source art is generated raster candidate artwork, not a finished human-authored production pack.

## Projection chosen for this candidate

This is a stylized parallel, orthographic-looking overhead projection. Ground axes remain horizontal/vertical; there is no isometric diamond, map rotation, perspective vanishing point, or distance-dependent scaling.

For ground coordinates `X,Y` in the existing logical pixel units, and height `h` where `h=1` is wall height:

```text
screenX = X - 6h
screenY = (26/32)Y - 24h
```

| Convention            | Candidate value                                                                     |
| --------------------- | ----------------------------------------------------------------------------------- |
| Logical cell          | 32 × 32, unchanged                                                                  |
| Visual ground cell    | 32 × 26 logical display units                                                       |
| Wall height           | 24 visual units                                                                     |
| Cap lift              | 6 left, 24 up                                                                       |
| Wall center footprint | 20 × 20 within the 32 × 32 logical cell; six-unit insets and connected arms         |
| Horizontal cap depth  | 20 × 26/32 = 16.25 visual units                                                     |
| Visible normals       | South and east; no simultaneous invention of north/west faces                       |
| Sprite display canvas | 50 × 60, including transparent overhang and doorway surround                        |
| Anchor                | 12,29 relative to the complete display canvas                                       |
| Source resolution     | Two raster pixels per logical display unit: 100 × 120 per slot; native anchor 24,58 |
| Floor origin          | Tile `(x,y)` maps to `(32x,26y)`                                                    |
| Scene padding         | 32 visual units on each side                                                        |

The unrotated floor axes plus a lateral height lift are an artistic parallel-projection convention, not a claim that this is an exact physical 3D camera. It provides a single consistent construction rule within the requested orthographic visual style.

These projection conventions now underpin Ancient's production presentation. See [production visual integration](production-visual-integration.md) for the editor integration; the [archived asset specification](art-pack/asset-specification.md) describes the retired theme's different dimensions.

## Architectural rules

The existing north/east/south/west wall masks and diagonal corner-fill rules determine cap silhouettes. Shared cap branches meet in the same physical position and height; their painted surface uses coherent UV coordinates. Only exposed south/east contours receive faces, projected by the same height vector.

A door's `north-south` or `east-west` metadata describes **travel**. The fixture separately records which side of its central room the entrance occupies. North/south assemblies use the south-visible horizontal-wall surface at local physical `Y=26`; east/west assemblies use the east-visible vertical-wall surface at `X=26`. Placing the latter at `X=16` would embed the leaf at the wall's centerline, behind the jambs.

Frames extend six physical units into surrounding masonry at each end, giving a 44-unit surround over the 32-unit doorway cell. The cap remains connected above the opening. Thresholds are horizontal floor surfaces, aligned to the same base plane as the leaf. The source frame is a neutral frontal **elevation**, without a painted coping plane; its surfaces and the neutral leaf are mapped into the appropriate architectural plane. A completed perspective-specific sprite is never rotated by 90 degrees.

Open state previews an empty arch, not hinged animation or a simulated door-state change. A concealed secret is replaced with ordinary connected masonry, including its hidden approach. Only explicit reveal draws the secret panel and S marker. These are scene-local presentation options.

Floor skirts extend six logical units under inset wall bases to close the visual gap between their physical footprint and the logical floor edge. They are drawing coverage, not additional walkable terrain. Raised cap overhangs and foreground occlusion are intentional consequences of wall height, not collision changes.

Drawing order:

1. Void and coherent floor field.
2. Fitted thresholds and floor contact shadows.
3. Architecture in baseline order, with neighboring masonry before a frame at the same baseline; exposed faces precede caps.
4. Connected-area light contributions clipped to reachable floor and architectural silhouettes.
5. Sconce/flame art.
6. Optional logical grid.

## Artwork and pipeline decision

The old source masonry contained useful painted detail, but cropping individual stone interiors into newly drawn block rectangles discarded much of its authored construction. That produced technically connected but visibly repetitive walls. The old full doorway image also carried its own perspective and cap treatment.

The candidate uses **authored architectural layers with the existing connection compositor**: a new floor painting, dedicated overhead coping, a continuous painted wall profile, and an authored transparent arch frame. The compositor preserves those surfaces; it does not create another layer of random stone noise, chips, bevels, or procedural brick rectangles. The neutral leaf and sconce are reused.

This combines material replacement with authored frame/profile layers. It is deliberately **not described as a complete hand-authored wall-variant pack**. It retains the useful masks, anchors, transparency, and caching infrastructure while giving artwork control of the visible masonry. If this approach's visual quality is rejected, the next art step is fully authored corner/end/profile assemblies, rather than another round of procedural texture noise.

Only ten wall geometries occur here: `wall.3.0`, `.5.0`, `.6.0`, `.7.0`, `.9.0`, `.10.0`, `.11.0`, `.12.0`, `.13.0`, `.14.0`. The scene atlas caches 128 placements, including their texture phases and door assemblies. It does not construct the complete 188-entry production variation set. [The packed atlas](../reports/visual-foundation/scene-atlas.png) and [its manifest](../reports/visual-foundation/scene-atlas.json) are supplied for inspection.

### Source files

New art lives in `apps/dungeon-atelier/src/assets/visual-foundation/`:

| File                     | Source dimensions | Background / role                                                                       |
| ------------------------ | ----------------- | --------------------------------------------------------------------------------------- |
| `flagstone-field-v1.png` | 1254 × 1254       | Opaque room-scale floor field, including painted weathering                             |
| `coping-stone-v1.png`    | 1254 × 1254       | Opaque overhead limestone construction                                                  |
| `masonry-profile-v1.png` | 2172 × 724        | Transparent horizontal wall profile; authored lower face courses used by the compositor |
| `arch-frame-v1.png`      | 1448 × 1086       | Transparent frame with a genuinely transparent arch opening                             |
| `flagstone-large-v1.png` | 1254 × 1254       | Retained early material study; not imported by the demonstration                        |

`door-leaf-v1.webp` and `wall-sconce-v1.webp` are shared source assets in `src/assets/architecture/`. The source PNGs are bundled only through the lazy review route. They are intentionally not yet optimized into a production pack.

All new raster artwork was produced with the built-in **image_gen** tool. Exact prompts, reference role, and filenames are recorded in [prompts.json](../apps/dungeon-atelier/src/assets/visual-foundation/prompts.json). No concept-sheet tiles were blindly cropped into production cells.

The room samples a 384-unit base floor field; mirrored outer periods provide continuous boundaries outside the primary field. The room itself stays inside one unmirrored source area. Coping and face materials have their own coherent periods. This retains larger painted patterns and avoids assigning arbitrary independent floor textures per cell.

## Remaining artwork requests

No external file is required to run the demonstration. For a more faithful production finish, the useful handoff is:

| Suggested external files                                                                                                                                                                               | Native canvas                                                                 | Anchor / requirements                                                                       | Visual objective                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `door_east_closed.png`, `door_west_closed.png`, matching open-arch variants                                                                                                                            | 100 × 120 RGBA at 2×                                                          | Anchor 24,58; one logical-cell footprint; exactly the projection above                      | Hand-tuned readable hinge straps, wood edge, recess, and arch stones in the narrow profiles                     |
| `wall_m03_c00.png`, `wall_m05_c00.png`, `wall_m06_c00.png`, `wall_m07_c00.png`, `wall_m09_c00.png`, `wall_m10_c00.png`, `wall_m11_c00.png`, `wall_m12_c00.png`, `wall_m13_c00.png`, `wall_m14_c00.png` | 100 × 120 RGBA at 2×                                                          | Same anchor; cap branches at the same physical connection points; preserve silhouette joins | More individually authored quoins, ends, and chipped exterior contours, with fewer repeated construction motifs |
| Optional revised `floor_room_field.png`                                                                                                                                                                | 1254 × 1254 or larger layered master, covering a 384 × 384 logical-unit field | Opaque, flat overhead; same ground projection applied in code                               | Slightly smaller paving and more restrained grain to approach the reference's smoother painted finish           |

These are approval-stage requests, not an instruction to generate the remaining map-wide pack. Preserve layered source artwork and true alpha; do not bake warm torchlight, external cast shadows, or an incompatible camera angle into these sprites.

## Verification and boundaries

Run from the repository root, with the development server already running:

```sh
npm test
npm run typecheck
npm run lint:check
npm run build
npm run verify:foundation
```

The scene verifier captures all review images, tests every door's changed pixels in open/closed state, verifies transparent openings, deterministic output, no mutation, and secret concealment against an independently sealed twin. It exercises view/state/lighting/grid/secret controls, downloads a real PNG, and checks desktop/mobile layouts. The production browser verifier checks Stone/Classic rendering and normal editor interactions.

Completed checks on 2026-10-16: **112 automated tests passed**, along with type checking, repository formatting/ESLint, and the production build. The foundation browser checks passed at 1920×1080, 2560×1440, and 390×844/DPR 2, including actual PNG download. All 12 original Stone/Classic baseline pixel hashes still match, and the normal editor's zoom, pan, inspection, grid, minimap, walk/fog, and padded rendering checks passed. Those generated-map checks used the existing editor styles, not this candidate.

A [production-build smoke check](../reports/visual-foundation/production-smoke.json) also loaded the lazy review route from the built SPA and confirmed its rendered room pixels exactly match the development capture, with no runtime errors.

The fixture has one room and intentionally is not an importable production dungeon, which requires at least two rooms. Its presentation-only secret spur is not a new generation algorithm. No room placement, corridor routing, collision, movement, serialization, schema, or existing theme implementation was changed for this demonstration. The only editor-adjacent addition is a separate lazy route with a link back to the studio.

No 10,000-map stress run or engine migration is needed for this visual task. Canvas supports the required affine planes, alpha artwork, atlas sampling, masks, and static lighting. The remaining quality work is predominantly artwork and art direction.

The subsequent [generated-floor verification](generated-floor-review.md) exercises actual generated geometry in an isolated adapter, without rolling the theme into the editor. The [wall-cap effects pass](wall-cap-polish.md) adds a reversible review control and before/after evidence using the current art. The complete artwork/theme rollout remains pending visual review.
