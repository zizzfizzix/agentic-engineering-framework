---
name: adapter-creator
description: Create or extend an adapter for the agentic framework (ORM, UI, harness, or stack axis). Use when adding support for a new ORM/UI library/AI harness, or filling new slots an existing skill declares. Scaffolds adapter.json + reference fragments and validates with the render matrix.
---

# Create / extend an adapter

An adapter contributes the stack-specific content that fills a generic skill's slots. Adding one
should require **no** changes to the renderer or to generic skill bodies.

## Steps

1. **Pick the axis and name** — `adapters/<axis>/<name>/` (e.g. `adapters/orm/prisma/`).
2. **List the slots to fill.** Find which `<!-- SLOT:<axis>.* -->` markers the relevant skills in
   `core/ai/skills/` declare for your axis. You fill the ones your stack supports; omit the rest
   (the renderer prunes unfilled slots — see the optional-section heading rule in
   `docs/slot-convention.md`).
3. **Write `adapter.json`** (validate against `schemas/adapter.schema.json`):
   ```json
   {
     "name": "prisma", "axis": "orm",
     "augments": ["migrate-orm", "data-model-design"],
     "slots": { "orm.cheatsheet": "references/cheatsheet.md", "orm.migration": "references/migration.md" }
   }
   ```
4. **Write the reference fragments** referenced in `slots`. Keep them focused and self-contained;
   for an *optional* section include its `## Heading` at the top of the fragment.
5. **Validate**: `node bin/check-render.mjs` — confirms no leftover slots and deterministic output
   across the adapter matrix.
6. For a **harness** adapter, set `skillsDir` + `linkBase` instead of `slots` (see
   `adapters/harness/*`).

## Rules

- One adapter per axis is selected per consumer; don't assume another adapter's content.
- Never edit a generic skill body to hardcode your stack — that defeats convergence. If a skill
  lacks a slot you need, add the slot to the generic body (mandatory vs optional heading rule) and
  fill it from every existing adapter on that axis (or leave pruned).
