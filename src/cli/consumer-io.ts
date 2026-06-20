// Filesystem side of init/sync: writing a consumer's .ai/ tree and wiring harnesses.
// Kept separate from the command wiring so the behaviour is unit-testable.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  lstatSync,
  renameSync,
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

/**
 * Install the generic `core/ai` conventions into a consumer: the specs/qa/runs scaffolding,
 * a starter lessons.md, a CLAUDE.md, and AGENTS.md rendered from the template with
 * {{PROJECT_NAME}} substituted. Idempotent — safe to re-run. Returns the paths written.
 */
export function writeConventions(root: string, out: string, config: FrameworkConfig): string[] {
  const projectName = config.projectName ?? 'your project'
  const sub = (s: string): string => s.split('{{PROJECT_NAME}}').join(projectName)
  const ai = join(out, '.ai')
  mkdirSync(ai, { recursive: true })
  const written: string[] = []

  for (const dir of ['specs', 'qa', 'runs']) {
    const src = join(root, 'core', 'ai', dir)
    if (existsSync(src)) {
      cpSync(src, join(ai, dir), { recursive: true })
      written.push(`.ai/${dir}/`)
    }
  }
  // Substitute {{PROJECT_NAME}} in the one convention file that carries it.
  const specsReadme = join(ai, 'specs', 'README.md')
  if (existsSync(specsReadme)) writeFileSync(specsReadme, sub(readFileSync(specsReadme, 'utf8')))

  const lessonsSrc = join(root, 'core', 'ai', 'lessons.md')
  if (existsSync(lessonsSrc)) {
    writeFileSync(join(ai, 'lessons.md'), sub(readFileSync(lessonsSrc, 'utf8')))
    written.push('.ai/lessons.md')
  }
  // Synced-read-only generic lessons.
  const fwLessons = join(root, 'core', 'ai', 'lessons.framework.md')
  if (existsSync(fwLessons)) {
    writeFileSync(join(ai, 'lessons.framework.md'), readFileSync(fwLessons, 'utf8'))
    written.push('.ai/lessons.framework.md')
  }
  // Framework-feedback outbox: only for consumers who have opted in to the framework tier.
  const outbox = join(root, 'core', 'ai', 'framework-feedback')
  if (existsSync(outbox) && config.tiers?.includes('framework')) {
    cpSync(outbox, join(ai, 'framework-feedback'), { recursive: true })
    written.push('.ai/framework-feedback/')
  }

  const tpl = join(root, 'core', 'AGENTS.md.template')
  if (existsSync(tpl)) {
    writeFileSync(join(out, 'AGENTS.md'), sub(readFileSync(tpl, 'utf8')))
    written.push('AGENTS.md')
  }
  writeFileSync(join(out, 'CLAUDE.md'), '@AGENTS.md\n')
  written.push('CLAUDE.md')
  return written
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
    JSON.stringify(
      { selection: pick(config, ['orm', 'ui', 'stack', 'harnesses', 'tiers']), skills },
      null,
      2,
    ) + '\n',
  )
}

export function harnessSkillsDir(root: string, harness: string): string | null {
  const p = join(root, 'adapters', 'harness', harness, 'adapter.json')
  if (!existsSync(p)) return null
  const ad = AdapterSchema.parse(JSON.parse(readFileSync(p, 'utf8')))
  return ad.skillsDir ?? null
}

export function wireNewSkills(root: string, out: string, config: FrameworkConfig, skills: string[]): void {
  for (const harness of config.harnesses) {
    const adPath = join(root, 'adapters', 'harness', harness, 'adapter.json')
    if (!existsSync(adPath)) continue
    const ad = AdapterSchema.parse(JSON.parse(readFileSync(adPath, 'utf8')))
    if (!ad.skillsDir || !ad.linkBase) continue
    const hdir = join(out, ad.skillsDir)
    mkdirSync(hdir, { recursive: true })
    for (const skill of skills) {
      const link = join(hdir, skill)
      if (!existsSync(link) && !isLink(link)) symlinkSync(`${ad.linkBase}/${skill}`, link)
    }
  }
}

function detectIndent(json: string): string | number {
  const m = json.match(/^\s*[{[]\r?\n([ \t]+)/)
  return m ? m[1]! : 2
}

/**
 * Upsert `@zizzfizzix/aef@^<version>` into the consumer's `package.json` devDependencies
 * and add an `"aef": "aef"` script so collaborators can run `pnpm aef sync` without a
 * global or npx-resolved binary. Preserves existing indentation. Returns a human-readable
 * note for the init/sync summary line. Silently skips (with a hint) when no package.json
 * is present; throws a friendly error when the file is present but malformed.
 */
export function pinAefInPackageJson(out: string, version: string): string {
  const pkgPath = join(out, 'package.json')
  if (!existsSync(pkgPath)) {
    return `no package.json found — run: pnpm add -D @zizzfizzix/aef@^${version}`
  }
  const raw = readFileSync(pkgPath, 'utf8')
  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>
  } catch (e) {
    throw new Error(`Failed to parse ${pkgPath}: ${e instanceof Error ? e.message : String(e)}`)
  }
  const indent = detectIndent(raw)
  const scripts = (pkg['scripts'] as Record<string, string> | undefined) ?? {}
  const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {}
  const wasPresent = '@zizzfizzix/aef' in devDeps
  scripts['aef'] = 'aef'
  devDeps['@zizzfizzix/aef'] = `^${version}`
  pkg['scripts'] = scripts
  pkg['devDependencies'] = devDeps
  writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n')
  return wasPresent
    ? `updated @zizzfizzix/aef to ^${version} in devDependencies`
    : `added @zizzfizzix/aef@^${version} to devDependencies — run \`pnpm install\` then \`pnpm aef --help\``
}

export function migrateConfigName(out: string): void {
  const newPath = join(out, 'aef.config.json')
  const legacyPath = join(out, 'framework.config.json')
  if (!existsSync(newPath) && existsSync(legacyPath)) {
    renameSync(legacyPath, newPath)
    console.log(`  ↑ renamed framework.config.json → aef.config.json (stage with \`git add -A\`)`)
  }
}

export function copySchema(root: string, out: string): boolean {
  const src = join(root, 'schemas', 'aef.config.schema.json')
  if (!existsSync(src)) return false
  const dest = join(out, 'schemas', 'aef.config.schema.json')
  mkdirSync(join(out, 'schemas'), { recursive: true })
  writeFileSync(dest, readFileSync(src, 'utf8'))
  return true
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
