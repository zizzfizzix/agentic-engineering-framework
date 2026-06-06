## Validation gate

Run **every** command in `framework.config.json` → `validation` before declaring work done, and
treat any non-zero exit as a failure to fix, not a warning to note. For a generic Node/TypeScript
project that is typically:

- `npm run typecheck` (or `tsc --noEmit`)
- `npm test`
- `npm run lint`

Add `npm run build` when the package ships compiled output. Never mark a task complete on the
strength of partial runs — the gate is all-or-nothing.
