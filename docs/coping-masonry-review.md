# Coping masonry and upper-edge profile study

This is an approval-stage extension of the existing four-door demonstration. The primary target is the realistic mockup's readable, chipped coping lip. Floor materials and the mirrored-floor repetition system are preserved.

Open `/#/visual-foundation?coping=compare`, or enable **Compare cap masonry**. The three panels show the current cap, heavy hewn coping, and broken ancient slabs. **1× review** displays the room with 32×26-pixel ground cells; **2× review** enlarges it with scrolling inside each panel. The **South coping edge** view isolates the front rim and doorway. Masonry treatment switches Ancient Ruined Dungeon / Medieval Fortress without changing geometry.

## Inspection findings

The preceding cap was a continuous mirrored texture clipped to a uniform 20-unit strip, with 6-unit connecting arms. Its effects preserved alpha coverage. That convention could improve plane separation but could not create individual block outlines, deeper physical joints, overhangs or chipped silhouettes.

The current Canvas system can support those shapes without an engine migration or a projection change. It needs a different top assembly plus an actual coping edge beneath it. The prototype uses the same affine projection and top elevation, with a short fascia descending toward the existing wall. The original vertical-face artwork remains in place; the coping lip overlaps its upper few pixels as part of the new cap assembly. Door panels, thresholds, torch placement and light fields retain their existing rules.

## Treatments

| Treatment            | Stone assembly                                                                              | Upper-edge character                                                              |
| -------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Current              | Existing fitted cap texture and outline, earlier effects disabled for comparison            | Uniform strip; reference baseline                                                 |
| Heavy hewn           | Typically 26–35-unit blocks, approximately 23–24 units wide, restrained alignment variation | Chipped tops, clear joints, worn directional bevel and 2.8-pixel projected fascia |
| Broken ancient slabs | Typically 38–51-unit blocks, approximately 25–27 units wide, stronger controlled offsets    | Fewer larger slabs, broader fractures, irregular corners and a 3.8-pixel fascia   |

Short run remainders merge into the final block. Corners, intersections and doorway caps reserve separate bonding stones. A dark continuous bedding core maintains structural coverage between chipped stones. Top stones span logical tile boundaries; they are assembled and resampled once in a shared field before display-atlas slicing. The bevel follows the field's actual alpha contour, so it does not restart at each logical cell edge. The fascia is a projected extrusion of that contour, with intermediate stone values between the cap top and wall face. It is not a cast shadow.

The normal-room comparisons use the same floor, view, closed doors and lighting. The previous subtle cap-effects experiment is disabled in this comparison. Existing floor-contact and broad floor-edge layers are held constant.

## Evidence

- [Ancient Ruined Dungeon · normal zoom](../reports/visual-foundation/coping/ruins-room-lit.png)
- [Medieval Fortress · normal zoom](../reports/visual-foundation/coping/fortress-room-lit.png)
- [Ruins · south coping edge](../reports/visual-foundation/coping/ruins-coping-edge-lit.png)
- [Fortress · south coping edge](../reports/visual-foundation/coping/fortress-coping-edge-lit.png)
- [Ruins · wall corner](../reports/visual-foundation/coping/ruins-wall-detail-lit.png)
- [Ruins · south-east corner](../reports/visual-foundation/coping/ruins-south-east-lit.png)
- [Ruins · connection coupon](../reports/visual-foundation/coping/ruins-connections.png)
- [Fortress · connection coupon](../reports/visual-foundation/coping/fortress-connections.png)
- [Machine report](../reports/visual-foundation/coping/report.json)

Each image reads current / hewn / broken from left to right. Lit/unlit variants, east walls, both doorway axes, whole layouts and responsive UI captures are in the same directory. The separate connection coupon exercises straight runs, inside/outside corners, end stones, T junctions and cross intersections. It does not alter the four-door layout.

## Source art

Two new 1448×1086 RGBA sheets contain 12 isolated overhead stone tops each:

- `apps/dungeon-atelier/src/assets/visual-foundation/coping-ruins-blocks-v1.png`
- `apps/dungeon-atelier/src/assets/visual-foundation/coping-fortress-blocks-v1.png`

Created with built-in **image_gen**. [Prompt provenance](../apps/dungeon-atelier/src/assets/visual-foundation/coping-provenance.json) records the final prompts and sources. The first ruin image had incompatible front thickness and a backdrop; it was rejected and never integrated. Accepted tops use real alpha and the renderer's fixed projection. No new floor, door or vertical-face textures were made. Both geometry treatments reuse each family's stone sheet.

## Preservation, verification and stop point

Run `npm run verify:coping` with the development server running. The verifier checks all seven floor-art SHA-256 hashes against the captured pre-study manifest, deterministic rerenders, immutable fixture data, identical accepted baseline pixels, unchanged floor-contact/interior-floor pixels, and unchanged architecture below the short coping lip. It checks opaque structural joins, exact continuous-field/sliced-field agreement, both masonry families and the three-panel UI at desktop/mobile sizes. Pure model tests cover run ordering, phase across cells, bounding, junction/door run breaks and the difference between treatment scales.

No generation, collision, logical-grid, production rendering theme or four-door layout changes are part of this study. No full wall sprite-variant pack has been generated. These are two reusable stone-top source sheets and a fixture assembly experiment.

**Stop for visual approval here.** The new edge profiles are deliberately visible at normal zoom. Before a production rollout, choose a profile and judge whether the broken version's slab scale and joint depth are too strong. Junction bonding stones still use a clipped shared shape; a selected direction may benefit from hand-tuned corner/door-adjacent assets later. No expansion is implied by this prototype.
