## Validation gate

Run **every** command in `framework.config.json` → `validation` before declaring work done; any
non-zero exit is a failure to fix. A Next.js project's gate is typically, in order:

- a codegen/discovery step if the project uses one (run it after adding or moving files that rely
  on auto-discovery), then
- `typecheck` (`tsc --noEmit`)
- `lint` (`next lint`)
- `test`
- `build` (`next build`) — catches Server/Client boundary and import errors nothing else does.

Never skip the build step: many Next.js errors only surface there.
