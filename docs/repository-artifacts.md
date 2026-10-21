# Repository artifacts

Application source, runtime assets, asset provenance, documentation, curated approved references, and required test fixtures belong in Git. Generated screenshot matrices, visual reports, benchmark captures, and temporary browser profiles do not.

- `apps/dungeon-atelier/src/assets/` contains the runtime art and preserved source art. Do not exclude image extensions globally.
- `docs/visual-references/` holds a deliberately small approved reference set and its provenance manifest.
- `tests/fixtures/` holds required deterministic fixtures, including the generated floor used by the cap-polish verifier. Keep fixture changes intentional.
- `reports/` and a root `screenshots/` directory are ignored by Git and Prettier. Existing local files are retained. Historical milestone links to `reports/` describe local generated output.
- `.cache/`, dependencies and build outputs are already ignored. Recovery bundles under `.cache/repository-backups/` are local only and must never be committed.

## Recreating visual reports

Follow the [Development Efficiency Policy](../AGENTS.md). The commands below are optional, task-specific reproduction tools, not a checklist for routine work. Default to 1–2 necessary representative screenshots; larger comparisons require an explicit request or a specific diagnostic need. Keep temporary logs, traces, benchmark output, and browser profiles under ignored `reports/` or `.cache/` too.

Run the standard development server in one terminal. In another, set `ATELIER_URL` to the URL printed by Quasar where the verifier supports it. Verifiers use temporary workspace-local browser profiles and close them after each run.

```sh
npm run verify:3d
node scripts/verify-dungeon-3d-themes.mjs --baseline
node scripts/verify-dungeon-3d-themes.mjs
node scripts/verify-dungeon-effects.mjs --stage=baseline
node scripts/verify-dungeon-effects.mjs --stage=combined
node scripts/verify-cap-edge-response.mjs --before
node scripts/verify-cap-edge-response.mjs
```

Before/after studies need their baseline run first. Capture the baseline before making a renderer change; generating it afterward cannot prove preservation of the prior renderer. Other milestone-specific commands and prerequisite report generation are documented alongside their scripts in `docs/`. Generated reports are useful locally without becoming permanent repository history.

## History cleanup

The artifact cleanup removes generated `reports/` entries from the current tree while retaining all local captures. A subsequent, separately authorized rewrite removes that path from earlier commits too. Curated references are copied into their permanent documentation directory before filtering. Runtime art and all other source paths are preserved throughout history.

Rewriting changes commit IDs. Existing collaborators should re-clone or explicitly realign their branches before publishing further work, so the old artifact history is not merged back. Recovery bundles preserve the original local history; do not push their old refs. GitHub may retain unreachable objects and cached commit pages until its own cleanup; a cleaned branch does not guarantee immediate deletion of every server-side cached object.
