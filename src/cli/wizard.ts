// Interactive `init` wizard (opt-in via --interactive). Discovers the available
// adapters on disk and builds the aef.config.json object via @clack/prompts.
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { loadTiers } from '../core/select.js'
import { type FrameworkConfig } from '../core/contracts.js'

function listAdapters(root: string, axis: string): string[] {
  const dir = join(root, 'adapters', axis)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((n) => existsSync(join(dir, n, 'adapter.json')))
}

function bail<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled — nothing written.')
    process.exit(1)
  }
  return value as T
}

const axisOptions = (root: string, axis: string): { value: string | null; label: string }[] => [
  { value: null, label: 'none' },
  ...listAdapters(root, axis).map((v) => ({ value: v, label: v })),
]

export interface WizardAnswers {
  projectName: string
  harnesses: string[]
  orm: string | null
  ui: string | null
  stack: string | null
  selectedTiers: string[]
  validationCommands: string[]
  defaultBranch: string
  sourceRepo: string | undefined
  modulesRoot: string | undefined
  specsRoot: string | undefined
  testsRoot: string | undefined
  feedbackMode: 'scheduled-pr' | 'prompt' | 'off'
}

const norm = (v: string | undefined) => (v ?? '').trim()

export function buildConfig(a: WizardAnswers): Record<string, unknown> {
  const tiers = a.selectedTiers.length > 0 ? a.selectedTiers : undefined
  const validation = a.validationCommands.length > 0 ? a.validationCommands : undefined
  const sourceRepoUrl = norm(a.sourceRepo)

  const modulesRoot = norm(a.modulesRoot)
  const specsRoot = norm(a.specsRoot)
  const testsRoot = norm(a.testsRoot)
  const paths: Record<string, string> = {}
  if (modulesRoot) paths.modulesRoot = modulesRoot
  if (specsRoot) paths.specsRoot = specsRoot
  if (testsRoot) paths.testsRoot = testsRoot

  const config: Record<string, unknown> = {
    $schema: './schemas/aef.config.schema.json',
    projectName: norm(a.projectName),
    harnesses: a.harnesses,
    orm: a.orm,
    ui: a.ui,
    stack: a.stack,
    git: { defaultBranch: norm(a.defaultBranch), labels: [] },
  }

  if (Object.keys(paths).length > 0) config.paths = paths
  if (tiers !== undefined) config.tiers = tiers
  if (validation !== undefined) config.validation = validation
  if (sourceRepoUrl) config.source = { repo: sourceRepoUrl, path: null }

  config.feedback = {
    capture: true,
    upstream: {
      mode: a.feedbackMode,
      channel: 'pr',
      schedule: 'weekly',
      sanitize: true,
      requireHumanApproval: true,
    },
  }

  return config
}

/**
 * Carries over fields not covered by wizard prompts from an existing config.
 * Called after buildConfig during reinit to avoid silently resetting rare fields.
 */
export function mergeNonPromptedFields(result: Record<string, unknown>, existing: FrameworkConfig): void {
  // git.labels: keep non-empty label arrays
  if (existing.git?.labels?.length && result.git) {
    ;(result.git as Record<string, unknown>).labels = existing.git.labels
  }
  // source.path: keep a local clone path when the repo is preserved
  if (existing.source?.path && result.source) {
    ;(result.source as Record<string, unknown>).path = existing.source.path
  }
  // feedback.upstream: keep non-mode settings (channel, schedule, sanitize, requireHumanApproval)
  if (existing.feedback?.upstream && result.feedback) {
    const upstream = (result.feedback as Record<string, unknown>).upstream as
      | Record<string, unknown>
      | undefined
    if (upstream) {
      const { channel, schedule, sanitize, requireHumanApproval } = existing.feedback.upstream
      if (channel !== undefined) upstream.channel = channel
      if (schedule !== undefined) upstream.schedule = schedule
      if (sanitize !== undefined) upstream.sanitize = sanitize
      if (requireHumanApproval !== undefined) upstream.requireHumanApproval = requireHumanApproval
    }
  }
}

export async function runWizard(
  root: string,
  existingConfig?: FrameworkConfig,
): Promise<Record<string, unknown>> {
  p.intro('aef init')

  // When an existing config is present, ask whether to update it or start fresh.
  let cfg: FrameworkConfig | undefined = existingConfig
  if (existingConfig) {
    const mode = bail(
      await p.select({
        message: 'aef.config.json already exists — what would you like to do?',
        options: [
          {
            value: 'update' as const,
            label: 'Update',
            hint: 'pre-fill each prompt with the current value',
          },
          {
            value: 'scratch' as const,
            label: 'Start from scratch',
            hint: 'ignore the existing config entirely',
          },
        ],
        initialValue: 'update' as const,
      }),
    )
    if (mode === 'scratch') {
      cfg = undefined
    } else {
      p.note('Existing values shown as defaults — press Enter to keep each one.', 'Updating')
    }
  }

  const projectName = bail(
    await p.text({
      message: 'Project name',
      placeholder: 'my-app',
      initialValue: cfg?.projectName,
      defaultValue: cfg?.projectName ?? 'my-app',
    }),
  )
  const harnesses = bail(
    await p.multiselect({
      message: 'Which AI harnesses should be wired?',
      options: listAdapters(root, 'harness').map((v) => ({ value: v, label: v })),
      initialValues: cfg?.harnesses,
      required: true,
    }),
  )
  const orm = bail(
    await p.select({
      message: 'ORM adapter',
      options: axisOptions(root, 'orm'),
      initialValue: cfg?.orm !== undefined ? cfg.orm : null,
    }),
  )
  const ui = bail(
    await p.select({
      message: 'UI adapter',
      options: axisOptions(root, 'ui'),
      initialValue: cfg?.ui !== undefined ? cfg.ui : null,
    }),
  )
  const stack = bail(
    await p.select({
      message: 'Stack adapter',
      options: axisOptions(root, 'stack'),
      initialValue: cfg?.stack !== undefined ? cfg.stack : null,
    }),
  )

  // Opt-in tiers: read dynamically from tiers.json so new tiers appear automatically.
  const { default: defaultTiers, tiers: tiersData } = loadTiers(root)
  const optInTierOptions = Object.entries(tiersData)
    .filter(([key]) => !defaultTiers.includes(key))
    .map(([key, val]) => ({
      value: key,
      label: key,
      hint: String((val as Record<string, unknown>).description ?? ''),
    }))
  const selectedTiers =
    optInTierOptions.length > 0
      ? bail(
          await p.multiselect({
            message: 'Opt-in skill tiers (space to toggle, none for core only)',
            options: optInTierOptions,
            initialValues: cfg?.tiers ?? [],
            required: false,
          }),
        )
      : []

  // Validation commands: on reinit offer to keep existing; otherwise collect interactively.
  const validationCommands: string[] = []
  const existingCmds = cfg?.validation ?? []
  if (existingCmds.length > 0) {
    const keep = bail(
      await p.confirm({
        message: `Keep existing validation commands (${existingCmds.join(', ')})?`,
        initialValue: true,
      }),
    )
    if (keep) {
      validationCommands.push(...existingCmds)
    }
  }
  if (validationCommands.length === 0) {
    while (true) {
      const cmd = bail(
        await p.text({
          message:
            validationCommands.length === 0
              ? 'Gate command (e.g. pnpm test; blank to skip)'
              : `Gate command ${validationCommands.length + 1} (blank to finish)`,
          placeholder: validationCommands.length === 0 ? 'pnpm test' : 'pnpm build',
        }),
      )
      if (!cmd.trim()) break
      validationCommands.push(cmd.trim())
    }
  }

  const defaultBranch = bail(
    await p.text({
      message: 'Default git branch',
      placeholder: 'main',
      initialValue: cfg?.git?.defaultBranch,
      defaultValue: cfg?.git?.defaultBranch ?? 'main',
    }),
  )
  const sourceRepo = bail(
    await p.text({
      message: 'Framework source repo URL (for aef sync / improve-framework; blank to skip)',
      placeholder: 'git@github.com:owner/agentic-engineering-framework.git',
      initialValue: cfg?.source?.repo || undefined,
      defaultValue: cfg?.source?.repo || undefined,
    }),
  )
  const modulesRoot = bail(
    await p.text({
      message: 'Modules root path (blank for default)',
      placeholder: 'src/modules',
      initialValue: cfg?.paths?.modulesRoot || undefined,
      defaultValue: cfg?.paths?.modulesRoot || undefined,
    }),
  )
  const specsRoot = bail(
    await p.text({
      message: 'Specs root path (blank for default)',
      placeholder: '.ai/specs',
      initialValue: cfg?.paths?.specsRoot || undefined,
      defaultValue: cfg?.paths?.specsRoot || undefined,
    }),
  )
  const testsRoot = bail(
    await p.text({
      message: 'Tests root path (blank for default)',
      placeholder: '.ai/qa/tests',
      initialValue: cfg?.paths?.testsRoot || undefined,
      defaultValue: cfg?.paths?.testsRoot || undefined,
    }),
  )
  const feedbackMode = bail(
    await p.select<'scheduled-pr' | 'prompt' | 'off'>({
      message: 'Feedback upstream routing',
      options: [
        {
          value: 'scheduled-pr' as const,
          label: 'scheduled-pr',
          hint: 'Open a PR with lessons on a schedule',
        },
        { value: 'prompt' as const, label: 'prompt', hint: 'Ask before routing each batch' },
        { value: 'off' as const, label: 'off', hint: 'Capture locally only, never route upstream' },
      ],
      initialValue: cfg?.feedback?.upstream?.mode ?? 'scheduled-pr',
    }),
  )

  p.outro('Configuration ready.')

  const result = buildConfig({
    projectName,
    harnesses,
    orm,
    ui,
    stack,
    selectedTiers,
    validationCommands,
    defaultBranch,
    sourceRepo,
    modulesRoot,
    specsRoot,
    testsRoot,
    feedbackMode,
  })

  if (cfg) {
    mergeNonPromptedFields(result, cfg)
  }

  return result
}
