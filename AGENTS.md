# Developing the Agentic Engineering Framework

This is the **framework repo** — a special consumer where source and usage coincide. Read this
before changing skills, adapters, or the renderer. The full design rationale is in
`EXTRACTION_PLAN.md` (decisions #1–#9).

## What lives where

| Path | What | Edit when |
|------|------|-----------|
| `core/ai/skills/<skill>/SKILL.md` | **Shipped** skills (the product) — generic bodies with `<!-- SLOT:axis.key -->` | Changing skill workflow that applies to all consumers |
| `adapters/<axis>/<name>/` | Adapter fragments that fill slots (`orm`, `ui`, `harness`, …) | Adding/​changing stack-specific content |
| `dev/skills/` | **Dev** skills (the toolchain) — installed into a maintainer's harness | Improving how the framework itself is built |
| `bin/`, `bin/lib/` | The `agentic` CLI + renderer | Changing render/init/sync behaviour |
| `schemas/`, `docs/` | Contracts + conventions | Changing the config/adapter/slot contract |

**Never** commit rendered output into the framework repo — rendering happens in consumers. The
only rendered files here are the illustrative `examples/` and they are regenerated, never edited.

## Setup (the "meta" install)

```bash
node bin/agentic.mjs dev        # wire .claude/.codex/.cursor skills -> dev/skills (gitignored)
```

This installs the **dev** skills, not the shipped ones — you author shipped skills, you don't run
them here.

## Validate every change (the test gate)

```bash
node bin/check-render.mjs       # render every shipped skill across an adapter matrix
```

Asserts: deterministic output, no leftover `SLOT:` markers (every slot is filled or pruned), and
every slot a skill declares is fillable by some adapter on its axis. `improve-framework` runs this
same gate before opening a PR, so direct development and consumer-driven contributions converge.

## Authoring rules (see `docs/slot-convention.md`)

- Slot names are `<axis>.<key>`; mandatory-section headings stay in the generic body, optional-
  section headings move into the adapter fragment so pruning is clean.
- Keep the renderer **deterministic** — no timestamps in output bodies; the digest covers only the
  inputs a skill consumes.
- Adding a new axis member (e.g. a Prisma ORM adapter) = drop a folder under `adapters/orm/prisma/`
  with an `adapter.json` + reference fragments. No renderer or skill changes needed.
