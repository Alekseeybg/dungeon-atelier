# Input, verifier storage, and floor-edge fixes

The 3D viewport supports **Alt + left-drag** for rotation in addition to right-drag. Left-drag still pans; middle-drag still adjusts elevation. Opera's native right-button navigation gestures are browser features, so the app does not claim to disable them per site. Use Alt-left in the dungeon, or disable **Enable mouse gestures** under Opera Settings → Features → Shortcuts if you prefer right-drag. See [Opera's gesture settings](https://help.opera.com/en/latest/shortcuts/).

The dark rectangular floor bands were separate transparent gradient meshes along every wall edge. They were independent of the Shadows and Torch lighting toggles. These meshes and their dedicated material/texture have been removed. Real light-cast shadows remain controlled by the Shadows toggle; masonry weathering and the approved caps remain unchanged.

[Before, top-down](../reports/runtime-fixes/before-top-down.png) · [After, top-down](../reports/runtime-fixes/after-top-down.png) · [After, angled](../reports/runtime-fixes/after-angled.png).

## Temporary verifier profiles

The browser verification helper launches an isolated headless Chrome instance for automated tests and screenshots. **Starting `npm run dev` does not launch it.** Its old implementation closed Chrome but retained the temporary user-data directories on C:. The standalone legacy verifier duplicated the same leak.

Cleanup removed 87 inactive, project-specific `atelier-browser-*` directories from the user's temporary directory, recovering **5.26 GiB**. Active Chrome profiles, the personal Opera profile, and unrelated temporary files were excluded. New verifier profiles and temporary projection downloads now live in the ignored project directory `.cache/browser-tests/`, on the project's drive. Chrome closes gracefully, cleanup retries file locks, and successful runs and failed launches remove their profiles. The legacy verifier uses the same shared lifecycle instead of a duplicated launcher.

`node scripts/verify-browser-lifecycle.mjs` checks normal close, unawaited legacy close, repeated close, missing-browser failure cleanup, and that no new directories remain. `node scripts/verify-runtime-fixes.mjs` checks the 3D Alt-left rotation and cap fingerprints and captures the floor with real shadows and torch lighting both disabled.

## Memory investigation

A controlled stop/start measurement is recorded in [memory.json](../reports/runtime-diagnostics/memory.json). The system-managed C: paging file stayed at 13,200 MiB throughout. The server used about 2.32 GiB private memory before stopping and 1.43 GiB after restart. Restarting did not reproduce a multi-gigabyte C: free-space drop; the observed free-space difference was about 7 MiB. The confirmed accumulated disk leak was the test profiles; the previously reported transient drop was not independently reproduced. No paging-file or other Windows settings were changed.
