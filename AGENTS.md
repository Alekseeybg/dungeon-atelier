# Project instructions

These instructions apply throughout DungeonAtelier and to all future tasks. Follow explicit user requirements and preserve existing project-specific constraints. The Development Efficiency Policy supplies defaults; correctness, maintainability, essential security checks, meaningful tests, and necessary visual verification take priority.

## Development Efficiency Policy

- **Documentation:** Do not create Markdown reports for routine tasks. Document meaningful architectural decisions, public APIs, or important behavior changes only, without duplicating existing documentation. Keep ordinary task summaries in the final response. Create separate reports only when requested.
- **Screenshots:** Capture images only when needed for visual work or regression testing. Default to 1–2 representative screenshots. Use larger matrices only when explicitly requested or necessary to diagnose a specific problem. Reuse existing browser sessions and captures where practical; avoid redundant images and unnecessary browser launches.
- **Testing:** Always test changed functionality appropriately. Use focused checks during development, then broader validation once near completion when warranted. Do not repeatedly run unchanged suites. Preserve existing automated tests and quality standards; never omit essential security, correctness, or regression checks to save tokens.
- **Artifacts:** Put temporary screenshots, logs, traces, benchmarks, visual reports, and browser profiles under ignored `reports/` or `.cache/`. Check Git status before committing and update `.gitignore` for any new generated-output location. Never commit disposable artifacts, recovery bundles, or caches. Preserve required production assets, approved references, and test fixtures; do not ignore image extensions globally. See [artifact locations](docs/repository-artifacts.md).
- **Efficiency:** Inspect relevant files rather than repeatedly scanning the repository. Keep tool output concise. Avoid unnecessary planning documents, repeated explanations, unrelated documentation, and unrelated tests. Make focused, minimal changes and reuse existing utilities.
- **Completion:** Give a concise final response stating what changed, what was tested, and any failures or remaining issues. Do not generate a separate routine report.

## Workflow and scope

- Run repository commands from the root. Reuse the running development server where practical; application and generator edits should update its existing browser tab through the standard Quasar/Vite workflow.
- README and milestone documents list available verification tools and historical campaigns. Their screenshot matrices, before/after reports, and 10,000-floor stress campaigns are task-specific procedures, not mandatory steps for every task. Select checks by the affected behavior and risk; an explicit task requirement still applies.
- Preserve the framework-independent generation core, deterministic generation, connectivity, collision, material continuity, secret concealment, saved-format compatibility, and existing validation suite unless the user explicitly requests a relevant change.
- Keep Three.js playground work separate from production Canvas appearances and defaults unless integration is explicitly requested. Preserve approved visual assets and theme behavior outside the task's scope.
