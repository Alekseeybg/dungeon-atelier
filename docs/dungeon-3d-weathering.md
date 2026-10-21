# Selected brazier, flame flicker, and masonry wear

This milestone applies the third torch model (B, the wall brazier) in the development 3D prototype. Its cup now has a real inner lip and wall thickness, raised exterior ribs, rim rivets, crown prongs, a curved forged support, and individual glowing coal fragments. Existing torch mounting positions, warm light placement, and the eight-light budget are preserved.

The flame shader adds gentle lateral sway, changing contours, and small opacity variation. World position gives torches different phases. Geometry and materials remain merged; frames update at up to 30 fps while the document is visible. **Flame flicker** disables animation, and reduced-motion preference starts it disabled. The static amber lights do not pulse. PNG capture freezes the flame at a reproducible time so exports and regression comparisons remain deterministic. No water/lava or unrelated animation is introduced.

Door surrounds are thinner (0.10 instead of 0.18 units per jamb), almost flush with the wall (0.65 instead of 0.74 units deep), and built from the same material as the surrounding masonry. Their courses follow the wall-course height; the header is bonded wall stone rather than a contrasting frame strip. The selected ironbound leaf and broad pale threshold remain.

Wall bonding now keeps the same unit through alternate courses instead of changing block width every row. Value grouping uses a smooth seeded field in world space rather than abrupt regional steps. A separate body-only shader adds sparse branching cracks, restrained neutral dirt near the base and in vertical streaks, and patchy olive moss in damp regions. Wear continues through masonry boundaries and onto the selected door surround. Cap generation, cap textures, and cap material parameters are unchanged.

[Room](../reports/dungeon-3d-assets-weathering/after-room-inspection.png) · [Door](../reports/dungeon-3d-assets-weathering/after-door-closeup.png) · [Brazier](../reports/dungeon-3d-assets-weathering/after-torch-closeup.png) · [Wall detail](../reports/dungeon-3d-assets-weathering/after-wall-variation.png) · [Gallery](../reports/dungeon-3d-assets-weathering/index.html).

Validation:

- Unit tests cover coherent bonding, seeded field continuity, sparse branched crack paths, and existing floor geometry behavior.
- The main browser verifier checks directional closed/open door clearances, wall-height rebuild resources, 32/64 generated maps, stairs, concealment, Canvas parity, and cleanup.
- The polish verifier compares cap geometry/material fingerprints with the preserved baseline, camera gestures, lighting ON/OFF frames, and deterministic exports.
- `node scripts/verify-flame-animation.mjs` checks advancing animation time, distinct captured flame frames, reproducible fixed-time images, the off toggle, and reduced-motion startup. Its captures and report live in `reports/dungeon-3d-assets-weathering`.
- TypeScript, ESLint, formatting, unit suite, and production build are checked. The production Canvas renderer is unaffected.
