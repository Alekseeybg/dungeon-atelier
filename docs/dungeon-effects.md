# Three.js Effects Playground

Open `/#/dev/dungeon-3d`, then **Effects** in the header. The floating panel stays beside the dungeon while sliders update the existing scene. Its five groups cover Depth & AO, Shadows & Lighting, Materials, Atmosphere, and Diagnostics. Existing door and torch comparison routes remain available.

Choose Baseline, Depth Study, Material Study, Atmosphere Study, or Combined. Editing a setting selects Custom. Reset to Baseline restores the approved effect settings and master lighting switches without changing the camera or dungeon. Settings are session-only; production Canvas rendering and saved editor appearance are unaffected.

## Implemented effects

- Contact GTAO retains the approved Ancient Ruins baseline. Radius, intensity and AO-only diagnostics allow direct comparisons, including an explicit override for Restored Crypt.
- Recessed mortar response adjusts the actual mortar material. Bevel response adjusts roughness on existing chamfer faces; neither adds painted shadow strips or changes geometry.
- Material normals are derived from existing height maps, with the original world/atlas UV convention retained. Stone, wood and iron roughness are independent. Baseline restores original material properties.
- Directional shadow strength and softness are adjustable. Optional local torch shadows use a bounded nearest-light budget (two in study presets, three maximum). Torch lighting and master Shadows control the point-light casters together.
- Torch tint, range, intensity and falloff are adjustable. Half-resolution selective bloom uses flames and emissive coals, with architecture occluding the source. Illuminated walls do not become bloom sources.
- Tone mapping, exposure and restrained saturation/contrast/temperature grading are optional. Baseline retains its original output shader and unlit background.
- Diagnostics distinguish CPU submission, measured frame cadence and GPU timing. GPU timing is reported only when the browser supports nonblocking timer queries. The measurement button samples 30 frames with flame time held still.

Haze was deferred: the existing surface and torch studies give clearer comparisons without introducing another depth-compositing interaction.

## Validation and comparison artifacts

[Comparison gallery](../reports/dungeon-effects/index.html) includes both themes at 55 and 90 degrees, room/wall/cap, door, quiet room, and both staircase directions. Individual OFF/NORMAL/exaggerated studies were run before combining effects. Reset captures match the original baseline PNGs byte for byte. Browser checks cover unchanged geometry identity, linked light/shadow toggles, bounded resources after repeated preset switches, panel access and renderer disposal on leaving the route.

[Performance measurements](../reports/dungeon-effects/performance.json) use the same room and frozen flame clock. The verifier runs headless Chrome with GPU disabled, so these are software-rendering comparisons, **not laptop hardware FPS estimates**. GPU timer support was unavailable. Ancient Ruins drew 57 calls at Baseline/Material Study and 265 with Combined; local point-light shadow cubemaps account for most of the increase. Ancient Ruins CPU submission ranged roughly 1.7?4.5 ms, while software frame cadence was much slower. Allocated texture/geometry counts remained stable after warmup and repeated preset changes.

## Recommended direction

Keep normal strength around 0.2?0.3 and stone roughness high. Preserve the current AO baseline, with restrained mortar and bevel response. Local torch shadows improve grounding but need a small budget and a future static-shadow cache before broad production use. Low selective bloom is optional; exaggerated normals, polished stone, broad bloom and strong grading reduce material readability.

Derived maps are cached and reused. Bloom resources allocate lazily and skip processing when disabled. AO depth/normal rendering avoids duplicate shadow updates. On-demand rendering already avoids idle redraws when flame animation is disabled. Further optimization should prioritize caching static shadow/AO work during flame-only frames, then post-processing resolution and texture budgets; this task does not migrate production rendering.

Run `node scripts/verify-dungeon-effects.mjs --stage=combined` against the standard dev server. Individual stages are `baseline`, `normal`, `roughness`, `ao`, `cavity`, `shadows`, `torch`, `torch-shadows`, `bloom`, `tone`, and `grade`. Capture baseline before renderer changes when testing exact preservation.

Validation completed: 168 tests passed, application typecheck and ESLint passed, production build passed, and combined browser validation passed. Headless verification browsers were closed and their temporary profiles removed.

## Cap-edge sparkle and torch bloom correction

Ancient Ruins cap chamfers now retain their matte stone roughness when Bevel light response is increased. The existing texture, derived normals, chips and approved geometry are preserved. The baseline and Restored Crypt comparisons remain pixel-identical; this adjustment limits the experimental edge polishing on Ancient Ruins caps only.

The emissive-only bloom pass now uses unlit coal emission instead of a cloned lit StandardMaterial. The old clone could reflect point lights into the bloom input and retain outdated experimental roughness settings. Current emissive color, map and intensity are synchronized without copying roughness, normal maps or scene lighting. Architecture still occludes bloom sources, and the regular beauty pass retains its materials and torch lighting.

`verify-cap-edge-response.mjs --before` captures both themes before a change; the default run captures afterward and checks exact baseline/Restored preservation plus geometry identity. [Cap comparisons](../reports/cap-edge-response/) use the reported normal strength 0.85 with Roughness Study disabled and Bevel light response 2.0.

`verify-torch-bloom-stability.mjs` sweeps 96 camera/zoom combinations and exercises the reported history of enabling glossy roughness before disabling it. The sweep did not reproduce the full attached flare, so its images alone do not confirm that symptom is eliminated on every browser. A focused real WebGL rendering regression verifies that source bloom is independent of incident light and roughness, tracks emission changes, restores prior emission exactly and restores the original scene material. [Regression results](../reports/torch-bloom-stability/emission-source-checks.json). Use `--source-only` for the focused regression without the sweep.
