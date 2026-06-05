# Render model — the executable contract

`agentic render` (the pure renderer in `src/core/render.ts`, exposed as a CLI subcommand) is the
executable form of the §5/§3.3a render model. The same renderer backs `agentic init`/`sync`; the
interface it exercises (`framework.config.json` + `adapter.json` + the slot convention) is what
everything else builds on.

## Run it

```bash
# default config (orm=drizzle); omit --out to stream the body to stdout
pnpm cli render --skill migrate-orm --out /tmp/out

# pick a different ORM
sed 's/"drizzle"/"mikro-orm"/' framework.config.example.json > /tmp/cfg.json
pnpm cli render --config /tmp/cfg.json --skill migrate-orm --out /tmp/out

# no ORM -> slots pruned (in practice the skill wouldn't install at all)
```

## What it proves

| Property                         | How                                                                                 | Evidence                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Convergence** (decision #5)    | only the selected adapter's fragments fill slots; others pruned                     | drizzle render: 0 MikroORM mentions; mikro render: 0 Drizzle mentions; null-orm: 0 slot markers left |
| **Determinism** (decision #6)    | normalized newlines, stable ordering, no timestamps; `digest` over inputs+selection | two runs → identical `digest` and byte-identical `SKILL.md`                                          |
| **Provenance** (decisions #7/#8) | every output line range maps to a source file / adapter / slot                      | `provenance.json` `regions[]`                                                                        |

`examples/rendered/{migrate-orm,ui-consistency}/` are committed sample outputs for reference.

## Validated on two axes

The convention was stress-tested on a second axis (UI) with deliberately different content
(token tables, component catalogs) and **heterogeneous adapters**. Two findings, both folded into
`slot-convention.md`:

1. **Per-skill digest scoping** — the digest must cover only the inputs a skill consumes, not the
   global selection, or picking a UI adapter spuriously churns the ORM skill's `sync` base. Fixed;
   proven: `migrate-orm` digest is identical for `ui=null` and `ui=shadcn`.
2. **Optional-section heading rule** — when an active adapter omits a slot (`shadcn` ships no
   health-check), a heading left in the generic body orphans. Optional sections move their heading
   into the adapter fragment so pruning removes the whole section. Proven: `shadcn` render has no
   orphaned "Health check" heading; `open-mercato-ui` render has the full section.

## Full set + harness wiring — `agentic init`

`agentic init` renders the **whole configured skill set** and wires each harness:

```bash
pnpm cli init --out examples/consumer        # symlink mode (default)
pnpm cli init --out /tmp/c --copy            # copy mode (symlink-hostile envs)
pnpm cli init --interactive                  # build the config via prompts (@clack/prompts)
```

It does three things:

1. **Selects skills** = tier membership (`core/ai/skills/tiers.json`) **AND** required-axis
   availability (`tiers.requires`). Proven: with `ui: null`, `ui-consistency` is _not installed
   at all_ — "skipped (axis not configured)" — not merely pruned.
2. **Renders** each selected skill into `<out>/.ai/skills/<skill>/` and writes
   `<out>/.ai/.render-manifest.json` — the per-skill digest + inputs map that is the **sync base**
   (decision #6) and the routing source for `improve-framework` (decisions #7/#8).
3. **Wires harnesses** named in `config.harnesses` via their adapter (`adapters/harness/<h>/`),
   creating per-skill symlinks (e.g. `.claude/skills/migrate-orm -> ../../.ai/skills/migrate-orm`)
   or copies with `--copy`. New harnesses are pure data — drop in an `adapter.json`.

`examples/consumer/` is a committed sample of a full `init` (drizzle + shadcn, claude-code +
codex).

## Sync — git-native 3-way merge (`agentic sync`)

`init` snapshots a **BASE** under `<out>/.ai/.base/`. `agentic sync` re-renders from the
(updated) framework source (NEW), reads the on-disk file (LOCAL, possibly hand-edited) and the
BASE, and reconciles per skill — no custom merge engine, just `git merge-file`:

| Situation                       | Result                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| NEW == BASE                     | framework unchanged; local edits left untouched                                            |
| LOCAL == BASE                   | fast-forward: write NEW                                                                    |
| both changed, different regions | clean 3-way merge — local edit **and** framework update both kept                          |
| both changed, same region       | standard `<<<<<<< ours / ======= / >>>>>>> theirs` markers; exit 2; review with `git diff` |

All four proven end-to-end (see commit history): a fast-forward, a clean merge that preserved a
local edit while taking a framework note, and a same-line collision that produced labelled
conflict markers. This is exactly decision #6: same review-and-commit ritual as a plain sync, but
local edits survive instead of being clobbered.

## Not yet (deliberately)

Still ahead: the genericized `install-skills.sh` tier installer, `AGENTS.md` rendering, and the
`improve-framework` / `triage-feedback` skills (now writable against the stable provenance +
manifest). See the roadmap (§7).
