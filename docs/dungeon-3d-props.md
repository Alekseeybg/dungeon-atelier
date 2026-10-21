# Door and cage-sconce mockup refinement

This is a focused follow-up to the asset milestone, using the supplied door and torch mockups as the visual direction. It runs in the existing development prototype at `/#/dev/dungeon-3d`.

- The torch now has a compact tapered six-bar iron cage, two riveted bands, a broad rectangular forged bracket, and a bolted wall plate. Its shorter charred shaft and contained fuel head replace the exposed wrapped-torch silhouette. The static layered flame is more orange, with less white overlap. Existing torch light positions and the eight-light budget are retained; amber light intensity is reduced from 5.2 to 3.6 for a gentler pool.
- The door has thicker vertical planks, broad beveled iron straps, larger rivets and ring hardware, and a calmer vertical wood-grain crop. Wider dressed stone jambs and a deeper header surround the leaf, which is centered within the wall thickness for a stronger recess on both faces. Texture coordinates now map each reveal face independently, removing stretched strips along the sides.
- Approved cap geometry, texture maps, and material parameters match the captured baseline. Generation, logical door placement, opening angle, collision, concealment, and production Canvas remain unchanged.

[Before/after gallery and gameplay views](../reports/dungeon-3d-assets-props/index.html), [door close-up](../reports/dungeon-3d-assets-props/after-door-closeup.png), [torch close-up](../reports/dungeon-3d-assets-props/after-torch-closeup.png).

Validation includes TypeScript, ESLint, unit tests, approved cap fingerprints, identical-camera torch ON/OFF comparison, camera gestures, real closed/open portal rays, 32/64 maps, stair apertures, rebuild resource bounds, production Canvas parity, and cleanup. The reference remains an art target; the prototype uses procedural meshes and reused photographic crops rather than bespoke sculpted assets.

Refresh this milestone against the running development server:

```powershell
$env:ATELIER_URL='http://localhost:9000'
$env:ATELIER_3D_REPORT_DIR='reports/dungeon-3d-assets-props'
node scripts/verify-dungeon-3d-polish.mjs
```

Keep the captured `before-*` files as the milestone baseline.
