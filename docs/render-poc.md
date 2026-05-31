# Render PoC — the executable contract

`bin/render.mjs` is a dependency-free proof that the §5/§3.3a render model works. It is the
seed of the real `agentic init`/`sync` renderer; the interface it exercises
(`framework.config.json` + `adapter.json` + the slot convention) is what everything else builds on.

## Run it

```bash
# default config (orm=drizzle)
node bin/render.mjs --skill migrate-orm --out /tmp/out

# pick a different ORM
sed 's/"drizzle"/"mikro-orm"/' framework.config.example.json > /tmp/cfg.json
node bin/render.mjs --config /tmp/cfg.json --skill migrate-orm --out /tmp/out

# no ORM -> slots pruned (in practice the skill wouldn't install at all)
```

## What it proves

| Property | How | Evidence |
|----------|-----|----------|
| **Convergence** (decision #5) | only the selected adapter's fragments fill slots; others pruned | drizzle render: 0 MikroORM mentions; mikro render: 0 Drizzle mentions; null-orm: 0 slot markers left |
| **Determinism** (decision #6) | normalized newlines, stable ordering, no timestamps; `digest` over inputs+selection | two runs → identical `digest` and byte-identical `SKILL.md` |
| **Provenance** (decisions #7/#8) | every output line range maps to a source file / adapter / slot | `provenance.json` `regions[]` |

`examples/rendered/{migrate-orm,ui-consistency}/` are committed sample outputs for reference.

## Validated on two axes

The convention was stress-tested on a second axis (UI) with deliberately different content
(token tables, component catalogs) and **heterogeneous adapters**. Two findings, both folded into
`slot-convention.md`:

1. **Per-skill digest scoping** — the digest must cover only the inputs a skill consumes, not the
   global selection, or picking a UI adapter spuriously churns the ORM skill's `sync` base. Fixed;
   proven: `migrate-orm` digest is identical for `ui=null` and `ui=shadcn`.
2. **Optional-section heading rule** — when an active adapter omits a slot (`shadcn` ships no
   health-check), a heading left in the generic body orphans. Optional sections move their heading
   into the adapter fragment so pruning removes the whole section. Proven: `shadcn` render has no
   orphaned "Health check" heading; `open-mercato-ui` render has the full section.

## Not yet (deliberately)

This PoC renders one skill. The real renderer adds: rendering the whole selected skill set,
harness wiring, `install-skills.sh` integration, and the `sync` 3-way merge driven by the
manifest digests. See the roadmap (§7).
