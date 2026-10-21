# Ancient Ruins — rule-based wall and cap placement

Ancient Ruins is now the default in the testing playground. Restored Crypt remains selectable; production Canvas defaults and saved dungeon data are unchanged.

## Placement rules

- **Wall runs:** reuse the renderer's existing collinear segments and bonded courses. Each run chooses a small quarry family; wear changes in patches of roughly three world units and two courses rather than independently on every block. Grain stays aligned with the courses.
- **Coherent neighbors:** stone crops have a restrained shared value range. A smooth world-space field controls broader regional tone across runs and corners. Large local contrast jumps and arbitrary rotations are removed.
- **Rarity:** the initial weighted choice is 57% quiet, 38% medium, 4.4% strong, 0.6% hero. Placement constraints further reduce strong/hero frequency; the result does not force dramatic cracks into every room.
- **Wall damage:** strong defects stay away from run ends and cannot stack or crowd one another within a run. Heroes require long runs and an additional rare run-level gate.
- **Cap topology:** straight chains, corners, and edge transitions/lintels use separate texture pools. Corner motifs turn with the corner; straight-run grain follows its axis. Transitions and the ends of straight chains stay quiet or moderately worn.
- **Cap spacing:** strong defects have a four-tile exclusion radius across all runs, including around corners. Heroes require a long straight run and a ten-tile exclusion radius. Crack motifs terminate within their own stone, avoiding accidental pairings across joints.
- **Calm base:** the rule atlas uses restrained mineral interiors. Strong motifs are explicitly confined to their rare pool instead of inheriting large cracks from arbitrary photographic crops. The previous unstructured crack overlay is suppressed only on rule-tagged wall/cap faces; coherent dampness and patina remain.

In the default 32×32 dungeon, these rules produce 105 quiet, 85 medium and three strong cap placements, with no hero. Wall placements contain 1,936 quiet, 608 medium and six strong blocks. Counts vary deterministically with the seed and available run lengths.

## Preservation

The original geometry, normals, UVs and colors are retained. Additional Ancient-only material attributes select the rule pool. Restored Crypt ignores them. Approved cap geometry and room-facing chamfers are unchanged.

The legacy Ancient atlas cells remain intact alongside the new rule cells, so doors and staircase foundations still sample their existing stone. Floor materials, door and torch models, stair models, lighting and generation are unchanged. Verification compares the preserved texture fingerprints, not just the generator data.

## Comparisons

[Before/after gallery](../reports/ruins-placement/index.html).

| View          | Before                                               | After                                               |
| ------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Wall close-up | [Image](../reports/ruins-placement/before-walls.png) | [Image](../reports/ruins-placement/after-walls.png) |
| Cap close-up  | [Image](../reports/ruins-placement/before-caps.png)  | [Image](../reports/ruins-placement/after-caps.png)  |
| Full area     | [Image](../reports/ruins-placement/before-area.png)  | [Image](../reports/ruins-placement/after-area.png)  |

The views use the same seed, camera, zoom, height and lighting. [Placement report](../reports/ruins-placement/after.json).

## Validation

All 161 tests pass. New tests cover cap topology pools, global damage exclusion radii, calm transitions, deterministic and order-independent planning, smooth neighbor values, wall bonding/relief preservation, defect stacking, correct atlas orientation and unchanged original geometry attributes. App typecheck, ESLint and production build pass.

The dedicated browser verifier checks the Ancient default, unchanged generation/stairs/cap geometry, unchanged legacy stone/floor fingerprints, and shader/console errors. Older preservation verifiers explicitly select Restored Crypt so their baselines remain meaningful after the default changes.

The theme browser suite passes, including exact Restored Crypt baseline images and repeated palette switching. The established 3D regression suite also passes for 32/64 maps, door portals, stair heights, camera gestures, bounded rebuild resources, secret concealment, production Canvas parity and cleanup.
