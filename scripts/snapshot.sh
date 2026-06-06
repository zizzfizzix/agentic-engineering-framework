#!/usr/bin/env bash
# Publish a snapshot prerelease to npm from your machine. Mirrors the
# workflow_dispatch "snapshot" job in .github/workflows/publish.yml, for
# when you can't/won't go through CI — notably the one-time trusted-publishing
# bootstrap (the first publish that creates the package, before OIDC can work).
#
# Usage:  scripts/snapshot.sh [dist-tag]     (or: pnpm snapshot [dist-tag])
#   dist-tag defaults to the sanitized current branch name.
#
# Auth is your local npm login (NOT OIDC) — run `npm login` first as a
# @zizzfizzix org member with publish rights. Local publishes carry no provenance
# (that's CI-only); that's expected.
set -euo pipefail
cd "$(dirname "$0")/.."

npm whoami >/dev/null 2>&1 || {
  echo "Not logged in to npm — run 'npm login' first (as a @zizzfizzix member)." >&2
  exit 1
}

base="$(node -p "require('./package.json').version.split('-')[0]")"
branch="$(git rev-parse --abbrev-ref HEAD | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
sha="$(git rev-parse --short HEAD)"
# A purely-numeric semver identifier can't have a leading zero; short SHAs can be
# all digits, so prefix one with `g` (git-describe style) to keep it valid.
case "$sha" in *[a-f]*) ;; *) sha="g${sha}" ;; esac
version="${base}-snapshot.${branch}.${sha}"
tag="${1:-$branch}"

echo "Building…"
pnpm build

# The version bump is throwaway — back up package.json and restore on any exit so
# we never leave (or commit) the snapshot version. (Avoids `git checkout` so we
# don't clobber unrelated local edits.)
cp package.json .package.json.snapshot-bak
restore() { mv .package.json.snapshot-bak package.json 2>/dev/null || true; }
trap restore EXIT

npm version "$version" --no-git-tag-version --allow-same-version >/dev/null
echo "Publishing $version under dist-tag '$tag'…"
npm publish --access public --tag "$tag"
echo "Done — install with: npm i @zizzfizzix/aef@${tag}"
