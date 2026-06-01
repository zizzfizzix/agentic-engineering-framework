# Feature Specs — my-app

Specs document feature design decisions. They are the source of truth for what was built and why.

## What belongs here

- New domain features (modules, flows, portals, etc.)
- Data model decisions (entity design, relationships, indexing strategy)
- API contract definitions for custom endpoints
- Integration design (external services, webhooks, import/export)

## What does NOT belong here

Cross-cutting framework or infrastructure decisions that aren't specific to this project's
features. If you're unsure, it's almost certainly an app-level decision and belongs here.

## Naming convention

`{YYYY-MM-DD}-{slug}.md` — example: `2026-03-01-inventory-module.md`

## Workflow

1. Before coding any significant feature, check for an existing spec.
2. If none: create from `SPEC-000-template.md`, review with the team, then code.
3. After implementation: update the spec's Changelog and Acceptance Criteria.
