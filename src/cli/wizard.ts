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

  p.outro('Configuration ready.')

  return {
    $schema: './node_modules/@zizzfizzix/aef/schemas/framework.config.schema.json',
    projectName,
    harnesses,
    orm,
    ui,
  }
}
