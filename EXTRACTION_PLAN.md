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
| 5 | **Author modular, ship converged** | Source stays fragmented (generic body + per-adapter fragments) for maintainability. `init` **resolves and flattens** the selected adapters into concrete, self-contained skills in the consumer repo — irrelevant adapters are omitted entirely (drizzle, not prisma). No runtime pointer-chasing. |
| 6 | **`sync` = git-native 3-way merge** | Sync stores the last render as BASE and uses git's own machinery (`git merge-file` / vendor branch + `git merge`) to combine framework updates with local edits. Standard `<<<<<<<` conflict markers land in the working tree; review with `git diff` and commit — same ritual as a plain copy-sync, but local edits are preserved instead of clobbered. No custom merge engine. |
| 7 | **The framework develops itself via a skill** | The round-trip (fix/enhance the framework from inside a consumer repo) is an opt-in skill, `improve-framework`, not bespoke CLI commands. It knows the render model + provenance, edits the framework source (delegating heavy work to a subagent), re-renders, and syncs back. Dissolves the need for engineered `link`/`promote` commands. See §4a. |

The unifying idea: **a generic core + pluggable adapters along every axis of variation**
(harness, ORM, UI/design-system, stack/config) — but the fragmentation lives **only in the
framework source**. The consumer repo receives a **converged** render: each installed skill is a
single flat file containing exactly the selected adapters' content and nothing else. See §3.3a.
The framework is **made of skills, and improves itself with one** (§4a).

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

### 3.3a Convergence: modular source → flat output (decision #5)

The §3.1 split is a **source-tree** concern, not what lands in the consumer repo. Two models
were considered:

| | Runtime indirection (rejected for output) | Init-time resolution (chosen) |
|---|---|---|
| Skill body | Generic; follows a pointer to `references/<adapter>.md` at run time | Generic body **composed with** the selected adapter fragment into one flat `SKILL.md` |
| Irrelevant adapters | Files linger in the repo (prisma.md while using drizzle) | **Omitted entirely** — never written |
| Agent cost | Resolve config → pick adapter → load reference (extra hops, risk of loading the wrong/both) | Reads one self-contained file |
| Repo feel | Fragmented | Clean, minimal |

**`init` is a resolver/renderer, not a copier.** Given `framework.config.json`
(`orm: drizzle`, `ui: shadcn`, …) it:
1. Selects which skills install at all (no `orm` → no `migrate-orm`).
2. For each, composes the generic body + **only the selected adapter fragments** via named
   slots — reusing open-mercato's marker-splice technique
   (`<!-- ORM_CHEATSHEET_START/END -->`); unfilled slots are dropped.
3. Writes a flat, concrete skill carrying a `<!-- generated by agentic init; edits tracked -->`
   header + a manifest entry (source versions + checksum) for conflict-aware `sync`.

`add`/`remove <adapter>` re-renders only the affected skills. `sync` recomposes from the updated
source and 3-way-merges against the manifest, so upstream improvements land without clobbering
local edits. (A future `--mode=linked` could keep the modular split + symlinks for power users
who want live adapter-switching, but converged is the default and the only v1 mode.)

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

- **New framework-native skills (not from open-mercato):** `improve-framework` (§4a) — the
  self-development round-trip skill. Opt-in tier.

Net: very little is truly discarded — most "domain" content becomes an adapter reference.

---

## 4. Distribution: copy-at-init + conflict-aware sync (decision #1)

Port `agentic-setup.ts` into a standalone, dependency-light CLI (Node, no `create-app` coupling):

- `agentic init` — interactive or `--harness=claude-code,codex,…`, `--orm=`, `--ui=`, `--stack=`.
  Writes `framework.config.json`, then **resolves and renders** the converged skill set (§3.3a) —
  composing generic bodies with only the selected adapters, omitting the rest — runs the
  (generalized) `install-skills.sh`, and invokes each selected **harness adapter** to wire its
  files + skills dir.
- `agentic sync` — recomposes skills/templates from the installed framework version and runs a
  **git-native 3-way merge** (decision #6): the last render is BASE, the consumer file is LOCAL,
  the fresh render is NEW. Uses `git merge-file` (or a vendor branch + `git merge`) so the result
  + standard `<<<<<<<`/`>>>>>>>` markers land in the working tree; you review with `git diff` and
  commit — local edits preserved, no custom merge engine, no silent clobber.
- `agentic add <adapter>` / `agentic remove <adapter>` — re-render the affected skills with the
  new adapter selection (drops/adds slot content, harness files, tier additions; re-runs the
  installer). Removing the last adapter on an axis uninstalls that axis's skills.

Git submodule is **explicitly out of scope** for v1 (decision #1), but the layout keeps the
"single source of truth = `.ai/skills/`" invariant, so a submodule mode could be added later
without restructuring.

The CLI stays deliberately **mechanical and deterministic** — `init`, `sync`, `add`, `remove`,
render. The *judgment-heavy* work of changing the framework itself lives in a skill, §4a.

---

## 4a. Developing the framework from a consumer repo — the `improve-framework` skill (decision #7)

The framework is made of skills, so the act of fixing/enhancing it is **also a skill**, not a set
of engineered commands. `improve-framework` is opt-in (lives in an `automation`/`infra`-style
tier; normal consumers never load it) and encodes the round-trip knowledge:

**Why a skill, not `link`/`promote` commands.** Routing a consumer-side edit back to the right
place is judgment, not mechanics: does this fix belong in the generic body, the `drizzle`
fragment, or a specific slot? An agent reasons about that well given provenance breadcrumbs; a
CLI command would need brittle heuristics. So we encode the *workflow* and let the agent drive
plain `git` + the renderer + `sync`.

**What the skill knows / does:**
1. Locates the framework **source** — a path in `framework.config.json` (a local checkout) or
   clones it on demand into a scratch dir.
2. Reads **provenance breadcrumbs** the renderer leaves (which source file + slot produced each
   region of a rendered skill — the same manifest `sync` uses) to map a consumer-side symptom
   back to its source fragment.
3. **Delegates heavy lifting to a subagent**: edit the framework source in the checkout →
   re-render → run the framework's own validation/tests → report the diff back. This keeps the
   consumer session's context clean.
4. Commits on a framework branch, pushes, optionally opens a framework PR.
5. Runs `agentic sync` in the consumer so the fix flows back down via the normal 3-way merge —
   leaving you a `git diff` to review and commit, your usual ritual.

**Consequence for the renderer:** it MUST emit deterministic output **and** provenance metadata
(source path + slot per region). Cheap to add, doubles as the `sync` manifest, and is the single
dependency that makes the skill possible. Without it the skill is guessing.

This means there is **nothing to manually port back**: either you use `improve-framework` (which
edits source first), or — for a quick hand-fix — you edit the rendered file and let the skill
promote it using provenance. Both paths end at the framework source as the single source of truth.

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

This is the **modular source**. Each adapter ships an `adapter.json` declaring which skills it
augments, the slot content / `references/*.md` it provides, harness/wiring files, and tier
additions. The **consumer repo never sees this layout** — `init` renders it down to a flat,
converged `.ai/skills/<skill>/SKILL.md` set containing only the selected adapters (§3.3a).

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
9. **Deterministic renderer + provenance** — the compose step must be byte-stable and emit a
   per-region provenance map (source file + slot) into the render manifest. Required by both
   `sync` (decision #6) and `improve-framework` (decision #7).
10. **Author `improve-framework`** — the self-development skill (§4a): locate/clone source, read
    provenance, delegate edit+render+validate to a subagent, push framework branch, re-sync.

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
- **Phase 5 — Sync + provenance:** build `agentic sync` (+`add`/`remove`) with git-native 3-way
  merge; ensure the renderer is deterministic and emits the provenance manifest.
- **Phase 6 — Self-development skill:** author `improve-framework` (§4a) and validate the full
  round-trip from a real consumer repo (fix → subagent re-render + validate → sync back).
- **Phase 7 — Dogfood + docs:** adopt into 1–2 unrelated repos with different orm/ui/harness
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
- **Convergence vs. sync (decisions #5/#6):** flattening means `sync` is recompose + git 3-way
  merge, not a copy. Mitigate with the generated-header + manifest checksum so local edits are
  detected and prompted, never silently lost. **Render must be deterministic** so checksums and
  merge bases are stable — this is a hard requirement, not a nicety.
- **Provenance is load-bearing (decision #7):** the `improve-framework` skill can only route
  edits back if the renderer emits per-region provenance (source file + slot). Build it into the
  renderer from day one; treat it as part of the render contract, not an add-on.
- **Skill/subagent reliability:** `improve-framework` automates a sensitive operation (editing the
  framework, opening PRs). Keep it opt-in, require human review of the framework `git diff` before
  push, and have it run the framework's own validation in the subagent before reporting success.
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
- **Author modular, ship converged:** the framework source is fragmented for maintainability;
  `init` renders it down to flat, self-contained skills holding only the selected adapters —
  no fragmentation and no irrelevant parts in the consumer repo.
- **`sync` = git-native 3-way merge:** last render is BASE; git combines framework updates with
  local edits and writes normal conflict markers — same review-and-commit ritual, no clobber.
- **The framework improves itself with a skill:** `improve-framework` handles the round-trip
  (edit source → subagent re-render + validate → sync back), so there's nothing to hand-port.
  Its one dependency: the renderer must emit deterministic output + provenance.
- An opt-in `open-mercato` pack reselects the Mercato adapters to reconstruct today's behavior.
```
