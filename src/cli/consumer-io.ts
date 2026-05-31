// Filesystem side of init/sync: writing a consumer's .ai/ tree and wiring harnesses.
// Kept separate from the command wiring so the behaviour is unit-testable.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  lstatSync,
  rmSync,
  cpSync,
  symlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { AdapterSchema, type FrameworkConfig } from '../core/contracts.js'
import type { InputRef, RenderManifest } from '../core/render.js'

export const isLink = (p: string): boolean => {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

export function pick<T extends Record<string, unknown>>(o: T, keys: string[]): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  for (const k of keys) if (k in o) r[k] = o[k]
  return r
}

export function writeSkill(out: string, skill: string, rendered: string, manifest: RenderManifest): void {
  const dest = join(out, '.ai', 'skills', skill)
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'SKILL.md'), rendered)
  writeFileSync(join(dest, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')
}

export function writeBase(out: string, skill: string, rendered: string): void {
  const d = join(out, '.ai', '.base', skill)
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'SKILL.md'), rendered)
}

export type ManifestSkills = Record<string, { digest: string; inputs: InputRef[] }>

export function writeManifest(out: string, config: FrameworkConfig, skills: ManifestSkills): void {
  mkdirSync(join(out, '.ai'), { recursive: true })
  writeFileSync(
    join(out, '.ai', '.render-manifest.json'),
    JSON.stringify({ selection: pick(config, ['orm', 'ui', 'stack', 'harnesses']), skills }, null, 2) + '\n',
  )
}

export function wireHarnesses(
  root: string,
  out: string,
  config: FrameworkConfig,
  skills: string[],
  useCopy: boolean,
): string[] {
  const aiSkills = join(out, '.ai', 'skills')
  const wired: string[] = []
  for (const harness of config.harnesses) {
    const adPath = join(root, 'adapters', 'harness', harness, 'adapter.json')
    if (!existsSync(adPath)) {
      console.warn(`! no harness adapter '${harness}', skipping`)
      continue
    }
    const ad = AdapterSchema.parse(JSON.parse(readFileSync(adPath, 'utf8')))
    if (!ad.skillsDir || !ad.linkBase) {
      console.warn(`! harness adapter '${harness}' is missing skillsDir/linkBase, skipping`)
      continue
    }
    const hdir = join(out, ad.skillsDir)
    mkdirSync(hdir, { recursive: true })
    for (const skill of skills) {
      const link = join(hdir, skill)
      if (existsSync(link) || isLink(link)) rmSync(link, { recursive: true, force: true })
      if (useCopy) cpSync(join(aiSkills, skill), link, { recursive: true })
      else symlinkSync(`${ad.linkBase}/${skill}`, link)
    }
    wired.push(`${harness} -> ${ad.skillsDir} (${useCopy ? 'copy' : 'symlink'})`)
  }
  return wired
}
