# QA conventions (`.ai/qa/`)

This folder holds end-to-end / integration QA artifacts. The concrete **test runner** is a stack
concern — use whatever `framework.config.json` → `validation` runs and whatever the project's
`testsRoot` already uses.

## Layout

- `scenarios/` — human-readable QA scenarios (Given/When/Then), one file per feature or flow.
  Authored before or alongside the tests; they are the spec the tests encode.
- `tests/` — the executable tests that implement those scenarios. Mirror the scenario filename so
  the two stay paired.

## Writing scenarios

- One scenario file per user-facing flow; name it after the flow, not the implementation.
- Each scenario lists preconditions, the steps a user takes, and the observable outcome.
- Keep them implementation-agnostic — a scenario should survive a refactor of the code under test.

## Writing tests

- Cover the happy path plus the empty, loading, and error states for any UI flow.
- Prefer testing observable behaviour (what the user sees/does) over internal calls.
- A test is done only when it passes under the project's validation gate
  (`framework.config.json` → `validation`).

See the `integration-tests`, `smart-test`, and `auto-qa-scenarios` skills for the workflows that
create and maintain these artifacts.
