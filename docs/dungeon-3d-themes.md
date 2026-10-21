# Restored Crypt and Ancient Ruins

The Three.js playground now has a **Visual theme** selector. **Restored Crypt** preserves the previous clean limestone appearance. **Ancient Ruins** is now the playground default for ongoing work. **Ancient Ruins** carries the supplied Ancient dungeon reference into the same real 3D scene.

The subsequent [rule-based wall/cap placement correction](ruins-placement.md) replaces local surface shuffling with connected-run pools and spaced defects. The paired views below also serve as the theme-preservation checks.

## Visual design

Ancient Ruins uses the full broad-slab, weathered-flagstone and irregular-flagstone images used by the reference, instead of Restored Crypt's softened stone-interior crops. Floor color, relief and roughness use world coordinates, so the organic joints continue across mesh and tile boundaries. A region-aware recessed stone bed follows the same material assignments, avoiding a second rectangular paving grid. Existing slab bodies supply physical depth; Ancient's floor shading suppresses the clean rectangular bevel highlights. No vertices, indices or collision surfaces change when selecting a theme.

Walls use independently cropped aged masonry with proportions suited to the actual 3D blocks. Caps retain the approved room-facing chamfer and chips, with a new cracked, weathered stone surface. Stair treads, foundations and dark slab edges reuse the approved models with matching Ancient stone. Mineral grain, fractures, recessed organic joints, restrained moss and coherent seeded grime replace the clean limestone look. Source chroma is tempered to keep the underground stone grey rather than uniformly brown.

Doors and sconces retain their existing models and materials. Ancient Ruins lowers ambient, key and fill illumination while preserving the warm amber torch lights and the existing lighting/shadow controls. Restored Crypt's lighting values are unchanged. Neither theme changes camera settings.

## Separation and preservation

- `materials.ts` remains the original Restored Crypt material factory, unchanged by this milestone.
- `theme-materials.ts` owns separate Ancient textures/materials and disposes them with the viewport. It never edits Restored textures or Canvas source images.
- `themes.ts` registers theme names and lighting presets. `theme-binding.ts` binds named palettes to canonical material slots, including after height/door rebuilds. Additional palettes can use this binding without copying the renderer.
- Selecting a theme swaps material references and light intensities. It does not call generation, rebuild meshes, move stairs, change camera/zoom, or update saved dungeon/editor settings.
- Seeded atlas patina, existing regional assignments and continuous world-space wear remain deterministic. Repeated switches reuse the same palette resources.
- The Canvas appearances, production routes and production defaults remain unaffected. Theme selection belongs to this playground only.

## Comparisons

All pairs use seed `side-door-readability-0` with identical camera, zoom and geometry. The scene is actual Three.js geometry, not a projected Canvas screenshot.

[Side-by-side comparison gallery](../reports/dungeon-3d-themes/index.html).

| View                     | Restored Crypt                                                       | Ancient Ruins                                                       |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Full dungeon             | [Image](../reports/dungeon-3d-themes/restored-crypt-full.png)        | [Image](../reports/dungeon-3d-themes/ancient-ruins-full.png)        |
| Walls and chamfered caps | [Image](../reports/dungeon-3d-themes/restored-crypt-walls-caps.png)  | [Image](../reports/dungeon-3d-themes/ancient-ruins-walls-caps.png)  |
| Floors                   | [Image](../reports/dungeon-3d-themes/restored-crypt-floors.png)      | [Image](../reports/dungeon-3d-themes/ancient-ruins-floors.png)      |
| Stairs Up                | [Image](../reports/dungeon-3d-themes/restored-crypt-stairs-up.png)   | [Image](../reports/dungeon-3d-themes/ancient-ruins-stairs-up.png)   |
| Stairs Down              | [Image](../reports/dungeon-3d-themes/restored-crypt-stairs-down.png) | [Image](../reports/dungeon-3d-themes/ancient-ruins-stairs-down.png) |

## Validation

- All **158 tests** pass, including repeated material round trips, unchanged mesh/buffer identity, preserved original palette properties, rebuilt-architecture binding, seeded crop bounds and existing stair geometry fingerprints.
- App typecheck and ESLint pass.
- The production build and established Three.js browser regression suite pass, including camera gestures, portals, stair geometry, bounded rebuild resources, secret concealment, Canvas parity and viewport cleanup.
- `node --experimental-strip-types scripts/verify-dungeon-3d-themes.mjs` verifies all five Restored Crypt PNGs match their pre-change baseline byte-for-byte, including when returning from Ancient Ruins. It checks actual mesh/geometry UUIDs, source dungeon data, floor geometry identity and camera/zoom stay fixed during switching.
- The same browser verifier checks bounded GPU texture/geometry counts through repeated switches, working torch lighting, retained theme after a wall-height rebuild, reproducible same-seed material fingerprints and different patina with a different seed. No browser errors were reported.
- [Baseline and final verification records](../reports/dungeon-3d-themes/report.json) retain the camera settings, source data and material fingerprints.

Browser verification uses a single headless session at a time with a temporary workspace profile on D:, cleaned up after each run.
