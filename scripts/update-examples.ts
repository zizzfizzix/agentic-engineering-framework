// Regenerate the illustrative examples/ fixtures (the goldens) from current source.
// Run via `pnpm goldens:update` after any intentional render/CLI behaviour change,
// then review the diff. examples/ is never hand-edited.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSkill } from '../src/core/render.js'
import { FrameworkConfigSchema } from '../src/core/contracts.js'
import { runInit } from '../src/cli/commands/init.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = FrameworkConfigSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'framework.config.example.json'), 'utf8')),
)

// 1. Single-skill renders under examples/rendered/.
for (const skill of ['migrate-orm', 'ui-consistency']) {
  const { rendered, manifest } = renderSkill(ROOT, config, skill)
  const dest = join(ROOT, 'examples', 'rendered', skill)
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'SKILL.md'), rendered)
  writeFileSync(join(dest, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`  rendered examples/rendered/${skill}`)
}

// 2. Full consumer install under examples/consumer/.
rmSync(join(ROOT, 'examples', 'consumer'), { recursive: true, force: true })
await runInit({ out: join(ROOT, 'examples', 'consumer') })
