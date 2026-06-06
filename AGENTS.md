# Developing the Agentic Engineering Framework

This is the **framework repo** — a special consumer where source and usage coincide. Read this
before changing skills, adapters, or the renderer. The full design rationale is in
`EXTRACTION_PLAN.md` (decisions #1–#9).

## What lives where

| Path                              | What                                                                                         | Edit when                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `core/ai/skills/<skill>/SKILL.md` | **Shipped** skills (the product) — generic bodies with `<!-- SLOT:axis.key -->`              | Changing skill workflow that applies to all consumers     |
| `adapters/<axis>/<name>/`         | Adapter fragments that fill slots (`orm`, `ui`, `stack`, `harness`)                          | Adding/​changing stack-specific content                   |
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
**Lefthook** (git hooks: commit-msg conventional-commits, pre-commit format/lint, pre-push
gate/test/typecheck — installed on `pnpm install`).

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

## Commit messages

This repo uses **[Conventional Commits](https://www.conventionalcommits.org)**. The subject line
must be `<type>(<optional-scope>): <description>`, where `type` is one of `feat`, `fix`, `docs`,
`style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. A `commit-msg` hook
(`scripts/check-commit-msg.sh`, zero-dependency) enforces it; merge/revert/fixup auto-subjects are
exempt. Examples: `feat(cli): add remove command`, `fix(render): prune empty slots`.

## Releasing (automated)

Releases are driven by **[release-please](https://github.com/googleapis/release-please)** off the
Conventional Commit history — no manual version bumps or tags.

- `.github/workflows/release-please.yml` runs on every push to `main`. It keeps a **release PR**
  open that rolls up unreleased commits into the next version + `CHANGELOG.md` (config in
  `release-please-config.json`, current versions in `.release-please-manifest.json`).
- Merging that PR bumps `package.json`, updates the changelog, tags the commit, and cuts a GitHub
  release. That flips the workflow's `release_created` output, which triggers the **publish** job:
  `pnpm build` then `npm publish --access public` to npm.
- **Auth is via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — there
  is no `NPM_TOKEN`.** The publish job's `id-token: write` lets the npm CLI (≥ 11.5.1) exchange the
  GitHub OIDC token for short-lived credentials and attach provenance automatically (no
  `--provenance` flag). Configure it once on npmjs.com → the package's **Settings → Trusted
  Publisher**: GitHub Actions, organization `zizzfizzix`, repository `agentic-engineering-framework`,
  workflow `release-please.yml` (leave _Environment_ blank).
  - **First publish is a chicken-and-egg**: the trusted publisher is configured on the package's
    page, which doesn't exist until the package does. Bootstrap once by publishing manually from a
    machine logged in as an org member (`pnpm build && npm publish --access public`), then add the
    trusted publisher. Keep `.release-please-manifest.json` at the published version so the first
    automated release lands on the _next_ bump and doesn't collide.
- The one remaining secret is `RELEASE_PLEASE_TOKEN` — a GitHub PAT used by the release-please
  action. The built-in `GITHUB_TOKEN` is deliberately blocked from triggering further workflow runs,
  so the release PR it opens would get no CI; a PAT lifts that restriction (matches the
  `scrape-similar` setup). A fine-grained token with **Contents: read/write** + **Pull requests:
  read/write** on this repo is enough.

`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major. While pre-1.0, release-please
keeps breaking changes in the `0.x` range.

## Authoring rules (see `docs/slot-convention.md`)

- Slot names are `<axis>.<key>`; mandatory-section headings stay in the generic body, optional-
  section headings move into the adapter fragment so pruning is clean.
- Keep the renderer **deterministic** — no timestamps in output bodies; the digest covers only the
  inputs a skill consumes.
- Adding a new axis member (e.g. a Prisma ORM adapter) = drop a folder under `adapters/orm/prisma/`
  with an `adapter.json` + reference fragments. No renderer or skill changes needed.
