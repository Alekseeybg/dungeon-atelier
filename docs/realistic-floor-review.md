# Realistic floor refinement — four-door room

The current target is the **realistic Ancient Ruined Dungeon half of the user's latest mockup**. The comic-book half is reserved for a future alternate theme and has no implementation in this pass. This is an isolated floor refinement, pending visual approval.

Open [the review page](http://localhost:9000/#/visual-foundation). **Floor study** offers seven materials: Refined realistic (current), Previous flagstones, Weathered flagstones, Irregular flagstones, Broad natural slabs, Blended wear, and the early Large flagstones study. The selector includes thumbnails and short descriptions. Earlier unselected studies are now available for review; they are not new production themes.

Enable **Compare floors**, choose a **Comparison floor**, and use the swap button to exchange the pair. Both panels share the same masonry, view, doors, lighting, grid, and structural separation. Floor center and Floor near wall provide detail views; South-east corner shows floor, cap, and vertical face together. Save PNG exports the primary panel and includes its floor ID in the filename. Refined realistic remains the default.

All studies retain the same field coverage and phase. Photographic sources use the existing 0.8 exposure calibration; the other sources use 1.0. The previous floor keeps its earlier appearance; other studies use the subtle floor-edge grade. [floor-study-catalog.json](../apps/dungeon-atelier/src/assets/visual-foundation/floor-study-catalog.json) maps every option to its saved source and original prompt record. All masters are stored in the project, including the four newly recovered alternatives.

## Actual rendered deliverables

- [Updated room](../reports/visual-foundation/floors/refined-room.png)
- [Floor center](../reports/visual-foundation/floors/refined-floor-center.png)
- [Floor near wall](../reports/visual-foundation/floors/refined-floor-edge.png)
- [Floor and wall](../reports/visual-foundation/floors/refined-floor-wall.png)
- [Before / after](../reports/visual-foundation/floors/comparison.png)
- [Detail board](../reports/visual-foundation/floors/details.png)
- [Unlit room](../reports/visual-foundation/floors/refined-room-unlit.png)
- [Verification report](../reports/visual-foundation/floors/report.json)

Detail crops enlarge the review renderer's actual source pixels, rather than presenting separately generated concept art.

## Art and integration

The new floor uses photographic stone wear and quieter slab interiors, with gray, umber, and cooler-gray variation between stones. Fitted smaller pieces interrupt larger slabs. Soft chipped corners, shallow erosion, and dirt-filled mortar provide age without props or decoration. Restrained olive staining stays in selected joints; the preceding large pale crusted patch is absent.

The principle is **large readable forms first, local detail second**. Center surfaces keep readable mid-values. A gentle floor-only perimeter grade supports darker edges, and the existing narrow contact band maintains architectural separation. Stone colors stay within the wall's gray/brown family, while their construction remains distinct: irregular floor slabs, fitted coping, stacked vertical masonry. Lighting is applied by the renderer.

The selected master is [flagstone-realistic-v3.png](../apps/dungeon-atelier/src/assets/visual-foundation/flagstone-realistic-v3.png), **1254 × 1254, opaque**, directly overhead. The built-in **image_gen** tool produced it. [floor-prompts-v3.json](../apps/dungeon-atelier/src/assets/visual-foundation/floor-prompts-v3.json) records selected prompts, reference roles, rejected studies, and sampling settings.

The field retains the existing 384 × 384 world-unit coverage, phase `(160,160)`, and mirrored outer periods. The main room stays within one source field. A sampling exposure multiplier of 0.8 calibrates the photographic source to the environment. The checked unlit floor sample is slightly brighter than before: 79.3 versus 71.4 on the 0–255 display-luminance scale. Matching Ruins cap and face samples remain 102.1 and 33.2.

The low-opacity perimeter grade reuses the projected union-silhouette helper with a 20-native-pixel blur and opacity 0.18, clipped to visible floor before warm lighting. It is a spatial value cue; the source supplies stone wear and joint aging. The existing narrow structural contact is unchanged after lighting. No random detail, geometry, or generation system was added.

The architectural atlas and structural-contact layer are byte-identical when switching floors. The previous floor also reproduces the preceding accepted scene hash. Projection, height, doors, layout, collision, movement, serialization, and procedural generation are unchanged. The v1 source remains intact. The new floor is used only by the isolated review, not the production editor themes.

## Limits and verification

Slab shapes remain more rectilinear and wear more even than parts of the realistic mockup. More individually eroded shapes could improve the final artwork. A full map will need compatible larger fields or authored variations to avoid reflected patterns and repetition. Dedicated traffic-path or room-purpose materials are outside this pass; comic-book styling remains a future direction.

`npm run verify:floors` captures lit/unlit results, checks determinism and no mutation, compares architecture/contact pixels exactly, pins the preceding appearance, and exercises floor comparison/detail controls. Existing readability checks cover all three wall sets, plane values, all four contacts, the south-east corner, and a neutral-floor diagnostic. Foundation/masonry checks cover doors, concealment, export, and responsive layouts. Standard checks remain `npm test`, `npm run typecheck`, `npm run lint:check`, and `npm run build`.

Stop at the four-door review. Broader integration requires the user's visual approval.
