# Four-door masonry review — A / B

These are **isolated material candidates**, pending visual approval. Open [the visual review](http://localhost:9000/#/visual-foundation) with the development server running. Select A, B, or Previous prototype; Compare A / B shows identical crops and states together. Existing production themes are unchanged.

The current version adds [shared floor/cap/face separation rules](plane-separation.md). The former prototype sources are labeled Previous materials; toggle Structural separation off to inspect their preceding appearance. Both A and B use the same new rules by default.

## Rendered deliverables

All images are exported from the actual review-page Canvas renderer. The room images are 832 × 780 pixels. Door and corner details enlarge that same raster; they are not separately generated mockups.

| View                    | A — Ancient Ruined Dungeon                                                    | B — Medieval Fortress                                                            |
| ----------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Complete four-door room | [A room](../reports/visual-foundation/masonry/ruins-room-closed.png)          | [B room](../reports/visual-foundation/masonry/fortress-room-closed.png)          |
| North / south doorways  | [A N/S](../reports/visual-foundation/masonry/ruins-doors-ns-closed.png)       | [B N/S](../reports/visual-foundation/masonry/fortress-doors-ns-closed.png)       |
| East / west doorways    | [A E/W](../reports/visual-foundation/masonry/ruins-doors-ew-closed.png)       | [B E/W](../reports/visual-foundation/masonry/fortress-doors-ew-closed.png)       |
| Wall corner / face      | [A corner](../reports/visual-foundation/masonry/ruins-wall-detail-closed.png) | [B corner](../reports/visual-foundation/masonry/fortress-wall-detail-closed.png) |
| Unlit room              | [A unlit](../reports/visual-foundation/masonry/ruins-room-unlit.png)          | [B unlit](../reports/visual-foundation/masonry/fortress-room-unlit.png)          |
| Open doorways           | [A open](../reports/visual-foundation/masonry/ruins-room-open.png)            | [B open](../reports/visual-foundation/masonry/fortress-room-open.png)            |

[Side-by-side comparison](../reports/visual-foundation/masonry/comparison-a-b.png) · [Doorway and corner detail board](../reports/visual-foundation/masonry/details-a-b.png) · [Previous prototype](../reports/visual-foundation/masonry/original-room-closed.png) · [Browser verification](../reports/visual-foundation/masonry/report.json)

## What changed

The previous material cropped the face courses out of a combined coping/profile painting. Its regular bevels and slanted marks read as overlapping roof panels after projection. The replacement face artwork is a complete **frontal elevation of staggered masonry**, without painted top planes. Dedicated overhead cap artwork supplies the coping. The existing affine projection and connectivity masks apply both materials.

A uses broader irregular capstones, eroded block faces, deeper uneven joints, and restrained olive age staining. B uses more ordered rectangular ashlar, dressed edges, and a slightly warmer, more deliberate construction. Both preserve the existing `flagstone-field-v1.png` floor, source phase, room dimensions, torches, wall silhouettes, door positions, height, and viewing direction. The central floor patch is pixel-identical across A, B, and the preceding prototype, including lighting.

The doorway uses the continuous wall-face field as its backing, with the same global texture phase as adjoining masonry. The generated frame's side-wall area is cropped away, leaving its arch and jambs. A narrow alpha blend at the outer stone edges joins those to the backing. A measured aperture mask removes the backing inside the opening, so an open arch is transparent rather than a black rectangle painted over the floor.

Both frames use the **same intended granite family as their variant's wall and coping**, though separate generated sources do not constitute exact stone-by-stone bond continuity. The cap remains connected above the opening. The wood sits slightly inside the aperture, with a narrow dark reveal and a restrained shadow below the arch. Each doorway also has a separately painted worn sill on the existing ground plane. Only the overhead sill turns to fit the ground footprint; the completed door assembly is not rotated.

The improvement is a **combination of source materials and doorway-sprite construction**: new faces, caps, frame sources, and sills, plus aperture masking, continuous wall backing, local feathering, and recessed leaf compositing. No new procedural stone/noise generator, projection, or engine was introduced.

## Source inventory and provenance

Saved assets: `apps/dungeon-atelier/src/assets/visual-foundation/`. These PNGs are source masters, sampled by the isolated renderer; they are not logical cell-sized sprites.

| Files                                         | Source pixels | Alpha / alignment                                                              | Sampling                                                                                      |
| --------------------------------------------- | ------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `ruins-face-v2.png`, `fortress-face-v2.png`   | 2172 × 724    | Opaque, frontal elevation; horizontal courses                                  | Entire source → 128 × 24 world units; mirrored horizontal repeat                              |
| `ruins-cap-v2.png`, `fortress-cap-v2.png`     | 1254 × 1254   | Opaque, overhead stone surface                                                 | 128 × 128 world units; mirrored periods; shared world UV                                      |
| `ruins-frame-v2.png`, `fortress-frame-v2.png` | 1697 × 927    | True alpha outside panel and inside arch; front elevation, bottom at wall base | Alpha-trimmed, cropped around measured opening and jambs; composited into a 44 × 24 wall face |
| `ruins-sill-v2.png`, `fortress-sill-v2.png`   | 2172 × 724    | True alpha outside stone; overhead                                             | Alpha-trimmed → 30 × 10 ground units at the visible doorway baseline                          |

The built-in **image_gen** tool generated all eight source images, using the user's atlas as a material/style reference. [masonry-prompts-v2.json](../apps/dungeon-atelier/src/assets/visual-foundation/masonry-prompts-v2.json) records the complete prompts, provider, reference, and filenames. The floor, oak leaf, and sconce sources are reused unchanged. Previous source masters remain available through Previous prototype.

Logical cells remain 32 × 32. Visual cells remain 32 × 26, with the same height vector `(-6,-24)`, sprite display canvas 50 × 60, source slot 100 × 120, and display anchor `(12,29)`. Full projection and architectural rules remain in [visual-foundation.md](visual-foundation.md).

## Limits and approval boundary

- Narrow east/west faces compress the frame and leaf into a slim profile. They retain the accepted directional construction but are less legible than north/south doors; dedicated profile paintings would allow more control.
- Material periods still repeat. Mirroring closes seams but can produce recognizable reflected pairs. This is not a complete authored corner/end/transition sprite pack.
- Silhouettes and cap-to-face stone bonds remain defined by the existing compositor. Chips are painted into the materials; they do not change collision or wall contours. Frame masonry matches the family and palette, rather than every neighboring joint.
- A is an aged, eroded surface treatment, not broken architecture or missing wall blocks. B is more orderly, but remains heavily weathered to suit the existing floor.
- The reused leaf remains visually busy in enlarged details. Open state is an empty opening, without hinges or animation.

## Verification

With the development server running, execute `npm run verify:masonry` from the repository root. It captures the room and details in closed/open/unlit states for all three treatments, exercises A/B selection and comparison, and checks desktop/mobile layouts. It also verifies deterministic output, no mutation, distinct material results, identical central floor pixels, every directional leaf's visible state change, and secret concealment against an independently sealed twin.

Run `npm run verify:foundation` for the existing grid, lighting, secret, baseline comparison, and PNG-download controls. Standard checks remain `npm test`, `npm run typecheck`, `npm run lint:check`, and `npm run build`.

No generation, routing, room placement, stairs, serialization, movement, collision, or production renderer behavior is changed. Stop here for visual review; map-wide integration requires the user's approval.
