---
name: triage-feedback
description: Framework-side intake for inbound consumer feedback. Use on the framework repo to dedupe scope-tagged lessons arriving from consumers' framework-feedback outboxes (as PRs or issues), route each to fold-into-skill / add-adapter-case / promote-to-framework-lesson / reject, and append accepted generic lessons to core/ai/lessons.framework.md. Triggers — "triage framework feedback", "process the feedback PRs", "dedupe inbound lessons".
---

# Triage framework feedback

The framework-side counterpart to `improve-framework`'s feedback-drain mode (decision #8). Many
consumers upstream scope-tagged lessons; this skill is the **dedup + routing** point so the
framework doesn't accumulate duplicate or low-signal noise. Run it on the framework repo.

## When to use

- Inbound feedback PRs/issues have accumulated from one or more consumers.
- A scheduled triage pass is due.

## Inputs

Each inbound lesson (see `core/ai/framework-feedback/README.md` for the shape) carries:

- `scope`: `framework` or `adapter:<axis>:<name>`
- `target`: the skill or adapter it concerns
- symptom, proposed rule/fix, a scrubbed repro, and provenance (source fragment).

## Workflow

1. **Collect** all open inbound lessons (across consumers/PRs). Group by `target` + `scope`.
2. **Dedupe.** Merge lessons that propose the same rule; keep the clearest repro. Discard
   duplicates of an already-accepted lesson (search `lessons.framework.md` and recent commits).
3. **Route** each surviving lesson to exactly one of:
   - **Fold into a skill** — the insight changes a generic workflow → edit the skill body in
     `core/ai/skills/<skill>/SKILL.md`.
   - **Add an adapter case** — it's stack/ORM/UI-specific → edit/extend the relevant
     `adapters/<axis>/<name>/` fragment (use `adapter-creator` if a new member is needed).
   - **Promote to a framework lesson** — a durable cross-cutting rule with no single home →
     append a concise entry to `core/ai/lessons.framework.md`.
   - **Reject** — too project-specific, unclear, or already covered → close with a one-line reason.
4. **Validate.** Run `pnpm gate` and `pnpm test` after edits. Regenerate goldens
   (`pnpm goldens:update`) if rendered output changed, and review the diff.
5. **Open one consolidation PR** with the routed changes. Reference the inbound lessons it
   resolves. Human review gates the merge.
6. On merge, accepted framework lessons flow back to every consumer via their next `aef sync`
   (which renders `lessons.framework.md` into each repo). The originating outbox entries retire
   once their content is detected in synced output.

## Principles

- **One curated intake**, not "everyone edits one lessons file" — that's what breaks across the
  repo boundary, and this skill replaces it.
- Prefer folding into the most specific home (adapter > skill > framework lesson).
- Keep each accepted lesson short and durable: a rule that prevents a recurring mistake.
