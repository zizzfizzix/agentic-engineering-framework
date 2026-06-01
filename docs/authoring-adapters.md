# Authoring an adapter

An adapter fills the slots that a skill declares on one axis (`orm`, `ui`, `stack`) or wires a
harness. Adding a member is **drop-in**: a folder with an `adapter.json` and reference fragments —
no renderer or skill changes. The `adapter-creator` dev skill scaffolds and validates one for you.

## Layout

```
adapters/<axis>/<name>/
├── adapter.json        # manifest (validated by schemas/adapter.schema.json)
└── references/*.md      # slot fragments this adapter provides
```

## Manifest

```json
{
  "$schema": "../../../schemas/adapter.schema.json",
  "name": "prisma",
  "axis": "orm",
  "description": "Prisma ORM adapter.",
  "augments": ["migrate-orm"],
  "slots": {
    "orm.cheatsheet": "references/cheatsheet.md",
    "orm.migration": "references/migration.md"
  }
}
```

- `name` must equal the folder name; `axis` is one of `orm` | `ui` | `stack` | `harness`.
- `slots` maps each `<axis>.<key>` to a fragment path (relative to the adapter dir). A fragment is
  plain markdown; the renderer substitutes it for the matching slot block.
- `augments` is documentation (which skills you contribute to); it isn't enforced.
- An adapter may fill only _some_ of a skill's slots — the rest prune. If a section is optional,
  the skill author keeps its heading inside the slot so pruning is clean (see
  [`slot-convention.md`](slot-convention.md)).

## Harness adapters

Harness adapters wire a harness's skills directory instead of (or in addition to) filling slots:

```json
{
  "name": "claude-code",
  "axis": "harness",
  "skillsDir": ".claude/skills",
  "linkBase": "../../.ai/skills"
}
```

`init`/`add` create one entry per installed skill under `skillsDir`, symlinked to `linkBase`
(or copied with `--copy`).

## Optional skills an adapter adds

An adapter can introduce skills that only make sense with it, via `tiers` in the manifest:

```json
{ "tiers": [{ "skill": "some-adapter-only-skill", "tier": "automation" }] }
```

## Validate

```bash
pnpm gate    # confirms every slot your adapter targets is real and that all skills still render
pnpm test
```

The gate auto-discovers adapters from disk, so a new member joins the render matrix automatically.
Run `pnpm goldens:update` and review the diff if you changed rendered output for the example
consumer.
