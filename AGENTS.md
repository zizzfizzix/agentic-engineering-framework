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
pnpm install                    # deps + git hooks + auto-wires dev skills (via prepare)
```

Dev skills are wired automatically — no manual step needed:

- **`pnpm install`** runs `pnpm cli dev` via the `prepare` script (harness-agnostic; wires all).
- **Claude Code** fires the `SessionStart` hook in `.claude/settings.json` → `pnpm cli dev`.
- **Other harnesses** (Codex, Cursor): add an equivalent session-start hook in their settings file
  (e.g. `.codex/settings.json`) pointing to `pnpm cli dev`. The hook file is tracked; the
  generated `skills/` subdir stays gitignored.

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
Conventional Commit history — no manual version bumps or tags. Two workflows, separated on purpose:
`release-please.yml` only manages the release; `publish.yml` is the only file that touches npm (so the
npm trusted publisher pins exactly one workflow).

- `.github/workflows/release-please.yml` runs on every push to `main`. It keeps a **release PR**
  open that rolls up unreleased commits into the next version + `CHANGELOG.md` (config in
  `release-please-config.json`, current versions in `.release-please-manifest.json`). A follow-up job
  reformats the generated `CHANGELOG.md` with the repo's Prettier on the release PR branch —
  release-please's `*`-bullet style isn't Prettier-clean, and it regenerates the file each run, so the
  fix is reapplied automatically rather than ignoring the file.
- Merging that PR bumps `package.json`, updates the changelog, tags the commit, and publishes a
  **GitHub Release**. Because that release is created by the `RELEASE_PLEASE_TOKEN` PAT, it triggers
  `.github/workflows/publish.yml` (`on: release: published`) — which runs `pnpm build` then
  `npm publish --access public` (dist-tag `latest`). (A release created by the built-in
  `GITHUB_TOKEN` would _not_ trigger it.)
- **Auth is via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — there
  is no `NPM_TOKEN`.** The publish job's `id-token: write` lets the npm CLI (≥ 11.5.1) exchange the
  GitHub OIDC token for short-lived credentials and attach provenance automatically (no
  `--provenance` flag). Provenance also needs `package.json`'s `repository.url` set (it is) — npm
  refuses to generate provenance without it, so don't drop that field. Configure it once on npmjs.com → the package's **Settings → Trusted
  Publisher**: GitHub Actions, organization `zizzfizzix`, repository `agentic-engineering-framework`,
  workflow **`publish.yml`** (leave _Environment_ blank, or set it to `release` to match the gate
  below).
  - **First publish is a chicken-and-egg**: the trusted publisher is configured on the package's
    page, which doesn't exist until the package does. Bootstrap once by publishing the **stable**
    `0.0.1` in `package.json` manually from a machine logged in as an org member
    (`npm publish --access public`), then add the trusted publisher. Bootstrap with a **stable**
    version, **not a snapshot** — npm forces the very first publish onto the `latest` dist-tag
    regardless of `--tag`, so a snapshot bootstrap leaves `latest` pointing at a prerelease. Once a
    real version owns `latest`, snapshots (always `--tag <branch>`) never move it. Keep
    `.release-please-manifest.json` at `0.0.1` so the first automated release bumps to `0.1.0`.
- The one remaining secret is `RELEASE_PLEASE_TOKEN` — a GitHub PAT used by the release-please
  action. The built-in `GITHUB_TOKEN` is deliberately blocked from triggering further workflow runs,
  so with it the release PR would get no CI **and** the GitHub Release wouldn't trigger `publish.yml`;
  a PAT lifts both restrictions (matches the `scrape-similar` setup). A fine-grained token with
  **Contents: read/write** + **Pull requests: read/write** on this repo is enough.

`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major. While pre-1.0, release-please
keeps breaking changes in the `0.x` range.

### Snapshots (on-demand prereleases)

`publish.yml` also has a **manual `workflow_dispatch`** snapshot job for publishing a throwaway build
of any branch — handy for trying a PR's `aef` on a real install without cutting a release.

- **Actions → Publish → Run workflow**, pick the branch (optionally override the dist-tag). It
  publishes `<base>-snapshot.<branch>.<sha>` (the commit rev keeps every snapshot unique) under a
  **branch-named dist-tag**, so `npm i @zizzfizzix/aef@<branch>` resolves to that branch's latest
  snapshot. Snapshots **never** move `latest`.
- Same OIDC trusted publisher as the stable publish (it's the same `publish.yml`), so no extra config
  or secret. `package.json` is bumped only in the runner, never committed.

**Who can publish.** `workflow_dispatch` already requires repo **write** access — randoms and
read-only forks can't trigger it. Both `publish.yml` jobs additionally run in the protected `release`
**environment**: in repo **Settings → Environments → `release`**, add **required reviewers** so a
maintainer must approve before anything reaches npm, and (optionally) set the npm trusted publisher's
_Environment_ field to `release` to bind it. Allow all branches there (snapshots run off feature
branches) and rely on the reviewer gate. Note this gates the **stable** publish too — every npm
publish needs one approving click; if you'd rather only gate snapshots, move `environment: release`
off the `release` job in `publish.yml`.

**Publishing a snapshot locally** (no CI — uses your own `npm login`, e.g. for the first-publish
bootstrap):

```bash
npm login                 # once, as a @zizzfizzix member with publish rights
pnpm snapshot             # builds, derives <base>-snapshot.<branch>.<sha>, publishes under @<branch>
pnpm snapshot mytag       # …or override the dist-tag
```

It mirrors the CI job's version/tag scheme exactly and restores `package.json` on exit (local
publishes carry no provenance — that's CI/OIDC-only).

## Authoring rules (see `docs/slot-convention.md`)

- Slot names are `<axis>.<key>`; mandatory-section headings stay in the generic body, optional-
  section headings move into the adapter fragment so pruning is clean.
- Keep the renderer **deterministic** — no timestamps in output bodies; the digest covers only the
  inputs a skill consumes.
- Adding a new axis member (e.g. a Prisma ORM adapter) = drop a folder under `adapters/orm/prisma/`
  with an `adapter.json` + reference fragments. No renderer or skill changes needed.
