# Developing the Agentic Engineering Framework

This is the **framework repo** — a special consumer where source and usage coincide. Read this
before changing skills, adapters, or the renderer. The full design rationale is in
`EXTRACTION_PLAN.md` (decisions #1–#9).

## What lives where

| Path                              | What                                                                                         | Edit when                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `core/ai/skills/<skill>/SKILL.md` | **Shipped** skills (the product) — generic bodies with `<!-- SLOT:axis.key -->`              | Changing skill workflow that applies to all consumers     |
| `adapters/<axis>/<name>/`         | Adapter fragments that fill slots (`orm`, `ui`, `harness`, …)                                | Adding/​changing stack-specific content                   |
| `dev/skills/`                     | **Dev** skills (the toolchain) — installed into a maintainer's harness                       | Improving how the framework itself is built               |
| `src/core/`                       | Pure renderer, tier selection, 3-way merge, and the zod `contracts`                          | Changing render/sync behaviour or a config/adapter shape  |
| `src/cli/`                        | The `agentic` CLI (`init`/`sync`/`render`/`add`/`remove`/`dev`) — commander + @clack/prompts | Changing CLI surface or the init wizard                   |
| `scripts/`                        | Dev-only scripts: the `gate`, schema generation, example regeneration                        | Changing the validation gate or generated artifacts       |
| `schemas/`, `docs/`               | **Generated** JSON Schemas (from zod) + conventions                                          | Schemas are regenerated (`pnpm schemas`), not hand-edited |

**Never** commit rendered output into the framework repo — rendering happens in consumers. The
only rendered files here are the illustrative `examples/` and they are regenerated, never edited.

## Toolchain

TypeScript (ESM), **pnpm**, commander + @clack/prompts (CLI), **zod** (typed contracts → generated
JSON Schema), **vitest** (tests), ESLint + Prettier, **tsup** (build), **tsx** (dev run), and
**Lefthook** (git hooks: pre-commit format/lint, pre-push gate/test/typecheck — installed on
`pnpm install`).

```bash
pnpm install                    # deps + git hooks
pnpm cli dev                    # wire .claude/.codex/.cursor skills -> dev/skills (gitignored)
```

`pnpm cli dev` installs the **dev** skills, not the shipped ones — you author shipped skills, you
don't run them here. `pnpm build` emits the distributable `agentic` bin to `dist/`.

## Validate every change (the test gates)

```bash
pnpm gate          # render every shipped skill across an adapter matrix (zero-dep invariant gate)
pnpm test          # vitest: render, sync reconcile, adapter contracts, and byte-equal goldens
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
```

`pnpm gate` asserts: deterministic output, no leftover `SLOT:` markers (every slot is filled or
pruned), and every slot a skill declares is fillable by some adapter on its axis. The **golden**
tests assert byte-stable rendered output — an intentional change means regenerating fixtures with
`pnpm goldens:update` and reviewing the diff in the same PR. `improve-framework` runs `pnpm gate`
before opening a PR, so direct development and consumer-driven contributions converge.

## Authoring rules (see `docs/slot-convention.md`)

- Slot names are `<axis>.<key>`; mandatory-section headings stay in the generic body, optional-
  section headings move into the adapter fragment so pruning is clean.
- Keep the renderer **deterministic** — no timestamps in output bodies; the digest covers only the
  inputs a skill consumes.
- Adding a new axis member (e.g. a Prisma ORM adapter) = drop a folder under `adapters/orm/prisma/`
  with an `adapter.json` + reference fragments. No renderer or skill changes needed.
