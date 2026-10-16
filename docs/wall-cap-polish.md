# Wall-cap effects review

This pass uses the existing cap, face, frame and floor images. No replacement art was generated. It follows the [generated floor review](generated-floor-review.md).

Open `/#/visual-foundation`. **Worn cap edges** enables the complete treatment; **Compare cap effects** adds an identical view with effects disabled. The prototype opens with effects enabled. The rendering API retains its previous appearance unless `capPolish: true` is requested. The normal editor's themes are unchanged.

## Before / after

The left panel is the current cap treatment; the right panel adds effects to the same artwork, geometry, doors and lighting.

- [Full four-door room](../reports/visual-foundation/cap-polish/ruins-room-lit.png)
- [East wall](../reports/visual-foundation/cap-polish/ruins-east-wall-lit.png)
- [South-east corner](../reports/visual-foundation/cap-polish/ruins-south-east-lit.png)
- [Unlit wall corner](../reports/visual-foundation/cap-polish/ruins-wall-detail-unlit.png)
- [Actual generated map](../reports/visual-foundation/cap-polish/generated-map-before-after.png)

The capture directory also includes both door axes, lit/unlit comparisons for all three masonry families, individual effect layers, and desktop/mobile UI screenshots.

## What each effect changes

| Effect              | Treatment                                                                               | Contribution / constraint                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge highlight      | Warm, subpixel coping light, stronger on north/west contours                            | The top edge catches light without outlining every logical cell. Only exposed cap contours receive it.                                                                                                |
| Occlusion/contact   | Shallow fading band directly beneath the cap; small darkening at recessed contour turns | Separates top stones from vertical courses. Face shading uses the face's own coordinates, so the band has consistent depth on east and south faces. The existing floor-contact layer is unchanged.    |
| Edge wear           | Texture-sampled dark nicks with a slightly inset worn lip                               | The current stone's brightness drives small variations along the edge. Absolute world coordinates keep phase continuous between placements. This is a surface-wear overlay, not new chipped geometry. |
| Directional shading | Restrained light/dark roll across the outer 3.5 ground units of the cap                 | Gives the lip a little more shape; avoids a full-surface bevel or noisy lighting filter.                                                                                                              |

Individual unlit comparisons: [highlight](../reports/visual-foundation/cap-polish/layer-highlights.png), [occlusion](../reports/visual-foundation/cap-polish/layer-occlusion.png), [wear](../reports/visual-foundation/cap-polish/layer-wear.png), [shading](../reports/visual-foundation/cap-polish/layer-shading.png).

## Result and limits

The effects make the upper lip and cap-to-face junction easier to read. The result is intentionally modest at full-room scale; corner and unlit views make the difference clearer. They do not turn the current fitted coping field into the reference's individually sculpted, heavily chipped blocks.

The silhouette's alpha coverage is deliberately preserved. Consequently, real missing stone, irregular block outlines, deeper fractures, authored joints around quoins and convincing broken corners still need better source art or a separate, carefully joined edge-mask asset. Increasing these overlays further would produce conspicuous lines and a bevelled appearance before it produced those missing structural details. Keep this treatment as a restrained enhancement; do not treat it as a substitute for that art.

## Preservation and checks

`npm run verify:cap-polish` compares every architectural alpha pixel before/after for all three masonry families; verifies identical inventory (projection, anchors, placements and art sources), identical narrow floor-contact pixels, identical interior-floor pixels, deterministic rerenders and immutable fixture input. All seven floors retain the same contact layer. Both door axes have before/after captures. The UI's default, baseline restoration and comparison canvas are checked at desktop and mobile sizes.

Machine evidence: [report.json](../reports/visual-foundation/cap-polish/report.json). These checks establish preservation and repeatability; the screenshots remain the evidence for artistic judgment.
