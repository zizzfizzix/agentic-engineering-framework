---
name: ui-consistency
description: Build and review backend/admin UI that stays visually consistent with the project's design system. Use when creating pages, forms, tables, or reviewing UI for token and component compliance.
---

# UI consistency

This skill is design-system-agnostic. The tokens, components, and health checks below are
rendered for the UI library configured in `framework.config.json` (`ui`). If no UI library is
configured this skill is not installed.

## Always

- Use semantic tokens, never raw color/spacing literals.
- Reuse catalog components before writing bespoke markup.
- Every page handles loading, empty, and error states.

## Semantic tokens (active design system)

<!-- SLOT:ui.tokens -->
_(Filled at render time with the active design system's token map.)_
<!-- /SLOT:ui.tokens -->

## Component catalog (active design system)

<!-- SLOT:ui.components -->
_(Filled at render time with the active design system's component catalog.)_
<!-- /SLOT:ui.components -->

<!-- SLOT:ui.health-check -->
<!-- /SLOT:ui.health-check -->

## Generic review checklist (always applies)

- No hardcoded colors, font sizes, or arbitrary spacing values.
- Status conveyed by a semantic component, not an ad-hoc colored span.
- Interactive elements are keyboard reachable and labelled.
