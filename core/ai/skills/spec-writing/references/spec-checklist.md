# Spec Review Checklist

Use this checklist during review. Every item must be explicitly answered in the spec or marked N/A with justification.

## Review Process (Required)

1. Re-read the full spec from scratch with adversarial intent.
2. Run this checklist section-by-section.
3. Stress-test each mitigation in Risks & Impact Review.
4. Cross-check related module specs for conflicting assumptions.
5. Record the review result using the output format below.

## Review Output Format

Append to changelog:

```markdown
### Review — {YYYY-MM-DD}

- **Reviewer**: Agent / Human
- **Security**: Passed / {list of issues}
- **Performance**: Passed / {list of issues}
- **Cache**: Passed / {list of issues}
- **Commands**: Passed / {list of issues}
- **Risks**: Passed / {list of gaps}
- **Verdict**: Approved / Needs revision
```

## 1. Design Logic & Phasing

- [ ] TLDR defines scope, value, and clear boundaries.
- [ ] MVP is explicit; future work is deferred and labeled.
- [ ] User stories/use cases map to API/data/UI sections.
- [ ] Terminology aligns with existing modules and AGENTS naming.
- [ ] Phase plan is testable and incrementally deliverable.

## 2. Architecture & Module Isolation

- [ ] Cross-module links use FK IDs only (no direct ORM relations).
- [ ] If the project is multi-tenant, tenant scoping is explicit on every read/write.
- [ ] Module/package placement is correct for the project's conventions.
- [ ] Service wiring uses the project's dependency-injection mechanism.
- [ ] Event/subscriber/worker boundaries are clear and non-circular.

## 3. Data Integrity & Security

- [ ] Entities/records include required tenancy/lifecycle columns where applicable.
- [ ] Write operations define atomicity/transaction boundaries.
- [ ] Input validation is defined with a schema, and types are derived from it.
- [ ] PII/sensitive fields and decryption behavior are documented.
- [ ] **Field encryption is used for sensitive data (no hand-rolled crypto).** For every PII / GDPR-relevant column the spec proposes — names, addresses, contacts, free-text notes about people, credentials, secrets, document numbers — the spec MUST encrypt the field through a declarative, framework-provided field-encryption mechanism with per-tenant keys. Equality-lookup columns (e.g. login email) declare a sibling searchable hash. No `crypto.subtle`, no custom KMS calls, no "TODO encrypt later". See the relevant `AGENTS.md` → Encryption and the project's encryption docs.
- [ ] Security criteria covered:
- [ ] All user input is validated at the boundary with a schema before business logic/persistence.
- [ ] SQL/NoSQL injection vectors are mitigated with parameterized queries (no string interpolation).
- [ ] XSS protections are documented for user-rendered content (no unsafe raw HTML rendering).
- [ ] Proper encoding is defined for URLs, HTML entities, JSON payloads, and file paths.
- [ ] Secrets/credentials are excluded from logs, error messages, and API responses.
- [ ] Default-deny authorization: every endpoint declares its required auth/permissions explicitly; missing = denied.
- [ ] If the project is multi-tenant, every scoped query filters by tenant; the scoping layer is never bypassed.

## 4. Commands, Events & Naming

- [ ] Naming is singular and consistent for entities/commands/events.
- [ ] All mutations are represented as commands.
- [ ] Undo/rollback behavior is specified for each mutation.
- [ ] Multi-step flows use compound commands or equivalent orchestration.
- [ ] Side-effect reversibility (events/notifications/external calls) is documented.
- [ ] Commands with side effects document which effects are reversible and which are not.
- [ ] Bulk operations use compound commands with per-item granularity where partial undo is required.

## 5. API, UI & Compatibility

- [ ] API contracts are complete (request/response/errors) and consistent with models.
- [ ] Routes document their OpenAPI/schema expectations.
- [ ] **Canonical mechanisms — no DIY substitutes.** The spec MUST reuse the project's canonical helpers, not invent its own. (Substitute the project's actual equivalents and the conventions in its `AGENTS.md` files.)
  - [ ] **CRUD APIs** reuse the project's canonical data-layer / CRUD route helper rather than bespoke handlers and queries.
  - [ ] **Endpoints declare auth/permissions explicitly** — default-deny; an endpoint with no declaration is denied.
  - [ ] **Forms** reuse the project's canonical form helper rather than raw `<form>` markup with hand-rolled submission.
  - [ ] **Lists** reuse the project's canonical data-table/list helper with stable identifiers so extension points (columns / row actions / bulk actions / filters) keep working.
  - [ ] **HTTP clients** use the project's canonical API helper — never raw `fetch`.
  - [ ] **Writes outside the canonical form** go through the project's guarded-mutation mechanism (with retry support) rather than direct calls.
  - [ ] **Cache** is resolved through the project's cache service (never a raw client). Cache keys/tags are tenant-scoped where the project is multi-tenant.
  - [ ] **Events** between modules go through the project's event/subscriber mechanism, never direct cross-module imports.
- [ ] **Design System compliance for every UI mock and className snippet in the spec.** Follow the project's design-system rules and component reference. The spec MUST:
  - [ ] Use the design system's semantic status/color tokens — never hardcoded color shades, and no manual dark-mode overrides where tokens already handle them.
  - [ ] Use the design system's typography/spacing scale — never arbitrary one-off sizes.
  - [ ] Use shared UI primitives (status alerts, toasts, confirmation dialogs, status badges, form-field wrappers, section headers, collapsible regions, loading/spinner/empty states) instead of raw HTML equivalents.
  - [ ] Use the project's icon library in page-body UI — never inline raw `<svg>` — at sizes from the shared scale.
  - [ ] Every dialog supports submit (e.g. `Cmd/Ctrl+Enter`) and cancel (`Escape`) shortcuts.
  - [ ] Every icon-only button has an accessible label.
  - [ ] When the spec edits an existing page, it honours the **Boy Scout rule**: any line touched gets migrated to the design-system tokens/scale.
- [ ] i18n keys are planned for all user-facing strings using the project's translation helpers; never hard-code labels in components.
- [ ] Pagination limits are defined where applicable.
- [ ] Migration/backward compatibility strategy is explicit: shipped public surfaces (APIs, events, schemas) are treated as contracts — add, don't break; deprecate with aliases.

## 6. Performance, Cache & Scale

- [ ] Query/index strategy is defined for expected access patterns.
- [ ] N+1 risks and large-list behavior are addressed.
- [ ] Bulk operations define batching/chunking strategy.
- [ ] Background worker threshold for heavy operations is considered.
- [ ] Every query pattern identifies supporting index(es).
- [ ] Schemas avoid unbounded arrays, nested JSON blobs, and count-growing denormalized fields.
- [ ] Large list/search APIs use cursor/keyset pagination (not OFFSET) for scale.
- [ ] N+1 mitigation states expected query count for critical operations.
- [ ] Operations touching >1000 rows justify foreground execution or defer to worker.
- [ ] Query schemas define expected cardinality/access pattern (point lookup, range scan, full scan).
- [ ] Cache criteria covered:
- [ ] Read-heavy endpoints declare caching strategy (memory/SQLite/Redis) and TTL.
- [ ] Cache keys/tags are tenant-scoped.
- [ ] Every write path lists cache tag invalidations.
- [ ] Cache miss behavior is explicit (fallback query, cold-start behavior).
- [ ] Nested/composed data declares invalidation chains (child changes invalidate parent caches).
- [ ] Cache design prevents stale cross-tenant data leakage.

## 7. Risks, Impact & Anti-Patterns

- [ ] Risks & Impact Review includes concrete scenarios and severities.
- [ ] Each risk has mitigation and residual risk.
- [ ] Blast radius and operational detection are described.
- [ ] Anti-pattern checks:
- [ ] Does not restate obvious platform boilerplate as feature scope.
- [ ] Does not mix MVP build plan with speculative future phases.
- [ ] Does not skip undoability for state changes.
- [ ] Does not introduce cross-module ORM links.
- [ ] Does not use plural command/event naming.
