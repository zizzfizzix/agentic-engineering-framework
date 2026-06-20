# Changelog

## [0.3.0](https://github.com/zizzfizzix/agentic-engineering-framework/compare/v0.2.0...v0.3.0) (2026-06-20)

### Features

- **dev:** render shipped skills into harness on pnpm cli dev ([#23](https://github.com/zizzfizzix/agentic-engineering-framework/issues/23)) ([a0c1cba](https://github.com/zizzfizzix/agentic-engineering-framework/commit/a0c1cba103e7eb0ce08a5a2a3e654b10b0d3d009))

## [0.2.0](https://github.com/zizzfizzix/agentic-engineering-framework/compare/v0.1.0...v0.2.0) (2026-06-20)

### Features

- **cli:** add opt-in tier support + framework-feedback gate ([#20](https://github.com/zizzfizzix/agentic-engineering-framework/issues/20)) ([98f8c87](https://github.com/zizzfizzix/agentic-engineering-framework/commit/98f8c8715d455576eb9c8754018c0ac015c43056))
- **dev:** wire dev skills automatically on session start for all harnesses ([#21](https://github.com/zizzfizzix/agentic-engineering-framework/issues/21)) ([4add032](https://github.com/zizzfizzix/agentic-engineering-framework/commit/4add032029cfcf9158af12f746544c1fd89130e2))

### Bug Fixes

- **cli:** show actionable error for unrecognized framework.config.json keys ([#19](https://github.com/zizzfizzix/agentic-engineering-framework/issues/19)) ([ec4c342](https://github.com/zizzfizzix/agentic-engineering-framework/commit/ec4c3424132f43580ed70365e26724b916d3979f))
- **cli:** show helpful usage error when aef init is run without --config ([#17](https://github.com/zizzfizzix/agentic-engineering-framework/issues/17)) ([9e69dc2](https://github.com/zizzfizzix/agentic-engineering-framework/commit/9e69dc22b52dc6061e1c139de3ad29d63ccc934f))

## [0.1.0](https://github.com/zizzfizzix/agentic-engineering-framework/compare/v0.0.1...v0.1.0) (2026-06-06)

### Features

- **adapters:** add stack axis (generic-node, next-js) ([565e4b9](https://github.com/zizzfizzix/agentic-engineering-framework/commit/565e4b90a99c8a3e5f833aa836ed44387e2ddaac))
- add improve-framework skill (opt-in); align render gate with renderer ([d47e425](https://github.com/zizzfizzix/agentic-engineering-framework/commit/d47e425e64f0378d4276e5c4190218b5b82ff143))
- **cli:** add add and remove commands ([b0385e4](https://github.com/zizzfizzix/agentic-engineering-framework/commit/b0385e4425746acad45548264948930b7a34da1e))
- **cli:** generalize renderer to the full set + harness wiring (agentic init) ([db492d5](https://github.com/zizzfizzix/agentic-engineering-framework/commit/db492d5fbc2459cc53793d5ff00d4680df00c65d))
- **cli:** install core/ai conventions on init ([13909be](https://github.com/zizzfizzix/agentic-engineering-framework/commit/13909be4ec2be7d5c8803c6342791eee68565b25))
- **config:** make the self-improving loop semi-automatic (decision [#8](https://github.com/zizzfizzix/agentic-engineering-framework/issues/8) revised) ([44e7f42](https://github.com/zizzfizzix/agentic-engineering-framework/commit/44e7f42e4bd6cfed2ad8bb816005c8698e2d6fb8))
- **core:** add AGENTS.md template and specs/qa/runs conventions ([6dcb92d](https://github.com/zizzfizzix/agentic-engineering-framework/commit/6dcb92d666619c2c4d66f251978ced0d2f6f8981))
- **dev:** add framework self-development (dev mode + render-matrix gate, decision [#9](https://github.com/zizzfizzix/agentic-engineering-framework/issues/9)) ([04df0e9](https://github.com/zizzfizzix/agentic-engineering-framework/commit/04df0e9b64e4d5991c594d9a3a86d14363e1fa05))
- **feedback:** add lessons.framework, outbox, and triage-feedback ([d456beb](https://github.com/zizzfizzix/agentic-engineering-framework/commit/d456bebca96e7f0a2d0e4ad878062297cd763c5f))
- scaffold executable interface contract + ORM-axis render PoC ([880b5bc](https://github.com/zizzfizzix/agentic-engineering-framework/commit/880b5bc3b0bd84b232f3384b261f8bd3ad7d3c03))
- **skills:** port auto-pr and security skills, wire tiers ([1bd0db0](https://github.com/zizzfizzix/agentic-engineering-framework/commit/1bd0db0e4294866d169c864692322dfd93f00216))
- **skills:** port core and automation skills from open-mercato ([3dabfc4](https://github.com/zizzfizzix/agentic-engineering-framework/commit/3dabfc4820c2b3af92ac59f6629b785df75df98b))
- **skills:** port data-model-design skill ([a624511](https://github.com/zizzfizzix/agentic-engineering-framework/commit/a6245118f7d1d4592117b4f7b84b4a2c04ecf9c0))
- **skills:** port implement-spec, code-review, and test skills ([a5aefeb](https://github.com/zizzfizzix/agentic-engineering-framework/commit/a5aefeb0b9cb395242cd29f595cc5950ce094104))
- **sync:** add git-native 3-way merge (decision [#6](https://github.com/zizzfizzix/agentic-engineering-framework/issues/6)) ([f97f313](https://github.com/zizzfizzix/agentic-engineering-framework/commit/f97f3136356955bb5aa6bb976a8707491826afe9))
- **ui:** validate slot convention on a second axis; fix digest scoping ([8aacd0e](https://github.com/zizzfizzix/agentic-engineering-framework/commit/8aacd0e9c6e516ca88e75b2ee2c15789ad37add2))

### Bug Fixes

- **ci:** format release changelog as a separate commit, not amend ([#10](https://github.com/zizzfizzix/agentic-engineering-framework/issues/10)) ([82bec39](https://github.com/zizzfizzix/agentic-engineering-framework/commit/82bec395ee0a5f40523c577ce4301f28275c9f27))
- **cli:** wire stack axis, share reconcile, refresh sync provenance ([32dc1d7](https://github.com/zizzfizzix/agentic-engineering-framework/commit/32dc1d773e7e176c9131c722155f852a3c161061))
- prep first release (0.0.1 seed, prettier-safe changelog, version sync) ([#6](https://github.com/zizzfizzix/agentic-engineering-framework/issues/6)) ([6870a29](https://github.com/zizzfizzix/agentic-engineering-framework/commit/6870a29bdfae9b517946585a4cd233e421e85557))
