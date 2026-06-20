// Typed contracts — the single source of truth for every config/adapter shape the
// framework reads. zod gives us (1) runtime validation in the CLI, (2) inferred TS
// types for the codebase, and (3) JSON Schema (see scripts/gen-schemas.ts) published
// under schemas/ for editor/CI validation. Change a shape here and regenerate.
import { z } from 'zod'

const slotName = z
  .string()
  .regex(/^[a-z][\w-]*\.[a-z][\w-]*$/, "slot names are '<axis>.<key>', e.g. 'orm.cheatsheet'")

/** Per-consumer configuration the renderer, init/sync, and skills all read. */
export const FrameworkConfigSchema = z
  .object({
    $schema: z.string().optional(),
    projectName: z.string().describe('Substituted for {{PROJECT_NAME}} in templates.').optional(),
    harnesses: z
      .array(z.string())
      .min(1)
      .describe('Active harness adapters; each wires its files + skills dir.'),
    orm: z.string().nullable().describe('Selected ORM adapter, or null to omit ORM skills.').optional(),
    ui: z.string().nullable().optional(),
    stack: z.string().nullable().optional(),
    paths: z
      .object({
        modulesRoot: z.string().optional(),
        specsRoot: z.string().optional(),
        testsRoot: z.string().optional(),
      })
      .strict()
      .optional(),
    validation: z.array(z.string()).describe('Commands skills run as the verification gate.').optional(),
    git: z
      .object({
        defaultBranch: z.string().optional(),
        labels: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    tiers: z
      .array(z.string())
      .describe('Opt-in tiers to install in addition to the defaults (e.g. ["framework", "automation"]).')
      .optional(),
    source: z
      .object({
        path: z
          .string()
          .nullable()
          .describe('Local checkout path; if null, clone repo on demand.')
          .optional(),
        repo: z.string().nullable().optional(),
      })
      .strict()
      .describe('Where improve-framework finds the framework SOURCE.')
      .optional(),
    feedback: z
      .object({
        capture: z.boolean().default(true).describe('Write scope-tagged lessons locally; zero egress.'),
        upstream: z
          .object({
            mode: z.enum(['scheduled-pr', 'prompt', 'off']).default('scheduled-pr'),
            channel: z.enum(['pr', 'issue', 'fork']).default('pr'),
            schedule: z.string().default('weekly'),
            sanitize: z.boolean().default(true),
            requireHumanApproval: z.boolean().default(true),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

/** An adapter declares which skills it augments and the slot content it provides. */
export const AdapterSchema = z
  .object({
    $schema: z.string().optional(),
    name: z.string().describe("Adapter id, e.g. 'drizzle'."),
    axis: z.string().describe('Variation family: orm | ui | stack | harness.'),
    description: z.string().optional(),
    skillsDir: z.string().describe('Harness only: directory the per-skill links go in.').optional(),
    linkBase: z.string().describe('Harness only: relative link target base from skillsDir.').optional(),
    augments: z.array(z.string()).describe('Skill ids this adapter contributes slot content to.').optional(),
    slots: z
      .record(slotName, z.string())
      .describe('slotName -> fragment path, relative to the adapter dir.')
      .optional(),
    tiers: z
      .array(z.object({ skill: z.string(), tier: z.string() }).strict())
      .describe('Optional skills this adapter adds, and the tier each joins.')
      .optional(),
  })
  .strict()

/** core/ai/skills/tiers.json — declares the default tier set and per-skill axis requirements. */
export const TiersSchema = z
  .object({
    default: z.array(z.string()),
    tiers: z.record(z.string(), z.object({ skills: z.array(z.string()) }).passthrough()),
    requires: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

export type FrameworkConfig = z.infer<typeof FrameworkConfigSchema>
export type Adapter = z.infer<typeof AdapterSchema>
export type Tiers = z.infer<typeof TiersSchema>
