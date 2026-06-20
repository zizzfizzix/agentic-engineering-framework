// `aef init` — render the configured skill set into <out>/.ai/skills/, snapshot a
// BASE under <out>/.ai/.base/, write the render manifest (sync's base), persist the
// resolved config, and wire each harness.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema, type FrameworkConfig } from '../../core/contracts.js'
import { renderSkill } from '../../core/render.js'
import { selectSkills } from '../../core/select.js'
import { FRAMEWORK_ROOT } from '../root.js'
import {
  writeSkill,
  writeBase,
  writeManifest,
  wireHarnesses,
  writeConventions,
  copySchema,
  pinAefInPackageJson,
  type ManifestSkills,
} from '../consumer-io.js'
import { runWizard } from '../wizard.js'

export interface InitOptions {
  config?: string
  out?: string
  copy?: boolean
  interactive?: boolean
  force?: boolean
}

export async function runInit(opts: InitOptions): Promise<void> {
  const root = FRAMEWORK_ROOT

  if (opts.config && opts.interactive) {
    throw new Error(
      `--config and --interactive are mutually exclusive. Pass --config to use a file or --interactive to build one via prompts.`,
    )
  }
  if (!opts.config && !opts.interactive) {
    throw new Error(
      `--config is required.\n\nUsage: aef init --config framework.config.json --out . --copy\n\nTo get started, create a framework.config.json. Minimum required:\n  {\n    "harnesses": ["claude-code"]\n  }\n\nRun 'aef init --help' for all options.`,
    )
  }

  const out = opts.out ?? process.cwd()

  // `raw` is what we persist to framework.config.json (byte-stable); `config` is the
  // zod-validated view the renderer consumes.
  let raw: unknown
  if (opts.interactive) {
    const existingPath = join(out, 'framework.config.json')
    let existingConfig: FrameworkConfig | undefined
    if (!opts.force && existsSync(existingPath)) {
      try {
        existingConfig = FrameworkConfigSchema.parse(JSON.parse(readFileSync(existingPath, 'utf8')))
      } catch {
        // ignore — wizard starts fresh if the existing config is unreadable
      }
    }
    raw = await runWizard(root, existingConfig)
  } else {
    raw = JSON.parse(readFileSync(opts.config!, 'utf8'))
  }
  const config = FrameworkConfigSchema.parse(raw)
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
  const schemaCopied = copySchema(root, out)
  writeFileSync(join(out, 'framework.config.json'), JSON.stringify(raw, null, 2) + '\n')

  const conventions = writeConventions(root, out, config)
  const wired = wireHarnesses(root, out, config, skills, useCopy)

  const { version } = JSON.parse(readFileSync(join(FRAMEWORK_ROOT, 'package.json'), 'utf8')) as {
    version: string
  }
  const pkgNote = pinAefInPackageJson(out, version)

  console.log(`Initialised agentic framework into ${relative(process.cwd(), out) || '.'}`)
  console.log(`  skills installed: ${skills.join(', ') || '(none)'}`)
  console.log(`  conventions: ${conventions.join(', ')}`)
  if (skipped.length) console.log(`  skipped (axis not configured): ${skipped.join(', ')}`)
  console.log(`  harnesses wired: ${wired.join(' | ') || '(none)'}`)
  if (schemaCopied) console.log(`  schema: schemas/framework.config.schema.json`)
  console.log(`  package.json: ${pkgNote}`)
}
