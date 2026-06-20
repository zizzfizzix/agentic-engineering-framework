// Tier resolution — turns the configured axis selections into the converged skill set.
// A skill whose required axis is unconfigured is skipped (reported, not errored).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FrameworkConfig, Tiers } from './contracts.js'
import { TiersSchema } from './contracts.js'

export interface SkillSelection {
  skills: string[]
  skipped: string[]
}

export function loadTiers(root: string): Tiers {
  return TiersSchema.parse(JSON.parse(readFileSync(join(root, 'core/ai/skills/tiers.json'), 'utf8')))
}

export function selectSkills(root: string, config: FrameworkConfig): SkillSelection {
  const tiers = loadTiers(root)
  const requires = tiers.requires ?? {}
  const skipped: string[] = []

  for (const t of config.tiers ?? [])
    if (!(t in tiers.tiers)) skipped.push(`tier '${t}' (unknown — not in tiers.json)`)

  const activeTiers = [...tiers.default, ...(config.tiers ?? [])]
  const candidates: string[] = []
  for (const t of activeTiers)
    for (const s of tiers.tiers[t]?.skills ?? []) if (!candidates.includes(s)) candidates.push(s)

  const skills: string[] = []
  for (const s of candidates) {
    const axis = requires[s]
    if (axis && !config[axis as keyof FrameworkConfig]) skipped.push(`${s} (needs ${axis})`)
    else skills.push(s)
  }
  return { skills: skills.sort(), skipped }
}
