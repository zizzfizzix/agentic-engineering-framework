// `aef add <adapter>` / `aef remove <adapter>` — change an axis selection in a
// consumer's framework.config.json and reconcile the installed skill set:
//   • newly-selected skills are rendered fresh (+ BASE snapshot),
//   • skills no longer selected are uninstalled (skill dir, BASE, harness links),
//   • surviving skills are 3-way merged (like sync) so adapter-content changes flow in
//     without clobbering local edits.
// The adapter's axis is read from its adapter.json, so the command is `add <name>`.
import { readFileSync, writeFileSync, existsSync, rmSync, cpSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema, type FrameworkConfig } from '../../core/contracts.js'
import { selectSkills, loadTiers } from '../../core/select.js'
import { FRAMEWORK_ROOT } from '../root.js'
import { writeManifest, wireHarnesses, harnessSkillsDir, type ManifestSkills } from '../consumer-io.js'
import { reconcileSkill } from '../reconcile.js'

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
  const prevConfig = FrameworkConfigSchema.parse(raw)
  const prevHarnesses = [...(prevConfig.harnesses ?? [])]

  const tierDef = loadTiers(root)
  const isTier = name in tierDef.tiers

  if (isTier) {
    if (tierDef.default.includes(name))
      throw new Error(
        `tier '${name}' is a default tier — it is always active and cannot be ${op === 'add' ? 'explicitly opted in' : 'removed'}`,
      )
    const current = prevConfig.tiers ?? []
    if (op === 'add') {
      if (!current.includes(name)) raw.tiers = [...current, name]
    } else {
      if (!current.includes(name)) throw new Error(`tier '${name}' is not enabled; nothing to remove`)
      const after = current.filter((t) => t !== name)
      if (after.length > 0) raw.tiers = after
      else delete raw.tiers
    }
  } else {
    const axis = resolveAxis(root, name)
    if (axis === 'harness') {
      const list = new Set(prevHarnesses)
      if (op === 'add') {
        list.add(name)
      } else {
        if (!list.has(name)) throw new Error(`harness '${name}' is not installed; nothing to remove`)
        if (list.size === 1) throw new Error('cannot remove the last harness — at least one is required')
        list.delete(name)
      }
      raw.harnesses = [...list]
    } else if (op === 'add') {
      raw[axis] = name
    } else {
      if (raw[axis] !== name)
        throw new Error(`'${name}' is not the active ${axis} adapter; nothing to remove`)
      raw[axis] = null
    }
  }

  const config = FrameworkConfigSchema.parse(raw)
  writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n')

  if (isTier && name === 'framework') {
    const outboxDst = join(out, '.ai', 'framework-feedback')
    if (op === 'add') {
      const outboxSrc = join(root, 'core', 'ai', 'framework-feedback')
      if (existsSync(outboxSrc)) cpSync(outboxSrc, outboxDst, { recursive: true })
    } else {
      rmSync(outboxDst, { recursive: true, force: true })
    }
  }

  const conflicts = reconcile(root, out, config, prevHarnesses, useCopy)
  const kind = isTier ? 'tier' : 'adapter'
  console.log(
    `${op === 'add' ? 'Added' : 'Removed'} ${name} (${kind}) in ${relative(process.cwd(), out) || '.'}`,
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

  // Resolve each harness's skills dir once (used when removing skills and harnesses).
  const dirByHarness = new Map<string, string | null>()
  for (const h of new Set([...prevHarnesses, ...(config.harnesses ?? [])]))
    dirByHarness.set(h, harnessSkillsDir(root, h))

  // 1. Uninstall skills no longer selected.
  for (const s of installed) {
    if (selectedSet.has(s)) continue
    rmSync(join(out, '.ai', 'skills', s), { recursive: true, force: true })
    rmSync(join(out, '.ai', '.base', s), { recursive: true, force: true })
    delete manifest.skills[s]
    for (const dir of dirByHarness.values())
      if (dir) rmSync(join(out, dir, s), { recursive: true, force: true })
  }

  // 2. Install new + 3-way-merge surviving skills (shared with `sync`).
  let conflicts = 0
  for (const s of selected) {
    const r = reconcileSkill(root, out, config, s)
    manifest.skills[s] = { digest: r.digest, inputs: r.inputs }
    conflicts += r.conflicts
  }

  // 3. Drop skills dirs for harnesses removed entirely, then re-wire the surviving set.
  for (const h of prevHarnesses) {
    if ((config.harnesses ?? []).includes(h)) continue
    const dir = dirByHarness.get(h)
    if (dir && existsSync(join(out, dir))) rmSync(join(out, dir), { recursive: true, force: true })
  }
  wireHarnesses(root, out, config, selected, useCopy)

  writeManifest(out, config, manifest.skills)
  return conflicts
}
