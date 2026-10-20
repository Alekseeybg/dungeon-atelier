# Dungeon Atelier — external artwork specification

Archived specification, inspected 2026-10-16. The Dimensional Stone renderer, atlas, and dedicated assets described here have since been removed. This document and `current-sprite-inventory.csv` record that retired implementation; they are not a current asset contract. See [production visual integration](../production-visual-integration.md) for the supported themes.

## 1. Scope and status

There are three editor styles: Stone, Classic, and Dimensional Stone. Stone and Classic draw their graphics in Canvas code. Dimensional Stone combines imported raster materials with Canvas-built architectural sprites and a generated atlas. It does **not** currently load an arbitrary artist-provided tileset folder or external JSON atlas automatically.

The separate `rendering/projection-study/` directory is an experiment used by a four-door-room script. The editor does not import it. Its dimensions must not be confused with the current editor's dimensions. Its camera and door treatment are not a finalized production art contract.

Two delivery routes are possible:

1. **Material replacement:** deliver opaque stone/paving textures and isolated transparent decorative sprites. These replace source art used by the current builder. The builder still controls block shapes, geometry, tinting, mirroring, and shading. This gives limited control over the final authored appearance.
2. **Complete authored tileset:** deliver the connected wall assemblies, coordinated floors, and doorway assemblies listed below, plus editable layers. Integration will load these sprites instead of building their artwork in Canvas. This is the better route for matching a cohesive external art direction. It requires a subsequent loader/integration change; it is not a drop-in folder replacement today.

The dimensions below describe **current compatibility**, not an endorsement of the current door perspective. Finalize the architectural projection before painting a complete perspective-specific wall/door pack. Neutral material textures can be authored independently of that decision.

## 2. Logical grid and coordinate conventions

- Logical tile: **32 × 32 pixels**, defined in `tile-size.ts`.
- Editor Dimensional Stone ground: one logical tile occupies **32 × 32 visual pixels** at native scale. Zoom and display pixel ratio do not change asset dimensions.
- Coordinates increase rightward and downward. World tile `(x,y)` begins at `(32x,32y)`.
- Current raised-cap displacement relative to its floor footprint: **4 pixels left, 24 pixels up**. Only the exposed south and east wall surfaces are drawn.
- Sprite-local coordinates start at the top-left of its **entire exported canvas**, including transparent padding.
- Placement: `destination = logicalPosition - anchor + offset`.
- Keep the specified full canvas and anchors. Do not independently auto-trim finished atlas sprites.
- Current atlas: **1024 × 856 RGBA**, **310 entries**, identifier `dimensional-stone-v1`. This is an in-memory Canvas atlas, not a checked-in production atlas image.
- Map padding: left/right/bottom **8 px**, top **32 px**. Arbitrary larger overhangs require a bounds/occlusion review during integration.

The existing loader _does_ alpha-trim the standalone source door, doorway, inlay, and torch before fitting them into atlas slots. This source-material behavior differs from the fixed-canvas convention required for an externally authored finished sprite pack.

## 3. Exact runtime sprite inventory

The accompanying `current-sprite-inventory.csv` lists **every entry**, its suggested delivery filename, source rectangle, dimensions, footprint, anchor, offset, layer, and connectivity values. Suggested filenames are for the external pack; they are not files the application already loads. Floor patch filenames are an alternative to delivering the six complete periods: supply either the periods or their coordinated slices, not both.

| Family / current IDs                       | Entries | Export canvas at 1× | Logical footprint | Anchor x,y | Offset x,y | Background                         |
| ------------------------------------------ | ------: | ------------------- | ----------------- | ---------- | ---------- | ---------------------------------- |
| `floor.{family}.{0..15}`                   |      96 | 64 × 64             | 2 × 2             | 0,0        | 0,0        | Opaque                             |
| `wall.{mask}.{cornerFill}.{0..3}`          |     188 | 36 × 56             | 1 × 1             | 4,24       | 0,0        | Transparent RGBA                   |
| `door.north-south.{closed,open,secret}`    |       3 | 44 × 56             | 1 × 1             | 8,24       | 0,0        | Transparent RGBA                   |
| `door.east-west.{closed,open,secret}`      |       3 | 36 × 56             | 1 × 1             | 4,24       | 0,0        | Transparent RGBA                   |
| `stairs.{up,down}`                         |       2 | 32 × 32             | 1 × 1             | 0,0        | 0,0        | Transparent outside stair assembly |
| `detail.{worn,cracked,mossy,grimy}.{0..3}` |      16 | 32 × 32             | 1 × 1             | 0,0        | 0,0        | Transparent RGBA overlay           |
| `inlay.center`                             |       1 | 80 × 80             | 3 × 3 reserved    | 40,40      | 0,0        | Transparent RGBA                   |
| `torch.sconce`                             |       1 | 12 × 35             | 1 × 1             | 0,4        | 10,0       | Transparent RGBA                   |

Floor families: **flagstone, slab, ornament, corridor, repair, threshold**. Each has 16 atlas entries. These are coordinated patches of a larger period, not sixteen unrelated random floor designs.

For the torch, the effective painted destination begins at logical position `(+10,-4)`. For the inlay, the caller supplies its intended center; the anchor centers the image there. The inlay's reserved 3 × 3 footprint is 96 × 96 logical pixels, while its painted canvas is 80 × 80.

### Wall caps, vertical faces, and corners

There are **no separate cap, face, or corner image files currently expected by the loader**. They are composed into the wall's 36 × 56 slot:

| Architectural component                            | Current construction at 32-pixel tile size                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap design plane                                   | 32 × 32 local plan, clipped to connectivity shape                                                                                                  |
| Central cap footprint                              | x=6..26, y=6..26: 20 × 20                                                                                                                          |
| Connecting cap arms                                | 20 px wide, extend through the 6 px inset to the corresponding tile edge                                                                           |
| Filled cap corners                                 | Optional 6 × 6 quadrants, according to diagonal solid masonry                                                                                      |
| South-facing vertical surface                      | Exposed cap-contour span, extruded 24 px downward and 4 px right; two 12 px courses in the current builder                                         |
| East-facing vertical surface                       | Exposed east cap contour extruded by the same `(4,24)` vector; its projected width is 4 px and total bounding height depends on the contour length |
| All turns, ends, tees, crosses, and diagonal fills | Same 36 × 56 transparent canvas and anchor `(4,24)`                                                                                                |

Thus, **32 × 48 is not the current finished-wall format**. A stand-alone 32 × 24 front material patch can be useful as a source layer, but the renderer does not load it as a wall-face asset today.

In a wall canvas, logical tile origin is at `(4,24)`. Cap geometry occupies its unshifted local plan and is raised by the anchor at placement time. The physical south cap boundary at local plan y=26 meets the floor at logical y=26 after extrusion; do not align door feet merely to the bottom edge of an arbitrary cropped image.

## 4. Floors larger than one tile

**Yes.** Dimensional Stone supports coordinated multi-tile floor artwork:

- Source images are currently resized to a 128 × 128 base, mirrored horizontally/vertically into a **256 × 256 repeat period**.
- A period covers **8 × 8 logical tiles**.
- The atlas splits that period into a 4 × 4 array of **64 × 64 patches**, each covering 2 × 2 logical tiles.
- Patch index: `variant = column + 4 × row`.
- The renderer selects 32 × 32 quadrants of those patches and advances the period coherently. Rooms receive a deterministic phase; corridors use a coherent global phase.
- Cracks, wear, dampness, and grime are separate overlays. Floor kinds can meet at explicit joints rather than requiring arbitrary paving patterns to continue across unrelated materials.

For an external finished floor pack, deliver these **opaque 256 × 256 seamless periods**:

| Proposed delivery filename          | Role                                | Anchor |
| ----------------------------------- | ----------------------------------- | ------ |
| `floors/floor_flagstone_period.png` | Ordinary room paving                | 0,0    |
| `floors/floor_slab_period.png`      | Fitted/slab room paving             | 0,0    |
| `floors/floor_ornament_period.png`  | Coordinated ornamental paving       | 0,0    |
| `floors/floor_corridor_period.png`  | Darker corridor paving              | 0,0    |
| `floors/floor_repair_period.png`    | Repaired corridor paving            | 0,0    |
| `floors/floor_threshold_period.png` | Clean fitted paving at doors/stairs | 0,0    |

All opposite edges must join in color, mortar placement, and stone contours. Internal 32/64-pixel subdivisions must not look like tile borders. No baked directional cast shadows, black border, text, lighting pools, or transparent gaps in base floors.

Delivering these already-authored periods requires integration to bypass the current source mirroring; merely replacing a source file will resize and mirror the painting again. A larger source master, such as 1024 × 1024, is welcome, but specify its intended native display scale. Current source loading does not infer that scale from file resolution.

## 5. Complete wall autotiling coverage

Wall-connection bits are **N=1, E=2, S=4, W=8**. They describe connected masonry arms, **not walkable openings**. A door frame also connects the appropriate neighboring wall arms.

Additional `cornerFill` bits are **NE=1, SE=2, SW=4, NW=8**. A filled quadrant requires both adjoining wall arms and solid diagonal masonry. Without these cases, broad wall masses and junctions develop holes.

| Mask | Connected directions / shape | Allowed cornerFill values |
| ---: | ---------------------------- | ------------------------- |
|    0 | Isolated pillar              | 0                         |
|    1 | North end                    | 0                         |
|    2 | East end                     | 0                         |
|    3 | North/east turn              | 0,1                       |
|    4 | South end                    | 0                         |
|    5 | North/south straight         | 0                         |
|    6 | East/south turn              | 0,2                       |
|    7 | North/east/south tee         | 0,1,2,3                   |
|    8 | West end                     | 0                         |
|    9 | North/west turn              | 0,8                       |
|   10 | East/west straight           | 0                         |
|   11 | North/east/west tee          | 0,1,8,9                   |
|   12 | South/west turn              | 0,4                       |
|   13 | North/south/west tee         | 0,4,8,12                  |
|   14 | East/south/west tee          | 0,2,4,6                   |
|   15 | Cross / solid junction       | 0..15                     |

This gives **47 geometry combinations × 4 appearance variants = 188 wall entries**. Inside/outside corners are derived from these neighbors; a pack containing only one horizontal, one vertical, and four corner sprites is incomplete.

Suggested filename pattern: `walls/wall_m{mask:02}_c{cornerFill:02}_v{variant}.png`, for example `wall_m10_c00_v0.png`. The CSV enumerates all required files. Four material variants may share geometry and can initially reuse artwork; they do not require four different silhouettes.

All connected cap arms must meet at identical positions on opposite tile edges. Preserve one height vector, stone scale, mortar width, light direction, and face contrast throughout. Separate detail layers may be delivered on the same full 36 × 56 canvas for editing, but the complete assembled sprite is the current runtime contract.

## 6. Door assemblies and alignment

In existing saved data, orientation is the **travel direction**:

- `north-south`: opening through a horizontal wall; wall/frame spans east–west.
- `east-west`: opening through a vertical wall; wall/frame spans north–south.

The editor renderer currently selects **two axes × three presentation states**, not four independently authored cardinal-facing sprite sets. Open states are renderer preview overrides; persistent open/closed simulation and locked-door metadata are not implemented. Do not create a locked-state dependency for current compatibility.

Current-compatible finished filenames:

| Proposed delivery pattern                         | Files | Canvas       | Anchor | Offset |
| ------------------------------------------------- | ----: | ------------ | ------ | ------ |
| `doors/door_ns_{closed,open,secret_revealed}.png` |     3 | 44 × 56 RGBA | 8,24   | 0,0    |
| `doors/door_ew_{closed,open,secret_revealed}.png` |     3 | 36 × 56 RGBA | 4,24   | 0,0    |

Provide complete doorway assemblies: connected coping/lintel, jambs, recess, leaf, and threshold alignment. Separate layered frame/leaf/threshold exports on the same canvas are useful for later integration. Do not rotate a completed frontal arch to create a profile: its cap, vertical surfaces, lighting, and depth would become incompatible.

For a future four-direction pack, supply distinct **north/south frontal and east/west profile assemblies**, with matched states and editable layers. These are future delivery names, not IDs currently consumed by the editor. Their final pixel dimensions depend on selecting the production projection; the isolated study's dimensions below are not approval of that projection.

A concealed secret uses the **ordinary connected wall sprite**, with no special outline, different stone, baked glow, or unique shadow. The `secret` sprite is for explicit editor reveal only. A separate visibly special "hidden secret" sprite would leak the feature.

The existing doorway artwork and placement are under investigation. Matching today's slot size alone does not guarantee a visually correct frame. A final north/south/east/west room proof should accompany the artist's delivery before map-wide integration.

## 7. Transparent overhangs and atlas packaging

**Yes**, Dimensional Stone supports transparent sprites extending beyond one logical cell. Logical footprint, visual width/height, anchor, offset, and source rectangle are stored independently. The renderer draws the full source rectangle; it does not crop every sprite back to 32 × 32.

Current wall bounds relative to tile origin: `[-4,+32] × [-24,+32]`. Current north/south door slot bounds: `[-8,+36] × [-24,+32]`. These are canvas bounds, not a requirement to paint every pixel.

Deliver individual lossless **RGBA PNGs** with stable full canvases, plus layered originals. Use true alpha, no matte or baked checkerboard, no labels, no shadows extending outside the agreed canvas, and no automatic trimming. Opaque source materials need no alpha.

An optional finished atlas should include a JSON manifest with: `id`, atlas filename, source `x/y/width/height`, logical footprint, visual width/height, anchor, offset, layer, variant IDs, and wall connectivity mask. The engine's generated atlas currently has no gutters; a newly packed atlas can use transparent/extruded gutters if its source rectangles account for them. Do not assume a regular 32 × 32 sprite-sheet grid.

Use restrained neutral illumination in material art. Runtime contact shadows and warm torchlight already composite over the pack; strong baked orange lighting or cast shadows will double those effects. No normal-map, roughness-map, or shader-material pipeline currently exists.

## 8. Actual source image files today

Directory: `apps/dungeon-atelier/src/assets/dimensional/`.

Dimensions were read from the image headers. **Every current PNG and WebP is 1254 × 1254**. These are source masters, not native gameplay sprite dimensions. PNGs are retained masters; WebPs are imported at runtime. The loader does not require 1254 specifically: it decodes natural image dimensions and resizes/samples the art. Source floor images should be square because the current crop uses their width for both axes. Square 1024/2048 masters are suitable for later integration; their pixel count does not automatically change the on-map stone scale.

| Existing basename; both `.png` and `.webp` exist | Pixels per file | Alpha requirement | Current use                                                                 |
| ------------------------------------------------ | --------------- | ----------------- | --------------------------------------------------------------------------- |
| `floor-stone-v1`                                 | 1254 × 1254     | Opaque            | Flagstone and corridor source, resized/mirrored                             |
| `fitted-floor-v1`                                | 1254 × 1254     | Opaque            | Slab, ornament, and repair source, resized/mirrored                         |
| `masonry-v1`                                     | 1254 × 1254     | Opaque            | Sampled stone material inside programmatically shaped blocks and thresholds |
| `door-leaf-v1`                                   | 1254 × 1254     | Transparent       | Isolated oak leaf; alpha-trimmed before fitting/projecting                  |
| `doorway-front-v2`                               | 1254 × 1254     | Transparent       | Frontal stone-frame/door source; alpha-trimmed; perspective is provisional  |
| `carved-inlay-v1`                                | 1254 × 1254     | Transparent       | Trimmed and fitted to centered 80 × 80 atlas sprite                         |
| `wall-sconce-v1`                                 | 1254 × 1254     | Transparent       | Trimmed and fitted to 12 × 35 atlas sprite                                  |

There are **no checked-in individual cap, vertical-face, corner, stair, or threshold PNGs**. Those are Canvas drawings today. There are also no required water/lava, bridge, furniture, or trap images for the current terrain model.

## 9. Graphics code and loading flow

All paths below are relative to `apps/dungeon-atelier/src/features/dungeon/rendering/` unless stated otherwise.

| File                      | Responsibility                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tile-size.ts`            | Authoritative 32-pixel logical tile size                                                                             |
| `dungeon-renderer.ts`     | Style dispatch, Stone and Classic drawing, render bounds, map Canvas creation                                        |
| `stone-tiles.ts`          | Original procedural Stone floors/walls and Classic rock texture; cached 32 × 32 canvases                             |
| `stone-doors.ts`          | Original Stone door geometry                                                                                         |
| `stone-atmosphere.ts`     | Original trims/inlays, floor wear, ambient effects, lighting and surrounds; some helpers reused by Dimensional Stone |
| `wall-torches.ts`         | Original procedural sconces                                                                                          |
| `material-rules.ts`       | Deterministic choice of room/corridor material, conditions, and variants                                             |
| `dimensional-art.ts`      | Static WebP imports, `Image.decode()`, alpha trimming, repeated floor periods, stone sampling                        |
| `dimensional-model.ts`    | Sprite definitions, source packing, sizes/anchors, wall masks/corner fills, render-only secret concealment           |
| `dimensional-sprites.ts`  | Builds/caches the atlas, paints walls/doors/stairs/overlays, draws source rectangles at their anchors                |
| `dimensional-renderer.ts` | Applies material choices, draws coherent floor patches, ordered architectural sprites, lighting, grid, walk cutaway  |
| `projection-study/*`      | Isolated alternative projection and four-direction door experiment; not the editor renderer                          |

Loading flow: Vite imports WebP URLs → images decode once → alpha-bearing isolated sources are trimmed → floor periods and connected architectural sprites are built → the atlas is cached by tile size → material rules and neighbor masks choose sprite IDs → draw uses the ID's source rectangle and anchor. PNG export uses the same editor rendering pipeline. These are local bundled assets, not remotely generated runtime graphics.

## 10. Experimental projection: reference only

The isolated study retains a 32 × 32 logical grid but displays its ground at **32 × 24**, using `floorDepth=0.75`. Its raw sprite height lift is 32, displayed as 24 after compression, with a 6-pixel lateral lift.

| Study item                      | Raw canvas / anchor | Display size after depth scaling |
| ------------------------------- | ------------------- | -------------------------------- |
| Floor patch                     | 64 × 64 / 0,0       | 64 × 48                          |
| Wall                            | 38 × 64 / 6,32      | 38 × 48                          |
| All four directional door slots | 38 × 64 / 6,32      | 38 × 48                          |

The study uses `door.{north,south,east,west}.{closed,open,secret}` and geometry-owned frames. It is not imported by the editor. Do not mix its 38 × 64 assets with the editor's 36 × 56 wall slots. Its profile-door art remains visually provisional.

## 11. Recommended external handoff

For a complete replacement pack, supply:

1. The six coordinated 256 × 256 floor periods, with source layers and intended display scale.
2. All 47 connected wall geometries and four compatible material variations, on fixed canvases matching the chosen production projection. The CSV is the exhaustive current-compatible checklist.
3. Door assemblies with opening/threshold guides and aligned layered frame/leaf artwork. Start with one north/south/east/west test room before expanding the pack. Do not finalize four-direction dimensions from the experimental study without selecting that projection.
4. Optional matching wear/moss/crack overlays; existing stairs, inlay, and torch can remain during floor/wall replacement.
5. A contact sheet for review, individual fixed-canvas PNGs, editable masters, and a manifest. Include creator/license information with the delivered artwork.

Material-only handoff can be much smaller: separate seamless opaque floor materials and masonry material, plus an isolated leaf if desired. Existing source filenames do not constrain an artist's naming; the subsequent integration can map the delivered files explicitly.

No replacement graphics were generated, and no graphics/runtime code was modified while preparing this specification.
