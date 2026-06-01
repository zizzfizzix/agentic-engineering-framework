# Authoring a skill

Shipped skills live in `core/ai/skills/<skill>/SKILL.md` and are the product. You author and
validate them here; they are never "run" in this repo (see [`../AGENTS.md`](../AGENTS.md), decision
#9). Use the `skill-creator` skill for guidance on writing effective skill bodies.

## Anatomy

```
core/ai/skills/<skill>/
├── SKILL.md            # YAML frontmatter (name, description) + the generic workflow body
├── references/*.md     # optional: loaded on demand by the skill
└── scripts/*           # optional: helper scripts the skill invokes
```

- `name:` in the frontmatter **must** equal the folder name.
- The body is the **generic workflow**. Anything stack-specific is either parameterized by
  referencing `framework.config.json` (e.g. "run the commands in `validation`") or injected from an
  adapter via a **slot**.

## Slots (when content varies by adapter)

Mark an injection point with an HTML comment that is alone on its own line:

```markdown
## Cheatsheet (active ORM)

<!-- SLOT:orm.cheatsheet -->
<!-- /SLOT:orm.cheatsheet -->
```

- Slot name is `<axis>.<key>` (`orm`, `ui`, `stack`). At render time the adapter selected for that
  axis fills the block; if no adapter provides it, the whole block is pruned.
- **Mandatory section** (always present when the axis is selected): keep the `## Heading` in the
  body, put only content in the slot.
- **Optional section** (some adapters omit it): move the `## Heading` _into_ the slot so it
  disappears cleanly when pruned. See [`slot-convention.md`](slot-convention.md).
- A `SLOT:` mentioned in prose or backticks is **not** a slot — only a bare marker on its own line.

Most skills need no slots — they're fully generic and reference config in prose.

## Register it in a tier

Add the skill to `core/ai/skills/tiers.json`:

```jsonc
{
  "tiers": {
    "core": { "skills": ["...", "your-skill"] }, // installed by default
    "automation": { "skills": ["..."] }, // opt-in
  },
  "requires": { "your-skill": "orm" }, // optional: only install if this axis is set
}
```

If a skill declares a slot on an axis, add a `requires` entry so it isn't installed when that axis
is unconfigured.

## Validate

```bash
pnpm gate          # renders your skill across the adapter matrix; asserts:
                   #  • deterministic output
                   #  • no leftover SLOT markers (every slot filled or pruned)
                   #  • every declared slot is fillable by some adapter on its axis
pnpm test          # incl. byte-equal goldens
pnpm goldens:update   # if you intentionally changed rendered output — review the diff
```

`improve-framework` runs `pnpm gate` before opening a PR, so direct authoring and consumer-driven
contributions converge on the same check.

## Keep it generic

This framework is stack-agnostic. Express **principles**, not one stack's API names — e.g.
"reuse the project's canonical data-layer helpers" rather than a specific function, "default-deny
authorization" rather than a specific guard. Stack-specific specifics belong in an adapter.
