# Structural readability — four-door room

This pass adds shared surface-response and edge rules to the isolated visual-foundation renderer. It uses the existing raster assets. Generation, movement, floor artwork, room layout, wall height, projection, and doorway placement are unchanged. Production editor themes remain untouched.

The subsequent [realistic floor pass](realistic-floor-review.md) changes the selected floor source and its gentle perimeter grading. Surface-separation rules remain intact. Current captures use that floor by default; the preceding source and generated alternatives remain available through Floor study.

Open [the review page](http://localhost:9000/#/visual-foundation). **Structural separation** is on by default for all three material sets. Toggle it off for the preceding appearance. **East wall detail** and **South-east corner** provide fixed close-ups; A/B comparison uses the same view, state, and lighting for both materials. Previous materials plus separation off reproduces the preceding prototype treatment.

## Rules

1. **Preserve the floor albedo and its phase.** The irregular floor field is unchanged. Only narrow contact areas receive additional occlusion.
2. **Give stone surfaces a role-dependent value response.** At material sampling time, wall-cap luminance follows `22 + 200 × (Y/255)^0.76`; wall-face luminance follows `5 + 97 × (Y/255)^0.84`. `Y` is display-space Rec.709-weighted RGB luminance. A restrained portion of the original color variation is retained. This creates a lighter cap and a darker stacked masonry face while preserving their authored pattern. Mortar remains relatively dark. Warm lighting is applied afterward, so these are material responses, not absolute limits on final illuminated pixel values.
3. **Define the coping perimeter.** A fine light arris on north/west contours and a darker arris on south/east contours describe the cap as a raised structural band. These contours come from the connected cap geometry. No lines are drawn at joined tile boundaries or along internal rectangle seams.
4. **Occlude the visible floor/architecture junction.** Build one alpha silhouette from the complete projected architecture, blur it narrowly, remove its solid interior, then clip the remaining band to the floor drawing coverage. This adds a contact band at visible raised-cap edges as well as wall bases. It fixes the east/south case where a ground-level shadow alone is hidden under the raised cap.
5. **Keep occlusion stable under lighting.** Composite this floor-only contact band after the warm light contributions. It does not darken the wall itself or add a halo over the void. Open doorway alpha remains an opening, and neighboring walls share one silhouette rather than accumulating independent tile shadows.

The cap uses fitted coping art, the face retains horizontal masonry courses, and the floor retains organic flagstones. No new texture generation, random cracks, decorative clutter, or projection adjustments are involved. Door frames retain their authored material treatment, recess, thresholds, and positions.

## Rendered results

| View                          | Ancient Ruined Dungeon                                                             | Medieval Fortress                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Full room                     | [A room](../reports/visual-foundation/readability/ruins-room-after.png)            | [B room](../reports/visual-foundation/readability/fortress-room-after.png)            |
| East wall                     | [A east](../reports/visual-foundation/readability/ruins-east-wall-after.png)       | [B east](../reports/visual-foundation/readability/fortress-east-wall-after.png)       |
| South-east corner             | [A corner](../reports/visual-foundation/readability/ruins-south-east-after.png)    | [B corner](../reports/visual-foundation/readability/fortress-south-east-after.png)    |
| Unlit corner                  | [A unlit](../reports/visual-foundation/readability/ruins-south-east-unlit.png)     | [B unlit](../reports/visual-foundation/readability/fortress-south-east-unlit.png)     |
| Neutral gray floor diagnostic | [A gray floor](../reports/visual-foundation/readability/ruins-south-east-gray.png) | [B gray floor](../reports/visual-foundation/readability/fortress-south-east-gray.png) |
| Pre-pass corner               | [A before](../reports/visual-foundation/readability/ruins-south-east-before.png)   | [B before](../reports/visual-foundation/readability/fortress-south-east-before.png)   |

The diagnostic substitutes an untextured RGB(105,105,105) floor only for verification. This puts the floor close to the cap's average value, making the geometry-derived separator easier to assess without differences in paving pattern. It is not a new selectable floor style, and no cached material is mutated.

These are actual Canvas exports. Detail crops enlarge the same rendered pixels used by the review page. Floor, cap, and face remain textured materials with overlapping individual pixel values; the rule is a stable plane hierarchy plus a local structural edge, not a claim that every cap pixel is brighter than every floor pixel.

## Verification

`npm run verify:readability` checks all three material sets. It compares unchanged interior floor pixels before/after, samples unlit plane values, checks contact alpha on all four sides and the south-east corner, confirms the interior receives no extra contact, verifies the neutral floor probe reaches the renderer, and exercises the separation toggle and new detail views. It captures before/after/unlit/gray-floor images. See [the report](../reports/visual-foundation/readability/report.json).

Mean unlit luminance in the fixed east-wall sample regions, on a 0–255 display scale:

| Material           | Floor |   Cap | Vertical face |
| ------------------ | ----: | ----: | ------------: |
| Ruins              |  79.3 | 102.1 |          33.2 |
| Fortress           |  79.3 | 118.2 |          42.6 |
| Previous materials |  79.3 | 100.5 |          28.6 |

These measurements describe the sampled fixture, not a universal art-quality score. Pure tests separately verify monotonic plane responses and correct exposed contours for every valid connection/corner-fill combination. Existing masonry/foundation browser checks cover door states, secret concealment, export, and responsive controls.

This report records the original four-door review. The approved treatment now ships in Ancient Ruined Dungeon; see [production visual integration](production-visual-integration.md). Stone and Classic remain available, and the former Dimensional Stone theme has been removed.
