## Repository layout

Single-repo Node/TypeScript project. Always resolve concrete paths from
`framework.config.json` → `paths`, never hard-code them:

- **Source / modules** — `paths.modulesRoot` (e.g. `src/`). One feature or module per directory.
- **Specs** — `paths.specsRoot` (e.g. `.ai/specs`).
- **Tests** — `paths.testsRoot` (e.g. `.ai/qa/tests`).

Colocate small unit tests with the code; keep integration/e2e suites under `testsRoot`.
