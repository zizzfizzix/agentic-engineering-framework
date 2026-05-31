---
name: implement-spec
description: Implement a specification (or specific phases) using coordinated subagents with unit tests, integration tests, docs, and code-review compliance. Tracks progress by updating the spec. Triggers on "implement spec", "implement phases", "build from spec", "code the spec".
---

# Implement Spec Skill

Implements a specification (or selected phases) end-to-end using a team of coordinated subagents. Every code change MUST pass the code-review checklist before the phase is considered done.

## Pre-Flight

1. **Identify the spec**: Locate the target spec file(s) under the specs root (`framework.config.json` → `paths.specsRoot`; include any `enterprise/` subfolder if the project uses one).
2. **Load context**: Read spec fully. Read all AGENTS.md files listed in the Task Router that match the affected modules/packages.
3. **Load code-review checklist**: Read the `code-review` skill's `references/review-checklist.md` — this is the acceptance gate for every phase.
4. **Load lessons**: Read the project's lessons file (e.g. `.ai/lessons.md`) for known pitfalls.
5. **Scope phases**: If the user specifies phases (e.g. "phases e-h"), filter to only those. Otherwise implement all phases sequentially.

## Extension Mode Decision (Mandatory First Step)

Before writing any code, ask the user:

> **Where should this feature live?**
>
> 1. **External extension** (npm package / standalone repo) — uses the platform's extension points (widgets, events, enrichers, API interceptors) to add functionality without modifying core. Best for: custom business logic, vertical features, third-party integrations. Preserves upgrade path.
> 2. **Core modification** (inside core platform packages/app) — directly modifies the platform. Best for: foundational platform capabilities that all users need.

### If user chooses External Extension

- Determine if the user is working inside a scaffolded app repo or wants a standalone npm package.
- **Standalone npm package**: Create the package with proper scoped naming and `package.json`.
- **App-level module**: Place code under the modules root (`framework.config.json` → `paths.modulesRoot`, e.g. `<modulesRoot>/<module>/`), or the user's app repo.
- **Maximize platform extension features**: Use widget injection, event subscribers, response enrichers, API interceptors, custom fields/entities, and menu injection to achieve the goal without touching core code.
- **Never modify core platform packages** (e.g. the core/ui/shared packages) unless absolutely necessary for a missing extension point — and if so, the missing extension point itself becomes a prerequisite spec.

### If user chooses Core Modification

Ask a confirmation:

> **Are you sure?** Modifying core means:
>
> - Third-party modules depending on changed surfaces may break
> - Backward compatibility contract applies (13 frozen/stable categories)
> - Users who forked or extended these files will have merge conflicts on upgrade
> - Changes require deprecation protocol if touching any contract surface
>
> Proceed with core modification?

Only continue with core changes after explicit confirmation.

## Implementation Workflow

For **each phase** in the spec, execute these steps:

### Step 1 — Plan the Phase

Read the phase from the spec. For each step within the phase:

- Identify files to create or modify
- Identify which AGENTS.md guides apply (use Task Router)
- Identify backward compatibility concerns (check the project's backward-compatibility contract surfaces, e.g. a `BACKWARD_COMPATIBILITY.md`)
- List required exports, conventions, and patterns from the relevant AGENTS.md
- Note any cross-module impacts (events, extensions, widgets, enrichers)

Present a brief plan to the user before coding.

### Step 2 — Implement

Use subagents liberally to parallelize independent work:

- **One subagent per independent file/component** when files don't depend on each other
- **Sequential execution** when there are dependencies (e.g., entity before API route before backend page)

For every piece of code, enforce these code-review rules inline. The package import paths below (`@open-mercato/...`) are examples drawn from one platform — substitute your project's equivalents:

| Area                                | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                               | No `any` — use zod + `z.infer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| API routes                          | Export `openApi` and per-method `metadata` with `requireAuth` / `requireFeatures` (no top-level `export const requireAuth`)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **CRUD APIs**                       | **Use `makeCrudRoute({ entity, entityId, operations, schema, indexer: { entityType } })` from the shared CRUD factory (e.g. `@open-mercato/shared/lib/crud/factory`). Custom (non-`makeCrudRoute`) write routes MUST call `validateCrudMutationGuard` before the mutation and `runCrudMutationGuardAfterSuccess` after success. See the core package's AGENTS.md → API Routes / CRUD Factory.**                                                                                                                                               |
| Entities                            | Standard columns, snake_case, UUID PKs, indexed `organization_id` + `tenant_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Security                            | `findWithDecryption`, tenant scoping, zod validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Encryption maps**                 | **For every PII / GDPR-relevant column the phase touches, declare in `<module>/encryption.ts` exporting `defaultEncryptionMaps` (type from the shared encryption module, e.g. `@open-mercato/shared/modules/encryption`). Reads via `findWithDecryption` / `findOneWithDecryption` (5-arg `(em, entity, where, options?, scope?)`). Equality-lookup columns declare a sibling `hashField`. NEVER hand-rolled AES/KMS, `crypto.subtle`, or "encrypt later" stubs. See the core package's AGENTS.md → Encryption + the encryption user guide.** |
| UI                                  | `CrudForm`/`DataTable` (with stable `entityId` + `extensionTableId`), `apiCall` (never raw `fetch`), `flash()`, `LoadingMessage`/`ErrorMessage`                                                                                                                                                                                                                                                                                                                                                                                               |
| **Frontend performance boundaries** | **Implement the spec's Frontend Architecture Contract. Generated framework `page.tsx`/`layout.tsx` roots default to server components. Every `"use client"` needs a ledger justification. Split large client blobs into local leaves, lazy-scope provider/bootstrap registries, dynamically/local-import heavy browser libraries, and capture hydration/interactivity + performance evidence before merge. Run any client-boundary check listed in `framework.config.json` → `validation` for generated frontend/app shell changes.**         |
| **Design System**                   | **Semantic status tokens (no `text-red-*` / `bg-green-*`); Tailwind text scale (no `text-[13px]` / `text-[11px]`); shared primitives `StatusBadge` / `Alert` / `FormField` / `SectionHeader` / `CollapsibleSection` / `LoadingMessage` / `Spinner` / `DataLoader` / `EmptyState`; lucide-react icons in PAGE BODY (never inline `<svg>`); `aria-label` on every icon-only button; Boy Scout rule on touched lines. See root `AGENTS.md` → Design System Rules + the project's design-system / UI-components references.**                     |
| **Cache**                           | **Resolve via DI (`container.resolve('cache')`); tag with `tenant:<id>` / `org:<id>`; declare invalidation per write path. NEVER `new Redis(...)` or raw SQLite. See the cache package's AGENTS.md.**                                                                                                                                                                                                                                                                                                                                         |
| Commands                            | `registerCommand`, undoable, `extractUndoPayload()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Events                              | `createModuleEvents()` with `as const`; subscribers export `metadata`; cross-module side effects via subscribers, never direct imports                                                                                                                                                                                                                                                                                                                                                                                                        |
| i18n                                | `useT()` client, `resolveTranslations()` server, no hardcoded strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Imports                             | Package-level scoped imports (e.g. `@open-mercato/<pkg>/...`) for cross-module                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Mutations                           | `useGuardedMutation` when not using CrudForm; pass `retryLastMutation` in injection context                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Keyboard                            | `Cmd/Ctrl+Enter` submit, `Escape` cancel on dialogs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Naming                              | Modules plural snake_case, events `module.entity.past_tense`, features `module.action`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Step 3 — Unit Tests

For every new feature/function implemented in the phase:

- Create unit tests colocated with the source (e.g., `*.test.ts` or `__tests__/`)
- Test happy path + key edge cases
- Test error paths for validation and authorization
- Mock external dependencies (DI services, data engine)
- Verify tests pass using the test command listed in `framework.config.json` → `validation` (scoped to the affected module where the runner supports it)

### Step 4 — Integration Tests

If the spec defines integration test scenarios (or the phase adds API endpoints / UI flows):

- Follow the `integration-tests` skill workflow
- Place tests under the affected module (e.g. `<module>/__integration__/TC-{CATEGORY}-{XXX}.spec.ts`)
- Tests MUST be self-contained: create fixtures in setup, clean up in teardown
- Tests MUST NOT rely on seeded/demo data
- Run and verify with the integration test runner configured under the tests root (`framework.config.json` → `paths.testsRoot`), e.g. running the project's test/e2e command against the new test path with retries disabled

If the spec does not explicitly list integration scenarios but the phase adds significant API or UI behavior, propose test scenarios to the user before writing them.

### Step 5 — Documentation

For each new feature:

- Add/update locale files for new i18n keys
- If new entities with user-facing text: create `translations.ts`
- If new convention files: run the project's code-generation/prepare command (see `framework.config.json` → `validation` and project AGENTS.md)
- Update relevant AGENTS.md if the feature introduces new patterns developers should follow

### Step 6 — Self-Review (Code-Review Gate)

Before marking a phase complete, run a self-review against the full checklist:

1. **Architecture & Module Independence** (checklist section 1)
2. **Security & Authentication** (section 2)
3. **Data Integrity & ORM** (section 3)
4. **API Routes** (section 4) — if applicable
5. **Events** (section 5) — if applicable
6. **Commands & Undo/Redo** (section 6) — if applicable
7. **Search** (section 7) — if applicable
8. **Cache** (section 8) — if applicable
9. **Queue & Workers** (section 9) — if applicable
10. **Module Setup** (section 10) — if applicable
11. **Custom Fields** (section 11) — if applicable
12. **UI & Backend Pages** (section 12) — if applicable
    - For generated/frontend pages, confirm the Frontend Architecture Contract was implemented: page roots stay server-first, every `"use client"` is justified, no large client-side blob was introduced, provider/bootstrap registries are scoped, hydration/interactivity tests cover changed routes, performance evidence is attached, and any client-boundary check (`framework.config.json` → `validation`) was run or explicitly waived.
13. **i18n** (section 13)
14. **Naming** (section 14)
15. **Code Quality** (section 15)
16. **Notifications** (section 16) — if applicable
17. **Widget Injection** (section 17) — if applicable
18. **Testing Coverage** (section 20)
19. **Backward Compatibility** (section 21) — always

Fix any violations before proceeding to the next phase.

### Step 7 — Update Spec with Progress

After completing each phase, update the spec file:

- Add an `## Implementation Status` section at the bottom (or update it if it exists)
- Use this format:

```markdown
## Implementation Status

| Phase                    | Status      | Date       | Notes                                |
| ------------------------ | ----------- | ---------- | ------------------------------------ |
| Phase A — Foundation     | Done        | 2026-02-20 | All steps implemented, tests passing |
| Phase B — Menu Injection | Done        | 2026-02-21 | 3/3 steps complete                   |
| Phase C — Events Bridge  | In Progress | 2026-02-22 | Step 1-2 done, step 3 pending        |
| Phase D — Enrichers      | Not Started | —          | —                                    |
```

- For the current phase, mark individual steps:

```markdown
### Phase C — Detailed Progress

- [x] Step 1: Create event definitions
- [x] Step 2: Implement SSE bridge
- [ ] Step 3: Add client-side hooks
```

### Step 8 — Verification

After all targeted phases are complete, run the verification gate — the commands listed in `framework.config.json` → `validation` (typically a build, lint, typecheck, and test pass) — and:

1. **Verification gate**: run every command in `framework.config.json` → `validation` — all must pass
2. **Integration test check**: run any new integration tests — must pass
3. **Module prepare**: run the project's code-generation/prepare command — if any convention files changed
4. **Migration check**: run the project's migration-generation command — if any entities changed (verify generated migration is scoped correctly)

Report results to the user. If any check fails, fix and re-verify.

## Subagent Strategy

| Task                        | Agent Type           | When                                          |
| --------------------------- | -------------------- | --------------------------------------------- |
| Research existing patterns  | Explore              | Before implementing unfamiliar patterns       |
| Implement independent files | Bash/general-purpose | When files have no dependencies on each other |
| Run tests                   | Bash                 | After each phase                              |
| Self-review                 | general-purpose      | After each phase, against checklist           |
| Integration tests           | general-purpose      | After phases with API/UI changes              |

**Concurrency rule**: Launch parallel subagents only for truly independent work. Sequential for dependent files.

## Component Replaceability

When implementing component replacement features (as in SPEC-041h pattern):

- Every page-level component gets a unique replacement handle (auto-generated from module + path)
- Every `DataTable` instance gets a replacement handle: `data-table:<module>.<entity>`
- Every `CrudForm` instance gets a replacement handle: `crud-form:<module>.<entity>`
- Every named section (e.g., `NotesSection`, `ActivitySection`) gets a replacement handle: `section:<module>.<sectionName>`
- Document all handles in the module's AGENTS.md or a dedicated reference

## Rules

- MUST read the full spec before starting implementation
- MUST read all relevant AGENTS.md files before coding
- MUST ask the Extension Mode Decision question before writing any code
- MUST prefer UMES extension points over core modifications when extension mode is chosen
- MUST pass every applicable code-review checklist item before marking a phase done
- MUST update the spec with implementation progress after each phase
- MUST run the verification gate (`framework.config.json` → `validation`) after the final phase to verify no build/lint/type/test breaks
- MUST create unit tests for all new behavioral code
- MUST create or propose integration tests for phases with API endpoints or UI flows
- MUST NOT skip the self-review step — it is the quality gate
- MUST NOT introduce `any` types, hardcoded strings, raw `fetch`, or other anti-patterns
- MUST follow backward compatibility rules — no breaking changes without deprecation protocol
- MUST keep subagents focused — one task per subagent, clear boundaries
- MUST report blockers to the user immediately rather than working around them silently
