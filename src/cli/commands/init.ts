// `aef init` — render the configured skill set into <out>/.ai/skills/, snapshot a
// BASE under <out>/.ai/.base/, write the render manifest (sync's base), persist the
// resolved config, and wire each harness.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema } from '../../core/contracts.js'
import { renderSkill } from '../../core/render.js'
import { selectSkills } from '../../core/select.js'
import { FRAMEWORK_ROOT } from '../root.js'
import {
  writeSkill,
  writeBase,
  writeManifest,
  wireHarnesses,
  writeConventions,
  type ManifestSkills,
} from '../consumer-io.js'
import { runWizard } from '../wizard.js'

export interface InitOptions {
  config?: string
  out?: string
  copy?: boolean
  interactive?: boolean
}

export async function runInit(opts: InitOptions): Promise<void> {
  const root = FRAMEWORK_ROOT

  if (!opts.config && !opts.interactive) {
    throw new Error(
      `--config is required.\n\nUsage: aef init --config framework.config.json --out . --copy\n\nTo get started, create a framework.config.json. Minimum required:\n  {\n    "harnesses": ["claude-code"]\n  }\n\nRun 'aef init --help' for all options.`,
    )
  }

  // `raw` is what we persist to framework.config.json (byte-stable); `config` is the
  // zod-validated view the renderer consumes.
  const raw: unknown = opts.interactive
    ? await runWizard(root)
    : JSON.parse(readFileSync(opts.config!, 'utf8'))
  const config = FrameworkConfigSchema.parse(raw)

  const out = opts.out ?? join(root, 'examples/consumer')
  const useCopy = Boolean(opts.copy)

  const { skills, skipped } = selectSkills(root, config)

  const manifestSkills: ManifestSkills = {}
  for (const skill of skills) {
    const { rendered, manifest, digest } = renderSkill(root, config, skill)
    writeSkill(out, skill, rendered, manifest)
    writeBase(out, skill, rendered)
    manifestSkills[skill] = { digest, inputs: manifest.inputs }
  }
  writeManifest(out, config, manifestSkills)
  writeFileSync(join(out, 'framework.config.json'), JSON.stringify(raw, null, 2) + '\n')

  const conventions = writeConventions(root, out, config)
  const wired = wireHarnesses(root, out, config, skills, useCopy)

  console.log(`Initialised agentic framework into ${relative(process.cwd(), out) || '.'}`)
  console.log(`  skills installed: ${skills.join(', ') || '(none)'}`)
  console.log(`  conventions: ${conventions.join(', ')}`)
  if (skipped.length) console.log(`  skipped (axis not configured): ${skipped.join(', ')}`)
  console.log(`  harnesses wired: ${wired.join(' | ') || '(none)'}`)
}
