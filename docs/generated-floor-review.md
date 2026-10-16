# Generated floor verification

The floor review precedes the wall-cap effects pass. No floor art, scale, exposure, phase, material defaults, generator, or production theme was changed.

## Coverage and evidence

- 18 real generator outputs: 32×32, 64×64, 96×96; Classic and Compact layouts; three reproducible seeds per size/layout.
- Seven floors per map: 126 rendered combinations, with 50%, 100%, and 200% room and corridor views (756 zoom views).
- Mixed rectangular/shaped rooms, chamber blocks, long corridors, turns and both door travel orientations. Inputs validated by the core validator and checked for mutation. Refined-floor rerenders matched on every map.
- [Browsable screenshot gallery](../reports/visual-foundation/generated-floors/index.html), [machine report](../reports/visual-foundation/generated-floors/report.json). Saved floor JSONs contain the complete configs and seeds. Six representative maps have all seven full-map images plus room/corridor and both doorway details. All 18 seeds have seven-material room and corridor zoom sheets; each sheet's rows are 50%, 100%, 200%. Zoom sheets hold geometry and lighting constant.
- This is generated geometry through the isolated visual-foundation renderer, not a replacement for the editor's production theme. Stair metadata is retained; this architectural preview has no stair artwork.

Representative full maps: [small / refined](../reports/visual-foundation/generated-floors/32-compact-refined-map.png), [medium / blended](../reports/visual-foundation/generated-floors/64-classic-study-blended-map.png), [large / irregular](../reports/visual-foundation/generated-floors/96-compact-study-irregular-map.png). Corridor zoom comparisons: [small](../reports/visual-foundation/generated-floors/32-classic-corridor-zoom-comparison.png), [medium](../reports/visual-foundation/generated-floors/64-compact-corridor-zoom-comparison.png), [large](../reports/visual-foundation/generated-floors/96-compact-corridor-zoom-comparison.png).

## Visual findings

| Floor                  | Recommended role                                    | Observations in generated maps                                                                                                                                                    |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refined realistic      | Default rooms and corridors                         | Calmest surface, restrained contrast and clear boundaries. Stays legible at 50%; at 200% retains believable worn slabs. Mirrored weathering remains visible in some larger rooms. |
| Previous flagstones    | Optional cooler, older-stone room family            | Smaller stones provide useful scale cues, but high-frequency crust/veins and bright patches compete with thresholds. Retain as an alternative, not the main default.              |
| Weathered flagstones   | Special ruined rooms                                | Stronger cracks, granular wear and ochre patches. Attractive close up; busier at map zoom and in narrow corridors.                                                                |
| Irregular flagstones   | Secondary ruined-room material                      | Varied shapes fit the target well. More contrast than refined; use for selected chambers or wider corridors rather than every one-cell passage.                                   |
| Broad natural slabs    | Large ceremonial/special rooms                      | Quiet surface but stones are too large to communicate scale reliably in small rooms and corridors. Repeated broad slab shapes can be conspicuous.                                 |
| Blended wear           | Secondary general room material; optional corridors | Smaller blocks remain readable and fit narrow passages better than the broad/early studies. More contrast and wear than refined; a useful runner-up for a more weathered dungeon. |
| Early large flagstones | Rare damaged/ancient chambers                       | Heavy dark joints, large fractured slabs and bright veins dominate small rooms. Strong character, weak choice for a universal floor.                                              |

These are recommendations, not new automatic material assignments. Mixing whole-field materials room by room would require a deliberate transition policy; random per-cell substitution would introduce new seams.

## Repetition and seams

There are no exposed tile-grid gaps in the representative room, corridor, turn or doorway captures. The floor is a continuous world-space field, so crossing a logical cell boundary does not restart a stone or its lighting. Existing floor skirts and architecture-derived contact shadows keep the east/south joins covered. Thresholds preserve their fitted strip and recessed contact shadow across every material. Larger-stone studies create stronger stone-size changes against those fixed thresholds, although the join itself remains intact.

**The images are not truly seamless authored materials.** The loader mirrors a 384×384-world-unit field to hide discontinuities. Reflection folds occur at world coordinates `160 + n×384` along both floor axes; the full period is 768 units / 24 tiles. Larger rooms reveal symmetrical grime, paired stones and occasional pinched mortar lines. Refined and broad are calmer overall, but even refined shows conspicuous symmetrical staining in some seeds. Previous/weathered/irregular/early make recognizable motifs more obvious. This is a visual limitation, not a passing seamlessness result.

At full-map fit, geometry reads better than fine surface differences. At 100–200%, reflection artifacts and overly large slabs become easier to judge. One-cell east–west corridors expose a narrow floor band because the existing wall height occludes much of it; this applies to all floors. Projection and wall height were intentionally preserved.

Recommended follow-up, outside this polish pass: author genuinely periodic floor fields with quieter broad weathering, or introduce a controlled macro-variation system that preserves mortar continuity. Do not scatter/rotate individual floor tiles to disguise the problem.

## Reproduce

With the development server running, execute `npm run verify:generated-floors` from the repository root. The report distinguishes automated coverage/determinism checks from the visual judgments above; it does not claim pixel metrics can certify artistic quality.
