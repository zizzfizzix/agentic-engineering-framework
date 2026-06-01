# Code Review Checklist — Full Reference

Apply every applicable section based on which files changed. Skip sections that don't apply to the diff.

> **Note on examples**: This checklist is stack-agnostic. Substitute your project's own canonical
> helpers, convention filenames, and structural layout. Wherever a build/test/generate/migration
> command appears, use the matching command from `framework.config.json` → `validation`; wherever a
> structural path appears, use the paths in `framework.config.json` → `paths` (`modulesRoot`,
> `specsRoot`, `testsRoot`); and for branch/label references use `framework.config.json` → `git`.
> Skip any section whose concept your stack does not have.

## 1. Architecture & Module Independence

- [ ] No tight coupling between modules (depend on stable IDs/contracts, fetch separately)
- [ ] No direct module-to-module function calls for side effects (use events)
- [ ] No direct imports from other modules' business logic
- [ ] Cross-module data uses the project's extension mechanism rather than modifying another module's tables
- [ ] Cross-module references resolved defensively at runtime, not assumed at import time
- [ ] If the project is multi-tenant: every read/write on tenant-scoped entities is scoped by tenant; the scoping layer is never bypassed
- [ ] No cross-tenant data leaks in API responses
- [ ] Services resolved through the project's dependency-injection mechanism — never `new` directly where a registered service exists
- [ ] No hardcoded module-specific logic in shared bootstrap/setup code
- [ ] Code placed in the correct location per the project's structural paths (`framework.config.json` → `paths`); nothing dumped in an unstructured root
- [ ] Package layering respected — a shared/low-level package has zero domain dependencies (no imports from higher-level domain packages)

## 2. Security & Authentication

- [ ] All inputs validated at boundaries with a schema, defined in a dedicated location (not scattered inline)
- [ ] Types derived from the validation schema (no manual interface duplication)
- [ ] No `any` types — derive types from the schema, narrow with runtime checks
- [ ] Default-deny authorization: every endpoint declares its required auth/permissions explicitly; missing = denied
- [ ] Passwords hashed with a strong adaptive algorithm; never stored or logged in plaintext
- [ ] No credentials logged or included in error responses
- [ ] Auth endpoints return minimal error messages (no "account not found" vs "wrong password" distinction)
- [ ] Sensitive/PII fields encrypted through the project's declarative, framework-provided field-encryption mechanism with per-tenant keys
- [ ] Reads/writes of encrypted entities go through the encryption-aware data helpers rather than raw queries
- [ ] No hand-rolled crypto (no bespoke AES/KMS); equality-lookup PII columns declare a hashed sibling for exact-match search
- [ ] No sensitive fields (passwords, tokens, government IDs, bank accounts) exposed in search indexes
- [ ] No sensitive data cached without encryption

## 3. Data Integrity & Migrations

- [ ] No hand-written migrations where the project generates them — entities updated, the project's migration-generation command used
- [ ] When entities changed, the corresponding generated migration file is included in the diff
- [ ] Stable primary keys; standard columns present and consistent (id, created/updated timestamps, soft-delete marker, and any tenant-scoping columns the project uses)
- [ ] Soft delete preferred over hard delete for historical records
- [ ] Naming follows the project's conventions (tables, columns)
- [ ] Junction tables for many-to-many relationships
- [ ] Explicit foreign keys (no implicit cross-module resolution)
- [ ] An atomic flush/transaction is used when mutating entities across phases that include queries
- [ ] Scalar changes flushed BEFORE relation syncs that query on the same unit of work
- [ ] Transactions are atomic — all-or-nothing semantics

## 4. API Routes

- [ ] API-doc metadata exported for documentation generation
- [ ] Auth-guard metadata exported (default-deny: required auth/permissions declared explicitly)
- [ ] CRUD/list endpoints built through the project's canonical data-layer helper rather than bespoke handlers
- [ ] All request inputs validated against a schema
- [ ] Tenant scoping applied in all queries (if multi-tenant)
- [ ] The project's API-call helper used on the client — no raw `fetch`
- [ ] Response parsing and validation/CRUD errors surfaced through the project's shared helpers (no `.json().catch()`, no raw throws)
- [ ] List endpoints respect the project's page-size bound
- [ ] Handler functions exported matching the HTTP method (`GET`, `POST`, `PUT`, `DELETE`)

## 5. Events

- [ ] Events declared through the project's event-declaration mechanism before being emitted
- [ ] Event declarations are type-safe and carry required fields (id, label, category as applicable)
- [ ] The code-generation/prepare command run after creating/modifying event declarations
- [ ] No undeclared events emitted
- [ ] Subscribers declare the required discovery metadata
- [ ] One side effect per subscriber
- [ ] Persistent/durable subscribers are idempotent (may be retried)
- [ ] Ephemeral subscribers used only for real-time UI updates and cache invalidation

## 6. Commands & Undo/Redo

> Applies only where the project supports an undo/redo command model.

- [ ] Write operations implemented as registered commands
- [ ] Multi-step operations use compound commands
- [ ] Every command is undoable with before/after snapshots
- [ ] Snapshot extraction centralized in one shared helper (not re-implemented per command)
- [ ] Any auxiliary/custom-field state captured in the snapshot and restored on undo
- [ ] Change-log/snapshot building loads fresh state from the data layer (not a possibly-stale in-memory copy)
- [ ] Side effects emitted OUTSIDE the atomic flush
- [ ] Side-effect emission carries the index/cache invalidation metadata it needs

## 7. Search Configuration

- [ ] Search config present for every module with searchable entities
- [ ] A change-detection source is included for every indexed entity
- [ ] Sensitive fields excluded from indexes
- [ ] PII needing exact-match (not fuzzy) indexed via a hash-only strategy
- [ ] Result formatting defined for every indexed entity
- [ ] No encrypted/sensitive fields in indexed text output
- [ ] Entity identifiers in the index follow the project's exact format
- [ ] Direct search vs config-aware indexing use the appropriate project service

## 8. Cache

- [ ] Resolved through the project's cache abstraction — never raw cache clients
- [ ] Scoped by tenant (if multi-tenant) via keys or a scoping helper
- [ ] Tag/key-based invalidation for write side effects
- [ ] Every write operation lists which cache entries it invalidates
- [ ] Nested data declares invalidation chains (child change invalidates parent cache)
- [ ] No stale cross-tenant data possible
- [ ] No sensitive data cached without encryption

## 9. Queue & Workers

- [ ] Workers are idempotent — duplicate execution MUST NOT corrupt data
- [ ] Required discovery metadata exported (queue, id, concurrency as applicable)
- [ ] Concurrency bounded within the project's limit
- [ ] Concurrency matched to workload (I/O-bound higher, CPU-bound lower, database-heavy moderate)
- [ ] Works with whichever execution strategies the project supports (e.g. local and async)

## 10. Module Setup

- [ ] Default role/permission assignments mirror the declared authorization features
- [ ] Lifecycle hooks (tenant-created, seed defaults, seed examples) provided as needed
- [ ] All hooks are idempotent — re-running MUST NOT create duplicates
- [ ] No hardcoded module-specific logic in shared bootstrap/setup code
- [ ] No direct imports of another module's seed functions
- [ ] Cross-module lookups resolved at runtime, not at import time

## 11. Custom Fields & Extension Entities

> Applies only where the project supports user-defined custom fields / extension entities.

- [ ] Custom/extension entities declared through the project's declarative mechanism
- [ ] Generated identifiers referenced rather than hardcoded strings
- [ ] Custom-field values collected, split, and normalized through the project's shared helpers
- [ ] Cross-entity links defined via the project's link/DSL helpers

## 12. UI & Backend Pages

### Forms

- [ ] The project's canonical form abstraction used for all create/edit flows — never custom forms where one exists
- [ ] Schema-driven validation; field errors surfaced through the project's helper
- [ ] Field/group definitions memoized
- [ ] Custom-field context passed when custom fields are involved
- [ ] Shared form chrome (header/footer) reused

### Tables

- [ ] The project's canonical table abstraction used for all list views — never manual tables
- [ ] Column truncation/width set where needed
- [ ] Row-action items have stable `id` values
- [ ] Row-click actions configured if needed
- [ ] List page sizes respect the project's bound
- [ ] Export wired through the project's export helpers where applicable

### Feedback & States

- [ ] The project's feedback helper used for all user feedback — never `alert()` or ad-hoc toasts
- [ ] Shared loading and error components reused
- [ ] Shared empty-state component for empty but healthy sections
- [ ] Shared inline-notice component for hints and warnings

### Keyboard & UX

- [ ] Every dialog: `Cmd/Ctrl+Enter` submit, `Escape` cancel
- [ ] Detail vs edit page modes set correctly on shared chrome

## 13. i18n & Translations

- [ ] No hardcoded user-facing strings
- [ ] Client-side translations via the project's client translation helper
- [ ] Server-side translations via the project's server translation helper
- [ ] Translation keys live in the module's locale files
- [ ] All configured locales kept in sync

## 14. Naming Conventions

- [ ] Identifiers, tables, and columns follow the project's established casing conventions
- [ ] Module identifiers match their folder names
- [ ] Authorization features and event IDs follow the project's naming pattern
- [ ] No one-letter variable names

## 15. Code Quality

- [ ] No `any` types introduced
- [ ] No `unknown` or `any` exported from shared packages
- [ ] Narrow, typed interfaces exported from shared packages
- [ ] Functional, data-first utilities preferred over classes
- [ ] Shared utility helpers (e.g. boolean/string parsing) reused rather than re-implemented
- [ ] No added docstrings/comments/annotations on unchanged code
- [ ] Self-documenting code — no inline comments needed
- [ ] Imports use the correct, documented package paths

## 16. Notifications

> Applies only where the project has a notification subsystem.

- [ ] Notification types declared through the project's declarative mechanism
- [ ] Event subscribers emit notifications on domain events
- [ ] Client renderers/components colocated per the project's convention
- [ ] Translation keys used for notification strings
- [ ] Expiry configured appropriately

## 17. Extension / Injection Points

> Applies only where the project supports injecting UI/behavior into host-defined extension points.

- [ ] Extensions declared and registered through the project's convention
- [ ] Metadata colocated per the project's convention
- [ ] Injection-point identifiers follow the project's documented convention

## 18. AI / Tool Integrations

> Applies only where the project exposes programmatic tools (e.g. MCP).

- [ ] Required permissions set for access control — never empty
- [ ] Tool input declared with a validation schema — never raw/unchecked input
- [ ] Handlers return serializable objects
- [ ] Module/owner identifiers consistent with the owning module
- [ ] Session/auth tokens stripped from args before reaching handlers
- [ ] Expired/absent sessions handled explicitly

## 19. Generated Files & Build

- [ ] Generated files never edited manually
- [ ] The code-generation/prepare command run after adding/modifying convention files
- [ ] No imports from generated files in libraries (only app bootstrap imports)
- [ ] Project still builds after changes (the build command in `framework.config.json` → `validation`)
- [ ] If the project ships a scaffolding template, its template-parity check passes
- [ ] If template drift exists (especially layout/routes), reviewer asked whether to sync and, if approved, applied the template-sync fix command

## 20. Testing Coverage

- [ ] Changed behavior is covered by unit tests and/or integration tests
- [ ] High-risk changes (auth, tenant isolation, payments, workflows, undo/redo, eventing) include integration tests
- [ ] Tests validate both happy path and key failure/edge cases
- [ ] New API behavior is covered by route-level integration tests
- [ ] Missing test coverage is explicitly called out in review findings with proposed test files/cases

## 21. Backward Compatibility (Critical)

Every item below refers to the project's backward-compatibility contract (e.g. a `BACKWARD_COMPATIBILITY.md` linked from root `AGENTS.md`). A violation is **Critical** unless the deprecation protocol is fully followed.

### Convention Files & Auto-Discovery

- [ ] No convention file renamed or removed
- [ ] No convention file export name renamed
- [ ] No auto-discovery directory convention changed (routing/discovery algorithm)

### Type Interfaces

- [ ] No required fields removed from public types
- [ ] No required field types narrowed (e.g., `string | null` changed to `string`)
- [ ] No existing optional fields removed from public types

### Function Signatures

- [ ] No required parameters removed or reordered on public functions
- [ ] No return type changed in a breaking way
- [ ] New parameters added as optional only (no required params added to existing functions)

### Event IDs

- [ ] No existing event ID renamed
- [ ] No existing event ID removed
- [ ] No existing event payload fields removed (may add optional fields)
- [ ] Deprecated events still emitted during bridge period alongside replacement

## 22. Specs Filename Hygiene

- [ ] New or renamed spec files use `{YYYY-MM-DD}-{slug}.md`
- [ ] Legacy numbered spec files are normalized instead of copied forward into new work
- [ ] No two spec files under the specs root (`framework.config.json` → `paths.specsRoot`, including any `enterprise/` subfolder) resolve to the same normalized `{YYYY-MM-DD}-{slug}.md` target
- [ ] Filename references/links updated after any normalization

### Extension / Injection-Point IDs

- [ ] No existing injection-point ID renamed or removed
- [ ] No injection-point context/data type changed in a breaking way (may add optional fields)
- [ ] Wildcard injection points still match as documented

### API Routes

- [ ] No existing API route URL removed or renamed
- [ ] No HTTP method changed for existing operations
- [ ] No fields removed from existing response schemas (may add new fields)
- [ ] Deprecated routes marked deprecated in API docs and kept functional

### Database Schema

- [ ] No existing table or column renamed
- [ ] No existing column removed (soft-deprecate: stop writing, keep column)
- [ ] No column type narrowed (e.g., `text` → `varchar(50)`)
- [ ] Standard columns preserved (id, created/updated/deleted timestamps, active flag, and any tenant-scoping columns the project uses)
- [ ] New columns have defaults (non-breaking addition)

### Service / Registration Names

- [ ] No existing dependency-injection registration key renamed
- [ ] No existing service interface changed in a breaking way

### Authorization Feature IDs

- [ ] No existing feature/permission ID renamed (stored in persisted role configs)
- [ ] No feature/permission ID removed without data migration for existing role configs

### Notification Type IDs

- [ ] No existing notification type identifier renamed
- [ ] No existing notification type removed

### Import Paths

- [ ] No documented public import path removed without re-export bridge + deprecation annotation
- [ ] Moved modules re-exported from old path

### CLI Commands

- [ ] No existing CLI command or required flag renamed/removed

### Generated Files

- [ ] No generated file export names changed
- [ ] No required fields removed from generated bootstrap data

### Deprecation Protocol (when changing any of the above)

- [ ] Deprecation annotation added with migration guidance and target removal version
- [ ] Bridge provided (re-export, alias, or dual-emit) for at least one minor version
- [ ] Documented in the project's release notes (e.g. `RELEASE_NOTES.md`)
- [ ] Spec under the specs root (`framework.config.json` → `paths.specsRoot`) with "Migration & Backward Compatibility" section

## 22. Anti-Pattern Checklist

Flag any of these patterns as violations:

| Anti-Pattern                                             | Severity | Fix                                                                 |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| Removed/renamed event ID without deprecation bridge      | Critical | Keep old ID, emit both, deprecate after one minor version           |
| Removed/renamed extension/injection-point ID             | Critical | Keep old ID, add new one additively                                 |
| Removed field from API response schema                   | Critical | Keep field (set to null/default if no longer meaningful), deprecate |
| Renamed/removed DB column or table                       | Critical | Keep old column, add new one, backfill, deprecate old               |
| Removed/renamed public type field or function param      | Critical | Add deprecated alias, keep old signature                            |
| Removed public import path without re-export             | Critical | Re-export from old path with a deprecation annotation               |
| Contract surface change without spec + migration section | Critical | Create spec with "Migration & Backward Compatibility" section       |
| Tight cross-module coupling / shared mutable state       | Critical | Depend on stable IDs/contracts, fetch separately                    |
| Missing tenant scoping on a multi-tenant query           | Critical | Add tenant scoping                                                  |
| Raw query bypassing the encryption-aware data helpers    | High     | Route reads/writes through the encryption-aware helpers             |
| Missing API-doc/auth metadata export on API route        | High     | Add the required convention exports                                 |
| Missing discovery metadata on subscriber/worker          | High     | Add metadata with required fields                                   |
| Raw `fetch` in client code                               | High     | Use the project's API-call helper                                   |
| Custom form instead of the canonical form abstraction    | Medium   | Refactor to the project's form abstraction                          |
| Custom table instead of the canonical table abstraction  | Medium   | Refactor to the project's table abstraction                         |
| `any` type                                               | Medium   | Derive types from the validation schema                             |
| Hardcoded user-facing string                             | Medium   | Use an i18n translation key                                         |
| Hand-written migration where generation exists           | Medium   | Delete and run the project's migration-generation command           |
| Behavior change without unit/integration test coverage   | High     | Add focused unit/integration tests for changed paths                |
| `alert()` or ad-hoc toast                                | Medium   | Use the project's feedback helper                                   |
| One-letter variable name                                 | Low      | Use descriptive name                                                |
| Inline comment on self-explanatory code                  | Low      | Remove comment                                                      |
| Added docstring on unchanged function                    | Low      | Remove docstring                                                    |
