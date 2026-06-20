// Interactive `init` wizard (opt-in via --interactive). Discovers the available
// adapters on disk and builds a framework.config object via @clack/prompts.
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { loadTiers } from '../core/select.js'

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

export async function runWizard(root: string): Promise<Record<string, unknown>> {
  p.intro('aef init')

  const projectName = bail(
    await p.text({ message: 'Project name', placeholder: 'my-app', defaultValue: 'my-app' }),
  )
  const harnesses = bail(
    await p.multiselect({
      message: 'Which AI harnesses should be wired?',
      options: listAdapters(root, 'harness').map((v) => ({ value: v, label: v })),
      required: true,
    }),
  )
  const orm = bail(
    await p.select({ message: 'ORM adapter', options: axisOptions(root, 'orm'), initialValue: null }),
  )
  const ui = bail(
    await p.select({ message: 'UI adapter', options: axisOptions(root, 'ui'), initialValue: null }),
  )
  const stack = bail(
    await p.select({ message: 'Stack adapter', options: axisOptions(root, 'stack'), initialValue: null }),
  )

  // Opt-in tiers: everything not in the default tier list, read dynamically from tiers.json.
  const { default: defaultTiers, tiers: tiersData } = loadTiers(root)
  const optInTierOptions = Object.entries(tiersData)
    .filter(([key]) => !defaultTiers.includes(key))
    .map(([key, val]) => ({
      value: key,
      label: key,
      hint: String((val as Record<string, unknown>).description ?? ''),
    }))
  const selectedTiers = bail(
    await p.multiselect({
      message: 'Opt-in skill tiers (space to toggle, none for core only)',
      options: optInTierOptions,
      required: false,
    }),
  )

  const validationRaw = bail(
    await p.text({
      message: 'Verification gate commands (comma-separated, e.g. pnpm test, pnpm build)',
      placeholder: 'pnpm test, pnpm build',
    }),
  )
  const defaultBranch = bail(
    await p.text({
      message: 'Default git branch',
      placeholder: 'main',
      defaultValue: 'main',
    }),
  )
  const sourceRepo = bail(
    await p.text({
      message: 'Framework source repo URL (for aef sync / improve-framework; blank to skip)',
      placeholder: 'git@github.com:owner/agentic-engineering-framework.git',
    }),
  )
  const modulesRoot = bail(
    await p.text({ message: 'Modules root path (blank for default)', placeholder: 'src/modules' }),
  )
  const specsRoot = bail(
    await p.text({ message: 'Specs root path (blank for default)', placeholder: '.ai/specs' }),
  )
  const testsRoot = bail(
    await p.text({ message: 'Tests root path (blank for default)', placeholder: '.ai/qa/tests' }),
  )
  const feedbackMode = bail(
    await p.select({
      message: 'Feedback upstream routing',
      options: [
        { value: 'scheduled-pr', label: 'scheduled-pr', hint: 'Open a PR with lessons on a schedule' },
        { value: 'prompt', label: 'prompt', hint: 'Ask before routing each batch' },
        { value: 'off', label: 'off', hint: 'Capture locally only, never route upstream' },
      ],
      initialValue: 'scheduled-pr' as string,
    }),
  )

  p.outro('Configuration ready.')

  const tiers = selectedTiers.length > 0 ? selectedTiers : undefined
  const validation = validationRaw.trim()
    ? validationRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined
  const sourceRepoUrl = sourceRepo.trim()

  const paths: Record<string, string> = {}
  if (modulesRoot.trim()) paths.modulesRoot = modulesRoot.trim()
  if (specsRoot.trim()) paths.specsRoot = specsRoot.trim()
  if (testsRoot.trim()) paths.testsRoot = testsRoot.trim()

  const config: Record<string, unknown> = {
    $schema: './schemas/framework.config.schema.json',
    projectName,
    harnesses,
    orm,
    ui,
    stack,
    git: { defaultBranch, labels: [] },
  }

  if (Object.keys(paths).length > 0) config.paths = paths
  if (tiers !== undefined) config.tiers = tiers
  if (validation !== undefined) config.validation = validation
  if (sourceRepoUrl) config.source = { repo: sourceRepoUrl, path: null }

  config.feedback = {
    capture: true,
    upstream: {
      mode: feedbackMode,
      channel: 'pr',
      schedule: 'weekly',
      sanitize: true,
      requireHumanApproval: true,
    },
  }

  return config
}
