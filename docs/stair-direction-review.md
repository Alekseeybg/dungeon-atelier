# Adjacent stair level symbols

Review at `/#/visual-foundation/final-polish?view=stairs&compare=stairs`. **Adjacent stair symbol** selects brass, pale stone or iron. **Compare without symbols** shows identical stair artwork with the neighboring plaques hidden. Select **Four-door room / Normal zoom** to judge scale.

The up/down arrows identify the destination level. Each sits on its own small stone plaque beside the staircase, separated from the stair frame by clear floor. Neither arrow is painted on the treads, risers or entry. This separates the level sign from the flight's physical walking direction; in particular the down arrow no longer contradicts the northward-descending well.

Recommendation: **A · Brass level symbol**. The warm material contrasts with the dark carrier without extra glow. Pale stone and iron remain available as quieter alternatives. The plaques use the same ground projection and lighting as the room, with a restrained cut border around a broad readable arrow.

The up flight retains its stronger 16-pixel rise and darker risers. The six treads, entry height, footprint and down-well geometry are unchanged. Removing or switching a marker leaves the stair artwork pixel-identical.

The reference fixture prefers clear floor on the right, then the left, then below the stair. A down well may also use the north neighbor; an ascending flight avoids that location because its raised mass projects into it. Production adds projected wall/cap occlusion checks and diagonal neighbors. If a tight aisle cannot expose a whole floor sign, the same plaque mounts on nearby room-facing masonry along the same floor approach, separated from the treads. Fully boxed custom stairs without any receiving surface may omit the marker. All 600 generated stairs in the 300-layout audit found a placement.

`stair-markers.ts` draws the sign separately from `stone-stairs.ts`. `finishing-model.ts` owns terrain candidates and glyph geometry; `stair-placement.ts` handles projected visibility and the production mounting fallback using shared `projected-geometry.ts` planes. `FINAL_FOUNDATION` keeps `stairProfile: 'ascending'` and `stairArrow: 'brass'`; setting the arrow to `'none'` hides only the signs. No bitmap assets or generation rules changed. These approved details are now active in the real generator; see [production integration](production-visual-integration.md).

Run `npm run verify:stair-direction` for normal-scale rooms, close-ups, an unmarked/marked comparison and a report in `reports/visual-foundation/stair-direction`. Browser verification requires every changed pixel to fall inside the two adjacent marker areas, proving the stair artwork and all surrounding architecture remain unchanged. It also exercises all three styles and the comparison control. `verify:final-polish` checks the wider close-up crops, export, torch isolation and responsive layouts.
