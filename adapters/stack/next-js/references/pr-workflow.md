## PR workflow

- Branch from `git.defaultBranch` (`aef.config.json`); never commit directly to it.
- One logical change per PR; keep the diff small and reviewable.
- Include any generated files the codegen/discovery step produces, so CI is reproducible.
- Apply whichever `git.labels` fit the change.
- The PR description states **what** changed, **why**, and **how it was validated**.
