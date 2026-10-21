# Staircase identification — Three.js

Removed the permanent brass chevrons and their floor plaques. The staircase stone geometry, materials, fitted bays and logical directions remain unchanged. No dungeon data, connectivity or saved-format changes were made.

Hover a visible staircase to see **Stairs Up** or **Stairs Down**. Click/tap it to retain the label, or select a staircase through the existing **Inspect** selector. Escape clears selection; clicking another surface also clears it. Panning and rotating do not select stairs. Labels stay upright and follow the view; walls occlude hover picking normally. At most one compact label appears, and the idle view has no markers. PNG export continues to capture the clean dungeon without the temporary interface label.

No level number is inferred: this prototype does not resolve destination-level metadata.

## Comparison screenshots

| Stair/view                 | Previous floor arrow                                             | Selected label                                                 | Clean, unselected view                                               |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Up, tilted                 | [Before](../reports/stair-indicators/before-up-tilted.png)       | [After](../reports/stair-indicators/after-up-tilted.png)       | [Clean](../reports/stair-indicators/after-up-tilted-clean.png)       |
| Up, high angle / rotated   | [Before](../reports/stair-indicators/before-up-high-angle.png)   | [After](../reports/stair-indicators/after-up-high-angle.png)   | [Clean](../reports/stair-indicators/after-up-high-angle-clean.png)   |
| Down, tilted               | [Before](../reports/stair-indicators/before-down-tilted.png)     | [After](../reports/stair-indicators/after-down-tilted.png)     | [Clean](../reports/stair-indicators/after-down-tilted-clean.png)     |
| Down, high angle / rotated | [Before](../reports/stair-indicators/before-down-high-angle.png) | [After](../reports/stair-indicators/after-down-high-angle.png) | [Clean](../reports/stair-indicators/after-down-high-angle-clean.png) |

[Hover: up](../reports/stair-indicators/after-up-tilted-hover.png), [hover: down](../reports/stair-indicators/after-down-high-angle-hover.png). [Side-by-side gallery](../reports/stair-indicators/index.html).

## Validation

- All 155 tests pass. New pre-change fingerprints verify exact preservation of stone positions, normals, UVs and colors in both staircase forms/directions, at normal and maximum height. No arrow/plate hardware remains.
- TypeScript and ESLint pass.
- The existing 3D browser regression suite passes: 32/64 maps, open/closed portals, stair heights, camera gestures, bounded rebuild resources, secret concealment, Canvas parity and cleanup.
- `node --experimental-strip-types scripts/verify-stair-indicators.mjs` checks real hover ray hits, click selection, Escape dismissal, and the Inspect selector for up/down stairs at tilted and high-angle views with different camera rotations. Before/after generator data, presentation layouts, floor proof and approved cap fingerprints match. No browser errors.

The labels are DOM overlays; picking uses the closest actual scene surface. Stair geometry is batched separately for identification, without changing its vertices or materials. Rebuilds and viewport disposal release the geometry, event listeners and tooltip element.
