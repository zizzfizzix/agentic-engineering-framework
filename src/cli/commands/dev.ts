// `aef dev` — the "meta" install for developing THIS framework. Wires the repo's
// own harness skill dirs to dev/ skills (source symlinks) and renders shipped skills
// from dev/framework.config.json into the same dirs. Harness dirs are gitignored.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { AdapterSchema, FrameworkConfigSchema } from '../../core/contracts.js'
import { renderSkill } from '../../core/render.js'
import { selectSkills } from '../../core/select.js'
import { FRAMEWORK_ROOT } from '../root.js'
import { isLink } from '../consumer-io.js'

export function runDev(): void {
  const root = FRAMEWORK_ROOT

  const devSkillsDir = join(root, 'dev', 'skills')
  if (!existsSync(devSkillsDir)) {
    console.error('no dev/skills/ found')
    process.exit(1)
  }
  const devSkills = readdirSync(devSkillsDir).filter((d) => existsSync(join(devSkillsDir, d, 'SKILL.md')))

  const devConfigPath = join(root, 'dev', 'framework.config.json')
  const config = FrameworkConfigSchema.parse(JSON.parse(readFileSync(devConfigPath, 'utf8')))
  const { skills: shippedSkills, skipped } = selectSkills(root, config)

  const harnessRoot = join(root, 'adapters', 'harness')
  const harnesses = readdirSync(harnessRoot).filter((d) => existsSync(join(harnessRoot, d, 'adapter.json')))

  const wired: string[] = []
  for (const harness of harnesses) {
    const ad = AdapterSchema.parse(
      JSON.parse(readFileSync(join(harnessRoot, harness, 'adapter.json'), 'utf8')),
    )
    if (!ad.skillsDir) continue
    const hdir = join(root, ad.skillsDir)
    mkdirSync(hdir, { recursive: true })

    // Dev skills: symlink so edits to SKILL.md are immediately reflected.
    const target = relative(hdir, devSkillsDir)
    for (const skill of devSkills) {
      const link = join(hdir, skill)
      if (existsSync(link) || isLink(link)) rmSync(link, { recursive: true, force: true })
      symlinkSync(join(target, skill), link)
    }

    // Shipped skills: render with the dev config and write SKILL.md directly.
    for (const skill of shippedSkills) {
      const dest = join(hdir, skill)
      if (existsSync(dest) || isLink(dest)) rmSync(dest, { recursive: true, force: true })
      mkdirSync(dest, { recursive: true })
      const { rendered } = renderSkill(root, config, skill)
      writeFileSync(join(dest, 'SKILL.md'), rendered)
    }

    wired.push(`${harness} -> ${ad.skillsDir}`)
  }

  console.log('Framework dev install (meta):')
  console.log(`  dev skills   : ${devSkills.join(', ') || '(none)'}`)
  console.log(`  shipped skills: ${shippedSkills.join(', ') || '(none)'}`)
  if (skipped.length) console.log(`  skipped      : ${skipped.join(', ')}`)
  console.log(`  harnesses    : ${wired.join(' | ')}`)
  console.log('  (harness dirs are gitignored; re-run after adding or changing a skill)')
}
