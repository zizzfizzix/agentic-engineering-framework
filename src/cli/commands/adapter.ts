// `agentic add <adapter>` / `agentic remove <adapter>` — change an axis selection in a
// consumer's framework.config.json and reconcile the installed skill set:
//   • newly-selected skills are rendered fresh (+ BASE snapshot),
//   • skills no longer selected are uninstalled (skill dir, BASE, harness links),
//   • surviving skills are 3-way merged (like sync) so adapter-content changes flow in
//     without clobbering local edits.
// The adapter's axis is read from its adapter.json, so the command is `add <name>`.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema, AdapterSchema, type FrameworkConfig } from '../../core/contracts.js'
import { renderSkill } from '../../core/render.js'
import { mergeFile } from '../../core/merge.js'
import { selectSkills } from '../../core/select.js'
import { FRAMEWORK_ROOT } from '../root.js'
import { writeSkill, writeBase, writeManifest, wireHarnesses, type ManifestSkills } from '../consumer-io.js'

const AXES = ['orm', 'ui', 'stack', 'harness'] as const

interface ManifestFile {
  selection: unknown
  skills: ManifestSkills
}

export interface AdapterCmdOptions {
  out?: string
  copy?: boolean
}

/** Find which axis an adapter name belongs to by locating its adapter.json on disk. */
function resolveAxis(root: string, name: string): (typeof AXES)[number] {
  for (const axis of AXES) {
    if (existsSync(join(root, 'adapters', axis, name, 'adapter.json'))) return axis
  }
  throw new Error(`no adapter '${name}' found under adapters/{${AXES.join(',')}}/`)
}

function harnessSkillsDir(root: string, harness: string): string | null {
  const p = join(root, 'adapters', 'harness', harness, 'adapter.json')
  if (!existsSync(p)) return null
  const ad = AdapterSchema.parse(JSON.parse(readFileSync(p, 'utf8')))
  return ad.skillsDir ?? null
}

export function runAdd(name: string, opts: AdapterCmdOptions): void {
  mutate(name, 'add', opts)
}

export function runRemove(name: string, opts: AdapterCmdOptions): void {
  mutate(name, 'remove', opts)
}

function mutate(name: string, op: 'add' | 'remove', opts: AdapterCmdOptions): void {
  const root = FRAMEWORK_ROOT
  const out = opts.out ?? join(root, 'examples/consumer')
  const useCopy = Boolean(opts.copy)
  const cfgPath = join(out, 'framework.config.json')

  const raw = JSON.parse(readFileSync(cfgPath, 'utf8')) as Record<string, unknown>
  const axis = resolveAxis(root, name)
  const prevHarnesses = [...(FrameworkConfigSchema.parse(raw).harnesses ?? [])]

  if (axis === 'harness') {
    const list = new Set(prevHarnesses)
    if (op === 'add') list.add(name)
    else list.delete(name)
    raw.harnesses = [...list]
  } else if (op === 'add') {
    raw[axis] = name
  } else {
    // remove: only clear the axis if this adapter is the one selected
    if (raw[axis] !== name) throw new Error(`'${name}' is not the active ${axis} adapter; nothing to remove`)
    raw[axis] = null
  }

  const config = FrameworkConfigSchema.parse(raw)
  writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n')

  const conflicts = reconcile(root, out, config, prevHarnesses, useCopy)
  console.log(
    `${op === 'add' ? 'Added' : 'Removed'} ${name} (${axis}) in ${relative(process.cwd(), out) || '.'}`,
  )
  if (conflicts) {
    console.log(
      `\n${conflicts} conflict(s) written as <<<<<<< markers — review with 'git diff', resolve, commit.`,
    )
    process.exitCode = 2
  }
}

function reconcile(
  root: string,
  out: string,
  config: FrameworkConfig,
  prevHarnesses: string[],
  useCopy: boolean,
): number {
  const manifestPath = join(out, '.ai', '.render-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestFile

  const { skills: selected } = selectSkills(root, config)
  const selectedSet = new Set(selected)
  const installed = Object.keys(manifest.skills)
  const allHarnesses = new Set([...prevHarnesses, ...(config.harnesses ?? [])])

  // 1. Uninstall skills no longer selected.
  for (const s of installed) {
    if (selectedSet.has(s)) continue
    rmSync(join(out, '.ai', 'skills', s), { recursive: true, force: true })
    rmSync(join(out, '.ai', '.base', s), { recursive: true, force: true })
    delete manifest.skills[s]
    for (const h of allHarnesses) {
      const dir = harnessSkillsDir(root, h)
      if (dir) rmSync(join(out, dir, s), { recursive: true, force: true })
    }
  }

  // 2. Add new + merge surviving skills.
  let conflicts = 0
  for (const s of selected) {
    const { rendered: NEW, manifest: m, digest } = renderSkill(root, config, s)
    const skillMd = join(out, '.ai', 'skills', s, 'SKILL.md')
    const baseMd = join(out, '.ai', '.base', s, 'SKILL.md')

    if (!manifest.skills[s] || !existsSync(skillMd)) {
      writeSkill(out, s, NEW, m)
      writeBase(out, s, NEW)
      manifest.skills[s] = { digest, inputs: m.inputs }
      continue
    }
    const BASE = existsSync(baseMd) ? readFileSync(baseMd, 'utf8') : NEW
    const LOCAL = readFileSync(skillMd, 'utf8')
    if (NEW !== BASE) {
      if (LOCAL === BASE) {
        writeFileSync(skillMd, NEW)
      } else {
        const { merged, conflicts: n } = mergeFile(LOCAL, BASE, NEW)
        writeFileSync(skillMd, merged)
        conflicts += n
      }
      writeBase(out, s, NEW)
    }
    writeFileSync(join(out, '.ai', 'skills', s, 'provenance.json'), JSON.stringify(m, null, 2) + '\n')
    manifest.skills[s] = { digest, inputs: m.inputs }
  }

  // 3. Drop skills dirs for harnesses that were removed entirely, then re-wire.
  for (const h of prevHarnesses) {
    if ((config.harnesses ?? []).includes(h)) continue
    const dir = harnessSkillsDir(root, h)
    if (dir && existsSync(join(out, dir))) rmSync(join(out, dir), { recursive: true, force: true })
  }
  wireHarnesses(root, out, config, selected, useCopy)

  writeManifest(out, config, manifest.skills)
  return conflicts
}
