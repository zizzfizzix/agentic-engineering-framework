# Test Architecture

This reference documents the test architecture for the project. The framework names, paths, counts,
and module names below are examples drawn from one platform's monorepo — substitute your project's
test runners, the paths in `aef.config.json` → `paths`, and the test commands in
`aef.config.json` → `validation`.

## Frameworks (example)

| Framework      | Purpose                  | Config                                                                                                                      |
| -------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Jest + ts-jest | Unit and component tests | `jest.config.cjs` (root + per-package + per-app)                                                                            |
| Playwright     | Integration / E2E tests  | the Playwright config under the tests root (`aef.config.json` → `paths.testsRoot`, e.g. `<testsRoot>/playwright.config.ts`) |

## File Counts (record this project's actual counts here)

Fill in this project's own totals — they feed the coverage percentages reported by `smart-test`:

- Unit/component tests: _N_ files (`*.test.ts`, `*.test.tsx`)
- Integration tests: _N_ files (`*.spec.ts` inside `__integration__/`)
- Total: _N_ test files

## Test File Conventions

```
packages/<pkg>/src/modules/<module>/
  __tests__/
    *.test.ts        # Jest unit tests
    *.test.tsx       # React component tests
  __integration__/
    meta.ts          # Module-level dependency declarations
    index.ts         # Sometimes used instead of meta.ts
    *.spec.ts        # Playwright integration tests
    <subfolder>/
      index.ts       # Subfolder dependency declarations (cascaded)
      *.spec.ts
      *.meta.ts      # Per-test dependency declarations (rare)
```

## Module Path Extraction

Extract module name from file path by finding `/modules/<name>/` (under `aef.config.json` → `paths.modulesRoot`). The example paths below are from one platform's layout:

| File path                                                | Module               |
| -------------------------------------------------------- | -------------------- |
| `packages/core/src/modules/customers/lib/foo.ts`         | `customers`          |
| `packages/core/src/modules/sales/api/...`                | `sales`              |
| `apps/<app>/src/modules/pos/page.tsx`                    | `pos`                |
| `packages/enterprise/src/modules/enterprise_pricing/...` | `enterprise_pricing` |

## Wide-Scope Triggers (→ run full suite)

These path prefixes indicate cross-cutting changes that affect all tests:

- `packages/shared/` — utilities, types, DSL helpers, i18n
- `packages/events/` — event bus
- `packages/queue/` — background workers
- `packages/cache/` — caching layer
- `jest.config.` — test runner config
- `jest.setup.` — test environment setup
- `tsconfig` — TypeScript configuration
- `package.json` (root) — deps/scripts
- monorepo build config (e.g. `turbo.json`, `nx.json`, or your build orchestrator's root config)

## Layer Classification (→ controls whether Playwright runs)

For any non-wide change, classify each modified source file into a layer to decide if integration tests are needed.

### UI layer — Jest only, **skip Playwright**

Only pure CSS / design tokens / Tailwind primitives qualify. These files cannot affect DOM structure or component interactivity.

| Pattern                         | Examples                                          |
| ------------------------------- | ------------------------------------------------- |
| `**/*.css`                      | Global stylesheets                                |
| `packages/ui/src/primitives/**` | Button.tsx, Badge.tsx — Radix/Tailwind primitives |
| `packages/ui/src/styles/**`     | CSS variables, Tailwind config                    |

### UI-Component layer — Jest + **run Playwright**

React components (`.tsx`) that render into pages visited by Playwright. A broken render, a missing element, or a changed conditional can break Playwright selectors even without touching any API.

| Pattern                            | Examples                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| `packages/ui/src/backend/**/*.tsx` | shared table/cell/feedback components rendered into pages |
| `**/frontend/**`                   | Next.js frontend pages                                    |
| `**/backend/**/*.tsx`              | Next.js backoffice pages                                  |
| `**/components/**`                 | React component files                                     |
| `**/widgets/**`                    | Reusable widget / embeddable component files              |

> **Important**: `backend/page.tsx` is a Next.js page (ui-component). `api/GET/route.ts` is an API route (api-logic). Don't confuse them.

### API-Logic layer — Jest + Playwright

| Pattern               | Examples                                |
| --------------------- | --------------------------------------- |
| `**/api/**`           | `api/GET/route.ts`, `api/POST/route.ts` |
| `**/commands/**`      | `commands/createCustomer.ts`            |
| `**/lib/**`           | `lib/pricing.ts`, `lib/utils.ts`        |
| `**/services/**`      | `services/emailService.ts`              |
| `**/subscribers/**`   | `subscribers/onOrderCreated.ts`         |
| `**/workers/**`       | `workers/syncWorker.ts`                 |
| `**/events.ts`        | Module event declarations               |
| `**/notifications.ts` | Module notification declarations        |
| `**/ai-tools.ts`      | MCP tool definitions                    |

### Data layer — Jest + Playwright (schema-sensitive)

| Pattern               | Examples                             |
| --------------------- | ------------------------------------ |
| `**/data/entities*`   | `data/entities.ts`, `data/entities/` |
| `**/data/migrations*` | `data/migrations/Migration001.ts`    |
| `**/data/validators*` | `data/validators.ts`                 |
| `**/data/extensions*` | `data/extensions.ts`                 |
| `**/data/enrichers*`  | `data/enrichers.ts`                  |

### Decision rule

```
layer = ui      → only if ALL changed files match UI patterns
layer = data    → if ANY changed file matches data patterns
layer = api-logic → if ANY changed file matches api-logic patterns (and none match data)
layer = mixed   → if changes span multiple layers
```

When `layer = ui`: skip Step 4 and Step 5 entirely — no Playwright.
When `layer = data` or `api-logic` or `mixed`: proceed with Playwright as normal.

## Integration Test Meta Format

Integration tests declare their module dependencies in `meta.ts` (or `index.ts`):

```typescript
// packages/core/src/modules/attachments/__integration__/meta.ts
export const integrationMeta = {
  dependsOnModules: ['attachments'],
}

// packages/core/src/modules/catalog/__integration__/meta.ts
export const integrationMeta = {
  dependsOnModules: ['shipping_carriers', 'payment_gateways', 'currencies'],
}
```

Supported keys (all equivalent): `dependsOnModules`, `requiredModules`, `requiresModules`

The discovery system that reads these declarations and filters tests based on enabled modules
lives in the project's CLI/testing library (one platform's example:
`packages/cli/src/lib/testing/integration-discovery.ts`).

## Known Cross-Module Integration Dependencies

All `__integration__` directories should have `meta.ts` files with explicit dependency declarations.
Document this project's cross-module dependencies here (modules with only self-references can be
omitted). The project should fill in its own dependency map — one row per test module that declares
extra `dependsOnModules`:

| Test module     | Also requires           |
| --------------- | ----------------------- |
| _<your module>_ | _<modules it requires>_ |

## Unit Test Run Commands

Use the unit test command from `aef.config.json` → `validation`. The commands below are one platform's examples:

```bash
yarn test                              # All unit tests (turbo)
yarn jest --findRelatedTests <files>   # Related tests for specific files
yarn jest <file>                       # Single test file
yarn workspace <pkg> test              # Single package (example)
```

## Integration Test Run Commands

Use the integration test command from `aef.config.json` → `validation` and the Playwright config under the tests root. The commands below are examples:

```bash
yarn test:integration                  # Full integration suite
yarn playwright test <spec> --config=<testsRoot>/playwright.config.ts  # Specific specs
yarn test:integration:coverage         # With coverage
yarn test:integration:report           # View HTML report
```

## CI Pipeline

The pipeline runs the project's verification gate (`aef.config.json` → `validation`) on every PR — typically:

1. the unit test command — all unit tests (every PR)
2. the integration test command (with coverage) — integration tests on an ephemeral app (every PR)

## Environment Variables Affecting Test Selection

The variables below are one platform's examples (enterprise-overlay gating); substitute your project's:

| Variable                            | Effect                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `OM_ENABLE_ENTERPRISE_MODULES=true` | Includes enterprise overlay integration tests                                                 |
| `OM_INTEGRATION_OVERLAY_ROOT`       | Overrides overlay detection root (default: an enterprise package, e.g. `packages/enterprise`) |
