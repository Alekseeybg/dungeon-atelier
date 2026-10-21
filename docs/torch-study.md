# Torch model selection

**B — Wall brazier** was selected and is now applied to the dungeon, with additional iron and coal detail and subtle optional flame animation. See the [brazier and masonry milestone](dungeon-3d-weathering.md). The original comparison remains available at `/#/dev/dungeon-torches` (also linked as **Torch comparison** from the prototype).

- **Existing:** the current cage torch and its existing materials.
- **A — Forged basket:** a new tapered six-rib iron basket, flat riveted bands, long flush wall plate, rectangular forged bracket, and short charred handle. Closest to the supplied torch concept's construction.
- **B — Wall brazier:** a new broad shallow iron cup with eight crown prongs, a short wall plate and curved lower support. A compact alternative with no wooden handle.

The alternatives use the dedicated forged-iron texture. Shared static flame material, lighting, wall context, and orthographic views keep the comparison consistent. Choose **All three** or an individual close-up, then inspect front, three-quarter, and gameplay views with amber lighting on or off. No torch candidate is applied automatically.

![Existing, A, B](../reports/torch-study/three-quarter.png)

[Existing close-up](../reports/torch-study/existing.png) · [A](../reports/torch-study/basket.png) · [B](visual-references/selected-brazier.png) · [Gameplay](../reports/torch-study/gameplay.png).

`node scripts/verify-torch-study.mjs` checks model identity, view controls, individual close-ups, lighting toggle, browser errors, and return to the editor. The page and assets remain development-only. Caps and production rendering are unchanged.
