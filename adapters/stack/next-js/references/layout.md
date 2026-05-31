## Repository layout

Next.js App Router project, optionally a workspaces monorepo. Resolve concrete paths from
`framework.config.json` → `paths`:

- **Routes / UI** — the `app/` directory (route segments, `layout.tsx`, `page.tsx`, route handlers
  under `app/**/route.ts`). Server Components by default.
- **Modules / domain code** — `paths.modulesRoot` (e.g. `src/modules` or `packages/*`).
- **Specs** — `paths.specsRoot`; **tests** — `paths.testsRoot`.

In a monorepo, prefer the package that owns the concern; cross-package imports go through each
package's public entrypoint, never deep relative paths.
