# Dungeon Atelier

A procedural dungeon studio for generating, inspecting, and walking through reproducible dungeon floors. Build a layout from a seed, switch between textured stone and classic automap views, explore it with fog of war, and export the result as JSON or PNG.

The project combines a browser-based editor with a separate TypeScript generation library, so the same dungeon definitions can be used by a future game without depending on the editor.

## Features

- **Deterministic generation:** Classic Rooms and Compact Labyrinth presets, rectangular, L/T/cross/U-shaped rooms, alcoved halls, chamfered chambers, paired chamber blocks, orthogonal corridors, regional loops, rare useful shortcuts, stable IDs, and one up/down staircase pair.
- **Validated layouts:** checks for geometry, connectivity, door placement, staircase placement, and agreement between the floor and its diagnostics.
- **Two map styles:** a Stone view with weathered flagstones, masonry, detailed top-down doors, wall sconces, and warm lighting; and a Classic view inspired by old dungeon automaps.
- **Dark Quasar interface:** task-based settings tabs, pinned generation actions, grouped reports, an overlays menu, SVG icons, and custom number steppers. Fluid typography and proportional controls grow on larger displays, with saved Auto/Standard/Large text preferences. Smaller windows switch between Dungeon, Settings, and Report.
- **Map inspection:** drag to pan, zoom around the cursor, fit to the viewport, toggle the grid, inspect individual tiles, and review floor statistics and staircase coordinates.
- **Visible secret passages:** hidden shortcut doors carry an S symbol in both map styles and PNG exports. Locate shortcut centers the route, with an optional cyan highlight for inspection.
- **Walk mode:** a directional player arrow, keyboard and on-screen movement controls, wall collisions, a step counter, and a fog-aware automap.
- **Persistent discovery during a playtest:** the player's surrounding 3×3 area is revealed, and previously discovered tiles remain fully visible.
- **Portable files:** validated JSON import/export and full-map PNG export in the selected visual style.

The app runs in the browser. It does not require a backend, database, account, or remote image service. Stone, door, and torch artwork is drawn procedurally with Canvas 2D.

## Technology stack

| Technology                  | Role                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| Vue 3                       | Reactive UI and Composition API components                                     |
| Quasar 2                    | Application layout, dark theme, forms, cards, tabs, menus, and buttons         |
| TypeScript 6                | Typed application code and framework-independent generation library            |
| Pinia 4                     | Generation settings, active floor, operation state, and feedback               |
| Vue Router 5                | Editor and not-found routes, using hash routing                                |
| Canvas 2D                   | Dungeon artwork, camera rendering, automap, player marker, fog, and PNG output |
| SCSS                        | Theme variables, responsive layout, and component styling                      |
| Ajv 8 / JSON Schema         | Validation of serialized dungeon definitions                                   |
| Quasar CLI / Vite           | Development server and production SPA build                                    |
| npm workspaces              | Shared installation and local package resolution                               |
| ESLint / Prettier / vue-tsc | Code quality, formatting, and TypeScript/Vue checks                            |

Quasar's Material SVG icons are bundled with the app, avoiding icon-font loading dependencies.

## Getting started

Requires npm and a Node.js version matching `^22.12 || ^24 || >=26`.

Run commands from the repository root:

```sh
git clone https://github.com/Alekseeybg/dungeon-atelier.git
cd dungeon-atelier
npm ci
npm run dev
```

Installation builds the core package and prepares the Quasar app. Development prints the local URL in the terminal. The app uses the workspace generator directly, and rebuilding the core automatically restarts the development server and its type checker so cached code or declarations cannot persist. The server does not open new browser windows automatically. A global Quasar CLI installation is unnecessary.

Use `npm install` when intentionally changing dependencies; commit the resulting lockfile.

### Project commands

| Command              | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Build the core and start the Quasar development server |
| `npm run build:core` | Compile the generation package and its declarations    |
| `npm run typecheck`  | Check both workspaces, including Vue templates         |
| `npm run lint:check` | Check repository formatting and application lint rules |
| `npm run lint`       | Format the repository and apply application lint fixes |
| `npm run build`      | Build the core and the production SPA                  |

Production files are written to `apps/dungeon-atelier/dist/spa`. Serve that directory over HTTP. Opening `index.html` directly from disk is unsupported. Hash routing allows static hosting without a route fallback.

## Using the studio

### Generate a floor

1. Choose a square size or enter independent width and height values. Select Classic Rooms or Compact Labyrinth as the layout preset.
2. Use **Layout** for dimensions, room count, and room-size range; expand **Spacing & shapes** for finer tuning. **Room designs** selects footprint families and the chamber-block chance. **Connections** holds regional loops and secret-shortcut probability. **Details** holds the seed, floor number, and appearance-rule reference.
3. Select **Generate dungeon** to reuse the seed, or **New seed & generate** to create a fresh seed and floor.
4. Review the report for connectivity, room count, staircase travel distance, rare shortcuts, and warnings. Expand **Route statistics** for loops, dead ends, corridor share, and shared-wall doors.

The preset selector and generation actions stay accessible while the active settings tab scrolls. A customized indicator appears when spacing or room-shape chance differs from the selected preset.

Changing settings leaves the displayed floor intact until generation succeeds. Failed generation or import keeps the previous map. A target room count is a request: when fewer rooms fit, the report explains the shortfall.

Number fields support minus/plus buttons, direct typing, and up/down arrow keys. Values are constrained to each field's limits; cross-field constraints are checked during generation.

### Inspect the map

Select **Stone** or **Classic** in the map toolbar. Both styles show the same floor and coordinates. The report's automap provides a compact Classic overview.

| Input                         | Editor behavior                          |
| ----------------------------- | ---------------------------------------- |
| Drag                          | Pan the map                              |
| Mouse wheel / trackpad scroll | Zoom around the pointer                  |
| Click a tile                  | Open its terrain and feature information |
| Arrow keys                    | Pan with the canvas focused              |
| `+` / `-`                     | Zoom in / out                            |
| `F`                           | Fit the map to the viewport              |
| Overlays → Tile grid          | Show or hide tile boundaries             |

The camera supports device pixel ratio and viewport resizing. Fitted maps refit as the viewport changes; manually zoomed views keep their scale. Selecting a staircase or an off-screen tile brings it into view.

Use **Overlays** for the tile grid and optional shortcut-route highlight. **Locate shortcut** in the floor report centers the passage.

### Display and smaller screens

**Display → Interface text size** offers **Auto** (16–20 px base, scaling with window width), **Standard** (16 px), and **Large** (20 px). The preference is saved locally; panel widths, controls, and spacing scale with it. Browser zoom remains available.

Desktop windows at least 1200 CSS pixels wide show settings, dungeon, and report together. Smaller windows use **Dungeon / Settings / Report** tabs, keeping each panel usable at full width. Generating a floor or locating a shortcut opens the dungeon; clicking a tile opens its inspector. Settings and playtest state remain intact when switching panels. Short windows allow page scrolling to preserve usable control and map areas.

See [UI layout and sizing](docs/ui-layout.md) for the organization and responsive sizing rules.

### Walk through the dungeon

Select **Walk mode** to start at the up staircase, facing north. The camera follows the player arrow, and the on-screen directional pad provides the same actions as the keyboard.

| Input                    | Walk behavior                                   |
| ------------------------ | ----------------------------------------------- |
| `↑` / `W`                | Move forward                                    |
| `↓` / `S`                | Move backward                                   |
| `←` / `A`                | Turn left                                       |
| `→` / `D`                | Turn right                                      |
| `Esc` / **Exit walk**    | Return to the editor                            |
| Reset exploration button | Restart at the up staircase and clear discovery |

Walls block movement. Regular door tiles are traversable; opening and closing doors is not yet simulated. Reaching a staircase reports its direction without changing floors.

The player reveals their own tile and all eight adjacent tiles, including diagonals and adjacent walls. Discovered tiles stay fully lit on both the main map and automap. This is a simple proximity reveal, without ray-cast line of sight or torch-dependent visibility.

Exiting and re-entering Walk mode resumes the current playtest. Resetting exploration or successfully generating/importing a floor starts discovery again. Player position, heading, step count, and explored tiles are temporary application state and are excluded from dungeon JSON.

### Import and export

- **Import:** load a dungeon JSON file. The stored layout is validated and preserved, rather than regenerated from its seed.
- **Export → Dungeon JSON:** save the authoritative floor, settings, IDs, versions, feature metadata, and diagnostics.
- **Export → PNG image:** render the complete map at 32 pixels per tile using the selected Stone/Classic style and grid setting. Camera position, zoom, selection, and exploration fog do not affect the exported image.

There is no automatic map persistence. Export JSON before closing or refreshing the page. Browser imports are limited to 5 MiB, and the core also bounds JSON text length before parsing.

## Workspace structure

```text
dungeon-atelier/
├── apps/dungeon-atelier/             # Browser editor
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── boot/                    # SVG icon mapping
│   │   ├── css/                     # Dark theme and responsive layout
│   │   ├── features/dungeon/
│   │   │   ├── components/          # Controls, canvas, automap, and inspection
│   │   │   ├── exploration/         # Temporary player and discovery state
│   │   │   ├── rendering/           # Stone/Classic renderers, artwork, and fog
│   │   │   └── files.ts             # Browser import and download support
│   │   ├── layouts/                 # Quasar application shell
│   │   ├── pages/                   # Editor and not-found pages
│   │   ├── router/
│   │   └── stores/                  # Pinia settings and floor state
│   └── quasar.config.ts
├── packages/dungeon-core/           # Framework-independent TypeScript library
│   └── src/
│       ├── generators/              # Room placement and corridor routing
│       ├── models/                  # Floor types, configuration, and limits
│       ├── serialization/           # JSON import/export and schema
│       ├── utilities/               # Seeded randomness and grid traversal
│       └── validators/              # Configuration and floor invariants
├── package.json                     # Workspace commands
└── package-lock.json
```

The app imports `@dungeon-atelier/core` by package name. The core has no Vue, Quasar, Canvas, DOM, filesystem, or browser dependencies; its only runtime dependency is Ajv. Rendering and playtest state remain in the application.

When changing core source during development, run `npm run build:core` to refresh its compiled output. Restarting `npm run dev` also rebuilds it. Dependency folders, `.quasar`, and `dist` are ignored by Git.

## Generation and rendering rules

### Configuration

| Setting                 | Default       | Supported values                      |
| ----------------------- | ------------- | ------------------------------------- |
| Width × height          | 32 × 32       | 16–96 tiles per side                  |
| Square presets          | —             | 24², 32², 48², 64²                    |
| Floor number            | 1             | Integer, 1–999                        |
| Seed                    | `atelier-001` | 1–128 characters; not whitespace-only |
| Target room count       | 8             | Integer, 2–80                         |
| Minimum room side       | 3             | Integer, 3–16                         |
| Maximum room side       | 7             | Integer, 3–16; at least the minimum   |
| Extra-connection chance | 20%           | 0–100% in the UI; 0–1 in the core     |

The maximum room side must also fit within `min(width, height) - 6`.

### Layout algorithm

Generator **3.0.0** supports adjustable spacing, irregular room footprints, shared-wall doors, detour-aware regional loops, occasional side passages, a separate rare-shortcut pass, selectable room families, and paired chamber blocks. The default rare-shortcut chance is **15% per floor**, capped at one; a qualifying short link must save at least 12 steps and 35% of its old endpoint route. Secret routes use fresh hidden entrances and a sealed, unbranched corridor interior that cannot merge with ordinary passages. Ordinary routes remain connected when the secret passage is sealed.

Classic Rooms defaults to a three-tile gap and 25% irregular rooms; Compact Labyrinth uses a one-tile gap and 45% irregular rooms. **Layout → Spacing & shapes** can override these settings. Both visualization modes render the same generated geometry.

Seeded placement and routing are bounded, and every completed floor passes geometry, footprint, door, and connectivity validation. The floor report recomputes route metrics from the resulting grid. Expand **Room designs** in the report to see counts and inspect an example; chamber-block members count as separate rooms. Old saved floors remain importable without rewriting their layout; reproducing an old seed requires its original generator version.

### Artwork and material rules

Stone mode uses coherent room paving families, worn corridor cobbles, fitted doorway/stair thresholds, and dressed structural masonry. Continuous seeded dampness and age fields create clustered moss and cracks, while protected thresholds and corners stay clean. The tile inspector explains each Stone material selection.

Torch placement follows actual north-facing room boundaries, including L/T-shaped rooms. It starts one tile from the room's left edge, repeats every four tiles, and skips walkable wall positions. Sconces and material conditions are decorative and do not alter exploration visibility or collision. Classic retains its existing rendering style.

See [Generation and Stone material rules](docs/generation-and-materials.md) for the exact placement, probability, texture-selection, weathering, shortcut, and compatibility rules.

## Using the core package

After building, another workspace consumer can generate and serialize floors without loading the editor:

```ts
import {
  DEFAULT_CONFIG,
  generateDungeon,
  exportFloorJson,
  importFloorJson,
} from '@dungeon-atelier/core'

const result = generateDungeon({
  ...DEFAULT_CONFIG,
  seed: 'the-old-vault',
  floorNumber: 3,
})

if (!result.ok) throw new Error(result.errors.join('\n'))

const json = exportFloorJson(result.floor)
const restored = importFloorJson(json)
if (!restored.ok) throw new Error(restored.errors.join('\n'))

console.log(restored.floor.rooms, restored.floor.diagnostics)
```

Other exports include `validateConfig`, `validateFloor`, grid helpers, configuration limits, and TypeScript types. The current JSON Schema is available as `@dungeon-atelier/core/schema`; the legacy schema is available as `@dungeon-atelier/core/schema/v1`.

### Floor format

New floors use schema version **2**, with strict support for importing existing version-1 files. The format stores:

- `schemaVersion` and `generatorVersion`;
- `seed`, `config`, `floorNumber`, `width`, and `height`;
- the row-major `tiles[y][x]` grid containing `wall`, `floor`, or `door`;
- room bounds with optional L/T footprints, door metadata, the up/down staircase pair, and diagnostics;
- optional room-group bounds, shared corridor cells, and member references for chamber blocks;
- layout settings, route metrics, and (from generator 2.1.0) ordered shortcut paths, endpoint room references, and measured savings in version 2; the importer preserves older version-1 files unchanged.

Coordinates are zero-based, with the origin at the top left. Door orientation describes **travel direction** (`north-south` or `east-west`), so the drawn leaf spans the perpendicular axis. IDs are deterministic within a floor; a future multi-floor consumer must pair them with floor identity.

Import validates schema structure, references, IDs, dimensions, geometry, connectivity, and diagnostics. Stored geometry is authoritative; import never calls generation. Reproducing from a seed requires the same configuration and generator version.

## Validation and current scope

Before contributing, run:

```sh
npm run lint:check
npm run typecheck
npm run build
```

An automated test framework and committed test suite are intentionally deferred. Current verification combines these checks, runtime validation on every generation/import, and browser smoke checks for movement, collisions, discovery, controls, rendering, and file operations.

This is a dungeon generator with a walk-through preview. Hidden doors are visible generator annotations and remain traversable in the preview; there is no search or discovery interaction for doors. Manual painting, locked doors, traps, water/lava terrain, encounters, combat, persistent game saves, and travel between floors are future work. Generation is synchronous and bounded; it does not yet run in a worker.
