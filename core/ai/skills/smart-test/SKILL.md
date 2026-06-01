---
name: smart-test
description: Run only the tests affected by changed code. Use when the user says "run affected tests", "run smart tests", "test only what changed", "run tests for this PR", "run tests for my changes", "selective tests", or asks to run tests without running the full suite.
---

# Smart Test — Run Only Affected Tests

Runs the minimal set of tests that cover the code changes in the current branch or working tree.

**Execution policy**: Display the test plan (which tests will run and why), then **immediately run them without asking for confirmation**.

**Cache**: Analysis results are persisted to `.test-cache.json` (gitignored). On repeated invocations for the same commit with no uncommitted changes, the cached plan is reused — skip straight to running tests.

## Two Test Types, Two Strategies

| Type                     | Files                             | Strategy                                                   |
| ------------------------ | --------------------------------- | ---------------------------------------------------------- |
| Jest (unit/component)    | `*.test.ts`, `*.test.tsx`         | `--findRelatedTests` (Jest traverses import graph)         |
| Playwright (integration) | `*.spec.ts` in `__integration__/` | Module-name matching via `meta.ts` dependency declarations |

---

## Step 0 — Cache Lookup

Before doing any git analysis, check whether a valid cached plan already exists for the current state.

```bash
CURRENT_HASH=$(git rev-parse HEAD)
UNCOMMITTED=$(git diff --name-only HEAD; git ls-files --others --exclude-standard)
```

Read `.test-cache.json` (if it exists). The cache is **valid** when:

1. `cache.commitHash` equals `CURRENT_HASH`, **and**
2. `UNCOMMITTED` is empty (no staged/unstaged/untracked changes), **and**
3. The commit is reachable from HEAD: `git merge-base --is-ancestor <cache.commitHash> HEAD 2>/dev/null` exits 0

```bash
git merge-base --is-ancestor "${cache.commitHash}" HEAD 2>/dev/null && echo "reachable" || echo "stale"
```

Condition 3 guards against stale cache entries after a rebase, amend, or force-push. The old hash may still exist as a dangling object in the git store (`git cat-file -e` would return true), but it is no longer part of the branch history — `git merge-base --is-ancestor` correctly rejects it.

**If cache is valid**: skip Steps 1–5, print `[cache hit: <hash>]`, and run tests from the cached plan (the Jest/Playwright commands below are one platform's examples — use the project's unit and integration test commands from `framework.config.json` → `validation`):

- **Unit (e.g. Jest)**: `yarn jest --findRelatedTests <cache.jestSourceFiles> --passWithNoTests`
- **Integration (e.g. Playwright)**: if `cache.integrationWide` is `true` → run the full integration suite (e.g. `yarn test:integration`); else if `cache.integrationSpecFiles` is non-empty → run those spec files with the Playwright config under the tests root (e.g. `yarn playwright test <cache.integrationSpecFiles> --config=<testsRoot>/playwright.config.ts`, where `<testsRoot>` is `framework.config.json` → `paths.testsRoot`); else skip.

**If cache is invalid or missing**: continue to Step 1. After completing Steps 1–2, write the cache (see "Save Cache" below) before running tests.

### Cache file format (`.test-cache.json`)

```json
{
  "commitHash": "<git rev-parse HEAD>",
  "savedAt": "<ISO timestamp>",
  "scope": "module | wide | test-only | package",
  "layer": "ui | ui-component | api-logic | data | mixed",
  "affectedModules": ["auth", "sales"],
  "jestSourceFiles": ["packages/core/src/modules/auth/commands/users.ts"],
  "integrationSpecFiles": ["packages/core/src/modules/auth/__integration__/TC-AUTH-001.spec.ts"],
  "integrationWide": false
}
```

`integrationWide: true` means the Python script returned `--all`; in that case `integrationSpecFiles` is empty and the full integration suite runs.

`layer` values: `ui` = skip Playwright; `ui-component`, `api-logic`, `data`, or `mixed` = run Playwright.

### Save Cache

After completing the analysis (Steps 1–2), write the plan before running tests:

```bash
node -e "
const fs = require('fs');
const plan = {
  commitHash: '$(git rev-parse HEAD)',
  savedAt: new Date().toISOString(),
  scope: '<scope>',
  layer: '<ui|ui-component|api-logic|data|mixed>',
  affectedModules: <json-array-of-modules>,
  jestSourceFiles: <json-array>,
  integrationSpecFiles: <json-array>,
  integrationWide: <true|false>
};
fs.writeFileSync('.test-cache.json', JSON.stringify(plan, null, 2));
"
```

---

## Step 1 — Determine Changed Files

Build one changed-file list and reuse it for cache invalidation, classification, Jest, and
Playwright mapping. Include PR diff, local staged/unstaged changes, and untracked files:

First resolve the comparison base. Do **not** guess the default branch when the branch is based on
a different long-lived branch; comparing (for example) a develop-based branch to the configured
default branch (`framework.config.json` → `git.defaultBranch`) can pull in unrelated shared-package
changes from the long-lived branch and incorrectly force the full suite. The `develop` / `origin/develop`
names below are illustrative examples of a long-lived integration branch — substitute your project's.

```bash
BASE_REF="${SMART_TEST_BASE_REF:-}"
if [ -z "$BASE_REF" ]; then
  BASE_REF="$(git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null || true)"
fi
if [ -z "$BASE_REF" ] && git rev-parse --verify --quiet origin/develop >/dev/null; then
  if git merge-base --fork-point origin/develop HEAD >/dev/null 2>&1 || git merge-base --is-ancestor origin/develop HEAD; then
    BASE_REF="origin/develop"
  fi
fi
if [ -z "$BASE_REF" ] && git rev-parse --verify --quiet develop >/dev/null; then
  if git merge-base --fork-point develop HEAD >/dev/null 2>&1 || git merge-base --is-ancestor develop HEAD; then
    BASE_REF="develop"
  fi
fi

CHANGED_FILES=$({
  if [ -n "$BASE_REF" ]; then
    git diff --name-only "$BASE_REF"...HEAD
  fi
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} | awk '!seen[$0]++')
```

If the diff against the configured default branch (`framework.config.json` → `git.defaultBranch`,
e.g. `git diff --name-only origin/main...HEAD`) contains shared-package changes but `$BASE_REF` is
the long-lived integration branch (e.g. `origin/develop`/`develop`) and the `$BASE_REF...HEAD` diff
does not contain those shared-package changes, do not classify the branch as wide-scope. Report it as
a base-ref mismatch and use the resolved long-lived-branch base.

If there is no upstream PR context, use only local changes and untracked files:

```bash
CHANGED_FILES=$({
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} | awk '!seen[$0]++')
```

---

## Step 2 — Classify Scope and Layer

### 2a — Scope

Read the changed file list and classify scope:

The path patterns below are examples from a typical monorepo layout (`packages/...`, `apps/<app>/...`); substitute your project's structure (`framework.config.json` → `paths.modulesRoot` for modules) and shared/foundational packages.

- **Wide scope** (run everything): changes in shared/foundational packages (e.g. `packages/shared/`, `packages/events/`, `packages/queue/`, `packages/cache/`), or root test/TS config (e.g. `jest.config.cjs`, `jest.setup.ts`, `tsconfig*.json`)
- **UI-wide** (e.g. `packages/ui/src/backend/`): shared UI components rendered on every backend page — unit: `--findRelatedTests`; integration: full suite (the Python script outputs `--all` for these paths). For UI primitives/styles only (e.g. `packages/ui/src/primitives/` or `packages/ui/src/styles/`), classify as `ui` layer instead (no integration tests).
- **Module-scoped**: a module path under the modules root (e.g. `packages/*/src/modules/<module>/` or `<modulesRoot>/<module>/`) → extract `<module>`
- **Package-scoped** (no module): a package's `src/lib/` or `src/` root (e.g. `packages/<pkg>/src/lib/`) — treat as wide scope for that package
- **Unit-test-only**: only `.test.ts`/`.test.tsx` files changed → run those files directly via the unit test runner; skip integration tests
- **Integration-test-only**: only `.spec.ts` files inside `__integration__/` changed → run those files directly with the integration runner and the Playwright config under the tests root (e.g. `yarn playwright test <files> --config=<testsRoot>/playwright.config.ts`); skip unit tests

See `references/test-architecture.md` for module extraction patterns and known cross-module integration dependencies.

### 2b — Layer (determines whether Playwright runs)

After determining scope, classify the **layer** of each changed source file. Integration (Playwright) tests only need to run when backend logic or data is touched — they are irrelevant for pure UI changes.

**Classify each changed file** (the `packages/ui/...` path indicators below are examples from one platform's layout — match the equivalent UI/component/api/data paths in your project):

| Layer          | Path indicators                                                                                                                    | Playwright needed?                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ui`           | `**/*.css` · `packages/ui/src/primitives/` · `packages/ui/src/styles/`                                                             | **No**                                                                                                      |
| `ui-component` | `packages/ui/src/backend/**/*.tsx` · `/components/` · `/widgets/` · `/frontend/` · `/backend/**/*.tsx` (framework page files)      | **Yes** — integration tests render full pages; a broken component can crash a page load or break a selector |
| `api-logic`    | `/api/` · `/commands/` · `/lib/` · `/services/` · `/subscribers/` · `/workers/` · `events.ts` · `notifications.ts` · `ai-tools.ts` | **Yes**                                                                                                     |
| `data`         | `/data/entities` · `/data/migrations` · `/data/validators` · `/data/extensions` · `/data/enrichers`                                | **Yes**                                                                                                     |

**Layer decision rule — set `$LAYER` as a shell variable:**

- All changed files → `ui` only (CSS / design tokens / primitives) → `LAYER=ui`, **skip Playwright**
- Any file → `data` patterns → `LAYER=data`, **run Playwright**
- Any file → `api-logic` patterns (and none match `data`) → `LAYER=api-logic`, **run Playwright**
- Any file → `ui-component` patterns (and none match `api-logic` or `data`) → `LAYER=ui-component`, **run Playwright**
- Files span multiple non-`ui` layers → `LAYER=mixed`, **run Playwright**
- Wide scope always → **run everything**

```bash
LAYER="<ui|ui-component|api-logic|data|mixed>"  # required: used in Step 5 and cache
```

**Why `ui-component` needs Playwright**: integration tests render full pages. A React component that throws during render, a conditional that hides a button, or a changed DOM structure can all break Playwright selectors — even without touching any API.

**Only skip Playwright when** the change cannot affect DOM structure or interactivity: pure CSS, design tokens, Tailwind config, color/spacing primitives.

**Special cases:**

- Module `backend/page.tsx`, `backend/[id]/page.tsx` — framework page files → `ui-component` (integration tests visit these pages)
- Module `api/GET/route.ts`, `api/POST/route.ts` → API routes → `api-logic`

→ **Save cache now** (see Step 0 — Save Cache, include `layer` field) before proceeding to run tests.

---

## Step 3 — Jest Unit Tests

If the project's unit runner supports related-test discovery (e.g. Jest's built-in `--findRelatedTests`), use it. It traverses the import graph from changed source files and discovers every test that (directly or transitively) imports them. The `yarn jest` / `yarn test` commands below are one platform's examples — use the unit test command from `framework.config.json` → `validation`.

```bash
# Build the list of changed source files (exclude test files themselves)
CHANGED=$(printf '%s\n' "$CHANGED_FILES" \
  | grep -E '\.(ts|tsx)$' \
  | grep -v '\.test\.' \
  | grep -v '\.spec\.' \
  | grep -v '__tests__/' \
  | grep -v '__integration__/' \
  | tr '\n' ' ')

# Run related tests (passWithNoTests handles no-match gracefully)
yarn jest --findRelatedTests $CHANGED --passWithNoTests
```

**Wide scope fallback**: when `CHANGED` includes shared/events/queue/cache files, run the full unit suite instead (the test command from `framework.config.json` → `validation`, e.g. `yarn test`).

---

## Step 4 — Ensure Server Is Running (Integration Tests Only)

Before running any Playwright tests, verify the app is accessible on port 3000.

```bash
curl -sf http://localhost:3000 > /dev/null 2>&1
```

**If the server is running** (exit code 0): proceed directly to Step 5.

**If the server is NOT running**: build the project and start the production server (the `yarn build` / `yarn start` commands below are examples — use the project's build command from `framework.config.json` → `validation` and its start command):

```bash
# Build everything (packages + app)
yarn build

# Start production server in background
yarn start &
APP_PID=$!

# Wait up to 2 minutes for server to become ready
echo "Waiting for server on port 3000..."
SERVER_READY=0
for i in $(seq 1 60); do
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "Server ready."
    SERVER_READY=1
    break
  fi
  sleep 2
done

if [ "$SERVER_READY" -eq 0 ]; then
  echo "ERROR: Server did not become ready within 2 minutes. Aborting integration tests."
  exit 1
fi
```

After tests finish, leave the server running — do not kill it.

---

## Step 5 — Integration Tests (Playwright)

**Layer gate**: if `layer = ui` (all changed files are UI-only), skip this step entirely — Playwright tests are not affected by pure UI changes.

Otherwise, use the Python script to map changed modules → affected spec files.
Pass `--layer` so the script can apply the correct triggering rules:

The script lives in this skill's `scripts/` directory; the integration commands below are examples — use the integration test command from `framework.config.json` → `validation` and the Playwright config under the tests root (`framework.config.json` → `paths.testsRoot`).

```bash
SPEC_FILES=$(printf '%s\n' "$CHANGED_FILES" \
  | python3 <skill-dir>/scripts/find_affected_integration_tests.py \
    --project-root . \
    --base auto \
    --layer "$LAYER")

if [ "$SPEC_FILES" = "--all" ]; then
  yarn test:integration
elif [ -n "$SPEC_FILES" ]; then
  yarn playwright test $SPEC_FILES --config=<testsRoot>/playwright.config.ts
else
  echo "No affected integration tests found."
fi
```

`$LAYER` is the value determined in Step 2b (`ui-component`, `api-logic`, `data`, or `mixed`).

**Layer-aware dep filtering**: when `LAYER=ui-component`, the script only runs tests whose
own module changed — it ignores cross-module `dependsOnModules` declarations. Rationale: a
changed `page.tsx` or React component cannot break another module's API calls; only tests
that actually visit those pages need to run.

**Workspace scoping**: the script compares module identity by both module name and runtime
root. Two modules that share the same name but live in different roots (e.g. an app module and a
scaffolding-template module of the same name) are treated as separate modules, so a change in one
root does not trigger integration specs from the other.

**Wide scope**: if the script outputs `--all` (triggered when shared deps changed), run the full integration suite.

**Data layer**: if `layer = data` (entities/migrations changed), integration tests are
particularly important. Run normally via the script — the mapping will include all tests for
the affected module including any that declare it as a dependency.

---

## Step 6 — Report Results

After tests complete, summarize:

- Whether results came from cache (`[cache hit]`) or fresh analysis
- How many Jest tests ran vs full suite
- Which integration spec files ran and why (which changed module triggered each)
- Whether the server was already running or was built and started
- Any wide-scope fallback applied and why

**Coverage percentages** (always include at the end):

| Type                                     | Ran     | Total     | %                    |
| ---------------------------------------- | ------- | --------- | -------------------- |
| Unit (e.g. Jest suites)                  | `<ran>` | `<total>` | `<ran/total * 100>`% |
| Integration (e.g. Playwright spec files) | `<ran>` | `<total>` | `<ran/total * 100>`% |

Totals come from this project's recorded suite counts (see `references/test-architecture.md`, which the project should fill in with its own numbers). Round to one decimal place.

---

## Decision Tree

```
Step 0: .test-cache.json valid (hash + no uncommitted + reachable)?
  └─ YES → run from cache; check integrationWide flag:
           integrationWide=true  → unit: cached files + integration: full suite
           integrationWide=false → unit: cached files + integration: cached spec files (or skip)
  └─ NO  → analyze:

       Step 2a — Scope:
         └─ Only .test.ts/.test.tsx?        → unit: run those files directly; integration: skip
         └─ Only .spec.ts (__integration__/)? → unit: skip; integration: run those files directly
         └─ shared/events/queue/cache/root config?
                                            → Full suite (unit + integration commands from validation)
         └─ UI-wide (e.g. packages/ui/src/backend/)? → unit: --findRelatedTests; integration: full suite
         └─ Module-scoped?                  → extract module name(s)
         └─ Package lib (no module)?        → --findRelatedTests for that package

       Step 2b — Layer (for non-wide, non-test-only scopes):
         └─ ALL files are pure CSS / design tokens / primitives?
              → LAYER=ui
              → Jest: --findRelatedTests <changed-src-files>
              → Integration: SKIP (no DOM structure change possible)
         └─ ANY file is ui-component / api-logic / data?
              → LAYER=<ui-component|api-logic|data|mixed>
              → Jest: --findRelatedTests <changed-src-files>
              → Integration: check server → script maps modules → spec files

       → Set $LAYER → Save cache (with layer field) → run tests
```

---

## Reference Files

- `references/test-architecture.md` — full test structure, module path patterns, framework configs, known cross-module integration dependencies
