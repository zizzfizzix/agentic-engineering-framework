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
   `framework.config.json`. If it provides the slot, **substitute** the fragment; otherwise
   **prune** the slot block entirely (nothing is emitted — drizzle, not prisma).
2. Output is **deterministic**: normalized newlines, stable ordering, no timestamps in the file
   body. A `digest` over all inputs + the axis selection goes in a one-line generated header, so
   the same inputs always produce the same bytes (required by `sync`'s 3-way merge, decision #6).
3. A sibling `provenance.json` records, per output region, which **source file / adapter / slot**
   produced it (body-relative line ranges) plus the input SHAs. This is what `improve-framework`
   reads to route a consumer-side edit back to the right source fragment (decisions #7/#8).

## Why HTML-comment markers

They already work in open-mercato (the Codex `enforcement-rules` splice uses
`<!-- CODEX_ENFORCEMENT_RULES_START/END -->`), survive markdown rendering invisibly, and are
trivial to match without a markdown parser.
