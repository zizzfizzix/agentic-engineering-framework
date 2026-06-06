# Code-Review Compliance Quick Reference

This is a condensed reference of the most common violations to check during implementation. For the full checklist, see the `code-review` skill's `references/review-checklist.md`.

## Critical (Must Fix — Blocks Merge)

| #   | Check                                                         | How to Fix                                 |
| --- | ------------------------------------------------------------- | ------------------------------------------ |
| 1   | No direct cross-module data coupling                          | Reference by ID, fetch separately          |
| 2   | All queries scoped to the current tenant/owner                | Add tenant/owner scoping to every query    |
| 3   | Sensitive fields read through the field-decryption path       | Replace raw reads with the decryption path |
| 4   | All inputs validated with a schema at the boundary            | Add schemas alongside the data layer       |
| 5   | API routes declare auth/permissions explicitly (default-deny) | Add per-method auth metadata               |
| 6   | No backward compatibility violations                          | Follow deprecation protocol                |
| 7   | No public IDs (events, handles) renamed or removed            | Keep existing IDs, add new ones additively |

## High (Must Fix)

| #   | Check                                                          |
| --- | -------------------------------------------------------------- |
| 1   | Subscribers/workers declare their registration metadata        |
| 2   | No raw `fetch` — use the project's canonical data-fetch helper |
| 3   | No untyped `any` — validate with a schema and infer types      |
| 4   | Changed behavior has test coverage                             |
| 5   | Commands are reversible with captured undo state               |
| 6   | Reuse shared undo/utility helpers (no duplication)             |

## Medium (Should Fix)

| #   | Check                                                      |
| --- | ---------------------------------------------------------- |
| 1   | Reuse canonical form/table helpers instead of bespoke ones |
| 2   | Use the project's feedback mechanism (not `alert()`)       |
| 3   | No hardcoded user-facing strings — use i18n                |
| 4   | Parse booleans/inputs through shared helpers, not ad hoc   |
| 5   | No hand-written migrations — generate them                 |
| 6   | Use shared loading/error state components                  |

## Anti-Pattern Quick Scan

Before marking a phase done, scan for these patterns in your diff (adjust the source globs to your project):

```
grep -rn "\bany\b" --include="*.ts" --include="*.tsx"   # No untyped `any`
grep -rn "fetch(" --include="*.ts" --include="*.tsx"     # No raw fetch — use the canonical helper
grep -rn "alert(" --include="*.tsx"                       # Use the project's feedback mechanism
grep -rn "<button" --include="*.tsx"                      # Prefer shared button primitives
```
