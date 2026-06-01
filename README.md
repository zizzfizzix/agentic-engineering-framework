# Agentic Engineering Framework

A reusable, **harness-agnostic** engineering methodology for AI coding agents — a generic skill
catalog plus pluggable **adapters** for the axes that vary between projects (ORM, UI/design
system, stack, and AI harness). You author modular source; `agentic init` renders it down to a
flat, self-contained skill set in your repo, and `agentic sync` keeps it up to date without
clobbering your local edits.

Extracted and generalized from the [open-mercato](https://github.com/open-mercato/open-mercato)
agentic harness (MIT). See `EXTRACTION_PLAN.md` for the full design rationale (decisions #1–#9).

## What you get

- **30+ skills** across tiers — `spec-writing`, `implement-spec`, `code-review`,
  `integration-tests`, `smart-test`, `check-and-commit`, `migrate-orm`, `ui-consistency`, the
  `auto-*-pr` automation family, security audits, and the meta-skills for authoring more.
- **Converged install** — each skill lands as one flat `SKILL.md` containing exactly the adapters
  you selected and nothing else (no runtime pointer-chasing, no irrelevant content).
- **Conflict-aware `sync`** — a git-native 3-way merge brings framework updates down while
  preserving your local edits; conflicts surface as standard `<<<<<<<` markers.
- **Multi-harness wiring** — Claude Code, Codex, and Cursor out of the box; new harnesses are just
  another adapter.

## Quickstart

```bash
# in your project
npx agentic init --interactive       # pick harness(es), orm, ui, stack
# or non-interactively from a config file:
npx agentic init --config framework.config.json
```

This writes `framework.config.json`, renders the selected skills into `.ai/skills/`, installs the
`AGENTS.md` + specs/qa/runs conventions, and wires each harness's skills directory. Later:

```bash
npx agentic sync                 # pull framework updates (3-way merge)
npx agentic add mikro-orm        # select an adapter, reconcile installed skills
npx agentic remove shadcn        # deselect an adapter
```

## The model

```
framework source (modular)                 consumer repo (converged)
  core/ai/skills/<skill>/SKILL.md   ──┐
    ├ generic body                    │   agentic init / sync
    └ <!-- SLOT:orm.cheatsheet -->    ├──────────────────────▶  .ai/skills/<skill>/SKILL.md
  adapters/orm/drizzle/...          ──┘   (renderer fills/prunes     (one flat file, selected
  adapters/ui/shadcn/...                   slots, deterministic)       adapters only)
```

**Axes & adapters** (drop a folder under `adapters/<axis>/<name>/` to add a member — no code
changes):

| Axis      | Members shipped            |
| --------- | -------------------------- |
| `harness` | claude-code, codex, cursor |
| `orm`     | drizzle, mikro-orm         |
| `ui`      | shadcn, open-mercato-ui    |
| `stack`   | generic-node, next-js      |

A skill whose required axis isn't configured simply isn't installed (no ORM → no `migrate-orm`).

## Configuration

`framework.config.json` (validated by `schemas/framework.config.schema.json`):

```json
{
  "projectName": "my-app",
  "harnesses": ["claude-code", "codex"],
  "orm": "drizzle",
  "ui": "shadcn",
  "stack": "generic-node",
  "paths": { "modulesRoot": "src", "specsRoot": ".ai/specs", "testsRoot": ".ai/qa/tests" },
  "validation": ["npm run typecheck", "npm test"],
  "git": { "defaultBranch": "main", "labels": [] }
}
```

## Self-improving loop

The framework improves itself with a skill, not bespoke commands:

- **`improve-framework`** (opt-in, in consumers) — routes a consumer-side fix back to the right
  source fragment via provenance, validates with the gate, opens a framework PR, and syncs back.
- **Scope-tagged lessons** — `project` stays local in `.ai/lessons.md`; `framework` /
  `adapter:*` go to the `.ai/framework-feedback/` outbox and upstream as PRs.
- **`triage-feedback`** (framework-side) — dedupes inbound lessons and folds them into skills /
  adapters / `lessons.framework.md`, which `sync` then delivers to every consumer.

## Docs

- [`docs/getting-started.md`](docs/getting-started.md) — init/sync walkthrough for a consumer.
- [`docs/authoring-skills.md`](docs/authoring-skills.md) — write a new shipped skill.
- [`docs/authoring-adapters.md`](docs/authoring-adapters.md) — add an adapter / axis member.
- [`docs/slot-convention.md`](docs/slot-convention.md) — the slot & provenance convention.
- [`AGENTS.md`](AGENTS.md) — developing this framework repo itself.

## Development

See [`AGENTS.md`](AGENTS.md). TypeScript (ESM) · pnpm · commander + @clack/prompts · zod · vitest ·
tsup · Lefthook.

```bash
pnpm install        # deps + git hooks
pnpm cli dev        # wire this repo's harness dirs to the dev/ toolchain skills
pnpm gate           # render every skill across an adapter matrix (invariant gate)
pnpm test           # vitest: render, sync, adapters, add/remove, byte-equal goldens
```

## License

MIT — see [`LICENSE`](LICENSE). Attribution to open-mercato preserved.
