# Slot & provenance convention

The renderer composes a **generic skill body** with **adapter fragments** into one flat,
self-contained `SKILL.md` per consumer (decision #5). The seam is a named **slot**.

## Slots in a generic body

A generic `SKILL.md` marks injection points with HTML comments (invisible in rendered markdown):

```markdown
## Cheatsheet (active ORM)

<!-- SLOT:orm.cheatsheet -->
<!-- /SLOT:orm.cheatsheet -->
```

- Slot name is `<axis>.<key>` — e.g. `orm.cheatsheet`, `orm.migration`, `ui.tokens`.
- The axis (`orm`) maps to a config selection (`"orm": "drizzle"`).
- Anything between the open/close markers in the source is placeholder text; the renderer
  replaces the whole block.

## Filling slots from an adapter

`adapters/orm/drizzle/adapter.json`:

```json
{
  "name": "drizzle",
  "axis": "orm",
  "augments": ["migrate-orm"],
  "slots": {
    "orm.cheatsheet": "references/cheatsheet.md",
    "orm.migration": "references/migration.md"
  }
}
```

## Render rules

1. For each slot in the generic body, look up the adapter selected for that axis in
   `aef.config.json`. If it provides the slot, **substitute** the fragment; otherwise
   **prune** the slot block entirely (nothing is emitted — drizzle, not prisma).
2. Output is **deterministic**: normalized newlines, stable ordering, no timestamps in the file
   body. A `digest` over all inputs + the axis selection goes in a one-line generated header, so
   the same inputs always produce the same bytes (required by `sync`'s 3-way merge, decision #6).
3. A sibling `provenance.json` records, per output region, which **source file / adapter / slot**
   produced it (body-relative line ranges) plus the input SHAs. This is what `improve-framework`
   reads to route a consumer-side edit back to the right source fragment (decisions #7/#8).

## Mandatory vs. optional sections (authoring rule)

An active adapter may fill only _some_ of a skill's slots (e.g. `shadcn` provides tokens +
components but no health-check tool, while `open-mercato-ui` provides all three). The renderer
prunes any slot the active adapter doesn't fill — but a bare `## Heading` left above a pruned slot
becomes an orphan. So:

- **Mandatory section** (always present when the axis is selected): keep the `## Heading` in the
  generic body, put only the body in the slot.
- **Optional section** (some adapters omit it): move the `## Heading` _into the slot_ — i.e. the
  adapter fragment supplies its own heading. When pruned, the whole section disappears cleanly.

## Digest scoping (sync stability)

A rendered skill's digest covers **only the inputs it actually consumes** (its generic body + the
adapter fragments whose slots it fills) — never the global axis selection. So selecting a UI
adapter does not change the ORM skill's digest, and `sync`'s 3-way merge base (decision #6) stays
stable across unrelated config changes. Proven: `migrate-orm` renders to the same digest whether
`ui` is `null` or `shadcn`.

## Why HTML-comment markers

They already work in open-mercato (the Codex `enforcement-rules` splice uses
`<!-- CODEX_ENFORCEMENT_RULES_START/END -->`), survive markdown rendering invisibly, and are
trivial to match without a markdown parser.
