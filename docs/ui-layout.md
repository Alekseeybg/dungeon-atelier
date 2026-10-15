# UI layout and sizing

The workspace uses a fixed set of task categories rather than an ever-growing form. New controls should join the relevant category and use a named expandable section when they are specialized. Common controls remain visible without expansion.

## Settings

The preset selector sits above the category tabs. It applies the chosen layout's spacing and irregular-room probability; a customized indicator identifies deviations from those values. Generation actions remain below the scrollable category contents.

| Category    | Contents                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Layout      | Dimensions, room count, room-size range, expandable spacing and shapes, selectable footprint families, chamber-block frequency |
| Connections | Regional loops, secret-shortcut probability, expandable connection rules                                                       |
| Details     | Seed, floor number, Stone appearance and torch-rule reference                                                                  |

Details currently describes the automatic decorative rules; it does not imply that materials or torch placement have user-adjustable generation settings. Future decoration controls can join their related section here.

The dungeon toolbar owns view controls. Stone/Classic and walk mode stay directly accessible; grid and shortcut-route controls live in the Overlays menu. Additional overlays belong in that menu rather than becoming permanent toolbar switches.

The results panel owns the floor report and tile inspector. Basic counts and shortcut location remain directly accessible. Secondary route metrics live in the expandable Route statistics section. Material-rule reference lives under Details; selected-tile material explanations remain in the inspector.

## Type and control scale

Automatic root sizing uses `clamp(16px, calc(10px + 0.4vw), 20px)`: 16 px on smaller windows, approximately 17.7 px at 1920 px, and 20 px at 2560 px. Most body text uses one rem, captions 0.85 rem, numeric field labels 0.85 rem, and buttons 0.9 rem. Headings, controls, field spacing, dungeon toolbar height, panel width, and playtest controls use proportional units. The application header stays 64 px high; its scaled title fits this space, and a stable header prevents layout observer feedback during viewport changes. Pixel art retains its existing tile resolution.

Display preferences can override the root to 16 px (Standard) or 20 px (Large). The selected value is stored under `dungeon-atelier:ui-scale` in local storage. If storage is unavailable, the interface still works with automatic sizing. Browser zoom is independent of this preference.

These choices address CSS viewport size rather than guessing a monitor's physical dimensions or operating-system scaling.

## Responsive behavior

- At 1200 CSS pixels and above, three columns show settings, map, and results. Each side panel is `clamp(17.5rem, 20vw, 22rem)` wide; the dungeon receives the remaining width. The workbench fills the available viewport height and side panels scroll independently.
- Below 1200 px, Dungeon / Settings / Report navigation shows one full-width panel. Components remain mounted, preserving controls, camera state, selection, and walk preview. Hidden map bounds are ignored rather than resetting the camera to a zero-sized viewport.
- Below 600 px, toolbar labels simplify where an accessible icon button is sufficient. Map controls may wrap when larger text requires it.
- Below 700 px in viewport height, the page can scroll. A minimum workbench height preserves usable map and settings areas instead of squeezing them away.
- On coarse-pointer devices, ordinary round buttons and tabs receive larger targets.

Generating or importing a floor switches a narrow workspace to Dungeon. Clicking a map tile switches to Report with the tile inspector open. Locate shortcut returns to Dungeon and centers its highlighted route.

Fitted maps refit when the visible canvas resizes. Manual zoom and pan disable automatic fitting, preserving the user's scale as the canvas changes. Fit map re-enables automatic fitting. Walk mode keeps the player centered.
