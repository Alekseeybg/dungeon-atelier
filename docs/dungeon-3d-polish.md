# Three.js prototype: masonry, lighting and camera polish

The prototype remains at `/#/dev/dungeon-3d` on the running development server. This milestone changes only the experimental Three.js renderer, its page, verification scripts and documentation. Existing generator algorithms, floor data, original art files, production Canvas rendering and saved appearances are unchanged.

## Materials and structure

The initial masonry combined a dark painted elevation with real shading, dark hemisphere ground fill and per-wall color multiplication. Its world-mapped painted mortar also crossed the separate relief blocks. Brightening that composite made its repetition and mismatched joints more apparent.

The final wall finish uses a 512² in-memory atlas of sixteen stone-interior crops from the existing `ruins-face-v2.png`. Crops avoid the source's painted course joints. Each actual block receives a deterministic atlas choice and restrained tint; geometry supplies the recessed joints and shallow chiseled edges. Collinear wall boundaries merge before laying the courses, removing artificial stone splits at logical tile borders. A matte recessed mortar core preserves the original continuous wall footprint. The exposed stone fronts use ten triangles each, replacing twelve-triangle boxes; they still merge into one material batch. Bump amplitude is reduced to avoid noisy, crumpled-looking faces.

Coping retains the original connected footprint and Ancient artwork. Its texture scale, luminance and material tint distinguish it from the floor. The thicker cap has a sharp physical bevel, shallow joints between coping units and a projecting narrow fascia. Corner and branch shapes still follow the original wall plan. Door leaves sit slightly nearer the opening face; timber grading and more diffuse worn iron improve their readability without changing the portal or hinge behavior. Stair geometry and floor textures are retained.

Original assets are reused, not overwritten. Floors retain their existing world UVs, image exposure and regional assignments. Neutral fill, local torch light and real shadows can change their rendered appearance.

## Lighting diagnosis and fix

The old toggle was functional, but a 1.3-candela inverse-square point light was weak relative to the neutral scene lighting. Selecting only the first eight torches also left later sconces without a local light, even when inspected closely. This made the toggle appear ineffective in some views.

The revised pool still has at most eight lights, now selected nearest the camera target. Focusing or panning toward another area reuses the same slots. Each light uses 8.5 candela, warm `#ffc58a`, decay 2 and a smooth 5.5-unit cutoff. Local lights cast no additional shadow maps. Neutral hemisphere ground fill and a lower directional fill make unlit vertical faces readable; the existing directional shadow map and wall-contact gradients remain. Flames stay visible when local illumination is disabled. No bloom, particles or animation were added.

The same-camera ON/OFF comparison measures changes to surfaces while geometry and flame colors stay fixed. The original room had about 98,000 pixels changing by more than three RGB levels, with a whole-image mean absolute difference of 0.87 levels. The final capture has about 304,000 changed pixels and a mean difference of 5.13 levels. This is an image-difference measurement, not a physical brightness calibration. The screenshots are the primary visual evidence.

Point lights can still bleed across nearby ordinary walls because they do not cast shadows. Only the nearest eight sconces illuminate surfaces at once, so distant full-map views do not light every torch simultaneously. Concealed architecture is removed before torch planning as before.

## Mouse controls

| Action                | Behavior                                                          |
| --------------------- | ----------------------------------------------------------------- |
| Left drag             | Pan on the horizontal dungeon plane, relative to the current view |
| Middle drag down / up | Raise / lower camera elevation, following the requested inversion |
| Right drag            | Rotate horizontally around the current target                     |
| Wheel                 | Zoom, bounded to 0.5–8×                                           |

The default stays at 68° elevation and 12° reference azimuth. Elevation now spans 35°–90°, with a tiny internal pole epsilon to preserve a stable right vector at overhead. Horizontal rotation can cover a full turn; the diagnostic slider displays ±180° around the reference azimuth. Rotation sensitivity is 0.25° per pixel. Reset restores the default view and full-map framing.

OrbitControls continues to own pan, wheel zoom and touch. A small pointer adapter separates middle-button elevation and right-button azimuth, which the stock mouse mapping cannot separate by itself. It uses pointer capture and ends on release, cancellation, lost capture, blur or disposal. Secondary button combinations do not start another gesture. Context menus, auxiliary clicks and wheel page scrolling are suppressed inside the viewport. Sliders synchronize with mouse changes; geometry is not rebuilt for camera movement. See the [official OrbitControls interface](https://threejs.org/docs/pages/OrbitControls.html).

## Evidence and remaining visual differences

The [before/after gallery](../reports/dungeon-3d-polish/index.html) pairs the existing generated layout at identical seed, focus and default angles:

- `before-full-room.png` / `after-full-room.png`: normal full-room framing.
- `before-east-corner.png` / `after-east-corner.png`: east wall and southeast corner.
- `before-side-door.png` / `after-side-door.png`: intact side doorway at the default angle.
- `before-torches-on.png`, `before-torches-off.png`, `after-torches-on.png`, `after-torches-off.png`: identical-camera lighting pairs within each version.
- `before-stairs.png` / `after-stairs.png`: real staircase and adjacent wall.
- `after-room-inspection.png` and `after-side-door-inspection.png`: 50° elevation / +40° rotation, showing the wall and door faces more directly.

Before and after responsive viewport widths differ by 15 pixels because the updated control panel requires a page scrollbar. ON/OFF pairs within each version have exactly identical camera state and image dimensions. The supplied reference remains in the conversation; it is not copied into the repository.

The result is closer to the reference's separation of coping, stacked stone and floor. It is not an exact reconstruction: the retained art still contains baked wear and shading, wall corners and caps are more regular, flame shapes are simple, and the concept has more individually sculpted stone variation. Intact side doors can still be obscured at high angles; lowering elevation and rotating now makes inspection practical. Optional door-head cutaway remains disabled by default.

## Verification and changed files

Run `node scripts/verify-dungeon-3d-polish.mjs` against the existing server. It defaults to port 9001; set `ATELIER_URL` to the active server address, such as `http://localhost:9000`. Use `--baseline` only before changing visuals when intentionally recording a new baseline. The committed comparison baseline records the original prototype and should not be overwritten during ordinary verification.

The focused browser check covers isolated gesture axes, inverted middle drag, release outside, both elevation limits, overhead pan, reset, wheel behavior, context-menu suppression, the light budget and measurable surface illumination. `npm run verify:3d` retains the broader 32/64-layout, material, door-ray, stair-ray, height-rebuild, secret-concealment, resource-disposal and production-pixel/settings checks. Both use headless Chrome without opening visible tabs or starting another server.

Changes in this milestone:

- `src/experiments/dungeon-3d/materials.ts`: stone atlas, targeted albedo adjustment, neutral mortar, wood/iron/flame finish.
- `src/experiments/dungeon-3d/geometry.ts`: atlas coordinates, chiseled stone-front geometry, coping bevel and joints.
- `src/experiments/dungeon-3d/scene.ts`: joined masonry courses, coping fascia, door finish and local light pool.
- `src/experiments/dungeon-3d/viewport.ts`: fill lighting, camera gestures, limits, synchronization and cleanup.
- `src/pages/Dungeon3DPrototypePage.vue`: synchronized controls, gesture hints and development verification data.
- `scripts/verify-dungeon-3d.mjs`: existing pan check updated to the new left-button binding.
- `scripts/verify-dungeon-3d-polish.mjs`, `reports/dungeon-3d-polish/`: focused comparison/gesture tooling and evidence.
- `reports/dungeon-3d/`: refreshed broader 3D evidence.
- `README.md`, `docs/dungeon-3d-prototype.md`, this report: current behavior and evidence links.

The app paths above are relative to `apps/dungeon-atelier/`. Earlier uncommitted projection-study work is preserved separately.

Final validation passed: all 139 existing tests, app TypeScript, core compilation, repository formatting, app ESLint, production build, the focused polish verifier and the broader 3D verifier. Browser checks reported no uncaught exceptions or console errors. Production Canvas pixels and saved appearance settings were unchanged, and active 3D viewports returned to zero on navigation. The production bundle contains none of the experimental route or renderer markers.

Measured on Chrome's ANGLE / Microsoft Basic Render Driver software backend:

| Scene           | Before triangles | After triangles | Before / after draw calls | After texture estimate |
| --------------- | ---------------: | --------------: | ------------------------- | ---------------------: |
| Generated 32×32 |          262,280 |         165,488 | 24 / 26                   |               62.0 MiB |
| Generated 64×64 |        1,565,852 |         946,796 | 26 / 28                   |               78.0 MiB |

Counts include directional shadow work. The extra material batch is the recessed mortar core. Texture estimates increase by 2.5 MiB for the block atlas and its derived maps; actual GPU byte usage is unavailable. Median sampled CPU render submission was 1.0 ms; this does not establish GPU frame time or sustained FPS. No hardware-independent performance claim is made.
