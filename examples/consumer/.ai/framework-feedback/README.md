# Framework feedback outbox (`.ai/framework-feedback/`)

Scope-tagged lessons captured locally that are destined for the **framework**, not this repo.
Capture is on by default and writes only files here — **zero egress**, always reviewable in
`git diff`. The `improve-framework` skill (feedback-drain mode) batches these into a framework PR;
`project`-scoped lessons never land here (they go to `.ai/lessons.md`).

## Scope tag

Each entry declares a `scope`:

- `framework` — a generic workflow/skill insight that applies to all consumers.
- `adapter:<axis>:<name>` — specific to one adapter (e.g. `adapter:orm:drizzle`).

(`project`-scoped lessons are local-only and do **not** belong here.)

## Entry shape

One markdown file per lesson, named `<timestamp>-<slug>.md`, with YAML front-matter and these
sections:

    ---
    scope: framework            # or adapter:<axis>:<name>
    target: <skill or adapter the lesson is about>
    ---

    ## Symptom
    What went wrong, or what was missing.

    ## Proposed rule or fix
    The durable, generalized rule.

    ## Repro (scrubbed)
    Minimal — no secrets or proprietary identifiers.

    ## Provenance
    The rendered region / source fragment that triggered it.

Sanitize before upstreaming: a generalized rule + a scrubbed repro only. Once an entry is
upstreamed it is moved to `.upstreamed/`; it retires once its content arrives back in
`lessons.framework.md` via `sync`.
