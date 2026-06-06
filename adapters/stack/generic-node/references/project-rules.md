## Project review rules

- Prefer the standard library and existing utilities over adding dependencies.
- Public functions and module boundaries carry explicit types.
- No work at import time — modules stay side-effect-free where practical.
- Errors are handled or propagated deliberately, never silently swallowed.
- Follow the existing file/module naming and directory conventions.
- Keep changes minimal and local; don't refactor unrelated code in the same change.
