# Door model selection

Open `/#/dev/dungeon-doors`, or use **Door comparison** in the 3D prototype header.

The selected combination is now active in the 3D prototype: **third door (B), first frame, and the third threshold's broad slab shape in the first frame's pale stone**. The door's crown is straight to fit the selected rectangular opening. The eight dark planks, three bands, vertical iron edging, and hanging ring remain from B. Threshold and surround share the same material, with no yellow candidate-stone tint.

Subsequent feedback refined this combination: the surround is now thinner and uses the wall's stone and weathering to soften the transition. The broad pale threshold is retained. See the [brazier and masonry milestone](dungeon-3d-weathering.md) for the current appearance.

The comparison page shows the selected combination in the center. Toggle **Selected combination** off to revisit A. Original alternatives:

| Model                | Construction                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing             | Current door, materials, stone frame, and hardware, unchanged                                                                                                                         |
| A — Quoin-framed oak | Six thick oak planks, two broad rectangular forged straps, six rivets per strap, hanging ring and staple, chunky alternating stone jambs, a single solid lintel, recessed inner stops |
| B — Arched ironbound | Eight darker planks with a curved crown, three iron bands, vertical iron edge strips, hinge barrels, smaller hanging ring, nine wedge-shaped arch stones, stone spandrel              |

The models share one orthographic camera and lighting setup, matching aperture width and wall height, identical floor and wall context, and the established cap profile. Front, three-quarter, and gameplay views, amber lighting, and opening state are shared controls. Torches remain unchanged in the dungeon; the next selection is available separately at `/#/dev/dungeon-torches`.

[Selected combination in neutral light](visual-references/selected-door.png).

![Existing, A, and B](../reports/door-study/three-quarter.png)

[Front](../reports/door-study/front.png) · [Gameplay](../reports/door-study/gameplay.png) · [Open](../reports/door-study/open.png)

`node scripts/verify-door-study.mjs` captures the comparison, checks real closed/open doorway rays for all three models, toggles lighting and camera views, and returns to the editor. The selected combination also passes the main 3D verifier's directional portal, wall-height, stair, secret concealment, Canvas parity, and cleanup checks. Logical generation and traversal remain unchanged.

## New material asset

The built-in imagegen tool generated [door-study-materials-v1.png](../apps/dungeon-atelier/src/assets/architecture/door-study-materials-v1.png). The new candidates use its oak, iron, and limestone quadrants. The charcoal quadrant is unused; torch development is deferred. Existing assets and materials are untouched.

Final generation prompt:

> Create a production-ready photorealistic PBR base-color texture atlas for a realistic ancient dungeon door and forged wall torch sconce. ONE single square texture atlas, perfectly flat orthographic straight-on, 2 by 2 equal square quadrants edge to edge, NO borders, NO text, NO labels, NO perspective, NO objects or hardware, NO lighting or shadows, NO orange torch glow. Top-left quadrant: warm medium aged European oak surface, fine LONG VERTICAL straight wood fibers, restrained wear, subtle deep vertical splits and occasional small knots, convincingly fibrous wood, no planks or plank seams, no metal, no cross-grain. Top-right quadrant: dark charcoal forged wrought iron surface with subtle irregular hammer marks, graphite gray with small restrained dark brown oxidation pits, convincing granular iron, matte, no shine, NOT black featureless solid. Bottom-left quadrant: weathered warm gray limestone stone interior, fine mottled mineral grain and tiny pitted erosion, no joints, no blocks, no bricks, no bevels, no moss, modest contrast. Bottom-right quadrant: charred black-brown wood and glowing dark ember-red fissures, organic burnt timber charcoal, fine cracks, no flames. Intended to UV-map actual 3D vertical oak planks, wide dark iron straps, stone door jambs, tapered iron basket ribs and bracket. Realistic high-detail aged surface definition matching a cinematic ruined medieval dungeon prop kit; neutral diffuse albedo values and no baked specular. All four quadrants should read as raw materials, not an illustration of objects.
