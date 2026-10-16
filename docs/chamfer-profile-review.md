# Cut-stone coping and inner/outer chamfers

This supersedes the projecting-lip interpretation of the preceding coping study. The target is **flat top → sloped facet → vertical wall face**, on every exposed inner and outer contour. The current comparison refines the stones' cut geometry and joints while retaining the same chamfer profile. The previous muted chamfered version remains available as the baseline; the older heavy-hewn assembly remains in the separate masonry comparison.

Open `/#/visual-foundation?profile=chamfer`, or press **Show chamfer comparison** in the prominent notice at the top of the ordinary demo page. Both panels use the same four-door room, floor, camera, cap profile, door state and torch lighting. The left panel is the previous chamfered cap; the right is the chiseled coping treatment. Shared profile URLs also activate the comparison when the page is already mounted. **Save comparison PNG** exports both panels with labels.

## Geometry

The cap top stays at the existing 24-unit wall height. Each exposed edge has a 7.5-ground-unit-wide angled plane that drops 1.5 height units to the original vertical boundary. Cutting both edges of a straight 20-unit wall leaves a five-unit flat crown between them. This balances the two cuts without reducing the top to a sharp ridge. All new profile points stay at or inside the original cap footprint and at or below the original top height.

The new profile does not call the vertical-rim extrusion routine. It uses the existing canonical wall-cap footprint, eliminating the room-facing overhang. There is no added underside shadow treatment.

## Sharply cut stone refinement

The cut treatment uses squared block footprints rather than letting the source sprites' rounded alpha perimeter determine each stone's edge. It keeps the established run-wide block lengths, bonding positions and material palette. Corner, intersection and doorway bonding stones stay confined to their original cells and are clipped by the existing cap geometry. Straight stones fit the canonical 20-unit wall width.

Consistent 1.2-unit dark joints separate the stones and continue through the top and sloped surfaces at identical world-space UVs. The joint layer is restored after facet shading so it stays recessed and interrupts each stone's edge accents. Narrow, sharply drawn arrises define the blocks; restrained crease lines distinguish the top, chamfer and vertical face. The cut finish uses flat directional facet shading instead of the earlier soft gradient. No blur, sharpening filter, added cracks, noise or new damage is involved.

Existing authored stone interiors supply the material. Their rounded transparent perimeter is cropped out before mapping the artwork onto the squared footprints. Source artwork, floor images and wall-face textures are unchanged. Texture remains visible, while the block geometry and joints establish the primary shape. The older chamfer compositor is retained as `capFinish: 'soft'`; the new comparison opts into `capFinish: 'cut'`. Default renderer calls retain the previous images.

### Crack repetition correction

Independent source-image hashing allowed repeated diagonal cracks on adjacent stones, especially where straight runs meet corner and doorway bonding blocks. The cut finish now selects materials using the actual stone adjacency graph. Adjacent stones cannot share a source image; a preference against reuse within another two graph steps suppresses short repeating sequences across run boundaries. The twelve existing source images remain intact.

Each stone also receives a deterministic interior crop and texture-only quarter turn, varying the position and direction of similar cracks in different atlas images. Architectural footprints, the cap projection, shading direction and joints do not rotate. The material is assembled once in world space and then projected onto the flat top and both chamfers, so the crack remains continuous through a stone's profile. Choices depend on dungeon seed and stone bounds, and are stable under input iteration order. These rules affect only the cut cap material; the floor sampling system is unchanged.

All exposed cap contours receive the same profile, including room edges, exterior silhouettes, corridor walls and exposed ends. Connected cell borders do not acquire a bevel. Collinear edges merge across logical cells before constructing the slope, and perpendicular facets share mitred corner vertices. Each run samples the same world-space stone field as the flat top, preserving material continuity through the bend in profile. The outside treatment follows the connected wall around corridor junctions instead of drawing an artificial rectangle around the room.

The fixed viewing direction naturally gives different apparent facet widths: horizontal-wall slopes project to about 7.6 or 4.6 pixels, and side-wall slopes to 7.1–7.9 pixels at normal zoom. The light-stone overlay has been reduced from 18–40% opacity to 7–18%, and its tint has been darkened. North/west-facing facets still catch slightly more light, but the exposed edges retain more of the underlying stone's value and texture. The geometry supplies the width and UV bend; no underside shadow or projecting rim supplies the effect.

## Evidence

- [Ruins · normal zoom](../reports/visual-foundation/chamfer/ruins-room-lit.png)
- [Ruins · all four wall sides](../reports/visual-foundation/chamfer/ruins-all-sides.png)
- [Ruins · separate connection coupon](../reports/visual-foundation/chamfer/ruins-connections.png)
- [Ruins · far-wall corner](../reports/visual-foundation/chamfer/ruins-wall-detail-lit.png)
- [Ruins · east wall](../reports/visual-foundation/chamfer/ruins-east-wall-lit.png)
- [Ruins · south-east corner](../reports/visual-foundation/chamfer/ruins-south-east-lit.png)
- [Ruins · near-wall edge](../reports/visual-foundation/chamfer/ruins-coping-edge-lit.png)
- [Fortress · normal zoom](../reports/visual-foundation/chamfer/fortress-room-lit.png)
- [Fortress · all four wall sides](../reports/visual-foundation/chamfer/fortress-all-sides.png)
- [Fortress · separate connection coupon](../reports/visual-foundation/chamfer/fortress-connections.png)
- [Fortress · far-wall corner](../reports/visual-foundation/chamfer/fortress-wall-detail-lit.png)
- [Machine report](../reports/visual-foundation/chamfer/report.json)

Lit/unlit comparisons and both doorway axes are captured for both masonry styles. Normal-room images use 32×26-pixel ground cells. No floor image, door/frame/sill artwork, logical geometry, wall height, movement or generation rules were changed. The existing lower wall-face artwork remains; the profile covers its former upper corner as part of the cut.

## Verification and scope

`npm run verify:chamfer` checks the accepted previous chamfer hashes, deterministic renders, immutable four-door and connection inputs, identical interior floor and existing floor-contact layers, inner and outer contours, all four facet directions, both material families and equal-scale browser panels. It samples the facets to ensure they stay within the assembled cap footprint. Browser checks cover the prominent entry, same-page shared URLs, comparison export, and desktop/mobile layouts. Pure model tests verify that the facets stay inside the wall, share the original top elevation, meet at both convex and concave mitres, retain a flat crown between opposite cuts, remain visible under foreshortening, and map through the original projection. Additional block tests verify consistent joint widths, preserved bonding positions, immutable inputs and cell-contained corner/intersection/door blocks.

This remains a review-only cap-profile comparison. The production dungeon renderer and full wall-variant pack are unchanged. Stop here for visual approval before expanding the profile.
