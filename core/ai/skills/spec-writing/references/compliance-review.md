# Final Compliance Review

This is the final gate after checklist review and before approval.

## Objective

Verify the spec is aligned with all relevant AGENTS rules and internally consistent.

## Process

1. Identify all relevant `AGENTS.md` files using the root Task Router.
2. Read each related guide; do not skip applicable module/package rules.
3. Cross-reference each MUST rule and mark status: Compliant, Non-compliant, or N/A.
4. Re-read the spec for internal consistency (data, APIs, UI, risks, commands, cache).
5. Append the Final Compliance Report to the spec before changelog.

## AGENTS.md Cross-Reference Procedure

1. Start from root `AGENTS.md` task rows matching the spec scope.
2. Expand to all package/module guides named by those rows.
3. Extract concrete MUST statements from each guide.
4. Map each MUST statement to a spec section or a gap.
5. Record unresolved gaps as non-compliant items with actionable recommendations.

## Compliance Matrix Template

The matrix below is an illustrative sample. The rule sources and rule wording are examples — substitute your project's actual `AGENTS.md` files (under `framework.config.json` → `paths.modulesRoot` and your packages) and the canonical primitive names your conventions define.

```markdown
### Compliance Matrix

| Rule Source                          | Rule                                                                                                                                                                 | Status                    | Notes                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| root AGENTS.md                       | No direct ORM relationships between modules                                                                                                                          | Compliant                 | Uses FK IDs only                                                                    |
| root AGENTS.md                       | Multi-tenant scoping: filter every read/write by tenant                                                                                                              | Compliant                 | All queries scoped                                                                  |
| root AGENTS.md (Design System Rules) | No hardcoded status colors / arbitrary text sizes; use semantic tokens and the text scale                                                                            | Compliant / Non-compliant | List any survivors (hardcoded color shades, one-off sizes, inline `<svg>`) and page |
| Design System guide                  | Use shared UI primitives (status badge, alert, form-field wrapper, section header, etc.); dialogs support submit/cancel shortcuts; `aria-label` on icon-only buttons | Compliant                 | Cite the spec UI section that mentions each primitive                               |
| API conventions guide                | CRUD routes reuse the project's canonical data-layer / CRUD route helper                                                                                             | Compliant / Non-compliant | Cite the file path the spec proposes                                                |
| Encryption guide                     | Sensitive / GDPR fields are encrypted through the framework's declarative field-encryption mechanism with per-tenant keys                                            | Compliant / Non-compliant | List the entity / field set; flag any hand-rolled crypto or "encrypt later" stubs   |
| UI conventions guide                 | Forms use the canonical form helper; lists use the canonical data-table helper with stable identifiers; non-form writes use the guarded-mutation mechanism           | Compliant                 | —                                                                                   |
| UI conventions guide                 | All HTTP goes through the project's canonical API helper (never raw `fetch`)                                                                                         | Compliant                 | —                                                                                   |
| Cache guide                          | Cache resolved through the cache service; tenant-scoped tags; tag-based invalidation declared per write path                                                         | Compliant                 | —                                                                                   |
| Events guide                         | Cross-module side effects go through the project's event/subscriber mechanism, not direct imports                                                                    | Compliant                 | —                                                                                   |
| API conventions guide                | API routes declare their schema/OpenAPI contract                                                                                                                     | Non-compliant             | Missing on GET /api/...                                                             |
| ...                                  | ...                                                                                                                                                                  | ...                       | ...                                                                                 |
```

## Report Format

```markdown
## Final Compliance Report — {YYYY-MM-DD}

### AGENTS.md Files Reviewed

- `AGENTS.md` (root)
- `packages/core/AGENTS.md`
- `packages/<relevant>/AGENTS.md`
- ...

### Compliance Matrix

{table}

### Internal Consistency Check

| Check                               | Status      | Notes |
| ----------------------------------- | ----------- | ----- |
| Data models match API contracts     | Pass / Fail | ...   |
| API contracts match UI/UX section   | Pass / Fail | ...   |
| Risks cover all write operations    | Pass / Fail | ...   |
| Commands defined for all mutations  | Pass / Fail | ...   |
| Cache strategy covers all read APIs | Pass / Fail | ...   |

### Non-Compliant Items

For each non-compliant item:

- **Rule**: Exact rule text
- **Source**: Which AGENTS.md file
- **Gap**: What is missing or wrong
- **Recommendation**: Specific fix needed

### Verdict

- **Fully compliant**: Approved — ready for implementation
- **Non-compliant**: Blocked — items must be resolved before implementation
```
