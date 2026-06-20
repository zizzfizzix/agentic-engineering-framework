// Interactive `init` wizard (opt-in via --interactive). Discovers the available
// adapters on disk and builds a framework.config object via @clack/prompts.
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'

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
  const selectedTiers = bail(
    await p.multiselect({
      message: 'Opt-in skill tiers (space to toggle, none for core only)',
      options: [
        { value: 'automation', label: 'automation', hint: 'PR/issue automation workflows' },
        { value: 'security', label: 'security', hint: 'Security audit skills' },
        { value: 'framework', label: 'framework', hint: 'Contribute fixes/lessons back to the framework' },
      ],
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

  p.note(
    'Edit framework.config.json to set paths, feedback routing, and other advanced fields.\nSee framework.config.example.json for a full reference of all available options.',
    'Next steps',
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

  const config: Record<string, unknown> = {
    $schema: './schemas/framework.config.schema.json',
    projectName,
    harnesses,
    orm,
    ui,
    stack,
    git: { defaultBranch },
  }

  if (tiers !== undefined) config.tiers = tiers
  if (validation !== undefined) config.validation = validation
  if (sourceRepoUrl) config.source = { repo: sourceRepoUrl, path: null }

  return config
}
