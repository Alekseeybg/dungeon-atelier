# North-wall sconce mounting experiment

Review: `http://localhost:9000/#/visual-foundation/final-polish`. Enable **Compare north-wall mounting** and select **Torch + wall integration** or **Torch close-up**. The comparison uses the same architecture, lighting and camera on both sides.

The previous front sprite is a single wall-aligned image. It contains a backplate but does not expose the support's depth. The experiment keeps the original lower backplate at its existing masonry anchor, draws a short iron bracket using projected top/side planes, and places the basket 12 world units into the room. Its support turns upward under the basket. The existing 32-unit square grid, 32×26 ground projection and height shear remain unchanged. Basket width stays 11 units; lighting is unchanged.

A matching perspective-specific basket was needed: the original front sprite has flame baked between its bars and cannot expose its ember bed independently. `north-sconce-components-v1.png` contains a slightly elevated frontal basket in its left cell and a separate flame in its right cell. The original atlas supplies the backplate and the unchanged side-wall assembly. No existing source artwork was overwritten.

Rendering order is masonry contact → original backplate → projected bracket → basket → separate flame → foreground basket band/upright. The flame has its own draw function and ember-bed anchor; future flickering can change that pass without moving the hardware. No animation has been added. Glowing embers stay in the basket material. The side-wall torch retains its existing appearance, including its baked fire, pending a separate animation extraction pass.

`northTorchMount: 'flat'` restores the exact preceding front-sprite treatment. Both the final-details reference and the real Ancient generator theme use `'projecting'`. The legacy themes remain available; see [production integration](production-visual-integration.md).

Evidence lives in `reports/visual-foundation/final-polish`: `torch-before-after.png`, `north-torch-close-up.png`, `full-room-normal.png`, `recessed-side.png` and `report.json`. Browser verification checks that all changed pixels are confined to the two north sconces, the side torch and stairs are pixel-identical, and the flame can be omitted independently. The accepted architectural fixture hash is also preserved.

The component atlas was authored with the built-in imagegen tool. The exact prompt and source reference are recorded alongside it in `north-sconce-components-v1.provenance.json`.
