// `agentic render` — render a single skill to stdout (or --out dir) for inspection.
// The lightweight counterpart to `init`; handy while authoring skills/adapters and
// the render step the improve-framework skill points at.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema } from '../../core/contracts.js'
import { renderSkill } from '../../core/render.js'
import { FRAMEWORK_ROOT } from '../root.js'

export interface RenderOptions {
  skill: string
  config?: string
  out?: string
}

export function runRender(opts: RenderOptions): void {
  const root = FRAMEWORK_ROOT
  const config = FrameworkConfigSchema.parse(
    JSON.parse(readFileSync(opts.config ?? join(root, 'framework.config.example.json'), 'utf8')),
  )
  const { rendered, manifest, digest } = renderSkill(root, config, opts.skill)

  if (opts.out) {
    const dest = join(opts.out, opts.skill)
    mkdirSync(dest, { recursive: true })
    writeFileSync(join(dest, 'SKILL.md'), rendered)
    writeFileSync(join(dest, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')
    console.error(
      `Rendered '${opts.skill}' (orm=${manifest.selection.orm ?? 'none'}) -> ${relative(root, dest)}`,
    )
    console.error(
      `  digest ${digest} · ${manifest.regions.length} regions · ${manifest.inputs.length} inputs`,
    )
  } else {
    // Body to stdout (pipeable); summary to stderr.
    process.stdout.write(rendered)
    console.error(
      `  digest ${digest} · ${manifest.regions.length} regions · ${manifest.inputs.length} inputs`,
    )
  }
}
