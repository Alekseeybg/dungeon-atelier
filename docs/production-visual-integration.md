# Approved visuals in the real generator

The editor now starts with **Ancient Ruined Dungeon**. The approved architecture compositor drives real generated floors and PNG exports. Stone, Classic and the earlier Dimensional Stone remain selectable fallbacks. Generation, movement, collision, seed behavior and the saved floor schema are unchanged.

Open **Materials** in the map toolbar to choose floors, walls, coping and details. Appearance is saved locally, separately from dungeon JSON. The tile inspector reports the selected material family. Failed image loads preserve the previous complete frame; exports wait for a valid committed view.

## Available materials

| Floor                     | Intended use                            |
| ------------------------- | --------------------------------------- |
| Worn realistic flagstones | Recommended general floor and corridors |
| Classic flagstones        | General floors or corridor contrast     |
| Weathered flagstones      | Secondary or worn rooms                 |
| Irregular flagstones      | Ruined/special rooms                    |
| Broad natural slabs       | Larger chambers                         |
| Blended wear              | Secondary rooms or corridors            |
| Ancient large stones      | Optional rare ancient chambers          |

All seven original floor images, exposure settings and sampling conventions are preserved. No new source art was generated for this integration.

The default uses one continuous primary floor. Corridors can inherit it or use any of the seven materials. **Coherent regional variation** optionally assigns a secondary material to 20% of room candidates and a rare material to 5% of candidates, with the rare choice limited to one chamber of at least 36 floor cells. These are deterministic candidate rates, not guaranteed quotas. Each room uses one family across its actual footprint, including irregular shapes. No per-tile material lottery is used.

| Wall family                  | Role                              |
| ---------------------------- | --------------------------------- |
| Ancient Ruined Dungeon       | Approved realistic default        |
| Medieval Fortress            | Retained alternate masonry family |
| Original dimensional masonry | Compatibility material            |

| Cap/coping assembly  | Role                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| Chiseled chamfer     | Recommended sharp cut profile; flat crown, angled facets, darker faces |
| Weathered chamfer    | Softer retained chamfer treatment                                      |
| Heavy hewn coping    | Raised heavy-stone alternative                                         |
| Fitted cap stones    | Earlier fitted presentation                                            |
| Broken ancient slabs | Manual specialist variant; never randomly applied                      |

Wall and cap choices apply consistently to the entire map. Bundles encode compatible geometry/finish combinations rather than exposing contradictory switches. The same connectivity, doorway and corner rules serve each family. Approved contact shadows, floor skirts and plane-value separation remain active.

## Architecture and details

- Doors use their logical travel axis and owner footprint to select the correct assembly. Their masonry planes, arch frames and thresholds share the approved projection. Closed/open presentation is selectable; it does not add a door simulation. Revealed secret panels carry S annotations at the correct wall-face center on either axis.
- Stairs use authoritative up/down metadata, six treads and a floor-level entry. Up retains the stronger 16-pixel rise; down retains the recessed well. Flights are sorted with architecture by depth, preventing a north wall from incorrectly covering a nearer raised flight. Foreground walls still occlude correctly.
- Brass level arrows remain on separate plaques, with clear space from the stair frame. Placement tests projected cap/face silhouettes as well as terrain. Clear neighboring floor is preferred; in a narrow aisle where foreground coping hides the ground, the same plaque mounts on nearby room-facing masonry along the same floor approach. The 300-layout audit found placements for all 600 stairs: 549 floor plaques and 51 wall plaques. A fully boxed custom/imported stair with no valid receiving surface may omit its plaque rather than cover architecture.
- Torches mount on exposed south/east-facing masonry surfaces with open receiving floor: the visible north and west room walls. Placement is seeded, keeps five-tile spacing and avoids doors/stairs within two tiles. A map-area limit bounds light cost. North sconces use the projected iron arm, separate basket and independent flame; side sconces retain their approved orientation-specific artwork.
- Light spill uses the approved restrained contribution and respects walls and closed doors. Concealed secret geometry is removed before wall, torch and light planning. A concealed map is pixel-identical to the equivalent untouched-rock presentation.

In walk mode, nearby architecture is visible only through persistent exploration fog; there is no search mechanic. Logical movement and collision are unchanged. Unknown foreground masonry is cut away locally over explored floor, without retaining a second full-map raster. The player arrow, fog, selection, grid and shortcut overlays share the same presentation coordinates.

## Structure and lifecycle

| Responsibility                                                | Source                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Production entry                                              | `ancient-renderer.ts`                                                          |
| Material catalog, cap bundles, floor zoning and normalization | `ancient-settings.ts`                                                          |
| Saved appearance state                                        | `stores/appearance.ts`                                                         |
| Shared projection and inverse cell mapping                    | `map-projection.ts`, using the approved `visual-foundation/model.ts` constants |
| Approved architecture compositor                              | `visual-foundation/renderer.ts` · `composeFoundation`                          |
| Generated-floor adapter                                       | `visual-foundation/generated-scene.ts`                                         |
| Torch placement                                               | `mounted-placement.ts`                                                         |
| Renderer selection and async entry                            | `dungeon-renderer.ts` · `createMapCanvasAsync`                                 |
| Ownership/disposal                                            | `map-resources.ts`                                                             |
| Serialized async requests, stale results and failure recovery | `render-session.ts`                                                            |
| Shared style catalog and presentation types                   | `map-style.ts`                                                                 |
| Shared projected planes and stair-sign visibility             | `visual-foundation/projected-geometry.ts`, `stair-placement.ts`                |
| Viewport/camera/inspection/overlays                           | `DungeonCanvas.vue`                                                            |
| PNG                                                           | `files.ts`, through the same async rendering entry                             |

The logical grid stays 32×32. Ancient ground cells display at 32×26, with the approved 24-unit wall rise, six-unit height shear and native 2× artwork. Native image density is kept separate from camera scale and pointer coordinates. The Classic automap stays square and can navigate to a logical cell.

Only one viewport render is committed at a time. Requests are serialized; stale results are disposed. The last complete image stays available until its replacement succeeds. The viewport owns one native raster, exports own a temporary raster, and large construction atlases/contact buffers are explicitly released after composition. Material loading retains at most six bundles; reference-scene caching is bounded separately. Pan/zoom redraw the cached frame rather than rebuilding architecture.

Callers of the async API own the returned canvas:

```ts
const image = await createMapCanvasAsync(floor, grid, 'ancient', {
  revealSecrets: false,
  ancient: { floor: 'refined', wall: 'ruins', cap: 'cut' },
})
try {
  // Display or export the complete image using its presentation bounds/density.
} finally {
  disposeMapCanvas(image)
}
```

The synchronous renderer entry remains available for the three legacy themes. Review scenes use the same compositor; there is no separate production copy of the architecture code.

The follow-up refactor extracts request serialization from the canvas component, moves style definitions into an implementation-independent catalog, and shares projected planes between drawing and placement checks. Stair placement is split into terrain candidates, visibility checks and receiving-wall fallback. Regression checks compare all 12 generated-map pixel hashes against the completed integration before refactoring; all remain identical. Render-session tests cover coalescing, stale failures, recovery and unmount disposal.

## Validation and evidence

- [Production gallery](../reports/production/index.html) and [matrix/interaction report](../reports/production/report.json): 12 generated dungeons at 32×32, 64×64 and 96×96; two layouts and two seeds per size/layout; every floor, all three wall families and all five cap assemblies.
- [Small default map](../reports/production/recommended-32.png), [medium default map](../reports/production/recommended-64.png), [large default map](../reports/production/recommended-96.png).
- [Detail/zoom report](../reports/production/details-report.json): default-theme editor captures at 50%, 100% and 200%; square automap navigation, projected grid, collision, concealed/revealed secrets and fog pixel checks.
- [Placement audit](../reports/production/placement-report.json): 300 seeded maps spanning 16–96 tiles, both layouts, irregular rooms and chamber blocks; 600 separately placed stair plaques.
- Browser coverage includes inverse-projection selection, keyboard pan/zoom, walk/reset state, persistent exploration, stale render requests, asset failure/recovery, fallback themes, exact downloaded PNG pixels, and desktop/mobile layouts at 1920×1080, 2560×1440 and 390×844/DPR 2.
- The approved four-door compositor remains the pixel reference. Classic drawing code and core generation logic were not redesigned.
- [Built-artifact smoke test](../reports/production/build-report.json): the compiled SPA served over HTTP loads its bundled artwork, starts in Ancient mode, changes material and restores the saved choice after reload without failed resources or runtime errors.

Run from the repository root with the dev server available:

```sh
npm test
npm run typecheck
npm run lint:check
npm run build
npm run verify:production-placements
npm run verify:production-visuals
npm run verify:production-details
npm run verify:final-polish
npm run verify:browser
# Serve apps/dungeon-atelier/dist/spa on port 9010, then:
npm run verify:production-build
```

## Measured cost and remaining limits

Headless Chrome on this workstation rebuilt 32-tile scenes in roughly 0.2–0.5 seconds, 64-tile scenes in roughly 1.2–2.7 seconds, and 96-tile scenes in roughly 1.3–5 seconds, depending on cap treatment and content. These are complete material/architecture rebuilds, not navigation frames. The separate zoom audit records cached draw-call timings; it is not an FPS benchmark. See the reports for individual measurements.

A native 96×96 image is 6272×5120 RGBA, about 122.5 MiB. Construction and export add transient buffers. Resource checks return to one owned viewport raster after regeneration, theme changes and exports. Chunked rendering or worker-based composition could reduce peak memory and long material-update pauses later; neither is required to preserve the current rendering conventions.

Mirrored floor-texture repetition is the separately deferred issue and remains unchanged. Torches are static; the north flame has its own layer ready for later animation, while the side flame remains part of the retained side artwork. Stair links remain generator metadata; this integration does not implement inter-floor travel. No new theme or art-direction cycle was introduced.
