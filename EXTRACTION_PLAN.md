# Extracting the Open Mercato Agentic Engineering Framework

> A plan for lifting the agentic engineering harness out of
> [`open-mercato/open-mercato`](https://github.com/open-mercato/open-mercato)
> into a standalone, reusable, **harness-agnostic** framework that any project can
> adopt — built around one generic core plus pluggable adapters.

---

## 0. Locked decisions

These were confirmed with the project owner and shape the rest of the plan:

| # | Decision | Consequence |
|---|----------|-------------|
| 1 | **Distribution = copy + CLI sync only** | Port open-mercato's `agentic:init` + a conflict-aware `sync`. No git-submodule path (deferred, not built). |
| 2 | **Harness-agnostic** | Built-in adapters for Claude Code, Codex, Cursor, but the wiring is an **adapter interface** so new harnesses (Windsurf, Cline, Gemini CLI, …) drop in without touching skills. |
| 3 | **Generalize, don't discard** | Domain skills are split into a **generic body + adapter references**. Specifics (ORM, design system, stack) live in adapters following the same pattern as harnesses. Only truly irreducible one-shots stay adapter-scoped. |
| 4 | **Hard fork, diverge** | Snapshot from open-mercato and evolve independently. No upstream-sync machinery; MIT `LICENSE` + attribution preserved. |

The unifying idea: **a generic core + pluggable adapters along every axis of variation**
(harness, ORM, UI/design-system, stack/config). A skill stays generic and reads
`framework.config.json` to learn which adapters are active, then loads the matching
`references/<adapter>.md`.

---

## 1. Executive summary

The "agentic engineering framework" in open-mercato is **not a single folder**. It is a
layered system made of:

1. A **harness-agnostic methodology + wiring layer** (portable): the `.ai/skills/` catalog
   format, a tier manifest (`tiers.json`), a tiered installer (`install-skills.sh`), the
   `AGENTS.md` / `CLAUDE.md` convention, multi-harness wiring for Claude Code / Codex / Cursor,
   the spec / run / qa folder conventions, and a set of **meta-skills** (`skill-creator`,
   `create-agents-md`, `spec-writing`, `fix-specs`) that contain almost no domain coupling.
2. A **domain-coupled content layer** (currently Open-Mercato-specific): the Task Router,
   per-package `AGENTS.md` files, design-system rules (`ds-guardian`, `backend-ui-design`,
   `.ai/ds-rules.md`, `.ai/ui-components.md`), ORM/migration skills (`migrate-mikro-orm`), and
   `code-review` rules that encode Mercato architecture.

Per **decision #3**, layer 2 is not left behind — it is **decomposed into generic skills +
adapters**. The framework becomes genuinely reusable in unrelated repos while still letting an
"open-mercato adapter pack" restore the full Mercato experience.

**Key finding:** open-mercato has *already* extracted a copy-based version of this for downstream
apps. `packages/create-app/agentic/` is a purpose-built portable kit, and `yarn mercato
agentic:init` copies it into any repo, wiring Claude Code, Codex, and Cursor. That proves the
copy-at-init model (decision #1) and shows the framework is already **profile-able** — the same
skeleton ships different skill payloads per context. We build on that and generalize it.

---

## 2. Inventory: what exists today

### 2.1 Root-level convention files
| Path | Role | Disposition |
|------|------|-------------|
| `AGENTS.md` (40 KB) | Master agent guide + Task Router | Templatize skeleton; Task Router becomes an adapter-injected region |
| `CLAUDE.md` | One line: `@AGENTS.md` | Portable pattern — keep |
| Per-package `CLAUDE.md` / `AGENTS.md` | Local architecture rules | Mercato-specific → open-mercato adapter pack |

### 2.2 The `.ai/` directory
| Subdir | Contents | Disposition |
|--------|----------|-------------|
| `.ai/skills/` | 35 skill folders + `tiers.json` + `tiers.schema.json` + `README.md` | **Crown jewel** — generic bodies into core, specifics into adapters (§3) |
| `.ai/specs/` | ~150 specs + `README.md`, `AGENTS.md`, `SPEC-000` template, `LICENSE.md` | Convention + template into core; content stays in Mercato history |
| `.ai/runs/` | Per-run plan/handoff/notify artifacts | Convention into core |
| `.ai/qa/` | Playwright scenarios/tests + `AGENTS.md` | Convention into core; test-runner is an adapter concern |
| `.ai/analysis/`, `.ai/reports/`, `.ai/drafts/` | Skill output sinks | Convention into core |
| `.ai/scripts/` | `ds-health-check.sh`, color/typography migrators | Design-system adapter |
| `.ai/ds-rules.md`, `.ai/ui-components.md` | DS rules | Design-system adapter references |
| `.ai/lessons.md` | Lessons log | Pattern into core (empty starter) |

### 2.3 The installer + tier system (port verbatim)
- `scripts/install-skills.sh` — POSIX shell, reads `tiers.json`, creates **per-skill symlinks**
  under each harness dir. Idempotent; `--with`, `--tiers`, `--all`, `--list`, `--clean`.
  Only assumes `jq` + a git root → **highly portable**. Generalize the harness-dir list so it is
  driven by the active harness adapters rather than hard-coded `.claude` / `.codex`.
- `scripts/validate-skills-tiers.sh` — asserts every skill is in exactly one tier.
- `.ai/skills/tiers.json` — single source of truth: `core` (default) + opt-in tiers. Solves the
  harness "2% skill-description context budget" overflow by only symlinking what's needed.

### 2.4 The already-extracted kit: `packages/create-app/agentic/` (the model to port)
```
packages/create-app/agentic/
├── shared/{AGENTS.md.template, ai/{skills,specs,qa,lessons.md}}   # {{PROJECT_NAME}}, slimmer skills
├── claude-code/{CLAUDE.md.template, settings.json, hooks/, mcp.json.example}
├── codex/{enforcement-rules.md, mcp.json.example}                # spliced between markers
└── cursor/{rules/*.mdc, hooks.json, hooks/*.mjs, mcp.json.example}
```
Driven by `packages/cli/src/lib/agentic-setup.ts`: `{{PROJECT_NAME}}` substitution, per-tool
generators, skills symlink per harness, idempotent Codex marker-splice
(`<!-- CODEX_ENFORCEMENT_RULES_START/END -->`), exposed as
`yarn mercato agentic:init [--tool=...] [--force]`. **This is exactly the copy+init logic we
port and generalize into a harness-adapter interface.**

---

## 3. From "domain content" to "generic skill + adapters"

Each skill is split along a stable seam: **workflow (generic) vs facts (adapter)**.

### 3.1 The pattern
```
.ai/skills/<skill>/
├── SKILL.md                 # generic workflow; references adapters by capability, not name
└── references/
    ├── _contract.md         # what an adapter for this skill must provide
    └── <adapter>.md         # injected/symlinked by an installed adapter pack
```
`SKILL.md` says *"load the ORM cheatsheet for the active `orm` adapter from
`framework.config.json`"* instead of hard-coding MikroORM. Adapters drop a `references/<adapter>.md`
into the skill (copy or symlink at init/sync time).

### 3.2 Axes of variation (each an adapter family)
| Axis | Generic skill(s) | Adapter examples | What the adapter provides |
|------|------------------|------------------|---------------------------|
| **Harness** | n/a (wiring only) | claude-code, codex, cursor, windsurf, cline | settings/rules files, hook format, skills-dir path, mcp example |
| **ORM** | `data-model-design`, `migrate-orm` (generalized from `migrate-mikro-orm`) | mikro-orm, prisma, typeorm, drizzle | entity DSL cheatsheet, migration codemods, query idioms |
| **UI / Design system** | `ui-consistency` (from `backend-ui-design` + `ds-guardian`) | open-mercato-ui, shadcn, mui | component catalog, semantic-token map, health-check script |
| **Stack / repo config** | `code-review`, `implement-spec`, `integration-tests`, `auto-*-pr` | next.js, generic-node, monorepo, single-app | paths (`modulesRoot`, `specsRoot`), validation commands, branch + label vocab, test runner |
| **One-shot migrations** | — | `upgrade-0.4.10-to-0.5.0` (Mercato-only) | stays as an adapter-scoped optional skill |

### 3.3 Disposition of each existing skill
- **Stay generic in core (light edits):** `skill-creator`, `spec-writing`, `fix-specs`,
  `create-agents-md`, `root-cause`, `verify-in-repo`, `open-pr`, `fix`, `check-and-commit`,
  `pre-implement-spec`, `implement-spec`, `integration-tests`, `smart-test`, and the
  `auto-*-pr` / `review` / `merge-buddy` / `sync-merged-pr-issues` automation family
  (parameterized via `framework.config.json`).
- **Generalize + adapterize:** `migrate-mikro-orm` → `migrate-orm`; `backend-ui-design` +
  `ds-guardian` → `ui-consistency`; `code-review` → generic harness + `references/project-rules.md`;
  `data-model-design` (already generic-ish in the standalone kit).
- **Adapter-scoped optional skills:** `migrate-orm/mikro-orm`, `ui-consistency/open-mercato-ui`,
  `auto-upgrade-0.4.10-to-0.5.0`, `integration-builder` (Mercato marketplace),
  `dev-container-maintenance`.

Net: very little is truly discarded — most "domain" content becomes an adapter reference.

---

## 4. Distribution: copy-at-init + conflict-aware sync (decision #1)

Port `agentic-setup.ts` into a standalone, dependency-light CLI (Node, no `create-app` coupling):

- `agentic init` — interactive or `--harness=claude-code,codex,…`, `--orm=`, `--ui=`, `--stack=`.
  Copies the core kit, writes `framework.config.json`, runs the (generalized) `install-skills.sh`,
  and invokes each selected **harness adapter** to wire its files + skills dir.
- `agentic sync` — refreshes core skills/templates from the installed framework version.
  **Conflict-aware**: locally modified files are never silently overwritten (per-file prompt /
  `--ours`/`--theirs`/`--diff`), reusing the UX described in open-mercato's
  `2026-04-24-mercato-cli-skills-sync.md` spec.
- `agentic add <adapter>` / `agentic remove <adapter>` — install/uninstall an adapter pack
  (drops its `references/*.md`, harness files, and tier additions; re-runs the installer).

Git submodule is **explicitly out of scope** for v1 (decision #1), but the layout keeps the
"single source of truth = `.ai/skills/`" invariant, so a submodule mode could be added later
without restructuring.

---

## 5. Target layout for the extracted repo

```
agentic-engineering-framework/
├── README.md
├── EXTRACTION_PLAN.md              # (this file)
├── LICENSE                         # MIT, attribution to open-mercato
├── package.json                    # exposes the `agentic` CLI bin
├── bin/agentic                     # init / sync / add / remove
├── scripts/{install-skills.sh, validate-skills-tiers.sh}
├── core/
│   ├── framework.config.example.json   # harness[], orm, ui, stack: paths/cmds/branch/labels
│   ├── AGENTS.md.template              # skeleton + <!-- TASK_ROUTER_START/END --> region
│   └── ai/
│       ├── skills/                     # generic skill bodies + tiers.json + schema + README
│       ├── specs/{README.md, SPEC-000-template.md, AGENTS.md}
│       ├── qa/  runs/README.md  lessons.md
├── adapters/
│   ├── harness/{claude-code,codex,cursor}/   # wiring files + adapter.json manifest
│   ├── orm/{mikro-orm,prisma,typeorm,drizzle}/   # references + optional skills
│   ├── ui/{open-mercato-ui,shadcn,mui}/
│   └── stack/{next-monorepo,generic-node}/
├── packs/
│   └── open-mercato/               # meta-pack: selects the Mercato adapters + Task Router rows
└── docs/{getting-started.md, authoring-skills.md, authoring-adapters.md}
```

Each adapter ships an `adapter.json` declaring: which skills it augments, the `references/*.md`
it provides, harness/wiring files, and any tier additions — so `install-skills.sh` and the CLI
can wire it generically.

---

## 6. Genericization tasks (concrete)

1. **`framework.config.json`** — the keystone. Fields: `harnesses[]`, `orm`, `ui`, `stack`,
   `paths` (`modulesRoot`, `specsRoot`, `testsRoot`), `validation` (command list), `git`
   (`defaultBranch`, PR `labels`). Skills + scripts read it instead of hard-coding.
2. **Harness adapter interface** — formalize `adapter.json` so the CLI loops over harnesses
   instead of the hard-coded `generateClaudeCode/Codex/Cursor` functions; port the Codex
   marker-splice and per-harness skills-symlink as adapter operations.
3. **Generalize `install-skills.sh`** — derive the target harness dirs from active adapters;
   keep `jq`-only footprint; add a `--copy` fallback for symlink-hostile environments.
4. **Templatize `AGENTS.md`** — keep Always / Ask First / Never / Validation / Task Router /
   Core Principles skeleton; make the Task Router an adapter-injected region between markers.
5. **Split `code-review`** into generic logic + `references/project-rules.md` (empty in core,
   filled by stack/UI adapters).
6. **Generalize `migrate-mikro-orm` → `migrate-orm`** and `backend-ui-design`+`ds-guardian` →
   `ui-consistency`, moving specifics into `adapters/orm/*` and `adapters/ui/*`.
7. **Parameterize paths/commands** across `spec-writing`, `implement-spec`, `integration-tests`,
   `auto-*-pr` via `framework.config.json`.
8. **Author the `open-mercato` meta-pack** that re-selects the Mercato adapters, proving the
   round-trip (generic core + pack ≈ original experience).

---

## 7. Phased roadmap

- **Phase 1 — Core skeleton:** copy portable files into `core/`; port `install-skills.sh`,
  `validate-skills-tiers.sh`, `tiers.json`. Get `install-skills.sh --list` green here.
- **Phase 2 — Config + harness adapters:** add `framework.config.json`, define `adapter.json`,
  port claude-code/codex/cursor as harness adapters, build `bin/agentic init`.
- **Phase 3 — Generic skills:** move Bucket-generic skills into core; templatize `AGENTS.md`;
  split `code-review`; parameterize paths/commands.
- **Phase 4 — Domain adapters:** `migrate-orm` (+mikro-orm/prisma), `ui-consistency`
  (+open-mercato-ui/shadcn), assemble `packs/open-mercato`.
- **Phase 5 — Sync:** build `agentic sync` (+`add`/`remove`) with conflict UX.
- **Phase 6 — Dogfood + docs:** adopt into 1–2 unrelated repos with different orm/ui/harness
  combos; write `authoring-skills.md` + `authoring-adapters.md`; tag `v0.1.0`.

---

## 8. Risks & open items

- **Symlink portability:** Windows (non-dev-mode) and some CI checkouts don't honour symlinks;
  `install-skills.sh` is symlink-based → ship the `--copy` fallback and document `core.symlinks`.
- **Generalization effort:** splitting skills into generic-body + adapter is more upfront work
  than dropping domain content. Mitigate by adapterizing **one** axis end-to-end first (ORM) as a
  proof, then replicate the pattern.
- **Adapter contract drift:** if a skill's generic body and its adapter references disagree,
  agents get confused. The `_contract.md` per skill is the guard — validate adapters against it.
- **Skill context budget:** keep `core` tier small; every adapter-added skill defaults to an
  opt-in tier so harness description budgets don't overflow.
- **Hard-fork maintenance (decision #4):** improvements in open-mercato won't flow in
  automatically. Accepted tradeoff; optionally cherry-pick notable upstream skill changes by hand.

---

## 9. TL;DR

- Framework = **skill catalog + tier manifest + tiered installer + AGENTS/CLAUDE convention +
  per-harness wiring**, plus meta-skills for authoring more.
- **Decisions:** copy+CLI-sync (no submodule) · harness-agnostic via adapters · **generalize**
  domain skills into generic-body + adapters (ORM / UI / stack), don't discard · hard fork.
- Organizing principle everywhere: **generic core + pluggable adapters**, all reading one
  `framework.config.json`, all sharing one source of truth: `.ai/skills/`.
- An opt-in `open-mercato` pack reselects the Mercato adapters to reconstruct today's behavior.
```
