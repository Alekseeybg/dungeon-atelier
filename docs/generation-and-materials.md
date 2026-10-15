# Generation and Stone material rules

These rules describe generator **3.1.0**. Classic and Stone are two visualizations of the same floor. Layout presets are independent of the selected visualization; material rules apply to Stone only.

## Layout settings

| Setting                        | Classic Rooms                | Compact Labyrinth            |
| ------------------------------ | ---------------------------- | ---------------------------- |
| Room spacing                   | 3 tiles                      | 1 tile                       |
| Chance of an irregular room    | 25%                          | 45%                          |
| Extra-connection chance        | Current setting; default 20% | Current setting; default 20% |
| Rare-shortcut chance per floor | Current setting; default 15% | Current setting; default 15% |

Selecting a preset updates spacing and irregular-room chance. It preserves the seed, map size, room-size range, target count, and connection settings. Layout → Spacing & shapes can override spacing (1–6) and irregular-room chance (0–100%); Connections contains the rare-shortcut chance (0–100%).

Spacing measures the empty gap between room bounding rectangles, independently of room size. One tile permits a shared wall. Each room still has a three-tile outer map margin. Placement is bounded by `targetRoomCount × 100` room candidates per layout. Generator 3.1.0 allows at most eight deterministic layout attempts for insufficient room placement or blocked ordinary routing. Attempt zero keeps the original stream; later room/block placement uses `<seed>:layout-retry:<attempt>`. Successful diagnostics retain every preceding reason and `generationAttempts`; exhaustion returns all reasons. Schema/invariant failures never retry.

## Room footprints and doors

An individual room is rectangular unless its shape roll succeeds. Layout → Room designs selects the allowed families. Eligible designs use weights of 3 for L shapes and 2 each for the other families, with seeded flips and orientation. Width and height describe the bounding rectangle; `floorCells` records actual floor coordinates relative to its top-left corner. Rectangles omit this array.

| Family            | Minimum bounding sides    | Footprint                                                                   |
| ----------------- | ------------------------- | --------------------------------------------------------------------------- |
| L-shaped          | 3 × 3                     | A removed corner                                                            |
| T-shaped          | 3 × 3                     | A bar with a central stem                                                   |
| Cross-shaped      | 5 × 5                     | Broad intersecting central bands                                            |
| Alcoved hall      | 5 × 7, either orientation | A continuous central hall with repeated side alcoves and a recessed far end |
| U-shaped gallery  | 5 × 5                     | Two arms joined by an end gallery, with a solid open-ended central recess   |
| Chamfered chamber | 5 × 5                     | A room with clipped stone corners                                           |

Eligibility uses the sampled room dimensions. If no selected family fits, the room stays rectangular. Selecting no families makes all individual rooms rectangular. The irregular-room probability applies separately from the chamber-block probability.

- Every footprint must be connected and reach its stored bounding edges.
- Floor cells remain within the configured width/height range's bounding rectangle.
- Every family remains traversable without jumping between disconnected floor patches. Recesses remain wall terrain.
- Removed cells remain solid wall. They cannot become room ownership, stair locations, or navigable floor merely because they lie inside a room's rectangle.
- Doors can occupy safe points along the outer perimeter. A door needs floor on both sides of its travel axis and walls across it.
- Two rooms separated by one wall tile can share one door. Otherwise, doors connect rooms to routed corridors.
- Door orientation describes travel direction. Its Stone leaf is drawn across that direction; Classic keeps its rectangular symbol.

A room's representative point is its bounding center when that is floor, or the nearest actual floor cell otherwise. Stairs and distance measurements use this point.

## Paired chamber blocks

A separate seeded stream makes one floor-level roll, default **20%**, capped at one block. The block is placed before individual rooms. It contains two or three pairs of rectangular chambers around a central corridor, rotated horizontally or vertically. Each chamber has exactly one ordinary door onto a short connecting arm. The central spine extends to both edges of the reserved block so ordinary routing can connect it to the rest of the dungeon.

- Four or six chambers count individually toward the target room count; the spine is corridor floor, with no room ownership.
- Chamber side length is selected from the configured minimum through `min(maximum, minimum + 2)`. Individual chambers respect the configured size range; the whole block can be larger.
- For side length `s` and `r` pairs, the canonical footprint is `(2s + 5) × (r(s + 1) + 1)`, before rotation. It must fit the map's three-tile placement margin and the available room slots.
- Template spacing inside a block is fixed by its design. The configured room spacing separates its bounding box from other rooms.
- Existing chamber doors are the only portals permitted on members. Reserved masonry prevents later corridors, loops, branches, or secret passages from hollowing out the design.
- If no eligible block fits after its probability roll, generation falls back to individual rooms and reports the reason.
- The exported `roomGroups` array records bounds, orientation, member room IDs, and absolute shared corridor cells. Members carry `groupId`. Import validates membership, connected corridor floor, exclusive corridor ownership, and one ordinary entrance per chamber.

## Connectivity, loops, and shortcuts

### Required connections

A deterministic spanning-tree pass connects all rooms, recognizing preconnected chamber-group members together. Candidate edges are considered by Manhattan distance. If one edge cannot be routed without breaking room walls, another crossing edge is tried. Corridors use breadth-first search outside protected room rectangles and their wall perimeters. A single shared-wall door can connect adjacent rooms directly.

Generation fails with an explanation if the geometry has no valid ordinary connection. It does not silently change the seed or settings.

### Ordinary extra connections

Non-tree room pairs are ranked by their existing walking detour compared with physical distance. The pass considers at most one candidate per placed room, using the extra-connection probability for each candidate.

A proposed extra route must save at least four steps between its endpoint rooms. Short links qualifying as major shortcuts are reserved for the separate rare pass. This favors useful regional loops without letting ordinary loop probability bypass the shortcut rarity setting.

### Rare useful shortcuts

The default is **one 15% roll per floor**, using a separate seeded random stream. Passing the roll permits consideration; a qualifying route must still exist. At most one shortcut is added.

A shortcut must:

1. Join rooms with an existing walking distance of at least 20 steps.
2. Create a direct shared-wall opening or a corridor path of at most 12 tiles.
3. Save at least 12 walking steps **and** at least 35% of the old endpoint-to-endpoint route.
4. Respect ordinary door, room-wall, and connectivity rules.
5. Use new hidden entrances, never relabel an existing ordinary doorway.
6. Carve its entire corridor interior from solid wall, keeping it separate from every pre-existing walkable tile. A cardinal wall buffer prevents intersections, reused public tiles at either end, and side openings into ordinary corridors.
7. Remain an unbranched route between its hidden doors. Sealing the route must leave all ordinary rooms and passages connected.

Ordinary corridors, regional loops, and side passages are completed before secret routing, so later ordinary excavation cannot breach a secret route. The generator measures the actual route before and after a proposed link on a temporary grid before accepting it. Stair positions are selected after all connections are complete. Shortcut savings describe the endpoint rooms, not necessarily the staircase route.

### Hidden-door visualization

Accepted shortcut entrances are tagged as secret doors, including both ends of a corridor or the single door of a shared-wall shortcut. Stone draws a fitted masonry panel; Classic draws a distinct dashed door symbol. Both carry an upright cyan **S** marker, included in PNG exports. Ordinary doors keep their existing artwork.

The floor report's **Locate shortcut** button centers the recorded route and enables its cyan overlay. The map's **Overlays → Shortcut route** toggle hides or shows that overlay in either style. The overlay is editor-only and is omitted from PNG exports and the fogged walk preview. The preview can traverse hidden doors normally: this is a generator visualization, with no door-search mechanic.

Generator 2.1.0 records the ordered shortcut path, endpoint room IDs, and before/after distances in an optional schema-2 `shortcuts` array. Earlier files still import unchanged, but their shortcut count alone cannot reliably identify which connection was the rare shortcut. Regenerate those floors to obtain the markers and location control.

Generator 2.2.0 marks its shortcut records with `isolated: true`. Validation checks that corridor interiors have exactly their previous and next route tiles as walkable neighbors, that no room owns an interior tile, and that sealing the route restores the reported before-distance while preserving ordinary connectivity. The optional field keeps older schema-2 files importable unchanged. Earlier generator output may contain public intersections or branches; regenerate it to apply the corrected routing rules.

### Side passages

A separate seeded pass makes up to one attempt per placed room, each with a 20% chance. It can add straight, 2–4 tile branches from existing corridors, capped at `ceil(roomCount / 3)` branches. Branches stay outside protected rooms and walls, avoid existing passages, and have one attachment. Attempts producing fewer than two tiles are discarded.

## Route diagnostics

| Metric            | Meaning                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Stair route       | Shortest walk from the up stair to the down stair after generation                             |
| Corridor share    | Non-room floor tiles divided by all walkable tiles; door tiles are excluded from the numerator |
| Dead ends         | Corridor floor tiles with exactly one walkable cardinal neighbor                               |
| Independent loops | Cycle rank of the connected traversal graph, with each room contracted to one node             |
| Shared-wall doors | Doors whose two floor neighbors belong to different rooms                                      |
| Rare shortcuts    | Zero or one accepted shortcut, with measured endpoint route savings                            |

The validator recomputes geometric route metrics during import. Generation-only shortcut facts are checked for consistent bounds and settings.

## Stone paving families

Materials use a separate, versioned hash (`materials-v3`). Each room keeps one base paving family, with protected thresholds overriding individual tiles. Actual footprint area determines eligibility.

Room identity is rendering-only, assigned in this priority order:

| Identity            | Selection and finish                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Stair chamber       | Contains either stair; broad slabs, light perimeter trim, fitted stair surround when its full neighborhood is open       |
| Chamber-block suite | Member of a predefined block; patterned paving at area ≥25, flagstones otherwise; warm trim and an optional center inlay |
| Secret-door chamber | Owns a secret doorway; ordinary family with restrained perimeter trim; the doorway retains its cyan S panel              |
| Junction chamber    | At least three owned doors; worn broad slabs, light trim, an optional navigation-style inlay                             |
| Patterned chamber   | Remaining area ≥35 and room hash divisible by 5; patterned paving, warm trim and a center inlay                          |
| Damp chamber        | Remaining room with sampled dampness >0.64 at its origin; moss along exposed edges                                       |
| Ordinary chamber    | Remaining rooms; slabs at area ≥25 when hash is divisible by 3, otherwise flagstones                                     |

The normal slab fallback also applies to secret-door and damp rooms. Room borders follow actual floor cells, skip walkable openings, and never bridge a missing corner. Center inlays require an entirely room-owned, plain-floor 3×3 footprint, clear of stairs. They are decorative and carry no trap, objective, or loot meaning. There is no disconnected hidden-chamber gameplay type.

Corridors use darker cobbles or replacement slabs selected by a continuous four-tile field (>0.53 selects slabs), with broad faint wear following actual walkable neighbors. Door/stair tiles and cardinal approaches use clean fitted stone. Existing oak doors, metal fittings, and secret markers retain their plan-view geometry.

## Wall construction

Ordinary wall runs use two staggered courses of rough-cut blocks per 32-pixel tile. Each block has a beveled/chipped outline, directional shading, sparse mineral grain, subtle veins, and darker mortar. Top caps are brighter while lower faces darken with a smooth depth gradient; floor contact shadows strengthen the edge without obscuring the paving.

Dressed masonry reinforces exposed turns, diagonal outer corners, and wall tiles beside doorways. Reinforced blocks stay clean so structural outlines and door frames remain readable. Exposed edges receive coping highlights and contact shadows according to adjacent walkable tiles. Unexcavated space beyond the visible dungeon boundary stays hidden.

## Wear, cracks, and moss

Dampness and age are continuous, smoothly interpolated seeded fields rather than independent per-tile coin flips.

- **Damp field:** sampled on a five-tile grid. Values above `0.62` produce stained/mossy ordinary walls. Floors receive moss only beside a cardinal wall, within that field or in a damp-identity room.
- **Age field:** sampled on a three-tile grid. Values above `0.68` crack ordinary walls; paving in these patches can crack when its variant is divisible by 3.
- **Grime:** exposed edges with age >0.55 and variant remainder 1 modulo 3 receive a soft dirt stain and a few tiny stone chips, after moss/cracks take priority.
- **Traffic wear:** corridors and junction chambers receive a soft central polish when other conditions do not take priority.
- **Protected stone:** thresholds and dressed structural masonry override weathering with a clean finish.
- **Priority:** protected materials first; then moss, cracks, grime, traffic wear, or a clean surface.

Moss collects near mortar joints. Cracks branch across individual stones. These conditions change artwork only; terrain, walkability, discovery, and collision remain unchanged.

## Light and void

Torch positions keep the existing north-facing boundary rule. Each warm light has a broad amber falloff clipped to a local connected walkable neighborhood (four cardinal steps) and its adjacent wall faces, then clipped to the visible dungeon footprint. Solid masonry blocks flood propagation; no light animates, so PNG exports stay repeatable. This is a local atmosphere approximation, not physical ray tracing or exploration visibility.

A near-black blue-gray radial wash and sparse low-opacity grain give the void a restrained vignette. Fog is drawn after all artwork and hides every unexplored tile. Previously discovered tiles remain fully lit.

## Reproducibility and compatibility

Layout randomness, shortcut randomness, side-passage randomness, and visual material randomness use separate seeded streams or hashes. Material selection includes the floor seed, floor number, coordinates, room identity, and a material-rule version. Rendering never consumes generator randomness.

New floors use schema version 2 for layout settings, irregular footprints, shared-wall doors, and route diagnostics. Generator 3.0.0 extends it with optional footprint-family selections, chamber-block chance, and room-group records. Older files omit those extensions and still import unchanged; their editor settings default to L/T families and no chamber blocks. Generator 3.1.0 adds optional retry diagnostics and permits a valid two-room floor with one shared door. Older strict schema-2 readers need updating for both the new retry fields and one-door layouts. All imports now close every secret door and require every room and both stairs to remain reachable; unrecorded secret doors are rejected. Unsafe old imports may therefore fail explicitly. The importer retains a separate strict version-1 schema, so existing files still import and retain their original schema version, geometry, and fields. Version-2 files require an updated reader. Legacy editor settings use three-tile spacing, rectangular rooms, and no separately requested rare-shortcut pass until changed. Generator 2.0.0 creates different layouts from version 1.0.0; stored JSON is the way to preserve an old floor exactly.

Classic's existing rendering colors, rock recipe, walls, regular doors, and staircase symbols remain unchanged; hidden doors add an S symbol. It automatically shows new geometry because both views render the same authoritative tile grid.
