# Visual foundation candidate art

New generated raster artwork for the isolated `/visual-foundation` review page. The normal editor renderer does not import this directory.

The built-in `image_gen` tool produced these images using the user's atlas as a style reference, not as an edit target or a sheet to crop. [prompts.json](prompts.json) records the exact requests. The images are candidate art awaiting user approval, not a finished human-authored production asset pack.

- `flagstone-field-v1.png`: the selected room field, with an authored weathered area.
- `coping-stone-v1.png`: neutral overhead coping material.
- `masonry-profile-v1.png`: painted coping/face profile; lower face courses are used intact.
- `arch-frame-v1.png`: neutral frontal frame elevation with a transparent opening.
- `flagstone-large-v1.png`: earlier material study, now available as Early study · Large flagstones.

These are source masters. They are sampled into the prototype's cached 2× scene atlas; their source dimensions are not logical tile dimensions. Existing neutral oak leaf and sconce images are reused from `../architecture/`.

The `ruins-*-v2.png` and `fortress-*-v2.png` sets add coordinated face, cap, frame, and sill source masters for the isolated A/B review. The floor and projection are unchanged. Their exact built-in image_gen prompts and filenames are in [masonry-prompts-v2.json](masonry-prompts-v2.json). See [the masonry review](../../../../../docs/masonry-review.md) for dimensions, compositing details, rendered comparisons, and limitations. The v1 set remains selectable as Previous prototype.

Projection, anchors, comparisons, known limitations, external-art requests, and the approval boundary are documented in [visual-foundation.md](../../../../../docs/visual-foundation.md).

`flagstone-realistic-v3.png` is the current realistic floor candidate, an opaque 1254 × 1254 master. It keeps the existing field coverage and projection, with the v1 floor retained for comparison. Built-in image_gen prompts and sampling calibration are in [floor-prompts-v3.json](floor-prompts-v3.json); [the floor review](../../../../../docs/realistic-floor-review.md) contains rendered results and limitations. The comic-book direction is not implemented.

The Floor study selector also exposes `floor-study-weathered.png`, `floor-study-irregular.png`, `floor-study-broad.png`, `floor-study-blended.png`, and the existing `flagstone-large-v1.png`. These are recovered/generated studies, not newly generated artwork in the selector change. [floor-study-catalog.json](floor-study-catalog.json) records their original sources, prompts, and calibration. All seven floors can be compared in the isolated review.
