# Extracting the Open Mercato Agentic Engineering Framework

> A plan for lifting the agentic engineering harness out of
> [`open-mercato/open-mercato`](https://github.com/open-mercato/open-mercato)
> into a standalone, reusable repository that other projects can adopt
> (git submodule, copy-and-sync, or npm).

---

## 1. Executive summary

The "agentic engineering framework" in open-mercato is **not a single folder**. It is a
layered system made of:

1. A **harness-agnostic methodology + wiring layer** (portable): the `.ai/skills/` catalog
   format, a tier manifest (`tiers.json`), a tiered installer (`install-skills.sh`), the
   `AGENTS.md` / `CLAUDE.md` convention, multi-harness wiring for Claude Code / Codex / Cursor,
   the spec / run / qa folder conventions, and a set of **meta-skills** (`skill-creator`,
   `create-agents-md`, `spec-writing`, `fix-specs`) that contain almost no domain coupling.
2. A **domain-coupled content layer** (Open-Mercato-specific): the Task Router, per-package
   `AGENTS.md` files, design-system rules (`ds-guardian`, `backend-ui-design`, `.ai/ds-rules.md`,
   `.ai/ui-components.md`), ORM/migration skills (`migrate-mikro-orm`), and `code-review` rules
   that encode Mercato architecture.

**Key finding:** open-mercato has *already* extracted a version of this for downstream apps.
`packages/create-app/agentic/` is a purpose-built portable kit, and `yarn mercato agentic:init`
copies it into any repo, wiring Claude Code, Codex, and Cursor. A spec
(`.ai/specs/2026-04-24-mercato-cli-skills-sync.md`) proposes `yarn mercato skills sync` to keep
those copies fresh — and **explicitly rejected the git-submodule and plugin approaches** for
skills, in favour of copy-at-init + conflict-aware CLI sync.

This plan therefore (a) inventories what to extract, (b) separates portable from domain layers,
(c) compares distribution mechanisms (including the submodule idea the user raised, with the
tradeoffs open-mercato already discovered), and (d) lays out a phased roadmap.

---

## 2. Inventory: what exists today

### 2.1 Root-level convention files
| Path | Role | Portability |
|------|------|-------------|
| `AGENTS.md` (40 KB) | Master agent guide + Task Router | Mostly domain-specific; structure is reusable |
| `CLAUDE.md` | One line: `@AGENTS.md` (Claude reads AGENTS.md) | Fully portable pattern |
| Per-package `CLAUDE.md` | Also `@AGENTS.md` | Portable pattern |
| Per-package `AGENTS.md` (core, ui, shared, cache, …) | Local architecture rules | Domain-specific |

### 2.2 The `.ai/` directory
| Subdir | Contents | Portability |
|--------|----------|-------------|
| `.ai/skills/` | 35 skill folders + `tiers.json` + `tiers.schema.json` + `README.md` | **The crown jewel** — mixed portability (see §3) |
| `.ai/specs/` | ~150 specs + `README.md`, `AGENTS.md`, `SPEC-000` template, `LICENSE.md` | Content domain-specific; **convention is portable** |
| `.ai/runs/` | Per-run plan/handoff/notify artifacts (automation skills write here) | Convention portable; content is project history |
| `.ai/qa/` | Playwright scenarios/tests + `AGENTS.md` | Convention portable; harness-specific |
| `.ai/analysis/`, `.ai/reports/`, `.ai/drafts/` | Skill output sinks | Convention portable |
| `.ai/scripts/` | `ds-health-check.sh`, color/typography migrators | Domain-specific (design system) |
| `.ai/ds-rules.md`, `.ai/ui-components.md`, `.ai/lessons.md` | DS rules + lessons log | DS files domain-specific; `lessons.md` pattern portable |

### 2.3 The installer + tier system
- `scripts/install-skills.sh` — POSIX shell, reads `tiers.json`, creates **per-skill symlinks**
  under `.claude/skills/` and `.codex/skills/`. Sweeps stale links; idempotent; `--with`,
  `--tiers`, `--all`, `--list`, `--clean` flags. **Highly portable** (only assumes `jq` + git root).
- `scripts/validate-skills-tiers.sh` — asserts every skill folder is in exactly one tier.
- `.ai/skills/tiers.json` — single source of truth: `core` (default, 14 skills) +
  `automation`, `security`, `migration`, `infra` (opt-in). Solves the harness "2% skill-description
  context budget" overflow by only symlinking what's needed.

### 2.4 The already-extracted kit: `packages/create-app/agentic/`
This is the existing answer to "make it reusable", and the single most important reference for
this plan:
```
packages/create-app/agentic/
├── shared/
│   ├── AGENTS.md.template          # {{PROJECT_NAME}} placeholder
│   └── ai/{skills,specs,qa,lessons.md}   # adapted, slimmer skill set
├── claude-code/
│   ├── CLAUDE.md.template          # @AGENTS.md
│   ├── settings.json               # PostToolUse hook wiring
│   ├── hooks/entity-migration-check.ts
│   └── mcp.json.example
├── codex/
│   ├── enforcement-rules.md        # spliced into AGENTS.md between markers
│   └── mcp.json.example
└── cursor/
    ├── rules/*.mdc                 # alwaysApply rules + guards
    ├── hooks.json + hooks/*.mjs
    └── mcp.json.example
```
Driven by `packages/cli/src/lib/agentic-setup.ts`:
- `{{PROJECT_NAME}}` placeholder substitution.
- Per-tool generators (claude-code / codex / cursor) selected via wizard or `--tool=` flag.
- Symlinks `.claude/skills` / `.codex/skills` / `.cursor/skills` → `../.ai/skills`.
- Codex integration **splices** enforcement rules into `AGENTS.md` between
  `<!-- CODEX_ENFORCEMENT_RULES_START/END -->` markers (idempotent re-runs).
- Exposed as `yarn mercato agentic:init [--tool=...] [--force]`.

**Note the skill set divergence** (the standalone kit deliberately swaps domain skills):
- Standalone-only (genericized for app builders): `module-scaffold`, `data-model-design`,
  `system-extension`, `eject-and-customize`, `trim-unused-modules`, `troubleshooter`.
- Monorepo-only (core-contributor tools, not shipped downstream): `ds-guardian`, `code-review`
  (mercato variant), `migrate-mikro-orm`, `create-agents-md`, `skill-creator`, `pre-implement-spec`,
  `smart-test`, `merge-buddy`, `review-prs`, `sync-merged-pr-issues`, `auto-*-changelog/qa/sec`,
  `dev-container-maintenance`, `fix`, `root-cause`, `verify-in-repo`, `open-pr`, `check-and-commit`.

This proves the framework is **profile-able**: the same harness skeleton ships different skill
payloads per consumer context.

---

## 3. Coupling analysis — what's reusable vs what must be genericized

Classify every piece into three buckets:

### Bucket A — Portable as-is (the extractable core)
- `install-skills.sh` + `validate-skills-tiers.sh` + `tiers.json` + `tiers.schema.json` +
  `.ai/skills/README.md` (the **skill distribution engine**).
- The `CLAUDE.md → @AGENTS.md` indirection pattern.
- Folder conventions: `.ai/{specs,runs,qa,analysis,reports,drafts,lessons.md}` + their
  `AGENTS.md`/`README.md` scaffolds and `SPEC-000-template.md`.
- Meta-skills with ~zero domain coupling: `skill-creator`, `spec-writing` (with light edits),
  `fix-specs`, `create-agents-md`, `root-cause`, `verify-in-repo`, `open-pr`, `fix`.
- Multi-harness wiring: `claude-code/settings.json`, `codex/enforcement-rules.md` + marker
  splice, `cursor/rules` + `hooks.json`, `mcp.json.example` per tool.
- The PR/issue automation skills (`auto-create-pr`, `auto-continue-pr`, `auto-review-pr`,
  `auto-fix-github`, loop variants) — **moderately** coupled: they reference `yarn typecheck`,
  `develop` branch, pipeline labels. Genericize via config, not rewrite.

### Bucket B — Genericize (template the domain out)
- `AGENTS.md` Task Router → keep the *structure* (Always / Ask First / Never / Validation
  Commands / Task Router / Core Principles), replace Mercato rows with `{{PLACEHOLDER}}`s or a
  generated section. The standalone `AGENTS.md.template` already shows the slimmed form.
- `code-review` skill → split into a generic review harness + a project-specific rules
  reference file (`references/<project>-rules.md`).
- `spec-writing`, `implement-spec`, `pre-implement-spec`, `integration-tests` → parameterize
  paths (`packages/core/src/modules/` vs `src/modules/`) and validation commands.
- Automation skills → extract branch name (`develop`), label names, and validation gate into a
  small `framework.config.json` consumed by the skills.

### Bucket C — Leave behind / make optional plugins (Open-Mercato-only)
- `ds-guardian`, `backend-ui-design`, `.ai/ds-rules.md`, `.ai/ui-components.md`,
  `.ai/scripts/ds-*.sh` (design system tied to `@open-mercato/ui`).
- `migrate-mikro-orm`, `auto-upgrade-0.4.10-to-0.5.0` (ORM/version-pinned).
- `integration-builder`, `dev-container-maintenance` (Mercato marketplace / devcontainer).
- All `.ai/specs/*` content and per-package `AGENTS.md` (project history / architecture).

These belong in a **domain pack** that layers on top of the core, not in the core itself.

---

## 4. Distribution mechanisms — options & recommendation

The user specifically asked about **git submodule**. Here is the honest comparison, informed by
the approaches open-mercato itself evaluated.

| Mechanism | How it works | Pros | Cons |
|-----------|-------------|------|------|
| **A. Git submodule** | Consumer repo adds the framework repo at e.g. `.ai/` or `vendor/agentic`; harness dirs symlink into it | Single source of truth; `git submodule update --remote` to refresh; exact version pinning via commit SHA | Submodule friction (detached HEAD, extra `--recurse-submodules`/`update --init` steps, CI gotchas); **can't locally edit** a skill without committing upstream; harness skill symlinks must resolve *into* the submodule path; contributors forget to init |
| **B. Copy-at-init + CLI sync** *(open-mercato's choice)* | A CLI copies the kit into the repo once; a `sync` command refreshes from upstream with per-file conflict handling | Zero submodule friction; local edits allowed and respected; tool-agnostic; works for existing repos | Copies drift until synced; needs a distribution CLI/tool; harder to guarantee everyone is current |
| **C. npm package** | `npm i -D @org/agentic-framework`; a `bin` runs `init`/`sync`; version via semver | Familiar versioning; lockfile pins it; easy `npx` bootstrap | Node-only ecosystem; postinstall side effects frowned upon; still needs an init step to place files |
| **D. Claude Code plugin / marketplace** | Ship as a CC plugin | Native `/plugin` install, auto skill discovery | **Tool-specific** (Claude only) — loses Codex/Cursor; the very reason open-mercato rejected it |

### Recommendation: a **layered hybrid**

1. **This repo (`agentic-engineering-framework`) = the portable core** (Bucket A + Bucket B
   templates). Harness-agnostic. No Mercato domain content.
2. Support **both** consumption modes from day one, because they serve different users:
   - **Submodule mode** for teams that want lockstep, audited, version-pinned adoption across
     many internal repos (answers the user's question directly). Provide a one-command
     `bootstrap` that adds the submodule and creates the per-harness symlinks.
   - **Copy + `sync` mode** (port open-mercato's `agentic-setup.ts` logic) for repos that want
     to own and locally tweak their skills, or that can't use submodules (e.g. some CI/import
     flows). This is the lower-friction default and matches the proven open-mercato model.
3. Keep **domain packs** (e.g. an `open-mercato` pack) as separate, opt-in overlays so the core
   stays generic.

The core insight to preserve: **`.ai/skills/` is the single source of truth; what changes is what
gets symlinked/copied into each harness's directory.** Both submodule and copy modes honour that.

---

## 5. Target layout for the extracted repo

```
agentic-engineering-framework/
├── README.md                       # what it is, install both ways
├── EXTRACTION_PLAN.md              # (this file)
├── framework.config.example.json   # branch name, validation cmds, labels, paths
├── bin/
│   ├── agentic-init                # copy mode: place kit + wire harnesses
│   ├── agentic-sync                # refresh skills (conflict-aware)
│   └── install-skills.sh           # tiered per-skill symlink installer (ported)
├── scripts/
│   └── validate-skills-tiers.sh
├── core/                           # the portable payload
│   ├── ai/
│   │   ├── skills/                 # Bucket A + genericized B skills
│   │   │   ├── tiers.json
│   │   │   ├── tiers.schema.json
│   │   │   └── README.md
│   │   ├── specs/{README.md,SPEC-000-template.md,AGENTS.md}
│   │   ├── qa/…  runs/README.md  lessons.md
│   ├── AGENTS.md.template          # {{PROJECT_NAME}} + generated Task Router region
│   └── harnesses/
│       ├── claude-code/{CLAUDE.md.template,settings.json,hooks/,mcp.json.example}
│       ├── codex/{enforcement-rules.md,mcp.json.example}
│       └── cursor/{rules/,hooks.json,hooks/,mcp.json.example}
├── packs/                          # opt-in domain overlays
│   └── open-mercato/               # ds-guardian, code-review rules, mikro-orm, task router rows…
└── docs/
    ├── adopting-via-submodule.md
    ├── adopting-via-copy-sync.md
    └── authoring-skills.md
```

---

## 6. Genericization tasks (concrete)

1. **Introduce `framework.config.json`** with: default branch (`develop`/`main`), validation
   command list, PR label vocabulary, and path map (`modulesRoot`, `specsRoot`). Skills read it
   instead of hard-coding `yarn typecheck` / `develop` / `packages/core/...`.
2. **Templatize `AGENTS.md`**: keep the section skeleton; mark the Task Router as a
   generated/overlay region (`<!-- TASK_ROUTER_START/END -->`) so packs can inject rows — mirrors
   the existing Codex marker-splice technique.
3. **Split `code-review`** into harness logic + `references/project-rules.md` (empty in core).
4. **Parameterize paths** in `spec-writing`, `implement-spec`, `integration-tests`,
   `auto-*-pr` (modules root, test dirs, branch).
5. **Port `install-skills.sh`** verbatim (it only needs `jq` + a git root) and reuse `tiers.json`.
6. **Port `agentic-setup.ts`** into a small standalone CLI (drop the `create-app` coupling; keep
   placeholder substitution, per-tool generators, symlink + Codex marker-splice logic).
7. **Move Mercato-only skills** into `packs/open-mercato/` and have a pack manifest declare which
   tiers/skills it adds.

---

## 7. Phased roadmap

- **Phase 0 — Decisions (blocking):** confirm primary consumption mode (submodule vs copy vs
  both), licensing/attribution from open-mercato (it's MIT — preserve `LICENSE`), and which
  harnesses to support v1 (recommend all three since the kit already does).
- **Phase 1 — Lift the core skeleton:** copy Bucket A files into `core/`; port
  `install-skills.sh`, `validate-skills-tiers.sh`, `tiers.json`, harness wiring. Get
  `install-skills.sh --list` working in this repo against a minimal skill set.
- **Phase 2 — Genericize Bucket B:** add `framework.config.json`, templatize `AGENTS.md`, split
  `code-review`, parameterize paths. Trim each skill's `tiers.json` membership.
- **Phase 3 — Build the two adoption paths:**
  - Submodule: `docs/adopting-via-submodule.md` + a `bootstrap` script that runs
    `git submodule add`, then `install-skills.sh`, then writes harness symlinks pointing into the
    submodule.
  - Copy/sync: port `agentic-init` + a conflict-aware `agentic-sync` (the open-mercato spec
    describes the conflict UX to copy).
- **Phase 4 — Domain pack:** move Mercato-only skills/rules into `packs/open-mercato/`; prove the
  core stays green without it.
- **Phase 5 — Dogfood:** adopt the framework into 1–2 unrelated test repos via *each* mode; fix
  path/symlink assumptions surfaced.
- **Phase 6 — Docs + release:** author `authoring-skills.md`, tag `v0.1.0`.

---

## 8. Risks & open decisions

- **Symlink portability:** Windows (non-dev-mode) and some CI checkouts don't honour symlinks.
  `install-skills.sh` is symlink-based. Mitigation: offer a `--copy` fallback that hard-copies
  skill folders, and document Git `core.symlinks`.
- **Submodule + symlink interaction:** symlinks must resolve into the submodule path; relative
  link targets differ from the current `../../.ai/skills/<skill>`. The installer needs a
  configurable skills root.
- **Skill context budget:** the whole reason for tiers — keep `core` small so harnesses don't
  truncate descriptions. Any pack that adds many skills must default them to opt-in tiers.
- **Drift vs control tradeoff** is the real decision: submodule favours control, copy favours
  ergonomics. The hybrid defers it to the adopter, at the cost of maintaining two paths.
- **Upstream sync:** decide whether the core tracks open-mercato's `.ai/skills` (and how to pull
  improvements) or hard-forks. A `sync-from-upstream` script + a documented diff process is
  cheaper than manual reconciliation.

---

## 9. TL;DR for the impatient

- The framework = **skill catalog + tier manifest + tiered symlink installer + AGENTS/CLAUDE
  convention + multi-harness wiring**, with a meta-skill set for authoring more of it.
- Open-mercato already ships a portable version (`packages/create-app/agentic/` +
  `yarn mercato agentic:init`) and **chose copy+CLI-sync over submodule/plugin** for skills.
- Extract the **harness-agnostic core** into this repo; push all Mercato domain content into an
  opt-in **pack**.
- Support **both** the user's submodule idea (for lockstep teams) **and** copy+sync (lower
  friction, proven model) — they share one source of truth: `.ai/skills/`.
```
