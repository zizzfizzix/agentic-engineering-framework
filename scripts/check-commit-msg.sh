#!/usr/bin/env sh
# Enforce Conventional Commits on the subject line. Wired into the commit-msg git
# hook via lefthook.yml; the commit message file path is passed as $1. Zero-dependency
# (POSIX sh + grep) to match the framework's dependency-light ethos — no commitlint.
set -eu

msg_file="${1:-.git/COMMIT_EDITMSG}"
subject=$(head -n 1 "$msg_file")

# Let git's own auto-generated subjects through (merges, reverts, fixup/squash).
case "$subject" in
  "Merge "* | "Revert "* | "fixup! "* | "squash! "* | "amend! "*) exit 0 ;;
esac

# <type>(<optional scope>)<optional !>: <description>
pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: .+'

if printf '%s' "$subject" | grep -Eq "$pattern"; then
  exit 0
fi

cat >&2 <<EOF
✗ Commit message must follow Conventional Commits.

  Subject: $subject

  Expected: <type>(<optional-scope>): <description>
  Types:    feat fix docs style refactor perf test build ci chore revert
  Examples: feat(cli): add remove command
            fix(render): prune empty slots deterministically
            docs: rename render-poc to render-model
EOF
exit 1
