# Visual production rollout — integrated

The approved visual foundation is now integrated into the real editor. **Ancient Ruined Dungeon** is the default, with Stone and Classic retained as fallbacks.

See [the integration inventory, architecture, validation and remaining limits](production-visual-integration.md) for the completed rollout. Appearance controls expose all seven preserved floor sources, three wall families and five compatible cap/coping bundles. Doors, thresholds, stairs with separate adjacent symbols, mounted north/side torches, lighting and wall/floor separation use the approved compositor.

The editor's camera, fit, zoom, inverse inspection, selection, grid, shortcut overlay, walk arrow, fog and PNG export now share the dimensional presentation convention. The logical grid, procedural generation and collision remain unchanged. Native image density is handled separately from logical/camera coordinates.

[The production gallery](../reports/production/index.html) shows actual generated maps at three sizes, both layout presets and multiple seeds. [The matrix report](../reports/production/report.json), [zoom/detail report](../reports/production/details-report.json), and [300-layout placement audit](../reports/production/placement-report.json) record the checks. The reference scene at `/#/visual-foundation/final-polish` remains available for regressions; it is no longer the only place these visuals run.

The previous approval checkpoint authorized this rollout. Further changes should be limited to targeted integration fixes after review, with no new art-direction cycle.
