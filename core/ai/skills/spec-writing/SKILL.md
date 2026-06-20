---
name: spec-writing
description: Guide for creating high-quality, architecturally compliant specifications for the project. Use when starting a new SPEC or reviewing specs against "Martin Fowler" staff-engineer standards.
---

# Spec Writing & Review

Design and review specifications (SPECs) against the project's architecture, naming, and quality rules. Adopt the **"Martin Fowler"** persona to ensure architectural purity, but remain flexible to innovation.

## Workflow

1.  **Load Context**: Load initial context, take user provided context prompt, and load related files using the Task-Routing table from root `AGENTS.md`.
2.  **Initialize**: Create an empty file with the correct naming convention for scope, under the specs root (`aef.config.json` → `paths.specsRoot`, e.g. `.ai/specs`):
    - Default scope: `{date}-{title}.md` in the specs root
    - Enterprise scope: `{date}-{title}.md` in the `enterprise/` subfolder of the specs root
    - Use `YYYY-MM-DD` for `date` and kebab-case for `title`
3.  **Start Minimal**: Write a **Skeleton Spec** first (TLDR + 2-3 key sections). Do NOT write the full spec in one pass.
    - Before writing the skeleton, scan the brief for **critical unknowns** — decisions that block architecture, data model, or scope. These are questions where a wrong assumption would require rewriting large parts of the spec.
    - If critical unknowns exist, add a numbered **Open Questions** block (`Q1`, `Q2`, …) directly in the skeleton, immediately after the TLDR. One question per line. Keep each question short and answerable (binary or multiple-choice where possible).
    - **STOP after presenting the skeleton.** Do not proceed to Step 5 (Research) or beyond until the user has answered all questions. This is a hard gate.
4.  **Iterate**: Apply answers from the Open Questions gate to fill in the skeleton. Remove the Open Questions block once all are resolved. If new unknowns surface during research or design, repeat the gate for those questions only.
5.  **Research**: Challenge requirements against open-source market leaders in the domain.
6.  **Design**: Create the spec design and architecture.
7.  **Implementation Breakdown**: Create implementation details broken down into **Phases** (stories) and **Steps** (testable tasks). Each step should result in a working application.
8.  **Review**: Apply the [Spec Checklist](references/spec-checklist.md).
9.  **Compliance Gate**: Apply the [Final Compliance Review](references/compliance-review.md).
10. **Output**: Finalize the specification file.

## Output Formats

### 1. New Specification (Writing)

When asked to write or draft a specification, use the [Specification Template](references/spec-template.md) as a guide. You may adapt it if the feature requires a different structure, but ensure core architectural concerns are addressed.

**Key Sections to Include:**

- **TLDR & Overview**: Summary and context.
- **Problem Statement**: What are we solving?
- **Proposed Solution**: High-level approach.
- **Phasing**: Breakdown of delivery.
- **Implementation Plan**: Detailed steps.

### 2. Architectural Review (Reviewing)

When asked to review or audit a specification, produce the report using this structure:

```markdown
# Architectural Review: {Spec Title}

## Summary

{1-3 sentences: what the spec proposes and overall architectural health}

## Findings

### Critical

{Violations of core laws: cross-module ORM coupling, tenant isolation leaks (if multi-tenant), hand-rolled crypto for sensitive data}

### High

{Missing Phase strategy, lack of undo logic, incorrect package placement}

### Medium

{Missing failure scenarios, inconsistent terminology, spec-bloat}

### Low

{Stylistic suggestions, diagram improvements, nits}

## Checklist

Refer to [Spec Review Checklist](references/spec-checklist.md).
```

## Review Heuristics (The "Martin Fowler" Lens)

1.  **Coupled vs. Independent Ops**: Should this be a single coupled operation (calculation depends on shared state) or a compound command of independent, individually-undoable steps?
2.  **The Architectural Diff**: Is the spec wasting space documenting standard CRUD? Cut the noise, focus on the unique.
3.  **Consistent Naming**: Does the spec name entities, commands, and events consistently with existing conventions in the codebase?
4.  **Undo Contract**: How is the state reversed? Is the "Undo" logic as detailed as the "Execute"?
5.  **Module Isolation**: Are side effects routed through an event mechanism, or is the spec cheating with direct cross-module imports?
6.  **Canonical Mechanisms**: Does the spec reuse the project's canonical data-layer, form, API, cache, and event helpers rather than bespoke fetch/forms/queries/crypto? Reach for existing primitives before inventing a substitute. See the relevant `AGENTS.md` files for the project's conventions.
7.  **Sensitive Data**: For every PII / GDPR / address / contact / free-text-about-people / credential column the spec proposes, does it encrypt the field through a declarative, framework-provided field-encryption mechanism with per-tenant keys? Never hand-roll crypto — no bespoke AES, no `crypto.subtle`, no "TODO encrypt later".
8.  **Authorization**: Does every endpoint the spec proposes declare its required auth/permissions explicitly? Default-deny — missing declaration means denied.
9.  **Frontend Architecture Contract**: For Next.js/App Router UI specs, require a Frontend Architecture Contract. It must include a Server/Client boundary map, a `"use client"` ledger with justification for each client file, client blob guardrails, route/bundle/RAM budgets, hydration/interactivity tests, provider/bootstrap scope, and required performance evidence before merge. Read `references/frontend-architecture-contract.md` when the spec touches `app/**`, generated frontend, shared providers, backend shell UI, or heavy interactive widgets.

## Quick Rule Reference

- **Consistent naming** for everything (entities, commands, events, feature IDs) — follow existing conventions.
- **FK IDs only** for cross-module links (no direct cross-module ORM relations).
- **Tenant scoping** — if the project is multi-tenant, scope every read/write by tenant; never bypass the scoping layer.
- **Undoability** is the default for state changes.
- **Validate at boundaries** — validate all inputs with a schema and derive types from it.
- **Encrypt sensitive data** — encrypt every PII / GDPR-relevant field through a declarative, framework-provided field-encryption mechanism with per-tenant keys; never hand-roll crypto.
- **Canonical primitives** — reuse the project's canonical data-layer, form, and API helpers (and cache/event mechanisms) rather than bespoke fetch/forms/queries. See the matching rows in the project's `AGENTS.md` files.
- **Default-deny authorization** — every endpoint declares its required auth/permissions explicitly; missing = denied.
- **Backward compatibility** — treat shipped public surfaces (APIs, events, schemas) as contracts: add, don't break; deprecate with aliases.
- **Frontend Architecture Contract** for Next.js/UI work: Server/Client boundary map, `"use client"` ledger, client blob guardrail, budgets, hydration/interactivity tests, provider/bootstrap scope, and performance evidence. See `references/frontend-architecture-contract.md`.

## Reference Materials

- [Spec Review Checklist](references/spec-checklist.md) — § 3 Data & Security covers field encryption; § 5 API/UI covers canonical mechanisms
- [Final Compliance Review](references/compliance-review.md) — sample matrix calls out field encryption, canonical data-layer helpers, and authorization MUSTs
- [Specification Template](references/spec-template.md)
- [Root AGENTS.md](../../../AGENTS.md) — Task Router rows for the project's canonical primitives
