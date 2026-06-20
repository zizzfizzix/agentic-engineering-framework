#!/usr/bin/env bash
set -e
pnpm install
pnpm cli dev
echo ""
echo "→ Run /reload-skills to activate the installed skills as slash commands."
